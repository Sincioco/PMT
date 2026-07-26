# Codex Completion Report Template — Diagram 2 Editor Parity

> Package revision: `2026-07-26-integrated-visual-parity-dual-entry`. Visual parity and dual-entry-point requirements are integrated into this file.


## Executive summary

State exactly what became usable and whether the phase met its expected outcome.

Do not describe a control as implemented if only its markup exists.

## Expected outcome

Copy the expected outcome from the instruction file and mark each item:

```text
PASS
PARTIAL
FAIL
DEFERRED WITH SIN APPROVAL
```

<!-- INTEGRATED-ADDENDA-UPDATE-START -->

## Visual parity evidence

Report:

```text
Diagram 1 visual controls studied:
Toolbar groups reproduced:
Inspector tabs reproduced:
Objects pane parity:
Dialogs/context menus parity:
Canvas handles/overlays parity:
Intentional visual differences:
Sin approval for differences:
1920×1080 comparison:
1366×768 comparison:
```

Do not claim visual parity based only on matching labels.

## Dual-entry-point evidence

Report separately:

```text
Shared Diagram 2 editor core used by both hosts:
RTE annotation host adapter:
Diagram document host adapter:

Diagram 1 Annotate preserved:
Diagram 1 Edit Annotate preserved:
Diagram 2 Annotate 2.0 available:
Diagram 2 Edit Annotate 2.0 available:
Top-navigation Diagram 2 available:

RTE new annotation save-back:
RTE existing annotation edit:
RTE cancel leaves content unchanged:
RTE focus/selection restored:
RTE route unchanged:
No standalone Diagram record created by normal RTE annotation:

D1 annotation opened in D2:
D2 annotation reopened in D1:
D1 document opened in D2:
D2 document reopened in D1:

Ten-cycle RTE cleanup:
Ten-cycle top-navigation cleanup:
Alternating-host cleanup:
```

## Per-host performance evidence

Provide separate normal and throttled measurements for:

```text
Top-navigation document host
RTE annotation host
```

Include end-to-end host mount boundaries, not only detached renderer timings.
<!-- INTEGRATED-ADDENDA-UPDATE-END -->

## Files changed

List each file and its responsibility.

## Feature parity completed

List parity IDs from the authoritative matrix.

## Diagram 1 impact

State:

- Behavior changes
- Compatibility-only changes
- Shared helpers extracted
- Regression tests run

## Diagram 2 implementation

Describe:

- UI
- Controller/commands
- Renderer APIs
- Dirty categories
- Routing impact
- History
- Save/export
- Lifecycle

## Performance evidence

Provide before and after:

```text
Operation
Fixture
Median
p95
Full-render count
Objects patched
Relationships considered
Relationships rerouted
DOM descendants
Mounted/canonical counts
```

Explicitly state whether any routine operation called full `renderer.render()`.

## Compatibility evidence

Report:

```text
D1 open D1 save
D2 open D1 save
D1 open D2 save
D2 open D2 save
Clipboard both directions
Templates both directions
Import/export matrix
Unknown extensions
Renderer state absent from persistence
```

## Validation

List exact commands and results.

## Manual testing

Give numbered steps Sin can perform.

## Known limitations

Be specific. Do not hide feature gaps under "beta."

## Required refresh/build

State:

```text
Ctrl+F5 only
.NET rebuild
Database migration
```

## Commit

Use:

```text
Sin and Codex: <clear description>
```

Then stop and wait for manual approval.
