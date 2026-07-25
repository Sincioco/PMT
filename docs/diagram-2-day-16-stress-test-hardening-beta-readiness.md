# Diagram 2 Day 16 Stress Test Hardening and Beta Readiness

## Scope

Day 16 validates Diagram 2 as a beta-ready companion screen beside the existing Diagram screen. Diagram 1 remains available, is still labeled `Diagram`, and is not made subordinate to Diagram 2.

## Code Hardening

- Diagram 2 now exposes the exact Day 16 zoom matrix: `10%`, `Fit`, `50%`, `75%`, `100%`, `125%`, `150%`, and `200%`.
- The Diagram 2 renderer now exposes `destroy()` for explicit lifecycle cleanup.
- Diagram 2 reset/deactivate calls `destroy()` before dropping renderer references.
- Renderer cleanup cancels pending animation frames, resolves pending idle waiters, clears live DOM maps, clears routing and viewport-halo indexes, removes the renderer SVG from its host, and resets diagnostics.
- `PMT.csproj` now excludes ignored `artifacts/**` and `test-results/**` output folders from SDK item discovery so Visual Studio and `dotnet build` do not recursively compile generated build/test output.

Diagram 1 rendering code, database objects, stored procedures, Diagram documents, template libraries, clipboard schema, and import/export format were not changed.

## Compatibility Coverage

The Day 16 validation builds on the Day 14 and Day 15 compatibility matrix:

- PMT Diagram file format remains `pmt-diagram` version `1`.
- Selection clipboard format remains `pmt-diagram-selection` version `1`.
- Object Templates continue to use `/api/image-annotation/template-library`.
- Default Object Templates continue to use `/api/image-annotation/default-template-library`.
- Diagram 2 save/export rebuilds from canonical state, not mounted DOM, viewport halos, low-detail nodes, or renderer caches.
- The existing browser roundtrip test still verifies a Diagram 2 save reopens in Diagram 1 and then reopens in Diagram 2.
- The mixed compatibility fixture still includes rich text, manual routes, collapsed Entities, data types, screenshot metadata, Field Rectangle virtual Entities, many-to-one field mapping, and Field Mapping Table data.

## Stress Measurement Method

Diagram 1 baseline values come from the Day 01 recorded stress artifacts for the production Diagram path. Diagram 2 values below were measured on July 26, 2026 against a detached Diagram 2 renderer inside the local PMT app at `http://127.0.0.1:5056/`.

The Day 16 Diagram 2 fixture used:

- 232 Entities,
- 624 relationships,
- 29-column layout,
- high fan-out cross-grid relationships,
- selection, clear selection, drag preview, zoom, pan, local route recomputation, fit overview, and ten open/close lifecycle cycles.

The measurement avoids network and database timing so it compares the renderer stress path directly. CPU 6x was measured through Chrome DevTools CPU throttling.

## Side-by-Side Metrics

| Metric | Diagram 1 baseline | Diagram 2 Day 16 | Improvement factor |
| --- | ---: | ---: | ---: |
| Open | 40.35 s initial read usable view; 28.49 s route/SVG build | 73.7 ms initial renderer open | 547x versus usable view; 387x versus route/SVG build |
| Selection | Not captured as a standalone Day 01 timing | 34.1 ms, 0 relationships rerouted | Not measured |
| Drag start | Not captured as a standalone Day 01 timing | 180.1 ms preview start, 7 relationship previews | Not measured |
| Zoom frame | 12.68 ms average after full load; 16.2 ms max | 26.8 ms measured on 10% low-detail transition; 0 full rerenders | Not faster for this transition |
| Zoom settle | 0.74-0.78 s average under 6x plane-settle evidence | 23.5 ms normal CPU after 10% transition; 0 full rerenders | About 31x versus prior 6x settle evidence |
| Pan frame | Not captured as a standalone Day 01 timing | 26.8 ms measured frame duration; 0 full rerenders | Not measured |
| Local route recomputation | Full 624-route build cost: 28.49 s normal CPU | 49.2 ms operation; 95 of 624 relationships considered/rerouted; 3.4 ms routing portion | 579x operation; 8,379x routing portion |
| Focused DOM descendants | 18,558 edit SVG elements | 8,146 descendants in the broad 232 fixture; focused halo smoke verifies less than half mounted objects on the 220-Entity focused fixture | 2.3x on measured broad fixture |
| Fit overview descendants | 17,468 read SVG elements / 18,558 edit SVG elements | 4,202 descendants, low-detail overview active | 4.2x versus read; 4.4x versus edit |
| Memory after ten open/close cycles | Not captured in Day 01 baseline | 0 host descendants, 0 live object nodes, 0 live relationship nodes, 0 relationship bounds, 0 observed heap delta | Cleanup verified; no baseline factor |

## CPU 6x Diagram 2 Measurements

| Metric | Diagram 2 at 6x CPU |
| --- | ---: |
| Open | 676.9 ms |
| Selection | 606.0 ms |
| Clear selection | 300.7 ms |
| Drag start | 1,040.2 ms |
| Zoom frame wall time | 1,400.2 ms |
| Zoom frame renderer duration | 180.7 ms |
| Pan frame wall time | 200.0 ms |
| Local route recomputation | 331.8 ms operation; 33.8 ms routing portion |
| Fit overview | 986.5 ms |
| Ten open/close cleanup | 0 host descendants and 0 live renderer map entries |

The old 232-Entity Diagram 1 6x route build was not completed because it was estimated at 8-12 minutes from the measured scaling curve. The Day 16 Diagram 2 6x open completed in under one second for the renderer path.

## Correctness Results

- Diagram 2 top navigation label remains exactly `Diagram 2`.
- Diagram 2 keeps the `Diagram 2 Beta` badge inside the screen header.
- Diagram screen remains available and routeable.
- Diagram 2 does not mount `.diagram-screen`.
- Diagram 2 open/close cycles clear global renderer, compatibility, and selection clipboard references.
- Diagram 2 open/close cycles leave no stale Diagram 2 SVG mounted in the DOM.
- Destroying a pending 232-Entity render clears live object maps, relationship maps, route indexes, viewport halo indexes, transaction depth, pending flush state, and diagnostics.
- The existing Diagram 2 browser smoke still covers keyed node patches, selective routing, viewport halo virtualization, low-detail overview rendering, transform-only zoom/pan, cursor-centered wheel zoom, save, undo/redo, selection copy, export, and same-document Diagram 1 roundtrip.

## Known Limitations

- Day 01 did not capture standalone Diagram 1 timings for selection, drag start, pan frame, and lifecycle cleanup, so those improvement factors are reported as not measured.
- The 10% low-detail transition on the 232-Entity fixture measured above the ideal 16.7 ms frame budget on the development machine. It still avoided full rerender and settled without lost focus, missing objects, or post-zoom rebuild.
- CPU 6x interaction timings remain above the ideal target for several operations. They are still a large practical improvement over the previous 8-12 minute projected 232-Entity route build.
- Diagram 2 is beta-ready beside Diagram 1, not a replacement for Diagram 1.

## Required Completion Report

Day completed: Day 16 - Stress Test Hardening and Beta Readiness.

Files changed: `PMT.csproj`, `docs/diagram-2-day-15-save-undo-export-roundtrip.md`, `docs/diagram-2-day-16-stress-test-hardening-beta-readiness.md`, `tests/browser/diagram2-beta-readiness.spec.mjs`, `tests/browser/diagram2-navigation.spec.mjs`, `wwwroot/index.html`, `wwwroot/js/app.js`, `wwwroot/js/features/diagram2/diagram2-renderer.js`, `wwwroot/js/features/diagram2/diagram2.js`.

Diagram 1 behavior changed: No.

Diagram 2 behavior added: Exact Day 16 zoom matrix, explicit renderer lifecycle cleanup, ten-cycle open/close beta smoke coverage, and 232-Entity pending-work destroy coverage.

Build safety added: Ignored build/test output folders are excluded from .NET SDK item discovery, and generated build leftovers under `artifacts/build*`, `artifacts/dotnet-build*`, and `test-results` were removed from the local workspace.

Compatibility contracts affected: None. Shared Diagram file, clipboard, template, and backing-document contracts remain unchanged.

Before measurements: Diagram 1 232-Entity baseline was 40.35 s initial read usable view, 83.11 s initial edit usable view, 28.49 s route/SVG build, 17,468 read SVG elements, and 18,558 edit SVG elements.

After measurements: Diagram 2 232-Entity renderer open measured 73.7 ms normal CPU and 676.9 ms at 6x CPU. Fit overview DOM measured 4,202 descendants and lifecycle cleanup left 0 stale descendants/map entries after ten cycles.

Automated tests: `node --check` on changed JavaScript/browser specs, focused Playwright Diagram 2 browser tests, standard JavaScript tests, JavaScript syntax suite, `dotnet build`, and `git diff --check`.

Manual test steps: Local browser stress measurement on `http://127.0.0.1:5056/`; previous user confirmation covered Diagram 2 manual testing before this phase.

Recompile required or Ctrl+F5 only: Browser cache refresh is required for the updated JavaScript query strings. A .NET rebuild is only needed for normal build validation because no backend code changed.

Known limitations: See the Known Limitations section above.

Commit: This Day 16 commit.
