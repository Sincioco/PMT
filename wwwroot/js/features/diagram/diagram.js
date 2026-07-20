import { buttonContent, funnelIconHtml, pageActionsMenuHtml } from "../../components/buttons.js?v=20260717-multi-screen-header";
import {
  annotationSvgPlaneMetrics,
  buildAnnotationSvg,
  buildPortableAnnotationSvg,
  openImageAnnotationDialog,
  parseAnnotationSvg,
  resolveAnnotationEntityOverlaps,
  resolveAnnotationEntitySizeChangeLayout,
  setAnnotationEntityCollapsedState,
  setAnnotationEntityDataTypeVisibility,
  zoomAnnotationAtPoint
} from "../../components/image-annotation.js?v=20260720-layout-diagram-polish-v1";
import {
  checkedFilterValues,
  filterCheckList,
  filterSelect
} from "../../components/filters.js";
import { field, optionalNumberValue, selectOptionsField, value } from "../../components/forms.js?v=20260719-rte-insert-diagram";
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
import { buildPmtDatabaseSchemaDiagram } from "./pmt-database-schema.js?v=20260720-layout-diagram-polish-v1";

const diagramViewModes = new Set(["cards", "tree"]);
const diagramSortModes = new Set(["latest", "oldest", "name", "custom"]);
const diagramVisibilityModes = new Set(["both", "private", "public"]);
const blankDiagramWidth = 1600;
const blankDiagramHeight = 900;
const diagramSvgSourceCache = new Map();
const diagramSvgSourceLoads = new Map();
const diagramSvgSearchTextCache = new Map();
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
let selectedDiagramDocumentId = 0;
let sharedDiagramDocumentId = 0;
let previewDiagramDocumentId = 0;
let previewZoom = 1;
const collapsedDiagramDocumentIds = new Set();

export function createDiagramFeature({
  app,
  askForColor,
  askForText,
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

  function renderDiagram() {
    const wasActive = active;
    active = true;
    if (!wasActive) previewDiagramDocumentId = 0;
    if (editingDocumentId && app.querySelector("[data-diagram-editor-host]")) return;
    const documents = diagramDocuments();
    const documentIds = new Set(documents.map(document => document.id));
    if (!documentIds.has(selectedDiagramDocumentId)) {
      selectedDiagramDocumentId = documents[0]?.id || 0;
      previewDiagramDocumentId = 0;
      if (/^#\/diagram\/\d+(?:\?|$)/i.test(globalThis.window?.location?.hash || "")) {
        updateBrowserUrl(routeForContent("diagram", selectedDiagramDocumentId), { replace: true });
      }
    }
    if (editingDocumentId && !documentIds.has(editingDocumentId)) cancelEmbeddedEditor();
    const selectedDocument = documents.find(document => document.id === selectedDiagramDocumentId) || null;

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
      const source = diagramImage(selectedDocument)?.source || "";
      if (source && !decodeDiagramSvgDataUrl(source) && !diagramSvgSourceCache.has(source)) {
        void loadDiagramSvgSource(source).then(loaded => {
          if (!loaded
              || !active
              || editingDocumentId
              || selectedDiagramDocumentId !== selectedDocument?.id) return;
              previewDiagramDocumentId = 0;
              renderDiagram();
            });
      }
    } else {
      diagramTreeContextMenuController?.abort();
      diagramTreeContextMenuController = null;
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
      }])}
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

    return `<div class="grid documentation-grid diagram-grid">
      ${documents.map(diagramCardHtml).join("")}
    </div>`;
  }

  function diagramCardHtml(document) {
    const image = diagramImage(document);
    return `
      <article class="card clickable-card documentation-card diagram-card" data-action="select-diagram-card" data-id="${document.id}" title="${escapeAttr(document.title)}">
        <div class="documentation-card-top">
          <div class="documentation-card-title-row">
            <div class="documentation-title-block"><h3>${escapeHtml(document.title)}</h3></div>
            <div class="row documentation-project documentation-card-badges">
              <span class="pill">${document.isPrivate === false ? "Public" : "Private"}</span>
            </div>
          </div>
          <div class="documentation-card-meta"><span>Updated ${escapeHtml(formatDate(document.updatedAt || document.createdAt))}</span></div>
        </div>
        <div class="documentation-card-body diagram-card-preview">
          <img src="${escapeAttr(appUrl(image?.source || blankDiagramSource))}" alt="${escapeAttr(document.title)} preview" loading="lazy" decoding="async">
        </div>
        <div class="documentation-card-bottom has-top-created-meta">
          <div class="documentation-card-meta documentation-card-created-meta"><span>Diagram</span></div>
        </div>
      </article>
    `;
  }

  function diagramTreeViewHtml(documents) {
    const selectedDocument = documents.find(document => document.id === selectedDiagramDocumentId) || null;
    return `
      <div class="documentation-tree-layout diagram-tree-layout ${diagramTreePaneHidden ? "is-tree-hidden" : ""}" style="--documentation-tree-pane-width:${diagramTreePaneWidth}px">
        <aside class="panel documentation-tree-pane diagram-tree-pane" ${diagramTreePaneHidden ? "hidden" : ""}>
          <div class="documentation-tree" role="tree" aria-label="Diagrams">
            ${documents.length ? diagramTreeNavHtml(documents) : `<div class="documentation-tree-empty">No diagrams match the current filters.</div>`}
          </div>
        </aside>
        <div class="documentation-tree-splitter" data-diagram-tree-splitter ${diagramTreePaneHidden ? "hidden" : ""} role="separator" aria-orientation="vertical" aria-label="Resize diagram navigation"></div>
        <section class="panel documentation-tree-preview diagram-tree-content ${editingDocumentId ? "is-editing" : ""}">
          ${editingDocumentId && !editingFullScreen && selectedDocument?.id === editingDocumentId
            ? `<div class="diagram-inline-editor-host" data-diagram-editor-host><div class="empty">Loading diagram editor...</div></div>`
            : diagramTreePreviewHtml(selectedDocument)}
        </section>
        ${diagramTreeContextMenuHtml()}
      </div>
    `;
  }

  function diagramTreeNavHtml(documents) {
    const byId = new Map(documents.map(document => [document.id, document]));
    const childrenByParent = new Map();
    documents.forEach(document => {
      const parentId = byId.has(document.parentBlogId) ? document.parentBlogId : 0;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId).push(document);
    });
    childrenByParent.forEach(children => children.sort(diagramDocumentCompare));

    const renderChildren = (parentId, depth) => (childrenByParent.get(parentId) || [])
      .map(document => diagramTreeRowHtml(document, depth, childrenByParent, renderChildren))
      .join("");

    return `
      <div class="diagram-tree-root-drop" data-diagram-root-drop aria-hidden="true"></div>
      ${renderChildren(0, 0)}
    `;
  }

  function diagramTreeRowHtml(document, depth, childrenByParent, renderChildren) {
    const selected = document.id === selectedDiagramDocumentId;
    const children = childrenByParent.get(document.id) || [];
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
      ${hasChildren && !collapsed ? renderChildren(document.id, depth + 1) : ""}
    `;
  }

  function diagramTreePreviewHtml(document) {
    if (!document) {
      return `<div class="diagram-empty">
        <span class="diagram-empty-icon" aria-hidden="true">&#128208;</span>
        <h2>Create a diagram</h2>
        <p>New Diagram creates a private backing Document immediately, then opens the editor here.</p>
      </div>`;
    }

    const image = diagramImage(document);
    return `
      <div class="diagram-readonly-viewer diagram-tree-preview-image" data-diagram-readonly-viewer data-id="${document.id}">
        <div class="diagram-preview diagram-readonly-viewport" data-diagram-viewport tabindex="0" aria-label="Read-only Diagram canvas. Drag to pan; use Control plus mouse wheel to zoom.">
          <div class="diagram-readonly-stage" data-diagram-stage>
            ${diagramReadonlyImageHtml(image?.source || blankDiagramSource, document.title)}
          </div>
        </div>
      </div>
    `;
  }

  function diagramTreeContextMenuHtml() {
    return `
      <div class="dropdown-menu documentation-tree-context-menu diagram-tree-context-menu" data-diagram-tree-context-menu role="menu" aria-label="Diagram actions" hidden>
        ${diagramTreeContextMenuItemHtml("edit-diagram-info", "Edit Info", "&#9432;", "data-diagram-context-requires-update")}
        ${diagramTreeContextMenuItemHtml("edit-diagram", "Edit Diagram", "&#9998;", "data-diagram-context-requires-update")}
        ${diagramTreeContextMenuItemHtml("duplicate-diagram", "Duplicate", "&#128203;", "data-diagram-context-requires-create")}
        ${diagramTreeContextMenuItemHtml("download-diagram", "Download", diagramDownloadIconHtml())}
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
      const mode = button?.dataset?.mode || "tree";
      diagramViewMode = diagramViewModes.has(mode) ? mode : "tree";
      if (diagramViewMode === "tree") {
        diagramTreePaneHidden = false;
        previewDiagramDocumentId = 0;
        writePreference(preferenceKeys.diagramTreePaneHidden, false);
      }
      writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
      renderDiagram();
      return true;
    }
    if (action === "select-diagram-card" || action === "select-diagram-document") {
      if (editingDocumentId) return true;
      selectedDiagramDocumentId = id;
      previewDiagramDocumentId = 0;
      sharedDiagramDocumentId = 0;
      diagramViewMode = "tree";
      writePreference(preferenceKeys.diagramViewMode, diagramViewMode);
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
      if (document) downloadDiagram(document);
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
      if (selectedDiagramDocumentId === document.id) selectedDiagramDocumentId = 0;
      await deleteItem?.(`/api/blogs/${document.id}`, "Delete this Diagram?");
      return true;
    }
    return false;
  }

  function downloadDiagram(document) {
    const source = diagramImage(document)?.source || "";
    if (!source) {
      notify?.("The Diagram file could not be found.");
      return;
    }

    const link = globalThis.document.createElement("a");
    link.href = appUrl(source);
    link.download = `${safeFileName(document.title)}.${diagramDownloadExtension(source)}`;
    globalThis.document.body.appendChild(link);
    link.click();
    link.remove();
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
      .map(sprint => ({ value: sprint.id, text: `${sprint.code} - ${sprint.title}` }));
    body.innerHTML = `
      <div class="tasks-filter-panel documentation-filter-fields">
        <div class="task-filter-row documentation-filter-row">
          <label>
            <span>Search</span>
            <input data-filter="diagram-search" type="search" value="${escapeAttr(diagramSearch)}">
          </label>
          ${filterSelect("Project", "diagram-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), diagramProjectId || "", "All Projects")}
          ${filterSelect("Sprint", "diagram-sprint", sprintItems, diagramSprintId === "all" ? "" : diagramSprintId, "All Sprints")}
          ${filterSelect("Visibility", "diagram-visibility", [
            { value: "private", text: "Private" },
            { value: "public", text: "Public" }
          ], diagramVisibility === "both" ? "" : diagramVisibility, "Public and Private")}
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
    diagramSort = "latest";
    diagramCreatorFilters = [];
    diagramLastEditorFilters = [];
    writePreference(preferenceKeys.diagramSearch, diagramSearch);
    writePreference(preferenceKeys.diagramProject, diagramProjectId);
    writePreference(preferenceKeys.diagramSprint, diagramSprintId);
    writePreference(preferenceKeys.diagramVisibility, diagramVisibility);
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
        embedded: !editingFullScreen,
        initiallyMaximized: editingFullScreen,
        initialZoom: options.initialTemplateName ? 1 : null,
        initialTemplateName: options.initialTemplateName || "",
        host,
        signal: editorAbortController.signal,
        askForColor,
        askForText,
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
    if (readonlyState) {
      const layoutResult = resolveAnnotationEntityOverlaps(readonlyState);
      if (layoutResult.movedCount) {
        const markup = buildAnnotationSvg(readonlyState, { interactiveEntityHeaders: true });
        const next = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
        ["width", "height", "viewBox", "role", "aria-label", "data-pmt-image-annotation-version"]
          .forEach(name => image.setAttribute(name, next.getAttribute(name) || ""));
        image.replaceChildren(...[...next.childNodes].map(node => document.importNode(node, true)));
      }
    }

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
      suppressZoomScroll = true;
      viewport.scrollLeft = Math.max(
        0,
        stage.offsetLeft + metrics.offsetX + gesture.targetContentScrollLeft
      );
      viewport.scrollTop = Math.max(
        0,
        stage.offsetTop + metrics.offsetY + gesture.targetContentScrollTop
      );
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
        zoomGesture = {
          viewportSize: size,
          stageOffsetLeft: stage.offsetLeft,
          stageOffsetTop: stage.offsetTop,
          paddingRight: Number.parseFloat(viewportStyle.paddingRight) || 0,
          paddingBottom: Number.parseFloat(viewportStyle.paddingBottom) || 0,
          contentScrollLeft: viewport.scrollLeft - stage.offsetLeft - metrics.offsetX,
          contentScrollTop: viewport.scrollTop - stage.offsetTop - metrics.offsetY,
          targetZoom: renderedZoom,
          targetContentScrollLeft: viewport.scrollLeft - stage.offsetLeft - metrics.offsetX,
          targetContentScrollTop: viewport.scrollTop - stage.offsetTop - metrics.offsetY,
          displayZoom: renderedZoom,
          displayContentScrollLeft: viewport.scrollLeft - stage.offsetLeft - metrics.offsetX,
          displayContentScrollTop: viewport.scrollTop - stage.offsetTop - metrics.offsetY,
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
      const size = viewportSize();
      const availableWidth = Math.max(1, size.width - 32);
      const availableHeight = Math.max(1, size.height - 32);
      scheduleZoom(
        Math.min(availableWidth / imageWidth, availableHeight / imageHeight),
        null,
        true,
        settleImmediately
      );
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

      const markup = buildAnnotationSvg(readonlyState, { interactiveEntityHeaders: true });
      const next = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
      ["width", "height", "viewBox", "role", "aria-label", "data-pmt-image-annotation-version"]
        .forEach(name => image.setAttribute(name, next.getAttribute(name) || ""));
      image.replaceChildren(...[...next.childNodes].map(node => document.importNode(node, true)));
      const viewBox = image.viewBox?.baseVal;
      imageWidth = Number.parseFloat(image.getAttribute("width")) || viewBox?.width || imageWidth;
      imageHeight = Number.parseFloat(image.getAttribute("height")) || viewBox?.height || imageHeight;
      drawStage(renderedZoom, stageMetrics(renderedZoom));

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

    viewport.addEventListener("click", event => {
      const control = event.target.closest?.("[data-annotation-entity-header-action]");
      if (!control) return;
      event.preventDefault();
      event.stopPropagation();
      activateEntityHeaderControl(control);
    });

    app.querySelector("[data-diagram-zoom-out]")?.addEventListener("click", () => scheduleZoom(previewZoom - 0.05));
    app.querySelector("[data-diagram-zoom-in]")?.addEventListener("click", () => scheduleZoom(previewZoom + 0.05));
    app.querySelector("[data-diagram-fit]")?.addEventListener("click", () => fit());
    zoomSelect.addEventListener("change", () => scheduleZoom(Number(zoomSelect.value || 100) / 100));
    viewport.addEventListener("wheel", event => {
      if (!event.ctrlKey) {
        settleZoomAtCurrentDisplay();
        return;
      }
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
      const control = event.target.closest?.("[data-annotation-entity-header-action]");
      if (control && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        activateEntityHeaderControl(control);
        return;
      }
      if (event.key === "+" || event.key === "=") scheduleZoom(previewZoom + 0.05);
      if (event.key === "-") scheduleZoom(previewZoom - 0.05);
      if (event.key === "0") fit();
    });

    viewport.addEventListener("pointerdown", event => {
      if (event.target.closest?.("[data-annotation-entity-header-action]")) return;
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
    diagramTreeContextMenuController?.abort();
    diagramTreeContextMenuController = null;
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
        previewDiagramDocumentId = 0;
        diagramViewMode = "tree";
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
  if (diagramSprintId !== "all" && Number(document.sprintId || 0) !== Number(diagramSprintId || 0)) return false;
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

  return buildAnnotationSvg(state, { interactiveEntityHeaders: true })
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

function diagramDownloadIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11M8 10l4 4 4-4M5 17v3h14v-3"></path>
    </svg>
  `;
}

function diagramDownloadExtension(sourceInput) {
  const source = String(sourceInput || "").toLowerCase();
  const dataType = source.match(/^data:image\/(svg\+xml|png|jpeg|webp|gif)/)?.[1];
  if (dataType) return dataType === "svg+xml" ? "svg" : dataType === "jpeg" ? "jpg" : dataType;

  const fileType = source.split(/[?#]/, 1)[0].match(/\.(svg|png|jpe?g|webp|gif)$/)?.[1];
  return fileType === "jpeg" ? "jpg" : fileType || "svg";
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
