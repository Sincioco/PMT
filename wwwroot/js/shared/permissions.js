import {
  currentUser,
  currentUserId
} from "../core/authentication.js";

export function canEditOwner(ownerUserId) {
  return currentUser().isAdmin || ownerUserId === currentUserId;
}

export function canEditTask(task) {
  const user = currentUser();
  if (user.isAdmin || user.role === "Admin") return true;
  if (task?.taskType === "Bug") return user.role === "QA";
  return user.role === "Developer";
}

export function canEditUser(userId) {
  return currentUser().isAdmin || userId === currentUserId;
}
