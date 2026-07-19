import { escapeAttr, escapeHtml } from "../shared/text-and-links.js";
import { appUrl } from "../shared/app-urls.js";

export function releaseNoteNavigationHtml(notes, selectedId, options = {}) {
  const action = options.action || "select-release-note";
  const label = options.label || "Release notes";
  return `
    <nav class="release-note-navigation" aria-label="${escapeAttr(label)}">
      ${notes.map(note => {
        const active = note.id === selectedId;
        return `
          <button class="release-note-navigation-item ${active ? "is-active" : ""}" type="button" data-action="${escapeAttr(action)}" data-release-id="${escapeAttr(note.id)}" ${active ? 'aria-current="page"' : ""}>
            <span class="release-note-navigation-date">${escapeHtml(formatReleaseDate(note.date))}</span>
            <strong>Day ${escapeHtml(note.day)}</strong>
            <span class="release-note-navigation-title">${escapeHtml(note.title)}</span>
          </button>
        `;
      }).join("")}
    </nav>
  `;
}

export function releaseNoteContentHtml(note, options = {}) {
  if (!note) return `<div class="empty">No release note is available.</div>`;
  const showPrompt = options.mode === "prompts";
  const showIllustration = options.showIllustration === true && note.illustration?.url;
  return `
    <div class="release-note-content" data-release-note-id="${escapeAttr(note.id)}">
      ${showIllustration ? `
        <div class="release-note-illustration">
          <img src="${escapeAttr(appUrl(note.illustration.url))}" alt="${escapeAttr(note.illustration.alt || "")}" width="720" height="180">
        </div>
      ` : ""}
      <header class="release-note-content-head">
        <p class="release-note-kicker">Day ${escapeHtml(note.day)} &middot; ${escapeHtml(formatReleaseDate(note.date))}</p>
        <h2>${escapeHtml(note.title)}</h2>
        ${showPrompt ? `<p class="muted">Original prompt: ${escapeHtml(note.sourceFile)}</p>` : ""}
      </header>
      ${showPrompt ? releaseNotePromptHtml(note) : releaseNoteSectionsHtml(note)}
    </div>
  `;
}

export function formatReleaseDate(value) {
  const date = new Date(`${String(value || "")}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function releaseNoteSectionsHtml(note) {
  return `
    <div class="release-note-sections">
      ${note.sections.map(section => `
        <section class="release-note-section">
          <h3>${escapeHtml(section.title)}</h3>
          <ul>
            ${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </section>
      `).join("")}
    </div>
  `;
}

function releaseNotePromptHtml(note) {
  return `<pre class="release-note-prompt">${escapeHtml(note.prompt)}</pre>`;
}
