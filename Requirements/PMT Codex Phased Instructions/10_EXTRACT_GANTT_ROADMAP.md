# Phase 10 — Extract Gantt and Road Map

## Objective

Modularize the two most complex timeline views without redesigning or changing calculations.

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

1. Extract Gantt into `wwwroot/js/features/gantt/` with cohesive modules for:
   - rendering;
   - date/layout calculations;
   - controls and preferences;
   - fly-by animation;
   - bug expansion and dependencies.
2. Extract Road Map into `wwwroot/js/features/roadmap/` with cohesive modules for:
   - rendering;
   - date/layout calculations;
   - filters and sorting;
   - project/sprint display options.
3. Keep shared date-range/calendar helpers in `shared/` only when both features genuinely use the same logic.
4. Keep Gantt and Road Map independent; they must not import each other.
5. Preserve all `localStorage` keys and defaults.
6. Preserve calculated positions, date ranges, non-working-day behavior, holidays, animations, and interactions.
7. Register both screens in the central registry.
8. Remove old implementations only after side-by-side behavior is verified.
9. Do not change the UI design.

## Verification

- Run `dotnet build`.
- Test Gantt with several projects, sprint modes, sorting modes, bugs, dependencies, holidays, non-working-day options, and fly-by animation.
- Test Road Map with project/sprint filters, sorting, show/hide dates, details, and sprints.
- Compare rendered date ranges and item positions with the pre-refactor baseline.
- Test both themes and laptop-size horizontal scrolling.
- Check browser console errors and animation cleanup when navigating away.

## Completion criteria

Gantt and Road Map are isolated advanced features, and their calculations remain behaviorally equivalent to the baseline.

## Suggested commit message

`refactor(frontend): modularize gantt and roadmap timelines`
