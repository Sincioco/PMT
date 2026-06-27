import {
  activeHolidayMap,
  dateKey,
  dateRange,
  normalizeDate,
  shouldShowTimelineDate,
  visibleDateIndex
} from "../../shared/dates.js";
import {
  projectById,
  projectName
} from "../../shared/selectors.js";

export function roadMapProjects({
  projects,
  sprints,
  projectFilter,
  sprintFilter,
  showSprints,
  sort
}) {
  const selectedSprintId = showSprints && sprintFilter !== "all" ? Number(sprintFilter) : 0;

  return [...projects]
    .filter(project => projectFilter === "all" || String(project.id) === String(projectFilter))
    .filter(project => !selectedSprintId || sprints.some(sprint => sprint.id === selectedSprintId && sprint.projectId === project.id))
    .sort((a, b) => roadMapCompareProjects(a, b, { sprints, sprintFilter, showSprints, sort }));
}

export function roadMapSprintOptions({
  sprints,
  projectFilter
}) {
  const selectedProjectId = projectFilter === "all" ? 0 : Number(projectFilter);

  return [...sprints]
    .filter(sprint => !selectedProjectId || sprint.projectId === selectedProjectId)
    .sort((a, b) => {
      const projectCompare = projectName(a.projectId).localeCompare(projectName(b.projectId));
      if (projectCompare) return projectCompare;
      return roadMapSprintStart(a, projectById(a.projectId)) - roadMapSprintStart(b, projectById(b.projectId)) || a.code.localeCompare(b.code);
    });
}

export function roadMapProjectSprints(project, {
  sprints,
  sprintFilter,
  showSprints
}) {
  if (!showSprints) return [];

  return sprints
    .filter(sprint => sprint.projectId === project.id)
    .filter(sprint => sprintFilter === "all" || String(sprint.id) === String(sprintFilter))
    .sort((a, b) => roadMapSprintStart(a, project) - roadMapSprintStart(b, project) || a.code.localeCompare(b.code));
}

export function roadMapChartData({
  projects,
  sprints,
  holidays,
  sprintFilter,
  showSprints,
  availableTimelineWidth
}) {
  const rows = projects.map(project => {
    const allProjectSprints = sprints.filter(sprint => sprint.projectId === project.id);
    const projectSprints = roadMapProjectSprints(project, { sprints, sprintFilter, showSprints });
    const start = roadMapProjectStart(project);
    const endSourceSprints = showSprints && sprintFilter !== "all" ? projectSprints : allProjectSprints;
    const end = roadMapProjectEnd(project, endSourceSprints);
    const isOngoing = roadMapProjectIsOngoing(project);
    const sprintRows = projectSprints.map(sprint => ({
      sprint,
      start: roadMapSprintStart(sprint, project),
      end: roadMapSprintEnd(sprint, project)
    }));

    return { project, start, end, isOngoing, sprints: sprintRows };
  }).filter(row => row.start && row.end);

  const scheduledItems = rows.flatMap(row => [
    { start: row.start, end: row.end },
    ...row.sprints.map(sprintRow => ({ start: sprintRow.start, end: sprintRow.end }))
  ]).filter(row => row.start && row.end);

  if (!scheduledItems.length) return { rows: [], dates: [], dayWidth: 42, holidays: new Map() };

  const minDate = new Date(Math.min(...scheduledItems.map(row => row.start.getTime())));
  const maxDate = new Date(Math.max(...scheduledItems.map(row => row.end.getTime())));
  const startDates = new Set(scheduledItems.map(row => dateKey(row.start)).filter(Boolean));
  const activeHolidays = activeHolidayMap(holidays);
  const timeline = roadMapTimeline(minDate, maxDate, startDates, activeHolidays, availableTimelineWidth);
  const lastVisibleDate = timeline.dates.at(-1);

  if (lastVisibleDate) {
    rows.forEach(row => {
      if (row.isOngoing) {
        row.end = new Date(lastVisibleDate);
      }
    });
  }

  return {
    rows,
    dates: timeline.dates,
    holidays: activeHolidays,
    dayWidth: timeline.dayWidth,
    granularity: timeline.granularity
  };
}

export function roadMapVisibleDateIndex(dates, targetDate, preferEnd, granularity) {
  const date = granularity === "month" ? firstDayOfMonth(targetDate) : targetDate;
  return visibleDateIndex(dates, date, preferEnd);
}

export function roadMapProjectStart(project) {
  // Projects without explicit dates still need to appear on the roadmap.
  if (!project) return null;
  return normalizeDate(project.startDate || project.createdAt);
}

export function roadMapProjectEnd(project, projectSprints = []) {
  const start = roadMapProjectStart(project);
  const sprintEnds = projectSprints.map(sprint => roadMapSprintEnd(sprint, project)).filter(Boolean);
  const end = normalizeDate(project.endDate) || latestDate([...sprintEnds, normalizeDate(new Date())]);
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

export function roadMapSprintStart(sprint, project) {
  // A sprint with no StartDate begins with its project, per the Road Map rule.
  return normalizeDate(sprint.startDate) || roadMapProjectStart(project) || normalizeDate(sprint.createdAt);
}

export function roadMapSprintEnd(sprint, project) {
  const start = roadMapSprintStart(sprint, project);
  const end = normalizeDate(sprint.endDate) || normalizeDate(new Date());
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function roadMapCompareProjects(a, b, {
  sprints,
  sprintFilter,
  showSprints,
  sort
}) {
  const sortValue = sort || "endAsc";
  const direction = sortValue.endsWith("Desc") ? -1 : 1;
  const useStart = sortValue.startsWith("start");
  const aSprints = showSprints ? roadMapProjectSprints(a, { sprints, sprintFilter, showSprints }) : [];
  const bSprints = showSprints ? roadMapProjectSprints(b, { sprints, sprintFilter, showSprints }) : [];
  const aDate = useStart ? roadMapProjectStart(a) : roadMapProjectEnd(a, aSprints);
  const bDate = useStart ? roadMapProjectStart(b) : roadMapProjectEnd(b, bSprints);
  const dateCompare = (aDate?.getTime() || 0) - (bDate?.getTime() || 0);

  return (dateCompare * direction) || a.code.localeCompare(b.code);
}

function roadMapTimeline(minDate, maxDate, startDates, holidays, availableTimelineWidth) {
  const allDates = dateRange(minDate, maxDate);
  if (allDates.length > 240) {
    const dates = padRoadMapMonthsToViewport(monthRange(minDate, maxDate), availableTimelineWidth);
    return {
      dates,
      granularity: "month",
      dayWidth: roadMapMonthWidth(dates.length, availableTimelineWidth)
    };
  }

  const dates = allDates.filter(date => shouldShowTimelineDate(date, startDates, holidays));
  return {
    dates,
    granularity: "day",
    dayWidth: roadMapDayWidth(dates.length, availableTimelineWidth)
  };
}

function padRoadMapMonthsToViewport(dates, availableTimelineWidth) {
  if (!dates.length) return dates;

  const paddedDates = [...dates];
  const dayWidth = roadMapMonthWidth(paddedDates.length);

  // If the compressed monthly calendar is narrower than the screen, show a few
  // future months so the user gets more useful timeline context.
  while ((paddedDates.length + 1) * dayWidth <= availableTimelineWidth) {
    const nextDate = new Date(paddedDates[paddedDates.length - 1]);
    nextDate.setMonth(nextDate.getMonth() + 1);
    paddedDates.push(nextDate);
  }

  return paddedDates;
}

function roadMapProjectIsOngoing(project) {
  return !normalizeDate(project?.endDate);
}

function latestDate(dates) {
  const times = dates.filter(Boolean).map(date => date.getTime());
  if (!times.length) return null;
  return new Date(Math.max(...times));
}

function roadMapDayWidth(dayCount, availableTimelineWidth) {
  const baseWidth = dayCount > 180 ? 14 : dayCount > 120 ? 18 : dayCount > 60 ? 24 : dayCount > 35 ? 32 : 42;
  return fittedTimelineWidth(dayCount, baseWidth, availableTimelineWidth);
}

function roadMapMonthWidth(monthCount, availableTimelineWidth = 0) {
  const baseWidth = monthCount > 72 ? 14 : monthCount > 48 ? 18 : monthCount > 30 ? 24 : monthCount > 18 ? 32 : 42;
  return fittedTimelineWidth(monthCount, baseWidth, availableTimelineWidth);
}

function fittedTimelineWidth(dateCount, baseWidth, availableTimelineWidth) {
  if (!dateCount) return baseWidth;
  const fittedWidth = Math.floor(Number(availableTimelineWidth || 0) / dateCount);
  return Math.max(baseWidth, fittedWidth);
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
