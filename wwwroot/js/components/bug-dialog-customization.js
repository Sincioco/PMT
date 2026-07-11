import { buttonContent, pageActionsMenuHtml } from "./buttons.js?v=20260701-unified-dropdowns";
import { initializeWindowedDialog } from "./dialogs.js?v=20260711-task-dialog-customize";
import {
  preferenceKeys,
  readJsonPreference,
  removePreference,
  writeJsonPreference
} from "../core/preferences.js?v=20260711-task-dialog-customize";
import { createReorderDrag } from "../shared/reorder-drag.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

const dialogConfigs = Object.freeze({
  bug: Object.freeze({
    type: "bug",
    title: "Bug Report",
    preferenceKey: preferenceKeys.bugDialogFields,
    fields: Object.freeze([
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
    ])
  }),
  task: Object.freeze({
    type: "task",
    title: "Dev Task",
    preferenceKey: preferenceKeys.taskDialogFields,
    fields: Object.freeze([
      { key: "projectId", label: "Project" },
      { key: "sprintId", label: "Sprint" },
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "priority", label: "Priority" },
      { key: "percentCompleted", label: "Percent" },
      { key: "descriptionHtml", label: "Description" },
      { key: "attachments", label: "Attachments" },
      { key: "assigneeIds", label: "Assignees" },
      { key: "startDate", label: "Start" },
      { key: "endDate", label: "End" },
      { key: "parentTaskId", label: "Parent" },
      { key: "url", label: "URL" },
      { key: "dependencyTaskIds", label: "Dependencies" }
    ])
  })
});

let activeDialog = null;
let activeDrag = null;

export function bugDialogCustomizationButtonHtml() {
  return dialogCustomizationButtonHtml("bug");
}

export function taskDialogCustomizationButtonHtml() {
  return dialogCustomizationButtonHtml("task");
}

function dialogCustomizationButtonHtml(type) {
  const config = dialogConfig(type);
  return `
    <button type="button" class="${escapeAttr(type)}-dialog-customize-button work-item-dialog-customize-button" data-action="customize-${escapeAttr(type)}-dialog-view" title="Customize View" aria-label="Customize View" aria-haspopup="dialog" hidden>
      <span class="button-icon" aria-hidden="true">${customizeViewIconHtml()}</span>
    </button>
  `;
}

export function clearBugDialogHeaderActionsMenu(root = document) {
  clearWorkItemDialogHeaderActionsMenu(root);
}

export function clearWorkItemDialogHeaderActionsMenu(root = document) {
  const actions = root?.querySelector?.(".dialog-head-actions");
  if (!actions) return;

  actions.querySelectorAll("[data-work-item-dialog-header-menu], [data-bug-dialog-header-menu]").forEach(menu => menu.remove());
  actions.querySelectorAll("[data-dialog-overflow-source]").forEach(source => {
    source.hidden = source.dataset.dialogOverflowOriginalHidden === "true";
    delete source.dataset.dialogOverflowOriginalHidden;
    delete source.dataset.dialogOverflowSource;
  });
}

export function syncBugDialogHeaderActionsMenu(root = document) {
  syncWorkItemDialogHeaderActionsMenu(root);
}

export function syncTaskDialogHeaderActionsMenu(root = document) {
  syncWorkItemDialogHeaderActionsMenu(root);
}

export function syncWorkItemDialogHeaderActionsMenu(root = document) {
  const actions = root?.querySelector?.(".dialog-head-actions");
  if (!actions) return;

  clearWorkItemDialogHeaderActionsMenu(root);

  const menuActions = workItemDialogHeaderMenuActions(actions);
  if (!menuActions.length) return;

  const template = document.createElement("template");
  template.innerHTML = pageActionsMenuHtml(menuActions.map(({ source, ...item }) => item)).trim();
  const menu = template.content.firstElementChild;
  if (!menu) return;

  menu.classList.add("dialog-header-actions-menu");
  menu.dataset.workItemDialogHeaderMenu = "true";
  if (root?.id === "editorDialog") menu.dataset.editorDynamicHeadAction = "true";
  menu.addEventListener("click", event => handleWorkItemDialogHeaderMenuClick(root, event));

  menuActions.forEach(({ source }) => hideDialogHeaderActionSource(source));
  const maximizeButton = actions.querySelector(":scope > .dialog-maximize-button, :scope > [data-windowed-dialog-toggle]");
  const closeButton = actions.querySelector(":scope > [data-close], :scope > #closeDialog");
  actions.insertBefore(menu, maximizeButton || closeButton || null);
}

function workItemDialogHeaderMenuActions(actions) {
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
      selector: ".work-item-dialog-customize-button",
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

function handleWorkItemDialogHeaderMenuClick(root, event) {
  const item = event.target.closest(".page-actions-item[data-action]");
  if (!item) return;

  event.preventDefault();
  const menu = item.closest("details");
  if (menu) menu.open = false;

  const source = workItemDialogHeaderActionSource(root, item.dataset.action);
  if (!source || source.disabled) return;

  source.click();
  requestAnimationFrame(() => syncWorkItemDialogHeaderActionsMenu(root));
}

function workItemDialogHeaderActionSource(root, action) {
  const actions = root?.querySelector?.(".dialog-head-actions");
  if (!actions) return null;

  if (action === "dialog-customize-view") return actions.querySelector(".work-item-dialog-customize-button");
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
  return dialogFieldHtml("bug", key, html);
}

export function taskDialogFieldHtml(key, html) {
  return dialogFieldHtml("task", key, html);
}

function dialogFieldHtml(type, key, html) {
  const definition = dialogFieldDefinition(type, key);
  if (!definition) return html;

  const config = dialogConfig(type);
  const prefs = readDialogFieldPrefs(type);
  const visible = prefs.visible.includes(key);
  const attrs = [
    `data-work-item-dialog-type="${escapeAttr(config.type)}"`,
    `data-work-item-dialog-field="${escapeAttr(key)}"`,
    `data-work-item-dialog-original-label="${escapeAttr(definition.label)}"`,
    visible ? "" : "hidden"
  ].filter(Boolean).join(" ");

  return String(html || "").replace(/<(\w+)([^>]*)>/, `<$1$2 ${attrs}>`);
}

export function bugDialogFieldLabel(key) {
  return dialogFieldLabel("bug", key);
}

export function taskDialogFieldLabel(key) {
  return dialogFieldLabel("task", key);
}

function dialogFieldLabel(type, key) {
  const definition = dialogFieldDefinition(type, key);
  if (!definition) return "";

  const prefs = readDialogFieldPrefs(type);
  return prefs.labels[key] || definition.label;
}

export function bugDialogFieldDefinition(key) {
  return dialogFieldDefinition("bug", key);
}

export function taskDialogFieldDefinition(key) {
  return dialogFieldDefinition("task", key);
}

function dialogFieldDefinition(type, key) {
  return dialogConfig(type).fields.find(field => field.key === key) || null;
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

export function taskDialogRichFieldKeys() {
  return ["descriptionHtml"];
}

export function applyBugDialogFieldPreferences(root = document) {
  applyDialogFieldPreferences("bug", root);
}

export function applyTaskDialogFieldPreferences(root = document) {
  applyDialogFieldPreferences("task", root);
}

function applyDialogFieldPreferences(type, root = document) {
  const config = dialogConfig(type);
  const prefs = readDialogFieldPrefs(type);
  const order = new Map(prefs.order.map((key, index) => [key, index]));
  const selector = `[data-work-item-dialog-type="${config.type}"][data-work-item-dialog-field]`;
  const fields = [...root.querySelectorAll(selector)];
  const parents = new Set(fields.map(field => field.parentElement).filter(Boolean));

  fields.forEach(field => {
    const key = field.dataset.workItemDialogField || "";
    const label = prefs.labels[key] || field.dataset.workItemDialogOriginalLabel || key;
    field.hidden = !prefs.visible.includes(key);
    updateDialogFieldLabel(field, label);
  });

  parents.forEach(parent => {
    [...parent.querySelectorAll(`:scope > ${selector}`)]
      .sort((left, right) => (order.get(left.dataset.workItemDialogField) ?? 0) - (order.get(right.dataset.workItemDialogField) ?? 0))
      .forEach(field => parent.appendChild(field));
  });
}

export function openBugDialogCustomizationDialog() {
  openDialogCustomizationDialog("bug");
}

export function openTaskDialogCustomizationDialog() {
  openDialogCustomizationDialog("task");
}

function openDialogCustomizationDialog(type) {
  const config = dialogConfig(type);
  if (activeDialog?.isConnected) {
    if (activeDialog.dataset.dialogCustomizeType === config.type) {
      if (!activeDialog.open) activeDialog.showModal?.();
      activeDialog.querySelector("[data-dialog-label]")?.focus({ preventScroll: true });
      return;
    }

    activeDialog.close();
  }

  const modal = document.createElement("dialog");
  modal.className = "dialog windowed-dialog work-item-dialog-customize-dialog bug-dialog-customize-dialog";
  modal.dataset.dialogCustomizeType = config.type;
  modal.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>Customize ${escapeHtml(config.title)} View</h2>
        <button type="button" class="icon-btn" data-close-dialog-customize title="Close" aria-label="Close">x</button>
      </div>
      <div class="dialog-body bug-dialog-customize-body" data-dialog-customize-body></div>
      <div class="dialog-actions">
        <div class="dialog-action-group is-left">
          <button type="button" class="secondary text-icon-button" data-reset-dialog-customize>${buttonContent("&#8635;", "Reset")}</button>
        </div>
        <button type="button" class="primary text-icon-button" data-save-dialog-customize>${buttonContent("&#10003;", "Done")}</button>
      </div>
    </form>
  `;

  activeDialog = modal;
  renderDialogCustomizationRows(modal, readDialogFieldPrefs(config.type));
  document.body.appendChild(modal);
  initializeWindowedDialog(modal, { onReset: () => resetDialogCustomization(modal) });
  modal.addEventListener("input", event => handleDialogCustomizationInput(modal, event.target));
  modal.addEventListener("change", event => handleDialogCustomizationChange(modal, event.target));
  modal.addEventListener("click", event => {
    if (event.target.closest("[data-close-dialog-customize]")) modal.close();
    if (event.target.closest("[data-reset-dialog-customize]")) resetDialogCustomization(modal);
    if (event.target.closest("[data-save-dialog-customize]")) saveDialogCustomization(modal);
  });
  modal.addEventListener("close", () => {
    activeDrag?.unbind();
    activeDrag = null;
    activeDialog = null;
    modal.remove();
  }, { once: true });
  modal.showModal();
  modal.querySelector("[data-dialog-label]")?.focus({ preventScroll: true });
}

function renderDialogCustomizationRows(modal, prefs) {
  const type = modal.dataset.dialogCustomizeType || "bug";
  const config = dialogConfig(type);
  const body = modal.querySelector("[data-dialog-customize-body]");
  if (!body) return;

  const definitionsByKey = new Map(config.fields.map(field => [field.key, field]));
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
      <tbody data-reorder-list="dialog-fields">
        ${prefs.order.map(key => definitionsByKey.get(key)).filter(Boolean).map(field => dialogCustomizationRowHtml(field, prefs)).join("")}
      </tbody>
    </table>
  `;

  activeDrag?.unbind();
  const list = body.querySelector('tbody[data-reorder-list="dialog-fields"]');
  if (!list) return;

  activeDrag = createReorderDrag({
    root: list,
    containerSelector: 'tbody[data-reorder-list="dialog-fields"]',
    itemSelector: "tr[data-dialog-field-row]",
    getItemKey: item => item.dataset.dialogFieldRow || "",
    onDrop: ({ orderedKeys }) => {
      const draft = dialogPrefsFromDialog(modal);
      draft.order = normalizedDialogFieldOrder(type, orderedKeys);
      const prefs = normalizeDialogFieldPrefs(type, draft);
      writeJsonPreference(config.preferenceKey, prefs);
      renderDialogCustomizationRows(modal, prefs);
      applyDialogFieldPreferences(type, document);
    }
  });
  activeDrag.bind();
}

function dialogCustomizationRowHtml(field, prefs) {
  const label = prefs.labels[field.key] || field.label;
  return `
    <tr data-dialog-field-row="${escapeAttr(field.key)}">
      <td class="settings-nav-visible-cell bug-dialog-visible-cell">
        <label class="settings-nav-toggle" title="Show ${escapeAttr(field.label)}">
          <input type="checkbox" data-dialog-visible="${escapeAttr(field.key)}" aria-label="Show ${escapeAttr(field.label)}" ${prefs.visible.includes(field.key) ? "checked" : ""}>
        </label>
      </td>
      <td>${escapeHtml(field.label)}</td>
      <td>
        <input type="text" data-dialog-label="${escapeAttr(field.key)}" value="${escapeAttr(label)}" aria-label="${escapeAttr(`Display label for ${field.label}`)}">
      </td>
      <td class="action-cell">
        <button class="work-item-drag-handle settings-nav-drag-handle" type="button" data-drag-handle title="Drag ${escapeAttr(field.label)}" aria-label="Drag ${escapeAttr(field.label)}">
          <span aria-hidden="true">&#8942;&#8942;</span>
        </button>
      </td>
    </tr>
  `;
}

function handleDialogCustomizationInput(modal, target) {
  if (!target?.matches("[data-dialog-label]")) return;

  const type = modal.dataset.dialogCustomizeType || "bug";
  const prefs = dialogPrefsFromDialog(modal);
  writeJsonPreference(dialogConfig(type).preferenceKey, normalizeDialogFieldPrefs(type, prefs));
  applyDialogFieldPreferences(type, document);
}

function handleDialogCustomizationChange(modal, target) {
  if (!target?.matches("[data-dialog-visible]")) return;

  if (!target.checked && !modal.querySelectorAll("[data-dialog-visible]:checked").length) {
    target.checked = true;
    return;
  }

  const type = modal.dataset.dialogCustomizeType || "bug";
  const prefs = dialogPrefsFromDialog(modal);
  writeJsonPreference(dialogConfig(type).preferenceKey, normalizeDialogFieldPrefs(type, prefs));
  applyDialogFieldPreferences(type, document);
}

function saveDialogCustomization(modal) {
  const type = modal.dataset.dialogCustomizeType || "bug";
  writeJsonPreference(dialogConfig(type).preferenceKey, normalizeDialogFieldPrefs(type, dialogPrefsFromDialog(modal)));
  applyDialogFieldPreferences(type, document);
  modal.close();
}

function resetDialogCustomization(modal) {
  const type = modal.dataset.dialogCustomizeType || "bug";
  removePreference(dialogConfig(type).preferenceKey);
  const prefs = defaultDialogFieldPrefs(type);
  renderDialogCustomizationRows(modal, prefs);
  applyDialogFieldPreferences(type, document);
}

function dialogPrefsFromDialog(modal) {
  const type = modal.dataset.dialogCustomizeType || "bug";
  const order = [...modal.querySelectorAll("[data-dialog-field-row]")]
    .map(row => row.dataset.dialogFieldRow || "")
    .filter(Boolean);
  const visible = [...modal.querySelectorAll("[data-dialog-visible]:checked")]
    .map(input => input.dataset.dialogVisible || "")
    .filter(Boolean);
  const labels = {};

  modal.querySelectorAll("[data-dialog-label]").forEach(input => {
    labels[input.dataset.dialogLabel || ""] = input.value;
  });

  return normalizeDialogFieldPrefs(type, { order, visible, labels });
}

function readDialogFieldPrefs(type) {
  const config = dialogConfig(type);
  return normalizeDialogFieldPrefs(config.type, readJsonPreference(config.preferenceKey, {}));
}

function normalizeDialogFieldPrefs(type, preferences = {}) {
  const saved = preferences && typeof preferences === "object" && !Array.isArray(preferences)
    ? preferences
    : {};
  const allowedKeys = dialogFieldKeySet(type);
  const visible = normalizeStringArray(saved.visible).filter(key => allowedKeys.has(key));
  const labels = {};

  Object.entries(saved.labels || {}).forEach(([key, label]) => {
    if (!allowedKeys.has(key)) return;

    const originalLabel = dialogFieldDefinition(type, key)?.label || key;
    const cleanLabel = String(label || "").trim();
    if (cleanLabel && cleanLabel !== originalLabel) labels[key] = cleanLabel;
  });

  return {
    order: normalizedDialogFieldOrder(type, saved.order),
    visible: visible.length ? visible : dialogDefaultVisibleKeys(type),
    labels
  };
}

function defaultDialogFieldPrefs(type) {
  return {
    order: dialogDefaultOrder(type),
    visible: dialogDefaultVisibleKeys(type),
    labels: {}
  };
}

function normalizedDialogFieldOrder(type, order = []) {
  const allowedKeys = dialogFieldKeySet(type);
  const orderedKeys = normalizeStringArray(order).filter(key => allowedKeys.has(key));

  dialogDefaultOrder(type).forEach(key => {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  });

  return orderedKeys;
}

function dialogDefaultOrder(type) {
  return dialogConfig(type).fields.map(field => field.key);
}

function dialogDefaultVisibleKeys(type) {
  return dialogDefaultOrder(type);
}

function dialogFieldKeySet(type) {
  return new Set(dialogDefaultOrder(type));
}

function dialogConfig(type) {
  return dialogConfigs[type] || dialogConfigs.bug;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(item => String(item || "")).filter(Boolean) : [];
}

function updateDialogFieldLabel(field, label) {
  const labelElement = field.querySelector(":scope > label")
    || field.querySelector(":scope > legend")
    || field.querySelector(":scope > fieldset > legend")
    || field.querySelector(":scope > span");

  if (labelElement) labelElement.textContent = label;
}
