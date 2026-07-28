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

test("Diagram 2 read-only host exposes a scrollbar spacer without changing the renderer surface", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2.js", import.meta.url),
    "utf8"
  );
  const css = await readFile(
    new URL("../../wwwroot/css/features/diagram2.css", import.meta.url),
    "utf8"
  );
  const readonlyCanvasRule = css.match(/\.diagram2-readonly-canvas\.diagram2-viewer-canvas\s*\{[\s\S]*?\}/)?.[0] || "";

  assert.match(source, /data-diagram2-readonly-scroll-spacer/);
  assert.match(css, /\.diagram2-readonly-canvas\.diagram2-viewer-canvas[\s\S]*overflow: auto;/);
  assert.match(css, /\.diagram2-readonly-canvas \.diagram2-renderer-surface[\s\S]*position: absolute;/);
  assert.match(readonlyCanvasRule, /scrollbar-width:\s*auto;/);
  assert.doesNotMatch(readonlyCanvasRule, /scrollbar-width:\s*thin;/);
});

test("Diagram 2 diagnostics are hidden by default and toggled from the page overflow menu", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2.js", import.meta.url),
    "utf8"
  );
  const shellSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-editor-shell.js", import.meta.url),
    "utf8"
  );

  assert.equal(preferenceKeys.diagram2DiagnosticsVisible, "pmt-diagram2-diagnostics-visible");
  assert.match(source, /diagram2DiagnosticsVisible = readBooleanPreference\(preferenceKeys\.diagram2DiagnosticsVisible, false\)/);
  assert.match(source, /action: "toggle-diagram2-diagnostics"[\s\S]*checked: diagram2DiagnosticsVisible/);
  assert.match(source, /writePreference\(preferenceKeys\.diagram2DiagnosticsVisible, diagram2DiagnosticsVisible\)/);
  assert.match(source, /function diagram2DiagnosticsPanelHtml\(\)[\s\S]*if \(!diagram2DiagnosticsVisible\) return ""/);
  assert.match(shellSource, /options\.showDiagnostics === true/);
});

test("Diagram 2 feature CSS stays flat without shadows", async () => {
  const css = await readFile(
    new URL("../../wwwroot/css/features/diagram2.css", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(css, /box-shadow|drop-shadow|filter\s*:/);
});

test("Diagram 2 selected objects keep their saved outline color", async () => {
  const css = await readFile(
    new URL("../../wwwroot/css/features/diagram2.css", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(css, /\.diagram2-renderer-object\.is-selected/);
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

test("Diagram 2 shares Diagram 1 document-library preferences but keeps renderer settings separate", () => {
  assert.equal(preferenceKeys.diagramSearch, "pmt-diagram-search");
  assert.equal(preferenceKeys.diagramSelectedDocument, "pmt-diagram-selected-document");
  assert.equal(preferenceKeys.diagramViewMode, "pmt-diagram-view-mode");
  assert.equal(preferenceKeys.diagramSort, "pmt-diagram-sort");
  assert.equal(preferenceKeys.diagram2ViewerZoom, "pmt-diagram2-viewer-zoom");
  assert.notEqual(preferenceKeys.diagram2ViewerZoom, preferenceKeys.diagramViewMode);
  assert.notEqual(preferenceKeys.diagram2ViewerZoom, preferenceKeys.diagramSelectedDocument);
});

test("Diagram 1 read-only D2 comparison alignment is localhost-only", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram/diagram.js", import.meta.url),
    "utf8"
  );

  assert.match(source, /function diagramReadOnlyD2ComparisonOffset/);
  assert.match(source, /hostname === "localhost"/);
  assert.match(source, /hostname === "127\.0\.0\.1"/);
  assert.match(source, /Remove the localhost D1\/D2 comparison alignment shim/);
  assert.match(source, /readonlyViewportScrollForContent/);
});

test("Diagram 2 download actions expose Diagram 1-style SVG and PNG options", async () => {
  const source = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2.js", import.meta.url),
    "utf8"
  );
  const svgExportSource = source.slice(
    source.indexOf("async function exportDiagram2Svg"),
    source.indexOf("async function exportDiagram2Png")
  );
  const pngExportSource = source.slice(
    source.indexOf("async function exportDiagram2Png"),
    source.indexOf("async function copyDiagram2Selection")
  );

  assert.match(source, /function openDiagram2DownloadOptionsDialog/);
  assert.match(source, /Background/);
  assert.match(source, /Margins/);
  assert.match(svgExportSource, /chooseDiagram2SvgDownloadOptions\(\)/);
  assert.match(svgExportSource, /const portableState = await buildPortableAnnotationState\(stateForExport\)/);
  assert.match(svgExportSource, /prepareDiagram2SvgForDownload\(buildAnnotationSvg\(portableState\), options\)/);
  assert.match(pngExportSource, /chooseDiagram2PngDownloadOptions\(\)/);
  assert.match(pngExportSource, /const portableState = await buildPortableAnnotationState\(stateForExport\)/);
  assert.match(pngExportSource, /prepareDiagram2SvgForDownload\(buildAnnotationSvg\(portableState\), options\)/);
});

test("Diagram 2 import probe parses the existing PMT Diagram fixture through the shared codec", async () => {
  const fixture = await readFile(
    new URL("../fixtures/diagram-compatibility/diagram1-synthetic-export.pmt-diagram.json", import.meta.url),
    "utf8"
  );

  assert.equal(canDiagramFeatureReadPmtDiagramFile("Diagram 2", fixture), true);
});
