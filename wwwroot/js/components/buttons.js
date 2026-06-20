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

export function iconButton(action, id, title, icon, enabled = true, extraClass = "") {
  const icons = { view: "&#128065;", audit: "&#128221;", edit: "&#9998;", duplicate: "&#10697;", delete: "&#128465;", finish: "&#10003;", gantt: "&#128202;" };
  return `<button type="button" class="icon-action ${extraClass}" data-action="${action}" data-id="${id}" title="${escapeAttr(title)}" ${enabled ? "" : "disabled"}>${icons[icon] || "?"}</button>`;
}
