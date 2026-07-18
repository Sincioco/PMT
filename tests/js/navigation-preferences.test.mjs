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
  },
  key(index) {
    return [...storage.keys()][index] || null;
  },
  get length() {
    return storage.size;
  }
};

const {
  normalizeNavigationConfig,
  readNavigationConfig,
  visibleNavigationScreens,
  writeNavigationConfig
} = await import("../../wwwroot/js/core/navigation-preferences.js");

test("navigation config keeps known screens, removes duplicates, and keeps Settings visible", () => {
  const config = normalizeNavigationConfig({
    items: [
      { view: "Bugs", visible: false },
      { view: "Unknown", visible: true },
      { view: "Settings", label: "Options", visible: false },
      { view: "Bugs", visible: true }
    ]
  });

  assert.equal(config.items[0].view, "Bugs");
  assert.equal(config.items[0].visible, false);
  assert.equal(config.items.find(item => item.view === "Settings").label, "Options");
  assert.equal(config.items.find(item => item.view === "Settings").visible, true);
  assert.equal(config.items.filter(item => item.view === "Bugs").length, 1);
  assert.equal(config.items.some(item => item.view === "Unknown"), false);
});

test("visible navigation screens follow saved order and hidden items", () => {
  storage.clear();
  writeNavigationConfig({
    items: [
      { view: "Tasks", label: "Work", visible: true },
      { view: "Backlog", visible: false },
      { view: "Settings", visible: true }
    ]
  });

  assert.equal(readNavigationConfig().items[0].view, "Tasks");
  assert.equal(visibleNavigationScreens()[0].view, "Tasks");
  assert.equal(visibleNavigationScreens()[0].label, "Work");
  assert.equal(visibleNavigationScreens().some(screen => screen.view === "Backlog"), false);
  assert.equal(visibleNavigationScreens().some(screen => screen.view === "Settings"), true);
});

test("new navigation configurations place Diagram immediately before Release Notes", () => {
  storage.clear();
  const config = readNavigationConfig();
  const diagramIndex = config.items.findIndex(item => item.view === "Diagram");
  const releaseNotesIndex = config.items.findIndex(item => item.view === "Release Notes");
  const aboutIndex = config.items.findIndex(item => item.view === "About");

  assert.equal(config.items[diagramIndex].visible, true);
  assert.equal(config.items[releaseNotesIndex].visible, true);
  assert.equal(diagramIndex + 1, releaseNotesIndex);
  assert.equal(releaseNotesIndex + 1, aboutIndex);
});

test("existing navigation configurations receive Diagram before Release Notes", () => {
  const config = normalizeNavigationConfig({
    version: 2,
    items: [
      { view: "Tasks", visible: true },
      { view: "Release Notes", visible: true },
      { view: "About", visible: true },
      { view: "Settings", visible: true }
    ]
  });
  const diagramIndex = config.items.findIndex(item => item.view === "Diagram");
  const releaseNotesIndex = config.items.findIndex(item => item.view === "Release Notes");

  assert.equal(diagramIndex + 1, releaseNotesIndex);
});
