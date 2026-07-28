import test from "node:test";
import assert from "node:assert/strict";

import {
  createDiagram2DefaultObject,
  createDiagram2EditorController,
  resizeDiagram2ObjectsGeometry
} from "../../wwwroot/js/features/diagram2/diagram2-editor-controller.js";
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
