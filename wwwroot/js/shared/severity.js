import {
  escapeAttr,
  escapeHtml
} from "./text-and-links.js";

const severityStyles = new Map([
  ["trivial", "Trivial"],
  ["minor", "Minor"],
  ["major", "Major"],
  ["critical", "Critical"]
]);

export function severityDisplayLabel(value) {
  const fullLabel = String(value ?? "").trim();
  const displayLabel = fullLabel.replace(/^\d+\s*-\s*/, "").trim();
  return displayLabel || fullLabel;
}

export function severityTextHtml(value) {
  const fullLabel = String(value ?? "").trim();
  if (!fullLabel) return "";

  return `<span title="${escapeAttr(fullLabel)}">${escapeHtml(severityDisplayLabel(fullLabel))}</span>`;
}

export function severityPillHtml(value) {
  const fullLabel = String(value ?? "").trim();
  const displayLabel = severityDisplayLabel(fullLabel);
  const styleName = severityStyles.get(displayLabel.toLowerCase());
  const styleClass = styleName ? ` severity-${styleName}` : "";
  const title = fullLabel ? ` title="${escapeAttr(fullLabel)}"` : "";

  return `<span class="pill${styleClass}"${title}>${escapeHtml(displayLabel)}</span>`;
}
