# Phase 12 — Split Feature-Specific CSS

## Objective

Move all remaining screen-specific CSS into feature stylesheets without redesigning the UI.

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

1. Create one feature stylesheet for each major screen or closely related feature group:
   - Dashboard;
   - Projects;
   - Sprints;
   - Tasks;
   - Bugs;
   - Backlog;
   - Board;
   - Gantt;
   - Road Map;
   - Scrum;
   - Documentation;
   - Settings;
   - Login if needed.
2. Move only selectors that are truly feature-specific.
3. Keep reusable selectors in shared component files.
4. Eliminate the old compatibility stylesheet only after all rules are accounted for.
5. Document the CSS ownership rule:
   - tokens define values;
   - themes override semantic values;
   - base/layout establish structure;
   - components style reusable UI;
   - features style screen-specific composition.
6. Do not rename large numbers of classes in this phase.
7. Do not redesign.

## Verification

- Run `dotnet build`.
- Test every screen in dark and light themes.
- Test 1366×768 and 1920×1080 or equivalent viewport sizes.
- Check horizontal overflow and sticky elements.
- Compare Board, Gantt, and Road Map carefully.
- Check network requests for missing styles.
- Search for duplicate selectors and orphaned old stylesheet references.

## Completion criteria

Every CSS rule has an understandable owner, the old monolithic stylesheet is gone or contains no production rules, and appearance remains equivalent.

## Suggested commit message

`refactor(css): isolate feature stylesheets`
