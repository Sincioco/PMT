import * as THREE from "../../vendor/three/three.module.min.js";
import { RoomEnvironment } from "../../vendor/three/addons/environments/RoomEnvironment.js?v=0.185.1-pmt1";
import { SVGLoader } from "../../vendor/three/addons/loaders/SVGLoader.js?v=0.185.1-pmt1";
import { createAboutFlightController } from "./about-flight-controller.js?v=20260712-about-3d-flyby-83";
import { createLogoLightningEffect } from "./about-lightning.js?v=20260712-about-3d-flyby-83";
import { createUfoEncounter } from "./about-ufo.js?v=20260712-about-3d-flyby-83";
import {
  createAboutChartGallery,
  DEV_CHART_GRID_HEIGHT,
  DEV_CHART_GRID_WIDTH,
  DEV_CHART_GRID_Z
} from "./about-workload-billboard.js?v=20260712-about-3d-flyby-83";

const INTRO_DURATION_MS = 3000;
const INTRO_FADE_DURATION_MS = 1250;
const LOGO_WORLD_WIDTH = 12;
const EXTRUDE_DEPTH = 64;
const FLOOR_Y = -4.6;
const FLOOR_WIDTH = 220;
const FLOOR_DEPTH = 180;
const MIN_CAMERA_FLOOR_CLEARANCE = 1.55;
const FALLBACK_PORTAL = new THREE.Vector2(1006.56, 443.3);
const SEQUENCE_4_BACKGROUND_UFO_ENABLED = true;
const LIGHTNING_EVENTS_ENABLED = false;
const SEQUENCE_4_LOGO_STRIKE_SECONDS = 5.2;
const SEQUENCE_4_UFO_STRIKE_SECONDS = 16;
const SEQUENCE_4_UFO_STRIKE_CHANCE = 0.5;

export function createAboutScene({
  root,
  canvas,
  introElement,
  introCountdownElement,
  statusElement,
  modeElement,
  debugElement,
  ufoSpeechElement,
  alienNoticeElement,
  logoUrl,
  devCharts,
  bugCharts,
  users,
  onFailure
}) {
  const startedAt = performance.now();
  const abortController = new AbortController();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.035, 300);
  const resizeObserver = new ResizeObserver(resize);
  const resources = new Set();
  const animatedLights = [];
  const backgroundEventRandom = seededRandom(0x51a7e4);
  const ufoStrikePosition = new THREE.Vector3();

  let environmentTexture = null;
  let flightController = null;
  let lightningEffect = null;
  let ufoEncounter = null;
  let backgroundComets = null;
  let logoGroup = null;
  let chartGallery = null;
  let frameId = 0;
  let lastFrameAt = startedAt;
  let introHiddenTimer = 0;
  let alienNoticeTimer = 0;
  let revealStartedAt = 0;
  let experienceStarted = false;
  let lightningEnabled = false;
  let sequence4UfoActive = false;
  let sequence4EventStartedAt = Number.NEGATIVE_INFINITY;
  let sequence4LogoStrikeDone = false;
  let sequence4UfoStrikePlanned = false;
  let sequence4UfoStrikeDone = false;
  let disposed = false;

  try {
    setupRenderer(renderer);
    setupScene(scene, renderer, resources, animatedLights);
    root.dataset.aboutFloorWidth = String(FLOOR_WIDTH);
    root.dataset.aboutFloorDepth = String(FLOOR_DEPTH);
    environmentTexture = createEnvironment(renderer);
    scene.environment = environmentTexture;
    scene.add(createStarField(resources));
    backgroundComets = createBackgroundComets(resources);
    scene.add(backgroundComets.group);
    root.dataset.aboutStarParticles = "fixed-distant-world-space";
    root.dataset.aboutShootingStars = "removed";
    root.dataset.aboutGalaxyBackground = "fixed-world-space";
    root.dataset.aboutCometPortalExit = "enabled";
    root.dataset.aboutCometSchedule = "random-background";
    root.dataset.aboutCometCameraInfluence = "none";
    root.dataset.aboutCometActive = "false";
    chartGallery = createAboutChartGallery({
      users,
      devCharts,
      bugCharts,
      resources,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy()
    });
    scene.add(chartGallery.group);
    root.dataset.aboutWorkloadBillboard = "ready";
    root.dataset.aboutWorkloadStyle = "dev-and-bug-charts";
    root.dataset.aboutWorkloadFrame = "none";
    root.dataset.aboutWorkloadPerimeter = "none";
    root.dataset.aboutWorkloadStand = "none";
    root.dataset.aboutWorkloadSheen = "subtle";
    root.dataset.aboutWorkloadDisplay = "floating-glass";
    root.dataset.aboutWorkloadGlass = "semi-transparent";
    root.dataset.aboutWorkloadChartContent = "opaque";
    root.dataset.aboutWorkloadColorOutput = "srgb-unlit";
    root.dataset.aboutWorkloadRows = String(devCharts.workload.rows.length);
    root.dataset.aboutDevChartCount = "4";
    root.dataset.aboutBugChartCount = "4";
    root.dataset.aboutDevChartGrid = "2x2";
    root.dataset.aboutBugChartGrid = "2x2";
    root.dataset.aboutWorkloadBillboardWidth = String(DEV_CHART_GRID_WIDTH);
    root.dataset.aboutWorkloadBillboardHeight = String(DEV_CHART_GRID_HEIGHT);
    root.dataset.aboutWorkloadBillboardZ = String(DEV_CHART_GRID_Z);
    root.dataset.aboutDevChartGridX = String(chartGallery.devGridX);
    root.dataset.aboutBugChartGridX = String(chartGallery.bugGridX);
    root.dataset.aboutBugChartGridStartX = String(chartGallery.bugGridStartX);
    root.dataset.aboutBugChartGridWidth = String(chartGallery.bugGridWidth);
    root.dataset.aboutBugChartIntersectionX = String(chartGallery.bugGridIntersectionX);
    root.dataset.aboutBugChartIntersectionZ = String(chartGallery.bugGridIntersectionZ);
    root.dataset.aboutBugChartRotationDegrees = String(chartGallery.bugGridRotationDegrees);
    root.dataset.aboutBugChartGrowthDirection = chartGallery.bugGrowthDirection;
    root.dataset.aboutGalleryRoomHalfWidth = String(chartGallery.roomHalfWidth);
    root.dataset.aboutGalleryRoomBackZ = String(chartGallery.roomBackZ);
    root.dataset.aboutTeamCardCount = String(users.length);
    root.dataset.aboutTeamCardColumns = String(chartGallery.teamColumns);
    root.dataset.aboutTeamCardRows = String(chartGallery.teamRows);
    root.dataset.aboutTeamGridWidth = String(chartGallery.teamGridWidth);
    root.dataset.aboutTeamGridHeight = String(chartGallery.teamGridHeight);
    root.dataset.aboutTeamGridX = String(chartGallery.teamGridX);
    root.dataset.aboutTeamGridY = String(chartGallery.teamGridY);
    root.dataset.aboutTeamGridZ = String(chartGallery.teamGridZ);
    root.dataset.aboutTeamGridIntersectionX = String(chartGallery.teamGridIntersectionX);
    root.dataset.aboutTeamGridIntersectionZ = String(chartGallery.teamGridIntersectionZ);
    root.dataset.aboutTeamGridRotationDegrees = String(chartGallery.teamGridRotationDegrees);
    root.dataset.aboutTeamGrowthDirection = chartGallery.teamGrowthDirection;
    ufoEncounter = createUfoEncounter({
      scene,
      resources,
      speechElement: ufoSpeechElement
    });
    ufoEncounter.setEnabled(false, 0);
    root.dataset.aboutCinematicEvents = "sequence-4-background-ufo";
    root.dataset.aboutUfoEnabled = "true";
    root.dataset.aboutUfoSchedule = "sequence-4-background";
    root.dataset.aboutUfoSequence4Active = "false";
    root.dataset.aboutUfoCameraTracking = "false";
    root.dataset.aboutUfoCameraInfluence = "none";
    root.dataset.aboutUfoSequence4Playback = "full-background-animation";
    root.dataset.aboutLightningEnabled = "true";
    root.dataset.aboutLightningSchedule = "sequence-4-background";
    root.dataset.aboutLightningCameraInfluence = "none";
    root.dataset.aboutLightningSceneFlash = "dramatic";
    root.dataset.aboutLightningUfoStrike = "random";
    root.dataset.aboutLightningUfoStrikeChance = String(SEQUENCE_4_UFO_STRIKE_CHANCE);
    root.dataset.aboutLightningUfoStrikePlanned = "false";
    root.dataset.aboutLightningActive = "false";
    root.dataset.aboutLightningStrikeCount = "0";
    root.dataset.aboutLightningUfoStrikeCount = "0";
    root.dataset.aboutLightningTarget = "";
    root.dataset.aboutMinCameraFloorClearance = String(MIN_CAMERA_FLOOR_CLEARANCE);

    camera.position.set(0, 1.5, 21);
    camera.lookAt(0, 0.35, 0);
    resizeObserver.observe(root);
    resize();

    canvas.addEventListener("webglcontextlost", onContextLost, {
      signal: abortController.signal
    });
    reducedMotionQuery.addEventListener("change", onReducedMotionChange, {
      signal: abortController.signal
    });
    window.addEventListener("keydown", onAlienToggleKeyDown, {
      signal: abortController.signal
    });
    window.addEventListener("keydown", onLightningToggleKeyDown, {
      signal: abortController.signal
    });

    root.classList.add("about-flight-rendering");
    frameId = requestAnimationFrame(animate);
    void loadLogo();
  } catch (error) {
    dispose();
    throw error;
  }

  async function loadLogo() {
    try {
      const svg = await new SVGLoader().loadAsync(logoUrl);
      if (disposed) return;

      const model = createExtrudedLogo(svg, resources);
      logoGroup = model.group;
      const naturalBounds = new THREE.Box3().setFromObject(logoGroup);
      const groundClearance = 0.045;
      const logoGroundOffset = FLOOR_Y - naturalBounds.min.y + groundClearance;
      logoGroup.position.y = logoGroundOffset;
      logoGroup.scale.setScalar(0.9);
      scene.add(logoGroup);
      lightningEffect = createLogoLightningEffect({
        scene,
        resources,
        targets: model.letterTargets
      });
      lightningEffect.setEnabled(false, 0);
      const groundedPortal = model.portal.clone();
      groundedPortal.y += logoGroundOffset;
      const sceneFocus = new THREE.Vector3(0, logoGroundOffset, 0);
      const ufoSceneOffset = ufoEncounter?.setSceneOffset(logoGroundOffset) || 0;
      root.dataset.aboutLogoGrounded = "true";
      root.dataset.aboutLogoFloorGap = String(groundClearance);
      root.dataset.aboutSceneOffset = String(logoGroundOffset);
      root.dataset.aboutUfoSceneOffset = String(ufoSceneOffset);

      flightController = createAboutFlightController({
        camera,
        canvas,
        root,
        portal: groundedPortal,
        billboardTarget: chartGallery.devTarget,
        billboardTargets: chartGallery.devTargets,
        devDestinationLabels: chartGallery.devLabels,
        devDestinationWidths: chartGallery.devWidths,
        secondaryTarget: chartGallery.bugTarget,
        secondaryTargets: chartGallery.bugTargets,
        bugDestinationLabels: chartGallery.bugLabels,
        bugDestinationWidths: chartGallery.bugWidths,
        galleryRoomBackZ: chartGallery.roomBackZ,
        sceneFocus,
        minimumCameraY: FLOOR_Y + MIN_CAMERA_FLOOR_CLEARANCE,
        statusElement,
        modeElement,
        debugElement,
        reducedMotion
      });

      if (performance.now() - startedAt >= INTRO_DURATION_MS) {
        beginExperience(performance.now());
      }
    } catch {
      fail("3D rendering is unavailable. The original PMT logo is shown instead.");
    }
  }

  function animate(now) {
    if (disposed) return;
    if (!root.isConnected) {
      dispose();
      return;
    }

    const deltaSeconds = Math.min((now - lastFrameAt) / 1000, 0.05);
    lastFrameAt = now;
    updateIntro(now);
    const encounter = updateSceneMotion(now);
    if (encounter?.shadowUpdate) renderer.shadowMap.needsUpdate = true;
    flightController?.setCinematicFocus(null, 0, 1);
    flightController?.update(now, deltaSeconds);
    ufoEncounter?.updateSpeech(camera, root);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  }

  function updateIntro(now) {
    if (experienceStarted) return;
    const elapsed = now - startedAt;
    const remaining = Math.max(0, Math.ceil((INTRO_DURATION_MS - elapsed) / 1000));

    if (remaining > 0) {
      setText(introCountdownElement, `3D flight begins in ${remaining}`);
      return;
    }

    if (!flightController) {
      setText(introCountdownElement, "Finishing the glass logo…");
      return;
    }

    beginExperience(now);
  }

  function beginExperience(now) {
    if (experienceStarted || disposed || !flightController) return;
    experienceStarted = true;
    revealStartedAt = now;
    root.classList.add("about-flight-started");
    introElement.setAttribute("aria-hidden", "true");
    flightController.startAutopilot();
    introHiddenTimer = window.setTimeout(() => {
      if (!disposed) introElement.hidden = true;
    }, reducedMotion ? 0 : INTRO_FADE_DURATION_MS);
  }

  function updateSceneMotion(now) {
    const seconds = now / 1000;
    const portalAttention = Number(root.dataset.aboutPortalFlybyAttention || 0);
    const cometActive = backgroundComets?.update?.(
      seconds,
      reducedMotion,
      portalAttention
    ) || false;
    root.dataset.aboutCometActive = String(cometActive);
    if (!reducedMotion) {
      for (let index = 0; index < animatedLights.length; index += 1) {
        const light = animatedLights[index];
        light.intensity = light.userData.baseIntensity
          * (0.9 + Math.sin(seconds * light.userData.speed + index) * 0.1);
      }
    }

    if (logoGroup && experienceStarted) {
      const progress = reducedMotion
        ? 1
        : THREE.MathUtils.clamp((now - revealStartedAt) / 1500, 0, 1);
      const scale = THREE.MathUtils.lerp(0.9, 1, smootherStep(progress));
      logoGroup.scale.setScalar(scale);
      if (progress >= 1 && renderer.shadowMap.autoUpdate) {
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
      }
    }

    const encounterElapsed = experienceStarted ? (now - revealStartedAt) / 1000 : -1;
    const sequence4Active = SEQUENCE_4_BACKGROUND_UFO_ENABLED
      && root.dataset.aboutFlightSequenceStage === "return-initial";
    if (sequence4Active && !sequence4UfoActive) {
      ufoEncounter?.startNow(encounterElapsed);
      lightningEffect?.setEnabled(true, encounterElapsed);
      sequence4EventStartedAt = encounterElapsed;
      sequence4LogoStrikeDone = false;
      sequence4UfoStrikePlanned = backgroundEventRandom() < SEQUENCE_4_UFO_STRIKE_CHANCE;
      sequence4UfoStrikeDone = false;
      root.dataset.aboutLightningUfoStrikePlanned = String(sequence4UfoStrikePlanned);
    } else if (!sequence4Active && sequence4UfoActive) {
      ufoEncounter?.setEnabled(false, encounterElapsed);
      lightningEffect?.setEnabled(false, encounterElapsed);
    }
    sequence4UfoActive = sequence4Active;
    root.dataset.aboutUfoSequence4Active = String(sequence4Active);
    root.dataset.aboutUfoConvenientWindow = String(sequence4Active);
    const encounter = ufoEncounter?.update(
      encounterElapsed,
      reducedMotion,
      sequence4Active
    ) || null;
    const sequence4EventAge = sequence4Active
      ? encounterElapsed - sequence4EventStartedAt
      : -1;
    if (sequence4Active
      && !sequence4LogoStrikeDone
      && sequence4EventAge >= SEQUENCE_4_LOGO_STRIKE_SECONDS) {
      sequence4LogoStrikeDone = true;
      lightningEffect?.triggerStrike(encounterElapsed);
    }
    if (sequence4Active
      && sequence4UfoStrikePlanned
      && !sequence4UfoStrikeDone
      && sequence4EventAge >= SEQUENCE_4_UFO_STRIKE_SECONDS
      && ufoEncounter?.getStrikePosition(ufoStrikePosition)) {
      sequence4UfoStrikeDone = true;
      lightningEffect?.triggerStrike(encounterElapsed, ufoStrikePosition, "UFO");
      ufoEncounter.reactToLightning();
      root.dataset.aboutLightningUfoStrikeCount = String(
        Number(root.dataset.aboutLightningUfoStrikeCount || 0) + 1
      );
    }
    const lightning = lightningEffect?.update(
      encounterElapsed,
      reducedMotion,
      true
    ) || null;
    if (lightning) {
      root.dataset.aboutLightningActive = String(lightning.active);
      root.dataset.aboutLightningStrikeCount = String(lightning.strikeCount);
      root.dataset.aboutLightningTarget = lightning.target;
      if (lightning.active) renderer.shadowMap.needsUpdate = true;
    }
    root.dataset.aboutLightningConvenientWindow = "false";
    return encounter;
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function onContextLost(event) {
    event.preventDefault();
    fail("The 3D renderer stopped. The original PMT logo is shown instead.");
  }

  function onReducedMotionChange(event) {
    reducedMotion = event.matches;
    flightController?.setReducedMotion(reducedMotion);
    if (reducedMotion && logoGroup) {
      logoGroup.scale.setScalar(1);
      renderer.shadowMap.needsUpdate = true;
    }
  }

  function onAlienToggleKeyDown(event) {
    if (SEQUENCE_4_BACKGROUND_UFO_ENABLED
      && event.code === "KeyA"
      && !isTypingTarget(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showEffectNotice(
        "Alien encounter runs automatically in the background during Sequence 4",
        true,
        "alien"
      );
      return;
    }
    if (event.code !== "KeyA"
      || event.repeat
      || event.ctrlKey
      || event.metaKey
      || event.altKey
      || isTypingTarget(event.target)
      || root.dataset.flightMode === "manual") return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const enabled = root.dataset.aboutUfoEnabled !== "true";
    const encounterElapsed = experienceStarted
      ? Math.max(0, (performance.now() - revealStartedAt) / 1000)
      : 0;
    ufoEncounter?.setEnabled(enabled, encounterElapsed);
    root.dataset.aboutUfoEnabled = String(enabled);
    showAlienNotice(enabled);
  }

  function showAlienNotice(enabled) {
    showEffectNotice(
      enabled ? "Alien encounters ON \u2022 press A to turn off" : "Alien encounters OFF \u2022 press A to turn on",
      enabled,
      "alien"
    );
  }

  function onLightningToggleKeyDown(event) {
    if (!LIGHTNING_EVENTS_ENABLED && event.code === "KeyL" && !isTypingTarget(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showEffectNotice(
        "Lightning runs automatically in the background during Sequence 4",
        true,
        "lightning"
      );
      return;
    }
    if (event.code !== "KeyL"
      || event.repeat
      || event.ctrlKey
      || event.metaKey
      || event.altKey
      || isTypingTarget(event.target)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    lightningEnabled = !lightningEnabled;
    const encounterElapsed = experienceStarted
      ? Math.max(0, (performance.now() - revealStartedAt) / 1000)
      : 0;
    lightningEffect?.setEnabled(lightningEnabled, encounterElapsed);
    root.dataset.aboutLightningEnabled = String(lightningEnabled);
    if (!lightningEnabled) {
      root.dataset.aboutLightningActive = "false";
      root.dataset.aboutLightningTarget = "";
    }
    showEffectNotice(
      lightningEnabled ? "Lightning ON \u2022 strikes every 45\u201365s" : "Lightning OFF \u2022 press L to turn on",
      lightningEnabled,
      "lightning"
    );
  }

  function showEffectNotice(message, enabled, effect) {
    window.clearTimeout(alienNoticeTimer);
    alienNoticeElement.textContent = message;
    alienNoticeElement.dataset.enabled = String(enabled);
    alienNoticeElement.dataset.effect = effect;
    alienNoticeElement.hidden = false;
    alienNoticeTimer = window.setTimeout(() => {
      if (!disposed) alienNoticeElement.hidden = true;
    }, 2600);
  }

  function fail(message) {
    if (disposed) return;
    onFailure(message);
    dispose();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frameId);
    window.clearTimeout(introHiddenTimer);
    window.clearTimeout(alienNoticeTimer);
    abortController.abort();
    resizeObserver.disconnect();
    flightController?.dispose();
    flightController = null;
    lightningEffect?.dispose();
    lightningEffect = null;
    chartGallery?.dispose();
    chartGallery = null;
    ufoEncounter?.dispose();
    ufoEncounter = null;

    const disposableResources = collectSceneResources(scene, resources);
    for (const resource of disposableResources) resource.dispose?.();
    environmentTexture?.dispose();
    environmentTexture = null;
    scene.environment = null;
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { dispose };
}

function createRenderer(canvas) {
  const contextAttributes = {
    alpha: false,
    antialias: true,
    depth: true,
    powerPreference: "high-performance"
  };
  const context = canvas.getContext("webgl2", contextAttributes);
  if (!context) throw new Error("WebGL is unavailable.");

  try {
    return new THREE.WebGLRenderer({
      canvas,
      context,
      ...contextAttributes
    });
  } catch {
    throw new Error("WebGL is unavailable.");
  }
}

function setupRenderer(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.transmissionResolutionScale = 0.7;
}

function setupScene(scene, renderer, resources, animatedLights) {
  scene.background = new THREE.Color(0x030711);
  scene.fog = new THREE.FogExp2(0x030711, 0.017);

  const hemisphere = new THREE.HemisphereLight(0xa8d8ff, 0x07101d, 1.35);
  scene.add(hemisphere);

  // A higher sun keeps the logo's projected shadow close to the model and inside
  // the camera's normal framing instead of stretching it underneath the viewer.
  const sunPosition = new THREE.Vector3(-10, 14, 20).normalize().multiplyScalar(34);
  const keyLight = new THREE.DirectionalLight(0xfff1ce, 4.8);
  keyLight.position.copy(sunPosition);
  keyLight.target.position.set(0, 0, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 70;
  keyLight.shadow.camera.left = -14;
  keyLight.shadow.camera.right = 14;
  keyLight.shadow.camera.top = 14;
  keyLight.shadow.camera.bottom = -14;
  keyLight.shadow.bias = -0.00015;
  keyLight.shadow.normalBias = 0.025;
  keyLight.shadow.radius = 2.2;
  scene.add(keyLight, keyLight.target, createVisibleSun(sunPosition, resources));

  const blueRim = new THREE.SpotLight(0x2686fe, 210, 65, Math.PI / 5, 0.75, 2);
  blueRim.position.set(-13, 8, 13);
  blueRim.target.position.set(0, 0, 0);
  blueRim.userData.baseIntensity = blueRim.intensity;
  blueRim.userData.speed = 0.75;
  scene.add(blueRim, blueRim.target);
  animatedLights.push(blueRim);

  const redFill = new THREE.PointLight(0xea4335, 52, 32, 2);
  redFill.position.set(11, 1, 7);
  redFill.userData.baseIntensity = redFill.intensity;
  redFill.userData.speed = 0.6;
  scene.add(redFill);
  animatedLights.push(redFill);

  const goldFill = new THREE.PointLight(0xfbbc05, 42, 28, 2);
  goldFill.position.set(2, -2, -10);
  goldFill.userData.baseIntensity = goldFill.intensity;
  goldFill.userData.speed = 0.9;
  scene.add(goldFill);
  animatedLights.push(goldFill);

  const floorGeometry = new THREE.PlaneGeometry(FLOOR_WIDTH, FLOOR_DEPTH);
  const floorMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x07111f,
    metalness: 0.72,
    roughness: 0.24,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  // Preserve the reflective PBR floor while darkening only pixels touched by the
  // real directional-light shadow map. The tiny offset prevents z-fighting.
  const shadowCatcherMaterial = new THREE.ShadowMaterial({
    color: 0x00030a,
    opacity: 0.42,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const shadowCatcher = new THREE.Mesh(floorGeometry, shadowCatcherMaterial);
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = FLOOR_Y + 0.008;
  shadowCatcher.receiveShadow = true;
  shadowCatcher.renderOrder = 1;
  scene.add(shadowCatcher);
  resources.add(floorGeometry);
  resources.add(floorMaterial);
  resources.add(shadowCatcherMaterial);

  renderer.setClearColor(scene.background, 1);
}

function createEnvironment(renderer) {
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  generator.compileCubemapShader();
  const texture = generator.fromScene(room, 0.04).texture;
  room.dispose();
  generator.dispose();
  return texture;
}

function createExtrudedLogo(svg, resources) {
  const sourceGroup = new THREE.Group();
  const letterTargets = [];
  let portalSource = FALLBACK_PORTAL.clone();

  for (const path of svg.paths) {
    if (path.userData?.style?.visibility === "hidden") continue;
    const shapes = path.toShapes();
    if (!shapes.length) continue;

    const geometry = new THREE.ExtrudeGeometry(shapes, {
      curveSegments: 8,
      steps: 1,
      depth: EXTRUDE_DEPTH,
      bevelEnabled: true,
      bevelThickness: 4,
      bevelSize: 4,
      bevelOffset: 0,
      bevelSegments: 3
    });
    geometry.computeVertexNormals();

    const material = createLogoMaterial(path);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const label = path.userData?.node?.getAttribute("aria-label") || "";
    if (["P", "M", "T"].includes(label)) {
      mesh.userData.logoLetter = label;
      letterTargets.push({ label, mesh });
    }
    sourceGroup.add(mesh);
    resources.add(geometry);
    resources.add(material);

    if (label === "P") {
      portalSource = largestHoleCenter(shapes) || portalSource;
    }
  }

  const unscaledBounds = new THREE.Box3().setFromObject(sourceGroup);
  const scale = LOGO_WORLD_WIDTH / unscaledBounds.getSize(new THREE.Vector3()).x;
  // SVG coordinates point down and ExtrudeGeometry's readable face starts at z=0.
  // Flip y for the SVG axis and z so the logo reads correctly from the opening shot.
  sourceGroup.scale.set(scale, -scale, -scale);

  const scaledBounds = new THREE.Box3().setFromObject(sourceGroup);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  sourceGroup.position.sub(center);

  const group = new THREE.Group();
  group.add(sourceGroup);
  return {
    group,
    letterTargets,
    portal: new THREE.Vector3(
      portalSource.x * scale + sourceGroup.position.x,
      -portalSource.y * scale + sourceGroup.position.y,
      0
    )
  };
}

function sourceColor(path) {
  if (path.color?.isColor) return path.color.clone();
  const fill = path.userData?.style?.fill;
  return new THREE.Color(fill && fill !== "none" ? fill : 0x2686fe);
}

function createLogoMaterial(path) {
  const color = sourceColor(path);
  return new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.035,
    metalness: 0.04,
    roughness: 0.11,
    transmission: 0.78,
    thickness: 56,
    ior: 1.46,
    attenuationColor: color,
    attenuationDistance: 2.8,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    specularColor: 0xffffff,
    envMapIntensity: 1.7,
    side: THREE.DoubleSide
  });
}

function largestHoleCenter(shapes) {
  let largestArea = 0;
  let center = null;

  for (const shape of shapes) {
    for (const hole of shape.holes) {
      const points = hole.getSpacedPoints(64);
      const bounds = new THREE.Box2().setFromPoints(points);
      const size = bounds.getSize(new THREE.Vector2());
      const area = size.x * size.y;
      if (area <= largestArea) continue;
      largestArea = area;
      center = bounds.getCenter(new THREE.Vector2());
    }
  }

  return center;
}

function createStarField(resources) {
  const random = seededRandom(0x2686fe);
  const group = new THREE.Group();
  group.name = "PMT Fixed Distant Galaxy";
  const background = createFixedStarLayer({
    count: 1250,
    random,
    radiusMin: 175,
    radiusMax: 235,
    galaxyBand: false,
    resources
  });
  const galaxy = createFixedStarLayer({
    count: 850,
    random,
    radiusMin: 185,
    radiusMax: 225,
    galaxyBand: true,
    resources
  });
  galaxy.rotation.set(0.58, -0.18, 0.22);
  group.add(background, galaxy);
  return group;
}

function createFixedStarLayer({
  count,
  random,
  radiusMin,
  radiusMax,
  galaxyBand,
  resources
}) {
  const positions = [];
  const colors = [];
  const blue = new THREE.Color(galaxyBand ? 0x7895ff : 0x9ecbff);
  const white = new THREE.Color(0xf6fbff);
  const violet = new THREE.Color(0xb99cff);

  for (let index = 0; index < count; index += 1) {
    const radius = THREE.MathUtils.lerp(radiusMin, radiusMax, random());
    const theta = random() * TAU;
    const phi = galaxyBand
      ? Math.PI / 2 + (random() - 0.5) * 0.22
      : Math.acos(2 * random() - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    const color = blue.clone().lerp(white, random() * 0.84);
    if (galaxyBand && random() > 0.7) color.lerp(violet, 0.52);
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: galaxyBand ? 0.72 : 0.58,
    sizeAttenuation: true,
    transparent: true,
    opacity: galaxyBand ? 0.78 : 0.68,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  resources.add(geometry);
  resources.add(material);
  return points;
}

function createTwinklingStars({ count, random, galaxyBand, resources }) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const phases = [];
  const speeds = [];
  const blue = new THREE.Color(galaxyBand ? 0x6d8dff : 0x75b7ff);
  const violet = new THREE.Color(0xb49bff);
  const white = new THREE.Color(0xf2fbff);
  const warm = new THREE.Color(0xffe2ae);

  for (let index = 0; index < count; index += 1) {
    if (galaxyBand) {
      const radius = 31 + random() * 47;
      const theta = random() * TAU;
      const spiral = theta + radius * 0.018;
      positions.push(
        Math.cos(spiral) * radius,
        (random() - 0.5) * (3.2 + radius * 0.055),
        Math.sin(spiral) * radius
      );
    } else {
      const radius = 28 + random() * 54;
      const theta = random() * TAU;
      const phi = Math.acos(2 * random() - 1);
      positions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }

    let color = blue.clone().lerp(white, random() * 0.78);
    if (galaxyBand && random() > 0.72) color = color.lerp(violet, 0.58);
    if (random() > 0.96) color = color.lerp(warm, 0.55);
    colors.push(color.r, color.g, color.b);
    sizes.push((galaxyBand ? 0.72 : 0.58) + random() * (galaxyBand ? 1.35 : 1.15));
    phases.push(random() * TAU);
    speeds.push(0.65 + random() * 2.25);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.Float32BufferAttribute(speeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aPhase;
      attribute float aSpeed;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        vAlpha = 0.52 + 0.48 * sin(uTime * aSpeed + aPhase);
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * uPixelRatio * (175.0 / max(1.0, -viewPosition.z)), 1.0, 8.5);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
        float core = 1.0 - smoothstep(0.05, 0.5, distanceFromCenter);
        float halo = 1.0 - smoothstep(0.18, 0.5, distanceFromCenter);
        float alpha = (core * 0.78 + halo * 0.4) * (0.45 + vAlpha * 0.55);
        if (alpha < 0.025) discard;
        gl_FragColor = vec4(vColor * (1.0 + core * 0.32), alpha);
      }
    `,
    transparent: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  resources.add(geometry);
  resources.add(material);
  return new THREE.Points(geometry, material);
}

function createBackgroundComets(resources) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 512;
  textureCanvas.height = 32;
  const context = textureCanvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, textureCanvas.width, 0);
  gradient.addColorStop(0, "rgba(80, 158, 255, 0)");
  gradient.addColorStop(0.72, "rgba(126, 198, 255, 0.28)");
  gradient.addColorStop(0.94, "rgba(224, 247, 255, 0.96)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 1)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  resources.add(texture);

  const definitions = [
    { start: [-115, 62, -165], end: [-55, 15, -220], duration: 2.2, rotation: -0.35 },
    { start: [150, 80, -130], end: [70, 20, -220], duration: 2.6, rotation: 0.38 },
    { start: [-170, 65, 20], end: [-85, 15, -160], duration: 2.8, rotation: -0.28 },
    { start: [120, 95, 110], end: [40, 20, -100], duration: 2.5, rotation: 0.42 }
  ];
  const group = new THREE.Group();
  const streaks = definitions.map(definition => {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xdaf3ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      rotation: definition.rotation
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(18, 0.72, 1);
    sprite.visible = false;
    group.add(sprite);
    resources.add(material);
    return {
      ...definition,
      start: new THREE.Vector3(...definition.start),
      end: new THREE.Vector3(...definition.end),
      sprite
    };
  });
  const random = seededRandom(0xc0ffee);
  const createdAt = performance.now() / 1000;
  let portalWasActive = false;
  let portalCometPending = false;
  let activeStreak = null;
  let activeStartedAt = 0;
  let nextRandomAt = 20 + random() * 24;

  function startStreak(index, elapsed) {
    activeStreak = streaks[index];
    activeStartedAt = elapsed;
    activeStreak.sprite.visible = true;
  }

  return {
    group,
    update(seconds, reducedMotion, portalAttention) {
      const elapsed = Math.max(0, seconds - createdAt);
      if (portalAttention >= 0.15) portalWasActive = true;
      if (portalWasActive && portalAttention <= 0.04) {
        portalWasActive = false;
        portalCometPending = true;
      }

      for (const streak of streaks) streak.sprite.visible = false;
      if (reducedMotion) return false;

      if (!activeStreak && portalCometPending) {
        portalCometPending = false;
        startStreak(0, elapsed);
      } else if (!activeStreak && elapsed >= nextRandomAt) {
        startStreak(1 + Math.floor(random() * (streaks.length - 1)), elapsed);
      }

      if (!activeStreak) return false;
      const progress = THREE.MathUtils.clamp(
        (elapsed - activeStartedAt) / activeStreak.duration,
        0,
        1
      );
      const eased = smootherStep(progress);
      activeStreak.sprite.visible = true;
      activeStreak.sprite.position.lerpVectors(activeStreak.start, activeStreak.end, eased);
      activeStreak.sprite.material.opacity = Math.sin(progress * Math.PI) * 0.94;
      activeStreak.sprite.scale.x = 17 + progress * 11;
      if (progress >= 1) {
        activeStreak.sprite.visible = false;
        activeStreak = null;
        nextRandomAt = elapsed + 24 + random() * 22;
      }
      return Boolean(activeStreak);
    }
  };
}

function createVisibleSun(position, resources) {
  const group = new THREE.Group();
  group.position.copy(position);

  const coreGeometry = new THREE.SphereGeometry(0.62, 24, 16);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff4c7,
    fog: false,
    toneMapped: false
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  group.add(core);
  resources.add(coreGeometry);
  resources.add(coreMaterial);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const context = glowCanvas.getContext("2d");
  const glow = context.createRadialGradient(128, 128, 12, 128, 128, 128);
  glow.addColorStop(0, "rgba(255, 255, 244, 1)");
  glow.addColorStop(0.16, "rgba(255, 235, 166, 0.98)");
  glow.addColorStop(0.42, "rgba(255, 184, 74, 0.45)");
  glow.addColorStop(1, "rgba(255, 150, 40, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 256, 256);

  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const glowSprite = new THREE.Sprite(glowMaterial);
  glowSprite.scale.set(4.4, 4.4, 1);
  group.add(glowSprite);
  resources.add(glowTexture);
  resources.add(glowMaterial);

  return group;
}

function collectSceneResources(scene, resources) {
  scene.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    if (Array.isArray(object.material)) {
      for (const material of object.material) resources.add(material);
    } else if (object.material) {
      resources.add(object.material);
    }
  });
  return resources;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function smootherStep(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}

function isTypingTarget(target) {
  return target instanceof Element
    && (
      target.matches("input, select, textarea, button, a[href]")
      || target.closest("[contenteditable='true'], [role='button'], [role='menuitem']")
    );
}

const TAU = Math.PI * 2;
