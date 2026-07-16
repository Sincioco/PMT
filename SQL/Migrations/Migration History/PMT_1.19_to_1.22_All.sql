/*
    PMT recovery migration: Version 1.19 -> 1.22

    Historical incident-recovery runner retained for controlled reconstruction
    of a database left at Version 1.19 by the failed Version 1.20 attempt.
*/

:on error exit

:r ".\PMT_1.19_to_1.20.sql"
:r ".\PMT_1.20_to_1.21.sql"
:r ".\PMT_1.21_to_1.22.sql"

PRINT N'PMT recovery migration 1.19 to 1.22 completed.';
GO
