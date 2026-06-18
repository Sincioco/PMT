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
