# Maintaining PMT Release Notes

The Release Notes screen and the login-time What's New dialog consume the same generated browser data. Keep them synchronized through this workflow after the user explicitly authorizes and completes a PMT release.

## Sources

- `Requirements/YYYY-MM-DD - Requirements - Day N.txt` is the historical original prompt. Requirements files are planning records and do not authorize implementation by themselves.
- `scripts/release-notes.json` contains the curated, business-facing title and grouped release-note sections for each available prompt file.
- `wwwroot/js/shared/release-notes-data.js`, `wwwroot/release-notes-data.json`, and `wwwroot/release-notes-version.json` are generated from both sources and must not be edited by hand. The small version manifest lets an open PMT session detect an update without repeatedly downloading the full history.

Days 10 and 11 have no source prompt files in the repository, so the historical sequence currently contains 27 real releases rather than invented placeholders.

## Add a release

1. Confirm the user explicitly authorized the work and that the described behavior is implemented.
2. Keep the original Requirements prompt as historical reference and add one matching entry to `scripts/release-notes.json`.
3. Write the summary for business users: group related features, enhancements, and fixes under short section headings; omit AI instructions, commit requests, and test mechanics.
4. Generate and verify the shared data:

```powershell
npm.cmd run generate:release-notes
npm.cmd run check:release-notes
npm.cmd run check:js
npm.cmd run test:js
npx.cmd playwright test tests/browser/release-notes.spec.mjs
```

The generator accepts future Day files automatically. It fails if an available prompt has no curated summary, a summary has no matching prompt, or any checked-in generated output is stale. It derives a short content revision from each prompt and business summary, then advances that revision throughout the browser module cache chain so returning users cannot be left on an older same-day update.

## What's New behavior

The latest release is first. A first login sees the latest three releases. Returning users see only releases newer than the revision token in `pmt-release-notes-last-seen:{userId}`. Closing What's New, including by following its Release Notes link, marks the newest current revision as seen for that user. Login and successful cookie-session restoration perform an immediate no-cache manifest check before selecting unseen notes. While a user remains signed in, PMT checks the small manifest once per minute; when it changes, PMT downloads the updated shared feed, updates an already-open Release Notes screen, and shows the revised note once. Regenerating after a mid-day prompt or summary update changes the revision even when its Day number is unchanged.

This is browser preference state only. It does not change application data or the database contract.
