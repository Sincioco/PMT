/*
    PMT recovery migration: Version 1.19 -> 1.22

    Use this one-command SQLCMD runner only when a failed Version 1.20 attempt
    left PMT_DatabaseVersion at 1.19. A database restored to Version 1.15 must
    use PMT_1.15_to_1.22_All.sql instead.
*/

:on error exit

:r ".\PMT_1.19_to_1.20.sql"
:r ".\PMT_1.20_to_1.21.sql"
:r ".\PMT_1.21_to_1.22.sql"

PRINT N'PMT recovery migration 1.19 to 1.22 completed.';
GO
