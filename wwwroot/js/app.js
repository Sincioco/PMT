import { api } from "./core/api.js";
import { avatarsHtml, taskRowAvatarsHtml } from "./components/avatars.js";
import { buttonContent, iconButton } from "./components/buttons.js";
import { askForText, askYesNo } from "./components/dialogs.js";
import {
  field,
  value
} from "./components/forms.js";
import {
  configureProgressAndStatus,
  statusColor
} from "./components/progress-and-status.js";
import { sectionHead } from "./components/sections.js";
import {
  bindAttachmentPreview,
  showTaskAudit,
  viewWorkItem
} from "./components/work-items.js";
import { createApplicationShell } from "./core/application-shell.js";
import {
  preferenceKeys,
  readBooleanPreference,
  readNumberPreference,
  readPreference,
  writePreference
} from "./core/preferences.js";
import {
  currentView,
  navigate
} from "./core/router.js";
import {
  registeredScreenHandlers,
  registerScreen,
  screenHandlerFor
} from "./core/screen-registry.js";
import { state } from "./core/store.js";
import { createBacklogFeature } from "./features/backlog/backlog.js";
import { createBoardFeature } from "./features/board/board.js";
import { createBugsFeature } from "./features/bugs/bugs.js";
import { createDashboardFeature } from "./features/dashboard/dashboard.js";
import { createDocumentationFeature } from "./features/documentation/documentation.js";
import { createProjectsFeature } from "./features/projects/projects.js";
import { createScrumFeature } from "./features/scrum/scrum.js";
import { createSettingsFeature } from "./features/settings/settings.js";
import { createSprintsFeature } from "./features/sprints/sprints.js";
import { createTasksFeature } from "./features/tasks/tasks.js";
import {
  fallbackEnvironments,
  fallbackForLookup,
  fallbackPriorities,
  fallbackSeverities,
  fallbackStatuses
} from "./shared/constants.js";
import {
  dateKey,
  dateRange,
  dateRangeLabel,
  formatDate,
  monthName,
  normalizeDate
} from "./shared/dates.js";
import { canEditTask } from "./shared/permissions.js";
import {
  projectById,
  projectCode,
  projectName,
  sprintById,
  sprintName,
  taskById
} from "./shared/selectors.js";
import {
  escapeAttr,
  escapeHtml,
  linkifyTextNodes,
  normalizeLinksInElement,
  normalizeUrl
} from "./shared/text-and-links.js";
import {
  bugsForTask,
  configureWorkItemRules,
  isBugQaPassedOrLater,
  isTaskCompleted,
  percentForStatus,
  sprintOverallPercent,
  taskDisplayPercent,
  taskOrderCompare
} from "./shared/work-item-rules.js";
let statuses = [...fallbackStatuses];
let priorities = [...fallbackPriorities];
let severities = [...fallbackSeverities];
let environments = [...fallbackEnvironments];
let roadMapProjectFilter = readPreference(preferenceKeys.roadMapProject, "all");
let roadMapSprintFilter = readPreference(preferenceKeys.roadMapSprint, "all");
let roadMapSort = readPreference(preferenceKeys.roadMapSort, "endAsc");
let roadMapShowDates = readBooleanPreference(preferenceKeys.roadMapShowDates, true);
let roadMapShowDetails = readBooleanPreference(preferenceKeys.roadMapShowDetails, true);
let roadMapShowSprints = readBooleanPreference(preferenceKeys.roadMapShowSprints, true);
let ganttProjectId = readNumberPreference(preferenceKeys.ganttProject, 0);
let ganttSprintMode = readPreference(preferenceKeys.ganttSprint, "current");
let ganttRenderMode = readPreference(preferenceKeys.ganttRenderMode, "all");
let ganttSort = readPreference(preferenceKeys.ganttSort, "startAsc");
let ganttShowNonWorkingDays = readBooleanPreference(preferenceKeys.ganttShowNonWorkingDays, false);
let ganttShowAllBugs = false;
let ganttExpandedBugTaskIds = new Set();
let ganttLastChart = null;
let ganttFlyByFrameId = 0;
let ganttFlyByTimeoutId = 0;
let ganttFlyByRunId = 0;
let ganttPendingFlyBy = false;
let ganttFlyByActive = false;
let ganttFlyByAnimating = false;
let ganttFlyByStopRequested = false;
let ganttFlyByResumeSprintId = 0;
let ganttFlyByCurrentSprintId = 0;
let pointerDrag = null;
let lastPointerDragEventAt = 0;
let suppressNextClick = false;
let pageEventsBound = false;
let chartTooltip = null;
let boardFeature = null;

configureWorkItemRules({
  getStatuses: () => statuses,
  getTasks: () => state.tasks
});
configureProgressAndStatus({
  getStatuses: () => statuses,
  getLookups: () => state.lookups,
  getTasks: () => state.tasks
});

const shell = createApplicationShell({
  bindScreenEvents,
  editPassword,
  refreshLookupOptions,
  renderCurrentScreen,
  showToast
});

const {
  app,
  dialog,
  dialogTitle,
  dialogBody,
  editorForm,
  toast
} = shell.elements;

boardFeature = createBoardFeature({
  app,
  getStatuses: () => statuses,
  loadState,
  render,
  saveJson,
  showToast
});
const projectsFeature = createProjectsFeature({
  app,
  deleteItem,
  openEditor,
  openProjectGantt: viewProjectGantt,
  openSprintsForProject: viewProjectSprints,
  render,
  saveJson,
  uploadFile
});
const sprintsFeature = createSprintsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  openSprintTasks: viewSprintTasks,
  render,
  saveJson,
  showToast
});
const settingsFeature = createSettingsFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast,
  uploadFile
});
const tasksFeature = createTasksFeature({
  app,
  attachFile,
  deleteItem,
  duplicateTask,
  getBoardProjectId: boardFeature.getProjectId,
  getBoardSprintId: boardFeature.getSprintId,
  getCurrentSprint: currentSprintForProject,
  getItemStartDate: ganttStartDate,
  getLookupOptions: lookupOptionsWithCurrent,
  getPriorities: () => priorities,
  getStatuses: () => statuses,
  openEditor,
  saveJson
});
const bugsFeature = createBugsFeature({
  app,
  attachFile,
  deleteItem,
  duplicateTask,
  getBoardProjectId: boardFeature.getProjectId,
  getBoardSprintId: boardFeature.getSprintId,
  getCurrentSprint: currentSprintForProject,
  getEnvironments: () => environments,
  getItemStartDate: ganttStartDate,
  getLookupOptions: lookupOptionsWithCurrent,
  getPriorities: () => priorities,
  getSeverities: () => severities,
  getStatuses: () => statuses,
  getTaskContext: tasksFeature.getContext,
  openEditor,
  saveJson
});
const backlogFeature = createBacklogFeature({ app });
const dashboardFeature = createDashboardFeature({
  app,
  isProjectCollapsed: projectsFeature.isCollapsed,
  openSprintTasks: viewSprintTasks,
  openTaskReadMode,
  projectCardHtml: projectsFeature.cardHtml
});
const scrumFeature = createScrumFeature({
  app,
  deleteItem,
  loadState,
  openEditor,
  render,
  saveJson,
  showToast
});
const documentationFeature = createDocumentationFeature({
  app,
  attachFile,
  deleteItem,
  openEditor,
  saveJson
});

registerScreen("Dashboard", dashboardFeature);
registerScreen("Board", boardFeature);
registerScreen("Projects", projectsFeature);
registerScreen("Sprints", sprintsFeature);
registerScreen("Settings", settingsFeature);
registerScreen("Tasks", tasksFeature);
registerScreen("Bugs", bugsFeature);
registerScreen("Backlog", backlogFeature);
registerScreen("Scrum", scrumFeature);
registerScreen("Documentation", documentationFeature);

document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelDialog").addEventListener("click", () => dialog.close());

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", shell.initialize);
} else {
  shell.initialize();
}

function bindScreenEvents() {
  if (pageEventsBound) return;
  pageEventsBound = true;

  app.addEventListener("click", handleActionClick);
  app.addEventListener("change", handleFilterChange);
  app.addEventListener("mousemove", handleChartTooltip);
  app.addEventListener("mouseleave", hideChartTooltip);
  app.addEventListener("pointerdown", handlePointerDown);
  app.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("pointerup", handlePointerUp);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("pointercancel", cancelPointerDrag);
  document.addEventListener("click", handleDocumentLinkClick);
}

async function loadState() {
  return shell.reloadState();
}

function render() {
  shell.render();
}

function renderCurrentScreen() {
  if (currentView !== "Board") boardFeature.deactivate();
  const registeredScreen = screenHandlerFor(currentView);
  if (registeredScreen?.render) registeredScreen.render();
  else if (currentView === "Road Map") renderRoadMap();
  else if (currentView === "Gantt") renderGantt();
  linkifyTextNodes(app);
  normalizeLinksInElement(app);
}

function renderGantt(options = {}) {
  if (!ganttPendingFlyBy && !options.skipStopFlyBy) stopGanttFlyBy();

  if (!ganttProjectId && state.projects.length) ganttProjectId = state.projects[0].id;
  if (!state.projects.some(project => project.id === ganttProjectId) && state.projects.length) ganttProjectId = state.projects[0].id;

  const project = projectById(ganttProjectId) || state.projects[0];
  const projectSprints = sortGanttSprints(state.sprints.filter(sprint => sprint.projectId === project?.id));
  if (ganttSprintMode === "all") {
    ganttRenderMode = "all";
    writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
  }
  if (ganttSprintMode !== "all" && ganttSprintMode !== "current" && !projectSprints.some(sprint => sprint.id === Number(ganttSprintMode))) {
    ganttSprintMode = "current";
    writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
  }

  const selectedSprint = selectedGanttSprint(projectSprints);
  const sprintOptions = sortGanttSprintOptions(projectSprints);
  const visibleSprints = ganttRenderMode === "selected" && selectedSprint ? [selectedSprint] : projectSprints;
  const scrollSprint = selectedSprint || currentSprintForProject(projectSprints);
  const singleSprint = ganttRenderMode === "selected" ? selectedSprint : null;
  const chart = ganttChartData(project, visibleSprints, singleSprint, scrollSprint, ganttShowNonWorkingDays);
  ganttLastChart = chart;

  app.innerHTML = `
    ${sectionHead("Gantt", `
      <button class="secondary text-icon-button" type="button" data-action="toggle-gantt-all-bugs">${buttonContent(ganttShowAllBugs ? "&#9652;" : "&#9662;", ganttShowAllBugs ? "Collapse Bugs" : "Expand Bugs")}</button>
    `)}
    <div class="panel">
      <div class="filter-row">
        <label>
          <span>Project</span>
          <select data-filter="gantt-project">
            ${state.projects.map(item => `<option value="${item.id}" ${item.id === ganttProjectId ? "selected" : ""}>${escapeHtml(item.code)} - ${escapeHtml(item.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="gantt-sprint">
            <option value="current" ${ganttSprintMode === "current" ? "selected" : ""}>Current Sprint</option>
            <option value="all" ${ganttSprintMode === "all" ? "selected" : ""}>All Sprints</option>
            ${sprintOptions.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(ganttSprintMode) ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="gantt-sort">
            <option value="startAsc" ${ganttSort === "startAsc" ? "selected" : ""}>Start date ascending</option>
            <option value="startDesc" ${ganttSort === "startDesc" ? "selected" : ""}>Start date descending</option>
          </select>
        </label>
        <div class="roadmap-filter-actions gantt-filter-actions">
          <button class="icon-action ${ganttRenderMode === "selected" ? "is-on" : ""}" type="button" data-action="toggle-gantt-render-mode" title="${ganttRenderMode === "selected" ? "Show All Sprints" : "Show Selected Sprint Only"}" aria-label="${ganttRenderMode === "selected" ? "Show All Sprints" : "Show Selected Sprint Only"}" aria-pressed="${ganttRenderMode === "selected"}">${ganttRenderMode === "selected" ? "&#9638;" : "&#9673;"}</button>
          <button class="icon-action ${ganttShowNonWorkingDays ? "is-on" : ""}" type="button" data-action="toggle-gantt-days" title="${ganttShowNonWorkingDays ? "Hide weekends and holidays" : "Show weekends and holidays"}" aria-label="${ganttShowNonWorkingDays ? "Hide weekends and holidays" : "Show weekends and holidays"}" aria-pressed="${ganttShowNonWorkingDays}">&#128197;</button>
          <button class="icon-action ${ganttFlyByActive ? "is-on" : ""}" type="button" data-action="gantt-flyby" title="${ganttFlyByButtonTitle()}" aria-label="${ganttFlyByButtonTitle()}" aria-pressed="${ganttFlyByActive}">${ganttFlyByButtonIcon()}</button>
          <button class="icon-action" type="button" data-action="reset-gantt-view" title="Reset Gantt view" aria-label="Reset Gantt view">&#8634;</button>
        </div>
        <span class="muted gantt-note">${ganttShowNonWorkingDays ? "Weekends and configured holidays are visible." : "Weekends and configured holidays are hidden unless work starts on that date."}</span>
      </div>
    </div>
    ${chart.dates.length ? ganttChartHtml(chart) : `<div class="empty">No scheduled items for this project yet.</div>`}
  `;

  if (options.restoreScroll) {
    restoreGanttScroll(options.restoreScroll);
  } else {
    scrollGanttToSprintStart(chart, scrollSprint);
  }
  if (ganttPendingFlyBy) {
    ganttPendingFlyBy = false;
    const flyByRunId = ++ganttFlyByRunId;
    requestAnimationFrame(() => {
      if (flyByRunId !== ganttFlyByRunId) return;
      const startingSprint = ganttFlyByStartingSprint(chart.sprints);
      scrollGanttToSprint(chart, startingSprint);
      requestAnimationFrame(() => startGanttFlyBy(chart, flyByRunId));
    });
  }
}

function renderRoadMap() {
  const sprintOptions = roadMapSprintOptions();
  if (roadMapSprintFilter !== "all" && !sprintOptions.some(sprint => String(sprint.id) === String(roadMapSprintFilter))) {
    roadMapSprintFilter = "all";
    writePreference(preferenceKeys.roadMapSprint, roadMapSprintFilter);
  }

  const filteredProjects = roadMapProjects();
  const chart = roadMapChartData(filteredProjects);

  app.innerHTML = `
    ${sectionHead("Road Map", "")}
    <div class="panel">
      <div class="filter-row">
        <label>
          <span>Project</span>
          <select data-filter="roadmap-project">
            <option value="all" ${roadMapProjectFilter === "all" ? "selected" : ""}>All projects</option>
            ${state.projects.map(project => `<option value="${project.id}" ${String(project.id) === String(roadMapProjectFilter) ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="roadmap-sprint" ${roadMapShowSprints ? "" : "disabled"}>
            <option value="all" ${roadMapSprintFilter === "all" ? "selected" : ""}>All Sprints</option>
            ${sprintOptions.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(roadMapSprintFilter) ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="roadmap-sort">
            <option value="endAsc" ${roadMapSort === "endAsc" ? "selected" : ""}>End date ascending</option>
            <option value="endDesc" ${roadMapSort === "endDesc" ? "selected" : ""}>End date descending</option>
            <option value="startAsc" ${roadMapSort === "startAsc" ? "selected" : ""}>Start date ascending</option>
            <option value="startDesc" ${roadMapSort === "startDesc" ? "selected" : ""}>Start date descending</option>
          </select>
        </label>
        <div class="roadmap-filter-actions">
          <button class="secondary text-icon-button" type="button" data-action="toggle-roadmap-sprints">${buttonContent(roadMapShowSprints ? "&#8722;" : "&#43;", roadMapShowSprints ? "Hide Sprints" : "Show Sprints")}</button>
          <button class="icon-action ${roadMapShowDates ? "is-on" : ""}" type="button" data-action="toggle-roadmap-dates" title="${roadMapShowDates ? "Hide start/end dates" : "Show start/end dates"}" aria-pressed="${roadMapShowDates}">&#128197;</button>
          <button class="icon-action ${roadMapShowDetails ? "is-on" : ""}" type="button" data-action="toggle-roadmap-details" title="${roadMapShowDetails ? "Hide avatars and percent text" : "Show avatars and percent text"}" aria-pressed="${roadMapShowDetails}">%</button>
        </div>
      </div>
    </div>
    ${chart.dates.length ? roadMapChartHtml(chart) : `<div class="empty">No Project or Sprint dates are available yet.</div>`}
  `;
}

async function handleActionClick(event) {
  if (suppressNextClick) {
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  if (event.target.closest("a")) return;

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = Number(button.dataset.id || 0);
  const action = button.dataset.action;

  if (handleChartAction(button)) return;

  for (const screen of registeredScreenHandlers()) {
    if (screen.handleAction && await screen.handleAction(action, id, button)) return;
  }

  if (action === "goto-task") gotoTask(id);
  if (action === "gantt-open-task") openGanttTask(id);
  if (action === "view-project-gantt") viewProjectGantt(id);
  if (action === "toggle-roadmap-dates") toggleRoadMapDates();
  if (action === "toggle-roadmap-details") toggleRoadMapDetails();
  if (action === "toggle-roadmap-sprints") toggleRoadMapSprints();
  if (action === "toggle-gantt-all-bugs") toggleGanttAllBugs();
  if (action === "toggle-gantt-render-mode") toggleGanttRenderMode();
  if (action === "toggle-gantt-days") toggleGanttDays();
  if (action === "gantt-flyby") flyByGantt();
  if (action === "reset-gantt-view") resetGanttView();
  if (action === "toggle-gantt-task-bugs") {
    event.preventDefault();
    event.stopPropagation();
    toggleGanttTaskBugs(id);
    return;
  }
}

function handleChartAction(element, dialogToClose = null) {
  const action = element.dataset.action;
  if (action === "expand-visual-chart") {
    expandVisualChartCard(element.closest(".visual-chart-card"));
    return true;
  }

  if (action === "chart-open-sprint") {
    closeTransientDialog(dialogToClose);
    viewSprintSummary(sprintById(Number(element.dataset.id || 0)));
    return true;
  }

  if (action === "chart-drill-bugs") {
    closeTransientDialog(dialogToClose);
    const bugIds = splitChartIds(element.dataset.ids);
    showBugChartDrilldown(element.dataset.chartTitle || "Bugs", bugIds);
    return true;
  }

  if (action === "chart-drill-tasks") {
    closeTransientDialog(dialogToClose);
    const taskIds = splitChartIds(element.dataset.ids);
    showTaskChartDrilldown(element.dataset.chartTitle || "Dev Tasks", taskIds);
    return true;
  }

  if (action === "view-task") {
    closeTransientDialog(dialogToClose);
    viewWorkItem(taskById(Number(element.dataset.id || 0)), editWorkItem);
    return true;
  }

  return false;
}

function splitChartIds(value) {
  return String(value || "")
    .split(",")
    .map(id => Number(id))
    .filter(id => id > 0);
}

function closeTransientDialog(modal) {
  if (!modal) return;
  hideChartTooltip();
  if (modal.open) modal.close();
  modal.remove();
}

function showBugChartDrilldown(title, bugIds) {
  const bugs = bugIds
    .map(id => taskById(id))
    .filter(Boolean)
    .sort(taskOrderCompare);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog chart-drill-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)} Bugs</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      ${bugs.length ? `
        <table class="table chart-drill-table">
          <thead>
            <tr>
              <th>Bug Report</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Assignee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${bugs.map(bug => `
              <tr>
                <td><b>${escapeHtml(bug.code)}</b><br><span>${escapeHtml(bug.title)}</span></td>
                <td>${escapeHtml(projectCode(bug.projectId))}</td>
                <td>${escapeHtml(sprintName(bug.sprintId))}</td>
                <td><span class="pill">${escapeHtml(bug.status)}</span></td>
                <td>${escapeHtml(bug.severity || "")}</td>
                <td>${avatarsHtml(bug.assignees)}</td>
                <td class="actions-cell">
                  <button class="icon-action" type="button" data-action="view-task" data-id="${bug.id}" title="View Bug Report">&#128065;</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty compact-empty">No bugs were found for this chart segment.</div>`}
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) {
      closeTransientDialog(modal);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    // Keep the drilldown list open so the user can view more than one item.
    if (actionElement.dataset.action === "view-task") {
      handleChartAction(actionElement);
      return;
    }

    handleChartAction(actionElement, modal);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
}

function showTaskChartDrilldown(title, taskIds) {
  const tasks = taskIds
    .map(id => taskById(id))
    .filter(Boolean)
    .sort(taskOrderCompare);

  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog chart-drill-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)} Dev Tasks</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">
      ${tasks.length ? `
        <table class="table chart-drill-table">
          <thead>
            <tr>
              <th>Dev Task</th>
              <th>Project</th>
              <th>Sprint</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assignee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(task => `
              <tr>
                <td><b>${escapeHtml(task.code)}</b><br><span>${escapeHtml(task.title)}</span></td>
                <td>${escapeHtml(projectCode(task.projectId))}</td>
                <td>${escapeHtml(sprintName(task.sprintId))}</td>
                <td><span class="pill">${escapeHtml(task.status)}</span></td>
                <td><span class="pill priority-${escapeAttr(task.priority)}">${escapeHtml(task.priority)}</span></td>
                <td>${taskRowAvatarsHtml(task.assignees)}</td>
                <td class="actions-cell">
                  <button class="icon-action" type="button" data-action="view-task" data-id="${task.id}" title="View Dev Task">&#128065;</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : `<div class="empty compact-empty">No Dev Tasks were found for this chart segment.</div>`}
    </div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) {
      closeTransientDialog(modal);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;

    // Keep the drilldown list open so the user can view more than one item.
    if (actionElement.dataset.action === "view-task") {
      handleChartAction(actionElement);
      return;
    }

    handleChartAction(actionElement, modal);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
}

function expandVisualChartCard(card) {
  if (!card) return;

  const title = card.querySelector(".chart-card-head h2")?.textContent || "Chart";
  const chartCopy = card.cloneNode(true);
  chartCopy.classList.add("chart-expanded-card");
  chartCopy.querySelector("[data-action='expand-visual-chart']")?.remove();

  const modal = document.createElement("dialog");
  modal.className = "dialog chart-expanded-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body chart-expanded-body"></div>
  `;

  modal.querySelector(".chart-expanded-body").appendChild(chartCopy);
  document.body.appendChild(modal);
  modal.addEventListener("mousemove", handleChartTooltip);
  modal.addEventListener("mouseleave", hideChartTooltip);
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close]")) {
      closeTransientDialog(modal);
      return;
    }

    const actionElement = event.target.closest("[data-action]");
    if (actionElement) handleChartAction(actionElement, modal);
  });
  modal.addEventListener("cancel", () => {
    hideChartTooltip();
    modal.remove();
  });
  modal.showModal();
}

function handleFilterChange(event) {
  const target = event.target;
  for (const screen of registeredScreenHandlers()) {
    if (screen.handleFilterChange && screen.handleFilterChange(target)) return;
  }

  if (target.dataset.filter === "roadmap-project") {
    roadMapProjectFilter = target.value;
    roadMapSprintFilter = "all";
    writePreference(preferenceKeys.roadMapProject, roadMapProjectFilter);
    writePreference(preferenceKeys.roadMapSprint, roadMapSprintFilter);
    renderRoadMap();
  }
  if (target.dataset.filter === "roadmap-sprint") {
    roadMapSprintFilter = target.value;
    writePreference(preferenceKeys.roadMapSprint, roadMapSprintFilter);
    renderRoadMap();
  }
  if (target.dataset.filter === "roadmap-sort") {
    roadMapSort = target.value;
    writePreference(preferenceKeys.roadMapSort, roadMapSort);
    renderRoadMap();
  }
  if (target.dataset.filter === "gantt-project") {
    ganttProjectId = Number(target.value);
    ganttSprintMode = "current";
    writePreference(preferenceKeys.ganttProject, ganttProjectId);
    writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
    ganttExpandedBugTaskIds.clear();
    renderGantt();
  }
  if (target.dataset.filter === "gantt-sprint") {
    ganttSprintMode = target.value;
    if (ganttSprintMode === "all") {
      ganttRenderMode = "all";
      writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
    }
    writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
    ganttExpandedBugTaskIds.clear();
    renderGantt();
  }
  if (target.dataset.filter === "gantt-sort") {
    ganttSort = target.value;
    writePreference(preferenceKeys.ganttSort, ganttSort);
    renderGantt();
  }
}

function handleChartTooltip(event) {
  const target = event.target.closest("[data-chart-tooltip]");
  if (!target) {
    hideChartTooltip();
    return;
  }

  if (!chartTooltip) {
    chartTooltip = document.createElement("div");
    chartTooltip.className = "chart-tooltip";
    document.body.appendChild(chartTooltip);
  }

  chartTooltip.textContent = target.dataset.chartTooltip || "";
  chartTooltip.hidden = false;

  // Keep the tooltip near the pointer but inside the viewport.
  const tooltipWidth = chartTooltip.offsetWidth || 180;
  const tooltipHeight = chartTooltip.offsetHeight || 36;
  const left = Math.min(window.innerWidth - tooltipWidth - 12, event.clientX + 14);
  const top = Math.min(window.innerHeight - tooltipHeight - 12, event.clientY + 14);
  chartTooltip.style.left = `${Math.max(12, left)}px`;
  chartTooltip.style.top = `${Math.max(12, top)}px`;
}

function hideChartTooltip() {
  if (chartTooltip) chartTooltip.hidden = true;
}

function handleDocumentLinkClick(event) {
  const link = event.target.closest("a[href]");
  if (!link) return;

  link.target = "_blank";
  link.rel = "noopener noreferrer";
}

function handlePointerDown(event) {
  lastPointerDragEventAt = Date.now();
  startTaskDrag(event, "pointer");
}

function handleMouseDown(event) {
  if (Date.now() - lastPointerDragEventAt < 500) return;
  startTaskDrag(event, "mouse");
}

function startTaskDrag(event, inputType) {
  if (event.button !== 0) return;
  if (event.target.closest("button, a, input, select, textarea")) return;

  const item = event.target.closest('tr[data-task-id][data-can-drag="true"]');
  const container = item?.closest('[data-reorder-list="tasks"], [data-reorder-list="backlog"]');
  if (!item || !container) return;

  pointerDrag = {
    taskId: Number(item.dataset.taskId || 0),
    source: item,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    inputType,
    pointerId: event.pointerId
  };

  // Keep the final pointerup tied to this card even when the user releases near the edge of the viewport.
  if (inputType === "pointer" && item.setPointerCapture && event.pointerId !== undefined) {
    try {
      item.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a nice-to-have; the window mouseup fallback still finishes the drag.
    }
  }
}

function handlePointerMove(event) {
  lastPointerDragEventAt = Date.now();
  moveTaskDrag(event);
}

function handleMouseMove(event) {
  if (pointerDrag?.inputType === "pointer") return;
  moveTaskDrag(event);
}

function moveTaskDrag(event) {
  if (!pointerDrag) return;

  const movedEnough = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) > 5;
  if (!pointerDrag.started && !movedEnough) return;

  if (!pointerDrag.started) {
    pointerDrag.started = true;
    suppressNextClick = true;
    pointerDrag.source.classList.add("dragging");
  }

  event.preventDefault();
  updateDropIndicator(event.clientX, event.clientY, pointerDrag.taskId);
}

async function handlePointerUp(event) {
  lastPointerDragEventAt = Date.now();
  await finishTaskDrag(event);
}

async function handleMouseUp(event) {
  if (pointerDrag?.inputType === "pointer") return;
  await finishTaskDrag(event);
}

async function finishTaskDrag(event) {
  if (!pointerDrag) return;
  if (pointerDrag.finishing) return;
  pointerDrag.finishing = true;

  const drag = pointerDrag;
  if (!drag.started) {
    cancelPointerDrag();
    return;
  }

  event.preventDefault();
  suppressNextClick = true;

  const drop = pointerDropTarget(event.clientX, event.clientY, drag.taskId);
  const task = taskById(drag.taskId);
  if (!drop || !task || !canEditTask(task)) {
    cancelPointerDrag();
    return;
  }

  const taskIds = taskIdsAfterDrop(drop.container, drag.taskId, drop.target, event.clientY);

  try {
    if (taskIds.length > 1) {
      await saveJson("/api/tasks/reorder", "POST", { taskIds });
    }

    if (drop.container.dataset.reorderList === "tasks") {
      tasksFeature.useCustomSort();
    }

    await loadState();
    render();
    showToast("Order saved.");
  } catch (error) {
    showToast(error.message);
  } finally {
    cancelPointerDrag();
  }
}

function pointerDropTarget(clientX, clientY, taskId) {
  const elements = document.elementsFromPoint(clientX, clientY);
  const container = elements
    .map(item => item.closest?.('[data-reorder-list="tasks"], [data-reorder-list="backlog"]'))
    .find(Boolean);

  if (!container) return null;

  const target = elements
    .map(item => item.closest?.("[data-task-id]"))
    .find(item => item && container.contains(item) && Number(item.dataset.taskId) !== taskId) || null;

  return { container, target };
}

function updateDropIndicator(clientX, clientY, taskId) {
  clearDropIndicators();

  const drop = pointerDropTarget(clientX, clientY, taskId);
  if (!drop) return;

  drop.container.classList.add("drop-target");

  if (drop.target) {
    drop.target.classList.add(dropPlacement(drop.target, clientY) === "after" ? "reorder-after" : "reorder-before");
    return;
  }

  const items = [...drop.container.querySelectorAll("[data-task-id]")]
    .filter(item => Number(item.dataset.taskId) !== taskId);
  items[items.length - 1]?.classList.add("reorder-after");
}

function dropPlacement(targetElement, clientY) {
  const targetRect = targetElement.getBoundingClientRect();
  return clientY > targetRect.top + (targetRect.height / 2) ? "after" : "before";
}

function taskIdsAfterDrop(container, draggedTaskId, targetElement, clientY) {
  const taskIds = [...container.querySelectorAll("[data-task-id]")]
    .map(item => Number(item.dataset.taskId))
    .filter(Boolean)
    .filter(id => id !== draggedTaskId);

  if (!targetElement) return [...taskIds, draggedTaskId];

  const targetTaskId = Number(targetElement.dataset.taskId);
  let insertIndex = taskIds.indexOf(targetTaskId);
  if (insertIndex < 0) return [...taskIds, draggedTaskId];

  const targetRect = targetElement.getBoundingClientRect();
  if (clientY > targetRect.top + (targetRect.height / 2)) insertIndex += 1;

  taskIds.splice(insertIndex, 0, draggedTaskId);
  return taskIds;
}

function cancelPointerDrag() {
  if (pointerDrag?.inputType === "pointer" && pointerDrag.source.releasePointerCapture && pointerDrag.pointerId !== undefined) {
    try {
      pointerDrag.source.releasePointerCapture(pointerDrag.pointerId);
    } catch {
      // The browser may have already released capture after pointerup/cancel.
    }
  }

  pointerDrag = null;
  clearDragStyles();
}

function clearDropIndicators() {
  document.querySelectorAll(".drop-target, .reorder-target, .reorder-before, .reorder-after")
    .forEach(item => item.classList.remove("drop-target", "reorder-target", "reorder-before", "reorder-after"));
}

function clearDragStyles() {
  document.querySelectorAll(".dragging")
    .forEach(item => item.classList.remove("dragging"));
  clearDropIndicators();
}

function viewSprintSummary(sprint) {
  if (!sprint) return;

  const tasks = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType !== "Bug" && !task.parentTaskId);
  const bugs = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType === "Bug");
  const resolvedBugs = bugs.filter(isBugQaPassedOrLater);
  const openBugs = bugs.filter(bug => !isBugQaPassedOrLater(bug));
  const bugLinks = bugs
    .sort(taskOrderCompare)
    .map(bug => `<button type="button" data-action="view-task-inline" data-id="${bug.id}">${escapeHtml(bug.code)} - ${escapeHtml(bug.title)}</button>`)
    .join("");

  showReadOnlyDialog(`Sprint ${sprint.code}`, `
    <div class="detail-grid">
      ${detailField("Title", escapeHtml(sprint.title))}
      ${detailField("Project", escapeHtml(projectName(sprint.projectId)))}
      ${detailField("Dates", escapeHtml(`${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}`))}
      ${detailField("Overall Progress", `${sprintOverallPercent(sprint)}%`)}
      ${detailField("Dev Tasks", String(tasks.length))}
      ${detailField("Bugs", `${bugs.length} total, ${resolvedBugs.length} resolved, ${openBugs.length} open`)}
      ${bugs.length ? detailField("Bugs", `<div class="inline-link-list">${bugLinks}</div>`, true) : ""}
    </div>
  `);
}

function showReadOnlyDialog(title, html) {
  const modal = document.createElement("dialog");
  modal.className = "dialog detail-dialog";
  modal.innerHTML = `
    <div class="dialog-head">
      <h2>${escapeHtml(title)}</h2>
      <button type="button" class="icon-btn" data-close title="Close">x</button>
    </div>
    <div class="dialog-body">${html}</div>
    <div class="dialog-actions">
      <button type="button" class="primary text-icon-button" data-close>${buttonContent("&#10003;", "Close")}</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    modal.close();
    modal.remove();
  }));
  modal.addEventListener("click", event => {
    const inlineButton = event.target.closest("[data-action='view-task-inline']");
    if (!inlineButton) return;
    modal.close();
    modal.remove();
    viewWorkItem(taskById(Number(inlineButton.dataset.id)), editWorkItem);
  });
  modal.addEventListener("cancel", () => modal.remove());
  modal.showModal();
  normalizeLinksInElement(modal);
}

function detailField(label, html, full = false) {
  return `
    <div class="detail-field ${full ? "full" : ""}">
      <span>${escapeHtml(label)}</span>
      <div>${html || `<span class="muted">None</span>`}</div>
    </div>
  `;
}

function editPassword() {
  openEditor("Change Password", `
    <div class="form-grid">
      ${field("Current Password", "currentPassword", "", "password")}
      ${field("New Password", "newPassword", "", "password")}
    </div>
  `, async root => {
    await saveJson("/api/change-password", "POST", {
      currentPassword: value(root, "currentPassword"),
      newPassword: value(root, "newPassword")
    });
  });
}

function openEditor(title, html, saveAction, focusName = "", afterOpen = null) {
  dialogTitle.textContent = title;
  dialogBody.innerHTML = html;
  if (afterOpen) afterOpen(dialogBody);
  bindRichTextButtons(dialogBody);
  bindTaskPercentRules(dialogBody);
  bindAttachmentPreview(dialogBody);
  bindAuditButtons(dialogBody);

  editorForm.onsubmit = async event => {
    event.preventDefault();
    try {
      await saveAction(dialogBody);
      dialog.close();
      await loadState();
      render();
      showToast("Saved.");
    } catch (error) {
      showToast(error.message);
    }
  };

  dialog.showModal();
  dialogBody.scrollTop = 0;
  dialog.scrollTop = 0;

  // Start each dialog on the most useful field so users can type right away.
  setTimeout(() => focusEditorField(focusName), 0);
}

function focusEditorField(focusName) {
  const requestedField = focusName ? dialogBody.querySelector(`[name='${focusName}'], [data-rich='${focusName}']`) : null;
  const firstField = dialogBody.querySelector("input:not([type='hidden']):not(:disabled), select:not(:disabled), textarea:not(:disabled), .rich-editor[contenteditable='true']");
  (requestedField || firstField)?.focus();
}

function bindTaskPercentRules(root) {
  const status = root.querySelector("[name='status']");
  const percent = root.querySelector("[name='percentCompleted']");
  if (!status || !percent) return;

  const applyPercentRule = () => {
    if (percent.dataset.locked === "true") return;
    percent.value = percentForStatus(status.value, percent.value);
  };

  status.addEventListener("change", applyPercentRule);
  applyPercentRule();
}

function bindAuditButtons(root) {
  root.querySelectorAll("[data-action='show-task-audit']").forEach(button => {
    button.addEventListener("click", () => showTaskAudit(Number(button.dataset.id)));
  });
}

function bindRichTextButtons(root) {
  // Rich text is kept simple and browser-native. The mousedown handler keeps
  // focus in the editor so list/bold/underline commands apply to the right text.
  // PMT targets Chrome/Chromium, so these browser-native commands are tested there first.
  root.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", async () => {
      const command = button.dataset.command;
      const editor = button.closest(".field")?.querySelector(".rich-editor");
      if (!editor) return;

      const savedSelection = saveEditorSelection(editor);
      editor.focus();
      restoreEditorSelection(savedSelection);

      if (command === "createLink") {
        const url = await askForText("Link URL", "Add Link", "https://");
        if (!url) return;

        editor.focus();
        restoreEditorSelection(savedSelection);
        document.execCommand(command, false, normalizeUrl(url));
        normalizeLinksInElement(editor);
        return;
      }

      document.execCommand(command, false, null);

      // Chrome/Chromium can ignore insertUnorderedList in an empty editor. This gives
      // the user a visible bullet to type into instead of making the button feel dead.
      if (command === "insertUnorderedList" && !editor.querySelector("ul")) {
        document.execCommand("insertHTML", false, "<ul><li><br></li></ul>");
      }
    });
  });

  root.querySelectorAll(".rich-editor").forEach(editor => {
    editor.addEventListener("paste", async event => {
      const imageItems = [...(event.clipboardData?.items || [])].filter(item => item.type.startsWith("image/"));
      if (!imageItems.length) return;

      event.preventDefault();
      editor.focus();

      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;

        const upload = await uploadFile("richtext", file);
        document.execCommand("insertHTML", false, `<img src="${escapeAttr(upload.url)}" alt="${escapeAttr(upload.fileName)}">`);
      }
    });
  });
}

function saveEditorSelection(editor) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  return editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
}

function restoreEditorSelection(range) {
  if (!range) return;

  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

async function saveJson(path, method, payload) {
  return api(path, { method, body: JSON.stringify(payload) });
}

async function uploadFile(kind, file) {
  const body = new FormData();
  body.append("file", file);
  return api(`/api/uploads/${kind}`, { method: "POST", body });
}

async function attachFile(path, file) {
  const body = new FormData();
  body.append("file", file);
  return api(path, { method: "POST", body });
}

async function deleteItem(path, message) {
  if (!await askYesNo(message, "Delete")) return;
  try {
    await api(path, { method: "DELETE" });
    await loadState();
    render();
    showToast("Deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function duplicateTask(id) {
  try {
    await api(`/api/tasks/${id}/duplicate`, { method: "POST" });
    await loadState();
    render();
    showToast("Dev Task duplicated.");
  } catch (error) {
    showToast(error.message);
  }
}

function editWorkItem(task) {
  if (task?.taskType === "Bug") {
    bugsFeature.edit(task);
  } else {
    tasksFeature.edit(task || {});
  }
}

function gotoTask(id) {
  const task = taskById(id);
  if (!task) return;
  tasksFeature.selectContext(task.projectId, String(task.sprintId || "all"));
  navigate("Tasks");
  render();
}

function openGanttTask(id) {
  openTaskReadMode(id);
}

function openTaskReadMode(id) {
  const task = taskById(id);
  if (!task) return;

  gotoTask(id);
  viewWorkItem(task, editWorkItem);
}

function viewProjectSprints(projectId) {
  sprintsFeature.selectProject(projectId);
  navigate("Sprints");
  render();
}

function viewDashboardSprint(sprintId) {
  const sprint = sprintById(sprintId);
  if (!sprint) return;

  sprintsFeature.selectProject(sprint.projectId);
  navigate("Sprints");
  render();
}

function viewSprintTasks(sprintId) {
  const sprint = sprintById(sprintId);
  if (!sprint) return;

  tasksFeature.selectContext(sprint.projectId, String(sprint.id));
  navigate("Tasks");
  render();
}

function viewProjectGantt(projectId) {
  ganttProjectId = projectId;
  ganttSprintMode = "current";
  navigate("Gantt");
  writePreference(preferenceKeys.ganttProject, ganttProjectId);
  writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
  render();
}

function sortGanttSprints(sprints) {
  const direction = ganttSort === "startDesc" ? -1 : 1;

  return [...sprints].sort((a, b) => {
    const aStart = ganttStartDate(a)?.getTime() || 0;
    const bStart = ganttStartDate(b)?.getTime() || 0;
    return ((aStart - bStart) * direction) || a.code.localeCompare(b.code);
  });
}

function sortGanttSprintOptions(sprints) {
  // The dropdown is easier to use when recent sprints are listed first.
  return [...sprints].sort((a, b) => {
    const aStart = ganttStartDate(a)?.getTime() || 0;
    const bStart = ganttStartDate(b)?.getTime() || 0;
    return (bStart - aStart) || a.code.localeCompare(b.code);
  });
}

function selectedGanttSprint(projectSprints) {
  if (ganttSprintMode === "all") return null;
  if (ganttSprintMode === "current") return currentSprintForProject(projectSprints);
  return projectSprints.find(sprint => sprint.id === Number(ganttSprintMode)) || currentSprintForProject(projectSprints);
}

function currentSprintForProject(projectSprints) {
  const today = normalizeDate(new Date());
  const sortedSprints = [...projectSprints].sort((a, b) => ganttStartDate(a) - ganttStartDate(b));

  const activeSprint = sortedSprints.find(sprint => {
    const start = ganttStartDate(sprint);
    const end = ganttEndDate(sprint);
    return start && end && start <= today && end >= today;
  });
  if (activeSprint) return activeSprint;

  const latestPastSprint = [...sortedSprints].reverse().find(sprint => ganttEndDate(sprint) <= today);
  if (latestPastSprint) return latestPastSprint;

  return sortedSprints.find(sprint => ganttStartDate(sprint) >= today) || sortedSprints[0] || null;
}

function scrollGanttToSprintStart(chart, sprint) {
  if (!chart?.scrollDate || !chart.dates?.length) return;

  requestAnimationFrame(() => {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller) return;

    scroller.scrollLeft = ganttScrollLeftForDate(chart, chart.scrollDate);
    if (ganttRenderMode === "all" && sprint) {
      scroller.scrollTop = ganttScrollTopForSprint(sprint);
    }
  });
}

function captureGanttScrollPosition() {
  const scroller = document.querySelector(".gantt-scroll");
  if (!scroller) return null;

  const sprintId = nearestGanttSprintIdFromScroll();
  const sprintTop = sprintId ? ganttScrollTopForSprint({ id: sprintId }) : scroller.scrollTop;
  return {
    left: scroller.scrollLeft,
    top: scroller.scrollTop,
    sprintId,
    rowOffset: scroller.scrollTop - sprintTop
  };
}

function restoreGanttScroll(position) {
  if (!position) return;

  const applyScroll = () => {
    const scroller = document.querySelector(".gantt-scroll");
    if (!scroller) return;

    scroller.scrollLeft = position.left;
    if (position.sprintId) {
      const sprintTop = ganttScrollTopForSprint({ id: position.sprintId });
      scroller.scrollTop = Math.max(0, sprintTop + (position.rowOffset || 0));
    } else {
      scroller.scrollTop = position.top;
    }
  };

  requestAnimationFrame(() => {
    applyScroll();
    requestAnimationFrame(applyScroll);
  });
}

function scrollGanttToSprint(chart, sprint) {
  const scroller = document.querySelector(".gantt-scroll");
  if (!scroller || !sprint) return;

  scroller.scrollLeft = ganttScrollLeftForDate(chart, ganttStartDate(sprint));
  scroller.scrollTop = ganttScrollTopForSprint(sprint);
}

function ganttScrollLeftForDate(chart, date) {
  const startIndex = Math.max(0, ganttVisibleDateIndex(chart.dates, date, false));
  // The sprint name column is sticky, so do not add its width to scrollLeft.
  // This places the sprint start just to the right of the fixed column.
  return Math.max(0, (startIndex * chart.dayWidth) - 16);
}

function ganttScrollTopForSprint(sprint) {
  const row = document.querySelector(`[data-gantt-sprint-id="${sprint?.id}"]`);
  const header = document.querySelector(".gantt-header");
  if (!row) return 0;

  return Math.max(0, row.offsetTop - (header?.offsetHeight || 0) - 8);
}

function flyByGantt() {
  if (ganttFlyByActive) {
    pauseGanttFlyBy();
    return;
  }

  const isResuming = Boolean(ganttFlyByResumeSprintId);
  stopGanttFlyBy({ keepResume: isResuming });
  if (!isResuming) applyGanttResetPreset();

  // Fly-by needs historical rows visible. Reset chooses the current Sprint for
  // a fresh run, while Resume keeps the last paused Sprint in memory.
  ganttRenderMode = "all";
  ganttSprintMode = "all";
  ganttFlyByActive = true;
  ganttFlyByStopRequested = false;
  saveGanttViewSettings();
  ganttPendingFlyBy = true;
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

async function startGanttFlyBy(chart, runId) {
  const scroller = document.querySelector(".gantt-scroll");
  if (!chart?.dates?.length || !chart.sprints?.length || !scroller) {
    finishGanttFlyBy("");
    return;
  }
  if (runId !== ganttFlyByRunId) return;

  const newestToOldest = [...chart.sprints].sort((a, b) => ganttStartDate(b) - ganttStartDate(a));
  const currentSprint = ganttFlyByStartingSprint(newestToOldest);
  const currentIndex = Math.max(0, newestToOldest.findIndex(sprint => sprint.id === currentSprint?.id));
  const flyBySprints = newestToOldest.slice(currentIndex);
  if (!flyBySprints.length) {
    finishGanttFlyBy("");
    return;
  }

  // Start exactly where the Sprint dropdown would jump for the current Sprint.
  ganttFlyByCurrentSprintId = flyBySprints[0].id;
  scrollGanttToSprint(chart, flyBySprints[0]);
  if (flyBySprints.length === 1) {
    finishGanttFlyBy("Sprint Fly-by complete.");
    return;
  }

  for (let index = 1; index < flyBySprints.length; index++) {
    if (runId !== ganttFlyByRunId) return;
    const sprint = flyBySprints[index];
    const fromPosition = ganttCurrentScrollPosition(scroller);
    const toPosition = ganttScrollPosition(chart, sprint);
    ganttFlyByAnimating = true;
    const completedMove = await animateGanttScroll(scroller, fromPosition, toPosition, runId);
    ganttFlyByAnimating = false;
    if (!completedMove) return;
    ganttFlyByCurrentSprintId = sprint.id;
    if (ganttFlyByStopRequested) {
      pauseGanttFlyByAtCurrent("Sprint Fly-by paused.");
      return;
    }
    if (!await waitForGanttFlyByPause(runId)) return;
  }
  if (runId === ganttFlyByRunId) {
    finishGanttFlyBy("Sprint Fly-by complete.");
  }
}

function ganttFlyByStartingSprint(sprints) {
  return sprints.find(sprint => sprint.id === ganttFlyByResumeSprintId)
    || selectedGanttSprint(sprints)
    || currentSprintForProject(sprints)
    || sprints[0]
    || null;
}

function ganttScrollPosition(chart, sprint) {
  return {
    left: ganttScrollLeftForDate(chart, ganttStartDate(sprint)),
    top: ganttScrollTopForSprint(sprint)
  };
}

function ganttCurrentScrollPosition(scroller) {
  return {
    left: scroller.scrollLeft,
    top: scroller.scrollTop
  };
}

function animateGanttScroll(scroller, fromPosition, toPosition, runId) {
  return new Promise(resolve => {
    const horizontalDistance = Math.abs(toPosition.left - fromPosition.left);
    const verticalDistance = Math.abs(toPosition.top - fromPosition.top);
    const distance = Math.max(horizontalDistance, verticalDistance);
    // Each sprint-to-sprint move is deliberately slow enough for demo viewers
    // to read the sprint label and see task bars before the next pause.
    const duration = Math.min(9000, Math.max(3200, distance * 3.5));
    const startedAt = performance.now();

    const animate = now => {
      if (runId !== ganttFlyByRunId) {
        resolve(false);
        return;
      }

      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      scroller.scrollLeft = fromPosition.left + ((toPosition.left - fromPosition.left) * eased);
      scroller.scrollTop = fromPosition.top + ((toPosition.top - fromPosition.top) * eased);

      if (progress < 1) {
        ganttFlyByFrameId = requestAnimationFrame(animate);
      } else {
        ganttFlyByFrameId = 0;
        scroller.scrollLeft = toPosition.left;
        scroller.scrollTop = toPosition.top;
        resolve(true);
      }
    };

    ganttFlyByFrameId = requestAnimationFrame(animate);
  });
}

function waitForGanttFlyByPause(runId, milliseconds = 2000) {
  return new Promise(resolve => {
    ganttFlyByTimeoutId = setTimeout(() => {
      ganttFlyByTimeoutId = 0;
      resolve(runId === ganttFlyByRunId);
    }, milliseconds);
  });
}

async function showGanttFlyByCountdown(runId) {
  for (let count = 1; count <= 3; count++) {
    if (runId !== ganttFlyByRunId || !ganttFlyByActive) return false;
    showGanttFlyByToast(`Sprint fly-by will begin in ${count}`);
    if (!await waitForGanttFlyByPause(runId, 1000)) return false;
  }
  return runId === ganttFlyByRunId && ganttFlyByActive;
}

function pauseGanttFlyBy() {
  if (ganttFlyByAnimating) {
    ganttFlyByStopRequested = true;
    updateGanttFlyByButton();
    showGanttFlyByToast("Sprint Fly-by will pause at the next Sprint.");
    return;
  }

  pauseGanttFlyByAtCurrent("Sprint Fly-by paused.");
}

function pauseGanttFlyByAtCurrent(message) {
  const resumeSprintId = ganttFlyByCurrentSprintId || ganttFlyByResumeSprintId || nearestGanttSprintIdFromScroll();
  ganttFlyByRunId += 1;
  ganttFlyByActive = false;
  ganttFlyByAnimating = false;
  ganttFlyByStopRequested = false;
  ganttFlyByResumeSprintId = resumeSprintId || 0;
  clearGanttFlyByTimers();
  updateGanttFlyByButton();
  showGanttFlyByToast(message);
}

function finishGanttFlyBy(message) {
  ganttFlyByActive = false;
  ganttFlyByAnimating = false;
  ganttFlyByStopRequested = false;
  ganttFlyByResumeSprintId = 0;
  ganttFlyByCurrentSprintId = 0;
  clearGanttFlyByTimers();
  updateGanttFlyByButton();
  if (message) showGanttFlyByToast(message);
}

function stopGanttFlyBy(options = {}) {
  ganttFlyByRunId += 1;
  ganttFlyByActive = false;
  ganttFlyByAnimating = false;
  ganttFlyByStopRequested = false;
  if (!options.keepResume) {
    ganttFlyByResumeSprintId = 0;
    ganttFlyByCurrentSprintId = 0;
  }
  clearGanttFlyByTimers();
}

function clearGanttFlyByTimers() {
  if (ganttFlyByFrameId) {
    cancelAnimationFrame(ganttFlyByFrameId);
    ganttFlyByFrameId = 0;
  }
  if (ganttFlyByTimeoutId) {
    clearTimeout(ganttFlyByTimeoutId);
    ganttFlyByTimeoutId = 0;
  }
}

function nearestGanttSprintIdFromScroll() {
  const scroller = document.querySelector(".gantt-scroll");
  if (!scroller) return 0;

  const header = document.querySelector(".gantt-header");
  const targetTop = scroller.scrollTop + (header?.offsetHeight || 0) + 8;
  const rows = [...document.querySelectorAll("[data-gantt-sprint-id]")];
  const nearestRow = rows.reduce((bestRow, row) => {
    if (!bestRow) return row;
    return Math.abs(row.offsetTop - targetTop) < Math.abs(bestRow.offsetTop - targetTop) ? row : bestRow;
  }, null);

  return Number(nearestRow?.dataset.ganttSprintId || 0);
}

function updateGanttFlyByButton() {
  const button = document.querySelector("[data-action='gantt-flyby']");
  if (!button) return;

  button.classList.toggle("is-on", ganttFlyByActive);
  button.title = ganttFlyByButtonTitle();
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", String(ganttFlyByActive));
  button.innerHTML = ganttFlyByButtonIcon();
}

function ganttFlyByButtonTitle() {
  if (ganttFlyByStopRequested) return "Pausing after this Sprint";
  if (ganttFlyByActive) return "Pause Sprint Fly-by";
  if (ganttFlyByResumeSprintId) return "Resume Sprint Fly-by";
  return "Start Sprint Fly-by";
}

function ganttFlyByButtonIcon() {
  return ganttFlyByActive ? "&#10074;&#10074;" : "&#9654;";
}

function showGanttFlyByToast(message) {
  showToast(message, document.querySelector("[data-action='gantt-flyby']"));
}

function toggleGanttRenderMode() {
  ganttRenderMode = ganttRenderMode === "selected" ? "all" : "selected";
  if (ganttRenderMode === "all") {
    ganttSprintMode = "all";
  } else if (ganttSprintMode === "all") {
    ganttSprintMode = "current";
  }
  writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
  writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

function toggleGanttDays() {
  ganttShowNonWorkingDays = !ganttShowNonWorkingDays;
  writePreference(preferenceKeys.ganttShowNonWorkingDays, ganttShowNonWorkingDays);
  renderGantt();
}

function resetGanttView() {
  stopGanttFlyBy();
  applyGanttResetPreset();
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

function applyGanttResetPreset() {
  ganttSprintMode = "current";
  ganttSort = "startDesc";
  ganttRenderMode = "selected";
  saveGanttViewSettings();
}

function saveGanttViewSettings() {
  writePreference(preferenceKeys.ganttSprint, ganttSprintMode);
  writePreference(preferenceKeys.ganttSort, ganttSort);
  writePreference(preferenceKeys.ganttRenderMode, ganttRenderMode);
}

function toggleGanttAllBugs() {
  ganttShowAllBugs = !ganttShowAllBugs;
  ganttExpandedBugTaskIds.clear();
  renderGantt();
}

function toggleRoadMapDates() {
  roadMapShowDates = !roadMapShowDates;
  writePreference(preferenceKeys.roadMapShowDates, roadMapShowDates);
  renderRoadMap();
}

function toggleRoadMapDetails() {
  roadMapShowDetails = !roadMapShowDetails;
  writePreference(preferenceKeys.roadMapShowDetails, roadMapShowDetails);
  renderRoadMap();
}

function toggleRoadMapSprints() {
  roadMapShowSprints = !roadMapShowSprints;
  writePreference(preferenceKeys.roadMapShowSprints, roadMapShowSprints);
  renderRoadMap();
}

function ganttChartData(project, sprints, selectedSprint = null, scrollSprint = null, showNonWorkingDays = false) {
  const projectTasks = state.tasks
    .filter(task => task.projectId === project?.id)
    .filter(task => !selectedSprint || task.sprintId === selectedSprint.id);
  const scheduledItems = [
    ...sprints.map(sprint => ({ type: "Sprint", item: sprint, start: ganttStartDate(sprint), end: ganttEndDate(sprint) })),
    ...projectTasks.map(task => ({ type: task.taskType, item: task, start: ganttStartDate(task), end: ganttEndDate(task) }))
  ].filter(row => row.start && row.end);

  if (!scheduledItems.length) return { project, sprints: [], dates: [], dayWidth: 42, scrollDate: null };

  const minDate = new Date(Math.min(...scheduledItems.map(row => row.start.getTime())));
  const maxDate = new Date(Math.max(...scheduledItems.map(row => row.end.getTime())));
  const startDates = new Set(projectTasks.map(task => dateKey(ganttStartDate(task))).filter(Boolean));
  const holidays = activeHolidayMap();
  const dates = dateRange(minDate, maxDate).filter(date => shouldShowGanttDate(date, startDates, holidays, showNonWorkingDays));

  return {
    project,
    sprints,
    dates,
    holidays,
    dayWidth: ganttDayWidth(dates, sprints, scrollSprint),
    scrollDate: scrollSprint ? ganttStartDate(scrollSprint) : null
  };
}

function ganttDayWidth(dates, sprints, focusSprint) {
  const baseWidth = dates.length > 700 ? 12 : dates.length > 365 ? 14 : dates.length > 180 ? 16 : dates.length > 120 ? 18 : dates.length > 60 ? 24 : dates.length > 35 ? 32 : 42;
  if (!isTypicalTwoWeekSprintProject(sprints)) return baseWidth;

  const sprint = focusSprint || sprints[0];
  if (!sprint) return baseWidth;
  const sprintStart = ganttStartDate(sprint);
  const sprintEnd = ganttEndDate(sprint);
  const sprintVisibleDayCount = dates.filter(date => date >= sprintStart && date <= sprintEnd).length || 10;
  const fitWidth = Math.floor(ganttAvailableTimelineWidth() / Math.max(8, sprintVisibleDayCount));

  // Two-week projects are the normal case, so give those task bars enough
  // width to read while keeping the focused Sprint inside the viewport.
  return Math.max(baseWidth, Math.min(72, fitWidth));
}

function isTypicalTwoWeekSprintProject(sprints) {
  const durations = sprints
    .map(sprint => {
      const start = ganttStartDate(sprint);
      const end = ganttEndDate(sprint);
      return start && end ? Math.round((end - start) / 86400000) + 1 : 0;
    })
    .filter(days => days > 0)
    .sort((a, b) => a - b);

  if (!durations.length) return false;
  const middle = Math.floor(durations.length / 2);
  const medianDays = durations.length % 2
    ? durations[middle]
    : Math.round((durations[middle - 1] + durations[middle]) / 2);

  return medianDays <= 24;
}

function ganttAvailableTimelineWidth() {
  const contentWidth = app?.clientWidth || window.innerWidth || 1200;
  return Math.max(620, contentWidth - 280);
}

function roadMapProjects() {
  const selectedSprintId = roadMapShowSprints && roadMapSprintFilter !== "all" ? Number(roadMapSprintFilter) : 0;

  return [...state.projects]
    .filter(project => roadMapProjectFilter === "all" || String(project.id) === String(roadMapProjectFilter))
    .filter(project => !selectedSprintId || state.sprints.some(sprint => sprint.id === selectedSprintId && sprint.projectId === project.id))
    .sort(roadMapCompareProjects);
}

function roadMapSprintOptions() {
  const selectedProjectId = roadMapProjectFilter === "all" ? 0 : Number(roadMapProjectFilter);

  return [...state.sprints]
    .filter(sprint => !selectedProjectId || sprint.projectId === selectedProjectId)
    .sort((a, b) => {
      const projectCompare = projectName(a.projectId).localeCompare(projectName(b.projectId));
      if (projectCompare) return projectCompare;
      return roadMapSprintStart(a, projectById(a.projectId)) - roadMapSprintStart(b, projectById(b.projectId)) || a.code.localeCompare(b.code);
    });
}

function roadMapProjectSprints(project) {
  if (!roadMapShowSprints) return [];

  return state.sprints
    .filter(sprint => sprint.projectId === project.id)
    .filter(sprint => roadMapSprintFilter === "all" || String(sprint.id) === String(roadMapSprintFilter))
    .sort((a, b) => roadMapSprintStart(a, project) - roadMapSprintStart(b, project) || a.code.localeCompare(b.code));
}

function roadMapCompareProjects(a, b) {
  const sortValue = roadMapSort || "endAsc";
  const direction = sortValue.endsWith("Desc") ? -1 : 1;
  const useStart = sortValue.startsWith("start");
  const aDate = useStart ? roadMapProjectStart(a) : roadMapProjectEnd(a);
  const bDate = useStart ? roadMapProjectStart(b) : roadMapProjectEnd(b);
  const dateCompare = (aDate?.getTime() || 0) - (bDate?.getTime() || 0);

  return (dateCompare * direction) || a.code.localeCompare(b.code);
}

function roadMapChartData(projects) {
  const rows = projects.map(project => {
    const allProjectSprints = state.sprints.filter(sprint => sprint.projectId === project.id);
    const projectSprints = roadMapProjectSprints(project);
    const start = roadMapProjectStart(project);
    const endSourceSprints = roadMapShowSprints && roadMapSprintFilter !== "all" ? projectSprints : allProjectSprints;
    const end = roadMapProjectEnd(project, endSourceSprints);
    const sprints = projectSprints.map(sprint => ({
      sprint,
      start: roadMapSprintStart(sprint, project),
      end: roadMapSprintEnd(sprint, project)
    }));

    return { project, start, end, sprints };
  }).filter(row => row.start && row.end);

  const scheduledItems = rows.flatMap(row => [
    { start: row.start, end: row.end },
    ...row.sprints.map(sprintRow => ({ start: sprintRow.start, end: sprintRow.end }))
  ]).filter(row => row.start && row.end);

  if (!scheduledItems.length) return { rows: [], dates: [], dayWidth: 42, holidays: new Map() };

  const minDate = new Date(Math.min(...scheduledItems.map(row => row.start.getTime())));
  const maxDate = new Date(Math.max(...scheduledItems.map(row => row.end.getTime())));
  const startDates = new Set(scheduledItems.map(row => dateKey(row.start)).filter(Boolean));
  const holidays = activeHolidayMap();
  const timeline = roadMapTimeline(minDate, maxDate, startDates, holidays);

  return {
    rows,
    dates: timeline.dates,
    holidays,
    dayWidth: timeline.dayWidth,
    granularity: timeline.granularity
  };
}

function roadMapChartHtml(chart) {
  const years = groupedHeader(chart.dates, date => date.getFullYear());
  const quarters = groupedHeader(chart.dates, date => `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`);
  const months = groupedHeader(chart.dates, date => `${date.getFullYear()}-${date.getMonth()}`);
  const dayRow = chart.granularity === "day"
    ? `<div class="roadmap-row roadmap-days">${chart.dates.map(date => `<div class="${isHoliday(date, chart.holidays) ? "holiday-day" : ""}" title="${escapeAttr(ganttDateTitle(date, chart.holidays))}">${date.getDate()}</div>`).join("")}</div>`
    : "";

  return `
    <div class="roadmap panel roadmap-${chart.granularity}-timeline" style="--day-width:${chart.dayWidth}px; --date-count:${chart.dates.length}">
      <div class="roadmap-scroll">
        <div class="roadmap-calendar roadmap-header">
          <div class="roadmap-row roadmap-years">${years.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label)}</div>`).join("")}</div>
          <div class="roadmap-row roadmap-quarters">${quarters.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label.split(" ")[1])}</div>`).join("")}</div>
          <div class="roadmap-row roadmap-months">${months.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(monthName(group.firstDate))}</div>`).join("")}</div>
          ${dayRow}
        </div>
        ${chart.rows.map(row => roadMapProjectHtml(row, chart)).join("")}
      </div>
    </div>
  `;
}

function roadMapProjectHtml(row, chart) {
  return `
    <section class="roadmap-project-group">
      <div class="roadmap-lane roadmap-project-lane">
        <div class="roadmap-bar roadmap-project-bar" role="button" tabindex="0" data-action="view-project-sprints" data-id="${row.project.id}" ${roadMapGridStyle(row.start, row.end, chart, true)} title="${escapeAttr(roadMapProjectTooltip(row))}">
          <strong>${escapeHtml(row.project.code)} - ${escapeHtml(row.project.title)}</strong>
          ${roadMapShowDates || roadMapShowDetails ? `
          <div class="roadmap-second-line">
            ${roadMapShowDetails ? `${avatarsHtml(row.project.members)}<span>${row.project.percentCompleted}% complete</span>` : ""}
            ${roadMapShowDates ? `<span class="roadmap-date-range">${escapeHtml(dateRangeLabel(row.start, row.end))}</span>` : ""}
          </div>
          ` : ""}
          <i style="--value:${row.project.percentCompleted}%"></i>
        </div>
      </div>
      ${roadMapShowSprints ? (row.sprints.map(sprintRow => roadMapSprintHtml(sprintRow, chart)).join("") || `<div class="empty compact-empty">No Sprints match the current filter.</div>`) : ""}
    </section>
  `;
}

function roadMapProjectTooltip(row) {
  return [
    `Project: ${row.project.code} - ${row.project.title}`,
    `Completion: ${row.project.percentCompleted}%`,
    `Start: ${formatDate(row.start) || "Not set"}`,
    `End: ${formatDate(row.end) || "Not set"}`
  ].join("\n");
}

function roadMapSprintHtml(row, chart) {
  return `
    <div class="roadmap-lane roadmap-sprint-lane">
      <div class="roadmap-bar roadmap-sprint-bar" role="button" tabindex="0" data-action="view-sprint-tasks" data-id="${row.sprint.id}" ${roadMapGridStyle(row.start, row.end, chart, false)} title="${escapeAttr(row.sprint.code + " " + row.sprint.title)}">
        <strong>${escapeHtml(row.sprint.code)} - ${escapeHtml(row.sprint.title)}</strong>
        ${roadMapShowDates || roadMapShowDetails ? `
        <div class="roadmap-second-line">
          ${roadMapShowDetails ? `${avatarsHtml(row.sprint.developers)}<span>${row.sprint.percentCompleted}% complete</span>` : ""}
          ${roadMapShowDates ? `<span class="roadmap-date-range">${escapeHtml(dateRangeLabel(row.start, row.end))}</span>` : ""}
        </div>
        ` : ""}
        <i style="--value:${row.sprint.percentCompleted}%"></i>
      </div>
    </div>
  `;
}

function roadMapGridStyle(start, end, chart, isProject) {
  const startIndex = Math.max(0, roadMapVisibleDateIndex(chart.dates, start, false, chart.granularity));
  let endIndex = roadMapVisibleDateIndex(chart.dates, end, true, chart.granularity);
  if (endIndex < startIndex) endIndex = startIndex;

  const minimumSpan = Math.min(isProject ? 6 : 3, chart.dates.length);
  const availableSpan = Math.max(1, chart.dates.length - startIndex);
  const span = Math.min(availableSpan, Math.max(minimumSpan, endIndex - startIndex + 1));
  return `style="grid-column:${startIndex + 1} / span ${span}"`;
}

function roadMapTimeline(minDate, maxDate, startDates, holidays) {
  const allDates = dateRange(minDate, maxDate);
  if (allDates.length > 240) {
    const dates = padRoadMapMonthsToViewport(monthRange(minDate, maxDate));
    return {
      dates,
      granularity: "month",
      dayWidth: roadMapMonthWidth(dates.length)
    };
  }

  const dates = allDates.filter(date => shouldShowGanttDate(date, startDates, holidays));
  return {
    dates,
    granularity: "day",
    dayWidth: dates.length > 180 ? 14 : dates.length > 120 ? 18 : dates.length > 60 ? 24 : dates.length > 35 ? 32 : 42
  };
}

function padRoadMapMonthsToViewport(dates) {
  if (!dates.length) return dates;

  const paddedDates = [...dates];
  const dayWidth = roadMapMonthWidth(paddedDates.length);
  const availableWidth = roadMapAvailableTimelineWidth();

  // If the compressed monthly calendar is narrower than the screen, show a few
  // future months so the user gets more useful timeline context.
  while ((paddedDates.length + 1) * dayWidth <= availableWidth) {
    const nextDate = new Date(paddedDates[paddedDates.length - 1]);
    nextDate.setMonth(nextDate.getMonth() + 1);
    paddedDates.push(nextDate);
  }

  return paddedDates;
}

function roadMapAvailableTimelineWidth() {
  const contentWidth = app?.clientWidth || window.innerWidth || 1200;
  return Math.max(560, contentWidth - 48);
}

function roadMapMonthWidth(monthCount) {
  if (monthCount > 72) return 14;
  if (monthCount > 48) return 18;
  if (monthCount > 30) return 24;
  if (monthCount > 18) return 32;
  return 42;
}

function monthRange(start, end) {
  const dates = [];
  const cursor = firstDayOfMonth(start);
  const last = firstDayOfMonth(end);
  while (cursor && last && cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

function firstDayOfMonth(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function roadMapVisibleDateIndex(dates, targetDate, preferEnd, granularity) {
  const date = granularity === "month" ? firstDayOfMonth(targetDate) : targetDate;
  return ganttVisibleDateIndex(dates, date, preferEnd);
}

function roadMapProjectStart(project) {
  // Projects without explicit dates still need to appear on the roadmap.
  if (!project) return null;
  return normalizeDate(project.startDate || project.createdAt);
}

function roadMapProjectEnd(project, projectSprints = roadMapProjectSprints(project)) {
  const start = roadMapProjectStart(project);
  const sprintEndDates = projectSprints.map(sprint => roadMapSprintEnd(sprint, project)).filter(Boolean);
  const latestSprintEnd = sprintEndDates.length ? new Date(Math.max(...sprintEndDates.map(date => date.getTime()))) : null;
  const end = normalizeDate(project.endDate) || latestSprintEnd || start;
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function roadMapSprintStart(sprint, project) {
  // A sprint with no StartDate begins with its project, per the Road Map rule.
  return normalizeDate(sprint.startDate) || roadMapProjectStart(project) || normalizeDate(sprint.createdAt);
}

function roadMapSprintEnd(sprint, project) {
  const start = roadMapSprintStart(sprint, project);
  const end = normalizeDate(sprint.endDate) || start;
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function ganttChartHtml(chart) {
  const years = groupedHeader(chart.dates, date => date.getFullYear());
  const quarters = groupedHeader(chart.dates, date => `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`);
  const months = groupedHeader(chart.dates, date => `${date.getFullYear()}-${date.getMonth()}`);

  return `
    <div class="gantt panel" style="--day-width:${chart.dayWidth}px; --date-count:${chart.dates.length}">
      <div class="gantt-scroll">
        <div class="gantt-grid gantt-header">
          <div class="gantt-left-head">Sprint</div>
          <div class="gantt-timeline">
            <div class="gantt-row gantt-years">${years.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label)}</div>`).join("")}</div>
            <div class="gantt-row gantt-quarters">${quarters.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label.split(" ")[1])}</div>`).join("")}</div>
            <div class="gantt-row gantt-months">${months.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(monthName(group.firstDate))}</div>`).join("")}</div>
            <div class="gantt-row gantt-days">${chart.dates.map(date => `<div class="${ganttDateClass(date, chart.holidays)}" title="${escapeAttr(ganttDateTitle(date, chart.holidays))}">${ganttDayLabel(date, chart)}</div>`).join("")}</div>
          </div>
        </div>
        ${chart.sprints.map(sprint => ganttSprintHtml(sprint, chart)).join("") || `<div class="empty">No Sprints for this project.</div>`}
      </div>
    </div>
  `;
}

function ganttSprintHtml(sprint, chart) {
  const sprintTasks = state.tasks
    .filter(task => task.sprintId === sprint.id && task.taskType !== "Bug")
    .sort((a, b) => ganttStartDate(a) - ganttStartDate(b) || a.id - b.id);
  const sprintBugs = state.tasks.filter(task => task.sprintId === sprint.id && task.taskType === "Bug");
  const sprintTooltip = `${sprint.code} - ${sprint.title} (${sprintTasks.length} tasks)`;

  return `
    <div class="gantt-grid gantt-sprint-block" data-gantt-sprint-id="${sprint.id}">
      <button type="button" class="gantt-sprint-name" data-action="view-sprint-tasks" data-id="${sprint.id}" title="${escapeAttr(sprintTooltip)}">
        <strong>${escapeHtml(sprint.code)}</strong>
        <span>${escapeHtml(sprint.title)}</span>
      </button>
      <div class="gantt-task-stack">
        ${sprintTasks.map(task => ganttTaskHtml(task, sprintBugs, chart)).join("") || `<div class="empty compact-empty">No tasks.</div>`}
      </div>
    </div>
  `;
}

function ganttTaskHtml(task, sprintBugs, chart) {
  const bugTasks = bugsForTask(task, sprintBugs);
  const hasOpenBugs = bugTasks.some(bug => !isTaskCompleted(bug));
  const showBugs = ganttShowAllBugs || ganttExpandedBugTaskIds.has(task.id);

  return `
    <div class="gantt-task-group">
      <div class="gantt-lane">
        ${ganttDependencyLines(task, chart)}
        <div class="gantt-bar" role="button" tabindex="0" data-action="gantt-open-task" data-id="${task.id}" ${ganttGridStyle(task, chart)} title="${escapeAttr(task.code + " " + task.title)}">
          ${avatarsHtml(task.assignees)}
          <span>${escapeHtml(task.code)} ${escapeHtml(task.title)}</span>
          ${bugTasks.length ? `<button type="button" class="gantt-bug-button ${hasOpenBugs ? "open-bugs" : "closed-bugs"}" data-action="toggle-gantt-task-bugs" data-id="${task.id}" title="Show bug reports">&#128027;</button>` : ""}
          <i style="--value:${taskDisplayPercent(task)}%"></i>
        </div>
      </div>
      ${showBugs ? bugTasks.map(bug => `
        <div class="gantt-lane gantt-bug-lane">
          <div class="gantt-bar gantt-bug-bar" role="button" tabindex="0" data-action="gantt-open-task" data-id="${bug.id}" ${ganttGridStyle(bug, chart)} title="${escapeAttr(bug.code + " " + bug.title)}">
            ${avatarsHtml(bug.assignees)}
            <span>${escapeHtml(bug.code)} ${escapeHtml(bug.title)}</span>
            <i style="--value:${taskDisplayPercent(bug)}%"></i>
          </div>
        </div>
      `).join("") : ""}
    </div>
  `;
}

function ganttGridStyle(item, chart) {
  const start = ganttStartDate(item);
  const end = ganttEndDate(item);
  const startIndex = Math.max(0, ganttVisibleDateIndex(chart.dates, start, false));
  let endIndex = ganttVisibleDateIndex(chart.dates, end, true);
  if (endIndex < startIndex) endIndex = startIndex;

  const span = Math.max(2, endIndex - startIndex + 1);
  return `style="grid-column:${startIndex + 1} / span ${span}; --status-color:${escapeAttr(statusColor(item.status || "Todo"))}"`;
}

function ganttDependencyLines(task, chart) {
  return (task.dependencyTaskIds || [])
    .map(id => taskById(id))
    .filter(Boolean)
    .map(dependency => {
      const fromIndex = ganttVisibleDateIndex(chart.dates, ganttEndDate(dependency), true);
      const toIndex = ganttVisibleDateIndex(chart.dates, ganttStartDate(task), false);
      if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) return "";
      return `<span class="gantt-dependency" style="grid-column:${fromIndex + 1} / ${toIndex + 1}" title="Depends on ${escapeAttr(dependency.code)}"></span>`;
    }).join("");
}

function ganttStartDate(item) {
  // StartDate is optional, so CreatedAt gives old tasks a reasonable place on the chart.
  return normalizeDate(item.startDate || item.startedAt || item.createdAt);
}

function ganttEndDate(item) {
  const start = ganttStartDate(item);
  const end = normalizeDate(item.endDate || item.startDate || item.updatedAt || item.createdAt);
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function ganttVisibleDateIndex(dates, targetDate, preferEnd) {
  if (!targetDate || !dates.length) return -1;

  const targetKey = dateKey(targetDate);
  const exactIndex = dates.findIndex(date => dateKey(date) === targetKey);
  if (exactIndex >= 0) return exactIndex;

  if (preferEnd) {
    for (let index = dates.length - 1; index >= 0; index--) {
      if (dates[index] <= targetDate) return index;
    }
    return 0;
  }

  for (let index = 0; index < dates.length; index++) {
    if (dates[index] >= targetDate) return index;
  }
  return dates.length - 1;
}

function activeHolidayMap() {
  const holidays = new Map();
  (state.holidays || []).filter(item => item.isActive).forEach(holiday => {
    holidays.set(dateKey(holiday.holidayDate), holiday);
  });
  return holidays;
}

function shouldShowGanttDate(date, itemStartDates, holidays, showNonWorkingDays = false) {
  if (showNonWorkingDays) return true;
  // Weekends and holidays stay hidden unless an item starts on that exact date.
  return itemStartDates.has(dateKey(date)) || (!isWeekend(date) && !isHoliday(date, holidays));
}

function ganttDateClass(date, holidays) {
  const classes = [];
  if (isWeekend(date)) classes.push("weekend-day");
  if (isHoliday(date, holidays)) classes.push("holiday-day");
  return classes.join(" ");
}

function ganttDayLabel(date, chart) {
  const day = date.getDate();
  if (chart.dayWidth <= 12) return [1, 5, 10, 15, 20, 25].includes(day) ? String(day) : "";
  if (chart.dayWidth <= 16) return day === 1 || day % 2 === 0 ? String(day) : "";
  return String(day);
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function isHoliday(date, holidays) {
  return holidays.has(dateKey(date));
}

function ganttDateTitle(date, holidays) {
  const holiday = holidays.get(dateKey(date));
  return holiday ? `${formatDate(date)} - ${holiday.name}` : formatDate(date);
}

function groupedHeader(dates, keySelector) {
  const groups = [];
  dates.forEach(date => {
    const label = String(keySelector(date));
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.count += 1;
    } else {
      groups.push({ label, count: 1, firstDate: date });
    }
  });
  return groups;
}

function toggleGanttTaskBugs(taskId) {
  const id = Number(taskId);
  const scrollPosition = captureGanttScrollPosition();
  const resumeSprintId = nearestGanttSprintIdFromScroll();
  if (ganttFlyByActive) {
    stopGanttFlyBy({ keepResume: true });
    ganttFlyByResumeSprintId = resumeSprintId || ganttFlyByResumeSprintId;
    updateGanttFlyByButton();
  }

  if (ganttExpandedBugTaskIds.has(id)) {
    ganttExpandedBugTaskIds.delete(id);
  } else {
    ganttExpandedBugTaskIds.add(id);
  }
  renderGantt({ restoreScroll: scrollPosition, skipStopFlyBy: true });
}

function refreshLookupOptions() {
  statuses = lookupValues("Status", fallbackStatuses);
  priorities = lookupValues("Priority", fallbackPriorities);
  severities = lookupValues("Severity", fallbackSeverities);
  environments = lookupValues("Environment", fallbackEnvironments);
  boardFeature?.refreshStatuses();
}

function lookupValues(type, fallback) {
  const values = (state.lookups || [])
    .filter(item => item.lookupType === type && item.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.value.localeCompare(b.value))
    .map(item => item.value);

  return values.length ? values : [...fallback];
}

function lookupOptionsWithCurrent(type, currentValue) {
  const options = lookupValues(type, fallbackForLookup(type));
  if (currentValue && !options.includes(currentValue)) return [...options, currentValue];
  return options;
}

function showToast(message, anchorElement = null) {
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.toggle("toast-near-control", Boolean(anchorElement));
  toast.style.left = "";
  toast.style.top = "";
  toast.style.right = "";
  toast.style.bottom = "";
  toast.style.maxWidth = "";

  if (anchorElement) {
    // Place contextual messages under the control that caused them.
    const rect = anchorElement.getBoundingClientRect();
    const maxWidth = Math.min(360, window.innerWidth - 32);
    toast.style.maxWidth = `${maxWidth}px`;

    const toastWidth = Math.min(toast.offsetWidth || maxWidth, maxWidth);
    const toastHeight = toast.offsetHeight || 44;
    const left = Math.max(16, Math.min(rect.left + (rect.width / 2) - (toastWidth / 2), window.innerWidth - toastWidth - 16));
    const top = Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - toastHeight - 16));

    toast.style.left = `${left}px`;
    toast.style.top = `${top}px`;
    toast.style.right = "auto";
    toast.style.bottom = "auto";
  }

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}
