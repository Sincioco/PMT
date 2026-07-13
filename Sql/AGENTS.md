# SQL Instructions

- Put every application database object under `[pmt]`.
- Stored procedures remain the application data-access contract; keep names, parameters, and behavior aligned with ADO.NET callers.
- Treat the result-set order of aggregate procedures, especially `[pmt].[GetAppState]`, as a versioned contract with `SqlPmtStore`.
- Keep schema, procedure, core seed, LMS seed, HLS seed, and rebuild-orchestrator changes synchronized.
- PMT Database Version 1.3, matching the current BDO production schema, is the deployed baseline as of July 13, 2026.
- All known installs are current; do not add pre-1.3 compatibility logic. Every future SQL, database-contract, or database-backed stability change must include an explicit forward migration under `Sql/Migrations/`; changing rebuild scripts alone is not enough.
- Keep scripts explicit, rerunnable where currently supported, and understandable without extra tooling.
- Deployment and database rebuilds must not require internet access.
- Do not add Entity Framework migrations or application SQL that bypasses the stored-procedure contract.

See `docs/architecture.md`, `docs/domain-rules.md`, and `docs/database-versioning.md`.
