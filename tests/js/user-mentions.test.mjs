import test from "node:test";
import assert from "node:assert/strict";

import { findUserMentionMatches } from "../../wwwroot/js/components/user-mentions.js";

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
