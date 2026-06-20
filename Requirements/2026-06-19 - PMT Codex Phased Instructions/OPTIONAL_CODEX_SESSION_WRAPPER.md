# Optional Codex Session Wrapper

Use this text before attaching one numbered phase:

```text
Execute the attached PMT phase only.

Read the repository AGENTS.md files and the documents named by the phase.
Do not begin any later phase.
Do not perform unrelated cleanup.
Preserve current behavior unless the phase explicitly changes it.
Keep the repository buildable.
Run all required verification.
Stop after the requested final report.
```

## After Codex finishes

Review:

1. `git diff --stat`
2. `git diff`
3. the build/test output
4. the manual verification results
5. the suggested commit message

Commit the phase before starting another one.
