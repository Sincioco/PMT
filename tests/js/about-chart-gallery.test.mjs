import assert from "node:assert/strict";
import test from "node:test";

import { createBugChartsView } from "../../wwwroot/js/shared/bug-charts.js";
import { createDevTaskChartsView } from "../../wwwroot/js/shared/dev-task-charts.js";
import { configureWorkItemRules } from "../../wwwroot/js/shared/work-item-rules.js";

const statuses = ["Backlog", "Todo", "In Progress", "Ready for QA", "QA Passed", "Deployed in Prod"];
const projects = [{ id: 10, code: "PMT", title: "Project Management Tool" }];
const sprints = [
  { id: 101, projectId: 10, code: "PMT-S1", startDate: "2026-06-01" },
  { id: 102, projectId: 10, code: "PMT-S2", startDate: "2026-07-01" }
];
const users = [
  { id: 1, nickname: "Nova" },
  { id: 2, nickname: "Kai" }
];
const tasks = [
  { id: 1, projectId: 10, sprintId: 101, taskType: "Dev Task", status: "Todo", percentCompleted: 0, assigneeIds: [1] },
  { id: 2, projectId: 10, sprintId: 102, taskType: "Dev Task", status: "In Progress", percentCompleted: 50, assigneeIds: [1, 2] },
  { id: 3, projectId: 10, sprintId: 102, taskType: "Dev Task", status: "QA Passed", percentCompleted: 100, assigneeIds: [2] },
  { id: 11, projectId: 10, sprintId: 101, taskType: "Bug", status: "Todo", severity: "Minor" },
  { id: 12, projectId: 10, sprintId: 102, taskType: "Bug", status: "QA Passed", severity: "Critical" },
  { id: 13, projectId: 10, sprintId: 102, taskType: "Bug", status: "Todo", severity: "Major" }
];
const currentSprint = items => [...items].sort((a, b) => a.startDate.localeCompare(b.startDate)).at(-1) || null;
const itemStartDate = item => new Date(item.startDate);

configureWorkItemRules({ getStatuses: () => statuses, getTasks: () => tasks });

test("About Dev Task gallery uses the same four dynamic chart datasets", () => {
  const charts = createDevTaskChartsView({
    users,
    projects,
    sprints,
    tasks,
    projectId: 10,
    sprintMode: "all",
    getCurrentSprint: currentSprint,
    getItemStartDate: itemStartDate,
    statuses,
    getStatusColor: status => `color:${status}`
  });

  assert.equal(charts.workload.rows.length, 2);
  assert.deepEqual(charts.status.items.map(item => [item.label, item.value]), [
    ["Todo", 1],
    ["In Progress", 1]
  ]);
  assert.equal(charts.mix.total, 3);
  assert.equal(charts.mix.completedPercent, 33);
  assert.deepEqual(charts.completed.rows.map(row => [row.label, row.total, row.completed]), [
    ["PMT-S2", 2, 1],
    ["PMT-S1", 1, 0]
  ]);
});

test("About Bug Tracking gallery preserves severity, mix, trend, and Sprint totals", () => {
  const charts = createBugChartsView({
    projects,
    sprints,
    tasks,
    filters: { projectId: 10, sprintId: "all" },
    severities: ["Trivial", "Minor", "Major", "Critical"],
    getCurrentSprint: currentSprint,
    getItemStartDate: itemStartDate
  });

  assert.deepEqual(charts.severity.items.map(item => [item.label, item.value]), [
    ["Minor", 1],
    ["Major", 1],
    ["Critical", 1]
  ]);
  assert.deepEqual(charts.mix.items.map(item => [item.label, item.value]), [
    ["Resolved", 1],
    ["Still Open", 2]
  ]);
  assert.deepEqual(charts.trend.rows.map(row => [row.label, row.reported, row.resolved, row.open]), [
    ["PMT-S2", 2, 1, 1],
    ["PMT-S1", 1, 0, 1]
  ]);
  assert.equal(charts.reportedResolved.rows, charts.trend.rows);
});
