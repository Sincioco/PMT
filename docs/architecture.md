# PMT Architecture

This document maps the current application and active file ownership for the phased refactor.

## Current architecture

PMT is a single ASP.NET Core .NET 6 web application:

1. `wwwroot/index.html` defines the HTML shell, receives the effective deployment base path from `Program.cs`, applies the saved theme through `core/preferences.js` before rendering, loads the ordered CSS foundations, components, and feature stylesheets, and then loads `wwwroot/js/app.js`.
2. `wwwroot/js/app.js` composes the application shell with the central screen registry. Dashboard, Road Map, Gantt, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, WFH Schedule, Release Notes, and Settings live in feature modules; invitation generation and onboarding live in `features/invitations/`; the entry still owns shared editor/dialog orchestration, chart drilldowns, and table reordering.
3. `wwwroot/js/core/` owns application-wide browser infrastructure: HTTP requests, state, preferences, authentication, routing, startup, navigation, theme, and user-menu wiring.
4. `Program.cs` configures services, JSON behavior, deployment path-base handling, exception handling, static/uploaded files, endpoint-group registration, the SPA fallback, and application startup.
5. `Endpoints/` maps minimal API routes by feature while preserving endpoint URLs, HTTP methods, and payload shapes. ASP.NET Core's signed, protected `PMT.Auth` HttpOnly cookie is the sole current-user source; API routes do not accept a browser-supplied user ID header or query value as identity.
6. `Models/*.cs` contains cohesive plain DTO and request model groups for state, users, invitations, projects/Sprints, work items, content/uploads, WFH schedule, Scrum attendance/vacation, and settings.
7. `Data/SqlPmtStore*.cs` is one partial `SqlPmtStore` that calls `[pmt]` stored procedures through direct ADO.NET. Every opened SQL connection writes the authenticated actor ID to `SESSION_CONTEXT(N'PMT_ActorUserId')`, while procedure parameters continue to carry the effective user ID, so audit records preserve both identities during impersonation. Versioned updates and reorders lock and compare their opaque edit tokens inside the same ADO.NET transaction as the feature procedure; multi-row reorders take locks in stable ID order. Structural Documentation, WorkTask, and Sprint writers use focused transaction-owned application locks in the fixed Blog -> WorkTask -> Sprint order before taking row locks. This serializes hierarchy changes, task conversion/duplication, Sprint code allocation, and carry-forward without one global application lock. `SqlPmtStore.State.cs` maps `[pmt].[GetAppState]`, hydrates relationships, and calculates project/Sprint metrics.
8. `SQL/01_CreateDatabase.sql`, `SQL/02_CreateStoredProcedures.sql`, and the seed scripts define and populate SQL Server objects under `[pmt]`.
9. `tests/js/` contains Node-based ES-module unit tests for pure frontend rules and calculations.
10. `tests/browser/` contains Playwright smoke tests that serve the real ASP.NET app and mock API responses with deterministic browser-test data.

The source tree, fresh-rebuild scripts, BDO Production, and every other known deployed instance represent PMT Database Version 1.22. Version 1.22 became the deployed baseline on July 16, 2026, after the combined Version 1.15-to-1.22 migration and matching application release were deployed successfully. Version 1.21 makes Root Cause Analysis synchronization one-way from Dev Task to Bug, copies Bug URLs one way to linked Bug Fix Dev Tasks, and prevents Developer-role users from moving Dev Tasks past `QA Passed`. Version 1.22 records successful password and invitation logins separately from `Users.RowVersion` and preserves each administrator's configured Role. Future database changes start with a forward migration from Version 1.22.

The main read flow is:

`feature -> core API -> GET /api/state -> SqlPmtStore.GetStateAsync -> [pmt].[GetAppState] -> ordered result sets -> hydrated AppState -> feature render`

`[pmt].[GetAppState]` and `GetStateAsync` are coupled by result-set order: users, projects, project members, Sprints, Sprint members, work items, assignees, reporters, dependencies, attachments, task attachments, Scrum logs, Documentation, Documentation attachments, Documentation history, audit events, lookups, and holidays. The procedure removes another owner's private Logs and Documentation plus their exclusive attachment metadata, history, audit details, parent IDs, and linked-document references before state reaches any feature, including About.

After the aggregate reader closes, `GetStateAsync` calls focused `[pmt].[GetUserLastLogins]` and merges its optional timestamps into the already-loaded users. Keeping login activity separate avoids changing the ordered aggregate result sets and avoids advancing `Users.RowVersion`, which would otherwise invalidate active sessions or create false user-edit collisions.

The authenticated session flow is server controlled:

`POST /api/login -> [pmt].[LoginUser] -> [pmt].[RecordSuccessfulLogin] -> signed/protected PMT.Auth HttpOnly cookie -> GET /api/session on reload`

The cookie's normal name-identifier claim is the effective user used by state reads and permission checks. It also carries the original administrator ID/name, both users' current `ROWVERSION` authentication stamps, and, while impersonating, an impersonated-user marker. Cookie validation checks the active effective user and stamp on every authenticated request and, during impersonation, also requires the original user's current stamp and administrator status. User/password/security changes revoke older tickets; an authorized self-edit immediately reissues the current ticket with the new stamp. Normal production tickets are Secure, persistent, sliding seven-day cookies; impersonation tickets are non-persistent, non-sliding, and expire after four hours. Starting impersonation validates an administrator session, rejects nested sessions, and calls `[pmt].[BeginImpersonation]` before replacing the cookie with the target user's effective context. Stopping calls `[pmt].[EndImpersonation]` and replaces it with the original administrator context. Start and end are audit events; ordinary writes made during impersonation use the target as the effective user and the administrator as the actor. Unsafe browser API methods also reject requests whose `Origin` or `Sec-Fetch-Site` identifies another origin.

Before impersonation, `core/preferences.js` snapshots the administrator's `pmt-*` browser preferences and clears the working PMT preference namespace for the target context. The temporary snapshot survives a hard refresh while the HttpOnly session remains impersonated. Explicit exit, logout, or an invalid/expired session restores the administrator snapshot without changing non-PMT browser storage.

The administrator-only system audit read is focused rather than part of the shared state aggregate:

`Settings Audit Trail -> GET /api/audit-trail -> SqlPmtStore.GetAuditTrailAsync -> [pmt].[GetAuditTrail] -> newest 2,000 actor/effective events`

The query orders by timestamp and audit ID descending, returns both actor and effective-user display names, and replaces another owner's private Documentation, task-to-private-Documentation conversion, or Personal Log details with an opaque activity label. System-only impersonation events are filtered out of the ordinary state response.

Scrum attendance uses a focused bounded read instead of extending that aggregate contract:

`Scrum -> GET /api/attendance?startDate&endDate -> SqlPmtStore.GetAttendanceCalendarAsync -> [pmt].[GetAttendanceCalendar] -> attendance entries, overlapping vacation ranges, and the current user's active vacation plans`

The focused query keeps growing attendance history out of every `/api/state` response and leaves the ordered `[pmt].[GetAppState]` result sets unchanged. Holidays continue to come from `/api/state` because they are existing shared scheduling state.

While Scrum is active, its default-on five-second client timer refreshes `/api/state` and invalidates the focused attendance request for the current and visible calendar months. The timer uses one chained request cycle, pauses during unsafe user interactions, stops when Scrum deactivates, and restores view state after rendering; it adds no database or endpoint contract.

Optimistic editing uses a focused `[pmt].[GetEditVersions]` read so the ordered `[pmt].[GetAppState]` result sets remain unchanged. State and vacation reads capture those tokens before loading their editable record values; this guarantees that a concurrent save can only produce a conservative conflict, never stale values paired with a newer token. WFH rows return `RowVersion` in the same result set because `[pmt].[GetWfhSchedule]` may create missing schedule rows; its first-load transaction uses a focused initialization application lock plus key-range protection so concurrent initial reads cannot deadlock or create the same user row twice. Update DTOs return the opaque row version as a base64 JSON string and submit it as `expectedRowVersion`. `SqlPmtStore` locks that version and runs the existing feature upsert in one transaction; a mismatch rolls back the save and returns HTTP 409 `save-conflict`. Security permissions use the same contract per Security resource.

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
|       |-- invitations/
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
|       |-- wfh-schedule/
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
        |-- tasks.css
        `-- wfh-schedule.css
tests/
|-- js/
`-- browser/
```

The entry module composes startup and the screen registry. `core` owns application-wide infrastructure, `shared` owns reusable pure logic, `components` owns reusable UI builders, and each feature owns its rendering, actions, filters, preferences, and feature-only calculations.

## Core services established in Phase 04

The frontend entry module now depends on focused native ES modules:

- `core/api.js` is the only generic `fetch` wrapper. Browser requests use the same-origin HttpOnly authentication cookie automatically; the wrapper preserves JSON and `FormData` behavior and normalizes API errors.
- `core/store.js` owns the live central state binding plus state loading, replacement, and reset.
- `core/preferences.js` is the only direct `localStorage` owner. It preserves existing `pmt-*` keys, provides safe string, number, boolean, and JSON defaults, and snapshots/restores administrator preferences around impersonation.
- `core/authentication.js` owns login, logout, cookie-session restoration, the effective user ID, administrator impersonation start/stop, and current-user lookup. It never persists identity in browser storage.
- `core/router.js` owns the current view, legacy view-name normalization, persistence, and the navigation screen selection.
- `core/application-shell.js` owns startup orchestration, login rendering and wiring, state-load error handling, top navigation and overflow, the avatar menu, theme switching, current-user shell rendering, and the persistent impersonation banner and Exit Impersonation action.
- `core/screen-registry.js` remains the authoritative list of Dashboard, Road Map, Gantt, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, WFH Schedule, Release Notes, About, and Settings.
- `app.js` supplies shared screen event handlers and the current screen renderer to the application shell; feature-specific rendering and actions move behind registered screen handlers.

## Shared utilities and components established in Phase 05

Reusable frontend logic now has stable native ES module homes:

- `shared/constants.js` owns fallback lookup values and the linked-Bug completion message.
- `shared/dates.js` owns reusable date formatting, date-key/range helpers, and shared timeline calendar helpers used across Road Map, Gantt, Scrum, Settings, and Documentation.
- `shared/filter-values.js` owns saved filter value normalization.
- `shared/permissions.js` owns browser permission checks for owners, work items, and users.
- `shared/selectors.js` owns state selectors and display names for Projects, Sprints, Tasks, and Users.
- `shared/app-urls.js` owns deployment path-base URL resolution for browser-rendered app assets, API calls, and portable stored `/assets` or `/uploads` values.
- `shared/text-and-links.js` owns HTML/attribute escaping, rich-text link normalization, text linkification, URL normalization, media URL normalization, and plain-text extraction.
- `shared/work-item-rules.js` owns status-based percent calculations, project/Sprint rollups, task completion checks, linked-Bug completion validation, and the Board's Developer-role status boundary.
- `shared/release-notes.js` owns latest-first release lookup, first-login limiting, unseen-release selection, user-specific seen-preference keys, the immediate login check, and the once-per-minute static version/feed refresh. `components/release-notes.js` renders the business notes and original prompts for both the feature screen and What's New.
- `components/attachments.js`, `avatars.js`, `buttons.js`, `charts.js`, `dialogs.js`, `filters.js`, `forms.js`, and `progress-and-status.js` own reusable markup builders while preserving existing CSS classes and HTML output.

Dashboard, Road Map, Gantt, Kanban Board, Projects, Sprints, Dev Tasks, Bug Tracking, Scrum, Documentation, Backlog, WFH Schedule, Release Notes, and Settings now use feature folders under `wwwroot/js/features/`. `features/roadmap/roadmap.js` owns Road Map filters, sorting, display toggles, and existing preference keys, with companion modules for rendering and timeline calculations. `features/gantt/gantt.js` owns Gantt filters, view preferences, bug expansion state, fly-by orchestration, and existing preference keys, with companion modules for rendering, date/layout calculations, fly-by scrolling and timers, and dependency/bug helpers. `features/board/board.js` owns Board rendering, selected Project and Sprint mode, sorting, filter panel visibility, visible and empty-column state, status updates, reorder persistence, and the existing Board preference keys. `features/board/board-drag.js` owns Board-only pointer and mouse drag state; its delegated Board listeners are active only while the Board screen is active, and its window listeners exist only during a drag gesture. `features/wfh-schedule/wfh-schedule.js` owns WFH day toggles, hidden users, reset, and table order through focused WFH endpoints. `features/release-notes/release-notes.js` owns the selected release and Release Notes/Sin's AI Prompts view preference; both the screen and login-time What's New dialog render the generated data maintained through `docs/release-notes.md`.

The current frontend dependency flow is:

`index.html -> preferences (pre-paint theme)`

`app -> application shell -> authentication/router/store/preferences`

`authentication -> api/preferences/store`

`store -> api`

`router -> preferences/screen registry`

`board -> board drag/components/shared/api/store/preferences`

`scrum -> components/shared/api/store/preferences plus focused attendance/vacation endpoints`

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
|-- InvitationEndpoints.cs
|-- EndpointHelpers.cs
|-- StateEndpoints.cs
|-- ProjectEndpoints.cs
|-- SprintEndpoints.cs
|-- WorkItemEndpoints.cs
|-- WfhScheduleEndpoints.cs
|-- SettingsEndpoints.cs
|-- ContentEndpoints.cs
|-- UploadEndpoints.cs
|-- UploadStorageAccess.cs
|-- UploadStorageOptions.cs
`-- DevelopmentEndpoints.cs
Data/
|-- SqlPmtStore.cs
|-- SqlPmtStore.State.cs
|-- SqlPmtStore.Authentication.cs
|-- SqlPmtStore.Invitations.cs
|-- SqlPmtStore.Projects.cs
|-- SqlPmtStore.Sprints.cs
|-- SqlPmtStore.WorkItems.cs
|-- SqlPmtStore.WfhSchedule.cs
|-- SqlPmtStore.Settings.cs
|-- SqlPmtStore.Content.cs
`-- SqlPmtStore.Development.cs
Models/
|-- StateModels.cs
|-- UserModels.cs
|-- InvitationModels.cs
|-- ProjectSprintModels.cs
|-- WorkItemModels.cs
|-- WfhScheduleModels.cs
|-- AttendanceModels.cs
|-- ContentModels.cs
`-- SettingsModels.cs
```

`Program.cs` remains responsible for service registration, middleware, deployment path-base setup, static/uploaded file setup, endpoint-group registration, fallback, and startup. `Deployment:PathBase` is blank for root deployment, `/pmt` for a first-level sub-site, or a deeper value such as `/mainurl/pmt` for a nested IIS Application. Endpoint files map HTTP contracts; `SqlPmtStore` partials remain direct ADO.NET procedure callers; model files remain plain DTO/input groups. `/api/state` stays in its own endpoint and state store partial because its ordered aggregate result sets are a key public contract for the frontend.

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

Most shared feature state reads through `GET /api/state` -> `GetStateAsync` -> `[pmt].[GetAppState]`; bounded history and security-sensitive views such as attendance and Audit Trail use the focused reads described above. The table lists frontend ownership and additional contracts.

| Feature | Frontend ownership | Endpoints | `SqlPmtStore` methods | Stored procedures or SQL contract |
| --- | --- | --- | --- | --- |
| Authentication and shell | `core/authentication.js`, `core/application-shell.js`, `core/router.js`, `core/preferences.js` | `POST /api/login`; `GET /api/session`; `POST /api/logout`; `POST /api/impersonation/start`; `POST /api/impersonation/stop`; `POST /api/change-password`; `GET /api/state` | `LoginAsync`; `GetSessionUserAsync`; `BeginImpersonationAsync`; `EndImpersonationAsync`; `ChangePasswordAsync`; `GetStateAsync` | `[pmt].[LoginUser]`; `[pmt].[GetSessionUser]`; `[pmt].[BeginImpersonation]`; `[pmt].[EndImpersonation]`; `[pmt].[ChangePassword]`; `[pmt].[GetAppState]` |
| Invitations and onboarding | `features/invitations/` | `POST /api/invitations`; `GET /api/invitations/{token}`; `POST /api/invitations/{token}/accept` | `CreateInvitationAsync`; `GetInvitationAsync`; `AcceptInvitationAsync` | `[pmt].[CreateUserInvitation]`; `[pmt].[GetUserInvitation]`; `[pmt].[AcceptUserInvitation]` |
| Dashboard | `features/dashboard/` | `GET /api/state` | `GetStateAsync` | `[pmt].[GetAppState]` |
| Road Map | `features/roadmap/` | `GET /api/state` | `GetStateAsync` | `[pmt].[GetAppState]` |
| Gantt | `features/gantt/` | `GET /api/state` | `GetStateAsync` | `[pmt].[GetAppState]` |
| Kanban Board | `features/board/` | `PUT /api/tasks/{id}`; `POST /api/tasks/reorder` | `SaveTaskAsync`; `ReorderTasksAsync` | `[pmt].[UpsertTask]`; `[pmt].[ReorderTasks]` |
| Projects | `features/projects/` | `POST /api/projects`; `PUT /api/projects/{id}`; `DELETE /api/projects/{id}` | `SaveProjectAsync`; `DeleteProjectAsync` | `[pmt].[UpsertProject]`; `[pmt].[DeleteProject]` |
| Sprints | `features/sprints/` | `POST /api/sprints`; `PUT /api/sprints/{id}`; `POST /api/sprints/{id}/finish`; `DELETE /api/sprints/{id}` | `SaveSprintAsync`; `FinishSprintAsync`; `DeleteSprintAsync` | `[pmt].[UpsertSprint]`; `[pmt].[FinishSprint]`; `[pmt].[DeleteSprint]` |
| Dev Tasks | `features/tasks/` | `POST /api/tasks`; `PUT /api/tasks/{id}`; `POST /api/tasks/reorder`; `POST /api/tasks/{id}/duplicate`; `DELETE /api/tasks/{id}`; `POST /api/tasks/{id}/attachments` | `SaveTaskAsync`; `ReorderTasksAsync`; `DuplicateTaskAsync`; `DeleteTaskAsync`; `AddTaskAttachmentAsync` | `[pmt].[UpsertTask]`; `[pmt].[ReorderTasks]`; `[pmt].[DuplicateTask]`; `[pmt].[DeleteTask]`; `[pmt].[AddTaskAttachment]` |
| Bugs | `features/bugs/` | `POST /api/tasks`; `PUT /api/tasks/{id}`; `POST /api/tasks/{id}/duplicate`; `DELETE /api/tasks/{id}`; `POST /api/tasks/{id}/attachments` | `SaveTaskAsync`; `DuplicateTaskAsync`; `DeleteTaskAsync`; `AddTaskAttachmentAsync` | `[pmt].[UpsertTask]`; `[pmt].[DuplicateTask]`; `[pmt].[DeleteTask]`; `[pmt].[AddTaskAttachment]`; `UpsertTask` owns Bug/Bug Fix workflow |
| Backlog | `features/backlog/` | `POST /api/tasks`; `PUT /api/tasks/{id}`; `POST /api/tasks/reorder` | `SaveTaskAsync`; `ReorderTasksAsync` | `[pmt].[UpsertTask]`; `[pmt].[ReorderTasks]` |
| WFH Schedule | `features/wfh-schedule/` | `GET /api/wfh-schedule`; `PUT /api/wfh-schedule/{userId}`; `POST /api/wfh-schedule/reorder`; `POST /api/wfh-schedule/reset` | `GetWfhScheduleAsync`; `SaveWfhScheduleAsync`; `ReorderWfhScheduleAsync`; `ResetWfhScheduleAsync` | `[pmt].[GetWfhSchedule]`; `[pmt].[UpdateWfhSchedule]`; `[pmt].[ReorderWfhSchedule]`; `[pmt].[ResetWfhSchedule]` |
| Release Notes and What's New | `features/release-notes/`, `components/release-notes.js`, `components/whats-new.js`, `shared/release-notes.js` | Static generated module plus `/release-notes-version.json` and `/release-notes-data.json`; user-specific browser preferences only | None | None |
| Scrum | `features/scrum/` | Scrum entry routes; `GET /api/attendance?startDate&endDate`; `POST /api/attendance`; `POST /api/vacations`; `PUT /api/vacations/{id}`; `DELETE /api/vacations/{id}` | Scrum entry methods plus `GetAttendanceCalendarAsync`; `RecordAttendanceAsync`; `SaveVacationAsync`; `CancelVacationAsync` | Scrum entry procedures plus `[pmt].[GetAttendanceCalendar]`; `[pmt].[RecordAttendance]`; `[pmt].[UpsertVacation]`; `[pmt].[CancelVacation]`; attendance reuses Scrum rights, and vacation changes are owner-only |
| Personal Log | `features/personal-log/` | `POST /api/devlogs`; `PUT /api/devlogs/{id}`; `DELETE /api/devlogs/{id}` | `SaveDevLogAsync`; `DeleteDevLogAsync`; `RequireDevLogPermissionAsync` | `[pmt].[GetAppState]` returns only current-owner private rows; `[pmt].[RequireDevLogPermission]`, `[pmt].[UpsertDevLog]`, and `[pmt].[DeleteDevLog]` reject cross-owner writes even for admins |
| Documentation | `features/documentation/` | `POST /api/blogs`; `PUT /api/blogs/{id}`; `DELETE /api/blogs/{id}`; `POST /api/blogs/{id}/attachments`; `DELETE /api/blogs/{id}/attachments/{attachmentId}` | `SaveBlogAsync`; `DeleteBlogAsync`; `AddBlogAttachmentAsync`; `DeleteBlogAttachmentAsync` | `[pmt].[GetAppState]` returns private Documentation only to its creator; `[pmt].[UpsertBlog]`, `[pmt].[DeleteBlog]`, `[pmt].[AddBlogAttachment]`, and `[pmt].[DeleteBlogAttachment]` reject cross-owner private access even for admins |
| Settings - users | `features/settings/` | `POST /api/users`; `PUT /api/users/{id}`; `DELETE /api/users/{id}` | `SaveUserAsync`; `DeleteUserAsync` | `[pmt].[UpsertUser]`; `[pmt].[DeleteUser]` |
| Settings - lookups | `features/settings/` | `POST /api/lookups`; `PUT /api/lookups/{id}`; `DELETE /api/lookups/{id}` | `SaveLookupAsync`; `DeleteLookupAsync` | `[pmt].[UpsertLookup]`; `[pmt].[DeleteLookup]` |
| Settings - security | `features/settings/` | `PUT /api/security/{resourceKey}`; `POST /api/security/reset` | `SaveSecurityPermissionsAsync`; `ResetSecurityPermissionsAsync` | `[pmt].[SaveSecurityPermissions]`; `[pmt].[ResetSecurityPermissions]` |
| Settings - audit trail | `features/settings/` | `GET /api/audit-trail` | `GetAuditTrailAsync` | `[pmt].[GetAuditTrail]`; administrator-only, actor/effective attribution, private-detail redaction |
| Settings - holidays | `features/settings/` | `POST /api/holidays`; `PUT /api/holidays/{id}`; `DELETE /api/holidays/{id}` | `SaveHolidayAsync`; `DeleteHolidayAsync` | `[pmt].[UpsertHoliday]`; `[pmt].[DeleteHoliday]` |
| Settings - maintenance | `features/settings/` | `GET /api/maintenance/recycle-bin`; `POST /api/maintenance/recycle-bin/preview`; `POST /api/maintenance/recycle-bin/purge`; `GET /api/maintenance/orphan-files`; `GET /api/maintenance/orphan-files/preview`; `POST /api/maintenance/orphan-files/delete` | Maintenance store methods plus guarded upload-folder scanning/preview/deletion | Maintenance procedures plus current attachment/rich-text reference checks |
| Settings - development | `features/settings/` | `POST /api/development/clear-non-pmt`; `POST /api/development/clear-pmt`; `POST /api/development/clear-users`; `POST /api/development/restore-seed-data`; `POST /api/development/restore-pmt-seed-data` | `DevelopmentClearNonPmtAsync`; `DevelopmentClearPmtAsync`; `DevelopmentClearUsersAsync`; `RestoreInitialSeedDataAsync`; `RestorePmtSeedDataAsync` | `[pmt].[DevelopmentClearNonPmt]`; `[pmt].[DevelopmentClearPmt]`; `[pmt].[DevelopmentClearUsers]`; shared and project-specific seed scripts |

`POST /api/uploads/{kind}` stores a generic uploaded file without a database call and is reused by invitation onboarding for avatar uploads. Task and Documentation attachment routes both store the file and then link its metadata through the relevant `[pmt]` attachment procedure. Upload storage is configured by `UploadStorage`. Blank `UserName` and `Password` values keep the root path as a normal local folder or current-identity path. When both credentials are supplied, `RootPath` must be a UNC path such as `\\fileserver\share\folder`; PMT opens a Windows fileshare connection at startup before serving `/uploads` or writing new files. A configuration or file-system access exception during upload-storage startup is treated as a degraded non-database subsystem: PMT logs the detailed exception, omits the upload file provider, injects a safe persistent shell warning, and returns an unavailable response for upload-file requests. It does not substitute another folder, and storage configuration changes require an application restart.

The Maintenance orphan-file inventory is administrator-only. Each candidate includes a path-base-aware URL to an administrator-checked preview endpoint so the administrator can inspect it in a new tab before deciding whether to delete it. The preview rechecks that the file is still orphaned and physically safe, blocks active content with a restrictive sandbox policy, and serves active document formats plus unknown extensions as non-sniffable plain text. Raster images and other passive browser formats keep their normal preview type. The final delete path still rechecks database references and physical-file safety immediately before deletion.

## Standard commands

```powershell
dotnet restore
dotnet build
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run generate:release-notes
npm.cmd run check:release-notes
npm.cmd run check:js
npm.cmd run test:js
npm.cmd run test:browser
git diff --check
```

`npm.cmd run test:browser` covers login, Release Notes and What's New, all primary screens, WFH Schedule toggles/order/hide/reset, Settings through the avatar menu, light/dark theme switching, dialogs, representative filters, Board drag/status persistence, Gantt rendering, Road Map rendering, console-error detection, and 1366x768 plus 1920x1080 viewport checks. Manual database-backed CRUD and destructive Development actions remain covered by `docs/manual-smoke-test.md`.
