# Phase 15 — Redesign Standard Content Screens

## Objective

Redesign the standard content-oriented screens using the shared design system. Do not touch advanced planning/work-item screens in this phase.

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

- Dashboard
- Projects
- Sprints
- Scrum
- Documentation

## Required work

1. Improve information hierarchy, spacing, readability, and responsive layout.
2. Use existing shared components and tokens before creating new feature-specific CSS.
3. Preserve all data, actions, filters, charts, edit flows, permissions, and API behavior.
4. Avoid hiding important information solely to make the screen look cleaner.
5. Ensure good use at approximately 1366×768 and 1920×1080.
6. Implement both themes together.
7. Keep screen-specific CSS in the corresponding feature stylesheet.
8. Do not modify Tasks, Bugs, Backlog, Board, Gantt, Road Map, or Settings except to fix regressions caused by a shared component.

## Verification

- Run `dotnet build`.
- Fully test all five in-scope screens in both themes.
- Test create/edit/delete or equivalent interactions.
- Test charts, cards, collapsed/expanded sections, attachments, and filters.
- Test laptop and desktop widths.
- Check browser console errors.
- Run a regression pass on out-of-scope screens to ensure shared styling did not break them.

## Completion criteria

The five in-scope screens use the new design consistently and remain functionally equivalent.

## Suggested commit message

`design: redesign dashboard projects sprints scrum and documentation`
