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

- [ ] Log in as `Sin` with `Password1`.
- [ ] Confirm the avatar menu opens and contains Settings, theme, password, and Log Out.
- [ ] Open Change Password, validate the fields/dialog, and cancel without changing the seed password.
- [ ] Log out and confirm the Login screen returns.
- [ ] Log in again and confirm the selected view loads.

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
- [ ] Edit its title/description and verify the update.
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
- [ ] Create Documentation with a Project, rich text, list, link, and image/attachment.
- [ ] Open it and confirm read-only mode is the default.
- [ ] Edit it and confirm Created and Last Edited dates display correctly.
- [ ] Confirm links open in a new tab.
- [ ] Delete the temporary Documentation.

### Settings

- [ ] Open Status, Priority, Severity, and Environment categories.
- [ ] Open Users, Holidays, and Development categories.
- [ ] Create/edit/deactivate a temporary lookup or Holiday as an admin.
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
- [ ] Documentation Project filter works, including All Projects.
- [ ] Sprints Project filter and expand/collapse controls work.
- [ ] Dashboard/Sprint/Project charts hide zero-value categories.

## Kanban Board and ordering

- [ ] With Board preferences cleared, confirm empty columns are hidden by default.
- [ ] Project, Sprint, and Sort controls fit on one row at normal laptop width.
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
