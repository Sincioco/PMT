# Diagram 2 Day 06 Live Renderer Core

Diagram 2 now has a separate live renderer at `wwwroot/js/features/diagram2/diagram2-renderer.js`.

The canonical model remains the existing normalized Diagram annotation state parsed from saved SVG metadata. This is the same persisted shape Diagram 1 writes today.

The live renderer owns transient DOM state only:

- object node maps
- relationship node maps
- mounted object and relationship id sets
- selected id set
- object and relationship version maps

None of the live renderer state is written back into Diagram documents, localStorage, the database, templates, clipboard payloads, or import/export formats.

The normal Diagram 2 viewer mounts one stable SVG root and five stable planes:

- background
- below relationships
- relationships
- objects
- overlays

Fit and renderer refresh update that existing SVG instead of replacing the screen. The existing complete SVG builder remains in the shared Diagram document helper for compatibility and later save/export work.
