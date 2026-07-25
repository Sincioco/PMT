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
    relationshipVersionsById: new Map()
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

export function createDiagram2Renderer({ host, performance: performanceApi = globalThis.performance } = {}) {
  if (!host) throw new Error("Diagram 2 renderer requires a host element.");

  const liveView = createDiagram2LiveView();
  const planes = {};
  let svg = null;
  let canonicalState = null;
  let fullRenderCount = 0;
  let fullRenderReason = "";
  let frameSequence = 0;
  let zoomMode = "fit";
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

    const objectsPatched = patchObjects(visibleObjects, canonicalState);
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
    lastDiagnostics.svgDescendantCount = svg.querySelectorAll("*").length;
    applyDiagnosticsAttributes();
    applyZoomSizing();
    return diagnostics();
  }

  function fit() {
    zoomMode = "fit";
    applyZoomSizing();
    refreshDescendantDiagnostic();
    return diagnostics();
  }

  function setZoom(value) {
    zoomMode = normalizeZoomMode(value);
    applyZoomSizing();
    refreshDescendantDiagnostic();
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
      relationshipVersionCount: liveView.relationshipVersionsById.size
    };
  }

  function svgNode() {
    return svg;
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
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    diagram2RendererPlanes.forEach(([key, attribute]) => {
      let plane = svg.querySelector(`:scope > g[${attribute}]`);
      if (!plane) {
        plane = ownerDocument.createElementNS(svgNamespace, "g");
        plane.setAttribute(attribute, "");
      }
      planes[key] = plane;
      svg.appendChild(plane);
    });
    return svg;
  }

  function applySvgMetrics(state) {
    const width = positiveNumber(state.width, defaultDiagram2Width);
    const height = positiveNumber(state.height, defaultDiagram2Height);
    svg.setAttribute("viewBox", `0 0 ${formatNumber(width)} ${formatNumber(height)}`);
    svg.setAttribute("width", formatNumber(width));
    svg.setAttribute("height", formatNumber(height));
    svg.dataset.diagram2Width = String(width);
    svg.dataset.diagram2Height = String(height);
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

  function patchObjects(objects, state) {
    const desiredIds = new Set();
    let patchedCount = 0;

    objects.forEach(object => {
      desiredIds.add(object.id);
      let node = liveView.objectNodesById.get(object.id);
      if (!node) {
        node = createSvgElement(host, "g", {
          "data-diagram2-object-id": object.id,
          "data-diagram2-object-type": object.type
        });
        liveView.objectNodesById.set(object.id, node);
      }

      const version = objectVersion(object);
      if (liveView.objectVersionsById.get(object.id) !== version) {
        patchObjectNode(node, object, state);
        liveView.objectVersionsById.set(object.id, version);
        patchedCount += 1;
      }

      if (node.parentNode !== planes.objects || node !== planes.objects.lastChild) {
        planes.objects.appendChild(node);
      }
    });

    [...liveView.objectNodesById.entries()].forEach(([id, node]) => {
      if (desiredIds.has(id)) return;
      node.remove();
      liveView.objectNodesById.delete(id);
      liveView.objectVersionsById.delete(id);
    });

    liveView.mountedObjectIds.clear();
    desiredIds.forEach(id => liveView.mountedObjectIds.add(id));
    return patchedCount;
  }

  function patchRelationships(relationships) {
    const desiredIds = new Set();

    relationships.forEach(relationship => {
      desiredIds.add(relationship.id);
      let node = liveView.relationshipNodesById.get(relationship.id);
      if (!node) {
        node = createSvgElement(host, "g", {
          "data-diagram2-relationship-id": relationship.id
        });
        liveView.relationshipNodesById.set(relationship.id, node);
      }

      const version = relationshipVersion(relationship);
      if (liveView.relationshipVersionsById.get(relationship.id) !== version) {
        patchRelationshipNode(node, relationship);
        liveView.relationshipVersionsById.set(relationship.id, version);
      }

      if (node.parentNode !== planes.relationships || node !== planes.relationships.lastChild) {
        planes.relationships.appendChild(node);
      }
    });

    [...liveView.relationshipNodesById.entries()].forEach(([id, node]) => {
      if (desiredIds.has(id)) return;
      node.remove();
      liveView.relationshipNodesById.delete(id);
      liveView.relationshipVersionsById.delete(id);
    });

    liveView.mountedRelationshipIds.clear();
    desiredIds.forEach(id => liveView.mountedRelationshipIds.add(id));
    return relationships.length;
  }

  function applyZoomSizing() {
    if (!svg || !canonicalState) return;

    const width = positiveNumber(canonicalState.width, defaultDiagram2Width);
    const height = positiveNumber(canonicalState.height, defaultDiagram2Height);
    const fit = zoomMode === "fit";
    const scale = fit ? 1 : Number(zoomMode || 1);
    const renderedWidth = Math.max(1, Math.round(width * scale));
    const renderedHeight = Math.max(1, Math.round(height * scale));

    host.classList.toggle("is-fit", fit);
    svg.classList.toggle("is-fit", fit);
    svg.style.width = fit ? "100%" : `${renderedWidth}px`;
    svg.style.height = fit ? "100%" : `${renderedHeight}px`;
    svg.style.minWidth = fit ? "0" : `${renderedWidth}px`;
    svg.style.minHeight = fit ? "0" : `${renderedHeight}px`;
    svg.dataset.diagram2Zoom = zoomMode;
  }

  function refreshDescendantDiagnostic() {
    lastDiagnostics = {
      ...lastDiagnostics,
      svgDescendantCount: svg ? svg.querySelectorAll("*").length : 0
    };
    applyDiagnosticsAttributes();
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
  }

  return {
    render,
    fit,
    setZoom,
    diagnostics,
    liveViewSnapshot,
    svgNode
  };
}

function patchObjectNode(node, object, state) {
  node.replaceChildren();
  setSvgAttributes(node, {
    "data-diagram2-object-id": object.id,
    "data-diagram2-object-type": object.type,
    "data-diagram2-object-visible": object.visible !== false ? "true" : "false",
    opacity: safeOpacity(object.opacity)
  });
  node.classList.add("diagram2-renderer-object", `is-${cssClassName(object.type)}`);

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
    x,
    y,
    width,
    height,
    fill,
    stroke: "none"
  });
  appendSvg(node, "rect", {
    class: "diagram2-renderer-entity-header",
    x,
    y,
    width,
    height: headerHeight,
    fill: headerFill,
    stroke: "none"
  });
  appendText(node, formatEntityIdentifier(object.entitySchema, object.entityName), {
    class: "diagram2-renderer-entity-title",
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
    x1: x,
    y1: y + headerHeight,
    x2: x + width,
    y2: y + headerHeight,
    stroke,
    "stroke-width": Math.max(0.5, positiveNumber(object.strokeWidth, 1) * 0.6)
  });

  if (keyColumnWidth > 0) {
    appendSvg(node, "line", {
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

function patchRelationshipNode(node, relationship) {
  node.replaceChildren();
  setSvgAttributes(node, {
    "data-diagram2-relationship-id": relationship.id,
    "data-diagram2-relationship-source": relationship.source?.id || "",
    "data-diagram2-relationship-target": relationship.target?.id || ""
  });
  node.classList.add("diagram2-renderer-relationship-node");

  const route = relationshipRoute(relationship);
  const style = relationshipStyle(relationship);
  appendTitle(node, `${formatEntityIdentifier(relationship.source?.entitySchema, relationship.source?.entityName)}.${relationship.sourceField?.name || ""} -> ${formatEntityIdentifier(relationship.target?.entitySchema, relationship.target?.entityName)}.${relationship.targetField?.name || ""}`);
  appendSvg(node, "path", {
    class: "diagram2-renderer-relationship",
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
    lastFrameDuration: 0
  };
}

function objectVersion(object) {
  return JSON.stringify(object);
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
