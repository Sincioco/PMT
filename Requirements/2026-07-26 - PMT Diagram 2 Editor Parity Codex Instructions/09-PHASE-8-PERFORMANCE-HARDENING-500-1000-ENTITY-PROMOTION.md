# PMT Diagram 2 Editor Parity Program

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


## Repository context

Repository: `Sincioco/PMT`

Primary existing implementation areas to inspect before editing:

- `wwwroot/js/features/diagram/diagram.js`
- `wwwroot/js/components/image-annotation.js`
- `wwwroot/css/features/diagram.css`
- `wwwroot/css/components/image-annotation.css`
- `wwwroot/js/features/diagram2/diagram2.js`
- `wwwroot/js/features/diagram2/diagram2-renderer.js`
- `wwwroot/js/features/diagram2/diagram2-compatibility.js`
- `wwwroot/css/features/diagram2.css`
- `wwwroot/js/shared/diagram-contracts.js`
- `wwwroot/js/shared/diagram-documents.js`
- `wwwroot/js/features/diagram/pmt-diagram-file.js`
- Diagram and Image Annotation JavaScript and Playwright tests

The exact files may evolve. Always inspect the latest repository and current uncommitted work rather than relying only on this list.

## Mandatory working rules

1. Before editing, run:

   ```cmd
   git status --short
   git diff --stat
   git diff
   ```

2. Preserve unrelated working-tree changes.
3. Work only on the scope of the current instruction file.
4. Do not begin the next phase until the current phase is complete and reported.
5. PMT is a public repository. Prefix every commit with:

   ```text
   Sin and Codex:
   ```

6. Use pure JavaScript unless Sin explicitly approves another language or framework.
7. Keep Diagram 1 available and operational. Changes to Diagram 1 must be compatibility-only unless the current phase explicitly authorizes extracting a truly shared renderer-neutral helper.
8. Do not create a second database schema, duplicate Diagram documents, a second template library, a new clipboard format, or a new incompatible PMT Diagram file format.
9. Diagram 1 and Diagram 2 must continue to open the same backing Diagram documents.
10. Coordinate JavaScript and CSS cache-bust query strings for every changed browser module.
11. Do not test the 3D About flyby unless it was changed.
12. Run applicable syntax, unit, browser, build, and diff checks before completion.
13. Report whether a `.NET` rebuild is required or whether `Ctrl+F5` is sufficient.
14. Stop after the completion report and wait for Sin's manual approval.

## Non-negotiable performance rule

Feature parity means **observable user behavior parity**, not copying Diagram 1's implementation.

For every Diagram 1 feature:

1. Determine what the feature does to canonical Diagram state.
2. Reproduce the user-facing behavior in Diagram 2.
3. Implement it through Diagram 2's incremental renderer architecture.
4. Re-think or redesign the internal implementation whenever copying Diagram 1 would reintroduce broad rendering, routing, DOM, or history costs.
5. Prove through diagnostics and tests that routine interaction does not fall back to Diagram 1-style full reconstruction.

Never import Diagram 1's performance problems merely to achieve code reuse.


# Phase 8 — Final Performance Hardening, 500/1,000-Entity Stress, and Promotion Readiness

## Purpose

Prove that feature parity did not destroy Diagram 2's performance advantages and determine whether it is ready to become PMT's primary Diagram editor.

## Expected outcome of this phase

- Diagram 2 has complete approved feature parity.
- Performance remains dramatically better than Diagram 1.
- Normal, 232, 500, and 1,000 Entity tiers are measured.
- No critical correctness, compatibility, memory, or lifecycle issues remain.
- Known limitations are documented honestly.
- Diagram 1 remains available until Sin separately approves promotion.

## Benchmark methodology

Use controlled, apples-to-apples comparisons.

For Diagram 1 and Diagram 2:

- Same document
- Same browser
- Same viewport
- Same CPU mode
- Same cache state
- Same timing boundaries
- Same number of repetitions
- Same inclusion/exclusion of network/database time
- Median, p90, p95, and maximum where practical

Do not compare a complete Diagram 1 page load against only a detached Diagram 2 renderer and label it an exact end-to-end factor.

Renderer-only comparisons are useful, but label them renderer-only.

## Required fixtures

### Tier A — Normal

- PMT Database Schema
- Approximately 28–30 Entities
- Real field counts and relationships
- Advanced PMT objects where available

### Tier B — Large office schema

- 220–232 Entities
- Approximately 624 relationships
- Sparse/dense variants
- High fan-out
- Self references
- Long routes
- Manual routes
- Advanced objects

### Tier C — 500 Entities

Use the latest production-shaped benchmark approach:

- Clone real PMT Schema patterns.
- Add realistic Entities.
- Add approximately 1–3 relationships per added Entity.
- Include realistic fields.
- Avoid a meaningless blank-box-only benchmark.

### Tier D — 1,000 Entities

Use a production-shaped fixture with:

- Realistic field counts
- 1–3 relationships per added Entity
- Long cross-sector routes
- Selected/active region
- Complete Fit
- Save/export
- Ten lifecycle cycles

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Dual-host benchmark and promotion requirements

Final performance and promotion testing must cover both Diagram 2 entry points.

### Top-navigation document host

Use the normal, 232-, 500-, and 1,000-Entity production-shaped fixtures. Measure the full editor, not a detached renderer alone:

- Route/navigation to first useful editor frame.
- Shell/toolbar/inspector readiness.
- Selection.
- Drag/resize start and preview.
- Inspector changes.
- Relationship editing/routing.
- Zoom/pan/settle.
- Fit/low-detail.
- Save/export.
- Open/close lifecycle.

### RTE annotation host

Use representative annotations containing:

- Large image assets.
- Many shapes/text objects.
- Rich text.
- Crop data.
- Entities and relationships.
- Field Rectangles and mappings.
- Field Mapping Tables.

Measure:

- Context-menu command to first useful frame.
- Parse and editor mount.
- Selection/drag/resize/crop.
- Inspector edits.
- Mapping interactions.
- Save-back time.
- Cancel/close time.
- Reopen time.
- Memory after repeated cycles.

### Controlled comparisons

Compare equivalent boundaries. Do not compare a complete Diagram 1 route against a detached Diagram 2 renderer and call it an end-to-end speedup.

Report median, p90/p95, maximum, full-render count, routing counts, mounted/canonical counts, DOM descendants, and memory behavior.

### Separate promotion gates

Report independently:

```text
Top-navigation Diagram 2 editor readiness
RTE Annotate 2.0 editor readiness
Diagram 1 document compatibility readiness
Diagram 1 RTE annotation compatibility readiness
```

The program is not fully promotable until both hosts pass.

### Replacement remains a separate approval

Even after Phase 8:

- Keep `Diagram` and `Diagram 2` side by side.
- Keep `Annotate` / `Edit Annotate`.
- Keep `Annotate 2.0` / `Edit Annotate 2.0`.
- Do not rename or redirect the original commands without Sin's separate approval.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## Required operations

Measure:

```text
Screen open
Canonical parse
First useful frame
Final settle
Selection
Multi-select
Marquee
Clear selection
Drag start
Drag preview p95
Resize start
Resize preview p95
Style change
Text edit commit
Entity field edit
Collapse/expand
Show/hide data types
Relationship style
Manual route edit
Mapping hover
Template apply
Paste
Undo
Redo
Continuous zoom
Pan
Sector crossing
Low-detail transition
Fit
Auto Format
Save
SVG export
PNG export
Import
Diagram 1 round-trip
Ten open/close cycles
```

## Renderer invariant tests

For routine operations assert:

- Full-render count does not increase.
- SVG root identity is stable.
- Unrelated object node identity is stable.
- Selection does not route.
- Style-only relationship updates do not route.
- Local geometry does not route all relationships.
- Same-sector scrolling changes no DOM.
- Selected/gesture objects stay mounted.
- Low detail never leaks to save/export.
- History uses commands for local operations.
- No unbounded state snapshots.
- No stale listeners/frames/observers/workers.

## Performance profiling and optimization

Use browser performance profiles to identify:

- Forced synchronous layouts
- Repeated text measurement
- Repeated serialization
- Excessive cloning
- Long tasks
- Relationship route hotspots
- Tree rendering hotspots
- Inspector re-render hotspots
- Image decoding
- Garbage generation
- Event listener churn
- Large paste/template transactions
- Auto Format compute

Optimize measured bottlenecks, not speculative ones.

Permitted improvements include:

- More indexes
- Memoized renderer-neutral derived data
- Coarser/finer measured sectors
- Worker-backed global layout
- Chunked noninteractive initial work
- Offscreen preparation
- Tree virtualization
- Coalesced form updates
- Object pooling only if measured and safe
- Lower-detail relationship aggregation
- Progressive optional detail

Do not sacrifice canonical correctness or interoperability.

## Promotion criteria

Recommend Diagram 2 as primary only if:

- Parity matrix is complete and approved.
- No critical regressions.
- Diagram 1 ↔ Diagram 2 round-trip matrix passes.
- 28 and 232 tiers meet normal interaction targets.
- 500 tier is practical.
- 1,000 tier opens and supports focused editing and low-detail overview.
- Memory stabilizes after repeated cycles.
- Save/export is complete.
- Accessibility and permissions pass.
- Known limitations are acceptable to Sin.

Do not remove Diagram 1 in this phase.

Provide options:

```text
Keep Diagram 2 Beta
Make Diagram 2 default but retain Diagram 1 fallback
Rename/promote Diagram 2 after separate approval
Retire Diagram 1 only after a later explicit decision
```

## Final report

Produce a permanent self-contained HTML report and Markdown summary containing:

- Executive verdict
- Feature parity results
- Controlled benchmark tables
- Charts
- Methodology
- Machine/browser details
- Normal and 6× CPU results
- Correctness and compatibility
- Memory/lifecycle
- Remaining limitations
- Recommendation
- Raw JSON data
- Screenshots

## Acceptance criteria

- Full parity is proven.
- Performance is proven with controlled tests.
- 500 and 1,000 Entity behavior is documented.
- No critical lifecycle leaks.
- No compatibility loss.
- Promotion recommendation is evidence-based.


## Diagram 2 performance constitution

These rules apply to every phase.

### Routine operations must remain incremental

The following must not call a complete live renderer rebuild in ordinary cases:

- Selection or selection clearing
- Hover
- Inspector tab switching
- Style changes
- Text changes
- Object movement
- Object resizing
- Collapse or expand
- Show or hide data types
- Layer visibility
- Z-order changes
- Relationship symbol or style changes
- Group membership changes
- Clipboard paste after the new objects have been parsed
- Undo or redo of an ordinary local operation

A full live render is reserved for:

- Initial document load
- A deliberately global import
- A truly global snapshot restore when no safe incremental alternative exists
- Catastrophic safe fallback after parsing or renderer failure
- Explicit diagnostic refresh

Every exception must be measured and documented.

### Preserve the Diagram 2 renderer's architecture

Do not bypass or weaken:

- Persistent keyed SVG nodes
- Separate SVG planes
- Transform-only zoom and pan
- Dirty-state categories and batched `requestAnimationFrame` flushes
- Live geometry previews
- Selective relationship routing
- Fixed-grid spatial indexes
- Viewport-plus-halo virtualization
- Low-detail overview rendering
- Canonical-state save and export
- Explicit renderer destruction and lifecycle cleanup

### No broad DOM replacement during interaction

Do not replace the complete SVG body, complete editor shell, or complete inspector during pointer movement or routine changes.

Avoid:

```javascript
host.innerHTML = buildWholeEditor();
svg.innerHTML = buildWholeDiagram();
renderer.render(completeState);
```

for ordinary local operations.

Prefer:

```javascript
controller.execute(command);
renderer.beginDiagramUpdate(reason);
renderer.updateObject(id, updater);
renderer.endDiagramUpdate(reason);
```

or a more efficient equivalent supported by the latest renderer.

### No accidental global scans on hot paths

Pointer movement, selection, hover, style updates, and local geometry commits must not repeatedly scan every object or relationship when indexed lookup is practical.

Use or extend:

- Object ID maps
- Relationship IDs by Entity
- Relationship IDs by field anchor
- Route bounds indexes
- Obstacle-sector indexes
- Viewport-sector indexes
- Selection sets
- Group membership indexes
- Field Mapping indexes

### Command-based history

Do not grow the current full-state JSON snapshot history into the final editor.

Implement renderer-neutral user commands or compact deltas for ordinary operations. One user gesture equals one undo entry. Undo and redo should replay inverse commands through dirty invalidation.

Global snapshots may remain for import, Auto Format, or other genuinely global operations, but they must be exceptional and bounded.

### Canonical state remains authoritative

Live mounted DOM, low-detail DOM, selection handles, transient transforms, route caches, dirty sets, viewport sectors, diagnostics, and editor UI state must not become persisted Diagram content.

Save and export must always derive from complete normalized canonical state.

### Performance regression gate

Each feature phase must record:

- Full-render count before and after the operation
- Dirty objects and relationships
- Objects patched
- Relationships considered and rerouted
- Flush count
- Flush duration
- DOM descendant count
- Mounted versus canonical counts where relevant
- Operation duration
- Memory/lifecycle observations when new listeners, observers, images, or workers are added

If a feature materially regresses an existing Diagram 2 benchmark, stop and redesign it before declaring the phase complete.



## Standard validation

Run the applicable commands:

```cmd
node --check <each changed JavaScript file>
cmd /c npm.cmd run check:js
cmd /c npm.cmd run test:js
cmd /c npm.cmd run test:browser -- <focused Diagram 2 and compatibility specs>
cmd /c dotnet build
git diff --check
```

Also run focused browser tests at both `1366x768` and `1920x1080` when layout or interaction changed.

Use the existing PMT Schema Diagram and the latest large Diagram fixtures. Do not rely only on synthetic micro-tests.

## Required completion report

```text
Phase completed:
Expected outcome status:
Files changed:
Diagram 1 behavior changed:
Diagram 2 user-visible behavior added:
Shared contracts affected:
Feature parity items completed:
Performance architecture preserved:
Before measurements:
After measurements:
Full-render count impact:
Routing impact:
DOM/mounted-node impact:
History/undo behavior:
Compatibility tests:
Automated tests:
Manual test steps:
Recompile required or Ctrl+F5 only:
Known limitations:
Deferred parity items:
Commit:
```
