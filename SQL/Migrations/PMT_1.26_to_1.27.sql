/*
    PMT Database Version 1.26 -> 1.27

    Adds user Suggestions, GUID-based anonymous public read-only Document/Diagram links,
    linked Dev/Bug rollback behavior when QA has not touched the linked Bug,
    and Suggestion/public-link-safe development user cleanup.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'pmt') IS NULL
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WriteAudit]', N'P') IS NULL
BEGIN
    THROW 51150, 'PMT Database Version 1.26 objects are required before applying Version 1.27.', 1;
END;

DECLARE @CurrentDatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@CurrentDatabaseVersion, N'') NOT IN (N'1.26', N'1.27')
BEGIN
    THROW 51151, 'PMT Database Version 1.26 is required before applying Version 1.27.', 1;
END;
GO

IF OBJECT_ID(N'[pmt].[Suggestions]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[Suggestions]
    (
        [SuggestionId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_Suggestions] PRIMARY KEY,
        [BodyHtml] NVARCHAR(MAX) NOT NULL,
        [Status] NVARCHAR(40) NOT NULL CONSTRAINT [DF_pmt_Suggestions_Status] DEFAULT (N'New'),
        [CreatedByUserId] INT NOT NULL,
        [UpdatedByUserId] INT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Suggestions_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_Suggestions_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [FK_pmt_Suggestions_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_Suggestions_UpdatedBy] FOREIGN KEY ([UpdatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [CK_pmt_Suggestions_BodyHtml] CHECK (LEN(LTRIM(RTRIM([BodyHtml]))) > 0),
        CONSTRAINT [CK_pmt_Suggestions_Status] CHECK (LEN(LTRIM(RTRIM([Status]))) > 0)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_Suggestions_CreatedAt' AND [object_id] = OBJECT_ID(N'[pmt].[Suggestions]'))
BEGIN
    CREATE INDEX [IX_pmt_Suggestions_CreatedAt] ON [pmt].[Suggestions]([CreatedAt] DESC);
END;
GO

IF OBJECT_ID(N'[pmt].[PublicBlogLinks]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[PublicBlogLinks]
    (
        [PublicBlogLinkId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_PublicBlogLinks] PRIMARY KEY,
        [BlogId] INT NOT NULL,
        [Token] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_pmt_PublicBlogLinks_Token] DEFAULT (NEWID()),
        [ExpiresAt] DATETIME2(0) NULL,
        [LastAccessedAt] DATETIME2(0) NULL,
        [CreatedByUserId] INT NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_PublicBlogLinks_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_PublicBlogLinks_Blog] FOREIGN KEY ([BlogId]) REFERENCES [pmt].[Blogs]([BlogId]),
        CONSTRAINT [FK_pmt_PublicBlogLinks_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [UQ_pmt_PublicBlogLinks_Token] UNIQUE ([Token])
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_PublicBlogLinks_BlogExpires' AND [object_id] = OBJECT_ID(N'[pmt].[PublicBlogLinks]'))
BEGIN
    CREATE INDEX [IX_pmt_PublicBlogLinks_BlogExpires] ON [pmt].[PublicBlogLinks]([BlogId], [ExpiresAt]);
END;
GO
CREATE OR ALTER PROCEDURE [pmt].[UpsertSuggestion]
    @SuggestionId INT OUTPUT,
    @BodyHtml NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SET @BodyHtml = NULLIF(LTRIM(RTRIM(@BodyHtml)), N'');

    IF @BodyHtml IS NULL
    BEGIN
        THROW 51140, 'Suggestion text is required.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        THROW 51141, 'The suggestion user was not found or is inactive.', 1;
    END;

    IF @SuggestionId = 0
    BEGIN
        INSERT INTO [pmt].[Suggestions]
        (
            [BodyHtml],
            [CreatedByUserId],
            [UpdatedByUserId],
            [UpdatedAt]
        )
        VALUES
        (
            @BodyHtml,
            @CurrentUserId,
            @CurrentUserId,
            SYSUTCDATETIME()
        );

        SET @SuggestionId = CONVERT(INT, SCOPE_IDENTITY());

        EXEC [pmt].[WriteAudit]
            N'Suggestion',
            @SuggestionId,
            N'Created',
            N'PMT suggestion submitted.',
            @CurrentUserId;

        RETURN;
    END;

    DECLARE @OwnerUserId INT;
    SELECT @OwnerUserId = [CreatedByUserId]
    FROM [pmt].[Suggestions]
    WHERE [SuggestionId] = @SuggestionId;

    IF @OwnerUserId IS NULL
    BEGIN
        THROW 51143, 'Suggestion was not found.', 1;
    END;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0 AND @OwnerUserId <> @CurrentUserId
    BEGIN
        THROW 51145, 'You can only update your own suggestions.', 1;
    END;

    UPDATE [pmt].[Suggestions]
    SET
        [BodyHtml] = @BodyHtml,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [SuggestionId] = @SuggestionId;

    EXEC [pmt].[WriteAudit]
        N'Suggestion',
        @SuggestionId,
        N'Updated',
        N'PMT suggestion updated.',
        @CurrentUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AddSuggestion]
    @BodyHtml NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SuggestionId INT = 0;
    EXEC [pmt].[UpsertSuggestion]
        @SuggestionId = @SuggestionId OUTPUT,
        @BodyHtml = @BodyHtml,
        @CurrentUserId = @CurrentUserId;

    SELECT [SuggestionId] = @SuggestionId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetSuggestions]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [SuggestionId],
        [BodyHtml],
        [Status],
        [CreatedByUserId],
        [UpdatedByUserId],
        [CreatedAt],
        [UpdatedAt],
        CONVERT(VARBINARY(8), [RowVersion]) AS [RowVersion]
    FROM [pmt].[Suggestions]
    ORDER BY [CreatedAt] DESC, [SuggestionId] DESC;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[LockEditVersion]
    @EntityType NVARCHAR(40),
    @EntityKey NVARCHAR(80)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @EntityId INT = TRY_CONVERT(INT, @EntityKey);
    DECLARE @RowVersion VARBINARY(8);

    IF @EntityType = N'User'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Users] WITH (UPDLOCK, HOLDLOCK) WHERE [UserId] = @EntityId AND [IsActive] = 1;
    ELSE IF @EntityType = N'Project'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK) WHERE [ProjectId] = @EntityId AND [IsArchived] = 0;
    ELSE IF @EntityType = N'Sprint'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Sprints] WITH (UPDLOCK, HOLDLOCK) WHERE [SprintId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'WorkTask'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[WorkTasks] WITH (UPDLOCK, HOLDLOCK) WHERE [TaskId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'DevLog'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[DevLogs] WITH (UPDLOCK, HOLDLOCK) WHERE [DevLogId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'Suggestion'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Suggestions] WITH (UPDLOCK, HOLDLOCK) WHERE [SuggestionId] = @EntityId;
    ELSE IF @EntityType = N'Blog'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK) WHERE [BlogId] = @EntityId AND [IsDeleted] = 0;
    ELSE IF @EntityType = N'Lookup'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Lookups] WITH (UPDLOCK, HOLDLOCK) WHERE [LookupId] = @EntityId;
    ELSE IF @EntityType = N'Holiday'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[Holidays] WITH (UPDLOCK, HOLDLOCK) WHERE [HolidayId] = @EntityId;
    ELSE IF @EntityType = N'WfhSchedule'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[WfhSchedules] WITH (UPDLOCK, HOLDLOCK) WHERE [UserId] = @EntityId;
    ELSE IF @EntityType = N'Vacation'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[VacationPlans] WITH (UPDLOCK, HOLDLOCK) WHERE [VacationPlanId] = @EntityId AND [IsCancelled] = 0;
    ELSE IF @EntityType = N'SecurityResource'
        SELECT @RowVersion = [RowVersion] FROM [pmt].[SecurityResources] WITH (UPDLOCK, HOLDLOCK) WHERE [ResourceKey] = @EntityKey;
    ELSE
        THROW 51001, 'The edit-version entity type is invalid.', 1;

    SELECT [RowVersion] = @RowVersion;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[CreatePublicBlogLink]
    @BlogId INT,
    @DurationDays INT = NULL,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @DurationDays IS NOT NULL AND @DurationDays NOT IN (15, 30, 60, 90)
    BEGIN
        THROW 51154, 'Public link duration must be forever, 15, 30, 60, or 90 days.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        THROW 51155, 'The public link user was not found or is inactive.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs]
        WHERE [BlogId] = @BlogId
          AND [IsDeleted] = 0
          AND [IsPrivate] = 0
    )
    BEGIN
        THROW 51156, 'Only public documents and diagrams can be shared with a public link.', 1;
    END;

    DECLARE @Token UNIQUEIDENTIFIER = NEWID();
    WHILE EXISTS (SELECT 1 FROM [pmt].[PublicBlogLinks] WHERE [Token] = @Token)
    BEGIN
        SET @Token = NEWID();
    END;

    DECLARE @ExpiresAt DATETIME2(0) = CASE
        WHEN @DurationDays IS NULL THEN NULL
        ELSE DATEADD(DAY, @DurationDays, SYSUTCDATETIME())
    END;

    INSERT INTO [pmt].[PublicBlogLinks]
    (
        [BlogId],
        [Token],
        [ExpiresAt],
        [CreatedByUserId]
    )
    VALUES
    (
        @BlogId,
        @Token,
        @ExpiresAt,
        @CurrentUserId
    );

    SELECT [Token] = @Token, [ExpiresAt] = @ExpiresAt;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetPublicBlog]
    @Token UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    UPDATE [Link]
    SET [LastAccessedAt] = @Now
    FROM [pmt].[PublicBlogLinks] AS [Link]
    INNER JOIN [pmt].[Blogs] AS [Blog]
        ON [Blog].[BlogId] = [Link].[BlogId]
    WHERE [Link].[Token] = @Token
      AND ([Link].[ExpiresAt] IS NULL OR [Link].[ExpiresAt] >= @Now)
      AND [Blog].[IsDeleted] = 0
      AND [Blog].[IsPrivate] = 0;

    SELECT
        [Blog].[BlogId],
        [Blog].[ProjectId],
        [Blog].[SprintId],
        [Blog].[ParentBlogId],
        [Blog].[Title],
        [Blog].[BodyHtml],
        [Blog].[IsPrivate],
        [Blog].[IsPinned],
        [Blog].[SortOrder],
        [Blog].[CreatedByUserId],
        [Blog].[CreatedAt],
        [Blog].[UpdatedAt]
    FROM [pmt].[PublicBlogLinks] AS [Link]
    INNER JOIN [pmt].[Blogs] AS [Blog]
        ON [Blog].[BlogId] = [Link].[BlogId]
    WHERE [Link].[Token] = @Token
      AND ([Link].[ExpiresAt] IS NULL OR [Link].[ExpiresAt] >= @Now)
      AND [Blog].[IsDeleted] = 0
      AND [Blog].[IsPrivate] = 0;

    SELECT
        [Attachment].[AttachmentId],
        [Attachment].[FileName],
        [Attachment].[Url],
        [Attachment].[ContentType],
        [Attachment].[ByteLength],
        [Attachment].[UploadedByUserId],
        [Attachment].[CreatedAt]
    FROM [pmt].[PublicBlogLinks] AS [Link]
    INNER JOIN [pmt].[Blogs] AS [Blog]
        ON [Blog].[BlogId] = [Link].[BlogId]
    INNER JOIN [pmt].[BlogAttachments] AS [BlogAttachment]
        ON [BlogAttachment].[BlogId] = [Blog].[BlogId]
    INNER JOIN [pmt].[Attachments] AS [Attachment]
        ON [Attachment].[AttachmentId] = [BlogAttachment].[AttachmentId]
    WHERE [Link].[Token] = @Token
      AND ([Link].[ExpiresAt] IS NULL OR [Link].[ExpiresAt] >= @Now)
      AND [Blog].[IsDeleted] = 0
      AND [Blog].[IsPrivate] = 0
    ORDER BY [Attachment].[CreatedAt] DESC;
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

    -- If the developer pulls work back before QA has touched the linked Bug,
    -- keep the Bug out of QA's queue too. A QA edit changes UpdatedByUserId,
    -- so this will not overwrite QA's later status.
    IF @TaskType = N'Dev'
       AND @OldStatus = N'Ready for QA'
       AND @Status = N'In Progress'
    BEGIN
        SET @LinkedBugToRetestId = @ExistingLinkedBugTaskId;

        IF @LinkedBugToRetestId IS NULL
        BEGIN
            SELECT TOP (1) @LinkedBugToRetestId = [BugTask].[TaskId]
            FROM [pmt].[WorkTasks] AS [BugTask]
            WHERE [BugTask].[TaskType] = N'Bug'
              AND [BugTask].[IsDeleted] = 0
              AND
              (
                  EXISTS
                  (
                      SELECT 1
                      FROM [pmt].[SplitIds](@DependencyTaskIdsCsv) AS [Ids]
                      WHERE [Ids].[Id] = [BugTask].[TaskId]
                  )
                  OR EXISTS
                  (
                      SELECT 1
                      FROM [pmt].[TaskDependencies] AS [Dependency]
                      WHERE [Dependency].[TaskId] = @TaskId
                        AND [Dependency].[DependsOnTaskId] = [BugTask].[TaskId]
                  )
              )
            ORDER BY [BugTask].[TaskId];
        END;

        IF @LinkedBugToRetestId IS NOT NULL
        BEGIN
            SELECT
                @LinkedOldStatus = [Status],
                @LinkedOldPercentCompleted = [PercentCompleted]
            FROM [pmt].[WorkTasks]
            WHERE [TaskId] = @LinkedBugToRetestId
              AND [TaskType] = N'Bug'
              AND [IsDeleted] = 0
              AND [Status] = N'Ready for QA'
              AND [UpdatedByUserId] = @CurrentUserId;

            IF @LinkedOldStatus = N'Ready for QA'
            BEGIN
                SET @LinkedNewStatus = N'In Progress';
                SET @LinkedNewPercentCompleted = 50;

                UPDATE [pmt].[WorkTasks]
                SET
                    [Status] = @LinkedNewStatus,
                    [PercentCompleted] = @LinkedNewPercentCompleted,
                    [UpdatedByUserId] = @CurrentUserId,
                    [UpdatedAt] = @Now
                WHERE [TaskId] = @LinkedBugToRetestId;

                SET @AuditDetails =
                    N'Linked Dev Task returned to In Progress before QA updates; Bug status/percent updated: ' +
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
    IF OBJECT_ID(N'[pmt].[PublicBlogLinks]', N'U') IS NOT NULL
    BEGIN
        UPDATE [pmt].[PublicBlogLinks] SET [CreatedByUserId] = @AdminUserId;
    END;
    IF OBJECT_ID(N'[pmt].[Suggestions]', N'U') IS NOT NULL
    BEGIN
        UPDATE [pmt].[Suggestions] SET [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
    END;
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

DECLARE @TargetDatabaseVersion NVARCHAR(20) = N'1.27';

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
        @value = @TargetDatabaseVersion;
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = @TargetDatabaseVersion;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.27'
)
BEGIN
    THROW 51152, 'PMT Database Version 1.27 could not be verified.', 1;
END;

IF OBJECT_ID(N'[pmt].[Suggestions]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[PublicBlogLinks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[AddSuggestion]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertSuggestion]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[GetSuggestions]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[CreatePublicBlogLink]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[GetPublicBlog]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertTask]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[DevelopmentClearUsers]', N'P') IS NULL
BEGIN
    THROW 51153, 'PMT Database Version 1.27 objects could not be verified.', 1;
END;

PRINT N'PMT Database Version 1.27 migration completed.';
GO
