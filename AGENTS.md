# PMT Repository Instructions

PMT is an internal project-management tool for software teams, combining project and Sprint planning, Dev Tasks, Bug tracking, Scrum notes, Documentation, Kanban, Gantt, and Road Map views.

## Principles and stack

- Keep the implementation simple enough for a junior developer to trace.
- Use native JavaScript ES modules, HTML, and CSS. Do not add a frontend framework, TypeScript, or a bundler.
- Use ASP.NET Core on .NET 6 with minimal APIs, plain DTOs, and direct ADO.NET.
- Do not add Entity Framework or unnecessary repository, service, mediator, or mapping layers.
- All application database objects use `[pmt]`. Application data access must go through stored procedures under `[pmt]`.
- Treat PMT Database Version 1.15 as the deployed BDO baseline. As of July 15, 2026, the latest PMT release and current database schema are deployed to every known instance, so no new pre-1.15 upgrade compatibility is required. Every database-affecting or database-backed stability change must include a forward migration from the current deployed version. If one deployment requires more than one versioned migration, also provide a combined `PMT_<from>_to_<to>_All.sql` SQLCMD runner so the operator runs one file. Protecting BDO data and stability is the top priority; see `docs/database-versioning.md`.

## Intended structure

- Frontend code moves toward feature folders under `wwwroot/js/features/`, supported by `core`, `shared`, and `components`.
- Features may depend on those supporting folders but must not directly import another feature.
- Backend endpoints, models, and `SqlPmtStore` partials should be grouped by cohesive feature without changing public contracts.
- Put durable detail in `docs/`; keep `AGENTS.md` files concise.

## Required verification

- Start with `git status --short` and preserve unrelated changes.
- At minimum run `dotnet build` and `git diff --check`.
- For JavaScript changes, syntax-check changed modules and run the relevant browser smoke tests in Chrome or Chromium.
- For behavioral changes, start the application and execute `docs/manual-smoke-test.md`.
- Keep endpoint URLs, JSON payloads, `localStorage` keys, SQL procedure names/parameters, and ordered aggregate result sets stable unless a requirement explicitly changes them.

## Detailed references

- [Pre-refactor baseline](docs/baseline.md)
- [Architecture and impact map](docs/architecture.md)
- [Durable domain rules](docs/domain-rules.md)
- [Database versioning and migrations](docs/database-versioning.md)
- [UI design system](docs/ui-design-system.md)
- [Manual smoke test](docs/manual-smoke-test.md)
