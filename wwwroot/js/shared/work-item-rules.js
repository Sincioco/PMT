import {
  fallbackStatuses,
  linkedBugCompletionMessage
} from "./constants.js";

let statusProvider = () => fallbackStatuses;
let taskProvider = () => [];

export function configureWorkItemRules(options = {}) {
  if (options.getStatuses) statusProvider = options.getStatuses;
  if (options.getTasks) taskProvider = options.getTasks;
}

function currentStatuses() {
  return statusProvider() || [];
}

function currentTasks() {
  return taskProvider() || [];
}

function findTaskById(id) {
  return currentTasks().find(task => task.id === id);
}

export function projectWorkItems(projectId) {
  return currentTasks().filter(task => task.projectId === projectId && !task.parentTaskId);
}

export function sprintWorkItems(sprintId) {
  return currentTasks().filter(task => task.sprintId === sprintId && !task.parentTaskId);
}

export function projectOverallPercent(project) {
  const workItems = projectWorkItems(project.id);
  if (!workItems.length) return Number(project.percentCompleted || 0);
  return averageWorkItemPercent(workItems);
}

export function sprintOverallPercent(sprint) {
  const workItems = sprintWorkItems(sprint.id);
  if (!workItems.length) return Number(sprint.percentCompleted || 0);

  return averageWorkItemPercent(workItems);
}

export function averageWorkItemPercent(workItems) {
  if (!workItems.length) return 0;

  // Average Dev Tasks and Bugs so the summary reflects the real workload.
  const totalPercent = workItems.reduce((sum, task) => sum + taskDisplayPercent(task), 0);
  return Math.round(totalPercent / workItems.length);
}

export function bugsForTask(task, sprintBugs) {
  return sprintBugs.filter(bug =>
    bug.id === task.linkedBugTaskId ||
    task.dependencyTaskIds?.includes(bug.id) ||
    bug.dependencyTaskIds?.includes(task.id) ||
    (bug.assigneeIds || []).some(id => (task.assigneeIds || []).includes(id))
  );
}

export function taskDisplayPercent(task) {
  if (task.subTasks?.length) return Math.round(task.subTaskAveragePercent ?? task.percentCompleted ?? 0);
  return percentForStatus(task.status, task.percentCompleted ?? 0);
}

export function percentForStatus(status, currentValue) {
  if (status === "Backlog" || status === "Todo") return Number(currentValue || 0);
  const statuses = currentStatuses();
  const qaPassedIndex = statuses.indexOf("QA Passed");
  if (qaPassedIndex >= 0 && statuses.indexOf(status) >= qaPassedIndex) return 100;
  return Number(currentValue || 0);
}

export function percentForDevTaskSave(status, currentValue) {
  // The database also treats Code Complete as finished for normal Dev Tasks.
  if (status === "Code Complete") return 100;
  return percentForStatus(status, currentValue);
}

export function validateLinkedBugCompletion(task, percentCompleted, dependencyTaskIds) {
  if (Number(percentCompleted || 0) < 100) return;

  const bug = associatedBugForDevTask(task, dependencyTaskIds);
  if (bug && !isBugQaPassedOrLater(bug)) {
    throw new Error(linkedBugCompletionMessage);
  }
}

export function associatedBugForDevTask(task, dependencyTaskIds = []) {
  if (task?.linkedBugTaskId) {
    const linkedBug = findTaskById(task.linkedBugTaskId);
    if (linkedBug?.taskType === "Bug") return linkedBug;
  }

  return (dependencyTaskIds || [])
    .map(id => findTaskById(id))
    .find(item => item?.taskType === "Bug") || null;
}

export function isBugQaPassedOrLater(bug) {
  const statuses = currentStatuses();
  const qaPassedIndex = statuses.indexOf("QA Passed");
  const bugStatusIndex = statuses.indexOf(bug?.status || "");
  return qaPassedIndex >= 0 && bugStatusIndex >= qaPassedIndex;
}

export function isTaskCompleted(task) {
  const statuses = currentStatuses();
  const qaPassedIndex = statuses.indexOf("QA Passed");
  const taskStatusIndex = statuses.indexOf(task.status);
  return Number(task.percentCompleted || 0) >= 100 || (qaPassedIndex >= 0 && taskStatusIndex >= qaPassedIndex);
}

export function taskOrderCompare(a, b) {
  return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.id - b.id;
}

export function taskCreatedTime(task) {
  return new Date(task.createdAt || 0).getTime();
}

export function taskRowsWithSubTasks(tasks) {
  const taskIds = new Set(tasks.map(task => task.id));
  const childTasks = new Map();
  const rows = [];
  const rendered = new Set();

  tasks.forEach(task => {
    if (!task.parentTaskId || !taskIds.has(task.parentTaskId)) return;
    if (!childTasks.has(task.parentTaskId)) childTasks.set(task.parentTaskId, []);
    childTasks.get(task.parentTaskId).push(task);
  });

  const addTaskAndChildren = (task, level) => {
    if (rendered.has(task.id)) return;
    rendered.add(task.id);
    rows.push({ task, level });
    (childTasks.get(task.id) || []).forEach(child => addTaskAndChildren(child, level + 1));
  };

  tasks
    .filter(task => !task.parentTaskId || !taskIds.has(task.parentTaskId))
    .forEach(task => addTaskAndChildren(task, task.parentTaskId ? 1 : 0));

  // Keep orphaned or cyclic sub-tasks visible instead of silently hiding them.
  tasks.forEach(task => addTaskAndChildren(task, task.parentTaskId ? 1 : 0));

  return rows;
}

export function dependencyCandidates(projectId, workItemId = 0) {
  return currentTasks().filter(task => task.projectId === projectId && task.id !== workItemId);
}

export function reporterIdsOrDefault(reporterIds, currentUserId) {
  return reporterIds?.length ? reporterIds : [currentUserId];
}

export function allowedAssigneeUsers(users, project, sprint = null) {
  const memberIds = new Set(sprint?.developerIds || project?.memberIds || []);
  return users.filter(user => user.isActive !== false && memberIds.has(user.id));
}
