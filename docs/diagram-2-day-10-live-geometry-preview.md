# Diagram 2 Day 10 Live Geometry Preview

## Scope

Day 10 adds a renderer-local geometry preview lifecycle for Diagram 2. It does not enable Diagram 2 editing, saving, import/export changes, or Diagram 1 rendering changes.

The preview lifecycle is exposed on the Diagram 2 renderer:

- `beginGeometryPreview(options)`
- `previewGeometry(input)`
- `commitGeometryPreview(input)`
- `cancelGeometryPreview()`

## Preview Behavior

`beginGeometryPreview` records the original canonical geometry for active objects, the current selection, connected relationship IDs, settled relationship routes, and the initial viewport matrix. If a selected object starts a move preview, the whole current selection participates so multi-selection movement stays grouped.

`previewGeometry` stores the latest temporary geometry and patches once per animation frame. Move previews update active object group transforms without changing canonical state. Resize previews patch the active object's local display only. Connected relationship previews render as dashed overlay paths so the existing settled relationship nodes stay mounted.

During preview, Diagram 2 does not:

- run global relationship routing,
- rebuild unrelated objects,
- serialize metadata,
- create undo entries per move,
- resolve global overlaps.

## Commit and Cancel

`commitGeometryPreview` applies the latest preview geometry to canonical Diagram 2 state inside one batched renderer update. The affected objects and relationships patch once through the dirty-state scheduler, and diagnostics count one commit and one undo-equivalent gesture entry.

`cancelGeometryPreview` restores active object DOM from the original canonical geometry, removes preview relationship overlays, and does not create a dirty flush or undo entry.

## Diagnostics

The Diagram 2 renderer now exposes preview diagnostics through the shell panel and SVG dataset:

- active preview state and reason,
- preview object and relationship IDs,
- preview frame and duration counts,
- patched preview object count,
- relationship preview count,
- commit and undo-equivalent counts,
- initial viewport matrix,
- settled route count,
- pending preview frame state.

## Day 11 Boundary

Selective relationship routing and deeper routing optimization remain Day 11 scope. Day 10 only routes connected relationships once after commit using the existing dirty-state mechanism.
