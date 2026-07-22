# Day 5 — Build the Diagram 2 Read-Only Shell Over the Same Documents

## Purpose

Allow Diagram 2 to browse and open the same Diagram documents without editing them yet.

## 1. Same document library

Diagram 2 must list the same Diagram backing documents used by Diagram 1.

Do not duplicate documents.

Reuse shared document selectors/services from Day 2.

Diagram 2 may have its own UI preferences for:

```text
Tree versus cards
Left-pane width
Left-pane hidden
Search
Project filter
Sprint filter
Visibility filter
Sort
Creator filters
Last-editor filters
Selected document
Viewer zoom
```

Use Diagram 2-specific preference keys.

## 2. Separate screen UI

Implement Diagram 2's own stable page regions:

```html
<section class="diagram2-screen">
  <header data-diagram2-header></header>
  <aside data-diagram2-tree></aside>
  <main data-diagram2-viewer-host></main>
</section>
```

Do not call Diagram 1's complete `renderDiagram()` as Diagram 2's screen.

Shared presentational helpers may be extracted only when safe.

## 3. Read-only compatibility renderer

For today, use the existing complete saved SVG or shared complete SVG builder to display the selected Diagram read-only.

This is temporary scaffolding, not the final live renderer.

Requirements:

- Load the complete canonical state once.
- Show title and metadata.
- Support selecting another Diagram document.
- Support basic Fit.
- Do not allow editing yet.
- Clearly label the screen as Diagram 2 Beta.
- Do not alter Diagram documents merely by opening them.
- Do not save view-only state into Diagram content.

## 4. Deep links

Implement `#/diagram-2/<id>` if reserved on Day 4.

Selecting a Diagram in Diagram 2 should update the Diagram 2 route, not the Diagram 1 route.

## 5. Shared file import probe

Add a development-only or disabled-until-later control that verifies Diagram 2 can parse the existing `pmt-diagram` fixture through the shared codec.

Do not implement a separate importer.

## Acceptance criteria

- Diagram 2 lists the same documents as Diagram 1.
- Opening in Diagram 2 does not modify a document.
- Diagram 1 and Diagram 2 can show the same Diagram.
- Diagram 2 has separate UI preferences.
- Deep linking works.
- Editing is still disabled.
- No new persistent format exists.


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
