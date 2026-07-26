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

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Visual parity and dual-host editor constitution

### Visual parity is mandatory

Diagram 2's editor should look and feel like Diagram 1's editor unless Sin approves an intentional improvement.

Preserve, where applicable:

- Overall editor layout.
- Toolbar grouping, order, labels, icons, tooltips, active states, and disabled states.
- Objects pane behavior.
- Inspector tab names, order, fields, grouping, and mixed-selection behavior.
- Dialogs, context menus, keyboard shortcuts, and selection affordances.
- Canvas cursors, drag/resize handles, crop handles, relationship handles, mapping highlights, and hover behavior.

The visible UI may be shared or reproduced. The implementation behind it must be Diagram 2-specific when Diagram 1's implementation would cause broad rendering, global routing, unstable nodes, or hot-path canonical serialization.

The required result is:

```text
Same familiar editor
Same user-visible behavior
Same canonical saved result
Different high-performance implementation
```

### One editor core, two first-class hosts

Diagram 2 must be launchable from:

```text
1. RTE image context menu:
   Annotate 2.0
   Edit Annotate 2.0

2. PMT top navigation:
   Diagram 2
```

Diagram 1 remains available side by side:

```text
Annotate
Edit Annotate
Diagram
```

Both Diagram 2 entry points must share:

- Editor controller.
- Renderer-neutral commands.
- Command-based history.
- Selection model.
- Toolbar and inspector command definitions.
- Canonical state.
- Templates and clipboard logic.
- Diagram 2 renderer.
- Performance diagnostics and cleanup rules.

Only host adapters may differ:

| Responsibility | RTE annotation host | Diagram document host |
|---|---|---|
| Source | Selected RTE image/annotation | Selected Diagram document |
| Save target | Update the originating RTE image | Save the backing Diagram record |
| Cancel/close | Restore RTE without modifying content | Discard/retain document state according to normal navigation rules |
| Route | Normally unchanged | `#/diagram-2` or `#/diagram-2/{id}` |
| Document library | Not required | Required |
| Metadata and row version | Usually not applicable | Required |
| Editor core | Shared | Shared |

Do not build two separate Diagram 2 editors.

### Dual-host definition of done

The program is not complete until:

- `Annotate 2.0` creates a new editable annotation from a selected RTE image.
- `Edit Annotate 2.0` opens existing shared annotation metadata.
- Save writes back to the same RTE image only after the user confirms Save.
- Cancel leaves the RTE content unchanged and restores focus/context.
- Top-navigation Diagram 2 edits the same backing documents as Diagram 1.
- Diagram 1 annotations/documents open in Diagram 2.
- Diagram 2 saves reopen in Diagram 1 for supported shared features.
- Both hosts pass repeated lifecycle and memory-cleanup tests.
- Performance protections apply equally to both hosts.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

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
