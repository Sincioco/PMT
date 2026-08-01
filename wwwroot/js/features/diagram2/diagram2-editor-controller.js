import { createDiagram2CommandHistory } from "./diagram2-editor-history.js?v=20260726-diagram2-phase2-v1";
import {
  diagram2CanonicalRelationships,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260731-diagram2-rte-interactions-v1";
import {
  createDiagram2EmbeddedImage
} from "./diagram2-editor-images.js?v=20260731-rte-checkbox-layout-v2";
import {
  diagram2ImageEffectiveClip,
  permanentlyCropDiagram2Image
} from "./diagram2-editor-crop.js?v=20260731-diagram2-crop-preview-v1";
import {
  createDiagram2EntityAnnotationIndexes,
  createDiagram2EntityAnnotationPlan
} from "./diagram2-editor-entity-annotations.js?v=20260731-rte-checkbox-layout-v2";
import {
  createDiagram2FieldRectangle,
  diagram2FieldRectangleMapping,
  isDiagram2FieldRectangle,
  renameDiagram2FieldRectangle,
  setDiagram2FieldRectangleConnectionSide,
  setDiagram2FieldRectangleMapping
} from "./diagram2-editor-field-rectangles.js?v=20260731-rte-checkbox-layout-v2";
import {
  createDiagram2FieldMappingIndexes,
  patchDiagram2FieldMappingIndexes
} from "./diagram2-editor-field-mappings.js?v=20260801-diagram2-mapping-view-v3";
import {
  createDiagram2FieldMappingTable,
  planDiagram2FieldMappingTableSync,
  syncDiagram2FieldMappingTableForFieldRectangle,
  syncDiagram2FieldMappingTableForImage
} from "./diagram2-editor-field-mapping-tables.js?v=20260801-diagram2-mapping-view-v3";
import {
  createDiagram2SelectionClipboardText,
  parseDiagram2SelectionClipboardText,
  remapDiagram2SelectionClipboardPackageIds
} from "./diagram2-compatibility.js?v=20260731-rte-checkbox-layout-v2";
import {
  createDiagram2EntityObject,
  diagram2AddEntityFieldPlan,
  diagram2ApplyEntityDefinitionPlan,
  diagram2MoveEntityFieldPlan,
  diagram2RemoveEntityFieldPlan,
  diagram2ResetEntityScalePlan,
  diagram2SetEntityFieldReferencePlan,
  diagram2SetEntityOptionPlan,
  diagram2UpdateEntityFieldPlan
} from "./diagram2-editor-entities.js?v=20260731-rte-checkbox-layout-v2";
import {
  createDiagram2StructureStateCommand,
  diagram2GroupSelectionPlan,
  diagram2LayerActionLabel as diagram2StructureLayerActionLabel,
  diagram2LayerOrderPlan,
  diagram2ObjectTreeNodeSelectionIds,
  diagram2RenameStructurePlan,
  diagram2ReorderStructurePlan,
  diagram2SetStructureVisibilityPlan,
  diagram2UngroupSelectionPlan,
  pruneDiagram2GroupMetadata
} from "./diagram2-editor-structure.js?v=20260731-rte-checkbox-layout-v2";
import {
  applyDiagram2DrawingDefault,
  applyDiagram2TemplateFormat,
  diagram2DrawingDefaultFromObject,
  instantiateDiagram2TemplateObjects,
  normalizeDiagram2DrawingDefaults
} from "./diagram2-editor-templates.js?v=20260731-rte-checkbox-layout-v2";
import { runDiagram2CompactEngine } from "./diagram2-compact-engine.js?v=20260731-rte-checkbox-layout-v2";
import {
  diagram2AddRelationshipPlan,
  diagram2ClearRelationshipRoutePlan,
  diagram2CompactAvailability,
  diagram2DeleteRelationshipsPlan,
  diagram2InsertRelationshipRoutePointPlan,
  diagram2RelationshipSelectionObject,
  diagram2RemoveRelationshipRoutePointPlan,
  diagram2SetRelationshipRoutingOptionsPlan,
  diagram2SetRelationshipStylePlan,
  diagram2SetRelationshipTypePlan,
  diagram2UseCurrentRelationshipRoutePlan
} from "./diagram2-editor-relationships.js?v=20260731-rte-checkbox-layout-v2";
import {
  adjustDiagram2RelationshipRoutePoints,
  compactDiagram2RelationshipPoints,
  diagram2RelationshipPath
} from "./diagram2-routing.js?v=20260731-rte-checkbox-layout-v2";
import { normalizeRichHtml } from "../../shared/text-and-links.js?v=20260722-rte-toggle-state-v1";

const keyboardNudgeMergeWindowMilliseconds = 350;
const styleMergeWindowMilliseconds = 500;
const minimumDiagram2ObjectSize = 8;
const diagram2CompactWorkerModuleUrl = "./diagram2-compact-worker.js?v=20260731-rte-checkbox-layout-v2";
const diagram2CoreDrawingTools = new Set(["rectangle", "circle", "arrow", "line", "textbox", "rich-text", "entity", "field-rectangle"]);
const defaultDiagram2DrawingStyles = {
  fill: "#5aa315",
  stroke: "#3f7f0d",
  textColor: "#ffffff",
  fontFamily: "Arial",
  fontSize: 28,
  textAlign: "left",
  textVerticalAlign: "top",
  outlineVisible: true,
  opacity: 1,
  strokeWidth: 4,
  arrowSize: 24
};
const defaultDiagram2CanvasCenter = { x: 800, y: 450 };
const defaultDiagram2FieldMappingStyles = {
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
const diagram2StyleTargets = new Map([
  ["fill", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle"])],
  ["stroke", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table", "arrow", "line", "entity-relationship", "entity-relationships"])],
  ["outlineVisible", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table"])],
  ["strokeWidth", new Set(["rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table", "arrow", "line", "entity-relationship", "entity-relationships"])],
  ["arrowSize", new Set(["arrow", "entity-relationship", "entity-relationships"])],
  ["opacity", new Set(["embedded-image", "rectangle", "circle", "textbox", "rich-text", "entity", "field-rectangle", "field-mapping-table", "arrow", "line", "entity-relationship", "entity-relationships"])],
  ["textColor", new Set(["textbox", "entity", "field-mapping-table"])],
  ["fontFamily", new Set(["textbox", "entity", "field-mapping-table"])],
  ["fontSize", new Set(["textbox", "entity", "field-mapping-table"])],
  ["textAlign", new Set(["textbox"])],
  ["textVerticalAlign", new Set(["textbox"])],
  ["entityNameTextColor", new Set(["entity"])],
  ["entityHeaderFill", new Set(["entity"])],
  ["headerTextColor", new Set(["field-mapping-table"])],
  ["headerFill", new Set(["field-mapping-table"])],
  ["uiTextColor", new Set(["field-mapping-table"])],
  ["uiFill", new Set(["field-mapping-table"])],
  ["databaseTextColor", new Set(["field-mapping-table"])],
  ["databaseFill", new Set(["field-mapping-table"])],
  ["fieldMappingRowHoverFill", new Set(["field-mapping-table"])],
  ["fieldMappingHighlightColor", new Set(["field-mapping-table"])],
  ["fieldMappingHighlightStrokeWidth", new Set(["field-mapping-table"])],
  ["showSymbols", new Set(["entity-relationship", "entity-relationships"])]
]);
const diagram2ColorStyleNames = new Set([
  "fill",
  "stroke",
  "textColor",
  "entityNameTextColor",
  "entityHeaderFill",
  "headerTextColor",
  "headerFill",
  "uiTextColor",
  "uiFill",
  "databaseTextColor",
  "databaseFill",
  "fieldMappingRowHoverFill",
  "fieldMappingHighlightColor"
]);

async function runDiagram2CompactEngineResponsive(input = {}) {
  if (input.signal?.aborted || typeof Worker !== "function") {
    return runDiagram2CompactEngine(input);
  }
  try {
    return await runDiagram2CompactEngineWorker(input);
  } catch (error) {
    if (input.signal?.aborted || error?.diagram2CompactWorkerUnavailable === true) {
      return runDiagram2CompactEngine(input);
    }
    throw error;
  }
}

function runDiagram2CompactEngineWorker(input = {}) {
  return new Promise((resolve, reject) => {
    let worker = null;
    let settled = false;
    const cleanup = () => {
      input.signal?.removeEventListener?.("abort", abortHandler);
      worker?.terminate?.();
    };
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };
    const finishCanceled = () => {
      if (settled) return;
      settled = true;
      cleanup();
      runDiagram2CompactEngine({
        ...input,
        signal: { aborted: true },
        onProgress: null
      }).then(resolve, reject);
    };
    const abortHandler = () => {
      try {
        worker?.postMessage?.({ type: "cancel" });
      } catch {
        // The worker is about to be terminated; cancel diagnostics are still returned below.
      }
      finishCanceled();
    };

    try {
      worker = new Worker(new URL(diagram2CompactWorkerModuleUrl, import.meta.url), { type: "module" });
    } catch (error) {
      error.diagram2CompactWorkerUnavailable = true;
      reject(error);
      return;
    }

    worker.onmessage = event => {
      const message = event?.data || {};
      if (message.type === "progress") {
        if (typeof input.onProgress === "function") input.onProgress(message.progress);
        return;
      }
      if (message.type === "result") {
        finish(resolve, message.result);
        return;
      }
      if (message.type === "error") {
        finish(reject, new Error(message.message || "Diagram 2 Compact worker failed."));
      }
    };
    worker.onerror = event => {
      const error = event?.error instanceof Error
        ? event.error
        : new Error(event?.message || "Diagram 2 Compact worker failed.");
      finish(reject, error);
    };

    if (input.signal?.aborted) {
      finishCanceled();
      return;
    }
    input.signal?.addEventListener?.("abort", abortHandler, { once: true });

    try {
      worker.postMessage({
        type: "run",
        state: input.state,
        preferredRootId: input.preferredRootId,
        selectionAfter: input.selectionAfter
      });
    } catch (error) {
      error.diagram2CompactWorkerUnavailable = true;
      finish(reject, error);
    }
  });
}

export function isDiagram2CoreDrawingTool(tool) {
  return diagram2CoreDrawingTools.has(String(tool || "").trim().toLowerCase());
}

export function createDiagram2DefaultObject(typeInput, centerInput = {}, options = {}) {
  const type = String(typeInput || "").trim().toLowerCase();
  if (!isDiagram2CoreDrawingTool(type)) return null;

  const center = {
    x: finiteNumber(centerInput?.x, defaultDiagram2CanvasCenter.x),
    y: finiteNumber(centerInput?.y, defaultDiagram2CanvasCenter.y)
  };
  const id = String(options.id || diagram2ObjectId(type)).trim();
  const base = {
    id,
    type,
    locked: false,
    groupId: ""
  };

  if (type === "field-rectangle") {
    return createDiagram2FieldRectangle({
      id,
      name: options.fieldRectangleName || "Field",
      x: center.x - 110,
      y: center.y - 38,
      width: 220,
      height: 76
    });
  }

  if (type === "arrow" || type === "line") {
    const object = {
      ...base,
      x1: center.x - 90,
      y1: center.y - 90,
      x2: center.x + 90,
      y2: center.y + 90,
      stroke: defaultDiagram2DrawingStyles.stroke,
      strokeWidth: defaultDiagram2DrawingStyles.strokeWidth,
      opacity: defaultDiagram2DrawingStyles.opacity
    };
    if (type === "arrow") object.arrowSize = defaultDiagram2DrawingStyles.arrowSize;
    return applyDiagram2DrawingDefault(object, options.drawingDefaults);
  }

  if (type === "entity") {
    return createDiagram2EntityObject({
      name: options.entityName || "Entity",
      fields: [{ name: "Id", dataType: "int", nullable: false, isPrimaryKey: true }]
    }, center, { id });
  }

  const width = type === "rich-text" ? 520 : type === "textbox" ? 320 : type === "circle" ? 180 : 240;
  const height = type === "rich-text" ? 260 : type === "circle" ? 180 : 140;
  const object = {
    ...base,
    x: center.x - (width / 2),
    y: center.y - (height / 2),
    width,
    height,
    fill: type === "textbox" ? defaultDiagram2DrawingStyles.fill : "none",
    stroke: defaultDiagram2DrawingStyles.stroke,
    outlineVisible: defaultDiagram2DrawingStyles.outlineVisible,
    strokeWidth: defaultDiagram2DrawingStyles.strokeWidth,
    opacity: defaultDiagram2DrawingStyles.opacity,
    text: type === "textbox" ? "Text" : "",
    ...(type === "rich-text"
      ? { html: "<p><strong>Rich Text</strong></p><p>Double-click to edit this PMT rich-text object.</p>" }
      : {}),
    textColor: defaultDiagram2DrawingStyles.textColor,
    fontFamily: defaultDiagram2DrawingStyles.fontFamily,
    fontSize: defaultDiagram2DrawingStyles.fontSize,
    textAlign: defaultDiagram2DrawingStyles.textAlign,
    textVerticalAlign: defaultDiagram2DrawingStyles.textVerticalAlign
  };
  return applyDiagram2DrawingDefault(object, options.drawingDefaults);
}

export function createDiagram2EditorController(options = {}) {
  let renderer = options.renderer || null;
  let host = options.host || null;
  let canonicalState = normalizeDiagram2CanonicalState(options.state || null);
  let objectById = new Map();
  let objectIndexById = new Map();
  let objectIdsByGroupId = new Map();
  let entityAnnotationIndexes = createDiagram2EntityAnnotationIndexes();
  let fieldMappingIndexesState = createDiagram2FieldMappingIndexes();
  let relationshipLocatorById = new Map();
  let relationshipIdsByEntityId = new Map();
  let relationshipIdsWithRouteOverride = new Set();
  let relationshipIndexRebuildCount = 0;
  let canonicalRelationshipCount = 0;
  let selectedObjectIds = [];
  let activeTool = "select";
  let formatPainterStyles = null;
  let drawingDefaults = normalizeDiagram2DrawingDefaults(options.drawingDefaults || options.templateLibrary?.defaults);
  let pasteSequence = 0;
  let canonicalRevision = 1;
  let busy = false;
  let destroyed = false;
  let canonicalDiagnostics = {
    fullStateNormalizationCount: 1,
    fullStateSerializationCount: 0,
    stateReplacementCount: 1,
    lastOperation: null,
    lastCompact: null,
    lastRouteCommit: null
  };
  const listeners = new Set();
  const history = createDiagram2CommandHistory({
    limit: options.historyLimit || 100
  });
  history.reset({ saved: options.saved !== false });
  rebuildCanonicalObjectIndex();
  rebuildCanonicalRelationshipIndex();

  function attachRenderer(nextRenderer) {
    renderer = nextRenderer || null;
    renderer?.setCanvasOptions?.({
      gridVisible: canonicalState.gridVisible === true,
      snapToGrid: canonicalState.snapToGrid === true,
      gridSize: positiveNumber(canonicalState.gridSize, 20)
    });
    if (renderer && selectedObjectIds.length) renderer.setSelectedIds(selectedObjectIds);
    emit("renderer");
  }

  function setHost(nextHost) {
    host = nextHost || null;
    emit("host");
  }

  function setState(nextState, setOptions = {}) {
    canonicalState = normalizeDiagram2CanonicalState(nextState);
    canonicalRevision += 1;
    rebuildCanonicalObjectIndex();
    rebuildCanonicalRelationshipIndex();
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
    selectedObjectIds = existingSelectableIds(selectedObjectIds);
    if (setOptions.resetHistory !== false) history.reset({ saved: setOptions.saved !== false });
    renderer?.setCanvasOptions?.({
      gridVisible: canonicalState.gridVisible === true,
      snapToGrid: canonicalState.snapToGrid === true,
      gridSize: positiveNumber(canonicalState.gridSize, 20)
    });
    if (renderer && selectedObjectIds.length) renderer.setSelectedIds(selectedObjectIds);
    emit("state");
  }

  function setSelection(ids = [], selectionOptions = {}) {
    const exactIds = existingSelectableIds(ids);
    const nextSelectedObjectIds = selectionOptions.expandGroups === false
      ? exactIds
      : expandDiagram2SelectableSelectionIds(exactIds);
    if (sameDiagram2IdList(selectedObjectIds, nextSelectedObjectIds)) {
      return selectedObjectIds.slice();
    }
    selectedObjectIds = nextSelectedObjectIds;
    const diagnostics = renderer?.setSelectedIds?.(selectedObjectIds);
    emit("selection", { diagnostics });
    return selectedObjectIds.slice();
  }

  function setActiveTool(tool) {
    const nextTool = String(tool || "select").trim().toLowerCase();
    activeTool = nextTool === "format-painter" && formatPainterStyles
      ? "format-painter"
      : ["select", "pan", "crop"].includes(nextTool) ? nextTool : "select";
    if (activeTool !== "format-painter") formatPainterStyles = null;
    emit("tool");
    return activeTool;
  }

  async function setGridVisible(value) {
    const nextValue = value === true;
    if (canonicalState.gridVisible === nextValue) return nextValue;
    await history.execute(createDiagram2CanvasOptionCommand({
      optionName: "gridVisible",
      value: nextValue,
      label: nextValue ? "Show grid" : "Hide grid"
    }), commandContext());
    emit("history");
    return nextValue;
  }

  async function setSnapToGrid(value) {
    const nextValue = value === true;
    if (canonicalState.snapToGrid === nextValue) return nextValue;
    await history.execute(createDiagram2CanvasOptionCommand({
      optionName: "snapToGrid",
      value: nextValue,
      label: nextValue ? "Enable snap to grid" : "Disable snap to grid"
    }), commandContext());
    emit("history");
    return nextValue;
  }

  function setCanvasOptionCanonical(optionName, value) {
    if (!["gridVisible", "snapToGrid"].includes(optionName)) return false;
    canonicalState = {
      ...canonicalState,
      [optionName]: value === true
    };
    renderer?.setCanvasOptions?.({
      gridVisible: canonicalState.gridVisible === true,
      snapToGrid: canonicalState.snapToGrid === true,
      gridSize: positiveNumber(canonicalState.gridSize, 20)
    });
    return true;
  }

  function snapPoint(pointInput = {}) {
    const point = {
      x: finiteNumber(pointInput?.x, 0),
      y: finiteNumber(pointInput?.y, 0)
    };
    if (canonicalState.snapToGrid !== true) return point;
    const size = positiveNumber(canonicalState.gridSize, 20);
    return {
      x: Math.round(point.x / size) * size,
      y: Math.round(point.y / size) * size
    };
  }

  function snapMovement(objectIds, deltaX, deltaY) {
    const ids = existingObjectIds(objectIds);
    const objects = ids.map(getObjectById).filter(Boolean);
    const bounds = diagram2SelectionResizeBounds(objects);
    const raw = {
      deltaX: finiteNumber(deltaX, 0),
      deltaY: finiteNumber(deltaY, 0)
    };
    if (canonicalState.snapToGrid !== true || !bounds) return raw;
    const snapped = snapPoint({
      x: bounds.x + raw.deltaX,
      y: bounds.y + raw.deltaY
    });
    return {
      deltaX: snapped.x - bounds.x,
      deltaY: snapped.y - bounds.y
    };
  }

  function keyboardNudgeStep(large = false) {
    if (canonicalState.snapToGrid === true || canonicalState.gridVisible === true) {
      return positiveNumber(canonicalState.gridSize, 20);
    }
    return large ? 10 : 1;
  }

  function selectAll() {
    return setSelection(canonicalState.objects
      .filter(object => object?.visible !== false)
      .map(object => object.id));
  }

  async function moveSelectedObjects(deltaX, deltaY, commandOptions = {}) {
    return moveObjects(selectedObjectIds, deltaX, deltaY, commandOptions);
  }

  async function updateSelectedObjectsStyle(styleNameInput, valueInput, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const styleName = normalizeDiagram2StyleName(styleNameInput);
    const value = normalizeDiagram2StyleValue(styleName, valueInput);
    if (!styleName || value === undefined) return false;
    const ids = selectedObjectIds.filter(id => {
      const object = getObjectById(id);
      return object
        && object.locked !== true
        && !objectPositionFixed(object)
        && diagram2ObjectSupportsStyle(object, styleName);
    });
    if (!ids.length) {
      const relationshipIds = selectedRelationshipIds();
      if (relationshipIds.length && diagram2RelationshipSupportsStyle(styleName)) {
        return updateRelationshipsStyle(relationshipIds, styleName, value, commandOptions);
      }
    }
    if (!ids.length) return false;

    const command = createDiagram2StyleCommand({
      objectIds: ids,
      styleName,
      value,
      label: commandOptions.label || "Change object style",
      reason: commandOptions.reason || `change ${styleName}`,
      mergeKey: commandOptions.coalesce === false ? "" : `style:${styleName}:${ids.join("|")}`,
      mergeWindowMs: commandOptions.coalesce === false ? 0 : styleMergeWindowMilliseconds
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  function previewSelectedObjectsStyle(styleNameInput, valueInput) {
    if (busy || destroyed || !canMutate() || !renderer) return null;
    const styleName = normalizeDiagram2StyleName(styleNameInput);
    const value = normalizeDiagram2StyleValue(styleName, valueInput);
    if (!styleName || value === undefined) return null;

    const originalState = canonicalState;
    const objectIds = selectedObjectIds.filter(id => {
      const object = getObjectById(id);
      return object
        && object.locked !== true
        && !objectPositionFixed(object)
        && diagram2ObjectSupportsStyle(object, styleName);
    });
    let previewState = null;
    let affectedObjectIds = objectIds;
    let affectedRelationshipIds = [];

    if (objectIds.length) {
      const targetIds = new Set(objectIds);
      previewState = {
        ...originalState,
        objects: originalState.objects.map(object => targetIds.has(object.id)
          ? { ...object, [styleName]: value }
          : object)
      };
    } else {
      const relationshipIds = selectedRelationshipIds();
      if (!relationshipIds.length || !diagram2RelationshipSupportsStyle(styleName)) return null;
      const plan = diagram2SetRelationshipStylePlan(originalState, relationshipIds, styleName, value);
      if (!plan?.nextState) return null;
      previewState = plan.nextState;
      affectedObjectIds = plan.affectedObjectIds;
      affectedRelationshipIds = plan.affectedRelationshipIds;
    }

    const rendererOptions = {
      affectedObjectIds,
      affectedRelationshipIds,
      reason: `preview ${styleName}`
    };
    renderer.setStructureState?.(previewState, rendererOptions);
    let active = true;
    return () => {
      if (!active || destroyed || !renderer) return;
      active = false;
      renderer.setStructureState?.(canonicalState === originalState ? originalState : canonicalState, {
        ...rendererOptions,
        reason: `clear ${styleName} preview`
      });
    };
  }

  async function moveObjects(objectIds, deltaX, deltaY, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const ids = existingObjectIds(objectIds);
    if (!ids.length) return false;
    if (ids.some(id => {
      const object = getObjectById(id);
      return object?.locked === true || objectPositionFixed(object);
    })) return false;
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

  async function resizeObjects(objectsInput = [], commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const objects = Array.isArray(objectsInput) ? objectsInput : [objectsInput];
    const nextObjectsById = new Map(objects
      .map(object => [String(object?.id || "").trim(), object])
      .filter(([id, object]) => id && object && typeof object === "object"));
    const ids = existingObjectIds([...nextObjectsById.keys()]);
    if (!ids.length) return false;
    if (ids.some(id => {
      const object = getObjectById(id);
      return object?.locked === true || objectPositionFixed(object);
    })) return false;

    const changedObjects = ids
      .map(id => ({ current: getObjectById(id), next: nextObjectsById.get(id) }))
      .filter(pair => pair.current && pair.next && JSON.stringify(pair.current) !== JSON.stringify({ ...pair.next, id: pair.current.id }));
    if (!changedObjects.length) return false;

    const command = createDiagram2ResizeCommand({
      objects: changedObjects.map(pair => ({ ...pair.next, id: pair.current.id })),
      label: commandOptions.label || "Resize objects",
      reason: commandOptions.reason || "resize objects",
      rendererAlreadyUpdated: commandOptions.rendererAlreadyUpdated === true
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function addObject(object, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const objectId = String(object?.id || "").trim();
    if (!objectId || objectIndexById.has(objectId)) return false;
    const nextObject = { ...object, id: objectId };
    if (isDiagram2CoreDrawingTool(nextObject.type) && !String(nextObject.name || "").trim()) {
      nextObject.name = nextDiagram2DrawingObjectName(nextObject.type, canonicalState.objects);
    }

    const command = createDiagram2AddObjectCommand({
      object: nextObject,
      label: commandOptions.label || "Add object",
      reason: commandOptions.reason || "add object"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function addObjects(objectsInput = [], commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const objects = uniqueDiagram2Objects(objectsInput)
      .filter(object => !objectIndexById.has(object.id));
    if (!objects.length) return false;

    const command = createDiagram2AddObjectsCommand({
      objects,
      groupNames: commandOptions.groupNames,
      groupVisibility: commandOptions.groupVisibility,
      label: commandOptions.label || "Add objects",
      reason: commandOptions.reason || "add objects"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function addEmbeddedImage(options = {}, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const object = options?.type === "embedded-image"
      ? options
      : createDiagram2EmbeddedImage(options);
    return addObject(object, {
      label: commandOptions.label || "Add image",
      reason: commandOptions.reason || "add image"
    });
  }

  async function updateEmbeddedImageCrop(objectId, patchInput = {}, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const image = getObjectById(objectId);
    if (image?.type !== "embedded-image" || image.locked === true) return false;
    const nextImage = { ...cloneDiagram2Value(image), ...(patchInput || {}) };
    if (nextImage.cropCornerRadii == null) delete nextImage.cropCornerRadii;
    if (sameDiagram2Value(image, nextImage)) return false;
    const tableUpdates = (fieldMappingIndexesState.tableIdsBySourceImageId.get(image.id) || [])
      .map(id => getObjectById(id))
      .filter(Boolean)
      .map(table => ({
        table,
        next: syncDiagram2FieldMappingTableForImage(table, nextImage, fieldMappingIndexesState)
      }))
      .filter(item => item.next !== item.table)
      .map(item => item.next);
    return executeDiagram2ObjectDelta({
      beforeObjects: [image, ...tableUpdates.map(table => getObjectById(table.id)).filter(Boolean)],
      afterObjects: [nextImage, ...tableUpdates],
      selectionAfter: Array.isArray(commandOptions.selectionAfter)
        ? commandOptions.selectionAfter
        : [image.id]
    }, {
      label: commandOptions.label || "Crop image",
      reason: commandOptions.reason || "crop image"
    });
  }

  async function setEmbeddedImageCropVisibility(objectId, visible, commandOptions = {}) {
    return updateEmbeddedImageCrop(objectId, { cropVisible: visible !== false }, {
      label: commandOptions.label || (visible === false ? "Hide image crop" : "Show image crop"),
      reason: commandOptions.reason || "change image crop visibility"
    });
  }

  async function permanentlyCropEmbeddedImage(objectId, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const image = getObjectById(objectId);
    if (image?.type !== "embedded-image" || image.locked === true) return false;
    const { object } = await permanentlyCropDiagram2Image(cloneDiagram2Value(image));
    const applied = await updateEmbeddedImageCrop(objectId, object, {
      label: commandOptions.label || "Permanently crop image",
      reason: commandOptions.reason || "permanently crop image"
    });
    if (applied) {
      history.reset({ saved: false });
      emit("history");
    }
    return applied;
  }

  async function setEntityAnnotation(objectId, value, annotationOptions = {}, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = createDiagram2EntityAnnotationPlan(canonicalState, objectId, value, annotationOptions);
    if (!plan) return false;
    return executeDiagram2ObjectDelta({
      ...plan,
      selectionAfter: [objectId]
    }, {
      label: commandOptions.label || "Edit Entity annotation",
      reason: commandOptions.reason || "edit Entity annotation"
    });
  }

  async function addFieldRectangle(centerInput = {}, fieldOptions = {}, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const center = snapPoint(centerInput || defaultDiagram2CanvasCenter);
    const object = createDiagram2FieldRectangle({
      ...fieldOptions,
      x: center.x - (positiveNumber(fieldOptions.width, 220) / 2),
      y: center.y - (positiveNumber(fieldOptions.height, 76) / 2)
    });
    return addObject(object, {
      label: commandOptions.label || "Add Field Rectangle",
      reason: commandOptions.reason || "add Field Rectangle"
    });
  }

  async function renameFieldRectangle(objectId, name, commandOptions = {}) {
    const object = getObjectById(objectId);
    const next = renameDiagram2FieldRectangle(object, name);
    return updateFieldRectangleAndTables(object, next, {
      label: commandOptions.label || "Rename Field Rectangle",
      reason: commandOptions.reason || "rename Field Rectangle"
    });
  }

  async function setFieldRectangleConnectionSide(objectId, side, commandOptions = {}) {
    const object = getObjectById(objectId);
    const next = setDiagram2FieldRectangleConnectionSide(object, side);
    return updateFieldRectangleAndTables(object, next, {
      label: commandOptions.label || "Change Field Rectangle connection side",
      reason: commandOptions.reason || "change Field Rectangle connection side"
    });
  }

  async function setFieldRectangleMapping(objectId, mapping, commandOptions = {}) {
    const object = getObjectById(objectId);
    const mappedName = diagram2MappedFieldRectangleName(mapping?.referencedField);
    const renamed = mappedName ? renameDiagram2FieldRectangle(object, mappedName) : object;
    const next = setDiagram2FieldRectangleMapping(renamed, mapping);
    return updateFieldRectangleAndTables(object, next, {
      label: commandOptions.label || (mapping ? "Map Field Rectangle" : "Remove Field Rectangle mapping"),
      reason: commandOptions.reason || (mapping ? "map Field Rectangle" : "remove Field Rectangle mapping")
    });
  }

  async function updateFieldRectangleAndTables(object, next, commandOptions = {}) {
    if (busy || destroyed || !canMutate() || !isDiagram2FieldRectangle(object)
      || object.locked === true || !next || sameDiagram2Value(object, next)) return false;
    const tableIds = new Set(fieldMappingIndexesState.tableIdsByFieldRectangleId.get(object.id) || []);
    (fieldMappingIndexesState.imageIdsByFieldRectangleId.get(object.id) || []).forEach(imageId => {
      (fieldMappingIndexesState.tableIdsBySourceImageId.get(imageId) || [])
        .forEach(tableId => tableIds.add(tableId));
    });
    const tableUpdates = [...tableIds]
      .map(id => getObjectById(id))
      .filter(Boolean)
      .map(table => ({
        table,
        next: syncDiagram2FieldMappingTableForFieldRectangle(
          table,
          next,
          fieldMappingIndexesState
        )
      }))
      .filter(item => item.next !== item.table)
      .map(item => item.next);
    return executeDiagram2ObjectDelta({
      beforeObjects: [object, ...tableUpdates.map(table => getObjectById(table.id)).filter(Boolean)],
      afterObjects: [next, ...tableUpdates],
      selectionAfter: [object.id]
    }, commandOptions);
  }

  async function addFieldMappingTable(imageId, tableOptions = {}, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const existing = canonicalState.objects.find(object =>
      object?.type === "field-mapping-table" && object.sourceImageId === imageId);
    if (existing) {
      const image = getObjectById(imageId);
      const next = syncDiagram2FieldMappingTableForImage(
        existing,
        image,
        fieldMappingIndexesState
      );
      if (next !== existing) {
        return executeDiagram2ObjectDelta({
          beforeObjects: [existing],
          afterObjects: [next],
          selectionAfter: [existing.id]
        }, {
          label: commandOptions.label || "Update Field Mapping Table",
          reason: commandOptions.reason || "update Field Mapping Table"
        });
      }
      setSelection([existing.id], { expandGroups: false });
      return true;
    }
    const table = createDiagram2FieldMappingTable(canonicalState, imageId, {
      ...tableOptions,
      indexes: fieldMappingIndexesState
    });
    if (!table) return false;
    return addObject(table, {
      label: commandOptions.label || "Add Field Mapping Table",
      reason: commandOptions.reason || "add Field Mapping Table"
    });
  }

  function fieldMappingIndexes() {
    return fieldMappingIndexesState;
  }

  function fieldRectangleMapping(objectId) {
    return diagram2FieldRectangleMapping(getObjectById(objectId));
  }

  function selectFieldMapping(mappingIdInput, selectionOptions = {}) {
    const mappingId = String(mappingIdInput || "").trim();
    const indexes = fieldMappingIndexes();
    const mapping = indexes.mappingsById.get(mappingId);
    if (!mapping) return null;
    const relationshipId = mapping.relationshipId || "";
    setSelection([], { expandGroups: false });
    if (selectionOptions.focusTarget === true && mapping.targetId) {
      renderer?.focusObjectIds?.([mapping.targetId], {
        reason: "focus Field mapping target"
      });
    }
    return {
      ...mapping,
      relationshipId,
      selectedIds: []
    };
  }

  async function executeDiagram2ObjectDelta(planInput = {}, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = buildDiagram2ObjectDeltaPlan(canonicalState, {
      ...planInput,
      selectionBefore: planInput.selectionBefore || selectedObjectIds
    }, objectIndexById, objectById);
    if (!plan || !plan.touchedObjectIds.length) return false;
    const command = createDiagram2ObjectDeltaCommand({
      ...plan,
      label: commandOptions.label || "Update objects",
      reason: commandOptions.reason || "update objects"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function deleteSelectedObjects(commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const relationshipIds = selectedRelationshipIds();
    if (relationshipIds.length && relationshipIds.length === selectedObjectIds.length) {
      const plan = diagram2DeleteRelationshipsPlan(canonicalState, relationshipIds);
      return executeDiagram2StatePlan(plan, {
        label: commandOptions.label || "Delete relationship",
        reason: commandOptions.reason || "delete relationship"
      });
    }
    const ids = selectedObjectIds.filter(id => {
      const object = getObjectById(id);
      return object && object.locked !== true && !objectPositionFixed(object);
    });
    if (!ids.length) return false;
    const deletedObjects = ids.map(id => getObjectById(id)).filter(Boolean);
    const removedEntityReferences = deletedObjects
      .filter(object => object?.type === "entity" && !isDiagram2FieldRectangle(object))
      .map(diagram2EntityReference)
      .filter(Boolean);
    const nextObjects = canonicalState.objects
      .filter(object => !ids.includes(object.id))
      .map(object => {
        const mapping = diagram2FieldRectangleMapping(object);
        if (!mapping || !removedEntityReferences.some(reference =>
          sameDiagram2Identifier(mapping.referencedEntity, reference))) return object;
        return setDiagram2FieldRectangleMapping(object, null) || object;
      });
    const fieldRectangleUpdates = nextObjects.filter(object =>
      isDiagram2FieldRectangle(object) && !sameDiagram2Value(getObjectById(object.id), object));
    const mappingTablesAffected = fieldRectangleUpdates.length > 0
      || deletedObjects.some(object => isDiagram2FieldRectangle(object) || object.type === "embedded-image");
    const tableUpdates = mappingTablesAffected
      ? planDiagram2FieldMappingTableSync(nextObjects)
        .filter(table => !ids.includes(table.id) && !sameDiagram2Value(getObjectById(table.id), table))
      : [];
    const dependentUpdates = uniqueDiagram2Objects([
      ...fieldRectangleUpdates,
      ...tableUpdates
    ]);
    if (dependentUpdates.length) {
      return executeDiagram2ObjectDelta({
        beforeObjects: dependentUpdates.map(object => getObjectById(object.id)).filter(Boolean),
        afterObjects: dependentUpdates,
        removedObjectIds: ids,
        selectionAfter: []
      }, {
        label: commandOptions.label || "Delete objects",
        reason: commandOptions.reason || "delete objects"
      });
    }
    const command = createDiagram2DeleteObjectsCommand({
      objects: ids.map(id => ({
        object: cloneDiagram2Value(getObjectById(id)),
        index: objectIndexById.get(id)
      })),
      selectionBefore: selectedObjectIds,
      label: commandOptions.label || "Delete objects",
      reason: commandOptions.reason || "delete objects"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function duplicateSelectedObjects(commandOptions = {}) {
    if (busy || destroyed || !canMutate() || !selectedObjectIds.length) return false;
    const text = selectionClipboardText();
    if (!text) return false;
    return pasteSelectionClipboardText(text, {
      ...commandOptions,
      label: commandOptions.label || "Duplicate objects",
      reason: commandOptions.reason || "duplicate objects"
    });
  }

  function selectionClipboardText() {
    if (!selectedObjectIds.length) return "";
    return createDiagram2SelectionClipboardText({
      state: canonicalState,
      selectedObjectIds
    });
  }

  async function pasteSelectionClipboardText(contents, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    let parsed;
    try {
      parsed = typeof contents === "string"
        ? parseDiagram2SelectionClipboardText(contents)
        : contents;
    } catch {
      return false;
    }
    pasteSequence += 1;
    const offset = canonicalState.gridVisible === true
      ? positiveNumber(canonicalState.gridSize, 20)
      : 10;
    const remapped = remapDiagram2SelectionClipboardPackageIds(parsed, {
      existingObjectIds: canonicalState.objects.map(object => object.id),
      idFactory: (_oldId, type) => diagram2ObjectId(type || "object"),
      pasteIndex: pasteSequence,
      pasteOffset: { x: offset, y: offset }
    });
    const objects = uniqueDiagram2Objects(remapped?.selection?.objects || []);
    if (!objects.length) return false;
    assignUniqueDiagram2ObjectNames(objects, canonicalState.objects);
    return addObjects(objects, {
      label: commandOptions.label || "Paste objects",
      reason: commandOptions.reason || "paste objects",
      groupNames: remapped?.selection?.groupNames || {},
      groupVisibility: remapped?.selection?.groupVisibility || {}
    });
  }

  async function updateObjectText(objectId, value, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const object = getObjectById(objectId);
    if (!object || object.locked === true || !["textbox", "rich-text"].includes(object.type)) return false;
    const property = object.type === "rich-text" ? "html" : "text";
    const nextValue = property === "html"
      ? normalizeDiagram2RichTextHtml(value)
      : String(value ?? "");
    if (String(object[property] ?? "") === nextValue) return false;
    const command = createDiagram2TextCommand({
      objectId: object.id,
      property,
      value: nextValue,
      label: commandOptions.label || (property === "html" ? "Edit rich text" : "Edit text"),
      reason: commandOptions.reason || "edit text"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  function beginFormatPainter(sourceId = selectedObjectIds[0]) {
    const source = getObjectById(sourceId);
    if (!source || source.locked === true) return false;
    const styles = {};
    diagram2StyleTargets.forEach((_targets, styleName) => {
      if (!diagram2ObjectSupportsStyle(source, styleName)) return;
      styles[styleName] = diagram2StylePreviousValue(source, styleName);
    });
    if (!Object.keys(styles).length) return false;
    formatPainterStyles = styles;
    activeTool = "format-painter";
    emit("tool");
    return true;
  }

  function cancelFormatPainter() {
    const changed = activeTool === "format-painter" || formatPainterStyles;
    formatPainterStyles = null;
    activeTool = "select";
    if (changed) emit("tool");
    return changed;
  }

  async function applyFormatPainter(targetIdsInput = []) {
    if (busy || destroyed || !canMutate() || !formatPainterStyles) return false;
    const requestedIds = existingObjectIds(targetIdsInput);
    const targetIds = requestedIds.length > 1
      ? requestedIds
      : selectedObjectIds.length > 1 && requestedIds.some(id => selectedObjectIds.includes(id))
        ? selectedObjectIds.slice()
        : requestedIds;
    const nextObjects = targetIds
      .map(id => getObjectById(id))
      .filter(object => object && object.locked !== true && !objectPositionFixed(object))
      .map(object => {
        const patch = {};
        Object.entries(formatPainterStyles).forEach(([styleName, value]) => {
          if (diagram2ObjectSupportsStyle(object, styleName)) patch[styleName] = value;
        });
        return Object.keys(patch).length ? { ...object, ...patch } : null;
      })
      .filter(Boolean);
    if (!nextObjects.length) return false;
    const command = createDiagram2PatchObjectsCommand({
      objects: nextObjects,
      label: "Apply Format Painter",
      reason: "apply format painter"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function setSelectedObjectsLocked(lockedInput) {
    if (busy || destroyed || !canMutate()) return false;
    const locked = lockedInput === true;
    const nextObjects = selectedObjectIds
      .map(id => getObjectById(id))
      .filter(object => object && !objectPositionFixed(object) && object.locked !== locked)
      .map(object => ({ ...object, locked }));
    if (!nextObjects.length) return false;
    const command = createDiagram2PatchObjectsCommand({
      objects: nextObjects,
      label: locked ? "Lock objects" : "Unlock objects",
      reason: locked ? "lock objects" : "unlock objects"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function setStructureNodeLocked(kind, id, lockedInput = null) {
    if (busy || destroyed || !canMutate()) return false;
    const objectIds = diagram2ObjectTreeNodeSelectionIds(canonicalState, kind, id);
    const objects = objectIds
      .map(objectId => getObjectById(objectId))
      .filter(object => object && !objectPositionFixed(object));
    if (!objects.length) return false;
    const locked = lockedInput == null
      ? !objects.every(object => object.locked === true)
      : lockedInput === true;
    const nextObjects = objects
      .filter(object => object.locked !== locked)
      .map(object => ({ ...object, locked }));
    if (!nextObjects.length) return false;
    const command = createDiagram2PatchObjectsCommand({
      objects: nextObjects,
      label: locked ? "Lock objects" : "Unlock objects",
      reason: locked ? "lock objects" : "unlock objects"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function arrangeSelectedObjects(actionInput) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2LayerOrderPlan(canonicalState, selectedObjectIds, actionInput);
    if (!plan) return false;
    const selection = plan.objectIds.map(getObjectById).filter(Boolean);
    if (!selection.length || selection.some(object =>
      object.locked === true || objectPositionFixed(object))) return false;

    await history.execute(createDiagram2ArrangeObjectsCommand({
      objectIds: plan.objectIds,
      previousOrder: plan.previousOrder,
      nextOrder: plan.nextOrder,
      label: diagram2StructureLayerActionLabel(plan.action),
      reason: `arrange objects ${plan.action}`
    }), commandContext());
    emit("history");
    return true;
  }

  async function groupSelectedObjects(commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const ids = selectedObjectIds.filter(id => {
      const object = getObjectById(id);
      return object && object.locked !== true && !objectPositionFixed(object);
    });
    const plan = diagram2GroupSelectionPlan(canonicalState, ids);
    if (!plan) return false;
    await history.execute(createDiagram2StructureStateCommand({
      nextState: plan.nextState,
      affectedObjectIds: plan.affectedObjectIds,
      selectionAfter: plan.selectionAfter,
      label: commandOptions.label || "Group objects",
      reason: commandOptions.reason || "group objects"
    }), commandContext());
    emit("history");
    return true;
  }

  async function ungroupSelectedObjects(commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2UngroupSelectionPlan(canonicalState, selectedObjectIds);
    if (!plan || plan.affectedObjectIds.some(id => {
      const object = getObjectById(id);
      return object?.locked === true || objectPositionFixed(object);
    })) return false;
    await history.execute(createDiagram2StructureStateCommand({
      nextState: plan.nextState,
      affectedObjectIds: plan.affectedObjectIds,
      selectionAfter: plan.selectionAfter,
      label: commandOptions.label || "Ungroup objects",
      reason: commandOptions.reason || "ungroup objects"
    }), commandContext());
    emit("history");
    return true;
  }

  async function renameStructureNode(kind, id, name, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2RenameStructurePlan(canonicalState, kind, id, name);
    if (!plan || plan.affectedObjectIds.some(objectId => objectPositionFixed(getObjectById(objectId)))) return false;
    await history.execute(createDiagram2StructureStateCommand({
      nextState: plan.nextState,
      affectedObjectIds: plan.affectedObjectIds,
      selectionAfter: plan.selectionAfter,
      label: commandOptions.label || "Rename object",
      reason: commandOptions.reason || "rename object"
    }), commandContext());
    emit("history");
    return true;
  }

  async function setStructureNodeVisibility(kind, id, visible = null, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2SetStructureVisibilityPlan(canonicalState, kind, id, visible);
    if (!plan || plan.affectedObjectIds.some(objectId => objectPositionFixed(getObjectById(objectId)))) return false;
    await history.execute(createDiagram2StructureStateCommand({
      nextState: plan.nextState,
      affectedObjectIds: plan.affectedObjectIds,
      selectionAfter: plan.selectionAfter,
      label: commandOptions.label || "Change visibility",
      reason: commandOptions.reason || "change visibility"
    }), commandContext());
    emit("history");
    return true;
  }

  async function reorderStructureNode(move, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2ReorderStructurePlan(canonicalState, move);
    if (!plan || plan.affectedObjectIds.some(id => {
      const object = getObjectById(id);
      return object?.locked === true || objectPositionFixed(object);
    })) return false;
    await history.execute(createDiagram2StructureStateCommand({
      nextState: plan.nextState,
      affectedObjectIds: plan.affectedObjectIds,
      selectionAfter: plan.selectionAfter,
      label: commandOptions.label || "Reorder objects",
      reason: commandOptions.reason || "reorder objects"
    }), commandContext());
    emit("history");
    return true;
  }

  function selectStructureNode(kind, id) {
    const normalizedKind = String(kind || "object").trim().toLowerCase();
    return setSelection(diagram2ObjectTreeNodeSelectionIds(canonicalState, normalizedKind, id), {
      expandGroups: normalizedKind !== "object"
    });
  }

  function selectedRelationshipIds(idsInput = selectedObjectIds) {
    return uniqueStrings(idsInput).filter(id => relationshipLocatorById.has(id));
  }

  function selectedRelationshipObjects(idsInput = selectedObjectIds) {
    return selectedRelationshipIds(idsInput)
      .map(id => relationshipLocatorById.get(id)?.selectionObject)
      .filter(Boolean)
      .map(object => ({ ...object }));
  }

  function createDefaultObject(type, centerInput = {}, options = {}) {
    return createDiagram2DefaultObject(type, centerInput, {
      ...options,
      drawingDefaults
    });
  }

  function setDrawingDefaults(defaultsInput = {}) {
    drawingDefaults = normalizeDiagram2DrawingDefaults(defaultsInput);
    emit("drawing-defaults");
    return currentDrawingDefaults();
  }

  function currentDrawingDefaults() {
    return cloneDiagram2Value(drawingDefaults);
  }

  function setDrawingDefaultFromSelection(typeInput) {
    const type = String(typeInput || "").trim().toLowerCase();
    if (!["arrow", "rectangle"].includes(type)) return null;
    const object = selectedObjectIds
      .map(id => getObjectById(id))
      .find(candidate => candidate?.type === type && candidate.locked !== true && !objectPositionFixed(candidate));
    if (!object || object.type !== type || object.locked === true || objectPositionFixed(object)) return null;
    const value = diagram2DrawingDefaultFromObject(object);
    if (!value) return null;
    drawingDefaults = normalizeDiagram2DrawingDefaults({
      ...drawingDefaults,
      [type]: value
    });
    emit("drawing-defaults");
    return cloneDiagram2Value(value);
  }

  function resetDrawingDefault(typeInput) {
    const type = String(typeInput || "").trim().toLowerCase();
    if (!["arrow", "rectangle"].includes(type)) return false;
    drawingDefaults = normalizeDiagram2DrawingDefaults({
      ...drawingDefaults,
      [type]: null
    });
    emit("drawing-defaults");
    return true;
  }

  async function applyTemplate(template, centerInput = {}, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const instance = instantiateDiagram2TemplateObjects(
      template,
      snapPoint(centerInput),
      canonicalState.objects.map(object => object.id)
    );
    const objects = uniqueDiagram2Objects(instance.objects);
    if (!objects.length) return false;
    assignUniqueDiagram2ObjectNames(objects, canonicalState.objects);
    return addObjects(objects, {
      label: commandOptions.label || "Apply template",
      reason: commandOptions.reason || "apply template",
      groupNames: instance.groupNames,
      groupVisibility: instance.groupVisibility
    });
  }

  async function applyTemplateFormatting(template, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const targets = getObjectsByIds(selectedObjectIds)
      .filter(object => object.locked !== true && !objectPositionFixed(object));
    if (!targets.length) return false;
    const { result, objects } = applyDiagram2TemplateFormat(template, targets);
    if (!result?.changedCount) return false;
    const command = createDiagram2PatchObjectsCommand({
      objects,
      label: commandOptions.label || "Apply template formatting",
      reason: commandOptions.reason || "apply template formatting"
    });
    await history.execute(command, commandContext());
    emit("history");
    return true;
  }

  async function addEntity(definition, centerInput = null, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const object = createDiagram2EntityObject(
      definition,
      centerInput || snapPoint(defaultDiagram2CanvasCenter),
      { id: commandOptions.id }
    );
    if (!object) return false;
    return addObject(object, {
      label: commandOptions.label || "Add entity",
      reason: commandOptions.reason || "add entity"
    });
  }

  async function updateEntityDefinition(objectId, definition, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = synchronizeDiagram2FieldMappingTablesInPlan(
      retargetDiagram2FieldMappingsInPlan(
        diagram2ApplyEntityDefinitionPlan(canonicalState, objectId, definition),
        objectId,
        { fallbackByFieldIndex: true, clearMissingField: true }
      )
    );
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Update entity",
      reason: commandOptions.reason || "update entity"
    });
  }

  async function setEntityOption(objectId, optionName, value, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2SetEntityOptionPlan(canonicalState, objectId, optionName, value);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Update entity display",
      reason: commandOptions.reason || `entity ${optionName}`
    });
  }

  async function resetEntityScale(objectId, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2ResetEntityScalePlan(canonicalState, objectId);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Reset entity scale",
      reason: commandOptions.reason || "reset entity scale"
    });
  }

  async function updateEntityField(objectId, fieldIndex, patch, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = synchronizeDiagram2FieldMappingTablesInPlan(
      retargetDiagram2FieldMappingsInPlan(
        diagram2UpdateEntityFieldPlan(canonicalState, objectId, fieldIndex, patch),
        objectId,
        { fallbackByFieldIndex: true }
      )
    );
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Update entity field",
      reason: commandOptions.reason || "update entity field"
    });
  }

  async function addEntityField(objectId, field, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2AddEntityFieldPlan(canonicalState, objectId, field);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Add entity field",
      reason: commandOptions.reason || "add entity field"
    });
  }

  async function removeEntityField(objectId, fieldIndex, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = synchronizeDiagram2FieldMappingTablesInPlan(
      retargetDiagram2FieldMappingsInPlan(
        diagram2RemoveEntityFieldPlan(canonicalState, objectId, fieldIndex),
        objectId,
        { clearMissingField: true }
      )
    );
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Remove entity field",
      reason: commandOptions.reason || "remove entity field"
    });
  }

  async function moveEntityField(objectId, fieldIndex, direction, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2MoveEntityFieldPlan(canonicalState, objectId, fieldIndex, direction);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Move entity field",
      reason: commandOptions.reason || "move entity field"
    });
  }

  async function setEntityFieldReference(objectId, fieldIndex, reference, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2SetEntityFieldReferencePlan(canonicalState, objectId, fieldIndex, reference);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Set field reference",
      reason: commandOptions.reason || "set entity field reference"
    });
  }

  async function addRelationship(input, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2AddRelationshipPlan(canonicalState, input);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Add relationship",
      reason: commandOptions.reason || "add relationship"
    });
  }

  async function updateRelationshipsStyle(relationshipIds, styleName, value, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2SetRelationshipStylePlan(canonicalState, relationshipIds, styleName, value, {
      global: commandOptions.global === true
    });
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Update relationship style",
      reason: commandOptions.reason || `relationship ${styleName}`
    });
  }

  async function setRelationshipType(relationshipId, relationshipType, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2SetRelationshipTypePlan(canonicalState, relationshipId, relationshipType);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Update relationship type",
      reason: commandOptions.reason || "relationship type"
    });
  }

  async function setRelationshipRoutingOptions(patch, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2SetRelationshipRoutingOptionsPlan(canonicalState, patch);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Update relationship routing",
      reason: commandOptions.reason || "relationship routing"
    });
  }

  async function useRelationshipRoute(relationshipId, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2UseCurrentRelationshipRoutePlan(
      canonicalState,
      relationshipId,
      renderer?.relationshipRoutePoints?.(relationshipId)
    );
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Use manual relationship route",
      reason: commandOptions.reason || "use manual relationship route"
    });
  }

  async function adjustRelationshipRoute(relationshipId, segmentIndex, axis, coordinate, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const locator = relationshipLocatorById.get(String(relationshipId || "").trim());
    if (!locator) return false;
    const source = objectById.get(locator.sourceEntityId);
    if (source?.locked === true) return false;
    const foreignKey = source?.foreignKeys?.[locator.foreignKeyIndex];
    const renderedPoints = renderer?.relationshipRoutePoints?.(locator.relationshipId) || [];
    const basePoints = Array.isArray(foreignKey?.routeOverride) && foreignKey.routeOverride.length > 1
      ? foreignKey.routeOverride
      : renderedPoints;
    const points = adjustDiagram2RelationshipRoutePoints(
      basePoints,
      segmentIndex,
      axis,
      coordinate
    );
    return commitRelationshipRouteOverride(locator.relationshipId, points, {
      ...commandOptions,
      label: commandOptions.label || "Adjust manual relationship route",
      reason: commandOptions.reason || "adjust relationship route",
      previousRenderedPoints: renderedPoints
    });
  }

  async function commitRelationshipRouteOverride(relationshipIdInput, pointsInput, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const startedAt = diagram2Now();
    const pointerupReceivedAt = finiteNumber(commandOptions.pointerupReceivedAt, startedAt);
    const planStartedAt = diagram2Now();
    const relationshipId = String(relationshipIdInput || "").trim();
    const locator = relationshipLocatorById.get(relationshipId);
    const source = locator ? objectById.get(locator.sourceEntityId) : null;
    const foreignKey = source?.foreignKeys?.[locator?.foreignKeyIndex];
    const nextRouteOverride = compactDiagram2RelationshipPoints(pointsInput);
    if (!locator || source?.locked === true || !foreignKey || nextRouteOverride.length < 2) return false;

    const previousRouteOverride = compactDiagram2RelationshipPoints(foreignKey.routeOverride);
    const previousRenderedPoints = compactDiagram2RelationshipPoints(
      commandOptions.previousRenderedPoints?.length
        ? commandOptions.previousRenderedPoints
        : renderer?.relationshipRoutePoints?.(relationshipId)
    );
    const previousManualRoutes = canonicalState.manualEntityRelationshipRoutes === true;
    if (previousManualRoutes
      && sameDiagram2RelationshipRoute(previousRouteOverride, nextRouteOverride)) {
      return false;
    }
    const additionalRouteTransitions = previousManualRoutes
      ? []
      : [...relationshipIdsWithRouteOverride]
          .filter(id => id !== relationshipId)
          .map(id => {
            const relatedLocator = relationshipLocatorById.get(id);
            const relatedSource = objectById.get(relatedLocator?.sourceEntityId);
            const relatedRouteOverride = compactDiagram2RelationshipPoints(
              relatedSource?.foreignKeys?.[relatedLocator?.foreignKeyIndex]?.routeOverride
            );
            const previousRenderedPoints = compactDiagram2RelationshipPoints(
              renderer?.relationshipRoutePoints?.(id)
            );
            return relatedLocator && relatedRouteOverride.length > 1 && previousRenderedPoints.length > 1
              ? {
                  relationshipId: id,
                  sourceEntityId: relatedLocator.sourceEntityId,
                  foreignKeyIndex: relatedLocator.foreignKeyIndex,
                  routeOverride: relatedRouteOverride,
                  previousRenderedPoints
                }
              : null;
          })
          .filter(Boolean);

    const command = createDiagram2RelationshipRouteCommand({
      relationshipId,
      sourceEntityId: locator.sourceEntityId,
      foreignKeyIndex: locator.foreignKeyIndex,
      previousRouteOverride,
      previousRenderedPoints,
      nextRouteOverride,
      nextRenderedPoints: nextRouteOverride,
      previousManualRoutes,
      nextManualRoutes: true,
      selectionBefore: selectedObjectIds,
      selectionAfter: [relationshipId],
      label: commandOptions.label || "Adjust manual relationship route",
      reason: commandOptions.reason || "adjust relationship route",
      rendererAlreadyPreviewed: commandOptions.rendererAlreadyPreviewed === true,
      nextPath: String(commandOptions.path || diagram2RelationshipPath(nextRouteOverride)),
      additionalRouteTransitions
    });
    const planCompletedAt = diagram2Now();
    await history.execute(command, commandContext());
    const historyCommandRecordedAt = diagram2Now();
    finalizeRelationshipRouteCommit(command.lastResult(), {
      action: "apply",
      startedAt,
      pointerupReceivedAt,
      previewFinalCoordinateAvailableAt: finiteNumber(
        commandOptions.previewFinalCoordinateAvailableAt,
        planCompletedAt
      ),
      planMs: planCompletedAt - planStartedAt,
      historyCommandRecordedAt
    });
    return true;
  }

  async function insertRelationshipRoutePoint(relationshipId, segmentIndex = null, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2InsertRelationshipRoutePointPlan(canonicalState, relationshipId, segmentIndex, commandOptions.point);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Add manual route point",
      reason: commandOptions.reason || "add manual route point"
    });
  }

  async function removeRelationshipRoutePoint(relationshipId, pointIndex = null, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2RemoveRelationshipRoutePointPlan(canonicalState, relationshipId, pointIndex);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Remove manual route point",
      reason: commandOptions.reason || "remove manual route point"
    });
  }

  async function clearRelationshipRoutes(relationshipIds, commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const plan = diagram2ClearRelationshipRoutePlan(canonicalState, relationshipIds);
    return executeDiagram2StatePlan(plan, {
      label: commandOptions.label || "Clear manual relationship route",
      reason: commandOptions.reason || "clear relationship route"
    });
  }

  function compactAvailability() {
    return diagram2CompactAvailability(canonicalState, selectedObjectIds);
  }

  async function autoFormatCompact(commandOptions = {}) {
    if (busy || destroyed || !canMutate()) return false;
    const availability = compactAvailability();
    if (!availability.allowed) {
      canonicalDiagnostics = {
        ...canonicalDiagnostics,
        lastCompact: {
          finalStatus: "Blocked",
          message: availability.message
        }
      };
      emit("compact blocked");
      return false;
    }
    const sourceRevision = canonicalRevision;
    const preferredRootId = availability.preferredRootId;
    busy = true;
    emit("busy");
    try {
      const result = await runDiagram2CompactEngineResponsive({
        state: canonicalState,
        preferredRootId,
        selectionAfter: selectedObjectIds,
        signal: commandOptions.signal,
        onProgress: commandOptions.onProgress
      });
      if (result?.diagnostics) {
        canonicalDiagnostics = {
          ...canonicalDiagnostics,
          lastCompact: result.diagnostics
        };
      }
      if (commandOptions.signal?.aborted || result?.status === "Canceled") return false;
      if (sourceRevision !== canonicalRevision) {
        canonicalDiagnostics = {
          ...canonicalDiagnostics,
          lastCompact: {
            ...(result?.diagnostics || {}),
            finalStatus: "Stale"
          }
        };
        return false;
      }
      if (!result?.plan?.nextState) return false;
      return executeDiagram2StatePlan(result.plan, {
        label: commandOptions.label || "Auto Format - Compact",
        reason: commandOptions.reason || "auto format compact"
      });
    } finally {
      busy = false;
      emit("busy");
    }
  }

  async function executeDiagram2StatePlan(plan, commandOptions = {}) {
    if (!plan?.nextState) return false;
    await history.execute(createDiagram2StructureStateCommand({
      nextState: plan.nextState,
      affectedObjectIds: plan.affectedObjectIds,
      affectedRelationshipIds: plan.affectedRelationshipIds,
      selectionAfter: plan.selectionAfter,
      label: commandOptions.label || plan.label || "Update diagram",
      reason: commandOptions.reason || plan.label || "update diagram"
    }), commandContext());
    emit("history", {
      diagnostics: plan.diagnostics || null
    });
    return true;
  }

  function synchronizeDiagram2FieldMappingTablesInPlan(plan) {
    if (!plan?.nextState) return plan;
    const affectedIds = new Set(plan.affectedObjectIds || []);
    const changedFieldRectangleIds = plan.nextState.objects
      .filter(object => affectedIds.has(object.id)
        && isDiagram2FieldRectangle(object)
        && !sameDiagram2Value(getObjectById(object.id), object))
      .map(object => object.id);
    if (!changedFieldRectangleIds.length) return plan;
    const tableUpdates = planDiagram2FieldMappingTableSync(
      plan.nextState.objects,
      changedFieldRectangleIds
    );
    if (!tableUpdates.length) return plan;
    const updatesById = new Map(tableUpdates.map(table => [table.id, table]));
    return {
      ...plan,
      nextState: {
        ...plan.nextState,
        objects: plan.nextState.objects.map(object => updatesById.get(object.id) || object)
      },
      affectedObjectIds: uniqueStrings([
        ...(plan.affectedObjectIds || []),
        ...updatesById.keys()
      ])
    };
  }

  function retargetDiagram2FieldMappingsInPlan(plan, entityIdInput, options = {}) {
    if (!plan?.nextState) return plan;
    const entityId = String(entityIdInput || "").trim();
    const previousEntity = getObjectById(entityId);
    const nextEntity = plan.nextState.objects.find(object => object.id === entityId && object.type === "entity");
    if (!previousEntity || !nextEntity) return plan;
    const previousReference = diagram2EntityReference(previousEntity);
    const nextReference = diagram2EntityReference(nextEntity);
    const previousFields = Array.isArray(previousEntity.fields) ? previousEntity.fields : [];
    const nextFields = Array.isArray(nextEntity.fields) ? nextEntity.fields : [];
    const changedIds = [];
    const objects = plan.nextState.objects.map(object => {
      const mapping = diagram2FieldRectangleMapping(object);
      if (!mapping || !sameDiagram2Identifier(mapping.referencedEntity, previousReference)) return object;
      const previousFieldIndex = previousFields.findIndex(field =>
        sameDiagram2Identifier(field?.name, mapping.referencedField));
      const matchingField = nextFields.find(field =>
        sameDiagram2Identifier(field?.name, mapping.referencedField));
      const targetField = matchingField
        || (options.fallbackByFieldIndex === true
          && previousFields.length === nextFields.length
          && previousFieldIndex >= 0
          ? nextFields[previousFieldIndex]
          : null);
      if (!targetField && options.clearMissingField !== true) return object;
      const nextMapping = targetField
        ? {
            ...mapping,
            referencedEntity: nextReference,
            referencedField: targetField.name
          }
        : null;
      if (nextMapping
        && sameDiagram2Identifier(mapping.referencedEntity, nextMapping.referencedEntity)
        && sameDiagram2Identifier(mapping.referencedField, nextMapping.referencedField)) return object;
      const nextObject = setDiagram2FieldRectangleMapping(object, nextMapping);
      if (!nextObject) return object;
      changedIds.push(object.id);
      return nextObject;
    });
    if (!changedIds.length) return plan;
    return {
      ...plan,
      nextState: {
        ...plan.nextState,
        objects
      },
      affectedObjectIds: uniqueStrings([
        ...(plan.affectedObjectIds || []),
        ...changedIds
      ])
    };
  }

  function diagram2EntityReference(entity) {
    return [entity?.entitySchema, entity?.entityName]
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .join(".");
  }

  function sameDiagram2Identifier(left, right) {
    const normalize = value => String(value || "")
      .trim()
      .replaceAll("[", "")
      .replaceAll("]]", "]")
      .replaceAll("]", "")
      .toLowerCase();
    return normalize(left) === normalize(right);
  }

  async function undo() {
    if (busy || destroyed || !canMutate()) return false;
    const before = history.status();
    if (!before.canUndo) return false;
    const startedAt = diagram2Now();
    const command = history.entries()[before.index] || null;
    await history.undo(commandContext());
    selectedObjectIds = existingSelectableIds(selectedObjectIds);
    if (command?.kind !== "relationship-route") renderer?.setSelectedIds?.(selectedObjectIds);
    if (command?.kind === "relationship-route") {
      finalizeRelationshipRouteCommit(command.lastResult?.(), {
        action: "undo",
        startedAt,
        pointerupReceivedAt: startedAt,
        previewFinalCoordinateAvailableAt: startedAt,
        planMs: 0,
        historyCommandRecordedAt: diagram2Now()
      });
    } else {
      emit("history");
    }
    return true;
  }

  async function redo() {
    if (busy || destroyed || !canMutate()) return false;
    const before = history.status();
    if (!before.canRedo) return false;
    const startedAt = diagram2Now();
    const command = history.entries()[before.index + 1] || null;
    await history.redo(commandContext());
    selectedObjectIds = existingSelectableIds(selectedObjectIds);
    if (command?.kind !== "relationship-route") renderer?.setSelectedIds?.(selectedObjectIds);
    if (command?.kind === "relationship-route") {
      finalizeRelationshipRouteCommit(command.lastResult?.(), {
        action: "redo",
        startedAt,
        pointerupReceivedAt: startedAt,
        previewFinalCoordinateAvailableAt: startedAt,
        planMs: 0,
        historyCommandRecordedAt: diagram2Now()
      });
    } else {
      emit("history");
    }
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
      formatPainterActive: activeTool === "format-painter" && Boolean(formatPainterStyles),
      gridVisible: canonicalState.gridVisible === true,
      snapToGrid: canonicalState.snapToGrid === true,
      gridSize: positiveNumber(canonicalState.gridSize, 20),
      busy,
      canRead: security.canRead !== false,
      canCreate: security.canCreate === true,
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
      selectedRelationships: selectedRelationshipObjects(),
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
      addObjectsCanonical,
      removeObjectsCanonical,
      setObjectOrderCanonical,
      setStructureStateCanonical,
      patchRelationshipRouteCanonical,
      setCanvasOptionCanonical,
      setState(nextState) {
        canonicalState = normalizeDiagram2CanonicalState(nextState);
        canonicalRevision += 1;
        rebuildCanonicalObjectIndex();
        rebuildCanonicalRelationshipIndex();
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
    patchDiagram2FieldMappingIndexes(
      fieldMappingIndexesState,
      [...nextObjectsById.keys()].map(id => ({
        previousObject: previousObjectsById.get(id) || null,
        nextObject: nextObjectsById.get(id) || null
      }))
    );
    if ([...nextObjectsById.keys()].some(id =>
      diagram2RelationshipStructureChanged(
        previousObjectsById.get(id),
        nextObjectsById.get(id)
      ))) {
      rebuildCanonicalRelationshipIndex();
    } else {
      nextObjectsById.forEach(nextObject =>
        patchCanonicalRelationshipIndexObject(nextObject));
    }
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
    patchDiagram2FieldMappingIndexes(fieldMappingIndexesState, {
      previousObject: null,
      nextObject
    });
    rebuildCanonicalRelationshipIndex();
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

  function addObjectsCanonical(objectsInput = [], addOptions = {}) {
    const objects = uniqueDiagram2Objects(objectsInput)
      .filter(object => !objectIndexById.has(object.id));
    if (!objects.length) {
      return recordCanonicalOperation({
        kind: "add-objects",
        changed: false,
        affectedObjectIds: [],
        requestedObjectCount: 0,
        objectLookupCount: 0,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(addOptions.reason || "add objects")
      });
    }

    const indexesById = addOptions.indexesById instanceof Map ? addOptions.indexesById : new Map();
    const nextObjects = canonicalState.objects.slice();
    objects
      .slice()
      .sort((left, right) =>
        finiteNumber(indexesById.get(left.id), nextObjects.length)
        - finiteNumber(indexesById.get(right.id), nextObjects.length))
      .forEach(object => {
        const index = clampNumber(
          finiteNumber(indexesById.get(object.id), nextObjects.length),
          0,
          nextObjects.length
        );
        nextObjects.splice(index, 0, object);
      });
    canonicalState = {
      ...canonicalState,
      objects: nextObjects,
      groupNames: {
        ...(canonicalState.groupNames || {}),
        ...plainDiagram2Record(addOptions.groupNames)
      },
      groupVisibility: {
        ...(canonicalState.groupVisibility || {}),
        ...plainDiagram2BooleanRecord(addOptions.groupVisibility)
      }
    };
    canonicalState = pruneDiagram2GroupMetadata(canonicalState);
    rebuildCanonicalObjectIndex();
    rebuildCanonicalRelationshipIndex();
    return recordCanonicalOperation({
      kind: "add-objects",
      changed: true,
      affectedObjectIds: objects.map(object => object.id),
      requestedObjectCount: objects.length,
      objectLookupCount: 0,
      objectPatchCount: objects.length,
      objectArrayCopyCount: 1,
      objectContainerReindexed: true,
      fullStateNormalizationCount: 0,
      fullStateSerializationCount: 0,
      canonicalObjectCount: canonicalState.objects.length,
      nextObjectsById: new Map(objects.map(object => [object.id, object])),
      reason: String(addOptions.reason || "add objects")
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
    const previousIndexesById = new Map();
    const nextObjects = canonicalState.objects.filter(object => {
      if (!idsToRemove.has(object.id)) return true;
      previousObjectsById.set(object.id, object);
      previousIndexesById.set(object.id, objectIndexById.get(object.id));
      return false;
    });
    canonicalState = {
      ...canonicalState,
      objects: nextObjects
    };
    canonicalState = pruneDiagram2GroupMetadata(canonicalState);
    rebuildCanonicalObjectIndex();
    rebuildCanonicalRelationshipIndex();
    selectedObjectIds = existingSelectableIds(selectedObjectIds);
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
      previousIndexesById,
      nextObjectsById: new Map(),
      reason: String(removeOptions.reason || "remove objects")
    });
  }

  function setObjectOrderCanonical(idsInput = [], orderOptions = {}) {
    const requestedOrder = uniqueStrings(idsInput);
    const currentOrder = canonicalState.objects.map(object => object.id);
    if (requestedOrder.length !== currentOrder.length
      || requestedOrder.some(id => !objectIndexById.has(id))) {
      return recordCanonicalOperation({
        kind: "arrange-objects",
        changed: false,
        affectedObjectIds: [],
        requestedObjectCount: requestedOrder.length,
        objectLookupCount: requestedOrder.length,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(orderOptions.reason || "arrange objects")
      });
    }

    const affectedObjectIds = requestedOrder.filter((id, index) => currentOrder[index] !== id);
    if (!affectedObjectIds.length) {
      return recordCanonicalOperation({
        kind: "arrange-objects",
        changed: false,
        affectedObjectIds: [],
        requestedObjectCount: requestedOrder.length,
        objectLookupCount: requestedOrder.length,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(orderOptions.reason || "arrange objects")
      });
    }

    canonicalState = {
      ...canonicalState,
      objects: requestedOrder.map(id => objectById.get(id))
    };
    rebuildCanonicalObjectIndex();
    return recordCanonicalOperation({
      kind: "arrange-objects",
      changed: true,
      affectedObjectIds,
      requestedObjectCount: requestedOrder.length,
      objectLookupCount: requestedOrder.length,
      objectPatchCount: 0,
      objectArrayCopyCount: 1,
      objectContainerReindexed: true,
      fullStateNormalizationCount: 0,
      fullStateSerializationCount: 0,
      canonicalObjectCount: canonicalState.objects.length,
      reason: String(orderOptions.reason || "arrange objects")
    });
  }

  function setStructureStateCanonical(nextStateInput = {}, structureOptions = {}) {
    const nextState = pruneDiagram2GroupMetadata(structureOptions.replaceState === true
      ? nextStateInput
      : {
          ...canonicalState,
          ...(nextStateInput && typeof nextStateInput === "object" ? nextStateInput : {})
        });
    const currentOrder = canonicalState.objects.map(object => object.id);
    const nextOrder = nextState.objects.map(object => object.id);
    const requestedAffectedIds = uniqueStrings(structureOptions.affectedObjectIds);
    const requestedAffectedRelationshipIds = uniqueStrings(structureOptions.affectedRelationshipIds);
    const affectedObjectIds = requestedAffectedIds.length
      ? requestedAffectedIds
      : uniqueStrings([
          ...currentOrder,
          ...nextOrder
        ]).filter(id => {
          const previousObject = objectById.get(id);
          const nextObject = nextState.objects.find(object => object.id === id);
          return JSON.stringify(previousObject || null) !== JSON.stringify(nextObject || null);
        });
    const groupChanged = JSON.stringify(canonicalState.groupNames || {}) !== JSON.stringify(nextState.groupNames || {})
      || JSON.stringify(canonicalState.groupVisibility || {}) !== JSON.stringify(nextState.groupVisibility || {});
    const orderChanged = currentOrder.length !== nextOrder.length
      || currentOrder.some((id, index) => id !== nextOrder[index]);
    const globalRelationshipChanged = ["relationshipStyle", "allowOverlappingEntityLines", "hideAllEntityRelationships", "manualEntityRelationshipRoutes", "compactEntityRelationshipRouting"]
      .some(key => JSON.stringify(canonicalState[key] ?? null) !== JSON.stringify(nextState[key] ?? null));
    const changed = Boolean(affectedObjectIds.length || requestedAffectedRelationshipIds.length || groupChanged || orderChanged || globalRelationshipChanged);
    if (!changed) {
      return recordCanonicalOperation({
        kind: "structure-state",
        changed: false,
        affectedObjectIds: [],
        affectedRelationshipIds: [],
        requestedObjectCount: requestedAffectedIds.length,
        objectLookupCount: requestedAffectedIds.length,
        objectPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        reason: String(structureOptions.reason || "structure state")
      });
    }

    canonicalState = nextState;
    rebuildCanonicalObjectIndex();
    rebuildCanonicalRelationshipIndex();
    selectedObjectIds = existingSelectableIds(selectedObjectIds);
    return recordCanonicalOperation({
      kind: "structure-state",
      changed: true,
      affectedObjectIds,
      affectedRelationshipIds: requestedAffectedRelationshipIds,
      requestedObjectCount: requestedAffectedIds.length,
      objectLookupCount: requestedAffectedIds.length,
      objectPatchCount: affectedObjectIds.length,
      objectArrayCopyCount: 1,
      objectContainerReindexed: orderChanged,
      fullStateNormalizationCount: 0,
      fullStateSerializationCount: 0,
      canonicalObjectCount: canonicalState.objects.length,
      canonicalRelationshipCount,
      reason: String(structureOptions.reason || "structure state")
    });
  }

  function patchRelationshipRouteCanonical(routeInput = {}) {
    const startedAt = diagram2Now();
    const relationshipId = String(routeInput.relationshipId || "").trim();
    const locator = relationshipLocatorById.get(relationshipId);
    const sourceEntityId = String(routeInput.sourceEntityId || locator?.sourceEntityId || "").trim();
    const foreignKeyIndex = Number.isInteger(routeInput.foreignKeyIndex)
      ? routeInput.foreignKeyIndex
      : locator?.foreignKeyIndex;
    const sourceIndex = objectIndexById.get(sourceEntityId);
    const previousSource = Number.isInteger(sourceIndex) ? canonicalState.objects[sourceIndex] : null;
    const previousForeignKey = previousSource?.foreignKeys?.[foreignKeyIndex];
    const routeOverride = compactDiagram2RelationshipPoints(routeInput.routeOverride);
    const hasRouteOverride = routeOverride.length > 1;
    const nextManualRoutes = routeInput.manualEntityRelationshipRoutes === true;
    const previousRouteOverride = compactDiagram2RelationshipPoints(previousForeignKey?.routeOverride);
    if (!locator || !previousSource || !previousForeignKey
      || (sameDiagram2RelationshipRoute(previousRouteOverride, routeOverride)
        && canonicalState.manualEntityRelationshipRoutes === nextManualRoutes)) {
      return recordCanonicalOperation({
        kind: "relationship-route",
        changed: false,
        affectedObjectIds: [],
        affectedRelationshipIds: [],
        relationshipLookupCount: 1,
        requestedObjectCount: 1,
        objectLookupCount: 1,
        objectPatchCount: 0,
        foreignKeyPatchCount: 0,
        objectArrayCopyCount: 0,
        objectContainerReindexed: false,
        relationshipIndexRebuildCount: 0,
        mappingIndexRebuildCount: 0,
        annotationIndexRebuildCount: 0,
        fullStateNormalizationCount: 0,
        fullStateSerializationCount: 0,
        canonicalObjectCount: canonicalState.objects.length,
        durationMs: diagram2Now() - startedAt,
        reason: String(routeInput.reason || "relationship route")
      });
    }

    const nextForeignKey = { ...previousForeignKey };
    if (hasRouteOverride) nextForeignKey.routeOverride = routeOverride;
    else delete nextForeignKey.routeOverride;
    const nextForeignKeys = previousSource.foreignKeys.slice();
    nextForeignKeys[foreignKeyIndex] = nextForeignKey;
    const nextSource = {
      ...previousSource,
      foreignKeys: nextForeignKeys
    };
    const nextObjects = canonicalState.objects.slice();
    nextObjects[sourceIndex] = nextSource;
    canonicalState = {
      ...canonicalState,
      manualEntityRelationshipRoutes: nextManualRoutes,
      objects: nextObjects
    };
    objectById.set(sourceEntityId, nextSource);

    const previousRelationship = locator.relationship;
    const normalizedForeignKey = { ...(previousRelationship.foreignKey || {}) };
    if (hasRouteOverride) normalizedForeignKey.routeOverride = routeOverride;
    else delete normalizedForeignKey.routeOverride;
    const nextRelationship = {
      ...previousRelationship,
      source: nextSource,
      ...(locator.targetEntityId === sourceEntityId ? { target: nextSource } : {}),
      foreignKey: normalizedForeignKey,
      foreignKeySource: nextForeignKey
    };
    locator.relationship = nextRelationship;
    locator.selectionObject = diagram2RelationshipSelectionObject(
      nextRelationship,
      canonicalState.relationshipStyle
    );
    if (hasRouteOverride) relationshipIdsWithRouteOverride.add(relationshipId);
    else relationshipIdsWithRouteOverride.delete(relationshipId);

    return recordCanonicalOperation({
      kind: "relationship-route",
      changed: true,
      affectedObjectIds: [sourceEntityId],
      affectedRelationshipIds: [relationshipId],
      relationshipLookupCount: 1,
      requestedObjectCount: 1,
      objectLookupCount: 1,
      objectPatchCount: 1,
      foreignKeyPatchCount: 1,
      objectArrayCopyCount: 1,
      objectContainerReindexed: false,
      relationshipIndexRebuildCount: 0,
      mappingIndexRebuildCount: 0,
      annotationIndexRebuildCount: 0,
      fullStateNormalizationCount: 0,
      fullStateSerializationCount: 0,
      canonicalObjectCount: canonicalState.objects.length,
      canonicalRelationshipCount,
      previousObjectsById: new Map([[sourceEntityId, previousSource]]),
      nextObjectsById: new Map([[sourceEntityId, nextSource]]),
      canonicalRouteUpdatedAt: diagram2Now(),
      durationMs: diagram2Now() - startedAt,
      reason: String(routeInput.reason || "relationship route")
    });
  }

  function finalizeRelationshipRouteCommit(resultInput = null, timing = {}) {
    const result = resultInput && typeof resultInput === "object" ? resultInput : {};
    const operation = result.canonicalOperation || {};
    const rendererDiagnostics = result.rendererDiagnostics || {};
    const startedAt = finiteNumber(timing.startedAt, result.startedAt || diagram2Now());
    const historyCommandRecordedAt = finiteNumber(timing.historyCommandRecordedAt, diagram2Now());
    const planMs = Math.max(0, finiteNumber(timing.planMs, 0));
    const canonicalMs = Math.max(0, finiteNumber(result.canonicalMs, operation.durationMs || 0));
    const rendererFlushMs = Math.max(0, finiteNumber(
      rendererDiagnostics.routeCommitRendererFlushMs,
      result.rendererMs || 0
    ));
    const historyMs = Math.max(
      0,
      historyCommandRecordedAt - startedAt - planMs - canonicalMs - rendererFlushMs
    );
    let routeCommit = {
      action: String(timing.action || result.action || "apply"),
      relationshipId: String(result.relationshipId || ""),
      sourceEntityId: String(result.sourceEntityId || ""),
      foreignKeyIndex: Number.isInteger(result.foreignKeyIndex) ? result.foreignKeyIndex : -1,
      pointerupReceivedAt: finiteNumber(timing.pointerupReceivedAt, startedAt),
      previewFinalCoordinateAvailableAt: finiteNumber(
        timing.previewFinalCoordinateAvailableAt,
        startedAt
      ),
      canonicalRouteUpdatedAt: finiteNumber(
        operation.canonicalRouteUpdatedAt,
        result.canonicalCompletedAt || historyCommandRecordedAt
      ),
      realRelationshipPathPatchedAt: finiteNumber(
        rendererDiagnostics.realRelationshipPathPatchedAt,
        result.rendererCompletedAt || historyCommandRecordedAt
      ),
      routeHandlesPatchedAt: finiteNumber(
        rendererDiagnostics.routeHandlesPatchedAt,
        result.rendererCompletedAt || historyCommandRecordedAt
      ),
      historyCommandRecordedAt,
      rendererFlushScheduledAt: finiteNumber(
        rendererDiagnostics.rendererFlushScheduledAt,
        result.rendererStartedAt || historyCommandRecordedAt
      ),
      rendererFlushCompletedAt: finiteNumber(
        rendererDiagnostics.rendererFlushCompletedAt,
        result.rendererCompletedAt || historyCommandRecordedAt
      ),
      shellControlsStatusCompletedAt: 0,
      mainThreadResponsiveAt: 0,
      routeCommitTotalMs: 0,
      routeCommitPlanMs: Math.round(planMs * 100) / 100,
      routeCommitCanonicalMs: Math.round(canonicalMs * 100) / 100,
      routeCommitHistoryMs: Math.round(historyMs * 100) / 100,
      routeCommitRendererScheduleMs: Math.round(
        Math.max(0, finiteNumber(rendererDiagnostics.routeCommitRendererScheduleMs, 0)) * 100
      ) / 100,
      routeCommitRendererFlushMs: Math.round(rendererFlushMs * 100) / 100,
      routeCommitShellMs: 0,
      routeCommitRelationshipLookupCount: finiteNumber(operation.relationshipLookupCount, 1),
      routeCommitRelationshipsConsidered: finiteNumber(
        rendererDiagnostics.routeCommitRelationshipsConsidered,
        1
      ),
      routeCommitRelationshipsRerouted: finiteNumber(
        rendererDiagnostics.routeCommitRelationshipsRerouted,
        0
      ),
      routeCommitObjectsVisited: finiteNumber(operation.objectLookupCount, 1),
      routeCommitObjectsPatched: finiteNumber(operation.objectPatchCount, 1),
      routeCommitForeignKeysPatched: finiteNumber(operation.foreignKeyPatchCount, 1),
      routeCommitObjectIndexRebuildCount: 0,
      routeCommitRelationshipIndexRebuildCount: finiteNumber(
        operation.relationshipIndexRebuildCount,
        0
      ),
      routeCommitMappingIndexRebuildCount: finiteNumber(operation.mappingIndexRebuildCount, 0),
      routeCommitAnnotationIndexRebuildCount: finiteNumber(operation.annotationIndexRebuildCount, 0),
      routeCommitFullStateNormalizationCount: finiteNumber(operation.fullStateNormalizationCount, 0),
      routeCommitFullStateSerializationCount: finiteNumber(operation.fullStateSerializationCount, 0),
      routeCommitFullRenderDelta: finiteNumber(rendererDiagnostics.routeCommitFullRenderDelta, 0),
      routeCommitDirtyFlushDelta: finiteNumber(rendererDiagnostics.routeCommitDirtyFlushDelta, 0),
      routeCommitLongTaskMs: 0
    };
    canonicalDiagnostics = {
      ...canonicalDiagnostics,
      lastRouteCommit: routeCommit
    };

    const shellStartedAt = diagram2Now();
    emit("relationship-route", { diagnostics: routeCommit });
    const shellCompletedAt = diagram2Now();
    const totalMs = Math.max(0, shellCompletedAt - routeCommit.pointerupReceivedAt);
    routeCommit = {
      ...routeCommit,
      shellControlsStatusCompletedAt: shellCompletedAt,
      routeCommitShellMs: Math.round(Math.max(0, shellCompletedAt - shellStartedAt) * 100) / 100,
      routeCommitTotalMs: Math.round(totalMs * 100) / 100,
      routeCommitLongTaskMs: Math.round(totalMs * 100) / 100
    };
    canonicalDiagnostics = {
      ...canonicalDiagnostics,
      lastRouteCommit: routeCommit
    };
    renderer?.completeRelationshipRouteCommit?.(routeCommit);
    return routeCommit;
  }

  function completeRelationshipRouteCommit(patchInput = {}) {
    const previous = canonicalDiagnostics.lastRouteCommit;
    if (!previous) return null;
    const patch = patchInput && typeof patchInput === "object" ? patchInput : {};
    const mainThreadResponsiveAt = finiteNumber(patch.mainThreadResponsiveAt, diagram2Now());
    const totalMs = Math.max(0, mainThreadResponsiveAt - previous.pointerupReceivedAt);
    const next = {
      ...previous,
      ...patch,
      mainThreadResponsiveAt,
      routeCommitTotalMs: Math.round(totalMs * 100) / 100,
      routeCommitLongTaskMs: Math.max(
        finiteNumber(previous.routeCommitLongTaskMs, 0),
        finiteNumber(patch.routeCommitLongTaskMs, 0)
      )
    };
    canonicalDiagnostics = {
      ...canonicalDiagnostics,
      lastRouteCommit: next
    };
    renderer?.completeRelationshipRouteCommit?.(next);
    return next;
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

  function existingSelectableIds(ids) {
    return uniqueStrings(ids).filter(id => objectIndexById.has(id) || relationshipLocatorById.has(id));
  }

  function expandDiagram2SelectableSelectionIds(ids) {
    const exactIds = uniqueStrings(ids);
    const objectIds = exactIds.filter(id => objectIndexById.has(id));
    const relationshipIds = exactIds.filter(id => !objectIndexById.has(id));
    const expandedObjectIds = new Set(objectIds);
    objectIds.forEach(id => {
      const object = objectById.get(id);
      const groupId = String(object?.groupId || object?.entityAnnotationGroupId || "").trim();
      (objectIdsByGroupId.get(groupId) || []).forEach(groupObjectId => expandedObjectIds.add(groupObjectId));
      (entityAnnotationIndexes.childrenByOwnerId.get(id) || []).forEach(childId => expandedObjectIds.add(childId));
    });
    return [
      ...expandedObjectIds,
      ...relationshipIds
    ];
  }

  function rebuildCanonicalObjectIndex() {
    objectById = new Map();
    objectIndexById = new Map();
    objectIdsByGroupId = new Map();
    canonicalState.objects.forEach((object, index) => {
      const id = String(object?.id || "").trim();
      if (!id || objectIndexById.has(id)) return;
      objectById.set(id, object);
      objectIndexById.set(id, index);
      const groupId = String(object?.groupId || "").trim();
      if (groupId) {
        const objectIds = objectIdsByGroupId.get(groupId) || [];
        objectIds.push(id);
        objectIdsByGroupId.set(groupId, objectIds);
      }
    });
    entityAnnotationIndexes = createDiagram2EntityAnnotationIndexes(canonicalState.objects);
    fieldMappingIndexesState = createDiagram2FieldMappingIndexes(canonicalState.objects);
  }

  function rebuildCanonicalRelationshipIndex() {
    const relationships = diagram2CanonicalRelationships(canonicalState);
    relationshipLocatorById = new Map();
    relationshipIdsByEntityId = new Map();
    relationshipIdsWithRouteOverride = new Set();
    relationships.forEach(relationship => {
      const relationshipId = String(relationship?.id || "").trim();
      const sourceEntityId = String(relationship?.source?.id || "").trim();
      if (!relationshipId || !sourceEntityId || !Number.isInteger(relationship.foreignKeyIndex)) return;
      relationshipLocatorById.set(relationshipId, {
        relationshipId,
        sourceEntityId,
        targetEntityId: String(relationship?.target?.id || "").trim(),
        foreignKeyIndex: relationship.foreignKeyIndex,
        relationship,
        selectionObject: diagram2RelationshipSelectionObject(
          relationship,
          canonicalState.relationshipStyle
        )
      });
      addToDiagram2SetMap(relationshipIdsByEntityId, sourceEntityId, relationshipId);
      addToDiagram2SetMap(
        relationshipIdsByEntityId,
        String(relationship?.target?.id || "").trim(),
        relationshipId
      );
      if (relationship.foreignKeySource?.routeOverride?.length > 1) {
        relationshipIdsWithRouteOverride.add(relationshipId);
      }
    });
    canonicalRelationshipCount = relationshipLocatorById.size;
    relationshipIndexRebuildCount += 1;
  }

  function patchCanonicalRelationshipIndexObject(nextObject) {
    const objectId = String(nextObject?.id || "").trim();
    const relationshipIds = relationshipIdsByEntityId.get(objectId);
    if (!objectId || !relationshipIds?.size) return;
    relationshipIds.forEach(relationshipId => {
      const locator = relationshipLocatorById.get(relationshipId);
      const previousRelationship = locator?.relationship;
      if (!locator || !previousRelationship) return;
      const source = locator.sourceEntityId === objectId
        ? nextObject
        : previousRelationship.source;
      const target = locator.targetEntityId === objectId
        ? nextObject
        : previousRelationship.target;
      const nextRelationship = {
        ...previousRelationship,
        source,
        target,
        sourceField: findDiagram2FieldByName(source, previousRelationship.sourceField?.name),
        targetField: findDiagram2FieldByName(target, previousRelationship.targetField?.name)
      };
      locator.relationship = nextRelationship;
      locator.selectionObject = diagram2RelationshipSelectionObject(
        nextRelationship,
        canonicalState.relationshipStyle
      );
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
    if (operation?.changed === true) canonicalRevision += 1;
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
      canonicalRelationshipIndexSize: relationshipLocatorById.size,
      canonicalRelationshipEntityIndexSize: relationshipIdsByEntityId.size,
      canonicalRelationshipRouteOverrideCount: relationshipIdsWithRouteOverride.size,
      relationshipIndexRebuildCount,
      entityAnnotationOwnerIndexSize: entityAnnotationIndexes.childrenByOwnerId.size,
      entityAnnotationChildIndexSize: entityAnnotationIndexes.ownerIdByChildId.size,
      canonicalRevision,
      fullStateNormalizationCount: canonicalDiagnostics.fullStateNormalizationCount,
      fullStateSerializationCount: canonicalDiagnostics.fullStateSerializationCount,
      stateReplacementCount: canonicalDiagnostics.stateReplacementCount,
      lastCanonicalOperation: canonicalDiagnostics.lastOperation,
      lastCompact: canonicalDiagnostics.lastCompact,
      lastRouteCommit: canonicalDiagnostics.lastRouteCommit
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
    setGridVisible,
    setSnapToGrid,
    snapPoint,
    snapMovement,
    keyboardNudgeStep,
    selectAll,
    selectStructureNode,
    getObjectById,
    getObjectsByIds,
    updateObjectCanonical,
    updateObjectsCanonical,
    addObjectCanonical,
    addObjectsCanonical,
    removeObjectsCanonical,
    setStructureStateCanonical,
    addObject,
    addObjects,
    addEmbeddedImage,
    updateEmbeddedImageCrop,
    setEmbeddedImageCropVisibility,
    permanentlyCropEmbeddedImage,
    setEntityAnnotation,
    addFieldRectangle,
    renameFieldRectangle,
    setFieldRectangleConnectionSide,
    setFieldRectangleMapping,
    addFieldMappingTable,
    fieldMappingIndexes,
    fieldRectangleMapping,
    selectFieldMapping,
    addEntity,
    updateEntityDefinition,
    setEntityOption,
    resetEntityScale,
    updateEntityField,
    addEntityField,
    removeEntityField,
    moveEntityField,
    setEntityFieldReference,
    addRelationship,
    updateRelationshipsStyle,
    setRelationshipType,
    setRelationshipRoutingOptions,
    useRelationshipRoute,
    adjustRelationshipRoute,
    commitRelationshipRouteOverride,
    completeRelationshipRouteCommit,
    insertRelationshipRoutePoint,
    removeRelationshipRoutePoint,
    clearRelationshipRoutes,
    compactAvailability,
    autoFormatCompact,
    deleteSelectedObjects,
    duplicateSelectedObjects,
    selectionClipboardText,
    pasteSelectionClipboardText,
    updateObjectText,
    beginFormatPainter,
    cancelFormatPainter,
    applyFormatPainter,
    setSelectedObjectsLocked,
    setStructureNodeLocked,
    arrangeSelectedObjects,
    groupSelectedObjects,
    ungroupSelectedObjects,
    renameStructureNode,
    setStructureNodeVisibility,
    reorderStructureNode,
    moveSelectedObjects,
    updateSelectedObjectsStyle,
    previewSelectedObjectsStyle,
    moveObjects,
    resizeObjects,
    createDefaultObject,
    setDrawingDefaults,
    currentDrawingDefaults,
    setDrawingDefaultFromSelection,
    resetDrawingDefault,
    applyTemplate,
    applyTemplateFormatting,
    undo,
    redo,
    markSaved,
    setBusy,
    onChange,
    statusSnapshot,
    currentState,
    state: () => normalizeDiagram2CanonicalState(canonicalState),
    selectedObjectIds: () => selectedObjectIds.slice(),
    selectedRelationshipIds,
    selectedRelationshipObjects,
    activeTool: () => activeTool,
    formatPainterActive: () => activeTool === "format-painter" && Boolean(formatPainterStyles),
    historyStatus: () => history.status(),
    diagnostics,
    destroy
  };
}

export function createDiagram2RelationshipRouteCommand(options = {}) {
  const relationshipId = String(options.relationshipId || "").trim();
  const sourceEntityId = String(options.sourceEntityId || "").trim();
  const foreignKeyIndex = Number.parseInt(options.foreignKeyIndex, 10);
  const previousRouteOverride = compactDiagram2RelationshipPoints(options.previousRouteOverride);
  const previousRenderedPoints = compactDiagram2RelationshipPoints(
    options.previousRenderedPoints?.length
      ? options.previousRenderedPoints
      : previousRouteOverride
  );
  const nextRouteOverride = compactDiagram2RelationshipPoints(options.nextRouteOverride);
  const nextRenderedPoints = compactDiagram2RelationshipPoints(
    options.nextRenderedPoints?.length
      ? options.nextRenderedPoints
      : nextRouteOverride
  );
  const previousManualRoutes = options.previousManualRoutes === true;
  const nextManualRoutes = options.nextManualRoutes === true;
  const additionalRouteTransitions = (Array.isArray(options.additionalRouteTransitions)
    ? options.additionalRouteTransitions
    : [])
    .map(transition => ({
      relationshipId: String(transition?.relationshipId || "").trim(),
      sourceEntityId: String(transition?.sourceEntityId || "").trim(),
      foreignKeyIndex: Number.parseInt(transition?.foreignKeyIndex, 10),
      routeOverride: compactDiagram2RelationshipPoints(transition?.routeOverride),
      previousRenderedPoints: compactDiagram2RelationshipPoints(transition?.previousRenderedPoints)
    }))
    .filter(transition =>
      transition.relationshipId
      && transition.sourceEntityId
      && Number.isInteger(transition.foreignKeyIndex)
      && transition.routeOverride.length > 1
      && transition.previousRenderedPoints.length > 1);
  const selectionBefore = uniqueStrings(options.selectionBefore);
  const selectionAfter = uniqueStrings(options.selectionAfter?.length
    ? options.selectionAfter
    : [relationshipId]);
  const label = String(options.label || "Adjust manual relationship route").trim()
    || "Adjust manual relationship route";
  const reason = String(options.reason || "adjust relationship route").trim()
    || "adjust relationship route";
  const createdAt = Date.now();
  let lastApplyResult = null;

  const applyRoute = (
    context,
    routeOverride,
    renderedPoints,
    manualRoutes,
    selection,
    action,
    operationReason,
    rendererAlreadyPreviewed = false,
    path = ""
  ) => {
    const startedAt = diagram2Now();
    const canonicalStartedAt = diagram2Now();
    const canonicalOperation = context.patchRelationshipRouteCanonical({
      relationshipId,
      sourceEntityId,
      foreignKeyIndex,
      routeOverride,
      manualEntityRelationshipRoutes: manualRoutes,
      reason: operationReason
    });
    const canonicalCompletedAt = diagram2Now();
    if (canonicalOperation.changed !== true) return false;

    const rendererStartedAt = diagram2Now();
    const rendererResults = [];
    const rendererDiagnostics = context.renderer?.commitRelationshipRoutePreview?.({
      relationshipId,
      sourceEntityId,
      foreignKeyIndex,
      routeOverride,
      points: renderedPoints,
      path: path || diagram2RelationshipPath(renderedPoints),
      manualEntityRelationshipRoutes: manualRoutes,
      rendererAlreadyPreviewed,
      reason: operationReason
    }) || null;
    if (rendererDiagnostics) rendererResults.push(rendererDiagnostics);
    additionalRouteTransitions.forEach(transition => {
      const points = manualRoutes
        ? transition.routeOverride
        : transition.previousRenderedPoints;
      const relatedDiagnostics = context.renderer?.commitRelationshipRoutePreview?.({
        relationshipId: transition.relationshipId,
        sourceEntityId: transition.sourceEntityId,
        foreignKeyIndex: transition.foreignKeyIndex,
        routeOverride: transition.routeOverride,
        points,
        path: diagram2RelationshipPath(points),
        manualEntityRelationshipRoutes: manualRoutes,
        rendererAlreadyPreviewed: false,
        reason: operationReason
      });
      if (relatedDiagnostics) rendererResults.push(relatedDiagnostics);
    });
    const rendererCompletedAt = diagram2Now();
    context.setSelection(selection, { expandGroups: false });
    lastApplyResult = {
      action,
      relationshipId,
      sourceEntityId,
      foreignKeyIndex,
      startedAt,
      canonicalOperation,
      canonicalStartedAt,
      canonicalCompletedAt,
      canonicalMs: canonicalCompletedAt - canonicalStartedAt,
      rendererDiagnostics: mergeDiagram2RelationshipRouteRendererDiagnostics(rendererResults),
      rendererStartedAt,
      rendererCompletedAt,
      rendererMs: rendererCompletedAt - rendererStartedAt
    };
    return true;
  };

  return {
    kind: "relationship-route",
    label,
    reason,
    relationshipId,
    sourceEntityId,
    foreignKeyIndex,
    createdAt,
    apply(context) {
      return applyRoute(
        context,
        nextRouteOverride,
        nextRenderedPoints,
        nextManualRoutes,
        selectionAfter,
        "apply",
        reason,
        options.rendererAlreadyPreviewed === true,
        String(options.nextPath || "")
      );
    },
    undo(context) {
      return applyRoute(
        context,
        previousRouteOverride,
        previousRenderedPoints,
        previousManualRoutes,
        selectionBefore,
        "undo",
        `${reason} undo`
      );
    },
    redo(context) {
      return applyRoute(
        context,
        nextRouteOverride,
        nextRenderedPoints,
        nextManualRoutes,
        selectionAfter,
        "redo",
        `${reason} redo`
      );
    },
    lastResult() {
      return lastApplyResult;
    }
  };
}

export function createDiagram2AddObjectCommand(options = {}) {
  const objectId = String(options.object?.id || "").trim();
  const object = { ...(options.object || {}), id: objectId };
  const reason = String(options.reason || "add object").trim() || "add object";
  const label = String(options.label || "Add object").trim() || "Add object";
  const createdAt = Date.now();
  let previousSelection = [];

  return {
    kind: "add-object",
    label,
    objectId,
    object,
    reason,
    createdAt,
    apply(context) {
      if (!objectId || context.getObjectById(objectId)) return false;
      previousSelection = context.selectedObjectIds();
      const add = context.addObjectCanonical(object, {
        reason
      });
      if (add.changed !== true) return false;

      const renderer = context.renderer;
      renderer?.beginDiagramUpdate?.(reason);
      renderer?.addObject?.(add.nextObjectsById?.get(objectId) || object);
      context.setSelection([objectId]);
      renderer?.endDiagramUpdate?.(reason);
      return true;
    },
    undo(context) {
      if (!objectId || !context.getObjectById(objectId)) return false;
      const remove = context.removeObjectsCanonical([objectId], {
        reason: `${reason} undo`
      });
      if (remove.changed !== true) return false;

      const renderer = context.renderer;
      renderer?.beginDiagramUpdate?.(`${reason} undo`);
      renderer?.removeObject?.(objectId);
      context.setSelection(previousSelection, { expandGroups: false });
      renderer?.endDiagramUpdate?.(`${reason} undo`);
      return true;
    },
    redo(context) {
      if (!objectId || context.getObjectById(objectId)) return false;
      const add = context.addObjectCanonical(object, {
        reason: `${reason} redo`
      });
      if (add.changed !== true) return false;

      const renderer = context.renderer;
      renderer?.beginDiagramUpdate?.(`${reason} redo`);
      renderer?.addObject?.(add.nextObjectsById?.get(objectId) || object);
      context.setSelection([objectId]);
      renderer?.endDiagramUpdate?.(`${reason} redo`);
      return true;
    }
  };
}

export function createDiagram2AddObjectsCommand(options = {}) {
  const objects = uniqueDiagram2Objects(options.objects).map(cloneDiagram2Value);
  const objectIds = objects.map(object => object.id);
  const groupNames = plainDiagram2Record(options.groupNames);
  const groupVisibility = plainDiagram2BooleanRecord(options.groupVisibility);
  const reason = String(options.reason || "add objects").trim() || "add objects";
  const label = String(options.label || "Add objects").trim() || "Add objects";
  const createdAt = Date.now();
  let previousSelection = [];

  return {
    kind: "add-objects",
    label,
    objectIds,
    reason,
    createdAt,
    apply(context) {
      previousSelection = context.selectedObjectIds();
      const add = context.addObjectsCanonical(objects, { groupNames, groupVisibility, reason });
      if (add.changed !== true) return false;
      patchDiagram2RendererObjectAdd(context.renderer, objects, reason, null, {
        groupNames,
        groupVisibility,
        state: context.state
      });
      context.setSelection(objectIds);
      return true;
    },
    undo(context) {
      const remove = context.removeObjectsCanonical(objectIds, { reason: `${reason} undo` });
      if (remove.changed !== true) return false;
      patchDiagram2RendererObjectRemove(context.renderer, objectIds, `${reason} undo`, {
        state: context.state,
        affectedObjectIds: objectIds
      });
      context.setSelection(previousSelection, { expandGroups: false });
      return true;
    },
    redo(context) {
      const add = context.addObjectsCanonical(objects, {
        groupNames,
        groupVisibility,
        reason: `${reason} redo`
      });
      if (add.changed !== true) return false;
      patchDiagram2RendererObjectAdd(context.renderer, objects, `${reason} redo`, null, {
        groupNames,
        groupVisibility,
        state: context.state
      });
      context.setSelection(objectIds);
      return true;
    }
  };
}

export function createDiagram2DeleteObjectsCommand(options = {}) {
  const entries = (Array.isArray(options.objects) ? options.objects : [])
    .map(entry => ({
      object: cloneDiagram2Value(entry?.object),
      index: finiteNumber(entry?.index, 0)
    }))
    .filter(entry => entry.object?.id);
  const objects = entries.map(entry => entry.object);
  const objectIds = objects.map(object => object.id);
  const indexesById = new Map(entries.map(entry => [entry.object.id, entry.index]));
  const selectionBefore = uniqueStrings(options.selectionBefore || objectIds);
  const reason = String(options.reason || "delete objects").trim() || "delete objects";
  const label = String(options.label || "Delete objects").trim() || "Delete objects";
  const createdAt = Date.now();
  let groupNames = {};
  let groupVisibility = {};

  return {
    kind: "delete-objects",
    label,
    objectIds,
    reason,
    createdAt,
    apply(context) {
      const groupIds = new Set(objects.map(object => object.groupId).filter(Boolean));
      groupNames = {};
      groupVisibility = {};
      groupIds.forEach(groupId => {
        if (Object.hasOwn(context.state?.groupNames || {}, groupId)) {
          groupNames[groupId] = context.state.groupNames[groupId];
        }
        if (Object.hasOwn(context.state?.groupVisibility || {}, groupId)) {
          groupVisibility[groupId] = context.state.groupVisibility[groupId] !== false;
        }
      });
      const remove = context.removeObjectsCanonical(objectIds, { reason });
      if (remove.changed !== true) return false;
      patchDiagram2RendererObjectRemove(context.renderer, objectIds, reason, {
        state: context.state,
        affectedObjectIds: objectIds
      });
      context.setSelection(selectionBefore.filter(id => !objectIds.includes(id)), { expandGroups: false });
      return true;
    },
    undo(context) {
      const add = context.addObjectsCanonical(objects, {
        indexesById,
        groupNames,
        groupVisibility,
        reason: `${reason} undo`
      });
      if (add.changed !== true) return false;
      patchDiagram2RendererObjectAdd(context.renderer, objects, `${reason} undo`, indexesById, {
        groupNames,
        groupVisibility,
        state: context.state
      });
      context.setSelection(objectIds, { expandGroups: false });
      return true;
    },
    redo(context) {
      const remove = context.removeObjectsCanonical(objectIds, { reason: `${reason} redo` });
      if (remove.changed !== true) return false;
      patchDiagram2RendererObjectRemove(context.renderer, objectIds, `${reason} redo`, {
        state: context.state,
        affectedObjectIds: objectIds
      });
      context.setSelection([]);
      return true;
    }
  };
}

export function createDiagram2PatchObjectsCommand(options = {}) {
  const nextObjectsById = new Map(uniqueDiagram2Objects(options.objects)
    .map(object => [object.id, cloneDiagram2Value(object)]));
  const objectIds = [...nextObjectsById.keys()];
  const reason = String(options.reason || "patch objects").trim() || "patch objects";
  const label = String(options.label || "Patch objects").trim() || "Patch objects";
  const createdAt = Date.now();
  const previousObjectsById = new Map();

  const applyObjects = (context, valuesById, operationReason, capturePrevious = false) => {
    const update = context.updateObjectsCanonical(objectIds, (object, id) => {
      const next = valuesById.get(id);
      if (!next) return object;
      if (capturePrevious) previousObjectsById.set(id, cloneDiagram2Value(object));
      return cloneDiagram2Value(next);
    }, {
      replace: true,
      reason: operationReason
    });
    if (update.changed !== true) return false;
    const renderer = context.renderer;
    renderer?.beginDiagramUpdate?.(operationReason);
    update.affectedObjectIds.forEach(id => renderer?.updateObject?.(id, cloneDiagram2Value(valuesById.get(id))));
    renderer?.endDiagramUpdate?.(operationReason);
    context.setSelection(update.affectedObjectIds, { expandGroups: false });
    return true;
  };

  return {
    kind: "patch-objects",
    label,
    objectIds,
    reason,
    createdAt,
    apply(context) {
      previousObjectsById.clear();
      return applyObjects(context, nextObjectsById, reason, true);
    },
    undo(context) {
      return applyObjects(context, previousObjectsById, `${reason} undo`);
    },
    redo(context) {
      return applyObjects(context, nextObjectsById, `${reason} redo`);
    }
  };
}

export function createDiagram2ObjectDeltaCommand(options = {}) {
  const touchedObjectIds = uniqueStrings(options.touchedObjectIds);
  const before = normalizeDiagram2DeltaSnapshot(options.before, touchedObjectIds);
  const after = normalizeDiagram2DeltaSnapshot(options.after, touchedObjectIds);
  const reason = String(options.reason || "update objects").trim() || "update objects";
  const label = String(options.label || "Update objects").trim() || "Update objects";

  const applySnapshot = (context, snapshot, operationReason) => {
    const desiredById = new Map(snapshot.objects.map(object => [object.id, cloneDiagram2Value(object)]));
    const currentIds = new Set(touchedObjectIds.filter(id => context.getObjectById(id)));
    const removeIds = [...currentIds].filter(id => !desiredById.has(id));
    const updateObjects = [...desiredById.values()]
      .filter(object => context.getObjectById(object.id))
      .filter(object => !sameDiagram2Value(context.getObjectById(object.id), object));
    const addObjects = [...desiredById.values()]
      .filter(object => !context.getObjectById(object.id));

    if (removeIds.length) context.removeObjectsCanonical(removeIds, { reason: operationReason });
    if (updateObjects.length) {
      const updatesById = new Map(updateObjects.map(object => [object.id, object]));
      context.updateObjectsCanonical(updateObjects.map(object => object.id), (_object, id) =>
        cloneDiagram2Value(updatesById.get(id)), {
        replace: true,
        reason: operationReason
      });
    }
    if (addObjects.length) {
      context.addObjectsCanonical(addObjects.map(cloneDiagram2Value), {
        indexesById: snapshot.indexesById,
        reason: operationReason
      });
    }
    const structureStateRequired = Boolean(
      removeIds.length
      || addObjects.length
      || !sameDiagram2Value(context.state.groupNames || {}, snapshot.groupNames || {})
      || !sameDiagram2Value(context.state.groupVisibility || {}, snapshot.groupVisibility || {})
    );
    if (structureStateRequired) {
      context.setStructureStateCanonical({
        groupNames: snapshot.groupNames,
        groupVisibility: snapshot.groupVisibility
      }, {
        affectedObjectIds: touchedObjectIds,
        reason: operationReason
      });
    }

    const renderer = context.renderer;
    renderer?.beginDiagramUpdate?.(operationReason);
    if (removeIds.length) renderer?.removeObjects?.(removeIds, { reason: operationReason });
    updateObjects.forEach(object => renderer?.updateObject?.(object.id, cloneDiagram2Value(object)));
    if (addObjects.length) {
      renderer?.addObjects?.(addObjects.map(cloneDiagram2Value), {
        reason: operationReason,
        indexesById: snapshot.indexesById
      });
    }
    if (structureStateRequired) {
      renderer?.setStructureState?.(context.state, {
        affectedObjectIds: touchedObjectIds,
        reason: operationReason
      });
    }
    renderer?.endDiagramUpdate?.(operationReason);
    context.setSelection(snapshot.selection, { expandGroups: false });
    return Boolean(removeIds.length || updateObjects.length || addObjects.length);
  };

  return {
    kind: "object-delta",
    label,
    reason,
    objectIds: touchedObjectIds,
    createdAt: Date.now(),
    apply(context) {
      return applySnapshot(context, after, reason);
    },
    undo(context) {
      return applySnapshot(context, before, `${reason} undo`);
    },
    redo(context) {
      return applySnapshot(context, after, `${reason} redo`);
    }
  };
}

export function createDiagram2TextCommand(options = {}) {
  const objectId = String(options.objectId || "").trim();
  const property = options.property === "html" ? "html" : "text";
  const value = property === "html"
    ? normalizeDiagram2RichTextHtml(options.value)
    : String(options.value ?? "");
  const reason = String(options.reason || "edit text").trim() || "edit text";
  const label = String(options.label || "Edit text").trim() || "Edit text";
  const createdAt = Date.now();
  let previousValue = "";

  const applyValue = (context, nextValue, operationReason, capturePrevious = false) => {
    const update = context.updateObjectCanonical(objectId, object => {
      if (!object || !["textbox", "rich-text"].includes(object.type)) return object;
      if (capturePrevious) previousValue = String(object[property] ?? "");
      return { [property]: nextValue };
    }, {
      reason: operationReason
    });
    if (update.changed !== true) return false;
    const renderer = context.renderer;
    renderer?.beginDiagramUpdate?.(operationReason);
    renderer?.updateObject?.(objectId, { [property]: nextValue });
    renderer?.endDiagramUpdate?.(operationReason);
    context.setSelection([objectId], { expandGroups: false });
    return true;
  };

  return {
    kind: "edit-text",
    label,
    objectId,
    property,
    reason,
    createdAt,
    apply(context) {
      return applyValue(context, value, reason, true);
    },
    undo(context) {
      return applyValue(context, previousValue, `${reason} undo`);
    },
    redo(context) {
      return applyValue(context, value, `${reason} redo`);
    }
  };
}

export function createDiagram2CanvasOptionCommand(options = {}) {
  const optionName = ["gridVisible", "snapToGrid"].includes(options.optionName)
    ? options.optionName
    : "";
  const value = options.value === true;
  let previousValue = false;
  return {
    kind: "canvas-option",
    label: options.label || "Change canvas option",
    optionName,
    value,
    async apply(context) {
      if (!optionName) return false;
      previousValue = context.state?.[optionName] === true;
      return context.setCanvasOptionCanonical?.(optionName, value) !== false;
    },
    async undo(context) {
      return context.setCanvasOptionCanonical?.(optionName, previousValue) !== false;
    },
    async redo(context) {
      return context.setCanvasOptionCanonical?.(optionName, value) !== false;
    }
  };
}

export function createDiagram2ArrangeObjectsCommand(options = {}) {
  const objectIds = uniqueStrings(options.objectIds);
  const previousOrder = uniqueStrings(options.previousOrder);
  const nextOrder = uniqueStrings(options.nextOrder);
  const reason = String(options.reason || "arrange objects").trim() || "arrange objects";
  const label = String(options.label || "Arrange objects").trim() || "Arrange objects";
  const createdAt = Date.now();

  const applyOrder = (context, order, operationReason) => {
    const update = context.setObjectOrderCanonical(order, { reason: operationReason });
    if (update.changed !== true) return false;
    const renderer = context.renderer;
    renderer?.beginDiagramUpdate?.(operationReason);
    renderer?.setObjectOrder?.(order, { reason: operationReason });
    context.setSelection(objectIds, { expandGroups: false });
    renderer?.endDiagramUpdate?.(operationReason);
    return true;
  };

  return {
    kind: "arrange-objects",
    label,
    objectIds,
    previousOrder,
    nextOrder,
    reason,
    createdAt,
    apply(context) {
      return applyOrder(context, nextOrder, reason);
    },
    undo(context) {
      return applyOrder(context, previousOrder, `${reason} undo`);
    },
    redo(context) {
      return applyOrder(context, nextOrder, `${reason} redo`);
    }
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

export function createDiagram2ResizeCommand(options = {}) {
  const objectsById = new Map((Array.isArray(options.objects) ? options.objects : [])
    .map(object => [String(object?.id || "").trim(), cloneDiagram2Value(object)])
    .filter(([id, object]) => id && object && typeof object === "object"));
  const objectIds = uniqueStrings(options.objectIds || [...objectsById.keys()])
    .filter(id => objectsById.has(id));
  const reason = String(options.reason || "resize objects").trim() || "resize objects";
  const label = String(options.label || "Resize objects").trim() || "Resize objects";
  const createdAt = Date.now();
  const rendererAlreadyUpdated = options.rendererAlreadyUpdated === true;
  const previousObjectsById = new Map();
  let appliedObjectIds = objectIds.slice();

  return {
    kind: "resize-objects",
    label,
    objectIds,
    reason,
    createdAt,
    apply(context) {
      previousObjectsById.clear();
      const update = context.updateObjectsCanonical(objectIds, (object, id) => {
        const next = objectsById.get(id);
        if (!next) return object;
        previousObjectsById.set(id, cloneDiagram2Value(object));
        return cloneDiagram2Value(next);
      }, {
        reason
      });
      if (update.changed !== true) return false;

      appliedObjectIds = update.affectedObjectIds.slice();
      const renderer = context.renderer;
      if (renderer && rendererAlreadyUpdated !== true) {
        renderer.beginDiagramUpdate(reason);
        appliedObjectIds.forEach(id => renderer.updateObject(id, cloneDiagram2Value(objectsById.get(id))));
        renderer.endDiagramUpdate(reason);
      }
      context.setSelection(appliedObjectIds, { expandGroups: false });
      return true;
    },
    undo(context) {
      if (!appliedObjectIds.length) return false;
      const update = context.updateObjectsCanonical(appliedObjectIds, (object, id) =>
        cloneDiagram2Value(previousObjectsById.get(id) || object), {
          reason: `${reason} undo`
        });
      if (update.changed !== true) return false;

      const renderer = context.renderer;
      renderer?.beginDiagramUpdate?.(`${reason} undo`);
      appliedObjectIds.forEach(id => renderer?.updateObject?.(id, cloneDiagram2Value(previousObjectsById.get(id))));
      renderer?.endDiagramUpdate?.(`${reason} undo`);
      context.setSelection(appliedObjectIds, { expandGroups: false });
      return true;
    },
    redo(context) {
      if (!appliedObjectIds.length) return false;
      const update = context.updateObjectsCanonical(appliedObjectIds, (object, id) =>
        cloneDiagram2Value(objectsById.get(id) || object), {
          reason: `${reason} redo`
        });
      if (update.changed !== true) return false;

      const renderer = context.renderer;
      renderer?.beginDiagramUpdate?.(`${reason} redo`);
      appliedObjectIds.forEach(id => renderer?.updateObject?.(id, cloneDiagram2Value(objectsById.get(id))));
      renderer?.endDiagramUpdate?.(`${reason} redo`);
      context.setSelection(appliedObjectIds, { expandGroups: false });
      return true;
    }
  };
}

export function createDiagram2StyleCommand(options = {}) {
  const objectIds = uniqueStrings(options.objectIds);
  const styleName = normalizeDiagram2StyleName(options.styleName);
  const value = normalizeDiagram2StyleValue(styleName, options.value);
  const reason = String(options.reason || "change object style").trim() || "change object style";
  const label = String(options.label || "Change object style").trim() || "Change object style";
  const createdAt = finiteNumber(options.createdAt, Date.now());
  const mergeKey = String(options.mergeKey || "");
  const mergeWindowMs = finiteNumber(options.mergeWindowMs, 0);
  const previousValuesById = options.previousValuesById instanceof Map
    ? new Map(options.previousValuesById)
    : new Map();
  const capturePreviousOnApply = options.capturePreviousOnApply !== false;
  let appliedObjectIds = objectIds.slice();

  return {
    kind: "style-objects",
    label,
    objectIds,
    styleName,
    value,
    reason,
    createdAt,
    mergeKey,
    mergeWindowMs,
    apply(context) {
      if (capturePreviousOnApply) previousValuesById.clear();
      return applyDiagram2Style(context, objectIds, styleName, id => value, {
        reason,
        capturePrevious: capturePreviousOnApply ? previousValuesById : null
      });
    },
    undo(context) {
      if (!appliedObjectIds.length) return false;
      return applyDiagram2Style(context, appliedObjectIds, styleName, id => previousValuesById.get(id), {
        reason: `${reason} undo`
      });
    },
    redo(context) {
      if (!appliedObjectIds.length) return false;
      return applyDiagram2Style(context, appliedObjectIds, styleName, id => value, {
        reason: `${reason} redo`
      });
    },
    mergeWith(next) {
      if (!next || next.kind !== "style-objects") return null;
      if (styleName !== next.styleName) return null;
      if (objectIds.join("|") !== uniqueStrings(next.objectIds).join("|")) return null;
      return createDiagram2StyleCommand({
        objectIds,
        styleName,
        value: next.value,
        label,
        reason,
        mergeKey,
        mergeWindowMs,
        createdAt: next.createdAt,
        previousValuesById,
        capturePreviousOnApply: false
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

export function resizeDiagram2ObjectsGeometry(objectsInput = [], directionInput, pointInput = {}, options = {}) {
  const objects = (Array.isArray(objectsInput) ? objectsInput : [objectsInput])
    .filter(object => object && typeof object === "object")
    .map(cloneDiagram2Value);
  if (!objects.length) return [];

  const direction = normalizeDiagram2ResizeHandle(directionInput);
  if (!direction) return objects;
  const point = {
    x: finiteNumber(pointInput?.x, 0),
    y: finiteNumber(pointInput?.y, 0)
  };

  if (["arrow-base", "arrow-tip"].includes(direction)) {
    const object = objects.length === 1 && ["arrow", "line"].includes(objects[0]?.type) ? objects[0] : null;
    if (!object) return objects;
    return [resizeDiagram2LineEndpoint(object, direction, point)];
  }

  const startBounds = normalizeDiagram2Bounds(options.startBounds) || diagram2SelectionResizeBounds(objects);
  const nextBounds = resizedDiagram2Bounds(startBounds, direction, point, options.centerAnchored === true);
  if (!startBounds || !nextBounds) return objects;
  const scaleX = nextBounds.width / Math.max(1, startBounds.width);
  const scaleY = nextBounds.height / Math.max(1, startBounds.height);
  const proportional = diagram2ResizeHandleIsCorner(direction);

  return objects.map(object => resizeDiagram2ObjectFromBounds(object, startBounds, nextBounds, scaleX, scaleY, proportional));
}

export function diagram2SelectionResizeBounds(objectsInput = []) {
  const objects = Array.isArray(objectsInput) ? objectsInput : [objectsInput];
  return objects.reduce((bounds, object) =>
    unionDiagram2Bounds(bounds, diagram2ObjectResizeBounds(object)), null);
}

function resizeDiagram2LineEndpoint(object, direction, point) {
  const next = cloneDiagram2Value(object);
  if (direction === "arrow-base") {
    next.x1 = point.x;
    next.y1 = point.y;
  } else {
    next.x2 = point.x;
    next.y2 = point.y;
  }
  return enforceDiagram2LineMinimum(next);
}

function resizeDiagram2ObjectFromBounds(object, startBounds, nextBounds, scaleX, scaleY, proportional) {
  const next = cloneDiagram2Value(object);
  if (["arrow", "line"].includes(next.type)) {
    next.x1 = nextBounds.x + ((finiteNumber(object.x1, 0) - startBounds.x) * scaleX);
    next.y1 = nextBounds.y + ((finiteNumber(object.y1, 0) - startBounds.y) * scaleY);
    next.x2 = nextBounds.x + ((finiteNumber(object.x2, 0) - startBounds.x) * scaleX);
    next.y2 = nextBounds.y + ((finiteNumber(object.y2, 0) - startBounds.y) * scaleY);
    if (proportional) scaleDiagram2LineStyle(next, Math.max(0.1, Math.min(Math.abs(scaleX), Math.abs(scaleY))));
    return enforceDiagram2LineMinimum(next);
  }

  next.x = nextBounds.x + ((finiteNumber(object.x, 0) - startBounds.x) * scaleX);
  next.y = nextBounds.y + ((finiteNumber(object.y, 0) - startBounds.y) * scaleY);
  next.width = Math.max(minimumDiagram2ObjectSize, positiveNumber(object.width, minimumDiagram2ObjectSize) * scaleX);
  next.height = Math.max(minimumDiagram2ObjectSize, positiveNumber(object.height, minimumDiagram2ObjectSize) * scaleY);
  if (next.type === "embedded-image" && object.imageClip && typeof object.imageClip === "object") {
    next.imageClip = scaleDiagram2Bounds(object.imageClip, startBounds, nextBounds, scaleX, scaleY);
  }
  if (proportional && ["textbox", "entity", "field-mapping-table"].includes(next.type)) {
    next.fontSize = clampNumber(positiveNumber(object.fontSize, 16) * Math.max(0.1, Math.min(Math.abs(scaleX), Math.abs(scaleY))), 1, 240);
  }
  if (next.type === "entity") {
    next.expandedHeight = next.collapsed === true
      ? Math.max(minimumDiagram2ObjectSize, positiveNumber(object.expandedHeight, object.height) * scaleY)
      : next.height;
    if (next.showDataTypes === true) next.dataTypeExpandedWidth = next.width;
  }
  return next;
}

function resizedDiagram2Bounds(start, direction, point, centerAnchored = false) {
  const width = positiveNumber(start?.width, minimumDiagram2ObjectSize);
  const height = positiveNumber(start?.height, minimumDiagram2ObjectSize);
  const left = finiteNumber(start?.x, 0);
  const top = finiteNumber(start?.y, 0);
  const right = left + width;
  const bottom = top + height;
  const centerX = left + (width / 2);
  const centerY = top + (height / 2);
  const horizontal = direction.includes("w") || direction.includes("e");
  const vertical = direction.includes("n") || direction.includes("s");
  if (!horizontal && !vertical) return { x: left, y: top, width, height };

  const requestedWidth = direction.includes("w")
    ? (centerAnchored ? (centerX - finiteNumber(point?.x, centerX)) * 2 : right - finiteNumber(point?.x, left))
    : direction.includes("e")
      ? (centerAnchored ? (finiteNumber(point?.x, centerX) - centerX) * 2 : finiteNumber(point?.x, right) - left)
      : width;
  const requestedHeight = direction.includes("n")
    ? (centerAnchored ? (centerY - finiteNumber(point?.y, centerY)) * 2 : bottom - finiteNumber(point?.y, top))
    : direction.includes("s")
      ? (centerAnchored ? (finiteNumber(point?.y, centerY) - centerY) * 2 : finiteNumber(point?.y, bottom) - top)
      : height;

  if (horizontal !== vertical) {
    const nextWidth = Math.max(minimumDiagram2ObjectSize, Math.max(0, requestedWidth));
    const nextHeight = Math.max(minimumDiagram2ObjectSize, Math.max(0, requestedHeight));
    return {
      x: centerAnchored ? centerX - (nextWidth / 2) : direction.includes("w") ? right - nextWidth : left,
      y: centerAnchored ? centerY - (nextHeight / 2) : direction.includes("n") ? bottom - nextHeight : top,
      width: nextWidth,
      height: nextHeight
    };
  }

  const scaleX = Math.max(0, requestedWidth) / width;
  const scaleY = Math.max(0, requestedHeight) / height;
  const minimumScale = Math.max(minimumDiagram2ObjectSize / width, minimumDiagram2ObjectSize / height);
  const scale = Math.max(minimumScale, Math.abs(scaleX - 1) >= Math.abs(scaleY - 1) ? scaleX : scaleY);
  const nextWidth = width * scale;
  const nextHeight = height * scale;
  return {
    x: centerAnchored ? centerX - (nextWidth / 2) : direction.includes("w") ? right - nextWidth : left,
    y: centerAnchored ? centerY - (nextHeight / 2) : direction.includes("n") ? bottom - nextHeight : top,
    width: nextWidth,
    height: nextHeight
  };
}

function normalizeDiagram2ResizeHandle(value) {
  const handle = String(value || "").trim().toLowerCase();
  return ["nw", "n", "ne", "e", "se", "s", "sw", "w", "arrow-base", "arrow-tip"].includes(handle) ? handle : "";
}

function diagram2ResizeHandleIsCorner(handle) {
  return ["nw", "ne", "se", "sw"].includes(String(handle || ""));
}

function diagram2ObjectResizeBounds(object) {
  if (!object) return null;
  if (object.type === "arrow" || object.type === "line") {
    const x1 = finiteNumber(object.x1, 0);
    const y1 = finiteNumber(object.y1, 0);
    const x2 = finiteNumber(object.x2, 0);
    const y2 = finiteNumber(object.y2, 0);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.max(1, Math.abs(x2 - x1)),
      height: Math.max(1, Math.abs(y2 - y1))
    };
  }
  if (object.type === "embedded-image") {
    const clip = diagram2ImageEffectiveClip(object);
    if (clip) return clip;
  }
  return {
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, minimumDiagram2ObjectSize),
    height: positiveNumber(object.height, minimumDiagram2ObjectSize)
  };
}

function normalizeDiagram2Bounds(bounds) {
  if (!bounds) return null;
  const x = finiteNumber(bounds.x, Number.NaN);
  const y = finiteNumber(bounds.y, Number.NaN);
  const width = positiveNumber(bounds.width, Number.NaN);
  const height = positiveNumber(bounds.height, Number.NaN);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function unionDiagram2Bounds(firstInput, secondInput) {
  const first = normalizeDiagram2Bounds(firstInput);
  const second = normalizeDiagram2Bounds(secondInput);
  if (!first) return second;
  if (!second) return first;
  const x1 = Math.min(first.x, second.x);
  const y1 = Math.min(first.y, second.y);
  const x2 = Math.max(first.x + first.width, second.x + second.width);
  const y2 = Math.max(first.y + first.height, second.y + second.height);
  return {
    x: x1,
    y: y1,
    width: Math.max(1, x2 - x1),
    height: Math.max(1, y2 - y1)
  };
}

function scaleDiagram2Bounds(bounds, startBounds, nextBounds, scaleX, scaleY) {
  return {
    x: nextBounds.x + ((finiteNumber(bounds.x, 0) - startBounds.x) * scaleX),
    y: nextBounds.y + ((finiteNumber(bounds.y, 0) - startBounds.y) * scaleY),
    width: Math.max(1, positiveNumber(bounds.width, 1) * scaleX),
    height: Math.max(1, positiveNumber(bounds.height, 1) * scaleY)
  };
}

function scaleDiagram2LineStyle(object, scale) {
  object.strokeWidth = clampNumber(positiveNumber(object.strokeWidth, 1) * scale, 1, 40);
  if (object.type === "arrow") object.arrowSize = clampNumber(positiveNumber(object.arrowSize, 24) * scale, 6, 160);
}

function enforceDiagram2LineMinimum(object) {
  const next = cloneDiagram2Value(object);
  const x1 = finiteNumber(next.x1, 0);
  const y1 = finiteNumber(next.y1, 0);
  const x2 = finiteNumber(next.x2, x1);
  const y2 = finiteNumber(next.y2, y1);
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length >= minimumDiagram2ObjectSize) return next;
  const angle = length > 0 ? Math.atan2(y2 - y1, x2 - x1) : 0;
  next.x2 = x1 + Math.cos(angle) * minimumDiagram2ObjectSize;
  next.y2 = y1 + Math.sin(angle) * minimumDiagram2ObjectSize;
  return next;
}

function diagram2LayerOrder(objectIdsInput, selectedIdsInput, actionInput) {
  const layers = uniqueStrings(objectIdsInput);
  const selectedIds = new Set(uniqueStrings(selectedIdsInput));
  const action = normalizeDiagram2LayerAction(actionInput);
  if (!action || !selectedIds.size) return layers;

  if (action === "front" || action === "back") {
    const moving = layers.filter(id => selectedIds.has(id));
    const remaining = layers.filter(id => !selectedIds.has(id));
    return action === "front"
      ? [...remaining, ...moving]
      : [...moving, ...remaining];
  }
  if (action === "forward") {
    for (let index = layers.length - 2; index >= 0; index -= 1) {
      if (selectedIds.has(layers[index]) && !selectedIds.has(layers[index + 1])) {
        [layers[index], layers[index + 1]] = [layers[index + 1], layers[index]];
      }
    }
  }
  if (action === "backward") {
    for (let index = 1; index < layers.length; index += 1) {
      if (selectedIds.has(layers[index]) && !selectedIds.has(layers[index - 1])) {
        [layers[index], layers[index - 1]] = [layers[index - 1], layers[index]];
      }
    }
  }
  return layers;
}

function normalizeDiagram2LayerAction(value) {
  const action = String(value || "").trim().toLowerCase();
  return ["front", "back", "forward", "backward"].includes(action) ? action : "";
}

function diagram2LayerActionLabel(action) {
  return {
    front: "Move objects to front",
    back: "Move objects to back",
    forward: "Move objects forward",
    backward: "Move objects backward"
  }[action] || "Arrange objects";
}

async function applyDiagram2Move(context, objectIds, deltaX, deltaY, options = {}) {
  const update = context.updateObjectsCanonical(objectIds, object =>
    moveDiagram2ObjectGeometry(object, deltaX, deltaY), {
      reason: options.reason || "move objects"
    });
  if (update.changed !== true) return false;

  const changedFieldRectangleIds = objectIds.filter(id =>
    isDiagram2FieldRectangle(context.getObjectById(id)));
  const tableUpdates = changedFieldRectangleIds.length
    ? planDiagram2FieldMappingTableSync(
        context.state.objects,
        changedFieldRectangleIds,
        [...(update.previousObjectsById?.values?.() || [])]
      )
    : [];
  if (tableUpdates.length) {
    const updatesById = new Map(tableUpdates.map(table => [table.id, table]));
    context.updateObjectsCanonical([...updatesById.keys()], (_object, id) => updatesById.get(id), {
      reason: options.reason || "move objects"
    });
  }

  const renderer = context.renderer;
  if (renderer && (options.rendererAlreadyUpdated !== true || tableUpdates.length)) {
    renderer.beginDiagramUpdate(options.reason || "move objects");
    if (options.rendererAlreadyUpdated !== true) {
      objectIds.forEach(id => {
        renderer.updateObject(id, object => moveDiagram2ObjectGeometry(object, deltaX, deltaY));
      });
    }
    tableUpdates.forEach(table => renderer.updateObject(table.id, table));
    renderer.endDiagramUpdate(options.reason || "move objects");
  }

  context.setSelection(objectIds, { expandGroups: false });
  return true;
}

function applyDiagram2Style(context, objectIds, styleName, valueProvider, options = {}) {
  const reason = options.reason || "change object style";
  const update = context.updateObjectsCanonical(objectIds, (object, id) => {
    if (!diagram2ObjectSupportsStyle(object, styleName)) return object;
    const value = typeof valueProvider === "function" ? valueProvider(id) : valueProvider;
    const normalized = normalizeDiagram2StyleValue(styleName, value);
    if (normalized === undefined) return object;
    options.capturePrevious?.set?.(id, diagram2StylePreviousValue(object, styleName));
    return { [styleName]: normalized };
  }, {
    reason
  });
  if (update.changed !== true) return false;

  const affectedObjectIds = update.affectedObjectIds || objectIds;
  const renderer = context.renderer;
  if (renderer) {
    renderer.beginDiagramUpdate(reason);
    affectedObjectIds.forEach(id => {
      const value = typeof valueProvider === "function" ? valueProvider(id) : valueProvider;
      renderer.updateObject(id, { [styleName]: normalizeDiagram2StyleValue(styleName, value) });
    });
    renderer.endDiagramUpdate(reason);
  }
  context.setSelection(affectedObjectIds, { expandGroups: false });
  return true;
}

function sameDiagram2RelationshipRoute(firstInput, secondInput) {
  const first = compactDiagram2RelationshipPoints(firstInput);
  const second = compactDiagram2RelationshipPoints(secondInput);
  return first.length === second.length
    && first.every((point, index) =>
      point.x === second[index]?.x && point.y === second[index]?.y);
}

function mergeDiagram2RelationshipRouteRendererDiagnostics(resultsInput = []) {
  const results = (Array.isArray(resultsInput) ? resultsInput : []).filter(Boolean);
  if (!results.length) return {};
  const first = results[0];
  const last = results.at(-1);
  return {
    ...last,
    rendererFlushScheduledAt: finiteNumber(first.rendererFlushScheduledAt, 0),
    rendererFlushCompletedAt: finiteNumber(last.rendererFlushCompletedAt, 0),
    realRelationshipPathPatchedAt: finiteNumber(last.realRelationshipPathPatchedAt, 0),
    routeHandlesPatchedAt: finiteNumber(last.routeHandlesPatchedAt, 0),
    routeCommitRendererScheduleMs: results.reduce((total, result) =>
      total + finiteNumber(result.routeCommitRendererScheduleMs, 0), 0),
    routeCommitRendererFlushMs: results.reduce((total, result) =>
      total + finiteNumber(result.routeCommitRendererFlushMs, 0), 0),
    routeCommitRelationshipsConsidered: results.reduce((total, result) =>
      total + finiteNumber(result.routeCommitRelationshipsConsidered, 0), 0),
    routeCommitRelationshipsRerouted: results.reduce((total, result) =>
      total + finiteNumber(result.routeCommitRelationshipsRerouted, 0), 0),
    routeCommitFullRenderDelta: results.reduce((total, result) =>
      total + finiteNumber(result.routeCommitFullRenderDelta, 0), 0),
    routeCommitDirtyFlushDelta: results.reduce((total, result) =>
      total + finiteNumber(result.routeCommitDirtyFlushDelta, 0), 0)
  };
}

function diagram2RelationshipStructureChanged(previousObject, nextObject) {
  if (previousObject?.type !== nextObject?.type) return true;
  if (nextObject?.type !== "entity") return false;
  return previousObject.entitySchema !== nextObject.entitySchema
    || previousObject.entityName !== nextObject.entityName
    || previousObject.visible !== nextObject.visible
    || previousObject.showSelfRelationships !== nextObject.showSelfRelationships
    || previousObject.fields !== nextObject.fields
    || previousObject.foreignKeys !== nextObject.foreignKeys;
}

function addToDiagram2SetMap(map, keyInput, valueInput) {
  const key = String(keyInput || "").trim();
  const value = String(valueInput || "").trim();
  if (!key || !value) return;
  const values = map.get(key) || new Set();
  values.add(value);
  map.set(key, values);
}

function findDiagram2FieldByName(entity, nameInput) {
  const name = String(nameInput || "").trim().toLowerCase();
  return (Array.isArray(entity?.fields) ? entity.fields : [])
    .find(field => String(field?.name || "").trim().toLowerCase() === name)
    || null;
}

function buildDiagram2ObjectDeltaPlan(
  stateInput,
  planInput = {},
  objectIndexes = new Map(),
  indexedObjectsById = null
) {
  const state = stateInput && typeof stateInput === "object" ? stateInput : {};
  const currentObjects = Array.isArray(state.objects) ? state.objects : [];
  const currentById = indexedObjectsById instanceof Map
    ? indexedObjectsById
    : new Map(currentObjects.map(object => [object.id, object]));
  const requestedBefore = new Map(uniqueDiagram2Objects(planInput.beforeObjects)
    .map(object => [object.id, object]));
  const requestedAfter = new Map(uniqueDiagram2Objects(planInput.afterObjects)
    .map(object => [object.id, object]));
  uniqueStrings(planInput.removedObjectIds).forEach(id => requestedAfter.delete(id));
  const touchedObjectIds = uniqueStrings([
    ...requestedBefore.keys(),
    ...requestedAfter.keys(),
    ...uniqueStrings(planInput.removedObjectIds)
  ]);
  touchedObjectIds.forEach(id => {
    if (!requestedBefore.has(id) && currentById.has(id)) {
      requestedBefore.set(id, cloneDiagram2Value(currentById.get(id)));
    }
  });

  const changedObjects = touchedObjectIds.some(id =>
    !sameDiagram2Value(requestedBefore.get(id) || null, requestedAfter.get(id) || null));
  const beforeGroupNames = cloneDiagram2Value(state.groupNames || {});
  const beforeGroupVisibility = cloneDiagram2Value(state.groupVisibility || {});
  const afterGroupNames = applyDiagram2ScopedRecord(
    beforeGroupNames,
    planInput.beforeGroupNames,
    planInput.afterGroupNames,
    false
  );
  const afterGroupVisibility = applyDiagram2ScopedRecord(
    beforeGroupVisibility,
    planInput.beforeGroupVisibility,
    planInput.afterGroupVisibility,
    true
  );
  const changedGroups = !sameDiagram2Value(beforeGroupNames, afterGroupNames)
    || !sameDiagram2Value(beforeGroupVisibility, afterGroupVisibility);
  if (!changedObjects && !changedGroups) return null;

  const beforeIndexesById = new Map();
  requestedBefore.forEach((_object, id) => {
    if (objectIndexes.has(id)) beforeIndexesById.set(id, objectIndexes.get(id));
  });
  const afterIndexesById = new Map();
  let nextAppendIndex = currentObjects.length;
  requestedAfter.forEach((_object, id) => {
    afterIndexesById.set(id, objectIndexes.has(id) ? objectIndexes.get(id) : nextAppendIndex++);
  });

  return {
    touchedObjectIds,
    before: {
      objects: [...requestedBefore.values()],
      indexesById: beforeIndexesById,
      groupNames: beforeGroupNames,
      groupVisibility: beforeGroupVisibility,
      selection: uniqueStrings(planInput.selectionBefore)
    },
    after: {
      objects: [...requestedAfter.values()],
      indexesById: afterIndexesById,
      groupNames: afterGroupNames,
      groupVisibility: afterGroupVisibility,
      selection: uniqueStrings(planInput.selectionAfter)
    }
  };
}

function normalizeDiagram2DeltaSnapshot(input = {}, touchedObjectIds = []) {
  const indexesById = input.indexesById instanceof Map
    ? new Map(input.indexesById)
    : new Map(Object.entries(input.indexesById || {}).map(([id, index]) => [id, finiteNumber(index, 0)]));
  return {
    objects: uniqueDiagram2Objects(input.objects)
      .filter(object => touchedObjectIds.includes(object.id)),
    indexesById,
    groupNames: cloneDiagram2Value(input.groupNames || {}),
    groupVisibility: cloneDiagram2Value(input.groupVisibility || {}),
    selection: uniqueStrings(input.selection)
  };
}

function applyDiagram2ScopedRecord(currentInput, beforeScopeInput, afterScopeInput, booleanValues) {
  const current = { ...(currentInput || {}) };
  const beforeScope = beforeScopeInput && typeof beforeScopeInput === "object" ? beforeScopeInput : {};
  const afterScope = afterScopeInput && typeof afterScopeInput === "object" ? afterScopeInput : {};
  const touchedKeys = uniqueStrings([...Object.keys(beforeScope), ...Object.keys(afterScope)]);
  touchedKeys.forEach(key => delete current[key]);
  Object.entries(afterScope).forEach(([key, value]) => {
    current[key] = booleanValues ? value !== false : String(value || "");
  });
  return current;
}

function sameDiagram2Value(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
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

function normalizeDiagram2StyleName(value) {
  const name = String(value || "").trim();
  return diagram2StyleTargets.has(name) ? name : "";
}

function diagram2ObjectSupportsStyle(object, styleName) {
  const type = diagram2ObjectStyleType(object);
  const targets = diagram2StyleTargets.get(styleName);
  return Boolean(object && styleName && (targets?.has(type) || hasOwn(object, styleName)));
}

function diagram2RelationshipSupportsStyle(styleName) {
  return ["stroke", "strokeWidth", "arrowSize", "opacity", "showSymbols"].includes(styleName);
}

function diagram2ObjectStyleType(object) {
  if (object?.type === "entity" && object.entityKind === "field-rectangle") return "field-rectangle";
  return String(object?.type || "").trim().toLowerCase();
}

function diagram2MappedFieldRectangleName(value) {
  return String(value || "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/^"|"$/g, "")
    .slice(0, 240);
}

function normalizeDiagram2StyleValue(styleName, value) {
  if (!styleName) return undefined;
  if (styleName === "showSymbols") return value === true || String(value).trim().toLowerCase() === "true";
  if (diagram2ColorStyleNames.has(styleName)) {
    if (styleName === "fill" && String(value || "").trim().toLowerCase() === "none") return "none";
    return normalizeDiagram2Color(value) || undefined;
  }
  if (["fontSize", "strokeWidth", "arrowSize", "fieldMappingHighlightStrokeWidth"].includes(styleName)) {
    const limits = styleName === "fontSize"
      ? [1, 240]
      : styleName === "arrowSize"
        ? [6, 160]
        : [1, 40];
    return clampNumber(positiveNumber(value, diagram2DefaultStyleValue(styleName)), limits[0], limits[1]);
  }
  if (styleName === "opacity") {
    const raw = finiteNumber(value, defaultDiagram2DrawingStyles.opacity);
    const opacity = raw > 1 ? raw / 100 : raw;
    return clampNumber(opacity, 0, 1);
  }
  if (styleName === "outlineVisible") {
    if (typeof value === "boolean") return value;
    const text = String(value || "").trim().toLowerCase();
    return ["true", "1", "yes", "on"].includes(text);
  }
  if (styleName === "textAlign") {
    const align = String(value || "").trim().toLowerCase();
    return ["left", "center", "right"].includes(align) ? align : defaultDiagram2DrawingStyles.textAlign;
  }
  if (styleName === "textVerticalAlign") {
    const align = String(value || "").trim().toLowerCase();
    return ["top", "middle", "bottom"].includes(align) ? align : defaultDiagram2DrawingStyles.textVerticalAlign;
  }
  if (styleName === "fontFamily") {
    const font = String(value || "").trim();
    return font || defaultDiagram2DrawingStyles.fontFamily;
  }
  return undefined;
}

function diagram2StylePreviousValue(object, styleName) {
  if (hasOwn(object, styleName)) {
    const value = normalizeDiagram2StyleValue(styleName, object?.[styleName]);
    if (value !== undefined) return value;
  }
  return diagram2DefaultStyleValue(styleName, object);
}

function diagram2DefaultStyleValue(styleName, object = null) {
  if (styleName === "fill" && ["rectangle", "circle"].includes(diagram2ObjectStyleType(object))) return "none";
  if (hasOwn(defaultDiagram2FieldMappingStyles, styleName)) return defaultDiagram2FieldMappingStyles[styleName];
  if (hasOwn(defaultDiagram2DrawingStyles, styleName)) return defaultDiagram2DrawingStyles[styleName];
  if (styleName === "entityNameTextColor") return "#172b4d";
  if (styleName === "entityHeaderFill") return "#ffffff";
  if (styleName === "outlineVisible") return true;
  return "";
}

function normalizeDiagram2Color(value) {
  const text = String(value || "").trim();
  const hex = text.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3
      ? hex[1].split("").map(part => part + part).join("")
      : hex[1];
    return `#${digits.toUpperCase()}`;
  }
  const rgb = text.match(/^(?:rgb\s*\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i);
  if (!rgb) return "";
  const channels = rgb.slice(1).map(Number);
  if (channels.some(channel => channel < 0 || channel > 255)) return "";
  return `#${channels.map(channel => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function positiveNumber(value, fallback = 0) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function cloneDiagram2Value(value) {
  if (value == null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function diagram2Now() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function diagram2ObjectId(prefix) {
  return `${String(prefix || "object").trim() || "object"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueDiagram2Objects(objectsInput = []) {
  const objects = Array.isArray(objectsInput) ? objectsInput : [objectsInput];
  const seen = new Set();
  return objects
    .filter(object => object && typeof object === "object")
    .map(object => cloneDiagram2Value(object))
    .filter(object => {
      object.id = String(object.id || "").trim();
      if (!object.id || seen.has(object.id)) return false;
      seen.add(object.id);
      return true;
    });
}

function sameDiagram2IdList(leftInput = [], rightInput = []) {
  const left = Array.isArray(leftInput) ? leftInput : [];
  const right = Array.isArray(rightInput) ? rightInput : [];
  if (left.length !== right.length) return false;
  return left.every((id, index) => String(id || "") === String(right[index] || ""));
}

function assignUniqueDiagram2ObjectNames(objects, existingObjects) {
  const used = new Set((Array.isArray(existingObjects) ? existingObjects : [])
    .map(object => String(object?.name || "").trim())
    .filter(Boolean));
  objects.forEach(object => {
    const name = String(object?.name || "").trim();
    if (!name) return;
    let candidate = `${name} Copy`;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${name} Copy ${suffix++}`;
    object.name = candidate;
    used.add(candidate);
  });
}

function nextDiagram2DrawingObjectName(typeInput, existingObjects) {
  const baseName = {
    rectangle: "Rectangle",
    circle: "Circle",
    arrow: "Arrow",
    line: "Line",
    textbox: "Text Box",
    "rich-text": "Rich Text",
    entity: "Entity"
  }[String(typeInput || "").trim().toLowerCase()] || "Object";
  const escapedBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedBaseName}\\s+(\\d+)$`, "i");
  const highestNumber = (Array.isArray(existingObjects) ? existingObjects : [])
    .reduce((highest, object) => {
      const match = pattern.exec(String(object?.name || "").trim());
      return match ? Math.max(highest, Number(match[1]) || 0) : highest;
    }, 0);
  return `${baseName} ${highestNumber + 1}`;
}

function normalizeDiagram2RichTextHtml(value) {
  const source = String(value || "").trim() || "<p><br></p>";
  if (typeof document !== "undefined") {
    try {
      return normalizeRichHtml(source) || "<p><br></p>";
    } catch {
      // Use the bounded fallback below when DOM normalization is unavailable.
    }
  }
  return source
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "")
    .slice(0, 200000) || "<p><br></p>";
}

function patchDiagram2RendererObjectAdd(renderer, objects, reason, indexesById = null, options = {}) {
  if (!renderer) return;
  renderer.beginDiagramUpdate?.(reason);
  if (typeof renderer.addObjects === "function") {
    renderer.addObjects(objects, {
      reason,
      indexesById,
      groupNames: options.groupNames,
      groupVisibility: options.groupVisibility
    });
  } else {
    objects.forEach(object => renderer.addObject?.(object));
  }
  renderer.setStructureState?.(options.state, {
    affectedObjectIds: objects.map(object => object.id),
    reason
  });
  renderer.endDiagramUpdate?.(reason);
}

function patchDiagram2RendererObjectRemove(renderer, objectIds, reason, options = {}) {
  if (!renderer) return;
  renderer.beginDiagramUpdate?.(reason);
  if (typeof renderer.removeObjects === "function") {
    renderer.removeObjects(objectIds, { reason });
  } else {
    objectIds.forEach(id => renderer.removeObject?.(id));
  }
  renderer.setStructureState?.(options.state, {
    affectedObjectIds: options.affectedObjectIds || objectIds,
    reason
  });
  renderer.endDiagramUpdate?.(reason);
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

function plainDiagram2Record(input) {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(Object.entries(input)
    .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
    .filter(([key, value]) => key && value));
}

function plainDiagram2BooleanRecord(input) {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(Object.entries(input)
    .map(([key, value]) => [String(key || "").trim(), value !== false])
    .filter(([key]) => key));
}
