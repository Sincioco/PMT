import { taskRowAvatarsHtml } from "../../components/avatars.js";
import { buttonContent, chartIconHtml, funnelIconHtml, pageActionsMenuHtml } from "../../components/buttons.js?v=20260701-unified-dropdowns";
import { VisualCharts } from "../../components/charts.js?v=20260628-chart-native-tooltips";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260707-filter-reset-dialogs";
import {
  checkedFilterValues,
  filterCheckList
} from "../../components/filters.js?v=20260630-filter-renderer";
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
import { progressHtml } from "../../components/progress-and-status.js?v=20260707-linked-bug-qa-sync";
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
} from "../../components/work-items.js?v=20260708-work-item-html-transfer";
import {
  currentUser,
  currentUserId
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
} from "../../core/preferences.js?v=20260630-bug-table-columns";
import { currentView } from "../../core/router.js?v=20260707-deep-links";
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
} from "../../shared/table-export.js?v=20260706-dialog-persistence";
import { canEditTask } from "../../shared/permissions.js";
import {
  projectById,
  projectCode,
  projectName,
  sprintById,
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
  isBugQaPassedOrLater,
  percentForStatus,
  reporterIdsOrDefault,
  taskDisplayPercent,
  taskCreatedTime,
  taskOrderCompare
} from "../../shared/work-item-rules.js?v=20260707-linked-bug-qa-sync";
import { openWorkItemHtmlImport } from "../../shared/work-item-transfer.js?v=20260708-work-item-html-transfer";

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
  refreshAfterImport,
  saveJson
}) {
  let bugFilters = normalizeBugFilters(readJsonPreference(preferenceKeys.bugFilters, {}));
  let bugVisualChartsVisible = readBooleanPreference(preferenceKeys.bugVisualChartsVisible, true);
  let bugEntryProjectId = readNumberPreference(preferenceKeys.bugEntryProject, 0);
  let bugEntrySprintId = readPreference(preferenceKeys.bugEntrySprint, "");
  let bugEntryEnvironment = readPreference(preferenceKeys.bugEntryEnvironment, "");
  let bugColumnPrefs = normalizeBugColumnPrefs(readJsonPreference(preferenceKeys.bugTableColumns, {}));
  let bugColumnDrag = null;
  let lastBugColumnPointerDragAt = 0;
  let suppressNextBugColumnClick = false;
  const bugTableMode = createWorkItemTableMode({
    action: "toggle-bug-table-edit-mode",
    itemLabel: "Bug Tracking"
  });

  bindBugColumnDragEvents();

  function renderBugs() {
    const sprintFilterSprints = bugSprintFilterSprints();
    ensureBugSprintFilter(sprintFilterSprints);
    const allProjectBugs = state.tasks
      .filter(task => task.taskType === "Bug")
      .filter(bug => !bugFilters.projectId || bug.projectId === Number(bugFilters.projectId));
    const baseBugs = allProjectBugs
      .filter(bug => !bugFilters.sprintId || bugFilters.sprintId === "all" || bug.sprintId === Number(bugFilters.sprintId));
    const filteredBugs = filteredBugReports(baseBugs);
    const assigneeColumnWidth = bugAvatarColumnWidth(filteredBugs, bug => bug.assignees);
    const reporterColumnWidth = bugAvatarColumnWidth(filteredBugs, bug => bug.reporters);
    const assigneeHeader = bugRowsHaveMultipleUsers(filteredBugs, bug => bug.assignees) ? "Assignee(s)" : "Assignee";
    const reporterHeader = bugRowsHaveMultipleUsers(filteredBugs, bug => bug.reporters) ? "Reporter(s)" : "Reporter";
    const visibleBugColumns = bugVisibleTableColumns({ reporterHeader, assigneeHeader });
    const emptyTableColspan = visibleBugColumns.length + (bugTableMode.active ? 1 : 0);
    const canShowCharts = allProjectBugs.length > 0;
    const showCharts = canShowCharts && bugVisualChartsVisible;
    const chartToggleLabel = showCharts ? "Hide Charts" : "Show Charts";

    app.innerHTML = `
      <section class="bugs-screen work-item-screen">
      ${sectionHead("Bug Tracking", `
        <button class="primary text-icon-button" type="button" data-action="new-bug" title="New Bug Report" aria-label="New Bug Report">${buttonContent("&#10010;", "New Bug Report")}</button>
        <button class="secondary text-icon-button" type="button" data-action="open-bug-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
        ${pageActionsMenuHtml([
          { action: "toggle-bug-table-edit-mode", icon: "&#9998;", label: "Edit Mode", title: "Edit Mode", checked: bugTableMode.active },
          { action: "toggle-bug-visual-charts", icon: chartIconHtml(), label: "Graphs", title: chartToggleLabel, checked: showCharts, disabled: !canShowCharts, separatorBefore: true },
          { action: "import-bug-html", icon: importIconHtml(), label: "Import HTML", title: "Import PMT HTML", separatorBefore: true },
          { action: "export-bug-view", icon: exportIconHtml(), label: "Export Grid", title: "Export Grid", separatorBefore: true },
          { action: "import-bug-view", icon: importIconHtml(), label: "Import Grid", title: "Import Grid" },
          { action: "reset-bug-view", icon: "&#8634;", label: "Reset View", title: "Reset View", separatorBefore: true }
        ])}
      `)}
      ${showCharts ? bugVisualTrackingChartsHtml(baseBugs, allProjectBugs) : ""}
      <div class="panel work-item-table-panel bugs-table-panel">
        <table class="table work-item-table bugs-table ${bugTableMode.active ? "is-edit-mode" : "is-read-mode"}" style="--bugs-assignee-width:${assigneeColumnWidth}px; --bugs-reporter-width:${reporterColumnWidth}px; --bugs-table-min-width:${bugTableMinWidth(visibleBugColumns)}px">
          <colgroup>
            ${visibleBugColumns.map((column, index) => bugTableColumnColHtml(column, bugColumnIsRubber(visibleBugColumns, index))).join("")}
            ${bugTableMode.active ? `<col class="bugs-action-column">` : ""}
          </colgroup>
          <thead>
            <tr>
              ${visibleBugColumns.map((column, index) => bugColumnHeaderHtml(column, bugColumnIsRubber(visibleBugColumns, index))).join("")}
              ${bugTableMode.active ? `<th class="action-cell" aria-label="Actions"></th>` : ""}
            </tr>
          </thead>
          <tbody data-reorder-list="bugs">
            ${filteredBugs.map(bug => `
              <tr class="clickable-row" data-action="view-task" data-id="${bug.id}" data-task-id="${bug.id}" data-can-drag="${bugTableMode.active && canEditTask(bug) ? "true" : "false"}" draggable="false">
                ${visibleBugColumns.map((column, index) => bugTableColumnCellHtml(column, bug, bugColumnIsRubber(visibleBugColumns, index))).join("")}
                ${bugTableMode.active ? `<td class="reveal-actions action-cell">${taskButtonsHtml(bug, { includeView: false, monochrome: true })}</td>` : ""}
              </tr>
            `).join("") || `<tr><td colspan="${emptyTableColspan}"><div class="empty">No bug reports match these filters.</div></td></tr>`}
          </tbody>
        </table>
      </div>
      </section>
    `;
  }

  async function handleAction(action, id, element) {
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
    if (action === "sort-bug-table") {
      return updateBugTableSort(element);
    }
    if (action === "reset-bug-view") {
      resetBugView();
      return true;
    }
    if (action === "open-bug-filters" || action === "toggle-bug-filters") {
      openBugFiltersDialog();
      return true;
    }
    if (action === "import-bug-html") {
      openBugHtmlImport();
      return true;
    }
    if (action === "export-bug-view") {
      openBugExportDialog();
      return true;
    }
    if (action === "import-bug-view") {
      openBugImport();
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
      existingDialog.querySelector("[data-filter='bug-search']")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog task-filter-dialog bug-filter-dialog";
    modal.dataset.bugFilterDialog = "true";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Bug Tracking Filters</h2>
          <button type="button" class="icon-btn" data-close-bug-filters title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body task-filter-dialog-body bug-filter-dialog-body" data-bug-filter-dialog-body></div>
        <div class="dialog-actions">
          <button type="button" class="primary text-icon-button" data-close-bug-filters>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    renderBugFiltersDialog(modal);
    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { onReset: () => resetBugFiltersDialog(modal) });
    modal.addEventListener("input", event => {
      if (!applyBugFilterChange(event.target)) return;
      renderBugs();
    });
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
    modal.querySelector("[data-filter='bug-search']")?.focus({ preventScroll: true });
  }

  function renderBugFiltersDialog(modal) {
    const body = modal.querySelector("[data-bug-filter-dialog-body]");
    if (body) body.innerHTML = bugFilterFieldsHtml();
  }

  function resetBugFiltersDialog(modal) {
    removePreference(preferenceKeys.bugFilters);
    bugFilters = normalizeBugFilters({});
    renderBugs();
    renderBugFiltersDialog(modal);
    modal.querySelector("[data-filter='bug-project']")?.focus({ preventScroll: true });
  }

  function bugFilterFieldsHtml() {
    const sprintFilterSprints = bugSprintFilterSprints();

    return `
      <div class="bugs-filter-panel">
        <div class="task-filter-row bug-filter-row">
          ${bugFilterSelectHtml("Project", "bug-project", state.projects.map(project => ({ value: project.id, text: `${project.code} - ${project.title}` })), bugFilters.projectId || "", "All Projects")}
          ${bugSprintFilterHtml(sprintFilterSprints)}
          <label>
            <span>Search</span>
            <input type="text" data-filter="bug-search" value="${escapeAttr(bugFilters.search)}">
          </label>
          <label>
            <span>Sort</span>
            <select data-filter="bug-sort">
              ${bugSortOptionsHtml()}
            </select>
          </label>
          ${bugFilterSelectHtml("Status", "bug-status", getStatuses().map(value => ({ value, text: value })), bugFilters.status || "", "All Statuses")}
          ${bugFilterSelectHtml("Priority", "bug-priority", getPriorities().map(value => ({ value, text: value })), bugFilters.priority || "", "All Priorities")}
          ${bugFilterSelectHtml("Severity", "bug-severity", getSeverities().map(value => ({ value, text: value })), bugFilters.severity || "", "All Severities")}
          ${bugFilterSelectHtml("Environment", "bug-environment", getEnvironments().map(value => ({ value, text: value })), bugFilters.environment || "", "All Environments")}
        </div>
        <div class="filter-stack">
          ${filterCheckList("Reporters", "bug-reporter", bugUserFilterItems(), bugFilters.reporterIds, {
            className: "user-card-check-list",
            renderItem: userCardCheckListLabelHtml
          })}
          ${filterCheckList("Assignees", "bug-assignee", bugUserFilterItems(), bugFilters.assigneeIds, {
            className: "user-card-check-list",
            renderItem: userCardCheckListLabelHtml
          })}
          ${filterCheckList("Columns", "bug-column", bugColumnFilterItems(), bugColumnPrefs.visible)}
        </div>
      </div>
    `;
  }

  function bugUserFilterItems() {
    return state.users.map(user => ({
      ...user,
      value: user.id,
      text: user.nickname
    }));
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
    if (key === "search") bugFilters.search = target.value;
    if (key === "sort") bugFilters.sort = target.value;
    if (key === "reporter") bugFilters.reporterIds = checkedFilterValues("bug-reporter");
    if (key === "assignee") bugFilters.assigneeIds = checkedFilterValues("bug-assignee");
    if (key === "column") {
      const visibleColumns = checkedFilterValues("bug-column");
      if (!visibleColumns.length) {
        target.checked = true;
        return false;
      }
      const addedColumns = visibleColumns.filter(column => !bugColumnPrefs.visible.includes(column));
      bugColumnPrefs = normalizeBugColumnPrefs({
        ...bugColumnPrefs,
        order: bugColumnOrderWithAddedColumns(bugColumnPrefs.order, addedColumns),
        visible: visibleColumns
      });
      saveBugColumnPrefs();
      return true;
    }

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
        ${selectOptionsField("Sprint", "sprintId", bugEditorSprintOptions(projectId), defaultSprintId || "")}
        ${field("Title", "title", bug.title || "", "text")}
        ${selectTextField("Status", "status", getLookupOptions("Status", bug.status || "Todo"), bug.status || "Todo")}
        ${selectTextField("Priority", "priority", getLookupOptions("Priority", bug.priority || "Medium"), bug.priority || "Medium")}
        ${taskPercentField(bug, false)}
        ${selectTextField("Environment", "environment", environments, defaultEnvironment)}
        ${selectTextField("Severity", "severity", getLookupOptions("Severity", bug.severity || "Major"), bug.severity || "Major")}
        ${richTextField("descriptionHtml", "Description", bug.descriptionHtml || "")}
        ${attachmentEditorFieldHtml()}
        <div class="bug-assignee-list" data-assignee-list></div>
        <div class="bug-reporter-list">
          ${checkList("Reporters", "reporterIds", state.users, reporterIdsOrDefault(bug.reporterIds, currentUserId), item => item.nickname, { className: "scroll-check-list user-card-check-list", renderItem: userCardCheckListLabelHtml })}
        </div>
        ${field("Start", "startDate", toDateInput(bug.startDate), "date")}
        ${field("End", "endDate", toDateInput(bug.endDate), "date")}
        ${bugEditorUrlField(bug)}
        ${checkList("Dependencies", "dependencyTaskIds", sameProjectTasks, bug.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" })}
        ${richTextField("stepsToReproduceHtml", "Steps to Reproduce", bug.stepsToReproduceHtml || "")}
        ${richTextField("actualResultHtml", "Actual Result", bug.actualResultHtml || "")}
        ${richTextField("expectedResultHtml", "Expected Result", bug.expectedResultHtml || "")}
      </div>
      ${bug.id ? workItemDialogMetaHtml(bug) : ""}
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
    }, "title", root => bindAssigneeList(root, bug.assigneeIds || [], "Assignees (Optional)"));
  }

  function bugEditorSprintOptions(projectId) {
    return [
      { id: "", title: "No Sprint" },
      ...state.sprints
        .filter(sprint => sprint.projectId === projectId)
        .map(sprint => ({ id: sprint.id, title: sprint.code }))
    ];
  }

  function bugEditorUrlField(bug) {
    return `
      <div class="field full">
        <label>URL</label>
        <input name="url" type="url" value="${escapeAttr(bug.url || "")}">
      </div>
    `;
  }

  function filteredBugReports(bugs) {
    return bugs
      .filter(bug => bugMatchesSearchFilter(bug))
      .filter(bug => !bugFilters.status || bug.status === bugFilters.status)
      .filter(bug => !bugFilters.priority || bug.priority === bugFilters.priority)
      .filter(bug => !bugFilters.severity || bug.severity === bugFilters.severity)
      .filter(bug => !bugFilters.environment || bug.environment === bugFilters.environment)
      .filter(bug => !bugFilters.reporterIds.length || bug.reporterIds.map(String).some(id => bugFilters.reporterIds.includes(id)))
      .filter(bug => !bugFilters.assigneeIds.length || bug.assigneeIds.map(String).some(id => bugFilters.assigneeIds.includes(id)))
      .sort(bugSortCompare);
  }

  function normalizeBugFilters(filters = {}) {
    const normalized = {
      ...filters,
      reporterIds: normalizeSavedArray(filters.reporterIds, filters.reporterId),
      assigneeIds: normalizeSavedArray(filters.assigneeIds, filters.assigneeId),
      sort: filters.sort || "custom",
      search: String(filters.search || "")
    };
    const savedBugSprintId = normalized.sprintId && normalized.sprintId !== "0"
      ? String(normalized.sprintId)
      : "";
    normalized.sprintId = savedBugSprintId || (normalized.projectId ? "" : "all");
    return normalized;
  }

  function bugMatchesSearchFilter(bug) {
    const term = String(bugFilters.search || "").trim().toLowerCase();
    if (!term) return true;

    return bugSearchValues(bug)
      .map(value => String(value ?? "").toLowerCase())
      .some(value => value.includes(term));
  }

  function bugSearchValues(bug) {
    return [
      bug.code,
      bug.title,
      projectName(bug.projectId),
      bugTableSprintLabel(bug),
      bug.status,
      bug.priority,
      bug.severity,
      bug.environment,
      userNames(bug.reporters),
      userNames(bug.assignees),
      bugLinkedDevTasksLabel(bug),
      bugDependencyLabel(bug),
      bug.url,
      bug.sortOrder,
      bugUserName(bug.createdByUserId),
      bugUserName(bug.updatedByUserId),
      formatDate(bug.startDate),
      formatDate(bug.endDate),
      formatDateTime(bug.createdAt),
      formatDateTime(bug.updatedAt)
    ];
  }

  function bugSortCompare(a, b) {
    const state = bugTableSortState();

    if (state.column && state.direction) {
      const result = compareBugSortColumn(a, b, state.column);
      if (result) return state.direction === "asc" ? result : -result;
      return taskOrderCompare(a, b);
    }

    if (bugFilters.sort === "oldest") return taskCreatedTime(a) - taskCreatedTime(b) || a.id - b.id;
    if (bugFilters.sort === "newest") return taskCreatedTime(b) - taskCreatedTime(a) || b.id - a.id;

    return taskOrderCompare(a, b);
  }

  function compareBugSortColumn(a, b, column) {
    if (column === "percent") return taskDisplayPercent(a) - taskDisplayPercent(b);
    if (column === "sortOrder") return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (column === "attachmentCount") return Number(a.attachments?.length || 0) - Number(b.attachments?.length || 0);
    if (column === "startDate") return compareBugDateValue(a.startDate, b.startDate);
    if (column === "endDate") return compareBugDateValue(a.endDate, b.endDate);
    if (column === "startedAt") return compareBugDateValue(a.startedAt, b.startedAt);
    if (column === "createdAt") return compareBugDateValue(a.createdAt, b.createdAt);
    if (column === "updatedAt") return compareBugDateValue(a.updatedAt, b.updatedAt);
    if (column === "priority") return compareLookupSortValue(a.priority, b.priority, getPriorities());
    if (column === "severity") return compareLookupSortValue(a.severity, b.severity, getSeverities());
    if (column === "status") return compareLookupSortValue(a.status, b.status, getStatuses());

    return bugSortTextValue(a, column).localeCompare(bugSortTextValue(b, column), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function bugSortTextValue(bug, column) {
    if (column === "reporter") return userNames(bug.reporters);
    if (column === "assignee") return userNames(bug.assignees);
    if (column === "context") return `${projectName(bug.projectId)} ${bugTableSprintLabel(bug)}`;
    if (column === "bug") return `${bug.code || ""} ${bug.title || ""}`;
    if (column === "environment") return bug.environment || "";
    if (column === "linkedDevTasks") return bugLinkedDevTasksLabel(bug);
    if (column === "dependencies") return bugDependencyLabel(bug);
    if (column === "url") return bug.url || "";
    if (column === "createdBy") return bugUserName(bug.createdByUserId);
    if (column === "updatedBy") return bugUserName(bug.updatedByUserId);
    return "";
  }

  function compareBugDateValue(a, b) {
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

  function bugTableColumnDefinitions(headers = {}) {
    const reporterHeader = headers.reporterHeader || "Reporter";
    const assigneeHeader = headers.assigneeHeader || "Assignee";

    return [
      {
        key: "reporter",
        label: "Reporter",
        headerLabel: reporterHeader,
        colClass: "bugs-reporter-column",
        headerClass: "bugs-avatar-heading",
        cellClass: "bugs-avatar-cell",
        width: 112,
        rubberMinWidth: 88,
        defaultVisible: true,
        cellHtml: bug => taskRowAvatarsHtml(bug.reporters)
      },
      {
        key: "assignee",
        label: "Assignee",
        headerLabel: assigneeHeader,
        colClass: "bugs-assignee-column",
        headerClass: "bugs-avatar-heading",
        cellClass: "bugs-avatar-cell",
        width: 112,
        rubberMinWidth: 88,
        defaultVisible: true,
        cellHtml: bug => taskRowAvatarsHtml(bug.assignees)
      },
      {
        key: "context",
        label: "Project/Sprint",
        colClass: "bugs-context-column",
        cellClass: "work-item-context-cell bug-context-cell",
        width: 190,
        rubberMinWidth: 140,
        defaultVisible: true,
        cellHtml: bug => `
          <span class="bug-context-project">${escapeHtml(projectName(bug.projectId))}</span>
          <span class="bug-context-sprint">${escapeHtml(bugTableSprintLabel(bug))}</span>
        `
      },
      {
        key: "bug",
        label: "Bug Report",
        colClass: "bugs-title-column",
        cellClass: "bug-title-cell work-item-title-cell",
        width: 320,
        rubberMinWidth: 180,
        defaultVisible: true,
        cellHtml: bug => `
          <span class="work-item-code-line">
            <strong class="work-item-code">${escapeHtml(bug.code)}</strong>
          </span>
          <span class="work-item-title">${escapeHtml(bug.title)}</span>
        `
      },
      {
        key: "status",
        label: "Status",
        colClass: "bugs-status-column",
        cellClass: "bugs-compact-text-cell",
        width: 136,
        rubberMinWidth: 110,
        defaultVisible: true,
        cellHtml: bug => escapeHtml(bug.status)
      },
      {
        key: "severity",
        label: "Severity",
        colClass: "bugs-severity-column",
        width: 96,
        rubberMinWidth: 86,
        defaultVisible: true,
        cellHtml: bug => `<span class="pill severity-${escapeAttr(bug.severity)}">${escapeHtml(bug.severity || "")}</span>`
      },
      {
        key: "priority",
        label: "Priority",
        colClass: "bugs-priority-column",
        width: 96,
        rubberMinWidth: 86,
        defaultVisible: true,
        cellHtml: bug => `<span class="pill priority-${escapeAttr(bug.priority)}">${escapeHtml(bug.priority)}</span>`
      },
      {
        key: "percent",
        label: "% Complete",
        colClass: "bugs-complete-column",
        headerClass: "done-cell bugs-complete-cell",
        cellClass: "done-cell bugs-complete-cell",
        width: 180,
        rubberMinWidth: 120,
        defaultVisible: true,
        cellHtml: bug => workItemTableProgressHtml(taskDisplayPercent(bug))
      },
      {
        key: "environment",
        label: "Environment",
        colClass: "bugs-environment-column",
        cellClass: "bugs-compact-text-cell",
        width: 132,
        rubberMinWidth: 104,
        cellHtml: bug => escapeHtml(bug.environment || "")
      },
      {
        key: "startDate",
        label: "Start Date",
        colClass: "bugs-date-column",
        cellClass: "bugs-date-cell",
        width: 116,
        rubberMinWidth: 96,
        cellHtml: bug => escapeHtml(formatDate(bug.startDate))
      },
      {
        key: "endDate",
        label: "End Date",
        colClass: "bugs-date-column",
        cellClass: "bugs-date-cell",
        width: 116,
        rubberMinWidth: 96,
        cellHtml: bug => escapeHtml(formatDate(bug.endDate))
      },
      {
        key: "startedAt",
        label: "Started Date/Time",
        colClass: "bugs-date-time-column",
        cellClass: "bugs-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: bug => escapeHtml(formatDateTime(bug.startedAt))
      },
      {
        key: "linkedDevTasks",
        label: "Linked Dev Tasks",
        colClass: "bugs-related-column",
        cellClass: "bugs-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: bug => escapeHtml(bugLinkedDevTasksLabel(bug))
      },
      {
        key: "dependencies",
        label: "Dependencies",
        colClass: "bugs-related-column",
        cellClass: "bugs-compact-text-cell",
        width: 170,
        rubberMinWidth: 130,
        cellHtml: bug => escapeHtml(bugDependencyLabel(bug))
      },
      {
        key: "url",
        label: "URL",
        colClass: "bugs-url-column",
        cellClass: "bugs-url-cell",
        width: 180,
        rubberMinWidth: 130,
        cellHtml: bug => escapeHtml(bug.url || "")
      },
      {
        key: "attachmentCount",
        label: "Attachments",
        colClass: "bugs-count-column",
        cellClass: "bugs-number-cell",
        width: 104,
        rubberMinWidth: 88,
        cellHtml: bug => bug.attachments?.length ? String(bug.attachments.length) : ""
      },
      {
        key: "sortOrder",
        label: "Sort Order",
        colClass: "bugs-number-column",
        cellClass: "bugs-number-cell",
        width: 96,
        rubberMinWidth: 80,
        cellHtml: bug => String(bug.sortOrder ?? "")
      },
      {
        key: "createdBy",
        label: "Created By",
        colClass: "bugs-user-column",
        cellClass: "bugs-compact-text-cell",
        width: 132,
        rubberMinWidth: 110,
        cellHtml: bug => escapeHtml(bugUserName(bug.createdByUserId))
      },
      {
        key: "createdAt",
        label: "Created Date/Time",
        colClass: "bugs-date-time-column",
        cellClass: "bugs-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: bug => escapeHtml(formatDateTime(bug.createdAt))
      },
      {
        key: "updatedBy",
        label: "Updated By",
        colClass: "bugs-user-column",
        cellClass: "bugs-compact-text-cell",
        width: 132,
        rubberMinWidth: 110,
        cellHtml: bug => escapeHtml(bugUserName(bug.updatedByUserId))
      },
      {
        key: "updatedAt",
        label: "Last Updated Date/Time",
        colClass: "bugs-date-time-column",
        cellClass: "bugs-date-cell",
        width: 156,
        rubberMinWidth: 124,
        cellHtml: bug => escapeHtml(formatDateTime(bug.updatedAt))
      }
    ];
  }

  function bugColumnFilterItems() {
    return bugOrderedTableColumns({ reporterHeader: "Reporter", assigneeHeader: "Assignee" })
      .map(column => ({ value: column.key, text: column.label }));
  }

  function bugTableColumnColHtml(column, isRubber = false) {
    const className = [column.colClass, isRubber ? "bugs-rubber-column" : ""]
      .filter(Boolean)
      .join(" ");

    return `<col class="${escapeAttr(className)}">`;
  }

  function bugTableColumnCellHtml(column, bug, isRubber = false) {
    const className = [column.cellClass || "", isRubber ? "bugs-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return `<td class="${escapeAttr(className)}">${column.cellHtml(bug)}</td>`;
  }

  function bugColumnHeaderHtml(column, isRubber = false) {
    const className = [column.headerClass || "", isRubber ? "bugs-rubber-cell" : ""]
      .filter(Boolean)
      .join(" ");

    return bugSortHeaderHtml(column.key, column.headerLabel || column.label, className, {
      draggable: bugTableMode.active
    });
  }

  function bugVisibleTableColumns(headers) {
    const visibleKeys = new Set(bugColumnPrefs.visible);
    const columns = bugOrderedTableColumns(headers)
      .filter(column => visibleKeys.has(column.key));

    return columns.length
      ? columns
      : bugTableColumnDefinitions(headers).filter(column => column.key === "bug");
  }

  function bugOrderedTableColumns(headers) {
    const definitions = bugTableColumnDefinitions(headers);
    const columnsByKey = new Map(definitions.map(column => [column.key, column]));

    return normalizedBugColumnOrder(bugColumnPrefs.order)
      .map(key => columnsByKey.get(key))
      .filter(Boolean);
  }

  function bugTableMinWidth(columns) {
    const fixedWidth = bugTableMode.active ? 224 : 0;
    const lastColumnIndex = columns.length - 1;
    const columnsWidth = columns.reduce((total, column, index) =>
      total + bugColumnMinimumWidth(column, index === lastColumnIndex), 0);
    return Math.max(960, fixedWidth + columnsWidth);
  }

  function bugColumnMinimumWidth(column, isRubber) {
    if (isRubber) return column.rubberMinWidth || Math.min(column.width || 140, 140);
    return column.width || 140;
  }

  function bugColumnIsRubber(columns, index) {
    return index === columns.length - 1;
  }

  function normalizeBugColumnPrefs(preferences = {}) {
    const savedPreferences = preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? preferences
      : {};
    const visibleKeys = normalizeSavedArray(savedPreferences.visible)
      .filter(key => bugColumnKeySet().has(key));

    return {
      order: normalizedBugColumnOrder(savedPreferences.order),
      visible: visibleKeys.length ? visibleKeys : bugDefaultVisibleColumnKeys()
    };
  }

  function normalizedBugColumnOrder(order = []) {
    const allowedKeys = bugColumnKeySet();
    const orderedKeys = normalizeSavedArray(order)
      .filter(key => allowedKeys.has(key));

    bugTableColumnDefinitions().forEach(column => {
      if (!orderedKeys.includes(column.key)) orderedKeys.push(column.key);
    });

    return orderedKeys;
  }

  function bugColumnOrderWithAddedColumns(order, addedColumns) {
    const orderedKeys = normalizedBugColumnOrder(order);

    addedColumns
      .filter(column => column !== "percent" && bugColumnKeySet().has(column))
      .forEach(column => {
        const existingIndex = orderedKeys.indexOf(column);
        if (existingIndex >= 0) orderedKeys.splice(existingIndex, 1);

        const percentIndex = orderedKeys.indexOf("percent");
        orderedKeys.splice(percentIndex >= 0 ? percentIndex : orderedKeys.length, 0, column);
      });

    return orderedKeys;
  }

  function bugColumnKeySet() {
    return new Set(bugTableColumnDefinitions().map(column => column.key));
  }

  function bugDefaultVisibleColumnKeys() {
    return bugTableColumnDefinitions()
      .filter(column => column.defaultVisible)
      .map(column => column.key);
  }

  function saveBugColumnPrefs() {
    writeJsonPreference(preferenceKeys.bugTableColumns, bugColumnPrefs);
  }

  function bindBugColumnDragEvents() {
    app.addEventListener("pointerdown", handleBugColumnPointerDown);
    app.addEventListener("mousedown", handleBugColumnMouseDown);
    app.addEventListener("click", suppressBugColumnDraggedClick, true);
  }

  function handleBugColumnPointerDown(event) {
    lastBugColumnPointerDragAt = Date.now();
    startBugColumnDrag(event, "pointer");
  }

  function handleBugColumnMouseDown(event) {
    if (Date.now() - lastBugColumnPointerDragAt < 500) return;
    startBugColumnDrag(event, "mouse");
  }

  function startBugColumnDrag(event, inputType) {
    if (event.button !== 0) return;
    if (!bugTableMode.active) return;

    const header = event.target.closest('.bugs-table th[data-bug-column][data-column-draggable="true"]');
    const table = header?.closest(".bugs-table");
    if (!header || !table || !app.contains(header)) return;

    const columnKey = header.dataset.bugColumn || "";
    if (!bugColumnPrefs.visible.includes(columnKey)) return;

    bugColumnDrag = {
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
      window.addEventListener("pointermove", handleBugColumnPointerMove);
      window.addEventListener("pointerup", handleBugColumnPointerUp, { once: true });
      window.addEventListener("pointercancel", cancelBugColumnDrag, { once: true });
    } else {
      window.addEventListener("mousemove", handleBugColumnMouseMove);
      window.addEventListener("mouseup", handleBugColumnMouseUp, { once: true });
    }
  }

  function handleBugColumnPointerMove(event) {
    lastBugColumnPointerDragAt = Date.now();
    moveBugColumnDrag(event);
  }

  function handleBugColumnMouseMove(event) {
    if (bugColumnDrag?.inputType === "pointer") return;
    moveBugColumnDrag(event);
  }

  function moveBugColumnDrag(event) {
    if (!bugColumnDrag) return;

    const movedEnough = Math.hypot(event.clientX - bugColumnDrag.startX, event.clientY - bugColumnDrag.startY) > 5;
    if (!bugColumnDrag.started && !movedEnough) return;

    if (!bugColumnDrag.started) {
      bugColumnDrag.started = true;
      suppressNextBugColumnClick = true;
      bugColumnDrag.source.classList.add("column-dragging");
      bugColumnDrag.table.classList.add("is-column-dragging");
    }

    event.preventDefault();
    updateBugColumnDropIndicator(event.clientX, event.clientY);
  }

  function handleBugColumnPointerUp(event) {
    lastBugColumnPointerDragAt = Date.now();
    finishBugColumnDrag(event);
  }

  function handleBugColumnMouseUp(event) {
    if (bugColumnDrag?.inputType === "pointer") return;
    finishBugColumnDrag(event);
  }

  function finishBugColumnDrag(event) {
    if (!bugColumnDrag || bugColumnDrag.finishing) return;
    bugColumnDrag.finishing = true;

    if (!bugColumnDrag.started) {
      cancelBugColumnDrag();
      return;
    }

    event.preventDefault();
    suppressNextBugColumnClick = true;

    const drag = bugColumnDrag;
    const drop = bugColumnDropTarget(event.clientX, event.clientY);
    if (drop) {
      const order = bugColumnKeysAfterDrop(drag.columnKey, drop.target.dataset.bugColumn || "", drop.placement);
      if (bugColumnOrderChanged(order)) {
        bugColumnPrefs = normalizeBugColumnPrefs({ ...bugColumnPrefs, order });
        saveBugColumnPrefs();
        cancelBugColumnDrag();
        renderBugs();
        return;
      }
    }

    cancelBugColumnDrag();
  }

  function bugColumnDropTarget(clientX, clientY) {
    if (!bugColumnDrag) return null;

    const headerRow = bugColumnDrag.table.querySelector("thead tr");
    const headerRect = headerRow?.getBoundingClientRect();
    if (!headerRect || clientY < headerRect.top - 32 || clientY > headerRect.bottom + 64) return null;

    const headers = [...bugColumnDrag.table.querySelectorAll('thead th[data-bug-column][data-column-draggable="true"]')]
      .filter(header => (header.dataset.bugColumn || "") !== bugColumnDrag.columnKey);
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

  function updateBugColumnDropIndicator(clientX, clientY) {
    clearBugColumnDropIndicators();

    const drop = bugColumnDropTarget(clientX, clientY);
    if (!drop) return;

    bugColumnDrag.table.classList.add("column-drop-target");
    drop.target.classList.add(drop.placement === "after" ? "column-reorder-after" : "column-reorder-before");
  }

  function bugColumnKeysAfterDrop(draggedKey, targetKey, placement) {
    const orderedKeys = normalizedBugColumnOrder(bugColumnPrefs.order)
      .filter(key => key !== draggedKey);
    let insertIndex = orderedKeys.indexOf(targetKey);
    if (insertIndex < 0) return normalizedBugColumnOrder(bugColumnPrefs.order);
    if (placement === "after") insertIndex += 1;
    orderedKeys.splice(insertIndex, 0, draggedKey);
    return orderedKeys;
  }

  function bugColumnOrderChanged(order) {
    const currentOrder = normalizedBugColumnOrder(bugColumnPrefs.order);
    return order.length !== currentOrder.length || order.some((key, index) => key !== currentOrder[index]);
  }

  function cancelBugColumnDrag() {
    window.removeEventListener("pointermove", handleBugColumnPointerMove);
    window.removeEventListener("mousemove", handleBugColumnMouseMove);
    window.removeEventListener("pointerup", handleBugColumnPointerUp);
    window.removeEventListener("mouseup", handleBugColumnMouseUp);
    window.removeEventListener("pointercancel", cancelBugColumnDrag);

    if (bugColumnDrag?.inputType === "pointer" && bugColumnDrag.source.releasePointerCapture && bugColumnDrag.pointerId !== undefined) {
      try {
        bugColumnDrag.source.releasePointerCapture(bugColumnDrag.pointerId);
      } catch {
        // The browser may already have released pointer capture.
      }
    }

    bugColumnDrag = null;
    app.querySelectorAll(".column-dragging, .is-column-dragging, .column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove(
        "column-dragging",
        "is-column-dragging",
        "column-drop-target",
        "column-reorder-before",
        "column-reorder-after"
      ));
  }

  function clearBugColumnDropIndicators() {
    app.querySelectorAll(".column-drop-target, .column-reorder-before, .column-reorder-after")
      .forEach(item => item.classList.remove("column-drop-target", "column-reorder-before", "column-reorder-after"));
  }

  function suppressBugColumnDraggedClick(event) {
    if (!suppressNextBugColumnClick) return;
    suppressNextBugColumnClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function bugSortHeaderHtml(column, label, className = "", options = {}) {
    const state = bugTableSortState();
    const isSorted = state.column === column && Boolean(state.direction);
    const ariaSort = isSorted ? (state.direction === "asc" ? "ascending" : "descending") : "none";
    const arrow = isSorted ? (state.direction === "asc" ? "&#9650;" : "&#9660;") : "";
    const classes = [className, isSorted ? "is-sorted" : ""].filter(Boolean).join(" ");
    const columnDragAttrs = `
      data-bug-column="${escapeAttr(column)}"
      data-column-draggable="${options.draggable ? "true" : "false"}"`;

    return `
      <th class="${classes}" aria-sort="${ariaSort}" ${columnDragAttrs}>
        <button type="button" class="table-sort-button" data-action="sort-bug-table" data-column="${escapeAttr(column)}" title="${escapeAttr(bugNextSortLabel(column, label))}">
          <span>${escapeHtml(label)}</span>
          <span class="table-sort-indicator" aria-hidden="true">${arrow}</span>
        </button>
      </th>
    `;
  }

  function updateBugTableSort(button) {
    const column = button?.dataset?.column || "";
    if (!bugTableSortColumns().some(item => item.column === column)) return false;

    bugFilters.sort = nextBugSort(column);
    writeJsonPreference(preferenceKeys.bugFilters, bugFilters);
    renderBugs();
    return true;
  }

  function nextBugSort(column) {
    const state = bugTableSortState();
    if (state.column !== column || !state.direction) return `${column}-asc`;
    if (state.direction === "asc") return `${column}-desc`;
    return "custom";
  }

  function bugTableSortState(sortValue = bugFilters.sort) {
    const match = /^(.+)-(asc|desc)$/.exec(sortValue || "");
    if (!match) return { column: "", direction: "" };
    return { column: match[1], direction: match[2] };
  }

  function bugSortOptionsHtml() {
    const selectedSort = bugFilters.sort || "custom";
    const options = [
      { value: "custom", text: "Custom Order (Saved Order)" },
      { value: "newest", text: "Newest Bug Reports" },
      { value: "oldest", text: "Oldest Bug Reports" },
      ...bugTableSortColumns().flatMap(column => [
        { value: `${column.column}-asc`, text: `${column.label} Ascending` },
        { value: `${column.column}-desc`, text: `${column.label} Descending` }
      ])
    ];

    return options
      .map(option => `<option value="${escapeAttr(option.value)}" ${selectedSort === option.value ? "selected" : ""}>${escapeHtml(option.text)}</option>`)
      .join("");
  }

  function bugTableSortColumns() {
    return bugTableColumnDefinitions({ reporterHeader: "Reporter", assigneeHeader: "Assignee" })
      .map(column => ({ column: column.key, label: column.label }));
  }

  function bugNextSortLabel(column, label) {
    const state = bugTableSortState();
    if (state.column === column && state.direction === "asc") return `Sort ${label} descending`;
    if (state.column === column && state.direction === "desc") return `Clear ${label} sort`;
    return `Sort ${label} ascending`;
  }

  function openBugExportDialog() {
    openExportDialog({
      title: "Export Bug Tracking",
      onCsvExport: exportBugCsv,
      onExcelExport: exportBugExcel
    });
  }

  function exportBugCsv() {
    const rows = bugExportImportRows();
    const columns = bugExportImportColumns(rows);

    downloadCsv(exportFileName("pmt-bug-tracking"), columns, rows);
  }

  function exportBugExcel() {
    const rows = bugExportImportRows();
    const columns = bugExportImportColumns(rows);

    downloadXlsx(exportFileName("pmt-bug-tracking", "xlsx"), "Bug Tracking", columns, rows);
  }

  function bugExportImportRows() {
    return bugExportRows().map(bug => ({ task: bug }));
  }

  function bugExportImportColumns(rows) {
    const headers = {
      reporterHeader: bugRowsHaveMultipleUsers(rows.map(row => row.task), bug => bug.reporters) ? "Reporters" : "Reporter",
      assigneeHeader: bugRowsHaveMultipleUsers(rows.map(row => row.task), bug => bug.assignees) ? "Assignees" : "Assignee"
    };
    return [
      ...bugExportColumns(bugVisibleTableColumns(headers)).map(column => ({
        header: column.header,
        value: row => column.value(row.task)
      })),
      ...workItemSystemColumns({
        nameHeader: "PMT Update Bug Name",
        itemTypeLabel: () => "Bug",
        percentValue: bug => taskDisplayPercent(bug),
        assigneeLabel: bug => userNames(bug.assignees)
      })
    ];
  }

  function openBugImport() {
    openExcelImport({
      onImport: importBugExcel,
      onError: error => showImportResultDialog({
        title: "Import Bug Tracking",
        totalRows: 0,
        updatedRows: 0,
        errors: [{ rowNumber: "File", message: error.message }]
      })
    });
  }

  function openBugHtmlImport() {
    openWorkItemHtmlImport({
      screenLabel: "Bug Tracking",
      allowedTaskTypes: ["Bug"],
      defaultTaskType: "Bug",
      defaultStatus: "Todo",
      routeType: "bugs",
      apiRoot: "/api/tasks",
      saveJson,
      refreshAfterImport,
      getFallbackContext: bugImportFallbackContext
    });
  }

  function bugImportFallbackContext() {
    const taskContext = getTaskContext();
    const selectedSprint = selectedBugSprint();
    const rememberedProjectId = state.projects.some(project => project.id === bugEntryProjectId)
      ? bugEntryProjectId
      : 0;
    const projectId = Number(bugFilters.projectId || 0)
      || selectedSprint?.projectId
      || rememberedProjectId
      || taskContext.projectId
      || state.projects[0]?.id
      || 0;
    const rememberedSprint = state.sprints.find(sprint =>
      sprint.id === Number(bugEntrySprintId || 0)
      && sprint.projectId === projectId
    );
    const sprint = selectedSprint?.projectId === projectId
      ? selectedSprint
      : rememberedSprint;

    return {
      projectId,
      sprintId: sprint?.id || null,
      status: "Todo"
    };
  }

  async function importBugExcel(records) {
    const workbookError = importWorkbookTypeError(records, ["Bug"], "Bug Tracking");
    if (workbookError) {
      showImportResultDialog({
        title: "Import Bug Tracking",
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
        if (await importBugRecord(record)) updatedRows += 1;
      } catch (error) {
        const id = parseImportItemId(record);
        const bug = id ? taskById(id) : null;
        errors.push({
          rowNumber,
          code: importCell(record, "PMT Item Code") || bug?.code || "",
          title: importCell(record, "PMT Update Bug Name", "Bug Name") || bug?.title || "",
          message: error.message
        });
      }
    }

    if (updatedRows && refreshAfterImport) await refreshAfterImport();
    showImportResultDialog({
      title: "Import Bug Tracking",
      totalRows: records.length,
      updatedRows,
      errors
    });
  }

  async function importBugRecord(record) {
    const bug = taskById(parseImportItemId(record));
    if (!bug) throw new Error("PMT Item Id does not match an existing row.");
    if (bug.taskType !== "Bug") throw new Error("This row is not a Bug.");
    assertBugImportAllowed(bug);

    assertImportItemCode(record, bug.code, "Bug Code");
    assertBugImportHash(record, bug);

    const title = importCell(record, "Bug Name", "PMT Update Bug Name", "PMT Update Item Name").trim();
    const status = importCell(record, "Status", "PMT Update Status").trim();
    const priority = importCell(record, "Priority", "PMT Update Priority").trim();
    const requestedPercent = parseImportPercent(record, "% Complete");
    const assigneeIds = uniqueIds(parseImportAssigneeIds(record, state.users, "Assignee", "Assignees", "Assigned"));

    if (!title) throw new Error("Bug Name is required.");
    if (!getStatuses().includes(status)) throw new Error(`Status "${status}" is not a PMT status.`);
    if (!getPriorities().includes(priority)) throw new Error(`Priority "${priority}" is not a PMT priority.`);
    validateBugImportAssignees(bug, assigneeIds);

    const percentCompleted = percentForStatus(status, requestedPercent);
    if (!bugImportChanged(bug, { title, status, priority, percentCompleted, assigneeIds })) return false;

    await saveJson(`/api/tasks/${bug.id}`, "PUT", bugImportPayload(bug, {
      title,
      status,
      priority,
      percentCompleted,
      assigneeIds
    }));
    return true;
  }

  function assertBugImportHash(record, bug) {
    const hash = importCell(record, "PMT Row Hash").trim();
    if (hash && hash !== workItemImportHash(bug, taskDisplayPercent(bug))) {
      throw new Error("This row is stale. Re-export the grid before importing this row.");
    }
  }

  function validateBugImportAssignees(bug, assigneeIds) {
    const project = state.projects.find(item => item.id === bug.projectId);
    const sprint = bug.sprintId ? state.sprints.find(item => item.id === bug.sprintId) : null;
    const allowedIds = new Set(allowedAssigneeUsers(state.users, project, sprint).map(user => user.id));
    const invalid = assigneeIds.filter(id => !allowedIds.has(id));
    if (invalid.length) throw new Error(`Assignee ids are not valid for this Project/Sprint: ${invalid.join(", ")}.`);
  }

  function bugImportChanged(bug, updates) {
    return bug.title !== updates.title
      || bug.status !== updates.status
      || bug.priority !== updates.priority
      || Number(bug.percentCompleted || 0) !== Number(updates.percentCompleted || 0)
      || !sameNumberList(bug.assigneeIds || [], updates.assigneeIds || []);
  }

  function bugImportPayload(bug, updates) {
    return {
      id: bug.id,
      projectId: bug.projectId,
      sprintId: bug.sprintId || null,
      parentTaskId: null,
      taskType: "Bug",
      title: updates.title,
      descriptionHtml: bug.descriptionHtml || "",
      stepsToReproduceHtml: bug.stepsToReproduceHtml || "",
      actualResultHtml: bug.actualResultHtml || "",
      expectedResultHtml: bug.expectedResultHtml || "",
      environment: bug.environment || "",
      severity: bug.severity || "",
      status: updates.status,
      priority: updates.priority,
      percentCompleted: updates.percentCompleted,
      url: bug.url || "",
      startDate: bug.startDate || null,
      endDate: bug.endDate || null,
      reporterIds: bug.reporterIds || [],
      assigneeIds: updates.assigneeIds,
      dependencyTaskIds: bug.dependencyTaskIds || [],
      auditContext: "Import"
    };
  }

  function assertBugImportAllowed(bug) {
    const user = currentUser();
    if (user.isAdmin || user.role === "Admin") return;
    if (bug.createdByUserId !== user.id) {
      throw new Error("Only an Admin can import updates for another user's bug report.");
    }
  }

  function bugExportRows() {
    const sprintFilterSprints = bugSprintFilterSprints();
    ensureBugSprintFilter(sprintFilterSprints);
    const allProjectBugs = state.tasks
      .filter(task => task.taskType === "Bug")
      .filter(bug => !bugFilters.projectId || bug.projectId === Number(bugFilters.projectId));
    const baseBugs = allProjectBugs
      .filter(bug => !bugFilters.sprintId || bugFilters.sprintId === "all" || bug.sprintId === Number(bugFilters.sprintId));

    return filteredBugReports(baseBugs);
  }

  function bugExportColumns(visibleColumns) {
    return visibleColumns.flatMap(column => {
      if (column.key === "reporter") return [{ header: column.headerLabel || column.label, value: bug => userNames(bug.reporters) }];
      if (column.key === "assignee") return [{ header: column.headerLabel || column.label, value: bug => userNames(bug.assignees) }];
      if (column.key === "context") {
        return [
          { header: "Project", value: bug => projectName(bug.projectId) },
          { header: "Sprint", value: bug => bugTableSprintLabel(bug) }
        ];
      }
      if (column.key === "bug") {
        return [
          { header: "Bug Code", value: bug => bug.code },
          { header: "Bug Name", value: bug => bug.title }
        ];
      }

      return [{ header: column.label, value: bug => bugExportValue(column.key, bug) }];
    });
  }

  function bugExportValue(columnKey, bug) {
    if (columnKey === "status") return bug.status;
    if (columnKey === "severity") return bug.severity || "";
    if (columnKey === "priority") return bug.priority;
    if (columnKey === "percent") return taskDisplayPercent(bug);
    if (columnKey === "environment") return bug.environment || "";
    if (columnKey === "startDate") return formatDate(bug.startDate);
    if (columnKey === "endDate") return formatDate(bug.endDate);
    if (columnKey === "startedAt") return formatDateTime(bug.startedAt);
    if (columnKey === "linkedDevTasks") return bugLinkedDevTasksLabel(bug);
    if (columnKey === "dependencies") return bugDependencyLabel(bug);
    if (columnKey === "url") return bug.url || "";
    if (columnKey === "attachmentCount") return bug.attachments?.length || "";
    if (columnKey === "sortOrder") return bug.sortOrder ?? "";
    if (columnKey === "createdBy") return bugUserName(bug.createdByUserId);
    if (columnKey === "createdAt") return formatDateTime(bug.createdAt);
    if (columnKey === "updatedBy") return bugUserName(bug.updatedByUserId);
    if (columnKey === "updatedAt") return formatDateTime(bug.updatedAt);
    return "";
  }

  function resetBugView() {
    [
      preferenceKeys.bugFilters,
      preferenceKeys.bugFiltersVisible,
      preferenceKeys.bugVisualChartsVisible,
      preferenceKeys.bugEntryProject,
      preferenceKeys.bugEntrySprint,
      preferenceKeys.bugEntryEnvironment,
      preferenceKeys.bugTableColumns
    ].forEach(removePreference);

    bugFilters = normalizeBugFilters({});
    bugVisualChartsVisible = true;
    bugEntryProjectId = 0;
    bugEntrySprintId = "";
    bugEntryEnvironment = "";
    bugColumnPrefs = normalizeBugColumnPrefs({});
    bugTableMode.deactivate();
    cancelBugColumnDrag();
    renderBugs();
  }

  function bugAvatarColumnWidth(bugs, usersForBug) {
    const avatarSize = 60;
    const overlapWidth = 42;
    const cellPadding = 34;
    const maxUserCount = Math.max(
      1,
      ...bugs.map(bug => {
        const users = usersForBug(bug);
        return Array.isArray(users) ? users.length : 0;
      })
    );

    return cellPadding + avatarSize + ((maxUserCount - 1) * overlapWidth);
  }

  function bugRowsHaveMultipleUsers(bugs, usersForBug) {
    return bugs.some(bug => {
      const users = usersForBug(bug);
      return Array.isArray(users) && users.length > 1;
    });
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

  function bugLinkedDevTasksLabel(bug) {
    return state.tasks
      .filter(task => task.taskType !== "Bug")
      .filter(task => task.linkedBugTaskId === bug.id || (task.dependencyTaskIds || []).includes(bug.id))
      .map(bugDisplayLabel)
      .join(", ");
  }

  function bugDependencyLabel(bug) {
    return (bug.dependencyTaskIds || [])
      .map(taskId => taskById(taskId))
      .filter(Boolean)
      .map(bugDisplayLabel)
      .join(", ");
  }

  function bugDisplayLabel(task) {
    return [task.code, task.title].filter(Boolean).join(" - ");
  }

  function bugUserName(userId) {
    const user = userId ? userById(Number(userId)) : null;
    return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  }

  function bugTableSprintLabel(bug) {
    const sprintLabel = sprintById(Number(bug.sprintId || 0))?.code || "No Sprint";
    const project = projectById(bug.projectId);
    const prefixes = project?.code ? [`${project.code}-`, `${project.code} - `, `${project.code} `] : [];
    const prefix = prefixes.find(item => sprintLabel.toLowerCase().startsWith(item.toLowerCase()));

    return prefix
      ? sprintLabel.slice(prefix.length)
      : sprintLabel;
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
      body: VisualCharts.pieChart(items, `${filteredBugs.length} total`, "No severity data is available.", {
        donut: true,
        centerValue: String(filteredBugs.length),
        centerLabel: "Total"
      })
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
    cancelBugColumnDrag();
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
