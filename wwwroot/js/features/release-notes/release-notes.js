import { buttonContent } from "../../components/buttons.js";
import {
  releaseNoteContentHtml,
  releaseNoteNavigationHtml
} from "../../components/release-notes.js?v=release-notes-2026-07-18-day-31-fb8032719c56";
import { sectionHead } from "../../components/sections.js?v=release-notes-2026-07-18-day-31-fb8032719c56";
import {
  preferenceKeys,
  readPreference,
  writePreference
} from "../../core/preferences.js?v=release-notes-2026-07-18-day-31-fb8032719c56";
import { releaseNoteById, releaseNotes } from "../../shared/release-notes.js?v=release-notes-2026-07-18-day-31-fb8032719c56";

const releaseNoteModes = new Set(["release", "prompts"]);

export function createReleaseNotesFeature({ app }) {
  let mode = normalizedMode(readPreference(preferenceKeys.releaseNotesView, "release"));
  let selectedId = releaseNoteById(readPreference(preferenceKeys.releaseNotesSelected, ""))?.id || "";

  function renderReleaseNotes() {
    const selected = releaseNoteById(selectedId);
    selectedId = selected?.id || "";
    app.innerHTML = `
      <div class="release-notes-screen">
        ${sectionHead("Release Notes", releaseNotesToggleHtml())}
        <div class="release-notes-layout">
          <aside class="panel release-notes-index">
            <div class="release-notes-index-head">
              <strong>Release history</strong>
              <span class="muted">${releaseNotes.length} releases</span>
            </div>
            ${releaseNoteNavigationHtml(releaseNotes, selectedId)}
          </aside>
          <article class="panel release-note-reader" aria-live="polite">
            ${releaseNoteContentHtml(selected, { mode })}
          </article>
        </div>
      </div>
    `;
  }

  async function handleAction(action, _id, button) {
    if (action === "set-release-notes-view") {
      mode = normalizedMode(button?.dataset?.mode);
      writePreference(preferenceKeys.releaseNotesView, mode);
      renderReleaseNotes();
      requestAnimationFrame(() => {
        app.querySelector(`.release-notes-view-toggle-button[data-mode="${mode}"]`)
          ?.focus({ preventScroll: true });
      });
      return true;
    }

    if (action === "select-release-note") {
      selectedId = releaseNoteById(button?.dataset?.releaseId)?.id || selectedId;
      writePreference(preferenceKeys.releaseNotesSelected, selectedId);
      renderReleaseNotes();
      requestAnimationFrame(() => {
        app.scrollTo({ top: 0, behavior: "instant" });
        const activeButton = app.querySelector(`.release-note-navigation-item[data-release-id="${CSS.escape(selectedId)}"]`);
        activeButton?.scrollIntoView({ block: "nearest" });
        activeButton?.focus({ preventScroll: true });
      });
      return true;
    }

    return false;
  }

  function releaseNotesToggleHtml() {
    return `
      <div class="release-notes-view-toggle" role="group" aria-label="Release Notes view">
        <button class="secondary text-icon-button release-notes-view-toggle-button ${mode === "release" ? "is-on" : ""}" type="button" data-action="set-release-notes-view" data-mode="release" aria-pressed="${mode === "release"}">
          ${buttonContent("&#128240;", "Release Notes")}
        </button>
        <button class="secondary text-icon-button release-notes-view-toggle-button ${mode === "prompts" ? "is-on" : ""}" type="button" data-action="set-release-notes-view" data-mode="prompts" aria-pressed="${mode === "prompts"}">
          ${buttonContent("&#10024;", "Sin's AI Prompts")}
        </button>
      </div>
    `;
  }

  return {
    handleAction,
    render: renderReleaseNotes
  };
}

function normalizedMode(value) {
  return releaseNoteModes.has(value) ? value : "release";
}
