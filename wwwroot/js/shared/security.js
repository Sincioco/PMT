import { currentUser } from "../core/authentication.js?v=20260715-admin-impersonation";
import { state } from "../core/store.js";

const resourceByView = Object.freeze({
  Dashboard: "Dashboard",
  "Road Map": "RoadMap",
  Gantt: "Gantt",
  Projects: "Projects",
  Sprints: "Sprints",
  Board: "Board",
  Tasks: "DevTasks",
  Bugs: "BugTracking",
  Scrum: "Scrum",
  Documentation: "Documentation",
  Log: "PersonalLog",
  Backlog: "Backlog",
  "WFH Schedule": "WfhSchedule",
  Settings: "Settings"
});

const rightProperty = Object.freeze({
  Read: "canRead",
  Create: "canCreate",
  Update: "canUpdate",
  Delete: "canDelete",
  Import: "canImport",
  Export: "canExport"
});

export function resourceForView(view) {
  return resourceByView[view] || "";
}

export function canAccessResource(resourceKey, right = "Read") {
  if (currentUser().isAdmin) return true;

  // Navigation renders once before the signed-in user's state finishes loading.
  // Keep that first render neutral, then enforce the returned effective rights.
  if (!Array.isArray(state.effectivePermissions) || state.effectivePermissions.length === 0) return true;

  const permission = state.effectivePermissions.find(item => item.resourceKey === resourceKey);
  if (!permission || permission.noAccess) return false;
  return Boolean(permission[rightProperty[right] || "canRead"]);
}

export function canReadView(view) {
  if (view === "About") return true;
  const resourceKey = resourceForView(view);
  return !resourceKey || canAccessResource(resourceKey, "Read");
}

export function firstReadableView(screens = []) {
  return screens.find(screen => canReadView(screen.view))?.view || "About";
}

export function applyActionPermissions(root, view) {
  const resourceKey = resourceForView(view);
  if (!root || !resourceKey || currentUser().isAdmin) return;

  root.querySelectorAll("button[data-action]").forEach(button => {
    const right = rightForAction(button.dataset.action || "");
    const actionResourceKey = button.dataset.securityResource || resourceKey;
    if (!right || canAccessResource(actionResourceKey, right)) return;

    button.disabled = true;
    button.classList.add("security-disabled-action");
    button.title = `You do not have ${right.toLowerCase()} permission for this area.`;
  });
}

function rightForAction(action) {
  const normalized = action.toLowerCase();
  if (normalized.includes("import")) return "Import";
  if (normalized.includes("export")) return "Export";
  if (normalized.startsWith("delete-") || normalized.includes("-delete")) return "Delete";
  if (normalized.startsWith("new-") || normalized.includes("duplicate")) return "Create";
  if (normalized.startsWith("edit-")) return "Update";
  if (normalized === "finish-sprint" || normalized === "reset-wfh-schedule" || normalized === "restore-wfh-user" || normalized === "toggle-wfh-day") return "Update";
  return "";
}
