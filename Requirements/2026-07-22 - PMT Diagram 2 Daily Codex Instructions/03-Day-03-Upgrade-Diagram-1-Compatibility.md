# Day 3 — Upgrade Diagram 1 Compatibility Before Diagram 2

## Purpose

Make the minimum safe improvements to Diagram 1 so it can interoperate cleanly with Diagram 2.

Do not optimize or redesign Diagram 1 rendering.

## 1. Adopt the shared clipboard codec

Update Diagram 1 copy and paste to use the shared `pmt-diagram-selection` package.

Preserve current user-visible behavior.

Required cases:

- Copy/paste one rectangle.
- Copy/paste text and rich text.
- Copy/paste an Entity.
- Copy/paste two Entities with a relationship between them.
- Copy/paste grouped objects.
- Copy/paste Entity annotations.
- Copy/paste manual relationship routes when their referenced endpoints are included.
- Repeated paste offsets each new instance.
- Clipboard data from an unsupported newer version produces a clear message rather than corrupting the Diagram.

Keep external SVG/image copy features separate from editable PMT object copy.

## 2. Adopt the shared Object Template normalization

Ensure Diagram 1 loads and saves templates only through the shared contract created on Day 2.

Do not change the server API or template library location.

Verify:

- Existing templates remain visible.
- Existing template instances render identically.
- New templates save successfully.
- Template library JSON round-trips without dropping unknown extension data.
- Template IDs do not collide after use.

## 3. Strengthen shared PMT Diagram import/export

Keep `format: "pmt-diagram"` and version 1.

Improve the current codec so:

- It accepts the existing files captured on Day 1.
- It preserves safe unknown extension objects.
- Generator feature names do not affect parsing.
- It can optionally set the generator feature to `Diagram` or `Diagram 2` without creating format incompatibility.
- Diagram 1 can import a synthetically generated Diagram 2 file that uses the same canonical state and no unsupported persisted data.

Do not require Diagram 1 to understand Diagram 2 renderer caches because those must never be exported.

## 4. Add explicit compatibility tests

Add tests for:

```text
Old Diagram 1 file -> upgraded Diagram 1
Upgraded Diagram 1 file -> upgraded Diagram 1
Synthetic Diagram 2 generator label -> Diagram 1
Old template library -> upgraded Diagram 1
Shared clipboard package -> Diagram 1 paste
Unsupported clipboard version -> safe rejection
```

## 5. Do not change

Do not change:

```text
Diagram 1 zoom implementation
Diagram 1 live SVG rendering
Diagram 1 relationship routing
Diagram 1 page layout
Diagram 1 save timing
Diagram 1 selection rendering
```

Any required compatibility correction must be narrowly scoped and measured against Day 1 behavior.

## Acceptance criteria

- Diagram 1 is now the first fully compliant reader/writer for shared files, templates, and clipboard packages.
- Existing user files and templates remain valid.
- Diagram 1 visual and performance behavior is unchanged except for compatibility fixes.
- The shared contracts are ready for Diagram 2.


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
