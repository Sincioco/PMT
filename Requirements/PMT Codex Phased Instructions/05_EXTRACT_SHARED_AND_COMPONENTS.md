# Phase 05 — Extract Shared Utilities and Reusable Components

## Objective

Move reusable, screen-independent logic and UI builders out of the entry file. Do not extract full screens in this phase.

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

Create or populate modules under `wwwroot/js/shared/` for cohesive concerns such as:

- constants and fallback lookup values;
- HTML and attribute escaping;
- URL normalization and linkification;
- date and date-time formatting;
- status and percentage calculations;
- permissions;
- state selectors such as `projectById`, `sprintById`, `taskById`, and `userById`;
- filtering/sorting helpers that are genuinely reused.

Create or populate modules under `wwwroot/js/components/` for reusable UI builders such as:

- buttons and icons;
- dialogs and confirmation/prompt helpers;
- form fields and select builders;
- avatars;
- progress indicators and status legends;
- attachments;
- filters;
- charts only when the chart implementation is reused by multiple screens.

Constraints:

- Keep domain rules in named functions rather than burying them in rendering templates.
- Do not create one file per tiny function.
- Do not move logic that is used by only one advanced screen merely to shorten the entry file.
- Preserve current HTML output and CSS classes.
- Add lightweight tests for pure shared functions only if a test harness already exists; otherwise document candidate tests for Phase 18.
- Update `docs/architecture.md` and `docs/domain-rules.md` when boundaries become clearer.

## Verification

- Run `dotnet build`.
- Start the application.
- Execute the complete manual smoke-test checklist.
- Verify no duplicate definitions remain in the entry file.
- Verify linked bug completion, percent calculations, role checks, date formatting, dialogs, and attachments.

## Completion criteria

Shared logic has one clear home, rendering output is unchanged, and future feature modules can import stable utilities rather than depending on a global script.

## Suggested commit message

`refactor(frontend): extract shared utilities and UI components`
