import {
  annotationFieldMappingTableLayout,
  annotationFieldRectangleTableRows,
  formatAnnotationEntityIdentifier,
  normalizeAnnotationFieldMappingTableStyle,
  normalizeAnnotationState
} from "../../components/image-annotation.js?v=20260731-diagram2-route-release-v15";
import {
  diagram2FieldRectangleMapping,
  isDiagram2FieldRectangle
} from "./diagram2-editor-field-rectangles.js?v=20260731-diagram2-route-release-v15";
import {
  diagram2NormalizeEntityReference
} from "./diagram2-editor-field-mappings.js?v=20260731-diagram2-route-release-v15";
import { createDiagram2ObjectId } from "./diagram2-editor-images.js?v=20260731-diagram2-route-release-v15";

const defaultMappingTableStyle = {
  headerTextColor: "#000000",
  headerFill: "#d9ecff",
  uiTextColor: "#172b4d",
  uiFill: "#ffffff",
  databaseTextColor: "#172b4d",
  databaseFill: "#ffffff",
  fieldMappingRowHoverFill: "#fff59d",
  fieldMappingHighlightColor: "#facc15",
  fieldMappingHighlightStrokeWidth: 9
};

export function createDiagram2FieldMappingTable(stateInput, imageIdInput, options = {}) {
  const objects = Array.isArray(stateInput?.objects) ? stateInput.objects : [];
  const imageId = String(imageIdInput || "").trim();
  const image = objects.find(object => object?.id === imageId && object.type === "embedded-image");
  if (!image) return null;
  const rows = options.indexes
    ? diagram2FieldMappingRowsForImage(options.indexes, image)
    : annotationFieldRectangleTableRows(objects, image);
  if (!rows.length) return null;
  const style = normalizeAnnotationFieldMappingTableStyle({
    ...defaultMappingTableStyle,
    ...(options.style || {})
  });
  const layout = annotationFieldMappingTableLayout({
    rows,
    fontFamily: options.fontFamily || "Arial",
    fontSize: positiveNumber(options.fontSize, 14)
  });
  const imageBounds = image.cropVisible === false ? objectBounds(image) : intersectBounds(objectBounds(image), image.imageClip);
  const x = finiteNumber(options.x, imageBounds.x + imageBounds.width + 40);
  const y = finiteNumber(options.y, imageBounds.y);
  return normalizeSingleObject({
    id: String(options.id || createDiagram2ObjectId("field-mapping-table")),
    type: "field-mapping-table",
    name: `Field Mapping Table: ${String(image.name || "Image").trim() || "Image"}`,
    sourceImageId: image.id,
    x,
    y,
    width: layout.width,
    height: layout.height,
    stroke: "#42526b",
    strokeWidth: 1,
    opacity: 1,
    fontFamily: options.fontFamily || "Arial",
    fontSize: positiveNumber(options.fontSize, 14),
    ...style,
    rows,
    visible: true,
    locked: false,
    groupId: ""
  });
}

export function syncDiagram2FieldMappingTable(table, objectsInput) {
  if (table?.type !== "field-mapping-table") return null;
  const objects = Array.isArray(objectsInput) ? objectsInput : [];
  const image = table.sourceImageId
    ? objects.find(object => object?.id === table.sourceImageId && object.type === "embedded-image")
    : null;
  if (table.sourceImageId && !image) return table;
  const rows = annotationFieldRectangleTableRows(objects, image);
  const layout = annotationFieldMappingTableLayout({ ...table, rows });
  if (sameRows(table.rows, rows)
    && Math.abs(positiveNumber(table.width, 1) - layout.width) < 0.001
    && Math.abs(positiveNumber(table.height, 1) - layout.height) < 0.001) return table;
  return normalizeSingleObject({
    ...table,
    rows,
    width: layout.width,
    height: layout.height
  });
}

export function syncDiagram2FieldMappingTableForFieldRectangle(table, fieldRectangle, indexes) {
  if (table?.type !== "field-mapping-table" || !isDiagram2FieldRectangle(fieldRectangle)) return table;
  const image = indexes?.imagesById?.get(table.sourceImageId) || null;
  const rows = (Array.isArray(table.rows) ? table.rows : [])
    .filter(row => String(row?.uiEntityId || "") !== fieldRectangle.id);
  const row = image && boundsIntersect(objectBounds(fieldRectangle), effectiveImageBounds(image))
    ? diagram2FieldMappingRow(fieldRectangle, indexes)
    : null;
  if (row) rows.push(row);
  return syncDiagram2FieldMappingTableRows(table, sortDiagram2FieldMappingRows(rows, indexes, fieldRectangle));
}

export function syncDiagram2FieldMappingTableForImage(table, image, indexes) {
  if (table?.type !== "field-mapping-table" || image?.type !== "embedded-image") return table;
  return syncDiagram2FieldMappingTableRows(
    table,
    diagram2FieldMappingRowsForImage(indexes, image)
  );
}

export function diagram2FieldMappingRowsForImage(indexes, image) {
  if (image?.type !== "embedded-image" || !(indexes?.fieldRectanglesById instanceof Map)) return [];
  const rows = [];
  indexes.fieldRectanglesById.forEach(fieldRectangle => {
    if (!boundsIntersect(objectBounds(fieldRectangle), effectiveImageBounds(image))) return;
    const row = diagram2FieldMappingRow(fieldRectangle, indexes);
    if (row) rows.push(row);
  });
  return sortDiagram2FieldMappingRows(rows, indexes);
}

export function planDiagram2FieldMappingTableSync(objectsInput, changedFieldRectangleIds = []) {
  const objects = Array.isArray(objectsInput) ? objectsInput : [];
  const changedIds = new Set(changedFieldRectangleIds.map(String));
  const changedRectangles = objects.filter(object => changedIds.has(object?.id));
  const imagesById = new Map(objects
    .filter(object => object?.type === "embedded-image")
    .map(image => [image.id, image]));
  return objects
    .filter(object => object?.type === "field-mapping-table")
    .filter(table => {
      if (!changedRectangles.length) return true;
      const image = imagesById.get(table.sourceImageId);
      return !image || changedRectangles.some(rectangle =>
        boundsIntersect(objectBounds(rectangle), effectiveImageBounds(image)));
    })
    .map(table => ({ table, next: syncDiagram2FieldMappingTable(table, objects) }))
    .filter(item => item.next && item.next !== item.table)
    .map(item => item.next);
}

export function diagram2FieldMappingTableRowKey(tableId, row) {
  const field = String(row?.uiField || "").trim().toLowerCase();
  return `${String(tableId || "").trim()}:mapping:${String(row?.uiEntityId || "").trim()}:${field}`;
}

function diagram2FieldMappingRow(fieldRectangle, indexes) {
  const mapping = diagram2FieldRectangleMapping(fieldRectangle);
  if (!mapping) return null;
  const target = indexes?.entitiesByReference?.get(
    diagram2NormalizeEntityReference(mapping.referencedEntity)
  ) || null;
  const referencedParts = String(mapping.referencedEntity || "")
    .split(".")
    .map(part => part.trim())
    .filter(Boolean);
  const targetName = target
    ? formatAnnotationEntityIdentifier(target.entitySchema, target.entityName)
    : formatAnnotationEntityIdentifier(...referencedParts);
  const databaseField = [
    targetName,
    formatAnnotationEntityIdentifier(mapping.referencedField)
  ].filter(Boolean).join(".");
  const uiField = String(fieldRectangle.fields?.[0]?.name || fieldRectangle.fieldRectangleName || "").trim();
  return uiField && databaseField
    ? { uiEntityId: fieldRectangle.id, uiField, databaseField }
    : null;
}

function sortDiagram2FieldMappingRows(rowsInput, indexes, overrideFieldRectangle = null) {
  const overrideId = String(overrideFieldRectangle?.id || "");
  const objectForRow = row => row.uiEntityId === overrideId
    ? overrideFieldRectangle
    : indexes?.fieldRectanglesById?.get(row.uiEntityId);
  return [...rowsInput].sort((left, right) => {
    const leftObject = objectForRow(left);
    const rightObject = objectForRow(right);
    return finiteNumber(leftObject?.y, 0) - finiteNumber(rightObject?.y, 0)
      || finiteNumber(leftObject?.x, 0) - finiteNumber(rightObject?.x, 0)
      || String(left.uiField || "").localeCompare(String(right.uiField || ""));
  });
}

function syncDiagram2FieldMappingTableRows(table, rows) {
  const layout = annotationFieldMappingTableLayout({ ...table, rows });
  if (sameRows(table.rows, rows)
    && Math.abs(positiveNumber(table.width, 1) - layout.width) < 0.001
    && Math.abs(positiveNumber(table.height, 1) - layout.height) < 0.001) return table;
  return normalizeSingleObject({
    ...table,
    rows,
    width: layout.width,
    height: layout.height
  });
}

function normalizeSingleObject(object) {
  return normalizeAnnotationState({
    width: Math.max(1, finiteNumber(object.x, 0) + positiveNumber(object.width, 1)),
    height: Math.max(1, finiteNumber(object.y, 0) + positiveNumber(object.height, 1)),
    objects: [object]
  }).objects[0] || null;
}

function sameRows(leftInput, rightInput) {
  const left = Array.isArray(leftInput) ? leftInput : [];
  const right = Array.isArray(rightInput) ? rightInput : [];
  return left.length === right.length && left.every((row, index) =>
    row.uiEntityId === right[index]?.uiEntityId
    && row.uiField === right[index]?.uiField
    && row.databaseField === right[index]?.databaseField);
}

function effectiveImageBounds(image) {
  if (!image) return null;
  return image.cropVisible === false ? objectBounds(image) : intersectBounds(objectBounds(image), image.imageClip);
}

function objectBounds(object) {
  return object ? {
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1)
  } : null;
}

function boundsIntersect(left, right) {
  return Boolean(left && right
    && left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y);
}

function intersectBounds(left, right) {
  if (!left || !right) return left;
  const x = Math.max(left.x, finiteNumber(right.x, left.x));
  const y = Math.max(left.y, finiteNumber(right.y, left.y));
  const endX = Math.min(left.x + left.width, finiteNumber(right.x, left.x) + positiveNumber(right.width, left.width));
  const endY = Math.min(left.y + left.height, finiteNumber(right.y, left.y) + positiveNumber(right.height, left.height));
  return endX > x && endY > y ? { x, y, width: endX - x, height: endY - y } : left;
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
