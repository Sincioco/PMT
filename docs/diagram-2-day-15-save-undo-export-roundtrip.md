# Diagram 2 Day 15 Save, Undo, Export, and Same-Document Roundtrip

## Scope

Day 15 turned Diagram 2 from a read-only live renderer into an isolated editable path over the same backing Diagram documents that Diagram 1 uses. Diagram 1 remained the production editor and was not removed, renamed, or made subordinate to Diagram 2.

## Diagram 2 Behavior Added

- Diagram 2 tracks canonical editor state, selected objects, dirty/saved status, and a bounded user-level history stack.
- Save, Undo, Redo, selection copy, PMT Diagram JSON export, SVG export, PNG export, and selection nudge actions are available from the Diagram 2 toolbar.
- Pointer selection and drag gestures use the Diagram 2 renderer's geometry-preview and dirty-flush hooks so normal movement stays incremental.
- Undo/redo restores canonical snapshots intentionally, then lets the renderer refresh from that canonical state.

## Same Backing Document

Diagram 2 saves through the same injected Diagram backing-document service that Diagram 1 uses. It updates the selected Diagram document record instead of creating a Diagram 2 copy, a second schema, or a second template/clipboard/file contract.

The saved body is rebuilt from normalized canonical annotation state with `buildAnnotationSvg`. Mounted DOM nodes, viewport halos, low-detail overview output, and Diagram 2 renderer caches are not serialized.

## Diagram 1 Roundtrip

The Day 15 browser test `Diagram 2 saves the same backing document and roundtrips through Diagram 1` verifies:

- Diagram 2 can open a shared Diagram document.
- Selecting and nudging an object marks Diagram 2 dirty.
- Undo returns the document to saved state.
- Redo restores the change and save writes through the existing backing service.
- The saved body remains a private PMT Diagram image with complete inline SVG metadata.
- The saved state excludes Diagram 2 live renderer cache data.
- Reopening the same document in Diagram 1 succeeds.
- Reopening the same document in Diagram 2 shows the saved coordinates.

## Compatibility Contracts Affected

No compatibility contract was forked. Diagram 2 continues to use:

- PMT Diagram file format `pmt-diagram` version `1`.
- Selection clipboard format `pmt-diagram-selection` version `1`.
- Object Template endpoint `/api/image-annotation/template-library`.
- Default Object Template endpoint `/api/image-annotation/default-template-library`.
- The existing Diagram/Documentation save path and row-version conflict mechanism.

## Validation

Day 15 was committed as `7eadf51136ae3c9064aa2f8e1eabebaf747f36ec` with subject `Sin and Codex: add Diagram 2 save undo export path`.

Automated and smoke checks recorded in that commit:

- `node --check tests/browser/diagram2-navigation.spec.mjs`
- `node --check wwwroot/js/features/diagram2/diagram2.js`
- `npm run check:release-notes`
- `npm run test:js`
- `npm run check:js`
- `npm run test:browser -- tests/browser/diagram2-navigation.spec.mjs`
- `git diff --check`
- `dotnet build --no-restore -p:OutputPath=artifacts/build/day15-diagram2-save-export/ -v:minimal`
- Live smoke of `http://127.0.0.1:5056/#/diagram-2/22` and `http://127.0.0.1:5056/#/diagram-2/20`

## Required Completion Report

Day completed: Day 15 - Save, Undo/Redo, Export, and Same-Document Roundtrip.

Files changed: `tests/browser/diagram2-navigation.spec.mjs`, `wwwroot/css/features/diagram2.css`, `wwwroot/index.html`, `wwwroot/js/app.js`, `wwwroot/js/features/diagram2/diagram2.js`.

Diagram 1 behavior changed: No. Diagram 1 code and database objects were untouched; Diagram 1 remained the fallback editor and reopened Diagram 2 saves.

Diagram 2 behavior added: Save, undo, redo, selection copy, PMT/SVG/PNG export, object selection, selection nudging, dirty/saved state, and same-document persistence.

Compatibility contracts affected: Shared contracts were reused, not forked. No second database schema, duplicate Diagram document model, template library, clipboard schema, or import/export format was added.

Before measurements: Day 14 had compatibility adapters and a live renderer, but no Diagram 2 save/export UI or same-document edit path.

After measurements: Focused browser coverage verified the Diagram 2 save/undo/export path and same-document roundtrip through Diagram 1 without leaking mounted or low-detail renderer state.

Automated tests: See the validation list above.

Manual test steps: Live smoke opened Diagram 2 documents `22` and `20` on `localhost:5056` and confirmed SVG render without browser errors.

Recompile required or Ctrl+F5 only: Browser cache refresh was required for the updated JavaScript/CSS query strings. A .NET rebuild was only needed for normal local validation, not because backend code changed.

Known limitations: Day 15 enabled a small editable path and did not attempt the full Diagram 1 editor parity matrix for every operation. Day 16 beta readiness stress testing covers the broader hardening pass.

Commit: `7eadf51136ae3c9064aa2f8e1eabebaf747f36ec`.
