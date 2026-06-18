# Phase 09 — Extract Kanban Board and Drag Interactions

## Objective

Move the Kanban Board and its interaction logic into a focused feature without changing behavior.

## Mandatory operating rules

1. Work only on the scope described in this phase.
2. Do not begin the next phase, even if this phase finishes early.
3. Preserve current behavior unless this phase explicitly changes behavior or appearance.
4. Do not add React, Angular, Vue, TypeScript, a bundler, or another frontend framework.
5. Keep the implementation simple: native JavaScript ES modules, HTML, CSS, ASP.NET Core, ADO.NET, and stored procedures.
6. Read the repository root `AGENTS.md` and any nearer `AGENTS.md` files before editing.
7. Start by running `git status`. Do not overwrite unrelated user changes.
8. Before coding, give a concise impact map listing the files likely to change.
9. Make the smallest cohesive change that completes this phase.
10. Do not perform opportunistic cleanup outside the stated scope.
11. Run all verification listed in this phase.
12. If verification fails, fix only failures caused by this phase.
13. End with a concise report containing:
    - files changed;
    - behavior preserved or intentionally changed;
    - verification performed and results;
    - remaining risks;
    - the exact recommended Git commit message.
14. Stop after the final report. Do not continue into another phase.

## Quota-safety rule

This phase is intentionally bounded. Complete the required work before attempting any optional item. If an unexpected architectural problem makes the required work substantially larger, stop at a clean, buildable checkpoint and report the blocker rather than expanding the task.

## Required work

1. Extract Board rendering into `wwwroot/js/features/board/board.js`.
2. Extract Board-specific drag and pointer/mouse behavior into a focused module such as `board-drag.js`.
3. Keep only truly shared drag helpers outside the feature.
4. Board-specific state must remain in the Board feature:
   - selected project;
   - sprint mode;
   - sorting;
   - visible statuses;
   - empty-column behavior;
   - dragged item state.
5. Preserve all current `localStorage` keys.
6. Preserve touch, pointer, and mouse behavior that currently exists.
7. Preserve task update and reorder payloads.
8. Register Board through the screen registry.
9. Remove global Board listeners when feature-scoped or delegated listeners can safely replace them.
10. Do not redesign columns or cards in this phase.

## Verification

- Run `dotnet build`.
- Test Board loading with multiple projects and sprints.
- Test drag/drop and reordering with mouse.
- Test pointer behavior if the environment supports it.
- Test status changes, hidden/empty columns, sorting, filters, and persistence.
- Navigate away from Board and back; verify listeners are not duplicated.
- Test both themes.
- Check browser console errors.

## Completion criteria

All Board-specific logic has a clear feature boundary, interactions remain stable, and no duplicate global listeners accumulate.

## Suggested commit message

`refactor(frontend): isolate kanban board interactions`
