# PMT Architecture

This document maps the current application and the intended file boundaries for the phased refactor. Target paths describe ownership; they do not imply that the files already exist.

## Current architecture

PMT is a single ASP.NET Core .NET 6 web application:

1. `wwwroot/index.html` defines the HTML shell, applies the saved theme through `core/preferences.js` before rendering, and loads `wwwroot/styles.css` and `wwwroot/js/app.js`.
2. `wwwroot/js/app.js` composes the application shell with the central screen registry. Dashboard, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, and Settings now live in feature modules; the entry still owns the remaining legacy Road Map, Gantt, table reordering, and advanced timeline calculations.
3. `wwwroot/js/core/` owns application-wide browser infrastructure: HTTP requests, state, preferences, authentication, routing, startup, navigation, theme, and user-menu wiring.
4. `Program.cs` configures middleware, static/uploaded files, 37 minimal API routes, JSON behavior, and the SPA fallback.
5. `Models/PmtModels.cs` contains the API DTOs and request models.
6. `Data/SqlPmtStore.cs` calls `[pmt]` stored procedures through ADO.NET, maps `[pmt].[GetAppState]`, hydrates relationships, and calculates project/Sprint metrics.
7. `Sql/01_CreateDatabase.sql`, `Sql/02_CreateStoredProcedures.sql`, and the seed scripts define and populate SQL Server objects under `[pmt]`.

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
    `-- features/
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
- `shared/dates.js` owns reusable date formatting and date-key/range helpers used across Road Map, Gantt, Scrum, Settings, and Documentation.
- `shared/filter-values.js` owns saved filter value normalization.
- `shared/permissions.js` owns browser permission checks for owners, work items, and users.
- `shared/selectors.js` owns state selectors and display names for Projects, Sprints, Tasks, and Users.
- `shared/text-and-links.js` owns HTML/attribute escaping, rich-text link normalization, text linkification, URL normalization, and plain-text extraction.
- `shared/work-item-rules.js` owns status-based percent calculations, project/Sprint rollups, task completion checks, and linked-Bug completion validation.
- `components/attachments.js`, `avatars.js`, `buttons.js`, `charts.js`, `dialogs.js`, `filters.js`, `forms.js`, and `progress-and-status.js` own reusable markup builders while preserving existing CSS classes and HTML output.

Dashboard, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, and Settings now use feature folders under `wwwroot/js/features/`. `features/board/board.js` owns Board rendering, selected Project and Sprint mode, sorting, visible and empty-column state, status updates, reorder persistence, and the existing Board preference keys. `features/board/board-drag.js` owns Board-only pointer and mouse drag state; its delegated Board listeners are active only while the Board screen is active, and its window listeners exist only during a drag gesture. The remaining Road Map and Gantt feature folders are placeholder ownership boundaries for later phases. Endpoint URLs, payloads, screen markup, CSS classes, and preference key names are unchanged.

The current frontend dependency flow is:

`index.html -> preferences (pre-paint theme)`

`app -> application shell -> authentication/router/store/preferences`

`authentication -> api/preferences/store`

`store -> api`

`router -> preferences/screen registry`

`board -> board drag/components/shared/api/store/preferences`

`legacy Road Map/Gantt app screen code -> components/shared/api/store/authentication/router/preferences`

## Target backend layout

Phase 17 should split files without adding architectural layers:

```text
Program.cs
Endpoints/
|-- AuthenticationEndpoints.cs
|-- StateEndpoints.cs
|-- ProjectEndpoints.cs
|-- SprintEndpoints.cs
|-- WorkItemEndpoints.cs
|-- SettingsEndpoints.cs
|-- ContentEndpoints.cs
|-- UploadEndpoints.cs
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

`Program.cs` remains responsible for service registration, middleware, static/uploaded file setup, endpoint-group registration, fallback, and startup. Endpoint files map HTTP contracts; `SqlPmtStore` partials remain direct ADO.NET procedure callers; model files remain plain DTO/input groups.

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

All data-backed screens read through `GET /api/state` -> `GetStateAsync` -> `[pmt].[GetAppState]`. The table lists target frontend ownership and additional write contracts.

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
