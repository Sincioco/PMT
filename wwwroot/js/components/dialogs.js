import { buttonContent } from "./buttons.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

const dialogDragIgnoreSelector = "button, a, input, select, textarea, label, [contenteditable='true'], [data-dialog-drag-ignore]";
let dialogDragInitialized = false;
let activeDialogDrag = null;

export function initializeDraggableDialogs() {
  if (dialogDragInitialized) return;
  dialogDragInitialized = true;

  document.addEventListener("pointerdown", startDialogDrag);
  document.addEventListener("close", event => resetDialogPosition(event.target), true);
  window.addEventListener("resize", () => requestAnimationFrame(clampOpenDraggedDialogs));
}

export function initializeWindowedDialog(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) return;

  dialog.classList.add("windowed-dialog");
  const maximizeButton = ensureWindowedDialogButton(dialog);
  updateWindowedDialogButton(maximizeButton, false);

  if (dialog.dataset.windowedDialogInitialized !== "true") {
    dialog.dataset.windowedDialogInitialized = "true";
    dialog.addEventListener("close", () => resetWindowedDialog(dialog));
  }

  requestAnimationFrame(() => {
    if (dialog.open) sizeWindowedDialogFromDefault(dialog);
  });
}

function ensureWindowedDialogButton(dialog) {
  const head = dialog.querySelector(".dialog-head");
  if (!head) return null;

  let actions = head.querySelector(":scope > .dialog-head-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "dialog-head-actions";
    head.querySelectorAll(":scope > button.icon-btn").forEach(button => actions.appendChild(button));
    head.appendChild(actions);
  }

  let button = actions.querySelector("[data-windowed-dialog-toggle]");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "icon-btn dialog-maximize-button";
    button.dataset.windowedDialogToggle = "true";
    actions.insertBefore(button, actions.firstChild);
    button.addEventListener("click", () => toggleWindowedDialogMaximized(dialog));
  }

  return button;
}

function sizeWindowedDialogFromDefault(dialog) {
  if (dialog.dataset.windowedDialogSized === "true") return;

  const rect = dialog.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (!width || !height) return;

  dialog.style.setProperty("--windowed-dialog-default-width", `${width}px`);
  dialog.style.setProperty("--windowed-dialog-default-height", `${height}px`);
  dialog.style.width = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.dataset.windowedDialogSized = "true";
}

function resetWindowedDialog(dialog) {
  dialog.classList.remove("is-maximized");
  delete dialog.dataset.windowedDialogSized;
  dialog.style.removeProperty("--windowed-dialog-default-width");
  dialog.style.removeProperty("--windowed-dialog-default-height");
  dialog.style.width = "";
  dialog.style.height = "";
  updateWindowedDialogButton(dialog.querySelector("[data-windowed-dialog-toggle]"), false);
}

function toggleWindowedDialogMaximized(dialog) {
  if (!dialog.open) return;

  const shouldMaximize = !dialog.classList.contains("is-maximized");
  if (shouldMaximize) {
    const rect = dialog.getBoundingClientRect();
    dialog.style.width = `${Math.ceil(rect.width)}px`;
    dialog.style.height = `${Math.ceil(rect.height)}px`;
  }

  dialog.classList.toggle("is-maximized", shouldMaximize);
  updateWindowedDialogButton(dialog.querySelector("[data-windowed-dialog-toggle]"), shouldMaximize);
}

function updateWindowedDialogButton(button, isMaximized) {
  if (!button) return;

  const label = isMaximized ? "Restore" : "Maximize";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.textContent = label;
}

function startDialogDrag(event) {
  if (event.button !== 0) return;

  const head = event.target.closest(".dialog-head");
  if (!head || event.target.closest(dialogDragIgnoreSelector)) return;

  const dialog = head.closest("dialog.dialog");
  if (!dialog?.open) return;
  if (dialog.classList.contains("is-maximized")) return;

  const rect = dialog.getBoundingClientRect();
  const origin = clampDialogPosition(dialog, rect.left, rect.top);
  positionDialog(dialog, origin.left, origin.top);

  activeDialogDrag = {
    dialog,
    head,
    pointerId: event.pointerId,
    originLeft: origin.left,
    originTop: origin.top,
    startX: event.clientX,
    startY: event.clientY
  };

  dialog.classList.add("is-dialog-dragging");
  try {
    head.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is a progressive enhancement here.
  }

  document.addEventListener("pointermove", dragDialog);
  document.addEventListener("pointerup", stopDialogDrag);
  document.addEventListener("pointercancel", stopDialogDrag);
  event.preventDefault();
}

function dragDialog(event) {
  if (!activeDialogDrag || event.pointerId !== activeDialogDrag.pointerId) return;

  const nextLeft = activeDialogDrag.originLeft + event.clientX - activeDialogDrag.startX;
  const nextTop = activeDialogDrag.originTop + event.clientY - activeDialogDrag.startY;
  const position = clampDialogPosition(activeDialogDrag.dialog, nextLeft, nextTop);
  positionDialog(activeDialogDrag.dialog, position.left, position.top);
}

function stopDialogDrag(event) {
  if (!activeDialogDrag || event.pointerId !== activeDialogDrag.pointerId) return;
  finishDialogDrag(event.pointerId);
}

function finishDialogDrag(pointerId = activeDialogDrag?.pointerId) {
  if (!activeDialogDrag) return;

  activeDialogDrag.dialog.classList.remove("is-dialog-dragging");
  try {
    activeDialogDrag.head.releasePointerCapture(pointerId);
  } catch {
    // The pointer may already have been released by the browser.
  }

  activeDialogDrag = null;
  document.removeEventListener("pointermove", dragDialog);
  document.removeEventListener("pointerup", stopDialogDrag);
  document.removeEventListener("pointercancel", stopDialogDrag);
}

function clampOpenDraggedDialogs() {
  document.querySelectorAll("dialog.dialog[data-dialog-dragged][open]").forEach(dialog => {
    const rect = dialog.getBoundingClientRect();
    const position = clampDialogPosition(dialog, rect.left, rect.top);
    positionDialog(dialog, position.left, position.top);
  });
}

function clampDialogPosition(dialog, left, top) {
  const head = dialog.querySelector(".dialog-head");
  const dialogRect = dialog.getBoundingClientRect();
  const headRect = head?.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  if (!headRect || !viewportWidth || !viewportHeight) return { left, top };

  const headOffsetLeft = headRect.left - dialogRect.left;
  const headOffsetTop = headRect.top - dialogRect.top;
  const minVisibleWidth = Math.min(96, Math.max(32, headRect.width * 0.2), viewportWidth);
  const minVisibleHeight = Math.min(40, Math.max(24, headRect.height * 0.5), viewportHeight);

  const minLeft = minVisibleWidth - headOffsetLeft - headRect.width;
  const maxLeft = viewportWidth - minVisibleWidth - headOffsetLeft;
  const minTop = minVisibleHeight - headOffsetTop - headRect.height;
  const maxTop = viewportHeight - minVisibleHeight - headOffsetTop;

  return {
    left: clamp(left, Math.min(minLeft, maxLeft), Math.max(minLeft, maxLeft)),
    top: clamp(top, Math.min(minTop, maxTop), Math.max(minTop, maxTop))
  };
}

function positionDialog(dialog, left, top) {
  dialog.dataset.dialogDragged = "true";
  dialog.style.position = "fixed";
  dialog.style.inset = "auto";
  dialog.style.margin = "0";
  dialog.style.left = `${Math.round(left)}px`;
  dialog.style.top = `${Math.round(top)}px`;
}

function resetDialogPosition(dialog) {
  if (!(dialog instanceof HTMLDialogElement) || !dialog.classList.contains("dialog")) return;
  if (activeDialogDrag?.dialog === dialog) finishDialogDrag();

  dialog.classList.remove("is-dialog-dragging");
  delete dialog.dataset.dialogDragged;
  dialog.style.position = "";
  dialog.style.inset = "";
  dialog.style.margin = "";
  dialog.style.left = "";
  dialog.style.top = "";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function askYesNo(message, title) {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="dialog-body">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-result="no">${buttonContent("&#10005;", "Cancel")}</button>
        <button type="button" class="primary text-icon-button" data-result="yes">${buttonContent("&#10003;", "Continue")}</button>
      </div>
    `;

    document.body.appendChild(modal);

    const finish = result => {
      modal.close();
      modal.remove();
      resolve(result);
    };

    modal.querySelector("[data-result='no']").addEventListener("click", () => finish(false));
    modal.querySelector("[data-result='yes']").addEventListener("click", () => finish(true));
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(false);
    });

    modal.showModal();
  });
}

export function askFinishSprintOptions() {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>Finish Sprint</h2>
      </div>
      <div class="dialog-body">
        <label class="inline-check">
          <input name="carryUnfinished" type="checkbox" checked>
          <span>Finish this Sprint and carry unfinished tasks forward?</span>
        </label>
        <label class="inline-check">
          <input name="carryTodos" type="checkbox">
          <span>Carry over the Todos in the next Sprint</span>
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
        <button type="button" class="primary text-icon-button" data-result="finish">${buttonContent("&#10003;", "Finish")}</button>
      </div>
    `;

    document.body.appendChild(modal);

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(null));
    modal.querySelector("[data-result='finish']").addEventListener("click", () => finish({
      carryUnfinished: modal.querySelector("[name='carryUnfinished']").checked,
      carryTodos: modal.querySelector("[name='carryTodos']").checked
    }));
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
  });
}

export function askForText(label, title, placeholder = "") {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>${escapeHtml(label)}</label>
            <input name="dialogText" value="${escapeAttr(placeholder)}">
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Apply")}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(""));
    modal.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      finish(modal.querySelector("[name='dialogText']").value);
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish("");
    });

    modal.showModal();
    setTimeout(() => modal.querySelector("[name='dialogText']").focus(), 0);
  });
}
