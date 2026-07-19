# Viewport-Plus-Halo Segmentation for PMT Diagrams

Date: 2026-07-19  
Status: Implementation in progress on the development machine  
Primary target: Large ERD Diagrams, including an expected office schema of roughly 220 tables

## Goal

Keep Diagram zooming, panning, selection, and object movement responsive as Diagram size grows. PMT must avoid mounting and repainting every SVG object when the user is focused on one area of a large Diagram.

The optimization must not change Diagram content, save behavior, field-to-field relationship geometry, layer order, undo/redo, templates, exports, or the RTE/Image Annotation feature.

## Core design

PMT retains one complete canonical Diagram state in JavaScript. The complete state remains the source of truth for:

- Save and reopen
- SVG metadata
- Undo and redo
- Object tree contents
- Templates
- Auto Format
- Relationship resolution and obstacle routing
- Clipboard operations
- Exported SVG

Only the live SVG paint DOM is segmented.

The visible viewport is mapped from screen pixels into Diagram world coordinates. PMT expands that rectangle to fixed world-coordinate sectors and adds a one-sector halo on every side. Objects and completed relationship routes that intersect the resulting active bounds are mounted. Objects outside that area remain in canonical state but are not mounted until their sector enters the halo.

### Initial constants

| Setting | Initial value | Reason |
| --- | ---: | --- |
| Sector size | 2,048 world units | Large enough to avoid frequent swaps while still reducing focused DOM size |
| Halo | 1 sector on every side | Preloads the next area before it becomes visible |
| Minimum visible-object count | 80 | Small Diagrams use the simpler full renderer |
| Full-render coverage threshold | 82% | Segmentation is skipped when most of the world is already needed |
| Zoom range | 10% to 200% | Existing PMT behavior remains unchanged |

These values are intentionally simple constants until browser measurements justify changing them.

## Non-negotiable invariants

1. `buildAnnotationSvg(...)` remains a complete, unsegmented save/export path.
2. SVG metadata always contains every Diagram object, including off-screen objects.
3. Relationship routes are calculated from all canonical Entities and all routing obstacles.
4. Segmentation filters completed relationship geometry; it never reroutes from only the visible Entities.
5. The outer SVG `viewBox`, width, height, white background, and virtual canvas remain complete.
6. Sector changes do not occur during transient zoom scaling. The browser scales the currently mounted plane, then PMT settles the final sector after the zoom gesture.
7. Selected objects and active gesture objects stay mounted even when they cross a sector boundary.
8. Small Diagrams, Fit/full-overview states, parsing failures, and unsafe edge cases fall back to the full renderer.
9. RTE/Image Annotation uses the same shared renderer but should normally stay on the full-render fallback because its object count is small.
10. No database schema change is required for segmentation.

## Phased implementation

### Phase 0 - Baseline and observability

Status: Completed before segmentation work began.

- Keep the 28-table PMT Database Schema as the normal functional fixture.
- Keep a synthetic 232-table/624-relationship stress Diagram for office-scale testing.
- Record readiness, DOM descendant count, first-frame zoom time, settled zoom time, pan behavior, selection latency, and drag latency.
- Expose live-render diagnostics as SVG data attributes, including whether segmentation is active, the active sector key, mounted object count, and canonical object count.
- Continue testing under normal CPU and six-times CPU slowdown.

Important baseline observation: browser transform frames were fast after the plane-scaling work, but the final full SVG settle and edit interactions still paid for a large live DOM.

### Phase 1 - Shared sector planner

Status: Implemented in `wwwroot/js/components/image-annotation.js`; verification is still in progress.

- Add a pure `annotationViewportRenderSlice(...)` helper.
- Use world-origin floor math so negative coordinates work.
- Assign objects by visual-bounds intersection, not by object center.
- Preserve canonical object paint order.
- Force selected object IDs and the required logical-group members into the active slice.
- Return a stable sector key so ordinary scrolling does not rebuild the DOM until the active sector range changes.
- Use the full-render fallback below 80 objects, at 82% or greater world coverage, or when every object is already required.

### Phase 2 - Relationship filtering

Status: Implemented in the shared renderer; verification is still in progress.

- Resolve every relationship from the complete canonical Entity set.
- Reuse the existing full-geometry WeakMap cache.
- Route around all Entities and Entity Annotation obstacles.
- Calculate bounds for each completed relationship geometry.
- Filter only completed relationship items that do not intersect the active render bounds.
- Re-merge same-style visible route segments after filtering.
- Keep individual relationship selection metadata for the relationships that are mounted.
- Leave full save/export relationship output unchanged.

### Phase 3 - Read-only Diagram viewer

Status: Implemented and browser-smoked; additional regression testing remains.

- Parse and retain the full canonical state once.
- Keep one stable full metadata node rather than rebuilding its JSON during pan or zoom.
- Start with a lightweight outer SVG shell instead of first parsing the entire saved render body.
- Calculate the logical viewport from the read-only viewport scroll position, stage offsets, current zoom, and full `viewBox`.
- Build the current viewport-plus-halo body with `buildAnnotationViewportSvgBody(...)`.
- Append new render nodes before removing old render nodes to avoid a blank frame.
- Preserve focus on Entity header buttons during a sector replacement.
- Preload the union of the current and target viewport during transient zoom.
- Recalculate full bounds only when an Entity header action changes Diagram geometry.
- Clean up animation frames, timers, and observers when leaving the viewer.

Initial PMT Schema smoke result: full metadata retained 88 objects; a focused view mounted 20 of 29 Entity roots and reduced SVG descendants from approximately 2,187 to 1,610. Relationship reduction was smaller because many schema relationships cross the focused area.

### Phase 4 - Edit-mode Diagram viewer

Status: In progress.

- Calculate the edit viewport from workspace scroll, canvas offset, workspace world bounds, and settled zoom.
- Keep canonical state, history, inspector, and Objects tree complete.
- Mount only the viewport-plus-halo object list.
- Keep selected IDs mounted.
- Rebuild the paint body only when the sector key changes or a state mutation forces a repaint.
- Coalesce scroll checks with `requestAnimationFrame`.
- Do not call the full editor `render()` from transient zoom frames.
- Keep zoom as a browser transform while input is active; update sectors only after settle.
- Keep marquee hit testing based on canonical object geometry rather than mounted DOM.
- Preserve workspace expansion and cursor-centered zoom behavior.

### Phase 5 - Interaction fast paths

Status: In progress.

- Selection should change paint order without rebuilding all canonical geometry.
- The selected Entity must render above other Entities.
- Entity dragging should transform the selected object immediately.
- While an Entity moves, a lightweight relationship preview must keep connected fields visually attached.
- On pointer release, PMT recomputes the complete obstacle-aware relationship route and commits one undo step.
- Active gestures must not lose their objects when crossing a sector boundary.
- Double-clicking an Objects-tree item should select it, calculate a fit zoom within 10%-200%, and center the viewport on it.

### Phase 6 - Sector-aware relationship indexing

Status: Planned after the first shared/read/edit implementation is stable.

The first implementation scans completed cached relationship bounds when a sector changes. For a 220-table production ERD, add a small spatial index only if measurement shows the scan is material.

Possible implementation:

- Index completed relationship bounds by the same 2,048-unit sector coordinates.
- Keep a reverse map from Entity ID to affected relationship IDs.
- Moving one Entity invalidates only its connected relationship geometry and the sectors touched by those routes.
- Style changes invalidate paint data without invalidating unrelated geometry.
- Global relationship-format changes may repaint all mounted relationships but should not reroute them.
- Preserve the current full-geometry fallback for correctness.

Do not implement a complex quadtree unless the simple sector map fails measured 220-table tests.

### Phase 7 - 220-table stress and tuning

Status: Planned.

- Generate or load a fixture of roughly 220 Entities with realistic field counts and relationship density.
- Test sparse, dense, self-referencing, long cross-sector, and high-fan-out parent relationships.
- Test with relationship symbols off and on.
- Test focused 100%, 150%, and 200% views, normal Fit, and 10% full overview.
- Test normal CPU and six-times CPU slowdown.
- Record mounted object/relationship/DOM counts for each view.
- Verify selection and drag latency with only one or two visible Entities.
- Verify no white gaps, missing borders, thick duplicate lines, disconnected settled routes, or lines behind unrelated Entities.
- Tune sector size, halo size, and the full-render threshold only from measurements.

### Phase 8 - Optional low-detail overview

Status: Deferred unless 220-table measurements require it.

At 10% or Fit, most or all sectors may be visible, so normal viewport segmentation cannot reduce much DOM. If the full overview remains slow, add a separate low-detail level of detail:

- Render Entity header/outline only below a measured zoom threshold.
- Omit field text and interaction hit paths until zoom settles above the threshold.
- Keep full canonical state and full save/export output.
- Never use the low-detail renderer for screenshots, saved SVG, or export.

This is a separate optimization and should not be mixed into the first segmentation phase.

## Files involved

- `wwwroot/js/components/image-annotation.js`
  - Shared state, slice planner, live editor renderer, relationship geometry/filtering, drag preview, and save/export path.
- `wwwroot/js/features/diagram/diagram.js`
  - Read-only viewport integration and Diagram-screen lifecycle.
- `wwwroot/css/components/image-annotation.css`
  - Only if a small live-render or transition style is necessary.
- `wwwroot/css/features/diagram.css`
  - Read-only viewer layout only.
- `tests/js/image-annotation.test.mjs`
  - Pure slice, relationship, metadata, grouping, and geometry tests.
- Diagram browser smoke/stress scripts and `artifacts/`
  - Performance evidence; generated artifacts should not be committed unless intentionally requested.

## Required tests

### Unit tests

- Negative coordinates and exact sector boundaries.
- One-sector halo inclusion.
- 79 objects use full rendering; 80 objects are eligible.
- Coverage below 82% segments; 82% or greater falls back.
- Objects touching an active boundary remain mounted.
- Hidden objects remain absent.
- Selected off-screen objects remain mounted.
- Same-sector scrolling keeps the same sector key.
- Cross-sector relationships remain when their path intersects the halo.
- Nonintersecting relationship geometry is omitted from the live body.
- Segmented metadata still parses to every canonical object.
- Full `buildAnnotationSvg(...)` output remains complete and editable.

### Browser tests

- Read-only pan, zoom, Fit, Entity collapse, and data-type toggle.
- Edit-mode pan, Ctrl-wheel zoom, toolbar zoom, Fit, select, drag, resize, marquee, Objects-tree selection, and undo/redo.
- Sector transition with no blank frame.
- Selected object crossing a sector boundary.
- Save/reopen after editing objects in multiple sectors.
- Object tree always lists every canonical object.
- RTE/Image Annotation regression checks for PNG, SVG, crop, templates, and annotation save.
- Full white background at 10% and Fit.
- No relationship flicker or stale unfinished render after zoom settles.

### Performance acceptance targets

These are benchmark goals, not flaky CI timing assertions:

- Focused live DOM should normally be below 40%-50% of the full 220-table DOM.
- First visual zoom/pan frame should remain below 33 ms under six-times CPU slowdown where practical.
- Selecting a visible Entity should highlight it in under 100 ms on the development machine.
- Dragging one visible Entity should begin without a multi-second delay.
- Zoom-in should remain plane scaling with no full reroute or full DOM reconstruction per frame.

## Known limitations and fallback behavior

- A fully zoomed-out overview may legitimately require most sectors and therefore fall back to the full renderer.
- A long relationship crossing the viewport may be mounted even when both endpoint Entities are outside the halo.
- Select All or a very large selected group can temporarily defeat virtualization because correctness requires selected objects to stay mounted.
- Relationship geometry is still globally invalidated by some state changes in the first phase. Phase 6 addresses this only if measurements justify it.
- If parsing or segmented rendering fails, PMT must restore the complete full plane rather than show a partial Diagram.

## Resume checklist for a future Codex session

1. Run `git status --short` and preserve unrelated Requirements edits.
2. Read this file and the latest `2026-07-19 - Requirements - Day 32.txt` additions.
3. Inspect the two shared exports in `image-annotation.js`: `annotationViewportRenderSlice(...)` and `buildAnnotationViewportSvgBody(...)`.
4. Verify `buildAnnotationSvg(...)` is still unsegmented.
5. Run `node --check` on changed modules.
6. Run `npm.cmd run check:js` and `npm.cmd run test:js`.
7. Run the focused 232-table browser stress fixture at normal and six-times CPU slowdown.
8. Compare mounted DOM counts and interaction timing with the recorded baseline.
9. Test Diagram read-only, Diagram edit mode, and RTE/Image Annotation separately.
10. Apply one coordinated cache-bust token to every importer of `image-annotation.js`; do not create two module instances with mismatched query strings.
11. Run `dotnet build`, the relevant browser smoke tests, and `git diff --check` before handoff.

## Current implementation checkpoint

As of this document's creation:

- Shared sector planning is implemented.
- Completed relationship geometry filtering is implemented.
- Read-only segmentation is implemented and smoke-tested.
- Edit-mode segmentation is being integrated and has not completed full browser verification.
- Live Entity relationship drag preview, selected-Entity paint order, invisible logical groups, Entity resize collision handling, and Objects-tree zoom-to-selection are being integrated in the same working session.
- No segmentation changes have been committed or pushed yet.

