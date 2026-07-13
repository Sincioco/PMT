import { syncAvatarStackFit } from "../../components/avatars.js?v=20260710-nav-avatar-fit";
import { buttonContent } from "../../components/buttons.js";
import {
  completionColor,
  projectOverallProgressHtml,
  projectStatusMetricsHtml,
  sprintOverallProgressHtml,
  sprintStatusMetricsHtml,
  statusLegendHtml,
  thinProgressHtml
} from "../../components/progress-and-status.js?v=20260714-linked-bug-percent";
import { sectionHead } from "../../components/sections.js?v=20260701-nav-title-preferences";
import { state } from "../../core/store.js";
import {
  escapeHtml
} from "../../shared/text-and-links.js";
import {
  averageWorkItemPercent,
  bugsForTask,
  taskDisplayPercent
} from "../../shared/work-item-rules.js?v=20260714-linked-bug-percent";

export function createDashboardFeature({
  app,
  isProjectCollapsed,
  openSprintTasks,
  openTaskReadMode,
  projectCardHtml
}) {
  let showAllDetails = false;
  let expandedSprintIds = new Set();

  function renderDashboard() {
    app.innerHTML = `
      ${sectionHead("Dashboard", `
        <button class="text-icon-button" type="button" data-action="toggle-dashboard-all-details">${buttonContent(showAllDetails ? "&#8722;" : "&#43;", showAllDetails ? "Hide All Details" : "Show All Details")}</button>
      `)}
      <div class="grid dashboard-summary-grid">
        ${state.projects.map(project => projectCardHtml(project, {
          showStatusDonut: false,
          showStatusTotals: true
        })).join("")}
      </div>
      <div class="panel dashboard-flow-panel">
        <div class="spread dashboard-flow-head">
          <h2>Project Flow</h2>
          <span class="muted">${state.tasks.length} tasks across ${state.sprints.length} Sprints</span>
        </div>
        ${showAllDetails ? statusLegendHtml() : ""}
        ${state.projects.map(project => dashboardProjectHtml(project)).join("")}
      </div>
    `;
    syncAvatarStackFit(app);
  }

  async function handleAction(action, id) {
    if (action === "dashboard-view-task") {
      openTaskReadMode(id);
      return true;
    }
    if (action === "dashboard-view-sprint") {
      openSprintTasks(id);
      return true;
    }
    if (action === "toggle-dashboard-sprint-details") {
      toggleDashboardSprintDetails(id);
      return true;
    }
    if (action === "toggle-dashboard-all-details") {
      toggleDashboardAllDetails();
      return true;
    }

    return false;
  }

  function dashboardSprintDetailsVisible(sprintId) {
    return showAllDetails || expandedSprintIds.has(Number(sprintId));
  }

  function toggleDashboardSprintDetails(sprintId) {
    const id = Number(sprintId);

    if (showAllDetails) {
      showAllDetails = false;
      expandedSprintIds = new Set(state.sprints.map(sprint => sprint.id));
      expandedSprintIds.delete(id);
    } else if (expandedSprintIds.has(id)) {
      expandedSprintIds.delete(id);
    } else {
      expandedSprintIds.add(id);
    }

    renderDashboard();
  }

  function toggleDashboardAllDetails() {
    showAllDetails = !showAllDetails;
    expandedSprintIds.clear();
    renderDashboard();
  }

  function dashboardProjectHtml(project) {
    const sprints = state.sprints.filter(sprint => sprint.projectId === project.id);
    const isCollapsed = isProjectCollapsed(project.id);
    const chartToggleTitle = isCollapsed ? "Expand Project charts" : "Collapse Project charts";

    return `
      <section class="dashboard-project-flow">
        <div class="spread dashboard-project-heading">
          <div class="dashboard-project-title">
            <strong>${escapeHtml(project.code)}</strong>
            <span>${escapeHtml(project.title)}</span>
          </div>
          <button class="icon-action" type="button" data-action="toggle-project-card-details" data-id="${project.id}" title="${chartToggleTitle}" aria-label="${chartToggleTitle}" aria-expanded="${!isCollapsed}">
            ${isCollapsed ? "&#9662;" : "&#9652;"}
          </button>
        </div>
        ${projectOverallProgressHtml(project)}
        ${isCollapsed ? "" : projectStatusMetricsHtml(project)}
        <div class="dashboard-sprint-grid">
          ${sprints.map(sprint => {
            const sprintTasks = state.tasks.filter(task => task.sprintId === sprint.id);
            const isExpanded = dashboardSprintDetailsVisible(sprint.id);

            return `
            <article class="card clickable-card dashboard-sprint-card" data-action="dashboard-view-sprint" data-id="${sprint.id}">
              <div class="spread dashboard-sprint-head">
                <div>
                  <strong>${escapeHtml(sprint.code)}</strong>
                  <p class="muted">${escapeHtml(sprint.title)}</p>
                </div>
                <span class="muted">${sprint.percentCompleted}%</span>
              </div>
              ${sprintOverallProgressHtml(sprint)}
              <div class="dashboard-card-actions">
                <button type="button" class="secondary text-icon-button" data-action="toggle-dashboard-sprint-details" data-id="${sprint.id}">
                  ${buttonContent(isExpanded ? "&#8722;" : "&#43;", isExpanded ? "Less Details" : "More Details")}
                </button>
              </div>
              ${isExpanded ? `
                ${sprintStatusMetricsHtml(sprint)}
                <div class="dashboard-task-list">
                  ${sprintTasks.map(task => dashboardTaskRowHtml(task, sprintTasks)).join("") || `<div class="empty compact-empty">No tasks.</div>`}
                </div>
              ` : ""}
            </article>
          `;
          }).join("") || `<div class="empty">No Sprints.</div>`}
        </div>
      </section>
    `;
  }

  function dashboardTaskRowHtml(task, sprintTasks) {
    const percent = dashboardTaskProgressPercent(task, sprintTasks);

    return `
      <button type="button" class="dashboard-task-row" data-action="dashboard-view-task" data-id="${task.id}">
        <span class="dashboard-task-summary">
          <span class="dashboard-task-title">${escapeHtml(task.code)} ${escapeHtml(task.title)}</span>
          <span class="pill">${percent}%</span>
        </span>
        ${thinProgressHtml(percent, completionColor(percent))}
      </button>
    `;
  }

  function dashboardTaskProgressPercent(task, sprintTasks) {
    if (task.taskType === "Bug") return taskDisplayPercent(task);

    const relatedBugs = bugsForTask(task, sprintTasks.filter(item => item.taskType === "Bug"));
    const workItems = [task, ...relatedBugs];
    return averageWorkItemPercent(workItems);
  }

  return {
    handleAction,
    render: renderDashboard
  };
}
