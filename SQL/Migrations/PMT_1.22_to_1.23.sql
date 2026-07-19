/*
    PMT Database Version 1.22 -> 1.23

    One-time BDO Production migration:
    - Preserves the deployed PMT Project as PMTQA.
    - Recreates only missing original PMT demo identities.
    - Restores the original SQL-seeded PMT demo Project.
    - Preserves PMTQA during this migration, while post-deployment broad
      Development cleanup protects only the resettable PMT demo Project.
    - Makes future Clear PMT Demo -> Restore PMT Seed Data cycles repeatable.
    - Lets Development Clear Users and Factory Reset run even when users own
      private content; Clear Users remaps it to Sin and Factory Reset deletes it.
    - Lets On Behalf Of attendance use a selected date and supports audited
      removal of explicit attendance calendar entries.
    - Adds current-month vacation examples for shared PMT, LMS, and HLS demo
      members without replacing or overlapping an existing active plan.
    - Adds shared default and per-user image-annotation template libraries
      stored as versioned JSON without creating upload-folder assets.
    - Adds persistent Diagram hierarchy ordering through Blogs.SortOrder and
      an owner-scoped MoveBlog stored procedure.
    - Seeds the public, editable PMT database-schema Diagram without replacing
      an existing Diagram with the same owner and title.

    This canonical step is included by PMT_1.22_to_1.23_All.sql, the tested
    operator-facing SQLCMD entry point.
    Do not run SQL/03_SeedData.sql or Factory Reset PMT in Production.
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
   OR OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Sprints]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[AttendanceEntries]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[VacationPlans]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[UserPermissions]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[AuditEvents]', N'U') IS NULL
   OR COL_LENGTH(N'pmt.AuditEvents', N'ActorUserId') IS NULL
   OR OBJECT_ID(N'[pmt].[SynchronizeProjectCode]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[WriteAudit]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[RecordAttendance]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearNonPmt]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearPmt]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearUsers]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[RequireDevelopmentSeedRestore]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LockBlogWrites]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LockWorkTaskWrites]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LockSprintWrites]', N'P') IS NULL
BEGIN
    THROW 51060, 'PMT Database Version 1.22 objects are required before applying Version 1.23.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') <> N'1.22'
BEGIN
    THROW 51061, 'PMT Database Version 1.22 is required before applying Version 1.23.', 1;
END;
GO

IF (SELECT COUNT(*) FROM [pmt].[Projects] WHERE [Code] = N'PMT' AND [IsArchived] = 0) <> 1
BEGIN
    THROW 51062, 'Exactly one active PMT Project is required for the one-time PMTQA migration.', 1;
END;

IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = N'PMTQA')
BEGIN
    THROW 51063, 'Project code PMTQA is already in use. The one-time migration stopped without changing data.', 1;
END;

IF
(
    SELECT COUNT(*)
    FROM [pmt].[Users]
    WHERE [Email] = N'louiery@gmail.com'
      AND [IsAdmin] = 1
      AND [IsActive] = 1
) <> 1
BEGIN
    THROW 51064, 'Exactly one active Sin administrator is required for the PMT demo migration.', 1;
END;
GO

CREATE TABLE #Pmt122To123State
(
    [PmtProjectId] INT NOT NULL,
    [SinUserId] INT NOT NULL,
    [ProjectCount] INT NOT NULL,
    [SprintCount] INT NOT NULL,
    [TaskCount] INT NOT NULL,
    [UserCount] INT NOT NULL,
    [PmtMemberCount] INT NOT NULL,
    [PmtSprintCount] INT NOT NULL,
    [PmtTaskCount] INT NOT NULL
);

DECLARE @PmtProjectId INT =
(
    SELECT [ProjectId]
    FROM [pmt].[Projects]
    WHERE [Code] = N'PMT'
      AND [IsArchived] = 0
);
DECLARE @SinUserId INT =
(
    SELECT [UserId]
    FROM [pmt].[Users]
    WHERE [Email] = N'louiery@gmail.com'
      AND [IsAdmin] = 1
      AND [IsActive] = 1
);

INSERT INTO #Pmt122To123State
(
    [PmtProjectId], [SinUserId], [ProjectCount], [SprintCount], [TaskCount],
    [UserCount], [PmtMemberCount], [PmtSprintCount], [PmtTaskCount]
)
SELECT
    @PmtProjectId,
    @SinUserId,
    (SELECT COUNT(*) FROM [pmt].[Projects]),
    (SELECT COUNT(*) FROM [pmt].[Sprints]),
    (SELECT COUNT(*) FROM [pmt].[WorkTasks]),
    (SELECT COUNT(*) FROM [pmt].[Users]),
    (SELECT COUNT(*) FROM [pmt].[ProjectMembers] WHERE [ProjectId] = @PmtProjectId),
    (SELECT COUNT(*) FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProjectId),
    (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProjectId);

CREATE TABLE #MissingPmtDemoUsers
(
    [Email] NVARCHAR(180) NOT NULL PRIMARY KEY
);

INSERT INTO #MissingPmtDemoUsers ([Email])
VALUES
(N'bill.gates@microsoft.com'),
(N'sam.altman@openai.com'),
(N'mark.zuckerberg@meta.com'),
(N'steve.jobs@apple.com'),
(N'Jensen.Huang@nvidia.com');

DELETE [Missing]
FROM #MissingPmtDemoUsers AS [Missing]
WHERE EXISTS
(
    SELECT 1
    FROM [pmt].[Users] AS [Existing]
    WHERE LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Missing].[Email])
);
GO

CREATE TABLE #Pmt122To123DemoVacations
(
    [ProjectCode] NVARCHAR(20) NOT NULL,
    [Email] NVARCHAR(180) NOT NULL PRIMARY KEY,
    [StartDate] DATE NOT NULL,
    [EndDate] DATE NOT NULL
);

DECLARE @DemoVacationMonthStart DATE = DATEFROMPARTS
(
    YEAR(CONVERT(DATE, SYSDATETIME())),
    MONTH(CONVERT(DATE, SYSDATETIME())),
    1
);

INSERT INTO #Pmt122To123DemoVacations ([ProjectCode], [Email], [StartDate], [EndDate])
VALUES
(N'PMT', N'bill.gates@microsoft.com', DATEADD(DAY, 3, @DemoVacationMonthStart), DATEADD(DAY, 5, @DemoVacationMonthStart)),
(N'LMS', N'sam.altman@openai.com', DATEADD(DAY, 11, @DemoVacationMonthStart), DATEADD(DAY, 13, @DemoVacationMonthStart)),
(N'HLS', N'Jensen.Huang@nvidia.com', DATEADD(DAY, 19, @DemoVacationMonthStart), DATEADD(DAY, 22, @DemoVacationMonthStart));
GO

IF COL_LENGTH(N'pmt.Blogs', N'SortOrder') IS NULL
BEGIN
    ALTER TABLE [pmt].[Blogs]
    ADD [SortOrder] INT NOT NULL CONSTRAINT [DF_pmt_Blogs_SortOrder] DEFAULT (0) WITH VALUES;
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
        [SortOrder],
        [CreatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    FROM [pmt].[Blogs] AS [Blog]
    WHERE [Blog].[IsDeleted] = 0
      -- Private Documentation is owner-only even for administrators.
      AND ([Blog].[IsPrivate] = 0 OR [Blog].[CreatedByUserId] = @CurrentUserId)
    ORDER BY [SortOrder], [UpdatedAt] DESC;

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
            [SortOrder],
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
            0,
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

CREATE OR ALTER PROCEDURE [pmt].[MoveBlog]
    @BlogId INT,
    @ParentBlogId INT = NULL,
    @OrderedBlogIds NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @ProjectId INT;
    DECLARE @SprintId INT;
    DECLARE @OwnerUserId INT;
    DECLARE @CycleBlogId INT;
    DECLARE @Title NVARCHAR(220);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @ProjectId = [ProjectId],
            @SprintId = [SprintId],
            @OwnerUserId = [CreatedByUserId],
            @Title = [Title]
        FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
        WHERE [BlogId] = @BlogId
          AND [IsDeleted] = 0;

        IF @OwnerUserId IS NULL OR @OwnerUserId <> @CurrentUserId
        BEGIN
            THROW 50072, 'Blog was not found.', 1;
        END;

        IF @ParentBlogId = @BlogId
        BEGIN
            THROW 50077, 'A document cannot be its own parent.', 1;
        END;

        IF @ParentBlogId IS NOT NULL
           AND NOT EXISTS
           (
                SELECT 1
                FROM [pmt].[Blogs]
                WHERE [BlogId] = @ParentBlogId
                  AND [CreatedByUserId] = @CurrentUserId
                  AND [IsDeleted] = 0
                  AND ISNULL([ProjectId], 0) = ISNULL(@ProjectId, 0)
                  AND ISNULL([SprintId], 0) = ISNULL(@SprintId, 0)
           )
        BEGIN
            THROW 50079, 'Parent document must be one of your diagrams in the same Project and Sprint.', 1;
        END;

        SET @CycleBlogId = @ParentBlogId;
        WHILE @CycleBlogId IS NOT NULL
        BEGIN
            IF @CycleBlogId = @BlogId
            BEGIN
                THROW 50080, 'A document cannot use one of its children as its parent.', 1;
            END;

            SELECT @CycleBlogId =
            (
                SELECT [ParentBlogId]
                FROM [pmt].[Blogs]
                WHERE [BlogId] = @CycleBlogId
                  AND [IsDeleted] = 0
            );
        END;

        DECLARE @BlogIds TABLE
        (
            [BlogId] INT NOT NULL PRIMARY KEY,
            [NewSortOrder] INT NOT NULL
        );
        DECLARE @Remaining NVARCHAR(MAX) = ISNULL(@OrderedBlogIds, N'') + N',';
        DECLARE @CommaIndex INT;
        DECLARE @BlogIdText NVARCHAR(20);
        DECLARE @BlogIdFromCsv INT;
        DECLARE @NextSortOrder INT = 10;

        WHILE LEN(@Remaining) > 0
        BEGIN
            SET @CommaIndex = CHARINDEX(N',', @Remaining);
            SET @BlogIdText = LTRIM(RTRIM(LEFT(@Remaining, @CommaIndex - 1)));
            SET @BlogIdFromCsv = TRY_CONVERT(INT, @BlogIdText);

            IF @BlogIdFromCsv IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM @BlogIds WHERE [BlogId] = @BlogIdFromCsv)
            BEGIN
                INSERT INTO @BlogIds ([BlogId], [NewSortOrder])
                VALUES (@BlogIdFromCsv, @NextSortOrder);
                SET @NextSortOrder += 10;
            END;

            SET @Remaining = SUBSTRING(@Remaining, @CommaIndex + 1, LEN(@Remaining));
        END;

        IF NOT EXISTS (SELECT 1 FROM @BlogIds WHERE [BlogId] = @BlogId)
           OR EXISTS
           (
                SELECT 1
                FROM @BlogIds AS [Ids]
                LEFT JOIN [pmt].[Blogs] AS [Blog]
                    ON [Blog].[BlogId] = [Ids].[BlogId]
                   AND [Blog].[CreatedByUserId] = @CurrentUserId
                   AND [Blog].[IsDeleted] = 0
                   AND ISNULL(CASE WHEN [Blog].[BlogId] = @BlogId THEN @ParentBlogId ELSE [Blog].[ParentBlogId] END, 0) = ISNULL(@ParentBlogId, 0)
                WHERE [Blog].[BlogId] IS NULL
           )
        BEGIN
            THROW 50081, 'The diagram order is no longer current. Refresh and try again.', 1;
        END;

        UPDATE [pmt].[Blogs]
        SET
            [ParentBlogId] = @ParentBlogId,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [BlogId] = @BlogId;

        UPDATE [Blog]
        SET [SortOrder] = [Ids].[NewSortOrder]
        FROM [pmt].[Blogs] AS [Blog]
        INNER JOIN @BlogIds AS [Ids]
            ON [Ids].[BlogId] = [Blog].[BlogId];

        INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
        VALUES (@BlogId, N'Moved', @CurrentUserId, @CurrentUserId, @Now);

        EXEC [pmt].[WriteAudit] N'Blog', @BlogId, N'Moved', @Title, @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

IF OBJECT_ID(N'[pmt].[UserImageAnnotationTemplateLibraries]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserImageAnnotationTemplateLibraries]
    (
        [UserId] INT NOT NULL CONSTRAINT [PK_pmt_UserImageAnnotationTemplateLibraries] PRIMARY KEY,
        [LibraryJson] NVARCHAR(MAX) NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserImageAnnotationTemplateLibraries_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserImageAnnotationTemplateLibraries_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_UserImageAnnotationTemplateLibraries_User] FOREIGN KEY ([UserId])
            REFERENCES [pmt].[Users]([UserId]) ON DELETE CASCADE,
        CONSTRAINT [CK_pmt_UserImageAnnotationTemplateLibraries_Json] CHECK (ISJSON([LibraryJson]) = 1),
        CONSTRAINT [CK_pmt_UserImageAnnotationTemplateLibraries_Version] CHECK (TRY_CONVERT(INT, JSON_VALUE([LibraryJson], N'$.version')) = 1),
        CONSTRAINT [CK_pmt_UserImageAnnotationTemplateLibraries_Size] CHECK (DATALENGTH([LibraryJson]) <= 104857600)
    );
END;
GO

IF OBJECT_ID(N'[pmt].[ImageAnnotationDefaultTemplateLibraries]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[ImageAnnotationDefaultTemplateLibraries]
    (
        [DefaultLibraryId] TINYINT NOT NULL CONSTRAINT [PK_pmt_ImageAnnotationDefaultTemplateLibraries] PRIMARY KEY,
        [LibraryJson] NVARCHAR(MAX) NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_ImageAnnotationDefaultTemplateLibraries_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_ImageAnnotationDefaultTemplateLibraries_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Id] CHECK ([DefaultLibraryId] = 1),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Json] CHECK (ISJSON([LibraryJson]) = 1),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Version] CHECK (TRY_CONVERT(INT, JSON_VALUE([LibraryJson], N'$.version')) = 1),
        CONSTRAINT [CK_pmt_ImageAnnotationDefaultTemplateLibraries_Size] CHECK (DATALENGTH([LibraryJson]) <= 104857600)
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetUserImageAnnotationTemplateLibrary]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @CurrentUserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50281, 'The image annotation template-library user was not found or is inactive.', 1;
    END;

    SELECT [LibraryJson] = COALESCE
    (
        (
            SELECT [LibraryJson]
            FROM [pmt].[UserImageAnnotationTemplateLibraries]
            WHERE [UserId] = @CurrentUserId
        ),
        (
            SELECT [LibraryJson]
            FROM [pmt].[ImageAnnotationDefaultTemplateLibraries]
            WHERE [DefaultLibraryId] = 1
        ),
        N'{"version":1,"templates":[],"defaults":{"arrow":null,"rectangle":null}}'
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetImageAnnotationDefaultTemplateLibrary]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT [LibraryJson] = ISNULL
    (
        (
            SELECT [LibraryJson]
            FROM [pmt].[ImageAnnotationDefaultTemplateLibraries]
            WHERE [DefaultLibraryId] = 1
        ),
        N'{"version":1,"templates":[],"defaults":{"arrow":null,"rectangle":null}}'
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetPmtDatabaseSchema]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT [SchemaJson] =
    (
        SELECT
            1 AS [version],
            JSON_QUERY
            (
                (
                    SELECT
                        [Schema].[name] AS [schemaName],
                        [Table].[name] AS [tableName],
                        [Column].[column_id] AS [columnOrder],
                        [Column].[name] AS [columnName],
                        [Type].[name] AS [typeName],
                        [Column].[max_length] AS [maxLength],
                        [Column].[precision] AS [precision],
                        [Column].[scale] AS [scale],
                        CONVERT(BIT, [Column].[is_nullable]) AS [nullable],
                        CONVERT(BIT, [Column].[is_identity]) AS [isIdentity],
                        CONVERT(NVARCHAR(80), [Identity].[seed_value]) AS [identitySeed],
                        CONVERT(NVARCHAR(80), [Identity].[increment_value]) AS [identityIncrement],
                        CONVERT(BIT, CASE WHEN EXISTS
                        (
                            SELECT 1
                            FROM sys.indexes AS [Index]
                            INNER JOIN sys.index_columns AS [IndexColumn]
                                ON [IndexColumn].[object_id] = [Index].[object_id]
                               AND [IndexColumn].[index_id] = [Index].[index_id]
                            WHERE [Index].[object_id] = [Column].[object_id]
                              AND [Index].[is_primary_key] = 1
                              AND [IndexColumn].[column_id] = [Column].[column_id]
                        ) THEN 1 ELSE 0 END) AS [isPrimaryKey],
                        CONVERT(BIT, CASE WHEN EXISTS
                        (
                            SELECT 1
                            FROM sys.foreign_key_columns AS [ForeignKeyColumn]
                            WHERE [ForeignKeyColumn].[parent_object_id] = [Column].[object_id]
                              AND [ForeignKeyColumn].[parent_column_id] = [Column].[column_id]
                        ) THEN 1 ELSE 0 END) AS [isForeignKey]
                    FROM sys.tables AS [Table]
                    INNER JOIN sys.schemas AS [Schema]
                        ON [Schema].[schema_id] = [Table].[schema_id]
                    INNER JOIN sys.columns AS [Column]
                        ON [Column].[object_id] = [Table].[object_id]
                    INNER JOIN sys.types AS [Type]
                        ON [Type].[user_type_id] = [Column].[user_type_id]
                    LEFT JOIN sys.identity_columns AS [Identity]
                        ON [Identity].[object_id] = [Column].[object_id]
                       AND [Identity].[column_id] = [Column].[column_id]
                    WHERE [Schema].[name] = N'pmt'
                      AND [Table].[is_ms_shipped] = 0
                    ORDER BY [Table].[name], [Column].[column_id]
                    FOR JSON PATH
                )
            ) AS [columns],
            JSON_QUERY
            (
                (
                    SELECT
                        [ParentSchema].[name] AS [schemaName],
                        [ParentTable].[name] AS [tableName],
                        [ForeignKey].[name] AS [foreignKeyName],
                        [ForeignKeyColumn].[constraint_column_id] AS [columnOrder],
                        [ParentColumn].[name] AS [columnName],
                        [ReferencedSchema].[name] AS [referencedSchema],
                        [ReferencedTable].[name] AS [referencedTable],
                        [ReferencedColumn].[name] AS [referencedColumn]
                    FROM sys.foreign_keys AS [ForeignKey]
                    INNER JOIN sys.foreign_key_columns AS [ForeignKeyColumn]
                        ON [ForeignKeyColumn].[constraint_object_id] = [ForeignKey].[object_id]
                    INNER JOIN sys.tables AS [ParentTable]
                        ON [ParentTable].[object_id] = [ForeignKey].[parent_object_id]
                    INNER JOIN sys.schemas AS [ParentSchema]
                        ON [ParentSchema].[schema_id] = [ParentTable].[schema_id]
                    INNER JOIN sys.columns AS [ParentColumn]
                        ON [ParentColumn].[object_id] = [ForeignKeyColumn].[parent_object_id]
                       AND [ParentColumn].[column_id] = [ForeignKeyColumn].[parent_column_id]
                    INNER JOIN sys.tables AS [ReferencedTable]
                        ON [ReferencedTable].[object_id] = [ForeignKey].[referenced_object_id]
                    INNER JOIN sys.schemas AS [ReferencedSchema]
                        ON [ReferencedSchema].[schema_id] = [ReferencedTable].[schema_id]
                    INNER JOIN sys.columns AS [ReferencedColumn]
                        ON [ReferencedColumn].[object_id] = [ForeignKeyColumn].[referenced_object_id]
                       AND [ReferencedColumn].[column_id] = [ForeignKeyColumn].[referenced_column_id]
                    WHERE [ParentSchema].[name] = N'pmt'
                    ORDER BY [ParentTable].[name], [ForeignKey].[name], [ForeignKeyColumn].[constraint_column_id]
                    FOR JSON PATH
                )
            ) AS [foreignKeys]
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[SaveUserImageAnnotationTemplateLibrary]
    @LibraryJson NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @LibraryJson IS NULL
       OR ISJSON(@LibraryJson) <> 1
       OR DATALENGTH(@LibraryJson) > 104857600
    BEGIN
        THROW 50280, 'The image annotation template library must be valid JSON no larger than 50 MiB.', 1;
    END;

    IF NOT EXISTS
       (
           SELECT 1
           FROM OPENJSON(@LibraryJson)
           WHERE [key] = N'version'
             AND [type] = 2
             AND TRY_CONVERT(INT, [value]) = 1
       )
       OR NOT EXISTS
       (
           SELECT 1
           FROM OPENJSON(@LibraryJson)
           WHERE [key] = N'templates'
             AND [type] = 4
       )
       OR NOT EXISTS
       (
           SELECT 1
           FROM OPENJSON(@LibraryJson)
           WHERE [key] = N'defaults'
             AND [type] = 5
       )
       OR (SELECT COUNT(*) FROM OPENJSON(JSON_QUERY(@LibraryJson, N'$.templates'))) > 50
    BEGIN
        THROW 50280, 'The image annotation template library must be version 1 with defaults and no more than 50 templates.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @CurrentUserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50281, 'The image annotation template-library user was not found or is inactive.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[UserImageAnnotationTemplateLibraries] WITH (UPDLOCK, HOLDLOCK)
            WHERE [UserId] = @CurrentUserId
        )
        BEGIN
            UPDATE [pmt].[UserImageAnnotationTemplateLibraries]
            SET [LibraryJson] = @LibraryJson,
                [UpdatedAt] = SYSUTCDATETIME()
            WHERE [UserId] = @CurrentUserId;
        END;
        ELSE
        BEGIN
            INSERT INTO [pmt].[UserImageAnnotationTemplateLibraries]
            (
                [UserId],
                [LibraryJson]
            )
            VALUES
            (
                @CurrentUserId,
                @LibraryJson
            );
        END;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;

    SELECT [LibraryJson]
    FROM [pmt].[UserImageAnnotationTemplateLibraries]
    WHERE [UserId] = @CurrentUserId;
END;
GO

DECLARE @DefaultImageAnnotationTemplateLibraryJson NVARCHAR(MAX) = N'{"version":1,"templates":[{"id":"template-mrppoehr-gbsv6u","name":"Normal Text","grouped":false,"groupName":"","width":202.53644724785136,"height":166.41546742832043,"createdAt":"2026-07-18T01:51:56.511Z","updatedAt":"2026-07-18T01:51:56.511Z","objects":[{"id":"textbox-mrppnaro-8","type":"textbox","name":"","locked":false,"groupId":"","x":0,"y":0,"width":202.53644724785136,"height":166.41546742832043,"fill":"none","stroke":"#3f7f0d","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Text","textColor":"#0d0d0d","fontFamily":"Arial","fontSize":28,"textAlign":"left","textVerticalAlign":"top"}]},{"id":"template-mrp9i8vj-vgwm0p","name":"Green Arrow","grouped":false,"groupName":"","width":146,"height":126,"createdAt":"2026-07-17T18:19:15.439Z","updatedAt":"2026-07-18T02:05:09.880Z","objects":[{"id":"arrow-mrpq53a1-10","type":"arrow","name":"","locked":false,"groupId":"","x1":6,"y1":6,"x2":146,"y2":126,"stroke":"#4ea72e","strokeWidth":12,"arrowSize":48,"opacity":1}]},{"id":"template-mrpa9kpd-tuuusc","name":"Green Highlight","grouped":false,"groupName":"","width":184,"height":104,"createdAt":"2026-07-17T18:40:30.481Z","updatedAt":"2026-07-17T18:40:30.481Z","objects":[{"id":"rectangle-mrpa8em9-4","type":"rectangle","name":"","locked":false,"groupId":"","x":2,"y":2,"width":180,"height":100,"fill":"none","stroke":"#4ea72e","outlineVisible":true,"strokeWidth":4,"opacity":1}]},{"id":"template-mrpqf0lk-l8bt1m","name":"Green Box with Text","grouped":false,"groupName":"","width":226.9190420400173,"height":118.94254142122008,"createdAt":"2026-07-18T02:12:38.216Z","updatedAt":"2026-07-18T02:12:38.216Z","objects":[{"id":"textbox-mrpqek5p-22","type":"textbox","name":"","locked":false,"groupId":"","x":2,"y":2,"width":222.9190420400173,"height":114.94254142122008,"fill":"#4ea72e","stroke":"#4ea72e","outlineVisible":true,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpa72da-o1xtpx","name":"Green Caption","grouped":false,"groupName":"","width":382.44979917050296,"height":349.5666671265194,"createdAt":"2026-07-17T18:38:33.406Z","updatedAt":"2026-07-17T18:38:33.406Z","objects":[{"id":"arrow-mrpa57nj-2","type":"arrow","name":"","locked":false,"groupId":"","x1":250.41369131382453,"y1":97.20493329838473,"x2":0,"y2":349.5666671265194,"stroke":"#4ea72e","strokeWidth":12,"arrowSize":48,"opacity":1},{"id":"textbox-mrpa67x7-4","type":"textbox","name":"","locked":false,"groupId":"","x":157.53075713048565,"y":2,"width":222.9190420400173,"height":114.94254142122008,"fill":"#4ea72e","stroke":"#4ea72e","outlineVisible":true,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrp9iwy6-wqbtv8","name":"Orange Arrow","grouped":false,"groupName":"","width":146,"height":126,"createdAt":"2026-07-17T18:19:46.638Z","updatedAt":"2026-07-18T02:09:26.907Z","objects":[{"id":"arrow-mrp9ih6n-3","type":"arrow","name":"","locked":false,"groupId":"","x1":6,"y1":6,"x2":146,"y2":126,"stroke":"#ffc000","strokeWidth":12,"arrowSize":48,"opacity":1}]},{"id":"template-mrpq5woy-sf64gf","name":"Orange Box","grouped":false,"groupName":"","width":184,"height":104,"createdAt":"2026-07-18T02:05:33.250Z","updatedAt":"2026-07-18T02:05:33.250Z","objects":[{"id":"rectangle-mrpq5hep-11","type":"rectangle","name":"","locked":false,"groupId":"","x":2,"y":2,"width":180,"height":100,"fill":"none","stroke":"#ffc000","outlineVisible":true,"strokeWidth":4,"opacity":1}]},{"id":"template-mrpqe2wj-qm1c7c","name":"Orange Box with Text","grouped":false,"groupName":"","width":222.9190420400173,"height":114.94254142122008,"createdAt":"2026-07-18T02:11:54.547Z","updatedAt":"2026-07-18T02:11:54.547Z","objects":[{"id":"textbox-mrpqdqka-20","type":"textbox","name":"","locked":false,"groupId":"","x":0,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ffc000","stroke":"#4ea72e","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpq89ge-cicw6i","name":"Orange Caption","grouped":true,"groupName":"","width":380.44979917050296,"height":347.5666671265194,"createdAt":"2026-07-18T02:07:23.102Z","updatedAt":"2026-07-18T02:07:23.102Z","objects":[{"id":"arrow-mrpq529g-8","type":"arrow","name":"","locked":false,"groupId":"","x1":250.41369131382453,"y1":95.20493329838473,"x2":0,"y2":347.5666671265194,"stroke":"#ffc000","strokeWidth":12,"arrowSize":48,"opacity":1},{"id":"textbox-mrpq529g-9","type":"textbox","name":"","locked":false,"groupId":"","x":157.53075713048565,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ffc000","stroke":"#4ea72e","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpq9wwo-0u4drh","name":"Red Arrow","grouped":false,"groupName":"","width":146,"height":126,"createdAt":"2026-07-18T02:08:40.152Z","updatedAt":"2026-07-18T02:08:40.152Z","objects":[{"id":"arrow-mrpq9nep-15","type":"arrow","name":"","locked":false,"groupId":"","x1":6,"y1":6,"x2":146,"y2":126,"stroke":"#ff0000","strokeWidth":12,"arrowSize":48,"opacity":1}]},{"id":"template-mrpqancx-3y8xl1","name":"Red Box","grouped":false,"groupName":"","width":184,"height":104,"createdAt":"2026-07-18T02:09:14.433Z","updatedAt":"2026-07-18T02:09:40.633Z","objects":[{"id":"rectangle-mrpqaezk-16","type":"rectangle","name":"","locked":false,"groupId":"","x":2,"y":2,"width":180,"height":100,"fill":"none","stroke":"#ff0000","outlineVisible":true,"strokeWidth":4,"opacity":1}]},{"id":"template-mrpqdfgx-vn26f8","name":"Red Box and Text","grouped":false,"groupName":"","width":222.9190420400173,"height":114.94254142122008,"createdAt":"2026-07-18T02:11:24.177Z","updatedAt":"2026-07-18T02:11:31.251Z","objects":[{"id":"textbox-mrpqd1kk-18","type":"textbox","name":"","locked":false,"groupId":"","x":0,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ff0000","stroke":"#ff0000","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]},{"id":"template-mrpq99ai-qii9gx","name":"Red Caption","grouped":true,"groupName":"","width":380.44979917050296,"height":347.5666671265194,"createdAt":"2026-07-18T02:08:09.546Z","updatedAt":"2026-07-18T02:08:09.546Z","objects":[{"id":"arrow-mrpq8m96-13","type":"arrow","name":"","locked":false,"groupId":"","x1":250.41369131382453,"y1":95.20493329838473,"x2":0,"y2":347.5666671265194,"stroke":"#ff0000","strokeWidth":12,"arrowSize":48,"opacity":1},{"id":"textbox-mrpq8m96-14","type":"textbox","name":"","locked":false,"groupId":"","x":157.53075713048565,"y":0,"width":222.9190420400173,"height":114.94254142122008,"fill":"#ff0000","stroke":"#ff0000","outlineVisible":false,"strokeWidth":4,"opacity":1,"text":"Hello World","textColor":"#ffffff","fontFamily":"Arial","fontSize":28,"textAlign":"center","textVerticalAlign":"middle"}]}],"defaults":{"arrow":{"stroke":"#3f7f0d","strokeWidth":12,"arrowSize":48,"opacity":1},"rectangle":null}}';

IF ISJSON(@DefaultImageAnnotationTemplateLibraryJson) <> 1
   OR TRY_CONVERT(INT, JSON_VALUE(@DefaultImageAnnotationTemplateLibraryJson, N'$.version')) <> 1
   OR JSON_QUERY(@DefaultImageAnnotationTemplateLibraryJson, N'$.defaults') IS NULL
   OR (SELECT COUNT(*) FROM OPENJSON(JSON_QUERY(@DefaultImageAnnotationTemplateLibraryJson, N'$.templates'))) <> 13
BEGIN
    THROW 51079, 'The shared image annotation template defaults are invalid.', 1;
END;

UPDATE [pmt].[ImageAnnotationDefaultTemplateLibraries]
SET [LibraryJson] = @DefaultImageAnnotationTemplateLibraryJson,
    [UpdatedAt] = SYSUTCDATETIME()
WHERE [DefaultLibraryId] = 1;

IF @@ROWCOUNT = 0
BEGIN
    INSERT INTO [pmt].[ImageAnnotationDefaultTemplateLibraries]
    (
        [DefaultLibraryId],
        [LibraryJson]
    )
    VALUES
    (
        1,
        @DefaultImageAnnotationTemplateLibraryJson
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RecordAttendance]
    @AttendanceEntryId INT OUTPUT,
    @UserId INT,
    @Status NVARCHAR(20),
    @CurrentUserId INT,
    @AttendanceDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Status = CASE LOWER(LTRIM(RTRIM(ISNULL(@Status, N''))))
        WHEN N'home' THEN N'Home'
        WHEN N'office' THEN N'Office'
        WHEN N'sick leave' THEN N'Sick Leave'
        WHEN N'vacation' THEN N'Vacation'
        WHEN N'el' THEN N'EL'
        WHEN N'other' THEN N'Other'
        ELSE NULL
    END;

    IF @Status IS NULL
    BEGIN
        THROW 50272, 'Attendance must be Home, Office, Sick Leave, Vacation, EL, or Other.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @UserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50273, 'The attendance user was not found or is inactive.', 1;
    END;

    DECLARE @RequiredRight NVARCHAR(20) = CASE WHEN @UserId = @CurrentUserId THEN N'Create' ELSE N'Update' END;
    EXEC [pmt].[RequirePermission] @CurrentUserId, N'Scrum', @RequiredRight;

    -- BDO and the PMT team use UTC+8. A user's own Check-In always records
    -- the current local workday. Only On Behalf Of may select another date.
    DECLARE @LocalToday DATE = CONVERT(DATE, DATEADD(HOUR, 8, SYSUTCDATETIME()));
    SET @AttendanceDate = CASE
        WHEN @UserId = @CurrentUserId THEN @LocalToday
        ELSE ISNULL(@AttendanceDate, @LocalToday)
    END;

    -- Timestamps remain UTC in the normal audit columns.
    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT @AttendanceEntryId = [AttendanceEntryId]
        FROM [pmt].[AttendanceEntries] WITH (UPDLOCK, HOLDLOCK)
        WHERE [UserId] = @UserId
          AND [AttendanceDate] = @AttendanceDate
          AND [Status] = @Status;

        IF ISNULL(@AttendanceEntryId, 0) = 0
        BEGIN
            INSERT INTO [pmt].[AttendanceEntries]
            (
                [UserId],
                [AttendanceDate],
                [Status],
                [CreatedByUserId],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES
            (
                @UserId,
                @AttendanceDate,
                @Status,
                @CurrentUserId,
                @Now,
                @Now
            );

            SET @AttendanceEntryId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE [pmt].[AttendanceEntries]
            SET
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [AttendanceEntryId] = @AttendanceEntryId;
        END;

        DECLARE @AuditAction NVARCHAR(80) = CASE
            WHEN @UserId = @CurrentUserId THEN N'Checked In'
            ELSE N'Recorded On Behalf'
        END;
        DECLARE @AuditDetails NVARCHAR(400) =
            N'Attendance recorded as ' + @Status
            + N' for ' + CONVERT(NVARCHAR(10), @AttendanceDate, 23)
            + N' for user #' + CONVERT(NVARCHAR(20), @UserId) + N'.';

        EXEC [pmt].[WriteAudit]
            N'Attendance',
            @AttendanceEntryId,
            @AuditAction,
            @AuditDetails,
            @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RemoveAttendance]
    @AttendanceEntryId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT;
    DECLARE @AttendanceDate DATE;
    DECLARE @Status NVARCHAR(20);

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @UserId = [UserId],
            @AttendanceDate = [AttendanceDate],
            @Status = [Status]
        FROM [pmt].[AttendanceEntries] WITH (UPDLOCK, HOLDLOCK)
        WHERE [AttendanceEntryId] = @AttendanceEntryId;

        IF @UserId IS NULL
        BEGIN
            THROW 50278, 'The attendance entry was not found.', 1;
        END;

        DECLARE @RequiredRight NVARCHAR(20) = CASE WHEN @UserId = @CurrentUserId THEN N'Create' ELSE N'Update' END;
        EXEC [pmt].[RequirePermission] @CurrentUserId, N'Scrum', @RequiredRight;

        DELETE FROM [pmt].[AttendanceEntries]
        WHERE [AttendanceEntryId] = @AttendanceEntryId;

        DECLARE @AuditDetails NVARCHAR(400) =
            N'Attendance removed for ' + CONVERT(NVARCHAR(10), @AttendanceDate, 23)
            + N' as ' + @Status
            + N' for user #' + CONVERT(NVARCHAR(20), @UserId) + N'.';

        EXEC [pmt].[WriteAudit]
            N'Attendance',
            @AttendanceEntryId,
            N'Removed',
            @AuditDetails,
            @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[EnsurePmtDemoUsers]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50260, 'Only an administrator can restore PMT demo users.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @DemoRestoreLockResult INT;
        EXEC @DemoRestoreLockResult = sys.sp_getapplock
            @Resource = N'pmt:PMTDemoRestore',
            @LockMode = N'Exclusive',
            @LockOwner = N'Transaction',
            @LockTimeout = 30000;

        IF @DemoRestoreLockResult < 0
        BEGIN
            THROW 50269, 'The PMT demo restore is already running. Try again after it finishes.', 1;
        END;

    -- Restoring users must not change anything while a PMT Project still exists.
    IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = N'PMT')
    BEGIN
        THROW 50258, 'PMT seed data can only be restored after the PMT project has been permanently deleted.', 1;
    END;

    DECLARE @Sin INT =
    (
        SELECT TOP (1) [UserId]
        FROM [pmt].[Users]
        WHERE [Email] = N'louiery@gmail.com'
          AND [IsAdmin] = 1
          AND [IsActive] = 1
        ORDER BY [UserId]
    );

    IF @Sin IS NULL
    BEGIN
        THROW 50261, 'The active Sin administrator account is required to restore PMT demo users.', 1;
    END;

    DECLARE @SeedUsers TABLE
    (
        [FirstName] NVARCHAR(80) NOT NULL,
        [LastName] NVARCHAR(80) NOT NULL,
        [Nickname] NVARCHAR(80) NOT NULL,
        [Email] NVARCHAR(180) NOT NULL PRIMARY KEY,
        [Phone] NVARCHAR(60) NOT NULL,
        [AvatarUrl] NVARCHAR(500) NOT NULL,
        [HomePageUrl] NVARCHAR(500) NOT NULL,
        [SocialMediaUrl] NVARCHAR(500) NOT NULL,
        [Bio] NVARCHAR(MAX) NOT NULL,
        [Role] NVARCHAR(20) NOT NULL
    );

    INSERT INTO @SeedUsers
    (
        [FirstName], [LastName], [Nickname], [Email], [Phone], [AvatarUrl],
        [HomePageUrl], [SocialMediaUrl], [Bio], [Role]
    )
    VALUES
    (N'Bill', N'Gates', N'Bill', N'bill.gates@microsoft.com', N'555-0102', N'/assets/avatar-bill-gates.jpg?v=20260629-avatar-jpg-assets', N'https://www.gatesnotes.com/', N'https://www.linkedin.com/in/williamhgates/', N'Backend developer focused on APIs and database work.', N'Developer'),
    (N'Sam', N'Altman', N'Sam', N'sam.altman@openai.com', N'555-0103', N'/assets/avatar-sam-altman.jpg?v=20260629-avatar-jpg-assets', N'https://blog.samaltman.com/', N'https://www.linkedin.com/in/samaltman/', N'QA lead who keeps acceptance criteria and bug reports clear.', N'QA'),
    (N'Mark', N'Zuckerberg', N'Mark', N'mark.zuckerberg@meta.com', N'555-0104', N'/assets/avatar-mark-zuckerberg.jpg?v=20260629-avatar-jpg-assets', N'https://about.meta.com/', N'https://www.linkedin.com/in/zuck/', N'Frontend developer focused on usability and interaction details.', N'Developer'),
    (N'Steve', N'Jobs', N'Steve', N'steve.jobs@apple.com', N'555-0105', N'/assets/avatar-steve-jobs.jpg?v=20260629-avatar-jpg-assets', N'https://www.apple.com/', N'https://www.linkedin.com/', N'Product-minded developer who helps sharpen feature scope.', N'Developer'),
    (N'Jensen', N'Huang', N'Jensen Huang', N'Jensen.Huang@nvidia.com', N'555-0106', N'/assets/avatar-jensen-huang.jpg?v=20260629-avatar-jpg-assets', N'https://www.nvidia.com/', N'https://www.linkedin.com/in/jenhsunhuang/', N'Integration developer who helps with performance and release support.', N'Developer');

    IF EXISTS
    (
        SELECT [Seed].[Email]
        FROM @SeedUsers AS [Seed]
        INNER JOIN [pmt].[Users] AS [Existing]
            ON LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Seed].[Email])
        GROUP BY [Seed].[Email]
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 50262, 'A PMT demo email belongs to more than one user. Resolve the duplicate before restoring the demo.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM @SeedUsers AS [Seed]
        WHERE NOT EXISTS
              (
                  SELECT 1
                  FROM [pmt].[Users] AS [ExactUser]
                  WHERE LOWER(LTRIM(RTRIM([ExactUser].[Email]))) = LOWER([Seed].[Email])
                    AND [ExactUser].[IsActive] = 1
              )
          AND EXISTS
              (
                  SELECT 1
                  FROM [pmt].[Users] AS [NicknameOwner]
                  WHERE LOWER(LTRIM(RTRIM([NicknameOwner].[Nickname]))) = LOWER([Seed].[Nickname])
                    AND LOWER(LTRIM(RTRIM(ISNULL([NicknameOwner].[Email], N'')))) <> LOWER([Seed].[Email])
              )
    )
    BEGIN
        THROW 50263, 'A PMT demo username belongs to another user. Resolve the collision before restoring the demo.', 1;
    END;

        DECLARE @ChangedUsers TABLE
        (
            [UserId] INT NOT NULL PRIMARY KEY,
            [Nickname] NVARCHAR(80) NOT NULL,
            [Action] NVARCHAR(20) NOT NULL
        );

        UPDATE [Existing]
        SET
            [FirstName] = [Seed].[FirstName],
            [LastName] = [Seed].[LastName],
            [Nickname] = [Seed].[Nickname],
            [Phone] = [Seed].[Phone],
            [AvatarUrl] = [Seed].[AvatarUrl],
            [HomePageUrl] = [Seed].[HomePageUrl],
            [SocialMediaUrl] = [Seed].[SocialMediaUrl],
            [Bio] = [Seed].[Bio],
            [IsAdmin] = 0,
            [Role] = [Seed].[Role],
            [IsActive] = 1,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        OUTPUT [inserted].[UserId], [inserted].[Nickname], N'Reactivated'
            INTO @ChangedUsers ([UserId], [Nickname], [Action])
        FROM [pmt].[Users] AS [Existing]
        INNER JOIN @SeedUsers AS [Seed]
            ON LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Seed].[Email])
        WHERE [Existing].[IsActive] = 0;

        INSERT INTO [pmt].[Users]
        (
            [FirstName], [LastName], [Nickname], [Email], [Phone], [AvatarUrl],
            [PasswordHash], [HomePageUrl], [SocialMediaUrl], [Bio], [IsAdmin],
            [Role], [IsActive], [CreatedByUserId]
        )
        OUTPUT [inserted].[UserId], [inserted].[Nickname], N'Created'
            INTO @ChangedUsers ([UserId], [Nickname], [Action])
        SELECT
            [Seed].[FirstName], [Seed].[LastName], [Seed].[Nickname], [Seed].[Email],
            [Seed].[Phone], [Seed].[AvatarUrl], CRYPT_GEN_RANDOM(32),
            [Seed].[HomePageUrl], [Seed].[SocialMediaUrl], [Seed].[Bio], 0,
            [Seed].[Role], 1, @CurrentUserId
        FROM @SeedUsers AS [Seed]
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[Users] AS [Existing]
            WHERE LOWER(LTRIM(RTRIM([Existing].[Email]))) = LOWER([Seed].[Email])
        );

        DECLARE @ChangedUserId INT;
        DECLARE @ChangedNickname NVARCHAR(80);
        DECLARE @ChangedAction NVARCHAR(20);

        WHILE EXISTS (SELECT 1 FROM @ChangedUsers)
        BEGIN
            SELECT TOP (1)
                @ChangedUserId = [UserId],
                @ChangedNickname = [Nickname],
                @ChangedAction = [Action]
            FROM @ChangedUsers
            ORDER BY [UserId];

            EXEC [pmt].[WriteAudit]
                N'User',
                @ChangedUserId,
                @ChangedAction,
                @ChangedNickname,
                @CurrentUserId;

            DELETE FROM @ChangedUsers WHERE [UserId] = @ChangedUserId;
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
       OR (@ClearPmtOnly = 0 AND [Code] <> N'PMT');

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
        CASE WHEN @ClearPmtOnly = 1 THEN N'Cleared PMT project data.' ELSE N'Cleared project data except PMT.' END;

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

    DELETE [AuditEvent]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    INNER JOIN [pmt].[AttendanceEntries] AS [Attendance]
        ON [AuditEvent].[EntityType] = N'Attendance'
       AND [AuditEvent].[EntityId] = [Attendance].[AttendanceEntryId]
    WHERE [Attendance].[UserId] <> @AdminUserId;

    DELETE [AuditEvent]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    INNER JOIN [pmt].[VacationPlans] AS [Vacation]
        ON [AuditEvent].[EntityType] = N'Vacation'
       AND [AuditEvent].[EntityId] = [Vacation].[VacationPlanId]
    WHERE [Vacation].[UserId] <> @AdminUserId;

    DELETE FROM [pmt].[AttendanceEntries]
    WHERE [UserId] <> @AdminUserId;

    DELETE FROM [pmt].[VacationPlans]
    WHERE [UserId] <> @AdminUserId;

    DELETE FROM [pmt].[UserPermissions]
    WHERE [UserId] <> @AdminUserId;

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
        [Role] = N'Developer',
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
    UPDATE [pmt].[AuditEvents]
    SET
        [UserId] = @AdminUserId,
        [ActorUserId] = @AdminUserId,
        [CreatedByUserId] = @AdminUserId,
        [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Lookups] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[Holidays] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[WfhSchedules] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[AttendanceEntries] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    UPDATE [pmt].[VacationPlans] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
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
END;
GO

BEGIN TRANSACTION;

EXEC [pmt].[LockBlogWrites];
EXEC [pmt].[LockWorkTaskWrites];
EXEC [pmt].[LockSprintWrites];

DECLARE @PmtProjectId INT = (SELECT [PmtProjectId] FROM #Pmt122To123State);
DECLARE @SinUserId INT = (SELECT [SinUserId] FROM #Pmt122To123State);

UPDATE [pmt].[Projects]
SET
    [Code] = N'PMTQA',
    [UpdatedByUserId] = @SinUserId,
    [UpdatedAt] = SYSUTCDATETIME()
WHERE [ProjectId] = @PmtProjectId
  AND [Code] = N'PMT'
  AND [IsArchived] = 0;

IF @@ROWCOUNT <> 1
BEGIN
    THROW 51065, 'The deployed PMT Project could not be renamed to PMTQA.', 1;
END;

EXEC [pmt].[SynchronizeProjectCode]
    @ProjectId = @PmtProjectId,
    @PreviousProjectCode = N'PMT',
    @ProjectCode = N'PMTQA';

EXEC [pmt].[WriteAudit]
    N'Project',
    @PmtProjectId,
    N'Code Renamed',
    N'One-time Production migration renamed PMT to PMTQA before restoring the original PMT demo.',
    @SinUserId;

EXEC [pmt].[EnsurePmtDemoUsers] @CurrentUserId = @SinUserId;
GO

/*
    PMT project seed data.

    This script restores only the PMT project and its initial Sprints, work
    items, Scrum entries, and Documentation. Core users, lookups, security,
    holidays, and the LMS/HLS projects are managed by their companion scripts.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET DATEFIRST 7;
SET XACT_ABORT ON;

DECLARE @Today DATE = CONVERT(DATE, SYSDATETIME());
DECLARE @Now DATETIME2(0) = SYSDATETIME();
DECLARE @Sin INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'louiery@gmail.com' ORDER BY [UserId]);
DECLARE @Bill INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'bill.gates@microsoft.com' ORDER BY [UserId]);
DECLARE @Sam INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'sam.altman@openai.com' ORDER BY [UserId]);
DECLARE @Mark INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'mark.zuckerberg@meta.com' ORDER BY [UserId]);
DECLARE @Steve INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'steve.jobs@apple.com' ORDER BY [UserId]);
DECLARE @Jensen INT = (SELECT TOP (1) [UserId] FROM [pmt].[Users] WHERE [Email] = N'Jensen.Huang@nvidia.com' ORDER BY [UserId]);
DECLARE @MinorSeverity NVARCHAR(120) = ISNULL
(
    (
        SELECT TOP (1) [Value]
        FROM [pmt].[Lookups]
        WHERE [LookupType] = N'Severity'
          AND [IsActive] = 1
          AND ([Value] = N'Minor' OR [Value] LIKE N'% - Minor')
        ORDER BY CASE WHEN [Value] = N'Minor' THEN 0 ELSE 1 END, [DisplayOrder], [LookupId]
    ),
    N'Minor'
);
DECLARE @MajorSeverity NVARCHAR(120) = ISNULL
(
    (
        SELECT TOP (1) [Value]
        FROM [pmt].[Lookups]
        WHERE [LookupType] = N'Severity'
          AND [IsActive] = 1
          AND ([Value] = N'Major' OR [Value] LIKE N'% - Major')
        ORDER BY CASE WHEN [Value] = N'Major' THEN 0 ELSE 1 END, [DisplayOrder], [LookupId]
    ),
    N'Major'
);
DECLARE @SitEnvironment NVARCHAR(120) = ISNULL
(
    (
        SELECT TOP (1) [Value]
        FROM [pmt].[Lookups]
        WHERE [LookupType] = N'Environment'
          AND [IsActive] = 1
          AND ([Value] = N'SIT' OR [Value] LIKE N'SIT -%')
        ORDER BY CASE WHEN [Value] = N'SIT' THEN 0 ELSE 1 END, [DisplayOrder], [LookupId]
    ),
    N'SIT'
);

IF EXISTS (SELECT 1 FROM [pmt].[Projects] WHERE [Code] = N'PMT')
BEGIN
    THROW 50258, 'PMT seed data can only be restored after the PMT project has been permanently deleted.', 1;
END;

IF @Sin IS NULL OR @Bill IS NULL OR @Sam IS NULL OR @Mark IS NULL OR @Steve IS NULL OR @Jensen IS NULL
BEGIN
    THROW 50259, 'PMT seed data requires the original demo users. Use Restore PMT Seed Data or pmt.EnsurePmtDemoUsers first.', 1;
END;

BEGIN TRANSACTION;

-- Vacation plans are person-level. Each representative is a shared member of
-- PMT, LMS, and HLS. Preserve any active overlapping plan instead of creating
-- a duplicate; otherwise add the deterministic current-month demo range.
INSERT INTO [pmt].[VacationPlans]
(
    [UserId], [StartDate], [EndDate], [IsCancelled],
    [CreatedByUserId], [UpdatedByUserId], [CreatedAt], [UpdatedAt]
)
SELECT
    [User].[UserId],
    [Seed].[StartDate],
    [Seed].[EndDate],
    0,
    @Sin,
    @Sin,
    @Now,
    @Now
FROM #Pmt122To123DemoVacations AS [Seed]
INNER JOIN [pmt].[Users] AS [User]
    ON LOWER(LTRIM(RTRIM([User].[Email]))) = LOWER([Seed].[Email])
   AND [User].[IsActive] = 1
WHERE NOT EXISTS
(
    SELECT 1
    FROM [pmt].[VacationPlans] AS [Existing]
    WHERE [Existing].[UserId] = [User].[UserId]
      AND [Existing].[IsCancelled] = 0
      AND [Existing].[StartDate] <= [Seed].[EndDate]
      AND [Existing].[EndDate] >= [Seed].[StartDate]
);

INSERT INTO [pmt].[Projects] ([Code], [Title], [Description], [Url], [IconUrl], [StartDate], [EndDate], [CreatedByUserId])
VALUES
(N'PMT', N'Project Management Tool', N'The internal task tracking tool used by this development team.', N'https://intranet.local/projects/pmt', N'/assets/project-pmt.svg?v=20260621-transparent', DATEADD(DAY, -56, @Today), NULL, @Sin);

DECLARE @PmtProject INT = (SELECT [ProjectId] FROM [pmt].[Projects] WHERE [Code] = N'PMT');

INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
VALUES
(@PmtProject, @Sin, @Sin), (@PmtProject, @Bill, @Sin), (@PmtProject, @Sam, @Sin),
(@PmtProject, @Mark, @Sin), (@PmtProject, @Steve, @Sin), (@PmtProject, @Jensen, @Sin);

INSERT INTO [pmt].[Sprints]
(
    [ProjectId], [Code], [Title], [Description], [StartDate], [EndDate],
    [LessonLearnedHtml], [IsFinished], [CreatedByUserId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, N'PMT-Sprint01', N'Day 1 Foundation', N'Create the application foundation, database schema, login, ADO.NET data access, and stored procedure-first pattern.', DATEADD(DAY, -56, @Today), DATEADD(DAY, -43, @Today), N'<p>The KISS approach worked well: one small ADO.NET store calling stored procedures was easy to follow and debug.</p>', 1, @Sin, DATEADD(DAY, -56, @Now), DATEADD(DAY, -43, @Now)),
(@PmtProject, N'PMT-Sprint02', N'Day 2 UX and Kanban', N'Modernize the UI, expand the workflow statuses, add Kanban movement, and clean up dialogs.', DATEADD(DAY, -42, @Today), DATEADD(DAY, -29, @Today), N'<p>Dark theme polish and predictable dialog focus made the app feel less like a prototype.</p>', 1, @Sin, DATEADD(DAY, -42, @Now), DATEADD(DAY, -29, @Now)),
(@PmtProject, N'PMT-Sprint03', N'Day 3 Scrum and Documentation', N'Add richer filters, Scrum rows, Documentation, project/sprint drill-through, and permanent seed content.', DATEADD(DAY, -28, @Today), DATEADD(DAY, -15, @Today), N'<p>Project and Sprint filters became the backbone for navigating PMT during demos.</p>', 1, @Sin, DATEADD(DAY, -28, @Now), DATEADD(DAY, -15, @Now)),
(@PmtProject, N'PMT-Sprint04', N'Day 4 Planning Views', N'Add holiday maintenance, Gantt non-working day behavior, and the Road Map view for project planning.', DATEADD(DAY, -14, @Today), DATEADD(DAY, -1, @Today), N'<p>Long-running projects needed compressed timelines, while normal two-week Sprints still needed readable bars.</p>', 1, @Sin, DATEADD(DAY, -14, @Now), DATEADD(DAY, -1, @Now)),
(@PmtProject, N'PMT-Sprint05', N'Days 5-8 Audit, Settings, and Polish', N'Current Sprint for audit trails, seed restore tools, fly-by fixes, linked Bug Fix validation, and theme support.', @Today, DATEADD(DAY, 13, @Today), N'', 0, @Sin, @Now, @Now);

DECLARE @PmtSprint1 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint01');
DECLARE @PmtSprint2 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint02');
DECLARE @PmtSprint3 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint03');
DECLARE @PmtSprint4 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint04');
DECLARE @PmtSprint5 INT = (SELECT [SprintId] FROM [pmt].[Sprints] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-Sprint05');

INSERT INTO [pmt].[SprintMembers] ([SprintId], [UserId], [CreatedByUserId])
VALUES
(@PmtSprint1, @Sin, @Sin), (@PmtSprint1, @Bill, @Sin), (@PmtSprint1, @Sam, @Sin), (@PmtSprint1, @Mark, @Sin), (@PmtSprint1, @Steve, @Sin), (@PmtSprint1, @Jensen, @Sin),
(@PmtSprint2, @Sin, @Sin), (@PmtSprint2, @Bill, @Sin), (@PmtSprint2, @Sam, @Sin), (@PmtSprint2, @Mark, @Sin), (@PmtSprint2, @Steve, @Sin), (@PmtSprint2, @Jensen, @Sin),
(@PmtSprint3, @Sin, @Sin), (@PmtSprint3, @Bill, @Sin), (@PmtSprint3, @Sam, @Sin), (@PmtSprint3, @Mark, @Sin), (@PmtSprint3, @Steve, @Sin), (@PmtSprint3, @Jensen, @Sin),
(@PmtSprint4, @Sin, @Sin), (@PmtSprint4, @Bill, @Sin), (@PmtSprint4, @Sam, @Sin), (@PmtSprint4, @Mark, @Sin), (@PmtSprint4, @Steve, @Sin), (@PmtSprint4, @Jensen, @Sin),
(@PmtSprint5, @Sin, @Sin), (@PmtSprint5, @Bill, @Sin), (@PmtSprint5, @Sam, @Sin), (@PmtSprint5, @Mark, @Sin), (@PmtSprint5, @Steve, @Sin), (@PmtSprint5, @Jensen, @Sin);

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, @PmtSprint1, NULL, N'Dev', N'PMT-TASK-001', N'Build PMT foundation with stored procedures', N'<p>Create the pmt schema, simple tables, stored procedures, and the ADO.NET access path for the first PMT screens.</p>', N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/tasks/001', DATEADD(DAY, -55, @Today), DATEADD(DAY, -50, @Today), DATEADD(DAY, -55, @Today), @Sin, NULL, DATEADD(DAY, -56, @Now), DATEADD(DAY, -50, @Now)),
(@PmtProject, @PmtSprint1, NULL, N'Dev', N'PMT-TASK-005', N'Create login and password change flow', N'<p>Add the login screen, default Password1 seed password, and a simple password change dialog.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/005', DATEADD(DAY, -53, @Today), DATEADD(DAY, -47, @Today), DATEADD(DAY, -53, @Today), @Sin, NULL, DATEADD(DAY, -54, @Now), DATEADD(DAY, -47, @Now)),
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-006', N'Modernize dark theme and form controls', N'<p>Replace the early plain UI with a modern dark theme, styled dropdowns, cleaner file inputs, and left-aligned checkboxes.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/006', DATEADD(DAY, -41, @Today), DATEADD(DAY, -36, @Today), DATEADD(DAY, -41, @Today), @Sin, NULL, DATEADD(DAY, -42, @Now), DATEADD(DAY, -36, @Now)),
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-009', N'Add Kanban Board drag and task creation', N'<p>Allow Dev Tasks to be created from the Kanban Board and moved across status columns.</p>', N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/tasks/009', DATEADD(DAY, -38, @Today), DATEADD(DAY, -31, @Today), DATEADD(DAY, -38, @Today), @Sin, NULL, DATEADD(DAY, -39, @Now), DATEADD(DAY, -31, @Now)),
(@PmtProject, @PmtSprint3, NULL, N'Dev', N'PMT-TASK-011', N'Add Project, Sprint, and Dev Task filtering', N'<p>Make Projects drill into Sprints, Sprints drill into Dev Tasks, and Tasks refresh by selected Project/Sprint.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/011', DATEADD(DAY, -27, @Today), DATEADD(DAY, -21, @Today), DATEADD(DAY, -27, @Today), @Sin, NULL, DATEADD(DAY, -28, @Now), DATEADD(DAY, -21, @Now)),
(@PmtProject, @PmtSprint3, NULL, N'Dev', N'PMT-TASK-015', N'Add Scrum and Documentation screens', N'<p>Rename Blogs to Documentation, add Scrum entries, and seed realistic Documentation with local images.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/015', DATEADD(DAY, -24, @Today), DATEADD(DAY, -16, @Today), DATEADD(DAY, -24, @Today), @Sin, NULL, DATEADD(DAY, -25, @Now), DATEADD(DAY, -16, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-016', N'Add Holiday maintenance and Gantt non-working-day rules', N'<p>Add configurable holidays for Philippine deployments and hide weekends/holidays on planning timelines unless work starts there.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/016', DATEADD(DAY, -13, @Today), DATEADD(DAY, -9, @Today), DATEADD(DAY, -13, @Today), @Sin, NULL, DATEADD(DAY, -14, @Now), DATEADD(DAY, -9, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-017', N'Create Road Map planning view', N'<p>Render Projects and Sprints by date with progress, avatars, filtering, sorting, and clickable navigation.</p>', N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/tasks/017', DATEADD(DAY, -12, @Today), DATEADD(DAY, -5, @Today), DATEADD(DAY, -12, @Today), @Sin, NULL, DATEADD(DAY, -13, @Now), DATEADD(DAY, -5, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-018', N'Add Gantt Sprint jump and fly-by demo', N'<p>Add Sprint filtering, selected Sprint mode, all-Sprints mode, reset behavior, and the fly-by demo animation.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/018', DATEADD(DAY, -10, @Today), DATEADD(DAY, -2, @Today), DATEADD(DAY, -10, @Today), @Sin, NULL, DATEADD(DAY, -11, @Now), DATEADD(DAY, -2, @Now)),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-020', N'Add audit logs and Development settings tools', N'<p>Create task/bug audit popups, Development cleanup buttons, and seed restore support for PMT, LMS, and HLS.</p>', N'Deployed in UAT', N'Low', 100, N'https://intranet.local/pmt/tasks/020', @Today, DATEADD(DAY, 7, @Today), @Today, @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-024', N'Add Light and Dark theme toggle', N'<p>Add a persistent theme toggle under the avatar menu and provide a professional light glassmorphism theme.</p>', N'In Progress', N'Low', 40, N'https://intranet.local/pmt/tasks/024', DATEADD(DAY, 1, @Today), DATEADD(DAY, 5, @Today), DATEADD(DAY, 1, @Today), @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-026', N'Tune Gantt sizing for two-week Sprints', N'<p>Keep the HLS multi-year Gantt compressed while making normal two-week Sprint projects readable in one viewport.</p>', N'Todo', N'Low', 0, N'https://intranet.local/pmt/tasks/026', DATEADD(DAY, 2, @Today), DATEADD(DAY, 8, @Today), NULL, @Sin, NULL, @Now, @Now),
(@PmtProject, NULL, NULL, N'Dev', N'PMT-BACKLOG-001', N'Add stakeholder export package', N'<p>Generate a lightweight stakeholder summary from Dashboard, Road Map, and Gantt views.</p>', N'Todo', N'Low', 0, N'https://intranet.local/pmt/backlog/001', NULL, NULL, NULL, @Sin, NULL, @Now, @Now),
(@PmtProject, NULL, NULL, N'Dev', N'PMT-BACKLOG-002', N'Add reusable chart module for task and bug analytics', N'<p>Build simple animated charts without a charting library for Dev Task and Bug Report trends.</p>', N'Todo', N'Low', 0, N'https://intranet.local/pmt/backlog/002', NULL, NULL, NULL, @Sin, NULL, @Now, @Now);

DECLARE @PmtFoundationParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-001');
DECLARE @PmtThemeParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-006');
DECLARE @PmtFiltersParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-011');
DECLARE @PmtAuditParent INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-020');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, @PmtSprint1, @PmtFoundationParent, N'Dev', N'PMT-TASK-002', N'Create pmt schema and core tables', N'<p>Create all database objects under the pmt schema and prefix all references with it.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/002', DATEADD(DAY, -55, @Today), DATEADD(DAY, -54, @Today), DATEADD(DAY, -55, @Today), @Sin, NULL, DATEADD(DAY, -55, @Now), DATEADD(DAY, -54, @Now)),
(@PmtProject, @PmtSprint1, @PmtFoundationParent, N'Dev', N'PMT-TASK-003', N'Build ADO.NET store methods', N'<p>Use straightforward SqlCommand calls and stored procedures instead of Entity Framework.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/003', DATEADD(DAY, -54, @Today), DATEADD(DAY, -52, @Today), DATEADD(DAY, -54, @Today), @Sin, NULL, DATEADD(DAY, -54, @Now), DATEADD(DAY, -52, @Now)),
(@PmtProject, @PmtSprint1, @PmtFoundationParent, N'Dev', N'PMT-TASK-004', N'Create seed script and default users', N'<p>Seed the initial users, Password1 hashes, lookups, PMT project, and starter tasks.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/004', DATEADD(DAY, -52, @Today), DATEADD(DAY, -50, @Today), DATEADD(DAY, -52, @Today), @Sin, NULL, DATEADD(DAY, -52, @Now), DATEADD(DAY, -50, @Now)),
(@PmtProject, @PmtSprint2, @PmtThemeParent, N'Dev', N'PMT-TASK-007', N'Style dropdowns and file uploads', N'<p>Remove the harsh default control borders and make dropdown menus match the dark UI.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/007', DATEADD(DAY, -41, @Today), DATEADD(DAY, -39, @Today), DATEADD(DAY, -41, @Today), @Sin, NULL, DATEADD(DAY, -41, @Now), DATEADD(DAY, -39, @Now)),
(@PmtProject, @PmtSprint2, @PmtThemeParent, N'Dev', N'PMT-TASK-008', N'Fix checkbox alignment in dialogs', N'<p>Place checkboxes on the left with labels beside them in Project and User dialogs.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/008', DATEADD(DAY, -39, @Today), DATEADD(DAY, -36, @Today), DATEADD(DAY, -39, @Today), @Sin, NULL, DATEADD(DAY, -39, @Now), DATEADD(DAY, -36, @Now)),
(@PmtProject, @PmtSprint3, @PmtFiltersParent, N'Dev', N'PMT-TASK-012', N'Project click filters Sprints', N'<p>Clicking a Project opens the Sprints view with that Project already selected.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/012', DATEADD(DAY, -27, @Today), DATEADD(DAY, -25, @Today), DATEADD(DAY, -27, @Today), @Sin, NULL, DATEADD(DAY, -27, @Now), DATEADD(DAY, -25, @Now)),
(@PmtProject, @PmtSprint3, @PmtFiltersParent, N'Dev', N'PMT-TASK-013', N'Sprint click filters Dev Tasks', N'<p>Clicking a Sprint opens the Dev Tasks view with the Project and Sprint filters applied.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/013', DATEADD(DAY, -25, @Today), DATEADD(DAY, -23, @Today), DATEADD(DAY, -25, @Today), @Sin, NULL, DATEADD(DAY, -25, @Now), DATEADD(DAY, -23, @Now)),
(@PmtProject, @PmtSprint3, @PmtFiltersParent, N'Dev', N'PMT-TASK-014', N'Add advanced Dev Task filters', N'<p>Add status, assigned-user, completion, newest/oldest, and hide-completed filters.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/014', DATEADD(DAY, -23, @Today), DATEADD(DAY, -21, @Today), DATEADD(DAY, -23, @Today), @Sin, NULL, DATEADD(DAY, -23, @Now), DATEADD(DAY, -21, @Now)),
(@PmtProject, @PmtSprint5, @PmtAuditParent, N'Dev', N'PMT-TASK-021', N'Create task and bug audit popup', N'<p>Show status and completion changes from newest to oldest on read-only and edit dialogs.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/021', @Today, DATEADD(DAY, 2, @Today), @Today, @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, @PmtAuditParent, N'Dev', N'PMT-TASK-022', N'Add Development cleanup buttons', N'<p>Add Settings tools to clear non-PMT data, clear PMT, clear users, and restore seed data.</p>', N'Deployed in UAT', N'Low', 100, N'https://intranet.local/pmt/tasks/022', DATEADD(DAY, 1, @Today), DATEADD(DAY, 3, @Today), DATEADD(DAY, 1, @Today), @Sin, NULL, @Now, @Now),
(@PmtProject, @PmtSprint5, @PmtAuditParent, N'Dev', N'PMT-TASK-023', N'Wire seed restore endpoint', N'<p>Replay the PMT, LMS, and HLS seed scripts from the Settings screen.</p>', N'Deployed in UAT', N'Low', 100, N'https://intranet.local/pmt/tasks/023', DATEADD(DAY, 3, @Today), DATEADD(DAY, 7, @Today), DATEADD(DAY, 3, @Today), @Sin, NULL, @Now, @Now);

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [StepsToReproduceHtml], [ActualResultHtml], [ExpectedResultHtml], [RootCauseAnalysisHtml], [Environment], [Severity],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId]
)
VALUES
(@PmtProject, @PmtSprint2, NULL, N'Bug', N'PMT-BUG-001', N'Dropdown menu stays white in dark theme', N'<p>Native dropdown options keep a white background and look disconnected from the dark UI.</p>', N'<ol><li>Open any edit dialog.</li><li>Open the Status dropdown.</li><li>Review the option list.</li></ol>', N'<p>The open menu is white and visually clashes with the page.</p>', N'<p>The dropdown options should use the PMT dark theme.</p>', N'<p>Root cause: browser-native select option styling was left outside the PMT theme token rules.</p>', N'local', @MinorSeverity, N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/bugs/001', DATEADD(DAY, -37, @Today), DATEADD(DAY, -34, @Today), DATEADD(DAY, -37, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint4, NULL, N'Bug', N'PMT-BUG-002', N'Gantt day labels overlap on compressed timelines', N'<p>When a long project is shown, day numbers can overlap and become unreadable.</p>', N'<ol><li>Open Gantt.</li><li>Select HLS.</li><li>Show all Sprints.</li></ol>', N'<p>Day labels crowd together on narrow columns.</p>', N'<p>Only enough labels should be shown to keep the header readable.</p>', N'<p>Root cause: timeline labels rendered at every day marker even when the available column width was too small.</p>', @SitEnvironment, @MajorSeverity, N'Deployed in Prod', N'High', 100, N'https://intranet.local/pmt/bugs/002', DATEADD(DAY, -8, @Today), DATEADD(DAY, -3, @Today), DATEADD(DAY, -8, @Today), @Sin, NULL),
(@PmtProject, @PmtSprint5, NULL, N'Bug', N'PMT-BUG-003', N'Gantt bug expansion jumps back to current Sprint', N'<p>During a fly-by pause, expanding a task bug row rerenders the chart and jumps back to the selected/current Sprint.</p>', N'<ol><li>Start the Gantt fly-by.</li><li>Wait until the viewport reaches an older Sprint.</li><li>Expand a bug icon.</li></ol>', N'<p>The viewport jumps to the current Sprint instead of staying on the Sprint being reviewed.</p>', N'<p>The bug rows should expand without changing the current scroll position.</p>', N'<p>Root cause: the expansion render path reused the initial Sprint positioning logic instead of preserving the active scroll offset.</p>', @SitEnvironment, @MajorSeverity, N'QA Failed', N'High', 100, N'https://intranet.local/pmt/bugs/003', DATEADD(DAY, 1, @Today), DATEADD(DAY, 6, @Today), DATEADD(DAY, 1, @Today), @Sin, NULL);

DECLARE @PmtBugTheme INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-BUG-001');
DECLARE @PmtBugGanttLabels INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-BUG-002');
DECLARE @PmtBugGanttJump INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-BUG-003');

INSERT INTO [pmt].[WorkTasks]
(
    [ProjectId], [SprintId], [ParentTaskId], [TaskType], [Code], [Title], [DescriptionHtml],
    [Status], [Priority], [PercentCompleted], [Url], [StartDate], [EndDate], [StartedAt],
    [CreatedByUserId], [LinkedBugTaskId], [CreatedAt], [UpdatedAt]
)
VALUES
(@PmtProject, @PmtSprint2, NULL, N'Dev', N'PMT-TASK-010', N'Bug Fix: Dropdown menu stays white in dark theme', N'<p>Style native select options and use the themed background for dropdown menus.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/010', DATEADD(DAY, -36, @Today), DATEADD(DAY, -34, @Today), DATEADD(DAY, -36, @Today), @Sin, @PmtBugTheme, DATEADD(DAY, -36, @Now), DATEADD(DAY, -34, @Now)),
(@PmtProject, @PmtSprint4, NULL, N'Dev', N'PMT-TASK-019', N'Bug Fix: Gantt day labels overlap on compressed timelines', N'<p>Throttle day labels when columns are narrow so the calendar remains readable.</p>', N'Deployed in Prod', N'Low', 100, N'https://intranet.local/pmt/tasks/019', DATEADD(DAY, -7, @Today), DATEADD(DAY, -3, @Today), DATEADD(DAY, -7, @Today), @Sin, @PmtBugGanttLabels, DATEADD(DAY, -7, @Now), DATEADD(DAY, -3, @Now)),
(@PmtProject, @PmtSprint5, NULL, N'Dev', N'PMT-TASK-025', N'Bug Fix: Gantt bug expansion jumps back to current Sprint', N'<p>Preserve the current scroll position when expanding bug details during fly-by review.</p>', N'In Progress', N'Low', 75, N'https://intranet.local/pmt/tasks/025', DATEADD(DAY, 1, @Today), DATEADD(DAY, 6, @Today), DATEADD(DAY, 1, @Today), @Sin, @PmtBugGanttJump, @Now, @Now);

DECLARE @PmtThemeBugFix INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-010');
DECLARE @PmtGanttLabelBugFix INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-019');
DECLARE @PmtGanttJumpBugFix INT = (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-025');

INSERT INTO [pmt].[TaskAssignees] ([TaskId], [UserId], [CreatedByUserId])
SELECT [TaskId], @Bill, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-001', N'PMT-TASK-002', N'PMT-TASK-003', N'PMT-TASK-004', N'PMT-TASK-005', N'PMT-TASK-021', N'PMT-TASK-022')
UNION ALL SELECT [TaskId], @Mark, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-006', N'PMT-TASK-007', N'PMT-TASK-008', N'PMT-TASK-009', N'PMT-TASK-010', N'PMT-TASK-024')
UNION ALL SELECT [TaskId], @Jensen, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-011', N'PMT-TASK-012', N'PMT-TASK-013', N'PMT-TASK-014', N'PMT-TASK-015', N'PMT-TASK-017', N'PMT-TASK-018', N'PMT-TASK-019', N'PMT-TASK-025', N'PMT-TASK-026')
UNION ALL SELECT [TaskId], @Steve, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-TASK-016', N'PMT-TASK-020', N'PMT-TASK-023', N'PMT-BACKLOG-001', N'PMT-BACKLOG-002')
UNION ALL SELECT [TaskId], @Sam, @Sin FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] IN (N'PMT-BUG-001', N'PMT-BUG-002', N'PMT-BUG-003');

INSERT INTO [pmt].[TaskReporters] ([TaskId], [UserId], [CreatedByUserId])
VALUES
(@PmtBugTheme, @Sam, @Sin),
(@PmtBugGanttLabels, @Sam, @Sin),
(@PmtBugGanttJump, @Sam, @Sin);

INSERT INTO [pmt].[TaskDependencies] ([TaskId], [DependsOnTaskId], [CreatedByUserId])
VALUES
(@PmtThemeBugFix, @PmtBugTheme, @Sin),
(@PmtGanttLabelBugFix, @PmtBugGanttLabels, @Sin),
(@PmtGanttJumpBugFix, @PmtBugGanttJump, @Sin),
((SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-024'), (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-006'), @Sin),
((SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-026'), (SELECT [TaskId] FROM [pmt].[WorkTasks] WHERE [ProjectId] = @PmtProject AND [Code] = N'PMT-TASK-018'), @Sin);

-- Parent task progress stays calculated from its sub-tasks.
UPDATE [ParentTask]
SET
    [PercentCompleted] = [ChildAverage].[PercentCompleted],
    [UpdatedByUserId] = @Sin,
    [UpdatedAt] = @Now
FROM [pmt].[WorkTasks] AS [ParentTask]
CROSS APPLY
(
    SELECT CONVERT(INT, ROUND(AVG(CONVERT(DECIMAL(10, 2), [ChildTask].[PercentCompleted])), 0)) AS [PercentCompleted]
    FROM [pmt].[WorkTasks] AS [ChildTask]
    WHERE [ChildTask].[ParentTaskId] = [ParentTask].[TaskId]
      AND [ChildTask].[IsDeleted] = 0
) AS [ChildAverage]
WHERE [ParentTask].[ProjectId] = @PmtProject
  AND [ChildAverage].[PercentCompleted] IS NOT NULL;

;WITH OrderedTasks AS
(
    SELECT
        [TaskId],
        ROW_NUMBER() OVER (ORDER BY ISNULL([StartDate], [CreatedAt]), [TaskId]) AS [RowNumber]
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @PmtProject
      AND [IsDeleted] = 0
)
UPDATE [Task]
SET
    [SortOrder] = [OrderedTasks].[RowNumber] * 10
FROM [pmt].[WorkTasks] AS [Task]
INNER JOIN OrderedTasks
    ON [OrderedTasks].[TaskId] = [Task].[TaskId];

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [ActorUserId], [CreatedByUserId], [CreatedAt]
)
SELECT N'Task', [TaskId], N'Created', [Title], NULL, [Status], NULL, [PercentCompleted], [CreatedByUserId], [CreatedByUserId], @Sin, DATEADD(HOUR, 9, [CreatedAt])
FROM [pmt].[WorkTasks]
WHERE [ProjectId] = @PmtProject;

INSERT INTO [pmt].[AuditEvents]
(
    [EntityType], [EntityId], [Action], [Details], [OldStatus], [NewStatus],
    [OldPercentCompleted], [NewPercentCompleted], [UserId], [ActorUserId], [CreatedByUserId], [CreatedAt]
)
VALUES
(N'Task', @PmtThemeParent, N'Status/Percent Changed', N'Parent percent recalculated from dark-theme sub-tasks.', N'In Progress', N'QA Passed', 50, 100, @Mark, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'QA reproduced the dropdown contrast issue.', N'Todo', N'QA Failed', 0, 100, @Sam, @Sam, @Sin, DATEADD(DAY, -36, @Now)),
(N'Task', @PmtThemeBugFix, N'Status/Percent Changed', N'Developer corrected select option colors.', N'Todo', N'Code Complete', 0, 100, @Mark, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'Bug percent reset to 0 for QA retest.', N'QA Failed', N'QA Failed', 100, 0, @Mark, @Mark, @Sin, DATEADD(DAY, -35, @Now)),
(N'Task', @PmtBugTheme, N'Status/Percent Changed', N'QA passed the themed dropdown retest.', N'QA Failed', N'QA Passed', 0, 100, @Sam, @Sam, @Sin, DATEADD(DAY, -34, @Now)),
(N'Task', @PmtFiltersParent, N'Status/Percent Changed', N'Parent percent recalculated after the filter subtasks passed QA.', N'In Progress', N'QA Passed', 67, 100, @Jensen, @Jensen, @Sin, DATEADD(DAY, -20, @Now)),
(N'Task', @PmtGanttLabelBugFix, N'Status/Percent Changed', N'Developer reduced crowded day labels on compressed timelines.', N'Todo', N'Code Complete', 0, 100, @Jensen, @Jensen, @Sin, DATEADD(DAY, -4, @Now)),
(N'Task', @PmtBugGanttLabels, N'Status/Percent Changed', N'QA passed the Gantt header label retest.', N'QA in Progress', N'QA Passed', 0, 100, @Sam, @Sam, @Sin, DATEADD(DAY, -3, @Now)),
(N'Task', @PmtAuditParent, N'Status/Percent Changed', N'Parent percent recalculated from audit and Development settings sub-tasks.', N'Todo', N'In Progress', 0, 70, @Steve, @Steve, @Sin, @Now),
(N'Task', @PmtBugGanttJump, N'Status/Percent Changed', N'QA failed the fly-by bug expansion behavior and returned it to development.', N'QA in Progress', N'QA Failed', 0, 100, @Sam, @Sam, @Sin, DATEADD(HOUR, 2, @Now)),
(N'Task', @PmtGanttJumpBugFix, N'Status/Percent Changed', N'Developer started preserving the Gantt viewport while expanding bug rows.', N'Todo', N'In Progress', 0, 75, @Jensen, @Jensen, @Sin, DATEADD(HOUR, 3, @Now));

INSERT INTO [pmt].[DevLogs] ([ProjectId], [UserId], [LogDate], [BodyHtml], [IsPinned], [CreatedByUserId])
VALUES
(@PmtProject, @Bill, DATEADD(DAY, -52, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Created the pmt schema and the first stored procedures.</li><li>Seeded the default admin account and starter lookup values.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Wire ADO.NET calls for Projects, Sprints, and Dev Tasks.</li><li>Add seed data for project members and Sprint developers.</li><li>Document the login assumptions for QA.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>Need the final starter-user list before locking the seed script.</li></ul>', 0, @Sin),
(@PmtProject, @Mark, DATEADD(DAY, -39, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Wired the Project, Sprint, and Dev Task ADO.NET calls.</li><li>Added the project member and Sprint developer seed data.</li><li>Carried the login documentation forward for one more review.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Restyle dropdowns and file upload controls for the dark theme.</li><li>Start the Kanban Board drag behavior.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 0, @Sin),
(@PmtProject, @Jensen, DATEADD(DAY, -24, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Restyled the dark-theme dropdowns and file upload controls.</li><li>Finished the first Kanban Board drag pass.</li><li>Left one keyboard-drag polish item for later.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Connect Project and Sprint clicks to filtered views.</li><li>Add the advanced Dev Task filters.</li><li>Prepare QA notes for the filter state behavior.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>Need one more QA pass on filter state.</li></ul>', 0, @Sin),
(@PmtProject, @Steve, DATEADD(DAY, -12, @Today), N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Connected Project and Sprint clicks to the filtered views.</li><li>Added the advanced Dev Task filters.</li><li>Carried one filter-state edge case into the next QA sweep.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Add Holiday maintenance and start Road Map rendering.</li><li>Make Projects and Sprints clickable on the Road Map.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 0, @Sin),
(@PmtProject, @Sin, @Today, N'<p><strong>What did you accomplish yesterday?</strong></p><ul><li>Added Holiday maintenance and Road Map rendering.</li><li>Made Projects and Sprints clickable on the Road Map.</li><li>Verified Development cleanup and seed restore flows.</li></ul><p><strong>What do you plan to do today?</strong></p><ul><li>Add the linked-bug completion guard.</li><li>Wire the theme toggle through the shared shell.</li><li>Review the Scrum starter text and seed data.</li></ul><p><strong>Do you have any roadblocks?</strong></p><ul><li>No blockers.</li></ul>', 1, @Sin);

INSERT INTO [pmt].[Blogs] ([ProjectId], [SprintId], [Title], [BodyHtml], [IsPrivate], [CreatedByUserId], [UpdatedByUserId], [CreatedAt], [UpdatedAt])
VALUES
(
    @PmtProject,
    @PmtSprint1,
    N'PMT Day 1 - Foundation Build and ADO.NET Decision',
    N'<p><img src="/assets/docs/pmt-doc-day01-v2.jpg" alt="PMT foundation diagram showing .NET, ADO.NET, stored procedures, and the pmt schema"></p><p>Day 1 established the core PMT direction: a simple .NET web application, ADO.NET data access, stored procedures, and a dedicated pmt schema for every database object.</p><ul><li>Created the login screen and default Password1 user setup.</li><li>Started the PMT seed data and schema scripts.</li><li>Kept the code intentionally simple for junior developer handoff.</li></ul>',
    0,
    @Sin,
    @Bill,
    DATEADD(DAY, -45, @Now),
    DATEADD(DAY, -44, @Now)
),
(
    @PmtProject,
    @PmtSprint2,
    N'PMT Day 2 - Dark Theme and Kanban Workflow',
    N'<p><img src="/assets/docs/pmt-doc-day02-v2.jpg" alt="Dark theme Kanban Board showing Todo, In Progress, and QA Passed columns"></p><p>The second requirements pass moved PMT away from the original plain layout and into the current dark theme. The Kanban Board gained task creation and status movement.</p><ul><li>Standardized the expanded status workflow.</li><li>Added QA Passed as the sprint completion milestone.</li><li>Cleaned up checkboxes, dropdowns, and dialog focus behavior.</li></ul>',
    0,
    @Mark,
    @Sin,
    DATEADD(DAY, -39, @Now),
    DATEADD(DAY, -38, @Now)
),
(
    @PmtProject,
    @PmtSprint3,
    N'PMT Day 3 - Filters, Scrum, and Documentation',
    N'<p><img src="/assets/docs/pmt-doc-day03-v2.jpg" alt="PMT task filters beside Scrum and Documentation progress cards"></p><p>Day 3 focused on making PMT useful during daily development. The Tasks view gained richer filters, Scrum entries became table rows, and Documentation was seeded for LMS and PMT.</p><ul><li>Added project and sprint filters in Sprints and Dev Tasks.</li><li>Added Scrum placeholders for yesterday, today, and roadblocks.</li><li>Renamed Blogs to Documentation.</li></ul>',
    0,
    @Sam,
    @Mark,
    DATEADD(DAY, -34, @Now),
    DATEADD(DAY, -32, @Now)
),
(
    @PmtProject,
    @PmtSprint4,
    N'PMT Day 4 - Holidays, Gantt, and Road Map',
    N'<p><img src="/assets/docs/pmt-doc-day04-v2.jpg" alt="PMT Gantt chart and Road Map planning view with holiday badges"></p><p>The planning views started to mature on Day 4. PMT added Philippine-friendly holiday maintenance, Gantt non-working-day rules, and the first Road Map view for projects and Sprints.</p><ul><li>Created the Holiday maintenance screen under Settings.</li><li>Skipped weekends and holidays unless work starts on those dates.</li><li>Rendered Project and Sprint bars by start and end dates.</li></ul>',
    0,
    @Jensen,
    @Sin,
    DATEADD(DAY, -28, @Now),
    DATEADD(DAY, -26, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Day 5 - Audit Trails and Seed Expansion',
    N'<p><img src="/assets/docs/pmt-doc-day05-v2.jpg" alt="PMT audit trail timeline and seed expansion progress bars for PMT, LMS, and HLS"></p><p>Day 5 introduced audit logging for Dev Tasks and bugs so status and completion changes tell a clear story during demos and QA reviews.</p><ul><li>Added task and bug audit popups.</li><li>Seeded LMS as a two-year Agile project.</li><li>Seeded HLS as a five-year waterfall-style AI learning project.</li></ul>',
    0,
    @Bill,
    @Sam,
    DATEADD(DAY, -22, @Now),
    DATEADD(DAY, -20, @Now)
),
(
    @PmtProject,
    @PmtSprint4,
    N'PMT Day 6 - Gantt Fly-by and Road Map Optimization',
    N'<p><img src="/assets/docs/pmt-doc-day06-v2.jpg" alt="PMT Gantt chart with fly-by path and Sprint jump controls"></p><p>Day 6 turned the Gantt chart into a better demo surface. Sprint jump, selected Sprint mode, show-all mode, and the fly-by animation made long projects easier to present.</p><ul><li>Added Sprint dropdown and reset behavior.</li><li>Improved fly-by positioning and pause/resume behavior.</li><li>Compressed the Road Map so multi-year projects fit better.</li></ul>',
    0,
    @Steve,
    @Jensen,
    DATEADD(DAY, -16, @Now),
    DATEADD(DAY, -15, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Day 7 - Navigation and Sprint Metrics',
    N'<p><img src="/assets/docs/pmt-doc-day07-v2.jpg" alt="PMT navigation bar and Sprint metric progress bars"></p><p>Day 7 cleaned up the top navigation, moved Settings under the user avatar, and made Sprint cards show status progress bars instead of busy legends.</p><ul><li>Renamed Board to Kanban Board and Tasks to Dev Tasks.</li><li>Moved Users and Holidays into Settings.</li><li>Added expand and collapse behavior for Sprint metric cards.</li></ul>',
    0,
    @Sin,
    @Mark,
    DATEADD(DAY, -10, @Now),
    DATEADD(DAY, -9, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Day 8 - Documentation Card Cleanup',
    N'<p><img src="/assets/docs/pmt-doc-day08-v2.jpg" alt="PMT Documentation cards showing project codes, dates, and right aligned actions"></p><p>Day 8 made Documentation easier to scan. Cards now show project code, created and edited dates, and right-aligned actions with Delete first and Edit last.</p><ul><li>Removed edit count clutter from cards.</li><li>Aligned card actions consistently.</li><li>Kept existing Documentation entries read-only by default.</li></ul>',
    0,
    @Sam,
    NULL,
    DATEADD(DAY, -6, @Now),
    DATEADD(DAY, -6, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Reorder Design Note',
    N'<p><img src="/assets/docs/pmt-doc-reorder-v2.jpg" alt="PMT Kanban drag and drop reorder flow with drop indicator"></p><p>The latest work adds persistent manual ordering for Backlog, Dev Tasks, bugs, and the Kanban Board. Reordering stays intentionally simple: the browser sends the visible item order and the database stores the new SortOrder values.</p><ul><li>Drag within a list to reprioritize work.</li><li>Drag across Kanban columns to change status and order.</li><li>Use Custom order when demonstrating team priority.</li></ul>',
    0,
    @Jensen,
    @Sin,
    DATEADD(DAY, -3, @Now),
    DATEADD(DAY, -2, @Now)
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT Current Demo Readiness',
    N'<p><img src="/assets/docs/pmt-doc-demo-v2.jpg" alt="PMT stakeholder demo dashboard with charts, Road Map, and feature badges"></p><p>PMT is now ready for a stakeholder walkthrough that covers Dashboard flow, Road Map planning, Gantt fly-by, Kanban execution, Bug Tracking, Scrum, Documentation, and Settings.</p><ul><li>Dashboard emphasizes progress first and details on demand.</li><li>Planning views support long-running HLS data.</li><li>Seed data now tells a realistic story across PMT, LMS, and HLS.</li></ul>',
    0,
    @Sin,
    NULL,
    @Now,
    @Now
),
(
    @PmtProject,
    @PmtSprint5,
    N'PMT About 3D Visualization and Flyby',
    N'<p><img src="/assets/docs/pmt-doc-about-3d-flyby-v2.jpg?v=20260715-about-3d-seed" alt="Extruded PMT logo surrounded by golden looped flyby paths with mouse-look and WASD control diagrams"></p><p>The About page turns current PMT data into an interactive 3D gallery. Its automated flyby moves through the PMT logo and project visualizations, while mouse and keyboard controls let the viewer explore the scene.</p><ul><li>Follow the continuous cinematic route through the PMT logo, charts, Documentation, and Kanban views.</li><li>Hold the left mouse button to look around, use the wheel to zoom, and use WASD with Q and E to move.</li><li>Press Space to pause or resume, Enter to restart the sequence, and ? to show the controls.</li></ul>',
    0,
    @Sin,
    NULL,
    @Now,
    @Now
);

DECLARE @PmtCurrentDemoDoc INT = (SELECT [BlogId] FROM [pmt].[Blogs] WHERE [ProjectId] = @PmtProject AND [Title] = N'PMT Current Demo Readiness');
DECLARE @PmtPlanningDoc INT = (SELECT [BlogId] FROM [pmt].[Blogs] WHERE [ProjectId] = @PmtProject AND [Title] = N'PMT Day 4 - Holidays, Gantt, and Road Map');

UPDATE [pmt].[Blogs]
SET [ParentBlogId] = @PmtCurrentDemoDoc
WHERE [ProjectId] = @PmtProject
  AND [Title] IN
(
    N'PMT Day 7 - Navigation and Sprint Metrics',
    N'PMT Day 8 - Documentation Card Cleanup',
    N'PMT Reorder Design Note',
    N'PMT About 3D Visualization and Flyby'
);

UPDATE [pmt].[Blogs]
SET [ParentBlogId] = @PmtPlanningDoc
WHERE [ProjectId] = @PmtProject
  AND [Title] = N'PMT Day 6 - Gantt Fly-by and Road Map Optimization';

INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
SELECT [BlogId], N'Created', [CreatedByUserId], @Sin, [CreatedAt]
FROM [pmt].[Blogs]
WHERE [ProjectId] = @PmtProject;

INSERT INTO [pmt].[BlogHistory] ([BlogId], [Action], [UserId], [CreatedByUserId], [CreatedAt])
SELECT [BlogId], N'Updated', [UpdatedByUserId], @Sin, [UpdatedAt]
FROM [pmt].[Blogs]
WHERE [ProjectId] = @PmtProject
  AND [UpdatedByUserId] IS NOT NULL
  AND [UpdatedAt] > [CreatedAt];

EXEC [pmt].[WriteAudit] N'Seed', @PmtProject, N'Loaded', N'Base PMT seed data was loaded.', @Sin;

COMMIT TRANSACTION;
GO

DECLARE @DatabaseSchemaDiagramNow DATETIME2(0) = SYSUTCDATETIME();
DECLARE @DatabaseSchemaDiagramOwnerId INT =
(
    SELECT [UserId]
    FROM [pmt].[Users]
    WHERE [Email] = N'louiery@gmail.com'
      AND [IsAdmin] = 1
      AND [IsActive] = 1
);

IF @DatabaseSchemaDiagramOwnerId IS NULL
BEGIN
    THROW 51081, 'The PMT database-schema Diagram requires the active Sin administrator.', 1;
END;

-- BEGIN GENERATED PMT DATABASE SCHEMA DIAGRAM
DECLARE @DatabaseSchemaDiagramBodyHtml NVARCHAR(MAX) =
    N'<p><img class="rich-svg-image pmt-annotation-image" src="/assets/docs/pmt-database-schema.svg?v=7d0ac4cf050d" alt="PMT''s Database Schema" data-pmt-diagram="true" data-pmt-private-diagram="true" data-pmt-seeded-diagram="pmt-database-schema-v1" data-pmt-annotation-version="1"></p>';
-- END GENERATED PMT DATABASE SCHEMA DIAGRAM

IF NOT EXISTS
(
    SELECT 1
    FROM [pmt].[Blogs]
    WHERE [Title] = N'PMT''s Database Schema'
      AND [CreatedByUserId] = @DatabaseSchemaDiagramOwnerId
      AND [IsDeleted] = 0
      AND ([BodyHtml] LIKE N'%data-pmt-diagram="true"%'
           OR [BodyHtml] LIKE N'%data-pmt-private-diagram="true"%')
)
BEGIN
    DECLARE @DatabaseSchemaDiagramBlogId INT;

    INSERT INTO [pmt].[Blogs]
    (
        [ProjectId],
        [SprintId],
        [ParentBlogId],
        [Title],
        [BodyHtml],
        [IsPrivate],
        [IsPinned],
        [SortOrder],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt]
    )
    VALUES
    (
        NULL,
        NULL,
        NULL,
        N'PMT''s Database Schema',
        @DatabaseSchemaDiagramBodyHtml,
        0,
        1,
        0,
        @DatabaseSchemaDiagramOwnerId,
        @DatabaseSchemaDiagramOwnerId,
        @DatabaseSchemaDiagramNow,
        @DatabaseSchemaDiagramNow
    );

    SET @DatabaseSchemaDiagramBlogId = SCOPE_IDENTITY();

    INSERT INTO [pmt].[BlogHistory]
    (
        [BlogId],
        [Action],
        [UserId],
        [CreatedByUserId],
        [CreatedAt]
    )
    VALUES
    (
        @DatabaseSchemaDiagramBlogId,
        N'Created',
        @DatabaseSchemaDiagramOwnerId,
        @DatabaseSchemaDiagramOwnerId,
        @DatabaseSchemaDiagramNow
    );
END;
GO

DECLARE @RetainedPmtQaProjectId INT = (SELECT [PmtProjectId] FROM #Pmt122To123State);
DECLARE @NewPmtProjectId INT =
(
    SELECT [ProjectId]
    FROM [pmt].[Projects]
    WHERE [Code] = N'PMT'
      AND [IsArchived] = 0
);

IF @NewPmtProjectId IS NULL
   OR @NewPmtProjectId = @RetainedPmtQaProjectId
   OR NOT EXISTS
      (
          SELECT 1
          FROM [pmt].[Projects]
          WHERE [ProjectId] = @RetainedPmtQaProjectId
            AND [Code] = N'PMTQA'
            AND [IsArchived] = 0
      )
BEGIN
    THROW 51066, 'PMT and PMTQA Project identities could not be verified.', 1;
END;

IF (SELECT COUNT(*) FROM [pmt].[Projects]) <> (SELECT [ProjectCount] + 1 FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[Sprints]) <> (SELECT [SprintCount] + 5 FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks]) <> (SELECT [TaskCount] + 31 FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[Users]) <> (SELECT [UserCount] + (SELECT COUNT(*) FROM #MissingPmtDemoUsers) FROM #Pmt122To123State)
BEGIN
    THROW 51067, 'The expected database-wide PMT demo row-count changes could not be verified.', 1;
END;

IF (SELECT COUNT(*) FROM [pmt].[ProjectMembers] WHERE [ProjectId] = @RetainedPmtQaProjectId) <> (SELECT [PmtMemberCount] FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[Sprints] WHERE [ProjectId] = @RetainedPmtQaProjectId) <> (SELECT [PmtSprintCount] FROM #Pmt122To123State)
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @RetainedPmtQaProjectId) <> (SELECT [PmtTaskCount] FROM #Pmt122To123State)
BEGIN
    THROW 51068, 'The retained PMTQA membership, Sprint, or work-item counts changed unexpectedly.', 1;
END;

IF (SELECT COUNT(*) FROM [pmt].[ProjectMembers] WHERE [ProjectId] = @NewPmtProjectId) <> 6
   OR (SELECT COUNT(*) FROM [pmt].[Sprints] WHERE [ProjectId] = @NewPmtProjectId) <> 5
   OR (SELECT COUNT(*) FROM [pmt].[SprintMembers] AS [Member] INNER JOIN [pmt].[Sprints] AS [Sprint] ON [Sprint].[SprintId] = [Member].[SprintId] WHERE [Sprint].[ProjectId] = @NewPmtProjectId) <> 30
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @NewPmtProjectId) <> 31
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @NewPmtProjectId AND [TaskType] = N'Dev') <> 28
   OR (SELECT COUNT(*) FROM [pmt].[WorkTasks] WHERE [ProjectId] = @NewPmtProjectId AND [TaskType] = N'Bug') <> 3
   OR (SELECT COUNT(*) FROM [pmt].[DevLogs] WHERE [ProjectId] = @NewPmtProjectId AND [LogType] <> N'Log') <> 5
   OR (SELECT COUNT(*) FROM [pmt].[Blogs] WHERE [ProjectId] = @NewPmtProjectId AND [IsPrivate] = 0) <> 11
BEGIN
    THROW 51069, 'The original PMT demo Project content counts could not be verified.', 1;
END;

IF EXISTS
(
    SELECT 1
    FROM [pmt].[Sprints]
    WHERE [ProjectId] = @RetainedPmtQaProjectId
      AND [Code] NOT LIKE N'PMTQA-%'
)
   OR EXISTS
(
    SELECT 1
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @RetainedPmtQaProjectId
      AND [Code] NOT LIKE N'PMTQA-%'
)
   OR EXISTS
(
    SELECT 1
    FROM [pmt].[Sprints]
    WHERE [ProjectId] = @NewPmtProjectId
      AND [Code] NOT LIKE N'PMT-%'
)
   OR EXISTS
(
    SELECT 1
    FROM [pmt].[WorkTasks]
    WHERE [ProjectId] = @NewPmtProjectId
      AND [Code] NOT LIKE N'PMT-%'
)
BEGIN
    THROW 51070, 'PMT or PMTQA child-code prefixes could not be verified.', 1;
END;

IF EXISTS
(
    SELECT [Required].[Email]
    FROM
    (
        VALUES
        (N'louiery@gmail.com'),
        (N'bill.gates@microsoft.com'),
        (N'sam.altman@openai.com'),
        (N'mark.zuckerberg@meta.com'),
        (N'steve.jobs@apple.com'),
        (N'Jensen.Huang@nvidia.com')
    ) AS [Required]([Email])
    LEFT JOIN [pmt].[Users] AS [User]
        ON LOWER(LTRIM(RTRIM([User].[Email]))) = LOWER([Required].[Email])
       AND [User].[IsActive] = 1
    GROUP BY [Required].[Email]
    HAVING COUNT([User].[UserId]) <> 1
)
BEGIN
    THROW 51071, 'The active PMT demo user identities could not be verified.', 1;
END;

IF EXISTS
(
    SELECT 1
    FROM #MissingPmtDemoUsers AS [Missing]
    INNER JOIN [pmt].[Users] AS [User]
        ON LOWER(LTRIM(RTRIM([User].[Email]))) = LOWER([Missing].[Email])
    WHERE [User].[PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), N'Password1'))
)
BEGIN
    THROW 51072, 'A newly recreated PMT demo user has the public default password.', 1;
END;

IF EXISTS
(
    SELECT 1
    FROM [pmt].[WorkTasks] AS [Bug]
    WHERE [Bug].[ProjectId] = @NewPmtProjectId
      AND [Bug].[TaskType] = N'Bug'
      AND
      (
          NOT EXISTS
          (
              SELECT 1
              FROM [pmt].[Lookups] AS [Severity]
              WHERE [Severity].[LookupType] = N'Severity'
                AND [Severity].[Value] = [Bug].[Severity]
                AND [Severity].[IsActive] = 1
          )
          OR NOT EXISTS
          (
              SELECT 1
              FROM [pmt].[Lookups] AS [Environment]
              WHERE [Environment].[LookupType] = N'Environment'
                AND [Environment].[Value] = [Bug].[Environment]
                AND [Environment].[IsActive] = 1
          )
      )
)
BEGIN
    THROW 51073, 'The PMT demo Bug lookup values are not active in the BDO lookup configuration.', 1;
END;

IF EXISTS
(
    SELECT 1
    FROM #Pmt122To123DemoVacations AS [Seed]
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users] AS [User]
        INNER JOIN [pmt].[VacationPlans] AS [Vacation]
            ON [Vacation].[UserId] = [User].[UserId]
           AND [Vacation].[IsCancelled] = 0
           AND [Vacation].[StartDate] <= [Seed].[EndDate]
           AND [Vacation].[EndDate] >= [Seed].[StartDate]
        WHERE LOWER(LTRIM(RTRIM([User].[Email]))) = LOWER([Seed].[Email])
          AND [User].[IsActive] = 1
    )
)
BEGIN
    THROW 51077, 'The PMT, LMS, and HLS demo vacation examples could not be verified.', 1;
END;

IF OBJECT_ID(N'[pmt].[EnsurePmtDemoUsers]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearUsers]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[RequireDevelopmentSeedRestore]', N'P') IS NULL
   OR ISNULL(CHARINDEX(N'[Code] <> N''PMT''', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearProjectData]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'except PMT.', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearProjectData]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'DELETE FROM [pmt].[UserPermissions]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'[ActorUserId] = @AdminUserId', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'50255', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))), 0) > 0
   OR ISNULL(CHARINDEX(N'50257', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[RequireDevelopmentSeedRestore]'))), 0) > 0
BEGIN
    THROW 51074, 'The PMT demo restore or Development reset contract could not be verified.', 1;
END;

IF OBJECT_ID(N'[pmt].[RemoveAttendance]', N'P') IS NULL
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.parameters
          WHERE [object_id] = OBJECT_ID(N'[pmt].[RecordAttendance]')
            AND [name] = N'@AttendanceDate'
            AND TYPE_NAME([user_type_id]) = N'date'
      )
   OR ISNULL(CHARINDEX(N'WHEN @UserId = @CurrentUserId THEN @LocalToday', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[RecordAttendance]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'DELETE FROM [pmt].[AttendanceEntries]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[RemoveAttendance]'))), 0) = 0
BEGIN
    THROW 51076, 'The selected-date or attendance-removal contract could not be verified.', 1;
END;

IF OBJECT_ID(N'[pmt].[UserImageAnnotationTemplateLibraries]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[ImageAnnotationDefaultTemplateLibraries]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[GetUserImageAnnotationTemplateLibrary]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[GetImageAnnotationDefaultTemplateLibrary]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[GetPmtDatabaseSchema]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[SaveUserImageAnnotationTemplateLibrary]', N'P') IS NULL
   OR (SELECT COUNT(*) FROM [pmt].[ImageAnnotationDefaultTemplateLibraries] WHERE [DefaultLibraryId] = 1) <> 1
   OR (SELECT COUNT(*) FROM OPENJSON((SELECT [LibraryJson] FROM [pmt].[ImageAnnotationDefaultTemplateLibraries] WHERE [DefaultLibraryId] = 1), N'$.templates')) <> 13
   OR NOT EXISTS
      (
          SELECT 1
          FROM sys.foreign_keys
          WHERE [name] = N'FK_pmt_UserImageAnnotationTemplateLibraries_User'
            AND [parent_object_id] = OBJECT_ID(N'[pmt].[UserImageAnnotationTemplateLibraries]')
            AND [delete_referential_action] = 1
      )
BEGIN
    THROW 51078, 'The shared default or per-user image annotation template-library contract could not be verified.', 1;
END;

IF COL_LENGTH(N'pmt.Blogs', N'SortOrder') IS NULL
   OR OBJECT_ID(N'[pmt].[MoveBlog]', N'P') IS NULL
   OR (SELECT COUNT(*) FROM sys.parameters WHERE [object_id] = OBJECT_ID(N'[pmt].[MoveBlog]') AND [name] IN (N'@BlogId', N'@ParentBlogId', N'@OrderedBlogIds', N'@CurrentUserId')) <> 4
   OR ISNULL(CHARINDEX(N'ORDER BY [SortOrder], [UpdatedAt] DESC', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[GetAppState]'))), 0) = 0
   OR ISNULL(CHARINDEX(N'MAX([SortOrder])', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertBlog]'))), 0) > 0
   OR ISNULL(CHARINDEX(N'@IsPinned,            0,', REPLACE(REPLACE(OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertBlog]')), CHAR(13), N''), CHAR(10), N'')), 0) = 0
   OR ISNULL(CHARINDEX(N'[NewSortOrder]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[MoveBlog]'))), 0) = 0
BEGIN
    THROW 51080, 'The persistent Diagram hierarchy-order contract could not be verified.', 1;
END;

IF NOT EXISTS
(
    SELECT 1
    FROM [pmt].[Blogs]
    WHERE [Title] = N'PMT''s Database Schema'
      AND [IsPrivate] = 0
      AND [IsPinned] = 1
      AND [IsDeleted] = 0
      AND [BodyHtml] LIKE N'%data-pmt-seeded-diagram="pmt-database-schema-v1"%'
)
BEGIN
    THROW 51082, 'The PMT public database-schema Diagram seed could not be verified.', 1;
END;

EXEC sys.sp_updateextendedproperty
    @name = N'PMT_DatabaseVersion',
    @value = N'1.23';

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.23'
)
BEGIN
    THROW 51075, 'PMT Database Version 1.23 could not be verified.', 1;
END;

COMMIT TRANSACTION;
GO

PRINT N'PMT Database Version 1.23 applied: PMTQA was preserved, the PMT demo and shared demo vacations were restored, Development resets were updated, selected-date attendance plus audited attendance removal are available, shared default plus per-user image annotation template libraries are synchronized through SQL, Diagram hierarchy order is persistent, the public PMT database-schema Diagram is seeded, and live PMT schema metadata is available for Diagram generation.';
GO
