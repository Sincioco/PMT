import test from "node:test";
import assert from "node:assert/strict";

import {
  activeHolidayMap,
  dateKey,
  dateRange,
  groupedTimelineHeader,
  normalizeDate,
  shouldShowTimelineDate,
  timelineDateClass,
  visibleDateIndex
} from "../../wwwroot/js/shared/dates.js";
import { normalizeSavedArray } from "../../wwwroot/js/shared/filter-values.js";
import { escapeAttr, escapeHtml, normalizeUrl } from "../../wwwroot/js/shared/text-and-links.js";

const utcDate = value => new Date(`${value}T00:00:00`);

test("date helpers normalize dates and create inclusive ranges", () => {
  assert.equal(dateKey("2026-06-19T13:45:00"), "2026-06-19");
  assert.equal(normalizeDate("not-a-date"), null);
  assert.deepEqual(dateRange("2026-06-19", "2026-06-21").map(dateKey), [
    "2026-06-19",
    "2026-06-20",
    "2026-06-21"
  ]);
  assert.deepEqual(dateRange("2026-06-21", "2026-06-19"), []);
});

test("visibleDateIndex clamps missing dates to the nearest visible edge", () => {
  const dates = ["2026-06-19", "2026-06-23", "2026-06-26"].map(utcDate);

  assert.equal(visibleDateIndex(dates, utcDate("2026-06-23"), false), 1);
  assert.equal(visibleDateIndex(dates, utcDate("2026-06-22"), false), 1);
  assert.equal(visibleDateIndex(dates, utcDate("2026-06-22"), true), 0);
  assert.equal(visibleDateIndex(dates, utcDate("2026-06-30"), false), 2);
  assert.equal(visibleDateIndex([], utcDate("2026-06-30"), false), -1);
});

test("timeline visibility hides weekends and holidays unless explicitly shown or item-start dates require them", () => {
  const holidays = activeHolidayMap([
    { holidayDate: "2026-06-19", name: "Holiday", isActive: true },
    { holidayDate: "2026-06-20", name: "Inactive", isActive: false }
  ]);
  const starts = new Set(["2026-06-20"]);

  assert.equal(shouldShowTimelineDate(utcDate("2026-06-19"), starts, holidays), false);
  assert.equal(shouldShowTimelineDate(utcDate("2026-06-20"), starts, holidays), true);
  assert.equal(shouldShowTimelineDate(utcDate("2026-06-21"), starts, holidays), false);
  assert.equal(shouldShowTimelineDate(utcDate("2026-06-21"), starts, holidays, true), true);
  assert.equal(timelineDateClass(utcDate("2026-06-19"), holidays), "holiday-day");
});

test("groupedTimelineHeader groups adjacent labels only", () => {
  const dates = ["2026-06-01", "2026-06-02", "2026-07-01", "2026-06-03"].map(utcDate);
  const groups = groupedTimelineHeader(dates, date => date.getMonth());

  assert.deepEqual(groups.map(group => ({ label: group.label, count: group.count })), [
    { label: "5", count: 2 },
    { label: "6", count: 1 },
    { label: "5", count: 1 }
  ]);
});

test("saved array filters normalize current and legacy values", () => {
  assert.deepEqual(normalizeSavedArray(["", null, 4, "QA"]), ["4", "QA"]);
  assert.deepEqual(normalizeSavedArray("", "legacy"), ["legacy"]);
  assert.deepEqual(normalizeSavedArray(7, ""), ["7"]);
  assert.deepEqual(normalizeSavedArray(null, ""), []);
});

test("escaping and URL normalization protect markup and external links", () => {
  assert.equal(escapeHtml(`<a href='x'>&"`), "&lt;a href=&#039;x&#039;&gt;&amp;&quot;");
  assert.equal(escapeAttr(`"quoted"`), "&quot;quoted&quot;");
  assert.equal(normalizeUrl(" www.example.com/path "), "https://www.example.com/path");
  assert.equal(normalizeUrl("example.com"), "https://example.com");
  assert.equal(normalizeUrl("/docs/page"), "/docs/page");
  assert.equal(normalizeUrl("mailto:test@example.com"), "mailto:test@example.com");
});
