import {
  diagram2SelectionResizeBounds,
  resizeDiagram2ObjectsGeometry
} from "./diagram2-editor-controller.js?v=20260728-diagram2-phase4-v1";

const diagram2ShortcutTools = {
  v: "select",
  h: "pan",
  r: "rectangle",
  o: "circle",
  a: "arrow",
  l: "line",
  t: "textbox",
  y: "rich-text"
};

export function bindDiagram2EditorInteractions(options = {}) {
  const {
    canvas,
    controller,
    renderer,
    signal
  } = options;
  if (!canvas || !controller || !renderer || !signal) return () => {};

  const eventWindow = canvas.ownerDocument?.defaultView || globalThis.window;
  const contextMenu = options.root?.querySelector?.("[data-diagram2-context-menu]") || null;
  let gesture = null;
  let lastObjectPointerDown = { id: "", time: 0 };

  const closeContextMenu = () => {
    if (!contextMenu || contextMenu.hidden) return;
    contextMenu.hidden = true;
    options.root?.classList?.remove("rich-image-menu-open");
  };

  const finishGesture = async commit => {
    const active = gesture;
    if (!active) return;
    gesture = null;
    active.abortController.abort();
    canvas.classList.remove("is-panning", "is-moving-object", "is-resizing-object", "is-selecting");
    renderer.clearMarquee?.();

    if (active.kind === "move") {
      if (!commit || !active.changed) {
        renderer.cancelGeometryPreview();
        options.onDiagnostics?.(renderer.diagnostics?.());
        return;
      }
      renderer.commitGeometryPreview(active.geometry);
      await controller.moveObjects(active.objectIds, active.geometry.deltaX, active.geometry.deltaY, {
        reason: "pointer drag",
        rendererAlreadyUpdated: true
      });
      await afterMutation(options);
      return;
    }

    if (active.kind === "resize") {
      if (!commit || !active.changed) {
        renderer.cancelGeometryPreview();
        options.onDiagnostics?.(renderer.diagnostics?.());
        return;
      }
      renderer.commitGeometryPreview({ objects: active.objects });
      await controller.resizeObjects(active.objects, {
        reason: "pointer resize",
        rendererAlreadyUpdated: true
      });
      await afterMutation(options);
      return;
    }

    if (active.kind === "marquee" && commit) {
      controller.setSelection(active.selection);
      options.onStateChange?.();
    }
  };

  const cancelGesture = () => {
    void finishGesture(false);
  };
  signal.addEventListener("abort", cancelGesture, { once: true });

  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    if (typeof options.onWheel === "function") {
      options.onWheel(event);
      return;
    }
    options.onDiagnostics?.(renderer.zoomBy(Math.exp(-event.deltaY * 0.0015), {
      clientX: event.clientX,
      clientY: event.clientY
    }));
  }, { passive: false, signal });

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.button !== 1) return;
    const handle = event.target.closest?.("[data-diagram2-resize-handle]");
    const objectNode = event.target.closest?.("[data-diagram2-object-id]");
    const objectId = String(objectNode?.dataset?.diagram2ObjectId || "").trim();
    const activeTool = controller.activeTool();
    const pointerTime = Number(event.timeStamp || Date.now());
    const repeatedObjectClick = objectId
      && lastObjectPointerDown.id === objectId
      && pointerTime - lastObjectPointerDown.time <= 500;

    if (event.button === 0 && objectId && (Number(event.detail) >= 2 || repeatedObjectClick) && activeTool !== "pan") {
      const object = controller.getObjectById(objectId);
      if (object && ["textbox", "rich-text"].includes(object.type)) {
        event.preventDefault();
        lastObjectPointerDown = { id: "", time: 0 };
        controller.setSelection([object.id]);
        options.onStateChange?.();
        void options.onEditText?.(object);
        return;
      }
    }
    if (event.button === 0 && objectId && activeTool !== "pan") {
      lastObjectPointerDown = { id: objectId, time: pointerTime };
    } else if (event.button === 0) {
      lastObjectPointerDown = { id: "", time: 0 };
    }

    if (event.button === 0 && handle && canvas.contains(handle)) {
      startResize(
        event,
        handle.closest("[data-diagram2-selection-id]")?.dataset?.diagram2SelectionId,
        handle.dataset.diagram2ResizeHandle
      );
      return;
    }

    if (event.button === 0 && objectId && canvas.contains(objectNode) && activeTool === "format-painter") {
      event.preventDefault();
      void controller.applyFormatPainter([objectId]).then(applied => {
        if (applied) return afterMutation(options);
        return null;
      });
      return;
    }

    if (event.button === 0 && objectId && canvas.contains(objectNode) && activeTool !== "pan") {
      startMove(event, objectId);
      return;
    }

    if (event.button === 0 && activeTool === "format-painter") {
      event.preventDefault();
      controller.cancelFormatPainter();
      options.onStateChange?.();
      return;
    }

    if (event.button === 0 && activeTool !== "pan") {
      startMarquee(event);
      return;
    }

    startPan(event);
  }, { signal });

  canvas.addEventListener("dblclick", event => {
    const objectNode = event.target.closest?.("[data-diagram2-object-id]");
    const object = controller.getObjectById(objectNode?.dataset?.diagram2ObjectId);
    if (!object || !["textbox", "rich-text"].includes(object.type)) return;
    event.preventDefault();
    controller.setSelection([object.id]);
    options.onStateChange?.();
    void options.onEditText?.(object);
  }, { signal });

  canvas.addEventListener("auxclick", event => {
    if (event.button === 1) event.preventDefault();
  }, { signal });

  canvas.addEventListener("contextmenu", event => {
    if (!contextMenu) return;
    const objectId = String(
      event.target.closest?.("[data-diagram2-object-id]")?.dataset?.diagram2ObjectId
      || event.target.closest?.("[data-diagram2-selection-id]")?.dataset?.diagram2SelectionId
      || ""
    );
    if (!objectId) return;
    event.preventDefault();
    event.stopPropagation();
    closeContextMenu();
    if (objectId && !controller.selectedObjectIds().includes(objectId)) {
      controller.setSelection([objectId]);
      options.onStateChange?.();
    }
    controller.setActiveTool("select");
    options.onStateChange?.();
    contextMenu.hidden = false;
    contextMenu.style.position = "fixed";
    options.root?.classList?.add("rich-image-menu-open");
    const margin = 8;
    const maximumLeft = Math.max(margin, eventWindow.innerWidth - contextMenu.offsetWidth - margin);
    const maximumTop = Math.max(margin, eventWindow.innerHeight - contextMenu.offsetHeight - margin);
    contextMenu.style.left = `${Math.round(Math.max(margin, Math.min(event.clientX, maximumLeft)))}px`;
    contextMenu.style.top = `${Math.round(Math.max(margin, Math.min(event.clientY, maximumTop)))}px`;
    const renderedRect = contextMenu.getBoundingClientRect();
    const correctionX = renderedRect.left < margin
      ? margin - renderedRect.left
      : renderedRect.right > eventWindow.innerWidth - margin
        ? (eventWindow.innerWidth - margin) - renderedRect.right
        : 0;
    const correctionY = renderedRect.top < margin
      ? margin - renderedRect.top
      : renderedRect.bottom > eventWindow.innerHeight - margin
        ? (eventWindow.innerHeight - margin) - renderedRect.bottom
        : 0;
    if (correctionX) contextMenu.style.left = `${Math.round(Number.parseFloat(contextMenu.style.left) + correctionX)}px`;
    if (correctionY) contextMenu.style.top = `${Math.round(Number.parseFloat(contextMenu.style.top) + correctionY)}px`;
    contextMenu.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
  }, { signal });

  eventWindow.addEventListener("pointerdown", event => {
    if (!contextMenu || contextMenu.hidden || event.target.closest?.("[data-diagram2-context-menu]")) return;
    closeContextMenu();
  }, { signal });

  options.root?.addEventListener?.("click", event => {
    if (!event.target.closest?.("[data-diagram2-context-menu] [data-action]")) return;
    closeContextMenu();
  }, { signal });
  options.root?.querySelector?.("[data-diagram2-workspace]")?.addEventListener("scroll", closeContextMenu, { signal });

  eventWindow.addEventListener("keydown", event => {
    if (options.isActive?.() === false) return;
    const key = String(event.key || "").toLowerCase();
    const command = event.ctrlKey || event.metaKey;

    if (contextMenu && !contextMenu.hidden) {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        closeContextMenu();
        canvas.focus?.({ preventScroll: true });
        return;
      }
      const items = [...contextMenu.querySelectorAll("button:not(:disabled)")];
      const currentIndex = items.indexOf(canvas.ownerDocument.activeElement);
      const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (direction && items.length) {
        event.preventDefault();
        const fallbackIndex = direction > 0 ? 0 : items.length - 1;
        const nextIndex = currentIndex < 0
          ? fallbackIndex
          : (currentIndex + direction + items.length) % items.length;
        items[nextIndex]?.focus({ preventScroll: true });
        return;
      }
    }
    if (event.key === "Escape" && gesture) {
      event.preventDefault();
      cancelGesture();
      return;
    }
    if (event.key === "Escape" && controller.activeTool() === "format-painter") {
      event.preventDefault();
      controller.cancelFormatPainter();
      options.onStateChange?.();
      return;
    }
    if (editableEventTarget(event.target)) return;
    if (command && key === "s") {
      event.preventDefault();
      void options.onSave?.();
      return;
    }
    if (command && key === "z") {
      event.preventDefault();
      void (event.shiftKey ? options.onRedo?.() : options.onUndo?.());
      return;
    }
    if (command && key === "y") {
      event.preventDefault();
      void options.onRedo?.();
      return;
    }
    if (command && key === "a") {
      event.preventDefault();
      controller.selectAll();
      options.onStateChange?.();
      return;
    }
    if (command && key === "g") {
      event.preventDefault();
      void (event.shiftKey ? options.onUngroup?.() : options.onGroup?.());
      return;
    }
    if (command && key === "c") {
      event.preventDefault();
      void options.onCopy?.();
      return;
    }
    if (command && key === "v") {
      if (typeof options.onPasteEvent === "function") return;
      event.preventDefault();
      void options.onPaste?.();
      return;
    }
    if (command && key === "d") {
      event.preventDefault();
      void options.onDuplicate?.();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      void options.onDelete?.();
      return;
    }

    const shortcutTool = diagram2ShortcutTools[key];
    if (shortcutTool && !command && !event.altKey) {
      event.preventDefault();
      if (["rectangle", "circle", "arrow", "line", "textbox", "rich-text"].includes(shortcutTool)) {
        if (!event.repeat) void options.onAddObject?.(shortcutTool);
      } else {
        controller.setActiveTool(shortcutTool);
        options.onStateChange?.();
      }
      return;
    }

    const step = controller.keyboardNudgeStep(event.shiftKey);
    const delta = {
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0]
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    void controller.moveSelectedObjects(delta[0], delta[1], {
      reason: "keyboard nudge",
      coalesce: true
    }).then(applied => {
      if (applied) return afterMutation(options);
      return null;
    });
  }, { signal });

  if (typeof options.onPasteEvent === "function") {
    eventWindow.addEventListener("paste", event => {
      if (options.isActive?.() === false || editableEventTarget(event.target)) return;
      void options.onPasteEvent(event);
    }, { signal });
  }

  function startPan(event) {
    event.preventDefault();
    cancelGesture();
    const abortController = new AbortController();
    gesture = {
      kind: "pan",
      abortController,
      point: { x: event.clientX, y: event.clientY }
    };
    canvas.classList.add("is-panning");
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "pan") return;
      const deltaX = moveEvent.clientX - gesture.point.x;
      const deltaY = moveEvent.clientY - gesture.point.y;
      gesture.point = { x: moveEvent.clientX, y: moveEvent.clientY };
      options.onPan?.(deltaX, deltaY);
      options.onDiagnostics?.(renderer.panBy(deltaX, deltaY));
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function startMove(event, objectId) {
    event.preventDefault();
    cancelGesture();
    const selection = pointerSelection(controller, objectId, event);
    controller.setSelection(selection);
    options.onStateChange?.();
    if (options.canMutate?.() === false || selection.some(id => {
      const object = controller.getObjectById(id);
      return object?.locked === true || objectPositionFixed(object);
    })) return;

    const abortController = new AbortController();
    gesture = {
      kind: "move",
      abortController,
      objectIds: selection,
      start: renderer.screenToWorld(event),
      geometry: { deltaX: 0, deltaY: 0 },
      changed: false
    };
    renderer.beginGeometryPreview({ objectIds: selection, mode: "move" });
    canvas.classList.add("is-moving-object");
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "move") return;
      const point = renderer.screenToWorld(moveEvent);
      const delta = controller.snapMovement(
        gesture.objectIds,
        point.x - gesture.start.x,
        point.y - gesture.start.y
      );
      gesture.geometry = delta;
      gesture.changed = gesture.changed
        || Math.abs(delta.deltaX) > 0.5
        || Math.abs(delta.deltaY) > 0.5;
      if (gesture.changed) lastObjectPointerDown = { id: "", time: 0 };
      options.onDiagnostics?.(renderer.previewGeometry(delta));
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function startResize(event, objectId, handleName) {
    event.preventDefault();
    cancelGesture();
    const target = controller.getObjectById(objectId);
    if (!target || target.locked === true || options.canMutate?.() === false) return;
    let selectedIds = controller.selectedObjectIds();
    if (!selectedIds.includes(target.id)) selectedIds = controller.setSelection([target.id]);
    const endpointResize = ["arrow-base", "arrow-tip"].includes(handleName);
    const resizeIds = endpointResize ? [target.id] : selectedIds.filter(id => objectResizable(controller.getObjectById(id)));
    const originals = resizeIds.map(id => cloneValue(controller.getObjectById(id))).filter(objectResizable);
    if (!originals.length || (endpointResize && !["arrow", "line"].includes(originals[0]?.type))) return;

    const abortController = new AbortController();
    gesture = {
      kind: "resize",
      abortController,
      handle: handleName,
      objectIds: resizeIds,
      originals,
      objects: originals.map(cloneValue),
      bounds: diagram2SelectionResizeBounds(originals),
      changed: false
    };
    renderer.beginGeometryPreview({ objectIds: resizeIds, mode: "resize" });
    canvas.classList.add("is-resizing-object");
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "resize") return;
      const point = controller.snapPoint(renderer.screenToWorld(moveEvent));
      const objects = resizeDiagram2ObjectsGeometry(
        gesture.originals,
        gesture.handle,
        point,
        {
          startBounds: gesture.bounds,
          centerAnchored: moveEvent.ctrlKey
        }
      );
      gesture.objects = objects;
      gesture.changed = objectsChanged(gesture.originals, objects);
      options.onDiagnostics?.(renderer.previewGeometry({ objects }));
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function startMarquee(event) {
    event.preventDefault();
    cancelGesture();
    const start = renderer.screenToWorld(event);
    const initial = (event.shiftKey || event.ctrlKey || event.metaKey)
      ? controller.selectedObjectIds()
      : [];
    if (!initial.length) controller.setSelection([]);
    const abortController = new AbortController();
    gesture = {
      kind: "marquee",
      abortController,
      start,
      initial,
      selection: initial.slice()
    };
    options.onStateChange?.();
    canvas.classList.add("is-selecting");
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "marquee") return;
      const point = renderer.screenToWorld(moveEvent);
      const ids = renderer.previewMarquee({
        x: gesture.start.x,
        y: gesture.start.y,
        x2: point.x,
        y2: point.y
      });
      gesture.selection = [...new Set(gesture.initial.concat(ids))];
      controller.setSelection(gesture.selection);
      options.onStateChange?.();
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function capturePointer(event) {
    canvas.setPointerCapture?.(event.pointerId);
  }

  function bindGestureEnd(pointerId, gestureSignal) {
    eventWindow.addEventListener("pointerup", () => void finishGesture(true), {
      signal: gestureSignal,
      once: true
    });
    eventWindow.addEventListener("pointercancel", cancelGesture, {
      signal: gestureSignal,
      once: true
    });
    canvas.addEventListener("lostpointercapture", event => {
      if (event.pointerId === pointerId && gesture) cancelGesture();
    }, {
      signal: gestureSignal,
      once: true
    });
  }

  return cancelGesture;
}

async function afterMutation(options) {
  options.onStateChange?.();
  const diagnostics = await options.renderer.whenIdle();
  options.onDiagnostics?.(diagnostics);
  options.onStateChange?.();
}

function pointerSelection(controller, objectId, event) {
  const id = String(objectId || "").trim();
  if (!id || !controller.getObjectById(id)) return [];
  if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
    const current = controller.selectedObjectIds();
    return current.includes(id) ? current : [id];
  }
  const selected = new Set(controller.selectedObjectIds());
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  return [...selected];
}

function editableEventTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

function objectPositionFixed(object) {
  return object?.type === "embedded-image" && object.isOriginalImage === true;
}

function objectResizable(object) {
  return Boolean(object && object.locked !== true && !objectPositionFixed(object));
}

function objectsChanged(originals, nextObjects) {
  const nextById = new Map(nextObjects.map(object => [String(object?.id || ""), object]));
  return originals.some(object => JSON.stringify(object) !== JSON.stringify(nextById.get(String(object?.id || ""))));
}

function cloneValue(value) {
  return value == null || typeof value !== "object"
    ? value
    : JSON.parse(JSON.stringify(value));
}
