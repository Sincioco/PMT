# Day 15 — Save, Undo/Redo, Export, and Same-Document Round-Trip

## Purpose

Make Diagram 2 a complete editor over the same backing Diagram documents while preserving Diagram 1 reopening.

## Same document records

Diagram 2 must edit the same selected backing document as Diagram 1.

Do not create a Diagram 2 copy unless the user explicitly chooses Duplicate.

Opening alone must not save.

## Save path

On save:

1. Commit any active gesture.
2. Flush pending dirty state.
3. Validate canonical state.
4. Build complete metadata/state.
5. Build the complete shared SVG export representation.
6. Save using the same backing service as Diagram 1.
7. Do not save mounted-only state.
8. Do not omit off-screen objects.
9. Do not save low-detail output.

## Diagram 1 reopening

After every Diagram 2 save test:

- Leave Diagram 2.
- Open the same document in Diagram 1.
- Verify objects, relationships, routes, templates, annotations, rich text, collapse state, and data-type visibility.
- Make a change in Diagram 1.
- Reopen in Diagram 2.
- Verify the change.

## Undo/redo

Use canonical user-level operations:

```text
Add/delete
Move
Resize
Style
Group/ungroup
Paste
Entity edit
Collapse/expand
Data-type visibility
Manual relationship route
Auto Format
Import
```

One drag equals one undo step.

Undo/redo must update the incremental renderer through dirty invalidation, not a complete live SVG rebuild unless restoring a truly global snapshot.

## Export

Verify:

```text
PMT Diagram JSON
Complete SVG
PNG if supported
Selection copy
Portable assets
```

Exports must always be full-detail and complete.

## Concurrency/safety

If PMT already detects save collisions or stale records, Diagram 2 must use the same mechanism.

Do not invent a weaker save path.

## Acceptance criteria

- Diagram 2 can safely save the same documents.
- Diagram 1 reopens Diagram 2 saves exactly.
- Diagram 2 reopens Diagram 1 saves exactly.
- Undo/redo works.
- Exports are complete.
- Mounted/low-detail state never leaks into persisted content.


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
