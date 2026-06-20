# Phase 06 — Extract Projects, Sprints, and Settings Features

## Objective

Move three conventional feature areas into independent modules using the standard screen contract. Preserve behavior and appearance.

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

1. Extract Projects into `wwwroot/js/features/projects/`.
2. Extract Sprints into `wwwroot/js/features/sprints/`.
3. Extract Settings into `wwwroot/js/features/settings/`, including the currently related Users, Lookups, Holidays, and development/admin actions where applicable.
4. Each feature should own:
   - its rendering;
   - screen-specific filters and preferences;
   - action handling;
   - editor/dialog orchestration specific to the feature;
   - feature-only calculations.
5. Each feature may import from:
   - `core/`;
   - `shared/`;
   - `components/`.
6. Features must not directly import one another.
7. Register the extracted screens in the central screen registry.
8. Preserve existing API endpoints, data contracts, CSS classes, and user-visible behavior.
9. Remove migrated code from the old entry module only after the new modules are verified.
10. Update the architecture impact map.

## Verification

- Run `dotnet build`.
- Test Projects create/edit/delete and project member behavior.
- Test Sprints create/edit/finish/delete and sprint filters.
- Test Settings navigation and each settings category.
- Test users, lookups, holidays, and admin/development actions according to existing permissions.
- Test both themes and laptop-size layout.
- Check browser console errors.

## Completion criteria

Projects, Sprints, and Settings can be understood and modified without opening unrelated screen implementations.

## Suggested commit message

`refactor(frontend): modularize projects sprints and settings`
