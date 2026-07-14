import assert from "node:assert/strict";
import test from "node:test";

import { isAutomaticAlienEventWindow } from "../../wwwroot/js/features/about/about-scene.js";

test("automatic alien events wait until the PMT logo approach", () => {
  assert.equal(isAutomaticAlienEventWindow(true, "return-initial", 4), false);
  assert.equal(isAutomaticAlienEventWindow(true, "return-initial", 5), true);
  assert.equal(isAutomaticAlienEventWindow(true, "return-initial", 6), true);
  assert.equal(isAutomaticAlienEventWindow(true, "return-initial", 7), true);
  assert.equal(isAutomaticAlienEventWindow(false, "return-initial", 6), false);
  assert.equal(isAutomaticAlienEventWindow(true, "dev", 6), false);
});
