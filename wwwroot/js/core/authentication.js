import { api, setCurrentUserIdProvider } from "./api.js";
import {
  preferenceKeys,
  readNumberPreference,
  removePreference,
  writePreference
} from "./preferences.js";
import { resetState, state } from "./store.js";

export let currentUserId = readNumberPreference(preferenceKeys.authenticatedUser, 0);

setCurrentUserIdProvider(() => currentUserId);

export async function login(loginName, password) {
  const result = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password })
  });

  setCurrentUserId(result.userId, true);
  return result;
}

export function logout() {
  removePreference(preferenceKeys.authenticatedUser);
  currentUserId = 0;
  resetState();
}

export function setCurrentUserId(userId, persist = false) {
  currentUserId = Number(userId || 0);
  if (persist && currentUserId) {
    writePreference(preferenceKeys.authenticatedUser, currentUserId);
  }
}

export function ensureCurrentUser() {
  if (!state.users.some(user => user.id === currentUserId) && state.users.length) {
    setCurrentUserId(state.users[0].id, true);
  }
  return currentUserId;
}

export function currentUser() {
  return state.users.find(user => user.id === currentUserId) || state.users[0] || {};
}
