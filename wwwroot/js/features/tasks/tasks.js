import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { buttonContent, funnelIconHtml } from "../../components/buttons.js";
import { VisualCharts } from "../../components/charts.js?v=20260620-dev-task-charts";
import { checkedFilterValues, filterCheckList } from "../../components/filters.js";
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
  value
} from "../../components/forms.js";
import { progressHtml, statusColor } from "../../components/progress-and-status.js?v=20260620-ui-theme";
import { sectionHead } from "../../components/sections.js";
import {
  attachmentEditorFieldHtml,
  bindAssigneeList,
  bugFixIconHtml,
  createWorkItemTableMode,
  showTaskAudit,
  taskAuditPanelHtml,
  taskButtonsHtml,
  taskDragHandleHtml,
  taskPercentField,
  uploadWorkItemAttachments
} from "../../components/work-items.js?v=20260620-shared-table-edit-mode";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260620-task-entry-context";
import { currentView } from "../../core/router.js";
import { state } from "../../core/store.js";
import { toDateInput } from "../../shared/dates.js?v=20260620-null-end-date";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import { canEditTask } from "../../shared/permissions.js";
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
  dependencyCandidates,
  isTaskCompleted,
  percentForDevTaskSave,
  taskCreatedTime,
  taskDisplayPercent,
  taskOrderCompare,
  taskRowsWithSubTasks,
  validateLinkedBugCompletion
} from "../../shared/work-item-rules.js";

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
  saveJson
}) {
  let taskProjectId = readNumberPreference(preferenceKeys.taskProject, 0);
  let taskSprintId = readPreference(preferenceKeys.taskSprint, "");
  let taskEntryProjectId = readNumberPreference(preferenceKeys.taskEntryProject, 0);
  let taskEntrySprintId = readPreference(preferenceKeys.taskEntrySprint, "");
  let taskFilters = readJsonPreference(preferenceKeys.taskFilters, {});
  let taskFiltersVisible = readBooleanPreference(preferenceKeys.taskFiltersVisible, false);
  let taskVisualChartsVisible = readBooleanPreference(preferenceKeys.taskVisualChartsVisible, true);
  const taskTableMode = createWorkItemTableMode({
    action: "toggle-task-table-edit-mode",
    itemLabel: "Dev Tasks"
  });

  taskFilters.statuses = normalizeSavedArray(taskFilters.statuses);
  taskFilters.assigneeIds = normalizeSavedArray(taskFilters.assigneeIds);
  taskFilters.priorities = normalizeSavedArray(taskFilters.priorities);
  taskFilters.sort = taskFilters.sort || "custom";
  taskFilters.hideCompleted = Boolean(taskFilters.hideCompleted);

  function renderTasks() {
    ensureSelectedProject();

    const statuses = getStatuses();
    const priorities = getPriorities();
    const projectSprints = state.sprints.filter(sprint => sprint.projectId === taskProjectId);
    if (taskSprintId !== "all" && !projectSprints.some(sprint => sprint.id === Number(taskSprintId))) {
      taskSprintId = defaultSprintId(projectSprints);
      writePreference(preferenceKeys.taskSprint, taskSprintId);
    }

    const allProjectDevTasks = state.tasks
      .filter(task => task.projectId === taskProjectId)
      .filter(task => task.taskType !== "Bug");
    const baseTasks = allProjectDevTasks
      .filter(task => taskSprintId === "all" || task.sprintId === Number(taskSprintId));
    const visibleTasks = filteredTaskList(baseTasks);
    const taskRows = taskRowsWithSubTasks(visibleTasks);
    const canShowCharts = allProjectDevTasks.length > 0;
    const showCharts = canShowCharts && taskVisualChartsVisible;
    const filterToggleLabel = taskFiltersVisible ? "Hide Filters" : "Show Filters";
    const chartToggleLabel = showCharts ? "Hide Charts" : "Show Charts";

    app.innerHTML = `
      <section class="tasks-screen work-item-screen">
      ${sectionHead("Dev Tasks", `
        ${taskTableMode.buttonHtml()}
        <button class="secondary text-icon-button ${taskFiltersVisible ? "is-on" : ""}" type="button" data-action="toggle-task-filters" aria-pressed="${taskFiltersVisible}">${buttonContent(funnelIconHtml(), filterToggleLabel)}</button>
        <button class="secondary text-icon-button ${showCharts ? "is-on" : ""}" type="button" data-action="toggle-task-visual-charts" aria-pressed="${showCharts}" ${canShowCharts ? "" : "disabled"}>${buttonContent("&#128202;", chartToggleLabel)}</button>
        <button class="primary text-icon-button" type="button" data-action="new-task">${buttonContent("&#10010;", "New Dev Task")}</button>
      `)}
      ${taskFiltersVisible ? `<div class="panel work-item-filter-panel tasks-filter-panel">
        <div class="task-filter-row">
          <label>
            <span>Project</span>
            <select data-filter="task-project">
              ${state.projects.map(project => `<option value="${project.id}" ${project.id === taskProjectId ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sprint</span>
            <select data-filter="task-sprint">
              <option value="all" ${taskSprintId === "all" ? "selected" : ""}>All Sprints</option>
              ${projectSprints.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === taskSprintId ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="task-sort">
              <option value="custom" ${taskFilters.sort === "custom" ? "selected" : ""}>Custom order</option>
              <option value="newest" ${taskFilters.sort === "newest" ? "selected" : ""}>Newest Dev Tasks</option>
              <option value="oldest" ${taskFilters.sort === "oldest" ? "selected" : ""}>Oldest Dev Tasks</option>
              <option value="highest-complete" ${taskFilters.sort === "highest-complete" ? "selected" : ""}>Highest Completed</option>
              <option value="lowest-complete" ${taskFilters.sort === "lowest-complete" ? "selected" : ""}>Lowest Completed</option>
            </select>
          </label>
          <label class="inline-filter-check">
            <input type="checkbox" data-filter="task-hide-completed" ${taskFilters.hideCompleted ? "checked" : ""}>
            <span>Hide Completed Dev Tasks</span>
          </label>
        </div>
        <div class="filter-stack">
          ${filterCheckList("Status", "task-status", statuses.map(value => ({ value, text: value })), taskFilters.statuses)}
          ${filterCheckList("Priority", "task-priority", priorities.map(value => ({ value, text: value })), taskFilters.priorities)}
          ${filterCheckList("Assigned", "task-assigned", state.users.map(user => ({ value: user.id, text: user.nickname })), taskFilters.assigneeIds)}
        </div>
      </div>` : ""}
      ${showCharts ? taskVisualTrackingChartsHtml(allProjectDevTasks) : ""}
      <div class="panel work-item-table-panel tasks-table-panel">
        <table class="table work-item-table tasks-table ${taskTableMode.active ? "is-edit-mode" : "is-read-mode"}">
          <colgroup>
            <col class="tasks-assigned-column">
            <col class="tasks-title-column">
            <col class="tasks-project-column">
            <col class="tasks-sprint-column">
            <col class="tasks-status-column">
            <col class="tasks-priority-column">
            <col class="tasks-complete-column">
            ${taskTableMode.active ? `<col class="tasks-action-column">` : ""}
          </colgroup>
          <thead>
            <tr>
              <th>Assigned</th>
              <th>Tasks</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Priority</th>
              <th class="done-cell">% Complete</th>
              ${taskTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
            </tr>
          </thead>
          <tbody data-reorder-list="tasks">
            ${taskRows.map(row => {
              const task = row.task;
              const rowClass = row.level ? "subtask-row" : "";
              const titleClass = row.level ? "task-title-cell subtask-title-cell" : "task-title-cell";
              const indent = Math.min(row.level, 4) * 20;

              return `
              <tr class="${rowClass} clickable-row" data-action="view-task" data-id="${task.id}" data-task-id="${task.id}" data-can-drag="${taskTableMode.active && canEditTask(task) ? "true" : "false"}" draggable="false">
                <td>${taskRowAvatarsHtml(task.assignees)}</td>
                <td class="${titleClass} work-item-title-cell" style="--indent:${indent}px">
                  ${row.level ? `<span class="subtask-pill">Sub-task</span>` : ""}
                  <strong class="work-item-code">${escapeHtml(task.code)}</strong>
                  <span class="work-item-title">${bugFixIconHtml(task)}${escapeHtml(task.title)}</span>
                </td>
                <td class="work-item-context-cell">${escapeHtml(projectName(task.projectId))}</td>
                <td class="work-item-context-cell">${escapeHtml(sprintName(task.sprintId))}</td>
                <td class="work-item-context-cell">${escapeHtml(task.status)}</td>
                <td><span class="pill priority-${task.priority}">${escapeHtml(task.priority)}</span></td>
                <td class="done-cell">${progressHtml(taskDisplayPercent(task))}</td>
                ${taskTableMode.active ? `<td class="reveal-actions action-cell">${taskButtonsHtml(task, { includeView: false })}${taskDragHandleHtml(task)}</td>` : ""}
              </tr>
            `;
            }).join("") || `<tr><td colspan="${taskTableMode.active ? 8 : 7}"><div class="empty">No tasks for this filter.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      </section>
    `;
  }

  async function handleAction(action, id) {
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
    if (action === "toggle-task-filters") {
      taskFiltersVisible = !taskFiltersVisible;
      writePreference(preferenceKeys.taskFiltersVisible, taskFiltersVisible);
      renderTasks();
      return true;
    }
    if (action === "toggle-task-visual-charts") {
      taskVisualChartsVisible = !taskVisualChartsVisible;
      writePreference(preferenceKeys.taskVisualChartsVisible, taskVisualChartsVisible);
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
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("task-")) return false;

    if (filter === "task-project") {
      taskProjectId = Number(target.value);
      taskSprintId = defaultSprintId(state.sprints.filter(sprint => sprint.projectId === taskProjectId));
      writePreference(preferenceKeys.taskProject, taskProjectId);
      writePreference(preferenceKeys.taskSprint, taskSprintId);
    }
    if (filter === "task-sprint") {
      taskSprintId = target.value;
      writePreference(preferenceKeys.taskSprint, taskSprintId);
    }
    if (filter === "task-sort") taskFilters.sort = target.value;
    if (filter === "task-hide-completed") taskFilters.hideCompleted = target.checked;
    if (filter === "task-status") taskFilters.statuses = checkedFilterValues("task-status");
    if (filter === "task-priority") taskFilters.priorities = checkedFilterValues("task-priority");
    if (filter === "task-assigned") taskFilters.assigneeIds = checkedFilterValues("task-assigned");

    if (filter !== "task-project" && filter !== "task-sprint") saveTaskFilters();
    renderTasks();
    return true;
  }

  function editTask(task = {}) {
    const rememberedProjectId = state.projects.some(project => project.id === taskEntryProjectId)
      ? taskEntryProjectId
      : 0;
    const projectId = task.projectId
      || rememberedProjectId
      || (currentView === "Tasks" ? taskProjectId : getBoardProjectId())
      || state.projects[0]?.id;
    const rememberedSprintId = state.sprints.some(sprint =>
      sprint.id === Number(taskEntrySprintId)
      && sprint.projectId === projectId
    )
      ? Number(taskEntrySprintId)
      : "";
    const defaultSprintId = task.sprintId ?? (
      rememberedProjectId
        ? rememberedSprintId
        : currentView === "Board"
          ? getBoardSprintId(projectId)
          : currentView === "Tasks" && taskSprintId !== "all"
            ? Number(taskSprintId)
            : ""
    );
    const sameProjectTasks = dependencyCandidates(projectId, task.id);
    const taskHasSubTasks = Boolean(task.subTasks?.length);

    openEditor(workItemEditorTitle(task, "Dev Task", "New Dev Task"), `
      <div class="form-grid">
        ${task.id ? taskAuditPanelHtml(task) : ""}
        ${selectField("Project", "projectId", state.projects, projectId)}
        ${field("Title", "title", task.title || "", "text")}
        ${selectOptionsField("Sprint", "sprintId", [{ id: "", title: "No Sprint" }, ...state.sprints.filter(sprint => sprint.projectId === projectId).map(sprint => ({ id: sprint.id, title: sprint.code }))], defaultSprintId || "")}
        ${selectOptionsField("Parent Task", "parentTaskId", [{ id: "", title: "No parent" }, ...sameProjectTasks.map(item => ({ id: item.id, title: `${item.code} - ${item.title}` }))], task.parentTaskId || "")}
        ${selectTextField("Status", "status", getLookupOptions("Status", task.status || "Todo"), task.status || "Todo")}
        ${selectTextField("Priority", "priority", getLookupOptions("Priority", task.priority || "Low"), task.priority || "Low")}
        ${taskPercentField(task, taskHasSubTasks)}
        ${field("Start", "startDate", toDateInput(task.startDate), "date")}
        ${field("End", "endDate", toDateInput(task.endDate), "date")}
        ${field("URL", "url", task.url || "", "url")}
        ${richTextField("descriptionHtml", "Description", task.descriptionHtml || "")}
        ${attachmentEditorFieldHtml()}
        <div data-assignee-list></div>
        ${checkList("Dependencies", "dependencyTaskIds", sameProjectTasks, task.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" })}
      </div>
    `, async root => {
      const projectId = numberValue(root, "projectId");
      const title = value(root, "title");
      const assigneeIds = checkedNumbers(root, "assigneeIds");

      if (!title.trim()) {
        focusTaskField(root, "title");
        throw new Error("Dev Task title is required.");
      }

      const status = value(root, "status");
      const percentCompleted = percentForDevTaskSave(status, numberValue(root, "percentCompleted"));
      const sprintId = optionalNumberValue(root, "sprintId");
      const dependencyTaskIds = checkedNumbers(root, "dependencyTaskIds");
      validateLinkedBugCompletion(task, percentCompleted, dependencyTaskIds);

      const result = await saveJson(task.id ? `/api/tasks/${task.id}` : "/api/tasks", task.id ? "PUT" : "POST", {
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

      await uploadWorkItemAttachments(root, result.id, attachFile);
    }, "title", root => bindAssigneeList(root, task.assigneeIds || [], "Assignees (Optional)"));
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
    if (!taskProjectId && state.projects.length) taskProjectId = state.projects[0].id;
    if (!state.projects.some(project => project.id === taskProjectId) && state.projects.length) {
      taskProjectId = state.projects[0].id;
    }
  }

  function defaultSprintId(projectSprints) {
    const currentOrLastSprint = getCurrentSprint(projectSprints);
    return currentOrLastSprint ? String(currentOrLastSprint.id) : "all";
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
      .sort(taskSortCompare);
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

    if (selectedStatuses.length && !selectedStatuses.includes(task.status)) return false;
    if (selectedPriorities.length && !selectedPriorities.includes(task.priority)) return false;
    if (selectedAssignees.length && !taskAssignees.some(id => selectedAssignees.includes(id))) return false;

    return true;
  }

  function taskSortCompare(a, b) {
    if (taskFilters.sort === "custom") return taskOrderCompare(a, b);
    if (taskFilters.sort === "oldest") return taskCreatedTime(a) - taskCreatedTime(b) || a.id - b.id;
    if (taskFilters.sort === "highest-complete") return taskDisplayPercent(b) - taskDisplayPercent(a) || taskCreatedTime(b) - taskCreatedTime(a);
    if (taskFilters.sort === "lowest-complete") return taskDisplayPercent(a) - taskDisplayPercent(b) || taskCreatedTime(b) - taskCreatedTime(a);
    return taskCreatedTime(b) - taskCreatedTime(a) || b.id - a.id;
  }

  function taskVisualTrackingChartsHtml(devTasks) {
    const currentSprint = taskChartCurrentSprint();
    const currentTasks = currentSprint
      ? devTasks.filter(task => task.sprintId === currentSprint.id)
      : [];
    const selectedSprint = taskSelectedSprint();
    const sprintFilterTasks = selectedSprint
      ? devTasks.filter(task => task.sprintId === selectedSprint.id)
      : devTasks;
    const charts = [
      taskDeveloperWorkloadChartHtml(selectedSprint, sprintFilterTasks),
      taskStatusHorizontalChartHtml(selectedSprint, sprintFilterTasks),
      taskCurrentSprintPieChartHtml(currentSprint, currentTasks),
      taskPastSixSprintsColumnChartHtml(devTasks, currentSprint)
    ].filter(Boolean);

    return VisualCharts.panel("Dev Task Tracking Charts", charts, {
      className: "tasks-chart-panel",
      hideHeader: true
    });
  }

  function taskCurrentSprintPieChartHtml(currentSprint, currentTasks) {
    if (!currentSprint) {
      return VisualCharts.card({
        title: "Current Sprint Dev Task Mix",
        subtitle: "No current Sprint is available for the selected project.",
        className: "task-chart-card task-mix-chart-card",
        body: `<div class="empty compact-empty">No current Sprint was found.</div>`
      });
    }

    const completedTasks = currentTasks.filter(isTaskCompleted);
    const openTasks = currentTasks.filter(task => !isTaskCompleted(task));
    const items = [
      taskChartGroupedItem("Completed", completedTasks, "var(--color-success)", `Completed: ${completedTasks.length} Dev Task${completedTasks.length === 1 ? "" : "s"}`),
      taskChartGroupedItem("Still Open", openTasks, "var(--color-warning)", `Still Open: ${openTasks.length} Dev Task${openTasks.length === 1 ? "" : "s"}`)
    ].filter(item => item.value > 0);
    const completedPercent = currentTasks.length
      ? Math.round((completedTasks.length / currentTasks.length) * 100)
      : 0;
    const openPercent = currentTasks.length
      ? Math.round((openTasks.length / currentTasks.length) * 100)
      : 0;

    return VisualCharts.card({
      title: "Current Sprint Dev Task Mix",
      subtitle: currentSprint.code,
      className: "task-chart-card task-mix-chart-card",
      body: `
        ${VisualCharts.pieChart(items, `${currentTasks.length} total`, "No Dev Tasks match the current Sprint filter.", {
          donut: true,
          centerValue: String(currentTasks.length),
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

    const projectSprints = state.sprints
      .filter(sprint => sprint.projectId === taskProjectId)
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
      subtitle: "All Sprints, latest first.",
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
      subtitle: selectedSprint ? selectedSprint.code : "All Sprints",
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
      subtitle: selectedSprint ? selectedSprint.code : "All Sprints",
      className: "task-chart-card task-workload-chart-card",
      body: developerWorkloadDistributionHtml(rows)
    });
  }

  function developerWorkloadDistributionHtml(rows) {
    if (!rows.length) return `<div class="empty compact-empty">No assigned Dev Tasks were found for the selected Sprint filter.</div>`;

    const usedCategories = new Set(rows.flatMap(row => row.categories.map(item => item.label)));
    const legendItems = devTaskWorkloadCategories().filter(category => usedCategories.has(category.label));

    return `
      <div class="workload-chart">
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
                  <button type="button" class="workload-segment ${item.action ? "is-clickable" : ""}" style="--value:${width}%; --chart-color:${escapeAttr(item.color)}" ${actionAttrs} data-chart-tooltip="${escapeAttr(item.tooltip)}" title="${escapeAttr(item.tooltip)}">
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
    return getCurrentSprint(state.sprints.filter(sprint => sprint.projectId === taskProjectId));
  }

  function taskSelectedSprint() {
    if (taskSprintId === "all") return null;
    return state.sprints.find(sprint => sprint.id === Number(taskSprintId)) || null;
  }

  function saveTaskFilters() {
    writeJsonPreference(preferenceKeys.taskFilters, taskFilters);
  }

  function deactivateTasks() {
    taskTableMode.deactivate();
  }

  function workItemEditorTitle(item, itemType, newTitle) {
    if (!item?.id) return newTitle;
    const code = item.code ? ` ${item.code}` : "";
    const title = item.title ? `: ${item.title}` : "";
    return `${itemType}${code}${title}`;
  }

  return {
    deactivate: deactivateTasks,
    edit: editTask,
    getContext: () => ({ projectId: taskProjectId, sprintId: taskSprintId }),
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
