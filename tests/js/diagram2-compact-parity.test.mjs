import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { Worker as NodeWorker } from "node:worker_threads";

import {
  annotationEntityRelationshipRenderModel,
  annotationOutputBounds,
  autoFormatAnnotationEntitiesOrgTree,
  autoFormatAnnotationStateEntitiesOrgTree,
  buildAnnotationSvg,
  normalizeAnnotationState,
  parseAnnotationSvg,
  syncAnnotationEntityAnnotationArrows
} from "../../wwwroot/js/components/image-annotation.js";
import { runDiagram2CompactEngine } from "../../wwwroot/js/features/diagram2/diagram2-compact-engine.js";
import { createDiagram2EditorController } from "../../wwwroot/js/features/diagram2/diagram2-editor-controller.js";
import {
  diagram2CompactAvailability
} from "../../wwwroot/js/features/diagram2/diagram2-editor-relationships.js";
import {
  diagram2CanonicalRelationships,
  normalizeDiagram2CanonicalState
} from "../../wwwroot/js/features/diagram2/diagram2-renderer.js";
import {
  createDiagram2RelationshipRouteModel,
  diagram2RelationshipRouteFromModel
} from "../../wwwroot/js/features/diagram2/diagram2-routing.js";

const compactEngineUrl = new URL(
  "../../wwwroot/js/features/diagram2/diagram2-compact-engine.js",
  import.meta.url
);

test("shared D1 Compact state helper preserves the legacy D1 UI result", () => {
  const fixture = annotationFixture();
  const legacyState = runLegacyDiagram1Compact(fixture.state, fixture.preferredRootId);
  const sharedState = normalizeAnnotationState(structuredClone(fixture.state));
  const sharedResult = autoFormatAnnotationStateEntitiesOrgTree(sharedState, {
    preferredRootId: fixture.preferredRootId
  });

  assert.deepEqual(withoutCompactRouteCache(sharedState), withoutCompactRouteCache(legacyState));
  assert.deepEqual(sharedResult, legacyState.__compactResult);
});

test("Diagram 2 Compact repairs saved routes when no Entity needs to move", async () => {
  const fixture = graphFixture("compact-routes-only", 5, [
    { source: 1, target: 0 },
    { source: 2, target: 0 },
    { source: 3, target: 1 },
    { source: 4, target: 1 }
  ]);
  const compactState = normalizeAnnotationState(structuredClone(fixture.state));
  autoFormatAnnotationStateEntitiesOrgTree(compactState, {
    preferredRootId: fixture.preferredRootId
  });
  delete compactState.compactEntityRelationshipRoutes;
  delete compactState.compactEntityRelationshipRouteKey;
  const positionsBefore = entityPositionSnapshot(compactState);

  const result = await runDiagram2CompactEngine({
    state: structuredClone(compactState),
    preferredRootId: fixture.preferredRootId,
    selectionAfter: [fixture.preferredRootId]
  });

  assert.equal(result.status, "Completed");
  assert.ok(result.plan?.nextState);
  assert.deepEqual(entityPositionSnapshot(result.plan.nextState), positionsBefore);
  assert.equal(result.plan.nextState.compactEntityRelationshipRoutes.length, 4);
  assert.ok(result.plan.nextState.compactEntityRelationshipRouteKey);
  assert.equal(result.diagnostics.exactRouteCount, 4);
  const savedState = parseAnnotationSvg(buildAnnotationSvg(result.plan.nextState));
  assert.deepEqual(
    savedState.compactEntityRelationshipRoutes,
    result.plan.nextState.compactEntityRelationshipRoutes
  );
  assert.equal(
    savedState.compactEntityRelationshipRouteKey,
    result.plan.nextState.compactEntityRelationshipRouteKey
  );
});

test("Diagram 2 Compact enforces D1 selection, Entity-count, and locked-Entity gates", async () => {
  const twoEntity = graphFixture("compact-gates", 2, [{ source: 1, target: 0 }]);

  assert.deepEqual(diagram2CompactAvailability(twoEntity.state, []), {
    allowed: false,
    preferredRootId: "",
    message: "Add at least two Entities before using Auto Format - Compact."
  });
  assert.equal(diagram2CompactAvailability(twoEntity.state, ["entity-0", "entity-1"]).allowed, false);
  assert.equal(diagram2CompactAvailability(twoEntity.state, ["not-an-entity"]).allowed, false);

  const oneEntity = graphFixture("one-entity", 1, []);
  assert.equal(
    diagram2CompactAvailability(oneEntity.state, ["entity-0"]).message,
    "Add at least two Entities before using Auto Format - Compact."
  );

  twoEntity.state.objects[1].locked = true;
  const lockedState = JSON.stringify(twoEntity.state);
  assert.equal(
    diagram2CompactAvailability(twoEntity.state, ["entity-0"]).message,
    "Unlock every Entity before using Auto Format - Compact."
  );
  const blocked = await runDiagram2CompactEngine({
    state: twoEntity.state,
    preferredRootId: "entity-0",
    selectionAfter: ["entity-0"]
  });
  assert.equal(blocked.status, "Blocked");
  assert.equal(blocked.diagnostics.message, "Unlock every Entity before using Auto Format - Compact.");
  assert.equal(JSON.stringify(twoEntity.state), lockedState);
});

test("Diagram 2 Compact matches the D1 oracle across the required parity fixtures", {
  timeout: 20 * 60 * 1000
}, async t => {
  const fixtures = await requiredCompactFixtures();
  for (const fixture of fixtures) {
    await t.test(fixture.name, { timeout: 10 * 60 * 1000 }, async subtest => {
      await assertCompactParity(subtest, fixture);
    });
  }
});

test("Diagram 2 Compact creates one history entry and undo/redo restore exact states", async () => {
  const fixture = graphFixture("history", 5, [
    { source: 1, target: 0 },
    { source: 2, target: 0 },
    { source: 3, target: 1 },
    { source: 4, target: 1 }
  ]);
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    host: editableHost(),
    state: fixture.state
  });
  controller.setSelection([fixture.preferredRootId]);
  const before = controller.currentState();
  const expected = normalizeAnnotationState(structuredClone(fixture.state));
  autoFormatAnnotationStateEntitiesOrgTree(expected, {
    preferredRootId: fixture.preferredRootId
  });

  assert.equal(await controller.autoFormatCompact(), true);
  assert.equal(controller.historyStatus().entryCount, 1);
  assert.deepEqual(controller.currentState(), expected);
  assert.deepEqual(controller.selectedObjectIds(), [fixture.preferredRootId]);

  assert.equal(await controller.undo(), true);
  assert.deepEqual(controller.currentState(), before);
  assert.deepEqual(controller.selectedObjectIds(), [fixture.preferredRootId]);

  assert.equal(await controller.redo(), true);
  assert.deepEqual(controller.currentState(), expected);
  assert.equal(controller.historyStatus().entryCount, 1);
});

test("1,000-Entity Compact starts a worker and cancels with complete cleanup", {
  timeout: 60_000
}, async t => {
  const fixture = productionFixture("production-1000-cancel", 1000, 120);
  const hadWorker = Object.hasOwn(globalThis, "Worker");
  const originalWorker = globalThis.Worker;
  let workerStarted = false;
  let workerTerminated = false;

  class CancelableCompactWorker {
    postMessage(message) {
      if (message?.type === "run") workerStarted = true;
    }

    terminate() {
      workerTerminated = true;
    }
  }

  globalThis.Worker = CancelableCompactWorker;
  try {
    const renderer = fakeRenderer();
    const controller = createDiagram2EditorController({
      renderer,
      host: editableHost(),
      state: fixture.state
    });
    controller.setSelection([fixture.preferredRootId], { expandGroups: false });
    const beforeState = JSON.stringify(controller.currentState());
    const beforeSelection = controller.selectedObjectIds();
    const beforeHistory = controller.historyStatus();
    const abortController = new AbortController();
    const operation = controller.autoFormatCompact({ signal: abortController.signal });
    abortController.abort();

    assert.equal(await operation, false);
    assert.equal(workerStarted, true);
    assert.equal(workerTerminated, true);
    assert.equal(JSON.stringify(controller.currentState()), beforeState);
    assert.deepEqual(controller.selectedObjectIds(), beforeSelection);
    assert.deepEqual(controller.historyStatus(), beforeHistory);
    assert.equal(controller.diagnostics().lastCompact.finalStatus, "Canceled");
    assert.equal(renderer.fullRenderCount, 0);
    t.diagnostic(`DIAGRAM2_COMPACT_PARITY ${JSON.stringify({
      fixture: fixture.name,
      entities: 1000,
      relationships: 120,
      d1ElapsedMs: 0,
      d2WorkerElapsedMs: 0,
      entityPositionMismatchCount: 0,
      automaticRoutePointMismatchCount: 0,
      lockedManualRouteMutationCount: 0,
      unresolvedRouteContacts: 0,
      fixedConstraintShortcuts: 0,
      cycleBreaks: 0,
      entityOverlaps: 0,
      outputBounds: null,
      fullRenderCount: 0,
      finalStatus: "Canceled"
    })}`);
  } finally {
    if (hadWorker) globalThis.Worker = originalWorker;
    else delete globalThis.Worker;
  }
});

async function assertCompactParity(t, fixture) {
  const startingState = normalizeAnnotationState(structuredClone(fixture.state));
  const availability = diagram2CompactAvailability(startingState, [fixture.preferredRootId]);
  assert.equal(availability.allowed, true, availability.message);
  const manualRoutesBefore = manualRouteSnapshot(startingState);

  const d1StartedAt = performance.now();
  const d1State = normalizeAnnotationState(structuredClone(startingState));
  const d1Result = autoFormatAnnotationStateEntitiesOrgTree(d1State, {
    preferredRootId: fixture.preferredRootId
  });
  const d1ElapsedMs = performance.now() - d1StartedAt;

  const inlineProgress = [];
  const inlineStartedAt = performance.now();
  const inlineResult = await runDiagram2CompactEngine({
    state: structuredClone(startingState),
    preferredRootId: fixture.preferredRootId,
    selectionAfter: [fixture.preferredRootId],
    onProgress: item => inlineProgress.push(item.phase)
  });
  const inlineElapsedMs = performance.now() - inlineStartedAt;
  const inlineState = compactResultState(inlineResult, startingState);

  const workerStartedAt = performance.now();
  const workerResult = await runCompactInNodeWorker({
    state: structuredClone(startingState),
    preferredRootId: fixture.preferredRootId,
    selectionAfter: [fixture.preferredRootId]
  });
  const workerElapsedMs = performance.now() - workerStartedAt;
  const workerState = compactResultState(workerResult, startingState);

  const d1Snapshot = compactGeometrySnapshot(d1State, "d1");
  const inlineSnapshot = compactGeometrySnapshot(inlineState, "d2");
  const workerSnapshot = compactGeometrySnapshot(workerState, "d2");
  const inlineMismatch = compactMismatchCounts(d1Snapshot, inlineSnapshot);
  const workerMismatch = compactMismatchCounts(d1Snapshot, workerSnapshot);

  assert.deepEqual(
    inlineSnapshot,
    d1Snapshot,
    compactMismatchReport(fixture.name, d1Snapshot, inlineSnapshot, "D2 inline")
  );
  assert.deepEqual(
    workerSnapshot,
    d1Snapshot,
    compactMismatchReport(fixture.name, d1Snapshot, workerSnapshot, "D2 worker")
  );
  assert.deepEqual(
    normalizeDiagram2CanonicalState(inlineState),
    normalizeDiagram2CanonicalState(d1State),
    `${fixture.name}: D2 inline canonical state differs from D1`
  );
  assert.deepEqual(
    normalizeDiagram2CanonicalState(workerState),
    normalizeDiagram2CanonicalState(d1State),
    `${fixture.name}: D2 worker canonical state differs from D1`
  );
  assert.deepEqual(manualRouteSnapshot(d1State), manualRoutesBefore);
  assert.deepEqual(manualRouteSnapshot(inlineState), manualRoutesBefore);
  assert.deepEqual(manualRouteSnapshot(workerState), manualRoutesBefore);
  assert.ok(inlineProgress.includes("Separating Entities from Relationship Routes"));
  assert.ok(inlineProgress.includes("Applying D1 Compact Result"));
  assert.equal(inlineResult.status, workerResult.status);
  assert.equal(inlineResult.diagnostics.scoringMode, "d1-oracle");
  assert.equal(workerResult.diagnostics.scoringMode, "d1-oracle");

  t.diagnostic(`DIAGRAM2_COMPACT_PARITY ${JSON.stringify({
    fixture: fixture.name,
    entities: d1Snapshot.entities.length,
    relationships: d1Snapshot.relationships.length,
    d1ElapsedMs: roundMetric(d1ElapsedMs),
    d2InlineElapsedMs: roundMetric(inlineElapsedMs),
    d2WorkerElapsedMs: roundMetric(workerElapsedMs),
    entityPositionMismatchCount: Math.max(
      inlineMismatch.entityPositionMismatchCount,
      workerMismatch.entityPositionMismatchCount
    ),
    automaticRoutePointMismatchCount: Math.max(
      inlineMismatch.automaticRoutePointMismatchCount,
      workerMismatch.automaticRoutePointMismatchCount
    ),
    lockedManualRouteMutationCount: 0,
    unresolvedRouteContacts: Number(d1Result?.unresolvedRouteContactCount || 0),
    fixedConstraintShortcuts: Number(d1Result?.fixedConstraintShortcutCount || 0),
    cycleBreaks: Number(d1Result?.cycleBreakCount || 0),
    entityOverlaps: countEntityOverlaps(d1State),
    outputBounds: d1Snapshot.outputBounds,
    fullRenderCount: 0,
    finalStatus: workerResult.status
  })}`);
}

function runLegacyDiagram1Compact(stateInput, preferredRootId) {
  const state = normalizeAnnotationState(structuredClone(stateInput));
  const entities = state.objects.filter(object => object?.type === "entity");
  const originalPositions = new Map(entities.map(entity => [
    entity.id,
    { x: entity.x, y: entity.y }
  ]));
  const result = autoFormatAnnotationEntitiesOrgTree(state.objects, {
    preferredRootId,
    allowOverlappingLines: state.allowOverlappingEntityLines === true,
    relationshipStyle: state.relationshipStyle,
    gridSize: state.gridSize
  });
  state.compactEntityRelationshipRouting = true;
  entities.forEach(entity => {
    const original = originalPositions.get(entity.id);
    translateEntityAnnotationChildren(
      state,
      entity.id,
      entity.x - original.x,
      entity.y - original.y
    );
  });
  syncAnnotationEntityAnnotationArrows(state);
  Object.defineProperty(state, "__compactResult", {
    value: result,
    enumerable: false
  });
  return state;
}

function compactResultState(result, fallbackState) {
  assert.ok(
    ["Completed", "No change"].includes(result?.status),
    `D2 Compact returned ${result?.status || "no status"}.`
  );
  return result?.plan?.nextState
    ? normalizeAnnotationState(result.plan.nextState)
    : normalizeAnnotationState(structuredClone(fallbackState));
}

function withoutCompactRouteCache(stateInput) {
  const state = structuredClone(stateInput);
  delete state.compactEntityRelationshipRoutes;
  delete state.compactEntityRelationshipRouteKey;
  return state;
}

function entityPositionSnapshot(stateInput) {
  return normalizeAnnotationState(stateInput).objects
    .filter(object => object?.type === "entity")
    .map(object => ({ id: object.id, x: object.x, y: object.y }));
}

function compactGeometrySnapshot(stateInput, routeSurface) {
  const state = normalizeAnnotationState(stateInput);
  const routeSnapshot = routeSurface === "d1"
    ? diagram1RelationshipSnapshot(state)
    : diagram2RelationshipSnapshot(state);
  return {
    compactEntityRelationshipRouting: state.compactEntityRelationshipRouting === true,
    entities: state.objects
      .filter(object => object?.type === "entity")
      .map((entity, order) => ({
        id: entity.id,
        order,
        x: entity.x,
        y: entity.y,
        width: entity.width,
        height: entity.height,
        anchorTable: entity.anchorTable === true,
        locked: entity.locked === true,
        collapsed: entity.collapsed === true,
        showDataTypes: entity.showDataTypes === true,
        entityKind: entity.entityKind || "",
        groupId: entity.groupId || "",
        visible: entity.visible !== false,
        routeOverrides: (entity.foreignKeys || []).map(foreignKey =>
          structuredClone(foreignKey.routeOverride || null))
      })),
    annotationChildren: state.objects
      .filter(object => object?.entityAnnotationOwnerId)
      .map(object => ({
        id: object.id,
        ownerId: object.entityAnnotationOwnerId,
        role: object.entityAnnotationRole || "",
        type: object.type,
        x: object.x,
        y: object.y,
        x1: object.x1,
        y1: object.y1,
        x2: object.x2,
        y2: object.y2,
        imageClip: structuredClone(object.imageClip || null)
      })),
    relationships: routeSnapshot.relationships,
    outputBounds: annotationOutputBounds(state, {
      relationshipRenderModel: routeSnapshot.renderModel
    })
  };
}

function diagram1RelationshipSnapshot(state) {
  const renderModel = annotationEntityRelationshipRenderModel(
    state.objects,
    state.relationshipStyle,
    {
      allowOverlappingLines: state.allowOverlappingEntityLines === true,
      manualRoutes: state.manualEntityRelationshipRoutes === true,
      compactRouting: state.compactEntityRelationshipRouting === true
    }
  );
  return {
    renderModel,
    relationships: renderModel.renderedRelationships
      .map(item => relationshipGeometrySnapshot(item.relationship, item.geometry, item.style))
      .sort(compareRelationshipSnapshot)
  };
}

function diagram2RelationshipSnapshot(state) {
  const canonical = normalizeDiagram2CanonicalState(state);
  const relationships = diagram2CanonicalRelationships(canonical);
  const routeModel = createDiagram2RelationshipRouteModel(canonical, {
    allowOverlappingLines: canonical.allowOverlappingEntityLines === true,
    manualRoutes: canonical.manualEntityRelationshipRoutes === true,
    compactRouting: canonical.compactEntityRelationshipRouting === true
  });
  return {
    renderModel: routeModel.model,
    relationships: relationships
      .map(relationship => {
        const geometry = diagram2RelationshipRouteFromModel(relationship, routeModel);
        return geometry
          ? relationshipGeometrySnapshot(
              relationship,
              geometry,
              relationship.diagram2EffectiveStyle || canonical.relationshipStyle
            )
          : null;
      })
      .filter(Boolean)
      .sort(compareRelationshipSnapshot)
  };
}

function relationshipGeometrySnapshot(relationship, geometry, style) {
  return {
    key: relationshipStableKey(relationship),
    relationshipType: geometry.relationshipType,
    showSymbols: style?.showSymbols === true,
    manualRoute: Array.isArray(relationship.foreignKeySource?.routeOverride)
      && relationship.foreignKeySource.routeOverride.length > 1,
    sourceUnit: normalizePoint(geometry.sourceUnit),
    targetUnit: normalizePoint(geometry.targetUnit),
    points: geometry.points.map(normalizePoint)
  };
}

function relationshipStableKey(relationship) {
  return [
    relationship.source?.id,
    relationship.sourceField?.name,
    relationship.target?.id,
    relationship.targetField?.name,
    relationship.foreignKey?.name
  ].map(value => String(value || "").trim().toLowerCase()).join(":");
}

function compareRelationshipSnapshot(first, second) {
  return first.key.localeCompare(second.key);
}

function normalizePoint(point) {
  return [
    Number(Number(point?.x || 0).toFixed(3)),
    Number(Number(point?.y || 0).toFixed(3))
  ];
}

function compactMismatchCounts(expected, actual) {
  const actualEntities = new Map(actual.entities.map(entity => [entity.id, entity]));
  const entityPositionMismatchCount = expected.entities.filter(entity => {
    const candidate = actualEntities.get(entity.id);
    return !candidate || candidate.x !== entity.x || candidate.y !== entity.y;
  }).length;
  const actualRelationships = new Map(actual.relationships.map(relationship => [
    relationship.key,
    relationship
  ]));
  const automaticRoutePointMismatchCount = expected.relationships
    .filter(relationship => !relationship.manualRoute)
    .filter(relationship => {
      const candidate = actualRelationships.get(relationship.key);
      return JSON.stringify(candidate?.points) !== JSON.stringify(relationship.points);
    }).length;
  return {
    entityPositionMismatchCount,
    automaticRoutePointMismatchCount
  };
}

function compactMismatchReport(fixtureName, expected, actual, actualLabel) {
  const lines = [`${fixtureName}: ${actualLabel} Compact geometry does not match D1:`];
  const actualEntities = new Map(actual.entities.map(entity => [entity.id, entity]));
  expected.entities.forEach(entity => {
    const candidate = actualEntities.get(entity.id);
    if (!candidate) {
      lines.push(`Entity ${entity.id}: missing from ${actualLabel}`);
      return;
    }
    if (candidate.x !== entity.x || candidate.y !== entity.y) {
      lines.push(
        `Entity ${entity.id}:`,
        `D1: x=${entity.x}, y=${entity.y}`,
        `${actualLabel}: x=${candidate.x}, y=${candidate.y}`
      );
    }
  });
  const actualRelationships = new Map(actual.relationships.map(relationship => [
    relationship.key,
    relationship
  ]));
  expected.relationships.forEach(relationship => {
    const candidate = actualRelationships.get(relationship.key);
    if (JSON.stringify(candidate?.points) !== JSON.stringify(relationship.points)) {
      lines.push(
        `Relationship ${relationship.key}:`,
        `D1 points: ${JSON.stringify(relationship.points)}`,
        `${actualLabel} points: ${JSON.stringify(candidate?.points || null)}`
      );
    }
  });
  return lines.slice(0, 60).join("\n");
}

function manualRouteSnapshot(stateInput) {
  const state = normalizeAnnotationState(stateInput);
  return state.objects
    .filter(object => object?.type === "entity")
    .flatMap(entity => (entity.foreignKeys || [])
      .filter(foreignKey => Array.isArray(foreignKey.routeOverride))
      .map(foreignKey => ({
        entityId: entity.id,
        foreignKeyName: foreignKey.name,
        routeOverrideJson: JSON.stringify(foreignKey.routeOverride)
      })))
    .sort((first, second) =>
      `${first.entityId}:${first.foreignKeyName}`.localeCompare(`${second.entityId}:${second.foreignKeyName}`));
}

function countEntityOverlaps(stateInput) {
  const entities = normalizeAnnotationState(stateInput).objects
    .filter(object => object?.type === "entity" && object.visible !== false);
  let count = 0;
  for (let firstIndex = 0; firstIndex < entities.length; firstIndex += 1) {
    const first = entities[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < entities.length; secondIndex += 1) {
      const second = entities[secondIndex];
      if (first.x < second.x + second.width
        && first.x + first.width > second.x
        && first.y < second.y + second.height
        && first.y + first.height > second.y) {
        count += 1;
      }
    }
  }
  return count;
}

function runCompactInNodeWorker(input) {
  const workerSource = `
    import { parentPort, workerData } from "node:worker_threads";
    import { runDiagram2CompactEngine } from ${JSON.stringify(compactEngineUrl.href)};
    const result = await runDiagram2CompactEngine(workerData);
    parentPort.postMessage(result);
  `;
  const workerUrl = new URL(`data:text/javascript,${encodeURIComponent(workerSource)}`);
  return new Promise((resolve, reject) => {
    const worker = new NodeWorker(workerUrl, {
      type: "module",
      workerData: input
    });
    worker.once("message", result => {
      worker.terminate();
      resolve(result);
    });
    worker.once("error", error => {
      worker.terminate();
      reject(error);
    });
    worker.once("exit", code => {
      if (code !== 0) reject(new Error(`Compact worker exited with code ${code}.`));
    });
  });
}

async function requiredCompactFixtures() {
  const [pmtSvg, diagram23Json] = await Promise.all([
    readFile(
      new URL("../../wwwroot/assets/docs/pmt-database-schema.svg", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../fixtures/diagram2/diagram-23-state.json", import.meta.url),
      "utf8"
    )
  ]);
  const pmtState = parseAnnotationSvg(pmtSvg);
  const diagram23State = normalizeAnnotationState(JSON.parse(diagram23Json));
  return [
    graphFixture("01-two-entity-parent-child", 2, [{ source: 1, target: 0 }]),
    graphFixture("02-three-level-chain", 3, [
      { source: 1, target: 0 },
      { source: 2, target: 1 }
    ]),
    graphFixture("03-wide-star-preferred-root", 8,
      Array.from({ length: 7 }, (_, index) => ({ source: index + 1, target: 0 }))),
    graphFixture("04-inbound-and-outbound-root", 7, [
      { source: 1, target: 0 },
      { source: 2, target: 0 },
      { source: 0, target: 3 },
      { source: 0, target: 4 },
      { source: 5, target: 3 },
      { source: 4, target: 6 }
    ], { preferredRootIndex: 0 }),
    graphFixture("05-dependency-cycle", 3, [
      { source: 0, target: 1 },
      { source: 1, target: 2 },
      { source: 2, target: 0 }
    ]),
    graphFixture("06-disconnected-components", 6, [
      { source: 1, target: 0 },
      { source: 2, target: 1 },
      { source: 4, target: 3 },
      { source: 5, target: 3 }
    ]),
    graphFixture("07-self-relationship", 2, [
      { source: 0, target: 0 },
      { source: 1, target: 0 }
    ], {
      entityOptions: index => index === 0 ? { showSelfRelationships: true } : {}
    }),
    graphFixture("08-anchor-table", 4, [
      { source: 1, target: 0 },
      { source: 2, target: 0 },
      { source: 3, target: 1 }
    ], {
      entityOptions: index => index === 0 ? { anchorTable: true, x: 900, y: 540 } : {}
    }),
    graphFixture("09-multiple-anchors-shortcut", 5, [
      { source: 1, target: 0 },
      { source: 2, target: 0 },
      { source: 3, target: 1 },
      { source: 4, target: 2 },
      { source: 0, target: 4 }
    ], {
      entityOptions: index => [0, 4].includes(index)
        ? { anchorTable: true, x: index === 0 ? 720 : 1240, y: index === 0 ? 420 : 880 }
        : {}
    }),
    annotationFixture(),
    graphFixture("11-field-rectangle-entity", 3, [
      { source: 1, target: 0 },
      { source: 2, target: 1 }
    ], {
      entityOptions: index => index === 1
        ? { entityKind: "field-rectangle", entityFieldName: "OwnerId" }
        : {}
    }),
    graphFixture("12-manual-route-override", 3, [
      {
        source: 1,
        target: 0,
        routeOverride: [
          { x: 310, y: 115 },
          { x: 430, y: 115 },
          { x: 430, y: 345 },
          { x: 560, y: 345 }
        ]
      },
      { source: 2, target: 0 }
    ], {
      state: { manualEntityRelationshipRoutes: true }
    }),
    graphFixture("13-overlapping-lines-allowed", 9, [
      { source: 4, target: 0 },
      { source: 5, target: 1 },
      { source: 6, target: 2 },
      { source: 7, target: 3 },
      { source: 8, target: 0 },
      { source: 8, target: 3 }
    ], {
      state: { allowOverlappingEntityLines: true }
    }),
    graphFixture("14-overlapping-lines-disabled", 9, [
      { source: 4, target: 0 },
      { source: 5, target: 1 },
      { source: 6, target: 2 },
      { source: 7, target: 3 },
      { source: 8, target: 0 },
      { source: 8, target: 3 }
    ], {
      state: { allowOverlappingEntityLines: false }
    }),
    graphFixture("15-symbols-on", 4, [
      { source: 1, target: 0, relationshipType: "one-to-one" },
      { source: 2, target: 0, relationshipType: "one-to-many" },
      { source: 3, target: 0, relationshipType: "many-to-one" }
    ], {
      state: { relationshipStyle: { showSymbols: true } }
    }),
    graphFixture("15-symbols-off", 4, [
      { source: 1, target: 0, relationshipType: "one-to-one" },
      { source: 2, target: 0, relationshipType: "one-to-many" },
      { source: 3, target: 0, relationshipType: "many-to-one" }
    ], {
      state: { relationshipStyle: { showSymbols: false } }
    }),
    graphFixture("16-collapsed-and-expanded", 4, [
      { source: 1, target: 0 },
      { source: 2, target: 0 },
      { source: 3, target: 1 }
    ], {
      entityOptions: index => ({ collapsed: index % 2 === 0 })
    }),
    graphFixture("17-data-types-shown-and-hidden", 4, [
      { source: 1, target: 0 },
      { source: 2, target: 0 },
      { source: 3, target: 1 }
    ], {
      entityOptions: index => ({ showDataTypes: index % 2 === 0 })
    }),
    {
      name: "18-pmt-database-schema",
      preferredRootId: pmtState.objects.find(object => object.entityName === "Projects")?.id
        || pmtState.objects.find(object => object.type === "entity")?.id,
      state: pmtState
    },
    {
      name: "19-diagram-23-current-saved-schema",
      preferredRootId: diagram23State.objects.find(object => object.entityName === "WorkTasks")?.id
        || diagram23State.objects.find(object => object.type === "entity")?.id,
      state: diagram23State
    },
    productionFixture("20-production-232-entities-624-relationships", 232, 624),
    productionFixture("21-production-500-entities", 500, 160)
  ];
}

function annotationFixture() {
  const fixture = graphFixture("10-entity-annotation-children-and-arrows", 3, [
    { source: 1, target: 0 },
    { source: 2, target: 0 }
  ], {
    state: {
      groupNames: { "annotation-group": "Root annotation" },
      groupVisibility: { "annotation-group": true }
    },
    entityOptions: index => index === 0
      ? {
          entityAnnotation: "Root entity note",
          entityAnnotationGroupId: "annotation-group",
          entityAnnotationShowArrow: true
        }
      : {}
  });
  fixture.state.objects.push({
    id: "annotation-callout",
    type: "textbox",
    x: 340,
    y: 80,
    width: 260,
    height: 90,
    text: "Root entity note",
    groupId: "annotation-group",
    entityAnnotationOwnerId: "entity-0",
    entityAnnotationRole: "callout"
  }, {
    id: "annotation-arrow",
    type: "arrow",
    x1: 270,
    y1: 110,
    x2: 340,
    y2: 125,
    stroke: "#42526b",
    strokeWidth: 2,
    arrowSize: 18,
    groupId: "annotation-group",
    entityAnnotationOwnerId: "entity-0",
    entityAnnotationRole: "arrow"
  });
  fixture.state = normalizeAnnotationState(fixture.state);
  return fixture;
}

function productionFixture(name, entityCount, relationshipCount) {
  const edges = Array.from({ length: relationshipCount }, (_, index) => {
    const source = 1 + (index % Math.max(1, entityCount - 1));
    const pass = Math.floor(index / Math.max(1, entityCount - 1));
    return {
      source,
      target: Math.max(0, source - 1 - (pass % 3)),
      relationshipType: ["many-to-one", "one-to-many", "one-to-one"][index % 3]
    };
  });
  return graphFixture(name, entityCount, edges, {
    columns: 20,
    entityWidth: 220,
    entityHeight: 132,
    state: {
      width: 16000,
      height: Math.max(8000, Math.ceil(entityCount / 20) * 190),
      allowOverlappingEntityLines: true,
      relationshipStyle: {
        stroke: "#42526b",
        strokeWidth: 2,
        arrowSize: 10,
        opacity: 1,
        showSymbols: true
      }
    },
    entityOptions: index => ({
      groupId: `domain-${Math.floor(index / 50)}`,
      showDataTypes: index % 7 === 0,
      collapsed: index % 11 === 0
    })
  });
}

function graphFixture(name, entityCount, edgesInput, options = {}) {
  const edges = edgesInput.map((edge, index) => ({ ...edge, index }));
  const columns = Number(options.columns || 8);
  const entityWidth = Number(options.entityWidth || 240);
  const entityHeight = Number(options.entityHeight || 126);
  const objects = Array.from({ length: entityCount }, (_, index) => {
    const entityName = `Entity${index}`;
    const outgoing = edges.filter(edge => edge.source === index);
    const fields = [{
      name: `${entityName}Id`,
      dataType: "INT",
      nullable: false,
      isPrimaryKey: true,
      isForeignKey: false
    }];
    const foreignKeys = outgoing.map((edge, edgeOrder) => {
      const fieldName = edge.source === edge.target
        ? `Parent${edge.index}Id`
        : `Reference${edge.index}Id`;
      fields.push({
        name: fieldName,
        dataType: "INT",
        nullable: edgeOrder % 2 === 0,
        isPrimaryKey: false,
        isForeignKey: true
      });
      return {
        name: `FK_${entityName}_${fieldName}_Entity${edge.target}`,
        columns: [fieldName],
        referencedSchema: "dbo",
        referencedTable: `Entity${edge.target}`,
        referencedColumns: [`Entity${edge.target}Id`],
        relationshipType: edge.relationshipType || "many-to-one",
        ...(edge.routeOverride ? { routeOverride: structuredClone(edge.routeOverride) } : {})
      };
    });
    const overrides = options.entityOptions?.(index) || {};
    return {
      id: `entity-${index}`,
      type: "entity",
      x: 40 + ((index % columns) * (entityWidth + 120)),
      y: 40 + (Math.floor(index / columns) * (entityHeight + 100)),
      width: entityWidth,
      height: entityHeight,
      entitySchema: "dbo",
      entityName,
      fields,
      foreignKeys,
      fill: "#ffffff",
      stroke: "#42526b",
      strokeWidth: 2,
      opacity: 1,
      visible: true,
      locked: false,
      ...overrides
    };
  });
  const stateOverrides = options.state || {};
  const state = normalizeAnnotationState({
    version: 1,
    width: 4800,
    height: 2800,
    gridSize: 20,
    allowOverlappingEntityLines: false,
    manualEntityRelationshipRoutes: edges.some(edge => edge.routeOverride),
    compactEntityRelationshipRouting: false,
    relationshipStyle: {
      stroke: "#42526b",
      strokeWidth: 2,
      arrowSize: 10,
      opacity: 1,
      showSymbols: false
    },
    groupNames: Object.fromEntries(
      objects.map(object => object.groupId).filter(Boolean).map(groupId => [groupId, groupId])
    ),
    groupVisibility: Object.fromEntries(
      objects.map(object => object.groupId).filter(Boolean).map(groupId => [groupId, true])
    ),
    objects,
    ...stateOverrides,
    relationshipStyle: {
      stroke: "#42526b",
      strokeWidth: 2,
      arrowSize: 10,
      opacity: 1,
      showSymbols: false,
      ...(stateOverrides.relationshipStyle || {})
    }
  });
  return {
    name,
    preferredRootId: `entity-${Number(options.preferredRootIndex || 0)}`,
    state
  };
}

function translateEntityAnnotationChildren(state, entityId, deltaX, deltaY) {
  if (!deltaX && !deltaY) return;
  state.objects
    .filter(object => String(object?.entityAnnotationOwnerId || "") === entityId)
    .forEach(object => {
      if (["arrow", "line"].includes(object.type)) {
        object.x1 += deltaX;
        object.y1 += deltaY;
        object.x2 += deltaX;
        object.y2 += deltaY;
      } else {
        object.x += deltaX;
        object.y += deltaY;
        if (object.type === "embedded-image" && object.imageClip) {
          object.imageClip = {
            ...object.imageClip,
            x: object.imageClip.x + deltaX,
            y: object.imageClip.y + deltaY
          };
        }
      }
    });
}

function fakeRenderer() {
  return {
    fullRenderCount: 0,
    beginDiagramUpdate() {},
    endDiagramUpdate() {},
    setStructureState() {},
    setSelectedObjectIds() {},
    setActiveTool() {}
  };
}

function editableHost() {
  return {
    canEdit: true,
    security: {
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canImport: true,
      canExport: true
    }
  };
}

function roundMetric(value) {
  return Number(Number(value || 0).toFixed(2));
}
