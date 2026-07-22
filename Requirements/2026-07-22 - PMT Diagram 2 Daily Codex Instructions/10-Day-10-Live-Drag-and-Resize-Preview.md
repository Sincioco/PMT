# Day 10 — Live Drag and Resize Preview

## Purpose

Make dragging and resizing responsive without running final global routing on every pointer move.

## Drag start

Record:

```text
Original canonical geometry
Selected object IDs
Connected relationship IDs
Settled relationship routes
Initial viewport matrix
```

Bring active objects forward using DOM order or overlay planes without rebuilding the scene.

## Pointer move

Once per animation frame:

1. Calculate temporary geometry.
2. Apply temporary transforms to active object groups.
3. Update selection handles.
4. Update only connected lightweight relationship previews.
5. Keep active objects mounted.

Allowed relationship previews:

```text
Move endpoint while retaining internal route
Offset first/last segment
Translate route if both endpoints move
Temporary simple orthogonal route
```

Do not:

```text
Run complete obstacle routing
Resolve global overlap cascades
Create undo entries per move
Serialize metadata
Rebuild unrelated objects
```

## Pointer release

1. Commit final canonical geometry.
2. Resolve collision/no-overlap once.
3. Determine affected relationships.
4. Route affected relationships once.
5. Patch affected nodes.
6. Create one undo step.
7. Clear temporary transforms.

## Multi-selection

Use a temporary group/container transform when practical.

Moving one member of a multi-selection must move the complete selection according to PMT's intended selection behavior.

## Resize

Resize preview may update the active object's internal display locally.

Final row/anchor geometry and final relationships settle once on release.

## Acceptance criteria

- Drag begins immediately.
- Pointer movement remains smooth.
- Relationships remain visually attached.
- Final routes are correct.
- One gesture equals one undo entry.
- Active objects never disappear.
- Diagram 1 remains available.


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
