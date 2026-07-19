import assert from "node:assert/strict";
import test from "node:test";

import {
  isImportedImageDataUrl,
  parseImportedImageDataUrl
} from "../../wwwroot/js/shared/imported-html-images.js";

test("embedded image detection accepts mixed-case data:image URLs only", () => {
  assert.equal(isImportedImageDataUrl("DATA:IMAGE/PNG;BASE64,AA=="), true);
  assert.equal(isImportedImageDataUrl("data:image/svg+xml,%3Csvg%2F%3E"), true);
  assert.equal(isImportedImageDataUrl("data:text/plain,hello"), false);
  assert.equal(isImportedImageDataUrl("/uploads/richtext/image.png"), false);
});

test("mixed-case base64 image data is decoded into the correct Blob", async () => {
  const parsed = parseImportedImageDataUrl("DATA:IMAGE/PNG;CHARSET=binary;BASE64,UE1U");

  assert.ok(parsed);
  assert.equal(parsed.contentType, "image/png");
  assert.equal(parsed.blob.type, "image/png");
  assert.equal(await parsed.blob.text(), "PMT");
});

test("percent-encoded SVG image data is decoded without requiring base64", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>PMT &amp; Diagram</text></svg>';
  const parsed = parseImportedImageDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  assert.ok(parsed);
  assert.equal(parsed.contentType, "image/svg+xml");
  assert.equal(parsed.blob.type, "image/svg+xml");
  assert.equal(await parsed.blob.text(), svg);
});

test("invalid and non-image data URLs are rejected", () => {
  assert.equal(parseImportedImageDataUrl("data:text/plain;base64,UE1U"), null);
  assert.equal(parseImportedImageDataUrl("not-a-data-url"), null);
  assert.equal(parseImportedImageDataUrl("data:image/svg+xml,%E0%A4%A"), null);
});
