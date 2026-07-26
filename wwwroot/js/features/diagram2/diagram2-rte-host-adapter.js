import { copyTextToClipboard } from "../../components/clipboard.js?v=20260714-invite-email-body";
import {
  buildPortableAnnotationSvg,
  normalizeAnnotationState
} from "../../components/image-annotation.js?v=20260726-d2-line-parity-v1";
import { appUrl } from "../../shared/app-urls.js";
import { loadDiagramCanonicalState } from "../../shared/diagram-documents.js?v=20260725-diagram2-day6-v1";
import {
  createDiagram2Renderer,
  normalizeDiagram2CanonicalState
} from "./diagram2-renderer.js?v=20260726-diagram2-phase3-create-v1";
import { createDiagram2SelectionClipboardText } from "./diagram2-compatibility.js?v=20260725-diagram2-day14-v1";
import {
  createDiagram2DefaultObject,
  createDiagram2EditorController,
  isDiagram2CoreDrawingTool
} from "./diagram2-editor-controller.js?v=20260726-diagram2-phase3-create-v1";
import {
  diagram2ObjectsPaneHtml,
  diagram2EditorShellHtml,
  updateDiagram2ObjectTreeSelection,
  updateDiagram2ShellStatus
} from "./diagram2-editor-shell.js?v=20260726-diagram2-phase3-create-v1";

export async function openDiagram2RteAnnotationHost(options = {}) {
  const image = options.image;
  const editor = options.editor || image?.closest?.(".rich-editor") || null;
  if (!image?.isConnected || !editor) return null;
  const security = normalizeDiagram2RteSecurity(options);
  if (security.canUpdate !== true) {
    options.notify?.("You do not have permission to edit this content.");
    return null;
  }

  const originalReference = String(options.originalReference || "").trim();
  const source = String(options.source || image.getAttribute("src") || "").trim();
  const initialState = await loadDiagram2RteInitialState({
    source,
    annotationUrl: options.annotationUrl,
    originalUrl: options.originalUrl,
    originalReference,
    originalFileName: options.originalFileName,
    annotated: options.annotated === true
  });

  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "dialog image-annotation-dialog diagram2-rte-dialog";
    dialog.dataset.diagram2RteHost = "true";

    const hostAdapter = {
      kind: "rte-annotation",
      mode: "rte-annotation",
      canEdit: security.canUpdate === true,
      canExport: security.canExport !== false,
      fixedOriginalImage: true,
      security,
      async save(payload) {
        if (security.canUpdate !== true) {
          throw new Error("You do not have permission to edit this content.");
        }
        if (typeof options.apply !== "function") {
          throw new Error("Diagram 2 annotation save is not available.");
        }
        return options.apply(payload);
      }
    };
    const controller = createDiagram2EditorController({
      host: hostAdapter,
      state: initialState,
      historyLimit: options.historyLimit || 100
    });

    dialog.innerHTML = diagram2EditorShellHtml({
      includeHeader: true,
      includeFooter: true,
      allowMaximize: true,
      applyLabel: "Apply to RTE",
      title: "Image Annotation 2.0",
      subtitle: "Diagram 2 editor",
      hostKind: hostAdapter.kind,
      selectedZoom: "fit",
      state: controller.state(),
      selectedObjectIds: controller.selectedObjectIds(),
      status: controller.statusSnapshot()
    });
    document.body.appendChild(dialog);

    const surface = dialog.querySelector("[data-diagram2-renderer-surface]");
    let lastDiagnostics = null;
    const renderer = createDiagram2Renderer({
      host: surface,
      onDiagnostics: diagnostics => {
        lastDiagnostics = diagnostics;
      }
    });
    lastDiagnostics = renderer.render(controller.state(), { reason: "initial" });
    lastDiagnostics = renderer.setZoom("fit");
    controller.attachRenderer(renderer);
    controller.markSaved();
    exposeDebugGlobals(controller, renderer, hostAdapter);
    updateDiagram2ShellStatus(dialog, controller.statusSnapshot());

    const abortController = new AbortController();
    const { signal } = abortController;
    controller.onChange(event => {
      updateDiagram2ShellStatus(dialog, event.status);
      updateDiagram2ObjectTreeSelection(dialog, event.status.selectedObjectIds);
    });
    bindDiagram2RteHostEvents({
      dialog,
      editor,
      image,
      controller,
      renderer,
      hostAdapter,
      signal,
      notify: options.notify,
      save: () => saveAndFinish()
    });

    let finished = false;
    const finish = result => {
      if (finished) return;
      finished = true;
      abortController.abort();
      renderer.destroy();
      controller.destroy();
      clearDebugGlobals(controller, renderer, hostAdapter);
      dialog.close();
      dialog.remove();
      options.restoreFocus?.();
      resolve(result);
    };

    const saveAndFinish = async () => {
      if (!image.isConnected) throw new Error("The rich-text editor is no longer open.");
      controller.setBusy(true);
      try {
        await renderer.whenIdle();
        const currentState = controller.state();
        const stateForSave = normalizeDiagram2RteSaveState(currentState, {
          width: currentState.width,
          height: currentState.height,
          originalReference
        });
        const payload = {
          state: stateForSave,
          svg: await buildPortableAnnotationSvg(stateForSave, {
            persistOutputBoundsInMetadata: true
          }),
          originalReference,
          fileName: `${safeFileName(options.originalFileName || originalReference || "image")}.svg`
        };
        await hostAdapter.save(payload);
        controller.markSaved();
        finish(payload);
      } finally {
        controller.setBusy(false);
      }
    };

    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    }, { signal });

    dialog.showModal();
    requestAnimationFrame(() => {
      renderer.fit();
      dialog.querySelector("[data-diagram2-workspace]")?.focus({ preventScroll: true });
    });

    dialog.__diagram2Finish = finish;
  });
}

function normalizeDiagram2RteSecurity(options = {}) {
  const provided = options.security && typeof options.security === "object" ? options.security : {};
  const canUpdate = Object.hasOwn(provided, "canUpdate")
    ? provided.canUpdate === true
    : options.canEdit === true;
  return Object.freeze({
    resource: String(provided.resource || options.resource || "Documentation"),
    canRead: provided.canRead !== false,
    canCreate: provided.canCreate === true,
    canUpdate,
    canDelete: provided.canDelete === true,
    canImport: provided.canImport === true,
    canExport: Object.hasOwn(provided, "canExport") ? provided.canExport === true : true
  });
}

async function loadDiagram2RteInitialState(options = {}) {
  if (options.annotated) {
    const result = await loadDiagramCanonicalState(options.annotationUrl || options.source);
    if (!result.state) throw new Error("The editable Diagram 2 annotation data could not be loaded. The image was left unchanged.");
    return normalizeDiagram2CanonicalState(result.state);
  }

  const original = await loadOriginalImage(options.originalUrl || appUrl(options.source));
  return normalizeAnnotationState(null, {
    width: original.width,
    height: original.height,
    originalReference: options.originalReference,
    seedImageSource: original.source
  });
}

export function normalizeDiagram2RteSaveState(inputState, fallback = {}) {
  const source = inputState && typeof inputState === "object" ? inputState : {};
  const objects = Array.isArray(source.objects)
    ? source.objects.map(object => normalizeDiagram2RteSaveObject(object, source))
    : source.objects;
  return normalizeAnnotationState({
    ...source,
    objects
  }, fallback);
}

function normalizeDiagram2RteSaveObject(object, state) {
  if (!object || object.type !== "embedded-image" || object.isOriginalImage !== true) return object;
  if (object.cropVisible === false || object.cropPermanent === true) return object;
  const fullBounds = diagram2RteObjectBounds(object);
  const clip = diagram2RteBounds(object.imageClip);
  const canvasBounds = diagram2RteCanvasBounds(state);
  if (!fullBounds || !clip || !canvasBounds) return object;
  if (diagram2RteBoundsEqual(clip, fullBounds)) return object;

  const staleMovedClip = diagram2RteBoundsIntersection(fullBounds, canvasBounds);
  if (!staleMovedClip || diagram2RteBoundsEqual(staleMovedClip, fullBounds)) return object;
  if (!diagram2RteBoundsEqual(clip, staleMovedClip)) return object;

  return {
    ...object,
    imageClip: fullBounds
  };
}

function diagram2RteObjectBounds(object) {
  if (!object) return null;
  return {
    x: finiteNumber(object.x, 0),
    y: finiteNumber(object.y, 0),
    width: positiveNumber(object.width, 1),
    height: positiveNumber(object.height, 1)
  };
}

function diagram2RteBounds(input) {
  if (!input || typeof input !== "object") return null;
  return {
    x: finiteNumber(input.x, 0),
    y: finiteNumber(input.y, 0),
    width: positiveNumber(input.width, 1),
    height: positiveNumber(input.height, 1)
  };
}

function diagram2RteCanvasBounds(state) {
  const fallback = {
    x: 0,
    y: 0,
    width: positiveNumber(state?.width, 1),
    height: positiveNumber(state?.height, 1)
  };
  return diagram2RteBounds(state?.canvasBounds) || fallback;
}

function diagram2RteBoundsIntersection(firstInput, secondInput) {
  const first = diagram2RteBounds(firstInput);
  const second = diagram2RteBounds(secondInput);
  if (!first || !second) return null;
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function diagram2RteBoundsEqual(firstInput, secondInput) {
  const first = diagram2RteBounds(firstInput);
  const second = diagram2RteBounds(secondInput);
  if (!first || !second) return false;
  return Math.abs(first.x - second.x) < 0.001
    && Math.abs(first.y - second.y) < 0.001
    && Math.abs(first.width - second.width) < 0.001
    && Math.abs(first.height - second.height) < 0.001;
}

function bindDiagram2RteHostEvents(options = {}) {
  const { dialog, editor, image, controller, renderer, signal, notify } = options;
  const canvas = dialog.querySelector("[data-diagram2-viewer-canvas]");

  dialog.addEventListener("click", event => {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.action || "";
    if (action === "cancel-diagram2-editor") {
      dialog.__diagram2Finish?.(null);
      return;
    }
    if (action === "save-diagram2-document") {
      void options.save().catch(error => notify?.(error?.message || "Diagram 2 annotation could not be applied."));
      return;
    }
    if (action === "set-diagram2-tool") {
      const tool = actionElement.dataset.tool || actionElement.dataset.diagram2Tool || "select";
      if (isDiagram2CoreDrawingTool(tool)) {
        void addDiagram2RteToolbarObject(tool, dialog, controller, renderer);
      } else {
        controller.setActiveTool(tool);
      }
      return;
    }
    if (action === "select-diagram2-object-tree-item") {
      controller.setSelection([actionElement.dataset.objectId]);
      return;
    }
    if (action === "fit-diagram2-viewer") {
      renderer.fit();
      return;
    }
    if (action === "zoom-diagram2-in") {
      renderer.zoomBy(1.1);
      return;
    }
    if (action === "zoom-diagram2-out") {
      renderer.zoomBy(1 / 1.1);
      return;
    }
    if (action === "toggle-diagram2-inspector") {
      dialog.querySelector("[data-diagram2-editor-main]")?.classList.toggle("is-inspector-hidden");
      return;
    }
    if (action === "toggle-diagram2-diagnostics") {
      const diagnostics = dialog.querySelector("[data-diagram2-diagnostics-shell]");
      if (diagnostics) diagnostics.open = !diagnostics.open;
      return;
    }
    if (action === "undo-diagram2") {
      void runDiagram2RteHistoryAction(dialog, controller, renderer, () => controller.undo());
      return;
    }
    if (action === "redo-diagram2") {
      void runDiagram2RteHistoryAction(dialog, controller, renderer, () => controller.redo());
      return;
    }
    if (action === "copy-diagram2-selection") {
      void copyDiagram2RteSelection(controller, notify);
    }
  }, { signal });

  dialog.addEventListener("change", event => {
    if (event.target?.dataset?.filter !== "diagram2-zoom") return;
    const value = String(event.target.value || "fit");
    if (value === "fit") renderer.fit();
    else renderer.setZoom(value);
  }, { signal });

  dialog.addEventListener("keydown", event => {
    if (!image.isConnected || !editor.isConnected) {
      dialog.__diagram2Finish?.(null);
      return;
    }
    const key = String(event.key || "").toLowerCase();
    const usesCommandKey = event.ctrlKey || event.metaKey;
    if (usesCommandKey && key === "s") {
      event.preventDefault();
      void options.save().catch(error => notify?.(error?.message || "Diagram 2 annotation could not be applied."));
      return;
    }
    if (usesCommandKey && key === "z") {
      event.preventDefault();
      void runDiagram2RteHistoryAction(dialog, controller, renderer, () =>
        event.shiftKey ? controller.redo() : controller.undo());
      return;
    }
    if (usesCommandKey && key === "y") {
      event.preventDefault();
      void runDiagram2RteHistoryAction(dialog, controller, renderer, () => controller.redo());
      return;
    }
    if (diagram2EditableEventTarget(event.target)) return;
    const shortcutTool = { v: "select", h: "pan", r: "rectangle", o: "circle", a: "arrow", l: "line", t: "textbox" }[key];
    if (shortcutTool && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (isDiagram2CoreDrawingTool(shortcutTool)) {
        if (!event.repeat) void addDiagram2RteToolbarObject(shortcutTool, dialog, controller, renderer);
      } else {
        controller.setActiveTool(shortcutTool);
      }
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      void controller.moveSelectedObjects(0, -step, { reason: "keyboard nudge", coalesce: true });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      void controller.moveSelectedObjects(0, step, { reason: "keyboard nudge", coalesce: true });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      void controller.moveSelectedObjects(-step, 0, { reason: "keyboard nudge", coalesce: true });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      void controller.moveSelectedObjects(step, 0, { reason: "keyboard nudge", coalesce: true });
    }
  }, { signal });

  bindDiagram2RtePointerEvents({ canvas, controller, renderer, signal });
}

async function addDiagram2RteToolbarObject(type, dialog, controller, renderer) {
  const object = createDiagram2DefaultObject(type, diagram2RteInsertionCenter(dialog, controller, renderer));
  if (!object) return false;
  const added = await controller.addObject(object, {
    label: `Add ${diagram2ToolLabel(type)}`,
    reason: `toolbar add ${type}`
  });
  if (!added) return false;

  controller.setActiveTool("select");
  refreshDiagram2RteObjectsPane(dialog, controller);
  await renderer.whenIdle();
  return true;
}

async function runDiagram2RteHistoryAction(dialog, controller, renderer, action) {
  const result = await action();
  refreshDiagram2RteObjectsPane(dialog, controller);
  await renderer.whenIdle();
  return result;
}

function diagram2RteInsertionCenter(dialog, controller, renderer) {
  const canvas = dialog.querySelector("[data-diagram2-viewer-canvas]");
  const rect = canvas?.getBoundingClientRect?.();
  if (renderer && rect?.width && rect?.height) {
    return renderer.screenToWorld({
      clientX: rect.left + (rect.width / 2),
      clientY: rect.top + (rect.height / 2)
    });
  }
  const current = controller.currentState?.() || {};
  return {
    x: finiteNumber(current.width, 1600) / 2,
    y: finiteNumber(current.height, 900) / 2
  };
}

function refreshDiagram2RteObjectsPane(dialog, controller) {
  const pane = dialog.querySelector("[data-diagram2-objects-pane]");
  if (!pane) return;
  pane.outerHTML = diagram2ObjectsPaneHtml(controller.state(), controller.selectedObjectIds());
}

function diagram2ToolLabel(type) {
  return {
    rectangle: "Rectangle",
    circle: "Circle",
    arrow: "Arrow",
    line: "Line",
    textbox: "Text Box"
  }[String(type || "").trim().toLowerCase()] || "object";
}

function bindDiagram2RtePointerEvents({ canvas, controller, renderer, signal }) {
  if (!canvas) return;
  let panAbortController = null;
  const abortPan = () => {
    panAbortController?.abort();
    panAbortController = null;
    canvas.classList.remove("is-panning", "is-moving-object");
  };
  signal.addEventListener("abort", abortPan, { once: true });

  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    renderer.zoomBy(Math.exp(-event.deltaY * 0.0015), {
      clientX: event.clientX,
      clientY: event.clientY
    });
  }, { passive: false, signal });

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.button !== 1) return;
    const objectNode = event.target.closest?.("[data-diagram2-object-id]");
    if (objectNode && controller.activeTool() !== "pan" && event.button === 0) {
      startDiagram2RteObjectDrag(canvas, objectNode.dataset.diagram2ObjectId, event, controller, renderer, abortPan);
      return;
    }
    if (event.button === 0 && controller.activeTool() !== "pan") {
      controller.setSelection([]);
      return;
    }

    event.preventDefault();
    abortPan();
    const start = { x: event.clientX, y: event.clientY };
    panAbortController = new AbortController();
    const panSignal = panAbortController.signal;
    canvas.classList.add("is-panning");
    canvas.setPointerCapture?.(event.pointerId);
    const move = moveEvent => {
      renderer.panBy(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
      start.x = moveEvent.clientX;
      start.y = moveEvent.clientY;
    };
    const finish = () => abortPan();
    window.addEventListener("pointermove", move, { signal: panSignal });
    window.addEventListener("pointerup", finish, { signal: panSignal, once: true });
    window.addEventListener("pointercancel", finish, { signal: panSignal, once: true });
  }, { signal });
}

function startDiagram2RteObjectDrag(canvas, objectId, event, controller, renderer, abortPan) {
  const selectedIds = diagram2PointerSelection(controller, objectId, event);
  controller.setSelection(selectedIds);
  if (controller.statusSnapshot().canEdit !== true) return;
  if (selectedIds.some(id => diagram2RteSourceImageFixed(controller.getObjectById(id)))) {
    event.preventDefault();
    return;
  }
  abortPan();
  event.preventDefault();

  const startWorld = renderer.screenToWorld({ clientX: event.clientX, clientY: event.clientY });
  let latestDelta = { deltaX: 0, deltaY: 0 };
  let moved = false;
  renderer.beginGeometryPreview({ objectIds: selectedIds, mode: "move" });
  canvas.classList.add("is-moving-object");
  canvas.setPointerCapture?.(event.pointerId);
  const dragAbortController = new AbortController();
  const { signal } = dragAbortController;
  const move = moveEvent => {
    const currentWorld = renderer.screenToWorld({ clientX: moveEvent.clientX, clientY: moveEvent.clientY });
    latestDelta = {
      deltaX: currentWorld.x - startWorld.x,
      deltaY: currentWorld.y - startWorld.y
    };
    moved = moved || Math.abs(latestDelta.deltaX) > 0.5 || Math.abs(latestDelta.deltaY) > 0.5;
    renderer.previewGeometry(latestDelta);
  };
  const finish = () => {
    canvas.classList.remove("is-moving-object");
    dragAbortController.abort();
    if (!moved) {
      renderer.cancelGeometryPreview();
      return;
    }
    renderer.commitGeometryPreview(latestDelta);
    void controller.moveObjects(selectedIds, latestDelta.deltaX, latestDelta.deltaY, {
      reason: "pointer drag",
      rendererAlreadyUpdated: true
    });
  };
  window.addEventListener("pointermove", move, { signal });
  window.addEventListener("pointerup", finish, { signal, once: true });
  window.addEventListener("pointercancel", finish, { signal, once: true });
}

function diagram2RteSourceImageFixed(object) {
  return object
    && object.type === "embedded-image"
    && object.isOriginalImage === true;
}

function diagram2PointerSelection(controller, objectId, event) {
  const id = String(objectId || "").trim();
  if (!id) return [];
  if (!event.shiftKey && !event.ctrlKey && !event.metaKey) return [id];
  const selected = new Set(controller.selectedObjectIds());
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  return [...selected];
}

async function copyDiagram2RteSelection(controller, notify) {
  const selectedObjectIds = controller.selectedObjectIds();
  if (!selectedObjectIds.length) {
    notify?.("Select one or more Diagram objects before copying.");
    return false;
  }
  const text = createDiagram2SelectionClipboardText({
    state: controller.state(),
    selectedObjectIds
  });
  globalThis.__pmtDiagram2SelectionClipboard = text;
  const copied = await copyTextToClipboard(text);
  notify?.(copied ? "Diagram selection copied." : "Diagram selection is ready, but the browser blocked clipboard copy.");
  return copied;
}

async function loadOriginalImage(sourceInput) {
  const source = String(sourceInput || "").trim();
  if (!source) return { source: "", width: 1600, height: 900 };
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.addEventListener("load", () => resolve(element), { once: true });
      element.addEventListener("error", () => reject(new Error("Image load failed.")), { once: true });
      element.src = source;
    });
    return {
      source,
      width: positiveNumber(image.naturalWidth || image.width, 1600),
      height: positiveNumber(image.naturalHeight || image.height, 900)
    };
  } catch {
    return { source, width: 1600, height: 900 };
  }
}

function exposeDebugGlobals(controller, renderer, hostAdapter) {
  globalThis.__pmtDiagram2EditorCore = controller;
  globalThis.__pmtDiagram2Renderer = renderer;
  globalThis.__pmtDiagram2RteHost = hostAdapter;
}

function clearDebugGlobals(controller, renderer, hostAdapter) {
  if (globalThis.__pmtDiagram2EditorCore === controller) globalThis.__pmtDiagram2EditorCore = null;
  if (globalThis.__pmtDiagram2Renderer === renderer) globalThis.__pmtDiagram2Renderer = null;
  if (globalThis.__pmtDiagram2RteHost === hostAdapter) globalThis.__pmtDiagram2RteHost = null;
}

function diagram2EditableEventTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, button, [contenteditable='true'], [contenteditable='']"));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeFileName(value) {
  return String(value || "diagram")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9_.-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "diagram";
}
