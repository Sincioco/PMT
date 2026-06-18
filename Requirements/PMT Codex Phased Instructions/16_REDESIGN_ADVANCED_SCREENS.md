# Phase 16 — Redesign Work-Item and Advanced Planning Screens

## Objective

Complete the new UI for the remaining screens while preserving complex interactions and calculations.

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

## In-scope screens

- Tasks
- Bugs
- Backlog
- Board
- Gantt
- Road Map
- Settings

## Required work

1. Redesign Tasks, Bugs, and Backlog for dense but readable information.
2. Redesign Board while preserving drag/drop, status columns, sorting, filters, and persistence.
3. Redesign Gantt and Road Map while preserving:
   - calculated positions;
   - date ranges;
   - horizontal scrolling;
   - sticky headers;
   - holidays and non-working days;
   - dependencies;
   - bug expansion;
   - fly-by animation;
   - filters and display preferences.
4. Redesign Settings while keeping categories and administrative actions clear.
5. Use shared tokens/components first.
6. Implement both themes together.
7. Preserve all event hooks, data attributes, API contracts, and business rules.
8. Keep laptop readability as a hard requirement.
9. Do not introduce a canvas or third-party chart/timeline library unless explicitly approved.

## Verification

- Run `dotnet build`.
- Fully test all in-scope screens in both themes.
- Test all Tasks/Bugs/Backlog filters and edit flows.
- Test Board drag/drop and navigation cleanup.
- Test Gantt and Road Map with multiple data configurations and horizontal scrolling.
- Test Settings permissions and administrative actions.
- Test 1366×768 and 1920×1080.
- Check browser console errors and obvious rendering performance regressions.

## Completion criteria

Every PMT screen uses the new coherent light/dark design without losing functionality or advanced interactions.

## Suggested commit message

`design: redesign work-item planning and settings screens`
