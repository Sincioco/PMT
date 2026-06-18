import {
  projectOverallPercent,
  projectWorkItems,
  sprintOverallPercent,
  sprintWorkItems
} from "../shared/work-item-rules.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

let statusProvider = () => [];
let lookupProvider = () => [];
let taskProvider = () => [];

export function configureProgressAndStatus(options = {}) {
  if (options.getStatuses) statusProvider = options.getStatuses;
  if (options.getLookups) lookupProvider = options.getLookups;
  if (options.getTasks) taskProvider = options.getTasks;
}

function currentStatuses() {
  return statusProvider() || [];
}

function currentLookups() {
  return lookupProvider() || [];
}

function currentTasks() {
  return taskProvider() || [];
}

export function progressHtml(value) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return `<div class="progress" title="${safeValue}%"><span style="--value:${safeValue}%"></span></div>`;
}

export function thinProgressHtml(value, color) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return `<span class="thin-progress" title="${safeValue}%"><span style="--value:${safeValue}%; --status-color:${escapeAttr(color || "var(--teal)")};"></span></span>`;
}

export function projectOverallProgressHtml(project) {
  return overallProgressBlockHtml("Overall Progress", projectOverallPercent(project));
}

export function sprintOverallProgressHtml(sprint) {
  return overallProgressBlockHtml("Overall Progress", sprintOverallPercent(sprint));
}

export function overallProgressBlockHtml(label, percent) {
  return `
    <div class="sprint-overall-progress">
      <div class="sprint-metric-label">
        <span>${escapeHtml(label)}</span>
        <span>${percent}%</span>
      </div>
      ${progressHtml(percent)}
    </div>
  `;
}

export function projectStatusMetricsHtml(project) {
  return workItemStatusMetricsHtml(projectWorkItems(project.id), "No Dev Tasks or Bugs.");
}

export function sprintStatusMetricsHtml(sprint) {
  return workItemStatusMetricsHtml(sprintWorkItems(sprint.id), "No Dev Tasks or Bugs.");
}

export function workItemStatusMetricsHtml(workItems, emptyText) {
  const total = workItems.length;
  if (!total) return `<div class="empty compact-empty">${escapeHtml(emptyText)}</div>`;

  const rows = currentStatuses()
    .map(status => ({
      status,
      count: workItems.filter(task => task.status === status).length
    }))
    .filter(item => item.count > 0);

  return `
    <div class="sprint-status-metrics">
      ${rows.map(item => {
        const percent = Math.round((item.count / total) * 100);
        return `
          <div class="sprint-status-metric">
            <div class="sprint-metric-label">
              <span>${escapeHtml(item.status)}</span>
              <span>${item.count} of ${total}</span>
            </div>
            ${thinProgressHtml(percent, statusColor(item.status))}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

export function statusStyle(status) {
  return `style="--status-color:${escapeAttr(statusColor(status))}"`;
}

export function statusColor(status) {
  const lookup = currentLookups().find(item => item.lookupType === "Status" && item.value === status && item.colorHex);
  return lookup?.colorHex || defaultStatusColor(status);
}

export function defaultStatusColor(status) {
  const colors = ["#6B7680", "#76A9FF", "#35C7BD", "#8AD17C", "#E4C63A", "#E4A53A", "#EE6B70", "#74C476", "#58B6D6", "#9F9CFF", "#C5D35C"];
  const index = currentStatuses().indexOf(status);
  return colors[index >= 0 ? index : 1] || "#76A9FF";
}

export function sprintStatusGraphHtml(sprint, showLegend = true, hideZeroLegend = false) {
  const sprintTasks = sprintWorkItems(sprint.id);
  const total = sprintTasks.length;
  if (!total) return `<div class="empty">No tasks.</div>`;

  const counts = currentStatuses().map(status => ({
    status,
    count: sprintTasks.filter(task => task.status === status).length
  }));
  const legendCounts = hideZeroLegend ? counts.filter(item => item.count > 0) : counts;

  return `
    <div class="status-graph">
      <div class="status-bar">
        ${counts.map(item => item.count ? `<span class="status-color-chip" style="--value:${(item.count / total) * 100}%; --status-color:${escapeAttr(statusColor(item.status))}" title="${escapeAttr(item.status)} ${item.count}"></span>` : "").join("")}
      </div>
      ${showLegend ? `
      <div class="status-legend">
        ${legendCounts.map(item => `<span><i ${statusStyle(item.status)}></i>${escapeHtml(item.status)} ${item.count}</span>`).join("")}
      </div>
      ` : ""}
    </div>
  `;
}

export function bugStatusGraphHtml(bugs) {
  if (!bugs.length) return `<div class="empty compact-empty">No bug reports.</div>`;

  const counts = currentStatuses().map(status => ({
    status,
    count: bugs.filter(bug => bug.status === status).length
  }));

  return `
    <div class="status-graph bug-graph" title="${bugs.length} bug reports">
      <div class="status-bar">
        ${counts.map(item => item.count ? `<span class="status-color-chip" style="--value:${(item.count / bugs.length) * 100}%; --status-color:${escapeAttr(statusColor(item.status))}" title="${escapeAttr(item.status)} ${item.count}"></span>` : "").join("")}
      </div>
    </div>
  `;
}

export function statusLegendHtml() {
  const usedStatuses = currentStatuses().filter(status => currentTasks().some(task => task.status === status));

  return `
    <div class="status-legend dashboard-status-legend">
      ${usedStatuses.map(status => `<span><i ${statusStyle(status)}></i>${escapeHtml(status)}</span>`).join("")}
    </div>
  `;
}

export function statusClass(status) {
  return `status-${currentStatuses().indexOf(status) + 1}`;
}
