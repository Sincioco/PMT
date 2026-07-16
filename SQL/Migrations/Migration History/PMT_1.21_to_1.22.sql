/*
    PMT Database Version 1.21 -> 1.22

    Records the last successful credential or invitation login without touching
    the Users ROWVERSION, and preserves an administrator's configured Role.
    Existing administrators whose Role was previously forced to Admin receive
    the former UI fallback Role of Developer.
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
   OR OBJECT_ID(N'[pmt].[Users]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[UpsertUser]', N'P') IS NULL
BEGIN
    THROW 51055, 'PMT Database Version 1.21 user objects are required before applying Version 1.22.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') NOT IN (N'1.21', N'1.22')
BEGIN
    THROW 51056, 'PMT Database Version 1.21 is required before applying Version 1.22.', 1;
END;
GO

IF OBJECT_ID(N'[pmt].[UserLoginActivity]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserLoginActivity]
    (
        [UserId] INT NOT NULL CONSTRAINT [PK_pmt_UserLoginActivity] PRIMARY KEY,
        [LastLoginAt] DATETIME2(0) NOT NULL,
        CONSTRAINT [FK_pmt_UserLoginActivity_User] FOREIGN KEY ([UserId])
            REFERENCES [pmt].[Users]([UserId]) ON DELETE CASCADE
    );
END;
GO

-- Earlier saves replaced an administrator's selected Role with Admin. That
-- value did not retain a distinct configured title, so use the old UI fallback.
UPDATE [pmt].[Users]
SET [Role] = N'Developer'
WHERE [IsAdmin] = 1
  AND [Role] = N'Admin';
GO

CREATE OR ALTER PROCEDURE [pmt].[RecordSuccessfulLogin]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @UserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 51058, 'An active user is required to record a successful login.', 1;
    END;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    BEGIN TRANSACTION;

    UPDATE [pmt].[UserLoginActivity] WITH (UPDLOCK, HOLDLOCK)
    SET [LastLoginAt] = @Now
    WHERE [UserId] = @UserId;

    IF @@ROWCOUNT = 0
    BEGIN
        INSERT INTO [pmt].[UserLoginActivity] ([UserId], [LastLoginAt])
        VALUES (@UserId, @Now);
    END;

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetUserLastLogins]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [User].[UserId],
        [LoginActivity].[LastLoginAt]
    FROM [pmt].[Users] AS [User]
    LEFT JOIN [pmt].[UserLoginActivity] AS [LoginActivity]
        ON [LoginActivity].[UserId] = [User].[UserId]
    WHERE [User].[IsActive] = 1
    ORDER BY [User].[UserId];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertUser]
    @UserId INT OUTPUT,
    @FirstName NVARCHAR(80),
    @LastName NVARCHAR(80),
    @Nickname NVARCHAR(80),
    @Email NVARCHAR(180),
    @Phone NVARCHAR(60),
    @AvatarUrl NVARCHAR(500),
    @HomePageUrl NVARCHAR(500),
    @SocialMediaUrl NVARCHAR(500),
    @Bio NVARCHAR(MAX),
    @IsAdmin BIT,
    @Role NVARCHAR(20),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @ExistingUserCount INT;
    DECLARE @CurrentUserIsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    SET @FirstName = ISNULL(NULLIF(LTRIM(RTRIM(@FirstName)), N''), N'New');
    SET @LastName = ISNULL(NULLIF(LTRIM(RTRIM(@LastName)), N''), N'User');
    SET @Nickname = NULLIF(LTRIM(RTRIM(@Nickname)), N'');
    SET @Role = ISNULL(NULLIF(LTRIM(RTRIM(@Role)), N''), N'Developer');

    IF @Nickname IS NULL
    BEGIN
        THROW 50054, 'Username is required.', 1;
    END;

    IF LEN(@Nickname) > 80
    BEGIN
        THROW 50054, 'Username cannot exceed 80 characters.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [IsActive] = 1
          AND [UserId] <> @UserId
          AND
          (
              LOWER(LTRIM(RTRIM([Nickname]))) = LOWER(@Nickname)
              OR LOWER(LTRIM(RTRIM(ISNULL([Email], N'')))) = LOWER(@Nickname)
          )
    )
    BEGIN
        THROW 50055, 'That username is already in use. Choose another username.', 1;
    END;

    IF @Role = N'Admin'
       OR NOT EXISTS
       (
           SELECT 1
           FROM [pmt].[Lookups]
           WHERE [LookupType] = N'Role'
             AND [Code] = @Role
             AND
             (
                 [IsActive] = 1
                 OR EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[Users]
                     WHERE [UserId] = @UserId
                       AND [Role] = @Role
                 )
             )
       )
    BEGIN
        SET @Role = N'Developer';
    END;

    SELECT @ExistingUserCount = COUNT(*)
    FROM [pmt].[Users]
    WHERE [IsActive] = 1;

    IF @UserId = 0
    BEGIN
        IF @ExistingUserCount > 0 AND @CurrentUserIsAdmin = 0
        BEGIN
            THROW 50050, 'Only administrators can create users.', 1;
        END;

        INSERT INTO [pmt].[Users]
        (
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
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @FirstName,
            @LastName,
            @Nickname,
            @Email,
            @Phone,
            @AvatarUrl,
            @HomePageUrl,
            @SocialMediaUrl,
            @Bio,
            @IsAdmin,
            @Role,
            @CurrentUserId,
            @Now,
            @Now
        );

        SET @UserId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'User', @UserId, N'Created', @Nickname, @CurrentUserId;
    END
    ELSE
    BEGIN
        IF @CurrentUserIsAdmin = 0 AND @CurrentUserId <> @UserId
        BEGIN
            THROW 50051, 'You cannot edit this user.', 1;
        END;

        IF @CurrentUserIsAdmin = 0
        BEGIN
            SELECT @IsAdmin = [IsAdmin]
            FROM [pmt].[Users]
            WHERE [UserId] = @UserId;

            SELECT @Role = [Role]
            FROM [pmt].[Users]
            WHERE [UserId] = @UserId;
        END;

        UPDATE [pmt].[Users]
        SET
            [FirstName] = @FirstName,
            [LastName] = @LastName,
            [Nickname] = @Nickname,
            [Email] = @Email,
            [Phone] = @Phone,
            [AvatarUrl] = @AvatarUrl,
            [HomePageUrl] = @HomePageUrl,
            [SocialMediaUrl] = @SocialMediaUrl,
            [Bio] = @Bio,
            [IsAdmin] = @IsAdmin,
            [Role] = @Role,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = @Now
        WHERE [UserId] = @UserId
          AND [IsActive] = 1;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50052, 'User was not found.', 1;
        END;

        EXEC [pmt].[WriteAudit] N'User', @UserId, N'Updated', @Nickname, @CurrentUserId;
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
    UPDATE [pmt].[AuditEvents] SET [UserId] = @AdminUserId, [CreatedByUserId] = @AdminUserId, [UpdatedByUserId] = @AdminUserId;
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
            @value = N'1.22';
    END
    ELSE
    BEGIN
        EXEC sys.sp_addextendedproperty
            @name = N'PMT_DatabaseVersion',
            @value = N'1.22';
    END;

    IF OBJECT_ID(N'[pmt].[UserLoginActivity]', N'U') IS NULL
       OR OBJECT_ID(N'[pmt].[RecordSuccessfulLogin]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[GetUserLastLogins]', N'P') IS NULL
       OR ISNULL(CHARINDEX(N'[pmt].[UserLoginActivity]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[RecordSuccessfulLogin]'))), 0) = 0
       OR ISNULL(CHARINDEX(N'IF @IsAdmin = 1', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[UpsertUser]'))), 0) > 0
       OR ISNULL(CHARINDEX(N'[Role] = N''Admin''', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[DevelopmentClearUsers]'))), 0) > 0
       OR EXISTS
          (
              SELECT 1
              FROM [pmt].[Users]
              WHERE [IsAdmin] = 1
                AND [Role] = N'Admin'
          )
       OR NOT EXISTS
          (
              SELECT 1
              FROM sys.extended_properties
              WHERE [class] = 0
                AND [name] = N'PMT_DatabaseVersion'
                AND CONVERT(NVARCHAR(20), [value]) = N'1.22'
          )
    BEGIN
        THROW 51057, 'PMT Version 1.22 login activity and administrator Role contract could not be verified.', 1;
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

PRINT N'PMT Database Version 1.22 applied: successful logins are recorded without changing user ROWVERSION values, and administrator Roles are preserved.';
GO
