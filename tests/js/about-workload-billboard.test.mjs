import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKanbanColumns,
  latestDocumentationCards
} from "../../wwwroot/js/features/about/about-workload-billboard.js";

test("Documentation gallery selects the latest twenty cards by update time", () => {
  const blogs = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    title: `Document ${index + 1}`,
    createdAt: `2026-06-${String(index + 1).padStart(2, "0")}T08:00:00Z`,
    updatedAt: `2026-07-${String(index + 1).padStart(2, "0")}T08:00:00Z`
  }));

  const selected = latestDocumentationCards(blogs);

  assert.equal(selected.length, 20);
  assert.equal(selected[0].id, 25);
  assert.equal(selected.at(-1).id, 6);
  assert.deepEqual(blogs.map(blog => blog.id), Array.from({ length: 25 }, (_, index) => index + 1));
});

test("Documentation gallery falls back to created time and uses id as a stable tie breaker", () => {
  const selected = latestDocumentationCards([
    { id: 1, createdAt: "2026-07-01T08:00:00Z" },
    { id: 3, createdAt: "2026-07-02T08:00:00Z" },
    { id: 2, createdAt: "2026-07-02T08:00:00Z" }
  ], 2);

  assert.deepEqual(selected.map(blog => blog.id), [3, 2]);
});

test("Kanban gallery derives non-empty dynamic columns in configured status order", () => {
  const columns = buildKanbanColumns([
    { id: 1, status: "In Progress", title: "Build it" },
    { id: 2, status: "Todo", title: "Plan it" },
    { id: 3, status: "Custom QA", title: "Verify it" }
  ], ["Backlog", "Todo", "In Progress"], status => `color:${status}`);

  assert.deepEqual(columns.map(column => column.status), ["Todo", "In Progress", "Custom QA"]);
  assert.deepEqual(columns.map(column => column.tasks.length), [1, 1, 1]);
  assert.equal(columns[2].color, "color:Custom QA");
});

test("Kanban gallery can represent configured columns even when the board has no tasks", () => {
  const columns = buildKanbanColumns([], ["Idea", "Ready"]);

  assert.deepEqual(columns.map(column => column.status), ["Idea", "Ready"]);
  assert.ok(columns.every(column => column.tasks.length === 0));
});

test("Kanban gallery omits all empty columns when the web board shows all columns", () => {
  const columns = buildKanbanColumns(
    [],
    ["Backlog", "Todo", "In Progress", "Done"],
    () => "#76a9ff",
    { omitEmptyColumns: true }
  );

  assert.deepEqual(columns, []);
});
