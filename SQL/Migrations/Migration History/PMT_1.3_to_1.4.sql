/*
    PMT_1.3_to_1.4.sql

    Purpose:
    Adds reusable, expiring user invitations, their selected projects, and
    username availability suggestions for invitation and user-profile forms.
    Invitation tokens are stored only as SHA-256 hashes. Accepting an invitation
    creates a non-admin Developer and adds that user to every invited project.

    This migration is standalone and safe to rerun. It does not rebuild PMT or
    delete existing user data.
*/

USE [PMT];
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_pmt_ProjectMembers_UserId'
      AND [object_id] = OBJECT_ID(N'[pmt].[ProjectMembers]')
)
BEGIN
    CREATE INDEX [IX_pmt_ProjectMembers_UserId]
        ON [pmt].[ProjectMembers]([UserId], [ProjectId]);
END;
GO

IF OBJECT_ID(N'[pmt].[UserInvitations]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserInvitations]
    (
        [UserInvitationId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_UserInvitations] PRIMARY KEY,
        [TokenHash] VARBINARY(32) NOT NULL,
        [ExpiresAt] DATETIME2(0) NOT NULL,
        [CreatedByUserId] INT NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserInvitations_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [FK_pmt_UserInvitations_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [pmt].[Users]([UserId]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_pmt_UserInvitations_TokenHash'
      AND [object_id] = OBJECT_ID(N'[pmt].[UserInvitations]')
)
BEGIN
    CREATE UNIQUE INDEX [UX_pmt_UserInvitations_TokenHash]
        ON [pmt].[UserInvitations]([TokenHash]);
END;
GO

IF OBJECT_ID(N'[pmt].[UserInvitationProjects]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserInvitationProjects]
    (
        [UserInvitationId] INT NOT NULL,
        [ProjectId] INT NOT NULL,
        [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_UserInvitationProjects_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_pmt_UserInvitationProjects] PRIMARY KEY ([UserInvitationId], [ProjectId]),
        CONSTRAINT [FK_pmt_UserInvitationProjects_Invitation] FOREIGN KEY ([UserInvitationId]) REFERENCES [pmt].[UserInvitations]([UserInvitationId]) ON DELETE CASCADE,
        CONSTRAINT [FK_pmt_UserInvitationProjects_Project] FOREIGN KEY ([ProjectId]) REFERENCES [pmt].[Projects]([ProjectId]) ON DELETE CASCADE
    );
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[CreateUserInvitation]
    @TokenHash VARBINARY(32),
    @ProjectIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF DATALENGTH(@TokenHash) <> 32
    BEGIN
        THROW 50200, 'Invitation token is invalid.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [UserId] = @CurrentUserId
          AND [IsActive] = 1
    )
    BEGIN
        THROW 50201, 'A signed-in active user is required to create an invitation.', 1;
    END;

    DECLARE @RequestedProjects TABLE ([ProjectId] INT NOT NULL PRIMARY KEY);
    INSERT INTO @RequestedProjects ([ProjectId])
    SELECT [Id]
    FROM [pmt].[SplitIds](@ProjectIdsCsv)
    WHERE [Id] > 0;

    IF NOT EXISTS (SELECT 1 FROM @RequestedProjects)
    BEGIN
        THROW 50202, 'Select at least one project.', 1;
    END;

    DECLARE @CurrentUserIsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);
    IF EXISTS
    (
        SELECT 1
        FROM @RequestedProjects AS [Requested]
        LEFT JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [Requested].[ProjectId]
           AND [Project].[IsArchived] = 0
        WHERE [Project].[ProjectId] IS NULL
           OR
           (
               @CurrentUserIsAdmin = 0
               AND NOT EXISTS
               (
                   SELECT 1
                   FROM [pmt].[ProjectMembers]
                   WHERE [ProjectId] = [Requested].[ProjectId]
                     AND [UserId] = @CurrentUserId
               )
           )
    )
    BEGIN
        THROW 50203, 'You can invite users only to active projects you belong to.', 1;
    END;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @ExpiresAt DATETIME2(0) = DATEADD(DAY, 30, @Now);
    DECLARE @UserInvitationId INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO [pmt].[UserInvitations]
        (
            [TokenHash],
            [ExpiresAt],
            [CreatedByUserId],
            [CreatedAt]
        )
        VALUES
        (
            @TokenHash,
            @ExpiresAt,
            @CurrentUserId,
            @Now
        );

        SET @UserInvitationId = SCOPE_IDENTITY();

        INSERT INTO [pmt].[UserInvitationProjects] ([UserInvitationId], [ProjectId], [CreatedAt])
        SELECT @UserInvitationId, [ProjectId], @Now
        FROM @RequestedProjects;

        EXEC [pmt].[WriteAudit]
            N'User Invitation',
            @UserInvitationId,
            N'Created',
            N'User invitation created.',
            @CurrentUserId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0
        BEGIN
            ROLLBACK TRANSACTION;
        END;

        THROW;
    END CATCH;

    SELECT [ExpiresAt] = @ExpiresAt;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetUserInvitation]
    @TokenHash VARBINARY(32)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserInvitationId INT;

    SELECT @UserInvitationId = [UserInvitationId]
    FROM [pmt].[UserInvitations] AS [Invitation]
    WHERE [Invitation].[TokenHash] = @TokenHash
      AND [Invitation].[ExpiresAt] > SYSUTCDATETIME()
      AND EXISTS
      (
          SELECT 1
          FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
          INNER JOIN [pmt].[Projects] AS [Project]
              ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
             AND [Project].[IsArchived] = 0
          WHERE [InvitationProject].[UserInvitationId] = [Invitation].[UserInvitationId]
      );

    SELECT [ExpiresAt]
    FROM [pmt].[UserInvitations]
    WHERE [UserInvitationId] = @UserInvitationId;

    SELECT
        [Project].[ProjectId],
        [Project].[Code],
        [Project].[Title],
        [Project].[IconUrl]
    FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
    INNER JOIN [pmt].[Projects] AS [Project]
        ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
       AND [Project].[IsArchived] = 0
    WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId
    ORDER BY [Project].[Title], [Project].[Code];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[SuggestUsername]
    @PreferredUsername NVARCHAR(80),
    @ExcludeUserId INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @BaseUsername NVARCHAR(80) = LEFT(ISNULL(NULLIF(LTRIM(RTRIM(@PreferredUsername)), N''), N'User'), 80);
    DECLARE @Username NVARCHAR(80) = @BaseUsername;
    DECLARE @Suffix INT = 2;
    DECLARE @SuffixText NVARCHAR(10);

    WHILE EXISTS
    (
        SELECT 1
        FROM [pmt].[Users]
        WHERE [IsActive] = 1
          AND [UserId] <> ISNULL(@ExcludeUserId, 0)
          AND
          (
              LOWER(LTRIM(RTRIM([Nickname]))) = LOWER(@Username)
              OR LOWER(LTRIM(RTRIM(ISNULL([Email], N'')))) = LOWER(@Username)
          )
    )
    BEGIN
        SET @SuffixText = CONVERT(NVARCHAR(10), @Suffix);
        SET @Username = LEFT(@BaseUsername, 80 - LEN(@SuffixText)) + @SuffixText;
        SET @Suffix += 1;
    END;

    SELECT
        [Username] = @Username,
        [IsAvailable] = CONVERT(BIT, CASE WHEN LOWER(@Username) = LOWER(@BaseUsername) THEN 1 ELSE 0 END);
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AcceptUserInvitation]
    @TokenHash VARBINARY(32),
    @Nickname NVARCHAR(80),
    @Password NVARCHAR(4000),
    @AvatarUrl NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SET @Nickname = NULLIF(LTRIM(RTRIM(@Nickname)), N'');
    SET @AvatarUrl = NULLIF(LTRIM(RTRIM(@AvatarUrl)), N'');

    IF @Nickname IS NULL
    BEGIN
        THROW 50204, 'Username is required.', 1;
    END;

    IF LEN(@Nickname) > 80
    BEGIN
        THROW 50204, 'Username cannot exceed 80 characters.', 1;
    END;

    IF LEN(ISNULL(@Password, N'')) < 8
    BEGIN
        THROW 50205, 'Password must be at least 8 characters.', 1;
    END;

    IF @AvatarUrl IS NULL
    BEGIN
        THROW 50206, 'Select or upload an avatar before continuing.', 1;
    END;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @UserInvitationId INT;
    DECLARE @InvitedByUserId INT;
    DECLARE @UserId INT;
    DECLARE @ProjectCount INT;
    DECLARE @OnlyProjectId INT;
    DECLARE @NextView NVARCHAR(20) = N'Projects';

    BEGIN TRY
        BEGIN TRANSACTION;

        SELECT
            @UserInvitationId = [UserInvitationId],
            @InvitedByUserId = [CreatedByUserId]
        FROM [pmt].[UserInvitations] WITH (UPDLOCK, HOLDLOCK)
        WHERE [TokenHash] = @TokenHash
          AND [ExpiresAt] > @Now;

        IF @UserInvitationId IS NULL
        BEGIN
            THROW 50207, 'This invitation is invalid or has expired.', 1;
        END;

        IF NOT EXISTS
        (
            SELECT 1
            FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
            INNER JOIN [pmt].[Projects] AS [Project] WITH (UPDLOCK, HOLDLOCK)
                ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
               AND [Project].[IsArchived] = 0
            WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId
        )
        BEGIN
            THROW 50209, 'This invitation no longer contains an active project.', 1;
        END;

        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Users] WITH (UPDLOCK, HOLDLOCK)
            WHERE [IsActive] = 1
              AND
              (
                  LOWER(LTRIM(RTRIM([Nickname]))) = LOWER(@Nickname)
                  OR LOWER(LTRIM(RTRIM(ISNULL([Email], N'')))) = LOWER(@Nickname)
              )
        )
        BEGIN
            THROW 50208, 'That username is already in use. Choose another username.', 1;
        END;

        INSERT INTO [pmt].[Users]
        (
            [FirstName],
            [LastName],
            [Nickname],
            [Email],
            [AvatarUrl],
            [PasswordHash],
            [IsAdmin],
            [Role],
            [CreatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            @Nickname,
            N'',
            @Nickname,
            NULL,
            @AvatarUrl,
            HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @Password)),
            0,
            N'Developer',
            @InvitedByUserId,
            @Now,
            @Now
        );

        SET @UserId = SCOPE_IDENTITY();

        INSERT INTO [pmt].[ProjectMembers]
        (
            [ProjectId],
            [UserId],
            [CreatedByUserId],
            [CreatedAt]
        )
        SELECT
            [InvitationProject].[ProjectId],
            @UserId,
            @InvitedByUserId,
            @Now
        FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
           AND [Project].[IsArchived] = 0
        WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId;

        EXEC [pmt].[WriteAudit]
            N'User',
            @UserId,
            N'Created from Invitation',
            @Nickname,
            @InvitedByUserId;

        SELECT
            @ProjectCount = COUNT(*),
            @OnlyProjectId = MIN([Project].[ProjectId])
        FROM [pmt].[UserInvitationProjects] AS [InvitationProject]
        INNER JOIN [pmt].[Projects] AS [Project]
            ON [Project].[ProjectId] = [InvitationProject].[ProjectId]
           AND [Project].[IsArchived] = 0
        WHERE [InvitationProject].[UserInvitationId] = @UserInvitationId;

        IF @ProjectCount <> 1
        BEGIN
            SET @OnlyProjectId = NULL;
        END;

        IF @OnlyProjectId IS NOT NULL
           AND EXISTS
           (
               SELECT 1
               FROM [pmt].[Sprints]
               WHERE [ProjectId] = @OnlyProjectId
                 AND [IsDeleted] = 0
           )
        BEGIN
            SET @NextView = N'Sprints';
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
        [UserId] = @UserId,
        [Nickname] = @Nickname,
        [IsAdmin] = CONVERT(BIT, 0),
        [Role] = N'Developer',
        [NextView] = @NextView,
        [ProjectId] = @OnlyProjectId;
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

    IF @Role NOT IN (N'Developer', N'QA')
    BEGIN
        SET @Role = N'Developer';
    END;

    IF @IsAdmin = 1
    BEGIN
        SET @Role = N'Admin';
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

PRINT N'PMT database migration 1.3 to 1.4 completed.';
GO
