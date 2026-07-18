import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

const historyCalls = [];
globalThis.window = {
  location: { hash: "#/settings/security" },
  history: {
    pushState(_state, _title, route) {
      historyCalls.push(["pushState", route]);
      window.location.hash = route;
    },
    replaceState(_state, _title, route) {
      historyCalls.push(["replaceState", route]);
      window.location.hash = route;
    }
  }
};

const {
  currentView,
  parseRouteFromLocation,
  routeForContent,
  routeForSettingsCategory,
  routeForView,
  updateBrowserUrl
} = await import("../../wwwroot/js/core/router.js");
const { screenRegistry } = await import("../../wwwroot/js/core/screen-registry.js");

test("every registered navigation screen has a stable hash route", () => {
  const routes = screenRegistry.map(screen => routeForView(screen.view));

  assert.equal(new Set(routes).size, screenRegistry.length);
  assert.equal(routeForView("Tasks"), "#/tasks");
  assert.equal(routeForView("Diagram"), "#/diagram");
  assert.equal(routeForView("Release Notes"), "#/release-notes");
  assert.equal(routeForView("Settings"), "#/settings");
  assert.equal(routeForContent("tasks", 123), "#/tasks/123");

  screenRegistry.forEach(screen => {
    window.location.hash = routeForView(screen.view);
    assert.equal(parseRouteFromLocation().view, screen.view);
  });
});

test("Settings category routes parse without changing legacy screen routes", () => {
  window.location.hash = "#/settings/security";
  assert.equal(currentView, "Settings");
  assert.deepEqual(parseRouteFromLocation(), {
    view: "Settings",
    settingsCategory: "security"
  });
  assert.equal(routeForSettingsCategory("Security"), "#/settings/security");
  assert.equal(routeForSettingsCategory("Audit Trail"), "#/settings/audit-trail");
  assert.equal(routeForSettingsCategory("LogCategory"), "#/settings/log-categories");
  assert.equal(routeForSettingsCategory("Role"), "#/settings/roles");
  assert.equal(routeForSettingsCategory("Release Type"), "#/settings/release-type");

  window.location.hash = "#/settings";
  assert.deepEqual(parseRouteFromLocation(), {
    view: "Settings",
    settingsCategory: ""
  });

  window.location.hash = "#/tasks/123";
  assert.deepEqual(parseRouteFromLocation(), {
    view: "Tasks",
    contentType: "tasks",
    id: 123
  });
});

test("category routes use normal browser history updates", () => {
  historyCalls.length = 0;
  window.location.hash = "#/settings/users";
  updateBrowserUrl(routeForSettingsCategory("Navigation"));
  updateBrowserUrl(routeForSettingsCategory("Security"), { replace: true });

  assert.deepEqual(historyCalls, [
    ["pushState", "#/settings/navigation"],
    ["replaceState", "#/settings/security"]
  ]);
});
