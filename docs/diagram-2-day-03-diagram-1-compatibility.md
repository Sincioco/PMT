# Diagram 2 Day 03 Diagram 1 Compatibility

Date: 2026-07-25

## Scope

Day 03 upgrades Diagram 1 to be the first full reader and writer for the shared Diagram compatibility contracts created on Day 02.

- Diagram 1 remains the production Diagram editor.
- Diagram 2 remains an isolated shell.
- No database migration is required.
- No Diagram 1 zoom, live SVG rendering, relationship routing, page layout, save timing, or selection rendering behavior is intentionally changed.

The later Diagram 1 additions from Day 36 and Day 37 remain part of the compatibility picture: Field Rectangles, many-to-one field mappings, manual relationship routes, rich text, and Field Mapping Tables are all treated as canonical Diagram state.

## Editable Selection Clipboard

Diagram 1 native object copy and paste now uses the shared `pmt-diagram-selection` package.

Shared package rules in Diagram 1:

- Rectangle, text box, rich text, Entity, grouped object, Entity Annotation, and Field Mapping Table selections are serialized as editable PMT objects.
- Relationships are included only when the copied selection contains both endpoints.
- Manual relationship routes are preserved when the copied relationship endpoints are included.
- Pasted objects receive new object IDs and a repeated paste offset.
- Group IDs, group names, group visibility, Entity Annotation owner references, relationship endpoints, route overrides, and Field Mapping Table references are remapped during paste.
- Unsupported future clipboard versions show a clear compatibility message instead of attempting to paste.

External copy remains separate:

- Copy as SVG still produces rendered SVG artwork.
- Copy as Image still produces rendered PNG artwork.
- These rendered export paths are not used for editable PMT object paste.

## Object Templates

Diagram 1 Object Template load, save, restore-defaults, and dialog initialization now normalize through `normalizeDiagramTemplateLibrary`.

Rules:

- Existing endpoints remain unchanged:
  - `GET /api/image-annotation/template-library`
  - `GET /api/image-annotation/default-template-library`
  - `PUT /api/image-annotation/template-library`
- No Diagram 2 template table, endpoint, or local-storage copy is introduced.
- Unknown template-level and library-level `extensions` containers are preserved when present.

## PMT Diagram Files

The PMT Diagram file format remains `pmt-diagram` version `1`.

Day 03 does not change the file codec created on Day 02. Diagram 1 still accepts Diagram files written by either Diagram or Diagram 2 as long as they use the shared version `1` contract. The `generator.feature` field remains advisory only, and renderer caches are not persisted.

## Validation Coverage

`tests/js/diagram-contracts.test.mjs` now covers:

- PMT Diagram file extension preservation and reader-neutral Diagram/Diagram 2 compatibility.
- Shared Object Template endpoint and schema compatibility.
- Object Template extension preservation.
- Shared selection clipboard serialization, parsing, version rejection, and ID remapping.
- Rectangle, text, rich text, grouped objects, Entity Annotations, relationships, manual routes, and Field Mapping Table references in copied selections.

The larger Diagram 1 unit suite remains under `tests/js/image-annotation.test.mjs`.
