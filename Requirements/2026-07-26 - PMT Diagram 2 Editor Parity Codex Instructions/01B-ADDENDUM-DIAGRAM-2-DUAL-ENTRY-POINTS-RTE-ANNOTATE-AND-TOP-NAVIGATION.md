# PMT Diagram 2 Editor Parity Program

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


# Addendum — Diagram 2 Dual Entry Points: RTE Annotation and Top-Navigation Diagram Editor

## Placement and execution order

This is a **new addendum** to the Diagram 2 editor-parity instruction series.

It is intentionally named so it appears immediately after:

```text
01A-ADDENDUM-DIAGRAM-2-VISUAL-EDITOR-PARITY-MANDATE.md
```

and immediately before:

```text
02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md
```

Phase 1 has already been completed. Do not repeat the entire Phase 1 inventory.

Read this addendum before continuing Phase 2. Integrate it into the approved Phase 1 architecture and all later implementation phases.

This addendum defines a mandatory product requirement that was not explicit enough in the earlier instructions:

> **Diagram 2 must be launchable through two separate user entry points while using one shared Diagram 2 editor core and one shared high-performance renderer.**

The two entry points are:

1. **RTE image annotation entry point**
2. **Top-navigation Diagram 2 entry point**

Do not build two independent Diagram 2 editors.

---

# 1. Historical Diagram 1 entry point

The original Diagram 1 / Image Annotation workflow began inside a PMT rich-text editor.

The user:

1. Opens or edits content in a PMT rich-text editor.
2. Selects an image already inserted in the RTE.
3. Right-clicks the selected image.
4. Opens the image context menu.
5. Chooses:

```text
Annotate
```

After the image already contains annotation metadata, the context-menu command later becomes:

```text
Edit Annotate
```

This is a real and important Diagram 1 entry point.

It must remain available while Diagram 2 is developed and tested.

Do not remove, rename, or redirect the existing Diagram 1 commands without separate approval.

---

# 2. Required Diagram 2 RTE entry point

Add a side-by-side Diagram 2 annotation command to the image context menu.

For an image that does not yet contain an editable annotation, provide:

```text
Annotate
Annotate 2.0
```

The existing `Annotate` command continues to open Diagram 1.

The new `Annotate 2.0` command opens Diagram 2 in the RTE annotation host context.

For an image that already contains editable annotation metadata, provide the appropriate edit labels:

```text
Edit Annotate
Edit Annotate 2.0
```

The existing `Edit Annotate` command continues to open Diagram 1.

The new `Edit Annotate 2.0` command opens the same selected image/annotation in Diagram 2.

The exact context-menu ordering should keep the two versions easy to compare. A reasonable order is:

```text
Annotate
Annotate 2.0
```

or:

```text
Edit Annotate
Edit Annotate 2.0
```

Do not hide Diagram 1 merely because Diagram 2 is available.

The purpose of the temporary `2.0` wording is to allow Sin to test the two implementations side by side.

The final labels may be simplified later only after separate approval and after Diagram 2 is proven to be a full replacement.

---

# 3. Second Diagram 2 entry point: top-navigation feature

Diagram 2 must also remain launchable from PMT's top navigation as the full standalone Diagram feature/screen.

This entry point is the existing or planned route such as:

```text
#/diagram-2
#/diagram-2/{documentId}
```

The top-navigation Diagram 2 experience is a full document-oriented editor.

It must support:

- Diagram document library/tree/card navigation.
- Opening a selected Diagram document.
- Creating and editing Diagram content.
- Editing the same backing Diagram documents used by Diagram 1.
- Save and row-version collision handling.
- Document metadata.
- Project and Sprint association where applicable.
- Visibility and permissions.
- Import and export.
- Templates.
- Full Diagram editor tools.
- Full-screen editor layout.
- Diagram 1 to Diagram 2 round-trip compatibility.

The navigation label should remain:

```text
Diagram 2
```

until a separate future approval changes it.

---

# 4. One shared Diagram 2 editor, two host adapters

The required architecture is:

```text
                         Diagram 2 editor core
             Commands, history, selection, inspector state
                                  |
                         Canonical Diagram state
                                  |
                      Diagram 2 renderer core
                                  |
                Persistent keyed incremental SVG renderer
                                  |
                +-----------------+-----------------+
                |                                   |
                v                                   v
       RTE annotation host                 Diagram document host
       Annotate 2.0 /                      Top-navigation Diagram 2
       Edit Annotate 2.0
```

The following must be shared between both entry points:

- Diagram 2 editor controller.
- Command system.
- Command-based history.
- Selection model.
- Canonical state mutation rules.
- Object creation and editing logic.
- Entity and relationship logic.
- Inspector logic.
- Toolbar command definitions.
- Clipboard logic where applicable.
- Template application logic.
- Renderer integration.
- Persistent keyed nodes.
- Dirty-state batching.
- Geometry preview.
- Selective relationship routing.
- Spatial indexes.
- Viewport virtualization.
- Low-detail rendering.
- Full-detail SVG/export builder.
- Cleanup lifecycle.

Only host-specific responsibilities should differ.

---

# 5. Host-specific responsibilities

## 5.1 RTE annotation host

The RTE annotation host owns:

- The originating RTE instance.
- The selected image element or image reference.
- The image source.
- Existing annotation metadata, if present.
- Opening Diagram 2 in an embedded/modal/maximized annotation context.
- Save back to the selected RTE image.
- Cancel and close behavior.
- Restoring RTE focus and selection.
- Preserving the RTE document context.
- Avoiding unnecessary route changes.
- Avoiding creation of a standalone Diagram document unless the user explicitly chooses such an operation in the future.

## 5.2 Top-navigation Diagram host

The Diagram document host owns:

- The selected Diagram document ID.
- Document library navigation.
- Document metadata.
- The PMT Diagram backing record.
- Save callbacks.
- Row-version collision handling.
- Route updates.
- Full-screen page lifecycle.
- Permissions.
- Public/private behavior.
- Project and Sprint relationships.
- Standalone import/export workflows.

## 5.3 The editor core must not own host concerns

The shared editor core must not assume:

- It always has a Blog/Diagram document ID.
- It always has a document library.
- Save always updates a PMT Diagram record.
- Close always changes the browser route.
- It always occupies the entire PMT screen.
- It always runs inside an RTE modal.
- It always has the same permissions or metadata fields.
- It can recreate the entire PMT app container.

Use host adapters or injected callbacks.

A conceptual API may resemble:

```javascript
createDiagram2Editor({
    host,
    mode: "rte-annotation" | "diagram-document",
    initialState,
    imageContext,
    documentContext,
    permissions,
    saveAdapter,
    cancelAdapter,
    closeAdapter,
    notify
});
```

This example is conceptual. Adapt it to PMT's existing JavaScript architecture and naming conventions.

---

# 6. RTE `Annotate 2.0` behavior

When the user selects an unannotated image in an RTE and chooses:

```text
Annotate 2.0
```

Diagram 2 must:

1. Preserve the originating RTE context.
2. Capture the selected image and its current source.
3. Load the image as the annotation background or source image.
4. Create a new canonical annotation state.
5. Open the Diagram 2 editor using the RTE annotation host.
6. Provide the appropriate Diagram 2 tools and inspector tabs.
7. Keep the editor high-performance.
8. Allow Save and Cancel.
9. On Save:
   - Commit any active gesture.
   - Flush pending dirty state.
   - Validate canonical state.
   - Build the complete full-detail annotation SVG.
   - Update or replace the selected RTE image using the existing safe RTE annotation workflow.
   - Preserve complete annotation metadata.
   - Restore focus to the RTE.
10. On Cancel:
   - Do not alter the original selected image.
   - Dispose the Diagram 2 editor and renderer.
   - Restore focus to the RTE.

Opening the editor alone must not modify the RTE content.

---

# 7. RTE `Edit Annotate 2.0` behavior

When the selected RTE image already contains editable annotation metadata and the user chooses:

```text
Edit Annotate 2.0
```

Diagram 2 must:

1. Read the complete canonical annotation metadata from the selected image/SVG.
2. Preserve all supported objects and extension data.
3. Open the same annotation in Diagram 2.
4. Display the same user-visible Diagram content.
5. Allow editing through Diagram 2's editor commands.
6. Save back to the same RTE image context.
7. Preserve Diagram 1 compatibility where the shared format supports it.

The selected RTE image must not be flattened into an uneditable bitmap merely because Diagram 2 edited it.

The saved result must retain the canonical annotation metadata needed for future editing.

---

# 8. Side-by-side Diagram 1 and Diagram 2 testing

During the parity program, both RTE commands must remain available.

For an unannotated image:

```text
Annotate
Annotate 2.0
```

For an annotated image:

```text
Edit Annotate
Edit Annotate 2.0
```

This allows direct comparison of:

- Editor appearance.
- Toolbar behavior.
- Inspector behavior.
- Selection.
- Dragging.
- Resizing.
- Crop behavior.
- Entity editing.
- Field mapping.
- Save behavior.
- Reopen behavior.
- Performance.
- Memory cleanup.

Do not silently redirect `Annotate` to Diagram 2.

Do not silently redirect `Edit Annotate` to Diagram 2.

Do not remove Diagram 1 from the RTE context menu until separate approval.

---

# 9. Annotation ownership and compatibility

Do not create mutually exclusive Diagram 1 and Diagram 2 annotation formats.

The preferred behavior is:

- Diagram 2 can open annotations created by Diagram 1.
- Diagram 1 can reopen annotations saved by Diagram 2 when the annotation uses supported shared canonical features.
- Both editors continue using the shared canonical annotation/Diagram representation.
- Renderer-only Diagram 2 state is never persisted.

Do not introduce:

```text
pmt-annotation-2
pmt-diagram-2
diagram2-only annotation metadata
```

unless an unavoidable extension is separately approved.

If Diagram 2 adds safe extension data not understood by Diagram 1:

- Preserve it through the shared extension mechanism.
- Do not corrupt Diagram 1-supported data.
- Document the compatibility limitation.
- Do not silently discard data.

The goal remains two-way compatibility.

---

# 10. Context-menu detection rules

Codex must inspect the existing RTE image context-menu implementation and determine how PMT currently decides whether to show:

```text
Annotate
```

or:

```text
Edit Annotate
```

Reuse the same renderer-neutral detection where safe.

Add the Diagram 2 command beside it.

Expected conceptual behavior:

```text
Selected image has no editable annotation metadata:
    Annotate
    Annotate 2.0

Selected image has editable annotation metadata:
    Edit Annotate
    Edit Annotate 2.0
```

Do not rely only on visible text, filename, or image extension.

Use the existing trusted annotation metadata and parsing logic.

If the selected content is not a supported image:

- Do not show invalid annotation commands.
- Preserve the current RTE context-menu behavior.

---

# 11. RTE visual behavior

The RTE-launched Diagram 2 editor should visually resemble the existing Diagram 1 annotation editor so users recognize it immediately.

Preserve, where applicable:

- Toolbar button order.
- Tool icons.
- Tooltips.
- Inspector tab names and order.
- Canvas appearance.
- Selection handles.
- Crop handles.
- Entity and mapping controls.
- Save and Cancel placement.
- Full-screen/maximized annotation workflow.
- Keyboard shortcuts.
- Context-menu behavior.

The RTE host may omit standalone document-library and document-metadata UI that does not apply to an embedded annotation.

That is a host-context difference, not a separate editor implementation.

---

# 12. Top-navigation visual behavior

The top-navigation Diagram 2 screen should visually resemble the full Diagram 1 editor.

Preserve, where applicable:

- Toolbar.
- Objects pane.
- Canvas.
- Inspector.
- Tabs.
- Document library.
- Metadata controls.
- Save/Undo/Redo.
- Templates.
- Import/export.
- Context menus.
- Selection and editing affordances.

The top-navigation host adds document-oriented UI around the same Diagram 2 editor core.

---

# 13. Performance requirements for both entry points

Both entry points must preserve Diagram 2's performance architecture.

Do not make the RTE path a legacy full-render path.

Do not make the top-navigation path the only optimized path.

For both hosts:

- Use persistent keyed SVG nodes.
- Use dirty-state batching.
- Use one scheduled flush per animation frame.
- Use geometry preview during drag and resize.
- Use selective relationship routing.
- Use spatial indexes.
- Use viewport-plus-halo virtualization.
- Use low-detail rendering at extreme zoom-out.
- Keep selected and active-gesture objects mounted.
- Keep full-detail save/export separate from live rendering.
- Use explicit cleanup on close/deactivate.

Opening `Annotate 2.0` must not run expensive compatibility proofs on every launch.

The RTE host must not rebuild the entire RTE when the annotation changes.

The top-navigation host must not rebuild the complete PMT screen during ordinary editing.

---

# 14. Lifecycle and cleanup

The RTE annotation host must clean up when:

- Save completes.
- Cancel is chosen.
- The dialog is closed.
- The originating RTE is destroyed.
- Navigation occurs unexpectedly.
- A new annotation session replaces the old session.

The top-navigation Diagram host must clean up when:

- Navigating away.
- Opening another Diagram.
- Re-rendering the page shell.
- Logging out.
- The feature is deactivated.

Cleanup must include:

- Animation frames.
- Event listeners.
- Pointer captures.
- Timers.
- Observers.
- Object URLs.
- Image resources.
- Clipboard resources.
- Live renderer maps.
- Route indexes.
- Viewport indexes.
- Preview overlays.
- Global debug references.
- Host DOM.

Repeated launch/close cycles in both entry points must not cause continuing memory growth.

---

# 15. Required Phase 2 architecture updates

Phase 1 is complete.

Before substantial Phase 2 implementation:

1. Read the completed Phase 1 inventory.
2. Identify the existing Diagram 1 RTE image annotation launch path.
3. Identify:
   - Image-selection logic.
   - Context-menu construction.
   - `Annotate` action.
   - `Edit Annotate` action.
   - Existing annotation dialog/editor opening logic.
   - RTE save-back logic.
   - Cancel/close logic.
4. Add the two Diagram 2 RTE actions:
   - `Annotate 2.0`
   - `Edit Annotate 2.0`
5. Define host adapters before coupling the editor shell to the top-navigation page.
6. Ensure the shared editor core can run in both modes.
7. Document the host boundary.
8. Add both launch paths to the feature-parity matrix.

Do not redo the whole Phase 1 analysis.

---

# 16. Required tests

## 16.1 RTE new annotation test

```text
Open an RTE
Insert/select an image
Right-click the image
Verify Annotate and Annotate 2.0 are both present
Choose Annotate 2.0
Add at least two annotation objects
Save
Verify the RTE image updates
Reopen through Edit Annotate 2.0
Verify the objects remain editable
```

## 16.2 RTE cancel test

```text
Open an RTE
Select an image
Choose Annotate 2.0
Make changes
Cancel
Verify the original RTE image and content are unchanged
```

## 16.3 RTE Diagram 1 compatibility test

```text
Create or edit an annotation using Annotate
Close Diagram 1
Select the same image
Choose Edit Annotate 2.0
Verify Diagram 2 opens the same canonical content
Save with Diagram 2
Choose Edit Annotate
Verify Diagram 1 reopens the supported content
```

## 16.4 Top-navigation compatibility test

```text
Open a Diagram 1 document in Diagram 2
Edit and save
Open the same document in Diagram 1
Verify the supported content
Edit and save in Diagram 1
Reopen in Diagram 2
Verify the change
```

## 16.5 Dual-host lifecycle test

```text
Open and close Annotate 2.0 ten times
Open and leave Diagram 2 ten times
Verify no stale SVG, listeners, renderer maps, observers, or continuing memory growth
```

## 16.6 Side-by-side label test

Verify:

```text
Unannotated supported image:
    Annotate
    Annotate 2.0

Annotated supported image:
    Edit Annotate
    Edit Annotate 2.0
```

---

# 17. Required completion-report additions

Every phase that affects editor hosting, RTE integration, or launch behavior must report:

```text
Diagram 1 RTE Annotate preserved:
Diagram 1 RTE Edit Annotate preserved:
Diagram 2 RTE Annotate 2.0 available:
Diagram 2 RTE Edit Annotate 2.0 available:
Diagram 2 top-navigation launch available:
Shared editor core used by both hosts:
RTE-specific adapter files:
Diagram-document adapter files:
RTE save-back tested:
RTE cancel tested:
Diagram 1 annotation opened in Diagram 2:
Diagram 2 annotation reopened in Diagram 1:
Repeated RTE open/close cleanup:
Repeated top-navigation open/close cleanup:
Performance before:
Performance after:
Known host-specific limitations:
```

---

# 18. Prohibited shortcuts

Do not:

- Build an entirely separate Diagram 2 editor for the RTE.
- Copy the complete Diagram 1 annotation editor and call it Diagram 2.
- Keep the RTE path permanently on Diagram 1 while claiming Diagram 2 parity.
- Make `Annotate 2.0` open the top-navigation route as a workaround.
- Create a standalone Diagram document every time an RTE image is annotated.
- Modify the RTE image before the user presses Save.
- Lose the originating RTE selection or focus.
- Flatten editable annotation metadata.
- Remove `Annotate` or `Edit Annotate`.
- Redirect Diagram 1 commands to Diagram 2 without approval.
- Introduce a second incompatible annotation format.
- Persist renderer caches or low-detail DOM.
- Rebuild the complete RTE during annotation edits.
- Use a full live Diagram render for ordinary local edits.

---

# 19. Expected final outcome

When the Diagram 2 editor-parity program is complete:

## RTE workflow

A user can:

1. Open a PMT rich-text editor.
2. Select an image.
3. Right-click it.
4. Choose either Diagram 1 or Diagram 2:

```text
Annotate
Annotate 2.0
```

or, for an existing annotation:

```text
Edit Annotate
Edit Annotate 2.0
```

5. Use the familiar editor.
6. Save the result back into the same RTE image.
7. Reopen and continue editing later.

## Top-navigation workflow

A user can:

1. Open `Diagram 2` from PMT's top navigation.
2. Select a Diagram document.
3. Use the full familiar Diagram editor.
4. Save the same backing Diagram document.
5. Reopen it in Diagram 1 or Diagram 2.

## Architecture outcome

Both workflows use:

- One Diagram 2 editor core.
- One command and history system.
- One canonical state model.
- One high-performance Diagram 2 renderer.
- Different host adapters only where the launch context requires it.

The intended result is:

> **One high-performance Diagram 2 editor with two first-class launch experiences: `Annotate 2.0` from an RTE image and `Diagram 2` from PMT's top navigation. Diagram 1 remains available side by side during testing through `Annotate`, `Edit Annotate`, and the original `Diagram` screen.**

---

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Integration status in the regenerated package

This dual-entry-point requirement is integrated directly into the updated Phase 2–8 files, parity matrix, completion report, Start Here file, master constitution, and all-in-one instructions.

The authoritative product requirement remains:

```text
One Diagram 2 editor core
    ├── RTE host: Annotate 2.0 / Edit Annotate 2.0
    └── Document host: top-navigation Diagram 2
```

Codex must preserve the original Diagram 1 commands and screen side by side until Sin separately approves replacement.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

# Final instruction to Codex

> **Implement Diagram 2 as one shared high-performance editor that can be hosted in two places. The first host is the RTE image context menu: preserve Diagram 1's `Annotate` / `Edit Annotate` commands and add side-by-side `Annotate 2.0` / `Edit Annotate 2.0` commands for Diagram 2. The second host is the full top-navigation `Diagram 2` feature. Share the editor controller, commands, history, canonical state, inspector logic, toolbar logic, and Diagram 2 renderer. Separate only the host-specific source, save target, close/cancel behavior, routing, metadata, and document-library responsibilities. Preserve Diagram 1 compatibility and Diagram 2 performance in both entry points.**
