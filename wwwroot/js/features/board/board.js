import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent, funnelIconHtml } from "../../components/buttons.js";
import { checkedFilterValues, filterCheckList } from "../../components/filters.js?v=20260621-task-filter-layout";
import { progressHtml } from "../../components/progress-and-status.js?v=20260627-dev-task-status-rules";
import { sectionHead } from "../../components/sections.js?v=20260701-nav-title-preferences";
import {
  bugFixIconHtml,
  createWorkItemTableMode,
  taskButtonsHtml
} from "../../components/work-items.js?v=20260629-avatar-jpg-assets";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  removePreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js";
import { state } from "../../core/store.js";
import { canEditTask } from "../../shared/permissions.js";
import { taskById } from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import {
  percentForDevTaskSave,
  percentForStatus,
  taskDisplayPercent,
  taskOrderCompare
} from "../../shared/work-item-rules.js?v=20260627-dev-task-status-rules";
import { createBoardDrag } from "./board-drag.js";

const bugIconUrl = "/assets/bug.svg?v=20260629-kanban-gantt-bug-icon";

export function createBoardFeature({
  app,
  getStatuses,
  loadState,
  render,
  saveJson,
  showToast
}) {
  let boardProjectId = readNumberPreference(preferenceKeys.boardProject, 0);
  let boardSprintMode = readPreference(preferenceKeys.boardSprint, "latest");
  let boardSort = readPreference(preferenceKeys.boardSort, "custom");
  let boardHideEmptyColumns = readBooleanPreference(preferenceKeys.boardHideEmptyColumns, true);
  let boardIsActive = false;
  const boardEditMode = createWorkItemTableMode({
    action: "toggle-board-edit-mode",
    itemLabel: "Kanban Board"
  });

  const initialStatuses = getStatuses();
  const savedBoardStatuses = readJsonPreference(preferenceKeys.boardStatuses, null);
  let boardStatuses = Array.isArray(savedBoardStatuses) && savedBoardStatuses.every(status => initialStatuses.includes(status))
    ? savedBoardStatuses
    : initialStatuses;

  const boardDrag = createBoardDrag({
    root: app,
    getTask: taskById,
    onDrop: saveBoardDrop
  });

  function renderBoard() {
    boardDrag.activate();
    if (!boardIsActive) applyBoardLoadDefaults();
    boardIsActive = true;

    if (!boardProjectId && state.projects.length) boardProjectId = state.projects[0].id;
    const project = state.projects.find(item => item.id === boardProjectId) || state.projects[0];
    const sprintId = selectedSprintId(project?.id);
    const projectSprintTasks = state.tasks
      .filter(task => !project || task.projectId === project.id)
      .filter(task => sprintId === 0 || task.sprintId === sprintId);

    if (boardHideEmptyColumns) {
      const nonEmptyStatuses = getStatuses().filter(status => projectSprintTasks.some(task => task.status === status));
      if (!sameValues(boardStatuses, nonEmptyStatuses)) {
        boardStatuses = nonEmptyStatuses;
        writeJsonPreference(preferenceKeys.boardStatuses, boardStatuses);
      }
    }

    const visibleTasks = projectSprintTasks
      .filter(task => boardStatuses.includes(task.status))
      .sort(boardTaskSortCompare);
    const boardColumnStatuses = boardHideEmptyColumns
      ? boardStatuses.filter(status => visibleTasks.some(task => task.status === status))
      : boardStatuses;
    const columnToggleLabel = boardHideEmptyColumns ? "Show All Columns" : "Hide Empty Columns";
    app.innerHTML = `
      <section class="board-screen work-item-screen">
        ${sectionHead("Kanban Board", `
          <button class="primary text-icon-button" type="button" data-action="new-task" title="New Dev Task" aria-label="New Dev Task">${buttonContent("&#10010;", "New Dev Task")}</button>
          <button class="primary text-icon-button" type="button" data-action="new-bug" title="New Bug Report" aria-label="New Bug Report">${buttonIconImgHtml("board-action-bug-icon")}<span>New Bug Report</span></button>
          <button class="secondary text-icon-button ${boardHideEmptyColumns ? "is-on" : ""}" type="button" data-action="toggle-empty-board-columns" title="${columnToggleLabel}" aria-label="${columnToggleLabel}" aria-pressed="${boardHideEmptyColumns}">${buttonContent(boardHideEmptyColumns ? "&#9638;" : "&#128065;", columnToggleLabel)}</button>
          ${boardEditMode.buttonHtml()}
          <button class="secondary text-icon-button" type="button" data-action="open-board-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
          <button class="secondary text-icon-button" type="button" data-action="reset-board-view" title="Reset View" aria-label="Reset View">${buttonContent("&#8634;", "Reset View")}</button>
        `)}
        <div class="board">
          ${boardColumnStatuses.map(status => boardColumnHtml(status, visibleTasks.filter(task => task.status === status))).join("") || `<div class="empty">No columns have tasks for the current filters.</div>`}
        </div>
      </section>
    `;
  }

  function handleAction(action) {
    if (action === "open-board-filters" || action === "toggle-board-filters") {
      openBoardFiltersDialog();
      return true;
    }
    if (action === "toggle-board-edit-mode") {
      boardEditMode.toggle();
      renderBoard();
      return true;
    }
    if (action === "reset-board-view") {
      resetBoardView();
      return true;
    }
    if (action === "toggle-empty-board-columns") {
      toggleEmptyBoardColumns();
      return true;
    }
    if (action === "hide-empty-board-columns") {
      hideEmptyBoardColumns();
      return true;
    }
    if (action === "show-all-board-columns") {
      showAllBoardColumns();
      return true;
    }
    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    if (!applyBoardFilterChange(target)) return false;

    renderBoard();
    return true;
  }

  function openBoardFiltersDialog() {
    const existingDialog = document.querySelector("[data-board-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='board-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog board-filter-dialog";
    modal.dataset.boardFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Kanban Board Filters</h2>
          <button type="button" class="icon-btn" data-close-board-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body board-filter-dialog-body" data-board-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-board-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderBoardFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("change", event => {
      const target = event.target;
      const filter = target?.dataset?.filter || "";
      if (!applyBoardFilterChange(target)) return;

      renderBoard();
      if (filter === "board-project" || filter === "board-hide-empty-columns") {
        renderBoardFiltersDialog(modal);
        modal.querySelector(`[data-filter='${filter}']`)?.focus({ preventScroll: true });
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-board-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='board-project']")?.focus({ preventScroll: true });
  }

  function renderBoardFiltersDialog(modal) {
    const body = modal.querySelector("[data-board-filter-dialog-body]");
    if (body) body.innerHTML = boardFilterFieldsHtml();
  }

  function boardFilterFieldsHtml() {
    const project = state.projects.find(item => item.id === boardProjectId) || state.projects[0];

    return `
      <div class="tasks-filter-panel board-filter-panel">
        <div class="task-filter-row board-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="board-project">
              ${state.projects.map(item => `<option value="${item.id}" ${item.id === boardProjectId ? "selected" : ""}>${escapeHtml(item.code)} - ${escapeHtml(item.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sprint</span>
            <select data-filter="board-sprint">
              <option value="latest" ${boardSprintMode === "latest" ? "selected" : ""}>Latest Sprint</option>
              <option value="all" ${boardSprintMode === "all" ? "selected" : ""}>All Sprints</option>
              ${state.sprints.filter(sprint => sprint.projectId === project?.id).map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === boardSprintMode ? "selected" : ""}>${escapeHtml(sprint.code)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="board-sort">
              <option value="custom" ${boardSort === "custom" ? "selected" : ""}>Custom Order (Saved Order)</option>
              <option value="openFirst" ${boardSort === "openFirst" ? "selected" : ""}>Open First</option>
              <option value="doneFirst" ${boardSort === "doneFirst" ? "selected" : ""}>Done First</option>
            </select>
          </label>
          <label class="inline-filter-check">
            <input type="checkbox" data-filter="board-hide-empty-columns" ${boardHideEmptyColumns ? "checked" : ""}>
            <span class="checkbox-label-text">Hide Empty Columns</span>
          </label>
        </div>
        <div class="filter-stack">
          ${filterCheckList("Columns", "board-status", getStatuses().map(value => ({ value, text: value })), boardStatuses)}
        </div>
      </div>
    `;
  }

  function applyBoardFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("board-")) return false;

    if (filter === "board-project") {
      boardProjectId = Number(target.value);
      writePreference(preferenceKeys.boardProject, boardProjectId);
      return true;
    }
    if (filter === "board-sprint") {
      boardSprintMode = target.value;
      writePreference(preferenceKeys.boardSprint, boardSprintMode);
      return true;
    }
    if (filter === "board-sort") {
      boardSort = target.value;
      writePreference(preferenceKeys.boardSort, boardSort);
      return true;
    }
    if (filter === "board-hide-empty-columns") {
      if (target.checked) {
        boardHideEmptyColumns = true;
        writePreference(preferenceKeys.boardHideEmptyColumns, boardHideEmptyColumns);
      } else {
        showAllBoardColumns({ renderAfterChange: false });
      }
      return true;
    }
    if (filter === "board-status") {
      boardStatuses = checkedFilterValues("board-status");
      boardHideEmptyColumns = false;
      writeJsonPreference(preferenceKeys.boardStatuses, boardStatuses);
      writePreference(preferenceKeys.boardHideEmptyColumns, boardHideEmptyColumns);
      return true;
    }
    return false;
  }

  function hideEmptyBoardColumns() {
    boardHideEmptyColumns = true;
    writePreference(preferenceKeys.boardHideEmptyColumns, boardHideEmptyColumns);
    renderBoard();
  }

  function showAllBoardColumns(options = {}) {
    const { renderAfterChange = true } = options;
    boardHideEmptyColumns = false;
    boardStatuses = [...getStatuses()];
    writeJsonPreference(preferenceKeys.boardStatuses, boardStatuses);
    writePreference(preferenceKeys.boardHideEmptyColumns, boardHideEmptyColumns);
    if (renderAfterChange) renderBoard();
  }

  function toggleEmptyBoardColumns() {
    if (boardHideEmptyColumns) {
      showAllBoardColumns();
    } else {
      hideEmptyBoardColumns();
    }
  }

  function applyBoardLoadDefaults() {
    boardProjectId = readNumberPreference(preferenceKeys.boardProject, boardProjectId);
    boardSprintMode = readPreference(preferenceKeys.boardSprint, boardSprintMode);
    boardSort = readPreference(preferenceKeys.boardSort, boardSort);
    boardHideEmptyColumns = true;
    writePreference(preferenceKeys.boardHideEmptyColumns, boardHideEmptyColumns);
  }

  function deactivateBoard() {
    boardIsActive = false;
    boardDrag.deactivate();
    boardEditMode.deactivate();
    closeBoardFilterDialogs();
  }

  function boardTaskSortCompare(a, b) {
    if (boardSort === "doneFirst") return b.percentCompleted - a.percentCompleted || taskOrderCompare(a, b);
    if (boardSort === "openFirst") return a.percentCompleted - b.percentCompleted || taskOrderCompare(a, b);
    return taskOrderCompare(a, b);
  }

  function boardColumnHtml(status, tasks) {
    return `
      <section class="column" data-status="${escapeAttr(status)}" data-reorder-list="board-column">
        <h2 class="board-column-title">${escapeHtml(status)} <span class="pill">${tasks.length}</span></h2>
        ${tasks.map(taskCardHtml).join("") || `<div class="empty">No tasks.</div>`}
      </section>
    `;
  }

  function taskCardHtml(task) {
    const canDrag = boardEditMode.active && canEditTask(task);
    const readOnlyActionAttrs = boardEditMode.active
      ? ""
      : `data-action="view-task" data-id="${task.id}" role="button" tabindex="0"`;

    return `
      <article class="task-card ${task.taskType === "Bug" ? "bug-card" : ""}" ${readOnlyActionAttrs} data-task-id="${task.id}" data-can-drag="${canDrag ? "true" : "false"}" draggable="false">
        <div class="task-card-top">
          <div class="task-card-avatar">${avatarsHtml(task.assignees)}</div>
          <div class="task-card-summary">
            <div class="spread task-card-head">
              <strong class="task-card-code">${escapeHtml(task.code)}</strong>
              ${taskTypeMarkHtml(task)}
            </div>
            <p class="task-card-title">${bugFixIconHtml(task)}${escapeHtml(task.title)}</p>
            <div class="task-card-tags">
              <span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span>
              ${task.taskType === "Bug" ? `<span class="pill severity-${escapeAttr(task.severity)}">${escapeHtml(task.severity || "")}</span>` : ""}
            </div>
          </div>
        </div>
        ${taskCardProgressHtml(task)}
        ${boardEditMode.active ? `<div class="toolbar reveal-actions task-card-actions">${taskButtonsHtml(task)}</div>` : ""}
      </article>
    `;
  }

  function taskTypeMarkHtml(task) {
    if (task.taskType === "Bug") {
      return `<img class="task-card-bug-icon" src="${bugIconUrl}" title="Bug" alt="Bug">`;
    }

    return `<span class="pill">${escapeHtml(task.taskType || "Dev")}</span>`;
  }

  function taskCardProgressHtml(task) {
    const percent = taskDisplayPercent(task);
    const subTasks = task.subTasks || [];

    return `
      <div class="task-card-progress">
        <div class="task-card-progress-label">${percent}%</div>
        ${progressHtml(percent)}
        ${subTasks.map(taskCardSubTaskProgressHtml).join("")}
      </div>
    `;
  }

  function taskCardSubTaskProgressHtml(subTask) {
    const percent = taskDisplayPercent(subTask);
    const label = [subTask.code, subTask.title].filter(Boolean).join(" - ");

    return `
      <div class="task-card-subtask-progress" title="${escapeAttr(`${label} ${percent}%`)}">
        <div class="task-card-subtask-label">
          <span>${escapeHtml(subTask.code || "Sub-task")}</span>
          <span>${percent}%</span>
        </div>
        ${progressHtml(percent)}
      </div>
    `;
  }

  function buttonIconImgHtml(className) {
    return `<img class="${className}" src="${bugIconUrl}" alt="" aria-hidden="true">`;
  }

  async function saveBoardDrop({
    task,
    taskIds,
    newStatus,
    statusChanged
  }) {
    try {
      if (statusChanged) {
        const moved = await updateTaskStatus(task, newStatus);
        if (!moved) return;
      }

      if (taskIds.length > 1) {
        await saveJson("/api/tasks/reorder", "POST", { taskIds });
      }

      boardSort = "custom";
      writePreference(preferenceKeys.boardSort, boardSort);

      await loadState();
      render();
      showToast(statusChanged ? `Moved to ${newStatus}.` : "Order saved.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function updateTaskStatus(task, status) {
    try {
      await saveJson(`/api/tasks/${task.id}`, "PUT", {
        id: task.id,
        projectId: task.projectId,
        sprintId: task.sprintId,
        parentTaskId: task.parentTaskId,
        taskType: task.taskType || "Dev",
        title: task.title,
        descriptionHtml: task.descriptionHtml,
        stepsToReproduceHtml: task.stepsToReproduceHtml || "",
        actualResultHtml: task.actualResultHtml || "",
        expectedResultHtml: task.expectedResultHtml || "",
        environment: task.environment || "",
        severity: task.severity || "",
        status,
        priority: task.priority,
        percentCompleted: percentForTaskStatus(task, status),
        startDate: task.startDate,
        endDate: task.endDate,
        url: task.url,
        reporterIds: task.reporterIds || [],
        assigneeIds: task.assigneeIds,
        dependencyTaskIds: task.dependencyTaskIds
      });
      return true;
    } catch (error) {
      showToast(error.message);
      return false;
    }
  }

  function percentForTaskStatus(task, status) {
    if ((task.taskType || "Dev") !== "Bug") {
      return percentForDevTaskSave(status, task.percentCompleted, task, task.dependencyTaskIds || []);
    }

    return percentForStatus(status, task.percentCompleted);
  }

  function selectedSprintId(projectId) {
    if (boardSprintMode === "all") return 0;
    if (boardSprintMode !== "latest") return Number(boardSprintMode);
    const latest = state.sprints
      .filter(sprint => sprint.projectId === projectId)
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
    return latest?.id || 0;
  }

  function refreshStatuses() {
    const statuses = getStatuses();
    const saved = Array.isArray(boardStatuses) ? boardStatuses : [];
    boardStatuses = saved.filter(status => statuses.includes(status));
    if (!boardStatuses.length && !boardHideEmptyColumns) boardStatuses = [...statuses];
  }

  function resetBoardView() {
    [
      preferenceKeys.boardProject,
      preferenceKeys.boardSprint,
      preferenceKeys.boardSort,
      preferenceKeys.boardStatuses,
      preferenceKeys.boardHideEmptyColumns,
      preferenceKeys.boardFiltersVisible
    ].forEach(removePreference);

    boardProjectId = 0;
    boardSprintMode = "latest";
    boardSort = "custom";
    boardHideEmptyColumns = true;
    boardStatuses = [...getStatuses()];
    boardEditMode.deactivate();
    closeBoardFilterDialogs();
    renderBoard();
  }

  function closeBoardFilterDialogs() {
    document.querySelectorAll("[data-board-filter-dialog]").forEach(dialog => {
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.remove();
      }
    });
  }

  function sameValues(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  return {
    deactivate: deactivateBoard,
    getProjectId: () => boardProjectId,
    getSprintId: selectedSprintId,
    handleAction,
    handleFilterChange,
    refreshStatuses,
    render: renderBoard
  };
}
