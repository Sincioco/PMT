import {
  buildAnnotationSvg,
  normalizeAnnotationState,
  normalizeAnnotationTemplateLibrary,
  parseAnnotationSvg,
  parseAnnotationSvgMetadata,
  pmtDiagramFileExtensionsStateKey
} from "../components/image-annotation.js?v=20260802-diagram2-phase7-roundtrip-v1";

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
  const normalized = normalizeAnnotationTemplateLibrary(input);
  const source = input && typeof input === "object" ? input : {};
  const sourceTemplates = Array.isArray(source.templates) ? source.templates : [];
  const result = {
    ...normalized,
    templates: normalized.templates.map(template => {
      const sourceTemplate = sourceTemplates.find(item => String(item?.id || "") === template.id);
      if (!sourceTemplate || !Object.hasOwn(sourceTemplate, "extensions")) return template;
      return {
        ...template,
        extensions: plainObject(sourceTemplate.extensions)
      };
    })
  };
  if (Object.hasOwn(source, "extensions")) result.extensions = plainObject(source.extensions);
  return result;
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
  const retainedExtensions = pmtDiagramFileExtensionsFromState(state);
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
      extensions: plainObject(diagramExtensions === undefined
        ? retainedExtensions.diagram
        : diagramExtensions)
    },
    extensions: plainObject(extensions === undefined
      ? retainedExtensions.file
      : extensions)
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
  const minimumReaderVersion = Object.hasOwn(file, "minimumReaderVersion")
    ? Number(file.minimumReaderVersion)
    : 1;
  if (!Number.isInteger(minimumReaderVersion)
    || minimumReaderVersion < 1
    || minimumReaderVersion > pmtDiagramFileVersion) {
    throw new Error(`PMT Diagram file reader version ${minimumReaderVersion} is not supported.`);
  }
  const sourceState = file?.diagram?.editorState
    || parseAnnotationSvgMetadata(file?.diagram?.svg);
  if (!sourceState) throw new Error("The PMT Diagram file does not contain editable Diagram data.");
  validatePmtDiagramState(sourceState);
  const extensionCarrier = pmtDiagramFileExtensionCarrier(
    file?.diagram?.extensions,
    file?.extensions
  );
  const state = normalizeDiagramState(extensionCarrier
    ? { ...sourceState, [pmtDiagramFileExtensionsStateKey]: extensionCarrier }
    : sourceState);
  const sourceObjectCount = Array.isArray(sourceState.objects) ? sourceState.objects.length : 0;
  if (state.objects.length !== sourceObjectCount) {
    throw new Error("The PMT Diagram file contains an invalid Diagram object.");
  }
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

function validatePmtDiagramState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The PMT Diagram file does not contain editable Diagram data.");
  }
  const objects = Array.isArray(input.objects) ? input.objects : [];
  const objectsById = new Map();
  const groupIds = new Set();

  objects.forEach((object, index) => {
    if (!object || typeof object !== "object" || Array.isArray(object)) {
      throw new Error(`The PMT Diagram file object ${index + 1} is invalid.`);
    }
    if (typeof object.id !== "string" || !object.id.trim()) {
      throw new Error(`The PMT Diagram file object ${index + 1} must have an explicit non-empty ID.`);
    }
    const id = object.id.trim();
    if (!validPmtDiagramId(id)) {
      throw new Error(`The PMT Diagram file object ID "${id}" is not valid.`);
    }
    if (objectsById.has(id)) {
      throw new Error(`The PMT Diagram file contains duplicate object ID "${id}".`);
    }
    objectsById.set(id, object);

    const groupId = String(object.groupId || "").trim();
    if (groupId) {
      if (!validPmtDiagramId(groupId)) {
        throw new Error(`The PMT Diagram file object "${id}" has an invalid groupId "${groupId}".`);
      }
      groupIds.add(groupId);
    }
  });

  validatePmtDiagramGroupReferences(input.groupNames, "groupNames", groupIds);
  validatePmtDiagramGroupReferences(input.groupVisibility, "groupVisibility", groupIds);

  objects.forEach(object => {
    const objectId = object.id.trim();
    const objectType = String(object.type || "").toLowerCase();
    const ownerId = String(object.entityAnnotationOwnerId || "").trim();
    if (ownerId) {
      requirePmtDiagramObjectReference(
        objectsById,
        objectId,
        "entityAnnotationOwnerId",
        ownerId,
        target => String(target.type || "").toLowerCase() === "entity",
        "Entity"
      );
      const annotationRole = String(object.entityAnnotationRole || "").toLowerCase();
      const expectedType = annotationRole === "callout"
        ? "textbox"
        : annotationRole === "arrow"
          ? "arrow"
          : "";
      if (!expectedType || objectType !== expectedType) {
        throw new Error(`The PMT Diagram file object "${objectId}" has an invalid Entity annotation role or type.`);
      }
    }

    const annotationGroupId = String(object.entityAnnotationGroupId || "").trim();
    if (annotationGroupId && !groupIds.has(annotationGroupId)) {
      throw new Error(`The PMT Diagram file object "${objectId}" references missing group "${annotationGroupId}" through entityAnnotationGroupId.`);
    }

    const sourceImageId = String(object.sourceImageId || "").trim();
    if (sourceImageId) {
      requirePmtDiagramObjectReference(
        objectsById,
        objectId,
        "sourceImageId",
        sourceImageId,
        target => String(target.type || "").toLowerCase() === "embedded-image",
        "Embedded Image"
      );
    }

    if (objectType === "entity") {
      validatePmtDiagramEntityRelationships(object, objects);
    }

    if (objectType === "field-mapping-table" && object.rows != null && !Array.isArray(object.rows)) {
      throw new Error(`The PMT Diagram file object "${objectId}" has an invalid Field Mapping rows value.`);
    }
    (Array.isArray(object.rows) ? object.rows : []).forEach((row, rowIndex) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(`The PMT Diagram file object "${objectId}" has an invalid Field Mapping row ${rowIndex + 1}.`);
      }
      const uiEntityId = String(row?.uiEntityId || "").trim();
      if (!uiEntityId) return;
      const fieldRectangle = requirePmtDiagramObjectReference(
        objectsById,
        objectId,
        `rows[${rowIndex}].uiEntityId`,
        uiEntityId,
        target => String(target.type || "").toLowerCase() === "entity"
          && String(target.entityKind || "").toLowerCase() === "field-rectangle",
        "Field Rectangle"
      );
      const uiField = pmtDiagramIdentifierKey(row.uiField || row.ui);
      const targetFields = new Set((Array.isArray(fieldRectangle.fields) ? fieldRectangle.fields : [])
        .map(field => pmtDiagramIdentifierKey(field?.name))
        .filter(Boolean));
      if (uiField && targetFields.size && !targetFields.has(uiField)) {
        throw new Error(`The PMT Diagram file object "${objectId}" Field Mapping row ${rowIndex + 1} references missing UI field "${String(row.uiField || row.ui).trim()}".`);
      }
    });
  });
}

function validatePmtDiagramEntityRelationships(entity, objects) {
  const entityId = String(entity.id || "").trim();
  if (entity.fields != null && !Array.isArray(entity.fields)) {
    throw new Error(`The PMT Diagram file Entity "${entityId}" has an invalid fields value.`);
  }
  if (entity.foreignKeys != null && !Array.isArray(entity.foreignKeys)) {
    throw new Error(`The PMT Diagram file Entity "${entityId}" has an invalid relationships value.`);
  }
  const sourceFields = new Set((Array.isArray(entity.fields) ? entity.fields : [])
    .map(field => pmtDiagramIdentifierKey(field?.name))
    .filter(Boolean));

  (Array.isArray(entity.foreignKeys) ? entity.foreignKeys : []).forEach((foreignKey, index) => {
    if (!foreignKey || typeof foreignKey !== "object" || Array.isArray(foreignKey)) {
      throw new Error(`The PMT Diagram file Entity "${entityId}" relationship ${index + 1} is invalid.`);
    }
    const columns = Array.isArray(foreignKey.columns)
      ? foreignKey.columns.map(pmtDiagramIdentifierKey).filter(Boolean)
      : [];
    const referencedTable = pmtDiagramIdentifierKey(foreignKey.referencedTable);
    if (!columns.length || !referencedTable) {
      throw new Error(`The PMT Diagram file Entity "${entityId}" relationship ${index + 1} is incomplete.`);
    }
    const missingSourceColumn = columns.find(column => !sourceFields.has(column));
    if (missingSourceColumn) {
      throw new Error(`The PMT Diagram file Entity "${entityId}" relationship ${index + 1} references missing source field "${missingSourceColumn}".`);
    }
    const relationshipType = String(foreignKey.relationshipType || "").trim().toLowerCase();
    if (relationshipType && !["one-to-one", "one-to-many", "many-to-one"].includes(relationshipType)) {
      throw new Error(`The PMT Diagram file Entity "${entityId}" relationship ${index + 1} has an invalid relationship type.`);
    }

    const referencedSchema = pmtDiagramIdentifierKey(foreignKey.referencedSchema);
    const internalTargets = objects.filter(candidate =>
      String(candidate?.type || "").toLowerCase() === "entity"
      && pmtDiagramIdentifierKey(candidate.entityName) === referencedTable
      && (!referencedSchema || pmtDiagramIdentifierKey(candidate.entitySchema) === referencedSchema));
    const referencedColumns = Array.isArray(foreignKey.referencedColumns)
      ? foreignKey.referencedColumns.map(pmtDiagramIdentifierKey).filter(Boolean)
      : [];
    if (!internalTargets.length || !referencedColumns.length) return;
    const targetFields = new Set(internalTargets.flatMap(target =>
      (Array.isArray(target.fields) ? target.fields : [])
        .map(field => pmtDiagramIdentifierKey(field?.name))
        .filter(Boolean)));
    const missingTargetColumn = referencedColumns.find(column => !targetFields.has(column));
    if (missingTargetColumn) {
      throw new Error(`The PMT Diagram file Entity "${entityId}" relationship ${index + 1} references missing target field "${missingTargetColumn}".`);
    }
  });
}

function validatePmtDiagramGroupReferences(input, property, groupIds) {
  if (input == null) return;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`The PMT Diagram file ${property} value is invalid.`);
  }
  Object.keys(input).forEach(groupId => {
    if (!validPmtDiagramId(groupId) || !groupIds.has(groupId)) {
      throw new Error(`The PMT Diagram file ${property} references missing group "${groupId}".`);
    }
  });
}

function requirePmtDiagramObjectReference(objectsById, objectId, property, targetId, predicate, targetType) {
  const target = objectsById.get(targetId);
  if (!target || !predicate(target)) {
    throw new Error(`The PMT Diagram file object "${objectId}" ${property} references missing ${targetType} object "${targetId}".`);
  }
  return target;
}

function validPmtDiagramId(value) {
  return /^[a-z0-9_-]{1,120}$/i.test(String(value || ""));
}

function pmtDiagramIdentifierKey(value) {
  return String(value || "").trim().replace(/^\[([^\]]+)\]$|^"([^"]+)"$|^`([^`]+)`$/u, "$1$2$3").toLowerCase();
}

function pmtDiagramFileExtensionCarrier(diagramExtensions, fileExtensions) {
  const diagram = plainObject(diagramExtensions);
  const file = plainObject(fileExtensions);
  return Object.keys(diagram).length || Object.keys(file).length
    ? { diagram, file }
    : null;
}

function pmtDiagramFileExtensionsFromState(state) {
  const carrier = state?.[pmtDiagramFileExtensionsStateKey];
  return {
    diagram: plainObject(carrier?.diagram),
    file: plainObject(carrier?.file)
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
  const minimumReaderVersion = Object.hasOwn(input, "minimumReaderVersion")
    ? Number(input.minimumReaderVersion)
    : 1;
  if (!Number.isInteger(minimumReaderVersion)
    || minimumReaderVersion < 1
    || minimumReaderVersion > diagramSelectionClipboardVersion) {
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
