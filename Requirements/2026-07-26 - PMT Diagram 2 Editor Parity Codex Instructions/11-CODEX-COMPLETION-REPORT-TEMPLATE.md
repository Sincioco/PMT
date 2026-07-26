# Codex Completion Report Template — Diagram 2 Editor Parity

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
