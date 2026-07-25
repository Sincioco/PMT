import { buttonContent } from "../../components/buttons.js?v=20260717-multi-screen-header";
import { copyTextToClipboard } from "../../components/clipboard.js?v=20260714-invite-email-body";
import {
  checkedFilterValues,
  filterCheckList,
  filterSelect
} from "../../components/filters.js";
import { buildAnnotationSvg } from "../../components/image-annotation.js?v=20260725-diagram2-day3-v1";
import { sectionHead } from "../../components/sections.js?v=20260725-diagram2-day4-v1";
import { currentUserId } from "../../core/authentication.js?v=20260715-admin-impersonation";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260725-diagram2-day5-v1";
import { routeForContent, updateBrowserUrl } from "../../core/router.js?v=20260725-diagram2-day4-v1";
import { state } from "../../core/store.js";
import {
  blankDiagramSource,
  diagramAllDocuments,
  diagramDocumentImage,
  diagramLastEditorUserId,
  diagramSourceIsSvg,
  diagramUpdatedTime,
  loadDiagramCanonicalState
} from "../../shared/diagram-documents.js?v=20260725-diagram2-day6-v1";
import { formatDate } from "../../shared/dates.js";
import { escapeAttr, escapeHtml } from "../../shared/text-and-links.js";
import {
  createDiagram2PmtDiagramFile,
  createDiagram2SelectionClipboardText,
  diagram2CompatibilitySummary
} from "./diagram2-compatibility.js?v=20260725-diagram2-day14-v1";
import {
  createDiagram2Renderer,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260726-diagram2-day16-v1";

const diagram2ViewModes = new Set(["tree", "cards"]);
const diagram2SortModes = new Set(["latest", "oldest", "name", "custom"]);
const diagram2VisibilityModes = new Set(["both", "private", "public"]);
const diagram2ZoomModes = new Set(["fit", "0.1", "0.5", "0.75", "1", "1.25", "1.5", "2"]);
const diagram2TreePaneMinimumWidth = 220;
const diagram2TreePaneMaximumWidth = 560;
const diagram2Compatibility = diagram2CompatibilitySummary();
const diagram2HistoryLimit = 100;

export function createDiagram2Feature({ app, notify, saveDiagramDocument } = {}) {
  let active = false;
  let selectedDiagramDocumentId = readNumberPreference(preferenceKeys.diagram2SelectedDocument, 0);
  let diagram2ViewMode = diagram2ViewModes.has(readPreference(preferenceKeys.diagram2ViewMode, "tree"))
    ? readPreference(preferenceKeys.diagram2ViewMode, "tree")
    : "tree";
  let diagram2TreePaneWidth = clampTreePaneWidth(readNumberPreference(preferenceKeys.diagram2TreePaneWidth, 320));
  let diagram2TreePaneHidden = readBooleanPreference(preferenceKeys.diagram2TreePaneHidden, false);
  let diagram2Search = readPreference(preferenceKeys.diagram2Search, "").trim();
  let diagram2ProjectId = readNumberPreference(preferenceKeys.diagram2Project, 0);
  let diagram2SprintId = readPreference(preferenceKeys.diagram2Sprint, "all");
  let diagram2Visibility = diagram2VisibilityModes.has(readPreference(preferenceKeys.diagram2Visibility, "both"))
    ? readPreference(preferenceKeys.diagram2Visibility, "both")
    : "both";
  let diagram2Sort = diagram2SortModes.has(readPreference(preferenceKeys.diagram2Sort, "latest"))
    ? readPreference(preferenceKeys.diagram2Sort, "latest")
    : "latest";
  let diagram2CreatorFilters = normalizeSavedArray(readJsonPreference(preferenceKeys.diagram2CreatorFilters, []));
  let diagram2LastEditorFilters = normalizeSavedArray(readJsonPreference(preferenceKeys.diagram2LastEditorFilters, []));
  let diagram2ViewerZoom = normalizeDiagram2Zoom(readPreference(preferenceKeys.diagram2ViewerZoom, "fit"));
  let viewerHydrationToken = 0;
  let dragAbortController = null;
  let diagram2Renderer = null;
  let diagram2RendererDocumentId = 0;
  let diagram2RendererState = null;
  let diagram2SelectedObjectIds = [];
  let diagram2History = [];
  let diagram2HistoryIndex = -1;
  let diagram2SavedHistoryJson = "";
  let diagram2Dirty = false;
  let diagram2Busy = false;
  let viewportAbortController = null;
  let viewportPanAbortController = null;

  function render() {
    active = true;
    abortTreePaneDrag();
    const routeDocumentId = currentRouteDocumentId();
    const allDocuments = diagram2AllDocuments();
    const allDocumentIds = new Set(allDocuments.map(document => document.id));

    if (routeDocumentId) {
      selectedDiagramDocumentId = routeDocumentId;
      if (allDocumentIds.has(routeDocumentId)) {
        writePreference(preferenceKeys.diagram2SelectedDocument, selectedDiagramDocumentId);
      }
    }

    let documents = diagram2Documents(allDocuments, selectedDiagramDocumentId);
    if (!routeDocumentId && !allDocumentIds.has(selectedDiagramDocumentId)) {
      selectedDiagramDocumentId = documents[0]?.id || allDocuments[0]?.id || 0;
      if (selectedDiagramDocumentId) writePreference(preferenceKeys.diagram2SelectedDocument, selectedDiagramDocumentId);
      documents = diagram2Documents(allDocuments, selectedDiagramDocumentId);
    }

    const selectedDocument = allDocuments.find(document => document.id === selectedDiagramDocumentId) || null;
    const selectedMissingId = selectedDocument ? 0 : selectedDiagramDocumentId;
    const hydrationToken = ++viewerHydrationToken;
    resetDiagram2Renderer();
    globalThis.__pmtDiagram2Compatibility = diagram2Compatibility;

    app.innerHTML = `
      <section class="diagram2-screen ${diagram2ViewMode === "cards" ? "is-card-view" : "is-tree-view"} ${diagram2TreePaneHidden ? "is-tree-hidden" : ""}" data-diagram2-screen ${diagram2CompatibilityAttributes()} style="--diagram2-tree-width:${diagram2TreePaneWidth}px">
        <header data-diagram2-header>
          ${sectionHead("Diagram 2", diagram2HeaderActionsHtml(selectedDocument))}
          ${diagram2FilterBarHtml()}
        </header>
        <aside class="diagram2-tree-pane" data-diagram2-tree aria-label="Diagram 2 document library" ${diagram2TreePaneHidden ? "hidden" : ""}>
          ${diagram2DocumentLibraryHtml(documents)}
        </aside>
        <div class="diagram2-tree-splitter" data-diagram2-tree-splitter ${diagram2TreePaneHidden ? "hidden" : ""} role="separator" aria-orientation="vertical" aria-label="Resize Diagram 2 navigation"></div>
        <main class="diagram2-viewer-host" data-diagram2-viewer-host>
          ${diagram2ViewerHtml(selectedDocument, selectedMissingId)}
        </main>
      </section>
    `;

    bindDiagram2Controls();
    hydrateDiagram2Viewer(hydrationToken, selectedDocument);
  }

  function deactivate() {
    active = false;
    viewerHydrationToken += 1;
    abortTreePaneDrag();
    resetDiagram2Renderer();
  }

  async function handleAction(action, id, button) {
    if (action === "set-diagram2-view") {
      diagram2ViewMode = diagram2ViewModes.has(button?.dataset?.mode) ? button.dataset.mode : "tree";
      writePreference(preferenceKeys.diagram2ViewMode, diagram2ViewMode);
      render();
      return true;
    }
    if (action === "toggle-diagram2-tree-pane") {
      diagram2TreePaneHidden = !diagram2TreePaneHidden;
      writePreference(preferenceKeys.diagram2TreePaneHidden, diagram2TreePaneHidden);
      render();
      return true;
    }
    if (action === "select-diagram2-document" || action === "select-diagram2-card") {
      selectDiagram2Document(id);
      return true;
    }
    if (action === "fit-diagram2-viewer") {
      diagram2ViewerZoom = "fit";
      writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
      applyDiagram2ViewerZoom();
      return true;
    }
    if (action === "refresh-diagram2-renderer") {
      refreshDiagram2Renderer();
      return true;
    }
    if (action === "save-diagram2-document") {
      await saveDiagram2Document();
      return true;
    }
    if (action === "undo-diagram2") {
      await undoDiagram2();
      return true;
    }
    if (action === "redo-diagram2") {
      await redoDiagram2();
      return true;
    }
    if (action === "export-diagram2-pmt") {
      await exportDiagram2Pmt();
      return true;
    }
    if (action === "export-diagram2-svg") {
      await exportDiagram2Svg();
      return true;
    }
    if (action === "export-diagram2-png") {
      await exportDiagram2Png();
      return true;
    }
    if (action === "copy-diagram2-selection") {
      await copyDiagram2Selection();
      return true;
    }
    if (action === "nudge-diagram2-selection") {
      await moveDiagram2SelectedObjects(Number(button?.dataset?.dx || 0), Number(button?.dataset?.dy || 0), {
        reason: "toolbar nudge"
      });
      return true;
    }
    return false;
  }

  function handleFilterChange(target) {
    if (!active) return false;
    const filter = target?.dataset?.filter || "";
    if (!filter.startsWith("diagram2-")) return false;

    if (filter === "diagram2-search") {
      diagram2Search = String(target.value || "").trim();
      writePreference(preferenceKeys.diagram2Search, diagram2Search);
    } else if (filter === "diagram2-project") {
      diagram2ProjectId = Number(target.value || 0);
      diagram2SprintId = "all";
      writePreference(preferenceKeys.diagram2Project, diagram2ProjectId);
      writePreference(preferenceKeys.diagram2Sprint, diagram2SprintId);
    } else if (filter === "diagram2-sprint") {
      diagram2SprintId = target.value || "all";
      writePreference(preferenceKeys.diagram2Sprint, diagram2SprintId);
    } else if (filter === "diagram2-visibility") {
      diagram2Visibility = diagram2VisibilityModes.has(target.value) ? target.value : "both";
      writePreference(preferenceKeys.diagram2Visibility, diagram2Visibility);
    } else if (filter === "diagram2-sort") {
      diagram2Sort = diagram2SortModes.has(target.value) ? target.value : "latest";
      writePreference(preferenceKeys.diagram2Sort, diagram2Sort);
    } else if (filter === "diagram2-creator") {
      diagram2CreatorFilters = checkedDiagram2FilterValues("diagram2-creator");
      writeJsonPreference(preferenceKeys.diagram2CreatorFilters, diagram2CreatorFilters);
    } else if (filter === "diagram2-last-editor") {
      diagram2LastEditorFilters = checkedDiagram2FilterValues("diagram2-last-editor");
      writeJsonPreference(preferenceKeys.diagram2LastEditorFilters, diagram2LastEditorFilters);
    } else if (filter === "diagram2-zoom") {
      diagram2ViewerZoom = normalizeDiagram2Zoom(target.value);
      writePreference(preferenceKeys.diagram2ViewerZoom, diagram2ViewerZoom);
      applyDiagram2ViewerZoom();
      return true;
    } else {
      return false;
    }

    render();
    return true;
  }

  function view(id) {
    selectedDiagramDocumentId = positiveRouteId(id);
    if (selectedDiagramDocumentId) writePreference(preferenceKeys.diagram2SelectedDocument, selectedDiagramDocumentId);
    if (active) render();
    return true;
  }

  function selectDiagram2Document(id) {
    selectedDiagramDocumentId = positiveRouteId(id);
    if (!selectedDiagramDocumentId) return;
    writePreference(preferenceKeys.diagram2SelectedDocument, selectedDiagramDocumentId);
    updateBrowserUrl(routeForContent("diagram-2", selectedDiagramDocumentId));
    render();
  }

  function diagram2HeaderActionsHtml(selectedDocument) {
    const documentDisabled = selectedDocument ? "" : "disabled";
    return `
      <span class="diagram2-status">Diagram 2 Beta</span>
      <span class="diagram2-save-state" data-diagram2-save-state>Saved</span>
      <div class="documentation-view-toggle diagram2-view-toggle" aria-label="Diagram 2 library view">
        <button class="secondary text-icon-button documentation-view-toggle-button ${diagram2ViewMode === "tree" ? "is-on" : ""}" type="button" data-action="set-diagram2-view" data-mode="tree" aria-pressed="${diagram2ViewMode === "tree"}" title="Treeview" aria-label="Treeview">
          ${buttonContent("&#9776;", "Treeview")}
        </button>
        <button class="secondary text-icon-button documentation-view-toggle-button ${diagram2ViewMode === "cards" ? "is-on" : ""}" type="button" data-action="set-diagram2-view" data-mode="cards" aria-pressed="${diagram2ViewMode === "cards"}" title="Cards" aria-label="Cards">
          ${buttonContent("&#9638;", "Cards")}
        </button>
      </div>
      <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="toggle-diagram2-tree-pane" aria-pressed="${!diagram2TreePaneHidden}" title="Left Nav" aria-label="Left Nav">
        ${buttonContent("&#9776;", "Left Nav")}
      </button>
      <div class="diagram2-editor-controls" aria-label="Diagram 2 editor actions">
        <button type="button" class="primary text-icon-button diagram2-page-action" data-action="save-diagram2-document" data-diagram2-requires-dirty title="Save Diagram" aria-label="Save Diagram" ${documentDisabled}>
          ${buttonContent("&#128190;", "Save")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="undo-diagram2" data-diagram2-requires-undo title="Undo" aria-label="Undo" ${documentDisabled}>
          ${buttonContent("&#8630;", "Undo")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="redo-diagram2" data-diagram2-requires-redo title="Redo" aria-label="Redo" ${documentDisabled}>
          ${buttonContent("&#8631;", "Redo")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="copy-diagram2-selection" data-diagram2-requires-selection title="Copy Selection" aria-label="Copy Selection" ${documentDisabled}>
          ${buttonContent("&#128203;", "Copy")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="export-diagram2-pmt" data-diagram2-requires-document title="Export PMT Diagram" aria-label="Export PMT Diagram" ${documentDisabled}>
          ${buttonContent("&#8681;", "PMT")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="export-diagram2-svg" data-diagram2-requires-document title="Export SVG" aria-label="Export SVG" ${documentDisabled}>
          ${buttonContent("&#8681;", "SVG")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="export-diagram2-png" data-diagram2-requires-document title="Export PNG" aria-label="Export PNG" ${documentDisabled}>
          ${buttonContent("&#8681;", "PNG")}
        </button>
      </div>
      <div class="diagram2-nudge-controls" aria-label="Move selected object">
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="nudge-diagram2-selection" data-dx="0" data-dy="-10" data-diagram2-requires-selection title="Move Up" aria-label="Move Up" ${documentDisabled}>
          ${buttonContent("&#8593;", "Up")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="nudge-diagram2-selection" data-dx="0" data-dy="10" data-diagram2-requires-selection title="Move Down" aria-label="Move Down" ${documentDisabled}>
          ${buttonContent("&#8595;", "Down")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="nudge-diagram2-selection" data-dx="-10" data-dy="0" data-diagram2-requires-selection title="Move Left" aria-label="Move Left" ${documentDisabled}>
          ${buttonContent("&#8592;", "Left")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="nudge-diagram2-selection" data-dx="10" data-dy="0" data-diagram2-requires-selection title="Move Right" aria-label="Move Right" ${documentDisabled}>
          ${buttonContent("&#8594;", "Right")}
        </button>
      </div>
      <div class="diagram2-zoom-controls" aria-label="Diagram 2 navigation">
        <select data-filter="diagram2-zoom" aria-label="Zoom level" title="Zoom level" ${documentDisabled}>
          ${diagram2ZoomOptionsHtml(diagram2ViewerZoom)}
        </select>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="fit-diagram2-viewer" title="Fit Diagram" aria-label="Fit Diagram" ${documentDisabled}>
          ${buttonContent("&#9633;", "Fit")}
        </button>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="refresh-diagram2-renderer" title="Refresh Renderer" aria-label="Refresh Renderer" ${documentDisabled}>
          ${buttonContent("&#10227;", "Refresh")}
        </button>
      </div>
    `;
  }

  function diagram2CompatibilityAttributes() {
    return [
      ["data-diagram2-file-format", diagram2Compatibility.fileFormat],
      ["data-diagram2-file-format-version", diagram2Compatibility.fileFormatVersion],
      ["data-diagram2-selection-clipboard-format", diagram2Compatibility.selectionClipboardFormat],
      ["data-diagram2-selection-clipboard-version", diagram2Compatibility.selectionClipboardVersion],
      ["data-diagram2-template-library-endpoint", diagram2Compatibility.endpoints.templateLibrary],
      ["data-diagram2-default-template-library-endpoint", diagram2Compatibility.endpoints.defaultTemplateLibrary],
      ["data-diagram2-persisted-renderer-caches", diagram2Compatibility.persistedRendererCaches]
    ].map(([name, value]) => `${name}="${escapeAttr(value)}"`).join(" ");
  }

  function diagram2FilterBarHtml() {
    const sprintItems = state.sprints
      .filter(sprint => !diagram2ProjectId || Number(sprint.projectId) === diagram2ProjectId)
      .map(sprint => ({ value: sprint.id, text: `${sprint.code} - ${sprint.title}` }));
    return `
      <div class="diagram2-filter-bar">
        <label>
          <span>Search</span>
          <input data-filter="diagram2-search" type="search" value="${escapeAttr(diagram2Search)}" autocomplete="off">
        </label>
        ${filterSelect("Project", "diagram2-project", state.projects.map(project => ({ value: project.id, text: projectLabel(project) })), diagram2ProjectId || "", "All Projects")}
        ${filterSelect("Sprint", "diagram2-sprint", sprintItems, diagram2SprintId === "all" ? "" : diagram2SprintId, "All Sprints")}
        ${filterSelect("Visibility", "diagram2-visibility", [
          { value: "private", text: "Private" },
          { value: "public", text: "Public" }
        ], diagram2Visibility === "both" ? "" : diagram2Visibility, "Public and Private")}
        <label>
          <span>Sort</span>
          <select data-filter="diagram2-sort">
            ${selectOptionsHtml([
              { value: "latest", text: "Latest First" },
              { value: "oldest", text: "Oldest First" },
              { value: "name", text: "Name" },
              { value: "custom", text: "Custom" }
            ], diagram2Sort)}
          </select>
        </label>
      </div>
    `;
  }

  function diagram2DocumentLibraryHtml(documents) {
    const peopleFiltersHtml = diagram2PeopleFiltersHtml();
    if (!documents.length) {
      return `
        ${peopleFiltersHtml}
        <div class="diagram2-library-empty">
          <h2>No diagrams found</h2>
          <p>Diagram 2 reads the same Diagram documents as Diagram 1. Adjust the filters or create a Diagram in Diagram 1.</p>
        </div>
      `;
    }

    return `
      ${peopleFiltersHtml}
      ${diagram2ViewMode === "cards" ? diagram2CardListHtml(documents) : diagram2TreeListHtml(documents)}
    `;
  }

  function diagram2PeopleFiltersHtml() {
    const users = state.users.map(user => ({
      value: user.id,
      text: diagramUserName(user.id),
      avatarUrl: user.avatarUrl
    }));
    return `
      <details class="diagram2-people-filters">
        <summary>People</summary>
        <div class="diagram2-people-filter-body">
          ${filterCheckList("Creator", "diagram2-creator", users, diagram2CreatorFilters, { className: "documentation-filter-users" })}
          ${filterCheckList("Last Edited", "diagram2-last-editor", users, diagram2LastEditorFilters, { className: "documentation-filter-users" })}
        </div>
      </details>
    `;
  }

  function diagram2TreeListHtml(documents) {
    const byId = new Map(documents.map(document => [document.id, document]));
    const childrenByParent = new Map();
    documents.forEach(document => {
      const parentId = byId.has(document.parentBlogId) ? document.parentBlogId : 0;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(document);
    });
    childrenByParent.forEach(children => children.sort(diagram2DocumentCompare));

    const renderChildren = (parentId, depth) => (childrenByParent.get(parentId) || [])
      .map(document => `
        ${diagram2TreeRowHtml(document, depth)}
        ${renderChildren(document.id, depth + 1)}
      `)
      .join("");

    return `<div class="diagram2-tree-list" role="tree" aria-label="Diagram 2 documents">${renderChildren(0, 0)}</div>`;
  }

  function diagram2TreeRowHtml(document, depth) {
    const selected = document.id === selectedDiagramDocumentId;
    return `
      <div class="diagram2-tree-row ${selected ? "is-selected" : ""}" style="--tree-depth:${depth}" role="treeitem" aria-selected="${selected}" data-diagram2-tree-row data-id="${document.id}">
        <button class="diagram2-tree-document" type="button" data-action="select-diagram2-document" data-id="${document.id}" title="${escapeAttr(document.title)}">
          <span class="diagram2-tree-icon" aria-hidden="true">&#128208;</span>
          <span class="diagram2-tree-label">${escapeHtml(document.title || "Diagram")}</span>
          <span class="diagram2-tree-date">${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</span>
          ${document.isPrivate !== false ? `<span class="diagram2-private" title="Private" aria-label="Private">Private</span>` : ""}
        </button>
      </div>
    `;
  }

  function diagram2CardListHtml(documents) {
    return `<div class="diagram2-card-list">
      ${documents.map(document => `
        <button type="button" class="diagram2-card ${document.id === selectedDiagramDocumentId ? "is-selected" : ""}" data-action="select-diagram2-card" data-id="${document.id}">
          <strong>${escapeHtml(document.title || "Diagram")}</strong>
          <span>${document.isPrivate === false ? "Public" : "Private"} Diagram</span>
          <span>Updated ${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</span>
        </button>
      `).join("")}
    </div>`;
  }

  function diagram2ViewerHtml(document, missingId) {
    if (missingId) {
      return `
        <div class="diagram2-empty">
          <h2>Diagram not found</h2>
          <p>Diagram 2 could not find Diagram document ${escapeHtml(missingId)} or you do not have permission to view it.</p>
          <p>Diagram 1 remains available.</p>
        </div>
      `;
    }

    if (!document) {
      return `
        <div class="diagram2-empty">
          <h2>High-performance Diagram renderer under development.</h2>
          <p>Diagram 1 remains available.</p>
        </div>
      `;
    }

    return `
      <div class="diagram2-viewer-document-head">
        <div>
          <h2>${escapeHtml(document.title || "Diagram")}</h2>
          <p data-diagram2-edit-state>Ready</p>
        </div>
        <dl class="diagram2-document-meta">
          <div><dt>Visibility</dt><dd>${document.isPrivate === false ? "Public" : "Private"}</dd></div>
          <div><dt>Project</dt><dd>${escapeHtml(diagramProjectLabel(document.projectId))}</dd></div>
          <div><dt>Sprint</dt><dd>${escapeHtml(diagramSprintLabel(document.sprintId))}</dd></div>
          <div><dt>Updated</dt><dd>${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</dd></div>
        </dl>
      </div>
      <div class="diagram2-viewer-body" data-diagram2-viewer-body>
        <div class="diagram2-live-viewer is-loading" data-diagram2-live-viewer data-id="${document.id}" aria-busy="true">
          <div class="diagram2-viewer-loader" role="status" aria-live="polite">Loading...</div>
          <div class="diagram2-viewer-canvas" data-diagram2-viewer-canvas>
            <div class="diagram2-renderer-surface ${diagram2ViewerZoom === "fit" ? "is-fit" : ""}" data-diagram2-renderer-surface></div>
          </div>
        </div>
        ${diagram2DiagnosticsHtml()}
      </div>
    `;
  }

  async function hydrateDiagram2Viewer(token, document) {
    if (!document) return;
    const source = diagramDocumentImage(document)?.source || blankDiagramSource;
    const viewer = app.querySelector(`[data-diagram2-live-viewer][data-id="${document.id}"]`);
    const surface = viewer?.querySelector("[data-diagram2-renderer-surface]");
    if (!viewer || !surface) return;

    const result = diagramSourceIsSvg(source)
      ? await loadDiagramCanonicalState(source)
      : { state: null, stateLoaded: false };
    if (!active || token !== viewerHydrationToken || selectedDiagramDocumentId !== document.id) return;

    if (!result.state) {
      surface.innerHTML = `<div class="diagram2-renderer-error" role="status">Diagram 2 could not read the saved Diagram metadata.</div>`;
      viewer.querySelector("[data-diagram2-viewer-loader], .diagram2-viewer-loader")?.remove();
      viewer.classList.remove("is-loading");
      viewer.removeAttribute("aria-busy");
      updateDiagram2Diagnostics(null, "Metadata unavailable");
      return;
    }

    diagram2Renderer = createDiagram2Renderer({
      host: surface,
      onDiagnostics: updateDiagram2Diagnostics
    });
    globalThis.__pmtDiagram2Renderer = diagram2Renderer;
    diagram2RendererDocumentId = document.id;
    diagram2RendererState = normalizeDiagram2CanonicalState(result.state);
    diagram2SelectedObjectIds = [];
    initializeDiagram2History(diagram2RendererState);
    let diagnostics = diagram2Renderer.render(diagram2RendererState, {
      reason: "initial"
    });
    diagnostics = diagram2Renderer.setZoom(diagram2ViewerZoom);
    viewer.querySelector("[data-diagram2-viewer-loader], .diagram2-viewer-loader")?.remove();
    viewer.classList.remove("is-loading");
    viewer.removeAttribute("aria-busy");
    bindDiagram2ViewportControls(viewer);
    updateDiagram2Diagnostics(diagnostics);
    updateDiagram2EditorControls();
  }

  function diagram2DiagnosticsHtml() {
    return `
      <section class="diagram2-diagnostics" data-diagram2-diagnostics aria-label="Diagram 2 renderer diagnostics">
        <dl>
          ${diagram2DiagnosticItemHtml("canonical-object-count", "Canonical object count")}
          ${diagram2DiagnosticItemHtml("canonical-entity-count", "Canonical Entity count")}
          ${diagram2DiagnosticItemHtml("canonical-relationship-count", "Canonical relationship count")}
          ${diagram2DiagnosticItemHtml("mounted-object-count", "Mounted object count")}
          ${diagram2DiagnosticItemHtml("mounted-relationship-count", "Mounted relationship count")}
          ${diagram2DiagnosticItemHtml("svg-descendant-count", "SVG descendant count")}
          ${diagram2DiagnosticItemHtml("full-render-count", "Full-render count")}
          ${diagram2DiagnosticItemHtml("full-render-reason", "Full-render reason")}
          ${diagram2DiagnosticItemHtml("objects-patched-in-last-flush", "Objects patched in last flush")}
          ${diagram2DiagnosticItemHtml("relationships-routed-in-last-flush", "Relationships routed in last flush")}
          ${diagram2DiagnosticItemHtml("dirty-flush-reason", "Dirty flush reason")}
          ${diagram2DiagnosticItemHtml("dirty-object-ids", "Dirty object IDs")}
          ${diagram2DiagnosticItemHtml("dirty-relationship-ids", "Dirty relationship IDs")}
          ${diagram2DiagnosticItemHtml("patched-node-count", "Patched node count")}
          ${diagram2DiagnosticItemHtml("routed-relationship-count", "Routed relationship count")}
          ${diagram2DiagnosticItemHtml("dirty-flush-count", "Dirty flush count")}
          ${diagram2DiagnosticItemHtml("last-flush-duration", "Last flush duration")}
          ${diagram2DiagnosticItemHtml("geometry-preview-active", "Geometry preview active")}
          ${diagram2DiagnosticItemHtml("geometry-preview-reason", "Geometry preview reason")}
          ${diagram2DiagnosticItemHtml("geometry-preview-object-ids", "Preview object IDs")}
          ${diagram2DiagnosticItemHtml("geometry-preview-relationship-ids", "Preview relationship IDs")}
          ${diagram2DiagnosticItemHtml("geometry-preview-frame-count", "Preview frame count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-patched-object-count", "Preview patched object count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-relationship-count", "Preview relationship count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-last-duration", "Preview last duration")}
          ${diagram2DiagnosticItemHtml("geometry-preview-commit-count", "Preview commit count")}
          ${diagram2DiagnosticItemHtml("geometry-preview-undo-entry-count", "Preview undo entries")}
          ${diagram2DiagnosticItemHtml("geometry-preview-initial-matrix", "Preview initial matrix")}
          ${diagram2DiagnosticItemHtml("geometry-preview-settled-route-count", "Preview settled routes")}
          ${diagram2DiagnosticItemHtml("pending-geometry-preview", "Pending geometry preview")}
          ${diagram2DiagnosticItemHtml("selective-routing-total-relationships", "Selective routing total relationships")}
          ${diagram2DiagnosticItemHtml("selective-routing-relationships-considered", "Relationships considered")}
          ${diagram2DiagnosticItemHtml("selective-routing-relationships-rerouted", "Relationships rerouted")}
          ${diagram2DiagnosticItemHtml("selective-routing-cache-hits", "Route cache hits")}
          ${diagram2DiagnosticItemHtml("selective-routing-cache-misses", "Route cache misses")}
          ${diagram2DiagnosticItemHtml("selective-routing-spatial-sectors-queried", "Spatial sectors queried")}
          ${diagram2DiagnosticItemHtml("selective-routing-duration", "Selective routing duration")}
          ${diagram2DiagnosticItemHtml("viewport-halo-active", "Viewport halo active")}
          ${diagram2DiagnosticItemHtml("viewport-halo-reason", "Viewport halo reason")}
          ${diagram2DiagnosticItemHtml("viewport-halo-fallback-reason", "Viewport halo fallback")}
          ${diagram2DiagnosticItemHtml("viewport-halo-sector-size", "Viewport halo sector size")}
          ${diagram2DiagnosticItemHtml("viewport-halo-sector-count", "Viewport halo sector count")}
          ${diagram2DiagnosticItemHtml("viewport-halo-object-coverage", "Viewport object coverage")}
          ${diagram2DiagnosticItemHtml("viewport-halo-relationship-coverage", "Viewport relationship coverage")}
          ${diagram2DiagnosticItemHtml("viewport-halo-combined-coverage", "Viewport combined coverage")}
          ${diagram2DiagnosticItemHtml("viewport-halo-target-object-count", "Viewport target objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-target-relationship-count", "Viewport target relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-virtualized-object-count", "Virtualized objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-virtualized-relationship-count", "Virtualized relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-force-mounted-object-count", "Force-mounted objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-force-mounted-relationship-count", "Force-mounted relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-route-only-relationship-count", "Route-only halo relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-entering-object-count", "Entering objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-leaving-object-count", "Leaving objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-retained-object-count", "Retained objects")}
          ${diagram2DiagnosticItemHtml("viewport-halo-entering-relationship-count", "Entering relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-leaving-relationship-count", "Leaving relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-retained-relationship-count", "Retained relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-object-patch-count", "Viewport object patches")}
          ${diagram2DiagnosticItemHtml("viewport-halo-relationship-patch-count", "Viewport relationship patches")}
          ${diagram2DiagnosticItemHtml("viewport-halo-routed-relationship-count", "Viewport routed relationships")}
          ${diagram2DiagnosticItemHtml("viewport-halo-same-sector-noop", "Same-sector no-op")}
          ${diagram2DiagnosticItemHtml("viewport-halo-duration", "Viewport halo duration")}
          ${diagram2DiagnosticItemHtml("overview-detail-level", "Overview detail level")}
          ${diagram2DiagnosticItemHtml("overview-detail-reason", "Overview detail reason")}
          ${diagram2DiagnosticItemHtml("overview-detail-previous-level", "Previous detail level")}
          ${diagram2DiagnosticItemHtml("overview-detail-changed", "Detail level changed")}
          ${diagram2DiagnosticItemHtml("overview-detail-projected-row-pixels", "Projected row pixels")}
          ${diagram2DiagnosticItemHtml("overview-detail-enter-row-pixels", "Low-detail enter px")}
          ${diagram2DiagnosticItemHtml("overview-detail-exit-row-pixels", "Low-detail exit px")}
          ${diagram2DiagnosticItemHtml("overview-detail-entity-count", "Overview Entity count")}
          ${diagram2DiagnosticItemHtml("overview-detail-low-object-count", "Low-detail objects")}
          ${diagram2DiagnosticItemHtml("overview-detail-detailed-object-count", "Detailed objects")}
          ${diagram2DiagnosticItemHtml("overview-detail-low-relationship-count", "Low-detail relationships")}
          ${diagram2DiagnosticItemHtml("overview-detail-detailed-relationship-count", "Detailed relationships")}
          ${diagram2DiagnosticItemHtml("overview-detail-object-patch-count", "Detail object patches")}
          ${diagram2DiagnosticItemHtml("overview-detail-relationship-patch-count", "Detail relationship patches")}
          ${diagram2DiagnosticItemHtml("overview-detail-duration", "Overview detail duration")}
          ${diagram2DiagnosticItemHtml("last-frame-duration", "Last frame duration")}
          ${diagram2DiagnosticItemHtml("transient-matrix", "Transient matrix")}
          ${diagram2DiagnosticItemHtml("committed-matrix", "Committed matrix")}
          ${diagram2DiagnosticItemHtml("matrix-difference", "Matrix difference")}
          ${diagram2DiagnosticItemHtml("cursor-screen-point", "Cursor screen point")}
          ${diagram2DiagnosticItemHtml("world-point-under-cursor", "World point under cursor")}
          ${diagram2DiagnosticItemHtml("screen-point-after-settle", "Screen point after settle")}
          ${diagram2DiagnosticItemHtml("entity-bounding-box-before-settle", "Entity bounding box before settle")}
          ${diagram2DiagnosticItemHtml("entity-bounding-box-after-settle", "Entity bounding box after settle")}
          ${diagram2DiagnosticItemHtml("node-identity-before-after", "Node identity before/after")}
          ${diagram2DiagnosticItemHtml("full-renders-during-settle", "Full renders during settle")}
          ${diagram2DiagnosticItemHtml("routes-recalculated-during-settle", "Routes recalculated during settle")}
        </dl>
      </section>
    `;
  }

  function diagram2DiagnosticItemHtml(key, label) {
    return `<div><dt>${escapeHtml(label)}</dt><dd data-diagram2-diagnostic="${escapeAttr(key)}">-</dd></div>`;
  }

  function updateDiagram2Diagnostics(diagnostics, message = "") {
    const values = diagnostics ? {
      "canonical-object-count": diagnostics.canonicalObjectCount,
      "canonical-entity-count": diagnostics.canonicalEntityCount,
      "canonical-relationship-count": diagnostics.canonicalRelationshipCount,
      "mounted-object-count": diagnostics.mountedObjectCount,
      "mounted-relationship-count": diagnostics.mountedRelationshipCount,
      "svg-descendant-count": diagnostics.svgDescendantCount,
      "full-render-count": diagnostics.fullRenderCount,
      "full-render-reason": diagnostics.fullRenderReason,
      "objects-patched-in-last-flush": diagnostics.objectsPatchedInLastFlush,
      "relationships-routed-in-last-flush": diagnostics.relationshipsRoutedInLastFlush,
      "dirty-flush-reason": diagnostics.dirtyFlushReason,
      "dirty-object-ids": diagnostics.dirtyObjectIds,
      "dirty-relationship-ids": diagnostics.dirtyRelationshipIds,
      "patched-node-count": diagnostics.patchedNodeCount,
      "routed-relationship-count": diagnostics.routedRelationshipCount,
      "dirty-flush-count": diagnostics.dirtyFlushCount,
      "last-flush-duration": `${diagnostics.lastFlushDuration} ms`,
      "geometry-preview-active": diagnostics.geometryPreviewActive,
      "geometry-preview-reason": diagnostics.geometryPreviewReason,
      "geometry-preview-object-ids": diagnostics.geometryPreviewObjectIds,
      "geometry-preview-relationship-ids": diagnostics.geometryPreviewRelationshipIds,
      "geometry-preview-frame-count": diagnostics.geometryPreviewFrameCount,
      "geometry-preview-patched-object-count": diagnostics.geometryPreviewPatchedObjectCount,
      "geometry-preview-relationship-count": diagnostics.geometryPreviewRelationshipCount,
      "geometry-preview-last-duration": `${diagnostics.geometryPreviewLastDuration} ms`,
      "geometry-preview-commit-count": diagnostics.geometryPreviewCommitCount,
      "geometry-preview-undo-entry-count": diagnostics.geometryPreviewUndoEntryCount,
      "geometry-preview-initial-matrix": diagnostics.geometryPreviewInitialMatrix,
      "geometry-preview-settled-route-count": diagnostics.geometryPreviewSettledRouteCount,
      "pending-geometry-preview": diagnostics.pendingGeometryPreview,
      "selective-routing-total-relationships": diagnostics.selectiveRoutingTotalRelationships,
      "selective-routing-relationships-considered": diagnostics.selectiveRoutingRelationshipsConsidered,
      "selective-routing-relationships-rerouted": diagnostics.selectiveRoutingRelationshipsRerouted,
      "selective-routing-cache-hits": diagnostics.selectiveRoutingCacheHits,
      "selective-routing-cache-misses": diagnostics.selectiveRoutingCacheMisses,
      "selective-routing-spatial-sectors-queried": diagnostics.selectiveRoutingSpatialSectorsQueried,
      "selective-routing-duration": `${diagnostics.selectiveRoutingDuration} ms`,
      "viewport-halo-active": diagnostics.viewportHaloActive,
      "viewport-halo-reason": diagnostics.viewportHaloReason,
      "viewport-halo-fallback-reason": diagnostics.viewportHaloFallbackReason,
      "viewport-halo-sector-size": diagnostics.viewportHaloSectorSize,
      "viewport-halo-sector-count": diagnostics.viewportHaloSectorCount,
      "viewport-halo-object-coverage": diagnostics.viewportHaloObjectCoverage,
      "viewport-halo-relationship-coverage": diagnostics.viewportHaloRelationshipCoverage,
      "viewport-halo-combined-coverage": diagnostics.viewportHaloCombinedCoverage,
      "viewport-halo-target-object-count": diagnostics.viewportHaloTargetObjectCount,
      "viewport-halo-target-relationship-count": diagnostics.viewportHaloTargetRelationshipCount,
      "viewport-halo-virtualized-object-count": diagnostics.viewportHaloVirtualizedObjectCount,
      "viewport-halo-virtualized-relationship-count": diagnostics.viewportHaloVirtualizedRelationshipCount,
      "viewport-halo-force-mounted-object-count": diagnostics.viewportHaloForceMountedObjectCount,
      "viewport-halo-force-mounted-relationship-count": diagnostics.viewportHaloForceMountedRelationshipCount,
      "viewport-halo-route-only-relationship-count": diagnostics.viewportHaloRouteOnlyRelationshipCount,
      "viewport-halo-entering-object-count": diagnostics.viewportHaloEnteringObjectCount,
      "viewport-halo-leaving-object-count": diagnostics.viewportHaloLeavingObjectCount,
      "viewport-halo-retained-object-count": diagnostics.viewportHaloRetainedObjectCount,
      "viewport-halo-entering-relationship-count": diagnostics.viewportHaloEnteringRelationshipCount,
      "viewport-halo-leaving-relationship-count": diagnostics.viewportHaloLeavingRelationshipCount,
      "viewport-halo-retained-relationship-count": diagnostics.viewportHaloRetainedRelationshipCount,
      "viewport-halo-object-patch-count": diagnostics.viewportHaloObjectPatchCount,
      "viewport-halo-relationship-patch-count": diagnostics.viewportHaloRelationshipPatchCount,
      "viewport-halo-routed-relationship-count": diagnostics.viewportHaloRoutedRelationshipCount,
      "viewport-halo-same-sector-noop": diagnostics.viewportHaloSameSectorNoop,
      "viewport-halo-duration": `${diagnostics.viewportHaloDuration} ms`,
      "overview-detail-level": diagnostics.overviewDetailLevel,
      "overview-detail-reason": diagnostics.overviewDetailReason,
      "overview-detail-previous-level": diagnostics.overviewDetailPreviousLevel,
      "overview-detail-changed": diagnostics.overviewDetailChanged,
      "overview-detail-projected-row-pixels": diagnostics.overviewDetailProjectedRowPixels,
      "overview-detail-enter-row-pixels": diagnostics.overviewDetailEnterRowPixels,
      "overview-detail-exit-row-pixels": diagnostics.overviewDetailExitRowPixels,
      "overview-detail-entity-count": diagnostics.overviewDetailEntityCount,
      "overview-detail-low-object-count": diagnostics.overviewDetailLowObjectCount,
      "overview-detail-detailed-object-count": diagnostics.overviewDetailDetailedObjectCount,
      "overview-detail-low-relationship-count": diagnostics.overviewDetailLowRelationshipCount,
      "overview-detail-detailed-relationship-count": diagnostics.overviewDetailDetailedRelationshipCount,
      "overview-detail-object-patch-count": diagnostics.overviewDetailObjectPatchCount,
      "overview-detail-relationship-patch-count": diagnostics.overviewDetailRelationshipPatchCount,
      "overview-detail-duration": `${diagnostics.overviewDetailDuration} ms`,
      "last-frame-duration": `${diagnostics.lastFrameDuration} ms`,
      "transient-matrix": diagnostics.transientMatrix,
      "committed-matrix": diagnostics.committedMatrix,
      "matrix-difference": diagnostics.matrixDifference,
      "cursor-screen-point": diagnostics.cursorScreenPoint,
      "world-point-under-cursor": diagnostics.worldPointUnderCursor,
      "screen-point-after-settle": diagnostics.screenPointAfterSettle,
      "entity-bounding-box-before-settle": diagnostics.entityBoundingBoxBeforeSettle,
      "entity-bounding-box-after-settle": diagnostics.entityBoundingBoxAfterSettle,
      "node-identity-before-after": diagnostics.nodeIdentityBeforeAfter,
      "full-renders-during-settle": diagnostics.fullRendersDuringSettle,
      "routes-recalculated-during-settle": diagnostics.routesRecalculatedDuringSettle
    } : {
      "canonical-object-count": message || "-",
      "canonical-entity-count": "-",
      "canonical-relationship-count": "-",
      "mounted-object-count": "-",
      "mounted-relationship-count": "-",
      "svg-descendant-count": "-",
      "full-render-count": "-",
      "full-render-reason": "-",
      "objects-patched-in-last-flush": "-",
      "relationships-routed-in-last-flush": "-",
      "dirty-flush-reason": "-",
      "dirty-object-ids": "-",
      "dirty-relationship-ids": "-",
      "patched-node-count": "-",
      "routed-relationship-count": "-",
      "dirty-flush-count": "-",
      "last-flush-duration": "-",
      "geometry-preview-active": "-",
      "geometry-preview-reason": "-",
      "geometry-preview-object-ids": "-",
      "geometry-preview-relationship-ids": "-",
      "geometry-preview-frame-count": "-",
      "geometry-preview-patched-object-count": "-",
      "geometry-preview-relationship-count": "-",
      "geometry-preview-last-duration": "-",
      "geometry-preview-commit-count": "-",
      "geometry-preview-undo-entry-count": "-",
      "geometry-preview-initial-matrix": "-",
      "geometry-preview-settled-route-count": "-",
      "pending-geometry-preview": "-",
      "selective-routing-total-relationships": "-",
      "selective-routing-relationships-considered": "-",
      "selective-routing-relationships-rerouted": "-",
      "selective-routing-cache-hits": "-",
      "selective-routing-cache-misses": "-",
      "selective-routing-spatial-sectors-queried": "-",
      "selective-routing-duration": "-",
      "viewport-halo-active": "-",
      "viewport-halo-reason": "-",
      "viewport-halo-fallback-reason": "-",
      "viewport-halo-sector-size": "-",
      "viewport-halo-sector-count": "-",
      "viewport-halo-object-coverage": "-",
      "viewport-halo-relationship-coverage": "-",
      "viewport-halo-combined-coverage": "-",
      "viewport-halo-target-object-count": "-",
      "viewport-halo-target-relationship-count": "-",
      "viewport-halo-virtualized-object-count": "-",
      "viewport-halo-virtualized-relationship-count": "-",
      "viewport-halo-force-mounted-object-count": "-",
      "viewport-halo-force-mounted-relationship-count": "-",
      "viewport-halo-route-only-relationship-count": "-",
      "viewport-halo-entering-object-count": "-",
      "viewport-halo-leaving-object-count": "-",
      "viewport-halo-retained-object-count": "-",
      "viewport-halo-entering-relationship-count": "-",
      "viewport-halo-leaving-relationship-count": "-",
      "viewport-halo-retained-relationship-count": "-",
      "viewport-halo-object-patch-count": "-",
      "viewport-halo-relationship-patch-count": "-",
      "viewport-halo-routed-relationship-count": "-",
      "viewport-halo-same-sector-noop": "-",
      "viewport-halo-duration": "-",
      "overview-detail-level": "-",
      "overview-detail-reason": "-",
      "overview-detail-previous-level": "-",
      "overview-detail-changed": "-",
      "overview-detail-projected-row-pixels": "-",
      "overview-detail-enter-row-pixels": "-",
      "overview-detail-exit-row-pixels": "-",
      "overview-detail-entity-count": "-",
      "overview-detail-low-object-count": "-",
      "overview-detail-detailed-object-count": "-",
      "overview-detail-low-relationship-count": "-",
      "overview-detail-detailed-relationship-count": "-",
      "overview-detail-object-patch-count": "-",
      "overview-detail-relationship-patch-count": "-",
      "overview-detail-duration": "-",
      "last-frame-duration": "-",
      "transient-matrix": "-",
      "committed-matrix": "-",
      "matrix-difference": "-",
      "cursor-screen-point": "-",
      "world-point-under-cursor": "-",
      "screen-point-after-settle": "-",
      "entity-bounding-box-before-settle": "-",
      "entity-bounding-box-after-settle": "-",
      "node-identity-before-after": "-",
      "full-renders-during-settle": "-",
      "routes-recalculated-during-settle": "-"
    };

    Object.entries(values).forEach(([key, value]) => {
      const node = app.querySelector(`[data-diagram2-diagnostic="${key}"]`);
      if (node) node.textContent = String(value ?? "-");
    });
  }

  function applyDiagram2ViewerZoom() {
    const zoomControl = app.querySelector("[data-filter='diagram2-zoom']");
    if (zoomControl) zoomControl.value = diagram2ViewerZoom;
    const diagnostics = diagram2ViewerZoom === "fit"
      ? diagram2Renderer?.fit()
      : diagram2Renderer?.setZoom(diagram2ViewerZoom);
    if (diagnostics) updateDiagram2Diagnostics(diagnostics);
  }

  function refreshDiagram2Renderer() {
    if (!diagram2Renderer || !diagram2RendererState || !diagram2RendererDocumentId) return;
    diagram2SelectedObjectIds = diagram2SelectedObjectIds.filter(id =>
      diagram2RendererState.objects.some(object => object.id === id));
    let diagnostics = diagram2Renderer.render(diagram2RendererState, {
      reason: "refresh"
    });
    diagnostics = diagram2Renderer.setZoom(diagram2ViewerZoom);
    diagnostics = diagram2Renderer.setSelectedIds(diagram2SelectedObjectIds);
    updateDiagram2Diagnostics(diagnostics);
    updateDiagram2EditorControls();
  }

  function resetDiagram2Renderer() {
    abortDiagram2ViewportControls();
    diagram2Renderer?.destroy?.();
    if (globalThis.__pmtDiagram2Renderer === diagram2Renderer) {
      globalThis.__pmtDiagram2Renderer = null;
    }
    globalThis.__pmtDiagram2Compatibility = null;
    globalThis.__pmtDiagram2SelectionClipboard = null;
    diagram2Renderer = null;
    diagram2RendererDocumentId = 0;
    diagram2RendererState = null;
    diagram2SelectedObjectIds = [];
    diagram2History = [];
    diagram2HistoryIndex = -1;
    diagram2SavedHistoryJson = "";
    diagram2Dirty = false;
    diagram2Busy = false;
  }

  function bindDiagram2Controls() {
    bindDiagram2SearchInput();
    bindDiagram2TreeSplitter();
  }

  function bindDiagram2ViewportControls(viewer) {
    abortDiagram2ViewportControls();
    const canvas = viewer?.querySelector("[data-diagram2-viewer-canvas]");
    if (!canvas) return;

    viewportAbortController = new AbortController();
    const { signal } = viewportAbortController;
    window.addEventListener("keydown", event => {
      if (!active || !diagram2Renderer || diagram2Busy || diagram2EditableEventTarget(event.target)) return;

      const key = String(event.key || "").toLowerCase();
      const usesCommandKey = event.ctrlKey || event.metaKey;
      if (usesCommandKey && key === "s") {
        event.preventDefault();
        void saveDiagram2Document();
        return;
      }
      if (usesCommandKey && key === "z") {
        event.preventDefault();
        void (event.shiftKey ? redoDiagram2() : undoDiagram2());
        return;
      }
      if (usesCommandKey && key === "y") {
        event.preventDefault();
        void redoDiagram2();
        return;
      }
      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        void moveDiagram2SelectedObjects(0, -step, { reason: "keyboard nudge" });
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        void moveDiagram2SelectedObjects(0, step, { reason: "keyboard nudge" });
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        void moveDiagram2SelectedObjects(-step, 0, { reason: "keyboard nudge" });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        void moveDiagram2SelectedObjects(step, 0, { reason: "keyboard nudge" });
      }
    }, { signal });

    canvas.addEventListener("wheel", event => {
      if (!diagram2Renderer) return;
      event.preventDefault();
      const deltaScale = Math.exp(-event.deltaY * 0.0015);
      const diagnostics = diagram2Renderer.zoomBy(deltaScale, {
        clientX: event.clientX,
        clientY: event.clientY
      });
      updateDiagram2Diagnostics(diagnostics);
    }, { passive: false, signal });

    canvas.addEventListener("pointerdown", event => {
      if (!diagram2Renderer || event.button !== 0) return;
      event.preventDefault();

      const objectNode = event.target.closest?.("[data-diagram2-object-id]");
      if (objectNode && canvas.contains(objectNode)) {
        startDiagram2ObjectDrag(canvas, objectNode.dataset.diagram2ObjectId, event);
        return;
      }

      setDiagram2Selection([]);
      abortDiagram2Pan();
      viewportPanAbortController = new AbortController();
      const panSignal = viewportPanAbortController.signal;
      let lastPoint = { x: event.clientX, y: event.clientY };
      canvas.classList.add("is-panning");
      canvas.setPointerCapture?.(event.pointerId);

      const move = moveEvent => {
        const deltaX = moveEvent.clientX - lastPoint.x;
        const deltaY = moveEvent.clientY - lastPoint.y;
        lastPoint = { x: moveEvent.clientX, y: moveEvent.clientY };
        const diagnostics = diagram2Renderer?.panBy(deltaX, deltaY);
        if (diagnostics) updateDiagram2Diagnostics(diagnostics);
      };
      const finish = () => {
        canvas.classList.remove("is-panning");
        abortDiagram2Pan();
      };

      window.addEventListener("pointermove", move, { signal: panSignal });
      window.addEventListener("pointerup", finish, { signal: panSignal, once: true });
      window.addEventListener("pointercancel", finish, { signal: panSignal, once: true });
    }, { signal });
  }

  function abortDiagram2ViewportControls() {
    abortDiagram2Pan();
    viewportAbortController?.abort();
    viewportAbortController = null;
  }

  function abortDiagram2Pan() {
    viewportPanAbortController?.abort();
    viewportPanAbortController = null;
    app.querySelector("[data-diagram2-viewer-canvas]")?.classList.remove("is-panning");
    app.querySelector("[data-diagram2-viewer-canvas]")?.classList.remove("is-moving-object");
  }

  function startDiagram2ObjectDrag(canvas, objectId, event) {
    const selectedIds = diagram2PointerSelection(objectId, event);
    setDiagram2Selection(selectedIds);
    abortDiagram2Pan();

    const startWorld = diagram2Renderer.screenToWorld({ clientX: event.clientX, clientY: event.clientY });
    let latestDelta = { deltaX: 0, deltaY: 0 };
    let moved = false;
    diagram2Renderer.beginGeometryPreview({ objectIds: selectedIds, mode: "move" });
    canvas.classList.add("is-moving-object");
    canvas.setPointerCapture?.(event.pointerId);
    viewportPanAbortController = new AbortController();
    const { signal } = viewportPanAbortController;

    const move = moveEvent => {
      const currentWorld = diagram2Renderer?.screenToWorld({ clientX: moveEvent.clientX, clientY: moveEvent.clientY });
      if (!currentWorld) return;
      latestDelta = {
        deltaX: currentWorld.x - startWorld.x,
        deltaY: currentWorld.y - startWorld.y
      };
      moved = moved
        || Math.abs(latestDelta.deltaX) > 0.5
        || Math.abs(latestDelta.deltaY) > 0.5;
      const diagnostics = diagram2Renderer?.previewGeometry(latestDelta);
      if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    };

    const finish = () => {
      const renderer = diagram2Renderer;
      const currentState = diagram2RendererState;
      canvas.classList.remove("is-moving-object");
      abortDiagram2Pan();
      if (!renderer || !currentState) return;
      if (!moved) {
        const diagnostics = renderer.cancelGeometryPreview();
        updateDiagram2Diagnostics(diagnostics);
        updateDiagram2EditorControls();
        return;
      }

      let diagnostics = renderer.commitGeometryPreview(latestDelta);
      diagram2RendererState = moveDiagram2ObjectsInState(currentState, selectedIds, latestDelta.deltaX, latestDelta.deltaY);
      pushDiagram2History(diagram2RendererState);
      updateDiagram2Diagnostics(diagnostics);
      updateDiagram2EditorControls();
      void renderer.whenIdle().then(idleDiagnostics => {
        if (renderer === diagram2Renderer) updateDiagram2Diagnostics(idleDiagnostics);
      });
    };

    window.addEventListener("pointermove", move, { signal });
    window.addEventListener("pointerup", finish, { signal, once: true });
    window.addEventListener("pointercancel", finish, { signal, once: true });
  }

  function diagram2PointerSelection(objectId, event) {
    const id = String(objectId || "").trim();
    if (!id || !diagram2RendererState?.objects?.some(object => object.id === id)) return [];
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) return [id];

    const selected = new Set(diagram2SelectedObjectIds);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    return [...selected];
  }

  function setDiagram2Selection(ids) {
    const existingIds = new Set((diagram2RendererState?.objects || []).map(object => object.id));
    diagram2SelectedObjectIds = uniqueStrings(ids).filter(id => existingIds.has(id));
    const diagnostics = diagram2Renderer?.setSelectedIds(diagram2SelectedObjectIds);
    if (diagnostics) updateDiagram2Diagnostics(diagnostics);
    updateDiagram2EditorControls();
  }

  async function moveDiagram2SelectedObjects(deltaX, deltaY, options = {}) {
    if (!diagram2Renderer || !diagram2RendererState || diagram2Busy || !diagram2SelectedObjectIds.length) return false;
    const dx = finiteNumber(deltaX, 0);
    const dy = finiteNumber(deltaY, 0);
    if (!dx && !dy) return false;

    const selectedIds = [...diagram2SelectedObjectIds];
    const nextState = moveDiagram2ObjectsInState(diagram2RendererState, selectedIds, dx, dy);
    if (diagram2StateJson(nextState) === diagram2StateJson(diagram2RendererState)) return false;

    diagram2Renderer.beginDiagramUpdate(options.reason || "move selection");
    selectedIds.forEach(id => {
      diagram2Renderer.updateObject(id, object => moveDiagram2ObjectGeometry(object, dx, dy));
    });
    let diagnostics = diagram2Renderer.endDiagramUpdate(options.reason || "move selection");
    diagram2RendererState = nextState;
    pushDiagram2History(diagram2RendererState);
    updateDiagram2Diagnostics(diagnostics);
    updateDiagram2EditorControls();
    diagnostics = await diagram2Renderer.whenIdle();
    updateDiagram2Diagnostics(diagnostics);
    return true;
  }

  async function saveDiagram2Document() {
    if (diagram2Busy) return false;
    const document = currentDiagram2Document();
    if (!document || !diagram2RendererState) {
      notify?.("Select a Diagram before saving.");
      return false;
    }
    if (typeof saveDiagramDocument !== "function") {
      notify?.("Diagram 2 save is not available.");
      return false;
    }

    diagram2Busy = true;
    updateDiagram2EditorControls();
    try {
      await diagram2Renderer?.whenIdle();
      const stateForSave = normalizeDiagram2CanonicalState(diagram2RendererState);
      const saved = await saveDiagramDocument(document, {
        diagram: {
          state: stateForSave,
          svg: buildAnnotationSvg(stateForSave),
          fileName: `${safeFileName(document.title)}.svg`
        }
      });
      diagram2RendererState = stateForSave;
      if (saved?.id) {
        selectedDiagramDocumentId = Number(saved.id);
        diagram2RendererDocumentId = Number(saved.id);
        writePreference(preferenceKeys.diagram2SelectedDocument, selectedDiagramDocumentId);
      }
      diagram2SavedHistoryJson = diagram2StateJson(diagram2RendererState);
      updateDiagram2DirtyFromHistory();
      notify?.("Diagram 2 saved.");
      return true;
    } catch (error) {
      notify?.(diagram2SaveConflict(error)
        ? "A newer version exists. Diagram 2 did not overwrite it."
        : (error?.message || "Diagram 2 could not save the Diagram."));
      return false;
    } finally {
      diagram2Busy = false;
      updateDiagram2EditorControls();
    }
  }

  async function exportDiagram2Pmt() {
    const document = currentDiagram2Document();
    if (!document || !diagram2RendererState) return false;
    await diagram2Renderer?.whenIdle();
    const stateForExport = normalizeDiagram2CanonicalState(diagram2RendererState);
    const contents = createDiagram2PmtDiagramFile({
      title: document.title,
      state: stateForExport,
      svg: buildAnnotationSvg(stateForExport)
    });
    downloadTextFile(contents, `${safeFileName(document.title)}.pmt-diagram.json`, "application/json");
    notify?.("PMT Diagram exported.");
    return true;
  }

  async function exportDiagram2Svg() {
    const document = currentDiagram2Document();
    if (!document || !diagram2RendererState) return false;
    await diagram2Renderer?.whenIdle();
    const svg = buildAnnotationSvg(normalizeDiagram2CanonicalState(diagram2RendererState));
    downloadTextFile(svg, `${safeFileName(document.title)}.svg`, "image/svg+xml");
    notify?.("Diagram exported as SVG.");
    return true;
  }

  async function exportDiagram2Png() {
    const document = currentDiagram2Document();
    if (!document || !diagram2RendererState) return false;
    await diagram2Renderer?.whenIdle();
    try {
      const svg = buildAnnotationSvg(normalizeDiagram2CanonicalState(diagram2RendererState));
      const blob = await diagram2SvgToPngBlob(svg);
      downloadBlobFile(blob, `${safeFileName(document.title)}.png`);
      notify?.("Diagram exported as PNG.");
      return true;
    } catch (error) {
      notify?.(error?.message || "Diagram 2 could not export the PNG.");
      return false;
    }
  }

  async function copyDiagram2Selection() {
    if (!diagram2RendererState || !diagram2SelectedObjectIds.length) {
      notify?.("Select one or more Diagram objects before copying.");
      return false;
    }
    await diagram2Renderer?.whenIdle();
    const text = createDiagram2SelectionClipboardText({
      state: normalizeDiagram2CanonicalState(diagram2RendererState),
      selectedObjectIds: diagram2SelectedObjectIds
    });
    globalThis.__pmtDiagram2SelectionClipboard = text;
    const copied = await copyTextToClipboard(text);
    notify?.(copied ? "Diagram selection copied." : "Diagram selection is ready, but the browser blocked clipboard copy.");
    return copied;
  }

  async function undoDiagram2() {
    if (diagram2HistoryIndex <= 0 || diagram2Busy) return false;
    return restoreDiagram2History(diagram2HistoryIndex - 1, "undo");
  }

  async function redoDiagram2() {
    if (diagram2HistoryIndex >= diagram2History.length - 1 || diagram2Busy) return false;
    return restoreDiagram2History(diagram2HistoryIndex + 1, "redo");
  }

  async function restoreDiagram2History(index, reason) {
    if (!diagram2Renderer || index < 0 || index >= diagram2History.length) return false;
    diagram2HistoryIndex = index;
    diagram2RendererState = diagram2StateFromJson(diagram2History[index]);
    diagram2SelectedObjectIds = diagram2SelectedObjectIds.filter(id =>
      diagram2RendererState.objects.some(object => object.id === id));
    updateDiagram2DirtyFromHistory();
    let diagnostics = diagram2Renderer.render(diagram2RendererState, { reason });
    diagnostics = diagram2Renderer.setZoom(diagram2ViewerZoom);
    diagnostics = diagram2Renderer.setSelectedIds(diagram2SelectedObjectIds);
    updateDiagram2Diagnostics(diagnostics);
    updateDiagram2EditorControls();
    diagnostics = await diagram2Renderer.whenIdle();
    updateDiagram2Diagnostics(diagnostics);
    return true;
  }

  function initializeDiagram2History(stateInput) {
    const json = diagram2StateJson(stateInput);
    diagram2History = [json];
    diagram2HistoryIndex = 0;
    diagram2SavedHistoryJson = json;
    updateDiagram2DirtyFromHistory();
  }

  function pushDiagram2History(stateInput) {
    const json = diagram2StateJson(stateInput);
    if (diagram2History[diagram2HistoryIndex] === json) {
      updateDiagram2DirtyFromHistory();
      return false;
    }

    diagram2History = diagram2History.slice(0, diagram2HistoryIndex + 1);
    diagram2History.push(json);
    if (diagram2History.length > diagram2HistoryLimit) {
      const removed = diagram2History.shift();
      if (diagram2SavedHistoryJson === removed) diagram2SavedHistoryJson = "";
    }
    diagram2HistoryIndex = diagram2History.length - 1;
    updateDiagram2DirtyFromHistory();
    return true;
  }

  function updateDiagram2DirtyFromHistory() {
    diagram2Dirty = Boolean(diagram2SavedHistoryJson)
      ? diagram2History[diagram2HistoryIndex] !== diagram2SavedHistoryJson
      : diagram2HistoryIndex >= 0;
  }

  function updateDiagram2EditorControls() {
    const hasDocument = Boolean(currentDiagram2Document() && diagram2RendererState);
    const hasSelection = diagram2SelectedObjectIds.length > 0;
    const canUndo = diagram2HistoryIndex > 0;
    const canRedo = diagram2HistoryIndex >= 0 && diagram2HistoryIndex < diagram2History.length - 1;
    const saveState = app.querySelector("[data-diagram2-save-state]");
    const editState = app.querySelector("[data-diagram2-edit-state]");
    const statusText = diagram2Busy ? "Saving..." : (diagram2Dirty ? "Unsaved changes" : "Saved");
    if (saveState) saveState.textContent = statusText;
    if (editState) editState.textContent = hasSelection
      ? `${diagram2SelectedObjectIds.length} selected`
      : statusText;
    app.querySelector("[data-diagram2-screen]")?.classList.toggle("has-unsaved-diagram2", diagram2Dirty);

    app.querySelectorAll("[data-diagram2-requires-document]").forEach(button => {
      button.disabled = !hasDocument || diagram2Busy;
    });
    app.querySelectorAll("[data-diagram2-requires-dirty]").forEach(button => {
      button.disabled = !hasDocument || !diagram2Dirty || diagram2Busy;
    });
    app.querySelectorAll("[data-diagram2-requires-selection]").forEach(button => {
      button.disabled = !hasDocument || !hasSelection || diagram2Busy;
    });
    app.querySelectorAll("[data-diagram2-requires-undo]").forEach(button => {
      button.disabled = !hasDocument || !canUndo || diagram2Busy;
    });
    app.querySelectorAll("[data-diagram2-requires-redo]").forEach(button => {
      button.disabled = !hasDocument || !canRedo || diagram2Busy;
    });
  }

  function bindDiagram2SearchInput() {
    const search = app.querySelector("[data-filter='diagram2-search']");
    if (!search) return;
    search.addEventListener("input", event => {
      diagram2Search = String(event.target.value || "").trim();
      writePreference(preferenceKeys.diagram2Search, diagram2Search);
      render();
      app.querySelector("[data-filter='diagram2-search']")?.focus({ preventScroll: true });
    });
  }

  function bindDiagram2TreeSplitter() {
    const splitter = app.querySelector("[data-diagram2-tree-splitter]");
    const screen = app.querySelector("[data-diagram2-screen]");
    if (!splitter || !screen || diagram2TreePaneHidden) return;

    splitter.addEventListener("pointerdown", event => {
      event.preventDefault();
      dragAbortController?.abort();
      dragAbortController = new AbortController();
      const { signal } = dragAbortController;
      splitter.setPointerCapture?.(event.pointerId);
      screen.classList.add("is-resizing-tree");

      const move = moveEvent => {
        const bounds = screen.getBoundingClientRect();
        diagram2TreePaneWidth = clampTreePaneWidth(moveEvent.clientX - bounds.left);
        screen.style.setProperty("--diagram2-tree-width", `${diagram2TreePaneWidth}px`);
      };
      const finish = () => {
        writePreference(preferenceKeys.diagram2TreePaneWidth, diagram2TreePaneWidth);
        screen.classList.remove("is-resizing-tree");
        abortTreePaneDrag();
      };
      window.addEventListener("pointermove", move, { signal });
      window.addEventListener("pointerup", finish, { signal, once: true });
      window.addEventListener("pointercancel", finish, { signal, once: true });
    });
  }

  function abortTreePaneDrag() {
    dragAbortController?.abort();
    dragAbortController = null;
  }

  function diagram2Documents(allDocuments, directDocumentId) {
    const directDocument = allDocuments.find(document => document.id === directDocumentId);
    const documents = allDocuments.filter(diagram2MatchesFilters);
    if (directDocument && !documents.some(document => document.id === directDocument.id)) documents.push(directDocument);
    return documents.sort(diagram2DocumentCompare);
  }

  function diagram2AllDocuments() {
    return diagramAllDocuments(state.blogs, currentUserId);
  }

  function currentDiagram2Document() {
    return diagram2AllDocuments().find(document => document.id === selectedDiagramDocumentId) || null;
  }

  function diagram2MatchesFilters(document) {
    if (diagram2ProjectId && Number(document.projectId || 0) !== diagram2ProjectId) return false;
    if (diagram2SprintId !== "all" && Number(document.sprintId || 0) !== Number(diagram2SprintId || 0)) return false;
    if (diagram2Visibility === "private" && document.isPrivate === false) return false;
    if (diagram2Visibility === "public" && document.isPrivate !== false) return false;
    if (diagram2CreatorFilters.length && !diagram2CreatorFilters.includes(String(document.createdByUserId || ""))) return false;
    if (diagram2LastEditorFilters.length && !diagram2LastEditorFilters.includes(String(diagramLastEditorUserId(document)))) return false;
    if (!diagram2Search) return true;

    const project = state.projects.find(item => item.id === Number(document.projectId || 0));
    const sprint = state.sprints.find(item => item.id === Number(document.sprintId || 0));
    return [
      document.title,
      project?.code,
      project?.title,
      project?.name,
      sprint?.code,
      sprint?.title,
      document.isPrivate === false ? "public" : "private"
    ].filter(Boolean).join(" ").toLowerCase().includes(diagram2Search.toLowerCase());
  }

  function diagram2DocumentCompare(left, right) {
    if (diagram2Sort === "name") {
      return String(left.title || "").localeCompare(String(right.title || "")) || left.id - right.id;
    }
    if (diagram2Sort === "oldest") {
      return diagramUpdatedTime(left) - diagramUpdatedTime(right)
        || String(left.title || "").localeCompare(String(right.title || ""))
        || left.id - right.id;
    }
    if (diagram2Sort === "custom") return diagram2CustomCompare(left, right);
    return diagram2LatestCompare(left, right);
  }

  function diagram2LatestCompare(left, right) {
    return diagramUpdatedTime(right) - diagramUpdatedTime(left)
      || String(left.title || "").localeCompare(String(right.title || ""))
      || right.id - left.id;
  }

  function diagram2CustomCompare(left, right) {
    const leftOrder = Number(left.sortOrder || 0);
    const rightOrder = Number(right.sortOrder || 0);
    if (leftOrder && rightOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (leftOrder !== rightOrder) return rightOrder ? -1 : 1;
    return diagram2LatestCompare(left, right);
  }

  return {
    render,
    deactivate,
    handleAction,
    handleFilterChange,
    view,
    isActive: () => active
  };
}

function currentRouteDocumentId() {
  const match = String(globalThis.window?.location?.hash || "").match(/^#\/(?:diagram-2|diagram2)\/(\d+)(?:$|[/?#])/i);
  return positiveRouteId(match?.[1]);
}

function positiveRouteId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function normalizeDiagram2Zoom(value) {
  const zoom = String(value || "fit");
  return diagram2ZoomModes.has(zoom) ? zoom : "fit";
}

function diagram2ZoomOptionsHtml(selectedZoom) {
  return selectOptionsHtml([
    { value: "fit", text: "Fit" },
    { value: "0.1", text: "10%" },
    { value: "0.5", text: "50%" },
    { value: "0.75", text: "75%" },
    { value: "1", text: "100%" },
    { value: "1.25", text: "125%" },
    { value: "1.5", text: "150%" },
    { value: "2", text: "200%" }
  ], selectedZoom);
}

function selectOptionsHtml(options, selectedValue) {
  return options.map(option => `
    <option value="${escapeAttr(option.value)}" ${String(option.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(option.text)}</option>
  `).join("");
}

function checkedDiagram2FilterValues(filterName) {
  try {
    return checkedFilterValues(filterName).map(String);
  } catch {
    return [];
  }
}

function normalizeSavedArray(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function clampTreePaneWidth(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 320;
  return Math.max(diagram2TreePaneMinimumWidth, Math.min(diagram2TreePaneMaximumWidth, Math.round(number)));
}

function projectLabel(project) {
  return [project?.code, project?.title || project?.name]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" - ") || "Project";
}

function diagramProjectLabel(projectId) {
  const project = state.projects.find(item => item.id === Number(projectId || 0));
  return project ? projectLabel(project) : "General";
}

function diagramSprintLabel(sprintId) {
  const sprint = state.sprints.find(item => item.id === Number(sprintId || 0));
  return sprint ? `${sprint.code} - ${sprint.title}` : "No Sprint";
}

function diagramUserName(userId) {
  const user = state.users.find(item => Number(item.id || 0) === Number(userId || 0));
  if (!user) return "User";

  const fullName = [user.firstName, user.lastName]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  const nickname = (user.nickname || "").trim();
  if (fullName && nickname && fullName.toLowerCase() !== nickname.toLowerCase()) return `${fullName} (${nickname})`;

  return fullName || nickname || "User";
}

function diagram2StateJson(stateInput) {
  return JSON.stringify(normalizeDiagram2CanonicalState(stateInput));
}

function diagram2StateFromJson(json) {
  try {
    return normalizeDiagram2CanonicalState(JSON.parse(String(json || "{}")));
  } catch {
    return normalizeDiagram2CanonicalState(null);
  }
}

function moveDiagram2ObjectsInState(stateInput, objectIds, deltaX, deltaY) {
  const state = normalizeDiagram2CanonicalState(stateInput);
  const selectedIds = new Set(uniqueStrings(objectIds));
  if (!selectedIds.size) return state;
  return normalizeDiagram2CanonicalState({
    ...state,
    objects: state.objects.map(object =>
      selectedIds.has(object.id) ? moveDiagram2ObjectGeometry(object, deltaX, deltaY) : object)
  });
}

function moveDiagram2ObjectGeometry(object, deltaX, deltaY) {
  const dx = finiteNumber(deltaX, 0);
  const dy = finiteNumber(deltaY, 0);
  const next = { ...object };
  if (hasOwn(next, "x") || hasOwn(next, "y") || (!hasOwn(next, "x1") && !hasOwn(next, "x2"))) {
    next.x = finiteNumber(next.x, 0) + dx;
    next.y = finiteNumber(next.y, 0) + dy;
  }
  if (hasOwn(next, "x1")) next.x1 = finiteNumber(next.x1, 0) + dx;
  if (hasOwn(next, "y1")) next.y1 = finiteNumber(next.y1, 0) + dy;
  if (hasOwn(next, "x2")) next.x2 = finiteNumber(next.x2, 0) + dx;
  if (hasOwn(next, "y2")) next.y2 = finiteNumber(next.y2, 0) + dy;
  return next;
}

function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : [values])
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .forEach(value => {
      if (seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });
  return result;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function safeFileName(value) {
  return String(value || "diagram")
    .replace(/[^a-z0-9_.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "diagram";
}

function diagram2EditableEventTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, button, [contenteditable='true'], [contenteditable='']"));
}

function diagram2SaveConflict(error) {
  return Number(error?.status || 0) === 409
    || /newer version of this item exists/i.test(String(error?.message || ""));
}

function downloadTextFile(contents, fileName, type) {
  const blob = new Blob([String(contents || "")], { type });
  downloadBlobFile(blob, fileName);
}

function downloadBlobFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function diagram2SvgToPngBlob(svg) {
  const metrics = diagram2SvgMetrics(svg);
  const maximumDimension = 8192;
  const scale = Math.min(1, maximumDimension / metrics.width, maximumDimension / metrics.height);
  const outputWidth = Math.max(1, Math.ceil(metrics.width * scale));
  const outputHeight = Math.max(1, Math.ceil(metrics.height * scale));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.addEventListener("load", () => resolve(element), { once: true });
      element.addEventListener("error", () => reject(new Error("Diagram 2 could not render the SVG as PNG.")), { once: true });
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Diagram 2 could not create the PNG canvas.");
    context.drawImage(image, 0, 0, outputWidth, outputHeight);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Diagram 2 could not create the PNG file."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function diagram2SvgMetrics(svgInput) {
  const parser = new DOMParser();
  const document = parser.parseFromString(String(svgInput || ""), "image/svg+xml");
  const svg = document.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || document.querySelector("parsererror")) {
    return { width: 1, height: 1 };
  }

  const viewBox = String(svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[,\s]+/)
    .map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
    return {
      width: Math.max(1, viewBox[2]),
      height: Math.max(1, viewBox[3])
    };
  }

  return {
    width: Math.max(1, Number.parseFloat(svg.getAttribute("width") || "") || 1),
    height: Math.max(1, Number.parseFloat(svg.getAttribute("height") || "") || 1)
  };
}
