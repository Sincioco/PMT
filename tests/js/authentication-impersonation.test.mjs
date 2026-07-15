import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  #values = new Map();

  get length() {
    return this.#values.size;
  }

  clear() {
    this.#values.clear();
  }

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  key(index) {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key) {
    this.#values.delete(key);
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();

const requests = [];
let fetchHandler = async () => jsonResponse({ error: "Unexpected request" }, 500);
globalThis.fetch = async (path, options = {}) => {
  requests.push({ path, options });
  return fetchHandler(path, options);
};

const preferences = await import("../../wwwroot/js/core/preferences.js?v=20260715-admin-impersonation");
const authentication = await import("../../wwwroot/js/core/authentication.js?test=cookie-session");
const backupKey = "pmt-impersonation-admin-preferences";

test("impersonation preference backup isolates temporary user changes and restores the administrator", () => {
  localStorage.clear();
  localStorage.setItem("unrelated-key", "keep");
  localStorage.setItem(preferences.preferenceKeys.authenticatedUser, "legacy-user");
  localStorage.setItem(preferences.preferenceKeys.theme, "dark");
  localStorage.setItem(preferences.preferenceKeys.taskProject, "10");

  assert.equal(preferences.prepareImpersonationPreferenceBackup(), true);
  const backup = JSON.parse(localStorage.getItem(backupKey));
  assert.deepEqual(backup, {
    [preferences.preferenceKeys.theme]: "dark",
    [preferences.preferenceKeys.taskProject]: "10"
  });

  preferences.activateImpersonationPreferences();
  assert.equal(localStorage.getItem(preferences.preferenceKeys.authenticatedUser), null);
  assert.equal(localStorage.getItem(preferences.preferenceKeys.theme), null);
  assert.equal(localStorage.getItem(preferences.preferenceKeys.taskProject), null);
  assert.equal(localStorage.getItem("unrelated-key"), "keep");
  assert.notEqual(localStorage.getItem(backupKey), null);

  localStorage.setItem(preferences.preferenceKeys.theme, "light");
  localStorage.setItem(preferences.preferenceKeys.taskProject, "999");
  localStorage.setItem(preferences.preferenceKeys.bugFilters, JSON.stringify({ projectId: "999" }));

  assert.equal(preferences.restoreImpersonationPreferences(), true);
  assert.equal(localStorage.getItem(preferences.preferenceKeys.theme), "dark");
  assert.equal(localStorage.getItem(preferences.preferenceKeys.taskProject), "10");
  assert.equal(localStorage.getItem(preferences.preferenceKeys.bugFilters), null);
  assert.equal(localStorage.getItem(backupKey), null);
  assert.equal(localStorage.getItem("unrelated-key"), "keep");
});

test("cookie session authentication never sends the removed local user identity header", async () => {
  localStorage.clear();
  requests.length = 0;
  localStorage.setItem(preferences.preferenceKeys.authenticatedUser, "99");
  localStorage.setItem(preferences.preferenceKeys.theme, "dark");
  localStorage.setItem(preferences.preferenceKeys.taskProject, "10");

  fetchHandler = async path => {
    if (path === "/api/session") return jsonResponse(sessionPayload(1, "Sin"));
    if (path === "/api/impersonation/start") {
      return jsonResponse(sessionPayload(2, "QA", {
        originalUserId: 1,
        originalUserName: "Sin",
        isImpersonating: true
      }));
    }
    if (path === "/api/impersonation/stop") return jsonResponse(sessionPayload(1, "Sin"));
    if (path === "/api/logout") return jsonResponse({ loggedOut: true, auditRecorded: true });
    return jsonResponse({ error: "Unexpected request" }, 500);
  };

  assert.equal(await authentication.restoreSession(), true);
  assert.equal(authentication.currentUserId, 1);
  assert.equal(authentication.isImpersonating(), false);
  assert.equal(localStorage.getItem(preferences.preferenceKeys.authenticatedUser), null);

  await authentication.beginImpersonation(2);
  assert.equal(authentication.currentUserId, 2);
  assert.equal(authentication.isImpersonating(), true);
  assert.equal(authentication.impersonatedUserName(), "QA");
  assert.equal(localStorage.getItem(preferences.preferenceKeys.theme), null);
  assert.equal(localStorage.getItem(preferences.preferenceKeys.taskProject), null);
  assert.notEqual(localStorage.getItem(backupKey), null);

  localStorage.setItem(preferences.preferenceKeys.theme, "light");
  localStorage.setItem(preferences.preferenceKeys.taskProject, "999");
  await authentication.endImpersonation();
  assert.equal(authentication.currentUserId, 1);
  assert.equal(authentication.isImpersonating(), false);
  assert.equal(localStorage.getItem(preferences.preferenceKeys.theme), "dark");
  assert.equal(localStorage.getItem(preferences.preferenceKeys.taskProject), "10");
  assert.equal(localStorage.getItem(backupKey), null);

  await authentication.logout();
  assert.equal(authentication.currentUserId, 0);

  assert.deepEqual(requests.map(request => request.path), [
    "/api/session",
    "/api/impersonation/start",
    "/api/impersonation/stop",
    "/api/logout"
  ]);
  assert.deepEqual(JSON.parse(requests[1].options.body), { userId: 2 });
  requests.forEach(request => {
    const headerNames = Object.keys(request.options.headers || {}).map(name => name.toLowerCase());
    assert.equal(headerNames.includes("x-pmt-userid"), false);
  });
});

test("a rejected impersonation start leaves administrator preferences unchanged", async () => {
  localStorage.clear();
  localStorage.setItem(preferences.preferenceKeys.theme, "dark");
  fetchHandler = async () => jsonResponse({ error: "Only administrators can impersonate another user." }, 400);

  await assert.rejects(
    authentication.beginImpersonation(2),
    /Only administrators can impersonate another user\./
  );

  assert.equal(localStorage.getItem(preferences.preferenceKeys.theme), "dark");
  assert.equal(localStorage.getItem(backupKey), null);
});

function sessionPayload(userId, nickname, overrides = {}) {
  return {
    userId,
    nickname,
    isAdmin: userId === 1,
    role: userId === 1 ? "Admin" : "QA",
    originalUserId: userId,
    originalUserName: nickname,
    isImpersonating: false,
    impersonatedUserName: overrides.isImpersonating ? nickname : "",
    ...overrides
  };
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Request failed",
    async json() {
      return data;
    }
  };
}
