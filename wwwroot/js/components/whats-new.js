import {
  releaseNoteContentHtml,
  releaseNoteNavigationHtml
} from "./release-notes.js?v=release-notes-2026-07-16-day-29-4dbfab99e9a6";
import { readPreference, writePreference } from "../core/preferences.js?v=release-notes-2026-07-16-day-29-4dbfab99e9a6";
import {
  releaseNoteById,
  releaseNotes,
  releaseNotesForLogin,
  releaseNotesSeenPreferenceKey,
  refreshReleaseNotes
} from "../shared/release-notes.js?v=release-notes-2026-07-16-day-29-4dbfab99e9a6";

export function createWhatsNew({ getUserId, onReleaseNotesUpdated, openReleaseNotes }) {
  let checkedUserId = 0;
  let updateTimer = 0;

  async function showAfterLogin({ refreshFirst = true } = {}) {
    const userId = Number(getUserId?.() || 0);
    if (!userId) return false;
    startUpdateChecks();

    if (refreshFirst) {
      try {
        if (await refreshReleaseNotes()) {
          checkedUserId = 0;
          onReleaseNotesUpdated?.();
        }
      } catch {
        // Keep the bundled notes available and retry the static feed shortly.
      }
    }
    if (checkedUserId === userId) return false;
    checkedUserId = userId;

    const preferenceKey = releaseNotesSeenPreferenceKey(userId);
    const result = releaseNotesForLogin(readPreference(preferenceKey, ""));
    if (!result.notes.length) return false;

    openWhatsNewDialog(result.notes, preferenceKey);
    return true;
  }

  function startUpdateChecks() {
    if (updateTimer) return;
    updateTimer = globalThis.setInterval(async () => {
      if (!Number(getUserId?.() || 0) || document.getElementById("whatsNewDialog")) return;

      try {
        if (!await refreshReleaseNotes()) return;
        checkedUserId = 0;
        onReleaseNotesUpdated?.();
        await showAfterLogin({ refreshFirst: false });
      } catch {
        // A deploy can briefly expose only one generated file. Retry quietly on the next check.
      }
    }, 60_000);
  }

  return { showAfterLogin };

  function openWhatsNewDialog(notes, preferenceKey) {
    document.getElementById("whatsNewDialog")?.remove();
    let selectedId = notes[0]?.id || "";
    const modal = document.createElement("dialog");
    modal.id = "whatsNewDialog";
    modal.className = "dialog whats-new-dialog";
    modal.setAttribute("aria-labelledby", "whatsNewTitle");
    modal.innerHTML = `
      <div class="dialog-head">
        <h2 id="whatsNewTitle">What's New</h2>
        <div class="dialog-head-actions">
          <button class="icon-btn" type="button" data-action="close-whats-new" title="Close" aria-label="Close">x</button>
        </div>
      </div>
      <div class="dialog-body whats-new-dialog-body"></div>
      <div class="dialog-actions whats-new-dialog-actions">
        <p>If you want to see all Release Notes, <button class="whats-new-all-link" type="button" data-action="open-all-release-notes">click here</button>.</p>
        <button class="primary text-icon-button" type="button" data-action="close-whats-new"><span class="button-icon" aria-hidden="true">&#10003;</span><span>Close</span></button>
      </div>
    `;

    const renderBody = () => {
      const selected = releaseNoteById(selectedId, notes);
      selectedId = selected?.id || "";
      modal.querySelector(".whats-new-dialog-body").innerHTML = `
        <div class="whats-new-layout ${notes.length > 1 ? "has-navigation" : ""}">
          ${notes.length > 1 ? `
            <aside class="whats-new-navigation-panel">
              ${releaseNoteNavigationHtml(notes, selectedId, { action: "select-whats-new-release", label: "New releases" })}
            </aside>
          ` : ""}
          <article class="whats-new-reader" aria-live="polite">
            ${releaseNoteContentHtml(selected)}
          </article>
        </div>
      `;
    };

    renderBody();
    modal.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      if (button.dataset.action === "select-whats-new-release") {
        selectedId = releaseNoteById(button.dataset.releaseId, notes)?.id || selectedId;
        renderBody();
        requestAnimationFrame(() => {
          modal.querySelector(`.release-note-navigation-item[data-release-id="${CSS.escape(selectedId)}"]`)
            ?.focus({ preventScroll: true });
        });
        return;
      }
      if (button.dataset.action === "open-all-release-notes") {
        modal.close();
        openReleaseNotes?.();
        return;
      }
      if (button.dataset.action === "close-whats-new") modal.close();
    });
    modal.addEventListener("close", () => {
      const latestSeenToken = releaseNotes[0]?.seenToken || releaseNotes[0]?.id;
      if (latestSeenToken) writePreference(preferenceKey, latestSeenToken);
      modal.remove();
    }, { once: true });

    document.body.appendChild(modal);
    modal.showModal();
  }
}
