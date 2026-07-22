# Day 16 — Stress Testing, Hardening, and Diagram 2 Beta Readiness

## Purpose

Validate that Diagram 2 is substantially faster, stable, compatible, and safe to keep beside Diagram 1.

Do not remove or hide Diagram 1.

## Fixtures

Test:

```text
28-Entity PMT schema
220–232 Entities
Approximately 624 relationships
Sparse graph
Dense graph
Self-referencing graph
Long cross-sector relationships
High-fan-out Entities
Manual routes
Groups
Rich text
Entity annotations
Collapsed Entities
Data types visible/hidden
Relationship symbols on/off
```

## Zoom levels

```text
10%
Fit
50%
75%
100%
125%
150%
200%
```

Use normal CPU and six-times slowdown.

## Operations

Measure:

```text
Initial open
First useful frame
Final settle
Select
Multi-select
Clear selection
Drag
Resize
Collapse/expand
Show/hide data types
Style change
Continuous zoom
Pan
Sector crossing
Low-detail transition
Undo/redo
Template use
Cross-screen copy/paste
Save
Reopen in Diagram 1
Export/import matrix
```

## Targets

### 28-Entity Diagram

```text
Selection normally below 30 ms
Zoom/pan first frame normally below 16.7 ms
Drag preview frame normally below 16.7 ms
Simple style patch normally below 30 ms
No multi-second final redraw
No visible post-zoom settling
```

### 220+ Entity focused view

```text
Zoom/pan first frame below 16.7 ms where practical
Six-times slowdown first frame below 33 ms where practical
Selection below 100 ms
Drag starts without multi-second delay
Focused DOM normally below 40–50% of complete full-detail DOM
Local edit does not reroute every relationship
```

### Complete overview

```text
Low-detail mode activates
UI remains interactive
No full rebuild on each pan/wheel event
First useful frame appears before expensive optional detail
```

## Correctness

Verify:

- No missing objects.
- No missing or stale relationships.
- No protected-zone crossings after settle.
- No duplicate thick lines.
- No disconnected endpoints.
- Correct z-order.
- Selected/gesture objects remain mounted.
- No white gaps.
- No focus loss.
- No lost history.
- No post-zoom positional shift.
- Same-document round-trip through Diagram 1.
- Template/clipboard/file compatibility.
- RTE Image Annotation regression.
- No memory growth after repeated open/close.

## Memory/lifecycle

Inspect:

```text
Detached SVG nodes
Event listeners
Animation frames
Timers
Observers
Worker instances if any
Clipboard object URLs
Image resources
```

## Beta status

Keep the top-nav label exactly:

```text
Diagram 2
```

A small Beta badge inside the screen is acceptable.

Do not rename Diagram 1.

Do not make Diagram 2 the default or remove Diagram 1 without a separate future approval.

## Final report

Provide a side-by-side table:

```text
Metric
Diagram 1
Diagram 2
Improvement factor
```

Include:

```text
Open
Selection
Drag start
Zoom frame
Zoom settle
Pan frame
Local route recomputation
Focused DOM descendants
Fit overview descendants
Memory after ten open/close cycles
```

## Acceptance criteria

- Diagram 2 provides a large measured speed improvement.
- Diagram 1 remains fully available.
- Compatibility matrix passes.
- No critical regressions.
- Known limitations are documented.
- Diagram 2 is safe for beta use.


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
