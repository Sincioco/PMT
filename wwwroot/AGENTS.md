# Frontend Instructions

- Use native JavaScript ES modules; do not add a framework, TypeScript, or a bundler.
- Feature modules may import from `core`, `shared`, and `components`. One feature must not directly import another feature.
- Put generic HTTP handling and endpoint calls in core API modules, not in rendering templates.
- Keep reusable calculations and domain checks as named pure functions where practical.
- Preserve endpoint contracts, current `localStorage` keys, user-visible labels, and established CSS classes unless a requirement changes them.
- Light and dark themes must use the same markup and component CSS; themes override shared semantic tokens.
- Avoid inline styles except CSS custom-property values or geometry that must be calculated dynamically.
- Keep screen-specific rendering, actions, filters, and preferences inside the owning feature.

See `docs/architecture.md`, `docs/domain-rules.md`, and `docs/ui-design-system.md`.
