# PMT Paper Design

Paper Design is PMT's final authority for UI and UX behavior. It supersedes conflicting guidance in `docs/ui-design-system.md`, older requirements, examples, screenshots, comments, and existing implementation patterns.

When guidance is missing or ambiguous, follow this document. When a new requirement is explicitly described as a Paper Design rule, principle, or behavior, update this file as part of the same change.

## Core principles

1. **Quiet controls, clear content.** The interface should resemble information and controls arranged on paper: restrained, readable, and free of unnecessary visual weight.
2. **Hierarchy comes from typography, spacing, alignment, and borders.** Do not depend on saturated button fills, gradients, heavy shadows, or decorative color to establish structure.
3. **One design in both themes.** Light and dark modes use the same markup, dimensions, behavior, and interaction rules. Theme tokens may change color values, but not the Paper Design contract.
4. **Monochrome controls are the default.** Page-level icons, dialog controls, and row actions use simple monochrome marks unless color communicates actual data or semantic status.
5. **Interaction must remain spatially stable.** Hover, active, selected, focus, and disabled states must not move, resize, scale, or shift controls or surrounding content.
6. **Use shared rules for universal behavior.** A universal Paper Design rule belongs in shared component CSS or shared rendering code, not duplicated feature overrides.

## Buttons and icon controls

- Ordinary PMT buttons have transparent backgrounds in both light and dark themes.
- The `primary` class may identify the main action semantically, but it must not create a blue, teal, or otherwise filled background.
- Hover, active, selected, and disabled states must not add a filled button background.
- Button identity and state should be communicated through text, monochrome icons, borders, and accessible labels.
- Danger actions may use danger-colored text and borders, but not a filled danger background.
- Ordinary control buttons should not use accent shadows.
- Icon-only controls preserve the shared minimum touch target even when the visible icon is smaller.
- Page-level and row-action icons should use a consistent visual size. The current reference is an 18-pixel icon within the shared 40-pixel touch target.
- Icon-only actions are borderless at rest. A border may appear on hover without changing the control's dimensions.
- Chart marks that are implemented as buttons may keep their chart-series fill because their color represents data rather than ordinary button chrome.

## Dialogs

- Dialog surfaces remain opaque and readable in both themes.
- While any modal dialog is open, the background page is scroll-locked.
- Mouse-wheel, trackpad, and touch scrolling belong only to the active dialog. Reaching the top or bottom of dialog content must not chain scrolling to the page behind it.
- Dialog titles use the same secondary text color as PMT page titles.
- An existing Dev Task view or edit dialog uses the title format `{Task Code} - {Task Title}`.
- The upper-right close control uses a large, simple monochrome `x`, matching the visual scale of page-level icons.
- The upper-right close control is transparent and borderless at rest.
- Its border appears only on pointer hover.
- The upper-right close control must never display a focus outline, blue focus ring, or focus halo.
- The close control still requires an accessible name, and dialogs must continue to support their established Close and Escape behavior.
- Dialog action buttons follow the transparent-button rules.

## Checkboxes

- Checkbox labels use two layout columns: the checkbox in the first column and all associated content in the second.
- A checkbox is vertically centered against the complete content block that follows it.
- If the content includes an avatar or another image, checkbox alignment is calculated against the image-plus-label block rather than the first text line.
- If label text wraps, continuation lines align beneath the first word of the label, never beneath the checkbox.
- Checkbox and label spacing must remain consistent across filter lists, editor checklists, inline checks, and avatar checklists.
- Checkbox alignment and wrapping are universal PMT behavior, not feature-specific styling.

## Filters and forms

- Related controls use equal-width columns and balanced outer and middle spacing.
- Two-column dialog layouts use `minmax(0, 1fr)` columns so controls can fill their column without intrinsic-width overflow.
- Paired editor controls use a generous center gutter; the Dev Task editor uses twice the standard compact form gap between its left and right columns.
- A paired checkbox may occupy the second column beside a select control when the relationship is clear.
- Repeated checkbox options should use an orderly grid and wrap into subsequent rows.
- Filter group legends use normal title casing rather than forced uppercase.
- User filters render the avatar between the checkbox and the person's name.
- Date and calendar inputs use the same standard control height as text inputs and selects.
- Rich-text formatting controls follow the icon-button rules: monochrome, transparent, borderless at rest, and bordered on hover.
- Dev Task assignee choices use a balanced three-column layout on wide screens and collapse to one column on compact screens.
- Dev Task editor Assignee and Dependencies checklists use the same checkbox spacing, typography, borders, surface, and centered checkbox/content alignment as the Dev Task Filter dialog.
- Dev Task chart subtitles expose the selected context using `{Project Code} - {Sprint}` with one space on each side of the dash.
- When all Dev Task projects and all Sprints are selected, the chart context reads `All Projects and All Sprints`.

## Tables and edit modes

- Dev Task row actions use monochrome icons, transparent backgrounds, and no resting border. The border appears on hover.
- Destructive and audit icons must not rely on colored emoji artwork.
- When Dev Task table Edit Mode is active, an editable row is the drag target.
- The cursor changes to `grab` over a draggable row and `grabbing` during the gesture.
- Interactive controls inside the row remain clickable and do not start a drag.
- A separate reorder handle is not shown when the whole row already provides the reorder gesture.
- Whole-row reordering is available only during explicit Edit Mode.

## Color and content exceptions

- Hyperlinks use the theme's blue link color so interactive text is visually distinct from ordinary content.
- Hyperlinks do not display an underline at rest. The underline appears on pointer hover.
- Hover may also use the theme's brighter link-hover color, but it must not shift surrounding content.
- Text that resembles default hyperlink blue is reserved for content that is actually hyperlinkable.
- Non-link identifiers such as Project codes and work-item codes use the normal Paper Design text hierarchy, not hyperlink-like blue.
- Statuses, charts, progress, warnings, errors, and other data-bearing visuals may use semantic or categorical color.
- Color used for data must retain a text label, tooltip, legend, icon, pattern, or accessible summary.
- Data-color exceptions do not permit filled backgrounds on ordinary control buttons.

## Conflict resolution and maintenance

Apply UI guidance in this order:

1. The latest explicit user requirement identified as Paper Design.
2. This `docs/paper-design.md` document.
3. `docs/ui-design-system.md`.
4. Other PMT documentation, historical requirements, examples, or existing code.

If two rules conflict, the higher item in this list wins. Do not preserve an older pattern merely because it already exists.

Whenever a new Paper Design rule is introduced:

1. implement the requested behavior;
2. update this document in the same change;
3. place universal behavior in shared components where practical;
4. update `docs/ui-design-system.md` only when its subordinate guidance would otherwise conflict.
