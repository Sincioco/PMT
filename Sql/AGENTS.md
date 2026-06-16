# SQL Folder Notes

This folder contains the database setup scripts.

- All database objects must be under the `pmt` schema.
- Keep setup to three scripts:
  1. `01_CreateDatabase.sql`
  2. `02_CreateStoredProcedures.sql`
  3. `03_SeedData.sql`
- Seed and test data belong in `03_SeedData.sql`.
- The app uses ADO.NET and stored procedures. Do not add Entity Framework migrations.
