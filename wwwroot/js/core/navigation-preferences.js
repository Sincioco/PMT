import {
  preferenceKeys,
  readJsonPreference,
  writeJsonPreference
} from "./preferences.js";
import { screenRegistry } from "./screen-registry.js?v=20260707-log-about-nav";

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
    .filter(Boolean);
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
    Backlog: "&#9776;",
    Projects: "&#9635;",
    Sprints: "&#8635;",
    Tasks: "&#10003;",
    Bugs: bugIconHtml(),
    Scrum: "&#9719;",
    Log: "&#9776;",
    Documentation: "&#128214;",
    "WFH Schedule": "&#8962;",
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
