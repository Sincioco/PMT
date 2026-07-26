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

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## RTE annotation workflow is a first-class deliverable

This phase must complete the practical `Annotate 2.0` and `Edit Annotate 2.0` workflows.

### Context-menu labels

For a supported unannotated image:

```text
Annotate
Annotate 2.0
```

For a supported image containing editable annotation metadata:

```text
Edit Annotate
Edit Annotate 2.0
```

Use the existing trusted annotation-metadata detection. Do not infer editability from filename or visible text alone.

### New annotation workflow

```text
RTE
→ select image
→ right-click
→ Annotate 2.0
→ Diagram 2 RTE host
→ add/edit objects
→ Save
→ update same RTE image with complete editable metadata
→ restore RTE focus/context
```

Opening alone must not modify the RTE.

### Existing annotation workflow

```text
RTE
→ select annotated image
→ Edit Annotate 2.0
→ parse complete canonical metadata
→ edit through shared commands
→ Save back to same image
```

Do not flatten editable content.

### Cancel workflow

Cancel must:

- Leave the source image and RTE HTML unchanged.
- Release temporary images/object URLs.
- Dispose editor/renderer resources.
- Restore RTE focus and selection.

### Visual parity

The RTE-hosted editor should look like the existing Diagram 1 annotation editor for applicable tools and tabs. Omit only standalone document-library/metadata controls that do not apply.

### Images, crop, annotation, and mapping implementation

All Phase 6 tools must use the same shared editor core in both hosts:

- Image insertion/assets.
- Crop/inset/radius.
- Entity annotations.
- Field Rectangles.
- UI-to-database mappings.
- Field Mapping Tables.
- Mapping tab and hover/selection behavior.

Crop and mapping gestures must use preview/commit behavior and localized invalidation.

### Cross-version RTE matrix

Run:

```text
Annotate → Edit Annotate
Annotate → Edit Annotate 2.0
Annotate 2.0 → Edit Annotate 2.0
Annotate 2.0 → Edit Annotate
```

Document any feature that cannot round-trip and obtain Sin's approval before deferral.

### Lifecycle/performance

Test ten RTE open/save/cancel/close cycles and alternating RTE/top-navigation sessions. Confirm no continuing memory growth and no fallback to the Diagram 1 full-render path.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

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
