import { attachmentsHtml, bindAttachmentDeletion } from "../../components/attachments.js?v=20260714-attachment-delete";
import { buttonContent, funnelIconHtml, iconButton, pageActionsMenuHtml } from "../../components/buttons.js?v=20260717-multi-screen-header";
import { hideEmptyReadOnlyFields, initializeWindowedDialog } from "../../components/dialogs.js?v=20260714-attachment-delete";
import { filterSelect } from "../../components/filters.js";
import { createIdleFilterHeader } from "../../components/idle-filter-header.js?v=20260717-multi-screen-search-persistent";
import {
  documentationExportIconHtml,
  openDocumentationExportDialog
} from "./documentation-export.js?v=20260715-save-collision";
import {
  field,
  optionalNumberValue,
  richTextField,
  richTextToolsHtml,
  richValue,
  selectOptionsField,
  value
} from "../../components/forms.js?v=20260719-rte-insert-diagram";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-19-day-32-45ea96feea4d";
import {
  preferenceKeys,
  readBooleanPreference,
  readNumberPreference,
  readPreference,
  writePreference
} from "../../core/preferences.js?v=20260717-multi-screen-header";
import {
  currentUserId
} from "../../core/authentication.js?v=20260715-admin-impersonation";
import { state } from "../../core/store.js";
import {
  documentationWasEdited,
  formatDate
} from "../../shared/dates.js";
import { canAccessResource } from "../../shared/security.js?v=20260715-admin-impersonation";
import {
  projectById,
  projectCode,
  sprintById,
  sprintName,
  userById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml,
  normalizeLinksInElement,
  normalizeRichHtml
} from "../../shared/text-and-links.js";
import { externalizeImportedHtmlImagesInPayload } from "../../shared/imported-html-images.js";

const documentationViewModes = new Set(["cards", "tree"]);
const documentationTreeGroups = new Set(["all", "project", "project-sprint"]);
const documentationTreeLayouts = new Set(["hierarchy", "flat"]);
const documentationTreeSorts = new Set(["latest", "oldest", "name", "custom"]);
const documentationVisibilityModes = new Set(["both", "private", "public"]);
const documentationImportMetadataTitle = "PMT Import Process Meta Data";
const documentationImportSchema = "pmt.documentation.export.v1";
const documentationInvalidImportMessage = "The file cannot be imported because it is not a valid PMT export file.";
const documentationImportFileExtensions = new Set(["html", "doc"]);
const newDocumentationInlineBlogId = -1;
let documentationProjectId = 0;
let documentationSprintId = "all";
let documentationEntryProjectId = 0;
let documentationEntrySprintId = 0;
let documentationVisibilityFilter = "both";
let documentationViewMode = "cards";
let documentationTreeGroup = "all";
let documentationTreeLayout = "hierarchy";
let documentationTreeSort = "latest";
let documentationTreeSearch = "";
let documentationTreePaneWidth = 320;
let documentationTreePaneHidden = false;
let selectedTreeBlogId = 0;
let editingTreeBlogId = 0;
let documentationFullScreenEditing = false;
const collapsedTreeKeys = new Set();
const expandedDocumentationCardIds = new Set();
let documentationDefaultFiltersApplied = false;
let documentationEditMode = false;
let documentationBulkDeleteBusy = false;
const selectedDocumentationDeleteIds = new Set();

export function createDocumentationFeature({
  app,
  attachFile,
  bindAttachmentPreview,
  bindRichTextButtons,
  deleteAttachment,
  deleteItem,
  deleteItems,
  loadState,
  openEditor,
  saveJson,
  showToast
}) {
  documentationProjectId = readNumberPreference(preferenceKeys.documentationProject, 0);
  documentationSprintId = readPreference(preferenceKeys.documentationSprint, "all");
  documentationEntryProjectId = readNumberPreference(preferenceKeys.documentationEntryProject, 0);
  documentationEntrySprintId = readNumberPreference(preferenceKeys.documentationEntrySprint, 0);
  documentationVisibilityFilter = readKnownPreference(preferenceKeys.documentationVisibility, "both", documentationVisibilityModes);
  documentationViewMode = readKnownPreference(preferenceKeys.documentationViewMode, "cards", documentationViewModes);
  documentationTreeGroup = readKnownPreference(preferenceKeys.documentationTreeGroup, "all", documentationTreeGroups);
  documentationTreeLayout = readKnownPreference(preferenceKeys.documentationTreeLayout, "hierarchy", documentationTreeLayouts);
  documentationTreeSort = readKnownPreference(preferenceKeys.documentationTreeSort, "latest", documentationTreeSorts);
  documentationTreeSearch = readPreference(preferenceKeys.documentationTreeSearch, "");
  documentationTreePaneWidth = Math.min(560, Math.max(220, readNumberPreference(preferenceKeys.documentationTreePaneWidth, 320)));
  documentationTreePaneHidden = readBooleanPreference(preferenceKeys.documentationTreePaneHidden, false);
  let documentationTreeContextMenuController = null;
  const documentationHeader = createIdleFilterHeader({
    app,
    screenSelector: ".documentation-screen",
    searchFilter: "documentation-tree-search",
    onSearchInput(value, { commit, render }) {
      documentationTreeSearch = value;
      if (commit) writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
      if (render) renderDocumentation();
      return true;
    }
  });

  function renderDocumentation() {
    if (documentationProjectId && !projectById(documentationProjectId)) documentationProjectId = 0;
    normalizeDocumentationSprintFilter();
    normalizeDocumentationVisibilityFilter();
    if (!documentationDefaultFiltersApplied) applyDocumentationDefaultFilters();

    const visibleBlogs = documentationViewMode === "tree"
      ? documentationTreeBlogs()
      : documentationCardBlogs();
    pruneDocumentationDeleteSelection(visibleBlogs);

    app.innerHTML = `<div class="documentation-screen idle-filter-header-screen ${documentationViewMode === "tree" ? "is-tree-view" : "is-card-view"} ${documentationFullScreenEditing ? "is-full-screen-editor" : ""}">
      ${sectionHead("Documentation", documentationHeaderActionsHtml())}
      ${documentationViewMode === "tree" ? documentationTreeViewHtml(visibleBlogs) : documentationCardViewHtml(visibleBlogs)}
    </div>`;

    documentationHeader.bind();
    bindDocumentationDeleteSelection();
    if (documentationViewMode === "tree") {
      bindDocumentationTreeSplitter();
      bindDocumentationTreeDragAndDrop();
      bindDocumentationTreeContextMenu();
      bindDocumentationInlineEditor();
      bindDocumentationBodyImageOpen(app);
    } else {
      documentationTreeContextMenuController?.abort();
      documentationTreeContextMenuController = null;
      bindDocumentationCardOverflowControls();
    }
  }

  function documentationHeaderActionsHtml() {
    return `
      ${documentationHeader.controlsHtml([
        {
          key: "project",
          filter: "documentation-project",
          label: "Project",
          optionsHtml: documentationProjectOptionsHtml(),
          summary: documentationProjectSummary().label,
          summaryTitle: documentationProjectSummary().title
        },
        {
          key: "sprint",
          filter: "documentation-sprint",
          label: "Sprint",
          optionsHtml: documentationSprintOptionsHtml(),
          summary: documentationSprintSummary().label,
          summaryTitle: documentationSprintSummary().title
        }
      ])}
      ${documentationHeader.searchHtml(documentationTreeSearch, "Search Documentation")}
      <button class="primary text-icon-button" type="button" data-action="new-blog" data-idle-filter-header-add-target title="New Document" aria-label="New Document">
        ${buttonContent("&#10010;", "New Document")}
      </button>
      <div class="documentation-view-toggle" aria-label="Documentation view">
        <button class="secondary text-icon-button documentation-view-toggle-button ${documentationViewMode === "cards" ? "is-on" : ""}" type="button" data-action="set-documentation-view" data-mode="cards" aria-pressed="${documentationViewMode === "cards"}" title="Cards" aria-label="Cards">
          ${buttonContent("&#9638;", "Cards")}
        </button>
        <button class="secondary text-icon-button documentation-view-toggle-button ${documentationViewMode === "tree" ? "is-on" : ""}" type="button" data-action="set-documentation-view" data-mode="tree" aria-pressed="${documentationViewMode === "tree"}" title="Treeview" aria-label="Treeview">
          ${buttonContent("&#9776;", "Treeview")}
        </button>
      </div>
      <button class="secondary text-icon-button" type="button" data-action="open-documentation-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">
        ${buttonContent(funnelIconHtml(), "Filters")}
      </button>
      ${pageActionsMenuHtml([
        {
          action: "toggle-documentation-edit-mode",
          icon: "&#9998;",
          label: "Edit Mode",
          title: documentationEditMode ? "Finish Edit Mode" : "Edit Mode",
          checked: documentationEditMode,
          disabled: !canAccessResource("Documentation", "Delete")
        },
        {
          action: "import-documentation",
          icon: documentationImportIconHtml(),
          label: "Import",
          title: "Import",
          separatorBefore: true
        },
        ...(documentationViewMode === "tree"
          ? [{
              action: "toggle-documentation-tree-pane",
              icon: "&#9776;",
              label: "Left Nav",
              title: "Left Nav",
              checked: !documentationTreePaneHidden,
              separatorBefore: true
            }]
          : [])
      ])}
    `;
  }

  function documentationProjectOptionsHtml() {
    return `
      <option value="0" ${!documentationProjectId ? "selected" : ""}>All Projects</option>
      ${state.projects.map(project => `<option value="${project.id}" ${project.id === documentationProjectId ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
    `;
  }

  function documentationSprintOptionsHtml() {
    return documentationSprintFilterOptions()
      .map(option => `<option value="${escapeAttr(option.value)}" ${String(option.value) === documentationSprintId ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
      .join("");
  }

  function documentationProjectSummary() {
    const project = projectById(documentationProjectId);
    return project
      ? { label: `${project.code} - ${project.title}`, title: `${project.code} - ${project.title}` }
      : { label: "All Projects", title: "All Projects" };
  }

  function documentationSprintSummary() {
    if (documentationSprintId === "all") return { label: "All Sprints", title: "All Sprints" };
    if (documentationSprintId === "none") return { label: "No Sprint", title: "No Sprint" };

    const sprint = sprintById(Number(documentationSprintId));
    if (!sprint) return { label: "All Sprints", title: "All Sprints" };
    const project = projectById(sprint.projectId);
    const title = `${sprint.code} - ${sprint.title}`;
    return {
      label: sprint.title,
      title: documentationProjectId ? title : `${project?.code || "Project"} - ${title}`
    };
  }

  function normalizeDocumentationSprintFilter() {
    const allowedValues = new Set(documentationSprintFilterOptions().map(option => String(option.value)));
    if (allowedValues.has(documentationSprintId)) return;

    documentationSprintId = "all";
    writePreference(preferenceKeys.documentationSprint, documentationSprintId);
  }

  function documentationCardViewHtml(filteredBlogs) {
    if (!filteredBlogs.length) return `<div class="empty">No documents match the selected filters.</div>`;

    if (documentationTreeGroup === "all") {
      return `<div class="grid documentation-grid">${filteredBlogs.map(documentationCardHtml).join("")}</div>`;
    }

    return `<div class="documentation-card-sections">${documentationCardSectionsHtml(filteredBlogs)}</div>`;
  }

  function documentationTreeViewHtml(visibleBlogs = documentationTreeBlogs()) {
    const visibleIds = new Set(visibleBlogs.map(blog => blog.id));
    const isCreatingTreeBlog = editingTreeBlogId === newDocumentationInlineBlogId;
    if (!isCreatingTreeBlog && !visibleIds.has(selectedTreeBlogId)) selectedTreeBlogId = visibleBlogs[0]?.id || 0;
    if (!isCreatingTreeBlog && !visibleIds.has(editingTreeBlogId)) {
      editingTreeBlogId = 0;
      documentationFullScreenEditing = false;
    }
    const selectedBlog = isCreatingTreeBlog
      ? documentationNewInlineDraft()
      : state.blogs.find(blog => blog.id === selectedTreeBlogId && visibleIds.has(blog.id));
    collapsedTreeKeysForRender = collapsedTreeKeys;
    selectedTreeBlogIdForRender = selectedTreeBlogId;

    const hideTreePane = documentationTreePaneHidden || documentationFullScreenEditing;
    return `
      <div class="documentation-tree-layout ${hideTreePane ? "is-tree-hidden" : ""}" style="--documentation-tree-pane-width:${documentationTreePaneWidth}px">
        <aside class="panel documentation-tree-pane" ${hideTreePane ? "hidden" : ""}>
          <div class="documentation-tree" role="tree" aria-label="Documentation tree">
            ${documentationTreeNavHtml(visibleBlogs)}
          </div>
        </aside>
        <div class="documentation-tree-splitter" data-documentation-tree-splitter ${hideTreePane ? "hidden" : ""} role="separator" aria-orientation="vertical" aria-label="Resize tree navigation"></div>
        <section class="panel documentation-tree-preview">
          ${documentationTreePreviewHtml(selectedBlog)}
        </section>
        ${documentationTreeContextMenuHtml()}
      </div>
    `;
  }

  function bindDocumentationDeleteSelection() {
    app.querySelectorAll("[data-documentation-delete-select]").forEach(input => {
      input.closest("label")?.addEventListener("click", event => event.stopPropagation());
      input.addEventListener("click", event => event.stopPropagation());
      input.addEventListener("change", () => {
        if (documentationBulkDeleteBusy) return;
        const id = Number(input.dataset.id || 0);
        if (!id) return;

        if (input.checked) {
          selectedDocumentationDeleteIds.add(id);
        } else {
          selectedDocumentationDeleteIds.delete(id);
        }
        syncDocumentationDeleteSelectionControls();
      });
    });

    syncDocumentationDeleteSelectionControls();
  }

  function syncDocumentationDeleteSelectionControls() {
    const selectedCount = selectedDocumentationDeleteIds.size;
    const selectedTitle = documentationSelectedDeleteTitle(selectedCount);

    app.querySelectorAll("[data-documentation-delete-select]").forEach(input => {
      const id = Number(input.dataset.id || 0);
      const blog = documentationBlogForCurrentUser(id);
      input.checked = selectedDocumentationDeleteIds.has(id);
      input.disabled = documentationBulkDeleteBusy || !documentationCanDelete(blog);
    });

    app.querySelectorAll("[data-action='delete-blog']").forEach(button => {
      const id = Number(button.dataset.id || 0);
      const blog = documentationBlogForCurrentUser(id);
      const title = selectedDocumentationDeleteIds.has(id) ? selectedTitle : "Delete";
      button.disabled = documentationBulkDeleteBusy || !documentationCanDelete(blog);
      button.title = title;
      button.setAttribute("aria-label", title);
    });
  }

  function pruneDocumentationDeleteSelection(visibleBlogs) {
    if (!documentationEditMode) {
      selectedDocumentationDeleteIds.clear();
      return;
    }

    const visibleIds = new Set(
      visibleBlogs
        .filter(documentationCanDelete)
        .map(blog => blog.id)
    );
    [...selectedDocumentationDeleteIds].forEach(id => {
      if (!visibleIds.has(id)) selectedDocumentationDeleteIds.delete(id);
    });
  }

  function documentationSelectedDeleteTitle(count = selectedDocumentationDeleteIds.size) {
    return count === 1
      ? "Delete selected Document"
      : `Delete ${count} selected Documents`;
  }

  async function deleteSelectedDocumentation() {
    const blogs = [...selectedDocumentationDeleteIds]
      .map(documentationBlogForCurrentUser)
      .filter(documentationCanDelete);
    if (!blogs.length) return;

    const count = blogs.length;
    documentationBulkDeleteBusy = true;
    syncDocumentationDeleteSelectionControls();
    try {
      await deleteItems(
        blogs.map(blog => `/api/blogs/${blog.id}`),
        `${documentationSelectedDeleteTitle(count)}?`,
        `${count} Document${count === 1 ? "" : "s"} deleted.`
      );
    } finally {
      documentationBulkDeleteBusy = false;
      syncDocumentationDeleteSelectionControls();
    }
  }

  async function handleAction(action, id, button) {
    if (action === "toggle-documentation-edit-mode") {
      documentationEditMode = !documentationEditMode;
      selectedDocumentationDeleteIds.clear();
      renderDocumentation();
      return true;
    }
    if (action === "set-documentation-view") {
      const mode = button?.dataset?.mode || "cards";
      documentationViewMode = documentationViewModes.has(mode) ? mode : "cards";
      if (documentationViewMode === "tree") {
        documentationTreePaneHidden = false;
        writePreference(preferenceKeys.documentationTreePaneHidden, documentationTreePaneHidden);
      }
      writePreference(preferenceKeys.documentationViewMode, documentationViewMode);
      renderDocumentation();
      return true;
    }
    if (action === "open-documentation-filters") {
      openDocumentationFiltersDialog();
      return true;
    }
    if (action === "toggle-documentation-tree-folder" || action === "toggle-documentation-tree-node") {
      toggleTreeKey(button?.dataset?.treeKey || "");
      renderDocumentation();
      return true;
    }
    if (action === "toggle-documentation-tree-pane") {
      documentationTreePaneHidden = !documentationTreePaneHidden;
      writePreference(preferenceKeys.documentationTreePaneHidden, documentationTreePaneHidden);
      renderDocumentation();
      return true;
    }
    if (action === "toggle-documentation-card-expanded") {
      if (expandedDocumentationCardIds.has(id)) {
        expandedDocumentationCardIds.delete(id);
      } else {
        expandedDocumentationCardIds.add(id);
      }
      syncDocumentationCardOverflowState(button?.closest?.(".documentation-card") || app.querySelector(`.documentation-card[data-id="${id}"]`));
      return true;
    }
    if (action === "toggle-documentation-card-code") {
      requestAnimationFrame(bindDocumentationCardOverflowControls);
      return true;
    }
    if (action === "select-documentation-tree-blog") {
      if (editingTreeBlogId && editingTreeBlogId !== id) {
        await handleDocumentationTreeSelectionWhileEditing(id);
        return true;
      }

      return selectDocumentationTreeBlog(id);
    }
    if (action === "new-blog") {
      startDocumentationInlineNew();
      return true;
    }
    if (action === "import-documentation") {
      openDocumentationImportFilePicker();
      return true;
    }
    if (action === "view-blog") {
      if (documentationViewMode === "tree") {
        openDocumentationFullScreen(id);
        return true;
      }

      viewDocumentation(documentationBlogForCurrentUser(id));
      return true;
    }
    if (action === "export-blog") {
      const blog = documentationBlogForCurrentUser(id);
      if (blog) openDocumentationExportDialog(blog, { showToast });
      return true;
    }
    if (action === "edit-blog") {
      startDocumentationInlineEdit(id);
      return true;
    }
    if (action === "edit-documentation-info") {
      const blog = documentationBlogForCurrentUser(id);
      if (blog) editBlog(blog);
      return true;
    }
    if (action === "edit-documentation-full-screen") {
      startDocumentationInlineEdit(id);
      return true;
    }
    if (action === "cancel-documentation-inline-edit") {
      editingTreeBlogId = 0;
      documentationFullScreenEditing = false;
      renderDocumentation();
      return true;
    }
    if (action === "save-documentation-inline-edit") {
      const form = app.querySelector("[data-documentation-inline-editor]");
      if (form) form.requestSubmit();
      return true;
    }
    if (action === "delete-blog") {
      if (!documentationBlogForCurrentUser(id)) return true;
      if (selectedDocumentationDeleteIds.has(id)) {
        await deleteSelectedDocumentation();
        return true;
      }
      if (selectedTreeBlogId === id) selectedTreeBlogId = 0;
      if (editingTreeBlogId === id) {
        editingTreeBlogId = 0;
        documentationFullScreenEditing = false;
      }
      await deleteItem(`/api/blogs/${id}`, "Delete this document?");
      return true;
    }

    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    const filter = target?.dataset?.filter || "";

    if (filter === "documentation-project") {
      documentationProjectId = Number(target.value || 0);
      documentationSprintId = "all";
      writePreference(preferenceKeys.documentationProject, documentationProjectId);
      writePreference(preferenceKeys.documentationSprint, documentationSprintId);
      renderDocumentation();
      return true;
    }

    if (filter === "documentation-sprint") {
      documentationSprintId = target.value || "all";
      writePreference(preferenceKeys.documentationSprint, documentationSprintId);
      renderDocumentation();
      return true;
    }

    if (filter === "documentation-visibility") {
      documentationVisibilityFilter = documentationVisibilityValue(target.value);
      writePreference(preferenceKeys.documentationVisibility, documentationVisibilityFilter);
      renderDocumentation();
      return true;
    }

    if (filter === "documentation-tree-search") {
      documentationTreeSearch = target.value || "";
      writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
      renderDocumentation();
      return true;
    }

    if (filter === "documentation-tree-group") {
      documentationTreeGroup = documentationTreeGroups.has(target.value) ? target.value : "all";
      writePreference(preferenceKeys.documentationTreeGroup, documentationTreeGroup);
      renderDocumentation();
      return true;
    }

    if (filter === "documentation-tree-layout") {
      documentationTreeLayout = documentationTreeLayouts.has(target.value) ? target.value : "hierarchy";
      writePreference(preferenceKeys.documentationTreeLayout, documentationTreeLayout);
      renderDocumentation();
      return true;
    }

    if (filter === "documentation-tree-sort") {
      documentationTreeSort = documentationTreeSorts.has(target.value) ? target.value : "latest";
      writePreference(preferenceKeys.documentationTreeSort, documentationTreeSort);
      renderDocumentation();
      return true;
    }

    return false;
  }

  function openDocumentationFiltersDialog() {
    const existingDialog = document.querySelector("[data-documentation-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='documentation-tree-search'], [data-filter='documentation-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog documentation-filter-dialog";
    modal.dataset.documentationFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Documentation Filters</h2>
          <div class="dialog-head-actions">
            <button type="button" class="icon-btn dialog-reset-button" data-reset-documentation-view title="Reset" aria-label="Reset">Reset</button>
            <button type="button" class="icon-btn" data-close-documentation-filters title="Close" aria-label="Close">x</button>
          </div>
        </div>
        <div class="dialog-body task-filter-dialog-body documentation-filter-dialog-body" data-documentation-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-documentation-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderDocumentationFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("input", event => {
      handleFilterChange(event.target);
    });
    modal.addEventListener("change", event => {
      const filter = event.target?.dataset?.filter || "";
      if (!handleFilterChange(event.target)) return;
      if (filter === "documentation-project") {
        renderDocumentationFiltersDialog(modal);
        modal.querySelector("[data-filter='documentation-project']")?.focus({ preventScroll: true });
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-reset-documentation-view]")) {
        applyDocumentationDefaultFilters();
        documentationEditMode = false;
        selectedDocumentationDeleteIds.clear();
        documentationHeader.reset();
        renderDocumentationFiltersDialog(modal);
        renderDocumentation();
        modal.querySelector("[data-filter='documentation-tree-search'], [data-filter='documentation-project']")?.focus({ preventScroll: true });
        return;
      }

      if (event.target.closest("[data-close-documentation-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='documentation-tree-search'], [data-filter='documentation-project']")?.focus({ preventScroll: true });
  }

  function renderDocumentationFiltersDialog(modal) {
    const body = modal.querySelector("[data-documentation-filter-dialog-body]");
    if (body) body.innerHTML = documentationFilterFieldsHtml();
  }

  function documentationFilterFieldsHtml() {
    const projectSelect = filterSelect("Project", "documentation-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), documentationProjectId || "", "All Projects");
    const sprintSelect = documentationTreeSelect("Sprint", "documentation-sprint", documentationSprintFilterOptions(), documentationSprintId);
    const visibilitySelect = documentationTreeSelect("Visibility", "documentation-visibility", documentationVisibilityOptions(), documentationVisibilityFilter);
    const groupSelect = documentationTreeSelect("Group", "documentation-tree-group", [
      { value: "all", text: "All Documents" },
      { value: "project", text: "Project Only" },
      { value: "project-sprint", text: "Project and Sprint" }
    ], documentationTreeGroup);
    const layoutSelect = documentationTreeSelect("Layout", "documentation-tree-layout", [
      { value: "hierarchy", text: "Hierarchy" },
      { value: "flat", text: "Flat" }
    ], documentationTreeLayout);
    const sortSelect = documentationTreeSelect("Sort", "documentation-tree-sort", [
      { value: "latest", text: "Latest First" },
      { value: "oldest", text: "Oldest First" },
      { value: "name", text: "Name (Alphabetically)" },
      { value: "custom", text: "Custom" }
    ], documentationTreeSort);

    if (documentationViewMode === "tree") {
      return `
        <div class="tasks-filter-panel documentation-filter-fields">
          <div class="task-filter-row documentation-filter-row">
            <label>
              <span>Search</span>
              <input data-filter="documentation-tree-search" type="search" value="${escapeAttr(documentationTreeSearch)}">
            </label>
            ${projectSelect}
            ${sprintSelect}
            ${visibilitySelect}
            ${groupSelect}
            ${layoutSelect}
            ${sortSelect}
          </div>
        </div>
      `;
    }

    return `
      <div class="tasks-filter-panel documentation-filter-fields">
        <div class="task-filter-row documentation-filter-row">
          <label>
            <span>Search</span>
            <input data-filter="documentation-tree-search" type="search" value="${escapeAttr(documentationTreeSearch)}">
          </label>
          ${projectSelect}
          ${sprintSelect}
          ${visibilitySelect}
          ${groupSelect}
          ${sortSelect}
        </div>
      </div>
    `;
  }

  function viewDocumentation(blog) {
    if (!documentationBlogAccessibleToCurrentUser(blog)) return;
    const author = userById(blog.createdByUserId);
    const parent = documentationBlogForCurrentUser(blog.parentBlogId);

    const modal = document.createElement("dialog");
    modal.className = "dialog detail-dialog documentation-readonly-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>${escapeHtml(blog.title)}</h2>
        <button type="button" class="icon-btn" data-close title="Close">x</button>
      </div>
      <div class="dialog-body">
        <div class="detail-grid documentation-readonly-grid">
          ${detailField("Project", escapeHtml(documentationProjectLabel(blog.projectId)), false, "documentation-readonly-meta-field")}
          ${blog.sprintId ? detailField("Sprint", escapeHtml(sprintName(blog.sprintId)), false, "documentation-readonly-meta-field") : ""}
          ${parent ? detailField("Parent", escapeHtml(parent.title), false, "documentation-readonly-meta-field") : ""}
          ${detailField("Created", escapeHtml(formatDate(blog.createdAt)), false, "documentation-readonly-meta-field")}
          ${documentationWasEdited(blog) ? detailField("Last Edited", escapeHtml(formatDate(blog.updatedAt)), false, "documentation-readonly-meta-field") : ""}
          ${detailField("Author", escapeHtml(author?.nickname || "User"), false, "documentation-readonly-meta-field")}
          ${detailField("Body", `<div class="rich-readonly documentation-image-open-area" ${documentationRichPersistAttrs(blog)}>${blog.bodyHtml || ""}</div>`, true)}
          ${blog.attachments.length ? detailField("Attachments", attachmentsHtml(blog.attachments), true) : ""}
        </div>
      </div>
      <div class="dialog-actions documentation-readonly-actions">
        <div class="dialog-action-group is-left documentation-readonly-left-actions">
          <button type="button" class="secondary text-icon-button" data-view-full-screen-readonly-blog="${blog.id}">${buttonContent("&#9974;", "View Full-Screen")}</button>
          <button type="button" class="secondary text-icon-button documentation-dialog-export-button" data-export-readonly-blog="${blog.id}">${buttonContent(documentationExportIconHtml(), "Export")}</button>
        </div>
        <button type="button" class="secondary text-icon-button" data-edit-readonly-blog="${blog.id}" ${canAccessResource("Documentation", "Update") ? "" : "disabled"}>${buttonContent("&#9998;", "Edit")}</button>
        <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
      </div>
    `;

    document.body.appendChild(modal);
    hideEmptyReadOnlyFields(modal);
    initializeWindowedDialog(modal);
    modal.addEventListener("close", () => modal.remove(), { once: true });
    modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => modal.close()));
    modal.addEventListener("click", event => {
      const fullScreenButton = event.target.closest("[data-view-full-screen-readonly-blog]");
      if (fullScreenButton) {
        modal.dataset.preserveContentRoute = "true";
        modal.close();
        openDocumentationFullScreen(Number(fullScreenButton.dataset.viewFullScreenReadonlyBlog || 0));
        return;
      }

      const exportButton = event.target.closest("[data-export-readonly-blog]");
      if (exportButton) {
        openDocumentationExportDialog(blog, { showToast });
        return;
      }

      const editButton = event.target.closest("[data-edit-readonly-blog]");
      if (!editButton) return;

      const selectedBlog = documentationBlogForCurrentUser(editButton.dataset.editReadonlyBlog);
      modal.close();
      if (selectedBlog) startDocumentationInlineEdit(selectedBlog.id);
    });
    modal.showModal();
    normalizeLinksInElement(modal);
    bindDocumentationBodyImageOpen(modal);
  }

  function openDocumentationFullScreen(blogId) {
    const blog = documentationBlogForCurrentUser(blogId);
    if (!blog) return;

    documentationViewMode = "tree";
    showDocumentationTreeFullScreen();

    writePreference(preferenceKeys.documentationViewMode, documentationViewMode);

    selectDocumentationTreeBlog(blog.id, { syncFilters: true });
  }

  function viewDocumentationById(blogId) {
    const blog = documentationBlogForCurrentUser(blogId);
    if (!blog) return false;

    if (documentationViewMode === "tree") {
      return selectDocumentationTreeBlog(blog.id, { syncFilters: true });
    }

    viewDocumentation(blog);
    return true;
  }

  function selectDocumentationTreeBlog(blogId, options = {}) {
    const blog = documentationBlogForCurrentUser(blogId);
    if (!blog) return false;

    if (options.syncFilters) {
      documentationProjectId = blog.projectId || 0;
      documentationSprintId = "all";
      documentationTreeSearch = "";
      writePreference(preferenceKeys.documentationProject, documentationProjectId);
      writePreference(preferenceKeys.documentationSprint, documentationSprintId);
      writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
    }

    selectedTreeBlogId = blog.id;
    editingTreeBlogId = 0;
    documentationFullScreenEditing = false;
    expandDocumentationTreePath(blog);
    renderDocumentation();
    return true;
  }

  function showDocumentationTreeFullScreen() {
    documentationTreePaneHidden = true;
    writePreference(preferenceKeys.documentationTreePaneHidden, documentationTreePaneHidden);
  }

  function startDocumentationInlineNew() {
    documentationViewMode = "tree";
    selectedTreeBlogId = newDocumentationInlineBlogId;
    editingTreeBlogId = newDocumentationInlineBlogId;
    documentationFullScreenEditing = true;
    writePreference(preferenceKeys.documentationViewMode, documentationViewMode);
    renderDocumentation();
    focusDocumentationInlineTitle();
  }

  function startDocumentationInlineEdit(blogId) {
    const blog = documentationBlogForCurrentUser(blogId);
    if (!blog) return;

    documentationViewMode = "tree";
    documentationProjectId = blog.projectId || 0;
    documentationSprintId = "all";
    documentationTreeSearch = "";
    selectedTreeBlogId = blog.id;
    editingTreeBlogId = blog.id;
    documentationFullScreenEditing = true;
    expandDocumentationTreePath(blog);

    writePreference(preferenceKeys.documentationViewMode, documentationViewMode);
    writePreference(preferenceKeys.documentationProject, documentationProjectId);
    writePreference(preferenceKeys.documentationSprint, documentationSprintId);
    writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);

    renderDocumentation();
  }

  function focusDocumentationInlineTitle() {
    requestAnimationFrame(() => {
      const titleInput = app.querySelector("[data-documentation-inline-editor] [name='title']");
      titleInput?.focus({ preventScroll: true });
    });
  }

  function editBlog(blog = {}) {
    if (!blog) return;
    if (blog.id && !documentationBlogAccessibleToCurrentUser(blog)) return;
    const rememberedProjectId = projectById(documentationEntryProjectId)
      ? documentationEntryProjectId
      : 0;
    const selectedProjectId = blog.id ? blog.projectId || "" : rememberedProjectId || "";
    const rememberedSprintId = state.sprints.some(sprint =>
      sprint.id === documentationEntrySprintId
      && sprint.projectId === Number(selectedProjectId || 0)
    )
      ? documentationEntrySprintId
      : 0;
    const selectedSprintId = blog.id ? blog.sprintId || "" : rememberedSprintId || "";

    openEditor(blog.id ? "Edit Document" : "New Document", `
      <div class="form-grid">
        ${blog.id ? `
          <template data-editor-head-action>
            <button class="secondary text-icon-button" type="button" data-documentation-full-screen-edit="${blog.id}" title="View Full-Screen" aria-label="View Full-Screen">
              ${buttonContent("&#9974;", "View Full-Screen")}
            </button>
          </template>
        ` : ""}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "Global" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${selectOptionsField("Sprint", "sprintId", documentationSprintOptions(selectedProjectId), selectedSprintId)}
        ${field("Title", "title", blog.title || "", "text", "", "", "", { required: true })}
        ${selectOptionsField("Parent", "parentBlogId", documentationParentOptions(selectedProjectId, selectedSprintId, blog.id), blog.parentBlogId || "")}
        ${documentationPrivateField(blog)}
        ${richTextField("bodyHtml", "Body", blog.bodyHtml || "", { required: true })}
        <div class="field full">
          <label>Attachments</label>
          ${blog.attachments?.length ? attachmentsHtml(blog.attachments, { deletePathPrefix: `/api/blogs/${blog.id}/attachments` }) : ""}
          <input name="attachments" type="file" multiple>
          <div class="attachment-preview" data-preview="attachments"></div>
        </div>
      </div>
    `, async root => {
      const projectId = optionalNumberValue(root, "projectId");
      const sprintId = projectId ? optionalNumberValue(root, "sprintId") : null;
      const result = await saveJson(blog.id ? `/api/blogs/${blog.id}` : "/api/blogs", blog.id ? "PUT" : "POST", {
        id: blog.id || 0,
        projectId,
        sprintId,
        parentBlogId: optionalNumberValue(root, "parentBlogId"),
        title: value(root, "title"),
        isPrivate: documentationPrivateValue(root),
        isPinned: false,
        bodyHtml: richValue(root, "bodyHtml"),
        expectedRowVersion: blog.id ? blog.rowVersion || null : undefined
      }, {
        saveAsNew: true,
        canCreate: canAccessResource("Documentation", "Create"),
        createPath: "/api/blogs"
      });

      selectedTreeBlogId = result.id;
      documentationEntryProjectId = projectId || 0;
      documentationEntrySprintId = sprintId || 0;
      writePreference(preferenceKeys.documentationEntryProject, documentationEntryProjectId);
      writePreference(preferenceKeys.documentationEntrySprint, documentationEntrySprintId);

      for (const file of root.querySelector("[name='attachments']").files) {
        await attachFile(`/api/blogs/${result.id}/attachments`, file);
      }
    }, blog.id ? "" : "title", root => {
      root.querySelector("[data-rich='bodyHtml']")?.classList.add("documentation-image-open-area");
      bindDocumentationBodyImageOpen(root);
      bindDocumentationEditorRules(root, blog);
      const fullScreenButton = root.closest("dialog")?.querySelector(`[data-documentation-full-screen-edit='${blog.id || 0}']`);
      fullScreenButton?.addEventListener("click", () => {
        root.closest("dialog")?.close();
        startDocumentationInlineEdit(blog.id);
      });
    });
  }

  function bindDocumentationEditorRules(root, blog) {
    const projectSelect = root.querySelector("[name='projectId']");
    const sprintSelect = root.querySelector("[name='sprintId']");
    const parentSelect = root.querySelector("[name='parentBlogId']");
    if (!projectSelect || !sprintSelect || !parentSelect) return;

    const syncParentOptions = () => {
      const projectId = optionalNumberValue(root, "projectId");
      const sprintId = projectId ? optionalNumberValue(root, "sprintId") : null;
      const currentParentId = optionalNumberValue(root, "parentBlogId");
      const options = documentationParentOptions(projectId || "", sprintId || "", blog.id);
      parentSelect.innerHTML = documentationOptionsHtml(options, currentParentId || "");
      if (!options.some(option => String(option.id) === String(currentParentId || ""))) parentSelect.value = "";
    };

    const syncSprintOptions = () => {
      const projectId = optionalNumberValue(root, "projectId");
      const currentSprintId = optionalNumberValue(root, "sprintId");
      const options = documentationSprintOptions(projectId || "");
      sprintSelect.innerHTML = documentationOptionsHtml(options, currentSprintId || "");
      sprintSelect.disabled = !projectId;
      if (!options.some(option => String(option.id) === String(currentSprintId || ""))) sprintSelect.value = "";
      syncParentOptions();
    };

    projectSelect.addEventListener("change", syncSprintOptions);
    sprintSelect.addEventListener("change", syncParentOptions);
    syncSprintOptions();
  }

  function openDocumentationImportFilePicker() {
    let input = document.querySelector("[data-documentation-import-input]");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.accept = ".html,.doc,text/html,application/msword";
      input.hidden = true;
      input.dataset.documentationImportInput = "true";
      input.addEventListener("change", async () => {
        const file = input.files?.[0] || null;
        input.value = "";
        if (file) await importDocumentationFile(file);
      });
      document.body.appendChild(input);
    }

    input.click();
  }

  async function importDocumentationFile(file) {
    if (!isDocumentationImportFile(file)) {
      showToast?.("Only .html and .doc PMT export files can be imported.");
      return;
    }

    try {
      const text = await file.text();
      const importParts = parseDocumentationImportFile(text);
      const payload = documentationImportPayload(importParts.metadata, importParts.document);
      const imageResult = await externalizeImportedHtmlImagesInPayload(payload, ["bodyHtml"]);
      const isReplacement = payload.id > 0;
      const result = await saveJson(
        isReplacement ? `/api/blogs/${payload.id}` : "/api/blogs",
        isReplacement ? "PUT" : "POST",
        payload,
        isReplacement ? {
          saveAsNew: true,
          canCreate: canAccessResource("Documentation", "Create"),
          createPath: "/api/blogs"
        } : undefined
      );
      const savedBlogId = Number(result?.id || payload.id || 0);
      const savedAsNew = result?.__savedAsNew === true;

      selectedTreeBlogId = savedBlogId;
      editingTreeBlogId = 0;
      documentationProjectId = payload.projectId || 0;
      documentationSprintId = "all";
      documentationTreeSearch = "";
      writePreference(preferenceKeys.documentationProject, documentationProjectId);
      writePreference(preferenceKeys.documentationSprint, documentationSprintId);
      writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
      await loadState?.();

      const importedBlog = documentationBlogForCurrentUser(selectedTreeBlogId);
      if (importedBlog) expandDocumentationTreePath(importedBlog);

      renderDocumentation();
      const imageNote = imageResult.failed
        ? ` ${imageResult.failed} embedded image${imageResult.failed === 1 ? "" : "s"} could not be moved to uploads.`
        : "";
      showToast?.(`${isReplacement && !savedAsNew ? "Document imported and replaced." : "Document imported."}${imageNote}`);
    } catch (error) {
      showToast?.(error?.isInvalidPmtImport ? documentationInvalidImportMessage : error.message || "Import failed.");
    }
  }

  function detailField(label, html, full = false, extraClass = "") {
    return `
      <div class="detail-field ${full ? "full" : ""} ${extraClass}">
        <span>${escapeHtml(label)}</span>
        <div>${html || `<span class="muted">None</span>`}</div>
      </div>
    `;
  }

  function toggleTreeKey(key) {
    if (!key) return;
    if (collapsedTreeKeys.has(key)) {
      collapsedTreeKeys.delete(key);
    } else {
      collapsedTreeKeys.add(key);
    }
  }

  function bindDocumentationTreeSplitter() {
    const splitter = app.querySelector("[data-documentation-tree-splitter]");
    if (!splitter) return;

    splitter.addEventListener("pointerdown", event => {
      if (documentationTreePaneHidden) return;

      event.preventDefault();
      const layout = splitter.closest(".documentation-tree-layout");
      const startX = event.clientX;
      const startWidth = documentationTreePaneWidth;

      const resize = moveEvent => {
        const layoutWidth = layout?.getBoundingClientRect().width || window.innerWidth;
        const maxWidth = Math.max(220, Math.min(640, layoutWidth - 360));
        documentationTreePaneWidth = Math.min(maxWidth, Math.max(220, startWidth + moveEvent.clientX - startX));
        layout?.style.setProperty("--documentation-tree-pane-width", `${documentationTreePaneWidth}px`);
      };

      const finish = () => {
        writePreference(preferenceKeys.documentationTreePaneWidth, documentationTreePaneWidth);
        window.removeEventListener("pointermove", resize);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };

      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    });
  }

  function bindDocumentationTreeDragAndDrop() {
    const tree = app.querySelector(".documentation-tree-pane .documentation-tree");
    if (!tree) return;
    let draggedId = 0;

    tree.addEventListener("dragstart", event => {
      const row = event.target.closest("[data-documentation-tree-row][draggable='true']");
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
      const rootDrop = event.target.closest("[data-documentation-root-drop]");
      const row = event.target.closest("[data-documentation-tree-row]");
      clearDocumentationDropCues(tree);
      if (rootDrop) {
        event.preventDefault();
        rootDrop.classList.add("is-drop-target");
        return;
      }
      if (!row || Number(row.dataset.id || 0) === draggedId) return;
      const placement = documentationDropPlacement(row, event.clientY);
      if (!documentationDropAllowed(draggedId, Number(row.dataset.id || 0), placement)) return;
      event.preventDefault();
      row.classList.add(`is-drop-${placement}`);
      event.dataTransfer.dropEffect = "move";
    });

    tree.addEventListener("drop", async event => {
      if (!draggedId) return;
      event.preventDefault();
      const movedId = draggedId;
      const rootDrop = event.target.closest("[data-documentation-root-drop]");
      const row = event.target.closest("[data-documentation-tree-row]");
      const targetId = Number(row?.dataset.id || 0);
      const placement = rootDrop ? "root" : documentationDropPlacement(row, event.clientY);
      clearDocumentationDropCues(tree);

      const move = documentationMoveAfterDrop(movedId, targetId, placement);
      if (!move) return;
      try {
        await saveJson(`/api/blogs/${move.blog.id}/move`, "PUT", {
          parentBlogId: move.parentBlogId || null,
          orderedBlogIds: move.orderedBlogIds
        });
        await loadState();
        documentationTreeSort = "custom";
        writePreference(preferenceKeys.documentationTreeSort, documentationTreeSort);
        selectedTreeBlogId = movedId;
        showToast("Document moved.");
        renderDocumentation();
      } catch (error) {
        showToast(error?.message || "The Document could not be moved.");
        renderDocumentation();
      }
    });

    const finish = () => {
      tree.querySelector(".is-dragging")?.classList.remove("is-dragging");
      clearDocumentationDropCues(tree);
      draggedId = 0;
    };
    tree.addEventListener("dragend", finish);
    tree.addEventListener("dragleave", event => {
      if (!tree.contains(event.relatedTarget)) clearDocumentationDropCues(tree);
    });
  }

  function documentationMoveAfterDrop(movedId, targetId, placement) {
    const blogs = state.blogs.filter(documentationOwnedByCurrentUser);
    const blog = blogs.find(item => item.id === movedId);
    const target = blogs.find(item => item.id === targetId);
    if (!documentationCanMove(blog)) return null;
    if (placement !== "root" && (!target || !documentationDropAllowed(movedId, targetId, placement))) return null;

    const parentBlogId = placement === "root"
      ? null
      : placement === "inside"
        ? target.id
        : target.parentBlogId || null;
    const siblings = blogs
      .filter(item =>
        item.id !== movedId
        && Number(item.parentBlogId || 0) === Number(parentBlogId || 0)
        && (!parentBlogId || (
          Number(item.projectId || 0) === Number(blog.projectId || 0)
          && Number(item.sprintId || 0) === Number(blog.sprintId || 0)
        ))
      )
      .sort(documentationBlogCompare);
    let insertIndex = 0;
    if (placement !== "inside" && placement !== "root") {
      const targetIndex = siblings.findIndex(item => item.id === targetId);
      insertIndex = Math.max(0, targetIndex + (placement === "after" ? 1 : 0));
    }
    siblings.splice(insertIndex, 0, blog);

    return {
      blog,
      parentBlogId,
      orderedBlogIds: siblings.map(item => item.id)
    };
  }

  function documentationDropAllowed(movedId, targetId, placement) {
    if (!movedId || !targetId || movedId === targetId) return false;
    const moved = state.blogs.find(blog => blog.id === movedId);
    const target = state.blogs.find(blog => blog.id === targetId);
    if (!documentationCanMove(moved) || !documentationCanMove(target)) return false;
    const targetParentId = placement === "inside" ? target.id : target.parentBlogId || null;
    if (targetParentId
        && (Number(moved.projectId || 0) !== Number(target.projectId || 0)
          || Number(moved.sprintId || 0) !== Number(target.sprintId || 0))) return false;
    return !documentationDescendantIds(movedId).has(targetId);
  }

  function bindDocumentationTreeContextMenu() {
    documentationTreeContextMenuController?.abort();
    documentationTreeContextMenuController = null;

    const tree = app.querySelector(".documentation-tree");
    const menu = app.querySelector("[data-documentation-tree-context-menu]");
    if (!tree || !menu) return;

    const controller = new AbortController();
    const { signal } = controller;
    documentationTreeContextMenuController = controller;

    const closeMenu = () => {
      menu.hidden = true;
    };

    const showMenu = (blog, clientX, clientY) => {
      if (selectedTreeBlogId !== blog.id) {
        selectedTreeBlogId = blog.id;
        editingTreeBlogId = 0;
        documentationFullScreenEditing = false;
        expandDocumentationTreePath(blog);
        renderDocumentation();
      }

      const activeMenu = app.querySelector("[data-documentation-tree-context-menu]");
      if (!activeMenu) return;

      activeMenu.querySelectorAll("[data-action]").forEach(button => {
        button.dataset.id = String(blog.id);
      });
      activeMenu.querySelectorAll("[data-documentation-context-requires-update]").forEach(button => {
        button.disabled = !canAccessResource("Documentation", "Update");
      });
      activeMenu.querySelectorAll("[data-documentation-context-requires-delete]").forEach(button => {
        button.disabled = !documentationCanDelete(blog);
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
      const documentButton = event.target.closest?.("[data-action='select-documentation-tree-blog']");
      const blog = documentationBlogForCurrentUser(documentButton?.dataset.id);
      if (!documentButton || !blog) return;

      event.preventDefault();
      event.stopPropagation();
      showMenu(blog, event.clientX, event.clientY);
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

  function bindDocumentationInlineEditor() {
    const form = app.querySelector("[data-documentation-inline-editor]");
    if (!form) return;

    const blog = documentationInlineEditorBlog(form);
    if (!blog) return;

    bindRichTextButtons?.(form);
    bindAttachmentPreview?.(form);
    bindAttachmentDeletion(form, deleteAttachment);
    bindDocumentationEditorRules(form, blog);
    bindDocumentationBodyImageOpen(form);
    bindDocumentationInlineRichActions(form);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      await saveDocumentationInlineEditor(form);
    });
  }

  function bindDocumentationInlineRichActions(form) {
    const originalActions = form.querySelector(".documentation-inline-editor-head .documentation-tree-preview-actions");
    const preview = form.closest(".documentation-tree-preview");
    if (!originalActions || !preview) return;

    const controller = new AbortController();
    const syncActions = () => {
      if (!form.isConnected) {
        controller.abort();
        return;
      }

      const previewRect = preview.getBoundingClientRect();
      const actionsRect = originalActions.getBoundingClientRect();
      const previewStyle = getComputedStyle(preview);
      const previewClipsVertically = previewStyle.overflowY !== "visible";
      const actionsVisibleInViewport = actionsRect.bottom > 0
        && actionsRect.top < window.innerHeight
        && actionsRect.right > 0
        && actionsRect.left < window.innerWidth;
      const actionsVisibleInPreview = !previewClipsVertically
        || (actionsRect.bottom > previewRect.top
          && actionsRect.top < previewRect.bottom
          && actionsRect.right > previewRect.left
          && actionsRect.left < previewRect.right);
      const actionsVisible = actionsVisibleInViewport && actionsVisibleInPreview;

      form.classList.toggle("is-rich-actions-visible", !actionsVisible);
    };

    app.addEventListener("scroll", syncActions, { passive: true, signal: controller.signal });
    preview.addEventListener("scroll", syncActions, { passive: true, signal: controller.signal });
    window.addEventListener("scroll", syncActions, { passive: true, signal: controller.signal });
    window.addEventListener("resize", syncActions, { signal: controller.signal });
    requestAnimationFrame(syncActions);
  }

  async function handleDocumentationTreeSelectionWhileEditing(nextBlogId) {
    const form = app.querySelector("[data-documentation-inline-editor]");
    const blog = form ? documentationInlineEditorBlog(form) : null;

    if (!form || !blog || !documentationInlineEditorHasChanges(form, blog)) {
      selectDocumentationTreeBlog(nextBlogId);
      return;
    }

    const result = await askDocumentationUnsavedAction();
    if (result === "save") {
      await saveDocumentationInlineEditor(form, { selectedBlogIdAfterSave: nextBlogId, preserveTreePane: true });
      return;
    }

    if (result === "discard") {
      selectDocumentationTreeBlog(nextBlogId);
    }
  }

  function documentationInlineEditorBlog(form) {
    const blogId = Number(form.dataset.blogId || 0);
    if (blogId === newDocumentationInlineBlogId) return documentationNewInlineDraft();
    return documentationBlogForCurrentUser(blogId);
  }

  function documentationInlineEditorHasChanges(form, blog) {
    const projectId = optionalNumberValue(form, "projectId");
    const sprintId = projectId ? optionalNumberValue(form, "sprintId") : null;

    return (projectId || null) !== (blog.projectId || null)
      || (sprintId || null) !== (blog.sprintId || null)
      || (optionalNumberValue(form, "parentBlogId") || null) !== (blog.parentBlogId || null)
      || value(form, "title") !== (blog.title || "")
      || documentationPrivateValue(form) !== documentationIsPrivateForForm(blog)
      || richValue(form, "bodyHtml") !== normalizeRichHtml(blog.bodyHtml || "")
      || (form.querySelector("[name='attachments']")?.files?.length || 0) > 0;
  }

  async function saveDocumentationInlineEditor(form, options = {}) {
    const blogId = Number(form.dataset.blogId || 0);
    const isNewBlog = blogId === newDocumentationInlineBlogId || blogId <= 0;
    if (!isNewBlog && !documentationBlogForCurrentUser(blogId)) return false;
    const projectId = optionalNumberValue(form, "projectId");
    const sprintId = projectId ? optionalNumberValue(form, "sprintId") : null;

    try {
      const result = await saveJson(isNewBlog ? "/api/blogs" : `/api/blogs/${blogId}`, isNewBlog ? "POST" : "PUT", {
        id: isNewBlog ? 0 : blogId,
        projectId,
        sprintId,
        parentBlogId: optionalNumberValue(form, "parentBlogId"),
        title: value(form, "title"),
        isPrivate: documentationPrivateValue(form),
        isPinned: false,
        bodyHtml: richValue(form, "bodyHtml"),
        expectedRowVersion: isNewBlog ? undefined : form.dataset.rowVersion || null
      }, {
        saveAsNew: true,
        canCreate: canAccessResource("Documentation", "Create"),
        createPath: "/api/blogs"
      });
      const savedBlogId = Number(result?.id || blogId || 0);

      for (const file of form.querySelector("[name='attachments']")?.files || []) {
        await attachFile(`/api/blogs/${savedBlogId}/attachments`, file);
      }

      selectedTreeBlogId = options.selectedBlogIdAfterSave || savedBlogId;
      editingTreeBlogId = 0;
      documentationFullScreenEditing = false;
      documentationEntryProjectId = projectId || 0;
      documentationEntrySprintId = sprintId || 0;
      writePreference(preferenceKeys.documentationEntryProject, documentationEntryProjectId);
      writePreference(preferenceKeys.documentationEntrySprint, documentationEntrySprintId);
      await loadState?.();
      const selectedBlog = documentationBlogForCurrentUser(selectedTreeBlogId);
      if (selectedBlog) {
        documentationProjectId = selectedBlog.projectId || 0;
        documentationSprintId = "all";
        documentationTreeSearch = "";
        expandDocumentationTreePath(selectedBlog);
        writePreference(preferenceKeys.documentationProject, documentationProjectId);
        writePreference(preferenceKeys.documentationSprint, documentationSprintId);
        writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
      }
      renderDocumentation();
      showToast?.("Saved.");
      return true;
    } catch (error) {
      showToast?.(error.message);
      return false;
    }
  }

  function askDocumentationUnsavedAction() {
    return new Promise(resolve => {
      const modal = document.createElement("dialog");
      modal.className = "dialog mini-dialog";
      modal.innerHTML = `
        <div class="dialog-head">
          <h2>Unsaved Changes</h2>
        </div>
        <div class="dialog-body">
          <p>Save changes before switching documents?</p>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="button" class="secondary text-icon-button" data-result="discard">${buttonContent("&#8634;", "Discard")}</button>
          <button type="button" class="primary text-icon-button" data-result="save">${buttonContent("&#10003;", "Save")}</button>
        </div>
      `;

      document.body.appendChild(modal);

      const finish = result => {
        modal.close();
        modal.remove();
        resolve(result);
      };

      modal.querySelectorAll("[data-result]").forEach(button => {
        button.addEventListener("click", () => finish(button.dataset.result));
      });
      modal.addEventListener("cancel", event => {
        event.preventDefault();
        finish("cancel");
      });
      modal.showModal();
    });
  }

  function bindDocumentationCardOverflowControls() {
    const updateOverflow = () => {
      app.querySelectorAll(".documentation-card").forEach(syncDocumentationCardOverflowState);
    };

    app.querySelectorAll(".documentation-card details > summary").forEach(summary => {
      summary.dataset.action = "toggle-documentation-card-code";
    });
    requestAnimationFrame(updateOverflow);
    app.querySelectorAll(".documentation-card img").forEach(image => {
      if (image.complete) return;
      image.addEventListener("load", updateOverflow, { once: true });
      image.addEventListener("error", updateOverflow, { once: true });
    });
  }

  function syncDocumentationCardOverflowState(card) {
    if (!card) return;

    const blogId = Number(card.dataset.id || 0);
    const expanded = expandedDocumentationCardIds.has(blogId);
    const body = card.querySelector(".documentation-card-body");
    const toggle = card.querySelector(".documentation-card-overflow-toggle");
    card.classList.toggle("is-expanded", expanded);
    card.classList.toggle("has-overflow", expanded || card.scrollHeight > card.clientHeight + 1 || Boolean(body && body.scrollHeight > body.clientHeight + 1));

    if (!toggle) return;

    const title = expanded ? "Collapse document card" : "Show more of this document card";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.title = title;
    toggle.innerHTML = buttonContent(expanded ? "&#9652;" : "&#9662;", expanded ? "Show Less" : "More");
  }

  function deactivateDocumentation() {
    document.querySelectorAll("[data-documentation-filter-dialog]").forEach(dialog => {
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.remove();
      }
    });
    documentationHeader.deactivate();
    documentationTreeContextMenuController?.abort();
    documentationTreeContextMenuController = null;
    documentationEditMode = false;
    documentationBulkDeleteBusy = false;
    documentationFullScreenEditing = false;
    selectedDocumentationDeleteIds.clear();
  }

  return {
    deactivate: deactivateDocumentation,
    handleAction,
    handleFilterChange,
    render: renderDocumentation,
    view: viewDocumentationById
  };
}

function documentationImportIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21V10M8 14l4-4 4 4M5 3h14v4H5z"></path>
    </svg>
  `;
}

function isDocumentationImportFile(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase() || "";
  return documentationImportFileExtensions.has(extension);
}

function parseDocumentationImportFile(htmlText) {
  const source = String(htmlText || "");
  const parsedDocument = new DOMParser().parseFromString(source, "text/html");
  const metadataText = parsedDocument.querySelector("#pmt-import-metadata")?.textContent
    || parsedDocument.querySelector(".pmt-import-metadata pre")?.textContent
    || "";
  let metadata = {};
  if (metadataText.trim()) {
    try {
      metadata = JSON.parse(metadataText);
    } catch {
      metadata = {};
    }
  }

  if (metadata?.schema !== documentationImportSchema || !metadata.document) metadata = { ...metadata, document: {} };

  return { metadata, document: parsedDocument };
}

function documentationImportPayload(metadata, parsedDocument) {
  const sourceDocument = metadata.document || {};
  const title = documentationImportTitle(sourceDocument, parsedDocument);
  const bodyHtml = documentationImportBodyHtml(sourceDocument.bodyHtml, metadata, parsedDocument);
  const existingBlog = documentationImportExistingBlog(sourceDocument, { title, bodyHtml });
  const projectId = documentationImportProjectId(sourceDocument.project, existingBlog);
  const sprintId = documentationImportSprintId(sourceDocument.sprint, projectId, existingBlog);
  const targetBlogId = existingBlog?.id || 0;
  const parentBlogId = documentationImportParentBlogId(sourceDocument.parent, {
    projectId,
    sprintId,
    targetBlogId
  });
  const isPrivate = documentationImportIsPrivate(sourceDocument, existingBlog);

  return {
    id: targetBlogId,
    projectId,
    sprintId,
    parentBlogId,
    title,
    isPrivate,
    isPinned: false,
    bodyHtml,
    expectedRowVersion: existingBlog ? String(sourceDocument.rowVersion || "") || null : undefined
  };
}

function documentationImportExistingBlog(sourceDocument, { title, bodyHtml }) {
  const sourceBlogId = Number(sourceDocument?.id || 0);
  const sourceTitle = normalizeDocumentationImportText(sourceDocument?.title || title);
  const sourceBody = normalizeDocumentationImportText(documentationTextFromHtml(sourceDocument?.bodyHtml || bodyHtml));
  const editableBlogs = state.blogs.filter(blog =>
    documentationBlogAccessibleToCurrentUser(blog)
    && canAccessResource("Documentation", "Update")
  );
  const existingBlog = (sourceBlogId ? editableBlogs.find(blog => blog.id === sourceBlogId) : null)
    || editableBlogs.find(blog =>
      sourceTitle
      && sourceBody
      && normalizeDocumentationImportText(blog.title) === sourceTitle
      && normalizeDocumentationImportText(documentationTextFromHtml(blog.bodyHtml)) === sourceBody
    )
    || editableBlogs.find(blog => sourceTitle && normalizeDocumentationImportText(blog.title) === sourceTitle)
    || null;
  return existingBlog;
}

function documentationImportIsPrivate(sourceDocument, existingBlog) {
  if (typeof sourceDocument?.isPrivate === "boolean") return sourceDocument.isPrivate;
  if (existingBlog) return existingBlog.isPrivate !== false;
  return true;
}

function documentationImportProjectId(projectMetadata, existingBlog) {
  const fallbackProjectId = documentationImportFallbackContext().projectId;
  if (!projectMetadata) return existingBlog?.projectId || fallbackProjectId || null;

  const sourceId = Number(projectMetadata.id || 0);
  const sourceCode = normalizeDocumentationImportText(projectMetadata.code);
  const sourceTitle = normalizeDocumentationImportText(projectMetadata.title);
  const project = state.projects.find(item => sourceId && item.id === sourceId)
    || state.projects.find(item =>
      sourceCode
    && sourceTitle
    && normalizeDocumentationImportText(item.code) === sourceCode
    && normalizeDocumentationImportText(item.title) === sourceTitle
  )
    || state.projects.find(item => sourceCode && normalizeDocumentationImportText(item.code) === sourceCode)
    || state.projects.find(item => sourceTitle && normalizeDocumentationImportText(item.title) === sourceTitle)
    || state.projects.find(item => item.id === Number(existingBlog?.projectId || 0))
    || state.projects.find(item => item.id === Number(fallbackProjectId || 0));

  return project?.id || null;
}

function documentationImportSprintId(sprintMetadata, projectId, existingBlog) {
  if (!projectId) return null;
  const fallbackSprintId = documentationImportFallbackContext().sprintId;
  if (!sprintMetadata) {
    const existingSprint = sprintById(Number(existingBlog?.sprintId || 0));
    if (existingSprint?.projectId === projectId) return existingSprint.id;
    const fallbackSprint = sprintById(Number(fallbackSprintId || 0));
    return fallbackSprint?.projectId === projectId ? fallbackSprint.id : null;
  }

  const sourceId = Number(sprintMetadata.id || 0);
  const sourceCode = normalizeDocumentationImportText(sprintMetadata.code);
  const sourceTitle = normalizeDocumentationImportText(sprintMetadata.title);
  const candidates = state.sprints.filter(sprint => sprint.projectId === projectId);
  const sprint = candidates.find(item => sourceId && item.id === sourceId)
    || candidates.find(item =>
      sourceCode
    && sourceTitle
    && normalizeDocumentationImportText(item.code) === sourceCode
    && normalizeDocumentationImportText(item.title) === sourceTitle
  )
    || candidates.find(item => sourceCode && normalizeDocumentationImportText(item.code) === sourceCode)
    || candidates.find(item => sourceTitle && normalizeDocumentationImportText(item.title) === sourceTitle)
    || candidates.find(item => item.id === Number(existingBlog?.sprintId || 0))
    || candidates.find(item => item.id === Number(fallbackSprintId || 0));

  return sprint?.id || null;
}

function documentationImportParentBlogId(parentMetadata, { projectId, sprintId, targetBlogId }) {
  if (!parentMetadata) return null;

  const sourceId = Number(parentMetadata.id || 0);
  const sourceTitle = normalizeDocumentationImportText(parentMetadata.title);
  const candidates = state.blogs.filter(blog =>
    documentationBlogAccessibleToCurrentUser(blog)
    && blog.id !== targetBlogId
    && Number(blog.projectId || 0) === Number(projectId || 0)
    && Number(blog.sprintId || 0) === Number(sprintId || 0)
  );
  const parent = candidates.find(blog => sourceId && blog.id === sourceId)
    || candidates.find(blog => sourceTitle && normalizeDocumentationImportText(blog.title) === sourceTitle);

  return parent?.id || null;
}

function documentationImportTitle(sourceDocument, parsedDocument) {
  return String(sourceDocument.title || parsedDocument.querySelector("h1")?.textContent || parsedDocument.querySelector("title")?.textContent || "Imported PMT Document").trim();
}

function documentationImportBodyHtml(bodyHtml, metadata, parsedDocument) {
  const container = document.createElement("div");
  container.innerHTML = String(bodyHtml || "").trim();

  if (!container.innerHTML.trim()) {
    container.innerHTML = parsedDocument.querySelector(".pmt-document-body")?.innerHTML
      || parsedDocument.body?.innerHTML
      || "<p>Imported from PMT HTML import.</p>";
  }

  container.querySelector("#pmt-import-metadata")?.remove();
  container.querySelectorAll(".pmt-import-metadata").forEach(node => node.remove());
  container.querySelectorAll("script").forEach(node => node.remove());
  applyDocumentationImportInlineImages(container, metadata, parsedDocument);
  container.querySelectorAll("[data-pmt-export-image]").forEach(node => node.removeAttribute("data-pmt-export-image"));

  return normalizeRichHtml(container.innerHTML).trim() || "<p>Imported from PMT HTML import.</p>";
}

function applyDocumentationImportInlineImages(container, metadata, parsedDocument) {
  const imageDataUrlsById = documentationImportImageDataUrlsById(parsedDocument);
  const sourceReplacements = new Map();

  (metadata.images || []).forEach(image => {
    const dataUrl = imageDataUrlsById.get(String(image.id || ""));
    if (!dataUrl) return;

    documentationImportImageSourceKeys(image).forEach(source => {
      sourceReplacements.set(source, dataUrl);
    });
  });

  if (!sourceReplacements.size) return;

  container.querySelectorAll("img[src]").forEach(image => {
    const source = image.getAttribute("src") || "";
    const replacement = sourceReplacements.get(source);
    if (replacement) image.setAttribute("src", replacement);
  });
}

function documentationImportImageDataUrlsById(parsedDocument) {
  const imageDataUrlsById = new Map();
  parsedDocument.querySelectorAll(".pmt-document-body img[data-pmt-export-image]").forEach(image => {
    const imageId = image.getAttribute("data-pmt-export-image") || "";
    const source = image.getAttribute("src") || "";
    if (imageId && /^data:image\//i.test(source)) imageDataUrlsById.set(imageId, source);
  });
  return imageDataUrlsById;
}

function documentationImportImageSourceKeys(image) {
  return [
    image.source,
    image.absoluteSource,
    image.exportPath,
    image.fileName
  ]
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function normalizeDocumentationImportText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function documentationTextFromHtml(html) {
  const container = document.createElement("div");
  container.innerHTML = String(html || "");
  return container.textContent || "";
}

function documentationImportFallbackContext() {
  const selectedBlog = documentationBlogForCurrentUser(selectedTreeBlogId);
  const selectedProjectId = projectById(Number(selectedBlog?.projectId || 0))?.id
    || projectById(documentationProjectId)?.id
    || projectById(documentationEntryProjectId)?.id
    || null;
  const selectedSprint = sprintById(Number(selectedBlog?.sprintId || 0))
    || sprintById(documentationEntrySprintId);
  return {
    projectId: selectedProjectId,
    sprintId: selectedSprint?.projectId === selectedProjectId ? selectedSprint.id : null
  };
}

function invalidDocumentationImportError() {
  const error = new Error(documentationInvalidImportMessage);
  error.isInvalidPmtImport = true;
  return error;
}

function applyDocumentationDefaultFilters() {
  documentationDefaultFiltersApplied = true;
  documentationProjectId = 0;
  documentationSprintId = "all";
  documentationVisibilityFilter = "both";
  documentationTreeGroup = "all";
  documentationTreeSearch = "";
  documentationTreeSort = "latest";
  expandedDocumentationCardIds.clear();
  writePreference(preferenceKeys.documentationProject, documentationProjectId);
  writePreference(preferenceKeys.documentationSprint, documentationSprintId);
  writePreference(preferenceKeys.documentationVisibility, documentationVisibilityFilter);
  writePreference(preferenceKeys.documentationTreeGroup, documentationTreeGroup);
  writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
  writePreference(preferenceKeys.documentationTreeSort, documentationTreeSort);
}

function normalizeDocumentationVisibilityFilter() {
  const normalized = documentationVisibilityValue(documentationVisibilityFilter);
  if (normalized === documentationVisibilityFilter) return;

  documentationVisibilityFilter = normalized;
  writePreference(preferenceKeys.documentationVisibility, documentationVisibilityFilter);
}

function documentationVisibilityValue(value) {
  return documentationVisibilityModes.has(value) ? value : "both";
}

function documentationVisibilityOptions() {
  return [
    { value: "both", text: "Both" },
    { value: "private", text: "Private" },
    { value: "public", text: "Public" }
  ];
}

function documentationSprintFilterOptions() {
  const sprints = state.sprints
    .filter(sprint => !documentationProjectId || sprint.projectId === documentationProjectId)
    .map(sprint => {
      const project = projectById(sprint.projectId);
      const sprintLabel = `${sprint.code} - ${sprint.title}`;
      return {
        value: String(sprint.id),
        text: documentationProjectId
          ? sprintLabel
          : `${project?.code || "Project"} - ${sprintLabel}`
      };
    });

  return [
    { value: "all", text: "All Sprints" },
    { value: "none", text: "No Sprint" },
    ...sprints
  ];
}

function documentationBlogVisibleByPrivacyFilter(blog) {
  if (!documentationBlogAccessibleToCurrentUser(blog)) return false;

  const isPrivate = blog.isPrivate !== false;

  if (documentationVisibilityFilter === "private") return isPrivate;
  if (documentationVisibilityFilter === "public") return !isPrivate;

  return true;
}

function documentationBlogMatchesSprintFilter(blog) {
  if (documentationSprintId === "all") return true;
  if (documentationSprintId === "none") return !blog.sprintId;
  return Number(blog.sprintId || 0) === Number(documentationSprintId);
}

function documentationBlogAccessibleToCurrentUser(blog) {
  return Boolean(blog)
    && (blog.isPrivate === false || documentationOwnedByCurrentUser(blog));
}

function documentationBlogForCurrentUser(blogId) {
  const blog = state.blogs.find(item => item.id === Number(blogId || 0));
  return documentationBlogAccessibleToCurrentUser(blog) ? blog : null;
}

function documentationOwnedByCurrentUser(blog) {
  return Number(blog?.createdByUserId || 0) === Number(currentUserId || 0);
}

function documentationNewInlineDraft() {
  const currentProjectId = projectById(documentationProjectId) ? documentationProjectId : 0;
  const rememberedProjectId = projectById(documentationEntryProjectId) ? documentationEntryProjectId : 0;
  const selectedProjectId = currentProjectId || rememberedProjectId || null;
  const selectedSprintId = state.sprints.some(sprint =>
    sprint.id === documentationEntrySprintId
    && sprint.projectId === Number(selectedProjectId || 0)
  )
    ? documentationEntrySprintId
    : null;

  return {
    id: newDocumentationInlineBlogId,
    projectId: selectedProjectId,
    sprintId: selectedSprintId,
    parentBlogId: null,
    title: "",
    bodyHtml: "",
    isPrivate: true,
    isPinned: false,
    attachments: [],
    history: [],
    createdAt: "",
    updatedAt: "",
    createdByUserId: 0
  };
}

function documentationTreeSelect(label, filterName, items, selectedValue) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <select data-filter="${escapeAttr(filterName)}">
        ${items.map(item => `<option value="${escapeAttr(item.value)}" ${String(item.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(item.text)}</option>`).join("")}
      </select>
    </label>
  `;
}

function documentationPrivateField(blog = {}) {
  return `
    <label class="inline-check field">
      <input name="isPrivate" type="checkbox" ${documentationIsPrivateForForm(blog) ? "checked" : ""}>
      <span>Private</span>
    </label>
  `;
}

function documentationPrivateValue(root) {
  return root.querySelector("[name='isPrivate']")?.checked ?? true;
}

function documentationIsPrivateForForm(blog = {}) {
  return blog?.id ? blog.isPrivate !== false : true;
}

function documentationCardBlogs() {
  const searchText = documentationSearchText();
  return state.blogs
    .filter(documentationBlogVisibleByPrivacyFilter)
    .filter(blog => !documentationProjectId || blog.projectId === documentationProjectId)
    .filter(documentationBlogMatchesSprintFilter)
    .filter(blog => !searchText || documentationBlogMatchesSearch(blog, searchText))
    .sort(documentationCardBlogCompare);
}

function documentationCardSectionsHtml(blogs) {
  return documentationCardGroups(blogs).map(group => `
    <section class="documentation-card-section">
      <h2>${escapeHtml(group.label)}</h2>
      <div class="grid documentation-grid">
        ${group.blogs.map(documentationCardHtml).join("")}
      </div>
    </section>
  `).join("");
}

function documentationCardGroups(blogs) {
  const groups = new Map();
  blogs.forEach(blog => {
    const group = documentationCardGroup(blog);
    const existing = groups.get(group.key);
    if (existing) {
      existing.blogs.push(blog);
    } else {
      groups.set(group.key, { ...group, blogs: [blog] });
    }
  });

  return [...groups.values()];
}

function documentationCardGroup(blog) {
  if (documentationTreeGroup === "project") {
    if (!blog.projectId) return { key: "global", label: "Global" };

    const project = projectById(blog.projectId);
    return {
      key: `project:${blog.projectId}`,
      label: project ? `${project.code} - ${project.title}` : documentationProjectLabel(blog.projectId)
    };
  }

  if (!blog.projectId) return { key: "global", label: "Global" };

  const project = projectById(blog.projectId);
  const projectLabel = project ? `${project.code} - ${project.title}` : documentationProjectLabel(blog.projectId);
  const sprint = sprintById(blog.sprintId);
  if (sprint && sprint.projectId === blog.projectId) {
    return {
      key: `sprint:${sprint.id}`,
      label: `${projectLabel} / ${sprint.code} - ${sprint.title}`
    };
  }

  return {
    key: `project:${blog.projectId}:direct`,
    label: `${projectLabel} / Project Documents`
  };
}

function expandDocumentationTreePath(blog) {
  if (!blog) return;

  if (documentationTreeGroup !== "all") {
    if (!blog.projectId) {
      collapsedTreeKeys.delete("global");
    } else {
      collapsedTreeKeys.delete(`project:${blog.projectId}`);
      if (documentationTreeGroup === "project-sprint") {
        const sprint = sprintById(blog.sprintId);
        collapsedTreeKeys.delete(sprint && sprint.projectId === blog.projectId
          ? `sprint:${sprint.id}`
          : `project:${blog.projectId}:direct`);
      }
    }
  }

  const keyPrefix = documentationTreeKeyPrefixForBlog(blog);
  const byId = new Map(state.blogs
    .filter(documentationBlogAccessibleToCurrentUser)
    .map(item => [item.id, item]));
  let current = blog;
  while (current) {
    collapsedTreeKeys.delete(`${keyPrefix}:doc:${current.id}`);
    current = byId.get(current.parentBlogId);
  }
}

function documentationTreeKeyPrefixForBlog(blog) {
  if (documentationTreeGroup === "all") return "all";
  if (!blog.projectId) return "global";
  if (documentationTreeGroup === "project") return `project:${blog.projectId}`;

  const sprint = sprintById(blog.sprintId);
  return sprint && sprint.projectId === blog.projectId
    ? `sprint:${sprint.id}`
    : `project:${blog.projectId}:direct`;
}

function documentationTreeBlogs() {
  const searchText = documentationSearchText();
  const sourceBlogs = state.blogs
    .filter(documentationBlogVisibleByPrivacyFilter)
    .filter(blog => !documentationProjectId || blog.projectId === documentationProjectId)
    .filter(documentationBlogMatchesSprintFilter);
  const matchedBlogs = searchText
    ? sourceBlogs.filter(blog => documentationBlogMatchesSearch(blog, searchText))
    : [...sourceBlogs];

  if (!searchText || documentationTreeLayout === "flat") return matchedBlogs.sort(documentationBlogCompare);

  const byId = new Map(sourceBlogs.map(blog => [blog.id, blog]));
  const included = new Map();
  matchedBlogs.forEach(blog => {
    let current = blog;
    while (current && !included.has(current.id)) {
      included.set(current.id, current);
      current = byId.get(current.parentBlogId);
    }
  });

  return [...included.values()].sort(documentationBlogCompare);
}

function documentationTreeNavHtml(blogs) {
  if (!blogs.length) return `<div class="empty">No documents match the tree filters.</div>`;
  const rootDrop = `<div class="documentation-tree-root-drop" data-documentation-root-drop aria-hidden="true"></div>`;

  if (documentationTreeGroup === "all") {
    return rootDrop + documentationDocumentsHtml(blogs, 0, "all");
  }

  const globalBlogs = blogs.filter(blog => !blog.projectId);
  const projectFolders = state.projects
    .map(project => {
      const projectBlogs = blogs.filter(blog => blog.projectId === project.id);
      if (!projectBlogs.length) return "";

      if (documentationTreeGroup === "project") {
        return documentationFolderHtml({
          key: `project:${project.id}`,
          label: `${project.code} - ${project.title}`,
          depth: 0,
          count: projectBlogs.length,
          childrenHtml: documentationDocumentsHtml(projectBlogs, 1, `project:${project.id}`)
        });
      }

      const directBlogs = projectBlogs.filter(blog => !blog.sprintId || !sprintById(blog.sprintId));
      const directFolder = directBlogs.length
        ? documentationFolderHtml({
          key: `project:${project.id}:direct`,
          label: "Project Documents",
          depth: 1,
          count: directBlogs.length,
          childrenHtml: documentationDocumentsHtml(directBlogs, 2, `project:${project.id}:direct`)
        })
        : "";
      const sprintFolders = state.sprints
        .filter(sprint => sprint.projectId === project.id)
        .map(sprint => {
          const sprintBlogs = projectBlogs.filter(blog => blog.sprintId === sprint.id);
          if (!sprintBlogs.length) return "";

          return documentationFolderHtml({
            key: `sprint:${sprint.id}`,
            label: `${sprint.code} - ${sprint.title}`,
            depth: 1,
            count: sprintBlogs.length,
            childrenHtml: documentationDocumentsHtml(sprintBlogs, 2, `sprint:${sprint.id}`)
          });
        })
        .join("");

      return documentationFolderHtml({
        key: `project:${project.id}`,
        label: `${project.code} - ${project.title}`,
        depth: 0,
        count: projectBlogs.length,
        childrenHtml: directFolder + sprintFolders
      });
    })
    .join("");

  const globalFolder = globalBlogs.length
    ? documentationFolderHtml({
      key: "global",
      label: "Global",
      depth: 0,
      count: globalBlogs.length,
      childrenHtml: documentationDocumentsHtml(globalBlogs, 1, "global")
    })
    : "";

  return rootDrop + (globalFolder + projectFolders || `<div class="empty">No documents match the tree filters.</div>`);
}

function documentationFolderHtml({ key, label, depth, count, childrenHtml }) {
  const collapsed = collapsedTreeKeysForRender.has(key);
  const countText = count === 1 ? "1 document" : `${count} documents`;

  return `
    <div class="documentation-tree-row documentation-tree-folder-row" style="--tree-depth:${depth}" role="treeitem" aria-expanded="${!collapsed}">
      <button class="documentation-tree-folder" type="button" data-action="toggle-documentation-tree-folder" data-tree-key="${escapeAttr(key)}">
        <span class="documentation-tree-expander" aria-hidden="true">${collapsed ? "&#9656;" : "&#9662;"}</span>
        <span class="documentation-tree-icon" aria-hidden="true">&#128193;</span>
        <span class="documentation-tree-label">${escapeHtml(label)}</span>
        <span class="documentation-tree-count">${escapeHtml(countText)}</span>
      </button>
    </div>
    ${collapsed ? "" : childrenHtml}
  `;
}

function documentationTreeContextMenuHtml() {
  return `
    <div class="dropdown-menu documentation-tree-context-menu" data-documentation-tree-context-menu role="menu" aria-label="Document actions" hidden>
      ${documentationTreeContextMenuItemHtml("edit-documentation-info", "Edit Info", "&#9432;", "data-documentation-context-requires-update")}
      ${documentationTreeContextMenuItemHtml("edit-documentation-full-screen", "Edit Document", "&#9998;", "data-documentation-context-requires-update")}
      ${documentationTreeContextMenuItemHtml("export-blog", "Download", documentationExportIconHtml())}
      ${documentationTreeContextMenuItemHtml("delete-blog", "Delete", "&#128465;", "data-documentation-context-requires-delete", "is-danger")}
    </div>
  `;
}

function documentationTreeContextMenuItemHtml(action, label, iconHtml, permissionAttribute = "", className = "") {
  return `
    <button type="button" class="dropdown-menu-item ${className}" data-action="${action}" ${permissionAttribute} role="menuitem" title="${label}" aria-label="${label}">
      <span class="dropdown-menu-icon" aria-hidden="true">${iconHtml}</span>
      <span class="dropdown-menu-label">${label}</span>
      <span class="dropdown-menu-check" aria-hidden="true"></span>
    </button>
  `;
}

let collapsedTreeKeysForRender = new Set();

function documentationDocumentsHtml(blogs, depth, keyPrefix) {
  const scopedBlogs = [...blogs].sort(documentationBlogCompare);
  if (documentationTreeLayout === "flat") {
    return scopedBlogs.map(blog => documentationDocumentNodeHtml(blog, [], depth, keyPrefix)).join("");
  }

  const scopedIds = new Set(scopedBlogs.map(blog => blog.id));
  const childrenByParent = new Map();
  scopedBlogs.forEach(blog => {
    const parentId = scopedIds.has(blog.parentBlogId) ? blog.parentBlogId : 0;
    const children = childrenByParent.get(parentId) || [];
    children.push(blog);
    childrenByParent.set(parentId, children);
  });

  const renderNodes = (parentId, nextDepth) => (childrenByParent.get(parentId) || [])
    .sort(documentationBlogCompare)
    .map(blog => {
      const children = (childrenByParent.get(blog.id) || []).sort(documentationBlogCompare);
      return documentationDocumentNodeHtml(blog, children, nextDepth, keyPrefix, renderNodes);
    })
    .join("");

  return renderNodes(0, depth);
}

function documentationDocumentNodeHtml(blog, children, depth, keyPrefix, renderNodes = null) {
  const selected = selectedTreeBlogIdForRender === blog.id;
  const nodeKey = `${keyPrefix}:doc:${blog.id}`;
  const collapsed = collapsedTreeKeysForRender.has(nodeKey);
  const hasChildren = children.length > 0;
  const childHtml = hasChildren && !collapsed && renderNodes ? renderNodes(blog.id, depth + 1) : "";

  return `
    <div class="documentation-tree-row documentation-tree-document-row documentation-tree-drag-row ${selected ? "is-selected" : ""}" style="--tree-depth:${depth}" role="treeitem" aria-selected="${selected}" ${hasChildren ? `aria-expanded="${!collapsed}"` : ""} data-documentation-tree-row data-id="${blog.id}" draggable="${documentationCanMove(blog)}">
      <button class="documentation-tree-node-toggle" type="button" data-action="toggle-documentation-tree-node" data-tree-key="${escapeAttr(nodeKey)}" title="${hasChildren ? "Expand or collapse document children" : ""}" ${hasChildren ? "" : "disabled"} aria-label="${hasChildren ? "Expand or collapse document children" : "No child documents"}">
        <span aria-hidden="true">${hasChildren ? (collapsed ? "&#9656;" : "&#9662;") : ""}</span>
      </button>
      <button class="documentation-tree-document" type="button" data-action="select-documentation-tree-blog" data-id="${blog.id}" title="${escapeAttr(blog.title)}">
        <span class="documentation-tree-icon" aria-hidden="true">&#128196;</span>
        <span class="documentation-tree-label">${escapeHtml(blog.title)}</span>
        <span class="documentation-tree-date">${escapeHtml(formatDate(blog.updatedAt || blog.createdAt))}</span>
      </button>
    </div>
    ${childHtml}
  `;
}

let selectedTreeBlogIdForRender = 0;

function documentationTreePreviewHtml(blog) {
  selectedTreeBlogIdForRender = blog?.id || 0;
  if (!blog) return `<div class="empty">No document selected.</div>`;
  if (
    editingTreeBlogId === blog.id
    && (blog.id === newDocumentationInlineBlogId || canAccessResource("Documentation", "Update"))
  ) return documentationTreeInlineEditorHtml(blog);

  const wasEdited = documentationWasEdited(blog);
  const editHistory = wasEdited ? documentationLatestUpdatedHistory(blog) : null;
  const parent = documentationBlogForCurrentUser(blog.parentBlogId);

  return `
    <div class="documentation-tree-preview-head">
      <div class="documentation-tree-preview-title">
        <h2>${escapeHtml(blog.title)}</h2>
        <div class="documentation-tree-preview-meta">
          <span>${escapeHtml(documentationProjectLabel(blog.projectId))}</span>
          ${blog.sprintId ? `<span>${escapeHtml(sprintName(blog.sprintId))}</span>` : ""}
          ${parent ? `<span>Parent: ${escapeHtml(parent.title)}</span>` : ""}
          <span>Created by: ${escapeHtml(documentationUserName(blog.createdByUserId))}</span>
          <span>${escapeHtml(documentationCardDateTime(blog.createdAt))}</span>
          ${wasEdited ? `
            <span>Last Edited by: ${escapeHtml(documentationUserName(editHistory?.userId || blog.createdByUserId))}</span>
            <span>${escapeHtml(documentationCardDateTime(editHistory?.createdAt || blog.updatedAt))}</span>
          ` : ""}
        </div>
      </div>
      <div class="toolbar documentation-tree-preview-actions">
        ${documentationDeleteSelectionHtml(blog)}
        ${iconButton("delete-blog", blog.id, "Delete", "delete", canAccessResource("Documentation", "Delete"), "danger")}
        <button class="icon-action" type="button" data-action="export-blog" data-id="${blog.id}" title="Export" aria-label="Export"><span class="button-icon" aria-hidden="true">${documentationExportIconHtml()}</span></button>
        ${iconButton("edit-blog", blog.id, "Edit", "edit", canAccessResource("Documentation", "Update"))}
      </div>
    </div>
    <div class="rich-readonly documentation-tree-preview-body documentation-image-open-area" ${documentationRichPersistAttrs(blog)}>${blog.bodyHtml || ""}</div>
    ${blog.attachments.length ? `<div class="documentation-attachments">${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>` : ""}
  `;
}

function documentationTreeInlineEditorHtml(blog) {
  const isNewBlog = blog.id === newDocumentationInlineBlogId;
  const wasEdited = documentationWasEdited(blog);
  const parent = documentationBlogForCurrentUser(blog.parentBlogId);
  const selectedProjectId = blog.projectId || "";
  const selectedSprintId = blog.sprintId || "";
  const metaHtml = isNewBlog
    ? `<span>New document</span>`
    : `
      <span>${escapeHtml(documentationProjectLabel(blog.projectId))}</span>
      ${blog.sprintId ? `<span>${escapeHtml(sprintName(blog.sprintId))}</span>` : ""}
      ${parent ? `<span>Parent: ${escapeHtml(parent.title)}</span>` : ""}
      <span>${wasEdited ? "Updated" : "Created"} ${escapeHtml(formatDate(wasEdited ? blog.updatedAt : blog.createdAt))}</span>
    `;

  return `
    <form class="documentation-inline-editor" data-documentation-inline-editor data-blog-id="${blog.id}" data-row-version="${escapeAttr(blog.rowVersion || "")}">
      <div class="documentation-tree-preview-head documentation-inline-editor-head">
        <div class="documentation-tree-preview-title documentation-inline-title">
          <h2>${escapeHtml(blog.title || (isNewBlog ? "New Document" : "Edit Document"))}</h2>
          <div class="documentation-tree-preview-meta">
            ${metaHtml}
          </div>
        </div>
        <div class="toolbar documentation-tree-preview-actions">
          <button class="secondary text-icon-button" type="button" data-action="cancel-documentation-inline-edit">${buttonContent("&#10005;", "Cancel")}</button>
          <button class="primary text-icon-button" type="button" data-action="save-documentation-inline-edit">${buttonContent("&#10003;", "Save")}</button>
        </div>
      </div>
      <div class="form-grid documentation-inline-meta">
        ${field("Title", "title", blog.title || "", "text", "", "", "", { required: true })}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "Global" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${selectOptionsField("Sprint", "sprintId", documentationSprintOptions(selectedProjectId), selectedSprintId)}
        ${selectOptionsField("Parent", "parentBlogId", documentationParentOptions(selectedProjectId, selectedSprintId, blog.id), blog.parentBlogId || "")}
        ${documentationPrivateField(blog)}
      </div>
      <div class="field full is-required documentation-inline-body-field">
        <label>Body</label>
        ${richTextToolsHtml({ actionsHtml: documentationInlineRichTextActionsHtml() })}
        <div class="rich-editor documentation-inline-body-editor documentation-image-open-area" contenteditable="true" role="textbox" aria-label="Body" aria-multiline="true" data-rich="bodyHtml" aria-required="true">${blog.bodyHtml || ""}</div>
      </div>
      <div class="field full documentation-inline-attachments">
        <label>Attachments</label>
        ${blog.attachments.length ? attachmentsHtml(blog.attachments, { deletePathPrefix: `/api/blogs/${blog.id}/attachments` }) : ""}
        <input name="attachments" type="file" multiple>
        <div class="attachment-preview" data-preview="attachments"></div>
      </div>
    </form>
  `;
}

function documentationInlineRichTextActionsHtml() {
  return `
    <span class="documentation-inline-rich-actions">
      <button class="documentation-inline-rich-action-button" type="button" data-action="cancel-documentation-inline-edit">${buttonContent("&#10005;", "Cancel")}</button>
      <button class="documentation-inline-rich-action-button is-primary" type="button" data-action="save-documentation-inline-edit">${buttonContent("&#10003;", "Save")}</button>
    </span>
  `;
}

function documentationDeleteSelectionHtml(blog) {
  if (!documentationEditMode) return "";

  const checked = selectedDocumentationDeleteIds.has(blog.id);
  const label = `Select ${blog.title} for bulk delete`;
  return `
    <label class="documentation-delete-selection" title="${escapeAttr(label)}">
      <input type="checkbox" data-documentation-delete-select data-id="${blog.id}" aria-label="${escapeAttr(label)}" ${checked ? "checked" : ""} ${documentationCanDelete(blog) && !documentationBulkDeleteBusy ? "" : "disabled"}>
    </label>
  `;
}

function documentationCanDelete(blog) {
  return documentationBlogAccessibleToCurrentUser(blog)
    && canAccessResource("Documentation", "Delete");
}

function documentationCanMove(blog) {
  return documentationOwnedByCurrentUser(blog)
    && canAccessResource("Documentation", "Update");
}

function documentationCardHtml(blog) {
  const wasEdited = documentationWasEdited(blog);
  const isExpanded = expandedDocumentationCardIds.has(blog.id);

  return `
    <article class="card clickable-card documentation-card ${isExpanded ? "is-expanded" : ""}" data-action="view-blog" data-id="${blog.id}" title="${escapeAttr(blog.title)}">
      <div class="documentation-card-top">
        <div class="documentation-card-title-row">
          <div class="documentation-title-block">
            <h3>${escapeHtml(blog.title)}</h3>
          </div>
          <div class="row documentation-project documentation-card-badges">
            ${documentationCardIndicatorsHtml(blog)}
            ${blog.projectId ? `<span class="pill">${escapeHtml(projectCode(blog.projectId))}</span>` : `<span class="pill">General</span>`}
          </div>
        </div>
        ${wasEdited ? documentationEditedMetaHtml(blog) : documentationCreatedMetaHtml(blog)}
      </div>
      <div class="rich-readonly documentation-card-body" ${documentationRichPersistAttrs(blog)}>${blog.bodyHtml}</div>
      ${blog.attachments.length ? `<div class="documentation-attachments">${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>` : ""}
      <div class="documentation-card-bottom ${wasEdited ? "" : "has-top-created-meta"}">
        ${wasEdited ? documentationCreatedMetaHtml(blog) : ""}
        <div class="toolbar reveal-actions documentation-actions">
          ${documentationDeleteSelectionHtml(blog)}
          ${iconButton("delete-blog", blog.id, "Delete", "delete", canAccessResource("Documentation", "Delete"), "danger")}
          ${iconButton("edit-blog", blog.id, "Edit", "edit", canAccessResource("Documentation", "Update"))}
        </div>
      </div>
      <button class="secondary text-icon-button documentation-card-overflow-toggle" type="button" data-action="toggle-documentation-card-expanded" data-id="${blog.id}" aria-expanded="${isExpanded}" title="${isExpanded ? "Collapse document card" : "Show more of this document card"}">
        ${buttonContent(isExpanded ? "&#9652;" : "&#9662;", isExpanded ? "Show Less" : "More")}
      </button>
    </article>
  `;
}

function documentationRichPersistAttrs(blog) {
  return [
    `data-rich-persist-type="blog"`,
    `data-rich-persist-id="${escapeAttr(blog.id)}"`,
    `data-rich-persist-field="bodyHtml"`
  ].join(" ");
}

function documentationCardIndicatorsHtml(blog) {
  return [
    blog.isPrivate !== false ? documentationCardIndicatorHtml("Private", documentationLockIconHtml()) : ""
  ].filter(Boolean).join("");
}

function documentationCardIndicatorHtml(label, iconHtml) {
  return `
    <span class="documentation-card-indicator" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">
      ${iconHtml}
    </span>
  `;
}

function documentationLockIconHtml() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10" width="14" height="10" rx="2"></rect>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
      <path d="M12 14v3"></path>
    </svg>
  `;
}

function documentationSprintOptions(projectId) {
  const numericProjectId = Number(projectId || 0);
  return [
    { id: "", title: "No Sprint" },
    ...state.sprints
      .filter(sprint => sprint.projectId === numericProjectId)
      .map(sprint => ({ id: sprint.id, title: `${sprint.code} - ${sprint.title}` }))
  ];
}

function documentationParentOptions(projectId, sprintId, blogId = 0) {
  const numericProjectId = Number(projectId || 0);
  const numericSprintId = Number(sprintId || 0);
  const excludedIds = documentationDescendantIds(blogId);
  if (blogId) excludedIds.add(blogId);

  return [
    { id: "", title: "No parent" },
    ...state.blogs
      .filter(blog =>
        documentationBlogAccessibleToCurrentUser(blog)
        && !excludedIds.has(blog.id)
        && Number(blog.projectId || 0) === numericProjectId
        && Number(blog.sprintId || 0) === numericSprintId
      )
      .sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id)
      .map(blog => ({ id: blog.id, title: blog.title }))
  ];
}

function documentationDescendantIds(blogId) {
  const descendants = new Set();
  if (!blogId) return descendants;

  let added = true;
  while (added) {
    added = false;
    state.blogs.filter(documentationBlogAccessibleToCurrentUser).forEach(blog => {
      if (blog.parentBlogId && (blog.parentBlogId === blogId || descendants.has(blog.parentBlogId)) && !descendants.has(blog.id)) {
        descendants.add(blog.id);
        added = true;
      }
    });
  }

  return descendants;
}

function documentationOptionsHtml(options, selectedId) {
  return options
    .map(option => `<option value="${escapeAttr(option.id)}" ${String(option.id) === String(selectedId ?? "") ? "selected" : ""}>${escapeHtml(option.title)}</option>`)
    .join("");
}

function documentationEditedMetaHtml(blog) {
  const history = documentationLatestUpdatedHistory(blog);

  return `
    <div class="documentation-card-meta documentation-card-edited-meta">
      <span>Last Edited by: ${escapeHtml(documentationUserName(history?.userId || blog.createdByUserId))}</span>
      <span>${escapeHtml(documentationCardDateTime(history?.createdAt || blog.updatedAt))}</span>
    </div>
  `;
}

function documentationCreatedMetaHtml(blog) {
  return `
    <div class="documentation-card-meta documentation-card-created-meta">
      <span>Created by: ${escapeHtml(documentationUserName(blog.createdByUserId))}</span>
      <span>${escapeHtml(documentationCardDateTime(blog.createdAt))}</span>
    </div>
  `;
}

function documentationLatestUpdatedHistory(blog) {
  return (blog.history || []).find(item => item.action === "Updated") || null;
}

function documentationUserName(userId) {
  const user = userById(userId);
  if (!user) return "User";

  const fullName = [user.firstName, user.lastName]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  const nickname = (user.nickname || "").trim();
  if (fullName && nickname && fullName.toLowerCase() !== nickname.toLowerCase()) return `${fullName} (${nickname})`;

  return fullName || nickname || "User";
}

function documentationProjectLabel(projectId) {
  return projectId ? projectCode(projectId) : "Global";
}

function documentationCardDateTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).replace(",", "").toLowerCase();
}

function documentationBlogCompare(a, b) {
  if (documentationTreeSort === "custom") return documentationCustomBlogCompare(a, b);
  if (documentationTreeSort === "name") {
    return a.title.localeCompare(b.title) || a.id - b.id;
  }

  const left = Date.parse(a.updatedAt || a.createdAt || "") || 0;
  const right = Date.parse(b.updatedAt || b.createdAt || "") || 0;
  const dateCompare = documentationTreeSort === "oldest" ? left - right : right - left;
  return dateCompare || a.title.localeCompare(b.title) || a.id - b.id;
}

function documentationCustomBlogCompare(a, b) {
  const leftOrder = Number(a.sortOrder || 0);
  const rightOrder = Number(b.sortOrder || 0);
  if (leftOrder && rightOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
  if (leftOrder !== rightOrder) return rightOrder ? -1 : 1;

  const left = Date.parse(a.updatedAt || a.createdAt || "") || 0;
  const right = Date.parse(b.updatedAt || b.createdAt || "") || 0;
  return right - left || a.title.localeCompare(b.title) || a.id - b.id;
}

function documentationCardBlogCompare(a, b) {
  return documentationBlogCompare(a, b);
}

function documentationBlogMatchesSearch(blog, searchText) {
  const project = projectById(blog.projectId);
  const sprint = sprintById(blog.sprintId);
  const haystack = [
    blog.title,
    stripHtml(blog.bodyHtml),
    project?.code,
    project?.title,
    sprint?.code,
    sprint?.title
  ].join(" ").toLowerCase();

  return haystack.includes(searchText);
}

function documentationSearchText() {
  return documentationTreeSearch.trim().toLowerCase();
}

function documentationDropPlacement(row, clientY) {
  const rect = row?.getBoundingClientRect();
  if (!rect?.height) return "inside";
  const ratio = (clientY - rect.top) / rect.height;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

function clearDocumentationDropCues(tree) {
  tree.querySelectorAll(".is-drop-before, .is-drop-after, .is-drop-inside, .is-drop-target").forEach(element => {
    element.classList.remove("is-drop-before", "is-drop-after", "is-drop-inside", "is-drop-target");
  });
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ");
}

function readKnownPreference(key, defaultValue, allowedValues) {
  const value = readPreference(key, defaultValue);
  return allowedValues.has(value) ? value : defaultValue;
}

function bindDocumentationBodyImageOpen(root) {
  if (!root || root.dataset.documentationImageOpenBound === "true") return;

  root.dataset.documentationImageOpenBound = "true";
  root.addEventListener("click", event => {
    const image = event.target instanceof Element
      ? event.target.closest(".documentation-image-open-area img")
      : null;
    if (!image || !root.contains(image)) return;
    if (image.closest(".rich-editor")) return;

    const imageUrl = image.currentSrc || image.getAttribute("src") || "";
    if (!imageUrl) return;

    event.preventDefault();
    event.stopPropagation();
    openDocumentationImageInNewTab(imageUrl);
  }, true);
}

function openDocumentationImageInNewTab(imageUrl) {
  let targetUrl = imageUrl;

  try {
    targetUrl = new URL(imageUrl, window.location.href).href;
  } catch {
    targetUrl = imageUrl;
  }

  const opened = window.open(targetUrl, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
}
