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
- A non-admin may update, import into, or delete only a Scrum entry they own and must also have the matching Scrum right. Administrators may manage any shared Scrum entry. Only administrators may pin Scrum entries.
- Personal Log rows are private to their owner: `[pmt].[GetAppState]` never returns another user's private Log rows, including to an administrator, and no user or administrator may update/delete another user's private Log entry through PMT.
- Documentation update/delete actions follow their configured resource permissions.
- Existing users may edit themselves, but non-admin users cannot change their own role/admin state. User creation and deletion are administrator-only once users exist.
- Lookup values, holidays, and development reset actions are administrator-only.
- Attachment permission follows the Update right for the owning Dev Task, Bug, or Documentation resource.

Browser permission checks hide inaccessible navigation and disable unavailable actions, while `[pmt].[HasPermission]` and the resource-specific require procedures enforce the database contract.
Browser permission checks live in `wwwroot/js/shared/security.js` and `wwwroot/js/shared/permissions.js` so screens and future feature modules share the same effective permission logic.
Permission regressions are covered in `tests/js/permissions.test.mjs`.

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

## Persistence and preferences

Authentication is currently an internal-trust mechanism: the browser stores a user ID and sends it as `X-PMT-UserId`. It is not cookie- or token-based authentication.

| Area | `localStorage` keys |
| --- | --- |
| Authentication and shell | `pmt-auth-user`, `pmt-view`, `pmt-theme` |
| About 3D scene | `pmt-about-alien-events-enabled`, `pmt-about-battle-pip-enabled` |
| Board | `pmt-board-project`, `pmt-board-sprint`, `pmt-board-sort`, `pmt-board-statuses`, `pmt-board-hide-empty-columns`, `pmt-board-filters-visible` |
| Road Map | `pmt-roadmap-project`, `pmt-roadmap-sprint`, `pmt-roadmap-sort`, `pmt-roadmap-show-dates`, `pmt-roadmap-show-details`, `pmt-roadmap-show-sprints` |
| Gantt | `pmt-gantt-project`, `pmt-gantt-sprint`, `pmt-gantt-render-mode`, `pmt-gantt-sort`, `pmt-gantt-show-non-working-days` |
| Sprints and Dev Tasks | `pmt-sprint-project`, `pmt-task-project`, `pmt-task-sprint`, `pmt-task-filters`, `pmt-task-filters-visible`, `pmt-task-visual-charts-visible`, `pmt-task-dialog-fields` |
| Bugs, Scrum, and Documentation | `pmt-bug-filters`, `pmt-bug-filters-visible`, `pmt-bug-visual-charts-visible`, `pmt-bug-entry-project`, `pmt-bug-entry-sprint`, `pmt-bug-entry-environment`, `pmt-bug-table-columns`, `pmt-bug-dialog-fields`, `pmt-scrum-filters`, `pmt-documentation-project` |
| Settings | `pmt-settings-category`, `pmt-lookup-type` |

Keep key names and defaults stable during refactoring. Clearing PMT preferences removes only keys prefixed with `pmt-`, then reloads the application.

## Calendar and link behavior

- Gantt hides weekends and active configured holidays unless the user enables non-working days or an item starts on that date.
- User-entered and external links are normalized and open in a new tab.
- Browser link normalization, linkification, and escaping live in `wwwroot/js/shared/text-and-links.js`.
- Status, percent, Sprint, assignment, attachment, and other significant changes are audited.

Date-range, visible-timeline, saved-filter, escaping, URL-normalization, Gantt, and Road Map calculations are covered in `tests/js/date-filter-text.test.mjs` and `tests/js/timeline-calculations.test.mjs`.
