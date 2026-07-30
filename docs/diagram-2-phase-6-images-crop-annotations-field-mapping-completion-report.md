# Diagram 2 Phase 6 Images, Crop, Annotations, And Field Mapping Completion Report

Generated: 2026-07-30

Status: Complete for the authorized Diagram 2 Phase 6 scope. Phase 7 workflow promotion, Phase 8 performance promotion, release notes, and database work were not started.

## Baseline

Approved starting commit:

`cfafd1dfdde167c4b5fdc99a8feaf23239b92b1f`

The starting worktree was clean. Phase 5's implementation commit remains:

`237b229aa208dde69b4d29ecf07eb1335deac083`

`Sin and Codex: make Diagram 2 Compact match Diagram 1`

The D1 Crop parity correction started from:

`3dc131e17e6cb81c3de1bdc64127259b467d17f7`

The unrelated untracked `Requirements/2026-07-30 - Requirements - Day 39.txt` file was present at correction start and remains preserved and excluded from the commit.

The existing Diagram 1 RTE labels remain unchanged:

- `Annotate`
- `Edit Annotation`

The paired Diagram 2 labels remain:

- `Annotate 2.0`
- `Edit Annotation 2.0`

## Gap Matrix Result

The required 92-row Diagram 1 versus Diagram 2 audit was completed before editing. Every Phase 6-owned gap was classified by visible behavior, canonical state, command/history impact, renderer impact, host impact, compatibility, and performance risk.

Final result:

| Area | Result |
| --- | --- |
| Images | Complete for upload, file selection, drop, clipboard paste, embedded/portable source, original reference, missing fallback, resize, z-order, copy/paste, templates, save/export, keyed cache, and cleanup. |
| Image opacity | D1-compatible by design: PMT vector opacity does not alter source or embedded images. Diagram 2 preserves that exclusion. |
| Crop | Complete for mode entry/exit, handles, keyboard adjustment, insets, independent corners, radius, visibility, reset, original preservation, confirmed permanent crop, one-command commit, and cancel. |
| Entity annotations | Complete for create/edit/remove-compatible empty text, owner/child/group references, optional arrow, movement, copy/paste, templates, save/reopen, and both hosts. |
| Field Rectangles | Complete as D1-compatible virtual Entities with create/edit/name, connection side, mapping metadata, z-order, Objects tree, copy/paste, templates, undo/redo, and read-only rendering. |
| Field mappings | Complete for database Entity/field selection, relationship type, stable mapping IDs, automatic Field Rectangle rename, local index patches, mapping routes, attention arrows, editor/read-only interaction, and compatibility. |
| Field Mapping Tables | Complete for generation by source image, stable keyed rows, local synchronization, color/style persistence, hover/highlight, copy/template/save/export, and read-only behavior. Dedicated Excel/CSV workflow hardening remains Phase 7. |
| Shared hosts | Complete through one shared Phase 6 host adapter and the same controller, shell, renderer, and canonical commands in top-navigation and RTE. |
| Performance | Complete for Phase 6 functional gates: crop preview causes no canonical/history/full-render work; mapping hover is view-only; local mapping edits visit zero unrelated objects at 500/1,000 and reroute no unrelated Entity relationships. |

No second image store, mapping store, file format, clipboard format, template store, Diagram document type, endpoint, database table, stored procedure, migration, or seed change was introduced.

## Implementation

### Image Insertion And Resources

`diagram2-editor-images.js` owns small pure helpers for:

- safe image-file recognition;
- stable object IDs;
- stable source identity;
- image dimension loading; and
- compatible `embedded-image` creation.

Both hosts use the existing Rich Text upload callback. Image file selection, canvas drop, and clipboard paste all create one canonical image through controller history. URL/data sources remain compatible with Diagram 1 and the shared portable asset helpers.

`diagram2-image-resources.js` owns the live resource cache:

- one cache entry per stable source identity;
- shared in-flight decode promises;
- reference counts for mounted consumers;
- decode, hit, miss, release, active-count, and error diagnostics;
- listener removal;
- canceled decode protection; and
- Blob URL revocation when applicable.

Selection and unrelated style changes do not decode an image again. Missing resources render a deterministic fallback without corrupting canonical state.

### Crop

`diagram2-editor-crop.js` owns renderer-neutral crop math:

- insets;
- clip intersection;
- minimum 8-pixel crop dimensions;
- independent corner radii;
- uniform radius;
- resize-handle snapping;
- reset; and
- permanent-crop delegation to the existing D1 operation.

Pointer and keyboard previews live only in renderer state. Preview frames patch the selected image and crop overlay, suppress ordinary selection chrome, create zero history entries, and do not serialize the Diagram. Commit writes one command and restores selection. Cancel restores the exact original image/crop state. Confirmed permanent crop replaces the source and clears local undo because the operation is irreversible inside the annotation, matching D1.

#### D1 Crop UI/UX parity correction

The final Crop correction re-audited the live Diagram 1 implementation as the executable oracle before changing Diagram 2.

| D1 behavior | Observed result |
| --- | --- |
| Activate Crop on one unlocked image without a reversible crop | Keeps the image selected, enters Crop, starts at the full image boundary, hides ordinary selection handles, shows Crop handles, and focuses the workspace without scrolling it. |
| Activate Crop on a locked image | Rejects Crop without changing the image. |
| Activate Crop on a fixed original image | Allows Crop while preserving the fixed original-image role. |
| Activate Crop on an existing reversible crop | Offers `Cancel`, `Remove Crop`, and `Apply Crop Permanently` in that order. After Permanent is chosen, a hidden saved crop is temporarily revealed for confirmation and restored if the warning is canceled. |
| Main Radius | Applies one effective radius to all four corners and clamps it to the effective cropped dimensions and D1's 200-unit absolute maximum. |
| Individual corners | Changes only the requested corner, preserves the other three effective values, and returns to the uniform representation when all four values match. |
| Insets | Changes one edge while preserving the others and keeps at least 8 diagram units of effective width and height. |
| Numeric-option quiet period | Hides only ordinary selection chrome and restores it 3,000 ms after the last option adjustment. The selected object and Objects tree state remain intact. |
| Pointer handles | Preview immediately through renderer state, mutate no canonical data per pointer frame, and commit one history command at pointer release. |
| Exit, Reset, Undo, and Redo | Crop-toggle, Select, Escape, another tool, or another object closes the active mode consistently. Reset is undoable; Undo/Redo restores the whole committed adjustment. |
| Permanent crop | Requires confirmation, rasterizes the effective crop even when its saved visibility was off, resets crop metadata to the replacement source bounds, and clears local history as an irreversible D1 operation. |
| Save/Reopen and RTE | Reversible crop metadata survives document and RTE round trips through the existing shared annotation format. |

The D2 defect was the root-level `change` listener in `diagram2-editor-shell.js`. Its nine number inputs changed their displayed value while focused but did not update the image until blur, Tab, Enter, or another committed `change` event. D2 also lacked a Crop numeric scheduler and D1's independent three-second selection-chrome quiet period.

The correction keeps the implementation local:

- one shared trailing-edge scheduler owns all nine Crop number inputs;
- every `input` updates the pending values and restarts one 500 ms timer;
- the final burst commits one controller command and patches the selected image and Crop overlay;
- `change`, blur, Enter, tab switch, tool switch, object selection, Save, and normal close flush the same pending value without duplication;
- Escape and editor cancel discard an uncommitted value, restore the inspector from canonical state, and clear timers;
- Save awaits an already-started blur commit, so stale SVG metadata cannot be serialized;
- a separate 3,000 ms timer controls renderer-local selection suppression;
- the controller selection, selected Objects-tree item, image, Crop boundary, and Crop handles stay present while ordinary selection geometry is hidden; and
- pointer Crop remains immediate and outside the numeric debounce.

The renderer exposes focused Crop-adjustment operations and counters but no new architectural layer. The shared Phase 6 host owns scheduler lifecycle for both the top-navigation and RTE adapters, while the controller remains the only canonical/history owner.

### Entity Annotations

`diagram2-editor-entity-annotations.js` creates renderer-neutral plans for annotation text and optional arrows. The controller maintains:

- owner Entity to annotation child IDs;
- child to owner Entity;
- owner/child group references; and
- affected object/relationship IDs.

Moving the owner uses those indexes to patch the annotation callout and arrow without scanning every object.

### Field Rectangles And Mappings

`diagram2-editor-field-rectangles.js` preserves D1's virtual Entity contract. Field Rectangles remain `type: "entity"` with `entityKind: "field-rectangle"` and compatible field/mapping metadata. They have one visible field name, a connection side, database target metadata, relationship type, and standard object/group/layer properties.

Mapping a Field Rectangle:

1. chooses a real database Entity;
2. chooses a field;
3. chooses simple, one-to-one, one-to-many, or many-to-one behavior;
4. stores compatible mapping metadata;
5. renames the Field Rectangle to the database field;
6. updates affected table rows and routes; and
7. creates one undoable command.

`diagram2-editor-field-mappings.js` maintains full and incremental indexes for:

- objects by ID;
- normal Entities and Entity fields;
- source images;
- Field Rectangles;
- Field Mapping Tables;
- mappings by ID;
- mapping IDs by Field Rectangle;
- mapping IDs by target Entity;
- mapping IDs by target field;
- mapping IDs by source image;
- mapping IDs by table;
- stable row keys;
- highlight targets;
- relationship IDs; and
- mapping route bounds.

Local mapping patches use those indexes. The 500- and 1,000-object focused tests report zero unrelated incremental object visits.

### Field Mapping Tables

`diagram2-editor-field-mapping-tables.js` creates compatible tables from one source image and synchronizes rows by stable mapping-derived keys. One mapping edit patches only the affected row or source-image table. Table rows preserve:

- UI field;
- database Entity/field;
- source image;
- mapping ID;
- relationship type;
- header colors;
- UI colors;
- database colors;
- row hover fill;
- highlight color; and
- highlight thickness.

Standard PMT Diagram, SVG, PNG, clipboard, and template paths include the table. Dedicated Excel/CSV workflow promotion remains assigned to Phase 7.

### Shared Host

`diagram2-editor-phase6-host.js` is used by:

- the top-navigation Diagram 2 document editor;
- RTE `Annotate 2.0`; and
- RTE `Edit Annotation 2.0`.

It owns only shared UI actions and delegates canonical work to controller commands. The document host still owns document save/close/routing. The RTE host still owns the selected RTE image, save-back, upload boundary, cancel, focus restoration, and RTE cleanup.

## Compatibility, Round Trips, And History

The shared editable SVG metadata contract passed this RTE matrix:

| Created with | Reopened with | Result |
| --- | --- | --- |
| `Annotate` | `Edit Annotation` | PASS |
| `Annotate` | `Edit Annotation 2.0` | PASS |
| `Annotate 2.0` | `Edit Annotation 2.0` | PASS |
| `Annotate 2.0` | `Edit Annotation` | PASS |

Diagram 2 loads the same trusted metadata through `loadDiagramCanonicalState` and saves with the existing portable annotation builder. It does not infer editability from filenames, alt text, captions, visible SVG text, or URL patterns. The browser Save/Reopen test verifies that Diagram 2 updates the same selected RTE image and keeps it editable; Cancel verifies unchanged RTE HTML, zero uploads, cleanup, and focus restoration.

The document compatibility matrix also passed:

- Diagram 1 document -> Diagram 2 -> Save -> Diagram 1; and
- Diagram 2 document -> Diagram 1 -> Save -> Diagram 2.

The shared PMT Diagram, clipboard, and template contracts preserve images, crops, independent corner radii, Entity annotations, Field Rectangles, many-to-one mappings, Field Mapping Tables, styles, layering, visibility, locks, group references, and source-image/table-row references. No unsupported Phase 6 round trip was identified.

Image insertion, Crop commit, Entity annotation changes, Field Rectangle changes, mapping changes, and Field Mapping Table changes each use one controller command. Crop preview, mapping hover, selection, and read-only interaction create no history entry. Confirmed permanent crop clears the local undo stack because D1 treats source replacement as irreversible.

## Renderer Planes

The live renderer now uses this explicit paint order:

1. background;
2. screenshot images;
3. ordinary objects below Entity relationships;
4. Entity relationships;
5. ordinary objects between relationship layers;
6. Field Rectangle relationships;
7. ordinary objects above relationship layers;
8. Field Rectangles;
9. Field Mapping Tables;
10. mapping highlights;
11. selection;
12. gesture and Crop overlays.

This preserves screenshot/image layering and lets Field Rectangle routes remain above images without forcing a complete SVG rebuild. The three ordinary-object planes retain the legacy object-plane marker for descendant selectors.

## Incremental Renderer Behavior

Phase 6 adds:

- keyed image nodes and fallbacks;
- keyed crop clip paths and handles;
- keyed Field Rectangle nodes;
- keyed Field Mapping Table rows;
- keyed mapping highlight targets;
- local mapping route patches;
- image cache synchronization on changed image IDs;
- mapping index full-build and local-patch diagnostics; and
- crop/image/mapping counters in the diagnostics panel.

Routine operations do not call `renderer.render()`. Full render remains limited to initial open, import/reset, corruption recovery, and explicit benchmark setup.

Observed focused mapping metrics:

| Canonical objects | Full-build visits | Incremental visits | Local patch time |
| ---: | ---: | ---: | ---: |
| 500 | 500 | 0 | 0.04 ms |
| 1,000 | 1,000 | 0 | 0.03 ms |

The 1,000-object browser smoke also keeps the mapping edit localized and preserves unrelated Entity routes.

The image-resource fixture retained two objects with the same source using one decode and one cache hit. Releasing both removed the cache entry; releasing the Blob-backed fixture revoked its object URL. Selection and an unrelated style patch changed decode count, cached-image count, and full-render count by zero.

The 1,000-object fixture kept mounted object count at or below the 1,000 canonical objects. A local mapping edit patched the selected Field Rectangle, its route, and its keyed table row without mounting or rebuilding an additional canonical object set.

## Compact Preservation

The exact D1 Compact oracle was run before Phase 6 editing and again after implementation.

| Run | Result | Duration |
| --- | --- | ---: |
| Pre-edit dedicated oracle | 27/27 passed | 852,134.495 ms |
| Post-edit oracle inside the final full JS run | 27/27 passed | 834,095.451 ms |

Both runs report:

- zero Entity-position mismatches;
- zero automatic-route-point mismatches;
- zero locked/manual-route mutations;
- zero worker/inline mismatches;
- zero inline/D1 mismatches; and
- zero Compact planning full renders.

The 1,000-Entity cancellation fixture still terminates cleanly without committing state or history.

The closure hardening pass also persists Compact's exact automatic-route points with a geometry signature. Compact therefore creates a routes-only history/save change when Entity positions are already correct but saved routes are absent or stale. A fresh read-only renderer accepts the snapshot only when the current Entity/relationship geometry still matches; ordinary edits fall back to D2's real-time router until Compact is run again.

## Lifecycle

Validated cleanup covers:

- renderer destruction;
- controller destruction;
- image resource release;
- Blob URL revocation path;
- pending decode cancellation protection;
- Compact worker termination;
- observers;
- event listeners;
- live SVG/maps/indexes; and
- global debug references.

The alternating top-navigation/RTE lifecycle test passes five repeated cycles plus its baseline cycle in both viewports. The closure test adds ten mixed RTE cycles (`Annotate 2.0 -> Cancel`, `Annotate 2.0 -> Save`, and `Edit Annotation 2.0 -> Save`) alternated with top-navigation Diagram 2 sessions. Every closed snapshot has the same listener, object URL, animation frame, timer, worker, observer, renderer, controller, host, global-reference, and focus state.

## Permanent Screenshots

All Phase 6 screenshots were visually inspected.

| Screenshot | Viewport and evidence |
| --- | --- |
| `docs/screenshots/diagram-2-phase-6/diagram2-phase6-topnav-image-crop-1366x768.png` | 1366 x 768 top-navigation image and Crop inspector |
| `docs/screenshots/diagram-2-phase-6/diagram2-phase6-topnav-field-rectangle-mapping-1920x1080.png` | 1920 x 1080 top-navigation Field Rectangle mapping |
| `docs/screenshots/diagram-2-phase-6/diagram2-phase6-field-mapping-table-hover-1920x1080.png` | 1920 x 1080 table row hover and mapping highlights |
| `docs/screenshots/diagram-2-phase-6/diagram2-phase6-rte-annotate-image-crop-1366x768.png` | 1366 x 768 RTE `Annotate 2.0` image/crop |
| `docs/screenshots/diagram-2-phase-6/diagram2-phase6-rte-edit-field-mapping-1920x1080.png` | 1920 x 1080 RTE `Edit Annotation 2.0` mapping |
| `docs/screenshots/diagram-2-phase-6/diagram2-phase6-readonly-mapping-highlight-1920x1080.png` | 1920 x 1080 read-only mapping highlight |
| `docs/screenshots/diagram-2-phase-6/diagram2-phase6-large-localized-mapping-1920x1080.png` | 1920 x 1080 localized mapping in a 1,000-object Diagram |
| `docs/screenshots/diagram-2-phase-6/closure/documentation-treenav-scroll-preserved-1366x768.png` | Documentation deep TreeNav selection with retained scroll and focus |
| `docs/screenshots/diagram-2-phase-6/closure/diagram1-treenav-scroll-preserved-1366x768.png` | Diagram 1 deep TreeNav selection with retained scroll and focus |
| `docs/screenshots/diagram-2-phase-6/closure/diagram2-treenav-scroll-preserved-1366x768.png` | Diagram 2 deep TreeNav selection with retained scroll, focus, and route |
| `docs/screenshots/diagram-2-phase-6/closure/field-mapping-table-d1-idle-1920x1080.png` | D1 idle mapping-table oracle |
| `docs/screenshots/diagram-2-phase-6/closure/field-mapping-table-d2-idle-1920x1080.png` | D2 idle mapping-table parity |
| `docs/screenshots/diagram-2-phase-6/closure/field-mapping-table-d1-ui-cell-arrows-1920x1080.png` | D1 UI-cell activation, yellow highlights, and blue arrows |
| `docs/screenshots/diagram-2-phase-6/closure/field-mapping-table-d2-ui-cell-arrows-1920x1080.png` | D2 UI-cell activation with matching geometry |
| `docs/screenshots/diagram-2-phase-6/closure/field-mapping-table-d1-database-cell-arrows-1920x1080.png` | D1 database-cell activation and exact field endpoint |
| `docs/screenshots/diagram-2-phase-6/closure/field-mapping-table-d2-database-cell-arrows-1920x1080.png` | D2 database-cell activation with matching endpoint |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d1-entry-1366x768.png` | D1 Crop entry on the shared source image at 1366 x 768 |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d2-entry-1366x768.png` | D2 full-boundary Crop entry with ordinary selection chrome hidden |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d1-radius-selection-hidden-1920x1080.png` | D1 Radius 28 oracle during its selection-quiet period |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d2-radius-selection-hidden-1920x1080.png` | D2 Radius 28 while the input remains focused, with Crop boundary/handles retained |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d1-independent-corners-1920x1080.png` | D1 effective independent-corner result with top-left Radius 12 |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d2-independent-corners-1920x1080.png` | D2 matching independent-corner result |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d1-insets-1920x1080.png` | D1 18/24/12/18 inset result |
| `docs/screenshots/diagram-2-phase-6/closure/crop/crop-d2-insets-1920x1080.png` | D2 matching inset result and synchronized Crop overlay |

The RTE fixture loads the real PMT token, base, dialog, image-annotation, Diagram, and Diagram 2 style sheets from a clean same-origin HTML page. Its screenshots therefore represent the real editor styling without starting an unrelated full application instance.

## Phase 6 Closure Pass

### D1 Crop parity and debounced Radius preview

The focused browser fixture uses the same 1,600 x 900 canvas, 660 x 420 source image at `(60, 100)`, 90% zoom, 18/24/12/18 edge insets, uniform Radius 28, and top-left Radius 12 in D1 and D2. D2 visibly updates the rounded image while Radius remains focused, hides ordinary selection chrome, and keeps the Crop boundary and handles visible.

Observed no-Tab burst:

| Measurement | Result |
| --- | ---: |
| Real number-input `input` events | 20 |
| Trailing debounce duration | 500 ms |
| Debounce firings | 1 |
| History commands | 1 |
| Selected-image patches | 1 |
| Crop-overlay patches | 1 |
| Unrelated object patches | 0 |
| Relationship reroutes | 0 |
| Full renders | 0 |
| Repeated image decodes | 0 |
| Timer cleanups | 2 |
| Pending timers after quiet period | 0 |
| Selection-chrome quiet duration | 3,000 ms |

The transition fixture separately proves early blur/Tab flush, no duplicate 500 ms commit, Escape cancellation, inset isolation, independent-corner normalization, return to uniform radius, inspector-tab flush, tool-switch flush, object-selection flush, Undo/Redo, and zero pending timers. Radius is clamped to the smaller of D1's 200-unit maximum and half the effective crop dimensions.

Host coverage:

| Host | No-Tab numeric update | Flush/Save behavior | Cancel/cleanup |
| --- | --- | --- | --- |
| Top-navigation Diagram 2 Edit | PASS | PASS | PASS |
| RTE `Annotate 2.0` | PASS | PASS, including an in-flight blur commit before Apply | PASS |
| RTE `Edit Annotation 2.0` | PASS | PASS and reopens the saved Radius | PASS |
| Diagram 1 oracle | PASS | PASS | PASS |

Parity mismatch counts:

```text
Effective crop bounds:            0
Effective corner radii:           0
Selection suppression:            0
Undo/Redo final state:            0
Save/Reopen state:                0
Unexpected full renders:          0
Repeated image decodes:           0
```

### TreeNav continuity and filter parity

Documentation, Diagram 1, and Diagram 2 replaced their TreeNav markup after a selection. The browser therefore discarded the scroll position and focused DOM node; Diagram 2 could also perform a second route-driven render after the first restoration. The actual scroll owners are now captured immediately before replacement and restored after the replacement exists.

The shared `tree-nav-state.js` helper records the tree identity, `scrollTop`, `scrollLeft`, focused item, and selected item. Direct activation restores exact offsets and focus with `focus({ preventScroll: true })`; no centering is performed. External route activation expands/reveals a hidden path and scrolls only when the selected row is outside the visible pane. Expansion state, pane width/visibility, URL updates, and viewer updates remain owned by each feature.

The D1 and D2 filter dialogs now expose the same Search, Project, Sprint (including `Both`, `No Sprint`, and project-qualified sprint labels), Visibility, Group, Layout, Sort, Creator, and Last Editor options as Documentation. The tree projection applies each option in hierarchy and flat layouts without letting an already selected document bypass an active filter. Browser fixtures use more than 80 nested items and cover two pointer activations, keyboard activation, and one legitimate external reveal at both required viewports.

### D1 Field Mapping Table oracle

The D1 table layout, generated SVG, interactive SVG, field bounds, field label point, and read-only interaction paths were traced as one executable oracle. D2 keeps keyed nodes but consumes the same canonical layout and attention geometry. The behavior matrix is:

| Interaction | UI Field cell | Database Field cell |
| --- | --- | --- |
| Hover | Highlights the row, Field Rectangle, mapped Entity/field, and mapping trace; shows both temporary arrows without history or canonical mutation. | Same highlight/arrow behavior using the Database cell as the active accessible target. |
| Single click | Pins the row/highlights and starts both arrows for three seconds without recentering. | Same pinned behavior without recentering. |
| Double-click | Performs normal activation, then centers/focuses the Field Rectangle. | Performs normal activation, then centers/focuses the exact mapped field bounds, using the Entity fallback only when field geometry is unavailable. |
| Enter | Activates/pins and starts both arrows while preserving keyboard focus. | Same. |
| Space | Activates/pins and starts both arrows while preserving keyboard focus. | Same. |
| Escape | Clears the pinned state, highlights, arrows, and timer. | Same. |
| Click outside | Clears the pinned state, highlights, arrows, and timer. | Same. |

The table comparison includes dimensions, header/body rectangles, row/cell coordinates and metadata, text content/positions/colors, fills, borders, dividers, clipping, opacity, cursor, focus target, and column/row sizing. The closure fixture reports zero normalized table mismatches.

Mapping highlights and attention arrows are deliberately separate visual systems. The default mapping highlight remains yellow (`#facc15`, 9 diagram units in the fixture) and applies to the row, Field Rectangle, mapped Entity/field, and trace. The temporary arrows use the D1 focus-ring color (`rgb(93, 224, 213)` in the current theme), a 2 px non-scaling dashed line (`7 4`), round caps, 0.92 opacity, a solid arrowhead, and zoom-aware 12-unit head geometry.

Each activation draws two arrows:

1. The UI arrow starts six visual pixels after the measured UI label and terminates at the Field Rectangle edge in the arrow direction.
2. The Database arrow starts six visual pixels after the measured Database label and terminates at `annotationEntityFieldLabelPoint(...)`, then field bounds, then the outer Entity edge only as genuine fallbacks.

For the permanent fixture, the UI start is `(994.376, 535.67)` and its Field Rectangle edge tip is `(428.23, 318)`. The Database start is `(1172.95, 535.67)` and its exact mapped-field tip is `(1035.4, 176.35)`. The rendered line bases are `(439.431, 322.306)` and `(1039.69, 187.557)` respectively. The real browser lifetime is `3014.3 ms`, within the required `3000 +/- 150 ms` window. A new activation cancels/replaces the prior timer; expiration removes only arrow nodes; Escape, outside click, renderer destroy, and navigation clear the timer and transient nodes.

Top-navigation read-only/edit, `Annotate 2.0`, `Edit Annotation 2.0`, and exported interactive SVG paths preserve cell-level behavior. Hover/click/double-click/keyboard activity changes zero canonical fields, creates zero history entries, causes zero full renders, rebuilds zero unrelated rows, and reroutes zero unrelated relationships. Temporary arrows/highlights are never serialized.

### Remaining closure gaps

- Marquee pointer movement now patches only the rectangle boundary. Hit-testing and selection changes run once at pointer-up, and a completed blank-canvas click clears the previous selection.
- A real file-backed Playwright drop and a real image `ClipboardEvent` each upload once, add one canonical image, create one history entry, avoid a full render, and survive save/reopen. Text-only clipboard content remains untouched.
- Permanent crop replaces the image source with the cropped PNG, normalizes the crop to the new full bounds, verifies old/new dimensions, releases the old renderer resource once, decodes the replacement once, preserves cache cardinality, clears local history per D1, and survives save/reopen.
- The mixed ten-cycle lifecycle test covers cancel and six successful saves while alternating RTE/top-navigation hosts and starting a mapping timer each cycle.
- Physical D1 to D2 to D1 and D2 to D1 to D2 RTE round trips preserve reversible crop, Field Rectangle, many-to-one mapping, table colors/row styles, Entity annotation children/arrows, and editable metadata. Transient attention arrows are absent from saved SVG.
- D2 initial mount now consumes the saved zoom. Low detail simplifies Entity contents but preserves the same relationship endpoints, bends, manual routes, and Compact output used above the 25% detail threshold. Large diagrams avoid synchronous exact rerouting during real-time gestures by using one fast orthogonal route policy at every zoom. The explicit Compact action finalizes D1's exact route points in its worker and shows progress while it runs. The 29-Entity/78-relationship focused fixture has zero D1 path mismatches before/after detail promotion and after a serialized fresh read-mode render. Live document 31 selected from `pmt.WorkTasks` produces an unsaved routes-only change when no Entity moves; all 83 paths remain identical after Save, Close to read mode, and a full reload.

### Relationship joint release performance correction

The blocking symptom was isolated to relationship-joint `pointerup`. Pointer movement and the blue preview path remained responsive, but releasing a joint could freeze the 96-Entity/257-relationship fixture for about 1.6 seconds and the 232-Entity/624-relationship fixture for about 13.7 seconds.

The old release path discarded the final preview and sent one FK route-point change through the generic structure-state planner and command. That path normalized the complete state twice, enumerated all relationships to rediscover the selected connector, mapped the complete object array, compared complete states with `JSON.stringify`, captured a complete history snapshot, rebuilt controller and renderer object/relationship/annotation/mapping indexes, and refreshed broad shell content. On the first manual edit, `manualEntityRelationshipRoutes` changed from `false` to `true`; the renderer treated that global Boolean change as an all-relationships dirty change. The failing dense fixtures therefore marked all 257 or 624 canonical relationships dirty and routed that broad set even though only one FK had changed.

Diagram 1 was used as the interaction oracle. D1 mutates the selected `foreignKeySource.routeOverride` while the segment moves; release primarily records history/status and retains that exact geometry. D2 now keeps its better transient preview, but release passes the final normalized preview points and path directly to a dedicated route command.

The failing pre-fix run was intentionally limited to one release per fixture after the 232/624 case blocked for 13.7 seconds. In this one-sample baseline, median and p95 are necessarily the same value:

| Fixture | Pre-fix settled median/p95 | Pre-fix visible-path median/p95 | Largest release task |
| --- | ---: | ---: | ---: |
| 2 Entities / 1 relationship | 24.8 / 24.8 ms | 9.1 / 9.1 ms | No task over 50 ms |
| 96 Entities / 257 relationships | 1,558.6 / 1,558.6 ms | 1,543.2 / 1,543.2 ms | 1,527 ms |
| 232 Entities / 624 relationships | 13,697.5 / 13,697.5 ms | 13,665.7 / 13,665.7 ms | 13,611 ms |
| 500 Entities / 1 focused relationship | 85.1 / 85.1 ms | 61.8 / 61.8 ms | No task over 50 ms |
| 1,000 Entities / 1 focused relationship | 177.6 / 177.6 ms | 149.2 / 149.2 ms | 96 ms |

The corrected benchmark runs 20 real handle drags per fixture after module warm-up:

| Fixture | Settled median/p95 | Committed visible path median/p95 | Largest synchronous release |
| --- | ---: | ---: | ---: |
| 2 Entities / 1 relationship | 11.0 / 13.1 ms | 0.6 / 0.8 ms | 1.2 ms |
| 96 Entities / 257 relationships | 10.6 / 11.2 ms | 0.6 / 0.7 ms | 1.0 ms |
| 232 Entities / 624 relationships | 19.0 / 20.3 ms | 1.1 / 1.4 ms | 1.6 ms |
| 500 Entities / 1 focused relationship | 18.4 / 20.2 ms | 5.4 / 7.0 ms | 20.3 ms |
| 1,000 Entities / 1 focused relationship | 40.7 / 45.8 ms | 14.0 / 15.7 ms | 52.3 ms |

The p95 release stages remained local:

| Fixture | Plan | Canonical | History | Renderer | Shell |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 / 1 | 0.2 ms | 0.1 ms | 0.2 ms | 0.7 ms | 0.0 ms |
| 96 / 257 | 0.1 ms | 0.1 ms | 0.2 ms | 0.6 ms | 0.0 ms |
| 232 / 624 | 0.1 ms | 0.1 ms | 0.3 ms | 1.2 ms | 0.1 ms |
| 500 / 1 | 0.1 ms | 0.1 ms | 0.1 ms | 6.8 ms | 0.1 ms |
| 1,000 / 1 | 0.1 ms | 0.1 ms | 0.2 ms | 15.6 ms | 0.1 ms |

The localized boundary is:

1. The gesture ends pointer capture and drag CSS immediately, retains the final preview, and sends its exact points/path to `commitRelationshipRouteOverride(...)`.
2. A relationship locator index resolves relationship ID to source Entity and FK index without recreating all relationship objects. Route-only changes patch that record and do not rebuild the index.
3. `createDiagram2RelationshipRouteCommand(...)` stores only previous/next route points, manual-route mode, stable source/FK identity, selection, and any dormant overrides whose effective display truly changes on the first manual-route transition.
4. Canonical state copies one object array, one source Entity, one FK array, and one FK. It performs no full normalization, serialization, object-index rebuild, annotation-index rebuild, mapping-index rebuild, or relationship recount.
5. The renderer patches the supplied path, route handles, route cache, bounds, and route sector, then removes the preview. It runs no automatic router and causes no dirty flush or full render. Identical SVG attributes are not rewritten.
6. Top-navigation and RTE hosts update only save/dirty, Undo/Redo, selection, and relationship Inspector controls. Objects, Templates, and the full editor shell are not rebuilt.

Normal-drag diagnostics are one relationship lookup, one object visit/patch, one FK patch, one relationship considered, zero relationships rerouted, zero index rebuilds, zero full-state normalization/serialization, zero dirty flushes, zero full renders, and one history entry. The five fixtures produced 100 entries for 100 completed drags with zero preview leaks, duplicate handles, DOM growth, viewport changes, selection changes, or route drift. Undo and Redo restore exact points through the same local path; Escape/pointer cancellation changes neither canonical revision nor history.

The renderer's merged relationship paint is a style-group path, so a route commit still reconstructs that paint string from already cached mounted route geometry. It does not recreate relationship lookup maps, run the router, or invalidate unrelated route sectors. This bounded paint step measured 1.2 ms p95 on the 232/624 fixture and 15.6 ms p95 on the 1,000-Entity focused fixture. The final post-warm-up run observed one 54 ms browser long task in the 1,000-Entity fixture; the settled p95 remained 45.8 ms and no tested release exceeded the 100 ms hard task gate.

Closure counters:

```text
TreeNav scroll regressions:              0
D1/D2 table geometry mismatches:         0
D1/D2 attention-arrow geometry errors:   0 outside tolerance
Missing three-second blue arrows:        0
Canonical mutations from hover/click:    0
History entries from hover/click:        0
Additional full renders from arrows:     0
D1 Compact mismatches:                   0
Low/high zoom relationship mismatches:   0
Document 31 Compact path changes:        83 of 83
Document 31 Save/read path mismatches:    0 of 83
Document 31 reload path mismatches:       0 of 83
D1/D2 effective Crop-bound mismatches:    0
D1/D2 effective corner mismatches:        0
Crop input events in focused burst:       20
Crop debounce firings/history commands:   1 / 1
Crop image/overlay patches:               1 / 1
Crop unrelated object/route work:         0 / 0
Crop full renders/repeated decodes:        0 / 0
Route-release drags measured:              100
Route-release history entries:            100
Route-release relationships considered:   1 per drag
Route-release relationships rerouted:     0 per drag
Route-release object/FK patches:           1 / 1 per drag
Route-release index rebuilds:              0
Route-release full renders/dirty flushes:  0 / 0
Route-release Compact mismatches:          0
```

## Files Changed

Phase 6 implementation:

```text
wwwroot/css/features/diagram2.css
wwwroot/index.html
wwwroot/js/app.js
wwwroot/js/components/image-annotation.js
wwwroot/js/features/diagram2/diagram2-editor-controller.js
wwwroot/js/features/diagram2/diagram2-editor-crop.js
wwwroot/js/features/diagram2/diagram2-editor-entity-annotations.js
wwwroot/js/features/diagram2/diagram2-editor-field-mapping-tables.js
wwwroot/js/features/diagram2/diagram2-editor-field-mappings.js
wwwroot/js/features/diagram2/diagram2-editor-field-rectangles.js
wwwroot/js/features/diagram2/diagram2-editor-images.js
wwwroot/js/features/diagram2/diagram2-editor-interactions.js
wwwroot/js/features/diagram2/diagram2-editor-phase6-host.js
wwwroot/js/features/diagram2/diagram2-editor-relationships.js
wwwroot/js/features/diagram2/diagram2-editor-shell.js
wwwroot/js/features/diagram2/diagram2-image-resources.js
wwwroot/js/features/diagram2/diagram2-renderer.js
wwwroot/js/features/diagram2/diagram2-rte-host-adapter.js
wwwroot/js/features/diagram2/diagram2.js
```

Cache-coherent dependency edges:

```text
wwwroot/js/components/diagram-field-mapping-interactions.js
wwwroot/js/features/diagram/diagram.js
wwwroot/js/features/diagram/pmt-database-schema.js
wwwroot/js/features/diagram/pmt-diagram-file.js
wwwroot/js/features/diagram2/diagram2-compact-engine.js
wwwroot/js/features/diagram2/diagram2-compact-worker.js
wwwroot/js/features/diagram2/diagram2-compatibility.js
wwwroot/js/features/diagram2/diagram2-editor-entities.js
wwwroot/js/features/diagram2/diagram2-editor-relationships.js
wwwroot/js/features/diagram2/diagram2-editor-structure.js
wwwroot/js/features/diagram2/diagram2-editor-templates.js
wwwroot/js/features/diagram2/diagram2-route-costing.js
wwwroot/js/features/diagram2/diagram2-routing.js
wwwroot/js/shared/diagram-contracts.js
wwwroot/js/shared/diagram-documents.js
```

Tests and documentation:

```text
tests/browser/diagram2-beta-readiness.spec.mjs
tests/browser/diagram2-navigation.spec.mjs
tests/browser/diagram2-phase6.spec.mjs
tests/browser/diagram2-relationship-route-performance.spec.mjs
tests/browser/diagram2-rte-annotation.spec.mjs
tests/browser/image-annotation.spec.mjs
tests/js/diagram2-editor-controller.test.mjs
tests/js/diagram2-phase6.test.mjs
docs/diagram-2-editor-migration-architecture.md
docs/diagram-2-editor-parity-matrix.md
docs/diagram-2-phase-6-images-crop-annotations-field-mapping-completion-report.md
docs/screenshots/diagram-2-phase-6/*
```

## Automated Validation

Final Crop-correction evidence:

- `npm run check:js` - 189 JavaScript modules syntax-checked in 7 seconds.
- Focused Phase 6 unit test - 15/15 passed in 117.4092 ms.
- Exact D1 Compact oracle - 28/28 passed in 187,827.1912 ms. All 21 parity fixtures retained zero Entity-position, automatic-route, locked/manual-route, route-contact, overlap, and full-render mismatches.
- `npm run test:js` - 433/434 passed in 186,460.4117 ms. The sole failure is unrelated: the preserved, untracked `Requirements/2026-07-30 - Requirements - Day 39.txt` raises the historical prompt count to 37 while the repository's current release-note data contains 36 entries. The Crop and Compact tests in that run passed.
- Diagram 2 Phase 6 at 1366 x 768 - 4 passed, 2 expected large-fixture skips, 22.0 seconds.
- Diagram 2 Phase 6 at 1920 x 1080 - 6/6 passed, 29.4 seconds.
- RTE Annotate/Edit 2.0 at 1366 x 768 - 5/5 passed, 14.2 seconds.
- RTE Annotate/Edit 2.0 at 1920 x 1080 - 5/5 passed, 14.2 seconds.
- Diagram 1 Image Annotation at 1366 x 768 - 4/4 passed, 5.6 seconds.
- Diagram 1 Image Annotation at 1920 x 1080 - 4/4 passed, 6.7 seconds.
- Required browser matrix total - 28 passed, 2 expected skips, 0 failures.
- No-Tab focused browser burst - 20 input events, 1 debounce firing, 1 image patch, 1 Crop-overlay patch, 1 history command, 0 unrelated object patches, 0 relationship reroutes, 0 full renders, 0 repeated decodes, 2 timer cleanups, and 0 pending timers.
- D1/D2 Crop fixture - zero mismatches for effective bounds, effective corner radii, selection suppression, Undo/Redo final state, Save/Reopen, full renders, and repeated decodes.
- `dotnet build` reached compilation but could not replace the running server's locked `bin/Debug/net6.0/PMT.exe`. The final `dotnet build -p:OutputPath=bin\CodexPhase6CropClosure\` run succeeded in 6.30 seconds with zero errors and two existing .NET 6 end-of-support warnings.
- `git diff --check` - passed after documentation and screenshot cleanup.

Relationship route-release correction evidence:

- Changed-file syntax checks - 38/38 JavaScript and browser-test files passed.
- `npm run check:js` - 190 JavaScript modules syntax-checked.
- Focused controller/renderer suites - 50/50 passed in 1.32 seconds of Node test time.
- Exact D1 Compact oracle - 28/28 passed in 188.37 seconds; all 21 parity fixtures retained zero Entity-position, automatic-route, locked/manual-route, route-contact, overlap, and full-render mismatches.
- `npm run test:js` - 433/434 passed in 188.79 seconds. The sole unrelated failure remains the preserved untracked Day 39 prompt count (`36 !== 37`); every Diagram 2 controller, renderer, route, history, and Compact test passed.
- Dedicated release benchmark - 1/1 passed in 8.7 seconds; 100 measured drags, 100 history entries, zero preview/path mismatches, zero selection or viewport changes, zero duplicate handles or DOM growth, zero broad index rebuilds, zero dirty flushes, and zero full renders.
- Diagram 2 navigation - 12/12 at 1366 x 768 in 68.9 seconds and 12/12 at 1920 x 1080 in 80.0 seconds. Real top-navigation route commits measured 9.3 ms and 2.8 ms respectively.
- Diagram 2 Phase 6 - 4 passed and 2 expected large-fixture skips at 1366 x 768 in 22.4 seconds; 6/6 passed at 1920 x 1080 in 30.5 seconds.
- RTE Annotate/Edit 2.0 - 5/5 at 1366 x 768 in 14.3 seconds and 5/5 at 1920 x 1080 in 14.4 seconds. Route commits ranged from 8.8 to 10.9 ms.
- Diagram 1 Image Annotation - 4/4 at 1366 x 768 in 5.7 seconds and 4/4 at 1920 x 1080 in 6.7 seconds.
- Required browser matrix total - 52 passed, 2 expected skips, 0 final failures; the dedicated 100-drag performance test also passed.
- Normal `dotnet build` reached compilation but could not replace the running server's locked `bin/Debug/net6.0/PMT.exe` (PID 796). The alternate-output build succeeded in 9.19 seconds with zero errors and the two existing .NET 6 end-of-support warnings.
- `git diff --check` - passed before final review.

The About 3D flyby was not tested because Phase 6 did not change it.

## Cache And Local Testing

The browser entry point, both Diagram 2 hosts, changed renderer/controller modules, and their transitive Diagram compatibility dependencies use:

`20260731-diagram2-route-release-v15`

No application CSS or image asset changed for the route-release correction.

No .NET source changed. After this commit, **no .NET recompile is required for manual testing**. Use **Ctrl + F5** once to fetch the Phase 6 CSS and ES modules with the new cache token.

## Manual Acceptance Checklist

1. Open an existing Diagram in Diagram 2 and enter Edit mode.
2. Use Add Image with PNG and SVG files; verify missing-image fallback with an unavailable source.
3. Paste and drop an image; verify each creates one editable object through the existing upload path.
4. Resize, reorder, copy/paste, template, save, reopen, and export an image.
5. Confirm changing vector opacity does not alter a selected image.
6. Select an image and enter Crop. Adjust four insets, four independent corner radii, uniform radius, and keyboard handles. Keep the Radius input focused and confirm the canvas updates about 500 ms after input stops without pressing Tab.
7. During a numeric adjustment, confirm ordinary selection handles hide immediately while the Crop boundary and handles remain visible, then return about three seconds after the last input.
8. Cancel a pending numeric adjustment with Escape and verify exact restoration with no Undo entry.
9. Commit Crop, Undo, Redo, reset it, and test confirmed permanent crop.
10. Create/edit an Entity Annotation with and without its arrow; move the Entity and verify the callout follows.
11. Create a Field Rectangle over a screenshot and map it to a database Entity field.
12. Change connection side and relationship type; verify automatic Field Rectangle naming.
13. Generate a Field Mapping Table and hover/focus its row; verify source, target field, row, and attention routes highlight.
14. Save and reopen through top-navigation Diagram 2.
15. Repeat image/crop/mapping through `Annotate 2.0` and `Edit Annotation 2.0`; verify Save updates the same RTE image.
16. Cancel the RTE host and verify no upload and unchanged RTE HTML.
17. Open read-only Diagram 2 and exercise mapping hover, click, double-click, and keyboard behavior.
18. Use diagnostics to confirm no extra full render, no repeated image decode, local mapping index work, and clean resource counts after close.
19. Select a relationship, drag one blue route joint repeatedly, and verify release is immediate with no preview flicker.
20. Undo and Redo the route edit, then cancel another drag with Escape; verify exact points, retained selection, and no canceled history entry.
21. Repeat the route release in `Annotate 2.0` and `Edit Annotation 2.0`, then save/reopen and verify the route remains identical.

## Known Limitations

- Dedicated Excel/CSV Field Mapping Table workflow hardening remains in Phase 7, as required by the phase boundary.
- The permanent 1,000-object browser evidence runs at 1920 x 1080; the 1366 project intentionally skips that duplicate large-fixture case while still running the full functional workflow.
- Merged relationship segments remain a renderer paint grouping. A one-route commit rebuilds that grouped path from cached mounted geometry, but performs no unrelated routing or index rebuild.
- No Phase 6 compatibility deferral or unsupported round trip was identified.

## Phase 7 Prerequisites

Phase 7 must build on the canonical Field Rectangle, mapping, and Field Mapping Table structures completed here. It must preserve the shared PMT Diagram, clipboard, template, image, and RTE contracts, the explicit renderer planes, and the localized diagnostics gates. No Phase 7 code was started.

## Database Impact

None. Phase 6 changes no database schema, stored procedure, version marker, migration, seed script, or upload endpoint.

## Commit Record

The current Phase 6 closure correction uses:

`Sin and Codex: eliminate Diagram 2 route joint release latency`

The immutable final SHA is reported in the completion response. This correction stops after the local commit; no push was requested by the attached execution file. A Git commit cannot embed its own final SHA in the content it hashes.

## Stop Boundary

Phase 6 is the completed boundary. Phase 7 and Phase 8 were not started.
