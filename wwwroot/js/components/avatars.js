import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

let avatarStackResizeBound = false;

export function avatarsHtml(users, options = {}) {
  const className = ["avatar-stack", options.fit === "auto" ? "avatar-stack-auto-fit" : "", options.className || ""]
    .filter(Boolean)
    .join(" ");
  const fitAttr = options.fit === "auto" ? ` data-avatar-fit="auto"` : "";
  return `<div class="${escapeAttr(className)}"${fitAttr}>${(users || []).map(user => `<img class="avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" title="${escapeAttr(user.nickname)}" alt="">`).join("")}</div>`;
}

export function syncAvatarStackFit(root = document) {
  if (!avatarStackResizeBound) {
    avatarStackResizeBound = true;
    window.addEventListener("resize", () => syncAvatarStackFit(document));
  }

  requestAnimationFrame(() => {
    root.querySelectorAll?.('[data-avatar-fit="auto"]').forEach(stack => {
      stack.classList.remove("is-overlapping");
      if (stack.querySelectorAll(".avatar").length < 2) return;

      stack.classList.toggle("is-overlapping", stack.scrollWidth > stack.clientWidth + 1);
    });
  });
}

export function taskRowAvatarsHtml(users) {
  if (!users || !users.length) return "";

  return `
    <div class="row-avatar-stack">
      ${users.map(user => `<img class="row-avatar" src="${escapeAttr(user.avatarUrl || "/assets/avatar-default.svg")}" title="${escapeAttr(user.nickname)}" alt="">`).join("")}
    </div>
  `;
}
