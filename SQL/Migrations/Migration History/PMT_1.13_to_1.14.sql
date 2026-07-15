/*
    PMT Database Version 1.13 -> 1.14

    Makes private Documentation and private Logs owner-only throughout the
    application SQL contract, including administrators, Maintenance, linked
    work-item metadata, attachments, history, audit rows, and development reset
    paths. Existing data is preserved.
*/

:on error exit

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF SCHEMA_ID(N'pmt') IS NULL
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[DevLogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[GetAppState]', N'P') IS NULL
BEGIN
    THROW 50256, 'PMT Database Version 1.13 objects are required before applying Version 1.14.', 1;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) IN (N'1.13', N'1.14')
)
BEGIN
    THROW 50256, 'PMT Database Version 1.13 is required before applying Version 1.14.', 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetAppState]
    @CurrentUserId INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    -- The API reads these result sets in this exact order.
    SELECT
        [UserId],
        [FirstName],
        [LastName],
        [Nickname],
        [Email],
        [Phone],
        [AvatarUrl],
        [HomePageUrl],
        [SocialMediaUrl],
        [Bio],
        [IsAdmin],
        [Role],
        [IsActive]
    FROM [pmt].[Users]
    WHERE [IsActive] = 1
    ORDER BY [Nickname], [FirstName];

    SELECT
        [ProjectId],
        [Code],
        [Title],
        [Description],
        [Url],
        [IconUrl],
        [StartDate],
        [EndDate],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Projects]
    WHERE [IsArchived] = 0
    ORDER BY [Code];

    SELECT
        [ProjectId],
        [UserId]
    FROM [pmt].[ProjectMembers]
    ORDER BY [ProjectId], [UserId];

    SELECT
        [SprintId],
        [ProjectId],
        [Code],
        [Title],
        [Description],
        [StartDate],
        [EndDate],
        [LessonLearnedHtml],
        [IsFinished],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Sprints]
    WHERE [IsDeleted] = 0
    ORDER BY [StartDate] DESC, [SprintId] DESC;

    SELECT
        [SprintId],
        [UserId]
    FROM [pmt].[SprintMembers]
    ORDER BY [SprintId], [UserId];

    SELECT
        [TaskId],
        [ProjectId],
        [SprintId],
        [ParentTaskId],
        [TaskType],
        [Code],
        [Title],
        CASE
            WHEN EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [LinkedBlog]
                WHERE [LinkedBlog].[BlogId] = [WorkTask].[LinkedBlogId]
                  AND [LinkedBlog].[IsPrivate] = 1
                  AND [LinkedBlog].[CreatedByUserId] <> @CurrentUserId
            ) THEN N''
            WHEN [WorkTask].[LinkedBlogId] IS NULL
             AND [WorkTask].[DescriptionHtml] LIKE N'%data-documentation-link=%'
             AND [WorkTask].[DescriptionHtml] LIKE N'%View generated Documentation:%'
                THEN N''
            ELSE [WorkTask].[DescriptionHtml]
        END AS [DescriptionHtml],
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
        [UpdatedByUserId],
        [LinkedBugTaskId],
        CASE
            WHEN [WorkTask].[LinkedBlogId] IS NULL THEN NULL
            WHEN EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [LinkedBlog]
                WHERE [LinkedBlog].[BlogId] = [WorkTask].[LinkedBlogId]
                  AND ([LinkedBlog].[IsPrivate] = 0 OR [LinkedBlog].[CreatedByUserId] = @CurrentUserId)
            ) THEN [WorkTask].[LinkedBlogId]
            ELSE NULL
        END AS [LinkedBlogId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[WorkTasks] AS [WorkTask]
    WHERE [IsDeleted] = 0
    ORDER BY [SortOrder], [TaskId];

    SELECT
        [TaskId],
        [UserId]
    FROM [pmt].[TaskAssignees]
    ORDER BY [TaskId], [UserId];

    SELECT
        [TaskId],
        [UserId]
    FROM [pmt].[TaskReporters]
    ORDER BY [TaskId], [UserId];

    SELECT
        [TaskId],
        [DependsOnTaskId]
    FROM [pmt].[TaskDependencies]
    ORDER BY [TaskId], [DependsOnTaskId];

    SELECT
        [AttachmentId],
        [FileName],
        [Url],
        [ContentType],
        [ByteLength],
        [UploadedByUserId],
        [CreatedAt]
    FROM [pmt].[Attachments] AS [Attachment]
    WHERE NOT EXISTS
          (
              SELECT 1
              FROM [pmt].[BlogAttachments] AS [BlogAttachment]
              WHERE [BlogAttachment].[AttachmentId] = [Attachment].[AttachmentId]
          )
       OR EXISTS
          (
              SELECT 1
              FROM [pmt].[TaskAttachments] AS [TaskAttachment]
              WHERE [TaskAttachment].[AttachmentId] = [Attachment].[AttachmentId]
          )
       OR EXISTS
          (
              SELECT 1
              FROM [pmt].[BlogAttachments] AS [BlogAttachment]
              INNER JOIN [pmt].[Blogs] AS [Blog]
                  ON [Blog].[BlogId] = [BlogAttachment].[BlogId]
              WHERE [BlogAttachment].[AttachmentId] = [Attachment].[AttachmentId]
                AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
          )
    ORDER BY [CreatedAt] DESC;

    SELECT
        [TaskId],
        [AttachmentId]
    FROM [pmt].[TaskAttachments]
    ORDER BY [TaskId], [AttachmentId];

    SELECT
        [DevLogId],
        [LogType],
        [Category],
        [ProjectId],
        [UserId],
        [LogDate],
        [BodyHtml],
        [IsPinned],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[DevLogs]
    WHERE [IsDeleted] = 0
      -- Personal Log is owner-only even for administrators. Do not add an admin bypass.
      AND ([LogType] <> N'Log' OR [UserId] = @CurrentUserId)
    ORDER BY
        [IsPinned] DESC,
        CASE WHEN [IsPinned] = 1 THEN [CreatedAt] END DESC,
        [LogDate] DESC,
        [UpdatedAt] DESC;

    SELECT
        [BlogId],
        [ProjectId],
        [SprintId],
        CASE
            WHEN [Blog].[ParentBlogId] IS NULL THEN NULL
            WHEN EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [ParentBlog]
                WHERE [ParentBlog].[BlogId] = [Blog].[ParentBlogId]
                  AND ([ParentBlog].[IsPrivate] = 0 OR [ParentBlog].[CreatedByUserId] = @CurrentUserId)
            ) THEN [Blog].[ParentBlogId]
            ELSE NULL
        END AS [ParentBlogId],
        [Title],
        [BodyHtml],
        [IsPrivate],
        [IsPinned],
        [CreatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Blogs] AS [Blog]
    WHERE [Blog].[IsDeleted] = 0
      -- Private Documentation is owner-only even for administrators.
      AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
    ORDER BY [UpdatedAt] DESC;

    SELECT
        [BlogAttachment].[BlogId],
        [BlogAttachment].[AttachmentId]
    FROM [pmt].[BlogAttachments] AS [BlogAttachment]
    WHERE EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs] AS [Blog]
        WHERE [Blog].[BlogId] = [BlogAttachment].[BlogId]
          AND [Blog].[IsDeleted] = 0
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
    )
    ORDER BY [BlogAttachment].[BlogId], [BlogAttachment].[AttachmentId];

    SELECT
        [BlogHistory].[BlogHistoryId],
        [BlogHistory].[BlogId],
        [BlogHistory].[Action],
        [BlogHistory].[UserId],
        [BlogHistory].[CreatedAt]
    FROM [pmt].[BlogHistory] AS [BlogHistory]
    WHERE EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs] AS [Blog]
        WHERE [Blog].[BlogId] = [BlogHistory].[BlogId]
          AND [Blog].[IsDeleted] = 0
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
    )
    ORDER BY [BlogHistory].[CreatedAt] DESC;

    SELECT TOP (2000)
        [AuditEventId],
        [EntityType],
        [EntityId],
        [Action],
        [Details],
        [OldStatus],
        [NewStatus],
        [OldPercentCompleted],
        [NewPercentCompleted],
        [UserId],
        [CreatedAt]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    WHERE
        (
            [AuditEvent].[EntityType] NOT IN (N'Blog', N'DevLog')
            AND NOT
            (
                [AuditEvent].[EntityType] = N'Task'
                AND [AuditEvent].[Action] = N'Converted to Document'
                AND [AuditEvent].[UserId] <> @CurrentUserId
            )
        )
       OR
        (
            [AuditEvent].[EntityType] = N'Blog'
            AND EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] AS [Blog]
                WHERE [Blog].[BlogId] = [AuditEvent].[EntityId]
                  AND [Blog].[IsDeleted] = 0
                  AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
            )
        )
       OR
        (
            [AuditEvent].[EntityType] = N'DevLog'
            AND EXISTS
            (
                SELECT 1
                FROM [pmt].[DevLogs] AS [DevLog]
                WHERE [DevLog].[DevLogId] = [AuditEvent].[EntityId]
                  AND [DevLog].[IsDeleted] = 0
                  AND ([DevLog].[LogType] <> N'Log' OR [DevLog].[UserId] = @CurrentUserId)
            )
        )
    ORDER BY [AuditEvent].[CreatedAt] DESC, [AuditEvent].[AuditEventId] DESC;

    SELECT
        [LookupId],
        [LookupType],
        [Value],
        [ColorHex],
        [DisplayOrder],
        [IsActive]
    FROM [pmt].[Lookups]
    ORDER BY [LookupType], [DisplayOrder], [Value];

    SELECT
        [HolidayId],
        [Name],
        [HolidayDate],
        [CountryCode],
        [IsActive],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Holidays]
    ORDER BY [HolidayDate] DESC, [Name];
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
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)

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
          AND ([DevLog].[LogType] <> N'Log' OR [DevLog].[UserId] = @CurrentUserId)
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
        WHERE [Blog].[IsDeleted] = 1
          AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId);

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
        WHERE [DevLog].[IsDeleted] = 1
          AND ([DevLog].[LogType] <> N'Log' OR [DevLog].[UserId] = @CurrentUserId);

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
            ON [Project].[ProjectId] = [Blog].[ProjectId]
        WHERE [Blog].[IsPrivate] = 0
           OR [Blog].[CreatedByUserId] = @CurrentUserId;

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
            ON [Project].[ProjectId] = [DevLog].[ProjectId]
        WHERE [DevLog].[LogType] <> N'Log'
           OR [DevLog].[UserId] = @CurrentUserId;

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
        WHERE [Blog].[IsPrivate] = 0
          AND NOT EXISTS
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

            -- Private Documentation and private Logs remain owner-only and
            -- survive Project cleanup unless their owner selected them directly.
            UPDATE [Blog]
            SET [ProjectId] = NULL,
                [SprintId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = SYSUTCDATETIME()
            FROM [pmt].[Blogs] AS [Blog]
            WHERE [Blog].[IsPrivate] = 1
              AND EXISTS
              (
                  SELECT 1
                  FROM @Plan AS [ProjectPlan]
                  WHERE [ProjectPlan].[ItemType] = N'Project'
                    AND [ProjectPlan].[ItemId] = [Blog].[ProjectId]
              )
              AND NOT EXISTS
              (
                  SELECT 1
                  FROM @Plan AS [BlogPlan]
                  WHERE [BlogPlan].[ItemType] = N'Blog'
                    AND [BlogPlan].[ItemId] = [Blog].[BlogId]
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
        [RelativePath] NVARCHAR(1000) NOT NULL,
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

CREATE OR ALTER PROCEDURE [pmt].[UpsertBlog]
    @BlogId INT OUTPUT,
    @Title NVARCHAR(220),
    @BodyHtml NVARCHAR(MAX),
    @ProjectId INT,
    @SprintId INT = NULL,
    @ParentBlogId INT = NULL,
    @IsPrivate BIT = 1,
    @IsPinned BIT = 0,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;
    DECLARE @ExistingIsPrivate BIT;
    DECLARE @OldProjectId INT;
    DECLARE @OldSprintId INT;
    DECLARE @ParentProjectId INT;
    DECLARE @ParentSprintId INT;
    DECLARE @ParentOwnerUserId INT;
    DECLARE @ParentIsPrivate BIT;
    DECLARE @CycleBlogId INT;
    DECLARE @Action NVARCHAR(80);

    BEGIN TRY
        BEGIN TRANSACTION;

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');

    IF @Title IS NULL
    BEGIN
        THROW 50070, 'Blog title is required.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(@BodyHtml)), N'') IS NULL
    BEGIN
        THROW 50071, 'Blog text is required.', 1;
    END;

    IF @ProjectId IS NULL
    BEGIN
        SET @SprintId = NULL;
    END;

    IF @SprintId IS NOT NULL
       AND NOT EXISTS
       (
            SELECT 1
            FROM [pmt].[Sprints]
            WHERE [SprintId] = @SprintId
              AND [ProjectId] = @ProjectId
              AND [IsDeleted] = 0
       )
    BEGIN
        THROW 50076, 'Selected Sprint does not belong to this Project.', 1;
    END;

    IF @ParentBlogId = @BlogId AND @BlogId <> 0
    BEGIN
        THROW 50077, 'A document cannot be its own parent.', 1;
    END;

    IF @ParentBlogId IS NOT NULL
    BEGIN
        SELECT
            @ParentProjectId = [ProjectId],
            @ParentSprintId = [SprintId],
            @ParentOwnerUserId = [CreatedByUserId],
            @ParentIsPrivate = [IsPrivate]
        FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
        WHERE [BlogId] = @ParentBlogId
          AND [IsDeleted] = 0;

        IF @ParentOwnerUserId IS NULL
           OR (@ParentIsPrivate = 1 AND @ParentOwnerUserId <> @CurrentUserId)
        BEGIN
            THROW 50078, 'Parent document was not found.', 1;
        END;

        IF ISNULL(@ParentProjectId, 0) <> ISNULL(@ProjectId, 0)
           OR ISNULL(@ParentSprintId, 0) <> ISNULL(@SprintId, 0)
        BEGIN
            THROW 50079, 'Parent document must be in the same Project and Sprint.', 1;
        END;

        SET @CycleBlogId = @ParentBlogId;
        WHILE @BlogId <> 0 AND @CycleBlogId IS NOT NULL
        BEGIN
            IF @CycleBlogId = @BlogId
            BEGIN
                THROW 50080, 'A document cannot use one of its children as its parent.', 1;
            END;

            SELECT @CycleBlogId =
            (
                SELECT [ParentBlogId]
                FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
                WHERE [BlogId] = @CycleBlogId
                  AND [IsDeleted] = 0
            );
        END;
    END;

    IF @BlogId = 0
    BEGIN
        INSERT INTO [pmt].[Blogs]
        (
            [ProjectId],
            [SprintId],
            [ParentBlogId],
            [Title],
            [BodyHtml],
            [IsPrivate],
            [IsPinned],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @SprintId,
            @ParentBlogId,
            @Title,
            @BodyHtml,
            @IsPrivate,
            @IsPinned,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @BlogId = SCOPE_IDENTITY();
        SET @Action = N'Created';
    END
    ELSE
    BEGIN
        SELECT
            @OwnerUserId = [CreatedByUserId],
            @ExistingIsPrivate = [IsPrivate],
            @OldProjectId = [ProjectId],
            @OldSprintId = [SprintId]
        FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
        WHERE [BlogId] = @BlogId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL
        BEGIN
            THROW 50072, 'Blog was not found.', 1;
        END;

        IF @ExistingIsPrivate = 1 AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50072, 'Blog was not found.', 1;
        END;

        IF @IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50073, 'You cannot make another user''s document private.', 1;
        END;

        IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
        BEGIN
            THROW 50073, 'You cannot edit this blog.', 1;
        END;

        UPDATE [pmt].[Blogs]
        SET
            [ProjectId] = @ProjectId,
            [SprintId] = @SprintId,
            [ParentBlogId] = @ParentBlogId,
            [Title] = @Title,
            [BodyHtml] = @BodyHtml,
            [IsPrivate] = @IsPrivate,
            [IsPinned] = @IsPinned,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [BlogId] = @BlogId;

        IF ISNULL(@OldProjectId, 0) <> ISNULL(@ProjectId, 0)
           OR ISNULL(@OldSprintId, 0) <> ISNULL(@SprintId, 0)
        BEGIN
            UPDATE [pmt].[Blogs]
            SET [ParentBlogId] = NULL,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [ParentBlogId] = @BlogId
              AND [IsDeleted] = 0;
        END;

        SET @Action = N'Updated';
    END;

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
    VALUES (@BlogId, @Action, @CurrentUserId, @CurrentUserId, @Now);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, @Action, @Title, @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ConvertTaskToBlog]
    @TaskId INT,
    @CurrentUserId INT,
    @BlogId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @ProjectId INT;
    DECLARE @SprintId INT;
    DECLARE @TaskType NVARCHAR(20);
    DECLARE @Code NVARCHAR(40);
    DECLARE @Title NVARCHAR(220);
    DECLARE @DescriptionHtml NVARCHAR(MAX);
    DECLARE @LinkedBlogId INT;
    DECLARE @SourceType NVARCHAR(40);
    DECLARE @SourceLabel NVARCHAR(400);
    DECLARE @EscapedTitle NVARCHAR(MAX);
    DECLARE @EscapedSourceLabel NVARCHAR(MAX);
    DECLARE @TaskIdText NVARCHAR(20) = CONVERT(NVARCHAR(20), @TaskId);
    DECLARE @BlogIdText NVARCHAR(20);
    DECLARE @DocumentBody NVARCHAR(MAX);
    DECLARE @TaskLinkHtml NVARCHAR(MAX);

    SELECT
        @ProjectId = [ProjectId],
        @SprintId = [SprintId],
        @TaskType = [TaskType],
        @Code = [Code],
        @Title = [Title],
        @DescriptionHtml = [DescriptionHtml],
        @LinkedBlogId = [LinkedBlogId]
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId
      AND [IsDeleted] = 0;

    IF @Title IS NULL
    BEGIN
        THROW 50083, 'Task was not found.', 1;
    END;

    IF [pmt].[CanEditTaskType](@TaskType, @CurrentUserId) = 0
    BEGIN
        THROW 50084, 'You cannot convert this task to documentation.', 1;
    END;

    IF NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@DescriptionHtml, N''), N'&nbsp;', N' '), N'<p><br></p>', N''), N'<br>', N''))), N'') IS NULL
    BEGIN
        THROW 50085, 'Task description is empty.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @ProjectId = [ProjectId],
            @SprintId = [SprintId],
            @TaskType = [TaskType],
            @Code = [Code],
            @Title = [Title],
            @DescriptionHtml = [DescriptionHtml],
            @LinkedBlogId = [LinkedBlogId]
        FROM [pmt].[WorkTasks] WITH (UPDLOCK, HOLDLOCK)
        WHERE [TaskId] = @TaskId
          AND [IsDeleted] = 0;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50083, 'Task was not found.', 1;
        END;

        IF @LinkedBlogId IS NOT NULL
           AND EXISTS (SELECT 1 FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK) WHERE [BlogId] = @LinkedBlogId AND [IsDeleted] = 0)
        BEGIN
            IF EXISTS
            (
                SELECT 1
                FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
                WHERE [BlogId] = @LinkedBlogId
                  AND [IsDeleted] = 0
                  AND [IsPrivate] = 1
                  AND [CreatedByUserId] <> @CurrentUserId
            )
            BEGIN
                THROW 50086, 'Linked documentation is not available.', 1;
            END;

            SET @BlogId = @LinkedBlogId;
            COMMIT TRANSACTION;
            RETURN;
        END;

        IF NULLIF(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(@DescriptionHtml, N''), N'&nbsp;', N' '), N'<p><br></p>', N''), N'<br>', N''))), N'') IS NULL
        BEGIN
            THROW 50085, 'Task description is empty.', 1;
        END;

        SET @SourceType = CASE WHEN @TaskType = N'Bug' THEN N'Bug Report' ELSE N'Dev Task' END;
        SET @SourceLabel = @SourceType + N' ' + ISNULL(@Code, N'') + N' - ' + @Title;
        SET @EscapedTitle = @Title;
        SET @EscapedSourceLabel = @SourceLabel;

        SET @EscapedTitle = REPLACE(@EscapedTitle, N'&', N'&amp;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'<', N'&lt;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'>', N'&gt;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'"', N'&quot;');
        SET @EscapedTitle = REPLACE(@EscapedTitle, N'''', N'&#39;');

        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'&', N'&amp;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'<', N'&lt;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'>', N'&gt;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'"', N'&quot;');
        SET @EscapedSourceLabel = REPLACE(@EscapedSourceLabel, N'''', N'&#39;');

        SET @DocumentBody =
            ISNULL(@DescriptionHtml, N'') +
            N'<hr>' +
            N'<p><em>This document originally came from <a href="#work-item-' + @TaskIdText +
            N'" data-work-item-link="' + @TaskIdText + N'">' + @EscapedSourceLabel +
            N'</a>.</em></p>';

        INSERT INTO [pmt].[Blogs]
        (
            [ProjectId],
            [SprintId],
            [Title],
            [BodyHtml],
            [IsPrivate],
            [CreatedByUserId],
            [UpdatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @ProjectId,
            @SprintId,
            @Title,
            @DocumentBody,
            1,
            @CurrentUserId,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @BlogId = SCOPE_IDENTITY();
        SET @BlogIdText = CONVERT(NVARCHAR(20), @BlogId);
        SET @TaskLinkHtml =
            N'<p><a href="#documentation-blog-' + @BlogIdText +
            N'" data-documentation-link="' + @BlogIdText +
            N'">View generated Documentation: ' + @EscapedTitle + N'</a></p>';

        INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
        VALUES (@BlogId, N'Created', @CurrentUserId, @CurrentUserId, @Now);

        UPDATE [pmt].[WorkTasks]
        SET [DescriptionHtml] = @TaskLinkHtml,
            [LinkedBlogId] = @BlogId,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [TaskId] = @TaskId;

        EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Created', @Title, @CurrentUserId;
        EXEC [pmt].[WriteAudit] N'Task', @TaskId, N'Converted to Document', @Title, @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteBlog]
    @BlogId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OwnerUserId INT;
    DECLARE @IsPrivate BIT;

    BEGIN TRY
        BEGIN TRANSACTION;

    SELECT
        @OwnerUserId = [CreatedByUserId],
        @IsPrivate = [IsPrivate]
    FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
       OR (@IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId)
    BEGIN
        THROW 50074, 'Blog was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50075, 'You cannot delete this blog.', 1;
    END;

    UPDATE [pmt].[Blogs]
    SET [IsDeleted] = 1,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [BlogId] = @BlogId;

    UPDATE [pmt].[Blogs]
    SET [ParentBlogId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [ParentBlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @IsPrivate = 1
    BEGIN
        DELETE [AuditEvent]
        FROM [pmt].[AuditEvents] AS [AuditEvent]
        INNER JOIN [pmt].[WorkTasks] AS [Task]
            ON [Task].[TaskId] = [AuditEvent].[EntityId]
           AND [Task].[LinkedBlogId] = @BlogId
        WHERE [AuditEvent].[EntityType] = N'Task'
          AND [AuditEvent].[Action] = N'Converted to Document';
    END;

    UPDATE [pmt].[WorkTasks]
    SET [DescriptionHtml] = CASE WHEN @IsPrivate = 1 THEN NULL ELSE [DescriptionHtml] END,
        [LinkedBlogId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [LinkedBlogId] = @BlogId
      AND [IsDeleted] = 0;

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
    VALUES (@BlogId, N'Deleted', @CurrentUserId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Deleted', N'Blog hidden from active views.', @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AddBlogAttachment]
    @AttachmentId INT OUTPUT,
    @BlogId INT,
    @FileName NVARCHAR(260),
    @Url NVARCHAR(500),
    @ContentType NVARCHAR(160),
    @ByteLength BIGINT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @OwnerUserId INT;
    DECLARE @IsPrivate BIT;

    BEGIN TRY
        BEGIN TRANSACTION;

    SELECT
        @OwnerUserId = [CreatedByUserId],
        @IsPrivate = [IsPrivate]
    FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
       OR (@IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId)
    BEGIN
        THROW 50082, 'Blog was not found.', 1;
    END;

    IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
    BEGIN
        THROW 50083, 'You cannot attach files to this blog.', 1;
    END;

    INSERT INTO [pmt].[Attachments]
    (
        [FileName],
        [Url],
        [ContentType],
        [ByteLength],
        [UploadedByUserId],
        [CreatedByUserId]
    )
    VALUES
    (
        @FileName,
        @Url,
        @ContentType,
        @ByteLength,
        @CurrentUserId,
        @CurrentUserId
    );

    SET @AttachmentId = SCOPE_IDENTITY();

    INSERT INTO [pmt].[BlogAttachments] ([BlogId], [AttachmentId], [CreatedByUserId])
    VALUES (@BlogId, @AttachmentId, @CurrentUserId);

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
    VALUES (@BlogId, N'Attachment Added', @CurrentUserId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Attachment Added', @FileName, @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteBlogAttachment]
    @BlogId INT,
    @AttachmentId INT,
    @CurrentUserId INT,
    @Url NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @FileName NVARCHAR(260);
    DECLARE @OwnerUserId INT;
    DECLARE @IsPrivate BIT;

    BEGIN TRY
        BEGIN TRANSACTION;

    SELECT
        @OwnerUserId = [CreatedByUserId],
        @IsPrivate = [IsPrivate]
    FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
    WHERE [BlogId] = @BlogId
      AND [IsDeleted] = 0;

    IF @OwnerUserId IS NULL
       OR (@IsPrivate = 1 AND @OwnerUserId <> @CurrentUserId)
    BEGIN
        THROW 50233, 'Blog was not found.', 1;
    END;

    IF [pmt].[HasPermission](@CurrentUserId, N'Documentation', N'Update') = 0
    BEGIN
        THROW 50234, 'You cannot delete attachments from this blog.', 1;
    END;

    SELECT
        @FileName = [Attachment].[FileName],
        @Url = [Attachment].[Url]
    FROM [pmt].[BlogAttachments] AS [BlogAttachment]
    INNER JOIN [pmt].[Attachments] AS [Attachment]
        ON [Attachment].[AttachmentId] = [BlogAttachment].[AttachmentId]
    WHERE [BlogAttachment].[BlogId] = @BlogId
      AND [BlogAttachment].[AttachmentId] = @AttachmentId;

    IF @FileName IS NULL
    BEGIN
        THROW 50235, 'Attachment was not found on this blog.', 1;
    END;

    DELETE FROM [pmt].[BlogAttachments]
    WHERE [BlogId] = @BlogId
      AND [AttachmentId] = @AttachmentId;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[TaskAttachments] WHERE [AttachmentId] = @AttachmentId)
       AND NOT EXISTS (SELECT 1 FROM [pmt].[BlogAttachments] WHERE [AttachmentId] = @AttachmentId)
    BEGIN
        DELETE FROM [pmt].[Attachments]
        WHERE [AttachmentId] = @AttachmentId;
    END;
    ELSE
    BEGIN
        SET @Url = NULL;
    END;

    INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId])
    VALUES (@BlogId, N'Attachment Deleted', @CurrentUserId, @CurrentUserId);

    EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Attachment Deleted', @FileName, @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DevelopmentClearProjectData]
    @CurrentUserId INT,
    @ClearPmtOnly BIT,
    @DeleteProjects BIT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50100, 'Only an administrator can run development cleanup.', 1;
    END;

    DECLARE @PmtProjectId INT =
    (
        SELECT [ProjectId]
        FROM [pmt].[Projects]
        WHERE [Code] = N'PMT'
          AND [IsArchived] = 0
    );

    IF @PmtProjectId IS NULL AND @ClearPmtOnly = 1
    BEGIN
        THROW 50101, 'The PMT project was not found.', 1;
    END;

    DECLARE @ProjectIds TABLE ([ProjectId] INT NOT NULL PRIMARY KEY);
    DECLARE @SprintIds TABLE ([SprintId] INT NOT NULL PRIMARY KEY);
    DECLARE @TaskIds TABLE ([TaskId] INT NOT NULL PRIMARY KEY);
    DECLARE @BlogIds TABLE ([BlogId] INT NOT NULL PRIMARY KEY);

    INSERT INTO @ProjectIds ([ProjectId])
    SELECT [ProjectId]
    FROM [pmt].[Projects]
    WHERE (@ClearPmtOnly = 1 AND [ProjectId] = @PmtProjectId)
       OR (@ClearPmtOnly = 0 AND (@PmtProjectId IS NULL OR [ProjectId] <> @PmtProjectId));

    INSERT INTO @SprintIds ([SprintId])
    SELECT [SprintId]
    FROM [pmt].[Sprints]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

    INSERT INTO @TaskIds ([TaskId])
    SELECT [TaskId]
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

    INSERT INTO @BlogIds ([BlogId])
    SELECT [BlogId]
    FROM [pmt].[Blogs]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [IsPrivate] = 0;

    BEGIN TRANSACTION;

    DELETE FROM [pmt].[AuditEvents]
    WHERE ([EntityType] = N'Task' AND [EntityId] IN (SELECT [TaskId] FROM @TaskIds))
       OR ([EntityType] = N'Sprint' AND [EntityId] IN (SELECT [SprintId] FROM @SprintIds))
       OR ([EntityType] = N'Blog' AND [EntityId] IN (SELECT [BlogId] FROM @BlogIds))
       OR (@DeleteProjects = 1 AND [EntityType] = N'Project' AND [EntityId] IN (SELECT [ProjectId] FROM @ProjectIds));

    DELETE FROM [pmt].[TaskAttachments]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[TaskDependencies]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds)
       OR [DependsOnTaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[TaskReporters]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[TaskAssignees]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[BlogAttachments]
    WHERE [BlogId] IN (SELECT [BlogId] FROM @BlogIds);

    DELETE FROM [pmt].[BlogHistory]
    WHERE [BlogId] IN (SELECT [BlogId] FROM @BlogIds);

    UPDATE [pmt].[DevLogs]
    SET [ProjectId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [LogType] = N'Log';

    DELETE FROM [pmt].[DevLogs]
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [LogType] <> N'Log';

    UPDATE [pmt].[Blogs]
    SET [ProjectId] = NULL,
        [SprintId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds)
      AND [IsPrivate] = 1;

    UPDATE [pmt].[Blogs]
    SET [ParentBlogId] = NULL
    WHERE [ParentBlogId] IN (SELECT [BlogId] FROM @BlogIds);

    UPDATE [pmt].[WorkTasks]
    SET [LinkedBlogId] = NULL,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [LinkedBlogId] IN (SELECT [BlogId] FROM @BlogIds);

    DELETE FROM [pmt].[Blogs]
    WHERE [BlogId] IN (SELECT [BlogId] FROM @BlogIds);

    UPDATE [pmt].[WorkTasks]
    SET [ParentTaskId] = NULL,
        [LinkedBugTaskId] = CASE WHEN [LinkedBugTaskId] IN (SELECT [TaskId] FROM @TaskIds) THEN NULL ELSE [LinkedBugTaskId] END,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds)
       OR [ParentTaskId] IN (SELECT [TaskId] FROM @TaskIds)
       OR [LinkedBugTaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[WorkTasks]
    WHERE [TaskId] IN (SELECT [TaskId] FROM @TaskIds);

    DELETE FROM [pmt].[SprintMembers]
    WHERE [SprintId] IN (SELECT [SprintId] FROM @SprintIds);

    DELETE FROM [pmt].[Sprints]
    WHERE [SprintId] IN (SELECT [SprintId] FROM @SprintIds);

    IF @DeleteProjects = 1
    BEGIN
        DELETE FROM [pmt].[ProjectMembers]
        WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);

        DELETE FROM [pmt].[Projects]
        WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);
    END;
    ELSE
    BEGIN
        UPDATE [pmt].[Projects]
        SET [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE [ProjectId] IN (SELECT [ProjectId] FROM @ProjectIds);
    END;

    DELETE [Attachment]
    FROM [pmt].[Attachments] AS [Attachment]
    WHERE NOT EXISTS (SELECT 1 FROM [pmt].[TaskAttachments] WHERE [TaskAttachments].[AttachmentId] = [Attachment].[AttachmentId])
      AND NOT EXISTS (SELECT 1 FROM [pmt].[BlogAttachments] WHERE [BlogAttachments].[AttachmentId] = [Attachment].[AttachmentId]);

    DECLARE @AuditDetails NVARCHAR(MAX) =
        CASE WHEN @ClearPmtOnly = 1 THEN N'Cleared PMT project data.' ELSE N'Cleared non-PMT project data.' END;

    EXEC [pmt].[WriteAudit]
        N'Development',
        0,
        N'Cleanup',
        @AuditDetails,
        @CurrentUserId;

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DevelopmentClearUsers]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50110, 'Only an administrator can clear users.', 1;
    END;

    DECLARE @AdminUserId INT =
    (
        SELECT TOP (1) [UserId]
        FROM [pmt].[Users]
        WHERE [Email] = N'louiery@gmail.com'
           OR ([Nickname] = N'Sin' AND [IsAdmin] = 1)
        ORDER BY CASE WHEN [Email] = N'louiery@gmail.com' THEN 0 ELSE 1 END, [UserId]
    );

    IF @AdminUserId IS NULL
    BEGIN
        THROW 50111, 'The Sin administrator account was not found.', 1;
    END;

    BEGIN TRANSACTION;

    IF EXISTS
       (
           SELECT 1
           FROM [pmt].[DevLogs] WITH (UPDLOCK, HOLDLOCK)
           WHERE [LogType] = N'Log'
             AND [UserId] <> @AdminUserId
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
           WHERE [IsPrivate] = 1
             AND [CreatedByUserId] <> @AdminUserId
       )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50255, 'Users cannot be cleared while another user owns private content.', 1;
    END;

    UPDATE [pmt].[Users]
    SET
        [FirstName] = N'Louiery',
        [LastName] = N'Sincioco',
        [Nickname] = N'Sin',
        [Email] = N'louiery@gmail.com',
        [AvatarUrl] = N'/assets/avatar-sin.jpg?v=20260629-avatar-jpg-assets',
        [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1')),
        [Bio] = N'PMT creator and administrator.',
        [IsAdmin] = 1,
        [Role] = N'Admin',
        [IsActive] = 1,
        [CreatedByUserId] = @AdminUserId,
        [UpdatedByUserId] = @AdminUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @AdminUserId;

    INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [ProjectId], @AdminUserId, @AdminUserId
    FROM [pmt].[ProjectMembers] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[ProjectMembers] AS [Existing]
        WHERE [Existing].[ProjectId] = [Source].[ProjectId]
          AND [Existing].[UserId] = @AdminUserId
    );

    INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [SprintId], @AdminUserId, @AdminUserId
    FROM [pmt].[SprintMembers] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[SprintMembers] AS [Existing]
        WHERE [Existing].[SprintId] = [Source].[SprintId]
          AND [Existing].[UserId] = @AdminUserId
    );

    INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [TaskId], @AdminUserId, @AdminUserId
    FROM [pmt].[TaskAssignees] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[TaskAssignees] AS [Existing]
        WHERE [Existing].[TaskId] = [Source].[TaskId]
          AND [Existing].[UserId] = @AdminUserId
    );

    INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
    SELECT DISTINCT [TaskId], @AdminUserId, @AdminUserId
    FROM [pmt].[TaskReporters] AS [Source]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[TaskReporters] AS [Existing]
        WHERE [Existing].[TaskId] = [Source].[TaskId]
          AND [Existing].[UserId] = @AdminUserId
    );

    DELETE FROM [pmt].[ProjectMembers] WHERE [UserId] <> @AdminUserId;
    DELETE FROM [pmt].[SprintMembers] WHERE [UserId] <> @AdminUserId;
    DELETE FROM [pmt].[TaskAssignees] WHERE [UserId] <> @AdminUserId;
    DELETE FROM [pmt].[TaskReporters] WHERE [UserId] <> @AdminUserId;

    UPDATE [pmt].[ProjectMembers] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[SprintMembers] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskAssignees] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskReporters] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskDependencies] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[TaskAttachments] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[BlogAttachments] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;

    UPDATE [pmt].[Projects] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Sprints] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[WorkTasks] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Attachments] SET [UploadedByUserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[DevLogs] SET [UserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Blogs] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[BlogHistory] SET [UserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[AuditEvents] SET [UserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Lookups] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Holidays] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[WfhSchedules] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Users] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;

    DELETE FROM [pmt].[WfhSchedules]
    WHERE [UserId] <> @AdminUserId;

    DELETE FROM [pmt].[Users]
    WHERE [UserId] <> @AdminUserId;

    EXEC [pmt].[WriteAudit]
        N'Development',
        0,
        N'Cleanup',
        N'Cleared users and remapped ownership to Sin.',
        @AdminUserId;

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RequireDevelopmentSeedRestore]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50110, 'Only an administrator can restore initial seed data.', 1;
    END;

    IF EXISTS
       (
           SELECT 1
           FROM [pmt].[DevLogs]
           WHERE [LogType] = N'Log'
             AND [UserId] <> @CurrentUserId
       )
       OR EXISTS
       (
           SELECT 1
           FROM [pmt].[Blogs]
           WHERE [IsPrivate] = 1
             AND [CreatedByUserId] <> @CurrentUserId
       )
    BEGIN
        THROW 50257, 'Initial seed data cannot be restored while another user owns private content.', 1;
    END;
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
        @value = N'1.14';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.14';
END;
GO

PRINT N'PMT Database Version 1.14 applied: private Documentation and private Logs are owner-only throughout the application SQL contract.';
GO
