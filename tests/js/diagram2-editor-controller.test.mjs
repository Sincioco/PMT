import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import {
  createDiagram2DefaultObject,
  createDiagram2EditorController,
  resizeDiagram2ObjectsGeometry
} from "../../wwwroot/js/features/diagram2/diagram2-editor-controller.js";
import {
  parseDiagram2EntityDefinition
} from "../../wwwroot/js/features/diagram2/diagram2-editor-entities.js";
import { runDiagram2CompactEngine } from "../../wwwroot/js/features/diagram2/diagram2-compact-engine.js";
import {
  diagram2ObjectTreeNodes
} from "../../wwwroot/js/features/diagram2/diagram2-editor-structure.js";
import {
  compareDiagram2RouteScores,
  scoreDiagram2RoutePoints
} from "../../wwwroot/js/features/diagram2/diagram2-route-costing.js";
import {
  captureDiagram2SelectionTemplate
} from "../../wwwroot/js/features/diagram2/diagram2-editor-templates.js";
import {
  normalizeDiagram2RteSaveState
} from "../../wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js";

const sampleImageDataUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNTAiIGZpbGw9IiNmZmYiLz48L3N2Zz4=";

test("Diagram 2 editor controller records incremental move commands without full renders", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: simpleState()
  });

  controller.setSelection(["box"]);
  assert.equal(await controller.moveSelectedObjects(10, -4), true);
  assert.equal(controller.getObjectById("box").x, 130);
  assert.equal(controller.getObjectById("box").y, 92);
  assert.equal(renderer.fullRenderCount, 0);
  assert.deepEqual(renderer.updatedObjectIds, ["box"]);
  assert.equal(controller.historyStatus().dirty, true);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("box").x, 120);
  assert.equal(controller.historyStatus().dirty, false);

  assert.equal(await controller.redo(), true);
  assert.equal(controller.getObjectById("box").x, 130);
  assert.equal(controller.historyStatus().dirty, true);
});

test("Diagram 2 editor controller applies color styles through command history without full renders", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: styleState()
  });

  controller.setSelection(["box"]);
  assert.equal(await controller.updateSelectedObjectsStyle("fill", "#abc"), true);
  assert.equal(controller.getObjectById("box").fill, "#AABBCC");
  assert.equal(renderer.fullRenderCount, 0);
  assert.deepEqual(renderer.updatedObjectIds, ["box"]);
  assert.equal(controller.historyStatus().dirty, true);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("box").fill, "#FFFFFF");
  assert.equal(controller.historyStatus().dirty, false);

  assert.equal(await controller.redo(), true);
  assert.equal(controller.getObjectById("box").fill, "#AABBCC");
  assert.deepEqual(renderer.updatedObjectIds, ["box", "box", "box"]);
  assert.equal(controller.historyStatus().dirty, true);

  assert.equal(await controller.updateSelectedObjectsStyle("headerFill", "#123456"), false);
});

test("Diagram 2 editor controller applies Diagram 1 format styles by object type", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: formatState()
  });

  controller.setSelection(["box"]);
  assert.equal(await controller.updateSelectedObjectsStyle("strokeWidth", "7"), true);
  assert.equal(controller.getObjectById("box").strokeWidth, 7);
  assert.equal(await controller.updateSelectedObjectsStyle("opacity", "45"), true);
  assert.equal(controller.getObjectById("box").opacity, 0.45);
  assert.equal(await controller.updateSelectedObjectsStyle("outlineVisible", false), true);
  assert.equal(controller.getObjectById("box").outlineVisible, false);
  assert.equal(await controller.updateSelectedObjectsStyle("fill", "none"), true);
  assert.equal(controller.getObjectById("box").fill, "none");

  controller.setSelection(["arrow"]);
  assert.equal(await controller.updateSelectedObjectsStyle("arrowSize", "44"), true);
  assert.equal(controller.getObjectById("arrow").arrowSize, 44);
  assert.equal(await controller.updateSelectedObjectsStyle("textAlign", "right"), false);

  controller.setSelection(["text"]);
  assert.equal(await controller.updateSelectedObjectsStyle("fontFamily", "Georgia"), true);
  assert.equal(controller.getObjectById("text").fontFamily, "Georgia");
  assert.equal(await controller.updateSelectedObjectsStyle("fontSize", "32"), true);
  assert.equal(controller.getObjectById("text").fontSize, 32);
  assert.equal(await controller.updateSelectedObjectsStyle("textAlign", "center"), true);
  assert.equal(controller.getObjectById("text").textAlign, "center");
  assert.equal(await controller.updateSelectedObjectsStyle("textVerticalAlign", "bottom"), true);
  assert.equal(controller.getObjectById("text").textVerticalAlign, "bottom");

  controller.setSelection(["mapping"]);
  assert.equal(await controller.updateSelectedObjectsStyle("headerFill", "#123456"), true);
  assert.equal(controller.getObjectById("mapping").headerFill, "#123456");
  assert.equal(await controller.updateSelectedObjectsStyle("fieldMappingRowHoverFill", "#ffe08a"), true);
  assert.equal(controller.getObjectById("mapping").fieldMappingRowHoverFill, "#FFE08A");
  assert.equal(await controller.updateSelectedObjectsStyle("fieldMappingHighlightColor", "#facc15"), true);
  assert.equal(controller.getObjectById("mapping").fieldMappingHighlightColor, "#FACC15");
  assert.equal(await controller.updateSelectedObjectsStyle("fieldMappingHighlightStrokeWidth", "12"), true);
  assert.equal(controller.getObjectById("mapping").fieldMappingHighlightStrokeWidth, 12);

  controller.setSelection(["mapping", "text"]);
  assert.equal(await controller.updateSelectedObjectsStyle("fontSize", "18"), true);
  assert.equal(controller.getObjectById("mapping").fontSize, 18);
  assert.equal(controller.getObjectById("text").fontSize, 18);
  assert.equal(renderer.fullRenderCount, 0);
});

test("Diagram 2 editor controller resizes object geometry with undoable incremental commands", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: formatState()
  });
  const box = controller.getObjectById("box");
  const resizedBox = resizeDiagram2ObjectsGeometry([box], "e", { x: box.x + box.width + 40, y: box.y + 20 })[0];

  controller.setSelection(["box"]);
  assert.equal(await controller.resizeObjects([resizedBox]), true);
  assert.equal(controller.getObjectById("box").width, 200);
  assert.equal(controller.getObjectById("box").height, 100);
  assert.equal(renderer.fullRenderCount, 0);
  assert.deepEqual(renderer.updatedObjectIds, ["box"]);
  assert.equal(controller.historyStatus().dirty, true);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("box").width, 160);
  assert.equal(controller.historyStatus().dirty, false);

  assert.equal(await controller.redo(), true);
  assert.equal(controller.getObjectById("box").width, 200);
  assert.equal(controller.historyStatus().dirty, true);

  const arrow = controller.getObjectById("arrow");
  const resizedArrow = resizeDiagram2ObjectsGeometry([arrow], "arrow-tip", { x: 390, y: 210 })[0];
  assert.equal(await controller.resizeObjects([resizedArrow]), true);
  assert.equal(controller.getObjectById("arrow").x2, 390);
  assert.equal(controller.getObjectById("arrow").y2, 210);
});

test("Diagram 2 default drawing objects match Diagram 1 toolbar insertion geometry", () => {
  assert.deepEqual(createDiagram2DefaultObject("rectangle", { x: 320, y: 180 }, { id: "new-rectangle" }), {
    id: "new-rectangle",
    type: "rectangle",
    locked: false,
    groupId: "",
    x: 200,
    y: 110,
    width: 240,
    height: 140,
    fill: "none",
    stroke: "#3f7f0d",
    outlineVisible: true,
    strokeWidth: 4,
    opacity: 1,
    text: "",
    textColor: "#ffffff",
    fontFamily: "Arial",
    fontSize: 28,
    textAlign: "left",
    textVerticalAlign: "top"
  });
  assert.deepEqual(createDiagram2DefaultObject("circle", { x: 320, y: 180 }, { id: "new-circle" }), {
    id: "new-circle",
    type: "circle",
    locked: false,
    groupId: "",
    x: 230,
    y: 90,
    width: 180,
    height: 180,
    fill: "none",
    stroke: "#3f7f0d",
    outlineVisible: true,
    strokeWidth: 4,
    opacity: 1,
    text: "",
    textColor: "#ffffff",
    fontFamily: "Arial",
    fontSize: 28,
    textAlign: "left",
    textVerticalAlign: "top"
  });
  assert.deepEqual(createDiagram2DefaultObject("arrow", { x: 320, y: 180 }, { id: "new-arrow" }), {
    id: "new-arrow",
    type: "arrow",
    locked: false,
    groupId: "",
    x1: 230,
    y1: 90,
    x2: 410,
    y2: 270,
    stroke: "#3f7f0d",
    strokeWidth: 4,
    opacity: 1,
    arrowSize: 24
  });
  assert.deepEqual(createDiagram2DefaultObject("line", { x: 320, y: 180 }, { id: "new-line" }), {
    id: "new-line",
    type: "line",
    locked: false,
    groupId: "",
    x1: 230,
    y1: 90,
    x2: 410,
    y2: 270,
    stroke: "#3f7f0d",
    strokeWidth: 4,
    opacity: 1
  });
  assert.deepEqual(createDiagram2DefaultObject("textbox", { x: 320, y: 180 }, { id: "new-textbox" }), {
    id: "new-textbox",
    type: "textbox",
    locked: false,
    groupId: "",
    x: 160,
    y: 110,
    width: 320,
    height: 140,
    fill: "#5aa315",
    stroke: "#3f7f0d",
    outlineVisible: true,
    strokeWidth: 4,
    opacity: 1,
    text: "Text",
    textColor: "#ffffff",
    fontFamily: "Arial",
    fontSize: 28,
    textAlign: "left",
    textVerticalAlign: "top"
  });
});

test("Diagram 2 editor controller adds one object through command history without full renders", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: simpleState()
  });
  const object = createDiagram2DefaultObject("rectangle", { x: 320, y: 180 }, { id: "new-box" });

  controller.setSelection(["box"]);
  assert.equal(await controller.addObject(object, { reason: "test add object" }), true);
  assert.equal(controller.currentState().objects.length, 2);
  assert.equal(controller.getObjectById("new-box").x, 200);
  assert.equal(controller.getObjectById("new-box").name, "Rectangle 1");
  assert.deepEqual(controller.selectedObjectIds(), ["new-box"]);
  assert.deepEqual(renderer.addedObjectIds, ["new-box"]);
  assert.deepEqual(renderer.selectedIds, ["new-box"]);
  assert.equal(renderer.fullRenderCount, 0);
  assert.equal(controller.historyStatus().dirty, true);
  assertIndexedAddDiagnostics(controller, "new-box");

  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("new-box"), null);
  assert.deepEqual(controller.selectedObjectIds(), ["box"]);
  assert.deepEqual(renderer.removedObjectIds, ["new-box"]);
  assert.equal(controller.historyStatus().dirty, false);

  assert.equal(await controller.redo(), true);
  assert.equal(controller.getObjectById("new-box").width, 240);
  assert.deepEqual(controller.selectedObjectIds(), ["new-box"]);
  assert.deepEqual(renderer.addedObjectIds, ["new-box", "new-box"]);
  assert.equal(renderer.fullRenderCount, 0);
  assert.equal(controller.historyStatus().dirty, true);
});

test("Diagram 2 enumerates new drawing object names for the Objects tab", async () => {
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    host: editableHost(),
    state: simpleState()
  });
  const add = async (type, id, name = "") => {
    const object = createDiagram2DefaultObject(type, { x: 320, y: 180 }, { id });
    if (name) object.name = name;
    assert.equal(await controller.addObject(object), true);
    return controller.getObjectById(id).name;
  };

  assert.equal(await add("rectangle", "rectangle-1"), "Rectangle 1");
  assert.equal(await add("rectangle", "rectangle-2"), "Rectangle 2");
  assert.equal(await add("circle", "circle-1"), "Circle 1");
  assert.equal(await add("arrow", "arrow-1"), "Arrow 1");
  assert.equal(await add("line", "line-1"), "Line 1");
  assert.equal(await add("textbox", "textbox-1"), "Text Box 1");
  assert.equal(await add("rich-text", "rich-text-1"), "Rich Text 1");
  assert.equal(await add("circle", "named-circle", "Architecture Hub"), "Architecture Hub");
});

test("Diagram 2 editor controller batches duplicate, paste, and delete into one undo entry each", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: formatState()
  });

  controller.setSelection(["box", "text"]);
  assert.equal(await controller.duplicateSelectedObjects(), true);
  const duplicatedIds = controller.selectedObjectIds();
  assert.equal(duplicatedIds.length, 2);
  assert.equal(controller.currentState().objects.length, 6);
  assert.equal(renderer.addedObjectBatches.length, 1);
  assert.deepEqual(renderer.addedObjectBatches[0].sort(), duplicatedIds.slice().sort());
  assert.equal(controller.historyStatus().entryCount, 1);

  assert.equal(await controller.deleteSelectedObjects(), true);
  assert.equal(controller.currentState().objects.length, 4);
  assert.equal(renderer.removedObjectBatches.length, 1);
  assert.equal(controller.historyStatus().entryCount, 2);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.currentState().objects.length, 6);
  assert.deepEqual(controller.selectedObjectIds().sort(), duplicatedIds.slice().sort());

  const clipboardText = controller.selectionClipboardText();
  assert.equal(await controller.pasteSelectionClipboardText(clipboardText), true);
  assert.equal(controller.currentState().objects.length, 8);
  assert.equal(controller.selectedObjectIds().length, 2);
  assert.equal(controller.historyStatus().entryCount, 2);
  assert.equal(renderer.fullRenderCount, 0);
});

test("Diagram 2 text commands and Format Painter are undoable and stay renderer-local", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: {
      version: 1,
      width: 640,
      height: 360,
      objects: [
        { id: "source", type: "rectangle", x: 20, y: 20, width: 100, height: 80, fill: "#123456", stroke: "#654321", strokeWidth: 7 },
        { id: "target", type: "rectangle", x: 180, y: 20, width: 100, height: 80, fill: "#ffffff", stroke: "#000000", strokeWidth: 1 },
        { id: "text", type: "textbox", x: 20, y: 140, width: 180, height: 80, text: "Before" },
        { id: "rich", type: "rich-text", x: 240, y: 140, width: 240, height: 120, html: "<p>Before</p>" }
      ]
    }
  });

  assert.equal(await controller.updateObjectText("text", "After"), true);
  assert.equal(controller.getObjectById("text").text, "After");
  assert.equal(await controller.updateObjectText("rich", "<p><strong>After</strong></p><script>bad()</script>"), true);
  assert.equal(controller.getObjectById("rich").html.includes("<script"), false);

  controller.setSelection(["source"]);
  assert.equal(controller.beginFormatPainter(), true);
  assert.equal(controller.activeTool(), "format-painter");
  assert.equal(await controller.applyFormatPainter(["target"]), true);
  assert.equal(controller.getObjectById("target").fill, "#123456");
  assert.equal(controller.getObjectById("target").stroke, "#654321");
  assert.equal(controller.getObjectById("target").strokeWidth, 7);
  assert.equal(controller.activeTool(), "format-painter");
  assert.equal(controller.cancelFormatPainter(), true);
  assert.equal(controller.activeTool(), "select");
  assert.equal(renderer.fullRenderCount, 0);
});

test("Diagram 2 Grid and Snap settings persist in state, snap geometry, and undo", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: simpleState()
  });

  assert.equal(await controller.setGridVisible(true), true);
  assert.equal(await controller.setSnapToGrid(true), true);
  assert.equal(controller.currentState().gridVisible, true);
  assert.equal(controller.currentState().snapToGrid, true);
  assert.deepEqual(controller.snapPoint({ x: 29, y: 31 }), { x: 20, y: 40 });
  assert.deepEqual(controller.snapMovement(["box"], 13, 15), { deltaX: 20, deltaY: 24 });
  assert.equal(controller.keyboardNudgeStep(false), 20);
  assert.equal(controller.historyStatus().entryCount, 2);
  assert.equal(renderer.canvasOptions.at(-1).snapToGrid, true);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.currentState().snapToGrid, false);
  assert.equal(controller.currentState().gridVisible, true);
});

test("Diagram 2 coalesces rapid style changes into one history entry", async () => {
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    host: editableHost(),
    state: styleState()
  });

  controller.setSelection(["box"]);
  assert.equal(await controller.updateSelectedObjectsStyle("fill", "#111111"), true);
  assert.equal(await controller.updateSelectedObjectsStyle("fill", "#222222"), true);
  assert.equal(controller.historyStatus().entryCount, 1);
  assert.equal(controller.getObjectById("box").fill, "#222222");
  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("box").fill, "#FFFFFF");
});

test("Diagram 2 context-menu locking is undoable and blocks object mutation", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: simpleState()
  });

  controller.setSelection(["box"]);
  assert.equal(await controller.setSelectedObjectsLocked(true), true);
  assert.equal(controller.getObjectById("box").locked, true);
  assert.equal(controller.historyStatus().entryCount, 1);
  assert.equal(await controller.moveSelectedObjects(10, 0), false);
  assert.equal(await controller.deleteSelectedObjects(), false);
  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("box").locked, false);
  assert.equal(await controller.redo(), true);
  assert.equal(controller.getObjectById("box").locked, true);
  assert.equal(renderer.fullRenderCount, 0);
});

test("Diagram 2 context-menu layer commands match Diagram 1 ordering and undo locally", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: formatState()
  });
  const order = () => controller.currentState().objects.map(object => object.id);

  controller.setSelection(["arrow", "text"]);
  assert.equal(await controller.arrangeSelectedObjects("back"), true);
  assert.deepEqual(order(), ["arrow", "text", "box", "mapping"]);
  assert.equal(await controller.arrangeSelectedObjects("front"), true);
  assert.deepEqual(order(), ["box", "mapping", "arrow", "text"]);
  assert.equal(await controller.undo(), true);
  assert.deepEqual(order(), ["arrow", "text", "box", "mapping"]);
  assert.equal(await controller.undo(), true);
  assert.deepEqual(order(), ["box", "arrow", "text", "mapping"]);

  assert.equal(await controller.arrangeSelectedObjects("forward"), true);
  assert.deepEqual(order(), ["box", "mapping", "arrow", "text"]);
  assert.equal(await controller.arrangeSelectedObjects("backward"), true);
  assert.deepEqual(order(), ["box", "arrow", "text", "mapping"]);
  assert.equal(renderer.fullRenderCount, 0);
  assert.deepEqual(renderer.objectOrders, [
    ["arrow", "text", "box", "mapping"],
    ["box", "mapping", "arrow", "text"],
    ["arrow", "text", "box", "mapping"],
    ["box", "arrow", "text", "mapping"],
    ["box", "mapping", "arrow", "text"],
    ["box", "arrow", "text", "mapping"]
  ]);

  await controller.setSelectedObjectsLocked(true);
  assert.equal(await controller.arrangeSelectedObjects("front"), false);
});

test("Diagram 2 Phase 4 structure and templates stay command-based and renderer-local", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: {
      version: 1,
      width: 900,
      height: 540,
      objects: [
        { id: "rect", type: "rectangle", x: 40, y: 40, width: 120, height: 90, fill: "#ffffff", stroke: "#172b4d", strokeWidth: 2, opacity: 1 },
        { id: "circle", type: "circle", x: 220, y: 60, width: 90, height: 90, fill: "#dbeafe", stroke: "#1d4ed8", strokeWidth: 2, opacity: 1 },
        { id: "note", type: "textbox", x: 380, y: 80, width: 160, height: 80, text: "Note", fill: "#ffffff", stroke: "#334155", strokeWidth: 2, textColor: "#172b4d" }
      ]
    }
  });

  controller.setSelection(["rect", "circle"]);
  assert.equal(await controller.groupSelectedObjects(), true);
  const groupId = controller.getObjectById("rect").groupId;
  assert.ok(groupId);
  assert.equal(controller.getObjectById("circle").groupId, groupId);
  assert.equal(controller.currentState().groupNames[groupId], "Group 1");
  assert.deepEqual(controller.selectStructureNode("object", "rect"), ["rect"]);
  assert.deepEqual(controller.selectedObjectIds(), ["rect"]);
  assert.equal(await controller.updateSelectedObjectsStyle("fill", "#fef3c7", { coalesce: false }), true);
  assert.equal(controller.getObjectById("rect").fill, "#FEF3C7");
  assert.equal(controller.getObjectById("circle").fill, "#dbeafe");
  assert.deepEqual(controller.selectedObjectIds(), ["rect"]);
  assert.deepEqual(controller.selectStructureNode("group", groupId).sort(), ["circle", "rect"]);
  assert.deepEqual(controller.selectedObjectIds().sort(), ["circle", "rect"]);
  assert.equal(renderer.structureStates.at(-1).reason, "group objects");
  assert.equal(renderer.fullRenderCount, 0);

  assert.equal(await controller.renameStructureNode("group", groupId, "Decision Pair"), true);
  assert.equal(controller.currentState().groupNames[groupId], "Decision Pair");
  assert.equal(await controller.setStructureNodeVisibility("group", groupId, false), true);
  assert.equal(controller.currentState().groupVisibility[groupId], false);
  assert.deepEqual(controller.selectedObjectIds(), []);
  assert.equal(await controller.undo(), true);
  assert.equal(controller.currentState().groupVisibility[groupId], true);

  assert.equal(await controller.reorderStructureNode({
    draggedKind: "object",
    draggedId: "note",
    targetKind: "group",
    targetId: groupId,
    targetPlacement: "inside"
  }), true);
  assert.equal(controller.getObjectById("note").groupId, groupId);
  assert.deepEqual(controller.selectStructureNode("group", groupId).sort(), ["circle", "note", "rect"]);

  const template = await captureDiagram2SelectionTemplate(
    controller.currentState(),
    controller.selectedObjectIds(),
    "Decision Pair Template"
  );
  assert.ok(template);
  const beforeTemplateCount = controller.currentState().objects.length;
  assert.equal(await controller.applyTemplate(template, { x: 650, y: 260 }), true);
  assert.equal(controller.currentState().objects.length, beforeTemplateCount + 3);
  assert.equal(renderer.addedObjectBatches.at(-1).length, 3);
  assert.equal(Object.keys(controller.currentState().groupNames).length, 2);

  assert.equal(await controller.addObject(
    createDiagram2DefaultObject("rectangle", { x: 700, y: 380 }, { id: "default-source" })
  ), true);
  controller.setSelection(["default-source"]);
  assert.equal(await controller.updateSelectedObjectsStyle("fill", "#123456"), true);
  const savedDefault = controller.setDrawingDefaultFromSelection("rectangle");
  assert.equal(savedDefault.fill, "#123456");
  const defaulted = controller.createDefaultObject("rectangle", { x: 700, y: 380 }, { id: "defaulted-rect" });
  assert.equal(defaulted.fill, "#123456");
  assert.equal(controller.resetDrawingDefault("rectangle"), true);
  const reset = controller.createDefaultObject("rectangle", { x: 700, y: 380 }, { id: "reset-rect" });
  assert.equal(reset.fill, "none");
  assert.equal(renderer.fullRenderCount, 0);
});

test("Diagram 2 Phase 5 entity, relationship, manual route, and compact commands stay shared and undoable", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: phase5EntityState()
  });
  const sprintDefinition = parseDiagram2EntityDefinition(`
CREATE TABLE [pmt].[Sprints](
  [SprintId] [int] IDENTITY(1,1) NOT NULL,
  [ProjectId] [int] NOT NULL,
  [SprintName] [nvarchar](200) NULL,
  CONSTRAINT [PK_Sprints] PRIMARY KEY CLUSTERED ([SprintId] ASC)
);
`, "", { foreignKeysAtTop: true });

  assert.equal(await controller.addEntity(sprintDefinition, { x: 540, y: 140 }, { id: "entity-sprints" }), true);
  assert.equal(controller.getObjectById("entity-sprints").entitySchema, "pmt");
  assert.equal(controller.getObjectById("entity-sprints").entityName, "Sprints");
  assert.equal(controller.getObjectById("entity-sprints").fields[0].isIdentity, true);
  assert.equal(controller.getObjectById("entity-sprints").foreignKeysAtTop, true);
  assert.equal(renderer.fullRenderCount, 0);
  assert.deepEqual(renderer.addedObjectIds, ["entity-sprints"]);

  assert.equal(await controller.updateEntityField("entity-sprints", 1, {
    name: "ProjectId",
    dataType: "int",
    nullable: false,
    isForeignKey: true,
    isImportant: true
  }), true);
  assert.equal(await controller.addEntityField("entity-sprints", { name: "ProjectId", dataType: "uniqueidentifier" }), true);
  assert.equal(controller.getObjectById("entity-sprints").fields.at(-1).name, "ProjectId2");
  assert.equal(await controller.updateEntityField("entity-sprints", 2, { name: "ProjectId" }), true);
  assert.equal(controller.getObjectById("entity-sprints").fields[2].name, "ProjectId3");
  assert.equal(await controller.updateEntityDefinition("entity-sprints", {
    schema: "pmt",
    name: "Sprints",
    foreignKeysAtTop: true,
    fields: [
      { name: "SprintName", dataType: "nvarchar(200)", nullable: true },
      { name: "SprintId", dataType: "int", nullable: false, isPrimaryKey: true, isIdentity: true },
      { name: "ProjectId", dataType: "int", nullable: false, isForeignKey: true, isImportant: true },
      { name: "ProjectId2", dataType: "uniqueidentifier", nullable: true }
    ],
    foreignKeys: []
  }), true);
  assert.deepEqual(controller.getObjectById("entity-sprints").fields.map(field => field.name), [
    "SprintName",
    "SprintId",
    "ProjectId",
    "ProjectId2"
  ]);
  assert.equal(await controller.moveEntityField("entity-sprints", 0, "down"), true);
  assert.deepEqual(controller.getObjectById("entity-sprints").fields.map(field => field.name), [
    "SprintId",
    "SprintName",
    "ProjectId",
    "ProjectId2"
  ]);
  assert.equal(await controller.moveEntityField("entity-sprints", 1, "up"), true);
  assert.equal(renderer.structureStates.at(-1).affectedObjectIds[0], "entity-sprints");

  assert.equal(await controller.setEntityFieldReference("entity-sprints", 2, {
    targetEntityId: "entity-projects",
    targetFieldName: "ProjectId",
    relationshipType: "many-to-one"
  }), true);
  assert.equal(controller.statusSnapshot().relationshipCount, 1);
  assert.equal(controller.getObjectById("entity-sprints").foreignKeys[0].columns[0], "ProjectId");
  assert.equal(await controller.updateEntityField("entity-sprints", 2, { name: "ProjectIdRenamed" }), true);
  assert.equal(controller.getObjectById("entity-sprints").foreignKeys[0].columns[0], "ProjectIdRenamed");
  assert.equal(controller.statusSnapshot().relationshipCount, 1);
  assert.equal(await controller.updateEntityField("entity-sprints", 2, { name: "ProjectId" }), true);

  assert.equal(await controller.addRelationship({
    sourceEntityId: "entity-sprints",
    sourceFieldName: "ProjectId",
    targetEntityId: "entity-projects",
    targetFieldName: "ProjectId",
    relationshipType: "many-to-one"
  }), true);
  const relationshipId = controller.selectedRelationshipIds()[0];
  assert.ok(relationshipId);
  assert.equal(controller.statusSnapshot().relationshipCount, 1);
  assert.equal(controller.selectedRelationshipObjects()[0].sourceEntityId, "entity-sprints");
  assert.ok(flattenDiagram2TreeNodes(diagram2ObjectTreeNodes(controller.state()))
    .some(node => node.kind === "relationship" && node.id === relationshipId));

  assert.equal(await controller.updateSelectedObjectsStyle("strokeWidth", 7, { coalesce: false }), true);
  assert.equal(controller.getObjectById("entity-sprints").foreignKeys[0].styleOverride.strokeWidth, 7);
  assert.deepEqual(renderer.structureStates.at(-1).affectedRelationshipIds, [relationshipId]);
  assert.equal(renderer.fullRenderCount, 0);

  assert.equal(await controller.updateRelationshipsStyle([relationshipId], "opacity", 55), true);
  assert.equal(controller.getObjectById("entity-sprints").foreignKeys[0].styleOverride.opacity, 0.55);
  assert.equal(await controller.setRelationshipType(relationshipId, "one-to-one"), true);
  assert.equal(controller.getObjectById("entity-sprints").foreignKeys[0].relationshipType, "one-to-one");
  assert.equal(await controller.updateRelationshipsStyle(["entity-relationships"], "showSymbols", true, { global: true }), true);
  assert.equal(controller.currentState().relationshipStyle.showSymbols, true);

  assert.equal(await controller.setRelationshipRoutingOptions({
    manualEntityRelationshipRoutes: true,
    allowOverlappingEntityLines: true
  }), true);
  assert.equal(controller.currentState().manualEntityRelationshipRoutes, true);
  assert.equal(controller.currentState().allowOverlappingEntityLines, true);
  assert.equal(await controller.useRelationshipRoute(relationshipId), true);
  const routeBeforeMove = controller.getObjectById("entity-sprints").foreignKeys[0].routeOverride;
  assert.ok(routeBeforeMove.length > 1);
  const segmentIndex = routeBeforeMove.findIndex((point, index) => {
    const next = routeBeforeMove[index + 1];
    return next && (point.x === next.x || point.y === next.y);
  });
  assert.ok(segmentIndex >= 0);
  const axis = routeBeforeMove[segmentIndex].x === routeBeforeMove[segmentIndex + 1].x ? "x" : "y";
  const coordinate = routeBeforeMove[segmentIndex][axis] + 24;
  assert.equal(await controller.adjustRelationshipRoute(relationshipId, segmentIndex, axis, coordinate), true);
  assert.notDeepEqual(controller.getObjectById("entity-sprints").foreignKeys[0].routeOverride, routeBeforeMove);
  const routeBeforeInsert = controller.getObjectById("entity-sprints").foreignKeys[0].routeOverride;
  assert.equal(await controller.insertRelationshipRoutePoint(relationshipId), true);
  assert.ok(controller.getObjectById("entity-sprints").foreignKeys[0].routeOverride.length > routeBeforeInsert.length);
  assert.equal(await controller.removeRelationshipRoutePoint(relationshipId), true);
  assert.ok(controller.getObjectById("entity-sprints").foreignKeys[0].routeOverride.length >= 2);
  assert.equal(await controller.clearRelationshipRoutes([relationshipId]), true);
  assert.equal(Object.hasOwn(controller.getObjectById("entity-sprints").foreignKeys[0], "routeOverride"), false);

  const beforeCompact = controller.getObjectById("entity-sprints");
  controller.setSelection(["entity-projects"]);
  assert.equal(await controller.autoFormatCompact(), true);
  assert.equal(controller.getObjectById("entity-projects").x, 80);
  assert.equal(controller.getObjectById("entity-projects").y, 90);
  assert.equal(controller.currentState().compactEntityRelationshipRouting, true);
  assert.notDeepEqual({
    x: controller.getObjectById("entity-sprints").x,
    y: controller.getObjectById("entity-sprints").y
  }, {
    x: beforeCompact.x,
    y: beforeCompact.y
  });

  controller.setSelection([relationshipId]);
  assert.equal(await controller.deleteSelectedObjects(), true);
  assert.equal(controller.statusSnapshot().relationshipCount, 0);
  assert.equal(controller.getObjectById("entity-sprints").fields.find(field => field.name === "ProjectId").isForeignKey, false);
  assert.equal(await controller.undo(), true);
  assert.equal(controller.statusSnapshot().relationshipCount, 1);
  assert.equal(await controller.redo(), true);
  assert.equal(controller.statusSnapshot().relationshipCount, 0);
  assert.equal(renderer.fullRenderCount, 0);
});

test("Diagram 2 route costing prefers resolved, quieter, deterministic routes", () => {
  const obstacle = { id: "entity-obstacle", x: 90, y: 40, width: 80, height: 80 };
  const direct = scoreDiagram2RoutePoints([
    { x: 20, y: 80 },
    { x: 220, y: 80 }
  ], [obstacle]);
  const around = scoreDiagram2RoutePoints([
    { x: 20, y: 80 },
    { x: 20, y: 20 },
    { x: 220, y: 20 },
    { x: 220, y: 80 }
  ], [obstacle]);

  assert.equal(direct.resolved, false);
  assert.equal(around.resolved, true);
  assert.equal(compareDiagram2RouteScores(around, direct), -1);
  assert.equal(around.canonicalPathKey, "M 20 80 V 20 H 220 V 80");
});

test("Diagram 2 Compact cancel and no-improvement paths leave state and history unchanged", async () => {
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    host: editableHost(),
    state: phase5EntityState()
  });
  const before = JSON.stringify(controller.currentState());
  const canceled = new AbortController();
  canceled.abort();
  assert.equal(await controller.autoFormatCompact({ signal: canceled.signal }), false);
  assert.equal(JSON.stringify(controller.currentState()), before);
  assert.equal(controller.historyStatus().dirty, false);
  assert.equal(controller.diagnostics().lastCompact.finalStatus, "Canceled");

  assert.equal(await controller.autoFormatCompact(), false);
  assert.equal(JSON.stringify(controller.currentState()), before);
  assert.equal(controller.historyStatus().dirty, false);
  assert.equal(controller.diagnostics().lastCompact.finalStatus, "No improvement");
});

test("Diagram 2 Compact engine reports progress phases without mutating canonical input", async () => {
  const state = phase5TwoEntityState();
  const progress = [];
  const result = await runDiagram2CompactEngine({
    state,
    preferredRootId: "entity-projects",
    onProgress: item => progress.push(item.phase)
  });

  assert.equal(result.status, "Completed");
  assert.ok(progress.includes("Analyzing Entities"));
  assert.ok(progress.includes("Evaluating Route Candidates"));
  assert.equal(state.objects[1].x, 820);
  assert.notEqual(result.plan.nextState.objects[1].x, 820);
  assert.equal(result.plan.label, "Auto Format - Compact");
});

test("Diagram 2 Phase 4 Objects tree handles 1,000 structured objects through shared incremental commands", async t => {
  const state = phase4ClosureState(1000);
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state
  });
  const treeStart = performance.now();
  const treeNodes = diagram2ObjectTreeNodes(controller.state());
  const treeProjectionMs = performance.now() - treeStart;
  const flatTree = flattenDiagram2TreeNodes(treeNodes);

  assert.equal(controller.currentState().objects.length, 1000);
  assert.ok(flatTree.length > 1000);
  assert.ok(flatTree.some(node => node.kind === "group" && node.id === "closure-group-0"));
  assert.ok(flatTree.some(node => node.kind === "relationships"));
  assert.ok(flatTree.some(node => node.kind === "object" && node.id === "closure-search-target"));
  assert.ok(treeProjectionMs < 250);

  const selected = controller.selectStructureNode("object", "closure-search-target");
  assert.deepEqual(selected, ["closure-search-target"]);
  assert.deepEqual(controller.selectedObjectIds(), ["closure-search-target"]);
  assert.equal(renderer.fullRenderCount, 0);
  assert.deepEqual(renderer.updatedObjectIds, []);
  assert.deepEqual(renderer.structureStates, []);

  const searchStart = performance.now();
  const searchNodes = diagram2ObjectTreeNodes(controller.state(), "Search Target 777");
  const searchProjectionMs = performance.now() - searchStart;
  const flatSearchTree = flattenDiagram2TreeNodes(searchNodes);
  assert.ok(flatSearchTree.some(node => node.id === "closure-search-target"));
  assert.ok(flatSearchTree.length < flatTree.length);
  assert.ok(searchProjectionMs < 125);

  const historyStart = controller.historyStatus().entryCount;
  assert.equal(await controller.renameStructureNode("object", "closure-search-target", "Closure Renamed Target 777"), true);
  assert.equal(controller.getObjectById("closure-search-target").name, "Closure Renamed Target 777");
  assert.equal(controller.historyStatus().entryCount, historyStart + 1);
  assert.equal(renderer.fullRenderCount, 0);
  assert.deepEqual(renderer.structureStates.at(-1).affectedObjectIds, ["closure-search-target"]);
  assertStructureObjectPatchDiagnostics(controller, ["closure-search-target"], false);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("closure-search-target").name, "Closure Search Target 777");
  assert.equal(await controller.redo(), true);
  assert.equal(controller.getObjectById("closure-search-target").name, "Closure Renamed Target 777");
  assert.equal(renderer.fullRenderCount, 0);

  const lockUpdatesBefore = renderer.updatedObjectIds.length;
  assert.equal(await controller.setStructureNodeLocked("object", "closure-lock-target", true), true);
  assert.equal(controller.getObjectById("closure-lock-target").locked, true);
  assert.deepEqual(renderer.updatedObjectIds.slice(lockUpdatesBefore), ["closure-lock-target"]);
  assertIndexedObjectPatchDiagnostics(controller, ["closure-lock-target"]);
  assert.equal(renderer.fullRenderCount, 0);

  const groupMembers = controller.currentState().objects
    .filter(object => object.groupId === "closure-group-0")
    .map(object => object.id);
  assert.ok(groupMembers.length > 1);
  assert.equal(await controller.setStructureNodeVisibility("group", "closure-group-0", false), true);
  assert.equal(controller.currentState().groupVisibility["closure-group-0"], false);
  assert.deepEqual(renderer.structureStates.at(-1).affectedObjectIds, groupMembers);
  assertStructureObjectPatchDiagnostics(controller, groupMembers, false);
  assert.equal(renderer.fullRenderCount, 0);

  assert.equal(await controller.reorderStructureNode({
    draggedKind: "object",
    draggedId: "closure-reorder-target",
    targetKind: "group",
    targetId: "closure-group-1",
    targetPlacement: "inside"
  }), true);
  assert.equal(controller.getObjectById("closure-reorder-target").groupId, "closure-group-1");
  assert.equal(controller.diagnostics().lastCanonicalOperation.kind, "structure-state");
  assert.equal(controller.diagnostics().lastCanonicalOperation.objectContainerReindexed, true);
  assert.equal(controller.diagnostics().lastCanonicalOperation.fullStateSerializationCount, 0);
  assert.equal(renderer.fullRenderCount, 0);

  assert.equal(await controller.undo(), true);
  assert.notEqual(controller.getObjectById("closure-reorder-target").groupId, "closure-group-1");
  assert.equal(await controller.redo(), true);
  assert.equal(controller.getObjectById("closure-reorder-target").groupId, "closure-group-1");
  assert.equal(renderer.fullRenderCount, 0);

  t.diagnostic(`DIAGRAM2_PHASE4_TREE_1000_METRICS ${JSON.stringify({
    canonicalObjectCount: controller.currentState().objects.length,
    flattenedTreeNodeCount: flatTree.length,
    objectTreeProjectionMs: Number(treeProjectionMs.toFixed(2)),
    searchProjectionMs: Number(searchProjectionMs.toFixed(2)),
    structureStateUpdateCount: renderer.structureStates.length,
    objectPatchUpdateCount: renderer.updatedObjectIds.length,
    historyEntryCount: controller.historyStatus().entryCount,
    fullRenderCount: renderer.fullRenderCount
  })}`);
});

test("Diagram 2 controller moves one object in a large state without full-state serialization or scans", async () => {
  const renderer = fakeRenderer();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state: largeState(1200)
  });
  const selectedId = "box-600";
  const selectedBefore = controller.getObjectById(selectedId);
  const unrelatedBefore = controller.getObjectById("box-599");
  const firstBefore = controller.getObjectById("box-0");
  const lastBefore = controller.getObjectById("box-1199");
  const originalStringify = JSON.stringify;
  let stringifyCount = 0;
  JSON.stringify = function countingStringify(...args) {
    stringifyCount += 1;
    return originalStringify.apply(this, args);
  };

  try {
    controller.setSelection([selectedId]);
    assert.equal(await controller.moveSelectedObjects(12, 8), true);
    assert.equal(controller.getObjectById(selectedId).x, selectedBefore.x + 12);
    assert.equal(controller.getObjectById(selectedId).y, selectedBefore.y + 8);
    assertIndexedMoveDiagnostics(controller, selectedId);
    assert.equal(renderer.fullRenderCount, 0);
    assert.deepEqual(renderer.updatedObjectIds, [selectedId]);
    assert.equal(controller.getObjectById("box-599"), unrelatedBefore);
    assert.equal(controller.currentState().objects[599], unrelatedBefore);
    assert.equal(controller.currentState().objects[0], firstBefore);
    assert.equal(controller.currentState().objects[1199], lastBefore);

    assert.equal(await controller.undo(), true);
    assert.equal(controller.getObjectById(selectedId).x, selectedBefore.x);
    assert.equal(controller.getObjectById(selectedId).y, selectedBefore.y);
    assertIndexedMoveDiagnostics(controller, selectedId);
    assert.deepEqual(renderer.updatedObjectIds, [selectedId, selectedId]);
    assert.equal(controller.getObjectById("box-599"), unrelatedBefore);

    assert.equal(await controller.redo(), true);
    assert.equal(controller.getObjectById(selectedId).x, selectedBefore.x + 12);
    assert.equal(controller.getObjectById(selectedId).y, selectedBefore.y + 8);
    assertIndexedMoveDiagnostics(controller, selectedId);
    assert.deepEqual(renderer.updatedObjectIds, [selectedId, selectedId, selectedId]);
    assert.equal(controller.getObjectById("box-599"), unrelatedBefore);
  } finally {
    JSON.stringify = originalStringify;
  }

  assert.equal(stringifyCount, 0);
});

test("Diagram 2 read-only sessions block command, undo, and redo mutations from cached capabilities", async () => {
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    host: editableHost(),
    state: simpleState()
  });

  controller.setSelection(["box"]);
  assert.equal(await controller.moveSelectedObjects(10, 0), true);
  assert.equal(controller.getObjectById("box").x, 130);

  controller.setHost(readOnlyHost());
  assert.equal(controller.statusSnapshot().canEdit, false);
  assert.equal(controller.statusSnapshot().canSave, false);
  assert.equal(await controller.undo(), false);
  assert.equal(await controller.redo(), false);
  assert.equal(await controller.moveSelectedObjects(10, 0), false);
  assert.equal(controller.getObjectById("box").x, 130);
});

test("Diagram 2 editor controller defaults to read-only without explicit update capability", async () => {
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    state: simpleState()
  });

  controller.setSelection(["box"]);
  assert.equal(controller.statusSnapshot().canEdit, false);
  assert.equal(await controller.moveSelectedObjects(10, 0), false);
  assert.equal(controller.getObjectById("box").x, 120);
});

test("Diagram 2 moving the original image keeps its full image clip aligned", async () => {
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    host: editableHost(),
    state: imageState()
  });

  controller.setSelection(["source-image"]);
  assert.equal(await controller.moveSelectedObjects(40, 20), true);
  const image = controller.getObjectById("source-image");
  assert.equal(image.x, 40);
  assert.equal(image.y, 20);
  assert.deepEqual(image.imageClip, { x: 40, y: 20, width: 100, height: 50 });
});

test("Diagram 2 RTE save restores stale full-image clips before upload", () => {
  const state = normalizeDiagram2RteSaveState({
    version: 1,
    width: 100,
    height: 50,
    canvasBounds: { x: 0, y: 0, width: 100, height: 50 },
    objects: [{
      id: "source-image",
      type: "embedded-image",
      x: 40,
      y: 20,
      width: 100,
      height: 50,
      source: sampleImageDataUrl,
      imageClip: { x: 40, y: 20, width: 60, height: 30 },
      isOriginalImage: true
    }]
  });

  assert.deepEqual(state.objects[0].imageClip, { x: 40, y: 20, width: 100, height: 50 });
});

test("Diagram 2 RTE save preserves real cropped image clips", () => {
  const state = normalizeDiagram2RteSaveState({
    version: 1,
    width: 100,
    height: 50,
    canvasBounds: { x: 0, y: 0, width: 100, height: 50 },
    objects: [{
      id: "source-image",
      type: "embedded-image",
      x: 40,
      y: 20,
      width: 100,
      height: 50,
      source: sampleImageDataUrl,
      imageClip: { x: 55, y: 30, width: 30, height: 20 },
      isOriginalImage: true
    }]
  });

  assert.deepEqual(state.objects[0].imageClip, { x: 55, y: 30, width: 30, height: 20 });
});

function simpleState() {
  return {
    version: 1,
    width: 640,
    height: 360,
    objects: [{
      id: "box",
      type: "rectangle",
      x: 120,
      y: 96,
      width: 280,
      height: 120
    }]
  };
}

function imageState() {
  return {
    version: 1,
    width: 100,
    height: 50,
    objects: [{
      id: "source-image",
      type: "embedded-image",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      source: sampleImageDataUrl,
      imageClip: { x: 0, y: 0, width: 100, height: 50 },
      isOriginalImage: true
    }]
  };
}

function styleState() {
  return {
    version: 1,
    width: 640,
    height: 360,
    objects: [{
      id: "box",
      type: "rectangle",
      x: 120,
      y: 96,
      width: 280,
      height: 120,
      fill: "#FFFFFF",
      stroke: "#172B4D"
    }]
  };
}

function formatState() {
  return {
    version: 1,
    width: 640,
    height: 360,
    objects: [{
      id: "box",
      type: "rectangle",
      x: 40,
      y: 40,
      width: 160,
      height: 100,
      fill: "#ffffff",
      stroke: "#172b4d",
      strokeWidth: 2,
      outlineVisible: true,
      opacity: 1
    }, {
      id: "arrow",
      type: "arrow",
      x1: 220,
      y1: 80,
      x2: 340,
      y2: 140,
      stroke: "#172b4d",
      strokeWidth: 3,
      arrowSize: 24,
      opacity: 1
    }, {
      id: "text",
      type: "textbox",
      x: 80,
      y: 180,
      width: 220,
      height: 90,
      text: "Format me",
      fill: "#ffffff",
      stroke: "#172b4d",
      strokeWidth: 2,
      textColor: "#172b4d",
      fontFamily: "Arial",
      fontSize: 24,
      textAlign: "left",
      textVerticalAlign: "top"
    }, {
      id: "mapping",
      type: "field-mapping-table",
      x: 340,
      y: 160,
      width: 240,
      height: 140,
      rows: [{ uiField: "Task", databaseField: "pmt.Tasks" }],
      stroke: "#172b4d",
      strokeWidth: 2,
      fontFamily: "Arial",
      fontSize: 14,
      headerFill: "#d9ecff",
      headerTextColor: "#000000",
      uiFill: "#ffffff",
      uiTextColor: "#172b4d",
      databaseFill: "#ffffff",
      databaseTextColor: "#172b4d"
    }]
  };
}

function phase4ClosureState(count) {
  const groupNames = {};
  const groupVisibility = {};
  const objects = [];
  let previousEntityName = "";
  for (let index = 0; index < count; index += 1) {
    const namedTarget = index === 777
      ? "search"
      : index === 888
        ? "reorder"
        : index === 901
          ? "lock"
          : "";
    const groupId = namedTarget
      ? ""
      : index % 30 < 12
        ? `closure-group-${Math.floor(index / 30)}`
        : "";
    if (groupId) {
      groupNames[groupId] = `Closure Group ${Math.floor(index / 30) + 1}`;
      if (!Object.hasOwn(groupVisibility, groupId)) {
        groupVisibility[groupId] = Math.floor(index / 30) % 7 !== 3;
      }
    }
    const x = (index % 40) * 130;
    const y = Math.floor(index / 40) * 92;
    const base = {
      id: `closure-object-${index}`,
      name: `Closure Object ${index}`,
      groupId,
      groupHitTransparent: Boolean(groupId),
      visible: index % 53 !== 0,
      locked: false,
      x,
      y,
      width: 92,
      height: 54,
      fill: "#ffffff",
      stroke: "#172b4d",
      strokeWidth: 2,
      opacity: 1
    };
    if (namedTarget === "search") {
      objects.push({
        ...base,
        id: "closure-search-target",
        name: "Closure Search Target 777",
        groupId: "",
        groupHitTransparent: false,
        visible: true,
        locked: false,
        type: "textbox",
        text: "Search target",
        textColor: "#172b4d"
      });
      continue;
    }
    if (namedTarget === "reorder") {
      objects.push({
        ...base,
        id: "closure-reorder-target",
        name: "Closure Reorder Target",
        groupId: "",
        groupHitTransparent: false,
        visible: true,
        locked: false,
        type: "rectangle"
      });
      continue;
    }
    if (namedTarget === "lock") {
      objects.push({
        ...base,
        id: "closure-lock-target",
        name: "Closure Lock Target",
        groupId: "",
        groupHitTransparent: false,
        visible: true,
        locked: false,
        type: "rectangle"
      });
      continue;
    }

    if (index % 40 === 0) {
      const entityName = `ClosureEntity${index}`;
      const foreignKeys = previousEntityName
        ? [{
            name: `FK_${entityName}_${previousEntityName}`,
            columns: ["ParentId"],
            referencedSchema: "dbo",
            referencedTable: previousEntityName,
            referencedColumns: ["Id"],
            relationshipType: "many-to-one"
          }]
        : [];
      objects.push({
        ...base,
        type: "entity",
        width: 210,
        height: 118,
        entitySchema: "dbo",
        entityName,
        fields: [
          { name: "Id", dataType: "INT", nullable: false, isPrimaryKey: true },
          { name: "ParentId", dataType: "INT", nullable: true, isForeignKey: Boolean(previousEntityName) }
        ],
        foreignKeys
      });
      previousEntityName = entityName;
    } else if (index % 40 === 1) {
      objects.push({
        ...base,
        type: "entity",
        entityKind: "field-rectangle",
        fieldRectangleName: `Field ${index}`,
        fields: [{ name: `Field${index}`, isImportant: index % 3 === 0 }]
      });
    } else if (index % 40 === 2) {
      objects.push({
        ...base,
        type: "field-mapping-table",
        width: 220,
        height: 120,
        sourceImageId: "closure-object-3",
        rows: [{
          uiEntityId: `closure-object-${index - 1}`,
          uiField: `Field${index - 1}`,
          databaseField: `dbo.ClosureEntity${Math.max(0, index - 2)}.Name`
        }]
      });
    } else if (index % 40 === 3) {
      objects.push({
        ...base,
        type: "embedded-image",
        width: 120,
        height: 70,
        source: sampleImageDataUrl
      });
    } else if (index % 5 === 0) {
      objects.push({
        ...base,
        type: "arrow",
        x1: x,
        y1: y,
        x2: x + 92,
        y2: y + 54,
        arrowSize: 18
      });
    } else if (index % 5 === 1) {
      objects.push({
        ...base,
        type: "line",
        x1: x,
        y1: y,
        x2: x + 96,
        y2: y
      });
    } else if (index % 5 === 2) {
      objects.push({
        ...base,
        type: "rich-text",
        width: 150,
        height: 76,
        html: `<p><strong>Closure ${index}</strong></p>`
      });
    } else if (index % 5 === 3) {
      objects.push({
        ...base,
        type: "circle",
        width: 64,
        height: 64
      });
    } else {
      objects.push({
        ...base,
        type: "rectangle"
      });
    }
  }
  return {
    version: 1,
    width: 5400,
    height: 2400,
    manualEntityRelationshipRoutes: true,
    groupNames,
    groupVisibility,
    objects
  };
}

function phase5EntityState() {
  return {
    version: 1,
    width: 1000,
    height: 620,
    objects: [{
      id: "entity-projects",
      type: "entity",
      x: 80,
      y: 90,
      width: 520,
      height: 130,
      fill: "#ffffff",
      stroke: "#42526b",
      strokeWidth: 2,
      opacity: 1,
      entitySchema: "pmt",
      entityName: "Projects",
      fields: [
        { name: "ProjectId", dataType: "int", nullable: false, isPrimaryKey: true, isIdentity: true },
        { name: "ProjectName", dataType: "nvarchar(200)", nullable: false }
      ],
      foreignKeys: [],
      locked: true
    }]
  };
}

function phase5TwoEntityState() {
  return {
    version: 1,
    width: 1400,
    height: 800,
    objects: [
      {
        id: "entity-projects",
        type: "entity",
        x: 80,
        y: 90,
        width: 520,
        height: 130,
        fill: "#ffffff",
        stroke: "#42526b",
        strokeWidth: 2,
        opacity: 1,
        entitySchema: "pmt",
        entityName: "Projects",
        fields: [
          { name: "ProjectId", dataType: "int", nullable: false, isPrimaryKey: true, isIdentity: true },
          { name: "ProjectName", dataType: "nvarchar(200)", nullable: false }
        ],
        foreignKeys: [],
        locked: false
      },
      {
        id: "entity-tasks",
        type: "entity",
        x: 820,
        y: 360,
        width: 520,
        height: 150,
        fill: "#ffffff",
        stroke: "#42526b",
        strokeWidth: 2,
        opacity: 1,
        entitySchema: "pmt",
        entityName: "WorkTasks",
        fields: [
          { name: "TaskId", dataType: "int", nullable: false, isPrimaryKey: true, isIdentity: true },
          { name: "ProjectId", dataType: "int", nullable: false, isForeignKey: true },
          { name: "Title", dataType: "nvarchar(220)", nullable: false }
        ],
        foreignKeys: [{
          name: "FK_WorkTasks_ProjectId_Projects",
          columns: ["ProjectId"],
          referencedSchema: "pmt",
          referencedTable: "Projects",
          referencedColumns: ["ProjectId"],
          relationshipType: "many-to-one"
        }],
        locked: false
      }
    ]
  };
}

function largeState(count) {
  return {
    version: 1,
    width: 4000,
    height: 2400,
    objects: Array.from({ length: count }, (_, index) => ({
      id: `box-${index}`,
      type: "rectangle",
      x: (index % 40) * 120,
      y: Math.floor(index / 40) * 90,
      width: 90,
      height: 48,
      fill: "#ffffff",
      stroke: "#172b4d",
      strokeWidth: 2
    }))
  };
}

function flattenDiagram2TreeNodes(nodes) {
  return (Array.isArray(nodes) ? nodes : []).flatMap(node => [
    node,
    ...flattenDiagram2TreeNodes(node.children || [])
  ]);
}

function assertStructureObjectPatchDiagnostics(controller, affectedObjectIds, objectContainerReindexed) {
  const diagnostics = controller.diagnostics();
  assert.equal(diagnostics.lastCanonicalOperation.kind, "structure-state");
  assert.equal(diagnostics.lastCanonicalOperation.changed, true);
  assert.deepEqual(diagnostics.lastCanonicalOperation.affectedObjectIds, affectedObjectIds);
  assert.equal(diagnostics.lastCanonicalOperation.objectPatchCount, affectedObjectIds.length);
  assert.equal(diagnostics.lastCanonicalOperation.objectArrayCopyCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectContainerReindexed, objectContainerReindexed);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateNormalizationCount, 0);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateSerializationCount, 0);
}

function assertIndexedObjectPatchDiagnostics(controller, affectedObjectIds) {
  const diagnostics = controller.diagnostics();
  assert.equal(diagnostics.lastCanonicalOperation.kind, "update-objects");
  assert.equal(diagnostics.lastCanonicalOperation.changed, true);
  assert.deepEqual(diagnostics.lastCanonicalOperation.affectedObjectIds, affectedObjectIds);
  assert.equal(diagnostics.lastCanonicalOperation.objectPatchCount, affectedObjectIds.length);
  assert.equal(diagnostics.lastCanonicalOperation.objectArrayCopyCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectContainerReindexed, false);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateNormalizationCount, 0);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateSerializationCount, 0);
}

function assertIndexedMoveDiagnostics(controller, selectedId) {
  const diagnostics = controller.diagnostics();
  assert.equal(diagnostics.canonicalObjectCount, 1200);
  assert.equal(diagnostics.canonicalIndexSize, 1200);
  assert.equal(diagnostics.fullStateSerializationCount, 0);
  assert.equal(diagnostics.lastCanonicalOperation.kind, "update-objects");
  assert.equal(diagnostics.lastCanonicalOperation.changed, true);
  assert.deepEqual(diagnostics.lastCanonicalOperation.affectedObjectIds, [selectedId]);
  assert.equal(diagnostics.lastCanonicalOperation.requestedObjectCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectLookupCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectPatchCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectArrayCopyCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectContainerReindexed, false);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateNormalizationCount, 0);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateSerializationCount, 0);
}

function assertIndexedAddDiagnostics(controller, selectedId) {
  const diagnostics = controller.diagnostics();
  assert.equal(diagnostics.lastCanonicalOperation.kind, "add-object");
  assert.equal(diagnostics.lastCanonicalOperation.changed, true);
  assert.deepEqual(diagnostics.lastCanonicalOperation.affectedObjectIds, [selectedId]);
  assert.equal(diagnostics.lastCanonicalOperation.requestedObjectCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectLookupCount, 0);
  assert.equal(diagnostics.lastCanonicalOperation.objectPatchCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectArrayCopyCount, 1);
  assert.equal(diagnostics.lastCanonicalOperation.objectContainerReindexed, false);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateNormalizationCount, 0);
  assert.equal(diagnostics.lastCanonicalOperation.fullStateSerializationCount, 0);
}

function editableHost() {
  return {
    kind: "diagram-document",
    canEdit: true,
    canExport: true,
    security: Object.freeze({
      resource: "Documentation",
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      canImport: true,
      canExport: true
    }),
    async save() {}
  };
}

function readOnlyHost() {
  return {
    kind: "diagram-document",
    canEdit: false,
    canExport: true,
    security: Object.freeze({
      resource: "Documentation",
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      canImport: false,
      canExport: true
    }),
    async save() {}
  };
}

function fakeRenderer() {
  return {
    fullRenderCount: 0,
    updatedObjectIds: [],
    addedObjectIds: [],
    removedObjectIds: [],
    addedObjectBatches: [],
    removedObjectBatches: [],
    objectOrders: [],
    structureStates: [],
    canvasOptions: [],
    beginDiagramUpdate() {},
    endDiagramUpdate() {},
    addObject(object) {
      this.addedObjectIds.push(object.id);
    },
    addObjects(objects) {
      this.addedObjectBatches.push(objects.map(object => object.id));
    },
    removeObject(id) {
      this.removedObjectIds.push(id);
    },
    removeObjects(ids) {
      this.removedObjectBatches.push(ids.slice());
    },
    setObjectOrder(ids) {
      this.objectOrders.push(ids.slice());
    },
    setStructureState(state, options = {}) {
      this.structureStates.push({
        objectIds: (state?.objects || []).map(object => object.id),
        groupNames: { ...(state?.groupNames || {}) },
        groupVisibility: { ...(state?.groupVisibility || {}) },
        affectedObjectIds: [...(options.affectedObjectIds || [])],
        affectedRelationshipIds: [...(options.affectedRelationshipIds || [])],
        reason: options.reason || ""
      });
    },
    updateObject(id) {
      this.updatedObjectIds.push(id);
    },
    setSelectedIds(ids) {
      this.selectedIds = ids.slice();
      return {};
    },
    setCanvasOptions(options) {
      this.canvasOptions.push({ ...options });
    }
  };
}
