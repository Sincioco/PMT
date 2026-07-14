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

## Representative CRUD

Use clearly named temporary records and remove them after validation.

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
- [ ] Create a Scrum entry and verify the three-question starter text/caret.
- [ ] Duplicate it and confirm the duplicate date defaults to today.
- [ ] Edit and delete the temporary Scrum entries.
- [ ] As a non-admin with Scrum Update but no Delete, enter Edit Mode and confirm Edit appears only on that user's Scrum entries and Delete appears on none of the rows.
- [ ] Grant the same user Scrum Delete and confirm Delete appears only on that user's Scrum entries; direct update/delete requests for another user's Scrum entry must be rejected.
- [ ] As an administrator, confirm shared Scrum entries from another user can be edited and deleted.
- [ ] In Log, confirm a user sees only their own private entries. Repeat as an administrator and confirm other users' private Log entries remain absent and cannot be updated or deleted through direct requests.
- [ ] Create Documentation with a Project, rich text, list, link, and image/attachment.
- [ ] In an RTE, open an image menu and choose Select; confirm eight resize handles appear, dragging a corner or midpoint keeps the image proportional and anchored at its upper-left, clicking outside removes the handles, and the saved size remains after reopening.
- [ ] Open it and confirm read-only mode is the default.
- [ ] Edit it and confirm Created and Last Edited dates display correctly.
- [ ] Confirm links open in a new tab.
- [ ] Delete the temporary Documentation.

### WFH Schedule

- [ ] Confirm users are sorted by Nickname by default.
- [ ] Toggle M T W T F buttons for a user, refresh, and confirm the saved days persist.
- [ ] Drag users into a custom order, refresh, and confirm the order persists.
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
- [ ] Do not run destructive Development reset actions unless specifically testing them.

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
