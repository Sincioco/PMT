# Day 11 — Selective Relationship Routing and Spatial Indexes

## Purpose

Prevent one local edit from rerouting hundreds of unrelated relationships.

## Required indexes

Maintain:

```javascript
const relationshipIdsByEntityId = new Map();
const relationshipIdsByFieldAnchor = new Map();
const relationshipBoundsById = new Map();
```

Add simple fixed-grid/sector indexes for:

```text
Entity protected bounds
Relationship route bounds
Routing obstacles
```

Do not use a quadtree unless measured evidence proves the simple grid inadequate.

## Route cache signature

A settled route should depend on relevant versions:

```text
Source Entity geometry
Target Entity geometry
Source anchor
Target anchor
Manual route
Relationship-specific routing override
Global routing settings
Relevant obstacle-region generation
```

Do not invalidate from unrelated state object cloning.

## Moving/resizing an Entity

Initially invalidate:

1. Directly connected relationships.
2. Relationships whose route bounds intersect the old protected region.
3. Relationships whose route bounds intersect the new protected region.
4. Relationships found in an expanded impact corridor.

This is necessary because an unconnected route may need to move when an obstacle changes.

## Style-only updates

Do not reroute for:

```text
Stroke color
Opacity
Selection highlight
Relationship symbols
```

Reroute only for geometry-affecting changes.

## Diagnostics

Report:

```text
Total relationship count
Relationships considered
Relationships rerouted
Cache hits
Cache misses
Spatial sectors queried
Routing duration
```

## Acceptance criteria

Using the 232-Entity/624-relationship fixture:

- Moving an ordinary Entity does not reroute all relationships.
- Rerouting is proportional to connectivity and affected area.
- Final paths respect protected no-cross zones.
- Manual routes remain valid.
- Global routing-mode changes may reroute all.
- Diagram 1 remains unchanged.


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
