import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { buttonContent, funnelIconHtml } from "../../components/buttons.js";
import { VisualCharts } from "../../components/charts.js";
import {
  checkedFilterValues,
  filterCheckList,
  filterSelect
} from "../../components/filters.js";
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
  userCheckListLabelHtml,
  value
} from "../../components/forms.js?v=20260620-member-roles";
import { sectionHead } from "../../components/sections.js";
import {
  attachmentEditorFieldHtml,
  bindAssigneeList,
  showTaskAudit,
  taskAuditPanelHtml,
  taskButtonsHtml,
  taskDragHandleHtml,
  taskPercentField,
  uploadWorkItemAttachments
} from "../../components/work-items.js?v=20260620-bug-linked-task";
import { currentUserId } from "../../core/authentication.js";
import {
  preferenceKeys,
  readBooleanPreference,
  readJsonPreference,
  readNumberPreference,
  readPreference,
  writeJsonPreference,
  writePreference
} from "../../core/preferences.js?v=20260620-bug-entry-context";
import { currentView } from "../../core/router.js";
import { state } from "../../core/store.js";
import { toDateInput } from "../../shared/dates.js";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import { canEditTask } from "../../shared/permissions.js";
import {
  projectById,
  projectName,
  sprintById,
  sprintName,
  taskById
} from "../../shared/selectors.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import {
  dependencyCandidates,
  isBugQaPassedOrLater,
  percentForStatus,
  reporterIdsOrDefault,
  taskOrderCompare
} from "../../shared/work-item-rules.js";

export function createBugsFeature({
  app,
  attachFile,
  deleteItem,
  duplicateTask,
  getBoardProjectId,
  getBoardSprintId,
  getCurrentSprint,
  getEnvironments,
  getItemStartDate,
  getLookupOptions,
  getPriorities,
  getSeverities,
  getStatuses,
  getTaskContext,
  openEditor,
  saveJson
}) {
  let bugFilters = readJsonPreference(preferenceKeys.bugFilters, {});
  let bugFiltersVisible = readBooleanPreference(preferenceKeys.bugFiltersVisible, false);
  let bugVisualChartsVisible = readBooleanPreference(preferenceKeys.bugVisualChartsVisible, true);
  let bugEntryProjectId = readNumberPreference(preferenceKeys.bugEntryProject, 0);
  let bugEntrySprintId = readPreference(preferenceKeys.bugEntrySprint, "");
  let bugEntryEnvironment = readPreference(preferenceKeys.bugEntryEnvironment, "");

  bugFilters.reporterIds = normalizeSavedArray(bugFilters.reporterIds, bugFilters.reporterId);
  bugFilters.assigneeIds = normalizeSavedArray(bugFilters.assigneeIds, bugFilters.assigneeId);

  function renderBugs() {
    const statuses = getStatuses();
    const priorities = getPriorities();
    const severities = getSeverities();
    const environments = getEnvironments();
    const filteredBugs = filteredBugReports();
    const canShowCharts = filteredBugs.length > 0;
    const showCharts = canShowCharts && bugVisualChartsVisible;
    const filterToggleLabel = bugFiltersVisible ? "Hide Filters" : "Show Filters";
    const chartToggleLabel = showCharts ? "Hide Charts" : "Show Charts";

    app.innerHTML = `
      ${sectionHead("Bug Tracking", `
        <button class="secondary text-icon-button ${bugFiltersVisible ? "is-on" : ""}" type="button" data-action="toggle-bug-filters" aria-pressed="${bugFiltersVisible}">${buttonContent(funnelIconHtml(), filterToggleLabel)}</button>
        <button class="secondary text-icon-button ${showCharts ? "is-on" : ""}" type="button" data-action="toggle-bug-visual-charts" aria-pressed="${showCharts}" ${canShowCharts ? "" : "disabled"}>${buttonContent("&#128202;", chartToggleLabel)}</button>
        <button class="primary text-icon-button" type="button" data-action="new-bug">${buttonContent("&#9888;", "New Bug Report")}</button>
      `)}
      ${bugFiltersVisible ? `<div class="panel work-item-filter-panel bugs-filter-panel">
        <div class="filter-row bug-filter-row">
          ${filterSelect("Project", "bug-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), bugFilters.projectId || "", "All projects")}
          ${filterSelect("Status", "bug-status", statuses.map(value => ({ value, text: value })), bugFilters.status || "", "All statuses")}
          ${filterSelect("Priority", "bug-priority", priorities.map(value => ({ value, text: value })), bugFilters.priority || "", "All priorities")}
          ${filterSelect("Severity", "bug-severity", severities.map(value => ({ value, text: value })), bugFilters.severity || "", "All severities")}
          ${filterSelect("Environment", "bug-environment", environments.map(value => ({ value, text: value })), bugFilters.environment || "", "All environments")}
        </div>
        <div class="filter-stack">
          ${filterCheckList("Reporter", "bug-reporter", state.users.map(user => ({ value: user.id, text: user.nickname })), bugFilters.reporterIds)}
          ${filterCheckList("Assignee", "bug-assignee", state.users.map(user => ({ value: user.id, text: user.nickname })), bugFilters.assigneeIds)}
        </div>
      </div>` : ""}
      ${showCharts ? bugVisualTrackingChartsHtml(filteredBugs) : ""}
      <div class="panel work-item-table-panel bugs-table-panel">
        <table class="table work-item-table bugs-table">
          <thead>
            <tr>
              <th>Reporter</th>
              <th>Assignee</th>
              <th>Bug Report</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Priority</th>
              <th></th>
            </tr>
          </thead>
          <tbody data-reorder-list="bugs">
            ${filteredBugs.map(bug => `
              <tr class="clickable-row" data-action="view-task" data-id="${bug.id}" data-task-id="${bug.id}" data-can-drag="${canEditTask(bug) ? "true" : "false"}" draggable="false">
                <td>${taskRowAvatarsHtml(bug.reporters)}</td>
                <td>${taskRowAvatarsHtml(bug.assignees)}</td>
                <td class="work-item-title-cell">
                  <strong class="work-item-code">${escapeHtml(bug.code)}</strong>
                  <span class="work-item-title">${escapeHtml(bug.title)}</span>
                </td>
                <td>${escapeHtml(projectName(bug.projectId))}</td>
                <td>${escapeHtml(sprintName(bug.sprintId))}</td>
                <td>${escapeHtml(bug.status)}</td>
                <td><span class="pill severity-${escapeAttr(bug.severity)}">${escapeHtml(bug.severity || "")}</span></td>
                <td><span class="pill priority-${escapeAttr(bug.priority)}">${escapeHtml(bug.priority)}</span></td>
                <td class="action-cell">${taskButtonsHtml(bug)}${taskDragHandleHtml(bug)}</td>
              </tr>
            `).join("") || `<tr><td colspan="9"><div class="empty">No bug reports match these filters.</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  async function handleAction(action, id) {
    const bug = id ? taskById(id) : null;

    if (action === "new-bug") {
      editBug();
      return true;
    }
    if (action === "toggle-bug-filters") {
      bugFiltersVisible = !bugFiltersVisible;
      writePreference(preferenceKeys.bugFiltersVisible, bugFiltersVisible);
      renderBugs();
      return true;
    }
    if (action === "toggle-bug-visual-charts") {
      bugVisualChartsVisible = !bugVisualChartsVisible;
      writePreference(preferenceKeys.bugVisualChartsVisible, bugVisualChartsVisible);
      renderBugs();
      return true;
    }
    if (action === "edit-task" && bug?.taskType === "Bug") {
      editBug(bug);
      return true;
    }
    if (action === "show-task-audit" && bug?.taskType === "Bug") {
      showTaskAudit(id);
      return true;
    }
    if (action === "duplicate-task" && bug?.taskType === "Bug") {
      await duplicateTask(id);
      return true;
    }
    if (action === "delete-task" && bug?.taskType === "Bug") {
      await deleteItem(`/api/tasks/${id}`, "Delete this task?");
      return true;
    }

    return false;
  }

  function handleFilterChange(eventOrTarget) {
    const target = eventOrTarget?.target || eventOrTarget;
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("bug-")) return false;

    const key = filter.replace("bug-", "");
    if (key === "project") bugFilters.projectId = target.value;
    if (key === "status") bugFilters.status = target.value;
    if (key === "priority") bugFilters.priority = target.value;
    if (key === "severity") bugFilters.severity = target.value;
    if (key === "environment") bugFilters.environment = target.value;
    if (key === "reporter") bugFilters.reporterIds = checkedFilterValues("bug-reporter");
    if (key === "assignee") bugFilters.assigneeIds = checkedFilterValues("bug-assignee");

    writeJsonPreference(preferenceKeys.bugFilters, bugFilters);
    renderBugs();
    return true;
  }

  function editBug(bug = {}) {
    const taskContext = getTaskContext();
    const rememberedProjectId = state.projects.some(project => project.id === bugEntryProjectId)
      ? bugEntryProjectId
      : 0;
    const projectId = bug.projectId
      || rememberedProjectId
      || taskContext.projectId
      || getBoardProjectId()
      || state.projects[0]?.id;
    const rememberedSprintId = state.sprints.some(sprint =>
      sprint.id === Number(bugEntrySprintId)
      && sprint.projectId === projectId
    )
      ? Number(bugEntrySprintId)
      : "";
    const defaultSprintId = bug.sprintId ?? (
      rememberedProjectId
        ? rememberedSprintId
        : currentView === "Backlog"
          ? ""
          : taskContext.sprintId !== "all"
            ? Number(taskContext.sprintId)
            : getBoardSprintId(projectId) || ""
    );
    const environments = getLookupOptions("Environment", bug.environment || bugEntryEnvironment || "SIT");
    const defaultEnvironment = bug.environment
      || (environments.includes(bugEntryEnvironment) ? bugEntryEnvironment : "SIT");
    const sameProjectTasks = dependencyCandidates(projectId, bug.id);

    openEditor(workItemEditorTitle(bug, "Bug", "New Bug Report"), `
      <div class="form-grid">
        ${bug.id ? taskAuditPanelHtml(bug) : ""}
        ${selectField("Project", "projectId", state.projects, projectId)}
        ${field("Title", "title", bug.title || "", "text")}
        ${selectOptionsField("Sprint", "sprintId", [{ id: "", title: "No Sprint" }, ...state.sprints.filter(sprint => sprint.projectId === projectId).map(sprint => ({ id: sprint.id, title: sprint.code }))], defaultSprintId || "")}
        ${selectTextField("Status", "status", getLookupOptions("Status", bug.status || "Todo"), bug.status || "Todo")}
        ${selectTextField("Environment", "environment", environments, defaultEnvironment)}
        ${selectTextField("Severity", "severity", getLookupOptions("Severity", bug.severity || "Major"), bug.severity || "Major")}
        ${selectTextField("Priority", "priority", getLookupOptions("Priority", bug.priority || "Medium"), bug.priority || "Medium")}
        ${taskPercentField(bug, false)}
        ${field("Start", "startDate", toDateInput(bug.startDate), "date")}
        ${field("End", "endDate", toDateInput(bug.endDate), "date")}
        ${field("URL", "url", bug.url || "", "url")}
        ${richTextField("descriptionHtml", "Description", bug.descriptionHtml || "")}
        ${richTextField("stepsToReproduceHtml", "Steps to Reproduce", bug.stepsToReproduceHtml || "")}
        ${richTextField("actualResultHtml", "Actual Result", bug.actualResultHtml || "")}
        ${richTextField("expectedResultHtml", "Expected Result", bug.expectedResultHtml || "")}
        ${attachmentEditorFieldHtml()}
        ${checkList("Reporters", "reporterIds", state.users, reporterIdsOrDefault(bug.reporterIds, currentUserId), item => item.nickname, { className: "scroll-check-list avatar-check-list", renderItem: userCheckListLabelHtml })}
        <div data-assignee-list></div>
        ${checkList("Dependencies", "dependencyTaskIds", sameProjectTasks, bug.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" })}
      </div>
    `, async root => {
      const status = value(root, "status");
      const savedProjectId = numberValue(root, "projectId");
      const savedSprintId = optionalNumberValue(root, "sprintId");
      const environment = value(root, "environment");
      const result = await saveJson(bug.id ? `/api/tasks/${bug.id}` : "/api/tasks", bug.id ? "PUT" : "POST", {
        id: bug.id || 0,
        projectId: savedProjectId,
        sprintId: savedSprintId,
        parentTaskId: null,
        taskType: "Bug",
        title: value(root, "title"),
        descriptionHtml: richValue(root, "descriptionHtml"),
        stepsToReproduceHtml: richValue(root, "stepsToReproduceHtml"),
        actualResultHtml: richValue(root, "actualResultHtml"),
        expectedResultHtml: richValue(root, "expectedResultHtml"),
        environment,
        severity: value(root, "severity"),
        status,
        priority: value(root, "priority"),
        percentCompleted: percentForStatus(status, numberValue(root, "percentCompleted")),
        url: value(root, "url"),
        startDate: nullableDateValue(root, "startDate"),
        endDate: nullableDateValue(root, "endDate"),
        reporterIds: checkedNumbers(root, "reporterIds"),
        assigneeIds: checkedNumbers(root, "assigneeIds"),
        dependencyTaskIds: checkedNumbers(root, "dependencyTaskIds")
      });

      bugEntryProjectId = savedProjectId;
      bugEntrySprintId = savedSprintId ? String(savedSprintId) : "";
      bugEntryEnvironment = environment;
      writePreference(preferenceKeys.bugEntryProject, bugEntryProjectId);
      writePreference(preferenceKeys.bugEntrySprint, bugEntrySprintId);
      writePreference(preferenceKeys.bugEntryEnvironment, bugEntryEnvironment);

      await uploadWorkItemAttachments(root, result.id, attachFile);
    }, "title", root => bindAssigneeList(root, bug.assigneeIds || [], bug.id ? "Assignees" : "Assignees (Optional)"));
  }

  function filteredBugReports() {
    return state.tasks
      .filter(task => task.taskType === "Bug")
      .filter(bug => !bugFilters.projectId || bug.projectId === Number(bugFilters.projectId))
      .filter(bug => !bugFilters.status || bug.status === bugFilters.status)
      .filter(bug => !bugFilters.priority || bug.priority === bugFilters.priority)
      .filter(bug => !bugFilters.severity || bug.severity === bugFilters.severity)
      .filter(bug => !bugFilters.environment || bug.environment === bugFilters.environment)
      .filter(bug => !bugFilters.reporterIds.length || bug.reporterIds.map(String).some(id => bugFilters.reporterIds.includes(id)))
      .filter(bug => !bugFilters.assigneeIds.length || bug.assigneeIds.map(String).some(id => bugFilters.assigneeIds.includes(id)))
      .sort(taskOrderCompare);
  }

  function bugVisualTrackingChartsHtml(filteredBugs) {
    const sprintRows = bugSprintChartRows(filteredBugs);
    const charts = [
      bugTrendLineChartHtml(sprintRows),
      bugSeverityPieChartHtml(filteredBugs),
      bugReportedResolvedColumnChartHtml(sprintRows),
      bugCurrentSprintPieChartHtml(filteredBugs)
    ].filter(Boolean);

    return VisualCharts.panel("Bug Tracking Charts", charts);
  }

  function bugCurrentSprintPieChartHtml(filteredBugs) {
    const currentSprints = bugChartCurrentSprints();
    const currentSprintIds = new Set(currentSprints.map(sprint => sprint.id));
    const currentBugs = filteredBugs.filter(bug => currentSprintIds.has(bug.sprintId));
    const resolvedBugs = currentBugs.filter(isBugQaPassedOrLater);
    const openBugs = currentBugs.filter(bug => !isBugQaPassedOrLater(bug));

    if (!currentSprints.length) {
      return VisualCharts.card({
        title: "Current Sprint Bug Mix",
        subtitle: "No current Sprint is available for the selected project filter.",
        body: `<div class="empty compact-empty">No current Sprint was found.</div>`
      });
    }

    const items = [
      bugChartGroupedItem("Resolved", resolvedBugs, "var(--green)", `Resolved: ${resolvedBugs.length} bug report${resolvedBugs.length === 1 ? "" : "s"}`),
      bugChartGroupedItem("Still Open", openBugs, "var(--amber)", `Still Open: ${openBugs.length} bug report${openBugs.length === 1 ? "" : "s"}`)
    ].filter(item => item.value > 0);

    return VisualCharts.card({
      title: "Current Sprint Bug Mix",
      subtitle: currentSprints.map(sprint => sprint.code).join(", "),
      body: VisualCharts.pieChart(items, `${currentBugs.length} total`, "No bugs match the current Sprint filter.", { donut: true })
    });
  }

  function bugTrendLineChartHtml(sprintRows) {
    if (!sprintRows.length) return null;

    return VisualCharts.card({
      title: "Bug Trend by Sprint",
      subtitle: "Line graph compares reported versus resolved bugs over time.",
      body: VisualCharts.lineChart(sprintRows, [
        { key: "reported", label: "Reported", color: "var(--rose)" },
        { key: "resolved", label: "Resolved", color: "var(--green)" }
      ])
    });
  }

  function bugReportedResolvedColumnChartHtml(sprintRows) {
    if (!sprintRows.length) return null;

    return VisualCharts.card({
      title: "Reported vs Resolved by Sprint",
      subtitle: "Grouped column chart shows throughput per Sprint.",
      body: VisualCharts.columnChart(sprintRows, [
        { key: "reported", label: "Reported", color: "var(--rose)" },
        { key: "resolved", label: "Resolved", color: "var(--green)" },
        { key: "open", label: "Open", color: "var(--amber)" }
      ])
    });
  }

  function bugSeverityPieChartHtml(filteredBugs) {
    const items = getSeverities()
      .map(severity => {
        const bugs = filteredBugs.filter(bug => bug.severity === severity);
        return bugChartGroupedItem(severity, bugs, bugSeverityColor(severity), `${severity}: ${bugs.length} bug report${bugs.length === 1 ? "" : "s"}`);
      })
      .filter(item => item.value > 0);

    if (!items.length) return null;

    return VisualCharts.card({
      title: "Bug Severity Share",
      subtitle: "Pie chart shows the severity mix for the current filters.",
      body: VisualCharts.pieChart(items, `${filteredBugs.length} total`, "No severity data is available.", { donut: false })
    });
  }

  function bugChartGroupedItem(label, bugs, color, tooltip) {
    const bugIds = bugs.map(bug => bug.id);
    const actionTarget = bugs.length === 1
      ? { action: "view-task", id: bugs[0].id }
      : bugs.length > 1
        ? { action: "chart-drill-bugs", ids: bugIds.join(","), chartTitle: label }
        : {};
    return {
      label,
      value: bugs.length,
      color,
      tooltip,
      bugIds,
      ...actionTarget
    };
  }

  function bugSprintChartRows(filteredBugs) {
    const rows = new Map();

    filteredBugs.forEach(bug => {
      const sprintId = Number(bug.sprintId || 0);
      if (!rows.has(sprintId)) {
        rows.set(sprintId, {
          sprintId,
          label: sprintId ? sprintChartLabel(sprintId) : "No Sprint",
          reported: 0,
          resolved: 0,
          open: 0
        });
      }

      const row = rows.get(sprintId);
      row.reported += 1;
      if (isBugQaPassedOrLater(bug)) {
        row.resolved += 1;
      } else {
        row.open += 1;
      }
    });

    return [...rows.values()].sort((a, b) => {
      if (!a.sprintId) return 1;
      if (!b.sprintId) return -1;
      const sprintA = sprintById(a.sprintId);
      const sprintB = sprintById(b.sprintId);
      const aTime = sprintA ? getItemStartDate(sprintA)?.getTime() || 0 : 0;
      const bTime = sprintB ? getItemStartDate(sprintB)?.getTime() || 0 : 0;
      return aTime - bTime || a.label.localeCompare(b.label);
    });
  }

  function bugChartCurrentSprints() {
    const projectIds = bugFilters.projectId
      ? [Number(bugFilters.projectId)]
      : state.projects.map(project => project.id);

    return projectIds
      .map(projectId => getCurrentSprint(state.sprints.filter(sprint => sprint.projectId === projectId)))
      .filter(Boolean);
  }

  function sprintChartLabel(sprintId) {
    const sprint = sprintById(sprintId);
    if (!sprint) return "Unknown Sprint";
    const project = projectById(sprint.projectId);
    return project ? `${project.code} ${sprint.code}` : sprint.code;
  }

  function bugSeverityColor(severity) {
    const colors = {
      Trivial: "#76A9FF",
      Minor: "#35C7BD",
      Major: "#E4A53A",
      Critical: "#EE6B70"
    };
    return colors[severity] || "var(--teal)";
  }

  function workItemEditorTitle(item, itemType, newTitle) {
    if (!item?.id) return newTitle;
    const code = item.code ? ` ${item.code}` : "";
    const title = item.title ? `: ${item.title}` : "";
    return `${itemType}${code}${title}`;
  }

  return {
    edit: editBug,
    handleAction,
    handleFilterChange,
    render: renderBugs
  };
}
