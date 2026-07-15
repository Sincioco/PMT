import { visibleDateIndex } from "../../shared/dates.js";
import { taskById } from "../../shared/selectors.js";
import { escapeAttr } from "../../shared/text-and-links.js";
import {
  bugsForTask,
  isTaskCompleted
} from "../../shared/work-item-rules.js?v=20260716-developer-board-status";
import {
  ganttEndDate,
  ganttStartDate
} from "./gantt-calculations.js?v=20260620-render-end-date";

export function createGanttBugExpansion() {
  const expandedTaskIds = new Set();

  return {
    clear: () => expandedTaskIds.clear(),
    has: taskId => expandedTaskIds.has(taskId),
    toggle: taskId => {
      const id = Number(taskId);
      if (expandedTaskIds.has(id)) {
        expandedTaskIds.delete(id);
      } else {
        expandedTaskIds.add(id);
      }
    }
  };
}

export function ganttBugRows(task, sprintBugs) {
  const bugTasks = bugsForTask(task, sprintBugs);
  return {
    bugTasks,
    hasOpenBugs: bugTasks.some(bug => !isTaskCompleted(bug))
  };
}

export function ganttDependencyLines(task, chart) {
  return (task.dependencyTaskIds || [])
    .map(id => taskById(id))
    .filter(dependency => dependency && dependency.sprintId === task.sprintId)
    .map(dependency => {
      const fromIndex = visibleDateIndex(chart.dates, ganttEndDate(dependency), true);
      const toIndex = visibleDateIndex(chart.dates, ganttStartDate(task), false);
      if (fromIndex < 0 || toIndex < 0 || toIndex <= fromIndex) return "";
      return `<span class="gantt-dependency" style="grid-column:${fromIndex + 1} / ${toIndex + 1}" title="Depends on ${escapeAttr(dependency.code)}"></span>`;
    }).join("");
}
