import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "../../wwwroot/js/vendor/three/three.module.min.js";

import {
  UFO_FIRST_DELAY_MAX_SECONDS,
  UFO_FIRST_DELAY_MIN_SECONDS,
  UFO_IDLE_MAX_SECONDS,
  UFO_IDLE_MIN_SECONDS,
  createUfoEncounter,
  ufoFirstDelay,
  ufoIdleDelay,
  ufoLightningSpeechForStrike,
  ufoSpeechForEncounter
} from "../../wwwroot/js/features/about/about-ufo.js";

test("UFO uses randomized convenient-window delays and rotates its transmissions", () => {
  assert.equal(UFO_FIRST_DELAY_MIN_SECONDS, 12);
  assert.equal(UFO_FIRST_DELAY_MAX_SECONDS, 22);
  assert.ok(UFO_FIRST_DELAY_MIN_SECONDS >= 10);
  assert.equal(ufoFirstDelay(() => 0), 12);
  assert.equal(ufoFirstDelay(() => 1), 22);
  assert.equal(UFO_IDLE_MIN_SECONDS, 45);
  assert.equal(UFO_IDLE_MAX_SECONDS, 75);
  assert.equal(ufoIdleDelay(() => 0), 45);
  assert.equal(ufoIdleDelay(() => 1), 75);

  const firstCycle = Array.from({ length: 10 }, (_, index) => ufoSpeechForEncounter(index));
  assert.equal(new Set(firstCycle).size, firstCycle.length);
  assert.equal(ufoSpeechForEncounter(10), firstCycle[0]);
  assert.notEqual(ufoSpeechForEncounter(0), ufoSpeechForEncounter(1));

  assert.ok(firstCycle.includes("Wow, JIRA + Confluence all-in-one?\nSuch advanced civilization!"));
  assert.ok(firstCycle.includes("Dev Tasks, Bug Tracking with Charts!\nI need to tell the others!"));
  assert.ok(firstCycle.includes("What?  This tool is free?\nHow crazy is that!"));

  assert.equal(
    ufoLightningSpeechForStrike(0, () => 0.75),
    "This PMT really has a lot of spark!"
  );
  assert.equal(
    ufoLightningSpeechForStrike(1, () => 0),
    "They use lightning as weapons?\nWhat an advanced civilization!"
  );
  assert.equal(
    ufoLightningSpeechForStrike(2, () => 0.999999),
    "Their weather has excellent aim.\nWe should retreat after this demo!"
  );
});

test("UFO reports an incomplete departure until the fly-away finishes", () => {
  const scene = new THREE.Scene();
  const resources = new Set();
  const speechElement = {
    hidden: true,
    textContent: "",
    style: { setProperty() {} }
  };
  const encounter = createUfoEncounter({ scene, resources, speechElement });
  const startedAt = 100;

  encounter.startNow(startedAt);
  encounter.update(startedAt, false, true);
  encounter.update(startedAt + 1.75 + 14.2, false, true);
  assert.equal(encounter.isDepartureIncomplete(), true);

  encounter.update(startedAt + 1.75 + 21.1, false, true);
  assert.equal(encounter.isDepartureIncomplete(), true);

  encounter.update(startedAt + 1.75 + 21.3, false, true);
  assert.equal(encounter.isDepartureIncomplete(), false);

  encounter.dispose();
});

test("UFO remains active long enough to exit after a late lightning strike", () => {
  const scene = new THREE.Scene();
  const resources = new Set();
  const speechElement = {
    hidden: true,
    textContent: "",
    style: { setProperty() {} }
  };
  const encounter = createUfoEncounter({ scene, resources, speechElement });
  const startedAt = 200;
  const target = new THREE.Vector3();

  encounter.startNow(startedAt);
  encounter.update(startedAt, false, true);
  encounter.update(startedAt + 1.75 + 20.8, false, true);
  assert.equal(encounter.reactToLightning(), true);

  encounter.update(startedAt + 1.75 + 21.35, false, true);
  assert.equal(encounter.isDepartureIncomplete(), true);
  assert.equal(encounter.getStrikePosition(target), true);

  encounter.update(startedAt + 1.75 + 24.3, false, true);
  assert.equal(encounter.isDepartureIncomplete(), false);

  encounter.dispose();
});
