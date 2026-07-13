import { api } from "./api.js";

function createEmptyState() {
  return {
    users: [],
    projects: [],
    sprints: [],
    tasks: [],
    devLogs: [],
    blogs: [],
    auditEvents: [],
    lookups: [],
    roles: [],
    holidays: []
  };
}

export let state = createEmptyState();

export function replaceState(nextState) {
  state = nextState || createEmptyState();
  return state;
}

export async function loadState() {
  return replaceState(await api("/api/state"));
}

export function resetState() {
  return replaceState(createEmptyState());
}
