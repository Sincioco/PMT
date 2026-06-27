import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { bugIconHtml, buttonContent, chartIconHtml, funnelIconHtml } from "../../components/buttons.js?v=20260621-bug-screen-parity";
import { VisualCharts } from "../../components/charts.js";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js?v=20260621-task-filter-layout";
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
} from "../../components/forms.js?v=20260627-user-card-checklist";
import { sectionHead } from "../../components/sections.js";
import {
  attachmentEditorFieldHtml,
  bindAssigneeList,
  createWorkItemTableMode,
  showTaskAudit,
  taskAuditPanelHtml,
  taskButtonsHtml,
  taskPercentField,
  uploadWorkItemAttachments
} from "../../components/work-items.js?v=20260627-user-card-checklist";
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
import { toDateInput } from "../../shared/dates.js?v=20260620-null-end-date";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import { canEditTask } from "../../shared/permissions.js";
import {
  projectById,
  projectCode,
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
  let bugVisualChartsVisible = readBooleanPreference(preferenceKeys.bugVisualChartsVisible, true);
  let bugEntryProjectId = readNumberPreference(preferenceKeys.bugEntryProject, 0);
  let bugEntrySprintId = readPreference(preferenceKeys.bugEntrySprint, "");
  let bugEntryEnvironment = readPreference(preferenceKeys.bugEntryEnvironment, "");
  const bugTableMode = createWorkItemTableMode({
    action: "toggle-bug-table-edit-mode",
    itemLabel: "Bug Tracking"
  });

  bugFilters.reporterIds = normalizeSavedArray(bugFilters.reporterIds, bugFilters.reporterId);
  bugFilters.assigneeIds = normalizeSavedArray(bugFilters.assigneeIds, bugFilters.assigneeId);
  const savedBugSprintId = bugFilters.sprintId && bugFilters.sprintId !== "0"
    ? String(bugFilters.sprintId)
    : "";
  bugFilters.sprintId = savedBugSprintId || (bugFilters.projectId ? "" : "all");

  function renderBugs() {
    const sprintFilterSprints = bugSprintFilterSprints();
    ensureBugSprintFilter(sprintFilterSprints);
    const allProjectBugs = state.tasks
      .filter(task => task.taskType === "Bug")
      .filter(bug => !bugFilters.projectId || bug.projectId === Number(bugFilters.projectId));
    const baseBugs = allProjectBugs
      .filter(bug => !bugFilters.sprintId || bugFilters.sprintId === "all" || bug.sprintId === Number(bugFilters.sprintId));
    const filteredBugs = filteredBugReports(baseBugs);
    const canShowCharts = allProjectBugs.length > 0;
    const showCharts = canShowCharts && bugVisualChartsVisible;
    const chartToggleLabel = showCharts ? "Hide Charts" : "Show Charts";

    app.innerHTML = `
      <section class="bugs-screen work-item-screen">
      ${sectionHead("Bug Tracking", `
        <button class="primary text-icon-button" type="button" data-action="new-bug" title="New Bug Report" aria-label="New Bug Report">${buttonContent(bugIconHtml(), "New Bug Report")}</button>
        ${bugTableMode.buttonHtml()}
        <button class="secondary text-icon-button" type="button" data-action="toggle-bug-visual-charts" title="${chartToggleLabel}" aria-label="${chartToggleLabel}" aria-pressed="${showCharts}" ${canShowCharts ? "" : "disabled"}>${buttonContent(chartIconHtml(), chartToggleLabel)}</button>
        <button class="secondary text-icon-button" type="button" data-action="open-bug-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
      `)}
      ${showCharts ? bugVisualTrackingChartsHtml(baseBugs, allProjectBugs) : ""}
      <div class="panel work-item-table-panel bugs-table-panel">
        <table class="table work-item-table bugs-table ${bugTableMode.active ? "is-edit-mode" : "is-read-mode"}">
          <colgroup>
            <col class="bugs-reporter-column">
            <col class="bugs-assignee-column">
            <col class="bugs-title-column">
            <col class="bugs-project-column">
            <col class="bugs-sprint-column">
            <col class="bugs-status-column">
            <col class="bugs-severity-column">
            <col class="bugs-priority-column">
            ${bugTableMode.active ? `<col class="bugs-action-column">` : ""}
          </colgroup>
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
              ${bugTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
            </tr>
          </thead>
          <tbody data-reorder-list="bugs">
            ${filteredBugs.map(bug => `
              <tr class="clickable-row" data-action="view-task" data-id="${bug.id}" data-task-id="${bug.id}" data-can-drag="${bugTableMode.active && canEditTask(bug) ? "true" : "false"}" draggable="false">
                <td>${taskRowAvatarsHtml(bug.reporters)}</td>
                <td>${taskRowAvatarsHtml(bug.assignees)}</td>
                <td class="work-item-title-cell">
                  <span class="work-item-code-line">
                    <strong class="work-item-code">${escapeHtml(bug.code)}</strong>
                  </span>
                  <span class="work-item-title">${escapeHtml(bug.title)}</span>
                </td>
                <td class="work-item-context-cell bug-project-cell">${escapeHtml(projectName(bug.projectId))}</td>
                <td class="work-item-context-cell">${escapeHtml(sprintName(bug.sprintId))}</td>
                <td class="work-item-context-cell">${escapeHtml(bug.status)}</td>
                <td><span class="pill severity-${escapeAttr(bug.severity)}">${escapeHtml(bug.severity || "")}</span></td>
                <td><span class="pill priority-${escapeAttr(bug.priority)}">${escapeHtml(bug.priority)}</span></td>
                ${bugTableMode.active ? `<td class="reveal-actions action-cell">${taskButtonsHtml(bug, { includeView: false, monochrome: true })}</td>` : ""}
              </tr>
            `).join("") || `<tr><td colspan="${bugTableMode.active ? 9 : 8}"><div class="empty">No bug reports match these filters.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      </section>
    `;
  }

  async function handleAction(action, id) {
    const bug = id ? taskById(id) : null;

    if (action === "new-bug") {
      editBug();
      return true;
    }
    if (action === "toggle-bug-table-edit-mode") {
      bugTableMode.toggle();
      renderBugs();
      return true;
    }
    if (action === "open-bug-filters" || action === "toggle-bug-filters") {
      openBugFiltersDialog();
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
    if (!applyBugFilterChange(target)) return false;

    renderBugs();
    return true;
  }

  function openBugFiltersDialog() {
    const existingDialog = document.querySelector("[data-bug-filter-dialog]");
    if (existingDialog) {
      if (!existingDialog.open) existingDialog.showModal?.();
      existingDialog.querySelector("[data-filter='bug-project']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog bug-filter-dialog";
    modal.dataset.bugFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Bug Tracking Filters</h2>
          <button type="button" class="icon-btn" data-close-bug-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body bug-filter-dialog-body" data-bug-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-bug-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderBugFiltersDialog(modal);
    document.body.appendChild(modal);
    modal.addEventListener("change", event => {
      const target = event.target;
      const filter = target?.dataset?.filter || "";
      if (!applyBugFilterChange(target)) return;

      renderBugs();
      if (filter === "bug-project") {
        renderBugFiltersDialog(modal);
        modal.querySelector("[data-filter='bug-project']")?.focus({ preventScroll: true });
      }
    });
    modal.addEventListener("click", event => {
      if (event.target.closest("[data-close-bug-filters]")) modal.close();
    });
    modal.addEventListener("close", () => modal.remove());
    modal.showModal();
    modal.querySelector("[data-filter='bug-project']")?.focus({ preventScroll: true });
  }

  function renderBugFiltersDialog(modal) {
    const body = modal.querySelector("[data-bug-filter-dialog-body]");
    if (body) body.innerHTML = bugFilterFieldsHtml();
  }

  function bugFilterFieldsHtml() {
    const sprintFilterSprints = bugSprintFilterSprints();

    return `
      <div class="bugs-filter-panel">
        <div class="task-filter-row bug-filter-row">
          ${bugFilterSelectHtml("Project", "bug-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), bugFilters.projectId || "", "All Projects")}
          ${bugSprintFilterHtml(sprintFilterSprints)}
          ${bugFilterSelectHtml("Status", "bug-status", getStatuses().map(value => ({ value, text: value })), bugFilters.status || "", "All Statuses")}
          ${bugFilterSelectHtml("Priority", "bug-priority", getPriorities().map(value => ({ value, text: value })), bugFilters.priority || "", "All Priorities")}
          ${bugFilterSelectHtml("Severity", "bug-severity", getSeverities().map(value => ({ value, text: value })), bugFilters.severity || "", "All Severities")}
          ${bugFilterSelectHtml("Environment", "bug-environment", getEnvironments().map(value => ({ value, text: value })), bugFilters.environment || "", "All Environments")}
        </div>
        <div class="filter-stack">
          ${filterCheckList("Reporter", "bug-reporter", state.users.map(user => ({
            value: user.id,
            text: user.nickname,
            avatarUrl: user.avatarUrl
          })), bugFilters.reporterIds)}
          ${filterCheckList("Assignee", "bug-assignee", state.users.map(user => ({
            value: user.id,
            text: user.nickname,
            avatarUrl: user.avatarUrl
          })), bugFilters.assigneeIds)}
        </div>
      </div>
    `;
  }

  function bugFilterSelectHtml(label, filterName, items, selectedValue, emptyText) {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <select data-filter="${filterName}">
          <option value="">${escapeHtml(emptyText)}</option>
          ${items.map(item => `<option value="${escapeAttr(item.value)}" ${String(item.value) === String(selectedValue) ? "selected" : ""}>${escapeHtml(item.text)}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function applyBugFilterChange(target) {
    const filter = target?.dataset?.filter;
    if (!filter?.startsWith("bug-")) return false;

    const key = filter.replace("bug-", "");
    if (key === "project") {
      bugFilters.projectId = target.value;
      bugFilters.sprintId = target.value
        ? defaultSprintId(state.sprints.filter(sprint => sprint.projectId === Number(target.value)))
        : "all";
    }
    if (key === "sprint") bugFilters.sprintId = target.value || "all";
    if (key === "status") bugFilters.status = target.value;
    if (key === "priority") bugFilters.priority = target.value;
    if (key === "severity") bugFilters.severity = target.value;
    if (key === "environment") bugFilters.environment = target.value;
    if (key === "reporter") bugFilters.reporterIds = checkedFilterValues("bug-reporter");
    if (key === "assignee") bugFilters.assigneeIds = checkedFilterValues("bug-assignee");

    writeJsonPreference(preferenceKeys.bugFilters, bugFilters);
    return true;
  }

  function editBug(bug = {}, options = {}) {
    const apiRoot = options.apiRoot || "/api/tasks";
    const taskContext = getTaskContext();
    const selectedFilterSprint = selectedBugSprint();
    const rememberedProjectId = state.projects.some(project => project.id === bugEntryProjectId)
      ? bugEntryProjectId
      : 0;
    const projectId = bug.projectId
      || rememberedProjectId
      || (currentView === "Bugs" && selectedFilterSprint ? selectedFilterSprint.projectId : 0)
      || (currentView === "Bugs" && bugFilters.projectId ? Number(bugFilters.projectId) : 0)
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
        : currentView === "Bugs" && selectedFilterSprint?.projectId === projectId
          ? selectedFilterSprint.id
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

    openEditor(workItemEditorTitle(bug, "New Bug Report"), `
      <div class="form-grid bug-editor-grid">
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
        <div class="bug-reporter-list">
          ${checkList("Reporters", "reporterIds", state.users, reporterIdsOrDefault(bug.reporterIds, currentUserId), item => item.nickname, { className: "scroll-check-list user-card-check-list", renderItem: userCardCheckListLabelHtml })}
        </div>
        <div class="bug-assignee-list" data-assignee-list></div>
        ${checkList("Dependencies", "dependencyTaskIds", sameProjectTasks, bug.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" })}
      </div>
    `, async root => {
      const status = value(root, "status");
      const savedProjectId = numberValue(root, "projectId");
      const savedSprintId = optionalNumberValue(root, "sprintId");
      const environment = value(root, "environment");
      const result = await saveJson(bug.id ? `${apiRoot}/${bug.id}` : apiRoot, bug.id ? "PUT" : "POST", {
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

      await uploadWorkItemAttachments(root, result.id, attachFile, `${apiRoot}/${result.id}/attachments`);
    }, "title", root => bindAssigneeList(root, bug.assigneeIds || [], bug.id ? "Assignees" : "Assignees (Optional)"));
  }

  function filteredBugReports(bugs) {
    return bugs
      .filter(bug => !bugFilters.status || bug.status === bugFilters.status)
      .filter(bug => !bugFilters.priority || bug.priority === bugFilters.priority)
      .filter(bug => !bugFilters.severity || bug.severity === bugFilters.severity)
      .filter(bug => !bugFilters.environment || bug.environment === bugFilters.environment)
      .filter(bug => !bugFilters.reporterIds.length || bug.reporterIds.map(String).some(id => bugFilters.reporterIds.includes(id)))
      .filter(bug => !bugFilters.assigneeIds.length || bug.assigneeIds.map(String).some(id => bugFilters.assigneeIds.includes(id)))
      .sort(taskOrderCompare);
  }

  function bugVisualTrackingChartsHtml(sprintFilterBugs, allProjectBugs) {
    const sprintRows = bugSprintChartRows(allProjectBugs);
    const charts = [
      bugSeverityPieChartHtml(sprintFilterBugs),
      bugTrendLineChartHtml(sprintRows),
      bugCurrentSprintPieChartHtml(sprintFilterBugs),
      bugReportedResolvedColumnChartHtml(sprintRows)
    ].filter(Boolean);

    return VisualCharts.panel("Bug Tracking Charts", charts, {
      className: "bugs-chart-panel",
      hideHeader: true
    });
  }

  function bugCurrentSprintPieChartHtml(filteredBugs) {
    const selectedSprint = selectedBugSprint();
    const resolvedBugs = filteredBugs.filter(isBugQaPassedOrLater);
    const openBugs = filteredBugs.filter(bug => !isBugQaPassedOrLater(bug));

    const items = [
      bugChartGroupedItem("Resolved", resolvedBugs, "var(--green)", `Resolved: ${resolvedBugs.length} bug report${resolvedBugs.length === 1 ? "" : "s"}`),
      bugChartGroupedItem("Still Open", openBugs, "var(--amber)", `Still Open: ${openBugs.length} bug report${openBugs.length === 1 ? "" : "s"}`)
    ].filter(item => item.value > 0);

    return VisualCharts.card({
      title: "Sprint Bug Mix",
      subtitle: bugChartContextSubtitle(selectedSprint),
      className: "bug-chart-card bug-pie-chart-card bug-mix-chart-card",
      body: VisualCharts.pieChart(items, `${filteredBugs.length} total`, "No bugs match the selected Sprint filter.", {
        donut: true,
        centerValue: String(filteredBugs.length),
        centerLabel: "Total"
      })
    });
  }

  function bugTrendLineChartHtml(sprintRows) {
    if (!sprintRows.length) return null;
    const newestSprintRows = newestBugSprintRows(sprintRows);

    return VisualCharts.card({
      title: "Bug Trend by Sprint",
      subtitle: bugSprintHistorySubtitle(),
      className: "bug-chart-card bug-trend-chart-card",
      body: VisualCharts.lineChart(newestSprintRows, [
        { key: "reported", label: "Reported", color: "var(--rose)" },
        { key: "resolved", label: "Resolved", color: "var(--green)" }
      ])
    });
  }

  function bugReportedResolvedColumnChartHtml(sprintRows) {
    if (!sprintRows.length) return null;
    const newestSprintRows = newestBugSprintRows(sprintRows);

    return VisualCharts.card({
      title: "Reported vs Resolved by Sprint",
      subtitle: bugSprintHistorySubtitle(),
      className: "bug-chart-card bug-sprint-chart-card",
      body: VisualCharts.columnChart(newestSprintRows, [
        { key: "reported", label: "Reported", color: "var(--rose)" },
        { key: "resolved", label: "Resolved", color: "var(--green)" },
        { key: "open", label: "Open", color: "var(--amber)" }
      ], {
        itemLabel: "bug report",
        axisLabel: "Number of Bugs"
      })
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
      subtitle: bugChartContextSubtitle(selectedBugSprint()),
      className: "bug-chart-card bug-pie-chart-card bug-severity-chart-card",
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

  function newestBugSprintRows(sprintRows) {
    return [...sprintRows].sort((a, b) => {
      if (!a.sprintId) return 1;
      if (!b.sprintId) return -1;
      const sprintA = sprintById(a.sprintId);
      const sprintB = sprintById(b.sprintId);
      const aTime = sprintA ? getItemStartDate(sprintA)?.getTime() || 0 : 0;
      const bTime = sprintB ? getItemStartDate(sprintB)?.getTime() || 0 : 0;
      return bTime - aTime || b.label.localeCompare(a.label);
    });
  }

  function bugSprintFilterSprints() {
    const projectId = Number(bugFilters.projectId || 0);
    return state.sprints.filter(sprint => !projectId || sprint.projectId === projectId);
  }

  function ensureBugSprintFilter(sprints) {
    if (bugFilters.sprintId === "all") return;
    if (sprints.some(sprint => sprint.id === Number(bugFilters.sprintId))) return;

    bugFilters.sprintId = bugFilters.projectId ? defaultSprintId(sprints) : "all";
    writeJsonPreference(preferenceKeys.bugFilters, bugFilters);
  }

  function defaultSprintId(sprints) {
    const currentOrLastSprint = getCurrentSprint(sprints);
    return currentOrLastSprint ? String(currentOrLastSprint.id) : "all";
  }

  function selectedBugSprint() {
    if (!bugFilters.sprintId || bugFilters.sprintId === "all") return null;
    return sprintById(Number(bugFilters.sprintId)) || null;
  }

  function bugSprintFilterHtml(sprints) {
    return `
      <label>
        <span>Sprint</span>
        <select data-filter="bug-sprint">
          <option value="all" ${bugFilters.sprintId === "all" ? "selected" : ""}>All Sprints</option>
          ${sprints.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === bugFilters.sprintId ? "selected" : ""}>${escapeHtml(bugSprintFilterLabel(sprint))}</option>`).join("")}
        </select>
      </label>
    `;
  }

  function bugSprintFilterLabel(sprint) {
    const sprintTitle = sprint.title ? ` - ${sprint.title}` : "";
    if (bugFilters.projectId) return `${sprint.code}${sprintTitle}`;

    const project = projectById(sprint.projectId);
    return project
      ? `${project.code} - ${bugChartSprintLabel(sprint, project)}${sprintTitle}`
      : `${projectCode(sprint.projectId)} - ${sprint.code}${sprintTitle}`;
  }

  function bugChartContextSubtitle(selectedSprint) {
    if (!bugFilters.projectId && bugFilters.sprintId === "all") return "All Projects and All Sprints";

    const project = selectedSprint
      ? projectById(selectedSprint.projectId)
      : projectById(Number(bugFilters.projectId || 0));
    const sprintLabel = bugFilters.sprintId === "all"
      ? "All Sprints"
      : bugChartSprintLabel(selectedSprint, project);

    return project ? `${project.code} - ${sprintLabel}` : sprintLabel;
  }

  function bugChartSprintLabel(sprint, project) {
    if (!sprint) return "No Sprint";
    if (!project?.code) return sprint.code;

    const prefix = `${project.code}-`;
    return sprint.code.toLowerCase().startsWith(prefix.toLowerCase())
      ? sprint.code.slice(prefix.length)
      : sprint.code;
  }

  function bugSprintHistorySubtitle() {
    if (!bugFilters.projectId && bugFilters.sprintId === "all") return "All Projects and All Sprints";

    const project = projectById(Number(bugFilters.projectId || 0));
    return project ? `${project.code} - All Sprints` : "All Sprints";
  }

  function sprintChartLabel(sprintId) {
    const sprint = sprintById(sprintId);
    if (!sprint) return "Unknown Sprint";
    const project = projectById(sprint.projectId);
    if (bugFilters.projectId || !project) return sprint.code;
    return `${project.code} - ${bugChartSprintLabel(sprint, project)}`;
  }

  function bugSeverityColor(severity) {
    const colors = {
      Trivial: "var(--chart-2)",
      Minor: "var(--chart-1)",
      Major: "var(--chart-4)",
      Critical: "var(--chart-5)"
    };
    return colors[severity] || "var(--chart-7)";
  }

  function workItemEditorTitle(item, newTitle) {
    if (!item?.id) return newTitle;
    return [item.code, item.title].filter(Boolean).join(" - ");
  }

  function deactivateBugs() {
    document.querySelectorAll("[data-bug-filter-dialog]").forEach(dialog => {
      if (dialog.open) {
        dialog.close();
      } else {
        dialog.remove();
      }
    });
    bugTableMode.deactivate();
  }

  return {
    deactivate: deactivateBugs,
    edit: editBug,
    handleAction,
    handleFilterChange,
    render: renderBugs
  };
}
