# Diagram 2 Day 09 Dirty State And Batched Rendering

Day 09 adds a renderer-local dirty-state scheduler to Diagram 2.

## Scope

- Dirty state lives only inside the Diagram 2 renderer.
- Diagram 2 canonical Diagram metadata remains unchanged.
- Diagram 1 render paths, the shared Diagram codec, the PMT database, and Field Mapping Table production behavior are not changed.

## Dirty Categories

The renderer keeps these invalidation buckets:

- `objectGeometry`
- `objectStructure`
- `objectStyle`
- `objectSelection`
- `relationshipGeometry`
- `relationshipStyle`
- `zOrder`
- `worldBounds`
- `sectors`

These categories stay separate so selection, style, geometry, and structural updates can flush only the work they require.

## Transactions

Diagram 2 now exposes renderer transaction methods:

- `beginDiagramUpdate(reason)`
- `endDiagramUpdate(reason)`
- `scheduleDiagramFlush(reason)`
- `flushDiagramChanges(reason)`
- `whenIdle()`

Nested transactions are supported. Only the outermost completed transaction schedules an animation-frame flush.

## Flush Order

Dirty flushes run in this order:

1. Structural object patches.
2. Object geometry patches.
3. Anchor updates reserved for later phases.
4. Dirty relationship geometry.
5. Relationship style patches.
6. Object style patches.
7. Z-order reconciliation when requested.
8. Selection overlays.
9. World bounds when dirty.
10. Sector/detail reconciliation when dirty.
11. Clear dirty flags.

World-bounds and sector flags are tracked now. Their heavy reconciliation work remains reserved for later Diagram 2 phases.

## Mutation Classification

- View-only pan, zoom, and Fit continue to update only the viewport transform.
- Selection-only changes dirty previous and new selection visuals without routing relationships.
- Style-only changes patch existing node attributes without rebuilding Entities or routing relationships.
- Geometry commits dirty the moved object plus connected relationship geometry.
- Structural changes can dirty all relationships because visible fields and relationship membership may change.

## Diagnostics

Every dirty flush reports:

- Reason.
- Dirty object IDs.
- Dirty relationship IDs.
- Patched node count.
- Routed relationship count.
- Duration.
- Dirty flush count.

The diagnostics are exposed through the Diagram 2 diagnostics panel and the live SVG `data-diagram2-*` attributes.

## Verification

Automated coverage checks that:

- Dirty state exposes the required categories.
- Multiple style changes inside one transaction produce one flush.
- Selection-only changes route zero relationships.
- Style-only changes preserve Entity node identity and route zero relationships.
- Moving a related Entity patches connected relationship geometry.
- Selecting 28 Entities completes below 50 ms in the browser smoke test.

