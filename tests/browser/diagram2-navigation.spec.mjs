import { expect, test } from "@playwright/test";
import {
  buildAnnotationSvg,
  normalizeAnnotationState
} from "../../wwwroot/js/components/image-annotation.js";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

test("Diagram 2 top navigation opens the isolated shell", async ({ page }) => {
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 1,
    nickname: "Sin",
    isAdmin: true,
    role: "Admin"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(testState())));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));

  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await openNavigationScreen(page, "Diagram");
  await expect(page).toHaveURL(/#\/diagram$/);
  await expect(page.locator(".diagram-screen")).toBeVisible();

  await openNavigationScreen(page, "Diagram 2");
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen] h1")).toHaveText("Diagram 2");
  await expect(page.locator("[data-diagram2-header]")).toContainText("Diagram 2 Beta");
  await expect(page.locator("[data-diagram2-tree] [data-action='select-diagram2-document']")).toHaveCount(2);
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator("[data-diagram2-viewer-host]")).toContainText("Editing stays disabled in Diagram 2.");
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
  await expect.poll(async () =>
    page.locator("[data-diagram2-object-plane] [data-diagram2-object-type='entity']").count()
  ).toBeGreaterThanOrEqual(28);
  await expect(page.locator("[data-diagram2-diagnostic='canonical-object-count']")).toHaveText("88");
  await expect(page.locator("[data-diagram2-diagnostic='canonical-relationship-count']")).toHaveText("82");
  await expect(page.locator("[data-diagram2-diagnostic='mounted-relationship-count']")).toHaveText("82");
  await expect(page.locator("[data-diagram2-diagnostic='full-render-reason']")).toHaveText("initial");
  await expect.poll(async () => Number(await page.locator("[data-diagram2-diagnostic='svg-descendant-count']").textContent()))
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__diagram2StableSvg = document.querySelector("[data-diagram2-svg]");
    window.__diagram2StableEntity = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-type='entity']");
    window.__diagram2StableText = window.__diagram2StableEntity?.querySelector("text") || null;
  });

  const transformOnlyRenderCount = await diagram2FullRenderCount(page);
  await assertKeyedDiagram2NodePatches(page, transformOnlyRenderCount);
  await assertDiagram2LiveGeometryPreview(page, transformOnlyRenderCount);
  await assertDiagram2SelectiveRoutingStress(page);
  for (const zoom of ["0.5", "0.75", "0.9", "1", "1.1", "1.25", "1.5", "2"]) {
    await assertTransformOnlyZoom(page, zoom, transformOnlyRenderCount);
  }
  await assertTransformOnlyPan(page, transformOnlyRenderCount);
  await assertCursorCenteredWheelZoom(page, transformOnlyRenderCount);

  await page.getByRole("button", { name: "Fit Diagram" }).click();
  await waitForViewportReason(page, "fit");
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]") === window.__diagram2StableSvg)
  ).toBe(true);
  await page.getByRole("button", { name: "Refresh Renderer" }).click();
  await waitForViewportReason(page, "fit");
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]") === window.__diagram2StableSvg)
  ).toBe(true);
  await expect(page.locator("[data-diagram2-diagnostic='full-render-reason']")).toHaveText("refresh");
  await expect(page.locator("[data-action='diagram2-import-probe']")).toBeDisabled();
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/#\/diagram$/);
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await page.locator("[data-action='select-diagram2-document'][data-id='77']").click();
  await expect(page).toHaveURL(/#\/diagram-2\/77$/);
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("Checkout Flow");
  await expect(page.locator("[data-diagram2-tree-row][data-id='77']")).toHaveClass(/is-selected/);
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/42";
  });
  await expect(page).toHaveURL(/#\/diagram-2\/42$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator(".diagram-screen")).toHaveCount(0);

  await openNavigationScreen(page, "Settings");
  await page.locator("[data-action='select-lookup-type'][data-type='Navigation']").click();
  await expect(page.locator("[data-navigation-list] [data-nav-view='Diagram 2']")).toContainText("#/diagram-2");

  expect(browserErrors).toEqual([]);
});

async function openNavigationScreen(page, view) {
  const primaryButton = page.locator(`#nav > button.nav-item[data-view='${view}']`);
  if (await primaryButton.isVisible().catch(() => false)) {
    await primaryButton.click();
    return;
  }

  await page.locator(".nav-overflow-toggle").click();
  await page.locator(`.nav-overflow-menu button[data-view='${view}']`).click();
}

async function assertTransformOnlyZoom(page, zoom, expectedFullRenderCount) {
  const before = await diagram2StabilitySnapshot(page);
  await page.locator("[data-filter='diagram2-zoom']").selectOption(zoom);
  await expect.poll(() => diagram2ViewportScale(page)).toBe(Number(zoom));
  await waitForViewportReason(page, "toolbar zoom");
  const afterFrame = await diagram2StabilitySnapshot(page);
  await waitForStableAnimationFrame(page);
  const afterSettle = await diagram2StabilitySnapshot(page);

  expect(afterFrame.svgStable).toBe(true);
  expect(afterFrame.entityStable).toBe(true);
  expect(afterFrame.textStable).toBe(true);
  expect(afterFrame.fullRenderCount).toBe(expectedFullRenderCount);
  expect(afterFrame.fullRendersDuringSettle).toBe(0);
  expect(afterFrame.routesRecalculatedDuringSettle).toBe(0);
  expect(afterFrame.nodeIdentityBeforeAfter).toBe("true");
  expect(afterSettle.fullRenderCount).toBe(expectedFullRenderCount);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).translation).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).size).toBeLessThanOrEqual(0.25);
  expect(before.fullRenderCount).toBe(expectedFullRenderCount);
}

async function assertKeyedDiagram2NodePatches(page, expectedFullRenderCount) {
  const result = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    const entities = [...document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-type='entity']")];
    const relationship = document.querySelector("[data-diagram2-relationship-id]");
    const relatedEntity = relationship?.dataset.diagram2RelationshipSource
      ? document.querySelector(`[data-diagram2-object-id="${CSS.escape(relationship.dataset.diagram2RelationshipSource)}"]`)
      : null;
    const entityA = relatedEntity || entities[0] || null;
    const entityB = entities.find(entity => entity !== entityA) || null;
    const entityAText = entityA?.querySelector("[data-diagram2-entity-title], text") || null;
    if (!renderer || !svg || !entityA || !entityB) return { ready: false };

    const entityAId = entityA.dataset.diagram2ObjectId;
    const entityBId = entityB.dataset.diagram2ObjectId;
    const flushCountBefore = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    renderer.setSelectedIds([entityAId]);
    await renderer.whenIdle();
    const entityASelected = entityA.classList.contains("is-selected");
    renderer.setSelectedIds([entityBId]);
    const selectionDiagnostics = await renderer.whenIdle();
    const selectionPatched = !entityA.classList.contains("is-selected")
      && entityB.classList.contains("is-selected")
      && document.querySelectorAll("[data-diagram2-selection-id]").length === 1;

    renderer.updateObject(entityAId, {
      fill: "#fff7ed",
      entityHeaderFill: "#fed7aa",
      textColor: "#7c2d12"
    });
    const styleDiagnostics = await renderer.whenIdle();
    const fillPatched = entityA.querySelector("[data-diagram2-entity-body]")?.getAttribute("fill") === "#fff7ed";
    const headerPatched = entityA.querySelector("[data-diagram2-entity-header]")?.getAttribute("fill") === "#fed7aa";
    const transformBeforeMove = entityA.getAttribute("transform");
    renderer.updateObject(entityAId, object => ({
      x: Number(object.x || 0) + 24,
      y: Number(object.y || 0) + 16
    }));
    const moveDiagnostics = await renderer.whenIdle();
    const transformAfterMove = entityA.getAttribute("transform");

    const batchFlushBefore = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    renderer.beginDiagramUpdate("batched style test");
    renderer.updateObject(entityAId, { fill: "#eef2ff" });
    renderer.updateObject(entityBId, { fill: "#ecfdf5" });
    const transactionSnapshot = renderer.liveViewSnapshot();
    renderer.endDiagramUpdate("batched style test");
    const batchDiagnostics = await renderer.whenIdle();
    const batchFlushAfter = Number(svg.dataset.diagram2DirtyFlushCount || 0);

    const selectionEntityIds = entities.slice(0, 28).map(entity => entity.dataset.diagram2ObjectId);
    renderer.setSelectedIds(selectionEntityIds);
    const largeSelectionDiagnostics = await renderer.whenIdle();

    return {
      ready: true,
      entityAStable: entityA === document.querySelector(`[data-diagram2-object-id="${entityAId}"]`),
      entityBStable: entityB === document.querySelector(`[data-diagram2-object-id="${entityBId}"]`),
      entityATextStable: entityAText === entityA.querySelector("[data-diagram2-entity-title], text"),
      relationshipStable: !relationship || relationship === document.querySelector(`[data-diagram2-relationship-id="${relationship.dataset.diagram2RelationshipId}"]`),
      entityASelected,
      selectionPatched,
      fillPatched,
      headerPatched,
      transformChanged: transformBeforeMove !== transformAfterMove,
      fullRenderCount: Number(svg.dataset.diagram2FullRenderCount || 0),
      objectPatchedCount: Number(svg.dataset.diagram2ObjectsPatchedInLastFlush || 0),
      selectionRoutedRelationshipCount: selectionDiagnostics.routedRelationshipCount,
      styleRoutedRelationshipCount: styleDiagnostics.routedRelationshipCount,
      stylePatchedNodeCount: styleDiagnostics.patchedNodeCount,
      moveRoutedRelationshipCount: moveDiagnostics.routedRelationshipCount,
      moveSelectiveRelationshipsConsidered: moveDiagnostics.selectiveRoutingRelationshipsConsidered,
      moveSelectiveRelationshipsRerouted: moveDiagnostics.selectiveRoutingRelationshipsRerouted,
      moveSelectiveTotalRelationships: moveDiagnostics.selectiveRoutingTotalRelationships,
      moveSelectiveSpatialSectorsQueried: moveDiagnostics.selectiveRoutingSpatialSectorsQueried,
      batchFlushDelta: batchFlushAfter - batchFlushBefore,
      batchPatchedNodeCount: batchDiagnostics.patchedNodeCount,
      batchRoutedRelationshipCount: batchDiagnostics.routedRelationshipCount,
      transactionQueuedDirtyIds: transactionSnapshot.dirtyObjectIds,
      transactionPendingBeforeEnd: transactionSnapshot.pendingDiagramFlush,
      largeSelectionCount: selectionEntityIds.length,
      largeSelectionDuration: largeSelectionDiagnostics.lastFlushDuration,
      largeSelectionRoutedRelationshipCount: largeSelectionDiagnostics.routedRelationshipCount,
      dirtyFlushDelta: Number(svg.dataset.diagram2DirtyFlushCount || 0) - flushCountBefore,
      relationshipNodeCount: document.querySelectorAll("[data-diagram2-relationship-id]").length
    };
  });

  expect(result.ready).toBe(true);
  expect(result.entityAStable).toBe(true);
  expect(result.entityBStable).toBe(true);
  expect(result.entityATextStable).toBe(true);
  expect(result.relationshipStable).toBe(true);
  expect(result.entityASelected).toBe(true);
  expect(result.selectionPatched).toBe(true);
  expect(result.fillPatched).toBe(true);
  expect(result.headerPatched).toBe(true);
  expect(result.transformChanged).toBe(true);
  expect(result.fullRenderCount).toBe(expectedFullRenderCount);
  expect(result.objectPatchedCount).toBe(0);
  expect(result.selectionRoutedRelationshipCount).toBe(0);
  expect(result.styleRoutedRelationshipCount).toBe(0);
  expect(result.stylePatchedNodeCount).toBe(1);
  expect(result.moveRoutedRelationshipCount).toBeGreaterThan(0);
  expect(result.moveSelectiveRelationshipsConsidered).toBeGreaterThan(0);
  expect(result.moveSelectiveRelationshipsConsidered).toBeLessThan(result.moveSelectiveTotalRelationships);
  expect(result.moveSelectiveRelationshipsRerouted).toBe(result.moveRoutedRelationshipCount);
  expect(result.moveSelectiveSpatialSectorsQueried).toBeGreaterThan(0);
  expect(result.batchFlushDelta).toBe(1);
  expect(result.batchPatchedNodeCount).toBe(2);
  expect(result.batchRoutedRelationshipCount).toBe(0);
  expect(result.transactionQueuedDirtyIds).toContain(",");
  expect(result.transactionPendingBeforeEnd).toBe(false);
  expect(result.largeSelectionCount).toBe(28);
  expect(result.largeSelectionDuration).toBeLessThan(50);
  expect(result.largeSelectionRoutedRelationshipCount).toBe(0);
  expect(result.dirtyFlushDelta).toBe(6);
  expect(result.relationshipNodeCount).toBe(82);
}

async function assertDiagram2SelectiveRoutingStress(page) {
  const result = await page.evaluate(async () => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260725-diagram2-day11-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const state = buildDiagram2StressState();
    const renderer = createDiagram2Renderer({ host });
    const initial = renderer.render(state, { reason: "stress initial" });
    const refresh = renderer.render(structuredClone(state), { reason: "stress cache refresh" });
    renderer.updateObject("entity-7", object => ({
      x: Number(object.x || 0) + 36,
      y: Number(object.y || 0) + 24
    }));
    const move = await renderer.whenIdle();
    renderer.updateObject("entity-8", { fill: "#f8fafc" });
    const style = await renderer.whenIdle();
    host.remove();

    return {
      initialRelationships: initial.canonicalRelationshipCount,
      initialRerouted: initial.selectiveRoutingRelationshipsRerouted,
      refreshConsidered: refresh.selectiveRoutingRelationshipsConsidered,
      refreshCacheHits: refresh.selectiveRoutingCacheHits,
      refreshCacheMisses: refresh.selectiveRoutingCacheMisses,
      refreshRerouted: refresh.selectiveRoutingRelationshipsRerouted,
      moveTotal: move.selectiveRoutingTotalRelationships,
      moveConsidered: move.selectiveRoutingRelationshipsConsidered,
      moveRerouted: move.selectiveRoutingRelationshipsRerouted,
      moveCacheMisses: move.selectiveRoutingCacheMisses,
      moveSectorsQueried: move.selectiveRoutingSpatialSectorsQueried,
      moveDuration: move.selectiveRoutingDuration,
      styleRerouted: style.selectiveRoutingRelationshipsRerouted,
      styleConsidered: style.selectiveRoutingRelationshipsConsidered,
      stylePatchedNodeCount: style.patchedNodeCount
    };

    function buildDiagram2StressState() {
      const entityCount = 232;
      const relationshipCount = 624;
      const columns = 29;
      const objects = Array.from({ length: entityCount }, (_, index) => {
        const name = `Stress${index}`;
        return {
          id: `entity-${index}`,
          type: "entity",
          x: (index % columns) * 260,
          y: Math.floor(index / columns) * 190,
          width: 220,
          height: 130,
          entitySchema: "dbo",
          entityName: name,
          fields: [
            { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, isImportant: true },
            { name: "Ref0Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref1Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref2Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref3Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true }
          ],
          foreignKeys: []
        };
      });

      for (let index = 0; index < relationshipCount; index += 1) {
        const sourceIndex = (index % (entityCount - 1)) + 1;
        let targetIndex = (sourceIndex + 17 + (index * 19)) % entityCount;
        if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % entityCount;
        const targetName = `Stress${targetIndex}`;
        objects[sourceIndex].foreignKeys.push({
          name: `FK_Stress_${index}`,
          columns: [`Ref${index % 4}Id`],
          referencedSchema: "dbo",
          referencedTable: targetName,
          referencedColumns: [`${targetName}Id`],
          relationshipType: "many-to-one"
        });
      }

      return {
        width: columns * 260,
        height: 8 * 190,
        objects
      };
    }
  });

  expect(result.initialRelationships).toBe(624);
  expect(result.initialRerouted).toBe(624);
  expect(result.refreshConsidered).toBe(624);
  expect(result.refreshCacheHits).toBe(624);
  expect(result.refreshCacheMisses).toBe(0);
  expect(result.refreshRerouted).toBe(0);
  expect(result.moveTotal).toBe(624);
  expect(result.moveConsidered).toBeGreaterThan(0);
  expect(result.moveConsidered).toBeLessThan(624);
  expect(result.moveRerouted).toBeGreaterThan(0);
  expect(result.moveRerouted).toBeLessThan(624);
  expect(result.moveCacheMisses).toBe(result.moveRerouted);
  expect(result.moveSectorsQueried).toBeGreaterThan(0);
  expect(result.moveDuration).toBeGreaterThanOrEqual(0);
  expect(result.styleRerouted).toBe(0);
  expect(result.styleConsidered).toBe(0);
  expect(result.stylePatchedNodeCount).toBe(1);
}

async function assertDiagram2LiveGeometryPreview(page, expectedFullRenderCount) {
  const result = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    const entities = [...document.querySelectorAll("[data-diagram2-object-plane] [data-diagram2-object-type='entity']")];
    const relationship = [...document.querySelectorAll("[data-diagram2-relationship-id]")]
      .find(candidate => candidate.dataset.diagram2RelationshipSource
        && document.querySelector(`[data-diagram2-object-id="${CSS.escape(candidate.dataset.diagram2RelationshipSource)}"]`));
    const entityA = relationship?.dataset.diagram2RelationshipSource
      ? document.querySelector(`[data-diagram2-object-id="${CSS.escape(relationship.dataset.diagram2RelationshipSource)}"]`)
      : entities[0] || null;
    const entityB = entities.find(entity => entity !== entityA) || null;
    const entityC = entities.find(entity => entity !== entityA && entity !== entityB) || entityB;
    if (!renderer || !svg || !relationship || !entityA || !entityB || !entityC) return { ready: false };

    const entityAId = entityA.dataset.diagram2ObjectId;
    const entityBId = entityB.dataset.diagram2ObjectId;
    const entityCId = entityC.dataset.diagram2ObjectId;
    const relationshipId = relationship.dataset.diagram2RelationshipId;
    const entityAText = entityA.querySelector("[data-diagram2-entity-title], text") || null;

    renderer.setSelectedIds([entityAId]);
    await renderer.whenIdle();
    const dirtyFlushAfterSelection = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const transformBeforeMove = entityA.getAttribute("transform") || "";
    const undoBeforeMove = Number(svg.dataset.diagram2GeometryPreviewUndoEntryCount || 0);
    const commitBeforeMove = Number(svg.dataset.diagram2GeometryPreviewCommitCount || 0);
    const previewFrameBeforeMove = Number(svg.dataset.diagram2GeometryPreviewFrameCount || 0);

    const startDiagnostics = renderer.beginGeometryPreview({ objectId: entityAId, mode: "move" });
    renderer.previewGeometry({ deltaX: 36, deltaY: 22 });
    const pendingAfterFirstMove = renderer.diagnostics().pendingGeometryPreview;
    renderer.previewGeometry({ deltaX: 72, deltaY: 35 });
    const movePreviewDiagnostics = await renderer.whenIdle();
    const transformDuringMove = entityA.getAttribute("transform") || "";
    const dirtyFlushDuringPreview = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const previewPathCountDuringMove = document.querySelectorAll("[data-diagram2-relationship-preview-path]").length;

    renderer.commitGeometryPreview();
    const moveCommitDiagnostics = await renderer.whenIdle();
    const transformAfterCommit = entityA.getAttribute("transform") || "";
    const dirtyFlushAfterCommit = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const fullRenderAfterCommit = Number(svg.dataset.diagram2FullRenderCount || 0);

    renderer.setSelectedIds([entityAId, entityBId]);
    await renderer.whenIdle();
    const dirtyFlushBeforeMulti = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const undoBeforeMulti = Number(svg.dataset.diagram2GeometryPreviewUndoEntryCount || 0);
    const transformABeforeMulti = entityA.getAttribute("transform") || "";
    const transformBBeforeMulti = entityB.getAttribute("transform") || "";

    renderer.beginGeometryPreview({ objectId: entityAId, mode: "move" });
    renderer.previewGeometry({ deltaX: -18, deltaY: 12 });
    const multiPreviewDiagnostics = await renderer.whenIdle();
    const transformADuringMulti = entityA.getAttribute("transform") || "";
    const transformBDuringMulti = entityB.getAttribute("transform") || "";
    renderer.cancelGeometryPreview();
    const multiCancelDiagnostics = renderer.diagnostics();
    const dirtyFlushAfterMultiCancel = Number(svg.dataset.diagram2DirtyFlushCount || 0);

    renderer.setSelectedIds([entityCId]);
    await renderer.whenIdle();
    const dirtyFlushBeforeResize = Number(svg.dataset.diagram2DirtyFlushCount || 0);
    const resizeNodeBefore = entityC;
    const resizeBodyBefore = Number(entityC.querySelector("[data-diagram2-entity-body]")?.getAttribute("width") || 0);
    const undoBeforeResize = Number(svg.dataset.diagram2GeometryPreviewUndoEntryCount || 0);

    renderer.beginGeometryPreview({ objectId: entityCId, mode: "resize" });
    renderer.previewGeometry({ deltaWidth: 28, deltaHeight: 14 });
    const resizePreviewDiagnostics = await renderer.whenIdle();
    const resizeBodyDuring = Number(entityC.querySelector("[data-diagram2-entity-body]")?.getAttribute("width") || 0);
    renderer.cancelGeometryPreview();
    const resizeCancelDiagnostics = renderer.diagnostics();
    const resizeBodyAfterCancel = Number(entityC.querySelector("[data-diagram2-entity-body]")?.getAttribute("width") || 0);
    const dirtyFlushAfterResizeCancel = Number(svg.dataset.diagram2DirtyFlushCount || 0);

    return {
      ready: true,
      previewStarted: startDiagnostics.geometryPreviewActive,
      pendingAfterFirstMove,
      transformMovedDuringPreview: transformBeforeMove !== transformDuringMove,
      previewPathCountDuringMove,
      movePreviewRelationshipCount: movePreviewDiagnostics.geometryPreviewRelationshipCount,
      movePreviewPatchedObjectCount: movePreviewDiagnostics.geometryPreviewPatchedObjectCount,
      movePreviewFrameDelta: movePreviewDiagnostics.geometryPreviewFrameCount - previewFrameBeforeMove,
      dirtyPreviewDelta: dirtyFlushDuringPreview - dirtyFlushAfterSelection,
      fullRenderAfterCommit,
      transformCommitted: transformAfterCommit !== transformBeforeMove,
      moveCommitDelta: moveCommitDiagnostics.geometryPreviewCommitCount - commitBeforeMove,
      moveUndoDelta: moveCommitDiagnostics.geometryPreviewUndoEntryCount - undoBeforeMove,
      moveDirtyFlushDelta: dirtyFlushAfterCommit - dirtyFlushAfterSelection,
      moveRoutedRelationshipCount: moveCommitDiagnostics.routedRelationshipCount,
      previewActiveAfterCommit: moveCommitDiagnostics.geometryPreviewActive,
      previewPathCountAfterCommit: document.querySelectorAll("[data-diagram2-relationship-preview-path]").length,
      entityAStableAfterCommit: entityA === document.querySelector(`[data-diagram2-object-id="${CSS.escape(entityAId)}"]`),
      entityATextStableAfterCommit: entityAText === entityA.querySelector("[data-diagram2-entity-title], text"),
      relationshipStableAfterCommit: relationship === document.querySelector(`[data-diagram2-relationship-id="${CSS.escape(relationshipId)}"]`),
      multiPreviewObjectIds: multiPreviewDiagnostics.geometryPreviewObjectIds,
      multiMovesBothObjects: transformABeforeMulti !== transformADuringMulti && transformBBeforeMulti !== transformBDuringMulti,
      multiCancelRestored: transformABeforeMulti === (entityA.getAttribute("transform") || "")
        && transformBBeforeMulti === (entityB.getAttribute("transform") || ""),
      multiCancelNoDirtyFlush: dirtyFlushAfterMultiCancel === dirtyFlushBeforeMulti,
      multiCancelNoUndo: multiCancelDiagnostics.geometryPreviewUndoEntryCount === undoBeforeMulti,
      resizeNodeStable: resizeNodeBefore === document.querySelector(`[data-diagram2-object-id="${CSS.escape(entityCId)}"]`),
      resizeWidthExpanded: resizeBodyDuring > resizeBodyBefore,
      resizeCancelRestored: resizeBodyAfterCancel === resizeBodyBefore,
      resizePreviewPatchedObjectCount: resizePreviewDiagnostics.geometryPreviewPatchedObjectCount,
      resizeCancelNoDirtyFlush: dirtyFlushAfterResizeCancel === dirtyFlushBeforeResize,
      resizeCancelNoUndo: resizeCancelDiagnostics.geometryPreviewUndoEntryCount === undoBeforeResize
    };
  });

  expect(result.ready).toBe(true);
  expect(result.previewStarted).toBe(true);
  expect(result.pendingAfterFirstMove).toBe(true);
  expect(result.transformMovedDuringPreview).toBe(true);
  expect(result.previewPathCountDuringMove).toBeGreaterThan(0);
  expect(result.movePreviewRelationshipCount).toBeGreaterThan(0);
  expect(result.movePreviewPatchedObjectCount).toBe(1);
  expect(result.movePreviewFrameDelta).toBeGreaterThanOrEqual(1);
  expect(result.dirtyPreviewDelta).toBe(0);
  expect(result.fullRenderAfterCommit).toBe(expectedFullRenderCount);
  expect(result.transformCommitted).toBe(true);
  expect(result.moveCommitDelta).toBe(1);
  expect(result.moveUndoDelta).toBe(1);
  expect(result.moveDirtyFlushDelta).toBe(1);
  expect(result.moveRoutedRelationshipCount).toBeGreaterThan(0);
  expect(result.previewActiveAfterCommit).toBe(false);
  expect(result.previewPathCountAfterCommit).toBe(0);
  expect(result.entityAStableAfterCommit).toBe(true);
  expect(result.entityATextStableAfterCommit).toBe(true);
  expect(result.relationshipStableAfterCommit).toBe(true);
  expect(result.multiPreviewObjectIds).toContain(",");
  expect(result.multiMovesBothObjects).toBe(true);
  expect(result.multiCancelRestored).toBe(true);
  expect(result.multiCancelNoDirtyFlush).toBe(true);
  expect(result.multiCancelNoUndo).toBe(true);
  expect(result.resizeNodeStable).toBe(true);
  expect(result.resizeWidthExpanded).toBe(true);
  expect(result.resizeCancelRestored).toBe(true);
  expect(result.resizePreviewPatchedObjectCount).toBe(1);
  expect(result.resizeCancelNoDirtyFlush).toBe(true);
  expect(result.resizeCancelNoUndo).toBe(true);
}

async function assertTransformOnlyPan(page, expectedFullRenderCount) {
  const canvas = page.locator("[data-diagram2-viewer-canvas]");
  const box = await canvas.boundingBox();
  const before = await diagram2StabilitySnapshot(page);
  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2));
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width / 2) + 80, box.y + (box.height / 2) + 42);
  await page.mouse.up();
  await waitForViewportReason(page, "pan");
  const afterFrame = await diagram2StabilitySnapshot(page);
  await waitForStableAnimationFrame(page);
  const afterSettle = await diagram2StabilitySnapshot(page);

  expect(afterFrame.svgStable).toBe(true);
  expect(afterFrame.entityStable).toBe(true);
  expect(afterFrame.textStable).toBe(true);
  expect(afterFrame.fullRenderCount).toBe(expectedFullRenderCount);
  expect(afterFrame.fullRendersDuringSettle).toBe(0);
  expect(afterFrame.routesRecalculatedDuringSettle).toBe(0);
  expect(afterFrame.translateX).not.toBe(before.translateX);
  expect(afterFrame.translateY).not.toBe(before.translateY);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).translation).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).size).toBeLessThanOrEqual(0.25);
}

async function assertCursorCenteredWheelZoom(page, expectedFullRenderCount) {
  const surface = page.locator("[data-diagram2-renderer-surface]");
  const box = await surface.boundingBox();
  const clientX = box.x + (box.width * 0.42);
  const clientY = box.y + (box.height * 0.37);
  const before = await diagram2StabilitySnapshot(page);
  await page.mouse.move(clientX, clientY);
  await page.mouse.wheel(0, -240);
  await waitForViewportReason(page, "wheel zoom");
  const afterFrame = await diagram2StabilitySnapshot(page);
  await waitForStableAnimationFrame(page);
  const afterSettle = await diagram2StabilitySnapshot(page);
  const cursor = parseDiagram2Point(afterFrame.cursorScreenPoint);
  const screenAfter = parseDiagram2Point(afterFrame.screenPointAfterSettle);

  expect(afterFrame.scale).toBeGreaterThan(before.scale);
  expect(afterFrame.svgStable).toBe(true);
  expect(afterFrame.entityStable).toBe(true);
  expect(afterFrame.textStable).toBe(true);
  expect(afterFrame.fullRenderCount).toBe(expectedFullRenderCount);
  expect(afterFrame.fullRendersDuringSettle).toBe(0);
  expect(afterFrame.routesRecalculatedDuringSettle).toBe(0);
  expect(Math.abs(cursor.x - screenAfter.x)).toBeLessThanOrEqual(0.25);
  expect(Math.abs(cursor.y - screenAfter.y)).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).translation).toBeLessThanOrEqual(0.25);
  expect(maxRectMovement(afterFrame.entityRect, afterSettle.entityRect).size).toBeLessThanOrEqual(0.25);
}

async function waitForViewportReason(page, reason) {
  await expect.poll(() =>
    page.evaluate(() => document.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportReason || "")
  ).toBe(reason);
}

async function diagram2ViewportScale(page) {
  return page.evaluate(() => Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportScale || 0));
}

async function diagram2FullRenderCount(page) {
  return page.evaluate(() => Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2FullRenderCount || 0));
}

async function diagram2StabilitySnapshot(page) {
  return page.evaluate(() => {
    const svg = document.querySelector("[data-diagram2-svg]");
    const entity = document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-type='entity']");
    const text = entity?.querySelector("text") || null;
    const rect = entity?.getBoundingClientRect();
    return {
      svgStable: svg === window.__diagram2StableSvg,
      entityStable: entity === window.__diagram2StableEntity,
      textStable: text === window.__diagram2StableText,
      entityRect: rect ? {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      } : null,
      scale: Number(svg?.dataset.diagram2ViewportScale || 0),
      translateX: Number(svg?.dataset.diagram2ViewportTranslateX || 0),
      translateY: Number(svg?.dataset.diagram2ViewportTranslateY || 0),
      fullRenderCount: Number(svg?.dataset.diagram2FullRenderCount || 0),
      fullRendersDuringSettle: Number(svg?.dataset.diagram2FullRendersDuringSettle || 0),
      routesRecalculatedDuringSettle: Number(svg?.dataset.diagram2RoutesRecalculatedDuringSettle || 0),
      nodeIdentityBeforeAfter: svg?.dataset.diagram2NodeIdentityBeforeAfter || "",
      cursorScreenPoint: svg?.dataset.diagram2CursorScreenPoint || "",
      screenPointAfterSettle: svg?.dataset.diagram2ScreenPointAfterSettle || ""
    };
  });
}

async function waitForStableAnimationFrame(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

function maxRectMovement(first, second) {
  if (!first || !second) return { translation: Number.POSITIVE_INFINITY, size: Number.POSITIVE_INFINITY };
  return {
    translation: Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y)),
    size: Math.max(Math.abs(first.width - second.width), Math.abs(first.height - second.height))
  };
}

function parseDiagram2Point(value) {
  const match = String(value || "").match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
  return {
    x: Number(match?.[1] || Number.NaN),
    y: Number(match?.[2] || Number.NaN)
  };
}

function testState() {
  return {
    users: [{
      id: 1,
      nickname: "Sin",
      email: "sin@example.test",
      role: "Admin",
      roleCode: "Admin",
      isAdmin: true,
      isActive: true,
      avatarUrl: ""
    }],
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Test", name: "Diagram 2 Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 42,
      title: "PMT Database Schema",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: pmtDatabaseSchemaBodyHtml()
    }, {
      id: 77,
      title: "Checkout Flow",
      isPrivate: true,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      createdAt: "2026-07-24T09:00:00Z",
      updatedAt: "2026-07-25T11:00:00Z",
      bodyHtml: diagramBodyHtml("Checkout Flow", "#22c55e")
    }],
    auditEvents: [],
    lookups: [{
      id: 1,
      lookupType: "Release Type",
      value: "Internal",
      displayOrder: 10,
      isActive: true
    }],
    roles: [{
      id: 1,
      lookupType: "Role",
      value: "Admin",
      code: "Admin",
      displayOrder: 10,
      isActive: true
    }],
    holidays: [],
    securityResources: [],
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: []
  };
}

function pmtDatabaseSchemaBodyHtml() {
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg?v=20260725-diagram2-day11-fixture" alt="PMT Database Schema"></p>`;
}

function diagramBodyHtml(title, stroke) {
  const state = normalizeAnnotationState({
    width: 640,
    height: 360,
    objects: [{
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-box`,
      type: "rectangle",
      x: 120,
      y: 96,
      width: 280,
      height: 120,
      fill: "#ffffff",
      stroke,
      strokeWidth: 3
    }, {
      id: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-label`,
      type: "textbox",
      x: 150,
      y: 132,
      width: 220,
      height: 58,
      text: title,
      fontSize: 24,
      textColor: "#172b4d"
    }]
  });
  const svg = buildAnnotationSvg(state);
  const source = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="${source}" alt="${title}"></p>`;
}

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
