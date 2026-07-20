import { api } from "../../core/api.js";
import { createUfoShip } from "./about-ufo.js?v=20260712-about-kanban-parity-120";

export const ABOUT_PONG_GAME_KEY = "about-pong-blocks";

const WORLD_WIDTH = 48;
const WORLD_HEIGHT = 28;
const HALF_WIDTH = WORLD_WIDTH / 2;
const HALF_HEIGHT = WORLD_HEIGHT / 2;
const PADDLE_X = 18.2;
const PADDLE_WIDTH = 1.35;
const PADDLE_HEIGHT = 7.25;
const PADDLE_SPEED = 18;
const BALL_RADIUS = 0.45;
const BASE_BALL_SPEED = 11;
const MAX_BALL_SPEED = 24;
const MAX_BALLS = 5;
const BLOCK_WIDTH = 1.45;
const BLOCK_HEIGHT = 1.35;
const BLOCK_GAP = 0.16;
const SCORE_PER_BLOCK = 100;
const WIN_BONUS = 1000;
const CAMERA_NORMAL_FOV = 42;
const CAMERA_NORMAL_Z = 42;
const CAMERA_TILT_DURATION_SECONDS = 5;
const CAMERA_TILT_RETURN_SECONDS = 2.5;
const PLAYER_LIFE_LOSS_COOLDOWN_SECONDS = 1.15;
const GAME_OVER_RESTART_DELAY_SECONDS = 3;
const PADDLE_SHRINK_INTERVAL_SECONDS = 30;
const PADDLE_SHRINK_FACTOR = 0.9;
const PLAYER_DAMAGE_FEEDBACK_SECONDS = 0.58;
const STATUS_SEPARATOR = " \u2022 ";

const BLOCK_TYPES = [
  { type: "blue", color: 0x55b4ff, emissive: 0x164f9a },
  { type: "red", color: 0xff5a72, emissive: 0x8d1827 },
  { type: "yellow", color: 0xffdc5d, emissive: 0x87630f },
  { type: "green", color: 0x5df282, emissive: 0x14783a },
  { type: "purple", color: 0xb978ff, emissive: 0x4a1680 }
];

const REMARKS = [
  "Alien referee says: suspiciously athletic rectangle.",
  "UFO tax collected. One ball, please.",
  "Reminder: gravity filed a complaint.",
  "The alien likes your paddle discipline.",
  "Lightning mode: because normal Pong was too polite."
];

const PLAYER_DEATH_REMARKS = [
  "Alien flyby: your paddle had one job.",
  "Alien flyby: bold strategy, letting the ball leave.",
  "Alien flyby: I have seen toast with better reflexes.",
  "Alien flyby: Earth defense is not looking great.",
  "Alien flyby: that was less Pong, more permission slip."
];

const CAMERA_TILT_REMARKS = [
  "Alien flyby: tilting the camera because your strategy was too level.",
  "Alien flyby: behold, premium disorientation.",
  "Alien flyby: camera warranty voided for dramatic effect.",
  "Alien flyby: Earth Pong now comes with turbulence.",
  "Alien flyby: I rotated the universe. You are welcome."
];

export function createAboutPongGame({
  root,
  THREE,
  onActiveChange = () => {},
  onExit = () => {},
  standalone = false,
  allowClose = !standalone
}) {
  let overlay = null;
  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let frameId = 0;
  let lastFrameAt = 0;
  let active = false;
  let disposed = false;
  let saveStarted = false;
  let state = createPongInitialState(Math.random);
  let meshes = null;
  let resources = [];
  let keyState = { up: false, down: false };
  let statusElement = null;
  let scoreElement = null;
  let livesElement = null;
  let timeElement = null;
  let scoreboardElement = null;
  let messageElement = null;
  let gameOverElement = null;
  let restartButtonElement = null;
  let lastDisplayedMessage = "";

  root.dataset.aboutPong = "isolated-three-scene";
  root.dataset.aboutPongHotkey = "G";
  root.dataset.aboutPongActive = "false";
  root.dataset.aboutPongScoreStorage = "database-game-scores";
  root.dataset.aboutPongFlybyIsolation = standalone
    ? "dedicated-scene-no-about-flyby-renderer"
    : "separate-renderer-overlay";
  root.dataset.aboutPongCandyPolish = "rounded-glossy-physical-materials";
  root.dataset.aboutPongDangerBorder = "left-and-right-side-red";

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "about-pong";
    overlay.dataset.aboutPongOverlay = "";
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="about-pong-shell">
        <div class="about-pong-topbar">
          <div>
            <p class="about-pong-kicker">${standalone ? "Dedicated Pong scene" : "Press <kbd>G</kbd> to close"}</p>
            <h2>Pong + Blocks + Aliens</h2>
          </div>
          <p class="about-pong-message" data-about-pong-message aria-live="polite"></p>
          <div class="about-pong-live">
            <p class="about-pong-status" data-about-pong-status aria-live="polite"></p>
          </div>
          <div class="about-pong-stats" aria-live="polite">
            <span data-about-pong-score>Score 0</span>
            <span data-about-pong-lives>Lives 3</span>
            <span data-about-pong-time>00:00</span>
          </div>
          <div class="about-pong-actions">
            <button type="button" data-about-pong-restart>Restart</button>
            <button type="button" data-about-pong-close>Close</button>
          </div>
        </div>
        <div class="about-pong-body">
          <aside class="about-pong-rules" aria-label="How to play Pong Blocks">
            <h3>How to Play</h3>
            <p>Move the left paddle with <kbd>W</kbd>/<kbd>S</kbd> or the arrow keys.</p>
            <h4>Goal</h4>
            <p>Break every block behind the AI paddle on the right before the AI clears the blocks behind your paddle on the left.</p>
            <h4>Rules</h4>
            <ul>
              <li>Only the left and right block walls decide who wins.</li>
              <li>Top and bottom blocks are neutral blockers and power-ups.</li>
              <li>You start with 3 lives. Missing the ball costs a life.</li>
              <li>The ball gets faster every minute.</li>
            </ul>
            <h4>Block Colors</h4>
            <ul>
              <li><strong>Red</strong> explodes nearby blocks and slows the ball.</li>
              <li><strong>Yellow</strong> slows the ball.</li>
              <li><strong>Green</strong> speeds up the ball.</li>
              <li><strong>Purple</strong> spawns extra balls.</li>
              <li><strong>Diamond</strong> gives an extra life.</li>
            </ul>
          </aside>
          <div class="about-pong-stage">
            <canvas data-about-pong-canvas aria-label="3D Pong Blocks game. Use W S or Arrow Up and Arrow Down to move your left paddle."></canvas>
            <div class="about-pong-game-over" data-about-pong-game-over role="status" aria-live="polite" hidden>
              <strong>Game Over</strong>
              <span data-about-pong-game-over-detail>Restarting in 3...</span>
            </div>
          </div>
          <aside class="about-pong-board" aria-label="Pong leaderboard">
            <h3>Scoreboard</h3>
            <ol data-about-pong-scoreboard>
              <li>Loading scores...</li>
            </ol>
            <p>Clear the AI-side blocks first. Red explodes and slows, yellow slows, green speeds, purple multiplies, diamond gives a life.</p>
          </aside>
        </div>
      </div>
    `;

    root.append(overlay);
    canvas = overlay.querySelector("[data-about-pong-canvas]");
    statusElement = overlay.querySelector("[data-about-pong-status]");
    scoreElement = overlay.querySelector("[data-about-pong-score]");
    livesElement = overlay.querySelector("[data-about-pong-lives]");
    timeElement = overlay.querySelector("[data-about-pong-time]");
    scoreboardElement = overlay.querySelector("[data-about-pong-scoreboard]");
    messageElement = overlay.querySelector("[data-about-pong-message]");
    gameOverElement = overlay.querySelector("[data-about-pong-game-over]");
    restartButtonElement = overlay.querySelector("[data-about-pong-restart]");
    const closeButton = overlay.querySelector("[data-about-pong-close]");
    if (allowClose) closeButton.addEventListener("click", close);
    else closeButton.hidden = true;
    restartButtonElement.addEventListener("click", () => {
      if (state.gameOver && state.gameOverRestartSeconds > 0) {
        root.dataset.aboutPongLastAction = "waiting-for-game-over-countdown";
        return;
      }
      restart();
    });

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("resize", resize);
  }

  function ensureRenderer() {
    if (renderer) return;

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x030711, 38, 75);
    camera = new THREE.PerspectiveCamera(CAMERA_NORMAL_FOV, 1, 0.1, 120);
    camera.position.set(0, 0, CAMERA_NORMAL_Z);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.HemisphereLight(0xbadfff, 0x08111d, 1.4);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0, -18, 28);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const cyanRim = new THREE.PointLight(0x7be7ff, 42, 70, 2);
    cyanRim.position.set(-18, 12, 18);
    scene.add(cyanRim);
    const pinkRim = new THREE.PointLight(0xff7cab, 32, 70, 2);
    pinkRim.position.set(18, -12, 16);
    scene.add(pinkRim);

    const arena = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_WIDTH + 4, WORLD_HEIGHT + 4),
      new THREE.MeshStandardMaterial({
        color: 0x061322,
        metalness: 0.1,
        roughness: 0.72,
        emissive: 0x02060c
      })
    );
    arena.position.z = -0.55;
    arena.receiveShadow = true;
    scene.add(arena);
    resources.push(arena.geometry, arena.material);

    const border = createArenaBorder(THREE);
    scene.add(border.group);
    resources.push(...border.resources);

    meshes = {
      player: createCandyBoxMesh(THREE, 0x8ff4ff, 0x167993, PADDLE_WIDTH, PADDLE_HEIGHT, 1.1),
      ai: createCandyBoxMesh(THREE, 0xff85bd, 0x8b2350, PADDLE_WIDTH, PADDLE_HEIGHT, 1.1),
      balls: new Map(),
      blocks: new Map(),
      ufo: createUfoMesh(THREE),
      lightning: createLightningMesh(THREE)
    };
    meshes.player.castShadow = true;
    meshes.ai.castShadow = true;
    meshes.player.material.emissiveIntensity = 1.15;
    meshes.ai.material.emissiveIntensity = 1.15;
    scene.add(meshes.player, meshes.ai, meshes.ufo.group, meshes.lightning.group);

    resources.push(
      ...meshResourceList(meshes.player),
      ...meshResourceList(meshes.ai),
      ...meshes.ufo.resources,
      ...meshes.lightning.resources
    );

    syncBlockMeshes();
    resize();
  }

  function open() {
    if (active) return;
    ensureOverlay();
    ensureRenderer();
    active = true;
    overlay.hidden = false;
    resize();
    root.dataset.aboutPongActive = "true";
    root.dataset.aboutPongLastAction = "opened";
    onActiveChange(true);
    if (state.gameOver) restart();
    lastFrameAt = performance.now();
    loadScores();
    frameId = requestAnimationFrame(frame);
  }

  function close() {
    const wasActive = active;
    active = false;
    keyState = { up: false, down: false };
    if (overlay) overlay.hidden = true;
    root.dataset.aboutPongActive = "false";
    root.dataset.aboutPongLastAction = "closed";
    if (wasActive) onActiveChange(false);
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function toggle() {
    if (active) close();
    else open();
  }

  function restart() {
    state = createPongInitialState(Math.random);
    saveStarted = false;
    lastDisplayedMessage = "";
    root.dataset.aboutPongLastAction = "restart";
    if (meshes) {
      clearMeshMap(meshes.blocks);
      clearMeshMap(meshes.balls);
      syncBlockMeshes();
      syncBallMeshes();
    }
    renderHud();
    setMessage("Serve launched. Protect your blocks, break theirs.");
  }

  function frame(now) {
    if (!active || disposed) return;

    const delta = Math.min((now - lastFrameAt) / 1000, 0.033);
    lastFrameAt = now;
    stepPongState(state, keyState, delta, Math.random);
    if (state.lastMessage && state.lastMessage !== lastDisplayedMessage) {
      lastDisplayedMessage = state.lastMessage;
      setMessage(state.lastMessage);
    }
    if (state.gameOver && !saveStarted) {
      saveStarted = true;
      saveScore();
    }
    if (state.gameOver && state.gameOverRestartSeconds <= 0) {
      restart();
    }
    syncMeshes();
    renderer.render(scene, camera);
    renderHud();

    frameId = requestAnimationFrame(frame);
  }

  function syncMeshes() {
    const paddleScale = currentPaddleScale(state);
    meshes.player.position.set(-PADDLE_X, state.playerY, 0.45);
    meshes.ai.position.set(PADDLE_X, state.aiY, 0.45);
    meshes.player.scale.set(paddleScale, paddleScale, 1);
    meshes.ai.scale.set(paddleScale, paddleScale, 1);
    syncBlockMeshes();
    syncBallMeshes();
    syncUfo();
    syncLightning();
    syncCamera();
  }

  function syncBallMeshes() {
    const seen = new Set();
    for (const ball of state.balls) {
      seen.add(ball.id);
      let mesh = meshes.balls.get(ball.id);
      if (!mesh) {
        mesh = createBallMesh(THREE);
        meshes.balls.set(ball.id, mesh);
        scene.add(mesh);
        resources.push(...meshResourceList(mesh));
      }
      mesh.position.set(ball.x, ball.y, 0.25);
      mesh.scale.setScalar(THREE.MathUtils.clamp(currentBallSpeed(ball) / BASE_BALL_SPEED, 0.8, 1.45));
    }

    for (const [id, mesh] of meshes.balls) {
      if (seen.has(id)) continue;
      scene.remove(mesh);
      disposeObjectResources(mesh);
      meshes.balls.delete(id);
    }
  }

  function syncBlockMeshes() {
    const seen = new Set();
    for (const block of state.blocks) {
      if (block.destroyed) continue;
      seen.add(block.id);
      let mesh = meshes.blocks.get(block.id);
      if (!mesh) {
        const style = BLOCK_TYPES.find(item => item.type === block.type) || BLOCK_TYPES[0];
        mesh = createCandyBoxMesh(THREE, style.color, style.emissive, BLOCK_WIDTH, BLOCK_HEIGHT, 0.82);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes.blocks.set(block.id, mesh);
        scene.add(mesh);
        resources.push(...meshResourceList(mesh));
      }
      mesh.position.set(block.x, block.y, block.hasDiamond ? 0.22 : 0);
      mesh.rotation.z = block.hasDiamond ? Math.sin(performance.now() / 350) * 0.04 : 0;
      mesh.material.emissiveIntensity = block.hasDiamond ? 1.15 : 0.62;
    }

    for (const [id, mesh] of meshes.blocks) {
      if (seen.has(id)) continue;
      scene.remove(mesh);
      disposeObjectResources(mesh);
      meshes.blocks.delete(id);
    }
  }

  function syncUfo() {
    const activeUfo = state.ufoTimer > 0;
    meshes.ufo.group.visible = activeUfo;
    if (!activeUfo) return;
    const hover = Math.sin(state.elapsedSeconds * 4) * 0.55;
    const flyby = Math.max(0, state.playerDeathFlybyTimer || 0);
    const flybyProgress = flyby > 0 ? 1 - flyby / 3.2 : 0.5;
    const flybyX = flyby > 0 ? (-HALF_WIDTH - 3) + (WORLD_WIDTH + 6) * flybyProgress : 0;
    meshes.ufo.group.position.set(flybyX, hover, 3.2);
    meshes.ufo.group.rotation.y += 0.045;
  }

  function syncLightning() {
    const activeLightning = state.lightningTimer > 0;
    meshes.lightning.group.visible = activeLightning;
    if (!activeLightning) return;
    meshes.lightning.group.rotation.z = Math.sin(state.elapsedSeconds * 38) * 0.12;
    meshes.lightning.group.scale.y = 0.9 + Math.random() * 0.18;
  }

  function syncCamera() {
    const effect = cameraTiltEffect(state);
    camera.position.set(effect.x, effect.y, effect.z);
    camera.fov = effect.fov;
    camera.lookAt(0, 0, 0);
    camera.rotation.z += effect.roll;
    camera.updateProjectionMatrix();
    root.dataset.aboutPongCameraTiltActive = String(effect.amount > 0);
    root.dataset.aboutPongCameraTiltSeconds = state.cameraTiltTimer.toFixed(2);
  }

  function renderHud() {
    if (!scoreElement) return;
    scoreElement.textContent = `Score ${state.score}`;
    livesElement.textContent = `Lives ${state.playerLives}`;
    timeElement.textContent = formatDuration(state.elapsedSeconds);
    statusElement.textContent = state.gameOver
      ? (state.won ? "You cleared the AI blocks. Victory saved!" : "Game over. Score saved.")
      : `${state.balls.length} ball${state.balls.length === 1 ? "" : "s"}${STATUS_SEPARATOR}AI blocks ${remainingBlocks("right")}${STATUS_SEPARATOR}Your blocks ${remainingBlocks("left")}`;
    if (gameOverElement) {
      gameOverElement.hidden = !state.gameOver;
      const detail = gameOverElement.querySelector("[data-about-pong-game-over-detail]");
      if (detail) {
        const countdown = Math.max(1, Math.ceil(state.gameOverRestartSeconds || GAME_OVER_RESTART_DELAY_SECONDS));
        detail.textContent = state.won
          ? `You cleared the AI-side blocks. Restarting in ${countdown}... Press Esc for the 3D flyby.`
          : `The aliens filed your paddle under decorative object. Restarting in ${countdown}... Press Esc for the 3D flyby.`;
      }
    }
    if (restartButtonElement) {
      restartButtonElement.disabled = state.gameOver && state.gameOverRestartSeconds > 0;
      restartButtonElement.title = restartButtonElement.disabled
        ? "Restart is available after the countdown."
        : "Restart Pong";
    }
    root.dataset.aboutPongScore = String(state.score);
    root.dataset.aboutPongPlayerLives = String(state.playerLives);
    root.dataset.aboutPongBallCount = String(state.balls.length);
    root.dataset.aboutPongGameOver = String(state.gameOver);
    root.dataset.aboutPongDamageActive = String((state.playerDamageFeedbackTimer || 0) > 0);
    root.dataset.aboutPongRestartCountdown = state.gameOver
      ? String(Math.max(1, Math.ceil(state.gameOverRestartSeconds || GAME_OVER_RESTART_DELAY_SECONDS)))
      : "0";
  }

  function remainingBlocks(side) {
    return state.blocks.filter(block => block.side === side && !block.destroyed).length;
  }

  function setMessage(text) {
    if (!messageElement) return;
    messageElement.textContent = text;
    window.clearTimeout(Number(messageElement.dataset.messageTimer || 0));
    const timer = window.setTimeout(() => {
      if (messageElement?.textContent === text) messageElement.textContent = "";
    }, 3500);
    messageElement.dataset.messageTimer = String(timer);
  }

  async function loadScores() {
    try {
      const scores = await api(`/api/game-scores/${encodeURIComponent(ABOUT_PONG_GAME_KEY)}?top=10`);
      renderScores(scores);
      root.dataset.aboutPongScoreboard = "loaded";
    } catch {
      if (scoreboardElement) scoreboardElement.innerHTML = "<li>Scores unavailable.</li>";
      root.dataset.aboutPongScoreboard = "unavailable";
    }
  }

  async function saveScore() {
    try {
      await api("/api/game-scores", {
        method: "POST",
        body: JSON.stringify({
          gameKey: ABOUT_PONG_GAME_KEY,
          score: state.score,
          durationSeconds: Math.round(state.elapsedSeconds),
          won: state.won
        })
      });
      await loadScores();
      root.dataset.aboutPongScoreSaved = "true";
    } catch {
      root.dataset.aboutPongScoreSaved = "false";
      setMessage("Score could not be saved, but the aliens still respect the effort.");
    }
  }

  function renderScores(scores) {
    if (!scoreboardElement) return;
    if (!Array.isArray(scores) || scores.length === 0) {
      scoreboardElement.innerHTML = "<li>No scores yet. Be the first menace.</li>";
      return;
    }

    scoreboardElement.innerHTML = scores
      .map(score => `
        <li>
          <span>${escapeHtml(score.playerName || "Player")}</span>
          <strong>${Number(score.score || 0).toLocaleString()}</strong>
          <small>${formatDuration(Number(score.durationSeconds || 0))}${score.won ? `${STATUS_SEPARATOR}win` : ""}</small>
        </li>
      `)
      .join("");
  }

  function onKeyDown(event) {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (state.gameOver) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "Escape") {
        root.dataset.aboutPongLastAction = "return-to-3d-flyby";
        onExit();
      } else if (!isModifierKey(event.code)) {
        root.dataset.aboutPongLastAction = "waiting-for-game-over-countdown";
      }
      return;
    }
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      keyState.up = true;
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      keyState.down = true;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function onKeyUp(event) {
    if (!active) return;
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      keyState.up = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      keyState.down = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function resize() {
    if (!renderer || !overlay || overlay.hidden) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function clearMeshMap(map) {
    for (const mesh of map.values()) {
      scene.remove(mesh);
      disposeObjectResources(mesh);
    }
    map.clear();
  }

  function dispose() {
    disposed = true;
    close();
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("resize", resize);
    for (const resource of resources) resource?.dispose?.();
    renderer?.dispose?.();
    overlay?.remove();
  }

  return {
    open,
    close,
    toggle,
    dispose,
    isActive: () => active
  };
}

export function createPongInitialState(random = Math.random) {
  const blocks = createBlocks(random);
  const diamondIndex = Math.floor(random() * blocks.length);
  blocks[diamondIndex].hasDiamond = true;
  return {
    playerY: 0,
    aiY: 0,
    playerLives: 3,
    aiLives: 3,
    score: 0,
    elapsedSeconds: 0,
    speedBoost: 1,
    balls: [createBall(0, 0, random() < 0.5 ? 1 : -1, random)],
    blocks,
    nextBallId: 2,
    nextUfoAt: 16 + random() * 10,
    ufoTimer: 0,
    playerDeathFlybyTimer: 0,
    cameraTiltTimer: 0,
    cameraTiltRoll: 0,
    cameraTiltX: 0,
    cameraTiltY: 0,
    cameraTiltZoom: 0,
    playerLifeLossCooldown: 0,
    playerDamageFeedbackTimer: 0,
    nextLightningAt: 11 + random() * 13,
    lightningTimer: 0,
    gameOver: false,
    gameOverRestartSeconds: 0,
    won: false,
    lastMessage: ""
  };
}

export function stepPongState(state, input, delta, random = Math.random) {
  tickPongTimers(state, delta);
  if (state.gameOver) return state;

  state.elapsedSeconds += delta;
  state.speedBoost = 1 + Math.floor(state.elapsedSeconds / 60) * 0.12;
  const paddle = currentPaddleSize(state);
  state.playerY = clamp(
    state.playerY + ((input.down ? -1 : 0) + (input.up ? 1 : 0)) * PADDLE_SPEED * delta,
    -HALF_HEIGHT + paddle.height / 2,
    HALF_HEIGHT - paddle.height / 2
  );

  const target = nearestBallY(state.balls, PADDLE_X) ?? 0;
  const aiDelta = clamp(target - state.aiY, -1, 1) * (PADDLE_SPEED * 0.82) * delta;
  state.aiY = clamp(
    state.aiY + aiDelta,
    -HALF_HEIGHT + paddle.height / 2,
    HALF_HEIGHT - paddle.height / 2
  );

  if (state.elapsedSeconds >= state.nextUfoAt) triggerUfo(state, random);
  if (state.elapsedSeconds >= state.nextLightningAt) triggerLightning(state, random);

  for (const ball of [...state.balls]) {
    moveBall(state, ball, delta, random);
  }

  state.balls = state.balls.filter(ball => !ball.removed);
  if (state.balls.length === 0 && !state.gameOver) {
    state.balls.push(createBall(0, 0, random() < 0.5 ? 1 : -1, random, state.nextBallId++));
  }

  const playerClearedAiBlocks = state.blocks.every(block => block.side !== "right" || block.destroyed);
  const aiClearedPlayerBlocks = state.blocks.every(block => block.side !== "left" || block.destroyed);
  if (playerClearedAiBlocks) endGame(state, true);
  else if (aiClearedPlayerBlocks || state.playerLives <= 0) endGame(state, false);

  return state;
}

export function applyPongBlockEffect(state, block, ball, random = Math.random) {
  let removed = 1;
  block.destroyed = true;

  if (block.side === "right" && ball.lastTouchedBy === "player") state.score += SCORE_PER_BLOCK;
  if (block.hasDiamond) {
    if (ball.lastTouchedBy === "ai") state.aiLives += 1;
    else {
      state.playerLives += 1;
      state.score += 250;
    }
  }

  if (block.type === "red") {
    multiplyBallSpeed(ball, 0.9);
    for (const neighbor of state.blocks) {
      if (neighbor.destroyed || neighbor.side !== block.side) continue;
      if (Math.abs(neighbor.x - block.x) <= BLOCK_WIDTH * 1.4
        && Math.abs(neighbor.y - block.y) <= BLOCK_HEIGHT * 1.4) {
        neighbor.destroyed = true;
        removed += 1;
        if (neighbor.side === "right" && ball.lastTouchedBy === "player") state.score += Math.round(SCORE_PER_BLOCK * 0.5);
      }
    }
  } else if (block.type === "yellow") {
    multiplyBallSpeed(ball, 0.78);
  } else if (block.type === "green") {
    multiplyBallSpeed(ball, 1.22);
  } else if (block.type === "purple") {
    const count = 1 + Math.floor(random() * 3);
    for (let index = 0; index < count; index += 1) {
      if (state.balls.length >= MAX_BALLS) break;
      const clone = createBall(block.x, block.y, ball.vx >= 0 ? -1 : 1, random, state.nextBallId++);
      clone.lastTouchedBy = ball.lastTouchedBy;
      state.balls.push(clone);
    }
  }

  return removed;
}

function moveBall(state, ball, delta, random) {
  const speedScale = state.speedBoost;
  ball.x += ball.vx * speedScale * delta;
  ball.y += ball.vy * speedScale * delta;

  if (ball.y <= -HALF_HEIGHT + BALL_RADIUS || ball.y >= HALF_HEIGHT - BALL_RADIUS) {
    ball.y = clamp(ball.y, -HALF_HEIGHT + BALL_RADIUS, HALF_HEIGHT - BALL_RADIUS);
    ball.vy *= -1;
  }

  const paddle = currentPaddleSize(state);
  collidePaddle(ball, -PADDLE_X, state.playerY, "player", paddle.width, paddle.height);
  collidePaddle(ball, PADDLE_X, state.aiY, "ai", paddle.width, paddle.height);
  collideBlocks(state, ball, random);

  if (ball.x < -HALF_WIDTH - BALL_RADIUS) {
    if (state.playerLifeLossCooldown <= 0) {
      state.playerLives -= 1;
      state.playerLifeLossCooldown = PLAYER_LIFE_LOSS_COOLDOWN_SECONDS;
      triggerPlayerDeathFlyby(state, random);
    }
    ball.removed = true;
  } else if (ball.x > HALF_WIDTH + BALL_RADIUS) {
    ball.removed = true;
  }
}

function triggerPlayerDeathFlyby(state, random) {
  state.ufoTimer = Math.max(state.ufoTimer, 3.2);
  state.playerDeathFlybyTimer = 3.2;
  state.playerDamageFeedbackTimer = PLAYER_DAMAGE_FEEDBACK_SECONDS;
  state.lastMessage = PLAYER_DEATH_REMARKS[Math.floor(random() * PLAYER_DEATH_REMARKS.length)];
  maybeTriggerCameraTilt(state, random);
}

function collidePaddle(ball, paddleX, paddleY, owner, paddleWidth, paddleHeight) {
  const overlapsX = Math.abs(ball.x - paddleX) <= paddleWidth / 2 + BALL_RADIUS;
  const overlapsY = Math.abs(ball.y - paddleY) <= paddleHeight / 2 + BALL_RADIUS;
  if (!overlapsX || !overlapsY) return;
  if (owner === "player" && ball.vx >= 0) return;
  if (owner === "ai" && ball.vx <= 0) return;

  const hit = clamp((ball.y - paddleY) / (paddleHeight / 2), -1, 1);
  const speed = Math.max(BASE_BALL_SPEED, currentBallSpeed(ball) * 1.03);
  ball.vx = (owner === "player" ? 1 : -1) * Math.max(7, Math.abs(ball.vx));
  ball.vy += hit * 5.5;
  normalizeBall(ball, speed);
  ball.x = paddleX + (owner === "player" ? 1 : -1) * (paddleWidth / 2 + BALL_RADIUS + 0.02);
  ball.lastTouchedBy = owner;
}

function collideBlocks(state, ball, random) {
  for (const block of state.blocks) {
    if (block.destroyed) continue;
    if (Math.abs(ball.x - block.x) > BLOCK_WIDTH / 2 + BALL_RADIUS) continue;
    if (Math.abs(ball.y - block.y) > BLOCK_HEIGHT / 2 + BALL_RADIUS) continue;

    applyPongBlockEffect(state, block, ball, random);
    const overlapX = BLOCK_WIDTH / 2 + BALL_RADIUS - Math.abs(ball.x - block.x);
    const overlapY = BLOCK_HEIGHT / 2 + BALL_RADIUS - Math.abs(ball.y - block.y);
    if (overlapX < overlapY) ball.vx *= -1;
    else ball.vy *= -1;
    normalizeBall(ball, currentBallSpeed(ball));
    return;
  }
}

function createBlocks(random) {
  const blocks = [];
  const rows = 12;
  const columns = 3;
  let id = 1;
  for (const side of ["left", "right"]) {
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const xDirection = side === "left" ? -1 : 1;
        const x = xDirection * (HALF_WIDTH - 1.35 - column * (BLOCK_WIDTH + BLOCK_GAP));
        const y = -((rows - 1) * (BLOCK_HEIGHT + BLOCK_GAP)) / 2 + row * (BLOCK_HEIGHT + BLOCK_GAP);
        const palette = BLOCK_TYPES[Math.floor(random() * BLOCK_TYPES.length)];
        blocks.push({
          id: id++,
          side,
          type: palette.type,
          x,
          y,
          destroyed: false,
          hasDiamond: false
        });
      }
    }
  }

  const topBottomColumns = 20;
  const topBottomRows = 2;
  for (const side of ["top", "bottom"]) {
    for (let row = 0; row < topBottomRows; row += 1) {
      for (let column = 0; column < topBottomColumns; column += 1) {
        const x = -((topBottomColumns - 1) * (BLOCK_WIDTH + BLOCK_GAP)) / 2 + column * (BLOCK_WIDTH + BLOCK_GAP);
        const yDirection = side === "top" ? 1 : -1;
        const y = yDirection * (HALF_HEIGHT - 1.15 - row * (BLOCK_HEIGHT + BLOCK_GAP));
        const palette = BLOCK_TYPES[Math.floor(random() * BLOCK_TYPES.length)];
        blocks.push({
          id: id++,
          side,
          type: palette.type,
          x,
          y,
          destroyed: false,
          hasDiamond: false
        });
      }
    }
  }
  return blocks;
}

function createBall(x, y, direction, random, id = 1) {
  const angle = (random() * 0.7 - 0.35);
  const ball = {
    id,
    x,
    y,
    vx: direction * BASE_BALL_SPEED,
    vy: Math.sin(angle) * BASE_BALL_SPEED,
    lastTouchedBy: direction > 0 ? "player" : "ai",
    removed: false
  };
  normalizeBall(ball, BASE_BALL_SPEED);
  return ball;
}

function triggerUfo(state, random) {
  state.ufoTimer = 4.2;
  state.nextUfoAt = state.elapsedSeconds + 18 + random() * 18;
  if (state.balls.length > 0) {
    const ball = state.balls[Math.floor(random() * state.balls.length)];
    ball.x = 0;
    ball.y = 0;
    ball.vx = (random() < 0.5 ? -1 : 1) * BASE_BALL_SPEED;
    ball.vy = (random() * 2 - 1) * BASE_BALL_SPEED * 0.65;
    normalizeBall(ball, BASE_BALL_SPEED * 1.08);
  }
  if (!maybeTriggerCameraTilt(state, random)) {
    state.lastMessage = REMARKS[Math.floor(random() * REMARKS.length)];
  }
}

function tickPongTimers(state, delta) {
  state.ufoTimer = Math.max(0, (state.ufoTimer || 0) - delta);
  state.playerDeathFlybyTimer = Math.max(0, (state.playerDeathFlybyTimer || 0) - delta);
  state.lightningTimer = Math.max(0, (state.lightningTimer || 0) - delta);
  state.cameraTiltTimer = Math.max(0, (state.cameraTiltTimer || 0) - delta);
  state.playerLifeLossCooldown = Math.max(0, (state.playerLifeLossCooldown || 0) - delta);
  state.playerDamageFeedbackTimer = Math.max(0, (state.playerDamageFeedbackTimer || 0) - delta);
  if (state.gameOver) {
    state.gameOverRestartSeconds = Math.max(0, (state.gameOverRestartSeconds || 0) - delta);
  }
}

function maybeTriggerCameraTilt(state, random) {
  if ((state.cameraTiltTimer || 0) > 0) return false;
  if (random() > 0.55) return false;

  const direction = random() < 0.5 ? -1 : 1;
  state.cameraTiltTimer = CAMERA_TILT_DURATION_SECONDS + CAMERA_TILT_RETURN_SECONDS;
  state.cameraTiltRoll = direction * (0.09 + random() * 0.08);
  state.cameraTiltX = direction * (1.5 + random() * 1.35);
  state.cameraTiltY = (random() * 2 - 1) * 0.8;
  state.cameraTiltZoom = 2.5 + random() * 3.5;
  state.lastMessage = CAMERA_TILT_REMARKS[Math.floor(random() * CAMERA_TILT_REMARKS.length)];
  return true;
}

function cameraTiltEffect(state) {
  const timer = state.cameraTiltTimer || 0;
  if (timer <= 0) {
    return {
      amount: 0,
      x: 0,
      y: 0,
      z: CAMERA_NORMAL_Z,
      roll: 0,
      fov: CAMERA_NORMAL_FOV
    };
  }

  const amount = timer > CAMERA_TILT_RETURN_SECONDS
    ? 1
    : smoothStep(timer / CAMERA_TILT_RETURN_SECONDS);
  return {
    amount,
    x: (state.cameraTiltX || 0) * amount,
    y: (state.cameraTiltY || 0) * amount,
    z: CAMERA_NORMAL_Z - (state.cameraTiltZoom || 0) * amount,
    roll: (state.cameraTiltRoll || 0) * amount,
    fov: CAMERA_NORMAL_FOV + 3 * amount
  };
}

function triggerLightning(state, random) {
  state.lightningTimer = 0.7;
  state.nextLightningAt = state.elapsedSeconds + 13 + random() * 18;
  for (const ball of state.balls) {
    ball.vy += (random() * 2 - 1) * 8;
    ball.vx += (random() * 2 - 1) * 3;
    normalizeBall(ball, currentBallSpeed(ball) * 1.04);
  }
  state.lastMessage = REMARKS[Math.floor(random() * REMARKS.length)];
}

function endGame(state, won) {
  state.gameOver = true;
  state.won = won;
  state.gameOverRestartSeconds = GAME_OVER_RESTART_DELAY_SECONDS;
  if (won) state.score += WIN_BONUS + Math.max(0, state.playerLives) * 150;
}

function nearestBallY(balls, x) {
  let nearest = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const ball of balls) {
    const ballDistance = Math.abs(ball.x - x);
    if (ballDistance < distance) {
      distance = ballDistance;
      nearest = ball;
    }
  }
  return nearest?.y ?? null;
}

function multiplyBallSpeed(ball, multiplier) {
  normalizeBall(ball, currentBallSpeed(ball) * multiplier);
}

function normalizeBall(ball, speed) {
  const clampedSpeed = clamp(speed, BASE_BALL_SPEED * 0.62, MAX_BALL_SPEED);
  const length = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx = (ball.vx / length) * clampedSpeed;
  ball.vy = (ball.vy / length) * clampedSpeed;
  if (Math.abs(ball.vx) < 5) ball.vx = Math.sign(ball.vx || 1) * 5;
}

function currentBallSpeed(ball) {
  return Math.hypot(ball.vx, ball.vy);
}

export function currentPaddleScale(state) {
  const shrinkSteps = Math.floor(Math.max(0, state.elapsedSeconds || 0) / PADDLE_SHRINK_INTERVAL_SECONDS);
  return PADDLE_SHRINK_FACTOR ** shrinkSteps;
}

function currentPaddleSize(state) {
  const scale = currentPaddleScale(state);
  return {
    width: PADDLE_WIDTH * scale,
    height: PADDLE_HEIGHT * scale
  };
}

function createCandyBoxMesh(THREE, color, emissive, width, height, depth) {
  const radius = Math.min(width, height) * 0.18;
  const shape = createRoundedRectangleShape(THREE, width, height, radius);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: Math.min(0.16, depth * 0.22),
    bevelSize: Math.min(0.16, radius * 0.55),
    bevelSegments: 4,
    curveSegments: 10,
    steps: 1
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();

  const MaterialType = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
  const material = new MaterialType({
    color,
    emissive,
    emissiveIntensity: 0.62,
    roughness: 0.18,
    metalness: 0.08,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.6
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.add(createCandyHighlightMesh(THREE, width, height, depth));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRoundedRectangleShape(THREE, width, height, radius) {
  const shape = new THREE.Shape();
  const left = -width / 2;
  const right = width / 2;
  const top = height / 2;
  const bottom = -height / 2;
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

  shape.moveTo(left + safeRadius, bottom);
  shape.lineTo(right - safeRadius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + safeRadius);
  shape.lineTo(right, top - safeRadius);
  shape.quadraticCurveTo(right, top, right - safeRadius, top);
  shape.lineTo(left + safeRadius, top);
  shape.quadraticCurveTo(left, top, left, top - safeRadius);
  shape.lineTo(left, bottom + safeRadius);
  shape.quadraticCurveTo(left, bottom, left + safeRadius, bottom);

  return shape;
}

function createCandyHighlightMesh(THREE, width, height, depth) {
  const highlightWidth = Math.max(0.16, width * 0.24);
  const highlightHeight = Math.max(0.22, height * 0.58);
  const radius = Math.min(highlightWidth, highlightHeight) * 0.45;
  const geometry = new THREE.ShapeGeometry(
    createRoundedRectangleShape(THREE, highlightWidth, highlightHeight, radius)
  );
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const highlight = new THREE.Mesh(geometry, material);
  highlight.position.set(-width * 0.18, height * 0.08, depth / 2 + 0.014);
  return highlight;
}

function meshResourceList(object) {
  const list = [];
  object.traverse?.(child => {
    if (child.geometry) list.push(child.geometry);
    if (Array.isArray(child.material)) list.push(...child.material);
    else if (child.material) list.push(child.material);
  });
  return list;
}

function disposeObjectResources(object) {
  for (const resource of meshResourceList(object)) resource?.dispose?.();
}

function createBallMesh(THREE) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 24, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x7be7ff,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.35
    })
  );
  mesh.castShadow = true;
  return mesh;
}

function createArenaBorder(THREE) {
  const group = new THREE.Group();
  const resources = [];
  const blueMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e8fff,
    emissive: 0x0c4b94,
    emissiveIntensity: 0.6
  });
  const redMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3f64,
    emissive: 0x981528,
    emissiveIntensity: 0.95
  });
  const horizontalGeometry = new THREE.BoxGeometry(WORLD_WIDTH, 0.16, 0.25);
  const verticalGeometry = new THREE.BoxGeometry(0.16, WORLD_HEIGHT, 0.25);
  resources.push(blueMaterial, redMaterial, horizontalGeometry, verticalGeometry);
  for (const y of [-HALF_HEIGHT, HALF_HEIGHT]) {
    const edge = new THREE.Mesh(horizontalGeometry, blueMaterial);
    edge.position.set(0, y, 0);
    group.add(edge);
  }
  for (const x of [-HALF_WIDTH, HALF_WIDTH]) {
    const edge = new THREE.Mesh(verticalGeometry, redMaterial);
    edge.position.set(x, 0, 0);
    group.add(edge);
  }
  return { group, resources };
}

function createUfoMesh() {
  const resourceSet = new Set();
  const group = createUfoShip(resourceSet);
  group.scale.setScalar(1.45);
  group.visible = false;
  group.userData.pongUsesSharedAboutFlybyUfo = true;
  return { group, resources: [...resourceSet] };
}

function createLightningMesh(THREE) {
  const group = new THREE.Group();
  const resources = [];
  const material = new THREE.LineBasicMaterial({ color: 0x9df7ff, linewidth: 2 });
  const points = [
    new THREE.Vector3(-2.8, HALF_HEIGHT, 4),
    new THREE.Vector3(-0.6, 6, 2.2),
    new THREE.Vector3(-1.3, 2, 3.2),
    new THREE.Vector3(1.1, -2, 2),
    new THREE.Vector3(0.2, -HALF_HEIGHT, 3.4)
  ];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  group.add(line);
  group.visible = false;
  resources.push(material, geometry);
  return { group, resources };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function isModifierKey(code) {
  return code === "ShiftLeft"
    || code === "ShiftRight"
    || code === "ControlLeft"
    || code === "ControlRight"
    || code === "AltLeft"
    || code === "AltRight"
    || code === "MetaLeft"
    || code === "MetaRight";
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
