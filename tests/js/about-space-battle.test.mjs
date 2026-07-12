import assert from "node:assert/strict";
import test from "node:test";

import {
  SPACE_BATTLE_DIALOGUE_LINGER_SECONDS,
  SPACE_BATTLE_CHANCE,
  SPACE_BATTLE_MAX_INTERCEPTORS,
  SPACE_BATTLE_MIN_INTERCEPTORS,
  SPACE_BATTLE_PIP_GRACE_SECONDS,
  SPACE_BATTLE_PIP_LAYER,
  battleInterceptorCount,
  battleShouldIntercept,
  defenderLine,
  hitLine,
  originalUfoLine
} from "../../wwwroot/js/features/about/about-space-battle.js";

test("intergalactic battles are periodic and choose between one and three interceptors", () => {
  assert.equal(SPACE_BATTLE_DIALOGUE_LINGER_SECONDS, 5);
  assert.equal(SPACE_BATTLE_CHANCE, 0.68);
  assert.equal(SPACE_BATTLE_MIN_INTERCEPTORS, 1);
  assert.equal(SPACE_BATTLE_MAX_INTERCEPTORS, 3);
  assert.equal(SPACE_BATTLE_PIP_LAYER, 2);
  assert.equal(SPACE_BATTLE_PIP_GRACE_SECONDS, 5);
  assert.equal(battleShouldIntercept(() => 0), true);
  assert.equal(battleShouldIntercept(() => SPACE_BATTLE_CHANCE), false);
  assert.equal(battleInterceptorCount(() => 0), 1);
  assert.equal(battleInterceptorCount(() => 0.34), 2);
  assert.equal(battleInterceptorCount(() => 0.999999), 3);
});

test("battle dialogue rotates short PMT-themed exchanges", () => {
  assert.match(defenderLine(0), /PMT is so advanced/i);
  assert.match(originalUfoLine(0), /discovery ticket/i);
  assert.match(hitLine(0), /critical hit/i);
  assert.equal(defenderLine(6), defenderLine(0));
  assert.equal(originalUfoLine(5), originalUfoLine(0));
  assert.equal(hitLine(5), hitLine(0));
});
