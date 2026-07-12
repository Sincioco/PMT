import * as THREE from "../../vendor/three/three.module.min.js";

const FLIGHT_DURATION_SECONDS = 26;
const BUG_FLIGHT_DURATION_SECONDS = 19;
const SEQUENCE_4_DURATION_SECONDS = 38;
const WIDE_CHART_TRAVERSAL_SPEED = 5;
const DEV_SEQUENCE_HANDOFF_PHASE = 0.992;
const DEV_TO_BUG_BLEND_START_PHASE = 0.94;
const DEV_TO_BUG_ENTRY_PHASE = 0.1;
const BUG_SEQUENCE_HANDOFF_PHASE = 0.992;
const BUG_TO_RETURN_BLEND_START_PHASE = 0.94;
const BUG_TO_RETURN_ENTRY_PHASE = 0.03;
const WIDE_CHART_START_OFFSET_RATIO = -0.3;
const WIDE_CHART_TRAVERSAL_SPAN_RATIO = 0.64;
const WIDE_CHART_END_OFFSET_RATIO = 0.34;
const DRONE_POSITION_RESPONSE = 6;
const DRONE_HEADING_RESPONSE = 1.15;
const DRONE_FOV_RESPONSE = 1.4;
const EVENT_HEADING_RESPONSE = 7;
const IDLE_DURATION_MS = 5000;
const RETURN_DURATION_MS = 3250;
const CONTROL_HINT_DURATION_MS = 5000;
const WALK_SPEED = 6;
const BOOST_SPEED = 13;
const CAMERA_FAR_LIMIT = 80;
const MIN_FLIGHT_SPEED = 0.25;
const MAX_FLIGHT_SPEED = 3;
const FLIGHT_SPEED_STEP = 0.25;
const MIN_FORWARD_LOOK_DOT = Math.cos(THREE.MathUtils.degToRad(70));
const DEV_LANDING_DISTANCE = 9.2;
const DEV_LANDING_PANEL_WIDTH = 15.2;
const DEV_LANDING_PANEL_HEIGHT = 7.2;
const DEV_LANDING_FRAME_MARGIN = 1.08;
const WIDE_CHART_THRESHOLD = DEV_LANDING_PANEL_WIDTH * 1.08;
const WIDE_CHART_FOV = 48;
const WIDE_CHART_TRAVERSAL_FOV = 56;
const DEFAULT_FOV = 42;
const INSPECTION_FOV = 52;
const PORTAL_FOV = 40;
const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"]);
const BOOST_KEYS = new Set(["ShiftLeft", "ShiftRight"]);
const MIN_USER_FOV = 24;
const MAX_USER_FOV = 76;

export function createAboutFlightController({
  camera,
  canvas,
  root,
  portal = null,
  billboardTarget = null,
  billboardTargets = [],
  devDestinationLabels = [],
  devDestinationWidths = [],
  secondaryTarget = null,
  secondaryTargets = [],
  bugDestinationLabels = [],
  bugDestinationWidths = [],
  galleryRoomBackZ = -23,
  sceneFocus = null,
  minimumCameraY = -CAMERA_FAR_LIMIT,
  statusElement,
  modeElement,
  controlHintsTriggerElement,
  debugElement,
  reducedMotion
}) {
  const abortController = new AbortController();
  const focusPoint = sceneFocus?.clone?.() || new THREE.Vector3();
  const devDestinations = normalizeTargets(billboardTargets, billboardTarget);
  const bugDestinations = normalizeTargets(secondaryTargets, secondaryTarget);
  const route = createFlightRouteState({
    sceneFocus: focusPoint,
    portal,
    devDestinations,
    devDestinationLabels,
    devDestinationWidths,
    bugDestinations,
    bugDestinationLabels,
    bugDestinationWidths,
    galleryRoomBackZ,
    minimumCameraY
  });
  const keys = new Set();
  const pose = createPose();
  const autopilotTarget = createPose();
  const handoffTarget = createPose();
  const returnHandoffTarget = createPose();
  const returnTarget = createPose();
  const returnFromPosition = new THREE.Vector3();
  const returnFromQuaternion = new THREE.Quaternion();
  const eventTarget = new THREE.Vector3();
  const eventQuaternion = new THREE.Quaternion();
  const eventLookMatrix = new THREE.Matrix4();
  const eventUp = new THREE.Vector3(0, 1, 0);
  const wideStartPosition = new THREE.Vector3();
  const wideStartQuaternion = new THREE.Quaternion();
  const wideEndQuaternion = new THREE.Quaternion();
  const wideLookMatrix = new THREE.Matrix4();
  const direction = new THREE.Vector3();
  const right = new THREE.Vector3();
  const localUp = new THREE.Vector3(0, 1, 0);
  const dragEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const minPosition = new THREE.Vector3(-CAMERA_FAR_LIMIT, minimumCameraY, -CAMERA_FAR_LIMIT);
  const maxPosition = new THREE.Vector3(CAMERA_FAR_LIMIT, CAMERA_FAR_LIMIT, CAMERA_FAR_LIMIT);

  let prefersReducedMotion = reducedMotion;
  let mode = "intro";
  let autopilotPhase = 0;
  let flightSpeed = 2;
  let forwardTravel = 0;
  let cinematicAttention = 0;
  let flightStage = "dev";
  let stageStartedAt = 0;
  let activeWideTraversal = null;
  let sequence4Geometry = createPlannedSequence4Geometry();
  let debugTestRun = 1;
  let controllerNow = performance.now();
  let lastInputAt = performance.now();
  let automaticFlightSuspendedAt = null;
  let returnStartedAt = 0;
  let returnFromFov = camera.fov;
  let pausedFromMode = "auto";
  let controlHintsTimer = 0;
  let userFovOffset = 0;
  let dragging = false;
  let dragX = 0;
  let dragY = 0;
  let disposed = false;

  sampleFlightPose(
    route,
    autopilotPhase,
    pose
  );
  applyPose(camera, pose);
  setMode(mode);
  root.dataset.aboutInitialCamera = "2d-logo-facing";
  root.dataset.aboutFlightPath = "initial-logo-p-hole-dev-bug-return-initial";
  root.dataset.aboutFlightDirection = "forward-through-approved-sequences";
  root.dataset.aboutFlightProfile = "approved-sequences-1-through-4";
  root.dataset.aboutChartInspection = "random-dev-then-random-bug";
  root.dataset.aboutPmtPortalFlyby = "once-per-sequence-cycle";
  root.dataset.aboutMinimumForwardLookDot = MIN_FORWARD_LOOK_DOT.toFixed(3);
  root.dataset.aboutEventExecution = "sequence-4-ufo-background";
  root.dataset.aboutLevelHorizonFallback = "true";
  root.dataset.aboutPostPortalTargeting = "continuous-dev-target";
  root.dataset.aboutPostPortalTransition = "horizontal-bearing-then-chart-elevation";
  root.dataset.aboutCircularFlightPath = "removed";
  root.dataset.aboutUnapprovedFlightLogic = "disabled";
  root.dataset.aboutDevSelectionMode = "random";
  root.dataset.aboutBugSelectionMode = "random";
  root.dataset.aboutAutomaticSequenceReset = "true";
  root.dataset.aboutDevLandingApproachSpeed = "progressive-slowdown";
  root.dataset.aboutDevArrivalBehavior = "slow-continuous-no-stop";
  root.dataset.aboutApprovedFlybySequences = "1,2,3,4";
  root.dataset.aboutFlightTestMode = "approved-sequences-1-through-4";
  root.dataset.aboutFlightTiming = "continuous-no-pause-no-hold";
  root.dataset.aboutDefaultFlightSpeed = "2";
  root.dataset.aboutFlightSpeed = formatFlightSpeed();
  root.dataset.aboutFlightSpeedPolicy = "user-controlled-constant";
  root.dataset.aboutAutomaticSpeedChanges = "disabled";
  root.dataset.aboutDevLandingResetKey = "Automatic";
  root.dataset.aboutDevLandingTestRun = String(debugTestRun);
  root.dataset.aboutDevLandingTestState = "approaching-dev";
  root.dataset.aboutDevLandingFraming = "natural-flyby";
  root.dataset.aboutBugLandingFraming = "upper-left-for-wide-charts";
  root.dataset.aboutDevToBugTransition = "precomputed-overlap-curve";
  root.dataset.aboutDevToBugHandoffPrepared = String(Boolean(route.bugDestination));
  root.dataset.aboutDevToBugHandoffProgress = "0";
  root.dataset.aboutSequenceTransitionPose = "continuous-preblended-curve";
  root.dataset.aboutBugToReturnTransition = "precomputed-overlap-curve";
  root.dataset.aboutBugToReturnHandoffPrepared = "true";
  root.dataset.aboutBugToReturnHandoffProgress = "0";
  root.dataset.aboutWideChartTraversal = "generalized-by-chart-width-and-wall";
  root.dataset.aboutWideChartThreshold = String(WIDE_CHART_THRESHOLD);
  root.dataset.aboutWideChartTraversalSpeed = String(WIDE_CHART_TRAVERSAL_SPEED);
  root.dataset.aboutWideChartLanding = "upper-left";
  root.dataset.aboutWideChartTraversalActive = "false";
  root.dataset.aboutWideChartTraversalProgress = "0";
  root.dataset.aboutWideChartCameraBias = "original-diagonal-chart-view";
  root.dataset.aboutWideChartSpeedProfile = "constant";
  root.dataset.aboutWideChartTraversalConstraint = "distance-based";
  root.dataset.aboutWideChartTraversalSpanRatio = String(WIDE_CHART_TRAVERSAL_SPAN_RATIO);
  root.dataset.aboutWideChartTraversalStartOffsetRatio = String(WIDE_CHART_START_OFFSET_RATIO);
  root.dataset.aboutWideChartTraversalEndOffsetRatio = String(WIDE_CHART_END_OFFSET_RATIO);
  root.dataset.aboutWideChartTraversalRatioVerified = String(
    Math.abs(
      WIDE_CHART_END_OFFSET_RATIO
        - WIDE_CHART_START_OFFSET_RATIO
        - WIDE_CHART_TRAVERSAL_SPAN_RATIO
    ) < 0.000001
  );
  root.dataset.aboutWideChartTraversalFov = String(WIDE_CHART_TRAVERSAL_FOV);
  root.dataset.aboutWideChartTraversalZoom = "slight-zoom-out";
  root.dataset.aboutWideChartExit = "visible-far-edge";
  root.dataset.aboutSequence4 = "qa-chart-to-initial-view";
  root.dataset.aboutSequence4Focus = "pmt-logo";
  root.dataset.aboutSequence4DurationSeconds = String(SEQUENCE_4_DURATION_SECONDS);
  root.dataset.aboutBugLandingDistance = String(DEV_LANDING_DISTANCE);
  root.dataset.aboutFlightSequenceStage = flightStage;
  root.dataset.aboutMouseControl = "hold-left-button-autopilot-continues";
  root.dataset.aboutMouseLookActive = "false";
  root.dataset.aboutMousePointerLock = "disabled";
  root.dataset.aboutWheelControl = "zoom-without-manual-takeover";
  root.dataset.aboutKeyboardManualKeys = "W,A,S,D,Q,E";
  root.dataset.aboutAKeyBehavior = "alien-event-without-autopilot-takeover;strafe-left-only-when-manual";
  root.dataset.aboutKeyboardManualIdleSeconds = String(IDLE_DURATION_MS / 1000);
  root.dataset.aboutSpeedKeysStayAutomatic = "true";
  root.dataset.aboutPauseKey = "Space";
  root.dataset.aboutRestartKey = "Enter";
  root.dataset.aboutEnterRestartBehavior = "reset-sequence-1-in-scene";
  root.dataset.aboutControlHintsKey = "?";
  root.dataset.aboutControlHintsDurationSeconds = String(CONTROL_HINT_DURATION_MS / 1000);
  root.dataset.aboutControlHintsLayout = "compact-upper-left-list";
  root.dataset.aboutControlHintsAutomatic = "true";
  root.dataset.aboutControlHintsVisible = "false";
  root.dataset.aboutControlHintsTrigger = "click-question-mark";
  root.dataset.aboutControlHintsTriggerPosition = "lower-left";
  root.dataset.aboutInitialControlHintsAfterSequence4 = "false";
  root.dataset.aboutInitialControlHintsShown = "false";
  root.dataset.aboutManualModePanelAction = "resume-autopilot";
  updateRouteDatasets();

  const listenerOptions = { signal: abortController.signal };
  canvas.addEventListener("pointerdown", onPointerDown, listenerOptions);
  canvas.addEventListener("pointermove", onPointerMove, listenerOptions);
  canvas.addEventListener("pointerup", stopDragging, listenerOptions);
  canvas.addEventListener("pointercancel", stopDragging, listenerOptions);
  canvas.addEventListener("wheel", onWheel, { passive: false, signal: abortController.signal });
  modeElement.addEventListener("click", onModeClick, listenerOptions);
  controlHintsTriggerElement?.addEventListener("click", toggleControlHints, listenerOptions);
  window.addEventListener("keydown", onKeyDown, listenerOptions);
  window.addEventListener("keyup", onKeyUp, listenerOptions);
  window.addEventListener("blur", clearKeys, listenerOptions);

  function startAutopilot() {
    if (disposed) return;
    setMode(prefersReducedMotion ? "reduced" : "auto");
  }

  function update(now, deltaSeconds) {
    if (disposed) return;
    controllerNow = now;

    if (mode === "auto") {
      if (flightStage === "wide-flythrough") {
        updateWideChartFlythrough(now);
        return;
      }
      const isBugStage = flightStage === "bug";
      const isSequence4Stage = flightStage === "return-initial";
      // The user-selected multiplier is the sole speed authority. Routes and
      // background events may shape the camera, but cannot change its clock.
      const effectiveSpeed = flightSpeed;
      root.dataset.aboutEffectiveFlightSpeed = formatFlightSpeed();
      autopilotPhase = Math.min(
        1,
        autopilotPhase + (deltaSeconds * effectiveSpeed) / (
          isBugStage
            ? BUG_FLIGHT_DURATION_SECONDS
            : isSequence4Stage
              ? SEQUENCE_4_DURATION_SECONDS
              : FLIGHT_DURATION_SECONDS
        )
      );
      forwardTravel += deltaSeconds * effectiveSpeed;
      if (isBugStage) sampleBugFlightPose(route, autopilotPhase, autopilotTarget, camera.aspect);
      else if (isSequence4Stage) sampleSequence4Pose(sequence4Geometry, autopilotPhase, autopilotTarget);
      else sampleFlightPose(route, autopilotPhase, autopilotTarget);
      const isDevToBugHandoff = !isBugStage
        && !isSequence4Stage
        && !route.devDestinationIsWide
        && Boolean(route.bugDestination)
        && autopilotPhase >= DEV_TO_BUG_BLEND_START_PHASE;
      let devToBugHandoffProgress = 0;
      if (isDevToBugHandoff) {
        devToBugHandoffProgress = THREE.MathUtils.clamp(
          (autopilotPhase - DEV_TO_BUG_BLEND_START_PHASE)
            / (DEV_SEQUENCE_HANDOFF_PHASE - DEV_TO_BUG_BLEND_START_PHASE),
          0,
          1
        );
        sampleBugFlightPose(
          route,
          devToBugHandoffProgress * DEV_TO_BUG_ENTRY_PHASE,
          handoffTarget,
          camera.aspect
        );
        blendPoseToward(
          autopilotTarget,
          handoffTarget,
          smootherStep(devToBugHandoffProgress)
        );
      }
      if (isBugStage) {
        const framingBlend = smootherStep(smoothStepRange(0.62, 0.96, autopilotPhase));
        autopilotTarget.fov = THREE.MathUtils.lerp(
          autopilotTarget.fov,
          bugLandingFov(route, camera.aspect),
          framingBlend
        );
      }
      const isBugToReturnHandoff = isBugStage
        && !route.bugDestinationIsWide
        && Boolean(sequence4Geometry)
        && autopilotPhase >= BUG_TO_RETURN_BLEND_START_PHASE;
      let bugToReturnHandoffProgress = 0;
      if (isBugToReturnHandoff) {
        bugToReturnHandoffProgress = THREE.MathUtils.clamp(
          (autopilotPhase - BUG_TO_RETURN_BLEND_START_PHASE)
            / (BUG_SEQUENCE_HANDOFF_PHASE - BUG_TO_RETURN_BLEND_START_PHASE),
          0,
          1
        );
        sampleSequence4Pose(
          sequence4Geometry,
          bugToReturnHandoffProgress * BUG_TO_RETURN_ENTRY_PHASE,
          returnHandoffTarget
        );
        blendPoseToward(
          autopilotTarget,
          returnHandoffTarget,
          smootherStep(bugToReturnHandoffProgress)
        );
      }
      root.dataset.aboutForwardTravel = forwardTravel.toFixed(4);
      root.dataset.aboutFlightSequenceStage = flightStage;
      root.dataset.aboutForwardLookDot = autopilotTarget.forwardLookDot.toFixed(3);
      root.dataset.aboutDevInspectionAttention = autopilotTarget.devAttention.toFixed(3);
      root.dataset.aboutBugInspectionAttention = autopilotTarget.bugAttention.toFixed(3);
      root.dataset.aboutPortalFlybyAttention = autopilotTarget.portalAttention.toFixed(3);
      root.dataset.aboutLogoRecallAttention = autopilotTarget.logoAttention.toFixed(3);
      root.dataset.aboutHorizonFallbackAttention = autopilotTarget.horizonAttention.toFixed(3);
      root.dataset.aboutFlightInstructionState = autopilotTarget.waitingForInstruction
        ? "waiting"
        : "active";
      root.dataset.aboutDevToBugHandoffProgress = devToBugHandoffProgress.toFixed(3);
      root.dataset.aboutBugToReturnHandoffProgress = bugToReturnHandoffProgress.toFixed(3);
      setFlightAction(isDevToBugHandoff
        ? `Arriving at: ${route.devDestinationLabel} â€¢ Curving toward: ${route.bugDestinationLabel}`
        : isBugToReturnHandoff
          ? `Arriving at: ${route.bugDestinationLabel} â€¢ Curving toward: PMT logo`
          : describeFlightAction(route, flightStage, autopilotPhase, autopilotTarget));

      if (cinematicAttention > 0.04) {
        eventLookMatrix.lookAt(autopilotTarget.position, eventTarget, eventUp);
        eventQuaternion.setFromRotationMatrix(eventLookMatrix);
        autopilotTarget.quaternion.slerp(eventQuaternion, smootherStep(cinematicAttention));
      }
      autopilotTarget.fov = userAdjustedFov(autopilotTarget.fov);

      const positionBlend = 1 - Math.exp(-DRONE_POSITION_RESPONSE * deltaSeconds);
      const headingResponse = cinematicAttention > 0.04
        ? EVENT_HEADING_RESPONSE
        : DRONE_HEADING_RESPONSE;
      const headingBlend = 1 - Math.exp(-headingResponse * deltaSeconds);
      const fovBlend = 1 - Math.exp(-DRONE_FOV_RESPONSE * deltaSeconds);
      camera.position.lerp(autopilotTarget.position, positionBlend);
      if (!dragging) {
        camera.quaternion.slerp(autopilotTarget.quaternion, headingBlend).normalize();
      }
      camera.fov = THREE.MathUtils.lerp(camera.fov, autopilotTarget.fov, fovBlend);
      camera.updateProjectionMatrix();
      pose.copyFrom(autopilotTarget);
      const isWideChartApproach = !isSequence4Stage
        && (isBugStage ? route.bugDestinationIsWide : route.devDestinationIsWide);
      const wideArrivalTarget = isBugStage
        ? route.bugGeometry.bugLandingPosition
        : route.geometry.devLandingPosition;
      const wideArrivalReached = !isWideChartApproach
        || camera.position.distanceTo(wideArrivalTarget) <= 0.45;
      const approachComplete = isSequence4Stage
        ? autopilotPhase >= 1
        : isBugStage
          ? autopilotPhase >= (isWideChartApproach ? 1 : BUG_SEQUENCE_HANDOFF_PHASE)
            && wideArrivalReached
          : autopilotPhase >= (isWideChartApproach ? 1 : DEV_SEQUENCE_HANDOFF_PHASE)
            && wideArrivalReached;
      if (approachComplete) {
        if (isBugStage) finishChartApproach(now, "bug");
        else if (isSequence4Stage) finishSequence4();
        else finishChartApproach(now, "dev");
      }
      return;
    }

    if (mode === "manual") {
      updateManualMovement(now, deltaSeconds);
      const idleRemaining = IDLE_DURATION_MS - (now - lastInputAt);
      if (idleRemaining <= 0) {
        beginReturn(now);
      } else {
        setStatus(`Autopilot resumes in ${Math.max(1, Math.ceil(idleRemaining / 1000))}`);
      }
      return;
    }

    if (mode === "returning") {
      const progress = THREE.MathUtils.clamp((now - returnStartedAt) / RETURN_DURATION_MS, 0, 1);
      const eased = smootherStep(progress);
      camera.position.lerpVectors(returnFromPosition, returnTarget.position, eased);
      if (!dragging) {
        camera.quaternion.slerpQuaternions(returnFromQuaternion, returnTarget.quaternion, eased);
      }
      camera.fov = THREE.MathUtils.lerp(returnFromFov, returnTarget.fov, eased);
      camera.updateProjectionMatrix();
      if (progress >= 1) {
        if (!dragging) applyPose(camera, returnTarget);
        else {
          camera.position.copy(returnTarget.position);
          camera.fov = returnTarget.fov;
          camera.updateProjectionMatrix();
        }
        pose.copyFrom(returnTarget);
        resumeAutomaticFlightClock(now);
        setMode(prefersReducedMotion ? "reduced" : "auto");
      }
      return;
    }

    if (mode === "paused") return;
  }

  function updateManualMovement(now, deltaSeconds) {
    const forwardAmount = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
    const rightAmount = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    const upAmount = Number(keys.has("KeyE")) - Number(keys.has("KeyQ"));
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

  function beginManual(now = controllerNow) {
    if (mode === "intro" || disposed) return false;
    if (mode === "paused") return false;
    if (mode !== "manual") {
      automaticFlightSuspendedAt = now;
      setMode("manual");
      showControlHints();
    }
    lastInputAt = now;
    return true;
  }

  function beginReturn(now) {
    keys.clear();
    dragging = false;
    root.dataset.aboutMouseLookActive = "false";
    sampleCurrentAutopilotPose(returnTarget);
    returnTarget.fov = userAdjustedFov(returnTarget.fov);
    if (prefersReducedMotion) {
      applyPose(camera, returnTarget);
      pose.copyFrom(returnTarget);
      resumeAutomaticFlightClock(now);
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
    if (event.button !== 0 || mode === "intro" || disposed) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    dragging = true;
    root.dataset.aboutMouseLookActive = "true";
    dragX = event.clientX;
    dragY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging || disposed) return;
    const deltaX = event.clientX - dragX;
    const deltaY = event.clientY - dragY;
    dragX = event.clientX;
    dragY = event.clientY;
    dragEuler.setFromQuaternion(camera.quaternion);
    dragEuler.y -= deltaX * 0.003;
    dragEuler.x -= deltaY * 0.003;
    dragEuler.x = THREE.MathUtils.clamp(
      dragEuler.x,
      -Math.PI / 2 + 0.04,
      Math.PI / 2 - 0.04
    );
    camera.quaternion.setFromEuler(dragEuler);
  }

  function stopDragging(event) {
    dragging = false;
    root.dataset.aboutMouseLookActive = "false";
    if (event?.pointerId !== undefined && canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function onWheel(event) {
    if (mode === "intro" || disposed) return;
    event.preventDefault();
    const fovChange = THREE.MathUtils.clamp(event.deltaY * 0.015, -4, 4);
    userFovOffset = THREE.MathUtils.clamp(userFovOffset + fovChange, -18, 24);
    camera.fov = THREE.MathUtils.clamp(
      camera.fov + fovChange,
      MIN_USER_FOV,
      MAX_USER_FOV
    );
    camera.updateProjectionMatrix();
    root.dataset.aboutUserZoomOffset = userFovOffset.toFixed(2);
  }

  function onKeyDown(event) {
    if (isTypingTarget(event.target)) return;
    if (event.code === "Enter" && !event.repeat && noCommandModifier(event)) {
      event.preventDefault();
      restartSequenceOne();
      return;
    }
    if (event.code === "Space" && !event.repeat && noCommandModifier(event)) {
      event.preventDefault();
      toggleAnimationPause();
      return;
    }
    if (isControlHintsKey(event) && !event.repeat && noCommandModifier(event)) {
      event.preventDefault();
      toggleControlHints();
      return;
    }
    const speedDirection = flightSpeedDirection(event);
    if (speedDirection
      && noCommandModifier(event)) {
      event.preventDefault();
      if (!event.repeat) adjustFlightSpeed(speedDirection);
      return;
    }
    if (BOOST_KEYS.has(event.code) && mode === "manual") {
      keys.add(event.code);
      return;
    }
    if (!MOVEMENT_KEYS.has(event.code) || !noCommandModifier(event)) return;
    // A is primarily the guaranteed-strike alien hotkey. It may continue an
    // existing manual strafe, but it must never take automatic flight over.
    if (event.code === "KeyA" && mode !== "manual") return;
    if (!beginManual()) return;
    event.preventDefault();
    keys.add(event.code);
  }

  function onKeyUp(event) {
    if (!MOVEMENT_KEYS.has(event.code) && !BOOST_KEYS.has(event.code)) return;
    keys.delete(event.code);
    if (mode === "manual") lastInputAt = controllerNow;
  }

  function clearKeys() {
    keys.clear();
    if (mode === "manual") lastInputAt = controllerNow;
  }

  function sampleCurrentAutopilotPose(target) {
    if (flightStage === "wide-flythrough" && activeWideTraversal) {
      const progress = activeWideTraversal.progress || 0;
      target.position.lerpVectors(
        activeWideTraversal.startPosition,
        activeWideTraversal.endPosition,
        progress
      );
      target.quaternion.slerpQuaternions(
        activeWideTraversal.startQuaternion,
        activeWideTraversal.endQuaternion,
        smootherStep(progress)
      ).normalize();
      target.fov = THREE.MathUtils.lerp(
        activeWideTraversal.startFov,
        WIDE_CHART_TRAVERSAL_FOV,
        smootherStep(progress)
      );
      target.logoAttention = 0;
      target.portalAttention = 0;
      target.devAttention = 0;
      target.bugAttention = 0;
      target.horizonAttention = 0;
      target.waitingForInstruction = false;
      return;
    }
    if (flightStage === "bug") {
      sampleBugFlightPose(route, autopilotPhase, target, camera.aspect);
      return;
    }
    if (flightStage === "return-initial" && sequence4Geometry) {
      sampleSequence4Pose(sequence4Geometry, autopilotPhase, target);
      return;
    }
    sampleFlightPose(route, autopilotPhase, target);
  }

  function resumeAutomaticFlightClock(now) {
    if (automaticFlightSuspendedAt === null) return;
    if (flightStage === "wide-flythrough") {
      stageStartedAt += Math.max(0, now - automaticFlightSuspendedAt);
    }
    automaticFlightSuspendedAt = null;
  }

  function toggleAnimationPause() {
    if (mode === "intro" || mode === "reduced") return;
    if (mode === "paused") {
      const resumedMode = pausedFromMode === "paused" ? "auto" : pausedFromMode;
      if (resumedMode === "manual") lastInputAt = controllerNow;
      setMode(resumedMode);
      return;
    }
    pausedFromMode = mode;
    keys.clear();
    dragging = false;
    root.dataset.aboutMouseLookActive = "false";
    setMode("paused");
  }

  function showControlHints() {
    if (mode === "intro" || disposed) return;
    if (mode === "manual") lastInputAt = controllerNow;
    window.clearTimeout(controlHintsTimer);
    root.dataset.aboutControlHintsVisible = "true";
    controlHintsTimer = window.setTimeout(() => {
      if (!disposed) root.dataset.aboutControlHintsVisible = "false";
    }, CONTROL_HINT_DURATION_MS);
  }

  function toggleControlHints() {
    if (root.dataset.aboutControlHintsVisible === "true") {
      window.clearTimeout(controlHintsTimer);
      root.dataset.aboutControlHintsVisible = "false";
      return;
    }
    showControlHints();
  }

  function onModeClick() {
    if (mode !== "manual") return;
    beginReturn(controllerNow);
  }

  function userAdjustedFov(baseFov) {
    return THREE.MathUtils.clamp(
      baseFov + userFovOffset,
      MIN_USER_FOV,
      MAX_USER_FOV
    );
  }

  function setMode(nextMode) {
    mode = nextMode;
    root.dataset.flightMode = mode;
    modeElement.disabled = mode !== "manual";
    modeElement.setAttribute(
      "aria-label",
      mode === "manual" ? "Manual camera mode. Click to resume autopilot." : `${mode} flight mode`
    );
    if (mode === "intro") {
      setModeLabel("3D");
      setStatus("Building the glass logo…");
      setFlightAction("Preparing 3D gallery");
    } else if (mode === "auto") {
      setAutoHud();
    } else if (mode === "manual") {
      setModeLabel("MANUAL");
      setStatus("Autopilot resumes in 5");
      setFlightAction("Manual camera control");
    } else if (mode === "returning") {
      setModeLabel("REJOIN");
      setStatus("Smoothly rejoining the saved flight path…");
      setFlightAction("Rejoining cinematic flight path");
    } else if (mode === "paused") {
      setModeLabel("PAUSED");
      setStatus("Animation paused - press Space to resume");
      setFlightAction("All flight and event animation paused");
    } else {
      setModeLabel("STILL");
      setStatus("Reduced motion • click the scene to explore");
      setFlightAction("Cinematic flight paused for reduced motion");
    }
  }

  function adjustFlightSpeed(speedDirection) {
    flightSpeed = THREE.MathUtils.clamp(
      Math.round((flightSpeed + speedDirection * FLIGHT_SPEED_STEP) * 4) / 4,
      MIN_FLIGHT_SPEED,
      MAX_FLIGHT_SPEED
    );
    root.dataset.aboutFlightSpeed = formatFlightSpeed();
    if (mode === "auto") setAutoHud();
    else setStatus(`Autopilot speed set to ${formatFlightSpeed()}x`);
  }

  function setAutoHud() {
    const speed = formatFlightSpeed();
    setModeLabel(`AUTO ${speed}x`);
    setStatus(`Autopilot • ${speed}x speed • hold left mouse to look`);
  }

  function formatFlightSpeed() {
    return Number.isInteger(flightSpeed)
      ? String(flightSpeed)
      : String(flightSpeed).replace(/0+$/, "");
  }

  function setReducedMotion(value) {
    prefersReducedMotion = Boolean(value);
    if (mode === "intro" || mode === "manual") return;
    if (prefersReducedMotion) {
      sampleFlightPose(
        route,
        autopilotPhase,
        pose
      );
      pose.fov = userAdjustedFov(pose.fov);
      applyPose(camera, pose);
      setMode("reduced");
    } else if (mode === "reduced") {
      setMode("auto");
    }
  }

  function setCinematicFocus(target, attention) {
    // Background events may request attention, but cannot alter flight speed.
    cinematicAttention = THREE.MathUtils.clamp(Number(attention || 0), 0, 1);
    if (target) eventTarget.copy(target);
  }

  function setStatus(text) {
    if (statusElement.textContent !== text) statusElement.textContent = text;
  }

  function setModeLabel(text) {
    if (modeElement.textContent !== text) modeElement.textContent = text;
  }

  function setFlightAction(text) {
    root.dataset.aboutFlightAction = text;
    if (debugElement && debugElement.textContent !== text) debugElement.textContent = text;
  }

  function finishChartApproach(now, chartType) {
    const isDevChart = chartType === "dev";
    const isWide = isDevChart ? route.devDestinationIsWide : route.bugDestinationIsWide;
    const traversal = isDevChart ? route.geometry.wideTraversal : route.bugGeometry.wideTraversal;
    const label = isDevChart ? route.devDestinationLabel : route.bugDestinationLabel;
    if (isDevChart) root.dataset.aboutDevLandingTarget = label;
    else root.dataset.aboutBugLandingTarget = label;
    if (isWide) {
      startWideChartFlythrough(now, traversal, label, isDevChart ? "bug" : "return-initial");
      return;
    }
    if (isDevChart) startBugSequence(false);
    else startSequence4(false);
  }

  function startBugSequence(rebuildFromCurrent) {
    if (rebuildFromCurrent) {
      route.bugGeometry = createBugFlightGeometry({
        devLandingPosition: camera.position,
        devDestination: route.devDestination,
        bugDestination: route.bugDestination,
        bugDestinationWidth: route.bugDestinationWidth,
        bugDestinationIsWide: route.bugDestinationIsWide,
        minimumCameraY
      });
      prepareSequence4Geometry();
      updateRouteDatasets();
    }
    flightStage = "bug";
    autopilotPhase = rebuildFromCurrent ? 0 : DEV_TO_BUG_ENTRY_PHASE;
    root.dataset.aboutDevToBugHandoffProgress = rebuildFromCurrent ? "0" : "1";
    root.dataset.aboutDevLandingTestState = "approaching-bug";
    root.dataset.aboutFlightSequenceStage = flightStage;
    root.dataset.aboutDevLandingTarget = route.devDestinationLabel;
    setMode("auto");
    setFlightAction(`Turning smoothly • Next: ${route.bugDestinationLabel}`);
  }

  function startWideChartFlythrough(now, traversal, label, nextStage) {
    wideStartPosition.copy(camera.position);
    wideStartQuaternion.copy(camera.quaternion);
    wideLookMatrix.lookAt(traversal.endPosition, traversal.endLookTarget, localUp);
    wideEndQuaternion.setFromRotationMatrix(wideLookMatrix);
    activeWideTraversal = {
      ...traversal,
      label,
      nextStage,
      startPosition: wideStartPosition.clone(),
      startQuaternion: wideStartQuaternion.clone(),
      endQuaternion: wideEndQuaternion.clone(),
      startFov: THREE.MathUtils.clamp(
        camera.fov - userFovOffset,
        MIN_USER_FOV,
        MAX_USER_FOV
      ),
      progress: 0,
      traversalDistance: Math.max(
        0.001,
        wideStartPosition.distanceTo(traversal.endPosition)
      )
    };
    flightStage = "wide-flythrough";
    stageStartedAt = now;
    root.dataset.aboutFlightSequenceStage = flightStage;
    root.dataset.aboutWideChartTraversalActive = "true";
    root.dataset.aboutWideChartTraversalTarget = label;
    root.dataset.aboutWideChartTraversalNextStage = nextStage;
    setModeLabel("CHART FLY-THRU");
    setFlightAction(`Wide chart fly-thru: ${label} • 0%`);
  }

  function updateWideChartFlythrough(now) {
    const traveledDistance = Math.max(
      0,
      ((now - stageStartedAt) / 1000) * WIDE_CHART_TRAVERSAL_SPEED
    );
    const progress = THREE.MathUtils.clamp(
      traveledDistance / activeWideTraversal.traversalDistance,
      0,
      1
    );
    activeWideTraversal.progress = progress;
    camera.position.lerpVectors(
      activeWideTraversal.startPosition,
      activeWideTraversal.endPosition,
      progress
    );
    if (!dragging) {
      camera.quaternion.slerpQuaternions(
        activeWideTraversal.startQuaternion,
        activeWideTraversal.endQuaternion,
        smootherStep(progress)
      ).normalize();
    }
    camera.fov = userAdjustedFov(THREE.MathUtils.lerp(
      activeWideTraversal.startFov,
      WIDE_CHART_TRAVERSAL_FOV,
      smootherStep(progress)
    ));
    camera.updateProjectionMatrix();
    root.dataset.aboutWideChartTraversalProgress = progress.toFixed(3);
    setFlightAction(
      `Wide chart fly-thru: ${activeWideTraversal.label} • ${Math.round(progress * 100)}%`
    );
    if (progress < 1) return;
    root.dataset.aboutWideChartTraversalActive = "false";
    const nextStage = activeWideTraversal.nextStage;
    activeWideTraversal = null;
    if (nextStage === "bug") startBugSequence(true);
    else startSequence4(true);
  }

  function createPlannedSequence4Geometry() {
    return createSequence4Geometry({
      startPosition: route.bugGeometry.bugLandingPosition,
      initialPosition: route.geometry.initialPosition,
      logoTarget: route.geometry.logoTarget,
      minimumCameraY,
      startFov: bugLandingFov(route, camera.aspect)
    });
  }

  function prepareSequence4Geometry() {
    sequence4Geometry = createPlannedSequence4Geometry();
    root.dataset.aboutBugToReturnHandoffPrepared = "true";
  }

  function startSequence4(rebuildFromCurrent) {
    if (rebuildFromCurrent) {
      sequence4Geometry = createSequence4Geometry({
        startPosition: camera.position,
        initialPosition: route.geometry.initialPosition,
        logoTarget: route.geometry.logoTarget,
        minimumCameraY,
        startFov: THREE.MathUtils.clamp(
          camera.fov - userFovOffset,
          MIN_USER_FOV,
          MAX_USER_FOV
        )
      });
    }
    flightStage = "return-initial";
    autopilotPhase = rebuildFromCurrent ? 0 : BUG_TO_RETURN_ENTRY_PHASE;
    root.dataset.aboutBugToReturnHandoffProgress = rebuildFromCurrent ? "0" : "1";
    root.dataset.aboutFlightSequenceStage = flightStage;
    root.dataset.aboutDevLandingTestState = "returning-to-initial-view";
    setModeLabel("SEQUENCE 4");
    setFlightAction("Sequence 4: Returning naturally to the initial logo view");
  }

  function finishSequence4() {
    restartSequenceOne();
  }

  function restartSequenceOne() {
    route.advanceLap();
    prepareSequence4Geometry();
    debugTestRun += 1;
    flightStage = "dev";
    autopilotPhase = 0;
    forwardTravel = 0;
    activeWideTraversal = null;
    automaticFlightSuspendedAt = null;
    pausedFromMode = "auto";
    keys.clear();
    dragging = false;
    userFovOffset = 0;
    updateRouteDatasets();
    root.dataset.aboutDevLandingTestRun = String(debugTestRun);
    root.dataset.aboutDevLandingTestState = "approaching-dev";
    root.dataset.aboutFlightSequenceStage = flightStage;
    root.dataset.aboutDevToBugHandoffProgress = "0";
    root.dataset.aboutBugToReturnHandoffProgress = "0";
    root.dataset.aboutWideChartTraversalActive = "false";
    root.dataset.aboutMouseLookActive = "false";
    root.dataset.aboutUserZoomOffset = "0.00";
    root.dataset.aboutEnterRestartBehavior = "reset-sequence-1-in-scene";
    window.clearTimeout(controlHintsTimer);
    root.dataset.aboutControlHintsVisible = "false";
    setMode("auto");
    sampleFlightPose(route, 0, autopilotTarget);
    autopilotTarget.fov = userAdjustedFov(autopilotTarget.fov);
    applyPose(camera, autopilotTarget);
    pose.copyFrom(autopilotTarget);
    setFlightAction(`Sequence 1 restarted • Next Dev chart: ${route.devDestinationLabel}`);
  }

  function updateRouteDatasets() {
    root.dataset.aboutFlightLap = String(route.lapIndex + 1);
    root.dataset.aboutDevDestinationIndex = String(route.devDestinationIndex);
    root.dataset.aboutDevDestination = route.devDestinationLabel || "";
    root.dataset.aboutDevDestinationWidth = String(route.devDestinationWidth);
    root.dataset.aboutDevDestinationIsWide = String(route.devDestinationIsWide);
    root.dataset.aboutNextDestination = route.devDestinationLabel || "";
    root.dataset.aboutNextDestinationPrepared = String(Boolean(route.devDestination));
    root.dataset.aboutDevApproachY = String(route.geometry.devApproachY);
    root.dataset.aboutDevLandingPhase = route.geometry.devLandingPhase.toFixed(4);
    root.dataset.aboutBugDestinationIndex = String(route.bugDestinationIndex);
    root.dataset.aboutBugDestination = route.bugDestinationLabel || "";
    root.dataset.aboutBugDestinationWidth = String(route.bugDestinationWidth);
    root.dataset.aboutBugDestinationIsWide = String(route.bugDestinationIsWide);
    root.dataset.aboutBugDestinationPrepared = String(Boolean(route.bugDestination));
    root.dataset.aboutBugLandingX = String(route.bugGeometry.bugLandingPosition.x);
    root.dataset.aboutBugLandingY = String(route.bugGeometry.bugLandingPosition.y);
    root.dataset.aboutBugLandingZ = String(route.bugGeometry.bugLandingPosition.z);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    window.clearTimeout(controlHintsTimer);
    abortController.abort();
    keys.clear();
  }

  return {
    startAutopilot,
    update,
    isPaused: () => mode === "paused",
    setReducedMotion,
    setCinematicFocus,
    dispose
  };
}

function createFlightRouteState({
  sceneFocus,
  portal,
  devDestinations,
  devDestinationLabels,
  devDestinationWidths,
  bugDestinations,
  bugDestinationLabels,
  bugDestinationWidths,
  galleryRoomBackZ,
  minimumCameraY
}) {
  const state = {
    lapIndex: 0,
    devDestinationIndex: -1,
    devDestination: null,
    devDestinationLabel: "",
    devDestinationWidth: DEV_LANDING_PANEL_WIDTH,
    devDestinationIsWide: false,
    bugDestinationIndex: -1,
    bugDestination: null,
    bugDestinationLabel: "",
    bugDestinationWidth: DEV_LANDING_PANEL_WIDTH,
    bugDestinationIsWide: false,
    geometry: null,
    advanceLap() {
      state.lapIndex += 1;
      rebuildRouteState(
        state,
        sceneFocus,
        portal,
        devDestinations,
        devDestinationLabels,
        devDestinationWidths,
        bugDestinations,
        bugDestinationLabels,
        bugDestinationWidths,
        galleryRoomBackZ,
        minimumCameraY
      );
    }
  };
  rebuildRouteState(
    state,
    sceneFocus,
    portal,
    devDestinations,
    devDestinationLabels,
    devDestinationWidths,
    bugDestinations,
    bugDestinationLabels,
    bugDestinationWidths,
    galleryRoomBackZ,
    minimumCameraY
  );
  return state;
}

function rebuildRouteState(
  state,
  sceneFocus,
  portal,
  devDestinations,
  devDestinationLabels,
  devDestinationWidths,
  bugDestinations,
  bugDestinationLabels,
  bugDestinationWidths,
  galleryRoomBackZ,
  minimumCameraY
) {
  const dev = chooseRandomDestination(devDestinations, state.devDestinationIndex);
  const bug = chooseRandomDestination(bugDestinations, state.bugDestinationIndex);
  state.devDestinationIndex = dev.index;
  state.devDestinationLabel = destinationLabel(devDestinationLabels, dev.index);
  state.devDestination = dev.target;
  state.devDestinationWidth = destinationWidth(devDestinationWidths, dev.index);
  state.devDestinationIsWide = chartRequiresTraversal(state.devDestinationWidth);
  state.bugDestinationIndex = bug.index;
  state.bugDestinationLabel = destinationLabel(bugDestinationLabels, bug.index);
  state.bugDestination = bug.target;
  state.bugDestinationWidth = destinationWidth(bugDestinationWidths, bug.index);
  state.bugDestinationIsWide = chartRequiresTraversal(state.bugDestinationWidth);
  state.geometry = createGalleryFlightGeometry({
    sceneFocus,
    portal,
    devDestination: state.devDestination,
    devDestinationWidth: state.devDestinationWidth,
    devDestinationIsWide: state.devDestinationIsWide,
    galleryRoomBackZ,
    minimumCameraY
  });
  state.bugGeometry = createBugFlightGeometry({
    devLandingPosition: state.geometry.devLandingPosition,
    devDestination: state.devDestination,
    bugDestination: state.bugDestination,
    bugDestinationWidth: state.bugDestinationWidth,
    bugDestinationIsWide: state.bugDestinationIsWide,
    minimumCameraY
  });
}

function createGalleryFlightGeometry({
  sceneFocus,
  portal,
  devDestination,
  devDestinationWidth,
  devDestinationIsWide,
  galleryRoomBackZ,
  minimumCameraY
}) {
  const focusY = sceneFocus.y;
  const safePortal = portal?.clone?.() || new THREE.Vector3(-3.2, focusY + 2.35, 0);
  const logoTarget = new THREE.Vector3(
    sceneFocus.x,
    clampY(focusY + 1.35, minimumCameraY),
    sceneFocus.z
  );
  const logoViewY = clampY(logoTarget.y + 0.1, minimumCameraY);
  const portalTarget = new THREE.Vector3(
    safePortal.x,
    clampY(safePortal.y, minimumCameraY + 1.35),
    safePortal.z
  );
  const portalLookTarget = new THREE.Vector3(portalTarget.x, portalTarget.y, -12);
  const cruiseY = clampY(focusY + 4.75, minimumCameraY + 3.1);
  const devX = devDestination?.x ?? 0;
  const devY = devDestination
    ? clampY(devDestination.y, minimumCameraY + 0.35)
    : cruiseY;
  const roomBackZ = Math.min(-18, galleryRoomBackZ);
  const point = (x, y, z) => new THREE.Vector3(x, clampY(y, minimumCameraY), z);
  const devTraversal = createWideChartTraversal({
    chartTarget: devDestination,
    chartWidth: devDestinationWidth,
    wallNormal: new THREE.Vector3(0, 0, -1),
    widthAxis: new THREE.Vector3(1, 0, 0),
    minimumCameraY
  });
  const devArrivalX = devX === 0
    ? 1.4
    : devX - Math.sign(devX) * 1.8;
  const naturalDevLandingPosition = point(
    devArrivalX,
    devY + 0.18,
    roomBackZ + DEV_LANDING_DISTANCE
  );
  const devLandingPosition = devDestinationIsWide
    ? devTraversal.startPosition.clone()
    : naturalDevLandingPosition;
  const curve = new THREE.CatmullRomCurve3([
    point(0, logoViewY, 19.5),
    point(0.08, logoViewY, 17),
    point(portalTarget.x * 0.35, THREE.MathUtils.lerp(logoViewY, portalTarget.y, 0.35), 11.2),
    point(portalTarget.x * 0.86, THREE.MathUtils.lerp(logoViewY, portalTarget.y, 0.78), 5.1),
    point(portalTarget.x, portalTarget.y, 1.1),
    point(portalTarget.x, portalTarget.y, -3.5),
    point(
      THREE.MathUtils.lerp(portalTarget.x, devX, 0.18),
      THREE.MathUtils.lerp(portalTarget.y, devY, 0.24),
      -8.5
    ),
    point(
      THREE.MathUtils.lerp(portalTarget.x, devX, 0.45),
      THREE.MathUtils.lerp(portalTarget.y, devY, 0.48),
      -13.5
    ),
    point(
      THREE.MathUtils.lerp(portalTarget.x, devX, 0.72),
      THREE.MathUtils.lerp(portalTarget.y, devY, 0.72),
      roomBackZ + 17
    ),
    point(
      THREE.MathUtils.lerp(devX, devLandingPosition.x, 0.52),
      THREE.MathUtils.lerp(devY, devLandingPosition.y, 0.52),
      roomBackZ + 12
    ),
    devLandingPosition.clone()
  ], false, "centripetal", 0.5);

  return {
    curve,
    initialPosition: curve.points[0].clone(),
    logoTarget,
    portalTarget,
    portalLookTarget,
    devApproachY: devY,
    devLookTarget: devDestinationIsWide
      ? devTraversal.startLookTarget.clone()
      : devDestination?.clone?.() || new THREE.Vector3(devX, devY, roomBackZ),
    wideTraversal: devTraversal,
    devLandingPosition,
    devLandingPhase: 1,
    minimumCameraY
  };
}

function createBugFlightGeometry({
  devLandingPosition,
  devDestination,
  bugDestination,
  bugDestinationWidth,
  bugDestinationIsWide,
  minimumCameraY
}) {
  const point = (x, y, z) => new THREE.Vector3(x, clampY(y, minimumCameraY), z);
  const safeBugTarget = bugDestination?.clone?.() || new THREE.Vector3(36, 3, -16);
  const bugTraversal = createWideChartTraversal({
    chartTarget: safeBugTarget,
    chartWidth: bugDestinationWidth,
    wallNormal: new THREE.Vector3(1, 0, 0),
    widthAxis: new THREE.Vector3(0, 0, 1),
    minimumCameraY
  });
  const naturalBugLandingPosition = point(
    safeBugTarget.x - DEV_LANDING_DISTANCE,
    safeBugTarget.y,
    safeBugTarget.z
  );
  const bugLandingPosition = bugDestinationIsWide
    ? bugTraversal.startPosition.clone()
    : naturalBugLandingPosition;
  const start = devLandingPosition.clone();
  const curve = new THREE.CatmullRomCurve3([
    start,
    point(
      THREE.MathUtils.lerp(start.x, bugLandingPosition.x, 0.13),
      THREE.MathUtils.lerp(start.y, bugLandingPosition.y, 0.12),
      start.z - 0.9
    ),
    point(
      THREE.MathUtils.lerp(start.x, bugLandingPosition.x, 0.36),
      THREE.MathUtils.lerp(start.y, bugLandingPosition.y, 0.32),
      THREE.MathUtils.lerp(start.z, bugLandingPosition.z, 0.34)
    ),
    point(
      THREE.MathUtils.lerp(start.x, bugLandingPosition.x, 0.66),
      THREE.MathUtils.lerp(start.y, bugLandingPosition.y, 0.62),
      THREE.MathUtils.lerp(start.z, bugLandingPosition.z, 0.66)
    ),
    point(
      THREE.MathUtils.lerp(start.x, bugLandingPosition.x, 0.88),
      THREE.MathUtils.lerp(start.y, bugLandingPosition.y, 0.88),
      THREE.MathUtils.lerp(start.z, bugLandingPosition.z, 0.88)
    ),
    bugLandingPosition.clone()
  ], false, "centripetal", 0.5);

  return {
    curve,
    devLookTarget: devDestination?.clone?.() || new THREE.Vector3(0, start.y, start.z - 10),
    bugLookTarget: bugDestinationIsWide
      ? bugTraversal.startLookTarget.clone()
      : safeBugTarget,
    wideTraversal: bugTraversal,
    bugLandingPosition,
    minimumCameraY
  };
}

function createWideChartTraversal({
  chartTarget,
  chartWidth,
  wallNormal,
  widthAxis,
  minimumCameraY
}) {
  const safeTarget = chartTarget?.clone?.() || new THREE.Vector3();
  const safeWidth = Math.max(DEV_LANDING_PANEL_WIDTH, Number(chartWidth) || 0);
  const normalizedWallNormal = wallNormal.clone().normalize();
  const normalizedWidthAxis = widthAxis.clone().normalize();
  const upperLeftOffset = normalizedWidthAxis.clone()
    .multiplyScalar(safeWidth * WIDE_CHART_START_OFFSET_RATIO);
  const startLookTarget = safeTarget.clone()
    .add(upperLeftOffset)
    .add(new THREE.Vector3(0, DEV_LANDING_PANEL_HEIGHT * 0.24, 0));
  startLookTarget.y = clampY(startLookTarget.y, minimumCameraY + 0.4);
  const startPosition = startLookTarget.clone()
    .addScaledVector(normalizedWallNormal, -DEV_LANDING_DISTANCE);
  startPosition.y = clampY(startPosition.y, minimumCameraY);
  const endPosition = startPosition.clone()
    .addScaledVector(normalizedWidthAxis, safeWidth * WIDE_CHART_TRAVERSAL_SPAN_RATIO);
  endPosition.y = clampY(
    THREE.MathUtils.lerp(startPosition.y, safeTarget.y, 0.34),
    minimumCameraY
  );
  const endHeading = normalizedWidthAxis.clone()
    .multiplyScalar(0.8)
    .addScaledVector(normalizedWallNormal, 0.6)
    .normalize();
  const endLookTarget = endPosition.clone().addScaledVector(endHeading, 12);
  return {
    startPosition,
    startLookTarget,
    endPosition,
    endLookTarget,
    wallNormal: normalizedWallNormal,
    widthAxis: normalizedWidthAxis
  };
}

function createSequence4Geometry({
  startPosition,
  initialPosition,
  logoTarget,
  minimumCameraY,
  startFov
}) {
  const start = startPosition.clone();
  const initial = initialPosition.clone();
  const point = (x, y, z) => new THREE.Vector3(x, clampY(y, minimumCameraY), z);
  const frontArcZ = Math.max(initial.z + 14, start.z + 12);
  const curve = new THREE.CatmullRomCurve3([
    start,
    point(start.x - 0.5, start.y, start.z + 3.8),
    point(
      THREE.MathUtils.lerp(start.x, initial.x, 0.24),
      THREE.MathUtils.lerp(start.y, initial.y, 0.2),
      Math.max(start.z + 9, -4)
    ),
    point(
      THREE.MathUtils.lerp(start.x, initial.x, 0.58),
      THREE.MathUtils.lerp(start.y, initial.y, 0.52),
      initial.z + 7
    ),
    point(initial.x, initial.y, frontArcZ),
    point(initial.x, initial.y, initial.z + 7),
    initial
  ], false, "centripetal", 0.5);
  return {
    curve,
    logoTarget: logoTarget.clone(),
    minimumCameraY,
    startFov
  };
}

function sampleSequence4Pose(geometry, phase, pose) {
  geometry.curve.getPointAt(phase, pose.position);
  pose.position.y = Math.max(pose.position.y, geometry.minimumCameraY);
  geometry.curve.getTangentAt(phase, pose.tangent).normalize();
  geometry.curve.getPointAt(Math.min(1, phase + 0.018), pose.ahead);
  pose.ahead.y = Math.max(pose.ahead.y, geometry.minimumCameraY);
  pose.lookTarget.copy(pose.position).addScaledVector(pose.tangent, 10);
  pose.lookTarget.y = pose.position.y;
  const logoAttention = smootherStep(smoothStepRange(0.04, 0.34, phase));
  pose.lookTarget.lerp(geometry.logoTarget, logoAttention);
  pose.lookMatrix.lookAt(pose.position, pose.lookTarget, pose.up);
  pose.quaternion.setFromRotationMatrix(pose.lookMatrix);
  pose.logoAttention = logoAttention;
  pose.portalAttention = 0;
  pose.devAttention = 0;
  pose.bugAttention = 0;
  pose.horizonAttention = 1 - logoAttention;
  pose.waitingForInstruction = false;
  pose.forwardReference.copy(pose.tangent);
  pose.lookDirection.copy(pose.lookTarget).sub(pose.position).normalize();
  pose.forwardLookDot = pose.lookDirection.dot(pose.tangent);
  pose.fov = THREE.MathUtils.lerp(geometry.startFov, DEFAULT_FOV, smootherStep(phase));
}

function sampleFlightPose(route, phase, pose) {
  const { geometry } = route;
  const { curve } = geometry;
  curve.getPointAt(phase, pose.position);
  pose.position.y = Math.max(pose.position.y, geometry.minimumCameraY);
  curve.getTangentAt(phase, pose.tangent).normalize();
  curve.getPointAt(Math.min(1, phase + 0.018), pose.ahead);
  pose.ahead.y = Math.max(pose.ahead.y, geometry.minimumCameraY);
  pose.lookTarget.copy(pose.position).addScaledVector(pose.tangent, 8);
  pose.lookTarget.y = pose.position.y;

  pose.portalAttention = smoothBand(phase, 0.035, 0.42, 0.05);
  pose.devAttention = route.devDestination
    ? smoothStepRange(0.2, 0.42, phase)
    : 0;
  pose.logoAttention = 1 - smoothStepRange(0.01, 0.1, phase);
  pose.lookTarget.lerp(geometry.logoTarget, pose.logoAttention);

  if (pose.portalAttention > 0) {
    pose.lookTarget.lerp(geometry.portalLookTarget, smootherStep(pose.portalAttention) * 0.86);
  }

  if (route.devDestination) {
    const devVerticalBlend = smootherStep(smoothStepRange(0.3, 0.66, phase));
    const devCenteringWeight = THREE.MathUtils.lerp(
      0.76,
      1,
      smootherStep(smoothStepRange(0.55, 0.95, phase))
    );
    pose.devLookTarget.copy(geometry.devLookTarget);
    pose.devLookTarget.y = THREE.MathUtils.lerp(
      pose.position.y,
      geometry.devLookTarget.y,
      devVerticalBlend
    );
    pose.lookTarget.lerp(
      pose.devLookTarget,
      smootherStep(pose.devAttention) * devCenteringWeight
    );
  }

  const instructionAttention = Math.max(
    pose.portalAttention,
    pose.devAttention,
    pose.logoAttention
  );
  pose.waitingForInstruction = !route.devDestination;
  pose.horizonAttention = 1 - smootherStep(instructionAttention);
  keepLookTargetForward(pose, instructionAttention < 0.03);
  pose.lookMatrix.lookAt(pose.position, pose.lookTarget, pose.up);
  pose.quaternion.setFromRotationMatrix(pose.lookMatrix);
  const inspectionAttention = pose.devAttention;
  const inspectionFov = THREE.MathUtils.lerp(
    DEFAULT_FOV,
    INSPECTION_FOV,
    smootherStep(inspectionAttention)
  );
  pose.fov = THREE.MathUtils.lerp(
    inspectionFov,
    PORTAL_FOV,
    smootherStep(pose.portalAttention) * 0.48
  );
  if (route.devDestinationIsWide) {
    pose.fov = THREE.MathUtils.lerp(
      pose.fov,
      WIDE_CHART_FOV,
      smootherStep(pose.devAttention)
    );
  }
}

function sampleBugFlightPose(route, phase, pose, cameraAspect) {
  const { bugGeometry } = route;
  const { curve } = bugGeometry;
  curve.getPointAt(phase, pose.position);
  pose.position.y = Math.max(pose.position.y, bugGeometry.minimumCameraY);
  curve.getTangentAt(phase, pose.tangent).normalize();
  curve.getPointAt(Math.min(1, phase + 0.018), pose.ahead);
  pose.ahead.y = Math.max(pose.ahead.y, bugGeometry.minimumCameraY);
  const turnAttention = smootherStep(smoothStepRange(0, 0.62, phase));
  pose.lookTarget.lerpVectors(
    bugGeometry.devLookTarget,
    bugGeometry.bugLookTarget,
    turnAttention
  );
  pose.lookDirection.copy(pose.lookTarget).sub(pose.position).normalize();
  pose.forwardReference.copy(pose.tangent);
  pose.lookMatrix.lookAt(pose.position, pose.lookTarget, pose.up);
  pose.quaternion.setFromRotationMatrix(pose.lookMatrix);
  pose.logoAttention = 0;
  pose.portalAttention = 0;
  pose.devAttention = 1 - turnAttention;
  pose.bugAttention = turnAttention;
  pose.horizonAttention = 0;
  pose.waitingForInstruction = false;
  pose.forwardLookDot = pose.lookDirection.dot(pose.tangent);
  pose.fov = THREE.MathUtils.lerp(
    INSPECTION_FOV,
    bugLandingFov(route, cameraAspect),
    smootherStep(smoothStepRange(0.35, 0.95, phase))
  );
}

function bugLandingFov(route, cameraAspect) {
  if (route.bugDestinationIsWide) return WIDE_CHART_FOV;
  return landingFovForPanel(
    route.bugDestinationWidth,
    DEV_LANDING_PANEL_HEIGHT,
    cameraAspect
  );
}

function landingFovForPanel(panelWidth, panelHeight, cameraAspect) {
  const safeAspect = Math.max(0.5, Number(cameraAspect) || 1);
  const verticalHalfSize = Math.max(
    panelHeight / 2,
    panelWidth / (2 * safeAspect)
  ) * DEV_LANDING_FRAME_MARGIN;
  return THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(verticalHalfSize / DEV_LANDING_DISTANCE)),
    38,
    72
  );
}

function keepLookTargetForward(pose, levelHorizon) {
  const targetDistance = Math.max(1, pose.lookTarget.distanceTo(pose.position));
  pose.forwardReference.copy(pose.tangent);
  pose.forwardReference.y = 0;
  if (pose.forwardReference.lengthSq() < 0.000001) pose.forwardReference.set(0, 0, -1);
  pose.forwardReference.normalize();
  pose.lookDirection.copy(pose.lookTarget).sub(pose.position).normalize();
  const forwardDot = pose.lookDirection.dot(pose.forwardReference);
  if (forwardDot >= MIN_FORWARD_LOOK_DOT) {
    if (levelHorizon) pose.lookTarget.y = pose.position.y;
    pose.forwardLookDot = forwardDot;
    return;
  }
  pose.lateralLookDirection.copy(pose.lookDirection)
    .addScaledVector(pose.forwardReference, -forwardDot);
  if (pose.lateralLookDirection.lengthSq() < 0.000001) {
    pose.lookDirection.copy(pose.forwardReference);
  } else {
    pose.lateralLookDirection.normalize();
    pose.lookDirection.copy(pose.forwardReference)
      .multiplyScalar(MIN_FORWARD_LOOK_DOT)
      .addScaledVector(
        pose.lateralLookDirection,
        Math.sqrt(1 - MIN_FORWARD_LOOK_DOT * MIN_FORWARD_LOOK_DOT)
      )
      .normalize();
  }
  pose.lookTarget.copy(pose.position).addScaledVector(pose.lookDirection, targetDistance);
  if (levelHorizon) pose.lookTarget.y = pose.position.y;
  pose.forwardLookDot = pose.lookDirection.dot(pose.forwardReference);
}

function createPose() {
  const pose = {
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    tangent: new THREE.Vector3(),
    ahead: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    devLookTarget: new THREE.Vector3(),
    lookDirection: new THREE.Vector3(),
    lateralLookDirection: new THREE.Vector3(),
    forwardReference: new THREE.Vector3(),
    lookMatrix: new THREE.Matrix4(),
    up: new THREE.Vector3(0, 1, 0),
    logoAttention: 0,
    portalAttention: 0,
    devAttention: 0,
    bugAttention: 0,
    horizonAttention: 1,
    waitingForInstruction: false,
    forwardLookDot: 1,
    fov: DEFAULT_FOV
  };
  pose.copyFrom = source => {
    pose.position.copy(source.position);
    pose.quaternion.copy(source.quaternion);
    pose.tangent.copy(source.tangent);
    pose.ahead.copy(source.ahead);
    pose.lookTarget.copy(source.lookTarget);
    pose.lookDirection.copy(source.lookDirection);
    pose.lateralLookDirection.copy(source.lateralLookDirection);
    pose.logoAttention = source.logoAttention;
    pose.portalAttention = source.portalAttention;
    pose.devAttention = source.devAttention;
    pose.bugAttention = source.bugAttention;
    pose.horizonAttention = source.horizonAttention;
    pose.waitingForInstruction = source.waitingForInstruction;
    pose.forwardLookDot = source.forwardLookDot;
    pose.fov = source.fov;
  };
  return pose;
}

function blendPoseToward(pose, target, blend) {
  pose.position.lerp(target.position, blend);
  pose.quaternion.slerp(target.quaternion, blend).normalize();
  pose.tangent.lerp(target.tangent, blend).normalize();
  pose.ahead.lerp(target.ahead, blend);
  pose.lookTarget.lerp(target.lookTarget, blend);
  pose.lookDirection.lerp(target.lookDirection, blend).normalize();
  pose.lateralLookDirection.lerp(target.lateralLookDirection, blend);
  pose.logoAttention = THREE.MathUtils.lerp(pose.logoAttention, target.logoAttention, blend);
  pose.portalAttention = THREE.MathUtils.lerp(pose.portalAttention, target.portalAttention, blend);
  pose.devAttention = THREE.MathUtils.lerp(pose.devAttention, target.devAttention, blend);
  pose.bugAttention = THREE.MathUtils.lerp(pose.bugAttention, target.bugAttention, blend);
  pose.horizonAttention = THREE.MathUtils.lerp(
    pose.horizonAttention,
    target.horizonAttention,
    blend
  );
  pose.waitingForInstruction = pose.waitingForInstruction && target.waitingForInstruction;
  pose.forwardLookDot = THREE.MathUtils.lerp(pose.forwardLookDot, target.forwardLookDot, blend);
  pose.fov = THREE.MathUtils.lerp(pose.fov, target.fov, blend);
}

function applyPose(camera, pose) {
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.fov = pose.fov;
  camera.updateProjectionMatrix();
}

function normalizeTargets(targets, fallback) {
  const normalized = [];
  if (Array.isArray(targets)) {
    for (const target of targets) {
      if (target?.isVector3) normalized.push(target.clone());
    }
  }
  if (!normalized.length && fallback?.isVector3) normalized.push(fallback.clone());
  return normalized;
}

function chooseRandomDestination(targets, previousIndex) {
  if (!targets.length) return { target: null, index: -1 };
  let index = Math.floor(Math.random() * targets.length);
  if (targets.length > 1 && index === previousIndex) {
    index = (index + 1 + Math.floor(Math.random() * (targets.length - 1))) % targets.length;
  }
  return {
    target: targets[index].clone(),
    index
  };
}

function destinationWidth(widths, index) {
  const width = Array.isArray(widths) ? Number(widths[index]) : 0;
  return Number.isFinite(width) && width > 0 ? width : DEV_LANDING_PANEL_WIDTH;
}

function chartRequiresTraversal(width) {
  return Number(width) > WIDE_CHART_THRESHOLD;
}

function destinationLabel(labels, index) {
  const label = Array.isArray(labels) ? String(labels[index] || "").trim() : "";
  if (!label) return index >= 0 ? `Dev Task chart ${index + 1}` : "Dev Task chart";
  return /chart/i.test(label) ? label : `${label} Chart`;
}

function describeFlightAction(route, stage, phase, pose) {
  if (stage === "return-initial") {
    return phase >= 0.82
      ? "Sequence 4: Aligning with the initial logo view"
      : "Sequence 4: Returning to the front • Focus: PMT logo";
  }
  if (stage === "bug") {
    if (phase < 0.24) return `Turning smoothly • Next: ${route.bugDestinationLabel}`;
    if (pose.bugAttention >= 0.18) return `Destination: ${route.bugDestinationLabel}`;
    return `Turning toward QA chart: ${route.bugDestinationLabel}`;
  }
  if (phase < 0.42) {
    return `Executing P-hole flyby • Next: ${route.devDestinationLabel}`;
  }
  if (pose.devAttention >= 0.18) return `Destination: ${route.devDestinationLabel}`;
  if (pose.waitingForInstruction) return "Hovering • level horizon";
  return `Flying directly to: ${route.devDestinationLabel}`;
}

function clampY(value, minimumY) {
  return Math.max(value, minimumY);
}

function smoothStepRange(edge0, edge1, value) {
  const progress = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function smoothBand(value, start, end, fade) {
  const enter = smoothStepRange(start, start + fade, value);
  const exit = 1 - smoothStepRange(end - fade, end, value);
  return THREE.MathUtils.clamp(enter * exit, 0, 1);
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

function noCommandModifier(event) {
  return !event.ctrlKey && !event.metaKey && !event.altKey;
}

function isControlHintsKey(event) {
  return event.key === "?" || event.key === "/" || event.code === "Slash";
}

function flightSpeedDirection(event) {
  if (event.key === "+" || event.code === "Equal" || event.code === "NumpadAdd") return 1;
  if (event.key === "-" || event.code === "Minus" || event.code === "NumpadSubtract") return -1;
  return 0;
}
