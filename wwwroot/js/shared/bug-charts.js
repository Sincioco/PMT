import { isBugQaPassedOrLater } from "./work-item-rules.js?v=20260710-export-rich-kanban";

export function bugMixChart(bugs) {
  const resolvedBugs = bugs.filter(isBugQaPassedOrLater);
  const openBugs = bugs.filter(bug => !isBugQaPassedOrLater(bug));
  return { total: bugs.length, resolvedBugs, openBugs };
}

export function bugSeverityChartItems(bugs, severities, getSeverityColor = bugSeverityChartColor) {
  return severities
    .map(severity => ({
      label: severity,
      color: getSeverityColor(severity),
      bugs: bugs.filter(bug => bug.severity === severity)
    }))
    .map(item => ({ ...item, value: item.bugs.length }))
    .filter(item => item.value > 0);
}

export function bugSprintChartRows(bugs, getSprintLabel, getSprint, getItemStartDate) {
  const rows = new Map();

  bugs.forEach(bug => {
    const sprintId = Number(bug.sprintId || 0);
    if (!rows.has(sprintId)) {
      rows.set(sprintId, {
        sprintId,
        label: sprintId ? getSprintLabel(sprintId) : "No Sprint",
        reported: 0,
        resolved: 0,
        open: 0
      });
    }
    const row = rows.get(sprintId);
    row.reported += 1;
    if (isBugQaPassedOrLater(bug)) row.resolved += 1;
    else row.open += 1;
  });

  return [...rows.values()].sort((a, b) => compareSprintRows(a, b, getSprint, getItemStartDate));
}

export function newestBugSprintRows(rows, getSprint, getItemStartDate) {
  return [...rows].sort((a, b) => {
    if (!a.sprintId) return 1;
    if (!b.sprintId) return -1;
    const sprintA = getSprint(a.sprintId);
    const sprintB = getSprint(b.sprintId);
    const aTime = sprintA ? getItemStartDate(sprintA)?.getTime() || 0 : 0;
    const bTime = sprintB ? getItemStartDate(sprintB)?.getTime() || 0 : 0;
    return bTime - aTime || b.label.localeCompare(a.label);
  });
}

export function bugSeverityChartColor(severity) {
  const colors = {
    Trivial: "var(--chart-2)",
    Minor: "var(--chart-1)",
    Major: "var(--chart-4)",
    Critical: "var(--chart-5)"
  };
  return colors[severity] || "var(--chart-7)";
}

export function createBugChartsView({
  projects,
  sprints,
  tasks,
  filters = {},
  severities = [],
  getCurrentSprint = () => null,
  getItemStartDate = item => new Date(item?.startDate || 0)
}) {
  const selectedProjectId = projects.some(project => project.id === Number(filters.projectId))
    ? Number(filters.projectId)
    : 0;
  const projectSprints = sprints.filter(sprint => !selectedProjectId || sprint.projectId === selectedProjectId);
  let selectedSprintId = String(filters.sprintId || (selectedProjectId ? "" : "all"));
  if (selectedSprintId !== "all" && !projectSprints.some(sprint => sprint.id === Number(selectedSprintId))) {
    selectedSprintId = String(getCurrentSprint(projectSprints)?.id || "all");
  }
  const selectedSprint = selectedSprintId === "all"
    ? null
    : projectSprints.find(sprint => sprint.id === Number(selectedSprintId)) || null;
  const allProjectBugs = tasks
    .filter(task => task.taskType === "Bug")
    .filter(bug => !selectedProjectId || bug.projectId === selectedProjectId);
  const sprintBugs = allProjectBugs.filter(bug => selectedSprintId === "all" || bug.sprintId === Number(selectedSprintId));
  const getSprint = sprintId => sprints.find(sprint => sprint.id === Number(sprintId));
  const getProject = projectId => projects.find(project => project.id === Number(projectId));
  const sprintLabel = sprintId => {
    const sprint = getSprint(sprintId);
    if (!sprint) return "Unknown Sprint";
    const project = getProject(sprint.projectId);
    if (selectedProjectId || !project) return sprint.code;
    return `${project.code} - ${shortSprintLabel(sprint, project)}`;
  };
  const rows = newestBugSprintRows(
    bugSprintChartRows(allProjectBugs, sprintLabel, getSprint, getItemStartDate),
    getSprint,
    getItemStartDate
  );
  const mix = bugMixChart(sprintBugs);
  const contextSubtitle = bugContextSubtitle({
    projects,
    selectedProjectId,
    selectedSprint,
    selectedSprintId
  });
  const historySubtitle = !selectedProjectId && selectedSprintId === "all"
    ? "All Projects and All Sprints"
    : getProject(selectedProjectId)
      ? `${getProject(selectedProjectId).code} - All Sprints`
      : "All Sprints";

  return {
    severity: {
      title: "Bug Severity Share",
      subtitle: contextSubtitle,
      total: sprintBugs.length,
      items: bugSeverityChartItems(sprintBugs, severities)
    },
    trend: {
      title: "Bug Trend by Sprint",
      subtitle: historySubtitle,
      rows,
      series: [
        { key: "reported", label: "Reported", color: "var(--rose)" },
        { key: "resolved", label: "Resolved", color: "var(--green)" }
      ]
    },
    mix: {
      title: "Sprint Bug Mix",
      subtitle: contextSubtitle,
      total: mix.total,
      items: [
        { label: "Resolved", value: mix.resolvedBugs.length, color: "var(--green)", bugs: mix.resolvedBugs },
        { label: "Still Open", value: mix.openBugs.length, color: "var(--amber)", bugs: mix.openBugs }
      ].filter(item => item.value > 0)
    },
    reportedResolved: {
      title: "Reported vs Resolved by Sprint",
      subtitle: historySubtitle,
      rows,
      series: [
        { key: "reported", label: "Reported", color: "var(--rose)" },
        { key: "resolved", label: "Resolved", color: "var(--green)" },
        { key: "open", label: "Open", color: "var(--amber)" }
      ]
    }
  };
}

function compareSprintRows(a, b, getSprint, getItemStartDate) {
  if (!a.sprintId) return 1;
  if (!b.sprintId) return -1;
  const sprintA = getSprint(a.sprintId);
  const sprintB = getSprint(b.sprintId);
  const aTime = sprintA ? getItemStartDate(sprintA)?.getTime() || 0 : 0;
  const bTime = sprintB ? getItemStartDate(sprintB)?.getTime() || 0 : 0;
  return aTime - bTime || a.label.localeCompare(b.label);
}

function bugContextSubtitle({ projects, selectedProjectId, selectedSprint, selectedSprintId }) {
  if (!selectedProjectId && selectedSprintId === "all") return "All Projects and All Sprints";
  const project = selectedSprint
    ? projects.find(item => item.id === selectedSprint.projectId)
    : projects.find(item => item.id === selectedProjectId);
  const sprintLabel = selectedSprintId === "all" ? "All Sprints" : shortSprintLabel(selectedSprint, project);
  return project ? `${project.code} - ${sprintLabel}` : sprintLabel;
}

function shortSprintLabel(sprint, project) {
  if (!sprint) return "No Sprint";
  if (!project?.code) return sprint.code;
  const prefix = `${project.code}-`;
  return sprint.code.toLowerCase().startsWith(prefix.toLowerCase())
    ? sprint.code.slice(prefix.length)
    : sprint.code;
}
