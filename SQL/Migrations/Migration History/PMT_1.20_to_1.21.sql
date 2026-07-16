/*
    PMT Database Version 1.20 -> 1.21

    Installs three field-specific workflow rules:
    - Root Cause Analysis replaces one way from Dev Task to associated Bug.
    - Bug URL copies one way to the linked Bug Fix Dev Task.
    - Developer-role users may move Dev Tasks through QA Passed, but not later.

    Existing Root Cause Analysis and URL data is preserved. The respective
    one-way values are applied on subsequent saves; no historical row is
    rewritten by this migration.
*/

:on error exit

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID(N'pmt') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertTask]', N'P') IS NULL
BEGIN
    THROW 51051, 'PMT Database Version 1.20 objects are required before applying Version 1.21.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') NOT IN (N'1.20', N'1.21')
BEGIN
    THROW 51052, 'PMT Database Version 1.20 is required before applying Version 1.21.', 1;
END;

IF @DatabaseVersion = N'1.21'
   AND
   (
       ISNULL(CHARINDEX(N'WHERE [TaskId] = @RootCauseSyncTargetId', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
       OR ISNULL(CHARINDEX(N'@RootCauseSyncMergedHtml', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) > 0
       OR ISNULL(CHARINDEX(N'URL synchronization for this relationship runs from Bug to Dev Task only.', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
       OR ISNULL(CHARINDEX(N'Keep the linked Dev Task URL aligned when the Bug is saved again.', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
       OR ISNULL(CHARINDEX(N'Developers may hand work to QA and move it through QA Passed', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
   )
BEGIN
    THROW 51053, 'PMT Database Version 1.21 is recorded, but its linked-work-item workflow contract is incomplete. Investigate before continuing.', 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertTask]
    @TaskId INT OUTPUT,
    @ProjectId INT,
    @SprintId INT,
    @ParentTaskId INT,
    @TaskType NVARCHAR(20),
    @Title NVARCHAR(220),
    @DescriptionHtml NVARCHAR(MAX),
    @StepsToReproduceHtml NVARCHAR(MAX),
    @ActualResultHtml NVARCHAR(MAX),
    @ExpectedResultHtml NVARCHAR(MAX),
    @RootCauseAnalysisHtml NVARCHAR(MAX),
    @Environment NVARCHAR(40),
    @Severity NVARCHAR(40),
    @Status NVARCHAR(40),
    @Priority NVARCHAR(20),
    @PercentCompleted INT,
    @Url NVARCHAR(500),
    @StartDate DATETIME2(0),
    @EndDate DATETIME2(0),
    @ReporterIdsCsv NVARCHAR(MAX),
    @AssigneeIdsCsv NVARCHAR(MAX),
    @DependencyTaskIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT,
    @AllowBacklogAccess BIT = 0,
    @AuditContext NVARCHAR(80) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @IsImport BIT = CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(@AuditContext, N'')))) = N'import' THEN 1 ELSE 0 END;
    DECLARE @OwnerUserId INT;
    DECLARE @ProjectCode NVARCHAR(20);
    DECLARE @Code NVARCHAR(40);
    DECLARE @NextNumber INT;
    DECLARE @NextSortOrder INT;
    DECLARE @OldStatus NVARCHAR(40);
    DECLARE @OldSprintId INT;
    DECLARE @OldPercentCompleted INT;
    DECLARE @OldAssignees NVARCHAR(MAX);
    DECLARE @NewAssignees NVARCHAR(MAX);
    DECLARE @StartedAt DATETIME2(0);
    DECLARE @AuditDetails NVARCHAR(MAX);
    DECLARE @ExistingTaskType NVARCHAR(20);
    DECLARE @ExistingLinkedBugTaskId INT;
    DECLARE @CodeSuffix NVARCHAR(20);
    DECLARE @LinkedDevTaskId INT;
    DECLARE @BugProjectId INT;
    DECLARE @BugSprintId INT;
    DECLARE @LinkedBugToRetestId INT;
    DECLARE @LinkedOldStatus NVARCHAR(40);
    DECLARE @LinkedNewStatus NVARCHAR(40);
    DECLARE @LinkedOldPercentCompleted INT;
    DECLARE @LinkedNewPercentCompleted INT;
    DECLARE @ParentOldStatus NVARCHAR(40);
    DECLARE @ParentNewStatus NVARCHAR(40);
    DECLARE @ParentOldPercentCompleted INT;
    DECLARE @ParentNewPercentCompleted INT;
    DECLARE @CompletionBlockBugTaskId INT;
    DECLARE @AssociatedDevTaskId INT;
    DECLARE @AssociatedOldStatus NVARCHAR(40);
    DECLARE @AssociatedOldPercentCompleted INT;
    DECLARE @AssociatedNewPercentCompleted INT;
    DECLARE @RootCauseSyncTargetId INT;
    DECLARE @AssociatedDevTaskUpdates TABLE
    (
        [TaskId] INT NOT NULL PRIMARY KEY,
        [OldStatus] NVARCHAR(40) NOT NULL,
        [NewStatus] NVARCHAR(40) NOT NULL,
        [OldPercentCompleted] INT NOT NULL,
        [NewPercentCompleted] INT NOT NULL
    );

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');
    SET @TaskType = ISNULL(NULLIF(LTRIM(RTRIM(@TaskType)), N''), N'Dev');
    SET @Status = ISNULL(NULLIF(LTRIM(RTRIM(@Status)), N''), N'Todo');
    SET @Priority = ISNULL(NULLIF(LTRIM(RTRIM(@Priority)), N''), N'Low');
    SET @Environment = NULLIF(LTRIM(RTRIM(@Environment)), N'');
    SET @Severity = NULLIF(LTRIM(RTRIM(@Severity)), N'');
    SET @PercentCompleted = CASE
        WHEN @PercentCompleted < 0 THEN 0
        WHEN @PercentCompleted > 100 THEN 100
        ELSE @PercentCompleted
    END;
    SET @ReporterIdsCsv = ISNULL(@ReporterIdsCsv, N'');
    SET @AssigneeIdsCsv = ISNULL(@AssigneeIdsCsv, N'');
    SET @DependencyTaskIdsCsv = ISNULL(@DependencyTaskIdsCsv, N'');
    IF @EndDate IS NOT NULL AND @StartDate IS NOT NULL AND @EndDate < @StartDate
    BEGIN
        SET @EndDate = @StartDate;
    END;

    IF @Title IS NULL
    BEGIN
        THROW 50030, 'Task title is required.', 1;
    END;

    IF @TaskType NOT IN (N'Dev', N'Bug')
    BEGIN
        THROW 50030, 'Task type is invalid.', 1;
    END;

    IF @TaskId = 0
       AND @AllowBacklogAccess = 0
       AND [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
    BEGIN
        THROW 50030, 'Your role cannot edit this kind of task.', 1;
    END;

    IF @TaskId <> 0
    BEGIN
        SELECT
            @OwnerUserId = [CreatedByUserId],
            @ExistingTaskType = [TaskType],
            @OldStatus = [Status],
            @OldSprintId = [SprintId],
            @OldPercentCompleted = [PercentCompleted],
            @StartedAt = [StartedAt],
            @ExistingLinkedBugTaskId = [LinkedBugTaskId]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @TaskId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50038, 'Task was not found.', 1;
        END;

        IF @IsImport = 1
           AND [pmt].[IsAdmin](@CurrentUserId) = 0
           AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50053, 'Only an Admin can import updates for another user''s task.', 1;
        END;

        IF [pmt].[CanEditTaskType](@ExistingTaskType, @CurrentUserId) = 0
           AND NOT (@AllowBacklogAccess = 1 AND @OldStatus IN (N'Backlog', N'Todo'))
        BEGIN
            THROW 50039, 'You cannot edit this task.', 1;
        END;

        IF [pmt].[IsAdmin](@CurrentUserId) = 0
        BEGIN
            SET @TaskType = @ExistingTaskType;
        END;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Status' AND [Value] = @Status AND [IsActive] = 1)
    BEGIN
        THROW 50031, 'Task status is invalid.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Priority' AND [Value] = @Priority AND [IsActive] = 1)
    BEGIN
        THROW 50032, 'Task priority is invalid.', 1;
    END;

    -- Developers may hand work to QA and move it through QA Passed, but only
    -- release roles may move a Dev Task into a later deployment status.
    IF @TaskType = N'Dev'
       AND [pmt].[UserRole](@CurrentUserId) = N'Developer'
       AND EXISTS
       (
           SELECT 1
           FROM [pmt].[Lookups] AS [TargetStatus]
           INNER JOIN [pmt].[Lookups] AS [QaPassed]
               ON [QaPassed].[LookupType] = N'Status'
              AND [QaPassed].[Value] = N'QA Passed'
              AND [QaPassed].[IsActive] = 1
           WHERE [TargetStatus].[LookupType] = N'Status'
             AND [TargetStatus].[Value] = @Status
             AND [TargetStatus].[IsActive] = 1
             AND [TargetStatus].[DisplayOrder] > [QaPassed].[DisplayOrder]
       )
    BEGIN
        THROW 50069, 'Developers can move Dev Tasks through QA Passed, but not to deployment statuses.', 1;
    END;

    IF @TaskType = N'Bug'
    BEGIN
        SET @Environment = ISNULL(@Environment, N'SIT');
        SET @Severity = ISNULL(@Severity, N'Minor');

        IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Environment' AND [Value] = @Environment AND [IsActive] = 1)
        BEGIN
            THROW 50032, 'Bug environment is invalid.', 1;
        END;

        IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Severity' AND [Value] = @Severity AND [IsActive] = 1)
        BEGIN
            THROW 50032, 'Bug severity is invalid.', 1;
        END;

        IF NOT EXISTS (SELECT 1 FROM [pmt].[SplitIds](@ReporterIdsCsv))
        BEGIN
            SET @ReporterIdsCsv = CONVERT(NVARCHAR(20), @CurrentUserId);
        END;
    END
    ELSE
    BEGIN
        SET @StepsToReproduceHtml = NULL;
        SET @ActualResultHtml = NULL;
        SET @ExpectedResultHtml = NULL;
        SET @Environment = NULL;
        SET @Severity = NULL;
        SET @ReporterIdsCsv = N'';
    END;

    -- Keep the status and percent rules in one obvious place.
    -- A Backlog choice means "unscheduled Todo" in the database.
    IF @Status = N'Backlog'
    BEGIN
        SET @Status = N'Todo';
        SET @SprintId = NULL;
    END;

    -- Moving an existing task onto a sprint restarts it as planned work.
    IF @TaskType = N'Dev' AND @SprintId IS NOT NULL AND (@TaskId = 0 OR @OldSprintId IS NULL)
    BEGIN
        SET @Status = N'Todo';
    END;

    IF @Status = N'Todo'
    BEGIN
        SET @PercentCompleted = CASE
            WHEN ISNULL(@OldPercentCompleted, 0) > 0 THEN @OldPercentCompleted
            ELSE 0
        END;
    END;

    IF @TaskType = N'Dev'
    BEGIN
        SET @CompletionBlockBugTaskId = @ExistingLinkedBugTaskId;

        IF @CompletionBlockBugTaskId IS NULL
        BEGIN
            SELECT TOP (1) @CompletionBlockBugTaskId = [BugTask].[TaskId]
            FROM [pmt].[SplitIds](@DependencyTaskIdsCsv) AS [Ids]
            INNER JOIN [pmt].[WorkTasks] AS [BugTask]
                ON [BugTask].[TaskId] = [Ids].[Id]
               AND [BugTask].[TaskType] = N'Bug'
               AND [BugTask].[IsDeleted] = 0
            ORDER BY [BugTask].[TaskId];
        END;
    END;

    IF @TaskType = N'Bug' AND (@Status IN (N'QA Failed', N'QA Passed') OR @Status LIKE N'Deployed%')
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType <> N'Dev' AND (@Status = N'QA Passed' OR @Status LIKE N'Deployed%')
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType = N'Dev' AND @Status = N'Todo' AND @CompletionBlockBugTaskId IS NULL
    BEGIN
        SET @PercentCompleted = 0;
    END;

    IF @TaskType = N'Dev' AND @Status = N'Ready for QA'
    BEGIN
        SET @PercentCompleted = CASE WHEN @CompletionBlockBugTaskId IS NULL THEN 100 ELSE 50 END;
    END;

    IF @TaskType = N'Dev' AND @Status = N'QA Failed' AND @CompletionBlockBugTaskId IS NULL
    BEGIN
        SET @PercentCompleted = 50;
    END;

    IF @TaskType = N'Dev'
       AND (@Status = N'QA Passed' OR @Status LIKE N'Deployed%')
       AND @CompletionBlockBugTaskId IS NULL
    BEGIN
        SET @PercentCompleted = 100;
    END;

    IF @TaskType = N'Dev' AND @Status = N'Code Complete'
    BEGIN
        SET @PercentCompleted = CASE WHEN @CompletionBlockBugTaskId IS NULL THEN 100 ELSE 50 END;
    END;

    IF @TaskType = N'Dev' AND @PercentCompleted >= 100
    BEGIN
        IF @CompletionBlockBugTaskId IS NOT NULL
           AND NOT EXISTS
           (
               SELECT 1
               FROM [pmt].[WorkTasks]
               WHERE [TaskId] = @CompletionBlockBugTaskId
                 AND [Status] IN (N'QA Passed', N'Deployed in SIT', N'Deployed in UAT', N'Deployed in Prod')
                 AND [IsDeleted] = 0
           )
        BEGIN
            THROW 50052, 'You cannot mark this task as complete until the associated bug is marked as QA Passed.  Once QA has re-tested the bug and passed it, the completion of your Dev Task will be set to 100%%.', 1;
        END;
    END;

    SELECT @ProjectCode = [Code]
    FROM [pmt].[Projects]
    WHERE [ProjectId] = @ProjectId
      AND [IsArchived] = 0;

    IF @ProjectCode IS NULL
    BEGIN
        THROW 50033, 'Project was not found.', 1;
    END;

    IF @SprintId IS NOT NULL
    BEGIN
        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[Sprints]
            WHERE [SprintId] = @SprintId
              AND [ProjectId] = @ProjectId
              AND [IsDeleted] = 0
        )
        BEGIN
            THROW 50034, 'Sprint was not found for this project.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Sprints]
            WHERE [SprintId] = @SprintId
              AND [IsFinished] = 1
              AND [pmt].[IsAdmin](@CurrentUserId) = 0
        )
        BEGIN
            THROW 50035, 'Finished sprints are read-only for users.', 1;
        END;
    END;

    IF @ParentTaskId IS NOT NULL
    BEGIN
        IF @ParentTaskId = @TaskId
        BEGIN
            THROW 50036, 'A task cannot be its own parent.', 1;
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[WorkTasks]
            WHERE [TaskId] = @ParentTaskId
              AND [ProjectId] = @ProjectId
              AND [IsDeleted] = 0
        )
        BEGIN
            THROW 50037, 'Parent task was not found for this project.', 1;
        END;
    END;

    -- Assignees are optional for both Dev Tasks and Bug Reports. The filtered
    -- insert below keeps only active members of the selected Project or Sprint.

    IF @TaskId = 0
    BEGIN
        SELECT @NextNumber = COUNT(*) + 1
        FROM [pmt].[WorkTasks]
        WHERE [ProjectId] = @ProjectId
          AND [TaskType] = @TaskType;

        SET @CodeSuffix = CASE WHEN @TaskType = N'Bug' THEN N'-Bug' ELSE N'-Task' END;
        SET @Code = @ProjectCode + @CodeSuffix + CONVERT(NVARCHAR(12), @NextNumber);

        WHILE EXISTS (SELECT 1 FROM [pmt].[WorkTasks] WHERE [Code] = @Code)
        BEGIN
            SET @NextNumber = @NextNumber + 1;
            SET @Code = @ProjectCode + @CodeSuffix + CONVERT(NVARCHAR(12), @NextNumber);
        END;

        IF @Status NOT IN (N'Backlog', N'Todo')
        BEGIN
            SET @StartedAt = @Now;
        END;

        SELECT @NextSortOrder = ISNULL(MAX([SortOrder]), 0) + 10
        FROM [pmt].[WorkTasks]
        WHERE [ProjectId] = @ProjectId
          AND ISNULL([SprintId], 0) = ISNULL(@SprintId, 0)
          AND [Status] = @Status
          AND [IsDeleted] = 0;

        INSERT INTO [pmt].[WorkTasks]
        (
            [ProjectId],
            [SprintId],
            [ParentTaskId],
            [TaskType],
            [Code],
            [Title],
            [DescriptionHtml],
            [StepsToReproduceHtml],
            [ActualResultHtml],
            [ExpectedResultHtml],
            [RootCauseAnalysisHtml],
            [Environment],
            [Severity],
            [Status],
            [Priority],
            [SortOrder],
            [PercentCompleted],
            [Url],
            [StartDate],
            [EndDate],
            [StartedAt],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @SprintId,
            @ParentTaskId,
            @TaskType,
            @Code,
            @Title,
            @DescriptionHtml,
            @StepsToReproduceHtml,
            @ActualResultHtml,
            @ExpectedResultHtml,
            @RootCauseAnalysisHtml,
            @Environment,
            @Severity,
            @Status,
            @Priority,
            @NextSortOrder,
            @PercentCompleted,
            @Url,
            @StartDate,
            @EndDate,
            @StartedAt,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @TaskId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Created', @Title, @CurrentUserId, NULL, @Status, NULL, @PercentCompleted;
    END
    ELSE
    BEGIN
        -- Parent task percent is calculated from sub-tasks, not typed by hand.
        IF EXISTS
           (
               SELECT 1
               FROM [pmt].[WorkTasks]
               WHERE [ParentTaskId] = @TaskId
                 AND [IsDeleted] = 0
           )
        BEGIN
            SELECT @PercentCompleted = CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [PercentCompleted])), 0))
            FROM [pmt].[WorkTasks]
            WHERE [ParentTaskId] = @TaskId
              AND [IsDeleted] = 0;
        END;

        IF @StartedAt IS NULL AND @Status NOT IN (N'Backlog', N'Todo')
        BEGIN
            SET @StartedAt = @Now;
        END;

        SELECT @OldAssignees = STRING_AGG(CONVERT(NVARCHAR(20), [UserId]), N',')
        FROM [pmt].[TaskAssignees]
        WHERE [TaskId] = @TaskId;

        UPDATE [pmt].[WorkTasks]
        SET
            [ProjectId] = @ProjectId,
            [SprintId] = @SprintId,
            [ParentTaskId] = @ParentTaskId,
            [TaskType] = @TaskType,
            [Title] = @Title,
            [DescriptionHtml] = @DescriptionHtml,
            [StepsToReproduceHtml] = @StepsToReproduceHtml,
            [ActualResultHtml] = @ActualResultHtml,
            [ExpectedResultHtml] = @ExpectedResultHtml,
            [RootCauseAnalysisHtml] = @RootCauseAnalysisHtml,
            [Environment] = @Environment,
            [Severity] = @Severity,
            [Status] = @Status,
            [Priority] = @Priority,
            [PercentCompleted] = @PercentCompleted,
            [Url] = @Url,
            [StartDate] = @StartDate,
            [EndDate] = @EndDate,
            [StartedAt] = @StartedAt,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [TaskId] = @TaskId;

        IF ISNULL(@OldStatus, N'') <> ISNULL(@Status, N'')
           OR ISNULL(@OldPercentCompleted, -1) <> ISNULL(@PercentCompleted, -1)
        BEGIN
            SET @AuditDetails =
                N'Status: ' + ISNULL(@OldStatus, N'') + N' -> ' + ISNULL(@Status, N'') +
                N'; Percent: ' + CONVERT(NVARCHAR(12), ISNULL(@OldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), ISNULL(@PercentCompleted, 0)) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @TaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                @OldStatus,
                @Status,
                @OldPercentCompleted,
                @PercentCompleted;
        END;

        IF ISNULL(@OldSprintId, 0) <> ISNULL(@SprintId, 0)
        BEGIN
            EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Sprint Changed', N'Task moved between sprints.', @CurrentUserId;
        END;

        IF @IsImport = 1
        BEGIN
            EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Imported', N'Task updated by import process.', @CurrentUserId;
        END
        ELSE
        BEGIN
            EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Updated', @Title, @CurrentUserId;
        END;
    END;

    DELETE FROM [pmt].[TaskAssignees]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
    SELECT @TaskId, [Ids].[Id], @CurrentUserId
    FROM [pmt].[SplitIds](@AssigneeIdsCsv) AS [Ids]
    INNER JOIN [pmt].[Users]
        ON [pmt].[Users].[UserId] = [Ids].[Id]
       AND [pmt].[Users].[IsActive] = 1
    WHERE
    (
        @SprintId IS NULL
        AND EXISTS
        (
            SELECT 1
            FROM [pmt].[ProjectMembers]
            WHERE [ProjectId] = @ProjectId
              AND [UserId] = [Ids].[Id]
        )
    )
    OR
    (
        @SprintId IS NOT NULL
        AND EXISTS
        (
            SELECT 1
            FROM [pmt].[SprintMembers]
            WHERE [SprintId] = @SprintId
              AND [UserId] = [Ids].[Id]
        )
    );

    DELETE FROM [pmt].[TaskReporters]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
    SELECT @TaskId, [Ids].[Id], @CurrentUserId
    FROM [pmt].[SplitIds](@ReporterIdsCsv) AS [Ids]
    INNER JOIN [pmt].[Users]
        ON [pmt].[Users].[UserId] = [Ids].[Id]
       AND [pmt].[Users].[IsActive] = 1;

    DELETE FROM [pmt].[TaskDependencies]
    WHERE [TaskId] = @TaskId;

    INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
    SELECT @TaskId, [Ids].[Id], @CurrentUserId
    FROM [pmt].[SplitIds](@DependencyTaskIdsCsv) AS [Ids]
    INNER JOIN [pmt].[WorkTasks]
        ON [pmt].[WorkTasks].[TaskId] = [Ids].[Id]
       AND [pmt].[WorkTasks].[ProjectId] = @ProjectId
       AND [pmt].[WorkTasks].[IsDeleted] = 0
    WHERE [Ids].[Id] <> @TaskId;

    SELECT @NewAssignees = STRING_AGG(CONVERT(NVARCHAR(20), [UserId]), N',')
    FROM [pmt].[TaskAssignees]
    WHERE [TaskId] = @TaskId;

    IF ISNULL(@OldAssignees, N'') <> ISNULL(@NewAssignees, N'')
    BEGIN
        EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Assignees Changed', N'Task assignment list changed.', @CurrentUserId;
    END;

    IF @TaskType = N'Bug'
    BEGIN
        SELECT
            @BugProjectId = [ProjectId],
            @BugSprintId = [SprintId]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @TaskId
          AND [IsDeleted] = 0;

        SELECT TOP (1) @LinkedDevTaskId = [TaskId]
        FROM [pmt].[WorkTasks]
        WHERE [LinkedBugTaskId] = @TaskId
          AND [TaskType] = N'Dev'
          AND [IsDeleted] = 0
        ORDER BY [TaskId];
    END;

    IF @TaskType = N'Bug'
       AND EXISTS (SELECT 1 FROM [pmt].[TaskAssignees] WHERE [TaskId] = @TaskId)
    BEGIN
        IF @LinkedDevTaskId IS NULL
        BEGIN
            SELECT @NextNumber = COUNT(*) + 1
            FROM [pmt].[WorkTasks]
            WHERE [ProjectId] = @BugProjectId
              AND [TaskType] = N'Dev';

            SET @Code = @ProjectCode + N'-Task' + CONVERT(NVARCHAR(12), @NextNumber);

            WHILE EXISTS (SELECT 1 FROM [pmt].[WorkTasks] WHERE [Code] = @Code)
            BEGIN
                SET @NextNumber = @NextNumber + 1;
                SET @Code = @ProjectCode + N'-Task' + CONVERT(NVARCHAR(12), @NextNumber);
            END;

            -- URL synchronization for this relationship runs from Bug to Dev Task only.
            INSERT INTO [pmt].[WorkTasks]
            (
                [ProjectId],
                [SprintId],
                [TaskType],
                [Code],
                [Title],
                [DescriptionHtml],
                [Status],
                [Priority],
                [PercentCompleted],
                [Url],
                [StartDate],
                [EndDate],
                [LinkedBugTaskId],
                [CreatedByUserId],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES
            (
                @BugProjectId,
                @BugSprintId,
                N'Dev',
                @Code,
                N'Bug Fix: ' + @Title,
                ISNULL(@DescriptionHtml, N''),
                N'Todo',
                @Priority,
                0,
                @Url,
                @StartDate,
                @EndDate,
                @TaskId,
                @CurrentUserId,
                @Now,
                @Now
            );

            SET @LinkedDevTaskId = SCOPE_IDENTITY();
            EXEC [pmt].[WriteAudit] N'Task', @LinkedDevTaskId, N'Created', N'Created from assigned bug.', @CurrentUserId;
        END
        ELSE
        BEGIN
            -- Keep the linked Dev Task URL aligned when the Bug is saved again.
            UPDATE [pmt].[WorkTasks]
            SET [ProjectId] = @BugProjectId,
                [SprintId] = @BugSprintId,
                [Title] = N'Bug Fix: ' + @Title,
                [Priority] = @Priority,
                [Url] = @Url,
                [StartDate] = @StartDate,
                [EndDate] = @EndDate,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @LinkedDevTaskId;
        END;

        DELETE FROM [pmt].[TaskAssignees]
        WHERE [TaskId] = @LinkedDevTaskId;

        INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
        SELECT @LinkedDevTaskId, [UserId], @CurrentUserId
        FROM [pmt].[TaskAssignees]
        WHERE [TaskId] = @TaskId;

        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[TaskDependencies]
            WHERE [TaskId] = @LinkedDevTaskId
              AND [DependsOnTaskId] = @TaskId
        )
        BEGIN
            INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
            VALUES (@LinkedDevTaskId, @TaskId, @CurrentUserId);
        END;
    END;

    -- Root Cause Analysis has one source of truth: the developer updates the
    -- Dev Task, and that value replaces the associated Bug value. Bug saves
    -- never write Root Cause Analysis back to a Dev Task.
    IF @TaskType = N'Dev'
    BEGIN
        SELECT TOP (1) @RootCauseSyncTargetId = [BugTask].[TaskId]
        FROM [pmt].[WorkTasks] AS [BugTask]
        WHERE [BugTask].[TaskType] = N'Bug'
          AND [BugTask].[IsDeleted] = 0
          AND
          (
              [BugTask].[TaskId] = @ExistingLinkedBugTaskId
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = @TaskId
                    AND [Dependency].[DependsOnTaskId] = [BugTask].[TaskId]
              )
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = [BugTask].[TaskId]
                    AND [Dependency].[DependsOnTaskId] = @TaskId
              )
          )
        ORDER BY
            CASE WHEN [BugTask].[TaskId] = @ExistingLinkedBugTaskId THEN 0 ELSE 1 END,
            [BugTask].[TaskId];

        IF @RootCauseSyncTargetId IS NOT NULL
        BEGIN
            UPDATE [pmt].[WorkTasks]
            SET
                [RootCauseAnalysisHtml] = @RootCauseAnalysisHtml,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @RootCauseSyncTargetId
              AND ISNULL([RootCauseAnalysisHtml], N'') <> ISNULL(@RootCauseAnalysisHtml, N'');
        END;
    END;

    -- QA and deployment results on a Bug move associated Dev Tasks to the right progress point.
    IF @TaskType = N'Bug' AND (@Status IN (N'QA Passed', N'QA Failed') OR @Status LIKE N'Deployed%')
    BEGIN
        SET @LinkedNewPercentCompleted = CASE WHEN @Status = N'QA Failed' THEN 50 ELSE 100 END;

        INSERT INTO @AssociatedDevTaskUpdates
        (
            [TaskId],
            [OldStatus],
            [NewStatus],
            [OldPercentCompleted],
            [NewPercentCompleted]
        )
        SELECT DISTINCT
            [DevTask].[TaskId],
            [DevTask].[Status],
            CASE WHEN @Status = N'QA Passed' THEN N'QA Passed' ELSE [DevTask].[Status] END,
            [DevTask].[PercentCompleted],
            @LinkedNewPercentCompleted
        FROM [pmt].[WorkTasks] AS [DevTask]
        WHERE [DevTask].[TaskType] = N'Dev'
          AND [DevTask].[IsDeleted] = 0
          AND
          (
              [DevTask].[LinkedBugTaskId] = @TaskId
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = [DevTask].[TaskId]
                    AND [Dependency].[DependsOnTaskId] = @TaskId
              )
              OR EXISTS
              (
                  SELECT 1
                  FROM [pmt].[TaskDependencies] AS [Dependency]
                  WHERE [Dependency].[TaskId] = @TaskId
                    AND [Dependency].[DependsOnTaskId] = [DevTask].[TaskId]
              )
          )
          AND
          (
              ISNULL([DevTask].[PercentCompleted], -1) <> @LinkedNewPercentCompleted
              OR (@Status = N'QA Passed' AND [DevTask].[Status] <> N'QA Passed')
          );

        UPDATE [DevTask]
        SET
            [Status] = [Updates].[NewStatus],
            [PercentCompleted] = [Updates].[NewPercentCompleted],
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        FROM [pmt].[WorkTasks] AS [DevTask]
        INNER JOIN @AssociatedDevTaskUpdates AS [Updates]
            ON [Updates].[TaskId] = [DevTask].[TaskId];

        DECLARE AssociatedDevTaskAudit CURSOR LOCAL FAST_FORWARD FOR
            SELECT
                [TaskId],
                [OldStatus],
                [NewStatus],
                [OldPercentCompleted],
                [NewPercentCompleted]
            FROM @AssociatedDevTaskUpdates
            ORDER BY [TaskId];

        OPEN AssociatedDevTaskAudit;
        FETCH NEXT FROM AssociatedDevTaskAudit
            INTO @AssociatedDevTaskId, @AssociatedOldStatus, @LinkedNewStatus, @AssociatedOldPercentCompleted, @AssociatedNewPercentCompleted;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @AuditDetails =
                N'Associated Bug result set Dev Task status/percent: ' +
                ISNULL(@AssociatedOldStatus, N'') + N' -> ' + ISNULL(@LinkedNewStatus, N'') +
                N'; Percent: ' +
                CONVERT(NVARCHAR(12), ISNULL(@AssociatedOldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), @AssociatedNewPercentCompleted) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @AssociatedDevTaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                @AssociatedOldStatus,
                @LinkedNewStatus,
                @AssociatedOldPercentCompleted,
                @AssociatedNewPercentCompleted;

            FETCH NEXT FROM AssociatedDevTaskAudit
                INTO @AssociatedDevTaskId, @AssociatedOldStatus, @LinkedNewStatus, @AssociatedOldPercentCompleted, @AssociatedNewPercentCompleted;
        END;

        CLOSE AssociatedDevTaskAudit;
        DEALLOCATE AssociatedDevTaskAudit;
    END;

    -- A Bug Fix at Code Complete or Ready for QA sends the linked Bug back to QA at 50%.
    IF @TaskType = N'Dev' AND @Status IN (N'Code Complete', N'Ready for QA')
    BEGIN
        SET @LinkedBugToRetestId = @ExistingLinkedBugTaskId;

        IF @LinkedBugToRetestId IS NULL
        BEGIN
            SELECT TOP (1) @LinkedBugToRetestId = [BugTask].[TaskId]
            FROM [pmt].[SplitIds](@DependencyTaskIdsCsv) AS [Ids]
            INNER JOIN [pmt].[WorkTasks] AS [BugTask]
                ON [BugTask].[TaskId] = [Ids].[Id]
               AND [BugTask].[TaskType] = N'Bug'
               AND [BugTask].[IsDeleted] = 0
            ORDER BY [BugTask].[TaskId];
        END;

        IF @LinkedBugToRetestId IS NOT NULL
        BEGIN
            SET @LinkedNewStatus = N'Ready for QA';
            SET @LinkedNewPercentCompleted = 50;

            SELECT
                @LinkedOldStatus = [Status],
                @LinkedOldPercentCompleted = [PercentCompleted]
            FROM [pmt].[WorkTasks]
            WHERE [TaskId] = @LinkedBugToRetestId;

            IF ISNULL(@LinkedOldStatus, N'') <> @LinkedNewStatus
               OR ISNULL(@LinkedOldPercentCompleted, -1) <> @LinkedNewPercentCompleted
            BEGIN
                UPDATE [pmt].[WorkTasks]
                SET
                    [Status] = @LinkedNewStatus,
                    [PercentCompleted] = @LinkedNewPercentCompleted,
                    [UpdatedByUserId] = @CurrentUserId,
                    [UpdatedAt] = @Now
                WHERE [TaskId] = @LinkedBugToRetestId;

                SET @AuditDetails =
                    N'Linked Bug Fix ready for QA; Bug status/percent updated: ' +
                    ISNULL(@LinkedOldStatus, N'') + N' -> ' + @LinkedNewStatus +
                    N'; Percent: ' + CONVERT(NVARCHAR(12), ISNULL(@LinkedOldPercentCompleted, 0)) +
                    N'% -> ' + CONVERT(NVARCHAR(12), @LinkedNewPercentCompleted) + N'%';

                EXEC [pmt].[WriteAudit]
                    N'Task',
                    @LinkedBugToRetestId,
                    N'Status/Percent Changed',
                    @AuditDetails,
                    @CurrentUserId,
                    @LinkedOldStatus,
                    @LinkedNewStatus,
                    @LinkedOldPercentCompleted,
                    @LinkedNewPercentCompleted;
            END;
        END;
    END;

    -- When a sub-task changes, refresh the parent task's calculated percent and
    -- make sure active child work lifts a Todo parent into active work too.
    IF @ParentTaskId IS NOT NULL
    BEGIN
        SELECT
            @ParentOldStatus = [Status],
            @ParentOldPercentCompleted = [PercentCompleted]
        FROM [pmt].[WorkTasks]
        WHERE [TaskId] = @ParentTaskId;

        SET @ParentNewStatus = CASE
            WHEN @Status NOT IN (N'Backlog', N'Todo') AND @ParentOldStatus IN (N'Backlog', N'Todo') THEN N'In Progress'
            ELSE @ParentOldStatus
        END;

        SELECT @ParentNewPercentCompleted = CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [PercentCompleted])), 0))
        FROM [pmt].[WorkTasks]
        WHERE [ParentTaskId] = @ParentTaskId
          AND [IsDeleted] = 0;

        IF @ParentNewPercentCompleted IS NOT NULL
           AND
           (
               ISNULL(@ParentOldPercentCompleted, -1) <> @ParentNewPercentCompleted
               OR ISNULL(@ParentOldStatus, N'') <> ISNULL(@ParentNewStatus, N'')
           )
        BEGIN
            UPDATE [pmt].[WorkTasks]
            SET
                [Status] = @ParentNewStatus,
                [PercentCompleted] = @ParentNewPercentCompleted,
                [StartedAt] = CASE
                    WHEN [StartedAt] IS NULL AND @ParentNewStatus NOT IN (N'Backlog', N'Todo') THEN @Now
                    ELSE [StartedAt]
                END,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [TaskId] = @ParentTaskId;

            SET @AuditDetails =
                N'Parent status/percent recalculated from sub-tasks: ' +
                ISNULL(@ParentOldStatus, N'') + N' -> ' + ISNULL(@ParentNewStatus, N'') +
                N'; Percent: ' +
                CONVERT(NVARCHAR(12), ISNULL(@ParentOldPercentCompleted, 0)) +
                N'% -> ' + CONVERT(NVARCHAR(12), @ParentNewPercentCompleted) + N'%';

            EXEC [pmt].[WriteAudit]
                N'Task',
                @ParentTaskId,
                N'Status/Percent Changed',
                @AuditDetails,
                @CurrentUserId,
                @ParentOldStatus,
                @ParentNewStatus,
                @ParentOldPercentCompleted,
                @ParentNewPercentCompleted;
        END;
    END;
END;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF EXISTS
    (
        SELECT 1
        FROM sys.extended_properties
        WHERE [class] = 0
          AND [name] = N'PMT_DatabaseVersion'
    )
    BEGIN
        EXEC sys.sp_updateextendedproperty
            @name = N'PMT_DatabaseVersion',
            @value = N'1.21';
    END
    ELSE
    BEGIN
        EXEC sys.sp_addextendedproperty
            @name = N'PMT_DatabaseVersion',
            @value = N'1.21';
    END;

    IF ISNULL(CHARINDEX(N'WHERE [TaskId] = @RootCauseSyncTargetId', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
       OR ISNULL(CHARINDEX(N'@RootCauseSyncMergedHtml', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) > 0
       OR ISNULL(CHARINDEX(N'URL synchronization for this relationship runs from Bug to Dev Task only.', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
       OR ISNULL(CHARINDEX(N'Keep the linked Dev Task URL aligned when the Bug is saved again.', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
       OR ISNULL(CHARINDEX(N'Developers may hand work to QA and move it through QA Passed', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertTask]'))), 0) = 0
       OR NOT EXISTS
          (
              SELECT 1
              FROM sys.extended_properties
              WHERE [class] = 0
                AND [name] = N'PMT_DatabaseVersion'
                AND CONVERT(NVARCHAR(20), [value]) = N'1.21'
          )
    BEGIN
        THROW 51054, 'PMT Version 1.21 linked-work-item workflow contract could not be verified.', 1;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
GO

PRINT N'PMT Database Version 1.21 applied: linked RCA/URL directions and the Developer QA Passed ceiling are enforced.';
GO
