import test from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};

const { replaceState } = await import("../../wwwroot/js/core/store.js");
const { setCurrentUserId } = await import("../../wwwroot/js/core/authentication.js");
const { canEditOwner, canEditTask, canEditUser } = await import("../../wwwroot/js/shared/permissions.js");

function setUser(user) {
  replaceState({ users: [user], projects: [], sprints: [], tasks: [], devLogs: [], blogs: [], auditEvents: [], lookups: [], holidays: [] });
  setCurrentUserId(user.id);
}

test("admins can edit owners, users, Dev Tasks, and Bugs", () => {
  setUser({ id: 1, isAdmin: true, role: "Developer" });

  assert.equal(canEditOwner(99), true);
  assert.equal(canEditUser(99), true);
  assert.equal(canEditTask({ taskType: "Dev" }), true);
  assert.equal(canEditTask({ taskType: "Bug" }), true);
});

test("developers edit Dev Tasks but not Bugs", () => {
  setUser({ id: 2, isAdmin: false, role: "Developer" });

  assert.equal(canEditOwner(2), true);
  assert.equal(canEditOwner(1), false);
  assert.equal(canEditUser(2), true);
  assert.equal(canEditUser(1), false);
  assert.equal(canEditTask({ taskType: "Dev" }), true);
  assert.equal(canEditTask({ taskType: "Bug" }), false);
});

test("QA users edit Bugs but not Dev Tasks", () => {
  setUser({ id: 3, isAdmin: false, role: "QA" });

  assert.equal(canEditTask({ taskType: "Bug" }), true);
  assert.equal(canEditTask({ taskType: "Dev" }), false);
});
