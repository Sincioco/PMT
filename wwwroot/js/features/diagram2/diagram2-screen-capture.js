export const diagram2ScreenCaptureUnsupportedMessage =
  "Screen capture requires a supported browser and a secure PMT connection such as HTTPS or localhost.";

export const diagram2ScreenCaptureReducedResolutionMessage =
  "The browser supplied this capture at a reduced resolution. Small text may be less sharp than a Windows clipboard screenshot.";

export function createDiagram2ScreenCaptureService(options = {}) {
  const environment = options.environment || globalThis;
  const mediaDevices = options.mediaDevices || environment.navigator?.mediaDevices;
  const getDisplayMedia = typeof options.getDisplayMedia === "function"
    ? options.getDisplayMedia
    : (typeof mediaDevices?.getDisplayMedia === "function"
      ? mediaDevices.getDisplayMedia.bind(mediaDevices)
      : null);
  const createVideoElement = options.createVideoElement
    || (() => environment.document?.createElement?.("video"));
  const createCanvasElement = options.createCanvasElement
    || (() => environment.document?.createElement?.("canvas"));
  const createCaptureController = options.createCaptureController
    || (typeof environment.CaptureController === "function"
      ? () => new environment.CaptureController()
      : null);
  const focusCapturingApplication = options.focusCapturingApplication
    || (() => environment.focus?.());
  const hasFileFactory = typeof options.createFile === "function" || typeof environment.File === "function";
  const createFile = options.createFile
    || ((blob, name, fileOptions) => new environment.File([blob], name, fileOptions));
  const now = options.now || (() => new Date());
  const setTimer = options.setTimeout || environment.setTimeout?.bind(environment);
  const clearTimer = options.clearTimeout || environment.clearTimeout?.bind(environment);
  const requestFrame = options.requestAnimationFrame || environment.requestAnimationFrame?.bind(environment);
  const cancelFrame = options.cancelAnimationFrame || environment.cancelAnimationFrame?.bind(environment);
  const frameTimeoutMs = Math.max(250, Number(options.frameTimeoutMs) || 5000);
  let activeSession = null;
  let destroyed = false;
  let fileSequence = 0;
  let lastDiagnostics = null;

  function supported() {
    return destroyed !== true
      && typeof getDisplayMedia === "function"
      && typeof createVideoElement === "function"
      && typeof createCanvasElement === "function"
      && hasFileFactory
      && environment.isSecureContext !== false;
  }

  async function capture() {
    if (!supported()) throw captureError("NotSupportedError", diagram2ScreenCaptureUnsupportedMessage);
    if (activeSession) throw captureError("InvalidStateError", "A screen capture is already in progress.");

    const session = createCaptureSession();
    activeSession = session;
    try {
      const displayOptions = {
        video: {
          resizeMode: "none"
        },
        audio: false
      };
      session.focusController = safeCaptureController(createCaptureController);
      if (session.focusController) displayOptions.controller = session.focusController;
      session.stream = await getDisplayMedia(displayOptions);
      if (session.canceled) throw session.cancelError;

      session.track = session.stream?.getVideoTracks?.()[0] || null;
      if (!session.track) throw captureError("NotFoundError", "The selected source did not provide a video track.");
      const initialSettings = safeTrackValues(session.track, "getSettings");
      retainCapturingApplicationFocus(session.focusController, initialSettings.displaySurface);
      session.trackEndedHandler = () => {
        if (!session.frameCopied) cancelSession(
          session,
          captureError("CaptureEndedError", "Screen sharing ended before a frame was captured.")
        );
      };
      session.track.addEventListener?.("ended", session.trackEndedHandler);

      const capabilities = safeTrackValues(session.track, "getCapabilities");
      const constraints = fullDetailConstraints(capabilities);
      let constraintError = null;
      if (Object.keys(constraints).length && typeof session.track.applyConstraints === "function") {
        try {
          await session.track.applyConstraints(constraints);
        } catch (error) {
          constraintError = captureErrorDetails(error);
        }
      }
      if (session.canceled) throw session.cancelError;

      session.video = createVideoElement();
      if (!session.video) throw captureError("NotSupportedError", "The browser could not create a screen capture video surface.");
      session.video.muted = true;
      session.video.playsInline = true;
      session.video.srcObject = session.stream;

      if (typeof options.waitForFrame === "function") {
        await options.waitForFrame(session.video, session.track, session);
      } else {
        await waitForCaptureFrame(session, {
          setTimer,
          clearTimer,
          requestFrame,
          cancelFrame,
          frameTimeoutMs
        });
      }
      if (session.canceled) throw session.cancelError;

      const width = finiteDimension(session.video.videoWidth);
      const height = finiteDimension(session.video.videoHeight);
      if (!width || !height) {
        throw captureError("CaptureFrameError", "The selected source did not provide a usable video frame.");
      }

      session.canvas = createCanvasElement();
      if (!session.canvas) throw captureError("CaptureCanvasError", "The browser could not create a screen capture canvas.");
      session.canvas.width = width;
      session.canvas.height = height;
      const context = session.canvas.getContext?.("2d");
      if (!context) throw captureError("CaptureCanvasError", "The browser could not prepare the screen capture image.");
      context.drawImage(session.video, 0, 0, width, height);
      const settings = safeTrackValues(session.track, "getSettings");
      session.frameCopied = true;

      // Stop sharing before PNG encoding or PMT upload work begins.
      stopSessionTracks(session);
      safelyFocusCapturingApplication(focusCapturingApplication);

      const blob = await canvasPngBlob(session.canvas);
      if (!blob) throw captureError("CaptureEncodingError", "The browser could not encode the screen capture as PNG.");
      const capturedAt = now();
      const lastModified = capturedAt instanceof Date && Number.isFinite(capturedAt.getTime())
        ? capturedAt.getTime()
        : Date.now();
      const file = createFile(blob, diagram2ScreenCaptureFileName(capturedAt, fileSequence++), {
        type: "image/png",
        lastModified
      });
      const reducedResolution = screenCaptureIsReducedResolution({
        width,
        height,
        settings,
        capabilities
      });
      lastDiagnostics = Object.freeze({
        width,
        height,
        resizeMode: String(settings.resizeMode || ""),
        displaySurface: String(settings.displaySurface || ""),
        screenPixelRatio: finiteNumberOrNull(settings.screenPixelRatio),
        trackWidth: finiteNumberOrNull(settings.width),
        trackHeight: finiteNumberOrNull(settings.height),
        capabilityMaxWidth: finiteNumberOrNull(capabilities.width?.max),
        capabilityMaxHeight: finiteNumberOrNull(capabilities.height?.max),
        requestedResizeMode: "none",
        constraintsApplied: Object.keys(constraints).length > 0 && constraintError == null,
        constraintError,
        initialSettings: captureSettingsDiagnostics(initialSettings),
        reducedResolution
      });
      options.onDiagnostics?.(lastDiagnostics);
      return {
        file,
        width,
        height,
        reducedResolution,
        diagnostics: lastDiagnostics
      };
    } finally {
      cleanupCaptureSession(session, { cancelFrame });
      if (activeSession === session) activeSession = null;
    }
  }

  function destroy() {
    destroyed = true;
    if (activeSession) {
      cancelSession(activeSession, captureError("EditorDestroyedError", "The Diagram 2 editor was closed."));
    }
  }

  return {
    capture,
    destroy,
    supported,
    busy: () => activeSession != null,
    diagnostics: () => lastDiagnostics
  };
}

export function diagram2ScreenCaptureErrorMessage(error) {
  const name = String(error?.name || "");
  if (name === "NotAllowedError" || name === "AbortError") return "Screen capture canceled.";
  if (name === "InvalidStateError") return "Screen capture must be started directly from the Capture button.";
  if (name === "NotReadableError") return "The selected screen, window, or tab could not be read.";
  if (name === "NotFoundError") return "No screen, window, or tab was available to capture.";
  if (name === "TypeError" || name === "NotSupportedError") return diagram2ScreenCaptureUnsupportedMessage;
  if (name === "CaptureEndedError") return "Screen sharing ended before a frame was captured.";
  if (name === "EditorDestroyedError") return "Screen capture stopped because the Diagram 2 editor was closed.";
  return String(error?.message || "The screen capture could not be inserted.");
}

export function diagram2ScreenCaptureFileName(dateInput = new Date(), sequence = 0) {
  const date = dateInput instanceof Date && Number.isFinite(dateInput.getTime()) ? dateInput : new Date();
  const datePart = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
  const timePart = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
  const suffix = `${pad(date.getMilliseconds(), 3)}-${pad(Math.max(0, Number(sequence) || 0), 3)}`;
  return `PMT-Screen-Capture-${datePart}-${timePart}-${suffix}.png`;
}

function createCaptureSession() {
  return {
    stream: null,
    track: null,
    video: null,
    canvas: null,
    focusController: null,
    trackEndedHandler: null,
    frameCallbackId: null,
    animationFrameIds: new Set(),
    cancelListeners: new Set(),
    canceled: false,
    cancelError: null,
    frameCopied: false,
    tracksStopped: false
  };
}

function cancelSession(session, error) {
  if (!session || session.canceled) return;
  session.canceled = true;
  session.cancelError = error || captureError("AbortError", "Screen capture canceled.");
  stopSessionTracks(session);
  [...session.cancelListeners].forEach(listener => listener(session.cancelError));
}

function stopSessionTracks(session) {
  if (!session || session.tracksStopped) return;
  const tracks = session.stream?.getTracks?.() || [];
  if (!tracks.length) return;
  session.tracksStopped = true;
  tracks.forEach(track => {
    try {
      track.stop?.();
    } catch {
      // A track that has already ended is already released.
    }
  });
}

function cleanupCaptureSession(session, options = {}) {
  if (!session) return;
  stopSessionTracks(session);
  if (session.track && session.trackEndedHandler) {
    session.track.removeEventListener?.("ended", session.trackEndedHandler);
  }
  if (session.video && session.frameCallbackId != null) {
    try {
      session.video.cancelVideoFrameCallback?.(session.frameCallbackId);
    } catch {
      // The callback may have already run.
    }
  }
  session.animationFrameIds.forEach(id => options.cancelFrame?.(id));
  session.animationFrameIds.clear();
  session.cancelListeners.clear();
  if (session.video) {
    try {
      session.video.pause?.();
    } catch {
      // The temporary video may never have started playback.
    }
    session.video.srcObject = null;
    session.video.remove?.();
  }
  session.stream = null;
  session.track = null;
  session.video = null;
  session.canvas = null;
  session.focusController = null;
}

async function waitForCaptureFrame(session, options = {}) {
  const video = session.video;
  try {
    const playback = video.play?.();
    playback?.catch?.(() => {});
  } catch (error) {
    if (!hasVideoDimensions(video)) throw error;
  }
  await waitForVideoDimensions(video, session, options);
  if (typeof video.requestVideoFrameCallback === "function") {
    await waitForVideoFrameCallback(video, session, options);
  } else {
    await waitForAnimationFrames(session, options, 2);
  }
  if (!hasVideoDimensions(video)) {
    throw captureError("CaptureFrameError", "The selected source did not provide a usable video frame.");
  }
}

function waitForVideoDimensions(video, session, options = {}) {
  if (hasVideoDimensions(video)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const eventNames = ["loadedmetadata", "loadeddata", "canplay", "resize"];
    let timerId = null;
    const cleanup = () => {
      eventNames.forEach(name => video.removeEventListener?.(name, check));
      session.cancelListeners.delete(cancel);
      if (timerId != null) options.clearTimer?.(timerId);
    };
    const finish = callback => value => {
      cleanup();
      callback(value);
    };
    const succeed = finish(resolve);
    const fail = finish(reject);
    const check = () => {
      if (hasVideoDimensions(video)) succeed();
    };
    const cancel = error => fail(error);
    eventNames.forEach(name => video.addEventListener?.(name, check));
    session.cancelListeners.add(cancel);
    timerId = options.setTimer?.(() => fail(captureError(
      "CaptureFrameError",
      "Timed out while waiting for the selected source."
    )), options.frameTimeoutMs);
    check();
  });
}

function waitForVideoFrameCallback(video, session, options = {}) {
  return new Promise((resolve, reject) => {
    let timerId = null;
    let settled = false;
    const cleanup = () => {
      session.cancelListeners.delete(cancel);
      if (timerId != null) options.clearTimer?.(timerId);
      session.frameCallbackId = null;
    };
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const succeed = finish(resolve);
    const fail = error => {
      if (session.frameCallbackId != null) {
        try {
          video.cancelVideoFrameCallback?.(session.frameCallbackId);
        } catch {
          // The browser may have delivered the frame at the timeout boundary.
        }
      }
      finish(reject)(error);
    };
    const cancel = error => fail(error);
    session.cancelListeners.add(cancel);
    timerId = options.setTimer?.(() => fail(captureError(
      "CaptureFrameError",
      "Timed out while waiting for a screen capture frame."
    )), options.frameTimeoutMs);
    try {
      const id = video.requestVideoFrameCallback(() => succeed());
      if (!settled) session.frameCallbackId = id;
    } catch (error) {
      fail(error);
    }
  });
}

async function waitForAnimationFrames(session, options = {}, count = 1) {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve, reject) => {
      if (typeof options.requestFrame !== "function") {
        resolve();
        return;
      }
      let timerId = null;
      let settled = false;
      const finish = callback => value => {
        if (settled) return;
        settled = true;
        session.cancelListeners.delete(cancel);
        if (timerId != null) options.clearTimer?.(timerId);
        callback(value);
      };
      const succeed = finish(resolve);
      const fail = finish(reject);
      const cancel = error => fail(error);
      session.cancelListeners.add(cancel);
      let id = null;
      id = options.requestFrame(() => {
        if (id != null) session.animationFrameIds.delete(id);
        succeed();
      });
      if (!settled) session.animationFrameIds.add(id);
      timerId = options.setTimer?.(() => {
        session.animationFrameIds.delete(id);
        options.cancelFrame?.(id);
        fail(captureError("CaptureFrameError", "Timed out while waiting for a screen capture frame."));
      }, options.frameTimeoutMs);
    });
  }
}

function canvasPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof canvas?.toBlob !== "function") {
        reject(captureError("CaptureEncodingError", "The browser cannot encode the screen capture as PNG."));
        return;
      }
      canvas.toBlob(blob => resolve(blob || null), "image/png");
    } catch (error) {
      reject(error);
    }
  });
}

function fullDetailConstraints(capabilities = {}) {
  const constraints = {};
  if (Array.isArray(capabilities.resizeMode) && capabilities.resizeMode.includes("none")) {
    constraints.resizeMode = { exact: "none" };
  }
  if (Number.isFinite(capabilities.width?.max)) constraints.width = { ideal: capabilities.width.max };
  if (Number.isFinite(capabilities.height?.max)) constraints.height = { ideal: capabilities.height.max };
  return constraints;
}

function screenCaptureIsReducedResolution(options = {}) {
  const settings = options.settings || {};
  const capabilities = options.capabilities || {};
  if (String(settings.resizeMode || "").toLowerCase() === "crop-and-scale") return true;
  const width = finiteDimension(options.width);
  const height = finiteDimension(options.height);
  const expectedWidth = Math.max(
    finiteDimension(settings.width),
    finiteDimension(capabilities.width?.max)
  );
  const expectedHeight = Math.max(
    finiteDimension(settings.height),
    finiteDimension(capabilities.height?.max)
  );
  return materiallyBelow(width, expectedWidth) || materiallyBelow(height, expectedHeight);
}

function materiallyBelow(actual, expected) {
  return actual > 0 && expected > 0 && actual < (expected * 0.98);
}

function safeTrackValues(track, methodName) {
  try {
    const values = track?.[methodName]?.();
    return values && typeof values === "object" ? values : {};
  } catch {
    return {};
  }
}

function safeCaptureController(createCaptureController) {
  if (typeof createCaptureController !== "function") return null;
  try {
    const controller = createCaptureController();
    return typeof controller?.setFocusBehavior === "function" ? controller : null;
  } catch {
    return null;
  }
}

function retainCapturingApplicationFocus(controller, displaySurfaceInput) {
  const displaySurface = String(displaySurfaceInput || "").toLowerCase();
  if (!controller || (displaySurface !== "browser" && displaySurface !== "window")) return;
  try {
    controller.setFocusBehavior("focus-capturing-application");
  } catch {
    try {
      controller.setFocusBehavior("no-focus-change");
    } catch {
      // Conditional Focus is optional; the post-frame focus request remains available.
    }
  }
}

function safelyFocusCapturingApplication(focusCapturingApplication) {
  try {
    focusCapturingApplication?.();
  } catch {
    // Browsers and operating systems may reject programmatic foreground changes.
  }
}

function captureSettingsDiagnostics(settings = {}) {
  return Object.freeze({
    width: finiteNumberOrNull(settings.width),
    height: finiteNumberOrNull(settings.height),
    resizeMode: String(settings.resizeMode || ""),
    displaySurface: String(settings.displaySurface || ""),
    screenPixelRatio: finiteNumberOrNull(settings.screenPixelRatio)
  });
}

function captureErrorDetails(error) {
  return Object.freeze({
    name: String(error?.name || "Error"),
    message: String(error?.message || "The full-detail constraints were not applied.")
  });
}

function captureError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function finiteDimension(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasVideoDimensions(video) {
  return finiteDimension(video?.videoWidth) > 0 && finiteDimension(video?.videoHeight) > 0;
}

function pad(value, length = 2) {
  return String(Math.max(0, Number(value) || 0)).padStart(length, "0");
}
