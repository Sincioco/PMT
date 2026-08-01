import {
  setAnnotationEntityAnnotation,
  syncAnnotationEntityAnnotationArrows
} from "../../components/image-annotation.js?v=20260802-diagram2-phase7-roundtrip-v1";

export function diagram2EntityAnnotationChildren(objectsInput, entityOrId) {
  const entityId = String(typeof entityOrId === "object" ? entityOrId?.id : entityOrId || "").trim();
  if (!entityId) return [];
  return (Array.isArray(objectsInput) ? objectsInput : [])
    .filter(object => object?.entityAnnotationOwnerId === entityId
      && ["callout", "arrow"].includes(object.entityAnnotationRole));
}

export function createDiagram2EntityAnnotationPlan(stateInput, entityIdInput, value, options = {}) {
  const source = stateInput && typeof stateInput === "object" ? stateInput : {};
  const objects = Array.isArray(source.objects) ? source.objects : [];
  const entityId = String(entityIdInput || "").trim();
  const entity = objects.find(object => object?.id === entityId
    && object.type === "entity"
    && object.entityKind !== "field-rectangle");
  if (!entity) return null;

  const children = diagram2EntityAnnotationChildren(objects, entityId);
  const beforeObjects = [entity, ...children].map(cloneValue);
  const groupIds = new Set([
    entity.groupId,
    entity.entityAnnotationGroupId,
    ...children.map(child => child.groupId)
  ].filter(Boolean));
  const localState = {
    width: positiveNumber(source.width, 1),
    height: positiveNumber(source.height, 1),
    objects: beforeObjects.map(cloneValue),
    groupNames: pickRecord(source.groupNames, groupIds),
    groupVisibility: pickBooleanRecord(source.groupVisibility, groupIds)
  };
  const result = setAnnotationEntityAnnotation(localState, entityId, value, {
    showArrow: options.showArrow !== false
  });
  syncAnnotationEntityAnnotationArrows(localState);
  const afterEntity = localState.objects.find(object => object.id === entityId);
  if (!afterEntity) return null;
  const afterChildren = diagram2EntityAnnotationChildren(localState.objects, entityId);
  const afterObjects = [afterEntity, ...afterChildren].map(cloneValue);
  const afterGroupIds = new Set([
    ...groupIds,
    afterEntity.groupId,
    afterEntity.entityAnnotationGroupId,
    ...afterChildren.map(child => child.groupId)
  ].filter(Boolean));

  return {
    kind: "entity-annotation",
    ownerId: entityId,
    beforeObjects,
    afterObjects,
    removedObjectIds: beforeObjects
      .map(object => object.id)
      .filter(id => !afterObjects.some(object => object.id === id)),
    beforeGroupNames: pickRecord(source.groupNames, afterGroupIds),
    afterGroupNames: pickRecord(localState.groupNames, afterGroupIds),
    beforeGroupVisibility: pickBooleanRecord(source.groupVisibility, afterGroupIds),
    afterGroupVisibility: pickBooleanRecord(localState.groupVisibility, afterGroupIds),
    createdCount: result.createdCount || 0,
    removedCount: result.removedCount || 0
  };
}

export function createDiagram2EntityAnnotationIndexes(objectsInput = []) {
  const childrenByOwnerId = new Map();
  const ownerIdByChildId = new Map();
  (Array.isArray(objectsInput) ? objectsInput : []).forEach(object => {
    const ownerId = String(object?.entityAnnotationOwnerId || "").trim();
    if (!ownerId) return;
    const children = childrenByOwnerId.get(ownerId) || [];
    children.push(object.id);
    childrenByOwnerId.set(ownerId, children);
    ownerIdByChildId.set(object.id, ownerId);
  });
  return { childrenByOwnerId, ownerIdByChildId };
}

function pickRecord(input, ids) {
  const source = input && typeof input === "object" ? input : {};
  return Object.fromEntries([...ids]
    .filter(id => Object.hasOwn(source, id))
    .map(id => [id, String(source[id] || "")]));
}

function pickBooleanRecord(input, ids) {
  const source = input && typeof input === "object" ? input : {};
  return Object.fromEntries([...ids]
    .filter(id => Object.hasOwn(source, id))
    .map(id => [id, source[id] !== false]));
}

function cloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
