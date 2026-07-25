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
  const library = normalizeDiagramTemplateLibrary(fixture);

  assert.equal(diagramCompatibilityCapabilities.objectTemplates, true);
  assert.equal(diagramCompatibilityCapabilities.persistedRendererCaches, false);
  assert.deepEqual(diagramCompatibilityCapabilities.compatibleFeatures, ["Diagram", "Diagram 2"]);
  assert.equal(diagramSharedDocumentContract.duplicateDatabaseRecords, false);
  assert.equal(diagramSharedDocumentContract.endpoints.templateLibrary, "/api/image-annotation/template-library");
  assert.equal(diagramSharedDocumentContract.endpoints.defaultTemplateLibrary, "/api/image-annotation/default-template-library");
  assert.equal(library.version, 1);
  assert.equal(library.templates.length, 1);
  assert.deepEqual(library.defaults, { arrow: null, rectangle: null, fieldRectangleRelationship: null });
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
          id: "shape-a",
          type: "rectangle",
          groupId: "group-a",
          x: 100,
          y: 120,
          width: 140,
          height: 80,
          fill: "#ffffff",
          stroke: "#126bff"
        },
        {
          id: "shape-b",
          type: "textbox",
          groupId: "group-a",
          entityAnnotationOwnerId: "shape-a",
          x: 260,
          y: 130,
          width: 180,
          height: 90,
          text: "Grouped note"
        }
      ]
    },
    selectedObjectIds: ["shape-a", "shape-b"]
  });
  const remapped = remapDiagramSelectionClipboardPackageIds(clipboardPackage, {
    idFactory: oldId => `${oldId}-next`,
    pasteOffset: { x: 5, y: 6 }
  });

  assert.deepEqual(Object.keys(remapped.selection.groupNames), ["group-a-copy"]);
  assert.equal(remapped.selection.groupNames["group-a-copy"], "Callout");
  assert.equal(remapped.selection.groupVisibility["group-a-copy"], false);
  assert.equal(remapped.selection.objects[0].groupId, "group-a-copy");
  assert.equal(remapped.selection.objects[0].x, 105);
  assert.equal(remapped.selection.objects[1].entityAnnotationOwnerId, "shape-a-next");
});
