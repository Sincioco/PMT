const defaultInteractiveSelector = "button, a, input, select, textarea";

export function createReorderDrag({
  root,
  itemSelector,
  containerSelector,
  getItemKey,
  handleSelector = "[data-drag-handle]",
  handleRequired = true,
  interactiveSelector = defaultInteractiveSelector,
  canDrop = () => true,
  onDrop
}) {
  let drag = null;
  let lastPointerDragAt = 0;
  let suppressNextClick = false;
  let bound = false;

  function bind() {
    if (bound) return;
    bound = true;
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("mousedown", handleMouseDown);
    root.addEventListener("click", suppressDraggedClick, true);
  }

  function unbind() {
    if (!bound) return;
    bound = false;
    root.removeEventListener("pointerdown", handlePointerDown);
    root.removeEventListener("mousedown", handleMouseDown);
    root.removeEventListener("click", suppressDraggedClick, true);
    cancel();
  }

  function handlePointerDown(event) {
    lastPointerDragAt = Date.now();
    start(event, "pointer");
  }

  function handleMouseDown(event) {
    if (Date.now() - lastPointerDragAt < 500) return;
    start(event, "mouse");
  }

  function start(event, inputType) {
    if (event.button !== 0) return;

    const item = event.target.closest(itemSelector);
    const container = item?.closest(containerSelector);
    if (!item || !container || !root.contains(item) || !root.contains(container)) return;

    const handle = event.target.closest(handleSelector);
    const requiresHandle = typeof handleRequired === "function"
      ? handleRequired(container, item, event)
      : Boolean(handleRequired);

    if (requiresHandle && (!handle || !item.contains(handle))) return;
    if (!requiresHandle && event.target.closest(interactiveSelector)) return;

    const itemKey = getItemKey(item);
    if (!itemKey) return;

    drag = {
      itemKey,
      source: item,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      inputType,
      pointerId: event.pointerId
    };

    if (inputType === "pointer" && item.setPointerCapture && event.pointerId !== undefined) {
      try {
        item.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; mouse listeners still finish the drag.
      }
    }

    if (inputType === "pointer") {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
      window.addEventListener("pointercancel", cancel, { once: true });
    } else {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp, { once: true });
    }
  }

  function handlePointerMove(event) {
    lastPointerDragAt = Date.now();
    move(event);
  }

  function handleMouseMove(event) {
    if (drag?.inputType === "pointer") return;
    move(event);
  }

  function move(event) {
    if (!drag) return;

    const movedEnough = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    if (!drag.started && !movedEnough) return;

    if (!drag.started) {
      drag.started = true;
      suppressNextClick = true;
      drag.source.classList.add("dragging");
    }

    event.preventDefault();
    updateDropIndicator(event.clientX, event.clientY);
  }

  async function handlePointerUp(event) {
    lastPointerDragAt = Date.now();
    await finish(event);
  }

  async function handleMouseUp(event) {
    if (drag?.inputType === "pointer") return;
    await finish(event);
  }

  async function finish(event) {
    if (!drag || drag.finishing) return;
    drag.finishing = true;

    if (!drag.started) {
      cancel();
      return;
    }

    event.preventDefault();

    const drop = pointerDropTarget(event.clientX, event.clientY);
    if (!drop || !canDrop({ ...drop, itemKey: drag.itemKey, source: drag.source, event })) {
      cancel();
      return;
    }

    const orderedKeys = orderedKeysAfterDrop(drop.container, drag.itemKey, drop.target, event.clientY);

    try {
      await onDrop({
        ...drop,
        itemKey: drag.itemKey,
        source: drag.source,
        orderedKeys,
        event
      });
    } finally {
      cancel();
    }
  }

  function pointerDropTarget(clientX, clientY) {
    if (!drag) return null;

    const elements = document.elementsFromPoint(clientX, clientY);
    const container = elements
      .map(item => item.closest?.(containerSelector))
      .find(item => item && root.contains(item));

    if (!container) return null;

    const target = elements
      .map(item => item.closest?.(itemSelector))
      .find(item => item && container.contains(item) && !sameKey(getItemKey(item), drag.itemKey)) || null;

    return { container, target };
  }

  function updateDropIndicator(clientX, clientY) {
    clearDropIndicators();

    const drop = pointerDropTarget(clientX, clientY);
    if (!drop) return;

    drop.container.classList.add("drop-target");

    if (drop.target) {
      drop.target.classList.add(dropPlacement(drop.target, clientY) === "after" ? "reorder-after" : "reorder-before");
      return;
    }

    const items = [...drop.container.querySelectorAll(itemSelector)]
      .filter(item => !sameKey(getItemKey(item), drag.itemKey));
    items[items.length - 1]?.classList.add("reorder-after");
  }

  function orderedKeysAfterDrop(container, draggedKey, target, clientY) {
    const keys = [...container.querySelectorAll(itemSelector)]
      .map(getItemKey)
      .filter(Boolean)
      .filter(key => !sameKey(key, draggedKey));

    if (!target) return [...keys, draggedKey];

    const targetKey = getItemKey(target);
    let insertIndex = keys.findIndex(key => sameKey(key, targetKey));
    if (insertIndex < 0) return [...keys, draggedKey];

    if (dropPlacement(target, clientY) === "after") insertIndex += 1;
    keys.splice(insertIndex, 0, draggedKey);
    return keys;
  }

  function clearDropIndicators() {
    root.classList.remove("drop-target", "reorder-target", "reorder-before", "reorder-after");
    root.querySelectorAll(".drop-target, .reorder-target, .reorder-before, .reorder-after")
      .forEach(item => item.classList.remove("drop-target", "reorder-target", "reorder-before", "reorder-after"));
  }

  function cancel() {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("pointercancel", cancel);

    if (drag?.inputType === "pointer" && drag.source.releasePointerCapture && drag.pointerId !== undefined) {
      try {
        drag.source.releasePointerCapture(drag.pointerId);
      } catch {
        // The browser may already have released pointer capture.
      }
    }

    drag = null;
    root.querySelectorAll(".dragging")
      .forEach(item => item.classList.remove("dragging"));
    clearDropIndicators();
  }

  function suppressDraggedClick(event) {
    if (!suppressNextClick) return;

    suppressNextClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  return {
    bind,
    unbind
  };
}

export function dropPlacement(targetElement, clientY) {
  const targetRect = targetElement.getBoundingClientRect();
  return clientY > targetRect.top + (targetRect.height / 2) ? "after" : "before";
}

function sameKey(left, right) {
  return String(left) === String(right);
}
