import {
  preferenceKeys,
  readJsonPreference,
  writeJsonPreference
} from "./preferences.js";
import { screenRegistry } from "./screen-registry.js?v=release-notes-2026-07-17-day-30-35c4aa65c202";
import { canReadView } from "../shared/security.js?v=20260715-admin-impersonation";

const navigationVersion = 2;
const betaNavigationViews = new Set(["Dashboard", "Road Map", "Gantt"]);
const lockedVisibleViews = new Set(["About", "Settings"]);

function defaultNavigationItems() {
  return screenRegistry
    .filter(screen => screen.showInNavigation)
    .map(screen => ({ view: screen.view, label: screen.label, visible: defaultNavigationVisible(screen) }));
}

function navigationScreenMap() {
  return new Map(
    screenRegistry
      .filter(screen => screen.showInNavigation)
      .map(screen => [screen.view, screen])
  );
}

export function isNavigationVisibilityLocked(view) {
  return lockedVisibleViews.has(view);
}

export function normalizeNavigationConfig(value = {}) {
  const screensByView = navigationScreenMap();
  const savedVersion = Array.isArray(value) ? 0 : Number(value?.version || 0);
  const savedItems = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : [];

  const items = [];
  const seenViews = new Set();

  savedItems.forEach(item => {
    const view = typeof item === "string" ? item : item?.view;
    if (!screensByView.has(view) || seenViews.has(view)) return;

    items.push({
      view,
      label: navigationLabelFor(item, screensByView.get(view)),
      visible: navigationVisibleFor(item, screensByView.get(view), savedVersion)
    });
    seenViews.add(view);
  });

  defaultNavigationItems().forEach(item => {
    if (seenViews.has(item.view)) return;
    items.push(item);
  });

  return {
    version: navigationVersion,
    items: enforceFixedNavigationOrder(items)
  };
}

export function readNavigationConfig() {
  return normalizeNavigationConfig(
    readJsonPreference(preferenceKeys.navigation, { version: navigationVersion, items: defaultNavigationItems() })
  );
}

export function writeNavigationConfig(config) {
  writeJsonPreference(preferenceKeys.navigation, normalizeNavigationConfig(config));
}

export function resetNavigationConfig() {
  writeNavigationConfig({ version: navigationVersion, items: defaultNavigationItems() });
}

export function navigationSettingsItems() {
  const screensByView = navigationScreenMap();
  return readNavigationConfig().items
    .map(item => {
      const screen = screensByView.get(item.view);
      if (!screen) return null;
      return {
        ...screen,
        defaultLabel: screen.label,
        label: item.label,
        visible: item.visible,
        beta: Boolean(screen.beta),
        icon: navIconHtml(item.view),
        visibilityLocked: isNavigationVisibilityLocked(item.view)
      };
    })
    .filter(Boolean);
}

export function visibleNavigationScreens() {
  const screensByView = navigationScreenMap();
  return readNavigationConfig().items
    .filter(item => item.visible)
    .map(item => {
      const screen = screensByView.get(item.view);
      return screen ? { ...screen, label: item.label } : null;
    })
    .filter(screen => screen && canReadView(screen.view));
}

function navigationLabelFor(item, screen) {
  const label = typeof item?.label === "string" ? item.label.trim() : "";
  return label || screen?.label || item?.view || "";
}

function navigationVisibleFor(item, screen, savedVersion) {
  if (!screen) return false;
  if (isNavigationVisibilityLocked(screen.view)) return true;
  if (savedVersion < navigationVersion && betaNavigationViews.has(screen.view)) return false;
  if (typeof item?.visible === "boolean") return item.visible;
  return defaultNavigationVisible(screen);
}

function defaultNavigationVisible(screen) {
  if (!screen) return false;
  if (isNavigationVisibilityLocked(screen.view)) return true;
  return screen.defaultVisible !== false;
}

function enforceFixedNavigationOrder(items) {
  const boardItem = items.find(item => item.view === "Board");
  const logItem = items.find(item => item.view === "Log");
  const aboutItem = items.find(item => item.view === "About");
  const settingsItem = items.find(item => item.view === "Settings");
  const orderedItems = items.filter(item =>
    item.view !== "Board"
    && item.view !== "Log"
    && item.view !== "About"
    && item.view !== "Settings");

  if (boardItem) {
    const sprintIndex = orderedItems.findIndex(item => item.view === "Sprints");
    orderedItems.splice(sprintIndex >= 0 ? sprintIndex + 1 : orderedItems.length, 0, boardItem);
  }

  if (logItem) {
    const documentationIndex = orderedItems.findIndex(item => item.view === "Documentation");
    orderedItems.splice(documentationIndex >= 0 ? documentationIndex + 1 : orderedItems.length, 0, logItem);
  }

  if (aboutItem) orderedItems.push(aboutItem);
  if (settingsItem) orderedItems.push(settingsItem);
  return orderedItems;
}

export function navIconHtml(view) {
  const icons = {
    Dashboard: "&#9636;",
    Board: "&#9638;",
    "Road Map": "&#8644;",
    Gantt: "&#8942;",
    Backlog: filingCabinetIconHtml(),
    Projects: "&#9635;",
    Sprints: runningShoeIconHtml(),
    Tasks: "&#10003;",
    Bugs: bugIconHtml(),
    Scrum: "&#9719;",
    Log: logWritingIconHtml(),
    Documentation: "&#128214;",
    "WFH Schedule": "&#8962;",
    "Release Notes": "&#128227;",
    About: "&#9432;",
    Settings: "&#9881;"
  };
  return icons[view] || "&#9679;";
}

function bugIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 9h8M7 13H4M20 13h-3M8 17H5M19 17h-3M9 5l-2-2M15 5l2-2M8 7h8v10a4 4 0 0 1-8 0V7z"></path>
    </svg>
  `;
}

function logWritingIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4h9l3 3v13H5z"></path>
      <path d="M14 4v4h4"></path>
      <path d="M8 10h5"></path>
      <path d="M8 14h3"></path>
      <path d="m12 18 5.5-5.5 2 2L14 20l-2.5.5z"></path>
    </svg>
  `;
}

function filingCabinetIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4h14v16H5z"></path>
      <path d="M5 10h14"></path>
      <path d="M5 15h14"></path>
      <path d="M9 7h6"></path>
      <path d="M10 13h4"></path>
      <path d="M10 18h4"></path>
    </svg>
  `;
}

function runningShoeIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 15c3.5.2 5.9-.8 7.1-3l1.1-2 3.3 2.4c1.5 1.1 3 1.7 4.5 1.8v2.4c0 1.3-1.1 2.4-2.4 2.4H7.2C5.4 19 4 17.6 4 15.8z"></path>
      <path d="M11.2 12.2 7.8 9.6"></path>
      <path d="M13.2 9.6 15 6"></path>
      <path d="M15 12.1 17.4 9"></path>
      <path d="M5 16h15"></path>
    </svg>
  `;
}
