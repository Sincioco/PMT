import { attachmentsHtml, filePreviewHtml } from "./attachments.js";
import { avatarsHtml } from "./avatars.js";
import { buttonContent, iconButton } from "./buttons.js?v=20260621-dev-task-icons";
import { initializeWindowedDialog } from "./dialogs.js?v=20260706-dialog-persistence";
import {
  checkListOrEmpty,
  checkedNumbers,
  userCardCheckListLabelHtml
} from "./forms.js?v=20260629-avatar-jpg-assets";
import { state } from "../core/store.js";
import { formatDateTime } from "../shared/dates.js";
import { canEditTask } from "../shared/permissions.js";
import {
  projectById,
  projectName,
  sprintById,
  sprintName,
  taskById,
  userById
} from "../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml,
  normalizeLinksInElement,
  normalizeUrl
} from "../shared/text-and-links.js";
import {
  allowedAssigneeUsers,
  taskDisplayPercent
} from "../shared/work-item-rules.js?v=20260707-linked-bug-qa-sync";

export function taskButtonsHtml(task, { includeView = true, monochrome = false } = {}) {
  const canEdit = canEditTask(task);
  return `
    ${iconButton("delete-task", task.id, "Delete", monochrome ? "delete-monochrome" : "delete", canEdit, monochrome ? "" : "danger")}
    ${iconButton("duplicate-task", task.id, "Duplicate", "duplicate", canEdit)}
    ${iconButton("show-task-audit", task.id, "Audit Log", monochrome ? "audit-monochrome" : "audit", true)}
    ${includeView ? iconButton("view-task", task.id, "View", "view", true) : ""}
    ${iconButton("edit-task", task.id, "Edit", "edit", canEdit)}
  `;
}

export function taskDragHandleHtml(task) {
  if (!canEditTask(task)) return "";
  return `<button type="button" class="work-item-drag-handle" data-drag-handle title="Drag to reorder" aria-label="Drag to reorder"><span aria-hidden="true">&#8942;&#8942;</span></button>`;
}

export function createWorkItemTableMode({
  action,
  itemLabel,
  initialActive = false
}) {
  let active = initialActive;

  return {
    get active() {
      return active;
    },
    buttonHtml() {
      const modeLabel = active ? "Done" : "Edit Mode";
      const title = active ? "Finish editing table" : "Edit table";

      return `
        <button
          class="secondary text-icon-button work-item-table-mode-toggle"
          type="button"
          data-action="${escapeAttr(action)}"
          title="${title}"
          aria-label="${active ? `Finish editing ${escapeAttr(itemLabel)} table` : `Edit ${escapeAttr(itemLabel)} table`}"
          aria-pressed="${active}">
          ${buttonContent(active ? "&#10003;" : "&#9998;", modeLabel)}
        </button>
      `;
    },
    deactivate() {
      active = false;
    },
    activate() {
      active = true;
    },
    toggle() {
      active = !active;
    }
  };
}

export function taskAuditPanelHtml(task) {
  return `
    <template data-editor-footer-action>
      <button type="button" class="secondary text-icon-button" data-action="show-task-audit" data-id="${task.id}">${buttonContent("&#128221;", "Audit Log")}</button>
    </template>
  `;
}

export function bugFixIconHtml(task) {
  if (task.taskType === "Bug" || !task.linkedBugTaskId) return "";
  return `<span class="bug-fix-icon" title="Bug Fix">&#128027;</span>`;
}

export function taskPercentField(task, isLocked) {
  const percent = taskDisplayPercent({ ...task, subTasks: isLocked ? task.subTasks : [] });

  return `
    <div class="field">
      <label>Percent</label>
      <input name="percentCompleted" type="number" min="0" max="100" value="${escapeAttr(percent)}" ${isLocked ? `disabled data-locked="true"` : ""}>
      ${isLocked ? `<small class="field-note">Calculated from sub-tasks.</small>` : ""}
    </div>
  `;
}

export function attachmentEditorFieldHtml() {
  return `
    <div class="field full">
      <label>Attachments</label>
      <input name="attachments" type="file" multiple>
      <div class="attachment-preview" data-preview="attachments"></div>
    </div>
  `;
}

export function bindAttachmentPreview(root) {
  root.querySelectorAll("input[type='file']").forEach(input => {
    input.addEventListener("change", () => {
      const preview = input.closest(".field")?.querySelector("[data-preview]");
      if (!preview) return;
      preview.innerHTML = [...input.files].map(filePreviewHtml).join("");
    });
  });
}

export async function uploadWorkItemAttachments(root, workItemId, attachFile, attachmentPath = `/api/tasks/${workItemId}/attachments`) {
  for (const file of root.querySelector("[name='attachments']")?.files || []) {
    await attachFile(attachmentPath, file);
  }
}

export function bindAssigneeList(root, initialSelectedIds, label = "Assignees") {
  const projectSelect = root.querySelector("[name='projectId']");
  const sprintSelect = root.querySelector("[name='sprintId']");
  const container = root.querySelector("[data-assignee-list]");
  if (!projectSelect || !container) return;

  let firstRender = true;
  const renderAssignees = () => {
    const selectedIds = firstRender ? initialSelectedIds : checkedNumbers(root, "assigneeIds");
    firstRender = false;
    const project = projectById(Number(projectSelect.value));
    const sprint = sprintSelect?.value ? sprintById(Number(sprintSelect.value)) : null;
    container.innerHTML = checkListOrEmpty(
      label,
      "assigneeIds",
      allowedAssigneeUsers(state.users, project, sprint),
      selectedIds,
      "Only project or Sprint members can be assigned.",
      { className: "scroll-check-list user-card-check-list", renderItem: userCardCheckListLabelHtml }
    );
  };

  projectSelect.addEventListener("change", () => {
    refreshSprintOptions(root, Number(projectSelect.value));
    renderAssignees();
  });
  sprintSelect?.addEventListener("change", renderAssignees);
  renderAssignees();
}

export function refreshSprintOptions(root, projectId) {
  const sprintSelect = root.querySelector("[name='sprintId']");
  if (!sprintSelect) return;

  const selectedSprintId = Number(sprintSelect.value || 0);
  const projectSprints = state.sprints.filter(sprint => sprint.projectId === projectId);
  const selectedSprintStillValid = projectSprints.some(sprint => sprint.id === selectedSprintId);
  const nextSelectedId = selectedSprintStillValid ? selectedSprintId : "";

  sprintSelect.innerHTML = [
    `<option value="">No Sprint</option>`,
    ...projectSprints.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(nextSelectedId) ? "selected" : ""}>${escapeHtml(sprint.code)}</option>`)
  ].join("");
}

export function viewWorkItem(task, editWorkItem, options = {}) {
  if (!task) return;
  const canEdit = options.canEdit ?? canEditTask(task);
  const linkedDocumentHtml = workItemLinkedDocumentHtml(task.linkedBlogId);
  const canConvertToDocument = Boolean(
    options.onConvertToDocument
    && canEdit
    && (task.taskType === "Dev" || task.taskType === "Bug")
    && !task.linkedBlogId
    && richTextHasContent(task.descriptionHtml)
  );
  const dependencies = (task.dependencyTaskIds || [])
    .map(id => taskById(id))
    .filter(Boolean);
  if (task.taskType === "Bug") {
    state.tasks
      .filter(item => item.taskType !== "Bug" && item.linkedBugTaskId === task.id)
      .forEach(item => {
        if (!dependencies.some(dependency => dependency.id === item.id)) dependencies.push(item);
      });
  }
  const dependencyLinks = dependencies
    .map(item => `<button type="button" data-action="view-task-inline" data-id="${item.id}">${escapeHtml(item.code)}</button>`)
    .join(" ");

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog";
  const dialogTitle = [task.code, task.title].filter(Boolean).join(" - ");
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(dialogTitle)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      <div class="detail-grid">
        ${detailField("Title", escapeHtml(task.title))}
        ${detailField("Type", escapeHtml(task.taskType || "Dev"))}
        ${detailField("Project", escapeHtml(projectName(task.projectId)))}
        ${detailField("Sprint", escapeHtml(sprintName(task.sprintId)))}
        ${detailField("Status", escapeHtml(task.status))}
        ${detailField("Priority", escapeHtml(task.priority))}
        ${task.taskType === "Bug" ? detailField("Environment", escapeHtml(task.environment || "")) : ""}
        ${task.taskType === "Bug" ? detailField("Severity", escapeHtml(task.severity || "")) : ""}
        ${task.taskType === "Bug" ? detailField("Reporter", avatarsHtml(task.reporters)) : ""}
        ${detailField("Assignee", avatarsHtml(task.assignees))}
        ${detailField("Percent", `${taskDisplayPercent(task)}%`)}
        ${task.url ? detailField("URL", `<a href="${escapeAttr(normalizeUrl(task.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(task.url)}</a>`) : ""}
        ${dependencyLinks ? detailField("Dependencies", dependencyLinks) : ""}
        ${linkedDocumentHtml ? detailField("Document", linkedDocumentHtml) : ""}
        ${detailField("Description", `<div class="rich-readonly">${task.descriptionHtml || ""}</div>`, true)}
        ${task.taskType === "Bug" ? detailField("Steps to Reproduce", `<div class="rich-readonly">${task.stepsToReproduceHtml || ""}</div>`, true) : ""}
        ${task.taskType === "Bug" ? detailField("Actual Result", `<div class="rich-readonly">${task.actualResultHtml || ""}</div>`, true) : ""}
        ${task.taskType === "Bug" ? detailField("Expected Result", `<div class="rich-readonly">${task.expectedResultHtml || ""}</div>`, true) : ""}
        ${task.attachments.length ? detailField("Attachments", attachmentsHtml(task.attachments), true) : ""}
      </div>
      ${workItemDialogMetaHtml(task)}
    </div>
    <div class="dialog-actions">
      <div class="dialog-action-group is-left">
        ${canConvertToDocument ? `<button type="button" class="secondary text-icon-button" data-convert-task-document="${task.id}">${buttonContent("&#128196;", "Convert to Document")}</button>` : ""}
        <button type="button" class="secondary text-icon-button" data-action="show-task-audit" data-id="${task.id}">${buttonContent("&#128221;", "Audit Log")}</button>
      </div>
      <div class="dialog-action-group">
        <button type="button" class="secondary text-icon-button" data-edit-readonly-task="${task.id}" ${canEdit ? "" : "disabled"}>${buttonContent("&#9998;", "Edit")}</button>
        <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeDialog(modal)));
  modal.addEventListener("click", async event => {
    const convertButton = event.target.closest("[data-convert-task-document]");
    if (convertButton && options.onConvertToDocument) {
      if (convertButton.disabled) return;

      convertButton.disabled = true;
      convertButton.setAttribute("aria-busy", "true");
      const result = await options.onConvertToDocument(task);
      const blogId = typeof result === "object"
        ? Number(result?.blogId || result?.id || 0)
        : Number(result || 0);

      if (result !== false) {
        closeDialog(modal);
        if (blogId && options.onViewDocument) options.onViewDocument(blogId);
        return;
      }

      if (modal.isConnected) {
        convertButton.disabled = false;
        convertButton.removeAttribute("aria-busy");
      }
      return;
    }

    const auditButton = event.target.closest("[data-action='show-task-audit']");
    if (auditButton) {
      showTaskAudit(Number(auditButton.dataset.id));
      return;
    }

    const editButton = event.target.closest("[data-edit-readonly-task]");
    if (editButton) {
      const selectedTask = taskById(Number(editButton.dataset.editReadonlyTask));
      closeDialog(modal);
      editWorkItem(selectedTask);
      return;
    }

    const inlineButton = event.target.closest("[data-action='view-task-inline']");
    if (!inlineButton) return;
    const selectedTask = taskById(Number(inlineButton.dataset.id));
    closeDialog(modal);
    viewWorkItem(selectedTask, editWorkItem, options);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
  normalizeLinksInElement(modal);
}

function workItemLinkedDocumentHtml(blogId) {
  const numericBlogId = Number(blogId || 0);
  if (!numericBlogId) return "";

  const blog = state.blogs.find(item => item.id === numericBlogId);
  const title = blog?.title || "Open linked document";
  return `<a href="#documentation-blog-${numericBlogId}" data-documentation-link="${numericBlogId}">${escapeHtml(title)}</a>`;
}

function richTextHasContent(html) {
  const source = String(html || "");
  if (!source.trim()) return false;

  const template = document.createElement("template");
  template.innerHTML = source;
  const text = (template.content.textContent || "").replace(/\u00a0/g, " ").trim();
  if (text) return true;

  return Boolean(template.content.querySelector("img, table, video, iframe, pre, code, blockquote, ul, ol"));
}

export function workItemDialogMetaHtml(task) {
  if (!task?.id) return "";

  const createdBy = workItemUserName(task.createdByUserId);
  const modifiedBy = workItemUserName(task.updatedByUserId || task.createdByUserId);
  const createdAt = formatDateTime(task.createdAt);
  const modifiedAt = formatDateTime(task.updatedAt || task.createdAt);

  return `
    <div class="work-item-dialog-meta">
      <div class="work-item-dialog-meta-group">
        <span>Created by: ${escapeHtml(createdBy)}</span>
        <span>${escapeHtml(createdAt)}</span>
      </div>
      <div class="work-item-dialog-meta-group">
        <span>Last Modified by: ${escapeHtml(modifiedBy)}</span>
        <span>${escapeHtml(modifiedAt)}</span>
      </div>
    </div>
  `;
}

export function showTaskAudit(taskId) {
  const task = taskById(taskId);
  if (!task) return;

  const audits = (state.auditEvents || [])
    .filter(audit => audit.entityType === "Task" && audit.entityId === taskId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog audit-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>Audit Log - ${escapeHtml(task.code)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      ${audits.length ? `
        <table class="table audit-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Status</th>
              <th>Percent</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${audits.map(audit => `
              <tr>
                <td>${escapeHtml(formatDateTime(audit.createdAt))}</td>
                <td>${escapeHtml(userById(audit.userId)?.nickname || "User")}</td>
                <td>${escapeHtml(audit.action)}</td>
                <td>${auditChangeHtml(audit.oldStatus, audit.newStatus)}</td>
                <td>${auditPercentHtml(audit.oldPercentCompleted, audit.newPercentCompleted)}</td>
                <td>${escapeHtml(audit.details || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty">No audit entries have been recorded for this item yet.</div>`}
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  initializeWindowedDialog(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeDialog(modal)));
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
}

function detailField(label, html, full = false) {
  return `
    <div class="detail-field ${full ? "full" : ""}">
      <span>${escapeHtml(label)}</span>
      <div>${html || `<span class="muted">None</span>`}</div>
    </div>
  `;
}

function workItemUserName(userId) {
  const user = userById(Number(userId || 0));
  if (!user) return "User";

  const fullName = [user.firstName, user.lastName]
    .map(part => (part || "").trim())
    .filter(Boolean)
    .join(" ") || (user.name || "").trim();
  const nickname = (user.nickname || "").trim();
  if (fullName && nickname && fullName.toLowerCase() !== nickname.toLowerCase()) return `${fullName} (${nickname})`;

  return fullName || nickname || "User";
}

function auditChangeHtml(oldValue, newValue) {
  if (!oldValue && !newValue) return `<span class="muted">No change</span>`;
  return `<span class="audit-change">${escapeHtml(oldValue || "None")} <b>&rarr;</b> ${escapeHtml(newValue || "None")}</span>`;
}

function auditPercentHtml(oldValue, newValue) {
  if (oldValue == null && newValue == null) return `<span class="muted">No change</span>`;
  const oldText = oldValue == null ? "None" : `${oldValue}%`;
  const newText = newValue == null ? "None" : `${newValue}%`;
  return `<span class="audit-change">${escapeHtml(oldText)} <b>&rarr;</b> ${escapeHtml(newText)}</span>`;
}

function closeDialog(modal) {
  if (modal.open) modal.close();
  modal.remove();
}
