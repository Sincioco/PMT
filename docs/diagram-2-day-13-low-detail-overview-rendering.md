# Diagram 2 Day 13 Low Detail Overview Rendering

## Scope

Day 13 adds low-detail overview rendering to the isolated Diagram 2 renderer. Diagram 1, persisted Diagram metadata, database objects, templates, clipboard data, and import/export formats are unchanged.

## Detail Selection

Diagram 2 chooses the overview detail level from projected Entity field-row size:

- enter low detail when the median visible Entity field row projects below 4 screen pixels,
- stay low until rows project at least 6 screen pixels,
- require at least 80 visible Entities before low detail is allowed.

The hysteresis band prevents rapid switching around the threshold. During transient zoom frames the existing level is transformed normally; the detail level is reconciled only after the viewport settles.

## Low Detail Entities

Low-detail Entity nodes keep the keyed SVG group and render:

- outer body,
- header,
- Entity name,
- compact PK/FK count indicator,
- selection-compatible outline.

They omit field rows, field text, data types, row rules, and detailed annotation content.

## Low Detail Relationships

Low-detail relationship nodes keep their keyed relationship groups. Non-manual, non-self-reference relationships render a simplified endpoint path at overview scale. Manual routes and self-reference loops keep their completed route so authored intent is preserved.

Diagram 2 already omits symbols and invisible hit paths in this read-only renderer, so no shared Diagram 1 interaction layer was changed.

## Compatibility

Low detail affects only the live Diagram 2 SVG DOM. Canonical state remains complete, so save/export/import/clipboard/portable SVG contracts continue to use the exact persisted Diagram state rather than the current overview DOM.

## Diagnostics

The Diagram 2 diagnostics panel and live SVG `data-diagram2-*` attributes now expose:

- current and previous overview detail level,
- projected field-row pixels,
- enter and exit thresholds,
- visible Entity count,
- low-detail and detailed object/relationship counts,
- object and relationship patch counts,
- reconciliation duration.

## Stress Coverage

The focused Diagram 2 browser smoke creates a detached 224-Entity / 448-relationship fixture. It verifies that 10% overview enters low detail, descendant count drops substantially, field text is omitted, Entity names and compact key indicators remain, same low-detail pan avoids full render, near-threshold zoom stays low through hysteresis, and zooming back to 100% restores detailed fields.
