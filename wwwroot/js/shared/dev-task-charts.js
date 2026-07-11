import { isTaskCompleted } from "./work-item-rules.js?v=20260710-export-rich-kanban";
import { createDevTaskWorkloadView } from "./dev-task-workload.js?v=20260712-about-workload-billboard";

export function devTaskMixChart(tasks) {
  const completedTasks = tasks.filter(isTaskCompleted);
  const openTasks = tasks.filter(task => !isTaskCompleted(task));
  const total = tasks.length;

  return {
    total,
    completedTasks,
    openTasks,
    completedPercent: total ? Math.round((completedTasks.length / total) * 100) : 0,
    openPercent: total ? Math.round((openTasks.length / total) * 100) : 0
  };
}

export function devTaskStatusChartItems(tasks, statuses, getStatusColor) {
  return statuses
    .filter(status => !status.toLowerCase().includes("qa") && status.toLowerCase() !== "backlog")
    .map(status => ({
      label: status,
      color: getStatusColor(status),
      tasks: tasks.filter(task => task.status === status)
    }))
    .map(item => ({ ...item, value: item.tasks.length }))
    .filter(item => item.value > 0);
}

export function devTaskCompletedSprintRows(devTasks, sprints, getItemStartDate) {
  return [...sprints]
    .sort((a, b) => (getItemStartDate(b)?.getTime() || 0)
      - (getItemStartDate(a)?.getTime() || 0)
      || b.code.localeCompare(a.code))
    .map(sprint => {
      const sprintTasks = devTasks.filter(task => task.sprintId === sprint.id);
      return {
        sprintId: sprint.id,
        label: sprint.code,
        total: sprintTasks.length,
        completed: sprintTasks.filter(isTaskCompleted).length
      };
    })
    .filter(row => row.total > 0 || row.completed > 0);
}

export function createDevTaskChartsView({
  users,
  projects,
  sprints,
  tasks,
  projectId = 0,
  sprintMode = "all",
  getCurrentSprint = () => null,
  getItemStartDate = item => new Date(item?.startDate || 0),
  statuses = [],
  getStatusColor
}) {
  const workload = createDevTaskWorkloadView({
    users,
    projects,
    sprints,
    tasks,
    projectId,
    sprintMode,
    getCurrentSprint,
    statuses,
    getStatusColor
  });
  const selectedProjectId = workload.projectId;
  const selectedSprintMode = workload.sprintMode;
  const projectSprints = sprints.filter(sprint => !selectedProjectId || sprint.projectId === selectedProjectId);
  const devTasks = tasks
    .filter(task => task.taskType !== "Bug")
    .filter(task => !selectedProjectId || task.projectId === selectedProjectId);
  const sprintTasks = devTasks.filter(task => {
    if (selectedSprintMode === "all") return true;
    if (selectedSprintMode === "current" && !selectedProjectId) {
      const currentSprint = getCurrentSprint(sprints.filter(sprint => sprint.projectId === task.projectId));
      return currentSprint ? task.sprintId === currentSprint.id : false;
    }
    return workload.selectedSprint ? task.sprintId === workload.selectedSprint.id : false;
  });
  const mix = devTaskMixChart(sprintTasks);
  const currentSprint = getCurrentSprint(projectSprints);

  return {
    workload,
    status: {
      title: "Sprint Dev Tasks by Status",
      subtitle: workload.subtitle,
      items: devTaskStatusChartItems(sprintTasks, statuses, getStatusColor),
      emptyText: "No non-QA Dev Task statuses are available for the selected Sprint filter."
    },
    mix: {
      title: "Sprint Dev Task Mix",
      subtitle: workload.subtitle,
      total: mix.total,
      completedPercent: mix.completedPercent,
      openPercent: mix.openPercent,
      items: [
        { label: "Completed", value: mix.completedTasks.length, color: "var(--color-success)", tasks: mix.completedTasks },
        { label: "Still Open", value: mix.openTasks.length, color: "var(--color-warning)", tasks: mix.openTasks }
      ].filter(item => item.value > 0)
    },
    completed: {
      title: "Dev Tasks Completed by Sprint",
      subtitle: devTaskHistorySubtitle(projects, selectedProjectId, selectedSprintMode),
      available: Boolean(currentSprint),
      rows: currentSprint
        ? devTaskCompletedSprintRows(devTasks, projectSprints, getItemStartDate)
        : [],
      series: [
        { key: "total", label: "Dev Tasks", color: "var(--chart-1)" },
        { key: "completed", label: "Completed", color: "var(--color-success)" }
      ]
    }
  };
}

function devTaskHistorySubtitle(projects, projectId, sprintMode) {
  if (!projectId && sprintMode === "all") return "All Projects and All Sprints";
  const project = projects.find(item => item.id === projectId);
  return project ? `${project.code} - All Sprints` : "All Sprints";
}
