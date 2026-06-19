# PMT UI Design System

This document records the current CSS foundations, shared-component ownership, and feature stylesheet ownership. The Phase 12 split changes file ownership only; it does not change the visual design.

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

`wwwroot/index.html` loads stylesheets in this deterministic order:

1. `css/tokens.css`
2. `css/themes.css`
3. `css/base.css`
4. `css/layout.css`
5. `css/components/buttons.css`
6. `css/components/cards-panels.css`
7. `css/components/forms.css`
8. `css/components/dialogs.css`
9. `css/components/tables-lists.css`
10. `css/components/filters.css`
11. `css/components/navigation.css`
12. `css/components/avatars.css`
13. `css/components/attachments.css`
14. `css/components/progress-status.css`
15. `css/components/charts.css`
16. `css/features/login.css`
17. `css/features/dashboard.css`
18. `css/features/roadmap.css`
19. `css/features/gantt.css`
20. `css/features/board.css`
21. `css/features/projects.css`
22. `css/features/sprints.css`
23. `css/features/tasks.css`
24. `css/features/bugs.css`
25. `css/features/scrum.css`
26. `css/features/documentation.css`
27. `css/features/backlog.css`
28. `css/features/settings.css`

Ownership rules:

- `tokens.css` defines default semantic values; `themes.css` overrides semantic values for each theme.
- `base.css` owns document-wide element defaults, while `layout.css` owns shared page and shell composition.
- Each component stylesheet owns reusable UI selectors named by that file. Theme-specific native-control behavior may stay with its owning component when it must follow that component's base rule.
- Feature stylesheets own screen-specific composition and screen-only selectors for their matching feature.
- New shared selectors belong in the matching foundation or component file. New screen-specific selectors belong in the matching `css/features/` file.
- Do not duplicate selectors between stylesheets or use CSS `@import`. Preserve this link order unless a later phase deliberately changes cascade ownership.

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
