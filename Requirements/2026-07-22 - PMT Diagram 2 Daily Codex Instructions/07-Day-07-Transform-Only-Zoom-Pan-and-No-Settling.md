# Day 7 — Transform-Only Zoom, Pan, and Eliminate Post-Zoom Settling

## Purpose

Make Diagram 2 zoom and pan immediate and prevent letters, objects, borders, and relationships from shifting after zoom ends.

## One authoritative viewport transform

Maintain one transform:

```javascript
const viewportTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0
};
```

Use one `DOMMatrix` or mathematically equivalent implementation for:

```text
Wheel zoom
Toolbar zoom
Fit
Pan
Hit testing
Selection overlay positioning
Sector calculations
Zoom settle
```

## World geometry remains unchanged

Zoom and pan must not modify:

```text
Entity coordinates
Object coordinates
Entity dimensions
Field locations
Relationship route coordinates
Manual route points
Canonical state
Undo history
```

Only the viewport transform changes.

## Active gesture

- Coalesce events with one `requestAnimationFrame`.
- Transform the stable Diagram plane.
- Do not rebuild SVG.
- Do not route relationships.
- Do not serialize metadata.
- Do not normalize or resolve overlaps.
- Preserve cursor-centered zoom.

Calculate the world point under the cursor from the inverse current matrix, then calculate the new translation so that world point remains under the same screen point.

## No preview/settle renderer switch

Do not:

```text
CSS scale temporarily
Remove CSS transform
Recalculate every SVG coordinate
Rebuild nodes at final scale
```

Keep the same persistent transform after settle.

Zoom settle may:

```text
Commit the final transform state
Update the zoom control
Schedule future sector/detail reconciliation
```

It may not visually reposition retained nodes.

## Precision rules

- Keep floating-point world coordinates.
- Do not round world coordinates.
- Avoid independent updates to scrollLeft, scrollTop, viewBox, stage offset, canvas offset, and plane transform.
- Use one movement mechanism.
- Do not apply a second corrective scroll on the next frame.
- Do not reroute relationships on zoom or pan.

## Visual stability diagnostics

Record:

```text
Transient matrix
Committed matrix
Matrix difference
Cursor screen point
World point under cursor
Screen point after settle
Entity bounding box before settle
Entity bounding box after settle
Node identity before/after
Full renders during settle
Routes recalculated during settle
```

Warn in development if post-settle movement exceeds:

```text
0.1 CSS pixel translation
0.0001 scale
```

## Automated browser test

At zoom levels:

```text
50%, 75%, 90%, 100%, 110%, 125%, 150%, 200%
```

Verify:

- Same Entity node identity.
- Same text node identity.
- No full render.
- No relationship reroute.
- Maximum secondary movement after final transient frame:
  - translation <= 0.25 CSS pixels
  - width/height difference <= 0.25 CSS pixels

A small anti-aliasing sharpness change is acceptable. Position and baseline movement are not.

## Acceptance criteria

- Zoom and pan first frames are transform-only.
- No post-zoom positional settling is visible.
- Cursor-centered zoom is correct.
- No relationship flicker.
- No blank frame.
- Diagram 1 still works independently.


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
