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
