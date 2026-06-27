import { avatarsHtml } from "../../components/avatars.js";
import { buttonContent } from "../../components/buttons.js";
import { completionColor } from "../../components/progress-and-status.js?v=20260627-project-status-mix";
import { sectionHead } from "../../components/sections.js";
import {
  dateRangeLabel,
  formatDate,
  groupedTimelineHeader,
  isHoliday,
  monthName,
  timelineDateTitle
} from "../../shared/dates.js";
import {
  escapeAttr,
  escapeHtml
} from "../../shared/text-and-links.js";
import { roadMapVisibleDateIndex } from "./roadmap-calculations.js?v=20260620-render-end-date";

export function roadMapScreenHtml({
  projects,
  sprintOptions,
  projectFilter,
  sprintFilter,
  sort,
  showDates,
  showDetails,
  showSprints,
  chart
}) {
  return `
    ${sectionHead("Road Map", "")}
    <div class="panel timeline-control-panel roadmap-control-panel">
      <div class="filter-row">
        <label>
          <span>Project</span>
          <select data-filter="roadmap-project">
            <option value="all" ${projectFilter === "all" ? "selected" : ""}>All Projects</option>
            ${projects.map(project => `<option value="${project.id}" ${String(project.id) === String(projectFilter) ? "selected" : ""}>${escapeHtml(project.code)} - ${escapeHtml(project.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sprint</span>
          <select data-filter="roadmap-sprint" ${showSprints ? "" : "disabled"}>
            <option value="all" ${sprintFilter === "all" ? "selected" : ""}>All Sprints</option>
            ${sprintOptions.map(sprint => `<option value="${sprint.id}" ${String(sprint.id) === String(sprintFilter) ? "selected" : ""}>${escapeHtml(sprint.code)} - ${escapeHtml(sprint.title)}</option>`).join("")}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select data-filter="roadmap-sort">
            <option value="endAsc" ${sort === "endAsc" ? "selected" : ""}>End date ascending</option>
            <option value="endDesc" ${sort === "endDesc" ? "selected" : ""}>End date descending</option>
            <option value="startAsc" ${sort === "startAsc" ? "selected" : ""}>Start date ascending</option>
            <option value="startDesc" ${sort === "startDesc" ? "selected" : ""}>Start date descending</option>
          </select>
        </label>
        <div class="roadmap-filter-actions">
          <button class="secondary text-icon-button" type="button" data-action="toggle-roadmap-sprints">${buttonContent(showSprints ? "&#8722;" : "&#43;", showSprints ? "Hide Sprints" : "Show Sprints")}</button>
          <button class="icon-action ${showDates ? "is-on" : ""}" type="button" data-action="toggle-roadmap-dates" title="${showDates ? "Hide start/end dates" : "Show start/end dates"}" aria-pressed="${showDates}">&#128197;</button>
          <button class="icon-action ${showDetails ? "is-on" : ""}" type="button" data-action="toggle-roadmap-details" title="${showDetails ? "Hide avatars and percent text" : "Show avatars and percent text"}" aria-pressed="${showDetails}">%</button>
        </div>
      </div>
    </div>
    ${chart.dates.length ? roadMapChartHtml(chart, { showDates, showDetails, showSprints }) : `<div class="empty">No Project or Sprint dates are available yet.</div>`}
  `;
}

function roadMapChartHtml(chart, options) {
  const years = groupedTimelineHeader(chart.dates, date => date.getFullYear());
  const quarters = groupedTimelineHeader(chart.dates, date => `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`);
  const months = groupedTimelineHeader(chart.dates, date => `${date.getFullYear()}-${date.getMonth()}`);
  const dayRow = chart.granularity === "day"
    ? `<div class="roadmap-row roadmap-days">${chart.dates.map(date => `<div class="${isHoliday(date, chart.holidays) ? "holiday-day" : ""}" title="${escapeAttr(timelineDateTitle(date, chart.holidays))}">${date.getDate()}</div>`).join("")}</div>`
    : "";

  return `
    <div class="roadmap panel roadmap-${chart.granularity}-timeline" style="--day-width:${chart.dayWidth}px; --date-count:${chart.dates.length}">
      <div class="roadmap-scroll">
        <div class="roadmap-calendar roadmap-header">
          <div class="roadmap-row roadmap-years">${years.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label)}</div>`).join("")}</div>
          <div class="roadmap-row roadmap-quarters">${quarters.map(group => `<div style="grid-column:span ${group.count}">${escapeHtml(group.label.split(" ")[1])}</div>`).join("")}</div>
          <div class="roadmap-row roadmap-months">
  ${months.map(group => {
      const fullMonthLabel = `${monthName(group.firstDate)} ${group.firstDate.getFullYear()}`;
      const monthLabel = roadMapMonthHeaderLabel(group.firstDate, chart.dayWidth);

      return `
      <div
        class="${roadMapMonthHeaderClass(chart.dayWidth)}"
        style="grid-column:span ${group.count}"
        title="${escapeAttr(fullMonthLabel)}"
      >
        ${escapeHtml(monthLabel)}
      </div>
    `;
  }).join("")}
</div>
          ${dayRow}
        </div>
        ${chart.rows.map(row => roadMapProjectHtml(row, chart, options)).join("")}
      </div>
    </div>
  `;
}

function roadMapProjectHtml(row, chart, options) {
  return `
    <section class="roadmap-project-group">
      <div class="roadmap-lane roadmap-project-lane">
        <div class="roadmap-bar roadmap-project-bar" role="button" tabindex="0" data-action="view-project-sprints" data-id="${row.project.id}" ${roadMapGridStyle(row.start, row.end, chart, true)} title="${escapeAttr(roadMapProjectTooltip(row))}">
          <strong>${escapeHtml(row.project.code)} - ${escapeHtml(row.project.title)}</strong>
          ${options.showDates || options.showDetails ? `
          <div class="roadmap-second-line">
            ${options.showDetails ? `${avatarsHtml(row.project.members)}<span>${row.project.percentCompleted}% complete</span>` : ""}
            ${options.showDates ? `<span class="roadmap-date-range">${escapeHtml(dateRangeLabel(row.start, row.end))}</span>` : ""}
          </div>
          ` : ""}
          <i style="--value:${row.project.percentCompleted}%; --progress-color:${completionColor(row.project.percentCompleted)}"></i>
        </div>
      </div>
      ${options.showSprints ? (row.sprints.map(sprintRow => roadMapSprintHtml(sprintRow, chart, options)).join("") || `<div class="empty compact-empty">No Sprints match the current filter.</div>`) : ""}
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

function roadMapSprintHtml(row, chart, options) {
  return `
    <div class="roadmap-lane roadmap-sprint-lane">
      <div class="roadmap-bar roadmap-sprint-bar" role="button" tabindex="0" data-action="view-sprint-tasks" data-id="${row.sprint.id}" ${roadMapGridStyle(row.start, row.end, chart, false)} title="${escapeAttr(row.sprint.code + " " + row.sprint.title)}">
        <strong>${escapeHtml(row.sprint.code)} - ${escapeHtml(row.sprint.title)}</strong>
        ${options.showDates || options.showDetails ? `
        <div class="roadmap-second-line">
          ${options.showDetails ? `${avatarsHtml(row.sprint.developers)}<span>${row.sprint.percentCompleted}% complete</span>` : ""}
          ${options.showDates ? `<span class="roadmap-date-range">${escapeHtml(dateRangeLabel(row.start, row.end))}</span>` : ""}
        </div>
        ` : ""}
        <i style="--value:${row.sprint.percentCompleted}%; --progress-color:${completionColor(row.sprint.percentCompleted)}"></i>
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

function roadMapMonthHeaderLabel(date, dayWidth) {
    const label = monthName(date);

    if (dayWidth <= 18) return label.slice(0, 1);
    if (dayWidth <= 28) return label.slice(0, 2);

    return label;
}

function roadMapMonthHeaderClass(dayWidth) {
    if (dayWidth <= 18) return "roadmap-month-label roadmap-month-label-narrow";
    if (dayWidth <= 28) return "roadmap-month-label roadmap-month-label-compact";

    return "roadmap-month-label";
}
