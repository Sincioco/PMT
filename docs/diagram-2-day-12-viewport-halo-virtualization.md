# Diagram 2 Day 12 Viewport Halo Virtualization

## Scope

Day 12 adds viewport-plus-halo DOM virtualization to the isolated Diagram 2 renderer. Diagram 1, persisted Diagram metadata, database objects, templates, clipboard data, and import/export formats are unchanged.

## Defaults

Diagram 2 uses the measured viewport-halo defaults from the Day 12 requirement:

- sector size: 2,048 world units,
- halo: one sector around the settled viewport sector set,
- minimum object threshold: 80 visible objects,
- full-render fallback: 82% combined live DOM coverage.

The implementation reuses the existing fixed-grid index helper introduced for selective routing. It does not add a competing segmentation engine.

## Mounting

On a settled viewport, Diagram 2 computes the target object and relationship IDs for the viewport-plus-halo sector region:

- entering IDs are mounted first,
- retained IDs keep their existing SVG node identity,
- leaving IDs are removed after entering nodes are available,
- same-sector viewport movement performs no DOM reconciliation.

Selected objects, active geometry-preview objects, required group members, selected relationships, and relationships needed by active selections are force-mounted.

Relationships are selected by completed route bounds, so a relationship can stay mounted when its route crosses the halo even if both endpoint Entities are outside the halo.

## Fallbacks

Diagram 2 keeps the full keyed live DOM for small diagrams, overview/fit cases where the target already covers nearly all DOM, unsafe viewport bounds, and cases where all objects are required.

Canonical state remains complete even when live DOM is virtualized. Save/export compatibility therefore continues to use every canonical object instead of only mounted nodes.

## Diagnostics

The Diagram 2 diagnostics panel and live SVG `data-diagram2-*` attributes now expose:

- viewport halo active/fallback status,
- sector size, sector count, and sector signature,
- object, relationship, and combined coverage,
- target, virtualized, entering, retained, and leaving counts,
- force-mounted object and relationship counts,
- route-only relationship count,
- same-sector no-op status,
- viewport halo patch and duration metrics.

## Stress Coverage

The focused Diagram 2 browser smoke creates a detached 220-Entity fixture. It verifies focused rendering mounts less than half of canonical objects, same-sector pan performs no DOM work, selected offscreen objects stay mounted after selection, and a route crossing the halo remains mounted while both endpoint Entities are outside.
