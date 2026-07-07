import { attachmentsHtml } from "../../components/attachments.js";
import { buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260706-dialog-persistence";
import { filterSelect } from "../../components/filters.js";
import {
  documentationExportIconHtml,
  openDocumentationExportDialog
} from "./documentation-export.js?v=20260706-export-dialog-icons";
import {
  field,
  optionalNumberValue,
  richTextField,
  richTextToolsHtml,
  richValue,
  selectOptionsField,
  value
} from "../../components/forms.js?v=20260701-documentation-inline-edit";
import { sectionHead } from "../../components/sections.js?v=20260701-nav-title-preferences";
import {
  preferenceKeys,
  readBooleanPreference,
  readNumberPreference,
  readPreference,
  writePreference
} from "../../core/preferences.js?v=20260701-documentation-tree";
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

const documentationViewModes = new Set(["cards", "tree"]);
const documentationTreeGroups = new Set(["project-sprint", "project", "all"]);
const documentationTreeLayouts = new Set(["hierarchy", "flat"]);
const documentationTreeSorts = new Set(["latest", "oldest"]);
let documentationProjectId = 0;
let documentationEntryProjectId = 0;
let documentationEntrySprintId = 0;
let documentationViewMode = "cards";
let documentationTreeGroup = "project-sprint";
let documentationTreeLayout = "hierarchy";
let documentationTreeSort = "latest";
let documentationTreeSearch = "";
let documentationTreePaneWidth = 320;
let documentationTreePaneHidden = false;
let selectedTreeBlogId = 0;
let editingTreeBlogId = 0;
const collapsedTreeKeys = new Set();

export function createDocumentationFeature({
  app,
  attachFile,
  bindAttachmentPreview,
  bindRichTextButtons,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast
}) {
  documentationProjectId = readNumberPreference(preferenceKeys.documentationProject, 0);
  documentationEntryProjectId = readNumberPreference(preferenceKeys.documentationEntryProject, 0);
  documentationEntrySprintId = readNumberPreference(preferenceKeys.documentationEntrySprint, 0);
  documentationViewMode = readKnownPreference(preferenceKeys.documentationViewMode, "cards", documentationViewModes);
  documentationTreeGroup = readKnownPreference(preferenceKeys.documentationTreeGroup, "project-sprint", documentationTreeGroups);
  documentationTreeLayout = readKnownPreference(preferenceKeys.documentationTreeLayout, "hierarchy", documentationTreeLayouts);
  documentationTreeSort = readKnownPreference(preferenceKeys.documentationTreeSort, "latest", documentationTreeSorts);
  documentationTreeSearch = readPreference(preferenceKeys.documentationTreeSearch, "");
  documentationTreePaneWidth = Math.min(560, Math.max(220, readNumberPreference(preferenceKeys.documentationTreePaneWidth, 320)));
  documentationTreePaneHidden = readBooleanPreference(preferenceKeys.documentationTreePaneHidden, false);

  function renderDocumentation() {
    if (documentationProjectId && !projectById(documentationProjectId)) documentationProjectId = 0;

    const filteredBlogs = state.blogs.filter(blog => !documentationProjectId || blog.projectId === documentationProjectId);

    app.innerHTML = `<div class="documentation-screen ${documentationViewMode === "tree" ? "is-tree-view" : "is-card-view"}">
      ${sectionHead("Documentation", documentationHeaderActionsHtml())}
      ${documentationViewMode === "tree" ? documentationTreeViewHtml() : documentationCardViewHtml(filteredBlogs)}
    </div>`;

    if (documentationViewMode === "tree") {
      bindDocumentationTreeSplitter();
      bindDocumentationInlineEditor();
      bindDocumentationBodyImageOpen(app);
    }
  }

  function documentationHeaderActionsHtml() {
    return `
      <button class="secondary text-icon-button ${documentationViewMode === "cards" ? "is-on" : ""}" type="button" data-action="set-documentation-view" data-mode="cards" aria-pressed="${documentationViewMode === "cards"}">
        ${buttonContent("&#9638;", "Cards")}
      </button>
      <button class="secondary text-icon-button ${documentationViewMode === "tree" ? "is-on" : ""}" type="button" data-action="set-documentation-view" data-mode="tree" aria-pressed="${documentationViewMode === "tree"}">
        ${buttonContent("&#9776;", "Tree")}
      </button>
      <button class="secondary text-icon-button" type="button" data-action="open-documentation-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">
        ${buttonContent(funnelIconHtml(), "Filters")}
      </button>
      ${documentationViewMode === "tree" ? `
        <button class="secondary text-icon-button" type="button" data-action="toggle-documentation-tree-pane" aria-pressed="${documentationTreePaneHidden}">
          ${buttonContent(documentationTreePaneHidden ? "&#9776;" : "&#10005;", documentationTreePaneHidden ? "Show Tree" : "Hide Tree")}
        </button>
      ` : ""}
      <button class="primary text-icon-button" type="button" data-action="new-blog">${buttonContent("&#10010;", "New Document")}</button>
    `;
  }

  function documentationCardViewHtml(filteredBlogs) {
    return `
      <div class="grid documentation-grid">
        ${filteredBlogs.length ? filteredBlogs.map(documentationCardHtml).join("") : `<div class="empty">No Documentation exists for the selected project.</div>`}
      </div>
    `;
  }

  function documentationTreeViewHtml() {
    const visibleBlogs = documentationTreeBlogs();
    const visibleIds = new Set(visibleBlogs.map(blog => blog.id));
    if (!visibleIds.has(selectedTreeBlogId)) selectedTreeBlogId = visibleBlogs[0]?.id || 0;
    if (!visibleIds.has(editingTreeBlogId)) editingTreeBlogId = 0;
    const selectedBlog = state.blogs.find(blog => blog.id === selectedTreeBlogId && visibleIds.has(blog.id));
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
    if (action === "select-documentation-tree-blog") {
      if (editingTreeBlogId && editingTreeBlogId !== id) {
        await handleDocumentationTreeSelectionWhileEditing(id);
        return true;
      }

      selectedTreeBlogId = id;
      renderDocumentation();
      return true;
    }
    if (action === "new-blog") {
      editBlog();
      return true;
    }
    if (action === "view-blog") {
      viewDocumentation(state.blogs.find(blog => blog.id === id));
      return true;
    }
    if (action === "export-blog") {
      openDocumentationExportDialog(state.blogs.find(blog => blog.id === id), { showToast });
      return true;
    }
    if (action === "edit-blog") {
      if (documentationViewMode === "tree") {
        selectedTreeBlogId = id;
        editingTreeBlogId = id;
        renderDocumentation();
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

    if (filter === "documentation-tree-search") {
      documentationTreeSearch = target.value || "";
      writePreference(preferenceKeys.documentationTreeSearch, documentationTreeSearch);
      renderDocumentation();
      return true;
    }

    if (filter === "documentation-tree-group") {
      documentationTreeGroup = documentationTreeGroups.has(target.value) ? target.value : "project-sprint";
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
          <button type="button" class="icon-btn" data-close-documentation-filters title="Close" aria-label="Close">x</button>
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
    if (documentationViewMode === "tree") {
      return `
        <div class="tasks-filter-panel documentation-filter-fields">
          <div class="task-filter-row documentation-filter-row">
            <label>
              <span>Search</span>
              <input data-filter="documentation-tree-search" type="search" value="${escapeAttr(documentationTreeSearch)}">
            </label>
            ${filterSelect("Project", "documentation-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), documentationProjectId || "", "All Projects")}
            ${documentationTreeSelect("Group", "documentation-tree-group", [
              { value: "project-sprint", text: "Project and Sprint" },
              { value: "project", text: "Project Only" },
              { value: "all", text: "All Documents" }
            ], documentationTreeGroup)}
            ${documentationTreeSelect("Layout", "documentation-tree-layout", [
              { value: "hierarchy", text: "Hierarchy" },
              { value: "flat", text: "Flat" }
            ], documentationTreeLayout)}
            ${documentationTreeSelect("Sort", "documentation-tree-sort", [
              { value: "latest", text: "Latest First" },
              { value: "oldest", text: "Oldest First" }
            ], documentationTreeSort)}
          </div>
        </div>
      `;
    }

    return `
      <div class="tasks-filter-panel documentation-filter-fields">
        <div class="task-filter-row documentation-filter-row">
          ${filterSelect("Project", "documentation-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), documentationProjectId || "", "All Projects")}
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
          ${detailField("Body", `<div class="rich-readonly documentation-image-open-area">${blog.bodyHtml || ""}</div>`, true)}
          ${blog.attachments.length ? detailField("Attachments", attachmentsHtml(blog.attachments), true) : ""}
        </div>
      </div>
      <div class="dialog-actions documentation-readonly-actions">
        <button type="button" class="secondary text-icon-button documentation-dialog-export-button" data-export-readonly-blog="${blog.id}">${buttonContent(documentationExportIconHtml(), "Export")}</button>
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

  function viewDocumentationById(blogId) {
    const blog = state.blogs.find(item => item.id === Number(blogId || 0));
    if (!blog) return false;

    viewDocumentation(blog);
    return true;
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
        ${selectOptionsField("Parent", "parentBlogId", documentationParentOptions(selectedProjectId, selectedSprintId, blog.id), blog.parentBlogId || "")}
        ${field("Title", "title", blog.title || "", "text")}
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

    const blog = state.blogs.find(item => item.id === Number(form.dataset.blogId || 0));
    if (!blog) return;

    bindRichTextButtons?.(form);
    bindAttachmentPreview?.(form);
    bindDocumentationEditorRules(form, blog);
    bindDocumentationBodyImageOpen(form);

    form.addEventListener("submit", async event => {
      event.preventDefault();
      await saveDocumentationInlineEditor(form);
    });
  }

  async function handleDocumentationTreeSelectionWhileEditing(nextBlogId) {
    const form = app.querySelector("[data-documentation-inline-editor]");
    const blog = state.blogs.find(item => item.id === editingTreeBlogId);

    if (!form || !blog || !documentationInlineEditorHasChanges(form, blog)) {
      selectedTreeBlogId = nextBlogId;
      editingTreeBlogId = 0;
      renderDocumentation();
      return;
    }

    const result = await askDocumentationUnsavedAction();
    if (result === "save") {
      await saveDocumentationInlineEditor(form, { selectedBlogIdAfterSave: nextBlogId });
      return;
    }

    if (result === "discard") {
      selectedTreeBlogId = nextBlogId;
      editingTreeBlogId = 0;
      renderDocumentation();
    }
  }

  function documentationInlineEditorHasChanges(form, blog) {
    const projectId = optionalNumberValue(form, "projectId");
    const sprintId = projectId ? optionalNumberValue(form, "sprintId") : null;

    return (projectId || null) !== (blog.projectId || null)
      || (sprintId || null) !== (blog.sprintId || null)
      || (optionalNumberValue(form, "parentBlogId") || null) !== (blog.parentBlogId || null)
      || value(form, "title") !== (blog.title || "")
      || richValue(form, "bodyHtml") !== normalizeRichHtml(blog.bodyHtml || "")
      || (form.querySelector("[name='attachments']")?.files?.length || 0) > 0;
  }

  async function saveDocumentationInlineEditor(form, options = {}) {
    const blogId = Number(form.dataset.blogId || 0);
    const projectId = optionalNumberValue(form, "projectId");
    const sprintId = projectId ? optionalNumberValue(form, "sprintId") : null;

    try {
      const result = await saveJson(`/api/blogs/${blogId}`, "PUT", {
        id: blogId,
        projectId,
        sprintId,
        parentBlogId: optionalNumberValue(form, "parentBlogId"),
        title: value(form, "title"),
        bodyHtml: richValue(form, "bodyHtml")
      });

      for (const file of form.querySelector("[name='attachments']")?.files || []) {
        await attachFile(`/api/blogs/${blogId}/attachments`, file);
      }

      selectedTreeBlogId = options.selectedBlogIdAfterSave || result?.id || blogId;
      editingTreeBlogId = 0;
      await loadState?.();
      if (render) {
        render();
      } else {
        renderDocumentation();
      }
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

  return {
    handleAction,
    handleFilterChange,
    render: renderDocumentation,
    view: viewDocumentationById
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

function documentationTreeBlogs() {
  const searchText = documentationSearchText();
  const sourceBlogs = state.blogs.filter(blog => !documentationProjectId || blog.projectId === documentationProjectId);
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
  if (editingTreeBlogId === blog.id && canEditOwner(blog.createdByUserId)) return documentationTreeInlineEditorHtml(blog);

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
    <div class="rich-readonly documentation-tree-preview-body documentation-image-open-area">${blog.bodyHtml || ""}</div>
    ${blog.attachments.length ? `<div class="documentation-attachments">${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>` : ""}
  `;
}

function documentationTreeInlineEditorHtml(blog) {
  const wasEdited = documentationWasEdited(blog);
  const parent = state.blogs.find(item => item.id === blog.parentBlogId);
  const selectedProjectId = blog.projectId || "";
  const selectedSprintId = blog.sprintId || "";

  return `
    <form class="documentation-inline-editor" data-documentation-inline-editor data-blog-id="${blog.id}">
      <div class="documentation-tree-preview-head documentation-inline-editor-head">
        <div class="documentation-tree-preview-title documentation-inline-title">
          <h2>${escapeHtml(blog.title || "Edit Document")}</h2>
          <div class="documentation-tree-preview-meta">
            <span>${escapeHtml(documentationProjectLabel(blog.projectId))}</span>
            ${blog.sprintId ? `<span>${escapeHtml(sprintName(blog.sprintId))}</span>` : ""}
            ${parent ? `<span>Parent: ${escapeHtml(parent.title)}</span>` : ""}
            <span>${wasEdited ? "Updated" : "Created"} ${escapeHtml(formatDate(wasEdited ? blog.updatedAt : blog.createdAt))}</span>
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
      </div>
      <div class="field full documentation-inline-body-field">
        <label>Body</label>
        ${richTextToolsHtml()}
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

function documentationCardHtml(blog) {
  const wasEdited = documentationWasEdited(blog);

  return `
    <article class="card clickable-card documentation-card" data-action="view-blog" data-id="${blog.id}" title="${escapeAttr(blog.title)}">
      <div class="documentation-card-top">
        <div class="documentation-card-title-row">
          <div class="documentation-title-block">
            <h3>${escapeHtml(blog.title)}</h3>
          </div>
          <div class="row documentation-project">
            ${blog.projectId ? `<span class="pill">${escapeHtml(projectCode(blog.projectId))}</span>` : `<span class="pill">General</span>`}
          </div>
        </div>
        ${wasEdited ? documentationEditedMetaHtml(blog) : documentationCreatedMetaHtml(blog)}
      </div>
      <div class="rich-readonly documentation-card-body">${blog.bodyHtml}</div>
      ${blog.attachments.length ? `<div class="documentation-attachments">${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>` : ""}
      <div class="documentation-card-bottom ${wasEdited ? "" : "has-top-created-meta"}">
        ${wasEdited ? documentationCreatedMetaHtml(blog) : ""}
        <div class="toolbar reveal-actions documentation-actions">
          ${iconButton("delete-blog", blog.id, "Delete", "delete", canEditOwner(blog.createdByUserId), "danger")}
          ${iconButton("edit-blog", blog.id, "Edit", "edit", canEditOwner(blog.createdByUserId))}
        </div>
      </div>
    </article>
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
  const left = Date.parse(a.updatedAt || a.createdAt || "") || 0;
  const right = Date.parse(b.updatedAt || b.createdAt || "") || 0;
  const dateCompare = documentationTreeSort === "oldest" ? left - right : right - left;
  return dateCompare || a.title.localeCompare(b.title) || a.id - b.id;
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
