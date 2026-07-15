import test from "node:test";
import assert from "node:assert/strict";

import {
  severityDisplayLabel,
  severityPillHtml,
  severityTextHtml
} from "../../wwwroot/js/shared/severity.js";

test("severity display removes only a leading numeric priority prefix", () => {
  assert.equal(severityDisplayLabel("1 - Critical"), "Critical");
  assert.equal(severityDisplayLabel("  12- Major  "), "Major");
  assert.equal(severityDisplayLabel("Critical"), "Critical");
  assert.equal(severityDisplayLabel("Level 1 - Critical"), "Level 1 - Critical");
});

test("severity pills show the short label and keep the complete value in the tooltip", () => {
  assert.equal(
    severityPillHtml("1 - Critical"),
    '<span class="pill severity-Critical" title="1 - Critical">Critical</span>'
  );
  assert.equal(
    severityPillHtml("2 - major"),
    '<span class="pill severity-Major" title="2 - major">major</span>'
  );
  assert.equal(severityPillHtml(""), '<span class="pill"></span>');
});

test("plain severity display escapes the complete tooltip and short label", () => {
  assert.equal(
    severityTextHtml('1 - Critical & <urgent>'),
    '<span title="1 - Critical &amp; &lt;urgent&gt;">Critical &amp; &lt;urgent&gt;</span>'
  );
});
