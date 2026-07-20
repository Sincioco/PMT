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
        ${showPrompt ? releaseNotePromptSubtitleHtml(note, options.allNotes) : ""}
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
  const lines = String(note.prompt || "").replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let titleRendered = false;
  let listType = "";
  let itemOpen = false;

  const closeItem = () => {
    if (!itemOpen) return;
    html.push("</li>");
    itemOpen = false;
  };
  const closeList = () => {
    closeItem();
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  };
  const openList = (type, start = 1) => {
    if (listType === type) return;
    closeList();
    const startAttr = type === "ol" && Number(start) > 1 ? ` start="${Number(start)}"` : "";
    html.push(`<${type} class="release-note-prompt-list"${startAttr}>`);
    listType = type;
  };
  const addParagraph = line => {
    const text = escapeHtml(line.trim());
    if (!text) return;
    if (itemOpen) {
      html.push(`<p>${text}</p>`);
    } else {
      closeList();
      html.push(`<p class="release-note-prompt-paragraph">${text}</p>`);
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const next = lines[index + 1]?.trim() || "";

    if (!trimmed) {
      closeList();
      continue;
    }

    if (/^-{3,}$/.test(next)) {
      closeList();
      html.push(titleRendered
        ? `<h3 class="release-note-prompt-section">${escapeHtml(trimmed)}</h3>`
        : `<h3 class="release-note-prompt-title">${escapeHtml(trimmed)}</h3>`);
      titleRendered = true;
      index += 1;
      continue;
    }

    const numbered = /^(\d+)\.\)\s*(.*)$/.exec(trimmed);
    if (numbered) {
      const value = Number(numbered[1]);
      openList("ol", value);
      closeItem();
      html.push(`<li value="${value}"><p>${escapeHtml(numbered[2] || "")}</p>`);
      itemOpen = true;
      continue;
    }

    const bulleted = /^[*-]\s+(.*)$/.exec(trimmed);
    if (bulleted) {
      openList("ul");
      closeItem();
      html.push(`<li><p>${escapeHtml(bulleted[1] || "")}</p>`);
      itemOpen = true;
      continue;
    }

    if (/^-{6,}$/.test(trimmed)) {
      closeList();
      html.push(`<hr class="release-note-prompt-rule">`);
      continue;
    }

    addParagraph(trimmed);
  }

  closeList();
  return `<div class="release-note-prompt">${html.join("")}</div>`;
}

function releaseNotePromptSubtitleHtml(note, allNotes) {
  const stats = releaseNotePromptStats(note, allNotes);
  return `
    <p class="muted release-note-prompt-stats">
      <span>Original prompt: ${escapeHtml(note.sourceFile)}</span>
      <span>Day lines: ${escapeHtml(stats.lines.toLocaleString())}</span>
      <span>Day words: ${escapeHtml(stats.words.toLocaleString())}</span>
      <span>Project lines through Day ${escapeHtml(note.day)}: ${escapeHtml(stats.totalLines.toLocaleString())}</span>
      <span>Project words through Day ${escapeHtml(note.day)}: ${escapeHtml(stats.totalWords.toLocaleString())}</span>
    </p>
  `;
}

function releaseNotePromptStats(note, allNotes) {
  const day = Number(note?.day || 0);
  const relatedNotes = releaseNotePromptStatsNotes(note, allNotes)
    .filter(item => Number(item.day || 0) <= day)
    .sort((left, right) => Number(left.day || 0) - Number(right.day || 0));
  let totalLines = 0;
  let totalWords = 0;
  for (const item of relatedNotes) {
    totalLines += releaseNotePromptLineCount(item.prompt);
    totalWords += releaseNotePromptWordCount(item.prompt);
  }
  return {
    lines: releaseNotePromptLineCount(note?.prompt),
    words: releaseNotePromptWordCount(note?.prompt),
    totalLines,
    totalWords
  };
}

function releaseNotePromptStatsNotes(note, allNotes) {
  return Array.isArray(allNotes) && allNotes.length ? allNotes : [note].filter(Boolean);
}

function releaseNotePromptLineCount(prompt) {
  const text = String(prompt || "");
  if (!text) return 0;
  return text.replace(/\r\n?/g, "\n").split("\n").length;
}

function releaseNotePromptWordCount(prompt) {
  return String(prompt || "").trim().split(/\s+/).filter(Boolean).length;
}
