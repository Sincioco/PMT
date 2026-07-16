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
- [ ] In browser storage, confirm login created a `PMT.Auth` cookie marked HttpOnly and SameSite Strict, no `pmt-auth-user` value remains, and API requests do not send `X-PMT-UserId`. In a production HTTPS deployment, also confirm the cookie is Secure.
- [ ] Confirm the avatar menu opens and contains Invite Users, Settings, theme, password, and Log Out.
- [ ] Open Change Password, validate the fields/dialog, and cancel without changing the seed password.
- [ ] Refresh the page and confirm the signed-in session and selected view are restored from the cookie. Delete `PMT.Auth`, refresh again, and confirm PMT fails closed to the Login screen rather than selecting a default user.
- [ ] While signed in as a non-administrator, send a state request with a forged `X-PMT-UserId` header and current-user query value for the administrator. Confirm the response remains in the non-administrator's cookie identity and does not expose administrator access.
- [ ] Log in as an administrator, choose distinctive theme/navigation/filter preferences, and set a disposable non-PMT `localStorage` value for comparison.
- [ ] In Settings > Users, select Impersonate on another active user's card, confirm the prompt, and continue. Confirm PMT reloads with that user's avatar, visible screens, permissions, and private-data boundary rather than retaining administrator access.
- [ ] Confirm a large red banner with white `Impersonating {user}` text remains visible without overlap, and Exit Impersonation stays on its right at both supported viewport sizes.
- [ ] Change theme/navigation/filter preferences while impersonating, hard refresh, and confirm the same impersonated user and banner remain active while those temporary preferences survive the refresh.
- [ ] Choose Exit Impersonation and confirm PMT reloads as the original administrator, restores the administrator's exact PMT preferences, discards the impersonated preference changes, and leaves the non-PMT `localStorage` value unchanged.
- [ ] As a non-administrator, confirm User cards have no usable Impersonate action and a direct impersonation-start request is rejected. Also confirm an administrator cannot impersonate themselves, an inactive user, or start a second impersonation while one is active.
- [ ] While impersonating in one browser, deactivate or remove the administrator role from the original administrator in another authorized session. Confirm the impersonated browser's next request is signed out instead of retaining the old target/admin context.
- [ ] From a different browser origin, attempt a changing `/api` form/fetch request while the PMT cookie exists. Confirm PMT returns HTTP 403, while a same-origin write and a non-browser request with no browser-origin headers continue to work.
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
- [ ] Release Notes
- [ ] About from More navigation
- [ ] Settings from the avatar menu

At laptop width:

- [ ] The last navigation items move into `More navigation` when needed.
- [ ] Overflow menu icons and labels remain usable.
- [ ] No navigation text overlaps or leaves the viewport.

## Release Notes and What's New

- [ ] Clear PMT browser preferences, log in, and confirm What's New shows only Days 29, 28, and 27 in a left navigation list with Day 29 selected.
- [ ] Select each entry and confirm the business-formatted heading, sections, and bullet lists change without moving or resizing the dialog.
- [ ] Choose `click here` in the footer and confirm the dialog closes, `#/release-notes` opens, and the latest release is at the top of the 27 available historical releases. Confirm no invented Day 10 or Day 11 entries appear because those source prompts do not exist.
- [ ] Toggle between Release Notes and Sin's AI Prompts. Confirm the active underline is stable and the original prompt retains its line breaks and content.
- [ ] Scroll a long Release Note and a long original prompt. Confirm the Release Notes page title and both view buttons stay visible at the top, and the release-history panel begins level with the reader instead of above the content area.
- [ ] Set `pmt-release-notes-last-seen:{userId}` to `2026-07-14-day-27`, log in again, and confirm What's New shows only Days 29 and 28.
- [ ] Close What's New, log in again, and confirm it does not reopen when there are no later releases. Refresh an existing signed-in session and confirm normal cookie-session restoration also does not open it.
- [ ] After marking the latest release seen, make an authorized same-day summary change, regenerate, and deploy the generated files. Confirm a fresh login or restored session checks immediately. Also leave another browser signed in without refreshing; within one minute confirm its already-open Release Notes content updates and only the revised current-day What's New note appears. Close it, wait through another check or refresh, and confirm it stays closed.
- [ ] Repeat at `1366 x 768` and `1920 x 1080`; confirm the release navigation and reader scroll independently where needed and neither view creates horizontal page overflow.
- [ ] Run `npm.cmd run check:release-notes` and confirm the curated summaries, source prompts, browser module, JSON feed, and version manifest are synchronized.
- [ ] Open Day 29 in both Release Notes and What's New and locate its `@Sin` reference. Hover it and then reach it by keyboard; confirm the matching compact User Card appears without moving content. In a rich-text record, also verify `@{Invited User}` for a nickname containing a space and confirm an unknown `@Nobody` remains plain text.

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
- [ ] Add a Sprint plus Dev, Bug, backlog, finished, and deleted work items, then rename the Project code. Confirm every associated code uses the new Project prefix while preserving its existing suffix; unrelated Projects remain unchanged.
- [ ] Save only the Project title or members and confirm child codes and row versions do not change. Leave one child editor open during a later Project-code rename and confirm its stale save receives Save Collision.
- [ ] Edit its title/description and verify the update.
- [ ] Archive a disposable Project, then try to reuse its code. As a non-admin, confirm the save is rejected without an override. As an admin, cancel the reclaim warning and confirm neither Project changes; repeat and continue, then confirm the active Project receives the requested code while the archived Project receives an internal code and all Sprint/work-item prefixes in both Project trees match their owning Project.
- [ ] As an admin, confirm a code held by another active Project is rejected and cannot be reclaimed.
- [ ] Open the Project and confirm Sprints are filtered to it.
- [ ] Confirm the Sprints header Project, Sprint, and Search controls stay synchronized with Sprint Filters, use the same three-second compact/restore treatment, and preserve the selected values and the Search box's center/right origin while it contains text. Enter Edit Mode, select multiple Sprints, and bulk-delete them with one confirmation.
- [ ] Create and edit a temporary Sprint with members and dates.
- [ ] Delete the temporary Sprint and confirm its tasks are unscheduled.
- [ ] Delete the temporary Project.

### Dev Task and Bug

- [ ] Create a Dev Task and confirm the dialog initially focuses Title.
- [ ] Confirm the Dev Tasks header Project, Sprint, and Search controls stay synchronized with the Filter dialog in both directions and filter the same rows.
- [ ] Leave the Dev Tasks header untouched for three seconds and confirm Project/Sprint become muted labels while an empty Search slides into a search icon immediately before New Dev Task without moving the title, buttons, charts, or table. Confirm a nonempty Search stays expanded in its center/right origin while Project/Sprint compact, then move the pointer into the header and confirm the controls return without moving Search.
- [ ] Enter Dev Tasks Edit Mode, confirm each delete-capable row has a checkbox immediately before its trash icon, select multiple rows, and confirm clicking a checked row's trash deletes only the selected rows after one confirmation.
- [ ] Repeat the synchronized Project/Sprint/Search, three-second muted-label/search-icon transition, persistent nonempty Search origin, pointer restore, and Edit Mode bulk-delete checks in Bug Tracking and Backlog. In Backlog, include a selected parent and direct child and confirm one parent delete removes both without a duplicate request.
- [ ] Repeat the same header, 500ms Search quiet-time, and bulk-delete checks in Kanban Board. Select a Dev Task and Bug together, confirm each checkbox is immediately before its trash icon, and confirm the existing Dev Task/Bug delete permissions still control each card.
- [ ] Verify attachments appear above Assignees.
- [ ] Verify Assignees show avatars and the list can scroll.
- [ ] Add/edit assignment, status, percent, dates, dependency, and description.
- [ ] Confirm Dev Task and Bug rows do not begin dragging from links, buttons, or empty row space.
- [ ] Hover a reorderable Dev Task and Bug row, confirm the drag handle appears after Edit without shifting the row, then reorder from that handle.
- [ ] Open the task in read-only mode and confirm the URL contains the item route. Close it with the button and with Escape in separate checks, and confirm the URL returns to the Dev Tasks screen route. Reopen it, then select Edit.
- [ ] Open its audit dialog and confirm newest entries appear first.
- [ ] Create a Bug with reporter, assignee, severity, environment, and steps.
- [ ] Rename a Severity lookup to include a numeric prefix such as `1 - Critical`; confirm severity capsules display `Critical` on one line and show `1 - Critical` in their tooltip.
- [ ] Confirm assigning the Bug creates/updates a linked Bug Fix Dev Task.
- [ ] Give the Bug a URL before assigning it. Confirm the linked Bug Fix Dev Task receives that exact URL; change the Bug URL and confirm a later Bug save updates the Dev Task URL. Change the Dev Task URL and confirm the Bug URL does not change.
- [ ] Enter Root Cause Analysis on the linked Bug Fix Dev Task and save. Confirm the associated Bug now contains exactly that value, with no appended `<hr>` content.
- [ ] Replace and then clear the Dev Task Root Cause Analysis. After each save, confirm the associated Bug is replaced and then cleared too.
- [ ] Enter Root Cause Analysis directly on the Bug and save. Confirm the linked Dev Task Root Cause Analysis does not change.
- [ ] Verify the linked-Bug completion guard prevents premature 100%.
- [ ] Delete the temporary Bug and Dev Task records.

### Scrum and Documentation

- [ ] Verify Scrum Project, Person, and Date filters work alone and in combination.
- [ ] Confirm the Attendance dropdown defaults to Office and shows an icon and each exact label: Home, Office, Sick Leave, Vacation, EL, and Other. Change the selection, leave and return to Scrum, then refresh and confirm the choice remains. Use Reset View and confirm Office returns. Hover EL/status indicators and confirm the tooltip expands EL to Emergency Leave.
- [ ] Open Scrum while attendance is still loading and note the header and table positions. Confirm the first attendance result does not move the title, controls, or table; each title avatar is 80 by 80 pixels, does not overlap another avatar, and is visually centered in the title band with a clearly visible status icon on its lower-left corner.
- [ ] At both desktop widths, confirm the Scrum page title begins at the same vertical position as the Dev Tasks title. Confirm the Table/Calendar control is centered at the same relative height and uses the same icon/text sizing as Cards/Treeview in Documentation. Add enough known-status avatars to approach that control and confirm the avatars shrink together to fit between the page title and view buttons without overlap or header movement.
- [ ] Confirm Sick Leave uses the face-with-thermometer icon rather than a plus sign, and that its tooltip remains `Sick Leave`.
- [ ] Select a title avatar and confirm the Scrum table shows only that person's entries. Open Scrum Filters and confirm exactly the same Person checkbox is selected. Change the Person checklist and confirm the title-avatar selection updates in the same render cycle.
- [ ] Confirm the header has `Table` and `Calendar` view buttons with the same active underline and pressed-state treatment as the Documentation view buttons. Open the Scrum overflow menu and confirm Graphs and Calendar are absent while On Behalf Of... and Vacation... remain present with icons and labels.
- [ ] Select Calendar and confirm only the calendar is inserted above the existing Scrum table: the title, avatars, view buttons, and other header controls must not move. Select Table and confirm the calendar is removed while the Scrum table remains visible. Confirm the seven-day grid remains readable and may use contained horizontal scrolling instead of compressing cells.
- [ ] Navigate backward and forward, then select a month and year directly. Confirm the requested month and day numbers are correct, including a leap-year February, and the Scrum table remains below the calendar.
- [ ] In a second signed-in browser session, add or edit a Scrum entry and record attendance. With Scrum visible in the first session, confirm the Table row and today's title avatar update within five seconds without a document reload, flicker, header/table movement, changed filters, lost focus, closed overflow menu, or changed application/table scroll position.
- [ ] Switch the first session to Calendar and add attendance or a vacation covering its visible month from the second session. Confirm the calendar and title avatar update within five seconds while Calendar mode and calendar scroll remain unchanged. Disable Auto Refresh in the overflow menu and confirm neither Table nor Calendar refreshes, the setting survives leaving and returning to Scrum, and the default returns to enabled after clearing PMT preferences.
- [ ] With Auto Refresh enabled, leave an attendance selection unsaved, focus another Scrum form control, open a Scrum/dialog editor, and drag a column across separate cycles. Confirm refresh pauses during each interaction, never overlaps another cycle, and resumes after the interaction is complete without discarding input.
- [ ] Seed or record Office and Home attendance on one date. Confirm Office renders first with larger avatars, Home renders below it, and a faint divider separates the sections.
- [ ] Add Sick Leave, Vacation, EL, and Other attendance and confirm each nonempty section has its status icon in the upper-left and sections remain in Office, Home, Sick Leave, Vacation, EL, Other order.
- [ ] Confirm a date where everyone is Office has one section and no divider. Confirm the same person may appear once in Office and once in Sick Leave or EL on an exceptional multi-status date, but repeating the same status does not duplicate the avatar.
- [ ] Configure two active Holidays on one date and one inactive Holiday. Confirm both active names appear when the cell has space, their full names remain available by tooltip/accessibility text, and the inactive Holiday is absent.
- [ ] Choose On Behalf Of..., select another active person, status, and a date other than today, then save. Confirm the avatar appears on the selected calendar date, today's title status does not change, and the current user remains the recorded actor. Submit a direct self Check-In request containing another date and confirm SQL still records it on the current UTC+8 workday.
- [ ] Click an explicit attendance avatar in Calendar and confirm a small menu offers exactly Remove and Cancel. Confirm Cancel, Escape, and clicking outside close it without changing data. Remove an owned entry and confirm only that attendance row disappears, an `Attendance / Removed` audit event remains, and a user with Scrum Update can remove another user's explicit entry while a user lacking the required Create/Update right is rejected by a direct request.
- [ ] Choose Vacation..., create an inclusive start/end range, and confirm the current user appears as Vacation on every covered calendar date, including future months.
- [ ] Reopen Vacation..., edit both dates, and confirm removed dates clear while newly covered dates display the user. Cancel the plan with the themed confirmation dialog and confirm it disappears without a browser alert or prompt. Recreate it, click one of its Calendar avatars, and confirm Remove cancels the entire underlying range rather than only the selected day.
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
- [ ] Confirm Documentation Project, Sprint, and Search stay synchronized with Documentation Filters in Cards and Treeview, use the same three-second compact/restore and persistent nonempty Search treatment, and preserve the chosen view. Enter Edit Mode and bulk-delete multiple accessible documents from checkboxes immediately before their trash icons.
- [ ] In Documentation, a Dev Task, Bug Tracking, Scrum, Log, and Backlog rich text, enter a known `@Nickname`, an explicit `@{Nickname With Spaces}`, and an unknown mention. Reopen each in read-only mode and confirm only known active users become focusable User Card mentions; edit mode and stored HTML remain unchanged.
- [ ] Confirm a normally created Documentation item remains private by default; the public-seed rule must not change user-created privacy.
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
- [ ] As an administrator, open Users, Roles, Security, Audit Trail, Maintenance, Navigation, Holidays, and Development categories.
- [ ] In Users, confirm each card shows the most recent successful login or `Never` for a user who has not logged in. Log in as a disposable user, return as an administrator, and confirm only that user's timestamp advances; refreshing a restored session or impersonating the user must not change it.
- [ ] Give a user a non-Admin Role/title and enable Admin. Confirm the card keeps that Role/title and appends ` (Admin)`; edit and save again and confirm the Role/title is not replaced by `Admin`.
- [ ] Create/edit/deactivate a temporary lookup or Holiday as an admin.
- [ ] In Security, confirm inherited user rows initially match their Role's effective checkboxes and Reset is disabled.
- [ ] Change one inherited user checkbox, confirm the Break Inheritance explanation, and verify the Effective column updates immediately after continuing.
- [ ] Cancel a second Break Inheritance prompt and confirm the inherited checkbox remains unchanged.
- [ ] Save an explicit override, refresh, and confirm it persists; then Reset, save, and confirm Role inheritance returns.
- [ ] Open Security Audit and confirm every active user/resource pair reflects effective rights, Resource is left-aligned, granted rights use visible green check graphics, and the No Access header and disabled checkboxes are centered; then export and open the Excel workbook.
- [ ] Open Audit Trail and confirm it is a read-only table ordered newest first with When, Performed By, Acting As, Action, Record, and Details columns; use Refresh and confirm the latest event appears.
- [ ] After the impersonation checks above, confirm Audit Trail contains Started and Ended Impersonation rows with the administrator under Performed By and the target under Acting As.
- [ ] During a fresh impersonation, make one disposable edit that the target is permitted to save, exit, and confirm its audit row names the administrator under Performed By and the target under Acting As.
- [ ] With another user owning private Documentation and a private Personal Log, confirm their Audit Trail details are shown only as opaque private-activity labels and do not reveal titles or content.
- [ ] As a non-administrator, and again while an administrator is impersonating a non-administrator, confirm Audit Trail is absent, `#/settings/audit-trail` falls back to an allowed Settings category, and a direct `/api/audit-trail` request is rejected.
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
- [ ] In Settings > Development, confirm Clear PMT Demo deletes only `PMT`, while Clear All Projects Except PMT deletes `PMTQA` and every other non-PMT Project. Confirm both Project cleanup paths preserve private Documentation and private Logs by detaching them from deleted Projects.
- [ ] Click Clear PMT Demo and then Restore PMT Seed Data. Confirm the original PMT demo returns while PMTQA, other Projects, BDO users, permissions, holidays, and detached private content remain unchanged. Delete or deactivate one demo identity before restoring and confirm it is recreated or reactivated with its original profile and without the public `Password1` password. Confirm all restored PMT seed Documentation is public and `PMT About 3D Visualization and Flyby` returns under `PMT Current Demo Readiness` with its image, summary, and three-item control list. Confirm a second restore attempt is refused while code `PMT` exists.
- [ ] On a disposable database with another user's private Documentation, private Log, per-user permission override, and audit event, run Clear Users. Confirm the action does not refuse the private rows, only Sin remains, private ownership and audit actor/effective-user references are remapped to Sin, obsolete per-user permissions are removed, and all constraints remain valid.
- [ ] On a disposable database, create private and public data, run Factory Reset PMT, and confirm all prior data including private content is deleted before the original PMT, LMS, and HLS demos are reseeded. Confirm all 15 seed Documentation rows are public and the database has no foreign-key violations.
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
- [ ] As a Developer, move a Dev Task to `Ready for QA` (QA Ready) and then `QA Passed`; confirm both moves save. Attempt to move it to each later deployment status and confirm PMT rejects the move and leaves the task at `QA Passed`.
- [ ] Repeat a later deployment-status move as an administrator or release-role user and confirm it is allowed.
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
