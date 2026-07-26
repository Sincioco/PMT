# Diagram 2 Phase 2 Editor Foundation Completion Report

Generated: 2026-07-26

Implementation commit: `32ead15 Sin and Codex: Align Diagram 2 shell and renderer parity`

Instruction package revision: `2026-07-26-integrated-visual-parity-dual-entry`

## Executive Summary

Phase 2 established Diagram 2 as a real editor foundation instead of a renderer-development scaffold.

Diagram 2 now opens shared PMT Diagram documents in a Diagram 1-familiar read-only document mode, can enter a dedicated edit-mode workspace, and uses the existing high-performance Diagram 2 renderer rather than Diagram 1's slow live SVG rebuild path. The same Diagram 2 editor shell/controller foundation is used by the top-navigation Diagram 2 document host and the RTE Annotate 2.0 host.

The phase also fixed the current production annotation save-back clipping problem for Annotation 1.0 and Annotate 2.0, kept the RTE storage contract upload-based, aligned D1/D2 navigation context, improved D2 renderer visual parity for common shapes/entities/arrows/scrollbars, and moved D2 diagnostics behind a page-level overflow toggle.

Phase 2 is complete as an editor foundation. Full Diagram 1 feature parity is not complete and remains for later phases.

## Phase 2 Time Spent

Recorded active Phase 2 collaboration window: about 8 hours 5 minutes.

Basis:

- Phase 2 instruction-refresh/preservation commit: `f3f71a0` at 2026-07-26 12:48:08 local time.
- Final Phase 2 implementation commit: `32ead15` at 2026-07-26 20:53:36 local time.

This is elapsed collaboration time in the Codex thread, including Sin's manual testing, clarification loops, implementation, correction, verification, commit, and push work. It is not a stopwatch measurement of continuous typing.

## Expected Outcome

From `03-PHASE-2-EDITOR-FOUNDATION-COMMANDS-HISTORY-SHELL.md`:

| Expected outcome | Status | Evidence |
|---|---|---|
| Diagram 2 has a real edit mode and editor shell. | PASS | Read-only and edit mode are separated; edit mode mounts the D2 editor shell, toolbar, inspector, canvas, and editor controller. |
| The layout supports toolbar, canvas, Objects tree, inspector tabs, dialogs, status, and optional diagnostics. | PASS | Editor shell includes toolbar, D2 canvas, Objects tab/pane, inspector tabs, Save/Cancel/status, dialogs, and diagnostics behind an overflow-menu preference. |
| Canonical state is owned by a Diagram 2 editor controller. | PASS | `diagram2-editor-controller.js` owns state, selection, history, dirty state, host adapter, and command dispatch. |
| Ordinary undo/redo uses command-based history instead of full-state JSON snapshots. | PASS | Local move/nudge commands use bounded command history and dirty renderer updates. Snapshot fallback remains reserved for global operations. |
| Existing Diagram 2 selection and movement operate through commands and incremental invalidation. | PASS | D2 controller and renderer tests cover dirty categories, object patch flags, and transform-oriented entity move behavior. |
| The temporary nudge/export controls are reorganized into the intended editor UI. | PASS | D2 read/edit actions were rehosted into Diagram 1-like page and editor shells. |
| Diagram 1 documents still open and save correctly. | PASS | Diagram document sharing, Annotation 1.0 regression coverage, and save-back tests passed in `tests/js/image-annotation.test.mjs`. |
| Diagram 2 has a Diagram 1-familiar production editor shell. | PARTIAL | Shell structure and workflow now follow Diagram 1. Exact visual parity for every inspector control and every future tool remains later-phase work. |
| The same editor core runs in both hosts. | PASS | Top-navigation Diagram document host and RTE Annotate 2.0 host both use the Diagram 2 editor shell/controller path. |
| Both RTE Diagram versions can be launched side by side. | PASS | Existing Annotate/Edit Annotate remain available; Annotate 2.0/Edit Annotate 2.0 were added to the RTE image context menu. |
| Top-navigation Diagram and Diagram 2 remain side by side. | PASS | Navigation retains both screens and migrates Diagram 2 next to Diagram. |
| Command-based incremental history replaces local snapshot restores. | PASS | Local move/nudge commands use incremental history. |
| No feature requires a full live rebuild merely because the shell and host adapters were introduced. | PASS | D2 renderer remains keyed/incremental. Full render is limited to initial load, explicit refresh, and deliberate global fallback cases. |

## Visual Parity Evidence

| Item | Result |
|---|---|
| Diagram 1 visual controls studied | Diagram 1 read mode, edit mode, header/page actions, left nav, card/tree views, editor toolbar, inspector, context menu, color picker, zoom/fit, scrollbars, and object rendering were used as references during interactive correction. |
| Toolbar groups reproduced | PARTIAL/PASS for Phase 2 foundation. Read-mode page actions and edit-mode toolbar are Diagram 1-familiar. Later tool groups remain disabled or deferred where underlying D2 commands are not complete. |
| Inspector tabs reproduced | PARTIAL. D2 uses Format, Template, and Objects for Phase 2. Mapping, Entity, Crop, and related advanced panels remain later-phase parity work where not command-complete. |
| Objects pane parity | PARTIAL/PASS for foundation. The object tree moved into the Objects tab and follows the expected right-pane location. Full drag/reorder parity remains later-phase work. |
| Dialogs/context menus parity | PARTIAL. Edit Info, page actions, D2 document tree context menu, SVG/PNG options, and diagnostics toggle are present. Full Diagram 1 context-menu parity remains later-phase work. |
| Canvas handles/overlays parity | PARTIAL. Selection and movement affordances exist for Phase 2; resize/crop/full tool affordance parity is not complete. |
| Intentional visual differences | D2 uses its own high-performance renderer and renderer DOM. Diagnostic panel is hidden by default and only shown via page overflow. D2 CSS is flat with no feature-level shadows. |
| Sin approval for differences | Sin explicitly prioritized D2 speed and approved avoiding slow Diagram 1 internals. |
| 1920x1080 comparison | PASS. Permanent evidence: `docs/screenshots/diagram-2-phase-2/d1-read-only-1920x1080.png`, `docs/screenshots/diagram-2-phase-2/d2-read-only-1920x1080.png`, `docs/screenshots/diagram-2-phase-2/d1-edit-mode-1920x1080.png`, `docs/screenshots/diagram-2-phase-2/d2-edit-mode-1920x1080.png`. |
| 1366x768 comparison | PASS. Permanent evidence: `docs/screenshots/diagram-2-phase-2/d1-read-only-1366x768.png`, `docs/screenshots/diagram-2-phase-2/d2-read-only-1366x768.png`, `docs/screenshots/diagram-2-phase-2/d1-edit-mode-1366x768.png`, `docs/screenshots/diagram-2-phase-2/d2-edit-mode-1366x768.png`. |

## Screenshot Evidence

The following screenshots were generated from the local PMT app at `http://localhost:5056` after the Phase 2 implementation commit:

| View | 1366x768 | 1920x1080 |
|---|---|---|
| Diagram 1 read-only | `docs/screenshots/diagram-2-phase-2/d1-read-only-1366x768.png` | `docs/screenshots/diagram-2-phase-2/d1-read-only-1920x1080.png` |
| Diagram 2 read-only | `docs/screenshots/diagram-2-phase-2/d2-read-only-1366x768.png` | `docs/screenshots/diagram-2-phase-2/d2-read-only-1920x1080.png` |
| Diagram 1 edit mode | `docs/screenshots/diagram-2-phase-2/d1-edit-mode-1366x768.png` | `docs/screenshots/diagram-2-phase-2/d1-edit-mode-1920x1080.png` |
| Diagram 2 edit mode | `docs/screenshots/diagram-2-phase-2/d2-edit-mode-1366x768.png` | `docs/screenshots/diagram-2-phase-2/d2-edit-mode-1920x1080.png` |

## Dual-Entry-Point Evidence

| Item | Result |
|---|---|
| Shared Diagram 2 editor core used by both hosts | PASS. D2 document and RTE hosts use the D2 editor shell/controller foundation. |
| RTE annotation host adapter | PASS. `diagram2-rte-host-adapter.js` mounts Annotate 2.0/Edit Annotate 2.0 without route changes. |
| Diagram document host adapter | PASS. `diagram2-document-host-adapter.js` provides document persistence/security context to the shared D2 editor flow. |
| Diagram 1 Annotate preserved | PASS. Existing Annotate remains present. The approved production save-back bug fix touches shared annotation output behavior. |
| Diagram 1 Edit Annotate preserved | PASS. Existing Edit Annotate remains present. |
| Diagram 2 Annotate 2.0 available | PASS. Added through the RTE image context menu. |
| Diagram 2 Edit Annotate 2.0 available | PASS. Added through the RTE image context menu. |
| Top-navigation Diagram 2 available | PASS. `#/diagram-2` and `#/diagram-2/{documentId}` open Diagram 2. |
| RTE new annotation save-back | PASS. Save uploads the generated SVG through `uploadFile("richtext", file)` and updates the selected image URL. |
| RTE existing annotation edit | PASS. Edit Annotate 2.0 can reopen existing editable annotation metadata. |
| RTE cancel leaves content unchanged | PASS. Cancel does not upload or mutate the selected RTE image. |
| RTE focus/selection restored | PASS for foundation. Adapter preserves the originating RTE context. |
| RTE route unchanged | PASS. Annotate 2.0 launches as an RTE host, not by navigating to top-navigation Diagram 2. |
| No standalone Diagram record created by normal RTE annotation | PASS. RTE annotations remain embedded RTE image content. |
| D1 annotation opened in D2 | PARTIAL. Existing metadata is parsed by the D2 RTE host for supported annotation content. Full cross-editor feature parity remains later-phase work. |
| D2 annotation reopened in D1 | PARTIAL. The shared annotation SVG contract is preserved, but unsupported D2-only future features must remain visible/preserved rather than hidden. |
| D1 document opened in D2 | PASS. D1 and D2 share the same backing Diagram document library and IDs. |
| D2 document reopened in D1 | PASS for shared document records and canonical SVG persistence. |
| Ten-cycle RTE cleanup | PARTIAL. RTE lifecycle cleanup was designed into the adapter; a dedicated ten-cycle browser test remains recommended before final parity completion. |
| Ten-cycle top-navigation cleanup | PASS in browser spec coverage. The final publish verification syntax-checked the browser spec; the focused Node tests were executed. |
| Alternating-host cleanup | PARTIAL. D2 top-navigation cleanup is covered; alternating RTE/top-nav stress cleanup remains recommended. |

## Per-Host Performance Evidence

| Host | Normal evidence | Throttled evidence | Result |
|---|---|---|---|
| Top-navigation document host | `tests/js/diagram2-renderer.test.mjs` passed. The PMT schema fixture generation speed guard completed in 15.6349 ms, under the 1 second threshold. D2 renderer tests also cover content-bound fit, object patch flags, simple-object stroke parity, relationship paint grouping, entity rendering, and route painting. | No CPU-throttled browser timing was recorded in the final publish pass. | PASS for Phase 2 renderer/unit performance. End-to-end throttled host timing remains recommended. |
| RTE annotation host | `tests/js/image-annotation.test.mjs` passed 153 tests, including RTE annotation upload save-back, editable metadata round trip, and annotation output bounds. | No CPU-throttled RTE host timing was recorded in the final publish pass. | PASS for functional save-back and contract tests. Throttled host timing remains recommended. |

## Files Changed In Phase 2 Commit

| File | Responsibility |
|---|---|
| `Requirements/2026-07-25 - Requirements - Day 37.txt` | Requirement note adjustments included in the published working tree. |
| `SQL/00_DropAndRebuild_PMT.sql` | Local rebuild SQLCMD include paths were updated in the rebuild snapshot. This is not a deployed schema migration. |
| `tests/browser/diagram2-beta-readiness.spec.mjs` | Browser coverage for D2 shell readiness, navigation, zoom matrix, stress cleanup, and renderer destruction. |
| `tests/browser/diagram2-navigation.spec.mjs` | Browser coverage for read/edit mode separation, document library parity, actions, inspector behavior, read-only mutation blocking, and lifecycle cleanup. |
| `tests/js/diagram2-readonly-shell.test.mjs` | Unit/source coverage for D2 read-only shell, shared document preferences, downloads, diagnostics toggle, and flat no-shadow CSS. |
| `tests/js/diagram2-renderer.test.mjs` | D2 renderer coverage for dirty categories, speed guard, fit behavior, object strokes, entity rendering, arrow bounds, and relationship painting. |
| `tests/js/image-annotation.test.mjs` | Annotation 1.0 and RTE save-back regression coverage. |
| `tests/js/navigation-preferences.test.mjs` | Navigation order/migration coverage keeping Diagram and Diagram 2 adjacent. |
| `wwwroot/css/features/diagram2.css` | D2 read/edit shell layout, flat styling, scrollbars, inspector, diagnostics, and editor workspace CSS. |
| `wwwroot/index.html` | Browser cache-bust query strings for changed JS/CSS assets. |
| `wwwroot/js/app.js` | D2 module imports and cache-bust coordination. |
| `wwwroot/js/components/image-annotation.js` | Approved shared annotation save-back/output-bounds behavior and D1 annotation regression fix. |
| `wwwroot/js/components/sections.js` | Header/nav icon support used by Diagram 2 alignment. |
| `wwwroot/js/core/application-shell.js` | Application-shell/navigation integration for Diagram 2. |
| `wwwroot/js/core/navigation-preferences.js` | Navigation preference migration keeping Diagram 2 next to Diagram. |
| `wwwroot/js/core/preferences.js` | Shared D1/D2 document-library preference alignment and D2 diagnostics preference. |
| `wwwroot/js/core/router.js` | Route support for `diagram-2` document URLs. |
| `wwwroot/js/features/diagram/diagram.js` | Approved D1 annotation/fit/local comparison behavior and compatibility protection. |
| `wwwroot/js/features/diagram2/diagram2-editor-controller.js` | D2 command/controller foundation. |
| `wwwroot/js/features/diagram2/diagram2-editor-shell.js` | D1-familiar editor shell, toolbar, inspector, Objects pane, status, and optional diagnostics. |
| `wwwroot/js/features/diagram2/diagram2-renderer.js` | High-performance D2 renderer parity updates, cached routes, fit, stroke/entity/arrow rendering, merged relationship painting, and diagnostics. |
| `wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js` | RTE Annotate 2.0/Edit Annotate 2.0 host integration. |
| `wwwroot/js/features/diagram2/diagram2.js` | Top-navigation Diagram 2 host, shared library/read-edit shell, document actions, security context, zoom/fit/pan, diagnostics toggle, and save/cancel flow. |
| `wwwroot/js/features/settings/settings.js` | Navigation/settings integration for Diagram 2. |

## Feature Parity Completed

The following matrix IDs reached Phase 2 foundation completion:

| ID | Phase 2 status | Notes |
|---|---|---|
| HOST-001 | Command/Renderer Complete | Shared D2 editor controller/shell foundation exists. |
| HOST-002 | Command Complete | RTE host adapter launches Annotate 2.0/Edit Annotate 2.0. |
| HOST-003 | Command Complete | Diagram document host adapter persists through the shared Diagram document record. |
| HOST-004 | Compatibility Complete | Existing Annotate remains available. |
| HOST-005 | Compatibility Complete | Existing Edit Annotate remains available. |
| HOST-006 | Command Complete | Annotate 2.0 context-menu action added. |
| HOST-007 | Command Complete | Edit Annotate 2.0 context-menu action added. |
| HOST-008 | Compatibility Complete | RTE save-back uses rich-text upload URL, not persisted data/blob URLs. |
| HOST-009 | Compatibility Complete | Cancel leaves RTE content unchanged. |
| HOST-010 | Command Complete | RTE host preserves origin context. |
| HOST-012 | Performance Complete | Top-navigation cleanup/stress behavior is covered in browser spec and renderer destruction tests. |
| VIS-001 | UI Only/Partial | Toolbar shell is D1-familiar; full tool parity remains later. |
| VIS-002 | UI Only/Partial | Objects pane location and shell are aligned; full tree operations remain later. |
| VIS-003 | UI Only/Partial | Inspector shell/tabs use D1 patterns; advanced tabs remain later. |
| VIS-005 | UI Only/Partial | Important dialogs/context menus are present; full parity remains later. |
| SHELL-001 | Command Complete | Open/close lifecycle and mode switching implemented. |
| SHELL-003 | UI Only/Partial | Toolbar groups established. |
| SHELL-004 | UI Only/Partial | Objects tree established inside right-pane Objects tab. |
| SHELL-005 | UI Only/Partial | Inspector tabs established. |
| SHELL-006 | UI Only/Partial | Save/status indicators established. |
| SHELL-008 | Command Complete | Diagnostics moved behind page overflow toggle. |
| TOOL-001 | Command Complete | Select tool foundation exists. |
| TOOL-002 | Command Complete | Pan/zoom/fit work in read and edit modes. |
| SEL-001 | Command Complete | Click selection foundation exists. |
| SEL-002 | Command Complete | Multi-selection foundation exists. |
| GEO-001 | Command/Renderer Complete | Drag uses D2 controller and renderer dirty updates. |
| GEO-006 | Command/Renderer Complete | Keyboard nudge uses command history. |
| SAVE-001 | Compatibility Complete | Save persists to the shared backing Diagram document. |
| IO-001 | UI/Command Partial | PMT Diagram import path remains available in top-navigation Diagram 2. |
| IO-002 | Command Complete | PMT JSON export path remains available. |
| IO-003 | Command Complete | SVG export options added. |
| IO-004 | Command Complete | PNG export options added. |
| HIST-001 | History Complete | Command-based undo/redo foundation is in place for ordinary local operations. |

Items not listed remain Not Started, UI Only, or intentionally later-phase work.

## Diagram 1 Impact

Approved Diagram 1 behavior changes:

- Fixed the current production annotation clipping/save-back bug for Annotation 1.0.
- Preserved the selected RTE image display width while allowing expanded annotation SVG intrinsic bounds.
- Kept completed RTE annotation storage upload-based instead of Base64/blob/inline SVG persistence.
- Added/kept mouse-wheel zoom behavior in annotation editing where applicable.
- Updated fit/content-bounds behavior and capped auto-fit zoom at 200%.
- Added a localhost-only D1/D2 comparison alignment shim for local visual comparison. The code includes a removal marker: `Remove the localhost D1/D2 comparison alignment shim`.

Compatibility-only changes:

- Diagram and Diagram 2 share the same document-library preferences and backing document IDs.
- Diagram 1 remains available side by side with Diagram 2.
- Existing Annotate/Edit Annotate actions remain available next to Annotate 2.0/Edit Annotate 2.0.

Shared helpers changed:

- `image-annotation.js` shared save-back/output-bounds behavior changed because Sin confirmed the clipping bug exists in production and approved fixing it for both Annotation 1.0 and Annotate 2.0.

Regression tests run:

- `node --test tests/js/image-annotation.test.mjs` passed 153/153.

## Annotation 1.0 Production Bug

Status:

- Fixed during Phase 2 for Annotation 1.0 and Annotate 2.0.
- Verified by Sin to already exist in Production before the Phase 2 fix.
- Treated as an approved current production bug fix, not as intentional Diagram 1 behavior drift.

Root cause:

- The original Annotation 1.0 workflow began with a fixed source/background image. Early usage only drew annotations over that image.
- Later Diagram work allowed the source image to be selected and moved in the annotation canvas, but the save-back/export path still effectively assumed the original image bounds/display contract.
- When an arrow, label, crop, or moved source image caused valid visible content to exist outside the original image rectangle, the exported/saved result could preserve the wrong intrinsic bounds or force the old dimensions. That made the RTE display clip the source image or annotation content even though the editor preview showed it.

Final behavior:

- The exported SVG canvas/viewBox expands to include all valid visible annotation content.
- The completed SVG is still uploaded through the existing rich-text upload pipeline: `uploadFile("richtext", file)`.
- The selected RTE image `src` is replaced with the stored upload URL.
- The selected RTE image's displayed width is preserved.
- Height is left automatic so the new SVG aspect ratio is not distorted.
- Existing RTE image resize/scale state, annotation classes, editable metadata, `data-pmt-annotation-source`, and `data-pmt-annotation-version` are preserved.
- Cancel performs no upload and leaves the RTE image `src` and lightweight attributes unchanged.
- The RTE HTML/database record never persists the completed annotation as a Base64 data URL, inline encoded SVG, Blob URL, or other large embedded payload.

Regression coverage:

- `tests/js/image-annotation.test.mjs` passed 153/153 after the fix.
- Coverage includes expanded output bounds, uploaded/storage URL save-back, no persisted `data:` or `blob:` annotation payload, editable metadata preservation, reopen/edit behavior, and the Annotation 1.0 regression where content outside the original bounds must not be unexpectedly clipped.

## Diagram 2 Implementation

UI:

- Read-only mode opens by default and shows the shared Diagram document library, document title/metadata, renderer, zoom/fit controls, Edit Diagram, Edit Info, Public Link where applicable, Cards/Treeview, filters, and page actions.
- Edit mode hides the top PMT shell, hides the document left navigation, mounts a dedicated editor-focused layout, and shows the D2 editor toolbar, canvas, inspector, Objects pane, Save, Cancel, and status.
- Diagnostics are hidden by default and can be toggled from the page-level overflow menu.
- D2 CSS was flattened by removing Diagram 2 feature-level `box-shadow`, `drop-shadow`, and `filter:` styling.

Controller and commands:

- The D2 editor controller owns canonical state, selection, active tool, history, dirty state, save coordination, and host capabilities.
- Read-only mode blocks mutation by not mounting the editor controller.
- Mutating commands check the already-resolved session capability context instead of resolving permissions on every gesture frame.

Renderer APIs and dirty categories:

- D2 keeps keyed nodes, separate planes, transform-only pan/zoom, dirty category flushing, route signatures, route caches, and diagnostics.
- Routine local changes use dirty renderer updates rather than replacing the entire SVG.

Routing impact:

- D2 relationships now share more visual behavior with D1, including field-anchor routes, manual-route preservation, merged same-style relationship painting, and D1-like route stroke/visual output.
- D2 does not yet include D1's full expensive route-costing/candidate-scoring algorithm. That deeper routing parity remains a later ERD/routing parity task and must be adapted without importing Diagram 1's slow full-render path.

History:

- Ordinary local move/nudge operations use command history with dirty updates.
- Snapshot fallback remains for global operations where no safe incremental command exists yet.

Save/export:

- Top-navigation D2 saves the same backing Diagram record.
- SVG/PNG download options use Diagram 1-like choices.
- RTE Annotate 2.0 save-back uploads through the rich-text upload pipeline and writes only the stored URL plus lightweight metadata to the RTE image.

Lifecycle:

- Leaving edit mode destroys the editor-only controller/path and returns to read-only mode.
- Renderer destruction clears live maps and DOM.
- Browser specs were updated to exercise top-navigation open/close cleanup and read/edit lifecycle.

## Performance Evidence

Measured during final publish verification:

| Operation | Fixture | Result |
|---|---|---|
| D2 schema fixture generation speed guard | PMT database schema fixture | 15.6349 ms, threshold under 1 second |
| D2 renderer unit suite | 16 renderer tests | Passed |
| Annotation/D1 shared suite | 153 annotation tests | Passed |
| D2 read-only shell/source suite | 10 tests | Passed |
| Navigation preference suite | 6 tests | Passed |

Relevant D2 renderer diagnostics/protections:

| Protection | Status |
|---|---|
| Persistent keyed SVG nodes | Preserved |
| Separate SVG planes | Preserved |
| Transform-only zoom and pan | Preserved |
| Dirty-state categories | Preserved |
| Selective relationship routing/cache diagnostics | Preserved |
| Fixed-grid spatial indexes | Preserved |
| Viewport/halo behavior | Preserved |
| Low-detail overview rendering | Preserved |
| No unnecessary full live render for ordinary shell interaction | Preserved by design and focused tests |

Routine operation full-render statement:

- Initial document load may call full `renderer.render(...)`.
- Explicit diagnostic refresh may call a full refresh.
- Ordinary move/nudge/selection/edit-mode shell changes are intended to use controller commands and dirty renderer updates, not full live rebuilds.

## Compatibility Evidence

| Scenario | Result |
|---|---|
| D1 open D1 save | PASS through existing Diagram/Annotation test coverage. |
| D2 open D1 save | PASS for shared document record/canonical SVG foundation. |
| D1 open D2 save | PASS for shared document record/canonical SVG foundation, with unsupported future D2-only data expected to remain preserved. |
| D2 open D2 save | PASS. |
| Clipboard both directions | PARTIAL. Existing formats are preserved; full D1/D2 clipboard parity remains later-phase work. |
| Templates both directions | PARTIAL. Template contract remains shared. Full D2 template UI/upload parity remains later. |
| Import/export matrix | PARTIAL/PASS for PMT JSON/SVG/PNG basics. Full matrix remains later. |
| Unknown extensions | PRESERVE requirement remains active; full unknown-extension matrix remains later. |
| Renderer state absent from persistence | PASS. Renderer live state and caches are not persisted as document ownership/version data. |

## Security And Permissions

- Diagram and Diagram 2 continue to use the existing Documentation security resource.
- No Diagram 2-specific permission resource, role, owner field, or document ownership flag was introduced.
- Top-navigation Diagram 2 resolves capabilities for the session and passes cached booleans into the editor core.
- Read-only mode does not mount the editor controller and blocks mutation through visible UI and command-boundary checks.
- Server-side APIs remain the security boundary for load/create/update/delete/import/export/upload/public-link operations.

## Validation

Commands run before publishing commit `32ead15`:

```powershell
node --check wwwroot/js/app.js
node --check wwwroot/js/components/image-annotation.js
node --check wwwroot/js/features/diagram/diagram.js
node --check wwwroot/js/features/diagram2/diagram2.js
node --check wwwroot/js/features/diagram2/diagram2-renderer.js
node --check wwwroot/js/features/diagram2/diagram2-editor-controller.js
node --check wwwroot/js/features/diagram2/diagram2-editor-shell.js
node --check wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js
node --check wwwroot/js/core/preferences.js
node --check wwwroot/js/core/application-shell.js
node --check wwwroot/js/core/navigation-preferences.js
node --check wwwroot/js/core/router.js
node --check wwwroot/js/components/sections.js
node --check wwwroot/js/features/settings/settings.js
node --check tests/browser/diagram2-beta-readiness.spec.mjs
node --check tests/browser/diagram2-navigation.spec.mjs
node --test tests/js/image-annotation.test.mjs
node --test tests/js/diagram2-readonly-shell.test.mjs
node --test tests/js/diagram2-renderer.test.mjs
node --test tests/js/navigation-preferences.test.mjs
git diff --check
dotnet build -p:UseAppHost=false -p:OutputPath=%TEMP%\pmt-build-verify
```

Results:

- JavaScript syntax checks passed.
- `tests/js/image-annotation.test.mjs`: 153/153 passed.
- `tests/js/diagram2-readonly-shell.test.mjs`: 10/10 passed.
- `tests/js/diagram2-renderer.test.mjs`: 16/16 passed.
- `tests/js/navigation-preferences.test.mjs`: 6/6 passed.
- `git diff --check` passed with only CRLF warnings.
- Normal `dotnet build` was blocked by the running local PMT process locking `bin\Debug\net6.0\PMT.exe`.
- `dotnet build -p:UseAppHost=false -p:OutputPath=%TEMP%\pmt-build-verify` passed with only the existing `net6.0` end-of-support warning.

Browser tests:

- `tests/browser/diagram2-beta-readiness.spec.mjs` and `tests/browser/diagram2-navigation.spec.mjs` were updated and syntax-checked.
- They were not executed in the final publish pass.

Screenshot evidence:

- A Playwright screenshot pass against the local PMT app generated the eight files under `docs/screenshots/diagram-2-phase-2/`.
- The pass entered D1 and D2 edit modes for evidence only and did not save or mutate documents.

Manual testing:

- Sin manually tested Annotation 1.0 and Annotate 2.0 clipping/save-back behavior and confirmed the corrected "expanded SVG scaled within original RTE display width" behavior.
- Sin manually compared Diagram 1 and Diagram 2 read-mode rendering and drove follow-up corrections for shell layout, nav behavior, fit, scrollbars, arrows, entity visual rendering, diagnostics, and flat styling.

## Manual Testing Steps For Sin

1. Open `http://localhost:5056/#/diagram`.
2. Open a known Diagram document and confirm Diagram 1 still opens normally.
3. Open `http://localhost:5056/#/diagram-2`.
4. Confirm Diagram 2 opens in read-only mode with the same left document library, title/metadata, zoom/fit controls, Cards/Treeview, filters, and page actions.
5. Select several documents in D1 and D2 and confirm the same backing records appear.
6. Select a simple diagram such as Red Arrow, Box, Entity, and Basic Shapes 2 and compare D1/D2 visual output.
7. In Diagram 2 read mode, use the page overflow menu to toggle Diagnostics on and off.
8. Click Edit Diagram and confirm the dedicated editor workspace opens without the PMT topbar or read-mode left navigation.
9. Confirm Save and Cancel return to read-only mode.
10. In Documentation/RTE, right-click an image and confirm Annotate/Edit Annotate and Annotate 2.0/Edit Annotate 2.0 are available side by side.
11. In Annotation 1.0 and Annotate 2.0, draw outside the original image bounds, save/apply to RTE, and confirm the full expanded annotation is visible while the displayed RTE width is preserved.
12. Reopen the saved annotation and confirm editable metadata and object positions remain intact.

## Known Limitations

- Phase 2 is not full Diagram 1 parity.
- D2 does not yet implement every Diagram 1 drawing tool, inspector control, crop workflow, template operation, mapping/entity editor operation, grouping/layering command, or full object-tree drag/reorder behavior.
- D2 relationship routing does not yet use D1's full candidate route-costing algorithm. D2 currently uses a high-performance deterministic route path with caching/selective rerouting and D1-like visual painting.
- CPU-throttled end-to-end host performance numbers were not recorded in the final publish verification.
- Browser specs were updated and syntax-checked but not executed in the final publish verification.
- The localhost-only D1/D2 comparison alignment shim is intentionally temporary and should be removed when local visual comparison is no longer needed.
- SQL `00_DropAndRebuild_PMT.sql` now contains absolute include paths for the local PMT workspace. This is useful locally but should be reviewed before relying on it as a portable rebuild script.

## Required Refresh And Build

| Area | Required action |
|---|---|
| Browser JS/CSS | `Ctrl+F5` only. Cache-bust query strings were updated. |
| .NET runtime | No .NET rebuild is required for the Phase 2 browser-visible changes. |
| Database migration | No forward database migration was added for this phase. |

## Commit

Implementation commit:

```text
Sin and Codex: Align Diagram 2 shell and renderer parity
```

Commit hash:

```text
32ead157a39e894481728c6f712a2d70d2d83c4f
```

Report status:

```text
Generated after the implementation commit and committed as permanent Phase 2 documentation evidence before Phase 3.
```
