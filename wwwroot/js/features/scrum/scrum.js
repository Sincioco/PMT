import { buttonContent, iconButton } from "../../components/buttons.js";
import {
  field,
  optionalNumberValue,
  richTextField,
  richValue,
  selectOptionsField,
  value
} from "../../components/forms.js";
import { sectionHead } from "../../components/sections.js";
import { currentUser } from "../../core/authentication.js";
import { state } from "../../core/store.js";
import {
  formatDate,
  toDateInput
} from "../../shared/dates.js";
import { canEditOwner } from "../../shared/permissions.js";
import {
  projectName,
  userById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";

export function createScrumFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast
}) {
  function renderDevLogs() {
    const logs = [...state.devLogs].sort((a, b) => new Date(b.logDate) - new Date(a.logDate) || new Date(b.updatedAt) - new Date(a.updatedAt));
    app.innerHTML = `
      ${sectionHead("Scrum", `<button class="primary text-icon-button" type="button" data-action="new-log">${buttonContent("&#10010;", "New Scrum")}</button>`)}
      <div class="panel scrum-panel">
        <div class="scrum-table-wrap">
        <table class="table scrum-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Project</th>
              <th>Person</th>
              <th>Scrum</th>
              <th>Flag</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
        ${logs.map(log => {
          const user = userById(log.userId);
          return `
            <tr class="scrum-row">
              <td class="scrum-date" data-label="Date">${formatDate(log.logDate)}</td>
              <td class="scrum-project" data-label="Project">${log.projectId ? `<span class="pill">${escapeHtml(projectName(log.projectId))}</span>` : `<span class="muted">No project</span>`}</td>
              <td class="scrum-person-cell" data-label="Person">
                <div class="row scrum-person">
                  <img class="avatar" src="${escapeAttr(user?.avatarUrl || "/assets/avatar-default.svg")}" alt="">
                  <strong>${escapeHtml(user?.nickname || "User")}</strong>
                </div>
              </td>
              <td class="scrum-body" data-label="Scrum"><div class="scrum-content">${log.bodyHtml}</div></td>
              <td class="scrum-flag" data-label="Flag">${log.isPinned ? `<span class="pill scrum-pin">Pinned</span>` : `<span class="muted">—</span>`}</td>
              <td class="reveal-actions action-cell scrum-actions" data-label="Actions">
                ${iconButton("edit-log", log.id, "Edit", "edit", canEditOwner(log.userId))}
                ${iconButton("duplicate-log", log.id, "Duplicate", "duplicate", true)}
                ${iconButton("delete-log", log.id, "Delete", "delete", canEditOwner(log.userId), "danger")}
              </td>
            </tr>
          `;
        }).join("") || `<tr><td colspan="6"><div class="empty">No Scrum entries.</div></td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
    `;
  }

  async function handleAction(action, id) {
    if (action === "new-log") {
      editDevLog();
      return true;
    }
    if (action === "edit-log") {
      editDevLog(state.devLogs.find(log => log.id === id));
      return true;
    }
    if (action === "duplicate-log") {
      await duplicateDevLog(id);
      return true;
    }
    if (action === "delete-log") {
      await deleteItem(`/api/devlogs/${id}`, "Delete this log?");
      return true;
    }

    return false;
  }

  function editDevLog(log = {}) {
    const scrumPlaceholder = "What did you accomplish yesterday?\nWhat do you plan to do today?\nDo you have any roadblocks?";
    const firstScrumPrompt = "What did you accomplish yesterday?";
    const scrumHtml = log.bodyHtml || scrumPlaceholder.replaceAll("\n", "<br>");

    openEditor(log.id ? "Edit Scrum" : "New Scrum", `
      <div class="form-grid">
        ${field("Date", "logDate", toDateInput(log.logDate || new Date()), "date")}
        ${selectOptionsField("Project", "projectId", [{ id: "", title: "No project" }, ...state.projects.map(project => ({ id: project.id, title: `${project.code} - ${project.title}` }))], log.projectId || "")}
        ${richTextField("bodyHtml", "Scrum", scrumHtml)}
        <label class="inline-check field full"><input name="isPinned" type="checkbox" ${log.isPinned ? "checked" : ""} ${currentUser().isAdmin ? "" : "disabled"}><span>Pinned</span></label>
      </div>
    `, async root => {
      await saveJson(log.id ? `/api/devlogs/${log.id}` : "/api/devlogs", log.id ? "PUT" : "POST", {
        id: log.id || 0,
        projectId: optionalNumberValue(root, "projectId"),
        logDate: value(root, "logDate"),
        bodyHtml: richValue(root, "bodyHtml"),
        isPinned: root.querySelector("[name='isPinned']").checked
      });
    }, log.id ? "" : "bodyHtml", root => {
      if (!log.id) focusRichEditorAfterText(root, "bodyHtml", firstScrumPrompt);
    });
  }

  async function duplicateDevLog(id) {
    const log = state.devLogs.find(item => item.id === id);
    if (!log) return;

    try {
      await saveJson("/api/devlogs", "POST", {
        id: 0,
        projectId: log.projectId || null,
        logDate: toDateInput(new Date()),
        bodyHtml: log.bodyHtml,
        isPinned: false
      });
      await loadState();
      render();
      showToast("Scrum duplicated.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function focusRichEditorAfterText(root, richName, text) {
    const editor = root.querySelector(`[data-rich='${richName}']`);
    if (!editor) return;

    setTimeout(() => {
      editor.focus();
      placeCaretAfterText(editor, text);
    }, 40);
  }

  function placeCaretAfterText(container, text) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      const index = node.nodeValue.indexOf(text);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(node, index + text.length);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return;
      }
      node = walker.nextNode();
    }
  }

  return {
    handleAction,
    render: renderDevLogs
  };
}
