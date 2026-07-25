import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canDiagramFeatureReadPmtDiagramFile,
  createDiagramSelectionClipboardPackage,
  createPmtDiagramFile,
  diagramCompatibilityCapabilities,
  diagramSelectionClipboardFormat,
  diagramSelectionClipboardPlainTextHeader,
  diagramSelectionClipboardVersion,
  diagramSharedDocumentContract,
  normalizeDiagramTemplateLibrary,
  parseDiagramSelectionClipboardPackage,
  parsePmtDiagramFile,
  pmtDiagramFileFormat,
  pmtDiagramFileVersion,
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

test("shared PMT Diagram codec preserves extensions and treats generator.feature as advisory", async () => {
  const mixed = await readFixture("mixed-diagram-state.json");
  const contents = createPmtDiagramFile({
    title: "Shared Contract",
    state: {
      ...mixed,
      diagram2RendererCache: { mountedNodeCount: 42 },
      objects: mixed.objects.map(object => ({ ...object, mountedNodeId: `node-${object.id}` }))
    },
    generatorFeature: "Diagram 2",
    diagramExtensions: { futureDiagramMetadata: { keep: true } },
    extensions: { futureTopLevelMetadata: { keep: true } },
    exportedAt: "2026-07-25T00:00:00.000Z"
  });
  const raw = JSON.parse(contents);

  assert.equal(raw.format, pmtDiagramFileFormat);
  assert.equal(raw.formatVersion, pmtDiagramFileVersion);
  assert.equal(raw.generator.feature, "Diagram 2");
  assert.deepEqual(raw.diagram.extensions, { futureDiagramMetadata: { keep: true } });
  assert.deepEqual(raw.extensions, { futureTopLevelMetadata: { keep: true } });
  assert.equal(raw.diagram.editorState.diagram2RendererCache, undefined);
  assert.equal(raw.diagram.editorState.objects.some(object => object.mountedNodeId), false);

  raw.generator.feature = "Future Diagram Screen";
  const parsed = parsePmtDiagramFile(JSON.stringify(raw));

  assert.equal(parsed.title, "Shared Contract");
  assert.equal(parsed.generator.feature, "Future Diagram Screen");
  assert.deepEqual(parsed.diagramExtensions, { futureDiagramMetadata: { keep: true } });
  assert.deepEqual(parsed.extensions, { futureTopLevelMetadata: { keep: true } });
  assert.equal(parsed.state.objects.find(object => object.id === "mixed-field-map-table").type, "field-mapping-table");
});

test("PMT Diagram file compatibility matrix is reader neutral for Diagram and Diagram 2", async () => {
  const mixed = await readFixture("mixed-diagram-state.json");
  const features = ["Diagram", "Diagram 2"];

  for (const writer of features) {
    const contents = createPmtDiagramFile({ title: `${writer} export`, state: mixed, generatorFeature: writer });
    for (const reader of features) {
      assert.equal(canDiagramFeatureReadPmtDiagramFile(reader, contents), true, `${writer} -> ${reader}`);
    }
  }

  assert.equal(canDiagramFeatureReadPmtDiagramFile("Unknown", createPmtDiagramFile({ state: mixed })), false);
});

test("shared template contract keeps the existing Object Template schema and endpoints", async () => {
  const fixture = await readFixture("template-library-sample.json");
  const legacyLibrary = normalizeDiagramTemplateLibrary(fixture);
  const fixtureWithExtensions = {
    ...fixture,
    extensions: { futureLibraryMetadata: { keep: true } },
    templates: fixture.templates.map((template, index) => ({
      ...template,
      extensions: { futureTemplateMetadata: { index } }
    }))
  };
  const library = normalizeDiagramTemplateLibrary(fixtureWithExtensions);

  assert.equal(diagramCompatibilityCapabilities.objectTemplates, true);
  assert.equal(diagramCompatibilityCapabilities.persistedRendererCaches, false);
  assert.deepEqual(diagramCompatibilityCapabilities.compatibleFeatures, ["Diagram", "Diagram 2"]);
  assert.equal(diagramSharedDocumentContract.duplicateDatabaseRecords, false);
  assert.equal(diagramSharedDocumentContract.endpoints.templateLibrary, "/api/image-annotation/template-library");
  assert.equal(diagramSharedDocumentContract.endpoints.defaultTemplateLibrary, "/api/image-annotation/default-template-library");
  assert.equal(library.version, 1);
  assert.equal(library.templates.length, 1);
  assert.deepEqual(library.defaults, { arrow: null, rectangle: null, fieldRectangleRelationship: null });
  assert.equal(Object.hasOwn(legacyLibrary, "extensions"), false);
  assert.equal(Object.hasOwn(legacyLibrary.templates[0], "extensions"), false);
  assert.deepEqual(library.extensions, { futureLibraryMetadata: { keep: true } });
  assert.deepEqual(library.templates[0].extensions, { futureTemplateMetadata: { index: 0 } });

  const roundTripped = normalizeDiagramTemplateLibrary(library);
  assert.deepEqual(roundTripped.extensions, library.extensions);
  assert.deepEqual(roundTripped.templates[0].extensions, library.templates[0].extensions);
});

test("Diagram selection clipboard packages serialize selected objects, relationships, and manual routes", async () => {
  const mixed = await readFixture("mixed-diagram-state.json");
  const selectedObjectIds = [
    "mixed-projects",
    "mixed-worktasks",
    "mixed-task-screen",
    "mixed-title-field",
    "mixed-field-map-table"
  ];
  const clipboardPackage = createDiagramSelectionClipboardPackage({
    state: mixed,
    selectedObjectIds,
    sourceFeature: "Diagram 2",
    extensions: { futureClipboardMetadata: true }
  });

  assert.equal(clipboardPackage.format, diagramSelectionClipboardFormat);
  assert.equal(clipboardPackage.formatVersion, diagramSelectionClipboardVersion);
  assert.equal(clipboardPackage.source.feature, "Diagram 2");
  assert.deepEqual(clipboardPackage.selection.objects.map(object => object.id), selectedObjectIds);
  assert.equal(clipboardPackage.selection.relationships.length, 2);
  assert.equal(Object.keys(clipboardPackage.selection.manualRelationshipRoutes).length, 1);
  assert.equal(
    clipboardPackage.selection.relationships.some(relationship =>
      relationship.sourceObjectId === "mixed-title-field"
      && relationship.targetObjectId === "mixed-projects"
      && relationship.relationshipType === "many-to-one"
    ),
    true
  );

  const serialized = serializeDiagramSelectionClipboardPackage(clipboardPackage);
  assert.equal(serialized.startsWith(`${diagramSelectionClipboardPlainTextHeader}\n`), true);
  const parsed = parseDiagramSelectionClipboardPackage(serialized);
  assert.deepEqual(parsed.extensions, { futureClipboardMetadata: true });
  assert.deepEqual(parsed.selection.relationships, clipboardPackage.selection.relationships);
});

test("Diagram selection clipboard rejects newer packages with a clear version error", () => {
  const futurePackage = {
    format: diagramSelectionClipboardFormat,
    formatVersion: diagramSelectionClipboardVersion + 1,
    minimumReaderVersion: diagramSelectionClipboardVersion + 1,
    source: { application: "PMT", feature: "Diagram 2" },
    selection: { objects: [] },
    extensions: {}
  };
  const futureText = `${diagramSelectionClipboardPlainTextHeader}\n${JSON.stringify(futurePackage)}`;

  assert.throws(
    () => parseDiagramSelectionClipboardPackage(futureText),
    /PMT Diagram selection version 2 is not supported\./
  );

  assert.throws(
    () => parseDiagramSelectionClipboardPackage(JSON.stringify({
      ...futurePackage,
      formatVersion: diagramSelectionClipboardVersion
    })),
    /PMT Diagram selection reader version 2 is not supported\./
  );
});

test("Diagram selection clipboard preserves rectangle, text, and rich text objects through remap", () => {
  const clipboardPackage = createDiagramSelectionClipboardPackage({
    state: {
      width: 900,
      height: 600,
      objects: [
        {
          id: "rect-a",
          type: "rectangle",
          x: 20,
          y: 30,
          width: 120,
          height: 70,
          fill: "#ffffff",
          stroke: "#126bff",
          strokeWidth: 2
        },
        {
          id: "text-a",
          type: "textbox",
          x: 170,
          y: 40,
          width: 180,
          height: 80,
          text: "Plain Diagram text",
          fontSize: 18,
          textColor: "#172b4d"
        },
        {
          id: "rich-a",
          type: "rich-text",
          x: 390,
          y: 50,
          width: 280,
          height: 150,
          html: "<p><strong>Rich</strong> Diagram note</p>",
          fill: "none",
          stroke: "#42526b"
        }
      ]
    },
    selectedObjectIds: ["rect-a", "text-a", "rich-a"]
  });
  const serialized = serializeDiagramSelectionClipboardPackage(clipboardPackage);
  const parsed = parseDiagramSelectionClipboardPackage(serialized);
  const remapped = remapDiagramSelectionClipboardPackageIds(parsed, {
    idFactory: oldId => `paste-${oldId}`,
    pasteIndex: 3,
    pasteOffset: { x: 10, y: 12 }
  });
  const text = remapped.selection.objects.find(object => object.id === "paste-text-a");
  const rich = remapped.selection.objects.find(object => object.id === "paste-rich-a");

  assert.deepEqual(parsed.selection.objects.map(object => object.id), ["rect-a", "text-a", "rich-a"]);
  assert.equal(text.text, "Plain Diagram text");
  assert.equal(text.x, 200);
  assert.equal(text.y, 76);
  assert.match(rich.html, /<strong>Rich<\/strong>/);
  assert.equal(rich.x, 420);
  assert.equal(rich.y, 86);
});

test("Diagram selection ID remapping handles objects, groups, relationships, routes, and Field Mapping Table references", async () => {
  const mixed = await readFixture("mixed-diagram-state.json");
  const clipboardPackage = createDiagramSelectionClipboardPackage({
    state: mixed,
    selectedObjectIds: [
      "mixed-projects",
      "mixed-worktasks",
      "mixed-task-screen",
      "mixed-title-field",
      "mixed-field-map-table"
    ]
  });
  const remapped = remapDiagramSelectionClipboardPackageIds(clipboardPackage, {
    existingObjectIds: ["copy-mixed-projects"],
    idFactory: oldId => `copy-${oldId}`,
    pasteIndex: 2,
    pasteOffset: { x: 8, y: 4 }
  });
  const projects = remapped.selection.objects.find(object => object.id === "copy-mixed-projects-1");
  const workTasks = remapped.selection.objects.find(object => object.id === "copy-mixed-worktasks");
  const fieldRectangle = remapped.selection.objects.find(object => object.id === "copy-mixed-title-field");
  const fieldMappingTable = remapped.selection.objects.find(object => object.id === "copy-mixed-field-map-table");

  assert.equal(projects.x, 116);
  assert.equal(projects.y, 168);
  assert.equal(workTasks.x, 736);
  assert.deepEqual(workTasks.foreignKeys[0].routeOverride[0], { x: 736, y: 226 });
  assert.equal(fieldRectangle.foreignKeys[0].styleOverride.stroke, "#22c55e");
  assert.equal(fieldMappingTable.sourceImageId, "copy-mixed-task-screen");
  assert.equal(fieldMappingTable.rows[0].uiEntityId, "copy-mixed-title-field");
  assert.equal(remapped.selection.relationships.length, 2);
  assert.equal(remapped.selection.relationships.some(relationship =>
    relationship.sourceObjectId === "copy-mixed-title-field"
    && relationship.targetObjectId === "copy-mixed-projects-1"
  ), true);
  assert.equal(Object.keys(remapped.selection.manualRelationshipRoutes).length, 1);
  assert.deepEqual(Object.values(remapped.selection.manualRelationshipRoutes)[0][0], { x: 736, y: 226 });
});

test("Diagram selection ID remapping handles copied groups and owner references", () => {
  const clipboardPackage = createDiagramSelectionClipboardPackage({
    state: {
      width: 800,
      height: 500,
      groupNames: { "group-a": "Callout" },
      groupVisibility: { "group-a": false },
      objects: [
        {
          id: "entity-a",
          type: "entity",
          entitySchema: "pmt",
          entityName: "Projects",
          entityAnnotationGroupId: "group-a",
          x: 100,
          y: 120,
          width: 140,
          height: 80,
          fields: [{ name: "ProjectId", dataType: "INT", nullable: false, isPrimaryKey: true, isForeignKey: false }],
          foreignKeys: []
        },
        {
          id: "callout-a",
          type: "textbox",
          groupId: "group-a",
          entityAnnotationOwnerId: "entity-a",
          entityAnnotationRole: "callout",
          x: 260,
          y: 130,
          width: 180,
          height: 90,
          text: "Grouped note"
        },
        {
          id: "callout-arrow-a",
          type: "arrow",
          groupId: "group-a",
          entityAnnotationOwnerId: "entity-a",
          entityAnnotationRole: "arrow",
          x1: 230,
          y1: 150,
          x2: 260,
          y2: 170
        }
      ]
    },
    selectedObjectIds: ["entity-a", "callout-a", "callout-arrow-a"]
  });
  const remapped = remapDiagramSelectionClipboardPackageIds(clipboardPackage, {
    idFactory: oldId => `${oldId}-next`,
    pasteOffset: { x: 5, y: 6 }
  });

  assert.deepEqual(Object.keys(remapped.selection.groupNames), ["group-a-copy"]);
  assert.equal(remapped.selection.groupNames["group-a-copy"], "Callout");
  assert.equal(remapped.selection.groupVisibility["group-a-copy"], false);
  assert.equal(remapped.selection.objects[0].entityAnnotationGroupId, "group-a-copy");
  assert.equal(remapped.selection.objects[0].x, 105);
  assert.equal(remapped.selection.objects[1].groupId, "group-a-copy");
  assert.equal(remapped.selection.objects[1].entityAnnotationOwnerId, "entity-a-next");
  assert.equal(remapped.selection.objects[2].entityAnnotationOwnerId, "entity-a-next");
});
