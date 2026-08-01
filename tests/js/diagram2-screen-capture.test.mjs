import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeAnnotationState } from "../../wwwroot/js/components/image-annotation.js";
import {
  createDiagram2PmtDiagramFile,
  parseDiagram2PmtDiagramFile
} from "../../wwwroot/js/features/diagram2/diagram2-compatibility.js";
import { createDiagram2EditorController } from "../../wwwroot/js/features/diagram2/diagram2-editor-controller.js";
import { createDiagram2Phase6Host } from "../../wwwroot/js/features/diagram2/diagram2-editor-phase6-host.js";
import {
  createDiagram2ScreenCaptureService,
  diagram2ScreenCaptureErrorMessage,
  diagram2ScreenCaptureFileName,
  diagram2ScreenCaptureUnsupportedMessage
} from "../../wwwroot/js/features/diagram2/diagram2-screen-capture.js";
import { parsePmtDiagramFile } from "../../wwwroot/js/features/diagram/pmt-diagram-file.js";

test("Diagram 2 captures one full-detail frame as PNG and immediately releases every track", async () => {
  const harness = captureHarness();
  const result = await harness.service.capture();

  assert.equal(harness.calls.getDisplayMedia, 1);
  assert.deepEqual(harness.calls.displayOptions, {
    video: { resizeMode: "none" },
    audio: false
  });
  assert.equal(harness.calls.getCapabilities, 1);
  assert.equal(harness.calls.getSettings >= 2, true);
  assert.deepEqual(harness.calls.constraints, {
    resizeMode: { exact: "none" },
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  });
  assert.equal(harness.calls.videoFrameCallbacks, 1);
  assert.equal(harness.calls.drawImage, 1);
  assert.deepEqual(harness.calls.drawArguments.slice(1), [0, 0, 1920, 1080]);
  assert.equal(harness.canvas.width, 1920);
  assert.equal(harness.canvas.height, 1080);
  assert.deepEqual(harness.calls.blobTypes, ["image/png"]);
  assert.equal(harness.video.srcObject, null);
  assert.equal(harness.calls.videoPause, 1);
  assert.equal(harness.calls.trackListenerRemovals, 1);
  assert.equal(harness.tracks.every(track => track.stopCount === 1), true);
  assert.equal(result.file.type, "image/png");
  assert.match(result.file.name, /^PMT-Screen-Capture-2026-08-01-174530-123-000\.png$/);
  assert.equal(result.reducedResolution, false);
  assert.deepEqual(result.diagnostics, harness.service.diagnostics());
  assert.equal(result.diagnostics.displaySurface, "monitor");
  assert.equal(result.diagnostics.screenPixelRatio, 1.5);
});

test("Diagram 2 keeps PMT focused for window capture and requests focus again after copying the frame", async () => {
  const focusBehaviors = [];
  let focusRequests = 0;
  const focusController = {
    setFocusBehavior(value) {
      focusBehaviors.push(value);
    }
  };
  let harness;
  harness = captureHarness({
    settings: {
      width: 1920,
      height: 1080,
      resizeMode: "none",
      displaySurface: "window",
      screenPixelRatio: 1
    },
    createCaptureController: () => focusController,
    focusCapturingApplication: () => {
      focusRequests += 1;
      assert.equal(harness.calls.drawImage, 1);
      assert.equal(harness.tracks.every(track => track.stopCount === 1), true);
    }
  });

  await harness.service.capture();

  assert.equal(harness.calls.displayOptions.controller, focusController);
  assert.deepEqual(focusBehaviors, ["focus-capturing-application"]);
  assert.equal(focusRequests, 1);
});

test("Diagram 2 falls back to the legacy no-focus-change capture preference", async () => {
  const focusBehaviors = [];
  const harness = captureHarness({
    settings: {
      width: 1920,
      height: 1080,
      resizeMode: "none",
      displaySurface: "browser",
      screenPixelRatio: 1
    },
    createCaptureController: () => ({
      setFocusBehavior(value) {
        focusBehaviors.push(value);
        if (value === "focus-capturing-application") throw new TypeError("Unsupported focus value");
      }
    })
  });

  await harness.service.capture();

  assert.deepEqual(focusBehaviors, ["focus-capturing-application", "no-focus-change"]);
});

test("Diagram 2 continues when optional full-detail constraints are rejected", async () => {
  const error = Object.assign(new Error("Unsupported constraint"), { name: "OverconstrainedError" });
  const harness = captureHarness({ constraintError: error });
  const result = await harness.service.capture();

  assert.equal(result.file.type, "image/png");
  assert.deepEqual(result.diagnostics.constraintError, {
    name: "OverconstrainedError",
    message: "Unsupported constraint"
  });
  assert.equal(result.diagnostics.constraintsApplied, false);
  assert.equal(harness.tracks.every(track => track.stopCount === 1), true);
});

test("Diagram 2 detects a browser supplied crop-and-scale capture", async () => {
  const harness = captureHarness({
    width: 1280,
    height: 720,
    settings: {
      width: 1280,
      height: 720,
      resizeMode: "crop-and-scale",
      displaySurface: "window",
      screenPixelRatio: 1
    }
  });
  const result = await harness.service.capture();

  assert.equal(result.reducedResolution, true);
  assert.equal(result.diagnostics.resizeMode, "crop-and-scale");
});

test("Diagram 2 capture failures release resources and produce no PNG", async t => {
  await t.test("zero dimensions", async () => {
    const harness = captureHarness({ width: 0, height: 0, waitForFrame: async () => {} });
    await assert.rejects(harness.service.capture(), { name: "CaptureFrameError" });
    assert.equal(harness.tracks.every(track => track.stopCount === 1), true);
    assert.equal(harness.video.srcObject, null);
    assert.equal(harness.calls.drawImage, 0);
  });

  await t.test("null PNG Blob", async () => {
    const harness = captureHarness({ pngBlob: null });
    await assert.rejects(harness.service.capture(), { name: "CaptureEncodingError" });
    assert.equal(harness.tracks.every(track => track.stopCount === 1), true);
    assert.equal(harness.video.srcObject, null);
  });

  await t.test("stream ends before its first frame", async () => {
    const harness = captureHarness({ frameEndsStream: true });
    await assert.rejects(harness.service.capture(), { name: "CaptureEndedError" });
    assert.equal(harness.tracks.every(track => track.stopCount === 1), true);
    assert.equal(harness.video.srcObject, null);
    assert.equal(harness.calls.videoFrameCancellations, 1);
  });
});

test("Diagram 2 destroys an in-flight capture before insertion can continue", async () => {
  let resolveDisplayMedia;
  const displayMedia = new Promise(resolve => {
    resolveDisplayMedia = resolve;
  });
  const harness = captureHarness({ getDisplayMedia: () => displayMedia });
  const pending = harness.service.capture();
  await Promise.resolve();

  assert.equal(harness.service.busy(), true);
  harness.service.destroy();
  resolveDisplayMedia(harness.stream);
  await assert.rejects(pending, { name: "EditorDestroyedError" });
  assert.equal(harness.tracks.every(track => track.stopCount === 1), true);
  assert.equal(harness.service.busy(), false);
});

test("Diagram 2 reports unsupported and canceled capture states without browser workarounds", async () => {
  const unsupported = createDiagram2ScreenCaptureService({
    environment: { isSecureContext: false },
    getDisplayMedia: async () => null,
    createVideoElement: () => ({}),
    createCanvasElement: () => ({}),
    createFile: () => ({})
  });
  assert.equal(unsupported.supported(), false);
  await assert.rejects(unsupported.capture(), { name: "NotSupportedError" });
  assert.equal(diagram2ScreenCaptureErrorMessage({ name: "NotSupportedError" }), diagram2ScreenCaptureUnsupportedMessage);
  assert.equal(diagram2ScreenCaptureErrorMessage({ name: "NotAllowedError" }), "Screen capture canceled.");
  assert.equal(
    diagram2ScreenCaptureFileName(new Date(2026, 7, 1, 17, 45, 30, 123), 7),
    "PMT-Screen-Capture-2026-08-01-174530-123-007.png"
  );
});

test("Diagram 2 Capture reuses Add Image, selects the image, and returns to Select with one history entry", async () => {
  const renderer = captureRenderer();
  const controller = captureController(renderer);
  const root = captureRoot();
  const file = captureFile();
  const deferred = deferredValue();
  let captureCount = 0;
  let serviceBusy = false;
  let uploadedFile = null;
  let afterMutationCount = 0;
  const notifications = [];
  const service = {
    supported: () => true,
    busy: () => serviceBusy,
    diagnostics: () => ({ width: 800, height: 450 }),
    destroy() {},
    async capture() {
      captureCount += 1;
      serviceBusy = true;
      try {
        return await deferred.promise;
      } finally {
        serviceBusy = false;
      }
    }
  };
  const host = createDiagram2Phase6Host({
    root,
    controller,
    renderer,
    screenCaptureService: service,
    uploadEmbeddedImage: async input => {
      uploadedFile = input;
      return { url: "/uploads/capture.png" };
    },
    loadImageDimensions: async () => ({ width: 800, height: 450 }),
    insertionCenter: () => ({ x: 600, y: 400 }),
    canMutate: () => true,
    afterMutation: async () => {
      afterMutationCount += 1;
    },
    notify: message => notifications.push(message)
  });
  const abortController = new AbortController();
  host.bind(abortController.signal);
  controller.setActiveTool("rectangle");

  const pending = host.handleAction("capture-diagram2-screen");
  await Promise.resolve();
  assert.equal(root.captureButton.disabled, true);
  assert.equal(root.captureButton.attributes.get("aria-busy"), "true");
  deferred.resolve({
    file,
    reducedResolution: false,
    diagnostics: { width: 800, height: 450 }
  });
  assert.equal(await pending, true);

  assert.equal(captureCount, 1);
  assert.equal(uploadedFile, file);
  assert.equal(afterMutationCount, 1);
  assert.equal(controller.currentState().objects.length, 1);
  const image = controller.currentState().objects[0];
  assert.equal(image.type, "embedded-image");
  assert.equal(image.source, "/uploads/capture.png");
  assert.equal(image.width / image.height, 800 / 450);
  assert.deepEqual(controller.selectedObjectIds(), [image.id]);
  assert.equal(controller.activeTool(), "select");
  assert.equal(renderer.cropTargetId, undefined);
  assert.equal(renderer.selectionChrome, undefined);
  assert.equal(root.workspace.focusCount, 1);
  assert.equal(controller.historyStatus().entryCount, 1);
  assert.equal(controller.statusSnapshot().dirty, true);
  assert.equal(renderer.fullRenderCount, 0);
  assert.equal(renderer.relationshipReroutes, 0);
  assert.equal(renderer.decodeCount, 0);
  assert.equal(root.captureButton.disabled, false);
  assert.equal(root.captureButton.attributes.get("aria-busy"), "false");
  assert.deepEqual(notifications, [
    "Choose a screen, window, or tab to capture.",
    "Adding screen capture...",
    "Screen capture inserted."
  ]);

  assert.equal(await controller.undo(), true);
  assert.equal(controller.currentState().objects.length, 0);
  assert.equal(await controller.undo(), false);
  assert.equal(await controller.redo(), true);
  assert.equal(await controller.redo(), false);
  assert.equal(captureCount, 1);
  assert.equal(controller.getObjectById(image.id).source, "/uploads/capture.png");

  const exported = createDiagram2PmtDiagramFile({ state: controller.currentState(), name: "Capture" });
  const reopened = parseDiagram2PmtDiagramFile(exported);
  const reopenedByDiagram1 = parsePmtDiagramFile(exported);
  assert.equal(reopened.state.objects.find(object => object.id === image.id)?.source, "/uploads/capture.png");
  assert.equal(reopenedByDiagram1.state.objects.find(object => object.id === image.id)?.source, "/uploads/capture.png");

  abortController.abort();
});

test("Diagram 2 Capture cancellation, upload failure, read-only, and editor close leave history unchanged", async t => {
  await t.test("chooser cancellation", async () => {
    const setup = captureHostSetup({
      capture: async () => {
        throw Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
      }
    });
    assert.equal(await setup.host.handleAction("capture-diagram2-screen"), true);
    assert.equal(setup.controller.currentState().objects.length, 0);
    assert.equal(setup.controller.historyStatus().entryCount, 0);
    assert.equal(setup.root.captureButton.disabled, false);
    assert.equal(setup.notifications.at(-1), "Screen capture canceled.");
    setup.cleanup();
  });

  await t.test("persistent source failure", async () => {
    const setup = captureHostSetup({
      uploadEmbeddedImage: async () => {
        throw new Error("Upload failed.");
      }
    });
    assert.equal(await setup.host.handleAction("capture-diagram2-screen"), true);
    assert.equal(setup.controller.currentState().objects.length, 0);
    assert.equal(setup.controller.historyStatus().entryCount, 0);
    assert.equal(setup.notifications.at(-1), "Upload failed.");
    setup.cleanup();
  });

  await t.test("read-only host", async () => {
    let captureCount = 0;
    const setup = captureHostSetup({
      canMutate: () => false,
      capture: async () => {
        captureCount += 1;
        return { file: captureFile(), reducedResolution: false };
      }
    });
    assert.equal(setup.root.captureButton.disabled, true);
    assert.equal(await setup.host.handleAction("capture-diagram2-screen"), true);
    assert.equal(captureCount, 0);
    assert.equal(setup.controller.historyStatus().entryCount, 0);
    setup.cleanup();
  });

  await t.test("editor closes while capture is active", async () => {
    const deferred = deferredValue();
    let destroyCount = 0;
    const setup = captureHostSetup({
      capture: () => deferred.promise,
      destroy: () => {
        destroyCount += 1;
      }
    });
    const pending = setup.host.handleAction("capture-diagram2-screen");
    await Promise.resolve();
    setup.cleanup();
    deferred.resolve({ file: captureFile(), reducedResolution: false });
    await pending;
    assert.equal(destroyCount, 1);
    assert.equal(setup.controller.currentState().objects.length, 0);
    assert.equal(setup.controller.historyStatus().entryCount, 0);
  });
});

test("Diagram 2 Capture is in the shared toolbar path immediately above Crop", async () => {
  const shellSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-editor-shell.js", import.meta.url),
    "utf8"
  );
  const captureSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-screen-capture.js", import.meta.url),
    "utf8"
  );
  const topNavSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2.js", import.meta.url),
    "utf8"
  );
  const rteSource = await readFile(
    new URL("../../wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js", import.meta.url),
    "utf8"
  );
  const captureIndex = shellSource.indexOf("capture-diagram2-screen");
  const cropIndex = shellSource.indexOf("diagram2ToolPaneButton(\"crop\"");

  assert.equal(captureIndex > 0 && captureIndex < cropIndex, true);
  assert.match(shellSource, /Capture screen, window, or tab/);
  assert.match(shellSource, /data-diagram2-screen-capture/);
  assert.match(shellSource, /capture:\s*`<path/);
  assert.match(topNavSource, /createDiagram2Phase6Host/);
  assert.match(rteSource, /createDiagram2Phase6Host/);
  assert.doesNotMatch(captureSource, /MediaRecorder|RTCPeerConnection|video\/(webm|mp4)|createObjectURL/);
});

function captureHarness(options = {}) {
  const calls = {
    getDisplayMedia: 0,
    displayOptions: null,
    getCapabilities: 0,
    getSettings: 0,
    constraints: null,
    videoFrameCallbacks: 0,
    videoFrameCancellations: 0,
    drawImage: 0,
    drawArguments: [],
    blobTypes: [],
    videoPause: 0,
    trackListenerRemovals: 0
  };
  const settings = options.settings || {
    width: options.width ?? 1920,
    height: options.height ?? 1080,
    resizeMode: "none",
    displaySurface: "monitor",
    screenPixelRatio: 1.5
  };
  const capabilities = options.capabilities || {
    width: { max: 1920 },
    height: { max: 1080 },
    resizeMode: ["none", "crop-and-scale"]
  };
  const trackListeners = new Map();
  const videoTrack = {
    stopCount: 0,
    getCapabilities() {
      calls.getCapabilities += 1;
      return capabilities;
    },
    getSettings() {
      calls.getSettings += 1;
      return settings;
    },
    async applyConstraints(constraints) {
      calls.constraints = constraints;
      if (options.constraintError) throw options.constraintError;
    },
    addEventListener(name, listener) {
      trackListeners.set(name, listener);
    },
    removeEventListener(name, listener) {
      if (trackListeners.get(name) === listener) trackListeners.delete(name);
      calls.trackListenerRemovals += 1;
    },
    stop() {
      this.stopCount += 1;
    }
  };
  const auxiliaryTrack = {
    stopCount: 0,
    stop() {
      this.stopCount += 1;
    }
  };
  const tracks = [videoTrack, auxiliaryTrack];
  const stream = {
    getVideoTracks: () => [videoTrack],
    getTracks: () => tracks
  };
  const video = {
    muted: false,
    playsInline: false,
    srcObject: null,
    videoWidth: options.width ?? 1920,
    videoHeight: options.height ?? 1080,
    async play() {},
    pause() {
      calls.videoPause += 1;
    },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    requestVideoFrameCallback(callback) {
      calls.videoFrameCallbacks += 1;
      queueMicrotask(() => {
        if (options.frameEndsStream) trackListeners.get("ended")?.();
        else callback(0, {});
      });
      return 42;
    },
    cancelVideoFrameCallback() {
      calls.videoFrameCancellations += 1;
    }
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage(...args) {
        calls.drawImage += 1;
        calls.drawArguments = args;
      }
    }),
    toBlob(callback, type) {
      calls.blobTypes.push(type);
      assert.equal(tracks.every(track => track.stopCount === 1), true);
      queueMicrotask(() => callback(options.pngBlob === undefined
        ? new Blob(["png"], { type: "image/png" })
        : options.pngBlob));
    }
  };
  const getDisplayMedia = options.getDisplayMedia || (async displayOptions => {
    calls.getDisplayMedia += 1;
    calls.displayOptions = displayOptions;
    return stream;
  });
  const service = createDiagram2ScreenCaptureService({
    environment: { isSecureContext: true },
    getDisplayMedia: async displayOptions => {
      if (options.getDisplayMedia) {
        calls.getDisplayMedia += 1;
        calls.displayOptions = displayOptions;
      }
      return getDisplayMedia(displayOptions);
    },
    createVideoElement: () => video,
    createCanvasElement: () => canvas,
    createCaptureController: options.createCaptureController,
    focusCapturingApplication: options.focusCapturingApplication,
    createFile: (blob, name, fileOptions) => ({
      blob,
      name,
      type: fileOptions.type,
      lastModified: fileOptions.lastModified
    }),
    waitForFrame: options.waitForFrame,
    now: () => new Date(2026, 7, 1, 17, 45, 30, 123),
    frameTimeoutMs: 250
  });
  return { service, calls, stream, tracks, video, canvas };
}

function captureHostSetup(options = {}) {
  const renderer = captureRenderer();
  const controller = captureController(renderer);
  const root = captureRoot();
  const notifications = [];
  let serviceBusy = false;
  const service = {
    supported: options.supported || (() => true),
    busy: () => serviceBusy,
    diagnostics: () => null,
    destroy: options.destroy || (() => {}),
    async capture() {
      serviceBusy = true;
      try {
        if (options.capture) return await options.capture();
        return { file: captureFile(), reducedResolution: false };
      } finally {
        serviceBusy = false;
      }
    }
  };
  const host = createDiagram2Phase6Host({
    root,
    controller,
    renderer,
    screenCaptureService: service,
    uploadEmbeddedImage: options.uploadEmbeddedImage || (async () => ({ url: "/uploads/capture.png" })),
    loadImageDimensions: async () => ({ width: 640, height: 360 }),
    insertionCenter: () => ({ x: 500, y: 300 }),
    canMutate: options.canMutate || (() => true),
    afterMutation: async () => {},
    notify: message => notifications.push(message)
  });
  const abortController = new AbortController();
  const cleanup = host.bind(abortController.signal);
  return {
    host,
    controller,
    renderer,
    root,
    notifications,
    cleanup: () => abortController.abort() || cleanup()
  };
}

function captureController(renderer) {
  return createDiagram2EditorController({
    renderer,
    host: {
      kind: "diagram-document",
      canEdit: true,
      canExport: true,
      security: {
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
        canImport: true,
        canExport: true
      }
    },
    state: normalizeAnnotationState({
      version: 1,
      width: 1200,
      height: 800,
      objects: []
    })
  });
}

function captureRenderer() {
  return {
    fullRenderCount: 0,
    relationshipReroutes: 0,
    decodeCount: 0,
    addedObjectIds: [],
    removedObjectIds: [],
    beginDiagramUpdate() {},
    endDiagramUpdate() {},
    addObject(object) {
      this.addedObjectIds.push(object.id);
    },
    removeObject(id) {
      this.removedObjectIds.push(id);
    },
    setSelectedIds(ids) {
      this.selectedIds = [...ids];
      return {};
    },
    setCanvasOptions() {},
    setCropTarget(id) {
      this.cropTargetId = id;
    },
    setSelectionChromeSuppressed(id, suppressed) {
      this.selectionChrome = { id, suppressed };
    },
    clearCropPreview() {}
  };
}

function captureRoot() {
  const captureButton = {
    dataset: {
      diagram2ScreenCaptureSupported: "false",
      diagram2ScreenCaptureBusy: "false"
    },
    attributes: new Map(),
    disabled: true,
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
  };
  const workspace = {
    focusCount: 0,
    focus() {
      this.focusCount += 1;
    }
  };
  return {
    captureButton,
    workspace,
    querySelector(selector) {
      if (selector === "[data-diagram2-screen-capture]") return captureButton;
      if (selector === "[data-diagram2-workspace]") return workspace;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {}
  };
}

function captureFile() {
  return {
    name: "PMT-Screen-Capture-2026-08-01-174530-123-000.png",
    type: "image/png",
    lastModified: 1785587130123
  };
}

function deferredValue() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
