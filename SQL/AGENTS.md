# SQL Instructions

- Put every application database object under `[pmt]`.
- Stored procedures remain the application data-access contract; keep names, parameters, and behavior aligned with ADO.NET callers.
- Treat the result-set order of aggregate procedures, especially `[pmt].[GetAppState]`, as a versioned contract with `SqlPmtStore`.
- Keep schema, procedure, core seed, LMS seed, HLS seed, and rebuild-orchestrator changes synchronized.
- PMT Database Version 1.22 is the deployed baseline as of July 16, 2026 and remains the required starting point for the active Version 1.23 migration.
- All known installs are current; do not add new pre-1.22 compatibility logic. Every future SQL, database-contract, or database-backed stability change must include an explicit forward migration from the current deployed version under `SQL/Migrations/`; changing rebuild scripts alone is not enough.
- The current source and rebuild scripts are Version 1.23. `Migrations/PMT_1.22_to_1.23.sql` is the active one-time BDO upgrade that preserves the deployed Project as PMTQA and restores the resettable PMT demo.
- If one deployment requires more than one versioned migration, keep the individual scripts as the canonical history and also provide one ordered `PMT_<from>_to_<to>_All.sql` SQLCMD runner so the operator runs a single file.
- Store completed migration scripts and HTML runbooks in `SQL/Migrations/Migration History/`. Whenever a new deployed baseline is declared, move every artifact ending at or before that baseline there automatically; keep only the active forward migration chain and its combined runner in `SQL/Migrations/`.
- Keep scripts explicit, rerunnable where currently supported, and understandable without extra tooling.
- Deployment and database rebuilds must not require internet access.
- Do not add Entity Framework migrations or application SQL that bypasses the stored-procedure contract.

See `docs/architecture.md`, `docs/domain-rules.md`, and `docs/database-versioning.md`.
