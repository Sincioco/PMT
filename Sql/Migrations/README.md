# PMT SQL Migrations

PMT Database Version 1.0 is the baseline for deployed user databases.

Future SQL changes that existing users need must add migration scripts here, named like:

```text
PMT_1.0_to_1.1.sql
PMT_1.1_to_1.2.sql
```

Rebuild scripts are for fresh databases. Migration scripts are for upgrading existing user databases without losing data.

See `docs/database-versioning.md`.
