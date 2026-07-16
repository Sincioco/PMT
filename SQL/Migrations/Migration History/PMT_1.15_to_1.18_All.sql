/*
    PMT combined database migration: Version 1.15 -> 1.18

    Historical superseded runner retained for controlled reconstruction.
    Run it in SQLCMD mode from the Migration History directory.
*/

:on error exit

:r ".\PMT_1.15_to_1.16.sql"
:r ".\PMT_1.16_to_1.17.sql"
:r ".\PMT_1.17_to_1.18.sql"

PRINT N'PMT combined database migration 1.15 to 1.18 completed.';
GO
