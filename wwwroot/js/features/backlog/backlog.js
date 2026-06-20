import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent } from "../../components/buttons.js";
import { sectionHead } from "../../components/sections.js";
import {
  bugFixIconHtml,
  taskButtonsHtml
} from "../../components/work-items.js?v=20260620-bug-linked-task";
import { state } from "../../core/store.js";
import { canEditTask } from "../../shared/permissions.js";
import {
  projectName,
  sprintName
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import { taskOrderCompare } from "../../shared/work-item-rules.js";

export function createBacklogFeature({ app }) {
  function renderBacklog() {
    const backlogItems = state.tasks
      .filter(task => task.status === "Backlog" || task.status === "Todo")
      .sort(taskOrderCompare);

    app.innerHTML = `
      ${sectionHead("Backlog", `
        <button class="primary text-icon-button" type="button" data-action="new-task">${buttonContent("&#10010;", "New Dev Task")}</button>
        <button class="primary text-icon-button" type="button" data-action="new-bug">${buttonContent("&#9888;", "New Bug Report")}</button>
      `)}
      <div class="panel work-item-table-panel backlog-table-panel">
        <table class="table work-item-table backlog-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Item</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned</th>
              <th></th>
            </tr>
          </thead>
          <tbody data-reorder-list="backlog">
            ${backlogItems.map(task => `
              <tr class="clickable-row ${task.sprintId ? "assigned-backlog-row" : ""}" data-action="view-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${canEditTask(task) ? "true" : "false"}" draggable="false">
                <td><span class="pill">${escapeHtml(task.taskType || "Dev")}</span></td>
                <td class="work-item-title-cell">
                  <strong class="work-item-code">${escapeHtml(task.code)}</strong>
                  <span class="work-item-title">${bugFixIconHtml(task)}${escapeHtml(task.title)}</span>
                </td>
                <td>${escapeHtml(projectName(task.projectId))}</td>
                <td>${task.sprintId ? `<span class="pill sprint-pill">${escapeHtml(sprintName(task.sprintId))}</span>` : `<span class="muted">Unassigned</span>`}</td>
                <td><span class="pill">${escapeHtml(task.status)}</span></td>
                <td><span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span></td>
                <td>${avatarsHtml(task.assignees)}</td>
                <td class="reveal-actions action-cell">${taskButtonsHtml(task)}</td>
              </tr>
            `).join("") || `<tr><td colspan="8"><div class="empty">No backlog or Todo items yet.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  return {
    render: renderBacklog
  };
}
