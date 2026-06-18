# PMT UI Design System

This is the initial specification for the later CSS split and redesign phases. It defines ownership and quality expectations without changing the current UI.

## Semantic token categories

- Color: page background, surfaces, elevated surfaces, borders, primary text, muted text, accent/action colors, focus, overlays, and semantic status colors.
- Typography: font family, body sizes, headings, labels, captions, weights, and line heights.
- Space and size: spacing scale, control heights, icon sizes, content widths, and touch targets.
- Shape and depth: radii, border widths, shadows, and overlay elevation.
- Motion: durations, easing, hover/press transitions, and reduced-motion alternatives.
- Layout: shell dimensions, navigation spacing, panel gaps, table density, sticky offsets, and timeline widths.
- Layering: base content, sticky content, menus, tooltips, dialogs, and toasts.

Tokens define meaning rather than a specific theme color. Theme files override semantic color values; components consume those values.

## CSS ownership and loading order

The target deterministic order is:

1. `tokens.css`
2. `themes.css`
3. `base.css`
4. `layout.css`
5. shared `components/*.css`
6. screen-specific `features/*.css`

Tokens define values, themes override semantic values, base/layout establish document structure, components style reusable UI, and features style screen-specific composition. Avoid duplicate ownership and broad feature overrides of shared components.

## Shared component categories

- Application shell, top navigation, overflow menu, and user menu
- Buttons, icon buttons, links, and action groups
- Cards, panels, sections, metrics, and empty states
- Form fields, selects, checklists, rich-text controls, and validation messages
- Dialogs, confirmations, prompts, toasts, and tooltips
- Tables, lists, filters, sorting controls, and pagination if introduced
- Avatars, member groups, attachments, and file previews
- Progress bars, status chips, legends, and shared chart primitives
- Timeline headers and common calendar markers when shared by Gantt and Road Map

## Theme parity

- Light and dark themes use identical markup, component CSS, spacing, and behavior.
- Theme differences belong in semantic token overrides, not duplicate component selectors or theme-specific DOM.
- Every state must work in both themes: default, hover, focus, active, selected, disabled, error, warning, success, and overlay.
- Status meaning remains consistent across themes and is never conveyed by color alone.
- The early theme script in `index.html` must remain effective so the page does not flash in the wrong theme.

## Viewport targets

- Primary laptop target: 1366x768.
- Primary desktop target: 1920x1080.
- Existing responsive target: widths at and below 900px.
- Board, Gantt, Road Map, wide tables, and dialogs may use intentional horizontal or contained scrolling rather than compressing content until it becomes unreadable.
- Chrome and Chromium are the primary supported browsers.

## Accessibility expectations

- Target WCAG 2.1 AA contrast in both themes.
- Use semantic HTML and associated labels; icon-only controls require accessible names.
- All actions must be keyboard reachable with a clearly visible focus indicator.
- Dialogs must receive sensible initial focus, keep interaction within the active modal, support Escape/close behavior, and restore focus when closed.
- Keep `aria-expanded`, `aria-pressed`, selected state, and live feedback accurate.
- Charts and status indicators require text labels or equivalent summaries; do not rely only on color, position, or hover.
- Images need meaningful alternative text unless decorative.
- Respect reduced-motion preferences for timeline animation and nonessential transitions.
- Maintain practical pointer/touch target sizes and avoid hover-only functionality.

Inline styles should be avoided except for calculated geometry or CSS custom-property values such as progress, chart, status, and timeline positions.
