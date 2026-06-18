# PMT Codex Phased Refactoring and UI Redesign Plan

## Recommended file format

Use these **Markdown (`.md`) files**, one at a time.

Markdown is preferable to PDF or plain text because:

- Codex can read Markdown directly without PDF text extraction.
- Headings, checklists, code blocks, paths, and commands remain structured.
- The files can live in the repository and be version controlled.
- You can revise individual phases as PMT evolves.
- Markdown normally creates less parsing overhead than a PDF.
- Plain `.txt` would work, but it loses useful structure and is harder to maintain.

Do not give Codex the entire ZIP or the combined plan as the implementation prompt. Give it only the next numbered phase.

## How to use the files

1. Make sure the previous phase is complete and the repository is in a clean, working state.
2. Open a fresh Codex task or session.
3. Attach or paste exactly one numbered phase file.
4. Tell Codex: `Execute this phase only. Stop after the final report.`
5. Review the diff and test results.
6. Commit the completed phase before starting the next one.
7. Start the next phase only when your quota permits.

## Why there are many small phases

PMT currently concentrates much of the browser application in a very large `wwwroot/app.js`, while most styling is in one large `wwwroot/styles.css`. The purpose of these phases is to create stable boundaries before asking Codex to redesign the application.

A single instruction such as “refactor the frontend and redesign all screens in light and dark themes” is too large and creates a high risk of:

- exhausting the daily quota;
- leaving the repository in a partially migrated state;
- mixing architecture changes with visual changes;
- breaking behavior that is difficult to identify;
- forcing Codex to repeatedly reload unrelated context.

These phases separate structural work, design-system work, screen redesign work, backend cleanup, and automated verification.

## Phase order

| Phase | Purpose |
|---|---|
| 01 | Audit the current repository and establish a reproducible baseline |
| 02 | Add repository instructions and architecture documentation |
| 03 | Add the frontend module scaffold and switch safely to ES modules |
| 04 | Extract API, state, preferences, authentication, and routing |
| 05 | Extract shared utilities and reusable UI components |
| 06 | Extract Projects, Sprints, and Settings |
| 07 | Extract Tasks, Bugs, and Backlog |
| 08 | Extract Dashboard, Scrum, and Documentation |
| 09 | Extract the Kanban Board and drag interactions |
| 10 | Extract Gantt and Road Map |
| 11 | Split CSS foundations and shared components |
| 12 | Split feature-specific CSS |
| 13 | Define the new light/dark design system |
| 14 | Redesign the application shell and shared components |
| 15 | Redesign Dashboard, Projects, Sprints, Scrum, and Documentation |
| 16 | Redesign Tasks, Bugs, Backlog, Board, Gantt, Road Map, and Settings |
| 17 | Split backend endpoints, data access, and model files |
| 18 | Add automated tests, remove verified dead code, and finalize documentation |

## Important

No plan can guarantee that a Codex quota will never run out. These instructions reduce that risk by making every task small, atomic, independently verifiable, and safe to commit. The advanced views—Board, Gantt, and Road Map—are deliberately isolated because they are likely to consume more context than ordinary CRUD screens.
