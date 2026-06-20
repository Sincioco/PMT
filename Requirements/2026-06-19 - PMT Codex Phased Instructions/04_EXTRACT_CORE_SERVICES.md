# Phase 04 — Extract Frontend Core Services

## Objective

Extract application-wide infrastructure from the frontend entry file while preserving every screen's behavior and markup.

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

Extract only these responsibilities into focused modules under `wwwroot/js/core/`:

1. `api.js`
   - generic request handling;
   - common headers;
   - JSON and FormData behavior;
   - error normalization.
2. `store.js`
   - the central application state;
   - state loading and replacement;
   - safe getters/subscriptions only if actually needed.
3. `preferences.js`
   - all `localStorage` access;
   - existing key names must remain unchanged;
   - parsing and default-value handling.
4. `authentication.js`
   - login;
   - logout;
   - current-user identity lifecycle.
5. `router.js`
   - current view;
   - view normalization for legacy names;
   - navigation selection.
6. `application-shell.js`
   - startup orchestration;
   - top-level shell rendering;
   - navigation wiring at a high level.

Constraints:

- Do not extract screen-specific rendering.
- Do not change endpoint URLs or payloads.
- Do not introduce a complex state-management framework.
- Prefer simple exported functions and a small state object.
- Keep the new entry file responsible only for startup and composition.
- Update `docs/architecture.md` with the resulting dependencies.

## Verification

- Run `dotnet build`.
- Start the application.
- Complete the manual smoke-test checklist.
- Verify login, logout, navigation, theme persistence, filters, and saved view preferences.
- Search for duplicated direct `localStorage` access that should now be in `preferences.js`.
- Search for duplicated generic `fetch` wrappers that should now be in `api.js`.

## Completion criteria

- Core infrastructure is outside the entry file.
- Screen code remains functionally unchanged.
- The entry file is materially smaller and easier to scan.
- No frontend framework or abstraction layer was added.

## Suggested commit message

`refactor(frontend): extract core application services`
