# Phase 01 — Baseline, Inventory, and Guardrails

## Objective

Create a reliable baseline before any structural refactoring. Do not change PMT behavior or appearance in this phase.

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

1. Inspect the current repository structure and confirm the current default branch and working tree status.
2. Record the current approximate sizes and responsibilities of:
   - `wwwroot/app.js`
   - `wwwroot/styles.css`
   - `Program.cs`
   - `Data/SqlPmtStore.cs`
   - `Models/PmtModels.cs`
   - the SQL scripts
3. Identify every user-visible screen and the navigation label that opens it.
4. Identify all current frontend entry points, global event listeners, persistent `localStorage` keys, API endpoints, and major shared business rules.
5. Create `docs/baseline.md` containing:
   - the screen inventory;
   - the current frontend and backend entry points;
   - the major data flow from `/api/state` to rendering;
   - the current theme mechanism;
   - the current verification commands;
   - known architectural concentration points;
   - a warning that this document describes the pre-refactor baseline.
6. Create `docs/manual-smoke-test.md` with a concise manual checklist covering:
   - login and logout;
   - navigation to every screen;
   - create/edit/delete for representative records;
   - light and dark theme switching;
   - Board drag/drop;
   - Gantt and Road Map rendering;
   - dialogs;
   - browser console errors;
   - laptop-size viewport checking.
7. Do not move, rename, or rewrite application files.

## Verification

- Run `dotnet restore`.
- Run `dotnet build`.
- Start the application if the environment permits.
- Execute as much of `docs/manual-smoke-test.md` as the available environment supports.
- Confirm that only documentation files were changed.

## Completion criteria

- `docs/baseline.md` accurately maps the current application.
- `docs/manual-smoke-test.md` can be reused after every later phase.
- The application still builds.
- No production code, SQL, CSS, or JavaScript changed.

## Suggested commit message

`docs: record PMT baseline and smoke-test checklist`
