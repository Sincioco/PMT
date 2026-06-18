# PMT Codex Phased Instructions — Combined Reference
> Do not give this entire file to Codex as a single implementation task. Use one numbered phase at a time.


---

<!-- FILE: 00_READ_ME_FIRST.md -->

# PMT Codex Phased Refactoring and UI Redesign Plan

## Recommended file format

Use these **Markdown (`.md`) files**, one at a time.

Markdown is preferable to PDF or plain text because:

- Codex can read Markdown directly without PDF text extraction.
- Headings, checklists, code blocks, paths, and commands remain structured.
- The files can live in the repository and be version controlled.
- You can revise individual phases as PMT evolves.
- Markdown normally creates less parsing overhead than a PDF.
- Plain `.txt` would work, but it loses useful structure and is harder to maintain.

Do not give Codex the entire ZIP or the combined plan as the implementation prompt. Give it only the next numbered phase.

## How to use the files

1. Make sure the previous phase is complete and the repository is in a clean, working state.
2. Open a fresh Codex task or session.
3. Attach or paste exactly one numbered phase file.
4. Tell Codex: `Execute this phase only. Stop after the final report.`
5. Review the diff and test results.
6. Commit the completed phase before starting the next one.
7. Start the next phase only when your quota permits.

## Why there are many small phases

PMT currently concentrates much of the browser application in a very large `wwwroot/app.js`, while most styling is in one large `wwwroot/styles.css`. The purpose of these phases is to create stable boundaries before asking Codex to redesign the application.

A single instruction such as “refactor the frontend and redesign all screens in light and dark themes” is too large and creates a high risk of:

- exhausting the daily quota;
- leaving the repository in a partially migrated state;
- mixing architecture changes with visual changes;
- breaking behavior that is difficult to identify;
- forcing Codex to repeatedly reload unrelated context.

These phases separate structural work, design-system work, screen redesign work, backend cleanup, and automated verification.

## Phase order

| Phase | Purpose |
|---|---|
| 01 | Audit the current repository and establish a reproducible baseline |
| 02 | Add repository instructions and architecture documentation |
| 03 | Add the frontend module scaffold and switch safely to ES modules |
| 04 | Extract API, state, preferences, authentication, and routing |
| 05 | Extract shared utilities and reusable UI components |
| 06 | Extract Projects, Sprints, and Settings |
| 07 | Extract Tasks, Bugs, and Backlog |
| 08 | Extract Dashboard, Scrum, and Documentation |
| 09 | Extract the Kanban Board and drag interactions |
| 10 | Extract Gantt and Road Map |
| 11 | Split CSS foundations and shared components |
| 12 | Split feature-specific CSS |
| 13 | Define the new light/dark design system |
| 14 | Redesign the application shell and shared components |
| 15 | Redesign Dashboard, Projects, Sprints, Scrum, and Documentation |
| 16 | Redesign Tasks, Bugs, Backlog, Board, Gantt, Road Map, and Settings |
| 17 | Split backend endpoints, data access, and model files |
| 18 | Add automated tests, remove verified dead code, and finalize documentation |

## Important

No plan can guarantee that a Codex quota will never run out. These instructions reduce that risk by making every task small, atomic, independently verifiable, and safe to commit. The advanced views—Board, Gantt, and Road Map—are deliberately isolated because they are likely to consume more context than ordinary CRUD screens.

---

<!-- FILE: 01_BASELINE_AND_GUARDRAILS.md -->

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

---

<!-- FILE: 02_AGENTS_AND_ARCHITECTURE_DOCS.md -->

# Phase 02 — AGENTS.md and Architecture Documentation

## Objective

Give Codex concise, layered repository instructions and a map showing where future changes belong. Do not refactor production code in this phase.

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

1. Read `docs/baseline.md`.
2. Create a root `AGENTS.md` that documents:
   - PMT's product purpose;
   - the technology stack;
   - the KISS principle;
   - the intended feature-based frontend structure;
   - the requirement to preserve native JavaScript and avoid a framework/bundler;
   - the requirement that SQL access uses stored procedures under `[pmt]`;
   - required verification;
   - links to the detailed documents under `docs/`.
3. Create `wwwroot/AGENTS.md` with frontend-specific rules:
   - use native ES modules;
   - feature modules may depend on `core`, `shared`, and `components`;
   - one feature must not directly import another feature;
   - API access belongs in core API modules;
   - reusable calculations should be pure functions;
   - light and dark themes must share markup and component CSS;
   - avoid inline styles except values that must be calculated dynamically.
4. Create `Sql/AGENTS.md` with SQL-specific rules:
   - all objects use `[pmt]`;
   - stored procedures remain the application data-access contract;
   - result-set order for aggregate procedures must be treated as a contract;
   - schema, procedures, and seed changes must remain synchronized;
   - deployment must not require internet access.
5. Create `docs/architecture.md` containing:
   - current architecture;
   - target frontend folder layout;
   - target backend file layout;
   - dependency direction rules;
   - an impact-map table connecting each feature to frontend files, endpoints, data methods, and stored procedures.
6. Create `docs/domain-rules.md` documenting durable rules that can be confirmed from code and SQL, especially:
   - statuses and completion rules;
   - Dev Task versus Bug behavior;
   - linked bug completion restrictions;
   - role/permission behavior;
   - project/sprint completion calculations;
   - persisted filters and preferences.
7. Create `docs/ui-design-system.md` as an initial specification placeholder with:
   - semantic token categories;
   - shared component categories;
   - required light/dark parity;
   - supported viewport targets;
   - accessibility expectations.
8. Keep every `AGENTS.md` concise. Put details in `docs/` rather than duplicating them.

## Verification

- Run `dotnet build`.
- Confirm no production code changed.
- Confirm the root and nested instructions do not contradict one another.
- Confirm every referenced documentation path exists.

## Completion criteria

Codex can determine the correct files and rules for a future task by reading the root instructions, the nearest nested instructions, and one or two focused architecture documents.

## Suggested commit message

`docs: add Codex instructions and PMT architecture map`

---

<!-- FILE: 03_FRONTEND_MODULE_SCAFFOLD.md -->

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

---

<!-- FILE: 04_EXTRACT_CORE_SERVICES.md -->

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

---

<!-- FILE: 05_EXTRACT_SHARED_AND_COMPONENTS.md -->

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

---

<!-- FILE: 06_EXTRACT_PROJECTS_SPRINTS_SETTINGS.md -->

# Phase 06 — Extract Projects, Sprints, and Settings Features

## Objective

Move three conventional feature areas into independent modules using the standard screen contract. Preserve behavior and appearance.

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

1. Extract Projects into `wwwroot/js/features/projects/`.
2. Extract Sprints into `wwwroot/js/features/sprints/`.
3. Extract Settings into `wwwroot/js/features/settings/`, including the currently related Users, Lookups, Holidays, and development/admin actions where applicable.
4. Each feature should own:
   - its rendering;
   - screen-specific filters and preferences;
   - action handling;
   - editor/dialog orchestration specific to the feature;
   - feature-only calculations.
5. Each feature may import from:
   - `core/`;
   - `shared/`;
   - `components/`.
6. Features must not directly import one another.
7. Register the extracted screens in the central screen registry.
8. Preserve existing API endpoints, data contracts, CSS classes, and user-visible behavior.
9. Remove migrated code from the old entry module only after the new modules are verified.
10. Update the architecture impact map.

## Verification

- Run `dotnet build`.
- Test Projects create/edit/delete and project member behavior.
- Test Sprints create/edit/finish/delete and sprint filters.
- Test Settings navigation and each settings category.
- Test users, lookups, holidays, and admin/development actions according to existing permissions.
- Test both themes and laptop-size layout.
- Check browser console errors.

## Completion criteria

Projects, Sprints, and Settings can be understood and modified without opening unrelated screen implementations.

## Suggested commit message

`refactor(frontend): modularize projects sprints and settings`

---

<!-- FILE: 07_EXTRACT_TASKS_BUGS_BACKLOG.md -->

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

---

<!-- FILE: 08_EXTRACT_DASHBOARD_SCRUM_DOCUMENTATION.md -->

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

---

<!-- FILE: 09_EXTRACT_BOARD.md -->

# Phase 09 — Extract Kanban Board and Drag Interactions

## Objective

Move the Kanban Board and its interaction logic into a focused feature without changing behavior.

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

1. Extract Board rendering into `wwwroot/js/features/board/board.js`.
2. Extract Board-specific drag and pointer/mouse behavior into a focused module such as `board-drag.js`.
3. Keep only truly shared drag helpers outside the feature.
4. Board-specific state must remain in the Board feature:
   - selected project;
   - sprint mode;
   - sorting;
   - visible statuses;
   - empty-column behavior;
   - dragged item state.
5. Preserve all current `localStorage` keys.
6. Preserve touch, pointer, and mouse behavior that currently exists.
7. Preserve task update and reorder payloads.
8. Register Board through the screen registry.
9. Remove global Board listeners when feature-scoped or delegated listeners can safely replace them.
10. Do not redesign columns or cards in this phase.

## Verification

- Run `dotnet build`.
- Test Board loading with multiple projects and sprints.
- Test drag/drop and reordering with mouse.
- Test pointer behavior if the environment supports it.
- Test status changes, hidden/empty columns, sorting, filters, and persistence.
- Navigate away from Board and back; verify listeners are not duplicated.
- Test both themes.
- Check browser console errors.

## Completion criteria

All Board-specific logic has a clear feature boundary, interactions remain stable, and no duplicate global listeners accumulate.

## Suggested commit message

`refactor(frontend): isolate kanban board interactions`

---

<!-- FILE: 10_EXTRACT_GANTT_ROADMAP.md -->

# Phase 10 — Extract Gantt and Road Map

## Objective

Modularize the two most complex timeline views without redesigning or changing calculations.

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

1. Extract Gantt into `wwwroot/js/features/gantt/` with cohesive modules for:
   - rendering;
   - date/layout calculations;
   - controls and preferences;
   - fly-by animation;
   - bug expansion and dependencies.
2. Extract Road Map into `wwwroot/js/features/roadmap/` with cohesive modules for:
   - rendering;
   - date/layout calculations;
   - filters and sorting;
   - project/sprint display options.
3. Keep shared date-range/calendar helpers in `shared/` only when both features genuinely use the same logic.
4. Keep Gantt and Road Map independent; they must not import each other.
5. Preserve all `localStorage` keys and defaults.
6. Preserve calculated positions, date ranges, non-working-day behavior, holidays, animations, and interactions.
7. Register both screens in the central registry.
8. Remove old implementations only after side-by-side behavior is verified.
9. Do not change the UI design.

## Verification

- Run `dotnet build`.
- Test Gantt with several projects, sprint modes, sorting modes, bugs, dependencies, holidays, non-working-day options, and fly-by animation.
- Test Road Map with project/sprint filters, sorting, show/hide dates, details, and sprints.
- Compare rendered date ranges and item positions with the pre-refactor baseline.
- Test both themes and laptop-size horizontal scrolling.
- Check browser console errors and animation cleanup when navigating away.

## Completion criteria

Gantt and Road Map are isolated advanced features, and their calculations remain behaviorally equivalent to the baseline.

## Suggested commit message

`refactor(frontend): modularize gantt and roadmap timelines`

---

<!-- FILE: 11_SPLIT_CSS_FOUNDATIONS_COMPONENTS.md -->

# Phase 11 — Split CSS Foundations and Shared Components

## Objective

Split the monolithic stylesheet into semantic foundations and reusable component styles without changing the visual design.

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

1. Create a CSS structure under `wwwroot/css/` containing:
   - `tokens.css`;
   - `themes.css`;
   - `base.css`;
   - `layout.css`;
   - `components/` files for shared buttons, cards/panels, forms, dialogs, tables/lists, filters, navigation, avatars, attachments, progress/status visuals, and shared charts.
2. Move existing rules; do not redesign them.
3. Preserve cascade behavior and selector specificity.
4. Preserve the existing theme values and visual output.
5. Update `index.html` to load the new styles in a documented deterministic order.
6. Do not use CSS `@import` unless there is a demonstrated reason; multiple `<link>` elements are acceptable and easier to debug.
7. Avoid duplicating selectors between the old and new files.
8. Keep feature-specific rules temporarily in a remaining compatibility stylesheet if necessary.
9. Update `docs/ui-design-system.md` with the actual loading order and ownership rules.

## Verification

- Run `dotnet build`.
- Open every screen in both themes.
- Compare the application shell, buttons, cards, dialogs, forms, tables, filters, charts, and navigation with the baseline.
- Test laptop and desktop viewport sizes.
- Check for missing styles, changed specificity, flashes of unthemed content, and 404s.
- Confirm no CSS rule was intentionally redesigned.

## Completion criteria

Shared CSS foundations and components have clear ownership, while the UI remains visually equivalent to the baseline.

## Suggested commit message

`refactor(css): split foundations and shared components`

---

<!-- FILE: 12_SPLIT_FEATURE_CSS.md -->

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

---

<!-- FILE: 13_DEFINE_NEW_DESIGN_SYSTEM.md -->

# Phase 13 — Define the New Light and Dark Design System

## Objective

Create the new visual design system and token specification without redesigning every screen yet.

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

## Inputs

The user may provide one or more visual reference images. Treat them as inspiration, not as permission to remove existing information or functionality.

## Required work

1. Read `docs/ui-design-system.md`.
2. Audit current shared components and feature layouts.
3. Define semantic tokens for both themes:
   - page and surface colors;
   - elevated/glass surfaces;
   - text hierarchy;
   - primary, secondary, success, warning, danger, and information colors;
   - borders;
   - focus indicators;
   - shadows;
   - radii;
   - spacing;
   - typography scale;
   - control heights;
   - chart colors;
   - status-color integration;
   - animation timing.
4. Keep one semantic token contract shared by light and dark themes.
5. Update `tokens.css` and `themes.css`.
6. Expand `docs/ui-design-system.md` with:
   - token definitions;
   - component principles;
   - density and responsiveness rules;
   - accessibility and contrast rules;
   - glassmorphism constraints;
   - examples for buttons, cards, tables, forms, dialogs, navigation, and charts.
7. Create a temporary internal design-system showcase page or development-only component gallery if it can be done without broad application changes.
8. Do not redesign individual feature screens in this phase.
9. Do not change business behavior.

## Verification

- Run `dotnet build`.
- Verify token completeness in both themes.
- Check text contrast, focus visibility, disabled controls, hover/active states, and status colors.
- Verify the optional showcase at laptop and desktop widths.
- Confirm no feature functionality changed.

## Completion criteria

The new visual language is fully specified and reusable before screen-by-screen implementation begins.

## Suggested commit message

`design: define PMT light and dark design system`

---

<!-- FILE: 14_REDESIGN_SHELL_COMPONENTS.md -->

# Phase 14 — Redesign Application Shell and Shared Components

## Objective

Apply the new design system to the global shell and reusable components so later screen redesigns require fewer changes.

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

Redesign only:

- page background;
- top navigation/application shell;
- brand area;
- user menu;
- responsive navigation behavior;
- page headers and toolbars;
- buttons;
- cards and panels;
- forms and controls;
- dialogs;
- tables/list primitives;
- filters;
- avatars and attachments;
- progress/status visuals;
- shared chart framing;
- toasts and empty states;
- login screen.

Constraints:

- Preserve all existing information and actions.
- Preserve event hooks and `data-*` attributes.
- Prefer changing shared component markup/builders once rather than patching every feature.
- Maintain laptop readability and large-screen scalability.
- Implement both themes simultaneously.
- Do not perform screen-specific layout redesigns except where a shared component necessarily changes.
- Keep glass effects restrained enough for text readability and performance.
- Maintain keyboard focus visibility and reasonable touch targets.

## Verification

- Run `dotnet build`.
- Test login, navigation, menus, dialogs, forms, filters, tables, charts, toasts, and empty states.
- Test every screen for accidental regressions caused by shared components.
- Test both themes at laptop and desktop widths.
- Check browser console errors.
- Check keyboard navigation and focus indicators.

## Completion criteria

The shell and shared components consistently express the new design, while feature layouts and functionality remain intact.

## Suggested commit message

`design: redesign PMT shell and shared components`

---

<!-- FILE: 15_REDESIGN_CONTENT_SCREENS.md -->

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

---

<!-- FILE: 16_REDESIGN_ADVANCED_SCREENS.md -->

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

---

<!-- FILE: 17_BACKEND_FILE_RESTRUCTURE.md -->

# Phase 17 — Backend File Restructure

## Objective

Reduce backend context concentration by splitting files along feature boundaries without introducing unnecessary service/repository layers or changing API behavior.

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

1. Split endpoint mappings from `Program.cs` into focused endpoint extension files, such as:
   - authentication;
   - projects;
   - sprints;
   - tasks/bugs;
   - users/settings/lookups/holidays;
   - Scrum/documentation;
   - uploads;
   - development/admin.
2. Keep `Program.cs` focused on:
   - service registration;
   - middleware;
   - static-file setup;
   - endpoint-group registration;
   - fallback and application startup.
3. Split `SqlPmtStore` using a simple partial-class approach grouped by feature.
4. Split the large model file into cohesive model groups, not one file per class.
5. Preserve:
   - endpoint URLs;
   - HTTP methods;
   - request/response payloads;
   - stored procedure names and parameters;
   - dependency injection behavior;
   - JSON naming.
6. Do not add interfaces, generic repositories, mediator patterns, mapping frameworks, or extra architectural layers unless existing code requires them.
7. Keep `/api/state` unchanged in this phase.
8. Update `docs/architecture.md`.

## Verification

- Run `dotnet restore`.
- Run `dotnet build`.
- Start the application.
- Run the complete manual smoke-test checklist.
- Compare all endpoint routes before and after.
- Confirm no SQL script or stored procedure behavior changed.
- Confirm uploads and static files still work.

## Completion criteria

Backend files are grouped by feature and easier for Codex to load selectively, while runtime behavior and public contracts remain unchanged.

## Suggested commit message

`refactor(backend): split endpoints data access and models by feature`

---

<!-- FILE: 18_TESTS_CLEANUP_FINALIZE.md -->

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

---

<!-- FILE: OPTIONAL_CODEX_SESSION_WRAPPER.md -->

# Optional Codex Session Wrapper

Use this text before attaching one numbered phase:

```text
Execute the attached PMT phase only.

Read the repository AGENTS.md files and the documents named by the phase.
Do not begin any later phase.
Do not perform unrelated cleanup.
Preserve current behavior unless the phase explicitly changes it.
Keep the repository buildable.
Run all required verification.
Stop after the requested final report.
```

## After Codex finishes

Review:

1. `git diff --stat`
2. `git diff`
3. the build/test output
4. the manual verification results
5. the suggested commit message

Commit the phase before starting another one.
