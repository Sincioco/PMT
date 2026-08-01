import {
  diagram2SelectionResizeBounds,
  resizeDiagram2ObjectsGeometry
} from "./diagram2-editor-controller.js?v=20260801-diagram2-color-preview-v1";
import {
  adjustDiagram2RelationshipRoutePoints,
  diagram2RelationshipPath
} from "./diagram2-routing.js?v=20260731-rte-checkbox-layout-v2";
import {
  resizeDiagram2CropClip
} from "./diagram2-editor-crop.js?v=20260731-diagram2-crop-preview-v1";

const diagram2ShortcutTools = {
  v: "select",
  h: "pan",
  r: "rectangle",
  o: "circle",
  a: "arrow",
  l: "line",
  t: "textbox",
  y: "rich-text",
  e: "entity",
  c: "crop"
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

  const restoreGestureSelectionChrome = active => {
    if (active?.selectionChromeIds?.length) {
      renderer.setSelectionChromeSuppressed?.(active.selectionChromeIds, false);
    }
  };

  const finishGesture = async commit => {
    const pointerupReceivedAt = interactionNow();
    const active = gesture;
    if (!active) return;
    if (active.kind === "marquee") flushMarqueePreview(active);
    gesture = null;
    active.abortController.abort();
    if (Number.isInteger(active.pointerId) && canvas.hasPointerCapture?.(active.pointerId)) {
      canvas.releasePointerCapture?.(active.pointerId);
    }
    canvas.classList.remove("is-panning", "is-moving-object", "is-resizing-object", "is-selecting", "is-cropping");
    renderer.clearMarquee?.();

    if (active.kind === "move") {
      try {
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
      } finally {
        restoreGestureSelectionChrome(active);
      }
    }

    if (active.kind === "resize") {
      try {
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
      } finally {
        restoreGestureSelectionChrome(active);
      }
    }

    if (active.kind === "relationship-route") {
      if (!commit || !active.changed) {
        clearRelationshipRoutePreview(active);
        return;
      }
      const finalPoints = active.points?.length
        ? active.points
        : adjustDiagram2RelationshipRoutePoints(
            active.originalPoints,
            active.segmentIndex,
            active.axis,
            active.coordinate
          );
      const finalPath = active.path || diagram2RelationshipPath(finalPoints);
      const applied = await controller.commitRelationshipRouteOverride?.(
        active.relationshipId,
        finalPoints,
        {
          reason: "pointer relationship route",
          rendererAlreadyPreviewed: true,
          path: finalPath,
          previousRenderedPoints: active.originalPoints,
          pointerupReceivedAt,
          previewFinalCoordinateAvailableAt: active.previewFinalCoordinateAvailableAt
            || pointerupReceivedAt
        }
      );
      if (!applied) {
        clearRelationshipRoutePreview(active);
        return;
      }
      await nextInteractionFrame(eventWindow);
      controller.completeRelationshipRouteCommit?.({
        mainThreadResponsiveAt: interactionNow()
      });
      options.onDiagnostics?.(renderer.diagnostics?.());
      return;
    }

    if (active.kind === "crop") {
      try {
        if (!commit || !active.changed) {
          renderer.clearCropPreview?.({ keepTarget: true });
          options.onDiagnostics?.(renderer.diagnostics?.());
          return;
        }
        renderer.clearCropPreview?.({ keepTarget: true });
        const applied = await controller.updateEmbeddedImageCrop?.(active.objectId, {
          imageClip: active.clip,
          cropVisible: true
        }, {
          label: "Crop image",
          reason: "pointer crop"
        });
        renderer.setCropTarget?.(active.objectId);
        if (applied) await afterMutation(options);
        return;
      } finally {
        restoreGestureSelectionChrome(active);
      }
    }

    if (active.kind === "marquee" && commit) {
      if (active.bounds) {
        const ids = renderer.objectIdsInBounds?.(active.bounds) || [];
        controller.setSelection([...new Set(active.initial.concat(ids))]);
      } else if (!active.initial.length) {
        controller.setSelection([]);
      }
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
    const diagnostics = renderer.zoomBy(Math.exp(-event.deltaY * 0.0015), {
      clientX: event.clientX,
      clientY: event.clientY
    });
    options.onDiagnostics?.(diagnostics);
  }, { passive: false, signal });

  canvas.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.button !== 1) return;
    const handle = event.target.closest?.("[data-diagram2-resize-handle]");
    const cropHandle = event.target.closest?.("[data-diagram2-crop-handle]");
    const mappingCell = event.target.closest?.("[data-diagram2-field-mapping-cell]");
    const relationshipRouteHandle = event.target.closest?.("[data-diagram2-relationship-route-handle]");
    const relationshipNode = event.target.closest?.("[data-diagram2-relationship-id]");
    const relationshipId = String(relationshipNode?.dataset?.diagram2RelationshipId || "").trim();
    const objectNode = event.target.closest?.("[data-diagram2-object-id]");
    const objectId = String(objectNode?.dataset?.diagram2ObjectId || "").trim();
    const activeTool = controller.activeTool();
    const pointerTime = Number(event.timeStamp || Date.now());
    const repeatedObjectClick = objectId
      && lastObjectPointerDown.id === objectId
      && pointerTime - lastObjectPointerDown.time <= 500;

    if (event.button === 0 && !mappingCell) renderer.clearFieldMappingSelection?.();

    if (event.button === 0 && mappingCell && activeTool !== "pan") {
      event.preventDefault();
      event.stopPropagation();
      const mappingId = String(mappingCell.dataset.diagram2FieldMappingId || "").trim();
      controller.selectFieldMapping?.(mappingId);
      renderer.pinFieldMapping?.(mappingId, {
        tableId: mappingCell.dataset.diagram2FieldMappingTableId,
        cellKind: mappingCell.dataset.diagram2FieldMappingCellKind
      });
      mappingCell.focus?.({ preventScroll: true });
      options.onStateChange?.();
      return;
    }

    if (event.button === 0 && cropHandle && activeTool === "crop") {
      startCrop(event, cropHandle);
      return;
    }

    if (event.button === 0 && objectId && activeTool === "crop") {
      const object = controller.getObjectById(objectId);
      event.preventDefault();
      if (object?.type === "embedded-image") {
        const alreadySelected = controller.selectedObjectIds().includes(object.id);
        controller.setSelection([object.id], { expandGroups: false });
        if (alreadySelected) renderer.setCropTarget?.(object.id);
        else if (typeof options.onSetTool === "function") void options.onSetTool("select", { reason: "selection changed" });
        else controller.setActiveTool("select");
        options.onStateChange?.();
      }
      return;
    }

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
      if (object?.type === "entity") {
        event.preventDefault();
        lastObjectPointerDown = { id: "", time: 0 };
        controller.setSelection([object.id]);
        options.onStateChange?.();
        void options.onEditEntity?.(object);
        return;
      }
    }
    if (event.button === 0 && objectId && activeTool !== "pan") {
      lastObjectPointerDown = { id: objectId, time: pointerTime };
    } else if (event.button === 0) {
      lastObjectPointerDown = { id: "", time: 0 };
    }

    if (event.button === 0 && relationshipRouteHandle && canvas.contains(relationshipRouteHandle)) {
      startRelationshipRoute(event, relationshipRouteHandle);
      return;
    }

    if (event.button === 0 && relationshipId && canvas.contains(relationshipNode) && activeTool !== "pan") {
      event.preventDefault();
      controller.setSelection([relationshipId], { expandGroups: false });
      controller.setActiveTool("select");
      options.onStateChange?.();
      return;
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
    const mappingCell = event.target.closest?.("[data-diagram2-field-mapping-cell]");
    if (mappingCell && controller.activeTool() !== "pan") {
      event.preventDefault();
      event.stopPropagation();
      const mappingId = String(mappingCell.dataset.diagram2FieldMappingId || "").trim();
      const cellKind = mappingCell.dataset.diagram2FieldMappingCellKind;
      controller.selectFieldMapping?.(mappingId);
      renderer.pinFieldMapping?.(mappingId, {
        tableId: mappingCell.dataset.diagram2FieldMappingTableId,
        cellKind
      });
      const diagnostics = renderer.focusFieldMappingTarget?.(mappingId, { cellKind });
      options.onViewportChange?.(diagnostics, { mappingId, cellKind });
      options.onStateChange?.();
      return;
    }
    const relationshipTarget = relationshipTargetFromEvent(event.target);
    if (relationshipTarget.relationshipId
      && relationshipTarget.node
      && canvas.contains(relationshipTarget.node)
      && controller.activeTool() !== "pan") {
      event.preventDefault();
      event.stopPropagation();
      lastObjectPointerDown = { id: "", time: 0 };
      controller.setActiveTool("select");
      controller.setSelection([relationshipTarget.relationshipId], { expandGroups: false });
      options.onStateChange?.();
      if (options.canMutate?.() === false) return;
      const point = renderer.screenToWorld?.(event) || { x: Number(event.clientX || 0), y: Number(event.clientY || 0) };
      const segmentIndex = nearestRelationshipRouteSegmentIndex(relationshipTarget.points, point);
      if (segmentIndex < 0) return;
      void controller.insertRelationshipRoutePoint?.(relationshipTarget.relationshipId, segmentIndex, {
        point,
        reason: "double-click relationship route"
      }).then(applied => {
        if (applied) return afterMutation(options);
        return null;
      });
      return;
    }

    const objectNode = event.target.closest?.("[data-diagram2-object-id]");
    const object = controller.getObjectById(objectNode?.dataset?.diagram2ObjectId);
    if (!object || !["textbox", "rich-text", "entity"].includes(object.type)) return;
    event.preventDefault();
    controller.setSelection([object.id]);
    options.onStateChange?.();
    if (object.type === "entity") void options.onEditEntity?.(object);
    else void options.onEditText?.(object);
  }, { signal });

  canvas.addEventListener("pointerover", event => {
    const cell = event.target.closest?.("[data-diagram2-field-mapping-cell]");
    if (!cell || !canvas.contains(cell)) return;
    const previousCell = event.relatedTarget?.closest?.("[data-diagram2-field-mapping-cell]");
    if (previousCell === cell) return;
    renderer.showFieldMappingHover?.(cell.dataset.diagram2FieldMappingId, {
      tableId: cell.dataset.diagram2FieldMappingTableId,
      cellKind: cell.dataset.diagram2FieldMappingCellKind
    });
  }, { signal });

  canvas.addEventListener("pointerout", event => {
    const cell = event.target.closest?.("[data-diagram2-field-mapping-cell]");
    if (!cell || !canvas.contains(cell)) return;
    const nextCell = event.relatedTarget?.closest?.("[data-diagram2-field-mapping-cell]");
    if (nextCell === cell) return;
    renderer.clearFieldMappingHover?.();
  }, { signal });

  canvas.addEventListener("auxclick", event => {
    if (event.button === 1) event.preventDefault();
  }, { signal });

  canvas.addEventListener("contextmenu", event => {
    const relationshipTarget = relationshipTargetFromEvent(event.target);
    if (relationshipTarget.relationshipId
      && relationshipTarget.node
      && canvas.contains(relationshipTarget.node)) {
      event.preventDefault();
      event.stopPropagation();
      closeContextMenu();
      controller.setActiveTool("select");
      controller.setSelection([relationshipTarget.relationshipId], { expandGroups: false });
      options.onStateChange?.();
      if (options.canMutate?.() === false) return;
      const point = renderer.screenToWorld?.(event) || { x: Number(event.clientX || 0), y: Number(event.clientY || 0) };
      const pointIndex = nearestRelationshipRoutePointIndex(relationshipTarget.points, point);
      if (pointIndex <= 0) return;
      void controller.removeRelationshipRoutePoint?.(relationshipTarget.relationshipId, pointIndex, {
        reason: "right-click relationship route point"
      }).then(applied => {
        if (applied) return afterMutation(options);
        return null;
      });
      return;
    }

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
    if (event.key === "Escape" && controller.activeTool() === "crop") {
      event.preventDefault();
      if (typeof options.onSetTool === "function") void options.onSetTool("select", { reason: "Escape" });
      else {
        controller.setActiveTool("select");
        renderer.clearCropPreview?.();
      }
      options.onStateChange?.();
      return;
    }
    if (event.key === "Escape" && renderer.clearFieldMappingSelection?.()) {
      event.preventDefault();
      controller.setSelection([]);
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

    const focusedMappingCell = canvas.ownerDocument.activeElement?.closest?.("[data-diagram2-field-mapping-cell]");
    if (focusedMappingCell && canvas.contains(focusedMappingCell)
      && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const mappingId = String(focusedMappingCell.dataset.diagram2FieldMappingId || "").trim();
      const cellKind = focusedMappingCell.dataset.diagram2FieldMappingCellKind;
      controller.selectFieldMapping?.(mappingId);
      renderer.pinFieldMapping?.(mappingId, {
        tableId: focusedMappingCell.dataset.diagram2FieldMappingTableId,
        cellKind
      });
      if (event.key === "Enter") {
        const diagnostics = renderer.focusFieldMappingTarget?.(mappingId, { cellKind });
        options.onViewportChange?.(diagnostics, { mappingId, cellKind });
      }
      options.onStateChange?.();
      return;
    }

    const step = controller.keyboardNudgeStep(event.shiftKey);
    const focusedCropHandle = canvas.ownerDocument.activeElement?.closest?.("[data-diagram2-crop-handle]");
    if (focusedCropHandle && canvas.contains(focusedCropHandle)) {
      const nudged = nudgeCropHandle(focusedCropHandle, event, step);
      if (nudged) {
        event.preventDefault();
        return;
      }
    }
    const focusedRouteHandle = canvas.ownerDocument.activeElement?.closest?.("[data-diagram2-relationship-route-handle]");
    if (focusedRouteHandle && canvas.contains(focusedRouteHandle)) {
      const nudged = nudgeRelationshipRouteHandle(focusedRouteHandle, event, step);
      if (nudged) {
        event.preventDefault();
        return;
      }
    }

    const shortcutTool = diagram2ShortcutTools[key];
    if (shortcutTool && !command && !event.altKey) {
      event.preventDefault();
      if (["rectangle", "circle", "arrow", "line", "textbox", "rich-text", "entity"].includes(shortcutTool)) {
        if (!event.repeat) void options.onAddObject?.(shortcutTool);
      } else {
        if (typeof options.onSetTool === "function") void options.onSetTool(shortcutTool, { reason: "keyboard shortcut" });
        else controller.setActiveTool(shortcutTool);
        options.onStateChange?.();
      }
      return;
    }

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
      const diagnostics = renderer.panBy(deltaX, deltaY);
      options.onDiagnostics?.(diagnostics);
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function startMove(event, objectId) {
    event.preventDefault();
    cancelGesture();
    const selection = pointerSelection(controller, objectId, event);
    const selectedIds = controller.setSelection(selection);
    options.onStateChange?.();
    if (options.canMutate?.() === false || selectedIds.some(id => {
      const object = controller.getObjectById(id);
      return object?.locked === true || objectPositionFixed(object);
    })) return;

    const abortController = new AbortController();
    gesture = {
      kind: "move",
      abortController,
      objectIds: selectedIds,
      selectionChromeIds: selectedIds,
      start: renderer.screenToWorld(event),
      geometry: { deltaX: 0, deltaY: 0 },
      changed: false
    };
    renderer.setSelectionChromeSuppressed?.(selectedIds, true);
    renderer.beginGeometryPreview({ objectIds: selectedIds, mode: "move" });
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
      const diagnostics = renderer.previewGeometry(delta);
      options.onDiagnostics?.(diagnostics);
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function startRelationshipRoute(event, handle) {
    event.preventDefault();
    cancelGesture();
    if (options.canMutate?.() === false) return;
    const relationshipId = String(handle?.dataset?.diagram2RelationshipId || "").trim();
    const segmentIndex = Number.parseInt(handle?.dataset?.diagram2RelationshipSegmentIndex || "", 10);
    const axis = handle?.dataset?.diagram2RelationshipSegmentAxis === "x" ? "x" : handle?.dataset?.diagram2RelationshipSegmentAxis === "y" ? "y" : "";
    if (!relationshipId || !Number.isInteger(segmentIndex) || !axis) return;
    controller.setSelection([relationshipId], { expandGroups: false });
    options.onStateChange?.();
    const coordinate = relationshipRouteCoordinate(event, axis);
    const relationshipNode = handle.closest("[data-diagram2-relationship-route-overlay-id]")
      || handle.closest("[data-diagram2-relationship-id]");
    const originalPoints = parseRelationshipRoutePoints(handle);
    const originalPath = diagram2RelationshipPath(originalPoints);
    const abortController = new AbortController();
    gesture = {
      kind: "relationship-route",
      abortController,
      pointerId: event.pointerId,
      relationshipId,
      segmentIndex,
      axis,
      coordinate,
      startCoordinate: coordinate,
      originalPoints,
      originalPath,
      points: originalPoints,
      path: originalPath,
      previewFinalCoordinateAvailableAt: interactionNow(),
      relationshipNode,
      changed: false
    };
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "relationship-route") return;
      const nextCoordinate = relationshipRouteCoordinate(moveEvent, axis);
      gesture.coordinate = nextCoordinate;
      const nextPoints = adjustDiagram2RelationshipRoutePoints(
        gesture.originalPoints,
        segmentIndex,
        axis,
        nextCoordinate
      );
      const nextPath = diagram2RelationshipPath(nextPoints);
      gesture.points = nextPoints;
      gesture.path = nextPath;
      gesture.previewFinalCoordinateAvailableAt = interactionNow();
      gesture.changed = gesture.changed || (nextPath && nextPath !== gesture.originalPath);
      previewRelationshipRoute(gesture, nextPath);
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function relationshipRouteCoordinate(event, axis) {
    const point = renderer.screenToWorld?.(event) || { x: Number(event.clientX || 0), y: Number(event.clientY || 0) };
    return Number(axis === "x" ? point.x : point.y);
  }

  function startCrop(event, handle) {
    event.preventDefault();
    event.stopPropagation();
    cancelGesture();
    if (options.canMutate?.() === false) return;
    const objectId = String(handle?.dataset?.diagram2CropObjectId || "").trim();
    const direction = String(handle?.dataset?.diagram2CropHandle || "").trim().toLowerCase();
    const image = controller.getObjectById(objectId);
    if (image?.type !== "embedded-image" || image.locked === true || !direction) return;
    const originalClip = cloneValue(image.imageClip || {
      x: image.x,
      y: image.y,
      width: image.width,
      height: image.height
    });
    const abortController = new AbortController();
    gesture = {
      kind: "crop",
      abortController,
      objectId,
      selectionChromeIds: [objectId],
      direction,
      image: cloneValue(image),
      originalClip,
      clip: originalClip,
      changed: false
    };
    controller.setSelection([objectId], { expandGroups: false });
    renderer.setSelectionChromeSuppressed?.([objectId], true);
    renderer.setCropTarget?.(objectId);
    canvas.classList.add("is-cropping");
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "crop") return;
      const point = renderer.screenToWorld(moveEvent);
      const status = controller.statusSnapshot?.() || {};
      const clip = resizeDiagram2CropClip(gesture.image, direction, point, {
        snap: status.snapToGrid === true,
        gridSize: status.gridSize
      });
      if (!clip) return;
      gesture.clip = clip;
      gesture.changed = !sameBounds(gesture.originalClip, clip);
      const diagnostics = renderer.previewCrop?.(objectId, clip);
      options.onDiagnostics?.(diagnostics);
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
      selectionChromeIds: resizeIds,
      originals,
      objects: originals.map(cloneValue),
      bounds: diagram2SelectionResizeBounds(originals),
      pointerOffset: null,
      changed: false
    };
    const startPoint = renderer.screenToWorld(event);
    const anchor = resizeHandleAnchor(gesture.bounds, handleName, originals[0]);
    gesture.pointerOffset = {
      x: anchor.x - startPoint.x,
      y: anchor.y - startPoint.y
    };
    renderer.setSelectionChromeSuppressed?.(resizeIds, true);
    renderer.beginGeometryPreview({ objectIds: resizeIds, mode: "resize" });
    canvas.classList.add("is-resizing-object");
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "resize") return;
      const rawPoint = renderer.screenToWorld(moveEvent);
      const point = controller.snapPoint({
        x: rawPoint.x + finiteNumber(gesture.pointerOffset?.x, 0),
        y: rawPoint.y + finiteNumber(gesture.pointerOffset?.y, 0)
      });
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
      const diagnostics = renderer.previewGeometry({ objects });
      options.onDiagnostics?.(diagnostics);
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function resizeHandleAnchor(boundsInput, handleName, object = null) {
    if (handleName === "arrow-base") {
      return {
        x: finiteNumber(object?.x1, 0),
        y: finiteNumber(object?.y1, 0)
      };
    }
    if (handleName === "arrow-tip") {
      return {
        x: finiteNumber(object?.x2, object?.x1),
        y: finiteNumber(object?.y2, object?.y1)
      };
    }
    const bounds = boundsInput || {};
    const left = finiteNumber(bounds.x, 0);
    const top = finiteNumber(bounds.y, 0);
    const width = positiveNumber(bounds.width, 1);
    const height = positiveNumber(bounds.height, 1);
    const right = left + width;
    const bottom = top + height;
    const centerX = left + (width / 2);
    const centerY = top + (height / 2);
    const direction = String(handleName || "");
    return {
      x: direction.includes("w") ? left : direction.includes("e") ? right : centerX,
      y: direction.includes("n") ? top : direction.includes("s") ? bottom : centerY
    };
  }

  function startMarquee(event) {
    event.preventDefault();
    cancelGesture();
    const start = renderer.screenToWorld(event);
    const initial = (event.shiftKey || event.ctrlKey || event.metaKey)
      ? controller.selectedObjectIds()
      : [];
    const abortController = new AbortController();
    gesture = {
      kind: "marquee",
      abortController,
      start,
      initial,
      bounds: null,
      previewFrame: 0,
      pendingPointer: null
    };
    canvas.classList.add("is-selecting");
    capturePointer(event);
    eventWindow.addEventListener("pointermove", moveEvent => {
      if (gesture?.kind !== "marquee") return;
      scheduleMarqueePreview(moveEvent);
    }, { signal: abortController.signal });
    bindGestureEnd(event.pointerId, abortController.signal);
  }

  function scheduleMarqueePreview(event) {
    const active = gesture?.kind === "marquee" ? gesture : null;
    if (!active) return;
    active.pendingPointer = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    if (active.previewFrame) return;
    const requestFrame = eventWindow?.requestAnimationFrame
      || globalThis.requestAnimationFrame
      || (callback => globalThis.setTimeout(callback, 16));
    active.previewFrame = requestFrame(() => {
      active.previewFrame = 0;
      if (gesture !== active || active.kind !== "marquee") return;
      applyMarqueePreview(active);
    });
  }

  function flushMarqueePreview(active) {
    if (!active || active.kind !== "marquee") return;
    if (active.previewFrame) {
      if (eventWindow?.cancelAnimationFrame) eventWindow.cancelAnimationFrame(active.previewFrame);
      else if (globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(active.previewFrame);
      else globalThis.clearTimeout?.(active.previewFrame);
      active.previewFrame = 0;
    }
    applyMarqueePreview(active);
  }

  function applyMarqueePreview(active) {
    const pointer = active?.pendingPointer;
    if (!pointer) return;
    active.pendingPointer = null;
    const point = renderer.screenToWorld(pointer);
    active.bounds = {
      x: active.start.x,
      y: active.start.y,
      x2: point.x,
      y2: point.y
    };
    renderer.previewMarquee(active.bounds, { hitTest: false });
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

  function nudgeRelationshipRouteHandle(handle, event, step) {
    const relationshipId = String(handle?.dataset?.diagram2RelationshipId || "").trim();
    const segmentIndex = Number.parseInt(handle?.dataset?.diagram2RelationshipSegmentIndex || "", 10);
    const axis = handle?.dataset?.diagram2RelationshipSegmentAxis === "x" ? "x" : handle?.dataset?.diagram2RelationshipSegmentAxis === "y" ? "y" : "";
    if (!relationshipId || !Number.isInteger(segmentIndex) || !axis) return false;
    const direction = axis === "x"
      ? event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : 0
      : event.key === "ArrowUp"
        ? -1
        : event.key === "ArrowDown"
          ? 1
          : 0;
    if (!direction) return false;
    const coordinate = finiteNumber(axis === "x" ? handle.getAttribute("cx") : handle.getAttribute("cy"), 0)
      + (direction * step);
    void controller.adjustRelationshipRoute?.(relationshipId, segmentIndex, axis, coordinate, {
      reason: "keyboard relationship route"
    }).then(applied => {
      if (applied) {
        return nextInteractionFrame(eventWindow).then(() => {
          controller.completeRelationshipRouteCommit?.({
            mainThreadResponsiveAt: interactionNow()
          });
          options.onDiagnostics?.(renderer.diagnostics?.());
        canvas.ownerDocument
          .querySelector(`[data-diagram2-relationship-route-handle][data-diagram2-relationship-id="${cssEscapeSelector(relationshipId)}"][data-diagram2-relationship-segment-index="${segmentIndex}"]`)
          ?.focus({ preventScroll: true });
        });
      }
      return null;
    });
    return true;
  }

  function nudgeCropHandle(handle, event, step) {
    if (controller.activeTool() !== "crop" || options.canMutate?.() === false) return false;
    const direction = String(handle?.dataset?.diagram2CropHandle || "").toLowerCase();
    const horizontal = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const vertical = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if ((!horizontal || !/[ew]/.test(direction)) && (!vertical || !/[ns]/.test(direction))) return false;
    const objectId = String(handle?.dataset?.diagram2CropObjectId || "").trim();
    const image = controller.getObjectById(objectId);
    if (image?.type !== "embedded-image" || image.locked === true) return false;
    const point = {
      x: finiteNumber(handle.getAttribute("cx"), image.x) + horizontal,
      y: finiteNumber(handle.getAttribute("cy"), image.y) + vertical
    };
    const status = controller.statusSnapshot?.() || {};
    const clip = resizeDiagram2CropClip(image, direction, point, {
      snap: status.snapToGrid === true,
      gridSize: status.gridSize
    });
    if (!clip) return false;
    void controller.updateEmbeddedImageCrop(objectId, {
      imageClip: clip,
      cropVisible: true
    }, {
      label: "Adjust image crop",
      reason: "keyboard crop"
    }).then(applied => {
      if (!applied) return null;
      renderer.setCropTarget?.(objectId);
      return afterMutation(options);
    });
    return true;
  }
}

function parseRelationshipRoutePoints(handle) {
  return parseRelationshipRoutePointsFromElement(handle);
}

function relationshipTargetFromEvent(target) {
  const handle = target?.closest?.("[data-diagram2-relationship-route-handle]");
  const overlay = target?.closest?.("[data-diagram2-relationship-route-overlay-id]");
  const node = target?.closest?.("[data-diagram2-relationship-id]");
  const relationshipId = String(
    handle?.dataset?.diagram2RelationshipId
    || overlay?.dataset?.diagram2RelationshipRouteOverlayId
    || node?.dataset?.diagram2RelationshipId
    || ""
  ).trim();
  return {
    relationshipId,
    node: handle || overlay || node || null,
    points: parseRelationshipRoutePointsFromElement(handle || overlay || node)
  };
}

function parseRelationshipRoutePointsFromElement(element) {
  const source = element?.closest?.("[data-diagram2-relationship-route-handles]")
    || element?.querySelector?.(":scope > g[data-diagram2-relationship-route-handles]")
    || element?.closest?.("[data-diagram2-relationship-route-overlay-id]")
      ?.querySelector?.(":scope > g[data-diagram2-relationship-route-handles]")
    || element?.closest?.("[data-diagram2-relationship-id]")
    || null;
  const raw = source?.dataset?.diagram2RelationshipRoutePoints || "[]";
  try {
    const parsed = JSON.parse(raw);
    return normalizeInteractionRoutePoints(parsed);
  } catch {
    return [];
  }
}

function nearestRelationshipRouteSegmentIndex(pointsInput, pointInput) {
  const points = normalizeInteractionRoutePoints(pointsInput);
  const point = normalizeInteractionPoint(pointInput);
  if (points.length < 2 || !point) return -1;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    const distance = pointToSegmentDistance(point, points[index], points[index + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function nearestRelationshipRoutePointIndex(pointsInput, pointInput) {
  const points = normalizeInteractionRoutePoints(pointsInput);
  const point = normalizeInteractionPoint(pointInput);
  if (points.length <= 2 || !point) return -1;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = Math.hypot(points[index].x - point.x, points[index].y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function normalizeInteractionRoutePoints(pointsInput) {
  return (Array.isArray(pointsInput) ? pointsInput : [])
    .map(normalizeInteractionPoint)
    .filter(Boolean);
}

function normalizeInteractionPoint(pointInput = {}) {
  const x = finiteNumber(pointInput?.x, Number.NaN);
  const y = finiteNumber(pointInput?.y, Number.NaN);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  if (lengthSquared <= 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = Math.max(0, Math.min(1, (((point.x - start.x) * dx) + ((point.y - start.y) * dy)) / lengthSquared));
  return Math.hypot(point.x - (start.x + (amount * dx)), point.y - (start.y + (amount * dy)));
}

function previewRelationshipRoute(active, path) {
  if (!active?.relationshipNode || !path) return;
  let preview = active.relationshipNode.querySelector(":scope > path[data-diagram2-relationship-route-preview]");
  if (!preview) {
    preview = active.relationshipNode.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    preview.setAttribute("data-diagram2-relationship-route-preview", "");
    active.relationshipNode.append(preview);
  }
  preview.setAttribute("d", path);
  preview.setAttribute("fill", "none");
  preview.setAttribute("stroke", "#0c66e4");
  preview.setAttribute("stroke-width", "5");
  preview.setAttribute("opacity", "0.55");
  preview.setAttribute("stroke-linejoin", "round");
  preview.setAttribute("stroke-linecap", "round");
  preview.setAttribute("pointer-events", "none");
}

function clearRelationshipRoutePreview(active) {
  active?.relationshipNode
    ?.querySelector?.(":scope > path[data-diagram2-relationship-route-preview]")
    ?.remove();
}

function interactionNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function nextInteractionFrame(eventWindow) {
  const requestFrame = eventWindow?.requestAnimationFrame
    || globalThis.requestAnimationFrame
    || (callback => globalThis.setTimeout(callback, 16));
  return new Promise(resolve => requestFrame(resolve));
}

async function afterMutation(options) {
  options.onStateChange?.();
  const diagnostics = await (options.renderer.whenInteractive?.() || options.renderer.whenIdle());
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

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function objectPositionFixed(object) {
  return object?.type === "embedded-image" && object.isOriginalImage === true;
}

function objectResizable(object) {
  return Boolean(object && object.locked !== true && !objectPositionFixed(object));
}

function cssEscapeSelector(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value || ""));
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function objectsChanged(originals, nextObjects) {
  const nextById = new Map(nextObjects.map(object => [String(object?.id || ""), object]));
  return originals.some(object => JSON.stringify(object) !== JSON.stringify(nextById.get(String(object?.id || ""))));
}

function sameBounds(left, right) {
  return Boolean(left && right && ["x", "y", "width", "height"]
    .every(key => Math.abs(finiteNumber(left[key], 0) - finiteNumber(right[key], 0)) < 0.001));
}

function cloneValue(value) {
  return value == null || typeof value !== "object"
    ? value
    : JSON.parse(JSON.stringify(value));
}
