import * as THREE from "../../vendor/three/three.module.min.js";
import { createUfoShip } from "./about-ufo.js?v=20260712-about-kanban-parity-120";

export const SPACE_BATTLE_CHANCE = 0.68;
export const SPACE_BATTLE_MIN_INTERCEPTORS = 1;
export const SPACE_BATTLE_MAX_INTERCEPTORS = 3;
export const SPACE_BATTLE_PIP_LAYER = 2;
export const SPACE_BATTLE_PIP_GRACE_SECONDS = 5;
export const SPACE_BATTLE_DIALOGUE_LINGER_SECONDS = 7;

const BATTLE_START_UFO_TIME = 10.15;
const ARRIVAL_END = 2.05;
const COMBAT_END = 7.35;
const DEPARTURE_END = 10.25;
const LASER_DURATION = 0.22;
const STUN_DURATION = 0.82;
const PIP_EDGE_LIMIT_X = 0.68;
const PIP_EDGE_LIMIT_Y = 0.66;

const DEFENDER_LINES = [
  "PMT is so advanced, it must not fall into the wrong hands!",
  "Back away from the backlog, space pirate!",
  "Nobody abducts a Road Map on our watch!",
  "Release the Sprint charts and power down!",
  "That Kanban belongs to the people of Earth!",
  "Your unauthorized feature request has been rejected!"
];

const ORIGINAL_UFO_LINES = [
  "I found PMT first! File your own discovery ticket!",
  "Your attack is not in the approved Sprint!",
  "Stand down! I am only borrowing the dashboard!",
  "Catch me if your velocity chart allows it!",
  "Fine! I will share the documentation link!"
];

const HIT_LINES = [
  "Critical hit! Who assigned this bug to me?",
  "Shields blocked by an undocumented dependency!",
  "Adding survive laser fire to the backlog!",
  "That blast needs a Root Cause Analysis!",
  "Our shields failed QA. Again."
];

const FORMATION_COLORS = [0xff5d8f, 0x7be7ff, 0xffd166];
const FORMATION_PALETTES = [
  {
    bodyColor: 0xb9a4b5,
    rimColor: 0x4a1d35,
    rimEmissive: 0xff5d8f,
    domeColor: 0xff9fc1,
    lightColors: [0xff5d8f, 0xffa2c2, 0xffd4e2]
  },
  {
    bodyColor: 0x9ebbc3,
    rimColor: 0x153c48,
    rimEmissive: 0x7be7ff,
    domeColor: 0x91efff,
    lightColors: [0x7be7ff, 0xb8f4ff, 0x4ecde8]
  },
  {
    bodyColor: 0xc7b98e,
    rimColor: 0x4a3b16,
    rimEmissive: 0xffd166,
    domeColor: 0xffe29b,
    lightColors: [0xffd166, 0xffedae, 0xffb84d]
  }
];
const ENTRY_OFFSETS = [
  new THREE.Vector3(-30, 8, -16),
  new THREE.Vector3(27, 10, -12),
  new THREE.Vector3(3, 12, 27)
];
const EXIT_OFFSETS = [
  new THREE.Vector3(-40, 18, -36),
  new THREE.Vector3(42, 20, -30),
  new THREE.Vector3(8, 24, 44)
];

const SHOT_SCHEDULE = [
  { at: 2.55, source: "interceptor", sourceIndex: 0, target: "original" },
  { at: 3.15, source: "original", target: "interceptor", targetIndex: 0 },
  { at: 3.72, source: "interceptor", sourceIndex: 1, target: "original" },
  { at: 4.28, source: "original", target: "interceptor", targetIndex: 1 },
  { at: 4.9, source: "interceptor", sourceIndex: 2, target: "original" },
  { at: 5.48, source: "original", target: "interceptor", targetIndex: 2 },
  { at: 6.08, source: "interceptor", sourceIndex: 0, target: "original" },
  { at: 6.68, source: "original", target: "interceptor", targetIndex: 0 }
];

export function createIntergalacticBattle({
  scene,
  resources,
  root,
  ufoEncounter,
  dialogueElement,
  pictureInPictureElement
}) {
  const random = seededRandom(0xb4771e);
  const group = new THREE.Group();
  const fighters = Array.from({ length: SPACE_BATTLE_MAX_INTERCEPTORS }, (_, index) => (
    createUfoShip(resources, FORMATION_PALETTES[index])
  ));
  const laserBolts = SHOT_SCHEDULE.map((shot, index) => createLaserBolt(
    resources,
    shot.source === "original" ? 0x7be7ff : FORMATION_COLORS[index % FORMATION_COLORS.length]
  ));
  const originalPosition = new THREE.Vector3();
  const battleAnchor = new THREE.Vector3();
  const scratchStart = new THREE.Vector3();
  const scratchEnd = new THREE.Vector3();
  const scratchNext = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const arrivalCurves = Array(SPACE_BATTLE_MAX_INTERCEPTORS).fill(null);
  const departureCurves = Array(SPACE_BATTLE_MAX_INTERCEPTORS).fill(null);
  const fighterStunStartedAt = Array(SPACE_BATTLE_MAX_INTERCEPTORS).fill(Number.NEGATIVE_INFINITY);
  const shotState = SHOT_SCHEDULE.map(() => ({ fired: false, impacted: false }));
  const dialogueSchedule = [];
  const pictureInPicturePose = {
    azimuth: 0,
    elevation: 3.6,
    distance: 18,
    orbitRate: 0.02
  };
  const state = {
    active: false,
    phase: "idle",
    interceptorCount: 0,
    eventCount: 0,
    shotCount: 0,
    pictureInPicture: false,
    shadowUpdate: false
  };

  let observedEncounterId = -1;
  let battlePlanned = false;
  let plannedInterceptorCount = 0;
  let battleStartedAt = Number.NEGATIVE_INFINITY;
  let battleAge = 0;
  let activeDialogueIndex = -1;
  let dialogueHideAt = Number.NEGATIVE_INFINITY;
  let originalVisible = false;
  let enabled = true;
  let automaticInterceptionsEnabled = true;
  let forcedBattlePending = false;
  let forcedInterceptorCount = 0;

  for (const fighter of fighters) group.add(fighter);
  for (const bolt of laserBolts) group.add(bolt);
  const pictureInPictureLight = new THREE.HemisphereLight(0xc8efff, 0x122034, 2.2);
  pictureInPictureLight.layers.set(SPACE_BATTLE_PIP_LAYER);
  group.add(pictureInPictureLight);
  group.traverse(object => object.layers.enable(SPACE_BATTLE_PIP_LAYER));
  pictureInPictureLight.layers.set(SPACE_BATTLE_PIP_LAYER);
  ufoEncounter?.enablePictureInPictureLayer?.(SPACE_BATTLE_PIP_LAYER);
  scene.add(group);
  resetVisuals();

  function update(elapsedSeconds, reducedMotion) {
    state.shadowUpdate = false;
    updateLingeringDialogue(elapsedSeconds);
    const ufoState = ufoEncounter?.getBattleState?.();
    if (!ufoState) {
      finishImmediately();
      return state;
    }

    originalPosition.copy(ufoState.position);
    originalVisible = ufoState.visible;
    if (!enabled && !state.active) {
      battlePlanned = false;
      forcedBattlePending = false;
      return state;
    }
    if (ufoState.encounterId !== observedEncounterId && ufoState.encounterId > 0) {
      observedEncounterId = ufoState.encounterId;
      if (state.active) {
        battlePlanned = false;
        forcedBattlePending = false;
      } else if (forcedBattlePending) {
        battlePlanned = true;
        plannedInterceptorCount = forcedInterceptorCount;
        forcedBattlePending = false;
      } else {
        battlePlanned = automaticInterceptionsEnabled && battleShouldIntercept(random);
        plannedInterceptorCount = battlePlanned ? battleInterceptorCount(random) : 0;
      }
    }

    if (reducedMotion) {
      finishImmediately();
      return state;
    }

    if (!state.active
      && battlePlanned
      && ufoState.visible
      && ufoState.encounterTime >= BATTLE_START_UFO_TIME
      && ufoState.encounterTime < BATTLE_START_UFO_TIME + 1.4) {
      startBattle(elapsedSeconds, plannedInterceptorCount);
      battlePlanned = false;
    }

    if (!state.active) return state;
    battleAge = Math.max(0, elapsedSeconds - battleStartedAt);
    updatePhase();
    updateFighters();
    updateShots();
    updateDialogue();

    if (battleAge >= DEPARTURE_END) finishBattle(true);
    return state;
  }

  function startBattle(elapsedSeconds, interceptorCount) {
    state.active = true;
    state.phase = "intercepting";
    state.interceptorCount = THREE.MathUtils.clamp(
      Math.trunc(interceptorCount),
      SPACE_BATTLE_MIN_INTERCEPTORS,
      SPACE_BATTLE_MAX_INTERCEPTORS
    );
    state.eventCount += 1;
    state.shotCount = 0;
    state.shadowUpdate = true;
    battleStartedAt = elapsedSeconds;
    battleAge = 0;
    dialogueHideAt = Number.NEGATIVE_INFINITY;
    pictureInPicturePose.azimuth = THREE.MathUtils.lerp(-0.48, 0.48, random());
    pictureInPicturePose.elevation = THREE.MathUtils.lerp(3.2, 5.1, random());
    pictureInPicturePose.distance = THREE.MathUtils.lerp(17, 20.5, random());
    pictureInPicturePose.orbitRate = (random() < 0.5 ? -1 : 1)
      * THREE.MathUtils.lerp(0.018, 0.032, random());
    battleAnchor.copy(originalPosition);
    activeDialogueIndex = -1;
    buildDialogueSchedule();

    for (let index = 0; index < fighters.length; index += 1) {
      const fighter = fighters[index];
      fighter.visible = index < state.interceptorCount;
      fighterStunStartedAt[index] = Number.NEGATIVE_INFINITY;
      if (!fighter.visible) continue;

      const entry = battleAnchor.clone().add(ENTRY_OFFSETS[index]);
      const arrivalEnd = combatPosition(index, ARRIVAL_END, new THREE.Vector3());
      arrivalCurves[index] = new THREE.CatmullRomCurve3([
        entry,
        entry.clone().lerp(arrivalEnd, 0.38).add(new THREE.Vector3(0, 2.6, 0)),
        arrivalEnd
      ], false, "centripetal", 0.5);

      const departureStart = combatPosition(index, COMBAT_END, new THREE.Vector3());
      const exit = battleAnchor.clone().add(EXIT_OFFSETS[index]);
      departureCurves[index] = new THREE.CatmullRomCurve3([
        departureStart,
        departureStart.clone().lerp(exit, 0.35).add(new THREE.Vector3(0, 3.5, 0)),
        exit
      ], false, "centripetal", 0.5);
      arrivalCurves[index].getPointAt(0, fighter.position);
    }

    for (const shot of shotState) {
      shot.fired = false;
      shot.impacted = false;
    }
    for (const bolt of laserBolts) bolt.visible = false;
    hideDialogue();
  }

  function updatePhase() {
    if (battleAge < ARRIVAL_END) state.phase = "intercepting";
    else if (battleAge < COMBAT_END) state.phase = "dogfight";
    else state.phase = "departing";
  }

  function updateFighters() {
    for (let index = 0; index < state.interceptorCount; index += 1) {
      const fighter = fighters[index];
      scratchStart.copy(fighter.position);

      if (battleAge < ARRIVAL_END) {
        arrivalCurves[index].getPointAt(smootherStep(battleAge / ARRIVAL_END), fighter.position);
      } else if (battleAge < COMBAT_END) {
        combatPosition(index, battleAge, fighter.position);
      } else {
        const progress = smootherStep(
          (battleAge - COMBAT_END) / (DEPARTURE_END - COMBAT_END)
        );
        departureCurves[index].getPointAt(progress, fighter.position);
      }

      applyFighterStun(index, fighter);
      scratchNext.copy(fighter.position).sub(scratchStart);
      if (scratchNext.lengthSq() > 0.00001) {
        fighter.lookAt(scratchEnd.copy(fighter.position).add(scratchNext));
      }
      fighter.rotation.z += Math.sin(battleAge * 2.8 + index) * 0.06;
    }
  }

  function combatPosition(index, time, target) {
    const angle = time * (0.82 + index * 0.07) + index * Math.PI * 0.72;
    const radiusX = 5.2 + index * 0.75;
    const radiusZ = 4.2 + index * 0.55;
    return target.set(
      battleAnchor.x + Math.cos(angle) * radiusX,
      battleAnchor.y + 1.8 + Math.sin(angle * 1.7) * (0.8 + index * 0.15),
      battleAnchor.z + Math.sin(angle) * radiusZ
    );
  }

  function applyFighterStun(index, fighter) {
    const stunAge = battleAge - fighterStunStartedAt[index];
    if (stunAge < 0 || stunAge >= STUN_DURATION) return;
    const strength = 1 - stunAge / STUN_DURATION;
    fighter.position.y -= Math.sin(Math.PI * stunAge / STUN_DURATION) * 0.7;
    fighter.position.x += Math.sin(stunAge * 31) * 0.18 * strength;
    fighter.rotation.z += Math.sin(stunAge * 38) * 0.28 * strength;
  }

  function updateShots() {
    for (let index = 0; index < SHOT_SCHEDULE.length; index += 1) {
      const definition = SHOT_SCHEDULE[index];
      const shot = shotState[index];
      const bolt = laserBolts[index];
      const availableSourceIndex = definition.sourceIndex % state.interceptorCount;
      const availableTargetIndex = definition.targetIndex % state.interceptorCount;

      if (!shot.fired && battleAge >= definition.at) {
        shot.fired = true;
        state.shotCount += 1;
      }
      if (!shot.fired) continue;

      const shotAge = battleAge - definition.at;
      if (shotAge <= LASER_DURATION) {
        bolt.visible = true;
        if (definition.source === "original") scratchStart.copy(originalPosition);
        else scratchStart.copy(fighters[availableSourceIndex].position);
        if (definition.target === "original") scratchEnd.copy(originalPosition);
        else scratchEnd.copy(fighters[availableTargetIndex].position);
        positionLaserBolt(bolt, scratchStart, scratchEnd, shotAge / LASER_DURATION);
      } else {
        bolt.visible = false;
      }

      if (!shot.impacted && shotAge >= LASER_DURATION * 0.72) {
        shot.impacted = true;
        if (definition.target === "original") {
          ufoEncounter?.reactToBattleHit?.();
        } else {
          fighterStunStartedAt[availableTargetIndex] = battleAge;
        }
      }
    }
  }

  function buildDialogueSchedule() {
    dialogueSchedule.length = 0;
    const defenderOffset = Math.floor(random() * DEFENDER_LINES.length);
    const originalOffset = Math.floor(random() * ORIGINAL_UFO_LINES.length);
    const hitOffset = Math.floor(random() * HIT_LINES.length);
    dialogueSchedule.push(
      { at: 0, speaker: "PMT DEFENDER", speakerIndex: 0, text: defenderLine(defenderOffset) },
      { at: 2.8, speaker: "ORIGINAL UFO", speakerIndex: -1, text: originalUfoLine(originalOffset) },
      { at: 4.8, speaker: "PMT DEFENDER", speakerIndex: 1, text: defenderLine(defenderOffset + 1) },
      { at: 6.7, speaker: "ORIGINAL UFO", speakerIndex: -1, text: hitLine(hitOffset) },
      { at: 8.2, speaker: "PMT DEFENDER", speakerIndex: 2, text: "Threat redirected. Resume the approved flyby!" }
    );
  }

  function updateDialogue() {
    let nextIndex = -1;
    for (let index = 0; index < dialogueSchedule.length; index += 1) {
      if (battleAge >= dialogueSchedule[index].at) nextIndex = index;
    }
    if (nextIndex < 0) {
      hideDialogue();
      return;
    }
    if (nextIndex <= activeDialogueIndex) return;
    for (let index = activeDialogueIndex + 1; index <= nextIndex; index += 1) {
      const line = dialogueSchedule[index];
      const messageElement = document.createElement("p");
      messageElement.dataset.speaker = line.speaker === "ORIGINAL UFO"
        ? "ufo-original"
        : `defender-${line.speakerIndex % state.interceptorCount}`;
      messageElement.textContent = line.text;
      dialogueElement.append(messageElement);
    }
    activeDialogueIndex = nextIndex;
    dialogueElement.hidden = false;
  }

  function updatePictureInPicture(
    mainCamera,
    pictureInPictureCamera,
    pictureInPictureFocus,
    enabled = true
  ) {
    if (!state.active || !pictureInPictureElement || !enabled) {
      state.pictureInPicture = false;
      if (pictureInPictureElement) pictureInPictureElement.hidden = true;
      root.dataset.aboutBattlePictureInPictureActive = "false";
      return false;
    }

    positionPictureInPictureCamera(
      pictureInPictureCamera,
      pictureInPictureFocus,
      battleAge,
      pictureInPicturePose
    );
    projected.copy(originalPosition).project(mainCamera);
    const originalComfortablyFramed = projected.z >= -1
      && projected.z <= 1
      && Math.abs(projected.x) <= PIP_EDGE_LIMIT_X
      && Math.abs(projected.y) <= PIP_EDGE_LIMIT_Y;
    const anyUfoVisibleInFeed = isPositionVisibleInCamera(
      originalPosition,
      pictureInPictureCamera,
      originalVisible
    ) || fighters.some((fighter, index) => (
      index < state.interceptorCount
        && isPositionVisibleInCamera(fighter.position, pictureInPictureCamera, fighter.visible)
    ));
    const secondsRemaining = Math.max(0, DEPARTURE_END - battleAge);
    const mayOpenPictureInPicture = state.pictureInPicture
      || secondsRemaining > SPACE_BATTLE_PIP_GRACE_SECONDS;
    state.pictureInPicture = !originalComfortablyFramed
      && anyUfoVisibleInFeed
      && mayOpenPictureInPicture;
    root.dataset.aboutBattlePictureInPictureSecondsRemaining = secondsRemaining.toFixed(2);
    root.dataset.aboutBattlePictureInPictureLateSuppressed = String(
      !state.pictureInPicture
        && !originalComfortablyFramed
        && secondsRemaining <= SPACE_BATTLE_PIP_GRACE_SECONDS
    );
    pictureInPictureElement.hidden = !state.pictureInPicture;
    root.dataset.aboutBattlePictureInPictureActive = String(state.pictureInPicture);
    if (!state.pictureInPicture) return false;

    return true;
  }

  function finishBattle(lingerDialogue = false) {
    for (const fighter of fighters) fighter.visible = false;
    for (const bolt of laserBolts) bolt.visible = false;
    state.active = false;
    state.phase = "complete";
    state.interceptorCount = 0;
    state.pictureInPicture = false;
    state.shadowUpdate = true;
    pictureInPictureElement.hidden = true;
    root.dataset.aboutBattlePictureInPictureActive = "false";
    root.dataset.aboutBattlePictureInPictureLateSuppressed = "false";
    if (lingerDialogue && !dialogueElement.hidden) {
      dialogueHideAt = battleStartedAt + DEPARTURE_END + SPACE_BATTLE_DIALOGUE_LINGER_SECONDS;
      root.dataset.aboutBattleDialogueLingering = "true";
    } else {
      hideDialogue();
    }
  }

  function finishImmediately() {
    if (!state.active) return;
    finishBattle(false);
  }

  function resetVisuals() {
    for (const fighter of fighters) fighter.visible = false;
    for (const bolt of laserBolts) bolt.visible = false;
    pictureInPictureElement.hidden = true;
    hideDialogue();
  }

  function hideDialogue() {
    activeDialogueIndex = -1;
    dialogueHideAt = Number.NEGATIVE_INFINITY;
    dialogueElement.replaceChildren();
    dialogueElement.hidden = true;
    root.dataset.aboutBattleDialogueLingering = "false";
  }

  function updateLingeringDialogue(elapsedSeconds) {
    if (state.active || dialogueElement.hidden) return;
    if (elapsedSeconds >= dialogueHideAt) hideDialogue();
  }

  function isActive() {
    return state.active;
  }

  function forceNextBattle(interceptorCount = battleInterceptorCount(random)) {
    if (!enabled || state.active) return 0;
    forcedInterceptorCount = THREE.MathUtils.clamp(
      Math.trunc(Number(interceptorCount) || SPACE_BATTLE_MIN_INTERCEPTORS),
      SPACE_BATTLE_MIN_INTERCEPTORS,
      SPACE_BATTLE_MAX_INTERCEPTORS
    );
    forcedBattlePending = true;
    return forcedInterceptorCount;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled && !state.active) {
      battlePlanned = false;
      forcedBattlePending = false;
    }
    return enabled;
  }

  function setAutomaticInterceptionsEnabled(value) {
    automaticInterceptionsEnabled = Boolean(value);
    if (!automaticInterceptionsEnabled && !state.active && !forcedBattlePending) {
      battlePlanned = false;
    }
    return automaticInterceptionsEnabled;
  }

  function abort() {
    battlePlanned = false;
    forcedBattlePending = false;
    if (state.active) finishBattle();
    else resetVisuals();
  }

  function dispose() {
    resetVisuals();
    scene.remove(group);
  }

  return {
    update,
    updatePictureInPicture,
    isActive,
    forceNextBattle,
    setEnabled,
    setAutomaticInterceptionsEnabled,
    abort,
    dispose
  };
}

export function battleShouldIntercept(random = Math.random) {
  return clampRandom(random) < SPACE_BATTLE_CHANCE;
}

export function battleInterceptorCount(random = Math.random) {
  const span = SPACE_BATTLE_MAX_INTERCEPTORS - SPACE_BATTLE_MIN_INTERCEPTORS + 1;
  return SPACE_BATTLE_MIN_INTERCEPTORS + Math.floor(clampRandom(random) * span);
}

export function defenderLine(index) {
  return cyclicLine(DEFENDER_LINES, index);
}

export function originalUfoLine(index) {
  return cyclicLine(ORIGINAL_UFO_LINES, index);
}

export function hitLine(index) {
  return cyclicLine(HIT_LINES, index);
}

function cyclicLine(lines, index) {
  const normalized = ((Math.trunc(Number(index) || 0) % lines.length) + lines.length) % lines.length;
  return lines[normalized];
}

function clampRandom(random) {
  return THREE.MathUtils.clamp(Number(random()) || 0, 0, 0.999999);
}

function createLaserBolt(resources, color) {
  const geometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  resources.add(geometry);
  resources.add(material);
  return mesh;
}

function positionLaserBolt(bolt, origin, destination, rawProgress) {
  const progress = smootherStep(rawProgress);
  const tip = destination.clone().lerp(origin, 1 - progress);
  const direction = tip.clone().sub(origin);
  const length = Math.max(0.05, direction.length());
  bolt.position.copy(origin).add(tip).multiplyScalar(0.5);
  bolt.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  bolt.scale.set(1, length, 1);
}

function positionPictureInPictureCamera(camera, focus, age, pose) {
  const safeFocus = focus?.isVector3 ? focus : new THREE.Vector3(0, 0.5, 0);
  const angle = pose.azimuth + age * pose.orbitRate;
  camera.position.set(
    safeFocus.x + Math.sin(angle) * pose.distance,
    safeFocus.y + pose.elevation,
    safeFocus.z + Math.cos(angle) * pose.distance
  );
  camera.lookAt(safeFocus.x, safeFocus.y + 1.5, safeFocus.z);
  camera.updateProjectionMatrix();
}

function isPositionVisibleInCamera(position, camera, visible) {
  if (!visible) return false;
  const projectedPosition = position.clone().project(camera);
  return projectedPosition.z >= -1
    && projectedPosition.z <= 1
    && Math.abs(projectedPosition.x) <= 0.98
    && Math.abs(projectedPosition.y) <= 0.98;
}

function smootherStep(value) {
  const progress = THREE.MathUtils.clamp(value, 0, 1);
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
