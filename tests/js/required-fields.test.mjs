import assert from "node:assert/strict";
import test from "node:test";

import {
  checkList,
  field,
  richTextField,
  selectOptionsField,
  sharedRichColorPickerHtml
} from "../../wwwroot/js/components/forms.js";
import { profileAvatarPickerHtml } from "../../wwwroot/js/components/profile-avatar-picker.js";

test("native required fields expose required and accessible state", () => {
  const inputHtml = field("Title", "title", "", "text", "", "", "", { required: true });
  const selectHtml = selectOptionsField("Project", "projectId", [{ id: 1, title: "PMT" }], 1, { required: true });

  assert.match(inputHtml, /<input[^>]*\brequired\b[^>]*aria-required="true"/);
  assert.match(selectHtml, /<select[^>]*\brequired\b[^>]*aria-required="true"/);
  assert.doesNotMatch(field("Notes", "notes", "", "text"), /\baria-required=/);
});

test("compound required fields expose the shared marker class and accessible state", () => {
  const richHtml = richTextField("bodyHtml", "Body", "", { required: true });
  const listHtml = checkList("Members", "memberIds", [{ id: 1, title: "QA" }], [], { required: true });

  assert.match(richHtml, /class="field full is-required"/);
  assert.match(richHtml, /role="textbox" aria-label="Body" aria-multiline="true"/);
  assert.match(richHtml, /data-rich="bodyHtml" aria-required="true"/);
  assert.match(listHtml, /<fieldset class="[^"]*is-required[^"]*">/);
});

test("avatar requirement describes the overall choice rather than the generic-only options", () => {
  const html = profileAvatarPickerHtml();

  assert.match(html, /class="field full is-required profile-avatar-picker-field"/);
  assert.match(html, /<label>Avatar<\/label>/);
  assert.match(html, /role="radiogroup" aria-label="Generic avatars"/);
  assert.doesNotMatch(html, /role="radiogroup"[^>]*aria-required/);
});

test("shared outline color picker uses an outline icon instead of a font letter", () => {
  const html = sharedRichColorPickerHtml({
    name: "stroke",
    title: "Outline Color",
    selectedColor: "#3F7F0D",
    icon: "outline"
  });

  assert.match(html, /rich-outline-color-icon/);
  assert.match(html, /<rect x="4" y="4" width="15" height="15" rx="1"><\/rect>/);
  assert.doesNotMatch(html, /rich-font-color-letter/);
});
