# PMT Diagram 2 Full Editor Parity — All-in-One Codex Instructions

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`.

This file is generated from the complete updated phase package. The individual phase files remain the authoritative execution checkpoints.

---

<!-- BEGIN FILE: 00-START-HERE.md -->

# Start Here — PMT Diagram 2 Full Editor Parity Instructions

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


## What this package is for

Diagram 2 already has a substantially faster rendering engine, but its current editing layer is too limited to replace Diagram 1. This instruction series directs Codex to turn Diagram 2 into a complete high-performance Diagram editor.

The files use larger implementation phases. They are intentionally not split into tiny daily tasks.

## The expected final outcome

When Codex finishes every phase:

1. Diagram 2 is a complete and useful Diagram editor, not merely a renderer.
2. A user familiar with Diagram 1 can perform the same meaningful work in Diagram 2:
   - Create and edit every supported object type.
   - Use equivalent toolbar tools.
   - Use equivalent inspector tabs and controls.
   - Use the Objects tree, groups, ordering, visibility, locking, selection, context menus, and keyboard shortcuts.
   - Create and edit Entities, fields, relationships, manual routes, annotations, Field Rectangles, UI-to-database mappings, and Field Mapping Tables.
   - Use templates, clipboard, import, export, save, undo, and redo.
3. Diagram 2 can open existing Diagram 1 documents without conversion.
4. Diagram 1 can reopen Diagram 2 saves without data loss.
5. Both screens continue to use the same backing Diagram document, canonical state, template library, clipboard package, and PMT Diagram file format.
6. Diagram 2 preserves its high-performance architecture. Routine operations remain incremental and do not reintroduce Diagram 1's full-render and full-routing problems.
7. Diagram 1 remains available until Sin separately approves Diagram 2 as the default or replacement.
8. A complete feature-parity matrix and benchmark report prove the result.

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Integrated requirements added after Phase 1

The instruction package now contains two mandatory addenda that apply to Phase 2 and every later phase:

1. `01A-ADDENDUM-DIAGRAM-2-VISUAL-EDITOR-PARITY-MANDATE.md`
2. `01B-ADDENDUM-DIAGRAM-2-DUAL-ENTRY-POINTS-RTE-ANNOTATE-AND-TOP-NAVIGATION.md`

These requirements are also integrated directly into the updated Phase 2–8 files, parity matrix, completion report, and all-in-one instructions.

### Mandatory visual outcome

Diagram 2 must visually present the familiar Diagram 1 editor unless Sin explicitly approves a deliberate difference. Preserve the recognizable toolbar, tool order, icons, tooltips, Objects pane, inspector tabs, dialogs, context menus, selection affordances, and keyboard behavior.

Visual parity does **not** authorize copying Diagram 1's slow rendering lifecycle. Each operation must be implemented through Diagram 2's command system and incremental renderer.

### Mandatory two-entry-point outcome

One shared Diagram 2 editor core must support two first-class hosts:

```text
RTE image context menu:
    Annotate 2.0
    Edit Annotate 2.0

Top navigation:
    Diagram 2
```

The existing Diagram 1 commands remain available side by side during testing:

```text
Annotate
Edit Annotate
Diagram
```

The two Diagram 2 hosts share the editor controller, commands, history, canonical state, toolbar/inspector logic, and high-performance renderer. Only host-specific concerns differ: source, save target, cancel/close behavior, routing, document library, metadata, and row-version handling.

### Reading order before every phase

Before beginning or continuing a phase, Codex must read:

1. `01-MASTER-EXPECTED-OUTCOME-AND-PERFORMANCE-CONSTITUTION.md`
2. `01A-ADDENDUM-DIAGRAM-2-VISUAL-EDITOR-PARITY-MANDATE.md`
3. `01B-ADDENDUM-DIAGRAM-2-DUAL-ENTRY-POINTS-RTE-ANNOTATE-AND-TOP-NAVIGATION.md`
4. The current phase file
5. The current feature-parity matrix
6. The latest completed phase report

Phase 1 is complete. Do not rerun it wholesale. Reconcile its architecture deliverables with the two addenda, then proceed to the updated Phase 2.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## What Codex is allowed to change internally

Codex should reproduce Diagram 1's user-facing behavior, but it does not have to reproduce Diagram 1's code structure.

Codex is explicitly authorized to:

- Re-think feature implementations.
- Extract renderer-neutral shared domain helpers.
- Create a cleaner Diagram 2 editor controller and shell.
- Implement command-based history.
- Use spatial indexes and cached derived data.
- Defer expensive work until gesture settle.
- Use lightweight previews.
- Use a Web Worker for measured, pure, expensive global computation such as Auto Format when worthwhile.
- Replace inefficient Diagram 1 algorithms with faster equivalents, provided saved canonical results remain compatible.

## What Codex must not do

- Do not copy the entire Diagram 1 editor into Diagram 2 as one block.
- Do not call Diagram 1's full render cycle from Diagram 2.
- Do not build routine UI behavior around full canonical JSON snapshots.
- Do not persist Diagram 2 renderer caches.
- Do not fork the file format, clipboard format, templates, backing documents, or database schema.
- Do not claim parity based only on toolbar appearance.
- Do not mark the program complete while parity items remain `Not Started`, `UI Only`, or `Untested`.

## Recommended execution order

Feed Codex these files in order:

1. `01-MASTER-EXPECTED-OUTCOME-AND-PERFORMANCE-CONSTITUTION.md`
2. `01A-ADDENDUM-DIAGRAM-2-VISUAL-EDITOR-PARITY-MANDATE.md`
3. `01B-ADDENDUM-DIAGRAM-2-DUAL-ENTRY-POINTS-RTE-ANNOTATE-AND-TOP-NAVIGATION.md`
4. `02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md` — already completed; retain as the architectural record and amend only missing addendum-related findings
5. `03-PHASE-2-EDITOR-FOUNDATION-COMMANDS-HISTORY-SHELL.md`
6. `04-PHASE-3-CORE-DRAWING-SELECTION-INSPECTOR.md`
7. `05-PHASE-4-STRUCTURE-OBJECTS-TREE-GROUPS-LAYERS-CLIPBOARD-TEMPLATES.md`
8. `06-PHASE-5-ENTITY-ERD-RELATIONSHIPS-AUTO-FORMAT.md`
9. `07-PHASE-6-IMAGES-CROP-ANNOTATIONS-FIELD-MAPPING.md`
10. `08-PHASE-7-SAVE-IMPORT-EXPORT-ROUNDTRIP-UX-PARITY.md`
11. `09-PHASE-8-PERFORMANCE-HARDENING-500-1000-ENTITY-PROMOTION.md`

Use throughout:

- `10-FEATURE-PARITY-MATRIX-TEMPLATE.md`
- `11-CODEX-COMPLETION-REPORT-TEMPLATE.md`

`ALL-IN-ONE-CODEX-INSTRUCTIONS.md` is regenerated from this complete updated package. Phase-by-phase execution remains safer because every phase ends with manual, compatibility, visual-parity, dual-host, and performance gates.

<!-- END FILE: 00-START-HERE.md -->

---

<!-- BEGIN FILE: 01-MASTER-EXPECTED-OUTCOME-AND-PERFORMANCE-CONSTITUTION.md -->

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

<!-- END FILE: 01-MASTER-EXPECTED-OUTCOME-AND-PERFORMANCE-CONSTITUTION.md -->

---

<!-- BEGIN FILE: 01A-ADDENDUM-DIAGRAM-2-VISUAL-EDITOR-PARITY-MANDATE.md -->

# PMT Diagram 2 Editor Parity Program

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


# Addendum — Diagram 2 Visual Editor Parity Mandate

## Placement and execution order

This is a **new addendum** to the Diagram 2 editor-parity instruction series.

It is intentionally named so it appears immediately after:

```text
01-MASTER-EXPECTED-OUTCOME-AND-PERFORMANCE-CONSTITUTION.md
```

and immediately before:

```text
02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md
```

Phase 1 has already been completed. Do not repeat Phase 1 unless a specific missing inventory item is discovered.

Read this addendum now, incorporate it into the approved Phase 1 architecture, and apply it to Phase 2 and every later implementation phase.

If earlier instructions could be interpreted as encouraging a visually different, simplified, or developer-oriented Diagram 2 editor, this addendum takes precedence:

> **Diagram 2 must visually look and feel like Diagram 1's editor unless Sin explicitly approves a deliberate UI change.**

---

# 1. Expected final outcome

When the Diagram 2 editor-parity program is complete, a user familiar with Diagram 1 should be able to open Diagram 2 and immediately recognize the same editor.

Diagram 2 should provide, where applicable:

- The same overall editor layout.
- The same toolbar position and grouping.
- The same toolbar button order.
- The same icons, labels, tooltips, and enabled/disabled behavior.
- The same left-side Objects pane.
- The same center Diagram canvas.
- The same right-side inspector.
- The same inspector tab names and order.
- The same fields and controls inside each tab.
- The same dialogs and context menus.
- The same selection, resize, crop, mapping, and relationship affordances.
- The same keyboard shortcuts.
- The same save, import, export, template, and document workflows.
- The same observable feature behavior.
- The same Diagram data after saving.

The intended user reaction is:

> **"This is the Diagram editor I already know, but it opens faster and stays responsive on much larger Diagrams."**

Diagram 2 must not feel like:

- A stripped-down technical renderer.
- A developer demonstration.
- A diagnostics screen.
- A separate unfamiliar product.
- A reduced editor that forces users to return to Diagram 1 for normal work.

The completed Diagram 2 editor must be useful by itself.

---

# 2. Same appearance does not mean same implementation

Codex must distinguish between:

```text
Visual and behavioral parity
```

and:

```text
Copying Diagram 1's internal implementation
```

Visual and behavioral parity is required.

Blindly copying Diagram 1's internal implementation is prohibited when it could reintroduce Diagram 1's performance problems.

For every Diagram 1 toolbar command, inspector control, context-menu action, keyboard shortcut, and editing gesture:

1. Inspect the visible markup, styling, label, icon, tooltip, order, state, and user-visible result.
2. Trace the canonical Diagram-state mutation and business rules.
3. Reproduce the same user-visible behavior in Diagram 2.
4. Route the operation through Diagram 2's editor controller, command system, dirty-state classification, and incremental renderer.
5. Redesign the internal implementation whenever Diagram 1 depends on:
   - Complete live SVG rebuilding.
   - Recreating the editor shell.
   - Broad relationship rerouting.
   - Global object scans during every pointer movement.
   - Repeated complete-state serialization.
   - Snapshot history for small local operations.
   - Direct manipulation of Diagram 1 renderer-owned SVG nodes.
   - Rebuilding all overlays after a small change.
   - Recalculating unrelated bounds, sectors, or relationships.
   - Heavy compatibility proofs during normal document loading.
   - Replacing large containers with `innerHTML` during interaction.
   - Losing stable DOM identity for retained objects.

The required result is:

```text
Same familiar UI
Same feature behavior
Same persisted Diagram result
Different high-performance implementation
```

---

# 3. Visual parity is the default decision

Do not redesign the Diagram editor merely because Diagram 2 uses a new renderer.

Unless Sin explicitly approves a change, preserve Diagram 1's visible structure and workflows.

## 3.1 Editor structure

Preserve, where applicable:

- Toolbar location.
- Toolbar grouping and separators.
- Canvas position.
- Objects tab position and behavior in the right inspector pane, matching the approved Phase 2 baseline.
- Right inspector position and behavior.
- Inspector tab order.
- Save, Undo, and Redo placement.
- Full-screen editing behavior.
- Pane collapsing and resizing.
- Dialog placement and modality.
- Context-menu organization.
- Responsive desktop behavior.
- Selection-dependent controls.
- Permission-dependent controls.
- Empty-selection and multiple-selection states.

## 3.2 Toolbar presentation

For each Diagram 1 toolbar item, preserve where practical:

- Icon.
- Label.
- Tooltip.
- Button order.
- Group membership.
- Active state.
- Toggle state.
- Disabled state.
- Selection requirements.
- Permission requirements.
- Keyboard shortcut.
- Dropdown or flyout behavior.
- Default-style actions.
- Confirmation behavior.

Do not replace recognizable Diagram 1 toolbar groups with a generic developer toolbar.

Renderer diagnostics, Refresh Renderer, internal counters, and benchmark controls must not dominate the production editor. Keep diagnostics available through a development-only or collapsible diagnostics surface.

## 3.3 Inspector presentation

For each Diagram 1 inspector tab, preserve where practical:

- Tab name.
- Tab order.
- Tab icon.
- Field order.
- Group headings.
- Dividers.
- Labels.
- Help text.
- Input type.
- Default values.
- Conditional visibility.
- Enabled/disabled rules.
- Color-picker behavior.
- Numeric step behavior.
- Checkbox and toggle behavior.
- Apply-to-selection behavior.
- Empty-selection behavior.
- Mixed-value presentation for multiple selection.

## 3.4 Canvas presentation

Preserve the expected visual behavior for:

- Selection outlines.
- Resize handles.
- Rotation or special handles where supported.
- Relationship handles.
- Field-mapping handles.
- Crop handles.
- Hover highlights.
- Marquee selection.
- Selected-object layering.
- Snap guides if present.
- Cursor changes.
- Drag feedback.
- Relationship previews.
- Context-menu targets.
- Zoom and pan interaction.

Diagram 2 may use different SVG planes, overlays, hit paths, spatial indexes, and renderer APIs internally.

---

# 4. Reuse shared visual components where safe

Reuse PMT's renderer-neutral visual infrastructure whenever practical, including:

- Button components.
- Form components.
- Tab components.
- Dialog infrastructure.
- Color picker.
- Dropdowns.
- Checkbox and toggle controls.
- Tooltips.
- Icons.
- Typography.
- Spacing variables.
- Theme variables.
- Common panel styling.
- Shared accessibility helpers.
- Shared permission checks.

Reuse should reduce duplication without coupling Diagram 2 to Diagram 1's renderer lifecycle.

When sharing a component would require Diagram 2 to call Diagram 1's full-render or legacy DOM path, create a Diagram 2-specific controller or adapter instead.

A reasonable approach is:

- Reuse visual builders and common CSS when they are renderer-neutral.
- Keep Diagram 2 command handlers and canvas interactions separate.
- Extract shared presentation only after the boundary is understood.
- Do not destabilize Diagram 1 merely to remove a small amount of duplicate markup.

---

# 5. Required implementation boundary

The intended architecture is:

```text
Diagram 2 toolbar, inspector, Objects pane, dialogs, and shortcuts
                              |
                              v
                 Diagram 2 editor controller
                              |
                              v
                 Renderer-neutral editor commands
                              |
                              v
                   Canonical Diagram state
                              |
                              v
          Diagram 2 dirty-state and renderer APIs
                              |
                              v
    Persistent keyed SVG nodes, selective routing, virtualization
```

The UI must not directly regenerate the Diagram SVG.

The UI must not directly manipulate renderer-owned SVG nodes except through formally defined renderer or overlay APIs.

The editor controller must be responsible for:

- Validating commands.
- Applying canonical-state changes.
- Creating undoable operations.
- Classifying dirty state.
- Invoking the smallest required renderer update.
- Updating selection and inspector state.
- Preserving Diagram 1 and Diagram 2 file compatibility.

---

# 6. Feature-by-feature parity rule

For every Diagram 1 feature, Codex must create a Diagram 2 equivalent that satisfies all of the following.

## 6.1 Visual parity

- The control appears in the expected location.
- It uses the expected icon, label, tooltip, and state.
- The related tab, dialog, context menu, or overlay looks familiar.
- Any intentional visual difference is documented and requires Sin's approval.

## 6.2 Behavioral parity

- The same user action produces the same canonical Diagram result.
- Dialogs, validation, confirmation, and errors remain equivalent where practical.
- Selection behavior matches Diagram 1.
- Multi-selection behavior matches Diagram 1.
- Object-specific and tab-specific behavior matches Diagram 1.

## 6.3 Compatibility

- Diagram 2 opens existing Diagram 1 documents.
- Diagram 1 reopens Diagram 2 saves.
- No conversion command is required.
- No `pmt-diagram-2` format is introduced.
- No second template library is introduced.
- No second clipboard schema is introduced.
- Unknown safe extension data is preserved where the shared codec supports it.
- Renderer caches, mounted-node state, dirty state, and low-detail state are never persisted.

## 6.4 History

- The operation has correct Undo and Redo behavior.
- One user gesture creates one logical history entry.
- Typing, slider movement, color previews, and drag frames are coalesced appropriately.
- Local commands use command/delta history.
- Full snapshots are reserved for genuinely global operations.

## 6.5 Incremental rendering

- Only affected objects, overlays, relationships, bounds, and sectors are invalidated.
- Unrelated nodes retain identity.
- Ordinary local operations do not call a complete live `renderer.render(...)`.
- Local edits do not reroute every relationship.
- Selection changes do not trigger geometry work.
- Style changes do not trigger relationship routing unless the changed style affects route geometry.

## 6.6 Performance verification

- Test the feature on a normal Diagram and a large Diagram.
- Confirm no unnecessary full live render.
- Confirm no unrelated relationship rerouting.
- Confirm viewport virtualization remains active when appropriate.
- Confirm low-detail rendering remains active at overview scale.
- Measure the operation before and after implementation.
- Record any performance regression and fix it before declaring the feature complete.

## 6.7 Automated and manual validation

- Unit tests cover renderer-neutral commands where practical.
- Browser tests cover the actual UI workflow.
- The feature is added to the parity matrix.
- Save and cross-screen round-trip are tested.
- Manual approval is recorded.

A feature is not complete merely because its toolbar button or tab is visible.

---

# 7. Performance preservation mandate

Diagram 2's current performance architecture is a protected asset.

Do not weaken or bypass:

- Persistent keyed SVG nodes.
- Transform-only zoom and pan.
- Dirty-state batching.
- One scheduled flush per animation frame.
- Geometry preview during drag and resize.
- Selective relationship routing.
- Route caching.
- Spatial indexes.
- Viewport-plus-halo virtualization.
- Force-mounted selected and active-gesture objects.
- Low-detail overview rendering.
- Full-detail canonical save and export.
- Explicit renderer cleanup.
- Stable retained-node identity.

Every new UI feature must work within these systems.

If Diagram 1's implementation conflicts with these systems, redesign the feature for Diagram 2 while preserving the same user-visible behavior.

---

# 8. Phase 2-specific clarification

Phase 2 should establish the real Diagram 2 editor shell.

The Phase 2 shell should visually converge toward Diagram 1 immediately rather than creating another temporary UI that will later be discarded.

Phase 2 should include, as appropriate to its existing scope:

- Diagram 1-style editor layout.
- Diagram 1-style toolbar structure, even when later feature buttons are initially disabled or gated.
- Right inspector Objects tab/pane shell.
- Center Diagram 2 canvas.
- Right inspector shell with the expected tabs.
- Proper Save, Undo, and Redo placement.
- Selection-aware UI state infrastructure.
- Dialog and context-menu integration points.
- A development diagnostics toggle rather than a diagnostics-first layout.
- Stable shell DOM that is not recreated during ordinary canvas interactions.

Do not fake completed features.

A not-yet-implemented button may be absent or clearly disabled according to the phase plan, but the architecture must anticipate the final Diagram 1-style arrangement.

Do not create placeholder controls that falsely appear functional.

---

# 9. Phase 1 deliverable integration

Phase 1 is complete. Before changing Phase 2 code:

1. Read the completed Phase 1 inventory and architecture documents.
2. Add visual-parity information to the active parity matrix if it is missing.
3. For every Diagram 1 control already inventoried, record:
   - Visual source or builder.
   - CSS source.
   - Action name.
   - Enabled/disabled rules.
   - Selection rules.
   - Corresponding Diagram 2 command owner.
   - Expected phase.
4. Identify any Phase 1 architecture decision that conflicts with this addendum.
5. Resolve the conflict in favor of:
   - Familiar Diagram 1 UI.
   - Diagram 2 performance architecture.
   - Shared canonical compatibility.
6. Document the resolution before implementation.

Do not redo the entire Phase 1 analysis.

---

# 10. Examples

## 10.1 Rectangle tool

The Diagram 2 Rectangle button may look exactly like Diagram 1's Rectangle button.

The implementation must:

1. Create a Rectangle in canonical state.
2. Create one logical Undo entry.
3. Add one keyed renderer node.
4. Update only the relevant selection, Objects pane, inspector, bounds, and sectors.
5. Avoid rerouting Entity relationships.
6. Avoid rebuilding the entire Diagram or editor shell.

## 10.2 Fill-color change

The Diagram 2 fill-color control may look exactly like Diagram 1's control.

The implementation must:

1. Update only selected objects that support fill.
2. Coalesce continuous color-preview changes.
3. Patch only affected object styles.
4. Avoid geometry, world-bounds, sector, or routing work unless truly required.
5. Create one final logical Undo operation.

## 10.3 Entity field edit

The Entity tab may look exactly like Diagram 1's Entity tab.

The implementation must:

1. Apply the field edit to canonical state.
2. Rebuild only the affected Entity's internal structure when necessary.
3. Recalculate only affected anchors and connected relationships.
4. Update local bounds and sectors.
5. Preserve unrelated Entity nodes and routes.
6. Save in the same format Diagram 1 understands.

## 10.4 Drag and resize

The selection and resize handles may look exactly like Diagram 1's.

During pointer movement:

- Use temporary geometry preview.
- Keep selected objects force-mounted.
- Patch only preview geometry and lightweight relationship previews.
- Do not commit canonical state on every pointer event.
- Do not build full history snapshots on every pointer event.

On pointer release:

- Commit once.
- Resolve final geometry and affected routing once.
- Create one Undo entry.

## 10.5 Objects pane

The Objects pane may visually match Diagram 1.

Its implementation must:

- Update incrementally.
- Avoid rebuilding the complete tree for simple selection changes.
- Preserve expanded/collapsed state.
- Avoid forcing off-screen canvas nodes to mount merely because they appear in the tree.
- Center or reveal an object through a viewport command when selected from the tree.

---

# 11. Visual parity validation

For each major phase, perform side-by-side comparison between Diagram 1 and Diagram 2.

Test at minimum:

```text
1920 x 1080
1366 x 768
```

Test states should include:

- No selection.
- One Rectangle selected.
- Multiple objects selected.
- One Entity selected.
- One relationship selected.
- Image crop mode.
- Mapping mode.
- Objects pane expanded and collapsed.
- Inspector tabs.
- Dialog open.
- Context menu open.
- Fit and 100% zoom.
- Read-only versus editing states where applicable.

Use screenshots where practical, but do not require pixel-perfect identity when renderer-specific canvas internals differ.

The visual-parity review should focus on:

- Layout.
- Toolbar grouping.
- Tab names and order.
- Control presence and order.
- Selection affordances.
- Dialog workflows.
- Familiarity.
- Accessibility.
- No unintended developer-only clutter.

Document approved differences.

---

# 12. Performance validation for UI parity

Matching Diagram 1 visually must not add Diagram 1's performance costs.

Measure after each feature group:

- Time to first useful frame.
- Toolbar and inspector initialization.
- Selection latency.
- Inspector update latency.
- Drag-start latency.
- Drag-preview frame time.
- Resize-preview frame time.
- Local style patch time.
- Local structure patch time.
- Relationships considered and rerouted.
- Full-render count.
- Mounted object and relationship counts.
- SVG descendant count.
- Memory after repeated open/close cycles.

The editor UI itself must also remain efficient:

- Use event delegation where appropriate.
- Avoid duplicate listeners after rerender.
- Dispose listeners and observers on deactivate.
- Do not replace the complete editor shell during pointer movement, selection, or style changes.
- Update only affected controls.
- Debounce or coalesce high-frequency inspector input.
- Avoid repeatedly reading layout after writing layout in the same frame.
- Avoid synchronously serializing the complete Diagram for local UI state.

Any phase that significantly degrades the accepted Diagram 2 benchmark must stop and correct the regression before proceeding.

---

# 13. Compatibility is non-negotiable

Diagram 2 must continue to open Diagram 1 Diagrams directly.

Diagram 1 must continue to reopen Diagram 2 saves.

Continue using:

```text
format: pmt-diagram
formatVersion: 1
```

Continue using the shared:

- Diagram backing documents.
- File codec.
- Selection clipboard codec.
- Template library.
- Default template library.
- Save service.
- Row-version collision mechanism.
- Full-detail export builder.

Do not persist:

- Live renderer DOM.
- Mounted-only state.
- Viewport halo state.
- Low-detail state.
- Dirty state.
- Selection handles.
- Preview geometry.
- Spatial indexes.
- Route caches.
- Diagnostics.

---

# 14. Prohibited shortcuts

Do not:

- Claim parity because the controls are visible.
- Copy the complete Diagram 1 editor and then replace only the canvas tag.
- Call Diagram 1's complete renderer from Diagram 2.
- Use full live SVG regeneration for ordinary commands.
- Reroute every relationship after local edits.
- Store full-state snapshots for every small edit.
- Disable virtualization while editing without a measured and documented reason.
- Disable low-detail mode because inspector tabs were added.
- Introduce a separate Diagram 2 document or file format.
- Defer all editor work back to Diagram 1.
- Make Diagram 2 require Diagram 1 for creation or normal editing after parity is declared complete.
- Hide missing features behind a misleading "beta ready" claim.
- remove or rename Diagram 1 before separate approval.

---

# 15. Completion report requirements for this addendum

Every later phase completion report must include:

```text
Visual Diagram 1 controls reproduced:
Intentional visual differences:
Diagram 1 handlers studied:
Shared visual components reused:
Diagram 2-specific controllers added:
Full live renders introduced:
Unrelated relationships rerouted:
Performance before:
Performance after:
Diagram 1 file opened in Diagram 2:
Diagram 2 save reopened in Diagram 1:
Visual parity tests:
Known parity gaps:
```

If a full live render was introduced for a local command, explain why and obtain approval.

---

# 16. Addendum acceptance criteria

This addendum is successfully applied when:

- Phase 2 and later work targets a Diagram 1-familiar editor.
- Diagram 2 does not retain the current minimal developer-style toolbar as its final editor UI.
- The toolbar, Objects pane, inspector, dialogs, and editing affordances converge toward Diagram 1.
- Internal commands remain Diagram 2-specific and performance-safe.
- The completed editor can perform normal Diagram work without returning to Diagram 1.
- Diagram 1 files continue to open and edit in Diagram 2.
- Diagram 1 continues to reopen Diagram 2 saves.
- No major Diagram 2 performance architecture is bypassed.
- Visual parity and performance parity evidence are included in each phase report.

---

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Integration status in the regenerated package

This mandate is no longer isolated guidance. Its requirements are integrated directly into:

- Phase 2 editor foundation and shell.
- Phase 3 drawing, selection, resize, text, and inspector.
- Phase 4 Objects pane, groups, layers, clipboard, and templates.
- Phase 5 Entity/ERD and relationship editing.
- Phase 6 images, crop, annotation, and field mapping.
- Phase 7 persistence, dialogs, keyboard, context menus, and round-trip UX.
- Phase 8 performance hardening and promotion criteria.
- The feature-parity matrix.
- The Codex completion-report template.
- The all-in-one instruction file.

Codex must still read this addendum before each phase because it remains the authoritative detailed visual-parity specification.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

# Final instruction to Codex

> **Build Diagram 2 so it visually presents the familiar Diagram 1 editor, toolbar by toolbar, tab by tab, dialog by dialog, and feature by feature. Preserve user-facing behavior and persisted results. Do not copy Diagram 1's slow rendering lifecycle. Reimplement each feature through Diagram 2's command system, persistent keyed nodes, dirty-state batching, geometry previews, selective routing, spatial indexes, viewport virtualization, and low-detail rendering. The final product should feel like Diagram 1, perform like Diagram 2, open Diagram 1 documents directly, and save documents that Diagram 1 can reopen exactly.**

<!-- END FILE: 01A-ADDENDUM-DIAGRAM-2-VISUAL-EDITOR-PARITY-MANDATE.md -->

---

<!-- BEGIN FILE: 01B-ADDENDUM-DIAGRAM-2-DUAL-ENTRY-POINTS-RTE-ANNOTATE-AND-TOP-NAVIGATION.md -->

# PMT Diagram 2 Editor Parity Program

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


# Addendum — Diagram 2 Dual Entry Points: RTE Annotation and Top-Navigation Diagram Editor

## Placement and execution order

This is a **new addendum** to the Diagram 2 editor-parity instruction series.

It is intentionally named so it appears immediately after:

```text
01A-ADDENDUM-DIAGRAM-2-VISUAL-EDITOR-PARITY-MANDATE.md
```

and immediately before:

```text
02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md
```

Phase 1 has already been completed. Do not repeat the entire Phase 1 inventory.

Read this addendum before continuing Phase 2. Integrate it into the approved Phase 1 architecture and all later implementation phases.

This addendum defines a mandatory product requirement that was not explicit enough in the earlier instructions:

> **Diagram 2 must be launchable through two separate user entry points while using one shared Diagram 2 editor core and one shared high-performance renderer.**

The two entry points are:

1. **RTE image annotation entry point**
2. **Top-navigation Diagram 2 entry point**

Do not build two independent Diagram 2 editors.

---

# 1. Historical Diagram 1 entry point

The original Diagram 1 / Image Annotation workflow began inside a PMT rich-text editor.

The user:

1. Opens or edits content in a PMT rich-text editor.
2. Selects an image already inserted in the RTE.
3. Right-clicks the selected image.
4. Opens the image context menu.
5. Chooses:

```text
Annotate
```

After the image already contains annotation metadata, the context-menu command later becomes:

```text
Edit Annotate
```

This is a real and important Diagram 1 entry point.

It must remain available while Diagram 2 is developed and tested.

Do not remove, rename, or redirect the existing Diagram 1 commands without separate approval.

---

# 2. Required Diagram 2 RTE entry point

Add a side-by-side Diagram 2 annotation command to the image context menu.

For an image that does not yet contain an editable annotation, provide:

```text
Annotate
Annotate 2.0
```

The existing `Annotate` command continues to open Diagram 1.

The new `Annotate 2.0` command opens Diagram 2 in the RTE annotation host context.

For an image that already contains editable annotation metadata, provide the appropriate edit labels:

```text
Edit Annotate
Edit Annotate 2.0
```

The existing `Edit Annotate` command continues to open Diagram 1.

The new `Edit Annotate 2.0` command opens the same selected image/annotation in Diagram 2.

The exact context-menu ordering should keep the two versions easy to compare. A reasonable order is:

```text
Annotate
Annotate 2.0
```

or:

```text
Edit Annotate
Edit Annotate 2.0
```

Do not hide Diagram 1 merely because Diagram 2 is available.

The purpose of the temporary `2.0` wording is to allow Sin to test the two implementations side by side.

The final labels may be simplified later only after separate approval and after Diagram 2 is proven to be a full replacement.

---

# 3. Second Diagram 2 entry point: top-navigation feature

Diagram 2 must also remain launchable from PMT's top navigation as the full standalone Diagram feature/screen.

This entry point is the existing or planned route such as:

```text
#/diagram-2
#/diagram-2/{documentId}
```

The top-navigation Diagram 2 experience is a full document-oriented editor.

It must support:

- Diagram document library/tree/card navigation.
- Opening a selected Diagram document.
- Creating and editing Diagram content.
- Editing the same backing Diagram documents used by Diagram 1.
- Save and row-version collision handling.
- Document metadata.
- Project and Sprint association where applicable.
- Visibility and permissions.
- Import and export.
- Templates.
- Full Diagram editor tools.
- Full-screen editor layout.
- Diagram 1 to Diagram 2 round-trip compatibility.

The navigation label should remain:

```text
Diagram 2
```

until a separate future approval changes it.

---

# 4. One shared Diagram 2 editor, two host adapters

The required architecture is:

```text
                         Diagram 2 editor core
             Commands, history, selection, inspector state
                                  |
                         Canonical Diagram state
                                  |
                      Diagram 2 renderer core
                                  |
                Persistent keyed incremental SVG renderer
                                  |
                +-----------------+-----------------+
                |                                   |
                v                                   v
       RTE annotation host                 Diagram document host
       Annotate 2.0 /                      Top-navigation Diagram 2
       Edit Annotate 2.0
```

The following must be shared between both entry points:

- Diagram 2 editor controller.
- Command system.
- Command-based history.
- Selection model.
- Canonical state mutation rules.
- Object creation and editing logic.
- Entity and relationship logic.
- Inspector logic.
- Toolbar command definitions.
- Clipboard logic where applicable.
- Template application logic.
- Renderer integration.
- Persistent keyed nodes.
- Dirty-state batching.
- Geometry preview.
- Selective relationship routing.
- Spatial indexes.
- Viewport virtualization.
- Low-detail rendering.
- Full-detail SVG/export builder.
- Cleanup lifecycle.

Only host-specific responsibilities should differ.

---

# 5. Host-specific responsibilities

## 5.1 RTE annotation host

The RTE annotation host owns:

- The originating RTE instance.
- The selected image element or image reference.
- The image source.
- Existing annotation metadata, if present.
- Opening Diagram 2 in an embedded/modal/maximized annotation context.
- Save back to the selected RTE image.
- Cancel and close behavior.
- Restoring RTE focus and selection.
- Preserving the RTE document context.
- Avoiding unnecessary route changes.
- Avoiding creation of a standalone Diagram document unless the user explicitly chooses such an operation in the future.

## 5.2 Top-navigation Diagram host

The Diagram document host owns:

- The selected Diagram document ID.
- Document library navigation.
- Document metadata.
- The PMT Diagram backing record.
- Save callbacks.
- Row-version collision handling.
- Route updates.
- Full-screen page lifecycle.
- Permissions.
- Public/private behavior.
- Project and Sprint relationships.
- Standalone import/export workflows.

## 5.3 The editor core must not own host concerns

The shared editor core must not assume:

- It always has a Blog/Diagram document ID.
- It always has a document library.
- Save always updates a PMT Diagram record.
- Close always changes the browser route.
- It always occupies the entire PMT screen.
- It always runs inside an RTE modal.
- It always has the same permissions or metadata fields.
- It can recreate the entire PMT app container.

Use host adapters or injected callbacks.

A conceptual API may resemble:

```javascript
createDiagram2Editor({
    host,
    mode: "rte-annotation" | "diagram-document",
    initialState,
    imageContext,
    documentContext,
    permissions,
    saveAdapter,
    cancelAdapter,
    closeAdapter,
    notify
});
```

This example is conceptual. Adapt it to PMT's existing JavaScript architecture and naming conventions.

---

# 6. RTE `Annotate 2.0` behavior

When the user selects an unannotated image in an RTE and chooses:

```text
Annotate 2.0
```

Diagram 2 must:

1. Preserve the originating RTE context.
2. Capture the selected image and its current source.
3. Load the image as the annotation background or source image.
4. Create a new canonical annotation state.
5. Open the Diagram 2 editor using the RTE annotation host.
6. Provide the appropriate Diagram 2 tools and inspector tabs.
7. Keep the editor high-performance.
8. Allow Save and Cancel.
9. On Save:
   - Commit any active gesture.
   - Flush pending dirty state.
   - Validate canonical state.
   - Build the complete full-detail annotation SVG.
   - Update or replace the selected RTE image using the existing safe RTE annotation workflow.
   - Preserve complete annotation metadata.
   - Restore focus to the RTE.
10. On Cancel:
   - Do not alter the original selected image.
   - Dispose the Diagram 2 editor and renderer.
   - Restore focus to the RTE.

Opening the editor alone must not modify the RTE content.

---

# 7. RTE `Edit Annotate 2.0` behavior

When the selected RTE image already contains editable annotation metadata and the user chooses:

```text
Edit Annotate 2.0
```

Diagram 2 must:

1. Read the complete canonical annotation metadata from the selected image/SVG.
2. Preserve all supported objects and extension data.
3. Open the same annotation in Diagram 2.
4. Display the same user-visible Diagram content.
5. Allow editing through Diagram 2's editor commands.
6. Save back to the same RTE image context.
7. Preserve Diagram 1 compatibility where the shared format supports it.

The selected RTE image must not be flattened into an uneditable bitmap merely because Diagram 2 edited it.

The saved result must retain the canonical annotation metadata needed for future editing.

---

# 8. Side-by-side Diagram 1 and Diagram 2 testing

During the parity program, both RTE commands must remain available.

For an unannotated image:

```text
Annotate
Annotate 2.0
```

For an annotated image:

```text
Edit Annotate
Edit Annotate 2.0
```

This allows direct comparison of:

- Editor appearance.
- Toolbar behavior.
- Inspector behavior.
- Selection.
- Dragging.
- Resizing.
- Crop behavior.
- Entity editing.
- Field mapping.
- Save behavior.
- Reopen behavior.
- Performance.
- Memory cleanup.

Do not silently redirect `Annotate` to Diagram 2.

Do not silently redirect `Edit Annotate` to Diagram 2.

Do not remove Diagram 1 from the RTE context menu until separate approval.

---

# 9. Annotation ownership and compatibility

Do not create mutually exclusive Diagram 1 and Diagram 2 annotation formats.

The preferred behavior is:

- Diagram 2 can open annotations created by Diagram 1.
- Diagram 1 can reopen annotations saved by Diagram 2 when the annotation uses supported shared canonical features.
- Both editors continue using the shared canonical annotation/Diagram representation.
- Renderer-only Diagram 2 state is never persisted.

Do not introduce:

```text
pmt-annotation-2
pmt-diagram-2
diagram2-only annotation metadata
```

unless an unavoidable extension is separately approved.

If Diagram 2 adds safe extension data not understood by Diagram 1:

- Preserve it through the shared extension mechanism.
- Do not corrupt Diagram 1-supported data.
- Document the compatibility limitation.
- Do not silently discard data.

The goal remains two-way compatibility.

---

# 10. Context-menu detection rules

Codex must inspect the existing RTE image context-menu implementation and determine how PMT currently decides whether to show:

```text
Annotate
```

or:

```text
Edit Annotate
```

Reuse the same renderer-neutral detection where safe.

Add the Diagram 2 command beside it.

Expected conceptual behavior:

```text
Selected image has no editable annotation metadata:
    Annotate
    Annotate 2.0

Selected image has editable annotation metadata:
    Edit Annotate
    Edit Annotate 2.0
```

Do not rely only on visible text, filename, or image extension.

Use the existing trusted annotation metadata and parsing logic.

If the selected content is not a supported image:

- Do not show invalid annotation commands.
- Preserve the current RTE context-menu behavior.

---

# 11. RTE visual behavior

The RTE-launched Diagram 2 editor should visually resemble the existing Diagram 1 annotation editor so users recognize it immediately.

Preserve, where applicable:

- Toolbar button order.
- Tool icons.
- Tooltips.
- Inspector tab names and order.
- Canvas appearance.
- Selection handles.
- Crop handles.
- Entity and mapping controls.
- Save and Cancel placement.
- Full-screen/maximized annotation workflow.
- Keyboard shortcuts.
- Context-menu behavior.

The RTE host may omit standalone document-library and document-metadata UI that does not apply to an embedded annotation.

That is a host-context difference, not a separate editor implementation.

---

# 12. Top-navigation visual behavior

The top-navigation Diagram 2 screen should visually resemble the full Diagram 1 editor.

Preserve, where applicable:

- Toolbar.
- Objects pane.
- Canvas.
- Inspector.
- Tabs.
- Document library.
- Metadata controls.
- Save/Undo/Redo.
- Templates.
- Import/export.
- Context menus.
- Selection and editing affordances.

The top-navigation host adds document-oriented UI around the same Diagram 2 editor core.

---

# 13. Performance requirements for both entry points

Both entry points must preserve Diagram 2's performance architecture.

Do not make the RTE path a legacy full-render path.

Do not make the top-navigation path the only optimized path.

For both hosts:

- Use persistent keyed SVG nodes.
- Use dirty-state batching.
- Use one scheduled flush per animation frame.
- Use geometry preview during drag and resize.
- Use selective relationship routing.
- Use spatial indexes.
- Use viewport-plus-halo virtualization.
- Use low-detail rendering at extreme zoom-out.
- Keep selected and active-gesture objects mounted.
- Keep full-detail save/export separate from live rendering.
- Use explicit cleanup on close/deactivate.

Opening `Annotate 2.0` must not run expensive compatibility proofs on every launch.

The RTE host must not rebuild the entire RTE when the annotation changes.

The top-navigation host must not rebuild the complete PMT screen during ordinary editing.

---

# 14. Lifecycle and cleanup

The RTE annotation host must clean up when:

- Save completes.
- Cancel is chosen.
- The dialog is closed.
- The originating RTE is destroyed.
- Navigation occurs unexpectedly.
- A new annotation session replaces the old session.

The top-navigation Diagram host must clean up when:

- Navigating away.
- Opening another Diagram.
- Re-rendering the page shell.
- Logging out.
- The feature is deactivated.

Cleanup must include:

- Animation frames.
- Event listeners.
- Pointer captures.
- Timers.
- Observers.
- Object URLs.
- Image resources.
- Clipboard resources.
- Live renderer maps.
- Route indexes.
- Viewport indexes.
- Preview overlays.
- Global debug references.
- Host DOM.

Repeated launch/close cycles in both entry points must not cause continuing memory growth.

---

# 15. Required Phase 2 architecture updates

Phase 1 is complete.

Before substantial Phase 2 implementation:

1. Read the completed Phase 1 inventory.
2. Identify the existing Diagram 1 RTE image annotation launch path.
3. Identify:
   - Image-selection logic.
   - Context-menu construction.
   - `Annotate` action.
   - `Edit Annotate` action.
   - Existing annotation dialog/editor opening logic.
   - RTE save-back logic.
   - Cancel/close logic.
4. Add the two Diagram 2 RTE actions:
   - `Annotate 2.0`
   - `Edit Annotate 2.0`
5. Define host adapters before coupling the editor shell to the top-navigation page.
6. Ensure the shared editor core can run in both modes.
7. Document the host boundary.
8. Add both launch paths to the feature-parity matrix.

Do not redo the whole Phase 1 analysis.

---

# 16. Required tests

## 16.1 RTE new annotation test

```text
Open an RTE
Insert/select an image
Right-click the image
Verify Annotate and Annotate 2.0 are both present
Choose Annotate 2.0
Add at least two annotation objects
Save
Verify the RTE image updates
Reopen through Edit Annotate 2.0
Verify the objects remain editable
```

## 16.2 RTE cancel test

```text
Open an RTE
Select an image
Choose Annotate 2.0
Make changes
Cancel
Verify the original RTE image and content are unchanged
```

## 16.3 RTE Diagram 1 compatibility test

```text
Create or edit an annotation using Annotate
Close Diagram 1
Select the same image
Choose Edit Annotate 2.0
Verify Diagram 2 opens the same canonical content
Save with Diagram 2
Choose Edit Annotate
Verify Diagram 1 reopens the supported content
```

## 16.4 Top-navigation compatibility test

```text
Open a Diagram 1 document in Diagram 2
Edit and save
Open the same document in Diagram 1
Verify the supported content
Edit and save in Diagram 1
Reopen in Diagram 2
Verify the change
```

## 16.5 Dual-host lifecycle test

```text
Open and close Annotate 2.0 ten times
Open and leave Diagram 2 ten times
Verify no stale SVG, listeners, renderer maps, observers, or continuing memory growth
```

## 16.6 Side-by-side label test

Verify:

```text
Unannotated supported image:
    Annotate
    Annotate 2.0

Annotated supported image:
    Edit Annotate
    Edit Annotate 2.0
```

---

# 17. Required completion-report additions

Every phase that affects editor hosting, RTE integration, or launch behavior must report:

```text
Diagram 1 RTE Annotate preserved:
Diagram 1 RTE Edit Annotate preserved:
Diagram 2 RTE Annotate 2.0 available:
Diagram 2 RTE Edit Annotate 2.0 available:
Diagram 2 top-navigation launch available:
Shared editor core used by both hosts:
RTE-specific adapter files:
Diagram-document adapter files:
RTE save-back tested:
RTE cancel tested:
Diagram 1 annotation opened in Diagram 2:
Diagram 2 annotation reopened in Diagram 1:
Repeated RTE open/close cleanup:
Repeated top-navigation open/close cleanup:
Performance before:
Performance after:
Known host-specific limitations:
```

---

# 18. Prohibited shortcuts

Do not:

- Build an entirely separate Diagram 2 editor for the RTE.
- Copy the complete Diagram 1 annotation editor and call it Diagram 2.
- Keep the RTE path permanently on Diagram 1 while claiming Diagram 2 parity.
- Make `Annotate 2.0` open the top-navigation route as a workaround.
- Create a standalone Diagram document every time an RTE image is annotated.
- Modify the RTE image before the user presses Save.
- Lose the originating RTE selection or focus.
- Flatten editable annotation metadata.
- Remove `Annotate` or `Edit Annotate`.
- Redirect Diagram 1 commands to Diagram 2 without approval.
- Introduce a second incompatible annotation format.
- Persist renderer caches or low-detail DOM.
- Rebuild the complete RTE during annotation edits.
- Use a full live Diagram render for ordinary local edits.

---

# 19. Expected final outcome

When the Diagram 2 editor-parity program is complete:

## RTE workflow

A user can:

1. Open a PMT rich-text editor.
2. Select an image.
3. Right-click it.
4. Choose either Diagram 1 or Diagram 2:

```text
Annotate
Annotate 2.0
```

or, for an existing annotation:

```text
Edit Annotate
Edit Annotate 2.0
```

5. Use the familiar editor.
6. Save the result back into the same RTE image.
7. Reopen and continue editing later.

## Top-navigation workflow

A user can:

1. Open `Diagram 2` from PMT's top navigation.
2. Select a Diagram document.
3. Use the full familiar Diagram editor.
4. Save the same backing Diagram document.
5. Reopen it in Diagram 1 or Diagram 2.

## Architecture outcome

Both workflows use:

- One Diagram 2 editor core.
- One command and history system.
- One canonical state model.
- One high-performance Diagram 2 renderer.
- Different host adapters only where the launch context requires it.

The intended result is:

> **One high-performance Diagram 2 editor with two first-class launch experiences: `Annotate 2.0` from an RTE image and `Diagram 2` from PMT's top navigation. Diagram 1 remains available side by side during testing through `Annotate`, `Edit Annotate`, and the original `Diagram` screen.**

---

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Integration status in the regenerated package

This dual-entry-point requirement is integrated directly into the updated Phase 2–8 files, parity matrix, completion report, Start Here file, master constitution, and all-in-one instructions.

The authoritative product requirement remains:

```text
One Diagram 2 editor core
    ├── RTE host: Annotate 2.0 / Edit Annotate 2.0
    └── Document host: top-navigation Diagram 2
```

Codex must preserve the original Diagram 1 commands and screen side by side until Sin separately approves replacement.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

# Final instruction to Codex

> **Implement Diagram 2 as one shared high-performance editor that can be hosted in two places. The first host is the RTE image context menu: preserve Diagram 1's `Annotate` / `Edit Annotate` commands and add side-by-side `Annotate 2.0` / `Edit Annotate 2.0` commands for Diagram 2. The second host is the full top-navigation `Diagram 2` feature. Share the editor controller, commands, history, canonical state, inspector logic, toolbar logic, and Diagram 2 renderer. Separate only the host-specific source, save target, close/cancel behavior, routing, metadata, and document-library responsibilities. Preserve Diagram 1 compatibility and Diagram 2 performance in both entry points.**

<!-- END FILE: 01B-ADDENDUM-DIAGRAM-2-DUAL-ENTRY-POINTS-RTE-ANNOTATE-AND-TOP-NAVIGATION.md -->

---

<!-- BEGIN FILE: 02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md -->

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

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Post-Phase-1 reconciliation required by the addenda

Phase 1 has already been completed. Do not repeat the entire inventory.

Before Phase 2 code changes, amend the Phase 1 deliverables only where necessary so they explicitly record:

### Visual-source mapping

For every inventoried Diagram 1 feature, add or confirm:

- Markup/UI builder source.
- CSS source.
- Toolbar group/order/icon/tooltip.
- Inspector tab, field order, and enabled/disabled rules.
- Context-menu and keyboard entry points.
- Canvas overlay/handle appearance.
- Whether the visible component can be reused safely or must be reproduced.

### Dual-host ownership

For every feature, classify applicability:

```text
Shared editor core
RTE host only
Diagram document host only
Both hosts with different presentation
```

Add the historical Diagram 1 RTE path to the inventory:

```text
Selected RTE image
    → right-click
    → Annotate / Edit Annotate
```

Add the Diagram 2 parallel path:

```text
Selected RTE image
    → right-click
    → Annotate 2.0 / Edit Annotate 2.0
```

Record the top-navigation Diagram 2 path separately.

### Architecture amendment

The approved Phase 1 architecture must include:

- One shared Diagram 2 editor core.
- One RTE annotation host adapter.
- One Diagram document host adapter.
- Injected save/cancel/close behavior.
- No assumption in the editor core that a Blog/Diagram document ID always exists.
- No assumption that Save always changes a route or backing document.
- No duplicate toolbar, inspector, history, or renderer implementation.

### Phase 1 amendment acceptance

Before Phase 2, Codex must be able to point to the updated Phase 1 artifact and answer:

1. Which code launches Diagram 1 `Annotate` and `Edit Annotate`?
2. How will `Annotate 2.0` and `Edit Annotate 2.0` be added without redirecting Diagram 1?
3. Which UI builders/styles define Diagram 1's visual editor?
4. Which responsibilities belong to the shared editor core versus each host adapter?
5. Which current Diagram 2 APIs are sufficient, and which incremental APIs are missing?
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

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

<!-- END FILE: 02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md -->

---

<!-- BEGIN FILE: 03-PHASE-2-EDITOR-FOUNDATION-COMMANDS-HISTORY-SHELL.md -->

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

<!-- END FILE: 03-PHASE-2-EDITOR-FOUNDATION-COMMANDS-HISTORY-SHELL.md -->

---

<!-- BEGIN FILE: 04-PHASE-3-CORE-DRAWING-SELECTION-INSPECTOR.md -->

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

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Visual and dual-host parity requirements for this phase

Every applicable Phase 3 feature must be implemented once in the shared editor core and exercised in both hosts.

### Visual parity

Match Diagram 1 for:

- Toolbar tool position, grouping, icon, tooltip, active state, and shortcut.
- Selection outline and handles.
- Marquee appearance.
- Resize cursors and previews.
- Inspector tab names, field order, labels, controls, and mixed-value states.
- Text/Rich Text editing affordances.
- Format Painter state and feedback.

Any approved visual difference must be documented.

### Dual-host feature matrix

For each feature, record:

```text
Top-navigation Diagram 2: PASS/PARTIAL/FAIL
RTE Annotate 2.0: PASS/PARTIAL/FAIL
RTE Edit Annotate 2.0: PASS/PARTIAL/FAIL
Shared command implementation: YES/NO
Shared renderer path: YES/NO
```

The RTE host may omit document-library/metadata UI, but drawing tools, selection, movement, resize, styles, text, clipboard, and history must use the same implementation.

### Performance-safe implementation examples

- Object creation adds only the new keyed node and required overlays.
- Selection patches only selection state/overlays.
- Resize uses preview geometry and commits once.
- Color/text inspector previews are coalesced.
- Style changes do not reroute relationships unless route geometry actually depends on the style.
- Objects outside the viewport remain virtualized.
- The editor shell is not rebuilt during pointer movement or inspector input.

### Required cross-host tests

Create the same small annotation/Diagram in both hosts and compare:

- Canonical state.
- SVG export.
- Undo/redo result.
- Selection behavior.
- Inspector values.
- Save/reopen behavior.
- Full-render and routing counts.

An object created through `Annotate 2.0` must remain editable through `Edit Annotate 2.0`. Shared-supported content should also reopen in Diagram 1.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

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

<!-- END FILE: 04-PHASE-3-CORE-DRAWING-SELECTION-INSPECTOR.md -->

---

<!-- BEGIN FILE: 05-PHASE-4-STRUCTURE-OBJECTS-TREE-GROUPS-LAYERS-CLIPBOARD-TEMPLATES.md -->

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

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Visual and dual-host parity requirements for this phase

### Objects pane in both hosts

The top-navigation host should provide the normal Diagram 1-familiar Objects pane.

The RTE host must use the same Objects model and commands. It may present the pane as collapsible or space-adapted, but must preserve:

- Selection synchronization.
- Rename.
- Visibility.
- Locking.
- Ordering.
- Group hierarchy.
- Expand/collapse state.
- Center/reveal object.
- Incremental updates.

Selecting an off-screen object in the Objects pane may center/reveal it through a viewport command. It must not force all canonical objects to mount.

### Groups, layers, and ordering

Use shared commands in both hosts. Reordering must patch z-order only; it must not rebuild object geometry or reroute unrelated relationships.

### Clipboard across screens and hosts

Test:

```text
Diagram 1 → Diagram 2 top-navigation
Diagram 2 top-navigation → Diagram 1
Diagram 1 RTE annotation → Edit Annotate 2.0
Diagram 2 RTE annotation → Edit Annotate
Diagram 2 RTE host ↔ Diagram 2 document host
Diagram 2 document A → Diagram 2 document B
```

Continue using the shared `pmt-diagram-selection` format and safe ID remapping.

### Templates across both hosts

Both hosts use the same template library and normalization rules.

Do not create:

```text
RTE Diagram 2 templates
Diagram document Diagram 2 templates
```

as separate libraries.

A template created or updated through either applicable host must be available through the other host and Diagram 1 according to the shared contract.

### Performance gates

- Objects-pane selection must not cause geometry/routing work.
- Tree updates should be keyed/incremental where practical.
- Group/layer operations invalidate only affected objects, order, relationships, bounds, and sectors.
- Copy/template serialization occurs on explicit user action, not on every selection change.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

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

<!-- END FILE: 05-PHASE-4-STRUCTURE-OBJECTS-TREE-GROUPS-LAYERS-CLIPBOARD-TEMPLATES.md -->

---

<!-- BEGIN FILE: 06-PHASE-5-ENTITY-ERD-RELATIONSHIPS-AUTO-FORMAT.md -->

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

<!-- END FILE: 06-PHASE-5-ENTITY-ERD-RELATIONSHIPS-AUTO-FORMAT.md -->

---

<!-- BEGIN FILE: 07-PHASE-6-IMAGES-CROP-ANNOTATIONS-FIELD-MAPPING.md -->

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

<!-- END FILE: 07-PHASE-6-IMAGES-CROP-ANNOTATIONS-FIELD-MAPPING.md -->

---

<!-- BEGIN FILE: 08-PHASE-7-SAVE-IMPORT-EXPORT-ROUNDTRIP-UX-PARITY.md -->

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

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Complete visual and dual-host UX parity

Phase 7 is the final integration gate for both Diagram 2 launch contexts.

### Host-specific persistence

#### RTE annotation host

Save must:

1. Commit active gestures.
2. Flush pending dirty state.
3. Validate complete canonical annotation state.
4. Build complete full-detail annotation SVG/metadata.
5. Update the selected RTE image through the established safe RTE workflow.
6. Restore RTE focus/context.
7. Avoid creating/updating a standalone Diagram record unless explicitly requested.

Cancel must leave RTE content unchanged.

#### Diagram document host

Save must use the same backing service and row-version collision handling as Diagram 1.

### Dialog, keyboard, context-menu, and accessibility parity

Validate both hosts for:

- Familiar toolbar and inspector UI.
- Save/Cancel/Close placement.
- Escape behavior.
- Keyboard shortcuts.
- Context-menu actions.
- Focus trapping/restoration.
- Screen-reader labels.
- Disabled-state explanations.
- Unsaved-change prompts appropriate to each host.
- No route change for normal RTE annotation.
- Correct route behavior for top-navigation documents.

### Required complete round-trip matrices

#### Diagram documents

```text
D1 save → D1 open
D1 save → D2 open
D2 save → D1 open
D2 save → D2 open
```

#### RTE annotations

```text
Annotate → Edit Annotate
Annotate → Edit Annotate 2.0
Annotate 2.0 → Edit Annotate 2.0
Annotate 2.0 → Edit Annotate
```

#### Cross-host Diagram 2

Where semantically valid:

```text
RTE selection copy → Diagram document paste
Diagram document selection copy → RTE annotation paste
Template create/apply in either host
```

### No false parity claims

A feature is not complete unless:

- It visually matches or has an approved difference.
- It works in every applicable host.
- It uses shared commands/editor core.
- History works.
- Save/cancel works.
- Diagram 1 compatibility works.
- Performance gates pass.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

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

<!-- END FILE: 08-PHASE-7-SAVE-IMPORT-EXPORT-ROUNDTRIP-UX-PARITY.md -->

---

<!-- BEGIN FILE: 09-PHASE-8-PERFORMANCE-HARDENING-500-1000-ENTITY-PROMOTION.md -->

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

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Dual-host benchmark and promotion requirements

Final performance and promotion testing must cover both Diagram 2 entry points.

### Top-navigation document host

Use the normal, 232-, 500-, and 1,000-Entity production-shaped fixtures. Measure the full editor, not a detached renderer alone:

- Route/navigation to first useful editor frame.
- Shell/toolbar/inspector readiness.
- Selection.
- Drag/resize start and preview.
- Inspector changes.
- Relationship editing/routing.
- Zoom/pan/settle.
- Fit/low-detail.
- Save/export.
- Open/close lifecycle.

### RTE annotation host

Use representative annotations containing:

- Large image assets.
- Many shapes/text objects.
- Rich text.
- Crop data.
- Entities and relationships.
- Field Rectangles and mappings.
- Field Mapping Tables.

Measure:

- Context-menu command to first useful frame.
- Parse and editor mount.
- Selection/drag/resize/crop.
- Inspector edits.
- Mapping interactions.
- Save-back time.
- Cancel/close time.
- Reopen time.
- Memory after repeated cycles.

### Controlled comparisons

Compare equivalent boundaries. Do not compare a complete Diagram 1 route against a detached Diagram 2 renderer and call it an end-to-end speedup.

Report median, p90/p95, maximum, full-render count, routing counts, mounted/canonical counts, DOM descendants, and memory behavior.

### Separate promotion gates

Report independently:

```text
Top-navigation Diagram 2 editor readiness
RTE Annotate 2.0 editor readiness
Diagram 1 document compatibility readiness
Diagram 1 RTE annotation compatibility readiness
```

The program is not fully promotable until both hosts pass.

### Replacement remains a separate approval

Even after Phase 8:

- Keep `Diagram` and `Diagram 2` side by side.
- Keep `Annotate` / `Edit Annotate`.
- Keep `Annotate 2.0` / `Edit Annotate 2.0`.
- Do not rename or redirect the original commands without Sin's separate approval.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

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

<!-- END FILE: 09-PHASE-8-PERFORMANCE-HARDENING-500-1000-ENTITY-PROMOTION.md -->

---

<!-- BEGIN FILE: 10-FEATURE-PARITY-MATRIX-TEMPLATE.md -->

# Diagram 1 → Diagram 2 Feature Parity Matrix

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


## Status legend

| Status | Meaning |
|---|---|
| Not Started | No Diagram 2 work exists |
| Inventoried | Diagram 1 behavior and state impact documented |
| UI Only | Control exists but operation is not complete |
| Command Complete | Canonical operation works |
| Renderer Complete | Incremental renderer integration works |
| History Complete | Undo/redo works |
| Compatibility Complete | Diagram 1 ↔ Diagram 2 round-trip works |
| Performance Complete | Regression metrics pass |
| Manual Approved | Sin approved behavior |
| Intentionally Deferred | Sin explicitly approved deferral |

## Required columns

Use the expanded integrated table in **Integrated visual and host-parity columns** below.


<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Integrated visual and host-parity columns

The authoritative matrix must use these expanded columns:

| ID | Category | Diagram 1 feature | UI location | Visual source/CSS | Visual parity | Intentional difference approved | Action/handler | Canonical reads/writes | Shared editor command | Dirty category | Routing impact | History command | Top-nav D2 | RTE Annotate 2.0 | RTE Edit Annotate 2.0 | RTE save/cancel | D1→D2 | D2→D1 | Cross-host | Performance test | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

### Host applicability values

Use:

```text
Required
Not applicable
Deferred with Sin approval
```

Do not mark a feature complete because it works only in the top-navigation host when it is also applicable to RTE annotation.

### Additional seed items

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| HOST-001 | Hosting | Shared Diagram 2 editor core | Not Started |
| HOST-002 | Hosting | RTE annotation host adapter | Not Started |
| HOST-003 | Hosting | Diagram document host adapter | Not Started |
| HOST-004 | RTE context menu | Preserve Annotate | Not Started |
| HOST-005 | RTE context menu | Preserve Edit Annotate | Not Started |
| HOST-006 | RTE context menu | Add Annotate 2.0 | Not Started |
| HOST-007 | RTE context menu | Add Edit Annotate 2.0 | Not Started |
| HOST-008 | RTE lifecycle | Save back to selected image | Not Started |
| HOST-009 | RTE lifecycle | Cancel without content change | Not Started |
| HOST-010 | RTE lifecycle | Restore RTE focus/selection | Not Started |
| HOST-011 | Lifecycle | Ten-cycle RTE cleanup | Not Started |
| HOST-012 | Lifecycle | Ten-cycle top-navigation cleanup | Not Started |
| VIS-001 | Visual parity | Toolbar grouping/order/icons | Not Started |
| VIS-002 | Visual parity | Objects pane | Not Started |
| VIS-003 | Visual parity | Inspector tabs/controls | Not Started |
| VIS-004 | Visual parity | Canvas handles/overlays | Not Started |
| VIS-005 | Visual parity | Dialogs/context menus | Not Started |
| VIS-006 | Visual parity | Responsive layout comparison | Not Started |
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## Seed inventory

### Shell and navigation

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| SHELL-001 | Shell | Editor open/close lifecycle | Not Started |
| SHELL-002 | Shell | Maximized/embedded mode | Not Started |
| SHELL-003 | Shell | Toolbar groups | Not Started |
| SHELL-004 | Shell | Objects tree | Not Started |
| SHELL-005 | Shell | Inspector tabs | Not Started |
| SHELL-006 | Shell | Status/save indicator | Not Started |
| SHELL-007 | Shell | Responsive layout | Not Started |
| SHELL-008 | Shell | Diagnostics developer toggle | Not Started |

### Tools and objects

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| TOOL-001 | Tool | Select | Not Started |
| TOOL-002 | Tool | Pan | Not Started |
| TOOL-003 | Tool | Format Painter | Not Started |
| TOOL-004 | Tool | Crop | Not Started |
| OBJ-001 | Object | Rectangle | Not Started |
| OBJ-002 | Object | Circle | Not Started |
| OBJ-003 | Object | Arrow | Not Started |
| OBJ-004 | Object | Line | Not Started |
| OBJ-005 | Object | Textbox | Not Started |
| OBJ-006 | Object | Rich Text | Not Started |
| OBJ-007 | Object | Image | Not Started |
| OBJ-008 | Object | Entity | Not Started |
| OBJ-009 | Object | Field Rectangle | Not Started |
| OBJ-010 | Object | Field Mapping Table | Not Started |

### Selection and geometry

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| SEL-001 | Selection | Click select | Not Started |
| SEL-002 | Selection | Modifier multi-select | Not Started |
| SEL-003 | Selection | Marquee | Not Started |
| SEL-004 | Selection | Select All | Not Started |
| GEO-001 | Geometry | Drag | Not Started |
| GEO-002 | Geometry | Multi-drag | Not Started |
| GEO-003 | Geometry | Corner resize | Not Started |
| GEO-004 | Geometry | Side resize | Not Started |
| GEO-005 | Geometry | Grid snap | Not Started |
| GEO-006 | Geometry | Keyboard nudge | Not Started |

### Structure and styles

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| STR-001 | Structure | Delete | Not Started |
| STR-002 | Structure | Duplicate | Not Started |
| STR-003 | Structure | Group | Not Started |
| STR-004 | Structure | Ungroup | Not Started |
| STR-005 | Structure | Lock | Not Started |
| STR-006 | Structure | Visibility | Not Started |
| STR-007 | Structure | Rename | Not Started |
| STR-008 | Structure | Bring forward | Not Started |
| STR-009 | Structure | Send backward | Not Started |
| STR-010 | Structure | Bring front/back | Not Started |
| STYLE-001 | Style | Fill | Not Started |
| STYLE-002 | Style | Stroke | Not Started |
| STYLE-003 | Style | Stroke width | Not Started |
| STYLE-004 | Style | Opacity | Not Started |
| STYLE-005 | Style | Text formatting | Not Started |

### Entity and ERD

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| ERD-001 | Entity | Create Entity | Not Started |
| ERD-002 | Entity | SQL parsing | Not Started |
| ERD-003 | Entity | Field-list parsing | Not Started |
| ERD-004 | Entity | Edit schema/name | Not Started |
| ERD-005 | Entity | Add/remove/reorder fields | Not Started |
| ERD-006 | Entity | PK/FK/identity/nullable/important | Not Started |
| ERD-007 | Entity | Collapse/expand | Not Started |
| ERD-008 | Entity | Show data types/key column | Not Started |
| ERD-009 | Relationship | Create/delete relationship | Not Started |
| ERD-010 | Relationship | Style/symbols/visibility | Not Started |
| ERD-011 | Relationship | Manual routes | Not Started |
| ERD-012 | Relationship | Auto routing settings | Not Started |
| ERD-013 | Layout | Auto Format | Not Started |

### Advanced PMT mapping

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| MAP-001 | Mapping | Entity annotations | Not Started |
| MAP-002 | Mapping | Create/edit Field Rectangle | Not Started |
| MAP-003 | Mapping | Map UI field to DB field | Not Started |
| MAP-004 | Mapping | Many-to-one mappings | Not Started |
| MAP-005 | Mapping | Mapping hover/highlight | Not Started |
| MAP-006 | Mapping | Field Mapping Table create/edit | Not Started |
| MAP-007 | Mapping | Mapping inspector tab | Not Started |
| MAP-008 | Mapping | Read-only mapping interactions | Not Started |

### Assets, templates, persistence

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| IMG-001 | Image | Insert image | Not Started |
| IMG-002 | Image | Crop/inset/radius | Not Started |
| TPL-001 | Template | Apply | Not Started |
| TPL-002 | Template | Create/update/delete | Not Started |
| TPL-003 | Template | Restore defaults | Not Started |
| CLIP-001 | Clipboard | Copy/paste same screen | Not Started |
| CLIP-002 | Clipboard | D1→D2 | Not Started |
| CLIP-003 | Clipboard | D2→D1 | Not Started |
| SAVE-001 | Persistence | Save same document | Not Started |
| SAVE-002 | Persistence | Row-version conflict | Not Started |
| IO-001 | Import/export | PMT Diagram import | Not Started |
| IO-002 | Import/export | PMT JSON export | Not Started |
| IO-003 | Import/export | SVG | Not Started |
| IO-004 | Import/export | PNG | Not Started |
| IO-005 | Import/export | Portable assets | Not Started |
| HIST-001 | History | Command-based undo/redo | Not Started |

## Completion rule

The parity program may not be declared complete while any required item remains:

- Not Started
- UI Only
- Command Complete without renderer/history/compatibility/performance completion

Every intentional deferral requires Sin's explicit approval and a documented reason.

<!-- END FILE: 10-FEATURE-PARITY-MATRIX-TEMPLATE.md -->

---

<!-- BEGIN FILE: 11-CODEX-COMPLETION-REPORT-TEMPLATE.md -->

# Codex Completion Report Template — Diagram 2 Editor Parity

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


## Executive summary

State exactly what became usable and whether the phase met its expected outcome.

Do not describe a control as implemented if only its markup exists.

## Expected outcome

Copy the expected outcome from the instruction file and mark each item:

```text
PASS
PARTIAL
FAIL
DEFERRED WITH SIN APPROVAL
```

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Visual parity evidence

Report:

```text
Diagram 1 visual controls studied:
Toolbar groups reproduced:
Inspector tabs reproduced:
Objects pane parity:
Dialogs/context menus parity:
Canvas handles/overlays parity:
Intentional visual differences:
Sin approval for differences:
1920×1080 comparison:
1366×768 comparison:
```

Do not claim visual parity based only on matching labels.

## Dual-entry-point evidence

Report separately:

```text
Shared Diagram 2 editor core used by both hosts:
RTE annotation host adapter:
Diagram document host adapter:

Diagram 1 Annotate preserved:
Diagram 1 Edit Annotate preserved:
Diagram 2 Annotate 2.0 available:
Diagram 2 Edit Annotate 2.0 available:
Top-navigation Diagram 2 available:

RTE new annotation save-back:
RTE existing annotation edit:
RTE cancel leaves content unchanged:
RTE focus/selection restored:
RTE route unchanged:
No standalone Diagram record created by normal RTE annotation:

D1 annotation opened in D2:
D2 annotation reopened in D1:
D1 document opened in D2:
D2 document reopened in D1:

Ten-cycle RTE cleanup:
Ten-cycle top-navigation cleanup:
Alternating-host cleanup:
```

## Per-host performance evidence

Provide separate normal and throttled measurements for:

```text
Top-navigation document host
RTE annotation host
```

Include end-to-end host mount boundaries, not only detached renderer timings.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## Files changed

List each file and its responsibility.

## Feature parity completed

List parity IDs from the authoritative matrix.

## Diagram 1 impact

State:

- Behavior changes
- Compatibility-only changes
- Shared helpers extracted
- Regression tests run

## Diagram 2 implementation

Describe:

- UI
- Controller/commands
- Renderer APIs
- Dirty categories
- Routing impact
- History
- Save/export
- Lifecycle

## Performance evidence

Provide before and after:

```text
Operation
Fixture
Median
p95
Full-render count
Objects patched
Relationships considered
Relationships rerouted
DOM descendants
Mounted/canonical counts
```

Explicitly state whether any routine operation called full `renderer.render()`.

## Compatibility evidence

Report:

```text
D1 open D1 save
D2 open D1 save
D1 open D2 save
D2 open D2 save
Clipboard both directions
Templates both directions
Import/export matrix
Unknown extensions
Renderer state absent from persistence
```

## Validation

List exact commands and results.

## Manual testing

Give numbered steps Sin can perform.

## Known limitations

Be specific. Do not hide feature gaps under "beta."

## Required refresh/build

State:

```text
Ctrl+F5 only
.NET rebuild
Database migration
```

## Commit

Use:

```text
Sin and Codex: <clear description>
```

Then stop and wait for manual approval.

<!-- END FILE: 11-CODEX-COMPLETION-REPORT-TEMPLATE.md -->
