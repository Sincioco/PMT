import assert from "node:assert/strict";
import test from "node:test";

import {
  LIGHTNING_MAX_INTERVAL_SECONDS,
  LIGHTNING_MIN_INTERVAL_SECONDS,
  lightningStrikeDelay
} from "../../wwwroot/js/features/about/about-lightning.js";

test("lightning schedules every strike between 45 and 65 seconds", () => {
  assert.equal(LIGHTNING_MIN_INTERVAL_SECONDS, 45);
  assert.equal(LIGHTNING_MAX_INTERVAL_SECONDS, 65);
  assert.equal(lightningStrikeDelay(() => 0), 45);
  assert.equal(lightningStrikeDelay(() => 0.5), 55);
  assert.equal(lightningStrikeDelay(() => 1), 65);
});
