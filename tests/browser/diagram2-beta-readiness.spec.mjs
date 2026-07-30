import { expect, test } from "@playwright/test";
import { releaseNotes } from "../../wwwroot/js/shared/release-notes-data.js";

test.use({ timezoneId: "Asia/Taipei" });

test("Diagram 2 beta shell preserves navigation, zoom matrix, and open-close cleanup", async ({ page }) => {
  test.setTimeout(120000);
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await signInWithDiagramState(page);

  const navigationLabels = await page.evaluate(() =>
    [...document.querySelectorAll("#nav button[data-view]")].map(button => ({
      view: button.dataset.view,
      label: button.querySelector("span:last-child")?.textContent?.trim() || ""
    }))
  );
  expect(navigationLabels).toContainEqual({ view: "Diagram", label: "Diagram" });
  expect(navigationLabels).toContainEqual({ view: "Diagram 2", label: "Diagram 2" });
  await openNavigationScreen(page, "Diagram 2");
  await expect(page).toHaveURL(/#\/diagram-2$/);
  await expect(page.locator("[data-diagram2-screen] h1")).toHaveText("Diagram 2");
  await expect(page.locator("[data-diagram2-page-document-head]")).toBeVisible();
  await expect(page.locator(".diagram-screen[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator(".diagram-screen:not([data-diagram2-screen])")).toHaveCount(0);
  await expect(page.locator("[data-filter='diagram2-zoom'] option")).toHaveText(
    Array.from({ length: 59 }, (_, index) => `${10 + (index * 5)}%`)
  );

  await page.locator("[data-filter='diagram2-zoom']").selectOption("0.1");
  await expect.poll(() => diagram2ViewportScale(page)).toBe(0.1);

  const descendantCounts = [];
  for (let index = 0; index < 10; index += 1) {
    const openSnapshot = await waitForDiagram2Ready(page);
    descendantCounts.push(openSnapshot.descendantCount);
    expect(openSnapshot.rendererLive).toBe(true);
    expect(openSnapshot.compatibilityFeature).toBe("Diagram 2");

    await openNavigationScreen(page, "Diagram");
    await expect(page).toHaveURL(/#\/diagram$/);
    await expect(page.locator(".diagram-screen")).toBeVisible();
    const closeSnapshot = await page.evaluate(() => ({
      rendererLive: window.__pmtDiagram2Renderer !== null,
      compatibilityLive: window.__pmtDiagram2Compatibility !== null,
      selectionClipboardLive: window.__pmtDiagram2SelectionClipboard !== null,
      diagram2ScreenCount: document.querySelectorAll("[data-diagram2-screen]").length,
      diagram2SvgCount: document.querySelectorAll("[data-diagram2-svg]").length
    }));
    expect(closeSnapshot).toEqual({
      rendererLive: false,
      compatibilityLive: false,
      selectionClipboardLive: false,
      diagram2ScreenCount: 0,
      diagram2SvgCount: 0
    });

    if (index < 9) await openNavigationScreen(page, "Diagram 2");
  }

  expect(Math.min(...descendantCounts)).toBeGreaterThan(0);
  expect(Math.max(...descendantCounts) - Math.min(...descendantCounts)).toBeLessThanOrEqual(5);
  expect(browserErrors).toEqual([]);
});

test("Diagram 2 renderer destroys pending 232-entity stress work without stale live maps", async ({ page }) => {
  await page.goto("/css/base.css");
  const result = await page.evaluate(async state => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260730-diagram2-phase6-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-12000px";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.appendChild(host);

    const renderer = createDiagram2Renderer({ host });
    const initial = renderer.render(state, { reason: "beta readiness stress initial" });
    renderer.setZoom("0.1");
    renderer.panBy(-240, -120);
    renderer.setSelectedIds(["entity-7", "entity-8"]);
    renderer.beginGeometryPreview({ objectId: "entity-7", mode: "move" });
    renderer.previewGeometry({ deltaX: 36, deltaY: 22 });
    renderer.updateObject("entity-9", object => ({
      x: Number(object.x || 0) + 18,
      y: Number(object.y || 0) + 12
    }));
    const beforeDestroy = {
      diagnostics: renderer.diagnostics(),
      snapshot: renderer.liveViewSnapshot(),
      descendantCount: host.querySelectorAll("*").length
    };
    const idle = renderer.whenIdle();
    renderer.destroy();
    const idleAfterDestroy = await idle;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const afterDestroy = {
      diagnostics: renderer.diagnostics(),
      snapshot: renderer.liveViewSnapshot(),
      descendantCount: host.querySelectorAll("*").length,
      idleAfterDestroy
    };
    host.remove();
    return { initial, beforeDestroy, afterDestroy };
  }, buildDiagram2StressState());

  expect(result.initial.canonicalObjectCount).toBe(232);
  expect(result.initial.canonicalRelationshipCount).toBe(624);
  expect(result.beforeDestroy.descendantCount).toBeGreaterThan(0);
  expect(result.beforeDestroy.snapshot.objectNodeCount).toBeGreaterThan(0);
  expect(result.beforeDestroy.snapshot.relationshipNodeCount).toBeGreaterThan(0);
  expect(result.beforeDestroy.snapshot.pendingDiagramFlush).toBe(true);
  expect(result.afterDestroy.descendantCount).toBe(0);
  expect(result.afterDestroy.snapshot.objectNodeCount).toBe(0);
  expect(result.afterDestroy.snapshot.relationshipNodeCount).toBe(0);
  expect(result.afterDestroy.snapshot.relationshipBoundsIndexCount).toBe(0);
  expect(result.afterDestroy.snapshot.relationshipRouteSectorCount).toBe(0);
  expect(result.afterDestroy.snapshot.viewportHaloObjectSectorCount).toBe(0);
  expect(result.afterDestroy.snapshot.viewportHaloRelationshipSectorCount).toBe(0);
  expect(result.afterDestroy.snapshot.pendingDiagramFlush).toBe(false);
  expect(result.afterDestroy.snapshot.transactionDepth).toBe(0);
  expect(result.afterDestroy.diagnostics.canonicalObjectCount).toBe(0);
  expect(result.afterDestroy.diagnostics.canonicalRelationshipCount).toBe(0);
  expect(result.afterDestroy.idleAfterDestroy.canonicalObjectCount).toBe(0);
});

test("Diagram 2 Phase 3 stays incremental within 232-entity performance budgets", async ({ page }) => {
  await page.goto("/css/base.css");
  const result = await page.evaluate(async state => {
    const { createDiagram2Renderer } = await import("/js/features/diagram2/diagram2-renderer.js?v=20260730-diagram2-phase6-v1");
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "1200px";
    host.style.height = "800px";
    document.body.replaceChildren(host);

    const renderer = createDiagram2Renderer({ host });
    const initialStartedAt = performance.now();
    const initial = renderer.render(state, { reason: "phase 3 performance initial" });
    const initialMs = performance.now() - initialStartedAt;
    renderer.setZoom("1.25");
    await waitForViewport();
    const focused = renderer.diagnostics();
    const initialFullRenderCount = focused.fullRenderCount;
    const unrelatedNode = host.querySelector("[data-diagram2-object-id='entity-0']");
    const selectionDurations = [];
    const marqueeDurations = [];
    const dragStartDurations = [];
    const resizeStartDurations = [];

    for (let index = 0; index < 12; index += 1) {
      const selectionStartedAt = performance.now();
      renderer.setSelectedIds([index % 2 === 0 ? "core-rectangle" : "core-rich-text"]);
      await renderer.whenIdle();
      selectionDurations.push(performance.now() - selectionStartedAt);

      const marqueeStartedAt = performance.now();
      renderer.objectIdsInBounds({ x: 30, y: 30, width: 760, height: 520 });
      marqueeDurations.push(performance.now() - marqueeStartedAt);

      const dragStartedAt = performance.now();
      renderer.beginGeometryPreview({ objectId: "core-rectangle", mode: "move" });
      dragStartDurations.push(performance.now() - dragStartedAt);
      renderer.cancelGeometryPreview();

      const resizeStartedAt = performance.now();
      renderer.beginGeometryPreview({ objectId: "core-rectangle", mode: "resize" });
      resizeStartDurations.push(performance.now() - resizeStartedAt);
      renderer.cancelGeometryPreview();
    }

    const beforeStyle = renderer.diagnostics();
    const styleStartedAt = performance.now();
    renderer.updateObject("core-rectangle", object => ({
      ...object,
      fill: object.fill === "#d9ecff" ? "#fff4cc" : "#d9ecff"
    }));
    const afterStyle = await renderer.whenIdle();
    const styleMs = performance.now() - styleStartedAt;
    const finalNode = host.querySelector("[data-diagram2-object-id='entity-0']");
    const final = renderer.diagnostics();
    const metrics = {
      initialMs: roundMetric(initialMs),
      selectionMedianMs: roundMetric(percentile(selectionDurations, 50)),
      selectionP95Ms: roundMetric(percentile(selectionDurations, 95)),
      marqueeMedianMs: roundMetric(percentile(marqueeDurations, 50)),
      marqueeP95Ms: roundMetric(percentile(marqueeDurations, 95)),
      dragStartMedianMs: roundMetric(percentile(dragStartDurations, 50)),
      dragStartP95Ms: roundMetric(percentile(dragStartDurations, 95)),
      resizeStartMedianMs: roundMetric(percentile(resizeStartDurations, 50)),
      resizeStartP95Ms: roundMetric(percentile(resizeStartDurations, 95)),
      styleMs: roundMetric(styleMs)
    };
    const snapshot = {
      initialFullRenderCount,
      finalFullRenderCount: final.fullRenderCount,
      canonicalObjectCount: final.canonicalObjectCount,
      canonicalRelationshipCount: final.canonicalRelationshipCount,
      mountedObjectCount: final.mountedObjectCount,
      mountedRelationshipCount: final.mountedRelationshipCount,
      svgDescendantCount: final.svgDescendantCount,
      styleDirtyFlushDelta: afterStyle.dirtyFlushCount - beforeStyle.dirtyFlushCount,
      stylePatchedObjectCount: afterStyle.objectsPatchedInLastFlush,
      styleRoutedRelationshipCount: afterStyle.relationshipsRoutedInLastFlush,
      styleRelationshipsConsidered: afterStyle.selectiveRoutingRelationshipsConsidered,
      unrelatedNodePreserved: Boolean(unrelatedNode && unrelatedNode === finalNode),
      pendingDiagramFlush: final.pendingDiagramFlush
    };
    renderer.destroy();
    host.remove();
    return { metrics, snapshot };

    function waitForViewport() {
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function percentile(values, percentileValue) {
      const sorted = [...values].sort((left, right) => left - right);
      const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
      return sorted[Math.max(0, index)];
    }

    function roundMetric(value) {
      return Math.round(Math.max(0, Number(value) || 0) * 100) / 100;
    }
  }, buildDiagram2StressState({ includeCoreObjects: true }));

  console.log(`DIAGRAM2_PHASE3_PERFORMANCE ${JSON.stringify(result)}`);
  expect(result.metrics.initialMs).toBeLessThan(500);
  expect(result.metrics.selectionP95Ms).toBeLessThan(100);
  expect(result.metrics.dragStartP95Ms).toBeLessThan(150);
  expect(result.metrics.resizeStartP95Ms).toBeLessThan(150);
  expect(result.snapshot.initialFullRenderCount).toBe(1);
  expect(result.snapshot.finalFullRenderCount).toBe(result.snapshot.initialFullRenderCount);
  expect(result.snapshot.canonicalObjectCount).toBe(238);
  expect(result.snapshot.canonicalRelationshipCount).toBe(624);
  expect(result.snapshot.mountedObjectCount).toBeGreaterThan(0);
  expect(result.snapshot.mountedObjectCount).toBeLessThan(result.snapshot.canonicalObjectCount);
  expect(result.snapshot.styleDirtyFlushDelta).toBe(1);
  expect(result.snapshot.stylePatchedObjectCount).toBe(1);
  expect(result.snapshot.styleRoutedRelationshipCount).toBe(0);
  expect(result.snapshot.styleRelationshipsConsidered).toBe(0);
  expect(result.snapshot.unrelatedNodePreserved).toBe(true);
  expect(result.snapshot.pendingDiagramFlush).toBe(false);
});

test("Diagram 2 alternates top-navigation and RTE hosts without stale lifecycle artifacts", async ({ page }) => {
  test.setTimeout(120000);
  const browserErrors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("status of 401")) browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));

  await installDiagram2LifecycleInstrumentation(page);
  await page.route("**/uploads/original.svg*", route => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#ffffff"/></svg>`
  }));
  await signInWithDiagramState(page);
  await openNavigationScreen(page, "Diagram");
  await ensureDiagram2RteFixture(page);

  await openNavigationScreen(page, "Diagram 2");
  await waitForDiagram2Ready(page);
  await page.getByRole("button", { name: "Edit Diagram" }).click();
  await expect(page.locator("[data-diagram2-editor-shell]")).toBeVisible();
  await page.locator("[data-action='cancel-diagram2-editor']").click();
  await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
  await openNavigationScreen(page, "Diagram");
  await expect(page.locator("[data-diagram2-screen]")).toHaveCount(0);
  expectDiagram2NoLiveArtifacts(await diagram2LifecycleSnapshot(page));

  await openDiagram2RteCycle(page, -1);
  await expect(page.locator("[data-diagram2-rte-host]")).toBeVisible();
  await page.locator("[data-diagram2-rte-host]").getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => window.__diagram2AlternatingRtePromise);
  expectDiagram2NoLiveArtifacts(await diagram2LifecycleSnapshot(page));

  const baseline = await diagram2LifecycleSnapshot(page);

  for (let index = 0; index < 5; index += 1) {
    await openNavigationScreen(page, "Diagram 2");
    await waitForDiagram2Ready(page);
    await page.getByRole("button", { name: "Edit Diagram" }).click();
    await expect(page.locator("[data-diagram2-editor-shell]")).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(window.__pmtDiagram2EditorCore))).toBe(true);
    await page.locator("[data-action='cancel-diagram2-editor']").click();
    await expect(page.locator("[data-diagram2-screen]")).toHaveAttribute("data-diagram2-mode", "readonly");
    await openNavigationScreen(page, "Diagram");
    await expect(page.locator("[data-diagram2-screen]")).toHaveCount(0);
    expectDiagram2ClosedSnapshot(await diagram2LifecycleSnapshot(page), baseline);

    await openDiagram2RteCycle(page, index);
    await expect(page.locator("[data-diagram2-rte-host]")).toBeVisible();
    await page.locator("[data-diagram2-rte-host]").getByRole("button", { name: "Cancel", exact: true }).click();
    await page.evaluate(() => window.__diagram2AlternatingRtePromise);
    expectDiagram2ClosedSnapshot(await diagram2LifecycleSnapshot(page), baseline);
  }

  expect(browserErrors).toEqual([]);
});

function buildDiagram2StressState(options = {}) {
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

  if (options.includeCoreObjects) {
    objects.push(
      {
        id: "core-rectangle",
        type: "rectangle",
        x: 40,
        y: 40,
        width: 210,
        height: 120,
        fill: "#fff4cc",
        stroke: "#8a6d1d",
        strokeWidth: 3,
        opacity: 1
      },
      {
        id: "core-circle",
        type: "circle",
        x: 300,
        y: 40,
        width: 140,
        height: 140,
        fill: "#d9ecff",
        stroke: "#245a86",
        strokeWidth: 3,
        opacity: 1
      },
      {
        id: "core-arrow",
        type: "arrow",
        x1: 500,
        y1: 80,
        x2: 700,
        y2: 150,
        stroke: "#245a86",
        strokeWidth: 4,
        arrowSize: 20,
        opacity: 1
      },
      {
        id: "core-line",
        type: "line",
        x1: 500,
        y1: 220,
        x2: 700,
        y2: 290,
        stroke: "#8a6d1d",
        strokeWidth: 4,
        opacity: 1
      },
      {
        id: "core-textbox",
        type: "textbox",
        x: 40,
        y: 240,
        width: 260,
        height: 110,
        text: "Core text",
        fill: "#ffffff",
        stroke: "#245a86",
        strokeWidth: 2,
        textColor: "#172b4d",
        fontFamily: "Arial",
        fontSize: 24,
        opacity: 1
      },
      {
        id: "core-rich-text",
        type: "rich-text",
        x: 340,
        y: 340,
        width: 420,
        height: 180,
        html: "<p><strong>Core rich text</strong></p><p>Phase 3 performance fixture.</p>",
        fill: "#ffffff",
        stroke: "#8a6d1d",
        strokeWidth: 2,
        opacity: 1
      }
    );
  }

  return {
    width: columns * 260,
    height: 8 * 190,
    objects
  };
}

async function signInWithDiagramState(page) {
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
}

async function openNavigationScreen(page, view) {
  const primaryButton = page.locator(`#nav > button.nav-item[data-view='${view}']`);
  if (await primaryButton.isVisible().catch(() => false)) {
    await primaryButton.click();
    return;
  }

  await page.locator(".nav-overflow-toggle").click();
  await page.locator(`.nav-overflow-menu button[data-view='${view}']`).click();
}

async function waitForDiagram2Ready(page) {
  await expect(page.locator("[data-diagram2-screen]")).toBeVisible();
  await expect(page.locator("[data-diagram2-svg]")).toBeVisible();
  await page.evaluate(() => window.__pmtDiagram2Renderer?.whenIdle?.());
  return page.evaluate(() => ({
    descendantCount: document.querySelector("[data-diagram2-svg]")?.querySelectorAll("*").length || 0,
    rendererLive: Boolean(window.__pmtDiagram2Renderer),
    compatibilityFeature: window.__pmtDiagram2Compatibility?.feature || ""
  }));
}

async function diagram2ViewportScale(page) {
  return page.evaluate(() => Number(document.querySelector("[data-diagram2-svg]")?.dataset.diagram2ViewportScale || 0));
}

async function installDiagram2LifecycleInstrumentation(page) {
  await page.addInitScript(() => {
    if (window.__diagram2LifecycleInstrumentation) return;
    const originalWindowAdd = window.addEventListener.bind(window);
    const originalWindowRemove = window.removeEventListener.bind(window);
    const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
    const originalRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
    const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
    const windowListeners = [];
    const objectUrls = new Set();
    const animationFrames = new Set();

    function captureValue(options) {
      return typeof options === "boolean" ? options : Boolean(options?.capture);
    }

    window.addEventListener = function instrumentedAddEventListener(type, listener, options) {
      const record = { type, listener, capture: captureValue(options) };
      windowListeners.push(record);
      const signal = options && typeof options === "object" ? options.signal : null;
      if (signal) {
        signal.addEventListener("abort", () => {
          const index = windowListeners.indexOf(record);
          if (index >= 0) windowListeners.splice(index, 1);
        }, { once: true });
      }
      return originalWindowAdd(type, listener, options);
    };

    window.removeEventListener = function instrumentedRemoveEventListener(type, listener, options) {
      const capture = captureValue(options);
      for (let index = windowListeners.length - 1; index >= 0; index -= 1) {
        const record = windowListeners[index];
        if (record.type === type && record.listener === listener && record.capture === capture) {
          windowListeners.splice(index, 1);
          break;
        }
      }
      return originalWindowRemove(type, listener, options);
    };

    URL.createObjectURL = value => {
      const url = originalCreateObjectUrl(value);
      objectUrls.add(url);
      return url;
    };
    URL.revokeObjectURL = url => {
      objectUrls.delete(url);
      return originalRevokeObjectUrl(url);
    };
    window.requestAnimationFrame = callback => {
      const handle = originalRequestAnimationFrame(time => {
        animationFrames.delete(handle);
        callback(time);
      });
      animationFrames.add(handle);
      return handle;
    };
    window.cancelAnimationFrame = handle => {
      animationFrames.delete(handle);
      return originalCancelAnimationFrame(handle);
    };
    window.__diagram2LifecycleInstrumentation = {
      snapshot() {
        return {
          windowListenerCount: windowListeners.length,
          activeObjectUrlCount: objectUrls.size,
          pendingAnimationFrameCount: animationFrames.size
        };
      }
    };
  });
}

async function ensureDiagram2RteFixture(page) {
  await page.evaluate(() => {
    let host = document.querySelector("#diagram2-rte-lifecycle-fixture");
    if (!host) {
      host = document.createElement("div");
      host.id = "diagram2-rte-lifecycle-fixture";
      host.style.position = "absolute";
      host.style.left = "-10000px";
      host.style.top = "0";
      document.body.appendChild(host);
    }
    host.innerHTML = `
      <div class="rich-editor" contenteditable="true">
        <p><img id="diagram2-rte-lifecycle-image" src="/uploads/original.svg" alt="Original" style="width: 160px;"></p>
      </div>
    `;
  });
}

async function openDiagram2RteCycle(page, cycle) {
  await page.evaluate(async index => {
    const { openDiagram2RteAnnotationHost } = await import("/js/features/diagram2/diagram2-rte-host-adapter.js?v=20260726-diagram2-phase2-closure-v1");
    const image = document.querySelector("#diagram2-rte-lifecycle-image");
    image.setAttribute("src", `/uploads/original.svg?cycle=${index}`);
    window.__diagram2AlternatingRtePromise = openDiagram2RteAnnotationHost({
      image,
      editor: document.querySelector("#diagram2-rte-lifecycle-fixture .rich-editor"),
      source: `/uploads/original.svg?cycle=${index}`,
      originalReference: "/uploads/original.svg",
      originalUrl: `/uploads/original.svg?cycle=${index}`,
      originalFileName: "original.svg",
      canEdit: true,
      apply: async () => {}
    });
  }, cycle);
}

async function diagram2LifecycleSnapshot(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  return page.evaluate(() => ({
    ...(window.__diagram2LifecycleInstrumentation?.snapshot?.() || {}),
    diagram2ScreenCount: document.querySelectorAll("[data-diagram2-screen]").length,
    editorShellCount: document.querySelectorAll("[data-diagram2-editor-shell]").length,
    rteDialogCount: document.querySelectorAll("[data-diagram2-rte-host]").length,
    svgCount: document.querySelectorAll("[data-diagram2-svg]").length,
    selectionOverlayCount: document.querySelectorAll("[data-diagram2-selection-id]").length,
    relationshipPreviewCount: document.querySelectorAll("[data-diagram2-relationship-preview-id]").length,
    rendererLive: Boolean(window.__pmtDiagram2Renderer),
    editorCoreLive: Boolean(window.__pmtDiagram2EditorCore),
    rteHostLive: Boolean(window.__pmtDiagram2RteHost),
    compatibilityLive: Boolean(window.__pmtDiagram2Compatibility),
    selectionClipboardLive: Boolean(window.__pmtDiagram2SelectionClipboard)
  }));
}

function expectDiagram2NoLiveArtifacts(snapshot) {
  expect(snapshot.diagram2ScreenCount).toBe(0);
  expect(snapshot.editorShellCount).toBe(0);
  expect(snapshot.rteDialogCount).toBe(0);
  expect(snapshot.svgCount).toBe(0);
  expect(snapshot.selectionOverlayCount).toBe(0);
  expect(snapshot.relationshipPreviewCount).toBe(0);
  expect(snapshot.rendererLive).toBe(false);
  expect(snapshot.editorCoreLive).toBe(false);
  expect(snapshot.rteHostLive).toBe(false);
  expect(snapshot.compatibilityLive).toBe(false);
  expect(snapshot.selectionClipboardLive).toBe(false);
}

function expectDiagram2ClosedSnapshot(snapshot, baseline) {
  expectDiagram2NoLiveArtifacts(snapshot);
  expect(snapshot.windowListenerCount).toBe(baseline.windowListenerCount);
  expect(snapshot.activeObjectUrlCount).toBe(baseline.activeObjectUrlCount);
  expect(snapshot.pendingAnimationFrameCount).toBe(baseline.pendingAnimationFrameCount);
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
    projects: [{ id: 1, code: "PMT", title: "Diagram 2 Beta Test", name: "Diagram 2 Beta Test", isActive: true }],
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
      bodyHtml: `<p><img data-pmt-diagram="true" data-pmt-private-diagram="true" src="/assets/docs/pmt-database-schema.svg?v=20260726-diagram2-day16-fixture" alt="PMT Database Schema"></p>`
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

function jsonResponse(data, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(data)
  };
}
