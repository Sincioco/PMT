import {
  buildAnnotationSvg,
  normalizeAnnotationState,
  normalizeAnnotationTemplateLibrary,
  parseAnnotationSvg
} from "../components/image-annotation.js?v=20260725-field-mapping-v33";

export const pmtDiagramFileFormat = "pmt-diagram";
export const pmtDiagramFileVersion = 1;
export const diagramSelectionClipboardFormat = "pmt-diagram-selection";
export const diagramSelectionClipboardVersion = 1;
export const diagramSelectionClipboardPlainTextHeader = "PMT_DIAGRAM_SELECTION_V1";

export const diagramSharedDocumentContract = Object.freeze({
  documentType: "Diagram",
  resource: "Documentation",
  duplicateDatabaseRecords: false,
  endpoints: Object.freeze({
    templateLibrary: "/api/image-annotation/template-library",
    defaultTemplateLibrary: "/api/image-annotation/default-template-library"
  })
});

export const diagramCompatibilityCapabilities = Object.freeze({
  canonicalState: true,
  pmtDiagramFile: true,
  selectionClipboard: true,
  objectTemplates: true,
  sharedDocumentRecords: true,
  persistedRendererCaches: false,
  compatibleFeatures: Object.freeze(["Diagram", "Diagram 2"])
});

export function normalizeDiagramState(input, fallback = {}) {
  return normalizeAnnotationState(input, fallback);
}

export function normalizeDiagramTemplateLibrary(input) {
  return normalizeAnnotationTemplateLibrary(input);
}

export function createPmtDiagramFile({
  title,
  state: stateInput,
  svg: svgInput,
  exportedAt,
  generator,
  generatorFeature,
  diagramExtensions,
  extensions
} = {}) {
  const state = normalizeDiagramState(stateInput || parseAnnotationSvg(svgInput));
  const svg = String(svgInput || buildAnnotationSvg(state));
  return JSON.stringify({
    format: pmtDiagramFileFormat,
    formatVersion: pmtDiagramFileVersion,
    minimumReaderVersion: 1,
    exportedAt: String(exportedAt || new Date().toISOString()),
    generator: {
      name: String(generator?.name || "PMT").trim() || "PMT",
      feature: String(generatorFeature || generator?.feature || "Diagram").trim() || "Diagram"
    },
    diagram: {
      title: String(title || "Diagram").trim() || "Diagram",
      editorState: state,
      svg,
      extensions: plainObject(diagramExtensions)
    },
    extensions: plainObject(extensions)
  }, null, 2);
}

export function parsePmtDiagramFile(contents) {
  let file;
  try {
    file = JSON.parse(String(contents || ""));
  } catch {
    throw new Error("The selected file is not valid PMT Diagram JSON.");
  }
  if (file?.format !== pmtDiagramFileFormat) throw new Error("The selected file is not a PMT Diagram file.");
  const version = Number(file?.formatVersion || 0);
  if (!Number.isInteger(version) || version < 1 || version > pmtDiagramFileVersion) {
    throw new Error(`PMT Diagram file version ${version || "unknown"} is not supported.`);
  }
  const minimumReaderVersion = Number(file?.minimumReaderVersion || 1);
  if (Number.isInteger(minimumReaderVersion) && minimumReaderVersion > pmtDiagramFileVersion) {
    throw new Error(`PMT Diagram file reader version ${minimumReaderVersion} is not supported.`);
  }
  const state = file?.diagram?.editorState
    ? normalizeDiagramState(file.diagram.editorState)
    : parseAnnotationSvg(file?.diagram?.svg);
  if (!state) throw new Error("The PMT Diagram file does not contain editable Diagram data.");
  return {
    title: String(file?.diagram?.title || "Imported Diagram").trim() || "Imported Diagram",
    state,
    svg: buildAnnotationSvg(state),
    formatVersion: version,
    minimumReaderVersion,
    generator: plainObject(file?.generator),
    diagramExtensions: plainObject(file?.diagram?.extensions),
    extensions: plainObject(file?.extensions)
  };
}

export function canDiagramFeatureReadPmtDiagramFile(feature, contents) {
  if (!diagramCompatibilityCapabilities.compatibleFeatures.includes(feature)) return false;
  try {
    parsePmtDiagramFile(contents);
    return true;
  } catch {
    return false;
  }
}

export function createDiagramSelectionClipboardPackage({
  state: stateInput,
  selectedObjectIds,
  sourceFeature = "Diagram",
  selectionExtensions,
  extensions
} = {}) {
  const state = normalizeDiagramState(stateInput);
  const selectedIds = iterableSet(selectedObjectIds);
  const objects = state.objects
    .filter(object => selectedIds.has(object.id))
    .map(deepClone);
  const groupIds = new Set(objects.map(object => object.groupId).filter(Boolean));
  const relationships = diagramSelectionRelationships(objects);
  const manualRelationshipRoutes = {};
  relationships.forEach(relationship => {
    if (relationship.routeOverride?.length) {
      manualRelationshipRoutes[relationship.id] = deepClone(relationship.routeOverride);
    }
  });

  return normalizeDiagramSelectionClipboardPackage({
    format: diagramSelectionClipboardFormat,
    formatVersion: diagramSelectionClipboardVersion,
    minimumReaderVersion: 1,
    source: {
      application: "PMT",
      feature: sourceFeature
    },
    selection: {
      objects,
      relationships,
      manualRelationshipRoutes,
      groupNames: groupEntries(state.groupNames, groupIds),
      groupVisibility: groupEntries(state.groupVisibility, groupIds),
      extensions: plainObject(selectionExtensions)
    },
    extensions: plainObject(extensions)
  });
}

export function serializeDiagramSelectionClipboardPackage(packageInput) {
  const normalized = normalizeDiagramSelectionClipboardPackage(packageInput);
  return `${diagramSelectionClipboardPlainTextHeader}\n${JSON.stringify(normalized)}`;
}

export function parseDiagramSelectionClipboardPackage(contents) {
  const text = String(contents || "").trim();
  const json = text.startsWith(diagramSelectionClipboardPlainTextHeader)
    ? text.slice(diagramSelectionClipboardPlainTextHeader.length).trim()
    : text;
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("The clipboard does not contain a PMT Diagram selection.");
  }
  return normalizeDiagramSelectionClipboardPackage(parsed);
}

export function normalizeDiagramSelectionClipboardPackage(input) {
  if (input?.format !== diagramSelectionClipboardFormat) {
    throw new Error("The clipboard does not contain a PMT Diagram selection.");
  }
  const version = Number(input?.formatVersion || 0);
  if (!Number.isInteger(version) || version < 1 || version > diagramSelectionClipboardVersion) {
    throw new Error(`PMT Diagram selection version ${version || "unknown"} is not supported.`);
  }
  const minimumReaderVersion = Number(input?.minimumReaderVersion || 1);
  if (Number.isInteger(minimumReaderVersion) && minimumReaderVersion > diagramSelectionClipboardVersion) {
    throw new Error(`PMT Diagram selection reader version ${minimumReaderVersion} is not supported.`);
  }
  const selection = input.selection && typeof input.selection === "object" ? input.selection : {};
  const state = normalizeDiagramState({
    width: 1,
    height: 1,
    objects: Array.isArray(selection.objects) ? selection.objects : []
  });
  const objectIds = new Set(state.objects.map(object => object.id));
  return {
    format: diagramSelectionClipboardFormat,
    formatVersion: diagramSelectionClipboardVersion,
    minimumReaderVersion,
    source: {
      application: String(input.source?.application || "PMT").trim() || "PMT",
      feature: String(input.source?.feature || "Diagram").trim() || "Diagram"
    },
    selection: {
      objects: state.objects,
      relationships: (Array.isArray(selection.relationships) ? selection.relationships : [])
        .map(normalizeDiagramSelectionRelationship)
        .filter(relationship => relationship && objectIds.has(relationship.sourceObjectId) && objectIds.has(relationship.targetObjectId)),
      manualRelationshipRoutes: normalizeManualRelationshipRoutes(selection.manualRelationshipRoutes),
      groupNames: plainObject(selection.groupNames),
      groupVisibility: plainObject(selection.groupVisibility),
      extensions: plainObject(selection.extensions)
    },
    extensions: plainObject(input.extensions)
  };
}

export function remapDiagramSelectionClipboardPackageIds(packageInput, options = {}) {
  const source = normalizeDiagramSelectionClipboardPackage(packageInput);
  const existingIds = iterableSet(options.existingObjectIds);
  const usedIds = new Set(existingIds);
  const idMap = new Map();
  const idFactory = typeof options.idFactory === "function"
    ? options.idFactory
    : oldId => `${oldId}-copy`;
  source.selection.objects.forEach((object, index) => {
    const preferred = idFactory(object.id, object.type, index);
    const nextId = uniqueIdentifier(preferred, usedIds, `${object.type || "object"}-${index + 1}`);
    idMap.set(object.id, nextId);
    usedIds.add(nextId);
  });

  const groupIdMap = diagramGroupIdMap(source.selection.objects, source.selection.groupNames, source.selection.groupVisibility);
  const pasteIndex = Math.max(0, Number(options.pasteIndex || 1));
  const pasteOffset = options.pasteOffset && typeof options.pasteOffset === "object" ? options.pasteOffset : {};
  const dx = finiteNumber(pasteOffset.x, 24) * pasteIndex;
  const dy = finiteNumber(pasteOffset.y, 24) * pasteIndex;
  const originalEntityReferenceKeys = entityReferenceKeys(source.selection.objects);
  const objects = source.selection.objects.map(object =>
    remapDiagramObject(object, idMap, groupIdMap, originalEntityReferenceKeys, dx, dy)
  );
  const relationships = source.selection.relationships
    .filter(relationship => idMap.has(relationship.sourceObjectId) && idMap.has(relationship.targetObjectId))
    .map(relationship => {
      const next = {
        ...relationship,
        id: relationshipId(
          idMap.get(relationship.sourceObjectId),
          relationship.sourceFields,
          idMap.get(relationship.targetObjectId),
          relationship.targetFields
        ),
        sourceObjectId: idMap.get(relationship.sourceObjectId),
        targetObjectId: idMap.get(relationship.targetObjectId)
      };
      if (next.routeOverride?.length) next.routeOverride = offsetRoute(next.routeOverride, dx, dy);
      return next;
    });
  const manualRelationshipRoutes = {};
  relationships.forEach(relationship => {
    const original = source.selection.relationships.find(item =>
      idMap.get(item.sourceObjectId) === relationship.sourceObjectId
      && idMap.get(item.targetObjectId) === relationship.targetObjectId
      && sameList(item.sourceFields, relationship.sourceFields)
      && sameList(item.targetFields, relationship.targetFields)
    );
    const route = source.selection.manualRelationshipRoutes[original?.id];
    if (route?.length) manualRelationshipRoutes[relationship.id] = offsetRoute(route, dx, dy);
  });

  return normalizeDiagramSelectionClipboardPackage({
    ...source,
    selection: {
      ...source.selection,
      objects,
      relationships,
      manualRelationshipRoutes,
      groupNames: remapRecordKeys(source.selection.groupNames, groupIdMap),
      groupVisibility: remapRecordKeys(source.selection.groupVisibility, groupIdMap)
    }
  });
}

function diagramSelectionRelationships(objects) {
  const entitiesByReference = entitiesByReferenceKey(objects);
  const relationships = [];
  objects
    .filter(object => object.type === "entity")
    .forEach(source => {
      (source.foreignKeys || []).forEach(foreignKey => {
        const target = entitiesByReference.get(entityReferenceKey(foreignKey.referencedSchema, foreignKey.referencedTable));
        if (!target) return;
        const sourceFields = arrayOfStrings(foreignKey.columns);
        const targetFields = arrayOfStrings(foreignKey.referencedColumns);
        const routeOverride = normalizeRoute(foreignKey.routeOverride);
        relationships.push({
          id: relationshipId(source.id, sourceFields, target.id, targetFields),
          sourceObjectId: source.id,
          sourceFields,
          targetObjectId: target.id,
          targetEntity: entityReferenceLabel(foreignKey.referencedSchema, foreignKey.referencedTable),
          targetFields,
          relationshipType: String(foreignKey.relationshipType || ""),
          ...(foreignKey.styleOverride ? { styleOverride: deepClone(foreignKey.styleOverride) } : {}),
          ...(routeOverride.length ? { routeOverride } : {})
        });
      });
    });
  return relationships;
}

function normalizeDiagramSelectionRelationship(input) {
  if (!input || typeof input !== "object") return null;
  const sourceObjectId = String(input.sourceObjectId || "").trim();
  const targetObjectId = String(input.targetObjectId || "").trim();
  const sourceFields = arrayOfStrings(input.sourceFields);
  const targetFields = arrayOfStrings(input.targetFields);
  if (!sourceObjectId || !targetObjectId) return null;
  return {
    id: String(input.id || relationshipId(sourceObjectId, sourceFields, targetObjectId, targetFields)).trim(),
    sourceObjectId,
    sourceFields,
    targetObjectId,
    targetEntity: String(input.targetEntity || "").trim(),
    targetFields,
    relationshipType: String(input.relationshipType || "").trim(),
    ...(input.styleOverride && typeof input.styleOverride === "object" ? { styleOverride: plainObject(input.styleOverride) } : {}),
    ...(normalizeRoute(input.routeOverride).length ? { routeOverride: normalizeRoute(input.routeOverride) } : {})
  };
}

function remapDiagramObject(input, idMap, groupIdMap, originalEntityReferenceKeys, dx, dy) {
  const object = deepClone(input);
  object.id = idMap.get(input.id) || input.id;
  if (object.groupId) object.groupId = groupIdMap.get(object.groupId) || "";
  if (object.entityAnnotationGroupId) object.entityAnnotationGroupId = groupIdMap.get(object.entityAnnotationGroupId) || "";
  if (object.entityAnnotationOwnerId) object.entityAnnotationOwnerId = idMap.get(object.entityAnnotationOwnerId) || "";
  if (object.sourceImageId) object.sourceImageId = idMap.get(object.sourceImageId) || "";
  if (Array.isArray(object.rows)) {
    object.rows = object.rows.map(row => ({
      ...row,
      uiEntityId: row.uiEntityId ? idMap.get(row.uiEntityId) || "" : ""
    }));
  }
  if (Array.isArray(object.foreignKeys)) {
    object.foreignKeys = object.foreignKeys
      .filter(foreignKey => originalEntityReferenceKeys.has(entityReferenceKey(foreignKey.referencedSchema, foreignKey.referencedTable)))
      .map(foreignKey => ({
        ...foreignKey,
        ...(normalizeRoute(foreignKey.routeOverride).length ? { routeOverride: offsetRoute(foreignKey.routeOverride, dx, dy) } : {})
      }));
  }
  offsetObjectGeometry(object, dx, dy);
  return object;
}

function offsetObjectGeometry(object, dx, dy) {
  if (Number.isFinite(object.x)) object.x += dx;
  if (Number.isFinite(object.y)) object.y += dy;
  if (Number.isFinite(object.x1)) object.x1 += dx;
  if (Number.isFinite(object.y1)) object.y1 += dy;
  if (Number.isFinite(object.x2)) object.x2 += dx;
  if (Number.isFinite(object.y2)) object.y2 += dy;
  if (object.imageClip && typeof object.imageClip === "object") {
    if (Number.isFinite(object.imageClip.x)) object.imageClip.x += dx;
    if (Number.isFinite(object.imageClip.y)) object.imageClip.y += dy;
  }
}

function entitiesByReferenceKey(objects) {
  const map = new Map();
  objects
    .filter(object => object.type === "entity")
    .forEach(object => {
      map.set(entityReferenceKey(object.entitySchema, object.entityName), object);
    });
  return map;
}

function entityReferenceKeys(objects) {
  return new Set(
    objects
      .filter(object => object.type === "entity")
      .map(object => entityReferenceKey(object.entitySchema, object.entityName))
  );
}

function entityReferenceKey(schema, name) {
  return `${String(schema || "").trim().toLowerCase()}.${String(name || "").trim().toLowerCase()}`;
}

function entityReferenceLabel(schema, name) {
  return [schema, name].map(value => String(value || "").trim()).filter(Boolean).join(".");
}

function relationshipId(sourceObjectId, sourceFields, targetObjectId, targetFields) {
  return `${sourceObjectId}:${sourceFields.join("+")}->${targetObjectId}:${targetFields.join("+")}`;
}

function diagramGroupIdMap(objects, groupNames, groupVisibility) {
  const groupIds = new Set([
    ...objects.map(object => object.groupId).filter(Boolean),
    ...objects.map(object => object.entityAnnotationGroupId).filter(Boolean),
    ...Object.keys(groupNames || {}),
    ...Object.keys(groupVisibility || {})
  ]);
  const map = new Map();
  groupIds.forEach(groupId => map.set(groupId, `${groupId}-copy`));
  return map;
}

function groupEntries(source, groupIds) {
  const entries = {};
  if (!source || typeof source !== "object") return entries;
  groupIds.forEach(groupId => {
    if (Object.hasOwn(source, groupId)) entries[groupId] = deepClone(source[groupId]);
  });
  return entries;
}

function remapRecordKeys(source, keyMap) {
  const result = {};
  Object.entries(plainObject(source)).forEach(([key, value]) => {
    result[keyMap.get(key) || key] = value;
  });
  return result;
}

function normalizeManualRelationshipRoutes(input) {
  const result = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  Object.entries(input).forEach(([key, route]) => {
    const normalizedRoute = normalizeRoute(route);
    if (normalizedRoute.length) result[key] = normalizedRoute;
  });
  return result;
}

function normalizeRoute(input) {
  return Array.isArray(input)
    ? input
        .map(point => ({
          x: finiteNumber(point?.x, NaN),
          y: finiteNumber(point?.y, NaN)
        }))
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
}

function offsetRoute(input, dx, dy) {
  return normalizeRoute(input).map(point => ({ x: point.x + dx, y: point.y + dy }));
}

function arrayOfStrings(input) {
  return Array.isArray(input)
    ? input.map(value => String(value || "").trim()).filter(Boolean)
    : [];
}

function iterableSet(input) {
  return new Set(input && typeof input[Symbol.iterator] === "function" ? [...input].map(String) : []);
}

function uniqueIdentifier(preferred, usedIds, fallback) {
  const base = sanitizeIdentifier(preferred) || sanitizeIdentifier(fallback) || "diagram-object";
  let candidate = base;
  let suffix = 1;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function sanitizeIdentifier(value) {
  return String(value || "").trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function sameList(left, right) {
  const leftValues = arrayOfStrings(left);
  const rightValues = arrayOfStrings(right);
  return leftValues.length === rightValues.length && leftValues.every((value, index) => value === rightValues[index]);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? deepClone(value) : {};
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
