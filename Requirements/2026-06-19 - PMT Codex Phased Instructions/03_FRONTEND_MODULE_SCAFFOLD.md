# Phase 03 — Frontend Module Scaffold

## Objective

Create the target frontend folder structure and safely establish native JavaScript ES modules without performing broad functional extraction.

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

1. Read:
   - `AGENTS.md`
   - `wwwroot/AGENTS.md`
   - `docs/architecture.md`
   - `docs/manual-smoke-test.md`
2. Create the agreed folder skeleton under `wwwroot/js/`:
   - `core/`
   - `shared/`
   - `components/`
   - `features/` with one folder per current screen.
3. Move or convert the existing frontend entry point to `wwwroot/js/app.js`.
4. Update `wwwroot/index.html` to load the entry point as a native ES module.
5. Make only the minimal compatibility changes required by module strict mode.
6. Add a small screen registry or routing map that lists all current views, but leave the existing rendering implementations in the entry file for now if extracting them would enlarge this phase.
7. Do not redesign the UI.
8. Do not split screen implementations yet.
9. Preserve all existing navigation labels, `localStorage` keys, API behavior, and event behavior.
10. Update `docs/architecture.md` to record the actual scaffold created.

## Verification

- Run `dotnet build`.
- Start the application.
- Run the complete manual smoke-test checklist.
- Check the browser console for module-loading, undefined-symbol, path, and strict-mode errors.
- Verify direct loading and refresh still work.
- Verify both themes still work.

## Completion criteria

- The application runs from `wwwroot/js/app.js` as an ES module.
- The feature/core/shared/component folders exist.
- No screen has been redesigned.
- No substantial feature extraction was attempted.
- The application remains behaviorally equivalent.

## Suggested commit message

`refactor(frontend): establish native ES module scaffold`
