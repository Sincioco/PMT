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

BDO Production and every other known deployed instance currently use the Version 1.22 baseline. The source tree and fresh-rebuild scripts represent Version 1.23, with one active forward migration from 1.22 and a matching operator-facing combined runner. Version 1.23 preserves BDO's current PMT Project as `PMTQA` during migration, restores a separate original SQL-seeded `PMT` demo Project, safely recreates its demo identities, adapts seeded Bugs to active BDO lookups, adds current-month vacation examples for shared PMT/LMS/HLS demo members without overlapping existing active plans, supports repeatable focused PMT demo resets, makes broad Development cleanup protect only `PMT`, allows Clear Users and Factory Reset to proceed regardless of private content, and adds selected-date On Behalf Of attendance plus audited removal of explicit attendance entries.

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

`Scrum Check-In / On Behalf Of -> POST /api/attendance -> SqlPmtStore.RecordAttendanceAsync -> [pmt].[RecordAttendance]`

`Scrum Calendar Remove -> DELETE /api/attendance/{id} -> SqlPmtStore.RemoveAttendanceAsync -> [pmt].[RemoveAttendance]`

`[pmt].[RecordAttendance]` forces a user's own Check-In to the current UTC+8 workday even if a client submits another date; only an authorized On Behalf Of write may select another date. `[pmt].[RemoveAttendance]` hard-deletes one explicit attendance row in an audited transaction, requiring Scrum Create for the owner's own row or Scrum Update for another user's row. Vacation calendar removal continues through the existing owner-only cancellation endpoint.

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
- `components/attachments.js`, `avatars.js`, `buttons.js`, `charts.js`, `dialogs.js`, `filters.js`, `forms.js`, and `progress-and-status.js` own reusable markup builders while preserving existing CSS classes and HTML output. `components/image-annotation.js` owns the full-screen native SVG annotation editor, its Format, Template, and Objects inspector tabs, native canvas clipboard, reusable-template normalization, and compact object-tree projection, and reuses the RTE color-palette markup exported by `forms.js`.

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
| Scrum | `features/scrum/` | Scrum entry routes; `GET /api/attendance?startDate&endDate`; `POST /api/attendance`; `DELETE /api/attendance/{id}`; `POST /api/vacations`; `PUT /api/vacations/{id}`; `DELETE /api/vacations/{id}` | Scrum entry methods plus `GetAttendanceCalendarAsync`; `RecordAttendanceAsync`; `RemoveAttendanceAsync`; `SaveVacationAsync`; `CancelVacationAsync` | Scrum entry procedures plus `[pmt].[GetAttendanceCalendar]`; `[pmt].[RecordAttendance]`; `[pmt].[RemoveAttendance]`; `[pmt].[UpsertVacation]`; `[pmt].[CancelVacation]`; selected attendance dates are on-behalf-only, explicit attendance removal is audited, and vacation changes are owner-only |
| Personal Log | `features/personal-log/` | `POST /api/devlogs`; `PUT /api/devlogs/{id}`; `DELETE /api/devlogs/{id}` | `SaveDevLogAsync`; `DeleteDevLogAsync`; `RequireDevLogPermissionAsync` | `[pmt].[GetAppState]` returns only current-owner private rows; `[pmt].[RequireDevLogPermission]`, `[pmt].[UpsertDevLog]`, and `[pmt].[DeleteDevLog]` reject cross-owner writes even for admins |
| Documentation | `features/documentation/` | `POST /api/blogs`; `PUT /api/blogs/{id}`; `DELETE /api/blogs/{id}`; `POST /api/blogs/{id}/attachments`; `DELETE /api/blogs/{id}/attachments/{attachmentId}` | `SaveBlogAsync`; `DeleteBlogAsync`; `AddBlogAttachmentAsync`; `DeleteBlogAttachmentAsync` | `[pmt].[GetAppState]` returns private Documentation only to its creator; `[pmt].[UpsertBlog]`, `[pmt].[DeleteBlog]`, `[pmt].[AddBlogAttachment]`, and `[pmt].[DeleteBlogAttachment]` reject cross-owner private access even for admins |
| Image annotation templates | `components/image-annotation.js` through the RTE image action | `GET /api/image-annotation/template-library`; `GET /api/image-annotation/default-template-library`; `PUT /api/image-annotation/template-library` | `GetUserImageAnnotationTemplateLibraryAsync`; `GetImageAnnotationDefaultTemplateLibraryAsync`; `SaveUserImageAnnotationTemplateLibraryAsync` | `[pmt].[GetUserImageAnnotationTemplateLibrary]`; `[pmt].[GetImageAnnotationDefaultTemplateLibrary]`; `[pmt].[SaveUserImageAnnotationTemplateLibrary]`; one shared library in `[pmt].[ImageAnnotationDefaultTemplateLibraries]` plus an optional override per effective user in `[pmt].[UserImageAnnotationTemplateLibraries]` |
| Diagram database-schema generator | `features/diagram/pmt-database-schema.js` through the Entity inspector | Documentation/Create-protected `GET /api/diagram/pmt-database-schema`, then the existing `POST /api/blogs` Diagram persistence path | `RequirePermissionAsync`; `GetPmtDatabaseSchemaAsync`; then `SaveBlogAsync` | `[pmt].[RequirePermission]` enforces Documentation/Create; `[pmt].[GetPmtDatabaseSchema]` reads the connected database catalog; `[pmt].[UpsertBlog]` saves each generated editable Diagram |
| Settings - users | `features/settings/` | `POST /api/users`; `PUT /api/users/{id}`; `DELETE /api/users/{id}` | `SaveUserAsync`; `DeleteUserAsync` | `[pmt].[UpsertUser]`; `[pmt].[DeleteUser]` |
| Settings - lookups | `features/settings/` | `POST /api/lookups`; `PUT /api/lookups/{id}`; `DELETE /api/lookups/{id}` | `SaveLookupAsync`; `DeleteLookupAsync` | `[pmt].[UpsertLookup]`; `[pmt].[DeleteLookup]` |
| Settings - security | `features/settings/` | `PUT /api/security/{resourceKey}`; `POST /api/security/reset` | `SaveSecurityPermissionsAsync`; `ResetSecurityPermissionsAsync` | `[pmt].[SaveSecurityPermissions]`; `[pmt].[ResetSecurityPermissions]` |
| Settings - audit trail | `features/settings/` | `GET /api/audit-trail` | `GetAuditTrailAsync` | `[pmt].[GetAuditTrail]`; administrator-only, actor/effective attribution, private-detail redaction |
| Settings - holidays | `features/settings/` | `POST /api/holidays`; `PUT /api/holidays/{id}`; `DELETE /api/holidays/{id}` | `SaveHolidayAsync`; `DeleteHolidayAsync` | `[pmt].[UpsertHoliday]`; `[pmt].[DeleteHoliday]` |
| Settings - maintenance | `features/settings/` | `GET /api/maintenance/recycle-bin`; `POST /api/maintenance/recycle-bin/preview`; `POST /api/maintenance/recycle-bin/purge`; `GET /api/maintenance/orphan-files`; `GET /api/maintenance/orphan-files/preview`; `POST /api/maintenance/orphan-files/delete` | Maintenance store methods plus guarded upload-folder scanning/preview/deletion | Maintenance procedures plus current attachment/rich-text reference checks |
| Settings - development | `features/settings/` | `POST /api/development/clear-non-pmt`; `POST /api/development/clear-pmt`; `POST /api/development/clear-users`; `POST /api/development/restore-seed-data`; `POST /api/development/restore-pmt-seed-data` | `DevelopmentClearNonPmtAsync`; `DevelopmentClearPmtAsync`; `DevelopmentClearUsersAsync`; `RestoreInitialSeedDataAsync`; `RestorePmtSeedDataAsync` | `[pmt].[DevelopmentClearNonPmt]`; `[pmt].[DevelopmentClearPmt]`; `[pmt].[DevelopmentClearUsers]`; shared and project-specific seed scripts |

`POST /api/uploads/{kind}` stores a generic uploaded file without a database call and is reused by invitation onboarding for avatar uploads. Task and Documentation attachment routes both store the file and then link its metadata through the relevant `[pmt]` attachment procedure. Upload storage is configured by `UploadStorage`. Blank `UserName` and `Password` values keep the root path as a normal local folder or current-identity path. When both credentials are supplied, `RootPath` must be a UNC path such as `\\fileserver\share\folder`; PMT opens a Windows fileshare connection at startup before serving `/uploads` or writing new files. A configuration or file-system access exception during upload-storage startup is treated as a degraded non-database subsystem: PMT logs the detailed exception, omits the upload file provider, injects a safe persistent shell warning, and returns an unavailable response for upload-file requests. It does not substitute another folder, and storage configuration changes require an application restart.

RTE image annotation and the standalone Diagram screen use the same canvas object model. Every image is an ordinary `embedded-image` object with its own source and crop state. Annotating a new RTE image seeds one bottom object named `Original Image`; starting with Insert Diagram or New Diagram creates the same canvas with no image object. After creation, Original Image follows the same selection, visibility, grouping, ordering, deletion, move, resize, template, and history rules as any other embedded image. The editor's oversized centered pasteboard is temporary and grows when an image or vector is dropped beyond its current bounds. An uncropped image uses its own movable bounds; a non-destructive crop is stored on that image and moves and scales with it. The Objects tree can temporarily turn each crop off without deleting its saved rectangle. Clicking Crop again presents Remove Crop or Apply Crop Permanently. Permanent crop requires an irreversible-action warning, rasterizes only the retained source pixels as a PNG, makes that PNG the selected image's new source, and clears incompatible pre-crop undo history. Apply calculates a tight SVG view box around visible image and annotation paint and excludes unused workspace. When an RTE canvas still contains its externally uploaded Original Image, the stored RTE `<img>` points `src` at the current generated SVG and retains that active upload in `data-pmt-annotation-source`; deleting Original Image removes the attribute. After permanently cropping Original Image and saving its owning record, the new SVG embeds only the cropped PNG, the data attribute references the cropped PNG upload, and the former full source and generated SVG naturally become orphan-file candidates when no other record references them. Uploaded SVG responses are sandboxed with a restrictive content security policy and `nosniff` header because users may also open the generated file directly.

The standalone Diagram screen saves differently because Entity metadata can contain pasted SQL. Its generated SVG is stored as a base64 data-image inside the private Documentation `BodyHtml`, and later Edit Annotation operations keep replacing that inline data-image. The image and its editable metadata therefore inherit the private Document's owner-only filtering, while no public upload or orphan file is created. The Entity tab's Generate PMT Database Schema action requires Documentation/Create permission, reads the connected database's current `[pmt]` table, column, PK, FK, identity, datatype, and nullability metadata through one stored procedure, builds ordinary editable Entity objects in the browser, and creates a separate private Diagram through that same Blog path; it never overwrites the Diagram currently being edited.

Reusable annotation templates use a shared-default plus authenticated per-user database contract. `[pmt].[ImageAnnotationDefaultTemplateLibraries]` holds the seeded 13-template catalog used by every current or future user without a personal library. `GET /api/image-annotation/template-library` returns the effective user's override when present and otherwise falls back to that catalog; `PUT` saves a complete per-user override after browser and SQL validation. The separately authenticated `GET /api/image-annotation/default-template-library` supplies the canonical catalog for non-destructive restoration. `[pmt].[UserImageAnnotationTemplateLibraries]` holds at most one versioned JSON document per user, including no more than 50 ordered templates and the optional Arrow and Rectangle drawing defaults. A template creates no upload or sidecar file: an included raster or SVG image is stored losslessly as its original image data inside the JSON, while rectangles, arrows, and text remain native editable members. Consequently, template images are outside the orphan-file scan and cannot become unreferenced upload candidates. The user foreign key owns personal-library lifetime.

The inspector exposes Format, Template, and Objects as accessible tabs. Saving a selection captures its current native geometry and formatting; a mixed image-and-vector selection is retained as one reusable composition and represented by a large preview. Clicking a preview with no canvas selection inserts a detached copy at the viewport center with fresh object identities and, for a multi-object template, a fresh group identity. Clicking with a selection applies formatting instead: equal type sequences map one-to-one, while a different structure requires confirmation before PMT pairs the closest members by type. Formatting never replaces destination text, geometry, identities, grouping, lock state, or paint order; locked objects remain unchanged, and oversized arrow styling is limited when necessary to keep both endpoints fixed. The complete formatting operation is one history change. The user can ungroup and edit inserted members normally. Rename, update from the current selection, delete, and ordered move operations save the account library immediately, independently of Apply to RTE or Cancel. Restore Default Templates compares normalized design content, prepends only missing shared designs, preserves personal templates and their order, and refuses atomically if restoration would exceed 50 entries. A customized template that still owns a canonical ID is preserved while its original default receives a distinct ID. Existing canvas instances are snapshots rather than live links, so later template edits or deletion never rewrite objects already placed on a canvas. A single unlocked Arrow or Rectangle may supply the account's future drawing style, and either type can be reset to the PMT factory default.

The Objects tab is a compact projection of the same native canvas and SVG paint stack, not a separate object model. Its highest, frontmost painted item is the first row and its lowest, backmost item is the last row. Standalone objects render as tree rows; members that share a group identity render beneath one logical group row. Original Image is only the initial name and external-source identity of an RTE image object, not a protected layer. A Cropped badge and per-image crop toggle expose each reversible crop independently from ordinary layer visibility; turning a crop off shows that image's full source while retaining the crop for Undo, Redo, Apply, and reopen. A baked image keeps a non-toggleable Permanent crop cue. Tree and canvas selection share one selected-ID set, so single and additive tree selection immediately updates canvas selection chrome and canvas selection immediately updates the tree. Object and group labels belong to editable annotation metadata and participate in history, Apply, and reopen. Tree rename, multi-delete, copy, paste, and image reorder therefore operate on the same native objects as their canvas equivalents.

Objects search is a case-insensitive presentation filter over object and logical-group names. A matching child keeps its group parent visible, while a matching group keeps all of its children visible. Search never mutates object identities, selection, grouping, or the SVG paint order; clearing it restores the complete tree in exactly the same state.

Tree drag/drop immediately rewrites the native SVG paint order, so the visible canvas z-order changes as soon as the top-to-bottom tree order changes. A Kanban-style horizontal line marks the exact before/after destination. Dropping above a group header keeps the dragged item or group at the root immediately above that group; dropping below the header moves it to the top inside the group. A standalone row may otherwise move among root rows, join a logical group, or return to the root; moving a group row keeps every member together. PMT's annotation group model is intentionally flat: dropping one group inside another merges both sets of members under one group identity instead of creating a nested group. This keeps the existing canvas move, resize, ungroup, clipboard, history, and serialization paths authoritative while still allowing every node to move between the root and any logical group branch.

Annotation interaction preserves each vector type's native geometry. Arrows use painted shaft-and-head hit testing instead of their diagonal rectangular extent and expose only base and tip endpoint handles; dragging either endpoint changes length and rotation while the opposite endpoint remains anchored and the configured shaft width and arrowhead size remain unchanged. Object and group resize gestures use one scale factor from their starting bounds so width-to-height proportions and grouped-member relationships remain intact. A standalone ungrouped rectangle temporarily switches to freeform resizing while Alt is held, with its grabbed handle following the snapped pointer; Alt+Ctrl keeps the original center fixed, while other object types and groups ignore Alt. Holding Ctrl during a normal object or group resize temporarily moves the scaling anchor to the selection center and expands or contracts opposite sides symmetrically. A singly selected arrow retains its endpoint model and ignores Ctrl during endpoint resizing or whole-arrow dragging. When an arrow belongs to a multi-object group, it participates in the group's proportional and Ctrl-centered transform: the same group scale factor applies to its base-to-tip distance, shaft width, and arrowhead size. Text boxes persist horizontal and Top/Middle/Bottom vertical alignment in the editable SVG metadata, with missing legacy vertical alignment normalized to Top. The Format inspector reuses shared PMT form controls, color-palette markup, spacing, borders, focus treatment, and light/dark theme tokens. Grid and Snap changes preserve the selection and return keyboard focus to the last selected SVG object. Ctrl+A selects every annotation object only while keyboard focus belongs to the canvas or one of its SVG objects; focused formatting controls and text fields retain their native Ctrl+A behavior. Group selection is resolved from persisted membership on initial dialog render as well as later clicks, and its selection chrome includes dotted member guides; an arrow member's guide follows its base-to-tip line rather than a virtual rectangle.

Selection-specific annotation commands stay out of the primary toolbar. Select, Crop, Rectangle, Arrow, and Text Box use recognizable SVG glyphs while retaining their accessible names and keyboard shortcuts. Right-clicking a selected object opens the same PMT dropdown treatment used by RTE image actions, ordered as Crop, To Front, To Back, Forward, Backward, a separator, Group, Ungroup, Reset Crop, and Lock or Unlock, then a second separator followed by Copy as SVG and Copy as Image; each command is enabled only when the current selection, grouping, crop, and lock state permits it. Crop mode uses a crosshair cursor and the same blue marquee treatment as blank-pasteboard multi-selection. Hide Right Pane and Show Right Pane are local layout disclosures: they collapse or restore the desktop side inspector or responsive lower inspector without changing zoom or the workspace point at the center of the viewport, and keep their label and expanded state accessible. The annotation dialog's Maximize control sits beside Close and expands only this editor to the true browser viewport. Maximized mode hides the normal title and footer, exposes Cancel and Apply to RTE in the top toolbar, and provides a floating upper-right Restore control; maximizing and restoring preserve the workspace center and zoom and return focus to the corresponding layout control.

Editor zoom is a presentation-only viewport operation. A zoom change retains the existing SVG DOM and relationship routes, scales one canvas stage with a compositor transform, and updates only zoom-dependent handles, grid width, relationship hit targets, and scroll anchoring. Object-tree rebuilds, inspector synchronization, full SVG replacement, and relationship routing run only when editable state changes, not for every wheel notch or zoom selection.

Every rectangle and text box stores its own outline-visibility flag, defaulting to visible for new objects and legacy annotation metadata. The checked-by-default Outline control changes only eligible unlocked selections: hiding an outline renders no stroke but preserves the object's chosen outline color, while showing it restores that same color. The flag is part of history and editable SVG metadata, so undo, redo, Apply, and reopen preserve the per-object choice. Rectangle, arrow, and text-box objects also store opacity as a clamped 0–100 percent value, defaulting to 100 for new and legacy objects. The inspector applies opacity only to eligible unlocked vector selections; source and embedded images remain unchanged. Opacity covers the complete native object, participates in history and template capture, and persists through Apply, export, copy/paste, and reopen. Fill, Outline color, and Text color each show the six most recent shared RTE colors immediately beside the picker in a three-column by two-row strip. These color buttons deliberately retain their data-driven swatch backgrounds instead of inheriting the universal transparent Paper button treatment, so every remembered color remains visibly identifiable in light and dark themes. Applying a palette, custom, or recent color updates the shared RTE color memory and refreshes all three strips.

Clipboard export operates on the current object selection, including all members when the selection resolves to a group, and calculates tight painted bounds rather than copying the full canvas, temporary pasteboard, or selection chrome. Copy as SVG produces self-contained vector markup; Copy as Image rasterizes the same result as PNG. Both paths preserve the selected image's intentional crop and every selected object's geometry, fill, line and text styling, and outline visibility. The editor's native Ctrl+C and Ctrl+V clipboard instead copies and pastes editable selected objects within the open annotation workspace; Ctrl+D creates the same detached duplicate directly and announces completion through the shared PMT toast. Pasted and duplicated objects receive fresh identities and a small grid-aware offset. During an object drag, Shift constrains motion to the horizontal axis and Alt constrains it to the vertical axis; these modifiers do not change the separate Alt freeform-rectangle resize rule. Fit ignores temporary pasteboard dimensions, calculates the tight painted bounds of the image and vectors, and centers that content at the largest permitted zoom that fits the viewport. Text-box vertical positioning uses the rendered font's ascent and descent to place the visible glyph block for Top, Middle, and Bottom alignment; Middle therefore centers the visual text rather than centering an abstract baseline box.

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
