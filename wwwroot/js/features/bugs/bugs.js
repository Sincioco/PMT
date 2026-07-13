import { taskRowAvatarsHtml } from "../../components/avatars.js";
import {
  applyBugDialogFieldPreferences,
  bugDialogCustomizationButtonHtml,
  bugDialogFieldDefinitions,
  bugDialogFieldHtml,
  bugDialogFieldLabel,
  normalizeBugDialogFieldPrefs,
  openBugDialogCustomizationDialog,
  readBugDialogFieldPrefs,
  syncBugDialogHeaderActionsMenu
} from "../../components/bug-dialog-customization.js?v=20260711-tsg-report";
import { buttonContent, chartIconHtml, funnelIconHtml, pageActionsMenuHtml } from "../../components/buttons.js?v=20260701-unified-dropdowns";
import { VisualCharts } from "../../components/charts.js?v=20260628-chart-native-tooltips";
import { initializeWindowedDialog } from "../../components/dialogs.js?v=20260711-tsg-report";
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
} from "../../components/forms.js?v=20260711-bug-dialog-customize";
import { progressHtml } from "../../components/progress-and-status.js?v=20260714-linked-bug-percent";
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
} from "../../components/work-items.js?v=20260714-attachment-delete";
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
} from "../../core/preferences.js?v=20260711-tsg-report";
import { currentView } from "../../core/router.js?v=20260707-deep-links";
import { state } from "../../core/store.js";
import {
  formatDate,
  formatDateTime,
  toDateInput
} from "../../shared/dates.js?v=20260620-null-end-date";
import { normalizeSavedArray } from "../../shared/filter-values.js";
import {
  bugMixChart,
  bugSeverityChartColor,
  bugSeverityChartItems,
  bugSprintChartRows as sharedBugSprintChartRows,
  newestBugSprintRows as sharedNewestBugSprintRows
} from "../../shared/bug-charts.js?v=20260714-linked-bug-percent";
import { createReorderDrag } from "../../shared/reorder-drag.js";
import {
  downloadXlsx,
  downloadCsv,
  exportIconHtml,
  exportFileName,
  importFirstNonEmptyCell,
  importIconHtml,
  openExcelImport,
  openExportDialog,
  parseImportPercentOrDefault,
  resolveImportLookupValue,
  resolveImportProjectId,
  resolveImportSprintId,
  resolveImportUserIds,
  resolveImportWorkItem,
  showImportResultDialog,
  sameNumberList,
  workItemSystemColumns
} from "../../shared/table-export.js?v=20260710-rich-bug-layout";
import { canEditTask } from "../../shared/permissions.js?v=20260713-role-security";
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
  percentForStatus,
  reporterIdsOrDefault,
  taskDisplayPercent,
  taskCreatedTime,
  taskOrderCompare
} from "../../shared/work-item-rules.js?v=20260714-linked-bug-percent";
import { openWorkItemHtmlImport } from "../../shared/work-item-transfer.js?v=20260714-linked-bug-percent";

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
  let bugTsgReportDrag = null;
  let activeBugTsgReportDialog = null;
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
          { action: "open-bug-tsg-report", icon: tsgReportIconHtml(), label: "Report", title: "Report", separatorBefore: true },
          { action: "reset-bug-view", icon: "&#8634;", label: "Reset View", title: "Reset View" }
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
    if (action === "customize-bug-dialog-view") {
      openBugDialogCustomizationDialog();
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
    if (action === "open-bug-tsg-report") {
      openBugTsgReportDialog();
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
      <template data-editor-head-action>
        ${bugDialogCustomizationButtonHtml()}
      </template>
      <div class="form-grid bug-editor-grid" data-bug-dialog-root="edit">
        ${bug.id ? taskAuditPanelHtml(bug) : ""}
        ${bugDialogFieldHtml("projectId", selectField(bugDialogFieldLabel("projectId"), "projectId", state.projects, projectId))}
        ${bugDialogFieldHtml("sprintId", selectOptionsField(bugDialogFieldLabel("sprintId"), "sprintId", bugEditorSprintOptions(projectId), defaultSprintId || ""))}
        ${bugDialogFieldHtml("title", field(bugDialogFieldLabel("title"), "title", bug.title || "", "text"))}
        ${bugDialogFieldHtml("status", selectTextField(bugDialogFieldLabel("status"), "status", getLookupOptions("Status", bug.status || "Todo"), bug.status || "Todo"))}
        ${bugDialogFieldHtml("priority", selectTextField(bugDialogFieldLabel("priority"), "priority", getLookupOptions("Priority", bug.priority || "Low"), bug.priority || "Low"))}
        ${bugDialogFieldHtml("percentCompleted", taskPercentField({ ...bug, __bugDialogPercentLabel: bugDialogFieldLabel("percentCompleted") }, false))}
        ${bugDialogFieldHtml("environment", selectTextField(bugDialogFieldLabel("environment"), "environment", environments, defaultEnvironment))}
        ${bugDialogFieldHtml("severity", selectTextField(bugDialogFieldLabel("severity"), "severity", getLookupOptions("Severity", bug.severity || "Minor"), bug.severity || "Minor"))}
        ${bugDialogFieldHtml("descriptionHtml", richTextField("descriptionHtml", bugDialogFieldLabel("descriptionHtml"), bug.descriptionHtml || ""))}
        ${bugDialogFieldHtml("url", bugEditorUrlField(bug))}
        ${bugDialogFieldHtml("attachments", attachmentEditorFieldHtml(bug.attachments || [], bug.id ? `${apiRoot}/${bug.id}/attachments` : ""))}
        ${bugDialogFieldHtml("startDate", field(bugDialogFieldLabel("startDate"), "startDate", toDateInput(bug.startDate), "date"))}
        ${bugDialogFieldHtml("endDate", field(bugDialogFieldLabel("endDate"), "endDate", toDateInput(bug.endDate), "date"))}
        ${bugDialogFieldHtml("stepsToReproduceHtml", richTextField("stepsToReproduceHtml", bugDialogFieldLabel("stepsToReproduceHtml"), bug.stepsToReproduceHtml || ""))}
        ${bugDialogFieldHtml("actualResultHtml", richTextField("actualResultHtml", bugDialogFieldLabel("actualResultHtml"), bug.actualResultHtml || ""))}
        ${bugDialogFieldHtml("expectedResultHtml", richTextField("expectedResultHtml", bugDialogFieldLabel("expectedResultHtml"), bug.expectedResultHtml || ""))}
        ${bugDialogFieldHtml("rootCauseAnalysisHtml", richTextField("rootCauseAnalysisHtml", bugDialogFieldLabel("rootCauseAnalysisHtml"), bug.rootCauseAnalysisHtml || ""))}
        ${bugDialogFieldHtml("assigneeIds", `<div class="bug-assignee-list" data-assignee-list></div>`)}
        ${bugDialogFieldHtml("reporterIds", `
          <div class="bug-reporter-list">
            ${checkList(bugDialogFieldLabel("reporterIds"), "reporterIds", state.users, reporterIdsOrDefault(bug.reporterIds, currentUserId), item => item.nickname, { className: "scroll-check-list user-card-check-list", renderItem: userCardCheckListLabelHtml })}
          </div>
        `)}
        ${bugDialogFieldHtml("dependencyTaskIds", checkList(bugDialogFieldLabel("dependencyTaskIds"), "dependencyTaskIds", sameProjectTasks, bug.dependencyTaskIds || [], item => `${item.code} ${item.title}`, { className: "scroll-check-list dependency-check-list" }))}
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
        rootCauseAnalysisHtml: richValue(root, "rootCauseAnalysisHtml"),
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
    }, "title", root => {
      const editorDialog = document.getElementById("editorDialog");
      editorDialog?.querySelector("[data-action='customize-bug-dialog-view']")
        ?.addEventListener("click", openBugDialogCustomizationDialog);
      requestAnimationFrame(() => syncBugDialogHeaderActionsMenu(editorDialog));
      bindAssigneeList(root, bug.assigneeIds || [], "Assignees (Optional)");
      applyBugDialogFieldPreferences(root);
    });
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
        cellHtml: bug => (bug.assignees || []).length ? taskRowAvatarsHtml(bug.assignees) : ""
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

  function tsgReportIconHtml() {
    return `
      <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 4h9l3 3v13H6z"></path>
        <path d="M15 4v4h4M9 11h6M9 15h6M9 18h4"></path>
      </svg>
    `;
  }

  function exportBugCsv(options = {}) {
    const rows = bugExportImportRows();
    const columns = bugExportImportColumns(rows, options);

    downloadCsv(exportFileName("pmt-bug-tracking"), columns, rows);
  }

  function exportBugExcel(options = {}) {
    const rows = bugExportImportRows();
    const columns = bugExportImportColumns(rows, options);

    downloadXlsx(exportFileName("pmt-bug-tracking", "xlsx"), "Bug Tracking", columns, rows);
  }

  function openBugTsgReportDialog() {
    if (activeBugTsgReportDialog?.isConnected) {
      if (!activeBugTsgReportDialog.open) activeBugTsgReportDialog.showModal?.();
      activeBugTsgReportDialog.querySelector("[data-bug-tsg-filename]")?.focus({ preventScroll: true });
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "dialog windowed-dialog work-item-dialog-customize-dialog bug-dialog-customize-dialog bug-tsg-report-dialog";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>Report</h2>
          <button type="button" class="icon-btn" data-close-bug-tsg-report title="Close" aria-label="Close">x</button>
        </div>
        <div class="dialog-body bug-dialog-customize-body bug-tsg-report-body" data-bug-tsg-report-body></div>
        <div class="dialog-actions">
          <div class="dialog-action-group is-left">
            <button type="button" class="secondary text-icon-button" data-reset-bug-tsg-report>${buttonContent("&#8635;", "Reset")}</button>
          </div>
          <button type="button" class="primary text-icon-button" data-close-bug-tsg-report>${buttonContent("&#10003;", "Done")}</button>
        </div>
      </form>
    `;

    activeBugTsgReportDialog = modal;
    renderBugTsgReportDialog(modal, readBugTsgReportPrefs());
    document.body.appendChild(modal);
    initializeWindowedDialog(modal, { showResetButton: false });
    modal.addEventListener("input", event => handleBugTsgReportInput(modal, event.target));
    modal.addEventListener("change", event => handleBugTsgReportChange(modal, event.target));
    modal.addEventListener("click", event => {
      const exportButton = event.target.closest("[data-export-bug-tsg]");
      if (exportButton) {
        event.preventDefault();
        exportBugTsgReport(modal, exportButton.dataset.exportBugTsg || "csv");
        return;
      }

      if (event.target.closest("[data-reset-bug-tsg-report]")) {
        resetBugTsgReportDialog(modal);
        return;
      }

      if (event.target.closest("[data-close-bug-tsg-report]")) modal.close();
    });
    modal.addEventListener("close", () => {
      bugTsgReportDrag?.unbind();
      bugTsgReportDrag = null;
      activeBugTsgReportDialog = null;
      modal.remove();
    }, { once: true });
    modal.showModal();
    modal.querySelector("[data-bug-tsg-filename]")?.focus({ preventScroll: true });
  }

  function renderBugTsgReportDialog(modal, prefs) {
    const body = modal.querySelector("[data-bug-tsg-report-body]");
    if (!body) return;

    const definitionsByKey = new Map(bugDialogFieldDefinitions().map(field => [field.key, field]));
    body.innerHTML = `
      <div class="bug-tsg-report-controls">
        <label class="field bug-tsg-report-filename">
          <span>Filename</span>
          <input type="text" data-bug-tsg-filename value="${escapeAttr(bugTsgReportFilenamePreference())}" aria-label="Filename">
        </label>
        <div class="bug-tsg-report-export-actions">
          <button type="button" class="secondary text-icon-button" data-export-bug-tsg="csv">${buttonContent(exportIconHtml(), "Export as .csv")}</button>
          <button type="button" class="secondary text-icon-button" data-export-bug-tsg="xlsx">${buttonContent(exportIconHtml(), "Export as Native Excel File (no formatting)")}</button>
        </div>
      </div>
      <table class="table settings-table settings-navigation-table work-item-table bug-dialog-customize-table bug-tsg-report-table">
        <thead>
          <tr>
            <th class="bug-dialog-visible-column" aria-label="Visible"></th>
            <th>Original Field</th>
            <th>Display Label</th>
            <th aria-label="Order"></th>
          </tr>
        </thead>
        <tbody data-reorder-list="bug-tsg-report-fields">
          ${prefs.order.map(key => definitionsByKey.get(key)).filter(Boolean).map(field => bugTsgReportRowHtml(field, prefs)).join("")}
        </tbody>
      </table>
    `;

    bindBugTsgReportDrag(modal);
  }

  function bugTsgReportRowHtml(field, prefs) {
    const label = prefs.labels[field.key] || field.label;
    return `
      <tr data-bug-tsg-field-row="${escapeAttr(field.key)}">
        <td class="settings-nav-visible-cell bug-dialog-visible-cell">
          <label class="settings-nav-toggle" title="Show ${escapeAttr(field.label)}">
            <input type="checkbox" data-bug-tsg-visible="${escapeAttr(field.key)}" aria-label="Show ${escapeAttr(field.label)}" ${prefs.visible.includes(field.key) ? "checked" : ""}>
          </label>
        </td>
        <td>${escapeHtml(field.label)}</td>
        <td>
          <input type="text" data-bug-tsg-label="${escapeAttr(field.key)}" value="${escapeAttr(label)}" aria-label="${escapeAttr(`Display label for ${field.label}`)}">
        </td>
        <td class="action-cell">
          <button class="work-item-drag-handle settings-nav-drag-handle" type="button" data-drag-handle title="Drag ${escapeAttr(field.label)}" aria-label="Drag ${escapeAttr(field.label)}">
            <span aria-hidden="true">&#8942;&#8942;</span>
          </button>
        </td>
      </tr>
    `;
  }

  function bindBugTsgReportDrag(modal) {
    bugTsgReportDrag?.unbind();
    const list = modal.querySelector('tbody[data-reorder-list="bug-tsg-report-fields"]');
    if (!list) return;

    bugTsgReportDrag = createReorderDrag({
      root: list,
      containerSelector: 'tbody[data-reorder-list="bug-tsg-report-fields"]',
      itemSelector: "tr[data-bug-tsg-field-row]",
      getItemKey: item => item.dataset.bugTsgFieldRow || "",
      onDrop: ({ orderedKeys }) => {
        const draft = bugTsgReportPrefsFromDialog(modal);
        draft.order = orderedKeys;
        const prefs = normalizeBugDialogFieldPrefs(draft);
        writeBugTsgReportPrefs(prefs);
        renderBugTsgReportDialog(modal, prefs);
      }
    });
    bugTsgReportDrag.bind();
  }

  function handleBugTsgReportInput(modal, target) {
    if (target?.matches("[data-bug-tsg-filename]")) {
      writePreference(preferenceKeys.bugTsgReportFilename, target.value);
      return;
    }

    if (!target?.matches("[data-bug-tsg-label]")) return;

    writeBugTsgReportPrefs(bugTsgReportPrefsFromDialog(modal));
  }

  function handleBugTsgReportChange(modal, target) {
    if (!target?.matches("[data-bug-tsg-visible]")) return;

    if (!target.checked && !modal.querySelectorAll("[data-bug-tsg-visible]:checked").length) {
      target.checked = true;
      return;
    }

    writeBugTsgReportPrefs(bugTsgReportPrefsFromDialog(modal));
  }

  function resetBugTsgReportDialog(modal) {
    removePreference(preferenceKeys.bugTsgReportFields);
    renderBugTsgReportDialog(modal, readBugTsgReportPrefs());
    modal.querySelector("[data-bug-tsg-label]")?.focus({ preventScroll: true });
  }

  function exportBugTsgReport(modal, format) {
    const prefs = bugTsgReportPrefsFromDialog(modal);
    writeBugTsgReportPrefs(prefs);
    const rows = bugExportRows().map(bug => ({ task: bug }));
    const columns = bugTsgReportColumns(prefs);

    if (format === "xlsx") {
      downloadXlsx(bugTsgReportDownloadName(modal, "xlsx"), "Report", columns, rows);
      return;
    }

    downloadCsv(bugTsgReportDownloadName(modal, "csv"), columns, rows);
  }

  function readBugTsgReportPrefs() {
    const savedPreference = readPreference(preferenceKeys.bugTsgReportFields, "");
    if (savedPreference) return normalizeBugDialogFieldPrefs(readJsonPreference(preferenceKeys.bugTsgReportFields, {}));

    const prefs = normalizeBugDialogFieldPrefs(readBugDialogFieldPrefs());
    writeBugTsgReportPrefs(prefs);
    return prefs;
  }

  function writeBugTsgReportPrefs(prefs) {
    writeJsonPreference(preferenceKeys.bugTsgReportFields, normalizeBugDialogFieldPrefs(prefs));
  }

  function bugTsgReportPrefsFromDialog(modal) {
    const order = [...modal.querySelectorAll("[data-bug-tsg-field-row]")]
      .map(row => row.dataset.bugTsgFieldRow || "")
      .filter(Boolean);
    const visible = [...modal.querySelectorAll("[data-bug-tsg-visible]:checked")]
      .map(input => input.dataset.bugTsgVisible || "")
      .filter(Boolean);
    const labels = {};

    modal.querySelectorAll("[data-bug-tsg-label]").forEach(input => {
      labels[input.dataset.bugTsgLabel || ""] = input.value;
    });

    return normalizeBugDialogFieldPrefs({ order, visible, labels });
  }

  function bugTsgReportColumns(prefs) {
    const definitionsByKey = new Map(bugDialogFieldDefinitions().map(field => [field.key, field]));
    return prefs.order
      .filter(key => prefs.visible.includes(key))
      .map(key => {
        const definition = definitionsByKey.get(key);
        return {
          header: prefs.labels[key] || definition?.label || key,
          value: row => bugTsgReportValue(key, row.task)
        };
      });
  }

  function bugTsgReportValue(key, bug) {
    if (key === "projectId") return projectName(bug.projectId);
    if (key === "sprintId") return bugTableSprintLabel(bug);
    if (key === "title") return bug.title || "";
    if (key === "status") return bug.status || "";
    if (key === "priority") return bug.priority || "";
    if (key === "percentCompleted") return taskDisplayPercent(bug);
    if (key === "environment") return bug.environment || "";
    if (key === "severity") return bug.severity || "";
    if (key === "descriptionHtml") return richTextPlainText(bug.descriptionHtml);
    if (key === "url") return bug.url || "";
    if (key === "attachments") return bugAttachmentLabel(bug);
    if (key === "startDate") return formatDate(bug.startDate);
    if (key === "endDate") return formatDate(bug.endDate);
    if (key === "stepsToReproduceHtml") return richTextPlainText(bug.stepsToReproduceHtml);
    if (key === "actualResultHtml") return richTextPlainText(bug.actualResultHtml);
    if (key === "expectedResultHtml") return richTextPlainText(bug.expectedResultHtml);
    if (key === "rootCauseAnalysisHtml") return richTextPlainText(bug.rootCauseAnalysisHtml);
    if (key === "assigneeIds") return userNames(bug.assignees);
    if (key === "reporterIds") return userNames(bug.reporters);
    if (key === "dependencyTaskIds") return bugDependencyLabel(bug);
    return bug[key] ?? "";
  }

  function bugTsgReportFilenamePreference() {
    return readPreference(preferenceKeys.bugTsgReportFilename, "Report");
  }

  function bugTsgReportDownloadName(modal, extension) {
    const base = cleanBugTsgReportFilename(modal.querySelector("[data-bug-tsg-filename]")?.value || bugTsgReportFilenamePreference());
    return `${bugTsgReportDateStamp()} - ${base}.${extension}`;
  }

  function cleanBugTsgReportFilename(value) {
    const clean = String(value || "")
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return clean || "Report";
  }

  function bugTsgReportDateStamp() {
    const now = new Date();
    return `${now.getFullYear()}-${padTsgDatePart(now.getMonth() + 1)}-${padTsgDatePart(now.getDate())} ${padTsgDatePart(now.getHours())}${padTsgDatePart(now.getMinutes())}`;
  }

  function padTsgDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function richTextPlainText(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n");
    return (template.content.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function bugAttachmentLabel(bug) {
    return (bug.attachments || [])
      .map(attachment => attachment.fileName
        || attachment.originalFileName
        || attachment.originalName
        || attachment.displayName
        || attachment.name
        || attachment.url
        || attachment.path
        || "")
      .filter(Boolean)
      .join("; ");
  }

  function bugExportImportRows() {
    return bugExportRows().map(bug => ({ task: bug }));
  }

  function bugExportImportColumns(rows, options = {}) {
    const headers = {
      reporterHeader: bugRowsHaveMultipleUsers(rows.map(row => row.task), bug => bug.reporters) ? "Reporters" : "Reporter",
      assigneeHeader: bugRowsHaveMultipleUsers(rows.map(row => row.task), bug => bug.assignees) ? "Assignees" : "Assignee"
    };
    return [
      ...bugExportColumns(bugVisibleTableColumns(headers)).map(column => ({
        header: column.header,
        value: row => column.value(row.task)
      })),
      ...(options.includeMetadata ? workItemSystemColumns({
        nameHeader: "PMT Update Bug Name",
        itemTypeLabel: () => "Bug",
        percentValue: bug => taskDisplayPercent(bug),
        assigneeLabel: bug => userNames(bug.assignees)
      }) : [])
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
    const errors = [];
    let updatedRows = 0;
    let createdRows = 0;

    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      const rowNumber = index + 2;
      try {
        const result = await importBugRecord(record);
        if (result === "updated") updatedRows += 1;
        if (result === "created") createdRows += 1;
      } catch (error) {
        const bug = resolveBugImportTarget(record).matchedTask;
        errors.push({
          rowNumber,
          code: importFirstNonEmptyCell(record, "PMT Item Code", "Bug Code") || bug?.code || "",
          title: importFirstNonEmptyCell(record, "PMT Update Bug Name", "Bug Name") || bug?.title || "",
          message: error.message
        });
      }
    }

    if ((updatedRows || createdRows) && refreshAfterImport) await refreshAfterImport();
    showImportResultDialog({
      title: "Import Bug Tracking",
      totalRows: records.length,
      updatedRows,
      createdRows,
      errors
    });
  }

  async function importBugRecord(record) {
    const target = resolveBugImportTarget(record);
    const bug = target.task;

    if (bug) {
      const updates = bugImportValues(record, bug);
      if (!bugImportChanged(bug, updates)) return "";

      try {
        await saveJson(`/api/tasks/${bug.id}`, "PUT", bugImportPayload(bug, updates));
        return "updated";
      } catch {
        // If the original bug can no longer be updated, still import the data as a new bug.
      }
    }

    const createValues = bugImportValues(record, null);
    await saveJson("/api/tasks", "POST", bugImportPayload(null, createValues));
    return "created";
  }

  function resolveBugImportTarget(record) {
    return resolveImportWorkItem(record, state.tasks, {
      allowedTaskTypes: ["Bug"],
      codeHeaders: ["Bug Code", "Item Code"],
      titleHeaders: ["Bug Name", "PMT Update Bug Name", "PMT Update Item Name"],
      canUpdate: canUpdateImportedBug
    });
  }

  function bugImportValues(record, bug) {
    const context = bugImportContext(record, bug);
    const status = resolveImportLookupValue(importFirstNonEmptyCell(record, "Status", "PMT Update Status"), getStatuses(), bug?.status || context.status || "Todo");
    const requestedPercent = parseImportPercentOrDefault(record, bug ? taskDisplayPercent(bug) : 0, "% Complete");
    return {
      projectId: context.projectId,
      sprintId: context.sprintId,
      title: importFirstNonEmptyCell(record, "Bug Name", "PMT Update Bug Name", "PMT Update Item Name").trim() || bug?.title || "Imported Bug Report",
      status,
      priority: resolveImportLookupValue(importFirstNonEmptyCell(record, "Priority", "PMT Update Priority"), getPriorities(), bug?.priority || "Low"),
      percentCompleted: percentForStatus(status, requestedPercent),
      assigneeIds: bugImportAssigneeIds(record, bug, context),
      environment: resolveImportLookupValue(importFirstNonEmptyCell(record, "Environment", "PMT Update Environment"), getEnvironments(), bug?.environment || "SIT"),
      severity: resolveImportLookupValue(importFirstNonEmptyCell(record, "Severity", "PMT Update Severity"), getSeverities(), bug?.severity || "Minor")
    };
  }

  function bugImportContext(record, bug) {
    if (bug) return { projectId: bug.projectId, sprintId: bug.sprintId || null, status: bug.status || "Todo" };

    const fallback = bugImportFallbackContext();
    const projectId = resolveImportProjectId(record, state.projects, fallback.projectId);
    const sprintId = resolveImportSprintId(record, state.sprints, {
      projectId,
      fallbackSprintId: fallback.sprintId,
      isSprintAllowed: sprintAllowedForBugImport
    });
    return { projectId, sprintId, status: fallback.status || "Todo" };
  }

  function bugImportAssigneeIds(record, bug, context) {
    const project = state.projects.find(item => item.id === context.projectId);
    const sprint = context.sprintId ? state.sprints.find(item => item.id === context.sprintId) : null;
    const allowedIds = new Set(allowedAssigneeUsers(state.users, project, sprint).map(user => user.id));
    return resolveImportUserIds(record, state.users, {
      nameHeaders: ["Assignee", "Assignees", "Assigned"],
      fallbackIds: bug?.assigneeIds || [],
      defaultUserId: currentUserId,
      allowedIds
    });
  }

  function sprintAllowedForBugImport(sprint) {
    const user = currentUser();
    return user.isAdmin || user.role === "Admin" || !sprint.isFinished;
  }

  function canUpdateImportedBug(bug) {
    const user = currentUser();
    const isAdmin = user.isAdmin || user.role === "Admin";
    const sprint = bug.sprintId ? state.sprints.find(item => item.id === bug.sprintId) : null;
    return (isAdmin || bug.createdByUserId === user.id)
      && (isAdmin || !sprint?.isFinished);
  }

  function bugImportChanged(bug, updates) {
    return bug.title !== updates.title
      || bug.status !== updates.status
      || bug.priority !== updates.priority
      || bug.environment !== updates.environment
      || bug.severity !== updates.severity
      || Number(bug.percentCompleted || 0) !== Number(updates.percentCompleted || 0)
      || !sameNumberList(bug.assigneeIds || [], updates.assigneeIds || []);
  }

  function bugImportPayload(bug, updates) {
    return {
      id: bug?.id || 0,
      projectId: bug?.projectId || updates.projectId,
      sprintId: bug ? bug.sprintId || null : updates.sprintId || null,
      parentTaskId: null,
      taskType: "Bug",
      title: updates.title,
      descriptionHtml: bug?.descriptionHtml || "<p>Imported from PMT grid import.</p>",
      stepsToReproduceHtml: bug?.stepsToReproduceHtml || "",
      actualResultHtml: bug?.actualResultHtml || "",
      expectedResultHtml: bug?.expectedResultHtml || "",
      rootCauseAnalysisHtml: bug?.rootCauseAnalysisHtml || "",
      environment: updates.environment || bug?.environment || "SIT",
      severity: updates.severity || bug?.severity || "Minor",
      status: updates.status,
      priority: updates.priority,
      percentCompleted: updates.percentCompleted,
      url: bug?.url || "",
      startDate: bug?.startDate || null,
      endDate: bug?.endDate || null,
      reporterIds: bug ? bug.reporterIds || [] : reporterIdsOrDefault([], currentUserId),
      assigneeIds: updates.assigneeIds,
      dependencyTaskIds: bug ? bug.dependencyTaskIds || [] : [],
      auditContext: "Import"
    };
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
    const mix = bugMixChart(filteredBugs);
    const resolvedBugs = mix.resolvedBugs;
    const openBugs = mix.openBugs;

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
    const items = bugSeverityChartItems(filteredBugs, getSeverities(), bugSeverityColor)
      .map(item => bugChartGroupedItem(
        item.label,
        item.bugs,
        item.color,
        `${item.label}: ${item.value} bug report${item.value === 1 ? "" : "s"}`
      ));

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
    return sharedBugSprintChartRows(filteredBugs, sprintChartLabel, sprintById, getItemStartDate);
  }

  function newestBugSprintRows(sprintRows) {
    return sharedNewestBugSprintRows(sprintRows, sprintById, getItemStartDate);
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
    return bugSeverityChartColor(severity);
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
