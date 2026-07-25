import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildAnnotationSvg,
  buildPortableAnnotationSelectionSvg,
  normalizeAnnotationState,
  normalizeAnnotationTemplateLibrary,
  parseAnnotationSvg
} from "../../wwwroot/js/components/image-annotation.js";
import {
  createPmtDiagramFile,
  parsePmtDiagramFile,
  pmtDiagramFileFormat,
  pmtDiagramFileVersion
} from "../../wwwroot/js/features/diagram/pmt-diagram-file.js";

async function readFixture(name) {
  const contents = await readFile(
    new URL(`../fixtures/diagram-compatibility/${name}`, import.meta.url),
    "utf8"
  );
  return JSON.parse(contents);
}

test("PMT Diagram file constants stay compatible with Diagram 1 and Diagram 2", () => {
  assert.equal(pmtDiagramFileFormat, "pmt-diagram");
  assert.equal(pmtDiagramFileVersion, 1);
});

test("PMT Diagram files preserve editable state and reject unsupported versions", () => {
  const state = {
    width: 900,
    height: 600,
    objects: [{ id: "text-1", type: "textbox", x: 10, y: 20, width: 200, height: 90, text: "Portable" }]
  };
  const contents = createPmtDiagramFile({
    title: "Portable Diagram",
    state,
    exportedAt: "2026-07-21T00:00:00.000Z"
  });
  const raw = JSON.parse(contents);
  assert.equal(raw.format, pmtDiagramFileFormat);
  assert.equal(raw.formatVersion, pmtDiagramFileVersion);
  assert.deepEqual(raw.extensions, {});
  assert.deepEqual(raw.diagram.extensions, {});

  const restored = parsePmtDiagramFile(contents);
  assert.equal(restored.title, "Portable Diagram");
  assert.equal(restored.state.objects[0].text, "Portable");
  assert.match(restored.svg, /data-pmt-image-annotation-state="true"/);

  raw.formatVersion = pmtDiagramFileVersion + 1;
  assert.throws(() => parsePmtDiagramFile(JSON.stringify(raw)), /not supported/);
  assert.throws(() => parsePmtDiagramFile("not json"), /not valid PMT Diagram JSON/);
});

test("Diagram 1 synthetic export fixture round-trips through the shared PMT Diagram codec", async () => {
  const fixture = await readFixture("diagram1-synthetic-export.pmt-diagram.json");
  const restored = parsePmtDiagramFile(JSON.stringify(fixture));

  assert.equal(restored.title, "Diagram 1 Synthetic Compatibility");
  assert.deepEqual(restored.state.objects.map(object => object.id), ["compat-rectangle", "compat-textbox"]);
  assert.match(restored.svg, /data-pmt-image-annotation-state="true"/);

  const roundTripped = parsePmtDiagramFile(createPmtDiagramFile({
    title: restored.title,
    state: restored.state,
    exportedAt: fixture.exportedAt
  }));
  assert.deepEqual(roundTripped.state.objects.map(object => object.id), restored.state.objects.map(object => object.id));
});

test("mixed Diagram state preserves rich text, manual relationship routes, Field Mapping Tables, Field Rectangles, collapsed Entities, and data types", async () => {
  const state = normalizeAnnotationState(await readFixture("mixed-diagram-state.json"));
  const workTasks = state.objects.find(object => object.id === "mixed-worktasks");
  const richText = state.objects.find(object => object.id === "mixed-rich-note");
  const fieldRectangle = state.objects.find(object => object.id === "mixed-title-field");
  const fieldMappingTable = state.objects.find(object => object.id === "mixed-field-map-table");

  assert.equal(state.manualEntityRelationshipRoutes, true);
  assert.equal(workTasks.collapsed, true);
  assert.equal(workTasks.showDataTypes, true);
  assert.equal(workTasks.foreignKeys[0].routeOverride.length, 4);
  assert.equal(richText.type, "rich-text");
  assert.match(richText.html, /Rich text/);
  assert.equal(fieldRectangle.type, "entity");
  assert.equal(fieldRectangle.entityKind, "field-rectangle");
  assert.equal(fieldRectangle.name, "Field: Title");
  assert.equal(fieldRectangle.fieldRectangleConnectionSide, "bottom");
  assert.equal(fieldRectangle.foreignKeys[0].relationshipType, "many-to-one");
  assert.equal(fieldRectangle.foreignKeys[0].styleOverride.opacity, 0.65);
  assert.equal(fieldMappingTable.type, "field-mapping-table");
  assert.equal(fieldMappingTable.sourceImageId, "mixed-task-screen");
  assert.equal(fieldMappingTable.fieldMappingHighlightColor, "#facc15");
  assert.equal(fieldMappingTable.fieldMappingHighlightStrokeWidth, 9);
  assert.deepEqual(fieldMappingTable.rows, [{
    uiEntityId: "mixed-title-field",
    uiField: "Title",
    databaseField: "pmt.Projects.Title"
  }]);

  const restored = parseAnnotationSvg(buildAnnotationSvg(state));
  const restoredWorkTasks = restored.objects.find(object => object.id === "mixed-worktasks");
  const restoredRichText = restored.objects.find(object => object.id === "mixed-rich-note");
  const restoredFieldRectangle = restored.objects.find(object => object.id === "mixed-title-field");
  const restoredFieldMappingTable = restored.objects.find(object => object.id === "mixed-field-map-table");

  assert.equal(restored.manualEntityRelationshipRoutes, true);
  assert.equal(restoredWorkTasks.collapsed, true);
  assert.equal(restoredWorkTasks.showDataTypes, true);
  assert.deepEqual(restoredWorkTasks.foreignKeys[0].routeOverride, workTasks.foreignKeys[0].routeOverride);
  assert.match(restoredRichText.html, /Schema note/);
  assert.equal(restoredFieldRectangle.entityKind, "field-rectangle");
  assert.equal(restoredFieldRectangle.fieldRectangleName, "Title");
  assert.equal(restoredFieldRectangle.fieldRectangleConnectionSide, "bottom");
  assert.equal(restoredFieldRectangle.foreignKeys[0].relationshipType, "many-to-one");
  assert.equal(restoredFieldRectangle.foreignKeys[0].styleOverride.stroke, "#22c55e");
  assert.deepEqual(restoredFieldMappingTable.rows, fieldMappingTable.rows);
  assert.equal(restoredFieldMappingTable.fieldMappingHighlightColor, "#facc15");
  assert.equal(restoredFieldMappingTable.fieldMappingHighlightStrokeWidth, 9);
});

test("Object Template library fixture normalizes through the shared template schema", async () => {
  const library = normalizeAnnotationTemplateLibrary(await readFixture("template-library-sample.json"));

  assert.equal(library.version, 1);
  assert.equal(library.templates.length, 1);
  assert.equal(library.templates[0].name, "Green Box");
  assert.deepEqual(library.templates[0].objects.map(object => object.type), ["rectangle"]);
  assert.deepEqual(library.defaults, { arrow: null, rectangle: null, fieldRectangleRelationship: null });
});

test("portable copy fixtures preserve ordinary shapes and related Entities", async () => {
  const ordinary = await readFixture("selection-ordinary-shapes.json");
  const ordinarySvg = await buildPortableAnnotationSelectionSvg(
    ordinary.state,
    new Set(ordinary.selectedObjectIds)
  );
  assert.match(ordinarySvg, /<rect x="120" y="140" width="240" height="130"/);
  assert.match(ordinarySvg, /stroke="#126bff"/);
  assert.match(ordinarySvg, /stroke="#f59e0b"/);
  assert.match(ordinarySvg, /Copied/);

  const relatedEntities = await readFixture("selection-related-entities.json");
  const entitySvg = await buildPortableAnnotationSelectionSvg(
    relatedEntities.state,
    new Set(relatedEntities.selectedObjectIds)
  );
  assert.match(entitySvg, /pmt\.Projects/);
  assert.match(entitySvg, /pmt\.WorkTasks/);
  assert.match(entitySvg, /<path d="M 660 212\.45 H 520 V 186\.35 H 380"/);
});

test("bundled PMT schema Diagram 1 fixture remains parseable", async () => {
  const svg = await readFile(new URL("../../wwwroot/assets/docs/pmt-database-schema.svg", import.meta.url), "utf8");
  const state = parseAnnotationSvg(svg);

  assert.equal(state.objects.length, 88);
  assert.equal(state.objects.filter(object => object.type === "entity").length, 29);
  assert.equal(
    state.objects.filter(object => object.type === "entity")
      .reduce((sum, object) => sum + (Array.isArray(object.foreignKeys) ? object.foreignKeys.length : 0), 0),
    82
  );
});
