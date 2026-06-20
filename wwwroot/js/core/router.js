import { preferenceKeys, readPreference, writePreference } from "./preferences.js";
import { visibleNavigationScreens } from "./navigation-preferences.js";
import { screenRegistry } from "./screen-registry.js";

const legacyViews = Object.freeze({
  "Dev Log": "Scrum",
  "Dev Logs": "Scrum",
  Blogs: "Documentation",
  Lookups: "Settings",
  Users: "Settings",
  Holidays: "Settings"
});

export const savedViewPreference = readPreference(preferenceKeys.view, "Dashboard");
export let currentView = normalizeView(savedViewPreference);

export function getNavigationScreens() {
  return visibleNavigationScreens();
}

export function normalizeView(view) {
  const normalized = legacyViews[view] || view || "Dashboard";
  return screenRegistry.some(screen => screen.view === normalized) ? normalized : "Dashboard";
}

export function navigate(view) {
  currentView = normalizeView(view);
  writePreference(preferenceKeys.view, currentView);
  return currentView;
}
