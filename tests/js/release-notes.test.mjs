import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const releaseNotesModule = await import("../../wwwroot/js/shared/release-notes.js");
const {
  releaseNoteById,
  releaseNoteSeenToken,
  releaseNotes,
  releaseNotesForLogin,
  releaseNotesSeenPreferenceKey,
  refreshReleaseNotes
} = releaseNotesModule;

const promptPattern = /^(\d{4}-\d{2}-\d{2}) - Requirements - Day (\d+)\.txt$/;
const availablePrompts = (await readdir(new URL("../../Requirements/", import.meta.url)))
  .map(name => name.match(promptPattern))
  .filter(Boolean)
  .map(match => ({ date: match[1], day: Number(match[2]) }))
  .sort((left, right) => right.date.localeCompare(left.date) || right.day - left.day);

test("release-note data covers every available historical prompt in latest-first order", async () => {
  assert.equal(releaseNotes.length, availablePrompts.length);
  assert.deepEqual(
    releaseNotes.map(note => note.id),
    availablePrompts.map(prompt => `${prompt.date}-day-${prompt.day}`)
  );

  for (const note of releaseNotes) {
    assert.match(note.sourceFile, new RegExp(`Day ${note.day}\\.txt$`));
    assert.ok(note.title.length > 0);
    assert.ok(note.sections.length > 0);
    assert.ok(note.sections.every(section => section.title && section.items.length > 0));
    assert.ok(note.prompt.length > 0);
    assert.match(note.version, /^[a-f0-9]{12}$/);
    assert.equal(note.seenToken, `${note.id}@${note.version}`);
    assert.match(note.illustration?.url || "", new RegExp(`^/assets/release-notes/${note.id}\\.svg\\?v=${note.version}$`));
    assert.ok(note.illustration?.alt);

    const assetUrl = new URL(`../../wwwroot${note.illustration.url}`, import.meta.url);
    assetUrl.search = "";
    const svg = await readFile(assetUrl, "utf8");
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(Buffer.byteLength(svg) < 3000, `${note.id} illustration should remain lightweight`);
    if (note.id === "2026-07-19-day-32") {
      assert.doesNotMatch(svg, /<(?:path|polygon)\b/i, "Day 32 should use only straight connector lines");
    }
  }
  assert.equal(new Set(releaseNotes.map(note => note.illustration.url.split("?", 1)[0])).size, releaseNotes.length);
});

test("first login returns only the latest three releases", () => {
  const result = releaseNotesForLogin("");

  assert.equal(result.firstLogin, true);
  assert.deepEqual(result.notes, releaseNotes.slice(0, 3));
});

test("returning login returns only releases newer than the saved release", () => {
  const savedRelease = releaseNotes[2];
  const result = releaseNotesForLogin(savedRelease.seenToken);

  assert.equal(result.firstLogin, false);
  assert.deepEqual(result.notes, releaseNotes.slice(0, 2));
  assert.deepEqual(releaseNotesForLogin(releaseNotes[0].seenToken).notes, []);
  assert.deepEqual(releaseNotesForLogin(releaseNotes[0].id).notes, []);
});

test("a revised same-day release is shown again without replaying older notes", () => {
  const latest = releaseNotes[0];
  const result = releaseNotesForLogin(`${latest.id}@000000000000`);

  assert.equal(result.firstLogin, false);
  assert.deepEqual(result.notes, [latest]);
});

test("unknown saved releases safely use the first-login limit", () => {
  const result = releaseNotesForLogin("retired-release-id");

  assert.equal(result.firstLogin, true);
  assert.deepEqual(result.notes, releaseNotes.slice(0, 3));
});

test("release lookup and user-specific seen keys are stable", () => {
  assert.equal(releaseNoteById(releaseNotes[1].id), releaseNotes[1]);
  assert.equal(releaseNoteById("missing"), releaseNotes[0]);
  assert.equal(releaseNoteSeenToken(releaseNotes[0]), releaseNotes[0].seenToken);
  assert.equal(releaseNotesSeenPreferenceKey(17), "pmt-release-notes-last-seen:17");
  assert.equal(releaseNotesSeenPreferenceKey(0), "");
});

test("the mid-day version check downloads the full feed only when the latest release changes", async () => {
  const requests = [];
  const unchanged = await refreshReleaseNotes(async url => {
    requests.push(url);
    return jsonResponse({ seenToken: releaseNotes[0].seenToken });
  });

  assert.equal(unchanged, false);
  assert.deepEqual(requests, ["/release-notes-version.json"]);

  const revisedVersion = "111111111111";
  const revisedLatest = {
    ...releaseNotes[0],
    version: revisedVersion,
    seenToken: `${releaseNotes[0].id}@${revisedVersion}`,
    title: `${releaseNotes[0].title} (Mid-day revision)`
  };
  const revisedFeed = [revisedLatest, ...releaseNotes.slice(1)];
  const changed = await refreshReleaseNotes(async url => {
    requests.push(url);
    return url.endsWith("version.json")
      ? jsonResponse({ seenToken: revisedLatest.seenToken })
      : jsonResponse(revisedFeed);
  });

  assert.equal(changed, true);
  assert.equal(releaseNotesModule.releaseNotes[0].seenToken, revisedLatest.seenToken);
  assert.equal(releaseNotesModule.releaseNotes[0].title, revisedLatest.title);
  assert.deepEqual(requests.slice(-2), ["/release-notes-version.json", "/release-notes-data.json"]);
});

function jsonResponse(body) {
  return {
    ok: true,
    async json() {
      return body;
    }
  };
}
