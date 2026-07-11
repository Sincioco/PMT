import * as THREE from "../../vendor/three/three.module.min.js";
import { RoomEnvironment } from "../../vendor/three/addons/environments/RoomEnvironment.js?v=0.185.1-pmt1";
import { SVGLoader } from "../../vendor/three/addons/loaders/SVGLoader.js?v=0.185.1-pmt1";
import { createAboutFlightController } from "./about-flight-controller.js?v=20260712-about-3d-flyby-21";
import { createUfoEncounter } from "./about-ufo.js?v=20260712-about-3d-flyby-21";

const INTRO_DURATION_MS = 3000;
const INTRO_FADE_DURATION_MS = 1250;
const LOGO_WORLD_WIDTH = 12;
const EXTRUDE_DEPTH = 64;
const FALLBACK_PORTAL = new THREE.Vector2(1006.56, 443.3);

export function createAboutScene({
  root,
  canvas,
  introElement,
  introCountdownElement,
  statusElement,
  modeElement,
  ufoSpeechElement,
  logoUrl,
  onFailure
}) {
  const startedAt = performance.now();
  const abortController = new AbortController();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.035, 180);
  const resizeObserver = new ResizeObserver(resize);
  const resources = new Set();
  const animatedLights = [];

  let environmentTexture = null;
  let flightController = null;
  let ufoEncounter = null;
  let logoGroup = null;
  let starField = null;
  let frameId = 0;
  let lastFrameAt = startedAt;
  let introHiddenTimer = 0;
  let revealStartedAt = 0;
  let experienceStarted = false;
  let disposed = false;

  try {
    setupRenderer(renderer);
    setupScene(scene, renderer, resources, animatedLights);
    environmentTexture = createEnvironment(renderer);
    scene.environment = environmentTexture;
    starField = createStarField(resources);
    scene.add(starField);
    ufoEncounter = createUfoEncounter({
      scene,
      resources,
      speechElement: ufoSpeechElement
    });

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
      logoGroup.scale.setScalar(0.9);
      scene.add(logoGroup);

      flightController = createAboutFlightController({
        camera,
        canvas,
        root,
        portal: model.portal,
        statusElement,
        modeElement,
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
    flightController?.setCinematicFocus(
      encounter?.focus,
      encounter?.attention || 0,
      encounter?.speedScale || 1
    );
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
    return ufoEncounter?.update(encounterElapsed, reducedMotion) || null;
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
    abortController.abort();
    resizeObserver.disconnect();
    flightController?.dispose();
    flightController = null;
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

  const sunPosition = new THREE.Vector3(10, 8, -20).normalize().multiplyScalar(34);
  const keyLight = new THREE.DirectionalLight(0xfff1ce, 4.8);
  keyLight.position.copy(sunPosition);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 70;
  keyLight.shadow.camera.left = -14;
  keyLight.shadow.camera.right = 14;
  keyLight.shadow.camera.top = 14;
  keyLight.shadow.camera.bottom = -14;
  keyLight.shadow.bias = -0.00025;
  scene.add(keyLight, createVisibleSun(sunPosition, resources));

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

  const floorGeometry = new THREE.PlaneGeometry(80, 80);
  const floorMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x07111f,
    metalness: 0.72,
    roughness: 0.24,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.6;
  floor.receiveShadow = true;
  scene.add(floor);
  resources.add(floorGeometry);
  resources.add(floorMaterial);

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
    sourceGroup.add(mesh);
    resources.add(geometry);
    resources.add(material);

    if (path.userData?.node?.getAttribute("aria-label") === "P") {
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
  const positions = [];
  const colors = [];
  const blue = new THREE.Color(0x75b7ff);
  const white = new THREE.Color(0xeaf6ff);

  for (let index = 0; index < 850; index += 1) {
    const radius = 28 + random() * 48;
    const theta = random() * TAU;
    const phi = Math.acos(2 * random() - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    const color = blue.clone().lerp(white, random() * 0.7);
    colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.11,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.88,
    vertexColors: true,
    depthWrite: false,
    fog: false
  });
  resources.add(geometry);
  resources.add(material);
  return new THREE.Points(geometry, material);
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

const TAU = Math.PI * 2;
