# SQL Instructions

- Put every application database object under `[pmt]`.
- Stored procedures remain the application data-access contract; keep names, parameters, and behavior aligned with ADO.NET callers.
- Treat the result-set order of aggregate procedures, especially `[pmt].[GetAppState]`, as a versioned contract with `SqlPmtStore`.
- Keep schema, procedure, core seed, LMS seed, HLS seed, and rebuild-orchestrator changes synchronized.
- Keep scripts explicit, rerunnable where currently supported, and understandable without extra tooling.
- Deployment and database rebuilds must not require internet access.
- Do not add Entity Framework migrations or application SQL that bypasses the stored-procedure contract.

See `docs/architecture.md` and `docs/domain-rules.md`.
