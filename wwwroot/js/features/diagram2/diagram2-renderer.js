import {
  annotationArrowGeometry,
  annotationEntityFieldBounds,
  annotationEntityMetrics,
  annotationEntityFieldSupportsMapping,
  annotationEntityVisibleFields,
  formatAnnotationEntityIdentifier,
  normalizeAnnotationState,
  wrapAnnotationText
} from "../../components/image-annotation.js?v=20260728-diagram-png-raster-v1";
import { normalizeRichHtml } from "../../shared/text-and-links.js?v=20260722-rte-toggle-state-v1";

const svgNamespace = "http://www.w3.org/2000/svg";
const xhtmlNamespace = "http://www.w3.org/1999/xhtml";
const xlinkNamespace = "http://www.w3.org/1999/xlink";
const defaultDiagram2Width = 1600;
const defaultDiagram2Height = 900;
const defaultViewportPadding = 16;
const minimumViewportScale = 0.05;
const maximumViewportScale = 8;
const maximumFitViewportScale = 2;
const allRelationshipsDirtyToken = "*";
const diagram2RoutingSectorSize = 320;
const diagram2ProtectedBoundsPadding = 18;
const diagram2ImpactCorridorPadding = 96;
const diagram2RelationshipGridSize = 20;
const diagram2MinimumRelationshipClearance = 48;
const diagram2ViewportHaloSectorSize = 2048;
const diagram2ViewportHaloSectorCount = 1;
const diagram2ViewportHaloMinimumObjectThreshold = 80;
const diagram2ViewportHaloFullCoverageThreshold = 0.82;
const diagram2DetailLevelDetailed = "detailed";
const diagram2DetailLevelLow = "low";
const diagram2LowDetailEnterRowPixels = 4;
const diagram2LowDetailExitRowPixels = 6;
const diagram2LowDetailMinimumEntityCount = 80;
const diagram2RendererPlanes = [
  ["background", "data-diagram2-background-plane"],
  ["belowRelationships", "data-diagram2-below-relationship-plane"],
  ["relationships", "data-diagram2-relationship-plane"],
  ["objects", "data-diagram2-object-plane"],
  ["overlays", "data-diagram2-overlay-plane"]
];

export function createDiagram2LiveView() {
  return {
    objectNodesById: new Map(),
    relationshipNodesById: new Map(),
    mountedObjectIds: new Set(),
    mountedRelationshipIds: new Set(),
    selectedIds: new Set(),
    objectVersionsById: new Map(),
    relationshipVersionsById: new Map(),
    objectDataById: new Map(),
    relationshipDataById: new Map(),
    objectDetailLevelsById: new Map(),
    relationshipDetailLevelsById: new Map()
  };
}

export function createDiagram2DirtyState() {
  return {
    objectGeometry: new Set(),
    objectStructure: new Set(),
    objectStyle: new Set(),
    objectSelection: new Set(),
    relationshipGeometry: new Set(),
    relationshipStyle: new Set(),
    reasons: new Set(),
    zOrder: false,
    worldBounds: false,
    sectors: false
  };
}

export function createDiagram2FixedGridIndex(sectorSizeInput = diagram2RoutingSectorSize) {
  const sectorSize = Math.max(32, positiveNumber(sectorSizeInput, diagram2RoutingSectorSize));
  const sectors = new Map();
  const keysById = new Map();

  return {
    sectorSize,
    sectors,
    add(id, boundsInput) {
      const objectId = String(id || "").trim();
      const bounds = normalizeBounds(boundsInput);
      if (!objectId || !bounds) return 0;
      this.remove(objectId);
      const keys = fixedGridSectorKeys(bounds, sectorSize);
      keysById.set(objectId, keys);
      keys.forEach(key => {
        if (!sectors.has(key)) sectors.set(key, new Set());
        sectors.get(key).add(objectId);
      });
      return keys.length;
    },
    clear() {
      sectors.clear();
      keysById.clear();
    },
    remove(id) {
      const objectId = String(id || "").trim();
      const keys = keysById.get(objectId);
      if (!keys) return;
      keys.forEach(key => {
        const ids = sectors.get(key);
        ids?.delete(objectId);
        if (ids && !ids.size) sectors.delete(key);
      });
      keysById.delete(objectId);
    },
    query(boundsInput) {
      const bounds = normalizeBounds(boundsInput);
      const ids = new Set();
      if (!bounds) return { ids, sectorKeys: [] };
      const sectorKeys = fixedGridSectorKeys(bounds, sectorSize);
      sectorKeys.forEach(key => {
        sectors.get(key)?.forEach(id => ids.add(id));
      });
      return { ids, sectorKeys };
    }
  };
}

export function normalizeDiagram2CanonicalState(inputState) {
  return normalizeAnnotationState(inputState, {
    width: defaultDiagram2Width,
    height: defaultDiagram2Height,
    objects: []
  });
}

export function diagram2CanonicalSummary(inputState) {
  const canonical = normalizeDiagram2CanonicalState(inputState);
  const relationships = diagram2CanonicalRelationships(canonical);
  return {
    canonicalObjectCount: canonical.objects.length,
    canonicalEntityCount: diagram2CanonicalEntities(canonical).length,
    canonicalRelationshipCount: relationships.length
  };
}

export function diagram2CanonicalRelationships(inputState) {
  const canonical = normalizeDiagram2CanonicalState(inputState);
  if (canonical.hideAllEntityRelationships === true) return [];

  const entities = diagram2CanonicalEntities(canonical);
  const globalRelationshipStyle = canonical.relationshipStyle || {};
  const relationships = [];
  entities.forEach(source => {
    (Array.isArray(source.foreignKeys) ? source.foreignKeys : []).forEach((foreignKeySource, foreignKeyIndex) => {
      const foreignKey = normalizeDiagram2ForeignKey(foreignKeySource);
      if (!foreignKey) return;

      const sourceField = findEntityField(source, foreignKey.columns);
      if (!annotationEntityFieldSupportsMapping(sourceField)) return;

      const target = entities.find(candidate =>
        diagram2EntityMatchesReference(candidate, foreignKey.referencedSchema, foreignKey.referencedTable));
      if (!target || (target === source && source.showSelfRelationships !== true)) return;

      const targetField = findEntityField(target, foreignKey.referencedColumns);
      if (!targetField) return;
      if (annotationEntityVisibleFields(source).indexOf(sourceField) < 0) return;
      if (annotationEntityVisibleFields(target).indexOf(targetField) < 0) return;

      relationships.push({
        id: diagram2RelationshipId(source, sourceField, target, targetField, foreignKey),
        source,
        sourceField,
        target,
        targetField,
        foreignKey,
        foreignKeySource,
        foreignKeyIndex,
        diagram2EffectiveStyle: diagram2EffectiveRelationshipStyle(foreignKeySource, foreignKey, globalRelationshipStyle)
      });
    });
  });
  return relationships;
}

export function diagram2ScreenToWorldPoint(transform, point) {
  const scale = positiveNumber(transform?.scale, 1);
  return {
    x: (finiteNumber(point?.x, 0) - finiteNumber(transform?.translateX, 0)) / scale,
    y: (finiteNumber(point?.y, 0) - finiteNumber(transform?.translateY, 0)) / scale
  };
}

export function diagram2WorldToScreenPoint(transform, point) {
  const scale = positiveNumber(transform?.scale, 1);
  return {
    x: finiteNumber(point?.x, 0) * scale + finiteNumber(transform?.translateX, 0),
    y: finiteNumber(point?.y, 0) * scale + finiteNumber(transform?.translateY, 0)
  };
}

export function diagram2ContentBounds(inputState) {
  const canonical = normalizeDiagram2CanonicalState(inputState);
  const visibleObjects = canonical.objects.filter(object => diagram2ObjectVisible(object, canonical));
  const relationships = diagram2CanonicalRelationships(canonical);
  const routeOptions = relationshipRouteOptions(relationships, canonical);
  let bounds = null;
  visibleObjects.forEach(object => {
    bounds = unionBounds(bounds, diagram2ObjectContentBounds(object));
  });
  relationships.forEach(relationship => {
    const route = relationshipRoute(relationship, routeOptions);
    bounds = unionBounds(bounds, route.bounds);
  });
  return bounds;
}

export function diagram2FitViewportTransform(inputState, viewportInput, options = {}) {
  const state = normalizeDiagram2CanonicalState(inputState);
  const viewport = {
    width: Math.max(1, finiteNumber(viewportInput?.width, defaultDiagram2Width)),
    height: Math.max(1, finiteNumber(viewportInput?.height, defaultDiagram2Height))
  };
  const padding = Math.max(0, finiteNumber(options?.padding, defaultViewportPadding));
  const scaleStep = Math.max(0, finiteNumber(options?.scaleStep, 0));
  const contentBounds = diagram2ContentBounds(state);
  const fitBounds = contentBounds || {
    x: 0,
    y: 0,
    width: positiveNumber(state?.width, defaultDiagram2Width),
    height: positiveNumber(state?.height, defaultDiagram2Height)
  };
  const availableWidth = Math.max(1, viewport.width - (padding * 2));
  const availableHeight = Math.max(1, viewport.height - (padding * 2));
  const rawScale = Math.min(availableWidth / fitBounds.width, availableHeight / fitBounds.height);
  const steppedScale = scaleStep > 0
    ? Math.min(rawScale, Math.round(rawScale / scaleStep) * scaleStep)
    : rawScale;
  const scale = clampNumber(steppedScale, minimumViewportScale, maximumFitViewportScale);
  return {
    scale,
    translateX: ((viewport.width - (fitBounds.width * scale)) / 2) - (fitBounds.x * scale),
    translateY: ((viewport.height - (fitBounds.height * scale)) / 2) - (fitBounds.y * scale)
  };
}

export function diagram2ZoomAtTransform(transform, scaleInput, screenPoint) {
  const current = normalizeViewportTransform(transform);
  const scale = clampNumber(positiveNumber(scaleInput, current.scale), minimumViewportScale, maximumViewportScale);
  const cursor = {
    x: finiteNumber(screenPoint?.x, 0),
    y: finiteNumber(screenPoint?.y, 0)
  };
  const worldPoint = diagram2ScreenToWorldPoint(current, cursor);
  return {
    scale,
    translateX: cursor.x - (worldPoint.x * scale),
    translateY: cursor.y - (worldPoint.y * scale)
  };
}

export function diagram2MatrixText(transform) {
  const normalized = normalizeViewportTransform(transform);
  return `matrix(${formatNumber(normalized.scale)} 0 0 ${formatNumber(normalized.scale)} ${formatNumber(normalized.translateX)} ${formatNumber(normalized.translateY)})`;
}

export function diagram2ObjectPatchFlags(previousObject, nextObject) {
  if (!nextObject) {
    return {
      changed: false,
      created: false,
      typeChanged: false,
      transformChanged: false,
      structureChanged: false,
      styleChanged: false,
      textChanged: false,
      rebuild: false
    };
  }
  if (!previousObject) {
    return {
      changed: true,
      created: true,
      typeChanged: true,
      transformChanged: true,
      structureChanged: true,
      styleChanged: true,
      textChanged: true,
      rebuild: true
    };
  }

  const typeChanged = previousObject.type !== nextObject.type
    || diagram2IsFieldRectangle(previousObject) !== diagram2IsFieldRectangle(nextObject);
  const transformChanged = objectTranslationVersion(previousObject) !== objectTranslationVersion(nextObject);
  const structureChanged = typeChanged || objectStructureVersion(previousObject) !== objectStructureVersion(nextObject);
  const styleChanged = objectStyleVersion(previousObject) !== objectStyleVersion(nextObject);
  const textChanged = objectTextVersion(previousObject) !== objectTextVersion(nextObject);
  return {
    changed: typeChanged
      || transformChanged
      || structureChanged
      || styleChanged
      || textChanged
      || objectVersion(previousObject) !== objectVersion(nextObject),
    created: false,
    typeChanged,
    transformChanged,
    structureChanged,
    styleChanged,
    textChanged,
    rebuild: structureChanged
  };
}

export function diagram2RelationshipPatchFlags(previousRelationship, nextRelationship) {
  if (!nextRelationship) {
    return {
      changed: false,
      created: false,
      routeChanged: false,
      styleChanged: false
    };
  }
  if (!previousRelationship) {
    return {
      changed: true,
      created: true,
      routeChanged: true,
      styleChanged: true
    };
  }
  const routeChanged = relationshipRouteVersion(previousRelationship) !== relationshipRouteVersion(nextRelationship);
  const styleChanged = relationshipStyleVersion(previousRelationship) !== relationshipStyleVersion(nextRelationship);
  return {
    changed: routeChanged || styleChanged || relationshipVersion(previousRelationship) !== relationshipVersion(nextRelationship),
    created: false,
    routeChanged,
    styleChanged
  };
}

export function createDiagram2Renderer({ host, performance: performanceApi = globalThis.performance, onDiagnostics = null, viewportPadding = defaultViewportPadding, fitScaleStep = 0 } = {}) {
  if (!host) throw new Error("Diagram 2 renderer requires a host element.");

  const fitViewportPadding = Math.max(0, finiteNumber(viewportPadding, defaultViewportPadding));
  const fitViewportScaleStep = Math.max(0, finiteNumber(fitScaleStep, 0));
  const liveView = createDiagram2LiveView();
  const dirty = createDiagram2DirtyState();
  const routing = createDiagram2SelectiveRoutingState();
  const viewportHalo = createDiagram2ViewportHaloState();
  const overviewDetail = createDiagram2OverviewDetailState();
  const planes = {};
  const viewportTransform = { scale: 1, translateX: 0, translateY: 0 };
  const committedViewportTransform = { scale: 1, translateX: 0, translateY: 0 };
  let svg = null;
  let viewportPlane = null;
  let canonicalState = null;
  let fullRenderCount = 0;
  let fullRenderReason = "";
  let frameSequence = 0;
  let zoomMode = "fit";
  let relationshipRouteRevision = 0;
  let transactionDepth = 0;
  let pendingDiagramFlushFrame = 0;
  let dirtyFlushCount = 0;
  let pendingFlushResolvers = [];
  let activeGeometryPreview = null;
  let pendingGeometryPreviewFrame = 0;
  let geometryPreviewFrameCount = 0;
  let geometryPreviewCommitCount = 0;
  let geometryPreviewUndoEntryCount = 0;
  let pendingViewportFrame = 0;
  let pendingViewportGesture = null;
  let destroyed = false;
  let lastViewportReason = "";
  let lastTransformDiagnostics = emptyTransformDiagnostics();
  let lastDirtyDiagnostics = emptyDirtyFlushDiagnostics();
  let lastGeometryPreviewDiagnostics = emptyGeometryPreviewDiagnostics();
  let lastSelectiveRoutingDiagnostics = emptySelectiveRoutingDiagnostics();
  let lastViewportHaloDiagnostics = emptyViewportHaloDiagnostics();
  let lastOverviewDetailDiagnostics = emptyOverviewDetailDiagnostics();
  let lastDiagnostics = emptyDiagnostics();
  let pendingSelectiveRoutingSectorsQueried = 0;
  let canvasOptions = {
    gridVisible: false,
    snapToGrid: false,
    gridSize: 20
  };

  function render(inputState, options = {}) {
    const reason = String(options.reason || "initial").trim() || "initial";
    const frameId = `diagram2-renderer-${++frameSequence}`;
    const startTime = now(performanceApi);
    mark(performanceApi, `${frameId}:start`);

    canonicalState = normalizeDiagram2CanonicalState(inputState);
    clearDirtyState(dirty);
    clearGeometryPreview({ restoreObjects: false, reason: "full render" });
    const visibleObjects = canonicalState.objects.filter(object => object.visible !== false);
    const relationships = diagram2CanonicalRelationships(canonicalState);
    mark(performanceApi, `${frameId}:canonical`);

    ensureSvg();
    applySvgMetrics(canonicalState);
    patchBackgroundPlane(canonicalState);
    mark(performanceApi, `${frameId}:planes`);

    const objectsPatched = patchObjects(visibleObjects);
    rebuildRoutingObjectIndexes(visibleObjects);
    mark(performanceApi, `${frameId}:objects`);

    rebuildRelationshipLookupIndexes(relationships);
    const relationshipResult = patchRelationships(relationships);
    const relationshipsRouted = relationshipResult.routed;
    rebuildViewportHaloIndexes(visibleObjects, relationships);
    viewportHalo.active = false;
    viewportHalo.sectorSignature = "";
    viewportHalo.forceSignature = "";
    viewportHalo.canonicalObjectCount = visibleObjects.length;
    viewportHalo.canonicalRelationshipCount = relationships.length;
    viewportHalo.objectIds = new Set(visibleObjects.map(object => object.id));
    viewportHalo.relationshipIds = new Set(relationships.map(relationship => relationship.id));
    const overviewDetailResult = reconcileOverviewDetailLevel("full render");
    mark(performanceApi, `${frameId}:relationships`);

    fullRenderCount += 1;
    fullRenderReason = reason;
    const endTime = now(performanceApi);
    mark(performanceApi, `${frameId}:end`);
    measure(performanceApi, "diagram2-renderer canonical", `${frameId}:start`, `${frameId}:canonical`);
    measure(performanceApi, "diagram2-renderer planes", `${frameId}:canonical`, `${frameId}:planes`);
    measure(performanceApi, "diagram2-renderer objects", `${frameId}:planes`, `${frameId}:objects`);
    measure(performanceApi, "diagram2-renderer relationships", `${frameId}:objects`, `${frameId}:relationships`);
    measure(performanceApi, "diagram2-renderer frame", `${frameId}:start`, `${frameId}:end`);

    lastDiagnostics = diagnosticsFor({
      canonicalState,
      relationships,
      fullRenderCount,
      fullRenderReason,
      objectsPatchedInLastFlush: objectsPatched,
      relationshipsRoutedInLastFlush: relationshipsRouted,
      mountedObjectCount: liveView.mountedObjectIds.size,
      mountedRelationshipCount: liveView.mountedRelationshipIds.size,
      lastFrameDuration: Math.max(0, endTime - startTime)
    });
    lastDirtyDiagnostics = emptyDirtyFlushDiagnostics();
    lastGeometryPreviewDiagnostics = emptyGeometryPreviewDiagnostics();
    lastSelectiveRoutingDiagnostics = relationshipResult.diagnostics;
    lastViewportHaloDiagnostics = emptyViewportHaloDiagnostics({
      reason: "full render",
      fallbackReason: "full render",
      objectCount: visibleObjects.length,
      relationshipCount: relationships.length,
      mountedObjectCount: liveView.mountedObjectIds.size,
      mountedRelationshipCount: liveView.mountedRelationshipIds.size
    });
    Object.assign(
      lastDiagnostics,
      lastTransformDiagnostics,
      lastDirtyDiagnostics,
      lastGeometryPreviewDiagnostics,
      lastSelectiveRoutingDiagnostics,
      lastViewportHaloDiagnostics,
      overviewDetailResult.diagnostics
    );
    lastDiagnostics.svgDescendantCount = svg.querySelectorAll("*").length;
    applyDiagnosticsAttributes();
    notifyDiagnostics();
    return diagnostics();
  }

  function fit() {
    zoomMode = "fit";
    if (canonicalState) {
      queueViewportTransform(fitViewportTransform(canonicalState, viewportSize()), {
        reason: "fit",
        cursorScreenPoint: viewportCenterPoint(),
        worldPointUnderCursor: null
      });
    }
    return diagnostics();
  }

  function setZoom(value) {
    zoomMode = normalizeZoomMode(value);
    if (zoomMode === "fit") return fit();
    queueViewportTransform(zoomToScale(Number(zoomMode), viewportCenterPoint()), {
      reason: "toolbar zoom",
      cursorScreenPoint: viewportCenterPoint(),
      worldPointUnderCursor: null
    });
    return diagnostics();
  }

  function zoomBy(deltaScale, point = {}) {
    const nextScale = viewportTransform.scale * positiveNumber(deltaScale, 1);
    const cursorScreenPoint = localScreenPoint(point);
    queueViewportTransform(zoomToScale(nextScale, cursorScreenPoint), {
      reason: "wheel zoom",
      cursorScreenPoint,
      worldPointUnderCursor: diagram2ScreenToWorldPoint(viewportTransform, cursorScreenPoint)
    });
    return diagnostics();
  }

  function panBy(deltaX, deltaY) {
    const next = {
      scale: viewportTransform.scale,
      translateX: viewportTransform.translateX + finiteNumber(deltaX, 0),
      translateY: viewportTransform.translateY + finiteNumber(deltaY, 0)
    };
    queueViewportTransform(next, {
      reason: "pan",
      cursorScreenPoint: viewportCenterPoint(),
      worldPointUnderCursor: null
    });
    return diagnostics();
  }

  function addObject(objectInput = {}) {
    if (!canonicalState) return diagnostics();
    const objectId = String(objectInput?.id || "").trim();
    if (!objectId) return diagnostics();
    if (canonicalState.objects.some(object => object.id === objectId)) {
      return updateObject(objectId, objectInput);
    }

    const nextState = normalizeDiagram2CanonicalState({
      ...canonicalState,
      objects: canonicalState.objects.concat({ ...objectInput, id: objectId })
    });
    const nextObject = nextState.objects.find(object => object.id === objectId);
    if (!nextObject) return diagnostics();

    canonicalState = nextState;
    dirty.objectStructure.add(objectId);
    const impact = impactedRelationshipIdsForObjectGeometry(objectId, null, nextObject);
    pendingSelectiveRoutingSectorsQueried += impact.sectorsQueried;
    impact.relationshipIds.forEach(relationshipId => dirty.relationshipGeometry.add(relationshipId));
    dirty.worldBounds = true;
    dirty.sectors = true;
    return scheduleDiagramFlush("object add");
  }

  function addObjects(objectsInput = [], options = {}) {
    if (!canonicalState) return diagnostics();
    const existingIds = new Set(canonicalState.objects.map(object => object.id));
    const objects = (Array.isArray(objectsInput) ? objectsInput : [objectsInput])
      .filter(object => object && typeof object === "object")
      .map(object => ({ ...object, id: String(object.id || "").trim() }))
      .filter(object => object.id && !existingIds.has(object.id));
    if (!objects.length) return diagnostics();

    const nextObjects = canonicalState.objects.slice();
    const indexesById = options.indexesById instanceof Map ? options.indexesById : null;
    objects.forEach(object => {
      const requestedIndex = Number(indexesById?.get(object.id));
      const index = Number.isInteger(requestedIndex)
        ? Math.max(0, Math.min(nextObjects.length, requestedIndex))
        : nextObjects.length;
      nextObjects.splice(index, 0, object);
    });
    canonicalState = normalizeDiagram2CanonicalState({
      ...canonicalState,
      objects: nextObjects
    });
    objects.forEach(object => dirty.objectStructure.add(object.id));
    dirty.relationshipGeometry.add(allRelationshipsDirtyToken);
    dirty.worldBounds = true;
    dirty.sectors = true;
    dirty.zOrder = indexesById instanceof Map;
    return scheduleDiagramFlush(options.reason || "object batch add");
  }

  function removeObject(id) {
    if (!canonicalState) return diagnostics();
    const objectId = String(id || "").trim();
    const previousObject = canonicalState.objects.find(object => object.id === objectId);
    if (!previousObject) return diagnostics();

    const impact = impactedRelationshipIdsForObjectGeometry(objectId, previousObject, null);
    canonicalState = normalizeDiagram2CanonicalState({
      ...canonicalState,
      objects: canonicalState.objects.filter(object => object.id !== objectId)
    });
    liveView.selectedIds.delete(objectId);
    dirty.objectStructure.add(objectId);
    dirty.objectSelection.add(objectId);
    pendingSelectiveRoutingSectorsQueried += impact.sectorsQueried;
    impact.relationshipIds.forEach(relationshipId => dirty.relationshipGeometry.add(relationshipId));
    dirty.worldBounds = true;
    dirty.sectors = true;
    return scheduleDiagramFlush("object remove");
  }

  function removeObjects(idsInput = [], options = {}) {
    if (!canonicalState) return diagnostics();
    const ids = new Set((Array.isArray(idsInput) ? idsInput : [idsInput])
      .map(id => String(id || "").trim())
      .filter(Boolean));
    const existingIds = canonicalState.objects
      .filter(object => ids.has(object.id))
      .map(object => object.id);
    if (!existingIds.length) return diagnostics();

    canonicalState = normalizeDiagram2CanonicalState({
      ...canonicalState,
      objects: canonicalState.objects.filter(object => !ids.has(object.id))
    });
    existingIds.forEach(id => {
      liveView.selectedIds.delete(id);
      dirty.objectStructure.add(id);
      dirty.objectSelection.add(id);
    });
    dirty.relationshipGeometry.add(allRelationshipsDirtyToken);
    dirty.worldBounds = true;
    dirty.sectors = true;
    return scheduleDiagramFlush(options.reason || "object batch remove");
  }

  function setObjectOrder(idsInput = [], options = {}) {
    if (!canonicalState) return diagnostics();
    const requestedOrder = [...new Set((Array.isArray(idsInput) ? idsInput : [idsInput])
      .map(id => String(id || "").trim())
      .filter(Boolean))];
    const objectsById = new Map(canonicalState.objects.map(object => [object.id, object]));
    if (requestedOrder.length !== canonicalState.objects.length
      || requestedOrder.some(id => !objectsById.has(id))) return diagnostics();
    if (requestedOrder.every((id, index) => canonicalState.objects[index]?.id === id)) return diagnostics();

    canonicalState = {
      ...canonicalState,
      objects: requestedOrder.map(id => objectsById.get(id))
    };
    dirty.zOrder = true;
    return scheduleDiagramFlush(options.reason || "object order");
  }

  function updateObject(id, patchInput = {}) {
    if (!canonicalState) return diagnostics();
    const objectId = String(id || "");
    const index = canonicalState.objects.findIndex(object => object.id === objectId);
    if (index < 0) return diagnostics();

    const previousObject = canonicalState.objects[index];
    const patch = typeof patchInput === "function"
      ? patchInput({ ...previousObject })
      : patchInput;
    const nextCandidate = {
      ...previousObject,
      ...(patch && typeof patch === "object" ? patch : {}),
      id: objectId
    };
    const nextState = normalizeDiagram2CanonicalState({
      ...canonicalState,
      objects: canonicalState.objects.map((object, objectIndex) =>
        objectIndex === index ? nextCandidate : object)
    });
    const nextObject = nextState.objects.find(object => object.id === objectId);
    canonicalState = nextState;

    const renderedObject = liveView.objectDataById.get(objectId) || previousObject;
    const flags = diagram2ObjectPatchFlags(renderedObject, nextObject);
    markObjectDirty(objectId, flags, renderedObject, nextObject);
    return scheduleDiagramFlush("object update");
  }

  function setSelectedIds(ids = []) {
    const previousSelection = new Set(liveView.selectedIds);
    liveView.selectedIds.clear();
    (Array.isArray(ids) ? ids : [ids])
      .map(id => String(id || "").trim())
      .filter(Boolean)
      .forEach(id => liveView.selectedIds.add(id));

    previousSelection.forEach(id => markSelectionDirty(id));
    liveView.selectedIds.forEach(id => markSelectionDirty(id));
    return scheduleDiagramFlush("selection");
  }

  function setCanvasOptions(options = {}) {
    canvasOptions = {
      gridVisible: options.gridVisible === true,
      snapToGrid: options.snapToGrid === true,
      gridSize: positiveNumber(options.gridSize, canvasOptions.gridSize || 20)
    };
    if (canonicalState) {
      canonicalState = {
        ...canonicalState,
        gridVisible: canvasOptions.gridVisible,
        snapToGrid: canvasOptions.snapToGrid,
        gridSize: canvasOptions.gridSize
      };
    }
    if (svg && canonicalState) patchBackgroundPlane(canonicalState);
    return { ...canvasOptions };
  }

  function objectIdsInBounds(boundsInput) {
    if (!canonicalState) return [];
    const bounds = normalizedSelectionBounds(boundsInput);
    if (!bounds) return [];
    const indexed = viewportHalo.objectSectorIndex.query(bounds);
    const objectsById = new Map(canonicalState.objects.map(object => [object.id, object]));
    return [...indexed.ids].filter(id => {
      const object = objectsById.get(id);
      return object
        && object.visible !== false
        && boundsIntersect(diagram2ObjectContentBounds(object), bounds);
    });
  }

  function previewMarquee(boundsInput) {
    if (!planes.overlays) return [];
    const bounds = normalizedSelectionBounds(boundsInput);
    let marquee = planes.overlays.querySelector(":scope > rect[data-diagram2-marquee]");
    if (!bounds) {
      marquee?.remove();
      return [];
    }
    if (!marquee) {
      marquee = createSvgElement(host, "rect", {
        "data-diagram2-marquee": "",
        class: "diagram2-renderer-marquee"
      });
      planes.overlays.appendChild(marquee);
    }
    setSvgAttributes(marquee, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    return objectIdsInBounds(bounds);
  }

  function clearMarquee() {
    planes.overlays?.querySelector(":scope > rect[data-diagram2-marquee]")?.remove();
  }

  function beginGeometryPreview(options = {}) {
    if (!canonicalState || !svg) return diagnostics();
    clearGeometryPreview({ restoreObjects: true, reason: "preview replace" });

    const objectIds = geometryPreviewObjectIds(options);
    if (!objectIds.length) return diagnostics();
    const originalObjectsById = new Map();
    objectIds.forEach(id => {
      const object = canonicalState.objects.find(candidate => candidate.id === id && candidate.visible !== false);
      if (object) originalObjectsById.set(id, cloneDiagram2Value(object));
    });
    if (!originalObjectsById.size) return diagnostics();

    const relationshipIds = connectedRelationshipIds([...originalObjectsById.keys()]);
    const relationships = diagram2CanonicalRelationships(canonicalState);
    const routeOptions = relationshipRouteOptions(relationships, canonicalState);
    const relationshipsById = new Map(relationships.map(relationship => [relationship.id, relationship]));
    const settledRoutesById = new Map(relationshipIds.map(id => {
      const relationship = relationshipsById.get(id);
      return [id, relationship ? relationshipRoute(relationship, routeOptions).path : ""];
    }));
    activeGeometryPreview = {
      id: `diagram2-geometry-preview-${Date.now()}-${geometryPreviewFrameCount + 1}`,
      mode: String(options.mode || "move") === "resize" ? "resize" : "move",
      objectIds: [...originalObjectsById.keys()],
      selectedObjectIds: [...liveView.selectedIds].filter(id => liveView.objectNodesById.has(id)),
      relationshipIds,
      originalObjectsById,
      settledRoutesById,
      initialViewportMatrix: { ...viewportTransform },
      latestGeometry: emptyPreviewGeometry(),
      previewObjectsById: new Map(originalObjectsById),
      frameCount: 0,
      previewRelationshipCount: 0,
      patchedObjectCount: 0,
      committing: false
    };

    setGeometryPreviewRelationshipsHidden(activeGeometryPreview, true);
    bringPreviewObjectsForward(activeGeometryPreview.objectIds);
    activeGeometryPreview.objectIds.forEach(id => {
      liveView.objectNodesById.get(id)?.classList.add("is-previewing");
    });
    updateGeometryPreviewDiagnostics("preview start", 0, 0);
    applyDiagnosticsAttributes();
    notifyDiagnostics();
    return diagnostics();
  }

  function previewGeometry(input = {}) {
    if (!activeGeometryPreview) return diagnostics();
    activeGeometryPreview.latestGeometry = normalizePreviewGeometry(input, activeGeometryPreview.latestGeometry);
    return scheduleGeometryPreviewFrame("preview move");
  }

  function commitGeometryPreview(input = {}) {
    if (!activeGeometryPreview) return diagnostics();
    if (Object.keys(input || {}).length > 0) {
      activeGeometryPreview.latestGeometry = normalizePreviewGeometry(input, activeGeometryPreview.latestGeometry);
    }
    applyGeometryPreviewFrame("preview commit");

    const preview = activeGeometryPreview;
    preview.committing = true;
    geometryPreviewCommitCount += 1;
    geometryPreviewUndoEntryCount += 1;
    beginDiagramUpdate("geometry preview commit");
    preview.objectIds.forEach(id => {
      const nextObject = preview.previewObjectsById.get(id);
      if (nextObject) updateObject(id, nextObject);
    });
    endDiagramUpdate("geometry preview commit");
    updateGeometryPreviewDiagnostics("preview commit", preview.patchedObjectCount, preview.previewRelationshipCount);
    return diagnostics();
  }

  function cancelGeometryPreview() {
    if (!activeGeometryPreview) return diagnostics();
    clearGeometryPreview({ restoreObjects: true });
    updateGeometryPreviewDiagnostics("preview cancel", 0, 0);
    applyDiagnosticsAttributes();
    notifyDiagnostics();
    return diagnostics();
  }

  function beginDiagramUpdate(reason = "update") {
    transactionDepth += 1;
    addDirtyReason(reason);
    return diagnostics();
  }

  function endDiagramUpdate(reason = "update") {
    if (transactionDepth > 0) transactionDepth -= 1;
    addDirtyReason(reason);
    if (transactionDepth === 0) scheduleDiagramFlush(reason);
    return diagnostics();
  }

  function scheduleDiagramFlush(reason = "scheduled") {
    addDirtyReason(reason);
    if (!dirtyStateHasChanges(dirty) || transactionDepth > 0) return diagnostics();
    if (pendingDiagramFlushFrame) return diagnostics();

    const requestFrame = globalThis.requestAnimationFrame || (callback => globalThis.setTimeout(callback, 16));
    pendingDiagramFlushFrame = requestFrame(() => {
      pendingDiagramFlushFrame = 0;
      if (destroyed) {
        resolvePendingFlushes();
        return;
      }
      flushDiagramChanges(reason);
    });
    lastDirtyDiagnostics = {
      ...lastDirtyDiagnostics,
      pendingDiagramFlush: true,
      transactionDepth
    };
    Object.assign(lastDiagnostics, lastDirtyDiagnostics);
    applyDiagnosticsAttributes();
    return diagnostics();
  }

  function flushDiagramChanges(reason = "manual") {
    if (!canonicalState || !svg) {
      clearDirtyState(dirty);
      resolvePendingFlushes();
      return diagnostics();
    }
    if (!dirtyStateHasChanges(dirty)) {
      resolvePendingFlushes();
      return diagnostics();
    }

    const frameId = `diagram2-dirty-flush-${++frameSequence}`;
    const startTime = now(performanceApi);
    mark(performanceApi, `${frameId}:start`);
    const relationships = diagram2CanonicalRelationships(canonicalState);
    rebuildRelationshipLookupIndexes(relationships);
    const dirtySnapshot = dirtyDiagnosticsSnapshot(dirty, relationships);
    const patchedObjectIds = new Set();
    const patchedRelationshipIds = new Set();
    const routingMetrics = createSelectiveRoutingMetrics(relationships.length);
    let objectPatchCount = 0;
    let patchedNodeCount = 0;
    let routedRelationshipCount = 0;

    const patchObjectSet = ids => {
      ids.forEach(id => {
        if (patchedObjectIds.has(id)) return;
        const result = patchDirtyObject(id);
        patchedObjectIds.add(id);
        objectPatchCount += result;
        patchedNodeCount += result;
      });
    };

    patchObjectSet(dirty.objectStructure);
    patchObjectSet(dirty.objectGeometry);

    const relationshipGeometry = dirtyRelationshipSet(dirty.relationshipGeometry, relationships);
    const geometryResult = patchDirtyRelationships(relationships, relationshipGeometry, patchedRelationshipIds, {
      mode: "geometry",
      sectorsQueried: pendingSelectiveRoutingSectorsQueried
    });
    mergeSelectiveRoutingMetrics(routingMetrics, geometryResult.diagnostics);
    patchedNodeCount += geometryResult.patched;
    routedRelationshipCount += geometryResult.routed;

    const styleRelationshipIds = dirtyRelationshipSet(dirty.relationshipStyle, relationships);
    const styleResult = patchDirtyRelationships(relationships, styleRelationshipIds, patchedRelationshipIds, {
      mode: "style",
      countRouting: false,
      styleOnly: true
    });
    mergeSelectiveRoutingMetrics(routingMetrics, styleResult.diagnostics);
    patchedNodeCount += styleResult.patched;
    routedRelationshipCount += styleResult.routed;
    pendingSelectiveRoutingSectorsQueried = 0;

    patchObjectSet(dirty.objectStyle);
    patchedNodeCount += patchSelectionTargets(dirty.objectSelection);
    reconcileMountedRelationshipIds(relationships);
    if (dirty.zOrder) reconcileObjectOrder(canonicalState.objects.filter(object => object.visible !== false));
    patchSelectionOverlays();
    const viewportHaloResult = viewportHalo.active
      ? reconcileViewportHalo("dirty flush", { allowSameSectorNoop: false })
      : null;
    if (viewportHaloResult) {
      objectPatchCount += viewportHaloResult.objectPatchCount;
      patchedNodeCount += viewportHaloResult.objectPatchCount + viewportHaloResult.relationshipPatchCount;
      routedRelationshipCount += viewportHaloResult.routedRelationshipCount;
      mergeSelectiveRoutingMetrics(routingMetrics, viewportHaloResult.selectiveDiagnostics);
    }
    const overviewDetailResult = reconcileOverviewDetailLevel("dirty flush");
    objectPatchCount += overviewDetailResult.objectPatchCount;
    patchedNodeCount += overviewDetailResult.objectPatchCount + overviewDetailResult.relationshipPatchCount;

    const endTime = now(performanceApi);
    mark(performanceApi, `${frameId}:end`);
    measure(performanceApi, "diagram2 dirty flush", `${frameId}:start`, `${frameId}:end`);
    dirtyFlushCount += 1;
    lastDirtyDiagnostics = {
      dirtyFlushReason: dirtyReasonText(dirty, reason),
      dirtyObjectIds: dirtySnapshot.objectIds,
      dirtyRelationshipIds: dirtySnapshot.relationshipIds,
      patchedNodeCount,
      routedRelationshipCount,
      lastFlushDuration: Math.round(Math.max(0, endTime - startTime) * 100) / 100,
      dirtyFlushCount,
      pendingDiagramFlush: false,
      transactionDepth
    };
    lastSelectiveRoutingDiagnostics = selectiveRoutingDiagnosticsFromMetrics(routingMetrics);
    clearDirtyState(dirty);
    lastDiagnostics = diagnosticsFor({
      canonicalState,
      relationships,
      fullRenderCount,
      fullRenderReason,
      objectsPatchedInLastFlush: objectPatchCount,
      relationshipsRoutedInLastFlush: routedRelationshipCount,
      mountedObjectCount: liveView.mountedObjectIds.size,
      mountedRelationshipCount: liveView.mountedRelationshipIds.size,
      lastFrameDuration: lastDirtyDiagnostics.lastFlushDuration
    });
    if (activeGeometryPreview?.committing) clearGeometryPreview({ restoreObjects: false, reason: "preview commit" });
    Object.assign(
      lastDiagnostics,
      lastTransformDiagnostics,
      lastDirtyDiagnostics,
      lastGeometryPreviewDiagnostics,
      lastSelectiveRoutingDiagnostics,
      lastViewportHaloDiagnostics,
      lastOverviewDetailDiagnostics
    );
    lastDiagnostics.svgDescendantCount = svg.querySelectorAll("*").length;
    applyDiagnosticsAttributes();
    notifyDiagnostics();
    resolvePendingFlushes();
    return diagnostics();
  }

  function whenIdle() {
    if (!pendingDiagramFlushFrame && !pendingGeometryPreviewFrame && !dirtyStateHasChanges(dirty)) {
      return Promise.resolve(diagnostics());
    }
    return new Promise(resolve => {
      pendingFlushResolvers.push(resolve);
    });
  }

  function resolvePendingFlushes() {
    const resolvers = pendingFlushResolvers.splice(0);
    if (!resolvers.length) return;
    const snapshot = diagnostics();
    resolvers.forEach(resolve => resolve(snapshot));
  }

  function diagnostics() {
    return { ...lastDiagnostics };
  }

  function liveViewSnapshot() {
    return {
      objectNodeCount: liveView.objectNodesById.size,
      relationshipNodeCount: liveView.relationshipNodesById.size,
      mountedObjectIds: [...liveView.mountedObjectIds],
      mountedRelationshipIds: [...liveView.mountedRelationshipIds],
      selectedIds: [...liveView.selectedIds],
      objectVersionCount: liveView.objectVersionsById.size,
      relationshipVersionCount: liveView.relationshipVersionsById.size,
      objectDataCount: liveView.objectDataById.size,
      relationshipDataCount: liveView.relationshipDataById.size,
      dirtyObjectIds: sortedDirtyIds([
        ...dirty.objectStructure,
        ...dirty.objectGeometry,
        ...dirty.objectStyle,
        ...dirty.objectSelection
      ]),
      dirtyRelationshipIds: sortedDirtyIds([
        ...dirty.relationshipGeometry,
        ...dirty.relationshipStyle
      ]),
      relationshipEntityIndexCount: routing.relationshipIdsByEntityId.size,
      relationshipFieldAnchorIndexCount: routing.relationshipIdsByFieldAnchor.size,
      relationshipBoundsIndexCount: routing.relationshipBoundsById.size,
      relationshipRouteSectorCount: routing.relationshipRouteSectorIndex.sectors.size,
      routingObstacleSectorCount: routing.routingObstacleSectorIndex.sectors.size,
      viewportHaloActive: viewportHalo.active,
      viewportHaloSectorSignature: viewportHalo.sectorSignature,
      viewportHaloObjectSectorCount: viewportHalo.objectSectorIndex.sectors.size,
      viewportHaloRelationshipSectorCount: viewportHalo.relationshipSectorIndex.sectors.size,
      viewportHaloObjectIds: [...viewportHalo.objectIds],
      viewportHaloRelationshipIds: [...viewportHalo.relationshipIds],
      overviewDetailLevel: overviewDetail.level,
      overviewDetailObjectLevelCount: liveView.objectDetailLevelsById.size,
      overviewDetailRelationshipLevelCount: liveView.relationshipDetailLevelsById.size,
      pendingDiagramFlush: pendingDiagramFlushFrame !== 0,
      transactionDepth
    };
  }

  function svgNode() {
    return svg;
  }

  function destroy() {
    destroyed = true;
    cancelDiagram2Frame(pendingDiagramFlushFrame);
    cancelDiagram2Frame(pendingGeometryPreviewFrame);
    cancelDiagram2Frame(pendingViewportFrame);
    pendingDiagramFlushFrame = 0;
    pendingGeometryPreviewFrame = 0;
    pendingViewportFrame = 0;
    pendingViewportGesture = null;
    clearGeometryPreview({ restoreObjects: false, reason: "destroy" });
    clearMarquee();
    clearDirtyState(dirty);
    transactionDepth = 0;
    pendingSelectiveRoutingSectorsQueried = 0;
    clearDiagram2LiveView(liveView);
    clearDiagram2RoutingState(routing);
    clearDiagram2ViewportHaloState(viewportHalo);
    overviewDetail.level = diagram2DetailLevelDetailed;
    Object.keys(planes).forEach(key => {
      planes[key] = null;
    });
    host.replaceChildren();
    svg = null;
    viewportPlane = null;
    canonicalState = null;
    lastDiagnostics = emptyDiagnostics();
    lastDirtyDiagnostics = emptyDirtyFlushDiagnostics();
    lastGeometryPreviewDiagnostics = emptyGeometryPreviewDiagnostics();
    lastSelectiveRoutingDiagnostics = emptySelectiveRoutingDiagnostics();
    lastViewportHaloDiagnostics = emptyViewportHaloDiagnostics();
    lastOverviewDetailDiagnostics = emptyOverviewDetailDiagnostics();
    resolvePendingFlushes();
  }

  function viewportMatrix() {
    return { ...viewportTransform };
  }

  function screenToWorld(point) {
    return diagram2ScreenToWorldPoint(viewportTransform, localScreenPoint(point));
  }

  function worldToScreen(point) {
    return diagram2WorldToScreenPoint(viewportTransform, point);
  }

  function ensureSvg() {
    if (svg?.isConnected && svg.parentElement === host) return svg;

    const ownerDocument = host.ownerDocument || globalThis.document;
    if (!ownerDocument) throw new Error("Diagram 2 renderer requires a DOM document.");

    svg = host.querySelector(":scope > svg[data-diagram2-svg]");
    if (!svg) {
      svg = ownerDocument.createElementNS(svgNamespace, "svg");
      svg.setAttribute("data-diagram2-svg", "");
      svg.classList.add("diagram2-renderer-svg");
      host.replaceChildren(svg);
    }

    svg.setAttribute("xmlns", svgNamespace);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Diagram 2 live renderer preview");
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    viewportPlane = svg.querySelector(":scope > g[data-diagram2-viewport-plane]");
    if (!viewportPlane) {
      viewportPlane = ownerDocument.createElementNS(svgNamespace, "g");
      viewportPlane.setAttribute("data-diagram2-viewport-plane", "");
      svg.appendChild(viewportPlane);
    }
    diagram2RendererPlanes.forEach(([key, attribute]) => {
      let plane = viewportPlane.querySelector(`:scope > g[${attribute}]`) || svg.querySelector(`:scope > g[${attribute}]`);
      if (!plane) {
        plane = ownerDocument.createElementNS(svgNamespace, "g");
        plane.setAttribute(attribute, "");
      }
      planes[key] = plane;
      viewportPlane.appendChild(plane);
    });
    setSvgAttributes(viewportPlane, {
      transform: diagram2MatrixText(viewportTransform)
    });
    return svg;
  }

  function applySvgMetrics(state) {
    const width = positiveNumber(state.width, defaultDiagram2Width);
    const height = positiveNumber(state.height, defaultDiagram2Height);
    const viewport = viewportSize();
    svg.setAttribute("viewBox", `0 0 ${formatNumber(viewport.width)} ${formatNumber(viewport.height)}`);
    svg.setAttribute("width", formatNumber(viewport.width));
    svg.setAttribute("height", formatNumber(viewport.height));
    svg.dataset.diagram2Width = String(width);
    svg.dataset.diagram2Height = String(height);
    svg.dataset.diagram2ViewportWidth = String(viewport.width);
    svg.dataset.diagram2ViewportHeight = String(viewport.height);
  }

  function patchBackgroundPlane(state) {
    let definitions = planes.background.querySelector(":scope > defs[data-diagram2-background-definitions]");
    if (!definitions) {
      definitions = createSvgElement(host, "defs", { "data-diagram2-background-definitions": "" });
      planes.background.prepend(definitions);
    }
    let background = planes.background.querySelector(":scope > rect[data-diagram2-background]");
    if (!background) {
      background = createSvgElement(host, "rect", { "data-diagram2-background": "" });
      planes.background.appendChild(background);
    }
    const gridSize = positiveNumber(state.gridSize, canvasOptions.gridSize || 20);
    const gridVisible = state.gridVisible === true || canvasOptions.gridVisible === true;
    setSvgAttributes(background, {
      x: 0,
      y: 0,
      width: positiveNumber(state.width, defaultDiagram2Width),
      height: positiveNumber(state.height, defaultDiagram2Height),
      fill: state.backgroundFill || "#ffffff"
    });

    let gridPattern = definitions.querySelector(":scope > pattern[data-diagram2-grid-pattern]");
    let grid = planes.background.querySelector(":scope > rect[data-diagram2-grid]");
    if (!gridVisible) {
      gridPattern?.remove();
      grid?.remove();
      return;
    }
    if (!gridPattern) {
      gridPattern = createSvgElement(host, "pattern", {
        id: "diagram2-editor-grid-pattern",
        "data-diagram2-grid-pattern": "",
        patternUnits: "userSpaceOnUse"
      });
      definitions.appendChild(gridPattern);
    }
    setSvgAttributes(gridPattern, {
      width: gridSize,
      height: gridSize
    });
    let gridPath = gridPattern.querySelector(":scope > path");
    if (!gridPath) {
      gridPath = createSvgElement(host, "path");
      gridPattern.appendChild(gridPath);
    }
    setSvgAttributes(gridPath, {
      d: `M ${formatNumber(gridSize)} 0 L 0 0 0 ${formatNumber(gridSize)}`,
      fill: "none",
      stroke: "#d7dde5",
      "stroke-width": 1,
      "vector-effect": "non-scaling-stroke"
    });
    if (!grid) {
      grid = createSvgElement(host, "rect", {
        "data-diagram2-grid": "",
        "pointer-events": "none"
      });
      planes.background.appendChild(grid);
    }
    setSvgAttributes(grid, {
      x: 0,
      y: 0,
      width: positiveNumber(state.width, defaultDiagram2Width),
      height: positiveNumber(state.height, defaultDiagram2Height),
      fill: "url(#diagram2-editor-grid-pattern)"
    });
  }

  function patchObjects(objects) {
    const desiredIds = new Set();
    let patchedCount = 0;

    objects.forEach(object => {
      desiredIds.add(object.id);
      patchedCount += patchVisibleObject(object);

      const node = liveView.objectNodesById.get(object.id);
      if (node.parentNode !== planes.objects || node !== planes.objects.lastChild) {
        planes.objects.appendChild(node);
      }
    });

    [...liveView.objectNodesById.keys()].forEach(id => {
      if (desiredIds.has(id)) return;
      removeObjectNode(id);
    });

    liveView.mountedObjectIds.clear();
    desiredIds.forEach(id => liveView.mountedObjectIds.add(id));
    patchSelectionOverlays();
    return patchedCount;
  }

  function patchRelationships(relationships) {
    const desiredIds = new Set();
    const metrics = createSelectiveRoutingMetrics(relationships.length);
    const routeOptions = relationshipRouteOptions(relationships, canonicalState);
    let patched = 0;
    let routedCount = 0;

    relationships.forEach(relationship => {
      desiredIds.add(relationship.id);
      const result = patchVisibleRelationship(relationship, { mode: "full", routeOptions });
      mergeSelectiveRoutingMetrics(metrics, result.diagnostics);
      patched += result.patched;
      routedCount += result.routed;

      const node = liveView.relationshipNodesById.get(relationship.id);
      if (node.parentNode !== planes.relationships || node !== planes.relationships.lastChild) {
        planes.relationships.appendChild(node);
      }
    });

    [...liveView.relationshipNodesById.keys()].forEach(id => {
      if (desiredIds.has(id)) return;
      removeRelationshipNode(id);
      patched += 1;
    });

    liveView.mountedRelationshipIds.clear();
    desiredIds.forEach(id => liveView.mountedRelationshipIds.add(id));
    patchMergedRelationshipRoutes(relationships, routeOptions);
    if (routedCount > 0) relationshipRouteRevision += routedCount;
    return {
      patched,
      routed: routedCount,
      diagnostics: selectiveRoutingDiagnosticsFromMetrics(metrics)
    };
  }

  function patchMergedRelationshipRoutes(relationships, routeOptionsInput = null) {
    if (!planes.relationships) return 0;

    let group = planes.relationships.querySelector(":scope > g[data-diagram2-merged-relationship-routes]");
    if (!group) {
      group = createSvgElement(host, "g", {
        "data-diagram2-merged-relationship-routes": "",
        class: "diagram2-renderer-merged-relationship-routes"
      });
      planes.relationships.prepend(group);
    }

    const routeOptions = routeOptionsInput || relationshipRouteOptions(relationships, canonicalState);
    const renderedRelationships = relationships
      .filter(relationship => liveView.mountedRelationshipIds.has(relationship.id))
      .map(relationship => {
        const route = routing.relationshipRoutesById.get(relationship.id)
          || relationshipRoute(relationship, routeOptions);
        const detailLevel = liveView.relationshipDetailLevelsById.get(relationship.id)
          || relationshipDetailLevel(relationship);
        return {
          relationship,
          style: relationshipStyle(relationship),
          geometry: detailLevel === diagram2DetailLevelLow
            ? lowDetailRelationshipRoute(relationship, route)
            : route
        };
      })
      .filter(item => item.geometry?.points?.length && item.geometry.path);
    const routeGroups = diagram2MergedRelationshipRouteGroups(renderedRelationships);

    while (group.childNodes.length > routeGroups.length) {
      group.lastChild?.remove();
    }
    routeGroups.forEach((routeGroup, index) => {
      let path = group.childNodes[index];
      if (!path) {
        path = appendSvg(group, "path", {
          "data-diagram2-merged-relationship-path": ""
        });
      }
      setSvgAttributes(path, {
        class: "diagram2-renderer-relationship diagram2-renderer-merged-relationship",
        "data-diagram2-merged-relationship-path": "",
        d: routeGroup.path,
        fill: "none",
        stroke: routeGroup.style.stroke,
        "stroke-width": routeGroup.style.strokeWidth,
        opacity: routeGroup.style.opacity,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "vector-effect": null,
        "pointer-events": "none"
      });
    });

    return routeGroups.length;
  }

  function patchVisibleObject(object) {
    const node = liveView.objectNodesById.get(object.id) || createObjectNode(object);
    const previousObject = liveView.objectDataById.get(object.id) || null;
    const detailLevel = objectDetailLevel(object);
    const previousDetailLevel = liveView.objectDetailLevelsById.get(object.id) || diagram2DetailLevelDetailed;
    const detailChanged = previousDetailLevel !== detailLevel;
    const flags = diagram2ObjectPatchFlags(previousObject, object);
    if (!flags.changed && !detailChanged && liveView.objectVersionsById.has(object.id)) {
      patchObjectSelection(node, object.id, liveView.selectedIds.has(object.id));
      return 0;
    }

    patchObjectNode(node, previousObject, object, {
      ...flags,
      detailLevel,
      detailChanged,
      rebuild: flags.rebuild || detailChanged,
      selected: liveView.selectedIds.has(object.id)
    }, canonicalState);
    liveView.objectDataById.set(object.id, object);
    liveView.objectVersionsById.set(object.id, objectVersion(object));
    liveView.objectDetailLevelsById.set(object.id, detailLevel);
    return 1;
  }

  function patchVisibleRelationship(relationship, options = {}) {
    const nodeExisted = liveView.relationshipNodesById.has(relationship.id);
    const node = nodeExisted ? liveView.relationshipNodesById.get(relationship.id) : createRelationshipNode(relationship);
    const existing = nodeExisted && liveView.relationshipVersionsById.has(relationship.id);
    const route = relationshipRoute(relationship, options.routeOptions || relationshipRouteOptions(null, canonicalState));
    const routeSignature = relationshipRouteCacheSignature(relationship, {
      canonicalState,
      routeBounds: route.bounds,
      routePath: route.path,
      obstacleGeneration: obstacleGenerationForBounds(route.bounds)
    });
    const styleSignature = relationshipStyleVersion(relationship);
    const previousRouteSignature = routing.relationshipRouteSignaturesById.get(relationship.id);
    const previousStyleSignature = routing.relationshipStyleSignaturesById.get(relationship.id);
    const detailLevel = relationshipDetailLevel(relationship);
    const previousDetailLevel = liveView.relationshipDetailLevelsById.get(relationship.id) || diagram2DetailLevelDetailed;
    const detailChanged = previousDetailLevel !== detailLevel;
    const styleOnly = options.styleOnly === true;
    const hasCachedRoute = routing.relationshipRoutesById.has(relationship.id);
    const routeChanged = !hasCachedRoute
      || (!styleOnly && (options.forceRoute === true || previousRouteSignature !== routeSignature));
    const styleChanged = !existing || previousStyleSignature !== styleSignature || detailChanged;
    const metrics = createSelectiveRoutingMetrics(1);
    if (options.countRouting !== false) {
      metrics.relationshipsConsidered = 1;
      if (routeChanged) metrics.routeCacheMisses = 1;
      else metrics.routeCacheHits = 1;
    }

    if (!routeChanged && !styleChanged && existing) {
      const selected = liveView.selectedIds.has(relationship.id);
      const wasSelected = node.classList.contains("is-selected");
      patchRelationshipSelection(node, relationship.id, selected);
      return {
        patched: wasSelected === selected ? 0 : 1,
        routed: 0,
        diagnostics: selectiveRoutingDiagnosticsFromMetrics(metrics)
      };
    }

    const renderedRoute = routeChanged
      ? route
      : routing.relationshipRoutesById.get(relationship.id) || route;
    patchRelationshipNode(node, relationship, relationship, {
      route: renderedRoute,
      detailLevel,
      detailChanged,
      routeChanged,
      styleChanged,
      selected: liveView.selectedIds.has(relationship.id)
    });
    liveView.relationshipDataById.set(relationship.id, relationship);
    liveView.relationshipVersionsById.set(relationship.id, relationshipRenderVersion(routeSignature, styleSignature, detailLevel));
    liveView.relationshipDetailLevelsById.set(relationship.id, detailLevel);
    routing.relationshipRouteSignaturesById.set(relationship.id, routeSignature);
    routing.relationshipStyleSignaturesById.set(relationship.id, styleSignature);
    routing.relationshipRoutesById.set(relationship.id, renderedRoute);
    updateRelationshipRouteBoundsIndex(relationship.id, renderedRoute.bounds);
    return {
      patched: 1,
      routed: routeChanged ? 1 : 0,
      diagnostics: selectiveRoutingDiagnosticsFromMetrics(metrics)
    };
  }

  function createObjectNode(object) {
    const node = createSvgElement(host, "g", {
      "data-diagram2-object-id": object.id,
      "data-diagram2-object-type": object.type
    });
    liveView.objectNodesById.set(object.id, node);
    return node;
  }

  function removeObjectNode(id, options = {}) {
    liveView.objectNodesById.get(id)?.remove();
    liveView.objectNodesById.delete(id);
    liveView.objectVersionsById.delete(id);
    liveView.objectDataById.delete(id);
    liveView.objectDetailLevelsById.delete(id);
    liveView.mountedObjectIds.delete(id);
    if (options.preserveSelection !== true) liveView.selectedIds.delete(id);
    planes.overlays?.querySelector(`[data-diagram2-selection-id="${cssEscape(id)}"]`)?.remove();
    if (options.preserveRouting !== true) removeRoutingObjectIndex(id);
  }

  function unmountViewportHaloObjectNode(id) {
    removeObjectNode(id, {
      preserveRouting: true,
      preserveSelection: true
    });
  }

  function createRelationshipNode(relationship) {
    const node = createSvgElement(host, "g", {
      "data-diagram2-relationship-id": relationship.id
    });
    liveView.relationshipNodesById.set(relationship.id, node);
    return node;
  }

  function removeRelationshipNode(id, options = {}) {
    liveView.relationshipNodesById.get(id)?.remove();
    liveView.relationshipNodesById.delete(id);
    liveView.relationshipVersionsById.delete(id);
    liveView.relationshipDataById.delete(id);
    liveView.relationshipDetailLevelsById.delete(id);
    liveView.mountedRelationshipIds.delete(id);
    if (options.preserveSelection !== true) liveView.selectedIds.delete(id);
    if (options.preserveRouting !== true) removeRelationshipRoutingState(id);
  }

  function unmountViewportHaloRelationshipNode(id) {
    removeRelationshipNode(id, {
      preserveRouting: true,
      preserveSelection: true
    });
  }

  function patchDirtyObject(id) {
    const object = canonicalState?.objects.find(candidate => candidate.id === id);
    if (!object || object.visible === false) {
      const existed = liveView.objectNodesById.has(id);
      removeObjectNode(id);
      removeRoutingObjectIndex(id);
      return existed ? 1 : 0;
    }

    const patched = patchVisibleObject(object);
    updateRoutingObjectIndex(object);
    const node = liveView.objectNodesById.get(id);
    if (node?.parentNode !== planes.objects) planes.objects.appendChild(node);
    liveView.mountedObjectIds.add(id);
    return patched;
  }

  function patchDirtyRelationships(relationships, relationshipIds, patchedRelationshipIds, options = {}) {
    const desiredIds = new Set(relationships.map(relationship => relationship.id));
    const relationshipsById = new Map(relationships.map(relationship => [relationship.id, relationship]));
    const routeOptions = relationshipRouteOptions(relationships, canonicalState);
    const metrics = createSelectiveRoutingMetrics(relationships.length);
    metrics.spatialSectorsQueried += Number(options.sectorsQueried || 0);
    const startTime = now(performanceApi);
    let patched = 0;
    let routed = 0;

    [...liveView.relationshipNodesById.keys()].forEach(id => {
      if (desiredIds.has(id)) return;
      removeRelationshipNode(id);
      patched += 1;
    });

    relationshipIds.forEach(id => {
      if (patchedRelationshipIds.has(id)) return;
      const relationship = relationshipsById.get(id);
      if (!relationship) return;
      const result = patchVisibleRelationship(relationship, { ...options, routeOptions });
      mergeSelectiveRoutingMetrics(metrics, result.diagnostics);
      patchedRelationshipIds.add(id);
      patched += result.patched;
      routed += result.routed;
      const node = liveView.relationshipNodesById.get(id);
      if (node?.parentNode !== planes.relationships) planes.relationships.appendChild(node);
    });

    if (routed > 0) relationshipRouteRevision += routed;
    patchMergedRelationshipRoutes(relationships, routeOptions);
    metrics.routingDuration += now(performanceApi) - startTime;
    return { patched, routed, diagnostics: selectiveRoutingDiagnosticsFromMetrics(metrics) };
  }

  function reconcileMountedRelationshipIds(relationships) {
    liveView.mountedRelationshipIds.clear();
    relationships.forEach(relationship => {
      if (liveView.relationshipNodesById.has(relationship.id)) liveView.mountedRelationshipIds.add(relationship.id);
    });
  }

  function reconcileObjectOrder(objects) {
    objects.forEach(object => {
      const node = liveView.objectNodesById.get(object.id);
      if (node) planes.objects.appendChild(node);
    });
  }

  function patchSelectionTargets(ids) {
    let patched = 0;
    ids.forEach(id => {
      const selected = liveView.selectedIds.has(id);
      const objectNode = liveView.objectNodesById.get(id);
      if (objectNode) {
        patchObjectSelection(objectNode, id, selected);
        patched += 1;
      }
      const relationshipNode = liveView.relationshipNodesById.get(id);
      if (relationshipNode) {
        patchRelationshipSelection(relationshipNode, id, selected);
        patched += 1;
      }
    });
    return patched;
  }

  function markObjectDirty(id, flags, previousObject = null, nextObject = null) {
    if (!flags.changed) return;
    if (flags.structureChanged) dirty.objectStructure.add(id);
    if (flags.transformChanged) dirty.objectGeometry.add(id);
    if (flags.styleChanged || flags.textChanged) dirty.objectStyle.add(id);
    if (!flags.structureChanged && !flags.transformChanged && !flags.styleChanged && !flags.textChanged) {
      dirty.objectStructure.add(id);
    }
    if (liveView.selectedIds.has(id) && (flags.structureChanged || flags.transformChanged)) {
      dirty.objectSelection.add(id);
    }

    if (flags.structureChanged) {
      dirty.relationshipGeometry.add(allRelationshipsDirtyToken);
      dirty.worldBounds = true;
      dirty.sectors = true;
      return;
    }

    if (flags.transformChanged) {
      const impact = impactedRelationshipIdsForObjectGeometry(id, previousObject, nextObject);
      pendingSelectiveRoutingSectorsQueried += impact.sectorsQueried;
      impact.relationshipIds.forEach(relationshipId => dirty.relationshipGeometry.add(relationshipId));
      dirty.worldBounds = true;
      dirty.sectors = true;
    }
  }

  function markSelectionDirty(id) {
    if (liveView.objectNodesById.has(id) || liveView.objectDataById.has(id)) {
      dirty.objectSelection.add(id);
    }
    if (liveView.relationshipNodesById.has(id) || liveView.relationshipDataById.has(id)) {
      dirty.relationshipStyle.add(id);
    }
  }

  function dirtyConnectedRelationships(objectId) {
    const indexedIds = routing.relationshipIdsByEntityId.get(String(objectId || ""));
    if (indexedIds) return [...indexedIds];
    return diagram2CanonicalRelationships(canonicalState)
      .filter(relationship => relationship.source?.id === objectId || relationship.target?.id === objectId)
      .map(relationship => relationship.id);
  }

  function impactedRelationshipIdsForObjectGeometry(objectId, previousObject, nextObject) {
    const relationshipIds = new Set(dirtyConnectedRelationships(objectId));
    const oldProtectedBounds = protectedRoutingBounds(previousObject);
    const newProtectedBounds = protectedRoutingBounds(nextObject);
    const corridorBounds = expandedBounds(unionBounds(oldProtectedBounds, newProtectedBounds), diagram2ImpactCorridorPadding);
    const queryBounds = [oldProtectedBounds, newProtectedBounds, corridorBounds].filter(Boolean);
    let sectorsQueried = 0;

    queryBounds.forEach(bounds => {
      const query = routing.relationshipRouteSectorIndex.query(bounds);
      sectorsQueried += query.sectorKeys.length;
      query.ids.forEach(relationshipId => {
        const relationshipBounds = routing.relationshipBoundsById.get(relationshipId);
        if (boundsIntersect(relationshipBounds, bounds)) relationshipIds.add(relationshipId);
      });
    });

    const generationBounds = unionBounds(corridorBounds, unionBounds(oldProtectedBounds, newProtectedBounds));
    const generationKeys = bumpObstacleGeneration(generationBounds);
    sectorsQueried += generationKeys.length;
    return { relationshipIds, sectorsQueried };
  }

  function rebuildRoutingObjectIndexes(objects) {
    routing.entityProtectedBoundsById.clear();
    routing.entityProtectedSectorIndex.clear();
    routing.routingObstacleBoundsById.clear();
    routing.routingObstacleSectorIndex.clear();
    viewportHalo.objectSectorIndex.clear();
    objects.forEach(updateRoutingObjectIndex);
  }

  function updateRoutingObjectIndex(object) {
    removeRoutingObjectIndex(object?.id);
    if (!object || object.visible === false) return;

    const protectedBounds = protectedRoutingBounds(object);
    if (protectedBounds && object.type === "entity") {
      routing.entityProtectedBoundsById.set(object.id, protectedBounds);
      routing.entityProtectedSectorIndex.add(object.id, protectedBounds);
    }

    const obstacleBounds = routingObstacleBounds(object);
    if (obstacleBounds) {
      routing.routingObstacleBoundsById.set(object.id, obstacleBounds);
      routing.routingObstacleSectorIndex.add(object.id, obstacleBounds);
    }
    viewportHalo.objectSectorIndex.add(object.id, objectBounds(object));
  }

  function removeRoutingObjectIndex(id) {
    const objectId = String(id || "").trim();
    if (!objectId) return;
    routing.entityProtectedBoundsById.delete(objectId);
    routing.entityProtectedSectorIndex.remove(objectId);
    routing.routingObstacleBoundsById.delete(objectId);
    routing.routingObstacleSectorIndex.remove(objectId);
    viewportHalo.objectSectorIndex.remove(objectId);
  }

  function rebuildRelationshipLookupIndexes(relationships) {
    routing.relationshipIdsByEntityId.clear();
    routing.relationshipIdsByFieldAnchor.clear();
    const desiredIds = new Set(relationships.map(relationship => relationship.id));
    relationships.forEach(relationship => {
      addToSetMap(routing.relationshipIdsByEntityId, relationship.source?.id, relationship.id);
      addToSetMap(routing.relationshipIdsByEntityId, relationship.target?.id, relationship.id);
      addToSetMap(routing.relationshipIdsByFieldAnchor, relationshipFieldAnchorKey(relationship.source, relationship.sourceField), relationship.id);
      addToSetMap(routing.relationshipIdsByFieldAnchor, relationshipFieldAnchorKey(relationship.target, relationship.targetField), relationship.id);
    });
    [...routing.relationshipBoundsById.keys()].forEach(id => {
      if (!desiredIds.has(id)) removeRelationshipRoutingState(id);
    });
  }

  function updateRelationshipRouteBoundsIndex(id, boundsInput) {
    const relationshipId = String(id || "").trim();
    const bounds = normalizeBounds(boundsInput);
    if (!relationshipId || !bounds) return;
    routing.relationshipBoundsById.set(relationshipId, bounds);
    routing.relationshipRouteSectorIndex.add(relationshipId, bounds);
    viewportHalo.relationshipSectorIndex.add(relationshipId, bounds);
  }

  function removeRelationshipRoutingState(id) {
    const relationshipId = String(id || "").trim();
    if (!relationshipId) return;
    routing.relationshipBoundsById.delete(relationshipId);
    routing.relationshipRouteSectorIndex.remove(relationshipId);
    routing.relationshipRouteSignaturesById.delete(relationshipId);
    routing.relationshipStyleSignaturesById.delete(relationshipId);
    routing.relationshipRoutesById.delete(relationshipId);
    viewportHalo.relationshipSectorIndex.remove(relationshipId);
  }

  function obstacleGenerationForBounds(boundsInput) {
    const bounds = normalizeBounds(boundsInput);
    if (!bounds) return routing.obstacleGeneration;
    const query = routing.routingObstacleSectorIndex.query(bounds);
    return query.sectorKeys.reduce((maximum, key) =>
      Math.max(maximum, Number(routing.obstacleGenerationBySectorKey.get(key) || 0)), 0);
  }

  function bumpObstacleGeneration(boundsInput) {
    const bounds = normalizeBounds(boundsInput);
    if (!bounds) return [];
    routing.obstacleGeneration += 1;
    const keys = fixedGridSectorKeys(bounds, routing.routingObstacleSectorIndex.sectorSize);
    keys.forEach(key => routing.obstacleGenerationBySectorKey.set(key, routing.obstacleGeneration));
    return keys;
  }

  function addDirtyReason(reason) {
    const text = String(reason || "").trim();
    if (text) dirty.reasons.add(text);
  }

  function geometryPreviewObjectIds(options = {}) {
    const selectedIds = [...liveView.selectedIds].filter(id => liveView.objectNodesById.has(id));
    const ids = Array.isArray(options.objectIds)
      ? options.objectIds
      : options.objectId
        ? [options.objectId]
        : selectedIds;
    const primaryObjectId = String(options.objectId || "").trim();
    const effectiveIds = primaryObjectId && options.includeSelection !== false && selectedIds.includes(primaryObjectId)
      ? selectedIds
      : ids;
    return [...new Set(effectiveIds
      .map(id => String(id || "").trim())
      .filter(id => id && liveView.objectNodesById.has(id)))];
  }

  function connectedRelationshipIds(objectIds) {
    const objectIdSet = new Set(objectIds);
    return diagram2CanonicalRelationships(canonicalState)
      .filter(relationship => objectIdSet.has(relationship.source?.id) || objectIdSet.has(relationship.target?.id))
      .map(relationship => relationship.id);
  }

  function objectDetailLevel(object) {
    return overviewDetail.level === diagram2DetailLevelLow
      && object?.type === "entity"
      && !diagram2IsFieldRectangle(object)
      ? diagram2DetailLevelLow
      : diagram2DetailLevelDetailed;
  }

  function relationshipDetailLevel() {
    return overviewDetail.level === diagram2DetailLevelLow
      ? diagram2DetailLevelLow
      : diagram2DetailLevelDetailed;
  }

  function rebuildViewportHaloIndexes(objects, relationships) {
    viewportHalo.objectSectorIndex.clear();
    viewportHalo.relationshipSectorIndex.clear();
    const routeOptions = relationshipRouteOptions(relationships, canonicalState);
    objects.forEach(object => {
      if (object?.visible !== false) viewportHalo.objectSectorIndex.add(object.id, objectBounds(object));
    });
    relationships.forEach(relationship => {
      const routeBounds = routing.relationshipBoundsById.get(relationship.id)
        || relationshipRoute(relationship, routeOptions).bounds;
      viewportHalo.relationshipSectorIndex.add(relationship.id, routeBounds);
    });
  }

  function reconcileViewportHalo(reason = "viewport", options = {}) {
    if (!canonicalState || !svg) {
      lastViewportHaloDiagnostics = emptyViewportHaloDiagnostics({ reason, fallbackReason: "no canonical state" });
      return {
        objectPatchCount: 0,
        relationshipPatchCount: 0,
        routedRelationshipCount: 0,
        diagnostics: lastViewportHaloDiagnostics
      };
    }

    const visibleObjects = canonicalState.objects.filter(object => object.visible !== false);
    const relationships = diagram2CanonicalRelationships(canonicalState);
    const routeOptions = relationshipRouteOptions(relationships, canonicalState);
    const plan = viewportHaloPlan(visibleObjects, relationships, reason);
    const sameSectorNoop = options.allowSameSectorNoop === true
      && plan.active
      && viewportHalo.active
      && viewportHalo.sectorSignature === plan.sectorSignature
      && viewportHalo.forceSignature === plan.forceSignature
      && viewportHalo.canonicalObjectCount === visibleObjects.length
      && viewportHalo.canonicalRelationshipCount === relationships.length;

    if (sameSectorNoop) {
      lastViewportHaloDiagnostics = viewportHaloDiagnosticsFromPlan(plan, {
        sameSectorNoop: true,
        objectPatchCount: 0,
        relationshipPatchCount: 0,
        routedRelationshipCount: 0,
        enteringObjectCount: 0,
        leavingObjectCount: 0,
        retainedObjectCount: liveView.mountedObjectIds.size,
        enteringRelationshipCount: 0,
        leavingRelationshipCount: 0,
        retainedRelationshipCount: liveView.mountedRelationshipIds.size,
        mountedObjectCount: liveView.mountedObjectIds.size,
        mountedRelationshipCount: liveView.mountedRelationshipIds.size
      });
      return {
        objectPatchCount: 0,
        relationshipPatchCount: 0,
        routedRelationshipCount: 0,
        diagnostics: lastViewportHaloDiagnostics
      };
    }

    const objectResult = patchViewportHaloObjects(plan.objects);
    const relationshipResult = patchViewportHaloRelationships(plan.relationships);
    if (relationshipResult.routed > 0) relationshipRouteRevision += relationshipResult.routed;

    viewportHalo.active = plan.active;
    viewportHalo.sectorSignature = plan.sectorSignature;
    viewportHalo.forceSignature = plan.forceSignature;
    viewportHalo.canonicalObjectCount = visibleObjects.length;
    viewportHalo.canonicalRelationshipCount = relationships.length;
    viewportHalo.objectIds = new Set(plan.objects.map(object => object.id));
    viewportHalo.relationshipIds = new Set(plan.relationships.map(relationship => relationship.id));

    lastViewportHaloDiagnostics = viewportHaloDiagnosticsFromPlan(plan, {
      sameSectorNoop: false,
      objectPatchCount: objectResult.patched,
      relationshipPatchCount: relationshipResult.patched,
      routedRelationshipCount: relationshipResult.routed,
      enteringObjectCount: objectResult.entering,
      leavingObjectCount: objectResult.leaving,
      retainedObjectCount: objectResult.retained,
      enteringRelationshipCount: relationshipResult.entering,
      leavingRelationshipCount: relationshipResult.leaving,
      retainedRelationshipCount: relationshipResult.retained,
      mountedObjectCount: liveView.mountedObjectIds.size,
      mountedRelationshipCount: liveView.mountedRelationshipIds.size
    });
    lastSelectiveRoutingDiagnostics = relationshipResult.diagnostics;
    return {
      objectPatchCount: objectResult.patched,
      relationshipPatchCount: relationshipResult.patched,
      routedRelationshipCount: relationshipResult.routed,
      diagnostics: lastViewportHaloDiagnostics,
      selectiveDiagnostics: relationshipResult.diagnostics
    };
  }

  function viewportHaloPlan(visibleObjects, relationships, reason) {
    const startTime = now(performanceApi);
    const objectById = new Map(visibleObjects.map(object => [object.id, object]));
    const relationshipById = new Map(relationships.map(relationship => [relationship.id, relationship]));
    const viewportBounds = viewportWorldBounds();
    const sectorSet = viewportHaloSectorSet(viewportBounds);
    const forceObjectIds = forceMountedViewportHaloObjectIds(visibleObjects, relationships);
    const targetObjectIds = new Set();
    const targetRelationshipIds = new Set();
    let routeOnlyRelationshipCount = 0;
    let fallbackReason = "";

    if (!viewportBounds || !sectorSet.bounds) fallbackReason = "unsafe viewport";

    if (!fallbackReason) {
      const objectQuery = viewportHalo.objectSectorIndex.query(sectorSet.bounds);
      objectQuery.ids.forEach(id => {
        const object = objectById.get(id);
        if (object && boundsIntersect(objectBounds(object), sectorSet.bounds)) targetObjectIds.add(id);
      });
      forceObjectIds.forEach(id => {
        if (objectById.has(id)) targetObjectIds.add(id);
      });

      const forcedRelationshipIds = forceMountedViewportHaloRelationshipIds(relationships, forceObjectIds, relationshipById);
      const relationshipQuery = viewportHalo.relationshipSectorIndex.query(sectorSet.bounds);
      relationshipQuery.ids.forEach(id => {
        const relationship = relationshipById.get(id);
        if (!relationship) return;
        const routeBounds = routing.relationshipBoundsById.get(id)
          || relationshipRoute(relationship, routeOptions).bounds;
        if (boundsIntersect(routeBounds, sectorSet.bounds)) {
          targetRelationshipIds.add(id);
          if (!targetObjectIds.has(relationship.source?.id) && !targetObjectIds.has(relationship.target?.id)) {
            routeOnlyRelationshipCount += 1;
          }
        }
      });
      forcedRelationshipIds.forEach(id => {
        if (relationshipById.has(id)) targetRelationshipIds.add(id);
      });
    }

    const objectCoverage = visibleObjects.length
      ? targetObjectIds.size / visibleObjects.length
      : 1;
    const relationshipCoverage = relationships.length
      ? targetRelationshipIds.size / relationships.length
      : 1;
    const combinedCoverage = (visibleObjects.length + relationships.length)
      ? (targetObjectIds.size + targetRelationshipIds.size) / (visibleObjects.length + relationships.length)
      : 1;
    if (!fallbackReason && visibleObjects.length < diagram2ViewportHaloMinimumObjectThreshold) {
      fallbackReason = "small diagram";
    } else if (!fallbackReason && combinedCoverage >= diagram2ViewportHaloFullCoverageThreshold) {
      fallbackReason = "coverage threshold";
    } else if (!fallbackReason && targetObjectIds.size >= visibleObjects.length) {
      fallbackReason = "all objects required";
    }

    const active = !fallbackReason;
    const objects = active
      ? visibleObjects.filter(object => targetObjectIds.has(object.id))
      : visibleObjects;
    const relationshipTargets = active ? targetRelationshipIds : new Set(relationships.map(relationship => relationship.id));
    const planRelationships = relationships.filter(relationship => relationshipTargets.has(relationship.id));
    const forceSignature = viewportHaloForceSignature(forceObjectIds, liveView.selectedIds, activeGeometryPreview);
    const duration = Math.round(Math.max(0, now(performanceApi) - startTime) * 100) / 100;
    return {
      active,
      reason,
      fallbackReason,
      viewportBounds,
      haloBounds: sectorSet.bounds,
      sectorSignature: sectorSet.signature,
      sectorCount: sectorSet.keys.length,
      forceSignature,
      objects,
      relationships: planRelationships,
      totalObjectCount: visibleObjects.length,
      totalRelationshipCount: relationships.length,
      targetObjectCount: objects.length,
      targetRelationshipCount: planRelationships.length,
      virtualizedObjectCount: Math.max(0, visibleObjects.length - objects.length),
      virtualizedRelationshipCount: Math.max(0, relationships.length - planRelationships.length),
      objectCoverage,
      relationshipCoverage,
      combinedCoverage,
      forceMountedObjectCount: forceObjectIds.size,
      forceMountedRelationshipCount: forceMountedViewportHaloRelationshipIds(relationships, forceObjectIds, relationshipById).size,
      routeOnlyRelationshipCount,
      duration
    };
  }

  function patchViewportHaloObjects(objects) {
    const targetIds = new Set(objects.map(object => object.id));
    const currentIds = new Set(liveView.mountedObjectIds);
    const entering = objects.filter(object => !currentIds.has(object.id));
    const retained = objects.filter(object => currentIds.has(object.id));
    const leaving = [...currentIds].filter(id => !targetIds.has(id));
    let patched = 0;

    entering.forEach(object => {
      patched += patchVisibleObject(object);
      const node = liveView.objectNodesById.get(object.id);
      if (node?.parentNode !== planes.objects) planes.objects.appendChild(node);
    });
    retained.forEach(object => {
      const node = liveView.objectNodesById.get(object.id);
      if (!node) {
        patched += patchVisibleObject(object);
        const created = liveView.objectNodesById.get(object.id);
        if (created?.parentNode !== planes.objects) planes.objects.appendChild(created);
        return;
      }
      patchObjectSelection(node, object.id, liveView.selectedIds.has(object.id));
    });
    leaving.forEach(id => unmountViewportHaloObjectNode(id));

    liveView.mountedObjectIds.clear();
    targetIds.forEach(id => liveView.mountedObjectIds.add(id));
    patchSelectionOverlays();
    return { patched, entering: entering.length, retained: retained.length, leaving: leaving.length };
  }

  function patchViewportHaloRelationships(relationships) {
    const targetIds = new Set(relationships.map(relationship => relationship.id));
    const currentIds = new Set(liveView.mountedRelationshipIds);
    const entering = relationships.filter(relationship => !currentIds.has(relationship.id));
    const retained = relationships.filter(relationship => currentIds.has(relationship.id));
    const leaving = [...currentIds].filter(id => !targetIds.has(id));
    const routeOptions = relationshipRouteOptions(relationships, canonicalState);
    const metrics = createSelectiveRoutingMetrics(relationships.length);
    let patched = 0;
    let routed = 0;

    entering.forEach(relationship => {
      const result = patchVisibleRelationship(relationship, { mode: "viewport halo", routeOptions });
      mergeSelectiveRoutingMetrics(metrics, result.diagnostics);
      patched += result.patched;
      routed += result.routed;
      const node = liveView.relationshipNodesById.get(relationship.id);
      if (node?.parentNode !== planes.relationships) planes.relationships.appendChild(node);
    });
    retained.forEach(relationship => {
      const node = liveView.relationshipNodesById.get(relationship.id);
      if (!node) {
        const result = patchVisibleRelationship(relationship, { mode: "viewport halo", routeOptions });
        mergeSelectiveRoutingMetrics(metrics, result.diagnostics);
        patched += result.patched;
        routed += result.routed;
        const created = liveView.relationshipNodesById.get(relationship.id);
        if (created?.parentNode !== planes.relationships) planes.relationships.appendChild(created);
      }
    });
    leaving.forEach(id => {
      unmountViewportHaloRelationshipNode(id);
      patched += 1;
    });

    liveView.mountedRelationshipIds.clear();
    targetIds.forEach(id => liveView.mountedRelationshipIds.add(id));
    patchMergedRelationshipRoutes(relationships, routeOptions);
    return {
      patched,
      routed,
      entering: entering.length,
      retained: retained.length,
      leaving: leaving.length,
      diagnostics: selectiveRoutingDiagnosticsFromMetrics(metrics)
    };
  }

  function forceMountedViewportHaloObjectIds(visibleObjects, relationships) {
    const objectById = new Map(visibleObjects.map(object => [object.id, object]));
    const relationshipById = new Map(relationships.map(relationship => [relationship.id, relationship]));
    const forced = new Set();
    liveView.selectedIds.forEach(id => {
      if (objectById.has(id)) forced.add(id);
      const relationship = relationshipById.get(id);
      if (relationship) {
        if (relationship.source?.id) forced.add(relationship.source.id);
        if (relationship.target?.id) forced.add(relationship.target.id);
      }
    });
    (activeGeometryPreview?.objectIds || []).forEach(id => {
      if (objectById.has(id)) forced.add(id);
    });
    (activeGeometryPreview?.selectedObjectIds || []).forEach(id => {
      if (objectById.has(id)) forced.add(id);
    });

    const requiredGroupIds = new Set([...forced]
      .map(id => objectById.get(id)?.groupId)
      .filter(Boolean));
    if (requiredGroupIds.size) {
      visibleObjects.forEach(object => {
        if (requiredGroupIds.has(object.groupId)) forced.add(object.id);
      });
    }
    return forced;
  }

  function forceMountedViewportHaloRelationshipIds(relationships, forceObjectIds, relationshipById) {
    const forced = new Set();
    liveView.selectedIds.forEach(id => {
      if (relationshipById.has(id)) forced.add(id);
    });
    (activeGeometryPreview?.relationshipIds || []).forEach(id => {
      if (relationshipById.has(id)) forced.add(id);
    });
    relationships.forEach(relationship => {
      if (forceObjectIds.has(relationship.source?.id) || forceObjectIds.has(relationship.target?.id)) {
        forced.add(relationship.id);
      }
    });
    return forced;
  }

  function viewportWorldBounds() {
    const viewport = viewportSize();
    const topLeft = diagram2ScreenToWorldPoint(committedViewportTransform, { x: 0, y: 0 });
    const bottomRight = diagram2ScreenToWorldPoint(committedViewportTransform, {
      x: viewport.width,
      y: viewport.height
    });
    return normalizeBounds({
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)),
      height: Math.max(1, Math.abs(bottomRight.y - topLeft.y))
    });
  }

  function viewportHaloSectorSet(viewportBounds) {
    const bounds = normalizeBounds(viewportBounds);
    if (!bounds) return { bounds: null, keys: [], signature: "" };
    const sectorSize = diagram2ViewportHaloSectorSize;
    const minX = Math.floor(bounds.x / sectorSize) - diagram2ViewportHaloSectorCount;
    const minY = Math.floor(bounds.y / sectorSize) - diagram2ViewportHaloSectorCount;
    const maxX = Math.floor((bounds.x + bounds.width) / sectorSize) + diagram2ViewportHaloSectorCount;
    const maxY = Math.floor((bounds.y + bounds.height) / sectorSize) + diagram2ViewportHaloSectorCount;
    const keys = [];
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        keys.push(`${x}:${y}`);
      }
    }
    return {
      bounds: {
        x: minX * sectorSize,
        y: minY * sectorSize,
        width: Math.max(1, (maxX - minX + 1) * sectorSize),
        height: Math.max(1, (maxY - minY + 1) * sectorSize)
      },
      keys,
      signature: keys.join("|")
    };
  }

  function viewportHaloForceSignature(forceObjectIds, selectedIds, preview) {
    const selected = [...selectedIds].sort((left, right) => left.localeCompare(right)).join(",");
    const forced = [...forceObjectIds].sort((left, right) => left.localeCompare(right)).join(",");
    const previewIds = [
      ...(preview?.objectIds || []),
      ...(preview?.relationshipIds || [])
    ].sort((left, right) => left.localeCompare(right)).join(",");
    return `selected=${selected};forced=${forced};preview=${previewIds}`;
  }

  function reconcileOverviewDetailLevel(reason = "viewport") {
    if (!canonicalState || !svg) {
      lastOverviewDetailDiagnostics = emptyOverviewDetailDiagnostics({ reason });
      return { objectPatchCount: 0, relationshipPatchCount: 0, diagnostics: lastOverviewDetailDiagnostics };
    }

    const frameStart = now(performanceApi);
    const visibleObjects = canonicalState.objects.filter(object => object.visible !== false);
    const relationships = diagram2CanonicalRelationships(canonicalState);
    const mountedObjects = visibleObjects.filter(object => liveView.mountedObjectIds.has(object.id));
    const mountedRelationships = relationships.filter(relationship => liveView.mountedRelationshipIds.has(relationship.id));
    const projectedRowPixels = projectedEntityFieldRowPixels(visibleObjects);
    const entityCount = visibleObjects
      .filter(object => object.type === "entity" && !diagram2IsFieldRectangle(object)).length;
    const previousLevel = overviewDetail.level;
    const nextLevel = nextOverviewDetailLevel(previousLevel, projectedRowPixels, entityCount);
    overviewDetail.level = nextLevel;

    const objectPatchCount = patchOverviewDetailObjects(mountedObjects);
    const relationshipPatchCount = patchOverviewDetailRelationships(mountedRelationships);
    const duration = Math.round(Math.max(0, now(performanceApi) - frameStart) * 100) / 100;
    lastOverviewDetailDiagnostics = overviewDetailDiagnostics({
      reason,
      previousLevel,
      level: nextLevel,
      projectedRowPixels,
      entityCount,
      mountedObjectCount: mountedObjects.length,
      mountedRelationshipCount: mountedRelationships.length,
      objectLevelsById: liveView.objectDetailLevelsById,
      relationshipLevelsById: liveView.relationshipDetailLevelsById,
      objectPatchCount,
      relationshipPatchCount,
      duration
    });
    return { objectPatchCount, relationshipPatchCount, diagnostics: lastOverviewDetailDiagnostics };
  }

  function patchOverviewDetailObjects(objects) {
    let patched = 0;
    objects.forEach(object => {
      const nextLevel = objectDetailLevel(object);
      if (liveView.objectDetailLevelsById.get(object.id) === nextLevel) return;
      patched += patchVisibleObject(object);
    });
    return patched;
  }

  function patchOverviewDetailRelationships(relationships) {
    const routeOptions = relationshipRouteOptions(relationships, canonicalState);
    let patched = 0;
    relationships.forEach(relationship => {
      const nextLevel = relationshipDetailLevel(relationship);
      if (liveView.relationshipDetailLevelsById.get(relationship.id) === nextLevel) return;
      const result = patchVisibleRelationship(relationship, {
        mode: "overview detail",
        countRouting: false,
        styleOnly: true,
        routeOptions
      });
      patched += result.patched;
    });
    if (patched > 0) patchMergedRelationshipRoutes(relationships, routeOptions);
    return patched;
  }

  function projectedEntityFieldRowPixels(objects) {
    const rowHeights = objects
      .filter(object => object?.type === "entity" && object.visible !== false && !diagram2IsFieldRectangle(object))
      .map(entity => {
        const fields = annotationEntityVisibleFields(entity);
        const firstFieldBounds = fields.length ? annotationEntityFieldBounds(entity, fields[0]) : null;
        return firstFieldBounds
          ? positiveNumber(firstFieldBounds.height, 0)
          : Math.max(14, positiveNumber(entity.fontSize, 12) * 1.35);
      })
      .filter(height => Number.isFinite(height) && height > 0)
      .sort((left, right) => left - right);
    if (!rowHeights.length) return Number.POSITIVE_INFINITY;
    const median = rowHeights[Math.floor(rowHeights.length / 2)];
    return Math.round(Math.max(0, median * committedViewportTransform.scale) * 100) / 100;
  }

  function nextOverviewDetailLevel(previousLevel, projectedRowPixels, entityCount) {
    if (entityCount < diagram2LowDetailMinimumEntityCount) return diagram2DetailLevelDetailed;
    const rowPixels = Number(projectedRowPixels);
    if (!Number.isFinite(rowPixels)) return diagram2DetailLevelDetailed;
    if (previousLevel === diagram2DetailLevelLow) {
      return rowPixels < diagram2LowDetailExitRowPixels
        ? diagram2DetailLevelLow
        : diagram2DetailLevelDetailed;
    }
    return rowPixels < diagram2LowDetailEnterRowPixels
      ? diagram2DetailLevelLow
      : diagram2DetailLevelDetailed;
  }

  function bringPreviewObjectsForward(objectIds) {
    objectIds.forEach(id => {
      const node = liveView.objectNodesById.get(id);
      if (node?.parentNode === planes.objects) planes.objects.appendChild(node);
    });
  }

  function scheduleGeometryPreviewFrame(reason = "preview move") {
    if (!activeGeometryPreview) return diagnostics();
    if (pendingGeometryPreviewFrame) {
      updateGeometryPreviewDiagnostics(reason, activeGeometryPreview.patchedObjectCount, activeGeometryPreview.previewRelationshipCount, true);
      return diagnostics();
    }

    const requestFrame = globalThis.requestAnimationFrame || (callback => globalThis.setTimeout(callback, 16));
    pendingGeometryPreviewFrame = requestFrame(() => {
      pendingGeometryPreviewFrame = 0;
      if (destroyed) {
        resolvePendingFlushes();
        return;
      }
      applyGeometryPreviewFrame(reason);
      resolvePendingFlushes();
    });
    updateGeometryPreviewDiagnostics(reason, activeGeometryPreview.patchedObjectCount, activeGeometryPreview.previewRelationshipCount, true);
    applyDiagnosticsAttributes();
    return diagnostics();
  }

  function applyGeometryPreviewFrame(reason = "preview move") {
    const preview = activeGeometryPreview;
    if (!preview || !canonicalState || !svg) return diagnostics();

    const frameId = `diagram2-geometry-preview-${++frameSequence}`;
    const startTime = now(performanceApi);
    mark(performanceApi, `${frameId}:start`);
    const previewObjectsById = computePreviewObjectsById(preview);
    preview.previewObjectsById = previewObjectsById;
    let patchedObjectCount = 0;
    preview.objectIds.forEach(id => {
      patchedObjectCount += patchPreviewObject(id, previewObjectsById.get(id), preview);
    });
    const previewRelationshipCount = patchGeometryRelationshipPreviews(preview, previewObjectsById);
    patchSelectionOverlays(previewObjectsById);

    const endTime = now(performanceApi);
    mark(performanceApi, `${frameId}:end`);
    measure(performanceApi, "diagram2 geometry preview", `${frameId}:start`, `${frameId}:end`);
    geometryPreviewFrameCount += 1;
    preview.frameCount += 1;
    preview.patchedObjectCount = patchedObjectCount;
    preview.previewRelationshipCount = previewRelationshipCount;
    updateGeometryPreviewDiagnostics(reason, patchedObjectCount, previewRelationshipCount, false, endTime - startTime);
    applyDiagnosticsAttributes();
    notifyDiagnostics();
    return diagnostics();
  }

  function computePreviewObjectsById(preview) {
    const objectsById = new Map();
    preview.originalObjectsById.forEach((object, id) => {
      const explicitObject = preview.latestGeometry.objectsById?.get(id);
      objectsById.set(id, explicitObject
        ? normalizePreviewObject({ ...explicitObject, id })
        : previewObjectGeometry(object, preview.latestGeometry, preview.mode));
    });
    return objectsById;
  }

  function previewObjectGeometry(object, geometry, mode) {
    const deltaX = finiteNumber(geometry.deltaX, 0);
    const deltaY = finiteNumber(geometry.deltaY, 0);
    const deltaWidth = finiteNumber(geometry.deltaWidth, 0);
    const deltaHeight = finiteNumber(geometry.deltaHeight, 0);
    const next = cloneDiagram2Value(object);

    if (object.type === "arrow" || object.type === "line") {
      next.x1 = finiteNumber(object.x1, 0) + deltaX;
      next.y1 = finiteNumber(object.y1, 0) + deltaY;
      next.x2 = finiteNumber(object.x2, 0) + deltaX + (mode === "resize" ? deltaWidth : 0);
      next.y2 = finiteNumber(object.y2, 0) + deltaY + (mode === "resize" ? deltaHeight : 0);
      return next;
    }

    next.x = finiteNumber(object.x, 0) + deltaX;
    next.y = finiteNumber(object.y, 0) + deltaY;
    if (object.type === "embedded-image" && object.imageClip && typeof object.imageClip === "object") {
      next.imageClip = translateDiagram2Bounds(object.imageClip, deltaX, deltaY);
    }
    if (mode === "resize") {
      next.width = Math.max(1, positiveNumber(object.width, 1) + deltaWidth);
      next.height = Math.max(1, positiveNumber(object.height, 1) + deltaHeight);
      return normalizePreviewObject(next);
    }
    return next;
  }

  function normalizePreviewObject(object) {
    return normalizeDiagram2CanonicalState({
      width: canonicalState?.width || defaultDiagram2Width,
      height: canonicalState?.height || defaultDiagram2Height,
      objects: [object]
    }).objects[0] || object;
  }

  function patchPreviewObject(id, object, preview) {
    if (!object) return 0;
    const node = liveView.objectNodesById.get(id);
    if (!node) return 0;
    node.classList.add("is-previewing");
    setSvgAttributes(node, {
      "data-diagram2-preview-active": "true"
    });

    if (preview.mode === "resize" || object.type === "arrow" || object.type === "line") {
      const previousObject = liveView.objectDataById.get(id) || preview.originalObjectsById.get(id) || null;
      patchObjectNode(node, previousObject, object, {
        ...diagram2ObjectPatchFlags(previousObject, object),
        detailLevel: objectDetailLevel(object),
        selected: liveView.selectedIds.has(id)
      }, canonicalState);
      setSvgAttributes(node, {
        "data-diagram2-preview-active": "true"
      });
      node.classList.add("is-previewing");
      return 1;
    }

    setSvgAttributes(node, {
      transform: objectTransformText(object)
    });
    return 1;
  }

  function patchGeometryRelationshipPreviews(preview, previewObjectsById) {
    const previewPlane = planes.relationships || planes.overlays;
    if (!previewPlane) return 0;
    const desiredIds = new Set(preview.relationshipIds);
    const previewState = {
      ...canonicalState,
      objects: canonicalState.objects.map(object => previewObjectsById.get(object.id) || object)
    };
    const previewRelationships = diagram2CanonicalRelationships(previewState);
    const routeOptions = relationshipRouteOptions(previewRelationships, previewState);
    const relationshipsById = new Map(previewRelationships.map(relationship => [relationship.id, relationship]));
    let patched = 0;

    preview.relationshipIds.forEach(id => {
      const relationship = relationshipsById.get(id);
      if (!relationship) return;
      const previewRelationship = relationshipWithPreviewObjects(relationship, previewObjectsById);
      const route = relationshipRoute(previewRelationship, routeOptions);
      const style = relationshipStyle(relationship);
      let node = previewPlane.querySelector(`:scope > g[data-diagram2-relationship-preview-id="${cssEscape(id)}"]`);
      if (!node) {
        node = createSvgElement(host, "g", {
          "data-diagram2-relationship-preview-id": id,
          class: "diagram2-renderer-relationship-preview-node"
        });
        previewPlane.appendChild(node);
      }
      let path = node.querySelector(":scope > path[data-diagram2-relationship-preview-path]");
      if (!path) {
        path = appendSvg(node, "path", {
          "data-diagram2-relationship-preview-path": ""
        });
      }
      setSvgAttributes(path, {
        class: "diagram2-renderer-relationship-preview",
        "data-diagram2-relationship-preview-path": "",
        d: route.path,
        fill: "none",
        stroke: style.stroke,
        "stroke-width": Math.max(1, style.strokeWidth),
        opacity: Math.min(1, style.opacity + 0.08),
        "stroke-dasharray": "8 6",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "vector-effect": "non-scaling-stroke"
      });
      patched += 1;
    });

    previewPlane.querySelectorAll(":scope > g[data-diagram2-relationship-preview-id]").forEach(node => {
      if (!desiredIds.has(node.getAttribute("data-diagram2-relationship-preview-id"))) node.remove();
    });
    return patched;
  }

  function setGeometryPreviewRelationshipsHidden(preview, hidden) {
    if (!preview?.relationshipIds?.length) return;
    const mergedRoutes = planes.relationships?.querySelector(":scope > g[data-diagram2-merged-relationship-routes]");
    if (mergedRoutes) {
      mergedRoutes.classList.toggle("is-geometry-preview-hidden", hidden);
      if (hidden) {
        setSvgAttributes(mergedRoutes, {
          "data-diagram2-geometry-preview-hidden": "true",
          visibility: "hidden"
        });
      } else {
        mergedRoutes.removeAttribute("data-diagram2-geometry-preview-hidden");
        mergedRoutes.removeAttribute("visibility");
      }
    }

    preview.relationshipIds.forEach(id => {
      const node = liveView.relationshipNodesById.get(id);
      if (!node) return;
      node.classList.toggle("is-geometry-preview-hidden", hidden);
      if (hidden) {
        setSvgAttributes(node, {
          "data-diagram2-geometry-preview-hidden": "true",
          visibility: "hidden"
        });
        return;
      }
      node.removeAttribute("data-diagram2-geometry-preview-hidden");
      node.removeAttribute("visibility");
    });
  }

  function relationshipWithPreviewObjects(relationship, previewObjectsById) {
    const previewState = {
      ...canonicalState,
      objects: canonicalState.objects.map(object => previewObjectsById.get(object.id) || object)
    };
    return diagram2CanonicalRelationships(previewState).find(item => item.id === relationship.id) || {
      ...relationship,
      source: previewObjectsById.get(relationship.source?.id) || relationship.source,
      target: previewObjectsById.get(relationship.target?.id) || relationship.target,
      diagram2RouteGeometry: null
    };
  }

  function clearGeometryPreview({ restoreObjects = false, reason = "" } = {}) {
    const preview = activeGeometryPreview;
    setGeometryPreviewRelationshipsHidden(preview, false);
    if (preview && restoreObjects) {
      preview.originalObjectsById.forEach((object, id) => {
        const node = liveView.objectNodesById.get(id);
        if (!node) return;
        patchObjectNode(node, liveView.objectDataById.get(id), object, {
          ...diagram2ObjectPatchFlags(liveView.objectDataById.get(id), object),
          detailLevel: objectDetailLevel(object),
          selected: liveView.selectedIds.has(id),
          rebuild: preview.mode === "resize" || object.type === "arrow" || object.type === "line"
        }, canonicalState);
      });
      patchSelectionOverlays();
    }
    preview?.objectIds.forEach(id => {
      const node = liveView.objectNodesById.get(id);
      node?.classList.remove("is-previewing");
      node?.removeAttribute("data-diagram2-preview-active");
    });
    if (planes.objects && canonicalState?.objects?.length) {
      reconcileObjectOrder(canonicalState.objects.filter(object => object.visible !== false));
    }
    planes.relationships?.querySelectorAll(":scope > g[data-diagram2-relationship-preview-id]")?.forEach(node => node.remove());
    planes.overlays?.querySelectorAll(":scope > g[data-diagram2-relationship-preview-id]")?.forEach(node => node.remove());
    activeGeometryPreview = null;
    pendingGeometryPreviewFrame = 0;
    updateGeometryPreviewDiagnostics(reason || (restoreObjects ? "preview cancel" : "preview cleared"), 0, 0);
  }

  function updateGeometryPreviewDiagnostics(reason, patchedObjectCount, relationshipPreviewCount, pending = false, duration = 0) {
    const preview = activeGeometryPreview;
    lastGeometryPreviewDiagnostics = preview ? {
      geometryPreviewActive: true,
      geometryPreviewReason: String(reason || ""),
      geometryPreviewObjectIds: sortedDirtyIds(preview.objectIds),
      geometryPreviewRelationshipIds: sortedDirtyIds(preview.relationshipIds),
      geometryPreviewFrameCount,
      geometryPreviewPatchedObjectCount: patchedObjectCount,
      geometryPreviewRelationshipCount: relationshipPreviewCount,
      geometryPreviewLastDuration: Math.round(Math.max(0, duration) * 100) / 100,
      geometryPreviewCommitCount,
      geometryPreviewUndoEntryCount,
      geometryPreviewInitialMatrix: diagram2MatrixText(preview.initialViewportMatrix),
      geometryPreviewSettledRouteCount: preview.settledRoutesById.size,
      pendingGeometryPreview: pending
    } : {
      ...emptyGeometryPreviewDiagnostics(),
      geometryPreviewReason: String(reason || ""),
      geometryPreviewCommitCount,
      geometryPreviewUndoEntryCount
    };
    Object.assign(lastDiagnostics, lastGeometryPreviewDiagnostics);
  }

  function patchSelectionOverlays(previewObjectsById = null) {
    if (!planes.overlays) return;
    const desiredIds = new Set();
    liveView.selectedIds.forEach(id => {
      const object = previewObjectsById?.get(id) || liveView.objectDataById.get(id);
      const objectNode = liveView.objectNodesById.get(id);
      if (!object || !objectNode?.isConnected) return;

      desiredIds.add(id);
      let overlay = planes.overlays.querySelector(`:scope > g[data-diagram2-selection-id="${cssEscape(id)}"]`);
      if (!overlay) {
        overlay = createSvgElement(host, "g", {
          "data-diagram2-selection-id": id,
          class: "diagram2-renderer-selection",
          "pointer-events": "none"
        });
        planes.overlays.appendChild(overlay);
      }

      const bounds = objectSelectionBounds(object);
      setSvgAttributes(overlay, {
        "data-diagram2-selection-id": id,
        class: "diagram2-renderer-selection",
        transform: objectTransformText(object)
      });

      let outline = overlay.querySelector(":scope > rect[data-diagram2-selection-outline]");
      if (!outline) {
        outline = appendSvg(overlay, "rect", {
          "data-diagram2-selection-outline": ""
        });
      }
      setSvgAttributes(outline, {
        x: bounds.x - 4,
        y: bounds.y - 4,
        width: bounds.width + 8,
        height: bounds.height + 8,
        fill: "none",
        stroke: "#2563eb",
        "stroke-width": 2,
        "stroke-dasharray": "6 4",
        "vector-effect": "non-scaling-stroke",
        "pointer-events": "none"
      });

      overlay.querySelectorAll(":scope > [data-diagram2-resize-handle]").forEach(handle => handle.remove());
      if (object.locked !== true) {
        diagram2SelectionHandlePoints(object, bounds).forEach(handle => {
          appendSvg(overlay, "circle", {
            class: "image-annotation-handle diagram2-renderer-resize-handle",
            "data-annotation-handle": handle.direction,
            "data-diagram2-resize-handle": handle.direction,
            cx: handle.x,
            cy: handle.y,
            r: diagram2SelectionHandleRadius(committedViewportTransform.scale),
            fill: "#2563eb",
            stroke: "#ffffff",
            "stroke-width": 0.75,
            "pointer-events": "all"
          });
        });
      }
    });

    planes.overlays.querySelectorAll(":scope > g[data-diagram2-selection-id]").forEach(overlay => {
      if (!desiredIds.has(overlay.getAttribute("data-diagram2-selection-id"))) overlay.remove();
    });
  }

  function queueViewportTransform(nextTransform, options = {}) {
    if (!svg || !viewportPlane) return;

    const normalized = normalizeViewportTransform(nextTransform);
    viewportTransform.scale = normalized.scale;
    viewportTransform.translateX = normalized.translateX;
    viewportTransform.translateY = normalized.translateY;
    lastViewportReason = String(options.reason || "viewport").trim() || "viewport";

    if (!pendingViewportGesture) {
      const cursorScreenPoint = options.cursorScreenPoint || viewportCenterPoint();
      pendingViewportGesture = {
        reason: lastViewportReason,
        cursorScreenPoint,
        worldPointUnderCursor: options.worldPointUnderCursor || diagram2ScreenToWorldPoint(committedViewportTransform, cursorScreenPoint),
        entityBoundsBefore: firstEntityBounds(),
        objectNodeBefore: firstEntityNode(),
        textNodeBefore: firstEntityTextNode(),
        fullRenderCount,
        relationshipRouteRevision,
        transientMatrix: diagram2MatrixText(viewportTransform)
      };
    } else {
      pendingViewportGesture.reason = lastViewportReason;
      pendingViewportGesture.cursorScreenPoint = options.cursorScreenPoint || pendingViewportGesture.cursorScreenPoint;
      pendingViewportGesture.worldPointUnderCursor = options.worldPointUnderCursor || pendingViewportGesture.worldPointUnderCursor;
      pendingViewportGesture.transientMatrix = diagram2MatrixText(viewportTransform);
    }

    if (pendingViewportFrame) return;
    const requestFrame = globalThis.requestAnimationFrame || (callback => globalThis.setTimeout(callback, 16));
    pendingViewportFrame = requestFrame(() => {
      pendingViewportFrame = 0;
      if (destroyed) return;
      applyViewportTransformNow(lastViewportReason);
    });
  }

  function applyViewportTransformNow(reason) {
    if (!viewportPlane) return;

    const frameId = `diagram2-viewport-${++frameSequence}`;
    mark(performanceApi, `${frameId}:start`);
    const gesture = pendingViewportGesture || {
      reason,
      cursorScreenPoint: viewportCenterPoint(),
      worldPointUnderCursor: diagram2ScreenToWorldPoint(committedViewportTransform, viewportCenterPoint()),
      entityBoundsBefore: firstEntityBounds(),
      objectNodeBefore: firstEntityNode(),
      textNodeBefore: firstEntityTextNode(),
      fullRenderCount,
      relationshipRouteRevision,
      transientMatrix: diagram2MatrixText(viewportTransform)
    };

    setSvgAttributes(viewportPlane, {
      transform: diagram2MatrixText(viewportTransform)
    });
    committedViewportTransform.scale = viewportTransform.scale;
    committedViewportTransform.translateX = viewportTransform.translateX;
    committedViewportTransform.translateY = viewportTransform.translateY;

    const viewportHaloResult = reconcileViewportHalo(reason, { allowSameSectorNoop: true });
    const overviewDetailResult = reconcileOverviewDetailLevel(reason);

    const screenPointAfterSettle = diagram2WorldToScreenPoint(committedViewportTransform, gesture.worldPointUnderCursor);
    const entityBoundsAfter = firstEntityBounds();
    const matrixDifference = viewportMatrixDifference(viewportTransform, committedViewportTransform);
    lastTransformDiagnostics = {
      transientMatrix: gesture.transientMatrix,
      committedMatrix: diagram2MatrixText(committedViewportTransform),
      matrixDifference: matrixDifferenceText(matrixDifference),
      cursorScreenPoint: pointText(gesture.cursorScreenPoint),
      worldPointUnderCursor: pointText(gesture.worldPointUnderCursor),
      screenPointAfterSettle: pointText(screenPointAfterSettle),
      entityBoundingBoxBeforeSettle: boundsText(gesture.entityBoundsBefore),
      entityBoundingBoxAfterSettle: boundsText(entityBoundsAfter),
      nodeIdentityBeforeAfter: String(gesture.objectNodeBefore === firstEntityNode() && gesture.textNodeBefore === firstEntityTextNode()),
      fullRendersDuringSettle: fullRenderCount - gesture.fullRenderCount,
      routesRecalculatedDuringSettle: relationshipRouteRevision - gesture.relationshipRouteRevision
    };
    pendingViewportGesture = null;
    if (matrixDifference.translation > 0.1 || matrixDifference.scale > 0.0001) {
      console.warn?.("Diagram 2 viewport transform settled with a visible matrix difference.", lastTransformDiagnostics);
    }

    if (svg) {
      svg.dataset.diagram2ViewportScale = formatNumber(committedViewportTransform.scale);
      svg.dataset.diagram2ViewportTranslateX = formatNumber(committedViewportTransform.translateX);
      svg.dataset.diagram2ViewportTranslateY = formatNumber(committedViewportTransform.translateY);
      svg.dataset.diagram2ViewportMatrix = lastTransformDiagnostics.committedMatrix;
      svg.dataset.diagram2ViewportReason = String(reason || "");
    }

    lastDiagnostics = {
      ...lastDiagnostics,
      ...lastTransformDiagnostics,
      ...lastViewportHaloDiagnostics,
      ...overviewDetailResult.diagnostics,
      ...viewportHaloResult?.selectiveDiagnostics,
      mountedObjectCount: liveView.mountedObjectIds.size,
      mountedRelationshipCount: liveView.mountedRelationshipIds.size,
      svgDescendantCount: svg ? svg.querySelectorAll("*").length : 0
    };
    if (viewportHaloResult?.selectiveDiagnostics) {
      lastSelectiveRoutingDiagnostics = viewportHaloResult.selectiveDiagnostics;
    }
    mark(performanceApi, `${frameId}:end`);
    measure(performanceApi, "diagram2 viewport transform", `${frameId}:start`, `${frameId}:end`);
    applyDiagnosticsAttributes();
    notifyDiagnostics();
  }

  function fitViewportTransform(state, viewport) {
    return diagram2FitViewportTransform(state, viewport, {
      padding: fitViewportPadding,
      scaleStep: fitViewportScaleStep
    });
  }

  function zoomToScale(scale, cursorScreenPoint) {
    return diagram2ZoomAtTransform(viewportTransform, scale, cursorScreenPoint);
  }

  function viewportSize() {
    const rect = host.getBoundingClientRect?.();
    return {
      width: Math.max(1, Math.round(rect?.width || host.clientWidth || defaultDiagram2Width)),
      height: Math.max(1, Math.round(rect?.height || host.clientHeight || defaultDiagram2Height))
    };
  }

  function viewportCenterPoint() {
    const viewport = viewportSize();
    return {
      x: viewport.width / 2,
      y: viewport.height / 2
    };
  }

  function localScreenPoint(point = {}) {
    const rect = host.getBoundingClientRect?.();
    if (Number.isFinite(Number(point.clientX)) && Number.isFinite(Number(point.clientY)) && rect) {
      return {
        x: Number(point.clientX) - rect.left,
        y: Number(point.clientY) - rect.top
      };
    }
    if (Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))) {
      return {
        x: Number(point.x),
        y: Number(point.y)
      };
    }
    return viewportCenterPoint();
  }

  function firstEntityNode() {
    return planes.objects?.querySelector?.("[data-diagram2-object-type='entity']") || null;
  }

  function firstEntityTextNode() {
    return firstEntityNode()?.querySelector?.("text") || null;
  }

  function firstEntityBounds() {
    const rect = firstEntityNode()?.getBoundingClientRect?.();
    if (!rect) return null;
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };
  }

  function applyDiagnosticsAttributes() {
    if (!svg) return;
    svg.dataset.diagram2CanonicalObjectCount = String(lastDiagnostics.canonicalObjectCount);
    svg.dataset.diagram2CanonicalEntityCount = String(lastDiagnostics.canonicalEntityCount);
    svg.dataset.diagram2CanonicalRelationshipCount = String(lastDiagnostics.canonicalRelationshipCount);
    svg.dataset.diagram2MountedObjectCount = String(lastDiagnostics.mountedObjectCount);
    svg.dataset.diagram2MountedRelationshipCount = String(lastDiagnostics.mountedRelationshipCount);
    svg.dataset.diagram2SvgDescendantCount = String(lastDiagnostics.svgDescendantCount);
    svg.dataset.diagram2FullRenderCount = String(lastDiagnostics.fullRenderCount);
    svg.dataset.diagram2FullRenderReason = String(lastDiagnostics.fullRenderReason);
    svg.dataset.diagram2ObjectsPatchedInLastFlush = String(lastDiagnostics.objectsPatchedInLastFlush);
    svg.dataset.diagram2RelationshipsRoutedInLastFlush = String(lastDiagnostics.relationshipsRoutedInLastFlush);
    svg.dataset.diagram2DirtyFlushReason = String(lastDiagnostics.dirtyFlushReason);
    svg.dataset.diagram2DirtyObjectIds = String(lastDiagnostics.dirtyObjectIds);
    svg.dataset.diagram2DirtyRelationshipIds = String(lastDiagnostics.dirtyRelationshipIds);
    svg.dataset.diagram2PatchedNodeCount = String(lastDiagnostics.patchedNodeCount);
    svg.dataset.diagram2RoutedRelationshipCount = String(lastDiagnostics.routedRelationshipCount);
    svg.dataset.diagram2LastFlushDuration = String(lastDiagnostics.lastFlushDuration);
    svg.dataset.diagram2DirtyFlushCount = String(lastDiagnostics.dirtyFlushCount);
    svg.dataset.diagram2PendingDiagramFlush = String(lastDiagnostics.pendingDiagramFlush);
    svg.dataset.diagram2TransactionDepth = String(lastDiagnostics.transactionDepth);
    svg.dataset.diagram2GeometryPreviewActive = String(lastDiagnostics.geometryPreviewActive);
    svg.dataset.diagram2GeometryPreviewReason = String(lastDiagnostics.geometryPreviewReason);
    svg.dataset.diagram2GeometryPreviewObjectIds = String(lastDiagnostics.geometryPreviewObjectIds);
    svg.dataset.diagram2GeometryPreviewRelationshipIds = String(lastDiagnostics.geometryPreviewRelationshipIds);
    svg.dataset.diagram2GeometryPreviewFrameCount = String(lastDiagnostics.geometryPreviewFrameCount);
    svg.dataset.diagram2GeometryPreviewPatchedObjectCount = String(lastDiagnostics.geometryPreviewPatchedObjectCount);
    svg.dataset.diagram2GeometryPreviewRelationshipCount = String(lastDiagnostics.geometryPreviewRelationshipCount);
    svg.dataset.diagram2GeometryPreviewLastDuration = String(lastDiagnostics.geometryPreviewLastDuration);
    svg.dataset.diagram2GeometryPreviewCommitCount = String(lastDiagnostics.geometryPreviewCommitCount);
    svg.dataset.diagram2GeometryPreviewUndoEntryCount = String(lastDiagnostics.geometryPreviewUndoEntryCount);
    svg.dataset.diagram2GeometryPreviewInitialMatrix = String(lastDiagnostics.geometryPreviewInitialMatrix);
    svg.dataset.diagram2GeometryPreviewSettledRouteCount = String(lastDiagnostics.geometryPreviewSettledRouteCount);
    svg.dataset.diagram2PendingGeometryPreview = String(lastDiagnostics.pendingGeometryPreview);
    svg.dataset.diagram2SelectiveRoutingTotalRelationships = String(lastDiagnostics.selectiveRoutingTotalRelationships);
    svg.dataset.diagram2SelectiveRoutingRelationshipsConsidered = String(lastDiagnostics.selectiveRoutingRelationshipsConsidered);
    svg.dataset.diagram2SelectiveRoutingRelationshipsRerouted = String(lastDiagnostics.selectiveRoutingRelationshipsRerouted);
    svg.dataset.diagram2SelectiveRoutingCacheHits = String(lastDiagnostics.selectiveRoutingCacheHits);
    svg.dataset.diagram2SelectiveRoutingCacheMisses = String(lastDiagnostics.selectiveRoutingCacheMisses);
    svg.dataset.diagram2SelectiveRoutingSpatialSectorsQueried = String(lastDiagnostics.selectiveRoutingSpatialSectorsQueried);
    svg.dataset.diagram2SelectiveRoutingDuration = String(lastDiagnostics.selectiveRoutingDuration);
    svg.dataset.diagram2ViewportHaloActive = String(lastDiagnostics.viewportHaloActive);
    svg.dataset.diagram2ViewportHaloReason = String(lastDiagnostics.viewportHaloReason);
    svg.dataset.diagram2ViewportHaloFallbackReason = String(lastDiagnostics.viewportHaloFallbackReason);
    svg.dataset.diagram2ViewportHaloSectorSize = String(lastDiagnostics.viewportHaloSectorSize);
    svg.dataset.diagram2ViewportHaloSectorCount = String(lastDiagnostics.viewportHaloSectorCount);
    svg.dataset.diagram2ViewportHaloSectorSignature = String(lastDiagnostics.viewportHaloSectorSignature);
    svg.dataset.diagram2ViewportHaloBounds = String(lastDiagnostics.viewportHaloBounds);
    svg.dataset.diagram2ViewportHaloViewportBounds = String(lastDiagnostics.viewportHaloViewportBounds);
    svg.dataset.diagram2ViewportHaloObjectCoverage = String(lastDiagnostics.viewportHaloObjectCoverage);
    svg.dataset.diagram2ViewportHaloRelationshipCoverage = String(lastDiagnostics.viewportHaloRelationshipCoverage);
    svg.dataset.diagram2ViewportHaloCombinedCoverage = String(lastDiagnostics.viewportHaloCombinedCoverage);
    svg.dataset.diagram2ViewportHaloTargetObjectCount = String(lastDiagnostics.viewportHaloTargetObjectCount);
    svg.dataset.diagram2ViewportHaloTargetRelationshipCount = String(lastDiagnostics.viewportHaloTargetRelationshipCount);
    svg.dataset.diagram2ViewportHaloVirtualizedObjectCount = String(lastDiagnostics.viewportHaloVirtualizedObjectCount);
    svg.dataset.diagram2ViewportHaloVirtualizedRelationshipCount = String(lastDiagnostics.viewportHaloVirtualizedRelationshipCount);
    svg.dataset.diagram2ViewportHaloForceMountedObjectCount = String(lastDiagnostics.viewportHaloForceMountedObjectCount);
    svg.dataset.diagram2ViewportHaloForceMountedRelationshipCount = String(lastDiagnostics.viewportHaloForceMountedRelationshipCount);
    svg.dataset.diagram2ViewportHaloRouteOnlyRelationshipCount = String(lastDiagnostics.viewportHaloRouteOnlyRelationshipCount);
    svg.dataset.diagram2ViewportHaloEnteringObjectCount = String(lastDiagnostics.viewportHaloEnteringObjectCount);
    svg.dataset.diagram2ViewportHaloLeavingObjectCount = String(lastDiagnostics.viewportHaloLeavingObjectCount);
    svg.dataset.diagram2ViewportHaloRetainedObjectCount = String(lastDiagnostics.viewportHaloRetainedObjectCount);
    svg.dataset.diagram2ViewportHaloEnteringRelationshipCount = String(lastDiagnostics.viewportHaloEnteringRelationshipCount);
    svg.dataset.diagram2ViewportHaloLeavingRelationshipCount = String(lastDiagnostics.viewportHaloLeavingRelationshipCount);
    svg.dataset.diagram2ViewportHaloRetainedRelationshipCount = String(lastDiagnostics.viewportHaloRetainedRelationshipCount);
    svg.dataset.diagram2ViewportHaloObjectPatchCount = String(lastDiagnostics.viewportHaloObjectPatchCount);
    svg.dataset.diagram2ViewportHaloRelationshipPatchCount = String(lastDiagnostics.viewportHaloRelationshipPatchCount);
    svg.dataset.diagram2ViewportHaloRoutedRelationshipCount = String(lastDiagnostics.viewportHaloRoutedRelationshipCount);
    svg.dataset.diagram2ViewportHaloSameSectorNoop = String(lastDiagnostics.viewportHaloSameSectorNoop);
    svg.dataset.diagram2ViewportHaloDuration = String(lastDiagnostics.viewportHaloDuration);
    svg.dataset.diagram2OverviewDetailLevel = String(lastDiagnostics.overviewDetailLevel);
    svg.dataset.diagram2OverviewDetailReason = String(lastDiagnostics.overviewDetailReason);
    svg.dataset.diagram2OverviewDetailPreviousLevel = String(lastDiagnostics.overviewDetailPreviousLevel);
    svg.dataset.diagram2OverviewDetailChanged = String(lastDiagnostics.overviewDetailChanged);
    svg.dataset.diagram2OverviewDetailProjectedRowPixels = String(lastDiagnostics.overviewDetailProjectedRowPixels);
    svg.dataset.diagram2OverviewDetailEnterRowPixels = String(lastDiagnostics.overviewDetailEnterRowPixels);
    svg.dataset.diagram2OverviewDetailExitRowPixels = String(lastDiagnostics.overviewDetailExitRowPixels);
    svg.dataset.diagram2OverviewDetailEntityCount = String(lastDiagnostics.overviewDetailEntityCount);
    svg.dataset.diagram2OverviewDetailLowObjectCount = String(lastDiagnostics.overviewDetailLowObjectCount);
    svg.dataset.diagram2OverviewDetailDetailedObjectCount = String(lastDiagnostics.overviewDetailDetailedObjectCount);
    svg.dataset.diagram2OverviewDetailLowRelationshipCount = String(lastDiagnostics.overviewDetailLowRelationshipCount);
    svg.dataset.diagram2OverviewDetailDetailedRelationshipCount = String(lastDiagnostics.overviewDetailDetailedRelationshipCount);
    svg.dataset.diagram2OverviewDetailObjectPatchCount = String(lastDiagnostics.overviewDetailObjectPatchCount);
    svg.dataset.diagram2OverviewDetailRelationshipPatchCount = String(lastDiagnostics.overviewDetailRelationshipPatchCount);
    svg.dataset.diagram2OverviewDetailDuration = String(lastDiagnostics.overviewDetailDuration);
    svg.dataset.diagram2TransientMatrix = String(lastDiagnostics.transientMatrix);
    svg.dataset.diagram2CommittedMatrix = String(lastDiagnostics.committedMatrix);
    svg.dataset.diagram2MatrixDifference = String(lastDiagnostics.matrixDifference);
    svg.dataset.diagram2CursorScreenPoint = String(lastDiagnostics.cursorScreenPoint);
    svg.dataset.diagram2WorldPointUnderCursor = String(lastDiagnostics.worldPointUnderCursor);
    svg.dataset.diagram2ScreenPointAfterSettle = String(lastDiagnostics.screenPointAfterSettle);
    svg.dataset.diagram2EntityBoundingBoxBeforeSettle = String(lastDiagnostics.entityBoundingBoxBeforeSettle);
    svg.dataset.diagram2EntityBoundingBoxAfterSettle = String(lastDiagnostics.entityBoundingBoxAfterSettle);
    svg.dataset.diagram2NodeIdentityBeforeAfter = String(lastDiagnostics.nodeIdentityBeforeAfter);
    svg.dataset.diagram2FullRendersDuringSettle = String(lastDiagnostics.fullRendersDuringSettle);
    svg.dataset.diagram2RoutesRecalculatedDuringSettle = String(lastDiagnostics.routesRecalculatedDuringSettle);
  }

  function notifyDiagnostics() {
    if (typeof onDiagnostics !== "function") return;
    onDiagnostics(diagnostics());
  }

  return {
    render,
    fit,
    setZoom,
    zoomBy,
    panBy,
    beginDiagramUpdate,
    endDiagramUpdate,
    scheduleDiagramFlush,
    flushDiagramChanges,
    whenIdle,
    beginGeometryPreview,
    previewGeometry,
    commitGeometryPreview,
    cancelGeometryPreview,
    addObject,
    addObjects,
    removeObject,
    removeObjects,
    setObjectOrder,
    updateObject,
    patchObject: updateObject,
    setSelectedIds,
    setCanvasOptions,
    objectIdsInBounds,
    previewMarquee,
    clearMarquee,
    viewportMatrix,
    screenToWorld,
    worldToScreen,
    diagnostics,
    liveViewSnapshot,
    destroy,
    svgNode
  };
}

function cancelDiagram2Frame(frameId) {
  if (!frameId) return;
  if (typeof globalThis.cancelAnimationFrame === "function") globalThis.cancelAnimationFrame(frameId);
  else if (typeof globalThis.clearTimeout === "function") globalThis.clearTimeout(frameId);
}

function clearDiagram2LiveView(liveView) {
  liveView.objectNodesById.clear();
  liveView.relationshipNodesById.clear();
  liveView.mountedObjectIds.clear();
  liveView.mountedRelationshipIds.clear();
  liveView.selectedIds.clear();
  liveView.objectVersionsById.clear();
  liveView.relationshipVersionsById.clear();
  liveView.objectDataById.clear();
  liveView.relationshipDataById.clear();
  liveView.objectDetailLevelsById.clear();
  liveView.relationshipDetailLevelsById.clear();
}

function clearDiagram2RoutingState(routing) {
  routing.relationshipIdsByEntityId.clear();
  routing.relationshipIdsByFieldAnchor.clear();
  routing.relationshipBoundsById.clear();
  routing.relationshipRouteSignaturesById.clear();
  routing.relationshipStyleSignaturesById.clear();
  routing.relationshipRoutesById.clear();
  routing.entityProtectedBoundsById.clear();
  routing.entityProtectedSectorIndex.clear();
  routing.relationshipRouteSectorIndex.clear();
  routing.routingObstacleBoundsById.clear();
  routing.routingObstacleSectorIndex.clear();
  routing.obstacleGeneration = 0;
  routing.obstacleGenerationBySectorKey.clear();
}

function clearDiagram2ViewportHaloState(viewportHalo) {
  viewportHalo.active = false;
  viewportHalo.sectorSignature = "";
  viewportHalo.forceSignature = "";
  viewportHalo.canonicalObjectCount = 0;
  viewportHalo.canonicalRelationshipCount = 0;
  viewportHalo.objectIds.clear();
  viewportHalo.relationshipIds.clear();
  viewportHalo.objectSectorIndex.clear();
  viewportHalo.relationshipSectorIndex.clear();
}

function patchObjectNode(node, previousObject, object, flags = {}, state) {
  setSvgAttributes(node, {
    "data-diagram2-object-id": object.id,
    "data-diagram2-object-type": object.type,
    "data-diagram2-object-detail-level": flags.detailLevel || diagram2DetailLevelDetailed,
    "data-diagram2-object-visible": object.visible !== false ? "true" : "false",
    "data-diagram2-object-locked": object.locked === true ? "true" : "false",
    "data-diagram2-object-transform-x": objectTranslation(object).x,
    "data-diagram2-object-transform-y": objectTranslation(object).y,
    class: `diagram2-renderer-object is-${cssClassName(object.type)}${flags.selected ? " is-selected" : ""}${object.locked === true ? " is-locked" : ""}`,
    transform: objectTransformText(object),
    opacity: safeOpacity(object.opacity)
  });

  if (flags.rebuild || !node.hasChildNodes()) {
    node.replaceChildren();
    renderObjectContents(node, diagram2LocalObject(object), state, {
      detailLevel: flags.detailLevel || diagram2DetailLevelDetailed
    });
    return;
  }

  patchObjectSelection(node, object.id, flags.selected === true);
  if (object.type === "entity" && !diagram2IsFieldRectangle(object)) {
    patchEntityObjectNode(node, object, flags.detailLevel || diagram2DetailLevelDetailed);
  } else {
    patchSimpleObjectStyles(node, object);
  }
}

function renderObjectContents(node, object, state, options = {}) {
  if (object.type === "entity") {
    renderEntityObject(node, object, options);
  } else if (object.type === "embedded-image") {
    renderEmbeddedImageObject(node, object);
  } else if (object.type === "rectangle") {
    renderRectangleObject(node, object);
  } else if (object.type === "circle") {
    renderCircleObject(node, object);
  } else if (object.type === "arrow") {
    renderArrowObject(node, object);
  } else if (object.type === "line") {
    renderLineObject(node, object);
  } else if (object.type === "textbox") {
    renderTextboxObject(node, object);
  } else if (object.type === "rich-text") {
    renderRichTextObject(node, object);
  } else if (object.type === "field-mapping-table") {
    renderFieldMappingTableObject(node, object);
  } else {
    renderUnknownObject(node, object, state);
  }
}

function patchObjectSelection(node, id, selected = null) {
  const isSelected = selected == null ? node.classList.contains("is-selected") : selected;
  node.classList.toggle("is-selected", isSelected);
}

function patchRelationshipSelection(node, id, selected = null) {
  const isSelected = selected == null
    ? node.classList.contains("is-selected")
    : selected;
  node.classList.toggle("is-selected", isSelected);
}

function patchEntityObjectNode(node, object, detailLevel = diagram2DetailLevelDetailed) {
  const local = diagram2LocalObject(object);
  const fields = annotationEntityVisibleFields(local);
  const title = node.querySelector(":scope > title");
  if (title) title.textContent = `${formatEntityIdentifier(object.entitySchema, object.entityName)} (${fields.length} fields)`;
  const entityTitle = node.querySelector("[data-diagram2-entity-title]");
  if (entityTitle) entityTitle.textContent = formatEntityIdentifier(object.entitySchema, object.entityName);
  patchEntityObjectNodeStyles(node, local, detailLevel);
}

function patchEntityObjectNodeStyles(node, object, detailLevel = diagram2DetailLevelDetailed) {
  const metrics = annotationEntityMetrics(object);
  const stroke = object.outlineVisible === false ? "none" : object.stroke || "#42526b";
  const textColor = object.textColor || "#172b4d";
  const lowDetail = detailLevel === diagram2DetailLevelLow;
  const lowDetailFontSize = lowDetailEntityFontSize(object);
  setSvgAttributes(node.querySelector("[data-diagram2-entity-body]"), {
    fill: object.fill || "#ffffff"
  });
  setSvgAttributes(node.querySelector("[data-diagram2-entity-header]"), {
    fill: object.entityHeaderFill || ((object.fill || "#ffffff") === "none" ? "#ffffff" : object.fill || "#ffffff")
  });
  setSvgAttributes(node.querySelector("[data-diagram2-entity-outline]"), {
    stroke,
    "stroke-width": positiveNumber(object.strokeWidth, 1),
    "vector-effect": null
  });
  node.querySelectorAll("[data-diagram2-entity-rule]").forEach(rule => {
    setSvgAttributes(rule, {
      stroke,
      "stroke-width": Math.max(0.5, positiveNumber(object.strokeWidth, 1) * 0.55)
    });
  });
  node.querySelectorAll("[data-diagram2-entity-text]").forEach(text => {
    const isTitle = text.hasAttribute("data-diagram2-entity-title");
    const isKey = text.hasAttribute("data-diagram2-entity-key");
    const isDataType = text.hasAttribute("data-diagram2-entity-data-type");
    const isNullability = text.hasAttribute("data-diagram2-entity-nullability");
    setSvgAttributes(text, {
      fill: isTitle ? object.entityNameTextColor || textColor : textColor,
      "font-family": object.fontFamily || "Arial",
      "font-size": lowDetail ? lowDetailFontSize
        : isTitle ? metrics.fontSize * 1.05
          : isKey || isNullability ? metrics.fontSize * 0.82
            : isDataType ? metrics.fontSize * 0.86
              : metrics.fontSize
    });
  });
}

function patchSimpleObjectStyles(node, object) {
  if (diagram2IsFieldRectangle(object)) {
    setSvgAttributes(node.querySelector(".diagram2-renderer-field-rectangle"), {
      fill: object.fill || "transparent",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#f59e0b",
      "stroke-width": positiveNumber(object.strokeWidth, 2),
      "vector-effect": null
    });
    return;
  }

  if (object.type === "rectangle") {
    setSvgAttributes(node.querySelector(".diagram2-renderer-rectangle"), {
      fill: object.fill || "none",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
      "stroke-width": positiveNumber(object.strokeWidth, 1),
      "vector-effect": null
    });
  } else if (object.type === "circle") {
    setSvgAttributes(node.querySelector(".diagram2-renderer-circle"), {
      fill: object.fill || "none",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
      "stroke-width": positiveNumber(object.strokeWidth, 1),
      "vector-effect": null
    });
  } else if (object.type === "textbox") {
    setSvgAttributes(node.querySelector(".diagram2-renderer-textbox-frame"), {
      fill: object.fill || "none",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
      "stroke-width": positiveNumber(object.strokeWidth, 1),
      "vector-effect": null
    });
    setSvgAttributes(node.querySelector(".diagram2-renderer-textbox-text"), {
      fill: object.textColor || "#172b4d",
      "font-family": object.fontFamily || "Arial"
    });
  } else if (object.type === "rich-text") {
    setSvgAttributes(node.querySelector(".diagram2-renderer-rich-text-frame"), {
      fill: object.fill === "none" ? "transparent" : object.fill || "transparent",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
      "stroke-width": positiveNumber(object.strokeWidth, 1),
      "vector-effect": null
    });
    const surface = node.querySelector(".diagram2-renderer-rich-text-surface");
    if (surface) {
      surface.style.color = object.textColor || "#172b4d";
      surface.style.fontFamily = object.fontFamily || "Arial";
      surface.style.fontSize = `${positiveNumber(object.fontSize, 16)}px`;
    }
  } else if (object.type === "arrow") {
    const stroke = object.stroke || "#334155";
    const geometry = annotationArrowGeometry(object);
    const shaft = node.querySelector(".diagram2-renderer-arrow-shaft");
    setSvgAttributes(shaft, {
      x1: finiteNumber(object.x1, 0),
      y1: finiteNumber(object.y1, 0),
      x2: geometry.shaftEnd.x,
      y2: geometry.shaftEnd.y,
      stroke,
      "stroke-width": positiveNumber(object.strokeWidth, 2),
      "stroke-linecap": "round",
      "vector-effect": null
    });
    setSvgAttributes(node.querySelector(".diagram2-renderer-arrow-head"), {
      points: diagram2PointListText(geometry.headPoints),
      fill: stroke
    });
  } else if (object.type === "line") {
    const stroke = object.stroke || "#334155";
    setSvgAttributes(node.querySelector(".diagram2-renderer-line"), {
      stroke,
      "stroke-width": positiveNumber(object.strokeWidth, 2),
      "vector-effect": null
    });
  }
}

function renderEntityObject(node, object, options = {}) {
  if (diagram2IsFieldRectangle(object)) {
    renderFieldRectangleObject(node, object);
    return;
  }

  if (options.detailLevel === diagram2DetailLevelLow) {
    renderLowDetailEntityObject(node, object);
    return;
  }

  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  const metrics = annotationEntityMetrics(object);
  const fields = annotationEntityVisibleFields(object);
  const stroke = object.outlineVisible === false ? "none" : object.stroke || "#42526b";
  const fill = object.fill || "#ffffff";
  const headerFill = object.entityHeaderFill || (fill === "none" ? "#ffffff" : fill);
  const textColor = object.textColor || "#172b4d";
  const headerTextColor = object.entityNameTextColor || textColor;
  const headerY = y + metrics.headerHeight;
  const showKeyColumn = object.showKeyColumn !== false;
  const showDataTypes = object.showDataTypes === true;
  const keyColumnWidth = showKeyColumn ? Math.min(metrics.keyColumnWidth, width * 0.22) : 0;
  const detailWidth = Math.max(0, width - keyColumnWidth);
  const notColumnWidth = showDataTypes ? Math.min(metrics.notColumnWidth, detailWidth * 0.13) : 0;
  const nullColumnWidth = showDataTypes ? Math.min(metrics.nullColumnWidth, detailWidth * 0.15) : 0;
  const dataTypeColumnWidth = showDataTypes ? Math.min(metrics.dataTypeColumnWidth, detailWidth * 0.38) : 0;
  const fieldX = x + keyColumnWidth;
  const dataTypeX = x + width - dataTypeColumnWidth - notColumnWidth - nullColumnWidth;
  const notX = dataTypeX + dataTypeColumnWidth;
  const nullX = notX + notColumnWidth;
  const fieldWidth = Math.max(0, dataTypeX - fieldX);
  const bodyHeight = Math.max(0, height - metrics.headerHeight);
  const gridLineWidth = Math.max(0.5, positiveNumber(object.strokeWidth, 1) * 0.55);
  const firstNonPrimaryKeyIndex = fields.findIndex(field => !field.isPrimaryKey);
  const leadingPrimaryKeyCount = firstNonPrimaryKeyIndex < 0 ? fields.length : firstNonPrimaryKeyIndex;
  const fieldClipId = `${safeSvgId(object.id)}-diagram2-fields`;
  const titleClipId = `${safeSvgId(object.id)}-diagram2-title`;
  const keyClipId = `${safeSvgId(object.id)}-diagram2-keys`;
  const dataTypeClipId = `${safeSvgId(object.id)}-diagram2-data-types`;
  const notClipId = `${safeSvgId(object.id)}-diagram2-not`;
  const nullClipId = `${safeSvgId(object.id)}-diagram2-null`;

  const defs = appendSvg(node, "defs");
  appendClipRect(defs, titleClipId, x + metrics.padding, y, Math.max(1, width - (metrics.padding * 2)), metrics.headerHeight);
  if (showKeyColumn) appendClipRect(defs, keyClipId, x, headerY, Math.max(1, keyColumnWidth), Math.max(1, bodyHeight));
  appendClipRect(defs, fieldClipId, fieldX, headerY, Math.max(1, fieldWidth), Math.max(1, bodyHeight));
  if (showDataTypes) {
    appendClipRect(defs, dataTypeClipId, dataTypeX, headerY, Math.max(1, dataTypeColumnWidth), Math.max(1, bodyHeight));
    appendClipRect(defs, notClipId, notX, headerY, Math.max(1, notColumnWidth), Math.max(1, bodyHeight));
    appendClipRect(defs, nullClipId, nullX, headerY, Math.max(1, nullColumnWidth), Math.max(1, bodyHeight));
  }

  appendTitle(node, `${formatEntityIdentifier(object.entitySchema, object.entityName)} (${fields.length} fields)`);
  appendSvg(node, "rect", {
    class: "diagram2-renderer-entity-body",
    "data-diagram2-entity-body": "",
    x,
    y,
    width,
    height,
    fill,
    stroke: "none"
  });
  appendSvg(node, "rect", {
    class: "diagram2-renderer-entity-header",
    "data-diagram2-entity-header": "",
    x,
    y,
    width,
    height: metrics.headerHeight,
    fill: headerFill,
    stroke: "none"
  });
  appendText(node, formatEntityIdentifier(object.entitySchema, object.entityName), {
    class: "diagram2-renderer-entity-title",
    "data-diagram2-entity-title": "",
    "data-diagram2-entity-text": "",
    x: x + (width / 2),
    y: y + (metrics.headerHeight * 0.68),
    "text-anchor": "middle",
    "clip-path": `url(#${titleClipId})`,
    fill: headerTextColor,
    "font-family": object.fontFamily || "Arial",
    "font-size": metrics.fontSize * 1.05,
    "font-weight": 700
  });
  appendSvg(node, "line", {
    "data-diagram2-entity-rule": "header",
    x1: x,
    y1: headerY,
    x2: x + width,
    y2: headerY,
    stroke,
    "stroke-width": gridLineWidth
  });

  if (showKeyColumn) {
    appendSvg(node, "line", {
      "data-diagram2-entity-rule": "key-column",
      x1: fieldX,
      y1: headerY,
      x2: fieldX,
      y2: y + height,
      stroke,
      "stroke-width": gridLineWidth
    });
  }

  if (showDataTypes && dataTypeColumnWidth > 0) {
    appendSvg(node, "line", {
      "data-diagram2-entity-rule": "data-type-column",
      x1: dataTypeX,
      y1: headerY,
      x2: dataTypeX,
      y2: y + height,
      stroke,
      "stroke-width": gridLineWidth
    });
  }

  if (showDataTypes && notColumnWidth > 0) {
    appendSvg(node, "line", {
      "data-diagram2-entity-rule": "not-column",
      x1: notX,
      y1: headerY,
      x2: notX,
      y2: y + height,
      stroke,
      "stroke-width": gridLineWidth
    });
  }

  if (showDataTypes && nullColumnWidth > 0) {
    appendSvg(node, "line", {
      "data-diagram2-entity-rule": "null-column",
      x1: nullX,
      y1: headerY,
      x2: nullX,
      y2: y + height,
      stroke,
      "stroke-width": gridLineWidth
    });
  }

  if (leadingPrimaryKeyCount > 0 && leadingPrimaryKeyCount < fields.length) {
    const primaryKeyDividerY = headerY + (leadingPrimaryKeyCount * metrics.rowHeight);
    appendSvg(node, "line", {
      "data-diagram2-entity-rule": "primary-key",
      x1: x,
      y1: primaryKeyDividerY,
      x2: x + width,
      y2: primaryKeyDividerY,
      stroke,
      "stroke-width": gridLineWidth
    });
  }

  fields.forEach((field, index) => {
    const rowTop = headerY + (index * metrics.rowHeight);
    const textY = rowTop + (metrics.rowHeight * 0.68);

    if (showKeyColumn) {
      const keyText = [field.isPrimaryKey ? "PK" : "", field.isForeignKey ? "FK" : ""].filter(Boolean).join("/");
      if (keyText) {
        appendText(node, keyText, {
          class: "diagram2-renderer-entity-key",
          "data-diagram2-entity-text": "",
          "data-diagram2-entity-key": "",
          x: x + (keyColumnWidth / 2),
          y: textY,
          "text-anchor": "middle",
          "clip-path": `url(#${keyClipId})`,
          fill: textColor,
          "font-family": object.fontFamily || "Arial",
          "font-size": metrics.fontSize * 0.82
        });
      }
    }

    const fieldName = formatAnnotationEntityIdentifier(field.name);
    appendText(node, fieldName || "Field", {
      class: "diagram2-renderer-entity-field",
      "data-diagram2-entity-text": "",
      "data-diagram2-entity-field": "",
      x: fieldX + metrics.padding,
      y: textY,
      "clip-path": `url(#${fieldClipId})`,
      fill: textColor,
      "font-family": object.fontFamily || "Arial",
      "font-size": metrics.fontSize,
      "font-weight": field.isPrimaryKey ? 700 : null,
      "text-decoration": field.isPrimaryKey ? "underline" : null
    });

    if (showDataTypes) {
      const visibleDataType = [field.dataType, field.identity || (field.isIdentity ? "IDENTITY" : "")]
        .filter(Boolean)
        .join(" ");
      appendText(node, visibleDataType, {
        class: "diagram2-renderer-entity-data-type",
        "data-diagram2-entity-text": "",
        "data-diagram2-entity-data-type": "",
        x: dataTypeX + 8,
        y: textY,
        "clip-path": `url(#${dataTypeClipId})`,
        fill: textColor,
        "font-family": object.fontFamily || "Arial",
        "font-size": metrics.fontSize * 0.86
      });
      if (field.nullable === false) {
        appendText(node, "NOT", {
          class: "diagram2-renderer-entity-nullability",
          "data-diagram2-entity-text": "",
          "data-diagram2-entity-nullability": "not",
          x: notX + (notColumnWidth / 2),
          y: textY,
          "text-anchor": "middle",
          "clip-path": `url(#${notClipId})`,
          fill: textColor,
          "font-family": object.fontFamily || "Arial",
          "font-size": metrics.fontSize * 0.82
        });
      }
      if (field.nullable != null) {
        appendText(node, "NULL", {
          class: "diagram2-renderer-entity-nullability",
          "data-diagram2-entity-text": "",
          "data-diagram2-entity-nullability": "null",
          x: nullX + (nullColumnWidth / 2),
          y: textY,
          "text-anchor": "middle",
          "clip-path": `url(#${nullClipId})`,
          fill: textColor,
          "font-family": object.fontFamily || "Arial",
          "font-size": metrics.fontSize * 0.82
        });
      }
    }
  });

  appendSvg(node, "rect", {
    class: "diagram2-renderer-entity-outline",
    "data-diagram2-entity-outline": "",
    x,
    y,
    width,
    height,
    fill: "none",
    stroke,
    "stroke-width": positiveNumber(object.strokeWidth, 1)
  });
}

function renderLowDetailEntityObject(node, object) {
  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  const fields = annotationEntityVisibleFields(object);
  const stroke = object.outlineVisible === false ? "none" : object.stroke || "#2f5597";
  const fill = object.fill || "#ffffff";
  const headerFill = object.entityHeaderFill || "#dbeafe";
  const textColor = object.textColor || "#172b4d";
  const headerTextColor = object.entityNameTextColor || textColor;
  const fontSize = lowDetailEntityFontSize(object);
  const headerHeight = Math.min(height, Math.max(28, Math.min(height * 0.58, fontSize * 1.35)));
  const titleClipId = `${safeSvgId(object.id)}-diagram2-low-title`;
  const primaryKeyCount = fields.filter(field => field.isPrimaryKey).length;
  const foreignKeyCount = fields.filter(field => field.isForeignKey).length;

  const defs = appendSvg(node, "defs");
  appendClipRect(defs, titleClipId, x + 8, y, Math.max(1, width - 16), headerHeight);
  appendTitle(node, `${formatEntityIdentifier(object.entitySchema, object.entityName)} (${fields.length} fields)`);
  appendSvg(node, "rect", {
    class: "diagram2-renderer-entity-body",
    "data-diagram2-entity-body": "",
    x,
    y,
    width,
    height,
    fill,
    stroke: "none"
  });
  appendSvg(node, "rect", {
    class: "diagram2-renderer-entity-header",
    "data-diagram2-entity-header": "",
    x,
    y,
    width,
    height: headerHeight,
    fill: headerFill,
    stroke: "none"
  });
  appendText(node, formatEntityIdentifier(object.entitySchema, object.entityName), {
    class: "diagram2-renderer-entity-title",
    "data-diagram2-entity-title": "",
    "data-diagram2-entity-text": "",
    x: x + (width / 2),
    y: y + (headerHeight / 2),
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    "clip-path": `url(#${titleClipId})`,
    fill: headerTextColor,
    "font-family": object.fontFamily || "Arial",
    "font-size": fontSize,
    "font-weight": 700
  });

  if (primaryKeyCount > 0 || foreignKeyCount > 0) {
    const indicatorText = [primaryKeyCount ? `PK ${primaryKeyCount}` : "", foreignKeyCount ? `FK ${foreignKeyCount}` : ""]
      .filter(Boolean)
      .join(" / ");
    appendText(node, indicatorText, {
      class: "diagram2-renderer-entity-key diagram2-renderer-entity-compact-key",
      "data-diagram2-entity-text": "",
      "data-diagram2-entity-compact-key": "",
      x: x + Math.max(10, Math.min(width - 10, width * 0.5)),
      y: y + headerHeight + Math.max(12, Math.min(height - headerHeight - 10, fontSize * 0.72)),
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      fill: textColor,
      "font-family": object.fontFamily || "Arial",
      "font-size": Math.max(18, fontSize * 0.62),
      "font-weight": 700
    });
  }

  appendSvg(node, "rect", {
    class: "diagram2-renderer-entity-outline",
    "data-diagram2-entity-outline": "",
    x,
    y,
    width,
    height,
    fill: "none",
    stroke,
    "stroke-width": positiveNumber(object.strokeWidth, 1)
  });
}

function renderFieldRectangleObject(node, object) {
  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  appendTitle(node, object.fieldRectangleName || object.entityName || "Field rectangle");
  appendSvg(node, "rect", {
    class: "diagram2-renderer-field-rectangle",
    x,
    y,
    width,
    height,
    fill: object.fill || "transparent",
    stroke: object.outlineVisible === false ? "none" : object.stroke || "#f59e0b",
    "stroke-width": positiveNumber(object.strokeWidth, 2)
  });
}

function renderEmbeddedImageObject(node, object) {
  appendTitle(node, object.name || "Image");
  const image = appendSvg(node, "image", {
    class: "diagram2-renderer-image",
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1),
    preserveAspectRatio: "none"
  });
  image.setAttribute("href", object.source || "");
  image.setAttributeNS(xlinkNamespace, "href", object.source || "");
}

function renderRectangleObject(node, object) {
  appendSvg(node, "rect", {
    class: "diagram2-renderer-rectangle",
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1),
    fill: object.fill || "none",
    stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
    "stroke-width": positiveNumber(object.strokeWidth, 1),
    "pointer-events": "all"
  });
}

function renderCircleObject(node, object) {
  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  appendSvg(node, "ellipse", {
    class: "diagram2-renderer-circle",
    cx: x + (width / 2),
    cy: y + (height / 2),
    rx: width / 2,
    ry: height / 2,
    fill: object.fill || "none",
    stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
    "stroke-width": positiveNumber(object.strokeWidth, 1),
    "pointer-events": "all"
  });
}

function renderArrowObject(node, object) {
  renderConnector(node, object, true);
}

function renderLineObject(node, object) {
  renderConnector(node, object, false);
}

function renderConnector(node, object, arrow) {
  const x1 = finiteNumber(object.x1, 0);
  const y1 = finiteNumber(object.y1, 0);
  const x2 = finiteNumber(object.x2, 0);
  const y2 = finiteNumber(object.y2, 0);
  const stroke = object.stroke || "#334155";
  const strokeWidth = positiveNumber(object.strokeWidth, 2);
  const geometry = arrow ? annotationArrowGeometry(object) : null;

  appendSvg(node, "line", {
    class: arrow ? "diagram2-renderer-arrow-shaft" : "diagram2-renderer-line",
    x1,
    y1,
    x2: geometry ? geometry.shaftEnd.x : x2,
    y2: geometry ? geometry.shaftEnd.y : y2,
    stroke,
    "stroke-width": strokeWidth,
    "stroke-linecap": "round",
    "vector-effect": null
  });

  if (!arrow) return;
  appendSvg(node, "polygon", {
    class: "diagram2-renderer-arrow-head",
    points: diagram2PointListText(geometry.headPoints),
    fill: stroke
  });
}

function renderTextboxObject(node, object) {
  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  const fontSize = positiveNumber(object.fontSize, 16);
  const padding = Math.max(4, fontSize * 0.35);
  const lineHeight = fontSize * 1.2;
  const lines = wrapAnnotationText(object.text, width, fontSize);
  const maximumLines = Math.max(1, Math.floor(Math.max(1, height - (padding * 2)) / lineHeight));
  const visibleLines = lines.slice(0, maximumLines);
  const textAlign = safeDiagram2TextAlign(object.textAlign);
  const textVerticalAlign = safeDiagram2TextVerticalAlign(object.textVerticalAlign);
  const textX = textAlign === "center"
    ? x + (width / 2)
    : textAlign === "right"
      ? x + width - padding
      : x + padding;
  const textAnchor = textAlign === "center" ? "middle" : textAlign === "right" ? "end" : "start";
  const textAscent = fontSize * 0.8;
  const textBlockHeight = fontSize + (Math.max(0, visibleLines.length - 1) * lineHeight);
  const innerHeight = Math.max(0, height - (padding * 2));
  const freeSpace = Math.max(0, innerHeight - textBlockHeight);
  const verticalOffset = textVerticalAlign === "middle"
    ? freeSpace / 2
    : textVerticalAlign === "bottom"
      ? freeSpace
      : 0;
  const textY = y + padding + verticalOffset + textAscent;
  const clipId = `${safeSvgId(object.id)}-diagram2-text`;
  appendSvg(node, "defs").appendChild(svgClipRect(node, clipId, x, y, width, height));
  appendSvg(node, "rect", {
    class: "diagram2-renderer-textbox-frame",
    x,
    y,
    width,
    height,
    fill: object.fill || "none",
    stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
    "stroke-width": positiveNumber(object.strokeWidth, 1),
    "pointer-events": "all"
  });

  const text = appendSvg(node, "text", {
    class: "diagram2-renderer-textbox-text",
    x: textX,
    y: textY,
    "text-anchor": textAnchor,
    fill: object.textColor || "#172b4d",
    "font-family": object.fontFamily || "Arial",
    "font-size": fontSize,
    "clip-path": `url(#${clipId})`
  });
  visibleLines.forEach((line, index) => {
    appendText(text, line || " ", {
      x: textX,
      dy: index === 0 ? 0 : lineHeight
    }, "tspan");
  });
}

function renderRichTextObject(node, object) {
  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  const frame = appendSvg(node, "rect", {
    class: "diagram2-renderer-rich-text-frame",
    x,
    y,
    width,
    height,
    fill: object.fill === "none" ? "transparent" : object.fill || "transparent",
    stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
    "stroke-width": positiveNumber(object.strokeWidth, 1)
  });
  frame.setAttribute("pointer-events", "all");

  const foreignObject = appendSvg(node, "foreignObject", {
    class: "diagram2-renderer-rich-text",
    x,
    y,
    width,
    height,
    "pointer-events": "none"
  });
  const surface = node.ownerDocument.createElementNS(xhtmlNamespace, "div");
  surface.setAttribute("class", "diagram2-renderer-rich-text-surface rich-readonly");
  surface.style.color = object.textColor || "#172b4d";
  surface.style.fontFamily = object.fontFamily || "Arial";
  surface.style.fontSize = `${positiveNumber(object.fontSize, 16)}px`;
  surface.innerHTML = normalizeDiagram2RendererRichTextHtml(object.html);
  foreignObject.appendChild(surface);
}

function renderFieldMappingTableObject(node, object) {
  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  const rows = Array.isArray(object.rows) ? object.rows : [];
  const fontSize = positiveNumber(object.fontSize, 14);
  const rowHeight = Math.max(22, fontSize * 1.55);
  const headerHeight = rowHeight;
  const uiColumnWidth = width * 0.46;
  const databaseColumnWidth = width - uiColumnWidth;
  const stroke = object.stroke || "#334155";
  const rowHoverFill = object.fieldMappingRowHoverFill || "#fff59d";
  appendTitle(node, object.name || "Field Mapping Table");
  appendSvg(node, "rect", {
    class: "diagram2-renderer-field-mapping-header",
    x,
    y,
    width,
    height: headerHeight,
    fill: object.headerFill || "#e2e8f0",
    stroke: "none"
  });
  appendText(node, "UI Field", fieldMappingTextAttributes(object, x + 8, y + (headerHeight / 2), object.headerTextColor || "#172b4d"));
  appendText(node, "Database Field", fieldMappingTextAttributes(object, x + uiColumnWidth + 8, y + (headerHeight / 2), object.headerTextColor || "#172b4d"));

  rows.forEach((row, index) => {
    const top = y + headerHeight + (index * rowHeight);
    if (top > y + height) return;
    const rowGroup = appendSvg(node, "g", {
      "data-diagram2-field-mapping-row": "true",
      style: `--diagram2-field-mapping-row-hover-fill: ${rowHoverFill}`
    });
    appendSvg(rowGroup, "rect", {
      "data-diagram2-field-mapping-cell-fill": "true",
      x,
      y: top,
      width: uiColumnWidth,
      height: rowHeight,
      fill: object.uiFill || "#f8fafc"
    });
    appendSvg(rowGroup, "rect", {
      "data-diagram2-field-mapping-cell-fill": "true",
      x: x + uiColumnWidth,
      y: top,
      width: databaseColumnWidth,
      height: rowHeight,
      fill: object.databaseFill || "#ffffff"
    });
    appendText(rowGroup, row.uiField || "", fieldMappingTextAttributes(object, x + 8, top + (rowHeight / 2), object.uiTextColor || "#172b4d"));
    appendText(rowGroup, row.databaseField || "", fieldMappingTextAttributes(object, x + uiColumnWidth + 8, top + (rowHeight / 2), object.databaseTextColor || "#172b4d"));
    appendSvg(node, "line", {
      x1: x,
      y1: top,
      x2: x + width,
      y2: top,
      stroke,
      "stroke-width": positiveNumber(object.strokeWidth, 1),
      "vector-effect": "non-scaling-stroke"
    });
  });

  appendSvg(node, "line", {
    x1: x + uiColumnWidth,
    y1: y,
    x2: x + uiColumnWidth,
    y2: y + height,
    stroke,
    "stroke-width": positiveNumber(object.strokeWidth, 1),
    "vector-effect": "non-scaling-stroke"
  });
  appendSvg(node, "rect", {
    class: "diagram2-renderer-field-mapping-outline",
    x,
    y,
    width,
    height,
    fill: "none",
    stroke,
    "stroke-width": positiveNumber(object.strokeWidth, 1),
    "vector-effect": "non-scaling-stroke"
  });
}

function renderUnknownObject(node, object) {
  appendSvg(node, "rect", {
    class: "diagram2-renderer-unknown",
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1),
    fill: "none",
    stroke: "#94a3b8",
    "stroke-dasharray": "8 6",
    "stroke-width": 2,
    "vector-effect": "non-scaling-stroke"
  });
}

function patchRelationshipNode(node, previousRelationship, relationship, flags = {}) {
  setSvgAttributes(node, {
    "data-diagram2-relationship-id": relationship.id,
    "data-diagram2-relationship-source": relationship.source?.id || "",
    "data-diagram2-relationship-target": relationship.target?.id || "",
    "data-diagram2-relationship-detail-level": flags.detailLevel || diagram2DetailLevelDetailed,
    class: `diagram2-renderer-relationship-node${flags.selected ? " is-selected" : ""}`
  });

  const route = flags.route || relationshipRoute(relationship);
  const renderRoute = flags.detailLevel === diagram2DetailLevelLow
    ? lowDetailRelationshipRoute(relationship, route)
    : route;
  const style = relationshipStyle(relationship);
  let title = node.querySelector(":scope > title");
  if (!title) {
    title = createSvgElement(node, "title");
    node.insertBefore(title, node.firstChild);
  }
  title.textContent = `${formatEntityIdentifier(relationship.source?.entitySchema, relationship.source?.entityName)}.${relationship.sourceField?.name || ""} -> ${formatEntityIdentifier(relationship.target?.entitySchema, relationship.target?.entityName)}.${relationship.targetField?.name || ""}`;

  let path = node.querySelector(":scope > path[data-diagram2-relationship-path]");
  if (!path) {
    path = appendSvg(node, "path", {
      "data-diagram2-relationship-path": ""
    });
  }
  setSvgAttributes(path, {
    class: "diagram2-renderer-relationship diagram2-renderer-relationship-hit-path",
    "data-diagram2-relationship-path": "",
    d: renderRoute.path,
    fill: "none",
    stroke: "transparent",
    "stroke-width": style.strokeWidth,
    opacity: 0,
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
    "vector-effect": null
  });
}

function lowDetailRelationshipRoute(relationship, routeInput) {
  return routeInput || relationshipRoute(relationship);
}

function relationshipRoute(relationship, options = {}) {
  if (relationship?.diagram2RouteGeometry?.points?.length) {
    return relationshipRouteFromPoints(relationship.diagram2RouteGeometry.points);
  }

  const source = relationship.source;
  const target = relationship.target;
  const sourceCenter = objectCenter(source);
  const targetCenter = objectCenter(target);
  const relationships = Array.isArray(options.relationships) && options.relationships.length
    ? options.relationships
    : [relationship];
  const style = relationshipStyle(relationship);
  const fieldRectangleRoute = source !== target
    ? relationshipFieldRectangleRoute(relationship, style)
    : null;
  if (fieldRectangleRoute) {
    const manualPoints = options.manualRoutes === true
      ? manualRelationshipRoute(relationship, fieldRectangleRoute.start, fieldRectangleRoute.end)
      : null;
    return relationshipRouteFromPoints(manualPoints || fieldRectangleRoute.points);
  }

  if (source === target) {
    const x = finiteNumber(source.x, 0) + positiveNumber(source.width, 1);
    const margin = relationshipSelfMargin(source, style) + (relationship.foreignKeyIndex * 12);
    const start = {
      x,
      y: relationshipFieldAnchorY(source, relationship.sourceField)
    };
    const end = {
      x: finiteNumber(source.x, 0),
      y: relationshipFieldAnchorY(target, relationship.targetField)
    };
    const points = compactRelationshipRoutePoints([
      start,
      { x: finiteNumber(source.x, 0) + positiveNumber(source.width, 1) + margin, y: start.y },
      { x: finiteNumber(source.x, 0) + positiveNumber(source.width, 1) + margin, y: finiteNumber(source.y, 0) - margin },
      { x: finiteNumber(source.x, 0) - margin, y: finiteNumber(source.y, 0) - margin },
      { x: finiteNumber(source.x, 0) - margin, y: end.y },
      end
    ]);
    const manualPoints = options.manualRoutes === true
      ? manualRelationshipRoute(relationship, start, end)
      : null;
    return relationshipRouteFromPoints(manualPoints || points);
  }

  const allowSharedRoute = options.allowOverlappingLines === true
    || (source?.anchorTable === true && target?.anchorTable === true);
  let start;
  let end;
  let middleX;

  if (finiteNumber(target.x, 0) >= finiteNumber(source.x, 0) + positiveNumber(source.width, 1)
    || finiteNumber(source.x, 0) >= finiteNumber(target.x, 0) + positiveNumber(target.width, 1)) {
    const direction = targetCenter.x >= sourceCenter.x ? 1 : -1;
    start = {
      x: direction > 0 ? finiteNumber(source.x, 0) + positiveNumber(source.width, 1) : finiteNumber(source.x, 0),
      y: relationshipFieldAnchorY(source, relationship.sourceField)
    };
    end = {
      x: direction > 0 ? finiteNumber(target.x, 0) : finiteNumber(target.x, 0) + positiveNumber(target.width, 1),
      y: relationshipFieldAnchorY(target, relationship.targetField)
    };
    middleX = snapRelationshipRouteValue(
      allowSharedRoute
        ? (start.x + end.x) / 2
        : relationshipLane(start.x, end.x, relationship, relationships)
    );
    middleX = clampNumber(middleX, Math.min(start.x, end.x), Math.max(start.x, end.x));
  } else {
    const margin = Math.max(48, style.arrowSize * 2, style.strokeWidth * 4);
    const leftLane = Math.min(finiteNumber(source.x, 0), finiteNumber(target.x, 0)) - margin;
    const rightLane = Math.max(
      finiteNumber(source.x, 0) + positiveNumber(source.width, 1),
      finiteNumber(target.x, 0) + positiveNumber(target.width, 1)
    ) + margin;
    const leftDistance = (finiteNumber(source.x, 0) - leftLane) + (finiteNumber(target.x, 0) - leftLane);
    const rightDistance = (rightLane - (finiteNumber(source.x, 0) + positiveNumber(source.width, 1)))
      + (rightLane - (finiteNumber(target.x, 0) + positiveNumber(target.width, 1)));
    const useRightLane = rightDistance < leftDistance;
    const laneIndex = allowSharedRoute ? 0 : relationshipPairIndex(relationship, relationships);
    const laneOffset = laneIndex * relationshipClearance(style);
    middleX = snapRelationshipRouteValue(useRightLane ? rightLane + laneOffset : leftLane - laneOffset);
    start = {
      x: useRightLane ? finiteNumber(source.x, 0) + positiveNumber(source.width, 1) : finiteNumber(source.x, 0),
      y: relationshipFieldAnchorY(source, relationship.sourceField)
    };
    end = {
      x: useRightLane ? finiteNumber(target.x, 0) + positiveNumber(target.width, 1) : finiteNumber(target.x, 0),
      y: relationshipFieldAnchorY(target, relationship.targetField)
    };
  }

  const points = compactRelationshipRoutePoints([
    start,
    { x: middleX, y: start.y },
    { x: middleX, y: end.y },
    end
  ]);
  const manualPoints = options.manualRoutes === true
    ? manualRelationshipRoute(relationship, start, end)
    : null;
  return relationshipRouteFromPoints(manualPoints || points);
}

function relationshipRouteFromPoints(pointsInput) {
  const points = compactRelationshipRoutePoints((Array.isArray(pointsInput) ? pointsInput : [])
    .map(point => ({
      x: finiteNumber(point?.x, 0),
      y: finiteNumber(point?.y, 0)
    })));
  const [start] = points;
  const end = points[points.length - 1] || start || { x: 0, y: 0 };
  return {
    start: start || { x: 0, y: 0 },
    end,
    points,
    bounds: boundsFromPoints(points, diagram2ProtectedBoundsPadding / 2),
    path: relationshipPathFromPoints(points)
  };
}

function relationshipPathFromPoints(pointsInput) {
  const points = Array.isArray(pointsInput) ? pointsInput : [];
  if (!points.length) return "";
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    if (previous.y === point.y) return `${path} H ${formatNumber(point.x)}`;
    if (previous.x === point.x) return `${path} V ${formatNumber(point.y)}`;
    return `${path} L ${formatNumber(point.x)} ${formatNumber(point.y)}`;
  }, `M ${formatNumber(points[0].x)} ${formatNumber(points[0].y)}`);
}

function relationshipRouteOptions(relationshipsInput, state) {
  const relationships = Array.isArray(relationshipsInput) ? relationshipsInput : [];
  return {
    relationships,
    allowOverlappingLines: state?.allowOverlappingEntityLines === true,
    manualRoutes: state?.manualEntityRelationshipRoutes === true
  };
}

function objectCenter(object) {
  return {
    x: finiteNumber(object?.x, 0) + (positiveNumber(object?.width, 1) / 2),
    y: finiteNumber(object?.y, 0) + (positiveNumber(object?.height, 1) / 2)
  };
}

function relationshipFieldAnchorY(entity, field) {
  const bounds = annotationEntityFieldBounds(entity, field) || objectBounds(entity);
  return finiteNumber(bounds?.y, 0) + (positiveNumber(bounds?.height, 1) / 2);
}

function relationshipEndpoint(entity, field, side, role = "source") {
  const safeSide = ["left", "top", "right", "bottom"].includes(side) ? side : "right";
  const x = finiteNumber(entity?.x, 0);
  const y = finiteNumber(entity?.y, 0);
  const width = positiveNumber(entity?.width, 1);
  const height = positiveNumber(entity?.height, 1);
  const centerX = x + (width / 2);
  const anchorY = diagram2IsFieldRectangle(entity) ? y + (height / 2) : relationshipFieldAnchorY(entity, field);
  const source = role !== "target";
  if (safeSide === "left") return {
    point: { x, y: anchorY },
    unit: source ? { x: -1, y: 0 } : { x: 1, y: 0 }
  };
  if (safeSide === "top") return {
    point: { x: centerX, y },
    unit: source ? { x: 0, y: -1 } : { x: 0, y: 1 }
  };
  if (safeSide === "bottom") return {
    point: { x: centerX, y: y + height },
    unit: source ? { x: 0, y: 1 } : { x: 0, y: -1 }
  };
  return {
    point: { x: x + width, y: anchorY },
    unit: source ? { x: 1, y: 0 } : { x: -1, y: 0 }
  };
}

function relationshipFieldRectangleRoute(relationship, style) {
  const { source, sourceField, target, targetField } = relationship;
  if (!diagram2IsFieldRectangle(source) && !diagram2IsFieldRectangle(target)) return null;
  const sourceCenter = objectCenter(source);
  const targetCenter = objectCenter(target);
  const defaultSourceSide = targetCenter.x >= sourceCenter.x ? "right" : "left";
  const defaultTargetSide = targetCenter.x >= sourceCenter.x ? "left" : "right";
  const sourceEndpoint = relationshipEndpoint(
    source,
    sourceField,
    diagram2IsFieldRectangle(source) ? source.fieldRectangleConnectionSide : defaultSourceSide,
    "source"
  );
  const targetEndpoint = relationshipEndpoint(
    target,
    targetField,
    diagram2IsFieldRectangle(target) ? target.fieldRectangleConnectionSide : defaultTargetSide,
    "target"
  );
  const clearance = relationshipClearance(style);
  const start = sourceEndpoint.point;
  const end = targetEndpoint.point;
  const startEscape = {
    x: start.x + (sourceEndpoint.unit.x * clearance),
    y: start.y + (sourceEndpoint.unit.y * clearance)
  };
  const endEscape = {
    x: end.x - (targetEndpoint.unit.x * clearance),
    y: end.y - (targetEndpoint.unit.y * clearance)
  };
  const bend = Math.abs(startEscape.x - endEscape.x) >= Math.abs(startEscape.y - endEscape.y)
    ? { x: startEscape.x, y: endEscape.y }
    : { x: endEscape.x, y: startEscape.y };
  return {
    start,
    end,
    points: compactRelationshipRoutePoints([start, startEscape, bend, endEscape, end])
  };
}

function manualRelationshipRoute(relationship, start, end) {
  const route = normalizeRelationshipRouteOverride(
    relationship?.foreignKeySource?.routeOverride || relationship?.foreignKey?.routeOverride
  );
  if (route.length < 2) return null;
  const samePoint = (first, second) => Math.abs(first.x - second.x) <= 1
    && Math.abs(first.y - second.y) <= 1;
  if (!samePoint(route[0], start) || !samePoint(route.at(-1), end)) return null;
  return compactRelationshipRoutePoints(route.map((point, index) => {
    if (index === 0) return { x: start.x, y: start.y };
    if (index === route.length - 1) return { x: end.x, y: end.y };
    return point;
  }));
}

function relationshipSelfMargin(entity, style) {
  const metrics = annotationEntityMetrics(entity);
  return Math.max(
    48,
    metrics.rowHeight * 2,
    style.arrowSize * 2,
    style.strokeWidth * 4
  );
}

function relationshipClearance(style) {
  return Math.max(diagram2MinimumRelationshipClearance, positiveNumber(style?.strokeWidth, 2) * 4);
}

function relationshipLane(start, end, relationship, relationshipsInput) {
  const samePair = relationshipSamePair(relationship, relationshipsInput);
  const index = Math.max(0, samePair.indexOf(relationship));
  return start + ((end - start) * ((index + 1) / (samePair.length + 1)));
}

function relationshipPairIndex(relationship, relationshipsInput) {
  return Math.max(0, relationshipSamePair(relationship, relationshipsInput).indexOf(relationship));
}

function relationshipSamePair(relationship, relationshipsInput) {
  return (Array.isArray(relationshipsInput) ? relationshipsInput : [])
    .filter(candidate => candidate.source === relationship.source && candidate.target === relationship.target)
    .sort(compareDiagram2Relationships);
}

function compareDiagram2Relationships(first, second) {
  const key = relationship => [
    formatAnnotationEntityIdentifier(relationship.source?.entitySchema, relationship.source?.entityName),
    relationship.sourceField?.name || "",
    formatAnnotationEntityIdentifier(relationship.target?.entitySchema, relationship.target?.entityName),
    relationship.targetField?.name || ""
  ].join(".").toLocaleLowerCase();
  return key(first).localeCompare(key(second));
}

function snapRelationshipRouteValue(value) {
  const size = diagram2RelationshipGridSize;
  return Math.round(finiteNumber(value, 0) / size) * size;
}

function compactRelationshipRoutePoints(pointsInput) {
  const points = [];
  (Array.isArray(pointsInput) ? pointsInput : []).forEach(point => {
    const normalized = {
      x: Number(formatNumber(point?.x)),
      y: Number(formatNumber(point?.y))
    };
    if (!Number.isFinite(normalized.x) || !Number.isFinite(normalized.y)) return;
    const previous = points.at(-1);
    if (previous && previous.x === normalized.x && previous.y === normalized.y) return;
    points.push(normalized);
    while (points.length >= 3) {
      const first = points.at(-3);
      const middle = points.at(-2);
      const last = points.at(-1);
      if ((first.x === middle.x && middle.x === last.x)
        || (first.y === middle.y && middle.y === last.y)) {
        points.splice(points.length - 2, 1);
      } else break;
    }
  });
  return points;
}

function diagram2RelationshipPaintKey(style) {
  return JSON.stringify({
    stroke: String(style?.stroke || ""),
    strokeWidth: formatNumber(style?.strokeWidth),
    opacity: formatNumber(style?.opacity)
  });
}

function diagram2MergedRelationshipRouteGroups(renderedRelationships) {
  const paintGroups = new Map();
  renderedRelationships.forEach(item => {
    const paintKey = diagram2RelationshipPaintKey(item.style);
    let group = paintGroups.get(paintKey);
    if (!group) {
      group = {
        style: item.style,
        routes: [],
        horizontal: new Map(),
        vertical: new Map(),
        diagonal: new Map()
      };
      paintGroups.set(paintKey, group);
    }
    group.routes.push(item.geometry.path);

    item.geometry.points.slice(1).forEach((point, index) => {
      const previous = item.geometry.points[index];
      if (previous.x === point.x) {
        const key = formatNumber(previous.x);
        const intervals = group.vertical.get(key) || [];
        intervals.push([Math.min(previous.y, point.y), Math.max(previous.y, point.y)]);
        group.vertical.set(key, intervals);
        return;
      }
      if (previous.y === point.y) {
        const key = formatNumber(previous.y);
        const intervals = group.horizontal.get(key) || [];
        intervals.push([Math.min(previous.x, point.x), Math.max(previous.x, point.x)]);
        group.horizontal.set(key, intervals);
        return;
      }
      const firstKey = `${formatNumber(previous.x)},${formatNumber(previous.y)}`;
      const secondKey = `${formatNumber(point.x)},${formatNumber(point.y)}`;
      const key = firstKey < secondKey ? `${firstKey}|${secondKey}` : `${secondKey}|${firstKey}`;
      group.diagonal.set(key, [previous, point]);
    });
  });

  const mergeIntervals = intervals => intervals
    .sort((first, second) => first[0] - second[0] || first[1] - second[1])
    .reduce((merged, interval) => {
      const previous = merged.at(-1);
      if (previous && interval[0] <= previous[1]) {
        previous[1] = Math.max(previous[1], interval[1]);
      } else {
        merged.push([...interval]);
      }
      return merged;
    }, []);

  return [...paintGroups.values()].map(group => {
    if (group.routes.length === 1) return { style: group.style, path: group.routes[0] };
    const commands = [];
    group.horizontal.forEach((intervals, y) => {
      mergeIntervals(intervals).forEach(([start, end]) => {
        commands.push(`M ${formatNumber(start)} ${y} H ${formatNumber(end)}`);
      });
    });
    group.vertical.forEach((intervals, x) => {
      mergeIntervals(intervals).forEach(([start, end]) => {
        commands.push(`M ${x} ${formatNumber(start)} V ${formatNumber(end)}`);
      });
    });
    group.diagonal.forEach(([first, second]) => {
      commands.push(`M ${formatNumber(first.x)} ${formatNumber(first.y)} L ${formatNumber(second.x)} ${formatNumber(second.y)}`);
    });
    return { style: group.style, path: commands.join(" ") };
  }).filter(group => group.path);
}

function diagram2PointListText(pointsInput) {
  return (Array.isArray(pointsInput) ? pointsInput : [])
    .map(point => `${formatNumber(point?.x)},${formatNumber(point?.y)}`)
    .join(" ");
}

function normalizeRelationshipRouteOverride(input) {
  return (Array.isArray(input) ? input : [])
    .map(point => ({
      x: finiteNumber(point?.x, Number.NaN),
      y: finiteNumber(point?.y, Number.NaN)
    }))
    .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function relationshipStyle(relationship) {
  if (relationship?.diagram2EffectiveStyle) {
    const style = relationship.diagram2EffectiveStyle;
    return {
      stroke: style.stroke || "#42526b",
      strokeWidth: positiveNumber(style.strokeWidth, 2),
      arrowSize: positiveNumber(style.arrowSize, 10),
      opacity: safeOpacity(style.opacity ?? 1)
    };
  }

  const override = relationship.foreignKeySource?.styleOverride || relationship.foreignKey?.styleOverride || {};
  return {
    stroke: override.stroke || "#42526b",
    strokeWidth: positiveNumber(override.strokeWidth, 2),
    arrowSize: positiveNumber(override.arrowSize, 10),
    opacity: safeOpacity(override.opacity ?? 1)
  };
}

function lowDetailEntityFontSize(object) {
  const height = positiveNumber(object?.height, 1);
  const base = Math.max(positiveNumber(object?.fontSize, 12) * 4, 42);
  return clampNumber(base, 20, Math.max(20, height * 0.46));
}

function fieldMappingTextAttributes(object, x, y, fill) {
  return {
    x,
    y,
    fill,
    "dominant-baseline": "middle",
    "font-family": object.fontFamily || "Arial",
    "font-size": positiveNumber(object.fontSize, 14)
  };
}

function clearDirtyState(dirty) {
  dirty.objectGeometry.clear();
  dirty.objectStructure.clear();
  dirty.objectStyle.clear();
  dirty.objectSelection.clear();
  dirty.relationshipGeometry.clear();
  dirty.relationshipStyle.clear();
  dirty.reasons.clear();
  dirty.zOrder = false;
  dirty.worldBounds = false;
  dirty.sectors = false;
}

function dirtyStateHasChanges(dirty) {
  return dirty.objectGeometry.size > 0
    || dirty.objectStructure.size > 0
    || dirty.objectStyle.size > 0
    || dirty.objectSelection.size > 0
    || dirty.relationshipGeometry.size > 0
    || dirty.relationshipStyle.size > 0
    || dirty.zOrder
    || dirty.worldBounds
    || dirty.sectors;
}

function dirtyDiagnosticsSnapshot(dirty, relationships) {
  return {
    objectIds: sortedDirtyIds([
      ...dirty.objectStructure,
      ...dirty.objectGeometry,
      ...dirty.objectStyle,
      ...dirty.objectSelection
    ]),
    relationshipIds: sortedDirtyIds([
      ...dirtyRelationshipSet(dirty.relationshipGeometry, relationships),
      ...dirtyRelationshipSet(dirty.relationshipStyle, relationships)
    ])
  };
}

function dirtyRelationshipSet(source, relationships) {
  if (source.has(allRelationshipsDirtyToken)) {
    return new Set(relationships.map(relationship => relationship.id));
  }
  return new Set([...source].filter(id => id && id !== allRelationshipsDirtyToken));
}

function dirtyReasonText(dirty, fallback) {
  return [...dirty.reasons].filter(Boolean).join(", ") || String(fallback || "flush");
}

function sortedDirtyIds(ids) {
  const unique = [...new Set(ids.map(id => String(id || "").trim()).filter(Boolean))];
  unique.sort((left, right) => left.localeCompare(right));
  return unique.join(", ") || "none";
}

function diagnosticsFor(options) {
  const summary = diagram2CanonicalSummary(options.canonicalState);
  return {
    ...summary,
    mountedObjectCount: Number.isFinite(Number(options.mountedObjectCount))
      ? Number(options.mountedObjectCount)
      : options.canonicalState.objects.filter(object => object.visible !== false).length,
    mountedRelationshipCount: Number.isFinite(Number(options.mountedRelationshipCount))
      ? Number(options.mountedRelationshipCount)
      : options.relationships.length,
    svgDescendantCount: 0,
    fullRenderCount: options.fullRenderCount,
    fullRenderReason: options.fullRenderReason,
    objectsPatchedInLastFlush: options.objectsPatchedInLastFlush,
    relationshipsRoutedInLastFlush: options.relationshipsRoutedInLastFlush,
    lastFrameDuration: Math.round(options.lastFrameDuration * 100) / 100,
    ...emptyDirtyFlushDiagnostics(),
    ...emptyGeometryPreviewDiagnostics(),
    ...emptySelectiveRoutingDiagnostics(),
    ...emptyViewportHaloDiagnostics(),
    ...emptyOverviewDetailDiagnostics()
  };
}

function emptyDiagnostics() {
  return {
    canonicalObjectCount: 0,
    canonicalEntityCount: 0,
    canonicalRelationshipCount: 0,
    mountedObjectCount: 0,
    mountedRelationshipCount: 0,
    svgDescendantCount: 0,
    fullRenderCount: 0,
    fullRenderReason: "",
    objectsPatchedInLastFlush: 0,
    relationshipsRoutedInLastFlush: 0,
    lastFrameDuration: 0,
    ...emptyTransformDiagnostics(),
    ...emptyDirtyFlushDiagnostics(),
    ...emptyGeometryPreviewDiagnostics(),
    ...emptySelectiveRoutingDiagnostics(),
    ...emptyViewportHaloDiagnostics(),
    ...emptyOverviewDetailDiagnostics()
  };
}

function emptyGeometryPreviewDiagnostics() {
  return {
    geometryPreviewActive: false,
    geometryPreviewReason: "",
    geometryPreviewObjectIds: "none",
    geometryPreviewRelationshipIds: "none",
    geometryPreviewFrameCount: 0,
    geometryPreviewPatchedObjectCount: 0,
    geometryPreviewRelationshipCount: 0,
    geometryPreviewLastDuration: 0,
    geometryPreviewCommitCount: 0,
    geometryPreviewUndoEntryCount: 0,
    geometryPreviewInitialMatrix: diagram2MatrixText({ scale: 1, translateX: 0, translateY: 0 }),
    geometryPreviewSettledRouteCount: 0,
    pendingGeometryPreview: false
  };
}

function createDiagram2SelectiveRoutingState() {
  return {
    relationshipIdsByEntityId: new Map(),
    relationshipIdsByFieldAnchor: new Map(),
    relationshipBoundsById: new Map(),
    relationshipRouteSignaturesById: new Map(),
    relationshipStyleSignaturesById: new Map(),
    relationshipRoutesById: new Map(),
    entityProtectedBoundsById: new Map(),
    entityProtectedSectorIndex: createDiagram2FixedGridIndex(diagram2RoutingSectorSize),
    relationshipRouteSectorIndex: createDiagram2FixedGridIndex(diagram2RoutingSectorSize),
    routingObstacleBoundsById: new Map(),
    routingObstacleSectorIndex: createDiagram2FixedGridIndex(diagram2RoutingSectorSize),
    obstacleGeneration: 0,
    obstacleGenerationBySectorKey: new Map()
  };
}

function createDiagram2ViewportHaloState() {
  return {
    active: false,
    sectorSignature: "",
    forceSignature: "",
    canonicalObjectCount: 0,
    canonicalRelationshipCount: 0,
    objectIds: new Set(),
    relationshipIds: new Set(),
    objectSectorIndex: createDiagram2FixedGridIndex(diagram2ViewportHaloSectorSize),
    relationshipSectorIndex: createDiagram2FixedGridIndex(diagram2ViewportHaloSectorSize)
  };
}

function createDiagram2OverviewDetailState() {
  return {
    level: diagram2DetailLevelDetailed
  };
}

function createSelectiveRoutingMetrics(totalRelationshipCount = 0) {
  return {
    totalRelationshipCount: Number(totalRelationshipCount || 0),
    relationshipsConsidered: 0,
    relationshipsRerouted: 0,
    routeCacheHits: 0,
    routeCacheMisses: 0,
    spatialSectorsQueried: 0,
    routingDuration: 0
  };
}

function mergeSelectiveRoutingMetrics(target, sourceInput) {
  if (!target || !sourceInput) return target;
  const source = {
    totalRelationshipCount: sourceInput.totalRelationshipCount ?? sourceInput.selectiveRoutingTotalRelationships,
    relationshipsConsidered: sourceInput.relationshipsConsidered ?? sourceInput.selectiveRoutingRelationshipsConsidered,
    relationshipsRerouted: sourceInput.relationshipsRerouted ?? sourceInput.selectiveRoutingRelationshipsRerouted,
    routeCacheHits: sourceInput.routeCacheHits ?? sourceInput.selectiveRoutingCacheHits,
    routeCacheMisses: sourceInput.routeCacheMisses ?? sourceInput.selectiveRoutingCacheMisses,
    spatialSectorsQueried: sourceInput.spatialSectorsQueried ?? sourceInput.selectiveRoutingSpatialSectorsQueried,
    routingDuration: sourceInput.routingDuration ?? sourceInput.selectiveRoutingDuration
  };
  target.totalRelationshipCount = Math.max(target.totalRelationshipCount, Number(source.totalRelationshipCount || 0));
  target.relationshipsConsidered += Number(source.relationshipsConsidered || 0);
  target.relationshipsRerouted += Number(source.relationshipsRerouted || 0);
  target.routeCacheHits += Number(source.routeCacheHits || 0);
  target.routeCacheMisses += Number(source.routeCacheMisses || 0);
  target.spatialSectorsQueried += Number(source.spatialSectorsQueried || 0);
  target.routingDuration += Number(source.routingDuration || 0);
  return target;
}

function selectiveRoutingDiagnosticsFromMetrics(metricsInput) {
  const metrics = metricsInput || createSelectiveRoutingMetrics();
  return {
    selectiveRoutingTotalRelationships: Number(metrics.totalRelationshipCount || 0),
    selectiveRoutingRelationshipsConsidered: Number(metrics.relationshipsConsidered || 0),
    selectiveRoutingRelationshipsRerouted: Number(metrics.relationshipsRerouted || metrics.routeCacheMisses || 0),
    selectiveRoutingCacheHits: Number(metrics.routeCacheHits || 0),
    selectiveRoutingCacheMisses: Number(metrics.routeCacheMisses || 0),
    selectiveRoutingSpatialSectorsQueried: Number(metrics.spatialSectorsQueried || 0),
    selectiveRoutingDuration: Math.round(Math.max(0, Number(metrics.routingDuration || 0)) * 100) / 100
  };
}

function emptySelectiveRoutingDiagnostics() {
  return selectiveRoutingDiagnosticsFromMetrics(createSelectiveRoutingMetrics());
}

function viewportHaloDiagnosticsFromPlan(plan, result = {}) {
  return {
    viewportHaloActive: plan.active === true,
    viewportHaloReason: String(plan.reason || ""),
    viewportHaloFallbackReason: plan.active ? "" : String(plan.fallbackReason || "full render"),
    viewportHaloSectorSize: diagram2ViewportHaloSectorSize,
    viewportHaloSectorCount: Number(plan.sectorCount || 0),
    viewportHaloSectorSignature: String(plan.sectorSignature || ""),
    viewportHaloBounds: boundsText(plan.haloBounds),
    viewportHaloViewportBounds: boundsText(plan.viewportBounds),
    viewportHaloObjectCoverage: formatCoverage(plan.objectCoverage),
    viewportHaloRelationshipCoverage: formatCoverage(plan.relationshipCoverage),
    viewportHaloCombinedCoverage: formatCoverage(plan.combinedCoverage),
    viewportHaloTargetObjectCount: Number(plan.targetObjectCount || 0),
    viewportHaloTargetRelationshipCount: Number(plan.targetRelationshipCount || 0),
    viewportHaloVirtualizedObjectCount: Number(plan.virtualizedObjectCount || 0),
    viewportHaloVirtualizedRelationshipCount: Number(plan.virtualizedRelationshipCount || 0),
    viewportHaloForceMountedObjectCount: Number(plan.forceMountedObjectCount || 0),
    viewportHaloForceMountedRelationshipCount: Number(plan.forceMountedRelationshipCount || 0),
    viewportHaloRouteOnlyRelationshipCount: Number(plan.routeOnlyRelationshipCount || 0),
    viewportHaloEnteringObjectCount: Number(result.enteringObjectCount || 0),
    viewportHaloLeavingObjectCount: Number(result.leavingObjectCount || 0),
    viewportHaloRetainedObjectCount: Number(result.retainedObjectCount || 0),
    viewportHaloEnteringRelationshipCount: Number(result.enteringRelationshipCount || 0),
    viewportHaloLeavingRelationshipCount: Number(result.leavingRelationshipCount || 0),
    viewportHaloRetainedRelationshipCount: Number(result.retainedRelationshipCount || 0),
    viewportHaloObjectPatchCount: Number(result.objectPatchCount || 0),
    viewportHaloRelationshipPatchCount: Number(result.relationshipPatchCount || 0),
    viewportHaloRoutedRelationshipCount: Number(result.routedRelationshipCount || 0),
    viewportHaloSameSectorNoop: result.sameSectorNoop === true,
    viewportHaloDuration: Number(plan.duration || 0),
    mountedObjectCount: Number(result.mountedObjectCount ?? plan.targetObjectCount ?? 0),
    mountedRelationshipCount: Number(result.mountedRelationshipCount ?? plan.targetRelationshipCount ?? 0)
  };
}

function emptyViewportHaloDiagnostics(overrides = {}) {
  return {
    viewportHaloActive: false,
    viewportHaloReason: String(overrides.reason || ""),
    viewportHaloFallbackReason: String(overrides.fallbackReason || ""),
    viewportHaloSectorSize: diagram2ViewportHaloSectorSize,
    viewportHaloSectorCount: 0,
    viewportHaloSectorSignature: "",
    viewportHaloBounds: "n/a",
    viewportHaloViewportBounds: "n/a",
    viewportHaloObjectCoverage: "100%",
    viewportHaloRelationshipCoverage: "100%",
    viewportHaloCombinedCoverage: "100%",
    viewportHaloTargetObjectCount: Number(overrides.objectCount || overrides.mountedObjectCount || 0),
    viewportHaloTargetRelationshipCount: Number(overrides.relationshipCount || overrides.mountedRelationshipCount || 0),
    viewportHaloVirtualizedObjectCount: 0,
    viewportHaloVirtualizedRelationshipCount: 0,
    viewportHaloForceMountedObjectCount: 0,
    viewportHaloForceMountedRelationshipCount: 0,
    viewportHaloRouteOnlyRelationshipCount: 0,
    viewportHaloEnteringObjectCount: 0,
    viewportHaloLeavingObjectCount: 0,
    viewportHaloRetainedObjectCount: 0,
    viewportHaloEnteringRelationshipCount: 0,
    viewportHaloLeavingRelationshipCount: 0,
    viewportHaloRetainedRelationshipCount: 0,
    viewportHaloObjectPatchCount: 0,
    viewportHaloRelationshipPatchCount: 0,
    viewportHaloRoutedRelationshipCount: 0,
    viewportHaloSameSectorNoop: false,
    viewportHaloDuration: 0,
    mountedObjectCount: Number(overrides.mountedObjectCount || overrides.objectCount || 0),
    mountedRelationshipCount: Number(overrides.mountedRelationshipCount || overrides.relationshipCount || 0)
  };
}

function overviewDetailDiagnostics(options = {}) {
  const lowObjectCount = countMapValues(options.objectLevelsById, diagram2DetailLevelLow);
  const detailedObjectCount = countMapValues(options.objectLevelsById, diagram2DetailLevelDetailed);
  const lowRelationshipCount = countMapValues(options.relationshipLevelsById, diagram2DetailLevelLow);
  const detailedRelationshipCount = countMapValues(options.relationshipLevelsById, diagram2DetailLevelDetailed);
  return {
    overviewDetailLevel: String(options.level || diagram2DetailLevelDetailed),
    overviewDetailReason: String(options.reason || ""),
    overviewDetailPreviousLevel: String(options.previousLevel || diagram2DetailLevelDetailed),
    overviewDetailChanged: options.previousLevel !== options.level,
    overviewDetailProjectedRowPixels: Number.isFinite(Number(options.projectedRowPixels))
      ? Math.round(Number(options.projectedRowPixels) * 100) / 100
      : 0,
    overviewDetailEnterRowPixels: diagram2LowDetailEnterRowPixels,
    overviewDetailExitRowPixels: diagram2LowDetailExitRowPixels,
    overviewDetailEntityCount: Number(options.entityCount || 0),
    overviewDetailLowObjectCount: lowObjectCount,
    overviewDetailDetailedObjectCount: detailedObjectCount,
    overviewDetailLowRelationshipCount: lowRelationshipCount,
    overviewDetailDetailedRelationshipCount: detailedRelationshipCount,
    overviewDetailMountedObjectCount: Number(options.mountedObjectCount || 0),
    overviewDetailMountedRelationshipCount: Number(options.mountedRelationshipCount || 0),
    overviewDetailObjectPatchCount: Number(options.objectPatchCount || 0),
    overviewDetailRelationshipPatchCount: Number(options.relationshipPatchCount || 0),
    overviewDetailDuration: Math.round(Math.max(0, Number(options.duration || 0)) * 100) / 100
  };
}

function emptyOverviewDetailDiagnostics(overrides = {}) {
  return {
    overviewDetailLevel: String(overrides.level || diagram2DetailLevelDetailed),
    overviewDetailReason: String(overrides.reason || ""),
    overviewDetailPreviousLevel: String(overrides.previousLevel || diagram2DetailLevelDetailed),
    overviewDetailChanged: false,
    overviewDetailProjectedRowPixels: 0,
    overviewDetailEnterRowPixels: diagram2LowDetailEnterRowPixels,
    overviewDetailExitRowPixels: diagram2LowDetailExitRowPixels,
    overviewDetailEntityCount: 0,
    overviewDetailLowObjectCount: 0,
    overviewDetailDetailedObjectCount: 0,
    overviewDetailLowRelationshipCount: 0,
    overviewDetailDetailedRelationshipCount: 0,
    overviewDetailMountedObjectCount: 0,
    overviewDetailMountedRelationshipCount: 0,
    overviewDetailObjectPatchCount: 0,
    overviewDetailRelationshipPatchCount: 0,
    overviewDetailDuration: 0
  };
}

function countMapValues(map, value) {
  if (!(map instanceof Map)) return 0;
  let count = 0;
  map.forEach(item => {
    if (item === value) count += 1;
  });
  return count;
}

function formatCoverage(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return `${formatNumber(clampNumber(number, 0, 1) * 100)}%`;
}

function emptyPreviewGeometry() {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaWidth: 0,
    deltaHeight: 0,
    objectsById: null
  };
}

function normalizePreviewGeometry(input = {}, fallback = emptyPreviewGeometry()) {
  return {
    deltaX: finiteNumber(input.deltaX ?? input.dx, fallback.deltaX),
    deltaY: finiteNumber(input.deltaY ?? input.dy, fallback.deltaY),
    deltaWidth: finiteNumber(input.deltaWidth ?? input.dw, fallback.deltaWidth),
    deltaHeight: finiteNumber(input.deltaHeight ?? input.dh, fallback.deltaHeight),
    objectsById: normalizePreviewObjectsById(input.objectsById ?? input.objects ?? input.previewObjects, fallback.objectsById)
  };
}

function normalizePreviewObjectsById(input, fallback = null) {
  if (input == null) return fallback instanceof Map ? new Map(fallback) : null;
  if (input instanceof Map) {
    return new Map([...input.entries()]
      .map(([id, object]) => [String(id || object?.id || "").trim(), object])
      .filter(([id, object]) => id && object && typeof object === "object"));
  }
  if (Array.isArray(input)) {
    return new Map(input
      .map(object => [String(object?.id || "").trim(), object])
      .filter(([id, object]) => id && object && typeof object === "object"));
  }
  if (typeof input === "object") {
    return new Map(Object.entries(input)
      .map(([id, object]) => [String(id || object?.id || "").trim(), object])
      .filter(([id, object]) => id && object && typeof object === "object"));
  }
  return fallback instanceof Map ? new Map(fallback) : null;
}

function emptyDirtyFlushDiagnostics() {
  return {
    dirtyFlushReason: "",
    dirtyObjectIds: "none",
    dirtyRelationshipIds: "none",
    patchedNodeCount: 0,
    routedRelationshipCount: 0,
    lastFlushDuration: 0,
    dirtyFlushCount: 0,
    pendingDiagramFlush: false,
    transactionDepth: 0
  };
}

function emptyTransformDiagnostics() {
  return {
    transientMatrix: diagram2MatrixText({ scale: 1, translateX: 0, translateY: 0 }),
    committedMatrix: diagram2MatrixText({ scale: 1, translateX: 0, translateY: 0 }),
    matrixDifference: "translate=0 scale=0",
    cursorScreenPoint: "(0, 0)",
    worldPointUnderCursor: "(0, 0)",
    screenPointAfterSettle: "(0, 0)",
    entityBoundingBoxBeforeSettle: "n/a",
    entityBoundingBoxAfterSettle: "n/a",
    nodeIdentityBeforeAfter: "true",
    fullRendersDuringSettle: 0,
    routesRecalculatedDuringSettle: 0
  };
}

function objectVersion(object) {
  return JSON.stringify(object);
}

function objectTranslation(object) {
  if (!objectUsesLocalTransform(object)) return { x: 0, y: 0 };
  return {
    x: finiteNumber(object?.x, 0),
    y: finiteNumber(object?.y, 0)
  };
}

function objectTranslationVersion(object) {
  const translation = objectTranslation(object);
  return JSON.stringify(translation);
}

function objectTransformText(object) {
  if (!objectUsesLocalTransform(object)) return null;
  const translation = objectTranslation(object);
  return `translate(${formatNumber(translation.x)} ${formatNumber(translation.y)})`;
}

function objectUsesLocalTransform(object) {
  return !["arrow", "line"].includes(String(object?.type || ""));
}

function diagram2LocalObject(object) {
  if (!objectUsesLocalTransform(object)) return object;
  return {
    ...object,
    x: 0,
    y: 0
  };
}

function objectSelectionBounds(object) {
  if (object?.type === "arrow" || object?.type === "line") {
    const x1 = finiteNumber(object?.x1, 0);
    const y1 = finiteNumber(object?.y1, 0);
    const x2 = finiteNumber(object?.x2, 0);
    const y2 = finiteNumber(object?.y2, 0);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(1, Math.abs(x2 - x1)),
      height: Math.max(1, Math.abs(y2 - y1))
    };
  }
  return objectBounds(diagram2LocalObject(object));
}

function diagram2SelectionHandlePoints(object, bounds) {
  if (object?.type === "arrow" || object?.type === "line") {
    return [{
      direction: "arrow-base",
      x: finiteNumber(object.x1, 0),
      y: finiteNumber(object.y1, 0)
    }, {
      direction: "arrow-tip",
      x: finiteNumber(object.x2, 0),
      y: finiteNumber(object.y2, 0)
    }];
  }

  const left = bounds.x;
  const centerX = bounds.x + (bounds.width / 2);
  const right = bounds.x + bounds.width;
  const top = bounds.y;
  const centerY = bounds.y + (bounds.height / 2);
  const bottom = bounds.y + bounds.height;
  return [
    { direction: "nw", x: left, y: top },
    { direction: "n", x: centerX, y: top },
    { direction: "ne", x: right, y: top },
    { direction: "e", x: right, y: centerY },
    { direction: "se", x: right, y: bottom },
    { direction: "s", x: centerX, y: bottom },
    { direction: "sw", x: left, y: bottom },
    { direction: "w", x: left, y: centerY }
  ];
}

function diagram2SelectionHandleRadius(viewportScale) {
  return 3.5 / Math.max(minimumViewportScale, positiveNumber(viewportScale, 1));
}

function objectStructureVersion(object) {
  const base = {
    type: object?.type || "",
    fieldRectangle: diagram2IsFieldRectangle(object),
    visible: object?.visible !== false,
    width: positiveNumber(object?.width, 1),
    height: positiveNumber(object?.height, 1)
  };

  if (object?.type === "entity" && !diagram2IsFieldRectangle(object)) {
    return JSON.stringify({
      ...base,
      collapsed: object.collapsed === true,
      foreignKeysAtTop: object.foreignKeysAtTop === true,
      showKeyColumn: object.showKeyColumn !== false,
      showDataTypes: object.showDataTypes === true,
      fontFamily: object.fontFamily || "Arial",
      fontSize: clampNumber(positiveNumber(object.fontSize, 12), 8, 64),
      fields: annotationEntityVisibleFields(object).map(field => ({
        name: field?.name || "",
        dataType: field?.dataType || "",
        identity: field?.identity || "",
        isPrimaryKey: field?.isPrimaryKey === true,
        isForeignKey: field?.isForeignKey === true,
        isImportant: field?.isImportant === true
      }))
    });
  }

  if (diagram2IsFieldRectangle(object)) {
    return JSON.stringify({
      ...base,
      fieldRectangleName: object.fieldRectangleName || object.entityName || "Field rectangle"
    });
  }

  if (object?.type === "embedded-image") {
    return JSON.stringify({
      ...base,
      source: object.source || "",
      name: object.name || ""
    });
  }

  if (object?.type === "textbox" || object?.type === "rich-text") {
    return JSON.stringify({
      ...base,
      text: object.type === "rich-text" ? object.html || "" : object.text || "",
      fontFamily: object.fontFamily || "Arial",
      fontSize: positiveNumber(object.fontSize, 16),
      textAlign: safeDiagram2TextAlign(object.textAlign),
      textVerticalAlign: safeDiagram2TextVerticalAlign(object.textVerticalAlign)
    });
  }

  if (object?.type === "field-mapping-table") {
    return JSON.stringify({
      ...base,
      rows: Array.isArray(object.rows) ? object.rows : [],
      fontFamily: object.fontFamily || "Arial",
      fontSize: positiveNumber(object.fontSize, 14),
      headerFill: object.headerFill || "",
      headerTextColor: object.headerTextColor || "",
      uiFill: object.uiFill || "",
      databaseFill: object.databaseFill || "",
      uiTextColor: object.uiTextColor || "",
      databaseTextColor: object.databaseTextColor || "",
      fieldMappingRowHoverFill: object.fieldMappingRowHoverFill || "",
      fieldMappingHighlightColor: object.fieldMappingHighlightColor || "",
      fieldMappingHighlightStrokeWidth: positiveNumber(object.fieldMappingHighlightStrokeWidth, 9),
      stroke: object.stroke || "",
      strokeWidth: positiveNumber(object.strokeWidth, 1)
    });
  }

  if (object?.type === "arrow" || object?.type === "line") {
    return JSON.stringify({
      type: object.type,
      x1: finiteNumber(object.x1, 0),
      y1: finiteNumber(object.y1, 0),
      x2: finiteNumber(object.x2, 0),
      y2: finiteNumber(object.y2, 0),
      arrowSize: positiveNumber(object.arrowSize, 18)
    });
  }

  return JSON.stringify(base);
}

function objectStyleVersion(object) {
  return JSON.stringify({
    fill: object?.fill || "",
    stroke: object?.stroke || "",
    strokeWidth: positiveNumber(object?.strokeWidth, 1),
    opacity: safeOpacity(object?.opacity),
    outlineVisible: object?.outlineVisible !== false,
    textColor: object?.textColor || "",
    entityHeaderFill: object?.entityHeaderFill || "",
    entityNameTextColor: object?.entityNameTextColor || "",
    locked: object?.locked === true
  });
}

function objectTextVersion(object) {
  if (object?.type === "entity" && !diagram2IsFieldRectangle(object)) {
    return JSON.stringify({
      entitySchema: object.entitySchema || "",
      entityName: object.entityName || ""
    });
  }
  return "";
}

function relationshipRenderVersion(routeSignature, styleSignature, detailLevel = diagram2DetailLevelDetailed) {
  return JSON.stringify({
    routeSignature,
    styleSignature,
    detailLevel
  });
}

function relationshipRouteCacheSignature(relationship, options = {}) {
  return JSON.stringify({
    id: relationship.id,
    source: relationshipEndpointSignature(relationship.source, relationship.sourceField),
    target: relationshipEndpointSignature(relationship.target, relationship.targetField),
    manualRoute: relationship.foreignKeySource?.routeOverride || relationship.foreignKey?.routeOverride || null,
    relationshipRoutingOverride: relationshipRoutingOverrideSignature(relationship),
    globalRoutingSettings: globalRoutingSettingsSignature(options.canonicalState),
    routePath: String(options.routePath || relationship.diagram2RouteGeometry?.path || ""),
    obstacleRegionGeneration: Number(options.obstacleGeneration || 0)
  });
}

function relationshipEndpointSignature(entity, field) {
  const bounds = annotationEntityFieldBounds(entity, field) || objectBounds(entity);
  return {
    entityId: entity?.id || "",
    x: finiteNumber(entity?.x, 0),
    y: finiteNumber(entity?.y, 0),
    width: positiveNumber(entity?.width, 1),
    height: positiveNumber(entity?.height, 1),
    field: field?.name || "",
    anchor: normalizeBounds(bounds)
  };
}

function relationshipRoutingOverrideSignature(relationship) {
  const styleOverride = relationship.foreignKeySource?.styleOverride || relationship.foreignKey?.styleOverride || null;
  return styleOverride ? {
    strokeWidth: positiveNumber(styleOverride.strokeWidth, 0),
    arrowSize: positiveNumber(styleOverride.arrowSize, 0)
  } : null;
}

function globalRoutingSettingsSignature(state) {
  const style = state?.relationshipStyle || {};
  return {
    allowOverlappingLines: state?.allowOverlappingEntityLines === true,
    manualRoutes: state?.manualEntityRelationshipRoutes === true,
    compactRouting: state?.compactEntityRelationshipRouting === true,
    strokeWidth: positiveNumber(style.strokeWidth, 0),
    arrowSize: positiveNumber(style.arrowSize, 0)
  };
}

function relationshipVersion(relationship) {
  return JSON.stringify({
    id: relationship.id,
    sourceId: relationship.source?.id,
    sourceX: relationship.source?.x,
    sourceY: relationship.source?.y,
    sourceWidth: relationship.source?.width,
    sourceHeight: relationship.source?.height,
    sourceField: relationship.sourceField?.name,
    targetId: relationship.target?.id,
    targetX: relationship.target?.x,
    targetY: relationship.target?.y,
    targetWidth: relationship.target?.width,
    targetHeight: relationship.target?.height,
    targetField: relationship.targetField?.name,
    styleOverride: relationship.foreignKeySource?.styleOverride || relationship.foreignKey?.styleOverride || null
  });
}

function relationshipRouteVersion(relationship) {
  return JSON.stringify({
    id: relationship.id,
    sourceId: relationship.source?.id,
    sourceX: relationship.source?.x,
    sourceY: relationship.source?.y,
    sourceWidth: relationship.source?.width,
    sourceHeight: relationship.source?.height,
    sourceField: relationship.sourceField?.name,
    targetId: relationship.target?.id,
    targetX: relationship.target?.x,
    targetY: relationship.target?.y,
    targetWidth: relationship.target?.width,
    targetHeight: relationship.target?.height,
    targetField: relationship.targetField?.name
  });
}

function relationshipStyleVersion(relationship) {
  return JSON.stringify(relationship.diagram2EffectiveStyle || relationship.foreignKeySource?.styleOverride || relationship.foreignKey?.styleOverride || null);
}

function diagram2CanonicalEntities(canonical) {
  return (Array.isArray(canonical?.objects) ? canonical.objects : [])
    .filter(object => object?.type === "entity" && object.visible !== false && !diagram2IsFieldRectangle(object));
}

function diagram2IsFieldRectangle(object) {
  return object?.type === "entity" && object.entityKind === "field-rectangle";
}

function normalizeDiagram2ForeignKey(input) {
  const columns = Array.isArray(input?.columns)
    ? input.columns.map(value => String(value || "").trim()).filter(Boolean)
    : [];
  const referencedColumns = Array.isArray(input?.referencedColumns)
    ? input.referencedColumns.map(value => String(value || "").trim()).filter(Boolean)
    : [];
  const referencedTable = String(input?.referencedTable || "").trim();
  if (!columns.length || !referencedColumns.length || !referencedTable) return null;
  return {
    ...input,
    columns,
    referencedColumns,
    referencedSchema: String(input?.referencedSchema || "").trim(),
    referencedTable,
    name: String(input?.name || "").trim(),
    relationshipType: String(input?.relationshipType || "").trim()
  };
}

function findEntityField(entity, names) {
  const lookup = new Set((Array.isArray(names) ? names : [])
    .map(name => normalizeIdentifier(name))
    .filter(Boolean));
  return (Array.isArray(entity?.fields) ? entity.fields : [])
    .find(field => lookup.has(normalizeIdentifier(field?.name))) || null;
}

function diagram2EntityMatchesReference(entity, referencedSchema, referencedTable) {
  const tableName = normalizeIdentifier(entity?.entityName);
  const referenceTable = normalizeIdentifier(referencedTable);
  if (!tableName || tableName !== referenceTable) return false;

  const schemaName = normalizeIdentifier(entity?.entitySchema);
  const referenceSchema = normalizeIdentifier(referencedSchema);
  return !schemaName || !referenceSchema || schemaName === referenceSchema;
}

function diagram2RelationshipId(source, sourceField, target, targetField, foreignKey) {
  return [
    "diagram2-relationship",
    source?.id,
    sourceField?.name,
    target?.id,
    targetField?.name,
    foreignKey?.name
  ].map(part => encodeURIComponent(String(part || "").toLowerCase())).join(":");
}

function diagram2EffectiveRelationshipStyle(foreignKeySource, foreignKey, globalRelationshipStyle = {}) {
  const override = foreignKeySource?.styleOverride || foreignKey?.styleOverride || {};
  const hasOverrideOpacity = override && Object.hasOwn(override, "opacity");
  const hasGlobalOpacity = globalRelationshipStyle && Object.hasOwn(globalRelationshipStyle, "opacity");
  return {
    stroke: override.stroke || globalRelationshipStyle.stroke || "#42526b",
    strokeWidth: positiveNumber(
      override.strokeWidth,
      positiveNumber(globalRelationshipStyle.strokeWidth, 2)
    ),
    arrowSize: positiveNumber(
      override.arrowSize,
      positiveNumber(globalRelationshipStyle.arrowSize, 10)
    ),
    opacity: safeOpacity(hasOverrideOpacity
      ? override.opacity
      : hasGlobalOpacity
        ? globalRelationshipStyle.opacity
        : 1)
  };
}

function normalizeIdentifier(value) {
  return String(value || "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/^"|"$/g, "")
    .toLowerCase();
}

function normalizeViewportTransform(transform) {
  return {
    scale: clampNumber(positiveNumber(transform?.scale, 1), minimumViewportScale, maximumViewportScale),
    translateX: finiteNumber(transform?.translateX, 0),
    translateY: finiteNumber(transform?.translateY, 0)
  };
}

function viewportMatrixDifference(transient, committed) {
  const left = normalizeViewportTransform(transient);
  const right = normalizeViewportTransform(committed);
  return {
    translation: Math.hypot(left.translateX - right.translateX, left.translateY - right.translateY),
    scale: Math.abs(left.scale - right.scale)
  };
}

function matrixDifferenceText(difference) {
  return `translate=${formatNumber(difference?.translation || 0)} scale=${formatNumber(difference?.scale || 0)}`;
}

function pointText(point) {
  if (!point) return "n/a";
  return `(${formatNumber(point.x)}, ${formatNumber(point.y)})`;
}

function boundsText(bounds) {
  if (!bounds) return "n/a";
  return `x=${formatNumber(bounds.x)} y=${formatNumber(bounds.y)} w=${formatNumber(bounds.width)} h=${formatNumber(bounds.height)}`;
}

function formatEntityIdentifier(schema, name) {
  return [schema, name].map(value => String(value || "").trim()).filter(Boolean).join(".") || "Entity";
}

function objectBounds(object) {
  if (object?.type === "arrow" || object?.type === "line") {
    const x1 = finiteNumber(object.x1, 0);
    const y1 = finiteNumber(object.y1, 0);
    const x2 = finiteNumber(object.x2, x1);
    const y2 = finiteNumber(object.y2, y1);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(1, Math.abs(x2 - x1)),
      height: Math.max(1, Math.abs(y2 - y1))
    };
  }
  return {
    x: finiteNumber(object?.x, 0),
    y: finiteNumber(object?.y, 0),
    width: positiveNumber(object?.width, 1),
    height: positiveNumber(object?.height, 1)
  };
}

function diagram2ObjectVisible(object, state = null) {
  if (!object || object.visible === false) return false;
  return !object.groupId || state?.groupVisibility?.[object.groupId] !== false;
}

function diagram2ObjectContentBounds(object) {
  if (!object) return null;
  if (object.type === "arrow") {
    const geometry = annotationArrowGeometry(object);
    const shaftBounds = boundsFromPoints([
      { x: finiteNumber(object.x1, 0), y: finiteNumber(object.y1, 0) },
      geometry.shaftEnd
    ], positiveNumber(object.strokeWidth, 1) / 2);
    return unionBounds(shaftBounds, boundsFromPoints(geometry.headPoints));
  }
  if (object.type === "line") {
    const padding = Math.max(
      positiveNumber(object.strokeWidth, 1) / 2,
      0
    );
    return boundsFromPoints([
      { x: finiteNumber(object.x1, 0), y: finiteNumber(object.y1, 0) },
      { x: finiteNumber(object.x2, 0), y: finiteNumber(object.y2, 0) }
    ], padding);
  }
  if (object.type === "embedded-image" && object.cropVisible !== false) {
    return normalizeBounds(object.imageClip) || objectBounds(object);
  }
  const strokeRadius = ["rectangle", "circle", "textbox", "rich-text", "entity", "field-mapping-table"].includes(object.type)
    && object.outlineVisible !== false
    ? positiveNumber(object.strokeWidth, 1) / 2
    : 0;
  return expandedBounds(objectBounds(object), strokeRadius);
}

function protectedRoutingBounds(object) {
  if (!object || object.visible === false) return null;
  return expandedBounds(objectBounds(object), diagram2ProtectedBoundsPadding);
}

function routingObstacleBounds(object) {
  if (!object || object.visible === false) return null;
  if (object.type === "arrow" || object.type === "line") return null;
  return expandedBounds(objectBounds(object), diagram2ProtectedBoundsPadding);
}

function normalizeBounds(boundsInput) {
  if (!boundsInput) return null;
  const x = finiteNumber(boundsInput.x, Number.NaN);
  const y = finiteNumber(boundsInput.y, Number.NaN);
  const width = positiveNumber(boundsInput.width, Number.NaN);
  const height = positiveNumber(boundsInput.height, Number.NaN);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function normalizedSelectionBounds(boundsInput) {
  if (!boundsInput) return null;
  const x1 = finiteNumber(boundsInput.x, Number.NaN);
  const y1 = finiteNumber(boundsInput.y, Number.NaN);
  const x2 = Number.isFinite(Number(boundsInput.x2))
    ? finiteNumber(boundsInput.x2, Number.NaN)
    : x1 + finiteNumber(boundsInput.width, Number.NaN);
  const y2 = Number.isFinite(Number(boundsInput.y2))
    ? finiteNumber(boundsInput.y2, Number.NaN)
    : y1 + finiteNumber(boundsInput.height, Number.NaN);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.max(0.01, Math.abs(x2 - x1)),
    height: Math.max(0.01, Math.abs(y2 - y1))
  };
}

function normalizeDiagram2RendererRichTextHtml(value) {
  const source = String(value || "").trim() || "<p><br></p>";
  try {
    return normalizeRichHtml(source) || "<p><br></p>";
  } catch {
    return source
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "")
      .slice(0, 200000) || "<p><br></p>";
  }
}

function expandedBounds(boundsInput, paddingInput = 0) {
  const bounds = normalizeBounds(boundsInput);
  if (!bounds) return null;
  const padding = Math.max(0, finiteNumber(paddingInput, 0));
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + (padding * 2),
    height: bounds.height + (padding * 2)
  };
}

function unionBounds(firstInput, secondInput) {
  const first = normalizeBounds(firstInput);
  const second = normalizeBounds(secondInput);
  if (!first) return second;
  if (!second) return first;
  const x1 = Math.min(first.x, second.x);
  const y1 = Math.min(first.y, second.y);
  const x2 = Math.max(first.x + first.width, second.x + second.width);
  const y2 = Math.max(first.y + first.height, second.y + second.height);
  return {
    x: x1,
    y: y1,
    width: Math.max(1, x2 - x1),
    height: Math.max(1, y2 - y1)
  };
}

function boundsIntersect(firstInput, secondInput) {
  const first = normalizeBounds(firstInput);
  const second = normalizeBounds(secondInput);
  if (!first || !second) return false;
  return first.x <= second.x + second.width
    && first.x + first.width >= second.x
    && first.y <= second.y + second.height
    && first.y + first.height >= second.y;
}

function boundsFromPoints(pointsInput, paddingInput = 0) {
  const points = Array.isArray(pointsInput) ? pointsInput : [];
  if (!points.length) return null;
  const xs = points.map(point => finiteNumber(point?.x, 0));
  const ys = points.map(point => finiteNumber(point?.y, 0));
  const x1 = Math.min(...xs);
  const y1 = Math.min(...ys);
  const x2 = Math.max(...xs);
  const y2 = Math.max(...ys);
  return expandedBounds({
    x: x1,
    y: y1,
    width: Math.max(1, x2 - x1),
    height: Math.max(1, y2 - y1)
  }, paddingInput);
}

function fixedGridSectorKeys(boundsInput, sectorSizeInput = diagram2RoutingSectorSize) {
  const bounds = normalizeBounds(boundsInput);
  if (!bounds) return [];
  const sectorSize = Math.max(32, positiveNumber(sectorSizeInput, diagram2RoutingSectorSize));
  const minX = Math.floor(bounds.x / sectorSize);
  const minY = Math.floor(bounds.y / sectorSize);
  const maxX = Math.floor((bounds.x + bounds.width) / sectorSize);
  const maxY = Math.floor((bounds.y + bounds.height) / sectorSize);
  const keys = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      keys.push(`${x}:${y}`);
    }
  }
  return keys;
}

function relationshipFieldAnchorKey(entity, field) {
  const entityId = String(entity?.id || "").trim();
  const fieldName = String(field?.name || "").trim();
  return entityId && fieldName ? `${entityId}:${fieldName}` : "";
}

function addToSetMap(map, keyInput, valueInput) {
  const key = String(keyInput || "").trim();
  const value = String(valueInput || "").trim();
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function appendTitle(parent, text) {
  appendText(parent, text, {}, "title");
}

function appendClipRect(defs, id, x, y, width, height) {
  defs.appendChild(svgClipRect(defs, id, x, y, width, height));
}

function svgClipRect(contextNode, id, x, y, width, height) {
  const clipPath = createSvgElement(contextNode, "clipPath", { id });
  appendSvg(clipPath, "rect", { x, y, width, height });
  return clipPath;
}

function appendText(parent, text, attributes = {}, tagName = "text") {
  const element = appendSvg(parent, tagName, attributes);
  element.textContent = String(text ?? "");
  return element;
}

function appendSvg(parent, tagName, attributes = {}) {
  const element = createSvgElement(parent, tagName, attributes);
  parent.appendChild(element);
  return element;
}

function createSvgElement(contextNode, tagName, attributes = {}) {
  const ownerDocument = contextNode.ownerDocument || globalThis.document;
  const element = ownerDocument.createElementNS(svgNamespace, tagName);
  setSvgAttributes(element, attributes);
  return element;
}

function setSvgAttributes(element, attributes) {
  if (!element) return;
  Object.entries(attributes || {}).forEach(([name, value]) => {
    if (value == null || value === false) {
      element.removeAttribute(name);
      return;
    }
    element.setAttribute(name, typeof value === "number" ? formatNumber(value) : String(value));
  });
}

function safeSvgId(value) {
  return String(value || "diagram2")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "diagram2";
}

function cssClassName(value) {
  return safeSvgId(value).toLowerCase();
}

function cssEscape(value) {
  const text = String(value || "");
  if (typeof globalThis.CSS?.escape === "function") return globalThis.CSS.escape(text);
  return text.replace(/["\\]/g, "\\$&");
}

function cloneDiagram2Value(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeZoomMode(value) {
  const zoom = String(value || "fit");
  return zoom === "fit" ? "fit" : String(positiveNumber(zoom, 1));
}

function safeOpacity(value) {
  return clampNumber(Number(value ?? 1), 0, 1);
}

function safeDiagram2TextAlign(value) {
  const alignment = String(value || "left").toLowerCase();
  return ["left", "center", "right"].includes(alignment) ? alignment : "left";
}

function safeDiagram2TextVerticalAlign(value) {
  const alignment = String(value || "top").toLowerCase();
  return ["top", "middle", "bottom"].includes(alignment) ? alignment : "top";
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function translateDiagram2Bounds(bounds, deltaX, deltaY) {
  return {
    x: finiteNumber(bounds?.x, 0) + finiteNumber(deltaX, 0),
    y: finiteNumber(bounds?.y, 0) + finiteNumber(deltaY, 0),
    width: Math.max(1, finiteNumber(bounds?.width, 1)),
    height: Math.max(1, finiteNumber(bounds?.height, 1))
  };
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return String(Math.round(number * 1000) / 1000);
}

function mark(performanceApi, name) {
  try {
    performanceApi?.mark?.(name);
  } catch {
    // Diagnostics should never block rendering.
  }
}

function measure(performanceApi, name, startMark, endMark) {
  try {
    performanceApi?.measure?.(name, startMark, endMark);
  } catch {
    // Diagnostics should never block rendering.
  }
}

function now(performanceApi) {
  try {
    return typeof performanceApi?.now === "function" ? performanceApi.now() : Date.now();
  } catch {
    return Date.now();
  }
}
