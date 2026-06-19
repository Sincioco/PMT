import { attachmentsHtml } from "../../components/attachments.js";
import { buttonContent, iconButton } from "../../components/buttons.js";
import { filterSelect } from "../../components/filters.js";
import {
  field,
  optionalNumberValue,
  richTextField,
  richValue,
  selectOptionsField,
  value
} from "../../components/forms.js";
import { sectionHead } from "../../components/sections.js";
import {
  preferenceKeys,
  readNumberPreference,
  writePreference
} from "../../core/preferences.js";
import { state } from "../../core/store.js";
import {
  documentationDateLine,
  documentationWasEdited,
  formatDate
} from "../../shared/dates.js";
import { canEditOwner } from "../../shared/permissions.js";
import {
  projectById,
  projectCode,
  userById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml,
  normalizeLinksInElement
} from "../../shared/text-and-links.js";

export function createDocumentationFeature({
  app,
  attachFile,
  deleteItem,
  openEditor,
  saveJson
}) {
  let documentationProjectId = readNumberPreference(preferenceKeys.documentationProject, 0);

  function renderDocumentation() {
    if (documentationProjectId && !projectById(documentationProjectId)) documentationProjectId = 0;

    const filteredBlogs = state.blogs.filter(blog => !documentationProjectId || blog.projectId === documentationProjectId);

    app.innerHTML = `
      ${sectionHead("Documentation", `<button class="primary text-icon-button" type="button" data-action="new-blog">${buttonContent("&#10010;", "New Document")}</button>`)}
      <div class="panel documentation-filter-panel">
        <div class="filter-row">
          ${filterSelect("Project", "documentation-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), documentationProjectId || "", "All Projects")}
        </div>
      </div>
      <div class="grid documentation-grid">
        ${filteredBlogs.length ? filteredBlogs.map(blog => `
          <article class="card clickable-card documentation-card" data-action="view-blog" data-id="${blog.id}">
            <div class="spread documentation-card-head">
              <div class="documentation-title-block">
                <h3>${escapeHtml(blog.title)}</h3>
                <p class="muted documentation-meta">${escapeHtml(userById(blog.createdByUserId)?.nickname || "User")} | ${documentationDateLine(blog)}</p>
              </div>
              <div class="row documentation-project">
                ${blog.projectId ? `<span class="pill">${escapeHtml(projectCode(blog.projectId))}</span>` : `<span class="pill">General</span>`}
              </div>
            </div>
            <div class="rich-readonly documentation-card-body">${blog.bodyHtml}</div>
            ${blog.attachments.length ? `<div class="documentation-attachments">${blog.attachments.map(file => `<a href="${escapeAttr(file.url)}">${escapeHtml(file.fileName)}</a>`).join("")}</div>` : ""}
            <div class="toolbar reveal-actions documentation-actions">
              ${iconButton("delete-blog", blog.id, "Delete", "delete", canEditOwner(blog.createdByUserId), "danger")}
              ${iconButton("edit-blog", blog.id, "Edit", "edit", canEditOwner(blog.createdByUserId))}
            </div>
          </article>
        `).join("") : `<div class="empty">No Documentation exists for the selected project.</div>`}
      </div>
    `;
  }

  async function handleAction(action, id) {
    if (action === "new-blog") {
      editBlog();
      return true;
    }
    if (action === "view-blog") {
      viewDocumentation(state.blogs.find(blog => blog.id === id));
      return true;
    }
    if (action === "edit-blog") {
      editBlog(state.blogs.find(blog => blog.id === id));
      return true;
    }
    if (action === "delete-blog") {
      await deleteItem(`/api/blogs/${id}`, "Delete this document?");
      return true;
    }

    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    if (target?.dataset?.filter !== "documentation-project") return false;

    documentationProjectId = Number(target.value || 0);
    writePreference(preferenceKeys.documentationProject, documentationProjectId);
    renderDocumentation();
    return true;
  }

  function viewDocumentation(blog) {
    if (!blog) return;
    const author = userById(blog.createdByUserId);

    const modal = document.createElement("dialog");
    modal.className = "dialog detail-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>${escapeHtml(blog.title)}</h2>
        <button type="button" class="icon-btn" data-close title="Close">x</button>
      </div>
      <div class="dialog-body">
        <div class="detail-grid">
          ${detailField("Project", escapeHtml(projectCode(blog.projectId)))}
          ${detailField("Created", escapeHtml(formatDate(blog.createdAt)))}
          ${documentationWasEdited(blog) ? detailField("Last Edited", escapeHtml(formatDate(blog.updatedAt))) : ""}
          ${detailField("Author", escapeHtml(author?.nickname || "User"))}
          ${detailField("Body", `<div class="rich-readonly">${blog.bodyHtml || ""}</div>`, true)}
          ${blog.attachments.length ? detailField("Attachments", attachmentsHtml(blog.attachments), true) : ""}
        </div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-edit-readonly-blog="${blog.id}" ${canEditOwner(blog.createdByUserId) ? "" : "disabled"}>${buttonContent("&#9998;", "Edit")}</button>
        <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
      modal.close();
      modal.remove();
    }));
    modal.addEventListener("click", event => {
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
  }

  function editBlog(blog = {}) {
    openEditor(blog.id ? "Edit Document" : "New Document", `
      <div class="form-grid">
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], blog.projectId || "")}
        ${field("Title", "title", blog.title || "", "text")}
        ${richTextField("bodyHtml", "Body", blog.bodyHtml || "")}
        <div class="field full">
          <label>Attachments</label>
          <input name="attachments" type="file" multiple>
          <div class="attachment-preview" data-preview="attachments"></div>
        </div>
      </div>
    `, async root => {
      const result = await saveJson(blog.id ? `/api/blogs/${blog.id}` : "/api/blogs", blog.id ? "PUT" : "POST", {
        id: blog.id || 0,
        projectId: optionalNumberValue(root, "projectId"),
        title: value(root, "title"),
        bodyHtml: richValue(root, "bodyHtml")
      });

      for (const file of root.querySelector("[name='attachments']").files) {
        await attachFile(`/api/blogs/${result.id}/attachments`, file);
      }
    });
  }

  function detailField(label, html, full = false) {
    return `
      <div class="detail-field ${full ? "full" : ""}">
        <span>${escapeHtml(label)}</span>
        <div>${html || `<span class="muted">None</span>`}</div>
      </div>
    `;
  }

  return {
    handleAction,
    handleFilterChange,
    render: renderDocumentation
  };
}
