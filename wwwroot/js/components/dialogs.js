import { buttonContent } from "./buttons.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

const dialogDragIgnoreSelector = "button, a, input, select, textarea, label, summary, [contenteditable='true'], [data-dialog-drag-ignore], [data-work-item-dialog-header-menu], [data-bug-dialog-header-menu]";
const dialogResizeHandleSize = 24;
const dialogLayoutStoragePrefix = "pmt-dialog-layout:";
const dialogLayoutStorageVersion = 1;
const dialogLayoutTransientClasses = new Set(["dialog", "windowed-dialog", "detail-dialog", "is-maximized", "is-dialog-dragging"]);
const dialogResizeFinishers = new WeakMap();
const dialogResizeObservers = new WeakMap();
const dialogResetHandlers = new WeakMap();
let dialogDragInitialized = false;
let activeDialogDrag = null;

export function initializeDraggableDialogs() {
  if (dialogDragInitialized) return;
  dialogDragInitialized = true;

  document.addEventListener("pointerdown", startDialogDrag);
  document.addEventListener("pointerdown", anchorDialogResize, true);
  document.addEventListener("close", event => resetDialogPosition(event.target), true);
  window.addEventListener("resize", () => requestAnimationFrame(clampOpenDraggedDialogs));
}

export function hideEmptyReadOnlyFields(root) {
  const emptyLabels = new Set(["", "none", "no project", "not set", "unassigned", "unknown", "n/a"]);
  root?.querySelectorAll?.(".detail-field").forEach(field => {
    const valueElement = field.lastElementChild;
    if (!valueElement) return;

    const text = (valueElement.textContent || "")
      .replace(/\u00a0/g, " ")
      .trim()
      .toLowerCase();
    const hasVisualValue = Boolean(valueElement.querySelector(
      "a[href], button, img[src], table, video, iframe, pre, code, blockquote, ul, ol"
    ));
    if (emptyLabels.has(text) && !hasVisualValue) field.remove();
  });
}

export function initializeWindowedDialog(dialog, options = {}) {
  if (!(dialog instanceof HTMLDialogElement)) return;

  if (typeof options.onReset === "function") {
    dialogResetHandlers.set(dialog, options.onReset);
  } else {
    dialogResetHandlers.delete(dialog);
  }

  dialog.classList.add("windowed-dialog");
  initializeDialogLayoutPersistence(dialog);
  const maximizeButton = ensureWindowedDialogControls(dialog, {
    showResetButton: options.showResetButton !== false
  });
  updateWindowedDialogButton(maximizeButton, false);

  if (dialog.dataset.windowedDialogInitialized !== "true") {
    dialog.dataset.windowedDialogInitialized = "true";
    dialog.addEventListener("close", () => resetWindowedDialog(dialog));
  }

  requestAnimationFrame(() => {
    if (dialog.open) sizeWindowedDialogFromDefault(dialog);
  });
}

export function initializeDialogLayoutPersistence(dialog, storageKey = "") {
  if (!(dialog instanceof HTMLDialogElement)) return;
  if (storageKey) setDialogLayoutStorageKey(dialog, storageKey);
  if (dialog.dataset.dialogLayoutPersistenceInitialized === "true") return;

  dialog.dataset.dialogLayoutPersistenceInitialized = "true";
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      if (!dialog.open || dialog.dataset.dialogLayoutApplying === "true") return;
      if (dialog.dataset.dialogResizeActive === "true") saveDialogLayout(dialog);
    });
    observer.observe(dialog);
    dialogResizeObservers.set(dialog, observer);
  }

  dialog.addEventListener("close", () => {
    dialogResizeFinishers.get(dialog)?.();
    delete dialog.dataset.dialogResizeActive;
    if (!dialog.id) {
      dialogResizeObservers.get(dialog)?.disconnect();
      dialogResizeObservers.delete(dialog);
    }
  });
}

export function setDialogLayoutStorageKey(dialog, storageKey) {
  if (!(dialog instanceof HTMLDialogElement)) return;
  dialog.dataset.dialogLayoutKey = normalizeDialogLayoutKey(storageKey);
}

export function restoreDialogLayout(dialog) {
  const layout = readDialogLayout(dialog);
  if (!layout) return false;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const minWidth = dialogDefaultSize(dialog, "width");
  const minHeight = dialogDefaultSize(dialog, "height");
  const maxWidth = Math.max(minWidth || 0, viewportWidth - 8);
  const maxHeight = Math.max(minHeight || 0, viewportHeight - 8);
  const width = clamp(Math.round(layout.width), minWidth || 0, maxWidth);
  const height = clamp(Math.round(layout.height), minHeight || 0, maxHeight);
  const left = Number.isFinite(layout.left) ? layout.left : dialog.getBoundingClientRect().left;
  const top = Number.isFinite(layout.top) ? layout.top : dialog.getBoundingClientRect().top;

  runWithoutDialogLayoutSave(dialog, () => {
    dialog.classList.remove("is-maximized");
    dialog.style.width = `${width}px`;
    dialog.style.height = `${height}px`;
    const position = clampDialogPosition(dialog, left, top);
    positionDialog(dialog, position.left, position.top);
  });
  return true;
}

export function resetDialogLayoutPreference(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) return;

  removeDialogLayout(dialog);
  runWithoutDialogLayoutSave(dialog, () => resetDialogPosition(dialog));
}

function ensureWindowedDialogControls(dialog, options = {}) {
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

  let resetButton = actions.querySelector("[data-windowed-dialog-reset]");
  if (!options.showResetButton) {
    resetButton?.remove();
    return button;
  }

  if (!resetButton) {
    resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "icon-btn dialog-reset-button";
    resetButton.dataset.windowedDialogReset = "true";
    resetButton.textContent = "Reset";
    resetButton.title = "Reset";
    resetButton.setAttribute("aria-label", "Reset");
    actions.insertBefore(resetButton, button);
    resetButton.addEventListener("click", () => {
      const customReset = dialogResetHandlers.get(dialog);
      if (customReset) {
        customReset(dialog);
      }

      resetWindowedDialogLayout(dialog);
    });
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
  restoreDialogLayout(dialog);
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

function resetWindowedDialogLayout(dialog) {
  if (!dialog.open) return;

  resetDialogLayoutPreference(dialog);
  dialog.classList.remove("is-maximized");
  updateWindowedDialogButton(dialog.querySelector("[data-windowed-dialog-toggle]"), false);

  const defaultWidth = dialog.style.getPropertyValue("--windowed-dialog-default-width");
  const defaultHeight = dialog.style.getPropertyValue("--windowed-dialog-default-height");
  runWithoutDialogLayoutSave(dialog, () => {
    dialog.style.width = defaultWidth || "";
    dialog.style.height = defaultHeight || "";
  });
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

function anchorDialogResize(event) {
  if (event.button !== 0) return;

  const dialog = event.target.closest?.("dialog.dialog");
  if (!dialog?.open || dialog.classList.contains("is-maximized")) return;

  const rect = dialog.getBoundingClientRect();
  const isResizeHandle = event.clientX >= rect.right - dialogResizeHandleSize
    && event.clientY >= rect.bottom - dialogResizeHandleSize;
  if (!isResizeHandle) return;

  startDialogResizeSave(dialog);
  anchorDialogAtCurrentRect(dialog, rect);
}

function startDialogResizeSave(dialog) {
  dialogResizeFinishers.get(dialog)?.();
  dialog.dataset.dialogResizeActive = "true";

  const finish = () => {
    delete dialog.dataset.dialogResizeActive;
    saveDialogLayout(dialog);
    document.removeEventListener("pointerup", finish);
    document.removeEventListener("pointercancel", finish);
    dialogResizeFinishers.delete(dialog);
  };

  dialogResizeFinishers.set(dialog, finish);
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
}

function anchorDialogAtCurrentRect(dialog, rect = dialog.getBoundingClientRect()) {
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (!width || !height) return;

  dialog.style.width = `${width}px`;
  dialog.style.height = `${height}px`;

  const position = clampDialogPosition(dialog, rect.left, rect.top);
  positionDialog(dialog, position.left, position.top);
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

  const dialog = activeDialogDrag.dialog;
  activeDialogDrag.dialog.classList.remove("is-dialog-dragging");
  try {
    activeDialogDrag.head.releasePointerCapture(pointerId);
  } catch {
    // The pointer may already have been released by the browser.
  }

  saveDialogLayout(dialog);
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

function saveDialogLayout(dialog) {
  if (!shouldPersistDialogLayout(dialog) || dialog.dataset.dialogLayoutApplying === "true" || dialog.classList.contains("is-maximized")) return;

  const storageKey = dialogLayoutStorageKey(dialog);
  if (!storageKey) return;

  const rect = dialog.getBoundingClientRect();
  const layout = {
    version: dialogLayoutStorageVersion,
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };

  if (!layout.width || !layout.height) return;

  try {
    localStorage.setItem(`${dialogLayoutStoragePrefix}${storageKey}`, JSON.stringify(layout));
  } catch {
    // Local storage is optional for dialog convenience preferences.
  }
}

function readDialogLayout(dialog) {
  const storageKey = dialogLayoutStorageKey(dialog);
  if (!storageKey) return null;

  try {
    const value = localStorage.getItem(`${dialogLayoutStoragePrefix}${storageKey}`);
    if (!value) return null;

    const layout = JSON.parse(value);
    if (!layout || layout.version !== dialogLayoutStorageVersion) return null;
    if (![layout.left, layout.top, layout.width, layout.height].every(Number.isFinite)) return null;
    return layout;
  } catch {
    return null;
  }
}

function removeDialogLayout(dialog) {
  const storageKey = dialogLayoutStorageKey(dialog);
  if (!storageKey) return;

  try {
    localStorage.removeItem(`${dialogLayoutStoragePrefix}${storageKey}`);
  } catch {
    // Local storage is optional for dialog convenience preferences.
  }
}

function shouldPersistDialogLayout(dialog) {
  return dialog instanceof HTMLDialogElement
    && dialog.classList.contains("dialog")
    && (dialog.classList.contains("editor-dialog") || dialog.classList.contains("windowed-dialog"));
}

function dialogLayoutStorageKey(dialog) {
  const explicitKey = normalizeDialogLayoutKey(dialog.dataset.dialogLayoutKey || "");
  if (explicitKey) return explicitKey;

  const dataDialogKey = Object.keys(dialog.dataset)
    .find(key => key.endsWith("Dialog") && dialog.dataset[key] === "true");
  if (dataDialogKey) return normalizeDialogLayoutKey(kebabCase(dataDialogKey));

  const classKey = Array.from(dialog.classList)
    .filter(className => !dialogLayoutTransientClasses.has(className))
    .find(className => className.endsWith("-filter-dialog") || className.endsWith("-dialog"));
  if (classKey) return normalizeDialogLayoutKey(classKey);

  if (dialog.classList.contains("detail-dialog")) return "detail-dialog";

  const title = dialog.querySelector(".dialog-head h2")?.textContent || "";
  return normalizeDialogLayoutKey(title ? `dialog:${title}` : "");
}

function normalizeDialogLayoutKey(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function kebabCase(value) {
  return String(value || "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function dialogDefaultSize(dialog, dimension) {
  const editorProperty = dimension === "width" ? "--editor-dialog-default-width" : "--editor-dialog-default-height";
  const windowedProperty = dimension === "width" ? "--windowed-dialog-default-width" : "--windowed-dialog-default-height";
  return cssPixelValue(dialog, editorProperty) || cssPixelValue(dialog, windowedProperty) || 0;
}

function cssPixelValue(element, propertyName) {
  const value = element.style.getPropertyValue(propertyName) || getComputedStyle(element).getPropertyValue(propertyName);
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function runWithoutDialogLayoutSave(dialog, action) {
  dialog.dataset.dialogLayoutApplying = "true";
  try {
    action();
  } finally {
    requestAnimationFrame(() => {
      delete dialog.dataset.dialogLayoutApplying;
    });
  }
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
