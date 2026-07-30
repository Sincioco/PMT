import {
  normalizeAnnotationState,
  setAnnotationEntityFieldForeignKeyMapping
} from "../../components/image-annotation.js?v=20260730-diagram2-phase6-crop-closure-v14";
import { createDiagram2ObjectId } from "./diagram2-editor-images.js?v=20260730-diagram2-phase6-crop-closure-v14";

export function isDiagram2FieldRectangle(object) {
  return object?.type === "entity" && object.entityKind === "field-rectangle";
}

export function createDiagram2FieldRectangle(options = {}) {
  const name = normalizeFieldName(options.name);
  const raw = {
    id: String(options.id || createDiagram2ObjectId("field-rectangle")),
    type: "entity",
    entityKind: "field-rectangle",
    x: finiteNumber(options.x, 0),
    y: finiteNumber(options.y, 0),
    width: positiveNumber(options.width, 220),
    height: positiveNumber(options.height, 76),
    fill: options.fill || "none",
    stroke: options.stroke || "#175fbd",
    outlineVisible: true,
    strokeWidth: positiveNumber(options.strokeWidth, 2),
    opacity: 1,
    textColor: "#175fbd",
    entityNameTextColor: "#172b4d",
    entityHeaderFill: "#ffffff",
    fontFamily: "Arial",
    fontSize: 18,
    entitySchema: "",
    entityName: name,
    fieldRectangleName: name,
    fieldRectangleConnectionSide: normalizeConnectionSide(options.connectionSide),
    fields: [{ name, isPrimaryKey: false, isForeignKey: true, isImportant: true }],
    foreignKeys: [],
    foreignKeysAtTop: false,
    showSelfRelationships: false,
    anchorTable: false,
    collapsed: false,
    expandedHeight: positiveNumber(options.height, 76),
    sourceText: "",
    entityAnnotation: "",
    entityAnnotationGroupId: "",
    showKeyColumn: false,
    showDataTypes: false,
    dataTypeExpandedWidth: positiveNumber(options.width, 220),
    name: `Field: ${name}`,
    visible: true,
    locked: false,
    groupId: ""
  };
  return normalizeSingleObject(raw);
}

export function renameDiagram2FieldRectangle(object, nameInput) {
  if (!isDiagram2FieldRectangle(object)) return null;
  const name = normalizeFieldName(nameInput);
  const currentField = object.fields?.[0] || {};
  const previousName = String(currentField.name || object.fieldRectangleName || "");
  const mapping = diagram2FieldRectangleMapping(object);
  let foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    object.foreignKeys,
    previousName,
    null
  );
  if (mapping) foreignKeys = setAnnotationEntityFieldForeignKeyMapping(foreignKeys, name, mapping);
  const renamed = normalizeSingleObject({
    ...object,
    name: `Field: ${name}`,
    entityName: name,
    fieldRectangleName: name,
    fields: [{ ...currentField, name, isForeignKey: true, isImportant: true }],
    foreignKeys
  });
  return renamed;
}

export function setDiagram2FieldRectangleConnectionSide(object, side) {
  if (!isDiagram2FieldRectangle(object)) return null;
  return normalizeSingleObject({
    ...object,
    fieldRectangleConnectionSide: normalizeConnectionSide(side)
  });
}

export function setDiagram2FieldRectangleMapping(object, mappingInput = null) {
  if (!isDiagram2FieldRectangle(object)) return null;
  const fieldName = String(object.fields?.[0]?.name || object.fieldRectangleName || "Field");
  const foreignKeys = setAnnotationEntityFieldForeignKeyMapping(
    object.foreignKeys,
    fieldName,
    mappingInput
  );
  return normalizeSingleObject({ ...object, foreignKeys });
}

export function diagram2FieldRectangleMapping(object) {
  if (!isDiagram2FieldRectangle(object)) return null;
  const fieldName = String(object.fields?.[0]?.name || object.fieldRectangleName || "").toLowerCase();
  const foreignKey = (Array.isArray(object.foreignKeys) ? object.foreignKeys : [])
    .find(item => (item?.columns || []).some(column => String(column).toLowerCase() === fieldName));
  if (!foreignKey) return null;
  const fieldIndex = foreignKey.columns.findIndex(column => String(column).toLowerCase() === fieldName);
  const targetField = foreignKey.referencedColumns?.[fieldIndex]
    || foreignKey.referencedColumns?.[0]
    || "";
  const targetEntity = [foreignKey.referencedSchema, foreignKey.referencedTable]
    .filter(Boolean)
    .join(".");
  return {
    referencedEntity: targetEntity,
    referencedField: targetField,
    relationshipType: foreignKey.relationshipType || "",
    styleOverride: foreignKey.styleOverride || null
  };
}

export function diagram2FieldMappingIdentity(fieldRectangle) {
  if (!isDiagram2FieldRectangle(fieldRectangle)) return "";
  const field = String(fieldRectangle.fields?.[0]?.name || fieldRectangle.fieldRectangleName || "Field")
    .trim()
    .toLowerCase();
  return `mapping:${fieldRectangle.id}:${field}`;
}

function normalizeSingleObject(object) {
  return normalizeAnnotationState({
    width: Math.max(1, finiteNumber(object.x, 0) + positiveNumber(object.width, 1)),
    height: Math.max(1, finiteNumber(object.y, 0) + positiveNumber(object.height, 1)),
    objects: [object]
  }).objects[0] || null;
}

function normalizeFieldName(value) {
  return String(value || "Field").trim().replace(/[\r\n\t]+/g, " ").slice(0, 240) || "Field";
}

function normalizeConnectionSide(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["left", "top", "right", "bottom"].includes(normalized) ? normalized : "right";
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
