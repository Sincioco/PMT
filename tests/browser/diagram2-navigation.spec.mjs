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
  return `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg?v=20260725-diagram2-day9-fixture" alt="PMT Database Schema"></p>`;
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
