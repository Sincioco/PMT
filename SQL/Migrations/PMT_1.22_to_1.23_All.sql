/*
    PMT combined database migration: Version 1.22 -> 1.23

    Operator-facing SQLCMD runner. Keep the version-step migration canonical;
    this wrapper matches the one-file deployment path used on the server.
*/

:on error exit

:r ".\PMT_1.22_to_1.23.sql"

PRINT N'PMT combined database migration 1.22 to 1.23 completed.';
GO
