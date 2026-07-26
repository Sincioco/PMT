import test from "node:test";
import assert from "node:assert/strict";

import {
  createDiagram2DefaultObject,
  createDiagram2EditorController
} from "../../wwwroot/js/features/diagram2/diagram2-editor-controller.js";
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
    beginDiagramUpdate() {},
    endDiagramUpdate() {},
    addObject(object) {
      this.addedObjectIds.push(object.id);
    },
    removeObject(id) {
      this.removedObjectIds.push(id);
    },
    updateObject(id) {
      this.updatedObjectIds.push(id);
    },
    setSelectedIds(ids) {
      this.selectedIds = ids.slice();
      return {};
    }
  };
}
