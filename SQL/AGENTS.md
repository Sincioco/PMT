# SQL Instructions

- Put every application database object under `[pmt]`.
- Stored procedures remain the application data-access contract; keep names, parameters, and behavior aligned with ADO.NET callers.
- Treat the result-set order of aggregate procedures, especially `[pmt].[GetAppState]`, as a versioned contract with `SqlPmtStore`.
- Keep schema, procedure, core seed, LMS seed, HLS seed, and rebuild-orchestrator changes synchronized.
- PMT Database Version 1.26 is the deployed BDO baseline as of July 24, 2026. The current source schema and rebuild scripts represent Version 1.27.
- Do not add new pre-1.26 compatibility logic. Every future SQL, database-contract, or database-backed stability change must include an explicit forward migration from Version 1.26 or the immediately preceding deployed version under `SQL/Migrations/`; changing rebuild scripts alone is not enough.
- The completed migrations and combined runners through Version 1.26 are historical artifacts under `Migrations/Migration History/`. The active forward migration is `Migrations/PMT_1.26_to_1.27.sql`.
- If one deployment requires more than one versioned migration, keep the individual scripts as the canonical history and also provide one ordered `PMT_<from>_to_<to>_All.sql` SQLCMD runner so the operator runs a single file.
- Store completed migration scripts and HTML runbooks in `SQL/Migrations/Migration History/`. Whenever a new deployed baseline is declared, move every artifact ending at or before that baseline there automatically; keep only the active forward migration chain and its combined runner in `SQL/Migrations/`.
- Keep scripts explicit, rerunnable where currently supported, and understandable without extra tooling.
- Deployment and database rebuilds must not require internet access.
- Do not add Entity Framework migrations or application SQL that bypasses the stored-procedure contract.

See `docs/architecture.md`, `docs/domain-rules.md`, and `docs/database-versioning.md`.
