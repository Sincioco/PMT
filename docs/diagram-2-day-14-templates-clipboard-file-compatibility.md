# Diagram 2 Day 14 Templates, Clipboard, and File Compatibility

## Scope

Day 14 connects Diagram 2 to the existing shared Diagram compatibility contracts without enabling Diagram 2 save/export UI yet. Diagram 1 remains the full production editor and Diagram 2 remains the isolated read-only live renderer until the Day 15 editor/save phase.

## Shared Contracts

Diagram 2 now has a small compatibility adapter over the shared contract module:

- Object Templates use `/api/image-annotation/template-library`.
- Default Object Templates use `/api/image-annotation/default-template-library`.
- PMT Diagram files stay `format: "pmt-diagram"` and `formatVersion: 1`.
- Selection clipboard payloads stay `format: "pmt-diagram-selection"` and `formatVersion: 1`.
- Diagram 2 writes `generator.feature: "Diagram 2"` only as advisory metadata.
- Diagram 2 live renderer state is prohibited from persisted files, templates, and clipboard packages.

The Diagram 2 screen exposes those contract values as `data-diagram2-*` attributes for browser smoke verification.

## Templates

The Day 14 tests run every current Object Template object type through the Diagram 2 adapter and the Diagram 1 shared normalizer:

- embedded image,
- rectangle,
- circle,
- arrow,
- line,
- text box,
- rich text,
- Entity,
- Field Rectangle,
- Field Mapping Table.

The test also verifies shared arrow, rectangle, and Field Rectangle relationship defaults.

## Clipboard

Diagram 2 clipboard text is created through the shared `pmt-diagram-selection` codec and can be parsed/remapped by Diagram 1. Diagram 1 clipboard text can also be parsed/remapped by Diagram 2.

Coverage includes shapes, text, rich text, images, groups, Entity annotations, related Entities, manual routes, Field Rectangles, Field Mapping Tables, and mixed locked/unlocked objects.

## File Compatibility

The PMT Diagram JSON matrix is tested through the same shared parser/writer:

- old Diagram 1 fixture into Diagram 2,
- new Diagram 1 export into Diagram 2,
- Diagram 2 export into Diagram 1,
- Diagram 2 export into Diagram 2.

Normalized canonical state is compared, including recent Field Mapping Table and Field Rectangle data.

## Day 15 Boundary

This phase does not add Diagram 2 document saving, undo/redo, export buttons, or editor UI. Those remain Day 15 work so Diagram 1 stays the production fallback while compatibility contracts are proven first.
