import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { bugIconHtml, buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js";
import { sectionHead } from "../../components/sections.js";
import {
  bugFixIconHtml,
  createWorkItemTableMode
} from "../../components/work-items.js?v=20260627-dev-task-status-rules";
import {
  preferenceKeys,
  readJsonPreference,
  writeJsonPreference
} from "../../core/preferences.js?v=20260621-backlog-filters";
import { state } from "../../core/store.js";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import {
  projectName,
  sprintName,
  taskById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import {
  taskCreatedTime,
  taskOrderCompare
} from "../../shared/work-item-rules.js?v=20260627-dev-task-status-rules";

export function createBacklogFeature({
  app,
  deleteItem,
  duplicateTask,
  editBug,
  editTask,
  getPriorities,
  viewTask
}) {
  let backlogFilters = readJsonPreference(preferenceKeys.backlogFilters, {});
  const backlogTableMode = createWorkItemTableMode({
    action: "toggle-backlog-table-edit-mode",
    itemLabel: "Backlog"
  });

  backlogFilters.taskTypes = normalizeSavedArray(backlogFilters.taskTypes);
  backlogFilters.priorities = normalizeSavedArray(backlogFilters.priorities);
  backlogFilters.assigneeIds = normalizeSavedArray(backlogFilters.assigneeIds);
  backlogFilters.sprintId = backlogFilters.sprintId || "all";
  backlogFilters.sort = backlogFilters.sort || "custom";

  function renderBacklog() {
    ensureBacklogFilters();
    const backlogItems = filteredBacklogItems();

    app.innerHTML = `
      <section class="backlog-screen work-item-screen">
        ${sectionHead("Backlog", `
          <button class="primary text-icon-button" type="button" data-action="new-backlog-task" title="New Dev Task" aria-label="New Dev Task">${buttonContent("&#10010;", "New Dev Task")}</button>
          <button class="primary text-icon-button" type="button" data-action="new-backlog-bug" title="New Bug Report" aria-label="New Bug Report">${buttonContent(bugIconHtml(), "New Bug Report")}</button>
          ${backlogTableMode.buttonHtml()}
          <button class="secondary text-icon-button" type="button" data-action="open-backlog-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
        `)}
        <div class="panel work-item-table-panel backlog-table-panel">
          <table class="table work-item-table backlog-table ${backlogTableMode.active ? "is-edit-mode" : "is-read-mode"}">
            <colgroup>
              <col class="backlog-assigned-column">
              <col class="backlog-item-column">
              <col class="backlog-type-column">
              <col class="backlog-project-column">
              <col class="backlog-sprint-column">
              <col class="backlog-status-column">
              <col class="backlog-priority-column">
              ${backlogTableMode.active ? `<col class="backlog-action-column">` : ""}
            </colgroup>
            <thead>
              <tr>
                <th>Assigned</th>
                <th>Item</th>
                <th>Type</th>
                <th>Project</th>
                <th>Sprint</th>
                <th>Status</th>
                <th>Priority</th>
                ${backlogTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
              </tr>
            </thead>
            <tbody data-reorder-list="backlog">
              ${backlogItems.map(task => `
                <tr class="clickable-row" data-action="view-backlog-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${backlogTableMode.active ? "true" : "false"}" draggable="false">
                  <td>${taskRowAvatarsHtml(task.assignees)}</td>
                  <td class="work-item-title-cell">
                    <span class="work-item-code-line">
                      <strong class="work-item-code">${escapeHtml(task.code)}</strong>
                    </span>
                    <span class="work-item-title">${bugFixIconHtml(task)}${escapeHtml(task.title)}</span>
                  </td>
                  <td><span class="pill">${escapeHtml(task.taskType || "Dev")}</span></td>
                  <td class="work-item-context-cell backlog-project-cell">${escapeHtml(projectName(task.projectId))}</td>
                  <td class="work-item-context-cell">${task.sprintId ? `<span class="pill sprint-pill">${escapeHtml(sprintName(task.sprintId))}</span>` : `<span class="muted">Unassigned</span>`}</td>
                  <td class="work-item-context-cell">${escapeHtml(task.status)}</td>
                  <td><span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span></td>
                  ${backlogTableMode.active ? `<td class="reveal-actions action-cell">${backlogTaskButtonsHtml(task)}</td>` : ""}
                </tr>
              `).join("") || `<tr><td colspan="${backlogTableMode.active ? 8 : 7}"><div class="empty">No backlog items match the current filters.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function backlogTaskButtonsHtml(task) {
    return `
      ${iconButton("delete-backlog-task", task.id, "Delete", "delete-monochrome", true)}
      ${iconButton("duplicate-backlog-task", task.id, "Duplicate", "duplicate", true)}
      ${iconButton("show-task-audit", task.id, "Audit Log", "audit-monochrome", true)}
      ${iconButton("edit-backlog-task", task.id, "Edit", "edit", true)}
    `;
  }

  async function handleAction(action, id) {
    const task = id ? taskById(id) : null;

    if (action === "new-backlog-task") {
      editTask();
      return true;
    }
    if (action === "new-backlog-bug") {
      editBug();
      return true;
    }
    if (action === "toggle-backlog-table-edit-mode") {
      backlogTableMode.toggle();
      renderBacklog();
      return true;
    }
    if (action === "open-backlog-filters") {
      openBacklogFiltersDialog();
      return true;
    }
    if (action === "view-backlog-task") {
      viewTask(task);
      return true;
    }
    if (action === "edit-backlog-task") {
      if (task?.taskType === "Bug") editBug(task);
      else editTask(task);
      return true;
    }
    if (action === "duplicate-backlog-task") {
      await duplicateTask(id);
      return true;
    }
    if (action === "delete-backlog-task") {
      await deleteItem(`/api/backlog/tasks/${id}`, "Delete this backlog item?");
      return true;
    }

    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    if (!applyBacklogFilterChange(target)) return false;

    renderBacklog();
    return true;
  }

  function openBacklogFiltersDialog() {
    const existingDialog = document.querySelector("[data-backlog-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='backlog-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog backlog-filter-dialog";
    modal.dataset.backlogFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Backlog Filters</h2>
          <button type="button" class="icon-btn" data-close-backlog-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body backlog-filter-dialog-body" data-backlog-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-backlog-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderBacklogFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("change", event => {
      const filter = event.target?.dataset?.filter || "";
      if (!applyBacklogFilterChange(event.target)) return;

      renderBacklog();
      if (filter === "backlog-project") {
        renderBacklogFiltersDialog(modal);
        modal.querySelector("[data-filter='backlog-project']")?.focus({ preventScroll: true });
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-backlog-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='backlog-project']")?.focus({ preventScroll: true });
  }

  function renderBacklogFiltersDialog(modal) {
    const body = modal.querySelector("[data-backlog-filter-dialog-body]");
    if (!body) return;

    const sprints = state.sprints.filter(sprint => !backlogFilters.projectId || sprint.projectId === Number(backlogFilters.projectId));
    body.innerHTML = `
      <div class="backlog-filter-fields">
        <div class="task-filter-row backlog-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="backlog-project">
              <option value="" ${!backlogFilters.projectId ? "selected" : ""}>All Projects</option>
              ${state.projects.map(project => `<option value="${project.id}" ${String(project.id) === String(backlogFilters.projectId || "") ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sprint</span>
            <select data-filter="backlog-sprint">
              <option value="all" ${backlogFilters.sprintId === "all" ? "selected" : ""}>All Sprints</option>
              <option value="unassigned" ${backlogFilters.sprintId === "unassigned" ? "selected" : ""}>Unassigned</option>
              ${sprints.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(backlogFilters.sprintId) ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="backlog-sort">
              <option value="custom" ${backlogFilters.sort === "custom" ? "selected" : ""}>Custom order</option>
              <option value="newest" ${backlogFilters.sort === "newest" ? "selected" : ""}>Newest Items</option>
              <option value="oldest" ${backlogFilters.sort === "oldest" ? "selected" : ""}>Oldest Items</option>
            </select>
          </label>
        </div>
        <div class="filter-stack">
          ${filterCheckList("Type", "backlog-type", [
            { value: "Dev", text: "Dev Task" },
            { value: "Bug", text: "Bug Report" }
          ], backlogFilters.taskTypes)}
          ${filterCheckList("Priority", "backlog-priority", getPriorities().map(priority => ({ value: priority, text: priority })), backlogFilters.priorities)}
          ${filterCheckList("Assigned", "backlog-assigned", state.users.map(user => ({
            value: user.id,
            text: user.nickname,
            avatarUrl: user.avatarUrl
          })), backlogFilters.assigneeIds)}
        </div>
      </div>
    `;
  }

  function applyBacklogFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("backlog-")) return false;

    if (filter === "backlog-project") {
      backlogFilters.projectId = target.value;
      backlogFilters.sprintId = "all";
    }
    if (filter === "backlog-sprint") backlogFilters.sprintId = target.value || "all";
    if (filter === "backlog-sort") backlogFilters.sort = target.value;
    if (filter === "backlog-type") backlogFilters.taskTypes = checkedFilterValues("backlog-type");
    if (filter === "backlog-priority") backlogFilters.priorities = checkedFilterValues("backlog-priority");
    if (filter === "backlog-assigned") backlogFilters.assigneeIds = checkedFilterValues("backlog-assigned");

    writeJsonPreference(preferenceKeys.backlogFilters, backlogFilters);
    return true;
  }

  function ensureBacklogFilters() {
    if (backlogFilters.projectId && !state.projects.some(project => project.id === Number(backlogFilters.projectId))) {
      backlogFilters.projectId = "";
      backlogFilters.sprintId = "all";
    }

    if (!["all", "unassigned"].includes(backlogFilters.sprintId)) {
      const selectedSprint = state.sprints.find(sprint => sprint.id === Number(backlogFilters.sprintId));
      if (!selectedSprint || (backlogFilters.projectId && selectedSprint.projectId !== Number(backlogFilters.projectId))) {
        backlogFilters.sprintId = "all";
      }
    }
  }

  function filteredBacklogItems() {
    const items = state.tasks
      .filter(task => task.status === "Backlog" || task.status === "Todo")
      .filter(task => !backlogFilters.projectId || task.projectId === Number(backlogFilters.projectId))
      .filter(task => {
        if (backlogFilters.sprintId === "all") return true;
        if (backlogFilters.sprintId === "unassigned") return !task.sprintId;
        return task.sprintId === Number(backlogFilters.sprintId);
      })
      .filter(task => !backlogFilters.taskTypes.length || backlogFilters.taskTypes.includes(task.taskType || "Dev"))
      .filter(task => !backlogFilters.priorities.length || backlogFilters.priorities.includes(task.priority))
      .filter(task => !backlogFilters.assigneeIds.length || (task.assigneeIds || []).map(String).some(id => backlogFilters.assigneeIds.includes(id)));

    if (backlogFilters.sort === "newest") return items.sort((a, b) => taskCreatedTime(b) - taskCreatedTime(a) || b.id - a.id);
    if (backlogFilters.sort === "oldest") return items.sort((a, b) => taskCreatedTime(a) - taskCreatedTime(b) || a.id - b.id);
    return items.sort(taskOrderCompare);
  }

  function deactivateBacklog() {
    document.querySelectorAll("[data-backlog-filter-dialog]").forEach(dialog => {
      if (dialog.open) dialog.close();
      else dialog.remove();
    });
    backlogTableMode.deactivate();
  }

  return {
    deactivate: deactivateBacklog,
    handleAction,
    handleFilterChange,
    render: renderBacklog
  };
}
