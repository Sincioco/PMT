# PMT - Project Management Tool

PMT is an internal JIRA-style project management tool for software engineering teams.

## Stack

- Frontend: pure JavaScript, HTML, and CSS
- Server: ASP.NET Core targeting .NET 6
- Database: SQL Server 2019
- Data access: ADO.NET with stored procedures
- Database schema: every database object is under `[pmt]`

## Default Login

Seed users are:

- Sin
- Bill Gates
- Sam Altman
- Mark Zuckerberg
- Steve Jobs
- Lisa Su

Every seeded user starts with this password:

```text
Password1
```

Users can change their own password from the `Password` button after login.

## SQL Setup Order

Run these scripts in order:

1. `Sql\01_CreateDatabase.sql`
2. `Sql\02_CreateStoredProcedures.sql`
3. `Sql\03_SeedData.sql`

## Local Run

Update `appsettings.json` if your SQL Server is not `localhost`.

```powershell
dotnet restore
dotnet run
```

Open:

```text
http://localhost:5056
```

## Deployment

See `Deployment\IIS-Setup.md`.
