import { expect, test } from "@playwright/test";
import {
  buildAnnotationSvg,
  normalizeAnnotationState,
  parseAnnotationSvg
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
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
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
  const diagramDocumentIds = await page.locator("[data-diagram-tree-row]").evaluateAll(rows =>
    rows.map(row => row.dataset.id).sort());

  await openNavigationScreen(page, "Diagram 2");
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-screen] h1")).toHaveText("Diagram 2");
  await expect(page.locator("[data-diagram2-header]")).toContainText("Diagram 2 Editor");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-file-format", "pmt-diagram");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-file-format-version", "1");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-selection-clipboard-format", "pmt-diagram-selection");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-selection-clipboard-version", "1");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-template-library-endpoint", "/api/image-annotation/template-library");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-default-template-library-endpoint", "/api/image-annotation/default-template-library");
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-persisted-renderer-caches", "false");
  await expect(page.locator("[data-diagram2-tree-row] [data-action='select-diagram2-document']")).toHaveCount(2);
  const diagram2DocumentIds = await page.locator("[data-diagram2-tree-row]").evaluateAll(rows =>
    rows.map(row => row.dataset.id).sort());
  expect(diagram2DocumentIds).toEqual(diagramDocumentIds);
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("PMT Database Schema");
  await expect(page.locator("[data-diagram2-edit-state]").first()).toHaveText("Saved");
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
  const compatibilitySummary = await page.evaluate(() => window.__pmtDiagram2Compatibility);
  expect(compatibilitySummary).toMatchObject({
    feature: "Diagram 2",
    fileFormat: "pmt-diagram",
    fileFormatVersion: 1,
    selectionClipboardFormat: "pmt-diagram-selection",
    selectionClipboardVersion: 1,
    endpoints: {
      templateLibrary: "/api/image-annotation/template-library",
      defaultTemplateLibrary: "/api/image-annotation/default-template-library"
    },
    persistedRendererCaches: false
  });
  expect(compatibilitySummary.fileObjectCount).toBeUndefined();
  expect(compatibilitySummary.selectionClipboardObjectCount).toBeUndefined();
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
  await assertDiagram2ViewportHaloVirtualization(page);
  await assertDiagram2LowDetailOverviewRendering(page);
  for (const zoom of ["0.1", "0.5", "0.75", "1", "1.25", "1.5", "2"]) {
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
  await expect(page.locator("[data-action='save-diagram2-document']")).toBeDisabled();
  await expect(page.locator(".diagram2-editor-toolbar [data-action='export-diagram2-pmt']")).toBeEnabled();
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

test("Diagram 2 direct URLs inherit Documentation read-only capabilities and block mutations", async ({ page }) => {
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await page.addInitScript(seenToken => {
    localStorage.clear();
    localStorage.setItem("pmt-release-notes-last-seen:1", seenToken);
    localStorage.setItem("pmt-release-notes-last-seen:2", seenToken);
  }, releaseNotes[0].seenToken);

  await page.route("**/api/session", route => route.fulfill(jsonResponse({ error: "Unauthorized" }, 401)));
  await page.route("**/api/login", route => route.fulfill(jsonResponse({
    userId: 2,
    nickname: "Reader",
    isAdmin: false,
    role: "Developer"
  })));
  await page.route("**/api/state", route => route.fulfill(jsonResponse(readOnlyState())));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));

  await page.goto("/");
  await page.locator("#loginName").fill("Reader");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/77";
  });
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("Public Read-Only Diagram");
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']")).toBeVisible();

  const before = await page.evaluate(() => ({
    x: Number(document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']")?.dataset.diagram2ObjectTransformX || 0),
    status: window.__pmtDiagram2EditorCore?.statusSnapshot?.()
  }));
  expect(before.status.security.resource).toBe("Documentation");
  expect(before.status.canEdit).toBe(false);
  expect(before.status.canSave).toBe(false);
  expect(before.status.canExport).toBe(true);
  await expect(page.locator("[data-action='save-diagram2-document']")).toBeDisabled();
  await expect(page.locator(".diagram2-editor-toolbar [data-action='export-diagram2-pmt']")).toBeEnabled();

  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Shift+ArrowRight");
  const programmaticMove = await page.evaluate(() =>
    window.__pmtDiagram2EditorCore.moveSelectedObjects(10, 0, { reason: "direct test" }));
  const after = await page.evaluate(() => ({
    x: Number(document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='public-read-only-diagram-box']")?.dataset.diagram2ObjectTransformX || 0),
    status: window.__pmtDiagram2EditorCore?.statusSnapshot?.()
  }));

  expect(programmaticMove).toBe(false);
  expect(after.x).toBe(before.x);
  expect(after.status.history.dirty).toBe(false);
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 saves the same backing document and roundtrips through Diagram 1", async ({ page }) => {
  const browserErrors = [];
  let apiState = roundtripState();
  let savedPayload = null;
  let uploadedSvg = "";

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
  await page.route("**/api/state", route => route.fulfill(jsonResponse(apiState)));
  await page.route("**/api/audit-trail", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/recycle-bin", route => route.fulfill(jsonResponse([])));
  await page.route("**/api/maintenance/orphan-files", route => route.fulfill(jsonResponse({
    files: [],
    totalCount: 0,
    totalByteLength: 0
  })));
  await page.route("**/api/uploads/richtext", route => {
    uploadedSvg = extractMultipartSvg(route.request().postDataBuffer());
    return route.fulfill(jsonResponse({ url: "/uploads/diagram2-roundtrip.svg" }));
  });
  await page.route("**/uploads/diagram2-roundtrip.svg", route => {
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: uploadedSvg || buildAnnotationSvg(normalizeAnnotationState({ width: 1, height: 1, objects: [] }))
    });
  });
  await page.route("**/api/blogs/88", route => {
    savedPayload = route.request().postDataJSON();
    apiState = {
      ...apiState,
      blogs: apiState.blogs.map(blog => blog.id === 88
        ? {
            ...blog,
            ...savedPayload,
            rowVersion: "row-2",
            updatedAt: "2026-07-25T13:00:00Z"
          }
        : blog)
    };
    return route.fulfill(jsonResponse(apiState.blogs.find(blog => blog.id === 88)));
  });

  await page.goto("/");
  await page.locator("#loginName").fill("Sin");
  await page.locator("#loginPassword").fill("Password1");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/88";
  });
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-viewer-host] h2")).toHaveText("Diagram 2 Roundtrip");
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")).toBeVisible();

  await page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']").click({ position: { x: 10, y: 10 } });
  await expect(page.locator("[data-diagram2-edit-state]").first()).toHaveText("1 selected");
  await expect(page.locator("[data-action='save-diagram2-document']")).toBeDisabled();

  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator("[data-diagram2-save-state]")).toHaveText("Unsaved changes");
  await expect(page.locator("[data-action='save-diagram2-document']")).toBeEnabled();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("[data-diagram2-save-state]")).toHaveText("Saved");
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator("[data-diagram2-save-state]")).toHaveText("Unsaved changes");

  await page.getByRole("button", { name: "Copy Selection" }).click();
  const clipboardText = await page.evaluate(() => window.__pmtDiagram2SelectionClipboard || "");
  expect(clipboardText).toMatch(/^PMT_DIAGRAM_SELECTION_V1\n/);
  expect(clipboardText).toContain("roundtrip-box");

  await page.getByRole("button", { name: "Save Diagram" }).click();
  await expect(page.locator("[data-diagram2-save-state]")).toHaveText("Saved");

  expect(savedPayload).toMatchObject({
    id: 88,
    title: "Diagram 2 Roundtrip",
    expectedRowVersion: "row-1"
  });
  expect(savedPayload.bodyHtml).toContain('data-pmt-diagram="true"');
  expect(savedPayload.bodyHtml).toContain("/uploads/diagram2-roundtrip.svg");
  expect(savedPayload.bodyHtml).not.toContain("data:image/svg+xml;base64,");
  expect(uploadedSvg).toContain("data-pmt-image-annotation-state");
  expect(uploadedSvg).not.toContain("diagram2LiveNodeId");
  expect(uploadedSvg).not.toContain("diagram2RendererCache");
  expect(uploadedSvg).not.toContain("diagram2-renderer-object");

  const savedState = parseAnnotationSvg(uploadedSvg);
  expect(savedState.objects.find(object => object.id === "roundtrip-box").x).toBe(130);
  expect(savedState.objects.find(object => object.id === "roundtrip-box").y).toBe(96);

  await page.evaluate(() => {
    window.location.hash = "#/diagram/88";
  });
  await expect(page.locator(".diagram-screen")).toBeVisible();
  await expect(page.locator("[data-diagram-readonly-viewer][data-id='88']")).toBeVisible();
  await expect(page.locator("[data-diagram-image]")).toBeVisible();
  await expect(page.locator(".diagram-page-document-head h2")).toHaveText("Diagram 2 Roundtrip");

  await page.evaluate(() => {
    window.location.hash = "#/diagram-2/88";
  });
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")).toBeVisible();
  const reopenedX = await page.evaluate(() => {
    const renderer = window.__pmtDiagram2Renderer;
    return renderer?.liveViewSnapshot?.().objectDataCount
      ? Number(document.querySelector("[data-diagram2-object-plane] [data-diagram2-object-id='roundtrip-box']")?.dataset.diagram2ObjectTransformX || 0)
      : 0;
  });
  expect(reopenedX).toBe(130);

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
    const objectPlane = document.querySelector("[data-diagram2-object-plane]");
    const entities = [...(objectPlane?.querySelectorAll("[data-diagram2-object-type='entity']") || [])];
    const relationship = document.querySelector("[data-diagram2-relationship-id]");
    const relatedEntity = relationship?.dataset.diagram2RelationshipSource
      ? objectPlane?.querySelector(`[data-diagram2-object-id="${CSS.escape(relationship.dataset.diagram2RelationshipSource)}"]`)
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
      entityAStable: entityA === objectPlane.querySelector(`[data-diagram2-object-id="${entityAId}"]`),
      entityBStable: entityB === objectPlane.querySelector(`[data-diagram2-object-id="${entityBId}"]`),
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
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260726-diagram2-day16-v1");
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

async function assertDiagram2ViewportHaloVirtualization(page) {
  const result = await page.evaluate(async () => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260726-diagram2-day16-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const waitForViewport = () => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    const state = buildDiagram2HaloState();
    const renderer = createDiagram2Renderer({ host });
    const initial = renderer.render(state, { reason: "halo initial" });
    renderer.setZoom("1");
    await waitForViewport();
    const focused = renderer.diagnostics();
    const focusedObjectCount = host.querySelectorAll("[data-diagram2-object-id]").length;
    const focusedRelationshipCount = host.querySelectorAll("[data-diagram2-relationship-id]").length;
    const routeOnlyMounted = [...host.querySelectorAll("[data-diagram2-relationship-id]")]
      .filter(node => {
        const source = node.dataset.diagram2RelationshipSource;
        const target = node.dataset.diagram2RelationshipTarget;
        return source
          && target
          && !host.querySelector(`[data-diagram2-object-id="${CSS.escape(source)}"]`)
          && !host.querySelector(`[data-diagram2-object-id="${CSS.escape(target)}"]`);
      }).length;
    const previousObjectCount = focusedObjectCount;
    const previousRelationshipCount = focusedRelationshipCount;
    renderer.panBy(-48, 0);
    await waitForViewport();
    const sameSector = renderer.diagnostics();
    const sameSectorObjectCount = host.querySelectorAll("[data-diagram2-object-id]").length;
    const sameSectorRelationshipCount = host.querySelectorAll("[data-diagram2-relationship-id]").length;

    renderer.setSelectedIds(["halo-offscreen-selected"]);
    await renderer.whenIdle();
    renderer.panBy(1, 0);
    await waitForViewport();
    const forced = renderer.diagnostics();
    const selectedMounted = Boolean(host.querySelector('[data-diagram2-object-id="halo-offscreen-selected"]'));
    const selectedRelationships = [...host.querySelectorAll("[data-diagram2-relationship-id]")]
      .filter(node => node.dataset.diagram2RelationshipSource === "halo-offscreen-selected"
        || node.dataset.diagram2RelationshipTarget === "halo-offscreen-selected").length;
    host.remove();

    return {
      initialCanonicalObjects: initial.canonicalObjectCount,
      initialMountedObjects: initial.mountedObjectCount,
      focusedActive: focused.viewportHaloActive,
      focusedFallback: focused.viewportHaloFallbackReason,
      focusedCanonicalObjects: focused.canonicalObjectCount,
      focusedCanonicalRelationships: focused.canonicalRelationshipCount,
      focusedMountedObjects: focused.mountedObjectCount,
      focusedMountedRelationships: focused.mountedRelationshipCount,
      focusedObjectCount,
      focusedRelationshipCount,
      focusedVirtualizedObjects: focused.viewportHaloVirtualizedObjectCount,
      focusedVirtualizedRelationships: focused.viewportHaloVirtualizedRelationshipCount,
      focusedRoutedRelationships: focused.viewportHaloRoutedRelationshipCount,
      focusedFullRendersDuringSettle: focused.fullRendersDuringSettle,
      routeOnlyMounted,
      routeOnlyDiagnostics: focused.viewportHaloRouteOnlyRelationshipCount,
      sameSectorNoop: sameSector.viewportHaloSameSectorNoop,
      sameSectorEnteringObjects: sameSector.viewportHaloEnteringObjectCount,
      sameSectorLeavingObjects: sameSector.viewportHaloLeavingObjectCount,
      sameSectorObjectPatchCount: sameSector.viewportHaloObjectPatchCount,
      sameSectorRelationshipPatchCount: sameSector.viewportHaloRelationshipPatchCount,
      sameSectorObjectCount,
      sameSectorRelationshipCount,
      previousObjectCount,
      previousRelationshipCount,
      selectedMounted,
      selectedRelationships,
      forcedObjectCount: forced.mountedObjectCount,
      forcedRelationshipCount: forced.mountedRelationshipCount,
      forcedObjectForceCount: forced.viewportHaloForceMountedObjectCount,
      forcedRelationshipForceCount: forced.viewportHaloForceMountedRelationshipCount
    };

    function buildDiagram2HaloState() {
      const objects = [{
        id: "halo-route-left",
        type: "entity",
        x: -3300,
        y: 220,
        width: 180,
        height: 100,
        entitySchema: "dbo",
        entityName: "HaloLeft",
        fields: [
          { name: "HaloLeftId", dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true },
          { name: "HaloRightId", dataType: "INT", nullable: true, isForeignKey: true }
        ],
        foreignKeys: [{
          name: "FK_HaloLeft_HaloRight",
          columns: ["HaloRightId"],
          referencedSchema: "dbo",
          referencedTable: "HaloRight",
          referencedColumns: ["HaloRightId"],
          relationshipType: "many-to-one",
          routeOverride: [
            { x: -3120, y: 272 },
            { x: -128, y: 272 },
            { x: 3200, y: 272 },
            { x: 5200, y: 272 }
          ]
        }]
      }, {
        id: "halo-route-right",
        type: "entity",
        x: 5200,
        y: 220,
        width: 180,
        height: 100,
        entitySchema: "dbo",
        entityName: "HaloRight",
        fields: [
          { name: "HaloRightId", dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true }
        ],
        foreignKeys: []
      }, {
        id: "halo-offscreen-selected",
        type: "entity",
        x: 9000,
        y: 520,
        width: 180,
        height: 100,
        entitySchema: "dbo",
        entityName: "OffscreenSelected",
        fields: [
          { name: "OffscreenSelectedId", dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true },
          { name: "HaloRightId", dataType: "INT", nullable: true, isForeignKey: true }
        ],
        foreignKeys: [{
          name: "FK_OffscreenSelected_HaloRight",
          columns: ["HaloRightId"],
          referencedSchema: "dbo",
          referencedTable: "HaloRight",
          referencedColumns: ["HaloRightId"],
          relationshipType: "many-to-one"
        }]
      }];

      for (let index = 0; index < 217; index += 1) {
        const name = `Halo${index}`;
        objects.push({
          id: `halo-entity-${index}`,
          type: "entity",
          x: -9800 + (index * 96),
          y: 760 + ((index % 4) * 150),
          width: 84,
          height: 96,
          entitySchema: "dbo",
          entityName: name,
          fields: [
            { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isImportant: true }
          ],
          foreignKeys: []
        });
      }

      return {
        width: 19200,
        height: 1600,
        manualEntityRelationshipRoutes: true,
        objects
      };
    }
  });

  expect(result.initialCanonicalObjects).toBe(220);
  expect(result.initialMountedObjects).toBe(220);
  expect(result.focusedActive).toBe(true);
  expect(result.focusedFallback).toBe("");
  expect(result.focusedCanonicalObjects).toBe(220);
  expect(result.focusedCanonicalRelationships).toBe(2);
  expect(result.focusedMountedObjects).toBeLessThan(110);
  expect(result.focusedMountedRelationships).toBeLessThanOrEqual(2);
  expect(result.focusedObjectCount).toBe(result.focusedMountedObjects);
  expect(result.focusedRelationshipCount).toBe(result.focusedMountedRelationships);
  expect(result.focusedVirtualizedObjects).toBeGreaterThan(110);
  expect(result.focusedVirtualizedRelationships).toBeGreaterThanOrEqual(0);
  expect(result.focusedRoutedRelationships).toBe(0);
  expect(result.focusedFullRendersDuringSettle).toBe(0);
  expect(result.routeOnlyMounted).toBeGreaterThan(0);
  expect(result.routeOnlyDiagnostics).toBeGreaterThan(0);
  expect(result.sameSectorNoop).toBe(true);
  expect(result.sameSectorEnteringObjects).toBe(0);
  expect(result.sameSectorLeavingObjects).toBe(0);
  expect(result.sameSectorObjectPatchCount).toBe(0);
  expect(result.sameSectorRelationshipPatchCount).toBe(0);
  expect(result.sameSectorObjectCount).toBe(result.previousObjectCount);
  expect(result.sameSectorRelationshipCount).toBe(result.previousRelationshipCount);
  expect(result.selectedMounted).toBe(true);
  expect(result.selectedRelationships).toBeGreaterThan(0);
  expect(result.forcedObjectCount).toBeGreaterThan(result.sameSectorObjectCount);
  expect(result.forcedRelationshipCount).toBeGreaterThanOrEqual(result.sameSectorRelationshipCount);
  expect(result.forcedObjectForceCount).toBeGreaterThan(0);
  expect(result.forcedRelationshipForceCount).toBeGreaterThan(0);
}

async function assertDiagram2LowDetailOverviewRendering(page) {
  const result = await page.evaluate(async () => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260726-diagram2-day16-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const waitForViewport = () => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    const state = buildDiagram2OverviewState();
    const renderer = createDiagram2Renderer({ host });
    const initial = renderer.render(state, { reason: "overview initial" });
    const initialDescendantCount = renderer.svgNode().querySelectorAll("*").length;
    const initialFieldTextCount = host.querySelectorAll("[data-diagram2-entity-field]").length;
    const initialRelationshipPath = host.querySelector("[data-diagram2-relationship-path]")?.getAttribute("d") || "";

    renderer.setZoom("0.1");
    await waitForViewport();
    const low = renderer.diagnostics();
    const lowDescendantCount = renderer.svgNode().querySelectorAll("*").length;
    const lowFieldTextCount = host.querySelectorAll("[data-diagram2-entity-field]").length;
    const lowTitleCount = host.querySelectorAll("[data-diagram2-entity-title]").length;
    const lowCompactKeyCount = host.querySelectorAll("[data-diagram2-entity-compact-key]").length;
    const lowRelationshipPaths = [...host.querySelectorAll("[data-diagram2-relationship-path]")]
      .map(path => path.getAttribute("d") || "");
    const lowRelationshipMaxCommandCount = Math.max(
      0,
      ...lowRelationshipPaths.map(path => (path.match(/[ML]/g) || []).length)
    );

    renderer.panBy(-120, 0);
    await waitForViewport();
    const lowPan = renderer.diagnostics();

    renderer.setZoom("0.18");
    await waitForViewport();
    const nearThreshold = renderer.diagnostics();

    renderer.setZoom("1");
    await waitForViewport();
    const detailed = renderer.diagnostics();
    const restoredFieldTextCount = host.querySelectorAll("[data-diagram2-entity-field]").length;
    const restoredDescendantCount = renderer.svgNode().querySelectorAll("*").length;
    const restoredRelationshipPath = host.querySelector("[data-diagram2-relationship-path]")?.getAttribute("d") || "";
    host.remove();

    return {
      initialCanonicalObjects: initial.canonicalObjectCount,
      initialCanonicalRelationships: initial.canonicalRelationshipCount,
      initialDetailLevel: initial.overviewDetailLevel,
      initialDescendantCount,
      initialFieldTextCount,
      initialRelationshipCommandCount: (initialRelationshipPath.match(/[ML]/g) || []).length,
      lowDetailLevel: low.overviewDetailLevel,
      lowChanged: low.overviewDetailChanged,
      lowProjectedRows: low.overviewDetailProjectedRowPixels,
      lowObjectPatches: low.overviewDetailObjectPatchCount,
      lowRelationshipPatches: low.overviewDetailRelationshipPatchCount,
      lowDescendantCount,
      lowFieldTextCount,
      lowTitleCount,
      lowCompactKeyCount,
      lowMountedObjects: low.mountedObjectCount,
      lowMountedRelationships: low.mountedRelationshipCount,
      lowRelationshipPathCount: lowRelationshipPaths.length,
      lowRelationshipMaxCommandCount,
      lowFullRendersDuringSettle: low.fullRendersDuringSettle,
      lowPanFullRendersDuringSettle: lowPan.fullRendersDuringSettle,
      lowPanDetailLevel: lowPan.overviewDetailLevel,
      nearThresholdLevel: nearThreshold.overviewDetailLevel,
      nearThresholdChanged: nearThreshold.overviewDetailChanged,
      nearThresholdProjectedRows: nearThreshold.overviewDetailProjectedRowPixels,
      detailedLevel: detailed.overviewDetailLevel,
      detailedChanged: detailed.overviewDetailChanged,
      detailedProjectedRows: detailed.overviewDetailProjectedRowPixels,
      restoredFieldTextCount,
      restoredDescendantCount,
      restoredRelationshipCommandCount: (restoredRelationshipPath.match(/[ML]/g) || []).length,
      finalCanonicalObjects: detailed.canonicalObjectCount,
      finalCanonicalRelationships: detailed.canonicalRelationshipCount,
      finalFullRendersDuringSettle: detailed.fullRendersDuringSettle
    };

    function buildDiagram2OverviewState() {
      const entityCount = 224;
      const relationshipCount = 448;
      const columns = 28;
      const objects = Array.from({ length: entityCount }, (_, index) => {
        const name = `Overview${index}`;
        return {
          id: `overview-entity-${index}`,
          type: "entity",
          x: (index % columns) * 260,
          y: Math.floor(index / columns) * 190,
          width: 220,
          height: 160,
          entitySchema: "dbo",
          entityName: name,
          fields: [
            { name: `${name}Id`, dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false, isImportant: true },
            { name: "Ref0Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref1Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref2Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Ref3Id", dataType: "INT", nullable: true, isPrimaryKey: false, isForeignKey: true },
            { name: "Name", dataType: "NVARCHAR(240)", nullable: false },
            { name: "CreatedAt", dataType: "DATETIME2", nullable: false },
            { name: "UpdatedAt", dataType: "DATETIME2", nullable: false }
          ],
          foreignKeys: []
        };
      });

      for (let index = 0; index < relationshipCount; index += 1) {
        const sourceIndex = (index % (entityCount - 1)) + 1;
        let targetIndex = (sourceIndex + 11 + (index * 13)) % entityCount;
        if (targetIndex === sourceIndex) targetIndex = (targetIndex + 1) % entityCount;
        const targetName = `Overview${targetIndex}`;
        objects[sourceIndex].foreignKeys.push({
          name: `FK_Overview_${index}`,
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

  expect(result.initialCanonicalObjects).toBe(224);
  expect(result.initialCanonicalRelationships).toBe(448);
  expect(result.initialDetailLevel).toBe("detailed");
  expect(result.initialFieldTextCount).toBeGreaterThan(1000);
  expect(result.lowDetailLevel).toBe("low");
  expect(result.lowChanged).toBe(true);
  expect(result.lowProjectedRows).toBeLessThan(4);
  expect(result.lowObjectPatches).toBeGreaterThan(0);
  expect(result.lowRelationshipPatches).toBeGreaterThan(0);
  expect(result.lowDescendantCount).toBeLessThan(result.initialDescendantCount * 0.65);
  expect(result.lowFieldTextCount).toBe(0);
  expect(result.lowTitleCount).toBe(result.lowMountedObjects);
  expect(result.lowCompactKeyCount).toBe(result.lowMountedObjects);
  expect(result.lowRelationshipPathCount).toBe(result.lowMountedRelationships);
  expect(result.lowRelationshipMaxCommandCount).toBeLessThanOrEqual(2);
  expect(result.lowFullRendersDuringSettle).toBe(0);
  expect(result.lowPanFullRendersDuringSettle).toBe(0);
  expect(result.lowPanDetailLevel).toBe("low");
  expect(result.nearThresholdLevel).toBe("low");
  expect(result.nearThresholdChanged).toBe(false);
  expect(result.nearThresholdProjectedRows).toBeGreaterThan(4);
  expect(result.detailedLevel).toBe("detailed");
  expect(result.detailedChanged).toBe(true);
  expect(result.detailedProjectedRows).toBeGreaterThan(6);
  expect(result.restoredFieldTextCount).toBeGreaterThan(0);
  expect(result.restoredDescendantCount).toBeGreaterThan(result.lowDescendantCount);
  expect(result.restoredRelationshipCommandCount).toBeGreaterThan(result.lowRelationshipMaxCommandCount);
  expect(result.finalCanonicalObjects).toBe(224);
  expect(result.finalCanonicalRelationships).toBe(448);
  expect(result.finalFullRendersDuringSettle).toBe(0);
}

async function assertDiagram2LiveGeometryPreview(page, expectedFullRenderCount) {
  const result = await page.evaluate(async () => {
    const renderer = window.__pmtDiagram2Renderer;
    const svg = document.querySelector("[data-diagram2-svg]");
    const objectPlane = document.querySelector("[data-diagram2-object-plane]");
    const entities = [...(objectPlane?.querySelectorAll("[data-diagram2-object-type='entity']") || [])];
    const relationship = [...document.querySelectorAll("[data-diagram2-relationship-id]")]
      .find(candidate => candidate.dataset.diagram2RelationshipSource
        && objectPlane?.querySelector(`[data-diagram2-object-id="${CSS.escape(candidate.dataset.diagram2RelationshipSource)}"]`));
    const entityA = relationship?.dataset.diagram2RelationshipSource
      ? objectPlane?.querySelector(`[data-diagram2-object-id="${CSS.escape(relationship.dataset.diagram2RelationshipSource)}"]`)
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
      entityAStableAfterCommit: entityA === objectPlane.querySelector(`[data-diagram2-object-id="${CSS.escape(entityAId)}"]`),
      entityATextStableAfterCommit: entityAText === entityA.querySelector("[data-diagram2-entity-title], text"),
      relationshipStableAfterCommit: relationship === document.querySelector(`[data-diagram2-relationship-id="${CSS.escape(relationshipId)}"]`),
      multiPreviewObjectIds: multiPreviewDiagnostics.geometryPreviewObjectIds,
      multiMovesBothObjects: transformABeforeMulti !== transformADuringMulti && transformBBeforeMulti !== transformBDuringMulti,
      multiCancelRestored: transformABeforeMulti === (entityA.getAttribute("transform") || "")
        && transformBBeforeMulti === (entityB.getAttribute("transform") || ""),
      multiCancelNoDirtyFlush: dirtyFlushAfterMultiCancel === dirtyFlushBeforeMulti,
      multiCancelNoUndo: multiCancelDiagnostics.geometryPreviewUndoEntryCount === undoBeforeMulti,
      resizeNodeStable: resizeNodeBefore === objectPlane.querySelector(`[data-diagram2-object-id="${CSS.escape(entityCId)}"]`),
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
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg?v=20260725-diagram2-day14-fixture" alt="PMT Database Schema"></p>`;
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

function roundtripState() {
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
      id: 88,
      title: "Diagram 2 Roundtrip",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      rowVersion: "row-1",
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: diagramBodyHtml("Roundtrip", "#2563eb")
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

function readOnlyState() {
  return {
    users: [{
      id: 2,
      nickname: "Reader",
      email: "reader@example.test",
      role: "Developer",
      roleCode: "Developer",
      isAdmin: false,
      isActive: true,
      avatarUrl: ""
    }],
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Test", name: "Diagram 2 Test", isActive: true }],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [{
      id: 77,
      title: "Public Read-Only Diagram",
      isPrivate: false,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      rowVersion: "row-public",
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: diagramBodyHtml("Public Read-Only Diagram", "#64748b")
    }, {
      id: 78,
      title: "Hidden Private Diagram",
      isPrivate: true,
      createdByUserId: 1,
      updatedByUserId: 1,
      projectId: 1,
      sprintId: null,
      rowVersion: "row-private",
      createdAt: "2026-07-24T10:00:00Z",
      updatedAt: "2026-07-25T12:00:00Z",
      bodyHtml: diagramBodyHtml("Hidden Private Diagram", "#ef4444")
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
      value: "Developer",
      code: "Developer",
      displayOrder: 10,
      isActive: true
    }],
    holidays: [],
    securityResources: [],
    rolePermissions: [],
    userPermissions: [],
    effectivePermissions: [{
      resourceKey: "Dashboard",
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: false,
      noAccess: false
    }, {
      resourceKey: "Documentation",
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: true,
      noAccess: false
    }]
  };
}

function extractMultipartSvg(buffer) {
  const text = (buffer || Buffer.alloc(0)).toString("utf8");
  const start = text.indexOf("<svg");
  const end = text.lastIndexOf("</svg>");
  return start >= 0 && end >= start ? text.slice(start, end + "</svg>".length) : "";
}

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
