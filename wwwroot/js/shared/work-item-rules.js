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
