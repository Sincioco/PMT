import { canEditTask } from "../../shared/permissions.js?v=20260715-admin-impersonation";

export function createBoardDrag({
  root,
  getTask,
  onDrop
}) {
  let active = false;
  let pointerDrag = null;
  let lastPointerDragEventAt = 0;
  let suppressNextClick = false;
  let suppressClicksUntil = 0;
  let windowEventsBound = false;

  function activate() {
    if (active) return;
    active = true;
    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("mousedown", handleMouseDown);
    root.addEventListener("click", suppressDraggedClick, true);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    cancelDrag();
    suppressNextClick = false;
    suppressClicksUntil = 0;
    root.removeEventListener("pointerdown", handlePointerDown);
    root.removeEventListener("mousedown", handleMouseDown);
    root.removeEventListener("click", suppressDraggedClick, true);
  }

  function handlePointerDown(event) {
    lastPointerDragEventAt = Date.now();
    startDrag(event, "pointer");
  }

  function handleMouseDown(event) {
    if (Date.now() - lastPointerDragEventAt < 500) return;
    startDrag(event, "mouse");
  }

  function startDrag(event, inputType) {
    if (event.button !== 0) return;
    if (event.target.closest("button, a, input, label, select, textarea")) return;

    const item = event.target.closest('.task-card[data-task-id][data-can-drag="true"]');
    const container = item?.closest('[data-reorder-list="board-column"]');
    if (!item || !container || !root.contains(container)) return;

    pointerDrag = {
      taskId: Number(item.dataset.taskId || 0),
      source: item,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      inputType,
      pointerId: event.pointerId
    };

    bindWindowEvents();

    if (inputType === "pointer" && item.setPointerCapture && event.pointerId !== undefined) {
      try {
        item.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; the window listeners still finish the drag.
      }
    }
  }

  function bindWindowEvents() {
    if (windowEventsBound) return;
    windowEventsBound = true;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointercancel", cancelDrag);
  }

  function unbindWindowEvents() {
    if (!windowEventsBound) return;
    windowEventsBound = false;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("pointercancel", cancelDrag);
  }

  function handlePointerMove(event) {
    lastPointerDragEventAt = Date.now();
    moveDrag(event);
  }

  function handleMouseMove(event) {
    if (pointerDrag?.inputType === "pointer") return;
    moveDrag(event);
  }

  function moveDrag(event) {
    if (!pointerDrag) return;

    const movedEnough = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) > 5;
    if (!pointerDrag.started && !movedEnough) return;

    if (!pointerDrag.started) {
      pointerDrag.started = true;
      armClickSuppression();
      pointerDrag.source.classList.add("dragging");
    }

    event.preventDefault();
    updateDropIndicator(event.clientX, event.clientY, pointerDrag.taskId);
  }

  async function handlePointerUp(event) {
    lastPointerDragEventAt = Date.now();
    await finishDrag(event);
  }

  async function handleMouseUp(event) {
    if (pointerDrag?.inputType === "pointer") return;
    await finishDrag(event);
  }

  async function finishDrag(event) {
    if (!pointerDrag || pointerDrag.finishing) return;
    pointerDrag.finishing = true;

    const drag = pointerDrag;
    if (!drag.started) {
      cancelDrag();
      return;
    }

    event.preventDefault();
    armClickSuppression();

    const drop = pointerDropTarget(event.clientX, event.clientY, drag.taskId);
    const task = getTask(drag.taskId);
    if (!drop || !task || !canEditTask(task)) {
      cancelDrag();
      return;
    }

    const taskIds = taskIdsAfterDrop(drop.container, drag.taskId, drop.target, event.clientY);
    const newStatus = drop.container.dataset.status || "";

    try {
      await onDrop({
        task,
        taskIds,
        newStatus,
        statusChanged: Boolean(newStatus && task.status !== newStatus)
      });
    } finally {
      cancelDrag();
    }
  }

  function pointerDropTarget(clientX, clientY, taskId) {
    const elements = document.elementsFromPoint(clientX, clientY);
    const container = elements
      .map(item => item.closest?.('[data-reorder-list="board-column"][data-status]'))
      .find(item => item && root.contains(item));

    if (!container) return null;

    const target = elements
      .map(item => item.closest?.(".task-card[data-task-id]"))
      .find(item => item && container.contains(item) && Number(item.dataset.taskId) !== taskId) || null;

    return { container, target };
  }

  function updateDropIndicator(clientX, clientY, taskId) {
    clearDropIndicators();

    const drop = pointerDropTarget(clientX, clientY, taskId);
    if (!drop) return;

    drop.container.classList.add("drop-target");

    if (drop.target) {
      drop.target.classList.add(dropPlacement(drop.target, clientY) === "after" ? "reorder-after" : "reorder-before");
      return;
    }

    const items = [...drop.container.querySelectorAll("[data-task-id]")]
      .filter(item => Number(item.dataset.taskId) !== taskId);
    items[items.length - 1]?.classList.add("reorder-after");
  }

  function taskIdsAfterDrop(container, draggedTaskId, targetElement, clientY) {
    const taskIds = [...container.querySelectorAll("[data-task-id]")]
      .map(item => Number(item.dataset.taskId))
      .filter(Boolean)
      .filter(id => id !== draggedTaskId);

    if (!targetElement) return [...taskIds, draggedTaskId];

    const targetTaskId = Number(targetElement.dataset.taskId);
    let insertIndex = taskIds.indexOf(targetTaskId);
    if (insertIndex < 0) return [...taskIds, draggedTaskId];

    if (dropPlacement(targetElement, clientY) === "after") insertIndex += 1;
    taskIds.splice(insertIndex, 0, draggedTaskId);
    return taskIds;
  }

  function dropPlacement(targetElement, clientY) {
    const targetRect = targetElement.getBoundingClientRect();
    return clientY > targetRect.top + (targetRect.height / 2) ? "after" : "before";
  }

  function suppressDraggedClick(event) {
    if (!suppressNextClick && Date.now() > suppressClicksUntil) return;

    suppressNextClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function armClickSuppression() {
    suppressNextClick = true;
    suppressClicksUntil = Date.now() + 700;
  }

  function cancelDrag() {
    if (pointerDrag?.inputType === "pointer" && pointerDrag.source.releasePointerCapture && pointerDrag.pointerId !== undefined) {
      try {
        pointerDrag.source.releasePointerCapture(pointerDrag.pointerId);
      } catch {
        // The browser may already have released capture after pointerup/cancel.
      }
    }

    pointerDrag = null;
    unbindWindowEvents();
    root.querySelectorAll(".dragging")
      .forEach(item => item.classList.remove("dragging"));
    clearDropIndicators();
  }

  function clearDropIndicators() {
    root.querySelectorAll(".drop-target, .reorder-target, .reorder-before, .reorder-after")
      .forEach(item => item.classList.remove("drop-target", "reorder-target", "reorder-before", "reorder-after"));
  }

  return {
    activate,
    deactivate
  };
}
