/*
    PMT_1.1_to_1.2.sql

    Purpose:
    Adds Root Cause Analysis rich text to Bug Reports and refreshes PMT stored
    procedures for Database Version 1.2.

    IMPORTANT:
    This script uses a SQLCMD :r include command. In SQL Server Management
    Studio, enable Query > SQLCMD Mode before running it.
*/

USE [PMT];
GO

IF COL_LENGTH(N'pmt.WorkTasks', N'RootCauseAnalysisHtml') IS NULL
BEGIN
    ALTER TABLE [pmt].[WorkTasks] ADD [RootCauseAnalysisHtml] NVARCHAR(MAX) NULL;
END;
GO

:r "D:\Project Management Tool (PMT)\SQL\02_CreateStoredProcedures.sql"
GO

PRINT N'PMT database migration 1.1 to 1.2 completed.';
GO
