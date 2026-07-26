# Start Here — PMT Diagram 2 Full Editor Parity Instructions

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
2. `02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md`
3. `03-PHASE-2-EDITOR-FOUNDATION-COMMANDS-HISTORY-SHELL.md`
4. `04-PHASE-3-CORE-DRAWING-SELECTION-INSPECTOR.md`
5. `05-PHASE-4-STRUCTURE-OBJECTS-TREE-GROUPS-LAYERS-CLIPBOARD-TEMPLATES.md`
6. `06-PHASE-5-ENTITY-ERD-RELATIONSHIPS-AUTO-FORMAT.md`
7. `07-PHASE-6-IMAGES-CROP-ANNOTATIONS-FIELD-MAPPING.md`
8. `08-PHASE-7-SAVE-IMPORT-EXPORT-ROUNDTRIP-UX-PARITY.md`
9. `09-PHASE-8-PERFORMANCE-HARDENING-500-1000-ENTITY-PROMOTION.md`

Use:

- `10-FEATURE-PARITY-MATRIX-TEMPLATE.md`
- `11-CODEX-COMPLETION-REPORT-TEMPLATE.md`

throughout the program.

`ALL-IN-ONE-CODEX-INSTRUCTIONS.md` contains the same program as one large reference file. Phase-by-phase execution is safer because it creates review checkpoints.
