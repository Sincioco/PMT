/*
    PMT_1.4_to_1.5.sql

    Purpose:
    Adds the SA, TL, PM, QA - Manual, QA - Automation, and TM user roles to
    the existing user save procedure.

    This migration is standalone and safe to rerun. It does not change or
    delete existing user data, including users with the existing QA role.
*/

USE [PMT];
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

    IF @Role NOT IN
    (
        N'Developer',
        N'QA',
        N'SA - Systems Analyst',
        N'TL - Technical Lead',
        N'PM - Project Manager',
        N'QA - Manual',
        N'QA - Automation',
        N'TM - Test Manager'
    )
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

PRINT N'PMT database migration 1.4 to 1.5 completed.';
GO
