import {
  annotationEmbeddedImageEffectiveClip,
  annotationImageCropCornerRadii,
  annotationImageCropInsets,
  permanentlyCropAnnotationImage
} from "../../components/image-annotation.js?v=20260730-diagram2-phase6-v1";

const cropCornerKeys = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

export function diagram2ImageEffectiveClip(image) {
  return annotationEmbeddedImageEffectiveClip(image);
}

export function diagram2ImageCropInsets(image) {
  return annotationImageCropInsets(image);
}

export function diagram2ImageCropCornerRadii(image) {
  return annotationImageCropCornerRadii(image);
}

export function diagram2ImageHasReversibleCrop(image) {
  const full = diagram2ImageBounds(image);
  const clip = diagram2ImageEffectiveClip(image);
  return Boolean(full && clip && !sameBounds(full, clip));
}

export function resizeDiagram2CropClip(image, directionInput, pointInput, options = {}) {
  const full = diagram2ImageBounds(image);
  const current = diagram2ImageEffectiveClip(image);
  if (!full || !current) return null;
  const direction = String(directionInput || "").toLowerCase();
  const minimum = Math.max(8, finiteNumber(options.minimumSize, 8));
  const point = snapCropPoint(pointInput, full, options.snap === true, options.gridSize);
  let left = current.x;
  let top = current.y;
  let right = current.x + current.width;
  let bottom = current.y + current.height;
  const fullRight = full.x + full.width;
  const fullBottom = full.y + full.height;

  if (direction.includes("w")) left = clamp(point.x, full.x, right - minimum);
  if (direction.includes("e")) right = clamp(point.x, left + minimum, fullRight);
  if (direction.includes("n")) top = clamp(point.y, full.y, bottom - minimum);
  if (direction.includes("s")) bottom = clamp(point.y, top + minimum, fullBottom);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function diagram2CropPatchFromClip(image, clipInput) {
  const full = diagram2ImageBounds(image);
  const clip = intersectBounds(full, clipInput);
  if (!clip || clip.width < 8 || clip.height < 8) return null;
  return { imageClip: clip, cropVisible: true };
}

export function diagram2CropPatchFromInsets(image, insetsInput = {}) {
  const full = diagram2ImageBounds(image);
  if (!full) return null;
  const current = diagram2ImageCropInsets(image);
  const left = clamp(finiteNumber(insetsInput.left, current.left), 0, full.width - 8);
  const top = clamp(finiteNumber(insetsInput.top, current.top), 0, full.height - 8);
  const right = clamp(finiteNumber(insetsInput.right, current.right), 0, full.width - left - 8);
  const bottom = clamp(finiteNumber(insetsInput.bottom, current.bottom), 0, full.height - top - 8);
  return {
    imageClip: {
      x: full.x + left,
      y: full.y + top,
      width: full.width - left - right,
      height: full.height - top - bottom
    },
    cropVisible: true
  };
}

export function diagram2CropCornerPatch(image, valuesInput = {}) {
  const current = diagram2ImageCropCornerRadii(image);
  const maximum = Math.min(
    finiteNumber(diagram2ImageEffectiveClip(image)?.width, 0),
    finiteNumber(diagram2ImageEffectiveClip(image)?.height, 0)
  ) / 2;
  const values = {};
  cropCornerKeys.forEach(key => {
    values[key] = clamp(finiteNumber(valuesInput[key], current[key]), 0, maximum);
  });
  const uniform = cropCornerKeys.every(key => Math.abs(values[key] - values.topLeft) < 0.001);
  return uniform
    ? { cropCornerRadius: values.topLeft, cropCornerRadii: null }
    : { cropCornerRadius: 0, cropCornerRadii: values };
}

export function diagram2ResetCropPatch(image) {
  const full = diagram2ImageBounds(image);
  if (!full) return null;
  return {
    imageClip: full,
    cropVisible: true,
    cropCornerRadius: 0,
    cropCornerRadii: null
  };
}

export async function permanentlyCropDiagram2Image(image) {
  const state = { width: image?.width || 1, height: image?.height || 1, objects: [{ ...image }] };
  const result = await permanentlyCropAnnotationImage(state, image?.id);
  return { object: state.objects[0], result };
}

function diagram2ImageBounds(image) {
  if (image?.type !== "embedded-image") return null;
  return {
    x: finiteNumber(image.x, 0),
    y: finiteNumber(image.y, 0),
    width: positiveNumber(image.width, 1),
    height: positiveNumber(image.height, 1)
  };
}

function snapCropPoint(pointInput, full, enabled, gridSizeInput) {
  const point = {
    x: clamp(finiteNumber(pointInput?.x, full.x), full.x, full.x + full.width),
    y: clamp(finiteNumber(pointInput?.y, full.y), full.y, full.y + full.height)
  };
  if (!enabled) return point;
  const gridSize = positiveNumber(gridSizeInput, 20);
  return {
    x: clamp(full.x + (Math.round((point.x - full.x) / gridSize) * gridSize), full.x, full.x + full.width),
    y: clamp(full.y + (Math.round((point.y - full.y) / gridSize) * gridSize), full.y, full.y + full.height)
  };
}

function intersectBounds(left, right) {
  if (!left || !right) return null;
  const x = Math.max(left.x, finiteNumber(right.x, left.x));
  const y = Math.max(left.y, finiteNumber(right.y, left.y));
  const endX = Math.min(left.x + left.width, finiteNumber(right.x, left.x) + positiveNumber(right.width, left.width));
  const endY = Math.min(left.y + left.height, finiteNumber(right.y, left.y) + positiveNumber(right.height, left.height));
  return endX > x && endY > y ? { x, y, width: endX - x, height: endY - y } : null;
}

function sameBounds(left, right) {
  return ["x", "y", "width", "height"].every(key => Math.abs(left[key] - right[key]) < 0.001);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
