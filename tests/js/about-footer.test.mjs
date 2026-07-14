import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ABOUT_DATABASE_VERSION,
  aboutFooterHtml
} from "../../wwwroot/js/features/about/about.js";

test("About 2D footer restores the original credit and repository line with database version", () => {
  const footer = aboutFooterHtml();

  assert.match(
    footer,
    /Created by <a href="http:\/\/sincioco\.com\/resume"[^>]*>Louiery R\. Sincioco<\/a> on June 2026 to help companies who need an open-source solution for a Project or Task Management Tool for free\./
  );
  assert.match(
    footer,
    /Open-source GitHub repository is at <a href="https:\/\/github\.com\/Sincioco\/PMT"[^>]*>https:\/\/github\.com\/Sincioco\/PMT<\/a>/
  );
  assert.equal(ABOUT_DATABASE_VERSION, "1.14");
  assert.match(footer, /PMT Database Version 1\.14/);
});

test("About footer is limited to the 2D intro", async () => {
  const css = await readFile(
    new URL("../../wwwroot/css/features/about.css", import.meta.url),
    "utf8"
  );

  assert.match(css, /\.about-flight-started\s+\.about-footer\s*\{[^}]*display:\s*none;/s);
});
