# PMT Domain Rules

These are durable rules confirmed in the current JavaScript, ADO.NET mapping, and SQL procedures. SQL is authoritative when browser behavior and database enforcement overlap.

## Statuses and completion

The default status order is:

1. Backlog
2. Todo
3. In Progress
4. Code Complete
5. Ready for QA
6. QA in Progress
7. QA Failed
8. QA Passed
9. Deployed in SIT
10. Deployed in UAT
11. Deployed in Prod

Active lookup rows can provide labels/colors, but code relies on the workflow meaning and ordering above.
Browser-side status and percent calculations are centralized in `wwwroot/js/shared/work-item-rules.js`; progress and status markup is centralized in `wwwroot/js/components/progress-and-status.js`.
Regression tests for these rules live in `tests/js/work-item-rules.test.mjs`.

- Saving `Backlog` stores an unscheduled `Todo` and clears the Sprint.
- Assigning a new or previously unscheduled Dev Task to a Sprint sets it to `Todo`.
- Moving a non-Bug-associated Dev Task to `Todo` sets percent complete to 0. Moving a Bug-associated Dev Task to `Todo` preserves its current percent.
- Dev Task `Code Complete` sets percent complete to 100 when no Bug is associated, or 50 when a Bug is associated.
- Dev Task `Ready for QA` sets percent complete to 100 when no Bug is associated, or 50 when a Bug is associated.
- Dev Task `QA Failed` sets percent complete to 50 when no Bug is associated. If a Bug is associated, the current percent is preserved.
- Dev Task `QA Passed` and any status beginning with `Deployed` set percent complete to 100 when no Bug is associated. If a Bug is associated, the current percent is preserved and normal completion blocking still applies.
- For Bugs, `QA Failed`, `QA Passed`, and any status beginning with `Deployed` force the Bug's percent complete to 100%.
- Percent inputs are clamped to 0-100.
- A parent work item's stored percent is the rounded average of its active direct sub-tasks and is recalculated when a sub-task changes. The API also exposes a display average.
- `StartedAt` is set the first time a work item leaves Backlog/Todo.

Project and Sprint aggregate progress is separate from stored work-item percent. `SqlPmtStore` counts top-level work items whose status is `QA Passed`, `Deployed in SIT`, `Deployed in UAT`, or `Deployed in Prod`, then calculates:

`completed top-level work items / all top-level work items * 100`

## Concurrent editing

- Shared editable records carry an opaque SQL Server `ROWVERSION` token. Every update submits the token that was loaded with the editor; a missing or stale token causes HTTP 409 `save-conflict` and the newer database row is not overwritten.
- Collision protection covers Projects, Sprints, Dev Tasks, Bugs, Backlog items, Scrum/Log entries, Documentation, Users, Lookups/Roles, Holidays, WFH rows, vacation plans, and each Security resource's permission aggregate.
- The server locks and checks the version in the same transaction as the stored-procedure save. Browser checks and timestamps are not substitutes for this database-backed rule.
- A stale full draft may be saved as a new Sprint, work item, Scrum/Log entry, or Documentation item when the user has Create permission. A stale Project draft can switch to New Project mode only after the user supplies a different unique Project Code.
- Users, Lookups/Roles, Holidays, WFH rows, vacation plans, and Security settings are fixed-identity records or aggregates and are never duplicated as collision recovery. Their stale editor remains open so the user can review the newer record and retry deliberately.
- Board moves, Task/Backlog ordering, WFH ordering, imports, and read-only rich-text checkbox saves use the same version contract; they cannot bypass collision detection or silently turn a failed update into a new row. A reorder submits every affected row's loaded token, and the server locks and checks those rows in stable ID order before saving the new order.
- After any successful action that advances a record's row version, the browser must store a returned replacement token or reload the authoritative record before its next update. Reorder and quick-save paths cannot keep using their own now-stale token.
- Finishing a Sprint submits the loaded Sprint token. The server locks and checks it before running the entire finish, successor-creation, membership-copy, and task-carry operation in one transaction, so a stale action returns 409 and any later failure leaves the original Sprint open.
- Structural writers acquire focused transaction-owned application locks before taking row locks: `pmt:BlogWrites` for Documentation hierarchy changes, `pmt:WorkTaskWrites` for Task save/reorder/duplicate/delete and Sprint carry-forward, and `pmt:SprintWrites` for Sprint code allocation. Operations that span scopes always acquire them Blog -> WorkTask -> Sprint. Task-to-Documentation conversion, Documentation deletion, Sprint deletion, and Development cleanup use the same order so cross-feature writes cannot deadlock.
- `[pmt].[GetWfhSchedule]` serializes missing-row creation with the focused transaction-owned `pmt:WfhScheduleInitialization` application lock and retains an update key-range lock around the insert. Concurrent first loads must return one row per user without deadlocks or duplicate-key failures.
- A change made outside an editor to data that the editor later replaces must advance the owning record's token in the same transaction. For example, accepting an invitation adds Project membership and therefore advances each affected Project token; active User and Role changes advance every Security resource token because those records shape each Security permission aggregate.
- Security-related transactions acquire or advance the `SecurityResources` token before changing Users, Roles, `RolePermissions`, or `UserPermissions`. Keep this lock order consistent to avoid deadlocks between Security saves and permission-shaping changes.

## Dev Tasks and Bugs

- Work items have `TaskType` `Dev` or `Bug`.
- Dev Tasks do not retain Bug-only reproduction, result, environment, severity, or reporter fields.
- A Bug defaults to environment `SIT`, severity `Major`, and the current user as reporter when none is supplied.
- Reporters may be any active user.
- Assignees must be active members of the selected Sprint; unscheduled work uses active Project members.
- Dependencies must refer to active work items in the same Project and cannot point to the work item itself.
- Reordering persists the exact browser-provided order as `SortOrder`.

## Linked Bug and Bug Fix workflow

- Assigning a Bug creates or updates one linked Dev Task titled `Bug Fix: <bug title>`.
- The linked Bug Fix follows the Bug's Project, Sprint, priority, dates, and assignees and depends on the Bug.
- A Dev Task linked to a Bug cannot reach 100% until that Bug is `QA Passed` or in a deployed status. SQL enforces this even if browser validation is bypassed.
- A Dev Task is treated as Bug-associated when it has a linked Bug task or an active Bug dependency.
- Bug-associated Dev Tasks use the Bug-aware percent rules in the Statuses and completion section.
- For Bug save automation, associated Dev Tasks are Dev Tasks linked to the Bug or connected to the Bug by dependencies in either direction.
- Bug `QA Failed` sets associated Dev Tasks to 50%.
- Bug `QA Passed` and any status beginning with `Deployed` set associated Dev Tasks to 100%.
- When a linked Bug Fix reaches `Code Complete`, the Bug percent resets to 0 for QA retesting.
- These automatic changes write audit events.

## Roles and permissions

The default role names are `Admin`, `Dev - Developer`, `QA - Quality Assurance`, `SA - Systems Analyst`, `TL - Technical Lead`, `PM - Project Manager`, `QA - Manual`, `QA - Automation`, and `TM - Test Manager`.

- Admins bypass all resource permission checks and may always perform administrator actions.
- Every non-admin user inherits the permissions configured for their Role until an administrator changes a checkbox in that user's resource row.
- A user override is a complete replacement for the inherited row: checked grants the right and unchecked denies it. Reset removes the override and restores Role inheritance.
- `No Access` is an explicit deny. If either the Role or user override has `No Access` for an area, every allow permission for that area is denied.
- The available rights are Read, Create, Update, Delete, Import, and Export. Each PMT area exposes only the rights it supports.
- Role defaults follow software-team responsibilities. Every non-admin Role can read each area; all receive Board and WFH update/export, Settings update, Scrum and Documentation create/update/import/export, and full Personal Log rights.
- Developers receive full Dev Task and Backlog rights plus Bug read/create/export. QA, QA Manual, and QA Automation receive Dev Task read/export, full Bug rights, and Backlog read/create/update/import/export. Systems Analysts receive Projects and Sprints read/create/update, Dev Task/Bug/Backlog read/create/update/import/export, and Scrum/Documentation delete. Technical Leads receive full Projects, Sprints, Dev Task, and Backlog rights, Bug read/create/update/import/export, and Scrum/Documentation delete. Project Managers receive full Projects, Sprints, and Backlog rights, Dev Task/Bug read/create/update/import/export, and Scrum/Documentation delete. Test Managers receive Sprint read/update, Dev Task read/export, full Bug rights, Backlog read/create/update/import/export, and Scrum/Documentation delete.
- A custom Role created later in Settings starts with the common non-admin baseline and no built-in discipline-specific additions.
- Reset Security restores these defaults for every non-admin Role and removes every explicit user override so users inherit from their Roles again.
- The Security Audit shows each active user's current effective rights for every PMT area and exports the same read-only matrix to Excel.
- Administrators may add, rename, reorder, activate, deactivate, and delete Roles in Settings. Visible names are separate from the stable internal security codes.
- A Role cannot be deleted while any active or inactive user record still references it.
- Work-item permission is task-type based, not creator based.
- Project, Sprint, Scrum, Documentation, WFH, Settings, import, export, upload, and invitation endpoints enforce the matching resource right in SQL. Task and attachment checks resolve Dev Task versus Bug Tracking before enforcing the action.
- Finished Sprints are read-only for non-admin users, including work-item writes into that Sprint.
- A non-admin may update, import into, delete, pin, or unpin only a Scrum entry they own and must also have the matching Scrum right. New Scrum entries may be pinned when the owner has Scrum Create, and imported Scrum pin values require Scrum Import. Administrators may manage any shared Scrum entry. Private Personal Log pinning remains administrator-only.
- Private means owner-only throughout PMT's normal UI and API data flow. Administrator status never bypasses a private item's ownership boundary.
- Personal Log rows are private to their owner: `[pmt].[GetAppState]` never returns another user's private Log rows, including to an administrator, and no user or administrator may update/delete another user's private Log entry through PMT.
- Private Documentation is returned, viewed, exported, updated, deleted, attached to, or used as a parent only for its creator. Public Documentation continues to follow the configured Documentation resource permissions.
- Existing users may edit themselves, but non-admin users cannot change their own role/admin state. User creation and deletion are administrator-only once users exist.
- Lookup values, holidays, and development reset actions are administrator-only.
- Attachment permission follows the Update right for the owning Dev Task, Bug, or Documentation resource.

Browser permission checks hide inaccessible navigation and disable unavailable actions, while `[pmt].[HasPermission]` and the resource-specific require procedures enforce the database contract.
Browser permission checks live in `wwwroot/js/shared/security.js` and `wwwroot/js/shared/permissions.js` so screens and future feature modules share the same effective permission logic.
Permission regressions are covered in `tests/js/permissions.test.mjs`.

## Scrum attendance and vacation

- Attendance statuses are exactly `Home`, `Office`, `Sick Leave`, `Vacation`, `EL`, and `Other`. `EL` means Emergency Leave in tooltips and accessible descriptions.
- Check-In records today's status for the current user. On Behalf Of records today's status for another active user and preserves the acting user in the audit columns.
- One user/date/status combination is unique. Repeating the same Check-In is idempotent, while a different status on the same date is retained so an Office-to-Sick Leave or Office-to-EL day can show both statuses.
- Attendance reads require Scrum Read. A user's own Check-In requires Scrum Create, while recording On Behalf Of another user requires Scrum Update. SQL validates the user and status; browser validation does not replace the stored-procedure checks.
- Vacation plans store one inclusive start/end range rather than one attendance row per day. Creating a plan requires Scrum Create. Editing or canceling requires Scrum Update and is always restricted to the plan owner, including for administrators and guessed direct requests.
- Canceling a vacation sets its cancellation state instead of destroying the row. Canceled plans do not appear on the calendar.
- The calendar expands active vacation ranges as `Vacation` status for each covered date. It deduplicates the same user/status/date when a planned vacation and explicit Vacation attendance overlap, but preserves different statuses for the same user and date.
- Calendar status sections use the stable order Office, Home, Sick Leave, Vacation, EL, and Other. Empty sections are omitted. A day with only Office attendance remains one undivided section; separators appear only when two or more statuses are present.
- Title avatars represent today's known attendance. Selecting one updates the persisted Scrum Person filter, and changes made in the Person checklist update the title selection in the same render cycle.
- Active Holidays from Settings may be displayed in their matching calendar cells. Multiple active Holiday records on one date remain distinct; inactive Holidays are omitted.

## User invitations and onboarding

- Any active user may generate a reusable internal invite URL for one or more active Projects they belong to. Admins may include any active Project.
- Invite URLs are bearer links intended for internal BDO sharing and remain valid for 30 days. PMT does not require or collect an email address for invitation or onboarding.
- An invited user supplies only a unique nickname, a password of at least eight characters, and a required selected or uploaded avatar.
- Invited users are created as active, non-admin `Developer` users. User creation and all selected Project memberships are committed atomically.
- A user invited to one Project goes to Sprints when that Project already has at least one Sprint; otherwise the user goes to Projects. Users invited to multiple Projects go to Projects.

## Project codes and deletion

- Project codes are required, normalized to uppercase without spaces, limited to five characters, and unique across active and archived Projects.
- Saving a Project never silently replaces its requested code with a generated or random code.
- Deleting a Project archives it and preserves its members, Sprints, work items, Logs, Documentation, and audit history, so its code remains occupied.
- When a requested code belongs to an archived Project, only an administrator may explicitly confirm reclaiming it. Reclaiming assigns a unique internal code to the archived Project and preserves all of its related data before saving the requested code on the active Project.
- A code belonging to an active Project cannot be reclaimed, including by an administrator.

## Sprint lifecycle

- Sprint members must be active members of the selected Project.
- Finishing an open Sprint marks it finished and creates the next Sprint with the same duration beginning the following day.
- The new Sprint copies the prior Sprint's members.
- When requested, unfinished work below 100% moves to the new Sprint. `Todo` items move only when the finish option explicitly includes them.
- Deleting a Sprint soft-deletes it and makes its work items unscheduled.

## Maintenance and permanent deletion

- PMT Maintenance is administrator-only and lists the five true soft-deletion markers: archived Projects and deleted Sprints, work items, Documentation, and Scrum/Log entries. It never lists another owner's private Documentation or private Log.
- All listed recycle-bin rows are selected by default, but an administrator may select individual rows before requesting a preview.
- Permanent deletion always requires a server-generated exact preview. The purge recomputes the plan in one transaction and refuses to continue if any previewed item is missing or any new cascade item appears.
- Permanently deleting an archived Project also deletes its Sprints, work items, public Documentation, and Scrum entries. Private Documentation and private Logs are preserved and detached from that Project unless the current administrator owns and explicitly selected the already-deleted private item.
- A private item owned by the current administrator still uses an opaque Maintenance preview label. Other owners' private items are absent from inventory, previews, cascades, and purge plans.
- Orphan-file previews are administrator-only, recheck current references and physical-file safety, and render through a sandboxed no-cache response instead of opening uploaded active content directly under the PMT application origin. SVG, HTML, XML, and other active document types are shown as non-sniffable plain text.
- Task dependencies, memberships, attachment links, history, and audit rows belonging to purged items are removed before their parent records. Shared attachment metadata remains while another task or document still references it.
- Orphan-file deletion rechecks every selected relative path against current and soft-deleted database content immediately before deleting the disk file. Root-relative, deployed path-base, and absolute URL occurrences all count as references.
- Orphan-file names link to the protected Maintenance preview endpoint in a new tab so an administrator can inspect a candidate before deletion. The link does not bypass the reference recheck or select the file for deletion.
- Development Project cleanup preserves and detaches every private Documentation and private Log row. Clearing users or restoring all initial seed data is refused while another user owns private content; a full rebuild performed directly in SQL remains an administrator-controlled database operation.
- `Restore PMT Seed Data` is a non-destructive recovery action for a permanently deleted PMT seed Project. It refuses to run while any active or archived Project still owns code `PMT`, restores only PMT project data, and leaves LMS, HLS, users, permissions, holidays, and detached private content unchanged.

## About flyby screen saver

- After five minutes without PMT activity, the About 3D experience may open only while PMT is the visible, focused foreground tab and a user is logged in.
- The screen saver renders in a separate overlay sized to the normal About content area. It never navigates, rerenders the active feature, closes an editor, or replaces the current page DOM.
- The first mouse movement dismisses and disposes the overlay, restores the prior focus when possible, and leaves the URL, scroll position, open dialogs, and unsaved field values unchanged.
- Hiding or blurring the PMT tab cancels the idle timer and dismisses an active screen saver. Returning to PMT begins a fresh five-minute idle period.

## Persistence and preferences

Authentication is currently an internal-trust mechanism: the browser stores a user ID and sends it as `X-PMT-UserId`. Privacy rules prevent normal PMT UI/API flows from returning another owner's private content, but this identity header is not a tamper-resistant cookie or token and private upload URLs are not encrypted.

| Area | `localStorage` keys |
| --- | --- |
| Authentication and shell | `pmt-auth-user`, `pmt-view`, `pmt-theme` |
| About 3D scene | `pmt-about-alien-events-enabled`, `pmt-about-track-alien-events-enabled`, `pmt-about-battle-pip-enabled` |
| Board | `pmt-board-project`, `pmt-board-sprint`, `pmt-board-sort`, `pmt-board-statuses`, `pmt-board-hide-empty-columns`, `pmt-board-filters-visible` |
| Road Map | `pmt-roadmap-project`, `pmt-roadmap-sprint`, `pmt-roadmap-sort`, `pmt-roadmap-show-dates`, `pmt-roadmap-show-details`, `pmt-roadmap-show-sprints` |
| Gantt | `pmt-gantt-project`, `pmt-gantt-sprint`, `pmt-gantt-render-mode`, `pmt-gantt-sort`, `pmt-gantt-show-non-working-days` |
| Sprints and Dev Tasks | `pmt-sprint-project`, `pmt-task-project`, `pmt-task-sprint`, `pmt-task-filters`, `pmt-task-filters-visible`, `pmt-task-visual-charts-visible`, `pmt-task-dialog-fields` |
| Bugs, Scrum, and Documentation | `pmt-bug-filters`, `pmt-bug-filters-visible`, `pmt-bug-visual-charts-visible`, `pmt-bug-entry-project`, `pmt-bug-entry-sprint`, `pmt-bug-entry-environment`, `pmt-bug-table-columns`, `pmt-bug-dialog-fields`, `pmt-scrum-filters`, `pmt-documentation-project` |
| Settings | `pmt-settings-category`, `pmt-lookup-type` |

Keep key names and defaults stable during refactoring. Clearing PMT preferences removes only keys prefixed with `pmt-`, then reloads the application.

## Calendar and link behavior

- Gantt hides weekends and active configured holidays unless the user enables non-working days or an item starts on that date.
- Scrum's month calendar uses local date keys, includes forward/backward and month/year navigation, and keeps its focused attendance request bounded to the visible calendar range.
- User-entered and external links are normalized and open in a new tab.
- Browser link normalization, linkification, and escaping live in `wwwroot/js/shared/text-and-links.js`.
- Status, percent, Sprint, assignment, attachment, and other significant changes are audited.

Date-range, visible-timeline, saved-filter, escaping, URL-normalization, Gantt, and Road Map calculations are covered in `tests/js/date-filter-text.test.mjs` and `tests/js/timeline-calculations.test.mjs`.
