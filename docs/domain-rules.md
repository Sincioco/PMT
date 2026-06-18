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

- Saving `Backlog` stores an unscheduled `Todo` and clears the Sprint.
- Assigning a new or previously unscheduled Dev Task to a Sprint sets it to `Todo`.
- Moving to `Todo` preserves an existing nonzero percent; otherwise it uses 0.
- `QA Passed` and all deployed statuses force 100%.
- Dev Task `Code Complete` forces 100%.
- Bug `QA Failed` and `QA Passed` force 100%.
- Percent inputs are clamped to 0-100.
- A parent work item's stored percent is the rounded average of its active direct sub-tasks and is recalculated when a sub-task changes. The API also exposes a display average.
- `StartedAt` is set the first time a work item leaves Backlog/Todo.

Project and Sprint progress does not use arbitrary entered percent. `SqlPmtStore` counts top-level work items whose status is `QA Passed`, `Deployed in SIT`, `Deployed in UAT`, or `Deployed in Prod`, then calculates:

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
- Bug `QA Passed` sets the linked Bug Fix percent to 100.
- Bug `QA Failed` sets the linked Bug Fix percent to 50.
- When a linked Bug Fix reaches `Code Complete`, the Bug percent resets to 0 for QA retesting.
- These automatic changes write audit events.

## Roles and permissions

Roles are `Admin`, `Developer`, and `QA`.

- Admins may edit both Dev Tasks and Bugs and perform administrator actions.
- Developers may create, edit, duplicate, delete, and attach files to Dev Tasks.
- QA users may create, edit, duplicate, delete, and attach files to Bugs.
- Work-item permission is task-type based, not creator based.
- Project and Sprint edit/delete operations are owner-or-admin. Finishing a Sprint is also owner-or-admin.
- Finished Sprints are read-only for non-admin users, including work-item writes into that Sprint.
- Scrum entries and Documentation are owner-or-admin for edit/delete. Only admins may pin Scrum entries.
- Existing users may edit themselves, but non-admin users cannot change their own role/admin state. User creation and deletion are administrator-only once users exist.
- Lookup values, holidays, and development reset actions are administrator-only.
- Attachment permission follows the owning task type or Documentation ownership.

Browser permission checks control available actions, while `[pmt].[IsAdmin]`, `[pmt].[CanEdit]`, `[pmt].[UserRole]`, and `[pmt].[CanEditTaskType]` enforce the database contract.

## Sprint lifecycle

- Sprint members must be active members of the selected Project.
- Finishing an open Sprint marks it finished and creates the next Sprint with the same duration beginning the following day.
- The new Sprint copies the prior Sprint's members.
- When requested, unfinished work below 100% moves to the new Sprint. `Todo` items move only when the finish option explicitly includes them.
- Deleting a Sprint soft-deletes it and makes its work items unscheduled.

## Persistence and preferences

Authentication is currently an internal-development mechanism: the browser stores a user ID and sends it as `X-PMT-UserId`. It is not production-grade cookie or token authentication.

| Area | `localStorage` keys |
| --- | --- |
| Authentication and shell | `pmt-auth-user`, `pmt-view`, `pmt-theme` |
| Board | `pmt-board-project`, `pmt-board-sprint`, `pmt-board-sort`, `pmt-board-statuses` |
| Road Map | `pmt-roadmap-project`, `pmt-roadmap-sprint`, `pmt-roadmap-sort`, `pmt-roadmap-show-dates`, `pmt-roadmap-show-details`, `pmt-roadmap-show-sprints` |
| Gantt | `pmt-gantt-project`, `pmt-gantt-sprint`, `pmt-gantt-render-mode`, `pmt-gantt-sort`, `pmt-gantt-show-non-working-days` |
| Sprints and Dev Tasks | `pmt-sprint-project`, `pmt-task-project`, `pmt-task-sprint`, `pmt-task-filters`, `pmt-task-filters-visible`, `pmt-task-visual-charts-visible` |
| Bugs and Documentation | `pmt-bug-filters`, `pmt-bug-filters-visible`, `pmt-bug-visual-charts-visible`, `pmt-documentation-project` |
| Settings | `pmt-settings-category`, `pmt-lookup-type` |

Keep key names and defaults stable during refactoring. Clearing PMT preferences removes only keys prefixed with `pmt-`, then reloads the application.

## Calendar and link behavior

- Gantt hides weekends and active configured holidays unless the user enables non-working days or an item starts on that date.
- User-entered and external links are normalized and open in a new tab.
- Status, percent, Sprint, assignment, attachment, and other significant changes are audited.
