# PMT - Project Management Tool

PMT = JIRA + Confluence + Microsoft Project made for Software Engineering Teams.

Key Features:
- Kanban Board
- Dev Tasks
- QA Bug Reports
- Documentation (blogs)
- Gantt Chart
- Road Map

## Stack

- Frontend: pure JavaScript, HTML, and CSS
- Server: ASP.NET Core targeting .NET 6
- Database: SQL Server 2019
- Data access: ADO.NET with stored procedures
- Database schema: every database object is under `[pmt]`

## Default Login

Seed users are:

- Sin
- Bill Gates
- Sam Altman
- Mark Zuckerberg
- Steve Jobs
- Lisa Su

Every seeded user starts with this password:

```text
Password1
```

Users can change their own password from the avatar menu after login.

## SQL Setup Order

Run these scripts in order:

1. `SQL\01_CreateDatabase.sql`
2. `SQL\02_CreateStoredProcedures.sql`
3. `SQL\03_SeedData.sql`
4. `SQL\03_SeedData_ImageAnnotationTemplates.sql`
5. `SQL\03_SeedData_PMT.sql`
6. `SQL\03_SeedData_LMS.sql`
7. `SQL\03_SeedData_HLS.sql`
8. `SQL\03_SeedData_DiagramDemo.sql`

## Local Run

Update `appsettings.json` if your SQL Server is not `localhost`.

```powershell
dotnet restore
dotnet build
dotnet run
```

Open:

```text
http://localhost:5056
```

## Tests and Verification

PMT uses native ES modules in production and Node/Playwright only for tests.

```powershell
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run check:js
npm.cmd run test:js
npm.cmd run test:browser
dotnet restore
dotnet build
git diff --check
```

`npm.cmd run test:browser` starts PMT on `http://127.0.0.1:5056` unless `PMT_BASE_URL` is set. The browser smoke tests mock API responses with deterministic test data so they do not require a live SQL Server. Run `docs/manual-smoke-test.md` against disposable development data for full database-backed CRUD verification.

## Folder Structure

```text
Endpoints/            Minimal API endpoint groups
Data/                 SqlPmtStore partials using ADO.NET stored procedures
Models/               Plain DTO and input models
SQL/                  [pmt] schema, stored procedures, and seed scripts
wwwroot/js/core/      API, state, preferences, auth, router, shell
wwwroot/js/shared/    Pure reusable rules, dates, selectors, text/link helpers
wwwroot/js/components/Reusable UI markup helpers
wwwroot/js/features/  Screen-owned feature modules
wwwroot/css/          Tokens, themes, layout, components, and feature styles
tests/js/             Node unit tests for pure frontend business logic
tests/browser/        Playwright smoke tests for the real browser UI
docs/                 Durable architecture, domain, design, and smoke docs
```

## Deployment

See `Deployment\IIS-Setup.md`.
