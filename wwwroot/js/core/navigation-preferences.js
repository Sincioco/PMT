import {
  preferenceKeys,
  readJsonPreference,
  writeJsonPreference
} from "./preferences.js";
import { screenRegistry } from "./screen-registry.js";

const navigationVersion = 1;
const lockedVisibleViews = new Set(["WFH Schedule", "Settings"]);

function defaultNavigationItems() {
  return screenRegistry
    .filter(screen => screen.showInNavigation)
    .map(screen => ({ view: screen.view, label: screen.label, visible: true }));
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
      visible: isNavigationVisibilityLocked(view) ? true : item?.visible !== false
    });
    seenViews.add(view);
  });

  defaultNavigationItems().forEach(item => {
    if (seenViews.has(item.view)) return;
    if (item.view === "WFH Schedule") {
      const settingsIndex = items.findIndex(entry => entry.view === "Settings");
      if (settingsIndex >= 0) {
        items.splice(settingsIndex, 0, item);
        seenViews.add(item.view);
        return;
      }
    }
    items.push(item);
  });

  return {
    version: navigationVersion,
    items
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
    Bugs: "&#9888;",
    Scrum: "&#9719;",
    Documentation: "&#128196;",
    "WFH Schedule": "&#8962;",
    Settings: "&#9881;"
  };
  return icons[view] || "&#9679;";
}
