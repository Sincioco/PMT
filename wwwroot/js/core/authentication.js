import { api } from "./api.js?v=20260715-admin-impersonation";
import {
  activateImpersonationPreferences,
  discardImpersonationPreferenceBackup,
  preferenceKeys,
  prepareImpersonationPreferenceBackup,
  removePreference,
  restoreImpersonationPreferences
} from "./preferences.js?v=20260715-admin-impersonation";
import { resetState, state } from "./store.js";

export let currentUserId = 0;
let session = emptySession();

export async function restoreSession() {
  removePreference(preferenceKeys.authenticatedUser);
  try {
    const result = await api("/api/session");
    applySession(result);
    if (!session.isImpersonating) restoreImpersonationPreferences();
    return true;
  } catch (error) {
    if (error.status !== 401) throw error;
    restoreImpersonationPreferences();
    clearSession();
    return false;
  }
}

export async function login(loginName, password) {
  restoreImpersonationPreferences();
  const result = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password })
  });

  applySession(result);
  return result;
}

export function completeExternalLogin(result) {
  restoreImpersonationPreferences();
  applySession(result);
}

export async function logout() {
  await api("/api/logout", { method: "POST" });
  restoreImpersonationPreferences();
  clearSession();
}

export async function beginImpersonation(userId) {
  const backupPrepared = prepareImpersonationPreferenceBackup();
  try {
    const result = await api("/api/impersonation/start", {
      method: "POST",
      body: JSON.stringify({ userId: Number(userId || 0) })
    });
    activateImpersonationPreferences();
    applySession(result);
    return result;
  } catch (error) {
    if (backupPrepared) discardImpersonationPreferenceBackup();
    throw error;
  }
}

export async function endImpersonation() {
  const result = await api("/api/impersonation/stop", { method: "POST" });
  restoreImpersonationPreferences();
  applySession(result);
  return result;
}

export function isImpersonating() {
  return session.isImpersonating;
}

export function impersonatedUserName() {
  return session.impersonatedUserName;
}

export function ensureCurrentUser() {
  return state.users.some(user => user.id === currentUserId) ? currentUserId : 0;
}

export function currentUser() {
  return state.users.find(user => user.id === currentUserId) || {};
}

function applySession(result = {}) {
  currentUserId = Number(result.userId || 0);
  session = {
    originalUserId: Number(result.originalUserId || currentUserId || 0),
    originalUserName: String(result.originalUserName || ""),
    isImpersonating: Boolean(result.isImpersonating),
    impersonatedUserName: String(result.impersonatedUserName || "")
  };
}

function clearSession() {
  currentUserId = 0;
  session = emptySession();
  resetState();
}

function emptySession() {
  return {
    originalUserId: 0,
    originalUserName: "",
    isImpersonating: false,
    impersonatedUserName: ""
  };
}
