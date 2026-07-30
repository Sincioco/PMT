import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Taipei" });

const fixtureSpecs = [
  { name: "small", entityCount: 2, relationshipCount: 1, budgetMs: 150 },
  { name: "96-entity", entityCount: 96, relationshipCount: 257, budgetMs: 250 },
  { name: "232-entity", entityCount: 232, relationshipCount: 624, budgetMs: 400 },
  { name: "500-entity", entityCount: 500, relationshipCount: 1, budgetMs: 600 },
  { name: "1000-entity", entityCount: 1000, relationshipCount: 1, budgetMs: 1000 }
];

const sampleCount = Math.max(1, Number.parseInt(process.env.PMT_ROUTE_PERF_SAMPLES || "20", 10));

test("Diagram 2 relationship joint release stays localized across practical fixture sizes", async ({ page }, testInfo) => {
  testInfo.setTimeout(360000);
  await page.goto("/css/base.css");

  await setupRouteFixture(page, fixtureSpecs[0]);
  const firstManualRouteSample = await dragRouteHandle(page, 24);
  expect(firstManualRouteSample.manualRoutesBefore).toBe(false);
  expect(firstManualRouteSample.manualRoutesAfter).toBe(true);
  expect(firstManualRouteSample.routeCommit.routeCommitRelationshipsConsidered).toBe(1);
  expect(firstManualRouteSample.routeCommit.routeCommitRelationshipsRerouted).toBe(0);

  const results = [];
  for (const fixture of fixtureSpecs) {
    const setup = await setupRouteFixture(page, fixture);
    expect(setup.entityCount).toBe(fixture.entityCount);
    expect(setup.relationshipCount).toBe(fixture.relationshipCount);
    expect(setup.manualRoutes).toBe(false);
    expect(setup.routeHandleCount).toBeGreaterThan(0);
    await dragRouteHandle(page, 24);

    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      samples.push(await dragRouteHandle(page, 24));
    }

    const summary = summarizeFixture(fixture, samples);
    results.push({ summary, samples });
    console.info("DIAGRAM2_ROUTE_RELEASE_PERFORMANCE", JSON.stringify(summary));
  }

  await setupRouteFixture(page, fixtureSpecs[0]);
  const undoRedoSample = await dragRouteHandle(page, 24);
  await verifyUndoRedoAndCancel(page, undoRedoSample);
  await page.evaluate(() => window.__diagram2RoutePerformance?.destroy?.());
  expect(results).toHaveLength(fixtureSpecs.length);
  results.forEach(({ summary }) => {
    const fixture = fixtureSpecs.find(candidate => candidate.name === summary.fixture);
    expect.soft(summary.historyDelta, `${summary.fixture} history delta`).toBe(sampleCount);
    expect.soft(summary.previewMismatchCount, `${summary.fixture} preview path`).toBe(0);
    expect.soft(summary.selectionMismatchCount, `${summary.fixture} selection`).toBe(0);
    expect.soft(summary.viewportMismatchCount, `${summary.fixture} viewport`).toBe(0);
    expect.soft(summary.previewLeakCount, `${summary.fixture} preview leaks`).toBe(0);
    expect.soft(summary.duplicateRouteHandleCount, `${summary.fixture} duplicate route handles`).toBe(0);
    expect.soft(summary.svgDescendantCountDrift, `${summary.fixture} DOM growth`).toBe(0);
    expect.soft(summary.fullRenderDelta, `${summary.fixture} full renders`).toBe(0);
    expect.soft(summary.maximumShellRefreshCount, `${summary.fixture} shell refreshes`).toBeLessThanOrEqual(1);
    expect.soft(summary.maximumRelationshipsConsidered, `${summary.fixture} relationships considered`).toBeLessThanOrEqual(1);
    expect.soft(summary.maximumRelationshipsRerouted, `${summary.fixture} relationships rerouted`).toBeLessThanOrEqual(1);
    expect.soft(summary.maximumObjectsVisited, `${summary.fixture} objects visited`).toBeLessThanOrEqual(1);
    expect.soft(summary.maximumObjectsPatched, `${summary.fixture} objects patched`).toBe(1);
    expect.soft(summary.maximumObjectIndexRebuildCount, `${summary.fixture} object index rebuilds`).toBe(0);
    expect.soft(summary.maximumRelationshipIndexRebuildCount, `${summary.fixture} relationship index rebuilds`).toBe(0);
    expect.soft(summary.maximumMappingIndexRebuildCount, `${summary.fixture} mapping index rebuilds`).toBe(0);
    expect.soft(summary.maximumAnnotationIndexRebuildCount, `${summary.fixture} annotation index rebuilds`).toBe(0);
    expect.soft(summary.maximumFullStateNormalizationCount, `${summary.fixture} normalizations`).toBe(0);
    expect.soft(summary.maximumFullStateSerializationCount, `${summary.fixture} serializations`).toBe(0);
    expect.soft(summary.missingTimingCount, `${summary.fixture} release timestamps`).toBe(0);
    expect.soft(summary.maximumLongTaskMs, `${summary.fixture} long task`).toBeLessThanOrEqual(100);
    expect.soft(summary.p95VisualMs, `${summary.fixture} visual p95`).toBeLessThanOrEqual(100);
    expect.soft(summary.p95SettledMs, `${summary.fixture} settled p95`).toBeLessThanOrEqual(fixture.budgetMs);
  });
});

async function setupRouteFixture(page, fixture) {
  return page.evaluate(async spec => {
    window.__diagram2RoutePerformance?.destroy?.();

    const { createDiagram2Renderer, diagram2CanonicalRelationships } = await import(
      "/js/features/diagram2/diagram2-renderer.js?v=20260731-diagram2-route-release-v15"
    );
    const { createDiagram2EditorController } = await import(
      "/js/features/diagram2/diagram2-editor-controller.js?v=20260731-diagram2-route-release-v15"
    );
    const { bindDiagram2EditorInteractions } = await import(
      "/js/features/diagram2/diagram2-editor-interactions.js?v=20260731-diagram2-route-release-v15"
    );

    const state = createFixtureState(spec.entityCount, spec.relationshipCount);
    const canvas = document.createElement("div");
    canvas.dataset.diagram2ViewerCanvas = "";
    canvas.tabIndex = 0;
    canvas.style.cssText = "position:fixed;inset:0;width:1920px;height:1080px;overflow:hidden;background:#fff";
    const surface = document.createElement("div");
    surface.dataset.diagram2RendererSurface = "";
    surface.style.cssText = "position:absolute;inset:0;width:1920px;height:1080px";
    canvas.append(surface);
    document.body.replaceChildren(canvas);

    const renderer = createDiagram2Renderer({
      host: surface,
      initialZoom: "0.5",
      viewportPadding: 0,
      fitScaleStep: 0
    });
    renderer.render(state, { reason: `${spec.name} route performance fixture` });
    const controller = createDiagram2EditorController({
      renderer,
      state,
      host: {
        canEdit: true,
        security: { canUpdate: true }
      }
    });
    const relationshipId = diagram2CanonicalRelationships(state)[0]?.id || "";
    controller.setSelection([relationshipId], { expandGroups: false });
    await renderer.whenIdle();

    const abortController = new AbortController();
    const shellTimes = [];
    bindDiagram2EditorInteractions({
      root: canvas,
      canvas,
      controller,
      renderer,
      signal: abortController.signal,
      isActive: () => true,
      canMutate: () => true,
      onStateChange: () => shellTimes.push(performance.now())
    });

    window.__diagram2RoutePerformance = {
      abortController,
      canvas,
      controller,
      renderer,
      relationshipId,
      shellTimes,
      destroy() {
        abortController.abort();
        controller.destroy();
        renderer.destroy();
      }
    };
    canvas.addEventListener("pointerdown", event => {
      window.__diagram2RoutePerformance.lastPointerId = event.pointerId;
    }, { capture: true, signal: abortController.signal });

    return {
      entityCount: state.objects.length,
      relationshipCount: diagram2CanonicalRelationships(state).length,
      manualRoutes: controller.currentState().manualEntityRelationshipRoutes === true,
      routeHandleCount: document.querySelectorAll("[data-diagram2-relationship-route-handle]").length
    };

    function createFixtureState(entityCount, relationshipCount) {
      const columns = entityCount >= 500 ? 40 : 24;
      const entities = Array.from({ length: entityCount }, (_value, index) => ({
        id: `route-entity-${index}`,
        type: "entity",
        x: 40 + ((index % columns) * 220),
        y: 40 + (Math.floor(index / columns) * 180),
        width: 180,
        height: 120,
        entitySchema: "pmt",
        entityName: `RouteEntity${index}`,
        fields: [{
          name: "Id",
          dataType: "int",
          nullable: false,
          isPrimaryKey: true
        }],
        foreignKeys: []
      }));

      for (let index = 0; index < relationshipCount; index += 1) {
        const sourceIndex = index % entityCount;
        const targetIndex = (sourceIndex + 1 + Math.floor(index / entityCount)) % entityCount;
        const source = entities[sourceIndex];
        const fieldName = `Target${index}Id`;
        source.fields.push({
          name: fieldName,
          dataType: "int",
          nullable: false,
          isForeignKey: true
        });
        source.foreignKeys.push({
          name: `FK_Route_${index}`,
          columns: [fieldName],
          referencedSchema: "pmt",
          referencedTable: entities[targetIndex].entityName,
          referencedColumns: ["Id"],
          relationshipType: "many-to-one"
        });
        source.height = Math.max(source.height, 72 + (source.fields.length * 24));
      }

      return {
        version: 1,
        width: Math.max(1920, columns * 220),
        height: Math.max(1080, Math.ceil(entityCount / columns) * 180),
        manualEntityRelationshipRoutes: false,
        compactEntityRelationshipRouting: false,
        objects: entities
      };
    }
  }, fixture);
}

async function dragRouteHandle(page, delta) {
  const handle = page.locator("[data-diagram2-relationship-route-handle]").first();
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  const axis = await handle.getAttribute("data-diagram2-relationship-segment-axis");
  const center = {
    x: box.x + (box.width / 2),
    y: box.y + (box.height / 2)
  };
  const before = await page.evaluate(() => {
    const state = window.__diagram2RoutePerformance;
    const controller = state.controller;
    const renderer = state.renderer;
    const relationshipId = state.relationshipId;
    const source = controller.getObjectById("route-entity-0");
    return {
      historyCount: controller.historyStatus().entryCount,
      route: JSON.stringify(source?.foreignKeys?.[0]?.routeOverride || []),
      manualRoutes: controller.currentState().manualEntityRelationshipRoutes === true,
      fullRenderCount: Number(renderer.diagnostics().fullRenderCount || 0),
      viewport: JSON.stringify(renderer.viewportMatrix()),
      selection: JSON.stringify(controller.selectedRelationshipIds()),
      shellCount: state.shellTimes.length
    };
  });

  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(
    center.x + (axis === "x" ? delta : 0),
    center.y + (axis === "y" ? delta : 0)
  );
  await expect(page.locator("[data-diagram2-relationship-route-preview]")).toHaveCount(1);
  const previewPath = await page.locator("[data-diagram2-relationship-route-preview]").getAttribute("d");
  before.shellCount = await page.evaluate(() => window.__diagram2RoutePerformance.shellTimes.length);

  await page.evaluate(expectedPath => {
    const state = window.__diagram2RoutePerformance;
    const relationshipId = state.relationshipId;
    const relationshipPath = document.querySelector(
      `[data-diagram2-relationship-id="${CSS.escape(relationshipId)}"] [data-diagram2-relationship-path]`
    );
    const routeOverlay = document.querySelector(
      `[data-diagram2-relationship-route-overlay-id="${CSS.escape(relationshipId)}"]`
    );
    const release = {
      previewReady: performance.now(),
      pointerup: 0,
      realPathPatched: 0,
      handlesPatched: 0,
      longTaskMs: 0,
      observers: []
    };
    const pathObserver = new MutationObserver(() => {
      if (!release.realPathPatched && relationshipPath?.getAttribute("d") === expectedPath) {
        release.realPathPatched = performance.now();
      }
    });
    if (relationshipPath) {
      pathObserver.observe(relationshipPath, { attributes: true, attributeFilter: ["d"] });
      release.observers.push(pathObserver);
    }
    const handleObserver = new MutationObserver(() => {
      if (!release.handlesPatched) release.handlesPatched = performance.now();
    });
    if (routeOverlay) {
      handleObserver.observe(routeOverlay, { attributes: true, childList: true, subtree: true });
      release.observers.push(handleObserver);
    }
    const longTaskObserver = typeof PerformanceObserver === "function"
      ? new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            if (entry.startTime >= release.pointerup) {
              release.longTaskMs = Math.max(release.longTaskMs, entry.duration);
            }
          });
        })
      : null;
    try {
      longTaskObserver?.observe({ type: "longtask", buffered: false });
      if (longTaskObserver) release.observers.push(longTaskObserver);
    } catch {
      // Long-task entries are optional in browsers that do not expose them.
    }
    window.addEventListener("pointerup", () => {
      release.pointerup = performance.now();
    }, { capture: true, once: true });
    window.__diagram2RouteRelease = release;
  }, previewPath);

  await page.mouse.up();
  await expect.poll(() => page.evaluate(() =>
    window.__diagram2RoutePerformance.controller.historyStatus().entryCount
  )).toBe(before.historyCount + 1);

  return page.evaluate(async ({ beforeSnapshot, expectedPath }) => {
    const state = window.__diagram2RoutePerformance;
    const release = window.__diagram2RouteRelease;
    await state.renderer.whenInteractive();
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 0));
    release.observers.forEach(observer => observer.disconnect());
    const source = state.controller.getObjectById("route-entity-0");
    const rendererDiagnostics = state.renderer.diagnostics();
    const controllerDiagnostics = state.controller.diagnostics();
    const relationshipPath = document.querySelector(
      `[data-diagram2-relationship-id="${CSS.escape(state.relationshipId)}"] [data-diagram2-relationship-path]`
    )?.getAttribute("d") || "";
    const responsiveAt = performance.now();
    const routeCommit = controllerDiagnostics.lastRouteCommit || rendererDiagnostics.lastRouteCommit || null;
    const committedPathAt = Number(routeCommit?.realRelationshipPathPatchedAt || release.realPathPatched || responsiveAt);
    return {
      settledMs: Math.max(0, responsiveAt - release.pointerup),
      visualMs: Math.max(0, committedPathAt - release.pointerup),
      observedLongTaskMs: release.longTaskMs,
      previewMatches: relationshipPath === expectedPath,
      routeBefore: beforeSnapshot.route,
      routeAfter: JSON.stringify(source?.foreignKeys?.[0]?.routeOverride || []),
      manualRoutesBefore: beforeSnapshot.manualRoutes,
      manualRoutesAfter: state.controller.currentState().manualEntityRelationshipRoutes === true,
      historyDelta: state.controller.historyStatus().entryCount - beforeSnapshot.historyCount,
      fullRenderDelta: Number(rendererDiagnostics.fullRenderCount || 0) - beforeSnapshot.fullRenderCount,
      viewportMatches: JSON.stringify(state.renderer.viewportMatrix()) === beforeSnapshot.viewport,
      selectionMatches: JSON.stringify(state.controller.selectedRelationshipIds()) === beforeSnapshot.selection,
      previewCount: document.querySelectorAll("[data-diagram2-relationship-route-preview]").length,
      handleCount: document.querySelectorAll("[data-diagram2-relationship-route-handle]").length,
      uniqueHandleCount: new Set(Array.from(
        document.querySelectorAll("[data-diagram2-relationship-route-handle]"),
        handle => [
          handle.dataset.diagram2RelationshipId,
          handle.dataset.diagram2RelationshipSegmentIndex,
          handle.dataset.diagram2RelationshipSegmentAxis
        ].join(":")
      )).size,
      svgDescendantCount: Number(rendererDiagnostics.svgDescendantCount || 0),
      shellRefreshCount: state.shellTimes.length - beforeSnapshot.shellCount,
      routeCommit
    };
  }, { beforeSnapshot: before, expectedPath: previewPath });
}

async function verifyUndoRedoAndCancel(page, lastSample) {
  const undoResult = await page.evaluate(async expectedRoutes => {
    const state = window.__diagram2RoutePerformance;
    const fullRenderCount = Number(state.renderer.diagnostics().fullRenderCount || 0);
    const startedAt = performance.now();
    await state.controller.undo();
    await state.renderer.whenInteractive();
    const elapsedMs = performance.now() - startedAt;
    const source = state.controller.getObjectById("route-entity-0");
    const routeAfterUndo = JSON.stringify(source?.foreignKeys?.[0]?.routeOverride || []);
    const undoMatchesPrevious = routeAfterUndo === expectedRoutes.previousRoute;
    const redoStartedAt = performance.now();
    await state.controller.redo();
    await state.renderer.whenInteractive();
    const redoElapsedMs = performance.now() - redoStartedAt;
    const routeAfterRedo = JSON.stringify(
      state.controller.getObjectById("route-entity-0")?.foreignKeys?.[0]?.routeOverride || []
    );
    return {
      undoMatchesPrevious,
      redoMatchesFinal: routeAfterRedo === expectedRoutes.finalRoute,
      elapsedMs,
      redoElapsedMs,
      fullRenderDelta: Number(state.renderer.diagnostics().fullRenderCount || 0) - fullRenderCount,
      selectionMatches: state.controller.selectedRelationshipIds()[0] === state.relationshipId,
      routeHandleCount: document.querySelectorAll("[data-diagram2-relationship-route-handle]").length
    };
  }, {
    previousRoute: lastSample.routeBefore,
    finalRoute: lastSample.routeAfter
  });
  expect(undoResult.undoMatchesPrevious).toBe(true);
  expect(undoResult.redoMatchesFinal).toBe(true);
  expect(undoResult.elapsedMs).toBeLessThanOrEqual(150);
  expect(undoResult.redoElapsedMs).toBeLessThanOrEqual(150);
  expect(undoResult.fullRenderDelta).toBe(0);
  expect(undoResult.selectionMatches).toBe(true);
  expect(undoResult.routeHandleCount).toBeGreaterThan(0);

  const handle = page.locator("[data-diagram2-relationship-route-handle]").first();
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  const axis = await handle.getAttribute("data-diagram2-relationship-segment-axis");
  const beforeCancel = await page.evaluate(() => {
    const state = window.__diagram2RoutePerformance;
    return {
      route: JSON.stringify(state.controller.getObjectById("route-entity-0")?.foreignKeys?.[0]?.routeOverride || []),
      historyCount: state.controller.historyStatus().entryCount,
      diagnostics: state.controller.diagnostics(),
      pointerCaptureActive: state.canvas.hasPointerCapture?.(state.lastPointerId) === true
    };
  });
  const center = { x: box.x + (box.width / 2), y: box.y + (box.height / 2) };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + (axis === "x" ? 24 : 0), center.y + (axis === "y" ? 24 : 0));
  await expect(page.locator("[data-diagram2-relationship-route-preview]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  const pointerCaptureAfterEscape = await page.evaluate(() => {
    const state = window.__diagram2RoutePerformance;
    return state.canvas.hasPointerCapture?.(state.lastPointerId) === true;
  });
  await page.mouse.up();
  await expect(page.locator("[data-diagram2-relationship-route-preview]")).toHaveCount(0);
  const afterCancel = await page.evaluate(() => {
    const state = window.__diagram2RoutePerformance;
    return {
      route: JSON.stringify(state.controller.getObjectById("route-entity-0")?.foreignKeys?.[0]?.routeOverride || []),
      historyCount: state.controller.historyStatus().entryCount,
      diagnostics: state.controller.diagnostics(),
      pointerCaptureActive: state.canvas.hasPointerCapture?.(state.lastPointerId) === true
    };
  });
  expect(afterCancel.route).toBe(beforeCancel.route);
  expect(afterCancel.historyCount).toBe(beforeCancel.historyCount);
  expect(afterCancel.diagnostics.canonicalRevision).toBe(beforeCancel.diagnostics.canonicalRevision);
  expect(afterCancel.diagnostics.relationshipIndexRebuildCount)
    .toBe(beforeCancel.diagnostics.relationshipIndexRebuildCount);
  expect(pointerCaptureAfterEscape).toBe(false);
  expect(afterCancel.pointerCaptureActive).toBe(false);
}

function summarizeFixture(fixture, samples) {
  const routeCommits = samples.map(sample => sample.routeCommit || {});
  return {
    fixture: fixture.name,
    entityCount: fixture.entityCount,
    relationshipCount: fixture.relationshipCount,
    sampleCount: samples.length,
    medianSettledMs: percentile(samples.map(sample => sample.settledMs), 0.5),
    p95SettledMs: percentile(samples.map(sample => sample.settledMs), 0.95),
    medianVisualMs: percentile(samples.map(sample => sample.visualMs), 0.5),
    p95VisualMs: percentile(samples.map(sample => sample.visualMs), 0.95),
    maximumLongTaskMs: maximum(samples.map(sample =>
      Math.max(sample.observedLongTaskMs || 0, sample.routeCommit?.routeCommitLongTaskMs || 0))),
    maximumObservedLongTaskMs: maximum(samples.map(sample => sample.observedLongTaskMs)),
    maximumSynchronousReleaseMs: maximum(routeCommits.map(value => value.routeCommitLongTaskMs)),
    medianPlanMs: percentile(routeCommits.map(value => value.routeCommitPlanMs), 0.5),
    p95PlanMs: percentile(routeCommits.map(value => value.routeCommitPlanMs), 0.95),
    medianCanonicalMs: percentile(routeCommits.map(value => value.routeCommitCanonicalMs), 0.5),
    p95CanonicalMs: percentile(routeCommits.map(value => value.routeCommitCanonicalMs), 0.95),
    medianHistoryMs: percentile(routeCommits.map(value => value.routeCommitHistoryMs), 0.5),
    p95HistoryMs: percentile(routeCommits.map(value => value.routeCommitHistoryMs), 0.95),
    medianRendererFlushMs: percentile(routeCommits.map(value => value.routeCommitRendererFlushMs), 0.5),
    p95RendererFlushMs: percentile(routeCommits.map(value => value.routeCommitRendererFlushMs), 0.95),
    medianShellMs: percentile(routeCommits.map(value => value.routeCommitShellMs), 0.5),
    p95ShellMs: percentile(routeCommits.map(value => value.routeCommitShellMs), 0.95),
    missingTimingCount: routeCommits.filter(value => [
      value.pointerupReceivedAt,
      value.previewFinalCoordinateAvailableAt,
      value.canonicalRouteUpdatedAt,
      value.realRelationshipPathPatchedAt,
      value.routeHandlesPatchedAt,
      value.historyCommandRecordedAt,
      value.rendererFlushScheduledAt,
      value.rendererFlushCompletedAt,
      value.shellControlsStatusCompletedAt,
      value.mainThreadResponsiveAt
    ].some(timestamp => !(Number(timestamp) > 0))).length,
    historyDelta: samples.reduce((total, sample) => total + sample.historyDelta, 0),
    fullRenderDelta: samples.reduce((total, sample) => total + sample.fullRenderDelta, 0),
    previewMismatchCount: samples.filter(sample => !sample.previewMatches).length,
    selectionMismatchCount: samples.filter(sample => !sample.selectionMatches).length,
    viewportMismatchCount: samples.filter(sample => !sample.viewportMatches).length,
    previewLeakCount: samples.filter(sample => sample.previewCount !== 0).length,
    duplicateRouteHandleCount: maximum(samples.map(sample =>
      sample.handleCount - sample.uniqueHandleCount)),
    svgDescendantCountDrift: maximum(samples.map(sample => sample.svgDescendantCount))
      - minimum(samples.map(sample => sample.svgDescendantCount)),
    maximumShellRefreshCount: maximum(samples.map(sample => sample.shellRefreshCount)),
    maximumRelationshipsConsidered: maximum(routeCommits.map(value => value.routeCommitRelationshipsConsidered)),
    maximumRelationshipsRerouted: maximum(routeCommits.map(value => value.routeCommitRelationshipsRerouted)),
    maximumObjectsVisited: maximum(routeCommits.map(value => value.routeCommitObjectsVisited)),
    maximumObjectsPatched: maximum(routeCommits.map(value => value.routeCommitObjectsPatched)),
    maximumObjectIndexRebuildCount: maximum(routeCommits.map(value => value.routeCommitObjectIndexRebuildCount)),
    maximumRelationshipIndexRebuildCount: maximum(routeCommits.map(value => value.routeCommitRelationshipIndexRebuildCount)),
    maximumMappingIndexRebuildCount: maximum(routeCommits.map(value => value.routeCommitMappingIndexRebuildCount)),
    maximumAnnotationIndexRebuildCount: maximum(routeCommits.map(value => value.routeCommitAnnotationIndexRebuildCount)),
    maximumFullStateNormalizationCount: maximum(routeCommits.map(value => value.routeCommitFullStateNormalizationCount)),
    maximumFullStateSerializationCount: maximum(routeCommits.map(value => value.routeCommitFullStateSerializationCount))
  };
}

function percentile(values, amount) {
  const sorted = values.map(value => Number(value || 0)).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const index = Math.max(0, Math.ceil(sorted.length * amount) - 1);
  return Math.round(sorted[index] * 100) / 100;
}

function maximum(values) {
  return Math.max(0, ...values.map(value => Number(value || 0)));
}

function minimum(values) {
  return Math.min(...values.map(value => Number(value || 0)));
}
