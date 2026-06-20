import {
  activeHolidayMap,
  dateKey,
  dateRange,
  normalizeDate,
  shouldShowTimelineDate
} from "../../shared/dates.js";

export function sortGanttSprints(sprints, ganttSort) {
  const direction = ganttSort === "startDesc" ? -1 : 1;

  return [...sprints].sort((a, b) => {
    const aStart = ganttStartDate(a)?.getTime() || 0;
    const bStart = ganttStartDate(b)?.getTime() || 0;
    return ((aStart - bStart) * direction) || a.code.localeCompare(b.code);
  });
}

export function sortGanttSprintOptions(sprints) {
  // The dropdown is easier to use when recent sprints are listed first.
  return [...sprints].sort((a, b) => {
    const aStart = ganttStartDate(a)?.getTime() || 0;
    const bStart = ganttStartDate(b)?.getTime() || 0;
    return (bStart - aStart) || a.code.localeCompare(b.code);
  });
}

export function selectedGanttSprint(projectSprints, ganttSprintMode) {
  if (ganttSprintMode === "all") return null;
  if (ganttSprintMode === "current") return currentSprintForProject(projectSprints);
  return projectSprints.find(sprint => sprint.id === Number(ganttSprintMode)) || currentSprintForProject(projectSprints);
}

export function currentSprintForProject(projectSprints) {
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

export function ganttChartData({
  project,
  sprints,
  selectedSprint = null,
  scrollSprint = null,
  showNonWorkingDays = false,
  tasks,
  holidays,
  availableTimelineWidth
}) {
  const projectTasks = tasks
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
  const activeHolidays = activeHolidayMap(holidays);
  const dates = dateRange(minDate, maxDate).filter(date => shouldShowTimelineDate(date, startDates, activeHolidays, showNonWorkingDays));

  return {
    project,
    sprints,
    dates,
    holidays: activeHolidays,
    dayWidth: ganttDayWidth(dates, sprints, scrollSprint, availableTimelineWidth),
    scrollDate: scrollSprint ? ganttStartDate(scrollSprint) : null
  };
}

export function ganttStartDate(item) {
  // StartDate is optional, so CreatedAt gives old tasks a reasonable place on the chart.
  return normalizeDate(item?.startDate || item?.startedAt || item?.createdAt);
}

export function ganttEndDate(item) {
  const start = ganttStartDate(item);
  const end = normalizeDate(item?.endDate) || normalizeDate(new Date());
  if (!start) return end;
  if (!end || end < start) return start;
  return end;
}

function ganttDayWidth(dates, sprints, focusSprint, availableTimelineWidth) {
  const baseWidth = dates.length > 700 ? 12 : dates.length > 365 ? 14 : dates.length > 180 ? 16 : dates.length > 120 ? 18 : dates.length > 60 ? 24 : dates.length > 35 ? 32 : 42;
  if (!isTypicalTwoWeekSprintProject(sprints)) return baseWidth;

  const sprint = focusSprint || sprints[0];
  if (!sprint) return baseWidth;
  const sprintStart = ganttStartDate(sprint);
  const sprintEnd = ganttEndDate(sprint);
  const sprintVisibleDayCount = dates.filter(date => date >= sprintStart && date <= sprintEnd).length || 10;
  const fitWidth = Math.floor(availableTimelineWidth / Math.max(8, sprintVisibleDayCount));

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
