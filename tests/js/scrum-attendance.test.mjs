import test from "node:test";
import assert from "node:assert/strict";

import {
  SCRUM_ATTENDANCE_STATUSES,
  scrumAttendanceOccurrences,
  scrumAttendanceStatusGroups,
  scrumCalendarDateKeys
} from "../../wwwroot/js/features/scrum/scrum.js";

test("Scrum exposes the six attendance choices in the required dropdown order", () => {
  assert.deepEqual(SCRUM_ATTENDANCE_STATUSES, [
    "Home",
    "Office",
    "Sick Leave",
    "Vacation",
    "EL",
    "Other"
  ]);
});

test("Scrum calendar keys preserve local month alignment and leap days", () => {
  const february2024 = scrumCalendarDateKeys(2024, 1);

  assert.deepEqual(february2024.slice(0, 5), ["", "", "", "", "2024-02-01"]);
  assert.equal(february2024.at(-1), "2024-02-29");
  assert.equal(february2024.filter(Boolean).length, 29);

  const july2026 = scrumCalendarDateKeys(2026, 6);
  assert.deepEqual(july2026.slice(0, 4), ["", "", "", "2026-07-01"]);
  assert.equal(july2026.at(-1), "2026-07-31");
});

test("attendance occurrences expand inclusive vacations, dedupe same statuses, and retain exceptional multi-status days", () => {
  const entries = [
    attendance(1, 1, "2026-07-15", "Office", "2026-07-01T09:00:00Z"),
    attendance(2, 1, "2026-07-15", "Office", "2026-07-01T10:00:00Z"),
    attendance(3, 1, "2026-07-15", "Sick Leave", "2026-07-01T11:00:00Z"),
    attendance(4, 1, "2026-07-15", "Vacation", "2026-07-01T12:00:00Z"),
    attendance(5, 2, "2026-07-20", "Other", "2026-07-01T13:00:00Z")
  ];
  const vacations = [
    vacation(10, 1, "2026-07-14", "2026-07-16", "2026-07-01T12:00:00Z"),
    vacation(11, 2, "2026-07-15", "2026-07-17", "2026-07-01T08:00:00Z")
  ];

  const occurrences = scrumAttendanceOccurrences(entries, vacations, "2026-07-15", "2026-07-16");
  const keys = occurrences
    .map(item => `${item.dateKey}|${item.userId}|${item.status}|${item.source}|${item.sourceId}`)
    .sort();

  assert.deepEqual(keys, [
    "2026-07-15|1|Office|attendance|2",
    "2026-07-15|1|Sick Leave|attendance|3",
    "2026-07-15|1|Vacation|attendance|4",
    "2026-07-15|2|Vacation|vacation|11",
    "2026-07-16|1|Vacation|vacation|10",
    "2026-07-16|2|Vacation|vacation|11"
  ]);
});

test("attendance status groups omit empty sections and use the calendar display order", () => {
  const occurrences = [
    occurrence("Other", 6),
    occurrence("EL", 5),
    occurrence("Home", 2),
    occurrence("Office", 1),
    occurrence("Vacation", 4),
    occurrence("Sick Leave", 3)
  ];

  const groups = scrumAttendanceStatusGroups(occurrences);

  assert.deepEqual(groups.map(group => group.status), [
    "Office",
    "Home",
    "Sick Leave",
    "Vacation",
    "EL",
    "Other"
  ]);
  assert.deepEqual(groups.map(group => group.entries[0].userId), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(scrumAttendanceStatusGroups([occurrence("Home", 2)]).map(group => group.status), ["Home"]);
});

function attendance(id, userId, attendanceDate, status, updatedAt) {
  return {
    id,
    userId,
    attendanceDate,
    status,
    createdAt: updatedAt,
    updatedAt
  };
}

function vacation(id, userId, startDate, endDate, updatedAt) {
  return {
    id,
    userId,
    startDate,
    endDate,
    createdAt: updatedAt,
    updatedAt
  };
}

function occurrence(status, userId) {
  return {
    dateKey: "2026-07-15",
    userId,
    status,
    source: "attendance",
    sourceId: userId,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z"
  };
}
