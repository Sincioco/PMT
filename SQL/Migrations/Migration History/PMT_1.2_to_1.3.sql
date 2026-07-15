/*
    PMT_1.2_to_1.3.sql

    Purpose:
    Refreshes PMT stored procedures so Dev Tasks can save Root Cause Analysis
    rich text using the existing WorkTasks.RootCauseAnalysisHtml column and
    linked Dev Task/Bug Report RCA values stay in sync.

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

PRINT N'PMT database migration 1.2 to 1.3 completed.';
GO
