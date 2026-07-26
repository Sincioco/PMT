# Diagram 1 → Diagram 2 Feature Parity Matrix

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


## Status legend

| Status | Meaning |
|---|---|
| Not Started | No Diagram 2 work exists |
| Inventoried | Diagram 1 behavior and state impact documented |
| UI Only | Control exists but operation is not complete |
| Command Complete | Canonical operation works |
| Renderer Complete | Incremental renderer integration works |
| History Complete | Undo/redo works |
| Compatibility Complete | Diagram 1 ↔ Diagram 2 round-trip works |
| Performance Complete | Regression metrics pass |
| Manual Approved | Sin approved behavior |
| Intentionally Deferred | Sin explicitly approved deferral |

## Required columns

Use the expanded integrated table in **Integrated visual and host-parity columns** below.


<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Integrated visual and host-parity columns

The authoritative matrix must use these expanded columns:

| ID | Category | Diagram 1 feature | UI location | Visual source/CSS | Visual parity | Intentional difference approved | Action/handler | Canonical reads/writes | Shared editor command | Dirty category | Routing impact | History command | Top-nav D2 | RTE Annotate 2.0 | RTE Edit Annotate 2.0 | RTE save/cancel | D1→D2 | D2→D1 | Cross-host | Performance test | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

### Host applicability values

Use:

```text
Required
Not applicable
Deferred with Sin approval
```

Do not mark a feature complete because it works only in the top-navigation host when it is also applicable to RTE annotation.

### Additional seed items

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| HOST-001 | Hosting | Shared Diagram 2 editor core | Not Started |
| HOST-002 | Hosting | RTE annotation host adapter | Not Started |
| HOST-003 | Hosting | Diagram document host adapter | Not Started |
| HOST-004 | RTE context menu | Preserve Annotate | Not Started |
| HOST-005 | RTE context menu | Preserve Edit Annotate | Not Started |
| HOST-006 | RTE context menu | Add Annotate 2.0 | Not Started |
| HOST-007 | RTE context menu | Add Edit Annotate 2.0 | Not Started |
| HOST-008 | RTE lifecycle | Save back to selected image | Not Started |
| HOST-009 | RTE lifecycle | Cancel without content change | Not Started |
| HOST-010 | RTE lifecycle | Restore RTE focus/selection | Not Started |
| HOST-011 | Lifecycle | Ten-cycle RTE cleanup | Not Started |
| HOST-012 | Lifecycle | Ten-cycle top-navigation cleanup | Not Started |
| VIS-001 | Visual parity | Toolbar grouping/order/icons | Not Started |
| VIS-002 | Visual parity | Objects pane | Not Started |
| VIS-003 | Visual parity | Inspector tabs/controls | Not Started |
| VIS-004 | Visual parity | Canvas handles/overlays | Not Started |
| VIS-005 | Visual parity | Dialogs/context menus | Not Started |
| VIS-006 | Visual parity | Responsive layout comparison | Not Started |
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## Seed inventory

### Shell and navigation

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| SHELL-001 | Shell | Editor open/close lifecycle | Not Started |
| SHELL-002 | Shell | Maximized/embedded mode | Not Started |
| SHELL-003 | Shell | Toolbar groups | Not Started |
| SHELL-004 | Shell | Objects tree | Not Started |
| SHELL-005 | Shell | Inspector tabs | Not Started |
| SHELL-006 | Shell | Status/save indicator | Not Started |
| SHELL-007 | Shell | Responsive layout | Not Started |
| SHELL-008 | Shell | Diagnostics developer toggle | Not Started |

### Tools and objects

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| TOOL-001 | Tool | Select | Not Started |
| TOOL-002 | Tool | Pan | Not Started |
| TOOL-003 | Tool | Format Painter | Not Started |
| TOOL-004 | Tool | Crop | Not Started |
| OBJ-001 | Object | Rectangle | Not Started |
| OBJ-002 | Object | Circle | Not Started |
| OBJ-003 | Object | Arrow | Not Started |
| OBJ-004 | Object | Line | Not Started |
| OBJ-005 | Object | Textbox | Not Started |
| OBJ-006 | Object | Rich Text | Not Started |
| OBJ-007 | Object | Image | Not Started |
| OBJ-008 | Object | Entity | Not Started |
| OBJ-009 | Object | Field Rectangle | Not Started |
| OBJ-010 | Object | Field Mapping Table | Not Started |

### Selection and geometry

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| SEL-001 | Selection | Click select | Not Started |
| SEL-002 | Selection | Modifier multi-select | Not Started |
| SEL-003 | Selection | Marquee | Not Started |
| SEL-004 | Selection | Select All | Not Started |
| GEO-001 | Geometry | Drag | Not Started |
| GEO-002 | Geometry | Multi-drag | Not Started |
| GEO-003 | Geometry | Corner resize | Not Started |
| GEO-004 | Geometry | Side resize | Not Started |
| GEO-005 | Geometry | Grid snap | Not Started |
| GEO-006 | Geometry | Keyboard nudge | Not Started |

### Structure and styles

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| STR-001 | Structure | Delete | Not Started |
| STR-002 | Structure | Duplicate | Not Started |
| STR-003 | Structure | Group | Not Started |
| STR-004 | Structure | Ungroup | Not Started |
| STR-005 | Structure | Lock | Not Started |
| STR-006 | Structure | Visibility | Not Started |
| STR-007 | Structure | Rename | Not Started |
| STR-008 | Structure | Bring forward | Not Started |
| STR-009 | Structure | Send backward | Not Started |
| STR-010 | Structure | Bring front/back | Not Started |
| STYLE-001 | Style | Fill | Not Started |
| STYLE-002 | Style | Stroke | Not Started |
| STYLE-003 | Style | Stroke width | Not Started |
| STYLE-004 | Style | Opacity | Not Started |
| STYLE-005 | Style | Text formatting | Not Started |

### Entity and ERD

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| ERD-001 | Entity | Create Entity | Not Started |
| ERD-002 | Entity | SQL parsing | Not Started |
| ERD-003 | Entity | Field-list parsing | Not Started |
| ERD-004 | Entity | Edit schema/name | Not Started |
| ERD-005 | Entity | Add/remove/reorder fields | Not Started |
| ERD-006 | Entity | PK/FK/identity/nullable/important | Not Started |
| ERD-007 | Entity | Collapse/expand | Not Started |
| ERD-008 | Entity | Show data types/key column | Not Started |
| ERD-009 | Relationship | Create/delete relationship | Not Started |
| ERD-010 | Relationship | Style/symbols/visibility | Not Started |
| ERD-011 | Relationship | Manual routes | Not Started |
| ERD-012 | Relationship | Auto routing settings | Not Started |
| ERD-013 | Layout | Auto Format | Not Started |

### Advanced PMT mapping

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| MAP-001 | Mapping | Entity annotations | Not Started |
| MAP-002 | Mapping | Create/edit Field Rectangle | Not Started |
| MAP-003 | Mapping | Map UI field to DB field | Not Started |
| MAP-004 | Mapping | Many-to-one mappings | Not Started |
| MAP-005 | Mapping | Mapping hover/highlight | Not Started |
| MAP-006 | Mapping | Field Mapping Table create/edit | Not Started |
| MAP-007 | Mapping | Mapping inspector tab | Not Started |
| MAP-008 | Mapping | Read-only mapping interactions | Not Started |

### Assets, templates, persistence

| ID | Category | Diagram 1 feature | Status |
|---|---|---|---|
| IMG-001 | Image | Insert image | Not Started |
| IMG-002 | Image | Crop/inset/radius | Not Started |
| TPL-001 | Template | Apply | Not Started |
| TPL-002 | Template | Create/update/delete | Not Started |
| TPL-003 | Template | Restore defaults | Not Started |
| CLIP-001 | Clipboard | Copy/paste same screen | Not Started |
| CLIP-002 | Clipboard | D1→D2 | Not Started |
| CLIP-003 | Clipboard | D2→D1 | Not Started |
| SAVE-001 | Persistence | Save same document | Not Started |
| SAVE-002 | Persistence | Row-version conflict | Not Started |
| IO-001 | Import/export | PMT Diagram import | Not Started |
| IO-002 | Import/export | PMT JSON export | Not Started |
| IO-003 | Import/export | SVG | Not Started |
| IO-004 | Import/export | PNG | Not Started |
| IO-005 | Import/export | Portable assets | Not Started |
| HIST-001 | History | Command-based undo/redo | Not Started |

## Completion rule

The parity program may not be declared complete while any required item remains:

- Not Started
- UI Only
- Command Complete without renderer/history/compatibility/performance completion

Every intentional deferral requires Sin's explicit approval and a documented reason.
