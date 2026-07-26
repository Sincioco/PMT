# PMT Diagram 2 Editor Parity Program

# Addendum — Diagram 2 Visual Editor Parity Mandate

## Placement and execution order

This is a **new addendum** to the Diagram 2 editor-parity instruction series.

It is intentionally named so it appears immediately after:

```text
01-MASTER-EXPECTED-OUTCOME-AND-PERFORMANCE-CONSTITUTION.md
```

and immediately before:

```text
02-PHASE-1-INVENTORY-AND-ARCHITECTURE.md
```

Phase 1 has already been completed. Do not repeat Phase 1 unless a specific missing inventory item is discovered.

Read this addendum now, incorporate it into the approved Phase 1 architecture, and apply it to Phase 2 and every later implementation phase.

If earlier instructions could be interpreted as encouraging a visually different, simplified, or developer-oriented Diagram 2 editor, this addendum takes precedence:

> **Diagram 2 must visually look and feel like Diagram 1's editor unless Sin explicitly approves a deliberate UI change.**

---

# 1. Expected final outcome

When the Diagram 2 editor-parity program is complete, a user familiar with Diagram 1 should be able to open Diagram 2 and immediately recognize the same editor.

Diagram 2 should provide, where applicable:

- The same overall editor layout.
- The same toolbar position and grouping.
- The same toolbar button order.
- The same icons, labels, tooltips, and enabled/disabled behavior.
- The same left-side Objects pane.
- The same center Diagram canvas.
- The same right-side inspector.
- The same inspector tab names and order.
- The same fields and controls inside each tab.
- The same dialogs and context menus.
- The same selection, resize, crop, mapping, and relationship affordances.
- The same keyboard shortcuts.
- The same save, import, export, template, and document workflows.
- The same observable feature behavior.
- The same Diagram data after saving.

The intended user reaction is:

> **"This is the Diagram editor I already know, but it opens faster and stays responsive on much larger Diagrams."**

Diagram 2 must not feel like:

- A stripped-down technical renderer.
- A developer demonstration.
- A diagnostics screen.
- A separate unfamiliar product.
- A reduced editor that forces users to return to Diagram 1 for normal work.

The completed Diagram 2 editor must be useful by itself.

---

# 2. Same appearance does not mean same implementation

Codex must distinguish between:

```text
Visual and behavioral parity
```

and:

```text
Copying Diagram 1's internal implementation
```

Visual and behavioral parity is required.

Blindly copying Diagram 1's internal implementation is prohibited when it could reintroduce Diagram 1's performance problems.

For every Diagram 1 toolbar command, inspector control, context-menu action, keyboard shortcut, and editing gesture:

1. Inspect the visible markup, styling, label, icon, tooltip, order, state, and user-visible result.
2. Trace the canonical Diagram-state mutation and business rules.
3. Reproduce the same user-visible behavior in Diagram 2.
4. Route the operation through Diagram 2's editor controller, command system, dirty-state classification, and incremental renderer.
5. Redesign the internal implementation whenever Diagram 1 depends on:
   - Complete live SVG rebuilding.
   - Recreating the editor shell.
   - Broad relationship rerouting.
   - Global object scans during every pointer movement.
   - Repeated complete-state serialization.
   - Snapshot history for small local operations.
   - Direct manipulation of Diagram 1 renderer-owned SVG nodes.
   - Rebuilding all overlays after a small change.
   - Recalculating unrelated bounds, sectors, or relationships.
   - Heavy compatibility proofs during normal document loading.
   - Replacing large containers with `innerHTML` during interaction.
   - Losing stable DOM identity for retained objects.

The required result is:

```text
Same familiar UI
Same feature behavior
Same persisted Diagram result
Different high-performance implementation
```

---

# 3. Visual parity is the default decision

Do not redesign the Diagram editor merely because Diagram 2 uses a new renderer.

Unless Sin explicitly approves a change, preserve Diagram 1's visible structure and workflows.

## 3.1 Editor structure

Preserve, where applicable:

- Toolbar location.
- Toolbar grouping and separators.
- Canvas position.
- Left Objects pane position and behavior.
- Right inspector position and behavior.
- Inspector tab order.
- Save, Undo, and Redo placement.
- Full-screen editing behavior.
- Pane collapsing and resizing.
- Dialog placement and modality.
- Context-menu organization.
- Responsive desktop behavior.
- Selection-dependent controls.
- Permission-dependent controls.
- Empty-selection and multiple-selection states.

## 3.2 Toolbar presentation

For each Diagram 1 toolbar item, preserve where practical:

- Icon.
- Label.
- Tooltip.
- Button order.
- Group membership.
- Active state.
- Toggle state.
- Disabled state.
- Selection requirements.
- Permission requirements.
- Keyboard shortcut.
- Dropdown or flyout behavior.
- Default-style actions.
- Confirmation behavior.

Do not replace recognizable Diagram 1 toolbar groups with a generic developer toolbar.

Renderer diagnostics, Refresh Renderer, internal counters, and benchmark controls must not dominate the production editor. Keep diagnostics available through a development-only or collapsible diagnostics surface.

## 3.3 Inspector presentation

For each Diagram 1 inspector tab, preserve where practical:

- Tab name.
- Tab order.
- Tab icon.
- Field order.
- Group headings.
- Dividers.
- Labels.
- Help text.
- Input type.
- Default values.
- Conditional visibility.
- Enabled/disabled rules.
- Color-picker behavior.
- Numeric step behavior.
- Checkbox and toggle behavior.
- Apply-to-selection behavior.
- Empty-selection behavior.
- Mixed-value presentation for multiple selection.

## 3.4 Canvas presentation

Preserve the expected visual behavior for:

- Selection outlines.
- Resize handles.
- Rotation or special handles where supported.
- Relationship handles.
- Field-mapping handles.
- Crop handles.
- Hover highlights.
- Marquee selection.
- Selected-object layering.
- Snap guides if present.
- Cursor changes.
- Drag feedback.
- Relationship previews.
- Context-menu targets.
- Zoom and pan interaction.

Diagram 2 may use different SVG planes, overlays, hit paths, spatial indexes, and renderer APIs internally.

---

# 4. Reuse shared visual components where safe

Reuse PMT's renderer-neutral visual infrastructure whenever practical, including:

- Button components.
- Form components.
- Tab components.
- Dialog infrastructure.
- Color picker.
- Dropdowns.
- Checkbox and toggle controls.
- Tooltips.
- Icons.
- Typography.
- Spacing variables.
- Theme variables.
- Common panel styling.
- Shared accessibility helpers.
- Shared permission checks.

Reuse should reduce duplication without coupling Diagram 2 to Diagram 1's renderer lifecycle.

When sharing a component would require Diagram 2 to call Diagram 1's full-render or legacy DOM path, create a Diagram 2-specific controller or adapter instead.

A reasonable approach is:

- Reuse visual builders and common CSS when they are renderer-neutral.
- Keep Diagram 2 command handlers and canvas interactions separate.
- Extract shared presentation only after the boundary is understood.
- Do not destabilize Diagram 1 merely to remove a small amount of duplicate markup.

---

# 5. Required implementation boundary

The intended architecture is:

```text
Diagram 2 toolbar, inspector, Objects pane, dialogs, and shortcuts
                              |
                              v
                 Diagram 2 editor controller
                              |
                              v
                 Renderer-neutral editor commands
                              |
                              v
                   Canonical Diagram state
                              |
                              v
          Diagram 2 dirty-state and renderer APIs
                              |
                              v
    Persistent keyed SVG nodes, selective routing, virtualization
```

The UI must not directly regenerate the Diagram SVG.

The UI must not directly manipulate renderer-owned SVG nodes except through formally defined renderer or overlay APIs.

The editor controller must be responsible for:

- Validating commands.
- Applying canonical-state changes.
- Creating undoable operations.
- Classifying dirty state.
- Invoking the smallest required renderer update.
- Updating selection and inspector state.
- Preserving Diagram 1 and Diagram 2 file compatibility.

---

# 6. Feature-by-feature parity rule

For every Diagram 1 feature, Codex must create a Diagram 2 equivalent that satisfies all of the following.

## 6.1 Visual parity

- The control appears in the expected location.
- It uses the expected icon, label, tooltip, and state.
- The related tab, dialog, context menu, or overlay looks familiar.
- Any intentional visual difference is documented and requires Sin's approval.

## 6.2 Behavioral parity

- The same user action produces the same canonical Diagram result.
- Dialogs, validation, confirmation, and errors remain equivalent where practical.
- Selection behavior matches Diagram 1.
- Multi-selection behavior matches Diagram 1.
- Object-specific and tab-specific behavior matches Diagram 1.

## 6.3 Compatibility

- Diagram 2 opens existing Diagram 1 documents.
- Diagram 1 reopens Diagram 2 saves.
- No conversion command is required.
- No `pmt-diagram-2` format is introduced.
- No second template library is introduced.
- No second clipboard schema is introduced.
- Unknown safe extension data is preserved where the shared codec supports it.
- Renderer caches, mounted-node state, dirty state, and low-detail state are never persisted.

## 6.4 History

- The operation has correct Undo and Redo behavior.
- One user gesture creates one logical history entry.
- Typing, slider movement, color previews, and drag frames are coalesced appropriately.
- Local commands use command/delta history.
- Full snapshots are reserved for genuinely global operations.

## 6.5 Incremental rendering

- Only affected objects, overlays, relationships, bounds, and sectors are invalidated.
- Unrelated nodes retain identity.
- Ordinary local operations do not call a complete live `renderer.render(...)`.
- Local edits do not reroute every relationship.
- Selection changes do not trigger geometry work.
- Style changes do not trigger relationship routing unless the changed style affects route geometry.

## 6.6 Performance verification

- Test the feature on a normal Diagram and a large Diagram.
- Confirm no unnecessary full live render.
- Confirm no unrelated relationship rerouting.
- Confirm viewport virtualization remains active when appropriate.
- Confirm low-detail rendering remains active at overview scale.
- Measure the operation before and after implementation.
- Record any performance regression and fix it before declaring the feature complete.

## 6.7 Automated and manual validation

- Unit tests cover renderer-neutral commands where practical.
- Browser tests cover the actual UI workflow.
- The feature is added to the parity matrix.
- Save and cross-screen round-trip are tested.
- Manual approval is recorded.

A feature is not complete merely because its toolbar button or tab is visible.

---

# 7. Performance preservation mandate

Diagram 2's current performance architecture is a protected asset.

Do not weaken or bypass:

- Persistent keyed SVG nodes.
- Transform-only zoom and pan.
- Dirty-state batching.
- One scheduled flush per animation frame.
- Geometry preview during drag and resize.
- Selective relationship routing.
- Route caching.
- Spatial indexes.
- Viewport-plus-halo virtualization.
- Force-mounted selected and active-gesture objects.
- Low-detail overview rendering.
- Full-detail canonical save and export.
- Explicit renderer cleanup.
- Stable retained-node identity.

Every new UI feature must work within these systems.

If Diagram 1's implementation conflicts with these systems, redesign the feature for Diagram 2 while preserving the same user-visible behavior.

---

# 8. Phase 2-specific clarification

Phase 2 should establish the real Diagram 2 editor shell.

The Phase 2 shell should visually converge toward Diagram 1 immediately rather than creating another temporary UI that will later be discarded.

Phase 2 should include, as appropriate to its existing scope:

- Diagram 1-style editor layout.
- Diagram 1-style toolbar structure, even when later feature buttons are initially disabled or gated.
- Left Objects pane shell.
- Center Diagram 2 canvas.
- Right inspector shell with the expected tabs.
- Proper Save, Undo, and Redo placement.
- Selection-aware UI state infrastructure.
- Dialog and context-menu integration points.
- A development diagnostics toggle rather than a diagnostics-first layout.
- Stable shell DOM that is not recreated during ordinary canvas interactions.

Do not fake completed features.

A not-yet-implemented button may be absent or clearly disabled according to the phase plan, but the architecture must anticipate the final Diagram 1-style arrangement.

Do not create placeholder controls that falsely appear functional.

---

# 9. Phase 1 deliverable integration

Phase 1 is complete. Before changing Phase 2 code:

1. Read the completed Phase 1 inventory and architecture documents.
2. Add visual-parity information to the active parity matrix if it is missing.
3. For every Diagram 1 control already inventoried, record:
   - Visual source or builder.
   - CSS source.
   - Action name.
   - Enabled/disabled rules.
   - Selection rules.
   - Corresponding Diagram 2 command owner.
   - Expected phase.
4. Identify any Phase 1 architecture decision that conflicts with this addendum.
5. Resolve the conflict in favor of:
   - Familiar Diagram 1 UI.
   - Diagram 2 performance architecture.
   - Shared canonical compatibility.
6. Document the resolution before implementation.

Do not redo the entire Phase 1 analysis.

---

# 10. Examples

## 10.1 Rectangle tool

The Diagram 2 Rectangle button may look exactly like Diagram 1's Rectangle button.

The implementation must:

1. Create a Rectangle in canonical state.
2. Create one logical Undo entry.
3. Add one keyed renderer node.
4. Update only the relevant selection, Objects pane, inspector, bounds, and sectors.
5. Avoid rerouting Entity relationships.
6. Avoid rebuilding the entire Diagram or editor shell.

## 10.2 Fill-color change

The Diagram 2 fill-color control may look exactly like Diagram 1's control.

The implementation must:

1. Update only selected objects that support fill.
2. Coalesce continuous color-preview changes.
3. Patch only affected object styles.
4. Avoid geometry, world-bounds, sector, or routing work unless truly required.
5. Create one final logical Undo operation.

## 10.3 Entity field edit

The Entity tab may look exactly like Diagram 1's Entity tab.

The implementation must:

1. Apply the field edit to canonical state.
2. Rebuild only the affected Entity's internal structure when necessary.
3. Recalculate only affected anchors and connected relationships.
4. Update local bounds and sectors.
5. Preserve unrelated Entity nodes and routes.
6. Save in the same format Diagram 1 understands.

## 10.4 Drag and resize

The selection and resize handles may look exactly like Diagram 1's.

During pointer movement:

- Use temporary geometry preview.
- Keep selected objects force-mounted.
- Patch only preview geometry and lightweight relationship previews.
- Do not commit canonical state on every pointer event.
- Do not build full history snapshots on every pointer event.

On pointer release:

- Commit once.
- Resolve final geometry and affected routing once.
- Create one Undo entry.

## 10.5 Objects pane

The Objects pane may visually match Diagram 1.

Its implementation must:

- Update incrementally.
- Avoid rebuilding the complete tree for simple selection changes.
- Preserve expanded/collapsed state.
- Avoid forcing off-screen canvas nodes to mount merely because they appear in the tree.
- Center or reveal an object through a viewport command when selected from the tree.

---

# 11. Visual parity validation

For each major phase, perform side-by-side comparison between Diagram 1 and Diagram 2.

Test at minimum:

```text
1920 x 1080
1366 x 768
```

Test states should include:

- No selection.
- One Rectangle selected.
- Multiple objects selected.
- One Entity selected.
- One relationship selected.
- Image crop mode.
- Mapping mode.
- Objects pane expanded and collapsed.
- Inspector tabs.
- Dialog open.
- Context menu open.
- Fit and 100% zoom.
- Read-only versus editing states where applicable.

Use screenshots where practical, but do not require pixel-perfect identity when renderer-specific canvas internals differ.

The visual-parity review should focus on:

- Layout.
- Toolbar grouping.
- Tab names and order.
- Control presence and order.
- Selection affordances.
- Dialog workflows.
- Familiarity.
- Accessibility.
- No unintended developer-only clutter.

Document approved differences.

---

# 12. Performance validation for UI parity

Matching Diagram 1 visually must not add Diagram 1's performance costs.

Measure after each feature group:

- Time to first useful frame.
- Toolbar and inspector initialization.
- Selection latency.
- Inspector update latency.
- Drag-start latency.
- Drag-preview frame time.
- Resize-preview frame time.
- Local style patch time.
- Local structure patch time.
- Relationships considered and rerouted.
- Full-render count.
- Mounted object and relationship counts.
- SVG descendant count.
- Memory after repeated open/close cycles.

The editor UI itself must also remain efficient:

- Use event delegation where appropriate.
- Avoid duplicate listeners after rerender.
- Dispose listeners and observers on deactivate.
- Do not replace the complete editor shell during pointer movement, selection, or style changes.
- Update only affected controls.
- Debounce or coalesce high-frequency inspector input.
- Avoid repeatedly reading layout after writing layout in the same frame.
- Avoid synchronously serializing the complete Diagram for local UI state.

Any phase that significantly degrades the accepted Diagram 2 benchmark must stop and correct the regression before proceeding.

---

# 13. Compatibility is non-negotiable

Diagram 2 must continue to open Diagram 1 Diagrams directly.

Diagram 1 must continue to reopen Diagram 2 saves.

Continue using:

```text
format: pmt-diagram
formatVersion: 1
```

Continue using the shared:

- Diagram backing documents.
- File codec.
- Selection clipboard codec.
- Template library.
- Default template library.
- Save service.
- Row-version collision mechanism.
- Full-detail export builder.

Do not persist:

- Live renderer DOM.
- Mounted-only state.
- Viewport halo state.
- Low-detail state.
- Dirty state.
- Selection handles.
- Preview geometry.
- Spatial indexes.
- Route caches.
- Diagnostics.

---

# 14. Prohibited shortcuts

Do not:

- Claim parity because the controls are visible.
- Copy the complete Diagram 1 editor and then replace only the canvas tag.
- Call Diagram 1's complete renderer from Diagram 2.
- Use full live SVG regeneration for ordinary commands.
- Reroute every relationship after local edits.
- Store full-state snapshots for every small edit.
- Disable virtualization while editing without a measured and documented reason.
- Disable low-detail mode because inspector tabs were added.
- Introduce a separate Diagram 2 document or file format.
- Defer all editor work back to Diagram 1.
- Make Diagram 2 require Diagram 1 for creation or normal editing after parity is declared complete.
- Hide missing features behind a misleading "beta ready" claim.
- remove or rename Diagram 1 before separate approval.

---

# 15. Completion report requirements for this addendum

Every later phase completion report must include:

```text
Visual Diagram 1 controls reproduced:
Intentional visual differences:
Diagram 1 handlers studied:
Shared visual components reused:
Diagram 2-specific controllers added:
Full live renders introduced:
Unrelated relationships rerouted:
Performance before:
Performance after:
Diagram 1 file opened in Diagram 2:
Diagram 2 save reopened in Diagram 1:
Visual parity tests:
Known parity gaps:
```

If a full live render was introduced for a local command, explain why and obtain approval.

---

# 16. Addendum acceptance criteria

This addendum is successfully applied when:

- Phase 2 and later work targets a Diagram 1-familiar editor.
- Diagram 2 does not retain the current minimal developer-style toolbar as its final editor UI.
- The toolbar, Objects pane, inspector, dialogs, and editing affordances converge toward Diagram 1.
- Internal commands remain Diagram 2-specific and performance-safe.
- The completed editor can perform normal Diagram work without returning to Diagram 1.
- Diagram 1 files continue to open and edit in Diagram 2.
- Diagram 1 continues to reopen Diagram 2 saves.
- No major Diagram 2 performance architecture is bypassed.
- Visual parity and performance parity evidence are included in each phase report.

---

# Final instruction to Codex

> **Build Diagram 2 so it visually presents the familiar Diagram 1 editor, toolbar by toolbar, tab by tab, dialog by dialog, and feature by feature. Preserve user-facing behavior and persisted results. Do not copy Diagram 1's slow rendering lifecycle. Reimplement each feature through Diagram 2's command system, persistent keyed nodes, dirty-state batching, geometry previews, selective routing, spatial indexes, viewport virtualization, and low-detail rendering. The final product should feel like Diagram 1, perform like Diagram 2, open Diagram 1 documents directly, and save documents that Diagram 1 can reopen exactly.**
