# Day 13 — Low-Detail Rendering for Fit and Extreme Zoom-Out

## Purpose

Keep complete 220+ Entity overview views responsive when virtualization cannot omit much content.

## Detail-level selection

Use projected screen size, not only a hard-coded zoom percentage.

Enter low detail when individual field rows would be too small to be useful, for example below approximately four screen pixels.

Use hysteresis to avoid rapid switching near the threshold.

## Low-detail Entity

Render:

```text
Outer box
Header
Entity name
Optional compact key indicator
Selection outline
```

Omit:

```text
Field text
Data types
Row separators
Fine-grained hit paths
Expensive decorations
Detailed annotation content
```

## Low-detail relationships

At extreme zoom-out:

- Use simplified paths where correctness permits.
- Hide symbols.
- Omit individual invisible interaction hit paths.
- Combine same-style noninteractive paths where safe.

Do not use low detail for:

```text
Save
SVG export
PNG export
Clipboard export
Portable SVG
```

## Transition

During zoom, transform the existing level.

After settle:

- Determine detail level.
- Patch only nodes whose level changes.
- Preserve retained group identity where practical.
- Do not move nodes after settle.
- Do not rebuild the page shell.

## Acceptance criteria

- Fit/10% overview remains interactive.
- DOM descendants fall substantially.
- Entity names remain visible.
- Zooming in restores details.
- Full save/export remains exact.
- Diagram 1 is unaffected.


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
