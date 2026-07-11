import * as THREE from "../../vendor/three/three.module.min.js";
import { PointerLockControls } from "../../vendor/three/addons/controls/PointerLockControls.js?v=0.185.1-pmt1";

const LOOP_DURATION_SECONDS = 82;
const DRONE_POSITION_RESPONSE = 7;
const DRONE_HEADING_RESPONSE = 0.7;
const DRONE_FOV_RESPONSE = 0.9;
const EVENT_HEADING_RESPONSE = 8;
const EVENT_FOV_RESPONSE = 6;
const IDLE_DURATION_MS = 5000;
const RETURN_DURATION_MS = 3250;
const WALK_SPEED = 6;
const BOOST_SPEED = 13;
const CAMERA_FAR_LIMIT = 80;
const MIN_FLIGHT_SPEED = 0.25;
const MAX_FLIGHT_SPEED = 3;
const FLIGHT_SPEED_STEP = 0.25;
const BACKSIDE_SPEED_BOOST = 2;
const GALLERY_SLOWDOWN_SECONDS = 2;
const GALLERY_MIN_SPEED_SCALE = 0.62;
const GALLERY_CRUISE_SPEED_SCALE = 1.08;
const CHART_GALLERY_FOV = 56;
const TEAM_GALLERY_FOV = 48;
const CINEMATIC_HORIZONTAL_STAGE_END = 0.62;
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
  billboardTarget = null,
  billboardTargets = [],
  secondaryTarget = null,
  secondaryTargets = [],
  teamTarget = null,
  sceneFocus = null,
  minimumCameraY = -CAMERA_FAR_LIMIT,
  statusElement,
  modeElement,
  reducedMotion
}) {
  const abortController = new AbortController();
  const controls = new PointerLockControls(camera, canvas);
  const focusPoint = sceneFocus?.clone?.() || new THREE.Vector3();
  const curve = createFlightCurve(portal, focusPoint.y, minimumCameraY);
  const availableBillboardTargets = billboardTargets.length
    ? billboardTargets
    : billboardTarget
      ? [billboardTarget]
      : [];
  const availableSecondaryTargets = secondaryTargets.length
    ? secondaryTargets
    : secondaryTarget
      ? [secondaryTarget]
      : [];
  const keys = new Set();
  const pose = createPose();
  const autopilotTarget = createPose();
  const returnTarget = createPose();
  const returnFromPosition = new THREE.Vector3();
  const returnFromQuaternion = new THREE.Quaternion();
  const cinematicTarget = new THREE.Vector3();
  const cinematicHorizontalTarget = new THREE.Vector3();
  const cinematicQuaternion = new THREE.Quaternion();
  const cinematicHorizontalQuaternion = new THREE.Quaternion();
  const cinematicLookMatrix = new THREE.Matrix4();
  const cinematicUp = new THREE.Vector3(0, 1, 0);
  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();
  const localUp = new THREE.Vector3(0, 1, 0);
  const dragEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const minPosition = new THREE.Vector3(-CAMERA_FAR_LIMIT, minimumCameraY, -CAMERA_FAR_LIMIT);
  const maxPosition = new THREE.Vector3(CAMERA_FAR_LIMIT, CAMERA_FAR_LIMIT, CAMERA_FAR_LIMIT);

  let prefersReducedMotion = reducedMotion;
  let mode = "intro";
  let autopilotPhase = 0;
  let flightSpeed = 1;
  let cinematicAttention = 0;
  let cinematicSpeedScale = 1;
  let cinematicHudActive = false;
  let billboardTargetIndex = randomTargetIndex(availableBillboardTargets.length);
  let secondaryTargetIndex = randomTargetIndex(availableSecondaryTargets.length);
  let activeBillboardTarget = availableBillboardTargets[billboardTargetIndex] || null;
  let activeSecondaryTarget = availableSecondaryTargets[secondaryTargetIndex] || null;
  let flightVariationSeconds = 0;
  let flightHeightOffset = 0;
  const heightVariationPhaseA = Math.random() * Math.PI * 2;
  const heightVariationPhaseB = Math.random() * Math.PI * 2;
  const heightVariationAmplitudeA = 0.55 + Math.random() * 0.25;
  const heightVariationAmplitudeB = 0.25 + Math.random() * 0.2;
  let gallerySlowElapsed = 0;
  let lastInputAt = performance.now();
  let returnStartedAt = 0;
  let returnFromFov = camera.fov;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let disposed = false;

  controls.pointerSpeed = 0.72;
  sampleFlightPose(curve, portal, activeBillboardTarget, activeSecondaryTarget, teamTarget, focusPoint, minimumCameraY, flightHeightOffset, autopilotPhase, pose);
  applyPose(camera, pose);
  setMode(mode);
  root.dataset.aboutFlightPath = "rounded-rectangle-around-logo";
  root.dataset.aboutCameraMotion = "drone-cinema";
  root.dataset.aboutCameraPositionResponse = String(DRONE_POSITION_RESPONSE);
  root.dataset.aboutCameraHeadingResponse = String(DRONE_HEADING_RESPONSE);
  root.dataset.aboutCameraEventHeadingResponse = String(EVENT_HEADING_RESPONSE);
  root.dataset.aboutCameraFocusTransition = "slow-cinematic";
  root.dataset.aboutFlightHeightProfile = "variable-cinematic";
  root.dataset.aboutPortalFlythrough = "true";
  root.dataset.aboutCinematicPanOrder = "horizontal-then-vertical";
  root.dataset.aboutFlightHeightVariation = "continuous-randomized";
  root.dataset.aboutChartInspectionMode = "random-per-loop";
  root.dataset.aboutDevInspectionTargetCount = String(availableBillboardTargets.length);
  root.dataset.aboutBugInspectionTargetCount = String(availableSecondaryTargets.length);
  setInspectionTargetDatasets();
  root.dataset.aboutGallerySlowdownMaxSeconds = String(GALLERY_SLOWDOWN_SECONDS);
  root.dataset.aboutGalleryCruiseSpeedScale = String(GALLERY_CRUISE_SPEED_SCALE);
  root.dataset.aboutChartGalleryFov = String(CHART_GALLERY_FOV);

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
      const devApproach = smoothStepRange(8, 12, -camera.position.z)
        * (1 - smoothStepRange(5, 11, Math.abs(camera.position.x)));
      const chartApproach = smoothStepRange(7, 10, camera.position.x)
        * (1 - smoothStepRange(5, 12, Math.abs(camera.position.z + 8)));
      const teamApproach = smoothStepRange(9, 14, -camera.position.x)
        * (1 - smoothStepRange(3.5, 8, Math.abs(camera.position.z - 4.5)));
      const galleryApproach = Math.max(devApproach, chartApproach, teamApproach);
      if (galleryApproach >= 0.08) {
        gallerySlowElapsed += deltaSeconds;
      } else {
        gallerySlowElapsed = 0;
      }
      const slowdownRemaining = 1 - smootherStep(
        THREE.MathUtils.clamp(gallerySlowElapsed / GALLERY_SLOWDOWN_SECONDS, 0, 1)
      );
      const gallerySlowWeight = smootherStep(galleryApproach) * slowdownRemaining;
      const chartSpeedScale = THREE.MathUtils.lerp(
        GALLERY_CRUISE_SPEED_SCALE,
        GALLERY_MIN_SPEED_SCALE,
        gallerySlowWeight
      );
      root.dataset.aboutGallerySpeedScale = chartSpeedScale.toFixed(3);
      root.dataset.aboutGallerySlowSeconds = gallerySlowElapsed.toFixed(2);
      const effectiveSpeed = flightSpeed * routeSpeed * chartSpeedScale * cinematicSpeedScale;
      flightVariationSeconds += deltaSeconds * effectiveSpeed;
      const heightVariationRamp = smootherStep(THREE.MathUtils.clamp(
        flightVariationSeconds / 4,
        0,
        1
      ));
      flightHeightOffset = (Math.sin(flightVariationSeconds * 0.21 + heightVariationPhaseA)
          * heightVariationAmplitudeA
        + Math.sin(flightVariationSeconds * 0.37 + heightVariationPhaseB)
          * heightVariationAmplitudeB) * heightVariationRamp;
      root.dataset.aboutFlightHeightOffset = flightHeightOffset.toFixed(3);
      const previousPhase = autopilotPhase;
      autopilotPhase = wrap01(previousPhase + (deltaSeconds * effectiveSpeed) / LOOP_DURATION_SECONDS);
      if (autopilotPhase < previousPhase) chooseNextInspectionTargets();
      sampleFlightPose(curve, portal, activeBillboardTarget, activeSecondaryTarget, teamTarget, focusPoint, minimumCameraY, flightHeightOffset, autopilotPhase, autopilotTarget);
      root.dataset.aboutChartDetour = String(autopilotTarget.chartAttention >= 0.1);
      root.dataset.aboutChartDetourAttention = autopilotTarget.chartAttention.toFixed(3);
      root.dataset.aboutDevDetour = String(autopilotTarget.devAttention >= 0.1);
      root.dataset.aboutDevDetourAttention = autopilotTarget.devAttention.toFixed(3);
      root.dataset.aboutPortalFlythroughAttention = autopilotTarget.portalAttention.toFixed(3);
      root.dataset.aboutTeamDetour = String(autopilotTarget.teamAttention >= 0.1);
      root.dataset.aboutTeamDetourAttention = autopilotTarget.teamAttention.toFixed(3);
      if (cinematicAttention > 0) {
        cinematicHorizontalTarget.set(
          cinematicTarget.x,
          autopilotTarget.position.y,
          cinematicTarget.z
        );
        cinematicLookMatrix.lookAt(
          autopilotTarget.position,
          cinematicHorizontalTarget,
          cinematicUp
        );
        cinematicHorizontalQuaternion.setFromRotationMatrix(cinematicLookMatrix);
        cinematicLookMatrix.lookAt(autopilotTarget.position, cinematicTarget, cinematicUp);
        cinematicQuaternion.setFromRotationMatrix(cinematicLookMatrix);
        const horizontalProgress = smootherStep(THREE.MathUtils.clamp(
          cinematicAttention / CINEMATIC_HORIZONTAL_STAGE_END,
          0,
          1
        ));
        const verticalProgress = smootherStep(THREE.MathUtils.clamp(
          (cinematicAttention - CINEMATIC_HORIZONTAL_STAGE_END)
            / (1 - CINEMATIC_HORIZONTAL_STAGE_END),
          0,
          1
        ));
        autopilotTarget.quaternion.slerp(cinematicHorizontalQuaternion, horizontalProgress);
        autopilotTarget.quaternion.slerp(cinematicQuaternion, verticalProgress);
      }
      const positionBlend = 1 - Math.exp(-DRONE_POSITION_RESPONSE * deltaSeconds);
      camera.position.lerp(autopilotTarget.position, positionBlend);
      if (cinematicAttention >= 0.999) {
        // The hidden lead-in turns the camera smoothly before the UFO appears.
        // Exact tracking then keeps the visible ship centered during departure.
        camera.quaternion.copy(autopilotTarget.quaternion);
      } else {
        const headingResponse = cinematicAttention > 0.04
          ? EVENT_HEADING_RESPONSE
          : DRONE_HEADING_RESPONSE;
        const headingBlend = 1 - Math.exp(
          -headingResponse * deltaSeconds
        );
        camera.quaternion.slerp(autopilotTarget.quaternion, headingBlend).normalize();
      }
      const fovResponse = cinematicAttention > 0.04
        ? EVENT_FOV_RESPONSE
        : DRONE_FOV_RESPONSE;
      const fovBlend = 1 - Math.exp(-fovResponse * deltaSeconds);
      camera.fov = THREE.MathUtils.lerp(camera.fov, autopilotTarget.fov, fovBlend);
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
    sampleFlightPose(curve, portal, activeBillboardTarget, activeSecondaryTarget, teamTarget, focusPoint, minimumCameraY, flightHeightOffset, autopilotPhase, returnTarget);

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
      sampleFlightPose(curve, portal, activeBillboardTarget, activeSecondaryTarget, teamTarget, focusPoint, minimumCameraY, flightHeightOffset, autopilotPhase, pose);
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

  function chooseNextInspectionTargets() {
    billboardTargetIndex = nextRandomTargetIndex(
      billboardTargetIndex,
      availableBillboardTargets.length
    );
    secondaryTargetIndex = nextRandomTargetIndex(
      secondaryTargetIndex,
      availableSecondaryTargets.length
    );
    activeBillboardTarget = availableBillboardTargets[billboardTargetIndex] || null;
    activeSecondaryTarget = availableSecondaryTargets[secondaryTargetIndex] || null;
    setInspectionTargetDatasets();
  }

  function setInspectionTargetDatasets() {
    root.dataset.aboutDevInspectionTargetIndex = String(billboardTargetIndex);
    root.dataset.aboutBugInspectionTargetIndex = String(secondaryTargetIndex);
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

function createFlightCurve(portal, sceneCenterY = 0, minimumCameraY = -CAMERA_FAR_LIMIT) {
  const point = (x, y, z) => new THREE.Vector3(x, Math.max(y + sceneCenterY, minimumCameraY), z);
  const portalPoint = z => new THREE.Vector3(portal.x, Math.max(portal.y, minimumCameraY), z);
  return new THREE.CatmullRomCurve3([
    point(0, 2.2, 16.5),
    point(-6, 2.8, 16.2),
    point(-11, 3.5, 13.5),
    point(-13, 4.2, 9),
    point(-13.5, 4.8, 2),
    point(-13.5, 5.2, -6),
    point(-11.5, 5.7, -12),
    point(-7, 6, -14.2),
    point(0, 6.2, -14.5),
    point(7, 5.9, -14.2),
    point(11.5, 5.4, -12),
    point(13.5, 4.8, -6),
    point(13.5, 4.2, 2),
    point(13, 3.7, 9),
    point(11, 3.2, 13.5),
    point(6, 2.7, 16.2),
    portalPoint(12),
    portalPoint(8),
    portalPoint(4),
    portalPoint(1.5),
    portalPoint(-1.5),
    portalPoint(-5),
    portalPoint(-9),
    portalPoint(-12),
    point(-4, 5.8, -14),
    point(-9, 5.2, -11),
    point(-13, 4.5, -5),
    point(-13, 3.7, 4),
    point(-10, 3.2, 11),
    point(-5, 2.7, 15.5)
  ], true, "centripetal", 0.5);
}

function sampleFlightPose(curve, portal, billboardTarget, secondaryTarget, teamTarget, sceneFocus, minimumCameraY, heightOffset, phase, pose) {
  // A drone-style camera stays level and travels at a steady arc-length speed.
  curve.getPointAt(phase, pose.position);
  pose.position.y = Math.max(pose.position.y + heightOffset, minimumCameraY);
  curve.getTangentAt(phase, pose.tangent).normalize();
  curve.getPointAt(wrap01(phase + 0.012), pose.ahead);
  pose.ahead.y = Math.max(pose.ahead.y + heightOffset, minimumCameraY);

  pose.focus.copy(sceneFocus);
  pose.flightTarget.copy(pose.ahead).addScaledVector(pose.tangent, 3);
  const portalDistance = Math.hypot(pose.position.x - portal.x, pose.position.y - portal.y);
  const tunnelWeight = (1 - smoothStepRange(1.5, 6.5, portalDistance))
    * (1 - smoothStepRange(7, 15, Math.abs(pose.position.z)));
  pose.portalAttention = tunnelWeight;
  pose.lookTarget.lerpVectors(pose.focus, pose.flightTarget, tunnelWeight);
  if (billboardTarget) {
    const billboardRevealWeight = tunnelWeight
      * (1 - smoothStepRange(5, 9, pose.position.z));
    pose.lookTarget.lerp(billboardTarget, smootherStep(billboardRevealWeight));
    pose.devAttention = smoothStepRange(8, 12, -pose.position.z)
      * (1 - smoothStepRange(5, 11, Math.abs(pose.position.x)));
    pose.lookTarget.lerp(billboardTarget, smootherStep(pose.devAttention) * 0.96);
  } else {
    pose.devAttention = 0;
  }
  pose.chartAttention = 0;
  if (secondaryTarget) {
    pose.chartAttention = smoothStepRange(7, 10, pose.position.x)
      * (1 - smoothStepRange(5, 12, Math.abs(pose.position.z + 8)));
    pose.lookTarget.lerp(secondaryTarget, smootherStep(pose.chartAttention) * 0.96);
  }
  pose.teamAttention = 0;
  if (teamTarget) {
    pose.teamAttention = smoothStepRange(9, 14, -pose.position.x)
      * (1 - smoothStepRange(3.5, 8, Math.abs(pose.position.z - 4.5)));
    pose.lookTarget.lerp(teamTarget, smootherStep(pose.teamAttention) * 0.96);
  }

  pose.lookMatrix.lookAt(pose.position, pose.lookTarget, pose.up);
  pose.quaternion.setFromRotationMatrix(pose.lookMatrix);
  const chartAttention = Math.max(pose.devAttention, pose.chartAttention);
  const chartFov = THREE.MathUtils.lerp(42, CHART_GALLERY_FOV, smootherStep(chartAttention));
  pose.fov = THREE.MathUtils.lerp(chartFov, TEAM_GALLERY_FOV, smootherStep(pose.teamAttention));
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
    devAttention: 0,
    portalAttention: 0,
    chartAttention: 0,
    teamAttention: 0,
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

function randomTargetIndex(length) {
  return length > 0 ? Math.floor(Math.random() * length) : -1;
}

function nextRandomTargetIndex(currentIndex, length) {
  if (length <= 1) return length ? 0 : -1;
  return (currentIndex + 1 + Math.floor(Math.random() * (length - 1))) % length;
}
