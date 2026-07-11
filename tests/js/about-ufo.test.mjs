import assert from "node:assert/strict";
import test from "node:test";

import {
  UFO_VISIT_INTERVAL_SECONDS,
  ufoSpeechForEncounter
} from "../../wwwroot/js/features/about/about-ufo.js";

test("UFO visits once per minute and rotates its transmissions", () => {
  assert.equal(UFO_VISIT_INTERVAL_SECONDS, 60);

  const firstCycle = Array.from({ length: 10 }, (_, index) => ufoSpeechForEncounter(index));
  assert.equal(new Set(firstCycle).size, firstCycle.length);
  assert.equal(ufoSpeechForEncounter(10), firstCycle[0]);
  assert.notEqual(ufoSpeechForEncounter(0), ufoSpeechForEncounter(1));

  assert.ok(firstCycle.includes("Wow, JIRA + Confluence all-in-one?\nSuch advanced civilization!"));
  assert.ok(firstCycle.includes("Dev Tasks, Bug Tracking with Charts!\nI need to tell the others!"));
  assert.ok(firstCycle.includes("What?  This tool is free?\nHow crazy is that!"));
});
