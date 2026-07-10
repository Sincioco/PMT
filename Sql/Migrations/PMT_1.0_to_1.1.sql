/*
    PMT_1.0_to_1.1.sql

    Purpose:
    Updates PMT stored procedures for Database Version 1.1 and backfills parent
    task status when active sub-tasks already moved beyond Backlog/Todo.

    IMPORTANT:
    This script uses a SQLCMD :r include command. In SQL Server Management
    Studio, enable Query > SQLCMD Mode before running it.
*/

:r "D:\Project Management Tool (PMT)\Sql\02_CreateStoredProcedures.sql"
GO

USE [PMT];
GO

DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

UPDATE [ParentTask]
SET
    [Status] = N'In Progress',
    [PercentCompleted] = [ChildSummary].[PercentCompleted],
    [StartedAt] = CASE
        WHEN [ParentTask].[StartedAt] IS NULL THEN @Now
        ELSE [ParentTask].[StartedAt]
    END,
    [UpdatedAt] = @Now
FROM [pmt].[WorkTasks] AS [ParentTask]
CROSS APPLY
(
    SELECT CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [ChildTask].[PercentCompleted])), 0)) AS [PercentCompleted]
    FROM [pmt].[WorkTasks] AS [ChildTask]
    WHERE [ChildTask].[ParentTaskId] = [ParentTask].[TaskId]
      AND [ChildTask].[IsDeleted] = 0
) AS [ChildSummary]
WHERE [ParentTask].[IsDeleted] = 0
  AND [ParentTask].[Status] IN (N'Backlog', N'Todo')
  AND [ChildSummary].[PercentCompleted] IS NOT NULL
  AND EXISTS
  (
      SELECT 1
      FROM [pmt].[WorkTasks] AS [ActiveChildTask]
      WHERE [ActiveChildTask].[ParentTaskId] = [ParentTask].[TaskId]
        AND [ActiveChildTask].[IsDeleted] = 0
        AND [ActiveChildTask].[Status] NOT IN (N'Backlog', N'Todo')
  );
GO

PRINT N'PMT database migration 1.0 to 1.1 completed.';
GO
