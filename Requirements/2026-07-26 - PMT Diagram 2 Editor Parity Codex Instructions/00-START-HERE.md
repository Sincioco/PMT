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
