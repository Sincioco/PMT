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
- A user in the built-in Developer role may move a Dev Task through `Ready for QA` (also referred to as QA Ready) and `QA Passed`, but may not move it to any later status. The Board blocks the drag immediately and SQL enforces the same ordered-status boundary.
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
- The linked Bug Fix follows the Bug's Project, Sprint, priority, URL, dates, and assignees and depends on the Bug. URL synchronization runs from Bug to Dev Task only.
- A Dev Task linked to a Bug cannot reach 100% until that Bug is `QA Passed` or in a deployed status. SQL enforces this even if browser validation is bypassed.
- A Dev Task is treated as Bug-associated when it has a linked Bug task or an active Bug dependency.
- Bug-associated Dev Tasks use the Bug-aware percent rules in the Statuses and completion section.
- Root Cause Analysis synchronization is one-way. Saving a Dev Task replaces the associated Bug's Root Cause Analysis with the Dev Task value, including clearing it; values are never appended.
- Saving a Bug never changes an associated Dev Task's Root Cause Analysis.
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

## Authentication, impersonation, and system auditing

- Successful password login and invitation acceptance create ASP.NET Core's signed, protected `PMT.Auth` cookie. It is HttpOnly and SameSite Strict; production cookies are always Secure, while local Development permits HTTP. Normal sessions are persistent for seven days and slide while active. Impersonation uses a non-persistent, non-sliding ticket that expires after four hours. Browser JavaScript cannot read the cookie.
- A successful password login or invitation acceptance records that user's latest login timestamp for administrator-visible User cards. Cookie-session restoration and administrator impersonation do not replace it because neither action is a new login by that user.
- The cookie is the only API identity source. PMT no longer trusts `X-PMT-UserId`, a current-user query value, `localStorage`, or a default user as authentication. A missing or invalid authenticated claim returns HTTP 401.
- Every authenticated request revalidates the effective user's current `ROWVERSION` authentication stamp and active state. During impersonation it also revalidates the original user's stamp, active state, and administrator status. Password resets, user/security edits, deactivation, or demotion therefore invalidate an older ticket without waiting for a page refresh or expiry; an authorized self-edit or self-password change immediately reissues the current session with the new stamp.
- Browser-originated changing API requests must be same-origin. PMT rejects cross-origin and same-site sibling-origin form/fetch writes using `Origin` and `Sec-Fetch-Site`; non-browser deployment tooling that sends neither header remains supported.
- The effective user is the identity used by state reads, navigation, private-data filtering, and all permission checks. An impersonation cookie also preserves the original administrator as the actor. The original administrator identity is for auditing and exit only; it does not bypass the target user's permissions or privacy boundaries.
- Only an effective administrator may start impersonation. The target must be another active user, and nested impersonation is rejected. Starting replaces the signed cookie with the target's effective identity while retaining the original administrator claim.
- Password login and invitation acceptance cannot overwrite an active impersonation ticket; the administrator must exit first so the end is audited and preferences are restored.
- Administrator access is an independent flag, not a replacement job title. User saves preserve the selected Role value, while User cards append ` (Admin)` when the flag is enabled.
- The shell must show a persistent red banner naming the impersonated user and an Exit Impersonation action. A hard refresh restores the same server-controlled impersonation session from the cookie.
- Explicit exit records the end event and replaces the cookie with the original administrator's normal session. Logout while impersonating attempts the same end audit before clearing the authentication cookie. If either the effective user or original administrator becomes unavailable, session restoration fails closed and signs out.
- `[pmt].[WriteAudit]` stores the effective user in `AuditEvents.UserId` and the authenticated actor in `AuditEvents.ActorUserId`. ADO.NET places the actor in SQL session context for every application connection, so ordinary writes performed while impersonating retain both identities. Existing rows upgraded to Version 1.19 are backfilled with their effective user as actor.
- `[pmt].[BeginImpersonation]` and `[pmt].[EndImpersonation]` write `Impersonation` audit rows with `Started` and `Ended` actions. Their effective user is the target and their actor is the original administrator.
- Settings > Audit Trail is an administrator-only, read-only system activity view. Authorization uses the effective identity, so the view is unavailable while an administrator is impersonating a non-administrator. It shows the newest 2,000 events in deterministic timestamp/audit-ID order, with Performed By for the actor and Acting As when the effective user differs. Another owner's private Documentation, task-to-private-Documentation conversion, and Personal Log details are replaced with opaque activity labels even for an administrator. Impersonation events are system-only and are excluded from the ordinary `/api/state` audit collection.

## Scrum attendance and vacation

- Attendance statuses are exactly `Home`, `Office`, `Sick Leave`, `Vacation`, `EL`, and `Other`. `EL` means Emergency Leave in tooltips and accessible descriptions.
- The Scrum attendance selector defaults to `Office`. A changed selection is stored in the browser and restored until Reset View or PMT preferences are cleared.
- Check-In always records the current UTC+8 workday for the signed-in user, even if a client submits another date. On Behalf Of may record a selected date for another active user, defaults to the current UTC+8 workday when no date is supplied, and preserves the acting user in the audit columns.
- One user/date/status combination is unique. Repeating the same Check-In is idempotent, while a different status on the same date is retained so an Office-to-Sick Leave or Office-to-EL day can show both statuses.
- Attendance reads require Scrum Read. A user's own Check-In requires Scrum Create, while recording On Behalf Of another user requires Scrum Update. SQL validates the user and status; browser validation does not replace the stored-procedure checks.
- Removing an explicit attendance avatar hard-deletes exactly that attendance row and writes an audit event. Removing one's own row requires Scrum Create; removing another user's row requires Scrum Update. Cancel closes the avatar menu without changing data.
- Vacation plans store one inclusive start/end range rather than one attendance row per day. Creating a plan requires Scrum Create. Editing or canceling requires Scrum Update and is always restricted to the plan owner, including for administrators and guessed direct requests.
- Canceling a vacation sets its cancellation state instead of destroying the row. Canceled plans do not appear on the calendar.
- The calendar expands active vacation ranges as `Vacation` status for each covered date. Removing one of those vacation avatars cancels the owner's entire underlying vacation range; it does not split the range around one day. The calendar deduplicates the same user/status/date when a planned vacation and explicit Vacation attendance overlap, but preserves different statuses for the same user and date.
- Calendar status sections use the stable order Office, Home, Sick Leave, Vacation, EL, and Other. Empty sections are omitted. A day with only Office attendance remains one undivided section; separators appear only when two or more statuses are present.
- Title avatars represent today's known attendance. Selecting one updates the persisted Scrum Person filter, and changes made in the Person checklist update the title selection in the same render cycle.
- Scrum auto-refresh is enabled by default and runs one non-overlapping cycle every five seconds only while Scrum is active. The same persisted overflow toggle controls Table and Calendar views.
- Each safe cycle reloads Scrum entries and today's title attendance, plus the visible attendance/vacation month when Calendar is shown. It pauses for open dialogs, active form editing, unsaved attendance selection, and column dragging, and preserves the current view, filters, focus, overflow-menu state, and application/table/calendar scroll positions without a document reload.
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
- Renaming a Project code transactionally updates the code prefix of every associated Sprint and work item, including finished/deleted records, without renumbering their existing suffixes. The rename fails without changing data if a repaired code would be too long or collide with another record.
- The Version 1.20 production migration contains a one-time repair for legacy PMT Project children left with generated prefixes. It changes only incorrect Sprint and work-item codes, uses their existing `ProjectId` relationship as authority, preserves already-correct codes, and gives an additional colliding legacy row the next available standard PMT code. This incident repair is not a permanent runtime auto-renumbering rule.
- Deleting a Project archives it and preserves its members, Sprints, work items, Logs, Documentation, and audit history, so its code remains occupied.
- When a requested code belongs to an archived Project, only an administrator may explicitly confirm reclaiming it. Reclaiming assigns a unique internal code to the archived Project and updates that Project's Sprint and work-item prefixes before saving the requested code on the active Project.
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
- An annotated RTE image stores both its current generated SVG URL and its original full-resolution upload URL in the owning record's rich-text HTML. Maintenance must count both as references; editable annotation state lives inside the referenced SVG rather than in an unlinked sidecar file.
- The seeded library in `[pmt].[ImageAnnotationDefaultTemplateLibraries]` is the shared image-annotation default for every current and future user without a personal library. A personal versioned library in `[pmt].[UserImageAnnotationTemplateLibraries]` belongs to the authenticated effective user and overrides that fallback. Restore Default Templates prepends only missing shared designs without deleting, replacing, or reordering personal templates, and refuses rather than dropping personal entries if the 50-template limit lacks enough space. An embedded company logo or other image remains original-quality image data inside the applicable JSON; saving a template creates no upload or sidecar file, so Maintenance cannot classify a template asset as an orphan.
- Orphan-file names link to the protected Maintenance preview endpoint in a new tab so an administrator can inspect a candidate before deletion. The link does not bypass the reference recheck or select the file for deletion.
- Development Project cleanup preserves and detaches every private Documentation and private Log row. `PMT` is the only Project code protected by broad cleanup; `Clear All Projects Except PMT` deletes `PMTQA` and every other non-PMT Project. `Clear Users` works even when users own private content, removes obsolete per-user permission rows, and remaps all surviving ownership and audit attribution to Sin. `Factory Reset PMT` is intentionally destructive: it does not refuse private content and deletes all current data, including personal annotation-template libraries, before reseeding the shared defaults and original PMT, LMS, and HLS demos.
- `Restore PMT Seed Data` is a non-destructive recovery action for a permanently deleted PMT demo Project. It refuses to run while any active or archived Project still owns code `PMT`, recreates or reactivates only missing original demo identities, gives newly inserted identities non-public random passwords, restores only PMT Project data, and leaves PMTQA, other Projects, BDO users, permissions, holidays, and detached private content unchanged. The user checks and seed run in one serialized transaction so concurrent restore requests cannot create duplicate demo identities.
- PMT, LMS, and HLS seed scripts explicitly create their 15 seed Documentation records as public. The private-by-default behavior for normal user-created Documentation remains unchanged.

## About flyby screen saver

- After five minutes without PMT activity, the About 3D experience may open only while PMT is the visible, focused foreground tab and a user is logged in.
- The screen saver renders in a separate overlay sized to the normal About content area. It never navigates, rerenders the active feature, closes an editor, or replaces the current page DOM.
- The first mouse movement dismisses and disposes the overlay, restores the prior focus when possible, and leaves the URL, scroll position, open dialogs, and unsaved field values unchanged.
- Hiding or blurring the PMT tab cancels the idle timer and dismisses an active screen saver. Returning to PMT begins a fresh five-minute idle period.

## Release Notes and What's New

- The Release Notes screen and What's New dialog render one generated latest-first dataset. Each record contains a curated business summary and the matching historical Requirements prompt.
- Requirements prompt files are planning records, not implementation authorization. Add or change release notes only after the user explicitly authorizes the work and the described behavior is complete.
- On the first successful login for a browser user, What's New shows only the latest three releases. On later logins and successful cookie-session restoration it shows every release newer than that user's saved latest-seen revision. Those entry points check the no-cache static manifest before selecting releases.
- Closing What's New or following its link to Release Notes saves the newest current revision under a user-specific browser preference. Changing an authorized release's prompt or business summary during the same day changes its generated revision and browser cache key, so that revised release appears once without replaying unrelated older notes. Signed-in browsers check the small manifest once per minute, load the full static feed only when that revision changes, and rerender an already-open Release Notes screen. Release Notes and What's New do not add a database contract.

## Persistence and preferences

Authentication lives only in the signed, protected HttpOnly cookie described above. The browser removes the legacy `pmt-auth-user` key during session restoration and never stores the current identity in `localStorage`.

Image annotation templates are account data, not browser preferences. Each effective user resolves one server-backed version 1 library through `GET /api/image-annotation/template-library`: their personal library when one exists, otherwise the shared 13-template default library. Saving through `PUT /api/image-annotation/template-library` creates or updates only that user's personal library, containing at most 50 ordered templates plus optional Arrow and Rectangle drawing defaults. This makes the library available after signing in from another browser or computer. Template create, rename, content update, reorder, delete, and default changes persist immediately even if the current annotation dialog is later canceled; Apply to RTE controls only the open canvas. With no selected canvas object, using a template inserts a detached native instance with fresh identities, so later changes to the template do not alter existing instances. With a selection, using a template applies formatting only: matching type sequences map one-to-one, different structures require confirmation and use best-effort same-type matching, extra template members are ignored, and the last available same-type style is reused when the destination has more matching members. Destination text, geometry, identities, grouping, lock state, and layer order never change; locked objects remain unchanged, and arrow styling is limited when necessary to keep both endpoints fixed. The complete formatting application is one undoable and redoable history change.

A mixed template keeps its image data and editable rectangles, arrows, and text as native members of a new group. Image bytes are embedded without recompression; preview scaling is display-only. Ctrl+C and Ctrl+V copy and paste native canvas objects within the open annotation editor, while Ctrl+D duplicates the selection and reports success with a toast. Shift constrains an active move to horizontal motion, Alt constrains it to vertical motion, and Fit frames only the painted object bounds rather than the temporary pasteboard.

The six shared recent RTE colors beside annotation Fill, Outline color, and Text color are color representations, not ordinary transparent Paper buttons. Each swatch must visibly render its remembered color in both themes while retaining normal hover and keyboard-focus treatment.

Annotation opacity is a per-object percentage from 0 through 100 and defaults to fully opaque. It applies only to rectangles, arrows, and text boxes, including eligible members of a mixed selection; it never changes the source image or an embedded image. Opacity is native editable object state and therefore follows undo, redo, template capture, copy/paste, Apply, export, and reopen.

The annotation Objects tree is another view of the live canvas and SVG paint stack. Its highest, frontmost painted item is at the top and its lowest, backmost item is at the bottom; dragging a row immediately rewrites that SVG paint order and repaints the canvas at the matching z-order. A single horizontal insertion line shows the pending root position. The upper half of a group header places an object or complete group before that group at the root, including above the current top group; the lower half intentionally moves it inside the group. The original source image remains the fixed bottom layer. The source image may be a child of a logical group, but it cannot be deleted or reordered above annotations. Selecting objects or groups in either the tree or canvas updates the same selection. Tree rename, multi-delete, pasted objects, and drag/drop changes participate in normal annotation history, while Copy only updates the editor's native clipboard.

Objects-tree search matches object and group names case-insensitively. A matching child retains its logical group parent, and a matching group retains all children. Filtering is presentation-only: it cannot change selection, grouping, z-order, history, or the editable SVG state.

An object's custom tree label is stored on that object. A logical group's custom label is stored once against its group identity and is removed when that group no longer exists; both labels persist in editable SVG metadata and reappear when the annotation is reopened. Groups remain flat. Dropping a standalone object on a group assigns it to that group, dropping a child at the root removes its group membership, dragging a group row moves its non-image children as one ordered block, and dropping one group on another merges their members under one group identity rather than nesting groups.

Before an administrator enters impersonation, PMT snapshots all current `pmt-*` preferences except the legacy authentication key into the temporary `pmt-impersonation-admin-preferences` value. It then clears the working PMT preference namespace so the impersonated user does not inherit the administrator's view, theme, navigation, or filter choices. The snapshot remains during hard refresh and is restored on explicit exit, logout, or failed session restoration. Preferences changed while impersonating are discarded on restore, and non-PMT `localStorage` values are never changed.

| Area | `localStorage` keys |
| --- | --- |
| Shell | `pmt-view`, `pmt-theme`; temporary impersonation backup: `pmt-impersonation-admin-preferences` |
| Release Notes and What's New | `pmt-release-notes-view`, `pmt-release-notes-selected`, `pmt-release-notes-last-seen:{userId}` |
| About 3D scene | `pmt-about-alien-events-enabled`, `pmt-about-track-alien-events-enabled`, `pmt-about-battle-pip-enabled` |
| Board | `pmt-board-project`, `pmt-board-sprint`, `pmt-board-sort`, `pmt-board-statuses`, `pmt-board-hide-empty-columns`, `pmt-board-filters-visible` |
| Road Map | `pmt-roadmap-project`, `pmt-roadmap-sprint`, `pmt-roadmap-sort`, `pmt-roadmap-show-dates`, `pmt-roadmap-show-details`, `pmt-roadmap-show-sprints` |
| Gantt | `pmt-gantt-project`, `pmt-gantt-sprint`, `pmt-gantt-render-mode`, `pmt-gantt-sort`, `pmt-gantt-show-non-working-days` |
| Sprints and Dev Tasks | `pmt-sprint-project`, `pmt-task-project`, `pmt-task-sprint`, `pmt-task-filters`, `pmt-task-filters-visible`, `pmt-task-visual-charts-visible`, `pmt-task-dialog-fields` |
| Bugs, Scrum, and Documentation | `pmt-bug-filters`, `pmt-bug-filters-visible`, `pmt-bug-visual-charts-visible`, `pmt-bug-entry-project`, `pmt-bug-entry-sprint`, `pmt-bug-entry-environment`, `pmt-bug-table-columns`, `pmt-bug-dialog-fields`, `pmt-scrum-filters`, `pmt-scrum-calendar-visible`, `pmt-scrum-auto-refresh`, `pmt-documentation-project` |
| Settings | `pmt-settings-category`, `pmt-lookup-type` |

Keep key names and defaults stable during refactoring. Clearing PMT preferences removes normal keys prefixed with `pmt-`, preserves an active impersonation backup so the administrator can still exit safely, and then reloads the application.

## Calendar and link behavior

- Gantt hides weekends and active configured holidays unless the user enables non-working days or an item starts on that date.
- Scrum's month calendar uses local date keys, includes forward/backward and month/year navigation, and keeps its focused attendance request bounded to the visible calendar range.
- Rendered rich text and Release Notes recognize an active user's `@Nickname`; `@{Nickname With Spaces}` provides an explicit form for nicknames containing spaces. Mention decoration is read-only and never rewrites the stored rich text or release source.
- A recognized mention is keyboard-focusable and shows the same compact user identity details on hover or focus. Text that does not match an active user remains ordinary text.
- User-entered and external links are normalized and open in a new tab.
- Browser link normalization, linkification, and escaping live in `wwwroot/js/shared/text-and-links.js`.
- Status, percent, Sprint, assignment, attachment, and other significant changes are audited.

Date-range, visible-timeline, saved-filter, escaping, URL-normalization, Gantt, and Road Map calculations are covered in `tests/js/date-filter-text.test.mjs` and `tests/js/timeline-calculations.test.mjs`.
