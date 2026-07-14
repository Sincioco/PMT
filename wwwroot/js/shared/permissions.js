import {
  currentUser,
  currentUserId
} from "../core/authentication.js";
import { canAccessResource } from "./security.js?v=20260713-role-security";

export function canEditOwner(ownerUserId, resourceKey = "") {
  if (currentUser().isAdmin) return true;
  if (Number(ownerUserId || 0) !== Number(currentUserId || 0)) return false;
  return !resourceKey || canAccessResource(resourceKey, "Update");
}

export function canDeleteOwner(ownerUserId, resourceKey = "") {
  if (currentUser().isAdmin) return true;
  if (Number(ownerUserId || 0) !== Number(currentUserId || 0)) return false;
  return !resourceKey || canAccessResource(resourceKey, "Delete");
}

export function canEditTask(task) {
  if (currentUser().isAdmin) return true;
  return canAccessResource(task?.taskType === "Bug" ? "BugTracking" : "DevTasks", "Update");
}

export function canEditUser(userId) {
  return currentUser().isAdmin || (userId === currentUserId && canAccessResource("Settings", "Update"));
}
