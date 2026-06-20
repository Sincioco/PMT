# Phase 13 — Define the New Light and Dark Design System

## Objective

Create the new visual design system and token specification without redesigning every screen yet.

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

## Inputs

The user may provide one or more visual reference images. Treat them as inspiration, not as permission to remove existing information or functionality.

## Required work

1. Read `docs/ui-design-system.md`.
2. Audit current shared components and feature layouts.
3. Define semantic tokens for both themes:
   - page and surface colors;
   - elevated/glass surfaces;
   - text hierarchy;
   - primary, secondary, success, warning, danger, and information colors;
   - borders;
   - focus indicators;
   - shadows;
   - radii;
   - spacing;
   - typography scale;
   - control heights;
   - chart colors;
   - status-color integration;
   - animation timing.
4. Keep one semantic token contract shared by light and dark themes.
5. Update `tokens.css` and `themes.css`.
6. Expand `docs/ui-design-system.md` with:
   - token definitions;
   - component principles;
   - density and responsiveness rules;
   - accessibility and contrast rules;
   - glassmorphism constraints;
   - examples for buttons, cards, tables, forms, dialogs, navigation, and charts.
7. Create a temporary internal design-system showcase page or development-only component gallery if it can be done without broad application changes.
8. Do not redesign individual feature screens in this phase.
9. Do not change business behavior.

## Verification

- Run `dotnet build`.
- Verify token completeness in both themes.
- Check text contrast, focus visibility, disabled controls, hover/active states, and status colors.
- Verify the optional showcase at laptop and desktop widths.
- Confirm no feature functionality changed.

## Completion criteria

The new visual language is fully specified and reusable before screen-by-screen implementation begins.

## Suggested commit message

`design: define PMT light and dark design system`
