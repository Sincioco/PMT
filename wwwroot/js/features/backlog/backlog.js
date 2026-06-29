import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { bugIconHtml, buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js";
import { progressHtml } from "../../components/progress-and-status.js?v=20260627-dev-task-status-rules";
import { sectionHead } from "../../components/sections.js";
import {
  bugFixIconHtml,
  createWorkItemTableMode
} from "../../components/work-items.js?v=20260627-dev-task-status-rules";
import {
  preferenceKeys,
  readJsonPreference,
  writeJsonPreference
} from "../../core/preferences.js?v=20260629-backlog-subtasks";
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
  taskDisplayPercent,
  taskOrderCompare,
  taskRowsWithSubTasks
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
  let backlogCollapsedSubTasks = readJsonPreference(preferenceKeys.backlogCollapsedSubTasks, {});
  const backlogTableMode = createWorkItemTableMode({
    action: "toggle-backlog-table-edit-mode",
    itemLabel: "Backlog"
  });

  backlogFilters.taskTypes = normalizeSavedArray(backlogFilters.taskTypes);
  backlogFilters.priorities = normalizeSavedArray(backlogFilters.priorities);
  backlogFilters.assigneeIds = normalizeSavedArray(backlogFilters.assigneeIds);
  backlogFilters.sprintId = backlogFilters.sprintId || "all";
  backlogFilters.sort = backlogFilters.sort || "custom";
  if (!backlogCollapsedSubTasks || Array.isArray(backlogCollapsedSubTasks) || typeof backlogCollapsedSubTasks !== "object") {
    backlogCollapsedSubTasks = {};
  }

  function renderBacklog() {
    ensureBacklogFilters();
    const backlogItems = filteredBacklogItems();
    const backlogChildrenByParent = backlogChildTasksByParent(backlogItems);
    const backlogRows = backlogRowsWithVisibleSubTasks(backlogItems);
    const assigneeColumnWidth = backlogAssigneeColumnWidth(backlogRows);
    const assigneeHeader = backlogRowsHaveMultipleAssignees(backlogRows) ? "Assignee(s)" : "Assignee";

    app.innerHTML = `
      <section class="backlog-screen work-item-screen">
        ${sectionHead("Backlog", `
          <button class="primary text-icon-button" type="button" data-action="new-backlog-task" title="New Dev Task" aria-label="New Dev Task">${buttonContent("&#10010;", "New Dev Task")}</button>
          <button class="primary text-icon-button" type="button" data-action="new-backlog-bug" title="New Bug Report" aria-label="New Bug Report">${buttonContent(bugIconHtml(), "New Bug Report")}</button>
          ${backlogTableMode.buttonHtml()}
          <button class="secondary text-icon-button" type="button" data-action="open-backlog-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
        `)}
        <div class="panel work-item-table-panel backlog-table-panel">
          <table class="table work-item-table backlog-table ${backlogTableMode.active ? "is-edit-mode" : "is-read-mode"}" style="--backlog-assignee-width:${assigneeColumnWidth}px">
            <colgroup>
              <col class="backlog-expand-column">
              <col class="backlog-assigned-column">
              <col class="backlog-item-column">
              <col class="backlog-type-column">
              <col class="backlog-project-column">
              <col class="backlog-sprint-column">
              <col class="backlog-status-column">
              <col class="backlog-priority-column">
              <col class="backlog-complete-column">
              ${backlogTableMode.active ? `<col class="backlog-action-column">` : ""}
            </colgroup>
            <thead>
              <tr>
                <th class="backlog-expand-heading" aria-label="Expand or collapse sub-tasks"></th>
                ${backlogSortHeaderHtml("assigned", assigneeHeader)}
                ${backlogSortHeaderHtml("item", "Item")}
                ${backlogSortHeaderHtml("type", "Type")}
                ${backlogSortHeaderHtml("project", "Project")}
                ${backlogSortHeaderHtml("sprint", "Sprint")}
                ${backlogSortHeaderHtml("status", "Status")}
                ${backlogSortHeaderHtml("priority", "Priority")}
                ${backlogSortHeaderHtml("percent", "% Complete", "done-cell")}
                ${backlogTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
              </tr>
            </thead>
            <tbody data-reorder-list="backlog">
              ${backlogRows.map(row => {
                const task = row.task;
                const hasVisibleSubTasks = backlogHasVisibleSubTasks(task, backlogChildrenByParent);
                const isSubTasksCollapsed = backlogSubTasksCollapsed(task.id);
                const rowClass = [
                  row.level ? "subtask-row" : "",
                  hasVisibleSubTasks ? "has-subtasks" : "",
                  hasVisibleSubTasks && isSubTasksCollapsed ? "is-subtasks-collapsed" : "",
                  "clickable-row"
                ].filter(Boolean).join(" ");
                const titleClass = row.level ? "work-item-title-cell backlog-subtask-title-cell" : "work-item-title-cell";
                const indent = Math.min(row.level, 4) * 20;

                return `
                <tr class="${rowClass}" data-action="view-backlog-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${backlogTableMode.active ? "true" : "false"}" draggable="false" style="--indent:${indent}px">
                  <td class="backlog-expand-cell">${hasVisibleSubTasks ? backlogSubTaskToggleHtml(task, isSubTasksCollapsed) : ""}</td>
                  <td class="backlog-assignee-cell">${taskRowAvatarsHtml(task.assignees)}</td>
                  <td class="${titleClass}">
                    <span class="work-item-code-line">
                      <strong class="work-item-code">${escapeHtml(task.code)}</strong>
                      ${row.level ? `<span class="subtask-pill">Subtask</span>` : ""}
                    </span>
                    <span class="work-item-title">${bugFixIconHtml(task)}${escapeHtml(task.title)}</span>
                  </td>
                  <td><span class="pill">${escapeHtml(task.taskType || "Dev")}</span></td>
                  <td class="work-item-context-cell backlog-project-cell">${escapeHtml(projectName(task.projectId))}</td>
                  <td class="work-item-context-cell">${task.sprintId ? `<span class="pill sprint-pill">${escapeHtml(sprintName(task.sprintId))}</span>` : `<span class="muted">Unassigned</span>`}</td>
                  <td class="work-item-context-cell">${escapeHtml(task.status)}</td>
                  <td><span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span></td>
                  <td class="done-cell">${workItemTableProgressHtml(taskDisplayPercent(task))}</td>
                  ${backlogTableMode.active ? `<td class="reveal-actions action-cell">${backlogTaskButtonsHtml(task)}</td>` : ""}
                </tr>
              `;
              }).join("") || `<tr><td colspan="${backlogTableMode.active ? 10 : 9}"><div class="empty">No backlog items match the current filters.</div></td></tr>`}
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

  async function handleAction(action, id, element) {
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
    if (action === "sort-backlog-table") {
      return updateBacklogTableSort(element);
    }
    if (action === "open-backlog-filters") {
      openBacklogFiltersDialog();
      return true;
    }
    if (action === "toggle-backlog-subtasks" && task) {
      toggleBacklogSubTasks(task.id);
      renderBacklog();
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
              ${backlogSortOptionsHtml()}
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

    return items.sort(backlogMainTaskSortCompare);
  }

  function workItemTableProgressHtml(percent) {
    const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));

    return `
      <div class="work-item-table-progress">
        <span class="work-item-table-progress-label">${safePercent}%</span>
        ${progressHtml(safePercent)}
      </div>
    `;
  }

  function backlogChildTasksByParent(tasks) {
    const taskIds = new Set(tasks.map(task => task.id));
    const childrenByParent = new Map();

    tasks.forEach(task => {
      if (!task.parentTaskId || !taskIds.has(task.parentTaskId)) return;
      if (!childrenByParent.has(task.parentTaskId)) childrenByParent.set(task.parentTaskId, []);
      childrenByParent.get(task.parentTaskId).push(task);
    });

    return childrenByParent;
  }

  function backlogRowsWithVisibleSubTasks(tasks) {
    const taskMap = new Map(tasks.map(task => [task.id, task]));

    return taskRowsWithSubTasks(tasks)
      .filter(row => !row.level || !backlogHasCollapsedAncestor(row.task, taskMap));
  }

  function backlogHasVisibleSubTasks(task, childrenByParent) {
    return Boolean(childrenByParent.get(task.id)?.length);
  }

  function backlogHasCollapsedAncestor(task, taskMap) {
    let parentId = task.parentTaskId;
    const visited = new Set();

    while (parentId && taskMap.has(parentId) && !visited.has(parentId)) {
      if (backlogSubTasksCollapsed(parentId)) return true;
      visited.add(parentId);
      parentId = taskMap.get(parentId)?.parentTaskId;
    }

    return false;
  }

  function backlogSubTasksCollapsed(taskId) {
    return backlogCollapsedSubTasks[String(taskId)] === true;
  }

  function toggleBacklogSubTasks(taskId) {
    const key = String(taskId);
    if (backlogCollapsedSubTasks[key]) {
      delete backlogCollapsedSubTasks[key];
    } else {
      backlogCollapsedSubTasks[key] = true;
    }

    writeJsonPreference(preferenceKeys.backlogCollapsedSubTasks, backlogCollapsedSubTasks);
  }

  function backlogSubTaskToggleHtml(task, isCollapsed) {
    const label = isCollapsed ? "Expand sub-tasks" : "Collapse sub-tasks";

    return `
      <button
        type="button"
        class="task-subtask-toggle"
        data-action="toggle-backlog-subtasks"
        data-id="${task.id}"
        title="${label}"
        aria-label="${label}"
        aria-expanded="${!isCollapsed}">
        <span aria-hidden="true">${isCollapsed ? "&#43;" : "&#8722;"}</span>
      </button>
    `;
  }

  function backlogAssigneeColumnWidth(backlogRows) {
    const avatarSize = 60;
    const overlapWidth = 42;
    const cellPadding = 34;
    const maxAssigneeCount = Math.max(
      1,
      ...backlogRows.map(row => Array.isArray(row.task.assignees) ? row.task.assignees.length : 0)
    );

    return cellPadding + avatarSize + ((maxAssigneeCount - 1) * overlapWidth);
  }

  function backlogRowsHaveMultipleAssignees(backlogRows) {
    return backlogRows.some(row => Array.isArray(row.task.assignees) && row.task.assignees.length > 1);
  }

  function backlogMainTaskSortCompare(a, b) {
    const aIsSubTask = Boolean(a.parentTaskId);
    const bIsSubTask = Boolean(b.parentTaskId);

    if (aIsSubTask && bIsSubTask) return taskOrderCompare(a, b);
    if (aIsSubTask) return 1;
    if (bIsSubTask) return -1;

    return backlogSortCompare(a, b);
  }

  function backlogSortCompare(a, b) {
    const state = backlogTableSortState();

    if (state.column && state.direction) {
      const result = compareBacklogSortColumn(a, b, state.column);
      if (result) return state.direction === "asc" ? result : -result;
      return taskOrderCompare(a, b);
    }

    if (backlogFilters.sort === "newest") return taskCreatedTime(b) - taskCreatedTime(a) || b.id - a.id;
    if (backlogFilters.sort === "oldest") return taskCreatedTime(a) - taskCreatedTime(b) || a.id - b.id;
    return taskOrderCompare(a, b);
  }

  function compareBacklogSortColumn(a, b, column) {
    if (column === "percent") return taskDisplayPercent(a) - taskDisplayPercent(b);
    if (column === "priority") return compareLookupSortValue(a.priority, b.priority, getPriorities());
    if (column === "type") return compareLookupSortValue(a.taskType || "Dev", b.taskType || "Dev", ["Dev", "Bug"]);

    return backlogSortTextValue(a, column).localeCompare(backlogSortTextValue(b, column), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function backlogSortTextValue(task, column) {
    if (column === "assigned") return userNames(task.assignees);
    if (column === "item") return `${task.code || ""} ${task.title || ""}`;
    if (column === "project") return projectName(task.projectId);
    if (column === "sprint") return task.sprintId ? sprintName(task.sprintId) : "Unassigned";
    if (column === "status") return task.status || "";
    return "";
  }

  function compareLookupSortValue(a, b, orderedValues) {
    const aIndex = orderedValues.indexOf(a);
    const bIndex = orderedValues.indexOf(b);
    const aSort = aIndex >= 0 ? aIndex : Number.MAX_SAFE_INTEGER;
    const bSort = bIndex >= 0 ? bIndex : Number.MAX_SAFE_INTEGER;
    return aSort - bSort || String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
  }

  function userNames(users) {
    return (users || [])
      .map(user => user.nickname || "")
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .join(", ");
  }

  function backlogSortHeaderHtml(column, label, className = "") {
    const state = backlogTableSortState();
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const classes = [className, isSorted ? "is-sorted" : ""].filter(Boolean).join(" ");

    return `
      <th class="${classes}" aria-sort="${ariaSort}">
        <button type="button" class="table-sort-button" data-action="sort-backlog-table" data-column="${escapeAttr(column)}" title="${escapeAttr(backlogNextSortLabel(column, label))}">
          <span>${escapeHtml(label)}</span>
          <span class="table-sort-indicator" aria-hidden="true">${arrow}</span>
        </button>
      </th>
    `;
  }

  function updateBacklogTableSort(button) {
    const column = button?.dataset?.column || "";
    if (!backlogTableSortColumns().some(item => item.column === column)) return false;

    backlogFilters.sort = nextBacklogSort(column);
    writeJsonPreference(preferenceKeys.backlogFilters, backlogFilters);
    renderBacklog();
    return true;
  }

  function nextBacklogSort(column) {
    const state = backlogTableSortState();
    if (state.column !== column || !state.direction) return `${column}-asc`;
    if (state.direction === "asc") return `${column}-desc`;
    return "custom";
  }

  function backlogTableSortState(sortValue = backlogFilters.sort) {
    const match = /^(.+)-(asc|desc)$/.exec(sortValue || "");
    if (!match) return { column: "", direction: "" };
    return { column: match[1], direction: match[2] };
  }

  function backlogSortOptionsHtml() {
    const selectedSort = backlogFilters.sort || "custom";
    const options = [
      { value: "custom", text: "Custom Order (Saved Order)" },
      { value: "newest", text: "Newest Items" },
      { value: "oldest", text: "Oldest Items" },
      ...backlogTableSortColumns().flatMap(column => [
        { value: `${column.column}-asc`, text: `${column.label} Ascending` },
        { value: `${column.column}-desc`, text: `${column.label} Descending` }
      ])
    ];

    return options
      .map(option => `<option value="${escapeAttr(option.value)}" ${selectedSort === option.value ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
      .join("");
  }

  function backlogTableSortColumns() {
    return [
      { column: "assigned", label: "Assigned" },
      { column: "item", label: "Item" },
      { column: "type", label: "Type" },
      { column: "project", label: "Project" },
      { column: "sprint", label: "Sprint" },
      { column: "status", label: "Status" },
      { column: "priority", label: "Priority" },
      { column: "percent", label: "% Complete" }
    ];
  }

  function backlogNextSortLabel(column, label) {
    const state = backlogTableSortState();
    if (state.column === column && state.direction === "asc") return `Sort ${label} descending`;
    if (state.column === column && state.direction === "desc") return `Clear ${label} sort`;
    return `Sort ${label} ascending`;
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
