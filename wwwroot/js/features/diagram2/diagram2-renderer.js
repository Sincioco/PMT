import {
  annotationEntityFieldBounds,
  annotationEntityFieldLabelPoint,
  annotationEntityFieldSupportsMapping,
  annotationEntityVisibleFields,
  normalizeAnnotationState
} from "../../components/image-annotation.js?v=20260725-diagram2-day3-v1";

const svgNamespace = "http://www.w3.org/2000/svg";
const xlinkNamespace = "http://www.w3.org/1999/xlink";
const defaultDiagram2Width = 1600;
const defaultDiagram2Height = 900;
const defaultViewportPadding = 24;
const minimumViewportScale = 0.05;
const maximumViewportScale = 8;
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
    relationshipDataById: new Map()
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
  const relationships = [];
  entities.forEach(source => {
    (Array.isArray(source.foreignKeys) ? source.foreignKeys : []).forEach((foreignKeySource, foreignKeyIndex) => {
      const foreignKey = normalizeDiagram2ForeignKey(foreignKeySource);
      if (!foreignKey) return;

      const sourceField = findEntityField(source, foreignKey.columns);
      if (!annotationEntityFieldSupportsMapping(sourceField)) return;

      const target = entities.find(candidate =>
        diagram2EntityMatchesReference(candidate, foreignKey.referencedSchema, foreignKey.referencedTable));
      if (!target) return;

      const targetField = findEntityField(target, foreignKey.referencedColumns);
      if (!targetField) return;
      if (annotationEntityVisibleFields(source).indexOf(sourceField) < 0) return;
      if (annotationEntityVisibleFields(target).indexOf(targetField) < 0) return;

      const relationship = {
        id: diagram2RelationshipId(source, sourceField, target, targetField, foreignKey),
        source,
        sourceField,
        target,
        targetField,
        foreignKey,
        foreignKeySource,
        foreignKeyIndex
      };
      relationships.push(relationship);
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

export function createDiagram2Renderer({ host, performance: performanceApi = globalThis.performance, onDiagnostics = null } = {}) {
  if (!host) throw new Error("Diagram 2 renderer requires a host element.");

  const liveView = createDiagram2LiveView();
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
  let pendingViewportFrame = 0;
  let pendingViewportGesture = null;
  let lastViewportReason = "";
  let lastTransformDiagnostics = emptyTransformDiagnostics();
  let lastDiagnostics = emptyDiagnostics();

  function render(inputState, options = {}) {
    const reason = String(options.reason || "initial").trim() || "initial";
    const frameId = `diagram2-renderer-${++frameSequence}`;
    const startTime = now(performanceApi);
    mark(performanceApi, `${frameId}:start`);

    canonicalState = normalizeDiagram2CanonicalState(inputState);
    const visibleObjects = canonicalState.objects.filter(object => object.visible !== false);
    const relationships = diagram2CanonicalRelationships(canonicalState);
    mark(performanceApi, `${frameId}:canonical`);

    ensureSvg();
    applySvgMetrics(canonicalState);
    patchBackgroundPlane(canonicalState);
    mark(performanceApi, `${frameId}:planes`);

    const objectsPatched = patchObjects(visibleObjects);
    mark(performanceApi, `${frameId}:objects`);

    const relationshipsRouted = patchRelationships(relationships);
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
      lastFrameDuration: Math.max(0, endTime - startTime)
    });
    Object.assign(lastDiagnostics, lastTransformDiagnostics);
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

    let objectsPatched = 0;
    if (nextObject?.visible !== false) {
      objectsPatched = patchVisibleObject(nextObject);
      const node = liveView.objectNodesById.get(objectId);
      if (node?.parentNode !== planes.objects) planes.objects.appendChild(node);
      liveView.mountedObjectIds.add(objectId);
    } else {
      removeObjectNode(objectId);
    }

    const relationships = diagram2CanonicalRelationships(canonicalState);
    const relationshipsRouted = patchRelationships(relationships);
    patchSelectionOverlays();
    return flushPatchDiagnostics(relationships, objectsPatched, relationshipsRouted, 0);
  }

  function setSelectedIds(ids = []) {
    liveView.selectedIds.clear();
    (Array.isArray(ids) ? ids : [ids])
      .map(id => String(id || "").trim())
      .filter(Boolean)
      .forEach(id => liveView.selectedIds.add(id));

    liveView.objectNodesById.forEach((node, id) => patchObjectSelection(node, id, liveView.selectedIds.has(id)));
    liveView.relationshipNodesById.forEach((node, id) => patchRelationshipSelection(node, id, liveView.selectedIds.has(id)));
    patchSelectionOverlays();

    const relationships = canonicalState ? diagram2CanonicalRelationships(canonicalState) : [];
    return flushPatchDiagnostics(relationships, 0, 0, 0);
  }

  function flushPatchDiagnostics(relationships, objectsPatched, relationshipsRouted, duration) {
    if (!canonicalState || !svg) return diagnostics();
    lastDiagnostics = diagnosticsFor({
      canonicalState,
      relationships,
      fullRenderCount,
      fullRenderReason,
      objectsPatchedInLastFlush: objectsPatched,
      relationshipsRoutedInLastFlush: relationshipsRouted,
      lastFrameDuration: duration
    });
    Object.assign(lastDiagnostics, lastTransformDiagnostics);
    lastDiagnostics.svgDescendantCount = svg.querySelectorAll("*").length;
    applyDiagnosticsAttributes();
    notifyDiagnostics();
    return diagnostics();
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
      relationshipDataCount: liveView.relationshipDataById.size
    };
  }

  function svgNode() {
    return svg;
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
    let background = planes.background.querySelector(":scope > rect[data-diagram2-background]");
    if (!background) {
      background = createSvgElement(host, "rect", { "data-diagram2-background": "" });
      planes.background.replaceChildren(background);
    }
    setSvgAttributes(background, {
      x: 0,
      y: 0,
      width: positiveNumber(state.width, defaultDiagram2Width),
      height: positiveNumber(state.height, defaultDiagram2Height),
      fill: state.backgroundFill || "#ffffff"
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
    let routedCount = 0;

    relationships.forEach(relationship => {
      desiredIds.add(relationship.id);
      routedCount += patchVisibleRelationship(relationship);

      const node = liveView.relationshipNodesById.get(relationship.id);
      if (node.parentNode !== planes.relationships || node !== planes.relationships.lastChild) {
        planes.relationships.appendChild(node);
      }
    });

    [...liveView.relationshipNodesById.keys()].forEach(id => {
      if (desiredIds.has(id)) return;
      removeRelationshipNode(id);
    });

    liveView.mountedRelationshipIds.clear();
    desiredIds.forEach(id => liveView.mountedRelationshipIds.add(id));
    if (routedCount > 0) relationshipRouteRevision += routedCount;
    return routedCount;
  }

  function patchVisibleObject(object) {
    const node = liveView.objectNodesById.get(object.id) || createObjectNode(object);
    const previousObject = liveView.objectDataById.get(object.id) || null;
    const flags = diagram2ObjectPatchFlags(previousObject, object);
    if (!flags.changed && liveView.objectVersionsById.has(object.id)) {
      patchObjectSelection(node, object.id, liveView.selectedIds.has(object.id));
      return 0;
    }

    patchObjectNode(node, previousObject, object, {
      ...flags,
      selected: liveView.selectedIds.has(object.id)
    }, canonicalState);
    liveView.objectDataById.set(object.id, object);
    liveView.objectVersionsById.set(object.id, objectVersion(object));
    return 1;
  }

  function patchVisibleRelationship(relationship) {
    const node = liveView.relationshipNodesById.get(relationship.id) || createRelationshipNode(relationship);
    const previousRelationship = liveView.relationshipDataById.get(relationship.id) || null;
    const flags = diagram2RelationshipPatchFlags(previousRelationship, relationship);
    if (!flags.changed && liveView.relationshipVersionsById.has(relationship.id)) {
      patchRelationshipSelection(node, relationship.id, liveView.selectedIds.has(relationship.id));
      return 0;
    }

    patchRelationshipNode(node, previousRelationship, relationship, {
      ...flags,
      selected: liveView.selectedIds.has(relationship.id)
    });
    liveView.relationshipDataById.set(relationship.id, relationship);
    liveView.relationshipVersionsById.set(relationship.id, relationshipVersion(relationship));
    return 1;
  }

  function createObjectNode(object) {
    const node = createSvgElement(host, "g", {
      "data-diagram2-object-id": object.id,
      "data-diagram2-object-type": object.type
    });
    liveView.objectNodesById.set(object.id, node);
    return node;
  }

  function removeObjectNode(id) {
    liveView.objectNodesById.get(id)?.remove();
    liveView.objectNodesById.delete(id);
    liveView.objectVersionsById.delete(id);
    liveView.objectDataById.delete(id);
    liveView.mountedObjectIds.delete(id);
    liveView.selectedIds.delete(id);
    planes.overlays?.querySelector(`[data-diagram2-selection-id="${cssEscape(id)}"]`)?.remove();
  }

  function createRelationshipNode(relationship) {
    const node = createSvgElement(host, "g", {
      "data-diagram2-relationship-id": relationship.id
    });
    liveView.relationshipNodesById.set(relationship.id, node);
    return node;
  }

  function removeRelationshipNode(id) {
    liveView.relationshipNodesById.get(id)?.remove();
    liveView.relationshipNodesById.delete(id);
    liveView.relationshipVersionsById.delete(id);
    liveView.relationshipDataById.delete(id);
    liveView.mountedRelationshipIds.delete(id);
    liveView.selectedIds.delete(id);
  }

  function patchSelectionOverlays() {
    if (!planes.overlays) return;
    const desiredIds = new Set();
    liveView.selectedIds.forEach(id => {
      const object = liveView.objectDataById.get(id);
      const objectNode = liveView.objectNodesById.get(id);
      if (!object || !objectNode?.isConnected) return;

      desiredIds.add(id);
      let overlay = planes.overlays.querySelector(`:scope > g[data-diagram2-selection-id="${cssEscape(id)}"]`);
      if (!overlay) {
        overlay = createSvgElement(host, "g", {
          "data-diagram2-selection-id": id,
          class: "diagram2-renderer-selection"
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
        "vector-effect": "non-scaling-stroke"
      });
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
      svgDescendantCount: svg ? svg.querySelectorAll("*").length : 0
    };
    mark(performanceApi, `${frameId}:end`);
    measure(performanceApi, "diagram2 viewport transform", `${frameId}:start`, `${frameId}:end`);
    applyDiagnosticsAttributes();
    notifyDiagnostics();
  }

  function fitViewportTransform(state, viewport) {
    const worldWidth = positiveNumber(state?.width, defaultDiagram2Width);
    const worldHeight = positiveNumber(state?.height, defaultDiagram2Height);
    const availableWidth = Math.max(1, viewport.width - (defaultViewportPadding * 2));
    const availableHeight = Math.max(1, viewport.height - (defaultViewportPadding * 2));
    const scale = clampNumber(Math.min(availableWidth / worldWidth, availableHeight / worldHeight), minimumViewportScale, maximumViewportScale);
    return {
      scale,
      translateX: (viewport.width - (worldWidth * scale)) / 2,
      translateY: (viewport.height - (worldHeight * scale)) / 2
    };
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
    if (Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))) {
      return {
        x: Number(point.x),
        y: Number(point.y)
      };
    }
    const rect = host.getBoundingClientRect?.();
    if (Number.isFinite(Number(point.clientX)) && Number.isFinite(Number(point.clientY)) && rect) {
      return {
        x: Number(point.clientX) - rect.left,
        y: Number(point.clientY) - rect.top
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
    updateObject,
    patchObject: updateObject,
    setSelectedIds,
    viewportMatrix,
    screenToWorld,
    worldToScreen,
    diagnostics,
    liveViewSnapshot,
    svgNode
  };
}

function patchObjectNode(node, previousObject, object, flags = {}, state) {
  setSvgAttributes(node, {
    "data-diagram2-object-id": object.id,
    "data-diagram2-object-type": object.type,
    "data-diagram2-object-visible": object.visible !== false ? "true" : "false",
    "data-diagram2-object-transform-x": objectTranslation(object).x,
    "data-diagram2-object-transform-y": objectTranslation(object).y,
    class: `diagram2-renderer-object is-${cssClassName(object.type)}${flags.selected ? " is-selected" : ""}`,
    transform: objectTransformText(object),
    opacity: safeOpacity(object.opacity)
  });

  if (flags.rebuild || !node.hasChildNodes()) {
    node.replaceChildren();
    renderObjectContents(node, diagram2LocalObject(object), state);
    return;
  }

  patchObjectSelection(node, object.id, flags.selected === true);
  if (object.type === "entity" && !diagram2IsFieldRectangle(object)) {
    patchEntityObjectNode(node, object);
  } else {
    patchSimpleObjectStyles(node, object);
  }
}

function renderObjectContents(node, object, state) {
  if (object.type === "entity") {
    renderEntityObject(node, object);
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

function patchEntityObjectNode(node, object) {
  const local = diagram2LocalObject(object);
  const fields = annotationEntityVisibleFields(local);
  const title = node.querySelector(":scope > title");
  if (title) title.textContent = `${formatEntityIdentifier(object.entitySchema, object.entityName)} (${fields.length} fields)`;
  const entityTitle = node.querySelector("[data-diagram2-entity-title]");
  if (entityTitle) entityTitle.textContent = formatEntityIdentifier(object.entitySchema, object.entityName);
  patchEntityObjectNodeStyles(node, local);
}

function patchEntityObjectNodeStyles(node, object) {
  const stroke = object.outlineVisible === false ? "none" : object.stroke || "#2f5597";
  const textColor = object.textColor || "#172b4d";
  const fontSize = clampNumber(positiveNumber(object.fontSize, 12), 8, 64);
  setSvgAttributes(node.querySelector("[data-diagram2-entity-body]"), {
    fill: object.fill || "#ffffff"
  });
  setSvgAttributes(node.querySelector("[data-diagram2-entity-header]"), {
    fill: object.entityHeaderFill || "#dbeafe"
  });
  setSvgAttributes(node.querySelector("[data-diagram2-entity-outline]"), {
    stroke,
    "stroke-width": positiveNumber(object.strokeWidth, 1)
  });
  node.querySelectorAll("[data-diagram2-entity-rule]").forEach(rule => {
    const kind = rule.getAttribute("data-diagram2-entity-rule");
    const scale = kind === "header" ? 0.6 : kind === "row" ? 0.28 : 0.45;
    setSvgAttributes(rule, {
      stroke,
      "stroke-width": Math.max(kind === "row" ? 0.35 : 0.5, positiveNumber(object.strokeWidth, 1) * scale)
    });
  });
  node.querySelectorAll("[data-diagram2-entity-text]").forEach(text => {
    const isTitle = text.hasAttribute("data-diagram2-entity-title");
    setSvgAttributes(text, {
      fill: isTitle ? object.entityNameTextColor || textColor : textColor,
      "font-family": object.fontFamily || "Arial",
      "font-size": isTitle ? fontSize : text.getAttribute("font-size")
    });
  });
}

function patchSimpleObjectStyles(node, object) {
  if (diagram2IsFieldRectangle(object)) {
    setSvgAttributes(node.querySelector(".diagram2-renderer-field-rectangle"), {
      fill: object.fill || "transparent",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#f59e0b",
      "stroke-width": positiveNumber(object.strokeWidth, 2)
    });
    return;
  }

  if (object.type === "rectangle") {
    setSvgAttributes(node.querySelector(".diagram2-renderer-rectangle"), {
      fill: object.fill || "none",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
      "stroke-width": positiveNumber(object.strokeWidth, 1)
    });
  } else if (object.type === "circle") {
    setSvgAttributes(node.querySelector(".diagram2-renderer-circle"), {
      fill: object.fill || "none",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
      "stroke-width": positiveNumber(object.strokeWidth, 1)
    });
  } else if (object.type === "textbox" || object.type === "rich-text") {
    setSvgAttributes(node.querySelector(".diagram2-renderer-textbox-frame"), {
      fill: object.fill || "none",
      stroke: object.outlineVisible === false ? "none" : object.stroke || "#334155",
      "stroke-width": positiveNumber(object.strokeWidth, 1)
    });
    setSvgAttributes(node.querySelector(".diagram2-renderer-textbox-text"), {
      fill: object.textColor || "#172b4d",
      "font-family": object.fontFamily || "Arial"
    });
  } else if (object.type === "arrow" || object.type === "line") {
    const stroke = object.stroke || "#334155";
    setSvgAttributes(node.querySelector(".diagram2-renderer-arrow-shaft, .diagram2-renderer-line"), {
      stroke,
      "stroke-width": positiveNumber(object.strokeWidth, 2)
    });
    setSvgAttributes(node.querySelector(".diagram2-renderer-arrow-head"), {
      fill: stroke
    });
  }
}

function renderEntityObject(node, object) {
  if (diagram2IsFieldRectangle(object)) {
    renderFieldRectangleObject(node, object);
    return;
  }

  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  const fontSize = clampNumber(positiveNumber(object.fontSize, 12), 8, 64);
  const fields = annotationEntityVisibleFields(object);
  const firstFieldBounds = fields.length ? annotationEntityFieldBounds(object, fields[0]) : null;
  const headerHeight = firstFieldBounds
    ? Math.max(18, firstFieldBounds.y - y)
    : Math.max(24, fontSize * 1.65);
  const rowHeight = firstFieldBounds ? Math.max(14, firstFieldBounds.height) : Math.max(18, fontSize * 1.35);
  const stroke = object.outlineVisible === false ? "none" : object.stroke || "#2f5597";
  const fill = object.fill || "#ffffff";
  const headerFill = object.entityHeaderFill || "#dbeafe";
  const textColor = object.textColor || "#172b4d";
  const headerTextColor = object.entityNameTextColor || textColor;
  const keyColumnWidth = object.showKeyColumn !== false ? Math.min(42, width * 0.22) : 0;
  const showDataTypes = object.showDataTypes === true;
  const dataTypeX = showDataTypes ? x + (width * 0.6) : width + x;
  const fieldClipId = `${safeSvgId(object.id)}-diagram2-fields`;
  const titleClipId = `${safeSvgId(object.id)}-diagram2-title`;
  const detailsClipId = `${safeSvgId(object.id)}-diagram2-details`;

  const defs = appendSvg(node, "defs");
  appendClipRect(defs, titleClipId, x + 8, y, Math.max(1, width - 16), headerHeight);
  appendClipRect(defs, fieldClipId, x + keyColumnWidth, y + headerHeight, Math.max(1, showDataTypes ? dataTypeX - x - keyColumnWidth : width - keyColumnWidth), Math.max(1, height - headerHeight));
  if (showDataTypes) {
    appendClipRect(defs, detailsClipId, dataTypeX, y + headerHeight, Math.max(1, x + width - dataTypeX), Math.max(1, height - headerHeight));
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
  appendSvg(node, "line", {
    "data-diagram2-entity-rule": "header",
    x1: x,
    y1: y + headerHeight,
    x2: x + width,
    y2: y + headerHeight,
    stroke,
    "stroke-width": Math.max(0.5, positiveNumber(object.strokeWidth, 1) * 0.6)
  });

  if (keyColumnWidth > 0) {
    appendSvg(node, "line", {
      "data-diagram2-entity-rule": "key-column",
      x1: x + keyColumnWidth,
      y1: y + headerHeight,
      x2: x + keyColumnWidth,
      y2: y + height,
      stroke,
      "stroke-width": Math.max(0.5, positiveNumber(object.strokeWidth, 1) * 0.45)
    });
  }

  if (showDataTypes) {
    appendSvg(node, "line", {
      "data-diagram2-entity-rule": "data-type-column",
      x1: dataTypeX,
      y1: y + headerHeight,
      x2: dataTypeX,
      y2: y + height,
      stroke,
      "stroke-width": Math.max(0.5, positiveNumber(object.strokeWidth, 1) * 0.45)
    });
  }

  fields.forEach((field, index) => {
    const bounds = annotationEntityFieldBounds(object, field);
    if (!bounds) return;
    const rowY = bounds.y;
    const rowCenterY = rowY + (bounds.height / 2);
    if (index > 0) {
      appendSvg(node, "line", {
        "data-diagram2-entity-rule": "row",
        x1: x,
        y1: rowY,
        x2: x + width,
        y2: rowY,
        stroke,
        "stroke-width": Math.max(0.35, positiveNumber(object.strokeWidth, 1) * 0.28)
      });
    }

    if (keyColumnWidth > 0) {
      const keyText = [field.isPrimaryKey ? "PK" : "", field.isForeignKey ? "FK" : ""].filter(Boolean).join("/");
      if (keyText) {
        appendText(node, keyText, {
          class: "diagram2-renderer-entity-key",
          "data-diagram2-entity-text": "",
          "data-diagram2-entity-key": "",
          x: x + (keyColumnWidth / 2),
          y: rowCenterY,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          fill: textColor,
          "font-family": object.fontFamily || "Arial",
          "font-size": Math.max(8, fontSize * 0.72)
        });
      }
    }

    const labelPoint = annotationEntityFieldLabelPoint(object, field) || {
      x: x + keyColumnWidth + 8,
      y: rowCenterY
    };
    appendText(node, field.name || "Field", {
      class: "diagram2-renderer-entity-field",
      "data-diagram2-entity-text": "",
      "data-diagram2-entity-field": "",
      x: labelPoint.x,
      y: labelPoint.y,
      "dominant-baseline": "middle",
      "clip-path": `url(#${fieldClipId})`,
      fill: textColor,
      "font-family": object.fontFamily || "Arial",
      "font-size": Math.max(8, fontSize * 0.88),
      "font-weight": field.isPrimaryKey ? 700 : 400
    });

    if (showDataTypes) {
      appendText(node, [field.dataType, field.identity].filter(Boolean).join(" "), {
        class: "diagram2-renderer-entity-data-type",
        "data-diagram2-entity-text": "",
        "data-diagram2-entity-data-type": "",
        x: dataTypeX + 8,
        y: rowCenterY,
        "dominant-baseline": "middle",
        "clip-path": `url(#${detailsClipId})`,
        fill: textColor,
        "font-family": object.fontFamily || "Arial",
        "font-size": Math.max(8, fontSize * 0.78)
      });
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
    "stroke-width": positiveNumber(object.strokeWidth, 1),
    "vector-effect": "non-scaling-stroke"
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
    "stroke-width": positiveNumber(object.strokeWidth, 2),
    "vector-effect": "non-scaling-stroke"
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
    "vector-effect": "non-scaling-stroke"
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
    "vector-effect": "non-scaling-stroke"
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

  appendSvg(node, "line", {
    class: arrow ? "diagram2-renderer-arrow-shaft" : "diagram2-renderer-line",
    x1,
    y1,
    x2,
    y2,
    stroke,
    "stroke-width": strokeWidth,
    "stroke-linecap": "round",
    "vector-effect": "non-scaling-stroke"
  });

  if (!arrow) return;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowSize = positiveNumber(object.arrowSize, 18);
  const wing = Math.PI / 7;
  const left = {
    x: x2 - (Math.cos(angle - wing) * arrowSize),
    y: y2 - (Math.sin(angle - wing) * arrowSize)
  };
  const right = {
    x: x2 - (Math.cos(angle + wing) * arrowSize),
    y: y2 - (Math.sin(angle + wing) * arrowSize)
  };
  appendSvg(node, "polygon", {
    class: "diagram2-renderer-arrow-head",
    points: `${formatNumber(x2)},${formatNumber(y2)} ${formatNumber(left.x)},${formatNumber(left.y)} ${formatNumber(right.x)},${formatNumber(right.y)}`,
    fill: stroke
  });
}

function renderTextboxObject(node, object) {
  const x = finiteNumber(object.x, 0);
  const y = finiteNumber(object.y, 0);
  const width = positiveNumber(object.width, 1);
  const height = positiveNumber(object.height, 1);
  const fontSize = positiveNumber(object.fontSize, 16);
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
    "vector-effect": "non-scaling-stroke"
  });

  const lines = String(object.text || "").split(/\r?\n/).slice(0, 24);
  const text = appendSvg(node, "text", {
    class: "diagram2-renderer-textbox-text",
    x: x + 10,
    y: y + 10 + (fontSize * 0.8),
    fill: object.textColor || "#172b4d",
    "font-family": object.fontFamily || "Arial",
    "font-size": fontSize,
    "clip-path": `url(#${clipId})`
  });
  lines.forEach((line, index) => {
    appendText(text, line || " ", {
      x: x + 10,
      dy: index === 0 ? 0 : fontSize * 1.25
    }, "tspan");
  });
}

function renderRichTextObject(node, object) {
  const text = String(object.html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Rich text";
  renderTextboxObject(node, {
    ...object,
    text,
    fill: object.fill || "none",
    textColor: object.textColor || "#172b4d",
    fontSize: object.fontSize || 16
  });
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
    appendSvg(node, "rect", {
      x,
      y: top,
      width: uiColumnWidth,
      height: rowHeight,
      fill: object.uiFill || "#f8fafc"
    });
    appendSvg(node, "rect", {
      x: x + uiColumnWidth,
      y: top,
      width: databaseColumnWidth,
      height: rowHeight,
      fill: object.databaseFill || "#ffffff"
    });
    appendText(node, row.uiField || "", fieldMappingTextAttributes(object, x + 8, top + (rowHeight / 2), object.uiTextColor || "#172b4d"));
    appendText(node, row.databaseField || "", fieldMappingTextAttributes(object, x + uiColumnWidth + 8, top + (rowHeight / 2), object.databaseTextColor || "#172b4d"));
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
    class: `diagram2-renderer-relationship-node${flags.selected ? " is-selected" : ""}`
  });

  const route = relationshipRoute(relationship);
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
    class: "diagram2-renderer-relationship",
    "data-diagram2-relationship-path": "",
    d: route.path,
    fill: "none",
    stroke: style.stroke,
    "stroke-width": style.strokeWidth,
    opacity: style.opacity,
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
    "vector-effect": "non-scaling-stroke"
  });
}

function relationshipRoute(relationship) {
  const source = relationship.source;
  const target = relationship.target;
  const sourceBounds = annotationEntityFieldBounds(source, relationship.sourceField) || objectBounds(source);
  const targetBounds = annotationEntityFieldBounds(target, relationship.targetField) || objectBounds(target);
  if (source === target) {
    const x = finiteNumber(source.x, 0) + positiveNumber(source.width, 1);
    const offset = Math.max(44, positiveNumber(source.width, 1) * 0.24) + (relationship.foreignKeyIndex * 12);
    const start = {
      x,
      y: sourceBounds.y + (sourceBounds.height / 2)
    };
    const end = {
      x,
      y: targetBounds.y + (targetBounds.height / 2)
    };
    return {
      start,
      end,
      path: `M ${formatNumber(start.x)} ${formatNumber(start.y)} H ${formatNumber(x + offset)} V ${formatNumber(end.y)} H ${formatNumber(end.x)}`
    };
  }

  const sourceCenterX = finiteNumber(source.x, 0) + (positiveNumber(source.width, 1) / 2);
  const targetCenterX = finiteNumber(target.x, 0) + (positiveNumber(target.width, 1) / 2);
  const sourceOnRight = sourceCenterX <= targetCenterX;
  const start = {
    x: sourceOnRight ? finiteNumber(source.x, 0) + positiveNumber(source.width, 1) : finiteNumber(source.x, 0),
    y: sourceBounds.y + (sourceBounds.height / 2)
  };
  const end = {
    x: sourceOnRight ? finiteNumber(target.x, 0) : finiteNumber(target.x, 0) + positiveNumber(target.width, 1),
    y: targetBounds.y + (targetBounds.height / 2)
  };
  const midX = start.x + ((end.x - start.x) / 2);
  return {
    start,
    end,
    path: `M ${formatNumber(start.x)} ${formatNumber(start.y)} H ${formatNumber(midX)} V ${formatNumber(end.y)} H ${formatNumber(end.x)}`
  };
}

function relationshipStyle(relationship) {
  const override = relationship.foreignKeySource?.styleOverride || relationship.foreignKey?.styleOverride || {};
  return {
    stroke: override.stroke || "#52667d",
    strokeWidth: positiveNumber(override.strokeWidth, 2),
    opacity: safeOpacity(override.opacity ?? 0.88)
  };
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

function diagnosticsFor(options) {
  const summary = diagram2CanonicalSummary(options.canonicalState);
  return {
    ...summary,
    mountedObjectCount: options.canonicalState.objects.filter(object => object.visible !== false).length,
    mountedRelationshipCount: options.relationships.length,
    svgDescendantCount: 0,
    fullRenderCount: options.fullRenderCount,
    fullRenderReason: options.fullRenderReason,
    objectsPatchedInLastFlush: options.objectsPatchedInLastFlush,
    relationshipsRoutedInLastFlush: options.relationshipsRoutedInLastFlush,
    lastFrameDuration: Math.round(options.lastFrameDuration * 100) / 100
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
    ...emptyTransformDiagnostics()
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

function objectStructureVersion(object) {
  const base = {
    type: object?.type || "",
    fieldRectangle: diagram2IsFieldRectangle(object),
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
      fontSize: positiveNumber(object.fontSize, 16)
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
    entityNameTextColor: object?.entityNameTextColor || ""
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
  return JSON.stringify(relationship.foreignKeySource?.styleOverride || relationship.foreignKey?.styleOverride || null);
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
  return {
    x: finiteNumber(object?.x, 0),
    y: finiteNumber(object?.y, 0),
    width: positiveNumber(object?.width, 1),
    height: positiveNumber(object?.height, 1)
  };
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

function normalizeZoomMode(value) {
  const zoom = String(value || "fit");
  return zoom === "fit" ? "fit" : String(positiveNumber(zoom, 1));
}

function safeOpacity(value) {
  return clampNumber(Number(value ?? 1), 0, 1);
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
