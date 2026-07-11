import * as THREE from "../../vendor/three/three.module.min.js";

export const UFO_FIRST_DELAY_MIN_SECONDS = 12;
export const UFO_FIRST_DELAY_MAX_SECONDS = 22;
export const UFO_IDLE_MIN_SECONDS = 45;
export const UFO_IDLE_MAX_SECONDS = 75;
const CAMERA_LEAD_SECONDS = 1.75;
const CAMERA_RELEASE_SECONDS = 1.75;
const ARRIVAL_SPEED_SCALE = 0.55;
const ORBIT_END = 9.5;
const SETTLE_END = 11;
const BEAM_EXTEND_END = 12;
const BEAM_PULSE_END = 17;
const BEAM_RETRACT_END = 18.2;
const DEPART_END = 21.2;
const SPEECH_START = 14.1;
const SPEECH_END = 17.8;
const SPEECH_LINES = [
  "Wow, JIRA + Confluence all-in-one?\nSuch advanced civilization!",
  "Dev Tasks, Bug Tracking with Charts!\nI need to tell the others!",
  "I travel the galaxy for treasures\nsuch as this!",
  "If we had tools like these, we\nwould be gods by now!",
  "Who is the awesome guy who made\nthis tool?  I will travel back in\ntime to meet him!",
  "What?  This tool is free?\nHow crazy is that!",
  "Our invasion plan has 47 blockers.\nCan PMT assign those too?",
  "Forget abducting cows.\nWe are abducting this Road Map!",
  "Scan complete! Their backlog is\nmore organized than our star charts!",
  "One small tool for a team,\none giant leap for project management!"
];

export function createUfoEncounter({ scene, resources, speechElement }) {
  const random = seededRandom(0xa11e6a1);
  const ship = createShip(resources);
  const beam = createBeam(resources);
  const scanLight = new THREE.SpotLight(0x9fe7ff, 0, 11, 0.43, 0.72, 1.7);
  const scanTarget = new THREE.Object3D();
  const focus = new THREE.Vector3();
  const speechAnchor = new THREE.Vector3();
  const projectedSpeech = new THREE.Vector3();
  const stopPosition = new THREE.Vector3(0, 5.8, 0.7);
  let sceneOffsetY = 0;
  let enabled = true;
  let enabledAt = 0;
  let nextEncounterAt = ufoFirstDelay(random);
  let encounterLeadStartedAt = null;
  let encounterIndex = 0;
  let pendingShadowUpdate = false;
  let orbitCurve = createOrbitCurve(stopPosition, sceneOffsetY);
  let departureCurve = createDepartureCurve(stopPosition, sceneOffsetY);
  const state = {
    focus,
    attention: 0,
    speedScale: 1,
    shadowUpdate: false
  };
  let activeSpeechIndex = -1;

  ship.add(beam.group, scanLight);
  scanLight.position.set(0, -0.1, 0);
  scanLight.target = scanTarget;
  scanTarget.position.set(0, 0, 0);
  scene.add(ship, scanTarget);
    setShipVisible(false);
    hideSpeech();

  function setSceneOffset(offsetY) {
    sceneOffsetY = Number(offsetY || 0);
    stopPosition.y = 5.8 + sceneOffsetY;
    scanTarget.position.y = sceneOffsetY;
    orbitCurve = createOrbitCurve(stopPosition, sceneOffsetY);
    departureCurve = createDepartureCurve(stopPosition, sceneOffsetY);
    return sceneOffsetY;
  }

  function setEnabled(value, elapsedSeconds = 0) {
    const nextEnabled = Boolean(value);
    if (enabled === nextEnabled) return enabled;
    enabled = nextEnabled;
    pendingShadowUpdate = true;
    hideSpeech();

    if (enabled) {
      enabledAt = Math.max(0, Number(elapsedSeconds || 0));
      nextEncounterAt = ufoFirstDelay(random);
      encounterLeadStartedAt = null;
      setElapsedTime(0);
    } else {
      setShipVisible(false);
      beam.group.visible = false;
      scanLight.intensity = 0;
      setElapsedTime(-1);
    }
    return enabled;
  }

  function update(elapsedSeconds, reducedMotion, canBeginEncounter = true) {
    state.attention = 0;
    state.speedScale = 1;
    state.shadowUpdate = pendingShadowUpdate;
    pendingShadowUpdate = false;
    beam.group.visible = false;
    scanLight.intensity = 0;

    if (!enabled || reducedMotion || elapsedSeconds < 0) {
      setShipVisible(false);
      setElapsedTime(-1);
      hideSpeech();
      return state;
    }

    const activeElapsedSeconds = Math.max(0, elapsedSeconds - enabledAt);
    if (encounterLeadStartedAt === null) {
      if (activeElapsedSeconds < nextEncounterAt || !canBeginEncounter) {
        setShipVisible(false);
        setElapsedTime(-1);
        hideSpeech();
        return state;
      }
      encounterLeadStartedAt = activeElapsedSeconds;
      selectSpeech(encounterIndex);
    }

    const time = activeElapsedSeconds - encounterLeadStartedAt - CAMERA_LEAD_SECONDS;
    setElapsedTime(time);

    if (time < 0) {
      setShipVisible(false);
      hideSpeech();
      setShipOnCurve(orbitCurve, 0);
      updateFocus();

      const progress = smootherStep((time + CAMERA_LEAD_SECONDS) / CAMERA_LEAD_SECONDS);
      state.attention = progress;
      state.speedScale = THREE.MathUtils.lerp(1, ARRIVAL_SPEED_SCALE, progress);
      return state;
    }

    if (time >= DEPART_END + CAMERA_RELEASE_SECONDS) {
      encounterLeadStartedAt = null;
      encounterIndex += 1;
      nextEncounterAt = activeElapsedSeconds + ufoIdleDelay(random);
      setShipVisible(false);
      hideSpeech();
      setShipOnCurve(departureCurve, 1);
      updateFocus();
      return state;
    }

    if (time >= DEPART_END) {
      setShipVisible(false);
      hideSpeech();
      setShipOnCurve(departureCurve, 1);
      updateFocus();
      const progress = smootherStep((time - DEPART_END) / CAMERA_RELEASE_SECONDS);
      state.attention = 1 - progress;
      state.speedScale = THREE.MathUtils.lerp(ARRIVAL_SPEED_SCALE, 1, progress);
      return state;
    }

    setShipVisible(true);
    if (time < ORBIT_END) {
      const progress = smootherStep(time / ORBIT_END);
      setShipOnCurve(orbitCurve, progress);
    } else if (time < BEAM_RETRACT_END) {
      const hover = Math.sin((time - ORBIT_END) * 2.6) * 0.08;
      ship.position.copy(stopPosition);
      ship.position.y += hover;
    } else {
      const rawProgress = (time - BEAM_RETRACT_END) / (DEPART_END - BEAM_RETRACT_END);
      setShipOnCurve(departureCurve, rawProgress * rawProgress);
    }

    ship.rotation.set(0, time * 0.16, 0);
    updateBeam(time);
    updateAttention(time);
    updateSpeechVisibility(time);
    updateFocus();
    return state;
  }

  function updateFocus() {
    focus.copy(ship.position);
    focus.y -= 1.65;
  }

  function setShipOnCurve(curve, progress) {
    curve.getPointAt(THREE.MathUtils.clamp(progress, 0, 1), ship.position);
  }

  function setShipVisible(visible) {
    const changed = ship.visible !== visible;
    ship.visible = visible;
    state.shadowUpdate = state.shadowUpdate || visible || changed;
  }

  function updateBeam(time) {
    let beamScale = 0;
    let pulse = 0;

    if (time >= SETTLE_END && time < BEAM_EXTEND_END) {
      beamScale = smootherStep((time - SETTLE_END) / (BEAM_EXTEND_END - SETTLE_END));
    } else if (time >= BEAM_EXTEND_END && time < BEAM_PULSE_END) {
      beamScale = 1;
      pulse = 0.5 + Math.sin((time - BEAM_EXTEND_END) * Math.PI * 3.2) * 0.5;
    } else if (time >= BEAM_PULSE_END && time < BEAM_RETRACT_END) {
      beamScale = 1 - smootherStep(
        (time - BEAM_PULSE_END) / (BEAM_RETRACT_END - BEAM_PULSE_END)
      );
    }

    if (beamScale <= 0) return;
    beam.group.visible = true;
    beam.group.scale.y = beamScale;
    beam.material.opacity = 0.14 + pulse * 0.12;
    scanLight.intensity = beamScale * (55 + pulse * 35);
  }

  function updateAttention(time) {
    state.attention = 1;

    if (time < ORBIT_END) {
      state.speedScale = ARRIVAL_SPEED_SCALE;
      return;
    }

    if (time < SETTLE_END) {
      const progress = smootherStep((time - ORBIT_END) / (SETTLE_END - ORBIT_END));
      state.speedScale = THREE.MathUtils.lerp(ARRIVAL_SPEED_SCALE, 0.2, progress);
      return;
    }

    if (time < BEAM_RETRACT_END) {
      state.speedScale = 0.2;
      return;
    }

    const progress = smootherStep((time - BEAM_RETRACT_END) / (DEPART_END - BEAM_RETRACT_END));
    state.speedScale = THREE.MathUtils.lerp(0.2, ARRIVAL_SPEED_SCALE, progress);
  }

  function updateSpeechVisibility(time) {
    if (time >= SPEECH_START && time < SPEECH_END) return;
    hideSpeech();
  }

  function updateSpeech(camera, root) {
    if (!ship.visible) {
      hideSpeech();
      return;
    }

    const elapsedTime = Number(ship.userData.encounterTime || 0);
    if (elapsedTime < SPEECH_START || elapsedTime >= SPEECH_END) {
      hideSpeech();
      return;
    }

    speechAnchor.copy(ship.position);
    speechAnchor.y += 1.45;
    projectedSpeech.copy(speechAnchor).project(camera);
    if (projectedSpeech.z < -1 || projectedSpeech.z > 1) {
      hideSpeech();
      return;
    }

    const rawX = (projectedSpeech.x * 0.5 + 0.5) * root.clientWidth;
    const rawY = (-projectedSpeech.y * 0.5 + 0.5) * root.clientHeight;
    const horizontalMargin = Math.min(180, root.clientWidth / 2);
    const x = THREE.MathUtils.clamp(
      rawX,
      horizontalMargin,
      Math.max(horizontalMargin, root.clientWidth - horizontalMargin)
    );
    const y = THREE.MathUtils.clamp(rawY, Math.min(112, root.clientHeight / 2), root.clientHeight - 24);
    speechElement.style.setProperty("--ufo-speech-x", `${x}px`);
    speechElement.style.setProperty("--ufo-speech-y", `${y}px`);
    speechElement.hidden = false;
  }

  function setElapsedTime(elapsedSeconds) {
    ship.userData.encounterTime = elapsedSeconds;
  }

  function selectSpeech(encounterIndex) {
    const nextIndex = ((encounterIndex % SPEECH_LINES.length) + SPEECH_LINES.length)
      % SPEECH_LINES.length;
    if (nextIndex === activeSpeechIndex) return;
    activeSpeechIndex = nextIndex;
    speechElement.textContent = ufoSpeechForEncounter(encounterIndex);
  }

  function hideSpeech() {
    speechElement.hidden = true;
  }

  function dispose() {
    hideSpeech();
    scene.remove(ship, scanTarget);
  }

  return {
    update,
    updateSpeech,
    setSceneOffset,
    setEnabled,
    dispose
  };
}

export function ufoSpeechForEncounter(encounterIndex) {
  const normalizedIndex = ((Math.trunc(encounterIndex) % SPEECH_LINES.length) + SPEECH_LINES.length)
    % SPEECH_LINES.length;
  return SPEECH_LINES[normalizedIndex];
}

function createShip(resources) {
  const group = new THREE.Group();

  const bodyGeometry = new THREE.SphereGeometry(1.08, 32, 18);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xaebdca,
    metalness: 0.92,
    roughness: 0.16,
    clearcoat: 0.72,
    clearcoatRoughness: 0.08,
    envMapIntensity: 2.1
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.scale.set(1, 0.24, 1);
  body.castShadow = true;
  group.add(body);
  resources.add(bodyGeometry);
  resources.add(bodyMaterial);

  const rimGeometry = new THREE.TorusGeometry(0.86, 0.1, 10, 48);
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x172f45,
    emissive: 0x53c9ff,
    emissiveIntensity: 2.4,
    metalness: 0.75,
    roughness: 0.22
  });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  resources.add(rimGeometry);
  resources.add(rimMaterial);

  const domeGeometry = new THREE.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x78dfff,
    roughness: 0.08,
    metalness: 0.04,
    transmission: 0.72,
    thickness: 0.7,
    ior: 1.4,
    clearcoat: 1,
    envMapIntensity: 2
  });
  const dome = new THREE.Mesh(domeGeometry, domeMaterial);
  dome.position.y = 0.14;
  dome.scale.y = 0.62;
  group.add(dome);
  resources.add(domeGeometry);
  resources.add(domeMaterial);

  const lightGeometry = new THREE.SphereGeometry(0.065, 10, 8);
  const lightMaterials = [0x53c9ff, 0xff5d8f, 0xffdc72].map(color => new THREE.MeshBasicMaterial({
    color,
    toneMapped: false
  }));
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2;
    const light = new THREE.Mesh(lightGeometry, lightMaterials[index % lightMaterials.length]);
    light.position.set(Math.cos(angle) * 0.78, -0.19, Math.sin(angle) * 0.78);
    group.add(light);
  }
  resources.add(lightGeometry);
  for (const material of lightMaterials) resources.add(material);
  group.scale.setScalar(0.9);
  return group;
}

function createBeam(resources) {
  const group = new THREE.Group();
  group.position.y = -0.2;

  const geometry = new THREE.ConeGeometry(2.15, 5.5, 40, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: 0x8ee8ff,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  });
  const cone = new THREE.Mesh(geometry, material);
  cone.position.y = -2.75;
  group.add(cone);
  resources.add(geometry);
  resources.add(material);
  return { group, material };
}

function createOrbitCurve(stopPosition, sceneOffsetY = 0) {
  const point = (x, y, z) => new THREE.Vector3(x, y + sceneOffsetY, z);
  return new THREE.CatmullRomCurve3([
    point(-28, 10, 14),
    point(-15, 7, 12),
    point(-10, 6.5, 0),
    point(-4, 7.5, -11),
    point(7, 8, -9),
    point(12, 6.5, 1),
    point(7, 6.8, 10),
    point(-4, 7.2, 11),
    point(-10, 6.2, 3),
    point(-5, 6, -2),
    stopPosition
  ], false, "centripetal", 0.5);
}

function createDepartureCurve(stopPosition, sceneOffsetY = 0) {
  const point = (x, y, z) => new THREE.Vector3(x, y + sceneOffsetY, z);
  return new THREE.CatmullRomCurve3([
    stopPosition,
    point(5, 7.5, -3),
    point(15, 11, -11),
    point(34, 19, -30)
  ], false, "centripetal", 0.5);
}

function smootherStep(value) {
  const progress = THREE.MathUtils.clamp(value, 0, 1);
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

export function ufoFirstDelay(random = Math.random) {
  return randomDelay(UFO_FIRST_DELAY_MIN_SECONDS, UFO_FIRST_DELAY_MAX_SECONDS, random);
}

export function ufoIdleDelay(random = Math.random) {
  return randomDelay(UFO_IDLE_MIN_SECONDS, UFO_IDLE_MAX_SECONDS, random);
}

function randomDelay(minimum, maximum, random) {
  const unit = THREE.MathUtils.clamp(Number(random()) || 0, 0, 1);
  return THREE.MathUtils.lerp(minimum, maximum, unit);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
