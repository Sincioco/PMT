import test from "node:test";
import assert from "node:assert/strict";

import { completionColor } from "../../wwwroot/js/components/progress-and-status.js";

test("completion colors use the shared danger, warning, and success thresholds", () => {
  assert.equal(completionColor(0), "var(--color-danger)");
  assert.equal(completionColor(30), "var(--color-danger)");
  assert.equal(completionColor(31), "var(--color-warning)");
  assert.equal(completionColor(79), "var(--color-warning)");
  assert.equal(completionColor(80), "var(--color-success)");
  assert.equal(completionColor(100), "var(--color-success)");
});
