import { normalizeAnnotationState } from "../../components/image-annotation.js?v=20260730-diagram2-phase6-v1";

let diagram2ImageSequence = 0;

export function createDiagram2ObjectId(prefix = "object") {
  diagram2ImageSequence += 1;
  const safePrefix = String(prefix || "object").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "object";
  return `${safePrefix}-${Date.now().toString(36)}-${diagram2ImageSequence.toString(36)}`;
}

export function isDiagram2ImageFile(file) {
  if (!file) return false;
  const type = String(file.type || "").trim().toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(String(file.name || ""));
}

export function diagram2ImageSourceIdentity(source) {
  const value = String(source || "").trim();
  if (!value) return "";
  if (value.startsWith("data:")) {
    const comma = value.indexOf(",");
    const header = comma >= 0 ? value.slice(0, comma) : value;
    const payload = comma >= 0 ? value.slice(comma + 1) : "";
    return `${header}:${payload.length}:${hashDiagram2Text(payload)}`;
  }
  return value;
}

export async function loadDiagram2ImageDimensions(source, options = {}) {
  const ImageConstructor = options.ImageConstructor || globalThis.Image;
  if (typeof ImageConstructor !== "function") {
    throw new Error("Image dimensions are not available in this environment.");
  }
  return new Promise((resolve, reject) => {
    const image = new ImageConstructor();
    image.addEventListener?.("load", () => resolve({
      width: positiveNumber(image.naturalWidth || image.width, 1),
      height: positiveNumber(image.naturalHeight || image.height, 1)
    }), { once: true });
    image.addEventListener?.("error", () => reject(new Error("The image could not be decoded.")), { once: true });
    image.src = String(source || "");
  });
}

export function createDiagram2EmbeddedImage(options = {}) {
  const width = positiveNumber(options.width, 1);
  const height = positiveNumber(options.height, 1);
  const x = finiteNumber(options.x, 0);
  const y = finiteNumber(options.y, 0);
  const object = normalizeAnnotationState({
    width: Math.max(width, x + width),
    height: Math.max(height, y + height),
    objects: [{
      id: String(options.id || createDiagram2ObjectId("embedded-image")),
      type: "embedded-image",
      name: String(options.name || "Image").trim().slice(0, 200) || "Image",
      x,
      y,
      width,
      height,
      source: String(options.source || "").trim(),
      imageClip: { x, y, width, height },
      cropCornerRadius: 0,
      cropVisible: true,
      cropPermanent: false,
      isOriginalImage: options.isOriginalImage === true,
      visible: true,
      locked: false,
      groupId: ""
    }]
  }).objects[0];
  if (!object) throw new Error("The selected image source is not supported.");
  return object;
}

function hashDiagram2Text(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
