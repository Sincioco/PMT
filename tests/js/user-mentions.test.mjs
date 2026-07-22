import test from "node:test";
import assert from "node:assert/strict";

import {
  findEntityReferenceMatches,
  findUserMentionMatches
} from "../../wwwroot/js/components/user-mentions.js";

const users = [
  { id: 1, nickname: "Sin", isActive: true },
  { id: 2, nickname: "Sam Altman", isActive: true },
  { id: 3, nickname: "FormerUser", isActive: false }
];

test("mentions match active nicknames without changing their typed text", () => {
  const text = "Ask @sin and @{Sam Altman}; @FormerUser and @Unknown stay plain.";

  assert.deepEqual(findUserMentionMatches(text, users), [
    { start: 4, end: 8, text: "@sin", userId: 1 },
    { start: 13, end: 26, text: "@{Sam Altman}", userId: 2 }
  ]);
});

test("mentions do not activate inside email addresses and preserve linked text boundaries", () => {
  const text = "Email qa@Sin.com, then ask @Sin. A path/@Sin may still refer to Sin.";

  assert.deepEqual(findUserMentionMatches(text, users), [
    { start: 27, end: 31, text: "@Sin", userId: 1 },
    { start: 40, end: 44, text: "@Sin", userId: 1 }
  ]);
});

test("plain mentions support common username punctuation and explicit braces support spaces", () => {
  const punctuationUsers = [
    { id: 4, nickname: "qa.lead-1", isActive: true },
    { id: 5, nickname: "Release Captain", isActive: true }
  ];
  const text = "Review with @qa.lead-1, then @{Release Captain}.";

  assert.deepEqual(findUserMentionMatches(text, punctuationUsers).map(match => match.text), [
    "@qa.lead-1",
    "@{Release Captain}"
  ]);
});

test("entity references support mentions and live-card embeds", () => {
  const text = "Trace @task/12, @bug/44, @doc/3, @diagram/9, @livetask/12, @livebug/44, @livediagram/9.";

  assert.deepEqual(findEntityReferenceMatches(text).map(match => ({
    text: match.text,
    entityType: match.entityType,
    entityId: match.entityId,
    embed: match.embed
  })), [
    { text: "@task/12", entityType: "task", entityId: 12, embed: false },
    { text: "@bug/44", entityType: "bug", entityId: 44, embed: false },
    { text: "@doc/3", entityType: "document", entityId: 3, embed: false },
    { text: "@diagram/9", entityType: "diagram", entityId: 9, embed: false },
    { text: "@livetask/12", entityType: "task", entityId: 12, embed: true },
    { text: "@livebug/44", entityType: "bug", entityId: 44, embed: true },
    { text: "@livediagram/9", entityType: "diagram", entityId: 9, embed: true }
  ]);
});

test("entity references do not activate inside email-style text", () => {
  const text = "Ignore qa@task/12 and keep @task/12.";

  assert.deepEqual(findEntityReferenceMatches(text).map(match => match.text), [
    "@task/12"
  ]);
});
