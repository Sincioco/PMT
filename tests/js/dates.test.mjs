import assert from "node:assert/strict";
import test from "node:test";
import { toDateInput } from "../../wwwroot/js/shared/dates.js";

test("date inputs preserve SQL date and midnight datetime values without timezone drift", () => {
  assert.equal(toDateInput("2026-07-14"), "2026-07-14");
  assert.equal(toDateInput("2026-07-14T00:00:00"), "2026-07-14");
  assert.equal(toDateInput("2026-07-14 00:00:00.0000000"), "2026-07-14");
});

test("date inputs reject invalid values and format Date objects in local time", () => {
  assert.equal(toDateInput("not-a-date"), "");
  assert.equal(toDateInput(new Date(2026, 6, 14, 23, 30)), "2026-07-14");
});
