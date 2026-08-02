import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = relativePath => readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("RTE places Link Diagram 2 immediately after Link Diagram with identical disabled rules", async () => {
  const formsSource = await source("wwwroot/js/components/forms.js");
  const original = formsSource.indexOf('data-command="insertLinkedDiagram"');
  const diagram2 = formsSource.indexOf('data-command="insertLinkedDiagram2"');
  const nextTool = formsSource.indexOf('data-command="insertHorizontalRule"');

  assert.ok(original >= 0, "Link Diagram toolbar command is present");
  assert.ok(diagram2 > original, "Link Diagram 2 follows Link Diagram");
  assert.ok(nextTool > diagram2, "Link Diagram 2 is adjacent to Link Diagram");
  assert.match(formsSource, /data-command="insertLinkedDiagram2"[^>]+title="\$\{escapeAttr\(linkedDiagramDisabled \? linkedDiagramTitle : "Insert Linked Diagram 2"\)\}"/);
  assert.match(formsSource, /data-command="insertLinkedDiagram2"[^>]+\$\{linkedDiagramDisabledAttributes\}/);
  assert.equal((formsSource.match(/class="rich-linked-diagram-insert-tool/g) || []).length, 2);
});

test("Link Diagram 2 reuses the D1 picker, shell, tab schema, and durable view model", async () => {
  const appSource = await source("wwwroot/js/app.js");
  const textSource = await source("wwwroot/js/shared/text-and-links.js");
  const formsCss = await source("wwwroot/css/components/forms.css");

  assert.match(appSource, /if \(command === "insertLinkedDiagram2"\)[\s\S]*insertRichLinkedDiagram\(editor, savedSelection, \{ renderer: "2" \}\)/);
  assert.match(appSource, /askForRichLinkedDiagram\(renderer === "2"[\s\S]*title: "Insert Linked Diagram 2"/);
  assert.match(appSource, /data-pmt-ole="\$\{renderer === "2" \? "diagram2" : "diagram"\}"/);
  assert.match(appSource, /data-diagram-renderer="2"/);
  assert.match(appSource, /data-tabs="\$\{escapeAttr\(JSON\.stringify\(\[tab\]\)\)\}"/);
  assert.match(appSource, /data-view-width="900" data-view-height="520"/);
  assert.match(appSource, /function richDiagramOleFeatureName\(block\)[\s\S]*"Linked Diagram 2"[\s\S]*"Linked Diagram"/);
  assert.match(appSource, /function richDiagramOleStorageKey[\s\S]*pmt-diagram-ole:/);
  assert.match(appSource, /function richDiagramOleWriteTabs/);
  assert.match(appSource, /function rememberRichDiagramOleViewport/);
  assert.match(appSource, /function rememberRichDiagramOleActiveTab/);
  assert.match(appSource, /function rememberRichDiagramOleMaximized/);
  assert.match(appSource, /const saved = localStorage\.getItem\(richDiagramOleStorageKey[\s\S]*if \(!saved\) return null/);

  assert.match(textSource, /\[data-pmt-ole='diagram'\], \[data-pmt-ole='diagram2'\]/);
  assert.match(textSource, /renderer === "2" \? "pmt-diagram-ole pmt-diagram2-ole" : "pmt-diagram-ole"/);
  assert.match(textSource, /block\.setAttribute\("data-diagram-renderer", "2"\)/);
  assert.match(textSource, /block\.innerHTML = `<figcaption>\$\{escapeHtml\(header\)\}<\/figcaption>`/);
  assert.doesNotMatch(textSource, /data-diagram2-svg/);
  assert.match(formsCss, /\.pmt-diagram2-ole \.pmt-diagram-ole-surface[\s\S]*width:\s*100%;[\s\S]*height:\s*100%;/);
});

test("Link Diagram 2 mounts only the production D2 read-only renderer and patches its viewport incrementally", async () => {
  const adapterSource = await source("wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js");
  const appSource = await source("wwwroot/js/app.js");

  assert.match(adapterSource, /loadDiagramCanonicalState/);
  assert.match(adapterSource, /createDiagram2Renderer/);
  assert.match(adapterSource, /diagram2ReadonlyRendererState/);
  assert.match(adapterSource, /const linkedDiagram2Records = new WeakMap\(\)/);
  assert.match(adapterSource, /record\.state = diagram2ReadonlyRendererState\(result\.state\)/);
  assert.match(adapterSource, /renderer\.render\(record\.state,/);
  assert.match(adapterSource, /renderer\.zoomBy\(factor, point\)/);
  assert.match(adapterSource, /renderer\.panBy\(deltaX, deltaY\)/);
  assert.match(adapterSource, /renderer\.fit\(\)/);
  assert.match(adapterSource, /function fitDiagram2LinkedViewer[\s\S]*renderer\.syncViewportMetrics\?\.\(\)[\s\S]*syncDiagram2RendererViewportInset[\s\S]*renderer\.fit\(\)/);
  assert.match(adapterSource, /renderer\.destroy\(\)/);
  assert.doesNotMatch(adapterSource, /buildInteractiveDiagramViewerSvg|buildAnnotationSvg/);
  assert.doesNotMatch(adapterSource, /\.render\([^\n]+reason:\s*"pan|\.render\([^\n]+reason:\s*"zoom/);
  assert.match(adapterSource, /if \(record\.autoFit\) await autoFitDiagram2LinkedViewer\(record\)/);
  assert.match(adapterSource, /fitDiagram2LinkedViewerAfterLayout[\s\S]*await nextDiagram2LinkedViewerFrame\(\);[\s\S]*await nextDiagram2LinkedViewerFrame\(\);[\s\S]*fitDiagram2LinkedViewer/);
  assert.match(appSource, /if \(richDiagramOleIsDiagram2\(block\)\)[\s\S]*hydrateDiagram2LinkedViewer/);
  assert.match(appSource, /autoFit: !hasRichDiagramOleViewport\(block, diagram, activeTab\)/);
  assert.match(appSource, /if \(diagram2\) return;[\s\S]*if \(hasStoredView\)/);
});

test("Diagram 2 public links use the production Linked Diagram 2 viewer", async () => {
  const endpointSource = await source("Endpoints/ContentEndpoints.cs");
  const diagram2Source = await source("wwwroot/js/features/diagram2/diagram2.js");
  const publicViewerSource = await source("wwwroot/js/public-linked-diagram2-viewer.js");

  assert.ok(endpointSource.includes('app.MapGet("/public/diagram-2/{token:guid}"'));
  assert.ok(endpointSource.includes("useDiagram2Renderer: true"));
  assert.ok(endpointSource.includes("data-public-linked-diagram2"));
  assert.ok(endpointSource.includes("public-linked-diagram2-viewer.js?v=20260802-diagram2-linked-zoom-fit-v1"));
  assert.ok(endpointSource.includes("/css/features/diagram2.css?v=20260801-diagram2-readonly-trace-v2"));
  assert.match(diagram2Source, /appUrl\(`\/public\/diagram-2\/\$\{token\}`\)/);
  assert.match(publicViewerSource, /hydrateDiagram2LinkedViewer/);
  assert.match(publicViewerSource, /autoFit: true/);
  assert.match(publicViewerSource, /api\.panBy/);
  assert.match(publicViewerSource, /api\.zoomBy/);
  assert.match(publicViewerSource, /\[data-public-linked-diagram2\]/);
  assert.doesNotMatch(publicViewerSource, /buildInteractiveDiagramViewerSvg|buildAnnotationSvg/);
});

test("Link Diagram 2 controls use the D2 zoom dropdown, Fit icon, and dialog maximize treatment", async () => {
  const appSource = await source("wwwroot/js/app.js");
  const publicViewerSource = await source("wwwroot/js/public-linked-diagram2-viewer.js");
  const formsCss = await source("wwwroot/css/components/forms.css");
  const mapping = publicViewerSource.indexOf("data-diagram2-linked-mapping-toggle");
  const zoomOut = publicViewerSource.indexOf("data-diagram-ole-zoom-out", mapping);
  const zoom = publicViewerSource.indexOf("data-diagram-ole-zoom aria-label", zoomOut);
  const zoomIn = publicViewerSource.indexOf("data-diagram-ole-zoom-in", zoom);
  const fit = publicViewerSource.indexOf("data-diagram-ole-fit", zoomIn);
  const maximize = publicViewerSource.indexOf("data-diagram-ole-maximize", fit);

  assert.ok(mapping >= 0 && zoomOut > mapping && zoom > zoomOut && zoomIn > zoom && fit > zoomIn && maximize > fit);
  assert.doesNotMatch(publicViewerSource, /data-diagram-ole-reset/);
  assert.match(publicViewerSource, /data-diagram-ole-zoom aria-label="Zoom level" title="Zoom level"/);
  assert.match(appSource, /diagram2[\s\S]*data-diagram-ole-zoom[\s\S]*data-diagram-ole-reset/);
  assert.match(publicViewerSource, /stepZoom\(event\.deltaY < 0 \? 1 : -1/);
  assert.match(await source("wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js"), /Array\.from\(\{ length: 59 \}/);
  assert.match(publicViewerSource, /data-diagram-ole-fit[^>]*>&#9633;<\/button>/);
  assert.match(publicViewerSource, /class="dialog-maximize-button" data-diagram-ole-maximize/);
  assert.match(formsCss, /\.pmt-diagram-ole-actions select \{[\s\S]*width:\s*76px;[\s\S]*background-image:\s*var\(--select-arrow-image\)/);
  assert.match(formsCss, /\.pmt-diagram-ole-actions button\.dialog-maximize-button::before/);
  assert.match(formsCss, /button\.dialog-maximize-button \{[\s\S]*border-color:\s*transparent;[\s\S]*background:\s*transparent;/);
  assert.match(formsCss, /\.pmt-diagram-ole\.is-maximized \.pmt-diagram-ole-actions button\.dialog-maximize-button::after/);
});

test("Link Diagram 2 exposes the required renderer lifecycle diagnostics", async () => {
  const adapterSource = await source("wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js");
  const names = [
    "linkedDiagram2RendererCreateCount",
    "linkedDiagram2RendererDestroyCount",
    "linkedDiagram2RendererLiveCount",
    "linkedDiagram2HydrateCount",
    "linkedDiagram2ReuseCount",
    "linkedDiagram2SourceRefreshCount",
    "linkedDiagram2ViewportRestoreCount",
    "linkedDiagram2ScrumRehydrateCount",
    "linkedDiagram2FullRenderCount",
    "linkedDiagram2PanFrameCount",
    "linkedDiagram2ZoomFrameCount",
    "linkedDiagram2ResourceReleaseCount"
  ];

  names.forEach(name => assert.match(adapterSource, new RegExp(`\\b${name}\\b`)));
  assert.match(adapterSource, /globalThis\.__pmtLinkedDiagram2Diagnostics = linkedDiagram2DiagnosticsState/);
});

test("Diagram 2 read mode detects mappings before render and exposes the page Mapping toggle", async () => {
  const diagram2Source = await source("wwwroot/js/features/diagram2/diagram2.js");
  const shellSource = await source("wwwroot/js/features/diagram2/diagram2-editor-shell.js");

  assert.match(diagram2Source, /data-action="toggle-diagram2-tree-pane"[\s\S]*data-diagram2-page-mapping-button/);
  assert.match(diagram2Source, /diagram2HasFieldMappings = fieldMappingIndexes\.mappingsById\.size > 0\s*&& fieldMappingIndexes\.fieldRectanglesById\.size > 0/);
  assert.match(diagram2Source, /if \(!isEditMode && diagram2HasFieldMappings\)[\s\S]*diagram2ReadonlyFieldMappingLinesVisible = false/);
  assert.doesNotMatch(diagram2Source, /Hover on the UI to DB Field Mapping|diagram2MappingHint/);
  assert.match(diagram2Source, /setDiagram2MappingPaneOpen\(shell, mappingCount > 0\)/);
  assert.match(diagram2Source, /setFieldMappingTablesVisible\?\.\(!mappingPaneOpen\)/);
  assert.match(shellSource, /class="field diagram2-mapping-pane-search"/);
  assert.match(shellSource, /class="diagram2-mapping-pane-options"/);
  assert.match(shellSource, /data-diagram2-mapping-alphabetical/);
});

test("Diagram 2 Mapping panes download the full two-column table in pane order", async () => {
  const shellSource = await source("wwwroot/js/features/diagram2/diagram2-editor-shell.js");
  const fieldMappingSource = await source("wwwroot/js/features/diagram2/diagram2-editor-field-mappings.js");
  const diagram2Source = await source("wwwroot/js/features/diagram2/diagram2.js");
  const adapterSource = await source("wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js");
  const diagram2Css = await source("wwwroot/css/features/diagram2.css");

  assert.match(shellSource, /data-diagram2-download-field-mapping="csv"[\s\S]*Download as CSV/);
  assert.match(shellSource, /data-diagram2-download-field-mapping="xlsx"[\s\S]*Download as Excel/);
  assert.match(shellSource, /data-diagram2-mapping-column-headers[\s\S]*UI Field[\s\S]*Database Field/);
  assert.match(shellSource, /data-diagram2-mapping-column-resizer[\s\S]*Resize UI Field column/);
  assert.match(shellSource, /syncDiagram2MappingPaneColumnWidth[\s\S]*diagram2MappingPaneAutoColumnWidth/);
  assert.doesNotMatch(shellSource, /diagram2-mapping-pane-field-kind/);
  assert.match(shellSource, /header: "UI Field"[\s\S]*header: "Database Field"/);
  assert.match(fieldMappingSource, /diagram2FieldMappingExportRows[\s\S]*groupByTable[\s\S]*alphabetical/);
  assert.match(diagram2Source, /downloadDiagram2FieldMappings[\s\S]*groupByTable: diagram2MappingGroupByTable[\s\S]*alphabetical: diagram2MappingAlphabetical/);
  assert.match(adapterSource, /downloadDiagram2FieldMappings[\s\S]*groupByTable: record\.mappingGroupByTable[\s\S]*alphabetical: record\.mappingAlphabetical/);
  assert.match(diagram2Css, /\.diagram2-mapping-pane-downloads \{[\s\S]*grid-template-columns:[^;]+;[\s\S]*border-top:/);
  assert.match(diagram2Css, /--diagram2-mapping-ui-column-width[\s\S]*\.diagram2-mapping-pane-column-resizer/);
});

test("Link Diagram 2 reuses the mapping pane, links public sources, and never applies the D1 pan clamp", async () => {
  const appSource = await source("wwwroot/js/app.js");
  const adapterSource = await source("wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js");
  const textSource = await source("wwwroot/js/shared/text-and-links.js");

  assert.match(appSource, /data-diagram2-linked-mapping-toggle/);
  assert.match(appSource, /diagram\?\.isPrivate === false[\s\S]*routeForContent\("diagram-2", diagram\.id\)/);
  assert.match(appSource, /data-diagram2-linked-main/);
  assert.doesNotMatch(appSource, /if \(diagram2\) \{\s*const hasMeasuredDiagram = clampRichDiagramOleViewport/);
  assert.match(adapterSource, /diagram2MappingPaneHtml/);
  assert.match(adapterSource, /setFieldMappingLinesVisible\?\.\(false\)/);
  assert.match(adapterSource, /setFieldMappingTablesVisible\?\.\(!nextOpen\)/);
  assert.match(adapterSource, /syncDiagram2RendererViewportInset/);
  assert.match(adapterSource, /focusFieldMappingTarget\?\./);
  assert.match(adapterSource, /block\.addEventListener\("pointermove",[\s\S]*capture: true, signal/);
  assert.doesNotMatch(adapterSource, /scheduleDiagram2LinkedMappingHint|data-diagram2-mapping-hover-hint/);
  assert.match(appSource, /if \(diagram2\) view = diagram2LinkedViewerViewport\(block\) \|\| view/);
  assert.match(textSource, /removeAttribute\("data-diagram2-linked-shell"\)/);
  assert.match(textSource, /removeAttribute\("data-diagram2-left-pane-resize-bound"\)/);
});

test("Diagram 2 read-only viewers share hover and pinned entity relationship traces", async () => {
  const rendererSource = await source("wwwroot/js/features/diagram2/diagram2-renderer.js");
  const diagram2Source = await source("wwwroot/js/features/diagram2/diagram2.js");
  const adapterSource = await source("wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js");
  const diagram2Css = await source("wwwroot/css/features/diagram2.css");

  assert.match(rendererSource, /setRelationshipTraceHover[\s\S]*relationshipTraceHoverTargetIds/);
  assert.match(rendererSource, /relationship\.source\?\.id[\s\S]*relationship\.target\?\.id/);
  assert.match(diagram2Source, /bindDiagram2ReadonlyMappingInteractions[\s\S]*setRelationshipTraceHover/);
  assert.match(adapterSource, /traceEntitySelector[\s\S]*setRelationshipTraceHover/);
  assert.match(diagram2Css, /\.diagram2-renderer-object\.is-relationship-trace[\s\S]*data-diagram2-entity-outline/);
});

test("Diagram 2 Mapping panes abbreviate grouped fields and auto-pin one search result", async () => {
  const shellSource = await source("wwwroot/js/features/diagram2/diagram2-editor-shell.js");
  const diagram2Source = await source("wwwroot/js/features/diagram2/diagram2.js");
  const adapterSource = await source("wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js");

  assert.match(shellSource, /groupByTable === true[\s\S]*row\.databaseFieldName/);
  assert.match(diagram2Source, /syncDiagram2SingleMappingSearchResult[\s\S]*pinFieldMapping/);
  assert.match(adapterSource, /syncDiagram2LinkedSingleMappingSearchResult[\s\S]*pinFieldMapping/);
});

test("Scrum disposes D2 linked renderers before replacement and restores viewer dimensions", async () => {
  const appSource = await source("wwwroot/js/app.js");
  const scrumSource = await source("wwwroot/js/features/scrum/scrum.js");
  const renderStart = scrumSource.indexOf("function renderDevLogs(");
  const dispose = scrumSource.indexOf("disposeLinkedDiagrams?.(app);", renderStart);
  const replacement = scrumSource.indexOf("app.innerHTML = `", renderStart);
  const hydrate = scrumSource.indexOf("hydrateLinkedDiagrams?.(app);", replacement);

  assert.ok(renderStart >= 0 && dispose > renderStart, "Scrum has an explicit disposal boundary");
  assert.ok(replacement > dispose, "D2 disposal happens before app.innerHTML replacement");
  assert.ok(hydrate > replacement, "linked viewers hydrate after replacement");
  assert.match(appSource, /disposeLinkedDiagrams:\s*disposeRichDiagramOleBlocks/);
  assert.match(scrumSource, /linkedDiagramSizes:[\s\S]*data-block-id/);
  assert.match(scrumSource, /viewState\.linkedDiagramSizes[\s\S]*diagram-ole-resized/);
  assert.match(scrumSource, /\.pmt-diagram-ole-viewport\.is-panning/);
  assert.match(scrumSource, /activeElement\?\.closest\?\.\("\.pmt-diagram-ole"\)/);
});

test("Documentation export resolves both linked renderer discriminators", async () => {
  const exportSource = await source("wwwroot/js/features/documentation/documentation-export.js");

  assert.match(exportSource, /\[data-pmt-ole='diagram'\], \[data-pmt-ole='diagram2'\]/);
  assert.match(exportSource, /featureName = block\.getAttribute\("data-pmt-ole"\) === "diagram2" \? "Linked Diagram 2" : "Linked Diagram"/);
});
