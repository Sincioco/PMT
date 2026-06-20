# Codex Task: Update PMT Light Theme Dev Tasks UI Using “PMT Reference 1”

## Goal

Update PMT’s **Light Theme** Dev Tasks screen so it visually follows **PMT Reference 1**.

**PMT Reference 1** means the latest generated Dev Tasks reference image from this conversation: a clean light-theme PMT Dev Tasks page with:

- PMT logo and “Software Engineering” brand area on the left.
- Top navigation buttons on the same row as the user avatar.
- Active `Dev Tasks` navigation button.
- No visible `WFH Schedule` or `Settings` top-nav buttons.
- A final rounded overflow navigation button using a `...` / more icon.
- Large `Dev Tasks` page heading.
- Right-aligned `Show Filters`, `Show Charts`, and primary `New Dev Task` controls.
- A large rounded white Dev Tasks table/card.
- Polished avatars, task links, sub-task badges, priority pills, progress bars, and action icon buttons.
- Sub-task rows 2, 3, and 4 visually subordinate to the first row by indenting **only the Dev Task column** by about **20px**.

Use this as a **design guide**, not a request to hard-code the exact sample rows or image data.

## Reference Images

Use the attached/generated image if Codex supports image attachments.

Recommended repo-local paths if you want to store the references:

```text
docs/design/pmt-reference-1-dev-tasks-light.png
docs/design/current-pmt-dev-tasks-before.png
```

Markdown image reference:

```md
![PMT Reference 1 - Light Theme Dev Tasks](docs/design/pmt-reference-1-dev-tasks-light.png)
```

If the image is not in the repo, use the attached image named **PMT Reference 1** as the source of truth.

## Repo Context

Follow the repo’s existing rules:

- Keep implementation simple and traceable.
- Use native JavaScript ES modules, HTML, and CSS.
- Do not add a frontend framework, TypeScript, bundler, or new dependency.
- Preserve endpoint URLs, JSON payloads, localStorage keys, screen behavior, routing, and existing data contracts.
- Light and dark themes must use the same markup and component CSS. Theme-specific visual changes should be made through semantic CSS tokens where practical.
- Avoid inline styles except CSS custom-property values or calculated geometry that is already part of the current pattern.
- Do not make hover/focus/pressed states move, resize, scale, or shift controls, rows, cards, or buttons.
- Do not use gradients unless the existing design already requires one locally.

## Important Implementation Boundary

This task is **not** a rewrite.

Do not rebuild PMT’s shell or Dev Tasks feature from scratch. Improve the existing implementation using the current architecture and existing components.

Target likely areas:

```text
wwwroot/css/themes.css
wwwroot/css/layout.css
wwwroot/css/features/tasks.css
wwwroot/js/core/application-shell.js
wwwroot/js/core/navigation-preferences.js
wwwroot/js/features/tasks/tasks.js
wwwroot/js/components/buttons.js
wwwroot/js/components/progress-and-status.js
wwwroot/js/components/work-items.js
wwwroot/index.html
```

Only change JavaScript when styling cannot be achieved cleanly through CSS or existing classes.

## Visual Design Target

### Overall Light Theme

Make the light theme feel like PMT Reference 1:

- Page background: very light cool gray / blue-gray.
- Surfaces: clean white cards/panels.
- Borders: thin, low-contrast cool gray borders.
- Shadows: soft, subtle, modern SaaS shadows.
- Typography: dark navy/charcoal primary text, muted blue-gray secondary text.
- Buttons: rounded, clean, border-based neutral buttons; one strong blue primary button.
- Components should look airy, polished, and professional without becoming too sparse.

Suggested light-theme direction:

```css
html[data-theme="light"] {
  --color-page: #f6faff;
  --color-page-muted: #eef4fb;
  --color-surface: #ffffff;
  --color-surface-raised: #ffffff;
  --color-surface-elevated: #ffffff;

  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-tertiary: #64748b;

  --color-border-subtle: rgba(15, 23, 42, 0.08);
  --color-border: rgba(15, 23, 42, 0.12);
  --color-border-control: rgba(15, 23, 42, 0.14);

  --color-control: #ffffff;
  --color-control-hover: #f8fbff;
  --color-control-active: #eff6ff;
  --color-control-selected: #eaf2ff;

  --color-primary: #126bff;
  --color-primary-hover: #0b5ee8;
  --color-primary-active: #064fc4;
  --color-primary-contrast: #ffffff;

  --shadow-compact: 0 4px 14px rgba(15, 23, 42, 0.06);
  --shadow-card: 0 10px 30px rgba(15, 23, 42, 0.08);
  --shadow-elevated: 0 18px 44px rgba(15, 23, 42, 0.12);
}
```

Use these as starting values. Adjust only as needed to fit the existing token contract and contrast requirements.

### Top Navigation

Update the light-theme navigation to match PMT Reference 1:

- PMT brand area remains at far left.
- Nav buttons are compact rounded rectangles/chips with icon + label.
- `Dev Tasks` is active:
  - light blue selected background,
  - blue text/icon,
  - blue underline or bottom accent,
  - no layout shift.
- Avatar sits on the **same horizontal row** as the navigation buttons, at the far right.
- Do **not** show `WFH Schedule` or `Settings` as regular top-level buttons.
- Keep a final rounded overflow button as the last nav button, using an overflow icon like `...`.
- Do not delete the WFH Schedule or Settings screens/routes. Keep them accessible through the existing overflow/menu/user settings flow as appropriate.

Important: if current saved navigation preferences in localStorage still show removed top-level nav items, handle this gracefully without breaking navigation. Prefer changing the default visible top-level navigation and overflow behavior rather than deleting screens.

### Dev Tasks Page Header

The page header should match PMT Reference 1:

- Large `Dev Tasks` title on the left.
- Right-aligned action toolbar:
  - `Show Filters`
  - `Show Charts`
  - `+ New Dev Task`
- `New Dev Task` is the primary button:
  - saturated PMT blue,
  - white text,
  - rounded corners,
  - subtle primary shadow.
- `Show Filters` and `Show Charts` are neutral buttons:
  - white surface,
  - subtle border,
  - dark navy text,
  - icon + label.
- Keep current actions and behavior unchanged.

### Dev Tasks Table/Card

Style the Dev Tasks table as a large rounded white card:

- Rounded outer card around the whole table.
- Thin border.
- Soft shadow.
- White row backgrounds.
- Subtle row separators.
- No heavy striping.
- Header row:
  - uppercase small text,
  - muted blue-gray,
  - medium/bold weight,
  - consistent column alignment.
- Rows:
  - comfortable height similar to PMT Reference 1,
  - avatars vertically centered,
  - text aligned cleanly,
  - no accidental row/column shifting on hover.

Suggested table/card CSS direction:

```css
.tasks-table {
  min-width: 1180px;
  border-collapse: separate;
  border-spacing: 0;
}

.table-wrap,
.tasks-table-wrap,
.table-card,
.tasks-table-shell {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
```

Use the actual existing wrapper selector names. Do not invent a duplicate wrapper if one already exists.

### Dev Task Column

Style task IDs like PMT Reference 1:

- `PMT-TASK-020`, etc. should look like clean blue links.
- Description text should be dark, readable, and smaller/secondary compared with the task ID.
- Keep actual click behavior unchanged.

### Sub-task Rows

Rows 2, 3, and 4 are sub-tasks of the first row.

Use the existing hierarchy data/classes. Do not hard-code row numbers. Any task with `row.level > 0` should render as a subordinate row.

Requirements:

- Indent **only** the Dev Task column content.
- Do not move the avatar column.
- Do not move Project, Sprint, Status, Priority, Done, or action buttons.
- Use about **20px** indentation, not 24px, for level-1 sub-tasks.
- Keep nested levels scalable if already supported, but level 1 should be visually 20px.
- Keep the `SUB-TASK` pill.
- Do not use a strong gray sub-task row background. In PMT Reference 1, hierarchy is communicated mainly by the Dev Task column indent and the `SUB-TASK` badge.

Likely CSS adjustment:

```css
.subtask-row td {
  background: var(--color-surface);
}

.subtask-title-cell {
  --indent: 20px;
  padding-left: calc(var(--table-cell-padding-inline) + var(--indent)) !important;
}
```

If the current JS sets `--indent` dynamically, update the level-1 value to 20px, for example:

```js
const indent = Math.min(row.level, 4) * 20;
```

Do not add margin to the row, the avatar cell, or the table itself.

### Priority Pill

`Low` should look like PMT Reference 1:

- small rounded pill,
- green text,
- soft green background,
- subtle green border,
- compact but readable.

Use the semantic success tokens where possible.

### Progress Bars

Match the slim progress bars in PMT Reference 1:

- Full or 80–100% items: green bar.
- 31–79% items: amber/orange bar.
- 0–30% items: danger red only when applicable.
- Empty/Todo: light gray track with little/no fill.
- Track should be subtle and thin.
- Bars should not be overly tall or visually heavy.

Do not change the completion calculation or save behavior.

### Action Buttons

Right-side row action buttons should match PMT Reference 1:

- Small rounded-square buttons.
- Subtle border.
- White background.
- Centered icon.
- Stable hover/focus states.
- Delete remains visually destructive/red.
- View/edit/copy/audit actions remain visually neutral.
- Buttons must keep accessible titles/labels.
- No row shifting when hovering.

### Charts Toggle

Keep `Show Charts` behavior. This task is primarily about the Dev Tasks list view.

If charts are shown, they should continue to use the existing chart system and theme tokens, but do not redesign chart content in this pass unless needed for light-theme consistency.

## Data and Behavior Rules

Do not hard-code the sample rows from the image.

The table must continue rendering live PMT data from the existing state/API.

Keep existing features working:

- Project filter.
- Sprint filter.
- Status/Priority/Assigned filters.
- Hide completed.
- Sort order.
- Show/Hide filters.
- Show/Hide charts.
- New Dev Task.
- Edit task.
- Duplicate task.
- Delete task.
- Audit/read-only details.
- Drag/reorder behavior.
- Parent/sub-task hierarchy.
- Bug-fix linked task behavior.
- Theme persistence.
- Navigation persistence.

## Responsive Requirements

Verify at:

- `1366 x 768`
- `1920 x 1080`

At laptop width:

- Navigation labels must not overlap.
- Items that do not fit should move into overflow.
- Avatar remains on the top-nav row.
- Dev Tasks table may horizontally scroll if needed, but it must not break the page layout.
- Toolbar buttons may wrap only if necessary, without overlapping.

## Accessibility Requirements

- Preserve keyboard access.
- Preserve `aria-current` on the active nav item.
- Overflow nav button must expose correct expanded/collapsed state.
- Icon-only row action buttons must keep accessible names/titles.
- Focus states must be visible.
- Color must not be the only cue for status/progress/action meaning.
- Maintain readable contrast in Light Theme.

## Suggested Work Plan for Codex

1. Run:

```powershell
git status --short
```

2. Read:

```text
AGENTS.md
wwwroot/AGENTS.md
docs/ui-design-system.md
docs/manual-smoke-test.md
```

3. Inspect current implementation:

```text
wwwroot/js/core/application-shell.js
wwwroot/js/core/navigation-preferences.js
wwwroot/js/features/tasks/tasks.js
wwwroot/css/themes.css
wwwroot/css/layout.css
wwwroot/css/features/tasks.css
wwwroot/css/components/*.css
```

4. Update Light Theme tokens in `wwwroot/css/themes.css` only as needed to make PMT Reference 1 achievable.

5. Update shared layout/navigation CSS in `wwwroot/css/layout.css` only if the top nav needs refinement.

6. Update `wwwroot/css/features/tasks.css` for Dev Tasks-specific table/card styling.

7. Touch `wwwroot/js/features/tasks/tasks.js` only if:
   - existing markup lacks the needed classes,
   - sub-task indentation is currently hard-coded to the wrong value,
   - or the table wrapper needs an existing class applied.

8. Touch `wwwroot/js/core/application-shell.js` or `wwwroot/js/core/navigation-preferences.js` only if needed for:
   - avatar alignment,
   - nav overflow behavior,
   - hiding WFH Schedule / Settings from top-level navigation while preserving access.

9. Do not change backend, SQL, DTOs, stored procedures, API payloads, or database contracts for this UI task.

## Acceptance Criteria

The update is complete when all of this is true:

- Light Theme Dev Tasks visually matches PMT Reference 1 closely.
- The screen still uses real PMT data.
- Dev Tasks is the active navigation item.
- Avatar is on the same horizontal row as the navigation buttons.
- WFH Schedule and Settings are not visible as regular top-level nav buttons.
- The final nav button is a rounded overflow button.
- `Show Filters`, `Show Charts`, and `New Dev Task` keep their current behavior.
- The Dev Tasks list appears inside a polished white rounded card with subtle border and shadow.
- Row action buttons look like small rounded-square icon buttons.
- Priority `Low` appears as a green pill.
- Progress bars are slim and use success/warning/danger semantic colors.
- Sub-task rows indent only the Dev Task column by about 20px.
- The avatar column and all other table columns remain aligned with parent rows.
- No hover/focus/pressed state causes layout movement.
- Dark Theme is not broken.
- No console errors are introduced.

## Verification

Run at minimum:

```powershell
dotnet restore
dotnet build
npm.cmd run check:js
npm.cmd run test:js
npm.cmd run test:browser
git diff --check
```

Then manually verify:

```text
1. Start PMT.
2. Open http://localhost:5056.
3. Switch to Light Theme.
4. Open Dev Tasks.
5. Compare the page to PMT Reference 1.
6. Confirm filters, chart toggle, new task, edit, duplicate, delete, audit/view, and drag/reorder still work.
7. Refresh the browser and confirm Light Theme and navigation state persist.
8. Check the same screen at 1366x768 and 1920x1080.
```

## Output Requested From Codex

After implementation, summarize:

- Files changed.
- What changed in Light Theme tokens.
- What changed in Dev Tasks table styling.
- What changed in top navigation.
- Any tests run and their results.
- Any intentional deviations from PMT Reference 1 and why.
