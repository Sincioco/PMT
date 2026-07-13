import {
  currentUser,
  currentUserId
} from "../core/authentication.js";
import { canAccessResource } from "./security.js?v=20260713-role-security";

export function canEditOwner(ownerUserId, resourceKey = "") {
  if (currentUser().isAdmin) return true;
  if (resourceKey) return canAccessResource(resourceKey, "Update");
  return ownerUserId === currentUserId;
}

export function canEditTask(task) {
  if (currentUser().isAdmin) return true;
  return canAccessResource(task?.taskType === "Bug" ? "BugTracking" : "DevTasks", "Update");
}

export function canEditUser(userId) {
  return currentUser().isAdmin || (userId === currentUserId && canAccessResource("Settings", "Update"));
}
