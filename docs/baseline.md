# PMT Pre-Refactor Baseline

> Warning: This document describes the PMT application before the phased
> refactor begins. Treat it as a behavioral and structural baseline, not as a
> target architecture.

Baseline recorded: June 18, 2026.

## Repository State

- Current branch: `main`
- Remote default branch: `main`
- Working tree at the start of Phase 01: clean
- Target runtime: ASP.NET Core on .NET 6
- Frontend: one native JavaScript application with one stylesheet
- Data access: ADO.NET through `Microsoft.Data.SqlClient`
- Database: SQL Server, with application objects under the `pmt` schema
- No frontend framework, TypeScript, bundler, or Entity Framework

## Approximate File Inventory

| File | Lines | Approximate responsibility |
| --- | ---: | --- |
| `wwwroot/app.js` | 5,856 | Application state, login, navigation, all screen rendering, charts, dialogs, filters, drag/drop, Gantt/Road Map calculations, API calls, and shared browser helpers. |
| `wwwroot/styles.css` | 2,411 | Dark/light theme tokens, shell, navigation, cards, tables, dialogs, forms, charts, Kanban, Gantt, Road Map, and responsive rules. |
| `Program.cs` | 370 | ASP.NET Core startup, static files, upload storage, exception handling, 37 minimal API routes, and current-user header handling. |
| `Data/SqlPmtStore.cs` | 964 | Direct ADO.NET stored-procedure calls, `/api/state` result-set mapping, DTO hydration, calculated project/Sprint metrics, and seed restore execution. |
| `Models/PmtModels.cs` | 342 | Plain API DTOs and request input classes for users, projects, Sprints, work items, lookups, holidays, Scrum, Documentation, uploads, login, and password changes. |

The `SQL` folder contains about 4,792 lines and 188 KB across these scripts:

| File | Lines | Responsibility |
| --- | ---: | --- |
| `SQL/00_DropAndRebuild_PMT.sql` | 54 | SQLCMD rebuild orchestrator. Drops PMT and includes the schema, procedures, and three seed scripts. |
| `SQL/01_CreateDatabase.sql` | 589 | Creates the database, `pmt` schema, 18 tables, relationships, indexes, and initial administrator record. |
| `SQL/02_CreateStoredProcedures.sql` | 2,871 | Contains 34 functions/procedures for authorization, reads, writes, workflow rules, audit events, attachments, Sprint completion, and development resets. |
| `SQL/03_SeedData.sql` | 450 | Core users, lookups, holidays, and PMT demonstration data. |
| `SQL/03_SeedData_LMS.sql` | 416 | LMS project, Sprints, work items, bugs, audits, Scrum, and Documentation seed data. |
| `SQL/03_SeedData_HLS.sql` | 412 | Multi-year HLS project, phases/Sprints, work items, bugs, audits, Scrum, and Documentation seed data. |

## Screen Inventory

### Authentication and shell

| User-visible screen or surface | How it opens |
| --- | --- |
| Login | Automatically shown when `pmt-auth-user` is absent. |
| User menu | Click the current user's avatar in the upper-right corner. |
| Settings | Select `Settings` from the user avatar menu. |
| Theme toggle | Select `Light Theme` or `Dark Theme` from the user avatar menu. |
| Change Password | Select `Change Password` from the user avatar menu. |
| Log Out | Select `Log Out` from the user avatar menu. |

### Main navigation

The responsive top navigation uses this order. Items that do not fit move into
the `More navigation` menu.

| Navigation label | Internal view | Main responsibility |
| --- | --- | --- |
| Dashboard | `Dashboard` | Project summaries and Project Flow with expandable Sprint/task details. |
| Road Map | `Road Map` | Cross-project and Sprint schedule, progress, avatars, filters, and sorting. |
| Gantt | `Gantt` | Project/Sprint work timeline, holidays/weekends, Bug expansion, Sprint jump, and fly-by. |
| Kanban Board | `Board` | Status columns, task creation, drag/drop status changes, and manual ordering. |
| Projects | `Projects` | Project cards, progress metrics, members, and Project CRUD. |
| Sprints | `Sprints` | Project-filtered Sprint cards, status metrics, progress, finish flow, and Sprint CRUD. |
| Dev Tasks | `Tasks` | Filterable task table, task charts, hierarchy, assignment, dependencies, audit, and task CRUD. |
| Bug Tracking | `Bugs` | Filterable Bug table, Bug charts and drilldown, assignment/reporting, audit, and Bug CRUD. |
| Scrum | `Scrum` | Scrum/Dev Log entries, Project/Person/Date filters, duplicate action, and CRUD. |
| Documentation | `Documentation` | Project-filtered Documentation cards, read-only view, rich text, attachments, and CRUD. |
| Backlog | `Backlog` | Unscheduled/Todo Dev Tasks and Bugs with drag/drop ordering and creation actions. |

### Settings categories

`Settings` uses a left category list:

- `Status`
- `Priority`
- `Severity`
- `Environment`
- Any additional lookup type returned by `/api/state`
- `Users`
- `Holidays`
- `Development`

The Development category contains destructive test-data tools for clearing
non-PMT projects, clearing PMT, clearing users, restoring all seed data, and
clearing PMT browser preferences.

### Shared dialogs and overlays

- Create/edit dialog for Projects, Sprints, Dev Tasks, Bugs, users, lookups,
  holidays, Scrum entries, Documentation, and password changes.
- Read-only work item and Documentation dialogs with an Edit action.
- Task/Bug audit history dialog.
- Chart expansion and chart drilldown dialogs.
- Finish Sprint dialog.
- Themed confirmation and text-entry dialogs.
- Toast notifications and chart tooltips.

## Frontend Entry Points

1. `wwwroot/index.html`
   - Applies `pmt-theme` in an inline script before CSS loads to avoid theme
     flicker.
   - Loads `/styles.css`.
   - Defines the top bar, navigation host, avatar menu, application host,
     shared editor dialog, and toast container.
   - Loads `/app.js`.
2. `wwwroot/app.js`
   - Calls `applySavedTheme()` immediately.
   - Calls `initializeApp()` directly or from `DOMContentLoaded`.
   - `initializeApp()` binds shared page events and chooses Login or `startApp()`.
   - `startApp()` renders navigation, calls `loadState()`, and calls `render()`.
   - `render()` dispatches to the active screen renderer and normalizes links.

## Global Browser Event Wiring

The long-lived listeners are concentrated near the top of `app.js`:

- Shared editor: close and cancel.
- Avatar menu: logout, Settings navigation, theme toggle, and password action.
- Navigation: delegated view changes and responsive overflow menu.
- Application host: delegated clicks, filter changes, chart tooltips, pointer
  drag start, and mouse drag start.
- Window: pointer/mouse movement and release, pointer cancellation, and resize.
- Document: external-link normalization behavior and closing open menus.
- Login: button click and Enter on the password input.

Additional listeners are attached when dialogs or editors are created for
modal close/cancel, rich-text commands, pasted images, attachment previews,
percent rules, member/assignee list refresh, and themed confirmation prompts.

## Persistent Browser State

The application currently uses these `localStorage` keys:

### Authentication and shell

- `pmt-auth-user`
- `pmt-view`
- `pmt-theme`

### Kanban Board

- `pmt-board-project`
- `pmt-board-sprint`
- `pmt-board-sort`
- `pmt-board-statuses`
- `pmt-board-hide-empty-columns`

### Road Map

- `pmt-roadmap-project`
- `pmt-roadmap-sprint`
- `pmt-roadmap-sort`
- `pmt-roadmap-show-dates`
- `pmt-roadmap-show-details`
- `pmt-roadmap-show-sprints`

### Gantt

- `pmt-gantt-project`
- `pmt-gantt-sprint`
- `pmt-gantt-render-mode`
- `pmt-gantt-sort`
- `pmt-gantt-show-non-working-days`

### Sprints and Dev Tasks

- `pmt-sprint-project`
- `pmt-task-project`
- `pmt-task-sprint`
- `pmt-task-filters`
- `pmt-task-filters-visible`
- `pmt-task-visual-charts-visible`

### Bug Tracking, Scrum, and Documentation

- `pmt-bug-filters`
- `pmt-bug-filters-visible`
- `pmt-bug-visual-charts-visible`
- `pmt-scrum-filters`
- `pmt-documentation-project`

### Settings

- `pmt-settings-category`
- `pmt-lookup-type`

The Development setting `Clear User Preferences Stored in Local Storage`
removes PMT-prefixed preferences and reloads the first-launch defaults.

## Backend Entry Points

### Application host

`Program.cs` is the single server entry point. It:

- registers `SqlPmtStore`;
- enables camel-case JSON;
- converts unhandled exceptions to `{ error }` JSON with HTTP 400;
- serves `wwwroot` and configured upload storage;
- maps the minimal API routes;
- falls back to `index.html`.

The browser sends the current user through `X-PMT-UserId`. `CurrentUserId()`
also accepts a query value and otherwise falls back to user ID 1. This is
intentionally simple internal-tool authentication, not cookie/token security.

### API route inventory

- Authentication/state: `POST /api/login`, `POST /api/change-password`,
  `GET /api/state`
- Projects: `POST /api/projects`, `PUT /api/projects/{id:int}`,
  `DELETE /api/projects/{id:int}`
- Sprints: `POST /api/sprints`, `PUT /api/sprints/{id:int}`,
  `POST /api/sprints/{id:int}/finish`, `DELETE /api/sprints/{id:int}`
- Work items: `POST /api/tasks`, `PUT /api/tasks/{id:int}`,
  `POST /api/tasks/reorder`, `POST /api/tasks/{id:int}/duplicate`,
  `DELETE /api/tasks/{id:int}`
- Users: `POST /api/users`, `PUT /api/users/{id:int}`,
  `DELETE /api/users/{id:int}`
- Lookups: `POST /api/lookups`, `PUT /api/lookups/{id:int}`,
  `DELETE /api/lookups/{id:int}`
- Holidays: `POST /api/holidays`, `PUT /api/holidays/{id:int}`,
  `DELETE /api/holidays/{id:int}`
- Scrum: `POST /api/devlogs`, `PUT /api/devlogs/{id:int}`,
  `DELETE /api/devlogs/{id:int}`
- Documentation: `POST /api/blogs`, `PUT /api/blogs/{id:int}`,
  `DELETE /api/blogs/{id:int}`
- Uploads: `POST /api/uploads/{kind}`,
  `POST /api/tasks/{id:int}/attachments`,
  `POST /api/blogs/{id:int}/attachments`
- Development: `POST /api/development/clear-non-pmt`,
  `POST /api/development/clear-pmt`,
  `POST /api/development/clear-users`,
  `POST /api/development/restore-seed-data`

### Data access entry point

`Data/SqlPmtStore.cs` is the only application data-access class:

- opens SQL Server connections directly;
- calls `pmt` stored procedures with `SqlCommand`;
- converts ID lists to CSV parameters;
- maps the ordered result sets from `[pmt].[GetAppState]`;
- hydrates members, assignees, reporters, dependencies, attachments,
  sub-tasks, and Documentation history;
- calculates project/Sprint counts and QA-Passed-or-later completion metrics;
- replays the three seed scripts for the Development restore action.

## `/api/state` Data Flow

1. The browser calls `loadState()`.
2. `api("/api/state")` sends `X-PMT-UserId`.
3. `Program.cs` calls `SqlPmtStore.GetStateAsync()`.
4. The store executes `[pmt].[GetAppState]`.
5. The procedure returns ordered result sets for users, projects, project
   members, Sprints, Sprint members, work items, assignees, reporters,
   dependencies, attachments, Scrum, Documentation, Documentation history,
   audit events, lookups, and holidays.
6. `SqlPmtStore` maps the result sets into `AppState` DTO lists.
7. `HydrateState()` connects related lists and calculates display metrics.
8. ASP.NET Core serializes the state as camel-case JSON.
9. The browser replaces the global `state`, refreshes lookup options and the
   user avatar, then calls the active screen renderer.
10. After create/edit/delete actions, the browser normally calls
    `loadState()` again and re-renders from the database.

## Current Theme Mechanism

- Dark tokens are defined in `:root` in `wwwroot/styles.css`.
- Light tokens override them under `html[data-theme="light"]`.
- `index.html` reads `pmt-theme` before CSS loads and sets
  `document.documentElement.dataset.theme`.
- `app.js` validates the saved value, toggles the dataset immediately, updates
  the avatar-menu icon/label, and persists the preference.
- Components use CSS variables such as `--bg`, `--surface`, `--line`, `--text`,
  `--muted`, and status/accent colors.

## Major Shared Business Rules

These rules are important regression targets. The database is authoritative,
with matching browser-side behavior where useful for immediate feedback.

- Status order is Backlog, Todo, In Progress, Code Complete, Ready for QA,
  QA in Progress, QA Failed, QA Passed, Deployed in SIT, Deployed in UAT,
  Deployed in Prod.
- Saving `Backlog` becomes an unscheduled `Todo` and removes the Sprint.
- Assigning a Dev Task to a Sprint sets it to `Todo`.
- Moving to `Todo` preserves a nonzero existing percent; otherwise it is 0.
- `QA Passed` and deployed statuses force 100%.
- Dev Task `Code Complete` and `Ready for QA` force 100% when no Bug is
  associated, or 50% when a Bug is associated.
- A Dev Task linked to a Bug cannot reach 100% until that Bug is QA Passed or
  later.
- A Bug set to QA Passed or QA Failed is set to 100%.
- Bug QA Passed sets the linked Bug Fix task to 100%; Bug QA Failed sets it to
  50%.
- A linked Bug Fix reaching Code Complete resets the Bug to 0% for retesting.
- Assigning a Bug creates or updates its linked `Bug Fix` Dev Task and
  dependency.
- Parent task percent is calculated from active sub-task percentages.
- Assignees must be active members of the selected Sprint; unscheduled work
  uses the Project member list. Reporters may be any active user.
- Finished Sprints are read-only for non-admin users.
- Finishing a Sprint creates the next Sprint, copies members, and can carry
  unfinished Dev Tasks and Bugs according to the dialog options.
- Project/Sprint progress counts top-level work items at QA Passed or later.
- Task reorder stores the exact browser order as `SortOrder`.
- Status, percent, Sprint, assignment, attachment, and other changes write
  audit records.
- Editing/deleting is owner-or-admin based, with task-type role checks for Dev
  Tasks and Bugs.
- Gantt hides weekends and active configured holidays unless an item starts on
  that date; the user can explicitly show non-working days.
- External/user-entered links are normalized to open in a new tab.

## Known Architectural Concentration Points

- `wwwroot/app.js` owns nearly every frontend concern and has broad mutable
  global state.
- `wwwroot/styles.css` contains all foundation, component, screen, chart, and
  responsive styles.
- `Program.cs` contains all routes and upload handling in one file.
- `SqlPmtStore.cs` combines commands, result-set ordering, mapping, hydration,
  metrics, and seed restore.
- `[pmt].[UpsertTask]` is a large workflow hub for validation, assignment,
  linked Bug Fix behavior, percent rules, hierarchy, and audit events.
- `[pmt].[GetAppState]` returns many result sets whose order is coupled to
  `SqlPmtStore.GetStateAsync()`.
- UI labels and internal view names differ for Board/Kanban Board,
  Tasks/Dev Tasks, and Bugs/Bug Tracking.
- The application reloads the full `/api/state` payload after most writes.
- Authentication is browser-stored user ID plus a request header, appropriate
  only for the current internal development assumptions.
- There is no automated test project at this baseline.

## Current Verification Commands

Run from the repository root:

```powershell
git status --short
dotnet restore
dotnet build
node --check .\wwwroot\app.js
git diff --check
dotnet run --urls "http://localhost:5056"
```

Open `http://localhost:5056` in Chrome/Chromium and execute
`docs/manual-smoke-test.md`.

For a disposable full database rebuild:

```powershell
sqlcmd -S localhost -E -b -i ".\SQL\00_DropAndRebuild_PMT.sql"
```

The application must preserve the behavior recorded here throughout later
phases unless a later requirement explicitly changes it.
