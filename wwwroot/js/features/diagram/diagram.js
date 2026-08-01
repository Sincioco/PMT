import { buttonContent, funnelIconHtml, pageActionsMenuHtml } from "../../components/buttons.js?v=20260717-multi-screen-header";
import { api } from "../../core/api.js?v=20260725-public-link-v1";
import {
  diagramCardHtml as sharedDiagramCardHtml
} from "../../components/entity-cards.js?v=20260722-rich-entity-mentions-v1";
import {
  annotationContentBounds,
  annotationSvgPlaneMetrics,
  annotationEntityFieldBounds,
  annotationEntityFieldLabelPoint,
  annotationFieldMappingActiveRelationshipsSvg,
  annotationFieldMappingAttentionHighlightSvg,
  buildAnnotationSvg,
  buildPortableAnnotationState,
  buildPortableAnnotationSvg,
  cleanAnnotationSvgForExternalUse,
  annotationEntityFieldSupportsMapping,
  annotationEntityVisibleFields,
  copyAnnotationPngToClipboard,
  copyAnnotationSvgToClipboard,
  annotationSvgToPngBlob,
  openImageAnnotationDialog,
  parseAnnotationSvg,
  resolveAnnotationEntityOverlaps,
  resolveAnnotationEntitySizeChangeLayout,
  setAnnotationEntityCollapsedState,
  setAnnotationEntityDataTypeVisibility,
  zoomAnnotationAtPoint
} from "../../components/image-annotation.js?v=20260731-rte-checkbox-layout-v2";
import { openPublicLinkDialog } from "../../components/public-links.js?v=20260725-day36-v4";
import {
  checkedFilterValues,
  filterCheckList,
  filterSelect
} from "../../components/filters.js";
import { field, optionalNumberValue, selectOptionsField, value } from "../../components/forms.js?v=20260801-diagram2-mapping-view-v3";
import { sectionHead } from "../../components/sections.js?v=20260718-diagram-library-v8";
import { currentUserId } from "../../core/authentication.js?v=20260715-admin-impersonation";
import { routeForContent, updateBrowserUrl } from "../../core/router.js?v=20260718-diagram-library-v8";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260720-doc-diagram-user-filters-v1";
import { state } from "../../core/store.js";
import { formatDate } from "../../shared/dates.js";
import { appUrl } from "../../shared/app-urls.js";
import { canAccessResource } from "../../shared/security.js";
import { escapeAttr, escapeHtml } from "../../shared/text-and-links.js";
import {
  captureTreeNavState,
  restoreTreeNavState
} from "../../shared/tree-nav-state.js?v=20260731-rte-checkbox-layout-v2";
import { buildPmtDatabaseSchemaDiagram } from "./pmt-database-schema.js?v=20260731-rte-checkbox-layout-v2";
import { createPmtDiagramFile, parsePmtDiagramFile } from "./pmt-diagram-file.js?v=20260731-rte-checkbox-layout-v2";

const diagramViewModes = new Set(["cards", "tree"]);
const diagramTreeGroups = new Set(["all", "project", "project-sprint"]);
const diagramTreeLayouts = new Set(["hierarchy", "flat"]);
const diagramSortModes = new Set(["latest", "oldest", "name", "custom"]);
const diagramVisibilityModes = new Set(["both", "private", "public"]);
const blankDiagramWidth = 1600;
const blankDiagramHeight = 900;
const diagramSvgSourceCache = new Map();
const diagramSvgSourceLoads = new Map();
const diagramSvgSearchTextCache = new Map();
const diagramLocalD2ComparisonOffset = { x: 8, y: 9 };
const blankDiagramSource = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${blankDiagramWidth}" height="${blankDiagramHeight}" viewBox="0 0 ${blankDiagramWidth} ${blankDiagramHeight}">
    <rect width="${blankDiagramWidth}" height="${blankDiagramHeight}" fill="#ffffff"/>
  </svg>
`)}`;

let diagramViewMode = diagramViewModes.has(readPreference(preferenceKeys.diagramViewMode, "tree"))
  ? readPreference(preferenceKeys.diagramViewMode, "tree")
  : "tree";
let diagramTreePaneWidth = readNumberPreference(preferenceKeys.diagramTreePaneWidth, 300);
let diagramTreePaneHidden = readBooleanPreference(preferenceKeys.diagramTreePaneHidden, false);
let diagramTreeGroup = diagramTreeGroups.has(readPreference(preferenceKeys.diagramTreeGroup, "all"))
  ? readPreference(preferenceKeys.diagramTreeGroup, "all")
  : "all";
let diagramTreeLayout = diagramTreeLayouts.has(readPreference(preferenceKeys.diagramTreeLayout, "hierarchy"))
  ? readPreference(preferenceKeys.diagramTreeLayout, "hierarchy")
  : "hierarchy";
let diagramSearch = readPreference(preferenceKeys.diagramSearch, "").trim();
let diagramProjectId = readNumberPreference(preferenceKeys.diagramProject, 0);
let diagramSprintId = readPreference(preferenceKeys.diagramSprint, "all");
let diagramVisibility = diagramVisibilityModes.has(readPreference(preferenceKeys.diagramVisibility, "both"))
  ? readPreference(preferenceKeys.diagramVisibility, "both")
  : "both";
let diagramSort = diagramSortModes.has(readPreference(preferenceKeys.diagramSort, "latest"))
  ? readPreference(preferenceKeys.diagramSort, "latest")
  : "latest";
let diagramCreatorFilters = readJsonPreference(preferenceKeys.diagramCreatorFilters, []);
let diagramLastEditorFilters = readJsonPreference(preferenceKeys.diagramLastEditorFilters, []);
let selectedDiagramDocumentId = readNumberPreference(preferenceKeys.diagramSelectedDocument, 0);
let sharedDiagramDocumentId = 0;
let previewDiagramDocumentId = 0;
let previewZoom = 1;
const collapsedDiagramDocumentIds = new Set();
const collapsedDiagramTreeFolderKeys = new Set();

function syncDiagramLeftNavContextFromStorage() {
  const viewMode = readPreference(preferenceKeys.diagramViewMode, "tree");
  diagramViewMode = diagramViewModes.has(viewMode) ? viewMode : "tree";
  diagramTreePaneWidth = readNumberPreference(preferenceKeys.diagramTreePaneWidth, 300);
  diagramTreePaneHidden = readBooleanPreference(preferenceKeys.diagramTreePaneHidden, false);
  const treeGroup = readPreference(preferenceKeys.diagramTreeGroup, "all");
  diagramTreeGroup = diagramTreeGroups.has(treeGroup) ? treeGroup : "all";
  const treeLayout = readPreference(preferenceKeys.diagramTreeLayout, "hierarchy");
  diagramTreeLayout = diagramTreeLayouts.has(treeLayout) ? treeLayout : "hierarchy";
  diagramSearch = readPreference(preferenceKeys.diagramSearch, "").trim();
  diagramProjectId = readNumberPreference(preferenceKeys.diagramProject, 0);
  diagramSprintId = readPreference(preferenceKeys.diagramSprint, "all");
  const visibility = readPreference(preferenceKeys.diagramVisibility, "both");
  diagramVisibility = diagramVisibilityModes.has(visibility) ? visibility : "both";
  const sort = readPreference(preferenceKeys.diagramSort, "latest");
  diagramSort = diagramSortModes.has(sort) ? sort : "latest";
  diagramCreatorFilters = readJsonPreference(preferenceKeys.diagramCreatorFilters, []);
  diagramLastEditorFilters = readJsonPreference(preferenceKeys.diagramLastEditorFilters, []);
  selectedDiagramDocumentId = readNumberPreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
}

function diagramReadOnlyD2ComparisonOffset() {
  const hostname = String(globalThis.window?.location?.hostname || "").toLowerCase();
  const localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  // Remove the localhost D1/D2 comparison alignment shim.
  return localHost ? diagramLocalD2ComparisonOffset : { x: 0, y: 0 };
}

export function createDiagramFeature({
  app,
  askForColor,
  askForText,
  bindRichTextButtons,
  confirm,
  notify,
  loadTemplateLibrary,
  loadDefaultTemplateLibrary,
  saveTemplateLibrary,
  loadPmtDatabaseSchema,
  uploadEmbeddedImage,
  persistCroppedOriginal,
  createDiagramDocument,
  saveDiagramDocument,
  openEditor,
  saveDiagramInfo,
  moveDiagramDocument,
  deleteItem
}) {
  let active = false;
  let creating = false;
  let generatingDatabaseSchema = false;
  let editingDocumentId = 0;
  let editingFullScreen = false;
  let editorAbortController = null;
  let diagramTreeContextMenuController = null;
  let diagramReadonlyContextMenuController = null;
  let diagramPreviewHydrationToken = 0;
  let diagramTreeRevealSelection = false;

  function renderDiagram() {
    const wasActive = active;
    const treeNavState = diagramViewMode === "tree"
      ? captureTreeNavState(app, {
          identity: "diagram-1",
          paneSelector: ".diagram-tree-pane",
          itemSelector: "[data-action='select-diagram-document']",
          selectedSelector: "[data-diagram-tree-row].is-selected"
        })
      : null;
    active = true;
    if (!wasActive) syncDiagramLeftNavContextFromStorage();
    if (!wasActive) previewDiagramDocumentId = 0;
    if (!wasActive && /^#\/diagram\/\d+(?:\?|$)/i.test(globalThis.window?.location?.hash || "")) {
      diagramTreeRevealSelection = true;
    }
    if (editingDocumentId && app.querySelector("[data-diagram-editor-host]")) return;
    const previewHydrationToken = ++diagramPreviewHydrationToken;
    const documents = diagramDocuments();
    const documentIds = new Set(documents.map(document => document.id));
    if (!documentIds.has(selectedDiagramDocumentId)) {
      selectedDiagramDocumentId = documents[0]?.id || 0;
      previewDiagramDocumentId = 0;
      if (/^#\/diagram\/\d+(?:\?|$)/i.test(globalThis.window?.location?.hash || "")) {
        updateBrowserUrl(routeForContent("diagram", selectedDiagramDocumentId), { replace: true });
      }
    }
    writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId || "");
    if (editingDocumentId && !documentIds.has(editingDocumentId)) cancelEmbeddedEditor();
    const selectedDocument = documents.find(document => document.id === selectedDiagramDocumentId) || null;
    if (diagramTreeRevealSelection) expandDiagramTreePath(selectedDocument);

    app.innerHTML = `
      <section class="diagram-screen ${diagramViewMode === "tree" ? "is-tree-view" : "is-card-view"}">
        ${sectionHead("Diagram", `${diagramPageDocumentHeaderHtml(selectedDocument)}${diagramHeaderActionsHtml()}`)}
        ${diagramViewMode === "tree" ? diagramTreeViewHtml(documents) : diagramCardViewHtml(documents)}
      </section>
    `;

    if (diagramViewMode === "tree") {
      bindDiagramTreeSplitter();
      bindDiagramTreeDragAndDrop();
      bindDiagramTreeContextMenu();
      bindDiagramReadonlyViewer();
      scheduleDiagramPreviewHydration(previewHydrationToken, selectedDocument?.id || 0);
      restoreTreeNavState(app, treeNavState, {
        identity: "diagram-1",
        paneSelector: ".diagram-tree-pane",
        itemSelector: "[data-action='select-diagram-document']",
        selectedId: selectedDiagramDocumentId,
        revealSelected: diagramTreeRevealSelection
      });
      diagramTreeRevealSelection = false;
    } else {
      diagramTreeContextMenuController?.abort();
      diagramTreeContextMenuController = null;
      diagramReadonlyContextMenuController?.abort();
      diagramReadonlyContextMenuController = null;
    }

    if (diagramSearch) {
      const searchAtRender = diagramSearch;
      void loadDiagramSearchSources().then(loaded => {
        if (loaded && active && diagramSearch === searchAtRender) renderDiagram();
      });
    }
  }

  function diagramHeaderActionsHtml() {
    const busy = creating || Boolean(editingDocumentId);
    return `
      <button type="button" class="primary text-icon-button diagram-page-icon-action" data-action="new-diagram" title="New Diagram" aria-label="New Diagram" ${busy || !canAccessResource("Documentation", "Create") ? "disabled" : ""}>
        ${buttonContent("&#10010;", creating ? "Creating..." : "New Diagram")}
      </button>
      <div class="documentation-view-toggle diagram-view-toggle" aria-label="Diagram view">
        <button class="secondary text-icon-button documentation-view-toggle-button ${diagramViewMode === "cards" ? "is-on" : ""}" type="button" data-action="set-diagram-view" data-mode="cards" aria-pressed="${diagramViewMode === "cards"}" title="Cards" aria-label="Cards" ${busy ? "disabled" : ""}>
          ${buttonContent("&#9638;", "Cards")}
        </button>
        <button class="secondary text-icon-button documentation-view-toggle-button ${diagramViewMode === "tree" ? "is-on" : ""}" type="button" data-action="set-diagram-view" data-mode="tree" aria-pressed="${diagramViewMode === "tree"}" title="Treeview" aria-label="Treeview" ${busy ? "disabled" : ""}>
          ${buttonContent("&#9776;", "Treeview")}
        </button>
      </div>
      <button class="secondary text-icon-button diagram-page-icon-action" type="button" data-action="open-diagram-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog" ${busy ? "disabled" : ""}>
        ${buttonContent(funnelIconHtml(), "Filters")}
      </button>
      ${pageActionsMenuHtml([{
        action: "toggle-diagram-tree-pane",
        icon: "&#9776;",
        label: "Left Nav",
        title: "Left Nav",
        checked: diagramViewMode === "tree" && !diagramTreePaneHidden,
        disabled: diagramViewMode !== "tree" || busy
      }, {
        action: "import-pmt-diagram",
        icon: "&#8679;",
        label: "Import PMT Diagram",
        title: "Import PMT Diagram",
        disabled: busy || !canAccessResource("Documentation", "Create")
      }, {
        action: "export-pmt-diagram",
        icon: "&#8681;",
        label: "Export PMT Diagram",
        title: "Export PMT Diagram",
        disabled: busy || !selectedDiagramDocumentId
      }])}
      <input type="file" accept=".pmt-diagram.json,application/json" data-diagram-import-input hidden>
    `;
  }

  function diagramPageDocumentHeaderHtml(document) {
    if (diagramViewMode !== "tree" || !document) return "";
    const canEdit = diagramCanEdit(document);
    const parent = diagramDocuments().find(item => item.id === document.parentBlogId);
    return `
      <div class="diagram-page-document-head" data-diagram-page-document-head>
        <div class="diagram-page-document-title">
          <h2>${escapeHtml(document.title)}</h2>
          <div class="diagram-page-document-meta">
            <span>${document.isPrivate === false ? "Public" : "Private"} Diagram</span>
            <span>${escapeHtml(diagramProjectLabel(document.projectId))}</span>
            ${document.sprintId ? `<span>${escapeHtml(diagramSprintLabel(document.sprintId))}</span>` : ""}
            ${parent ? `<span>Parent: ${escapeHtml(parent.title)}</span>` : ""}
            <span>Updated ${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</span>
          </div>
        </div>
        <div class="diagram-page-document-actions">
          ${diagramPublicLinkButtonHtml(document, "secondary text-icon-button diagram-page-icon-action", "Public Link")}
          <button type="button" class="secondary text-icon-button diagram-page-icon-action" data-action="edit-diagram-info" data-id="${document.id}" title="Edit Info" aria-label="Edit Info" ${!canEdit || editingDocumentId ? "disabled" : ""}>
            ${buttonContent("&#9432;", "Edit Info")}
          </button>
          <button type="button" class="primary text-icon-button diagram-page-icon-action" data-action="edit-diagram" data-id="${document.id}" title="Edit Diagram" aria-label="Edit Diagram" ${!canEdit || editingDocumentId ? "disabled" : ""}>
            ${buttonContent("&#9998;", "Edit Diagram")}
          </button>
          ${editingDocumentId ? "" : `
            <div class="diagram-page-zoom-controls" aria-label="Read-only Diagram navigation">
              <button type="button" class="secondary diagram-page-icon-action" data-diagram-zoom-out title="Zoom out" aria-label="Zoom out">&#8722;</button>
              <select data-diagram-zoom aria-label="Zoom level" title="Zoom level">${diagramZoomOptionsHtml()}</select>
              <button type="button" class="secondary diagram-page-icon-action" data-diagram-zoom-in title="Zoom in" aria-label="Zoom in">&#43;</button>
              <button type="button" class="secondary text-icon-button diagram-page-icon-action" data-diagram-fit title="Fit Diagram" aria-label="Fit Diagram">${buttonContent("&#9633;", "Fit Diagram")}</button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  function diagramCardViewHtml(documents) {
    if (!documents.length) {
      return `<div class="empty">No diagrams match the current filters. Select Filters to reset them, or select New Diagram to create one.</div>`;
    }

    if (diagramTreeGroup !== "all") {
      return `<div class="documentation-card-sections">
        ${diagramCardGroups(documents).map(group => `
          <section class="documentation-card-section">
            <h2>${escapeHtml(group.label)}</h2>
            <div class="grid documentation-grid diagram-grid">
              ${group.documents.map(diagramCardHtml).join("")}
            </div>
          </section>
        `).join("")}
      </div>`;
    }

    return `<div class="grid documentation-grid diagram-grid">
      ${documents.map(diagramCardHtml).join("")}
    </div>`;
  }

  function diagramCardHtml(document) {
    const image = diagramImage(document);
    return sharedDiagramCardHtml(document, {
      actionAttrs: `data-action="select-diagram-card" data-id="${document.id}"`,
      source: image?.source || blankDiagramSource,
      updatedLabel: `Updated ${formatDate(document.updatedAt || document.createdAt)}`
    });
  }

  function diagramTreeViewHtml(documents) {
    const selectedDocument = documents.find(document => document.id === selectedDiagramDocumentId) || null;
    return `
      <div class="documentation-tree-layout diagram-tree-layout ${diagramTreePaneHidden ? "is-tree-hidden" : ""}" style="--documentation-tree-pane-width:${diagramTreePaneWidth}px">
        <aside class="panel documentation-tree-pane diagram-tree-pane" data-tree-nav-identity="diagram-1" ${diagramTreePaneHidden ? "hidden" : ""}>
          <div class="documentation-tree" role="tree" aria-label="Diagrams">
            ${documents.length ? diagramTreeNavHtml(documents) : `<div class="documentation-tree-empty">No diagrams match the current filters.</div>`}
          </div>
        </aside>
        <div class="documentation-tree-splitter" data-diagram-tree-splitter ${diagramTreePaneHidden ? "hidden" : ""} role="separator" aria-orientation="vertical" aria-label="Resize diagram navigation"></div>
        <section class="panel documentation-tree-preview diagram-tree-content ${editingDocumentId ? "is-editing" : ""}">
          ${editingDocumentId && !editingFullScreen && selectedDocument?.id === editingDocumentId
            ? `<div class="diagram-inline-editor-host" data-diagram-editor-host><div class="empty">Loading diagram editor...</div></div>`
            : diagramTreePreviewShellHtml(selectedDocument)}
        </section>
        ${diagramTreeContextMenuHtml()}
      </div>
    `;
  }

  function diagramTreeNavHtml(documents) {
    const rootDrop = `<div class="diagram-tree-root-drop" data-diagram-root-drop aria-hidden="true"></div>`;
    if (diagramTreeGroup === "all") {
      return rootDrop + diagramTreeDocumentsHtml(documents, 0);
    }

    const globalDocuments = documents.filter(document => !document.projectId);
    const projectFolders = state.projects.map(project => {
      const projectDocuments = documents.filter(document => Number(document.projectId || 0) === Number(project.id));
      if (!projectDocuments.length) return "";

      if (diagramTreeGroup === "project") {
        return diagramTreeFolderHtml({
          key: `project:${project.id}`,
          label: `${project.code} - ${project.title}`,
          depth: 0,
          count: projectDocuments.length,
          childrenHtml: diagramTreeDocumentsHtml(projectDocuments, 1)
        });
      }

      const directDocuments = projectDocuments.filter(document => !diagramSprintForDocument(document));
      const directFolder = directDocuments.length
        ? diagramTreeFolderHtml({
          key: `project:${project.id}:direct`,
          label: "Project Diagrams",
          depth: 1,
          count: directDocuments.length,
          childrenHtml: diagramTreeDocumentsHtml(directDocuments, 2)
        })
        : "";
      const sprintFolders = state.sprints
        .filter(sprint => Number(sprint.projectId || 0) === Number(project.id))
        .map(sprint => {
          const sprintDocuments = projectDocuments.filter(document => Number(document.sprintId || 0) === Number(sprint.id));
          if (!sprintDocuments.length) return "";
          return diagramTreeFolderHtml({
            key: `sprint:${sprint.id}`,
            label: `${sprint.code} - ${sprint.title}`,
            depth: 1,
            count: sprintDocuments.length,
            childrenHtml: diagramTreeDocumentsHtml(sprintDocuments, 2)
          });
        })
        .join("");

      return diagramTreeFolderHtml({
        key: `project:${project.id}`,
        label: `${project.code} - ${project.title}`,
        depth: 0,
        count: projectDocuments.length,
        childrenHtml: directFolder + sprintFolders
      });
    }).join("");
    const globalFolder = globalDocuments.length
      ? diagramTreeFolderHtml({
        key: "global",
        label: "Global",
        depth: 0,
        count: globalDocuments.length,
        childrenHtml: diagramTreeDocumentsHtml(globalDocuments, 1)
      })
      : "";

    return rootDrop + (globalFolder + projectFolders || `<div class="documentation-tree-empty">No diagrams match the current filters.</div>`);
  }

  function diagramTreeDocumentsHtml(documents, depth) {
    const sortedDocuments = [...documents].sort(diagramDocumentCompare);
    if (diagramTreeLayout === "flat") {
      return sortedDocuments.map(document => diagramTreeRowHtml(document, depth, [], null)).join("");
    }

    const byId = new Map(documents.map(document => [document.id, document]));
    const childrenByParent = new Map();
    documents.forEach(document => {
      const parentId = byId.has(document.parentBlogId) ? document.parentBlogId : 0;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(document);
    });
    childrenByParent.forEach(children => children.sort(diagramDocumentCompare));

    const renderChildren = (parentId, depth) => (childrenByParent.get(parentId) || [])
      .map(document => diagramTreeRowHtml(document, depth, childrenByParent.get(document.id) || [], renderChildren))
      .join("");

    return renderChildren(0, depth);
  }

  function diagramTreeRowHtml(document, depth, children, renderChildren) {
    const selected = document.id === selectedDiagramDocumentId;
    const hasChildren = children.length > 0;
    const collapsed = collapsedDiagramDocumentIds.has(document.id);
    const canMove = diagramCanEdit(document);
    return `
      <div class="documentation-tree-row documentation-tree-document-row diagram-tree-row ${selected ? "is-selected" : ""}" style="--tree-depth:${depth}" role="treeitem" aria-selected="${selected}" ${hasChildren ? `aria-expanded="${!collapsed}"` : ""} data-diagram-tree-row data-id="${document.id}" draggable="${canMove}">
        <button class="documentation-tree-node-toggle" type="button" data-action="toggle-diagram-tree-node" data-id="${document.id}" ${hasChildren ? "" : "disabled"} aria-label="${hasChildren ? "Expand or collapse child diagrams" : "No child diagrams"}"><span aria-hidden="true">${hasChildren ? (collapsed ? "&#9656;" : "&#9662;") : ""}</span></button>
        <button class="documentation-tree-document" type="button" data-action="select-diagram-document" data-id="${document.id}" title="${escapeAttr(document.title)}" ${editingDocumentId ? "disabled" : ""}>
          <span class="documentation-tree-icon" aria-hidden="true">&#128208;</span>
          <span class="documentation-tree-label">${escapeHtml(document.title)}</span>
          <span class="documentation-tree-date">${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</span>
          ${document.isPrivate !== false ? `<span class="diagram-tree-private" title="Private" aria-label="Private">${diagramLockIconHtml()}</span>` : ""}
        </button>
      </div>
      ${hasChildren && !collapsed && renderChildren ? renderChildren(document.id, depth + 1) : ""}
    `;
  }

  function diagramTreeFolderHtml({ key, label, depth, count, childrenHtml }) {
    const collapsed = collapsedDiagramTreeFolderKeys.has(key);
    const countText = count === 1 ? "1 diagram" : `${count} diagrams`;
    return `
      <div class="documentation-tree-row documentation-tree-folder-row" style="--tree-depth:${depth}" role="treeitem" aria-expanded="${!collapsed}">
        <button class="documentation-tree-folder" type="button" data-action="toggle-diagram-tree-folder" data-tree-key="${escapeAttr(key)}">
          <span class="documentation-tree-expander" aria-hidden="true">${collapsed ? "&#9656;" : "&#9662;"}</span>
          <span class="documentation-tree-icon" aria-hidden="true">&#128193;</span>
          <span class="documentation-tree-label">${escapeHtml(label)}</span>
          <span class="documentation-tree-count">${escapeHtml(countText)}</span>
        </button>
      </div>
      ${collapsed ? "" : childrenHtml}
    `;
  }

  function diagramCardGroups(documents) {
    const groups = new Map();
    documents.forEach(document => {
      const group = diagramCardGroup(document);
      const existing = groups.get(group.key);
      if (existing) existing.documents.push(document);
      else groups.set(group.key, { ...group, documents: [document] });
    });
    return [...groups.values()];
  }

  function diagramCardGroup(document) {
    if (!document.projectId) return { key: "global", label: "Global" };
    const projectLabel = diagramProjectLabel(document.projectId);
    if (diagramTreeGroup === "project") {
      return { key: `project:${document.projectId}`, label: projectLabel };
    }

    const sprint = diagramSprintForDocument(document);
    return sprint
      ? { key: `sprint:${sprint.id}`, label: `${projectLabel} / ${diagramSprintLabel(sprint.id)}` }
      : { key: `project:${document.projectId}:direct`, label: `${projectLabel} / Project Diagrams` };
  }

  function diagramSprintForDocument(document) {
    return state.sprints.find(sprint =>
      Number(sprint.id) === Number(document.sprintId || 0)
      && Number(sprint.projectId || 0) === Number(document.projectId || 0)
    ) || null;
  }

  function expandDiagramTreePath(document) {
    if (!document) return;
    if (diagramTreeGroup !== "all") {
      if (!document.projectId) {
        collapsedDiagramTreeFolderKeys.delete("global");
      } else {
        collapsedDiagramTreeFolderKeys.delete(`project:${document.projectId}`);
        if (diagramTreeGroup === "project-sprint") {
          const sprint = diagramSprintForDocument(document);
          collapsedDiagramTreeFolderKeys.delete(sprint
            ? `sprint:${sprint.id}`
            : `project:${document.projectId}:direct`);
        }
      }
    }

    const byId = new Map(diagramAllDocuments().map(item => [item.id, item]));
    let current = document;
    while (current) {
      collapsedDiagramDocumentIds.delete(current.id);
      current = byId.get(current.parentBlogId);
    }
  }

  function diagramTreePreviewShellHtml(document) {
    if (!document) return diagramTreeEmptyPreviewHtml();

    return `
      <div class="diagram-readonly-viewer diagram-tree-preview-image is-loading" data-diagram-readonly-viewer data-diagram-preview-deferred data-id="${document.id}">
        <div class="diagram-preview diagram-readonly-viewport is-loading" data-diagram-viewport tabindex="0" aria-label="Read-only Diagram canvas. Drag to pan; use mouse wheel to zoom." aria-busy="true">
          <div class="diagram-preview-loader" data-diagram-preview-loader role="status" aria-live="polite">Loading...</div>
          <div class="diagram-readonly-stage" data-diagram-stage></div>
        </div>
        ${diagramReadonlyContextMenuHtml()}
      </div>
    `;
  }

  function diagramTreePreviewHtml(document) {
    if (!document) return diagramTreeEmptyPreviewHtml();

    const image = diagramImage(document);
    return `
      <div class="diagram-readonly-viewer diagram-tree-preview-image" data-diagram-readonly-viewer data-id="${document.id}">
        <div class="diagram-preview diagram-readonly-viewport" data-diagram-viewport tabindex="0" aria-label="Read-only Diagram canvas. Drag to pan; use mouse wheel to zoom.">
          <div class="diagram-readonly-stage" data-diagram-stage>
            ${diagramReadonlyImageHtml(image?.source || blankDiagramSource, document.title)}
          </div>
        </div>
        ${diagramReadonlyContextMenuHtml()}
      </div>
    `;
  }

  function diagramTreeEmptyPreviewHtml() {
    return `<div class="diagram-empty">
      <span class="diagram-empty-icon" aria-hidden="true">&#128208;</span>
      <h2>Create a diagram</h2>
      <p>New Diagram creates a private backing Document immediately, then opens the editor here.</p>
    </div>`;
  }

  function diagramReadonlyContextMenuHtml() {
    return `
      <div class="dropdown-menu documentation-tree-context-menu diagram-readonly-context-menu" data-diagram-readonly-context-menu role="menu" aria-label="Diagram viewer options" hidden>
        <button type="button" class="dropdown-menu-item" data-diagram-toggle-entity-relationships role="menuitemcheckbox" aria-checked="true"><span class="dropdown-menu-icon" aria-hidden="true">&#8644;</span><span class="dropdown-menu-label">Entity Relationships</span><span class="dropdown-menu-check" aria-hidden="true">&#10003;</span></button>
        <button type="button" class="dropdown-menu-item" data-diagram-toggle-field-mappings role="menuitemcheckbox" aria-checked="true"><span class="dropdown-menu-icon" aria-hidden="true">&#8863;</span><span class="dropdown-menu-label">UI to DB Field Mapping Lines</span><span class="dropdown-menu-check" aria-hidden="true">&#10003;</span></button>
        <button type="button" class="dropdown-menu-item" data-diagram-toggle-relationship-lines-only role="menuitemcheckbox" aria-checked="false"><span class="dropdown-menu-icon" aria-hidden="true">&#9472;</span><span class="dropdown-menu-label">Relationship Lines Only</span><span class="dropdown-menu-check" aria-hidden="true"></span></button>
        <div class="rich-image-menu-separator" role="separator"></div>
        <button type="button" class="dropdown-menu-item" data-diagram-copy-format="svg" role="menuitem"><span class="dropdown-menu-icon" aria-hidden="true">&#128203;</span><span class="dropdown-menu-label">Copy as SVG</span><span class="dropdown-menu-check" aria-hidden="true"></span></button>
        <button type="button" class="dropdown-menu-item" data-diagram-copy-format="png" role="menuitem"><span class="dropdown-menu-icon" aria-hidden="true">&#128247;</span><span class="dropdown-menu-label">Copy as PNG</span><span class="dropdown-menu-check" aria-hidden="true"></span></button>
      </div>
    `;
  }

  function scheduleDiagramPreviewHydration(token, documentId) {
    if (!documentId || !app.querySelector("[data-diagram-preview-deferred]")) return;

    const callback = () => {
      void hydrateDiagramTreePreview(token, documentId);
    };
    if (globalThis.window?.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(callback);
      });
      return;
    }
    const scheduleTimeout = globalThis.window?.setTimeout || globalThis.setTimeout;
    scheduleTimeout?.(callback, 0);
  }

  async function hydrateDiagramTreePreview(token, documentId) {
    if (!active || token !== diagramPreviewHydrationToken || diagramViewMode !== "tree" || editingDocumentId) return;
    const viewer = app.querySelector(`[data-diagram-preview-deferred][data-id="${documentId}"]`);
    if (!viewer) return;
    const document = diagramDocuments().find(item => item.id === documentId);
    if (!document || selectedDiagramDocumentId !== documentId) return;

    const image = diagramImage(document);
    const source = image?.source || blankDiagramSource;
    if (diagramSourceIsSvg(source)
        && !/^data:image\/svg\+xml(?:;|,)/i.test(source)
        && !diagramSvgSourceCache.has(source)) {
      await loadDiagramSvgSource(source);
      if (!active || token !== diagramPreviewHydrationToken || selectedDiagramDocumentId !== documentId || editingDocumentId) return;
    }

    const stage = viewer.querySelector("[data-diagram-stage]");
    if (!stage) return;
    stage.innerHTML = diagramReadonlyImageHtml(source, document.title);
    viewer.querySelector("[data-diagram-preview-loader]")?.remove();
    viewer.classList.remove("is-loading");
    viewer.removeAttribute("data-diagram-preview-deferred");
    const viewport = viewer.querySelector("[data-diagram-viewport]");
    viewport?.classList.remove("is-loading");
    viewport?.removeAttribute("aria-busy");
    bindDiagramReadonlyViewer();
  }

  function diagramTreeContextMenuHtml() {
    return `
      <div class="dropdown-menu documentation-tree-context-menu diagram-tree-context-menu" data-diagram-tree-context-menu role="menu" aria-label="Diagram actions" hidden>
        ${diagramTreeContextMenuItemHtml("edit-diagram-info", "Edit Info", "&#9432;", "data-diagram-context-requires-update")}
        ${diagramTreeContextMenuItemHtml("edit-diagram", "Edit Diagram", "&#9998;", "data-diagram-context-requires-update")}
        ${diagramTreeContextMenuItemHtml("duplicate-diagram", "Duplicate", "&#128203;", "data-diagram-context-requires-create")}
        ${diagramTreeContextMenuItemHtml("copy-public-diagram-link", "Public Link", "&#128279;", "data-diagram-context-requires-public")}
        ${diagramTreeContextMenuItemHtml("download-diagram", "Download as SVG", diagramDownloadIconHtml())}
        ${diagramTreeContextMenuItemHtml("download-diagram-png", "Download as PNG", diagramDownloadIconHtml())}
        ${diagramTreeContextMenuItemHtml("export-pmt-diagram", "Export PMT Diagram", "&#8681;")}
        ${diagramTreeContextMenuItemHtml("delete-diagram", "Delete", "&#128465;", "data-diagram-context-requires-delete", "is-danger")}
      </div>
    `;
  }

  function diagramTreeContextMenuItemHtml(action, label, iconHtml, permissionAttribute = "", className = "") {
    return `
      <button type="button" class="dropdown-menu-item ${className}" data-action="${action}" ${permissionAttribute} role="menuitem" title="${label}" aria-label="${label}">
        <span class="dropdown-menu-icon" aria-hidden="true">${iconHtml}</span>
        <span class="dropdown-menu-label">${label}</span>
        <span class="dropdown-menu-check" aria-hidden="true"></span>
      </button>
    `;
  }

  async function handleAction(action, id, button) {
    if (action === "set-diagram-view") {
      if (creating || editingDocumentId) return true;
      const previousViewMode = diagramViewMode;
      const mode = button?.dataset?.mode || "tree";
      diagramViewMode = diagramViewModes.has(mode) ? mode : "tree";
      if (diagramViewMode === "tree") {
        diagramTreePaneHidden = previousViewMode === "tree"
          ? !diagramTreePaneHidden
          : false;
        previewDiagramDocumentId = 0;
        writePreference(preferenceKeys.diagramTreePaneHidden, diagramTreePaneHidden);
      }
      writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
      renderDiagram();
      return true;
    }
    if (action === "select-diagram-card" || action === "select-diagram-document") {
      if (editingDocumentId) return true;
      selectedDiagramDocumentId = id;
      diagramTreeRevealSelection = action === "select-diagram-card";
      previewDiagramDocumentId = 0;
      sharedDiagramDocumentId = 0;
      diagramViewMode = "tree";
      writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
      renderDiagram();
      return true;
    }
    if (action === "toggle-diagram-tree-folder") {
      const key = String(button?.dataset?.treeKey || "");
      if (!key) return true;
      if (collapsedDiagramTreeFolderKeys.has(key)) collapsedDiagramTreeFolderKeys.delete(key);
      else collapsedDiagramTreeFolderKeys.add(key);
      renderDiagram();
      return true;
    }
    if (action === "toggle-diagram-tree-node") {
      if (collapsedDiagramDocumentIds.has(id)) {
        collapsedDiagramDocumentIds.delete(id);
      } else {
        collapsedDiagramDocumentIds.add(id);
      }
      renderDiagram();
      return true;
    }
    if (action === "open-diagram-filters") {
      openDiagramFiltersDialog();
      return true;
    }
    if (action === "toggle-diagram-tree-pane") {
      if (diagramViewMode !== "tree" || creating || editingDocumentId) return true;
      diagramTreePaneHidden = !diagramTreePaneHidden;
      previewDiagramDocumentId = 0;
      writePreference(preferenceKeys.diagramTreePaneHidden, diagramTreePaneHidden);
      renderDiagram();
      return true;
    }
    if (action === "new-diagram") {
      await createNewDiagram();
      return true;
    }
    if (action === "import-pmt-diagram") {
      app.querySelector("[data-diagram-import-input]")?.click();
      return true;
    }
    if (action === "export-pmt-diagram") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await exportPmtDiagram(document);
      return true;
    }
    if (action === "copy-public-diagram-link") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await copyPublicDiagramLink(document, button);
      return true;
    }
    if (action === "edit-diagram") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await editDiagram(document, { fullScreen: true });
      return true;
    }
    if (action === "edit-diagram-info") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document && diagramCanEdit(document)) editDiagramInfo(document);
      return true;
    }
    if (action === "download-diagram") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await downloadDiagram(document);
      return true;
    }
    if (action === "download-diagram-png") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await downloadDiagramPng(document);
      return true;
    }
    if (action === "duplicate-diagram") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (document) await duplicateDiagram(document);
      return true;
    }
    if (action === "delete-diagram") {
      const document = diagramDocuments().find(item => item.id === (id || selectedDiagramDocumentId));
      if (!diagramCanDelete(document)) return true;
      if (selectedDiagramDocumentId === document.id) {
        selectedDiagramDocumentId = 0;
        writePreference(preferenceKeys.diagramSelectedDocument, "");
      }
      await deleteItem?.(`/api/blogs/${document.id}`, "Delete this Diagram?");
      return true;
    }
    return false;
  }

  async function downloadDiagram(document) {
    const options = await chooseDiagramSvgDownloadOptions();
    if (!options) return;

    try {
      const sourceSvg = await diagramDownloadSvg(document, { portable: true });
      const svg = prepareDiagramSvgForDownload(sourceSvg, options);
      downloadTextFile(svg, `${safeFileName(document.title)}.svg`, "image/svg+xml");
      notify?.("Diagram downloaded as SVG.");
    } catch (error) {
      notify?.(error?.message || "The Diagram could not be downloaded as SVG.");
    }
  }

  async function downloadDiagramPng(document) {
    const options = await chooseDiagramPngDownloadOptions();
    if (!options) return;

    try {
      const sourceSvg = await diagramDownloadSvg(document, { portable: true });
      const pngSvg = prepareDiagramSvgForDownload(sourceSvg, options);
      const pngBlob = await annotationSvgToPngBlob({ svg: pngSvg, ...annotationSvgClipboardMetrics(pngSvg) });
      downloadBlobFile(pngBlob, `${safeFileName(document.title)}.png`);
      notify?.("Diagram downloaded as PNG.");
    } catch (error) {
      notify?.(error?.message || "The Diagram could not be downloaded as PNG.");
    }
  }

  async function diagramDownloadSvg(document, options = {}) {
    const source = diagramImage(document)?.source || "";
    if (!source) throw new Error("The Diagram SVG could not be found.");

    const svg = decodeDiagramSvgDataUrl(source) || await loadDiagramSvgSource(source);
    if (!svg) throw new Error("The Diagram SVG could not be read.");
    if (options.portable !== true) return svg;

    const state = parseAnnotationSvg(svg);
    if (!state) return svg;
    return await buildPortableAnnotationSvg(state);
  }

  function chooseDiagramSvgDownloadOptions() {
    return openDiagramDownloadOptionsDialog("svg", { action: "download" });
  }

  function chooseDiagramPngDownloadOptions() {
    return openDiagramDownloadOptionsDialog("png", { action: "download" });
  }

  function chooseDiagramSvgCopyOptions() {
    return openDiagramDownloadOptionsDialog("svg", { action: "copy" });
  }

  function chooseDiagramPngCopyOptions() {
    return openDiagramDownloadOptionsDialog("png", { action: "copy" });
  }

  function openDiagramDownloadOptionsDialog(format, options = {}) {
    const safeFormat = format === "svg" ? "svg" : "png";
    const isCopy = options.action === "copy";
    const actionLabel = isCopy ? "Copy" : "Download";
    const title = `${actionLabel} as ${safeFormat.toUpperCase()}`;
    const backgroundName = `diagram${safeFormat.toUpperCase()}Background`;
    const marginName = `diagram${safeFormat.toUpperCase()}Margin`;
    const marginOptions = Array.from({ length: 200 }, (_, index) => index + 1)
      .map(value => `<option value="${value}"${value === 20 ? " selected" : ""}>${value}px</option>`)
      .join("");
    const backgroundLabels = safeFormat === "svg"
      ? { transparent: "No white background", white: "White background" }
      : { transparent: "Transparent background", white: "White background" };
    return new Promise(resolve => {
      const modal = globalThis.document.createElement("dialog");
      modal.className = `dialog mini-dialog diagram-download-dialog diagram-${safeFormat}-${isCopy ? "copy" : "download"}-dialog`;
      modal.innerHTML = `
        <form>
          <div class="dialog-head">
            <h2>${title}</h2>
            <div class="dialog-head-actions">
              <button type="button" class="icon-btn" data-diagram-download-cancel title="Close" aria-label="Close">x</button>
            </div>
          </div>
          <div class="dialog-body">
            <fieldset class="field">
              <legend>Background</legend>
              <label>
                <input type="radio" name="${backgroundName}" value="transparent" checked>
                <span>${backgroundLabels.transparent}</span>
              </label>
              <label>
                <input type="radio" name="${backgroundName}" value="white">
                <span>${backgroundLabels.white}</span>
              </label>
            </fieldset>
            <label class="field">
              <span>Margins</span>
              <select name="${marginName}">${marginOptions}</select>
            </label>
          </div>
          <div class="dialog-actions">
            <button type="button" class="secondary text-icon-button" data-diagram-download-cancel>${buttonContent("&#10005;", "Cancel")}</button>
            <button type="submit" class="primary text-icon-button">${buttonContent(isCopy ? "&#128203;" : "&#8681;", actionLabel)}</button>
          </div>
        </form>
      `;
      const form = modal.querySelector("form");
      const finish = value => {
        if (modal.open) modal.close();
        modal.remove();
        resolve(value || null);
      };
      modal.querySelectorAll("[data-diagram-download-cancel]").forEach(button => {
        button.addEventListener("click", () => finish(null));
      });
      form?.addEventListener("submit", event => {
        event.preventDefault();
        finish({
          background: form.querySelector(`input[name='${backgroundName}']:checked`)?.value || "transparent",
          margin: diagramDownloadMargin(form.querySelector(`select[name='${marginName}']`)?.value)
        });
      });
      modal.addEventListener("cancel", event => {
        event.preventDefault();
        finish(null);
      });
      globalThis.document.body.appendChild(modal);
      modal.showModal();
      modal.querySelector(`input[name='${backgroundName}']:checked`)?.focus({ preventScroll: true });
    });
  }

  function prepareDiagramSvgForDownload(svgInput, options = {}) {
    const parser = new DOMParser();
    const document = parser.parseFromString(String(svgInput || ""), "image/svg+xml");
    const svg = document.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg" || document.querySelector("parsererror")) {
      return String(svgInput || "");
    }

    const margin = diagramDownloadMargin(options.margin);
    const currentBounds = diagramSvgViewBoxBounds(svg);
    const outputBounds = {
      x: currentBounds.x - margin,
      y: currentBounds.y - margin,
      width: currentBounds.width + (margin * 2),
      height: currentBounds.height + (margin * 2)
    };
    svg.setAttribute("viewBox", `${outputBounds.x} ${outputBounds.y} ${outputBounds.width} ${outputBounds.height}`);
    svg.setAttribute("width", String(outputBounds.width));
    svg.setAttribute("height", String(outputBounds.height));
    svg.querySelectorAll(".image-annotation-canvas-background").forEach(element => element.remove());
    if (options.background === "white") {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("class", "image-annotation-canvas-background");
      rect.setAttribute("x", String(outputBounds.x));
      rect.setAttribute("y", String(outputBounds.y));
      rect.setAttribute("width", String(outputBounds.width));
      rect.setAttribute("height", String(outputBounds.height));
      rect.setAttribute("fill", "#ffffff");
      rect.setAttribute("pointer-events", "none");
      svg.insertBefore(rect, svg.firstChild);
    }

    if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return cleanAnnotationSvgForExternalUse(new XMLSerializer().serializeToString(svg));
  }

  function diagramDownloadMargin(value) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return 20;
    return Math.max(1, Math.min(200, number));
  }

  function diagramSvgViewBoxBounds(svg) {
    const viewBox = String(svg.getAttribute("viewBox") || "")
      .trim()
      .split(/[,\s]+/)
      .map(Number);
    if (viewBox.length === 4 && viewBox.every(Number.isFinite)) {
      return { x: viewBox[0], y: viewBox[1], width: Math.max(1, viewBox[2]), height: Math.max(1, viewBox[3]) };
    }
    return {
      x: 0,
      y: 0,
      width: Math.max(1, Number.parseFloat(svg.getAttribute("width") || "") || blankDiagramWidth),
      height: Math.max(1, Number.parseFloat(svg.getAttribute("height") || "") || blankDiagramHeight)
    };
  }

  async function copyPublicDiagramLink(document) {
    if (document?.isPrivate !== false) {
      notify?.("Only public diagrams can be shared with a public link.");
      return false;
    }

    return openPublicLinkDialog(async durationDays => {
      const link = await api("/api/public-links", {
        method: "POST",
        body: JSON.stringify({
          blogId: document.id,
          durationDays
        })
      });
      const token = String(link?.token || "").trim();
      if (!token) throw new Error("The public link could not be created.");

      return new URL(appUrl(`/public/diagram/${token}`), window.location.href).href;
    }, {
      notify,
      copiedMessage: "Public diagram link copied.",
      copyFailedMessage: "Public diagram link created. Copy it from the Public URL box."
    });
  }

  function diagramPublicLinkButtonHtml(document, className = "icon-action", label = "") {
    if (document?.isPrivate !== false) return "";
    const content = label
      ? buttonContent("&#128279;", label)
      : `<span class="button-icon" aria-hidden="true">&#128279;</span>`;
    return `<button class="${escapeAttr(className)}" type="button" data-action="copy-public-diagram-link" data-id="${document.id}" title="Public Link" aria-label="Public Link">${content}</button>`;
  }

  async function exportPmtDiagram(document) {
    try {
      const source = diagramImage(document)?.source || "";
      const svg = decodeDiagramSvgDataUrl(source) || await loadDiagramSvgSource(source);
      const editorState = parseAnnotationSvg(svg);
      if (!editorState) throw new Error("The editable Diagram data could not be read.");
      const portableState = await buildPortableAnnotationState(editorState);
      const contents = createPmtDiagramFile({
        title: document.title,
        state: portableState,
        svg: buildAnnotationSvg(portableState)
      });
      downloadTextFile(contents, `${safeFileName(document.title)}.pmt-diagram.json`, "application/json");
      notify?.("PMT Diagram exported.");
    } catch (error) {
      notify?.(error?.message || "The PMT Diagram could not be exported.");
    }
  }

  async function importPmtDiagramFile(file) {
    if (!file || creating || editingDocumentId) return;
    if (!canAccessResource("Documentation", "Create")) {
      notify?.("You do not have permission to create Diagrams.");
      return;
    }
    creating = true;
    renderDiagram();
    try {
      const imported = parsePmtDiagramFile(await file.text());
      const title = availableDiagramTitle(imported.title, diagramAllDocuments());
      const result = await createDiagramDocument?.({
        title,
        diagram: {
          state: imported.state,
          svg: imported.svg,
          fileName: `${safeFileName(title)}.svg`
        }
      });
      selectedDiagramDocumentId = Number(result?.id || 0);
      previewDiagramDocumentId = 0;
      sharedDiagramDocumentId = 0;
      diagramViewMode = "tree";
      writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
      notify?.("PMT Diagram imported.");
    } catch (error) {
      notify?.(error?.message || "The PMT Diagram could not be imported.");
    } finally {
      creating = false;
      if (active) renderDiagram();
    }
  }

  function handleFilterChange(target) {
    if (!target?.matches?.("[data-diagram-import-input]")) return false;
    const [file] = target.files || [];
    target.value = "";
    if (file) void importPmtDiagramFile(file);
    return true;
  }

  async function duplicateDiagram(document) {
    if (!canAccessResource("Documentation", "Create")) {
      notify?.("You do not have permission to create Diagrams.");
      return;
    }

    try {
      const source = diagramImage(document)?.source || "";
      const svg = decodeDiagramSvgDataUrl(source) || await loadDiagramSvgSource(source);
      if (!svg) throw new Error("The Diagram SVG could not be copied.");
      const title = nextAvailableDiagramCopyTitle(document.title, diagramAllDocuments());
      const state = parseAnnotationSvg(svg);
      const portableSvg = state ? await buildPortableAnnotationSvg(state) : svg;
      const result = await createDiagramDocument?.({
        title,
        diagram: {
          svg: portableSvg,
          state,
          fileName: `${safeFileName(title)}.svg`
        },
        sourceDocument: document
      });
      selectedDiagramDocumentId = Number(result?.id || 0);
      previewDiagramDocumentId = 0;
      sharedDiagramDocumentId = 0;
      diagramViewMode = "tree";
      writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
      notify?.("Diagram duplicated.");
      renderDiagram();
    } catch (error) {
      notify?.(error?.message || "The Diagram could not be duplicated.");
    }
  }

  function editDiagramInfo(document) {
    const selectedProjectId = document.projectId || "";
    const selectedSprintId = document.sprintId || "";
    openEditor?.("Edit Diagram Info", `
      <div class="form-grid diagram-info-form">
        ${field("Diagram Name", "title", document.title || "", "text", "", "", 220, { required: true })}
        ${selectOptionsField("Visibility", "visibility", [
          { id: "private", title: "Private" },
          { id: "public", title: "Public" }
        ], document.isPrivate === false ? "public" : "private")}
        ${selectOptionsField("Project", "projectId", diagramProjectOptions(), selectedProjectId)}
        ${selectOptionsField("Sprint", "sprintId", diagramSprintOptions(selectedProjectId), selectedSprintId)}
        ${selectOptionsField("Parent", "parentBlogId", diagramParentOptions(document, selectedProjectId, selectedSprintId, document.isPrivate === false), document.parentBlogId || "")}
        ${diagramInfoMetaHtml(document)}
      </div>
    `, async root => {
      const projectId = optionalNumberValue(root, "projectId");
      await saveDiagramInfo?.(document, {
        title: value(root, "title"),
        projectId,
        sprintId: projectId ? optionalNumberValue(root, "sprintId") : null,
        parentBlogId: optionalNumberValue(root, "parentBlogId"),
        isPrivate: root.querySelector("[name='visibility']")?.value !== "public",
        isPinned: false
      });
      selectedDiagramDocumentId = document.id;
      sharedDiagramDocumentId = document.id;
      previewDiagramDocumentId = 0;
      updateBrowserUrl(routeForContent("diagram", document.id), { replace: true });
    }, "title", root => bindDiagramInfoRules(root, document));
  }

  function bindDiagramInfoRules(root, document) {
    const projectSelect = root.querySelector("[name='projectId']");
    const sprintSelect = root.querySelector("[name='sprintId']");
    const parentSelect = root.querySelector("[name='parentBlogId']");
    const visibilitySelect = root.querySelector("[name='visibility']");
    if (!projectSelect || !sprintSelect || !parentSelect || !visibilitySelect) return;

    const syncParentOptions = () => {
      const projectId = optionalNumberValue(root, "projectId");
      const sprintId = projectId ? optionalNumberValue(root, "sprintId") : null;
      const currentParentId = optionalNumberValue(root, "parentBlogId");
      const options = diagramParentOptions(document, projectId, sprintId, visibilitySelect.value === "public");
      parentSelect.innerHTML = diagramOptionsHtml(options, currentParentId);
      if (!options.some(option => String(option.id) === String(currentParentId || ""))) parentSelect.value = "";
    };

    const syncSprintOptions = () => {
      const projectId = optionalNumberValue(root, "projectId");
      const currentSprintId = optionalNumberValue(root, "sprintId");
      const options = diagramSprintOptions(projectId);
      sprintSelect.innerHTML = diagramOptionsHtml(options, currentSprintId);
      sprintSelect.disabled = !projectId;
      if (!options.some(option => String(option.id) === String(currentSprintId || ""))) sprintSelect.value = "";
      syncParentOptions();
    };

    projectSelect.addEventListener("change", syncSprintOptions);
    sprintSelect.addEventListener("change", syncParentOptions);
    visibilitySelect.addEventListener("change", syncParentOptions);
    syncSprintOptions();
  }

  function diagramInfoMetaHtml(document) {
    const history = diagramLatestUpdatedHistory(document);
    return `
      <div class="diagram-info-meta">
        <div>
          <span>Created by</span>
          <strong>${escapeHtml(diagramUserName(document.createdByUserId))}</strong>
          <small>${escapeHtml(diagramDateTime(document.createdAt))}</small>
        </div>
        <div>
          <span>Last modified by</span>
          <strong>${escapeHtml(diagramUserName(history?.userId || document.updatedByUserId || document.createdByUserId))}</strong>
          <small>${escapeHtml(diagramDateTime(history?.createdAt || document.updatedAt || document.createdAt))}</small>
        </div>
      </div>
    `;
  }

  function openDiagramFiltersDialog() {
    const existingDialog = globalThis.document.querySelector("[data-diagram-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='diagram-search'], [data-filter='diagram-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = globalThis.document.createElement("dialog");
    modal.className = "dialog task-filter-dialog documentation-filter-dialog diagram-filter-dialog";
    modal.dataset.diagramFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Diagram Filters</h2>
          <div class="dialog-head-actions">
            <button type="button" class="icon-btn dialog-reset-button" data-reset-diagram-filters title="Reset" aria-label="Reset">Reset</button>
            <button type="button" class="icon-btn" data-close-diagram-filters title="Close" aria-label="Close">x</button>
          </div>
        </div>
        <div class="dialog-body task-filter-dialog-body documentation-filter-dialog-body" data-diagram-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-diagram-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderDiagramFiltersDialog(modal);
    globalThis.document.body.appendChild(modal);
    modal.addEventListener("input", event => {
      if (event.target?.dataset?.filter !== "diagram-search") return;
      sharedDiagramDocumentId = 0;
      diagramSearch = String(event.target.value || "").trim();
      writePreference(preferenceKeys.diagramSearch, diagramSearch);
      renderDiagram();
    });
    modal.addEventListener("change", event => {
      const filter = event.target?.dataset?.filter || "";
      sharedDiagramDocumentId = 0;
      if (filter === "diagram-project") {
        diagramProjectId = Number(event.target.value || 0);
        diagramSprintId = "all";
        writePreference(preferenceKeys.diagramProject, diagramProjectId);
        writePreference(preferenceKeys.diagramSprint, diagramSprintId);
        renderDiagramFiltersDialog(modal);
        renderDiagram();
        modal.querySelector("[data-filter='diagram-project']")?.focus({ preventScroll: true });
      } else if (filter === "diagram-sprint") {
        diagramSprintId = event.target.value || "all";
        writePreference(preferenceKeys.diagramSprint, diagramSprintId);
        renderDiagram();
      } else if (filter === "diagram-visibility") {
        diagramVisibility = diagramVisibilityModes.has(event.target.value) ? event.target.value : "both";
        writePreference(preferenceKeys.diagramVisibility, diagramVisibility);
        renderDiagram();
      } else if (filter === "diagram-tree-group") {
        diagramTreeGroup = diagramTreeGroups.has(event.target.value) ? event.target.value : "all";
        writePreference(preferenceKeys.diagramTreeGroup, diagramTreeGroup);
        renderDiagram();
      } else if (filter === "diagram-tree-layout") {
        diagramTreeLayout = diagramTreeLayouts.has(event.target.value) ? event.target.value : "hierarchy";
        writePreference(preferenceKeys.diagramTreeLayout, diagramTreeLayout);
        renderDiagram();
      } else if (filter === "diagram-sort") {
        diagramSort = diagramSortModes.has(event.target.value) ? event.target.value : "latest";
        writePreference(preferenceKeys.diagramSort, diagramSort);
        renderDiagram();
      } else if (filter === "diagram-creator") {
        diagramCreatorFilters = checkedFilterValues("diagram-creator");
        writeJsonPreference(preferenceKeys.diagramCreatorFilters, diagramCreatorFilters);
        renderDiagram();
      } else if (filter === "diagram-last-editor") {
        diagramLastEditorFilters = checkedFilterValues("diagram-last-editor");
        writeJsonPreference(preferenceKeys.diagramLastEditorFilters, diagramLastEditorFilters);
        renderDiagram();
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-reset-diagram-filters]")) {
        resetDiagramFilters();
        renderDiagramFiltersDialog(modal);
        renderDiagram();
        modal.querySelector("[data-filter='diagram-search']")?.focus({ preventScroll: true });
        return;
      }
      if (event.target.closest("[data-close-diagram-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='diagram-search']")?.focus({ preventScroll: true });
  }

  function renderDiagramFiltersDialog(modal) {
    const body = modal.querySelector("[data-diagram-filter-dialog-body]");
    if (!body) return;
    const sprintItems = state.sprints
      .filter(sprint => !diagramProjectId || Number(sprint.projectId) === diagramProjectId)
      .map(sprint => {
        const project = state.projects.find(item => Number(item.id) === Number(sprint.projectId));
        const sprintLabel = `${sprint.code} - ${sprint.title}`;
        return {
          value: sprint.id,
          text: diagramProjectId ? sprintLabel : `${project?.code || "Project"} - ${sprintLabel}`
        };
      });
    body.innerHTML = `
      <div class="tasks-filter-panel documentation-filter-fields">
        <div class="task-filter-row documentation-filter-row">
          <label>
            <span>Search</span>
            <input data-filter="diagram-search" type="search" value="${escapeAttr(diagramSearch)}">
          </label>
          ${filterSelect("Project", "diagram-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), diagramProjectId || "", "All Projects")}
          ${filterSelect("Sprint", "diagram-sprint", [
            { value: "none", text: "No Sprint" },
            ...sprintItems
          ], diagramSprintId === "all" ? "" : diagramSprintId, "All Sprints")}
          ${filterSelect("Visibility", "diagram-visibility", [
            { value: "private", text: "Private" },
            { value: "public", text: "Public" }
          ], diagramVisibility === "both" ? "" : diagramVisibility, "Both")}
          <label>
            <span>Group</span>
            <select data-filter="diagram-tree-group">
              ${diagramFilterOptionsHtml([
                { value: "all", text: "All Diagrams" },
                { value: "project", text: "Project Only" },
                { value: "project-sprint", text: "Project and Sprint" }
              ], diagramTreeGroup)}
            </select>
          </label>
          ${diagramViewMode === "tree" ? `
            <label>
              <span>Layout</span>
              <select data-filter="diagram-tree-layout">
                ${diagramFilterOptionsHtml([
                  { value: "hierarchy", text: "Hierarchy" },
                  { value: "flat", text: "Flat" }
                ], diagramTreeLayout)}
              </select>
            </label>
          ` : ""}
          <label>
            <span>Sort</span>
            <select data-filter="diagram-sort">
              ${diagramFilterOptionsHtml([
                { value: "latest", text: "Latest First" },
                { value: "oldest", text: "Oldest First" },
                { value: "name", text: "Name (Alphabetically)" },
                { value: "custom", text: "Custom" }
              ], diagramSort)}
            </select>
          </label>
        </div>
        <div class="documentation-filter-user-sections">
          ${filterCheckList("Filter by Creator", "diagram-creator", diagramUserFilterItems(), diagramCreatorFilters, { className: "documentation-filter-users" })}
          ${filterCheckList("Filter by Last Edited", "diagram-last-editor", diagramUserFilterItems(), diagramLastEditorFilters, { className: "documentation-filter-users" })}
        </div>
      </div>
    `;
  }

  function resetDiagramFilters() {
    sharedDiagramDocumentId = 0;
    diagramSearch = "";
    diagramProjectId = 0;
    diagramSprintId = "all";
    diagramVisibility = "both";
    diagramTreeGroup = "all";
    diagramTreeLayout = "hierarchy";
    diagramSort = "latest";
    diagramCreatorFilters = [];
    diagramLastEditorFilters = [];
    writePreference(preferenceKeys.diagramSearch, diagramSearch);
    writePreference(preferenceKeys.diagramProject, diagramProjectId);
    writePreference(preferenceKeys.diagramSprint, diagramSprintId);
    writePreference(preferenceKeys.diagramVisibility, diagramVisibility);
    writePreference(preferenceKeys.diagramTreeGroup, diagramTreeGroup);
    writePreference(preferenceKeys.diagramTreeLayout, diagramTreeLayout);
    writePreference(preferenceKeys.diagramSort, diagramSort);
    writeJsonPreference(preferenceKeys.diagramCreatorFilters, diagramCreatorFilters);
    writeJsonPreference(preferenceKeys.diagramLastEditorFilters, diagramLastEditorFilters);
  }

  async function createNewDiagram() {
    if (creating || editingDocumentId) return;
    creating = true;
    renderDiagram();

    try {
      const title = nextUntitledDiagramTitle(diagramAllDocuments().filter(diagramOwnedByCurrentUser));
      const diagram = createBlankDiagram();
      const result = await createDiagramDocument?.({
        title,
        diagram
      });
      if (!active) return;
      selectedDiagramDocumentId = Number(result?.id || 0);
      diagramViewMode = "tree";
      writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
      creating = false;
      renderDiagram();

      const document = diagramAllDocuments().find(item => item.id === selectedDiagramDocumentId);
      if (!document) throw new Error("The new Diagram could not be loaded.");
      await editDiagram(document, {
        fullScreen: true,
        initialTemplateName: "Green Box with Text"
      });
    } catch (error) {
      creating = false;
      if (active) {
        notify?.(error?.message || "The Diagram could not be created.");
        renderDiagram();
      }
    }
  }

  async function editDiagram(document, options = {}) {
    if (!active || creating || editingDocumentId) return;
    const image = diagramImage(document);
    if (!image?.source) {
      notify?.("The editable Diagram data could not be found.");
      return;
    }

    selectedDiagramDocumentId = document.id;
    editingDocumentId = document.id;
    editingFullScreen = options.fullScreen === true;
    editorAbortController = new AbortController();
    renderDiagram();
    const host = editingFullScreen ? null : app.querySelector("[data-diagram-editor-host]");
    if (!editingFullScreen && !host) {
      editingDocumentId = 0;
      editingFullScreen = false;
      editorAbortController = null;
      renderDiagram();
      return;
    }

    try {
      const result = await openImageAnnotationDialog({
        canvasWidth: blankDiagramWidth,
        canvasHeight: blankDiagramHeight,
        annotationUrl: appUrl(image.source),
        originalFileName: `${safeFileName(document.title)}.svg`,
        title: document.title,
        subtitle: "Editable vector diagram",
        applyLabel: "Save",
        applyingMessage: "Saving the diagram...",
        initialSelection: "none",
        defaultTool: "select",
        entityHeaderActionsOnHover: true,
        wheelZoomsWithoutCtrl: true,
        embedded: !editingFullScreen,
        initiallyMaximized: editingFullScreen,
        initialZoom: options.initialTemplateName ? 1 : null,
        initialTemplateName: options.initialTemplateName || "",
        host,
        signal: editorAbortController.signal,
        askForColor,
        askForText,
        bindRichTextButtons,
        confirm,
        notify,
        uploadEmbeddedImage,
        persistCroppedOriginal,
        loadTemplateLibrary,
        loadDefaultTemplateLibrary,
        saveTemplateLibrary,
        generatePmtDatabaseSchema: typeof loadPmtDatabaseSchema === "function"
          && canAccessResource("Documentation", "Create")
          ? generatePmtDatabaseSchema
          : undefined,
        apply: async diagram => {
          try {
            return await saveDiagramDocument?.(document, { diagram });
          } catch (error) {
            if (!diagramSaveConflict(error)) throw error;

            notify?.("Someone else saved a newer version. Your edits can be saved as a new Diagram.");
            const suggestedTitle = nextAvailableDiagramCopyTitle(
              document.title,
              diagramAllDocuments()
            );
            const title = typeof askForText === "function"
              ? String(await askForText(
                "New Diagram name",
                "A newer Diagram was saved",
                suggestedTitle
              ) || "").trim()
              : "";
            if (!title) {
              throw new Error("The newer Diagram was kept. Enter a new Diagram name to preserve these edits.");
            }

            const savedCopy = await createDiagramDocument?.({
              title,
              diagram,
              sourceDocument: document
            });
            selectedDiagramDocumentId = Number(savedCopy?.id || 0);
            return savedCopy;
          }
        }
      });
      if (result && active) notify?.("Diagram saved.");
    } catch (error) {
      if (active) notify?.(error?.message || "The Diagram could not be opened.");
    } finally {
      editingDocumentId = 0;
      editingFullScreen = false;
      editorAbortController = null;
      previewDiagramDocumentId = 0;
      if (active) renderDiagram();
    }
  }

  async function generatePmtDatabaseSchema() {
    if (generatingDatabaseSchema) return null;
    generatingDatabaseSchema = true;
    try {
      const schema = await loadPmtDatabaseSchema?.();
      const diagram = buildPmtDatabaseSchemaDiagram(schema);
      const result = await createDiagramDocument?.({
        title: diagram.title,
        diagram
      });
      selectedDiagramDocumentId = Number(result?.id || 0);
      return result;
    } finally {
      generatingDatabaseSchema = false;
    }
  }

  function bindDiagramTreeSplitter() {
    const splitter = app.querySelector("[data-diagram-tree-splitter]");
    if (!splitter) return;

    splitter.addEventListener("pointerdown", event => {
      event.preventDefault();
      const layout = splitter.closest(".diagram-tree-layout");
      const startX = event.clientX;
      const startWidth = diagramTreePaneWidth;

      const resize = moveEvent => {
        const layoutWidth = layout?.getBoundingClientRect().width || window.innerWidth;
        const maxWidth = Math.max(220, Math.min(640, layoutWidth - 480));
        diagramTreePaneWidth = Math.min(maxWidth, Math.max(220, startWidth + moveEvent.clientX - startX));
        layout?.style.setProperty("--documentation-tree-pane-width", `${diagramTreePaneWidth}px`);
      };
      const finish = () => {
        writePreference(preferenceKeys.diagramTreePaneWidth, diagramTreePaneWidth);
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    });
  }

  function bindDiagramTreeContextMenu() {
    diagramTreeContextMenuController?.abort();
    diagramTreeContextMenuController = null;

    const tree = app.querySelector(".diagram-tree-pane .documentation-tree");
    const menu = app.querySelector("[data-diagram-tree-context-menu]");
    if (!tree || !menu) return;

    const controller = new AbortController();
    const { signal } = controller;
    diagramTreeContextMenuController = controller;

    const closeMenu = () => {
      menu.hidden = true;
    };

    const showMenu = (document, clientX, clientY) => {
      if (selectedDiagramDocumentId !== document.id) {
        selectedDiagramDocumentId = document.id;
        previewDiagramDocumentId = 0;
        writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
        renderDiagram();
      }

      const activeMenu = app.querySelector("[data-diagram-tree-context-menu]");
      if (!activeMenu) return;

      activeMenu.querySelectorAll("[data-action]").forEach(button => {
        button.dataset.id = String(document.id);
      });
      activeMenu.querySelectorAll("[data-diagram-context-requires-update]").forEach(button => {
        button.disabled = !diagramCanEdit(document);
      });
      activeMenu.querySelectorAll("[data-diagram-context-requires-create]").forEach(button => {
        button.disabled = !canAccessResource("Documentation", "Create");
      });
      activeMenu.querySelectorAll("[data-diagram-context-requires-delete]").forEach(button => {
        button.disabled = !diagramCanDelete(document);
      });
      activeMenu.querySelectorAll("[data-diagram-context-requires-public]").forEach(button => {
        button.disabled = document.isPrivate !== false;
      });

      activeMenu.hidden = false;
      const margin = 8;
      const maximumLeft = Math.max(margin, window.innerWidth - activeMenu.offsetWidth - margin);
      const maximumTop = Math.max(margin, window.innerHeight - activeMenu.offsetHeight - margin);
      activeMenu.style.left = `${Math.round(Math.max(margin, Math.min(clientX, maximumLeft)))}px`;
      activeMenu.style.top = `${Math.round(Math.max(margin, Math.min(clientY, maximumTop)))}px`;
      activeMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    };

    tree.addEventListener("contextmenu", event => {
      const documentButton = event.target.closest?.("[data-action='select-diagram-document']");
      const document = diagramDocuments().find(item => item.id === Number(documentButton?.dataset.id || 0));
      if (!documentButton || !document) return;

      event.preventDefault();
      event.stopPropagation();
      showMenu(document, event.clientX, event.clientY);
    }, { signal });
    menu.addEventListener("contextmenu", event => event.preventDefault(), { signal });
    menu.addEventListener("click", closeMenu, { signal });
    window.addEventListener("pointerdown", event => {
      if (!menu.hidden && !menu.contains(event.target)) closeMenu();
    }, { signal });
    window.addEventListener("scroll", closeMenu, { capture: true, passive: true, signal });
    window.addEventListener("resize", closeMenu, { signal });
    window.addEventListener("keydown", event => {
      if (event.key === "Escape") closeMenu();
    }, { signal });
  }

  function bindDiagramTreeDragAndDrop() {
    const tree = app.querySelector(".diagram-tree-pane .documentation-tree");
    if (!tree) return;
    let draggedId = 0;

    tree.addEventListener("dragstart", event => {
      const row = event.target.closest("[data-diagram-tree-row][draggable='true']");
      draggedId = Number(row?.dataset.id || 0);
      if (!draggedId) {
        event.preventDefault();
        return;
      }
      row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(draggedId));
    });

    tree.addEventListener("dragover", event => {
      if (!draggedId) return;
      const rootDrop = event.target.closest("[data-diagram-root-drop]");
      const row = event.target.closest("[data-diagram-tree-row]");
      clearDiagramDropCues(tree);
      if (rootDrop) {
        event.preventDefault();
        rootDrop.classList.add("is-drop-target");
        return;
      }
      if (!row || Number(row.dataset.id || 0) === draggedId) return;
      const placement = diagramDropPlacement(row, event.clientY);
      if (!diagramDropAllowed(draggedId, Number(row.dataset.id || 0), placement)) return;
      event.preventDefault();
      row.classList.add(`is-drop-${placement}`);
      event.dataTransfer.dropEffect = "move";
    });

    tree.addEventListener("drop", async event => {
      if (!draggedId) return;
      event.preventDefault();
      const movedId = draggedId;
      const rootDrop = event.target.closest("[data-diagram-root-drop]");
      const row = event.target.closest("[data-diagram-tree-row]");
      const targetId = Number(row?.dataset.id || 0);
      const placement = rootDrop ? "root" : diagramDropPlacement(row, event.clientY);
      clearDiagramDropCues(tree);

      const move = diagramMoveAfterDrop(movedId, targetId, placement);
      if (!move) return;
      try {
        await moveDiagramDocument?.(move.document, move);
        diagramSort = "custom";
        writePreference(preferenceKeys.diagramSort, diagramSort);
        selectedDiagramDocumentId = movedId;
        notify?.("Diagram moved.");
        if (active) renderDiagram();
      } catch (error) {
        notify?.(error?.message || "The Diagram could not be moved.");
        if (active) renderDiagram();
      }
    });

    const finish = () => {
      tree.querySelector(".is-dragging")?.classList.remove("is-dragging");
      clearDiagramDropCues(tree);
      draggedId = 0;
    };
    tree.addEventListener("dragend", finish);
    tree.addEventListener("dragleave", event => {
      if (!tree.contains(event.relatedTarget)) clearDiagramDropCues(tree);
    });
  }

  function diagramMoveAfterDrop(movedId, targetId, placement) {
    const documents = diagramAllDocuments().filter(diagramOwnedByCurrentUser);
    const document = documents.find(item => item.id === movedId);
    const target = documents.find(item => item.id === targetId);
    if (!document || !diagramCanEdit(document)) return null;
    if (placement !== "root" && (!target || !diagramDropAllowed(movedId, targetId, placement))) return null;

    const parentBlogId = placement === "root"
      ? null
      : placement === "inside"
        ? target.id
        : target.parentBlogId || null;
    const siblings = documents
      .filter(item =>
        item.id !== movedId
        && Number(item.parentBlogId || 0) === Number(parentBlogId || 0)
        && (!parentBlogId || (
          Number(item.projectId || 0) === Number(document.projectId || 0)
          && Number(item.sprintId || 0) === Number(document.sprintId || 0)
        ))
      )
      .sort(diagramDocumentCompare);
    let insertIndex = 0;
    if (placement === "inside") {
      insertIndex = 0;
    } else if (placement !== "root") {
      const targetIndex = siblings.findIndex(item => item.id === targetId);
      insertIndex = Math.max(0, targetIndex + (placement === "after" ? 1 : 0));
    }
    siblings.splice(insertIndex, 0, document);
    return {
      document,
      parentBlogId,
      orderedBlogIds: siblings.map(item => item.id)
    };
  }

  function diagramDropAllowed(movedId, targetId, placement) {
    if (!movedId || !targetId || movedId === targetId) return false;
    const moved = diagramAllDocuments().find(document => document.id === movedId);
    const target = diagramAllDocuments().find(document => document.id === targetId);
    if (!moved || !target || !diagramCanEdit(target)) return false;
    const targetParentId = placement === "inside" ? target.id : target.parentBlogId || null;
    if (targetParentId
        && (Number(moved.projectId || 0) !== Number(target.projectId || 0)
          || Number(moved.sprintId || 0) !== Number(target.sprintId || 0))) return false;
    return !diagramDescendantIds(movedId).has(targetId);
  }

  function bindDiagramReadonlyViewer() {
    diagramReadonlyContextMenuController?.abort();
    diagramReadonlyContextMenuController = null;
    const viewer = app.querySelector("[data-diagram-readonly-viewer]");
    if (!viewer) return;
    const documentId = Number(viewer.dataset.id || 0);
    const viewport = viewer.querySelector("[data-diagram-viewport]");
    const stage = viewer.querySelector("[data-diagram-stage]");
    const image = viewer.querySelector("[data-diagram-image]");
    const zoomSelect = app.querySelector("[data-diagram-zoom]");
    if (!documentId || !viewport || !stage || !image || !zoomSelect) return;

    let imageWidth = blankDiagramWidth;
    let imageHeight = blankDiagramHeight;
    let renderedZoom = 1;
    let zoomFrame = 0;
    let zoomIdleTimer = 0;
    let suppressZoomScroll = false;
    const zoomSmoothingMilliseconds = 30;
    const zoomIdleMilliseconds = 90;
    let readonlyState = image.matches("svg") ? parseAnnotationSvg(image.outerHTML) : null;
    let readonlyEntityRelationshipsVisible = true;
    let readonlyFieldMappingsVisible = true;
    let readonlyRelationshipLinesOnly = false;
    const replaceReadonlySvg = markup => {
      const next = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
      ["width", "height", "viewBox", "role", "aria-label", "data-pmt-image-annotation-version"]
        .forEach(name => image.setAttribute(name, next.getAttribute(name) || ""));
      image.replaceChildren(...[...next.childNodes].map(node => document.importNode(node, true)));
    };
    if (readonlyState) {
      const layoutResult = resolveAnnotationEntityOverlaps(readonlyState);
      if (layoutResult.movedCount) {
        const markup = buildAnnotationSvg(readonlyState, {
          interactiveEntityHeaders: true,
          interactiveRelationships: true,
          interactiveFieldMapping: true
        });
        replaceReadonlySvg(markup);
      }
    }

    const copyMenu = viewer.querySelector("[data-diagram-readonly-context-menu]");
    let syncReadonlyContextMenu = () => {};
    if (copyMenu) {
      const controller = new AbortController();
      const { signal } = controller;
      diagramReadonlyContextMenuController = controller;
      const closeCopyMenu = () => { copyMenu.hidden = true; };
      const syncReadonlyCheckboxMenuItem = (selector, checked) => {
        const button = copyMenu.querySelector(selector);
        if (!button) return;
        button.disabled = !readonlyState;
        button.classList.toggle("is-checked", checked);
        button.setAttribute("aria-checked", String(checked));
        button.querySelector(".dropdown-menu-check").innerHTML = checked ? "&#10003;" : "";
      };
      syncReadonlyContextMenu = () => {
        syncReadonlyCheckboxMenuItem("[data-diagram-toggle-entity-relationships]", readonlyEntityRelationshipsVisible);
        syncReadonlyCheckboxMenuItem("[data-diagram-toggle-field-mappings]", readonlyFieldMappingsVisible);
        syncReadonlyCheckboxMenuItem("[data-diagram-toggle-relationship-lines-only]", readonlyRelationshipLinesOnly);
      };
      viewport.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
        syncReadonlyContextMenu();
        copyMenu.hidden = false;
        const margin = 8;
        copyMenu.style.left = `${Math.round(Math.max(margin, Math.min(event.clientX, window.innerWidth - copyMenu.offsetWidth - margin)))}px`;
        copyMenu.style.top = `${Math.round(Math.max(margin, Math.min(event.clientY, window.innerHeight - copyMenu.offsetHeight - margin)))}px`;
        copyMenu.querySelector("button")?.focus({ preventScroll: true });
      }, { signal });
      copyMenu.addEventListener("contextmenu", event => event.preventDefault(), { signal });
      copyMenu.addEventListener("click", async event => {
        const toggleButton = event.target.closest?.("[data-diagram-toggle-entity-relationships], [data-diagram-toggle-field-mappings], [data-diagram-toggle-relationship-lines-only]");
        if (toggleButton) {
          event.preventDefault();
          closeCopyMenu();
          if (!readonlyState) {
            notify?.("Diagram view options are only available for editable PMT Diagram SVGs.");
            return;
          }
          if (toggleButton.matches("[data-diagram-toggle-entity-relationships]")) {
            readonlyEntityRelationshipsVisible = !readonlyEntityRelationshipsVisible;
            if (!readonlyEntityRelationshipsVisible) clearReadonlyRelationshipSelection();
          } else if (toggleButton.matches("[data-diagram-toggle-field-mappings]")) {
            readonlyFieldMappingsVisible = !readonlyFieldMappingsVisible;
          } else {
            readonlyRelationshipLinesOnly = !readonlyRelationshipLinesOnly;
          }
          renderReadonlyStateSvg();
          const checked = toggleButton.getAttribute("aria-checked") === "true";
          notify?.(`${toggleButton.querySelector(".dropdown-menu-label")?.textContent || "Diagram option"} ${checked ? "on" : "off"}.`);
          return;
        }

        const button = event.target.closest?.("[data-diagram-copy-format]");
        if (!button) return;
        closeCopyMenu();
        const format = button.dataset.diagramCopyFormat === "png" ? "png" : "svg";
        const options = format === "png" ? await chooseDiagramPngCopyOptions() : await chooseDiagramSvgCopyOptions();
        if (!options) return;
        try {
          let stateForCopy = readonlyState;
          if (!stateForCopy) {
            const document = diagramAllDocuments().find(item => item.id === documentId);
            const source = diagramImage(document)?.source || "";
            stateForCopy = parseAnnotationSvg(decodeDiagramSvgDataUrl(source) || await loadDiagramSvgSource(source));
          }
          if (!stateForCopy) throw new Error("The Diagram could not be read for copying.");
          const portableState = await buildPortableAnnotationState(readonlyDisplayState(stateForCopy));
          const svg = prepareDiagramSvgForDownload(buildAnnotationSvg(portableState, readonlyVisibilityRenderOptions()), options);
          if (format === "png") {
            await copyAnnotationPngToClipboard({ svg, ...annotationSvgClipboardMetrics(svg, portableState) });
            notify?.("Diagram copied as PNG.");
          } else {
            await copyAnnotationSvgToClipboard(svg);
            notify?.("Diagram copied as SVG.");
          }
        } catch (error) {
          notify?.(error?.message || "The Diagram could not be copied.");
        }
      }, { signal });
      window.addEventListener("pointerdown", event => {
        if (!copyMenu.hidden && !copyMenu.contains(event.target)) closeCopyMenu();
      }, { signal });
      window.addEventListener("scroll", closeCopyMenu, { capture: true, passive: true, signal });
      window.addEventListener("resize", closeCopyMenu, { signal });
      window.addEventListener("keydown", event => {
        if (event.key === "Escape") closeCopyMenu();
      }, { signal });
    }

    let readonlySelectedRelationshipId = "";
    let readonlyFieldMappingPinnedKey = "";
    let readonlyFieldMappingPinnedIds = new Set();
    let readonlyFieldMappingActiveIds = new Set();
    let readonlyFieldMappingHoverKey = "";
    let readonlyFieldMappingAttentionActiveKey = "";
    let readonlyFieldMappingAttentionShownKey = "";
    let readonlyFieldMappingAttentionClearTimer = 0;
    let readonlyLastFieldMappingPointerKey = "";
    let readonlyLastFieldMappingPointerAt = 0;
    const readonlyVisibilityRenderOptions = () => ({
      hideEntityRelationships: !readonlyEntityRelationshipsVisible,
      hideFieldRectangleRelationships: !readonlyFieldMappingsVisible,
      relationshipStyleOverride: { showSymbols: readonlyRelationshipLinesOnly !== true }
    });
    const readonlyRenderOptions = () => ({
      ...readonlyVisibilityRenderOptions(),
      interactiveEntityHeaders: true,
      interactiveRelationships: true,
      interactiveFieldMapping: true,
      fieldMappingHoverIds: new Set(),
      selectedRelationshipIds: readonlyEntityRelationshipsVisible && readonlySelectedRelationshipId
        ? new Set([readonlySelectedRelationshipId])
        : null
    });
    const readonlyDisplayState = (stateInput = readonlyState) => stateInput;

    const viewportSize = () => ({
      width: Math.max(1, viewport.clientWidth),
      height: Math.max(1, viewport.clientHeight)
    });

    const stageMetrics = (zoom, size = viewportSize()) => {
      const scaledWidth = imageWidth * zoom;
      const scaledHeight = imageHeight * zoom;
      const stageWidth = Math.max(scaledWidth + (size.width * 2), size.width * 3);
      const stageHeight = Math.max(scaledHeight + (size.height * 2), size.height * 3);
      return {
        scaledWidth,
        scaledHeight,
        stageWidth,
        stageHeight,
        offsetX: (stageWidth - scaledWidth) / 2,
        offsetY: (stageHeight - scaledHeight) / 2
      };
    };

    const drawStage = (zoom, metrics) => {
      const plane = annotationSvgPlaneMetrics(imageWidth, imageHeight, window.devicePixelRatio);
      stage.style.width = `${metrics.stageWidth}px`;
      stage.style.height = `${metrics.stageHeight}px`;
      image.style.left = `${metrics.offsetX}px`;
      image.style.top = `${metrics.offsetY}px`;
      image.style.width = `${plane.width}px`;
      image.style.height = `${plane.height}px`;
      image.style.transform = `scale(${zoom / plane.baseScale})`;
      image.style.visibility = "";
      zoomSelect.value = String(Math.round(zoom * 100));
    };

    const readonlyViewportScrollForContent = (metrics, contentScrollLeft, contentScrollTop) => {
      const offset = diagramReadOnlyD2ComparisonOffset();
      return {
        left: Math.max(0, stage.offsetLeft + metrics.offsetX + contentScrollLeft - offset.x),
        top: Math.max(0, stage.offsetTop + metrics.offsetY + contentScrollTop - offset.y)
      };
    };

    const readonlyCurrentContentScroll = metrics => {
      const offset = diagramReadOnlyD2ComparisonOffset();
      return {
        left: viewport.scrollLeft + offset.x - stage.offsetLeft - metrics.offsetX,
        top: viewport.scrollTop + offset.y - stage.offsetTop - metrics.offsetY
      };
    };

    const renderReadonlyStateSvg = () => {
      if (!readonlyState || !image.matches("svg")) return;
      replaceReadonlySvg(buildAnnotationSvg(readonlyDisplayState(), readonlyRenderOptions()));
      const viewBox = image.viewBox?.baseVal;
      imageWidth = Number.parseFloat(image.getAttribute("width")) || viewBox?.width || imageWidth;
      imageHeight = Number.parseFloat(image.getAttribute("height")) || viewBox?.height || imageHeight;
      drawStage(renderedZoom, stageMetrics(renderedZoom));
      syncReadonlyContextMenu();
      applyReadonlyFieldMappingHighlight();
    };

    const readonlyFieldMappingCellSelector = "[data-annotation-field-mapping-cell]";
    const readonlyFieldMappingCellKey = cell => String(cell?.dataset?.annotationFieldMappingRowKey || "");
    const readonlyFieldMappingCellKind = cell => String(cell?.dataset?.annotationFieldMappingCellKind || "ui");
    const readonlyFieldMappingPointerIsDoubleClick = (cell, event) => {
      const key = readonlyFieldMappingCellKey(cell);
      const now = performance.now();
      const repeated = key && key === readonlyLastFieldMappingPointerKey && now - readonlyLastFieldMappingPointerAt <= 500;
      readonlyLastFieldMappingPointerKey = key;
      readonlyLastFieldMappingPointerAt = now;
      return event.detail > 1 || repeated;
    };
    const readonlyFieldMappingFieldRectangle = cell => {
      const id = String(cell?.dataset?.annotationFieldRectangleId || "");
      return readonlyState?.objects?.find(object => object.id === id && diagramObjectIsFieldRectangle(object)) || null;
    };
    const sameReadonlyIdSet = (left, right) => {
      if (left.size !== right.size) return false;
      for (const id of left) {
        if (!right.has(id)) return false;
      }
      return true;
    };
    const readonlyEntityMatchesReference = (entity, referencedSchema, referencedTable) => {
      if (String(entity?.entityName || "").toLowerCase() !== String(referencedTable || "").toLowerCase()) return false;
      return !referencedSchema
        || String(entity?.entitySchema || "").toLowerCase() === String(referencedSchema || "").toLowerCase();
    };
    const readonlyEntityVisibleFieldIndex = (entity, field) =>
      annotationEntityVisibleFields(entity)
        .findIndex(candidate => String(candidate?.name || "").toLowerCase() === String(field?.name || "").toLowerCase());
    const readonlyRelationshipId = relationship => {
      const parts = [
        relationship.source?.id,
        ...(relationship.foreignKey?.columns || []),
        relationship.target?.id,
        ...(relationship.foreignKey?.referencedColumns || []),
        relationship.foreignKey?.name || ""
      ].map(value => encodeURIComponent(String(value || "").toLocaleLowerCase()));
      return `entity-relationship:${parts.join(":")}`;
    };
    const readonlyEntityRelationships = () => {
      const entities = (Array.isArray(readonlyState?.objects) ? readonlyState.objects : [])
        .filter(object => object?.type === "entity" && object.visible !== false);
      return entities.flatMap(source => (source.foreignKeys || []).map(foreignKey => {
        const sourceField = source.fields?.find(field => (foreignKey.columns || [])
          .some(column => String(column || "").toLowerCase() === String(field?.name || "").toLowerCase()));
        if (!annotationEntityFieldSupportsMapping(sourceField)) return null;
        const target = entities.find(candidate =>
          readonlyEntityMatchesReference(candidate, foreignKey.referencedSchema, foreignKey.referencedTable));
        if (!target || (target === source && source.showSelfRelationships !== true)) return null;
        const targetField = target.fields?.find(field => (foreignKey.referencedColumns || [])
          .some(column => String(column || "").toLowerCase() === String(field?.name || "").toLowerCase())) || null;
        if (!targetField
            || readonlyEntityVisibleFieldIndex(source, sourceField) < 0
            || readonlyEntityVisibleFieldIndex(target, targetField) < 0) return null;
        const relationship = { source, sourceField, target, targetField, foreignKey };
        return { ...relationship, id: readonlyRelationshipId(relationship) };
      }).filter(Boolean));
    };
    const readonlyFieldMappingTargets = cell => {
      const fieldRectangle = readonlyFieldMappingFieldRectangle(cell);
      const ids = new Set();
      const relationships = [];
      const connectedEntities = [];
      let databaseEntity = null;
      let databaseField = null;
      if (!fieldRectangle) {
        return { fieldRectangle: null, relationships, connectedEntities, databaseEntity, databaseField, ids };
      }
      ids.add(fieldRectangle.id);
      if (!readonlyState?.hideAllEntityRelationships) {
        readonlyEntityRelationships()
          .filter(relationship => relationship.source?.id === fieldRectangle.id || relationship.target?.id === fieldRectangle.id)
          .forEach(relationship => {
            relationships.push(relationship);
            ids.add(relationship.id);
            const entity = relationship.source?.id === fieldRectangle.id ? relationship.target : relationship.source;
            const field = relationship.source?.id === fieldRectangle.id ? relationship.targetField : relationship.sourceField;
            if (entity && !diagramObjectIsFieldRectangle(entity)) {
              connectedEntities.push(entity);
              ids.add(entity.id);
              if (!databaseEntity) {
                databaseEntity = entity;
                databaseField = field || null;
              }
            }
          });
      }
      return { fieldRectangle, relationships, connectedEntities, databaseEntity, databaseField, ids };
    };
    const readonlyFieldMappingIds = cell => {
      if (!cell) return new Set();
      return readonlyFieldMappingTargets(cell).ids;
    };
    const readonlyObjectBounds = object => object
      ? {
          x: Number(object.x) || 0,
          y: Number(object.y) || 0,
          width: Math.max(1, Number(object.width) || 1),
          height: Math.max(1, Number(object.height) || 1)
        }
      : null;
    const readonlySvgNumber = value => {
      const number = Number(value);
      return Number.isFinite(number) ? String(Math.round(number * 1000) / 1000) : "0";
    };
    const readonlyBoundsCenter = bounds => ({
      x: bounds.x + (bounds.width / 2),
      y: bounds.y + (bounds.height / 2)
    });
    const readonlyBoundsEdgePointToward = (bounds, target) => {
      const center = readonlyBoundsCenter(bounds);
      const halfWidth = Math.max(0.5, bounds.width / 2);
      const halfHeight = Math.max(0.5, bounds.height / 2);
      const dx = target.x - center.x;
      const dy = target.y - center.y;
      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return center;
      if (Math.abs(dx) * halfHeight > Math.abs(dy) * halfWidth) {
        const scale = halfWidth / Math.max(0.001, Math.abs(dx));
        return {
          x: center.x + (Math.sign(dx) * halfWidth),
          y: center.y + (dy * scale)
        };
      }
      const scale = halfHeight / Math.max(0.001, Math.abs(dy));
      return {
        x: center.x + (dx * scale),
        y: center.y + (Math.sign(dy) * halfHeight)
      };
    };
    function removeReadonlyFieldMappingAttentionArrow() {
      image.querySelectorAll("[data-annotation-field-mapping-attention-arrow]")
        .forEach(element => element.remove());
    }
    function clearReadonlyFieldMappingAttentionArrow() {
      if (readonlyFieldMappingAttentionClearTimer) {
        window.clearTimeout(readonlyFieldMappingAttentionClearTimer);
        readonlyFieldMappingAttentionClearTimer = 0;
      }
      readonlyFieldMappingAttentionActiveKey = "";
      removeReadonlyFieldMappingAttentionArrow();
    }
    function resetReadonlyFieldMappingAttention(resetShown = true) {
      clearReadonlyFieldMappingAttentionArrow();
      readonlyFieldMappingHoverKey = "";
      if (resetShown) readonlyFieldMappingAttentionShownKey = "";
    }
    function queueReadonlyFieldMappingAttentionClear(key) {
      if (readonlyFieldMappingAttentionClearTimer) window.clearTimeout(readonlyFieldMappingAttentionClearTimer);
      readonlyFieldMappingAttentionClearTimer = window.setTimeout(() => {
        readonlyFieldMappingAttentionClearTimer = 0;
        if (readonlyFieldMappingAttentionActiveKey === key) {
          readonlyFieldMappingAttentionActiveKey = "";
          removeReadonlyFieldMappingAttentionArrow();
        }
      }, 3000);
    }
    function activateReadonlyFieldMappingAttention(key, renderNow = true) {
      if (!key) {
        resetReadonlyFieldMappingAttention(true);
        return false;
      }
      if (key === readonlyFieldMappingHoverKey
          && key === readonlyFieldMappingAttentionShownKey
          && !readonlyFieldMappingAttentionActiveKey) return false;
      if (key === readonlyFieldMappingAttentionActiveKey) return false;
      if (readonlyFieldMappingAttentionClearTimer) {
        window.clearTimeout(readonlyFieldMappingAttentionClearTimer);
        readonlyFieldMappingAttentionClearTimer = 0;
      }
      readonlyFieldMappingHoverKey = key;
      readonlyFieldMappingAttentionActiveKey = key;
      readonlyFieldMappingAttentionShownKey = key;
      if (renderNow) renderReadonlyFieldMappingAttentionArrow();
      queueReadonlyFieldMappingAttentionClear(key);
      return true;
    }
    const readonlyFieldMappingNavigationBounds = cell => {
      const targets = readonlyFieldMappingTargets(cell);
      if (readonlyFieldMappingCellKind(cell) === "database") {
        return annotationEntityFieldBounds(targets.databaseEntity, targets.databaseField)
          || readonlyObjectBounds(targets.databaseEntity);
      }
      return readonlyObjectBounds(targets.fieldRectangle);
    };
    const readonlyFieldMappingAttentionArrowSvg = (start, end) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length < 0.001) return "";
      const unitX = dx / length;
      const unitY = dy / length;
      const size = 12 / Math.max(0.05, renderedZoom);
      const base = {
        x: end.x - (unitX * size),
        y: end.y - (unitY * size)
      };
      const wing = size * 0.46;
      const left = {
        x: base.x + (-unitY * wing),
        y: base.y + (unitX * wing)
      };
      const right = {
        x: base.x - (-unitY * wing),
        y: base.y - (unitX * wing)
      };
      return `
        <g class="image-annotation-field-mapping-attention-arrow" data-annotation-field-mapping-attention-arrow="true" pointer-events="none">
          <line class="image-annotation-field-mapping-attention-arrow-line" x1="${readonlySvgNumber(start.x)}" y1="${readonlySvgNumber(start.y)}" x2="${readonlySvgNumber(base.x)}" y2="${readonlySvgNumber(base.y)}" pointer-events="none"></line>
          <polygon class="image-annotation-field-mapping-attention-arrow-head" points="${readonlySvgNumber(end.x)},${readonlySvgNumber(end.y)} ${readonlySvgNumber(left.x)},${readonlySvgNumber(left.y)} ${readonlySvgNumber(right.x)},${readonlySvgNumber(right.y)}" pointer-events="none"></polygon>
        </g>
      `;
    };
    const readonlyFieldMappingCellBounds = cell => ({
      x: Number(cell.dataset.annotationFieldMappingRowX || cell.dataset.annotationFieldMappingCellX),
      y: Number(cell.dataset.annotationFieldMappingRowY || cell.dataset.annotationFieldMappingCellY),
      width: Math.max(1, Number(cell.dataset.annotationFieldMappingRowWidth || cell.dataset.annotationFieldMappingCellWidth) || 1),
      height: Math.max(1, Number(cell.dataset.annotationFieldMappingRowHeight || cell.dataset.annotationFieldMappingCellHeight) || 1)
    });
    const readonlyFieldMappingCellForKind = (cell, kind) => {
      if (!cell) return null;
      if (readonlyFieldMappingCellKind(cell) === kind) return cell;
      const key = readonlyFieldMappingCellKey(cell).replace(/:(ui|database)$/, `:${kind}`);
      return key
        ? image.querySelector(`[data-annotation-field-mapping-row-key="${CSS.escape(key)}"]`)
        : null;
    };
    const readonlyFieldMappingLabelEndPoint = (cell, targetPoint) => {
      const text = cell?.querySelector?.("text");
      if (text) {
        try {
          const box = text.getBBox();
          if (Number.isFinite(box.x) && Number.isFinite(box.y) && Number.isFinite(box.width) && Number.isFinite(box.height)) {
            return {
              x: box.x + box.width + (6 / Math.max(0.05, renderedZoom)),
              y: box.y + (box.height / 2)
            };
          }
        } catch {
          // Fall back to the cell edge if the browser cannot measure the SVG text.
        }
      }
      const bounds = readonlyFieldMappingCellBounds(cell);
      return Number.isFinite(bounds.x) && Number.isFinite(bounds.y) && bounds.width && bounds.height && targetPoint
        ? readonlyBoundsEdgePointToward(bounds, targetPoint)
        : null;
    };
    const readonlyFieldMappingDatabaseFieldBounds = targets =>
      annotationEntityFieldBounds(targets.databaseEntity, targets.databaseField)
        || readonlyObjectBounds(targets.databaseEntity);
    const readonlyFieldMappingAttentionArrowToBounds = (rowBounds, targetBounds) => {
      if (!targetBounds) return "";
      const targetCenter = readonlyBoundsCenter(targetBounds);
      const start = readonlyBoundsEdgePointToward(rowBounds, targetCenter);
      const end = readonlyBoundsEdgePointToward(targetBounds, start);
      return readonlyFieldMappingAttentionArrowSvg(start, end);
    };
    const readonlyFieldMappingAttentionArrowFromLabelToBounds = (cell, targetBounds) => {
      if (!targetBounds) return "";
      const targetCenter = readonlyBoundsCenter(targetBounds);
      const start = readonlyFieldMappingLabelEndPoint(cell, targetCenter);
      if (!start) return "";
      const end = readonlyBoundsEdgePointToward(targetBounds, start);
      return readonlyFieldMappingAttentionArrowSvg(start, end);
    };
    const readonlyFieldMappingAttentionArrowFromLabelToPoint = (cell, targetPoint) => {
      if (!targetPoint) return "";
      const start = readonlyFieldMappingLabelEndPoint(cell, targetPoint);
      return start ? readonlyFieldMappingAttentionArrowSvg(start, targetPoint) : "";
    };
    const readonlyFieldMappingAttentionArrowToPoint = (rowBounds, targetPoint) => {
      if (!targetPoint) return "";
      const start = readonlyBoundsEdgePointToward(rowBounds, targetPoint);
      return readonlyFieldMappingAttentionArrowSvg(start, targetPoint);
    };
    function renderReadonlyFieldMappingAttentionArrow() {
      removeReadonlyFieldMappingAttentionArrow();
      if (!readonlyFieldMappingAttentionActiveKey) return;
      const cell = image.querySelector(`[data-annotation-field-mapping-row-key="${CSS.escape(readonlyFieldMappingAttentionActiveKey)}"]`);
      if (!cell) return;
      const rowBounds = readonlyFieldMappingCellBounds(cell);
      if (!Number.isFinite(rowBounds.x)
          || !Number.isFinite(rowBounds.y)
          || !rowBounds.width
          || !rowBounds.height) return;
      const targets = readonlyFieldMappingTargets(cell);
      const fieldBounds = readonlyObjectBounds(targets.fieldRectangle);
      const databaseFieldPoint = annotationEntityFieldLabelPoint(targets.databaseEntity, targets.databaseField);
      const databaseFieldBounds = readonlyFieldMappingDatabaseFieldBounds(targets);
      const uiCell = readonlyFieldMappingCellForKind(cell, "ui") || cell;
      const databaseCell = readonlyFieldMappingCellForKind(cell, "database") || cell;
      const markup = [
        readonlyFieldMappingAttentionArrowFromLabelToBounds(uiCell, fieldBounds)
          || readonlyFieldMappingAttentionArrowToBounds(rowBounds, fieldBounds),
        databaseFieldPoint
          ? readonlyFieldMappingAttentionArrowFromLabelToPoint(databaseCell, databaseFieldPoint)
            || readonlyFieldMappingAttentionArrowToPoint(rowBounds, databaseFieldPoint)
          : readonlyFieldMappingAttentionArrowFromLabelToBounds(databaseCell, databaseFieldBounds)
            || readonlyFieldMappingAttentionArrowToBounds(rowBounds, databaseFieldBounds)
      ].filter(Boolean).slice(0, 2).join("");
      if (markup) image.insertAdjacentHTML("beforeend", markup);
    }
    function applyReadonlyFieldMappingHighlight() {
      image.querySelectorAll(".image-annotation-object.is-field-mapping-hover, .image-annotation-entity-relationship.is-field-mapping-hover")
        .forEach(element => element.classList.remove("is-field-mapping-hover"));
      image.querySelectorAll("[data-annotation-field-mapping-hover-path]")
        .forEach(element => element.remove());
      image.querySelectorAll("[data-annotation-field-mapping-selection-overlay]")
        .forEach(element => element.remove());
      image.querySelectorAll("[data-annotation-field-mapping-attention-highlight]")
        .forEach(element => element.remove());
      image.querySelectorAll("[data-annotation-field-mapping-active-relationships]")
        .forEach(element => element.remove());
      if (!readonlyFieldMappingsVisible) {
        const relationship = annotationFieldMappingActiveRelationshipsSvg(
          readonlyState,
          readonlyFieldMappingActiveIds,
          {
            zoom: renderedZoom,
            relationshipStyleOverride: {
              showSymbols: readonlyRelationshipLinesOnly !== true
            }
          }
        );
        if (relationship) image.insertAdjacentHTML("beforeend", relationship);
      }
      const highlight = annotationFieldMappingAttentionHighlightSvg(readonlyState, readonlyFieldMappingActiveIds, renderedZoom);
      if (highlight) image.insertAdjacentHTML("beforeend", highlight);
      renderReadonlyFieldMappingAttentionArrow();
    }
    const setReadonlyFieldMappingActiveIds = ids => {
      const nextIds = ids instanceof Set ? ids : new Set(ids || []);
      if (sameReadonlyIdSet(readonlyFieldMappingActiveIds, nextIds)) return;
      readonlyFieldMappingActiveIds = new Set(nextIds);
      applyReadonlyFieldMappingHighlight();
    };
    const scheduleReadonlyFieldMappingAttention = (cell, renderNow = true) => {
      const key = readonlyFieldMappingCellKey(cell);
      if (!key) {
        resetReadonlyFieldMappingAttention(true);
        return false;
      }
      return activateReadonlyFieldMappingAttention(key, renderNow);
    };
    const setReadonlyFieldMappingHover = cell => {
      const validCell = cell && image.contains(cell) ? cell : null;
      if (validCell) {
        const attentionChanged = scheduleReadonlyFieldMappingAttention(validCell, false);
        const nextIds = readonlyFieldMappingIds(validCell);
        if (sameReadonlyIdSet(readonlyFieldMappingActiveIds, nextIds)) {
          if (attentionChanged) renderReadonlyFieldMappingAttentionArrow();
          return;
        }
        setReadonlyFieldMappingActiveIds(nextIds);
        return;
      }
      resetReadonlyFieldMappingAttention(true);
      setReadonlyFieldMappingActiveIds(readonlyFieldMappingPinnedIds);
    };
    const clearReadonlyFieldMappingSelection = () => {
      readonlyFieldMappingPinnedKey = "";
      readonlyFieldMappingPinnedIds = new Set();
      resetReadonlyFieldMappingAttention(true);
      setReadonlyFieldMappingActiveIds(new Set());
    };
    const readonlyViewBoxBounds = () => {
      const viewBox = image.viewBox?.baseVal;
      return {
        x: Number(viewBox?.x) || 0,
        y: Number(viewBox?.y) || 0,
        width: Number(viewBox?.width) || imageWidth,
        height: Number(viewBox?.height) || imageHeight
      };
    };
    const adjustedReadonlyZoomForBounds = (bounds, size = viewportSize()) => {
      const readableZoom = Math.max(
        96 / Math.max(1, bounds.width),
        30 / Math.max(1, bounds.height)
      );
      const fitZoom = Math.min(
        (Math.max(1, size.width) * 0.72) / Math.max(1, bounds.width),
        (Math.max(1, size.height) * 0.58) / Math.max(1, bounds.height)
      );
      let targetZoom = renderedZoom;
      if (renderedZoom < readableZoom) targetZoom = Math.min(readableZoom, fitZoom);
      else if (renderedZoom > fitZoom) targetZoom = fitZoom;
      return clampDiagramZoom(targetZoom);
    };
    const centerReadonlyBounds = bounds => {
      if (!bounds) return false;
      settleZoomAtCurrentDisplay();
      const size = viewportSize();
      const targetZoom = adjustedReadonlyZoomForBounds(bounds, size);
      const metrics = stageMetrics(targetZoom, size);
      if (Math.abs(targetZoom - renderedZoom) >= 0.000001) {
        drawStage(targetZoom, metrics);
        renderedZoom = targetZoom;
        previewZoom = targetZoom;
        applyReadonlyFieldMappingHighlight();
      }
      const viewBox = readonlyViewBoxBounds();
      const centerX = (bounds.x + (bounds.width / 2) - viewBox.x) * targetZoom;
      const centerY = (bounds.y + (bounds.height / 2) - viewBox.y) * targetZoom;
      const scroll = readonlyViewportScrollForContent(
        metrics,
        centerX - (size.width / 2),
        centerY - (size.height / 2)
      );
      suppressZoomScroll = true;
      viewport.scrollLeft = scroll.left;
      viewport.scrollTop = scroll.top;
      window.requestAnimationFrame(() => {
        suppressZoomScroll = false;
      });
      return true;
    };
    const readonlyContentBounds = () => {
      if (!readonlyState) return readonlyViewBoxBounds();
      return annotationContentBounds(readonlyDisplayState()) || readonlyViewBoxBounds();
    };
    const fitReadonlyBounds = (bounds, settleImmediately = false) => {
      if (!bounds) return false;
      cancelTransientZoom();
      const size = viewportSize();
      const availableWidth = Math.max(1, size.width - 32);
      const availableHeight = Math.max(1, size.height - 32);
      const targetZoom = Math.min(2, clampDiagramZoom(Math.min(
        availableWidth / Math.max(1, bounds.width),
        availableHeight / Math.max(1, bounds.height)
      )));
      const metrics = stageMetrics(targetZoom, size);
      drawStage(targetZoom, metrics);
      renderedZoom = targetZoom;
      previewZoom = targetZoom;
      applyReadonlyFieldMappingHighlight();
      const viewBox = readonlyViewBoxBounds();
      const centerX = (bounds.x + (bounds.width / 2) - viewBox.x) * targetZoom;
      const centerY = (bounds.y + (bounds.height / 2) - viewBox.y) * targetZoom;
      const scroll = readonlyViewportScrollForContent(
        metrics,
        centerX - (size.width / 2),
        centerY - (size.height / 2)
      );
      suppressZoomScroll = true;
      viewport.scrollLeft = scroll.left;
      viewport.scrollTop = scroll.top;
      const releaseScrollSuppression = () => {
        suppressZoomScroll = false;
      };
      if (settleImmediately) releaseScrollSuppression();
      else window.requestAnimationFrame(releaseScrollSuppression);
      return true;
    };
    const selectReadonlyFieldMappingCell = (cell, center = false) => {
      if (!cell || !image.contains(cell)) return false;
      const key = readonlyFieldMappingCellKey(cell);
      const targets = readonlyFieldMappingTargets(cell);
      const ids = targets.ids;
      if (!key || !targets.fieldRectangle || !ids.size) return false;
      clearReadonlyRelationshipSelection();
      readonlyFieldMappingPinnedKey = key;
      readonlyFieldMappingPinnedIds = ids;
      activateReadonlyFieldMappingAttention(key, false);
      setReadonlyFieldMappingActiveIds(ids);
      if (center) centerReadonlyBounds(readonlyFieldMappingNavigationBounds(cell));
      const replacement = image.querySelector(`[data-annotation-field-mapping-row-key="${CSS.escape(key)}"]`);
      replacement?.focus?.({ preventScroll: true });
      return true;
    };

    let zoomGesture = null;

    const renderTransientZoom = timestamp => {
      zoomFrame = 0;
      if (!viewer.isConnected || !zoomGesture) return;
      const gesture = zoomGesture;
      const frameTime = Number.isFinite(timestamp) ? timestamp : performance.now();
      const elapsed = Math.max(1, Math.min(50, frameTime - gesture.lastFrameAt));
      const blend = 1 - Math.exp(-elapsed / zoomSmoothingMilliseconds);
      gesture.lastFrameAt = frameTime;
      gesture.displayZoom += (gesture.targetZoom - gesture.displayZoom) * blend;
      gesture.displayContentScrollLeft += (gesture.targetContentScrollLeft - gesture.displayContentScrollLeft) * blend;
      gesture.displayContentScrollTop += (gesture.targetContentScrollTop - gesture.displayContentScrollTop) * blend;
      const complete = Math.abs(gesture.targetZoom - gesture.displayZoom) < 0.00005
        && Math.max(
          Math.abs(gesture.targetContentScrollLeft - gesture.displayContentScrollLeft),
          Math.abs(gesture.targetContentScrollTop - gesture.displayContentScrollTop)
        ) < 0.1;
      if (complete) {
        gesture.displayZoom = gesture.targetZoom;
        gesture.displayContentScrollLeft = gesture.targetContentScrollLeft;
        gesture.displayContentScrollTop = gesture.targetContentScrollTop;
      }
      const translateX = gesture.contentScrollLeft - gesture.displayContentScrollLeft;
      const translateY = gesture.contentScrollTop - gesture.displayContentScrollTop;
      const plane = annotationSvgPlaneMetrics(imageWidth, imageHeight, window.devicePixelRatio);
      const scale = gesture.displayZoom / plane.baseScale;
      image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
      if (!complete) {
        zoomFrame = window.requestAnimationFrame(renderTransientZoom);
      } else if (gesture.inputIdle) {
        settleZoom();
      }
    };

    const settleZoom = () => {
      if (!zoomGesture) return;
      const gesture = zoomGesture;
      zoomGesture = null;
      if (zoomFrame) window.cancelAnimationFrame(zoomFrame);
      if (zoomIdleTimer) window.clearTimeout(zoomIdleTimer);
      zoomFrame = 0;
      zoomIdleTimer = 0;
      if (!viewer.isConnected) return;

      const metrics = stageMetrics(gesture.targetZoom, gesture.viewportSize);
      drawStage(gesture.targetZoom, metrics);
      renderedZoom = gesture.targetZoom;
      const scroll = readonlyViewportScrollForContent(
        metrics,
        gesture.targetContentScrollLeft,
        gesture.targetContentScrollTop
      );
      suppressZoomScroll = true;
      viewport.scrollLeft = scroll.left;
      viewport.scrollTop = scroll.top;
      window.requestAnimationFrame(() => {
        suppressZoomScroll = false;
      });
      viewer.classList.remove("is-zooming");
      image.style.willChange = "";
    };

    const settleZoomAtCurrentDisplay = () => {
      if (!zoomGesture) return;
      const gesture = zoomGesture;
      const currentZoom = clampDiagramZoom(gesture.displayZoom);
      const currentView = zoomAnnotationAtPoint({
        oldZoom: gesture.displayZoom,
        newZoom: currentZoom,
        scrollLeft: gesture.displayContentScrollLeft,
        scrollTop: gesture.displayContentScrollTop,
        pointX: gesture.pointX ?? gesture.viewportSize.width / 2,
        pointY: gesture.pointY ?? gesture.viewportSize.height / 2
      });
      gesture.targetZoom = currentZoom;
      gesture.targetContentScrollLeft = currentView.scrollLeft;
      gesture.targetContentScrollTop = currentView.scrollTop;
      previewZoom = currentZoom;
      settleZoom();
    };

    const cancelTransientZoom = () => {
      zoomGesture = null;
      if (zoomFrame) window.cancelAnimationFrame(zoomFrame);
      if (zoomIdleTimer) window.clearTimeout(zoomIdleTimer);
      zoomFrame = 0;
      zoomIdleTimer = 0;
      viewer.classList.remove("is-zooming");
      image.style.willChange = "";
    };

    const scheduleZoom = (nextZoom, anchor = null, center = false, settleImmediately = false) => {
      const zoom = clampDiagramZoom(nextZoom);
      const currentTargetZoom = zoomGesture?.targetZoom ?? renderedZoom;
      if (!center
          && !settleImmediately
          && Math.abs(zoom - currentTargetZoom) < 0.000001) return;
      previewZoom = zoom;

      if (!zoomGesture) {
        const size = viewportSize();
        const metrics = stageMetrics(renderedZoom, size);
        const viewportStyle = window.getComputedStyle(viewport);
        const currentContentScroll = readonlyCurrentContentScroll(metrics);
        zoomGesture = {
          viewportSize: size,
          stageOffsetLeft: stage.offsetLeft,
          stageOffsetTop: stage.offsetTop,
          paddingRight: Number.parseFloat(viewportStyle.paddingRight) || 0,
          paddingBottom: Number.parseFloat(viewportStyle.paddingBottom) || 0,
          contentScrollLeft: currentContentScroll.left,
          contentScrollTop: currentContentScroll.top,
          targetZoom: renderedZoom,
          targetContentScrollLeft: currentContentScroll.left,
          targetContentScrollTop: currentContentScroll.top,
          displayZoom: renderedZoom,
          displayContentScrollLeft: currentContentScroll.left,
          displayContentScrollTop: currentContentScroll.top,
          lastFrameAt: performance.now(),
          inputIdle: false
        };
        viewer.classList.add("is-zooming");
        image.style.transformOrigin = "0 0";
      }

      const gesture = zoomGesture;
      const pointX = anchor?.x ?? gesture.viewportSize.width / 2;
      const pointY = anchor?.y ?? gesture.viewportSize.height / 2;
      gesture.pointX = pointX;
      gesture.pointY = pointY;
      const metrics = stageMetrics(zoom, gesture.viewportSize);
      if (center) {
        gesture.targetContentScrollLeft = (metrics.scaledWidth / 2) - (gesture.viewportSize.width / 2);
        gesture.targetContentScrollTop = (metrics.scaledHeight / 2) - (gesture.viewportSize.height / 2);
      } else {
        const next = zoomAnnotationAtPoint({
          oldZoom: gesture.targetZoom,
          newZoom: zoom,
          scrollLeft: gesture.targetContentScrollLeft,
          scrollTop: gesture.targetContentScrollTop,
          pointX,
          pointY
        });
        gesture.targetContentScrollLeft = next.scrollLeft;
        gesture.targetContentScrollTop = next.scrollTop;
      }
      gesture.targetZoom = zoom;
      const maximumScrollLeft = Math.max(
        0,
        gesture.stageOffsetLeft
          + metrics.stageWidth
          + gesture.paddingRight
          - gesture.viewportSize.width
      );
      const maximumScrollTop = Math.max(
        0,
        gesture.stageOffsetTop
          + metrics.stageHeight
          + gesture.paddingBottom
          - gesture.viewportSize.height
      );
      const minimumVisibleWidth = Math.min(32, metrics.scaledWidth / 2);
      const minimumVisibleHeight = Math.min(32, metrics.scaledHeight / 2);
      const minimumContentScrollLeft = Math.max(
        -gesture.stageOffsetLeft - metrics.offsetX,
        -gesture.viewportSize.width + minimumVisibleWidth
      );
      const maximumContentScrollLeft = Math.min(
        maximumScrollLeft - gesture.stageOffsetLeft - metrics.offsetX,
        metrics.scaledWidth - minimumVisibleWidth
      );
      const minimumContentScrollTop = Math.max(
        -gesture.stageOffsetTop - metrics.offsetY,
        -gesture.viewportSize.height + minimumVisibleHeight
      );
      const maximumContentScrollTop = Math.min(
        maximumScrollTop - gesture.stageOffsetTop - metrics.offsetY,
        metrics.scaledHeight - minimumVisibleHeight
      );
      gesture.targetContentScrollLeft = Math.max(
        minimumContentScrollLeft,
        Math.min(maximumContentScrollLeft, gesture.targetContentScrollLeft)
      );
      gesture.targetContentScrollTop = Math.max(
        minimumContentScrollTop,
        Math.min(maximumContentScrollTop, gesture.targetContentScrollTop)
      );
      gesture.inputIdle = false;

      if (settleImmediately) {
        settleZoom();
        return;
      }
      if (!zoomFrame) zoomFrame = window.requestAnimationFrame(renderTransientZoom);
      if (zoomIdleTimer) window.clearTimeout(zoomIdleTimer);
      zoomIdleTimer = window.setTimeout(() => {
        if (!zoomGesture) return;
        zoomGesture.inputIdle = true;
        if (!zoomFrame) settleZoom();
      }, zoomIdleMilliseconds);
    };

    const fit = (settleImmediately = false) => {
      fitReadonlyBounds(readonlyContentBounds(), settleImmediately);
    };

    const initialize = () => {
      const viewBox = image.viewBox?.baseVal;
      imageWidth = image.naturalWidth
        || Number.parseFloat(image.getAttribute("width"))
        || viewBox?.width
        || blankDiagramWidth;
      imageHeight = image.naturalHeight
        || Number.parseFloat(image.getAttribute("height"))
        || viewBox?.height
        || blankDiagramHeight;
      image.style.visibility = "hidden";
      if (previewDiagramDocumentId !== documentId) {
        previewDiagramDocumentId = documentId;
        fit(true);
      } else {
        scheduleZoom(previewZoom, null, false, true);
      }
    };
    if (image.matches("svg") || image.complete) initialize();
    else image.addEventListener("load", initialize, { once: true });

    const activateEntityHeaderControl = control => {
      if (!readonlyState || !control || control.getAttribute("aria-disabled") === "true") return;
      const entity = readonlyState.objects.find(object => object.type === "entity"
        && object.id === control.dataset.annotationEntityId);
      const action = control.dataset.annotationEntityHeaderAction;
      if (!entity || !["collapsed", "showDataTypes"].includes(action)) return;

      const before = control.getBoundingClientRect();
      if (action === "collapsed") setAnnotationEntityCollapsedState(entity, entity.collapsed !== true);
      else setAnnotationEntityDataTypeVisibility(entity, entity.showDataTypes !== true);
      resolveAnnotationEntitySizeChangeLayout(readonlyState, entity);
      const entityIndex = readonlyState.objects.indexOf(entity);
      if (entityIndex >= 0 && entityIndex !== readonlyState.objects.length - 1) {
        readonlyState.objects.splice(entityIndex, 1);
        readonlyState.objects.push(entity);
      }

      renderReadonlyStateSvg();

      const replacement = image.querySelector(
        `[data-annotation-entity-id='${CSS.escape(entity.id)}'][data-annotation-entity-header-action='${action}']`
      );
      if (replacement) {
        const after = replacement.getBoundingClientRect();
        viewport.scrollLeft += after.left - before.left;
        viewport.scrollTop += after.top - before.top;
        replacement.focus({ preventScroll: true });
      }
    };

    const relationshipSelector = "[data-annotation-object-type='entity-relationship']";
    const clearReadonlyRelationshipSelection = () => {
      readonlySelectedRelationshipId = "";
      image.querySelectorAll(`${relationshipSelector}.is-selected`).forEach(relationship => {
        relationship.classList.remove("is-selected");
        relationship.removeAttribute("aria-current");
        relationship.setAttribute("aria-pressed", "false");
      });
    };
    const selectReadonlyRelationship = relationship => {
      if (!relationship || !image.contains(relationship)) return;
      clearReadonlyRelationshipSelection();
      readonlySelectedRelationshipId = relationship.dataset.annotationObjectId || "";
      relationship.classList.add("is-selected");
      relationship.setAttribute("aria-current", "true");
      relationship.setAttribute("aria-pressed", "true");
      relationship.focus?.({ preventScroll: true });
    };

    viewport.addEventListener("pointermove", event => {
      if (event.buttons) return;
      const cell = event.target.closest?.(readonlyFieldMappingCellSelector);
      setReadonlyFieldMappingHover(cell && image.contains(cell) ? cell : null);
    });
    viewport.addEventListener("pointerleave", () => setReadonlyFieldMappingHover(null));
    viewport.addEventListener("pointerdown", event => {
      const fieldMappingCell = event.target.closest?.(readonlyFieldMappingCellSelector);
      if (!fieldMappingCell || !image.contains(fieldMappingCell) || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      selectReadonlyFieldMappingCell(fieldMappingCell, readonlyFieldMappingPointerIsDoubleClick(fieldMappingCell, event));
    }, true);
    viewport.addEventListener("dblclick", event => {
      const fieldMappingCell = event.target.closest?.(readonlyFieldMappingCellSelector);
      if (!fieldMappingCell || !image.contains(fieldMappingCell)) return;
      event.preventDefault();
      event.stopPropagation();
      selectReadonlyFieldMappingCell(fieldMappingCell, true);
    });
    viewport.addEventListener("click", event => {
      const fieldMappingCell = event.target.closest?.(readonlyFieldMappingCellSelector);
      if (fieldMappingCell && image.contains(fieldMappingCell)) {
        event.preventDefault();
        event.stopPropagation();
        selectReadonlyFieldMappingCell(fieldMappingCell, false);
        return;
      }
      const relationship = event.target.closest?.(relationshipSelector);
      if (relationship && image.contains(relationship)) {
        event.preventDefault();
        event.stopPropagation();
        const relationshipId = relationship.dataset.annotationObjectId || "";
        clearReadonlyFieldMappingSelection();
        selectReadonlyRelationship(
          image.querySelector(`[data-annotation-object-id="${CSS.escape(relationshipId)}"]`) || relationship
        );
        return;
      }
      const control = event.target.closest?.("[data-annotation-entity-header-action]");
      if (!control) {
        if (event.target === image || event.target === stage || event.target === viewport) {
          clearReadonlyRelationshipSelection();
          clearReadonlyFieldMappingSelection();
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      activateEntityHeaderControl(control);
    });

    app.querySelector("[data-diagram-zoom-out]")?.addEventListener("click", () => scheduleZoom(previewZoom - 0.05));
    app.querySelector("[data-diagram-zoom-in]")?.addEventListener("click", () => scheduleZoom(previewZoom + 0.05));
    app.querySelector("[data-diagram-fit]")?.addEventListener("click", () => fit());
    zoomSelect.addEventListener("change", () => scheduleZoom(Number(zoomSelect.value || 100) / 100));
    viewport.addEventListener("wheel", event => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      scheduleZoom(previewZoom + (event.deltaY < 0 ? 0.05 : -0.05), {
        x: event.clientX - rect.left - viewport.clientLeft,
        y: event.clientY - rect.top - viewport.clientTop
      });
    }, { passive: false });
    viewport.addEventListener("scroll", () => {
      if (!suppressZoomScroll) settleZoomAtCurrentDisplay();
    });

    viewport.addEventListener("keydown", event => {
      const fieldMappingCell = event.target.closest?.(readonlyFieldMappingCellSelector);
      if (fieldMappingCell && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        selectReadonlyFieldMappingCell(fieldMappingCell, false);
        return;
      }
      const control = event.target.closest?.("[data-annotation-entity-header-action]");
      if (control && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        activateEntityHeaderControl(control);
        return;
      }
      const relationship = event.target.closest?.(relationshipSelector);
      if (relationship && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        selectReadonlyRelationship(relationship);
        return;
      }
      if (event.key === "Escape") clearReadonlyRelationshipSelection();
      if (event.key === "+" || event.key === "=") scheduleZoom(previewZoom + 0.05);
      if (event.key === "-") scheduleZoom(previewZoom - 0.05);
      if (event.key === "0") fit();
    });

    viewport.addEventListener("pointerdown", event => {
      if (event.target.closest?.("[data-annotation-entity-header-action]")) return;
      if (event.target.closest?.(relationshipSelector)) return;
      if (event.button !== 0 && event.button !== 1) return;
      settleZoomAtCurrentDisplay();
      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-panning");
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = viewport.scrollLeft;
      const startTop = viewport.scrollTop;
      const move = moveEvent => {
        viewport.scrollLeft = startLeft - (moveEvent.clientX - startX);
        viewport.scrollTop = startTop - (moveEvent.clientY - startY);
      };
      const finish = () => {
        viewport.classList.remove("is-panning");
        viewport.removeEventListener("pointermove", move);
        viewport.removeEventListener("pointerup", finish);
        viewport.removeEventListener("pointercancel", finish);
      };
      viewport.addEventListener("pointermove", move);
      viewport.addEventListener("pointerup", finish);
      viewport.addEventListener("pointercancel", finish);
    });

  }

  function deactivate() {
    active = false;
    creating = false;
    diagramPreviewHydrationToken += 1;
    diagramTreeContextMenuController?.abort();
    diagramTreeContextMenuController = null;
    diagramReadonlyContextMenuController?.abort();
    diagramReadonlyContextMenuController = null;
    cancelEmbeddedEditor();
  }

  function cancelEmbeddedEditor() {
    editorAbortController?.abort();
    editorAbortController = null;
    editingDocumentId = 0;
    editingFullScreen = false;
  }

  return {
    deactivate,
    handleAction,
    handleFilterChange,
    render: renderDiagram,
    view(id) {
      const requestedId = Number(id || 0);
      const document = state.blogs.find(item =>
        item.id === requestedId
        && Boolean(diagramImage(item))
        && (item.isPrivate === false || diagramOwnedByCurrentUser(item))
      );
      if (!document) return false;
      sharedDiagramDocumentId = document.id;
      if (selectedDiagramDocumentId !== document.id || diagramViewMode !== "tree") {
        selectedDiagramDocumentId = document.id;
        diagramTreeRevealSelection = true;
        previewDiagramDocumentId = 0;
        diagramViewMode = "tree";
        writePreference(preferenceKeys.diagramSelectedDocument, selectedDiagramDocumentId);
        writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
        if (active) renderDiagram();
      }
      return true;
    }
  };
}

function diagramDocuments() {
  const directShared = diagramAllDocuments().find(document => document.id === sharedDiagramDocumentId);
  const documents = diagramAllDocuments()
    .filter(document => diagramMatchesFilters(document));
  if (directShared && !documents.some(document => document.id === directShared.id)) documents.push(directShared);
  return documents
    .sort(diagramDocumentCompare);
}

function diagramAllDocuments() {
  return state.blogs
    .filter(document => diagramOwnedByCurrentUser(document) || document.isPrivate === false)
    .filter(document => Boolean(diagramImage(document)));
}

function diagramDocumentCompare(left, right) {
  if (diagramSort === "name") {
    return String(left.title || "").localeCompare(String(right.title || "")) || left.id - right.id;
  }
  if (diagramSort === "oldest") {
    return diagramUpdatedTime(left) - diagramUpdatedTime(right)
      || String(left.title || "").localeCompare(String(right.title || ""))
      || left.id - right.id;
  }
  if (diagramSort === "custom") return diagramCustomCompare(left, right);
  return diagramLatestCompare(left, right);
}

function diagramLatestCompare(left, right) {
  return diagramUpdatedTime(right) - diagramUpdatedTime(left)
    || String(left.title || "").localeCompare(String(right.title || ""))
    || right.id - left.id;
}

function diagramCustomCompare(left, right) {
  const leftOrder = Number(left.sortOrder || 0);
  const rightOrder = Number(right.sortOrder || 0);
  if (leftOrder && rightOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
  if (leftOrder !== rightOrder) return rightOrder ? -1 : 1;
  return diagramLatestCompare(left, right);
}

function diagramMatchesFilters(document) {
  if (diagramProjectId && Number(document.projectId || 0) !== diagramProjectId) return false;
  if (diagramSprintId === "none" && document.sprintId) return false;
  if (
    diagramSprintId !== "all"
    && diagramSprintId !== "none"
    && Number(document.sprintId || 0) !== Number(diagramSprintId || 0)
  ) return false;
  if (diagramVisibility === "private" && document.isPrivate === false) return false;
  if (diagramVisibility === "public" && document.isPrivate !== false) return false;
  if (diagramCreatorFilters.length && !diagramCreatorFilters.map(String).includes(String(document.createdByUserId || ""))) return false;
  if (diagramLastEditorFilters.length && !diagramLastEditorFilters.map(String).includes(String(diagramLastEditorUserId(document)))) return false;
  if (!diagramSearch) return true;

  const project = state.projects.find(item => item.id === Number(document.projectId || 0));
  const sprint = state.sprints.find(item => item.id === Number(document.sprintId || 0));
  const haystack = [
    document.title,
    project?.code,
    project?.title,
    sprint?.code,
    sprint?.title,
    document.isPrivate === false ? "public" : "private",
    diagramSvgSearchText(document)
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(diagramSearch.toLowerCase());
}

function diagramLatestUpdatedHistory(document) {
  return (document.history || []).find(item => item.action === "Updated") || null;
}

function diagramLastEditorUserId(document) {
  return diagramLatestUpdatedHistory(document)?.userId
    || document.updatedByUserId
    || document.createdByUserId
    || 0;
}

function diagramUserFilterItems() {
  return state.users.map(user => ({
    value: user.id,
    text: diagramUserName(user.id),
    avatarUrl: user.avatarUrl
  }));
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

function diagramDateTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).replace(",", "").toLowerCase();
}

function diagramSvgSearchText(document) {
  const source = diagramImage(document)?.source || "";
  if (!source || !diagramSourceIsSvg(source)) return "";
  if (diagramSvgSearchTextCache.has(source)) return diagramSvgSearchTextCache.get(source);

  const svg = decodeDiagramSvgDataUrl(source) || diagramSvgSourceCache.get(source) || "";
  const searchText = svg.toLowerCase();
  if (svg) diagramSvgSearchTextCache.set(source, searchText);
  return searchText;
}

async function loadDiagramSearchSources() {
  const sources = [...new Set(diagramAllDocuments()
    .map(document => diagramImage(document)?.source || "")
    .filter(source => source
      && diagramSourceIsSvg(source)
      && !decodeDiagramSvgDataUrl(source)
      && !diagramSvgSourceCache.has(source)))];
  if (!sources.length) return false;

  const loaded = await Promise.all(sources.map(source => loadDiagramSvgSource(source)));
  return loaded.some(Boolean);
}

function diagramSourceIsSvg(sourceInput) {
  const source = String(sourceInput || "");
  return /^data:image\/svg\+xml(?:;|,)/i.test(source)
    || /\.svg(?:[?#]|$)/i.test(source);
}

function diagramObjectIsFieldRectangle(object) {
  return object?.type === "entity" && object.entityKind === "field-rectangle";
}

function diagramOwnedByCurrentUser(document) {
  return Number(document?.createdByUserId || 0) === Number(currentUserId || 0);
}

function diagramCanEdit(document) {
  return diagramOwnedByCurrentUser(document) && canAccessResource("Documentation", "Update");
}

function diagramCanDelete(document) {
  return diagramOwnedByCurrentUser(document) && canAccessResource("Documentation", "Delete");
}

function diagramUpdatedTime(document) {
  return Date.parse(document.updatedAt || document.createdAt || "") || 0;
}

function diagramImage(document) {
  const container = globalThis.document?.createElement?.("template");
  if (!container) return null;
  container.innerHTML = String(document?.bodyHtml || "");
  const image = container.content.querySelector("img[data-pmt-diagram='true'], img[data-pmt-private-diagram='true']");
  if (!image) return null;
  const source = String(image.getAttribute("src") || "").trim();
  if (!source) return null;
  return { source };
}

function diagramReadonlyImageHtml(sourceInput, title) {
  const source = String(sourceInput || blankDiagramSource);
  const svgSource = decodeDiagramSvgDataUrl(source) || diagramSvgSourceCache.get(source) || "";
  const state = parseAnnotationSvg(svgSource);
  if (!state) {
    return `<img src="${escapeAttr(appUrl(source))}" alt="${escapeAttr(title)} preview" data-diagram-image draggable="false">`;
  }

  return buildAnnotationSvg(state, {
    interactiveEntityHeaders: true,
    interactiveRelationships: true,
    interactiveFieldMapping: true
  })
    .replace(/^<\?xml[^>]*>\s*/i, "")
    .replace("<svg ", `<svg class="diagram-readonly-svg" data-diagram-image `)
    .replace('aria-label="Annotated image"', `aria-label="${escapeAttr(title)} preview"`);
}

async function loadDiagramSvgSource(sourceInput) {
  const source = String(sourceInput || "").trim();
  if (!source) return "";
  const embedded = decodeDiagramSvgDataUrl(source);
  if (embedded) return embedded;
  if (diagramSvgSourceCache.has(source)) return diagramSvgSourceCache.get(source);
  if (diagramSvgSourceLoads.has(source)) return diagramSvgSourceLoads.get(source);

  const load = (async () => {
    try {
      const response = await fetch(appUrl(source), {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) return "";
      const svg = await response.text();
      if (!/<svg(?:\s|>)/i.test(svg)) return "";
      diagramSvgSourceCache.set(source, svg);
      return svg;
    } catch {
      return "";
    } finally {
      diagramSvgSourceLoads.delete(source);
    }
  })();
  diagramSvgSourceLoads.set(source, load);
  return load;
}

function decodeDiagramSvgDataUrl(sourceInput) {
  const source = String(sourceInput || "");
  const separator = source.indexOf(",");
  if (separator < 0 || !/^data:image\/svg\+xml(?:;|,)/i.test(source)) return "";

  try {
    const metadata = source.slice(0, separator).toLowerCase();
    const payload = source.slice(separator + 1);
    if (!metadata.includes(";base64")) return decodeURIComponent(payload);
    const binary = atob(payload.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function createBlankDiagram() {
  const annotationState = {
    width: blankDiagramWidth,
    height: blankDiagramHeight,
    gridVisible: false,
    snapToGrid: false,
    objects: []
  };
  return {
    state: annotationState,
    svg: buildAnnotationSvg(annotationState),
    fileName: "diagram.svg"
  };
}

function diagramLockIconHtml() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="14" height="10" rx="2"></rect>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
      <path d="M12 14v3"></path>
    </svg>
  `;
}

function annotationSvgClipboardMetrics(svg, stateInput) {
  const viewBox = String(svg || "").match(/\bviewBox=["']\s*[-+\d.e]+\s+[-+\d.e]+\s+([-+\d.e]+)\s+([-+\d.e]+)\s*["']/i);
  return {
    width: Math.max(1, Number(viewBox?.[1]) || Number(stateInput?.width) || blankDiagramWidth),
    height: Math.max(1, Number(viewBox?.[2]) || Number(stateInput?.height) || blankDiagramHeight)
  };
}

function downloadTextFile(contents, fileName, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

function availableDiagramTitle(title, documents) {
  const requested = String(title || "Imported Diagram").trim() || "Imported Diagram";
  const exists = (documents || []).some(document => String(document?.title || "").trim().toLocaleLowerCase() === requested.toLocaleLowerCase());
  return exists ? nextAvailableDiagramCopyTitle(requested, documents) : requested;
}

function diagramDownloadIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11M8 10l4 4 4-4M5 17v3h14v-3"></path>
    </svg>
  `;
}

function diagramSaveConflict(error) {
  return Number(error?.status || 0) === 409
    || /newer version of this item exists/i.test(String(error?.message || ""));
}

function nextAvailableDiagramCopyTitle(title, documents) {
  const baseTitle = String(title || "Diagram").trim() || "Diagram";
  const titles = new Set((documents || []).map(document => String(document?.title || "").trim().toLocaleLowerCase()));
  let suffix = 2;
  while (titles.has(`${baseTitle} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${baseTitle} ${suffix}`;
}

function diagramProjectOptions() {
  return [
    { id: "", title: "Global" },
    ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))
  ];
}

function diagramSprintOptions(projectId) {
  const numericProjectId = Number(projectId || 0);
  return [
    { id: "", title: "No Sprint" },
    ...state.sprints
      .filter(sprint => sprint.projectId === numericProjectId)
      .map(sprint => ({ id: sprint.id, title: `${sprint.code} - ${sprint.title}` }))
  ];
}

function diagramParentOptions(document, projectId, sprintId, isPublic) {
  const excludedIds = diagramDescendantIds(document.id);
  excludedIds.add(document.id);
  return [
    { id: "", title: "No parent" },
    ...diagramAllDocuments()
      .filter(candidate =>
        diagramOwnedByCurrentUser(candidate)
        && !excludedIds.has(candidate.id)
        && Number(candidate.projectId || 0) === Number(projectId || 0)
        && Number(candidate.sprintId || 0) === Number(sprintId || 0)
        && (!isPublic || candidate.isPrivate === false)
      )
      .sort(diagramDocumentCompare)
      .map(candidate => ({ id: candidate.id, title: candidate.title }))
  ];
}

function diagramDescendantIds(documentId) {
  const descendants = new Set();
  let added = true;
  while (added) {
    added = false;
    diagramAllDocuments().forEach(document => {
      if (document.parentBlogId && (document.parentBlogId === documentId || descendants.has(document.parentBlogId)) && !descendants.has(document.id)) {
        descendants.add(document.id);
        added = true;
      }
    });
  }
  return descendants;
}

function diagramOptionsHtml(options, selectedId) {
  return options
    .map(option => `<option value="${escapeAttr(option.id)}" ${String(option.id) === String(selectedId ?? "") ? "selected" : ""}>${escapeHtml(option.title)}</option>`)
    .join("");
}

function diagramFilterOptionsHtml(options, selectedValue) {
  return options
    .map(option => `<option value="${escapeAttr(option.value)}" ${String(option.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
    .join("");
}

function diagramProjectLabel(projectId) {
  if (!projectId) return "Global";
  const project = state.projects.find(item => item.id === Number(projectId));
  return project ? `${project.code} - ${project.title}` : "Project";
}

function diagramSprintLabel(sprintId) {
  const sprint = state.sprints.find(item => item.id === Number(sprintId));
  return sprint ? `${sprint.code} - ${sprint.title}` : "Sprint";
}

function diagramDropPlacement(row, clientY) {
  if (!row) return "before";
  const rect = row.getBoundingClientRect();
  const ratio = rect.height ? (clientY - rect.top) / rect.height : 0;
  if (ratio < 0.3) return "before";
  if (ratio > 0.7) return "after";
  return "inside";
}

function clearDiagramDropCues(tree) {
  tree?.querySelectorAll(".is-drop-before, .is-drop-after, .is-drop-inside, .is-drop-target")
    .forEach(element => element.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside", "is-drop-target"));
}

function diagramZoomOptionsHtml() {
  return Array.from({ length: 59 }, (_, index) => 10 + (index * 5))
    .map(percent => `<option value="${percent}">${percent}%</option>`)
    .join("");
}

function clampDiagramZoom(value) {
  const rounded = Math.round((Number(value) || 1) * 20) / 20;
  return Math.min(3, Math.max(0.1, rounded));
}

function nextUntitledDiagramTitle(documents) {
  const highestSequence = documents.reduce((highest, document) => {
    const match = /^Untitled\s+(\d+)$/i.exec(String(document.title || "").trim());
    return match ? Math.max(highest, Number(match[1]) || 0) : highest;
  }, 0);
  return `Untitled ${highestSequence + 1}`;
}

function safeFileName(value) {
  return String(value || "diagram").replace(/[\\/:*?"<>|]+/g, "-").trim() || "diagram";
}
