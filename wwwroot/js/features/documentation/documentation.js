import { attachmentsHtml } from "../../components/attachments.js";
import { buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260706-dialog-persistence";
import { filterSelect } from "../../components/filters.js";
import {
  documentationExportIconHtml,
  openDocumentationExportDialog
} from "./documentation-export.js?v=20260710-export-rich-kanban";
import {
  field,
  optionalNumberValue,
  richTextField,
  richTextToolsHtml,
  richValue,
  selectOptionsField,
  value
} from "../../components/forms.js?v=20260710-rte-table-shortcuts";
import { sectionHead } from "../../components/sections.js?v=20260701-nav-title-preferences";
import {
  preferenceKeys,
  readBooleanPreference,
  readNumberPreference,
  readPreference,
  writePreference
} from "../../core/preferences.js?v=20260708-documentation-privacy";
import {
  currentUser,
  currentUserId
} from "../../core/authentication.js";
import { state } from "../../core/store.js";
import {
  documentationWasEdited,
  formatDate
} from "../../shared/dates.js";
import { canEditOwner } from "../../shared/permissions.js";
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
const documentationTreeSorts = new Set(["latest", "oldest", "name"]);
const documentationVisibilityModes = new Set(["both", "private", "public", "admin-all"]);
const documentationImportMetadataTitle = "PMT Import Process Meta Data";
const documentationImportSchema = "pmt.documentation.export.v1";
const documentationInvalidImportMessage = "The file cannot be imported because it is not a valid PMT export file.";
const documentationImportFileExtensions = new Set(["html", "doc"]);
const newDocumentationInlineBlogId = -1;
let documentationProjectId = 0;
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
const collapsedTreeKeys = new Set();
const expandedDocumentationCardIds = new Set();
let documentationDefaultFiltersApplied = false;

export function createDocumentationFeature({
  app,
  attachFile,
  bindAttachmentPreview,
  bindRichTextButtons,
  deleteItem,
  loadState,
  openEditor,
  saveJson,
  showToast
}) {
  documentationProjectId = readNumberPreference(preferenceKeys.documentationProject, 0);
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

  function renderDocumentation() {
    if (documentationProjectId && !projectById(documentationProjectId)) documentationProjectId = 0;
    normalizeDocumentationVisibilityFilter();
    if (!documentationDefaultFiltersApplied) applyDocumentationDefaultFilters();

    const filteredBlogs = documentationCardBlogs();

    app.innerHTML = `<div class="documentation-screen ${documentationViewMode === "tree" ? "is-tree-view" : "is-card-view"}">
      ${sectionHead("Documentation", documentationHeaderActionsHtml())}
      ${documentationViewMode === "tree" ? documentationTreeViewHtml() : documentationCardViewHtml(filteredBlogs)}
    </div>`;

    if (documentationViewMode === "tree") {
      bindDocumentationTreeSplitter();
      bindDocumentationInlineEditor();
      bindDocumentationBodyImageOpen(app);
    } else {
      bindDocumentationCardOverflowControls();
    }
  }

  function documentationHeaderActionsHtml() {
    return `
      <div class="documentation-view-toggle" aria-label="Documentation view">
        <button class="secondary text-icon-button documentation-view-toggle-button ${documentationViewMode === "cards" ? "is-on" : ""}" type="button" data-action="set-documentation-view" data-mode="cards" aria-pressed="${documentationViewMode === "cards"}">
          ${buttonContent("&#9638;", "Cards")}
        </button>
        <button class="secondary text-icon-button documentation-view-toggle-button ${documentationViewMode === "tree" ? "is-on" : ""}" type="button" data-action="set-documentation-view" data-mode="tree" aria-pressed="${documentationViewMode === "tree"}">
          ${buttonContent("&#9776;", "Treeview")}
        </button>
      </div>
      <div class="documentation-header-actions">
        <button class="primary text-icon-button" type="button" data-action="new-blog">${buttonContent("&#10010;", "New Document")}</button>
        <button class="secondary text-icon-button" type="button" data-action="import-documentation">${buttonContent(documentationImportIconHtml(), "Import")}</button>
        ${documentationViewMode === "tree" ? `
          <button class="secondary text-icon-button" type="button" data-action="toggle-documentation-tree-pane" aria-pressed="${documentationTreePaneHidden}">
            ${buttonContent(documentationTreePaneHidden ? "&#9776;" : "&#10005;", documentationTreePaneHidden ? "Show Tree" : "Hide Tree")}
          </button>
        ` : ""}
        <button class="secondary text-icon-button" type="button" data-action="open-documentation-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">
          ${buttonContent(funnelIconHtml(), "Filters")}
        </button>
      </div>
    `;
  }

  function documentationCardViewHtml(filteredBlogs) {
    if (!filteredBlogs.length) return `<div class="empty">No documents match the selected filters.</div>`;

    if (documentationTreeGroup === "all") {
      return `<div class="grid documentation-grid">${filteredBlogs.map(documentationCardHtml).join("")}</div>`;
    }

    return `<div class="documentation-card-sections">${documentationCardSectionsHtml(filteredBlogs)}</div>`;
  }

  function documentationTreeViewHtml() {
    const visibleBlogs = documentationTreeBlogs();
    const visibleIds = new Set(visibleBlogs.map(blog => blog.id));
    const isCreatingTreeBlog = editingTreeBlogId === newDocumentationInlineBlogId;
    if (!isCreatingTreeBlog && !visibleIds.has(selectedTreeBlogId)) selectedTreeBlogId = visibleBlogs[0]?.id || 0;
    if (!isCreatingTreeBlog && !visibleIds.has(editingTreeBlogId)) editingTreeBlogId = 0;
    const selectedBlog = isCreatingTreeBlog
      ? documentationNewInlineDraft()
      : state.blogs.find(blog => blog.id === selectedTreeBlogId && visibleIds.has(blog.id));
    collapsedTreeKeysForRender = collapsedTreeKeys;
    selectedTreeBlogIdForRender = selectedTreeBlogId;

    return `
      <div class="documentation-tree-layout ${documentationTreePaneHidden ? "is-tree-hidden" : ""}" style="--documentation-tree-pane-width:${documentationTreePaneWidth}px">
        <aside class="panel documentation-tree-pane" ${documentationTreePaneHidden ? "hidden" : ""}>
          <div class="documentation-tree" role="tree" aria-label="Documentation tree">
            ${documentationTreeNavHtml(visibleBlogs)}
          </div>
        </aside>
        <div class="documentation-tree-splitter" data-documentation-tree-splitter ${documentationTreePaneHidden ? "hidden" : ""} role="separator" aria-orientation="vertical" aria-label="Resize tree navigation"></div>
        <section class="panel documentation-tree-preview">
          ${documentationTreePreviewHtml(selectedBlog)}
        </section>
      </div>
    `;
  }

  async function handleAction(action, id, button) {
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
      renderDocumentation();
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
      if (documentationViewMode === "tree") {
        startDocumentationInlineNew();
        return true;
      }

      editBlog();
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

      viewDocumentation(state.blogs.find(blog => blog.id === id));
      return true;
    }
    if (action === "export-blog") {
      openDocumentationExportDialog(state.blogs.find(blog => blog.id === id), { showToast });
      return true;
    }
    if (action === "edit-blog") {
      if (documentationViewMode === "tree") {
        startDocumentationInlineEdit(id);
        return true;
      }

      editBlog(state.blogs.find(blog => blog.id === id));
      return true;
    }
    if (action === "cancel-documentation-inline-edit") {
      editingTreeBlogId = 0;
      renderDocumentation();
      return true;
    }
    if (action === "save-documentation-inline-edit") {
      const form = app.querySelector("[data-documentation-inline-editor]");
      if (form) form.requestSubmit();
      return true;
    }
    if (action === "delete-blog") {
      if (selectedTreeBlogId === id) selectedTreeBlogId = 0;
      if (editingTreeBlogId === id) editingTreeBlogId = 0;
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
      writePreference(preferenceKeys.documentationProject, documentationProjectId);
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
      handleFilterChange(event.target);
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-reset-documentation-view]")) {
        applyDocumentationDefaultFilters();
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
      { value: "name", text: "Name (Alphabetically)" }
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
          ${visibilitySelect}
          ${groupSelect}
          ${sortSelect}
        </div>
      </div>
    `;
  }

  function viewDocumentation(blog) {
    if (!blog) return;
    const author = userById(blog.createdByUserId);
    const parent = state.blogs.find(item => item.id === blog.parentBlogId);

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
        <button type="button" class="secondary text-icon-button" data-edit-readonly-blog="${blog.id}" ${canEditOwner(blog.createdByUserId) ? "" : "disabled"}>${buttonContent("&#9998;", "Edit")}</button>
        <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
      </div>
    `;

    document.body.appendChild(modal);
    initializeWindowedDialog(modal);
    modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
      modal.close();
      modal.remove();
    }));
    modal.addEventListener("click", event => {
      const fullScreenButton = event.target.closest("[data-view-full-screen-readonly-blog]");
      if (fullScreenButton) {
        modal.close();
        modal.remove();
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

      const selectedBlog = state.blogs.find(item => item.id === Number(editButton.dataset.editReadonlyBlog));
      modal.close();
      modal.remove();
      editBlog(selectedBlog);
    });
    modal.addEventListener("cancel", () => modal.remove());
    modal.showModal();
    normalizeLinksInElement(modal);
    bindDocumentationBodyImageOpen(modal);
  }

  function openDocumentationFullScreen(blogId) {
    const blog = state.blogs.find(item => item.id === Number(blogId || 0));
    if (!blog) return;

    documentationViewMode = "tree";
    showDocumentationTreeFullScreen();

    writePreference(preferenceKeys.documentationViewMode, documentationViewMode);

    selectDocumentationTreeBlog(blog.id, { syncFilters: true });
  }

  function viewDocumentationById(blogId) {
    const blog = state.blogs.find(item => item.id === Number(blogId || 0));
    if (!blog) return false;

    if (documentationViewMode === "tree") {
      return selectDocumentationTreeBlog(blog.id, { syncFilters: true });
    }

    viewDocumentation(blog);
    return true;
  }

  function selectDocumentationTreeBlog(blogId, options = {}) {
    const blog = state.blogs.find(item => item.id === Number(blogId || 0));
    if (!blog) return false;

    if (options.syncFilters) {
      documentationProjectId = blog.projectId || 0;
      documentationTreeSearch = "";
      writePreference(preferenceKeys.documentationProject, documentationProjectId);
      writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
    }

    selectedTreeBlogId = blog.id;
    editingTreeBlogId = 0;
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
    writePreference(preferenceKeys.documentationViewMode, documentationViewMode);
    renderDocumentation();
    focusDocumentationInlineTitle();
  }

  function startDocumentationInlineEdit(blogId) {
    const blog = state.blogs.find(item => item.id === Number(blogId || 0));
    if (!blog) return;

    documentationViewMode = "tree";
    documentationProjectId = blog.projectId || 0;
    documentationTreeSearch = "";
    selectedTreeBlogId = blog.id;
    editingTreeBlogId = blog.id;
    expandDocumentationTreePath(blog);

    writePreference(preferenceKeys.documentationViewMode, documentationViewMode);
    writePreference(preferenceKeys.documentationProject, documentationProjectId);
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
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "Global" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${selectOptionsField("Sprint", "sprintId", documentationSprintOptions(selectedProjectId), selectedSprintId)}
        ${field("Title", "title", blog.title || "", "text")}
        ${selectOptionsField("Parent", "parentBlogId", documentationParentOptions(selectedProjectId, selectedSprintId, blog.id), blog.parentBlogId || "")}
        ${documentationPrivateField(blog)}
        ${documentationPinnedField(blog)}
        ${richTextField("bodyHtml", "Body", blog.bodyHtml || "")}
        <div class="field full">
          <label>Attachments</label>
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
        isPinned: documentationPinnedValue(root),
        bodyHtml: richValue(root, "bodyHtml")
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
      const result = await saveJson(isReplacement ? `/api/blogs/${payload.id}` : "/api/blogs", isReplacement ? "PUT" : "POST", payload);
      const savedBlogId = Number(result?.id || payload.id || 0);

      selectedTreeBlogId = savedBlogId;
      editingTreeBlogId = 0;
      documentationProjectId = payload.projectId || 0;
      documentationTreeSearch = "";
      writePreference(preferenceKeys.documentationProject, documentationProjectId);
      writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
      await loadState?.();

      const importedBlog = state.blogs.find(blog => blog.id === selectedTreeBlogId);
      if (importedBlog) expandDocumentationTreePath(importedBlog);

      renderDocumentation();
      const imageNote = imageResult.failed
        ? ` ${imageResult.failed} embedded image${imageResult.failed === 1 ? "" : "s"} could not be moved to uploads.`
        : "";
      showToast?.(`${isReplacement ? "Document imported and replaced." : "Document imported."}${imageNote}`);
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

  function bindDocumentationInlineEditor() {
    const form = app.querySelector("[data-documentation-inline-editor]");
    if (!form) return;

    const blog = documentationInlineEditorBlog(form);
    if (!blog) return;

    bindRichTextButtons?.(form);
    bindAttachmentPreview?.(form);
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
    return state.blogs.find(item => item.id === blogId);
  }

  function documentationInlineEditorHasChanges(form, blog) {
    const projectId = optionalNumberValue(form, "projectId");
    const sprintId = projectId ? optionalNumberValue(form, "sprintId") : null;

    return (projectId || null) !== (blog.projectId || null)
      || (sprintId || null) !== (blog.sprintId || null)
      || (optionalNumberValue(form, "parentBlogId") || null) !== (blog.parentBlogId || null)
      || value(form, "title") !== (blog.title || "")
      || documentationPrivateValue(form) !== documentationIsPrivateForForm(blog)
      || documentationPinnedValue(form) !== documentationIsPinnedForForm(blog)
      || richValue(form, "bodyHtml") !== normalizeRichHtml(blog.bodyHtml || "")
      || (form.querySelector("[name='attachments']")?.files?.length || 0) > 0;
  }

  async function saveDocumentationInlineEditor(form, options = {}) {
    const blogId = Number(form.dataset.blogId || 0);
    const isNewBlog = blogId === newDocumentationInlineBlogId || blogId <= 0;
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
        isPinned: documentationPinnedValue(form),
        bodyHtml: richValue(form, "bodyHtml")
      });
      const savedBlogId = Number(result?.id || blogId || 0);

      for (const file of form.querySelector("[name='attachments']")?.files || []) {
        await attachFile(`/api/blogs/${savedBlogId}/attachments`, file);
      }

      selectedTreeBlogId = options.selectedBlogIdAfterSave || savedBlogId;
      editingTreeBlogId = 0;
      documentationEntryProjectId = projectId || 0;
      documentationEntrySprintId = sprintId || 0;
      writePreference(preferenceKeys.documentationEntryProject, documentationEntryProjectId);
      writePreference(preferenceKeys.documentationEntrySprint, documentationEntrySprintId);
      await loadState?.();
      const selectedBlog = state.blogs.find(item => item.id === selectedTreeBlogId);
      if (selectedBlog) {
        documentationProjectId = selectedBlog.projectId || 0;
        documentationTreeSearch = "";
        expandDocumentationTreePath(selectedBlog);
        writePreference(preferenceKeys.documentationProject, documentationProjectId);
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
      app.querySelectorAll(".documentation-card").forEach(card => {
        const blogId = Number(card.dataset.id || 0);
        const expanded = expandedDocumentationCardIds.has(blogId);
        card.classList.toggle("is-expanded", expanded);
        card.classList.toggle("has-overflow", expanded || card.scrollHeight > card.clientHeight + 1);
      });
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

  return {
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
  const isPinned = documentationImportIsPinned(sourceDocument, existingBlog);

  return {
    id: targetBlogId,
    projectId,
    sprintId,
    parentBlogId,
    title,
    isPrivate,
    isPinned,
    bodyHtml
  };
}

function documentationImportExistingBlog(sourceDocument, { title, bodyHtml }) {
  const sourceBlogId = Number(sourceDocument?.id || 0);
  const sourceTitle = normalizeDocumentationImportText(sourceDocument?.title || title);
  const sourceBody = normalizeDocumentationImportText(documentationTextFromHtml(sourceDocument?.bodyHtml || bodyHtml));
  const editableBlogs = state.blogs.filter(blog => canEditOwner(blog.createdByUserId));
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

function documentationImportIsPinned(sourceDocument, existingBlog) {
  if (typeof sourceDocument?.isPinned === "boolean") return sourceDocument.isPinned;
  if (existingBlog) return Boolean(existingBlog.isPinned);
  return false;
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
    blog.id !== targetBlogId
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
  const selectedBlog = state.blogs.find(blog => blog.id === Number(selectedTreeBlogId || 0));
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
  documentationVisibilityFilter = "both";
  documentationTreeGroup = "all";
  documentationTreeSearch = "";
  documentationTreeSort = "latest";
  expandedDocumentationCardIds.clear();
  writePreference(preferenceKeys.documentationProject, documentationProjectId);
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
  const nextValue = documentationVisibilityModes.has(value) ? value : "both";
  if (nextValue === "admin-all" && !currentUser().isAdmin) return "both";
  return nextValue;
}

function documentationVisibilityOptions() {
  const options = [
    { value: "both", text: "Both" },
    { value: "private", text: "Private" },
    { value: "public", text: "Public" }
  ];

  if (currentUser().isAdmin) {
    options.push({ value: "admin-all", text: "All" });
  }

  return options;
}

function documentationBlogVisibleByPrivacyFilter(blog) {
  const isPrivate = blog.isPrivate !== false;
  const isOwner = documentationOwnedByCurrentUser(blog);

  if (documentationVisibilityFilter === "admin-all" && currentUser().isAdmin) return true;
  if (documentationVisibilityFilter === "private") return isPrivate && isOwner;
  if (documentationVisibilityFilter === "public") return !isPrivate;

  return !isPrivate || isOwner;
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

function documentationPinnedField(blog = {}) {
  return `
    <label class="inline-check field">
      <input name="isPinned" type="checkbox" ${documentationIsPinnedForForm(blog) ? "checked" : ""}>
      <span>Pinned</span>
    </label>
  `;
}

function documentationPrivateValue(root) {
  return root.querySelector("[name='isPrivate']")?.checked ?? true;
}

function documentationPinnedValue(root) {
  return root.querySelector("[name='isPinned']")?.checked ?? false;
}

function documentationIsPrivateForForm(blog = {}) {
  return blog?.id ? blog.isPrivate !== false : true;
}

function documentationIsPinnedForForm(blog = {}) {
  return blog?.id ? Boolean(blog.isPinned) : false;
}

function documentationCardBlogs() {
  const searchText = documentationSearchText();
  return state.blogs
    .filter(documentationBlogVisibleByPrivacyFilter)
    .filter(blog => !documentationProjectId || blog.projectId === documentationProjectId)
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
  const byId = new Map(state.blogs.map(item => [item.id, item]));
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
    .filter(blog => !documentationProjectId || blog.projectId === documentationProjectId);
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

  if (documentationTreeGroup === "all") {
    return documentationDocumentsHtml(blogs, 0, "all");
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

  return globalFolder + projectFolders || `<div class="empty">No documents match the tree filters.</div>`;
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
    <div class="documentation-tree-row documentation-tree-document-row ${selected ? "is-selected" : ""}" style="--tree-depth:${depth}" role="treeitem" aria-selected="${selected}" ${hasChildren ? `aria-expanded="${!collapsed}"` : ""}>
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
    && (blog.id === newDocumentationInlineBlogId || canEditOwner(blog.createdByUserId))
  ) return documentationTreeInlineEditorHtml(blog);

  const wasEdited = documentationWasEdited(blog);
  const parent = state.blogs.find(item => item.id === blog.parentBlogId);

  return `
    <div class="documentation-tree-preview-head">
      <div class="documentation-tree-preview-title">
        <h2>${escapeHtml(blog.title)}</h2>
        <div class="documentation-tree-preview-meta">
          <span>${escapeHtml(documentationProjectLabel(blog.projectId))}</span>
          ${blog.sprintId ? `<span>${escapeHtml(sprintName(blog.sprintId))}</span>` : ""}
          ${parent ? `<span>Parent: ${escapeHtml(parent.title)}</span>` : ""}
          <span>${wasEdited ? "Updated" : "Created"} ${escapeHtml(formatDate(wasEdited ? blog.updatedAt : blog.createdAt))}</span>
        </div>
      </div>
      <div class="toolbar documentation-tree-preview-actions">
        ${iconButton("delete-blog", blog.id, "Delete", "delete", canEditOwner(blog.createdByUserId), "danger")}
        <button class="icon-action" type="button" data-action="export-blog" data-id="${blog.id}" title="Export" aria-label="Export"><span class="button-icon" aria-hidden="true">${documentationExportIconHtml()}</span></button>
        ${iconButton("edit-blog", blog.id, "Edit", "edit", canEditOwner(blog.createdByUserId))}
      </div>
    </div>
    <div class="rich-readonly documentation-tree-preview-body documentation-image-open-area" ${documentationRichPersistAttrs(blog)}>${blog.bodyHtml || ""}</div>
    ${blog.attachments.length ? `<div class="documentation-attachments">${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>` : ""}
  `;
}

function documentationTreeInlineEditorHtml(blog) {
  const isNewBlog = blog.id === newDocumentationInlineBlogId;
  const wasEdited = documentationWasEdited(blog);
  const parent = state.blogs.find(item => item.id === blog.parentBlogId);
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
    <form class="documentation-inline-editor" data-documentation-inline-editor data-blog-id="${blog.id}">
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
        ${field("Title", "title", blog.title || "", "text")}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "Global" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], selectedProjectId)}
        ${selectOptionsField("Sprint", "sprintId", documentationSprintOptions(selectedProjectId), selectedSprintId)}
        ${selectOptionsField("Parent", "parentBlogId", documentationParentOptions(selectedProjectId, selectedSprintId, blog.id), blog.parentBlogId || "")}
        ${documentationPrivateField(blog)}
        ${documentationPinnedField(blog)}
      </div>
      <div class="field full documentation-inline-body-field">
        <label>Body</label>
        ${richTextToolsHtml({ actionsHtml: documentationInlineRichTextActionsHtml() })}
        <div class="rich-editor documentation-inline-body-editor documentation-image-open-area" contenteditable="true" data-rich="bodyHtml">${blog.bodyHtml || ""}</div>
      </div>
      <div class="field full documentation-inline-attachments">
        <label>Attachments</label>
        ${blog.attachments.length ? `<div class="documentation-attachments">${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>` : ""}
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
          ${iconButton("delete-blog", blog.id, "Delete", "delete", canEditOwner(blog.createdByUserId), "danger")}
          ${iconButton("edit-blog", blog.id, "Edit", "edit", canEditOwner(blog.createdByUserId))}
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
    blog.isPinned ? documentationCardIndicatorHtml("Pinned", documentationPinIconHtml()) : "",
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

function documentationPinIconHtml() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 3h6l-1 6 4 4v2h-5v6h-2v-6H6v-2l4-4z"></path>
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
        !excludedIds.has(blog.id)
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
    state.blogs.forEach(blog => {
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
  if (documentationTreeSort === "name") {
    return a.title.localeCompare(b.title) || a.id - b.id;
  }

  const left = Date.parse(a.updatedAt || a.createdAt || "") || 0;
  const right = Date.parse(b.updatedAt || b.createdAt || "") || 0;
  const dateCompare = documentationTreeSort === "oldest" ? left - right : right - left;
  return dateCompare || a.title.localeCompare(b.title) || a.id - b.id;
}

function documentationCardBlogCompare(a, b) {
  if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
    return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
  }

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
