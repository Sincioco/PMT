import test from "node:test";
import assert from "node:assert/strict";

import { replaceState } from "../../wwwroot/js/core/store.js";
import {
  currentSprintForProject,
  ganttChartData,
  ganttEndDate,
  ganttStartDate,
  selectedGanttSprint,
  sortGanttSprintOptions,
  sortGanttSprints
} from "../../wwwroot/js/features/gantt/gantt-calculations.js";
import {
  roadMapChartData,
  roadMapProjectEnd,
  roadMapProjectSprints,
  roadMapProjects,
  roadMapSprintEnd,
  roadMapSprintOptions,
  roadMapSprintStart,
  roadMapVisibleDateIndex
} from "../../wwwroot/js/features/roadmap/roadmap-calculations.js";
import { dateKey } from "../../wwwroot/js/shared/dates.js";

const date = value => new Date(`${value}T00:00:00`);

test("Gantt sprint sorting and selected sprint logic are deterministic", () => {
  const sprints = [
    { id: 2, code: "B", startDate: "2026-06-15", endDate: "2026-06-26" },
    { id: 1, code: "A", startDate: "2026-06-01", endDate: "2026-06-12" },
    { id: 3, code: "C", startDate: "2026-06-15", endDate: "2026-06-20" }
  ];

  assert.deepEqual(sortGanttSprints(sprints, "startAsc").map(sprint => sprint.code), ["A", "B", "C"]);
  assert.deepEqual(sortGanttSprints(sprints, "startDesc").map(sprint => sprint.code), ["B", "C", "A"]);
  assert.deepEqual(sortGanttSprintOptions(sprints).map(sprint => sprint.code), ["B", "C", "A"]);
  assert.equal(selectedGanttSprint(sprints, "all"), null);
  assert.equal(selectedGanttSprint(sprints, "3").id, 3);
});

test("Gantt dates fall back safely and chart data hides non-working days by default", () => {
  const project = { id: 10 };
  const sprints = [{ id: 20, projectId: 10, code: "Sprint", startDate: "2026-06-19", endDate: "2026-06-23" }];
  const tasks = [
    { id: 1, projectId: 10, sprintId: 20, taskType: "Dev", status: "Todo", startDate: "2026-06-20", endDate: "2026-06-21" },
    { id: 2, projectId: 99, sprintId: 99, taskType: "Dev", status: "Todo", startDate: "2026-06-19", endDate: "2026-06-21" }
  ];

  assert.equal(dateKey(ganttStartDate({ createdAt: "2026-06-18" })), "2026-06-18");
  assert.equal(dateKey(ganttEndDate({ startDate: "2026-06-20", endDate: "2026-06-18" })), "2026-06-20");

  const chart = ganttChartData({
    project,
    sprints,
    selectedSprint: sprints[0],
    tasks,
    holidays: [{ holidayDate: "2026-06-22", name: "Holiday", isActive: true }],
    availableTimelineWidth: 900
  });

  assert.deepEqual(chart.dates.map(dateKey), [
    "2026-06-19",
    "2026-06-20",
    "2026-06-23",
    "2026-06-24",
    "2026-06-25",
    "2026-06-26",
    "2026-06-29",
    "2026-06-30",
    "2026-07-01",
    "2026-07-02",
    "2026-07-03",
    "2026-07-06",
    "2026-07-07"
  ]);
  assert.equal(chart.dayWidth >= 42, true);
});

test("currentSprintForProject chooses an active, latest past, or first future sprint", () => {
  const originalNow = Date.now;
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) return new RealDate("2026-06-19T12:00:00");
      return new RealDate(...args);
    }

    static now() {
      return new RealDate("2026-06-19T12:00:00").getTime();
    }
  };

  try {
    assert.equal(currentSprintForProject([
      { id: 1, startDate: "2026-06-01", endDate: "2026-06-12" },
      { id: 2, startDate: "2026-06-15", endDate: "2026-06-26" }
    ]).id, 2);
    assert.equal(currentSprintForProject([
      { id: 1, startDate: "2026-06-01", endDate: "2026-06-12" }
    ]).id, 1);
    assert.equal(currentSprintForProject([
      { id: 3, startDate: "2026-07-01", endDate: "2026-07-12" }
    ]).id, 3);
  } finally {
    globalThis.Date = RealDate;
    Date.now = originalNow;
  }
});

test("Road Map filters, sorts, and sprint date fallbacks preserve layout rules", () => {
  const projects = [
    { id: 1, code: "B", title: "Beta", startDate: "2026-06-01", endDate: "2026-06-30" },
    { id: 2, code: "A", title: "Alpha", startDate: "2026-05-01", endDate: "2026-05-31" }
  ];
  const sprints = [
    { id: 10, projectId: 1, code: "B-1", startDate: "2026-06-03", endDate: "2026-06-14" },
    { id: 11, projectId: 1, code: "B-2", startDate: "", endDate: "2026-06-20", createdAt: "2026-06-04" },
    { id: 20, projectId: 2, code: "A-1", startDate: "2026-05-05", endDate: "2026-05-12" }
  ];
  replaceState({ projects, sprints, users: [], tasks: [], devLogs: [], blogs: [], auditEvents: [], lookups: [], holidays: [] });

  assert.deepEqual(roadMapProjects({ projects, sprints, projectFilter: "all", sprintFilter: "all", showSprints: true, sort: "endAsc" }).map(project => project.code), ["A", "B"]);
  assert.deepEqual(roadMapProjectSprints(projects[0], { sprints, sprintFilter: "all", showSprints: true }).map(sprint => sprint.code), ["B-2", "B-1"]);
  assert.deepEqual(roadMapSprintOptions({ sprints, projectFilter: "1" }).map(sprint => sprint.code), ["B-2", "B-1"]);
  assert.equal(dateKey(roadMapSprintStart(sprints[1], projects[0])), "2026-06-01");
  assert.equal(dateKey(roadMapSprintEnd({ startDate: "2026-06-20", endDate: "2026-06-18" }, projects[0])), "2026-06-20");
  assert.equal(dateKey(roadMapProjectEnd({ startDate: "2026-06-20", endDate: "2026-06-18" }, [])), "2026-06-20");
});

test("Road Map chart switches long timelines to month granularity and maps visible date indexes", () => {
  const projects = [{ id: 1, code: "P", title: "Project", startDate: "2026-01-01", endDate: "2027-12-31" }];
  const chart = roadMapChartData({
    projects,
    sprints: [],
    holidays: [],
    sprintFilter: "all",
    showSprints: false,
    availableTimelineWidth: 900
  });

  assert.equal(chart.granularity, "month");
  assert.equal(chart.rows.length, 1);
  assert.equal(roadMapVisibleDateIndex(chart.dates, date("2026-06-19"), false, chart.granularity), 5);
});
