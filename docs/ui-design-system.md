# PMT UI Design System

This document defines PMT's reusable light and dark semantic tokens and supporting component guidance.

## Paper Design authority

[`paper-design.md`](paper-design.md) is the final authority for PMT UI and UX behavior. It supersedes any conflicting principle, example, recommendation, or historical statement in this document or other PMT documentation.

When this document is silent or ambiguous, follow `paper-design.md`. When a new rule is explicitly identified as Paper Design, update `paper-design.md` as part of the same change. The principles below remain useful only where they do not conflict with Paper Design.

## Design principles

1. **Meaning before color.** Token names describe purpose (`--color-text-secondary`, `--color-danger`) rather than a theme-specific value.
2. **One contract, two themes.** Light and dark themes use identical markup, component selectors, spacing, typography, and behavior. Only semantic theme values change.
3. **Dense, not cramped.** PMT is a working tool for information-heavy screens. Controls and tables should fit a 1366x768 laptop while remaining readable and keyboard accessible.
4. **Hierarchy without noise.** Page, surface, raised, elevated, and glass levels should be visually distinct without stacking strong borders and shadows everywhere.
5. **State is explicit.** Default, hover, active, selected, focus, disabled, validation, loading, and semantic feedback states must be distinguishable in both themes.
6. **Color supports meaning.** Statuses, charts, warnings, and errors always have text, icons, patterns, or accessible summaries. Color is never the only cue.
7. **Motion helps orientation.** Use short, subtle transitions for state changes. Respect reduced-motion preferences and avoid decorative motion in data-heavy views.
8. **Interaction is spatially stable.** Hover, focus, selected, and pressed states may change color, border color, shadow, or outline, but must not move, resize, scale, or shift the element or surrounding layout.
9. **Solid colors are the default.** Do not use gradients unless a more local requirement explicitly requests one.
10. **Completion colors are consistent.** Completion or success rates from 0-30% use danger red, 31-79% use warning yellow, and 80-100% use success green unless a more local domain rule overrides the mapping.

## Token ownership

- `wwwroot/css/tokens.css` defines the shared contract, typography, spacing, shape, density, motion, layout values, and compatibility aliases.
- `wwwroot/css/themes.css` supplies the complete semantic color, surface, shadow, chart, and status values for both themes.
- Shared and feature styles consume semantic tokens. They must not redefine the theme.
- Existing short names such as `--bg`, `--surface`, `--text`, `--teal`, and `--shadow` remain compatibility aliases during screen-by-screen adoption.
- New styles should use the expanded semantic names directly.

## Semantic token contract

### Page and surfaces

| Token | Purpose |
| --- | --- |
| `--color-page` | Application canvas and final fallback background |
| `--color-page-muted` | Quiet page regions and bounded secondary canvases |
| `--color-page-glow-primary`, `--color-page-glow-secondary` | Low-contrast decorative page atmosphere |
| `--color-surface` | Opaque default content surface |
| `--color-surface-subtle` | Low-emphasis inset or hover surface |
| `--color-surface-raised` | Menus, sticky content, and raised controls |
| `--color-surface-elevated` | Highest non-modal surface |
| `--color-surface-glass` | Explicitly approved translucent showcase surface |
| `--color-surface-glass-highlight` | Subtle glass highlight, never body text |
| `--color-surface-navigation` | Sticky application navigation |
| `--color-surface-dialog` | Dialog surface with enough opacity for long text |
| `--color-overlay` | Modal backdrop |

Surface order is:

`page -> surface -> raised -> elevated -> dialog`

Glass is a treatment, not an additional elevation level. Application cards, panels, menus, and dialogs use opaque surfaces by default. A permitted glass surface still needs a clear border and a readable fallback color.

### Text hierarchy

| Token | Purpose |
| --- | --- |
| `--color-text-primary` | Headings, values, and primary body copy |
| `--color-text-secondary` | Labels, descriptions, metadata, and table headers |
| `--color-text-tertiary` | Captions and low-priority metadata; do not use for essential body copy |
| `--color-text-inverse` | Text on a dark or saturated non-primary surface |
| `--color-text-disabled` | Disabled labels and values |
| `--color-link`, `--color-link-hover` | Inline and standalone links |

Use primary text for information required to complete a task. Secondary text may carry supporting information. Tertiary text must remain optional.

### Actions and feedback

Each action or feedback family has a stable role:

| Family | Core token | Supporting tokens |
| --- | --- | --- |
| Primary | `--color-primary` | `-hover`, `-active`, `-contrast` |
| Secondary | `--color-secondary` | `-hover`, `-active`, `-contrast` |
| Success | `--color-success` | `-surface`, `-border`, `-text` |
| Warning | `--color-warning` | `-surface`, `-border`, `-text` |
| Danger | `--color-danger` | `-surface`, `-border`, `-text` |
| Information | `--color-info` | `-surface`, `-border`, `-text` |

Primary identifies the main action in a local context semantically. Under Paper Design, primary, secondary, danger, selected, and disabled control buttons remain unfilled. Use text, icons, and borders to communicate their role.

Feedback colors do not imply work-item status. Work-item status uses lookup colors or the status palette.

Completion and success-rate visuals use this default threshold mapping:

- 0-30%: `--color-danger`
- 31-79%: `--color-warning`
- 80-100%: `--color-success`

These thresholds apply to quantitative completion or success rates. Named workflow statuses continue to use their configured lookup colors.

### Borders, controls, and focus

| Token | Purpose |
| --- | --- |
| `--color-border-subtle` | Separators inside a shared surface |
| `--color-border` | Default cards, rows, and regions |
| `--color-border-strong` | Hovered, selected, and elevated boundaries |
| `--color-border-control` | Inputs and neutral controls |
| `--color-control` | Default control background |
| `--color-control-hover` | Pointer hover background |
| `--color-control-active` | Pressed or active background |
| `--color-control-disabled` | Disabled control background |
| `--color-control-selected` | Selected neutral control background |
| `--color-focus-ring` | High-contrast two-pixel focus outline |
| `--color-focus-halo` | Supporting outer focus halo |
| `--shadow-focus` | Shared focus halo shadow |

Focus must normally be visible on buttons, links, form controls, selectable cards, table actions, chart actions, navigation, and dialog controls. The universal Paper Design exception is the upper-right dialog close control, which never displays a focus outline or halo.

### Shadows

| Token | Purpose |
| --- | --- |
| `--shadow-card` | Default card separation |
| `--shadow-compact` | Small cards, timeline headers, and dense nested surfaces |
| `--shadow-accent` | Primary controls and branded accents |
| `--shadow-floating-mark` | Avatars and compact chart marks floating over a surface |
| `--shadow-elevated` | Menus, sticky overlays, and emphasized panels |
| `--shadow-dialog` | Modal dialogs |
| `--shadow-inset-highlight`, `--shadow-divider` | One-pixel internal highlights and separators |

Do not combine a strong shadow, strong border, and saturated background unless the element is a modal or critical feedback state.

### Chart colors

`--chart-1` through `--chart-8` provide an ordered categorical palette. The order is stable between themes even though values differ for contrast.

Additional chart tokens:

- `--color-chart-gridline`
- `--color-chart-axis`
- `--color-chart-tooltip`
- `--color-chart-tooltip-border`
- `--color-chart-mark-text`
- `--color-chart-mark-outline`

Chart rules:

- Keep the same category-to-token assignment within a chart and its legend.
- Label values directly or provide a nearby legend and accessible summary.
- Do not use color alone to distinguish interactive and non-interactive marks.
- Zero-value categories may be omitted when the existing screen behavior permits it.
- Use status colors for status charts; use the categorical palette for unrelated series.

### Status-color integration

- Runtime lookup colors remain authoritative when a Status lookup supplies `colorHex`.
- `--status-1` through `--status-11` are the theme-aware fallback sequence matching the existing ordered status behavior.
- `--color-status-mix` is the surface-mixing color for readable timeline and status fills.
- Status chips and bars need a text label, tooltip, legend, or adjacent count.
- A status color may fill a small indicator. Text placed on the color requires a verified foreground color or an opaque label treatment.

### Typography

| Token group | Values and use |
| --- | --- |
| Families | `--font-family-sans`; `--font-family-mono` for code or technical identifiers |
| Sizes | `--font-size-xs` through `--font-size-3xl` |
| Weights | `--font-weight-regular`, `--font-weight-medium`, `--font-weight-bold` |
| Line heights | `--line-height-tight`, `--line-height-heading`, `--line-height-body` |

Recommended mapping:

- Page title: `--font-size-3xl`, bold, tight line height.
- Section title: `--font-size-2xl` or `--font-size-xl`, bold.
- Card title: `--font-size-lg` or `--font-size-xl`, bold.
- Body: `--font-size-base`, body line height.
- Label and table content: `--font-size-md`.
- Caption and uppercase table header: `--font-size-xs` or `--font-size-sm`.

Avoid using font size alone to express hierarchy. Pair it with weight, spacing, and semantic HTML.

### Spacing, radii, and control size

- Spacing uses `--space-1` through `--space-12`, from 4px to 48px.
- Default component gaps should use 8px, 12px, 14px, or 16px tokens.
- Cards and dialogs generally use `--radius-md` or `--radius-lg`.
- Small nested controls may use `--radius-sm`.
- Pills, statuses, and progress tracks use `--radius-pill`.
- Standard controls use `--control-height-md` (40px).
- Compact secondary controls may use `--control-height-sm` (32px).
- Important or touch-oriented controls may use `--control-height-lg` (44px).
- Icon-only controls must preserve at least `--touch-target-min` even if the icon is smaller.

### Motion

| Token | Use |
| --- | --- |
| `--duration-fast` | Hover, focus, press, and simple color changes |
| `--duration-normal` | Menus, small reveals, and bounded state transitions |
| `--duration-slow` | Large but nonessential transitions |
| `--ease-standard` | Default UI state changes |
| `--ease-emphasized` | Deliberate spatial transitions |
| `--transition-control` | Shared non-spatial control-state transition |

Shared interaction transitions cover color, border color, and shadow—not transforms or layout dimensions. When `prefers-reduced-motion: reduce` is active, the duration tokens become zero. Functional scrolling and direct manipulation must still work.

## Component principles and examples

### Buttons

- Ordinary buttons remain transparent in both themes, including buttons carrying the `primary`, `secondary`, or `danger` class.
- One action may remain semantically primary within a local group, but it is not represented by a filled accent background.
- Neutral is the default for Cancel, Close, filters, and low-emphasis utilities.
- Danger requires a clear destructive label and may use danger text or borders; use confirmation when the action is not easily reversible.
- Icon-only buttons require an accessible name.
- Disabled buttons remain legible and visually unavailable; they must not rely on opacity alone in new component work.
- Hover, active, and focus states must be independently visible.
- Button interaction states must not translate, scale, resize, or change font metrics.
- Icon-only actions are monochrome and borderless at rest; a border may appear on hover.
- Data-bearing chart marks implemented as buttons may retain chart fill colors.

Example:

```html
<div class="dialog-actions">
  <button class="secondary" type="button">Cancel</button>
  <button class="primary" type="submit">Save changes</button>
</div>
```

### Cards and panels

- Cards group one entity, metric, or compact action area.
- Panels group a larger screen region.
- Cards and panels use the opaque `--color-surface` default; feature styles should not need to disable blur.
- Use a single default border and shadow. Strengthen the border for interactive hover/focus rather than increasing layout size.
- Clickable cards must be keyboard reachable and expose their action semantics.
- Avoid glass behind dense tables or long documentation text.
- Card hover and focus may strengthen color, border, outline, or shadow without translating or resizing the card.

### Tables and lists

- Keep headers short, left aligned by default, and visually secondary.
- Preserve current horizontal scrolling for data that cannot fit without becoming unreadable.
- Row hover may improve tracking, but actions must remain keyboard reachable.
- Selection, drag targets, reorder positions, and validation must use more than a background-color change.
- Use the table density tokens before adding one-off padding values.

### Forms

- Every control has a visible label. Placeholder text is not a label.
- Use the standard control height and border tokens.
- Select controls use the shared theme-aware SVG chevron, reserve right-side padding around it, and apply the active document color scheme to the native option popup before it opens.
- Validation places a message next to the field and sets the relevant accessible state.
- Disabled fields use disabled background and text tokens.
- Required, invalid, read-only, and disabled are different states and must look different.
- Required create/edit fields use the shared red asterisk after the visible label without changing the field's layout or height.
- Form layouts may use two columns on wide viewports and one column at or below 900px.
- Checkbox labels use separate checkbox and content columns. Wrapped text aligns beneath the first word, and the checkbox is vertically centered against the complete content block, including avatars.

### Dialogs

- Use a raised, sufficiently opaque surface with `--shadow-dialog`.
- Give the dialog an accessible title and sensible initial focus.
- Keep focus within the active modal, support Escape/Close, and restore focus to the opener.
- Scroll the dialog body while keeping the title and actions visible when practical.
- Place the primary action last in left-to-right action rows.
- Do not use browser `alert`, `confirm`, or `prompt`.
- The upper-right close control is a large monochrome `x`, transparent and borderless at rest, with a border only on hover.
- The upper-right close control never displays a focus outline or halo; this is the explicit exception to the general focus-indicator rule.

### Navigation

- The current screen needs a persistent text-and-color selected state.
- Top navigation may use a glass surface because content scrolls beneath it.
- Overflow menus use a raised or elevated surface, never page transparency alone.
- Navigation labels must not overlap at 1366x768; move items to overflow before compressing them beyond readability.

### Charts

- Use `--chart-1` through `--chart-8` for categorical series and status tokens for status series.
- Chart tooltips use the chart tooltip surface and border tokens.
- Interactive marks need hover and keyboard behavior where the chart technology supports it.
- Provide text labels, a legend, a table, or an equivalent summary.
- Maintain readable minimum widths and contained scrolling rather than collapsing labels.

## Density and responsiveness

Viewport targets:

- Primary laptop: 1366x768.
- Primary desktop: 1920x1080.
- Existing compact breakpoint: widths at and below 900px.
- Narrow safety target for the showcase and basic shell: 320px.
- Automated browser smoke tests exercise the primary laptop and desktop viewport targets in Chromium.

Density rules:

- Default page padding is `--shell-padding-laptop`; compact layouts use `--shell-padding-compact`.
- Use `--panel-gap` between peer cards and panels.
- Table cells use the shared block and inline padding tokens.
- Controls in the same toolbar use one height unless a documented exception exists.
- Do not reduce body text below `--font-size-md` to make a layout fit.
- Board, Gantt, Road Map, wide tables, and large dialogs may scroll horizontally or within a bounded region.
- At or below 900px, multi-column forms and detail grids become one column.
- Preserve important action order when wrapping toolbars.

## Accessibility and contrast

- Target WCAG 2.1 AA: at least 4.5:1 for normal text and 3:1 for large text, graphical objects, focus indicators, and meaningful control boundaries.
- Verify primary and secondary text against page, default surface, raised surface, and dialog backgrounds in both themes.
- Tertiary text is for nonessential metadata only and must still remain readable.
- Button text and icons require approved contrast against the underlying surface. Paper Design buttons do not use filled primary backgrounds.
- Focus normally uses both `--color-focus-ring` and `--color-focus-halo` so it remains visible against page and surface backgrounds. The upper-right dialog close control follows the Paper Design no-focus-indicator exception.
- Status and chart colors require labels or accessible summaries.
- All actions must be keyboard reachable.
- Use semantic HTML and associated labels.
- Keep `aria-expanded`, `aria-pressed`, `aria-current`, selected state, invalid state, and live feedback accurate.
- Images need meaningful alternative text unless decorative.
- Respect reduced motion.
- Do not introduce hover-only functionality.

## Glassmorphism constraints

Glass is allowed for:

- top navigation;
- small showcase or marketing-like summary regions explicitly designed for it.

Glass is not appropriate for:

- table cells;
- application cards and panels;
- menus and dropdowns;
- dialogs;
- long-form Documentation content;
- nested surfaces where the background becomes visually noisy;
- error, warning, or success states that need immediate clarity;
- any surface whose text contrast depends on unknown content behind it.

Every glass surface must have:

- a semantic fallback background;
- a visible border;
- controlled blur using `--glass-blur` or `--glass-blur-dialog`;
- readable text without depending on blur support;
- no more than one nested translucent level.

## CSS ownership and loading order

`wwwroot/index.html` loads stylesheets in this deterministic order:

1. `css/tokens.css`
2. `css/themes.css`
3. `css/base.css`
4. `css/layout.css`
5. shared component stylesheets
6. feature stylesheets

Ownership rules:

- `tokens.css` defines the contract and theme-independent scales.
- `themes.css` defines both theme values for the same semantic color contract.
- `base.css` owns document-wide element defaults.
- `layout.css` owns shared page and shell composition.
- Component stylesheets own reusable UI selectors named by that file.
- Feature stylesheets own screen-specific composition and screen-only selectors.
- Do not duplicate selectors between stylesheets or use CSS `@import`.
- Avoid inline styles except calculated geometry or CSS custom-property values such as progress, chart, status, and timeline positions.

## Current audit and adoption boundary

The current audit confirms:

- shared component ownership is already separated into buttons, cards/panels, forms, dialogs, tables/lists, filters, navigation, avatars, attachments, progress/status, and charts;
- feature layout ownership is separated under `css/features/`;
- application component and feature styles contain no literal theme colors; semantic values are owned by `themes.css`;
- repeated shadows, radii, spacing, typography, and transitions consume the shared token contract;
- focus, disabled, hover, active, and selected states are expressed without spatial movement;
- chart and status colors already support CSS custom properties and can adopt the new palette incrementally;
- the application uses identical markup for light and dark themes and applies the saved theme before paint.

One-off geometry that describes data visualization or timeline layout remains local by design. Later screen-by-screen design work should:

1. preserve existing selectors, markup, behavior, endpoints, payloads, and preference keys;
2. replace local values with the semantic token that matches their purpose;
3. verify all states in both themes before moving to the next screen;
4. avoid introducing feature-to-feature CSS dependencies.

## Internal showcase

Open `/design-system.html` while the application is running.

The page is unlinked from PMT navigation and does not read or write PMT preferences. It demonstrates:

- light and dark theme parity;
- surface and text hierarchy;
- semantic colors;
- spacing, radii, and typography;
- button hover, active, focus, and disabled states;
- cards, forms, validation, statuses, navigation, tables, charts, and dialogs;
- laptop, desktop, compact, and reduced-motion behavior.

## Verification commands

Run the automated browser smoke tests after visual or layout changes:

```powershell
npm.cmd run test:browser
```

The smoke suite checks light and dark theme switching, primary navigation and overflow behavior, dialogs, filters, Board interaction, Gantt and Road Map rendering, console errors, and the 1366x768 and 1920x1080 viewport targets. Continue using the manual checklist for full data-backed CRUD and visual review.
