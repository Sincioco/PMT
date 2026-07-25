import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createDiagram2PmtDiagramFile,
  createDiagram2SelectionClipboardText,
  diagram2CompatibilityContract,
  diagram2CompatibilityProbe,
  loadDiagram2DefaultTemplateLibrary,
  loadDiagram2TemplateLibrary,
  normalizeDiagram2TemplateLibrary,
  parseDiagram2PmtDiagramFile,
  parseDiagram2SelectionClipboardText,
  remapDiagram2SelectionClipboardPackageIds,
  saveDiagram2TemplateLibrary
} from "../../wwwroot/js/features/diagram2/diagram2-compatibility.js";
import {
  createDiagramSelectionClipboardPackage,
  createPmtDiagramFile,
  diagramSelectionClipboardFormat,
  diagramSelectionClipboardPlainTextHeader,
  diagramSelectionClipboardVersion,
  normalizeDiagramState,
  normalizeDiagramTemplateLibrary,
  parseDiagramSelectionClipboardPackage,
  parsePmtDiagramFile,
  remapDiagramSelectionClipboardPackageIds,
  serializeDiagramSelectionClipboardPackage
} from "../../wwwroot/js/shared/diagram-contracts.js";

async function readFixture(name) {
  const contents = await readFile(
    new URL(`../fixtures/diagram-compatibility/${name}`, import.meta.url),
    "utf8"
  );
  return JSON.parse(contents);
}

test("Diagram 2 exposes the same template endpoints and no renderer-cache storage", () => {
  assert.equal(diagram2CompatibilityContract.feature, "Diagram 2");
  assert.equal(diagram2CompatibilityContract.documentType, "Diagram");
  assert.equal(diagram2CompatibilityContract.resource, "Documentation");
  assert.equal(diagram2CompatibilityContract.duplicateDatabaseRecords, false);
  assert.equal(diagram2CompatibilityContract.endpoints.templateLibrary, "/api/image-annotation/template-library");
  assert.equal(diagram2CompatibilityContract.endpoints.defaultTemplateLibrary, "/api/image-annotation/default-template-library");
  assert.equal(diagram2CompatibilityContract.fileFormat, "pmt-diagram");
  assert.equal(diagram2CompatibilityContract.fileFormatVersion, 1);
  assert.equal(diagram2CompatibilityContract.selectionClipboardFormat, "pmt-diagram-selection");
  assert.equal(diagram2CompatibilityContract.selectionClipboardVersion, 1);
  assert.equal(diagram2CompatibilityContract.persistedRendererCaches, false);
});

test("Diagram 2 template adapter normalizes every current template object type through the shared schema", async () => {
  const library = {
    version: 1,
    extensions: { futureLibraryMetadata: true },
    defaults: {
      arrow: { stroke: "#126bff", strokeWidth: 3, arrowSize: 18, opacity: 0.8 },
      rectangle: { fill: "none", stroke: "#22c55e", strokeWidth: 4, outlineVisible: true, opacity: 0.7 },
      fieldRectangleRelationship: { stroke: "#f59e0b", strokeWidth: 3, arrowSize: 16, opacity: 0.65 }
    },
    templates: templateObjects().map((object, index) => ({
      id: `template-${index}`,
      name: `Template ${object.type}${object.entityKind ? ` ${object.entityKind}` : ""}`,
      objects: [object],
      extensions: { futureTemplateMetadata: { index } }
    }))
  };

  let stored = null;
  const saved = await saveDiagram2TemplateLibrary(async nextLibrary => {
    stored = nextLibrary;
    return nextLibrary;
  }, library);
  const loaded = await loadDiagram2TemplateLibrary(async () => stored);
  const loadedDefaults = await loadDiagram2DefaultTemplateLibrary(async () => saved);
  const diagram1Normalized = normalizeDiagramTemplateLibrary(saved);

  assert.deepEqual(
    saved.templates.map(template => template.objects[0].type),
    ["embedded-image", "rectangle", "circle", "arrow", "line", "textbox", "rich-text", "entity", "entity", "field-mapping-table"]
  );
  assert.equal(saved.templates[8].objects[0].entityKind, "field-rectangle");
  assert.equal(saved.templates[9].objects[0].type, "field-mapping-table");
  assert.deepEqual(saved.extensions, { futureLibraryMetadata: true });
  assert.deepEqual(saved.templates[0].extensions, { futureTemplateMetadata: { index: 0 } });
  assert.deepEqual(loaded, saved);
  assert.deepEqual(loadedDefaults, saved);
  assert.deepEqual(diagram1Normalized, saved);
});

test("Diagram 2 clipboard text can be parsed and remapped by Diagram 1, and Diagram 1 text can be parsed by Diagram 2", () => {
  const state = normalizeDiagramState(complexClipboardState());
  const selectedObjectIds = state.objects.map(object => object.id);
  const diagram2Text = createDiagram2SelectionClipboardText({
    state,
    selectedObjectIds
  });
  const diagram1Parsed = parseDiagramSelectionClipboardPackage(diagram2Text);
  const diagram1Remapped = remapDiagramSelectionClipboardPackageIds(diagram1Parsed, {
    existingObjectIds: ["diagram1-projects"],
    idFactory: oldId => `diagram1-${oldId}`,
    pasteIndex: 2,
    pasteOffset: { x: 6, y: 8 }
  });
  const diagram1FieldMappingTable = diagram1Remapped.selection.objects.find(object => object.type === "field-mapping-table");

  assert.equal(diagram1Parsed.source.feature, "Diagram 2");
  assert.equal(diagram1Parsed.selection.objects.length, selectedObjectIds.length);
  assert.equal(diagram1Parsed.selection.relationships.length, 2);
  assert.equal(Object.keys(diagram1Parsed.selection.manualRelationshipRoutes).length, 1);
  assert.equal(diagram1Remapped.selection.objects.some(object => object.id === "diagram1-projects-1"), true);
  assert.equal(diagram1FieldMappingTable.sourceImageId, "diagram1-screen");
  assert.equal(diagram1FieldMappingTable.rows[0].uiEntityId, "diagram1-ui-title");
  assert.equal(diagram1Remapped.selection.groupNames["callout-group-copy"], "Entity annotation");
  assert.equal(diagram1Remapped.selection.groupVisibility["shape-group-copy"], false);

  const diagram1Package = createDiagramSelectionClipboardPackage({
    state,
    selectedObjectIds,
    sourceFeature: "Diagram"
  });
  const diagram1Text = serializeDiagramSelectionClipboardPackage(diagram1Package);
  const diagram2Parsed = parseDiagram2SelectionClipboardText(diagram1Text);
  const diagram2Remapped = remapDiagram2SelectionClipboardPackageIds(diagram2Parsed, {
    idFactory: oldId => `diagram2-${oldId}`,
    pasteIndex: 1,
    pasteOffset: { x: 10, y: 10 }
  });
  const diagram2FieldRectangle = diagram2Remapped.selection.objects.find(object => object.id === "diagram2-ui-title");

  assert.equal(diagram2Parsed.source.feature, "Diagram");
  assert.equal(diagram2Parsed.selection.objects.some(object => object.type === "rich-text"), true);
  assert.equal(diagram2Parsed.selection.objects.some(object => object.locked), true);
  assert.equal(diagram2FieldRectangle.foreignKeys[0].relationshipType, "many-to-one");
  assert.equal(diagram2FieldRectangle.foreignKeys[0].styleOverride.stroke, "#22c55e");
});

test("Diagram 2 clipboard adapter rejects newer packages clearly", () => {
  const futurePackage = {
    format: diagramSelectionClipboardFormat,
    formatVersion: diagramSelectionClipboardVersion + 1,
    minimumReaderVersion: diagramSelectionClipboardVersion + 1,
    source: { application: "PMT", feature: "Diagram 2" },
    selection: { objects: [] },
    extensions: {}
  };

  assert.throws(
    () => parseDiagram2SelectionClipboardText(`${diagramSelectionClipboardPlainTextHeader}\n${JSON.stringify(futurePackage)}`),
    /PMT Diagram selection version 2 is not supported\./
  );
});

test("Diagram 2 PMT Diagram file adapter passes the Diagram 1 and Diagram 2 matrix without leaking live renderer state", async () => {
  const oldDiagram1Fixture = await readFile(
    new URL("../fixtures/diagram-compatibility/diagram1-synthetic-export.pmt-diagram.json", import.meta.url),
    "utf8"
  );
  const mixed = await readFixture("mixed-diagram-state.json");
  const stateWithRendererCache = {
    ...mixed,
    diagram2RendererCache: { mountedObjectIds: ["mixed-projects"] },
    objects: mixed.objects.map(object => ({ ...object, diagram2LiveNodeId: `node-${object.id}` }))
  };
  const oldDiagram1InDiagram2 = parseDiagram2PmtDiagramFile(oldDiagram1Fixture);
  const newDiagram1Export = createPmtDiagramFile({
    title: "Diagram 1 Export",
    state: mixed,
    generatorFeature: "Diagram",
    diagramExtensions: { futureDiagramData: { keep: true } }
  });
  const diagram2Export = createDiagram2PmtDiagramFile({
    title: "Diagram 2 Export",
    state: stateWithRendererCache,
    diagramExtensions: { futureDiagramData: { keep: true } },
    extensions: { futureFileData: { keep: true } },
    exportedAt: "2026-07-25T00:00:00.000Z"
  });
  const rawDiagram2Export = JSON.parse(diagram2Export);
  const newDiagram1InDiagram2 = parseDiagram2PmtDiagramFile(newDiagram1Export);
  const diagram2InDiagram1 = parsePmtDiagramFile(diagram2Export);
  const diagram2InDiagram2 = parseDiagram2PmtDiagramFile(diagram2Export);

  assert.equal(oldDiagram1InDiagram2.title, "Diagram 1 Synthetic Compatibility");
  assert.equal(newDiagram1InDiagram2.generator.feature, "Diagram");
  assert.equal(rawDiagram2Export.generator.feature, "Diagram 2");
  assert.equal(rawDiagram2Export.diagram.editorState.diagram2RendererCache, undefined);
  assert.equal(rawDiagram2Export.diagram.editorState.objects.some(object => object.diagram2LiveNodeId), false);
  assert.deepEqual(diagram2InDiagram1.diagramExtensions, { futureDiagramData: { keep: true } });
  assert.deepEqual(diagram2InDiagram2.extensions, { futureFileData: { keep: true } });
  assert.deepEqual(diagram2InDiagram1.state, diagram2InDiagram2.state);
  assert.deepEqual(newDiagram1InDiagram2.state, normalizeDiagramState(mixed));
  assert.equal(diagram2InDiagram2.state.objects.find(object => object.id === "mixed-field-map-table").type, "field-mapping-table");
  assert.equal(diagram2InDiagram2.state.objects.find(object => object.id === "mixed-title-field").entityKind, "field-rectangle");
});

test("Diagram 2 compatibility probe uses the same file and clipboard contracts", async () => {
  const mixed = await readFixture("mixed-diagram-state.json");
  const probe = diagram2CompatibilityProbe(mixed, {
    selectedObjectIds: ["mixed-projects", "mixed-worktasks", "mixed-field-map-table"]
  });

  assert.equal(probe.feature, "Diagram 2");
  assert.equal(probe.fileFormat, "pmt-diagram");
  assert.equal(probe.fileReadableByDiagram, true);
  assert.equal(probe.fileReadableByDiagram2, true);
  assert.equal(probe.selectionClipboardFormat, "pmt-diagram-selection");
  assert.equal(probe.selectionClipboardSourceFeature, "Diagram 2");
  assert.equal(probe.selectionClipboardObjectCount, 3);
  assert.equal(probe.templateLibraryEndpoint, "/api/image-annotation/template-library");
  assert.equal(probe.persistedRendererCaches, false);
});

function templateObjects() {
  const imageSource = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='120'%20height='80'%3E%3Crect%20width='120'%20height='80'%20fill='%23e0f2fe'/%3E%3C/svg%3E";
  return [
    { id: "template-image", type: "embedded-image", x: 20, y: 20, width: 120, height: 80, source: imageSource },
    { id: "template-rect", type: "rectangle", x: 20, y: 20, width: 120, height: 80, fill: "none", stroke: "#126bff" },
    { id: "template-circle", type: "circle", x: 20, y: 20, width: 120, height: 120, fill: "#ffffff", stroke: "#22c55e" },
    { id: "template-arrow", type: "arrow", x1: 20, y1: 20, x2: 180, y2: 80, stroke: "#f59e0b", strokeWidth: 4, arrowSize: 18 },
    { id: "template-line", type: "line", x1: 20, y1: 20, x2: 180, y2: 20, stroke: "#64748b", strokeWidth: 3 },
    { id: "template-text", type: "textbox", x: 20, y: 20, width: 180, height: 80, text: "Template text", fontSize: 18 },
    { id: "template-rich", type: "rich-text", x: 20, y: 20, width: 240, height: 120, html: "<p><strong>Rich</strong> text</p>" },
    {
      id: "template-entity",
      type: "entity",
      x: 20,
      y: 20,
      width: 260,
      height: 140,
      entitySchema: "pmt",
      entityName: "Projects",
      fields: [{ name: "ProjectId", dataType: "INT", nullable: false, isPrimaryKey: true }]
    },
    {
      id: "template-field-rectangle",
      type: "entity",
      entityKind: "field-rectangle",
      fieldRectangleName: "Title",
      x: 20,
      y: 20,
      width: 140,
      height: 34,
      fields: [{ name: "Title", isForeignKey: true, isImportant: true }]
    },
    {
      id: "template-field-map-table",
      type: "field-mapping-table",
      x: 20,
      y: 20,
      sourceImageId: "template-image",
      rows: [{
        uiEntityId: "template-field-rectangle",
        uiField: "Title",
        databaseField: "pmt.Projects.Title"
      }]
    }
  ];
}

function complexClipboardState() {
  const imageSource = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='420'%20height='180'%3E%3Crect%20width='420'%20height='180'%20fill='%23f8fafc'/%3E%3Ctext%20x='24'%20y='80'%20font-size='24'%3ETitle%3C/text%3E%3C/svg%3E";
  return {
    width: 1400,
    height: 900,
    manualEntityRelationshipRoutes: true,
    groupNames: {
      "shape-group": "Mixed shapes",
      "callout-group": "Entity annotation"
    },
    groupVisibility: {
      "shape-group": false,
      "callout-group": true
    },
    objects: [
      {
        id: "screen",
        type: "embedded-image",
        groupId: "shape-group",
        locked: true,
        x: 80,
        y: 560,
        width: 420,
        height: 180,
        source: imageSource
      },
      { id: "shape-rect", type: "rectangle", groupId: "shape-group", x: 100, y: 80, width: 140, height: 80, fill: "none", stroke: "#126bff" },
      { id: "shape-circle", type: "circle", x: 270, y: 80, width: 90, height: 90, fill: "#ffffff", stroke: "#22c55e" },
      { id: "shape-text", type: "textbox", x: 390, y: 80, width: 220, height: 80, text: "Plain text", fontSize: 20 },
      { id: "shape-rich", type: "rich-text", x: 640, y: 80, width: 260, height: 120, html: "<p><strong>Rich</strong> text</p>" },
      {
        id: "projects",
        type: "entity",
        entityAnnotationGroupId: "callout-group",
        x: 120,
        y: 260,
        width: 300,
        height: 130,
        entitySchema: "pmt",
        entityName: "Projects",
        fields: [
          { name: "ProjectId", dataType: "INT", nullable: false, isPrimaryKey: true },
          { name: "Title", dataType: "NVARCHAR(220)", nullable: false }
        ]
      },
      {
        id: "worktasks",
        type: "entity",
        x: 700,
        y: 260,
        width: 340,
        height: 160,
        entitySchema: "pmt",
        entityName: "WorkTasks",
        collapsed: true,
        showDataTypes: true,
        fields: [
          { name: "TaskId", dataType: "INT", nullable: false, isPrimaryKey: true },
          { name: "ProjectId", dataType: "INT", nullable: false, isForeignKey: true },
          { name: "Title", dataType: "NVARCHAR(220)", nullable: false }
        ],
        foreignKeys: [{
          name: "FK_WorkTasks_Projects",
          columns: ["ProjectId"],
          referencedSchema: "pmt",
          referencedTable: "Projects",
          referencedColumns: ["ProjectId"],
          relationshipType: "one-to-many",
          routeOverride: [
            { x: 700, y: 318 },
            { x: 560, y: 318 },
            { x: 560, y: 295 },
            { x: 420, y: 295 }
          ]
        }]
      },
      { id: "callout", type: "textbox", groupId: "callout-group", entityAnnotationOwnerId: "projects", entityAnnotationRole: "callout", x: 160, y: 430, width: 240, height: 80, text: "Entity annotation" },
      { id: "callout-arrow", type: "arrow", groupId: "callout-group", entityAnnotationOwnerId: "projects", entityAnnotationRole: "arrow", x1: 290, y1: 430, x2: 280, y2: 370 },
      {
        id: "ui-title",
        type: "entity",
        entityKind: "field-rectangle",
        fieldRectangleName: "Title",
        fieldRectangleConnectionSide: "bottom",
        x: 205,
        y: 650,
        width: 148,
        height: 34,
        fields: [{ name: "Title", isForeignKey: true, isImportant: true }],
        foreignKeys: [{
          name: "FK_UI_Title_Projects",
          columns: ["Title"],
          referencedSchema: "pmt",
          referencedTable: "Projects",
          referencedColumns: ["Title"],
          relationshipType: "many-to-one",
          styleOverride: { stroke: "#22c55e", strokeWidth: 3, arrowSize: 16, opacity: 0.65 }
        }]
      },
      {
        id: "mapping-table",
        type: "field-mapping-table",
        sourceImageId: "screen",
        x: 580,
        y: 610,
        rows: [{
          uiEntityId: "ui-title",
          uiField: "Title",
          databaseField: "pmt.Projects.Title"
        }]
      }
    ]
  };
}
