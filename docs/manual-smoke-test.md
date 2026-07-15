# PMT Manual Smoke Test

Use this checklist after each refactor phase. Run it in Chrome or Chromium
against disposable development data.

## Setup

- [ ] `npm.cmd install` has restored test dependencies.
- [ ] `npx.cmd playwright install chromium` has installed the browser used by Playwright, if this machine has not run it before.
- [ ] `dotnet restore` succeeds.
- [ ] `dotnet build` succeeds.
- [ ] `npm.cmd run check:js` succeeds.
- [ ] `npm.cmd run test:js` succeeds.
- [ ] `npm.cmd run test:browser` succeeds at `1366 x 768` and `1920 x 1080`.
- [ ] Start PMT and open `http://localhost:5056`.
- [ ] Open browser developer tools and keep the Console visible.
- [ ] Use a laptop-size viewport, approximately `1366 x 768`.

## Upload storage availability

- [ ] Configure `UploadStorage:RootPath` to an invalid or unreachable location and restart PMT. Confirm the Login screen still loads and a persistent upload-storage warning is visible.
- [ ] With upload storage unavailable, confirm database-backed screens remain usable, an upload request returns a clear unavailable error, and `/uploads/missing-file.png` returns `503` instead of the PMT HTML shell.
- [ ] Correct the folder or fileshare configuration, restart PMT, and confirm the warning disappears and both upload writes and `/uploads` reads work.

## Authentication and user menu

- [ ] On a browser profile that has never logged in, confirm Nickname or Email and Password both start blank.
- [ ] Enter `Sin` and `Password1`, then log in.
- [ ] Confirm the avatar menu opens and contains Invite Users, Settings, theme, password, and Log Out.
- [ ] Open Change Password, validate the fields/dialog, and cancel without changing the seed password.
- [ ] Log out and confirm the Login screen returns.
- [ ] Log in again and confirm the selected view loads.

## Invitations and new-user onboarding

Use disposable invitation records and new-user nicknames, and remove or deactivate the temporary users after validation.

- [ ] As an administrator, open Invite Users from the avatar menu and confirm every active Project is listed with its picture on the left and label on the right.
- [ ] As a non-administrator, confirm the Project checklist contains only Projects where the current user is a member.
- [ ] Select no Projects, choose Generate Invite URL, and confirm PMT requires at least one Project without creating an invitation.
- [ ] Select one or more Projects, generate the invitation, and confirm the dialog displays the URL and its expiration.
- [ ] Confirm Copy URL is disabled before generation, enabled afterward, and copies the exact displayed URL.
- [ ] Open the copied URL in a signed-out or private browser window and confirm the minimal profile screen appears before Login.
- [ ] Confirm the profile asks for Nickname, Password, Confirm Password, and Avatar, with no Email field.
- [ ] Submit without selecting or uploading an avatar and confirm PMT requires one.
- [ ] Select each generic-avatar style in turn and confirm the selected state and preview remain clear in both themes.
- [ ] Upload an image and confirm its preview appears before submission and replaces any selected generic avatar.
- [ ] Complete an invitation for exactly one Project that already has a Sprint and confirm PMT opens Sprints with that Project selected.
- [ ] Complete an invitation for exactly one Project with no Sprints and confirm PMT opens Projects.
- [ ] Complete an invitation containing multiple Projects and confirm PMT opens Projects.
- [ ] Log out as the invited user, then log back in with the new Nickname and Password.
- [ ] Reopen the same valid invitation URL and confirm it can create another user until its 30-day expiration.
- [ ] Confirm an expired, malformed, or otherwise unavailable invitation cannot create a user.
- [ ] Confirm the new user is a non-admin Developer and is a member of every Project included in the invitation, with no unrelated Project memberships.

## Navigation

Open every screen from the top navigation or its overflow menu:

- [ ] Dashboard
- [ ] Road Map
- [ ] Gantt
- [ ] Kanban Board
- [ ] Projects
- [ ] Sprints
- [ ] Dev Tasks
- [ ] Bug Tracking
- [ ] Scrum
- [ ] Documentation
- [ ] Backlog
- [ ] WFH Schedule
- [ ] Settings from the avatar menu

At laptop width:

- [ ] The last navigation items move into `More navigation` when needed.
- [ ] Overflow menu icons and labels remain usable.
- [ ] No navigation text overlaps or leaves the viewport.

## Theme

- [ ] Switch to Light Theme and confirm the change is immediate.
- [ ] Refresh and confirm Light Theme is retained without a dark flash.
- [ ] Check cards, tables, dialogs, dropdowns, charts, Gantt, and Road Map.
- [ ] Switch back to Dark Theme, refresh, and confirm it is retained.

## Required fields and stable form alignment

- [ ] Open New Project and confirm Code, Title, and Members show the shared red asterisk while optional fields such as Start do not. Repeat with one rich-text or checklist requirement and confirm the marker remains on the existing label line without moving controls.
- [ ] Open New User, compare Username with the Role control beside it, then trigger a long username availability message. Confirm both labels and controls keep the same top alignment and no neighboring field shifts.
- [ ] Open invitation registration and confirm Username, Password, Confirm Password, and the overall Avatar choice show the same required treatment without implying that a generic avatar is the only valid choice.

## Representative CRUD

Use clearly named temporary records and remove them after validation.

### Save collisions

Use two signed-in browser profiles, A and B, that can edit the same disposable record.

- [ ] Open the same Dev Task in both profiles. Save a title change in A, then save B's older draft. Confirm B receives the Save Collision message, A's newer title remains in the database, and Cancel leaves B's editor and draft open.
- [ ] Repeat and choose Save as New in B. Confirm a new Dev Task receives a different ID/code and preserves B's draft without changing A's record.
- [ ] Repeat the stale-save rejection for a Bug, Sprint, Documentation item, Scrum entry, and Personal Log entry. Confirm Save as New is offered only when the current user has Create permission.
- [ ] For a stale Project, choose Save as New and confirm the editor switches to New Project, preserves the draft, clears/focuses Code, and requires a different unique Code before creating it.
- [ ] Confirm stale User, Lookup/Role, Holiday, WFH, vacation, and Security saves are rejected without offering an invalid duplicate.
- [ ] Confirm a stale Board move and read-only rich-text checkbox save do not overwrite the newer row. Confirm an import collision is not silently converted into a new item unless Save as New is explicitly chosen.
- [ ] In two browsers, reorder the same Dev Task/Backlog list from A and then submit B's older order. Confirm B receives Save Collision and A's newer order remains. Repeat for WFH ordering; no Save as New option should be offered.
- [ ] Move a Board card to another status and position in one drag. Confirm the status and order both save without a false Save Collision, then refresh and confirm both persist.
- [ ] Open the same unfinished Sprint in two browsers. Finish it in A, then submit B's older Finish dialog. Confirm B receives Save Collision, only one successor Sprint exists, and the carry-forward operation is not repeated.
- [ ] In parallel sessions, create a Sprint while finishing another Sprint in the same Project. Confirm both complete with distinct Sprint codes. Duplicate a Task while another Task save is in progress and confirm both complete without a duplicate code or deadlock.
- [ ] In parallel sessions, convert a Task to Documentation while moving or deleting Documentation. Confirm the operations either complete in sequence or return their normal business error, never a deadlock; refresh and confirm Task/Documentation links are consistent.
- [ ] Open a Project editor, accept a pending invitation to that Project in another browser, then save the older Project draft. Confirm the stale save is rejected and the newly accepted member remains assigned.
- [ ] Open a Security resource editor, create or reactivate a Role in another browser, then save the older Security draft. Confirm the stale save is rejected and the new Role's default permissions remain intact.

### Project and Sprint

- [ ] Create a temporary Project with members.
- [ ] Confirm its requested Project code is saved exactly after uppercase/space normalization and is never replaced with a random code.
- [ ] Edit its title/description and verify the update.
- [ ] Archive a disposable Project, then try to reuse its code. As a non-admin, confirm the save is rejected without an override. As an admin, cancel the reclaim warning and confirm neither Project changes; repeat and continue, then confirm the active Project receives the requested code while the archived Project and its related data remain preserved.
- [ ] As an admin, confirm a code held by another active Project is rejected and cannot be reclaimed.
- [ ] Open the Project and confirm Sprints are filtered to it.
- [ ] Create and edit a temporary Sprint with members and dates.
- [ ] Delete the temporary Sprint and confirm its tasks are unscheduled.
- [ ] Delete the temporary Project.

### Dev Task and Bug

- [ ] Create a Dev Task and confirm the dialog initially focuses Title.
- [ ] Verify attachments appear above Assignees.
- [ ] Verify Assignees show avatars and the list can scroll.
- [ ] Add/edit assignment, status, percent, dates, dependency, and description.
- [ ] Confirm Dev Task and Bug rows do not begin dragging from links, buttons, or empty row space.
- [ ] Hover a reorderable Dev Task and Bug row, confirm the drag handle appears after Edit without shifting the row, then reorder from that handle.
- [ ] Open the task in read-only mode, then select Edit.
- [ ] Open its audit dialog and confirm newest entries appear first.
- [ ] Create a Bug with reporter, assignee, severity, environment, and steps.
- [ ] Confirm assigning the Bug creates/updates a linked Bug Fix Dev Task.
- [ ] Verify the linked-Bug completion guard prevents premature 100%.
- [ ] Delete the temporary Bug and Dev Task records.

### Scrum and Documentation

- [ ] Verify Scrum Project, Person, and Date filters work alone and in combination.
- [ ] Confirm the Attendance dropdown shows an icon and each exact label: Home, Office, Sick Leave, Vacation, EL, and Other. Hover EL/status indicators and confirm the tooltip expands EL to Emergency Leave.
- [ ] Check in as the current user and confirm the user's avatar appears immediately after the Scrum title without overlapping another avatar, with the selected status icon on its lower-left corner.
- [ ] Select a title avatar and confirm the Scrum table shows only that person's entries. Open Scrum Filters and confirm exactly the same Person checkbox is selected. Change the Person checklist and confirm the title-avatar selection updates in the same render cycle.
- [ ] Open the Scrum overflow menu and confirm Graphs is absent while Calendar, On Behalf Of..., and Vacation... are present with icons and labels.
- [ ] Enable Calendar and confirm it renders above the existing Scrum table without covering it. Confirm the seven-day grid remains readable and may use contained horizontal scrolling instead of compressing cells.
- [ ] Navigate backward and forward, then select a month and year directly. Confirm the requested month and day numbers are correct, including a leap-year February, and the Scrum table remains below the calendar.
- [ ] Seed or record Office and Home attendance on one date. Confirm Office renders first with larger avatars, Home renders below it, and a faint divider separates the sections.
- [ ] Add Sick Leave, Vacation, EL, and Other attendance and confirm each nonempty section has its status icon in the upper-left and sections remain in Office, Home, Sick Leave, Vacation, EL, Other order.
- [ ] Confirm a date where everyone is Office has one section and no divider. Confirm the same person may appear once in Office and once in Sick Leave or EL on an exceptional multi-status date, but repeating the same status does not duplicate the avatar.
- [ ] Configure two active Holidays on one date and one inactive Holiday. Confirm both active names appear when the cell has space, their full names remain available by tooltip/accessibility text, and the inactive Holiday is absent.
- [ ] Choose On Behalf Of..., select another active person and a status, save, and confirm today's title status and calendar update for that person while the current user remains the recorded actor.
- [ ] Choose Vacation..., create an inclusive start/end range, and confirm the current user appears as Vacation on every covered calendar date, including future months.
- [ ] Reopen Vacation..., edit both dates, and confirm removed dates clear while newly covered dates display the user. Cancel the plan with the themed confirmation dialog and confirm it disappears without a browser alert or prompt.
- [ ] As another user and as an administrator, attempt direct update/cancel requests for someone else's vacation and confirm both are rejected. Confirm an inactive person and an unsupported attendance status are rejected by the attendance endpoint.
- [ ] Refresh PMT and repeat the current and adjacent month checks to confirm attendance and vacation data persist.
- [ ] Create a Scrum entry and verify the three-question starter text/caret.
- [ ] Duplicate it and confirm the duplicate date defaults to today.
- [ ] Edit and delete the temporary Scrum entries.
- [ ] As a non-admin with Scrum Update but no Delete, enter Edit Mode and confirm Edit appears only on that user's Scrum entries and Delete appears on none of the rows.
- [ ] As that non-admin, edit an owned Scrum entry and confirm Pinned is enabled, then pin and unpin the entry successfully. Confirm another user's Scrum remains read-only and private Personal Log pinning remains disabled.
- [ ] Grant the same user Scrum Delete and confirm Delete appears only on that user's Scrum entries; direct update/delete requests for another user's Scrum entry must be rejected.
- [ ] As an administrator, confirm shared Scrum entries from another user can be edited and deleted.
- [ ] In Log, confirm a user sees only their own private entries. Repeat as an administrator and confirm other users' private Log entries remain absent and cannot be updated or deleted through direct requests.
- [ ] Create Documentation with a Project, rich text, list, link, and image/attachment.
- [ ] Mark Documentation private, sign in as a different administrator, and confirm the document is absent from Cards, Treeview, filters, About, direct Documentation URLs, exports, attachment/history data, and audit views.
- [ ] As that administrator, confirm guessed direct update, delete, parent, conversion, add-attachment, and delete-attachment requests for the private document are rejected. Sign back in as its creator and confirm those permitted actions still work.
- [ ] In an RTE, open an image menu and choose Select; confirm eight resize handles appear, stay inside the visible editor viewport and below the sticky RTE toolbar while scrolling, keep the image proportional and anchored at its upper-left when dragged from a corner or midpoint, disappear when clicking outside, and preserve the saved size after reopening.
- [ ] Open it and confirm read-only mode is the default.
- [ ] Edit it and confirm Created and Last Edited dates display correctly.
- [ ] Confirm links open in a new tab.
- [ ] Delete the temporary Documentation.

### WFH Schedule

- [ ] Confirm users are sorted by Nickname by default.
- [ ] Toggle M T W T F buttons for a user, refresh, and confirm the saved days persist.
- [ ] Drag users into a custom order, refresh, and confirm the order persists.
- [ ] Immediately toggle a WFH day after reordering and confirm it saves without a false Save Collision; refresh and confirm the change persists.
- [ ] With a newly added active user who has no WFH row yet, open WFH Schedule in two browser profiles at the same time. Confirm both loads succeed and the user appears once.
- [ ] Delete a user from the WFH list, then use Show Deleted to confirm the user is hidden but still recoverable.
- [ ] Use Reset and confirm all users return, all WFH days clear, and Nickname sorting is restored.

### Settings

- [ ] Open Status, Priority, Severity, and Environment categories.
- [ ] Open Users, Roles, Security, Navigation, Holidays, and Development categories.
- [ ] Create/edit/deactivate a temporary lookup or Holiday as an admin.
- [ ] In Security, confirm inherited user rows initially match their Role's effective checkboxes and Reset is disabled.
- [ ] Change one inherited user checkbox, confirm the Break Inheritance explanation, and verify the Effective column updates immediately after continuing.
- [ ] Cancel a second Break Inheritance prompt and confirm the inherited checkbox remains unchanged.
- [ ] Save an explicit override, refresh, and confirm it persists; then Reset, save, and confirm Role inheritance returns.
- [ ] Open Security Audit and confirm every active user/resource pair reflects effective rights, Resource is left-aligned, granted rights use visible green check graphics, and the No Access header and disabled checkboxes are centered; then export and open the Excel workbook.
- [ ] Create a temporary Role-permission change and user override, click Reset Security, cancel the warning, and confirm nothing changes. Repeat and continue; confirm all Role permissions return to their initial defaults across every resource and every per-user override is removed.
- [ ] After Reset Security, confirm Developer has all Dev Task rights while QA has only Read and Export for Dev Tasks.
- [ ] Confirm non-admin controls are disabled or rejected where applicable.
- [ ] As an administrator, open Maintenance and confirm every accessible archived Project and deleted Sprint, task, public Documentation item, and Scrum entry is selected by default; only private Documentation/Logs owned by that administrator may appear.
- [ ] Select one deleted item, request permanent deletion, inspect the exact server-generated preview, cancel, and confirm no database rows change.
- [ ] Preview an archived Project and confirm its Sprints, tasks, public Documentation, and Scrum entries are marked as cascade items. Confirm every private Documentation/Log survives and is detached, another owner's private rows never appear, and an owner-visible private row reveals no owner, title, Project, or content metadata.
- [ ] Confirm permanent deletion refuses a stale or changed preview rather than deleting a different set of rows.
- [ ] Permanently delete disposable data and confirm its Project/Sprint/task codes can be reused, surviving cross-record links are cleared, and a shared attachment remains linked to its surviving item.
- [ ] Create one referenced and one unreferenced disposable upload, scan for orphan files, and confirm only the unreferenced file is offered. Add a database reference after preview and confirm the final recheck skips that file.
- [ ] Click an orphaned filename and confirm it opens through the Maintenance preview endpoint in a new tab without changing its selected-for-deletion state. Confirm raster images render, SVG/HTML/XML and unknown extensions open as plain text instead of returning 404, and scripted content cannot execute or navigate under the PMT origin.
- [ ] In Settings > Development, confirm Clear PMT and Clear All Except PMT preserve and detach private Documentation/Logs. Confirm Clear Users and Restore Initial Seed Data refuse to run while another user owns private content.
- [ ] Permanently delete the disposable PMT seed Project, click Restore PMT Seed Data, and confirm PMT returns while LMS, HLS, users, permissions, holidays, and detached private content remain unchanged. Confirm `PMT About 3D Visualization and Flyby` returns under `PMT Current Demo Readiness` with its image, summary, and three-item control list. Confirm a second restore attempt is refused while code `PMT` exists.
- [ ] As a non-admin, confirm recycle-bin, preview/purge, upload scan, and upload-reference recheck requests are rejected.
- [ ] Do not run destructive Development reset actions unless specifically testing them.

## About and inactivity screen saver

- [ ] On the About 2D intro, confirm the credits and database version sit above the Preparing 3D Gallery panel and disappear once the 3D scene starts.
- [ ] During Sequence 6, confirm the camera passes left-of-center through the `M`/`T` opening without the right side of the view appearing to strike the `M`.
- [ ] Leave a logged-in, visible, focused PMT tab untouched for five minutes on a non-About screen. Confirm the About flyby opens over the existing content at the same size as the normal About page.
- [ ] Repeat with an editor open and an unsaved field value. Move the mouse once and confirm the screen saver closes while the same screen, URL, editor, focus, and unsaved value remain intact.
- [ ] Hide or blur PMT before five minutes and confirm the screen saver does not start until a fresh five-minute foreground idle period completes.

## Filters and charts

- [ ] With Dev Task preferences cleared, confirm the current or latest past Sprint is selected by default.
- [ ] Dev Tasks filters work for Project, Sprint, Status, Priority, Assigned, sort, and Hide Completed.
- [ ] Dev Task filter and chart toggle states work.
- [ ] All four Dev Task chart cards render and chart drilldown opens records.
- [ ] Bug Tracking filters work, including multi-select Reporter and Assignee.
- [ ] Bug filter and chart toggle states work.
- [ ] Bug charts render, expand, and drill down to records.
- [ ] Kanban Board filter toggle shows and hides Project, Sprint, Sort, empty-column, and Column controls.
- [ ] Documentation Project filter works, including All Projects.
- [ ] Sprints Project filter and expand/collapse controls work.
- [ ] Dashboard/Sprint/Project charts hide zero-value categories.

## Kanban Board and ordering

- [ ] With Board preferences cleared, confirm empty columns are hidden by default.
- [ ] Project, Sprint, and Sort controls fit on one row at normal laptop width.
- [ ] Navigate away from the Board and return; confirm the last Project, Sprint, and Sort are restored and empty columns auto-hide again.
- [ ] Drag a card to a different status column and verify status persistence.
- [ ] Reorder at least three cards in one column through multiple consecutive drags.
- [ ] Confirm the above/below drop indicator matches the final order.
- [ ] Toggle empty columns off and on.
- [ ] Reorder at least three items in Dev Tasks, Bug Tracking, and Backlog.
- [ ] Refresh and confirm manual order persists.

## Gantt

- [ ] With Gantt preferences cleared, confirm Start date descending is the default sort.
- [ ] Switch among PMT, LMS, and HLS.
- [ ] Verify the current Sprint is selected by Reset View.
- [ ] Verify selected-only and all-Sprints modes remain synchronized.
- [ ] Select a Sprint in all-Sprints mode and confirm horizontal and vertical scrolling reaches it.
- [ ] Toggle weekends/holidays.
- [ ] Start, pause, resume, and reset fly-by.
- [ ] In both Start date descending and ascending sorts, mousewheel over the Gantt viewport animates one Sprint at a time in the expected physical scroll direction.
- [ ] Click a Dev Task and a Bug in Gantt and confirm each opens read-only details without leaving the Gantt view.
- [ ] Expand a Bug during fly-by and confirm the viewport does not jump.
- [ ] Confirm the chart scrolls inside its fixed-height container.
- [ ] Confirm month/day labels do not overlap.

## Road Map

- [ ] With Road Map preferences cleared, confirm Sprints are collapsed by default.
- [ ] Projects and Sprints render with dates and progress.
- [ ] Project and Sprint links navigate with the expected filters.
- [ ] Toggle Sprint visibility.
- [ ] Toggle date details and avatar/percent details.
- [ ] Exercise Project/Sprint filters and each sort direction.
- [ ] Confirm month labels are readable and not clipped.
- [ ] Confirm long HLS data does not require unreasonable empty horizontal scrolling.
- [ ] Confirm Project tooltips include name, percent, start date, and end date.

## Dialog and responsive checks

- [ ] Main Save and Cancel buttons include icon and text.
- [ ] Secondary dialog actions use icons appropriately.
- [ ] First useful field receives focus when a dialog opens.
- [ ] Dialog content scrolls without moving controls off-screen.
- [ ] Custom confirmation/text dialogs match the active theme.
- [ ] No built-in browser alert or prompt appears.
- [ ] At `1366 x 768`, no text, controls, charts, cards, or tables overlap incoherently.
- [ ] Repeat key navigation, theme, dialog, Board, Gantt, and Road Map checks at `1920 x 1080`.

## Final checks

- [ ] Browser Console has no uncaught errors.
- [ ] Network requests used during the test have no unexpected failures.
- [ ] Refresh the browser and confirm persisted filters/theme/navigation remain valid.
- [ ] `npm.cmd run check:js` succeeds.
- [ ] `npm.cmd run test:js` succeeds.
- [ ] `npm.cmd run test:browser` succeeds.
- [ ] `git diff --check` succeeds.
- [ ] Confirm `test-results/`, `playwright-report/`, `bin/`, `obj/`, and `node_modules/` are not included in the working tree.
- [ ] Record any skipped destructive checks and the reason.
