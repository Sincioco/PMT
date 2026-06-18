# Phase 11 — Split CSS Foundations and Shared Components

## Objective

Split the monolithic stylesheet into semantic foundations and reusable component styles without changing the visual design.

## Mandatory operating rules

1. Work only on the scope described in this phase.
2. Do not begin the next phase, even if this phase finishes early.
3. Preserve current behavior unless this phase explicitly changes behavior or appearance.
4. Do not add React, Angular, Vue, TypeScript, a bundler, or another frontend framework.
5. Keep the implementation simple: native JavaScript ES modules, HTML, CSS, ASP.NET Core, ADO.NET, and stored procedures.
6. Read the repository root `AGENTS.md` and any nearer `AGENTS.md` files before editing.
7. Start by running `git status`. Do not overwrite unrelated user changes.
8. Before coding, give a concise impact map listing the files likely to change.
9. Make the smallest cohesive change that completes this phase.
10. Do not perform opportunistic cleanup outside the stated scope.
11. Run all verification listed in this phase.
12. If verification fails, fix only failures caused by this phase.
13. End with a concise report containing:
    - files changed;
    - behavior preserved or intentionally changed;
    - verification performed and results;
    - remaining risks;
    - the exact recommended Git commit message.
14. Stop after the final report. Do not continue into another phase.

## Quota-safety rule

This phase is intentionally bounded. Complete the required work before attempting any optional item. If an unexpected architectural problem makes the required work substantially larger, stop at a clean, buildable checkpoint and report the blocker rather than expanding the task.

## Required work

1. Create a CSS structure under `wwwroot/css/` containing:
   - `tokens.css`;
   - `themes.css`;
   - `base.css`;
   - `layout.css`;
   - `components/` files for shared buttons, cards/panels, forms, dialogs, tables/lists, filters, navigation, avatars, attachments, progress/status visuals, and shared charts.
2. Move existing rules; do not redesign them.
3. Preserve cascade behavior and selector specificity.
4. Preserve the existing theme values and visual output.
5. Update `index.html` to load the new styles in a documented deterministic order.
6. Do not use CSS `@import` unless there is a demonstrated reason; multiple `<link>` elements are acceptable and easier to debug.
7. Avoid duplicating selectors between the old and new files.
8. Keep feature-specific rules temporarily in a remaining compatibility stylesheet if necessary.
9. Update `docs/ui-design-system.md` with the actual loading order and ownership rules.

## Verification

- Run `dotnet build`.
- Open every screen in both themes.
- Compare the application shell, buttons, cards, dialogs, forms, tables, filters, charts, and navigation with the baseline.
- Test laptop and desktop viewport sizes.
- Check for missing styles, changed specificity, flashes of unthemed content, and 404s.
- Confirm no CSS rule was intentionally redesigned.

## Completion criteria

Shared CSS foundations and components have clear ownership, while the UI remains visually equivalent to the baseline.

## Suggested commit message

`refactor(css): split foundations and shared components`
