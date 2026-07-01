import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { buttonContent, chartIconHtml, funnelIconHtml, pageActionsMenuHtml } from "../../components/buttons.js?v=20260701-page-actions-menu";
import { VisualCharts } from "../../components/charts.js?v=20260628-chart-native-tooltips";
import { checkedFilterValues, filterCheckList } from "../../components/filters.js?v=20260630-filter-renderer";
import {
  checkList,
  checkedNumbers,
  field,
  nullableDateValue,
  numberValue,
  optionalNumberValue,
  richTextField,
  richValue,
  selectField,
  selectOptionsField,
  selectTextField,
  userCardCheckListLabelHtml,
  value
} from "../../components/forms.js?v=20260629-avatar-jpg-assets";
import { progressHtml, statusColor } from "../../components/progress-and-status.js?v=20260627-dev-task-status-rules";
import { sectionHead } from "../../components/sections.js?v=20260701-nav-title-preferences";
import {
  attachmentEditorFieldHtml,
  bindAssigneeList,
  createWorkItemTableMode,
  showTaskAudit,
  taskAuditPanelHtml,
  taskButtonsHtml,
  taskPercentField,
  workItemDialogMetaHtml,
  uploadWorkItemAttachments
} from "../../components/work-items.js?v=20260629-avatar-jpg-assets";
import {
  currentUser
} from "../../core/authentication.js";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  removePreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260630-task-table-columns";
import { currentView } from "../../core/router.js";
import { state } from "../../core/store.js";
import {
  formatDate,
  formatDateTime,
  toDateInput
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
import { canEditTask } from "../../shared/permissions.js";
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
  dependencyCandidates,
  allowedAssigneeUsers,
  associatedBugForDevTask,
  isTaskCompleted,
  percentForDevTaskSave,
  taskCreatedTime,
  taskDisplayPercent,
  taskOrderCompare,
  taskRowsWithSubTasks,
  validateLinkedBugCompletion
} from "../../shared/work-item-rules.js?v=20260627-dev-task-status-rules";

const taskBugFixIconUrl = "/assets/bug.svg?v=20260629-kanban-gantt-bug-icon";

export function createTasksFeature({
  app,
  attachFile,
  deleteItem,
  duplicateTask,
  getBoardProjectId,
  getBoardSprintId,
  getCurrentSprint,
  getItemStartDate,
  getLookupOptions,
  getPriorities,
  getStatuses,
  openEditor,
  refreshAfterImport,
  saveJson
}) {
  let taskProjectId = readNumberPreference(preferenceKeys.taskProject, 0);
  let taskSprintId = readPreference(preferenceKeys.taskSprint, "current");
  let taskEntryProjectId = readNumberPreference(preferenceKeys.taskEntryProject, 0);
  let taskEntrySprintId = readPreference(preferenceKeys.taskEntrySprint, "");
  let taskFilters = normalizeTaskFilters(readJsonPreference(preferenceKeys.taskFilters, {}));
  let taskVisualChartsVisible = readBooleanPreference(preferenceKeys.taskVisualChartsVisible, true);
  let taskCollapsedSubTasks = readJsonPreference(preferenceKeys.taskCollapsedSubTasks, {});
  let taskColumnPrefs = normalizeTaskColumnPrefs(readJsonPreference(preferenceKeys.taskTableColumns, {}));
  let taskColumnDrag = null;
  let lastTaskColumnPointerDragAt = 0;
  let suppressNextTaskColumnClick = false;
  const taskTableMode = createWorkItemTableMode({
    action: "toggle-task-table-edit-mode",
    itemLabel: "Dev Tasks"
  });

  if (!taskCollapsedSubTasks || Array.isArray(taskCollapsedSubTasks) || typeof taskCollapsedSubTasks !== "object") {
    taskCollapsedSubTasks = {};
  }

  bindTaskColumnDragEvents();

  function renderTasks() {
    ensureSelectedProject();

    const projectSprints = taskProjectSprints();
    if (taskSprintId !== "all" && taskSprintId !== "current" && !projectSprints.some(sprint => sprint.id === Number(taskSprintId))) {
      taskSprintId = defaultSprintId(projectSprints);
      writePreference(preferenceKeys.taskSprint, taskSprintId);
    }
    const selectedSprint = taskSelectedSprint(projectSprints);

    const allProjectDevTasks = state.tasks
      .filter(task => !taskProjectId || task.projectId === taskProjectId)
      .filter(task => task.taskType !== "Bug");
    const baseTasks = allProjectDevTasks
      .filter(task => taskMatchesSprintFilter(task, selectedSprint));
    const visibleTasks = filteredTaskList(baseTasks);
    const taskChildrenByParent = taskChildTasksByParent(visibleTasks);
    const taskRows = taskRowsWithVisibleSubTasks(visibleTasks);
    const assigneeColumnWidth = taskAssigneeColumnWidth(taskRows);
    const assigneeHeader = taskRowsHaveMultipleAssignees(taskRows) ? "Assignee(s)" : "Assignee";
    const visibleTaskColumns = taskVisibleTableColumns(assigneeHeader);
    const emptyTableColspan = visibleTaskColumns.length + (taskTableMode.active ? 2 : 1);
    const canShowCharts = allProjectDevTasks.length > 0;
    const showCharts = canShowCharts && taskVisualChartsVisible;
    const chartToggleLabel = showCharts ? "Hide Charts" : "Show Charts";

    app.innerHTML = `
      <section class="tasks-screen work-item-screen">
      ${sectionHead("Dev Tasks", `
        <button class="primary text-icon-button" type="button" data-action="new-task" title="New Dev Task" aria-label="New Dev Task">${buttonContent("&#10010;", "New Dev Task")}</button>
        <button class="secondary text-icon-button" type="button" data-action="open-task-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
        ${pageActionsMenuHtml([
          { action: "toggle-task-table-edit-mode", icon: "&#9998;", label: "Edit Mode", title: "Edit Mode", checked: taskTableMode.active },
          { action: "toggle-task-visual-charts", icon: chartIconHtml(), label: "Graphs", title: chartToggleLabel, checked: showCharts, disabled: !canShowCharts, separatorBefore: true },
          { action: "export-task-view", icon: exportIconHtml(), label: "Export", title: "Export", separatorBefore: true },
          { action: "import-task-view", icon: importIconHtml(), label: "Import", title: "Import" },
          { action: "reset-task-view", icon: "&#8634;", label: "Reset View", title: "Reset View", separatorBefore: true }
        ])}
      `)}
      ${showCharts ? taskVisualTrackingChartsHtml(baseTasks, selectedSprint, allProjectDevTasks) : ""}
      <div class="panel work-item-table-panel tasks-table-panel">
        <table class="table work-item-table tasks-table ${taskTableMode.active ? "is-edit-mode" : "is-read-mode"}" style="--tasks-assignee-width:${assigneeColumnWidth}px; --tasks-table-min-width:${taskTableMinWidth(visibleTaskColumns)}px">
          <colgroup>
            <col class="tasks-expand-column">
            ${visibleTaskColumns.map((column, index) => taskTableColumnColHtml(column, taskColumnIsRubber(visibleTaskColumns, index))).join("")}
            ${taskTableMode.active ? `<col class="tasks-action-column">` : ""}
          </colgroup>
          <thead>
            <tr>
              <th class="tasks-expand-heading" aria-label="Expand or collapse sub-tasks"></th>
              ${visibleTaskColumns.map((column, index) => taskColumnHeaderHtml(column, taskColumnIsRubber(visibleTaskColumns, index))).join("")}
              ${taskTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
            </tr>
          </thead>
          <tbody data-reorder-list="tasks">
            ${taskRows.map(row => {
              const task = row.task;
              const hasVisibleSubTasks = taskHasVisibleSubTasks(task, taskChildrenByParent);
              const isSubTasksCollapsed = taskSubTasksCollapsed(task.id);
              const hasAssociatedBug = taskHasAssociatedBug(task);
              const bugFixRowIcon = hasAssociatedBug ? taskBugFixRowIconHtml() : "";
              const rowClass = [
                row.level ? "subtask-row" : "",
                hasAssociatedBug ? "bug-associated-row" : "",
                hasVisibleSubTasks ? "has-subtasks" : "",
                hasVisibleSubTasks && isSubTasksCollapsed ? "is-subtasks-collapsed" : "",
                "clickable-row"
              ].filter(Boolean).join(" ");
              const indent = Math.min(row.level, 4) * 20;

              return `
              <tr class="${rowClass}" data-action="view-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${taskTableMode.active && canEditTask(task) ? "true" : "false"}" draggable="false" style="--indent:${indent}px">
                <td class="tasks-expand-cell">${hasVisibleSubTasks ? taskSubTaskToggleHtml(task, isSubTasksCollapsed) : ""}</td>
                ${visibleTaskColumns.map((column, index) => taskTableColumnCellHtml(column, task, row, { bugFixRowIcon }, taskColumnIsRubber(visibleTaskColumns, index))).join("")}
                ${taskTableMode.active ? `<td class="reveal-actions action-cell">${taskButtonsHtml(task, { includeView: false, monochrome: true })}</td>` : ""}
              </tr>
            `;
            }).join("") || `<tr><td colspan="${emptyTableColspan}"><div class="empty">No tasks for this filter.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      </section>
    `;
  }

  async function handleAction(action, id, element) {
    const task = id ? taskById(id) : null;

    if (action === "new-task") {
      editTask();
      return true;
    }
    if (action === "toggle-task-table-edit-mode") {
      taskTableMode.toggle();
      renderTasks();
      return true;
    }
    if (action === "sort-task-table") {
      return updateTaskTableSort(element);
    }
    if (action === "reset-task-view") {
      resetTaskView();
      return true;
    }
    if (action === "open-task-filters" || action === "toggle-task-filters") {
      openTaskFiltersDialog();
      return true;
    }
    if (action === "export-task-view") {
      openTaskExportDialog();
      return true;
    }
    if (action === "import-task-view") {
      openTaskImport();
      return true;
    }
    if (action === "toggle-task-visual-charts") {
      taskVisualChartsVisible = !taskVisualChartsVisible;
      writePreference(preferenceKeys.taskVisualChartsVisible, taskVisualChartsVisible);
      renderTasks();
      return true;
    }
    if (action === "toggle-task-subtasks" && task?.taskType !== "Bug") {
      toggleTaskSubTasks(task.id);
      renderTasks();
      return true;
    }
    if (action === "edit-task" && task?.taskType !== "Bug") {
      editTask(task);
      return true;
    }
    if (action === "show-task-audit" && task?.taskType !== "Bug") {
      showTaskAudit(id);
      return true;
    }
    if (action === "duplicate-task" && task?.taskType !== "Bug") {
      await duplicateTask(id);
      return true;
    }
    if (action === "delete-task" && task?.taskType !== "Bug") {
      await deleteItem(`/api/tasks/${id}`, "Delete this task?");
      return true;
    }

    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    if (!applyTaskFilterChange(target)) return false;

    renderTasks();
    return true;
  }

  function openTaskFiltersDialog() {
    const existingDialog = document.querySelector("[data-task-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='task-search']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog";
    modal.dataset.taskFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Dev Task Filters</h2>
          <button type="button" class="icon-btn" data-close-task-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body" data-task-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-task-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderTaskFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("input", event => {
      if (!applyTaskFilterChange(event.target)) return;
      renderTasks();
    });
    modal.addEventListener("change", event => {
      const target = event.target;
      const filter = target?.dataset?.filter || "";
      if (!applyTaskFilterChange(target)) return;

      renderTasks();
      if (filter === "task-project") {
        renderTaskFiltersDialog(modal);
        modal.querySelector("[data-filter='task-project']")?.focus({ preventScroll: true });
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-task-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='task-search']")?.focus({ preventScroll: true });
  }

  function renderTaskFiltersDialog(modal) {
    const body = modal.querySelector("[data-task-filter-dialog-body]");
    if (body) body.innerHTML = taskFilterFieldsHtml();
  }

  function taskFilterFieldsHtml() {
    const statuses = getStatuses();
    const priorities = getPriorities();
    const projectSprints = taskProjectSprints();

    return `
      <div class="tasks-filter-panel">
        <div class="task-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="task-project">
              <option value="0" ${!taskProjectId ? "selected" : ""}>All Projects</option>
              ${state.projects.map(project => `<option value="${project.id}" ${project.id === taskProjectId ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sprint</span>
            <select data-filter="task-sprint">
              <option value="current" ${taskSprintId === "current" ? "selected" : ""}>Current Sprint</option>
              <option value="all" ${taskSprintId === "all" ? "selected" : ""}>All Sprints</option>
              ${projectSprints.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === taskSprintId ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input type="text" data-filter="task-search" value="${escapeAttr(taskFilters.search)}">
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="task-sort">
              ${taskSortOptionsHtml()}
            </select>
          </label>
        </div>
        <div class="task-filter-check-row">
          <label class="inline-filter-check">
            <input type="checkbox" data-filter="task-hide-completed" ${taskFilters.hideCompleted ? "checked" : ""}>
            <span class="checkbox-label-text">Hide Completed Dev Tasks</span>
          </label>
        </div>
        <div class="filter-stack">
          ${filterCheckList("Status", "task-status", statuses.map(value => ({ value, text: value })), taskFilters.statuses)}
          ${filterCheckList("Priority", "task-priority", priorities.map(value => ({ value, text: value })), taskFilters.priorities)}
          ${filterCheckList("Assignees", "task-assigned", taskUserFilterItems(), taskFilters.assigneeIds, {
            className: "user-card-check-list",
            renderItem: userCardCheckListLabelHtml
          })}
          ${filterCheckList("Columns", "task-column", taskColumnFilterItems(), taskColumnPrefs.visible)}
        </div>
      </div>
    `;
  }

  function taskUserFilterItems() {
    return state.users.map(user => ({
      ...user,
      value: user.id,
      text: user.nickname
    }));
  }

  function applyTaskFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("task-")) return false;

    if (filter === "task-project") {
      taskProjectId = Number(target.value);
      taskSprintId = defaultSprintId(taskProjectSprints());
      writePreference(preferenceKeys.taskProject, taskProjectId);
      writePreference(preferenceKeys.taskSprint, taskSprintId);
    }
    if (filter === "task-sprint") {
      taskSprintId = target.value;
      writePreference(preferenceKeys.taskSprint, taskSprintId);
    }
    if (filter === "task-search") taskFilters.search = target.value;
    if (filter === "task-sort") taskFilters.sort = target.value;
    if (filter === "task-hide-completed") taskFilters.hideCompleted = target.checked;
    if (filter === "task-status") taskFilters.statuses = checkedFilterValues("task-status");
    if (filter === "task-priority") taskFilters.priorities = checkedFilterValues("task-priority");
    if (filter === "task-assigned") taskFilters.assigneeIds = checkedFilterValues("task-assigned");
    if (filter === "task-column") {
      const visibleColumns = checkedFilterValues("task-column");
      if (!visibleColumns.length) {
        target.checked = true;
        return false;
      }
      const addedColumns = visibleColumns.filter(column => !taskColumnPrefs.visible.includes(column));
      taskColumnPrefs = normalizeTaskColumnPrefs({
        ...taskColumnPrefs,
        order: taskColumnOrderWithAddedColumns(taskColumnPrefs.order, addedColumns),
        visible: visibleColumns
      });
      saveTaskColumnPrefs();
    }

    if (filter !== "task-project" && filter !== "task-sprint" && filter !== "task-column") saveTaskFilters();
    return true;
  }

  function editTask(task = {}, options = {}) {
    const apiRoot = options.apiRoot || "/api/tasks";
    const rememberedProjectId = state.projects.some(project => project.id === taskEntryProjectId)
      ? taskEntryProjectId
      : 0;
    const selectedFilterSprint = currentView === "Tasks"
      ? taskSelectedSprint(taskProjectSprints())
      : null;
    const projectId = task.projectId
      || rememberedProjectId
      || (currentView === "Tasks" && selectedFilterSprint ? selectedFilterSprint.projectId : 0)
      || (currentView === "Tasks" ? taskProjectId : getBoardProjectId())
      || state.projects[0]?.id;
    const rememberedSprintId = state.sprints.some(sprint =>
      sprint.id === Number(taskEntrySprintId)
      && sprint.projectId === projectId
    )
      ? Number(taskEntrySprintId)
      : "";
    const selectedTaskFilterSprint = currentView === "Tasks"
      ? taskSelectedSprint(taskProjectSprints(projectId))
      : null;
    const defaultSprintId = task.sprintId ?? (
      rememberedProjectId
        ? rememberedSprintId
        : currentView === "Board"
          ? getBoardSprintId(projectId)
          : selectedTaskFilterSprint
            ? selectedTaskFilterSprint.id
            : ""
    );
    const sameProjectTasks = dependencyCandidates(projectId, task.id);
    const taskHasSubTasks = Boolean(task.subTasks?.length);

    openEditor(workItemEditorTitle(task, "New Dev Task"), `
      <div class="form-grid task-editor-grid">
        ${task.id ? taskAuditPanelHtml(task) : ""}
        ${selectField("Project", "projectId", state.projects, projectId)}
        ${selectOptionsField("Sprint", "sprintId", taskEditorSprintOptions(projectId), defaultSprintId || "")}
        ${field("Title", "title", task.title || "", "text")}
        ${selectTextField("Status", "status", getLookupOptions("Status", task.status || "Todo"), task.status || "Todo")}
        ${selectTextField("Priority", "priority", getLookupOptions("Priority", task.priority || "Low"), task.priority || "Low")}
        ${taskPercentField(task, taskHasSubTasks)}
        ${richTextField("descriptionHtml", "Description", task.descriptionHtml || "")}
        ${attachmentEditorFieldHtml()}
        <div class="task-assignee-list" data-assignee-list></div>
        ${field("Start", "startDate", toDateInput(task.startDate), "date")}
        ${field("End", "endDate", toDateInput(task.endDate), "date")}
        ${selectOptionsField("Parent", "parentTaskId", [{ id: "", title: "No parent" }, ...sameProjectTasks.map(item => ({ id: item.id, title: `${item.code} - ${item.title}` }))], task.parentTaskId || "")}
        ${field("URL", "url", task.url || "", "url")}
        ${checkList("Dependencies", "dependencyTaskIds", sameProjectTasks, task.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" })}
      </div>
      ${task.id ? workItemDialogMetaHtml(task) : ""}
    `, async root => {
      const projectId = numberValue(root, "projectId");
      const title = value(root, "title");
      const assigneeIds = checkedNumbers(root, "assigneeIds");

      if (!title.trim()) {
        focusTaskField(root, "title");
        throw new Error("Dev Task title is required.");
      }

      const status = value(root, "status");
      const sprintId = optionalNumberValue(root, "sprintId");
      const dependencyTaskIds = checkedNumbers(root, "dependencyTaskIds");
      const percentCompleted = percentForDevTaskSave(status, numberValue(root, "percentCompleted"), task, dependencyTaskIds);
      validateLinkedBugCompletion(task, percentCompleted, dependencyTaskIds);

      const result = await saveJson(task.id ? `${apiRoot}/${task.id}` : apiRoot, task.id ? "PUT" : "POST", {
        id: task.id || 0,
        projectId,
        sprintId,
        parentTaskId: optionalNumberValue(root, "parentTaskId"),
        taskType: "Dev",
        title,
        descriptionHtml: richValue(root, "descriptionHtml"),
        stepsToReproduceHtml: "",
        actualResultHtml: "",
        expectedResultHtml: "",
        environment: "",
        severity: "",
        status,
        priority: value(root, "priority"),
        percentCompleted,
        url: value(root, "url"),
        startDate: nullableDateValue(root, "startDate"),
        endDate: nullableDateValue(root, "endDate"),
        reporterIds: [],
        assigneeIds,
        dependencyTaskIds
      });

      taskEntryProjectId = projectId;
      taskEntrySprintId = sprintId ? String(sprintId) : "";
      writePreference(preferenceKeys.taskEntryProject, taskEntryProjectId);
      writePreference(preferenceKeys.taskEntrySprint, taskEntrySprintId);

      await uploadWorkItemAttachments(root, result.id, attachFile, `${apiRoot}/${result.id}/attachments`);
    }, "title", root => bindTaskEditorRules(root, task));
  }

  function bindTaskEditorRules(root, task) {
    root.dataset.devTaskPercentRules = "true";
    bindAssigneeList(root, task.assigneeIds || [], "Assignees (Optional)");
    bindDevTaskPercentRule(root, task);
  }

  function bindDevTaskPercentRule(root, task) {
    const status = root.querySelector("[name='status']");
    const percent = root.querySelector("[name='percentCompleted']");
    if (!status || !percent) return;

    const applyDevTaskPercentRule = () => {
      if (percent.dataset.locked === "true") return;

      percent.value = percentForDevTaskSave(
        status.value,
        numberValue(root, "percentCompleted"),
        task,
        checkedNumbers(root, "dependencyTaskIds")
      );
    };

    status.addEventListener("change", applyDevTaskPercentRule);
    root.querySelectorAll("[name='dependencyTaskIds']").forEach(input => {
      input.addEventListener("change", applyDevTaskPercentRule);
    });
    applyDevTaskPercentRule();
  }

  function focusTaskField(root, name) {
    const control = root.querySelector(`[name='${name}']`);
    const field = control?.closest(".field");

    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    control?.focus({ preventScroll: true });
  }

  function selectContext(projectId, sprintId = "all") {
    taskProjectId = Number(projectId || 0);
    taskSprintId = String(sprintId || "all");
    writePreference(preferenceKeys.taskProject, taskProjectId);
    writePreference(preferenceKeys.taskSprint, taskSprintId);
  }

  function ensureSelectedProject() {
    if (taskProjectId && !state.projects.some(project => project.id === taskProjectId)) {
      taskProjectId = 0;
      writePreference(preferenceKeys.taskProject, taskProjectId);
    }
  }

  function taskProjectSprints(projectId = taskProjectId) {
    return state.sprints.filter(sprint => !projectId || sprint.projectId === projectId);
  }

  function taskEditorSprintOptions(projectId) {
    return [
      { id: "", title: "No Sprint" },
      ...state.sprints
        .filter(sprint => sprint.projectId === projectId)
        .map(sprint => ({ id: sprint.id, title: sprint.code }))
    ];
  }

  function taskTableSprintLabel(task) {
    const sprintLabel = sprintName(task.sprintId);
    const project = state.projects.find(item => item.id === task.projectId);
    const prefixes = project?.code ? [`${project.code}-`, `${project.code} - `, `${project.code} `] : [];
    const prefix = prefixes.find(item => sprintLabel.toLowerCase().startsWith(item.toLowerCase()));

    return prefix
      ? sprintLabel.slice(prefix.length)
      : sprintLabel;
  }

  function taskAssigneeColumnWidth(taskRows) {
    const avatarSize = 60;
    const overlapWidth = 42;
    const cellPadding = 34;
    const maxAssigneeCount = Math.max(
      1,
      ...taskRows.map(row => Array.isArray(row.task.assignees) ? row.task.assignees.length : 0)
    );

    return cellPadding + avatarSize + ((maxAssigneeCount - 1) * overlapWidth);
  }

  function taskRowsHaveMultipleAssignees(taskRows) {
    return taskRows.some(row => Array.isArray(row.task.assignees) && row.task.assignees.length > 1);
  }

  function taskHasAssociatedBug(task) {
    return Boolean(associatedBugForDevTask(task, task.dependencyTaskIds));
  }

  function taskBugFixRowIconHtml() {
    return `<img class="task-bug-fix-row-icon" src="${taskBugFixIconUrl}" title="Bug Fix" alt="Bug Fix">`;
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

  function taskTableColumnDefinitions(assigneeHeader = "Assigned") {
    return [
      {
        key: "assignee",
        label: "Assigned",
        headerLabel: assigneeHeader,
        colClass: "tasks-assigned-column",
        cellClass: "tasks-assignee-cell",
        width: 112,
        rubberMinWidth: 88,
        defaultVisible: true,
        cellHtml: task => taskRowAvatarsHtml(task.assignees)
      },
      {
        key: "context",
        label: "Project/Sprint",
        colClass: "tasks-context-column",
        cellClass: "work-item-context-cell task-context-cell",
        width: 190,
        rubberMinWidth: 140,
        defaultVisible: true,
        cellHtml: task => `
          <span class="task-context-project">${escapeHtml(projectName(task.projectId))}</span>
          <span class="task-context-sprint">${escapeHtml(taskTableSprintLabel(task))}</span>
        `
      },
      {
        key: "task",
        label: "Task",
        colClass: "tasks-title-column",
        cellClass: (task, row) => `${row.level ? "task-title-cell subtask-title-cell" : "task-title-cell"} work-item-title-cell`,
        width: 320,
        rubberMinWidth: 180,
        defaultVisible: true,
        cellHtml: (task, row) => `
          <div class="task-title-layout">
            <div class="task-title-content">
              <span class="work-item-code-line">
                <strong class="work-item-code">${escapeHtml(task.code)}</strong>
                ${row.level ? `<span class="subtask-pill">Subtask</span>` : ""}
              </span>
              <span class="work-item-title">${escapeHtml(task.title)}</span>
            </div>
          </div>
        `
      },
      {
        key: "priority",
        label: "Priority",
        colClass: "tasks-priority-column",
        width: 96,
        rubberMinWidth: 86,
        defaultVisible: true,
        cellHtml: task => `<span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span>`
      },
      {
        key: "status",
        label: "Status",
        colClass: "tasks-status-column",
        cellClass: "tasks-status-cell",
        width: 136,
        rubberMinWidth: 110,
        defaultVisible: true,
        cellHtml: task => taskStatusHtml(task.status)
      },
      {
        key: "percent",
        label: "% Complete",
        colClass: "tasks-complete-column",
        headerClass: "done-cell tasks-complete-cell",
        cellClass: "done-cell tasks-complete-cell",
        width: 180,
        rubberMinWidth: 120,
        defaultVisible: true,
        cellHtml: (task, row, context) => `${workItemTableProgressHtml(taskDisplayPercent(task))}${context.bugFixRowIcon}`
      },
      {
        key: "startDate",
        label: "Start Date",
        colClass: "tasks-date-column",
        cellClass: "tasks-date-cell",
        width: 116,
        rubberMinWidth: 96,
        cellHtml: task => escapeHtml(formatDate(task.startDate))
      },
      {
        key: "endDate",
        label: "End Date",
        colClass: "tasks-date-column",
        cellClass: "tasks-date-cell",
        width: 116,
        rubberMinWidth: 96,
        cellHtml: task => escapeHtml(formatDate(task.endDate))
      },
      {
        key: "startedAt",
        label: "Started Date/Time",
        colClass: "tasks-date-time-column",
        cellClass: "tasks-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: task => escapeHtml(formatDateTime(task.startedAt))
      },
      {
        key: "parentTask",
        label: "Parent Task",
        colClass: "tasks-related-column",
        cellClass: "tasks-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(taskRelatedTaskLabel(task.parentTaskId))
      },
      {
        key: "linkedBug",
        label: "Linked Bug",
        colClass: "tasks-related-column",
        cellClass: "tasks-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(taskLinkedBugLabel(task))
      },
      {
        key: "dependencies",
        label: "Dependencies",
        colClass: "tasks-related-column",
        cellClass: "tasks-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(taskDependencyLabel(task))
      },
      {
        key: "url",
        label: "URL",
        colClass: "tasks-url-column",
        cellClass: "tasks-url-cell",
        width: 180,
        rubberMinWidth: 130,
        cellHtml: task => escapeHtml(task.url || "")
      },
      {
        key: "attachmentCount",
        label: "Attachments",
        colClass: "tasks-count-column",
        cellClass: "tasks-number-cell",
        width: 104,
        rubberMinWidth: 88,
        cellHtml: task => task.attachments?.length ? String(task.attachments.length) : ""
      },
      {
        key: "sortOrder",
        label: "Sort Order",
        colClass: "tasks-number-column",
        cellClass: "tasks-number-cell",
        width: 96,
        rubberMinWidth: 80,
        cellHtml: task => String(task.sortOrder ?? "")
      },
      {
        key: "createdBy",
        label: "Created By",
        colClass: "tasks-user-column",
        cellClass: "tasks-compact-text-cell",
        width: 132,
        rubberMinWidth: 110,
        cellHtml: task => escapeHtml(taskUserName(task.createdByUserId))
      },
      {
        key: "createdAt",
        label: "Created Date/Time",
        colClass: "tasks-date-time-column",
        cellClass: "tasks-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: task => escapeHtml(formatDateTime(task.createdAt))
      },
      {
        key: "updatedBy",
        label: "Updated By",
        colClass: "tasks-user-column",
        cellClass: "tasks-compact-text-cell",
        width: 132,
        rubberMinWidth: 110,
        cellHtml: task => escapeHtml(taskUserName(task.updatedByUserId))
      },
      {
        key: "updatedAt",
        label: "Last Updated Date/Time",
        colClass: "tasks-date-time-column",
        cellClass: "tasks-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: task => escapeHtml(formatDateTime(task.updatedAt))
      }
    ];
  }

  function taskColumnFilterItems() {
    return taskOrderedTableColumns("Assigned")
      .map(column => ({ value: column.key, text: column.label }));
  }

  function taskTableColumnColHtml(column, isRubber = false) {
    const className = [column.colClass, isRubber ? "tasks-rubber-column" : ""]
      .filter(Boolean)
      .join(" ");

    return `<col class="${escapeAttr(className)}">`;
  }

  function taskTableColumnCellHtml(column, task, row, context, isRubber = false) {
    const baseClassName = typeof column.cellClass === "function"
      ? column.cellClass(task, row)
      : column.cellClass || "";
    const className = [baseClassName, isRubber ? "tasks-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return `<td class="${escapeAttr(className)}">${column.cellHtml(task, row, context)}</td>`;
  }

  function taskColumnHeaderHtml(column, isRubber = false) {
    const className = [column.headerClass || "", isRubber ? "tasks-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return taskSortHeaderHtml(column.key, column.headerLabel || column.label, className, {
      draggable: taskTableMode.active
    });
  }

  function taskVisibleTableColumns(assigneeHeader) {
    const visibleKeys = new Set(taskColumnPrefs.visible);
    const columns = taskOrderedTableColumns(assigneeHeader)
      .filter(column => visibleKeys.has(column.key));

    return columns.length
      ? columns
      : taskTableColumnDefinitions(assigneeHeader).filter(column => column.key === "task");
  }

  function taskOrderedTableColumns(assigneeHeader) {
    const definitions = taskTableColumnDefinitions(assigneeHeader);
    const columnsByKey = new Map(definitions.map(column => [column.key, column]));

    return normalizedTaskColumnOrder(taskColumnPrefs.order)
      .map(key => columnsByKey.get(key))
      .filter(Boolean);
  }

  function taskTableMinWidth(columns) {
    const fixedWidth = 16 + (taskTableMode.active ? 224 : 0);
    const lastColumnIndex = columns.length - 1;
    const columnsWidth = columns.reduce((total, column, index) =>
      total + taskColumnMinimumWidth(column, index === lastColumnIndex), 0);
    return Math.max(960, fixedWidth + columnsWidth);
  }

  function taskColumnMinimumWidth(column, isRubber) {
    if (isRubber) return column.rubberMinWidth || Math.min(column.width || 140, 140);
    return column.width || 140;
  }

  function taskColumnIsRubber(columns, index) {
    return index === columns.length - 1;
  }

  function normalizeTaskColumnPrefs(preferences = {}) {
    const savedPreferences = preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? preferences
      : {};
    const visibleKeys = normalizeSavedArray(savedPreferences.visible)
      .filter(key => taskColumnKeySet().has(key));

    return {
      order: normalizedTaskColumnOrder(savedPreferences.order),
      visible: visibleKeys.length ? visibleKeys : taskDefaultVisibleColumnKeys()
    };
  }

  function normalizedTaskColumnOrder(order = []) {
    const allowedKeys = taskColumnKeySet();
    const orderedKeys = normalizeSavedArray(order)
      .filter(key => allowedKeys.has(key));

    taskTableColumnDefinitions().forEach(column => {
      if (!orderedKeys.includes(column.key)) orderedKeys.push(column.key);
    });

    return orderedKeys;
  }

  function taskColumnOrderWithAddedColumns(order, addedColumns) {
    const orderedKeys = normalizedTaskColumnOrder(order);

    addedColumns
      .filter(column => column !== "percent" && taskColumnKeySet().has(column))
      .forEach(column => {
        const existingIndex = orderedKeys.indexOf(column);
        if (existingIndex >= 0) orderedKeys.splice(existingIndex, 1);

        const percentIndex = orderedKeys.indexOf("percent");
        orderedKeys.splice(percentIndex >= 0 ? percentIndex : orderedKeys.length, 0, column);
      });

    return orderedKeys;
  }

  function taskColumnKeySet() {
    return new Set(taskTableColumnDefinitions().map(column => column.key));
  }

  function taskDefaultVisibleColumnKeys() {
    return taskTableColumnDefinitions()
      .filter(column => column.defaultVisible)
      .map(column => column.key);
  }

  function saveTaskColumnPrefs() {
    writeJsonPreference(preferenceKeys.taskTableColumns, taskColumnPrefs);
  }

  function bindTaskColumnDragEvents() {
    app.addEventListener("pointerdown", handleTaskColumnPointerDown);
    app.addEventListener("mousedown", handleTaskColumnMouseDown);
    app.addEventListener("click", suppressTaskColumnDraggedClick, true);
  }

  function handleTaskColumnPointerDown(event) {
    lastTaskColumnPointerDragAt = Date.now();
    startTaskColumnDrag(event, "pointer");
  }

  function handleTaskColumnMouseDown(event) {
    if (Date.now() - lastTaskColumnPointerDragAt < 500) return;
    startTaskColumnDrag(event, "mouse");
  }

  function startTaskColumnDrag(event, inputType) {
    if (event.button !== 0) return;
    if (!taskTableMode.active) return;

    const header = event.target.closest('.tasks-table th[data-task-column][data-column-draggable="true"]');
    const table = header?.closest(".tasks-table");
    if (!header || !table || !app.contains(header)) return;

    const columnKey = header.dataset.taskColumn || "";
    if (!taskColumnPrefs.visible.includes(columnKey)) return;

    taskColumnDrag = {
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
      window.addEventListener("pointermove", handleTaskColumnPointerMove);
      window.addEventListener("pointerup", handleTaskColumnPointerUp, { once: true });
      window.addEventListener("pointercancel", cancelTaskColumnDrag, { once: true });
    } else {
      window.addEventListener("mousemove", handleTaskColumnMouseMove);
      window.addEventListener("mouseup", handleTaskColumnMouseUp, { once: true });
    }
  }

  function handleTaskColumnPointerMove(event) {
    lastTaskColumnPointerDragAt = Date.now();
    moveTaskColumnDrag(event);
  }

  function handleTaskColumnMouseMove(event) {
    if (taskColumnDrag?.inputType === "pointer") return;
    moveTaskColumnDrag(event);
  }

  function moveTaskColumnDrag(event) {
    if (!taskColumnDrag) return;

    const movedEnough = Math.hypot(event.clientX - taskColumnDrag.startX, event.clientY - taskColumnDrag.startY) > 5;
    if (!taskColumnDrag.started && !movedEnough) return;

    if (!taskColumnDrag.started) {
      taskColumnDrag.started = true;
      suppressNextTaskColumnClick = true;
      taskColumnDrag.source.classList.add("column-dragging");
      taskColumnDrag.table.classList.add("is-column-dragging");
    }

    event.preventDefault();
    updateTaskColumnDropIndicator(event.clientX, event.clientY);
  }

  async function handleTaskColumnPointerUp(event) {
    lastTaskColumnPointerDragAt = Date.now();
    finishTaskColumnDrag(event);
  }

  async function handleTaskColumnMouseUp(event) {
    if (taskColumnDrag?.inputType === "pointer") return;
    finishTaskColumnDrag(event);
  }

  function finishTaskColumnDrag(event) {
    if (!taskColumnDrag || taskColumnDrag.finishing) return;
    taskColumnDrag.finishing = true;

    if (!taskColumnDrag.started) {
      cancelTaskColumnDrag();
      return;
    }

    event.preventDefault();
    suppressNextTaskColumnClick = true;

    const drag = taskColumnDrag;
    const drop = taskColumnDropTarget(event.clientX, event.clientY);
    if (drop) {
      const order = taskColumnKeysAfterDrop(drag.columnKey, drop.target.dataset.taskColumn || "", drop.placement);
      if (taskColumnOrderChanged(order)) {
        taskColumnPrefs = normalizeTaskColumnPrefs({ ...taskColumnPrefs, order });
        saveTaskColumnPrefs();
        cancelTaskColumnDrag();
        renderTasks();
        return;
      }
    }

    cancelTaskColumnDrag();
  }

  function taskColumnDropTarget(clientX, clientY) {
    if (!taskColumnDrag) return null;

    const headerRow = taskColumnDrag.table.querySelector("thead tr");
    const headerRect = headerRow?.getBoundingClientRect();
    if (!headerRect || clientY < headerRect.top - 32 || clientY > headerRect.bottom + 64) return null;

    const headers = [...taskColumnDrag.table.querySelectorAll('thead th[data-task-column][data-column-draggable="true"]')]
      .filter(header => (header.dataset.taskColumn || "") !== taskColumnDrag.columnKey);
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

  function updateTaskColumnDropIndicator(clientX, clientY) {
    clearTaskColumnDropIndicators();

    const drop = taskColumnDropTarget(clientX, clientY);
    if (!drop) return;

    taskColumnDrag.table.classList.add("column-drop-target");
    drop.target.classList.add(drop.placement === "after" ? "column-reorder-after" : "column-reorder-before");
  }

  function taskColumnKeysAfterDrop(draggedKey, targetKey, placement) {
    const orderedKeys = normalizedTaskColumnOrder(taskColumnPrefs.order)
      .filter(key => key !== draggedKey);
    let insertIndex = orderedKeys.indexOf(targetKey);
    if (insertIndex < 0) return normalizedTaskColumnOrder(taskColumnPrefs.order);
    if (placement === "after") insertIndex += 1;
    orderedKeys.splice(insertIndex, 0, draggedKey);
    return orderedKeys;
  }

  function taskColumnOrderChanged(order) {
    const currentOrder = normalizedTaskColumnOrder(taskColumnPrefs.order);
    return order.length !== currentOrder.length || order.some((key, index) => key !== currentOrder[index]);
  }

  function cancelTaskColumnDrag() {
    window.removeEventListener("pointermove", handleTaskColumnPointerMove);
    window.removeEventListener("mousemove", handleTaskColumnMouseMove);
    window.removeEventListener("pointerup", handleTaskColumnPointerUp);
    window.removeEventListener("mouseup", handleTaskColumnMouseUp);
    window.removeEventListener("pointercancel", cancelTaskColumnDrag);

    if (taskColumnDrag?.inputType === "pointer" && taskColumnDrag.source.releasePointerCapture && taskColumnDrag.pointerId !== undefined) {
      try {
        taskColumnDrag.source.releasePointerCapture(taskColumnDrag.pointerId);
      } catch {
        // The browser may already have released pointer capture.
      }
    }

    taskColumnDrag = null;
    app.querySelectorAll(".column-dragging, .is-column-dragging, .column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove(
        "column-dragging",
        "is-column-dragging",
        "column-drop-target",
        "column-reorder-before",
        "column-reorder-after"
      ));
  }

  function clearTaskColumnDropIndicators() {
    app.querySelectorAll(".column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove("column-drop-target", "column-reorder-before", "column-reorder-after"));
  }

  function suppressTaskColumnDraggedClick(event) {
    if (!suppressNextTaskColumnClick) return;
    suppressNextTaskColumnClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function taskRelatedTaskLabel(taskId) {
    const task = taskId ? taskById(taskId) : null;
    return task ? taskDisplayLabel(task) : "";
  }

  function taskLinkedBugLabel(task) {
    const bug = associatedBugForDevTask(task, task.dependencyTaskIds);
    return bug ? taskDisplayLabel(bug) : "";
  }

  function taskDependencyLabel(task) {
    return (task.dependencyTaskIds || [])
      .map(taskId => taskById(taskId))
      .filter(Boolean)
      .map(taskDisplayLabel)
      .join(", ");
  }

  function taskDisplayLabel(task) {
    return [task.code, task.title].filter(Boolean).join(" - ");
  }

  function taskUserName(userId) {
    const user = userId ? userById(Number(userId)) : null;
    return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  }

  function taskStatusHtml(status) {
    return `
      <span class="task-status-text" style="--status-color:${escapeAttr(statusColor(status))}">
        <i aria-hidden="true"></i>
        ${escapeHtml(status || "")}
      </span>
    `;
  }

  function taskSubTaskToggleHtml(task, isCollapsed) {
    const label = isCollapsed ? "Expand sub-tasks" : "Collapse sub-tasks";

    return `
      <button
        type="button"
        class="task-subtask-toggle"
        data-action="toggle-task-subtasks"
        data-id="${task.id}"
        title="${label}"
        aria-label="${label}"
        aria-expanded="${!isCollapsed}">
        <span aria-hidden="true">${isCollapsed ? "&#43;" : "&#8722;"}</span>
      </button>
    `;
  }

  function taskChildTasksByParent(tasks) {
    const taskIds = new Set(tasks.map(task => task.id));
    const childrenByParent = new Map();

    tasks.forEach(task => {
      if (!task.parentTaskId || !taskIds.has(task.parentTaskId)) return;
      if (!childrenByParent.has(task.parentTaskId)) childrenByParent.set(task.parentTaskId, []);
      childrenByParent.get(task.parentTaskId).push(task);
    });

    return childrenByParent;
  }

  function taskRowsWithVisibleSubTasks(tasks) {
    const taskMap = new Map(tasks.map(task => [task.id, task]));

    return taskRowsWithSubTasks(tasks)
      .filter(row => !row.level || !taskHasCollapsedAncestor(row.task, taskMap));
  }

  function taskHasVisibleSubTasks(task, childrenByParent) {
    return Boolean(childrenByParent.get(task.id)?.length);
  }

  function taskHasCollapsedAncestor(task, taskMap) {
    let parentId = task.parentTaskId;
    const visited = new Set();

    while (parentId && taskMap.has(parentId) && !visited.has(parentId)) {
      if (taskSubTasksCollapsed(parentId)) return true;
      visited.add(parentId);
      parentId = taskMap.get(parentId)?.parentTaskId;
    }

    return false;
  }

  function taskSubTasksCollapsed(taskId) {
    return taskCollapsedSubTasks[String(taskId)] === true;
  }

  function toggleTaskSubTasks(taskId) {
    const key = String(taskId);
    if (taskCollapsedSubTasks[key]) {
      delete taskCollapsedSubTasks[key];
    } else {
      taskCollapsedSubTasks[key] = true;
    }

    writeJsonPreference(preferenceKeys.taskCollapsedSubTasks, taskCollapsedSubTasks);
  }

  function defaultSprintId(projectSprints) {
    return projectSprints.length ? "current" : "all";
  }

  function taskMatchesSprintFilter(task, selectedSprint) {
    if (taskSprintId === "all") return true;
    if (taskSprintId === "current" && !taskProjectId) {
      const projectCurrentSprint = getCurrentSprint(taskProjectSprints(task.projectId));
      return projectCurrentSprint ? task.sprintId === projectCurrentSprint.id : false;
    }
    return selectedSprint ? task.sprintId === selectedSprint.id : false;
  }

  function filteredTaskList(tasks) {
    const taskMap = new Map(tasks.map(task => [task.id, task]));
    const visibleIds = new Set();

    tasks
      .filter(taskMatchesTaskFiltersWithoutCompletion)
      .forEach(task => {
        const parent = task.parentTaskId ? taskMap.get(task.parentTaskId) : null;
        const completedSubTaskWithOpenParent = parent && !isTaskCompleted(parent) && isTaskCompleted(task);

        if (!taskFilters.hideCompleted || !isTaskCompleted(task) || completedSubTaskWithOpenParent) {
          visibleIds.add(task.id);
        }
      });

    if (taskFilters.hideCompleted) {
      tasks
        .filter(task => task.parentTaskId)
        .filter(task => isTaskCompleted(task))
        .filter(task => taskMatchesTaskFiltersWithoutCompletion(task))
        .forEach(task => {
          const parent = taskMap.get(task.parentTaskId);
          if (parent && visibleIds.has(parent.id) && !isTaskCompleted(parent)) {
            visibleIds.add(task.id);
          }
        });
    }

    [...visibleIds].forEach(id => addTaskAncestors(id, visibleIds, taskMap));

    return tasks
      .filter(task => visibleIds.has(task.id))
      .sort(taskMainTaskSortCompare);
  }

  function normalizeTaskFilters(filters = {}) {
    const sort = filters.sort === "highest-complete"
      ? "percent-desc"
      : filters.sort === "lowest-complete"
        ? "percent-asc"
        : filters.sort || "custom";

    return {
      ...filters,
      statuses: normalizeSavedArray(filters.statuses),
      assigneeIds: normalizeSavedArray(filters.assigneeIds),
      priorities: normalizeSavedArray(filters.priorities),
      sort,
      search: String(filters.search || ""),
      hideCompleted: Boolean(filters.hideCompleted)
    };
  }

  function addTaskAncestors(taskId, visibleIds, taskMap) {
    let task = taskMap.get(taskId);
    while (task?.parentTaskId && taskMap.has(task.parentTaskId)) {
      task = taskMap.get(task.parentTaskId);
      visibleIds.add(task.id);
    }
  }

  function taskMatchesTaskFiltersWithoutCompletion(task) {
    const selectedStatuses = taskFilters.statuses || [];
    const selectedAssignees = taskFilters.assigneeIds || [];
    const selectedPriorities = taskFilters.priorities || [];
    const taskAssignees = (task.assigneeIds || []).map(String);

    if (!taskMatchesSearchFilter(task)) return false;
    if (selectedStatuses.length && !selectedStatuses.includes(task.status)) return false;
    if (selectedPriorities.length && !selectedPriorities.includes(task.priority)) return false;
    if (selectedAssignees.length && !taskAssignees.some(id => selectedAssignees.includes(id))) return false;

    return true;
  }

  function taskMatchesSearchFilter(task) {
    const term = String(taskFilters.search || "").trim().toLowerCase();
    if (!term) return true;

    return taskSearchValues(task)
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(term));
  }

  function taskSearchValues(task) {
    return [
      task.code,
      task.title,
      projectName(task.projectId),
      taskTableSprintLabel(task),
      task.status,
      task.priority,
      userNames(task.assignees),
      taskRelatedTaskLabel(task.parentTaskId),
      taskLinkedBugLabel(task),
      taskDependencyLabel(task),
      task.url,
      task.sortOrder,
      taskUserName(task.createdByUserId),
      taskUserName(task.updatedByUserId),
      formatDate(task.startDate),
      formatDate(task.endDate),
      formatDateTime(task.createdAt),
      formatDateTime(task.updatedAt)
    ];
  }

  function taskMainTaskSortCompare(a, b) {
    const aIsSubTask = Boolean(a.parentTaskId);
    const bIsSubTask = Boolean(b.parentTaskId);

    if (aIsSubTask && bIsSubTask) return taskOrderCompare(a, b);
    if (aIsSubTask) return 1;
    if (bIsSubTask) return -1;

    return taskSortCompare(a, b);
  }

  function taskSortCompare(a, b) {
    const state = taskTableSortState();

    if (state.column && state.direction) {
      const result = compareTaskSortColumn(a, b, state.column);
      if (result) return state.direction === "asc" ? result : -result;
      return taskOrderCompare(a, b);
    }

    if (taskFilters.sort === "oldest") return taskCreatedTime(a) - taskCreatedTime(b) || a.id - b.id;
    if (taskFilters.sort === "newest") return taskCreatedTime(b) - taskCreatedTime(a) || b.id - a.id;
    if (taskFilters.sort === "highest-complete") return taskDisplayPercent(b) - taskDisplayPercent(a) || taskCreatedTime(b) - taskCreatedTime(a);
    if (taskFilters.sort === "lowest-complete") return taskDisplayPercent(a) - taskDisplayPercent(b) || taskCreatedTime(b) - taskCreatedTime(a);

    return taskOrderCompare(a, b);
  }

  function compareTaskSortColumn(a, b, column) {
    if (column === "percent") return taskDisplayPercent(a) - taskDisplayPercent(b);
    if (column === "sortOrder") return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (column === "attachmentCount") return Number(a.attachments?.length || 0) - Number(b.attachments?.length || 0);
    if (column === "startDate") return compareTaskDateValue(a.startDate, b.startDate);
    if (column === "endDate") return compareTaskDateValue(a.endDate, b.endDate);
    if (column === "startedAt") return compareTaskDateValue(a.startedAt, b.startedAt);
    if (column === "createdAt") return compareTaskDateValue(a.createdAt, b.createdAt);
    if (column === "updatedAt") return compareTaskDateValue(a.updatedAt, b.updatedAt);
    if (column === "priority") return compareLookupSortValue(a.priority, b.priority, getPriorities());
    if (column === "status") return compareLookupSortValue(a.status, b.status, getStatuses());

    return taskSortTextValue(a, column).localeCompare(taskSortTextValue(b, column), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function taskSortTextValue(task, column) {
    if (column === "assignee") return userNames(task.assignees);
    if (column === "context") return `${projectName(task.projectId)} ${taskTableSprintLabel(task)}`;
    if (column === "task") return `${task.code || ""} ${task.title || ""}`;
    if (column === "parentTask") return taskRelatedTaskLabel(task.parentTaskId);
    if (column === "linkedBug") return taskLinkedBugLabel(task);
    if (column === "dependencies") return taskDependencyLabel(task);
    if (column === "url") return task.url || "";
    if (column === "createdBy") return taskUserName(task.createdByUserId);
    if (column === "updatedBy") return taskUserName(task.updatedByUserId);
    return "";
  }

  function compareTaskDateValue(a, b) {
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

  function taskSortHeaderHtml(column, label, className = "", options = {}) {
    const state = taskTableSortState();
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const classes = [className, isSorted ? "is-sorted" : ""].filter(Boolean).join(" ");
    const columnDragAttrs = `
      data-task-column="${escapeAttr(column)}"
      data-column-draggable="${options.draggable ? "true" : "false"}"`;

    return `
      <th class="${classes}" aria-sort="${ariaSort}" ${columnDragAttrs}>
        <button type="button" class="table-sort-button" data-action="sort-task-table" data-column="${escapeAttr(column)}" title="${escapeAttr(taskNextSortLabel(column, label))}">
          <span>${escapeHtml(label)}</span>
          <span class="table-sort-indicator" aria-hidden="true">${arrow}</span>
        </button>
      </th>
    `;
  }

  function updateTaskTableSort(button) {
    const column = button?.dataset?.column || "";
    if (!taskTableSortColumns().some(item => item.column === column)) return false;

    taskFilters.sort = nextTaskSort(column);
    saveTaskFilters();
    renderTasks();
    return true;
  }

  function nextTaskSort(column) {
    const state = taskTableSortState();
    if (state.column !== column || !state.direction) return `${column}-asc`;
    if (state.direction === "asc") return `${column}-desc`;
    return "custom";
  }

  function taskTableSortState(sortValue = taskFilters.sort) {
    if (sortValue === "highest-complete") return { column: "percent", direction: "desc" };
    if (sortValue === "lowest-complete") return { column: "percent", direction: "asc" };

    const match = /^(.+)-(asc|desc)$/.exec(sortValue || "");
    if (!match) return { column: "", direction: "" };
    return { column: match[1], direction: match[2] };
  }

  function taskSortOptionsHtml() {
    const selectedSort = taskFilters.sort || "custom";
    const options = [
      { value: "custom", text: "Custom Order (Saved Order)" },
      { value: "newest", text: "Newest Dev Tasks" },
      { value: "oldest", text: "Oldest Dev Tasks" },
      ...taskTableSortColumns().flatMap(column => [
        { value: `${column.column}-asc`, text: `${column.label} Ascending` },
        { value: `${column.column}-desc`, text: `${column.label} Descending` }
      ])
    ];

    return options
      .map(option => `<option value="${escapeAttr(option.value)}" ${selectedSort === option.value ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
      .join("");
  }

  function taskTableSortColumns() {
    return taskTableColumnDefinitions("Assigned")
      .map(column => ({ column: column.key, label: column.label }));
  }

  function taskNextSortLabel(column, label) {
    const state = taskTableSortState();
    if (state.column === column && state.direction === "asc") return `Sort ${label} descending`;
    if (state.column === column && state.direction === "desc") return `Clear ${label} sort`;
    return `Sort ${label} ascending`;
  }

  function openTaskExportDialog() {
    openExportDialog({
      title: "Export Dev Tasks",
      onCsvExport: exportTaskCsv,
      onExcelExport: exportTaskExcel
    });
  }

  function exportTaskCsv() {
    const rows = taskExportRows();
    const columns = taskExportImportColumns(rows);

    downloadCsv(exportFileName("pmt-dev-tasks"), columns, rows);
  }

  function exportTaskExcel() {
    const rows = taskExportRows();
    const columns = taskExportImportColumns(rows);

    downloadXlsx(exportFileName("pmt-dev-tasks", "xlsx"), "Dev Tasks", columns, rows);
  }

  function taskExportImportColumns(rows) {
    const assigneeHeader = taskRowsHaveMultipleAssignees(rows) ? "Assignees" : "Assignee";
    return [
      ...taskExportColumns(taskVisibleTableColumns(assigneeHeader)),
      ...workItemSystemColumns({
        nameHeader: "PMT Update Task Name",
        itemTypeLabel: () => "Dev Task",
        percentValue: task => taskDisplayPercent(task),
        assigneeLabel: task => userNames(task.assignees)
      })
    ];
  }

  function openTaskImport() {
    openExcelImport({
      onImport: importTaskExcel,
      onError: error => showImportResultDialog({
        title: "Import Dev Tasks",
        totalRows: 0,
        updatedRows: 0,
        errors: [{ rowNumber: "File", message: error.message }]
      })
    });
  }

  async function importTaskExcel(records) {
    const workbookError = importWorkbookTypeError(records, ["Dev"], "Dev Tasks");
    if (workbookError) {
      showImportResultDialog({
        title: "Import Dev Tasks",
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
        if (await importTaskRecord(record)) updatedRows += 1;
      } catch (error) {
        const id = parseImportItemId(record);
        const task = id ? taskById(id) : null;
        errors.push({
          rowNumber,
          code: importCell(record, "PMT Item Code") || task?.code || "",
          title: importCell(record, "PMT Update Task Name", "Task Name") || task?.title || "",
          message: error.message
        });
      }
    }

    if (updatedRows && refreshAfterImport) await refreshAfterImport();
    showImportResultDialog({
      title: "Import Dev Tasks",
      totalRows: records.length,
      updatedRows,
      errors
    });
  }

  async function importTaskRecord(record) {
    const task = taskById(parseImportItemId(record));
    if (!task) throw new Error("PMT Item Id does not match an existing row.");
    if (task.taskType === "Bug") throw new Error("This row is a Bug, not a Dev Task.");
    assertTaskImportAllowed(task);

    assertImportItemCode(record, task.code, "Task Code");
    assertTaskImportHash(record, task);

    const title = importCell(record, "Task Name", "PMT Update Task Name", "PMT Update Item Name").trim();
    const status = importCell(record, "Status", "PMT Update Status").trim();
    const priority = importCell(record, "Priority", "PMT Update Priority").trim();
    const requestedPercent = parseImportPercent(record, "% Complete");
    const assigneeIds = uniqueIds(parseImportAssigneeIds(record, state.users, "Assignee", "Assignees", "Assigned"));

    if (!title) throw new Error("Task Name is required.");
    if (!getStatuses().includes(status)) throw new Error(`Status "${status}" is not a PMT status.`);
    if (!getPriorities().includes(priority)) throw new Error(`Priority "${priority}" is not a PMT priority.`);
    validateTaskImportAssignees(task, assigneeIds);
    if (task.subTasks?.length && requestedPercent !== taskDisplayPercent(task)) {
      throw new Error("Percent Completed is calculated from sub-tasks for this row.");
    }

    const percentCompleted = percentForDevTaskSave(status, requestedPercent, task, task.dependencyTaskIds || []);
    validateLinkedBugCompletion(task, percentCompleted, task.dependencyTaskIds || []);

    if (!taskImportChanged(task, { title, status, priority, percentCompleted, assigneeIds })) return false;

    await saveJson(`/api/tasks/${task.id}`, "PUT", taskImportPayload(task, {
      title,
      status,
      priority,
      percentCompleted,
      assigneeIds
    }));
    return true;
  }

  function assertTaskImportHash(record, task) {
    const hash = importCell(record, "PMT Row Hash").trim();
    if (hash && hash !== workItemImportHash(task, taskDisplayPercent(task))) {
      throw new Error("This row is stale. Re-export the grid before importing this row.");
    }
  }

  function validateTaskImportAssignees(task, assigneeIds) {
    const project = state.projects.find(item => item.id === task.projectId);
    const sprint = task.sprintId ? state.sprints.find(item => item.id === task.sprintId) : null;
    const allowedIds = new Set(allowedAssigneeUsers(state.users, project, sprint).map(user => user.id));
    const invalid = assigneeIds.filter(id => !allowedIds.has(id));
    if (invalid.length) throw new Error(`Assignee ids are not valid for this Project/Sprint: ${invalid.join(", ")}.`);
  }

  function taskImportChanged(task, updates) {
    return task.title !== updates.title
      || task.status !== updates.status
      || task.priority !== updates.priority
      || Number(task.percentCompleted || 0) !== Number(updates.percentCompleted || 0)
      || !sameNumberList(task.assigneeIds || [], updates.assigneeIds || []);
  }

  function taskImportPayload(task, updates) {
    return {
      id: task.id,
      projectId: task.projectId,
      sprintId: task.sprintId || null,
      parentTaskId: task.parentTaskId || null,
      taskType: "Dev",
      title: updates.title,
      descriptionHtml: task.descriptionHtml || "",
      stepsToReproduceHtml: "",
      actualResultHtml: "",
      expectedResultHtml: "",
      environment: "",
      severity: "",
      status: updates.status,
      priority: updates.priority,
      percentCompleted: updates.percentCompleted,
      url: task.url || "",
      startDate: task.startDate || null,
      endDate: task.endDate || null,
      reporterIds: [],
      assigneeIds: updates.assigneeIds,
      dependencyTaskIds: task.dependencyTaskIds || [],
      auditContext: "Import"
    };
  }

  function assertTaskImportAllowed(task) {
    const user = currentUser();
    if (user.isAdmin || user.role === "Admin") return;
    if (task.createdByUserId !== user.id) {
      throw new Error("Only an Admin can import updates for another user's task.");
    }
  }

  function taskExportRows() {
    ensureSelectedProject();
    const projectSprints = taskProjectSprints();
    const selectedSprint = taskSelectedSprint(projectSprints);
    const allProjectDevTasks = state.tasks
      .filter(task => !taskProjectId || task.projectId === taskProjectId)
      .filter(task => task.taskType !== "Bug");
    const baseTasks = allProjectDevTasks
      .filter(task => taskMatchesSprintFilter(task, selectedSprint));

    return taskRowsWithVisibleSubTasks(filteredTaskList(baseTasks));
  }

  function taskExportColumns(visibleColumns) {
    return visibleColumns.flatMap(column => {
      if (column.key === "assignee") return [{ header: column.headerLabel || column.label, value: row => userNames(row.task.assignees) }];
      if (column.key === "context") {
        return [
          { header: "Project", value: row => projectName(row.task.projectId) },
          { header: "Sprint", value: row => taskTableSprintLabel(row.task) }
        ];
      }
      if (column.key === "task") {
        return [
          { header: "Task Code", value: row => row.task.code },
          { header: "Task Name", value: row => row.task.title },
          { header: "Row Type", value: row => row.level ? "Subtask" : "Task" }
        ];
      }

      return [{ header: column.label, value: row => taskExportValue(column.key, row.task) }];
    });
  }

  function taskExportValue(columnKey, task) {
    if (columnKey === "priority") return task.priority;
    if (columnKey === "status") return task.status;
    if (columnKey === "percent") return taskDisplayPercent(task);
    if (columnKey === "startDate") return formatDate(task.startDate);
    if (columnKey === "endDate") return formatDate(task.endDate);
    if (columnKey === "startedAt") return formatDateTime(task.startedAt);
    if (columnKey === "parentTask") return taskRelatedTaskLabel(task.parentTaskId);
    if (columnKey === "linkedBug") return taskLinkedBugLabel(task);
    if (columnKey === "dependencies") return taskDependencyLabel(task);
    if (columnKey === "url") return task.url || "";
    if (columnKey === "attachmentCount") return task.attachments?.length || "";
    if (columnKey === "sortOrder") return task.sortOrder ?? "";
    if (columnKey === "createdBy") return taskUserName(task.createdByUserId);
    if (columnKey === "createdAt") return formatDateTime(task.createdAt);
    if (columnKey === "updatedBy") return taskUserName(task.updatedByUserId);
    if (columnKey === "updatedAt") return formatDateTime(task.updatedAt);
    return "";
  }

  function resetTaskView() {
    [
      preferenceKeys.taskProject,
      preferenceKeys.taskSprint,
      preferenceKeys.taskEntryProject,
      preferenceKeys.taskEntrySprint,
      preferenceKeys.taskFilters,
      preferenceKeys.taskFiltersVisible,
      preferenceKeys.taskVisualChartsVisible,
      preferenceKeys.taskCollapsedSubTasks,
      preferenceKeys.taskTableColumns
    ].forEach(removePreference);

    taskProjectId = 0;
    taskSprintId = "current";
    taskEntryProjectId = 0;
    taskEntrySprintId = "";
    taskFilters = normalizeTaskFilters({});
    taskVisualChartsVisible = true;
    taskCollapsedSubTasks = {};
    taskColumnPrefs = normalizeTaskColumnPrefs({});
    taskTableMode.deactivate();
    cancelTaskColumnDrag();
    renderTasks();
  }

  function taskVisualTrackingChartsHtml(sprintFilterTasks, selectedSprint, devTasks) {
    const currentSprint = taskChartCurrentSprint();
    const charts = [
      taskDeveloperWorkloadChartHtml(selectedSprint, sprintFilterTasks),
      taskStatusHorizontalChartHtml(selectedSprint, sprintFilterTasks),
      taskCurrentSprintPieChartHtml(selectedSprint, sprintFilterTasks),
      taskPastSixSprintsColumnChartHtml(devTasks, currentSprint)
    ].filter(Boolean);

    return VisualCharts.panel("Dev Task Tracking Charts", charts, {
      className: "tasks-chart-panel",
      hideHeader: true
    });
  }

  function taskCurrentSprintPieChartHtml(selectedSprint, sprintTasks) {
    const completedTasks = sprintTasks.filter(isTaskCompleted);
    const openTasks = sprintTasks.filter(task => !isTaskCompleted(task));
    const items = [
      taskChartGroupedItem("Completed", completedTasks, "var(--color-success)", `Completed: ${completedTasks.length} Dev Task${completedTasks.length === 1 ? "" : "s"}`),
      taskChartGroupedItem("Still Open", openTasks, "var(--color-warning)", `Still Open: ${openTasks.length} Dev Task${openTasks.length === 1 ? "" : "s"}`)
    ].filter(item => item.value > 0);
    const completedPercent = sprintTasks.length
      ? Math.round((completedTasks.length / sprintTasks.length) * 100)
      : 0;
    const openPercent = sprintTasks.length
      ? Math.round((openTasks.length / sprintTasks.length) * 100)
      : 0;

    return VisualCharts.card({
      title: "Sprint Dev Task Mix",
      subtitle: taskSprintFilterSubtitle(selectedSprint),
      className: "task-chart-card task-mix-chart-card",
      body: `
        ${VisualCharts.pieChart(items, `${sprintTasks.length} total`, "No Dev Tasks match the selected Sprint filter.", {
          donut: true,
          centerValue: String(sprintTasks.length),
          centerLabel: "Total"
        })}
        <div class="task-mix-insight" aria-label="Completed ${completedPercent} percent; still open ${openPercent} percent">
          <span class="task-mix-insight-icon" aria-hidden="true">&#8599;</span>
          <span>Completed: <b class="is-completed">${completedPercent}%</b></span>
          <span>Still Open: <b class="is-open">${openPercent}%</b></span>
        </div>
      `
    });
  }

  function taskPastSixSprintsColumnChartHtml(devTasks, currentSprint) {
    if (!currentSprint) return null;

    const projectSprints = taskProjectSprints()
      .sort((a, b) => (getItemStartDate(b)?.getTime() || 0) - (getItemStartDate(a)?.getTime() || 0) || b.code.localeCompare(a.code));
    const rows = projectSprints.map(sprint => {
      const sprintTasks = devTasks.filter(task => task.sprintId === sprint.id);
      return {
        sprintId: sprint.id,
        label: sprint.code,
        total: sprintTasks.length,
        completed: sprintTasks.filter(isTaskCompleted).length
      };
    }).filter(row => row.total > 0 || row.completed > 0);

    if (!rows.length) return null;

    return VisualCharts.card({
      title: "Dev Tasks Completed by Sprint",
      subtitle: taskSprintHistorySubtitle(),
      className: "task-chart-card task-sprint-chart-card",
      body: VisualCharts.columnChart(rows, [
        { key: "total", label: "Dev Tasks", color: "var(--chart-1)" },
        { key: "completed", label: "Completed", color: "var(--color-success)" }
      ], {
        itemLabel: "Dev Task",
        axisLabel: "Number of Tasks"
      })
    });
  }

  function taskStatusHorizontalChartHtml(selectedSprint, sprintTasks) {
    const statusItems = getStatuses()
      .filter(status => !status.toLowerCase().includes("qa") && status.toLowerCase() !== "backlog")
      .map(status => {
        const tasks = sprintTasks.filter(task => task.status === status);
        return taskChartGroupedItem(status, tasks, statusColor(status), `${status}: ${tasks.length} Dev Task${tasks.length === 1 ? "" : "s"}`);
      })
      .filter(item => item.value > 0);

    return VisualCharts.card({
      title: "Sprint Dev Tasks by Status",
      subtitle: taskSprintFilterSubtitle(selectedSprint),
      className: "task-chart-card task-status-chart-card",
      body: VisualCharts.horizontalBarChart(
        statusItems,
        "No non-QA Dev Task statuses are available for the selected Sprint filter.",
        { axisLabel: "Number of Tasks" }
      )
    });
  }

  function taskDeveloperWorkloadChartHtml(selectedSprint, sprintTasks) {
    const rows = state.users.map(user => {
      const userTasks = sprintTasks.filter(task => (task.assigneeIds || []).map(String).includes(String(user.id)));
      const categories = devTaskWorkloadCategories()
        .map(category => {
          const tasks = userTasks.filter(task => devTaskWorkloadCategory(task) === category.label);
          return taskChartGroupedItem(category.label, tasks, category.color, `${user.nickname} ${category.label}: ${tasks.length} Dev Task${tasks.length === 1 ? "" : "s"}`);
        })
        .filter(item => item.value > 0);

      return {
        user,
        total: userTasks.length,
        categories
      };
    }).filter(row => row.total > 0);

    return VisualCharts.card({
      title: "Developer Workload Distribution",
      subtitle: taskSprintFilterSubtitle(selectedSprint),
      className: "task-chart-card task-workload-chart-card",
      body: developerWorkloadDistributionHtml(rows)
    });
  }

  function taskSprintFilterSubtitle(selectedSprint) {
    if (taskProjectId === 0 && taskSprintId === "all") return "All Projects and All Sprints";
    if (taskProjectId === 0 && taskSprintId === "current") return "All Projects - Current Sprint";

    const project = selectedSprint
      ? state.projects.find(item => item.id === selectedSprint.projectId)
      : state.projects.find(item => item.id === taskProjectId);
    const sprintLabel = taskSprintId === "all"
      ? "All Sprints"
      : taskChartSprintLabel(selectedSprint, project);

    return project ? `${project.code} - ${sprintLabel}` : sprintLabel;
  }

  function taskChartSprintLabel(sprint, project) {
    if (!sprint) return "No Sprint";
    if (!project?.code) return sprint.code;

    const prefix = `${project.code}-`;
    return sprint.code.toLowerCase().startsWith(prefix.toLowerCase())
      ? sprint.code.slice(prefix.length)
      : sprint.code;
  }

  function taskSprintHistorySubtitle() {
    if (taskProjectId === 0 && taskSprintId === "all") return "All Projects and All Sprints";

    const project = state.projects.find(item => item.id === taskProjectId);
    return project ? `${project.code} - All Sprints` : "All Sprints";
  }

  function developerWorkloadDistributionHtml(rows) {
    if (!rows.length) return `<div class="empty compact-empty">No assigned Dev Tasks were found for the selected Sprint filter.</div>`;

    const usedCategories = new Set(rows.flatMap(row => row.categories.map(item => item.label)));
    const legendItems = devTaskWorkloadCategories().filter(category => usedCategories.has(category.label));
    const avatarSize = developerWorkloadAvatarSize(rows.length);

    return `
      <div class="workload-chart" style="--workload-avatar-size:${avatarSize}px">
        ${rows.map(row => `
          <div class="workload-row">
            <div class="workload-person">
              <img class="avatar" src="${escapeAttr(row.user.avatarUrl || "/assets/avatar-default.svg")}" alt="">
              <span>${escapeHtml(row.user.nickname)}</span>
              <b>${row.total}</b>
            </div>
            <div class="workload-stack" aria-label="${escapeAttr(row.user.nickname)} workload">
              ${row.categories.map(item => {
                const width = Math.max(8, Math.round((item.value / row.total) * 100));
                const actionAttrs = VisualCharts.chartActionAttributes({ ...item, chartTitle: `${row.user.nickname} ${item.label}` });
                return `
                  <button type="button" class="workload-segment ${item.action ? "is-clickable" : ""}" style="--value:${width}%; --chart-color:${escapeAttr(item.color)}" ${actionAttrs} data-chart-tooltip="${escapeAttr(item.tooltip)}">
                    <span>${item.value}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </div>
      ${VisualCharts.legend(legendItems)}
    `;
  }

  function developerWorkloadAvatarSize(rowCount) {
    if (rowCount <= 2) return 44;
    if (rowCount <= 4) return 38;
    if (rowCount <= 6) return 32;
    if (rowCount <= 8) return 28;
    return 24;
  }

  function devTaskWorkloadCategories() {
    return [
      { label: "Todo", color: "var(--chart-1)" },
      { label: "In Progress", color: "var(--chart-7)" },
      { label: "Deployed", color: "var(--color-success)" }
    ];
  }

  function devTaskWorkloadCategory(task) {
    if (task.status === "Todo" || task.status === "Backlog") return "Todo";
    if ((task.status || "").startsWith("Deployed")) return "Deployed";
    return "In Progress";
  }

  function taskChartGroupedItem(label, tasks, color, tooltip) {
    const taskIds = tasks.map(task => task.id);
    const actionTarget = tasks.length === 1
      ? { action: "view-task", id: tasks[0].id }
      : tasks.length > 1
        ? { action: "chart-drill-tasks", ids: taskIds.join(","), chartTitle: label }
        : {};

    return {
      label,
      value: tasks.length,
      color,
      tooltip,
      taskIds,
      ...actionTarget
    };
  }

  function taskChartCurrentSprint() {
    return getCurrentSprint(taskProjectSprints());
  }

  function taskSelectedSprint(projectSprints = taskProjectSprints()) {
    if (taskSprintId === "all") return null;
    if (taskSprintId === "current") return getCurrentSprint(projectSprints);
    return projectSprints.find(sprint => sprint.id === Number(taskSprintId)) || getCurrentSprint(projectSprints);
  }

  function taskContextProjectId() {
    const selectedSprint = taskSelectedSprint();
    return !taskProjectId && selectedSprint ? selectedSprint.projectId : taskProjectId;
  }

  function taskContextSprintId() {
    const selectedSprint = taskSelectedSprint();
    return selectedSprint ? selectedSprint.id : "all";
  }

  function saveTaskFilters() {
    writeJsonPreference(preferenceKeys.taskFilters, taskFilters);
  }

  function deactivateTasks() {
    document.querySelectorAll("[data-task-filter-dialog]").forEach(dialog => {
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.remove();
      }
    });
    cancelTaskColumnDrag();
    taskTableMode.deactivate();
  }

  function workItemEditorTitle(item, newTitle) {
    if (!item?.id) return newTitle;
    return [item.code, item.title].filter(Boolean).join(" - ");
  }

  return {
    deactivate: deactivateTasks,
    edit: editTask,
    getContext: () => ({ projectId: taskContextProjectId(), sprintId: taskContextSprintId() }),
    handleAction,
    handleFilterChange,
    render: renderTasks,
    selectContext,
    useCustomSort() {
      taskFilters.sort = "custom";
      saveTaskFilters();
    }
  };
}
