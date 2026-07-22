# Day 8 — Persistent Keyed SVG Nodes

## Purpose

Stop regenerating the Diagram 2 SVG body for local changes.

## Stable identity

Every object and relationship must have a stable keyed group:

```html
<g data-diagram2-object-id="..."></g>
<g data-diagram2-relationship-id="..."></g>
```

Maintain maps from canonical IDs to DOM nodes.

## Renderer operations

Implement focused operations such as:

```javascript
createObjectNode(object)
patchObjectNode(node, previousObject, nextObject, flags)
removeObjectNode(id)

createRelationshipNode(relationship)
patchRelationshipNode(node, previousRelationship, nextRelationship, flags)
removeRelationshipNode(id)
```

Do not use complete plane `innerHTML` replacement during ordinary updates.

## Entity rules

- Entity group persists.
- Moving an Entity updates its transform.
- Color changes patch attributes or inherited CSS variables.
- Selection changes patch classes/overlays.
- Collapse, data-type visibility, or field changes may rebuild only that Entity's internal rows.
- Unrelated Entity nodes must not be recreated.

## Text stability

Keep existing text nodes when content and formatting did not change.

Do not switch between SVG text and HTML/foreignObject solely because of zoom.

## Metadata

Do not generate serialized metadata during live rendering.

Serialize complete metadata only for:

```text
Save
Export
Complete clipboard export
Portable SVG
```

## Tests

Use DOM node identity assertions.

Examples:

```text
Select Entity A -> Entity B node identity unchanged
Change Entity A fill -> Entity B node identity unchanged
Move Entity A -> Entity A group identity unchanged
Zoom -> all retained node identities unchanged
```

## Acceptance criteria

- Ordinary updates preserve unrelated nodes.
- Diagram 2 does not rebuild the complete live SVG.
- Initial open may create many nodes once.
- Save/export remains complete.
- Diagram 1 is unchanged.


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
