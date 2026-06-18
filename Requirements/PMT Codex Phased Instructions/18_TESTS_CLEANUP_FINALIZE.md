# Phase 18 — Automated Tests, Verified Cleanup, and Final Documentation

## Objective

Add regression protection, remove only proven dead code, and finalize documentation after the refactor and redesign.

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

1. Add tests for pure JavaScript business logic, prioritizing:
   - status and percent calculations;
   - linked bug completion rules;
   - permissions;
   - date-range calculations;
   - filtering and sorting;
   - Gantt/Road Map layout calculations where practical;
   - escaping and URL normalization.
2. Add browser smoke tests with a lightweight supported approach, preferably Playwright if introducing it is acceptable to the repository:
   - login;
   - navigation to every screen;
   - dark and light themes;
   - dialogs;
   - representative filters;
   - Board interaction smoke test;
   - Gantt and Road Map rendering;
   - console-error detection;
   - 1366×768 and 1920×1080 screenshots or checks.
3. Add deterministic development/test data support only if needed for reliable UI tests. Keep it isolated from production.
4. Search for:
   - unused JavaScript exports/functions;
   - obsolete CSS selectors;
   - duplicate styles;
   - obsolete compatibility files;
   - dead endpoint helpers;
   - stale documentation.
5. Remove an item only when its lack of use is demonstrable.
6. Run the full application verification.
7. Update:
   - `README.md`;
   - `docs/architecture.md`;
   - `docs/domain-rules.md`;
   - `docs/ui-design-system.md`;
   - `docs/manual-smoke-test.md`.
8. Record the final folder structure and standard commands.

## Verification

- Run `dotnet restore`.
- Run `dotnet build`.
- Run all JavaScript/unit tests.
- Run all browser smoke tests.
- Run the manual smoke-test checklist.
- Test both themes and target viewport sizes.
- Confirm the working tree contains no generated test artifacts that should be ignored.
- Confirm documentation commands are accurate.

## Completion criteria

PMT has automated regression protection, no known orphaned migration files, current documentation, and a structure that lets Codex work on focused areas with less repeated context.

## Suggested commit message

`test: add PMT regression coverage and finalize modular architecture`
