# Phase 07 — Extract Tasks, Bugs, and Backlog Features

## Objective

Modularize the related work-item screens while preserving all shared task/bug business rules.

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

1. Extract Tasks into `wwwroot/js/features/tasks/`.
2. Extract Bugs into `wwwroot/js/features/bugs/`.
3. Extract Backlog into `wwwroot/js/features/backlog/`.
4. Keep shared work-item rules in shared modules, not duplicated between Tasks and Bugs:
   - status and percent rules;
   - task/bug lookup helpers;
   - linked bug completion restrictions;
   - assignee/reporter handling;
   - dependencies;
   - attachments;
   - permission checks.
5. Feature-specific filtering, chart visibility, editor layout, and rendering stay inside the appropriate feature folder.
6. Preserve all current `localStorage` key names.
7. Preserve endpoint URLs and payloads.
8. Preserve existing markup and CSS classes.
9. Register all three features through the screen registry.
10. Remove old implementations only after verification.

## Verification

- Run `dotnet build`.
- Test Task create/edit/delete/duplicate/reorder behavior.
- Test Bug create/edit/delete and QA-specific behavior.
- Test Backlog display and interactions.
- Test task and bug filters, sorting, visual charts, attachments, dependencies, sub-tasks, and linked bug restrictions.
- Test role-sensitive editing.
- Test both themes and laptop-size layout.
- Check browser console errors.

## Completion criteria

Tasks, Bugs, and Backlog are modular but continue sharing one authoritative set of work-item business rules.

## Suggested commit message

`refactor(frontend): modularize tasks bugs and backlog`
