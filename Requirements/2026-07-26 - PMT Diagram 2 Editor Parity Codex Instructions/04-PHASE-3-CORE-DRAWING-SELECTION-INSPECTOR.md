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
