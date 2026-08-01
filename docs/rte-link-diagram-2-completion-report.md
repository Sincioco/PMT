# RTE Link Diagram 2 Completion Report

## Status

`Link Diagram 2` is complete and ready for acceptance testing. It is an additive mirror of the existing RTE `Link Diagram` feature and uses the production Diagram 2 read-only renderer. The existing `Link Diagram` feature remains on the Diagram 1 rendering path.

No database version, migration, Release Notes, or What's New data changed.

## Repository Preflight and Commits

- Observed baseline SHA: `826756672deb71e1a635ea51895a9cec09560c84`
- Branch: `main`
- RTE Link Diagram 2 implementation SHA: `191a28d72e6863e1bf1381e70f62e63e0fb9bafd`
- Final validated source SHA before this report: `7b8bf1b48f553e8c69e4fa4929274d537bc1625b`
- A prior-request commit after the observed baseline is `9a92114c2e20807da41b038d7889fc7e522563b1` (`Sin and Codex: fix Diagram 2 read-only navigation centering`). It is not part of the RTE implementation.
- The worktree was dirty at preflight and remains intentionally dirty only for Sin's unrelated files:
  - Modified: `Requirements/2026-07-31 - Requirements - Day 40.txt`
  - Untracked: `Requirements/2026-08-01 - Requirements - Day 41.txt`
- Those Requirements files were not edited, staged, or committed by this task.

The full JavaScript suite was also run in a clean detached worktree. A focused `.gitattributes` rule pins the frozen Field Mapping demo SVG to LF so its byte checksum remains reproducible when Windows Git uses `core.autocrlf=true`. The SVG and Version 1.27 migration history were not changed.

## Exact D1 Oracle

The existing D1 linked-viewer implementation was traced as the executable behavior oracle rather than reimplemented from the prompt. The traced paths included:

- RTE toolbar markup and disabled-state propagation in `wwwroot/js/components/forms.js`
- command handling, picker, insertion, shared OLE shell, tabs, dimensions, viewport persistence, maximize, source refresh, save cleanup, copy/paste, and deletion in `wwwroot/js/app.js`
- durable RTE normalization in `wwwroot/js/shared/text-and-links.js`
- linked-viewer styling in `wwwroot/css/components/forms.css`
- Scrum capture, replacement, hydration, refresh blocking, and restoration in `wwwroot/js/features/scrum/scrum.js`
- Field Mapping interaction contracts in `wwwroot/js/components/diagram-field-mapping-interactions.js`
- the production D2 renderer and read-only state contracts under `wwwroot/js/features/diagram2/`
- existing JavaScript and browser tests for linked Diagram blocks, D1 SVG rendering, RTE persistence, Documentation read mode, and Scrum auto-refresh

The D1 picker, shell, schema, control handlers, local-storage helpers, edit/read branching, and persistence functions remain shared. The renderer discriminator chooses the renderer without changing D1 blocks or D1 source resolution.

## Implementation

### Toolbar and Picker

`Link Diagram 2` is immediately after `Link Diagram` in every shared RTE toolbar. It uses the same class, icon treatment, dimensions, disabled attributes, disabled reason, focus behavior, and toolbar layout. Its distinct command is `insertLinkedDiagram2`.

Both commands use the same Diagram list, permission filtering, search implementation, row rendering, selection behavior, dialog geometry, keyboard behavior, saved RTE selection, insertion flow, blank trailing paragraph, and focus restoration. Only the D2 picker title and insert command include `2`.

### Durable Block and Shared Schema

D1 blocks retain their existing identity. D2 blocks add only this explicit durable discriminator:

```html
<figure
  class="pmt-diagram-ole pmt-diagram2-ole"
  data-pmt-ole="diagram2"
  data-diagram-renderer="2"
>
```

The D2 block uses the existing block ID, tab JSON, Diagram ID, header, width, height, initial view, current view, active-tab, and maximized-state contracts. Existing D1 blocks are not converted. D1 and D2 blocks can coexist in one RTE without sharing block IDs or viewport storage keys.

Save normalization removes live renderer DOM and preserves only the durable link and OLE settings. Source-mode round trips, reopen hydration, Documentation export, and copy/paste recognize both discriminators.

### D2 Renderer Adapter and Viewport

`wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js` is the focused adapter between the shared OLE shell and the production D2 read-only renderer. It uses the shared canonical Diagram loader, `createDiagram2Renderer(...)`, and `diagram2ReadonlyRendererState(...)`.

The existing OLE `{x, y, zoom}` record remains authoritative for persistence. The adapter translates that state to and from D2, while live zoom, pan, Fit, and Reset delegate to the D2 renderer. Pan and zoom update the viewport incrementally and do not rebuild the RTE, rebuild the shell, reparse the Diagram, reroute unrelated relationships, or trigger a full D2 render per interaction frame.

### Source Refresh and Lifecycle

Hydration uses stable source signatures and request keys. Unchanged sources reuse the connected renderer; changed sources refresh from the current Diagram record; stale asynchronous results are ignored. Active tab and viewport state are restored where possible, and the existing missing/permission fallback remains authoritative.

Each D2 record owns an `AbortController`. `renderer.destroy()` and resource release run on source replacement, linked-block deletion, RTE replacement, screen replacement, and Scrum replacement. Diagnostics are exposed only through `globalThis.__pmtLinkedDiagram2Diagnostics`; no diagnostic UI was added.

### Edit, Read, Tabs, Resize, Maximize, and Field Mapping

The shared D1 shell remains authoritative for edit and read behavior. D2 blocks are `contenteditable="false"`, expose the same edit-only Rename/Change/Tab/Delete actions, save dirty state through the same path, and expose the same read-only controls without mutating saved HTML during read-only navigation.

Tabs use the same IDs and JSON. Add, rename, move, delete, change Diagram, minimum-one-tab protection, active-tab persistence, and per-tab viewport persistence all use the shared D1 code.

The default dimensions remain `900 x 520` pixels. Direct resize, minimum dimensions, resize events, persisted width/height, read-only sizing, maximize/restore, Escape restore, body-class cleanup, and maximized preference all use the existing D1 shell.

Field Mapping hover, click, double-click, focus, highlight, blue attention arrow, and mapping-line visibility are bound to the D2 renderer output without exposing the D2 editor toolbar.

### Scrum Five-Second Refresh

Scrum explicitly disposes connected D2 linked renderers immediately before replacing `app.innerHTML`. It captures viewer width/height along with the existing Scrum view state, restores dimensions before hydration, hydrates one renderer per D2 block, and then restores the remaining tab and viewport state.

The D2 block retains the shared `.pmt-diagram-ole` and viewport classes, so the existing five-second refresh guard continues to pause while focus is inside a linked viewer or a viewer is panning. Refresh resumes after focus/panning ends.

## Parity Matrix

| Feature | Link Diagram | Link Diagram 2 | Result |
|---|---|---|---|
| Toolbar position | Existing position | Immediately after D1 | Pass |
| Button size/style | Existing shared tool | Same class, icon, states, and geometry | Pass |
| Disabled rules | Existing reason and attributes | Exact shared rules | Pass |
| Picker dialog | Existing shared picker | Same picker with D2 title | Pass |
| Search | Title, project, and Sprint | Same implementation and results | Pass |
| Insert at selection | Saved RTE selection | Same insertion path | Pass |
| Default size | `900 x 520` | `900 x 520` | Pass |
| Resize | Existing direct resize | Same shell and persistence | Pass |
| Header | `Linked Diagram: {title}` | `Linked Diagram 2: {title}` | Pass |
| Rename header | Existing action | Same action | Pass |
| Zoom buttons | Existing `-` and `+` | Same controls, D2 viewport delegate | Pass |
| Wheel zoom | Pointer anchored | Same behavior | Pass |
| Drag pan | Left-button pan | Same behavior | Pass |
| Middle pan | Existing auxiliary pan | Same behavior | Pass |
| Fit | Existing control | Same control, D2 fit delegate | Pass |
| Reset | Saved initial view | Same persisted model | Pass |
| Max/Restore | Existing shell | Same shell and preference | Pass |
| Escape restore | Existing handler | Same handler | Pass |
| Tabs | Existing tab JSON and IDs | Exact shared schema | Pass |
| Add/Rename/Move/Delete tab | Existing actions | Same actions | Pass |
| Change Diagram | Existing picker/action | Same action | Pass |
| Active-tab persistence | Existing helper/key structure | Same helper/key structure | Pass |
| Tab viewport persistence | Existing per-tab view | Same model translated to D2 | Pass |
| Read-only controls | D1 read controls | Same controls | Pass |
| Missing Diagram | Existing fallback | Same fallback with D2 identity | Pass |
| Permission denied | Existing fallback | Same permissions and fallback | Pass |
| Source refresh | Version/signature protected | Same protection and stale guard | Pass |
| Field Mapping interactions | Existing linked-viewer set | Same interaction set on D2 output | Pass |
| RTE save/reopen | Durable D1 block | Durable D2 block, live DOM stripped | Pass |
| Source-mode round trip | Existing normalization | Both discriminators normalized | Pass |
| Copy/paste | Existing durable block behavior | Same behavior | Pass |
| Delete/caret | Existing shell behavior | Same delete path | Pass |
| Scrum refresh | D1 survives five-second replacement | D2 explicitly disposed and restored | Pass |
| Renderer | Diagram 1 | Production Diagram 2 read-only renderer | Pass, intentional difference |

No applicable D1/D2 parity mismatch remains. Browser assertions kept wrapper width and height within two CSS pixels at both required viewports.

## Performance Results

### Linked Viewer, 96 Entities / 257 Relationships

| Viewport | First frame | Interactive settle | Zoom p95 | Pan p95 | Fit | Tab switch | Full renders | Unrelated reroutes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1366x768 | 0.0 ms | 138.2 ms | 18.1 ms | 4.7 ms | 57.7 ms | 122.8 ms | 0 | 0 |
| 1920x1080 | 0.0 ms | 122.0 ms | 19.6 ms | 6.7 ms | 59.2 ms | 141.1 ms | 0 | 0 |

The first-frame value is the renderer's synchronous frame-duration dataset value. All measured interaction budgets passed. The D1 and D2 linked viewers used the same source fixture for parity. D1 remains the behavior and wrapper oracle; D2's measured interaction path applies incremental transforms with zero full renders and zero unrelated reroutes, which is the intended performance distinction.

### D2 Renderer Route/Viewport Fixtures

| Fixture | 1366 settled p95 | 1920 settled p95 | 1366 visual p95 | 1920 visual p95 |
|---|---:|---:|---:|---:|
| 96 Entities / 257 relationships | 11.1 ms | 11.6 ms | 0.7 ms | 0.7 ms |
| 232 Entities / 624 relationships | 20.4 ms | 19.6 ms | 0.9 ms | 0.9 ms |
| 500 Entities / 1 focused relationship | 21.2 ms | 21.1 ms | 6.3 ms | 5.9 ms |
| 1,000 Entities / 1 focused relationship | 43.7 ms | 44.0 ms | 16.3 ms | 15.6 ms |

All four fixtures remained below the requested limits. Pan/zoom caused zero full renders, zero unrelated reroutes, and zero index/state rebuilds.

## Scrum Soak and Lifecycle Results

Each required viewport completed 12 refresh cycles with one D1 block and one relationship-heavy D2 block. The D2 viewer was resized, moved to a non-first tab, panned, and zoomed before refresh. Focus and panning blocked refresh; moving focus away resumed it. Dimensions, header, tab, viewport, renderer count, and D1 operation remained stable.

| Diagnostic | 1366x768 | 1920x1080 |
|---|---:|---:|
| Refresh cycles | 12 | 12 |
| Renderer create | 17 | 17 |
| Renderer destroy | 16 | 16 |
| Renderer live | 1 | 1 |
| Hydrate | 20 | 20 |
| Reuse | 3 | 3 |
| Source refresh | 0 | 0 |
| Viewport restore | 18 | 18 |
| Scrum rehydrate | 17 | 17 |
| Full render | 17 | 17 |
| Pan frames | 5 | 11 |
| Zoom frames | 4 | 4 |
| Resource release | 16 | 16 |

For both viewports, `create = destroy + live` (`17 = 16 + 1`). There was no duplicate SVG/canvas root, stale panning class, stale maximized body class, console error, unhandled rejection, observer growth, timer growth, listener growth, or continuing memory-growth trend.

## Automated Validation

| Validation | Result | Duration / notes |
|---|---|---|
| `npm run check:js` | 192 modules passed | Syntax check for the complete module set |
| Clean-worktree `npm run test:js` | 446 passed, 0 failed, 0 skipped | 187.2 seconds |
| Focused Link Diagram 2 source-contract tests | 6 passed, 0 failed, 0 skipped | 58.1 ms |
| Existing D1 linked-viewer regression | 1 passed, 0 failed, 0 skipped | 81.4 ms |
| RTE and Documentation browser parity, both viewports | 2 passed, 0 failed | 10.7 seconds |
| Scrum 12-cycle soak, both viewports | 2 passed, 0 failed | 21.8 seconds |
| D2 relationship route performance, both viewports | 2 passed, 0 failed | 16.7 seconds |
| D1 Compact oracle and D2 parity fixtures | 29 passed, 0 failed, 0 skipped | 186.8 seconds; all 21 parity fixtures exact |
| Focused Version 1.27 checksum regression in clean checkout | 1 passed, 0 failed | 60.7 ms |
| `.NET` build with temporary output | 0 errors | 0.82 seconds; one existing NETSDK1138 .NET 6 support warning |
| `git diff --check` | Passed | No whitespace errors; checkout line-ending warnings only |

The full-suite count above is the full `tests/js/*.test.mjs` run, not a focused subset. The local dirty worktree's untracked Day 41 prompt changes the historical-prompt count by one, so the authoritative full run was intentionally executed from a clean detached worktree at the validated source SHA.

The About 3D flyby was not tested because this task did not change it.

## Screenshots

Permanent evidence is under `docs/screenshots/link-diagram-2/`:

- [Toolbar at 1366x768](screenshots/link-diagram-2/link-diagram-and-link-diagram-2-toolbar-1366x768.png)
- [D1 picker at 1366x768](screenshots/link-diagram-2/link-diagram-picker-1366x768.png)
- [D2 picker at 1366x768](screenshots/link-diagram-2/link-diagram-2-picker-1366x768.png)
- [D1 viewer at 1920x1080](screenshots/link-diagram-2/link-diagram-d1-viewer-1920x1080.png)
- [D2 viewer at 1920x1080](screenshots/link-diagram-2/link-diagram-2-d2-viewer-1920x1080.png)
- [D2 tabs at 1920x1080](screenshots/link-diagram-2/link-diagram-2-tabs-1920x1080.png)
- [D2 maximized at 1920x1080](screenshots/link-diagram-2/link-diagram-2-maximized-1920x1080.png)
- [D2 Scrum viewer after refresh at 1920x1080](screenshots/link-diagram-2/link-diagram-2-scrum-after-refresh-1920x1080.png)
- [D2 large Diagram at 1920x1080](screenshots/link-diagram-2/link-diagram-2-large-diagram-1920x1080.png)

## Files Changed

### Production and contracts

- `.gitattributes`
- `wwwroot/index.html`
- `wwwroot/css/components/forms.css`
- `wwwroot/js/app.js`
- `wwwroot/js/components/forms.js`
- `wwwroot/js/features/diagram2/diagram2-rte-linked-viewer.js`
- `wwwroot/js/features/documentation/documentation-export.js`
- `wwwroot/js/features/scrum/scrum.js`
- `wwwroot/js/shared/text-and-links.js`

### Complete cache-bust import chain

- `wwwroot/js/components/image-annotation.js`
- `wwwroot/js/components/user-mentions.js`
- `wwwroot/js/features/backlog/backlog.js`
- `wwwroot/js/features/board/board.js`
- `wwwroot/js/features/bugs/bugs.js`
- `wwwroot/js/features/diagram/diagram.js`
- `wwwroot/js/features/diagram2/diagram2-editor-shell.js`
- `wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js`
- `wwwroot/js/features/diagram2/diagram2.js`
- `wwwroot/js/features/documentation/documentation.js`
- `wwwroot/js/features/invitations/invitations.js`
- `wwwroot/js/features/personal-log/log.js`
- `wwwroot/js/features/projects/projects.js`
- `wwwroot/js/features/settings/settings.js`
- `wwwroot/js/features/sprints/sprints.js`
- `wwwroot/js/features/tasks/tasks.js`

### Tests and evidence

- `tests/browser/pmt-smoke.spec.mjs`
- `tests/js/image-annotation.test.mjs`
- `tests/js/rte-link-diagram2.test.mjs`
- the nine PNG files listed in the Screenshots section
- `docs/rte-link-diagram-2-completion-report.md`

## Known Limitations and Scope Boundaries

- The linked D2 surface is intentionally read-only Diagram content inside the RTE OLE shell. It does not expose the Diagram 2 editor toolbar or D2 edit commands.
- The RTE stores the Diagram link and viewer settings, not a copied Diagram document or static screenshot. Permission loss or source deletion therefore uses the existing linked-viewer fallback.
- Performance measurements are deterministic development fixtures and vary with machine/browser load, but all required thresholds passed at both specified viewports.
- No unrelated Requirements file, database object, migration, release-note entry, or architecture document was changed.

## Manual Acceptance Checklist for Sin

### Toolbar and Picker

1. Open any RTE editor.
2. Confirm `Link Diagram` remains unchanged.
3. Confirm `Link Diagram 2` appears immediately after it.
4. Click each button and compare the picker layout and rows.
5. Search for the same Diagram in each picker.
6. Insert the same Diagram using each button.

### Viewer Parity

1. Place the D1 and D2 linked viewers in the same RTE.
2. Compare size, header, controls, tabs, and spacing.
3. Pan each viewer.
4. Wheel-zoom each viewer at the pointer.
5. Use `-`, `+`, Reset, Fit, Max, and Escape.
6. Resize each viewer.
7. Rename each header.
8. Add, rename, move, change, and delete tabs.
9. Save and reopen the RTE.
10. Open the same content in read-only mode.
11. Confirm the original viewer still uses Diagram 1.
12. Confirm `Link Diagram 2` uses Diagram 2.

### Scrum

1. Add `Link Diagram 2` to a Scrum entry.
2. Open Scrum with Auto Refresh enabled.
3. Pan and zoom the linked D2 viewer.
4. Wait through at least three five-second refreshes.
5. Confirm the view does not reset.
6. Focus the viewer and confirm refresh pauses.
7. Move focus away and confirm refresh resumes.
8. Confirm no duplicate viewer appears.
9. Confirm the viewer remains responsive.

## Browser Reload Requirement

This is a frontend-only JavaScript/CSS change. No .NET recompilation is required. Press `Ctrl+F5` once to load it. The complete import chain and stylesheet references use the `20260801-rte-link-diagram2-v1` cache token, so the browser will not retain the previous toolbar, code, or CSS after the hard refresh.
