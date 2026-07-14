/*
    PMT Database Version 1.12 -> 1.13

    Adds administrator-only PMT Maintenance database contracts:
    - previews and permanently purges selected soft-deleted records;
    - recomputes and verifies the exact preview before any permanent deletion;
    - preserves owner-only private Logs when their archived Project is purged;
    - rechecks upload-file references across current and soft-deleted content.

    Run this file in SQLCMD mode. It stops on the first error.
    This migration creates stored procedures and records the resulting database
    version. It does not automatically modify or delete business data.
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

IF OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[DevLogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[IsAdmin]', N'FN') IS NULL
   OR NOT EXISTS
   (
       SELECT 1
       FROM sys.extended_properties
       WHERE [class] = 0
         AND [name] = N'PMT_DatabaseVersion'
         AND CONVERT(NVARCHAR(20), [value]) IN (N'1.12', N'1.13')
   )
BEGIN
    THROW 50254, 'PMT Database Version 1.12 is required before applying Version 1.13.', 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetMaintenanceRecycleBin]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50250, 'Only an administrator can use PMT Maintenance.', 1;
    END;

    SELECT
        [RecycleItem].[ItemType],
        [RecycleItem].[ItemId],
        [RecycleItem].[Label],
        [RecycleItem].[Details],
        [RecycleItem].[DeletedAt],
        [RecycleItem].[IsCascade]
    FROM
    (
        SELECT
            N'Project' AS [ItemType],
            [Project].[ProjectId] AS [ItemId],
            CONVERT(NVARCHAR(300), [Project].[Code] + N' - ' + [Project].[Title]) AS [Label],
            CONVERT(NVARCHAR(500), N'Archived Project') AS [Details],
            [Project].[UpdatedAt] AS [DeletedAt],
            CONVERT(BIT, 0) AS [IsCascade]
        FROM [pmt].[Projects] AS [Project]
        WHERE [Project].[IsArchived] = 1

        UNION ALL

        SELECT
            N'Sprint',
            [Sprint].[SprintId],
            CONVERT(NVARCHAR(300), [Sprint].[Code] + N' - ' + [Sprint].[Title]),
            CONVERT(NVARCHAR(500), N'Sprint in Project ' + [Project].[Code]),
            [Sprint].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Sprints] AS [Sprint]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Sprint].[ProjectId]
        WHERE [Sprint].[IsDeleted] = 1

        UNION ALL

        SELECT
            N'Task',
            [Task].[TaskId],
            CONVERT(NVARCHAR(300), [Task].[Code] + N' - ' + [Task].[Title]),
            CONVERT(NVARCHAR(500), [Task].[TaskType] + N' in Project ' + [Project].[Code]),
            [Task].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[WorkTasks] AS [Task]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Task].[ProjectId]
        WHERE [Task].[IsDeleted] = 1

        UNION ALL

        SELECT
            N'Blog',
            [Blog].[BlogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [Blog].[IsPrivate] = 1
                        THEN N'Private Documentation #' + CONVERT(NVARCHAR(20), [Blog].[BlogId])
                    ELSE [Blog].[Title]
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [Blog].[IsPrivate] = 1 THEN N'Private Documentation details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL THEN N'Documentation without a Project'
                    ELSE N'Documentation in Project ' + [Project].[Code]
                END
            ),
            [Blog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Blogs] AS [Blog]
        LEFT JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Blog].[ProjectId]
        WHERE [Blog].[IsDeleted] = 1

        UNION ALL

        SELECT
            N'DevLog',
            [DevLog].[DevLogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                    ELSE N'Scrum #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL
                        THEN N'Scrum entry without a Project'
                    ELSE N'Scrum entry in Project ' + [Project].[Code]
                END
            ),
            [DevLog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[DevLogs] AS [DevLog]
        LEFT JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [DevLog].[ProjectId]
        WHERE [DevLog].[IsDeleted] = 1
    ) AS [RecycleItem]
    ORDER BY [RecycleItem].[DeletedAt] DESC, [RecycleItem].[ItemType], [RecycleItem].[Label];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ProcessMaintenanceRecycleBin]
    @ItemsJson NVARCHAR(MAX),
    @CurrentUserId INT,
    @Purge BIT,
    @ExpectedItemsJson NVARCHAR(MAX) = N'[]'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50250, 'Only an administrator can use PMT Maintenance.', 1;
    END;

    SET @ItemsJson = LTRIM(RTRIM(ISNULL(@ItemsJson, N'')));
    SET @Purge = ISNULL(@Purge, 0);

    IF ISJSON(@ItemsJson) <> 1 OR LEFT(@ItemsJson, 1) <> N'['
    BEGIN
        THROW 50251, 'The recycle-bin selection is invalid.', 1;
    END;

    DECLARE @ParsedItems TABLE
    (
        [ItemType] NVARCHAR(20) NULL,
        [ItemId] INT NULL
    );

    INSERT INTO @ParsedItems ([ItemType], [ItemId])
    SELECT
        CASE LOWER(LTRIM(RTRIM([JsonItem].[ItemType])))
            WHEN N'project' THEN N'Project'
            WHEN N'sprint' THEN N'Sprint'
            WHEN N'task' THEN N'Task'
            WHEN N'blog' THEN N'Blog'
            WHEN N'devlog' THEN N'DevLog'
            ELSE NULL
        END,
        [JsonItem].[ItemId]
    FROM OPENJSON(@ItemsJson)
    WITH
    (
        [ItemType] NVARCHAR(20) N'$.itemType',
        [ItemId] INT N'$.itemId'
    ) AS [JsonItem];

    IF NOT EXISTS (SELECT 1 FROM @ParsedItems)
       OR EXISTS
       (
           SELECT 1
           FROM @ParsedItems
           WHERE [ItemType] IS NULL OR ISNULL([ItemId], 0) <= 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM @ParsedItems
           GROUP BY [ItemType], [ItemId]
           HAVING COUNT(*) > 1
       )
    BEGIN
        THROW 50251, 'The recycle-bin selection is invalid.', 1;
    END;

    DECLARE @RequestedItems TABLE
    (
        [ItemType] NVARCHAR(20) NOT NULL,
        [ItemId] INT NOT NULL,
        PRIMARY KEY ([ItemType], [ItemId])
    );

    INSERT INTO @RequestedItems ([ItemType], [ItemId])
    SELECT [ItemType], [ItemId]
    FROM @ParsedItems;

    DECLARE @Plan TABLE
    (
        [ItemType] NVARCHAR(20) NOT NULL,
        [ItemId] INT NOT NULL,
        [Label] NVARCHAR(300) NOT NULL,
        [Details] NVARCHAR(500) NOT NULL,
        [DeletedAt] DATETIME2(0) NOT NULL,
        [IsCascade] BIT NOT NULL,
        PRIMARY KEY ([ItemType], [ItemId])
    );

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @ExpectedCount INT;
        DECLARE @FoundCount INT;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Project';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Project'
           AND [Requested].[ItemId] = [Project].[ProjectId]
        WHERE [Project].[IsArchived] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Sprint';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[Sprints] AS [Sprint] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Sprint'
           AND [Requested].[ItemId] = [Sprint].[SprintId]
        WHERE [Sprint].[IsDeleted] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Task';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[WorkTasks] AS [Task] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Task'
           AND [Requested].[ItemId] = [Task].[TaskId]
        WHERE [Task].[IsDeleted] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'Blog';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[Blogs] AS [Blog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Blog'
           AND [Requested].[ItemId] = [Blog].[BlogId]
        WHERE [Blog].[IsDeleted] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        SELECT @ExpectedCount = COUNT(*)
        FROM @RequestedItems
        WHERE [ItemType] = N'DevLog';

        SELECT @FoundCount = COUNT(*)
        FROM [pmt].[DevLogs] AS [DevLog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'DevLog'
           AND [Requested].[ItemId] = [DevLog].[DevLogId]
        WHERE [DevLog].[IsDeleted] = 1;

        IF @FoundCount <> @ExpectedCount
        BEGIN
            THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
        END;

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Project',
            [Project].[ProjectId],
            CONVERT(NVARCHAR(300), [Project].[Code] + N' - ' + [Project].[Title]),
            CONVERT(NVARCHAR(500), N'Archived Project'),
            [Project].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Project'
           AND [Requested].[ItemId] = [Project].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Sprint',
            [Sprint].[SprintId],
            CONVERT(NVARCHAR(300), [Sprint].[Code] + N' - ' + [Sprint].[Title]),
            CONVERT(NVARCHAR(500), N'Sprint in Project ' + [Project].[Code]),
            [Sprint].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Sprints] AS [Sprint] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Sprint'
           AND [Requested].[ItemId] = [Sprint].[SprintId]
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Sprint].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Task',
            [Task].[TaskId],
            CONVERT(NVARCHAR(300), [Task].[Code] + N' - ' + [Task].[Title]),
            CONVERT(NVARCHAR(500), [Task].[TaskType] + N' in Project ' + [Project].[Code]),
            [Task].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[WorkTasks] AS [Task] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Task'
           AND [Requested].[ItemId] = [Task].[TaskId]
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Task].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Blog',
            [Blog].[BlogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [Blog].[IsPrivate] = 1
                        THEN N'Private Documentation #' + CONVERT(NVARCHAR(20), [Blog].[BlogId])
                    ELSE [Blog].[Title]
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [Blog].[IsPrivate] = 1 THEN N'Private Documentation details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL THEN N'Documentation without a Project'
                    ELSE N'Documentation in Project ' + [Project].[Code]
                END
            ),
            [Blog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[Blogs] AS [Blog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'Blog'
           AND [Requested].[ItemId] = [Blog].[BlogId]
        LEFT JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Blog].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'DevLog',
            [DevLog].[DevLogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                    ELSE N'Scrum #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [DevLog].[LogType] = N'Log'
                        THEN N'Private Log details are hidden.'
                    WHEN [Project].[ProjectId] IS NULL
                        THEN N'Scrum entry without a Project'
                    ELSE N'Scrum entry in Project ' + [Project].[Code]
                END
            ),
            [DevLog].[UpdatedAt],
            CONVERT(BIT, 0)
        FROM [pmt].[DevLogs] AS [DevLog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN @RequestedItems AS [Requested]
            ON [Requested].[ItemType] = N'DevLog'
           AND [Requested].[ItemId] = [DevLog].[DevLogId]
        LEFT JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [DevLog].[ProjectId];

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Sprint',
            [Sprint].[SprintId],
            CONVERT(NVARCHAR(300), [Sprint].[Code] + N' - ' + [Sprint].[Title]),
            CONVERT(NVARCHAR(500), N'Included with archived Project ' + [Project].[Code]),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[Sprints] AS [Sprint] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Sprint].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM @Plan AS [Existing]
            WHERE [Existing].[ItemType] = N'Sprint'
              AND [Existing].[ItemId] = [Sprint].[SprintId]
        );

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Task',
            [Task].[TaskId],
            CONVERT(NVARCHAR(300), [Task].[Code] + N' - ' + [Task].[Title]),
            CONVERT(NVARCHAR(500), N'Included with archived Project ' + [Project].[Code]),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[WorkTasks] AS [Task] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Task].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM @Plan AS [Existing]
            WHERE [Existing].[ItemType] = N'Task'
              AND [Existing].[ItemId] = [Task].[TaskId]
        );

        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'Blog',
            [Blog].[BlogId],
            CONVERT(
                NVARCHAR(300),
                CASE
                    WHEN [Blog].[IsPrivate] = 1
                        THEN N'Private Documentation #' + CONVERT(NVARCHAR(20), [Blog].[BlogId])
                    ELSE [Blog].[Title]
                END
            ),
            CONVERT(
                NVARCHAR(500),
                CASE
                    WHEN [Blog].[IsPrivate] = 1 THEN N'Private Documentation details are hidden.'
                    ELSE N'Included with archived Project ' + [Project].[Code]
                END
            ),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[Blogs] AS [Blog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [Blog].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM @Plan AS [Existing]
            WHERE [Existing].[ItemType] = N'Blog'
              AND [Existing].[ItemId] = [Blog].[BlogId]
        );

        -- Private Logs are owner-only and survive Project cleanup. Scrum entries
        -- remain Project data and are included in an archived Project purge.
        INSERT INTO @Plan ([ItemType], [ItemId], [Label], [Details], [DeletedAt], [IsCascade])
        SELECT
            N'DevLog',
            [DevLog].[DevLogId],
            CONVERT(NVARCHAR(300), N'Scrum #' + CONVERT(NVARCHAR(20), [DevLog].[DevLogId])),
            CONVERT(NVARCHAR(500), N'Included with archived Project ' + [Project].[Code]),
            [Project].[UpdatedAt],
            CONVERT(BIT, 1)
        FROM [pmt].[DevLogs] AS [DevLog] WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
            ON [Project].[ProjectId] = [DevLog].[ProjectId]
        INNER JOIN @Plan AS [ProjectPlan]
            ON [ProjectPlan].[ItemType] = N'Project'
           AND [ProjectPlan].[ItemId] = [Project].[ProjectId]
        WHERE [DevLog].[LogType] = N'Scrum'
          AND NOT EXISTS
          (
              SELECT 1
              FROM @Plan AS [Existing]
              WHERE [Existing].[ItemType] = N'DevLog'
                AND [Existing].[ItemId] = [DevLog].[DevLogId]
          );

        IF @Purge = 1
        BEGIN
            SET @ExpectedItemsJson = LTRIM(RTRIM(ISNULL(@ExpectedItemsJson, N'')));

            IF ISJSON(@ExpectedItemsJson) <> 1 OR LEFT(@ExpectedItemsJson, 1) <> N'['
            BEGIN
                THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
            END;

            DECLARE @ExpectedItems TABLE
            (
                [ItemType] NVARCHAR(20) NULL,
                [ItemId] INT NULL
            );

            INSERT INTO @ExpectedItems ([ItemType], [ItemId])
            SELECT
                CASE LOWER(LTRIM(RTRIM([JsonItem].[ItemType])))
                    WHEN N'project' THEN N'Project'
                    WHEN N'sprint' THEN N'Sprint'
                    WHEN N'task' THEN N'Task'
                    WHEN N'blog' THEN N'Blog'
                    WHEN N'devlog' THEN N'DevLog'
                    ELSE NULL
                END,
                [JsonItem].[ItemId]
            FROM OPENJSON(@ExpectedItemsJson)
            WITH
            (
                [ItemType] NVARCHAR(20) N'$.itemType',
                [ItemId] INT N'$.itemId'
            ) AS [JsonItem];

            IF EXISTS
               (
                   SELECT 1
                   FROM @ExpectedItems
                   WHERE [ItemType] IS NULL OR ISNULL([ItemId], 0) <= 0
               )
               OR EXISTS
               (
                   SELECT 1
                   FROM @ExpectedItems
                   GROUP BY [ItemType], [ItemId]
                   HAVING COUNT(*) > 1
               )
               OR EXISTS
               (
                   SELECT [ItemType], [ItemId]
                   FROM @Plan
                   EXCEPT
                   SELECT [ItemType], [ItemId]
                   FROM @ExpectedItems
               )
               OR EXISTS
               (
                   SELECT [ItemType], [ItemId]
                   FROM @ExpectedItems
                   EXCEPT
                   SELECT [ItemType], [ItemId]
                   FROM @Plan
               )
            BEGIN
                THROW 50252, 'The recycle bin changed. Refresh it before continuing.', 1;
            END;

            DECLARE @AttachmentIds TABLE ([AttachmentId] INT NOT NULL PRIMARY KEY);
            DECLARE @InvitationIds TABLE ([UserInvitationId] INT NOT NULL PRIMARY KEY);

            INSERT INTO @AttachmentIds ([AttachmentId])
            SELECT [TaskAttachment].[AttachmentId]
            FROM [pmt].[TaskAttachments] AS [TaskAttachment]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [TaskAttachment].[TaskId]
            UNION
            SELECT [BlogAttachment].[AttachmentId]
            FROM [pmt].[BlogAttachments] AS [BlogAttachment]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [BlogAttachment].[BlogId];

            INSERT INTO @InvitationIds ([UserInvitationId])
            SELECT DISTINCT [InvitationProject].[UserInvitationId]
            FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [InvitationProject].[ProjectId];

            DELETE [AuditEvent]
            FROM [pmt].[AuditEvents] AS [AuditEvent]
            INNER JOIN @Plan AS [PlannedItem]
                ON [PlannedItem].[ItemType] = [AuditEvent].[EntityType]
               AND [PlannedItem].[ItemId] = [AuditEvent].[EntityId];

            DELETE [TaskAttachment]
            FROM [pmt].[TaskAttachments] AS [TaskAttachment]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [TaskAttachment].[TaskId];

            DELETE [Dependency]
            FROM [pmt].[TaskDependencies] AS [Dependency]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [TaskPlan]
                WHERE [TaskPlan].[ItemType] = N'Task'
                  AND ([TaskPlan].[ItemId] = [Dependency].[TaskId]
                       OR [TaskPlan].[ItemId] = [Dependency].[DependsOnTaskId])
            );

            DELETE [Reporter]
            FROM [pmt].[TaskReporters] AS [Reporter]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [Reporter].[TaskId];

            DELETE [Assignee]
            FROM [pmt].[TaskAssignees] AS [Assignee]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [Assignee].[TaskId];

            DELETE [BlogAttachment]
            FROM [pmt].[BlogAttachments] AS [BlogAttachment]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [BlogAttachment].[BlogId];

            DELETE [History]
            FROM [pmt].[BlogHistory] AS [History]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [History].[BlogId];

            UPDATE [Task]
            SET [ParentTaskId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [TaskPlan]
                WHERE [TaskPlan].[ItemType] = N'Task'
                  AND [TaskPlan].[ItemId] = [Task].[ParentTaskId]
            );

            UPDATE [Task]
            SET [LinkedBugTaskId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [TaskPlan]
                WHERE [TaskPlan].[ItemType] = N'Task'
                  AND [TaskPlan].[ItemId] = [Task].[LinkedBugTaskId]
            );

            UPDATE [Task]
            SET [LinkedBlogId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [BlogPlan]
                WHERE [BlogPlan].[ItemType] = N'Blog'
                  AND [BlogPlan].[ItemId] = [Task].[LinkedBlogId]
            );

            UPDATE [Blog]
            SET [ParentBlogId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[Blogs] AS [Blog]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [BlogPlan]
                WHERE [BlogPlan].[ItemType] = N'Blog'
                  AND [BlogPlan].[ItemId] = [Blog].[ParentBlogId]
            );

            UPDATE [Task]
            SET [SprintId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[WorkTasks] AS [Task]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [SprintPlan]
                WHERE [SprintPlan].[ItemType] = N'Sprint'
                  AND [SprintPlan].[ItemId] = [Task].[SprintId]
            );

            UPDATE [Blog]
            SET [SprintId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[Blogs] AS [Blog]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [SprintPlan]
                WHERE [SprintPlan].[ItemType] = N'Sprint'
                  AND [SprintPlan].[ItemId] = [Blog].[SprintId]
            );

            -- Preserve private Logs and any future non-Scrum Log types by
            -- detaching every Project Log that is not in the exact purge plan.
            UPDATE [DevLog]
            SET [ProjectId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[DevLogs] AS [DevLog]
            WHERE EXISTS
            (
                SELECT 1
                FROM @Plan AS [ProjectPlan]
                WHERE [ProjectPlan].[ItemType] = N'Project'
                  AND [ProjectPlan].[ItemId] = [DevLog].[ProjectId]
            )
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM @Plan AS [DevLogPlan]
                  WHERE [DevLogPlan].[ItemType] = N'DevLog'
                    AND [DevLogPlan].[ItemId] = [DevLog].[DevLogId]
              );

            DELETE [DevLog]
            FROM [pmt].[DevLogs] AS [DevLog]
            INNER JOIN @Plan AS [DevLogPlan]
                ON [DevLogPlan].[ItemType] = N'DevLog'
               AND [DevLogPlan].[ItemId] = [DevLog].[DevLogId];

            DELETE [Blog]
            FROM [pmt].[Blogs] AS [Blog]
            INNER JOIN @Plan AS [BlogPlan]
                ON [BlogPlan].[ItemType] = N'Blog'
               AND [BlogPlan].[ItemId] = [Blog].[BlogId];

            DELETE [Task]
            FROM [pmt].[WorkTasks] AS [Task]
            INNER JOIN @Plan AS [TaskPlan]
                ON [TaskPlan].[ItemType] = N'Task'
               AND [TaskPlan].[ItemId] = [Task].[TaskId];

            DELETE [Member]
            FROM [pmt].[SprintMembers] AS [Member]
            INNER JOIN @Plan AS [SprintPlan]
                ON [SprintPlan].[ItemType] = N'Sprint'
               AND [SprintPlan].[ItemId] = [Member].[SprintId];

            DELETE [Sprint]
            FROM [pmt].[Sprints] AS [Sprint]
            INNER JOIN @Plan AS [SprintPlan]
                ON [SprintPlan].[ItemType] = N'Sprint'
               AND [SprintPlan].[ItemId] = [Sprint].[SprintId];

            DELETE [Member]
            FROM [pmt].[ProjectMembers] AS [Member]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [Member].[ProjectId];

            DELETE [InvitationProject]
            FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [InvitationProject].[ProjectId];

            DELETE [Project]
            FROM [pmt].[Projects] AS [Project]
            INNER JOIN @Plan AS [ProjectPlan]
                ON [ProjectPlan].[ItemType] = N'Project'
               AND [ProjectPlan].[ItemId] = [Project].[ProjectId];

            DELETE [Invitation]
            FROM [pmt].[UserInvitations] AS [Invitation]
            INNER JOIN @InvitationIds AS [Affected]
                ON [Affected].[UserInvitationId] = [Invitation].[UserInvitationId]
            WHERE NOT EXISTS
            (
                SELECT 1
                FROM [pmt].[UserInvitationProjects] AS [Remaining]
                WHERE [Remaining].[UserInvitationId] = [Invitation].[UserInvitationId]
            );

            DELETE [Attachment]
            FROM [pmt].[Attachments] AS [Attachment]
            INNER JOIN @AttachmentIds AS [Affected]
                ON [Affected].[AttachmentId] = [Attachment].[AttachmentId]
            WHERE NOT EXISTS
            (
                SELECT 1
                FROM [pmt].[TaskAttachments] AS [RemainingTaskAttachment]
                WHERE [RemainingTaskAttachment].[AttachmentId] = [Attachment].[AttachmentId]
            )
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM [pmt].[BlogAttachments] AS [RemainingBlogAttachment]
                  WHERE [RemainingBlogAttachment].[AttachmentId] = [Attachment].[AttachmentId]
              );

            DECLARE @MaintenanceDetails NVARCHAR(4000) =
                N'Permanently deleted ' + CONVERT(NVARCHAR(20), (SELECT COUNT(*) FROM @Plan))
                + N' recycle-bin item(s).';

            EXEC [pmt].[WriteAudit]
                N'Maintenance',
                0,
                N'Permanent Delete',
                @MaintenanceDetails,
                @CurrentUserId;
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

    SELECT
        [ItemType],
        [ItemId],
        [Label],
        [Details],
        [DeletedAt],
        [IsCascade]
    FROM @Plan
    ORDER BY [IsCascade], [DeletedAt] DESC, [ItemType], [Label];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[FindReferencedUploadPaths]
    @RelativePathsJson NVARCHAR(MAX),
    @RequestPath NVARCHAR(500),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50250, 'Only an administrator can use PMT Maintenance.', 1;
    END;

    SET @RelativePathsJson = LTRIM(RTRIM(ISNULL(@RelativePathsJson, N'')));
    SET @RequestPath = REPLACE(LTRIM(RTRIM(ISNULL(@RequestPath, N'/uploads'))), N'\', N'/');

    IF ISJSON(@RelativePathsJson) <> 1 OR LEFT(@RelativePathsJson, 1) <> N'['
    BEGIN
        THROW 50253, 'The upload-path selection is invalid.', 1;
    END;

    IF @RequestPath = N''
    BEGIN
        SET @RequestPath = N'/uploads';
    END;

    IF LEFT(@RequestPath, 1) <> N'/'
    BEGIN
        SET @RequestPath = N'/' + @RequestPath;
    END;

    WHILE LEN(@RequestPath) > 1 AND RIGHT(@RequestPath, 1) = N'/'
    BEGIN
        SET @RequestPath = LEFT(@RequestPath, LEN(@RequestPath) - 1);
    END;

    DECLARE @Paths TABLE
    (
        [RelativePath] NVARCHAR(1000) NOT NULL PRIMARY KEY,
        [Needle] NVARCHAR(1600) NOT NULL,
        [HtmlNeedle] NVARCHAR(3000) NOT NULL
    );

    ;WITH [ParsedPaths] AS
    (
        SELECT [RelativePath] = REPLACE(LTRIM(RTRIM(CONVERT(NVARCHAR(1000), [JsonPath].[value]))), N'\', N'/')
        FROM OPENJSON(@RelativePathsJson) AS [JsonPath]
        WHERE [JsonPath].[type] = 1
    ),
    [NormalizedPaths] AS
    (
        SELECT [RelativePath] = CASE
            WHEN LEFT([RelativePath], 2) = N'./' THEN SUBSTRING([RelativePath], 3, 1000)
            WHEN LEFT([RelativePath], 1) = N'/' THEN SUBSTRING([RelativePath], 2, 1000)
            ELSE [RelativePath]
        END
        FROM [ParsedPaths]
    )
    INSERT INTO @Paths ([RelativePath], [Needle], [HtmlNeedle])
    SELECT DISTINCT
        [RelativePath],
        @RequestPath + N'/' + [RelativePath],
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(@RequestPath + N'/' + [RelativePath], N'&', N'&amp;'),
                        N'<', N'&lt;'
                    ),
                    N'>', N'&gt;'
                ),
                N'"', N'&quot;'
            ),
            N'''', N'&#039;'
        )
    FROM [NormalizedPaths]
    WHERE [RelativePath] <> N'';

    SELECT [Path].[RelativePath]
    FROM @Paths AS [Path]
    WHERE EXISTS
    (
        SELECT 1
        FROM [pmt].[Attachments] AS [Attachment]
        WHERE CHARINDEX([Path].[Needle], ISNULL([Attachment].[Url], N'')) > 0
           OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Attachment].[Url], N'')) > 0
    )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Users] AS [User]
           CROSS APPLY
           (
               VALUES
                   ([User].[AvatarUrl]),
                   ([User].[HomePageUrl]),
                   ([User].[SocialMediaUrl]),
                   ([User].[Bio])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Projects] AS [Project]
           CROSS APPLY
           (
               VALUES
                   ([Project].[Description]),
                   ([Project].[Url]),
                   ([Project].[IconUrl])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Sprints] AS [Sprint]
           CROSS APPLY
           (
               VALUES
                   ([Sprint].[Description]),
                   ([Sprint].[LessonLearnedHtml])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[WorkTasks] AS [Task]
           CROSS APPLY
           (
               VALUES
                   ([Task].[DescriptionHtml]),
                   ([Task].[StepsToReproduceHtml]),
                   ([Task].[ActualResultHtml]),
                   ([Task].[ExpectedResultHtml]),
                   ([Task].[RootCauseAnalysisHtml]),
                   ([Task].[Url])
           ) AS [Source] ([Value])
           WHERE CHARINDEX([Path].[Needle], ISNULL([Source].[Value], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Source].[Value], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[DevLogs] AS [DevLog]
           WHERE CHARINDEX([Path].[Needle], ISNULL([DevLog].[BodyHtml], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([DevLog].[BodyHtml], N'')) > 0
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Blogs] AS [Blog]
           WHERE CHARINDEX([Path].[Needle], ISNULL([Blog].[BodyHtml], N'')) > 0
              OR CHARINDEX([Path].[HtmlNeedle], ISNULL([Blog].[BodyHtml], N'')) > 0
       )
    ORDER BY [Path].[RelativePath];
END;
GO

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
        @value = N'1.13';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.13';
END;
GO

PRINT N'PMT Database Version 1.13 applied: administrator Maintenance preview, permanent purge, and upload-reference checks are available.';
GO
