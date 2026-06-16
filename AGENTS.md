# PMT Agent Notes

PMT is a small internal Project Management Tool for software teams. Keep the code easy for a junior developer to follow.

## Project Rules

- Use ASP.NET Core with simple ADO.NET calls.
- Do not use Entity Framework.
- Keep database objects in the `pmt` schema.
- Prefer stored procedures for database writes and reads.
- Keep changes simple and readable. Avoid extra layers unless they clearly make the code easier to understand.
- Add short comments when they explain intent that is not obvious from the code.

## Target Platforms

- User browser: Chrome or Chromium.
- Server app: ASP.NET Core targeting .NET 6.
- Database: SQL Server.
- Hosting target: Windows/IIS for internal use.

## Current Development Assumption

This project is still in development. Test data, database state, and browser state can be deleted and recreated when needed.
