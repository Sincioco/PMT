import { buttonContent, pageActionsMenuHtml } from "./buttons.js?v=20260701-unified-dropdowns";
import { initializeWindowedDialog } from "./dialogs.js?v=20260711-bug-dialog-header-controls";
import {
  preferenceKeys,
  readJsonPreference,
  removePreference,
  writeJsonPreference
} from "../core/preferences.js?v=20260711-bug-dialog-customize";
import { createReorderDrag } from "../shared/reorder-drag.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

const bugDialogFieldDefinitions = Object.freeze([
  { key: "projectId", label: "Project" },
  { key: "sprintId", label: "Sprint" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "percentCompleted", label: "Percent" },
  { key: "environment", label: "Environment" },
  { key: "severity", label: "Severity" },
  { key: "descriptionHtml", label: "Description" },
  { key: "url", label: "URL" },
  { key: "attachments", label: "Attachments" },
  { key: "startDate", label: "Start" },
  { key: "endDate", label: "End" },
  { key: "stepsToReproduceHtml", label: "Steps to Reproduce" },
  { key: "actualResultHtml", label: "Actual Result" },
  { key: "expectedResultHtml", label: "Expected Result" },
  { key: "rootCauseAnalysisHtml", label: "Root Cause Analysis" },
  { key: "assigneeIds", label: "Assignees" },
  { key: "reporterIds", label: "Reporters" },
  { key: "dependencyTaskIds", label: "Dependencies" }
]);

let activeDialog = null;
let activeDrag = null;

export function bugDialogCustomizationButtonHtml() {
  return `
    <button type="button" class="bug-dialog-customize-button" data-action="customize-bug-dialog-view" title="Customize View" aria-label="Customize View" aria-haspopup="dialog" hidden>
      <span class="button-icon" aria-hidden="true">${customizeViewIconHtml()}</span>
    </button>
  `;
}

export function clearBugDialogHeaderActionsMenu(root = document) {
  const actions = root?.querySelector?.(".dialog-head-actions");
  if (!actions) return;

  actions.querySelector("[data-bug-dialog-header-menu]")?.remove();
  actions.querySelectorAll("[data-dialog-overflow-source]").forEach(source => {
    source.hidden = source.dataset.dialogOverflowOriginalHidden === "true";
    delete source.dataset.dialogOverflowOriginalHidden;
    delete source.dataset.dialogOverflowSource;
  });
}

export function syncBugDialogHeaderActionsMenu(root = document) {
  const actions = root?.querySelector?.(".dialog-head-actions");
  if (!actions) return;

  clearBugDialogHeaderActionsMenu(root);

  const menuActions = bugDialogHeaderMenuActions(actions);
  if (!menuActions.length) return;

  const template = document.createElement("template");
  template.innerHTML = pageActionsMenuHtml(menuActions.map(({ source, ...item }) => item)).trim();
  const menu = template.content.firstElementChild;
  if (!menu) return;

  menu.classList.add("dialog-header-actions-menu");
  menu.dataset.bugDialogHeaderMenu = "true";
  if (root?.id === "editorDialog") menu.dataset.editorDynamicHeadAction = "true";
  menu.addEventListener("click", event => handleBugDialogHeaderMenuClick(root, event));

  menuActions.forEach(({ source }) => hideDialogHeaderActionSource(source));
  const maximizeButton = actions.querySelector(":scope > .dialog-maximize-button, :scope > [data-windowed-dialog-toggle]");
  const closeButton = actions.querySelector(":scope > [data-close], :scope > #closeDialog");
  actions.insertBefore(menu, maximizeButton || closeButton || null);
}

function bugDialogHeaderMenuActions(actions) {
  return [
    headerMenuAction(actions, {
      selector: ".dialog-rich-tools-toggle-button",
      action: "dialog-toggle-rich-tools",
      icon: richToolsIconHtml
    }),
    headerMenuAction(actions, {
      selector: ".dialog-reset-button, [data-windowed-dialog-reset]",
      action: "dialog-reset-layout",
      label: "Reset",
      icon: () => "&#8634;"
    }),
    headerMenuAction(actions, {
      selector: ".bug-dialog-customize-button",
      action: "dialog-customize-view",
      label: "Customize View",
      icon: customizeViewIconHtml,
      includeHidden: true
    })
  ].filter(Boolean);
}

function headerMenuAction(actions, config) {
  const source = actions.querySelector(config.selector);
  if (!source || (!config.includeHidden && source.hidden)) return null;

  const title = source.getAttribute("aria-label") || source.title || config.label || "";
  const label = config.label || title;
  return {
    source,
    action: config.action,
    icon: typeof config.icon === "function" ? config.icon(source) : config.icon,
    label,
    title
  };
}

function hideDialogHeaderActionSource(source) {
  if (!source.dataset.dialogOverflowSource) {
    source.dataset.dialogOverflowOriginalHidden = source.hidden ? "true" : "false";
  }

  source.dataset.dialogOverflowSource = "true";
  source.hidden = true;
}

function handleBugDialogHeaderMenuClick(root, event) {
  const item = event.target.closest(".page-actions-item[data-action]");
  if (!item) return;

  event.preventDefault();
  const menu = item.closest("details");
  if (menu) menu.open = false;

  const source = bugDialogHeaderActionSource(root, item.dataset.action);
  if (!source || source.disabled) return;

  source.click();
  requestAnimationFrame(() => syncBugDialogHeaderActionsMenu(root));
}

function bugDialogHeaderActionSource(root, action) {
  const actions = root?.querySelector?.(".dialog-head-actions");
  if (!actions) return null;

  if (action === "dialog-customize-view") return actions.querySelector(".bug-dialog-customize-button");
  if (action === "dialog-toggle-rich-tools") return actions.querySelector(".dialog-rich-tools-toggle-button");
  if (action === "dialog-reset-layout") return actions.querySelector(".dialog-reset-button, [data-windowed-dialog-reset]");
  return null;
}

function customizeViewIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h9M17 7h3M13 5v4M4 17h3M11 17h9M11 15v4M4 12h5M13 12h7M9 10v4"></path>
    </svg>
  `;
}

function richToolsIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 7h14M5 12h14M5 17h14M8 5v4M16 10v4M11 15v4"></path>
    </svg>
  `;
}

export function bugDialogFieldHtml(key, html) {
  const definition = bugDialogFieldDefinition(key);
  if (!definition) return html;

  const prefs = readBugDialogFieldPrefs();
  const visible = prefs.visible.includes(key);
  const attrs = [
    `data-bug-dialog-field="${escapeAttr(key)}"`,
    `data-bug-dialog-original-label="${escapeAttr(definition.label)}"`,
    visible ? "" : "hidden"
  ].filter(Boolean).join(" ");

  return String(html || "").replace(/<(\w+)([^>]*)>/, `<$1$2 ${attrs}>`);
}

export function bugDialogFieldLabel(key) {
  const definition = bugDialogFieldDefinition(key);
  if (!definition) return "";

  const prefs = readBugDialogFieldPrefs();
  return prefs.labels[key] || definition.label;
}

export function bugDialogFieldDefinition(key) {
  return bugDialogFieldDefinitions.find(field => field.key === key) || null;
}

export function bugDialogRichFieldKeys() {
  return [
    "descriptionHtml",
    "stepsToReproduceHtml",
    "actualResultHtml",
    "expectedResultHtml",
    "rootCauseAnalysisHtml"
  ];
}

export function applyBugDialogFieldPreferences(root = document) {
  const prefs = readBugDialogFieldPrefs();
  const order = new Map(prefs.order.map((key, index) => [key, index]));
  const fields = [...root.querySelectorAll("[data-bug-dialog-field]")];
  const parents = new Set(fields.map(field => field.parentElement).filter(Boolean));

  fields.forEach(field => {
    const key = field.dataset.bugDialogField || "";
    const label = prefs.labels[key] || field.dataset.bugDialogOriginalLabel || key;
    field.hidden = !prefs.visible.includes(key);
    updateBugDialogFieldLabel(field, label);
  });

  parents.forEach(parent => {
    [...parent.querySelectorAll(":scope > [data-bug-dialog-field]")]
      .sort((left, right) => (order.get(left.dataset.bugDialogField) ?? 0) - (order.get(right.dataset.bugDialogField) ?? 0))
      .forEach(field => parent.appendChild(field));
  });
}

export function openBugDialogCustomizationDialog() {
  if (activeDialog?.isConnected) {
    if (!activeDialog.open) activeDialog.showModal?.();
    activeDialog.querySelector("[data-bug-dialog-label]")?.focus({ preventScroll: true });
    return;
  }

  const modal = document.createElement("dialog");
  modal.className = "dialog windowed-dialog bug-dialog-customize-dialog";
  modal.dataset.bugDialogCustomizeDialog = "true";
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>Customize Bug Report View</h2>
        <button type="button" class="icon-btn" data-close-bug-dialog-customize title="Close" aria-label="Close">x</button>
      </div>
      <div class="dialog-body bug-dialog-customize-body" data-bug-dialog-customize-body></div>
      <div class="dialog-actions">
        <div class="dialog-action-group is-left">
          <button type="button" class="secondary text-icon-button" data-reset-bug-dialog-customize>${buttonContent("&#8635;", "Reset")}</button>
        </div>
        <button type="button" class="primary text-icon-button" data-save-bug-dialog-customize>${buttonContent("&#10003;", "Done")}</button>
      </div>
    </form>
  `;

  activeDialog = modal;
  renderBugDialogCustomizationRows(modal, readBugDialogFieldPrefs());
  document.body.appendChild(modal);
  initializeWindowedDialog(modal, { onReset: () => resetBugDialogCustomization(modal) });
  modal.addEventListener("input", event => handleBugDialogCustomizationInput(modal, event.target));
  modal.addEventListener("change", event => handleBugDialogCustomizationChange(modal, event.target));
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close-bug-dialog-customize]")) modal.close();
    if (event.target.closest("[data-reset-bug-dialog-customize]")) resetBugDialogCustomization(modal);
    if (event.target.closest("[data-save-bug-dialog-customize]")) saveBugDialogCustomization(modal);
  });
  modal.addEventListener("close", () => {
    activeDrag?.unbind();
    activeDrag = null;
    activeDialog = null;
    modal.remove();
  }, { once: true });
  modal.showModal();
  modal.querySelector("[data-bug-dialog-label]")?.focus({ preventScroll: true });
}

function renderBugDialogCustomizationRows(modal, prefs) {
  const body = modal.querySelector("[data-bug-dialog-customize-body]");
  if (!body) return;

  const definitionsByKey = new Map(bugDialogFieldDefinitions.map(field => [field.key, field]));
  body.innerHTML = `
    <table class="table settings-table settings-navigation-table work-item-table bug-dialog-customize-table">
      <thead>
        <tr>
          <th class="bug-dialog-visible-column">Visible</th>
          <th>Original Field</th>
          <th>Display Label</th>
          <th aria-label="Order"></th>
        </tr>
      </thead>
      <tbody data-reorder-list="bug-dialog-fields">
        ${prefs.order.map(key => definitionsByKey.get(key)).filter(Boolean).map(field => bugDialogCustomizationRowHtml(field, prefs)).join("")}
      </tbody>
    </table>
  `;

  activeDrag?.unbind();
  const list = body.querySelector('tbody[data-reorder-list="bug-dialog-fields"]');
  if (!list) return;

  activeDrag = createReorderDrag({
    root: list,
    containerSelector: 'tbody[data-reorder-list="bug-dialog-fields"]',
    itemSelector: "tr[data-bug-dialog-field-row]",
    getItemKey: item => item.dataset.bugDialogFieldRow || "",
    onDrop: ({ orderedKeys }) => {
      const draft = bugDialogPrefsFromDialog(modal);
      draft.order = normalizedBugDialogFieldOrder(orderedKeys);
      const prefs = normalizeBugDialogFieldPrefs(draft);
      writeJsonPreference(preferenceKeys.bugDialogFields, prefs);
      renderBugDialogCustomizationRows(modal, prefs);
      applyBugDialogFieldPreferences(document);
    }
  });
  activeDrag.bind();
}

function bugDialogCustomizationRowHtml(field, prefs) {
  const label = prefs.labels[field.key] || field.label;
  return `
    <tr data-bug-dialog-field-row="${escapeAttr(field.key)}">
      <td class="settings-nav-visible-cell bug-dialog-visible-cell">
        <label class="settings-nav-toggle" title="Show ${escapeAttr(field.label)}">
          <input type="checkbox" data-bug-dialog-visible="${escapeAttr(field.key)}" aria-label="Show ${escapeAttr(field.label)}" ${prefs.visible.includes(field.key) ? "checked" : ""}>
        </label>
      </td>
      <td>${escapeHtml(field.label)}</td>
      <td>
        <input type="text" data-bug-dialog-label="${escapeAttr(field.key)}" value="${escapeAttr(label)}" aria-label="${escapeAttr(`Display label for ${field.label}`)}">
      </td>
      <td class="action-cell">
        <button class="work-item-drag-handle settings-nav-drag-handle" type="button" data-drag-handle title="Drag ${escapeAttr(field.label)}" aria-label="Drag ${escapeAttr(field.label)}">
          <span aria-hidden="true">&#8942;&#8942;</span>
        </button>
      </td>
    </tr>
  `;
}

function handleBugDialogCustomizationInput(modal, target) {
  if (!target?.matches("[data-bug-dialog-label]")) return;

  const prefs = bugDialogPrefsFromDialog(modal);
  writeJsonPreference(preferenceKeys.bugDialogFields, normalizeBugDialogFieldPrefs(prefs));
  applyBugDialogFieldPreferences(document);
}

function handleBugDialogCustomizationChange(modal, target) {
  if (!target?.matches("[data-bug-dialog-visible]")) return;

  if (!target.checked && !modal.querySelectorAll("[data-bug-dialog-visible]:checked").length) {
    target.checked = true;
    return;
  }

  const prefs = bugDialogPrefsFromDialog(modal);
  writeJsonPreference(preferenceKeys.bugDialogFields, normalizeBugDialogFieldPrefs(prefs));
  applyBugDialogFieldPreferences(document);
}

function saveBugDialogCustomization(modal) {
  writeJsonPreference(preferenceKeys.bugDialogFields, normalizeBugDialogFieldPrefs(bugDialogPrefsFromDialog(modal)));
  applyBugDialogFieldPreferences(document);
  modal.close();
}

function resetBugDialogCustomization(modal) {
  removePreference(preferenceKeys.bugDialogFields);
  const prefs = defaultBugDialogFieldPrefs();
  renderBugDialogCustomizationRows(modal, prefs);
  applyBugDialogFieldPreferences(document);
}

function bugDialogPrefsFromDialog(modal) {
  const order = [...modal.querySelectorAll("[data-bug-dialog-field-row]")]
    .map(row => row.dataset.bugDialogFieldRow || "")
    .filter(Boolean);
  const visible = [...modal.querySelectorAll("[data-bug-dialog-visible]:checked")]
    .map(input => input.dataset.bugDialogVisible || "")
    .filter(Boolean);
  const labels = {};

  modal.querySelectorAll("[data-bug-dialog-label]").forEach(input => {
    labels[input.dataset.bugDialogLabel || ""] = input.value;
  });

  return normalizeBugDialogFieldPrefs({ order, visible, labels });
}

function readBugDialogFieldPrefs() {
  return normalizeBugDialogFieldPrefs(readJsonPreference(preferenceKeys.bugDialogFields, {}));
}

function normalizeBugDialogFieldPrefs(preferences = {}) {
  const saved = preferences && typeof preferences === "object" && !Array.isArray(preferences)
    ? preferences
    : {};
  const allowedKeys = bugDialogFieldKeySet();
  const visible = normalizeStringArray(saved.visible).filter(key => allowedKeys.has(key));
  const labels = {};

  Object.entries(saved.labels || {}).forEach(([key, label]) => {
    if (!allowedKeys.has(key)) return;

    const originalLabel = bugDialogFieldDefinition(key)?.label || key;
    const cleanLabel = String(label || "").trim();
    if (cleanLabel && cleanLabel !== originalLabel) labels[key] = cleanLabel;
  });

  return {
    order: normalizedBugDialogFieldOrder(saved.order),
    visible: visible.length ? visible : bugDialogDefaultVisibleKeys(),
    labels
  };
}

function defaultBugDialogFieldPrefs() {
  return {
    order: bugDialogDefaultOrder(),
    visible: bugDialogDefaultVisibleKeys(),
    labels: {}
  };
}

function normalizedBugDialogFieldOrder(order = []) {
  const allowedKeys = bugDialogFieldKeySet();
  const orderedKeys = normalizeStringArray(order).filter(key => allowedKeys.has(key));

  bugDialogDefaultOrder().forEach(key => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  });

  return orderedKeys;
}

function bugDialogDefaultOrder() {
  return bugDialogFieldDefinitions.map(field => field.key);
}

function bugDialogDefaultVisibleKeys() {
  return bugDialogDefaultOrder();
}

function bugDialogFieldKeySet() {
  return new Set(bugDialogDefaultOrder());
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(item => String(item || "")).filter(Boolean) : [];
}

function updateBugDialogFieldLabel(field, label) {
  const labelElement = field.querySelector(":scope > label")
    || field.querySelector(":scope > legend")
    || field.querySelector(":scope > fieldset > legend")
    || field.querySelector(":scope > span");

  if (labelElement) labelElement.textContent = label;
}
