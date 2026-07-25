import { buttonContent } from "../../components/buttons.js?v=20260717-multi-screen-header";
import {
  checkedFilterValues,
  filterCheckList,
  filterSelect
} from "../../components/filters.js";
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
  diagramReadonlyImageResult,
  diagramSourceIsSvg,
  diagramUpdatedTime,
  loadDiagramSvgSource
} from "../../shared/diagram-documents.js?v=20260725-diagram2-day5-v1";
import { formatDate } from "../../shared/dates.js";
import { escapeAttr, escapeHtml } from "../../shared/text-and-links.js";

const diagram2ViewModes = new Set(["tree", "cards"]);
const diagram2SortModes = new Set(["latest", "oldest", "name", "custom"]);
const diagram2VisibilityModes = new Set(["both", "private", "public"]);
const diagram2ZoomModes = new Set(["fit", "0.5", "0.75", "1", "1.25", "1.5", "2"]);
const diagram2TreePaneMinimumWidth = 220;
const diagram2TreePaneMaximumWidth = 560;

export function createDiagram2Feature({ app, notify } = {}) {
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

    app.innerHTML = `
      <section class="diagram2-screen ${diagram2ViewMode === "cards" ? "is-card-view" : "is-tree-view"} ${diagram2TreePaneHidden ? "is-tree-hidden" : ""}" data-diagram2-screen style="--diagram2-tree-width:${diagram2TreePaneWidth}px">
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
      render();
      return true;
    }
    if (action === "diagram2-import-probe") {
      notify?.("Diagram 2 PMT Diagram import is a disabled compatibility probe until a later phase.");
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
    return `
      <span class="diagram2-status">Diagram 2 Beta</span>
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
      <div class="diagram2-zoom-controls" aria-label="Read-only Diagram 2 navigation">
        <select data-filter="diagram2-zoom" aria-label="Zoom level" title="Zoom level" ${selectedDocument ? "" : "disabled"}>
          ${diagram2ZoomOptionsHtml(diagram2ViewerZoom)}
        </select>
        <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="fit-diagram2-viewer" title="Fit Diagram" aria-label="Fit Diagram" ${selectedDocument ? "" : "disabled"}>
          ${buttonContent("&#9633;", "Fit")}
        </button>
      </div>
      <button type="button" class="secondary text-icon-button diagram2-page-action" data-action="diagram2-import-probe" title="Shared PMT Diagram import probe is disabled until the import phase" aria-label="PMT Diagram import probe" disabled>
        ${buttonContent("&#8679;", "Import Probe")}
      </button>
    `;
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

    const image = diagramDocumentImage(document);
    const result = diagramReadonlyImageResult(image?.source || blankDiagramSource, document.title || "Diagram", {
      className: "diagram2-readonly-art"
    });
    return `
      <div class="diagram2-viewer-document-head">
        <div>
          <h2>${escapeHtml(document.title || "Diagram")}</h2>
          <p data-diagram2-edit-disabled>Read-only compatibility renderer. Editing stays disabled in Diagram 2.</p>
        </div>
        <dl class="diagram2-document-meta">
          <div><dt>Visibility</dt><dd>${document.isPrivate === false ? "Public" : "Private"}</dd></div>
          <div><dt>Project</dt><dd>${escapeHtml(diagramProjectLabel(document.projectId))}</dd></div>
          <div><dt>Sprint</dt><dd>${escapeHtml(diagramSprintLabel(document.sprintId))}</dd></div>
          <div><dt>Updated</dt><dd>${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</dd></div>
        </dl>
      </div>
      <div class="diagram2-readonly-viewer ${result.needsSvgHydration ? "is-loading" : ""}" data-diagram2-readonly-viewer data-id="${document.id}" ${result.needsSvgHydration ? `aria-busy="true"` : ""}>
        ${result.needsSvgHydration ? `<div class="diagram2-viewer-loader" role="status" aria-live="polite">Loading...</div>` : ""}
        <div class="diagram2-viewer-canvas" data-diagram2-viewer-canvas>
          ${diagram2ViewerArtHtml(result)}
        </div>
      </div>
    `;
  }

  function diagram2ViewerArtHtml(result) {
    const metrics = result.metrics || { width: 1600, height: 900 };
    const fit = diagram2ViewerZoom === "fit";
    const zoom = fit ? 1 : Number(diagram2ViewerZoom || 1);
    const width = Math.max(1, Math.round(metrics.width * zoom));
    const height = Math.max(1, Math.round(metrics.height * zoom));
    return `
      <div class="diagram2-viewer-artboard ${fit ? "is-fit" : ""}" style="--diagram2-art-width:${width}px; --diagram2-art-height:${height}px">
        ${result.html}
      </div>
    `;
  }

  async function hydrateDiagram2Viewer(token, document) {
    if (!document) return;
    const source = diagramDocumentImage(document)?.source || "";
    if (!diagramSourceIsSvg(source)) return;
    const viewer = app.querySelector(`[data-diagram2-readonly-viewer][data-id="${document.id}"]`);
    if (!viewer?.classList.contains("is-loading")) return;
    await loadDiagramSvgSource(source);
    if (!active || token !== viewerHydrationToken || selectedDiagramDocumentId !== document.id) return;

    const canvas = viewer?.querySelector("[data-diagram2-viewer-canvas]");
    if (!viewer || !canvas) return;

    const result = diagramReadonlyImageResult(source, document.title || "Diagram", {
      className: "diagram2-readonly-art"
    });
    canvas.innerHTML = diagram2ViewerArtHtml(result);
    viewer.querySelector("[data-diagram2-viewer-loader], .diagram2-viewer-loader")?.remove();
    viewer.classList.remove("is-loading");
    viewer.removeAttribute("aria-busy");
  }

  function bindDiagram2Controls() {
    bindDiagram2SearchInput();
    bindDiagram2TreeSplitter();
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
