import { buttonContent, funnelIconHtml } from "../../components/buttons.js";
import { checkedFilterValues, filterCheckList } from "../../components/filters.js?v=20260621-task-filter-layout";
import { userCardCheckListLabelHtml } from "../../components/forms.js?v=20260722-rte-toggle-state-v1";
import { createIdleFilterHeader } from "../../components/idle-filter-header.js?v=20260717-multi-screen-search-persistent";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-22-day-35-b9e5ce970062";
import {
  createWorkItemTableMode,
  taskButtonsHtml,
  workItemKanbanCardHtml
} from "../../components/work-items.js?v=20260722-rich-entity-mentions-v1";
import {
  currentUser
} from "../../core/authentication.js?v=20260715-admin-impersonation";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  removePreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260717-multi-screen-header";
import { state } from "../../core/store.js";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import { canEditTask } from "../../shared/permissions.js?v=20260715-admin-impersonation";
import { canAccessResource } from "../../shared/security.js?v=20260717-multi-screen-header";
import { taskById } from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import {
  percentForDevTaskSave,
  percentForStatus,
  taskOrderCompare,
  validateDeveloperDevTaskStatus
} from "../../shared/work-item-rules.js?v=20260716-developer-board-status";
import { createBoardDrag } from "./board-drag.js?v=20260717-multi-screen-header";

const bugIconUrl = "/assets/bug.svg?v=20260629-kanban-gantt-bug-icon";

export function createBoardFeature({
  app,
  deleteItems,
  getStatuses,
  loadState,
  render,
  saveJson,
  showToast
}) {
  let boardProjectId = readNumberPreference(preferenceKeys.boardProject, 0);
  let boardSprintMode = readPreference(preferenceKeys.boardSprint, "latest");
  let boardSearch = readPreference(preferenceKeys.boardSearch, "");
  let boardSort = readPreference(preferenceKeys.boardSort, "custom");
  let boardHideEmptyColumns = readBooleanPreference(preferenceKeys.boardHideEmptyColumns, true);
  let boardUserIds = normalizeSavedArray(readJsonPreference(preferenceKeys.boardUsers, []));
  let boardIsActive = false;
  let boardBulkDeleteBusy = false;
  const selectedBoardDeleteIds = new Set();
  const boardEditMode = createWorkItemTableMode({
    action: "toggle-board-edit-mode",
    itemLabel: "Kanban Board"
  });
  const boardHeader = createIdleFilterHeader({
    app,
    screenSelector: ".board-screen",
    searchFilter: "board-search",
    onSearchInput(value, { commit, render }) {
      boardSearch = value;
      if (commit) writePreference(preferenceKeys.boardSearch, boardSearch);
      if (render) {
        const scrollLeft = currentBoardScrollLeft();
        renderBoard();
        restoreBoardScrollLeft(scrollLeft);
      }
      return true;
    }
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

    ensureBoardProject();
    const project = boardProject();
    ensureBoardSprintMode(project);
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
      .filter(boardTaskMatchesUserFilter)
      .filter(boardTaskMatchesSearchFilter)
      .sort(boardTaskSortCompare);
    pruneBoardDeleteSelection(visibleTasks);
    const boardColumnStatuses = boardHideEmptyColumns
      ? boardStatuses.filter(status => visibleTasks.some(task => task.status === status))
      : boardStatuses;
    const columnToggleLabel = boardHideEmptyColumns ? "Show All Columns" : "Hide Empty Columns";
    app.innerHTML = `
      <section class="board-screen work-item-screen idle-filter-header-screen">
        ${sectionHead("Kanban Board", `
          ${boardHeader.controlsHtml(boardHeaderFields(project))}
          ${boardHeader.searchHtml(boardSearch, "Search Kanban Board")}
          <button class="primary text-icon-button" type="button" data-action="new-task" data-idle-filter-header-add-target title="New Dev Task" aria-label="New Dev Task">${buttonContent("&#10010;", "New Dev Task")}</button>
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

    boardHeader.bind();
    bindBoardDeleteSelection();
  }

  function boardHeaderFields(project = boardProject()) {
    const sprint = state.sprints.find(item => item.id === selectedSprintId(project?.id));
    const sprintSummary = boardSprintMode === "all"
      ? { label: "All Sprints", title: "All Sprints" }
      : sprint
        ? { label: sprint.title, title: `${sprint.code} - ${sprint.title}` }
        : { label: "Latest Sprint", title: "Latest Sprint" };

    return [
      {
        key: "project",
        filter: "board-project",
        label: "Project",
        optionsHtml: boardProjectOptionsHtml(),
        summary: project ? `${project.code} - ${project.title}` : "No Project",
        summaryTitle: project ? `${project.code} - ${project.title}` : "No Project"
      },
      {
        key: "sprint",
        filter: "board-sprint",
        label: "Sprint",
        optionsHtml: boardSprintOptionsHtml(project),
        summary: sprintSummary.label,
        summaryTitle: sprintSummary.title
      }
    ];
  }

  function boardProjectOptionsHtml() {
    return state.projects
      .map(project => `<option value="${project.id}" ${project.id === boardProjectId ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`)
      .join("");
  }

  function boardSprintOptionsHtml(project = boardProject()) {
    return `
      <option value="latest" ${boardSprintMode === "latest" ? "selected" : ""}>Latest Sprint</option>
      <option value="all" ${boardSprintMode === "all" ? "selected" : ""}>All Sprints</option>
      ${state.sprints
        .filter(sprint => sprint.projectId === project?.id)
        .map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === boardSprintMode ? "selected" : ""}>${escapeHtml(sprint.code)}</option>`)
        .join("")}
    `;
  }

  function boardProject() {
    return state.projects.find(item => item.id === boardProjectId) || state.projects[0];
  }

  function ensureBoardProject() {
    const project = boardProject();
    if (!project || project.id === boardProjectId) return;

    boardProjectId = project.id;
    writePreference(preferenceKeys.boardProject, boardProjectId);
  }

  function ensureBoardSprintMode(project = boardProject()) {
    if (boardSprintMode === "latest" || boardSprintMode === "all") return;
    if (state.sprints.some(sprint => sprint.id === Number(boardSprintMode) && sprint.projectId === project?.id)) return;

    boardSprintMode = "latest";
    writePreference(preferenceKeys.boardSprint, boardSprintMode);
  }

  async function handleAction(action, id) {
    if (action === "open-board-filters" || action === "toggle-board-filters") {
      openBoardFiltersDialog();
      return true;
    }
    if (action === "toggle-board-edit-mode") {
      boardEditMode.toggle();
      selectedBoardDeleteIds.clear();
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
    if (action === "delete-task" && selectedBoardDeleteIds.has(id)) {
      await deleteSelectedBoardItems();
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
    modal.addEventListener("input", event => {
      const target = event.target;
      if (target?.dataset?.filter !== "board-search") return;
      if (!applyBoardFilterChange(target)) return;

      renderBoard();
    });
    modal.addEventListener("change", event => {
      const target = event.target;
      const filter = target?.dataset?.filter || "";
      if (filter === "board-search") return;
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
    const project = boardProject();

    return `
      <div class="tasks-filter-panel board-filter-panel">
        <div class="task-filter-row board-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="board-project">
              ${boardProjectOptionsHtml()}
            </select>
          </label>
          <label>
            <span>Sprint</span>
            <select data-filter="board-sprint">
              ${boardSprintOptionsHtml(project)}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input type="search" data-filter="board-search" value="${escapeAttr(boardSearch)}">
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
          ${filterCheckList("Assignees", "board-user", boardUserFilterItems(), boardUserIds, {
            className: "user-card-check-list",
            renderItem: userCardCheckListLabelHtml
          })}
        </div>
      </div>
    `;
  }

  function applyBoardFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("board-")) return false;

    if (filter === "board-project") {
      boardProjectId = Number(target.value);
      boardSprintMode = "latest";
      writePreference(preferenceKeys.boardProject, boardProjectId);
      writePreference(preferenceKeys.boardSprint, boardSprintMode);
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
    if (filter === "board-search") {
      boardSearch = target.value;
      writePreference(preferenceKeys.boardSearch, boardSearch);
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
    if (filter === "board-user") {
      boardUserIds = checkedFilterValues("board-user");
      writeJsonPreference(preferenceKeys.boardUsers, boardUserIds);
      return true;
    }
    return false;
  }

  function boardUserFilterItems() {
    return state.users.map(user => ({
      ...user,
      value: user.id,
      text: user.nickname
    }));
  }

  function boardTaskMatchesUserFilter(task) {
    if (!boardUserIds.length) return true;

    const selectedIds = new Set(boardUserIds.map(String));
    return (task.assigneeIds || []).map(String).some(id => selectedIds.has(id));
  }

  function boardTaskMatchesSearchFilter(task) {
    const term = String(boardSearch || "").trim().toLowerCase();
    if (!term) return true;

    const project = state.projects.find(item => item.id === task.projectId);
    const sprint = state.sprints.find(item => item.id === task.sprintId);
    const people = [...(task.assignees || []), ...(task.reporters || [])];
    const values = [
      task.code,
      task.title,
      task.taskType,
      task.status,
      task.priority,
      task.severity,
      task.url,
      project?.code,
      project?.title,
      sprint?.code,
      sprint?.title,
      ...people.flatMap(user => [
        user.nickname,
        user.firstName,
        user.lastName,
        user.email
      ])
    ];

    return values.some(value => String(value ?? "").toLowerCase().includes(term));
  }

  function boardDeleteSelectionHtml(task) {
    const checked = selectedBoardDeleteIds.has(task.id);
    const taskLabel = [task.code, task.title].filter(Boolean).join(" - ");

    return `
      <label class="board-delete-selection" title="Select ${escapeAttr(taskLabel)} for bulk delete">
        <input type="checkbox" data-board-delete-select data-id="${task.id}" aria-label="Select ${escapeAttr(taskLabel)} for bulk delete" ${checked ? "checked" : ""} ${boardCanDelete(task) && !boardBulkDeleteBusy ? "" : "disabled"}>
      </label>
    `;
  }

  function bindBoardDeleteSelection() {
    app.querySelectorAll("[data-board-delete-select]").forEach(input => {
      input.addEventListener("change", () => {
        if (boardBulkDeleteBusy) return;
        const id = Number(input.dataset.id || 0);
        if (!id) return;

        if (input.checked) {
          selectedBoardDeleteIds.add(id);
        } else {
          selectedBoardDeleteIds.delete(id);
        }
        syncBoardDeleteSelectionControls();
      });
    });

    syncBoardDeleteSelectionControls();
    queueMicrotask(syncBoardDeleteSelectionControls);
  }

  function syncBoardDeleteSelectionControls() {
    const selectedTitle = boardSelectedDeleteTitle();

    app.querySelectorAll("[data-board-delete-select]").forEach(input => {
      const id = Number(input.dataset.id || 0);
      const task = taskById(id);
      input.checked = selectedBoardDeleteIds.has(id);
      input.disabled = boardBulkDeleteBusy || !boardCanDelete(task);
    });

    app.querySelectorAll(".board-screen .task-card [data-action='delete-task']").forEach(button => {
      const id = Number(button.dataset.id || 0);
      const task = taskById(id);
      const title = selectedBoardDeleteIds.has(id) ? selectedTitle : "Delete";
      button.dataset.securityResource = task?.taskType === "Bug" ? "BugTracking" : "DevTasks";
      button.disabled = boardBulkDeleteBusy || !boardCanDelete(task);
      button.title = title;
      button.setAttribute("aria-label", title);
    });
  }

  function pruneBoardDeleteSelection(tasks) {
    if (!boardEditMode.active) {
      selectedBoardDeleteIds.clear();
      return;
    }

    const visibleIds = new Set(tasks.filter(boardCanDelete).map(task => task.id));
    [...selectedBoardDeleteIds].forEach(id => {
      if (!visibleIds.has(id)) selectedBoardDeleteIds.delete(id);
    });
  }

  function boardCanDelete(task) {
    if (!task) return false;
    return task.taskType === "Bug"
      ? canAccessResource("BugTracking", "Delete")
      : canAccessResource("DevTasks", "Delete");
  }

  function boardSelectedDeleteTitle(count = selectedBoardDeleteIds.size) {
    return count === 1
      ? "Delete selected Work Item"
      : `Delete ${count} selected Work Items`;
  }

  async function deleteSelectedBoardItems() {
    const tasks = [...selectedBoardDeleteIds]
      .map(taskById)
      .filter(boardCanDelete)
      .sort((left, right) => boardTaskDeleteDepth(left) - boardTaskDeleteDepth(right));
    if (!tasks.length) return;

    const count = tasks.length;
    const coveredByParentDelete = new Set();
    const requestTasks = [];
    tasks.forEach(task => {
      if (coveredByParentDelete.has(task.id)) return;

      requestTasks.push(task);
      state.tasks
        .filter(candidate => candidate.parentTaskId === task.id)
        .forEach(candidate => coveredByParentDelete.add(candidate.id));
    });
    const includesParent = tasks.some(task =>
      state.tasks.some(candidate => candidate.parentTaskId === task.id));
    const childWarning = includesParent ? " Deleting a parent also deletes its direct sub-tasks." : "";

    boardBulkDeleteBusy = true;
    syncBoardDeleteSelectionControls();
    try {
      await deleteItems(
        requestTasks.map(task => `/api/tasks/${task.id}`),
        `${boardSelectedDeleteTitle(count)}?${childWarning}`,
        `${count} Work Item${count === 1 ? "" : "s"} deleted.`
      );
    } finally {
      boardBulkDeleteBusy = false;
      syncBoardDeleteSelectionControls();
    }
  }

  function boardTaskDeleteDepth(task) {
    let depth = 0;
    let parentId = task?.parentTaskId;
    const visited = new Set();

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = taskById(parentId);
      if (!parent) break;
      depth += 1;
      parentId = parent.parentTaskId;
    }

    return depth;
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
    boardSearch = readPreference(preferenceKeys.boardSearch, boardSearch);
    boardSort = readPreference(preferenceKeys.boardSort, boardSort);
    boardHideEmptyColumns = true;
    writePreference(preferenceKeys.boardHideEmptyColumns, boardHideEmptyColumns);
  }

  function deactivateBoard() {
    boardIsActive = false;
    boardBulkDeleteBusy = false;
    selectedBoardDeleteIds.clear();
    boardHeader.deactivate();
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

    return workItemKanbanCardHtml(task, {
      actionAttrs: readOnlyActionAttrs,
      canDrag,
      actionsHtml: boardEditMode.active ? `${boardDeleteSelectionHtml(task)}${taskButtonsHtml(task)}` : ""
    });
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
    const boardScrollLeft = currentBoardScrollLeft();
    try {
      if (statusChanged) {
        const moved = await updateTaskStatus(task, newStatus);
        if (!moved) return;
        await loadState();
      }

      if (taskIds.length > 1) {
        const expectedRowVersions = Object.fromEntries(
          taskIds.map(id => [id, taskById(id)?.rowVersion || null])
        );
        await saveJson("/api/tasks/reorder", "POST", { taskIds, expectedRowVersions });
      }

      boardSort = "custom";
      writePreference(preferenceKeys.boardSort, boardSort);

      await loadState();
      render();
      restoreBoardScrollLeft(boardScrollLeft);
      showToast(statusChanged ? `Moved to ${newStatus}.` : "Order saved.");
    } catch (error) {
      await loadState();
      render();
      restoreBoardScrollLeft(boardScrollLeft);
      showToast(error.message);
    }
  }

  function currentBoardScrollLeft() {
    return app.querySelector(".board")?.scrollLeft || 0;
  }

  function restoreBoardScrollLeft(scrollLeft) {
    const board = app.querySelector(".board");
    if (board) board.scrollLeft = scrollLeft;
  }

  async function updateTaskStatus(task, status) {
    try {
      validateDeveloperDevTaskStatus(currentUser(), task, status);
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
        rootCauseAnalysisHtml: task.rootCauseAnalysisHtml || "",
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
        dependencyTaskIds: task.dependencyTaskIds,
        expectedRowVersion: task.rowVersion || null
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
      preferenceKeys.boardSearch,
      preferenceKeys.boardSort,
      preferenceKeys.boardStatuses,
      preferenceKeys.boardHideEmptyColumns,
      preferenceKeys.boardUsers,
      preferenceKeys.boardFiltersVisible
    ].forEach(removePreference);

    boardProjectId = 0;
    boardSprintMode = "latest";
    boardSearch = "";
    boardSort = "custom";
    boardHideEmptyColumns = true;
    boardUserIds = [];
    boardStatuses = [...getStatuses()];
    boardBulkDeleteBusy = false;
    selectedBoardDeleteIds.clear();
    boardHeader.reset();
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
