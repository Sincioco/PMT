# Day 4 — Add the Diagram 2 Screen, Route, Navigation, and Permissions

## Purpose

Create a separate Diagram 2 screen without replacing or aliasing Diagram 1.

Today Diagram 2 may display a clear development placeholder. Do not start the new renderer.

## 1. Register Diagram 2

Add a new screen registry entry:

```text
View: Diagram 2
Label: Diagram 2
Feature/route: diagram-2
```

Diagram 1 remains:

```text
View: Diagram
Feature/route: diagram
```

Do not rename Diagram 1.

## 2. Navigation placement

Put Diagram 2 as the final normal navigation item.

Because PMT has responsive overflow behavior:

- On a wide screen, Diagram 2 should be the last normal top-nav button before the More/overflow control.
- On a narrow screen where items overflow, Diagram 2 may appear in the responsive overflow menu, but it must remain logically last among normal configurable screens.
- Do not move or break fixed About behavior.
- Update navigation normalization/versioning so users with saved navigation preferences receive Diagram 2 in the correct final position.
- Diagram 2 should be visible by default during development unless existing PMT beta conventions justify a visible beta marker.

Add an icon mapping. Reusing the Diagram ruler icon with a small `2` treatment is acceptable if visually clean and accessible.

## 3. Permissions

Map Diagram 2 to the same `Documentation` security resource as Diagram 1.

Do not add a new permission row or database migration.

The following rights must behave identically:

```text
Read
Create
Update
Delete
Import
Export
```

## 4. Routing

Add:

```text
#/diagram-2
```

If deep-linking to the same Diagram documents is supported, reserve and test:

```text
#/diagram-2/<diagramDocumentId>
```

Do not redirect Diagram 2 routes to Diagram 1.

Browser back and forward must switch correctly between:

```text
#/diagram
#/diagram-2
```

## 5. Feature module

Create a separate feature module, for example:

```text
wwwroot/js/features/diagram2/diagram2.js
```

Do not copy the entire 2,000-line Diagram implementation blindly.

The initial feature should implement:

```javascript
render()
deactivate()
handleAction()
view()
```

as needed by PMT conventions.

Display a development panel stating:

```text
Diagram 2
High-performance Diagram renderer under development.
Diagram 1 remains available.
```

## 6. Lifecycle isolation

Update screen deactivation so:

- Leaving Diagram deactivates Diagram 1.
- Leaving Diagram 2 deactivates Diagram 2.
- Animation frames, timers, observers, and event listeners do not leak between screens.

## Acceptance criteria

- Diagram 1 remains unchanged and usable.
- Diagram 2 is visible as the last normal nav item.
- Diagram 2 has its own route.
- Permissions match Diagram 1.
- Back/forward navigation works.
- No database changes.
- Diagram 2 contains only a placeholder today.


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
