import test from "node:test";
import assert from "node:assert/strict";

import { fallbackStatuses, linkedBugCompletionMessage } from "../../wwwroot/js/shared/constants.js";
import {
  allowedAssigneeUsers,
  associatedBugForDevTask,
  averageWorkItemPercent,
  bugsForTask,
  configureWorkItemRules,
  dependencyCandidates,
  isBugQaPassedOrLater,
  isTaskCompleted,
  percentForDevTaskSave,
  percentForStatus,
  projectOverallPercent,
  reporterIdsOrDefault,
  sprintOverallPercent,
  taskDisplayPercent,
  taskOrderCompare,
  taskRowsWithSubTasks,
  validateLinkedBugCompletion
} from "../../wwwroot/js/shared/work-item-rules.js";

function configure(tasks = [], statuses = fallbackStatuses) {
  configureWorkItemRules({
    getStatuses: () => statuses,
    getTasks: () => tasks
  });
}

test("status percent rules preserve in-progress values and force QA-passed statuses to 100", () => {
  configure();

  assert.equal(percentForStatus("Backlog", 35), 35);
  assert.equal(percentForStatus("Todo", 20), 20);
  assert.equal(percentForStatus("Ready for QA", 80), 80);
  assert.equal(percentForStatus("QA Passed", 60), 100);
  assert.equal(percentForStatus("Deployed in Prod", 0), 100);
  assert.equal(percentForDevTaskSave("Code Complete", 50), 100);
});

test("top-level project and sprint percentages average visible work items", () => {
  const tasks = [
    { id: 1, projectId: 10, sprintId: 20, status: "QA Passed", percentCompleted: 10 },
    { id: 2, projectId: 10, sprintId: 20, status: "In Progress", percentCompleted: 40 },
    { id: 3, projectId: 10, sprintId: 20, parentTaskId: 1, status: "Todo", percentCompleted: 0 },
    { id: 4, projectId: 11, sprintId: 21, status: "Todo", percentCompleted: 90 }
  ];
  configure(tasks);

  assert.equal(projectOverallPercent({ id: 10, percentCompleted: 5 }), 70);
  assert.equal(sprintOverallPercent({ id: 20, percentCompleted: 5 }), 70);
  assert.equal(projectOverallPercent({ id: 99, percentCompleted: 45 }), 45);
  assert.equal(sprintOverallPercent({ id: 99, percentCompleted: 55 }), 55);
});

test("task display and average percent use sub-task averages and status-based completion", () => {
  configure();
  const tasks = [
    { id: 1, status: "QA Passed", percentCompleted: 25 },
    { id: 2, status: "In Progress", percentCompleted: 40 },
    { id: 3, status: "Todo", percentCompleted: 0, subTasks: [{}], subTaskAveragePercent: 66 }
  ];

  assert.equal(taskDisplayPercent(tasks[0]), 100);
  assert.equal(taskDisplayPercent(tasks[2]), 66);
  assert.equal(averageWorkItemPercent(tasks), 69);
});

test("linked bug completion guard blocks completion until the bug is QA passed or later", () => {
  const linkedBug = { id: 100, taskType: "Bug", status: "QA in Progress" };
  const dependencyBug = { id: 101, taskType: "Bug", status: "Deployed in SIT" };
  const devTask = { id: 200, taskType: "Dev", linkedBugTaskId: linkedBug.id };
  configure([linkedBug, dependencyBug, devTask]);

  assert.equal(associatedBugForDevTask(devTask), linkedBug);
  assert.throws(
    () => validateLinkedBugCompletion(devTask, 100, []),
    error => error.message === linkedBugCompletionMessage
  );

  linkedBug.status = "QA Passed";
  assert.doesNotThrow(() => validateLinkedBugCompletion(devTask, 100, []));
  assert.equal(associatedBugForDevTask({ id: 201, taskType: "Dev" }, [dependencyBug.id]), dependencyBug);
  assert.equal(isBugQaPassedOrLater(dependencyBug), true);
});

test("task completion recognizes 100 percent and QA-passed workflow status", () => {
  configure();

  assert.equal(isTaskCompleted({ status: "In Progress", percentCompleted: 100 }), true);
  assert.equal(isTaskCompleted({ status: "QA Passed", percentCompleted: 0 }), true);
  assert.equal(isTaskCompleted({ status: "Ready for QA", percentCompleted: 99 }), false);
});

test("bug association finds linked, dependency, reciprocal dependency, and shared-assignee bugs", () => {
  const task = { id: 1, linkedBugTaskId: 2, dependencyTaskIds: [3], assigneeIds: [7] };
  const bugs = [
    { id: 2, taskType: "Bug" },
    { id: 3, taskType: "Bug" },
    { id: 4, taskType: "Bug", dependencyTaskIds: [1] },
    { id: 5, taskType: "Bug", assigneeIds: [7] },
    { id: 6, taskType: "Bug", assigneeIds: [9] }
  ];

  assert.deepEqual(bugsForTask(task, bugs).map(bug => bug.id), [2, 3, 4, 5]);
});

test("sorting, hierarchy, dependencies, reporters, and assignees stay deterministic", () => {
  const tasks = [
    { id: 4, projectId: 1, sortOrder: 2 },
    { id: 2, projectId: 1, sortOrder: 1 },
    { id: 3, projectId: 1, sortOrder: 1, parentTaskId: 2 },
    { id: 5, projectId: 2, sortOrder: 1 }
  ];
  configure(tasks);

  assert.deepEqual([...tasks].sort(taskOrderCompare).map(task => task.id), [2, 3, 5, 4]);
  assert.deepEqual(taskRowsWithSubTasks([tasks[0], tasks[1], tasks[2]]).map(row => [row.task.id, row.level]), [[4, 0], [2, 0], [3, 1]]);
  assert.deepEqual(dependencyCandidates(1, 2).map(task => task.id), [4, 3]);
  assert.deepEqual(reporterIdsOrDefault([], 9), [9]);
  assert.deepEqual(reporterIdsOrDefault([8], 9), [8]);
  assert.deepEqual(
    allowedAssigneeUsers(
      [{ id: 1, isActive: true }, { id: 2, isActive: false }, { id: 3, isActive: true }],
      { memberIds: [1, 2] },
      { developerIds: [2, 3] }
    ).map(user => user.id),
    [3]
  );
});
