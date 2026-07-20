# 2026-07-21 - Requirements - Day 34

## Documentation Diagram-OLE Plan

### Goal

Allow a Documentation rich-text document to embed a live reference to an existing Diagram record instead of embedding a copied SVG/image. The document should always render the latest saved version of the referenced Diagram when the document is loaded or refreshed. This gives PMT a lightweight Object-Linking and Embedding (OLE) workflow for diagrams shared across the team.

### Core behavior

1. The user creates and saves a Diagram in the Diagram screen.
2. The user edits a Documentation document and clicks a new rich-text toolbar action to insert a linked Diagram.
3. PMT shows a picker of existing Diagram records the user can read.
4. The document stores a database-backed reference to the Diagram record, not a copy of its SVG.
5. When the document is viewed later, PMT resolves that reference from the current database state and renders the latest saved Diagram content in an embedded read-only viewer.
6. The embedded viewer can be resized in the document and can pan, zoom, and reset view.
7. Per-user viewport state may be remembered locally by document id, linked diagram id, and embedded block id so each user can return to the same view without changing other users' views.

### Database-backed design

PMT already stores both Documentation and Diagram records in `[pmt].[Blogs]`. Diagrams are identified by their Diagram-specific body metadata and latest saved SVG content. The OLE block will store a stable Diagram `BlogId` reference inside the Documentation document body:

```html
<figure
  class="pmt-diagram-ole"
  contenteditable="false"
  data-pmt-ole="diagram"
  data-diagram-id="123"
  data-block-id="pmt-ole-..."
  data-view-width="900"
  data-view-height="520">
</figure>
```

Because the reference is stored in the Documentation record's `BodyHtml`, it is database-backed and shareable with the team. When the referenced Diagram is updated, every document containing that reference renders the current Diagram on the next load/refresh.

### Implementation stages

#### Stage 1 - MVP insert and render

- Add a rich-text toolbar action named `Insert Linked Diagram`.
- Open a simple picker of readable Diagram records.
- Insert a non-editable Diagram-OLE block into the rich-text editor.
- Hydrate Diagram-OLE blocks in Documentation read-only views and editors from the current database state.
- Show a clear placeholder when the referenced Diagram is missing, deleted, or inaccessible.

#### Stage 2 - Embedded read-only viewer

- Render the referenced Diagram SVG into the OLE block.
- Support basic pan and zoom in the embedded viewer.
- Add Reset/Fit controls.
- Keep the viewer read-only; editing still happens only in the Diagram screen.

#### Stage 3 - Resize and viewport memory

- Allow resizing the OLE block in the document editor.
- Store the viewer width/height on the OLE block in `BodyHtml`.
- Store per-user viewport state in local storage by document id, diagram id, and block id.

#### Stage 4 - Export and print behavior

- For static exports, render the latest Diagram snapshot at export time instead of exporting an empty interactive shell.
- Include a small linked-Diagram label so exported content remains understandable outside PMT.

#### Stage 5 - Polish

- Add richer picker previews or thumbnails if the tree/list picker is not enough.
- Add an `Open Diagram` action on the embedded viewer.
- Consider database-backed viewport preferences later if cross-device viewport memory becomes important.

### Testing expectations

- Insert a linked Diagram into a document and save it.
- Reopen the document and verify the embedded viewer renders the latest saved Diagram.
- Edit the Diagram in the Diagram screen, then reload/open the document and verify the embedded viewer updates.
- Verify inaccessible or deleted diagrams render a safe placeholder.
- Verify document save/reopen preserves OLE block size.
- Verify pan/zoom/reset works without editing the document text around the embedded viewer.

