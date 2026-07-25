# Diagram 2 Day 11 Selective Relationship Routing

## Scope

Day 11 adds renderer-local relationship routing indexes and route-cache diagnostics to Diagram 2. Diagram 1, persisted Diagram metadata, database objects, templates, clipboard data, and import/export formats are unchanged.

## Indexes

The Diagram 2 renderer now keeps these lookup maps:

- `relationshipIdsByEntityId`
- `relationshipIdsByFieldAnchor`
- `relationshipBoundsById`

It also maintains fixed-grid sector indexes for Entity protected bounds, relationship route bounds, and routing obstacles. The grid is intentionally simple; no quadtree is used.

## Route Cache

Settled relationship routes compare explicit route signatures instead of full relationship object JSON. The signature includes endpoint geometry, source and target field anchors, manual route data, routing overrides, global routing settings that can affect geometry, and the obstacle generation for the route's relevant sectors.

Color, opacity, selection, and symbol-only changes do not invalidate relationship geometry.

## Entity Move Impact

When an Entity moves or resizes, Diagram 2 invalidates:

- directly connected relationships,
- routes intersecting the old protected bounds,
- routes intersecting the new protected bounds,
- routes in the expanded impact corridor.

The affected relationships are patched through the existing dirty-state scheduler. Unrelated relationships stay mounted and cached.

## Diagnostics

Diagram 2 now reports:

- total relationship count,
- relationships considered,
- relationships rerouted,
- route cache hits,
- route cache misses,
- spatial sectors queried,
- routing duration.

These values are exposed in the Diagram 2 diagnostics panel and on the live SVG `data-diagram2-*` attributes.

## Stress Coverage

The focused Diagram 2 browser smoke creates a synthetic 232-Entity / 624-relationship fixture in a detached renderer. It verifies that a cache refresh hits all routes, a local Entity move considers and reroutes fewer than all relationships, and a style-only Entity update reroutes zero relationships.
