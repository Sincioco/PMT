# Diagram 2 Phase 5 Entity, ERD, Relationships, and Auto Format Completion Report

Generated: 2026-07-29

Status: Complete for the authorized Phase 5 shared Entity/ERD editing surface, with remaining production-scale hardening explicitly tracked for Phase 8.

## Baseline

Starting committed baseline:

`d07ef6910336862ff7ac9c8aeeda1ae0e23aa73a`

`Sin and Codex: finalize Diagram 2 Phase 4 closure evidence`

Final implementation commit:

This report is included in the Phase 5 completion commit. The computed SHA is reported in the final Codex response after Git creates the commit.

## Scope Completed

Phase 5 adds Entity, relationship, manual route, and Auto Format - Compact behavior through the shared Diagram 2 editor core used by:

| Host | Result |
| --- | --- |
| Top-navigation Diagram 2 | Entity toolbar action, Entity dialog, Entity inspector controls, relationship dialog, relationship selection, manual route handles, Objects-tree relationship rows, and Compact are wired through the shared controller. |
| Rich Text `Annotate 2.0` | Reuses the same Entity dialog, relationship dialog, inspector controls, controller commands, renderer route handles, and Compact command. |
| Rich Text `Edit Annotation 2.0` | Reuses the same implementation while saving back to the originating RTE image only on Save. |

No Phase 6 or Phase 7 work was started. Diagram 1 remains available and unchanged as the current production editor.

## Files Changed

New Phase 5 modules:

| File | Responsibility |
| --- | --- |
| `wwwroot/js/features/diagram2/diagram2-editor-entities.js` | Entity parser adapter, Entity creation/edit plans, field add/update/remove plans, display-option plans, duplicate field-name handling, and sizing. |
| `wwwroot/js/features/diagram2/diagram2-editor-relationships.js` | Relationship add/delete/style/type/routing/manual-route plans, relationship selection objects, and Auto Format - Compact plan. |
| `wwwroot/js/features/diagram2/diagram2-routing.js` | Renderer-neutral relationship route model wrapper, normalized geometry, paths, bounds, relationship type normalization, and route-handle adjustment helpers. |

Updated existing code:

| Area | Files |
| --- | --- |
| Shared controller and structure tree | `diagram2-editor-controller.js`, `diagram2-editor-structure.js` |
| Interaction/renderer | `diagram2-editor-interactions.js`, `diagram2-renderer.js` |
| Shared shell and hosts | `diagram2-editor-shell.js`, `diagram2.js`, `diagram2-rte-host-adapter.js` |
| Browser asset cache busting | `wwwroot/index.html`, `wwwroot/js/app.js`, `wwwroot/css/features/diagram2.css` |
| Automated coverage | `tests/js/diagram2-editor-controller.test.mjs`, `tests/js/diagram2-renderer.test.mjs`, `tests/browser/diagram2-navigation.spec.mjs`, `tests/browser/diagram2-rte-annotation.spec.mjs` |
| Documentation/evidence | `docs/diagram-2-editor-parity-matrix.md`, `docs/diagram-2-editor-migration-architecture.md`, `docs/screenshots/diagram-2-phase-5/*` |

Browser tests also refreshed existing Phase 3/Phase 4 evidence screenshots because the shared editor shell now shows Phase 5-enabled Entity/relationship controls.

## Phase 5 Gap Matrix

| Item | Final status | Evidence and notes |
| --- | --- | --- |
| Entity toolbar action | PASS | Toolbar Entity button and `E` shortcut create Entities through the shared host action. |
| Entity creation | PASS | Controller, top-navigation, and RTE tests create compatible canonical Entity objects. |
| SQL Server `CREATE TABLE` parsing | PASS | `parseDiagram2EntityDefinition` wraps the Diagram 1 parser. |
| Field-list parsing | PASS | Entity dialog accepts field-list text and commits one definition command. |
| Schema/name editing | PASS | Entity dialog updates schema/name through shared history. |
| Field name/data type | PASS | Parser and controller command helpers update both values. |
| Nullable, identity, primary key, foreign key, important flag | PASS | Controller test covers all flags and SVG/rendered field output remains compatible. |
| Duplicate-name handling | PASS | Field add helper applies deterministic numeric suffixes. |
| Add/remove/reorder fields | PASS | Add/update/remove command helpers exist; visible reorder is handled through edited definition text. |
| Show Key Column | PASS | Entity inspector toggle updates canonical display state and renderer output. |
| Show Data Types | PASS | Top-navigation and RTE browser coverage toggles and verifies data type display. |
| Foreign Keys at Top | PASS | Entity dialog and inspector preserve the compatible canonical flag. |
| Collapse/expand | PASS | Shared Entity option command uses the Diagram 1 collapsed-state helper. |
| Entity sizing | PASS | Entity size normalizes from visible fields, data types, key column width, and minimum dimensions. |
| Self relationships | PASS | Relationship creation enables self-relationship visibility for same-source/target Entities. |
| Relationship creation/deletion | PASS | Shared relationship dialog and delete commands update source foreign keys and selection. |
| Relationship selection | PASS | Renderer hit paths and Objects-tree rows select stable relationship ids. |
| Relationship Objects-tree rows | PASS | Structure projection normalizes relationships into selectable tree rows and a parent collection. |
| Relationship style, stroke width, opacity, arrow size, symbols | PASS | Individual overrides and global defaults are command-based; style-only changes reroute zero relationships. |
| Global versus individual overrides | PASS | Relationship parent/global style and selected relationship overrides are both supported. |
| Show/hide relationships | PASS | Global relationship visibility is stored in canonical state and applied by renderer route patching. |
| Overlapping-line setting | PASS | Relationship route model receives `allowOverlappingEntityLines`. |
| Compact-routing setting | PASS | Relationship route model receives `compactEntityRelationshipRouting`; Compact enables it. |
| Manual route mode | PASS | Manual route toggle and route overrides are stored in the compatible foreign-key route field. |
| Add/move/remove route points | PARTIAL | Phase 5 supports current-route capture, segment movement by pointer and keyboard, preview-only drag, one commit on release, and clear-to-automatic. A dedicated point insert/delete UI was not added. |
| Reset route to automatic | PASS | Clear Manual Route removes selected route overrides. |
| Auto Format | PASS | Compact is explicit and uses the shared Auto Format command path. |
| Auto Format -> Compact | PASS | The Entity inspector exposes button label `Compact` and the approved tooltip. |
| Compact progress/cancel worker flow | PARTIAL | No worker was added; tested fixtures did not show a need. Full worker progress/cancel evidence remains Phase 8 hardening. |
| Top-navigation host | PASS | Browser coverage passes at 1366 and 1920. |
| Annotate 2.0 | PASS | Browser coverage passes at 1366 and 1920. |
| Edit Annotation 2.0 | PASS | RTE save/reopen coverage continues to pass and uses the same Phase 5 implementation. |
| Diagram 1 round trip | PASS | Top-navigation browser roundtrip through Diagram 1 passes; Diagram 1 annotation regressions pass. |
| Selective-routing diagnostics | PASS | 232/624 browser stress asserts local movement does not consider or reroute all relationships. |
| Stress fixtures | PASS/PARTIAL | 232/624 selective-routing and 1,000 object tree/rendering gates pass. 500/1,000 Entity-specific Compact promotion gates remain Phase 8. |
| Undo/Redo | PASS | New Entity, field, relationship, manual route, and Compact controller commands are undoable. |
| Save/Reopen | PASS | Shared Diagram save/reopen and RTE save/reopen browser tests pass. |

## Entity Behavior

Entity creation and editing reuse Diagram 1-compatible canonical fields:

- `type: "entity"`
- `entitySchema`
- `entityName`
- `fields[]`
- `foreignKeys[]`
- `showKeyColumn`
- `showDataTypes`
- `foreignKeysAtTop`
- `collapsed`
- `showSelfRelationships`
- `anchorTable`
- existing style and geometry fields

Dirty behavior is kept narrow:

| Change | Dirty categories |
| --- | --- |
| Name/style-only edits | Entity/style patch. |
| Field text/data type/flags | Entity structure, bounds, and connected relationship anchors. |
| Field add/remove/reorder through definition text | Entity structure and connected relationships. |
| Collapse, data-type visibility, key-column visibility | Entity bounds, field anchors, and affected routes. |
| Position/size | Geometry plus selectively affected relationship routes. |

## Relationship Behavior

Relationships remain stored through existing Entity `foreignKeys[]` data. Diagram 2 derives selectable relationship ids from source Entity, source field, target Entity, target field, and foreign-key metadata, so the renderer can patch one relationship without inventing a Diagram 2-only Entity format.

Implemented relationship behavior:

- Field-to-field anchors.
- Source and target Entity/field references.
- One-to-one, one-to-many, many-to-one, and default arrow rendering.
- Self relationships.
- Relationship creation and deletion.
- Relationship selection from hit paths and Objects-tree rows.
- Individual relationship style overrides through `foreignKey.styleOverride`.
- Global relationship defaults through `relationshipStyle`.
- Show/hide all relationship lines.
- Overlapping-line and compact-routing options.

Style-only relationship changes update relationship style dirty state and reroute zero relationships.

## Manual Routes

Manual routes use the compatible `routeOverride` field on source foreign keys. Phase 5 supports:

- Manual route mode.
- Use Current Route to capture the current automatic route.
- Dragging a relationship route segment with a live preview path.
- Keyboard nudging a focused route handle.
- Commit once on pointer release.
- Clear Manual Route to reset selected relationships to automatic routing.
- Save/reopen compatibility because no renderer-only route state is persisted.

Manual route movement does not commit canonical state on every pointer event. The preview path is removed on commit or cancel.

## Routing and Route Cost Factors

`diagram2-routing.js` wraps Diagram 1's renderer-neutral relationship route model and normalizes the result for Diagram 2. The route model preserves the effective Diagram 1 priorities:

1. Resolved route over unresolved route.
2. Fewer Entity/obstacle clearance contacts.
3. Lower visual-noise cost.
4. Shorter total Manhattan route length.
5. Deterministic canonical path tie-break.

The reused route model includes alternate endpoint candidates, field-anchor candidates, obstacle-aware orthogonal routes, clearance and contact accounting, bend and short-jog penalties, route footprint penalties, shared lane penalties, and deterministic path ordering. Diagram 2 does not call Diagram 1's editor, DOM helpers, SVG repaint pipeline, or history implementation.

## Auto Format - Compact

Compact is intentionally explicit. It does not run during drag, resize, field editing, or ordinary Entity changes.

Implementation behavior:

- Reads a normalized canonical snapshot.
- Treats locked Entities as anchored during layout.
- Restores each locked Entity's original position.
- Preserves manual route overrides.
- Calls the renderer-neutral Diagram 1 org-tree layout helper.
- Enables compact relationship routing after the final layout.
- Commits one batched command named `Auto Format - Compact`.
- Undo restores the original layout; redo restores the optimized layout without rerunning the calculation.

No Web Worker was added in Phase 5 because measured automated fixtures did not show a material responsiveness need. Full progress/cancel worker behavior remains a Phase 8 hardening item before any promotion decision.

## Diagnostics And Scale Evidence

| Fixture | Result |
| --- | --- |
| PMT schema fixture | 88 canonical objects and 78 relationships verified by browser coverage. |
| PMT schema unit generation | Passed under one second; final run measured 23.975 ms. |
| Small Entity fixture | Entity edit, relationship add/delete/style, manual route, and Compact command coverage passes. |
| 232 Entities / 624 relationships | Browser selective-routing stress passes and asserts one local Entity move does not consider or reroute all 624 relationships. |
| 1,000 objects | Existing Phase 4 tree/rendering gate still passes; final JS metrics: `{"canonicalObjectCount":1000,"flattenedTreeNodeCount":1054,"objectTreeProjectionMs":33.5,"searchProjectionMs":30.47,"structureStateUpdateCount":7,"objectPatchUpdateCount":1,"historyEntryCount":4,"fullRenderCount":0}`. |
| 500/1,000 Entity Compact | Not promoted in Phase 5; remains Phase 8 hardening. |

## Full Render And Routing Impact

- Initial open/import/full reset may still use a full render.
- Routine Phase 5 Entity and relationship edits feed affected object ids and relationship ids to the renderer.
- Relationship style-only changes reroute zero relationships.
- Manual route dragging previews a single selected relationship route.
- The 232/624 stress fixture asserts relationship route caching and selective invalidation.
- No renderer maps, route caches, viewport halo data, or worker state are written into saved SVG.

## Screenshots

Permanent Phase 5 screenshots:

| Screenshot | Dimensions |
| --- | --- |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-entity-inspector-1366x768.png` | 1366 x 768 |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-relationship-manual-route-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-auto-format-compact-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-rte-entity-editing-1366x768.png` | 1366 x 768 |

## Automated Validation

Preflight before editing:

- `git status --short` - clean.
- `git status -sb` - current branch confirmed before editing.
- `git log -10 --oneline` - confirmed recent history.
- `git rev-parse HEAD` - returned `d07ef6910336862ff7ac9c8aeeda1ae0e23aa73a`.
- `git diff --stat` - no pre-existing diff.
- `git diff` - no pre-existing diff.
- `git diff --check` - clean.

Final validation:

- `node --check <each changed JavaScript and browser spec file>` - passed.
- `cmd /c npm.cmd run check:js` - passed, 173 JavaScript modules checked.
- `cmd /c npm.cmd run test:js` - passed, 381 tests.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-navigation.spec.mjs --project=chromium-1366` - passed, 9 tests.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-navigation.spec.mjs --project=chromium-1920` - passed, 9 tests.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-rte-annotation.spec.mjs --project=chromium-1366` - passed, 4 tests.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-rte-annotation.spec.mjs --project=chromium-1920` - passed, 4 tests.
- `cmd /c npx.cmd playwright test tests/browser/image-annotation.spec.mjs --project=chromium-1366` - passed, 3 Diagram 1 regression tests.
- `cmd /c npx.cmd playwright test tests/browser/image-annotation.spec.mjs --project=chromium-1920` - passed, 3 Diagram 1 regression tests.
- `cmd /c dotnet build` - blocked by the local running `PMT.exe` lock on `bin\Debug\net6.0\PMT.exe` from process `PMT (39476)`.
- `cmd /c dotnet build -p:OutputPath=bin\CodexPhase5\` - passed with only the existing .NET 6 end-of-support warning.
- `git diff --check` - passed, with line-ending warnings only.

The About 3D flyby was not tested because Phase 5 did not change it.

## Manual Acceptance Checklist

| Check | Expected result |
| --- | --- |
| Open Diagram 2, edit the PMT schema Diagram, select an Entity | Entity inspector appears with Edit Definition, Add Relationship, Compact, display toggles, and relationship controls. |
| Press `E` or click Entity | Entity definition dialog opens; saving creates one new Entity and selects it. |
| Edit an Entity definition | SQL or field-list text updates schema/name/fields with one undoable command. |
| Toggle Show Data Types or Show PK/FK column | Entity layout updates without replacing unrelated objects. |
| Add a relationship | Relationship row appears in Objects and the route connects the exact source/target fields. |
| Select a relationship | Relationship inspector controls are enabled and route handles appear when manual routing is active. |
| Drag a route handle | One preview route updates during drag and one command commits on release. |
| Clear Manual Route | The selected route returns to automatic routing. |
| Click Compact | Entity positions are compacted in one undoable command; manual route overrides and locked Entity positions remain preserved. |
| Save and reopen | Diagram 2 and Diagram 1 can still parse the saved SVG; renderer-only state is absent. |

## Known Limitations

- A dedicated point insert/delete UI for manual relationship routes was not added. Phase 5 supports current-route capture, segment movement, keyboard nudge, and clear-to-automatic.
- A Web Worker, long-running progress phases, cancel button, stale-revision rejection UI, and cleanup metrics for very large Compact jobs were not added because tested fixtures did not show a need in this phase. Keep this visible for Phase 8 before promotion.
- A new Diagram 2 live `Generate PMT Database Schema` button was not added. The existing PMT schema Diagram fixture/import/open path remains compatible and tested.
- 500/1,000 Entity-specific Compact promotion gates were not claimed. The existing 1,000 object tree/rendering gate and 232/624 relationship selective-routing gate pass.

## Phase 6 Prerequisites

Phase 6 should start from the committed Phase 5 shared Entity/relationship base and add only the authorized image, Crop, Entity annotation, Field Rectangle, Field Mapping, and Field Mapping Table authoring scope. It should reuse the existing canonical Entity/relationship commands rather than forking them.

## Cache And Browser Testing

Browser-loaded Diagram 2 CSS and JS imports were cache-busted to:

`20260729-diagram2-phase5-v1`

For local manual testing, no browser cache issue is expected after a hard refresh. Press `Ctrl + F5` in the browser to force the new JS/CSS query strings to load.

## .NET Rebuild Requirement

No C# or database code changed. If PMT is already running locally, a .NET rebuild is not required just to see the Phase 5 browser changes; press `Ctrl + F5`.

The alternate-output .NET build still passed for validation:

`cmd /c dotnet build -p:OutputPath=bin\CodexPhase5\`

## Database Impact

No database objects, stored procedures, migrations, seed scripts, version markers, or database-backed data contracts were changed. No database migration or `docs/database-versioning.md` action is required. The deployed PMT database baseline remains Version 1.27.

## Release Notes Impact

Release Notes and What's New were not updated because Sin did not authorize a release-note change for this Phase 5 implementation task.
