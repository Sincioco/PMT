import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildAnnotationSvg,
  normalizeAnnotationState
} from "../../wwwroot/js/components/image-annotation.js";
import { preferenceKeys } from "../../wwwroot/js/core/preferences.js";
import {
  canDiagramFeatureReadPmtDiagramFile
} from "../../wwwroot/js/shared/diagram-contracts.js";
import {
  diagramAllDocuments,
  diagramDocumentImage,
  diagramReadonlyImageResult,
  loadDiagramCanonicalState
} from "../../wwwroot/js/shared/diagram-documents.js";

function diagramBodyHtml(title) {
  const svg = buildAnnotationSvg(normalizeAnnotationState({
    width: 640,
    height: 360,
    objects: [{
      id: "diagram2-text",
      type: "textbox",
      x: 80,
      y: 90,
      width: 260,
      height: 90,
      text: title,
      fontSize: 24,
      textColor: "#172b4d"
    }]
  }));
  return `<p><img data-pmt-diagram="true" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt="${title}"></p>`;
}

test("Diagram 2 selects the same owned and public backing Diagram documents", () => {
  const documents = [
    {
      id: 10,
      title: "Owned Diagram",
      isPrivate: true,
      createdByUserId: 1,
      bodyHtml: diagramBodyHtml("Owned")
    },
    {
      id: 20,
      title: "Public Diagram",
      isPrivate: false,
      createdByUserId: 2,
      bodyHtml: diagramBodyHtml("Public")
    },
    {
      id: 30,
      title: "Other Private Diagram",
      isPrivate: true,
      createdByUserId: 2,
      bodyHtml: diagramBodyHtml("Private")
    },
    {
      id: 40,
      title: "Documentation",
      isPrivate: false,
      createdByUserId: 2,
      bodyHtml: "<p>Plain documentation.</p>"
    }
  ];

  assert.deepEqual(diagramAllDocuments(documents, 1).map(document => document.id), [10, 20]);
  assert.match(diagramDocumentImage(documents[0]).source, /^data:image\/svg\+xml/);
});

test("Diagram 2 read-only shell renders saved canonical Diagram SVG metadata", () => {
  const document = {
    id: 10,
    title: "Read Only Diagram",
    isPrivate: false,
    createdByUserId: 1,
    bodyHtml: diagramBodyHtml("Read Only")
  };
  const result = diagramReadonlyImageResult(diagramDocumentImage(document).source, document.title, {
    className: "diagram2-readonly-art"
  });

  assert.equal(result.stateLoaded, true);
  assert.equal(result.needsSvgHydration, false);
  assert.equal(result.metrics.width, 640);
  assert.equal(result.metrics.height, 360);
  assert.match(result.html, /class="diagram2-readonly-art"/);
  assert.match(result.html, /Read Only/);
});

test("Diagram 2 can load canonical state from saved Diagram SVG metadata", async () => {
  const document = {
    id: 10,
    title: "Canonical Diagram",
    isPrivate: false,
    createdByUserId: 1,
    bodyHtml: diagramBodyHtml("Canonical")
  };
  const result = await loadDiagramCanonicalState(diagramDocumentImage(document).source);

  assert.equal(result.stateLoaded, true);
  assert.equal(result.state.width, 640);
  assert.equal(result.state.height, 360);
  assert.equal(result.state.objects.length, 1);
});

test("Diagram 2 preferences stay separate from Diagram 1 preferences", () => {
  assert.equal(preferenceKeys.diagramSearch, "pmt-diagram-search");
  assert.equal(preferenceKeys.diagram2Search, "pmt-diagram2-search");
  assert.equal(preferenceKeys.diagram2SelectedDocument, "pmt-diagram2-selected-document");
  assert.equal(preferenceKeys.diagram2ViewerZoom, "pmt-diagram2-viewer-zoom");
  assert.notEqual(preferenceKeys.diagram2ViewMode, preferenceKeys.diagramViewMode);
  assert.notEqual(preferenceKeys.diagram2TreePaneHidden, preferenceKeys.diagramTreePaneHidden);
});

test("Diagram 2 import probe parses the existing PMT Diagram fixture through the shared codec", async () => {
  const fixture = await readFile(
    new URL("../fixtures/diagram-compatibility/diagram1-synthetic-export.pmt-diagram.json", import.meta.url),
    "utf8"
  );

  assert.equal(canDiagramFeatureReadPmtDiagramFile("Diagram 2", fixture), true);
});
