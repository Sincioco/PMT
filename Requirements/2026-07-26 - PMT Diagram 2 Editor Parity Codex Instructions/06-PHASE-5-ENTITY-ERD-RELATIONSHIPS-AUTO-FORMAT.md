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


# Phase 5 — Entity, Field, ERD Relationship, Manual Routing, and Auto Format Parity

## Purpose

Implement the central ERD capabilities that make PMT Diagram valuable, using Diagram 2's selective-routing and preview architecture.

## Expected outcome of this phase

Diagram 2 can create and fully edit Entities and their relationships with Diagram 1 behavior parity:

- Create Entity
- Parse SQL or field lists where supported
- Edit schema/name
- Add, remove, reorder, and edit fields
- PK/FK/identity/nullable/important flags
- Show key column
- Show data types
- Foreign keys at top
- Self relationships
- Collapse/expand
- Relationship creation and deletion
- Relationship styles and symbols
- Manual routes
- Routing settings
- Auto Format

## Entity creation and editing

Reproduce Diagram 1 Entity workflows:

- Default Entity creation
- SQL Server `CREATE TABLE` parsing
- Field-list parsing
- Schema and Entity name
- Field name/data type
- Nullability
- Identity
- Primary key
- Foreign key
- Important
- Manual field ordering
- Duplicate-name handling
- Entity annotations references
- Compatible saved canonical fields

Entity inspector changes must classify dirty state correctly:

```text
Name/style-only → object patch
Field text/data type → structure patch and anchor refresh
Field add/remove/reorder → structure, anchors, connected relationships
Collapse/data-type visibility → structure, anchors, affected routes
Position/size → geometry and selective routes
```

Do not route every relationship after editing one field.

## Entity sizing and collision

Implement Diagram 1 sizing behavior while preserving Diagram 2 performance:

- Automatic height from visible rows
- Manual width
- Minimum sizes
- Collapse size
- Data-type column visibility
- Collision/overlap resolution where required
- Protected bounds
- Group/annotation relationships

Use resize preview and commit final collision/layout work once.

## Relationship creation and editing

Support:

- Field-to-field anchors
- Many-to-one and current supported types
- Exact source and target references
- Relationship deletion
- Relationship selection
- Relationship collection in Objects tree
- Style controls
- Stroke width
- Opacity
- Arrow size
- Symbols
- Global versus individual overrides
- Show/hide all relationships
- Self relationships
- Allow overlapping lines
- Compact routing
- Field Rectangle relationships when applicable

Style-only relationship changes must never reroute.

## Selective routing contract

Local Entity or relationship changes must use:

- Relationship IDs by Entity
- Relationship IDs by field anchor
- Old/new protected regions
- Route bounds
- Expanded impact corridor
- Obstacle sectors
- Route cache signatures

Diagnostics must prove that local work is proportional to connectivity and affected area.

Manual routes must remain valid and not be replaced by automatic routing unless the user requests it.

## Manual route editor

Reproduce Diagram 1's manual routing behavior:

- Enter/exit manual route mode
- Add/move/remove route points
- Endpoint handling
- Cancel
- Reset to automatic
- One gesture/operation per history command
- Save/round-trip
- Correct interaction at zoom and virtualization boundaries

During point movement, preview only the affected route.

## Collapse and data-type visibility

Implement in edit and read-only Diagram 2 behavior where applicable.

Requirements:

- Keyed Entity node retained when practical.
- Only Entity internal structure and affected anchors/routes change.
- Objects tree remains complete.
- Save state remains compatible.
- Diagram 1 reopens exact state.

## Auto Format

Trace Diagram 1 behavior but do not blindly copy an expensive synchronous algorithm.

Requirements:

- Deterministic canonical result.
- One global history command.
- Progress/cancel if measured duration warrants it.
- Use efficient graph/layout algorithms.
- Consider a Web Worker for pure layout computation if it materially improves responsiveness.
- Keep renderer responsive until commit.
- Apply final positions in one batched transaction.
- Reroute after final layout, not per intermediate object.
- Preserve manual-route policy and locked objects according to Diagram 1 behavior.

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Visual and dual-host parity requirements for this phase

Entity and ERD functionality belongs to the shared Diagram 2 editor core.

If Diagram 1 supports an Entity or relationship inside an RTE annotation, Diagram 2 must support it through `Annotate 2.0` and `Edit Annotate 2.0`, not only through standalone Diagram documents.

### Visual parity

Match the familiar:

- Entity toolbar action.
- Entity inspector tab.
- Field list and field-edit controls.
- PK/FK/identity/nullable/important controls.
- Collapse/data-type visibility controls.
- Relationship tools and inspector.
- Manual-route handles.
- Relationship symbols and hover/selection treatment.
- Auto Format command and progress/error behavior.

### Shared command rules

- Entity field edits rebuild only the affected Entity's internal structure when needed.
- Anchor changes reroute only connected or spatially affected relationships.
- Collapse/data-type visibility updates affected bounds/sectors and relationships incrementally.
- Manual route editing uses preview state and one final command.
- Auto Format may use a worker/global snapshot because it is genuinely global, but the live transition and history must remain controlled.

### Required RTE compatibility flow

Test:

```text
Create an Entity annotation with Diagram 1
→ select the RTE image
→ Edit Annotate 2.0
→ modify Entity fields/relationship
→ Save
→ Edit Annotate
→ verify Diagram 1 reopens supported content
```

Also test the reverse direction and top-navigation document round-trips.

### Stress tests in both hosts

Use large ERD fixtures in the document host and representative embedded ERD annotations in the RTE host. Confirm selective routing, virtualization, low detail, command history, and cleanup remain active.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## Stress tests

Test:

- 28 Entity PMT Schema
- 232/624 fixture
- Sparse
- Dense
- Self-referencing
- Long cross-sector
- High fan-out
- Collapsed and expanded
- Data types on/off
- Symbols on/off
- Manual routes
- 500-Entity production-shaped fixture
- 1,000-Entity focused editing smoke

For one local Entity move in the 624-relationship fixture, assert that all 624 are not rerouted.

## Acceptance criteria

- Full Entity and ERD editing parity for current Diagram 1 scope.
- Relationship routing remains selective.
- Manual routes round-trip.
- Auto Format does not freeze the UI unnecessarily.
- Diagram 1 and Diagram 2 reopen each other's Entity edits.
- Performance constitution remains satisfied.


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
