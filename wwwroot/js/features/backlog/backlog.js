import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { bugIconHtml, buttonContent, funnelIconHtml, iconButton } from "../../components/buttons.js";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js?v=20260630-filter-renderer";
import {
  userCardCheckListLabelHtml
} from "../../components/forms.js?v=20260629-avatar-jpg-assets";
import { progressHtml } from "../../components/progress-and-status.js?v=20260627-dev-task-status-rules";
import { sectionHead } from "../../components/sections.js";
import {
  bugFixIconHtml,
  createWorkItemTableMode
} from "../../components/work-items.js?v=20260629-avatar-jpg-assets";
import {
  preferenceKeys,
  readJsonPreference,
  removePreference,
  writeJsonPreference
} from "../../core/preferences.js?v=20260630-backlog-task-parity";
import { state } from "../../core/store.js";
import {
  formatDate,
  formatDateTime
} from "../../shared/dates.js?v=20260620-null-end-date";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import {
  downloadXlsx,
  downloadCsv,
  exportIconHtml,
  exportFileName,
  assertImportItemCode,
  importCell,
  importWorkbookTypeError,
  importIconHtml,
  openExcelImport,
  openExportDialog,
  parseImportAssigneeIds,
  parseImportItemId,
  parseImportPercent,
  showImportResultDialog,
  sameNumberList,
  uniqueIds,
  workItemImportHash,
  workItemSystemColumns
} from "../../shared/table-export.js?v=20260630-export-icons-centered";
import {
  projectName,
  sprintName,
  taskById,
  userById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import {
  taskCreatedTime,
  taskDisplayPercent,
  taskOrderCompare,
  taskRowsWithSubTasks,
  associatedBugForDevTask,
  allowedAssigneeUsers,
  percentForDevTaskSave,
  percentForStatus,
  validateLinkedBugCompletion
} from "../../shared/work-item-rules.js?v=20260627-dev-task-status-rules";

const backlogBugFixIconUrl = "/assets/bug.svg?v=20260629-kanban-gantt-bug-icon";

export function createBacklogFeature({
  app,
  deleteItem,
  duplicateTask,
  editBug,
  editTask,
  getPriorities,
  getStatuses,
  refreshAfterImport,
  saveJson,
  viewTask
}) {
  let backlogFilters = readJsonPreference(preferenceKeys.backlogFilters, {});
  let backlogCollapsedSubTasks = readJsonPreference(preferenceKeys.backlogCollapsedSubTasks, {});
  let backlogColumnPrefs = normalizeBacklogColumnPrefs(readJsonPreference(preferenceKeys.backlogTableColumns, {}));
  let backlogColumnDrag = null;
  let lastBacklogColumnPointerDragAt = 0;
  let suppressNextBacklogColumnClick = false;
  const backlogTableMode = createWorkItemTableMode({
    action: "toggle-backlog-table-edit-mode",
    itemLabel: "Backlog"
  });

  backlogFilters = normalizeBacklogFilters(backlogFilters);
  if (!backlogCollapsedSubTasks || Array.isArray(backlogCollapsedSubTasks) || typeof backlogCollapsedSubTasks !== "object") {
    backlogCollapsedSubTasks = {};
  }

  bindBacklogColumnDragEvents();

  function renderBacklog() {
    ensureBacklogFilters();
    const backlogItems = filteredBacklogItems();
    const backlogChildrenByParent = backlogChildTasksByParent(backlogItems);
    const backlogRows = backlogRowsWithVisibleSubTasks(backlogItems);
    const assigneeColumnWidth = backlogAssigneeColumnWidth(backlogRows);
    const assigneeHeader = backlogRowsHaveMultipleAssignees(backlogRows) ? "Assignee(s)" : "Assignee";
    const visibleBacklogColumns = backlogVisibleTableColumns(assigneeHeader);
    const emptyTableColspan = visibleBacklogColumns.length + (backlogTableMode.active ? 2 : 1);

    app.innerHTML = `
      <section class="backlog-screen work-item-screen">
        ${sectionHead("Backlog", `
          <button class="primary text-icon-button" type="button" data-action="new-backlog-task" title="New Dev Task" aria-label="New Dev Task">${buttonContent("&#10010;", "New Dev Task")}</button>
          <button class="primary text-icon-button" type="button" data-action="new-backlog-bug" title="New Bug Report" aria-label="New Bug Report">${buttonContent(bugIconHtml(), "New Bug Report")}</button>
          ${backlogTableMode.buttonHtml()}
          <button class="secondary text-icon-button" type="button" data-action="open-backlog-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
          <button class="secondary text-icon-button" type="button" data-action="export-backlog-view" title="Export" aria-label="Export" aria-haspopup="dialog">${buttonContent(exportIconHtml(), "Export")}</button>
          <button class="secondary text-icon-button" type="button" data-action="import-backlog-view" title="Import" aria-label="Import">${buttonContent(importIconHtml(), "Import")}</button>
          <button class="secondary text-icon-button" type="button" data-action="reset-backlog-view" title="Reset View" aria-label="Reset View">${buttonContent("&#8634;", "Reset View")}</button>
        `)}
        <div class="panel work-item-table-panel backlog-table-panel">
          <table class="table work-item-table backlog-table ${backlogTableMode.active ? "is-edit-mode" : "is-read-mode"}" style="--backlog-assignee-width:${assigneeColumnWidth}px; --backlog-table-min-width:${backlogTableMinWidth(visibleBacklogColumns)}px">
            <colgroup>
              <col class="backlog-expand-column">
              ${visibleBacklogColumns.map((column, index) => backlogTableColumnColHtml(column, backlogColumnIsRubber(visibleBacklogColumns, index))).join("")}
              ${backlogTableMode.active ? `<col class="backlog-action-column">` : ""}
            </colgroup>
            <thead>
              <tr>
                <th class="backlog-expand-heading" aria-label="Expand or collapse sub-tasks"></th>
                ${visibleBacklogColumns.map((column, index) => backlogColumnHeaderHtml(column, backlogColumnIsRubber(visibleBacklogColumns, index))).join("")}
                ${backlogTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
              </tr>
            </thead>
            <tbody data-reorder-list="backlog">
              ${backlogRows.map(row => {
                const task = row.task;
                const hasVisibleSubTasks = backlogHasVisibleSubTasks(task, backlogChildrenByParent);
                const isSubTasksCollapsed = backlogSubTasksCollapsed(task.id);
                const hasBugTreatment = backlogHasBugTreatment(task);
                const bugFixRowIcon = hasBugTreatment ? backlogBugFixRowIconHtml(task) : "";
                const rowClass = [
                  row.level ? "subtask-row" : "",
                  hasBugTreatment ? "bug-associated-row" : "",
                  hasVisibleSubTasks ? "has-subtasks" : "",
                  hasVisibleSubTasks && isSubTasksCollapsed ? "is-subtasks-collapsed" : "",
                  "clickable-row"
                ].filter(Boolean).join(" ");
                const indent = Math.min(row.level, 4) * 20;

                return `
                <tr class="${rowClass}" data-action="view-backlog-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${backlogTableMode.active ? "true" : "false"}" draggable="false" style="--indent:${indent}px">
                  <td class="backlog-expand-cell">${hasVisibleSubTasks ? backlogSubTaskToggleHtml(task, isSubTasksCollapsed) : ""}</td>
                  ${visibleBacklogColumns.map((column, index) => backlogTableColumnCellHtml(column, task, row, { bugFixRowIcon }, backlogColumnIsRubber(visibleBacklogColumns, index))).join("")}
                  ${backlogTableMode.active ? `<td class="reveal-actions action-cell">${backlogTaskButtonsHtml(task)}</td>` : ""}
                </tr>
              `;
              }).join("") || `<tr><td colspan="${emptyTableColspan}"><div class="empty">No backlog items match the current filters.</div></td></tr>`}
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
    if (action === "export-backlog-view") {
      openBacklogExportDialog();
      return true;
    }
    if (action === "import-backlog-view") {
      openBacklogImport();
      return true;
    }
    if (action === "reset-backlog-view") {
      resetBacklogView();
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
      existingDialog.querySelector("[data-filter='backlog-search']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog backlog-filter-dialog";
    modal.dataset.backlogFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Backlog Filters</h2>
          <button type="button" class="icon-btn" data-close-backlog-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body backlog-filter-dialog-body" data-backlog-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-backlog-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderBacklogFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("input", event => {
      if (!applyBacklogFilterChange(event.target)) return;
      renderBacklog();
    });
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
    modal.querySelector("[data-filter='backlog-search']")?.focus({ preventScroll: true });
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
            <span>Search</span>
            <input type="text" data-filter="backlog-search" value="${escapeAttr(backlogFilters.search)}">
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
          ${filterCheckList("Assignees", "backlog-assigned", backlogUserFilterItems(), backlogFilters.assigneeIds, {
            className: "user-card-check-list",
            renderItem: userCardCheckListLabelHtml
          })}
          ${filterCheckList("Columns", "backlog-column", backlogColumnFilterItems(), backlogColumnPrefs.visible)}
        </div>
      </div>
    `;
  }

  function backlogUserFilterItems() {
    return state.users.map(user => ({
      ...user,
      value: user.id,
      text: user.nickname
    }));
  }

  function applyBacklogFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("backlog-")) return false;

    if (filter === "backlog-project") {
      backlogFilters.projectId = target.value;
      backlogFilters.sprintId = "all";
    }
    if (filter === "backlog-sprint") backlogFilters.sprintId = target.value || "all";
    if (filter === "backlog-search") backlogFilters.search = target.value;
    if (filter === "backlog-sort") backlogFilters.sort = target.value;
    if (filter === "backlog-type") backlogFilters.taskTypes = checkedFilterValues("backlog-type");
    if (filter === "backlog-priority") backlogFilters.priorities = checkedFilterValues("backlog-priority");
    if (filter === "backlog-assigned") backlogFilters.assigneeIds = checkedFilterValues("backlog-assigned");
    if (filter === "backlog-column") {
      const visibleColumns = checkedFilterValues("backlog-column");
      if (!visibleColumns.length) {
        target.checked = true;
        return false;
      }
      const addedColumns = visibleColumns.filter(column => !backlogColumnPrefs.visible.includes(column));
      backlogColumnPrefs = normalizeBacklogColumnPrefs({
        ...backlogColumnPrefs,
        order: backlogColumnOrderWithAddedColumns(backlogColumnPrefs.order, addedColumns),
        visible: visibleColumns
      });
      saveBacklogColumnPrefs();
      return true;
    }

    writeJsonPreference(preferenceKeys.backlogFilters, backlogFilters);
    return true;
  }

  function normalizeBacklogFilters(filters = {}) {
    return {
      ...filters,
      taskTypes: normalizeSavedArray(filters.taskTypes),
      priorities: normalizeSavedArray(filters.priorities),
      assigneeIds: normalizeSavedArray(filters.assigneeIds),
      sprintId: filters.sprintId || "all",
      sort: filters.sort || "custom",
      search: String(filters.search || "")
    };
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
      .filter(task => backlogMatchesSearchFilter(task))
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

  function backlogMatchesSearchFilter(task) {
    const term = String(backlogFilters.search || "").trim().toLowerCase();
    if (!term) return true;

    return backlogSearchValues(task)
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(term));
  }

  function backlogSearchValues(task) {
    return [
      task.code,
      task.title,
      backlogTaskTypeLabel(task),
      projectName(task.projectId),
      backlogSprintLabel(task),
      task.status,
      task.priority,
      task.severity,
      task.environment,
      userNames(task.assignees),
      userNames(task.reporters),
      backlogRelatedTaskLabel(task.parentTaskId),
      backlogLinkedBugLabel(task),
      backlogDependencyLabel(task),
      task.url,
      task.sortOrder,
      backlogUserName(task.createdByUserId),
      backlogUserName(task.updatedByUserId),
      formatDate(task.startDate),
      formatDate(task.endDate),
      formatDateTime(task.createdAt),
      formatDateTime(task.updatedAt)
    ];
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

  function backlogTaskTypeLabel(task) {
    return task.taskType === "Bug" ? "Bug" : "Dev";
  }

  function backlogSprintLabel(task) {
    return task.sprintId ? sprintName(task.sprintId) : "Unassigned";
  }

  function backlogRelatedTaskLabel(taskId) {
    const task = taskId ? taskById(taskId) : null;
    return task ? backlogDisplayLabel(task) : "";
  }

  function backlogLinkedBugLabel(task) {
    if (task.taskType === "Bug") return "";
    const bug = associatedBugForDevTask(task, task.dependencyTaskIds);
    return bug ? backlogDisplayLabel(bug) : "";
  }

  function backlogDependencyLabel(task) {
    return (task.dependencyTaskIds || [])
      .map(taskId => taskById(taskId))
      .filter(Boolean)
      .map(backlogDisplayLabel)
      .join(", ");
  }

  function backlogDisplayLabel(task) {
    return [task.code, task.title].filter(Boolean).join(" - ");
  }

  function backlogUserName(userId) {
    const user = userId ? userById(Number(userId)) : null;
    return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
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

  function backlogHasBugTreatment(task) {
    return task?.taskType === "Bug" || Boolean(associatedBugForDevTask(task, task.dependencyTaskIds));
  }

  function backlogBugFixRowIconHtml(task) {
    const label = task?.taskType === "Bug" ? "Bug" : "Bug Fix";
    return `<img class="task-bug-fix-row-icon" src="${backlogBugFixIconUrl}" title="${label}" alt="${label}">`;
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
    if (column === "sortOrder") return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (column === "attachmentCount") return Number(a.attachments?.length || 0) - Number(b.attachments?.length || 0);
    if (column === "startDate") return compareBacklogDateValue(a.startDate, b.startDate);
    if (column === "endDate") return compareBacklogDateValue(a.endDate, b.endDate);
    if (column === "startedAt") return compareBacklogDateValue(a.startedAt, b.startedAt);
    if (column === "createdAt") return compareBacklogDateValue(a.createdAt, b.createdAt);
    if (column === "updatedAt") return compareBacklogDateValue(a.updatedAt, b.updatedAt);
    if (column === "priority") return compareLookupSortValue(a.priority, b.priority, getPriorities());
    if (column === "type") return compareLookupSortValue(a.taskType || "Dev", b.taskType || "Dev", ["Dev", "Bug"]);

    return backlogSortTextValue(a, column).localeCompare(backlogSortTextValue(b, column), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function backlogSortTextValue(task, column) {
    if (column === "assigned") return userNames(task.assignees);
    if (column === "reporter") return userNames(task.reporters);
    if (column === "item") return `${task.code || ""} ${task.title || ""}`;
    if (column === "type") return backlogTaskTypeLabel(task);
    if (column === "project") return projectName(task.projectId);
    if (column === "sprint") return backlogSprintLabel(task);
    if (column === "status") return task.status || "";
    if (column === "severity") return task.severity || "";
    if (column === "environment") return task.environment || "";
    if (column === "parentTask") return backlogRelatedTaskLabel(task.parentTaskId);
    if (column === "linkedBug") return backlogLinkedBugLabel(task);
    if (column === "dependencies") return backlogDependencyLabel(task);
    if (column === "url") return task.url || "";
    if (column === "createdBy") return backlogUserName(task.createdByUserId);
    if (column === "updatedBy") return backlogUserName(task.updatedByUserId);
    return "";
  }

  function compareBacklogDateValue(a, b) {
    const leftTime = a ? new Date(a).getTime() : 0;
    const rightTime = b ? new Date(b).getTime() : 0;
    const left = Number.isFinite(leftTime) ? leftTime : 0;
    const right = Number.isFinite(rightTime) ? rightTime : 0;
    return left - right;
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

  function backlogTableColumnDefinitions(assigneeHeader = "Assigned") {
    return [
      {
        key: "assigned",
        label: "Assigned",
        headerLabel: assigneeHeader,
        colClass: "backlog-assigned-column",
        headerClass: "backlog-avatar-heading",
        cellClass: "backlog-assignee-cell",
        width: 112,
        rubberMinWidth: 88,
        defaultVisible: true,
        cellHtml: task => taskRowAvatarsHtml(task.assignees)
      },
      {
        key: "item",
        label: "Item",
        colClass: "backlog-item-column",
        cellClass: (task, row) => `${row.level ? "backlog-title-cell backlog-subtask-title-cell" : "backlog-title-cell"} work-item-title-cell`,
        width: 320,
        rubberMinWidth: 180,
        defaultVisible: true,
        cellHtml: (task, row) => `
          <span class="work-item-code-line">
            <strong class="work-item-code">${escapeHtml(task.code)}</strong>
            ${row.level ? `<span class="subtask-pill">Subtask</span>` : ""}
          </span>
          <span class="work-item-title">${bugFixIconHtml(task)}${escapeHtml(task.title)}</span>
        `
      },
      {
        key: "type",
        label: "Type",
        colClass: "backlog-type-column",
        width: 96,
        rubberMinWidth: 86,
        defaultVisible: true,
        cellHtml: task => `<span class="pill">${escapeHtml(backlogTaskTypeLabel(task))}</span>`
      },
      {
        key: "project",
        label: "Project",
        colClass: "backlog-project-column",
        cellClass: "work-item-context-cell backlog-project-cell",
        width: 190,
        rubberMinWidth: 140,
        defaultVisible: true,
        cellHtml: task => escapeHtml(projectName(task.projectId))
      },
      {
        key: "sprint",
        label: "Sprint",
        colClass: "backlog-sprint-column",
        cellClass: "work-item-context-cell backlog-sprint-cell",
        width: 150,
        rubberMinWidth: 120,
        defaultVisible: true,
        cellHtml: task => task.sprintId
          ? `<span class="pill sprint-pill">${escapeHtml(sprintName(task.sprintId))}</span>`
          : `<span class="muted">Unassigned</span>`
      },
      {
        key: "status",
        label: "Status",
        colClass: "backlog-status-column",
        cellClass: "backlog-compact-text-cell",
        width: 120,
        rubberMinWidth: 100,
        defaultVisible: true,
        cellHtml: task => escapeHtml(task.status)
      },
      {
        key: "priority",
        label: "Priority",
        colClass: "backlog-priority-column",
        width: 96,
        rubberMinWidth: 86,
        defaultVisible: true,
        cellHtml: task => `<span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span>`
      },
      {
        key: "percent",
        label: "% Complete",
        colClass: "backlog-complete-column",
        headerClass: "done-cell backlog-complete-cell",
        cellClass: "done-cell backlog-complete-cell",
        width: 180,
        rubberMinWidth: 120,
        defaultVisible: true,
        cellHtml: (task, row, context) => `${workItemTableProgressHtml(taskDisplayPercent(task))}${context.bugFixRowIcon}`
      },
      {
        key: "reporter",
        label: "Reporter",
        headerClass: "backlog-avatar-heading",
        colClass: "backlog-reporter-column",
        cellClass: "backlog-reporter-cell",
        width: 112,
        rubberMinWidth: 88,
        cellHtml: task => taskRowAvatarsHtml(task.reporters)
      },
      {
        key: "severity",
        label: "Severity",
        colClass: "backlog-severity-column",
        width: 96,
        rubberMinWidth: 86,
        cellHtml: task => task.taskType === "Bug"
          ? `<span class="pill severity-${escapeAttr(task.severity)}">${escapeHtml(task.severity || "")}</span>`
          : ""
      },
      {
        key: "environment",
        label: "Environment",
        colClass: "backlog-environment-column",
        cellClass: "backlog-compact-text-cell",
        width: 132,
        rubberMinWidth: 104,
        cellHtml: task => escapeHtml(task.environment || "")
      },
      {
        key: "startDate",
        label: "Start Date",
        colClass: "backlog-date-column",
        cellClass: "backlog-date-cell",
        width: 116,
        rubberMinWidth: 96,
        cellHtml: task => escapeHtml(formatDate(task.startDate))
      },
      {
        key: "endDate",
        label: "End Date",
        colClass: "backlog-date-column",
        cellClass: "backlog-date-cell",
        width: 116,
        rubberMinWidth: 96,
        cellHtml: task => escapeHtml(formatDate(task.endDate))
      },
      {
        key: "startedAt",
        label: "Started Date/Time",
        colClass: "backlog-date-time-column",
        cellClass: "backlog-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: task => escapeHtml(formatDateTime(task.startedAt))
      },
      {
        key: "parentTask",
        label: "Parent Task",
        colClass: "backlog-related-column",
        cellClass: "backlog-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(backlogRelatedTaskLabel(task.parentTaskId))
      },
      {
        key: "linkedBug",
        label: "Linked Bug",
        colClass: "backlog-related-column",
        cellClass: "backlog-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(backlogLinkedBugLabel(task))
      },
      {
        key: "dependencies",
        label: "Dependencies",
        colClass: "backlog-related-column",
        cellClass: "backlog-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(backlogDependencyLabel(task))
      },
      {
        key: "url",
        label: "URL",
        colClass: "backlog-url-column",
        cellClass: "backlog-url-cell",
        width: 180,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(task.url || "")
      },
      {
        key: "attachmentCount",
        label: "Attachments",
        colClass: "backlog-count-column",
        cellClass: "backlog-number-cell",
        width: 104,
        rubberMinWidth: 88,
        cellHtml: task => task.attachments?.length ? String(task.attachments.length) : ""
      },
      {
        key: "sortOrder",
        label: "Sort Order",
        colClass: "backlog-number-column",
        cellClass: "backlog-number-cell",
        width: 96,
        rubberMinWidth: 80,
        cellHtml: task => String(task.sortOrder ?? "")
      },
      {
        key: "createdBy",
        label: "Created By",
        colClass: "backlog-user-column",
        cellClass: "backlog-compact-text-cell",
        width: 132,
        rubberMinWidth: 110,
        cellHtml: task => escapeHtml(backlogUserName(task.createdByUserId))
      },
      {
        key: "createdAt",
        label: "Created Date/Time",
        colClass: "backlog-date-time-column",
        cellClass: "backlog-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: task => escapeHtml(formatDateTime(task.createdAt))
      },
      {
        key: "updatedBy",
        label: "Updated By",
        colClass: "backlog-user-column",
        cellClass: "backlog-compact-text-cell",
        width: 132,
        rubberMinWidth: 110,
        cellHtml: task => escapeHtml(backlogUserName(task.updatedByUserId))
      },
      {
        key: "updatedAt",
        label: "Last Updated Date/Time",
        colClass: "backlog-date-time-column",
        cellClass: "backlog-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: task => escapeHtml(formatDateTime(task.updatedAt))
      }
    ];
  }

  function backlogColumnFilterItems() {
    return backlogOrderedTableColumns("Assigned")
      .map(column => ({ value: column.key, text: column.label }));
  }

  function backlogTableColumnColHtml(column, isRubber = false) {
    const className = [column.colClass, isRubber ? "backlog-rubber-column" : ""]
      .filter(Boolean)
      .join(" ");

    return `<col class="${escapeAttr(className)}">`;
  }

  function backlogTableColumnCellHtml(column, task, row, context = {}, isRubber = false) {
    const baseClassName = typeof column.cellClass === "function"
      ? column.cellClass(task, row)
      : column.cellClass || "";
    const className = [baseClassName, isRubber ? "backlog-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return `<td class="${escapeAttr(className)}">${column.cellHtml(task, row, context)}</td>`;
  }

  function backlogColumnHeaderHtml(column, isRubber = false) {
    const className = [column.headerClass || "", isRubber ? "backlog-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return backlogSortHeaderHtml(column.key, column.headerLabel || column.label, className, {
      draggable: backlogTableMode.active
    });
  }

  function backlogVisibleTableColumns(assigneeHeader) {
    const visibleKeys = new Set(backlogColumnPrefs.visible);
    const columns = backlogOrderedTableColumns(assigneeHeader)
      .filter(column => visibleKeys.has(column.key));

    return columns.length
      ? columns
      : backlogTableColumnDefinitions(assigneeHeader).filter(column => column.key === "item");
  }

  function backlogOrderedTableColumns(assigneeHeader) {
    const definitions = backlogTableColumnDefinitions(assigneeHeader);
    const columnsByKey = new Map(definitions.map(column => [column.key, column]));

    return normalizedBacklogColumnOrder(backlogColumnPrefs.order)
      .map(key => columnsByKey.get(key))
      .filter(Boolean);
  }

  function backlogTableMinWidth(columns) {
    const fixedWidth = 16 + (backlogTableMode.active ? 192 : 0);
    const lastColumnIndex = columns.length - 1;
    const columnsWidth = columns.reduce((total, column, index) =>
      total + backlogColumnMinimumWidth(column, index === lastColumnIndex), 0);
    return Math.max(960, fixedWidth + columnsWidth);
  }

  function backlogColumnMinimumWidth(column, isRubber) {
    if (isRubber) return column.rubberMinWidth || Math.min(column.width || 140, 140);
    return column.width || 140;
  }

  function backlogColumnIsRubber(columns, index) {
    return index === columns.length - 1;
  }

  function normalizeBacklogColumnPrefs(preferences = {}) {
    const savedPreferences = preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? preferences
      : {};
    const visibleKeys = normalizeSavedArray(savedPreferences.visible)
      .filter(key => backlogColumnKeySet().has(key));

    return {
      order: normalizedBacklogColumnOrder(savedPreferences.order),
      visible: visibleKeys.length ? visibleKeys : backlogDefaultVisibleColumnKeys()
    };
  }

  function normalizedBacklogColumnOrder(order = []) {
    const allowedKeys = backlogColumnKeySet();
    const orderedKeys = normalizeSavedArray(order)
      .filter(key => allowedKeys.has(key));

    backlogTableColumnDefinitions().forEach(column => {
      if (!orderedKeys.includes(column.key)) orderedKeys.push(column.key);
    });

    return orderedKeys;
  }

  function backlogColumnOrderWithAddedColumns(order, addedColumns) {
    const orderedKeys = normalizedBacklogColumnOrder(order);

    addedColumns
      .filter(column => column !== "percent" && backlogColumnKeySet().has(column))
      .forEach(column => {
        const existingIndex = orderedKeys.indexOf(column);
        if (existingIndex >= 0) orderedKeys.splice(existingIndex, 1);

        const percentIndex = orderedKeys.indexOf("percent");
        orderedKeys.splice(percentIndex >= 0 ? percentIndex : orderedKeys.length, 0, column);
      });

    return orderedKeys;
  }

  function backlogColumnKeySet() {
    return new Set(backlogTableColumnDefinitions().map(column => column.key));
  }

  function backlogDefaultVisibleColumnKeys() {
    return backlogTableColumnDefinitions()
      .filter(column => column.defaultVisible)
      .map(column => column.key);
  }

  function saveBacklogColumnPrefs() {
    writeJsonPreference(preferenceKeys.backlogTableColumns, backlogColumnPrefs);
  }

  function bindBacklogColumnDragEvents() {
    app.addEventListener("pointerdown", handleBacklogColumnPointerDown);
    app.addEventListener("mousedown", handleBacklogColumnMouseDown);
    app.addEventListener("click", suppressBacklogColumnDraggedClick, true);
  }

  function handleBacklogColumnPointerDown(event) {
    lastBacklogColumnPointerDragAt = Date.now();
    startBacklogColumnDrag(event, "pointer");
  }

  function handleBacklogColumnMouseDown(event) {
    if (Date.now() - lastBacklogColumnPointerDragAt < 500) return;
    startBacklogColumnDrag(event, "mouse");
  }

  function startBacklogColumnDrag(event, inputType) {
    if (event.button !== 0) return;
    if (!backlogTableMode.active) return;

    const header = event.target.closest('.backlog-table th[data-backlog-column][data-column-draggable="true"]');
    const table = header?.closest(".backlog-table");
    if (!header || !table || !app.contains(header)) return;

    const columnKey = header.dataset.backlogColumn || "";
    if (!backlogColumnPrefs.visible.includes(columnKey)) return;

    backlogColumnDrag = {
      columnKey,
      source: header,
      table,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      inputType,
      pointerId: event.pointerId
    };

    if (inputType === "pointer" && header.setPointerCapture && event.pointerId !== undefined) {
      try {
        header.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; the window listeners still finish the drag.
      }
    }

    if (inputType === "pointer") {
      window.addEventListener("pointermove", handleBacklogColumnPointerMove);
      window.addEventListener("pointerup", handleBacklogColumnPointerUp, { once: true });
      window.addEventListener("pointercancel", cancelBacklogColumnDrag, { once: true });
    } else {
      window.addEventListener("mousemove", handleBacklogColumnMouseMove);
      window.addEventListener("mouseup", handleBacklogColumnMouseUp, { once: true });
    }
  }

  function handleBacklogColumnPointerMove(event) {
    lastBacklogColumnPointerDragAt = Date.now();
    moveBacklogColumnDrag(event);
  }

  function handleBacklogColumnMouseMove(event) {
    if (backlogColumnDrag?.inputType === "pointer") return;
    moveBacklogColumnDrag(event);
  }

  function moveBacklogColumnDrag(event) {
    if (!backlogColumnDrag) return;

    const movedEnough = Math.hypot(event.clientX - backlogColumnDrag.startX, event.clientY - backlogColumnDrag.startY) > 5;
    if (!backlogColumnDrag.started && !movedEnough) return;

    if (!backlogColumnDrag.started) {
      backlogColumnDrag.started = true;
      suppressNextBacklogColumnClick = true;
      backlogColumnDrag.source.classList.add("column-dragging");
      backlogColumnDrag.table.classList.add("is-column-dragging");
    }

    event.preventDefault();
    updateBacklogColumnDropIndicator(event.clientX, event.clientY);
  }

  function handleBacklogColumnPointerUp(event) {
    lastBacklogColumnPointerDragAt = Date.now();
    finishBacklogColumnDrag(event);
  }

  function handleBacklogColumnMouseUp(event) {
    if (backlogColumnDrag?.inputType === "pointer") return;
    finishBacklogColumnDrag(event);
  }

  function finishBacklogColumnDrag(event) {
    if (!backlogColumnDrag || backlogColumnDrag.finishing) return;
    backlogColumnDrag.finishing = true;

    if (!backlogColumnDrag.started) {
      cancelBacklogColumnDrag();
      return;
    }

    event.preventDefault();
    suppressNextBacklogColumnClick = true;

    const drag = backlogColumnDrag;
    const drop = backlogColumnDropTarget(event.clientX, event.clientY);
    if (drop) {
      const order = backlogColumnKeysAfterDrop(drag.columnKey, drop.target.dataset.backlogColumn || "", drop.placement);
      if (backlogColumnOrderChanged(order)) {
        backlogColumnPrefs = normalizeBacklogColumnPrefs({ ...backlogColumnPrefs, order });
        saveBacklogColumnPrefs();
        cancelBacklogColumnDrag();
        renderBacklog();
        return;
      }
    }

    cancelBacklogColumnDrag();
  }

  function backlogColumnDropTarget(clientX, clientY) {
    if (!backlogColumnDrag) return null;

    const headerRow = backlogColumnDrag.table.querySelector("thead tr");
    const headerRect = headerRow?.getBoundingClientRect();
    if (!headerRect || clientY < headerRect.top - 32 || clientY > headerRect.bottom + 64) return null;

    const headers = [...backlogColumnDrag.table.querySelectorAll('thead th[data-backlog-column][data-column-draggable="true"]')]
      .filter(header => (header.dataset.backlogColumn || "") !== backlogColumnDrag.columnKey);
    if (!headers.length) return null;

    const firstRect = headers[0].getBoundingClientRect();
    if (clientX <= firstRect.left + (firstRect.width / 2)) {
      return { target: headers[0], placement: "before" };
    }

    for (const header of headers) {
      const rect = header.getBoundingClientRect();
      if (clientX < rect.left + (rect.width / 2)) {
        return { target: header, placement: "before" };
      }
    }

    return { target: headers[headers.length - 1], placement: "after" };
  }

  function updateBacklogColumnDropIndicator(clientX, clientY) {
    clearBacklogColumnDropIndicators();

    const drop = backlogColumnDropTarget(clientX, clientY);
    if (!drop) return;

    backlogColumnDrag.table.classList.add("column-drop-target");
    drop.target.classList.add(drop.placement === "after" ? "column-reorder-after" : "column-reorder-before");
  }

  function backlogColumnKeysAfterDrop(draggedKey, targetKey, placement) {
    const orderedKeys = normalizedBacklogColumnOrder(backlogColumnPrefs.order)
      .filter(key => key !== draggedKey);
    let insertIndex = orderedKeys.indexOf(targetKey);
    if (insertIndex < 0) return normalizedBacklogColumnOrder(backlogColumnPrefs.order);
    if (placement === "after") insertIndex += 1;
    orderedKeys.splice(insertIndex, 0, draggedKey);
    return orderedKeys;
  }

  function backlogColumnOrderChanged(order) {
    const currentOrder = normalizedBacklogColumnOrder(backlogColumnPrefs.order);
    return order.length !== currentOrder.length || order.some((key, index) => key !== currentOrder[index]);
  }

  function cancelBacklogColumnDrag() {
    window.removeEventListener("pointermove", handleBacklogColumnPointerMove);
    window.removeEventListener("mousemove", handleBacklogColumnMouseMove);
    window.removeEventListener("pointerup", handleBacklogColumnPointerUp);
    window.removeEventListener("mouseup", handleBacklogColumnMouseUp);
    window.removeEventListener("pointercancel", cancelBacklogColumnDrag);

    if (backlogColumnDrag?.inputType === "pointer" && backlogColumnDrag.source.releasePointerCapture && backlogColumnDrag.pointerId !== undefined) {
      try {
        backlogColumnDrag.source.releasePointerCapture(backlogColumnDrag.pointerId);
      } catch {
        // The browser may already have released pointer capture.
      }
    }

    backlogColumnDrag = null;
    app.querySelectorAll(".column-dragging, .is-column-dragging, .column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove(
        "column-dragging",
        "is-column-dragging",
        "column-drop-target",
        "column-reorder-before",
        "column-reorder-after"
      ));
  }

  function clearBacklogColumnDropIndicators() {
    app.querySelectorAll(".column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove("column-drop-target", "column-reorder-before", "column-reorder-after"));
  }

  function suppressBacklogColumnDraggedClick(event) {
    if (!suppressNextBacklogColumnClick) return;
    suppressNextBacklogColumnClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function backlogSortHeaderHtml(column, label, className = "", options = {}) {
    const state = backlogTableSortState();
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const classes = [className, isSorted ? "is-sorted" : ""].filter(Boolean).join(" ");
    const columnDragAttrs = `
      data-backlog-column="${escapeAttr(column)}"
      data-column-draggable="${options.draggable ? "true" : "false"}"`;

    return `
      <th class="${classes}" aria-sort="${ariaSort}" ${columnDragAttrs}>
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
    return backlogTableColumnDefinitions("Assigned")
      .map(column => ({ column: column.key, label: column.label }));
  }

  function backlogNextSortLabel(column, label) {
    const state = backlogTableSortState();
    if (state.column === column && state.direction === "asc") return `Sort ${label} descending`;
    if (state.column === column && state.direction === "desc") return `Clear ${label} sort`;
    return `Sort ${label} ascending`;
  }

  function openBacklogExportDialog() {
    openExportDialog({
      title: "Export Backlog",
      onCsvExport: exportBacklogCsv,
      onExcelExport: exportBacklogExcel
    });
  }

  function exportBacklogCsv() {
    const rows = backlogExportRows();
    const columns = backlogExportImportColumns(rows);

    downloadCsv(exportFileName("pmt-backlog"), columns, rows);
  }

  function exportBacklogExcel() {
    const rows = backlogExportRows();
    const columns = backlogExportImportColumns(rows);

    downloadXlsx(exportFileName("pmt-backlog", "xlsx"), "Backlog", columns, rows);
  }

  function backlogExportImportColumns(rows) {
    const assigneeHeader = backlogRowsHaveMultipleAssignees(rows) ? "Assignees" : "Assignee";
    return [
      ...backlogExportColumns(backlogVisibleTableColumns(assigneeHeader)),
      ...workItemSystemColumns({
        nameHeader: "PMT Update Item Name",
        itemTypeLabel: task => backlogTaskTypeLabel(task),
        percentValue: task => taskDisplayPercent(task),
        assigneeLabel: task => userNames(task.assignees)
      })
    ];
  }

  function openBacklogImport() {
    openExcelImport({
      onImport: importBacklogExcel,
      onError: error => showImportResultDialog({
        title: "Import Backlog",
        totalRows: 0,
        updatedRows: 0,
        errors: [{ rowNumber: "File", message: error.message }]
      })
    });
  }

  async function importBacklogExcel(records) {
    const workbookError = importWorkbookTypeError(records, ["Dev", "Bug"], "Backlog");
    if (workbookError) {
      showImportResultDialog({
        title: "Import Backlog",
        totalRows: records.length,
        updatedRows: 0,
        errors: [{ rowNumber: "File", message: workbookError }]
      });
      return;
    }

    const errors = [];
    let updatedRows = 0;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const rowNumber = index + 2;
      try {
        if (await importBacklogRecord(record)) updatedRows += 1;
      } catch (error) {
        const id = parseImportItemId(record);
        const task = id ? taskById(id) : null;
        errors.push({
          rowNumber,
          code: importCell(record, "PMT Item Code") || task?.code || "",
          title: importCell(record, "PMT Update Item Name", "PMT Update Task Name", "PMT Update Bug Name") || task?.title || "",
          message: error.message
        });
      }
    }

    if (updatedRows && refreshAfterImport) await refreshAfterImport();
    showImportResultDialog({
      title: "Import Backlog",
      totalRows: records.length,
      updatedRows,
      errors
    });
  }

  async function importBacklogRecord(record) {
    const task = taskById(parseImportItemId(record));
    if (!task) throw new Error("PMT Item Id does not match an existing row.");
    if (task.status !== "Backlog" && task.status !== "Todo") {
      throw new Error("This row is no longer in the Backlog.");
    }

    assertImportItemCode(record, task.code, "Item Code", "Task Code", "Bug Code");
    assertBacklogImportHash(record, task);

    const title = importCell(record, "Item Name", "Task Name", "Bug Name", "PMT Update Item Name", "PMT Update Task Name", "PMT Update Bug Name").trim();
    const status = importCell(record, "Status", "PMT Update Status").trim();
    const priority = importCell(record, "Priority", "PMT Update Priority").trim();
    const requestedPercent = parseImportPercent(record, "% Complete");
    const assigneeIds = uniqueIds(parseImportAssigneeIds(record, state.users, "Assigned", "Assignee", "Assignees"));

    if (!title) throw new Error("Item Name is required.");
    if (!getStatuses().includes(status)) throw new Error(`Status "${status}" is not a PMT status.`);
    if (!getPriorities().includes(priority)) throw new Error(`Priority "${priority}" is not a PMT priority.`);
    validateBacklogImportAssignees(task, assigneeIds);
    if (task.subTasks?.length && requestedPercent !== taskDisplayPercent(task)) {
      throw new Error("Percent Completed is calculated from sub-tasks for this row.");
    }

    const percentCompleted = task.taskType === "Bug"
      ? percentForStatus(status, requestedPercent)
      : percentForDevTaskSave(status, requestedPercent, task, task.dependencyTaskIds || []);
    if (task.taskType !== "Bug") validateLinkedBugCompletion(task, percentCompleted, task.dependencyTaskIds || []);

    if (!backlogImportChanged(task, { title, status, priority, percentCompleted, assigneeIds })) return false;

    await saveJson(`/api/backlog/tasks/${task.id}`, "PUT", backlogImportPayload(task, {
      title,
      status,
      priority,
      percentCompleted,
      assigneeIds
    }));
    return true;
  }

  function assertBacklogImportHash(record, task) {
    const hash = importCell(record, "PMT Row Hash").trim();
    if (hash && hash !== workItemImportHash(task, taskDisplayPercent(task))) {
      throw new Error("This row is stale. Re-export the grid before importing this row.");
    }
  }

  function validateBacklogImportAssignees(task, assigneeIds) {
    const project = state.projects.find(item => item.id === task.projectId);
    const sprint = task.sprintId ? state.sprints.find(item => item.id === task.sprintId) : null;
    const allowedIds = new Set(allowedAssigneeUsers(state.users, project, sprint).map(user => user.id));
    const invalid = assigneeIds.filter(id => !allowedIds.has(id));
    if (invalid.length) throw new Error(`Assignee ids are not valid for this Project/Sprint: ${invalid.join(", ")}.`);
  }

  function backlogImportChanged(task, updates) {
    return task.title !== updates.title
      || task.status !== updates.status
      || task.priority !== updates.priority
      || Number(task.percentCompleted || 0) !== Number(updates.percentCompleted || 0)
      || !sameNumberList(task.assigneeIds || [], updates.assigneeIds || []);
  }

  function backlogImportPayload(task, updates) {
    const isBug = task.taskType === "Bug";

    return {
      id: task.id,
      projectId: task.projectId,
      sprintId: task.sprintId || null,
      parentTaskId: isBug ? null : task.parentTaskId || null,
      taskType: isBug ? "Bug" : "Dev",
      title: updates.title,
      descriptionHtml: task.descriptionHtml || "",
      stepsToReproduceHtml: isBug ? task.stepsToReproduceHtml || "" : "",
      actualResultHtml: isBug ? task.actualResultHtml || "" : "",
      expectedResultHtml: isBug ? task.expectedResultHtml || "" : "",
      environment: isBug ? task.environment || "" : "",
      severity: isBug ? task.severity || "" : "",
      status: updates.status,
      priority: updates.priority,
      percentCompleted: updates.percentCompleted,
      url: task.url || "",
      startDate: task.startDate || null,
      endDate: task.endDate || null,
      reporterIds: isBug ? task.reporterIds || [] : [],
      assigneeIds: updates.assigneeIds,
      dependencyTaskIds: task.dependencyTaskIds || []
    };
  }

  function backlogExportRows() {
    ensureBacklogFilters();
    return backlogRowsWithVisibleSubTasks(filteredBacklogItems());
  }

  function backlogExportColumns(visibleColumns) {
    return visibleColumns.flatMap(column => {
      if (column.key === "assigned") return [{ header: column.headerLabel || column.label, value: row => userNames(row.task.assignees) }];
      if (column.key === "item") {
        return [
          { header: "Item Code", value: row => row.task.code },
          { header: "Item Name", value: row => row.task.title },
          { header: "Row Type", value: row => row.level ? "Subtask" : "Item" }
        ];
      }
      if (column.key === "reporter") return [{ header: column.headerLabel || column.label, value: row => userNames(row.task.reporters) }];

      return [{ header: column.label, value: row => backlogExportValue(column.key, row.task) }];
    });
  }

  function backlogExportValue(columnKey, task) {
    if (columnKey === "type") return backlogTaskTypeLabel(task);
    if (columnKey === "project") return projectName(task.projectId);
    if (columnKey === "sprint") return backlogSprintLabel(task);
    if (columnKey === "status") return task.status;
    if (columnKey === "priority") return task.priority;
    if (columnKey === "percent") return taskDisplayPercent(task);
    if (columnKey === "severity") return task.taskType === "Bug" ? task.severity || "" : "";
    if (columnKey === "environment") return task.environment || "";
    if (columnKey === "startDate") return formatDate(task.startDate);
    if (columnKey === "endDate") return formatDate(task.endDate);
    if (columnKey === "startedAt") return formatDateTime(task.startedAt);
    if (columnKey === "parentTask") return backlogRelatedTaskLabel(task.parentTaskId);
    if (columnKey === "linkedBug") return backlogLinkedBugLabel(task);
    if (columnKey === "dependencies") return backlogDependencyLabel(task);
    if (columnKey === "url") return task.url || "";
    if (columnKey === "attachmentCount") return task.attachments?.length || "";
    if (columnKey === "sortOrder") return task.sortOrder ?? "";
    if (columnKey === "createdBy") return backlogUserName(task.createdByUserId);
    if (columnKey === "createdAt") return formatDateTime(task.createdAt);
    if (columnKey === "updatedBy") return backlogUserName(task.updatedByUserId);
    if (columnKey === "updatedAt") return formatDateTime(task.updatedAt);
    return "";
  }

  function resetBacklogView() {
    [
      preferenceKeys.backlogFilters,
      preferenceKeys.backlogCollapsedSubTasks,
      preferenceKeys.backlogTableColumns
    ].forEach(removePreference);

    backlogFilters = normalizeBacklogFilters({});
    backlogCollapsedSubTasks = {};
    backlogColumnPrefs = normalizeBacklogColumnPrefs({});
    backlogTableMode.deactivate();
    cancelBacklogColumnDrag();
    renderBacklog();
  }

  function deactivateBacklog() {
    document.querySelectorAll("[data-backlog-filter-dialog]").forEach(dialog => {
      if (dialog.open) dialog.close();
      else dialog.remove();
    });
    cancelBacklogColumnDrag();
    backlogTableMode.deactivate();
  }

  return {
    deactivate: deactivateBacklog,
    handleAction,
    handleFilterChange,
    render: renderBacklog
  };
}
