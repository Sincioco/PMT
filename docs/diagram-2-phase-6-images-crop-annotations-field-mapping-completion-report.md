# Diagram 2 Phase 6 Images, Crop, Annotations, And Field Mapping Completion Report

Generated: 2026-07-30

Status: Complete for the authorized Diagram 2 Phase 6 scope. Phase 7 workflow promotion, Phase 8 performance promotion, release notes, and database work were not started.

## Baseline

Approved starting commit:

`cfafd1dfdde167c4b5fdc99a8feaf23239b92b1f`

The starting worktree was clean. Phase 5's implementation commit remains:

`237b229aa208dde69b4d29ecf07eb1335deac083`

`Sin and Codex: make Diagram 2 Compact match Diagram 1`

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

The alternating top-navigation/RTE lifecycle test passes five repeated cycles plus its baseline cycle in both viewports. The dedicated RTE test also passes ten cancel cycles.

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

The RTE fixture loads the real PMT token, base, dialog, image-annotation, Diagram, and Diagram 2 style sheets from a clean same-origin HTML page. Its screenshots therefore represent the real editor styling without starting an unrelated full application instance.

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
tests/browser/diagram2-rte-annotation.spec.mjs
tests/browser/image-annotation.spec.mjs
tests/js/diagram2-phase6.test.mjs
docs/diagram-2-editor-migration-architecture.md
docs/diagram-2-editor-parity-matrix.md
docs/diagram-2-phase-6-images-crop-annotations-field-mapping-completion-report.md
docs/screenshots/diagram-2-phase-6/*
```

## Automated Validation

Final observed evidence:

- `npm run check:js` - 187 JavaScript modules syntax-checked.
- `npm run test:js` - 430/430 passed in 834,511.362 ms.
- Focused controller/renderer/compatibility/Phase 6 run - 69/69 passed.
- D1 image annotation, Diagram 2 read-only shell, and Phase 6 compatibility run - 176/176 passed.
- Dedicated Compact parity - 27/27 passed with zero required mismatches.
- Phase 6 browser workflow - top-navigation at 1366/1920 plus localized 1,000-object mapping at 1920 passed.
- RTE browser workflow - 8/8 passed across 1366/1920, including save/reopen, mapping edit, cancel, ten-cycle cleanup, and permission enforcement.
- Final affected browser rerun - 17 passed with the 1,000-object 1366-only case intentionally skipped; zero failures.
- Full Diagram 2 navigation suite - 22/22 passed across 1366/1920 in 6.5 minutes.
- Broader Diagram 2 navigation, beta-readiness, and Diagram 1 image-annotation browser matrix - 36/36 passed across the completed runs.
- The 232-Entity/624-relationship browser gate retained one initial full render, zero routine full-render increase, and zero relationship reroutes for a style-only patch.
- `dotnet build -p:OutputPath=bin\CodexPhase6\` - succeeded with zero errors; the ordinary output path was locked by the running PMT development process.
- `git diff --check` - passed; Git reported only line-ending conversion notices.

The About 3D flyby was not tested because Phase 6 did not change it.

## Cache And Local Testing

The browser entry point, Diagram 2 CSS, both Diagram 2 hosts, changed renderer/controller modules, and their transitive Diagram compatibility dependencies use:

`20260730-diagram2-phase6-v1`

No application image asset changed. The new PNG files are documentation evidence only.

No .NET source changed. After this commit, **no .NET recompile is required for manual testing**. Use **Ctrl + F5** once to fetch the Phase 6 CSS and ES modules with the new cache token.

## Manual Acceptance Checklist

1. Open an existing Diagram in Diagram 2 and enter Edit mode.
2. Use Add Image with PNG and SVG files; verify missing-image fallback with an unavailable source.
3. Paste and drop an image; verify each creates one editable object through the existing upload path.
4. Resize, reorder, copy/paste, template, save, reopen, and export an image.
5. Confirm changing vector opacity does not alter a selected image.
6. Select an image and enter Crop. Adjust four insets, four independent corner radii, uniform radius, and keyboard handles.
7. Cancel a Crop preview and verify exact restoration with no Undo entry.
8. Commit Crop, Undo, Redo, reset it, and test confirmed permanent crop.
9. Create/edit an Entity Annotation with and without its arrow; move the Entity and verify the callout follows.
10. Create a Field Rectangle over a screenshot and map it to a database Entity field.
11. Change connection side and relationship type; verify automatic Field Rectangle naming.
12. Generate a Field Mapping Table and hover/focus its row; verify source, target field, row, and attention routes highlight.
13. Save and reopen through top-navigation Diagram 2.
14. Repeat image/crop/mapping through `Annotate 2.0` and `Edit Annotation 2.0`; verify Save updates the same RTE image.
15. Cancel the RTE host and verify no upload and unchanged RTE HTML.
16. Open read-only Diagram 2 and exercise mapping hover, click, double-click, and keyboard behavior.
17. Use diagnostics to confirm no extra full render, no repeated image decode, local mapping index work, and clean resource counts after close.

## Known Limitations

- Dedicated Excel/CSV Field Mapping Table workflow hardening remains in Phase 7, as required by the phase boundary.
- The permanent 1,000-object browser evidence runs at 1920 x 1080; the 1366 project intentionally skips that duplicate large-fixture case while still running the full functional workflow.
- No Phase 6 compatibility deferral or unsupported round trip was identified.

## Phase 7 Prerequisites

Phase 7 must build on the canonical Field Rectangle, mapping, and Field Mapping Table structures completed here. It must preserve the shared PMT Diagram, clipboard, template, image, and RTE contracts, the explicit renderer planes, and the localized diagnostics gates. No Phase 7 code was started.

## Database Impact

None. Phase 6 changes no database schema, stored procedure, version marker, migration, seed script, or upload endpoint.

## Commit Record

Phase 6 uses one coherent implementation checkpoint:

`Sin and Codex: complete Diagram 2 Phase 6 image and mapping parity`

The immutable final SHA is reported in the completion response and the public `Codex:` commit comment immediately after the checkpoint is created. A Git commit cannot embed its own final SHA in the content it hashes.

## Stop Boundary

Phase 6 is the completed boundary. Phase 7 and Phase 8 were not started.
