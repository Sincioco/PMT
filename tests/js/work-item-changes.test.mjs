import assert from "node:assert/strict";
import test from "node:test";
import {
  detectWorkItemChanges,
  WORK_ITEM_CHANGE_POLL_INTERVAL_MS,
  workItemChangeMessage,
  workItemSnapshotSignature
} from "../../wwwroot/js/shared/work-item-changes.js";

test("work item polling runs every 30 seconds", () => {
  assert.equal(WORK_ITEM_CHANGE_POLL_INTERVAL_MS, 30_000);
});

test("work item changes distinguish new, updated, and deleted Dev Tasks and Bugs", () => {
  const current = [
    { id: 1, taskType: "Dev", title: "Keep" },
    { id: 2, taskType: "Dev", title: "Old" },
    { id: 3, taskType: "Bug", title: "Delete" }
  ];
  const next = [
    { id: 1, taskType: "Dev", title: "Keep" },
    { id: 2, taskType: "Dev", title: "Updated" },
    { id: 4, taskType: "Bug", title: "New" }
  ];

  const changes = detectWorkItemChanges(current, next);
  assert.deepEqual(changes, {
    changed: true,
    devTasks: { added: 0, updated: 1, deleted: 0 },
    bugs: { added: 1, updated: 0, deleted: 1 }
  });
  assert.equal(workItemChangeMessage(changes), "Dev Tasks: 1 updated; Bugs: 1 new, 1 deleted.");
});

test("work item signatures ignore response order and non Dev Task or Bug rows", () => {
  const first = [
    { id: 1, taskType: "Dev", title: "Task" },
    { id: 2, taskType: "Backlog", title: "Backlog" },
    { id: 3, taskType: "Bug", title: "Bug" }
  ];
  const second = [first[2], { ...first[1], title: "Changed backlog" }, first[0]];
  assert.equal(workItemSnapshotSignature(first), workItemSnapshotSignature(second));
  assert.equal(detectWorkItemChanges(first, second).changed, false);
});
