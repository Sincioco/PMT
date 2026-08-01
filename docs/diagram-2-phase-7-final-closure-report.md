# Diagram 2 Phase 7 Final Closure Report

Date: August 2, 2026
Observed branch: `main` tracking `origin/main`
Observed starting SHA: `cc3b6fff9f3456868f0d409a564a80273f565398`
Final SHA before Sin's manual acceptance: `cc3b6fff9f3456868f0d409a564a80273f565398`
Version 1.27 Diagram 1 export oracle: `60e6027b4f0b743858ffd3eb8e6b6dc3a036a0bb`

## Outcome

**Phase completed:** Phase 7 — Save, Import, Export, Round-trip, Dialog, Keyboard, Accessibility, and UX parity closure.

**Expected outcome status:** Automated closure is complete and the result is ready for Sin's manual testing. No current evidence counters Sin's assessment that Diagram 2 is production-ready to replace Diagram 1. Final manual acceptance of the Phase 7 changes is still pending, so this report does not authorize a commit, deployment, or Phase 8.

The audit-first amendment was followed: working Diagram 2 behavior was preserved, production code changed only for reproduced gaps, and Diagram 1 was treated as the authority only for the Version 1.27 PMT Diagram export contract and the Diagram 1-to-Diagram 2 transition.

The worktree was clean at the start. Nothing has been staged or committed. `HEAD` therefore remains the observed starting SHA.

## Completion thresholds

The completed automated evidence reports the required zero counts:

| Threshold | Result | Evidence basis |
|---|---:|---|
| Dead visible controls | 0 | Document workflows, dialog actions, tree/menu keyboard actions, import/export, and Phase 6 controls were exercised. |
| Unexplained D1/D2 workflow differences | 0 | D2 remains authoritative for its newer UX; the intentional unpinned workflow and D1/D2 public-viewer distinction are documented. |
| Canonical round-trip mismatches | 0 | Version 1.27 physical transition: 88 objects, 29 Entities, zero normalized mismatches. Shared reader-neutral matrices cover the remaining codec lanes. |
| Unsupported future imports accepted | 0 | Version 2 and invalid/malformed minimum-reader versions are rejected; the same minimum-reader rule now protects selection clipboard packages. |
| Unknown extensions lost | 0 | Opaque file and Diagram extension bags survive import, backing SVG persistence, reopen, save, and re-export. |
| Incomplete full-detail exports | 0 | Export is built from complete canonical state, including while the live renderer is virtualized and has transient view state. |
| Silent stale-row overwrite defects | 0 | A stale save returns the conflict-choice workflow; Keep Editing, Reload Latest, failed reload, and Save a Copy preserve the appropriate local/server state. |
| Keyboard commands firing while typing | 0 | Form, rich-text, buttons, tree items, tabs, and other interactive controls suppress canvas shortcuts in both document and RTE hosts. |
| Focus-loss regressions | 0 | Dialog, dual-host tree, menu, route, Crop, mapping, and RTE focus restoration tests pass; pinned mapping state survives local dirty flushes. |
| Routine-operation full-render regressions | 0 | Focused interaction diagnostics report zero routine full-render deltas. |
| Unrelated relationship reroutes | 0 | Crop, mapping, focus, save, and local interaction diagnostics report zero unrelated reroutes. |
| Renderer/resource lifecycle leaks | 0 | Repeated RTE close and Scrum linked-viewer refresh cycles return to one live instance and release replaced resources. |

These are automated closure results, not a substitute for Sin's pending manual approval.

## Requirements already complete at the start

The pre-implementation audit found the following current Diagram 2 behavior complete and protected:

- Shared Diagram backing records, Documentation permissions, direct routes, read/edit separation, New Diagram, default `Untitled N` naming, and native Diagram 2 public links.
- Canonical-state save and fresh full-detail SVG construction independent of mounted DOM.
- Existing no-silent-overwrite row-version behavior and Save a Copy handling.
- Complete SVG/PNG, clipboard, Copy as SVG, Copy as PNG, template, and mapping-table export foundations.
- Diagram 1/Diagram 2 reader-neutral file, clipboard, template, and saved-SVG contracts.
- The four RTE cross-version authoring/editing lanes, same-image update, Cancel behavior, focus restoration, and normal lifecycle cleanup.
- Keyed incremental rendering, command history, selective routing, virtualization, low-detail rendering, and canonical-state authority.
- Link Diagram 2, mixed D1/D2 linked blocks, native D2 read-only rendering, and Scrum refresh/disposal behavior.

No broad reimplementation of these features was performed.

## Actual gaps reproduced and fixed

| Reproduced gap | Smallest compatible correction | Evidence |
|---|---|---|
| Save could read canonical state before an active pointer gesture committed. | Added one shared `finishActiveGesture` interaction-host boundary and await it before document save. | Physical move-during-save regression plus shared gesture-host tests. |
| Conflict handling lacked an explicit reload choice. | Added named Keep Editing, Reload Latest, and Save a Copy choices; injected the existing application reload path. | Browser conflict-choice and stale-state reload tests. |
| D2 import normalized missing and duplicate object IDs instead of rejecting them. | Validate raw PMT state before normalization and require explicit safe, unique IDs. | Focused malformed-import unit and physical UI tests. |
| Broken internal groups, annotation ownership, image/mapping references, relationship sources, and local Entity references could pass import. | Added renderer-neutral internal-reference validation while allowing legitimate external database FK targets and syntactically valid remote assets. | Contract validation matrix. |
| Opaque PMT file/Diagram extensions were lost after D2 import and backing save. | Carry optional opaque extensions with canonical metadata and use them on implicit save/export. | Import → backing SVG → reopen → save → export assertions. |
| D2 PMT JSON export retained URL-backed images instead of using D1's portable conversion. | Reused the unchanged shared portable-state builder for D2 PMT export. | Portability regression and unchanged ordinary D1 byte-contract test. |
| Import and Duplicate could leave the URL/selection on the previous Diagram ID. | Route and select the newly created backing record after successful creation. | Physical import and duplicate document tests. |
| RTE Escape/Cancel could destroy the host while Apply was pending. | Added one busy guard and disabled Close/Cancel until Apply resolves; restore controls after an error. | Delayed-Apply browser regression. |
| Canvas shortcuts could leak from handled controls, tree items, tabs, and role-based controls. | Respect `defaultPrevented` and isolate editor shortcuts from interactive targets. | Top-navigation and RTE no-mutation tests. |
| Objects-tree rows were mouse-only and delegated listeners could be rebound. | Added one delegated keyboard/listener path with arrows, Home/End, Enter/Space, F2, and Delete/Backspace. | Keyboard navigation and repeated-refresh single-action coverage. |
| Keyboard context-menu invocation and origin-focus restoration were incomplete. | Added ContextMenu/Shift+F10, menu Home/End, close cleanup, and focus restoration. | Canvas/tree menu browser assertions. |
| Mapping and Crop keyed reconciliation could lose focus and lacked complete pressed/slider semantics. | Restore equivalent focused nodes, publish mapping `aria-pressed`, and publish Crop slider orientation/min/max/now/value text. | Consecutive-key and accessibility assertions. |
| Dynamic dialogs lacked names, linked validation, and disabled explanations. | Added accessible dialog names, `aria-describedby`/`aria-invalid`, focused validation, and concise disabled-state descriptions. | Accessibility-focused browser and shell tests. |
| A post-render status refresh could rebuild identical Entity field rows and erase a newly typed field-name draft. | Made Entity field-row HTML synchronization idempotent so identical rows are not replaced. | Deterministic RTE field-name draft/focus regression at both viewports. |

### Final validation regressions closed

The final broad validation exposed seven additional narrow regressions. Each was fixed locally and retained in the final green suites:

| Late regression | Correction | Final evidence |
|---|---|---|
| PMT Diagram files with an explicitly invalid `minimumReaderVersion` could bypass the future-reader guard. | Require an integer minimum reader from 1 through the current PMT file reader version. | Current PMT contract test rejects zero, negative, fractional, nonnumeric, and future reader values. |
| Selection clipboard packages had the same invalid minimum-reader acceptance edge. | Apply the same strict integer reader-version rule to `pmt-diagram-selection` v1. | Clipboard contract assertions reject malformed and future reader values. |
| A failed Reload Latest request could replace the application with the generic database-not-ready view and hide the dirty local editor. | Added a scoped `preserveViewOnError` application-shell reload option for conflict resolution. | Unit and physical browser regressions prove the editor, local object state, and dirty status remain open. |
| Two rapid document Save requests could both pass preflight while active-gesture/Crop settling was still awaiting. | Recheck the document busy/controller state at each asynchronous preflight boundary so Save is single-flight. | Physical delayed-save regression records exactly one update. |
| RTE Ctrl+S/Apply could read state before an active pointer gesture committed. | Retain the RTE interaction host and await its shared `finishActiveGesture` boundary before setting Apply busy state. | Physical RTE pointer-move → Ctrl+S regression saves the moved coordinates. |
| Objects-tree keyboard handling was complete in the document host but not the RTE host. | Added the same delegated arrows, Home/End, Enter/Space, F2, Delete/Backspace, and focus-restoration behavior to the RTE tree. | Dual-host keyboard and shortcut-isolation coverage passes. |
| A local dirty flush could clear a pinned mapping row's visual highlight and `aria-pressed` state. | Reapply the existing pinned/hover mapping interaction after the local renderer patch. | Physical style-edit regression retains the pinned row and pressed UI cell with zero routine full render. |

## Files changed

### Production changes

Substantive behavior changes are limited to:

- `Endpoints/ContentEndpoints.cs`
- `wwwroot/js/app.js`
- `wwwroot/js/components/image-annotation.js`
- `wwwroot/js/core/application-shell.js`
- `wwwroot/js/shared/diagram-contracts.js`
- `wwwroot/js/features/diagram2/diagram2.js`
- `wwwroot/js/features/diagram2/diagram2-editor-interactions.js`
- `wwwroot/js/features/diagram2/diagram2-editor-shell.js`
- `wwwroot/js/features/diagram2/diagram2-renderer.js`
- `wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js`

`wwwroot/index.html` and the affected browser-module import graph carry the coordinated cache token `20260802-diagram2-phase7-roundtrip-v1`. A final static import-graph audit found 35 affected JavaScript modules, 0 stale affected edges, and 0 stale browser/server entries. `Endpoints/ContentEndpoints.cs` applies that same token to the public Link Diagram 2 module URL emitted by server-generated Documentation output. Its C# change is cache-token wiring only. The remaining small production diffs are query-token propagation; no extra framework, dependency, database object, API endpoint, document type, clipboard format, template library, or PMT file version was added.

### Test changes

- Added `tests/browser/diagram2-phase7-import-export.spec.mjs`.
- Extended `tests/browser/diagram2-navigation.spec.mjs`.
- Extended `tests/browser/diagram2-phase6.spec.mjs`.
- Extended `tests/browser/diagram2-rte-annotation.spec.mjs`.
- Extended `tests/js/diagram-contracts.test.mjs`.
- Extended `tests/js/diagram2-compatibility.test.mjs`.
- Extended `tests/js/diagram2-readonly-shell.test.mjs`.
- Updated `tests/js/rte-link-diagram2.test.mjs` for the coordinated public-viewer cache token.

### Documentation and evidence changes

- Added `docs/diagram-2-phase-7-current-state-audit.md` before production edits.
- Updated `docs/diagram-2-editor-parity-matrix.md` with Phase 7 evidence. Its `Baseline Manual Approved` labels refer to Sin's extensive testing of the already-working Diagram 2 UX; they do not mean Sin has accepted the new Phase 7 patch.
- Added this final closure report.
- Added permanent Phase 7 screenshots:
  - `docs/screenshots/diagram-2-phase-7/diagram2-phase7-d1-import-1366x768.png`
  - `docs/screenshots/diagram-2-phase-7/diagram2-phase7-d1-import-1920x1080.png`
- Required browser reruns regenerated 26 existing tracked Phase 3-6 and Link Diagram evidence PNGs, plus the 2 new Phase 7 PNGs listed above. They remain visible, uncommitted test-output changes for review; they are not new product artwork.

## Diagram 1 behavior

**Diagram 1 behavior changed:** No intended Diagram 1 export behavior changed.

The current `exportPmtDiagram`, portable-state builder, export normalizer, and shared PMT v1 codec matched the Version 1.27 oracle after line-ending normalization at audit start. The frozen Version 1.27 schema SVG was the same Git blob. A final direct extraction also confirmed the current 837-character `exportPmtDiagram` function is text-identical to the Version 1.27 oracle. Phase 7 did not edit that Diagram 1 implementation or its portable builder.

The shared annotation normalizer now preserves an optional opaque extension carrier so D2 does not discard future metadata. A byte-level regression proves ordinary Version 1.27 D1 exports without extensions remain byte-identical. D1 feature-module diffs outside that shared compatibility seam are coordinated cache-query changes only.

## Diagram 2 user-visible behavior added

- Import rejects malformed identity/reference structures and future formats with clear feedback instead of creating a backing record.
- Successful Import and Duplicate select and route directly to their new Diagram record.
- Document Save and RTE Apply resolve the active editor gesture before reading canonical state; document Save is single-flight across asynchronous preflight.
- Stale Save offers Keep Editing, Reload Latest, and Save a Copy without silently replacing either local or server work; a failed reload leaves the dirty editor visible.
- Objects-tree and context-menu workflows are keyboard operable in both hosts and restore focus.
- Crop and mapping controls retain focus across keyed reconciliation and expose state to assistive technology.
- Pinned mapping attention and pressed state remain intact through a local style/dirty flush.
- Dialogs have stable accessible names, validation associations, and disabled-state explanations.
- RTE Apply cannot be cancelled while the asynchronous update is pending.

## Shared contracts affected

- The PMT Diagram contract remains `pmt-diagram` version 1.
- Raw imported state is validated before normalization.
- PMT file and selection clipboard `minimumReaderVersion` values must be valid supported integers; malformed, lower-than-one, and future reader requirements are rejected.
- Opaque `extensions` remain optional and reader-neutral.
- Backing SVG metadata carries the extension bags so a later D1/D2 reopen and export can preserve them.
- D2 PMT export uses the existing shared portable-image conversion.
- Existing endpoints, JSON request shapes, local-storage keys, template/clipboard versions, and row-version service behavior remain unchanged.

## Document workflow results

| Workflow | Result | Evidence type |
|---|---|---|
| New Diagram / `Untitled N` / backing creation | Pass; creates one private, unpinned shared Diagram record and enters Edit. | Existing physical browser coverage. |
| Edit Info: title, Project, Sprint, Parent, privacy | Pass; writes the same record and preserves metadata on reopen. | Physical browser coverage. |
| Pinning | Current Diagram workflow remains intentionally unpinned; no new pin control was invented. | Shared writer contract and approved newer behavior. |
| Duplicate | Pass; creates/selects/routes to a new record with compatible canonical content and metadata. | Physical browser coverage. |
| Delete / confirmation | Pass; deletes only after confirmation and selects a remaining document. | Physical browser coverage. |
| Card / TreeNav selection | Pass; selection, route, viewer, and card/tree state remain synchronized. | Physical browser coverage. |
| Read/Edit/permissions | Pass; Documentation ownership rules and mutation gates remain in force. | Existing physical and unit coverage. |
| Public link | Pass; D1 retains its viewer and D2 retains `/public/diagram-2/{token}` with the native read-only renderer. | Existing physical browser coverage. |

No second backing record type or service was introduced.

## Save and conflict results

- Save waits for the active interaction host, settles renderer work, validates normalized canonical state, builds a fresh full-detail SVG, writes through the existing service, and uses the expected row version.
- Busy/controller state is checked before and after asynchronous gesture/Crop preflight, so rapid Save input produces one request.
- Persisted state excludes selection, hover, mapping attention, Crop overlays, preview transforms, route caches, dirty sets, viewport sectors, renderer indexes/diagnostics, pane state/width, and low-detail DOM.
- Physical document move-and-Save and RTE move-and-Ctrl+S races prove gestures commit before serialization. Resize, route, and Crop use the same `finishActiveGesture` ownership mechanism and retain their existing individual gesture tests; each was not repeated as a separate physical Ctrl+S race.
- Conflict coverage physically exercises a mocked stale-row response and all three user choices. Row-version service tests supply the server-contract evidence. The browser test is not a literal pair of independently open live browser contexts, so the two-tab live-database check remains in the manual steps.
- Keep Editing retains dirty local state. Reload Latest replaces it only after the explicit choice and adopts the latest server row version. Save a Copy preserves the original and creates the next numbered title.
- If Reload Latest itself fails, the application reports the error but preserves the open editor, dirty flag, and local canonical state.

## Import results

- Valid PMT Diagram v1: accepted once, fully normalized, and created as one new backing Diagram.
- Invalid JSON, empty file, wrong root, and invalid `minimumReaderVersion`: rejected without a record or upload.
- Missing IDs and duplicate IDs: rejected with indexed validation errors.
- Broken internal group, annotation, image, mapping, relationship, and local Entity references: rejected.
- Legitimate external Entity FK schema/table targets: accepted.
- Syntactically valid missing remote assets: accepted without canonical corruption and displayed with the existing `Image unavailable` fallback.
- Unknown file/Diagram extension properties: retained through import, backing save/reopen, and export.
- Unsupported future version: rejected without a record or upload.
- Large valid import: 1,000 objects validated and normalized once; observed focused timing was approximately 8.3 ms and the full focused test process reported approximately 14.3 ms, well below the 1,000 ms cold-path gate.

Import remains a deliberate global document operation. Normal screen load does not repeatedly parse or rebuild the PMT file.

## Export results

- PMT Diagram JSON uses complete portable canonical state and a fresh SVG.
- URL-backed image state is converted through the existing portable-image helper.
- Complete SVG/PNG and Copy as SVG/PNG continue to use off-screen full-detail output rather than mounted renderer DOM.
- Selection clipboard and templates continue to use their existing shared v1 formats and reference remapping.
- Visibility, relationship, and mapping export options retain their established semantics.
- The physical Phase 7 test pans/virtualizes the live renderer, sets transient selection, and hides mapping display options before export. Mounted objects are fewer than canonical objects, but the exported schema still contains all 88 objects and 29 Entities with zero canonical mismatch.

Evidence is intentionally described precisely: the Phase 7 physical test combines virtualization/transient state with PMT export, while existing low-detail renderer and off-screen exporter tests supply SVG/PNG detail evidence. There is no single synthetic browser lane that holds a Crop pointer preview open while exercising every export type.

## D1/D2 round-trip matrix

| Lane | Result | Evidence type |
|---|---|---|
| D1 save/open → D1 open | Pass for the protected Version 1.27 schema/export contract. | Frozen production oracle, unchanged D1 writer/reader code, byte-contract and reader tests. |
| D1 save/export → D2 open | Pass. | Physical D1 page Export → D2 UI Import using the 88-object/29-Entity production schema. |
| D2 save → D2 open | Pass. | Physical edit/save/close/reopen on the imported backing record and existing same-record browser coverage. |
| D2 save → D1 open | Pass. | Physical D2 save followed by D1 open of the same backing record. |
| D1 edit/export → D2 save → D1 open | Pass. | Physical Phase 7 priority transition, including D2 edit/save/re-export. |
| D2 edit → D1 save → D2 open | Pass at the shared-contract level. | Reader-neutral codec, frozen/mixed fixtures, and existing D1/D2 save/reopen paths; not a dedicated literal three-screen physical lane in this pass. |

Normalized result for the physical Version 1.27 priority path: **88 objects, 29 Entities, 0 mismatches**. Opaque extension bags also survive. Not every six-lane permutation for every object type was driven independently through the UI; the remaining lanes use the same codec/backing service and are supported by shared-contract fixtures plus the physical endpoints above.

## RTE round-trip matrix

| Lane | Result | Evidence type |
|---|---|---|
| Annotate → Edit Annotate | Pass | Physical UI |
| Annotate → Edit Annotation 2.0 | Pass | Physical UI |
| Annotate 2.0 → Edit Annotation 2.0 | Pass | Physical UI |
| Annotate 2.0 → Edit Annotate | Pass | Physical UI |

The physical matrix includes shapes, Rich Text, Crop, Entity, relationship/manual-route metadata, Entity annotation, Field Rectangle, many-to-one mapping, and Mapping Table metadata. Save updates the same RTE image, Cancel leaves RTE HTML unchanged, focus/selection restore, no standalone Diagram record is created, transient UI is excluded, and the renderer/controller are destroyed.

RTE Ctrl+S/Apply now also has a physical active-pointer-move race: the committed coordinates are present in the uploaded payload before the host closes.

## Clipboard and template matrix

| Lane | Result | Evidence type |
|---|---|---|
| RTE Annotation 2.0 copy → Diagram 2 paste | Pass | Shared v1 remap tests plus physical use of the same clipboard command in each host. |
| Diagram 2 copy → RTE Annotation 2.0 paste | Pass | Shared v1 remap tests plus physical use of the same clipboard command in each host. |
| D1 copy → D2 paste | Pass | D1/D2 shared-package unit and browser regression evidence. |
| D2 copy → D1 paste | Pass | D1/D2 shared-package unit and browser regression evidence. |
| Diagram template → RTE apply | Pass | Shared endpoint/codec and separate physical template use in both hosts. |
| RTE template → Diagram apply | Pass | Shared endpoint/codec and separate physical template use in both hosts. |

ID/reference remapping covers objects, groups, relationships, manual routes, owner references, image references, Field Rectangles, mappings, and Mapping Tables as one paste history command. This is composed shared-codec/host evidence; the six cross-host lanes were not each performed as literal clipboard/template transfers in one physical Playwright test.

Selection clipboard parsing also rejects malformed or future minimum-reader requirements before any paste command is created.

## Dialog results

- Entity, Relationship, route, Templates, Import/Export, text/color, Crop, Field Mapping, confirmations, Edit Info, public-link, Save As, unsaved-change, and save-conflict surfaces remain available where applicable.
- Six generated editor dialogs and the RTE host expose stable accessible names.
- Validation sets associated description/error state, focuses the invalid control, and clears state after correction.
- Initial focus, Enter/Escape ownership, focus restoration, cleanup, and no-duplicate-listener behavior have focused coverage.
- The RTE host blocks native, keyboard, and programmatic cancel while Apply is pending.

## Keyboard results

- Undo/Redo, Copy/Paste, Duplicate, Delete, Select All, arrow/modified nudge, Group/Ungroup, tool shortcuts, Entity, Escape, Enter, zoom, relationship-handle nudge, mapping activation, Crop adjustment, and keyboard context-menu invocation retain their current shared command paths.
- The document and RTE Objects trees support arrows, Home/End, Enter/Space, F2, Delete, and Backspace through delegated handlers with equivalent focus restoration.
- `defaultPrevented` and interactive/form/rich-text/tree/tab targets prevent unintended canvas commands while typing or operating controls.
- Keyed reconciliation retains or transfers focus for route handles, mapping cells, Crop sliders, and Entity field editing.

## Context-menu results

- Editor canvas/object/relationship and Objects-tree menus support pointer and keyboard opening.
- ContextMenu/Shift+F10, arrow navigation, Home/End, Escape, action close, and origin-focus restoration pass focused browser coverage.
- Read-only Diagram and Link Diagram 2 menus retain their existing visibility, copy, download, and mapping actions.
- No broad context-menu redesign or replacement command system was introduced.

## Accessibility results

- Toolbar labels and pressed states, tree selection semantics, mapping pressed state, Crop slider values, inspector/form labels, dialog names, validation associations, disabled reasons, visible focus, and read-only/edit distinctions have focused coverage.
- Focus survives keyed renderer/shell reconciliation and virtualization in the covered route, mapping, Crop, tree, and field-edit paths.
- A pinned mapping cell retains both its visual highlight and `aria-pressed="true"` after a local Mapping Table style patch.
- Existing CSS focus and selection indicators were preserved; no CSS change was required.
- This was focused product accessibility verification, not a WCAG or other standards certification.

## Link Diagram 2 results

Link Diagram 2 remained protected and was not redesigned. Focused physical coverage verifies the toolbar/picker, D2 read-only renderer, original D1 Link Diagram behavior, mixed linked content, tabs, pan/zoom, fit, resize/maximize, Field Mapping interaction, save/reopen/hydration, Scrum five-second refresh, and explicit renderer disposal.

At 1366×768, the linked D2 fixture used 96 Entities/257 relationships: interactive settle 250.1 ms, zoom p95 21.3 ms, pan p95 7.3 ms, fit 11.5 ms, tab switch 213.4 ms, trace response 0.3/0.6 ms, routine full-render delta 0, and unrelated reroutes 0.

At 1920×1080: interactive settle 243.7 ms, zoom p95 19.5 ms, pan p95 7.3 ms, fit 8.9 ms, tab switch 207.1 ms, trace response 0.4/0.6 ms, routine full-render delta 0, and unrelated reroutes 0.

The Scrum soak completed 12 refresh cycles at both viewports. Each run recorded 17 renderer creates, 16 destroys, 1 live renderer, and 16 resource releases: zero lifecycle leak.

## Performance measurements

### Before measurements

- The audit baseline retained Diagram 2's keyed, incremental, virtualized renderer and command history.
- The Version 1.27 schema codec baseline was 88 objects, 29 Entities, and zero normalized mismatches.
- No Phase 7 hot-path full-render or broad-routing regression was present before implementation.
- The reproduced gaps were cold persistence/import paths and localized UX ownership/focus paths, not a reason to replace the renderer architecture.

### After measurements

Dedicated Compact parity remained exact:

| Fixture | D1 | D2 inline | D2 worker | Position mismatches | Automatic-route mismatches | Full renders |
|---|---:|---:|---:|---:|---:|---:|
| 29 Entities / 78 relationships | 1,343.54 ms | 1,423.52 ms | 1,535.69 ms | 0 | 0 | 0 |
| 96 Entities / 257 relationships | 5,207.46 ms | 5,372.11 ms | 5,308.06 ms | 0 | 0 | 0 |
| 232 Entities / 624 relationships | 10,285.32 ms | 10,375.08 ms | 10,341.66 ms | 0 | 0 | 0 |
| 500 Entities / 160 relationships | 15,754.46 ms | 16,498.12 ms | 13,149.01 ms | 0 | 0 | 0 |

Locked manual-route mutations, unresolved route contacts, Entity overlaps, and full-render counts were all zero in the reported fixtures. The 1,000-Entity cancellation case started and terminated its worker with complete cleanup and zero mismatches.

These are Phase 7 compatibility/regression measurements. Phase 8 still owns sustained 500/1,000-Entity promotion budgets; these numbers are not presented as Phase 8 completion.

## Full-render, routing, DOM, and mounted-node impact

- **Performance architecture preserved:** Yes. No editor-core replacement, whole-SVG live rebuild, snapshot-history expansion, or pointer hot-path scan was added.
- **Full-render count impact:** 0 for routine interactions covered by Phase 7, including pinned mapping retention after a local style flush; deliberate initial open/import remain allowed cold paths.
- **Routing impact:** 0 unrelated relationship reroutes in Crop, mapping, export-view, focus, linked-viewer, and local interaction diagnostics.
- **DOM/mounted-node impact:** The physical export lane proved `mountedObjectCount < canonicalObjectCount` while the output retained all 88 canonical objects. Entity field rows now avoid identical `innerHTML` replacement, reducing unnecessary DOM churn and preventing draft/focus loss.
- **Dirty/patch impact:** Crop evidence remained one history command, one image patch, one Crop-overlay patch, zero unrelated object patches, zero reroutes, zero full renders, and zero repeated decodes. Mapping attention is reapplied within the existing local patch without a global render or unrelated route work.
- **Operation placement:** Validation, portability conversion, and fresh full-detail SVG generation remain save/import/export cold-path work, outside pointer movement.

## History and undo behavior

- Routine changes remain command/delta based, one user gesture per history entry.
- The shared active-gesture boundary commits the current gesture before save without adding a second history entry.
- Import-as-new-document follows the existing D1/D2 document workflow and is a backing-record boundary, not an editor Undo entry.
- Clipboard paste and template application remain one history command with ID/reference remapping.
- Reload Latest is an explicit global document replacement after user choice; Keep Editing and a failed reload preserve local command history/state; Save a Copy creates a new document boundary.
- Permanent Crop retains its established irreversible history-clear behavior.

## Lifecycle results

- RTE Cancel/close across ten cycles destroys the active renderer/controller and leaves no stale dialog or listener.
- Delegated document-tree listeners bind once rather than on every pane refresh, and the RTE tree uses its host-scoped abortable delegation.
- Pending RTE Apply owns its host until completion, preventing a late async result from targeting a destroyed dialog.
- Scrum linked-viewer soak completed 12 refresh cycles at both viewports with 17 creates, 16 destroys, 1 live renderer, and 16 resource releases per run.
- No renderer/resource lifecycle leak was reported.

## Automated tests

**Compatibility tests:** The physical Version 1.27 D1 Export → D2 Import/Save/Reopen/Export → D1 Open lane, reader-neutral PMT/clipboard/template contracts, all four physical RTE lanes, original Link Diagram, Link Diagram 2, and Scrum linked-viewer refresh all passed in the evidence described above.

| Command/scope | Result | Duration / projects | Notes |
|---|---|---|---|
| `npm run check:js` | 196 modules checked; 0 failures | 7.2 s command wall time | Includes the changed production graph. |
| Full `npm run test:js` | 492 passed, 0 failed, 0 skipped | 205,916.576 ms reported by the runner | Current full JavaScript suite, including strict reader-version, failed-reload, and RTE active-gesture regressions. |
| `node --test tests/js/diagram-contracts.test.mjs` | 15 passed, 0 failed, 0 skipped | Included in the final full JavaScript evidence | Current parser/codec contract, including empty/invalid/wrong-root and minimum-reader handling. |
| `node --test tests/js/diagram2-compact-parity.test.mjs` | 29 passed, 0 failed, 0 skipped | 205,505.2735 ms | D1/inline/worker exactness plus clean 1,000-Entity cancellation. |
| Final broad Playwright matrix: navigation, Phase 6, Phase 7 import/export, RTE annotation, D1 image annotation, Documentation | 88 passed, 0 failed, 6 skipped | 4.1 min; `chromium-1366`, `chromium-1920` | Six skips are intentional opposite-viewport gates. This is a focused Phase 7 matrix, not the repository's entire Playwright suite. |
| Focused late-regression blocker matrix | 10 passed, 0 failed, 0 skipped | 30.1 s | Covers failed reload, Save preflight, RTE active gesture, dual-host keyboard, and related closure blockers. |
| Focused mapping keyed-identity regression | 2 passed, 0 failed, 0 skipped | 11.9 s | Confirms pinned mapping identity/attention survives the local patch at both viewports. |
| Focused PMT smoke: original Link Diagram/Link Diagram 2 and Scrum refresh | 4 passed, 0 failed, 0 skipped | 37.2 s; `chromium-1366`, `chromium-1920` | Includes linked-viewer performance and lifecycle diagnostics. |
| `.NET` build, `--no-restore`, temporary output | 0 errors, 1 warning | 0.81 s | The only warning is existing `NETSDK1138`: .NET 6 is out of support. The C# cache-token change compiled successfully. |

The final in-app live smoke opened current local Diagram 2 record `#/diagram-2/29`, entered Edit with a clean `Saved` state, returned to read-only without saving, and recorded zero browser-console errors.

`git diff --check` passes with line-ending conversion warnings only and no whitespace error. The final browser-test race hardening consists only of readiness/visibility waits that make Playwright observe the intended UI boundary; it does not represent or mask a product defect. No About 3D flyby test was run because that screen was not changed.

## Manual test steps

The following manual pass is the final Phase 7 acceptance gate:

1. Rebuild and restart the .NET application, then press `Ctrl+F5`. Open the Version 1.27 PMT schema in Diagram 1 and export the PMT Diagram JSON.
2. Import that exact file in Diagram 2. Confirm the new record is selected automatically, shows the complete schema, and remains responsive in read/edit mode.
3. Make a harmless D2 edit, Save, Close, reopen in D2, export again, and open the same backing record/export in D1. Confirm the 88 objects, 29 Entities, relationships/routes, images, Crop, annotations, Field Rectangles, mappings, and Mapping Tables are intact.
4. Try an empty file, invalid JSON, wrong root, duplicate object ID, future version, and invalid `minimumReaderVersion`. Confirm each is rejected clearly and creates no record/upload. If testing selection packages directly, confirm the same reader-version rule prevents paste.
5. Import a file with a syntactically valid unavailable image URL. Confirm the document opens, shows `Image unavailable`, saves, and reopens without losing canonical state.
6. In two browser tabs, edit the same Diagram. Save tab A, then save stale tab B. Check Keep Editing, Reload Latest followed by a normal save retry, and Save a Copy. Also force one Reload Latest failure and confirm the dirty local editor remains visible. Confirm no silent overwrite and that both final documents open in D1 and D2.
7. During object drag, resize, route-joint drag, and Crop-handle drag, invoke Save. Confirm the visible committed result is what reopens. Trigger Save twice rapidly and confirm only one request completes. Also spot-check a pending Crop numeric edit, Rich Text, Field Mapping, an open dialog, pan/zoom, and image loading.
8. Use the Objects tree and canvas entirely from the keyboard in both the document and RTE hosts: arrows, Home/End, Enter/Space, F2, Delete, Context Menu/Shift+F10, menu navigation, and Escape. Confirm focus returns to the origin and typing in controls never moves/deletes the canvas selection.
9. Repeat Crop and mapping keyboard activation several times. Pin a Mapping Table cell, change a local table style, and confirm the same cell remains visibly pinned with its pressed state. Confirm focus remains visible and announced values follow the UI.
10. In RTE, exercise Annotate/Edit Annotation and both 2.0 cross-version paths, Apply/Cancel, and focus restoration. Start moving an object and press Ctrl+S before pointer-up; confirm the committed position is uploaded. During pending Apply, confirm Escape and Cancel remain blocked until it finishes.
11. Spot-check a real cross-host selection copy in both directions and create/apply one template across Diagram and RTE hosts; this physically closes the composed-evidence boundary noted above.
12. Verify original Link Diagram and Link Diagram 2 in Documentation and Scrum, including a refresh cycle. Do not test the About 3D flyby; it was not changed.

## Recompile or refresh requirement

**A .NET rebuild and application restart are required, followed by `Ctrl+F5`.**

`Endpoints/ContentEndpoints.cs` changed the server-generated public Link Diagram 2 script URL to the coordinated token `20260802-diagram2-phase7-roundtrip-v1`. Rebuilding and restarting the backend is required before the server can emit that new URL; `Ctrl+F5` then refreshes the browser entry/module graph without a caching issue. No SQL, CSS, or production image changed. There is no database migration or database-version change.

## Known limitations and evidence boundaries

- Sin has not yet manually accepted the new Phase 7 hardening changes. This is the only release/commit gate reported here.
- The physical priority lane is D1 Version 1.27 Export → D2 Import/new backing record → D2 edit/save/reopen/export → D1 open. Remaining document permutations are supported by shared-codec/backing-service evidence rather than six separate end-to-end UI scripts for every object type.
- The four RTE author/edit lanes are physical. Cross-host clipboard/template evidence is composed from the shared format/remapper and separate physical host use, not six literal transfer scripts.
- Active-gesture finalization has physical move races in both document Save and RTE Ctrl+S/Apply. Resize, route, and Crop use the same shared finalization mechanism but were not each repeated as separate physical Save races.
- Low-detail/full-detail export evidence combines physical virtualization/transient-state PMT export with existing low-detail and off-screen SVG/PNG tests; no one test holds every transient state while invoking every exporter.
- The conflict browser coverage simulates current/stale server state through the real UI and request paths in one page. A literal two-tab live-database pass is listed for manual testing.
- A syntactically valid remote asset is intentionally importable even if it is currently unavailable; the existing fallback is shown instead of treating the whole Diagram as corrupt.
- Focused accessibility assertions passed, but no standards certification is claimed.
- Required evidence reruns regenerated 26 historical tracked PNGs, plus 2 new Phase 7 PNGs. They are uncommitted and should be reviewed before any later staging decision.

None of these evidence boundaries is a known production mismatch.

## Deferred items and Phase 8 readiness

**Deferred parity items:** None within the functional Phase 7 scope. No exception to the zero thresholds is requested.

Phase 8's sustained 500/1,000-Entity performance-promotion work remains explicitly outside this phase. The Phase 7 code/evidence is ready for Sin's manual acceptance, but Phase 8 must not begin until Sin explicitly authorizes it.

## Commit

**Commit:** Not committed or staged. Sin's manual testing and explicit approval are pending.

If Sin later authorizes a commit, its subject must begin `Sin and Codex:` and the final staged scope must be reviewed carefully, especially the regenerated historical screenshots.
