# Diagram 2 Day 05 Read-Only Shell

Date: 2026-07-25

## Scope

Day 05 makes Diagram 2 browse and open the same backing Diagram documents as Diagram 1 without enabling editing.

- Diagram 1 remains the production Diagram editor.
- Diagram 2 does not call Diagram 1's complete screen renderer.
- No database migration, API endpoint, stored procedure, file format, clipboard format, or template schema is introduced.

## Shared Document Adapter

`wwwroot/js/shared/diagram-documents.js` owns shared helpers for:

- Detecting Diagram backing documents from existing Documentation `bodyHtml`.
- Applying the same owned-or-public visibility rule used by Diagram 1.
- Reading the saved SVG source from the backing document.
- Loading external SVG sources with PMT path-base handling.
- Rendering the current complete saved SVG through the existing image-annotation read-only SVG builder when editable metadata is present.

The adapter is read-only. It does not save Diagram content or view state.

## Diagram 2 UI

Diagram 2 now renders stable, isolated regions:

```html
<section class="diagram2-screen">
  <header data-diagram2-header></header>
  <aside data-diagram2-tree></aside>
  <main data-diagram2-viewer-host></main>
</section>
```

The screen is labeled `Diagram 2 Beta` and supports:

- Tree/card document browsing.
- Left pane show/hide.
- Left pane resize.
- Search, project, sprint, visibility, sort, creator, and last-editor filters.
- Selected document persistence.
- Read-only Fit and zoom preferences.
- A disabled PMT Diagram import probe control.

All UI state uses `pmt-diagram2-*` preference keys so Diagram 1 preferences remain separate.

## Routes

The canonical route remains:

```text
#/diagram-2
```

Selecting a Diagram in Diagram 2 updates the route to:

```text
#/diagram-2/<diagramDocumentId>
```

The legacy parser alias `#/diagram2/<diagramDocumentId>` still opens Diagram 2 and does not redirect into Diagram 1.

## Compatibility

The Day 05 renderer is temporary read-only scaffolding. It displays the current complete saved SVG and rebuilds the read-only SVG from canonical image-annotation metadata when available.

The disabled import probe is backed by tests that parse the existing `pmt-diagram` fixture through the shared codec for `Diagram 2`. No separate importer is added.

## Validation Coverage

`tests/js/diagram2-readonly-shell.test.mjs` covers:

- Same backing document selection from existing Diagram document `bodyHtml`.
- Owned/private and public visibility.
- Read-only SVG rendering from canonical metadata.
- Diagram 2-specific preference key names.
- The shared `pmt-diagram` fixture parse probe.

`tests/browser/diagram2-navigation.spec.mjs` covers:

- Diagram 2 top navigation.
- Read-only document list and viewer rendering.
- Selecting another Diagram updates `#/diagram-2/<id>`.
- Browser back/forward between Diagram and Diagram 2.
- Deep linking to a Diagram 2 document.
- Settings Navigation display of the canonical route.
- Diagram 2 isolation from `.diagram-screen`.
