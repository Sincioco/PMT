# Day 12 — Viewport-Plus-Halo Virtualization

## Purpose

Reduce Diagram 2's live DOM when focused on one region of a large ERD.

Reconcile with existing PMT viewport-plus-halo research and code. Do not create conflicting segmentation engines.

## Initial parameters

Use existing measured defaults unless new measurements justify tuning:

```text
Sector size: 2,048 world units
Halo: one sector
Minimum object threshold: 80
Full-render coverage threshold: 82%
```

## Keyed mount/unmount

For each settled viewport sector set:

```text
Entering IDs = target minus current
Leaving IDs = current minus target
Retained IDs = intersection
```

- Create only entering nodes.
- Preserve retained node identity.
- Remove only leaving nodes.
- Append entering nodes before removing leaving nodes.
- Do not regenerate the active body as one SVG string.

Always force-mount:

```text
Selected objects
Active gesture objects
Required group members
Relationships needed by active selection
```

Mount a relationship when its completed route intersects the viewport-plus-halo region even when both endpoint Entities are outside.

## Timing

- Coalesce scroll checks with `requestAnimationFrame`.
- Do not reconcile sectors during every transient zoom frame.
- Reconcile after zoom settles.
- Same-sector scrolling performs no DOM changes.
- Retained objects do not shift during reconciliation.

## Full fallback

Use full rendering for:

```text
Small Diagrams
Fit/overview when coverage exceeds threshold
Unsafe parsing cases
Nearly all objects already required
```

## Acceptance criteria

- Focused 220+ Entity views normally mount below 40–50% of full DOM.
- Same-sector scrolling is a no-op.
- No white gaps.
- No blank frame.
- Selected/dragged objects stay visible.
- Save/export contains every canonical object.


## Mandatory working rules

- Work only on the scope of this file.
- Do not begin the next day/stage.
- Preserve unrelated working-tree changes.
- Before editing, run:

```cmd
git status --short
git diff --stat
git diff
```

- Read the latest relevant Requirements files and inspect current uncommitted Diagram work before changing it.
- PMT is a public repository. Prefix every commit with:

```text
Sin and Codex:
```

- Keep the existing **Diagram** screen operational throughout the project.
- Unless this file explicitly says otherwise, changes to Diagram 1 must be compatibility-only and must not change its rendering behavior.
- Do not add a second database schema or duplicate Diagram documents.
- Do not add a second incompatible template library, clipboard schema, or import/export format.
- Use coordinated JavaScript/CSS cache-bust query strings for every changed importer.
- After implementation, state whether testing requires a .NET rebuild or only Ctrl+F5.
- Do not test the 3D About flyby unless it was changed.
- Stop after reporting the results and wait for manual approval.

## Standard validation

Run the applicable commands:

```cmd
node --check <each changed JavaScript file>
cmd /c npm.cmd run check:js
cmd /c npm.cmd run test:js
cmd /c dotnet build
git diff --check
```

Also run the focused browser smoke tests created during this project.

## Required completion report

```text
Day completed:
Files changed:
Diagram 1 behavior changed:
Diagram 2 behavior added:
Compatibility contracts affected:
Before measurements:
After measurements:
Automated tests:
Manual test steps:
Recompile required or Ctrl+F5 only:
Known limitations:
Commit:
```
