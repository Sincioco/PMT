# PMT Diagram 2 — Daily Codex Implementation Series

## Objective

Build a new high-performance **Diagram 2** screen while keeping the current **Diagram** screen available and reliable.

Diagram 2 must be the last normal item on the top navigation bar and must use a separate route and renderer. It should reuse the same Diagram documents, permissions, Object Template library, clipboard representation, and PMT Diagram import/export format wherever possible.

The current Diagram remains the production-safe fallback during development.

## Non-negotiable compatibility goals

1. Diagram 1 remains usable every day.
2. Diagram 2 is a separate screen, route, feature module, and renderer.
3. Both screens display the same Diagram document library and save to the same backing document records.
4. Both screens use the same canonical editable Diagram state.
5. Both screens use the existing Object Template library API and template schema.
6. Objects copied in Diagram 1 can be pasted into Diagram 2.
7. Objects copied in Diagram 2 can be pasted into Diagram 1.
8. Both screens import and export the same `pmt-diagram` file format.
9. A file saved or exported from either screen can be opened by the other.
10. Diagram 2 must not require a database migration unless repository inspection proves one is unavoidable.
11. Diagram 2-specific UI preferences must use separate preference keys so zoom, panes, and filters do not overwrite Diagram 1 preferences.
12. Saved Diagram content must not depend on which renderer last edited it.

## Current repository facts Codex must verify

- Diagram 1 is registered as the `Diagram` screen.
- Its route feature is currently `diagram`.
- Diagram permissions currently map to the `Documentation` resource.
- The current file codec uses:
  - `format: "pmt-diagram"`
  - `formatVersion: 1`
- The existing Diagram feature receives the shared Object Template callbacks:
  - `/api/image-annotation/template-library`
  - `/api/image-annotation/default-template-library`
- Navigation preferences apply custom ordering and currently force some screens to particular positions.

Do not rely blindly on this summary. Verify the current repository before editing.

## Daily order

1. `01-Day-01-Protect-Diagram-1-and-Measure-Baseline.md`
2. `02-Day-02-Create-Shared-Compatibility-Contracts.md`
3. `03-Day-03-Upgrade-Diagram-1-Compatibility.md`
4. `04-Day-04-Add-Diagram-2-Screen-and-Route.md`
5. `05-Day-05-Build-Diagram-2-Read-Only-Shell.md`
6. `06-Day-06-Create-Diagram-2-Live-Renderer-Core.md`
7. `07-Day-07-Transform-Only-Zoom-Pan-and-No-Settling.md`
8. `08-Day-08-Persistent-Keyed-SVG-Nodes.md`
9. `09-Day-09-Dirty-State-and-Batched-Rendering.md`
10. `10-Day-10-Live-Drag-and-Resize-Preview.md`
11. `11-Day-11-Selective-Relationship-Routing.md`
12. `12-Day-12-Viewport-Halo-Virtualization.md`
13. `13-Day-13-Low-Detail-Overview-Rendering.md`
14. `14-Day-14-Templates-Clipboard-and-File-Compatibility.md`
15. `15-Day-15-Save-Undo-Export-and-Same-Document-Roundtrip.md`
16. `16-Day-16-Stress-Test-Hardening-and-Beta-Readiness.md`

## How to use these files

Give Codex exactly one daily file. Codex must complete that file, test it, report, commit, and stop.

Do not give Codex multiple daily files in one session unless the previous day has already passed manual testing.

## Branching recommendation

Use one feature branch for the complete project, with one detailed commit per approved day. Do not merge partially tested days into the production branch.

Suggested branch:

```cmd
git switch -c feature/diagram-2-performance
```


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
