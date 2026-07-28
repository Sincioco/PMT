import {
  annotationEntityMetrics,
  annotationEntityVisibleFields,
  applyAnnotationEntityDefinition,
  formatAnnotationEntityIdentifier,
  parseAnnotationEntityDefinition,
  resolveAnnotationEntitySizeChangeLayout,
  setAnnotationEntityCollapsedState,
  setAnnotationEntityDataTypeVisibility
} from "../../components/image-annotation.js?v=20260728-diagram2-phase4-v5";
import { normalizeDiagram2CanonicalState } from "./diagram2-renderer.js?v=20260729-diagram2-phase5-v1";

const defaultDiagram2EntityWidth = 520;
const defaultDiagram2EntityFill = "#ffffff";
const defaultDiagram2EntityStroke = "#42526b";
const defaultDiagram2EntityTextColor = "#172b4d";
const defaultDiagram2EntityFontSize = 18;

export function parseDiagram2EntityDefinition(sourceText, manualEntityName = "", options = {}) {
  const definition = parseAnnotationEntityDefinition(sourceText, manualEntityName);
  return {
    ...definition,
    foreignKeysAtTop: options.foreignKeysAtTop === true
  };
}

export function createDiagram2EntityObject(definitionInput = {}, centerInput = {}, options = {}) {
  const id = String(options.id || diagram2EntityId()).trim();
  const width = positiveNumber(options.width, defaultDiagram2EntityWidth);
  const object = {
    id,
    type: "entity",
    name: "Entity",
    x: finiteNumber(centerInput?.x, 800) - (width / 2),
    y: finiteNumber(centerInput?.y, 450) - 80,
    width,
    height: 1,
    fill: defaultDiagram2EntityFill,
    stroke: defaultDiagram2EntityStroke,
    outlineVisible: true,
    strokeWidth: 2,
    opacity: 1,
    textColor: defaultDiagram2EntityTextColor,
    entityNameTextColor: defaultDiagram2EntityTextColor,
    entityHeaderFill: defaultDiagram2EntityFill,
    fontFamily: "Arial",
    fontSize: defaultDiagram2EntityFontSize,
    entitySchema: "",
    entityName: "Entity",
    fields: [],
    foreignKeys: [],
    foreignKeysAtTop: false,
    showSelfRelationships: false,
    anchorTable: false,
    collapsed: false,
    expandedHeight: 1,
    sourceText: "",
    entityAnnotation: "",
    entityAnnotationGroupId: "",
    showKeyColumn: true,
    showDataTypes: false,
    dataTypeExpandedWidth: defaultDiagram2EntityWidth,
    locked: false,
    groupId: ""
  };
  const definition = normalizeDiagram2EntityDefinition(definitionInput);
  if (definition) applyAnnotationEntityDefinition(object, definition);
  return normalizeDiagram2EntitySize(object);
}

export function diagram2ApplyEntityDefinitionPlan(stateInput, objectIdInput, definitionInput = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  const definition = normalizeDiagram2EntityDefinition(definitionInput);
  if (!entity || entity.locked === true || !definition) return null;

  const nextEntity = { ...entity };
  applyAnnotationEntityDefinition(nextEntity, definition);
  normalizeDiagram2EntitySize(nextEntity);
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  resolveAnnotationEntitySizeChangeLayout(nextState, nextEntity.id, { separateRoutes: false });
  return diagram2StatePlan(state, nextState, [entity.id], [entity.id], "Update entity");
}

export function diagram2SetEntityOptionPlan(stateInput, objectIdInput, optionNameInput, valueInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const optionName = String(optionNameInput || "").trim();
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  if (!entity || entity.locked === true) return null;

  const nextEntity = { ...entity };
  const bool = valueInput === true;
  if (optionName === "showDataTypes") {
    setAnnotationEntityDataTypeVisibility(nextEntity, bool);
  } else if (optionName === "collapsed") {
    setAnnotationEntityCollapsedState(nextEntity, bool);
  } else if (["showKeyColumn", "foreignKeysAtTop", "showSelfRelationships", "anchorTable"].includes(optionName)) {
    nextEntity[optionName] = bool;
    normalizeDiagram2EntitySize(nextEntity);
  } else {
    return null;
  }

  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  return diagram2StatePlan(state, nextState, [entity.id], [entity.id], "Update entity display");
}

export function diagram2UpdateEntityFieldPlan(stateInput, objectIdInput, fieldIndexInput, patchInput = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const fieldIndex = Number.parseInt(fieldIndexInput, 10);
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  if (!entity || entity.locked === true || !Number.isInteger(fieldIndex)) return null;
  const fields = Array.isArray(entity.fields) ? entity.fields.map(field => ({ ...field })) : [];
  if (fieldIndex < 0 || fieldIndex >= fields.length) return null;

  const current = fields[fieldIndex];
  const patch = patchInput && typeof patchInput === "object" ? patchInput : {};
  const nextField = {
    ...current,
    ...(Object.hasOwn(patch, "name") ? { name: normalizeDiagram2FieldName(patch.name) || current.name } : {}),
    ...(Object.hasOwn(patch, "dataType") ? { dataType: String(patch.dataType || "").trim().slice(0, 240) } : {}),
    ...(Object.hasOwn(patch, "nullable") ? { nullable: patch.nullable === true ? true : patch.nullable === false ? false : null } : {}),
    ...(Object.hasOwn(patch, "isPrimaryKey") ? { isPrimaryKey: patch.isPrimaryKey === true } : {}),
    ...(Object.hasOwn(patch, "isForeignKey") ? { isForeignKey: patch.isForeignKey === true } : {}),
    ...(Object.hasOwn(patch, "isImportant") ? { isImportant: patch.isImportant === true } : {}),
    ...(Object.hasOwn(patch, "isIdentity") ? { isIdentity: patch.isIdentity === true } : {})
  };
  if (!nextField.name) return null;
  fields[fieldIndex] = nextField;
  const nextEntity = normalizeDiagram2EntitySize({ ...entity, fields });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  return diagram2StatePlan(state, nextState, [entity.id], [entity.id], "Update entity field");
}

export function diagram2AddEntityFieldPlan(stateInput, objectIdInput, fieldInput = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  if (!entity || entity.locked === true) return null;
  const fields = Array.isArray(entity.fields) ? entity.fields.map(field => ({ ...field })) : [];
  const name = uniqueDiagram2FieldName(fields, normalizeDiagram2FieldName(fieldInput.name) || "NewField");
  fields.push({
    name,
    dataType: String(fieldInput.dataType || "").trim().slice(0, 240),
    nullable: fieldInput.nullable === true ? true : fieldInput.nullable === false ? false : null,
    isPrimaryKey: fieldInput.isPrimaryKey === true,
    isForeignKey: fieldInput.isForeignKey === true,
    isImportant: fieldInput.isImportant === true,
    isIdentity: fieldInput.isIdentity === true,
    identity: fieldInput.isIdentity === true ? "IDENTITY" : ""
  });
  const nextEntity = normalizeDiagram2EntitySize({ ...entity, fields });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  return diagram2StatePlan(state, nextState, [entity.id], [entity.id], "Add entity field");
}

export function diagram2RemoveEntityFieldPlan(stateInput, objectIdInput, fieldIndexInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const fieldIndex = Number.parseInt(fieldIndexInput, 10);
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  if (!entity || entity.locked === true || !Number.isInteger(fieldIndex)) return null;
  const fields = Array.isArray(entity.fields) ? entity.fields.map(field => ({ ...field })) : [];
  if (fieldIndex < 0 || fieldIndex >= fields.length) return null;
  const [removed] = fields.splice(fieldIndex, 1);
  const removedName = String(removed?.name || "").trim().toLowerCase();
  const foreignKeys = (Array.isArray(entity.foreignKeys) ? entity.foreignKeys : [])
    .filter(foreignKey => !(foreignKey.columns || []).some(column => String(column || "").trim().toLowerCase() === removedName));
  const nextEntity = normalizeDiagram2EntitySize({ ...entity, fields, foreignKeys });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  return diagram2StatePlan(state, nextState, [entity.id], [entity.id], "Remove entity field");
}

export function diagram2EntityDialogDefaults(object = null) {
  const entity = object?.type === "entity" ? object : null;
  return {
    entityName: formatAnnotationEntityIdentifier(entity?.entitySchema, entity?.entityName) || "",
    sourceText: String(entity?.sourceText || entityFieldListText(entity) || ""),
    foreignKeysAtTop: entity?.foreignKeysAtTop === true
  };
}

export function normalizeDiagram2EntitySize(objectInput = {}) {
  const object = { ...objectInput };
  const metrics = annotationEntityMetrics(object);
  const visibleFields = annotationEntityVisibleFields(object);
  const longestFieldName = visibleFields.reduce(
    (longest, field) => Math.max(longest, formatAnnotationEntityIdentifier(field?.name).length),
    0
  );
  const titleWidth = (formatAnnotationEntityIdentifier(object.entitySchema, object.entityName).length * metrics.fontSize * 0.72)
    + (metrics.headerHeight * 2.4);
  const fieldWidth = Math.max(180, (longestFieldName * metrics.fontSize * 0.62) + (metrics.padding * 2));
  const keyWidth = object.showKeyColumn === false ? 0 : metrics.keyColumnWidth;
  const typeWidth = object.showDataTypes === true
    ? metrics.dataTypeColumnWidth + metrics.notColumnWidth + metrics.nullColumnWidth
    : 0;
  const minimumWidth = Math.max(defaultDiagram2EntityWidth, keyWidth + fieldWidth + typeWidth, titleWidth);
  const naturalHeight = metrics.headerHeight + (Math.max(0, visibleFields.length) * metrics.rowHeight);
  object.width = Math.max(minimumWidth, positiveNumber(object.width, defaultDiagram2EntityWidth));
  object.height = Math.max(naturalHeight, positiveNumber(object.height, naturalHeight));
  object.expandedHeight = object.collapsed === true
    ? Math.max(positiveNumber(object.expandedHeight, naturalHeight), naturalHeight)
    : object.height;
  object.dataTypeExpandedWidth = object.showDataTypes === true
    ? object.width
    : Math.max(positiveNumber(object.dataTypeExpandedWidth, 0), object.width);
  return object;
}

function normalizeDiagram2EntityDefinition(input) {
  if (!input || typeof input !== "object") return null;
  const name = String(input.name || input.entityName || "Entity").trim() || "Entity";
  const fields = Array.isArray(input.fields)
    ? input.fields
    : [{ name: "Id", dataType: "int", nullable: false, isPrimaryKey: true, isForeignKey: false }];
  return {
    schema: String(input.schema || input.entitySchema || "").trim(),
    name,
    fields,
    foreignKeys: Array.isArray(input.foreignKeys) ? input.foreignKeys : [],
    foreignKeysAtTop: input.foreignKeysAtTop === true,
    sourceText: String(input.sourceText || "")
  };
}

function diagram2StatePlan(previousState, nextState, affectedObjectIds, selectionAfter, label) {
  if (JSON.stringify(previousState) === JSON.stringify(nextState)) return null;
  return {
    nextState,
    affectedObjectIds,
    affectedRelationshipIds: [],
    selectionAfter,
    label
  };
}

function entityFieldListText(entity) {
  const fields = Array.isArray(entity?.fields) ? entity.fields : [];
  return fields.map(field => field.name).filter(Boolean).join("\n");
}

function uniqueDiagram2FieldName(fields, nameInput) {
  const baseName = normalizeDiagram2FieldName(nameInput) || "Field";
  const used = new Set(fields.map(field => String(field?.name || "").trim().toLowerCase()));
  if (!used.has(baseName.toLowerCase())) return baseName;
  let index = 2;
  while (used.has(`${baseName}${index}`.toLowerCase())) index += 1;
  return `${baseName}${index}`;
}

function normalizeDiagram2FieldName(value) {
  return String(value || "").trim().replace(/^\[|\]$/g, "").slice(0, 240);
}

function diagram2EntityId() {
  return `entity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function positiveNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
