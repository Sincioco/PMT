import {
  annotationEntityMetrics,
  annotationEntityVisibleFields,
  applyAnnotationEntityDefinition,
  formatAnnotationEntityIdentifier,
  parseAnnotationEntityDefinition,
  resolveAnnotationEntitySizeChangeLayout,
  setAnnotationEntityCollapsedState,
  setAnnotationEntityDataTypeVisibility
} from "../../components/image-annotation.js?v=20260731-rte-checkbox-layout-v2";
import {
  diagram2CanonicalRelationships,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260801-diagram2-readonly-trace-v2";

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

export function diagram2ResetEntityScalePlan(stateInput, objectIdInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  if (!entity || entity.locked === true) return null;

  const nextEntity = normalizeDiagram2EntitySize({
    ...entity,
    width: 1,
    height: 1,
    expandedHeight: 1,
    dataTypeExpandedWidth: 1
  });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  return diagram2StatePlan(
    state,
    nextState,
    [entity.id],
    [entity.id],
    "Reset entity scale",
    affectedRelationshipIdsForFieldChange(state, nextState, entity.id)
  );
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
  const requestedName = Object.hasOwn(patch, "name")
    ? normalizeDiagram2FieldName(patch.name) || current.name
    : current.name;
  const nextName = Object.hasOwn(patch, "name")
    ? uniqueDiagram2FieldName(fields.filter((_field, index) => index !== fieldIndex), requestedName)
    : requestedName;
  const nextField = {
    ...current,
    ...(Object.hasOwn(patch, "name") ? { name: nextName } : {}),
    ...(Object.hasOwn(patch, "dataType") ? { dataType: String(patch.dataType || "").trim().slice(0, 240) } : {}),
    ...(Object.hasOwn(patch, "nullable") ? { nullable: patch.nullable === true ? true : patch.nullable === false ? false : null } : {}),
    ...(Object.hasOwn(patch, "isPrimaryKey") ? { isPrimaryKey: patch.isPrimaryKey === true } : {}),
    ...(Object.hasOwn(patch, "isForeignKey") ? { isForeignKey: patch.isForeignKey === true } : {}),
    ...(Object.hasOwn(patch, "isImportant") ? { isImportant: patch.isImportant === true } : {}),
    ...(Object.hasOwn(patch, "isIdentity") ? { isIdentity: patch.isIdentity === true } : {})
  };
  if (!nextField.name) return null;
  if (nextField.isIdentity === true) nextField.identity = nextField.identity || "IDENTITY";
  if (nextField.isIdentity !== true && Object.hasOwn(patch, "isIdentity")) delete nextField.identity;
  if (nextField.isPrimaryKey === true) nextField.nullable = false;
  fields[fieldIndex] = nextField;
  const renamed = !sameIdentifier(current.name, nextField.name);
  const fkFlagCleared = Object.hasOwn(patch, "isForeignKey") && nextField.isForeignKey !== true;
  const nextState = stateWithUpdatedEntityFields(state, entity, fields, {
    oldFieldName: renamed ? current.name : "",
    newFieldName: renamed ? nextField.name : "",
    removeSourceRelationshipsForField: fkFlagCleared ? current.name : ""
  });
  return diagram2StatePlan(
    state,
    nextState,
    affectedObjectIdsForFieldChange(state, nextState, entity.id),
    [entity.id],
    "Update entity field",
    affectedRelationshipIdsForFieldChange(state, nextState, entity.id)
  );
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
  const nextEntity = normalizeDiagram2EntitySize({ ...entity, fields });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => cleanupEntityFieldReferences(
      object.id === entity.id ? nextEntity : object,
      entity,
      removedName,
      { removeSource: true, removeTarget: true }
    ))
  });
  return diagram2StatePlan(
    state,
    nextState,
    affectedObjectIdsForFieldChange(state, nextState, entity.id),
    [entity.id],
    "Remove entity field",
    affectedRelationshipIdsForFieldChange(state, nextState, entity.id)
  );
}

export function diagram2MoveEntityFieldPlan(stateInput, objectIdInput, fieldIndexInput, directionInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const fieldIndex = Number.parseInt(fieldIndexInput, 10);
  const direction = String(directionInput || "").trim().toLowerCase();
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  if (!entity || entity.locked === true || !Number.isInteger(fieldIndex)) return null;
  const fields = Array.isArray(entity.fields) ? entity.fields.map(field => ({ ...field })) : [];
  if (fieldIndex < 0 || fieldIndex >= fields.length) return null;
  const targetIndex = direction === "up" ? fieldIndex - 1 : direction === "down" ? fieldIndex + 1 : -1;
  if (targetIndex < 0 || targetIndex >= fields.length) return null;
  const [field] = fields.splice(fieldIndex, 1);
  fields.splice(targetIndex, 0, field);
  const nextEntity = normalizeDiagram2EntitySize({ ...entity, fields });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  return diagram2StatePlan(
    state,
    nextState,
    [entity.id],
    [entity.id],
    "Move entity field",
    affectedRelationshipIdsForFieldChange(state, nextState, entity.id)
  );
}

export function diagram2SetEntityFieldReferencePlan(stateInput, objectIdInput, fieldIndexInput, referenceInput = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectId = String(objectIdInput || "").trim();
  const fieldIndex = Number.parseInt(fieldIndexInput, 10);
  const entity = state.objects.find(object => object.id === objectId && object.type === "entity");
  if (!entity || entity.locked === true || !Number.isInteger(fieldIndex)) return null;
  const fields = Array.isArray(entity.fields) ? entity.fields.map(field => ({ ...field })) : [];
  const field = fields[fieldIndex];
  if (!field?.name) return null;
  const targetEntityId = String(referenceInput?.targetEntityId || "").trim();
  const targetFieldName = normalizeDiagram2FieldName(referenceInput?.targetFieldName);
  const targetEntity = targetEntityId
    ? state.objects.find(object => object.id === targetEntityId && object.type === "entity")
    : null;
  const targetField = targetEntity && targetFieldName
    ? (Array.isArray(targetEntity.fields) ? targetEntity.fields : [])
        .find(candidate => sameIdentifier(candidate?.name, targetFieldName))
    : null;
  const nextField = { ...field };
  const foreignKeys = (Array.isArray(entity.foreignKeys) ? entity.foreignKeys : [])
    .filter(foreignKey => !(foreignKey.columns || []).some(column => sameIdentifier(column, field.name)));

  if (targetEntity && targetField) {
    nextField.isForeignKey = true;
    foreignKeys.push({
      name: uniqueDiagram2ForeignKeyName(state, entity, field.name, targetEntity),
      columns: [field.name],
      referencedSchema: String(targetEntity.entitySchema || "").trim(),
      referencedTable: String(targetEntity.entityName || "").trim(),
      referencedColumns: [targetField.name],
      relationshipType: normalizeDiagram2RelationshipType(referenceInput?.relationshipType)
    });
  } else {
    nextField.isForeignKey = false;
  }

  fields[fieldIndex] = nextField;
  const nextEntity = normalizeDiagram2EntitySize({ ...entity, fields, foreignKeys });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === entity.id ? nextEntity : object)
  });
  return diagram2StatePlan(
    state,
    nextState,
    [entity.id],
    [entity.id],
    targetEntity ? "Set field reference" : "Clear field reference",
    affectedRelationshipIdsForFieldChange(state, nextState, entity.id)
  );
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

function diagram2StatePlan(previousState, nextState, affectedObjectIds, selectionAfter, label, affectedRelationshipIds = []) {
  if (JSON.stringify(previousState) === JSON.stringify(nextState)) return null;
  return {
    nextState,
    affectedObjectIds: uniqueStrings(affectedObjectIds),
    affectedRelationshipIds: uniqueStrings(affectedRelationshipIds),
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

function normalizeDiagram2RelationshipType(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["one-to-one", "one-to-many", "many-to-one"].includes(text) ? text : "many-to-one";
}

function stateWithUpdatedEntityFields(state, entity, fields, options = {}) {
  const oldName = String(options.oldFieldName || "").trim();
  const newName = String(options.newFieldName || "").trim();
  const removeSource = String(options.removeSourceRelationshipsForField || "").trim();
  const sourceUpdatedEntity = {
    ...entity,
    fields,
    foreignKeys: updateForeignKeysForSourceField(entity.foreignKeys, {
      oldName,
      newName,
      removeName: removeSource
    })
  };
  const nextEntity = normalizeDiagram2EntitySize(
    oldName && newName
      ? renameEntityFieldReferences(sourceUpdatedEntity, entity, oldName, newName)
      : sourceUpdatedEntity
  );
  return normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => {
      const updated = object.id === entity.id ? nextEntity : object;
      if (!oldName || !newName || object.id === entity.id) return updated;
      return renameEntityFieldReferences(updated, entity, oldName, newName);
    })
  });
}

function updateForeignKeysForSourceField(foreignKeysInput, options = {}) {
  const oldName = String(options.oldName || "").trim();
  const newName = String(options.newName || "").trim();
  const removeName = String(options.removeName || "").trim();
  return (Array.isArray(foreignKeysInput) ? foreignKeysInput : [])
    .filter(foreignKey => !removeName || !(foreignKey.columns || []).some(column => sameIdentifier(column, removeName)))
    .map(foreignKey => {
      if (!oldName || !newName) return foreignKey;
      const columns = (Array.isArray(foreignKey.columns) ? foreignKey.columns : [])
        .map(column => sameIdentifier(column, oldName) ? newName : column);
      return { ...foreignKey, columns };
    });
}

function renameEntityFieldReferences(object, targetEntity, oldName, newName) {
  if (object?.type !== "entity" || !Array.isArray(object.foreignKeys)) return object;
  let changed = false;
  const foreignKeys = object.foreignKeys.map(foreignKey => {
    if (!foreignKeyReferencesEntity(foreignKey, targetEntity)) return foreignKey;
    const referencedColumns = (Array.isArray(foreignKey.referencedColumns) ? foreignKey.referencedColumns : [])
      .map(column => {
        if (!sameIdentifier(column, oldName)) return column;
        changed = true;
        return newName;
      });
    return changed ? { ...foreignKey, referencedColumns } : foreignKey;
  });
  return changed ? { ...object, foreignKeys } : object;
}

function cleanupEntityFieldReferences(object, targetEntity, normalizedFieldName, options = {}) {
  if (object?.type !== "entity") return object;
  const removeSource = options.removeSource === true && object.id === targetEntity.id;
  const removeTarget = options.removeTarget === true;
  const foreignKeys = (Array.isArray(object.foreignKeys) ? object.foreignKeys : [])
    .filter(foreignKey => {
      if (removeSource && (foreignKey.columns || []).some(column => sameIdentifier(column, normalizedFieldName))) return false;
      if (removeTarget
        && foreignKeyReferencesEntity(foreignKey, targetEntity)
        && (foreignKey.referencedColumns || []).some(column => sameIdentifier(column, normalizedFieldName))) {
        return false;
      }
      return true;
    });
  const remainingSourceFkColumns = new Set(foreignKeys
    .flatMap(foreignKey => Array.isArray(foreignKey.columns) ? foreignKey.columns : [])
    .map(value => String(value || "").trim().toLowerCase()));
  const fields = (Array.isArray(object.fields) ? object.fields : []).map(field =>
    field?.isForeignKey === true && !remainingSourceFkColumns.has(String(field?.name || "").trim().toLowerCase())
      ? { ...field, isForeignKey: false }
      : field);
  return { ...object, fields, foreignKeys };
}

function foreignKeyReferencesEntity(foreignKey, entity) {
  if (!foreignKey || !entity) return false;
  const targetTable = String(foreignKey.referencedTable || "").trim().toLowerCase();
  const entityTable = String(entity.entityName || "").trim().toLowerCase();
  const targetSchema = String(foreignKey.referencedSchema || "").trim().toLowerCase();
  const entitySchema = String(entity.entitySchema || "").trim().toLowerCase();
  return Boolean(targetTable && entityTable && targetTable === entityTable && (!targetSchema || !entitySchema || targetSchema === entitySchema));
}

function affectedObjectIdsForFieldChange(previousState, nextState, primaryEntityId) {
  const ids = new Set([primaryEntityId]);
  const previousObjects = new Map((previousState.objects || []).map(object => [object.id, object]));
  (nextState.objects || []).forEach(object => {
    if (object?.type !== "entity") return;
    const previous = previousObjects.get(object.id);
    if (JSON.stringify(previous?.foreignKeys || []) !== JSON.stringify(object.foreignKeys || [])) ids.add(object.id);
  });
  return [...ids];
}

function affectedRelationshipIdsForFieldChange(previousState, nextState, primaryEntityId) {
  const ids = new Set();
  const collect = state => diagram2CanonicalRelationships(state)
    .filter(relationship => relationship.source?.id === primaryEntityId || relationship.target?.id === primaryEntityId)
    .forEach(relationship => ids.add(relationship.id));
  collect(previousState);
  collect(nextState);
  return [...ids];
}

function uniqueDiagram2ForeignKeyName(state, sourceEntity, sourceFieldName, targetEntity) {
  const base = `FK_${safeDiagram2Identifier(sourceEntity.entityName)}_${safeDiagram2Identifier(sourceFieldName)}_${safeDiagram2Identifier(targetEntity.entityName)}`;
  const used = new Set((state.objects || [])
    .flatMap(object => Array.isArray(object.foreignKeys) ? object.foreignKeys : [])
    .map(foreignKey => String(foreignKey?.name || "").trim().toLowerCase())
    .filter(Boolean));
  if (!used.has(base.toLowerCase())) return base;
  let index = 2;
  while (used.has(`${base}_${index}`.toLowerCase())) index += 1;
  return `${base}_${index}`;
}

function safeDiagram2Identifier(value) {
  return String(value || "Entity").trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "Entity";
}

function sameIdentifier(first, second) {
  return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
}

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  (Array.isArray(values) ? values : [values]).forEach(value => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
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
