# Phase 14 — Redesign Application Shell and Shared Components

## Objective

Apply the new design system to the global shell and reusable components so later screen redesigns require fewer changes.

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

Redesign only:

- page background;
- top navigation/application shell;
- brand area;
- user menu;
- responsive navigation behavior;
- page headers and toolbars;
- buttons;
- cards and panels;
- forms and controls;
- dialogs;
- tables/list primitives;
- filters;
- avatars and attachments;
- progress/status visuals;
- shared chart framing;
- toasts and empty states;
- login screen.

Constraints:

- Preserve all existing information and actions.
- Preserve event hooks and `data-*` attributes.
- Prefer changing shared component markup/builders once rather than patching every feature.
- Maintain laptop readability and large-screen scalability.
- Implement both themes simultaneously.
- Do not perform screen-specific layout redesigns except where a shared component necessarily changes.
- Keep glass effects restrained enough for text readability and performance.
- Maintain keyboard focus visibility and reasonable touch targets.

## Verification

- Run `dotnet build`.
- Test login, navigation, menus, dialogs, forms, filters, tables, charts, toasts, and empty states.
- Test every screen for accidental regressions caused by shared components.
- Test both themes at laptop and desktop widths.
- Check browser console errors.
- Check keyboard navigation and focus indicators.

## Completion criteria

The shell and shared components consistently express the new design, while feature layouts and functionality remain intact.

## Suggested commit message

`design: redesign PMT shell and shared components`
