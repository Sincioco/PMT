import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent } from "../../components/buttons.js";
import { progressHtml } from "../../components/progress-and-status.js";
import { sectionHead } from "../../components/sections.js";
import {
  bugFixIconHtml,
  taskButtonsHtml
} from "../../components/work-items.js";
import {
  preferenceKeys,
  readJsonPreference,
  readNumberPreference,
  readPreference,
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
  percentForStatus,
  taskOrderCompare
} from "../../shared/work-item-rules.js";
import { createBoardDrag } from "./board-drag.js";

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
  let boardHideEmptyColumns = false;

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

    if (!boardProjectId && state.projects.length) boardProjectId = state.projects[0].id;
    const project = state.projects.find(item => item.id === boardProjectId) || state.projects[0];
    const sprintId = selectedSprintId(project?.id);
    const visibleTasks = state.tasks
      .filter(task => !project || task.projectId === project.id)
      .filter(task => sprintId === 0 || task.sprintId === sprintId)
      .filter(task => boardStatuses.includes(task.status))
      .sort(boardTaskSortCompare);
    const boardColumnStatuses = boardHideEmptyColumns
      ? boardStatuses.filter(status => visibleTasks.some(task => task.status === status))
      : boardStatuses;

    app.innerHTML = `
      ${sectionHead("Kanban Board", `
        <button class="primary text-icon-button" type="button" data-action="new-task">${buttonContent("&#10010;", "New Dev Task")}</button>
        <button class="primary text-icon-button" type="button" data-action="new-bug">${buttonContent("&#9888;", "New Bug Report")}</button>
      `)}
      <div class="panel board-controls-panel">
        <div class="filter-row">
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
              ${state.sprints.filter(sprint => sprint.projectId === boardProjectId).map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === boardSprintMode ? "selected" : ""}>${escapeHtml(sprint.code)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="board-sort">
              <option value="custom" ${boardSort === "custom" ? "selected" : ""}>Custom order</option>
              <option value="openFirst" ${boardSort === "openFirst" ? "selected" : ""}>Open first</option>
              <option value="doneFirst" ${boardSort === "doneFirst" ? "selected" : ""}>Done first</option>
            </select>
          </label>
          <button class="icon-action ${boardHideEmptyColumns ? "is-on" : ""}" type="button" data-action="toggle-empty-board-columns" title="${boardHideEmptyColumns ? "Show all columns" : "Hide empty columns"}" aria-label="${boardHideEmptyColumns ? "Show all columns" : "Hide empty columns"}" aria-pressed="${boardHideEmptyColumns}">${boardHideEmptyColumns ? "&#9638;" : "&#128065;"}</button>
        </div>
        <fieldset class="check-list board-status-filter">
          <legend>Columns</legend>
          ${getStatuses().map(status => `<label><input type="checkbox" data-filter="board-status" value="${status}" ${boardStatuses.includes(status) ? "checked" : ""}> ${status}</label>`).join("")}
        </fieldset>
      </div>
      <div class="board">
        ${boardColumnStatuses.map(status => boardColumnHtml(status, visibleTasks.filter(task => task.status === status))).join("") || `<div class="empty">No columns have tasks for the current filters.</div>`}
      </div>
    `;
  }

  function handleAction(action) {
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

    if (target.dataset.filter === "board-project") {
      boardProjectId = Number(target.value);
      writePreference(preferenceKeys.boardProject, boardProjectId);
      renderBoard();
      return true;
    }
    if (target.dataset.filter === "board-sprint") {
      boardSprintMode = target.value;
      writePreference(preferenceKeys.boardSprint, boardSprintMode);
      renderBoard();
      return true;
    }
    if (target.dataset.filter === "board-sort") {
      boardSort = target.value;
      writePreference(preferenceKeys.boardSort, boardSort);
      renderBoard();
      return true;
    }
    if (target.dataset.filter === "board-status") {
      boardStatuses = [...app.querySelectorAll("[data-filter='board-status']:checked")].map(item => item.value);
      boardHideEmptyColumns = false;
      writeJsonPreference(preferenceKeys.boardStatuses, boardStatuses);
      renderBoard();
      return true;
    }
    return false;
  }

  function hideEmptyBoardColumns() {
    boardHideEmptyColumns = true;
    const project = state.projects.find(item => item.id === boardProjectId) || state.projects[0];
    const sprintId = selectedSprintId(project?.id);
    const visibleTasks = state.tasks
      .filter(task => !project || task.projectId === project.id)
      .filter(task => sprintId === 0 || task.sprintId === sprintId);

    boardStatuses = getStatuses().filter(status => visibleTasks.some(task => task.status === status));
    writeJsonPreference(preferenceKeys.boardStatuses, boardStatuses);
    renderBoard();
  }

  function showAllBoardColumns() {
    boardHideEmptyColumns = false;
    boardStatuses = [...getStatuses()];
    writeJsonPreference(preferenceKeys.boardStatuses, boardStatuses);
    renderBoard();
  }

  function toggleEmptyBoardColumns() {
    if (boardHideEmptyColumns) {
      showAllBoardColumns();
    } else {
      hideEmptyBoardColumns();
    }
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
        ${tasks.map(task => `
          <article class="task-card ${task.taskType === "Bug" ? "bug-card" : ""}" data-task-id="${task.id}" data-can-drag="${canEditTask(task) ? "true" : "false"}" draggable="false">
            <div class="spread task-card-head">
              <strong class="task-card-code">${escapeHtml(task.code)}</strong>
              <span class="pill">${escapeHtml(task.taskType || "Dev")}</span>
            </div>
            <div class="task-card-tags">
              <span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span>
              ${task.taskType === "Bug" ? `<span class="pill severity-${escapeAttr(task.severity)}">${escapeHtml(task.severity || "")}</span>` : ""}
            </div>
            <p class="task-card-title">${bugFixIconHtml(task)}${escapeHtml(task.title)}</p>
            <div class="mini-progress">
              ${progressHtml(task.percentCompleted)}
              ${task.subTasks.length ? progressHtml(task.subTaskAveragePercent) : ""}
            </div>
            <div class="row task-card-assignees">${avatarsHtml(task.assignees)}</div>
            <div class="toolbar reveal-actions task-card-actions">${taskButtonsHtml(task)}</div>
          </article>
        `).join("") || `<div class="empty">No tasks.</div>`}
      </section>
    `;
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
        percentCompleted: percentForStatus(status, task.percentCompleted),
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
    if (!boardStatuses.length) boardStatuses = [...statuses];
  }

  return {
    deactivate: boardDrag.deactivate,
    getProjectId: () => boardProjectId,
    getSprintId: selectedSprintId,
    handleAction,
    handleFilterChange,
    refreshStatuses,
    render: renderBoard
  };
}
