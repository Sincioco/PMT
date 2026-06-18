import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

export function avatarsHtml(users) {
  return `<div class="avatar-stack">${(users || []).map(user => `<img class="avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" title="${escapeAttr(user.nickname)}" alt="">`).join("")}</div>`;
}

export function taskRowAvatarsHtml(users) {
  if (!users || !users.length) return `<span class="muted">Unassigned</span>`;

  return `
    <div class="row-avatar-stack">
      ${users.map(user => `<img class="row-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" title="${escapeAttr(user.nickname)}" alt="">`).join("")}
    </div>
  `;
}
