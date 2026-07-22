# Day 6 — Create the Diagram 2 Live Renderer Core

## Purpose

Establish the new renderer architecture before implementing interaction.

Do not reuse Diagram 1's complete SVG-string rebuild as Diagram 2's normal repaint mechanism.

## Architecture

Create a Diagram 2 renderer module, for example:

```text
wwwroot/js/features/diagram2/diagram2-renderer.js
```

Maintain separate concerns:

### Canonical model

The shared normalized Diagram state containing every object and relationship.

### Live renderer state

Renderer-only data such as:

```javascript
const liveView = {
  objectNodesById: new Map(),
  relationshipNodesById: new Map(),
  mountedObjectIds: new Set(),
  mountedRelationshipIds: new Set(),
  selectedIds: new Set(),
  objectVersionsById: new Map(),
  relationshipVersionsById: new Map()
};
```

Never persist live renderer state.

### Complete export renderer

Continue using the existing complete builder for save/export only.

## Stable SVG planes

Create stable layers:

```html
<svg data-diagram2-svg>
  <g data-diagram2-background-plane></g>
  <g data-diagram2-below-relationship-plane></g>
  <g data-diagram2-relationship-plane></g>
  <g data-diagram2-object-plane></g>
  <g data-diagram2-overlay-plane></g>
</svg>
```

The root and planes must retain node identity during normal interaction.

## Diagnostics

Add development diagnostics:

```text
Canonical object count
Canonical Entity count
Canonical relationship count
Mounted object count
Mounted relationship count
SVG descendant count
Full-render count
Full-render reason
Objects patched in last flush
Relationships routed in last flush
Last frame duration
```

Use `performance.mark()` and `performance.measure()` for major phases.

## Initial renderer behavior

Render the complete 28-entity fixture using the new renderer core.

At this stage, it is acceptable to create all nodes once during initial open.

Do not yet implement editing, virtualization, or selective routing.

## Acceptance criteria

- Diagram 2 renders the 28-entity Diagram through its own renderer.
- Diagram 1 is untouched.
- Diagram 2 root SVG remains stable after Fit or harmless UI refresh.
- Canonical and live renderer state are separate.
- Save/export still uses the shared complete builder.
- Diagnostics expose initial DOM and timing information.


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
