# Day 9 — Dirty-State Invalidation and Batched Rendering

## Purpose

Give Diagram 2 a Draw.io-like incremental invalidation model.

## Dirty state

Use explicit categories:

```javascript
const dirty = {
  objectGeometry: new Set(),
  objectStructure: new Set(),
  objectStyle: new Set(),
  objectSelection: new Set(),
  relationshipGeometry: new Set(),
  relationshipStyle: new Set(),
  zOrder: false,
  worldBounds: false,
  sectors: false
};
```

Adjust as necessary, but preserve distinctions.

## Transactions

Implement:

```javascript
beginDiagramUpdate();
endDiagramUpdate();
scheduleDiagramFlush();
flushDiagramChanges();
```

Nested transactions are allowed.

Only the outermost completed update schedules one animation-frame flush.

## Mutation classification

### View-only

Pan, zoom, Fit:

```text
Dirty no objects
Dirty no relationship geometry
Update viewport transform only
```

### Selection-only

```text
Previous selection visual
New selection visual
Optional z-order
```

No routing or bounds.

### Style-only

Patch affected attributes.

No routing unless a geometry-affecting style such as protected clearance actually changed.

### Geometry preview

Patch temporary transform and connected previews.

### Geometry commit

Dirty changed geometry, connected/affected routes, and bounds only when necessary.

### Global structural

Import, Auto Format, load, or full undo restore may perform broad invalidation.

## Flush order

1. Structural object patches.
2. Object geometry.
3. Anchor updates.
4. Dirty relationship geometry.
5. Relationship node patches.
6. Visual styles.
7. Z-order.
8. Selection overlays.
9. World bounds only if dirty.
10. Sector/detail reconciliation only if dirty.
11. Clear flags.

## Diagnostics

Every flush reports:

```text
Reason
Dirty object IDs
Dirty relationship IDs
Patched node count
Routed relationship count
Duration
```

## Acceptance criteria

- Multiple changes in one frame cause one flush.
- Selection does not route relationships.
- Style changes do not rebuild Entities.
- Undo entries remain user-level operations.
- 28-entity selection normally completes below 50 ms.
- No full live render for ordinary interaction.


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
