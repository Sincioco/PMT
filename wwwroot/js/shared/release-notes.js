import { releaseNotes as generatedReleaseNotes } from "./release-notes-data.js?v=release-notes-2026-07-19-day-32-9a019dda874c";
import { appUrl } from "./app-urls.js";

export let releaseNotes = generatedReleaseNotes;

export async function refreshReleaseNotes(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") return false;

  const manifestResponse = await fetchImpl(appUrl("/release-notes-version.json"), {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!manifestResponse?.ok) throw new Error("Unable to check for updated Release Notes.");

  const manifest = await manifestResponse.json();
  const latestSeenToken = String(manifest?.seenToken || "").trim();
  if (!latestSeenToken || latestSeenToken === releaseNoteSeenToken(releaseNotes[0])) return false;

  const feedResponse = await fetchImpl(appUrl("/release-notes-data.json"), {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!feedResponse?.ok) throw new Error("Unable to load updated Release Notes.");

  const updatedNotes = await feedResponse.json();
  if (!Array.isArray(updatedNotes) || !updatedNotes.length || releaseNoteSeenToken(updatedNotes[0]) !== latestSeenToken) {
    throw new Error("The updated Release Notes are incomplete. PMT will check again shortly.");
  }

  releaseNotes = Object.freeze(updatedNotes);
  return true;
}

export function releaseNoteById(id, notes = releaseNotes) {
  return notes.find(note => note.id === String(id || "")) || notes[0] || null;
}

export function releaseNotesForLogin(lastSeenId, notes = releaseNotes) {
  const normalizedId = String(lastSeenId || "").trim();
  if (!normalizedId) {
    return { firstLogin: true, notes: notes.slice(0, 3) };
  }

  const lastSeenIndex = notes.findIndex(note => releaseNoteSeenToken(note) === normalizedId || note.id === normalizedId);
  if (lastSeenIndex >= 0) {
    return { firstLogin: false, notes: notes.slice(0, lastSeenIndex) };
  }

  const priorRevisionId = normalizedId.includes("@") ? normalizedId.split("@", 1)[0] : "";
  const revisedReleaseIndex = notes.findIndex(note => note.id === priorRevisionId);
  if (revisedReleaseIndex >= 0) {
    return { firstLogin: false, notes: notes.slice(0, revisedReleaseIndex + 1) };
  }

  return { firstLogin: true, notes: notes.slice(0, 3) };
}

export function releaseNoteSeenToken(note) {
  return String(note?.seenToken || note?.id || "").trim();
}

export function releaseNotesSeenPreferenceKey(userId) {
  const normalizedUserId = Number(userId || 0);
  return normalizedUserId > 0 ? `pmt-release-notes-last-seen:${normalizedUserId}` : "";
}
