# Diagram 2 Day 02 Compatibility Contracts

Date: 2026-07-25

## Scope

Day 02 creates shared compatibility contracts before any Diagram 2 renderer work starts.

- Diagram 1 remains the production Diagram.
- Diagram 2 continues to be an isolated shell.
- No database migration is required.
- No second Diagram document table, template endpoint, clipboard format, or PMT Diagram file format is introduced.

## Current Contract Decisions

### Canonical Editable State

The canonical editable Diagram state remains the existing image annotation state normalized by `normalizeAnnotationState`.

Shared API:

- `normalizeDiagramState(input, fallback)`

Rules:

- Persisted state is renderer-neutral.
- Diagram 2 renderer caches, mounted-node maps, dirty flags, and selection handles do not belong in persisted state.
- Field Rectangles and Field Mapping Tables are part of the current canonical Diagram 1 state and must remain readable.

### PMT Diagram File

The file format remains:

```json
{
  "format": "pmt-diagram",
  "formatVersion": 1
}
```

Shared API:

- `createPmtDiagramFile(...)`
- `parsePmtDiagramFile(...)`
- `canDiagramFeatureReadPmtDiagramFile(feature, contents)`

Rules:

- `generator.feature` is advisory only.
- Diagram 1 and Diagram 2 both read `pmt-diagram` version `1`.
- Unknown top-level `extensions` and Diagram `extensions` are preserved by the shared codec.
- The editable state is authoritative. The full SVG is still an export/read-only artifact.

The existing Diagram 1 import path now re-exports the shared codec from `wwwroot/js/shared/diagram-contracts.js`.

### Selection Clipboard Package

The shared clipboard format is:

```json
{
  "format": "pmt-diagram-selection",
  "formatVersion": 1,
  "minimumReaderVersion": 1,
  "source": {
    "application": "PMT",
    "feature": "Diagram"
  },
  "selection": {
    "objects": [],
    "relationships": [],
    "manualRelationshipRoutes": {},
    "groupNames": {},
    "groupVisibility": {},
    "extensions": {}
  },
  "extensions": {}
}
```

Plain text fallback starts with:

```text
PMT_DIAGRAM_SELECTION_V1
```

Shared API:

- `createDiagramSelectionClipboardPackage(...)`
- `serializeDiagramSelectionClipboardPackage(...)`
- `parseDiagramSelectionClipboardPackage(...)`
- `normalizeDiagramSelectionClipboardPackage(...)`
- `remapDiagramSelectionClipboardPackageIds(...)`

Rules:

- The package stores selected canonical objects, relationships between copied Entities, manual relationship routes, group names, group visibility, and extension containers.
- The package does not store live DOM nodes, renderer caches, dirty state, selection handles, or screen coordinates.
- Paste remapping generates new object IDs, remaps group IDs, remaps annotation owner references, remaps relationship endpoints, remaps Field Mapping Table references, preserves relative positions, offsets pasted instances, and avoids existing object ID collisions.
- Relationships are preserved only when the required copied endpoints are present.

### Object Templates

Both Diagram screens must continue to use the existing Object Template API:

- `GET /api/image-annotation/template-library`
- `GET /api/image-annotation/default-template-library`
- `PUT /api/image-annotation/template-library`

Shared API:

- `normalizeDiagramTemplateLibrary(input)`

Rules:

- No Diagram 2 template table, endpoint, local-storage copy, or second schema should be created.
- Renderer-specific preview thumbnails may be cached separately later, but not as canonical template data.

### Diagram Documents

Both Diagram screens must use the existing Diagram backing documents and the `Documentation` permission resource.

Rules:

- No duplicate Diagram document records.
- No database migration for Diagram 2 unless a later phase proves it unavoidable.
- A small document adapter may be added later only if it reduces duplication without destabilizing Diagram 1.

## Validation Coverage

`tests/js/diagram-contracts.test.mjs` covers:

- PMT Diagram extension preservation.
- Advisory `generator.feature`.
- Diagram 1 and Diagram 2 file compatibility matrix through the shared codec.
- Object Template normalization and endpoint contract.
- Selection clipboard serialization and parsing.
- ID remapping for objects, groups, owner references, relationships, manual routes, and Field Mapping Table references.

`tests/js/pmt-diagram-file.test.mjs` continues to cover the existing Diagram 1 wrapper import path and existing synthetic compatibility fixtures.
