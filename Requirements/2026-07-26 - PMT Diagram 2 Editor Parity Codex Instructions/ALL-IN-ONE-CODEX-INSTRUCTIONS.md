# PMT Diagram 2 Full Editor Parity — All-in-One Codex Instructions

This file combines the master requirements and all implementation phases. It is provided for reference or for a high-quota Codex session.

Phase-by-phase execution with manual approval remains safer because each phase creates a review and performance checkpoint.

---


---

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


# Master Expected Outcome and Performance Constitution

## Non-negotiable expected outcome

At the end of this program, Diagram 2 must be a complete high-performance editor with user-facing feature parity to Diagram 1.

"Feature parity" means that every Diagram 1 editor capability has been:

1. Inventoried.
2. Classified.
3. Reproduced in Diagram 2 or explicitly documented as intentionally inapplicable.
4. Connected to canonical Diagram state.
5. Integrated with Diagram 2's incremental renderer.
6. Covered by undo and redo.
7. Covered by Diagram 1 ↔ Diagram 2 round-trip tests.
8. Measured for performance regressions.
9. Added to the parity matrix.
10. Manually approved by Sin.

Diagram 2 must not merely look like Diagram 1. Its controls must work.

## Final user experience

A Diagram 2 user must be able to:

- Open the same Diagram library and documents as Diagram 1.
- Create a new Diagram using the existing backing-document workflow.
- Edit existing Diagram 1 documents directly.
- Create, select, move, resize, style, duplicate, copy, paste, delete, group, lock, order, hide, and show objects.
- Use equivalent toolbar actions, inspector tabs, context menus, keyboard shortcuts, dialogs, and Objects tree behavior.
- Work with Rectangle, Circle, Arrow, Line, Textbox, Rich Text, Images, Entity, Field Rectangle, Field Mapping Table, and any other currently supported canonical object types.
- Create and edit Entity fields, flags, ordering, data types, collapse state, relationship settings, manual routes, and Auto Format.
- Use UI-to-database field mapping and all related hover/highlight/edit workflows.
- Use Object Templates and the existing template library.
- Save, import, export, copy, paste, undo, and redo without leaking live renderer state.
- Open a Diagram 2 save in Diagram 1, edit it there, and reopen it in Diagram 2.

## Compatibility contract

Keep:

```text
PMT Diagram format:          pmt-diagram / version 1
Selection clipboard format: pmt-diagram-selection / version 1
Template APIs:               existing image-annotation template endpoints
Backing document:            existing Diagram/Documentation Blog record
Canonical state:             shared normalized annotation/Diagram state
```

Do not add a conversion command merely to move between Diagram 1 and Diagram 2.

Unknown safe extensions must continue to round-trip where supported. Renderer-only state must never be exported.


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


## Performance budgets

Treat these as regression gates and optimization targets. Record median and p95 where repeated measurement is practical.

### Normal PMT Schema scale

For approximately 28–30 Entities:

- Selection and clear selection: normally below 30 ms.
- Style patch: normally below 30 ms.
- Drag and resize preview frames: target below 16.7 ms.
- Zoom and pan transform frames: target below 16.7 ms.
- No ordinary operation may produce a multi-second settle.
- No ordinary operation may increase full-render count.

### Large working scale

For approximately 220–232 Entities and 624 relationships:

- Initial useful renderer frame: target below 500 ms on the development machine.
- Selection: target below 100 ms.
- Drag or resize preview start: target below 150 ms; redesign if consistently above 200 ms.
- Zoom/pan first visual frame: target below 16.7 ms normal CPU.
- Settled zoom reconciliation: target below 50 ms where practical.
- Local route recomputation: target below 100 ms and must not route all relationships.
- Focused mounted DOM: normally below 40–50% of complete detailed DOM.
- Fit overview must activate low detail and remain interactive.

### Extended scale

Use production-shaped diagrams, not empty synthetic boxes.

For 500 Entities:

- Initial useful frame target below 1 second.
- Focused selection target below 150 ms.
- Focused drag start target below 200 ms.
- No full relationship reroute for local edits.
- Focused virtualization should keep mounted objects proportional to the visible region.

For 1,000 Entities:

- The document must open without browser failure or multi-minute blocking.
- Target a useful first frame below 2 seconds on the development machine.
- Focused editing must remain usable through viewport virtualization.
- Complete Fit must use low detail.
- Save and export must remain complete even when slower than live interaction.
- Memory must remain bounded through repeated open/close cycles.

If a target cannot be met, document the measured reason and redesign attempt. Do not silently lower the target.

## Definition of done for the complete program

The program is not complete until:

- The feature-parity matrix has no unapproved gaps.
- All supported Diagram 1 object types can be created and edited in Diagram 2.
- Every visible Diagram 2 control is functional.
- Every ordinary operation uses incremental rendering.
- Command-based history covers ordinary operations.
- Cross-screen save, import, export, clipboard, templates, and round-trip tests pass.
- Performance benchmarks at normal, 232, 500, and 1,000 Entity tiers are filed.
- Diagram 1 remains available.
- Sin manually approves promotion.


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


---

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


---

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


---

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


# Phase 3 — Core Drawing Tools, Selection, Resize, Text, and Inspector Parity

## Purpose

Make Diagram 2 useful for normal diagram creation by implementing the core Diagram 1 tools and property editing through high-performance commands.

## Expected outcome of this phase

Diagram 2 users can create and edit the fundamental object types with familiar toolbar and inspector behavior:

- Rectangle
- Circle
- Arrow
- Line
- Textbox
- Rich Text
- Basic Image insertion if image service integration is already safe
- Select
- Pan
- Format Painter

They can select, multi-select, marquee-select, move, resize, style, duplicate, delete, copy, paste, and edit text.

## Toolbar parity

For each Diagram 1 toolbar item in this scope:

1. Reproduce the icon, label, tooltip, toggle behavior, keyboard behavior, and disabled state where useful.
2. Trace the canonical object created or changed.
3. Implement the operation as a command.
4. Add only the affected keyed nodes.
5. Add one undo entry.
6. Preserve current viewport and unrelated node identity.

Do not generate the complete SVG after adding one object.

## Object creation

Implement placement behavior matching Diagram 1 where users rely on it:

- Immediate insertion versus click-drag placement
- Default size
- Default style
- Selection after creation
- Repeated creation/tool persistence
- Center-of-viewport placement
- Grid snapping if enabled
- Repeated paste offsets
- Unique IDs and names

Creation should use:

```text
canonical command
→ add object
→ patch one node
→ update bounds/sectors if required
→ selection overlay
```

## Selection

Implement:

- Click selection
- Ctrl/Command/Shift toggle behavior
- Empty-space clear
- Marquee selection
- Select All
- Selection of off-screen objects from the Objects tree when that phase is available
- Selected object z-order and force mounting
- Relationship selection where applicable
- Locked object behavior

Hit testing must use canonical geometry or indexed bounds, not require every object to be mounted.

Selection changes must not reroute relationships or recalculate world bounds.

## Movement and resize

Implement:

- Pointer movement
- Multi-object movement
- Keyboard nudge
- Proportional corner resize
- One-axis side resize
- Minimum object sizes
- Grid snapping
- Collision behavior where required
- Selected objects crossing virtualization sectors
- Gesture cancel
- Pointer capture loss

During movement/resize:

- Use temporary transforms and lightweight previews.
- Do not recompute final routing on every pointer frame.
- Commit canonical geometry once at release.
- Create one undo command.
- Reroute only affected relationships after commit.

## Style inspector

Reproduce applicable Diagram 1 inspector controls:

- Fill
- Stroke
- Outline visibility
- Stroke width
- Opacity
- Arrow size
- Text color
- Font family
- Font size
- Horizontal alignment
- Vertical alignment
- Object-type-specific controls

Inspector changes must:

- Patch only selected objects.
- Use style-only dirty categories where geometry is unaffected.
- Coalesce rapid color/slider changes into sensible history entries.
- Avoid re-rendering the inspector shell on every input event.
- Preserve focus and text cursor.

## Text and rich text

Implement:

- Textbox text editing
- Rich Text editing
- Existing PMT rich-text toolbar integration
- Commit/cancel semantics
- Double-click behavior
- Keyboard focus rules
- Text measurement updates only when necessary
- Resize or bounds update when content changes
- Safe HTML normalization consistent with Diagram 1

Text input must not serialize the entire Diagram on every keystroke.

Use debounced/coalesced commands and patch only the edited text node or foreignObject content.

## Format Painter

Reproduce Diagram 1's style-copy behavior:

- Capture only supported style fields for the source object type.
- Apply compatible fields to one or multiple targets.
- Preserve unsupported target fields.
- Create one history operation per intentional application.
- Do not route relationships unless geometry-affecting style actually changed.

## Clipboard within core scope

Support copy/paste for core object types through the shared selection clipboard package.

Requirements:

- Shared versioned format.
- ID remapping.
- Group/reference safety.
- Relative positions.
- Repeated paste offset.
- Cross-screen Diagram 1 ↔ Diagram 2.
- Browser-tab fallback behavior.
- No live DOM or renderer state.

## Performance tests

For each major operation, assert:

```text
full-render count unchanged
unrelated node identity preserved
relationships rerouted = 0 for selection/style/text-only
one dirty flush per frame
one history entry per gesture
```

Test core operations on:

- Small Diagram
- 232-Entity Diagram with core objects in a focused region
- Virtualized selected object crossing sectors

## Acceptance criteria

- Core drawing and editing is genuinely usable.
- Toolbar and inspector controls work, not merely render.
- Ordinary operations remain incremental.
- Undo/redo is command-based.
- Clipboard round-trips with Diagram 1.
- Save/export remains complete.
- Performance budgets remain within the master constitution or documented redesign is performed.


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


---

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


# Phase 4 — Objects Tree, Structure, Groups, Layers, Ordering, Clipboard, and Templates

## Purpose

Reproduce Diagram 1's structural editing workflows and shared reusable content without compromising virtualization or keyed node identity.

## Expected outcome of this phase

Diagram 2 supports:

- Complete Objects tree over canonical state
- Rename
- Visibility
- Locking
- Group/ungroup
- Parent/logical group behavior
- Bring forward/back/front/back
- Layer ordering
- Drag/drop reordering where Diagram 1 supports it
- Zoom/center on an Objects-tree item
- Complete cross-screen copy/paste
- Shared Object Templates UI and behavior

## Objects tree

The Objects tree must list every canonical object and relationship even when most are not mounted.

Requirements:

- Canonical-state source, never DOM enumeration.
- Keyed rows to preserve focus and expansion.
- Efficient updates to only changed rows.
- Search/filter if Diagram 1 supports it.
- Selection synchronization in both directions.
- Multi-selection.
- Rename.
- Visibility and lock state.
- Context menu.
- Double-click center/zoom.
- Group hierarchy.
- Relationship collection and individual relationship rows where Diagram 1 exposes them.
- Field Mapping and advanced objects represented consistently.

Do not rebuild thousands of tree rows for a canvas-only hover or preview frame.

For very large Diagrams, consider tree virtualization if measured.

## Ordering and z-order

Implement:

- Bring Forward
- Send Backward
- Bring to Front
- Send to Back
- Drag/drop ordering if present
- Relationship-plane contracts
- Selected-object visual elevation without permanently corrupting canonical order

Z-order updates should reorder only affected keyed DOM nodes and not rebuild object geometry.

## Visibility and locking

Visibility changes:

- Update canonical state.
- Mount/unmount affected objects through keyed reconciliation.
- Update relationships only when endpoints/obstacles truly change.
- Preserve hidden objects in save/export canonical metadata according to existing contract.

Locking changes:

- Patch interaction state and Objects-tree state.
- Do not reroute or rebuild geometry.
- Respect locked objects in selection, move, resize, delete, and group commands.

## Groups

Implement Diagram 1 group behavior:

- Group selected objects
- Ungroup
- Nested or logical group behavior if supported
- Move group
- Resize behavior if applicable
- Copy/paste group
- Template group
- Visibility/locking propagation
- Virtualization force-mount of required group members
- ID remapping

Use explicit group indexes to avoid scanning all objects during every gesture.

## Alignment and distribution

If Diagram 1 supports alignment/distribution, implement it now:

- Left/right/top/bottom/center
- Horizontal/vertical distribution
- Same size where applicable

Each operation should be one composite command and one batched renderer transaction.

## Complete clipboard parity

Expand copy/paste coverage to:

- Core shapes
- Text and rich text
- Images
- Groups
- Entities
- Entity annotations
- Two or more related Entities
- Relationships
- Manual routes
- Field Rectangles
- Field mappings
- Field Mapping Tables
- Mixed locked/unlocked selections

Test:

```text
Diagram 1 copy → Diagram 2 paste
Diagram 2 copy → Diagram 1 paste
Cross browser tab in both directions
Repeated paste
Unsupported future version rejection
```

## Object Templates

Use the same template endpoints and canonical template format.

Implement Diagram 2 UI for:

- Open template library
- Apply template
- Create template from selection
- Update
- Rename
- Delete
- Restore defaults
- Import/export template file if Diagram 1 supports it
- Format-only template application
- Repeated placement offsets
- Template preview

Do not create a Diagram 2-only canonical template store.

Template application must execute as one composite command and patch only added/changed objects.

## Performance requirements

- Objects-tree selection must not reroute.
- Rename/lock must not rebuild canvas geometry.
- Z-order must not rebuild nodes.
- Group move uses live preview and one commit.
- Template application must batch all additions/changes into one flush.
- Large paste must show progress only if measured necessary, but must avoid one render per pasted object.
- Tree rendering must remain responsive at 1,000 objects.

## Acceptance criteria

- Canonical Objects tree is complete.
- Structure operations are feature-parity complete for this scope.
- Cross-screen clipboard matrix passes.
- Shared Object Templates work both ways.
- Incremental renderer invariants remain intact.
- No second template or clipboard contract exists.


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


---

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


---

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


# Phase 6 — Images, Crop, Entity Annotations, Field Rectangles, UI-to-Database Mapping, and Field Mapping Tables

## Purpose

Implement PMT's advanced Diagram and Image Annotation capabilities in Diagram 2 without weakening the renderer.

## Expected outcome of this phase

Diagram 2 supports the same meaningful advanced workflows as Diagram 1:

- Insert and manage images
- Crop and corner-radius controls
- Entity annotations
- Field Rectangles
- Mapping Field Rectangles to database fields
- Many-to-one mappings
- Field Mapping Tables
- Mapping inspector tab
- Read-only and edit hover/highlight behavior
- Relationship layering around screenshots
- Advanced style controls
- Save/export/round-trip

## Image insertion and assets

Use existing upload and embedded-image services.

Support:

- Add image
- Embedded source/portable source behavior
- Original image reference
- Resize
- Crop
- Opacity/style where supported
- Z-order
- Copy/paste
- Templates
- Save/export
- Missing-image fallback

Do not decode/reload every image on unrelated state changes.

Cache image resources carefully and release them on destroy.

## Crop mode

Reproduce current Diagram 1 behavior:

- Enter/exit crop mode
- Handles
- Inset adjustment
- Per-corner radius
- Selection chrome suppression during fine adjustment
- Original image preservation
- Commit/cancel
- Keyboard behavior
- One history command per completed crop adjustment

Crop preview must patch only the image and crop overlay.

## Entity annotations

Implement:

- Link annotations to Entity
- Arrows/relationships
- Movement synchronization
- Group/logical membership
- Copy/paste ID remapping
- Template behavior
- Objects-tree representation
- Save/round-trip
- Visibility/layering

Use explicit reference indexes rather than global scans during Entity movement.

## Field Rectangles

Implement full Diagram 1 parity:

- Create Field Rectangle
- Edit name/mapping metadata
- Style
- Selection
- Move/resize
- Relationship lines above screenshot images
- Database-field target
- Mapping removal
- Multiple mappings where supported
- Virtual Entity/reference behavior
- Objects tree
- Clipboard/templates
- Read-only interaction

## UI-to-database field mapping

Reproduce:

- Mapping creation
- Endpoint anchoring
- Many-to-one mapping
- Correct target field
- Hover behavior
- Single-click selection
- Double-click behavior
- Read-only behavior
- Mapping visibility controls
- Relationship opacity/style
- Highlight color/thickness
- Attention arrows
- Starting coordinates after rendered label text
- Existing correct endpoint logic

Mapping hover is a transient overlay. It must not mutate canonical state, route unrelated relationships, or create history.

## Field Mapping Tables

Implement:

- Create table
- Dynamic rows from mappings
- UI and Database columns
- Header/body style controls
- Row hover fill
- Mapping highlight color and thickness
- Current hover and click behavior
- Edit/read-only parity
- Automatic synchronization when mappings change
- Save/export
- Clipboard/templates
- Objects tree
- Large table performance

Do not rebuild all Diagram objects when one mapping row changes.

Maintain indexes such as:

```text
mapping IDs by Field Rectangle
mapping IDs by Entity field
Field Mapping Table row keys
highlight targets by mapping
```

## Layering

Preserve exact plane contracts so:

- Screenshot images
- Field Rectangles
- Field Rectangle relationships
- Entity relationships
- Field Mapping Tables
- Hover overlays
- Selection overlays

appear in the intended order without broad DOM reconstruction.

## Image Annotation regression

Diagram 1 and RTE Image Annotation share current domain/rendering helpers. Any shared extraction must preserve existing Image Annotation behavior.

Run regression checks for:

- PNG
- SVG
- Crop
- Templates
- Rich text
- Annotation save
- Existing Diagram 1 advanced features

## Performance tests

Assert:

- Hover/highlight does not change full-render count.
- Mapping row hover patches overlays only.
- Adding/removing one mapping updates only affected objects/relationships/table rows.
- Image crop pointer frames avoid full render.
- Large screenshots do not repeatedly decode on selection.
- 500/1,000 Entity Diagram with a localized mapping region remains focused and usable.

## Acceptance criteria

- Advanced PMT Diagram features work in Diagram 2.
- Field Mapping behavior matches Diagram 1 observably.
- Image Annotation does not regress.
- Transient hover/highlight remains noncanonical and incremental.
- Diagram 1 ↔ Diagram 2 round-trip is exact.


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


---

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


# Phase 7 — Complete Persistence, Import/Export, Dialogs, Keyboard, Accessibility, and UX Parity

## Purpose

Close all remaining functional and user-experience gaps after the major editor features exist.

## Expected outcome of this phase

Diagram 2 is functionally complete for the current Diagram 1 feature set and safely interoperable in both directions.

## New and duplicate Diagram workflows

Implement equivalent behavior for:

- New Diagram
- Untitled/default naming
- Backing document creation
- Edit Info
- Project/Sprint
- Parent
- Privacy
- Pinning
- Duplicate
- Delete
- Public link where applicable
- Card and Treeview selection

Continue using the same backing records and services.

## Save

Before save:

1. Commit or cancel active gesture according to user intent.
2. Flush pending dirty state.
3. Validate canonical state and references.
4. Synchronize derived canonical structures that are part of the existing format.
5. Build complete metadata.
6. Build complete shared SVG.
7. Save through the existing service and row-version mechanism.

Never save:

- Mounted-only state
- Low-detail visual state
- Selection handles
- Preview transforms
- Route caches
- Dirty flags
- Viewport sectors
- Diagnostics
- Editor pane state

## Import

Implement current PMT Diagram import behavior:

- Shared `pmt-diagram` version 1 codec
- Safe validation
- Unknown extension preservation
- Clear rejection of unsupported future versions
- ID/reference validation
- Asset handling
- One global history entry
- Full canonical import
- Incremental renderer commit after parsing
- Complete round-trip into Diagram 1

Do not parse or rebuild the import repeatedly during normal screen load.

## Export

Verify:

- PMT Diagram JSON
- Complete SVG
- PNG
- Portable SVG/assets
- Selection clipboard
- Any Diagram 1 export options or visibility toggles

Exports must be complete and detailed regardless of current zoom, virtualization, or low-detail mode.

## Dialog parity

Inventory must now show all current Diagram 1 dialogs complete, including as applicable:

- Entity editor
- Relationship settings
- Manual route controls
- Templates
- Import/export options
- Color/text dialogs
- Field mapping controls
- Crop controls
- Confirmation prompts
- Save conflict handling

Dialogs must preserve keyboard focus, Escape/Enter behavior, and cleanup.

## Keyboard parity

Implement and test current Diagram 1 shortcuts:

- Undo/redo
- Copy/paste
- Delete
- Select All
- Arrow nudge
- Shift nudge
- Tool shortcuts if present
- Escape/cancel
- Enter/commit
- Zoom controls if present
- Context menu keyboard access

Shortcuts must not fire while typing in text/rich-text/form controls unless intended.

## Context menus and pointer behavior

Complete:

- Canvas context menu
- Object context menu
- Relationship context menu
- Objects-tree context menu
- Read-only Diagram context menu
- Touch/pointer considerations where currently supported

## Accessibility

Ensure:

- Toolbar labels and pressed states
- Inspector labels
- Focus order
- Keyboard access
- Dialog focus trapping where PMT conventions require it
- Visible focus
- High-contrast-safe selection indicators
- No focus loss during keyed reconciliation or virtualization
- Read-only versus edit semantics

## Full round-trip matrix

For every supported canonical object type and major feature:

```text
Diagram 1 create/edit/save → Diagram 1
Diagram 1 create/edit/save → Diagram 2
Diagram 2 create/edit/save → Diagram 2
Diagram 2 create/edit/save → Diagram 1
Diagram 1 edit Diagram 2 save → Diagram 2
Diagram 2 edit Diagram 1 save → Diagram 1
```

Compare normalized canonical state, not insignificant SVG whitespace.

Include:

- Shapes
- Text/rich text
- Images/crop
- Groups
- Locks/visibility/order
- Entities and fields
- Relationships and manual routes
- Collapse/data-type settings
- Annotations
- Field Rectangles
- Mappings
- Field Mapping Tables
- Templates
- Unknown extensions

## Parity matrix gate

Update the authoritative parity matrix.

No item may remain:

```text
Not Started
UI Only
Command Missing
History Missing
Roundtrip Missing
Performance Untested
```

unless Sin explicitly approves it as deferred.

## Acceptance criteria

- Diagram 2 is functionally complete for the current Diagram 1 editor.
- Every visible control works.
- Round-trip matrix passes.
- Save/export is canonical and complete.
- Permissions and conflicts use existing PMT behavior.
- Accessibility and keyboard behavior are acceptable.
- Performance has not regressed.


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


---

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


# Phase 8 — Final Performance Hardening, 500/1,000-Entity Stress, and Promotion Readiness

## Purpose

Prove that feature parity did not destroy Diagram 2's performance advantages and determine whether it is ready to become PMT's primary Diagram editor.

## Expected outcome of this phase

- Diagram 2 has complete approved feature parity.
- Performance remains dramatically better than Diagram 1.
- Normal, 232, 500, and 1,000 Entity tiers are measured.
- No critical correctness, compatibility, memory, or lifecycle issues remain.
- Known limitations are documented honestly.
- Diagram 1 remains available until Sin separately approves promotion.

## Benchmark methodology

Use controlled, apples-to-apples comparisons.

For Diagram 1 and Diagram 2:

- Same document
- Same browser
- Same viewport
- Same CPU mode
- Same cache state
- Same timing boundaries
- Same number of repetitions
- Same inclusion/exclusion of network/database time
- Median, p90, p95, and maximum where practical

Do not compare a complete Diagram 1 page load against only a detached Diagram 2 renderer and label it an exact end-to-end factor.

Renderer-only comparisons are useful, but label them renderer-only.

## Required fixtures

### Tier A — Normal

- PMT Database Schema
- Approximately 28–30 Entities
- Real field counts and relationships
- Advanced PMT objects where available

### Tier B — Large office schema

- 220–232 Entities
- Approximately 624 relationships
- Sparse/dense variants
- High fan-out
- Self references
- Long routes
- Manual routes
- Advanced objects

### Tier C — 500 Entities

Use the latest production-shaped benchmark approach:

- Clone real PMT Schema patterns.
- Add realistic Entities.
- Add approximately 1–3 relationships per added Entity.
- Include realistic fields.
- Avoid a meaningless blank-box-only benchmark.

### Tier D — 1,000 Entities

Use a production-shaped fixture with:

- Realistic field counts
- 1–3 relationships per added Entity
- Long cross-sector routes
- Selected/active region
- Complete Fit
- Save/export
- Ten lifecycle cycles

## Required operations

Measure:

```text
Screen open
Canonical parse
First useful frame
Final settle
Selection
Multi-select
Marquee
Clear selection
Drag start
Drag preview p95
Resize start
Resize preview p95
Style change
Text edit commit
Entity field edit
Collapse/expand
Show/hide data types
Relationship style
Manual route edit
Mapping hover
Template apply
Paste
Undo
Redo
Continuous zoom
Pan
Sector crossing
Low-detail transition
Fit
Auto Format
Save
SVG export
PNG export
Import
Diagram 1 round-trip
Ten open/close cycles
```

## Renderer invariant tests

For routine operations assert:

- Full-render count does not increase.
- SVG root identity is stable.
- Unrelated object node identity is stable.
- Selection does not route.
- Style-only relationship updates do not route.
- Local geometry does not route all relationships.
- Same-sector scrolling changes no DOM.
- Selected/gesture objects stay mounted.
- Low detail never leaks to save/export.
- History uses commands for local operations.
- No unbounded state snapshots.
- No stale listeners/frames/observers/workers.

## Performance profiling and optimization

Use browser performance profiles to identify:

- Forced synchronous layouts
- Repeated text measurement
- Repeated serialization
- Excessive cloning
- Long tasks
- Relationship route hotspots
- Tree rendering hotspots
- Inspector re-render hotspots
- Image decoding
- Garbage generation
- Event listener churn
- Large paste/template transactions
- Auto Format compute

Optimize measured bottlenecks, not speculative ones.

Permitted improvements include:

- More indexes
- Memoized renderer-neutral derived data
- Coarser/finer measured sectors
- Worker-backed global layout
- Chunked noninteractive initial work
- Offscreen preparation
- Tree virtualization
- Coalesced form updates
- Object pooling only if measured and safe
- Lower-detail relationship aggregation
- Progressive optional detail

Do not sacrifice canonical correctness or interoperability.

## Promotion criteria

Recommend Diagram 2 as primary only if:

- Parity matrix is complete and approved.
- No critical regressions.
- Diagram 1 ↔ Diagram 2 round-trip matrix passes.
- 28 and 232 tiers meet normal interaction targets.
- 500 tier is practical.
- 1,000 tier opens and supports focused editing and low-detail overview.
- Memory stabilizes after repeated cycles.
- Save/export is complete.
- Accessibility and permissions pass.
- Known limitations are acceptable to Sin.

Do not remove Diagram 1 in this phase.

Provide options:

```text
Keep Diagram 2 Beta
Make Diagram 2 default but retain Diagram 1 fallback
Rename/promote Diagram 2 after separate approval
Retire Diagram 1 only after a later explicit decision
```

## Final report

Produce a permanent self-contained HTML report and Markdown summary containing:

- Executive verdict
- Feature parity results
- Controlled benchmark tables
- Charts
- Methodology
- Machine/browser details
- Normal and 6× CPU results
- Correctness and compatibility
- Memory/lifecycle
- Remaining limitations
- Recommendation
- Raw JSON data
- Screenshots

## Acceptance criteria

- Full parity is proven.
- Performance is proven with controlled tests.
- 500 and 1,000 Entity behavior is documented.
- No critical lifecycle leaks.
- No compatibility loss.
- Promotion recommendation is evidence-based.


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
