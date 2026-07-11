import * as THREE from "../../vendor/three/three.module.min.js";
import { PointerLockControls } from "../../vendor/three/addons/controls/PointerLockControls.js?v=0.185.1-pmt1";

const LOOP_DURATION_SECONDS = 82;
const DRONE_HEADING_RESPONSE = 5.2;
const IDLE_DURATION_MS = 5000;
const RETURN_DURATION_MS = 3250;
const WALK_SPEED = 6;
const BOOST_SPEED = 13;
const CAMERA_FAR_LIMIT = 80;
const MIN_FLIGHT_SPEED = 0.25;
const MAX_FLIGHT_SPEED = 3;
const FLIGHT_SPEED_STEP = 0.25;
const BACKSIDE_SPEED_BOOST = 2;
const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space"
]);
const BOOST_KEYS = new Set(["ShiftLeft", "ShiftRight"]);

export function createAboutFlightController({
  camera,
  canvas,
  root,
  portal,
  statusElement,
  modeElement,
  reducedMotion
}) {
  const abortController = new AbortController();
  const controls = new PointerLockControls(camera, canvas);
  const curve = createFlightCurve(portal);
  const keys = new Set();
  const pose = createPose();
  const autopilotTarget = createPose();
  const returnTarget = createPose();
  const returnFromPosition = new THREE.Vector3();
  const returnFromQuaternion = new THREE.Quaternion();
  const cinematicTarget = new THREE.Vector3();
  const cinematicQuaternion = new THREE.Quaternion();
  const cinematicLookMatrix = new THREE.Matrix4();
  const cinematicUp = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();
  const localUp = new THREE.Vector3(0, 1, 0);
  const dragEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const minPosition = new THREE.Vector3(-CAMERA_FAR_LIMIT, -CAMERA_FAR_LIMIT, -CAMERA_FAR_LIMIT);
  const maxPosition = new THREE.Vector3(CAMERA_FAR_LIMIT, CAMERA_FAR_LIMIT, CAMERA_FAR_LIMIT);

  let prefersReducedMotion = reducedMotion;
  let mode = "intro";
  let autopilotPhase = 0;
  let flightSpeed = 1;
  let cinematicAttention = 0;
  let cinematicSpeedScale = 1;
  let cinematicHudActive = false;
  let lastInputAt = performance.now();
  let returnStartedAt = 0;
  let returnFromFov = camera.fov;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let disposed = false;

  controls.pointerSpeed = 0.72;
  sampleFlightPose(curve, portal, autopilotPhase, pose);
  applyPose(camera, pose);
  setMode(mode);

  const listenerOptions = { signal: abortController.signal };
  canvas.addEventListener("pointerdown", onPointerDown, listenerOptions);
  canvas.addEventListener("pointermove", onPointerMove, listenerOptions);
  canvas.addEventListener("pointerup", stopDragging, listenerOptions);
  canvas.addEventListener("pointercancel", stopDragging, listenerOptions);
  canvas.addEventListener("wheel", onWheel, { passive: false, signal: abortController.signal });
  window.addEventListener("keydown", onKeyDown, listenerOptions);
  window.addEventListener("keyup", onKeyUp, listenerOptions);
  window.addEventListener("blur", clearKeys, listenerOptions);
  controls.addEventListener("change", onPointerLockChange);
  controls.addEventListener("lock", onPointerLockStart);
  controls.addEventListener("unlock", onPointerLockEnd);

  function startAutopilot() {
    if (disposed) return;
    setMode(prefersReducedMotion ? "reduced" : "auto");
  }

  function update(now, deltaSeconds) {
    if (disposed) return;

    if (mode === "auto") {
      const backsideProgress = smoothStepRange(2, 10, -camera.position.z);
      const routeSpeed = THREE.MathUtils.lerp(1, BACKSIDE_SPEED_BOOST, backsideProgress);
      const effectiveSpeed = flightSpeed * routeSpeed * cinematicSpeedScale;
      autopilotPhase = wrap01(
        autopilotPhase
        + (deltaSeconds * effectiveSpeed) / LOOP_DURATION_SECONDS
      );
      sampleFlightPose(curve, portal, autopilotPhase, autopilotTarget);
      if (cinematicAttention > 0) {
        cinematicLookMatrix.lookAt(autopilotTarget.position, cinematicTarget, cinematicUp);
        cinematicQuaternion.setFromRotationMatrix(cinematicLookMatrix);
        autopilotTarget.quaternion.slerp(cinematicQuaternion, smootherStep(cinematicAttention));
      }
      camera.position.copy(autopilotTarget.position);
      if (cinematicAttention >= 0.999) {
        // The hidden lead-in turns the camera smoothly before the UFO appears.
        // Exact tracking then keeps the visible ship centered during departure.
        camera.quaternion.copy(autopilotTarget.quaternion);
      } else {
        const headingBlend = 1 - Math.exp(
          -DRONE_HEADING_RESPONSE * Math.max(1, effectiveSpeed) * deltaSeconds
        );
        camera.quaternion.slerp(autopilotTarget.quaternion, headingBlend).normalize();
      }
      camera.fov = autopilotTarget.fov;
      camera.updateProjectionMatrix();
      return;
    }

    if (mode === "manual") {
      updateManualMovement(now, deltaSeconds);
      const idleRemaining = IDLE_DURATION_MS - (now - lastInputAt);
      if (idleRemaining <= 0) {
        beginReturn(now);
      } else {
        const seconds = Math.max(1, Math.ceil(idleRemaining / 1000));
        setStatus(`Autopilot resumes in ${seconds}`);
      }
      return;
    }

    if (mode === "returning") {
      const progress = THREE.MathUtils.clamp((now - returnStartedAt) / RETURN_DURATION_MS, 0, 1);
      const eased = smootherStep(progress);
      camera.position.lerpVectors(returnFromPosition, returnTarget.position, eased);
      camera.quaternion.slerpQuaternions(returnFromQuaternion, returnTarget.quaternion, eased);
      camera.fov = THREE.MathUtils.lerp(returnFromFov, returnTarget.fov, eased);
      camera.updateProjectionMatrix();

      if (progress >= 1) {
        applyPose(camera, returnTarget);
        setMode(prefersReducedMotion ? "reduced" : "auto");
      }
    }
  }

  function updateManualMovement(now, deltaSeconds) {
    const forwardAmount = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
    const rightAmount = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    const upAmount = Number(keys.has("Space"));
    if (!forwardAmount && !rightAmount && !upAmount) return;

    lastInputAt = now;
    const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? BOOST_SPEED : WALK_SPEED;
    const distance = speed * Math.min(deltaSeconds, 0.05);

    direction.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    right.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    camera.position.addScaledVector(direction, forwardAmount * distance);
    camera.position.addScaledVector(right, rightAmount * distance);
    camera.position.addScaledVector(localUp, upAmount * distance);
    camera.position.clamp(minPosition, maxPosition);
  }

  function beginManual(now = performance.now()) {
    if (mode === "intro" || disposed) return false;
    if (mode !== "manual") setMode("manual");
    lastInputAt = now;
    return true;
  }

  function beginReturn(now) {
    if (controls.isLocked) controls.unlock();
    keys.clear();
    dragging = false;
    sampleFlightPose(curve, portal, autopilotPhase, returnTarget);

    if (prefersReducedMotion) {
      applyPose(camera, returnTarget);
      setMode("reduced");
      return;
    }

    returnStartedAt = now;
    returnFromPosition.copy(camera.position);
    returnFromQuaternion.copy(camera.quaternion);
    returnFromFov = camera.fov;
    setMode("returning");
  }

  function onPointerDown(event) {
    if (event.button !== 0 || !beginManual()) return;
    canvas.focus({ preventScroll: true });
    dragging = true;
    dragX = event.clientX;
    dragY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);

    if (event.pointerType === "mouse" && document.pointerLockElement !== canvas) {
      try {
        controls.lock();
      } catch {
        // Pointer dragging remains available when pointer lock is unavailable.
      }
    }
  }

  function onPointerMove(event) {
    if (!dragging || controls.isLocked || !beginManual()) return;
    const deltaX = event.clientX - dragX;
    const deltaY = event.clientY - dragY;
    dragX = event.clientX;
    dragY = event.clientY;

    dragEuler.setFromQuaternion(camera.quaternion);
    dragEuler.y -= deltaX * 0.003;
    dragEuler.x -= deltaY * 0.003;
    dragEuler.x = THREE.MathUtils.clamp(dragEuler.x, -Math.PI / 2 + 0.04, Math.PI / 2 - 0.04);
    camera.quaternion.setFromEuler(dragEuler);
  }

  function stopDragging(event) {
    dragging = false;
    if (event?.pointerId !== undefined && canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function onPointerLockStart() {
    dragging = false;
    beginManual();
  }

  function onPointerLockChange() {
    beginManual();
  }

  function onPointerLockEnd() {
    if (mode === "manual") lastInputAt = performance.now();
  }

  function onWheel(event) {
    if (!beginManual()) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    direction.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const distance = THREE.MathUtils.clamp(-event.deltaY * 0.008, -2.5, 2.5);
    camera.position.addScaledVector(direction, distance);
    camera.position.clamp(minPosition, maxPosition);
  }

  function onKeyDown(event) {
    const speedDirection = flightSpeedDirection(event);
    const sceneHasKeyboard = controls.isLocked || document.activeElement === canvas;
    if (speedDirection
      && sceneHasKeyboard
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && !isTypingTarget(event.target)) {
      event.preventDefault();
      if (!event.repeat) adjustFlightSpeed(speedDirection);
      return;
    }

    if (BOOST_KEYS.has(event.code) && sceneHasKeyboard) {
      keys.add(event.code);
      return;
    }

    if (!MOVEMENT_KEYS.has(event.code) || isTypingTarget(event.target)) return;
    if (!controls.isLocked && document.activeElement !== canvas) return;
    if (!beginManual()) return;
    event.preventDefault();
    keys.add(event.code);
  }

  function onKeyUp(event) {
    if (!MOVEMENT_KEYS.has(event.code) && !BOOST_KEYS.has(event.code)) return;
    keys.delete(event.code);
    if (mode === "manual") lastInputAt = performance.now();
  }

  function clearKeys() {
    keys.clear();
  }

  function setMode(nextMode) {
    mode = nextMode;
    root.dataset.flightMode = mode;

    if (mode === "intro") {
      setModeLabel("3D");
      setStatus("Building the glass logo…");
    } else if (mode === "auto") {
      setAutoHud();
    } else if (mode === "manual") {
      setModeLabel("MANUAL");
      setStatus("Autopilot resumes in 5");
    } else if (mode === "returning") {
      setModeLabel("REJOIN");
      setStatus("Smoothly rejoining the saved flight path…");
    } else {
      setModeLabel("STILL");
      setStatus("Reduced motion • click the scene to explore");
    }
  }

  function adjustFlightSpeed(direction) {
    flightSpeed = THREE.MathUtils.clamp(
      Math.round((flightSpeed + direction * FLIGHT_SPEED_STEP) * 4) / 4,
      MIN_FLIGHT_SPEED,
      MAX_FLIGHT_SPEED
    );

    if (mode === "auto") {
      setAutoHud();
    } else {
      setStatus(`Autopilot speed set to ${formatFlightSpeed()}x`);
    }
  }

  function setAutoHud() {
    if (cinematicHudActive) {
      setCinematicHud();
      return;
    }

    const speed = formatFlightSpeed();
    setModeLabel(`AUTO ${speed}x`);
    setStatus(`Autopilot • ${speed}x speed • click the scene to explore`);
  }

  function setCinematicHud() {
    const speed = formatFlightSpeed();
    setModeLabel("UFO TRACK");
    setStatus(`UFO encounter • ${speed}x speed • autopilot tracking target`);
  }

  function formatFlightSpeed() {
    return Number.isInteger(flightSpeed) ? String(flightSpeed) : String(flightSpeed).replace(/0+$/, "");
  }

  function setReducedMotion(value) {
    prefersReducedMotion = Boolean(value);
    if (mode === "intro" || mode === "manual") return;

    if (prefersReducedMotion) {
      if (controls.isLocked) controls.unlock();
      sampleFlightPose(curve, portal, autopilotPhase, pose);
      applyPose(camera, pose);
      setMode("reduced");
    } else if (mode === "reduced") {
      setMode("auto");
    }
  }

  function setCinematicFocus(target, attention, speedScale) {
    cinematicAttention = THREE.MathUtils.clamp(Number(attention || 0), 0, 1);
    cinematicSpeedScale = THREE.MathUtils.clamp(Number(speedScale || 1), 0.1, 1);
    if (target) cinematicTarget.copy(target);

    const shouldTrack = cinematicAttention >= 0.12;
    if (mode === "auto" && shouldTrack && !cinematicHudActive) {
      cinematicHudActive = true;
      setCinematicHud();
    } else if (mode === "auto" && !shouldTrack && cinematicHudActive) {
      cinematicHudActive = false;
      setAutoHud();
    } else if (mode !== "auto" || !shouldTrack) {
      cinematicHudActive = false;
    }
  }

  function setStatus(text) {
    if (statusElement.textContent !== text) statusElement.textContent = text;
  }

  function setModeLabel(text) {
    if (modeElement.textContent !== text) modeElement.textContent = text;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    keys.clear();
    controls.removeEventListener("change", onPointerLockChange);
    controls.removeEventListener("lock", onPointerLockStart);
    controls.removeEventListener("unlock", onPointerLockEnd);
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    controls.dispose();
  }

  return {
    startAutopilot,
    update,
    setReducedMotion,
    setCinematicFocus,
    dispose
  };
}

function createFlightCurve(portal) {
  const point = (x, y, z) => new THREE.Vector3(x, y, z);
  const { x, y } = portal;
  return new THREE.CatmullRomCurve3([
    point(0, 1.5, 13.5),
    point(-4.8, 2.7, 12),
    point(-8.5, 3.2, 6.5),
    point(-10, 1, 0),
    point(-8.5, -2.8, -6.5),
    point(-3, -1.5, -11),
    point(4.5, 2.8, -10.5),
    point(8.5, 3.5, -5.5),
    point(10, 0, 3),
    point(7.5, -2.6, 8.5),
    point(4, 0, 9.5),
    point(x, y, 8),
    point(x, y, 5),
    point(x, y, 1.4),
    point(x, y, -1.4),
    point(x, y, -5),
    point(x, y, -8),
    point(-3, 2, -9.5),
    point(-8.5, 3, -5.5),
    point(-10, -1, 3),
    point(-6, -2.5, 10)
  ], true, "centripetal", 0.5);
}

function sampleFlightPose(curve, portal, phase, pose) {
  // A drone-style camera stays level and travels at a steady arc-length speed.
  curve.getPointAt(phase, pose.position);
  curve.getTangentAt(phase, pose.tangent).normalize();
  curve.getPointAt(wrap01(phase + 0.012), pose.ahead);

  pose.focus.set(0, 0, 0);
  pose.flightTarget.copy(pose.ahead).addScaledVector(pose.tangent, 3);
  const portalDistance = Math.hypot(pose.position.x - portal.x, pose.position.y - portal.y);
  const tunnelWeight = (1 - smoothStepRange(1.5, 6.5, portalDistance))
    * (1 - smoothStepRange(7, 15, Math.abs(pose.position.z)));
  pose.lookTarget.lerpVectors(pose.focus, pose.flightTarget, tunnelWeight);

  pose.lookMatrix.lookAt(pose.position, pose.lookTarget, pose.up);
  pose.quaternion.setFromRotationMatrix(pose.lookMatrix);
  pose.fov = 42;
}

function createPose() {
  return {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    tangent: new THREE.Vector3(),
    ahead: new THREE.Vector3(),
    focus: new THREE.Vector3(),
    flightTarget: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    lookMatrix: new THREE.Matrix4(),
    up: new THREE.Vector3(0, 1, 0),
    fov: 42
  };
}

function applyPose(camera, pose) {
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.fov = pose.fov;
  camera.updateProjectionMatrix();
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function smoothStepRange(edge0, edge1, value) {
  const progress = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function smootherStep(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function isTypingTarget(target) {
  return target instanceof Element
    && (
      target.matches("input, select, textarea, button, a[href]")
      || target.closest("[contenteditable='true'], [role='button'], [role='menuitem']")
    );
}

function flightSpeedDirection(event) {
  if (event.key === "+" || event.code === "Equal" || event.code === "NumpadAdd") return 1;
  if (event.key === "-" || event.code === "Minus" || event.code === "NumpadSubtract") return -1;
  return 0;
}
