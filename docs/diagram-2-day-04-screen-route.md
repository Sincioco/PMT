# Diagram 2 Day 04 Screen And Route

Date: 2026-07-25

## Scope

Day 04 finalizes Diagram 2 as a separate PMT screen, route, navigation item, and permission peer to Diagram 1.

- Diagram 1 remains the production Diagram screen.
- Diagram 2 remains a development placeholder.
- No Diagram 2 renderer work starts on this day.
- No database migration is required.

## Route

The canonical Diagram 2 route is:

```text
#/diagram-2
```

The router also reserves document deep links:

```text
#/diagram-2/<diagramDocumentId>
```

Those deep links open the Diagram 2 placeholder and keep the route. They do not redirect to Diagram 1. Loading and rendering the shared Diagram document belongs to a later Diagram 2 phase.

The older Day 01 route shape `#/diagram2` is accepted as a legacy parser alias, but generated links now use `#/diagram-2`.

## Navigation

Diagram 2 is still visible by default during development and normalizes to the final configurable navigation position. About remains a fixed overflow item and is not moved.

Navigation preference normalization was versioned forward so saved user navigation preferences receive Diagram 2 in the final position.

## Permissions

Diagram 2 uses the same PMT security resource as Diagram 1:

```text
Documentation
```

No permission row or stored procedure change is introduced.

## Placeholder

The Diagram 2 feature module remains isolated under `wwwroot/js/features/diagram2/`.

The shell displays:

```text
Diagram 2
High-performance Diagram renderer under development.
Diagram 1 remains available.
```

The module exposes `render`, `deactivate`, `handleAction`, and `view` hooks so later phases can add read-only and renderer behavior without routing through Diagram 1.

## Validation Coverage

`tests/js/router.test.mjs` covers the canonical route, reserved deep link route, and legacy `diagram2` parser alias.

`tests/js/navigation-preferences.test.mjs` covers default visibility, final placement, and the Diagram 2 icon treatment.

`tests/js/permissions.test.mjs` continues to cover the shared Documentation permission mapping.

`tests/browser/diagram2-navigation.spec.mjs` covers:

- Diagram 2 top navigation.
- Browser back/forward between Diagram and Diagram 2.
- Reserved `#/diagram-2/<id>` deep link behavior.
- Settings Navigation display of the canonical route.
- Diagram 2 isolation from `.diagram-screen`.
