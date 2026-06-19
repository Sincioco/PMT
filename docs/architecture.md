# PMT Architecture

This document maps the current application and active file ownership for the phased refactor.

## Current architecture

PMT is a single ASP.NET Core .NET 6 web application:

1. `wwwroot/index.html` defines the HTML shell, applies the saved theme through `core/preferences.js` before rendering, loads the ordered CSS foundations, components, and feature stylesheets, and then loads `wwwroot/js/app.js`.
2. `wwwroot/js/app.js` composes the application shell with the central screen registry. Dashboard, Road Map, Gantt, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, and Settings now live in feature modules; the entry still owns shared editor/dialog orchestration, chart drilldowns, and table reordering.
3. `wwwroot/js/core/` owns application-wide browser infrastructure: HTTP requests, state, preferences, authentication, routing, startup, navigation, theme, and user-menu wiring.
4. `Program.cs` configures services, JSON behavior, exception handling, static/uploaded files, endpoint-group registration, the SPA fallback, and application startup.
5. `Endpoints/` maps the 37 minimal API routes by feature while preserving endpoint URLs, HTTP methods, payload shapes, and the simple current-user header/query behavior.
6. `Models/*.cs` contains cohesive plain DTO and request model groups for state, users, projects/Sprints, work items, content/uploads, and settings.
7. `Data/SqlPmtStore*.cs` is one partial `SqlPmtStore` that calls `[pmt]` stored procedures through direct ADO.NET. `SqlPmtStore.State.cs` maps `[pmt].[GetAppState]`, hydrates relationships, and calculates project/Sprint metrics.
8. `Sql/01_CreateDatabase.sql`, `Sql/02_CreateStoredProcedures.sql`, and the seed scripts define and populate SQL Server objects under `[pmt]`.
9. `tests/js/` contains Node-based ES-module unit tests for pure frontend rules and calculations.
10. `tests/browser/` contains Playwright smoke tests that serve the real ASP.NET app and mock API responses with deterministic browser-test data.

The main read flow is:

`feature -> core API -> GET /api/state -> SqlPmtStore.GetStateAsync -> [pmt].[GetAppState] -> ordered result sets -> hydrated AppState -> feature render`

`[pmt].[GetAppState]` and `GetStateAsync` are coupled by result-set order: users, projects, project members, Sprints, Sprint members, work items, assignees, reporters, dependencies, attachments, task attachments, Scrum logs, Documentation, Documentation attachments, Documentation history, audit events, lookups, and holidays.

## Target frontend layout

```text
wwwroot/
|-- index.html
|-- js/
|   |-- app.js
|   |-- core/
|   |   |-- api.js
|   |   |-- application-shell.js
|   |   |-- authentication.js
|   |   |-- preferences.js
|   |   |-- router.js
|   |   `-- store.js
|   |-- shared/
|   |   |-- constants.js
|   |   |-- dates.js
|   |   |-- permissions.js
|   |   |-- selectors.js
|   |   |-- text-and-links.js
|   |   `-- work-item-rules.js
|   |-- components/
|   |   |-- attachments.js
|   |   |-- avatars.js
|   |   |-- charts.js
|   |   |-- dialogs.js
|   |   |-- filters.js
|   |   |-- forms.js
|   |   `-- progress-and-status.js
|   `-- features/
|       |-- dashboard/
|       |-- roadmap/
|       |-- gantt/
|       |-- board/
|       |-- projects/
|       |-- sprints/
|       |-- tasks/
|       |-- bugs/
|       |-- scrum/
|       |-- documentation/
|       |-- backlog/
|       `-- settings/
`-- css/
    |-- tokens.css
    |-- themes.css
    |-- base.css
    |-- layout.css
    |-- components/
    |   |-- attachments.css
    |   |-- avatars.css
    |   |-- buttons.css
    |   |-- cards-panels.css
    |   |-- charts.css
    |   |-- dialogs.css
    |   |-- filters.css
    |   |-- forms.css
    |   |-- navigation.css
    |   |-- progress-status.css
    |   `-- tables-lists.css
    `-- features/
        |-- backlog.css
        |-- board.css
        |-- bugs.css
        |-- dashboard.css
        |-- documentation.css
        |-- gantt.css
        |-- login.css
        |-- projects.css
        |-- roadmap.css
        |-- scrum.css
        |-- settings.css
        |-- sprints.css
        `-- tasks.css
tests/
|-- js/
`-- browser/
```

The entry module composes startup and the screen registry. `core` owns application-wide infrastructure, `shared` owns reusable pure logic, `components` owns reusable UI builders, and each feature owns its rendering, actions, filters, preferences, and feature-only calculations.

## Core services established in Phase 04

The frontend entry module now depends on focused native ES modules:

- `core/api.js` is the only generic `fetch` wrapper. It applies the current-user header, preserves JSON and `FormData` behavior, and normalizes API errors.
- `core/store.js` owns the live central state binding plus state loading, replacement, and reset.
- `core/preferences.js` is the only direct `localStorage` owner. It preserves every existing `pmt-*` key and provides safe string, number, boolean, and JSON defaults.
- `core/authentication.js` owns login, logout, the authenticated user ID, fallback identity selection after state loads, and current-user lookup.
- `core/router.js` owns the current view, legacy view-name normalization, persistence, and the navigation screen selection.
- `core/application-shell.js` owns startup orchestration, login rendering and wiring, state-load error handling, top navigation and overflow, the avatar menu, theme switching, and current-user shell rendering.
- `core/screen-registry.js` remains the authoritative list of Dashboard, Road Map, Gantt, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, and Settings.
- `app.js` supplies shared screen event handlers and the current screen renderer to the application shell; feature-specific rendering and actions move behind registered screen handlers.

## Shared utilities and components established in Phase 05

Reusable frontend logic now has stable native ES module homes:

- `shared/constants.js` owns fallback lookup values and the linked-Bug completion message.
- `shared/dates.js` owns reusable date formatting, date-key/range helpers, and shared timeline calendar helpers used across Road Map, Gantt, Scrum, Settings, and Documentation.
- `shared/filter-values.js` owns saved filter value normalization.
- `shared/permissions.js` owns browser permission checks for owners, work items, and users.
- `shared/selectors.js` owns state selectors and display names for Projects, Sprints, Tasks, and Users.
- `shared/text-and-links.js` owns HTML/attribute escaping, rich-text link normalization, text linkification, URL normalization, and plain-text extraction.
- `shared/work-item-rules.js` owns status-based percent calculations, project/Sprint rollups, task completion checks, and linked-Bug completion validation.
- `components/attachments.js`, `avatars.js`, `buttons.js`, `charts.js`, `dialogs.js`, `filters.js`, `forms.js`, and `progress-and-status.js` own reusable markup builders while preserving existing CSS classes and HTML output.

Dashboard, Road Map, Gantt, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, and Settings now use feature folders under `wwwroot/js/features/`. `features/roadmap/roadmap.js` owns Road Map filters, sorting, display toggles, and existing preference keys, with companion modules for rendering and timeline calculations. `features/gantt/gantt.js` owns Gantt filters, view preferences, bug expansion state, fly-by orchestration, and existing preference keys, with companion modules for rendering, date/layout calculations, fly-by scrolling and timers, and dependency/bug helpers. `features/board/board.js` owns Board rendering, selected Project and Sprint mode, sorting, visible and empty-column state, status updates, reorder persistence, and the existing Board preference keys. `features/board/board-drag.js` owns Board-only pointer and mouse drag state; its delegated Board listeners are active only while the Board screen is active, and its window listeners exist only during a drag gesture. Endpoint URLs, payloads, screen markup, CSS classes, and preference key names are unchanged.

The current frontend dependency flow is:

`index.html -> preferences (pre-paint theme)`

`app -> application shell -> authentication/router/store/preferences`

`authentication -> api/preferences/store`

`store -> api`

`router -> preferences/screen registry`

`board -> board drag/components/shared/api/store/preferences`

`roadmap -> roadmap calculations/rendering/components/shared/core/store/preferences`

`gantt -> gantt calculations/rendering/flyby/bugs-dependencies/components/shared/core/store/preferences`

Phase 16 completes the screen-level visual adoption for Dev Tasks, Bug Tracking, Backlog, Kanban Board, Gantt, Road Map, and Settings. These screens now use shared semantic tokens and shared work-item table/filter treatments while retaining their existing feature ownership, DOM event hooks, calculated timeline geometry, drag/drop lifecycle, endpoint contracts, and `pmt-*` preference keys. Timeline and Board styling remains feature-owned; reusable dense table and filter treatments remain component-owned.

Phase 18 adds regression coverage without changing runtime architecture. `package.json` exists only for test scripts and dev dependencies; production frontend code remains native ES modules loaded directly by the browser. The browser smoke suite starts PMT through `dotnet run` unless `PMT_BASE_URL` points to an already running instance.

## Backend layout

Phase 17 splits backend files without adding architectural layers:

```text
Program.cs
Endpoints/
|-- AuthenticationEndpoints.cs
|-- EndpointHelpers.cs
|-- StateEndpoints.cs
|-- ProjectEndpoints.cs
|-- SprintEndpoints.cs
|-- WorkItemEndpoints.cs
|-- SettingsEndpoints.cs
|-- ContentEndpoints.cs
|-- UploadEndpoints.cs
|-- UploadStorageOptions.cs
`-- DevelopmentEndpoints.cs
Data/
|-- SqlPmtStore.cs
|-- SqlPmtStore.State.cs
|-- SqlPmtStore.Authentication.cs
|-- SqlPmtStore.Projects.cs
|-- SqlPmtStore.Sprints.cs
|-- SqlPmtStore.WorkItems.cs
|-- SqlPmtStore.Settings.cs
|-- SqlPmtStore.Content.cs
`-- SqlPmtStore.Development.cs
Models/
|-- StateModels.cs
|-- UserModels.cs
|-- ProjectSprintModels.cs
|-- WorkItemModels.cs
|-- ContentModels.cs
`-- SettingsModels.cs
```

`Program.cs` remains responsible for service registration, middleware, static/uploaded file setup, endpoint-group registration, fallback, and startup. Endpoint files map HTTP contracts; `SqlPmtStore` partials remain direct ADO.NET procedure callers; model files remain plain DTO/input groups. `/api/state` stays in its own endpoint and state store partial because its ordered aggregate result sets are a key public contract for the frontend.

## Dependency direction

- `features -> components/shared/core`
- `components -> shared` and narrowly scoped core services when required
- `shared -> no feature or DOM ownership`
- `core -> browser/platform APIs`, never feature implementations
- Feature modules do not import other feature modules; cross-feature navigation goes through the router and shared state.
- Endpoint mappings depend on models and `SqlPmtStore`; data access depends on models and `Microsoft.Data.SqlClient`.
- C# calls stored procedures; browser code never talks to SQL.
- SQL is authoritative for validation, permissions, and workflow transitions. Browser checks provide immediate feedback but do not replace SQL enforcement.

## Feature impact map

All data-backed screens read through `GET /api/state` -> `GetStateAsync` -> `[pmt].[GetAppState]`. The table lists frontend ownership and additional write contracts.

| Feature | Frontend ownership | Endpoints | `SqlPmtStore` methods | Stored procedures or SQL contract |
| --- | --- | --- | --- | --- |
| Authentication and shell | `core/authentication.js`, `core/application-shell.js`, `core/router.js`, `core/preferences.js` | `POST /api/login`; `POST /api/change-password`; `GET /api/state` | `LoginAsync`; `ChangePasswordAsync`; `GetStateAsync` | `[pmt].[LoginUser]`; `[pmt].[ChangePassword]`; `[pmt].[GetAppState]` |
| Dashboard | `features/dashboard/` | `GET /api/state` | `GetStateAsync` | `[pmt].[GetAppState]` |
| Road Map | `features/roadmap/` | `GET /api/state` | `GetStateAsync` | `[pmt].[GetAppState]` |
| Gantt | `features/gantt/` | `GET /api/state` | `GetStateAsync` | `[pmt].[GetAppState]` |
| Kanban Board | `features/board/` | `PUT /api/tasks/{id}`; `POST /api/tasks/reorder` | `SaveTaskAsync`; `ReorderTasksAsync` | `[pmt].[UpsertTask]`; `[pmt].[ReorderTasks]` |
| Projects | `features/projects/` | `POST /api/projects`; `PUT /api/projects/{id}`; `DELETE /api/projects/{id}` | `SaveProjectAsync`; `DeleteProjectAsync` | `[pmt].[UpsertProject]`; `[pmt].[DeleteProject]` |
| Sprints | `features/sprints/` | `POST /api/sprints`; `PUT /api/sprints/{id}`; `POST /api/sprints/{id}/finish`; `DELETE /api/sprints/{id}` | `SaveSprintAsync`; `FinishSprintAsync`; `DeleteSprintAsync` | `[pmt].[UpsertSprint]`; `[pmt].[FinishSprint]`; `[pmt].[DeleteSprint]` |
| Dev Tasks | `features/tasks/` | `POST /api/tasks`; `PUT /api/tasks/{id}`; `POST /api/tasks/reorder`; `POST /api/tasks/{id}/duplicate`; `DELETE /api/tasks/{id}`; `POST /api/tasks/{id}/attachments` | `SaveTaskAsync`; `ReorderTasksAsync`; `DuplicateTaskAsync`; `DeleteTaskAsync`; `AddTaskAttachmentAsync` | `[pmt].[UpsertTask]`; `[pmt].[ReorderTasks]`; `[pmt].[DuplicateTask]`; `[pmt].[DeleteTask]`; `[pmt].[AddTaskAttachment]` |
| Bugs | `features/bugs/` | `POST /api/tasks`; `PUT /api/tasks/{id}`; `POST /api/tasks/{id}/duplicate`; `DELETE /api/tasks/{id}`; `POST /api/tasks/{id}/attachments` | `SaveTaskAsync`; `DuplicateTaskAsync`; `DeleteTaskAsync`; `AddTaskAttachmentAsync` | `[pmt].[UpsertTask]`; `[pmt].[DuplicateTask]`; `[pmt].[DeleteTask]`; `[pmt].[AddTaskAttachment]`; `UpsertTask` owns Bug/Bug Fix workflow |
| Backlog | `features/backlog/` | `POST /api/tasks`; `PUT /api/tasks/{id}`; `POST /api/tasks/reorder` | `SaveTaskAsync`; `ReorderTasksAsync` | `[pmt].[UpsertTask]`; `[pmt].[ReorderTasks]` |
| Scrum | `features/scrum/` | `POST /api/devlogs`; `PUT /api/devlogs/{id}`; `DELETE /api/devlogs/{id}` | `SaveDevLogAsync`; `DeleteDevLogAsync` | `[pmt].[UpsertDevLog]`; `[pmt].[DeleteDevLog]` |
| Documentation | `features/documentation/` | `POST /api/blogs`; `PUT /api/blogs/{id}`; `DELETE /api/blogs/{id}`; `POST /api/blogs/{id}/attachments` | `SaveBlogAsync`; `DeleteBlogAsync`; `AddBlogAttachmentAsync` | `[pmt].[UpsertBlog]`; `[pmt].[DeleteBlog]`; `[pmt].[AddBlogAttachment]` |
| Settings - users | `features/settings/` | `POST /api/users`; `PUT /api/users/{id}`; `DELETE /api/users/{id}` | `SaveUserAsync`; `DeleteUserAsync` | `[pmt].[UpsertUser]`; `[pmt].[DeleteUser]` |
| Settings - lookups | `features/settings/` | `POST /api/lookups`; `PUT /api/lookups/{id}`; `DELETE /api/lookups/{id}` | `SaveLookupAsync`; `DeleteLookupAsync` | `[pmt].[UpsertLookup]`; `[pmt].[DeleteLookup]` |
| Settings - holidays | `features/settings/` | `POST /api/holidays`; `PUT /api/holidays/{id}`; `DELETE /api/holidays/{id}` | `SaveHolidayAsync`; `DeleteHolidayAsync` | `[pmt].[UpsertHoliday]`; `[pmt].[DeleteHoliday]` |
| Settings - development | `features/settings/` | `POST /api/development/clear-non-pmt`; `POST /api/development/clear-pmt`; `POST /api/development/clear-users`; `POST /api/development/restore-seed-data` | `DevelopmentClearNonPmtAsync`; `DevelopmentClearPmtAsync`; `DevelopmentClearUsersAsync`; `RestoreInitialSeedDataAsync` | `[pmt].[DevelopmentClearNonPmt]`; `[pmt].[DevelopmentClearPmt]`; `[pmt].[DevelopmentClearUsers]`; seed scripts for restore |

`POST /api/uploads/{kind}` stores a generic uploaded file without a database call. Task and Documentation attachment routes both store the file and then link its metadata through the relevant `[pmt]` attachment procedure.

## Standard commands

```powershell
dotnet restore
dotnet build
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run check:js
npm.cmd run test:js
npm.cmd run test:browser
git diff --check
```

`npm.cmd run test:browser` covers login, all primary screens, Settings through the avatar menu, light/dark theme switching, dialogs, representative filters, Board drag/status persistence, Gantt rendering, Road Map rendering, console-error detection, and 1366x768 plus 1920x1080 viewport checks. Manual database-backed CRUD and destructive Development actions remain covered by `docs/manual-smoke-test.md`.
