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
const { canDeleteOwner, canEditOwner, canEditTask, canEditUser } = await import("../../wwwroot/js/shared/permissions.js");
const { canAccessResource } = await import("../../wwwroot/js/shared/security.js");

function setUser(user, effectivePermissions = []) {
  replaceState({ users: [user], projects: [], sprints: [], tasks: [], devLogs: [], blogs: [], auditEvents: [], lookups: [], holidays: [], effectivePermissions });
  setCurrentUserId(user.id);
}

function permission(resourceKey, rights = {}) {
  return {
    resourceKey,
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canImport: false,
    canExport: false,
    noAccess: false,
    ...rights
  };
}

test("admins can edit owners, users, Dev Tasks, and Bugs", () => {
  setUser({ id: 1, isAdmin: true, role: "Developer" });

  assert.equal(canEditOwner(99), true);
  assert.equal(canDeleteOwner(99, "Scrum"), true);
  assert.equal(canEditUser(99), true);
  assert.equal(canEditTask({ taskType: "Dev" }), true);
  assert.equal(canEditTask({ taskType: "Bug" }), true);
});

test("developers edit Dev Tasks but not Bugs", () => {
  setUser({ id: 2, isAdmin: false, role: "Developer" }, [
    permission("DevTasks", { canUpdate: true }),
    permission("BugTracking"),
    permission("Settings", { canUpdate: true })
  ]);

  assert.equal(canEditOwner(2), true);
  assert.equal(canEditOwner(1), false);
  assert.equal(canEditUser(2), true);
  assert.equal(canEditUser(1), false);
  assert.equal(canEditTask({ taskType: "Dev" }), true);
  assert.equal(canEditTask({ taskType: "Bug" }), false);
});

test("QA users edit Bugs but not Dev Tasks", () => {
  setUser({ id: 3, isAdmin: false, role: "QA" }, [
    permission("BugTracking", { canUpdate: true }),
    permission("DevTasks")
  ]);

  assert.equal(canEditTask({ taskType: "Bug" }), true);
  assert.equal(canEditTask({ taskType: "Dev" }), false);
});

test("Scrum ownership and matching rights are both required", () => {
  setUser({ id: 3, isAdmin: false, role: "QA" }, [
    permission("Scrum", { canUpdate: true })
  ]);

  assert.equal(canEditOwner(3, "Scrum"), true);
  assert.equal(canEditOwner(1, "Scrum"), false);
  assert.equal(canDeleteOwner(3, "Scrum"), false);

  setUser({ id: 3, isAdmin: false, role: "QA" }, [
    permission("Scrum", { canUpdate: true, canDelete: true })
  ]);

  assert.equal(canDeleteOwner(3, "Scrum"), true);
  assert.equal(canDeleteOwner(1, "Scrum"), false);
});

test("No Access denies every effective right", () => {
  setUser({ id: 4, isAdmin: false, role: "Developer" }, [
    permission("BugTracking", { canRead: true, canCreate: true, canUpdate: true, noAccess: true })
  ]);

  assert.equal(canAccessResource("BugTracking", "Read"), false);
  assert.equal(canAccessResource("BugTracking", "Create"), false);
  assert.equal(canEditTask({ taskType: "Bug" }), false);
});
