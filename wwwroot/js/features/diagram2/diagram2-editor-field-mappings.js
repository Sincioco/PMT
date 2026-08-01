import { formatAnnotationEntityIdentifier } from "../../components/image-annotation.js?v=20260731-rte-checkbox-layout-v2";
import {
  diagram2FieldMappingIdentity,
  diagram2FieldRectangleMapping,
  isDiagram2FieldRectangle
} from "./diagram2-editor-field-rectangles.js?v=20260731-rte-checkbox-layout-v2";

export function createDiagram2FieldMappingIndexes(objectsInput = []) {
  const objects = Array.isArray(objectsInput) ? objectsInput : [];
  const indexes = createEmptyIndexes();

  objects.forEach(object => installBasicObject(indexes, object));
  indexes.fieldRectanglesById.forEach(fieldRectangle => indexFieldRectangle(indexes, fieldRectangle));
  indexes.tablesById.forEach(table => indexTable(indexes, table));
  indexes.fullBuildCount = 1;
  indexes.fullBuildObjectVisitCount = objects.length;
  return indexes;
}

export function patchDiagram2FieldMappingIndexes(indexesInput, changesInput = []) {
  const indexes = indexesInput?.objectsById instanceof Map
    ? indexesInput
    : createDiagram2FieldMappingIndexes();
  const changes = (Array.isArray(changesInput) ? changesInput : [changesInput])
    .map(change => normalizeIndexChange(indexes, change))
    .filter(Boolean);
  if (!changes.length) {
    return {
      indexes,
      changedObjectCount: 0,
      affectedFieldRectangleIds: [],
      affectedTableIds: [],
      objectVisitCount: 0
    };
  }

  const affectedFieldRectangleIds = new Set();
  const affectedTableIds = new Set();
  let objectVisitCount = 0;

  changes.forEach(({ previousObject, nextObject }) => {
    [previousObject, nextObject].filter(Boolean).forEach(object => {
      if (isDiagram2FieldRectangle(object)) {
        affectedFieldRectangleIds.add(object.id);
        (indexes.tableIdsByFieldRectangleId.get(object.id) || [])
          .forEach(id => affectedTableIds.add(id));
        return;
      }
      if (isMappingEntity(object)) {
        const reference = diagram2EntityReference(object);
        (indexes.fieldRectangleIdsByEntityReference.get(reference) || [])
          .forEach(id => affectedFieldRectangleIds.add(id));
        (indexes.mappingIdsByTargetEntityId.get(object.id) || [])
          .map(id => indexes.mappingsById.get(id)?.sourceId)
          .filter(Boolean)
          .forEach(id => affectedFieldRectangleIds.add(id));
        return;
      }
      if (object.type === "embedded-image") {
        (indexes.fieldRectangleIdsByImageId.get(object.id) || [])
          .forEach(id => affectedFieldRectangleIds.add(id));
        indexes.fieldRectanglesById.forEach(fieldRectangle => {
          objectVisitCount += 1;
          if (boundsIntersect(objectBounds(fieldRectangle), effectiveImageBounds(object))) {
            affectedFieldRectangleIds.add(fieldRectangle.id);
          }
        });
        return;
      }
      if (object.type === "field-mapping-table") {
        affectedTableIds.add(object.id);
        (Array.isArray(object.rows) ? object.rows : [])
          .map(row => String(row?.uiEntityId || "").trim())
          .filter(Boolean)
          .forEach(id => affectedFieldRectangleIds.add(id));
      }
    });
  });

  affectedFieldRectangleIds.forEach(id => {
    (indexes.tableIdsByFieldRectangleId.get(id) || []).forEach(tableId => affectedTableIds.add(tableId));
  });
  affectedTableIds.forEach(id => unindexTable(indexes, indexes.tablesById.get(id)));
  affectedFieldRectangleIds.forEach(id => unindexFieldRectangle(indexes, indexes.fieldRectanglesById.get(id)));

  changes.forEach(({ previousObject }) => removeBasicObject(indexes, previousObject));
  changes.forEach(({ nextObject }) => installBasicObject(indexes, nextObject));

  affectedFieldRectangleIds.forEach(id => {
    const fieldRectangle = indexes.fieldRectanglesById.get(id);
    if (fieldRectangle) indexFieldRectangle(indexes, fieldRectangle);
  });
  affectedTableIds.forEach(id => {
    const table = indexes.tablesById.get(id);
    if (table) indexTable(indexes, table);
  });

  indexes.incrementalPatchCount += 1;
  indexes.incrementalObjectVisitCount += objectVisitCount;
  return {
    indexes,
    changedObjectCount: changes.length,
    affectedFieldRectangleIds: [...affectedFieldRectangleIds],
    affectedTableIds: [...affectedTableIds],
    objectVisitCount
  };
}

export function diagram2FieldMappingRowKey(tableId, mappingId) {
  return `${String(tableId || "").trim()}:${String(mappingId || "").trim()}`;
}

export function diagram2EntityReference(entity) {
  return normalizeEntityReference([entity?.entitySchema, entity?.entityName].filter(Boolean).join("."));
}

export function diagram2NormalizeEntityReference(value) {
  return normalizeEntityReference(value);
}

export function diagram2EntityFieldMappingKey(entityId, fieldName) {
  const id = String(entityId || "").trim();
  const field = normalizeIdentifier(fieldName);
  return id && field ? `${id}:${field}` : "";
}

export function diagram2MappingAttentionTargets(indexes, mappingIdInput) {
  const mappingId = String(mappingIdInput || "").trim();
  const indexed = indexes?.highlightTargetsByMappingId?.get(mappingId);
  if (indexed) {
    return {
      ...indexed,
      tableRowKeys: [...indexed.tableRowKeys]
    };
  }
  const mapping = indexes?.mappingsById?.get(mappingId);
  if (!mapping) return null;
  return {
    mappingId,
    sourceId: mapping.sourceId,
    targetId: mapping.targetId,
    sourceImageIds: [],
    tableRowKeys: []
  };
}

export function setDiagram2FieldMappingRouteIndex(indexes, mappingIdInput, routeInput = null) {
  const mappingId = String(mappingIdInput || "").trim();
  if (!mappingId || !indexes?.mappingsById?.has(mappingId)) return false;
  const relationshipId = String(routeInput?.relationshipId || "").trim();
  if (relationshipId) indexes.relationshipIdByMappingId.set(mappingId, relationshipId);
  else indexes.relationshipIdByMappingId.delete(mappingId);
  const bounds = normalizeBounds(routeInput?.bounds);
  if (bounds) indexes.mappingRouteBoundsById.set(mappingId, bounds);
  else indexes.mappingRouteBoundsById.delete(mappingId);
  return true;
}

export function diagram2FieldMappingIndexDiagnostics(indexes) {
  return {
    mappingCount: indexes?.mappingsById?.size || 0,
    mappingTargetFieldIndexCount: indexes?.mappingIdsByEntityField?.size || 0,
    mappingSourceImageIndexCount: indexes?.mappingIdsBySourceImageId?.size || 0,
    mappingTableIndexCount: indexes?.mappingIdsByTableId?.size || 0,
    mappingRowIndexCount: indexes?.highlightTargetsByRowKey?.size || 0,
    mappingRouteIndexCount: indexes?.mappingRouteBoundsById?.size || 0,
    mappingIndexFullBuildCount: finiteNumber(indexes?.fullBuildCount, 0),
    mappingIndexFullBuildObjectVisitCount: finiteNumber(indexes?.fullBuildObjectVisitCount, 0),
    mappingIndexIncrementalPatchCount: finiteNumber(indexes?.incrementalPatchCount, 0),
    mappingIndexIncrementalObjectVisitCount: finiteNumber(indexes?.incrementalObjectVisitCount, 0)
  };
}

export function diagram2FieldMappingPaneGroups(indexes, options = {}) {
  if (!(indexes?.mappingsById instanceof Map)) return [];
  const tableIdByMappingId = new Map();
  const tables = [...(indexes.tablesById?.values?.() || [])]
    .sort((left, right) => finiteNumber(left?.y, 0) - finiteNumber(right?.y, 0)
      || finiteNumber(left?.x, 0) - finiteNumber(right?.x, 0)
      || String(left?.name || "").localeCompare(String(right?.name || "")));

  tables.forEach(table => {
    const mappingIds = table.sourceImageId
      ? indexes.mappingIdsBySourceImageId?.get(table.sourceImageId) || []
      : indexes.mappingIdsByTableId?.get(table.id) || [];
    mappingIds.forEach(mappingId => {
      if (!tableIdByMappingId.has(mappingId)) {
        tableIdByMappingId.set(mappingId, String(table.id || ""));
      }
    });
  });

  const search = String(options.search || "").trim().toLowerCase();
  const rows = diagram2FieldMappingPaneRows(
    indexes,
    [...indexes.mappingsById.keys()],
    tableIdByMappingId
  ).filter(row => !search
    || row.uiField.toLowerCase().includes(search)
    || row.databaseField.toLowerCase().includes(search));
  if (!rows.length) return [];
  const orderedRows = options.alphabetical === true
    ? [...rows].sort(diagram2FieldMappingPaneRowAlphabeticalCompare)
    : rows;
  if (options.groupByTable !== true) {
    return [{ id: "all-mappings", name: "", rows: orderedRows }];
  }

  const groupsByTable = new Map();
  orderedRows.forEach(row => {
    const name = row.databaseTable || "Database Table";
    if (!groupsByTable.has(name)) {
      groupsByTable.set(name, {
        id: `database-table:${name.toLowerCase()}`,
        name,
        rows: []
      });
    }
    groupsByTable.get(name).rows.push(row);
  });
  const groups = [...groupsByTable.values()];
  return options.alphabetical === true
    ? groups.sort((left, right) => left.name.localeCompare(right.name))
    : groups;
}

export function diagram2FieldMappingExportRows(indexes, options = {}) {
  return diagram2FieldMappingPaneGroups(indexes, {
    groupByTable: options.groupByTable === true,
    alphabetical: options.alphabetical === true
  }).flatMap(group => group.rows.map(row => ({
    uiField: row.uiField,
    databaseField: row.databaseField
  })));
}

function diagram2FieldMappingPaneRowAlphabeticalCompare(left, right) {
  return left.uiField.localeCompare(right.uiField)
    || left.databaseField.localeCompare(right.databaseField);
}

function diagram2FieldMappingPaneRows(indexes, mappingIdsInput, tableIdByMappingId) {
  return [...new Set(Array.isArray(mappingIdsInput) ? mappingIdsInput : [])]
    .map(id => indexes.mappingsById.get(id))
    .filter(Boolean)
    .sort((left, right) => finiteNumber(left.source?.y, 0) - finiteNumber(right.source?.y, 0)
      || finiteNumber(left.source?.x, 0) - finiteNumber(right.source?.x, 0)
      || diagram2TargetFieldIndex(left) - diagram2TargetFieldIndex(right)
      || String(left.sourceField || "").localeCompare(String(right.sourceField || "")))
    .map(mapping => ({
      mappingId: String(mapping.id || ""),
      tableId: String(tableIdByMappingId?.get?.(mapping.id) || ""),
      uiField: String(mapping.sourceField || mapping.source?.fieldRectangleName || "UI Field").trim() || "UI Field",
      databaseTable: diagram2MappingDatabaseTable(mapping),
      databaseField: diagram2MappingDatabaseField(mapping)
    }));
}

function diagram2MappingDatabaseTable(mapping) {
  const sourceMapping = diagram2FieldRectangleMapping(mapping?.source);
  const referenceParts = String(sourceMapping?.referencedEntity || "")
    .split(".")
    .map(part => part.trim())
    .filter(Boolean);
  const entity = mapping?.target
    ? formatAnnotationEntityIdentifier(mapping.target.entitySchema, mapping.target.entityName)
    : formatAnnotationEntityIdentifier(referenceParts);
  return entity || "Database Table";
}

function diagram2MappingDatabaseField(mapping) {
  const sourceMapping = diagram2FieldRectangleMapping(mapping?.source);
  const entity = diagram2MappingDatabaseTable(mapping);
  const field = formatAnnotationEntityIdentifier(mapping?.targetField || sourceMapping?.referencedField || "Database Field");
  return [entity, field].filter(Boolean).join(".") || "Database Field";
}

function diagram2TargetFieldIndex(mapping) {
  const fields = Array.isArray(mapping?.target?.fields) ? mapping.target.fields : [];
  const target = normalizeIdentifier(mapping?.targetField);
  const index = fields.findIndex(field => normalizeIdentifier(field?.name) === target);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function createEmptyIndexes() {
  return {
    objectsById: new Map(),
    entitiesByReference: new Map(),
    entityReferenceById: new Map(),
    imagesById: new Map(),
    fieldRectanglesById: new Map(),
    tablesById: new Map(),
    mappingsById: new Map(),
    mappingIdByFieldRectangleId: new Map(),
    mappingIdsByFieldRectangleId: new Map(),
    mappingIdsByTargetEntityId: new Map(),
    mappingIdsByEntityField: new Map(),
    mappingIdsBySourceImageId: new Map(),
    fieldRectangleIdsByEntityReference: new Map(),
    fieldRectangleIdsByImageId: new Map(),
    imageIdsByFieldRectangleId: new Map(),
    tableIdsBySourceImageId: new Map(),
    tableIdsByFieldRectangleId: new Map(),
    tableRowKeysByMappingId: new Map(),
    mappingIdsByTableId: new Map(),
    highlightTargetsByMappingId: new Map(),
    highlightTargetsByRowKey: new Map(),
    relationshipIdByMappingId: new Map(),
    mappingRouteBoundsById: new Map(),
    tableIndexRecordsById: new Map(),
    fullBuildCount: 0,
    fullBuildObjectVisitCount: 0,
    incrementalPatchCount: 0,
    incrementalObjectVisitCount: 0
  };
}

function normalizeIndexChange(indexes, changeInput) {
  const directObject = changeInput?.id ? changeInput : null;
  const previousObject = changeInput?.previousObject
    || changeInput?.previous
    || (directObject ? indexes.objectsById.get(directObject.id) : null)
    || null;
  const nextObject = changeInput?.nextObject
    || changeInput?.next
    || directObject
    || null;
  const id = String(nextObject?.id || previousObject?.id || "").trim();
  if (!id) return null;
  return {
    previousObject: previousObject ? { ...previousObject, id } : null,
    nextObject: nextObject ? { ...nextObject, id } : null
  };
}

function installBasicObject(indexes, object) {
  const id = String(object?.id || "").trim();
  if (!id) return;
  indexes.objectsById.set(id, object);
  if (isDiagram2FieldRectangle(object)) {
    indexes.fieldRectanglesById.set(id, object);
    return;
  }
  if (isMappingEntity(object)) {
    const reference = diagram2EntityReference(object);
    if (reference) {
      indexes.entitiesByReference.set(reference, object);
      indexes.entityReferenceById.set(id, reference);
    }
    return;
  }
  if (object.type === "embedded-image") {
    indexes.imagesById.set(id, object);
    return;
  }
  if (object.type === "field-mapping-table") indexes.tablesById.set(id, object);
}

function removeBasicObject(indexes, object) {
  const id = String(object?.id || "").trim();
  if (!id) return;
  indexes.objectsById.delete(id);
  if (isDiagram2FieldRectangle(object)) {
    indexes.fieldRectanglesById.delete(id);
    return;
  }
  if (isMappingEntity(object)) {
    const reference = indexes.entityReferenceById.get(id) || diagram2EntityReference(object);
    if (indexes.entitiesByReference.get(reference)?.id === id) indexes.entitiesByReference.delete(reference);
    indexes.entityReferenceById.delete(id);
    return;
  }
  if (object.type === "embedded-image") {
    indexes.imagesById.delete(id);
    return;
  }
  if (object.type === "field-mapping-table") indexes.tablesById.delete(id);
}

function indexFieldRectangle(indexes, fieldRectangle) {
  const mapping = diagram2FieldRectangleMapping(fieldRectangle);
  const reference = normalizeEntityReference(mapping?.referencedEntity);
  if (reference) appendMapValue(indexes.fieldRectangleIdsByEntityReference, reference, fieldRectangle.id);

  const imageIds = [];
  indexes.imagesById.forEach(image => {
    if (!boundsIntersect(objectBounds(fieldRectangle), effectiveImageBounds(image))) return;
    imageIds.push(image.id);
    appendMapValue(indexes.fieldRectangleIdsByImageId, image.id, fieldRectangle.id);
  });
  if (imageIds.length) indexes.imageIdsByFieldRectangleId.set(fieldRectangle.id, imageIds);
  if (!mapping) return;

  const mappingId = diagram2FieldMappingIdentity(fieldRectangle);
  const target = indexes.entitiesByReference.get(reference) || null;
  const sourceField = String(fieldRectangle.fields?.[0]?.name || fieldRectangle.fieldRectangleName || "");
  const targetField = String(mapping.referencedField || "");
  const record = {
    id: mappingId,
    sourceId: fieldRectangle.id,
    sourceField,
    targetId: target?.id || "",
    targetField,
    relationshipType: String(mapping.relationshipType || ""),
    relationshipId: target
      ? fieldMappingRelationshipId(fieldRectangle.id, sourceField, target.id, targetField)
      : "",
    source: fieldRectangle,
    target
  };
  indexes.mappingsById.set(mappingId, record);
  indexes.mappingIdByFieldRectangleId.set(fieldRectangle.id, mappingId);
  appendMapValue(indexes.mappingIdsByFieldRectangleId, fieldRectangle.id, mappingId);
  if (target?.id) {
    appendMapValue(indexes.mappingIdsByTargetEntityId, target.id, mappingId);
    appendMapValue(indexes.mappingIdsByEntityField, diagram2EntityFieldMappingKey(target.id, targetField), mappingId);
  }
  imageIds.forEach(imageId => appendMapValue(indexes.mappingIdsBySourceImageId, imageId, mappingId));
  if (record.relationshipId) indexes.relationshipIdByMappingId.set(mappingId, record.relationshipId);
  refreshMappingHighlightTarget(indexes, mappingId);
}

function unindexFieldRectangle(indexes, fieldRectangle) {
  const id = String(fieldRectangle?.id || "").trim();
  if (!id) return;
  const mapping = diagram2FieldRectangleMapping(fieldRectangle);
  removeMapValue(
    indexes.fieldRectangleIdsByEntityReference,
    normalizeEntityReference(mapping?.referencedEntity),
    id
  );
  (indexes.imageIdsByFieldRectangleId.get(id) || [])
    .forEach(imageId => removeMapValue(indexes.fieldRectangleIdsByImageId, imageId, id));
  indexes.imageIdsByFieldRectangleId.delete(id);
  const mappingId = indexes.mappingIdByFieldRectangleId.get(id);
  if (mappingId) removeMappingRecord(indexes, mappingId);
}

function removeMappingRecord(indexes, mappingId) {
  const record = indexes.mappingsById.get(mappingId);
  if (!record) return;
  removeMapValue(indexes.mappingIdsByFieldRectangleId, record.sourceId, mappingId);
  removeMapValue(indexes.mappingIdsByTargetEntityId, record.targetId, mappingId);
  removeMapValue(
    indexes.mappingIdsByEntityField,
    diagram2EntityFieldMappingKey(record.targetId, record.targetField),
    mappingId
  );
  (indexes.imageIdsByFieldRectangleId.get(record.sourceId) || [])
    .forEach(imageId => removeMapValue(indexes.mappingIdsBySourceImageId, imageId, mappingId));
  indexes.mappingIdByFieldRectangleId.delete(record.sourceId);
  indexes.mappingsById.delete(mappingId);
  indexes.highlightTargetsByMappingId.delete(mappingId);
  indexes.relationshipIdByMappingId.delete(mappingId);
  indexes.mappingRouteBoundsById.delete(mappingId);
}

function indexTable(indexes, table) {
  const records = [];
  const tableId = String(table?.id || "").trim();
  if (!tableId) return;
  if (table.sourceImageId) appendMapValue(indexes.tableIdsBySourceImageId, table.sourceImageId, tableId);
  (Array.isArray(table.rows) ? table.rows : []).forEach(row => {
    const fieldRectangleId = String(row?.uiEntityId || "").trim();
    if (fieldRectangleId) appendMapValue(indexes.tableIdsByFieldRectangleId, fieldRectangleId, tableId);
    const mappingId = indexes.mappingIdByFieldRectangleId.get(fieldRectangleId);
    const record = { rowKey: "", mappingId: "", fieldRectangleId };
    records.push(record);
    if (!mappingId) return;
    const rowKey = diagram2FieldMappingRowKey(tableId, mappingId);
    record.rowKey = rowKey;
    record.mappingId = mappingId;
    appendMapValue(indexes.tableRowKeysByMappingId, mappingId, rowKey);
    appendMapValue(indexes.mappingIdsByTableId, tableId, mappingId);
    const mapping = indexes.mappingsById.get(mappingId);
    const target = {
      rowKey,
      tableId,
      mappingId,
      sourceId: mapping?.sourceId || "",
      targetId: mapping?.targetId || ""
    };
    indexes.highlightTargetsByRowKey.set(rowKey, target);
    refreshMappingHighlightTarget(indexes, mappingId);
  });
  indexes.tableIndexRecordsById.set(tableId, records);
}

function unindexTable(indexes, table) {
  const tableId = String(table?.id || "").trim();
  if (!tableId) return;
  removeMapValue(indexes.tableIdsBySourceImageId, table.sourceImageId, tableId);
  const records = indexes.tableIndexRecordsById.get(tableId) || [];
  records.forEach(record => {
    removeMapValue(indexes.tableIdsByFieldRectangleId, record.fieldRectangleId, tableId);
    if (!record.mappingId) return;
    removeMapValue(indexes.tableRowKeysByMappingId, record.mappingId, record.rowKey);
    indexes.highlightTargetsByRowKey.delete(record.rowKey);
    refreshMappingHighlightTarget(indexes, record.mappingId);
  });
  indexes.mappingIdsByTableId.delete(tableId);
  indexes.tableIndexRecordsById.delete(tableId);
}

function refreshMappingHighlightTarget(indexes, mappingId) {
  const mapping = indexes.mappingsById.get(mappingId);
  if (!mapping) {
    indexes.highlightTargetsByMappingId.delete(mappingId);
    return;
  }
  indexes.highlightTargetsByMappingId.set(mappingId, {
    mappingId,
    sourceId: mapping.sourceId,
    targetId: mapping.targetId,
    sourceImageIds: [...(indexes.imageIdsByFieldRectangleId.get(mapping.sourceId) || [])],
    tableRowKeys: [...(indexes.tableRowKeysByMappingId.get(mappingId) || [])]
  });
}

function fieldMappingRelationshipId(sourceId, sourceField, targetId, targetField) {
  return [
    "diagram2-relationship",
    sourceId,
    sourceField,
    targetId,
    targetField,
    ""
  ].map(part => encodeURIComponent(String(part || "").toLowerCase())).join(":");
}

function isMappingEntity(object) {
  return object?.type === "entity" && !isDiagram2FieldRectangle(object);
}

function normalizeEntityReference(value) {
  return String(value || "")
    .split(".")
    .map(part => part.trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, ""))
    .filter(Boolean)
    .join(".")
    .toLowerCase();
}

function normalizeIdentifier(value) {
  return String(value || "").trim().replace(/^\[|\]$/g, "").replace(/^"|"$/g, "").toLowerCase();
}

function appendMapValue(map, keyInput, value) {
  const key = String(keyInput || "").trim();
  if (!key) return;
  const values = map.get(key) || [];
  if (!values.includes(value)) values.push(value);
  map.set(key, values);
}

function removeMapValue(map, keyInput, value) {
  const key = String(keyInput || "").trim();
  if (!key || !map.has(key)) return;
  const values = map.get(key).filter(candidate => candidate !== value);
  if (values.length) map.set(key, values);
  else map.delete(key);
}

function objectBounds(object) {
  return object ? {
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1)
  } : null;
}

function effectiveImageBounds(image) {
  if (!image) return null;
  if (image.cropVisible === false) return objectBounds(image);
  return intersectBounds(objectBounds(image), image.imageClip || objectBounds(image));
}

function boundsIntersect(left, right) {
  return Boolean(left && right
    && left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y);
}

function intersectBounds(left, right) {
  if (!left || !right) return null;
  const x = Math.max(left.x, finiteNumber(right.x, left.x));
  const y = Math.max(left.y, finiteNumber(right.y, left.y));
  const endX = Math.min(left.x + left.width, finiteNumber(right.x, left.x) + positiveNumber(right.width, left.width));
  const endY = Math.min(left.y + left.height, finiteNumber(right.y, left.y) + positiveNumber(right.height, left.height));
  return endX > x && endY > y ? { x, y, width: endX - x, height: endY - y } : null;
}

function normalizeBounds(boundsInput) {
  if (!boundsInput) return null;
  const width = positiveNumber(boundsInput.width, 0);
  const height = positiveNumber(boundsInput.height, 0);
  if (!width || !height) return null;
  return {
    x: finiteNumber(boundsInput.x, 0),
    y: finiteNumber(boundsInput.y, 0),
    width,
    height
  };
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
