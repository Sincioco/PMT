import {
  annotationEmbeddedImageEffectiveClip,
  annotationImageCropCornerRadii,
  annotationImageCropInsets,
  permanentlyCropAnnotationImage
} from "../../components/image-annotation.js?v=20260731-rte-checkbox-layout-v2";

const cropCornerKeys = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
const maximumCropCornerRadius = 200;

export const diagram2CropNumericDebounceMilliseconds = 200;
export const diagram2CropSelectionQuietMilliseconds = 1000;

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
  const clip = intersectBounds(full, image?.imageClip || full);
  return Boolean(full && clip && !sameBounds(full, clip));
}

export function diagram2ImageHasCropInspector(image) {
  if (image?.type !== "embedded-image") return false;
  const corners = diagram2ImageCropCornerRadii(image);
  return diagram2ImageHasReversibleCrop(image)
    || image.cropPermanent === true
    || cropCornerKeys.some(key => corners[key] > 0);
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
    maximumCropCornerRadius,
    finiteNumber(diagram2ImageEffectiveClip(image)?.width, 0) / 2,
    finiteNumber(diagram2ImageEffectiveClip(image)?.height, 0) / 2
  );
  const values = {};
  cropCornerKeys.forEach(key => {
    values[key] = clamp(finiteNumber(valuesInput[key], current[key]), 0, maximum);
  });
  const uniform = cropCornerKeys.every(key => Math.abs(values[key] - values.topLeft) < 0.001);
  return uniform
    ? { cropCornerRadius: values.topLeft, cropCornerRadii: null }
    : {
        cropCornerRadius: clamp(finiteNumber(image?.cropCornerRadius, 0), 0, maximum),
        cropCornerRadii: values
      };
}

export function diagram2CropOptionsPatch(image, valuesInput = {}) {
  if (image?.type !== "embedded-image") return null;
  const insetPatch = diagram2CropPatchFromInsets(image, valuesInput.insets);
  if (!insetPatch) return null;
  const imageWithInsets = { ...image, ...insetPatch };
  return {
    ...insetPatch,
    ...diagram2CropCornerPatch(imageWithInsets, valuesInput.corners)
  };
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
  const state = {
    width: image?.width || 1,
    height: image?.height || 1,
    objects: [{ ...image, cropVisible: true }]
  };
  const result = await permanentlyCropAnnotationImage(state, image?.id);
  return { object: state.objects[0], result };
}

export function createDiagram2CropNumericAdjustmentScheduler(options = {}) {
  const timers = options.timers || globalThis;
  const setTimer = timers.setTimeout?.bind(timers);
  const clearTimer = timers.clearTimeout?.bind(timers);
  if (typeof setTimer !== "function" || typeof clearTimer !== "function") {
    throw new Error("Crop numeric scheduling requires timer support.");
  }

  let destroyed = false;
  let pendingAdjustment = null;
  let activeImageId = "";
  let commitTimer = 0;
  let quietTimer = 0;
  let commitPromise = null;
  const stats = {
    inputEventCount: 0,
    debounceFiringCount: 0,
    commitCount: 0,
    cancelCount: 0,
    timerCleanupCount: 0
  };

  function schedule(adjustmentInput) {
    if (destroyed) return false;
    const adjustment = cloneCropAdjustment(adjustmentInput);
    if (!adjustment.imageId) return false;
    if (activeImageId && activeImageId !== adjustment.imageId) {
      cancel("image changed");
    }
    if (!activeImageId) {
      activeImageId = adjustment.imageId;
      options.begin?.(adjustment);
    }

    pendingAdjustment = adjustment;
    stats.inputEventCount += 1;
    clearCommitTimer(false);
    clearQuietTimer(false);
    commitTimer = setTimer(() => {
      commitTimer = 0;
      stats.timerCleanupCount += 1;
      stats.debounceFiringCount += 1;
      void flush("debounce");
    }, diagram2CropNumericDebounceMilliseconds);
    quietTimer = setTimer(() => {
      quietTimer = 0;
      stats.timerCleanupCount += 1;
      end("quiet period");
    }, diagram2CropSelectionQuietMilliseconds);
    return true;
  }

  async function flush(reason = "flush") {
    if (destroyed) return false;
    if (!pendingAdjustment) return commitPromise || false;
    clearCommitTimer(true);
    const adjustment = pendingAdjustment;
    pendingAdjustment = null;
    const previousCommit = commitPromise;
    const currentCommit = Promise.resolve(previousCommit)
      .then(() => options.commit?.(adjustment, { reason }))
      .then(committed => {
        if (committed !== false) stats.commitCount += 1;
        return committed !== false;
      });
    commitPromise = currentCommit;
    try {
      return await currentCommit;
    } finally {
      if (commitPromise === currentCommit) commitPromise = null;
    }
  }

  function cancel(reason = "cancel") {
    const imageId = activeImageId || pendingAdjustment?.imageId || "";
    const hadAdjustment = Boolean(imageId || pendingAdjustment || commitTimer || quietTimer);
    clearCommitTimer(true);
    clearQuietTimer(true);
    pendingAdjustment = null;
    activeImageId = "";
    if (hadAdjustment) {
      stats.cancelCount += 1;
      options.cancel?.({ imageId, reason });
    }
    return hadAdjustment;
  }

  function end(reason = "end") {
    const imageId = activeImageId;
    clearQuietTimer(true);
    activeImageId = "";
    if (imageId) options.end?.({ imageId, reason });
    return Boolean(imageId);
  }

  async function flushAndEnd(reason = "flush and end") {
    const committed = await flush(reason);
    end(reason);
    return committed;
  }

  function destroy() {
    if (destroyed) return;
    cancel("destroy");
    destroyed = true;
  }

  function diagnostics() {
    return {
      ...stats,
      activeImageId,
      pendingAdjustment: Boolean(pendingAdjustment),
      pendingCommit: Boolean(commitPromise),
      pendingTimerCount: Number(Boolean(commitTimer)) + Number(Boolean(quietTimer))
    };
  }

  function clearCommitTimer(countCleanup) {
    if (!commitTimer) return;
    clearTimer(commitTimer);
    commitTimer = 0;
    if (countCleanup) stats.timerCleanupCount += 1;
  }

  function clearQuietTimer(countCleanup) {
    if (!quietTimer) return;
    clearTimer(quietTimer);
    quietTimer = 0;
    if (countCleanup) stats.timerCleanupCount += 1;
  }

  return {
    schedule,
    flush,
    flushAndEnd,
    cancel,
    end,
    destroy,
    diagnostics
  };
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

function cloneCropAdjustment(adjustmentInput = {}) {
  return {
    imageId: String(adjustmentInput.imageId || "").trim(),
    values: {
      insets: { ...(adjustmentInput.values?.insets || {}) },
      corners: { ...(adjustmentInput.values?.corners || {}) }
    }
  };
}
