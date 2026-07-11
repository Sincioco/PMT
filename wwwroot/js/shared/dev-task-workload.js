export function devTaskWorkloadCategories(tasks, statuses = [], getStatusColor = defaultStatusColor) {
  const labels = uniqueStrings([
    ...statuses,
    ...tasks.map(task => task.status || "Unspecified")
  ]);

  return labels.map((label, index) => ({
    label,
    color: getStatusColor(label),
    fallbackColor: fallbackStatusColor(label, index)
  }));
}

export function devTaskWorkloadRows(
  users,
  tasks,
  categories = devTaskWorkloadCategories(tasks)
) {
  return users.map(user => {
    const userTasks = tasks.filter(task => (task.assigneeIds || []).map(String).includes(String(user.id)));
    const workloadCategories = categories
      .map(category => {
        const categoryTasks = userTasks.filter(task => (task.status || "Unspecified") === category.label);
        return {
          ...category,
          value: categoryTasks.length,
          tasks: categoryTasks
        };
      })
      .filter(category => category.value > 0);

    return {
      user,
      total: userTasks.length,
      categories: workloadCategories
    };
  }).filter(row => row.total > 0);
}

export function createDevTaskWorkloadView({
  users,
  projects,
  sprints,
  tasks,
  projectId = 0,
  sprintMode = "all",
  getCurrentSprint = () => null,
  statuses = [],
  getStatusColor = defaultStatusColor
}) {
  const selectedProjectId = projects.some(project => project.id === Number(projectId))
    ? Number(projectId)
    : 0;
  const projectSprints = sprints.filter(sprint => !selectedProjectId || sprint.projectId === selectedProjectId);
  let selectedSprintMode = String(sprintMode || "all");

  if (selectedSprintMode !== "all"
    && selectedSprintMode !== "current"
    && !projectSprints.some(sprint => sprint.id === Number(selectedSprintMode))) {
    selectedSprintMode = projectSprints.length ? "current" : "all";
  }

  const selectedSprint = selectedSprintMode === "all"
    ? null
    : selectedSprintMode === "current"
      ? getCurrentSprint(projectSprints)
      : projectSprints.find(sprint => sprint.id === Number(selectedSprintMode))
        || getCurrentSprint(projectSprints);
  const devTasks = tasks
    .filter(task => !selectedProjectId || task.projectId === selectedProjectId)
    .filter(task => task.taskType !== "Bug");
  const sprintTasks = devTasks.filter(task => {
    if (selectedSprintMode === "all") return true;
    if (selectedSprintMode === "current" && !selectedProjectId) {
      const currentSprint = getCurrentSprint(sprints.filter(sprint => sprint.projectId === task.projectId));
      return currentSprint ? task.sprintId === currentSprint.id : false;
    }
    return selectedSprint ? task.sprintId === selectedSprint.id : false;
  });

  const categories = devTaskWorkloadCategories(sprintTasks, statuses, getStatusColor);

  return {
    title: "Developer Workload Distribution",
    subtitle: workloadSubtitle({
      projects,
      selectedProjectId,
      selectedSprint,
      selectedSprintMode
    }),
    projectId: selectedProjectId,
    sprintMode: selectedSprintMode,
    selectedSprint,
    categories,
    rows: devTaskWorkloadRows(users, sprintTasks, categories)
  };
}

function uniqueStrings(values) {
  const unique = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function defaultStatusColor(status) {
  return fallbackStatusColor(status, 0);
}

function fallbackStatusColor(status, index) {
  const colors = [
    "#6b7680",
    "#76a9ff",
    "#35c7bd",
    "#8ad17c",
    "#e4c63a",
    "#e4a53a",
    "#ee6b70",
    "#74c476",
    "#58b6d6",
    "#9f9cff",
    "#c5d35c"
  ];
  let hash = Number(index) || 0;
  for (const character of String(status || "")) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

function workloadSubtitle({ projects, selectedProjectId, selectedSprint, selectedSprintMode }) {
  if (!selectedProjectId && selectedSprintMode === "all") return "All Projects and All Sprints";
  if (!selectedProjectId && selectedSprintMode === "current") return "All Projects - Current Sprint";

  const project = selectedSprint
    ? projects.find(item => item.id === selectedSprint.projectId)
    : projects.find(item => item.id === selectedProjectId);
  const sprintLabel = selectedSprintMode === "all"
    ? "All Sprints"
    : chartSprintLabel(selectedSprint, project);

  return project ? `${project.code} - ${sprintLabel}` : sprintLabel;
}

function chartSprintLabel(sprint, project) {
  if (!sprint) return "No Sprint";
  if (!project?.code) return sprint.code;

  const prefix = `${project.code}-`;
  return sprint.code.toLowerCase().startsWith(prefix.toLowerCase())
    ? sprint.code.slice(prefix.length)
    : sprint.code;
}
