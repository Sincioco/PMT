# Day 14 — Complete Cross-Screen Templates, Clipboard, and File Compatibility

## Purpose

Connect Diagram 2 to the compatibility foundation built in Diagram 1.

This day must prove two-way interoperability.

## 1. Shared Object Template library

Diagram 2 must call the same existing template callbacks/API as Diagram 1.

Required behavior:

- Template created in Diagram 1 appears in Diagram 2.
- Template created in Diagram 2 appears in Diagram 1.
- Editing/deleting a template is reflected in both.
- Instantiating the same template repeatedly offsets objects.
- Template object state is renderer-neutral.
- No second library, endpoint, schema, or storage key contains canonical templates.

Test every object type supported by the current library.

## 2. Two-way clipboard

Diagram 2 copy/paste must use the shared `pmt-diagram-selection` codec.

Test:

```text
Diagram 1 copy -> navigate -> Diagram 2 paste
Diagram 2 copy -> navigate -> Diagram 1 paste
Diagram 1 browser tab -> Diagram 2 browser tab
Diagram 2 browser tab -> Diagram 1 browser tab
```

Test selections containing:

```text
Shapes
Text
Rich text
Images when supported
Groups
Entity annotations
One Entity
Two related Entities
Multiple relationships
Manual routes
Mixed locked/unlocked objects
```

Verify ID remapping, grouping, offsets, and relationship references.

Unsupported newer versions must fail clearly and safely.

## 3. Shared import/export

Diagram 2 must use the existing shared codec.

Do not fork it.

Keep:

```text
format: pmt-diagram
formatVersion: 1
```

Test the full matrix:

```text
Old Diagram 1 fixture -> Diagram 1
Old Diagram 1 fixture -> Diagram 2
New Diagram 1 export -> Diagram 2
Diagram 2 export -> Diagram 1
Diagram 2 export -> Diagram 2
```

Compare normalized canonical state, not renderer-specific SVG whitespace.

## 4. Preserve unknown extensions

Where the codec supports extension preservation:

- Diagram 1 must not drop safe unknown extension objects.
- Diagram 2 must not store renderer caches in extensions.
- Diagram 2-specific persisted extension data is prohibited unless Diagram 1 round-trips it safely.

## Acceptance criteria

- Shared templates work both ways.
- Clipboard works both ways.
- Same import/export format works both ways.
- No data conversion command is required.
- Diagram 1 remains the fallback reader/editor.
- Compatibility test matrix passes.


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
