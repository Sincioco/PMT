# Diagram 2 Phase 5 D1 Compact Parity And Closure Report

Generated: 2026-07-30

Status: Complete for the authorized Diagram 2 Phase 5 correction and closure. No Phase 6, Phase 7, or Phase 8 promotion work was started.

## Baseline And Commits

Starting committed baseline:

`3c31aeed34932709d3f1177e3cea09fa0692e625`

`Sin and Codex: align Diagram 2 relationships with D1`

The starting worktree contained the in-progress Phase 5 relationship-selection, route-joint, self-relationship, Entity Reset Scale, LOD, marquee, browser-test, and screenshot edits. They were preserved and completed as part of this authorized closure. No unrelated worktree edits were discarded.

Final implementation commit:

`237b229aa208dde69b4d29ecf07eb1335deac083`

`Sin and Codex: make Diagram 2 Compact match Diagram 1`

This report and the permanent screenshots are included in the separate closure evidence commit.

## Final Product Contract

Given the same canonical Diagram state and selected root Entity, Diagram 2 `Entity -> Auto Format -> Compact` now produces the same:

- Entity population, order, positions, width, and height;
- preferred root, levels, root-side placement, gaps, cycles, and anchor translations;
- `compactEntityRelationshipRouting` state;
- Entity annotation-child movement and arrow synchronization;
- normalized automatic relationship route points;
- relationship type and cardinality symbols;
- manual `routeOverride` values; and
- output bounds

as Diagram 1.

Diagram 1 is the executable Compact oracle. Diagram 2 may run that operation in a worker and expose progress/cancellation, but it no longer chooses a different layout.

## Root Cause And Correction

The reopened implementation audit confirmed all reported output-changing shortcuts:

| Removed behavior | Previous effect | Final behavior |
| --- | --- | --- |
| 64-Entity / 120-relationship summary thresholds | Large Diagrams changed scoring behavior. | Diagram size no longer changes the committed result. |
| `skipRouteAdjustment: true` | Large Diagrams skipped D1 route-contact separation. | Full D1 route adjustment always runs. |
| Generic grid candidate | D2 could select a grid instead of D1's org-tree result. | User Compact commits only the D1 result. |
| Separate D2 score veto | D2 could reject the result D1 would apply. | No D2 score can reject or alter the D1 result. |
| Locked Entities treated as fixed anchors | D2 ran a different locked-Entity layout. | Any locked Entity refuses Compact, matching D1. |

The smallest safe implementation was used. `autoFormatAnnotationStateEntitiesOrgTree(...)` in `image-annotation.js` wraps D1's existing exported `autoFormatAnnotationEntitiesOrgTree(...)`, applies the exact D1 options, translates Entity annotation children, synchronizes annotation arrows, and enables compact routing. D1 and D2 call this same state operation. A golden test proves the D1 UI result did not change.

## Preconditions And History

Compact now matches D1's command contract:

- Exactly one Entity must be selected.
- At least two Entity objects must exist.
- Every Entity must be unlocked.
- The selected Entity ID is the `preferredRootId`.
- Existing Field Rectangle-shaped `type: "entity"` objects participate exactly as D1 handles them.
- Manual route overrides and unrelated non-Entity objects remain unchanged.
- No canonical change produces no history entry.
- Success commits exactly one `Auto Format - Compact` command.
- Undo restores the exact pre-Compact state and selection.
- Redo restores the exact D1 result without rerunning Compact.
- Cancellation and stale-revision rejection leave state, selection, history, renderer, and manual routes unchanged.

## Worker And Progress Behavior

Large Diagram 2 Compact work runs the exact D1 operation in the existing worker. The inline fallback invokes the same engine and produces byte-equivalent canonical output.

The progress phases are:

1. Analyzing Entities
2. Building Relationship Graph
3. Assigning Compact Levels
4. Placing Root-side Entities
5. Separating Entities from Relationship Routes
6. Finalizing Automatic Routes
7. Applying D1 Compact Result

Final statuses are `Completed`, `No change`, `Blocked`, or `Canceled`. The removed `No improvement` score-veto status is no longer part of the user command.

## Relationship And Entity Closure

The other reopened Phase 5 items are complete:

| Area | Final behavior |
| --- | --- |
| Relationship selection | Relationship hit paths are selectable on the canvas and project into the shared selection/Objects model. |
| Route joints | Selected relationships show D1-style route joints and segment controls. |
| Joint creation/removal | Double-clicking a route segment adds a joint; right-clicking a route joint removes it when the route remains valid. |
| Manual adjustment | Joint and segment drags preview the D1 route and commit one undoable route command. |
| Entity drag routes | Drag previews use the same D1 relationship geometry, with no alternate drag-only route shape. |
| Self relationships | `Show Self Relationships` now reveals self routes and keeps them selectable/editable. |
| Cardinality | One-to-one, one-to-many, and many-to-one symbols use D1 direction and placement. |
| Reset Scale | The selected unlocked Entity can be reset to its natural Diagram 2 width/height from current fields and display settings. |
| Multi-selection | Marquee selection renders one outer selection rectangle and no per-Entity resize handles for multi-selection. |

Relationships remain canonical source Entity `foreignKeys[]`; no Diagram 2-only relationship format was introduced.

## Low Detail And Virtualization

Low-detail overview enters only when at least 80 normal Entities are present and the median projected field-row height falls below 6 CSS pixels. It exits after projected rows reach 8 CSS pixels.

At low detail:

- Entity names appear when the projected title font is at least 7 pixels and the Entity projects to at least 28 by 12 pixels.
- PK/FK summary text appears when the projected summary font is at least 9 pixels and the Entity projects to at least 80 by 32 pixels.
- Automatic routes use the low-detail route representation.
- Fine field rows remain suppressed until detailed mode returns.

The 500- and 1,000-Entity browser gates verify low detail, viewport-halo virtualization, and cleanup. Routine selection, marquee, field edit, move, relationship style, manual route, viewport, cancellation, undo, and redo work do not add a full render after the one initial harness render.

## Exact Compact Parity Results

`tests/js/diagram2-compact-parity.test.mjs` emits a structured `DIAGRAM2_COMPACT_PARITY` record for every required fixture. Each record includes D1, inline, and worker timing; mismatch counts; unresolved contacts; fixed-constraint shortcuts; cycle breaks; overlaps; output bounds; full-render count; and final status.

Required aggregate result:

| Metric | Result |
| --- | ---: |
| Entity-position mismatches | 0 |
| Automatic-route-point mismatches | 0 |
| Locked/manual-route mutations | 0 |
| Worker versus inline canonical mismatches | 0 |
| Inline versus D1 canonical mismatches | 0 |
| Full renders caused by Compact planning | 0 |

Key production-shaped results from the final dedicated run:

| Fixture | Entities | Relationships | D1 | D2 inline | D2 worker | Final status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| PMT Database Schema | 29 | 78 | 8.48 s | 8.68 s | 8.75 s | Completed |
| Saved Diagram 23 | 96 | 257 | 195.73 s | 189.11 s | 186.03 s | Completed |
| Production-shaped large graph | 232 | 624 | 29.93 s | 30.54 s | 32.02 s | Completed |
| Production-shaped large graph | 500 | 160 | 32.55 s | 32.94 s | 27.19 s | Completed |
| Focused cancellation graph | 1,000 | 120 | Canceled before oracle completion | Not committed | Canceled cleanly | Canceled |

All small graph, chain, star, inbound/outbound, cycle, disconnected, self, anchor, multiple-anchor, annotation, Field Rectangle, manual-route, overlap, symbol, collapsed/expanded, and data-type fixtures also completed with zero required mismatches. The dedicated file passed 27/27 tests in 933.42 seconds.

The real Diagram 23 fixture is `tests/fixtures/diagram2/diagram-23-state.json`, extracted read-only from saved Diagram document 23. It contains 99 canonical objects, including 96 Entities, and renders 257 relationships.

## 500 And 1,000 Entity Gates

The production browser harness creates actual Entity graphs rather than substituting the earlier 1,000-object tree fixture.

Both the 500- and 1,000-Entity gates verify:

- click selection and marquee selection;
- one multi-selection outer overlay with zero resize handles;
- one field edit;
- one Entity move;
- one relationship style change;
- one manual route edit;
- low-detail mode;
- viewport-halo virtualization;
- actual module Worker start;
- cancellation on the first progress event;
- unchanged state, selection, history, and revision after cancel;
- worker termination and controller/renderer cleanup; and
- one initial full render with no additional full render for the measured operations.

The 1,000-Entity gate is a focused cancellation/editing smoke. Phase 8 still owns promotion timing and sustained-performance evidence.

## Permanent Screenshots

Existing Phase 5 evidence:

| Screenshot | Viewport |
| --- | --- |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-entity-inspector-1366x768.png` | 1366 x 768 |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-relationship-manual-route-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-auto-format-compact-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/diagram2-phase5-rte-entity-editing-1366x768.png` | 1366 x 768 |

D1/D2 Compact parity evidence:

| Screenshot | Viewport |
| --- | --- |
| `docs/screenshots/diagram-2-phase-5/compact-parity/compact-d1-pmt-schema-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/compact-parity/compact-d2-pmt-schema-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/compact-parity/compact-d1-diagram-23-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/compact-parity/compact-d2-diagram-23-1920x1080.png` | 1920 x 1080 |
| `docs/screenshots/diagram-2-phase-5/compact-parity/compact-d1-cycle-anchor-1366x768.png` | 1366 x 768 |
| `docs/screenshots/diagram-2-phase-5/compact-parity/compact-d2-cycle-anchor-1366x768.png` | 1366 x 768 |

Each pair starts from the same canonical state, selected root, relationship settings, and viewport. Geometry equality is authoritative; D2 intentionally uses low-detail rendering for the 96-Entity Fit overview.

## Automated Validation

Final observed commands and closure counts:

- `cmd /c npm.cmd run check:js` - passed, 177 JavaScript modules checked.
- `cmd /c npm.cmd run test:js` - passed, 418/418 tests in 958.6 seconds.
- `node --test tests/js/diagram2-compact-parity.test.mjs` - passed, 27 tests.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-navigation.spec.mjs --project=chromium-1366` - passed, 11/11 tests in 104.5 seconds.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-navigation.spec.mjs --project=chromium-1920` - passed, 11/11 tests in 332.9 seconds.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-rte-annotation.spec.mjs --project=chromium-1366` - passed, 4 tests.
- `cmd /c npx.cmd playwright test tests/browser/diagram2-rte-annotation.spec.mjs --project=chromium-1920` - passed, 4 tests.
- `cmd /c npx.cmd playwright test tests/browser/image-annotation.spec.mjs --project=chromium-1366` - passed, 3 tests.
- `cmd /c npx.cmd playwright test tests/browser/image-annotation.spec.mjs --project=chromium-1920` - passed, 3 tests.
- Browser matrix total - passed, 36/36 tests.
- `cmd /c dotnet build` - blocked only by running local process `PMT (54932)` locking `bin\Debug\net6.0\PMT.exe`.
- `cmd /c dotnet build -p:OutputPath=bin\CodexPhase5D1CompactParity\` - passed with 0 errors and the two existing .NET 6 end-of-support warnings.
- `git diff --check` - passed.

The About 3D flyby was not tested because this phase did not change it, per Sin's instruction.

## Manual Acceptance Checklist

1. Open the same original Diagram in Diagram 1.
2. Select a known root Entity.
3. Run `Auto Format -> Compact`.
4. Save or capture the Diagram 1 result.
5. Reopen the original starting state in Diagram 2.
6. Select the same root Entity.
7. Run `Entity -> Auto Format -> Compact`.
8. Compare Entity levels, root-side placement, relationship lines, anchors, symbols, and output bounds.
9. Undo and verify the exact original Diagram 2 state.
10. Redo and verify the exact Diagram 1-compatible result without another Compact run.
11. Repeat with the PMT schema and Diagram 23.
12. Lock any Entity and verify Compact refuses with the D1-equivalent message.
13. Start Compact, press Cancel, and verify state, selection, routes, and history remain unchanged.

Also verify relationship editing by selecting a line, dragging its joints, double-clicking a segment to add a joint, right-clicking a joint to remove it, and enabling `Show Self Relationships`.

## Cache And Rebuild

Browser-loaded production modules are cache-busted to:

`20260730-diagram2-d1-compact-parity-v1`

Press `Ctrl + F5` once on the running PMT browser page. No CSS or image cache issue is expected because the changed JavaScript module graph has a new query token and the evidence PNGs are documentation artifacts.

No C# files changed. A .NET rebuild is not required to see or test these changes while PMT is already running. The alternate-output build is validation only.

## Known Limitations

- Exact D1 compatibility carries D1's existing large relationship-routing cost. Saved Diagram 23 takes about three minutes per full Compact execution on this dev machine.
- Worker execution keeps Diagram 2 responsive and cancelable, but it does not make the D1 algorithm itself faster.
- The 1,000-Entity Compact gate validates worker start and clean cancellation, not full promotion timing.
- Phase 8 still owns final 500/1,000 promotion benchmarks, sustained interaction budgets, and any output-preserving optimization of the shared D1 core.
- At extreme Fit zoom, D2 intentionally suppresses fine Entity field text until the LOD exit threshold is reached.

## Phase 6 Prerequisites And Boundary

Phase 6 may begin only after Sin explicitly authorizes it. It must:

- preserve the shared D1 Compact state helper and the zero-mismatch parity harness;
- keep relationship selection, route joints, self relationships, Reset Scale, LOD, worker cancellation, history, and no-routine-full-render gates green;
- preserve existing Field Rectangle-shaped Entity objects during Compact;
- add Crop, image upload/drop, Entity annotation authoring, Field Rectangle authoring, Field Mapping authoring, and Field Mapping Table behavior through the existing shared controller and dual-host architecture; and
- avoid changing Diagram 1-visible behavior or canonical contracts unless separately approved.

## Database And Release Impact

No database objects, procedures, migrations, seed scripts, version markers, or database-backed contracts changed. No migration or `docs/database-versioning.md` action is required; the deployed baseline remains Version 1.27.

Release Notes and What's New were not updated because this task is Phase 5 correction/closure, not an authorized release.
