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
