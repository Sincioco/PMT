import {
  buildAnnotationObjectTree,
  compactAnnotationGroupLayers,
  filterAnnotationObjectTree,
  reorderAnnotationObjectTree
} from "../../components/image-annotation.js?v=20260802-diagram2-phase7-roundtrip-v1";
import {
  diagram2CanonicalRelationships,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260802-diagram2-phase7-roundtrip-v1";
import { diagram2RelationshipRouteKey } from "./diagram2-routing.js?v=20260802-diagram2-phase7-roundtrip-v1";

export function diagram2ObjectTreeNodes(stateInput, query = "") {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const nodes = normalizeDiagram2RelationshipTreeNodes(
    buildAnnotationObjectTree(state),
    diagram2CanonicalRelationships(state)
  );
  return filterAnnotationObjectTree(nodes, query);
}

export function diagram2ObjectTreeNodeSelectionIds(stateInput, kindInput, idInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const kind = normalizeStructureKind(kindInput);
  const id = String(idInput || "").trim();
  if (!id) return [];
  if (kind === "group") {
    return state.objects
      .filter(object => object.groupId === id)
      .map(object => object.id);
  }
  if (kind === "object") {
    return state.objects.some(object => object.id === id) ? [id] : [];
  }
  if (kind === "relationships") {
    return diagram2CanonicalRelationships(state).map(relationship => relationship.id);
  }
  if (kind === "relationship") {
    return diagram2CanonicalRelationships(state).some(relationship => relationship.id === id) ? [id] : [];
  }
  return [];
}

export function diagram2ExpandGroupSelectionIds(stateInput, idsInput = []) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const requested = uniqueStrings(idsInput);
  const objectsById = new Map(state.objects.map(object => [object.id, object]));
  const result = [];
  const selected = new Set();
  const add = id => {
    if (!id || selected.has(id) || !objectsById.has(id)) return;
    selected.add(id);
    result.push(id);
  };

  requested.forEach(id => {
    const object = objectsById.get(id);
    if (!object) return;
    if (object.groupId) {
      state.objects
        .filter(candidate => candidate.groupId === object.groupId)
        .forEach(candidate => add(candidate.id));
      return;
    }
    add(id);
  });
  return result;
}

export function diagram2GroupSelectionPlan(stateInput, idsInput = []) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const ids = uniqueStrings(idsInput);
  const selected = state.objects.filter(object => ids.includes(object.id));
  if (selected.length < 2 || selected.some(object => object.locked === true)) return null;

  const groupId = diagram2GroupId("group");
  const groupName = nextDiagram2GroupName(state);
  const selectedIds = new Set(selected.map(object => object.id));
  const objects = state.objects.map(object =>
    selectedIds.has(object.id)
      ? { ...object, groupId, groupHitTransparent: true }
      : object);
  compactAnnotationGroupLayers(objects);
  return {
    nextState: {
      ...state,
      objects,
      groupNames: { ...(state.groupNames || {}), [groupId]: groupName },
      groupVisibility: { ...(state.groupVisibility || {}), [groupId]: true }
    },
    affectedObjectIds: selected.map(object => object.id),
    selectionAfter: selected.map(object => object.id),
    groupId,
    groupName
  };
}

export function diagram2UngroupSelectionPlan(stateInput, idsInput = []) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const ids = new Set(diagram2ExpandGroupSelectionIds(state, idsInput));
  const groupIds = new Set(
    state.objects
      .filter(object => ids.has(object.id) && object.groupId)
      .map(object => object.groupId)
  );
  if (!groupIds.size) return null;

  const affectedObjectIds = state.objects
    .filter(object => groupIds.has(object.groupId))
    .map(object => object.id);
  if (!affectedObjectIds.length) return null;
  const affectedSet = new Set(affectedObjectIds);
  const objects = state.objects.map(object => {
    if (!affectedSet.has(object.id)) return object;
    const { groupId, groupHitTransparent, ...rest } = object;
    return rest;
  });
  const groupNames = { ...(state.groupNames || {}) };
  const groupVisibility = { ...(state.groupVisibility || {}) };
  groupIds.forEach(groupId => {
    delete groupNames[groupId];
    delete groupVisibility[groupId];
  });
  return {
    nextState: {
      ...state,
      objects,
      groupNames,
      groupVisibility
    },
    affectedObjectIds,
    selectionAfter: affectedObjectIds
  };
}

export function diagram2RenameStructurePlan(stateInput, kindInput, idInput, nameInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const kind = normalizeStructureKind(kindInput);
  const id = String(idInput || "").trim();
  const name = String(nameInput || "").trim().slice(0, 120);
  if (!id || !name) return null;

  if (kind === "group") {
    if (!state.objects.some(object => object.groupId === id)) return null;
    const current = String(state.groupNames?.[id] || "").trim();
    if (current === name) return null;
    return {
      nextState: {
        ...state,
        groupNames: { ...(state.groupNames || {}), [id]: name }
      },
      affectedObjectIds: state.objects.filter(object => object.groupId === id).map(object => object.id),
      selectionAfter: state.objects.filter(object => object.groupId === id).map(object => object.id)
    };
  }

  if (kind !== "object") return null;
  const object = state.objects.find(candidate => candidate.id === id);
  if (!object || object.locked === true || String(object.name || "").trim() === name) return null;
  return {
    nextState: {
      ...state,
      objects: state.objects.map(candidate =>
        candidate.id === id ? { ...candidate, name } : candidate)
    },
    affectedObjectIds: [id],
    selectionAfter: [id]
  };
}

export function diagram2SetStructureVisibilityPlan(stateInput, kindInput, idInput, visibleInput = null) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const kind = normalizeStructureKind(kindInput);
  const id = String(idInput || "").trim();
  if (!id) return null;

  if (kind === "group") {
    const affectedObjectIds = state.objects
      .filter(object => object.groupId === id)
      .map(object => object.id);
    if (!affectedObjectIds.length) return null;
    const current = state.groupVisibility?.[id] !== false;
    const visible = visibleInput == null ? !current : visibleInput === true;
    if (current === visible) return null;
    return {
      nextState: {
        ...state,
        groupVisibility: { ...(state.groupVisibility || {}), [id]: visible }
      },
      affectedObjectIds,
      selectionAfter: visible ? affectedObjectIds : []
    };
  }

  if (kind !== "object") return null;
  const object = state.objects.find(candidate => candidate.id === id);
  if (!object) return null;
  const current = object.visible !== false;
  const visible = visibleInput == null ? !current : visibleInput === true;
  if (current === visible) return null;
  return {
    nextState: {
      ...state,
      objects: state.objects.map(candidate =>
        candidate.id === id ? { ...candidate, visible } : candidate)
    },
    affectedObjectIds: [id],
    selectionAfter: visible ? [id] : []
  };
}

export function diagram2ReorderStructurePlan(stateInput, moveInput = {}) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const nextState = reorderAnnotationObjectTree(state, {
    draggedKind: normalizeStructureKind(moveInput.draggedKind),
    draggedId: moveInput.draggedId,
    targetKind: normalizeStructureKind(moveInput.targetKind, "root"),
    targetId: moveInput.targetId,
    targetPlacement: moveInput.targetPlacement
  });
  const affectedObjectIds = changedStructureObjectIds(state, nextState);
  if (!affectedObjectIds.length && sameRecord(state.groupNames, nextState.groupNames)
    && sameRecord(state.groupVisibility, nextState.groupVisibility)) return null;
  return {
    nextState,
    affectedObjectIds,
    selectionAfter: diagram2ObjectTreeNodeSelectionIds(
      nextState,
      moveInput.draggedKind,
      moveInput.draggedId
    )
  };
}

export function diagram2LayerOrderPlan(stateInput, idsInput = [], actionInput = "") {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const objectIds = diagram2ExpandGroupSelectionIds(state, idsInput);
  const action = normalizeDiagram2LayerAction(actionInput);
  if (!action || !objectIds.length) return null;
  const selected = new Set(objectIds);
  const objects = state.objects.slice();

  if (action === "front" || action === "back") {
    const moving = objects.filter(object => selected.has(object.id));
    const remaining = objects.filter(object => !selected.has(object.id));
    objects.splice(0, objects.length, ...(action === "front" ? [...remaining, ...moving] : [...moving, ...remaining]));
  } else if (action === "forward") {
    for (let index = objects.length - 2; index >= 0; index -= 1) {
      if (selected.has(objects[index].id) && !selected.has(objects[index + 1].id)) {
        [objects[index], objects[index + 1]] = [objects[index + 1], objects[index]];
      }
    }
  } else if (action === "backward") {
    for (let index = 1; index < objects.length; index += 1) {
      if (selected.has(objects[index].id) && !selected.has(objects[index - 1].id)) {
        [objects[index], objects[index - 1]] = [objects[index - 1], objects[index]];
      }
    }
  }

  compactAnnotationGroupLayers(objects);
  const nextOrder = objects.map(object => object.id);
  const previousOrder = state.objects.map(object => object.id);
  if (previousOrder.every((id, index) => id === nextOrder[index])) return null;
  return {
    objectIds,
    previousOrder,
    nextOrder,
    action
  };
}

export function normalizeDiagram2LayerAction(value) {
  const action = String(value || "").trim().toLowerCase();
  return ["front", "back", "forward", "backward"].includes(action) ? action : "";
}

export function diagram2LayerActionLabel(action) {
  return {
    front: "Bring to front",
    back: "Send to back",
    forward: "Bring forward",
    backward: "Send backward"
  }[normalizeDiagram2LayerAction(action)] || "Arrange objects";
}

export function createDiagram2StructureStateCommand(options = {}) {
  const nextState = normalizeDiagram2CanonicalState(options.nextState);
  const affectedObjectIds = uniqueStrings(options.affectedObjectIds);
  const affectedRelationshipIds = uniqueStrings(options.affectedRelationshipIds);
  const selectionAfter = uniqueStrings(options.selectionAfter);
  const label = String(options.label || "Change structure").trim() || "Change structure";
  const reason = String(options.reason || "change structure").trim() || "change structure";
  const createdAt = Date.now();
  let previousState = null;
  let previousSelection = [];

  const applyState = (context, state, selectedIds, operationReason, capturePrevious = false) => {
    if (capturePrevious) {
      previousState = normalizeDiagram2CanonicalState(context.state);
      previousSelection = context.selectedObjectIds();
    }
    const update = context.setStructureStateCanonical(state, {
      affectedObjectIds,
      affectedRelationshipIds,
      replaceState: true,
      reason: operationReason
    });
    if (update.changed !== true) return false;
    const renderer = context.renderer;
    renderer?.beginDiagramUpdate?.(operationReason);
    renderer?.setStructureState?.(context.state, {
      affectedObjectIds: update.affectedObjectIds,
      affectedRelationshipIds,
      reason: operationReason
    });
    context.setSelection(selectedIds, { expandGroups: false });
    renderer?.endDiagramUpdate?.(operationReason);
    return true;
  };

  return {
    kind: "structure-state",
    label,
    reason,
    affectedObjectIds,
    affectedRelationshipIds,
    createdAt,
    apply(context) {
      return applyState(context, nextState, selectionAfter, reason, true);
    },
    undo(context) {
      return previousState
        ? applyState(context, previousState, previousSelection, `${reason} undo`)
        : false;
    },
    redo(context) {
      return applyState(context, nextState, selectionAfter, `${reason} redo`);
    }
  };
}

export function changedStructureObjectIds(previousStateInput, nextStateInput) {
  const previousState = normalizeDiagram2CanonicalState(previousStateInput);
  const nextState = normalizeDiagram2CanonicalState(nextStateInput);
  const previousIndex = new Map(previousState.objects.map((object, index) => [object.id, { object, index }]));
  const nextIndex = new Map(nextState.objects.map((object, index) => [object.id, { object, index }]));
  const changed = new Set();
  previousIndex.forEach((previous, id) => {
    const next = nextIndex.get(id);
    if (!next) {
      changed.add(id);
      return;
    }
    if (previous.index !== next.index
      || previous.object.groupId !== next.object.groupId
      || previous.object.groupHitTransparent !== next.object.groupHitTransparent
      || previous.object.visible !== next.object.visible
      || previous.object.name !== next.object.name
      || previous.object.locked !== next.object.locked) {
      changed.add(id);
    }
  });
  nextIndex.forEach((_next, id) => {
    if (!previousIndex.has(id)) changed.add(id);
  });
  return [...changed];
}

export function pruneDiagram2GroupMetadata(stateInput) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const groupIds = new Set(state.objects.map(object => object.groupId).filter(Boolean));
  const groupNames = {};
  const groupVisibility = {};
  groupIds.forEach(groupId => {
    const name = String(state.groupNames?.[groupId] || "").trim();
    if (name) groupNames[groupId] = name;
    groupVisibility[groupId] = state.groupVisibility?.[groupId] !== false;
  });
  return {
    ...state,
    groupNames,
    groupVisibility
  };
}

function normalizeDiagram2RelationshipTreeNodes(nodesInput = [], relationshipsInput = []) {
  const relationshipIdByKey = new Map((Array.isArray(relationshipsInput) ? relationshipsInput : [])
    .map(relationship => [diagram2RelationshipRouteKey(relationship), relationship.id]));
  const normalizeNode = node => {
    if (!node || typeof node !== "object") return node;
    if (node.kind === "relationship") {
      const id = relationshipIdByKey.get(diagram2RelationshipRouteKey(node.relationship)) || node.id;
      return {
        ...node,
        id,
        object: node.object && typeof node.object === "object"
          ? { ...node.object, id, type: "entity-relationship" }
          : node.object
      };
    }
    if (node.kind === "relationships") {
      const children = (Array.isArray(node.children) ? node.children : []).map(normalizeNode);
      return {
        ...node,
        children,
        allChildren: children,
        count: children.length
      };
    }
    if (node.kind === "group") {
      const children = (Array.isArray(node.children) ? node.children : []).map(normalizeNode);
      const allChildren = (Array.isArray(node.allChildren) ? node.allChildren : node.children || []).map(normalizeNode);
      return { ...node, children, allChildren };
    }
    return node;
  };
  return (Array.isArray(nodesInput) ? nodesInput : []).map(normalizeNode);
}

function normalizeStructureKind(value, fallback = "object") {
  const kind = String(value || "").trim().toLowerCase();
  return ["object", "group", "relationships", "relationship", "root"].includes(kind)
    ? kind
    : fallback;
}

function nextDiagram2GroupName(state) {
  const names = new Set(Object.values(state.groupNames || {})
    .map(name => String(name || "").trim().toLowerCase())
    .filter(Boolean));
  let index = 1;
  while (names.has(`group ${index}`)) index += 1;
  return `Group ${index}`;
}

function diagram2GroupId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sameRecord(first, second) {
  const firstRecord = first && typeof first === "object" ? first : {};
  const secondRecord = second && typeof second === "object" ? second : {};
  const keys = new Set([...Object.keys(firstRecord), ...Object.keys(secondRecord)]);
  for (const key of keys) {
    if (firstRecord[key] !== secondRecord[key]) return false;
  }
  return true;
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
