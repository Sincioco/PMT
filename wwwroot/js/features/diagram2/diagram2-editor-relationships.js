import {
  adjustAnnotationEntityRelationshipRoute,
  autoFormatAnnotationEntitiesOrgTree,
  formatAnnotationEntityIdentifier
} from "../../components/image-annotation.js?v=20260728-diagram2-phase4-v5";
import {
  diagram2CanonicalRelationships,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260729-diagram2-phase5-v1";
import {
  createDiagram2RelationshipRouteModel,
  diagram2RelationshipRouteFromModel,
  normalizeDiagram2RelationshipType
} from "./diagram2-routing.js?v=20260729-diagram2-phase5-v1";

const relationshipObjectType = "entity-relationship";
const relationshipGroupObjectType = "entity-relationships";
const relationshipGroupId = "entity-relationships";

export function diagram2RelationshipSelectionObjects(stateInput, idsInput = null) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const ids = idsInput == null ? null : new Set(uniqueStrings(idsInput));
  const relationships = diagram2CanonicalRelationships(state);
  const objects = relationships
    .filter(relationship => !ids || ids.has(relationship.id))
    .map(relationship => diagram2RelationshipSelectionObject(relationship, state.relationshipStyle));
  if (ids?.has(relationshipGroupId)) {
    objects.unshift({
      id: relationshipGroupId,
      type: relationshipGroupObjectType,
      name: "Entity Relationships",
      locked: false,
      groupId: "",
      ...(state.relationshipStyle || {})
    });
  }
  return objects;
}

export function diagram2SelectableRelationshipIds(stateInput) {
  return diagram2CanonicalRelationships(normalizeDiagram2CanonicalState(stateInput))
    .map(relationship => relationship.id);
}

export function diagram2RelationshipById(stateInput, idInput) {
  const id = String(idInput || "").trim();
  return diagram2CanonicalRelationships(normalizeDiagram2CanonicalState(stateInput))
    .find(relationship => relationship.id === id) || null;
}

export function diagram2AddRelationshipPlan(stateInput, input = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const sourceEntity = entityById(state, input.sourceEntityId);
  const targetEntity = entityById(state, input.targetEntityId);
  if (!sourceEntity || !targetEntity || sourceEntity.locked === true) return null;
  const sourceField = entityFieldByName(sourceEntity, input.sourceFieldName);
  const targetField = entityFieldByName(targetEntity, input.targetFieldName);
  if (!sourceField || !targetField) return null;

  const sourceFieldName = String(sourceField.name || "").trim();
  const targetFieldName = String(targetField.name || "").trim();
  const nextSource = {
    ...sourceEntity,
    fields: sourceEntity.fields.map(field =>
      field === sourceField || equalsIdentifier(field.name, sourceFieldName)
        ? { ...field, isForeignKey: true }
        : { ...field }),
    foreignKeys: replaceSourceFieldRelationship(sourceEntity.foreignKeys, sourceFieldName, {
      name: uniqueForeignKeyName(state, sourceEntity, sourceFieldName, targetEntity),
      columns: [sourceFieldName],
      referencedSchema: String(targetEntity.entitySchema || "").trim(),
      referencedTable: String(targetEntity.entityName || "").trim(),
      referencedColumns: [targetFieldName],
      relationshipType: normalizeDiagram2RelationshipType(input.relationshipType)
    })
  };
  if (sourceEntity.id === targetEntity.id) nextSource.showSelfRelationships = true;
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object => object.id === sourceEntity.id ? nextSource : object)
  });
  const nextRelationshipIds = diagram2CanonicalRelationships(nextState)
    .filter(relationship => relationship.source?.id === sourceEntity.id)
    .map(relationship => relationship.id);
  return statePlan(state, nextState, [sourceEntity.id], nextRelationshipIds, nextRelationshipIds.slice(-1), "Add relationship");
}

export function diagram2DeleteRelationshipsPlan(stateInput, idsInput = []) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const ids = new Set(uniqueStrings(idsInput));
  if (!ids.size) return null;
  const removalsByEntityId = new Map();
  diagram2CanonicalRelationships(state).forEach(relationship => {
    if (!ids.has(relationship.id)) return;
    const set = removalsByEntityId.get(relationship.source.id) || new Set();
    set.add(relationship.foreignKeyIndex);
    removalsByEntityId.set(relationship.source.id, set);
  });
  if (!removalsByEntityId.size) return null;

  const affectedObjectIds = [...removalsByEntityId.keys()];
  const objects = state.objects.map(object => {
    const removals = removalsByEntityId.get(object.id);
    if (!removals || object.locked === true) return object;
    const foreignKeys = (Array.isArray(object.foreignKeys) ? object.foreignKeys : [])
      .filter((_foreignKey, index) => !removals.has(index));
    const remainingFkFields = new Set(foreignKeys
      .flatMap(foreignKey => Array.isArray(foreignKey.columns) ? foreignKey.columns : [])
      .map(value => String(value || "").trim().toLowerCase()));
    const fields = (Array.isArray(object.fields) ? object.fields : []).map(field => {
      if (remainingFkFields.has(String(field?.name || "").trim().toLowerCase())) return { ...field, isForeignKey: true };
      return field?.isForeignKey === true ? { ...field, isForeignKey: false } : { ...field };
    });
    return { ...object, fields, foreignKeys };
  });
  const nextState = normalizeDiagram2CanonicalState({ ...state, objects });
  return statePlan(state, nextState, affectedObjectIds, [...ids], [], "Delete relationship");
}

export function diagram2SetRelationshipStylePlan(stateInput, idsInput = [], styleNameInput, valueInput, options = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const styleName = normalizeRelationshipStyleName(styleNameInput);
  if (!styleName) return null;
  const relationships = diagram2CanonicalRelationships(state);
  const requestedIds = uniqueStrings(idsInput).filter(id => id !== relationshipGroupId);
  const targetIds = requestedIds.length ? new Set(requestedIds) : new Set(relationships.map(relationship => relationship.id));
  if (styleName === "showSymbols" || options.global === true || requestedIds.includes(relationshipGroupId)) {
    const relationshipStyle = {
      ...(state.relationshipStyle || {}),
      [styleName]: normalizeRelationshipStyleValue(styleName, valueInput)
    };
    const nextState = normalizeDiagram2CanonicalState({ ...state, relationshipStyle });
    return statePlan(
      state,
      nextState,
      relationshipEndpointObjectIds(relationships.filter(relationship => targetIds.has(relationship.id))),
      [...targetIds],
      requestedIds.length ? requestedIds : [relationshipGroupId],
      "Update relationship style"
    );
  }

  const relationshipById = new Map(relationships.map(relationship => [relationship.id, relationship]));
  const affectedObjectIds = new Set();
  const affectedRelationshipIds = [];
  const objects = state.objects.map(object => {
    const entityRelationships = [...targetIds]
      .map(id => relationshipById.get(id))
      .filter(relationship => relationship?.source?.id === object.id);
    if (!entityRelationships.length || object.locked === true) return object;
    affectedObjectIds.add(object.id);
    const updatesByIndex = new Map(entityRelationships.map(relationship => [relationship.foreignKeyIndex, relationship.id]));
    const foreignKeys = (Array.isArray(object.foreignKeys) ? object.foreignKeys : []).map((foreignKey, index) => {
      const relationshipId = updatesByIndex.get(index);
      if (!relationshipId) return foreignKey;
      affectedRelationshipIds.push(relationshipId);
      const styleOverride = normalizeRelationshipStyleOverride({
        ...(foreignKey.styleOverride || {}),
        [styleName]: normalizeRelationshipStyleValue(styleName, valueInput)
      });
      const next = { ...foreignKey };
      if (styleOverride) next.styleOverride = styleOverride;
      else delete next.styleOverride;
      return next;
    });
    return { ...object, foreignKeys };
  });
  const nextState = normalizeDiagram2CanonicalState({ ...state, objects });
  return statePlan(state, nextState, [...affectedObjectIds], affectedRelationshipIds, [...targetIds], "Update relationship style");
}

export function diagram2SetRelationshipTypePlan(stateInput, idInput, relationshipTypeInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const relationship = diagram2RelationshipById(state, idInput);
  if (!relationship || relationship.source?.locked === true) return null;
  const relationshipType = normalizeDiagram2RelationshipType(relationshipTypeInput);
  const objects = state.objects.map(object => {
    if (object.id !== relationship.source.id) return object;
    const foreignKeys = (Array.isArray(object.foreignKeys) ? object.foreignKeys : []).map((foreignKey, index) =>
      index === relationship.foreignKeyIndex ? { ...foreignKey, relationshipType } : foreignKey);
    return { ...object, foreignKeys };
  });
  const nextState = normalizeDiagram2CanonicalState({ ...state, objects });
  return statePlan(state, nextState, [relationship.source.id], [relationship.id], [relationship.id], "Update relationship type");
}

export function diagram2SetRelationshipRoutingOptionsPlan(stateInput, patchInput = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const patch = patchInput && typeof patchInput === "object" ? patchInput : {};
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    ...(Object.hasOwn(patch, "allowOverlappingEntityLines") ? { allowOverlappingEntityLines: patch.allowOverlappingEntityLines === true } : {}),
    ...(Object.hasOwn(patch, "manualEntityRelationshipRoutes") ? { manualEntityRelationshipRoutes: patch.manualEntityRelationshipRoutes === true } : {}),
    ...(Object.hasOwn(patch, "hideAllEntityRelationships") ? { hideAllEntityRelationships: patch.hideAllEntityRelationships === true } : {}),
    ...(Object.hasOwn(patch, "compactEntityRelationshipRouting") ? { compactEntityRelationshipRouting: patch.compactEntityRelationshipRouting === true } : {})
  });
  const relationships = diagram2CanonicalRelationships(state);
  return statePlan(
    state,
    nextState,
    relationshipEndpointObjectIds(relationships),
    relationships.map(relationship => relationship.id),
    [],
    "Update relationship routing"
  );
}

export function diagram2UseCurrentRelationshipRoutePlan(stateInput, idInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const relationship = diagram2RelationshipById(state, idInput);
  if (!relationship || relationship.source?.locked === true) return null;
  const routeModel = createDiagram2RelationshipRouteModel(state, { manualRoutes: false });
  const route = diagram2RelationshipRouteFromModel(relationship, routeModel);
  if (!route?.points?.length) return null;
  return updateRelationshipRouteOverride(state, relationship, route.points, "Use manual relationship route");
}

export function diagram2AdjustRelationshipRoutePlan(stateInput, idInput, segmentIndexInput, axisInput, coordinateInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const relationship = diagram2RelationshipById(state, idInput);
  if (!relationship || relationship.source?.locked === true) return null;
  const baseRoute = relationship.foreignKeySource?.routeOverride?.length
    ? relationship.foreignKeySource.routeOverride
    : diagram2RelationshipRouteFromModel(
        relationship,
        createDiagram2RelationshipRouteModel(state, { manualRoutes: false })
      )?.points;
  const points = adjustAnnotationEntityRelationshipRoute(baseRoute, segmentIndexInput, axisInput, coordinateInput);
  if (!points?.length) return null;
  return updateRelationshipRouteOverride(state, relationship, points, "Adjust manual relationship route");
}

export function diagram2ClearRelationshipRoutePlan(stateInput, idsInput = []) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const ids = new Set(uniqueStrings(idsInput));
  if (!ids.size) return null;
  const relationships = diagram2CanonicalRelationships(state).filter(relationship => ids.has(relationship.id));
  if (!relationships.length) return null;
  const bySourceId = new Map();
  relationships.forEach(relationship => {
    const indexes = bySourceId.get(relationship.source.id) || new Set();
    indexes.add(relationship.foreignKeyIndex);
    bySourceId.set(relationship.source.id, indexes);
  });
  const objects = state.objects.map(object => {
    const indexes = bySourceId.get(object.id);
    if (!indexes || object.locked === true) return object;
    const foreignKeys = (Array.isArray(object.foreignKeys) ? object.foreignKeys : []).map((foreignKey, index) => {
      if (!indexes.has(index)) return foreignKey;
      const next = { ...foreignKey };
      delete next.routeOverride;
      return next;
    });
    return { ...object, foreignKeys };
  });
  const nextState = normalizeDiagram2CanonicalState({ ...state, objects });
  return statePlan(state, nextState, [...bySourceId.keys()], [...ids], [...ids], "Clear manual relationship route");
}

export function diagram2AutoFormatCompactPlan(stateInput, options = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objects = state.objects.map(object => ({ ...object }));
  const originalPositions = new Map(objects.map(object => [object.id, { x: object.x, y: object.y, anchorTable: object.anchorTable === true }]));
  objects.forEach(object => {
    if (object?.type === "entity" && object.locked === true) object.anchorTable = true;
  });
  const result = autoFormatAnnotationEntitiesOrgTree(objects, {
    allowOverlappingLines: state.allowOverlappingEntityLines === true,
    gridSize: state.gridSize,
    relationshipStyle: state.relationshipStyle,
    preferredRootId: options.preferredRootId
  });
  objects.forEach(object => {
    const original = originalPositions.get(object.id);
    if (!original) return;
    if (object.locked === true) {
      object.x = original.x;
      object.y = original.y;
    }
    object.anchorTable = original.anchorTable;
  });
  const affectedObjectIds = objects
    .filter(object => {
      const original = originalPositions.get(object.id);
      return original && (original.x !== object.x || original.y !== object.y);
    })
    .map(object => object.id);
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    compactEntityRelationshipRouting: true,
    objects
  });
  const relationships = diagram2CanonicalRelationships(nextState);
  return {
    ...statePlan(
      state,
      nextState,
      affectedObjectIds,
      relationships.map(relationship => relationship.id),
      options.selectionAfter || [],
      "Auto Format - Compact"
    ),
    diagnostics: result
  };
}

function updateRelationshipRouteOverride(state, relationship, points, label) {
  const objects = state.objects.map(object => {
    if (object.id !== relationship.source.id) return object;
    const foreignKeys = (Array.isArray(object.foreignKeys) ? object.foreignKeys : []).map((foreignKey, index) =>
      index === relationship.foreignKeyIndex ? { ...foreignKey, routeOverride: points } : foreignKey);
    return { ...object, foreignKeys };
  });
  const nextState = normalizeDiagram2CanonicalState({
    ...state,
    manualEntityRelationshipRoutes: true,
    objects
  });
  return statePlan(state, nextState, [relationship.source.id], [relationship.id], [relationship.id], label);
}

function diagram2RelationshipSelectionObject(relationship, globalStyle = {}) {
  const style = relationship.diagram2EffectiveStyle || {};
  return {
    id: relationship.id,
    type: relationshipObjectType,
    name: relationshipName(relationship),
    locked: relationship.source?.locked === true,
    groupId: "",
    sourceEntityId: relationship.source?.id || "",
    sourceFieldName: relationship.sourceField?.name || "",
    targetEntityId: relationship.target?.id || "",
    targetFieldName: relationship.targetField?.name || "",
    relationshipType: normalizeDiagram2RelationshipType(relationship.foreignKey?.relationshipType),
    manualRoute: Array.isArray(relationship.foreignKeySource?.routeOverride) && relationship.foreignKeySource.routeOverride.length > 1,
    stroke: style.stroke || globalStyle.stroke || "#42526b",
    strokeWidth: positiveNumber(style.strokeWidth, 2),
    arrowSize: positiveNumber(style.arrowSize, 10),
    opacity: safeOpacity(style.opacity ?? 1),
    showSymbols: globalStyle?.showSymbols === true
  };
}

function statePlan(previousState, nextState, affectedObjectIds, affectedRelationshipIds, selectionAfter, label) {
  if (!nextState || JSON.stringify(previousState) === JSON.stringify(nextState)) return null;
  return {
    nextState,
    affectedObjectIds: uniqueStrings(affectedObjectIds),
    affectedRelationshipIds: uniqueStrings(affectedRelationshipIds),
    selectionAfter: uniqueStrings(selectionAfter),
    label
  };
}

function entityById(state, idInput) {
  const id = String(idInput || "").trim();
  return (state.objects || []).find(object => object.id === id && object.type === "entity") || null;
}

function entityFieldByName(entity, nameInput) {
  const name = String(nameInput || "").trim().toLowerCase();
  return (Array.isArray(entity?.fields) ? entity.fields : [])
    .find(field => String(field?.name || "").trim().toLowerCase() === name) || null;
}

function replaceSourceFieldRelationship(foreignKeysInput, sourceFieldName, nextForeignKey) {
  const normalizedName = String(sourceFieldName || "").trim().toLowerCase();
  const foreignKeys = Array.isArray(foreignKeysInput) ? foreignKeysInput.slice() : [];
  const existingIndex = foreignKeys.findIndex(foreignKey =>
    (Array.isArray(foreignKey?.columns) ? foreignKey.columns : [])
      .some(column => String(column || "").trim().toLowerCase() === normalizedName));
  if (existingIndex >= 0) {
    foreignKeys[existingIndex] = {
      ...nextForeignKey,
      styleOverride: foreignKeys[existingIndex].styleOverride,
      routeOverride: foreignKeys[existingIndex].routeOverride
    };
    return foreignKeys;
  }
  return foreignKeys.concat(nextForeignKey);
}

function uniqueForeignKeyName(state, sourceEntity, sourceFieldName, targetEntity) {
  const base = `FK_${safeIdentifier(sourceEntity.entityName)}_${safeIdentifier(sourceFieldName)}_${safeIdentifier(targetEntity.entityName)}`;
  const used = new Set((state.objects || [])
    .flatMap(object => Array.isArray(object.foreignKeys) ? object.foreignKeys : [])
    .map(foreignKey => String(foreignKey?.name || "").trim().toLowerCase())
    .filter(Boolean));
  if (!used.has(base.toLowerCase())) return base;
  let index = 2;
  while (used.has(`${base}_${index}`.toLowerCase())) index += 1;
  return `${base}_${index}`;
}

function relationshipEndpointObjectIds(relationships) {
  return uniqueStrings((Array.isArray(relationships) ? relationships : [])
    .flatMap(relationship => [relationship.source?.id, relationship.target?.id]));
}

function relationshipName(relationship) {
  const source = `${formatAnnotationEntityIdentifier(relationship.source?.entitySchema, relationship.source?.entityName)}.${formatAnnotationEntityIdentifier(relationship.sourceField?.name)}`;
  const target = `${formatAnnotationEntityIdentifier(relationship.target?.entitySchema, relationship.target?.entityName)}.${formatAnnotationEntityIdentifier(relationship.targetField?.name)}`;
  return `${source} -> ${target}`;
}

function normalizeRelationshipStyleName(value) {
  const name = String(value || "").trim();
  return ["stroke", "strokeWidth", "arrowSize", "opacity", "showSymbols"].includes(name) ? name : "";
}

function normalizeRelationshipStyleValue(styleName, value) {
  if (styleName === "stroke") return normalizeColor(value) || "#42526b";
  if (styleName === "strokeWidth") return clampNumber(positiveNumber(value, 2), 1, 40);
  if (styleName === "arrowSize") return clampNumber(positiveNumber(value, 10), 6, 160);
  if (styleName === "opacity") return safeOpacity(value);
  if (styleName === "showSymbols") return value === true || String(value).toLowerCase() === "true";
  return value;
}

function normalizeRelationshipStyleOverride(input = {}) {
  const output = {};
  if (Object.hasOwn(input, "stroke")) output.stroke = normalizeRelationshipStyleValue("stroke", input.stroke);
  if (Object.hasOwn(input, "strokeWidth")) output.strokeWidth = normalizeRelationshipStyleValue("strokeWidth", input.strokeWidth);
  if (Object.hasOwn(input, "arrowSize")) output.arrowSize = normalizeRelationshipStyleValue("arrowSize", input.arrowSize);
  if (Object.hasOwn(input, "opacity")) output.opacity = normalizeRelationshipStyleValue("opacity", input.opacity);
  return Object.keys(output).length ? output : null;
}

function safeIdentifier(value) {
  return String(value || "Entity").trim().replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "Entity";
}

function equalsIdentifier(first, second) {
  return String(first || "").trim().toLowerCase() === String(second || "").trim().toLowerCase();
}

function normalizeColor(value) {
  const text = String(value || "").trim();
  const hex = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return "";
  const digits = hex[1].length === 3
    ? hex[1].split("").map(part => part + part).join("")
    : hex[1];
  return `#${digits.toUpperCase()}`;
}

function safeOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return clampNumber(number > 1 ? number / 100 : number, 0, 1);
}

function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
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
