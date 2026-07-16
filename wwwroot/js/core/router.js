import { preferenceKeys, readPreference, writePreference } from "./preferences.js";
import { visibleNavigationScreens } from "./navigation-preferences.js?v=release-notes-2026-07-16-day-29-9965d111882d";
import { screenRegistry } from "./screen-registry.js?v=release-notes-2026-07-16-day-29-9965d111882d";
import { canReadView, firstReadableView } from "../shared/security.js?v=20260715-admin-impersonation";

const legacyViews = Object.freeze({
  "Dev Log": "Scrum",
  "Dev Logs": "Scrum",
  Blogs: "Documentation",
  Lookups: "Settings",
  Users: "Settings",
  Holidays: "Settings"
});

const viewRoutes = Object.freeze(Object.fromEntries(screenRegistry.map(screen => [
  screen.view,
  screen.feature || slugForView(screen.view)
])));

const routeViews = Object.freeze(Object.fromEntries(Object.entries(viewRoutes).map(([view, route]) => [route, view])));

const contentRoutes = Object.freeze({
  task: { route: "tasks", view: "Tasks" },
  tasks: { route: "tasks", view: "Tasks" },
  bug: { route: "bugs", view: "Bugs" },
  bugs: { route: "bugs", view: "Bugs" },
  backlog: { route: "backlog", view: "Backlog" },
  documentation: { route: "documentation", view: "Documentation" },
  document: { route: "documentation", view: "Documentation" },
  docs: { route: "documentation", view: "Documentation" },
  log: { route: "log", view: "Log" },
  logs: { route: "log", view: "Log" },
  scrum: { route: "scrum", view: "Scrum" }
});

const settingsCategoryRoutes = Object.freeze({
  LogCategory: "log-categories",
  Role: "roles"
});

export const savedViewPreference = readPreference(preferenceKeys.view, "Dashboard");
const initialRoute = parseRouteFromLocation();
export let currentView = normalizeView(initialRoute.view || savedViewPreference);

export function getNavigationScreens() {
  return visibleNavigationScreens();
}

export function normalizeView(view) {
  const normalized = legacyViews[view] || view || "Dashboard";
  return screenRegistry.some(screen => screen.view === normalized) ? normalized : "Dashboard";
}

export function navigate(view, options = {}) {
  const requestedView = normalizeView(view);
  currentView = canReadView(requestedView) ? requestedView : firstReadableView(screenRegistry);
  writePreference(preferenceKeys.view, currentView);
  if (options.updateUrl !== false) updateBrowserUrl(routeForView(currentView), options);
  return currentView;
}

export function routeForView(view) {
  const normalizedView = normalizeView(view);
  return `#/${viewRoutes[normalizedView] || slugForView(normalizedView)}`;
}

export function routeForSettingsCategory(category) {
  const categoryName = String(category || "").trim();
  if (!categoryName) return routeForView("Settings");

  const categoryRoute = settingsCategoryRoutes[categoryName]
    || slugForView(categoryName.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
  return categoryRoute ? `${routeForView("Settings")}/${categoryRoute}` : routeForView("Settings");
}

export function routeForContent(type, id) {
  const normalizedType = contentRoutes[String(type || "").toLowerCase()]?.route;
  const normalizedId = routeId(id);
  return normalizedType && normalizedId ? `#/${normalizedType}/${normalizedId}` : routeForView(currentView);
}

export function parseRouteFromLocation() {
  const path = String(window.location.hash || "")
    .replace(/^#\/?/, "")
    .split("?")[0]
    .split("/")
    .map(segment => decodeRouteSegment(segment).trim().toLowerCase())
    .filter(Boolean);

  if (!path.length) return {};

  const firstSegment = path[0];
  const contentRoute = contentRoutes[firstSegment];
  if (contentRoute) {
    return {
      view: normalizeView(contentRoute.view),
      contentType: contentRoute.route,
      id: routeId(path[1])
    };
  }

  if (firstSegment === viewRoutes.Settings) {
    return {
      view: "Settings",
      settingsCategory: path[1] || ""
    };
  }

  return {
    view: normalizeView(routeViews[firstSegment] || viewFromSlug(firstSegment))
  };
}

export function updateBrowserUrl(route, options = {}) {
  if (!route || window.location.hash === route) return;
  const method = options.replace ? "replaceState" : "pushState";
  window.history[method]({}, "", route);
}

export function ensureCurrentViewRoute() {
  if (window.location.hash) return;
  updateBrowserUrl(routeForView(currentView), { replace: true });
}

function slugForView(view) {
  return String(view || "Dashboard")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dashboard";
}

function viewFromSlug(slug) {
  const normalizedSlug = slugForView(slug);
  return screenRegistry.find(screen => slugForView(screen.view) === normalizedSlug)?.view || "Dashboard";
}

function decodeRouteSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function routeId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}
