import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import test from "node:test";
import {
  annotationArrowGeometry,
  normalizeAnnotationState,
  parseAnnotationSvg
} from "../../wwwroot/js/components/image-annotation.js";
import {
  createDiagram2DirtyState,
  createDiagram2FixedGridIndex,
  createDiagram2LiveView,
  diagram2CanonicalRelationships,
  diagram2CanonicalSummary,
  diagram2ContentBounds,
  diagram2FitViewportTransform,
  diagram2ObjectPatchFlags,
  diagram2ScreenToWorldPoint,
  diagram2WorldToScreenPoint,
  diagram2ZoomAtTransform
} from "../../wwwroot/js/features/diagram2/diagram2-renderer.js";
import {
  createDiagram2RelationshipRouteModel,
  diagram2RelationshipRouteFromModel,
  diagram2RelationshipRouteKey
} from "../../wwwroot/js/features/diagram2/diagram2-routing.js";

test("Diagram 2 dirty state keeps explicit invalidation categories", () => {
  const dirty = createDiagram2DirtyState();

  assert.equal(dirty.objectGeometry instanceof Set, true);
  assert.equal(dirty.objectStructure instanceof Set, true);
  assert.equal(dirty.objectStyle instanceof Set, true);
  assert.equal(dirty.objectSelection instanceof Set, true);
  assert.equal(dirty.relationshipGeometry instanceof Set, true);
  assert.equal(dirty.relationshipStyle instanceof Set, true);
  assert.equal(dirty.zOrder, false);
  assert.equal(dirty.worldBounds, false);
  assert.equal(dirty.sectors, false);
});

test("Diagram 2 fixed grid index returns only nearby route candidates", () => {
  const index = createDiagram2FixedGridIndex(100);

  index.add("near-a", { x: 20, y: 20, width: 60, height: 60 });
  index.add("near-b", { x: 140, y: 40, width: 40, height: 40 });
  index.add("far", { x: 640, y: 640, width: 50, height: 50 });

  const local = index.query({ x: 0, y: 0, width: 220, height: 120 });
  assert.deepEqual([...local.ids].sort(), ["near-a", "near-b"]);
  assert.equal(local.sectorKeys.length > 0, true);

  index.remove("near-a");
  assert.deepEqual([...index.query({ x: 0, y: 0, width: 90, height: 90 }).ids], []);
});

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
      }, {
        name: "ParentTaskId",
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
      }, {
        name: "FK_pmt_Tasks_ParentTask",
        columns: ["ParentTaskId"],
        referencedSchema: "pmt",
        referencedTable: "Tasks",
        referencedColumns: ["TaskId"],
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
  assert.equal(relationships.some(item => item.source === item.target), false);

  const selfRelationshipState = normalizeAnnotationState({
    ...state,
    objects: state.objects.map(object => object.id === "entity-tasks"
      ? { ...object, showSelfRelationships: true }
      : object)
  });
  const relationshipsWithSelf = diagram2CanonicalRelationships(selfRelationshipState);
  assert.equal(relationshipsWithSelf.length, 2);
  assert.equal(relationshipsWithSelf.some(item =>
    item.source.id === "entity-tasks" && item.target.id === "entity-tasks"), true);
});

test("Diagram 2 relationship routing module returns stable normalized route geometry", () => {
  const state = normalizeAnnotationState({
    width: 900,
    height: 560,
    compactEntityRelationshipRouting: true,
    relationshipStyle: { showSymbols: true },
    objects: [{
      id: "entity-projects",
      type: "entity",
      x: 80,
      y: 90,
      width: 260,
      height: 120,
      entitySchema: "pmt",
      entityName: "Projects",
      fields: [{ name: "ProjectId", dataType: "INT", nullable: false, isPrimaryKey: true }]
    }, {
      id: "entity-tasks",
      type: "entity",
      x: 560,
      y: 270,
      width: 280,
      height: 150,
      entitySchema: "pmt",
      entityName: "Tasks",
      fields: [
        { name: "TaskId", dataType: "INT", nullable: false, isPrimaryKey: true },
        { name: "ProjectId", dataType: "INT", nullable: false, isForeignKey: true }
      ],
      foreignKeys: [{
        name: "FK_Tasks_Projects",
        columns: ["ProjectId"],
        referencedSchema: "pmt",
        referencedTable: "Projects",
        referencedColumns: ["ProjectId"],
        relationshipType: "many-to-one"
      }]
    }]
  });

  const relationship = diagram2CanonicalRelationships(state)[0];
  const model = createDiagram2RelationshipRouteModel(state, { compactRouting: true });
  const route = diagram2RelationshipRouteFromModel(relationship, model);

  assert.ok(diagram2RelationshipRouteKey(relationship));
  assert.ok(route);
  assert.equal(route.relationshipType, "many-to-one");
  assert.equal(route.points.length >= 2, true);
  assert.match(route.path, /^M /);
  assert.equal(route.bounds.width > 0, true);
  assert.equal(route.bounds.height > 0, true);
  assert.equal(model.geometryByKey.has(diagram2RelationshipRouteKey(relationship)), true);
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
  assert.equal(summary.canonicalRelationshipCount, 78);
});

test("Diagram 2 PMT schema fixture generation stays under one second", async () => {
  const svg = await readFile(
    new URL("../../wwwroot/assets/docs/pmt-database-schema.svg", import.meta.url),
    "utf8"
  );

  const startedAt = performance.now();
  const state = parseAnnotationSvg(svg);
  const summary = diagram2CanonicalSummary(state);
  const bounds = diagram2ContentBounds(state);
  const transform = diagram2FitViewportTransform(state, { width: 1536, height: 740 }, {
    padding: 0,
    scaleStep: 0.05
  });
  const elapsed = performance.now() - startedAt;

  assert.equal(summary.canonicalRelationshipCount, 78);
  assert.ok(bounds);
  assert.equal(Number.isFinite(transform.scale), true);
  assert.equal(elapsed < 1000, true, `Diagram 2 PMT schema generation took ${Math.round(elapsed)}ms`);
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

test("Diagram 2 fit uses visible content bounds instead of the full canvas", () => {
  const state = normalizeAnnotationState({
    width: 1600,
    height: 900,
    objects: [{
      id: "hello",
      type: "textbox",
      x: 700,
      y: 420,
      width: 120,
      height: 40,
      text: "Hello World",
      outlineVisible: false
    }]
  });

  assert.deepEqual(diagram2ContentBounds(state), { x: 700, y: 420, width: 120, height: 40 });
  const transform = diagram2FitViewportTransform(state, { width: 1000, height: 700 }, { padding: 16 });

  assert.equal(transform.scale, 2);
  assert.equal(diagram2WorldToScreenPoint(transform, { x: 760, y: 440 }).x, 500);
  assert.equal(diagram2WorldToScreenPoint(transform, { x: 760, y: 440 }).y, 350);
});

test("Diagram 2 fit centers content inside the visible pane-adjusted area", () => {
  const state = normalizeAnnotationState({
    width: 1600,
    height: 900,
    objects: [{
      id: "box",
      type: "rectangle",
      x: 700,
      y: 420,
      width: 120,
      height: 40,
      fill: "none",
      stroke: "#172b4d"
    }]
  });
  const transform = diagram2FitViewportTransform(state, { width: 1000, height: 700 }, {
    padding: 16,
    inset: { left: 320 }
  });

  assert.equal(diagram2WorldToScreenPoint(transform, { x: 760, y: 440 }).x, 660);
  assert.equal(diagram2WorldToScreenPoint(transform, { x: 760, y: 440 }).y, 350);
});

test("Diagram 2 fit falls back to canvas bounds for empty diagrams", () => {
  const state = normalizeAnnotationState({
    width: 1600,
    height: 900,
    objects: []
  });
  const transform = diagram2FitViewportTransform(state, { width: 1000, height: 700 }, { padding: 16 });

  assert.equal(transform.scale, 0.605);
  assert.equal(Math.round(transform.translateX), 16);
  assert.equal(Math.round(transform.translateY), 78);
});

test("Diagram 2 renderer fit stays off Diagram 1 output-bound and export paths", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-renderer.js", import.meta.url),
    "utf8"
  );

  assert.equal(source.includes("annotationOutputBounds"), false);
  assert.equal(source.includes("buildAnnotationSvg"), false);
  assert.equal(source.includes("annotationEntityRelationshipRenderModel"), false);
});

test("Diagram 2 simple object strokes scale like Diagram 1 SVG output", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-renderer.js", import.meta.url),
    "utf8"
  );
  const simpleObjectSource = source.slice(
    source.indexOf("function renderFieldRectangleObject"),
    source.indexOf("function renderFieldMappingTableObject")
  );
  const renderConnectorSource = source.slice(
    source.indexOf("function renderConnector"),
    source.indexOf("function renderTextboxObject")
  );
  const entitySource = source.slice(
    source.indexOf("function renderEntityObject"),
    source.indexOf("function renderFieldRectangleObject")
  );

  assert.match(renderConnectorSource, /annotationArrowGeometry\(object\)/);
  assert.doesNotMatch(simpleObjectSource, /"vector-effect": "non-scaling-stroke"/);
  assert.doesNotMatch(renderConnectorSource, /"vector-effect": "non-scaling-stroke"/);
  assert.doesNotMatch(entitySource, /"vector-effect": "non-scaling-stroke"/);
});

test("Diagram 2 relationship lines adopt Diagram 1 route painting rules", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-renderer.js", import.meta.url),
    "utf8"
  );
  const relationshipPatchSource = source.slice(
    source.indexOf("function patchRelationshipNode"),
    source.indexOf("function lowDetailRelationshipRoute")
  );
  const relationshipHelperSource = source.slice(
    source.indexOf("function patchRelationshipNode"),
    source.indexOf("function relationshipMarkerGeometry")
  );
  const relationshipOverlaySource = source.slice(
    source.indexOf("function patchSelectedRelationshipOverlay"),
    source.indexOf("function unmountViewportHaloRelationshipNode")
  );
  const relationshipRouteSource = source.slice(
    source.indexOf("function relationshipRoute"),
    source.indexOf("function diagram2PointListText")
  );
  const geometryPreviewSource = source.slice(
    source.indexOf("function patchGeometryRelationshipPreviews"),
    source.indexOf("function restoreGeometryPreviewRelationships")
  );

  assert.match(source, /function diagram2MergedRelationshipRouteGroups/);
  assert.match(relationshipPatchSource, /diagram2-renderer-relationship-hit-path/);
  assert.match(relationshipPatchSource, /image-annotation-entity-relationship-hit/);
  assert.match(relationshipOverlaySource, /data-diagram2-relationship-route-overlay-id/);
  assert.match(relationshipOverlaySource, /image-annotation-entity-relationship-selection/);
  assert.match(relationshipHelperSource, /image-annotation-entity-relationship-marker/);
  assert.match(relationshipHelperSource, /image-annotation-entity-relationship-handle/);
  assert.match(relationshipPatchSource, /"vector-effect": null/);
  assert.match(relationshipRouteSource, /relationshipLane\(start\.x, end\.x, relationship, relationships\)/);
  assert.match(relationshipRouteSource, /relationshipPairIndex\(relationship, relationships\)/);
  assert.match(relationshipRouteSource, /snapRelationshipRouteValue/);
  assert.match(relationshipRouteSource, /compactRelationshipRoutePoints/);
  assert.match(geometryPreviewSource, /patchMergedRelationshipRoutes/);
  assert.match(geometryPreviewSource, /patchRelationshipNode/);
  assert.doesNotMatch(geometryPreviewSource, /data-diagram2-relationship-preview-path/);
});

test("Diagram 2 style patches remove stale non-scaling strokes from simple objects", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-renderer.js", import.meta.url),
    "utf8"
  );
  const patchSource = source.slice(
    source.indexOf("function patchSimpleObjectStyles"),
    source.indexOf("function renderEntityObject")
  );
  const entityPatchSource = source.slice(
    source.indexOf("function patchEntityObjectNodeStyles"),
    source.indexOf("function patchSimpleObjectStyles")
  );

  ["diagram2-renderer-field-rectangle", "diagram2-renderer-rectangle", "diagram2-renderer-circle",
    "diagram2-renderer-textbox-frame", "diagram2-renderer-arrow-shaft", "diagram2-renderer-line"].forEach(className => {
    assert.match(patchSource, new RegExp(className));
  });
  assert.match(patchSource, /"vector-effect": null/);
  assert.match(entityPatchSource, /"vector-effect": null/);
});

test("Diagram 2 detailed Entity rendering follows Diagram 1 visual layout", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-renderer.js", import.meta.url),
    "utf8"
  );
  const renderEntitySource = source.slice(
    source.indexOf("function renderEntityObject"),
    source.indexOf("function renderLowDetailEntityObject")
  );

  assert.match(renderEntitySource, /annotationEntityMetrics\(object\)/);
  assert.match(renderEntitySource, /metrics\.headerHeight \* 0\.68/);
  assert.match(renderEntitySource, /metrics\.rowHeight \* 0\.68/);
  assert.match(renderEntitySource, /metrics\.fontSize \* 1\.05/);
  assert.match(renderEntitySource, /"text-decoration": field\.isPrimaryKey \? "underline" : null/);
  assert.match(renderEntitySource, /"data-diagram2-entity-rule": "primary-key"/);
  assert.doesNotMatch(renderEntitySource, /"data-diagram2-entity-rule": "row"/);
});

test("Diagram 2 content bounds include the actual arrow head geometry", () => {
  const arrow = {
    id: "red-arrow",
    type: "arrow",
    x1: 100,
    y1: 100,
    x2: 260,
    y2: 100,
    stroke: "#ff0000",
    strokeWidth: 20,
    arrowSize: 60
  };
  const bounds = diagram2ContentBounds(normalizeAnnotationState({
    width: 1600,
    height: 900,
    objects: [arrow]
  }));
  const geometry = annotationArrowGeometry(arrow);

  assert.equal(bounds.x <= arrow.x1, true);
  assert.equal(bounds.x + bounds.width >= arrow.x2, true);
  geometry.headPoints.forEach(point => {
    assert.equal(point.x >= bounds.x && point.x <= bounds.x + bounds.width, true);
    assert.equal(point.y >= bounds.y && point.y <= bounds.y + bounds.height, true);
  });
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
