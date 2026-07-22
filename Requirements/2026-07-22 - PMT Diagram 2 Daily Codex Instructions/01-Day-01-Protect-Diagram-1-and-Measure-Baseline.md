# Day 1 — Protect Diagram 1 and Measure the Baseline

## Purpose

Create a safety baseline before compatibility or Diagram 2 work begins.

Diagram 1 must remain the known-good production implementation and fallback throughout this project.

## Scope

Do not optimize rendering today.

### 1. Preserve current work

Inspect:

```text
Requirements/2026-07-19 - Requirements - Viewport-Plus-Halo Segmentation.md
Requirements/2026-07-19 - Requirements - Day 32.txt
Requirements/2026-07-20 - Requirements - Day 33.txt
wwwroot/js/components/image-annotation.js
wwwroot/js/features/diagram/diagram.js
wwwroot/js/features/diagram/pmt-diagram-file.js
wwwroot/js/core/screen-registry.js
wwwroot/js/core/navigation-preferences.js
wwwroot/js/core/router.js
wwwroot/js/shared/security.js
tests/js/image-annotation.test.mjs
```

Identify committed versus uncommitted Diagram performance work. Do not overwrite it.

### 2. Record Diagram 1 functional behavior

Create a repeatable browser smoke test checklist covering:

- Open Diagram screen.
- Tree and card view.
- Open the existing 28-entity PMT schema.
- Read-only zoom, pan, and Fit.
- Enter edit mode.
- Select one and several objects.
- Drag and resize.
- Collapse and expand an Entity.
- Show and hide data types.
- Edit style.
- Add an object from the Object Template library.
- Copy and paste an object.
- Export a PMT Diagram file.
- Import that file.
- Save and reopen.
- Undo and redo.

Do not change behavior to make tests pass. Document existing failures separately.

### 3. Record performance baseline

Instrument or use a temporary development harness to measure:

```text
Initial open
First useful frame
Final settled frame
Select
Clear selection
Drag start
Drag frame
Drag commit
Resize commit
Collapse/expand
Show/hide data types
Style change
Zoom first frame
Zoom settle
Pan frame
Fit
Save
Export
Import
```

Measure the existing 28-entity Diagram and the existing or newly generated synthetic 232-entity/624-relationship fixture.

Record:

```text
Total duration
Relationship-routing duration
SVG generation duration
DOM update duration
Full-render count
Rerouted relationship count
SVG descendant count
Detached-node count after close
```

Use normal CPU and Chrome six-times CPU slowdown.

### 4. Capture compatibility fixtures

Save test fixtures that are safe to keep under a test fixture or artifact directory:

- One Diagram 1 exported `.pmt-diagram.json`.
- One selection containing ordinary shapes.
- One selection containing two related Entities.
- One Object Template library sample.
- One Diagram containing rich text, annotations, manual relationship routes, collapsed Entities, and visible data types.

Do not commit private production data.

### 5. Add regression protection

Add tests that lock down:

- Current `pmt-diagram` format name and version.
- Current Diagram state normalization.
- Current template normalization.
- Current Diagram 1 import/export round-trip.
- Current copy/paste behavior where testable.
- Diagram 1 can still open the 28-table fixture.

## Acceptance criteria

- Diagram 1 behavior is documented.
- Performance baseline exists.
- Compatibility fixtures exist.
- Existing Diagram 1 still works.
- No production rendering logic was intentionally changed.
- There is a clear list of known pre-existing failures.


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
