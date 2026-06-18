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
