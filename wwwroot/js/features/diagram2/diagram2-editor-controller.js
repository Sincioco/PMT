import { createDiagram2CommandHistory } from "./diagram2-editor-history.js?v=20260726-diagram2-phase2-v1";
import { normalizeDiagram2CanonicalState } from "./diagram2-renderer.js?v=20260726-d2-line-parity-v1";

const keyboardNudgeMergeWindowMilliseconds = 350;

export function createDiagram2EditorController(options = {}) {
  let renderer = options.renderer || null;
  let host = options.host || null;
  let canonicalState = normalizeDiagram2CanonicalState(options.state || null);
  let objectById = new Map();
  let objectIndexById = new Map();
  let canonicalRelationshipCount = diagram2RelationshipCount(canonicalState);
  let selectedObjectIds = [];
  let activeTool = "select";
  let busy = false;
  let destroyed = false;
  let canonicalDiagnostics = {
    fullStateNormalizationCount: 1,
    fullStateSerializationCount: 0,
    stateReplacementCount: 1,
    lastOperation: null
  };
  const listeners = new Set();
  const history = createDiagram2CommandHistory({
    limit: options.historyLimit || 100
  });
  history.reset({ saved: options.saved !== false });
  rebuildCanonicalObjectIndex();

  function attachRenderer(nextRenderer) {
    renderer = nextRenderer || null;
    if (renderer && selectedObjectIds.length) renderer.setSelectedIds(selectedObjectIds);
    emit("renderer");
  }

  function setHost(nextHost) {
    host = nextHost || null;
    emit("host");
  }

  function setState(nextState, setOptions = {}) {
    canonicalState = normalizeDiagram2CanonicalState(nextState);
    canonicalRelationshipCount = diagram2RelationshipCount(canonicalState);
    rebuildCanonicalObjectIndex();
    canonicalDiagnostics = {
      ...canonicalDiagnostics,
      fullStateNormalizationCount: canonicalDiagnostics.fullStateNormalizationCount + 1,
      stateReplacementCount: canonicalDiagnostics.stateReplacementCount + 1,
      lastOperation: {
        kind: "set-state",
        global: true,
        affectedObjectIds: [],
        requestedObjectCount: 0,
        objectLookupCount: 0,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: true,
        fullStateNormalizationCount: 1,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(setOptions.reason || "state replacement")
      }
    };
    selectedObjectIds = existingObjectIds(selectedObjectIds);
    if (setOptions.resetHistory !== false) history.reset({ saved: setOptions.saved !== false });
    if (renderer && selectedObjectIds.length) renderer.setSelectedIds(selectedObjectIds);
    emit("state");
  }

  function setSelection(ids = []) {
    selectedObjectIds = existingObjectIds(ids);
    const diagnostics = renderer?.setSelectedIds?.(selectedObjectIds);
    emit("selection", { diagnostics });
    return selectedObjectIds.slice();
  }

  function setActiveTool(tool) {
    const nextTool = String(tool || "select").trim().toLowerCase();
    activeTool = ["select", "pan"].includes(nextTool) ? nextTool : "select";
    emit("tool");
    return activeTool;
  }

  async function moveSelectedObjects(deltaX, deltaY, commandOptions = {}) {
    return moveObjects(selectedObjectIds, deltaX, deltaY, commandOptions);
  }

  async function moveObjects(objectIds, deltaX, deltaY, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const ids = existingObjectIds(objectIds);
    if (!ids.length) return false;
    if (ids.some(id => objectPositionFixed(getObjectById(id)))) return false;
    const dx = finiteNumber(deltaX, 0);
    const dy = finiteNumber(deltaY, 0);
    if (!dx && !dy) return false;

    const command = createDiagram2MoveCommand({
      objectIds: ids,
      deltaX: dx,
      deltaY: dy,
      label: commandOptions.label || "Move objects",
      reason: commandOptions.reason || "move objects",
      rendererAlreadyUpdated: commandOptions.rendererAlreadyUpdated === true,
      mergeKey: commandOptions.coalesce === true ? `move:${ids.join("|")}` : "",
      mergeWindowMs: commandOptions.coalesce === true ? keyboardNudgeMergeWindowMilliseconds : 0
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function undo() {
    if (busy || destroyed || !canMutate()) return false;
    const before = history.status();
    if (!before.canUndo) return false;
    await history.undo(commandContext());
    selectedObjectIds = existingObjectIds(selectedObjectIds);
    renderer?.setSelectedIds?.(selectedObjectIds);
    emit("history");
    return true;
  }

  async function redo() {
    if (busy || destroyed || !canMutate()) return false;
    const before = history.status();
    if (!before.canRedo) return false;
    await history.redo(commandContext());
    selectedObjectIds = existingObjectIds(selectedObjectIds);
    renderer?.setSelectedIds?.(selectedObjectIds);
    emit("history");
    return true;
  }

  function markSaved() {
    const status = history.markSaved();
    emit("saved");
    return status;
  }

  function setBusy(value) {
    busy = value === true;
    emit("busy");
  }

  function onChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function emit(reason, detail = {}) {
    const snapshot = statusSnapshot();
    listeners.forEach(listener => listener({
      reason,
      ...detail,
      status: snapshot
    }));
  }

  function statusSnapshot() {
    const historyStatus = history.status();
    const security = securityContext();
    const canEdit = canMutate();
    return {
      activeTool,
      busy,
      canRead: security.canRead !== false,
      canEdit,
      canExport: security.canExport !== false && host?.canExport !== false,
      canSave: typeof host?.save === "function" && canEdit,
      hasDocument: security.canRead !== false,
      security,
      dirty: historyStatus.dirty,
      hostKind: host?.kind || "diagram2",
      mode: host?.mode || "diagram-document",
      selectedObjectIds: selectedObjectIds.slice(),
      selectedCount: selectedObjectIds.length,
      objectCount: canonicalState.objects.length,
      relationshipCount: canonicalRelationshipCount,
      history: historyStatus
    };
  }

  function commandContext() {
    return {
      get renderer() {
        return renderer;
      },
      get state() {
        return canonicalState;
      },
      getObjectById,
      getObjectsByIds,
      updateObjectCanonical,
      updateObjectsCanonical,
      addObjectCanonical,
      removeObjectsCanonical,
      setState(nextState) {
        canonicalState = normalizeDiagram2CanonicalState(nextState);
        canonicalRelationshipCount = diagram2RelationshipCount(canonicalState);
        rebuildCanonicalObjectIndex();
        canonicalDiagnostics = {
          ...canonicalDiagnostics,
          fullStateNormalizationCount: canonicalDiagnostics.fullStateNormalizationCount + 1,
          stateReplacementCount: canonicalDiagnostics.stateReplacementCount + 1,
          lastOperation: {
            kind: "set-state",
            global: true,
            affectedObjectIds: [],
            requestedObjectCount: 0,
            objectLookupCount: 0,
            objectPatchCount: 0,
            objectArrayCopyCount: 0,
            objectContainerReindexed: true,
            fullStateNormalizationCount: 1,
            fullStateSerializationCount: 0,
            canonicalObjectCount: canonicalState.objects.length,
            reason: "command context state replacement"
          }
        };
      },
      selectedObjectIds: () => selectedObjectIds.slice(),
      setSelection,
      canMutate,
      securityContext,
      emit
    };
  }

  function currentState() {
    return canonicalState;
  }

  function getObjectById(id) {
    return objectById.get(String(id || "").trim()) || null;
  }

  function getObjectsByIds(ids = []) {
    return existingObjectIds(ids)
      .map(id => objectById.get(id))
      .filter(Boolean);
  }

  function updateObjectCanonical(id, updater, updateOptions = {}) {
    return updateObjectsCanonical([id], updater, updateOptions);
  }

  function updateObjectsCanonical(ids = [], updater, updateOptions = {}) {
    const requestedIds = uniqueStrings(ids);
    const existingIds = requestedIds.filter(id => objectIndexById.has(id));
    if (!existingIds.length) {
      return recordCanonicalOperation({
        kind: "update-objects",
        changed: false,
        affectedObjectIds: [],
        requestedObjectCount: requestedIds.length,
        objectLookupCount: requestedIds.length,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(updateOptions.reason || "object update")
      });
    }

    let nextObjects = null;
    const previousObjectsById = new Map();
    const nextObjectsById = new Map();
    existingIds.forEach((id, ordinal) => {
      const index = objectIndexById.get(id);
      const previousObject = objectById.get(id);
      const nextObject = resolveCanonicalObjectUpdate(previousObject, id, updater, ordinal, updateOptions);
      if (!nextObject || nextObject === previousObject) return;
      if (!nextObjects) nextObjects = canonicalState.objects.slice();
      nextObjects[index] = nextObject;
      previousObjectsById.set(id, previousObject);
      nextObjectsById.set(id, nextObject);
      canonicalRelationshipCount += diagram2ObjectRelationshipCount(nextObject) - diagram2ObjectRelationshipCount(previousObject);
      objectById.set(id, nextObject);
    });

    if (!nextObjectsById.size) {
      return recordCanonicalOperation({
        kind: "update-objects",
        changed: false,
        affectedObjectIds: [],
        requestedObjectCount: requestedIds.length,
        objectLookupCount: existingIds.length,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(updateOptions.reason || "object update")
      });
    }

    canonicalState = {
      ...canonicalState,
      objects: nextObjects
    };
    return recordCanonicalOperation({
      kind: "update-objects",
      changed: true,
      affectedObjectIds: [...nextObjectsById.keys()],
      requestedObjectCount: requestedIds.length,
      objectLookupCount: existingIds.length,
      objectPatchCount: nextObjectsById.size,
      objectArrayCopyCount: 1,
      objectContainerReindexed: false,
      fullStateNormalizationCount: 0,
      fullStateSerializationCount: 0,
      canonicalObjectCount: canonicalState.objects.length,
      previousObjectsById,
      nextObjectsById,
      reason: String(updateOptions.reason || "object update")
    });
  }

  function addObjectCanonical(object, addOptions = {}) {
    const objectId = String(object?.id || "").trim();
    if (!objectId) {
      return recordCanonicalOperation({
        kind: "add-object",
        changed: false,
        affectedObjectIds: [],
        requestedObjectCount: 1,
        objectLookupCount: 0,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(addOptions.reason || "add object")
      });
    }
    if (objectIndexById.has(objectId)) {
      return updateObjectCanonical(objectId, object, {
        ...addOptions,
        replace: true,
        reason: addOptions.reason || "replace object"
      });
    }

    const nextObject = { ...object, id: objectId };
    const nextObjects = canonicalState.objects.concat(nextObject);
    canonicalState = {
      ...canonicalState,
      objects: nextObjects
    };
    objectIndexById.set(objectId, nextObjects.length - 1);
    objectById.set(objectId, nextObject);
    canonicalRelationshipCount += diagram2ObjectRelationshipCount(nextObject);
    return recordCanonicalOperation({
      kind: "add-object",
      changed: true,
      affectedObjectIds: [objectId],
      requestedObjectCount: 1,
      objectLookupCount: 0,
      objectPatchCount: 1,
      objectArrayCopyCount: 1,
      objectContainerReindexed: false,
      fullStateNormalizationCount: 0,
      fullStateSerializationCount: 0,
      canonicalObjectCount: canonicalState.objects.length,
      previousObjectsById: new Map(),
      nextObjectsById: new Map([[objectId, nextObject]]),
      reason: String(addOptions.reason || "add object")
    });
  }

  function removeObjectsCanonical(ids = [], removeOptions = {}) {
    const idsToRemove = new Set(existingObjectIds(ids));
    if (!idsToRemove.size) {
      return recordCanonicalOperation({
        kind: "remove-objects",
        changed: false,
        affectedObjectIds: [],
        requestedObjectCount: uniqueStrings(ids).length,
        objectLookupCount: uniqueStrings(ids).length,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(removeOptions.reason || "remove objects")
      });
    }

    const previousObjectsById = new Map();
    const nextObjects = canonicalState.objects.filter(object => {
      if (!idsToRemove.has(object.id)) return true;
      previousObjectsById.set(object.id, object);
      return false;
    });
    canonicalState = {
      ...canonicalState,
      objects: nextObjects
    };
    previousObjectsById.forEach(object => {
      canonicalRelationshipCount -= diagram2ObjectRelationshipCount(object);
    });
    rebuildCanonicalObjectIndex();
    selectedObjectIds = existingObjectIds(selectedObjectIds);
    return recordCanonicalOperation({
      kind: "remove-objects",
      changed: true,
      affectedObjectIds: [...previousObjectsById.keys()],
      requestedObjectCount: uniqueStrings(ids).length,
      objectLookupCount: idsToRemove.size,
      objectPatchCount: previousObjectsById.size,
      objectArrayCopyCount: 1,
      objectContainerReindexed: true,
      fullStateNormalizationCount: 0,
      fullStateSerializationCount: 0,
      canonicalObjectCount: canonicalState.objects.length,
      canonicalRelationshipCount,
      previousObjectsById,
      nextObjectsById: new Map(),
      reason: String(removeOptions.reason || "remove objects")
    });
  }

  function securityContext() {
    const security = host?.security && typeof host.security === "object" ? host.security : {};
    return {
      resource: String(security.resource || "Documentation"),
      canRead: security.canRead !== false,
      canCreate: security.canCreate === true,
      canUpdate: security.canUpdate === true && host?.canEdit !== false,
      canDelete: security.canDelete === true,
      canImport: security.canImport === true,
      canExport: security.canExport !== false
    };
  }

  function canMutate() {
    return securityContext().canUpdate === true;
  }

  function objectPositionFixed(object) {
    return host?.fixedOriginalImage === true
      && object?.type === "embedded-image"
      && object.isOriginalImage === true;
  }

  function existingObjectIds(ids) {
    return uniqueStrings(ids).filter(id => objectIndexById.has(id));
  }

  function rebuildCanonicalObjectIndex() {
    objectById = new Map();
    objectIndexById = new Map();
    canonicalState.objects.forEach((object, index) => {
      const id = String(object?.id || "").trim();
      if (!id || objectIndexById.has(id)) return;
      objectById.set(id, object);
      objectIndexById.set(id, index);
    });
  }

  function resolveCanonicalObjectUpdate(previousObject, id, updater, ordinal, updateOptions = {}) {
    if (!previousObject) return null;
    const patch = typeof updater === "function"
      ? updater(previousObject, id, ordinal)
      : updater;
    if (!patch || typeof patch !== "object") return previousObject;
    if (patch === previousObject) return previousObject;
    return updateOptions.replace === true
      ? { ...patch, id }
      : { ...previousObject, ...patch, id };
  }

  function recordCanonicalOperation(operation) {
    canonicalDiagnostics = {
      ...canonicalDiagnostics,
      lastOperation: operation
    };
    return operation;
  }

  function diagnostics() {
    return {
      canonicalObjectCount: canonicalState.objects.length,
      canonicalIndexSize: objectIndexById.size,
      fullStateNormalizationCount: canonicalDiagnostics.fullStateNormalizationCount,
      fullStateSerializationCount: canonicalDiagnostics.fullStateSerializationCount,
      stateReplacementCount: canonicalDiagnostics.stateReplacementCount,
      lastCanonicalOperation: canonicalDiagnostics.lastOperation
    };
  }

  function destroy() {
    destroyed = true;
    listeners.clear();
    renderer = null;
    host = null;
  }

  return {
    attachRenderer,
    setHost,
    setState,
    setSelection,
    setActiveTool,
    getObjectById,
    getObjectsByIds,
    updateObjectCanonical,
    updateObjectsCanonical,
    addObjectCanonical,
    removeObjectsCanonical,
    moveSelectedObjects,
    moveObjects,
    undo,
    redo,
    markSaved,
    setBusy,
    onChange,
    statusSnapshot,
    currentState,
    state: () => normalizeDiagram2CanonicalState(canonicalState),
    selectedObjectIds: () => selectedObjectIds.slice(),
    activeTool: () => activeTool,
    historyStatus: () => history.status(),
    diagnostics,
    destroy
  };
}

export function createDiagram2MoveCommand(options = {}) {
  const objectIds = uniqueStrings(options.objectIds);
  const deltaX = finiteNumber(options.deltaX, 0);
  const deltaY = finiteNumber(options.deltaY, 0);
  const reason = String(options.reason || "move objects").trim() || "move objects";
  const label = String(options.label || "Move objects").trim() || "Move objects";
  const createdAt = Date.now();
  const rendererAlreadyUpdated = options.rendererAlreadyUpdated === true;
  const mergeKey = String(options.mergeKey || "");
  const mergeWindowMs = Number(options.mergeWindowMs || 0);

  return {
    kind: "move-objects",
    label,
    objectIds,
    deltaX,
    deltaY,
    reason,
    createdAt,
    mergeKey,
    mergeWindowMs,
    apply(context) {
      return applyDiagram2Move(context, objectIds, deltaX, deltaY, {
        reason,
        rendererAlreadyUpdated
      });
    },
    undo(context) {
      return applyDiagram2Move(context, objectIds, -deltaX, -deltaY, {
        reason: `${reason} undo`
      });
    },
    redo(context) {
      return applyDiagram2Move(context, objectIds, deltaX, deltaY, {
        reason: `${reason} redo`
      });
    },
    mergeWith(next) {
      if (!next || next.kind !== "move-objects") return null;
      if (objectIds.join("|") !== uniqueStrings(next.objectIds).join("|")) return null;
      return createDiagram2MoveCommand({
        objectIds,
        deltaX: deltaX + finiteNumber(next.deltaX, 0),
        deltaY: deltaY + finiteNumber(next.deltaY, 0),
        label,
        reason,
        mergeKey,
        mergeWindowMs,
        rendererAlreadyUpdated: false
      });
    }
  };
}

export function moveDiagram2ObjectsInState(stateInput, objectIds, deltaX, deltaY) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const selectedIds = new Set(uniqueStrings(objectIds));
  if (!selectedIds.size) return state;
  return normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object =>
      selectedIds.has(object.id) ? moveDiagram2ObjectGeometry(object, deltaX, deltaY) : object)
  });
}

export function moveDiagram2ObjectGeometry(object, deltaX, deltaY) {
  const dx = finiteNumber(deltaX, 0);
  const dy = finiteNumber(deltaY, 0);
  const next = { ...object };
  if (hasOwn(next, "x") || hasOwn(next, "y") || (!hasOwn(next, "x1") && !hasOwn(next, "x2"))) {
    next.x = finiteNumber(next.x, 0) + dx;
    next.y = finiteNumber(next.y, 0) + dy;
    if (next.type === "embedded-image" && next.imageClip && typeof next.imageClip === "object") {
      next.imageClip = translateDiagram2Bounds(next.imageClip, dx, dy);
    }
  }
  if (hasOwn(next, "x1")) next.x1 = finiteNumber(next.x1, 0) + dx;
  if (hasOwn(next, "y1")) next.y1 = finiteNumber(next.y1, 0) + dy;
  if (hasOwn(next, "x2")) next.x2 = finiteNumber(next.x2, 0) + dx;
  if (hasOwn(next, "y2")) next.y2 = finiteNumber(next.y2, 0) + dy;
  return next;
}

async function applyDiagram2Move(context, objectIds, deltaX, deltaY, options = {}) {
  const update = context.updateObjectsCanonical(objectIds, object =>
    moveDiagram2ObjectGeometry(object, deltaX, deltaY), {
      reason: options.reason || "move objects"
    });
  if (update.changed !== true) return false;

  const renderer = context.renderer;
  if (renderer && options.rendererAlreadyUpdated !== true) {
    renderer.beginDiagramUpdate(options.reason || "move objects");
    objectIds.forEach(id => {
      renderer.updateObject(id, object => moveDiagram2ObjectGeometry(object, deltaX, deltaY));
    });
    renderer.endDiagramUpdate(options.reason || "move objects");
  }

  context.setSelection(objectIds);
  return true;
}

function diagram2RelationshipCount(state) {
  return state.objects.reduce((count, object) =>
    count + (Array.isArray(object.relationships) ? object.relationships.length : 0), 0);
}

function diagram2ObjectRelationshipCount(object) {
  return Array.isArray(object?.relationships) ? object.relationships.length : 0;
}

function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : [values])
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .forEach(value => {
      if (seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });
  return result;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function translateDiagram2Bounds(bounds, deltaX, deltaY) {
  return {
    x: finiteNumber(bounds?.x, 0) + finiteNumber(deltaX, 0),
    y: finiteNumber(bounds?.y, 0) + finiteNumber(deltaY, 0),
    width: Math.max(1, finiteNumber(bounds?.width, 1)),
    height: Math.max(1, finiteNumber(bounds?.height, 1))
  };
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}
