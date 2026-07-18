import { sharedRichColorPickerHtml } from "./forms.js?v=20260717-day30-image-annotation";
import { copyTextToClipboard } from "./clipboard.js?v=20260714-invite-email-body";

const svgNamespace = "http://www.w3.org/2000/svg";
const annotationVersion = 1;
const minimumObjectSize = 8;
const minimumZoom = 0.1;
const maximumZoom = 4;
const defaultGridSize = 20;
const imageClipId = "pmt-annotation-image-clip";
const minimumScaledStrokeWidth = 0.001;
const maximumScaledStrokeWidth = 1000000;
const minimumScaledArrowSize = 0.001;
const maximumScaledArrowSize = 1000000;
const maximumAnnotationTemplates = 50;
const annotationTemplateVersion = 1;
const defaultStyles = {
  fill: "#5aa315",
  stroke: "#3f7f0d",
  textColor: "#ffffff",
  fontFamily: "Arial",
  fontSize: 28,
  textAlign: "left",
  textVerticalAlign: "top",
  outlineVisible: true,
  opacity: 1,
  strokeWidth: 4,
  arrowSize: 24
};
const annotationTemplateStyleFields = {
  arrow: ["stroke", "strokeWidth", "arrowSize", "opacity"],
  rectangle: ["fill", "stroke", "outlineVisible", "strokeWidth", "opacity"],
  textbox: [
    "fill",
    "stroke",
    "outlineVisible",
    "strokeWidth",
    "opacity",
    "textColor",
    "fontFamily",
    "fontSize",
    "textAlign",
    "textVerticalAlign"
  ]
};

export async function openImageAnnotationDialog(options) {
  const originalReference = String(options?.originalReference || "").trim();
  const originalUrl = String(options?.originalUrl || originalReference).trim();
  if (!originalUrl) throw new Error("The original image could not be found.");

  const original = await loadOriginalImage(originalUrl);
  let state = null;
  if (options?.annotationUrl) {
    state = await loadExistingAnnotation(options.annotationUrl);
    if (!state) throw new Error("The editable annotation data could not be loaded. The image was left unchanged.");
  }
  state = normalizeAnnotationState(state, {
    width: original.width,
    height: original.height,
    originalReference
  });

  let templateLibrary = normalizeAnnotationTemplateLibrary(null);
  let templateLibraryError = "";
  if (typeof options?.loadTemplateLibrary === "function") {
    try {
      templateLibrary = normalizeAnnotationTemplateLibrary(await options.loadTemplateLibrary());
    } catch (error) {
      templateLibraryError = error?.message || "Your annotation templates could not be loaded.";
    }
  }

  return createAnnotationDialog({
    state,
    originalDataUrl: original.dataUrl,
    originalReference,
    originalFileName: options?.originalFileName || "image",
    askForColor: options?.askForColor,
    askForText: options?.askForText,
    confirm: options?.confirm,
    notify: options?.notify,
    loadDefaultTemplateLibrary: options?.loadDefaultTemplateLibrary,
    saveTemplateLibrary: options?.saveTemplateLibrary,
    templateLibrary,
    templateLibraryError,
    apply: options?.apply
  });
}

export function buildAnnotationSvg(inputState, originalDataUrl) {
  const state = normalizeAnnotationState(inputState);
  const outputBounds = annotationOutputBounds(state);
  const metadata = escapeXmlText(JSON.stringify(state));
  const body = state.objects
    .map(object => annotationObjectSvg(object, originalDataUrl, { exportMode: true }))
    .join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="${svgNamespace}" width="${formatNumber(outputBounds.width)}" height="${formatNumber(outputBounds.height)}" viewBox="${formatNumber(outputBounds.x)} ${formatNumber(outputBounds.y)} ${formatNumber(outputBounds.width)} ${formatNumber(outputBounds.height)}" role="img" aria-label="Annotated image" data-pmt-image-annotation-version="${annotationVersion}">`,
    `<metadata data-pmt-image-annotation-state="true">${metadata}</metadata>`,
    annotationImageClipDefinition(state),
    body,
    `</svg>`
  ].join("");
}

export function buildAnnotationSelectionSvg(inputState, selectedObjectIds, originalDataUrl) {
  return annotationSelectionClipboardExport(inputState, selectedObjectIds, originalDataUrl).svg;
}

function annotationSelectionClipboardExport(inputState, selectedObjectIds, originalDataUrl) {
  const state = normalizeAnnotationState(inputState);
  const ids = new Set(
    selectedObjectIds && typeof selectedObjectIds[Symbol.iterator] === "function"
      ? selectedObjectIds
      : []
  );
  const objects = state.objects.filter(object => ids.has(object.id));
  if (!objects.length) return { svg: "", width: 0, height: 0 };

  const bounds = unionAnnotationBounds(
    objects.map(object => annotationObjectVisualBounds(object, state.imageClip)).filter(Boolean)
  );
  if (!bounds) return { svg: "", width: 0, height: 0 };
  const body = objects
    .map(object => annotationObjectSvg(object, originalDataUrl, { exportMode: true }))
    .join("");
  const svg = [
    `<svg xmlns="${svgNamespace}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" viewBox="${formatNumber(bounds.x)} ${formatNumber(bounds.y)} ${formatNumber(bounds.width)} ${formatNumber(bounds.height)}" role="img" aria-label="Copied annotation selection">`,
    objects.some(object => object.type === "image") ? annotationImageClipDefinition(state) : "",
    body,
    `</svg>`
  ].join("");
  return { svg, width: bounds.width, height: bounds.height };
}

export function parseAnnotationSvg(svgMarkup) {
  const source = String(svgMarkup || "");
  const match = source.match(/<metadata\b[^>]*data-pmt-image-annotation-state=(?:"true"|'true')[^>]*>([\s\S]*?)<\/metadata>/i);
  if (!match) return null;

  try {
    return normalizeAnnotationState(JSON.parse(decodeXmlText(match[1])));
  } catch {
    return null;
  }
}

export function normalizeAnnotationState(input, fallback = {}) {
  const source = input && typeof input === "object" ? input : {};
  const width = positiveNumber(source.width, positiveNumber(fallback.width, 1));
  const height = positiveNumber(source.height, positiveNumber(fallback.height, 1));
  const sourceWidth = positiveNumber(source.sourceWidth, positiveNumber(fallback.width, width));
  const sourceHeight = positiveNumber(source.sourceHeight, positiveNumber(fallback.height, height));
  const cropOffsetX = clampNumber(finiteNumber(source.cropOffsetX, 0), 0, Math.max(0, sourceWidth - width));
  const cropOffsetY = clampNumber(finiteNumber(source.cropOffsetY, 0), 0, Math.max(0, sourceHeight - height));
  const objects = Array.isArray(source.objects)
    ? source.objects.map(normalizeAnnotationObject).filter(Boolean)
    : [];
  const originalReference = String(
    fallback.originalReference || source.originalReference || ""
  ).trim();

  const existingImage = objects.find(object => object.type === "image");
  if (!existingImage) {
    objects.unshift({
      id: annotationObjectId("image"),
      type: "image",
      x: -cropOffsetX,
      y: -cropOffsetY,
      width: sourceWidth,
      height: sourceHeight,
      locked: false,
      groupId: ""
    });
  } else {
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      if (objects[index].type === "image") objects.splice(index, 1);
    }
    objects.unshift(existingImage);
  }
  compactAnnotationGroupLayers(objects);

  const image = objects[0];
  const imageBounds = {
    x: image.x,
    y: image.y,
    width: image.width,
    height: image.height
  };
  const suppliedImageClip = source.imageClip && typeof source.imageClip === "object"
    ? {
        x: finiteNumber(source.imageClip.x, imageBounds.x),
        y: finiteNumber(source.imageClip.y, imageBounds.y),
        width: positiveNumber(source.imageClip.width, imageBounds.width),
        height: positiveNumber(source.imageClip.height, imageBounds.height)
      }
    : null;
  const legacyCrop = cropOffsetX > 0 || cropOffsetY > 0
    || width < sourceWidth || height < sourceHeight;
  const legacyImageClip = legacyCrop
    ? { x: 0, y: 0, width, height }
    : imageBounds;
  const imageClip = intersectAnnotationBounds(
    imageBounds,
    suppliedImageClip || legacyImageClip
  ) || imageBounds;
  const groupIds = new Set(objects.map(object => object.groupId).filter(Boolean));
  const suppliedGroupNames = source.groupNames && typeof source.groupNames === "object"
    ? source.groupNames
    : {};
  const groupNames = {};
  groupIds.forEach(groupId => {
    const name = safeAnnotationName(suppliedGroupNames[groupId]);
    if (name) groupNames[groupId] = name;
  });

  return {
    version: annotationVersion,
    width,
    height,
    sourceWidth,
    sourceHeight,
    cropOffsetX,
    cropOffsetY,
    originalReference,
    gridVisible: source.gridVisible !== false,
    snapToGrid: source.snapToGrid !== false,
    gridSize: clampNumber(positiveNumber(source.gridSize, defaultGridSize), 4, 200),
    imageClip,
    groupNames,
    objects
  };
}

export function normalizeAnnotationTemplateLibrary(input) {
  const source = input && typeof input === "object" ? input : {};
  const templates = Array.isArray(source.templates)
    ? source.templates.map(normalizeAnnotationTemplate).filter(Boolean).slice(0, maximumAnnotationTemplates)
    : [];
  const defaults = source.defaults && typeof source.defaults === "object" ? source.defaults : {};
  return {
    version: annotationTemplateVersion,
    templates,
    defaults: {
      arrow: normalizeAnnotationDrawingDefault("arrow", defaults.arrow),
      rectangle: normalizeAnnotationDrawingDefault("rectangle", defaults.rectangle)
    }
  };
}

export function restoreAnnotationDefaultTemplates(inputLibrary, inputDefaults) {
  const library = normalizeAnnotationTemplateLibrary(inputLibrary);
  const defaults = normalizeAnnotationTemplateLibrary(inputDefaults);
  const signatures = new Set(library.templates.map(annotationTemplateSignature));
  const missing = [];
  defaults.templates.forEach(template => {
    const signature = annotationTemplateSignature(template);
    if (signatures.has(signature)) return;
    signatures.add(signature);
    missing.push(template);
  });

  if (library.templates.length + missing.length > maximumAnnotationTemplates) {
    return {
      library,
      addedCount: 0,
      missingCount: missing.length,
      requiredSlots: library.templates.length + missing.length - maximumAnnotationTemplates,
      capacityExceeded: true
    };
  }

  const usedIds = new Set(library.templates.map(template => template.id));
  const restored = missing.map(template => {
    const copy = deepCopy(template);
    copy.id = uniqueRestoredTemplateId(copy.id, usedIds);
    usedIds.add(copy.id);
    return copy;
  });

  return {
    library: {
      ...library,
      templates: [...restored, ...library.templates]
    },
    addedCount: restored.length,
    missingCount: restored.length,
    requiredSlots: 0,
    capacityExceeded: false
  };
}

function annotationTemplateSignature(template) {
  const normalized = normalizeAnnotationTemplate(template);
  if (!normalized) return "";
  return JSON.stringify({
    name: normalized.name,
    grouped: normalized.grouped,
    groupName: normalized.groupName,
    width: normalized.width,
    height: normalized.height,
    objects: normalized.objects.map(object => {
      const { id, groupId, locked, ...definition } = object;
      return definition;
    })
  });
}

function uniqueRestoredTemplateId(templateId, usedIds) {
  if (!usedIds.has(templateId)) return templateId;
  const base = `${String(templateId || "template").slice(0, 108)}-default`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base.slice(0, 116 - String(suffix).length)}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function captureAnnotationTemplate(inputState, selectedObjectIds, originalDataUrl, name = "Template") {
  const state = normalizeAnnotationState(inputState);
  const ids = new Set(
    selectedObjectIds && typeof selectedObjectIds[Symbol.iterator] === "function"
      ? selectedObjectIds
      : []
  );
  const selected = state.objects.filter(object => ids.has(object.id));
  const selectedGroupIds = new Set(selected.map(object => object.groupId).filter(Boolean));
  const selectedGroupId = selectedGroupIds.size === 1 ? [...selectedGroupIds][0] : "";
  const grouped = Boolean(selectedGroupId)
    && selected.every(object => object.groupId === selectedGroupId)
    && selected.length === state.objects.filter(object => object.groupId === selectedGroupId).length;
  const groupName = grouped
    ? state.groupNames[selectedGroupId] || ""
    : "";
  const objects = selected
    .map(object => object.type === "image"
      ? annotationEmbeddedImageFromSource(object, state, originalDataUrl)
      : { ...deepCopy(object), locked: false, groupId: "" })
    .filter(Boolean);
  if (!objects.length) return null;

  const bounds = unionAnnotationBounds(objects.map(object => annotationObjectVisualBounds(object)).filter(Boolean));
  if (!bounds) return null;
  translateAllAnnotationObjects(objects, -bounds.x, -bounds.y);
  return normalizeAnnotationTemplate({
    id: annotationObjectId("template"),
    name,
    width: bounds.width,
    height: bounds.height,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    grouped,
    groupName,
    objects
  });
}

export function instantiateAnnotationTemplate(templateInput, center, idFactory = annotationObjectId, groupId = "") {
  const template = normalizeAnnotationTemplate(templateInput);
  if (!template) return [];
  const offsetX = finiteNumber(center?.x, 0) - (template.width / 2);
  const offsetY = finiteNumber(center?.y, 0) - (template.height / 2);
  const instanceGroupId = template.objects.length > 1 || template.grouped
    ? safeGroupId(groupId) || annotationObjectId("group")
    : "";
  const objects = template.objects.map(object => {
    const copy = deepCopy(object);
    copy.id = String(idFactory(copy.type) || annotationObjectId(copy.type));
    copy.locked = false;
    copy.groupId = instanceGroupId;
    return copy;
  });
  translateAllAnnotationObjects(objects, offsetX, offsetY);
  return objects;
}

function annotationTemplateFormattingPlan(templateInput, destinationObjectsInput) {
  const template = normalizeAnnotationTemplate(templateInput);
  const destinations = Array.isArray(destinationObjectsInput)
    ? destinationObjectsInput.filter(object => object && typeof object === "object")
    : [];
  const sources = template?.objects || [];
  const structureMatches = destinations.length === sources.length
    && destinations.every((object, index) => object.type === sources[index]?.type);
  const sourcesByType = new Map();
  sources.forEach(source => {
    if (!annotationTemplateStyleFields[source.type]) return;
    const matches = sourcesByType.get(source.type) || [];
    matches.push(source);
    sourcesByType.set(source.type, matches);
  });

  const typeIndexes = new Map();
  const matches = [];
  destinations.forEach((destination, index) => {
    if (!annotationTemplateStyleFields[destination.type]) return;
    let source = null;
    if (structureMatches) {
      source = sources[index];
    } else {
      const candidates = sourcesByType.get(destination.type) || [];
      const typeIndex = typeIndexes.get(destination.type) || 0;
      source = candidates[Math.min(typeIndex, Math.max(0, candidates.length - 1))] || null;
      typeIndexes.set(destination.type, typeIndex + 1);
    }
    if (source?.type === destination.type) matches.push({ destination, source });
  });

  return {
    structureMatches,
    selectedCount: destinations.length,
    matches,
    editableMatchCount: matches.filter(match => !match.destination.locked).length
  };
}

export function applyAnnotationTemplateFormatting(templateInput, destinationObjectsInput) {
  const plan = annotationTemplateFormattingPlan(templateInput, destinationObjectsInput);
  let appliedCount = 0;
  let changedCount = 0;
  let lockedCount = 0;
  let geometryConstrainedCount = 0;

  plan.matches.forEach(({ destination, source }) => {
    if (destination.locked) {
      lockedCount += 1;
      return;
    }
    const fields = annotationTemplateStyleFields[destination.type];
    const before = JSON.stringify(fields.map(field => destination[field]));
    let geometryConstrained = false;

    if (destination.type === "arrow") {
      const requestedStrokeWidth = annotationArrowStrokeWidth(source);
      const requestedArrowSize = annotationArrowRequestedHeadLength(source);
      const length = Math.hypot(destination.x2 - destination.x1, destination.y2 - destination.y1);
      const maximumHeadSpan = Math.max(minimumScaledArrowSize, (length * 0.8) - 0.000001);
      const maximumStrokeWidth = Math.max(minimumScaledStrokeWidth, maximumHeadSpan / 1.5);
      destination.stroke = source.stroke;
      destination.strokeWidth = Math.min(requestedStrokeWidth, maximumStrokeWidth);
      destination.arrowSize = Math.min(requestedArrowSize, maximumHeadSpan);
      destination.opacity = source.opacity;
      geometryConstrained = destination.strokeWidth !== requestedStrokeWidth
        || destination.arrowSize !== requestedArrowSize;
    } else {
      fields.forEach(field => { destination[field] = source[field]; });
    }

    appliedCount += 1;
    if (before !== JSON.stringify(fields.map(field => destination[field]))) changedCount += 1;
    if (geometryConstrained) geometryConstrainedCount += 1;
  });

  return {
    structureMatches: plan.structureMatches,
    selectedCount: plan.selectedCount,
    matchedCount: plan.matches.length,
    appliedCount,
    changedCount,
    lockedCount,
    geometryConstrainedCount
  };
}

export function annotationWorkspaceBounds(inputState, viewportWidth = 0, viewportHeight = 0) {
  const state = normalizeAnnotationState(inputState);
  const content = annotationOutputBounds(state);
  const minimumWidth = (Math.max(0, finiteNumber(viewportWidth, 0)) + 96) / minimumZoom;
  const minimumHeight = (Math.max(0, finiteNumber(viewportHeight, 0)) + 96) / minimumZoom;
  const width = Math.max(content.width * 3, minimumWidth, 1);
  const height = Math.max(content.height * 3, minimumHeight, 1);
  const centerX = content.x + (content.width / 2);
  const centerY = content.y + (content.height / 2);
  return {
    x: centerX - (width / 2),
    y: centerY - (height / 2),
    width,
    height
  };
}

export function annotationExpandedWorkspaceBounds(currentBounds, inputState, viewportWidth = 0, viewportHeight = 0) {
  const content = annotationOutputBounds(inputState);
  const existing = currentBounds && typeof currentBounds === "object"
    ? {
        x: finiteNumber(currentBounds.x, 0),
        y: finiteNumber(currentBounds.y, 0),
        width: positiveNumber(currentBounds.width, 1),
        height: positiveNumber(currentBounds.height, 1)
      }
    : null;
  if (existing && annotationBoundsContain(existing, content)) return existing;
  const extension = annotationWorkspaceBounds(inputState, viewportWidth, viewportHeight);
  return unionAnnotationBounds([existing, extension, content]) || extension;
}

export function annotationOutputBounds(inputState) {
  const state = normalizeAnnotationState(inputState);
  const imageFrame = state.imageClip;
  const bounds = state.objects
    .map(object => annotationObjectVisualBounds(object, imageFrame))
    .filter(Boolean);
  return unionAnnotationBounds(bounds) || imageFrame;
}

export function annotationObjectsIntersectingRect(objects, rect, imageFrame = null) {
  const selectionRect = normalizedRect(
    { x: finiteNumber(rect?.x, 0), y: finiteNumber(rect?.y, 0) },
    {
      x: finiteNumber(rect?.x, 0) + Math.max(0, finiteNumber(rect?.width, 0)),
      y: finiteNumber(rect?.y, 0) + Math.max(0, finiteNumber(rect?.height, 0))
    }
  );
  const source = Array.isArray(objects) ? objects : [];
  const directlyTouched = source.filter(object => {
    const bounds = annotationObjectVisualBounds(object, imageFrame);
    if (!bounds) return false;
    return object.type === "arrow"
      ? annotationArrowIntersectsRect(object, selectionRect)
      : annotationBoundsIntersect(selectionRect, bounds);
  });
  const groupIds = new Set(directlyTouched.map(object => object.groupId).filter(Boolean));
  return source.filter(object => directlyTouched.includes(object) || (object.groupId && groupIds.has(object.groupId)));
}

export function annotationSelectionIdsForObject(objects, object) {
  if (!object?.id) return [];
  const source = Array.isArray(objects) ? objects : [];
  return object.groupId
    ? source.filter(item => item.groupId === object.groupId).map(item => item.id)
    : [object.id];
}

export function buildAnnotationObjectTree(inputState) {
  const state = normalizeAnnotationState(inputState);
  const topmostFirst = [...state.objects].reverse();
  const renderedGroups = new Set();
  let unnamedGroupSequence = 0;
  const objectNode = object => ({
    kind: "object",
    id: object.id,
    name: object.name || annotationObjectLabel(object),
    object
  });

  return topmostFirst.flatMap(object => {
    if (!object.groupId) return [objectNode(object)];
    if (renderedGroups.has(object.groupId)) return [];
    renderedGroups.add(object.groupId);
    unnamedGroupSequence += 1;
    const children = topmostFirst
      .filter(member => member.groupId === object.groupId)
      .map(objectNode);
    return [{
      kind: "group",
      id: object.groupId,
      name: state.groupNames[object.groupId] || `Group ${unnamedGroupSequence}`,
      children,
      allChildren: children
    }];
  });
}

export function filterAnnotationObjectTree(nodes, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return Array.isArray(nodes) ? nodes : [];
  return (Array.isArray(nodes) ? nodes : []).flatMap(node => {
    if (String(node.name || "").toLocaleLowerCase().includes(needle)) return [node];
    if (node.kind !== "group") return [];
    const children = node.children.filter(child => String(child.name || "").toLocaleLowerCase().includes(needle));
    return children.length ? [{ ...node, children }] : [];
  });
}

export function reorderAnnotationObjectTree(inputState, move = {}) {
  const state = normalizeAnnotationState(inputState);
  const draggedKind = move.draggedKind === "group" ? "group" : "object";
  const draggedId = String(move.draggedId || "");
  const targetKind = ["group", "object", "root"].includes(move.targetKind)
    ? move.targetKind
    : "root";
  const targetId = String(move.targetId || "");
  const requestedPlacement = ["before", "after", "inside"].includes(move.targetPlacement)
    ? move.targetPlacement
    : targetKind === "group" ? "inside" : "before";
  const targetPlacement = targetKind === "group" && requestedPlacement === "after"
    ? "inside"
    : requestedPlacement;
  const moving = draggedKind === "group"
    ? state.objects.filter(object => object.groupId === draggedId)
    : state.objects.filter(object => object.id === draggedId);
  if (!moving.length || moving.some(object => object.locked)) return state;
  if (targetKind !== "root" && moving.some(object => object.id === targetId)) return state;
  if (targetKind === "group" && draggedKind === "group" && draggedId === targetId) return state;

  const targetObject = targetKind === "object"
    ? state.objects.find(object => object.id === targetId) || null
    : null;
  const targetGroupId = targetKind === "group"
    ? safeGroupId(targetId)
    : targetKind === "object"
      ? targetObject?.groupId || ""
      : "";
  const destinationGroupId = targetKind === "group" && targetPlacement !== "inside"
    ? ""
    : targetGroupId;
  if (targetKind === "group" && !state.objects.some(object => object.groupId === targetGroupId)) return state;
  if (targetKind === "object" && !targetObject) return state;
  if (targetObject && moving.some(object => object.id === targetObject.id)) return state;

  const movingIds = new Set(moving.map(object => object.id));
  const sourceGroupId = draggedKind === "group" ? draggedId : moving[0].groupId;
  if (draggedKind === "object") {
    moving[0].groupId = destinationGroupId;
  } else if (destinationGroupId && destinationGroupId !== draggedId) {
    moving.forEach(object => { object.groupId = destinationGroupId; });
    delete state.groupNames[draggedId];
  }

  const fixedImages = state.objects.filter(object => object.type === "image");
  const movingLayers = moving.filter(object => object.type !== "image");
  const remainingLayers = state.objects.filter(object => object.type !== "image" && !movingIds.has(object.id));
  let insertionIndex = remainingLayers.length;
  if (targetKind === "object") {
    const targetIndex = remainingLayers.findIndex(object => object.id === targetId);
    insertionIndex = targetIndex < 0
      ? 0
      : targetIndex + (targetPlacement === "after" ? 0 : 1);
  } else if (targetKind === "group") {
    const groupIndexes = remainingLayers
      .map((object, index) => object.groupId === targetGroupId ? index : -1)
      .filter(index => index >= 0);
    insertionIndex = groupIndexes.length ? Math.max(...groupIndexes) + 1 : remainingLayers.length;
  }
  remainingLayers.splice(insertionIndex, 0, ...movingLayers);
  state.objects = [...fixedImages, ...remainingLayers];
  compactAnnotationGroupLayers(state.objects);

  if (draggedKind === "object" && sourceGroupId && sourceGroupId !== destinationGroupId
    && !state.objects.some(object => object.groupId === sourceGroupId)) {
    delete state.groupNames[sourceGroupId];
  }
  pruneAnnotationGroupNames(state);
  return state;
}

export function compactAnnotationGroupLayers(objects) {
  if (!Array.isArray(objects) || objects.length < 2) return objects;
  const images = objects.filter(object => object.type === "image");
  const layers = objects.filter(object => object.type !== "image");
  const imageGroupIds = new Set(images.map(object => object.groupId).filter(Boolean));
  const imageGroupLayers = layers.filter(object => imageGroupIds.has(object.groupId));
  const remaining = layers.filter(object => !imageGroupIds.has(object.groupId));
  const grouped = new Map();
  remaining.forEach((object, index) => {
    if (!object.groupId) return;
    const entry = grouped.get(object.groupId) || { members: [], topmostIndex: index };
    entry.members.push(object);
    entry.topmostIndex = index;
    grouped.set(object.groupId, entry);
  });
  const compacted = [];
  remaining.forEach((object, index) => {
    if (!object.groupId) {
      compacted.push(object);
      return;
    }
    const entry = grouped.get(object.groupId);
    if (entry?.topmostIndex === index) compacted.push(...entry.members);
  });
  objects.splice(0, objects.length, ...images, ...imageGroupLayers, ...compacted);
  return objects;
}

export function snapAnnotationValue(value, enabled, gridSize = defaultGridSize) {
  const numeric = finiteNumber(value, 0);
  if (!enabled) return numeric;
  const size = positiveNumber(gridSize, defaultGridSize);
  return Math.round(numeric / size) * size;
}

export function snapAnnotationCropPoint(point, imageClip, enabled, gridSize = defaultGridSize) {
  const clip = {
    x: finiteNumber(imageClip?.x, 0),
    y: finiteNumber(imageClip?.y, 0),
    width: positiveNumber(imageClip?.width, 1),
    height: positiveNumber(imageClip?.height, 1)
  };
  const snapCoordinate = (value, start, length) => {
    const end = start + length;
    const bounded = clampNumber(finiteNumber(value, start), start, end);
    if (bounded === start || bounded === end) return bounded;
    return clampNumber(
      start + snapAnnotationValue(bounded - start, enabled, gridSize),
      start,
      end
    );
  };
  return {
    x: snapCoordinate(point?.x, clip.x, clip.width),
    y: snapCoordinate(point?.y, clip.y, clip.height)
  };
}

export function adjustAnnotationArrowEndpoint(inputArrow, endpoint, point, snapEnabled = false, gridSize = defaultGridSize) {
  const arrow = { ...inputArrow };
  const movingBase = endpoint === "base" || endpoint === "arrow-base";
  const anchor = movingBase
    ? { x: finiteNumber(arrow.x2, 0), y: finiteNumber(arrow.y2, 0) }
    : { x: finiteNumber(arrow.x1, 0), y: finiteNumber(arrow.y1, 0) };
  const candidate = {
    x: snapAnnotationValue(point?.x, snapEnabled, gridSize),
    y: snapAnnotationValue(point?.y, snapEnabled, gridSize)
  };
  let deltaX = candidate.x - anchor.x;
  let deltaY = candidate.y - anchor.y;
  let length = Math.hypot(deltaX, deltaY);
  const minimumLength = annotationMinimumArrowLength(arrow);
  if (length < minimumLength) {
    if (!length) {
      const originalX = movingBase
        ? finiteNumber(arrow.x1, anchor.x) - anchor.x
        : finiteNumber(arrow.x2, anchor.x) - anchor.x;
      const originalY = movingBase
        ? finiteNumber(arrow.y1, anchor.y) - anchor.y
        : finiteNumber(arrow.y2, anchor.y) - anchor.y;
      const originalLength = Math.hypot(originalX, originalY);
      deltaX = originalLength ? originalX / originalLength : movingBase ? -1 : 1;
      deltaY = originalLength ? originalY / originalLength : 0;
    } else {
      deltaX /= length;
      deltaY /= length;
    }
    length = minimumLength;
    candidate.x = anchor.x + (deltaX * length);
    candidate.y = anchor.y + (deltaY * length);
  }
  if (movingBase) {
    arrow.x1 = candidate.x;
    arrow.y1 = candidate.y;
  } else {
    arrow.x2 = candidate.x;
    arrow.y2 = candidate.y;
  }
  return arrow;
}

export function zoomAnnotationAtPoint({
  oldZoom,
  newZoom,
  scrollLeft,
  scrollTop,
  pointX,
  pointY,
  contentOffsetX = 0,
  contentOffsetY = 0
}) {
  const before = clampNumber(positiveNumber(oldZoom, 1), minimumZoom, maximumZoom);
  const after = clampNumber(positiveNumber(newZoom, before), minimumZoom, maximumZoom);
  const x = finiteNumber(pointX, 0);
  const y = finiteNumber(pointY, 0);
  const offsetX = finiteNumber(contentOffsetX, 0);
  const offsetY = finiteNumber(contentOffsetY, 0);
  return {
    zoom: after,
    scrollLeft: (((finiteNumber(scrollLeft, 0) + x - offsetX) / before) * after) - x + offsetX,
    scrollTop: (((finiteNumber(scrollTop, 0) + y - offsetY) / before) * after) - y + offsetY
  };
}

export function wrapAnnotationText(text, width, fontSize) {
  const value = String(text ?? "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const size = clampNumber(positiveNumber(fontSize, defaultStyles.fontSize), 6, 240);
  const availableWidth = Math.max(size, positiveNumber(width, size) - (size * 0.7));
  const maximumCharacters = Math.max(1, Math.floor(availableWidth / (size * 0.58)));
  const lines = [];

  value.split("\n").forEach(paragraph => {
    if (!paragraph) {
      lines.push("");
      return;
    }

    let current = "";
    paragraph.split(/\s+/).forEach(word => {
      const pieces = splitLongWord(word, maximumCharacters);
      pieces.forEach(piece => {
        const candidate = current ? `${current} ${piece}` : piece;
        if (candidate.length <= maximumCharacters) {
          current = candidate;
          return;
        }

        if (current) lines.push(current);
        current = piece;
      });
    });
    if (current) lines.push(current);
  });

  return lines.length ? lines : [""];
}

function createAnnotationDialog(context) {
  return new Promise(resolve => {
    let state = deepCopy(context.state);
    let templateLibrary = normalizeAnnotationTemplateLibrary(context.templateLibrary);
    let templateBusy = false;
    const templateLibraryAvailable = !context.templateLibraryError
      && typeof context.saveTemplateLibrary === "function";
    const defaultTemplateLibraryAvailable = typeof context.loadDefaultTemplateLibrary === "function";
    let activeInspectorTab = "format";
    let nativeClipboard = null;
    let pasteSequence = 0;
    let lastTreeSelectionKey = "";
    let treeRangeAnchorKey = "";
    let draggedTreeNode = null;
    let objectTreeSearchQuery = "";
    let zoom = 1;
    let activeTool = "select";
    const initialObject = state.objects.find(object => object.type === "image") || null;
    let selectedIds = new Set(annotationSelectionIdsForObject(state.objects, initialObject));
    let lastSelectedObjectId = initialObject?.id || "";
    let gesture = null;
    let panGesture = null;
    const embeddedSources = annotationEmbeddedSourceRegistry(state.objects);
    let history = [annotationSnapshot(state, embeddedSources)];
    let historyIndex = 0;
    let historyTimer = 0;
    let objectSequence = state.objects.length;
    let groupSequence = 0;
    let cropPreview = null;
    let marqueePreview = null;
    let workspaceBounds = annotationWorkspaceBounds(state);
    let lastZoomPoint = null;
    let applying = false;
    let copying = false;
    let inspectorVisible = true;
    let maximized = false;
    let resolved = false;
    let contextMenuScrollGuardToken = 0;
    let contextMenuScrollGuardActive = false;
    const styles = { ...defaultStyles };

    const dialog = document.createElement("dialog");
    dialog.className = "dialog image-annotation-dialog";
    dialog.setAttribute("aria-labelledby", "imageAnnotationTitle");
    dialog.innerHTML = annotationDialogHtml();
    document.body.appendChild(dialog);

    const canvas = dialog.querySelector("[data-annotation-canvas]");
    const workspace = dialog.querySelector("[data-annotation-workspace]");
    const statusRegions = [...dialog.querySelectorAll("[data-annotation-status], [data-annotation-maximized-status]")];
    const textInput = dialog.querySelector("[data-annotation-text]");
    const toolbar = dialog.querySelector(".image-annotation-toolbar");
    const main = dialog.querySelector("[data-annotation-main]");
    const inspector = dialog.querySelector("[data-annotation-inspector]");
    const inspectorToggle = dialog.querySelector("[data-annotation-toggle-inspector]");
    const contextMenu = dialog.querySelector("[data-annotation-context-menu]");
    const maximizeButton = dialog.querySelector("[data-annotation-maximize]");
    const restoreButton = dialog.querySelector("[data-annotation-restore]");
    const maximizedActions = dialog.querySelector("[data-annotation-maximized-actions]");
    const templateList = dialog.querySelector("[data-annotation-template-list]");
    const templateStatus = dialog.querySelector("[data-annotation-template-status]");
    const objectTree = dialog.querySelector("[data-annotation-object-tree]");
    const objectTreeSearch = dialog.querySelector("[data-annotation-object-tree-search]");

    const finish = value => {
      if (resolved) return;
      resolved = true;
      if (historyTimer) window.clearTimeout(historyTimer);
      window.removeEventListener("resize", closeAnnotationContextMenu);
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };

    const setStatus = message => {
      statusRegions.forEach(region => { region.textContent = message || ""; });
    };

    const updateLayoutPreservingWorkspaceCenter = (update, focusTarget) => {
      const centerX = workspace.scrollLeft + (workspace.clientWidth / 2);
      const centerY = workspace.scrollTop + (workspace.clientHeight / 2);
      update();
      window.requestAnimationFrame(() => {
        workspace.scrollLeft = centerX - (workspace.clientWidth / 2);
        workspace.scrollTop = centerY - (workspace.clientHeight / 2);
        focusTarget?.focus({ preventScroll: true });
      });
    };

    const setInspectorVisible = visible => {
      inspectorVisible = visible !== false;
      updateLayoutPreservingWorkspaceCenter(() => {
        inspector.hidden = !inspectorVisible;
        main.classList.toggle("is-inspector-hidden", !inspectorVisible);
        inspectorToggle.textContent = inspectorVisible ? "Hide Right Pane" : "Show Right Pane";
        inspectorToggle.title = inspectorVisible ? "Hide Right Pane" : "Show Right Pane";
        inspectorToggle.setAttribute("aria-label", inspectorToggle.title);
        inspectorToggle.setAttribute("aria-expanded", String(inspectorVisible));
      }, inspectorToggle);
    };

    const setInspectorTab = tabName => {
      activeInspectorTab = ["format", "template", "objects"].includes(tabName) ? tabName : "format";
      dialog.querySelectorAll("[data-annotation-inspector-tab]").forEach(tab => {
        const selected = tab.dataset.annotationInspectorTab === activeInspectorTab;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });
      dialog.querySelectorAll("[data-annotation-inspector-panel]").forEach(panel => {
        panel.hidden = panel.dataset.annotationInspectorPanel !== activeInspectorTab;
      });
    };

    const setMaximized = value => {
      maximized = value === true;
      closeAnnotationContextMenu();
      updateLayoutPreservingWorkspaceCenter(() => {
        dialog.classList.toggle("is-annotation-maximized", maximized);
        restoreButton.hidden = !maximized;
        maximizedActions.hidden = !maximized;
      }, maximized ? restoreButton : maximizeButton);
    };

    function closeAnnotationContextMenu() {
      contextMenuScrollGuardToken += 1;
      contextMenuScrollGuardActive = false;
      const restoreSelectionFocus = !contextMenu.hidden && contextMenu.contains(document.activeElement);
      contextMenu.hidden = true;
      dialog.classList.remove("rich-image-menu-open");
      if (restoreSelectionFocus) focusLastSelectedObject();
    }

    const positionAnnotationContextMenu = event => {
      const margin = 8;
      contextMenu.hidden = false;
      dialog.classList.add("rich-image-menu-open");
      const maximumLeft = Math.max(margin, window.innerWidth - contextMenu.offsetWidth - margin);
      const maximumTop = Math.max(margin, window.innerHeight - contextMenu.offsetHeight - margin);
      contextMenu.style.left = `${Math.round(Math.max(margin, Math.min(event.clientX, maximumLeft)))}px`;
      contextMenu.style.top = `${Math.round(Math.max(margin, Math.min(event.clientY, maximumTop)))}px`;
    };

    const setTool = tool => {
      activeTool = ["select", "crop", "rectangle", "arrow", "textbox"].includes(tool) ? tool : "select";
      if (activeTool !== "select") marqueePreview = null;
      dialog.querySelectorAll("button[data-annotation-tool]").forEach(button => {
        const pressed = button.dataset.annotationTool === activeTool;
        button.classList.toggle("is-active", pressed);
        button.setAttribute("aria-pressed", String(pressed));
      });
      workspace.dataset.annotationTool = activeTool;
      setStatus(activeTool === "select"
        ? "Select, move, resize, or drag from blank canvas to marquee-select objects."
        : activeTool === "crop"
          ? "Drag over the area to keep. Cropping is non-destructive and can be reset."
          : `Draw a ${activeTool === "textbox" ? "text box" : activeTool}.`);
    };

    const selectedObjects = () => state.objects.filter(object => selectedIds.has(object.id));
    const editableSelection = () => selectedObjects().filter(object => !object.locked);

    const syncControls = () => {
      const selection = selectedObjects();
      const first = selection[0] || null;
      const singleText = selection.length === 1 && first?.type === "textbox" ? first : null;
      const hasSelection = selection.length > 0;
      const annotationCount = selection.filter(object => object.type !== "image").length;
      const allLocked = hasSelection && selection.every(object => object.locked);
      const hasLocked = selection.some(object => object.locked);
      const containsImage = selection.some(object => object.type === "image");
      const image = state.objects.find(object => object.type === "image");
      const imageLocked = image?.locked === true;
      const groupIds = new Set(selection.map(object => object.groupId).filter(Boolean));
      const alreadyOneGroup = groupIds.size === 1
        && selection.every(object => object.groupId && groupIds.has(object.groupId));

      dialog.querySelector("[data-annotation-selection-label]").textContent = !hasSelection
        ? "No selection"
        : selection.length === 1
          ? `${annotationObjectLabel(first)}${first.locked ? " (Locked)" : ""}`
          : `${selection.length} objects selected`;

      setControlValue(textInput, singleText?.text || "");
      textInput.disabled = !singleText || singleText.locked;
      dialog.querySelector("[data-annotation-text-field]").hidden = !singleText;

      const firstOpacityObject = selection.find(object => ["rectangle", "textbox", "arrow"].includes(object.type));
      syncStyleControl("fill", first?.fill === "none" ? styles.fill : first?.fill || styles.fill);
      syncStyleControl("stroke", first?.stroke || styles.stroke);
      syncStyleControl("textColor", first?.textColor || styles.textColor);
      syncStyleControl("fontFamily", first?.fontFamily || styles.fontFamily);
      syncStyleControl("fontSize", first?.fontSize || styles.fontSize);
      syncStyleControl("textAlign", first?.textAlign || styles.textAlign);
      syncStyleControl("textVerticalAlign", first?.textVerticalAlign || styles.textVerticalAlign);
      syncStyleControl("opacity", Math.round((firstOpacityObject?.opacity ?? styles.opacity) * 100));
      syncStyleControl("strokeWidth", first?.strokeWidth || styles.strokeWidth);
      syncStyleControl("arrowSize", first?.arrowSize || styles.arrowSize);
      const opacityControl = dialog.querySelector("[data-annotation-style='opacity']");
      if (opacityControl) {
        opacityControl.disabled = hasSelection
          && !selection.some(object => ["rectangle", "textbox", "arrow"].includes(object.type) && !object.locked);
      }
      const outlineObjects = selection.filter(object => ["rectangle", "textbox"].includes(object.type));
      const outline = dialog.querySelector("[data-annotation-outline]");
      outline.checked = outlineObjects.length
        ? outlineObjects.every(object => object.outlineVisible !== false)
        : styles.outlineVisible !== false;
      outline.indeterminate = outlineObjects.some(object => object.outlineVisible === false)
        && outlineObjects.some(object => object.outlineVisible !== false);
      outline.disabled = !outlineObjects.some(object => !object.locked);
      const transparent = dialog.querySelector("[data-annotation-transparent-fill]");
      transparent.checked = first?.fill === "none";
      transparent.disabled = !selection.some(object => ["rectangle", "textbox"].includes(object.type));

      dialog.querySelectorAll("[data-annotation-requires-selection]").forEach(button => {
        button.disabled = !hasSelection;
      });
      dialog.querySelector("[data-annotation-action='delete']").disabled = annotationCount === 0;
      dialog.querySelector("button[data-annotation-tool='crop']").disabled = imageLocked;
      dialog.querySelector("[data-annotation-context-tool='crop']").disabled = !containsImage || hasLocked || imageLocked;
      dialog.querySelector("[data-annotation-action='group']").disabled = selection.length < 2 || hasLocked || alreadyOneGroup;
      dialog.querySelector("[data-annotation-action='ungroup']").disabled = groupIds.size === 0 || hasLocked;
      ["back", "backward", "forward", "front"].forEach(action => {
        dialog.querySelector(`[data-annotation-action='${action}']`).disabled = annotationCount === 0 || hasLocked;
      });
      const lockButton = dialog.querySelector("[data-annotation-action='lock']");
      const lockLabel = lockButton.querySelector(".dropdown-menu-label");
      if (lockLabel) lockLabel.textContent = allLocked ? "Unlock" : "Lock";
      else lockButton.textContent = allLocked ? "Unlock" : "Lock";
      lockButton.title = allLocked ? "Unlock selected objects" : "Lock selected objects";
      lockButton.setAttribute("aria-label", lockButton.title);
      const fullImageBounds = image
        ? { x: image.x, y: image.y, width: image.width, height: image.height }
        : null;
      dialog.querySelector("[data-annotation-action='reset-crop']").disabled = !containsImage
        || hasLocked
        || !fullImageBounds
        || annotationBoundsEqual(state.imageClip, fullImageBounds);
      dialog.querySelector("[data-annotation-action='undo']").disabled = historyIndex <= 0;
      dialog.querySelector("[data-annotation-action='redo']").disabled = historyIndex >= history.length - 1;
      dialog.querySelector("[data-annotation-zoom-label]").textContent = `${Math.round(zoom * 100)}%`;
      dialog.querySelector("[data-annotation-grid]").checked = state.gridVisible;
      dialog.querySelector("[data-annotation-snap]").checked = state.snapToGrid;
      const saveTemplateButton = dialog.querySelector("[data-annotation-template-save]");
      if (saveTemplateButton) saveTemplateButton.disabled = !hasSelection || templateBusy || !templateLibraryAvailable;
      const selectedArrow = selection.length === 1 && first?.type === "arrow" && !first.locked;
      const selectedRectangle = selection.length === 1 && first?.type === "rectangle" && !first.locked;
      const setArrowDefault = dialog.querySelector("[data-annotation-template-default='arrow']");
      const setRectangleDefault = dialog.querySelector("[data-annotation-template-default='rectangle']");
      if (setArrowDefault) setArrowDefault.disabled = !selectedArrow || templateBusy || !templateLibraryAvailable;
      if (setRectangleDefault) setRectangleDefault.disabled = !selectedRectangle || templateBusy || !templateLibraryAvailable;
      const resetArrowDefault = dialog.querySelector("[data-annotation-template-reset-default='arrow']");
      const resetRectangleDefault = dialog.querySelector("[data-annotation-template-reset-default='rectangle']");
      if (resetArrowDefault) resetArrowDefault.disabled = !templateLibrary.defaults.arrow || templateBusy || !templateLibraryAvailable;
      if (resetRectangleDefault) resetRectangleDefault.disabled = !templateLibrary.defaults.rectangle || templateBusy || !templateLibraryAvailable;
      dialog.querySelectorAll("[data-annotation-template-action]").forEach(button => {
        button.disabled = templateBusy || !templateLibraryAvailable
          || (button.dataset.annotationTemplateAction === "restore-defaults" && !defaultTemplateLibraryAvailable)
          || button.dataset.annotationTemplateBoundaryDisabled === "true";
      });
      const selectedTreeTarget = resolveSelectedTreeTarget();
      const treeRenameButton = dialog.querySelector("[data-annotation-tree-action='rename']");
      const treeCopyButton = dialog.querySelector("[data-annotation-tree-action='copy']");
      const treePasteButton = dialog.querySelector("[data-annotation-tree-action='paste']");
      const treeDeleteButton = dialog.querySelector("[data-annotation-tree-action='delete']");
      if (treeRenameButton) treeRenameButton.disabled = !selectedTreeTarget;
      if (treeCopyButton) treeCopyButton.disabled = !hasSelection;
      if (treePasteButton) treePasteButton.disabled = !nativeClipboard;
      if (treeDeleteButton) treeDeleteButton.disabled = !selection.some(object => object.type !== "image" && !object.locked);
      const rootDropButton = dialog.querySelector("[data-annotation-tree-root-drop]");
      if (rootDropButton) {
        const canMoveToRoot = treeTargetCanMoveToRoot(selectedTreeTarget);
        rootDropButton.setAttribute("aria-disabled", String(!canMoveToRoot));
        rootDropButton.classList.toggle("is-disabled", !canMoveToRoot);
      }
    };

    const syncStyleControl = (name, value) => {
      const colorPicker = dialog.querySelector(`[data-annotation-color-picker='${name}']`);
      if (colorPicker) {
        colorPicker.style.setProperty("--rich-selected-color", String(value));
        const trigger = colorPicker.querySelector("[data-annotation-color-trigger]");
        if (trigger) trigger.dataset.richSelectedColor = String(value);
        return;
      }
      const control = dialog.querySelector(`[data-annotation-style='${name}']`);
      if (control) setControlValue(control, String(value));
    };

    const renderObjectTree = () => {
      if (!objectTree) return;
      pruneAnnotationGroupNames(state);
      objectTree.innerHTML = annotationObjectTreeHtml(
        filterAnnotationObjectTree(buildAnnotationObjectTree(state), objectTreeSearchQuery),
        selectedIds,
        objectTreeSearchQuery.trim() ? "No matching objects." : "No canvas objects."
      );
    };

    const render = () => {
      pruneAnnotationGroupNames(state);
      compactAnnotationGroupLayers(state.objects);
      canvas.setAttribute("viewBox", `${formatNumber(workspaceBounds.x)} ${formatNumber(workspaceBounds.y)} ${formatNumber(workspaceBounds.width)} ${formatNumber(workspaceBounds.height)}`);
      canvas.setAttribute("width", formatNumber(workspaceBounds.width * zoom));
      canvas.setAttribute("height", formatNumber(workspaceBounds.height * zoom));
      canvas.innerHTML = annotationCanvasSvg(
        state,
        context.originalDataUrl,
        selectedIds,
        zoom,
        workspaceBounds,
        cropPreview,
        marqueePreview
      );
      renderObjectTree();
      syncControls();
    };

    const focusLastSelectedObject = () => {
      const selectedId = selectedIds.has(lastSelectedObjectId)
        ? lastSelectedObjectId
        : [...selectedIds].at(-1);
      const selectedElement = selectedId
        ? [...canvas.querySelectorAll("[data-annotation-object-id]")]
            .find(element => element.dataset.annotationObjectId === selectedId)
        : null;
      if (!selectedElement) {
        workspace.focus({ preventScroll: true });
        return;
      }
      lastSelectedObjectId = selectedId;
      selectedElement.setAttribute("tabindex", "-1");
      selectedElement.focus({ preventScroll: true });
    };

    const renderWithWorkspaceExpansion = () => {
      const previous = workspaceBounds;
      const next = annotationExpandedWorkspaceBounds(
        previous,
        state,
        workspace.clientWidth,
        workspace.clientHeight
      );
      const changed = !annotationBoundsEqual(previous, next);
      if (changed) workspaceBounds = next;
      render();
      if (changed) {
        workspace.scrollLeft += (previous.x - next.x) * zoom;
        workspace.scrollTop += (previous.y - next.y) * zoom;
      }
    };

    const restoreHistory = nextIndex => {
      if (nextIndex < 0 || nextIndex >= history.length) return;
      historyIndex = nextIndex;
      const restoredState = JSON.parse(history[historyIndex]);
      restoreAnnotationEmbeddedSources(restoredState.objects, embeddedSources);
      state = normalizeAnnotationState(restoredState, {
        width: state.width,
        height: state.height,
        originalReference: context.originalReference
      });
      selectedIds.clear();
      gesture = null;
      marqueePreview = null;
      renderWithWorkspaceExpansion();
      workspace.focus({ preventScroll: true });
    };

    const pushHistory = () => {
      if (historyTimer) {
        window.clearTimeout(historyTimer);
        historyTimer = 0;
      }
      const snapshot = annotationSnapshot(state, embeddedSources);
      if (history[historyIndex] === snapshot) return;
      history = history.slice(0, historyIndex + 1);
      history.push(snapshot);
      if (history.length > 100) history.shift();
      historyIndex = history.length - 1;
      syncControls();
    };

    const scheduleHistory = () => {
      if (historyTimer) window.clearTimeout(historyTimer);
      historyTimer = window.setTimeout(pushHistory, 350);
    };

    const selectObject = (object, additive = false) => {
      const ids = annotationSelectionIdsForObject(state.objects, object);
      if (!additive) selectedIds.clear();
      const shouldRemove = additive && ids.every(id => selectedIds.has(id));
      ids.forEach(id => shouldRemove ? selectedIds.delete(id) : selectedIds.add(id));
      lastSelectedObjectId = selectedIds.has(object.id)
        ? object.id
        : [...selectedIds].at(-1) || "";
    };

    const openAnnotationContextMenuAt = (point, refreshSelection = false) => {
      setTool("select");
      if (refreshSelection) render();
      positionAnnotationContextMenu(point);
      contextMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
      const guardToken = ++contextMenuScrollGuardToken;
      contextMenuScrollGuardActive = true;
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (contextMenuScrollGuardToken === guardToken) contextMenuScrollGuardActive = false;
      }));
    };

    const showAnnotationContextMenu = event => {
      event.preventDefault();
      event.stopPropagation();
      closeAnnotationContextMenu();

      const objectElement = event.target.closest?.("[data-annotation-object-id]");
      const object = state.objects.find(item => item.id === objectElement?.dataset.annotationObjectId);
      const selectionHandle = event.target.closest?.("[data-annotation-handle]");
      const refreshSelection = Boolean(object && !selectedIds.has(object.id));
      if (refreshSelection) selectObject(object);
      if (!object && !selectionHandle) return;
      if (!selectedIds.size) return;

      openAnnotationContextMenuAt({ clientX: event.clientX, clientY: event.clientY }, refreshSelection);
    };

    const addObject = (type, point) => {
      objectSequence += 1;
      const id = `${type}-${Date.now().toString(36)}-${objectSequence}`;
      const base = {
        id,
        type,
        locked: false,
        groupId: ""
      };
      if (type === "arrow") {
        const preset = templateLibrary.defaults.arrow || annotationFactoryDrawingDefault("arrow");
        return {
          ...base,
          x1: point.x,
          y1: point.y,
          x2: point.x,
          y2: point.y,
          stroke: preset.stroke,
          strokeWidth: preset.strokeWidth,
          arrowSize: preset.arrowSize,
          opacity: preset.opacity ?? styles.opacity
        };
      }
      const rectanglePreset = type === "rectangle"
        ? templateLibrary.defaults.rectangle || annotationFactoryDrawingDefault("rectangle")
        : null;
      return {
        ...base,
        x: point.x,
        y: point.y,
        width: 1,
        height: 1,
        fill: type === "textbox" ? styles.fill : rectanglePreset?.fill || "none",
        stroke: rectanglePreset?.stroke || styles.stroke,
        outlineVisible: rectanglePreset?.outlineVisible ?? styles.outlineVisible,
        strokeWidth: rectanglePreset?.strokeWidth || styles.strokeWidth,
        opacity: rectanglePreset?.opacity ?? styles.opacity,
        text: type === "textbox" ? "Text" : "",
        textColor: styles.textColor,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        textAlign: styles.textAlign,
        textVerticalAlign: styles.textVerticalAlign
      };
    };

    const canvasPoint = event => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: workspaceBounds.x + (((event.clientX - rect.left) / Math.max(1, rect.width)) * workspaceBounds.width),
        y: workspaceBounds.y + (((event.clientY - rect.top) / Math.max(1, rect.height)) * workspaceBounds.height)
      };
    };

    const cropPoint = point => snapAnnotationCropPoint(
      point,
      state.imageClip,
      state.snapToGrid,
      state.gridSize
    );

    const startCanvasGesture = event => {
      if (event.button !== 0) return;
      workspace.focus({ preventScroll: true });
      const point = canvasPoint(event);
      const handle = event.target.closest?.("[data-annotation-handle]");
      const objectElement = event.target.closest?.("[data-annotation-object-id]");

      if (activeTool === "select" && handle) {
        const selection = editableSelection();
        if (!selection.length || selection.length !== selectedIds.size) {
          setStatus("Unlock the selection before resizing it.");
          return;
        }
        const handleName = handle.dataset.annotationHandle;
        if (handleName === "arrow-base" || handleName === "arrow-tip") {
          const arrow = selection.length === 1 && selection[0].type === "arrow" ? selection[0] : null;
          if (!arrow) return;
          gesture = {
            type: "arrow-endpoint",
            pointerId: event.pointerId,
            endpoint: handleName,
            objectId: arrow.id,
            original: deepCopy(arrow)
          };
          canvas.setPointerCapture?.(event.pointerId);
          event.preventDefault();
          return;
        }
        gesture = {
          type: "resize",
          pointerId: event.pointerId,
          direction: handle.dataset.annotationHandle,
          startPoint: point,
          startBounds: annotationSelectionBounds(selection, state.imageClip),
          originals: annotationGestureObjects(selection),
          startImageClip: selection.some(object => object.type === "image")
            ? deepCopy(state.imageClip)
            : null
        };
        canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        return;
      }

      if (activeTool === "select" && objectElement) {
        const object = state.objects.find(item => item.id === objectElement.dataset.annotationObjectId);
        if (!object) return;
        const additive = event.shiftKey || event.metaKey || (event.ctrlKey && object.type !== "arrow");
        selectObject(object, additive);
        const selection = editableSelection();
        const objectRemainsSelected = selectedIds.has(object.id);
        if (objectRemainsSelected && !object.locked && selection.length && selection.length === selectedIds.size) {
          gesture = {
            type: "move",
            pointerId: event.pointerId,
            startPoint: point,
            startBounds: annotationSelectionBounds(selection, state.imageClip),
            originals: annotationGestureObjects(selection),
            startImageClip: selection.some(item => item.type === "image")
              ? deepCopy(state.imageClip)
              : null
          };
          canvas.setPointerCapture?.(event.pointerId);
        } else if (objectRemainsSelected && object.locked) {
          setStatus("This object is locked. Select Unlock to move or resize it.");
        }
        render();
        event.preventDefault();
        return;
      }

      if (activeTool === "select") {
        const additive = event.shiftKey || event.ctrlKey || event.metaKey;
        const baseIds = additive ? new Set(selectedIds) : new Set();
        selectedIds = new Set(baseIds);
        marqueePreview = null;
        gesture = {
          type: "marquee",
          pointerId: event.pointerId,
          startPoint: point,
          startClientX: event.clientX,
          startClientY: event.clientY,
          baseIds,
          moved: false
        };
        canvas.setPointerCapture?.(event.pointerId);
        render();
        event.preventDefault();
        return;
      }

      if (activeTool === "crop") {
        const image = state.objects.find(object => object.type === "image");
        if (image?.locked) {
          setStatus("Unlock the image before cropping it.");
          return;
        }
        const start = cropPoint(point);
        cropPreview = { x: start.x, y: start.y, width: 1, height: 1 };
        gesture = {
          type: "crop",
          pointerId: event.pointerId,
          startPoint: start
        };
        canvas.setPointerCapture?.(event.pointerId);
        render();
        event.preventDefault();
        return;
      }

      const start = snappedPoint(point, state);
      const object = addObject(activeTool, start);
      state.objects.push(object);
      selectedIds = new Set([object.id]);
      lastSelectedObjectId = object.id;
      gesture = {
        type: "create",
        pointerId: event.pointerId,
        objectId: object.id,
        startPoint: start
      };
      canvas.setPointerCapture?.(event.pointerId);
      render();
      event.preventDefault();
    };

    const continueCanvasGesture = event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const point = canvasPoint(event);
      if (gesture.type === "create") {
        const object = state.objects.find(item => item.id === gesture.objectId);
        if (!object) return;
        updateCreatedObject(object, gesture.startPoint, snappedPoint(point, state));
      } else if (gesture.type === "crop") {
        cropPreview = normalizedRect(gesture.startPoint, cropPoint(point));
      } else if (gesture.type === "marquee") {
        gesture.moved = Math.hypot(
          event.clientX - gesture.startClientX,
          event.clientY - gesture.startClientY
        ) >= 3;
        marqueePreview = gesture.moved ? normalizedRect(gesture.startPoint, point) : null;
        const touched = marqueePreview
          ? annotationObjectsIntersectingRect(
              state.objects,
              marqueePreview,
              state.imageClip
            )
          : [];
        selectedIds = new Set([
          ...gesture.baseIds,
          ...touched.map(object => object.id)
        ]);
        lastSelectedObjectId = [...selectedIds].at(-1) || "";
      } else if (gesture.type === "move") {
        moveAnnotationObjects(state, gesture, point, event.shiftKey, event.altKey);
      } else if (gesture.type === "resize") {
        resizeAnnotationObjects(state, gesture, point, event.ctrlKey, event.altKey);
      } else if (gesture.type === "arrow-endpoint") {
        const object = state.objects.find(item => item.id === gesture.objectId);
        if (object) {
          Object.assign(object, adjustAnnotationArrowEndpoint(
            gesture.original,
            gesture.endpoint,
            point,
            state.snapToGrid,
            state.gridSize
          ));
        }
      }
      render();
      event.preventDefault();
    };

    const finishCanvasGesture = event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const completed = gesture;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      gesture = null;
      if (completed.type === "create") {
        const object = state.objects.find(item => item.id === completed.objectId);
        ensureCreatedObjectSize(object, state);
        setTool("select");
        if (object?.type === "textbox") {
          window.setTimeout(() => {
            textInput.focus();
            textInput.select();
          }, 0);
        }
      } else if (completed.type === "marquee") {
        if (!completed.moved) {
          selectedIds = new Set(completed.baseIds);
          lastSelectedObjectId = [...selectedIds].at(-1) || "";
        }
        marqueePreview = null;
        setStatus(selectedIds.size ? `${selectedIds.size} objects selected.` : "Selection cleared.");
      } else if (completed.type === "crop") {
        if (cropPreview && cropPreview.width >= minimumObjectSize && cropPreview.height >= minimumObjectSize) {
          applyAnnotationCrop(state, cropPreview);
          selectedIds.clear();
          lastSelectedObjectId = "";
          setStatus("Crop applied. Use Reset Crop to restore the full source.");
        } else {
          setStatus("Drag a larger crop area.");
        }
        cropPreview = null;
        setTool("select");
      }
      pushHistory();
      renderWithWorkspaceExpansion();
      event.preventDefault();
    };

    canvas.addEventListener("pointerdown", startCanvasGesture);
    canvas.addEventListener("pointermove", continueCanvasGesture);
    canvas.addEventListener("pointerup", finishCanvasGesture);
    canvas.addEventListener("pointercancel", finishCanvasGesture);
    canvas.addEventListener("contextmenu", showAnnotationContextMenu);
    canvas.addEventListener("dblclick", event => {
      const objectElement = event.target.closest?.("[data-annotation-object-id]");
      const object = state.objects.find(item => item.id === objectElement?.dataset.annotationObjectId);
      if (object?.type === "textbox" && !object.locked) {
        selectObject(object);
        renderWithWorkspaceExpansion();
        textInput.focus();
        textInput.select();
      }
    });

    workspace.addEventListener("pointerdown", event => {
      if (event.button !== 1) return;
      panGesture = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: workspace.scrollLeft,
        scrollTop: workspace.scrollTop
      };
      workspace.classList.add("is-panning");
      workspace.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    workspace.addEventListener("pointermove", event => {
      const rect = workspace.getBoundingClientRect();
      lastZoomPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      if (!panGesture || panGesture.pointerId !== event.pointerId) return;
      workspace.scrollLeft = panGesture.scrollLeft - (event.clientX - panGesture.startX);
      workspace.scrollTop = panGesture.scrollTop - (event.clientY - panGesture.startY);
      event.preventDefault();
    });
    const finishPan = event => {
      if (!panGesture || panGesture.pointerId !== event.pointerId) return;
      if (workspace.hasPointerCapture?.(event.pointerId)) workspace.releasePointerCapture(event.pointerId);
      panGesture = null;
      workspace.classList.remove("is-panning");
      event.preventDefault();
    };
    workspace.addEventListener("pointerup", finishPan);
    workspace.addEventListener("pointercancel", finishPan);
    workspace.addEventListener("auxclick", event => {
      if (event.button === 1) event.preventDefault();
    });
    workspace.addEventListener("scroll", () => {
      if (!contextMenuScrollGuardActive) closeAnnotationContextMenu();
    });
    workspace.addEventListener("wheel", event => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = workspace.getBoundingClientRect();
      const pointX = event.clientX - rect.left;
      const pointY = event.clientY - rect.top;
      lastZoomPoint = { x: pointX, y: pointY };
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      setZoom(zoom * factor, pointX, pointY);
    }, { passive: false });

    const setZoom = (nextZoom, pointX = workspace.clientWidth / 2, pointY = workspace.clientHeight / 2) => {
      const workspaceRect = workspace.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const next = zoomAnnotationAtPoint({
        oldZoom: zoom,
        newZoom: nextZoom,
        scrollLeft: workspace.scrollLeft,
        scrollTop: workspace.scrollTop,
        pointX,
        pointY,
        contentOffsetX: canvasRect.left - workspaceRect.left + workspace.scrollLeft,
        contentOffsetY: canvasRect.top - workspaceRect.top + workspace.scrollTop
      });
      zoom = next.zoom;
      render();
      workspace.scrollLeft = next.scrollLeft;
      workspace.scrollTop = next.scrollTop;
    };

    const fitCanvas = () => {
      const contentBounds = annotationOutputBounds(state);
      const horizontal = Math.max(1, workspace.clientWidth - 40) / contentBounds.width;
      const vertical = Math.max(1, workspace.clientHeight - 40) / contentBounds.height;
      zoom = clampNumber(Math.min(horizontal, vertical), minimumZoom, maximumZoom);
      render();
      const workspaceRect = workspace.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const canvasOffsetX = canvasRect.left - workspaceRect.left + workspace.scrollLeft;
      const canvasOffsetY = canvasRect.top - workspaceRect.top + workspace.scrollTop;
      workspace.scrollLeft = canvasOffsetX
        + ((contentBounds.x + (contentBounds.width / 2) - workspaceBounds.x) * zoom)
        - (workspace.clientWidth / 2);
      workspace.scrollTop = canvasOffsetY
        + ((contentBounds.y + (contentBounds.height / 2) - workspaceBounds.y) * zoom)
        - (workspace.clientHeight / 2);
      lastZoomPoint = { x: workspace.clientWidth / 2, y: workspace.clientHeight / 2 };
    };

    const renderTemplateList = () => {
      if (!templateList) return;
      if (!templateLibrary.templates.length) {
        templateList.innerHTML = `<p class="image-annotation-template-empty">No saved templates yet.</p>`;
        return;
      }
      templateList.innerHTML = templateLibrary.templates
        .map((template, index) => annotationTemplateCardHtml(template, index, templateLibrary.templates.length))
        .join("");
    };

    const persistTemplateLibrary = async (nextLibrary, successMessage) => {
      if (templateBusy) return false;
      if (!templateLibraryAvailable) {
        const message = "Template storage is unavailable. Your canvas was not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }
      templateBusy = true;
      if (templateStatus) templateStatus.textContent = "Saving templates...";
      syncControls();
      try {
        const normalized = normalizeAnnotationTemplateLibrary(nextLibrary);
        const saved = await context.saveTemplateLibrary(normalized);
        templateLibrary = normalizeAnnotationTemplateLibrary(saved || normalized);
        renderTemplateList();
        if (templateStatus) templateStatus.textContent = successMessage;
        setStatus(successMessage);
        return true;
      } catch (error) {
        const message = error?.message || "The template library could not be saved. Your canvas was not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      } finally {
        templateBusy = false;
        syncControls();
      }
    };

    const restoreDefaultTemplates = async () => {
      if (templateBusy) return false;
      if (!templateLibraryAvailable || !defaultTemplateLibraryAvailable) {
        const message = "Default template storage is unavailable. Your templates were not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }

      templateBusy = true;
      if (templateStatus) templateStatus.textContent = "Checking default templates...";
      syncControls();
      try {
        const defaults = await context.loadDefaultTemplateLibrary();
        const restored = restoreAnnotationDefaultTemplates(templateLibrary, defaults);
        if (restored.capacityExceeded) {
          const message = `Restore needs ${restored.requiredSlots} more template slot${restored.requiredSlots === 1 ? "" : "s"}. Delete that many templates and try again.`;
          if (templateStatus) templateStatus.textContent = message;
          setStatus(message);
          return false;
        }
        if (!restored.addedCount) {
          const message = "All default templates are already in your library.";
          if (templateStatus) templateStatus.textContent = message;
          setStatus(message);
          return true;
        }

        const saved = await context.saveTemplateLibrary(restored.library);
        templateLibrary = normalizeAnnotationTemplateLibrary(saved || restored.library);
        renderTemplateList();
        const message = `${restored.addedCount} default template${restored.addedCount === 1 ? "" : "s"} restored at the top of your library.`;
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return true;
      } catch (error) {
        const message = error?.message || "The default templates could not be restored. Your templates were not changed.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      } finally {
        templateBusy = false;
        syncControls();
      }
    };

    const askTemplateName = async (title, currentName) => {
      const value = typeof context.askForText === "function"
        ? await context.askForText("Template name", title, currentName)
        : window.prompt("Template name", currentName);
      return String(value || "").trim().slice(0, 120);
    };

    const saveSelectionAsTemplate = async () => {
      if (!selectedIds.size) return;
      if (templateLibrary.templates.length >= maximumAnnotationTemplates) {
        const message = `You can save up to ${maximumAnnotationTemplates} annotation templates.`;
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return;
      }
      const name = await askTemplateName("Save Annotation Template", `Template ${templateLibrary.templates.length + 1}`);
      if (!name) return;
      const template = captureAnnotationTemplate(state, selectedIds, context.originalDataUrl, name);
      if (!template) {
        setStatus("Select one or more canvas objects to create a template.");
        return;
      }
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: [...templateLibrary.templates, template]
      }, `Template “${name}” saved for your PMT account.`);
    };

    const replaceTemplateFromSelection = async templateId => {
      if (!selectedIds.size) {
        setStatus("Select the canvas objects that should replace this template.");
        return;
      }
      const existing = templateLibrary.templates.find(template => template.id === templateId);
      if (!existing) return;
      const replacement = captureAnnotationTemplate(state, selectedIds, context.originalDataUrl, existing.name);
      if (!replacement) return;
      replacement.id = existing.id;
      replacement.createdAt = existing.createdAt;
      replacement.updatedAt = new Date().toISOString();
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: templateLibrary.templates.map(template => template.id === templateId ? replacement : template)
      }, `Template “${existing.name}” updated from the current selection.`);
    };

    const renameTemplate = async templateId => {
      const existing = templateLibrary.templates.find(template => template.id === templateId);
      if (!existing) return;
      const name = await askTemplateName("Rename Annotation Template", existing.name);
      if (!name || name === existing.name) return;
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: templateLibrary.templates.map(template => template.id === templateId
          ? { ...template, name, updatedAt: new Date().toISOString() }
          : template)
      }, `Template renamed to “${name}”.`);
    };

    const deleteTemplate = async templateId => {
      const existing = templateLibrary.templates.find(template => template.id === templateId);
      if (!existing) return;
      const confirmed = typeof context.confirm === "function"
        ? await context.confirm(`Delete the “${existing.name}” annotation template?`, "Delete Annotation Template", "Delete")
        : window.confirm(`Delete the “${existing.name}” annotation template?`);
      if (!confirmed) return;
      await persistTemplateLibrary({
        ...templateLibrary,
        templates: templateLibrary.templates.filter(template => template.id !== templateId)
      }, `Template “${existing.name}” deleted.`);
    };

    const moveTemplate = async (templateId, direction) => {
      const index = templateLibrary.templates.findIndex(template => template.id === templateId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= templateLibrary.templates.length) return;
      const templates = [...templateLibrary.templates];
      [templates[index], templates[nextIndex]] = [templates[nextIndex], templates[index]];
      await persistTemplateLibrary({ ...templateLibrary, templates }, "Template order saved.");
    };

    const setDrawingDefault = async type => {
      const object = selectedObjects()[0];
      if (selectedIds.size !== 1 || object?.type !== type || object.locked) return;
      const drawingDefault = annotationDrawingDefaultFromObject(object);
      await persistTemplateLibrary({
        ...templateLibrary,
        defaults: { ...templateLibrary.defaults, [type]: drawingDefault }
      }, `${type === "arrow" ? "Arrow" : "Rectangle"} is now the default style for new drawings.`);
    };

    const resetDrawingDefault = async type => {
      await persistTemplateLibrary({
        ...templateLibrary,
        defaults: { ...templateLibrary.defaults, [type]: null }
      }, `${type === "arrow" ? "Arrow" : "Rectangle"} drawing style reset to the PMT default.`);
    };

    const templateInsertionCenter = () => {
      const rect = workspace.getBoundingClientRect();
      return canvasPoint({
        clientX: rect.left + (workspace.clientWidth / 2),
        clientY: rect.top + (workspace.clientHeight / 2)
      });
    };

    const insertTemplate = (template, center = templateInsertionCenter()) => {
      pushHistory();
      const normalizedTemplate = normalizeAnnotationTemplate(template);
      if (!normalizedTemplate) return [];
      const insertionGroupId = normalizedTemplate.objects.length > 1 || normalizedTemplate.grouped
        ? `group-${Date.now().toString(36)}-${++groupSequence}`
        : "";
      const objects = instantiateAnnotationTemplate(
        normalizedTemplate,
        center,
        type => `${type}-${Date.now().toString(36)}-${++objectSequence}`,
        insertionGroupId
      );
      if (!objects.length) return [];
      state.objects.push(...objects);
      if (insertionGroupId && normalizedTemplate.groupName) {
        state.groupNames[insertionGroupId] = normalizedTemplate.groupName;
      }
      selectedIds = new Set(objects.map(object => object.id));
      lastSelectedObjectId = objects.at(-1)?.id || "";
      setTool("select");
      pushHistory();
      renderWithWorkspaceExpansion();
      window.setTimeout(focusLastSelectedObject, 0);
      return objects;
    };

    const useTemplate = async template => {
      const selection = selectedObjects();
      if (!selection.length) {
        const objects = insertTemplate(template);
        if (objects.length) setStatus(`Template "${template.name}" added to the canvas.`);
        return objects.length > 0;
      }

      const plan = annotationTemplateFormattingPlan(template, selection);
      if (plan.matches.length && !plan.editableMatchCount) {
        const message = "Unlock the selected objects before applying template formatting.";
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }
      if (!plan.structureMatches) {
        const message = `The selected objects do not have the same structure as the "${template.name}" template. Applying it may not produce the same result. PMT will match objects by type and apply the formatting it can without changing text or geometry.`;
        const confirmed = typeof context.confirm === "function"
          ? await context.confirm(message, "Apply Template Formatting", "Apply Formatting")
          : window.confirm(message);
        if (!confirmed) {
          const canceledMessage = "Template formatting was not applied.";
          if (templateStatus) templateStatus.textContent = canceledMessage;
          setStatus(canceledMessage);
          return false;
        }
      }

      pushHistory();
      const result = applyAnnotationTemplateFormatting(template, selection);
      if (!result.appliedCount) {
        const message = `Template "${template.name}" has no formatting compatible with the selected objects.`;
        if (templateStatus) templateStatus.textContent = message;
        setStatus(message);
        return false;
      }

      if (result.changedCount) {
        setTool("select");
        pushHistory();
        renderWithWorkspaceExpansion();
        window.setTimeout(focusLastSelectedObject, 0);
      }
      const changedMessage = result.changedCount
        ? `Template "${template.name}" formatting applied to ${result.appliedCount} selected object${result.appliedCount === 1 ? "" : "s"}.`
        : `The selected objects already use the formatting from template "${template.name}".`;
      const lockedMessage = result.lockedCount
        ? ` ${result.lockedCount} locked object${result.lockedCount === 1 ? " was" : "s were"} left unchanged.`
        : "";
      const constrainedMessage = result.geometryConstrainedCount
        ? " Some arrow formatting was limited to preserve the destination geometry."
        : "";
      const message = `${changedMessage}${lockedMessage}${constrainedMessage}`;
      if (templateStatus) templateStatus.textContent = message;
      setStatus(message);
      return result.changedCount > 0;
    };

    const copyNativeSelection = () => {
      if (!selectedIds.size) return false;
      const template = captureAnnotationTemplate(state, selectedIds, context.originalDataUrl, "Clipboard");
      const bounds = annotationSelectionVisualBounds(selectedObjects(), state.imageClip);
      if (!template || !bounds) return false;
      nativeClipboard = {
        template,
        center: { x: bounds.x + (bounds.width / 2), y: bounds.y + (bounds.height / 2) }
      };
      pasteSequence = 0;
      setStatus(`${template.objects.length} object${template.objects.length === 1 ? "" : "s"} copied. Press Ctrl+V to paste.`);
      syncControls();
      return true;
    };

    const pasteNativeSelection = () => {
      if (!nativeClipboard) {
        setStatus("Copy canvas objects with Ctrl+C before pasting.");
        return false;
      }
      pasteSequence += 1;
      const distance = state.gridVisible ? state.gridSize : 10;
      const objects = insertTemplate(nativeClipboard.template, {
        x: nativeClipboard.center.x + (distance * pasteSequence),
        y: nativeClipboard.center.y + (distance * pasteSequence)
      });
      if (objects.length) setStatus(`${objects.length} object${objects.length === 1 ? "" : "s"} pasted.`);
      return objects.length > 0;
    };

    const duplicateSelection = () => {
      if (!selectedIds.size) return false;
      const template = captureAnnotationTemplate(state, selectedIds, context.originalDataUrl, "Duplicate");
      const bounds = annotationSelectionVisualBounds(selectedObjects(), state.imageClip);
      if (!template || !bounds) return false;
      const distance = state.gridVisible ? state.gridSize : 10;
      const objects = insertTemplate(template, {
        x: bounds.x + (bounds.width / 2) + distance,
        y: bounds.y + (bounds.height / 2) + distance
      });
      if (!objects.length) return false;
      const message = `${objects.length === 1 ? "Item" : "Items"} duplicated.`;
      setStatus(message);
      context.notify?.(message);
      return true;
    };

    const treeNodeIds = (kind, id) => {
      if (kind === "group") {
        return state.objects.filter(object => object.groupId === id).map(object => object.id);
      }
      return state.objects.some(object => object.id === id) ? [id] : [];
    };

    const resolveSelectedTreeTarget = () => {
      if (lastTreeSelectionKey) {
        const [kind, ...idParts] = lastTreeSelectionKey.split(":");
        const id = idParts.join(":");
        const ids = treeNodeIds(kind, id);
        if (ids.length === selectedIds.size && ids.every(objectId => selectedIds.has(objectId))) return { kind, id, ids };
      }
      if (selectedIds.size === 1) {
        const id = [...selectedIds][0];
        return state.objects.some(object => object.id === id) ? { kind: "object", id, ids: [id] } : null;
      }
      const matchingGroup = buildAnnotationObjectTree(state)
        .filter(node => node.kind === "group")
        .find(node => node.children.length === selectedIds.size
          && node.children.every(child => selectedIds.has(child.id)));
      return matchingGroup
        ? { kind: "group", id: matchingGroup.id, ids: matchingGroup.children.map(child => child.id) }
        : null;
    };

    const treeTargetCanMoveToRoot = target => {
      if (!target?.ids?.length) return false;
      if (target.ids.some(id => state.objects.find(object => object.id === id)?.type === "image")) return false;
      const nextState = reorderAnnotationObjectTree(state, {
        draggedKind: target.kind,
        draggedId: target.id,
        targetKind: "root"
      });
      return annotationSnapshot(nextState, embeddedSources) !== annotationSnapshot(state, embeddedSources);
    };

    const setRootMoveNoopStatus = target => {
      if (target?.ids?.some(id => state.objects.find(object => object.id === id)?.type === "image")) {
        setStatus("The original image is protected as the bottom canvas layer and cannot move to the root top.");
        return;
      }
      setStatus(target ? "That object or group is already at the top of the root." : "Select one object or one group before moving it to the root.");
    };

    const focusTreeNode = (kind, id) => {
      const row = [...objectTree.querySelectorAll("[data-annotation-tree-node]")]
        .find(element => element.dataset.annotationTreeKind === kind && element.dataset.annotationTreeId === id);
      row?.focus({ preventScroll: true });
    };

    const selectTreeNode = (kind, id, event = {}) => {
      const ids = treeNodeIds(kind, id);
      if (!ids.length) return;
      const key = `${kind}:${id}`;
      const additive = event.ctrlKey || event.metaKey;
      if (event.shiftKey && treeRangeAnchorKey) {
        const rows = [...objectTree.querySelectorAll("[data-annotation-tree-node]")];
        const keys = rows.map(row => `${row.dataset.annotationTreeKind}:${row.dataset.annotationTreeId}`);
        const anchorIndex = keys.indexOf(treeRangeAnchorKey);
        const targetIndex = keys.indexOf(key);
        if (!additive) selectedIds.clear();
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          rows.slice(start, end + 1).forEach(row => {
            treeNodeIds(row.dataset.annotationTreeKind, row.dataset.annotationTreeId)
              .forEach(objectId => selectedIds.add(objectId));
          });
        } else {
          ids.forEach(objectId => selectedIds.add(objectId));
        }
      } else if (additive) {
        const remove = ids.every(objectId => selectedIds.has(objectId));
        ids.forEach(objectId => remove ? selectedIds.delete(objectId) : selectedIds.add(objectId));
        treeRangeAnchorKey = key;
      } else {
        selectedIds = new Set(ids);
        treeRangeAnchorKey = key;
      }
      lastTreeSelectionKey = key;
      lastSelectedObjectId = ids.find(objectId => selectedIds.has(objectId)) || [...selectedIds].at(-1) || "";
      setTool("select");
      setStatus(selectedIds.size
        ? `${selectedIds.size} object${selectedIds.size === 1 ? "" : "s"} selected from the object tree.`
        : "Selection cleared.");
      render();
      window.setTimeout(() => focusTreeNode(kind, id), 0);
    };

    const renameTreeNode = async (kind, id) => {
      const current = kind === "group"
        ? state.groupNames[id] || buildAnnotationObjectTree(state).find(node => node.kind === "group" && node.id === id)?.name || "Group"
        : state.objects.find(object => object.id === id)?.name || annotationObjectLabel(state.objects.find(object => object.id === id));
      if (!current) return;
      const name = safeAnnotationName(typeof context.askForText === "function"
        ? await context.askForText("Name", kind === "group" ? "Rename Object Group" : "Rename Canvas Object", current)
        : window.prompt(kind === "group" ? "Group name" : "Object name", current));
      if (!name) return;
      pushHistory();
      if (kind === "group") {
        if (!state.objects.some(object => object.groupId === id)) return;
        state.groupNames[id] = name;
      } else {
        const object = state.objects.find(item => item.id === id);
        if (!object) return;
        object.name = name;
      }
      pushHistory();
      setStatus(`${kind === "group" ? "Group" : "Object"} renamed to “${name}”.`);
      render();
      window.setTimeout(() => focusTreeNode(kind, id), 0);
    };

    const deleteTreeSelection = () => {
      const removable = new Set(selectedObjects()
        .filter(object => object.type !== "image" && !object.locked)
        .map(object => object.id));
      if (!removable.size) {
        setStatus("The original image cannot be deleted. Unlock other objects before deleting them.");
        return false;
      }
      pushHistory();
      state.objects = state.objects.filter(object => !removable.has(object.id));
      removable.forEach(id => selectedIds.delete(id));
      pruneAnnotationGroupNames(state);
      pushHistory();
      lastTreeSelectionKey = "";
      treeRangeAnchorKey = "";
      setStatus(`${removable.size} object${removable.size === 1 ? "" : "s"} deleted from the object tree.`);
      renderWithWorkspaceExpansion();
      objectTree.focus({ preventScroll: true });
      return true;
    };

    const moveTreeNode = (dragged, targetKind, targetId = "", targetPlacement = "before") => {
      if (!dragged) return false;
      const draggedObjectIds = treeNodeIds(dragged.kind, dragged.id);
      const before = annotationSnapshot(state, embeddedSources);
      const nextState = reorderAnnotationObjectTree(state, {
        draggedKind: dragged.kind,
        draggedId: dragged.id,
        targetKind,
        targetId,
        targetPlacement
      });
      const after = annotationSnapshot(nextState, embeddedSources);
      if (before === after) return false;
      pushHistory();
      state = nextState;
      const movedObject = state.objects.find(object => draggedObjectIds.includes(object.id));
      const movedIds = dragged.kind === "group" && movedObject?.groupId
        ? annotationSelectionIdsForObject(state.objects, movedObject)
        : draggedObjectIds.filter(id => state.objects.some(object => object.id === id));
      selectedIds = new Set(movedIds);
      lastSelectedObjectId = [...selectedIds].at(-1) || "";
      lastTreeSelectionKey = dragged.kind === "group" && movedObject?.groupId
        ? `group:${movedObject.groupId}`
        : `${dragged.kind}:${dragged.id}`;
      pushHistory();
      setStatus(targetKind === "root"
        ? "Object moved to the top of the root. Canvas z-order updated."
        : targetKind === "group" && targetPlacement === "inside"
          ? "Object moved to the top of the selected group. Canvas z-order updated."
          : `Object moved directly ${targetPlacement === "after" ? "below" : "above"} the target. Canvas z-order updated.`);
      render();
      return true;
    };

    const copyAnnotationSelection = async format => {
      if (copying) {
        setStatus("Wait for the current clipboard copy to finish.");
        return;
      }
      const copiedObjects = selectedObjects();
      const selectionExport = annotationSelectionClipboardExport(
        state,
        selectedIds,
        context.originalDataUrl
      );
      if (!copiedObjects.length || !selectionExport.svg) {
        setStatus("Select an object to copy.");
        return;
      }

      copying = true;
      setStatus(format === "image" ? "Copying the selection as an image..." : "Copying the selection as SVG...");
      try {
        if (format === "image") await copyAnnotationPngToClipboard(selectionExport);
        else await copyAnnotationSvgToClipboard(selectionExport.svg);
        const objectLabel = copiedObjects.length === 1 ? "object" : `${copiedObjects.length} objects`;
        setStatus(`${objectLabel[0].toUpperCase()}${objectLabel.slice(1)} copied as ${format === "image" ? "an image" : "SVG"}.`);
      } catch (error) {
        setStatus(error?.message || `The selection could not be copied as ${format === "image" ? "an image" : "SVG"}.`);
      } finally {
        copying = false;
        focusLastSelectedObject();
      }
    };

    dialog.addEventListener("click", async event => {
      const inspectorTab = event.target.closest("[data-annotation-inspector-tab]");
      if (inspectorTab) {
        setInspectorTab(inspectorTab.dataset.annotationInspectorTab);
        return;
      }

      const treeNodeAction = event.target.closest("[data-annotation-tree-node-action]");
      if (treeNodeAction) {
        const row = treeNodeAction.closest("[data-annotation-tree-node]");
        const kind = row?.dataset.annotationTreeKind;
        const id = row?.dataset.annotationTreeId;
        if (!kind || !id) return;
        selectTreeNode(kind, id);
        if (treeNodeAction.dataset.annotationTreeNodeAction === "rename") await renameTreeNode(kind, id);
        else if (treeNodeAction.dataset.annotationTreeNodeAction === "delete") deleteTreeSelection();
        return;
      }

      const treeAction = event.target.closest("[data-annotation-tree-action]");
      if (treeAction) {
        const action = treeAction.dataset.annotationTreeAction;
        if (action === "rename") {
          const target = resolveSelectedTreeTarget();
          if (target) await renameTreeNode(target.kind, target.id);
        } else if (action === "copy") copyNativeSelection();
        else if (action === "paste") pasteNativeSelection();
        else if (action === "delete") deleteTreeSelection();
        return;
      }

      if (event.target.closest("[data-annotation-tree-root-drop]")) {
        const target = resolveSelectedTreeTarget();
        if (!target || !moveTreeNode({ kind: target.kind, id: target.id }, "root")) {
          setRootMoveNoopStatus(target);
        }
        return;
      }

      const treeRow = event.target.closest("[data-annotation-tree-node]");
      if (treeRow) {
        selectTreeNode(
          treeRow.dataset.annotationTreeKind,
          treeRow.dataset.annotationTreeId,
          event
        );
        return;
      }

      if (event.target.closest("[data-annotation-toggle-inspector]")) {
        setInspectorVisible(!inspectorVisible);
        return;
      }

      if (event.target.closest("[data-annotation-maximize]")) {
        setMaximized(true);
        return;
      }

      if (event.target.closest("[data-annotation-restore]")) {
        setMaximized(false);
        return;
      }

      if (event.target.closest("[data-annotation-template-save]")) {
        await saveSelectionAsTemplate();
        return;
      }

      const drawingDefaultButton = event.target.closest("[data-annotation-template-default]");
      if (drawingDefaultButton) {
        await setDrawingDefault(drawingDefaultButton.dataset.annotationTemplateDefault);
        return;
      }

      const resetDefaultButton = event.target.closest("[data-annotation-template-reset-default]");
      if (resetDefaultButton) {
        await resetDrawingDefault(resetDefaultButton.dataset.annotationTemplateResetDefault);
        return;
      }

      const templateActionButton = event.target.closest("[data-annotation-template-action]");
      if (templateActionButton) {
        const action = templateActionButton.dataset.annotationTemplateAction;
        if (action === "restore-defaults") {
          await restoreDefaultTemplates();
          return;
        }
        const templateId = templateActionButton.dataset.annotationTemplateId || "";
        const template = templateLibrary.templates.find(item => item.id === templateId);
        if (action === "create" && template) await useTemplate(template);
        else if (action === "rename") await renameTemplate(templateId);
        else if (action === "replace") await replaceTemplateFromSelection(templateId);
        else if (action === "delete") await deleteTemplate(templateId);
        else if (action === "up") await moveTemplate(templateId, -1);
        else if (action === "down") await moveTemplate(templateId, 1);
        return;
      }

      const contextTool = event.target.closest("[data-annotation-context-tool]");
      if (contextTool) {
        closeAnnotationContextMenu();
        setTool(contextTool.dataset.annotationContextTool);
        workspace.focus({ preventScroll: true });
        return;
      }

      const tool = event.target.closest("button[data-annotation-tool]");
      if (tool) {
        closeAnnotationContextMenu();
        setTool(tool.dataset.annotationTool);
        return;
      }

      const actionButton = event.target.closest("[data-annotation-action]");
      if (actionButton) {
        const contextAction = contextMenu.contains(actionButton);
        if (contextAction) closeAnnotationContextMenu();
        const action = actionButton.dataset.annotationAction;
        if (["copy-svg", "copy-image"].includes(action)) {
          await copyAnnotationSelection(action === "copy-image" ? "image" : "svg");
          return;
        }
        handleAnnotationAction(action, {
          state,
          selectedIds,
          selectedObjects,
          setStatus,
          pushHistory,
          restoreHistory,
          historyIndex: () => historyIndex,
          historyLength: () => history.length,
          nextGroupId: () => `group-${Date.now().toString(36)}-${++groupSequence}`
        });
        renderWithWorkspaceExpansion();
        if (contextAction) {
          if (selectedIds.size) focusLastSelectedObject();
          else workspace.focus({ preventScroll: true });
        }
        return;
      }

      const zoomAction = event.target.closest("[data-annotation-zoom]")?.dataset.annotationZoom;
      const zoomPoint = lastZoomPoint || { x: workspace.clientWidth / 2, y: workspace.clientHeight / 2 };
      if (zoomAction === "in") setZoom(zoom * 1.1, zoomPoint.x, zoomPoint.y);
      else if (zoomAction === "out") setZoom(zoom * 0.9, zoomPoint.x, zoomPoint.y);
      else if (zoomAction === "fit") fitCanvas();
    });

    dialog.addEventListener("pointerdown", event => {
      if (!contextMenu.hidden && !contextMenu.contains(event.target)) closeAnnotationContextMenu();
    });
    const clearTreeDropStyles = () => {
      dialog.querySelectorAll(".is-drop-target, .reorder-before, .reorder-after").forEach(element => {
        element.classList.remove("is-drop-target", "reorder-before", "reorder-after");
      });
    };
    const clearTreeDragStyles = () => {
      clearTreeDropStyles();
      dialog.querySelectorAll(".is-dragging").forEach(element => element.classList.remove("is-dragging"));
    };
    const treeDropPlacement = (target, clientY) => {
      if (target.dataset.annotationTreeKind === "object"
        && state.objects.find(object => object.id === target.dataset.annotationTreeId)?.type === "image") {
        return "before";
      }
      const bounds = target.getBoundingClientRect();
      return clientY > bounds.top + (bounds.height / 2) ? "after" : "before";
    };
    dialog.addEventListener("dragstart", event => {
      const row = event.target.closest?.("[data-annotation-tree-node]");
      if (!row || row.getAttribute("draggable") !== "true") {
        event.preventDefault();
        return;
      }
      draggedTreeNode = {
        kind: row.dataset.annotationTreeKind,
        id: row.dataset.annotationTreeId
      };
      row.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${draggedTreeNode.kind}:${draggedTreeNode.id}`);
      }
    });
    dialog.addEventListener("dragover", event => {
      if (!draggedTreeNode) return;
      clearTreeDropStyles();
      const target = event.target.closest?.("[data-annotation-tree-node], [data-annotation-tree-root-drop]");
      if (!target) return;
      event.preventDefault();
      const placement = target.matches("[data-annotation-tree-root-drop]")
        ? "after"
        : treeDropPlacement(target, event.clientY);
      target.classList.add(`reorder-${placement}`);
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    dialog.addEventListener("drop", event => {
      if (!draggedTreeNode) return;
      const target = event.target.closest?.("[data-annotation-tree-node], [data-annotation-tree-root-drop]");
      if (!target) return;
      event.preventDefault();
      const dragged = draggedTreeNode;
      draggedTreeNode = null;
      clearTreeDragStyles();
      if (target.matches("[data-annotation-tree-root-drop]")) {
        if (!moveTreeNode(dragged, "root")) {
          setRootMoveNoopStatus({ ...dragged, ids: treeNodeIds(dragged.kind, dragged.id) });
        }
        return;
      }
      const placement = treeDropPlacement(target, event.clientY);
      moveTreeNode(
        dragged,
        target.dataset.annotationTreeKind,
        target.dataset.annotationTreeId,
        target.dataset.annotationTreeKind === "group" && placement === "after" ? "inside" : placement
      );
    });
    dialog.addEventListener("dragend", () => {
      draggedTreeNode = null;
      clearTreeDragStyles();
    });
    dialog.addEventListener("dragleave", event => {
      if (!dialog.contains(event.relatedTarget)) clearTreeDropStyles();
    });
    contextMenu.addEventListener("contextmenu", event => event.preventDefault());
    window.addEventListener("resize", closeAnnotationContextMenu);

    dialog.querySelector("[data-annotation-grid]").addEventListener("change", event => {
      const restoreSelectionFocus = selectedIds.size > 0;
      state.gridVisible = event.target.checked;
      pushHistory();
      render();
      if (restoreSelectionFocus) focusLastSelectedObject();
    });
    dialog.querySelector("[data-annotation-snap]").addEventListener("change", event => {
      const restoreSelectionFocus = selectedIds.size > 0;
      state.snapToGrid = event.target.checked;
      pushHistory();
      render();
      if (restoreSelectionFocus) focusLastSelectedObject();
    });
    objectTreeSearch?.addEventListener("input", event => {
      objectTreeSearchQuery = event.target.value;
      renderObjectTree();
    });
    dialog.querySelector("[data-annotation-outline]").addEventListener("change", event => {
      const visible = event.target.checked;
      event.target.indeterminate = false;
      styles.outlineVisible = visible;
      selectedObjects().forEach(object => {
        if (["rectangle", "textbox"].includes(object.type) && !object.locked) {
          object.outlineVisible = visible;
        }
      });
      pushHistory();
      renderWithWorkspaceExpansion();
    });
    dialog.querySelector("[data-annotation-transparent-fill]").addEventListener("change", event => {
      selectedObjects().forEach(object => {
        if (["rectangle", "textbox"].includes(object.type) && !object.locked) {
          object.fill = event.target.checked ? "none" : styles.fill;
        }
      });
      pushHistory();
      render();
    });
    dialog.querySelectorAll("[data-annotation-style]").forEach(control => {
      control.addEventListener("input", () => {
        applyAnnotationStyle(control.dataset.annotationStyle, control.value, selectedObjects(), styles);
        scheduleHistory();
        renderWithWorkspaceExpansion();
      });
      control.addEventListener("change", pushHistory);
    });
    bindAnnotationColorPickers(dialog, {
      apply(name, color) {
        applyAnnotationStyle(name, color, selectedObjects(), styles);
        pushHistory();
        renderWithWorkspaceExpansion();
      },
      askForColor: context.askForColor,
      setStatus
    });
    textInput.addEventListener("input", () => {
      const object = selectedObjects()[0];
      if (selectedIds.size === 1 && object?.type === "textbox" && !object.locked) {
        object.text = textInput.value;
        scheduleHistory();
        render();
      }
    });
    textInput.addEventListener("change", pushHistory);

    const cancelButtons = [...dialog.querySelectorAll("[data-annotation-cancel]")];
    cancelButtons.forEach(button => {
      button.addEventListener("click", () => finish(null));
    });
    const applyButtons = [...dialog.querySelectorAll("[data-annotation-apply]")];
    const setApplyingUi = value => {
      applying = value === true;
      applyButtons.forEach(button => { button.disabled = applying; });
      cancelButtons.forEach(button => { button.disabled = applying; });
      maximizeButton.disabled = applying;
      restoreButton.disabled = applying;
      toolbar.inert = applying;
      main.inert = applying;
      if (applying) closeAnnotationContextMenu();
    };
    const applyAnnotation = async event => {
      if (applying) return;
      const applyButton = event.currentTarget;
      pushHistory();
      const finalState = normalizeAnnotationState(state, {
        width: state.width,
        height: state.height,
        originalReference: context.originalReference
      });
      const result = {
        state: finalState,
        svg: buildAnnotationSvg(finalState, context.originalDataUrl),
        originalReference: context.originalReference,
        fileName: annotationFileName(context.originalFileName)
      };
      setApplyingUi(true);
      setStatus("Applying the annotation...");
      try {
        if (typeof context.apply === "function") await context.apply(result);
        finish(result);
      } catch (error) {
        setApplyingUi(false);
        setStatus(error?.message || "The annotation could not be applied. Your edits are still open.");
        applyButton?.focus({ preventScroll: true });
      }
    };
    applyButtons.forEach(button => button.addEventListener("click", applyAnnotation));
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      if (applying) {
        setStatus("Wait for the annotation upload to finish.");
        return;
      }
      finish(null);
    });
    dialog.addEventListener("keydown", event => {
      if (applying) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setStatus("Wait for the annotation upload to finish.");
        }
        return;
      }

      const inspectorTab = event.target.closest?.("[data-annotation-inspector-tab]");
      if (inspectorTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        const tabs = [...dialog.querySelectorAll("[data-annotation-inspector-tab]")];
        const currentIndex = Math.max(0, tabs.indexOf(inspectorTab));
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        setInspectorTab(tabs[nextIndex].dataset.annotationInspectorTab);
        tabs[nextIndex].focus({ preventScroll: true });
        return;
      }

      const treeRow = event.target.closest?.("[data-annotation-tree-node]");
      if (treeRow && event.target === treeRow) {
        const rows = [...objectTree.querySelectorAll("[data-annotation-tree-node]")];
        const currentIndex = rows.indexOf(treeRow);
        if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
          const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
              ? rows.length - 1
              : Math.max(0, Math.min(rows.length - 1, currentIndex + (event.key === "ArrowDown" ? 1 : -1)));
          event.preventDefault();
          rows[nextIndex]?.focus({ preventScroll: true });
          return;
        }
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          selectTreeNode(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId, event);
          return;
        }
        if (event.key === "F2") {
          event.preventDefault();
          renameTreeNode(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId);
          return;
        }
        if (["Delete", "Backspace"].includes(event.key)) {
          event.preventDefault();
          if (!treeNodeIds(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId)
            .some(id => selectedIds.has(id))) {
            selectTreeNode(treeRow.dataset.annotationTreeKind, treeRow.dataset.annotationTreeId);
          }
          deleteTreeSelection();
          return;
        }
      }

      if (!contextMenu.hidden) {
        if (event.key === "Tab") {
          event.preventDefault();
          closeAnnotationContextMenu();
          return;
        }
        const menuItems = [...contextMenu.querySelectorAll("button:not(:disabled)")];
        const currentIndex = menuItems.indexOf(document.activeElement);
        let nextIndex = -1;
        if (event.key === "ArrowDown") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItems.length;
        else if (event.key === "ArrowUp") nextIndex = currentIndex < 0 ? menuItems.length - 1 : (currentIndex - 1 + menuItems.length) % menuItems.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = menuItems.length - 1;
        if (nextIndex >= 0 && menuItems.length) {
          event.preventDefault();
          event.stopPropagation();
          menuItems[nextIndex].focus({ preventScroll: true });
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeAnnotationContextMenu();
          return;
        }
      }

      const requestsContextMenu = event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
      const formControl = event.target.closest?.("input, textarea, select, button");
      if (requestsContextMenu && selectedIds.size && !formControl) {
        const selectedId = selectedIds.has(lastSelectedObjectId)
          ? lastSelectedObjectId
          : [...selectedIds].at(-1);
        const selectedElement = selectedId
          ? [...canvas.querySelectorAll("[data-annotation-object-id]")]
              .find(element => element.dataset.annotationObjectId === selectedId)
          : null;
        if (selectedElement) {
          const bounds = selectedElement.getBoundingClientRect();
          event.preventDefault();
          event.stopPropagation();
          closeAnnotationContextMenu();
          openAnnotationContextMenuAt({
            clientX: Math.min(bounds.right, bounds.left + 32),
            clientY: Math.min(bounds.bottom, bounds.top + 32)
          });
          return;
        }
      }

      handleAnnotationKeyDown(event, {
        state,
        selectedIds,
        selectedObjects,
        setTool,
        setStatus,
        pushHistory,
        restoreHistory,
        historyIndex: () => historyIndex,
        historyLength: () => history.length,
        render: renderWithWorkspaceExpansion,
        copySelection: copyNativeSelection,
        pasteSelection: pasteNativeSelection,
        duplicateSelection,
        focusSelection: focusLastSelectedObject,
        focusWorkspace: () => workspace.focus({ preventScroll: true })
      });
    });

    dialog.showModal();
    workspaceBounds = annotationWorkspaceBounds(state, workspace.clientWidth, workspace.clientHeight);
    setTool("select");
    setInspectorTab("format");
    renderTemplateList();
    if (templateStatus && context.templateLibraryError) templateStatus.textContent = context.templateLibraryError;
    render();
    window.setTimeout(fitCanvas, 0);
  });
}

function annotationDialogHtml() {
  return `
    <div class="image-annotation-window">
      <div class="dialog-head image-annotation-head" data-dialog-drag-ignore>
        <div>
          <h2 id="imageAnnotationTitle">Image Annotation</h2>
          <p>Original image plus editable vector annotations</p>
        </div>
        <div class="image-annotation-head-actions">
          <button type="button" class="icon-btn dialog-maximize-button" data-annotation-maximize title="Maximize" aria-label="Maximize">Maximize</button>
          <button type="button" class="icon-btn" data-annotation-cancel title="Close" aria-label="Close">Close</button>
        </div>
      </div>
      <div class="image-annotation-toolbar" role="toolbar" aria-label="Image annotation tools">
        <div class="image-annotation-tool-group" aria-label="Drawing tools">
          ${annotationToolButton("select", "Select (V)", true)}
          ${annotationToolButton("crop", "Crop (C)")}
          ${annotationToolButton("rectangle", "Rectangle (R)")}
          ${annotationToolButton("arrow", "Arrow (A)")}
          ${annotationToolButton("textbox", "Text Box (T)")}
        </div>
        <div class="image-annotation-tool-group" aria-label="History">
          ${annotationActionButton("undo", "Undo", "Undo (Ctrl+Z)")}
          ${annotationActionButton("redo", "Redo", "Redo (Ctrl+Y)")}
          ${annotationActionButton("delete", "Delete", "Delete selected annotations", true)}
        </div>
        <div class="image-annotation-tool-group image-annotation-view-tools" aria-label="Canvas view">
          <label class="inline-check"><input type="checkbox" data-annotation-grid checked><span>Grid</span></label>
          <label class="inline-check"><input type="checkbox" data-annotation-snap checked><span>Snap</span></label>
          <button type="button" data-annotation-zoom="out" title="Zoom Out" aria-label="Zoom Out">-</button>
          <span data-annotation-zoom-label class="image-annotation-zoom-label">100%</span>
          <button type="button" data-annotation-zoom="in" title="Zoom In" aria-label="Zoom In">+</button>
          <button type="button" data-annotation-zoom="fit">Fit</button>
          <button type="button" data-annotation-toggle-inspector aria-controls="imageAnnotationInspector" aria-expanded="true" title="Hide Right Pane" aria-label="Hide Right Pane">Hide Right Pane</button>
        </div>
        <div class="image-annotation-tool-group image-annotation-maximized-actions" data-annotation-maximized-actions hidden aria-label="Dialog actions">
          <span class="image-annotation-maximized-status" data-annotation-maximized-status role="status" aria-live="polite"></span>
          <button type="button" class="secondary text-icon-button" data-annotation-cancel><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
          <button type="button" class="primary text-icon-button" data-annotation-apply><span class="button-icon" aria-hidden="true">&#10003;</span><span>Apply to RTE</span></button>
        </div>
      </div>
      <div class="image-annotation-main" data-annotation-main>
        <div class="image-annotation-workspace" data-annotation-workspace tabindex="0" aria-label="Annotation canvas. Mouse wheel scrolls. Control plus mouse wheel zooms. Middle mouse drag pans.">
          <svg class="image-annotation-canvas" data-annotation-canvas xmlns="${svgNamespace}" role="group" aria-label="Image annotation canvas"></svg>
        </div>
        <aside class="image-annotation-inspector" id="imageAnnotationInspector" data-annotation-inspector aria-label="Annotation right pane">
          <div class="image-annotation-inspector-tabs" role="tablist" aria-label="Annotation right pane">
            <button type="button" id="imageAnnotationFormatTab" role="tab" aria-selected="true" aria-controls="imageAnnotationFormatPanel" data-annotation-inspector-tab="format">Format</button>
            <button type="button" id="imageAnnotationTemplateTab" role="tab" aria-selected="false" aria-controls="imageAnnotationTemplatePanel" tabindex="-1" data-annotation-inspector-tab="template">Template</button>
            <button type="button" id="imageAnnotationObjectsTab" role="tab" aria-selected="false" aria-controls="imageAnnotationObjectsPanel" tabindex="-1" data-annotation-inspector-tab="objects">Objects</button>
          </div>
          <p class="image-annotation-selection-label" data-annotation-selection-label>No selection</p>
          <div id="imageAnnotationFormatPanel" role="tabpanel" aria-labelledby="imageAnnotationFormatTab" data-annotation-inspector-panel="format">
          <section class="image-annotation-format-section" aria-labelledby="imageAnnotationShapeFormat">
            <h4 id="imageAnnotationShapeFormat">Shape</h4>
            <div class="image-annotation-inspector-grid">
              ${annotationColorFieldHtml("fill", "Fill", "Background Color", defaultStyles.fill, "background")}
              ${annotationColorFieldHtml("stroke", "Outline color", "Outline Color", defaultStyles.stroke, "font")}
              <label class="inline-check image-annotation-wide"><input type="checkbox" data-annotation-outline checked><span>Outline</span></label>
              <label class="inline-check image-annotation-wide"><input type="checkbox" data-annotation-transparent-fill><span>Transparent fill</span></label>
              <label class="field image-annotation-wide"><span>Opacity (%)</span><input type="number" min="0" max="100" step="1" value="100" data-annotation-style="opacity"></label>
              <label class="field"><span>Line width</span><input type="number" min="1" max="40" step="1" value="${defaultStyles.strokeWidth}" data-annotation-style="strokeWidth"></label>
              <label class="field"><span>Arrow head</span><input type="number" min="6" max="160" step="2" value="${defaultStyles.arrowSize}" data-annotation-style="arrowSize"></label>
            </div>
          </section>
          <section class="image-annotation-format-section" aria-labelledby="imageAnnotationTextFormat">
            <h4 id="imageAnnotationTextFormat">Text</h4>
            <div class="image-annotation-inspector-grid">
              ${annotationColorFieldHtml("textColor", "Text color", "Font Color", defaultStyles.textColor, "font")}
              <label class="field"><span>Font</span><select data-annotation-style="fontFamily">${annotationFontOptions(defaultStyles.fontFamily)}</select></label>
              <label class="field"><span>Font size</span><input type="number" min="6" max="240" step="1" value="${defaultStyles.fontSize}" data-annotation-style="fontSize"></label>
              <label class="field"><span>Horizontal alignment</span><select aria-label="Horizontal alignment" data-annotation-style="textAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
              <label class="field"><span>Vertical alignment</span><select aria-label="Vertical alignment" data-annotation-style="textVerticalAlign"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select></label>
              <label class="field image-annotation-wide" data-annotation-text-field hidden><span>Text</span><textarea rows="5" data-annotation-text></textarea></label>
            </div>
          </section>
          <div class="image-annotation-help">
            <strong>Canvas controls</strong>
            <span>Wheel: scroll</span>
            <span>Ctrl + wheel: zoom at cursor</span>
            <span>Middle drag: pan</span>
            <span>Shift/Ctrl + click: multi-select</span>
            <span>Shift drag: horizontal only</span>
            <span>Alt drag: vertical only</span>
            <span>Alt + rectangle resize: freeform</span>
            <span>Ctrl + A: select all canvas objects</span>
            <span>Ctrl + C/V/D: copy, paste, duplicate</span>
            <span>Blank-canvas drag: marquee-select</span>
          </div>
          </div>
          <div id="imageAnnotationTemplatePanel" role="tabpanel" aria-labelledby="imageAnnotationTemplateTab" data-annotation-inspector-panel="template" hidden>
            <div class="image-annotation-template-actions">
              <p>With no selection, a template adds new objects. With a selection, it applies formatting only. You can also save personal templates or restore missing shared defaults.</p>
              <button type="button" class="primary" data-annotation-template-save>Save Selection as Template</button>
              <button type="button" data-annotation-template-action="restore-defaults">Restore Default Templates</button>
            </div>
            <section class="image-annotation-format-section" aria-labelledby="imageAnnotationDrawingDefaults">
              <h4 id="imageAnnotationDrawingDefaults">Drawing defaults</h4>
              <div class="image-annotation-template-defaults">
                <button type="button" data-annotation-template-default="arrow">Use Selected Arrow</button>
                <button type="button" data-annotation-template-reset-default="arrow">Reset Arrow</button>
                <button type="button" data-annotation-template-default="rectangle">Use Selected Rectangle</button>
                <button type="button" data-annotation-template-reset-default="rectangle">Reset Rectangle</button>
              </div>
            </section>
            <p class="image-annotation-template-status" data-annotation-template-status role="status" aria-live="polite"></p>
            <div class="image-annotation-template-list" data-annotation-template-list aria-label="Saved annotation templates"></div>
          </div>
          <div id="imageAnnotationObjectsPanel" role="tabpanel" aria-labelledby="imageAnnotationObjectsTab" data-annotation-inspector-panel="objects" hidden>
            <div class="image-annotation-object-tree-actions" role="toolbar" aria-label="Object tree actions">
              <button type="button" data-annotation-tree-action="rename">Rename</button>
              <button type="button" data-annotation-tree-action="copy">Copy</button>
              <button type="button" data-annotation-tree-action="paste">Paste</button>
              <button type="button" data-annotation-tree-action="delete">Delete</button>
            </div>
            <label class="image-annotation-object-tree-search"><span>Search objects</span><input type="search" placeholder="Search objects" aria-label="Search objects" autocomplete="off" data-annotation-object-search data-annotation-object-tree-search data-annotation-tree-search></label>
            <p class="image-annotation-object-tree-help">Top items appear in front. The line shows where a dragged row will land. Drop above a group header to keep it at the root, or below the header to move it into that group.</p>
            <button type="button" class="image-annotation-object-tree-root-drop" data-annotation-tree-root-drop aria-label="Move selected object or group to the top of the root object list">Move to root (top)</button>
            <div class="image-annotation-object-tree" data-annotation-object-tree role="tree" tabindex="0" aria-label="Canvas objects, topmost first"></div>
          </div>
        </aside>
      </div>
      ${annotationContextMenuHtml()}
      <div class="dialog-actions image-annotation-actions">
        <span class="image-annotation-status" data-annotation-status role="status" aria-live="polite"></span>
        <div class="dialog-action-group">
          <button type="button" class="secondary text-icon-button" data-annotation-cancel><span class="button-icon" aria-hidden="true">&#10005;</span><span>Cancel</span></button>
          <button type="button" class="primary text-icon-button" data-annotation-apply><span class="button-icon" aria-hidden="true">&#10003;</span><span>Apply to RTE</span></button>
        </div>
      </div>
      <button type="button" class="image-annotation-restore-button" data-annotation-restore title="Restore" aria-label="Restore" hidden><span class="button-icon" aria-hidden="true"><svg class="button-svg-icon" viewBox="0 0 24 24" focusable="false"><rect x="4" y="7" width="13" height="13" rx="1"></rect><rect x="7" y="4" width="13" height="13" rx="1"></rect></svg></span></button>
    </div>
  `;
}

function annotationToolButton(tool, label, pressed = false) {
  return `<button type="button" data-annotation-tool="${tool}" title="${label}" aria-label="${label}" aria-pressed="${pressed}" class="${pressed ? "is-active" : ""}"><span class="button-icon" aria-hidden="true">${annotationToolIconSvg(tool)}</span></button>`;
}

function annotationColorFieldHtml(name, label, title, selectedColor, icon) {
  return `<div class="image-annotation-color-field"><span>${label}</span><div class="image-annotation-color-controls">${sharedRichColorPickerHtml({ name, title, selectedColor, icon })}<div class="image-annotation-recent-colors" data-annotation-recent-colors="${name}" aria-label="Recent ${label} colors" hidden></div></div></div>`;
}

function annotationObjectTreeHtml(nodes, selectedIds, emptyMessage = "No canvas objects.") {
  if (!nodes.length) return `<p class="image-annotation-object-tree-empty">${escapeXmlText(emptyMessage)}</p>`;
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const row = (node, level) => {
    const object = node.kind === "object" ? node.object : null;
    const groupChildren = node.kind === "group" ? node.allChildren || node.children : [];
    const nodeIds = node.kind === "group" ? groupChildren.map(child => child.id) : [node.id];
    const selectedCount = nodeIds.filter(id => selected.has(id)).length;
    const isSelected = selectedCount === nodeIds.length;
    const isPartial = selectedCount > 0 && !isSelected;
    const canDrag = node.kind === "group"
      ? groupChildren.some(child => child.object.type !== "image") && groupChildren.every(child => !child.object.locked)
      : object.type !== "image" && !object.locked;
    const canDelete = node.kind === "group"
      ? groupChildren.some(child => child.object.type !== "image" && !child.object.locked)
      : object.type !== "image" && !object.locked;
    const icon = node.kind === "group" ? "&#9638;" : annotationObjectTreeIcon(node.object.type);
    return `<div class="image-annotation-object-tree-row${isSelected ? " is-selected" : ""}${isPartial ? " is-partially-selected" : ""}" role="treeitem" aria-level="${level}" aria-selected="${isSelected}"${node.kind === "group" ? ` aria-expanded="true"` : ""} tabindex="0" draggable="${canDrag}" data-annotation-tree-node data-annotation-tree-id="${escapeXmlAttr(node.id)}" data-annotation-tree-kind="${node.kind}" data-annotation-tree-node-id="${escapeXmlAttr(node.id)}" data-annotation-tree-node-type="${node.kind}"><span class="image-annotation-object-tree-icon" aria-hidden="true">${icon}</span><span class="image-annotation-object-tree-label">${escapeXmlText(node.name)}</span><span class="image-annotation-object-tree-row-actions"><button type="button" data-annotation-tree-node-action="rename" title="Rename ${escapeXmlAttr(node.name)}" aria-label="Rename ${escapeXmlAttr(node.name)}">&#9998;</button><button type="button" data-annotation-tree-node-action="delete" title="Delete ${escapeXmlAttr(node.name)}" aria-label="Delete ${escapeXmlAttr(node.name)}"${canDelete ? "" : " disabled"}>&#10005;</button></span></div>`;
  };
  return nodes.map(node => node.kind === "group"
    ? `<div class="image-annotation-object-tree-group" data-annotation-tree-group-id="${escapeXmlAttr(node.id)}">${row(node, 1)}<div class="image-annotation-object-tree-group-children" role="group">${node.children.map(child => row(child, 2)).join("")}</div></div>`
    : row(node, 1)).join("");
}

function annotationObjectTreeIcon(type) {
  return {
    image: "&#128444;",
    "embedded-image": "&#128444;",
    rectangle: "&#9633;",
    arrow: "&#8599;",
    textbox: "T"
  }[type] || "&#9675;";
}

function annotationActionButton(action, label, title, requiresSelection = false) {
  return `<button type="button" data-annotation-action="${action}" title="${title}" aria-label="${title}" ${requiresSelection ? "data-annotation-requires-selection" : ""}>${label}</button>`;
}

function annotationToolIconSvg(tool) {
  const paths = {
    select: `<path d="M5 3l13 8-6 2-3 6z" fill="currentColor" stroke="currentColor" stroke-linejoin="round"></path>`,
    crop: `<path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13"></path>`,
    rectangle: `<rect x="4" y="5" width="16" height="14"></rect>`,
    arrow: `<path d="M5 19 19 5M11 5h8v8"></path>`,
    textbox: `<path d="M4 5h16v14H4zM8 9h8M12 9v6M9.5 15h5"></path>`
  };
  return `<svg class="button-svg-icon image-annotation-tool-icon" viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[tool] || ""}</svg>`;
}

function annotationContextMenuHtml() {
  return `
    <div class="image-annotation-context-menu rich-image-menu dropdown-menu" data-annotation-context-menu role="menu" aria-label="Selected object actions" hidden>
      ${annotationContextMenuItemHtml("crop", "Crop", annotationToolIconSvg("crop"), { tool: true })}
      ${annotationContextMenuItemHtml("front", "To Front", "&#8677;")}
      ${annotationContextMenuItemHtml("back", "To Back", "&#8676;")}
      ${annotationContextMenuItemHtml("forward", "Forward", "&#8593;")}
      ${annotationContextMenuItemHtml("backward", "Backward", "&#8595;")}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${annotationContextMenuItemHtml("group", "Group", "&#9719;")}
      ${annotationContextMenuItemHtml("ungroup", "Ungroup", "&#9711;")}
      ${annotationContextMenuItemHtml("reset-crop", "Reset Crop", "&#8634;")}
      ${annotationContextMenuItemHtml("lock", "Lock", "&#9744;")}
      <div class="rich-image-menu-separator" role="separator"></div>
      ${annotationContextMenuItemHtml("copy-svg", "Copy as SVG", "&#10697;")}
      ${annotationContextMenuItemHtml("copy-image", "Copy as Image", "&#9635;")}
    </div>
  `;
}

function annotationContextMenuItemHtml(action, label, icon, options = {}) {
  const actionAttribute = options.tool
    ? `data-annotation-context-tool="${action}"`
    : `data-annotation-action="${action}"`;
  return `
    <button type="button" class="rich-image-menu-item dropdown-menu-item" ${actionAttribute} data-annotation-requires-selection role="menuitem" title="${label}" aria-label="${label}">
      <span class="dropdown-menu-icon" aria-hidden="true">${icon}</span>
      <span class="dropdown-menu-label">${label}</span>
      <span class="dropdown-menu-check" aria-hidden="true"></span>
    </button>
  `;
}

function annotationTemplateCardHtml(template, index, templateCount) {
  const name = escapeXmlAttr(template.name);
  const id = escapeXmlAttr(template.id);
  const preview = escapeXmlAttr(annotationTemplatePreviewDataUrl(template));
  const upDisabled = index === 0;
  const downDisabled = index === templateCount - 1;
  return `
    <article class="image-annotation-template-card" data-annotation-template-card="${id}">
      <button type="button" class="image-annotation-template-preview" data-annotation-template-action="create" data-annotation-template-id="${id}" aria-label="Use ${name} template">
        <img src="${preview}" alt="${name} template preview">
      </button>
      <strong title="${name}">${name}</strong>
      <div class="image-annotation-template-card-actions" aria-label="${name} template actions">
        <button type="button" data-annotation-template-action="rename" data-annotation-template-id="${id}" title="Rename ${name}">Rename</button>
        <button type="button" data-annotation-template-action="replace" data-annotation-template-id="${id}" title="Replace ${name} from current selection">Update</button>
        <button type="button" data-annotation-template-action="up" data-annotation-template-id="${id}" data-annotation-template-boundary-disabled="${upDisabled}" ${upDisabled ? "disabled" : ""} title="Move ${name} up">Up</button>
        <button type="button" data-annotation-template-action="down" data-annotation-template-id="${id}" data-annotation-template-boundary-disabled="${downDisabled}" ${downDisabled ? "disabled" : ""} title="Move ${name} down">Down</button>
        <button type="button" data-annotation-template-action="delete" data-annotation-template-id="${id}" title="Delete ${name}">Delete</button>
      </div>
    </article>
  `;
}

function annotationTemplatePreviewDataUrl(template) {
  const width = positiveNumber(template?.width, 1);
  const height = positiveNumber(template?.height, 1);
  const body = (template?.objects || [])
    .map(object => annotationObjectSvg(object, "", { exportMode: true }))
    .join("");
  const svg = `<svg xmlns="${svgNamespace}" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function copyAnnotationSvgToClipboard(svg) {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const clipboardData = {
        "text/plain": new Blob([svg], { type: "text/plain" }),
        "text/html": new Blob([svg], { type: "text/html" })
      };
      if (typeof ClipboardItem.supports === "function" && ClipboardItem.supports("image/svg+xml")) {
        clipboardData["image/svg+xml"] = new Blob([svg], { type: "image/svg+xml" });
      }
      await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
      return;
    }
  } catch {
    // Fall through to the plain SVG source copy supported by older browsers.
  }

  if (await copyTextToClipboard(svg)) return;
  throw new Error("Clipboard access is unavailable. The SVG was not copied.");
}

async function copyAnnotationPngToClipboard(selectionExport) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("This browser does not support copying images to the clipboard.");
  }
  const pngBlob = annotationSelectionPngBlob(selectionExport);
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
  } catch {
    throw new Error("Clipboard image access was denied. The image was not copied.");
  }
}

async function annotationSelectionPngBlob(selectionExport) {
  const width = positiveNumber(selectionExport?.width, 1);
  const height = positiveNumber(selectionExport?.height, 1);
  const maximumDimension = 8192;
  const scale = Math.min(1, maximumDimension / width, maximumDimension / height);
  const outputWidth = Math.max(1, Math.ceil(width * scale));
  const outputHeight = Math.max(1, Math.ceil(height * scale));
  const svgBlob = new Blob([selectionExport.svg], { type: "image/svg+xml" });
  const objectUrl = URL.createObjectURL(svgBlob);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.addEventListener("load", () => resolve(element), { once: true });
      element.addEventListener("error", () => reject(new Error("The selected artwork could not be rendered.")), { once: true });
      element.src = objectUrl;
    });
    const raster = document.createElement("canvas");
    raster.width = outputWidth;
    raster.height = outputHeight;
    const context = raster.getContext("2d");
    if (!context) throw new Error("The selected artwork could not be rendered.");
    context.drawImage(image, 0, 0, outputWidth, outputHeight);
    return await new Promise((resolve, reject) => {
      raster.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("The selected artwork could not be converted to PNG."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function annotationFontOptions(selectedFont) {
  return ["Arial", "Georgia", "Times New Roman", "Verdana", "Tahoma", "Trebuchet MS", "Courier New"]
    .map(font => `<option value="${font}" ${font === selectedFont ? "selected" : ""}>${font}</option>`)
    .join("");
}

function annotationCanvasSvg(state, originalDataUrl, selectedIds, zoom, workspaceBounds, cropPreview, marqueePreview) {
  const objects = state.objects
    .map(object => annotationObjectSvg(object, originalDataUrl, { exportMode: false, zoom }))
    .join("");
  const grid = state.gridVisible ? annotationGridSvg(workspaceBounds) : "";
  const selection = annotationSelectionSvg(
    state.objects.filter(object => selectedIds.has(object.id)),
    zoom,
    state.imageClip
  );
  const crop = cropPreview ? annotationCropPreviewSvg(cropPreview, state) : "";
  const marquee = marqueePreview ? annotationMarqueeSvg(marqueePreview) : "";
  return `${annotationCanvasDefs(state, zoom)}${objects}${grid}${selection}${marquee}${crop}`;
}

function annotationCanvasDefs(state, zoom) {
  const size = state.gridSize;
  const lineWidth = Math.max(0.5, 1 / zoom);
  const clip = state.imageClip;
  return `
    <defs>
      <clipPath id="${imageClipId}">
        <rect x="${formatNumber(clip.x)}" y="${formatNumber(clip.y)}" width="${formatNumber(clip.width)}" height="${formatNumber(clip.height)}"></rect>
      </clipPath>
      <pattern id="pmt-annotation-grid" width="${formatNumber(size)}" height="${formatNumber(size)}" patternUnits="userSpaceOnUse">
        <path d="M ${formatNumber(size)} 0 L 0 0 0 ${formatNumber(size)}" fill="none" stroke="currentColor" stroke-width="${formatNumber(lineWidth)}" opacity="0.34"></path>
      </pattern>
    </defs>
  `;
}

function annotationImageClipDefinition(state) {
  const clip = state.imageClip;
  return `<defs><clipPath id="${imageClipId}"><rect x="${formatNumber(clip.x)}" y="${formatNumber(clip.y)}" width="${formatNumber(clip.width)}" height="${formatNumber(clip.height)}"></rect></clipPath></defs>`;
}

function annotationGridSvg(bounds) {
  return `<rect class="image-annotation-grid" x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" fill="url(#pmt-annotation-grid)" pointer-events="none"></rect>`;
}

function annotationObjectSvg(object, originalDataUrl, options = {}) {
  const id = options.exportMode ? "" : ` data-annotation-object-id="${escapeXmlAttr(object.id)}"`;
  const type = options.exportMode ? "" : ` data-annotation-object-type="${escapeXmlAttr(object.type)}"`;
  const classes = options.exportMode ? "" : ` class="image-annotation-object${object.locked ? " is-locked" : ""}"`;
  const group = object.groupId ? ` data-pmt-annotation-group="${escapeXmlAttr(object.groupId)}"` : "";
  const locked = object.locked ? ` data-pmt-annotation-locked="true"` : "";
  if (object.type === "image") {
    return `<image${id}${type}${classes}${group}${locked} href="${escapeXmlAttr(originalDataUrl || "")}" x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" preserveAspectRatio="none" clip-path="url(#${imageClipId})"></image>`;
  }
  if (object.type === "embedded-image") {
    return `<image${id}${type}${classes}${group}${locked} href="${escapeXmlAttr(object.source)}" x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" preserveAspectRatio="none"></image>`;
  }
  if (object.type === "rectangle") {
    const stroke = object.outlineVisible === false ? "none" : object.stroke;
    return `<rect${id}${type}${classes}${group}${locked} x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" rx="0" fill="${escapeXmlAttr(object.fill)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(object.strokeWidth)}" opacity="${formatNumber(object.opacity)}"></rect>`;
  }
  if (object.type === "arrow") {
    const geometry = annotationArrowGeometry(object);
    const head = geometry.headPoints
      .map(point => `${formatNumber(point.x)},${formatNumber(point.y)}`)
      .join(" ");
    const hitTargets = options.exportMode ? "" : `<line class="image-annotation-arrow-hit" x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(geometry.shaftEnd.x)}" y2="${formatNumber(geometry.shaftEnd.y)}" stroke="transparent" stroke-width="${formatNumber(object.strokeWidth)}" stroke-linecap="round" pointer-events="stroke"></line><polygon class="image-annotation-arrow-head-hit" points="${head}" fill="transparent" pointer-events="fill"></polygon>`;
    return `<g${id}${type}${classes}${group}${locked} opacity="${formatNumber(object.opacity)}">${hitTargets}<line class="image-annotation-arrow-shaft" x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(geometry.shaftEnd.x)}" y2="${formatNumber(geometry.shaftEnd.y)}" stroke="${escapeXmlAttr(object.stroke)}" stroke-width="${formatNumber(object.strokeWidth)}" stroke-linecap="round" pointer-events="none"></line><polygon class="image-annotation-arrow-head" points="${head}" fill="${escapeXmlAttr(object.stroke)}" pointer-events="none"></polygon></g>`;
  }
  if (object.type === "textbox") {
    return annotationTextBoxSvg(object, { id, type, classes, group, locked, exportMode: options.exportMode });
  }
  return "";
}

function annotationTextBoxSvg(object, attributes) {
  const lines = wrapAnnotationText(object.text, object.width, object.fontSize);
  const padding = Math.max(4, object.fontSize * 0.35);
  const lineHeight = object.fontSize * 1.2;
  const maximumLines = Math.max(1, Math.floor(Math.max(1, object.height - (padding * 2)) / lineHeight));
  const visibleLines = lines.slice(0, maximumLines);
  const textAlign = safeTextAlign(object.textAlign);
  const textVerticalAlign = safeTextVerticalAlign(object.textVerticalAlign);
  const textX = textAlign === "center"
    ? object.x + (object.width / 2)
    : textAlign === "right"
      ? object.x + object.width - padding
      : object.x + padding;
  const textAnchor = textAlign === "center" ? "middle" : textAlign === "right" ? "end" : "start";
  const textAscent = object.fontSize * 0.8;
  const textBlockHeight = object.fontSize + (Math.max(0, visibleLines.length - 1) * lineHeight);
  const innerHeight = Math.max(0, object.height - (padding * 2));
  const freeSpace = Math.max(0, innerHeight - textBlockHeight);
  const verticalOffset = textVerticalAlign === "middle"
    ? freeSpace / 2
    : textVerticalAlign === "bottom"
      ? freeSpace
      : 0;
  const textY = object.y + padding + verticalOffset + textAscent;
  const clipId = `pmt-annotation-clip-${safeSvgId(object.id)}`;
  const tspans = visibleLines.map((line, index) =>
    `<tspan x="${formatNumber(textX)}" dy="${index === 0 ? 0 : formatNumber(lineHeight)}">${escapeXmlText(line)}</tspan>`
  ).join("");
  const stroke = object.outlineVisible === false ? "none" : object.stroke;
  return `<g${attributes.id}${attributes.type}${attributes.classes}${attributes.group}${attributes.locked} opacity="${formatNumber(object.opacity)}"><defs><clipPath id="${clipId}"><rect x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}"></rect></clipPath></defs><rect x="${formatNumber(object.x)}" y="${formatNumber(object.y)}" width="${formatNumber(object.width)}" height="${formatNumber(object.height)}" fill="${escapeXmlAttr(object.fill)}" stroke="${escapeXmlAttr(stroke)}" stroke-width="${formatNumber(object.strokeWidth)}"></rect><text x="${formatNumber(textX)}" y="${formatNumber(textY)}" text-anchor="${textAnchor}" fill="${escapeXmlAttr(object.textColor)}" font-family="${escapeXmlAttr(object.fontFamily)}" font-size="${formatNumber(object.fontSize)}" clip-path="url(#${clipId})">${tspans}</text></g>`;
}

function annotationSelectionSvg(objects, zoom, imageFrame = null) {
  if (!objects.length) return "";
  if (objects.length === 1 && objects[0].type === "arrow") {
    return annotationArrowSelectionSvg(objects[0], zoom);
  }
  const bounds = annotationSelectionBounds(objects, imageFrame);
  if (!bounds) return "";
  const locked = objects.some(object => object.locked);
  const handleRadius = 3.5 / Math.max(minimumZoom, zoom);
  const memberGuides = annotationGroupMemberGuidesSvg(objects, imageFrame);
  const outline = `<rect class="image-annotation-selection${locked ? " is-locked" : ""}" x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" fill="none" stroke-width="1" pointer-events="none"></rect>`;
  if (locked) return `<g class="image-annotation-selection-group">${memberGuides}${outline}</g>`;

  const handles = annotationHandlePoints(bounds).map(handle =>
    `<circle class="image-annotation-handle" data-annotation-handle="${handle.direction}" cx="${formatNumber(handle.x)}" cy="${formatNumber(handle.y)}" r="${formatNumber(handleRadius)}" stroke-width="0.75"></circle>`
  ).join("");
  return `<g class="image-annotation-selection-group">${memberGuides}${outline}${handles}</g>`;
}

function annotationGroupMemberGuidesSvg(objects, imageFrame) {
  const groupCounts = new Map();
  objects.forEach(object => {
    if (!object.groupId) return;
    groupCounts.set(object.groupId, (groupCounts.get(object.groupId) || 0) + 1);
  });
  return objects
    .filter(object => object.groupId && groupCounts.get(object.groupId) > 1)
    .map(object => {
      const id = ` data-annotation-group-member-id="${escapeXmlAttr(object.id)}"`;
      if (object.type === "arrow") {
        return `<line class="image-annotation-group-member-guide is-arrow"${id} x1="${formatNumber(object.x1)}" y1="${formatNumber(object.y1)}" x2="${formatNumber(object.x2)}" y2="${formatNumber(object.y2)}" pointer-events="none"></line>`;
      }
      const bounds = annotationObjectVisualBounds(object, object.type === "image" ? imageFrame : null);
      if (!bounds) return "";
      return `<rect class="image-annotation-group-member-guide"${id} x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}" fill="none" pointer-events="none"></rect>`;
    })
    .join("");
}

function annotationArrowSelectionSvg(object, zoom) {
  const handleRadius = 3.5 / Math.max(minimumZoom, zoom);
  const lockedClass = object.locked ? " is-locked" : "";
  const baseHandle = object.locked ? "" : ` data-annotation-handle="arrow-base"`;
  const tipHandle = object.locked ? "" : ` data-annotation-handle="arrow-tip"`;
  return `<g class="image-annotation-selection-group image-annotation-arrow-selection${lockedClass}"><circle class="image-annotation-handle image-annotation-arrow-handle${lockedClass}"${baseHandle} cx="${formatNumber(object.x1)}" cy="${formatNumber(object.y1)}" r="${formatNumber(handleRadius)}" stroke-width="0.75"></circle><circle class="image-annotation-handle image-annotation-arrow-handle${lockedClass}"${tipHandle} cx="${formatNumber(object.x2)}" cy="${formatNumber(object.y2)}" r="${formatNumber(handleRadius)}" stroke-width="0.75"></circle></g>`;
}

function annotationCropPreviewSvg(rect, state) {
  const clip = state.imageClip;
  return `<path class="image-annotation-crop-mask" d="M${formatNumber(clip.x)} ${formatNumber(clip.y)}H${formatNumber(clip.x + clip.width)}V${formatNumber(clip.y + clip.height)}H${formatNumber(clip.x)}Z M${formatNumber(rect.x)} ${formatNumber(rect.y)}V${formatNumber(rect.y + rect.height)}H${formatNumber(rect.x + rect.width)}V${formatNumber(rect.y)}Z" fill-rule="evenodd" pointer-events="none"></path><rect class="image-annotation-crop-outline image-annotation-marquee" x="${formatNumber(rect.x)}" y="${formatNumber(rect.y)}" width="${formatNumber(rect.width)}" height="${formatNumber(rect.height)}" pointer-events="none"></rect>`;
}

function annotationMarqueeSvg(rect) {
  return `<rect class="image-annotation-marquee" x="${formatNumber(rect.x)}" y="${formatNumber(rect.y)}" width="${formatNumber(rect.width)}" height="${formatNumber(rect.height)}" pointer-events="none"></rect>`;
}

function annotationHandlePoints(bounds) {
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

export function annotationSelectionBounds(objects, imageFrame = null) {
  const boxes = (objects || []).map(object => object?.type === "image" && imageFrame
    ? annotationObjectVisualBounds(object, imageFrame)
    : annotationObjectBounds(object)).filter(Boolean);
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map(box => box.x));
  const top = Math.min(...boxes.map(box => box.y));
  const right = Math.max(...boxes.map(box => box.x + box.width));
  const bottom = Math.max(...boxes.map(box => box.y + box.height));
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function annotationObjectBounds(object) {
  if (!object) return null;
  if (object.type === "arrow") {
    const left = Math.min(object.x1, object.x2);
    const top = Math.min(object.y1, object.y2);
    return {
      x: left,
      y: top,
      width: Math.max(1, Math.abs(object.x2 - object.x1)),
      height: Math.max(1, Math.abs(object.y2 - object.y1))
    };
  }
  return {
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1)
  };
}

function annotationObjectVisualBounds(object, imageFrame = null) {
  if (!object) return null;
  if (object.type === "image") {
    const bounds = {
      x: finiteNumber(object.x, 0),
      y: finiteNumber(object.y, 0),
      width: positiveNumber(object.width, 1),
      height: positiveNumber(object.height, 1)
    };
    return imageFrame ? intersectAnnotationBounds(bounds, imageFrame) : bounds;
  }
  if (object.type === "arrow") {
    const geometry = annotationArrowGeometry(object);
    const strokeRadius = annotationArrowStrokeWidth(object) / 2;
    const shaft = {
      x: Math.min(finiteNumber(object.x1, 0), geometry.shaftEnd.x) - strokeRadius,
      y: Math.min(finiteNumber(object.y1, 0), geometry.shaftEnd.y) - strokeRadius,
      width: Math.abs(geometry.shaftEnd.x - finiteNumber(object.x1, 0)) + (strokeRadius * 2),
      height: Math.abs(geometry.shaftEnd.y - finiteNumber(object.y1, 0)) + (strokeRadius * 2)
    };
    const headX = geometry.headPoints.map(point => point.x);
    const headY = geometry.headPoints.map(point => point.y);
    const head = {
      x: Math.min(...headX),
      y: Math.min(...headY),
      width: Math.max(...headX) - Math.min(...headX),
      height: Math.max(...headY) - Math.min(...headY)
    };
    return unionAnnotationBounds([shaft, head]);
  }
  const strokeRadius = ["rectangle", "textbox"].includes(object.type) && object.outlineVisible !== false
    ? clampNumber(positiveNumber(object.strokeWidth, defaultStyles.strokeWidth), 1, 40) / 2
    : 0;
  return {
    x: finiteNumber(object.x, 0) - strokeRadius,
    y: finiteNumber(object.y, 0) - strokeRadius,
    width: positiveNumber(object.width, 1) + (strokeRadius * 2),
    height: positiveNumber(object.height, 1) + (strokeRadius * 2)
  };
}

function annotationBoundsIntersect(first, second) {
  return first.x <= second.x + second.width
    && first.x + first.width >= second.x
    && first.y <= second.y + second.height
    && first.y + first.height >= second.y;
}

function annotationArrowIntersectsRect(object, rect) {
  const geometry = annotationArrowGeometry(object);
  const strokeRadius = annotationArrowStrokeWidth(object) / 2;
  if (annotationLineDistanceToBounds(
    { x: finiteNumber(object.x1, 0), y: finiteNumber(object.y1, 0) },
    geometry.shaftEnd,
    rect
  ) <= strokeRadius) return true;
  return annotationPolygonIntersectsBounds(geometry.headPoints, rect);
}

function annotationLineDistanceToBounds(start, end, bounds) {
  if (annotationLineIntersectsBounds(start, end, bounds)) return 0;
  const corners = annotationBoundsCorners(bounds);
  return Math.min(
    annotationPointDistanceToBounds(start, bounds),
    annotationPointDistanceToBounds(end, bounds),
    ...corners.map(point => annotationPointDistanceToLine(point, start, end))
  );
}

function annotationPointDistanceToBounds(point, bounds) {
  const deltaX = Math.max(bounds.x - point.x, 0, point.x - (bounds.x + bounds.width));
  const deltaY = Math.max(bounds.y - point.y, 0, point.y - (bounds.y + bounds.height));
  return Math.hypot(deltaX, deltaY);
}

function annotationPointDistanceToLine(point, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = (deltaX * deltaX) + (deltaY * deltaY);
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = clampNumber(
    (((point.x - start.x) * deltaX) + ((point.y - start.y) * deltaY)) / lengthSquared,
    0,
    1
  );
  return Math.hypot(
    point.x - (start.x + (deltaX * position)),
    point.y - (start.y + (deltaY * position))
  );
}

function annotationLineIntersectsBounds(start, end, bounds) {
  if (annotationPointInBounds(start, bounds) || annotationPointInBounds(end, bounds)) return true;
  const corners = annotationBoundsCorners(bounds);
  return corners.some((corner, index) => annotationLineSegmentsIntersect(
    start,
    end,
    corner,
    corners[(index + 1) % corners.length]
  ));
}

function annotationPolygonIntersectsBounds(points, bounds) {
  if (points.some(point => annotationPointInBounds(point, bounds))) return true;
  const corners = annotationBoundsCorners(bounds);
  const area = Math.abs(annotationCrossProduct(points[0], points[1], points[2]));
  if (area > 0.000001 && corners.some(point => annotationPointInTriangle(point, points))) return true;
  return points.some((point, index) => annotationLineIntersectsBounds(
    point,
    points[(index + 1) % points.length],
    bounds
  ));
}

function annotationBoundsCorners(bounds) {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ];
}

function annotationPointInBounds(point, bounds) {
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function annotationPointInTriangle(point, triangle) {
  const first = annotationCrossProduct(point, triangle[0], triangle[1]);
  const second = annotationCrossProduct(point, triangle[1], triangle[2]);
  const third = annotationCrossProduct(point, triangle[2], triangle[0]);
  const hasNegative = first < 0 || second < 0 || third < 0;
  const hasPositive = first > 0 || second > 0 || third > 0;
  return !(hasNegative && hasPositive);
}

function annotationLineSegmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const firstDirection = annotationCrossProduct(firstStart, firstEnd, secondStart);
  const secondDirection = annotationCrossProduct(firstStart, firstEnd, secondEnd);
  const thirdDirection = annotationCrossProduct(secondStart, secondEnd, firstStart);
  const fourthDirection = annotationCrossProduct(secondStart, secondEnd, firstEnd);
  const crosses = ((firstDirection > 0 && secondDirection < 0) || (firstDirection < 0 && secondDirection > 0))
    && ((thirdDirection > 0 && fourthDirection < 0) || (thirdDirection < 0 && fourthDirection > 0));
  if (crosses) return true;
  const epsilon = 0.000001;
  if (Math.abs(firstDirection) <= epsilon && annotationPointOnSegment(secondStart, firstStart, firstEnd)) return true;
  if (Math.abs(secondDirection) <= epsilon && annotationPointOnSegment(secondEnd, firstStart, firstEnd)) return true;
  if (Math.abs(thirdDirection) <= epsilon && annotationPointOnSegment(firstStart, secondStart, secondEnd)) return true;
  return Math.abs(fourthDirection) <= epsilon && annotationPointOnSegment(firstEnd, secondStart, secondEnd);
}

function annotationPointOnSegment(point, start, end) {
  const epsilon = 0.000001;
  return point.x >= Math.min(start.x, end.x) - epsilon
    && point.x <= Math.max(start.x, end.x) + epsilon
    && point.y >= Math.min(start.y, end.y) - epsilon
    && point.y <= Math.max(start.y, end.y) + epsilon;
}

function annotationCrossProduct(origin, first, second) {
  return ((first.x - origin.x) * (second.y - origin.y))
    - ((first.y - origin.y) * (second.x - origin.x));
}

function annotationBoundsContain(outer, inner) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height;
}

function annotationBoundsEqual(first, second) {
  return Math.abs(first.x - second.x) < 0.001
    && Math.abs(first.y - second.y) < 0.001
    && Math.abs(first.width - second.width) < 0.001
    && Math.abs(first.height - second.height) < 0.001;
}

function intersectAnnotationBounds(first, second) {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function unionAnnotationBounds(bounds) {
  const valid = (bounds || []).filter(bound => bound && bound.width >= 0 && bound.height >= 0);
  if (!valid.length) return null;
  const left = Math.min(...valid.map(bound => bound.x));
  const top = Math.min(...valid.map(bound => bound.y));
  const right = Math.max(...valid.map(bound => bound.x + bound.width));
  const bottom = Math.max(...valid.map(bound => bound.y + bound.height));
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

function moveAnnotationObjects(state, gesture, point, horizontalOnly = false, verticalOnly = false) {
  const rawDeltaX = verticalOnly ? 0 : point.x - gesture.startPoint.x;
  const rawDeltaY = horizontalOnly ? 0 : point.y - gesture.startPoint.y;
  const desiredX = verticalOnly
    ? gesture.startBounds.x
    : snapAnnotationValue(gesture.startBounds.x + rawDeltaX, state.snapToGrid, state.gridSize);
  const desiredY = horizontalOnly
    ? gesture.startBounds.y
    : snapAnnotationValue(gesture.startBounds.y + rawDeltaY, state.snapToGrid, state.gridSize);
  const deltaX = desiredX - gesture.startBounds.x;
  const deltaY = desiredY - gesture.startBounds.y;
  gesture.originals.forEach(original => {
    const object = state.objects.find(item => item.id === original.id);
    if (!object) return;
    if (object.type === "arrow") {
      object.x1 = original.x1 + deltaX;
      object.y1 = original.y1 + deltaY;
      object.x2 = original.x2 + deltaX;
      object.y2 = original.y2 + deltaY;
    } else {
      object.x = original.x + deltaX;
      object.y = original.y + deltaY;
    }
  });
  if (gesture.startImageClip) {
    state.imageClip = translatedAnnotationBounds(gesture.startImageClip, deltaX, deltaY);
  }
}

export function resizeAnnotationObjects(
  state,
  gesture,
  point,
  centerAnchored = false,
  freeformRequested = false
) {
  const standaloneRectangle = gesture.originals.length === 1
    && gesture.originals[0].type === "rectangle"
    && !gesture.originals[0].groupId;
  const bounds = resizedAnnotationBounds(
    gesture.startBounds,
    gesture.direction,
    point,
    state,
    centerAnchored,
    freeformRequested && standaloneRectangle
  );
  const scaleX = bounds.width / Math.max(1, gesture.startBounds.width);
  const scaleY = bounds.height / Math.max(1, gesture.startBounds.height);
  gesture.originals.forEach(original => {
    const object = state.objects.find(item => item.id === original.id);
    if (!object) return;
    if (object.type === "arrow") {
      object.x1 = bounds.x + ((original.x1 - gesture.startBounds.x) * scaleX);
      object.y1 = bounds.y + ((original.y1 - gesture.startBounds.y) * scaleY);
      object.x2 = bounds.x + ((original.x2 - gesture.startBounds.x) * scaleX);
      object.y2 = bounds.y + ((original.y2 - gesture.startBounds.y) * scaleY);
      if (original.groupId) {
        Object.assign(object, scaleGroupedAnnotationArrowStyle(
          original,
          Math.min(Math.abs(scaleX), Math.abs(scaleY))
        ));
      }
      return;
    }

    object.x = bounds.x + ((original.x - gesture.startBounds.x) * scaleX);
    object.y = bounds.y + ((original.y - gesture.startBounds.y) * scaleY);
    object.width = Math.max(1, original.width * scaleX);
    object.height = Math.max(1, original.height * scaleY);
    if (object.type === "textbox") {
      object.fontSize = clampNumber(original.fontSize * Math.max(0.1, Math.min(scaleX, scaleY)), 6, 240);
    }
  });
  if (gesture.startImageClip) {
    state.imageClip = scaledAnnotationBounds(
      gesture.startImageClip,
      gesture.startBounds,
      bounds,
      scaleX,
      scaleY
    );
  }
}

export function resizedAnnotationBounds(
  start,
  direction,
  point,
  state,
  centerAnchored = false,
  freeform = false
) {
  const snap = value => snapAnnotationValue(value, state.snapToGrid, state.gridSize);
  const width = positiveNumber(start?.width, 1);
  const height = positiveNumber(start?.height, 1);
  const left = finiteNumber(start?.x, 0);
  const top = finiteNumber(start?.y, 0);
  const right = left + width;
  const bottom = top + height;
  const centerX = left + (width / 2);
  const centerY = top + (height / 2);
  const snappedX = snap(point?.x);
  const snappedY = snap(point?.y);
  const horizontal = direction.includes("w") || direction.includes("e");
  const vertical = direction.includes("n") || direction.includes("s");
  if (!horizontal && !vertical) return { x: left, y: top, width, height };

  const requestedWidth = direction.includes("w")
    ? (centerAnchored ? (centerX - snappedX) * 2 : right - snappedX)
    : direction.includes("e")
      ? (centerAnchored ? (snappedX - centerX) * 2 : snappedX - left)
      : width;
  const requestedHeight = direction.includes("n")
    ? (centerAnchored ? (centerY - snappedY) * 2 : bottom - snappedY)
    : direction.includes("s")
      ? (centerAnchored ? (snappedY - centerY) * 2 : snappedY - top)
      : height;
  if (freeform) {
    const nextWidth = Math.max(minimumObjectSize, Math.max(0, requestedWidth));
    const nextHeight = Math.max(minimumObjectSize, Math.max(0, requestedHeight));
    if (centerAnchored) {
      return {
        x: centerX - (nextWidth / 2),
        y: centerY - (nextHeight / 2),
        width: nextWidth,
        height: nextHeight
      };
    }
    return {
      x: direction.includes("w") ? right - nextWidth : direction.includes("e") ? left : centerX - (nextWidth / 2),
      y: direction.includes("n") ? bottom - nextHeight : direction.includes("s") ? top : centerY - (nextHeight / 2),
      width: nextWidth,
      height: nextHeight
    };
  }
  const scaleX = Math.max(0, requestedWidth) / width;
  const scaleY = Math.max(0, requestedHeight) / height;
  let scale = horizontal && vertical
    ? (Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY)
    : horizontal
      ? scaleX
      : scaleY;
  const minimumScale = Math.max(minimumObjectSize / width, minimumObjectSize / height);
  scale = Math.max(minimumScale, scale);
  const nextWidth = width * scale;
  const nextHeight = height * scale;

  if (centerAnchored) {
    return {
      x: centerX - (nextWidth / 2),
      y: centerY - (nextHeight / 2),
      width: nextWidth,
      height: nextHeight
    };
  }
  return {
    x: direction.includes("w") ? right - nextWidth : direction.includes("e") ? left : centerX - (nextWidth / 2),
    y: direction.includes("n") ? bottom - nextHeight : direction.includes("s") ? top : centerY - (nextHeight / 2),
    width: nextWidth,
    height: nextHeight
  };
}

function updateCreatedObject(object, start, current) {
  if (object.type === "arrow") {
    object.x2 = current.x;
    object.y2 = current.y;
    return;
  }
  const rect = normalizedRect(start, current);
  object.x = rect.x;
  object.y = rect.y;
  object.width = rect.width;
  object.height = rect.height;
}

function ensureCreatedObjectSize(object, state) {
  if (!object) return;
  if (object.type === "arrow") {
    const length = Math.hypot(object.x2 - object.x1, object.y2 - object.y1);
    const minimumLength = annotationMinimumArrowLength(object);
    if (length < minimumLength) {
      const directionX = length ? (object.x2 - object.x1) / length : 1;
      const directionY = length ? (object.y2 - object.y1) / length : 0;
      object.x2 = object.x1 + (directionX * minimumLength);
      object.y2 = object.y1 + (directionY * minimumLength);
    }
    return;
  }
  if (object.width < minimumObjectSize) object.width = state.gridSize * 8;
  if (object.height < minimumObjectSize) object.height = state.gridSize * 4;
}

function applyAnnotationCrop(state, crop) {
  const rect = intersectAnnotationBounds(state.imageClip, crop);
  if (!rect || rect.width < minimumObjectSize || rect.height < minimumObjectSize) return false;
  const image = state.objects.find(object => object.type === "image");
  state.imageClip = rect;
  if (image) {
    const sourceScaleX = state.sourceWidth / Math.max(1, image.width);
    const sourceScaleY = state.sourceHeight / Math.max(1, image.height);
    state.cropOffsetX = clampNumber(
      (rect.x - image.x) * sourceScaleX,
      0,
      Math.max(0, state.sourceWidth - (rect.width * sourceScaleX))
    );
    state.cropOffsetY = clampNumber(
      (rect.y - image.y) * sourceScaleY,
      0,
      Math.max(0, state.sourceHeight - (rect.height * sourceScaleY))
    );
    state.width = rect.width * sourceScaleX;
    state.height = rect.height * sourceScaleY;
  }
  return true;
}

function resetAnnotationCrop(state) {
  const image = state.objects.find(object => object.type === "image");
  if (!image) return false;
  const fullImage = annotationObjectBounds(image);
  if (annotationBoundsEqual(state.imageClip, fullImage)) return false;
  state.imageClip = fullImage;
  state.cropOffsetX = 0;
  state.cropOffsetY = 0;
  state.width = state.sourceWidth;
  state.height = state.sourceHeight;
  return true;
}

function translatedAnnotationBounds(bounds, deltaX, deltaY) {
  return {
    x: bounds.x + deltaX,
    y: bounds.y + deltaY,
    width: bounds.width,
    height: bounds.height
  };
}

function scaledAnnotationBounds(bounds, startBounds, resizedBounds, scaleX, scaleY) {
  return {
    x: resizedBounds.x + ((bounds.x - startBounds.x) * scaleX),
    y: resizedBounds.y + ((bounds.y - startBounds.y) * scaleY),
    width: Math.max(1, bounds.width * scaleX),
    height: Math.max(1, bounds.height * scaleY)
  };
}

function translateAllAnnotationObjects(objects, deltaX, deltaY) {
  objects.forEach(object => {
    if (object.type === "arrow") {
      object.x1 += deltaX;
      object.y1 += deltaY;
      object.x2 += deltaX;
      object.y2 += deltaY;
    } else {
      object.x += deltaX;
      object.y += deltaY;
    }
  });
}

function handleAnnotationAction(action, context) {
  if (action === "undo") {
    context.pushHistory();
    context.restoreHistory(context.historyIndex() - 1);
    return;
  }
  if (action === "redo") {
    context.pushHistory();
    context.restoreHistory(context.historyIndex() + 1);
    return;
  }
  if (action === "reset-crop") {
    if (resetAnnotationCrop(context.state)) {
      context.pushHistory();
      context.setStatus("Full source restored.");
    } else {
      context.setStatus("The full source is already visible.");
    }
    return;
  }

  const selection = context.selectedObjects();
  if (!selection.length) return;
  if (action === "delete") {
    const deletedIds = new Set(selection.filter(object => object.type !== "image" && !object.locked).map(object => object.id));
    context.state.objects = context.state.objects.filter(object => !deletedIds.has(object.id));
    deletedIds.forEach(id => context.selectedIds.delete(id));
    context.setStatus(deletedIds.size ? "Selected annotations deleted." : "Unlock annotations before deleting them.");
    if (deletedIds.size) {
      pruneAnnotationGroupNames(context.state);
      context.pushHistory();
    }
    return;
  }
  if (action === "lock") {
    const shouldLock = !selection.every(object => object.locked);
    selection.forEach(object => { object.locked = shouldLock; });
    context.setStatus(shouldLock ? "Selection locked." : "Selection unlocked.");
    context.pushHistory();
    return;
  }
  if (["group", "ungroup", "front", "forward", "backward", "back"].includes(action)
    && selection.some(object => object.locked)) {
    context.setStatus("Unlock the selection before grouping or arranging it.");
    return;
  }
  if (action === "group") {
    if (selection.length < 2) return;
    const groupId = context.nextGroupId();
    selection.forEach(object => { object.groupId = groupId; });
    compactAnnotationGroupLayers(context.state.objects);
    pruneAnnotationGroupNames(context.state);
    context.setStatus("Selection grouped.");
    context.pushHistory();
    return;
  }
  if (action === "ungroup") {
    const groupIds = new Set(selection.map(object => object.groupId).filter(Boolean));
    if (!groupIds.size) return;
    context.state.objects.forEach(object => {
      if (groupIds.has(object.groupId)) object.groupId = "";
    });
    pruneAnnotationGroupNames(context.state);
    context.setStatus("Selection ungrouped.");
    context.pushHistory();
    return;
  }
  if (["front", "forward", "backward", "back"].includes(action)) {
    moveAnnotationLayers(context.state.objects, context.selectedIds, action);
    compactAnnotationGroupLayers(context.state.objects);
    context.pushHistory();
  }
}

export function moveAnnotationLayers(objects, selectedIds, action) {
  const selected = id => selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id);
  const baseObjects = objects.filter(object => object.type === "image");
  const layers = objects.filter(object => object.type !== "image");
  if (action === "front" || action === "back") {
    const moving = layers.filter(object => selected(object.id));
    const remaining = layers.filter(object => !selected(object.id));
    objects.splice(0, objects.length, ...baseObjects, ...(action === "front" ? [...remaining, ...moving] : [...moving, ...remaining]));
    return objects;
  }
  if (action === "forward") {
    for (let index = layers.length - 2; index >= 0; index -= 1) {
      if (selected(layers[index].id) && !selected(layers[index + 1].id)) {
        [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
      }
    }
    objects.splice(0, objects.length, ...baseObjects, ...layers);
    return objects;
  }
  if (action === "backward") {
    for (let index = 1; index < layers.length; index += 1) {
      if (selected(layers[index].id) && !selected(layers[index - 1].id)) {
        [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
      }
    }
    objects.splice(0, objects.length, ...baseObjects, ...layers);
  }
  return objects;
}

function handleAnnotationKeyDown(event, context) {
  if (event.defaultPrevented) return;
  const control = event.target.closest?.("input, textarea, select, button");
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    context.pushHistory();
    context.restoreHistory(context.historyIndex() + (event.shiftKey ? 1 : -1));
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    context.pushHistory();
    context.restoreHistory(context.historyIndex() + 1);
    return;
  }
  if (!control && (event.ctrlKey || event.metaKey) && key === "c") {
    event.preventDefault();
    context.copySelection?.();
    return;
  }
  if (!control && (event.ctrlKey || event.metaKey) && key === "v") {
    event.preventDefault();
    context.pasteSelection?.();
    return;
  }
  if (!control && (event.ctrlKey || event.metaKey) && key === "d") {
    event.preventDefault();
    context.duplicateSelection?.();
    return;
  }
  if (key === "escape" && context.selectedIds.size) {
    event.preventDefault();
    event.stopPropagation();
    context.selectedIds.clear();
    context.setStatus("Selection cleared.");
    context.render();
    context.focusWorkspace?.();
    return;
  }
  if (control) return;
  if ((event.ctrlKey || event.metaKey) && key === "a") {
    event.preventDefault();
    context.selectedIds.clear();
    context.state.objects.forEach(object => context.selectedIds.add(object.id));
    context.setStatus(`${context.selectedIds.size} object${context.selectedIds.size === 1 ? "" : "s"} selected.`);
    context.render();
    context.focusSelection?.();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === "g") {
    event.preventDefault();
    const action = event.shiftKey ? "ungroup" : "group";
    const selected = context.selectedObjects();
    if (selected.some(object => object.locked)) {
      context.setStatus("Unlock the selection before grouping it.");
      return;
    }
    if (action === "group" && selected.length >= 2) {
      const groupId = `group-${Date.now().toString(36)}`;
      selected.forEach(object => { object.groupId = groupId; });
      context.pushHistory();
      context.render();
      context.focusSelection?.();
    } else if (action === "ungroup") {
      const groupIds = new Set(selected.map(object => object.groupId).filter(Boolean));
      context.state.objects.forEach(object => {
        if (groupIds.has(object.groupId)) object.groupId = "";
      });
      context.pushHistory();
      context.render();
      context.focusSelection?.();
    }
    return;
  }
  if (["delete", "backspace"].includes(key)) {
    event.preventDefault();
    const removable = new Set(context.selectedObjects().filter(object => object.type !== "image" && !object.locked).map(object => object.id));
    context.state.objects = context.state.objects.filter(object => !removable.has(object.id));
    removable.forEach(id => context.selectedIds.delete(id));
    if (removable.size) {
      context.pushHistory();
      context.setStatus(`${removable.size} object${removable.size === 1 ? "" : "s"} deleted.`);
    }
    context.render();
    if (context.selectedIds.size) context.focusSelection?.();
    else context.focusWorkspace?.();
    return;
  }
  if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
    const selection = context.selectedObjects().filter(object => !object.locked);
    if (!selection.length || selection.length !== context.selectedIds.size) return;
    event.preventDefault();
    const distance = context.state.gridVisible ? context.state.gridSize : 1;
    const deltaX = key === "arrowleft" ? -distance : key === "arrowright" ? distance : 0;
    const deltaY = key === "arrowup" ? -distance : key === "arrowdown" ? distance : 0;
    translateAllAnnotationObjects(selection, deltaX, deltaY);
    if (selection.some(object => object.type === "image")) {
      context.state.imageClip = translatedAnnotationBounds(context.state.imageClip, deltaX, deltaY);
    }
    context.pushHistory();
    context.render();
    context.focusSelection?.();
    return;
  }
  if ({ v: "select", c: "crop", r: "rectangle", a: "arrow", t: "textbox" }[key]) {
    context.setTool({ v: "select", c: "crop", r: "rectangle", a: "arrow", t: "textbox" }[key]);
  }
}

function bindAnnotationColorPickers(root, options) {
  const tools = [...root.querySelectorAll("[data-annotation-color-picker]")];
  const closeAll = except => tools.forEach(tool => {
    if (tool !== except) closeAnnotationColorPicker(tool);
  });
  const renderMemory = () => renderAnnotationColorMemory(root);

  tools.forEach(tool => {
    const name = tool.dataset.annotationColorPicker;
    const trigger = tool.querySelector("[data-annotation-color-trigger]");
    const palette = tool.querySelector("[data-rich-color-palette]");
    const recentColors = tool.closest(".image-annotation-color-controls")?.querySelector("[data-annotation-recent-colors]");
    if (!name || !trigger || !palette) return;
    const defaultColor = normalizePickerColor(trigger.dataset.richColorDefault) || "#111827";
    const memoryKey = annotationColorMemoryKey(name);
    const apply = color => {
      const normalized = normalizePickerColor(color) || defaultColor;
      tool.style.setProperty("--rich-selected-color", normalized);
      trigger.dataset.richSelectedColor = normalized;
      rememberAnnotationColor(memoryKey, normalized);
      renderMemory();
      closeAnnotationColorPicker(tool);
      options.apply(name, normalized);
      return normalized;
    };

    trigger.dataset.richSelectedColor = readAnnotationLastColor(memoryKey, defaultColor);
    tool.style.setProperty("--rich-selected-color", trigger.dataset.richSelectedColor);
    trigger.addEventListener("click", event => {
      event.preventDefault();
      const rect = trigger.getBoundingClientRect();
      if (event.clientX && event.clientX <= rect.left + (rect.width / 2)) {
        apply(trigger.dataset.richSelectedColor || defaultColor);
        return;
      }
      const shouldOpen = !tool.classList.contains("is-open");
      closeAll();
      if (shouldOpen) openAnnotationColorPicker(tool);
    });
    palette.addEventListener("click", async event => {
      const colorButton = event.target.closest("[data-rich-color-value]");
      if (colorButton && palette.contains(colorButton)) {
        event.preventDefault();
        apply(colorButton.dataset.richColorValue || defaultColor);
        trigger.focus({ preventScroll: true });
        return;
      }
      if (!event.target.closest("[data-rich-color-custom]")) return;
      event.preventDefault();
      closeAnnotationColorPicker(tool);
      const current = trigger.dataset.richSelectedColor || defaultColor;
      const custom = typeof options.askForColor === "function"
        ? await options.askForColor(current)
        : await chooseNativeAnnotationColor(current);
      if (!custom) return;
      const normalized = normalizePickerColor(custom);
      if (!normalized) {
        options.setStatus("Enter a valid HEX or RGB color.");
        return;
      }
      rememberAnnotationCustomColor(normalized);
      apply(normalized);
      trigger.focus({ preventScroll: true });
    });
    recentColors?.addEventListener("click", event => {
      const colorButton = event.target.closest("[data-rich-color-value]");
      if (!colorButton || !recentColors.contains(colorButton)) return;
      event.preventDefault();
      const normalized = apply(colorButton.dataset.richColorValue || defaultColor);
      [...recentColors.querySelectorAll("[data-rich-color-value]")]
        .find(button => button.dataset.richColorValue === normalized)
        ?.focus({ preventScroll: true });
    });
  });

  renderMemory();
  root.addEventListener("pointerdown", event => {
    if (!event.target.closest("[data-annotation-color-picker]")) closeAll();
  });
  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && root.querySelector("[data-annotation-color-picker].is-open")) {
      event.preventDefault();
      event.stopPropagation();
      closeAll();
    }
  });
}

function openAnnotationColorPicker(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  const trigger = tool.querySelector("[data-annotation-color-trigger]");
  if (!palette || !trigger) return;
  tool.classList.add("is-open");
  palette.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  const triggerRect = trigger.getBoundingClientRect();
  const paletteRect = palette.getBoundingClientRect();
  const padding = 8;
  const gap = 4;
  const left = clampNumber(triggerRect.left, padding, Math.max(padding, window.innerWidth - paletteRect.width - padding));
  const below = triggerRect.bottom + gap;
  const above = triggerRect.top - paletteRect.height - gap;
  const top = below + paletteRect.height <= window.innerHeight - padding ? below : Math.max(padding, above);
  palette.style.setProperty("--rich-palette-left", `${Math.round(left)}px`);
  palette.style.setProperty("--rich-palette-top", `${Math.round(top)}px`);
}

function closeAnnotationColorPicker(tool) {
  const palette = tool.querySelector("[data-rich-color-palette]");
  tool.classList.remove("is-open");
  if (palette) {
    palette.hidden = true;
    palette.style.removeProperty("--rich-palette-left");
    palette.style.removeProperty("--rich-palette-top");
  }
  tool.querySelector("[data-annotation-color-trigger]")?.setAttribute("aria-expanded", "false");
}

function renderAnnotationColorMemory(root) {
  const lastColors = readAnnotationColorList("pmt-rich-last-colors");
  const recentColors = lastColors.slice(0, 6);
  const customColors = readAnnotationColorList("pmt-rich-custom-colors");
  root.querySelectorAll("[data-annotation-recent-colors]").forEach(container => {
    const title = container.closest(".image-annotation-color-controls")
      ?.querySelector("[data-annotation-color-trigger]")
      ?.getAttribute("aria-label") || "Color";
    container.hidden = recentColors.length === 0;
    container.innerHTML = recentColors.map(color => annotationColorSwatch(color, title)).join("");
  });
  root.querySelectorAll("[data-rich-last-colors]").forEach(container => {
    container.hidden = lastColors.length === 0;
    const title = container.closest("[data-rich-color-palette]")?.previousElementSibling?.getAttribute("aria-label") || "Color";
    const section = container.closest("[data-rich-color-palette]")?.querySelector("[data-rich-last-colors-title]");
    if (section) section.hidden = lastColors.length === 0;
    container.innerHTML = lastColors.map(color => annotationColorSwatch(color, title)).join("");
  });
  root.querySelectorAll("[data-rich-custom-colors]").forEach(container => {
    container.hidden = customColors.length === 0;
    const title = container.closest("[data-rich-color-palette]")?.previousElementSibling?.getAttribute("aria-label") || "Color";
    container.innerHTML = customColors.map(color => annotationColorSwatch(color, title)).join("");
  });
}

function annotationColorSwatch(color, title) {
  const label = `${title} ${color} ${annotationRgbText(color)}`;
  return `<button type="button" class="rich-color-swatch" data-rich-color-value="${color}" title="${label}" aria-label="${label}" style="--rich-swatch-color: ${color}"></button>`;
}

function annotationColorMemoryKey(name) {
  return name === "textColor" ? "foreColor" : name === "fill" ? "hiliteColor" : "annotationStroke";
}

function readAnnotationLastColor(key, fallback) {
  try {
    return normalizePickerColor(localStorage.getItem(`pmt-rich-last-color-${key}`)) || fallback;
  } catch {
    return fallback;
  }
}

function rememberAnnotationColor(key, color) {
  const colors = [color, ...readAnnotationColorList("pmt-rich-last-colors").filter(item => item !== color)].slice(0, 10);
  try {
    localStorage.setItem("pmt-rich-last-colors", JSON.stringify(colors));
    localStorage.setItem(`pmt-rich-last-color-${key}`, color);
  } catch {
    // Color memory is optional when browser storage is unavailable.
  }
}

function rememberAnnotationCustomColor(color) {
  const colors = [color, ...readAnnotationColorList("pmt-rich-custom-colors").filter(item => item !== color)].slice(0, 10);
  try {
    localStorage.setItem("pmt-rich-custom-colors", JSON.stringify(colors));
  } catch {
    // Color memory is optional when browser storage is unavailable.
  }
}

function readAnnotationColorList(key) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(values)
      ? [...new Set(values.map(normalizePickerColor).filter(Boolean))].slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function normalizePickerColor(value) {
  const text = String(value || "").trim();
  const hex = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].split("").map(part => part + part).join("") : hex[1];
    return `#${digits.toUpperCase()}`;
  }
  const rgb = text.match(/^(?:rgb\s*\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i);
  if (!rgb) return "";
  const channels = rgb.slice(1).map(Number);
  if (channels.some(channel => channel < 0 || channel > 255)) return "";
  return `#${channels.map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function annotationRgbText(color) {
  const normalized = normalizePickerColor(color);
  if (!normalized) return "";
  return `rgb(${Number.parseInt(normalized.slice(1, 3), 16)}, ${Number.parseInt(normalized.slice(3, 5), 16)}, ${Number.parseInt(normalized.slice(5, 7), 16)})`;
}

function chooseNativeAnnotationColor(current) {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "color";
    input.value = normalizePickerColor(current) || "#126BFF";
    input.hidden = true;
    document.body.appendChild(input);
    const finish = value => {
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => finish(input.value), { once: true });
    input.addEventListener("cancel", () => finish(""), { once: true });
    input.click();
  });
}

function applyAnnotationStyle(name, rawValue, selection, styles) {
  if (!Object.hasOwn(styles, name)) return;
  let value = rawValue;
  if (["fontSize", "strokeWidth", "arrowSize"].includes(name)) {
    const limits = name === "fontSize" ? [6, 240] : name === "strokeWidth" ? [1, 40] : [6, 160];
    value = clampNumber(positiveNumber(rawValue, styles[name]), limits[0], limits[1]);
  } else if (name === "opacity") {
    const percentage = String(rawValue ?? "").trim()
      ? finiteNumber(rawValue, styles.opacity * 100)
      : styles.opacity * 100;
    value = clampNumber(percentage, 0, 100) / 100;
  } else if (name === "textAlign") {
    value = safeTextAlign(rawValue);
  } else if (name === "textVerticalAlign") {
    value = safeTextVerticalAlign(rawValue);
  }
  styles[name] = value;
  selection.filter(object => !object.locked).forEach(object => {
    if (name === "fill" && ["rectangle", "textbox"].includes(object.type)) object.fill = value;
    else if (name === "stroke" && ["rectangle", "textbox", "arrow"].includes(object.type)) object.stroke = value;
    else if (name === "strokeWidth" && ["rectangle", "textbox", "arrow"].includes(object.type)) object.strokeWidth = value;
    else if (name === "arrowSize" && object.type === "arrow") object.arrowSize = value;
    else if (name === "opacity" && ["rectangle", "textbox", "arrow"].includes(object.type)) object.opacity = value;
    else if (["textColor", "fontFamily", "fontSize", "textAlign", "textVerticalAlign"].includes(name) && object.type === "textbox") object[name] = value;
    if (object.type === "arrow" && ["strokeWidth", "arrowSize"].includes(name)) {
      Object.assign(object, fitAnnotationArrowToHead(object));
    }
  });
}

function normalizeAnnotationTemplate(input) {
  if (!input || typeof input !== "object") return null;
  const objects = Array.isArray(input.objects)
    ? input.objects
        .map(normalizeAnnotationObject)
        .filter(object => object && object.type !== "image")
        .map(object => ({ ...object, locked: false, groupId: "" }))
    : [];
  if (!objects.length) return null;
  const bounds = unionAnnotationBounds(objects.map(object => annotationObjectVisualBounds(object)).filter(Boolean));
  const name = String(input.name || "Template").trim().slice(0, 120) || "Template";
  return {
    id: safeObjectId(input.id, "template"),
    name,
    grouped: input.grouped === true,
    groupName: safeAnnotationName(input.groupName),
    width: positiveNumber(input.width, bounds?.width || 1),
    height: positiveNumber(input.height, bounds?.height || 1),
    createdAt: safeAnnotationTimestamp(input.createdAt),
    updatedAt: safeAnnotationTimestamp(input.updatedAt),
    objects
  };
}

function annotationFactoryDrawingDefault(type) {
  if (type === "arrow") {
    return {
      stroke: defaultStyles.stroke,
      strokeWidth: defaultStyles.strokeWidth,
      arrowSize: defaultStyles.arrowSize,
      opacity: defaultStyles.opacity
    };
  }
  return {
    fill: "none",
    stroke: defaultStyles.stroke,
    outlineVisible: true,
    strokeWidth: defaultStyles.strokeWidth,
    opacity: defaultStyles.opacity
  };
}

function normalizeAnnotationDrawingDefault(type, input) {
  if (!input || typeof input !== "object") return null;
  const factory = annotationFactoryDrawingDefault(type);
  if (type === "arrow") {
    return {
      stroke: safeColor(input.stroke, factory.stroke),
      strokeWidth: clampNumber(positiveNumber(input.strokeWidth, factory.strokeWidth), 1, 40),
      arrowSize: clampNumber(positiveNumber(input.arrowSize, factory.arrowSize), 6, 160),
      opacity: safeAnnotationOpacity(input.opacity)
    };
  }
  if (type === "rectangle") {
    return {
      fill: input.fill === "none" ? "none" : safeColor(input.fill, factory.fill),
      stroke: safeColor(input.stroke, factory.stroke),
      outlineVisible: input.outlineVisible !== false,
      strokeWidth: clampNumber(positiveNumber(input.strokeWidth, factory.strokeWidth), 1, 40),
      opacity: safeAnnotationOpacity(input.opacity)
    };
  }
  return null;
}

function annotationDrawingDefaultFromObject(object) {
  return normalizeAnnotationDrawingDefault(object?.type, object);
}

function annotationEmbeddedImageFromSource(image, state, originalDataUrl) {
  const source = safeEmbeddedImageSource(originalDataUrl);
  if (!source) return null;
  const imageBounds = annotationObjectBounds(image);
  const visible = intersectAnnotationBounds(imageBounds, state.imageClip);
  if (!visible) return null;
  const fullImageVisible = annotationBoundsEqual(imageBounds, visible);
  const embeddedSource = fullImageVisible
    ? source
    : annotationCroppedImageDataUrl(source, imageBounds, visible);
  return {
    id: image.id,
    type: "embedded-image",
    x: visible.x,
    y: visible.y,
    width: visible.width,
    height: visible.height,
    source: embeddedSource,
    name: image.name || "",
    locked: false,
    groupId: ""
  };
}

function annotationCroppedImageDataUrl(source, imageBounds, visibleBounds) {
  const svg = `<svg xmlns="${svgNamespace}" width="${formatNumber(visibleBounds.width)}" height="${formatNumber(visibleBounds.height)}" viewBox="${formatNumber(visibleBounds.x)} ${formatNumber(visibleBounds.y)} ${formatNumber(visibleBounds.width)} ${formatNumber(visibleBounds.height)}"><image href="${escapeXmlAttr(source)}" x="${formatNumber(imageBounds.x)}" y="${formatNumber(imageBounds.y)}" width="${formatNumber(imageBounds.width)}" height="${formatNumber(imageBounds.height)}" preserveAspectRatio="none"></image></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function annotationSelectionVisualBounds(objects, imageFrame = null) {
  return unionAnnotationBounds((objects || [])
    .map(object => annotationObjectVisualBounds(object, object.type === "image" ? imageFrame : null))
    .filter(Boolean));
}

function safeAnnotationTimestamp(value) {
  const parsed = new Date(String(value || ""));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function safeEmbeddedImageSource(value) {
  const source = String(value || "").trim();
  return /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(source) ? source : "";
}

function annotationEmbeddedSourceRegistry(objects) {
  return new Map((objects || [])
    .filter(object => object?.type === "embedded-image" && object.source)
    .map(object => [object.id, object.source]));
}

function restoreAnnotationEmbeddedSources(objects, sourceRegistry) {
  (objects || []).forEach(object => {
    if (object?.type !== "embedded-image" || object.source) return;
    object.source = sourceRegistry.get(object.id) || "";
  });
}

function annotationGestureObjects(objects) {
  return (objects || []).map(object => {
    const copy = { ...object };
    if (copy.type === "embedded-image") delete copy.source;
    return copy;
  });
}

function normalizeAnnotationObject(input) {
  if (!input || typeof input !== "object") return null;
  const type = String(input.type || "").toLowerCase();
  if (!["image", "embedded-image", "rectangle", "arrow", "textbox"].includes(type)) return null;
  const common = {
    id: safeObjectId(input.id, type),
    type,
    name: safeAnnotationName(input.name),
    locked: input.locked === true,
    groupId: safeGroupId(input.groupId)
  };
  if (type === "arrow") {
    return fitAnnotationArrowToHead({
      ...common,
      x1: finiteNumber(input.x1, 0),
      y1: finiteNumber(input.y1, 0),
      x2: finiteNumber(input.x2, 100),
      y2: finiteNumber(input.y2, 0),
      stroke: safeColor(input.stroke, defaultStyles.stroke),
      strokeWidth: annotationArrowStrokeWidth(input),
      arrowSize: annotationArrowRequestedHeadLength(input),
      opacity: safeAnnotationOpacity(input.opacity)
    });
  }
  const normalized = {
    ...common,
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: positiveNumber(input.width, 1),
    height: positiveNumber(input.height, 1)
  };
  if (type === "image") return normalized;
  if (type === "embedded-image") {
    const source = safeEmbeddedImageSource(input.source);
    return source ? { ...normalized, source } : null;
  }
  normalized.fill = input.fill === "none" ? "none" : safeColor(input.fill, type === "textbox" ? defaultStyles.fill : "none");
  normalized.stroke = safeColor(input.stroke, defaultStyles.stroke);
  normalized.outlineVisible = input.outlineVisible !== false;
  normalized.strokeWidth = clampNumber(positiveNumber(input.strokeWidth, defaultStyles.strokeWidth), 1, 40);
  normalized.opacity = safeAnnotationOpacity(input.opacity);
  if (type === "textbox") {
    normalized.text = String(input.text ?? "Text").slice(0, 10000);
    normalized.textColor = safeColor(input.textColor, defaultStyles.textColor);
    normalized.fontFamily = safeFont(input.fontFamily);
    normalized.fontSize = clampNumber(positiveNumber(input.fontSize, defaultStyles.fontSize), 6, 240);
    normalized.textAlign = safeTextAlign(input.textAlign);
    normalized.textVerticalAlign = safeTextVerticalAlign(input.textVerticalAlign);
  }
  return normalized;
}

function annotationArrowStrokeWidth(object) {
  return clampNumber(
    positiveNumber(object?.strokeWidth, defaultStyles.strokeWidth),
    minimumScaledStrokeWidth,
    maximumScaledStrokeWidth
  );
}

function annotationArrowRequestedHeadLength(object) {
  return clampNumber(
    positiveNumber(object?.arrowSize, defaultStyles.arrowSize),
    minimumScaledArrowSize,
    maximumScaledArrowSize
  );
}

function annotationArrowRequiredLength(object) {
  return Math.max(
    annotationArrowRequestedHeadLength(object),
    annotationArrowStrokeWidth(object) * 1.5
  ) / 0.8;
}

function annotationMinimumArrowLength(object) {
  return Math.max(minimumObjectSize, annotationArrowRequiredLength(object));
}

export function fitAnnotationArrowToHead(inputArrow) {
  const arrow = { ...inputArrow };
  arrow.strokeWidth = annotationArrowStrokeWidth(arrow);
  arrow.arrowSize = annotationArrowRequestedHeadLength(arrow);
  const x1 = finiteNumber(arrow.x1, 0);
  const y1 = finiteNumber(arrow.y1, 0);
  const x2 = finiteNumber(arrow.x2, x1);
  const y2 = finiteNumber(arrow.y2, y1);
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.hypot(deltaX, deltaY);
  const requiredLength = annotationArrowRequiredLength(arrow);
  if (length >= requiredLength) return arrow;
  const directionX = length ? deltaX / length : 1;
  const directionY = length ? deltaY / length : 0;
  arrow.x1 = x2 - (directionX * requiredLength);
  arrow.y1 = y2 - (directionY * requiredLength);
  return arrow;
}

export function scaleGroupedAnnotationArrowStyle(inputArrow, scale) {
  const factor = positiveNumber(Math.abs(scale), 1);
  return {
    strokeWidth: clampNumber(
      annotationArrowStrokeWidth(inputArrow) * factor,
      minimumScaledStrokeWidth,
      maximumScaledStrokeWidth
    ),
    arrowSize: clampNumber(
      annotationArrowRequestedHeadLength(inputArrow) * factor,
      minimumScaledArrowSize,
      maximumScaledArrowSize
    )
  };
}

export function annotationArrowGeometry(object) {
  const x1 = finiteNumber(object?.x1, 0);
  const y1 = finiteNumber(object?.y1, 0);
  const x2 = finiteNumber(object?.x2, x1);
  const y2 = finiteNumber(object?.y2, y1);
  const deltaX = x2 - x1;
  const deltaY = y2 - y1;
  const length = Math.hypot(deltaX, deltaY);
  if (!length) {
    const tip = { x: x2, y: y2 };
    return { shaftEnd: tip, headPoints: [tip, tip, tip] };
  }

  const directionX = deltaX / length;
  const directionY = deltaY / length;
  const strokeWidth = annotationArrowStrokeWidth(object);
  const requestedHeadLength = annotationArrowRequestedHeadLength(object);
  const headLength = Math.min(
    Math.max(requestedHeadLength, strokeWidth * 1.5),
    length * 0.8
  );
  const halfWidth = Math.max(
    headLength * 0.48,
    Math.min(strokeWidth * 0.75, headLength * 0.75)
  );
  const baseX = x2 - (directionX * headLength);
  const baseY = y2 - (directionY * headLength);
  const perpendicularX = -directionY * halfWidth;
  const perpendicularY = directionX * halfWidth;

  return {
    shaftEnd: { x: baseX, y: baseY },
    headPoints: [
      { x: x2, y: y2 },
      { x: baseX + perpendicularX, y: baseY + perpendicularY },
      { x: baseX - perpendicularX, y: baseY - perpendicularY }
    ]
  };
}

async function loadOriginalImage(url) {
  const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("The original image could not be loaded.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Only image files can be annotated.");
  const dataUrl = await blobToDataUrl(blob);
  const dimensions = await imageDimensions(dataUrl);
  return { dataUrl, ...dimensions };
}

async function loadExistingAnnotation(url) {
  try {
    const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return null;
    return parseAnnotationSvg(await response.text());
  } catch {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(new Error("The original image could not be read.")), { once: true });
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) {
        reject(new Error("The image dimensions could not be read."));
        return;
      }
      resolve({ width, height });
    }, { once: true });
    image.addEventListener("error", () => reject(new Error("The original image could not be decoded.")), { once: true });
    image.src = source;
  });
}

function annotationSnapshot(state, sourceRegistry = null) {
  const snapshot = normalizeAnnotationState(state);
  snapshot.objects.forEach(object => {
    if (object.type !== "embedded-image") return;
    if (sourceRegistry && object.source) sourceRegistry.set(object.id, object.source);
    delete object.source;
  });
  return JSON.stringify(snapshot);
}

function annotationFileName(originalFileName) {
  const baseName = String(originalFileName || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "image";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${baseName}-annotation-${stamp}.svg`;
}

function annotationObjectId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function annotationObjectLabel(object) {
  if (!object) return "No selection";
  const customName = safeAnnotationName(object.name);
  if (customName) return customName;
  return {
    image: "Original image",
    "embedded-image": "Image",
    rectangle: "Rectangle",
    arrow: "Arrow",
    textbox: "Text box"
  }[object.type] || "Object";
}

function snappedPoint(point, state) {
  return {
    x: snapAnnotationValue(point.x, state.snapToGrid, state.gridSize),
    y: snapAnnotationValue(point.y, state.snapToGrid, state.gridSize)
  };
}

function normalizedRect(start, end) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function setControlValue(control, value) {
  if (!control || control.value === value) return;
  if (document.activeElement === control && control.matches("input[type='text'], textarea")) return;
  control.value = value;
}

function safeColor(value, fallback) {
  const text = String(value || "").trim();
  if (text === "none") return "none";
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}

function safeFont(value) {
  const font = String(value || "").trim();
  return ["Arial", "Georgia", "Times New Roman", "Verdana", "Tahoma", "Trebuchet MS", "Courier New"].includes(font)
    ? font
    : defaultStyles.fontFamily;
}

function safeTextAlign(value) {
  const alignment = String(value || "").trim().toLowerCase();
  return ["left", "center", "right"].includes(alignment) ? alignment : defaultStyles.textAlign;
}

function safeTextVerticalAlign(value) {
  const alignment = String(value || "").trim().toLowerCase();
  return ["top", "middle", "bottom"].includes(alignment) ? alignment : defaultStyles.textVerticalAlign;
}

function safeAnnotationOpacity(value) {
  return clampNumber(finiteNumber(value, defaultStyles.opacity), 0, 1);
}

function safeObjectId(value, prefix) {
  const id = String(value || "").trim();
  return /^[a-z0-9_-]{1,120}$/i.test(id) ? id : annotationObjectId(prefix);
}

function safeGroupId(value) {
  const id = String(value || "").trim();
  return /^[a-z0-9_-]{1,120}$/i.test(id) ? id : "";
}

function safeAnnotationName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function pruneAnnotationGroupNames(state) {
  if (!state || typeof state !== "object") return;
  const groupIds = new Set((state.objects || []).map(object => object.groupId).filter(Boolean));
  const source = state.groupNames && typeof state.groupNames === "object" ? state.groupNames : {};
  const groupNames = {};
  groupIds.forEach(groupId => {
    const name = safeAnnotationName(source[groupId]);
    if (name) groupNames[groupId] = name;
  });
  state.groupNames = groupNames;
}

function safeSvgId(value) {
  return String(value || "object").replace(/[^a-z0-9_-]/gi, "-");
}

function splitLongWord(word, maximumCharacters) {
  const pieces = [];
  for (let index = 0; index < word.length; index += maximumCharacters) {
    pieces.push(word.slice(index, index + maximumCharacters));
  }
  return pieces.length ? pieces : [""];
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatNumber(value) {
  return String(Math.round(finiteNumber(value, 0) * 1000) / 1000);
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeXmlAttr(value) {
  return escapeXmlText(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function escapeXmlText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeXmlText(value) {
  return String(value || "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
