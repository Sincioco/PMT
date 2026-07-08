import assert from "node:assert/strict";
import test from "node:test";

import {
  importWorkItemType,
  parseImportPercentOrDefault,
  resolveImportLookupValue,
  resolveImportProjectId,
  resolveImportSprintId,
  resolveImportUserIds,
  resolveImportWorkItem
} from "../../wwwroot/js/shared/table-export.js";

const tasks = [
  { id: 1, taskType: "Dev", code: "PMT-TASK-001", title: "Build Import" },
  { id: 2, taskType: "Dev", code: "PMT-TASK-002", title: "Text Match Target" },
  { id: 3, taskType: "Bug", code: "PMT-BUG-001", title: "Import Bug" }
];

const users = [
  { id: 1, nickname: "Sin", firstName: "Sin", lastName: "Cioco", email: "sin@example.test" },
  { id: 2, nickname: "Bill", firstName: "Bill", lastName: "Gates", email: "bill@example.test" },
  { id: 3, nickname: "Sam", firstName: "Sam", lastName: "Altman", email: "sam@example.test" }
];

const projects = [
  { id: 10, code: "PMT", title: "Project Management Tool" },
  { id: 20, code: "LMS", title: "Learning Management System" }
];

const sprints = [
  { id: 100, projectId: 10, code: "PMT-Sprint01", title: "Foundation", isFinished: false },
  { id: 101, projectId: 10, code: "PMT-Sprint02", title: "Regression", isFinished: true },
  { id: 200, projectId: 20, code: "LMS-Sprint01", title: "Catalog", isFinished: false }
];

test("permissive work item import resolves by id before text", () => {
  const result = resolveImportWorkItem({
    "PMT Item Id": "1",
    "PMT Item Code": "PMT-TASK-002",
    "Task": "Text Match Target"
  }, tasks, {
    allowedTaskTypes: ["Dev"],
    titleHeaders: ["Task"]
  });

  assert.equal(result.task.id, 1);
  assert.equal(result.matchedTask.id, 1);
});

test("permissive work item import falls back to text when id does not match", () => {
  const result = resolveImportWorkItem({
    "PMT Item Id": "9999",
    "Task": "  Text   Match Target  "
  }, tasks, {
    allowedTaskTypes: ["Dev"],
    titleHeaders: ["Task"]
  });

  assert.equal(result.task.id, 2);
});

test("permissive work item import reports non-updatable matches so callers can create new records", () => {
  const result = resolveImportWorkItem({
    "PMT Item Id": "2",
    "Task": "Text Match Target"
  }, tasks, {
    allowedTaskTypes: ["Dev"],
    titleHeaders: ["Task"],
    canUpdate: task => task.id !== 2
  });

  assert.equal(result.task, null);
  assert.equal(result.matchedTask.id, 2);
});

test("permissive import helpers resolve replacement project and sprint context", () => {
  assert.equal(resolveImportProjectId({ "PMT Update Project Id": "20" }, projects, 10), 20);
  assert.equal(resolveImportProjectId({ Project: "PMT - Project Management Tool" }, projects, 20), 10);
  assert.equal(resolveImportProjectId({ Project: "Missing Project" }, projects, 20), 20);

  assert.equal(resolveImportSprintId({ "PMT Update Sprint Id": "100" }, sprints, { projectId: 10 }), 100);
  assert.equal(resolveImportSprintId({ Sprint: "PMT-Sprint02 - Regression" }, sprints, {
    projectId: 10,
    fallbackSprintId: 100,
    isSprintAllowed: sprint => !sprint.isFinished
  }), 100);
  assert.equal(resolveImportSprintId({ Sprint: "Missing Sprint" }, sprints, {
    projectId: 20,
    fallbackSprintId: 200
  }), 200);
});

test("permissive import helpers substitute users, lookups, percent, and type", () => {
  assert.deepEqual(resolveImportUserIds({ Assignees: "Bill; sam@example.test" }, users, {
    nameHeaders: ["Assignees"]
  }), [2, 3]);
  assert.deepEqual(resolveImportUserIds({ "PMT Update Assignee IDs": "999" }, users, {
    fallbackIds: [2],
    defaultUserId: 1,
    allowedIds: [1, 2]
  }), [2]);
  assert.deepEqual(resolveImportUserIds({}, users, {
    defaultUserId: 1
  }), [1]);

  assert.equal(resolveImportLookupValue("urgent", ["High", "Medium"], "Medium"), "Medium");
  assert.equal(parseImportPercentOrDefault({ "PMT Update Percent Completed": "120" }, 35), 100);
  assert.equal(parseImportPercentOrDefault({ "PMT Update Percent Completed": "" }, 35), 35);
  assert.equal(importWorkItemType({ "PMT Item Type": "Bug Report" }, ["Dev", "Bug"], "Dev"), "Bug");
  assert.equal(importWorkItemType({ "PMT Item Type": "Unknown" }, ["Dev"], "Bug"), "Dev");
});
