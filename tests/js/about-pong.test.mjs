import assert from "node:assert/strict";
import test from "node:test";

import {
  ABOUT_PONG_GAME_KEY,
  applyPongBlockEffect,
  createPongInitialState,
  currentPaddleScale,
  stepPongState
} from "../../wwwroot/js/features/about/about-pong.js";

test("Pong game has a stable game key for persisted scores", () => {
  assert.equal(ABOUT_PONG_GAME_KEY, "about-pong-blocks");
});

test("Pong arena includes neutral top and bottom blocks", () => {
  const state = createPongInitialState(() => 0.1);

  assert.ok(state.blocks.some(item => item.side === "top"));
  assert.ok(state.blocks.some(item => item.side === "bottom"));
  assert.ok(state.blocks.every(item => ["left", "right", "top", "bottom"].includes(item.side)));
});

test("Pong victory only depends on the opponent side blocks", () => {
  const state = createPongInitialState(() => 0.1);
  for (const blockItem of state.blocks) {
    blockItem.destroyed = blockItem.side === "right";
  }

  stepPongState(state, { up: false, down: false }, 0.01, () => 0.1);

  assert.equal(state.gameOver, true);
  assert.equal(state.won, true);
  assert.ok(state.blocks.some(item => item.side === "top" && !item.destroyed));
  assert.ok(state.blocks.some(item => item.side === "bottom" && !item.destroyed));
});

test("red blocks explode nearby blocks and slow the ball", () => {
  const state = testState([
    block(1, "right", "red", 0, 0),
    block(2, "right", "blue", 1, 0),
    block(3, "right", "green", 0, 1)
  ]);
  const ball = testBall(12, 0, "player");
  const removed = applyPongBlockEffect(state, state.blocks[0], ball, () => 0);

  assert.equal(removed, 3);
  assert.equal(state.blocks.filter(item => item.destroyed).length, 3);
  assert.ok(speed(ball) < 12);
  assert.ok(state.score > 100);
});

test("yellow and green blocks adjust ball speed in opposite directions", () => {
  const yellowState = testState([block(1, "right", "yellow", 0, 0)]);
  const yellowBall = testBall(12, 0, "player");
  applyPongBlockEffect(yellowState, yellowState.blocks[0], yellowBall, () => 0);
  assert.ok(speed(yellowBall) < 12);

  const greenState = testState([block(1, "right", "green", 0, 0)]);
  const greenBall = testBall(12, 0, "player");
  applyPongBlockEffect(greenState, greenState.blocks[0], greenBall, () => 0);
  assert.ok(speed(greenBall) > 12);
});

test("purple blocks spawn one to three extra balls", () => {
  const state = testState([block(1, "right", "purple", 0, 0)]);
  const ball = testBall(12, 0, "player");
  applyPongBlockEffect(state, state.blocks[0], ball, () => 0.72);

  assert.equal(state.balls.length, 3);
  assert.equal(state.nextBallId, 4);
});

test("purple blocks cap the ball storm", () => {
  const state = testState([block(1, "right", "purple", 0, 0)]);
  state.balls = [
    testBall(12, 0, "player"),
    testBall(12, 1, "player"),
    testBall(12, 2, "player"),
    testBall(12, 3, "player")
  ];

  applyPongBlockEffect(state, state.blocks[0], state.balls[0], () => 0.99);

  assert.equal(state.balls.length, 5);
});

test("diamond block grants an extra player life to the user who hit it", () => {
  const diamond = block(1, "right", "blue", 0, 0);
  diamond.hasDiamond = true;
  const state = testState([diamond]);
  const ball = testBall(12, 0, "player");

  applyPongBlockEffect(state, diamond, ball, () => 0);

  assert.equal(state.playerLives, 4);
  assert.equal(state.score, 350);
});

test("ball speed increases as the game passes minute marks", () => {
  const state = createPongInitialState(() => 0.1);
  state.elapsedSeconds = 59.9;
  const before = state.speedBoost;
  stepPongState(state, { up: false, down: false }, 0.2, () => 0.1);

  assert.ok(state.speedBoost > before);
});

test("paddles shrink by ten percent every thirty seconds", () => {
  assert.equal(currentPaddleScale({ elapsedSeconds: 0 }), 1);
  assert.ok(Math.abs(currentPaddleScale({ elapsedSeconds: 30 }) - 0.9) < 0.0001);
  assert.ok(Math.abs(currentPaddleScale({ elapsedSeconds: 60 }) - 0.81) < 0.0001);
});

test("player life loss triggers an alien flyby taunt", () => {
  const state = createPongInitialState(() => 0.1);
  state.balls = [{
    id: 1,
    x: -30,
    y: 0,
    vx: -12,
    vy: 0,
    lastTouchedBy: "ai",
    removed: false
  }];

  stepPongState(state, { up: false, down: false }, 0.1, () => 0);

  assert.equal(state.playerLives, 2);
  assert.ok(state.ufoTimer > 0);
  assert.ok(state.playerDeathFlybyTimer > 0);
  assert.ok(state.playerDamageFeedbackTimer > 0);
  assert.match(state.lastMessage, /^Alien flyby:/);
});

test("player life loss has a short cooldown across multiple balls", () => {
  const state = createPongInitialState(() => 0.1);
  state.balls = [
    {
      id: 1,
      x: -30,
      y: 0,
      vx: -12,
      vy: 0,
      lastTouchedBy: "ai",
      removed: false
    },
    {
      id: 2,
      x: -31,
      y: 2,
      vx: -12,
      vy: 0,
      lastTouchedBy: "ai",
      removed: false
    }
  ];

  stepPongState(state, { up: false, down: false }, 0.1, () => 0.9);

  assert.equal(state.playerLives, 2);
  assert.ok(state.playerLifeLossCooldown > 0);
});

test("game-over restart countdown ticks down from three seconds", () => {
  const state = createPongInitialState(() => 0.1);
  state.gameOver = true;
  state.gameOverRestartSeconds = 3;

  stepPongState(state, { up: false, down: false }, 1.2, () => 0.1);

  assert.ok(state.gameOverRestartSeconds > 1.7);
  assert.ok(state.gameOverRestartSeconds < 1.9);
});

test("alien flyby can tilt the camera for five seconds before returning", () => {
  const state = createPongInitialState(() => 0.1);
  state.nextUfoAt = 0;

  stepPongState(state, { up: false, down: false }, 0.1, () => 0.1);

  assert.ok(state.cameraTiltTimer > 5);
  assert.match(state.lastMessage, /^Alien flyby:/);
  stepPongState(state, { up: false, down: false }, 5.1, () => 0.9);
  assert.ok(state.cameraTiltTimer > 0);
  assert.ok(state.cameraTiltTimer < 3);
});

function testState(blocks) {
  return {
    balls: [],
    blocks,
    nextBallId: 1,
    playerLives: 3,
    aiLives: 3,
    score: 0,
    cameraTiltTimer: 0,
    playerLifeLossCooldown: 0
  };
}

function block(id, side, type, x, y) {
  return {
    id,
    side,
    type,
    x,
    y,
    destroyed: false,
    hasDiamond: false
  };
}

function testBall(vx, vy, lastTouchedBy) {
  return {
    x: 0,
    y: 0,
    vx,
    vy,
    lastTouchedBy
  };
}

function speed(ball) {
  return Math.hypot(ball.vx, ball.vy);
}
