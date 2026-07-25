# Diagram 2 Day 08 Keyed SVG Nodes

Day 08 turns the Diagram 2 live SVG renderer into an incremental keyed-node renderer.

## Scope

- Diagram 2 object groups are keyed by `data-diagram2-object-id`.
- Diagram 2 relationship groups are keyed by `data-diagram2-relationship-id`.
- Renderer-only maps keep canonical IDs associated with live DOM groups and last-seen render data.
- Ordinary object and relationship updates patch existing groups instead of replacing a complete SVG plane.
- Initial open may still create the full live SVG tree once.

## Incremental Operations

The renderer now has explicit create, patch, and remove operations for Diagram 2 objects and relationships:

- `createObjectNode(object)`
- `patchObjectNode(node, previousObject, nextObject, flags)`
- `removeObjectNode(id)`
- `createRelationshipNode(relationship)`
- `patchRelationshipNode(node, previousRelationship, nextRelationship, flags)`
- `removeRelationshipNode(id)`

These operations are scoped to the Diagram 2 renderer module. They do not call Diagram 1 render paths.

## Entity Patching

Entity movement updates the keyed object group transform. Existing entity body, header, title, field, and rule nodes remain in place when only position or style changes.

Entity color and selection updates patch attributes and classes:

- Body fill patches `data-diagram2-entity-body`.
- Header fill patches `data-diagram2-entity-header`.
- Outline/rule styling patches existing line and outline nodes.
- Selection patches the object class and the Diagram 2 overlay plane.

Entity row layout is rebuilt only for structural changes such as collapsed state, data-type visibility, key-column visibility, field rows, dimensions, or font metrics.

## Relationship Patching

Relationship groups keep their keyed DOM node. Route/style changes patch the existing child `path` and `title` instead of replacing the group.

## Metadata Boundary

Diagram 2 live rendering does not emit serialized Diagram metadata. Canonical version tracking stays in memory. Complete metadata remains the responsibility of save, export, complete clipboard, and portable SVG flows.

## Diagram 1 Protection

Day 08 edits are isolated to:

- `wwwroot/js/features/diagram2/`
- `wwwroot/css/features/diagram2.css`
- Diagram 2 tests and docs
- Diagram 2 cache-bust references

The Diagram 1 feature module, shared Diagram codec, PMT database schema, and Field Mapping Table implementation are not changed.

## Verification

Automated coverage includes:

- Unit patch-flag checks proving entity move and color changes do not require an entity rebuild.
- Browser identity checks proving unrelated entity groups persist across selection, fill, and move patches.
- Browser identity checks proving the moved entity group and its title text persist.
- Browser transform checks proving zoom/pan still updates only the viewport transform.

