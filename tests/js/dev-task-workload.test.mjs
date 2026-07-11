import test from "node:test";
import assert from "node:assert/strict";

import {
  createDevTaskWorkloadView,
  devTaskWorkloadCategories,
  devTaskWorkloadRows
} from "../../wwwroot/js/shared/dev-task-workload.js";

test("developer workload categories follow the live task statuses", () => {
  const tasks = [
    { id: 1, status: "Todo", assigneeIds: [1] },
    { id: 2, status: "Ready for QA", assigneeIds: [1, 2] },
    { id: 3, status: "Security Review", assigneeIds: [2] }
  ];
  const categories = devTaskWorkloadCategories(
    tasks,
    ["Backlog", "Todo", "In Progress", "Ready for QA"],
    status => `color:${status}`
  );
  const rows = devTaskWorkloadRows([
    { id: 1, nickname: "Sin" },
    { id: 2, nickname: "Nova" }
  ], tasks, categories);

  assert.deepEqual(categories.map(category => category.label), [
    "Backlog",
    "Todo",
    "In Progress",
    "Ready for QA",
    "Security Review"
  ]);
  assert.deepEqual(rows[0].categories.map(category => category.label), ["Todo", "Ready for QA"]);
  assert.deepEqual(rows[0].categories.map(category => category.value), [1, 1]);
  assert.deepEqual(rows[1].categories.map(category => category.label), ["Ready for QA", "Security Review"]);
  assert.equal(rows[1].categories[1].color, "color:Security Review");
});

test("About workload view mirrors the saved Dev Tasks Project and Sprint context", () => {
  const users = [{ id: 1, nickname: "Sin" }, { id: 2, nickname: "Nova" }];
  const projects = [{ id: 10, code: "PMT" }, { id: 20, code: "OPS" }];
  const sprints = [
    { id: 101, projectId: 10, code: "PMT-S24" },
    { id: 201, projectId: 20, code: "OPS-S9" }
  ];
  const tasks = [
    { id: 1, projectId: 10, sprintId: 101, taskType: "Dev Task", status: "In Progress", assigneeIds: [1] },
    { id: 2, projectId: 10, sprintId: 101, taskType: "Dev Task", status: "Ready for QA", assigneeIds: [2] },
    { id: 3, projectId: 20, sprintId: 201, taskType: "Dev Task", status: "Todo", assigneeIds: [1] },
    { id: 4, projectId: 10, sprintId: 101, taskType: "Bug", status: "In Progress", assigneeIds: [1] }
  ];
  const view = createDevTaskWorkloadView({
    users,
    projects,
    sprints,
    tasks,
    projectId: 10,
    sprintMode: "101",
    getCurrentSprint: projectSprints => projectSprints[0] || null,
    statuses: ["Todo", "In Progress", "Ready for QA"],
    getStatusColor: status => `#${status.length}`
  });

  assert.equal(view.subtitle, "PMT - S24");
  assert.equal(view.rows.length, 2);
  assert.deepEqual(view.rows.map(row => row.total), [1, 1]);
  assert.deepEqual(
    view.rows.flatMap(row => row.categories.map(category => category.label)),
    ["In Progress", "Ready for QA"]
  );
});
