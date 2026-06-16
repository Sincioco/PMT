/*
    00_DropAndRebuild_PMT.sql

    Purpose:
    Drops the existing PMT database, recreates it, creates stored procedures,
    and loads seed/demo data using the three companion scripts.

    IMPORTANT:
    This script uses SQLCMD :r include commands.

    How to run:
    1. Put this file in the same folder as:
       - 01_CreateDatabase.sql
       - 02_CreateStoredProcedures.sql
       - 03_SeedData.sql
       - 03_SeedData_LMS.sql
       - 03_SeedData_HLS.sql
    2. In SQL Server Management Studio, enable Query > SQLCMD Mode.
    3. Run this script while connected to the SQL Server instance.

    WARNING:
    This permanently drops and recreates the PMT database.
*/

USE [master];
GO

IF DB_ID(N'PMT') IS NOT NULL
BEGIN
    ALTER DATABASE [PMT] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [PMT];
END;
GO

PRINT N'PMT database dropped if it existed.';
GO

:r "D:\Project Management Tool (PMT)\Sql\01_CreateDatabase.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\02_CreateStoredProcedures.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\03_SeedData.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\03_SeedData_LMS.sql"
GO

:r "D:\Project Management Tool (PMT)\Sql\03_SeedData_HLS.sql"
GO

PRINT N'PMT database rebuild completed successfully.';
GO
