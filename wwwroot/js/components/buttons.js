import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

export function buttonContent(icon, label) {
  return `<span class="button-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(label)}</span>`;
}

export function funnelIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 5h16l-6.5 7.5V18l-3 1.5v-7L4 5z"></path>
    </svg>
  `;
}

export function chartIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 19V11M10 19V5M16 19v-7M3 19h18"></path>
    </svg>
  `;
}

export function bugIconHtml() {
  return `
    <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 9h8M7 13H4M20 13h-3M8 17H5M19 17h-3M9 5l-2-2M15 5l2-2M8 7h8v10a4 4 0 0 1-8 0V7z"></path>
    </svg>
  `;
}

export function iconButton(action, id, title, icon, enabled = true, extraClass = "") {
  const icons = {
    view: "&#128065;",
    audit: "&#128221;",
    "audit-monochrome": `
      <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 3h10v4H7zM5 5H3v16h16v-2M8 11h8M8 15h6"></path>
      </svg>
    `,
    edit: "&#9998;",
    duplicate: "&#10697;",
    delete: "&#128465;",
    "delete-monochrome": `
      <svg class="button-svg-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path>
      </svg>
    `,
    finish: "&#10003;",
    gantt: "&#128202;"
  };
  return `<button type="button" class="icon-action ${extraClass}" data-action="${action}" data-id="${id}" title="${escapeAttr(title)}" aria-label="${escapeAttr(title)}" ${enabled ? "" : "disabled"}><span class="button-icon" aria-hidden="true">${icons[icon] || "?"}</span></button>`;
}
