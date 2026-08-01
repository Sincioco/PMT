import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  annotationFieldMappingAttentionGeometry,
  normalizeAnnotationState
} from "../../wwwroot/js/components/image-annotation.js";
import {
  createDiagram2PmtDiagramFile,
  createDiagram2SelectionClipboardText,
  parseDiagram2PmtDiagramFile,
  parseDiagram2SelectionClipboardText,
  remapDiagram2SelectionClipboardPackageIds
} from "../../wwwroot/js/features/diagram2/diagram2-compatibility.js";
import {
  createDiagram2CropNumericAdjustmentScheduler,
  diagram2CropCornerPatch,
  diagram2CropNumericDebounceMilliseconds,
  diagram2CropPatchFromInsets,
  diagram2CropSelectionQuietMilliseconds,
  diagram2ImageCropInsets,
  diagram2ImageEffectiveClip,
  diagram2ImageHasReversibleCrop,
  diagram2ResetCropPatch,
  diagram2ResetCropRadiusPatch,
  resizeDiagram2CropClip
} from "../../wwwroot/js/features/diagram2/diagram2-editor-crop.js";
import {
  createDiagram2EditorController
} from "../../wwwroot/js/features/diagram2/diagram2-editor-controller.js";
import {
  nextAvailableDiagram2SaveTitle
} from "../../wwwroot/js/features/diagram2/diagram2-document-host-adapter.js";
import {
  createDiagram2EntityAnnotationIndexes,
  createDiagram2EntityAnnotationPlan
} from "../../wwwroot/js/features/diagram2/diagram2-editor-entity-annotations.js";
import {
  createDiagram2FieldMappingTable,
  diagram2FieldMappingTableRowKey,
  syncDiagram2FieldMappingTableForFieldRectangle,
  syncDiagram2FieldMappingTableForImage
} from "../../wwwroot/js/features/diagram2/diagram2-editor-field-mapping-tables.js";
import {
  createDiagram2FieldMappingIndexes,
  diagram2EntityFieldMappingKey,
  diagram2FieldMappingPaneGroups,
  diagram2FieldMappingIndexDiagnostics,
  diagram2MappingAttentionTargets,
  patchDiagram2FieldMappingIndexes,
  setDiagram2FieldMappingRouteIndex
} from "../../wwwroot/js/features/diagram2/diagram2-editor-field-mappings.js";
import {
  createDiagram2FieldRectangle,
  diagram2FieldMappingIdentity,
  diagram2FieldRectangleMapping,
  renameDiagram2FieldRectangle,
  setDiagram2FieldRectangleConnectionSide,
  setDiagram2FieldRectangleMapping
} from "../../wwwroot/js/features/diagram2/diagram2-editor-field-rectangles.js";
import {
  createDiagram2EmbeddedImage,
  diagram2ImageSourceIdentity,
  isDiagram2ImageFile
} from "../../wwwroot/js/features/diagram2/diagram2-editor-images.js";
import {
  captureDiagram2SelectionTemplate,
  instantiateDiagram2TemplateObjects
} from "../../wwwroot/js/features/diagram2/diagram2-editor-templates.js";
import {
  createDiagram2ImageResourceManager
} from "../../wwwroot/js/features/diagram2/diagram2-image-resources.js";

const imageSource = "data:image/png;base64,AAECAwQFBgcICQ==";

test("Diagram 2 save conflicts suggest the next available numbered name", () => {
  assert.equal(nextAvailableDiagram2SaveTitle("Architecture", [
    { title: "Architecture" },
    { title: "Architecture 2" },
    { title: "Architecture 3" }
  ]), "Architecture 4");
  assert.equal(nextAvailableDiagram2SaveTitle("Architecture 3", [
    { title: "Architecture 3" },
    { title: "Architecture 4" }
  ]), "Architecture 5");
  assert.equal(nextAvailableDiagram2SaveTitle("Architecture", [
    { title: "architecture" },
    { title: "ARCHITECTURE 2" }
  ]), "Architecture 3");
});

test("D1 and D2 share exact label-aware Field Mapping attention-arrow geometry", () => {
  const geometry = annotationFieldMappingAttentionGeometry({
    uiLabelBounds: { x: 10, y: 20, width: 30, height: 10 },
    databaseLabelBounds: { x: 200, y: 100, width: 50, height: 20 },
    uiCellBounds: { x: 0, y: 10, width: 80, height: 30 },
    databaseCellBounds: { x: 180, y: 90, width: 100, height: 40 },
    fieldRectangleBounds: { x: 100, y: 5, width: 40, height: 40 },
    databaseFieldPoint: { x: 400, y: 110 },
    zoom: 2
  });

  assert.deepEqual(geometry.ui.start, { x: 43, y: 25 });
  assert.deepEqual(geometry.ui.tip, { x: 100, y: 25 });
  assert.deepEqual(geometry.ui.lineEnd, { x: 94, y: 25 });
  assert.deepEqual(geometry.ui.head, [
    { x: 100, y: 25 },
    { x: 94, y: 27.76 },
    { x: 94, y: 22.24 }
  ]);
  assert.deepEqual(geometry.database.start, { x: 253, y: 110 });
  assert.deepEqual(geometry.database.tip, { x: 400, y: 110 });
  assert.deepEqual(geometry.database.lineEnd, { x: 394, y: 110 });

  const fallback = annotationFieldMappingAttentionGeometry({
    uiCellBounds: { x: 0, y: 0, width: 80, height: 30 },
    databaseCellBounds: { x: 100, y: 0, width: 120, height: 30 },
    fieldRectangleBounds: { x: 300, y: 0, width: 60, height: 60 },
    databaseFieldBounds: { x: 400, y: 80, width: 200, height: 30 },
    zoom: 1
  });
  const roundedPoint = point => ({
    x: Math.round(point.x * 1000) / 1000,
    y: Math.round(point.y * 1000) / 1000
  });
  assert.deepEqual(roundedPoint(fallback.ui.start), { x: 80, y: 17.069 });
  assert.deepEqual(roundedPoint(fallback.ui.tip), { x: 300, y: 28.448 });
  assert.deepEqual(roundedPoint(fallback.database.start), { x: 220, y: 29.118 });
  assert.deepEqual(roundedPoint(fallback.database.tip), { x: 436.25, y: 80 });
});

test("Diagram 2 creates canonical images and stable source identities", () => {
  const image = createDiagram2EmbeddedImage({
    id: "screen",
    name: "Screen",
    source: imageSource,
    x: 20,
    y: 30,
    width: 640,
    height: 360
  });

  assert.equal(image.type, "embedded-image");
  assert.equal(image.opacity, undefined);
  assert.deepEqual(image.imageClip, { x: 20, y: 30, width: 640, height: 360 });
  assert.equal(image.cropVisible, true);
  assert.equal(isDiagram2ImageFile({ name: "screen.PNG", type: "" }), true);
  assert.equal(isDiagram2ImageFile({ name: "notes.txt", type: "text/plain" }), false);
  assert.equal(diagram2ImageSourceIdentity(imageSource), diagram2ImageSourceIdentity(imageSource));
  assert.notEqual(
    diagram2ImageSourceIdentity(imageSource),
    diagram2ImageSourceIdentity(`${imageSource}A`)
  );
});

test("Diagram 2 crop math stays inside the image and supports reset and corner radii", () => {
  const image = createDiagram2EmbeddedImage({
    id: "crop-screen",
    source: imageSource,
    x: 100,
    y: 50,
    width: 400,
    height: 240
  });
  const insetPatch = diagram2CropPatchFromInsets(image, {
    left: 40,
    top: 20,
    right: 60,
    bottom: 30
  });
  const cropped = { ...image, ...insetPatch };

  assert.deepEqual(diagram2ImageEffectiveClip(cropped), {
    x: 140,
    y: 70,
    width: 300,
    height: 190
  });
  assert.deepEqual(diagram2ImageCropInsets(cropped), {
    top: 20,
    right: 60,
    bottom: 30,
    left: 40
  });
  assert.equal(diagram2ImageHasReversibleCrop(cropped), true);
  assert.equal(diagram2ImageHasReversibleCrop({ ...cropped, cropVisible: false }), true);
  assert.deepEqual(resizeDiagram2CropClip(cropped, "se", { x: 1000, y: 1000 }), {
    x: 140,
    y: 70,
    width: 360,
    height: 220
  });
  assert.deepEqual(diagram2CropCornerPatch(cropped, {
    topLeft: 12,
    topRight: 12,
    bottomRight: 12,
    bottomLeft: 12
  }), {
    cropCornerRadius: 12,
    cropCornerRadii: null
  });
  assert.deepEqual(diagram2CropCornerPatch({
    ...cropped,
    cropCornerRadius: 28
  }, {
    topLeft: 12,
    topRight: 28,
    bottomRight: 28,
    bottomLeft: 28
  }), {
    cropCornerRadius: 0,
    cropCornerRadii: {
      topLeft: 12,
      topRight: 28,
      bottomRight: 28,
      bottomLeft: 28
    }
  });
  assert.equal(diagram2CropCornerPatch({
    ...cropped,
    width: 1000,
    height: 1000,
    imageClip: { x: 100, y: 50, width: 1000, height: 1000 }
  }, {
    topLeft: 500,
    topRight: 500,
    bottomRight: 500,
    bottomLeft: 500
  }).cropCornerRadius, 200);
  assert.deepEqual(diagram2ResetCropPatch(cropped).imageClip, {
    x: 100,
    y: 50,
    width: 400,
    height: 240
  });
  assert.deepEqual(diagram2ResetCropRadiusPatch(), {
    cropCornerRadius: 0,
    cropCornerRadii: null
  });
});

test("Diagram 2 Crop numeric scheduling commits one trailing burst and restores selection separately", async () => {
  assert.equal(diagram2CropNumericDebounceMilliseconds, 200);
  assert.equal(diagram2CropSelectionQuietMilliseconds, 1000);
  const timers = createFakeTimers();
  const committed = [];
  let selectionSuppressed = false;
  let cropOverlayVisible = true;
  const scheduler = createDiagram2CropNumericAdjustmentScheduler({
    timers,
    begin: () => {
      selectionSuppressed = true;
      cropOverlayVisible = false;
    },
    commit: adjustment => {
      committed.push(adjustment);
      return true;
    },
    cancel: () => {
      selectionSuppressed = false;
      cropOverlayVisible = true;
    },
    end: () => {
      selectionSuppressed = false;
      cropOverlayVisible = true;
    }
  });

  for (let value = 1; value <= 20; value += 1) {
    scheduler.schedule({
      imageId: "crop-screen",
      values: {
        insets: { left: 10, right: 12, top: 8, bottom: 6 },
        corners: {
          topLeft: value,
          topRight: value,
          bottomRight: value,
          bottomLeft: value
        }
      }
    });
    if (value < 20) timers.advance(10);
  }

  assert.equal(scheduler.diagnostics().inputEventCount, 20);
  assert.equal(scheduler.diagnostics().commitCount, 0);
  assert.equal(committed.length, 0);
  assert.equal(selectionSuppressed, true);
  assert.equal(cropOverlayVisible, false);

  timers.advance(diagram2CropNumericDebounceMilliseconds - 1);
  await Promise.resolve();
  assert.equal(committed.length, 0);

  timers.advance(1);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(committed, [{
    imageId: "crop-screen",
    values: {
      insets: { left: 10, right: 12, top: 8, bottom: 6 },
      corners: {
        topLeft: 20,
        topRight: 20,
        bottomRight: 20,
        bottomLeft: 20
      }
    }
  }]);
  assert.equal(scheduler.diagnostics().debounceFiringCount, 1);
  assert.equal(scheduler.diagnostics().commitCount, 1);
  assert.equal(selectionSuppressed, true);
  assert.equal(cropOverlayVisible, false);

  timers.advance(
    diagram2CropSelectionQuietMilliseconds
      - diagram2CropNumericDebounceMilliseconds
      - 1
  );
  assert.equal(selectionSuppressed, true);
  assert.equal(cropOverlayVisible, false);
  timers.advance(1);
  assert.equal(selectionSuppressed, false);
  assert.equal(cropOverlayVisible, true);
  assert.equal(scheduler.diagnostics().pendingTimerCount, 0);
  assert.equal(scheduler.diagnostics().timerCleanupCount, 2);
});

test("Diagram 2 Crop flush waits for an in-flight blur commit before Save", async () => {
  const timers = createFakeTimers();
  let releaseCommit;
  const commitGate = new Promise(resolve => {
    releaseCommit = resolve;
  });
  const scheduler = createDiagram2CropNumericAdjustmentScheduler({
    timers,
    commit: async () => {
      await commitGate;
      return true;
    }
  });
  scheduler.schedule({
    imageId: "crop-screen",
    values: {
      insets: { left: 20, right: 10, top: 5, bottom: 5 },
      corners: { topLeft: 12, topRight: 12, bottomRight: 12, bottomLeft: 12 }
    }
  });
  timers.advance(diagram2CropNumericDebounceMilliseconds);
  await Promise.resolve();
  assert.equal(scheduler.diagnostics().pendingCommit, true);

  let saveFlushFinished = false;
  const saveFlush = scheduler.flushAndEnd("save").then(() => {
    saveFlushFinished = true;
  });
  await Promise.resolve();
  assert.equal(saveFlushFinished, false);
  releaseCommit();
  await saveFlush;
  assert.equal(saveFlushFinished, true);
  assert.equal(scheduler.diagnostics().commitCount, 1);
  assert.equal(scheduler.diagnostics().pendingCommit, false);
});

test("Diagram 2 image resources decode once, share cache entries, and clean up", () => {
  const createdImages = [];
  const revoked = [];
  const manager = createDiagram2ImageResourceManager({
    imageFactory: () => {
      const listeners = new Map();
      const image = {
        naturalWidth: 800,
        naturalHeight: 450,
        source: "",
        addEventListener(name, listener) {
          listeners.set(name, listener);
        },
        removeEventListener(name, listener) {
          if (listeners.get(name) === listener) listeners.delete(name);
        },
        set src(value) {
          this.source = value;
        },
        get src() {
          return this.source;
        },
        emit(name) {
          listeners.get(name)?.();
        }
      };
      createdImages.push(image);
      return image;
    },
    revokeObjectURL: value => revoked.push(value)
  });

  manager.retain("image-a", imageSource);
  manager.retain("image-b", imageSource);
  assert.equal(manager.diagnostics().decodeCount, 1);
  assert.equal(manager.diagnostics().cacheHitCount, 1);
  createdImages[0].emit("load");
  assert.equal(manager.statusForObject("image-a").status, "ready");
  assert.equal(manager.statusForObject("image-a").width, 800);

  manager.release("image-a");
  assert.equal(manager.diagnostics().cachedImageCount, 1);
  manager.release("image-b");
  assert.equal(manager.diagnostics().cachedImageCount, 0);

  manager.retain("blob-image", "blob:pmt-phase6-image");
  manager.release("blob-image");
  assert.deepEqual(revoked, ["blob:pmt-phase6-image"]);
  assert.equal(manager.diagnostics().resourceReleaseCount, 3);
  manager.destroy();
});

function createFakeTimers() {
  let now = 0;
  let sequence = 0;
  const callbacks = new Map();
  return {
    setTimeout(callback, delay) {
      sequence += 1;
      callbacks.set(sequence, {
        callback,
        dueAt: now + Math.max(0, Number(delay) || 0)
      });
      return sequence;
    },
    clearTimeout(id) {
      callbacks.delete(id);
    },
    advance(milliseconds) {
      const target = now + Math.max(0, Number(milliseconds) || 0);
      while (true) {
        const next = [...callbacks.entries()]
          .filter(([, timer]) => timer.dueAt <= target)
          .sort((left, right) => left[1].dueAt - right[1].dueAt || left[0] - right[0])[0];
        if (!next) break;
        const [id, timer] = next;
        callbacks.delete(id);
        now = timer.dueAt;
        timer.callback();
      }
      now = target;
    }
  };
}

test("Diagram 2 Entity annotations preserve owner, child, and group indexes", () => {
  const state = phase6State();
  const plan = createDiagram2EntityAnnotationPlan(
    state,
    "entity-tasks",
    "The task record shown in the screenshot.",
    { showArrow: true }
  );

  assert.ok(plan);
  assert.equal(plan.ownerId, "entity-tasks");
  assert.equal(plan.afterObjects.some(object => object.id === "entity-tasks"), true);
  const children = plan.afterObjects.filter(object => object.entityAnnotationOwnerId === "entity-tasks");
  assert.equal(children.length >= 1, true);
  assert.equal(children.every(object => object.entityAnnotationGroupId || object.groupId), true);

  const indexes = createDiagram2EntityAnnotationIndexes(plan.afterObjects);
  assert.deepEqual(indexes.childrenByOwnerId.get("entity-tasks").sort(), children.map(object => object.id).sort());
  assert.equal(children.every(object =>
    indexes.ownerIdByChildId.get(object.id) === "entity-tasks"), true);

  const removal = createDiagram2EntityAnnotationPlan({
    ...state,
    objects: plan.afterObjects,
    groupNames: plan.afterGroupNames,
    groupVisibility: plan.afterGroupVisibility
  }, "entity-tasks", "", { showArrow: true });
  assert.equal(removal.afterObjects.some(object => object.entityAnnotationOwnerId === "entity-tasks"), false);
});

test("Diagram 2 Field Rectangles preserve virtual Entity mapping metadata", () => {
  const fieldRectangle = mappedFieldRectangle();
  assert.equal(fieldRectangle.entityKind, "field-rectangle");
  assert.equal(fieldRectangle.fields.length, 1);
  assert.equal(diagram2FieldRectangleMapping(fieldRectangle).referencedEntity, "pmt.Tasks");
  assert.equal(diagram2FieldRectangleMapping(fieldRectangle).referencedField, "TaskId");

  const renamed = renameDiagram2FieldRectangle(fieldRectangle, "TaskKey");
  assert.equal(renamed.fields[0].name, "TaskKey");
  assert.equal(diagram2FieldRectangleMapping(renamed).referencedField, "TaskId");
  assert.equal(diagram2FieldMappingIdentity(renamed), "mapping:field-task:taskkey");

  const left = setDiagram2FieldRectangleConnectionSide(renamed, "left");
  assert.equal(left.fieldRectangleConnectionSide, "left");
  assert.equal(setDiagram2FieldRectangleMapping(left, null).foreignKeys.length, 0);
});

test("Diagram 2 mapping indexes expose required targets, tables, rows, and routes", () => {
  const state = phase6MappedState();
  const indexes = createDiagram2FieldMappingIndexes(state.objects);
  const mappingId = "mapping:field-task:taskid";
  const table = state.objects.find(object => object.type === "field-mapping-table");
  const rowKey = `${table.id}:${mappingId}`;

  assert.equal(indexes.mappingIdByFieldRectangleId.get("field-task"), mappingId);
  assert.deepEqual(indexes.mappingIdsByFieldRectangleId.get("field-task"), [mappingId]);
  assert.deepEqual(indexes.mappingIdsByTargetEntityId.get("entity-tasks"), [mappingId]);
  assert.deepEqual(
    indexes.mappingIdsByEntityField.get(
      diagram2EntityFieldMappingKey("entity-tasks", "TaskId")
    ),
    [mappingId]
  );
  assert.deepEqual(indexes.mappingIdsBySourceImageId.get("screen"), [mappingId]);
  assert.deepEqual(indexes.mappingIdsByTableId.get(table.id), [mappingId]);
  assert.deepEqual(indexes.tableRowKeysByMappingId.get(mappingId), [rowKey]);
  assert.equal(indexes.highlightTargetsByRowKey.get(rowKey).targetId, "entity-tasks");

  setDiagram2FieldMappingRouteIndex(indexes, mappingId, {
    relationshipId: indexes.mappingsById.get(mappingId).relationshipId,
    bounds: { x: 200, y: 100, width: 400, height: 120 }
  });
  assert.equal(indexes.mappingRouteBoundsById.get(mappingId).width, 400);
  assert.deepEqual(diagram2MappingAttentionTargets(indexes, mappingId), {
    mappingId,
    sourceId: "field-task",
    targetId: "entity-tasks",
    sourceImageIds: ["screen"],
    tableRowKeys: [rowKey]
  });
});

test("Diagram 2 patches one mapping and keyed table row without a full index scan", () => {
  const state = phase6MappedState();
  const table = state.objects.find(object => object.type === "field-mapping-table");
  const previous = state.objects.find(object => object.id === "field-task");
  const next = setDiagram2FieldRectangleMapping(previous, {
    referencedEntity: "pmt.Tasks",
    referencedField: "Title",
    relationshipType: "many-to-one"
  });
  const indexes = createDiagram2FieldMappingIndexes(state.objects);
  const beforeDiagnostics = diagram2FieldMappingIndexDiagnostics(indexes);
  const result = patchDiagram2FieldMappingIndexes(indexes, {
    previousObject: previous,
    nextObject: next
  });

  assert.equal(result.objectVisitCount, 0);
  assert.deepEqual(result.affectedFieldRectangleIds, ["field-task"]);
  assert.deepEqual(result.affectedTableIds, [table.id]);
  assert.equal(
    indexes.mappingIdsByEntityField.has(
      diagram2EntityFieldMappingKey("entity-tasks", "TaskId")
    ),
    false
  );
  assert.deepEqual(
    indexes.mappingIdsByEntityField.get(
      diagram2EntityFieldMappingKey("entity-tasks", "Title")
    ),
    ["mapping:field-task:taskid"]
  );

  const updatedTable = syncDiagram2FieldMappingTableForFieldRectangle(table, next, indexes);
  assert.notEqual(updatedTable, table);
  assert.equal(updatedTable.rows.length, 1);
  assert.equal(updatedTable.rows[0].databaseField, "pmt.Tasks.Title");
  assert.equal(
    diagram2FieldMappingTableRowKey(table.id, table.rows[0]),
    diagram2FieldMappingTableRowKey(updatedTable.id, updatedTable.rows[0])
  );
  const diagnostics = diagram2FieldMappingIndexDiagnostics(indexes);
  assert.equal(diagnostics.mappingIndexFullBuildCount, beforeDiagnostics.mappingIndexFullBuildCount);
  assert.equal(diagnostics.mappingIndexIncrementalPatchCount, 1);
  assert.equal(diagnostics.mappingIndexIncrementalObjectVisitCount, 0);
});

test("Diagram 2 Field Mapping Tables synchronize only the changed image region", () => {
  const state = phase6MappedState();
  const table = state.objects.find(object => object.type === "field-mapping-table");
  const image = state.objects.find(object => object.id === "screen");
  const indexes = createDiagram2FieldMappingIndexes(state.objects);
  const hiddenRegion = {
    ...image,
    imageClip: { x: image.x + 300, y: image.y, width: 180, height: image.height }
  };
  const updated = syncDiagram2FieldMappingTableForImage(table, hiddenRegion, indexes);

  assert.notEqual(updated, table);
  assert.deepEqual(updated.rows, []);
  assert.equal(updated.sourceImageId, "screen");
});

test("Diagram 2 Mapping pane groups come from live mappings with or without a canvas table", () => {
  const state = phase6MappedState();
  const groups = diagram2FieldMappingPaneGroups(createDiagram2FieldMappingIndexes(state.objects));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, "");
  assert.equal(groups[0].rows[0].tableId, "mapping-table");
  assert.deepEqual(groups[0].rows.map(row => ({
    uiField: row.uiField,
    databaseField: row.databaseField
  })), [{
    uiField: "TaskId",
    databaseField: "pmt.Tasks.TaskId"
  }]);

  const withoutTable = state.objects.filter(object => object.type !== "field-mapping-table");
  const ungrouped = diagram2FieldMappingPaneGroups(createDiagram2FieldMappingIndexes(withoutTable));
  assert.equal(ungrouped.length, 1);
  assert.equal(ungrouped[0].rows[0].tableId, "");
  assert.equal(ungrouped[0].rows[0].mappingId, "mapping:field-task:taskid");

  const grouped = diagram2FieldMappingPaneGroups(
    createDiagram2FieldMappingIndexes(state.objects),
    { groupByTable: true }
  );
  assert.equal(grouped[0].name, "pmt.Tasks");
  assert.equal(grouped[0].rows[0].databaseTable, "pmt.Tasks");
  assert.equal(diagram2FieldMappingPaneGroups(
    createDiagram2FieldMappingIndexes(state.objects),
    { search: "TASKS.TASK" }
  ).length, 1);
  const renamedUiObjects = state.objects.map(object =>
    object.id === "field-task" ? renameDiagram2FieldRectangle(object, "Screen task number") : object);
  assert.equal(diagram2FieldMappingPaneGroups(
    createDiagram2FieldMappingIndexes(renamedUiObjects),
    { search: "TASK NUMBER" }
  ).length, 1);
  assert.deepEqual(diagram2FieldMappingPaneGroups(
    createDiagram2FieldMappingIndexes(state.objects),
    { search: "not present" }
  ), []);
});

test("Diagram 2 Mapping pane alphabetical sorting is reversible", () => {
  const image = createDiagram2EmbeddedImage({
    id: "sort-screen",
    source: imageSource,
    x: 0,
    y: 0,
    width: 500,
    height: 320
  });
  const entity = (id, name, fields) => ({
    id,
    type: "entity",
    x: 700,
    y: id === "entity-zeta" ? 20 : 240,
    width: 240,
    height: 160,
    entitySchema: "pmt",
    entityName: name,
    fields: fields.map(field => ({ name: field, dataType: "INT" })),
    foreignKeys: []
  });
  const mappedRectangle = (id, name, y, table, field) => setDiagram2FieldRectangleMapping(
    createDiagram2FieldRectangle({ id, name, x: 40, y, width: 180, height: 40 }),
    { referencedEntity: `pmt.${table}`, referencedField: field }
  );
  const indexes = createDiagram2FieldMappingIndexes([
    image,
    entity("entity-zeta", "Zeta", ["ZuluId", "AlphaId"]),
    entity("entity-alpha", "Alpha", ["MiddleId"]),
    mappedRectangle("field-zulu", "Zulu UI", 20, "Zeta", "ZuluId"),
    mappedRectangle("field-alpha", "Alpha UI", 80, "Zeta", "AlphaId"),
    mappedRectangle("field-middle", "Middle UI", 140, "Alpha", "MiddleId")
  ]);

  const original = diagram2FieldMappingPaneGroups(indexes, { groupByTable: true });
  assert.deepEqual(original.map(group => group.name), ["pmt.Zeta", "pmt.Alpha"]);
  assert.deepEqual(original[0].rows.map(row => row.uiField), ["Zulu UI", "Alpha UI"]);

  const alphabetical = diagram2FieldMappingPaneGroups(indexes, {
    groupByTable: true,
    alphabetical: true
  });
  assert.deepEqual(alphabetical.map(group => group.name), ["pmt.Alpha", "pmt.Zeta"]);
  assert.deepEqual(alphabetical[1].rows.map(row => row.uiField), ["Alpha UI", "Zulu UI"]);

  const restored = diagram2FieldMappingPaneGroups(indexes, { groupByTable: true });
  assert.deepEqual(restored, original);
});

test("Diagram 2 keeps Mapping pane and canvas-table rows synchronized with database field changes", async () => {
  const controller = createDiagram2EditorController({
    renderer: fakeRenderer(),
    host: editableHost(),
    state: phase6MappedState()
  });

  controller.setSelection(["entity-tasks"]);
  const selectedMapping = controller.selectFieldMapping("mapping:field-task:taskid");
  assert.deepEqual(selectedMapping.selectedIds, []);
  assert.deepEqual(controller.selectedObjectIds(), []);

  assert.equal(await controller.updateEntityField("entity-tasks", 0, { name: "WorkTaskId" }), true);
  const renamedRectangle = controller.getObjectById("field-task");
  const renamedTable = controller.getObjectById("mapping-table");
  const renamedGroups = diagram2FieldMappingPaneGroups(controller.fieldMappingIndexes());
  assert.equal(diagram2FieldRectangleMapping(renamedRectangle).referencedField, "WorkTaskId");
  assert.equal(renamedTable.rows[0].databaseField, "pmt.Tasks.WorkTaskId");
  assert.equal(renamedGroups[0].rows[0].databaseField, "pmt.Tasks.WorkTaskId");

  assert.equal(await controller.undo(), true);
  assert.equal(diagram2FieldRectangleMapping(controller.getObjectById("field-task")).referencedField, "TaskId");
  assert.equal(controller.getObjectById("mapping-table").rows[0].databaseField, "pmt.Tasks.TaskId");

  assert.equal(await controller.moveObjects(["field-task"], 600, 0), true);
  assert.deepEqual(controller.getObjectById("mapping-table").rows, []);
  assert.equal(diagram2FieldMappingPaneGroups(controller.fieldMappingIndexes())[0].rows[0].uiField, "TaskId");
  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("mapping-table").rows[0].uiField, "TaskId");

  assert.equal(await controller.removeEntityField("entity-tasks", 0), true);
  assert.equal(diagram2FieldRectangleMapping(controller.getObjectById("field-task")), null);
  assert.deepEqual(controller.getObjectById("mapping-table").rows, []);
  assert.deepEqual(diagram2FieldMappingPaneGroups(controller.fieldMappingIndexes()), []);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("mapping-table").rows[0].databaseField, "pmt.Tasks.TaskId");

  controller.setSelection(["entity-tasks"]);
  assert.equal(await controller.deleteSelectedObjects(), true);
  assert.equal(controller.getObjectById("entity-tasks"), null);
  assert.equal(diagram2FieldRectangleMapping(controller.getObjectById("field-task")), null);
  assert.deepEqual(controller.getObjectById("mapping-table").rows, []);
  assert.deepEqual(diagram2FieldMappingPaneGroups(controller.fieldMappingIndexes()), []);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.getObjectById("entity-tasks").entityName, "Tasks");
  assert.equal(diagram2FieldRectangleMapping(controller.getObjectById("field-task")).referencedField, "TaskId");
  assert.equal(controller.getObjectById("mapping-table").rows[0].databaseField, "pmt.Tasks.TaskId");
});

test("Diagram 2 Phase 6 objects survive file, clipboard, and template round trips", async () => {
  const state = phase6MappedState();
  const fileText = createDiagram2PmtDiagramFile({ state, name: "Phase 6" });
  const reopened = parseDiagram2PmtDiagramFile(fileText);
  assert.equal(reopened.state.objects.some(object => object.type === "embedded-image"), true);
  assert.equal(reopened.state.objects.some(object => object.entityKind === "field-rectangle"), true);
  assert.equal(reopened.state.objects.some(object => object.type === "field-mapping-table"), true);

  const selectedIds = state.objects.map(object => object.id);
  const clipboardText = createDiagram2SelectionClipboardText({
    state,
    selectedObjectIds: selectedIds
  });
  const parsed = parseDiagram2SelectionClipboardText(clipboardText);
  const remapped = remapDiagram2SelectionClipboardPackageIds(parsed, {
    existingObjectIds: selectedIds,
    idFactory: oldId => `phase6-copy-${oldId}`,
    pasteOffset: { x: 20, y: 20 }
  });
  const remappedField = remapped.selection.objects.find(object => object.entityKind === "field-rectangle");
  const remappedTable = remapped.selection.objects.find(object => object.type === "field-mapping-table");
  assert.notEqual(remappedField.id, "field-task");
  assert.equal(remappedTable.rows[0].uiEntityId, remappedField.id);
  assert.notEqual(remappedTable.sourceImageId, "screen");

  const template = await captureDiagram2SelectionTemplate(state, selectedIds, "Phase 6");
  const instantiated = instantiateDiagram2TemplateObjects(template, { x: 1800, y: 900 }, selectedIds);
  assert.equal(instantiated.objects.some(object => object.type === "embedded-image"), true);
  assert.equal(instantiated.objects.some(object => object.entityKind === "field-rectangle"), true);
  assert.equal(instantiated.objects.some(object => object.type === "field-mapping-table"), true);
});

test("Diagram 2 controller keeps the Phase 6 workflow command-based and undoable", async () => {
  const renderer = fakeRenderer();
  const state = phase6State();
  const controller = createDiagram2EditorController({
    renderer,
    host: editableHost(),
    state
  });

  assert.equal(await controller.updateEmbeddedImageCrop("screen", {
    imageClip: { x: 20, y: 10, width: 430, height: 300 },
    cropCornerRadius: 10
  }), true);
  assert.equal(controller.getObjectById("screen").imageClip.width, 430);

  assert.equal(await controller.setEntityAnnotation(
    "entity-tasks",
    "Task database record",
    { showArrow: true }
  ), true);
  assert.equal(controller.currentState().objects.some(object =>
    object.entityAnnotationOwnerId === "entity-tasks"), true);

  assert.equal(await controller.addFieldRectangle(
    { x: 170, y: 110 },
    { id: "field-controller", name: "UI Task", width: 180, height: 70 }
  ), true);
  assert.equal(await controller.setFieldRectangleMapping("field-controller", {
    referencedEntity: "pmt.Tasks",
    referencedField: "TaskId",
    relationshipType: "many-to-one"
  }), true);
  assert.equal(controller.getObjectById("field-controller").fields[0].name, "TaskId");

  assert.equal(await controller.addFieldMappingTable("screen"), true);
  const table = controller.currentState().objects.find(object => object.type === "field-mapping-table");
  assert.ok(table);
  assert.equal(table.rows.some(row => row.uiEntityId === "field-controller"), true);
  assert.equal(controller.fieldMappingIndexes().mappingsById.size, 1);
  assert.equal(renderer.fullRenderCount, 0);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.currentState().objects.some(object => object.type === "field-mapping-table"), false);
  assert.equal(await controller.redo(), true);
  assert.equal(controller.currentState().objects.some(object => object.type === "field-mapping-table"), true);
});

test("Diagram 2 keeps localized mapping index work bounded at 500 and 1,000 objects", () => {
  [500, 1000].forEach(objectCount => {
    const state = largeMappedState(objectCount);
    const indexes = createDiagram2FieldMappingIndexes(state.objects);
    const previous = indexes.fieldRectanglesById.get("field-large");
    const next = setDiagram2FieldRectangleMapping(previous, {
      referencedEntity: "pmt.Target",
      referencedField: "Name",
      relationshipType: "many-to-one"
    });
    const start = performance.now();
    const result = patchDiagram2FieldMappingIndexes(indexes, {
      previousObject: previous,
      nextObject: next
    });
    const duration = performance.now() - start;
    const diagnostics = diagram2FieldMappingIndexDiagnostics(indexes);

    assert.equal(result.changedObjectCount, 1);
    assert.equal(result.objectVisitCount, 0);
    assert.equal(diagnostics.mappingIndexFullBuildObjectVisitCount, objectCount);
    assert.equal(diagnostics.mappingIndexIncrementalObjectVisitCount, 0);
    assert.equal(indexes.mappingsById.get("mapping:field-large:targetid").targetField, "Name");
    assert.equal(duration < 100, true);
    console.info("DIAGRAM2_PHASE6_LOCAL_MAPPING_METRICS", JSON.stringify({
      objectCount,
      durationMs: Math.round(duration * 100) / 100,
      fullBuildObjectVisitCount: diagnostics.mappingIndexFullBuildObjectVisitCount,
      incrementalObjectVisitCount: diagnostics.mappingIndexIncrementalObjectVisitCount
    }));
  });
});

test("Diagram 2 Phase 6 hosts share one adapter and hover avoids broad scans", async () => {
  const rendererSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-renderer.js", import.meta.url),
    "utf8"
  );
  const topNavSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2.js", import.meta.url),
    "utf8"
  );
  const rteSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js", import.meta.url),
    "utf8"
  );
  const hoverSource = rendererSource.slice(
    rendererSource.indexOf("function showFieldMappingHover"),
    rendererSource.indexOf("function clearFieldMappingHover")
  );

  assert.match(topNavSource, /createDiagram2Phase6Host/);
  assert.match(rteSource, /createDiagram2Phase6Host/);
  assert.doesNotMatch(hoverSource, /querySelectorAll/);
  assert.doesNotMatch(hoverSource, /diagram2CanonicalRelationships/);
  assert.doesNotMatch(hoverSource, /canonicalState\.objects\.find/);
  [
    "data-diagram2-background-plane",
    "data-diagram2-image-plane",
    "data-diagram2-relationship-plane",
    "data-diagram2-field-relationship-plane",
    "data-diagram2-field-rectangle-plane",
    "data-diagram2-mapping-table-plane",
    "data-diagram2-mapping-highlight-plane",
    "data-diagram2-selection-plane",
    "data-diagram2-gesture-plane"
  ].forEach(marker => assert.match(rendererSource, new RegExp(marker)));
});

function phase6State() {
  return normalizeAnnotationState({
    version: 1,
    width: 1400,
    height: 800,
    objects: [
      createDiagram2EmbeddedImage({
        id: "screen",
        name: "Task Screen",
        source: imageSource,
        x: 0,
        y: 0,
        width: 500,
        height: 320
      }),
      targetEntity()
    ]
  });
}

function phase6MappedState() {
  const base = phase6State();
  const fieldRectangle = mappedFieldRectangle();
  const objects = [...base.objects, fieldRectangle];
  const indexes = createDiagram2FieldMappingIndexes(objects);
  const table = createDiagram2FieldMappingTable({
    ...base,
    objects
  }, "screen", {
    id: "mapping-table",
    x: 760,
    y: 400,
    indexes
  });
  return normalizeAnnotationState({
    ...base,
    objects: [...objects, table]
  });
}

function mappedFieldRectangle() {
  return setDiagram2FieldRectangleMapping(createDiagram2FieldRectangle({
    id: "field-task",
    name: "TaskId",
    x: 80,
    y: 80,
    width: 180,
    height: 70
  }), {
    referencedEntity: "pmt.Tasks",
    referencedField: "TaskId",
    relationshipType: "many-to-one"
  });
}

function targetEntity() {
  return {
    id: "entity-tasks",
    type: "entity",
    x: 800,
    y: 80,
    width: 280,
    height: 180,
    entitySchema: "pmt",
    entityName: "Tasks",
    fields: [
      {
        name: "TaskId",
        dataType: "INT",
        nullable: false,
        isPrimaryKey: true,
        isImportant: true
      },
      {
        name: "Title",
        dataType: "NVARCHAR(200)",
        nullable: false,
        isImportant: true
      }
    ],
    foreignKeys: []
  };
}

function largeMappedState(objectCount) {
  const fillerCount = Math.max(0, objectCount - 4);
  const fillers = Array.from({ length: fillerCount }, (_, index) => ({
    id: `entity-${index}`,
    type: "entity",
    x: 1200 + ((index % 20) * 260),
    y: Math.floor(index / 20) * 140,
    width: 220,
    height: 100,
    entitySchema: "pmt",
    entityName: `Entity${index}`,
    fields: [{ name: "Id", dataType: "INT", isPrimaryKey: true }],
    foreignKeys: []
  }));
  const image = createDiagram2EmbeddedImage({
    id: "screen-large",
    source: imageSource,
    x: 0,
    y: 0,
    width: 800,
    height: 500
  });
  const target = {
    id: "entity-target",
    type: "entity",
    x: 900,
    y: 80,
    width: 240,
    height: 130,
    entitySchema: "pmt",
    entityName: "Target",
    fields: [
      { name: "TargetId", dataType: "INT", isPrimaryKey: true },
      { name: "Name", dataType: "NVARCHAR(100)" }
    ],
    foreignKeys: []
  };
  const fieldRectangle = setDiagram2FieldRectangleMapping(createDiagram2FieldRectangle({
    id: "field-large",
    name: "TargetId",
    x: 120,
    y: 100,
    width: 180,
    height: 70
  }), {
    referencedEntity: "pmt.Target",
    referencedField: "TargetId",
    relationshipType: "many-to-one"
  });
  const baseObjects = [image, target, fieldRectangle, ...fillers];
  const indexes = createDiagram2FieldMappingIndexes(baseObjects);
  const table = createDiagram2FieldMappingTable({
    width: 8000,
    height: 8000,
    objects: baseObjects
  }, image.id, {
    id: "mapping-table-large",
    indexes
  });
  return normalizeAnnotationState({
    width: 8000,
    height: 8000,
    objects: [...baseObjects, table]
  });
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

function fakeRenderer() {
  return {
    fullRenderCount: 0,
    updatedObjectIds: [],
    addedObjectIds: [],
    removedObjectIds: [],
    beginDiagramUpdate() {},
    endDiagramUpdate() {},
    updateObject(id) {
      this.updatedObjectIds.push(id);
    },
    addObject(object) {
      this.addedObjectIds.push(object.id);
    },
    addObjects(objects) {
      objects.forEach(object => this.addedObjectIds.push(object.id));
    },
    removeObject(id) {
      this.removedObjectIds.push(id);
    },
    removeObjects(ids) {
      ids.forEach(id => this.removedObjectIds.push(id));
    },
    setStructureState() {},
    setObjectOrder() {},
    setSelectedIds(ids) {
      this.selectedIds = [...ids];
      return {};
    },
    setCanvasOptions() {}
  };
}
