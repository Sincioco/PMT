# Diagram 2 Editor Migration Architecture

This architecture note records the Diagram 1 and Diagram 2 code paths, the migration boundaries, the shared contract candidates, and the performance baselines that must stay visible throughout the Diagram 2 editor parity work.

Phase 1 changed documentation only. Phase 2 adds the production Diagram 2 editor shell, shared editor controller, command history, document host adapter, and RTE annotation host adapter. Diagram 1 remains available side by side, and both top-navigation Diagram screens continue to use the same Diagram backing documents, template endpoints, clipboard package, security resource, and PMT Diagram file format.

The post-Phase 1 visual editor parity addendum is incorporated into this architecture. Diagram 2 should feel like the Diagram 1 editor that users already know while keeping Diagram 2's high-performance renderer and command pipeline. The final target is familiar UI, familiar behavior, identical persisted Diagram results, and a different implementation underneath.

## Current Code Inventory

| Area | Current files | Current responsibility |
| --- | --- | --- |
| Diagram 1 feature shell | `wwwroot/js/features/diagram/diagram.js` | Diagram document library, filters, card/tree actions, read-only viewer, editor invocation, import/export, duplicate, metadata edit. |
| Diagram 1 editor implementation | `wwwroot/js/components/image-annotation.js` | Full annotation/editor UI, toolbar, inspector tabs, object tree, gestures, crop, templates, mapping, entity/relationship behavior, SVG/PNG/clipboard helpers, history snapshots. |
| Diagram 1 schema helper | `wwwroot/js/features/diagram/pmt-database-schema.js` | Loads/generates PMT database schema objects for Diagram entities. |
| Diagram 2 feature shell | `wwwroot/js/features/diagram2/diagram2.js` | Diagram 2 route/screen, shared Diagram document library, Diagram 1-familiar editor shell, basic selection/move/nudge, command history, save, export/copy, and renderer diagnostics behind a collapsible surface. |
| Diagram 2 live renderer | `wwwroot/js/features/diagram2/diagram2-renderer.js` | Canonical normalization, persistent keyed SVG nodes, dirty state, spatial indexes, viewport transforms, viewport halo, low-detail overview, route invalidation, lifecycle cleanup. |
| Diagram 2 compatibility adapter | `wwwroot/js/features/diagram2/diagram2-compatibility.js` | Uses the shared file/template/clipboard contract and blocks renderer cache persistence. |
| Diagram 2 editor core | `wwwroot/js/features/diagram2/diagram2-editor-controller.js`, `diagram2-editor-history.js`, `diagram2-editor-shell.js`, `diagram2-editor-structure.js`, `diagram2-editor-templates.js` | Shared controller, cached capability guard, renderer-neutral commands, bounded undo/redo, shared shell regions, toolbar/object pane/inspector/status projection, group/tree/layer planning, and shared template/default helpers. |
| Diagram 2 host adapters | `wwwroot/js/features/diagram2/diagram2-document-host-adapter.js`, `diagram2-rte-host-adapter.js` | Host-specific save, security capabilities, lifecycle, route/RTE concerns, and cleanup while reusing the same editor core and renderer. |
| Shared diagram contracts | `wwwroot/js/shared/diagram-contracts.js` | `pmt-diagram` v1 file contract, `pmt-diagram-selection` v1 clipboard contract, template endpoint constants, normalization helpers. |
| Shared document access | `wwwroot/js/shared/diagram-documents.js` | Loads/saves the same Diagram backing documents for both screens. |
| Rich-text image annotation entry | `wwwroot/js/app.js` | Current Diagram 1 RTE image context menu, `Annotate`/current `Edit Annotation` label, selected-image save-back, cancel/focus restoration. |
| Styles and navigation | `wwwroot/css/features/diagram.css`, `wwwroot/css/features/diagram2.css`, `wwwroot/index.html`, `wwwroot/js/app.js` | Separate visual shells and routes for Diagram and Diagram 2. |
| Tests | `tests/js/*diagram*.mjs`, `tests/browser/diagram2-*.spec.mjs`, `tests/browser/image-annotation.spec.mjs` | Contract, renderer, compatibility, navigation, beta-readiness, and Diagram 1 annotation smoke coverage. |

## Migration Principles

- Diagram 1 remains available and operational during every phase.
- Diagram 2 must keep its own route, feature module, renderer, preferences, and beta label until manually promoted.
- Visual parity is the default. Diagram 2's editor layout, toolbar grouping/order, center canvas, right inspector tabs, right-pane Objects tab, dialogs, context menus, affordances, keyboard shortcuts, and save/import/export workflows should match the approved Phase 2 baseline unless Sin explicitly approves a visible change.
- Diagram 1 and Diagram 2 must keep one Diagram backing-document model. Do not introduce a Diagram 2 table, second save endpoint, second template library, second clipboard shape, or second file format.
- Persisted Diagram state may include canonical annotation data only. Renderer caches, mounted node maps, viewport halo state, dirty flags, diagnostics, and live indexes stay session-only.
- Routine Diagram 2 editor operations must use command-driven canonical changes and incremental renderer patches. Full `renderer.render()` remains acceptable for initial open, import, full reset, corruption recovery, and explicit benchmark setup.
- Save/export may rebuild SVG from canonical state off-screen, but that must not become the normal live edit repaint mechanism.
- Renderer diagnostics, benchmark counters, and refresh controls must not dominate the production editor. They belong behind a development-only or collapsible diagnostics surface.
- Diagram 2 has two required launch hosts: the RTE image annotation host and the top-navigation Diagram document host. They must share one Diagram 2 editor core and one Diagram 2 renderer. Only host adapters may differ.
- Diagram 2 permission resolution is session-scoped. The top-navigation host resolves Documentation and document capabilities when a document editor session opens; the RTE host receives capabilities from the originating editable RTE context. The shared core reads cached Booleans at command boundaries and defaults to read-only without an explicit `canUpdate: true`.
- Continuous gestures check the cached update capability when the gesture starts and again at final command commit. Pointer movement, resize previews, route previews, color previews, renderer flushes, and viewport updates must not perform repeated permission resolution.

## Shared Helper Candidates

These helpers are safe candidates for extraction or reuse because they are either already shared or can be made renderer-neutral with narrow inputs and outputs.

| Candidate | Current source | Target responsibility |
| --- | --- | --- |
| File and clipboard codecs | `wwwroot/js/shared/diagram-contracts.js` | Keep `pmt-diagram` and `pmt-diagram-selection` v1 compatible both directions. |
| Backing document loader/saver | `wwwroot/js/shared/diagram-documents.js` | Keep both screens on the same Diagram document records and row-version behavior. |
| SVG/state parser and builder | `image-annotation.js` exports | Parse canonical state and build persisted SVG from canonical state for save/export. |
| Entity parsing/field ordering | `image-annotation.js` entity helper exports | SQL parsing, field parsing, FK-at-top, alphabetize, visible field projection. |
| Entity field mapping helpers | `image-annotation.js` mapping helper exports | Normalize UI-to-DB field links and mapping targets. |
| Relationship geometry helpers | `image-annotation.js` relationship/route helper exports | Endpoint math, relationship style defaults, route override transforms. |
| Object tree projection | `image-annotation.js` object tree helper exports | Build/filter/reorder object tree data without coupling to the old editor DOM. |
| Template normalization | `image-annotation.js` template helper exports plus shared contracts | Capture, parse, instantiate, and apply templates across both editors. |
| Crop and bounds math | `image-annotation.js` crop/workspace helper exports | Keep image crop, output bounds, workspace bounds, and reversible crop behavior consistent. |
| Clipboard rendering/export helpers | `image-annotation.js` copy/export helpers | Keep PNG/SVG/selection copy outputs compatible while isolating live renderer state. |
| Renderer-neutral visual builders | `annotationDialogHtml`, toolbar button helpers, inspector tab markup, object tree row builders, context menu markup | Reuse or mirror labels, icons, tooltips, order, ARIA, tab names, and control groupings without inheriting Diagram 1's renderer lifecycle. |
| Renderer-neutral CSS tokens/classes | `wwwroot/css/components/image-annotation.css`, shared button/form/dropdown styles | Reuse familiar editor styling where safe; create Diagram 2 adapters where direct reuse would couple to Diagram 1 DOM/state. |

## Legacy Renderer-Coupled Areas

These should not be copied wholesale into Diagram 2. They need controller commands, pure helper extraction, or a small adapter around existing behavior.

| Area | Coupling to avoid | Migration approach |
| --- | --- | --- |
| `openImageAnnotationDialog` local state | One giant dialog state object owns UI, gestures, selection, inspector, history, and persistence together. | Phase 2 splits Diagram 2 editor session state, command bus, and shell state. |
| Generated dialog HTML | Toolbar, inspector, object tree, and status are emitted from one large template. | Phase 2 creates stable shell regions; Phase 3-6 add panel modules. |
| Direct DOM gesture handlers | Pointer and keyboard handlers mutate local state and DOM assumptions directly. | Phase 3 creates interaction controllers that dispatch commands. |
| Snapshot history | Old editor and current Diagram 2 rely on full-state snapshots for many operations. | Phase 2 creates command history with inverse patches and coalesced transactions. |
| Full SVG rebuild assumptions | Many Diagram 1 operations rebuild large SVG strings or re-query SVG DOM. | Diagram 2 commands must feed dirty categories to the live renderer. |
| Inspector update logic | Controls read and write object state directly from DOM-bound state. | Panels call command APIs and subscribe to selected object summaries. |
| Relationship routing side effects | Entity updates, field reorders, and route overrides are intertwined with DOM/SVG helpers. | Phase 5 makes routing invalidation explicit through renderer relationship APIs. |
| Export/copy paths | Some helpers are safe, but they assume complete SVG materialization. | Keep off-screen export allowed; never persist or copy live renderer caches. |

## Diagram 2 Modules

Phase 2 created the foundation modules needed by both hosts. Remaining module names are still planned ownership boundaries for later phases.

| Module | Owns | Does not own |
| --- | --- | --- |
| `diagram2-editor-controller.js` | Editor session state, active document, selected ids, current tool, command dispatch, dirty/saved status, and shared object/template command entry points. | SVG DOM patching, document endpoints, template endpoint implementation. |
| `diagram2-editor-commands.js` | Pure command definitions, validation, forward patches, inverse patches, dirty categories. | DOM event handling. |
| `diagram2-editor-history.js` | Undo/redo stacks, command coalescing, transaction labels, memory limits. | Renderer internals. |
| `diagram2-editor-shell.js` | Diagram 1-familiar modal/embedded layout, toolbar location, center canvas host, right inspector host with Objects and Template tabs, status/save placement, diagnostics toggle, and renderer-neutral markup for object/template panes. | Object mutation rules or renderer patches. |
| `diagram2-editor-toolbar.js` | Diagram 1 toolbar grouping/order/icons/tooltips/enabled state, with not-yet-owned controls absent or clearly disabled. | Command implementations or diagnostics-first UI. |
| `diagram2-editor-inspector.js` | Diagram 1-familiar tab names/order and panel composition. Phase 2 shows Format, Template, and Objects; Crop, Mapping, Entity, and other later-phase tabs should appear only when their behavior is functional or an honest disabled control is specifically required. | Direct canonical mutations outside commands. |
| `diagram2-editor-structure.js` | Diagram 1-familiar object tree projection, group/ungroup plans, group-aware selection, visibility, rename, drag/drop reorder, layer/z-order plans, and structure-state commands. | DOM event handling, SVG node patching, or document persistence. |
| `diagram2-editor-templates.js` | Shared Diagram template-library state helpers, capture/apply/format/upload/download/restore helpers, and arrow/rectangle drawing defaults. | Template endpoint implementation, Field Rectangle defaults, Crop, Entity editing, or Field Mapping authoring. |
| `diagram2-editor-interactions.js` | Pointer gestures, marquee, drag preview, resize handles, route handles. | Persistence. |
| `diagram2-domain-adapter.js` | Bridges existing canonical state helpers, template helpers, file/clipboard contracts, document save APIs. | Renderer live maps. |
| `diagram2-rte-host-adapter.js` | RTE selected image context, image source/original source, annotation metadata, save-back to the same image, cancel/focus restoration, RTE lifecycle cleanup. | Diagram document library, route changes, document metadata, or a separate editor implementation. |
| `diagram2-document-host-adapter.js` | Top-navigation Diagram 2 document ID, document library context, metadata, row version, permissions, route updates, standalone import/export. | RTE selected-image ownership or RTE focus restoration. |
| `diagram2-performance-contracts.js` | Runtime assertions/diagnostics for dirty categories, full-render counts, DOM counts, route counts. | User-facing feature behavior. |

## Dual Entry Point Architecture

Diagram 2 must expose one shared editor core through two host adapters.

```text
createDiagram2EditorCore(...)
  -> command/history/selection/inspector state
  -> canonical Diagram annotation state
  -> Diagram 2 dirty categories and renderer APIs
  -> persistent keyed SVG nodes and selective routing

Host adapters:
  rte-annotation host
    owns selected RTE image, source/original source, save-back, cancel, focus, lifecycle
  diagram-document host
    owns document ID, library, metadata, row version, route, permissions, save service
```

The shared core must not assume it always has a Diagram document ID, a document library, an RTE image, a browser route, or a full-screen PMT page. Host-specific callbacks provide source loading, save, cancel, close, cached capabilities, and notifications.

Conceptual adapter shape:

```text
createDiagram2Editor({
  host: "rte-annotation" | "diagram-document",
  initialState,
  imageContext,
  documentContext,
  permissions,
  saveAdapter,
  cancelAdapter,
  closeAdapter,
  notify
})
```

The Phase 2 implementation follows this shape through `createDiagram2EditorController`, `createDiagram2DocumentHostAdapter`, and `openDiagram2RteAnnotationHost`. Later phases should keep the same PMT ES module style and avoid adding a framework or bundler.

## Phase 2 Implementation Update

Phase 2 retired the temporary diagnostics-first Diagram 2 editing scaffold as the production editor surface. The new shell uses the approved Diagram 1-familiar structure: top toolbar, center Diagram 2 renderer canvas, right inspector tabs including Objects, status/save indicators, context menu scaffolding, and collapsible diagnostics. Later-phase controls remain honestly disabled or deferred where their command implementation is not part of Phase 2.

The top-navigation Diagram 2 host now uses the same Diagram document library as Diagram 1. Document rows, IDs, visibility, ownership, project/Sprint grouping, search inputs, create/import/delete/save routes, public-link actions, and row-version save behavior continue to target the existing PMT Diagram backing records. Diagram 2 does not create an editor-version-specific library, field, filter, migration, or ownership model.

The RTE host adds side-by-side `Annotate 2.0` and `Edit Annotation 2.0` actions while preserving the existing Diagram 1 `Annotate` and `Edit Annotation` actions. RTE annotations remain embedded rich-text images, not standalone Diagram documents. Save builds the complete annotated SVG, creates a `File`, uploads it through `uploadFile("richtext", file)`, and updates the selected image `src` to the stored upload URL. The RTE HTML persists only that uploaded URL plus lightweight annotation attributes and classes; generated SVG, Base64 data URLs, and Blob URLs are not persisted.

Security remains shared with Diagram 1 through the existing Documentation resource. The top-navigation document host resolves a frozen capability context when the document session opens, including `canRead`, `canCreate`, `canUpdate`, `canDelete`, `canImport`, and `canExport`. The RTE host receives a frozen capability context from the originating editable RTE. Mutating commands, undo, redo, keyboard nudges, pointer drag commits, saves, imports, and exports read the cached capability Booleans at command boundaries. No Diagram 2 permission resolution runs in pointer-move, resize-preview, color-preview, route-preview, renderer-flush, zoom, pan, or Fit hot paths. Server APIs remain the authoritative security boundary for persistence and file operations.

## Phase 4 Implementation Update

Phase 4 adds focused renderer-neutral structure and template modules instead of growing the document host or shell into monoliths. `diagram2-editor-structure.js` owns group/ungroup planning, group-aware selection expansion, tree projection/search, visibility, rename, drag/drop reorder, layer/z-order plans, and the structure-state command wrapper. `diagram2-editor-templates.js` owns shared Diagram template library state, capture/apply/format/upload/download/restore helpers, and arrow/rectangle drawing defaults.

The top-navigation Diagram 2 host and both RTE Diagram 2 hosts call the same controller methods for Group, Ungroup, visibility, rename, Layers UI actions, tree search/reorder, template application/formatting, and drawing defaults. Host adapters own only prompt/confirmation callbacks, template endpoint callbacks, and local shell refresh. Canonical Diagram files continue to store annotation data only; object-tree search text, template-library busy messages, drawing-default UI state, renderer indexes, and mounted SVG node maps are not serialized into the Diagram document.

Native clipboard-image paste into Diagram 2 Edit mode remains implemented through the existing upload path. Full image upload/drop, asset management, Crop, Field Rectangles, Field Mapping, Field Mapping Tables, Entity editing, relationship editing, manual routes, and Auto Format remain outside Phase 4 and stay assigned to their later phases.

## Existing RTE Annotation Launch Path

The current Diagram 1 RTE image annotation flow is in `wwwroot/js/app.js`:

| Step | Current implementation |
| --- | --- |
| Image click/context entry | `handleRichTextImageClick` targets `.rich-editor img, .rich-readonly img, .log-content img, .scrum-content img`; editable rich-text images open the image menu, read-only images open in a new tab. |
| Context menu construction | `showRichTextImageMenu` builds `.rich-image-menu` using `richTextImageMenuItemHtml`. |
| Current Diagram 1 labels | Unannotated images show `Annotate`; annotated images currently show `Edit Annotation` based on `image.dataset.pmtAnnotationVersion`. The addendum text says `Edit Annotate`; because existing commands must not be renamed without approval, later code should preserve `Edit Annotation` unless Sin approves the wording change. |
| Existing action dispatch | `data-rich-image-action="annotate"` calls `annotateRichTextImage(image)`. Other actions include select, resize, zoom, original, and delete. |
| Existing annotation metadata detection | `annotateRichTextImage` treats `image.dataset.pmtAnnotationVersion === "1"` as annotated and reads `data-pmt-annotation-source` for original source preservation. |
| Existing editor launch | `annotateRichTextImage` calls `openImageAnnotationDialog` with the selected image source/original source, template endpoints, color/text/confirm hooks, upload hook, and an `apply` callback. |
| Existing save-back | On apply, the SVG is uploaded to `richtext`, the same selected image gets the new `src`, `data-pmt-annotation-source` is preserved or removed, `data-pmt-annotation-version` is set, and annotation classes are applied. |
| Existing focus restoration | After a successful result, the editor is focused and `setRichTextImageBrowserSelection(image)` restores selection. |
| Existing cancel behavior | If the dialog returns no result, the original selected image is left unchanged. |
| Existing menu cleanup | `closeRichTextImageMenu` removes pointer/keydown/resize/scroll listeners and removes the menu/popover. |

Phase 2 should add the Diagram 2 sibling RTE actions only when they can open a functional Diagram 2 RTE host. Do not expose a nonfunctional `Annotate 2.0` control as a placeholder.

Required side-by-side labels once functional:

| Image state | Existing Diagram 1 command | Diagram 2 command |
| --- | --- | --- |
| Supported unannotated image | `Annotate` | `Annotate 2.0` |
| Supported annotated image | `Edit Annotation` today | `Edit Annotation 2.0` unless Sin approves changing both labels to `Edit Annotate` / `Edit Annotate 2.0` |

## Addendum Conflict Resolution

| Potential conflict | Resolution |
| --- | --- |
| The current Diagram 2 beta screen has a compact developer-style toolbar with save/export/nudge/diagnostics actions. | Treat it as a beta viewer/editor scaffold, not the final editor UI. Phase 2 should introduce a Diagram 1-familiar editor shell and move diagnostics behind a development/collapsible surface. |
| Phase 1 originally assigned many document dialogs and UX hardening details to Phase 7. | Keep full behavior ownership in Phase 7, but Phase 2 must still establish the approved visual architecture: toolbar placement/order scaffolding, center canvas, right inspector tabs with Objects, and correct Save/Undo/Redo placement. |
| Reusing Diagram 1 markup/CSS could accidentally couple Diagram 2 to Diagram 1's full-render lifecycle. | Inspect and reuse visual builders/styles only when renderer-neutral. Command handlers, state mutation, canvas interactions, dirty categorization, and renderer updates stay Diagram 2-specific. |
| Diagram 1 and current Diagram 2 use full-state snapshots for some undo/redo behavior. | Phase 2 command history supersedes routine snapshots. Snapshots remain reserved for open/import/reset/recovery boundaries. |
| Diagram 1 relationship/entity helpers may perform broad recomputation. | Preserve visible relationship behavior, but use Diagram 2 routing invalidation, spatial indexes, route caches, and dirty relationship categories. |
| Diagram 2's performance diagnostics are valuable but visually unfamiliar. | Keep the diagnostics available for validation, but do not let them displace familiar editor toolbar/inspector/object-pane workflows. |
| The addendum requires visual parity tests that Phase 1 did not run. | Phase 1 documents the required side-by-side states and viewport sizes; later UI-changing phases must capture evidence before completion. |
| The dual-entry addendum asks to add RTE `Annotate 2.0`, but the shared Diagram 2 editor core and RTE host adapter do not exist yet. | Do not add a visible nonfunctional placeholder. Phase 2 must define the shared core and RTE/document host adapters first, then add the side-by-side menu actions as functional launch paths. |
| The addendum names `Edit Annotate`, while current PMT code labels the Diagram 1 command `Edit Annotation`. | Preserve the existing Diagram 1 label because the addendum prohibits renaming existing commands without separate approval. Pair it with `Edit Annotation 2.0` unless Sin explicitly approves the alternate wording. |
| RTE annotation and top-navigation Diagram 2 have different save targets and lifecycle rules. | Keep save/cancel/close/routing/metadata in host adapters. The shared editor core owns commands, history, selection, inspector state, canonical mutation, renderer integration, and cleanup hooks. |

## Visual Parity Validation Contract

Each UI-changing phase must compare Diagram 1 and Diagram 2 at `1920 x 1080` and `1366 x 768` where practical. Required states include no selection, one Rectangle selected, multiple objects selected, one Entity selected, one relationship selected, image crop mode, mapping mode, Objects pane expanded/collapsed, inspector tabs, dialog open, context menu open, Fit and 100% zoom, and read-only versus editing states where applicable.

The review should focus on layout, toolbar grouping, tab names/order, control presence/order, selection affordances, dialog workflows, familiarity, accessibility, and absence of unintended developer-only clutter. Differences are not approved merely because Diagram 2 uses a different renderer; intentional visual differences need Sin approval.

## Dual Host Validation Contract

Later phases that touch hosting, launch behavior, or save-back must report:

| Area | Required evidence |
| --- | --- |
| RTE new annotation | Supported unannotated image shows `Annotate` and functional `Annotate 2.0`; save updates the same RTE image only after Save; reopen through Diagram 2 keeps objects editable. |
| RTE cancel | Opening `Annotate 2.0`, making changes, and canceling leaves the original RTE content and image unchanged. |
| RTE Diagram 1 compatibility | Diagram 1-created RTE annotation opens in Diagram 2, saves through Diagram 2, and reopens in Diagram 1 where features are supported. |
| Top-navigation compatibility | Diagram 1 document opens/saves in Diagram 2, reopens in Diagram 1, then reopens in Diagram 2 after a Diagram 1 edit. |
| Dual-host lifecycle | Ten RTE open/close cycles and ten top-navigation open/leave cycles leave no stale SVG, listeners, observers, renderer maps, route indexes, viewport indexes, object URLs, or global debug references. |
| Label test | Unannotated supported image shows paired new-annotation commands; annotated supported image shows paired edit commands; Diagram 1 commands are not redirected or hidden. |

## Renderer API Contract

Diagram 2 already exposes these renderer methods:

- `render(inputState, options)` for initial/full canonical render.
- `fit`, `setZoom`, `zoomBy`, and `panBy` for transform-only viewport changes.
- `updateObject` for local object patching.
- `setSelectedIds` for selection visuals.
- `beginGeometryPreview`, `previewGeometry`, `commitGeometryPreview`, and `cancelGeometryPreview`.
- `beginDiagramUpdate` and `endDiagramUpdate` for batching.
- `whenIdle`, `diagnostics`, `liveViewSnapshot`, `svgNode`, `destroy`, `viewportMatrix`, `screenToWorld`, and `worldToScreen`.

Later editor phases need these additions or stable equivalents:

| Need | Purpose |
| --- | --- |
| Batch object add/remove/update | Add/delete/duplicate/group commands without full render. |
| Relationship add/remove/update APIs | Entity and mapping commands can patch relationship visuals and route indexes selectively. |
| Layer/z-order API | Bring forward/back and object tree reorder update hit testing and DOM order without remounting everything. |
| Visibility/lock API | Hide/show and lock/unlock update live nodes and interaction maps without changing persisted shape unexpectedly. |
| Resize preview/commit API | Resize handles can preview geometry and text/entity layout before committing one history item. |
| Relationship hit testing and route-handle API | Manual routes and relationship selection can use spatial indexes instead of DOM scans. |
| Selected object summary API | Inspector panels can render state without querying mounted SVG nodes. |
| Dirty transaction diagnostics | Tests can prove each command patched expected objects/routes and did not call full render. |
| Viewport focus API | Fit selected, center object, and scroll-to-tree-target behavior can stay renderer-owned. |
| Worker-safe route/layout hooks | Auto-format and large relationship recomputes can be bounded and eventually moved off the UI thread if needed. |

## Command and History Architecture

The command bus should be the only path that mutates Diagram 2 canonical editor state after open/import.

Command shape:

```text
{
  id,
  label,
  phaseOwner,
  selectionBefore,
  selectionAfter,
  forwardPatch,
  inversePatch,
  dirtyCategories,
  affectedObjectIds,
  affectedRelationshipIds,
  routingInvalidation,
  boundsInvalidation,
  coalesceKey,
  compatibilityNotes
}
```

Required history behavior:

- Drag, resize, slider, color, and text typing gestures create one user-level undo item per committed interaction.
- Commands store inverse patches or targeted before/after data, not whole-document JSON snapshots for routine edits.
- History has a memory ceiling and may keep occasional checkpoints for recovery, but ordinary undo/redo replays command deltas.
- Undo and redo dispatch the same dirty categories as the original command so renderer diagnostics remain testable.
- Selection-only and viewport-only actions are not document history unless the user-facing Diagram 1 behavior proves otherwise.
- Save clears the dirty marker for the current command stack position; it does not erase undo history.
- Import, open, and full reset may establish a new baseline snapshot and call `renderer.render()`.

Dirty categories to use in tests and diagnostics:

| Dirty category | Examples | Renderer expectation |
| --- | --- | --- |
| `selection` | click, multi-select, marquee, select all | Selection classes/handles patch only. |
| `viewport` | zoom, pan, fit, pane resize | Transform/halo/detail changes only; no canonical write. |
| `geometry` | move, nudge, resize, crop insets | Patch affected objects and relationship routes touching them. |
| `style` | fill, stroke, text style, opacity | Patch selected object visuals; route only if bounds/stroke impacts collision. |
| `text` | text/rich text edits | Patch text node/wrap and bounds if changed. |
| `structure` | group, ungroup, layer order, lock, visibility | Patch live maps, DOM order, object tree, and hit testing. |
| `entity` | field edits, collapse, data type display | Patch entity rows, bounds, field anchors, and affected relationships. |
| `relationship` | add/delete/style relationship | Patch relationship maps and route sectors selectively. |
| `routing` | manual route, clear routes, auto routing flags | Recompute requested routes only. |
| `mapping` | field rectangle links, mapping table changes | Patch overlays/highlights/tables. |
| `asset` | insert image, crop, permanent crop | Patch image node, bounds, and export metadata. |
| `document` | save, duplicate, import, delete | May cross backing-document boundaries; not routine live repaint. |
| `template` | save/apply/upload/delete/restore template | Shared template endpoint/library changes. |

## Baseline Performance Evidence

Recorded baseline sources:

- `docs/diagram-2-day-16-stress-test-hardening-beta-readiness.md`
- `Requirements/2026-07-22 - PMT Diagram 2 Daily Codex Instructions/Diagram-1-vs-Diagram-2-Entity-Scale-Benchmark-2026-07-26.html`

The older instructions mention a 28-entity small fixture. The current recorded benchmark artifact identifies the PMT schema baseline as 29 entities and 82 relationships, with the first synthetic increment at 30 entities and 83 relationships. This doc uses the recorded artifact counts.

| Fixture | Source | Renderer/path | Ready/open | Full render count | DOM/SVG evidence | Routing evidence | Notes |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| 29 entities, 82 relationships | Benchmark artifact, document 43 | Diagram 1 production path | 3332.03 ms ready | Not reported | 3127 DOM nodes, 2217 SVG descendants | Not isolated | Small production schema baseline. |
| 30 entities, 83 relationships | Benchmark artifact, document 44 | Diagram 1 production path | 3827.74 ms ready | Not reported | 3174 DOM nodes, 2264 SVG descendants | Not isolated | First synthetic increment. |
| 232 entities, 624 relationships | Day 16 stress doc | Diagram 1 baseline | 40.35 s read usable, 83.11 s edit usable, 28.49 s route/SVG build | Not reported | 17,468 read SVG elements, 18,558 edit SVG elements | Full 624-route build cost: 28.49 s | Production editor stress baseline. |
| 232 entities, 624 relationships | Day 16 stress doc | Diagram 2 renderer | 73.7 ms normal CPU, 676.9 ms at 6x CPU | 1 on open, 0 for measured routine operations | Fit overview 4202 descendants; focused broad fixture 8146 descendants | Local route recomputation: 49.2 ms operation, 95/624 relationships considered/rerouted, 3.4 ms routing portion | Current beta performance target to protect. |
| 500 entities, measured canonical 867 relationships | Benchmark artifact, document 97 | Diagram 2 route | 924.82 ms ready | 1 on open | 9142 DOM nodes, 7914 SVG descendants | Last frame 92.2 ms, overview detail 75.4 ms, zoom average 165.5 ms | Artifact matrix describes the generated 500 fixture as 1024 relationships; renderer diagnostics counted 867 canonical relationships. Preserve both facts during later investigation. |
| 1000 entities | No current artifact found in Phase 1 | Not measured | Not measured | Not measured | Not measured | Not measured | Phase 8 must create the 1000-entity gate before promotion. |

## Performance Gates for Later Phases

Later phases should append exact medians/p95s where browser tests support repeated samples. The minimum evidence for each command family should include:

| Operation family | Required evidence |
| --- | --- |
| Open/import/reset | Fixture size, median/p95 open, initial full render count, canonical object/entity/relationship counts, DOM descendants, heap trend where available. |
| Selection | Median/p95 click/multi-select/marquee, objects patched, relationships considered/rerouted, full-render count unchanged. |
| Geometry | Preview frame time, commit time, objects patched, relationship subset considered/rerouted, bounds/sector invalidations. |
| Entity/relationship edits | Field rows patched, relationship route subset, route sector counts, no unrelated object remounts. |
| Viewport | Zoom/pan/fit frame times, overview detail level, halo target counts, mounted/canonical ratios, full-render count unchanged. |
| Save/export | Serialization time, exported file compatibility, renderer state absent, off-screen cleanup. |
| Lifecycle | Repeated open/close descendants and live map entries return to zero. |

## Compatibility Matrix

| Contract | Required result |
| --- | --- |
| D1 open D1 save | Existing Diagram behavior remains unchanged. |
| D2 open D1 save | Diagram 2 parses Diagram 1 saves through shared canonical state. |
| D1 open D2 save | Diagram 1 reopens Diagram 2 saves; renderer caches absent. |
| D2 open D2 save | Diagram 2 reopens its own saves through the same backing document. |
| Clipboard both directions | Both screens parse `pmt-diagram-selection` v1 and remap pasted ids. |
| Templates both directions | Both screens use `/api/image-annotation/template-library` and default template endpoint. |
| Import/export matrix | Both screens parse `pmt-diagram` v1 files from either screen. |
| Unknown extensions | Unknown non-renderer fields are either preserved safely or not written. |
| Renderer state persistence | Mounted nodes, dirty flags, halo state, indexes, diagnostics, and cache maps never persist. |

## Phase 1 and 2 Conclusions

- The existing Diagram 2 renderer has the right performance-oriented foundation for viewport transforms, keyed node patches, dirty state, spatial relationship routing, viewport halo, and lifecycle cleanup.
- Phase 2 introduced the shared editor controller, bounded command history, Diagram 1-familiar shell, document host adapter, and RTE host adapter without rewriting the Diagram 2 renderer.
- Phase 2 moved existing local movement and nudge behavior through command history and incremental renderer updates. Initial open/import/reset may still use full render; ordinary local move undo/redo must not.
- Diagram 1 and Diagram 2 now share the same user-facing Diagram document library and Documentation security model. Diagram 2 has no Diagram2-only resource, role, document field, library, or storage path.
- RTE `Annotate 2.0` and `Edit Annotation 2.0` use the shared Diagram 2 editor core and the existing rich-text upload pipeline. Cancel performs no upload and leaves the selected image unchanged.
- The safest next step is Phase 3 only, after Sin's approval: implement core drawing, selection, resize, format inspector, text editing, and keyboard command parity inside the existing controller/shell architecture.
