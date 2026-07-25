# Diagram 2 Day 01 Baseline

Date: 2026-07-25

## Scope

Day 01 protects the existing Diagram screen before Diagram 2 renderer work starts.

- Diagram 1 remains the production fallback.
- Diagram 2 is registered only as an isolated top-level shell.
- No Diagram 1 rendering logic was intentionally changed.
- No database migration is required.

## Production Protection Notes

- PMT is used in production; Diagram 1 is treated as the stable production Diagram.
- Diagram 2 code lives in separate `wwwroot/js/features/diagram2/` and `wwwroot/css/features/diagram2.css` files.
- Diagram 2 is routed and rendered as its own feature. It does not import or mutate the Diagram 1 feature module.
- Existing Diagram 1 file format, SVG state metadata, template library shape, local storage keys, API endpoints, and stored procedures remain unchanged.
- Future Diagram 2 phases must preserve the current Diagram 1 codec until an explicit migration plan exists.

## Post-Plan Requirements Reviewed

The Diagram 2 daily plan markdown files were last written at 2026-07-22 22:55:02. Before implementing Day 01, these newer requirement notes were reviewed because they were created the same day or later:

| Requirement file | Last write time | Diagram-relevant update |
| --- | --- | --- |
| `Requirements/2026-07-22 - Requirements - Day 35.txt` | 2026-07-23 06:00:33 | Linked Diagram/OLE behavior, per-tab viewport and zoom, reset/fit behavior, and Diagram first-paint loader expectations. |
| `Requirements/2026-07-24 - Requirements - Day 36.txt` | 2026-07-25 09:03:19 | Screen-to-entity field mapping, Field Rectangle virtual entity behavior, and generated Field Mapping Table requirements. |
| `Requirements/2026-07-25 - Requirements - Day 37.txt` | 2026-07-25 16:22:33 | Field Mapping Table hover/click/double-click behavior, dynamic rows, Mapping tab styling/export, SVG/PNG export options, Crop tab changes, and read-only context menu behavior. |

## Current Repository Facts

- `wwwroot/js/core/screen-registry.js` registers Diagram 1 as view `Diagram` with route feature `diagram`.
- `wwwroot/js/core/router.js` derives `#/diagram` from the Diagram 1 registry entry.
- `wwwroot/js/shared/security.js` maps Diagram 1 to the `Documentation` resource.
- `wwwroot/js/features/diagram/pmt-diagram-file.js` uses format `pmt-diagram` and format version `1`.
- `wwwroot/js/app.js` passes the existing Object Template library callbacks to Diagram 1:
  - `/api/image-annotation/template-library`
  - `/api/image-annotation/default-template-library`
- The bundled PMT schema asset at `wwwroot/assets/docs/pmt-database-schema.svg` currently parses as 88 Diagram objects, 29 Entity objects, and 82 foreign-key relationship records.
- Diagram 1 currently supports Field Rectangles as compact virtual Entities with `entityKind: "field-rectangle"`.
- Diagram 1 currently supports generated Field Mapping Tables as objects with `type: "field-mapping-table"`, dynamic row sizing, UI/database row data, table styling properties, and yellow attention-highlight styling.
- Diagram 1 currently has browser coverage for Field Mapping Table hover highlighting without changing the user-selected mapped relationship colors.
- The worktree was clean before Day 01 edits. `git status --short`, `git diff --stat`, and `git diff` produced no output.

## Diagram 1 Smoke Checklist

Run this checklist in Chrome or Chromium with developer tools open and the Console visible.

- [ ] Open PMT and sign in.
- [ ] Open the existing Diagram screen from top navigation.
- [ ] Switch between Tree view and Card view.
- [ ] Open `PMT's Database Schema`.
- [ ] Confirm read-only zoom out, zoom in, pan, and Fit keep the Diagram visible.
- [ ] Enter edit mode.
- [ ] Select one object and confirm the expected inspector tab appears.
- [ ] Select several objects and confirm multi-selection chrome is coherent.
- [ ] Drag one object and confirm it commits one move.
- [ ] Resize one supported object and confirm it keeps the expected bounds.
- [ ] Collapse and expand one Entity.
- [ ] Show and hide Entity data types.
- [ ] Edit a visible style value and confirm Undo/Redo can reverse and restore it.
- [ ] Add one object from the Object Template library.
- [ ] Copy and paste an object.
- [ ] Place or open a Field Rectangle and confirm it is listed as `Field: {Field}`.
- [ ] Confirm a Field Rectangle can map to an Entity field and keeps its user-selected relationship line style.
- [ ] Generate or open a Field Mapping Table and confirm the UI Field and Database Field rows render.
- [ ] Hover, single-click, and double-click a Field Mapping Table row in edit mode.
- [ ] Open the Diagram read-only view and confirm Field Mapping Table hover/click behavior does not blank the Diagram.
- [ ] Use read-only Diagram context menu items for Entity Relationships, UI to DB Field Mapping, Copy as SVG, and Copy as PNG.
- [ ] Export a PMT Diagram file.
- [ ] Import the exported PMT Diagram file into a disposable Diagram.
- [ ] Save and reopen the disposable Diagram.
- [ ] Use Undo and Redo after reopening edit mode.
- [ ] Leave the Diagram screen and return to it; confirm the original Diagram still opens.

Document any failure as pre-existing if it reproduces before a Diagram 2 phase changes the affected code.

## Performance Baseline

Historical local measurements were already present under ignored `artifacts/` folders. The source data remains local and is not committed. Day 01 records the baseline values that matter for the Diagram 2 project.

### PMT Schema Fixture

Source: `wwwroot/assets/docs/pmt-database-schema.svg`.

| Metric | Value |
| --- | ---: |
| Diagram objects | 88 |
| Entities | 29 |
| Foreign-key relationship records | 82 |
| Width | 7,131 |
| Height | 3,874 |

### Synthetic 232-Entity Fixture

Source summary: `artifacts/diagram-220-table-stress-summary.md`.

| Metric | Value |
| --- | ---: |
| Entities | 232 |
| Relationships | 624 |
| Canvas objects | 704 |
| Read SVG elements | 17,468 |
| Edit SVG elements | 18,558 |
| Exported SVG size | 2.68 MB |

### Normal CPU Measurements

Sources: `artifacts/diagram-232-table-current-full-cpu1/report.json` and `artifacts/diagram-232-table-core-cpu1-current/report.json`.

| Measurement | Value |
| --- | ---: |
| 29-entity build | 0.45 s |
| 58-entity build | 1.47 s |
| 116-entity build | 5.43 s |
| 232-entity build | 28.49 s |
| 232-entity initial read usable view | 40.35 s |
| 232-entity initial edit usable view | 83.11 s |
| 232-entity read zoom first-frame average | 12.68 ms |
| 232-entity edit zoom first-frame average | 12.07 ms |
| 232-entity zoom first-frame max | 16.2 ms |
| Settled correctness violations | 0 |

### Chrome 6x CPU Slowdown Measurements

Sources: `artifacts/diagram-116-table-core-cpu6/report.json` and `artifacts/diagram-220-table-plane-stress/report.json`.

| Measurement | Value |
| --- | ---: |
| 29-entity route/SVG build | 6.74 s |
| 58-entity route/SVG build | 20.73 s |
| 116-entity route/SVG build | 121.79 s |
| 232-entity throttled route/SVG build | Estimated 8-12 minutes; full run was intentionally stopped |
| 232-entity capped SVG plane attach | About 2.0 s |
| 232-entity throttled plane-settle average | About 0.74-0.78 s |

## Metric Capture Checklist

For every future Diagram 2 performance phase, record these values for the PMT schema fixture and the 232-entity fixture at normal CPU and Chrome 6x CPU slowdown:

- Initial open.
- First useful frame.
- Final settled frame.
- Select.
- Clear selection.
- Drag start.
- Drag frame.
- Drag commit.
- Resize commit.
- Collapse/expand.
- Show/hide data types.
- Style change.
- Zoom first frame.
- Zoom settle.
- Pan frame.
- Fit.
- Save.
- Export.
- Import.
- Total duration.
- Relationship-routing duration.
- SVG generation duration.
- DOM update duration.
- Full-render count.
- Rerouted relationship count.
- SVG descendant count.
- Detached-node count after close.

## Compatibility Fixtures

Safe synthetic fixtures are stored under `tests/fixtures/diagram-compatibility/`.

- `diagram1-synthetic-export.pmt-diagram.json`
- `selection-ordinary-shapes.json`
- `selection-related-entities.json`
- `template-library-sample.json`
- `mixed-diagram-state.json`

These fixtures contain only synthetic Diagram data and no private production data.
`mixed-diagram-state.json` includes the newer Diagram 1.0 surface area that post-dates the Diagram 2 plan: rich text, manual relationship routes, collapsed Entities, data types, a cropped embedded screenshot, a Field Rectangle virtual Entity, a many-to-one field mapping relationship, and a Field Mapping Table with highlight styling.

## Known Pre-Existing Failures And Limits

- The existing large 232-entity path is not office-ready because route/SVG generation dominates initial read/edit load.
- The 232-entity Chrome 6x full route/SVG build was estimated from measured scaling because the full throttled run was intentionally stopped.
- The Day 01 automated tests lock codec, normalization, fixture parsing, navigation, and copy/paste compatibility. Browser interaction timing remains a manual/performance-harness measurement, not a CI timing assertion.
