# PMT Diagram 2 Editor Parity Program

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


## Repository context

Repository: `Sincioco/PMT`

Primary existing implementation areas to inspect before editing:

- `wwwroot/js/features/diagram/diagram.js`
- `wwwroot/js/components/image-annotation.js`
- `wwwroot/css/features/diagram.css`
- `wwwroot/css/components/image-annotation.css`
- `wwwroot/js/features/diagram2/diagram2.js`
- `wwwroot/js/features/diagram2/diagram2-renderer.js`
- `wwwroot/js/features/diagram2/diagram2-compatibility.js`
- `wwwroot/css/features/diagram2.css`
- `wwwroot/js/shared/diagram-contracts.js`
- `wwwroot/js/shared/diagram-documents.js`
- `wwwroot/js/features/diagram/pmt-diagram-file.js`
- Diagram and Image Annotation JavaScript and Playwright tests

The exact files may evolve. Always inspect the latest repository and current uncommitted work rather than relying only on this list.

## Mandatory working rules

1. Before editing, run:

   ```cmd
   git status --short
   git diff --stat
   git diff
   ```

2. Preserve unrelated working-tree changes.
3. Work only on the scope of the current instruction file.
4. Do not begin the next phase until the current phase is complete and reported.
5. PMT is a public repository. Prefix every commit with:

   ```text
   Sin and Codex:
   ```

6. Use pure JavaScript unless Sin explicitly approves another language or framework.
7. Keep Diagram 1 available and operational. Changes to Diagram 1 must be compatibility-only unless the current phase explicitly authorizes extracting a truly shared renderer-neutral helper.
8. Do not create a second database schema, duplicate Diagram documents, a second template library, a new clipboard format, or a new incompatible PMT Diagram file format.
9. Diagram 1 and Diagram 2 must continue to open the same backing Diagram documents.
10. Coordinate JavaScript and CSS cache-bust query strings for every changed browser module.
11. Do not test the 3D About flyby unless it was changed.
12. Run applicable syntax, unit, browser, build, and diff checks before completion.
13. Report whether a `.NET` rebuild is required or whether `Ctrl+F5` is sufficient.
14. Stop after the completion report and wait for Sin's manual approval.

## Non-negotiable performance rule

Feature parity means **observable user behavior parity**, not copying Diagram 1's implementation.

For every Diagram 1 feature:

1. Determine what the feature does to canonical Diagram state.
2. Reproduce the user-facing behavior in Diagram 2.
3. Implement it through Diagram 2's incremental renderer architecture.
4. Re-think or redesign the internal implementation whenever copying Diagram 1 would reintroduce broad rendering, routing, DOM, or history costs.
5. Prove through diagnostics and tests that routine interaction does not fall back to Diagram 1-style full reconstruction.

Never import Diagram 1's performance problems merely to achieve code reuse.


# Phase 2 — Diagram 2 Editor Foundation, Command History, and Full Editor Shell

## Purpose

Replace the temporary limited Diagram 2 editing controls with a scalable editor foundation capable of supporting the complete parity program.

This phase builds infrastructure and the familiar editor layout, but does not attempt every feature.

## Expected outcome of this phase

At completion:

- Diagram 2 has a real edit mode and editor shell.
- The layout supports toolbar, canvas, Objects tree, inspector tabs, dialogs, status, and optional diagnostics.
- Canonical state is owned by a Diagram 2 editor controller.
- Ordinary undo/redo uses command-based history instead of full-state JSON snapshots.
- Existing Diagram 2 selection and movement operate through commands and incremental invalidation.
- The temporary nudge/export controls are reorganized into the intended editor UI.
- Diagram 1 documents still open and save correctly.

## Editor shell

Reproduce the useful structural behavior of Diagram 1:

```text
Top toolbar
Left Objects tree or collapsible structure pane
Center high-performance Diagram 2 canvas
Right inspector with tabs
Status/save/history indicators
Modal or anchored dialogs
Optional developer diagnostics
```

The visual treatment should feel consistent with PMT and Diagram 1. Exact internal markup may differ.

### Diagnostics

Keep the extensive Diagram 2 diagnostics, but move them behind a developer toggle, collapsible panel, query option, or internal control so they do not consume the normal editor experience.

Diagnostics must remain easy to enable during implementation and tests.

## Edit mode and permissions

Implement the same meaningful permission boundaries as Diagram 1:

- Read
- Create
- Update
- Delete
- Import
- Export

Read-only users must not receive active editing controls.

Do not create a new permission resource.

## Editor controller

Implement a controller or equivalent abstraction that owns:

```text
document
canonical state
selection
active tool
active gesture
history
dirty/saved state
clipboard operations
template service references
document/save services
subscriptions
capabilities
```

UI modules may request actions, but they must not mutate live SVG directly.

## Command-based history migration

Replace the current ordinary snapshot-based move history.

Implement commands for at least:

- Set selection, when history-worthy behavior is needed
- Move objects
- Nudge objects
- Composite transaction
- Future extensibility for add/delete/style/resize

Requirements:

- One drag produces one command.
- Consecutive keyboard nudges may merge within a short, documented window.
- Redo is cleared after a new command following undo.
- Dirty/saved state is based on history position or command revision, not repeated full JSON serialization.
- History has a configurable bound.
- Undo/redo calls renderer dirty updates rather than full `renderer.render()` for local commands.
- A complete snapshot fallback is allowed only for global operations and must be clearly marked.

## Renderer APIs

Add focused renderer APIs needed by the controller rather than exposing internal maps.

Examples:

```text
addObject
removeObject
updateObject
updateObjects
replaceObjectStructure
setSelectedIds
setObjectVisibility
setObjectOrder
beginDiagramUpdate
endDiagramUpdate
invalidateObjectStyle
invalidateObjectGeometry
invalidateObjectStructure
invalidateRelationshipStyle
invalidateRelationshipGeometry
```

If the current renderer already supports an operation, use it.

## Event and lifecycle model

All listeners, observers, frames, dialog subscriptions, and transient resources must be tied to an AbortController or explicit disposer.

Leaving Diagram 2 must:

- Prompt or protect against unsaved changes according to PMT conventions.
- Commit or cancel active gestures safely.
- Destroy renderer and editor subscriptions.
- Remove dialogs and overlays.
- Release object URLs and image resources.
- Leave no stale global debugging references.

## Initial functional scope

Keep existing features working:

- Open shared Diagram documents
- Select and multi-select
- Pointer drag
- Keyboard nudge
- Zoom/pan/Fit
- Save
- Undo/redo
- Export
- Copy selection

Migrate them to the new controller and history foundation before adding more tools.

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Integrated visual-parity and dual-entry-point requirements

This phase must establish the final hosting architecture. Do not build a top-navigation-only editor that must later be dismantled for RTE embedding.

### Shared editor core

Create or establish one shared Diagram 2 editor core responsible for:

- Editor controller.
- Renderer-neutral commands.
- Command-based history and coalescing.
- Selection and active-tool state.
- Toolbar command definitions.
- Inspector state and validation.
- Objects-pane synchronization contracts.
- Canonical-state mutation.
- Dirty classification.
- Diagram 2 renderer integration.
- Cleanup and diagnostics.

The editor core must not assume a backing Diagram document exists.

### Required host adapters

Establish two host adapters:

#### RTE annotation host

Responsibilities:

- Receive the selected RTE image and originating RTE context.
- Parse existing annotation metadata or initialize a blank annotation.
- Mount the shared editor in modal/maximized/embedded annotation mode.
- Save the complete annotation back to the selected image.
- Cancel without altering the RTE.
- Restore RTE focus and selection.
- Avoid normal route changes.
- Dispose all renderer/editor resources.

#### Diagram document host

Responsibilities:

- Provide Diagram library, route, document ID, metadata, permissions, and row version.
- Mount the same shared editor core.
- Save through the existing Diagram backing-document service.
- Handle document navigation and stale-record conflicts.
- Dispose on document change or navigation.

### Side-by-side RTE commands

Inspect the existing image context menu and add:

```text
Unannotated supported image:
    Annotate
    Annotate 2.0

Annotated supported image:
    Edit Annotate
    Edit Annotate 2.0
```

Existing Diagram 1 actions must remain unchanged.

During Phase 2, `Annotate 2.0` and `Edit Annotate 2.0` must launch the real shared Diagram 2 editor shell, even if later phase tools are still disabled or unavailable. Do not launch the top-navigation route as a workaround.

### Visual shell mandate

The Phase 2 shell should immediately converge toward Diagram 1:

- Familiar toolbar placement and grouping.
- Left Objects-pane shell.
- Center Diagram 2 canvas.
- Right inspector shell with expected tab order.
- Familiar Save/Undo/Redo placement.
- Selection-aware states.
- Development diagnostics behind a toggle or collapsible area.

Do not preserve the current minimal renderer/demo toolbar as the intended final UI.

It is acceptable for later-phase controls to be honestly disabled or omitted. Do not present nonfunctional controls as complete.

### History migration

Replace routine full-state snapshot undo with command/delta history for local operations.

At minimum, Phase 2 must prove:

- One drag equals one command.
- One keyboard nudge equals one command or a correctly coalesced series.
- Undo/redo applies the smallest dirty update.
- Ordinary move undo/redo does not call complete live `renderer.render(...)`.
- Global snapshots remain reserved for import/Auto Format/global restore operations.

### Phase 2 dual-host tests

Test:

1. Top-navigation Diagram 2 mounts the shared editor.
2. RTE `Annotate 2.0` mounts the same editor-core identity/configuration.
3. RTE `Edit Annotate 2.0` parses existing annotation metadata.
4. RTE Cancel leaves the source image unchanged.
5. Existing `Annotate` and `Edit Annotate` still open Diagram 1.
6. Ten open/close cycles in each host leave no stale SVG, listeners, maps, or global references.
7. Both hosts preserve the accepted renderer benchmark within the regression threshold.

### Revised Phase 2 expected outcome

At completion:

- Diagram 2 has a Diagram 1-familiar production editor shell.
- The same editor core runs in both hosts.
- Both RTE Diagram versions can be launched side by side.
- Top-navigation Diagram and Diagram 2 remain side by side.
- Command-based incremental history replaces local snapshot restores.
- No feature requires a full live rebuild merely because the shell and host adapters were introduced.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## Browser tests

Add tests proving:

- The full editor shell mounts without Diagram 1's editor shell.
- Diagram 1 remains available.
- Selection/move undo does not increase full-render count.
- One pointer drag equals one history entry.
- Undo/redo preserves keyed object node identity.
- Save after undo/redo round-trips into Diagram 1.
- Ten editor open/close cycles leave no stale listeners, dialogs, renderer maps, or DOM.
- Read-only permissions disable editing.

## Acceptance criteria

- Diagram 2 now looks and behaves like a real editor shell.
- No ordinary move/nudge undo calls broad `renderer.render()`.
- The controller owns canonical state.
- UI does not directly manipulate Diagram SVG internals.
- Existing benchmarks do not materially regress.
- Diagram 1 documents open and save.
- Diagram 1 remains unchanged.


## Diagram 2 performance constitution

These rules apply to every phase.

### Routine operations must remain incremental

The following must not call a complete live renderer rebuild in ordinary cases:

- Selection or selection clearing
- Hover
- Inspector tab switching
- Style changes
- Text changes
- Object movement
- Object resizing
- Collapse or expand
- Show or hide data types
- Layer visibility
- Z-order changes
- Relationship symbol or style changes
- Group membership changes
- Clipboard paste after the new objects have been parsed
- Undo or redo of an ordinary local operation

A full live render is reserved for:

- Initial document load
- A deliberately global import
- A truly global snapshot restore when no safe incremental alternative exists
- Catastrophic safe fallback after parsing or renderer failure
- Explicit diagnostic refresh

Every exception must be measured and documented.

### Preserve the Diagram 2 renderer's architecture

Do not bypass or weaken:

- Persistent keyed SVG nodes
- Separate SVG planes
- Transform-only zoom and pan
- Dirty-state categories and batched `requestAnimationFrame` flushes
- Live geometry previews
- Selective relationship routing
- Fixed-grid spatial indexes
- Viewport-plus-halo virtualization
- Low-detail overview rendering
- Canonical-state save and export
- Explicit renderer destruction and lifecycle cleanup

### No broad DOM replacement during interaction

Do not replace the complete SVG body, complete editor shell, or complete inspector during pointer movement or routine changes.

Avoid:

```javascript
host.innerHTML = buildWholeEditor();
svg.innerHTML = buildWholeDiagram();
renderer.render(completeState);
```

for ordinary local operations.

Prefer:

```javascript
controller.execute(command);
renderer.beginDiagramUpdate(reason);
renderer.updateObject(id, updater);
renderer.endDiagramUpdate(reason);
```

or a more efficient equivalent supported by the latest renderer.

### No accidental global scans on hot paths

Pointer movement, selection, hover, style updates, and local geometry commits must not repeatedly scan every object or relationship when indexed lookup is practical.

Use or extend:

- Object ID maps
- Relationship IDs by Entity
- Relationship IDs by field anchor
- Route bounds indexes
- Obstacle-sector indexes
- Viewport-sector indexes
- Selection sets
- Group membership indexes
- Field Mapping indexes

### Command-based history

Do not grow the current full-state JSON snapshot history into the final editor.

Implement renderer-neutral user commands or compact deltas for ordinary operations. One user gesture equals one undo entry. Undo and redo should replay inverse commands through dirty invalidation.

Global snapshots may remain for import, Auto Format, or other genuinely global operations, but they must be exceptional and bounded.

### Canonical state remains authoritative

Live mounted DOM, low-detail DOM, selection handles, transient transforms, route caches, dirty sets, viewport sectors, diagnostics, and editor UI state must not become persisted Diagram content.

Save and export must always derive from complete normalized canonical state.

### Performance regression gate

Each feature phase must record:

- Full-render count before and after the operation
- Dirty objects and relationships
- Objects patched
- Relationships considered and rerouted
- Flush count
- Flush duration
- DOM descendant count
- Mounted versus canonical counts where relevant
- Operation duration
- Memory/lifecycle observations when new listeners, observers, images, or workers are added

If a feature materially regresses an existing Diagram 2 benchmark, stop and redesign it before declaring the phase complete.



## Standard validation

Run the applicable commands:

```cmd
node --check <each changed JavaScript file>
cmd /c npm.cmd run check:js
cmd /c npm.cmd run test:js
cmd /c npm.cmd run test:browser -- <focused Diagram 2 and compatibility specs>
cmd /c dotnet build
git diff --check
```

Also run focused browser tests at both `1366x768` and `1920x1080` when layout or interaction changed.

Use the existing PMT Schema Diagram and the latest large Diagram fixtures. Do not rely only on synthetic micro-tests.

## Required completion report

```text
Phase completed:
Expected outcome status:
Files changed:
Diagram 1 behavior changed:
Diagram 2 user-visible behavior added:
Shared contracts affected:
Feature parity items completed:
Performance architecture preserved:
Before measurements:
After measurements:
Full-render count impact:
Routing impact:
DOM/mounted-node impact:
History/undo behavior:
Compatibility tests:
Automated tests:
Manual test steps:
Recompile required or Ctrl+F5 only:
Known limitations:
Deferred parity items:
Commit:
```
