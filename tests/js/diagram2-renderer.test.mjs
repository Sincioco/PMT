import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeAnnotationState,
  parseAnnotationSvg
} from "../../wwwroot/js/components/image-annotation.js";
import {
  createDiagram2LiveView,
  diagram2CanonicalRelationships,
  diagram2CanonicalSummary,
  diagram2ObjectPatchFlags,
  diagram2ScreenToWorldPoint,
  diagram2WorldToScreenPoint,
  diagram2ZoomAtTransform
} from "../../wwwroot/js/features/diagram2/diagram2-renderer.js";

test("Diagram 2 live view keeps renderer-only state out of the canonical model", () => {
  const canonical = normalizeAnnotationState({
    width: 800,
    height: 600,
    objects: []
  });
  const liveView = createDiagram2LiveView();

  liveView.objectNodesById.set("entity-a", { nodeType: 1 });
  liveView.relationshipNodesById.set("relationship-a", { nodeType: 1 });
  liveView.mountedObjectIds.add("entity-a");
  liveView.mountedRelationshipIds.add("relationship-a");
  liveView.selectedIds.add("entity-a");
  liveView.objectVersionsById.set("entity-a", "v1");
  liveView.relationshipVersionsById.set("relationship-a", "v1");
  liveView.objectDataById.set("entity-a", { id: "entity-a" });
  liveView.relationshipDataById.set("relationship-a", { id: "relationship-a" });

  assert.equal(Object.hasOwn(canonical, "objectNodesById"), false);
  assert.equal(Object.hasOwn(canonical, "relationshipNodesById"), false);
  assert.equal(Object.hasOwn(canonical, "mountedObjectIds"), false);
  assert.equal(Object.hasOwn(canonical, "mountedRelationshipIds"), false);
  assert.equal(Object.hasOwn(canonical, "selectedIds"), false);
  assert.equal(Object.hasOwn(canonical, "objectDataById"), false);
  assert.equal(Object.hasOwn(canonical, "relationshipDataById"), false);
  assert.equal(liveView.objectNodesById instanceof Map, true);
  assert.equal(liveView.mountedObjectIds instanceof Set, true);
  assert.equal(liveView.objectDataById instanceof Map, true);
});

test("Diagram 2 derives canonical entity relationships without Diagram 1 render output", () => {
  const state = normalizeAnnotationState({
    width: 1000,
    height: 700,
    objects: [{
      id: "entity-users",
      type: "entity",
      x: 80,
      y: 120,
      width: 240,
      height: 120,
      entitySchema: "pmt",
      entityName: "Users",
      fields: [{
        name: "UserId",
        dataType: "INT",
        nullable: false,
        isPrimaryKey: true,
        isImportant: true
      }]
    }, {
      id: "entity-tasks",
      type: "entity",
      x: 500,
      y: 120,
      width: 260,
      height: 150,
      entitySchema: "pmt",
      entityName: "Tasks",
      fields: [{
        name: "TaskId",
        dataType: "INT",
        nullable: false,
        isPrimaryKey: true,
        isImportant: true
      }, {
        name: "AssignedToUserId",
        dataType: "INT",
        nullable: true,
        isForeignKey: true
      }],
      foreignKeys: [{
        name: "FK_pmt_Tasks_AssignedTo",
        columns: ["AssignedToUserId"],
        referencedSchema: "pmt",
        referencedTable: "Users",
        referencedColumns: ["UserId"],
        relationshipType: "many-to-one"
      }]
    }]
  });

  const relationships = diagram2CanonicalRelationships(state);

  assert.equal(relationships.length, 1);
  assert.equal(relationships[0].source.id, "entity-tasks");
  assert.equal(relationships[0].sourceField.name, "AssignedToUserId");
  assert.equal(relationships[0].target.id, "entity-users");
  assert.equal(relationships[0].targetField.name, "UserId");
});

test("Diagram 2 summarizes the current PMT schema fixture for renderer diagnostics", async () => {
  const svg = await readFile(
    new URL("../../wwwroot/assets/docs/pmt-database-schema.svg", import.meta.url),
    "utf8"
  );
  const state = parseAnnotationSvg(svg);
  const summary = diagram2CanonicalSummary(state);

  assert.equal(summary.canonicalObjectCount, 88);
  assert.ok(summary.canonicalEntityCount >= 28);
  assert.equal(summary.canonicalRelationshipCount, 82);
});

test("Diagram 2 viewport zoom preserves the world point under the cursor", () => {
  const transform = {
    scale: 0.75,
    translateX: 120,
    translateY: -40
  };
  const cursor = { x: 420, y: 260 };
  const worldBefore = diagram2ScreenToWorldPoint(transform, cursor);
  const next = diagram2ZoomAtTransform(transform, 1.25, cursor);
  const screenAfter = diagram2WorldToScreenPoint(next, worldBefore);

  assert.equal(Math.abs(screenAfter.x - cursor.x) <= 0.000001, true);
  assert.equal(Math.abs(screenAfter.y - cursor.y) <= 0.000001, true);
  assert.deepEqual(worldBefore, diagram2ScreenToWorldPoint(next, screenAfter));
});

test("Diagram 2 object patch flags keep entity moves transform-only", () => {
  const previous = normalizeAnnotationState({
    width: 800,
    height: 600,
    objects: [{
      id: "entity-a",
      type: "entity",
      x: 80,
      y: 120,
      width: 240,
      height: 120,
      entitySchema: "pmt",
      entityName: "Users",
      fill: "#ffffff",
      entityHeaderFill: "#dbeafe",
      fields: [{
        name: "UserId",
        dataType: "INT",
        nullable: false,
        isPrimaryKey: true,
        isImportant: true
      }]
    }]
  }).objects[0];
  const moved = {
    ...previous,
    x: previous.x + 32,
    y: previous.y + 18
  };
  const recolored = {
    ...previous,
    fill: "#fff7ed",
    entityHeaderFill: "#fed7aa"
  };
  const collapsed = {
    ...previous,
    collapsed: true
  };

  assert.deepEqual(diagram2ObjectPatchFlags(previous, moved), {
    changed: true,
    created: false,
    typeChanged: false,
    transformChanged: true,
    structureChanged: false,
    styleChanged: false,
    textChanged: false,
    rebuild: false
  });
  assert.equal(diagram2ObjectPatchFlags(previous, recolored).styleChanged, true);
  assert.equal(diagram2ObjectPatchFlags(previous, recolored).rebuild, false);
  assert.equal(diagram2ObjectPatchFlags(previous, collapsed).structureChanged, true);
  assert.equal(diagram2ObjectPatchFlags(previous, collapsed).rebuild, true);
});
