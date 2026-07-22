import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent, funnelIconHtml } from "../../components/buttons.js";
import { statusColor } from "../../components/progress-and-status.js?v=20260714-linked-bug-percent";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-22-day-35-030fe4bab912";
import {
  groupedTimelineHeader,
  monthName,
  timelineDateClass,
  timelineDateTitle,
  visibleDateIndex
} from "../../shared/dates.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import { taskDisplayPercent } from "../../shared/work-item-rules.js?v=20260716-developer-board-status";
import {
  ganttBugRows,
  ganttDependencyLines
} from "./gantt-bugs-dependencies.js?v=20260714-linked-bug-percent";
import {
  ganttEndDate,
  ganttStartDate
} from "./gantt-calculations.js?v=20260620-render-end-date";

const bugIconUrl = "/assets/bug.svg?v=20260629-kanban-gantt-bug-icon";

export function ganttScreenHtml({
  projects,
  projectId,
  sprintMode,
  sort,
  renderMode,
  showNonWorkingDays,
  showAllBugs,
  isTaskExpanded,
  sprintOptions,
  chart,
  tasks,
  flyBy
}) {
  return `
    <div class="gantt-screen work-item-screen">
      ${sectionHead("Gantt", `
        <button class="secondary text-icon-button ${renderMode === "selected" ? "is-on" : ""}" type="button" data-action="toggle-gantt-render-mode" title="${renderMode === "selected" ? "Show All Sprints" : "Show Selected Sprint Only"}" aria-label="${renderMode === "selected" ? "Show All Sprints" : "Show Selected Sprint Only"}" aria-pressed="${renderMode === "selected"}">${buttonContent(renderMode === "selected" ? "&#9638;" : "&#9673;", renderMode === "selected" ? "Show All Sprints" : "Show Selected Sprint Only")}</button>
        <button class="secondary text-icon-button ${showNonWorkingDays ? "is-on" : ""}" type="button" data-action="toggle-gantt-days" title="${showNonWorkingDays ? "Hide weekends and holidays" : "Show weekends and holidays"}" aria-label="${showNonWorkingDays ? "Hide weekends and holidays" : "Show weekends and holidays"}" aria-pressed="${showNonWorkingDays}">${buttonContent("&#128197;", showNonWorkingDays ? "Hide weekends and holidays" : "Show weekends and holidays")}</button>
        <button class="secondary text-icon-button ${flyBy.active ? "is-on" : ""}" type="button" data-action="gantt-flyby" title="${flyBy.title}" aria-label="${flyBy.title}" aria-pressed="${flyBy.active}">${buttonContent(flyBy.icon, flyBy.title)}</button>
        <button class="secondary text-icon-button" type="button" data-action="open-gantt-filters" title="Filters" aria-label="Filters" aria-haspopup="dialog">${buttonContent(funnelIconHtml(), "Filters")}</button>
        <button class="secondary text-icon-button" type="button" data-action="reset-gantt-view" title="Reset Gantt view" aria-label="Reset Gantt view">${buttonContent("&#8634;", "Reset Gantt view")}</button>
      `)}
      ${chart.dates.length ? ganttChartHtml(chart, { tasks, showAllBugs, isTaskExpanded }) : `<div class="empty">No scheduled items for this project yet.</div>`}
    </div>
  `;
}

export function ganttFilterFieldsHtml({
  projects,
  projectId,
  sprintMode,
  sort,
  sprintOptions,
  showAllBugs
}) {
  return `
    <div class="tasks-filter-panel gantt-filter-panel">
      <div class="task-filter-row gantt-filter-row">
        <label>
          <span>Project</span>
          <select data-filter="gantt-project">
            ${projects.map(item => `<option value="${item.id}" ${item.id === projectId ? "selected" : ""}>${escapeHtml(item.code)} - ${escapeHtml(item.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="gantt-sprint">
            <option value="current" ${sprintMode === "current" ? "selected" : ""}>Current Sprint</option>
            <option value="all" ${sprintMode === "all" ? "selected" : ""}>All Sprints</option>
            ${sprintOptions.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(sprintMode) ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="gantt-sort">
            <option value="startAsc" ${sort === "startAsc" ? "selected" : ""}>Start Date Ascending</option>
            <option value="startDesc" ${sort === "startDesc" ? "selected" : ""}>Start Date Descending</option>
          </select>
        </label>
        <label class="inline-filter-check">
          <input type="checkbox" data-filter="gantt-show-all-bugs" ${showAllBugs ? "checked" : ""}>
          <span class="checkbox-label-text">Expand Bugs</span>
        </label>
      </div>
    </div>
  `;
}

function ganttChartHtml(chart, options) {
  const years = groupedTimelineHeader(chart.dates, date => date.getFullYear());
  const quarters = groupedTimelineHeader(chart.dates, date => `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`);
  const months = groupedTimelineHeader(chart.dates, date => `${date.getFullYear()}-${date.getMonth()}`);

  return `
    <div class="gantt panel" style="--day-width:${chart.dayWidth}px; --date-count:${chart.dates.length}">
      <div class="gantt-scroll">
        <div class="gantt-grid gantt-header">
          <div class="gantt-left-head">Sprint</div>
          <div class="gantt-timeline">
            <div class="gantt-row gantt-years">${years.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label)}</div>`).join("")}</div>
            <div class="gantt-row gantt-quarters">${quarters.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label.split(" ")[1])}</div>`).join("")}</div>
            <div class="gantt-row gantt-months">${months.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(monthName(group.firstDate))}</div>`).join("")}</div>
            <div class="gantt-row gantt-days">${chart.dates.map(date => `<div class="${timelineDateClass(date, chart.holidays)}" title="${escapeAttr(timelineDateTitle(date, chart.holidays))}">${ganttDayLabel(date, chart)}</div>`).join("")}</div>
          </div>
        </div>
        ${chart.sprints.map(sprint => ganttSprintHtml(sprint, chart, options)).join("") || `<div class="empty">No Sprints for this project.</div>`}
      </div>
    </div>
  `;
}

function ganttSprintHtml(sprint, chart, options) {
  const sprintTasks = options.tasks
    .filter(task => task.sprintId === sprint.id && task.taskType !== "Bug")
    .sort((a, b) => ganttStartDate(a) - ganttStartDate(b) || a.id - b.id);
  const sprintBugs = options.tasks.filter(task => task.sprintId === sprint.id && task.taskType === "Bug");
  const sprintTooltip = `${sprint.code} - ${sprint.title} (${sprintTasks.length} tasks)`;

  return `
    <div class="gantt-grid gantt-sprint-block" data-gantt-sprint-id="${sprint.id}">
      <button type="button" class="gantt-sprint-name" data-action="view-sprint-tasks" data-id="${sprint.id}" title="${escapeAttr(sprintTooltip)}">
        <strong>${escapeHtml(sprint.code)}</strong>
        <span>${escapeHtml(sprint.title)}</span>
      </button>
      <div class="gantt-task-stack">
        ${sprintTasks.map(task => ganttTaskHtml(task, sprintBugs, chart, options)).join("") || `<div class="empty compact-empty">No tasks.</div>`}
      </div>
    </div>
  `;
}

function ganttTaskHtml(task, sprintBugs, chart, options) {
  const { bugTasks, hasOpenBugs } = ganttBugRows(task, sprintBugs);
  const showBugs = options.showAllBugs || options.isTaskExpanded(task.id);

  return `
    <div class="gantt-task-group">
      <div class="gantt-lane">
        ${ganttDependencyLines(task, chart)}
        <div class="gantt-bar" role="button" tabindex="0" data-action="gantt-open-task" data-id="${task.id}" ${ganttGridStyle(task, chart)} title="${escapeAttr(task.code + " " + task.title)}">
          ${avatarsHtml(task.assignees)}
          <span>${escapeHtml(task.code)} ${escapeHtml(task.title)}</span>
          ${bugTasks.length ? `<button type="button" class="gantt-bug-button ${hasOpenBugs ? "open-bugs" : "closed-bugs"}" data-action="toggle-gantt-task-bugs" data-id="${task.id}" title="Show bug reports" aria-label="Show bug reports"><img class="gantt-bug-icon" src="${bugIconUrl}" alt="" aria-hidden="true"></button>` : ""}
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
  const startIndex = Math.max(0, visibleDateIndex(chart.dates, start, false));
  let endIndex = visibleDateIndex(chart.dates, end, true);
  if (endIndex < startIndex) endIndex = startIndex;

  const span = Math.max(2, endIndex - startIndex + 1);
  return `style="grid-column:${startIndex + 1} / span ${span}; --status-color:${escapeAttr(statusColor(item.status || "Todo"))}"`;
}

function ganttDayLabel(date, chart) {
  const day = date.getDate();
  if (chart.dayWidth <= 12) return [1, 5, 10, 15, 20, 25].includes(day) ? String(day) : "";
  if (chart.dayWidth <= 16) return day === 1 || day % 2 === 0 ? String(day) : "";
  return String(day);
}
