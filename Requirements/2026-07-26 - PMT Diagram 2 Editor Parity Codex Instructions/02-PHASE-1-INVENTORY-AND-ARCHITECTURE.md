# PMT Diagram 2 Editor Parity Program

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


# Phase 1 — Complete Diagram 1 Editor Inventory and Diagram 2 Migration Architecture

## Purpose

Before adding more UI, build an exact inventory of what Diagram 1 currently does and how each capability must be implemented in Diagram 2 without importing legacy rendering costs.

Do not implement feature parity blindly. This phase creates the authoritative map for all later phases.

## Expected outcome of this phase

At completion:

- Every Diagram 1 toolbar control, inspector tab, field, context-menu item, keyboard shortcut, gesture, dialog, object type, Objects-tree action, template action, save/export action, and read-only interaction is listed.
- Each item identifies its canonical-state mutation and renderer impact.
- Each item is assigned to a later phase.
- Renderer-neutral domain logic that can safely be shared is distinguished from Diagram 1 renderer-coupled code.
- A clean Diagram 2 editor module architecture is approved.
- Current Diagram 2 performance baselines are captured before editor expansion.

## Required investigation

Inspect the current Diagram 1 implementation, especially:

- Diagram screen orchestration.
- `openImageAnnotationDialog(...)` and its editor implementation.
- Toolbar and tool definitions.
- Inspector and tab HTML generation.
- Event binding and action routing.
- Object creation helpers.
- Selection, marquee, hit testing, resize, crop, drag, and keyboard logic.
- Entity and relationship operations.
- Field Rectangle and Field Mapping Table operations.
- Template operations.
- Undo/redo implementation.
- Save, import, export, and clipboard paths.
- Existing unit and browser tests.
- CSS selectors and responsive behavior.

Do not infer features only from screenshots. Trace the actual action handler and canonical-state change.

## Produce the authoritative parity matrix

Create a repository document based on `10-FEATURE-PARITY-MATRIX-TEMPLATE.md`.

For each feature, record:

```text
Feature ID
Diagram 1 UI location
Diagram 1 action/data attribute
Diagram 1 handler/function
Canonical state fields read
Canonical state fields written
Relationship/routing effect
Bounds/sector effect
History behavior
Shared helper candidates
Legacy renderer coupling
Diagram 2 implementation strategy
Assigned phase
Tests
Performance risks
Status
```

Inventory at minimum:

### Editor shell

- Maximized/embedded editor behavior
- Toolbar groups
- Canvas/workspace
- Left and right panes
- Inspector tabs
- Status and save indicators
- Diagnostics visibility
- Responsive behavior
- Dialog lifecycle and cleanup

### Tools and object types

- Select
- Pan
- Format Painter
- Crop
- Rectangle
- Circle
- Arrow
- Line
- Textbox
- Rich Text
- Image
- Entity
- Field Rectangle
- Field Mapping Table
- Any newer object type present in the latest code

### Editing operations

- Add
- Delete
- Duplicate
- Copy
- Paste
- Select
- Multi-select
- Marquee
- Move
- Resize
- Crop
- Rename
- Style
- Lock
- Visibility
- Group/ungroup
- Z-order
- Alignment/distribution if present
- Default style
- Template creation/application/edit/delete
- Undo/redo
- Keyboard shortcuts
- Context menus

### ERD and advanced operations

- Entity creation
- SQL or field-list parsing
- Entity field editing and ordering
- PK/FK/nullable/identity/important flags
- Collapse/expand
- Data type visibility
- Key-column visibility
- Foreign keys at top
- Self relationships
- Relationship visibility
- Relationship symbols
- Relationship styles
- Manual routes
- Routing options
- Auto Format
- Entity annotations
- Field Rectangles
- UI-to-database field mappings
- Many-to-one mapping
- Field Mapping Tables
- Mapping hover and attention highlighting
- Read-only versus edit interactions

### Persistence and interoperability

- Save
- Create backing document
- Duplicate
- Import PMT Diagram
- Export PMT Diagram
- SVG
- PNG
- Portable assets
- Clipboard
- Templates
- Public/private Diagram metadata
- Row-version conflict handling

## Architecture proposal

Propose modules along these responsibilities. Adapt names to PMT conventions, but keep separation:

```text
diagram2-editor-controller.js
diagram2-editor-commands.js
diagram2-history.js
diagram2-editor-shell.js
diagram2-toolbar.js
diagram2-inspector.js
diagram2-objects-tree.js
diagram2-interactions.js
diagram2-domain-adapter.js
diagram2-performance-contracts.js
```

Do not create files merely for appearance. Each module must have a clear responsibility.

### Controller contract

Define a renderer-neutral editor controller that owns:

- Canonical state
- Selection model
- Active tool
- Command execution
- History
- Dirty/saved status
- Shared service calls
- Feature capability checks
- Editor subscriptions/events

### Renderer contract

Document the exact Diagram 2 APIs needed by the editor, including missing APIs that must be added later:

```text
mount/destroy
set canonical state
add/update/remove object
set selection
begin/end transaction
preview/commit/cancel geometry
invalidate style/structure/geometry
update relationships
center/fit object
viewport transforms
diagnostics
when idle
```

Do not solve missing APIs by calling broad `render()` from every feature.

## Command history design

Design command-based history before feature expansion.

Required command shape should support:

```javascript
{
  type,
  label,
  affectedObjectIds,
  affectedRelationshipIds,
  apply(state),
  invert(),
  mergeWith(nextCommand),
  dirtyClassification
}
```

Exact implementation may differ, but it must support:

- One drag = one undo entry.
- Text input coalescing.
- Style slider/color changes coalescing.
- Multi-object operations.
- Safe group/relationship reference updates.
- Bounded memory.
- Exceptional global snapshots for import/Auto Format only.

## Baseline measurements

Record current Diagram 2 measurements before editor expansion for:

- 28–30 Entity PMT Schema
- 232 Entities / approximately 624 relationships
- Latest production-shaped 500-Entity benchmark
- A production-shaped 1,000-Entity fixture if available

Measure:

- Open/useful frame
- Selection
- Drag start and preview
- Zoom/pan frame
- Settle
- Local route recomputation
- Mounted objects/relationships
- DOM descendants
- Memory after ten cycles
- Full-render count

## Acceptance criteria

- Inventory is complete enough that no visible Diagram 1 editor feature is merely assumed.
- Every parity item is assigned.
- Shared versus renderer-coupled code is identified.
- Command/history architecture is documented.
- Diagram 2 performance baselines are reproducible.
- No feature implementation has been started prematurely.
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
