import { readNavigationConfig } from "../core/navigation-preferences.js?v=release-notes-2026-07-17-day-31-fb8032719c56";
import { screenRegistry } from "../core/screen-registry.js?v=release-notes-2026-07-17-day-31-fb8032719c56";
import { escapeHtml } from "../shared/text-and-links.js";

export function sectionHead(title, actionsHtml) {
  const displayTitle = navigationTitle(title);
  return `
    <div class="section-head">
      <h1>${escapeHtml(displayTitle)}</h1>
      <div class="toolbar">${actionsHtml || ""}</div>
    </div>
  `;
}

function navigationTitle(title) {
  const fallback = String(title || "");
  const screen = screenRegistry.find(item => item.view === fallback || item.label === fallback);
  if (!screen?.showInNavigation) return fallback;

  return readNavigationConfig().items.find(item => item.view === screen.view)?.label || screen.label || fallback;
}
