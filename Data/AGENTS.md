# Data Folder Notes

This folder contains ADO.NET database access code.

- Keep database calls direct and easy to trace.
- Call stored procedures instead of building large SQL strings in C#.
- Avoid adding repository/service layers unless the code becomes harder to read without them.
- Add comments around result-set order or parameter rules when changing stored procedure calls.
