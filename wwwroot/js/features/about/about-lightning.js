import * as THREE from "../../vendor/three/three.module.min.js";

export const LIGHTNING_MIN_INTERVAL_SECONDS = 45;
export const LIGHTNING_MAX_INTERVAL_SECONDS = 65;
const BOLT_DURATION_SECONDS = 0.72;
const HEAT_DURATION_SECONDS = 4.4;
const MAX_BOLT_SEGMENTS = 96;
const SPARK_COUNT = 72;
const HOT_WHITE = new THREE.Color(0xffffff);
const HOT_ORANGE = new THREE.Color(0xff5a16);

export function createLogoLightningEffect({ scene, resources, targets }) {
  const random = seededRandom(0x11a7c0de);
  const group = new THREE.Group();
  group.name = "PMT Lightning";
  group.visible = false;
  scene.add(group);

  const boltPositions = new Float32Array(MAX_BOLT_SEGMENTS * 2 * 3);
  const boltGeometry = new THREE.BufferGeometry();
  const boltPositionAttribute = new THREE.BufferAttribute(boltPositions, 3);
  boltPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  boltGeometry.setAttribute("position", boltPositionAttribute);
  boltGeometry.setDrawRange(0, 0);

  const glowMaterial = new THREE.LineBasicMaterial({
    color: 0x2686fe,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const coreMaterial = new THREE.LineBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const glowLines = new THREE.LineSegments(boltGeometry, glowMaterial);
  const coreLines = new THREE.LineSegments(boltGeometry, coreMaterial);
  glowLines.renderOrder = 7;
  coreLines.renderOrder = 8;
  group.add(glowLines, coreLines);

  const impactTexture = createImpactTexture(resources);
  const impactMaterial = new THREE.SpriteMaterial({
    map: impactTexture,
    color: 0xa8dcff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const impactGlow = new THREE.Sprite(impactMaterial);
  impactGlow.scale.setScalar(1.2);
  impactGlow.renderOrder = 9;
  group.add(impactGlow);

  const flashLight = new THREE.PointLight(0xbfe8ff, 0, 22, 2);
  const heatLight = new THREE.PointLight(0xff5a16, 0, 9, 2);
  const sceneFlashLight = new THREE.HemisphereLight(0xe8f7ff, 0x5876a8, 0);
  group.add(flashLight, heatLight, sceneFlashLight);

  const sparkPositions = new Float32Array(SPARK_COUNT * 3);
  const sparkVelocities = new Float32Array(SPARK_COUNT * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  const sparkPositionAttribute = new THREE.BufferAttribute(sparkPositions, 3);
  sparkPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  sparkGeometry.setAttribute("position", sparkPositionAttribute);
  const sparkMaterial = new THREE.PointsMaterial({
    color: 0xffd8a3,
    size: 0.14,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  sparks.renderOrder = 9;
  group.add(sparks);

  resources.add(boltGeometry);
  resources.add(glowMaterial);
  resources.add(coreMaterial);
  resources.add(impactMaterial);
  resources.add(sparkGeometry);
  resources.add(sparkMaterial);

  const impactPoint = new THREE.Vector3();
  const strikeStart = new THREE.Vector3();
  const targetBounds = new THREE.Box3();
  const targetCenter = new THREE.Vector3();
  const segmentStart = new THREE.Vector3();
  const segmentEnd = new THREE.Vector3();
  const branchEnd = new THREE.Vector3();

  let enabled = false;
  let nextStrikeAt = Number.POSITIVE_INFINITY;
  let strikeStartedAt = Number.NEGATIVE_INFINITY;
  let strikeCount = 0;
  let targetIndex = -1;
  let currentTarget = null;
  let currentMaterials = [];
  let reducedMotionActive = false;

  function setEnabled(value, elapsedSeconds = 0) {
    enabled = Boolean(value);
    if (enabled) {
      nextStrikeAt = Math.max(0, elapsedSeconds) + lightningStrikeDelay(random);
    } else {
      nextStrikeAt = Number.POSITIVE_INFINITY;
      endStrike();
    }
    return enabled;
  }

  function triggerStrike(elapsedSeconds, position = null, label = "PMT") {
    if (position?.isVector3) beginStrike(elapsedSeconds, position, label);
    else beginStrike(elapsedSeconds);
  }

  function update(elapsedSeconds, reducedMotion = false, suspended = false) {
    reducedMotionActive = reducedMotion;
    if (!enabled || elapsedSeconds < 0 || !targets.length) {
      return state();
    }

    if (!suspended && elapsedSeconds >= nextStrikeAt) {
      beginStrike(elapsedSeconds);
      nextStrikeAt = elapsedSeconds + lightningStrikeDelay(random);
    }

    const strikeAge = elapsedSeconds - strikeStartedAt;
    if (strikeAge < 0 || strikeAge >= HEAT_DURATION_SECONDS) {
      if (currentTarget) endStrike();
      return state(strikeAge);
    }

    updateBolt(strikeAge);
    updateSparks(strikeAge);
    updateHeat(strikeAge);
    return state(strikeAge);
  }

  function beginStrike(elapsedSeconds, forcedPosition = null, forcedLabel = "") {
    endStrike();
    if (forcedPosition) {
      currentTarget = { mesh: null, label: forcedLabel || "UFO" };
      impactPoint.copy(forcedPosition);
    } else {
      targetIndex = (targetIndex + 1) % targets.length;
      currentTarget = targets[targetIndex];
      targetBounds.setFromObject(currentTarget.mesh);
      targetBounds.getCenter(targetCenter);
      impactPoint.set(targetCenter.x, targetBounds.max.y, targetBounds.max.z + 0.08);
    }
    strikeStartedAt = elapsedSeconds;
    strikeCount += 1;
    strikeStart.set(
      impactPoint.x + (random() - 0.5) * 4.5,
      impactPoint.y + 10 + random() * 2.5,
      impactPoint.z + 0.6 + random() * 1.5
    );

    buildBolt(strikeStart, impactPoint);
    seedSparks(impactPoint);
    impactGlow.position.copy(impactPoint);
    flashLight.position.copy(impactPoint).addScalar(0.08);
    heatLight.position.copy(impactPoint).add(new THREE.Vector3(0, -0.25, 0.18));
    currentMaterials = currentTarget.mesh
      ? materialList(currentTarget.mesh.material).map(material => ({
        material,
        emissive: material.emissive?.clone?.() || null,
        emissiveIntensity: material.emissiveIntensity ?? 0
      }))
      : [];
    group.visible = true;
  }

  function buildBolt(start, end) {
    let segmentCount = 0;
    const points = [start.clone()];
    const steps = 22;

    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      const point = start.clone().lerp(end, progress);
      const taper = Math.sin(progress * Math.PI);
      point.x += (random() - 0.5) * 1.15 * taper;
      point.z += (random() - 0.5) * 0.92 * taper;
      points.push(point);
      segmentCount = addBoltSegment(points[index - 1], point, segmentCount);
    }

    for (const branchStep of [5, 9, 13, 17]) {
      segmentStart.copy(points[branchStep]);
      const branchSegments = 3 + Math.floor(random() * 3);
      for (let index = 0; index < branchSegments; index += 1) {
        branchEnd.copy(segmentStart).add(new THREE.Vector3(
          (random() - 0.5) * (2.1 - index * 0.18),
          -0.45 - random() * 0.8,
          (random() - 0.5) * 1.45
        ));
        segmentCount = addBoltSegment(segmentStart, branchEnd, segmentCount);
        segmentStart.copy(branchEnd);
      }
    }

    boltGeometry.setDrawRange(0, segmentCount * 2);
    boltPositionAttribute.needsUpdate = true;
    boltGeometry.computeBoundingSphere();
  }

  function addBoltSegment(start, end, segmentCount) {
    if (segmentCount >= MAX_BOLT_SEGMENTS) return segmentCount;
    const offset = segmentCount * 6;
    boltPositions[offset] = start.x;
    boltPositions[offset + 1] = start.y;
    boltPositions[offset + 2] = start.z;
    boltPositions[offset + 3] = end.x;
    boltPositions[offset + 4] = end.y;
    boltPositions[offset + 5] = end.z;
    return segmentCount + 1;
  }

  function seedSparks(origin) {
    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const offset = index * 3;
      sparkPositions[offset] = origin.x;
      sparkPositions[offset + 1] = origin.y;
      sparkPositions[offset + 2] = origin.z;
      const angle = random() * Math.PI * 2;
      const horizontalSpeed = 1.4 + random() * 4.6;
      sparkVelocities[offset] = Math.cos(angle) * horizontalSpeed;
      sparkVelocities[offset + 1] = 1.2 + random() * 5.2;
      sparkVelocities[offset + 2] = Math.sin(angle) * horizontalSpeed * 0.72 + 0.8;
    }
    sparkPositionAttribute.needsUpdate = true;
  }

  function updateBolt(strikeAge) {
    const boltDuration = reducedMotionActive ? 0.24 : BOLT_DURATION_SECONDS;
    const visible = strikeAge < boltDuration;
    glowLines.visible = visible;
    coreLines.visible = visible;
    impactGlow.visible = visible;
    flashLight.visible = visible;
    sceneFlashLight.visible = visible;
    if (!visible) return;

    const decay = 1 - strikeAge / boltDuration;
    const flicker = reducedMotionActive
      ? 1
      : 0.56 + Math.abs(Math.sin(strikeAge * 89)) * 0.44;
    glowMaterial.opacity = decay * flicker * 0.72;
    coreMaterial.opacity = decay * flicker;
    impactMaterial.opacity = decay * flicker * 0.95;
    const impactScale = 1.3 + (1 - decay) * 2.6;
    impactGlow.scale.setScalar(impactScale);
    flashLight.intensity = 155 * decay * flicker;
    sceneFlashLight.intensity = 7.5 * decay * flicker;
  }

  function updateSparks(strikeAge) {
    const visible = !reducedMotionActive && strikeAge < 1.35;
    sparks.visible = visible;
    if (!visible) return;

    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const offset = index * 3;
      sparkPositions[offset] = impactPoint.x + sparkVelocities[offset] * strikeAge;
      sparkPositions[offset + 1] = impactPoint.y
        + sparkVelocities[offset + 1] * strikeAge
        - 5.4 * strikeAge * strikeAge;
      sparkPositions[offset + 2] = impactPoint.z + sparkVelocities[offset + 2] * strikeAge;
    }
    sparkPositionAttribute.needsUpdate = true;
    sparkMaterial.opacity = Math.max(0, 1 - strikeAge / 1.35);
    sparkMaterial.size = 0.09 + Math.max(0, 0.09 * (1 - strikeAge));
  }

  function updateHeat(strikeAge) {
    const progress = THREE.MathUtils.clamp(strikeAge / HEAT_DURATION_SECONDS, 0, 1);
    const heat = Math.pow(1 - progress, 1.7);
    const whiteHeat = THREE.MathUtils.clamp(1 - strikeAge / 0.85, 0, 1);
    for (const entry of currentMaterials) {
      if (!entry.material.emissive) continue;
      entry.material.emissive.lerpColors(HOT_ORANGE, HOT_WHITE, whiteHeat);
      entry.material.emissiveIntensity = entry.emissiveIntensity + heat * 5.2;
    }
    heatLight.intensity = 38 * heat;
    heatLight.color.lerpColors(HOT_ORANGE, HOT_WHITE, whiteHeat * 0.62);
  }

  function endStrike() {
    for (const entry of currentMaterials) {
      if (entry.emissive && entry.material.emissive) entry.material.emissive.copy(entry.emissive);
      entry.material.emissiveIntensity = entry.emissiveIntensity;
    }
    currentMaterials = [];
    currentTarget = null;
    group.visible = false;
    sparks.visible = false;
    glowLines.visible = false;
    coreLines.visible = false;
    impactGlow.visible = false;
    flashLight.intensity = 0;
    heatLight.intensity = 0;
    sceneFlashLight.intensity = 0;
  }

  function state(strikeAge = Number.POSITIVE_INFINITY) {
    let attention = 0;
    if (currentTarget && strikeAge >= 0 && strikeAge < 3.35) {
      const arrive = smootherStep(THREE.MathUtils.clamp(strikeAge / 0.38, 0, 1));
      const release = 1 - smootherStep(THREE.MathUtils.clamp((strikeAge - 2.05) / 1.3, 0, 1));
      attention = arrive * release * 0.92;
    }
    return {
      active: Boolean(currentTarget),
      attention,
      focus: currentTarget ? impactPoint : null,
      speedScale: THREE.MathUtils.lerp(1, 0.28, attention),
      strikeCount,
      target: currentTarget?.label || ""
    };
  }

  function dispose() {
    enabled = false;
    endStrike();
    scene.remove(group);
  }

  return { dispose, setEnabled, triggerStrike, update };
}

export function lightningStrikeDelay(random = Math.random) {
  const unit = THREE.MathUtils.clamp(Number(random()) || 0, 0, 1);
  return THREE.MathUtils.lerp(
    LIGHTNING_MIN_INTERVAL_SECONDS,
    LIGHTNING_MAX_INTERVAL_SECONDS,
    unit
  );
}

function createImpactTexture(resources) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.16, "rgba(205, 240, 255, 0.98)");
  gradient.addColorStop(0.42, "rgba(38, 134, 254, 0.48)");
  gradient.addColorStop(1, "rgba(38, 134, 254, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  resources.add(texture);
  return texture;
}

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function smootherStep(value) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}
