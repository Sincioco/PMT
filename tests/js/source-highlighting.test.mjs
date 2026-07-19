import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareRichSourceHighlight,
  RICH_SOURCE_KEYWORD_COUNTS,
  RICH_SOURCE_TEXT_TYPES
} from "../../wwwroot/js/shared/source-highlighting.js";

test("source text type choices and keyword lists stay complete", () => {
  assert.deepEqual(
    RICH_SOURCE_TEXT_TYPES.map(type => type.label),
    ["None", "C#", "T-SQL", "HTML", "CSS", "JavaScript", "TypeScript", "JSON", "JAVA"]
  );

  assert.deepEqual(RICH_SOURCE_KEYWORD_COUNTS, {
    csharp: 30,
    tsql: 30,
    html: 30,
    css: 30,
    javascript: 30,
    typescript: 30,
    java: 30
  });
});

test("None leaves source unchanged and unhighlighted", () => {
  const source = "const value = '<unsafe>';";
  assert.deepEqual(prepareRichSourceHighlight(source, ""), {
    error: "",
    highlighted: false,
    html: "",
    text: source
  });
});

test("language highlighting escapes markup and does not color keywords inside comments or strings", () => {
  const result = prepareRichSourceHighlight(
    "public class Demo { // public class\nconst string Value = \"return <script>\"; return Value; }",
    "csharp"
  );

  assert.equal(result.error, "");
  assert.equal(result.highlighted, true);
  assert.match(result.html, /rich-source-token-keyword">public<\/span> <span class="rich-source-token-keyword">class<\/span>/);
  assert.match(result.html, /rich-source-token-comment">\/\/ public class<\/span>/);
  assert.match(result.html, /rich-source-token-string">"return &lt;script&gt;"<\/span>/);
  assert.doesNotMatch(result.html, /<script>/);
});

test("T-SQL keyword matching is case-insensitive", () => {
  const result = prepareRichSourceHighlight("SELECT Value FROM pmt.Lookups WHERE Code IS NULL", "tsql");

  assert.equal(result.highlighted, true);
  assert.match(result.html, /rich-source-token-keyword">SELECT<\/span>/);
  assert.match(result.html, /rich-source-token-keyword">FROM<\/span>/);
  assert.match(result.html, /rich-source-token-keyword">WHERE<\/span>/);
  assert.match(result.html, /rich-source-token-keyword">NULL<\/span>/);
});

test("valid JSON is formatted and colors properties and value types separately", () => {
  const result = prepareRichSourceHighlight('{"name":"PMT","count":2,"active":true,"missing":null}', "json", {
    formatJson: true
  });

  assert.equal(result.error, "");
  assert.equal(result.highlighted, true);
  assert.equal(result.text, [
    "{",
    '  "name": "PMT",',
    '  "count": 2,',
    '  "active": true,',
    '  "missing": null',
    "}"
  ].join("\n"));
  assert.match(result.html, /rich-source-token-property">"name"<\/span>/);
  assert.match(result.html, /rich-source-token-string">"PMT"<\/span>/);
  assert.match(result.html, /rich-source-token-number">2<\/span>/);
  assert.match(result.html, /rich-source-token-keyword">true<\/span>/);
  assert.match(result.html, /rich-source-token-keyword">null<\/span>/);
});

test("invalid JSON and unsupported or oversized source safely remain plain text", () => {
  const invalidJson = prepareRichSourceHighlight("{not json}", "json", { formatJson: true });
  assert.equal(invalidJson.highlighted, false);
  assert.equal(invalidJson.text, "{not json}");
  assert.match(invalidJson.error, /JSON is invalid/);

  const unsupported = prepareRichSourceHighlight("hello", "python");
  assert.equal(unsupported.highlighted, false);
  assert.match(unsupported.error, /cannot be color coded/);

  const oversized = prepareRichSourceHighlight("x".repeat(250001), "javascript");
  assert.equal(oversized.highlighted, false);
  assert.match(oversized.error, /too large/);
});
