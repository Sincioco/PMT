# Phase 08 — Extract Dashboard, Scrum, and Documentation Features

## Objective

Modularize the remaining non-advanced content screens. Preserve behavior and appearance.

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

1. Extract Dashboard into `wwwroot/js/features/dashboard/`.
2. Extract Scrum into `wwwroot/js/features/scrum/`.
3. Extract Documentation into `wwwroot/js/features/documentation/`.
4. Keep reusable visual metrics and chart primitives in components only when multiple screens use them.
5. Keep dashboard-only aggregation and expansion state in Dashboard.
6. Keep dev-log/Scrum behavior in Scrum.
7. Keep blog/documentation editing, history, attachments, and project filtering in Documentation.
8. Preserve API endpoints, payloads, CSS classes, persisted settings, and permissions.
9. Register each screen in the central registry.
10. Remove migrated code from the entry module after verification.
11. Update architecture documentation.

## Verification

- Run `dotnet build`.
- Test Dashboard cards, metrics, charts, and expansion behavior.
- Test Scrum/dev-log create/edit/delete/pinning and filtering.
- Test Documentation create/edit/delete/history/attachments/project filtering and link behavior.
- Test both themes and laptop-size layout.
- Check browser console errors.

## Completion criteria

These screens can be modified independently, and the entry module contains no implementation for them.

## Suggested commit message

`refactor(frontend): modularize dashboard scrum and documentation`
