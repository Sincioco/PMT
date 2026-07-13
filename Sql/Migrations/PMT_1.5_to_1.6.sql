/*
    PMT_1.5_to_1.6.sql

    Purpose:
    Adds database-backed Role management using the existing [pmt].[Lookups]
    table. Role names can be changed without changing their stable security
    codes. A Role cannot be deleted while any user still references it.

    This migration preserves existing users and is safe to rerun.
*/

USE [PMT];
GO

IF COL_LENGTH(N'pmt.Lookups', N'Code') IS NULL
BEGIN
    ALTER TABLE [pmt].[Lookups]
        ADD [Code] NVARCHAR(20) NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM [pmt].[Lookups] WHERE [LookupType] = N'Role')
BEGIN
    DECLARE @RoleCreatorId INT =
    (
        SELECT TOP (1) [UserId]
        FROM [pmt].[Users]
        ORDER BY [IsAdmin] DESC, [IsActive] DESC, [UserId]
    );

    IF @RoleCreatorId IS NULL
    BEGIN
        THROW 50072, 'A user is required before the PMT Roles can be created.', 1;
    END;

    INSERT INTO [pmt].[Lookups]
    (
        [LookupType],
        [Value],
        [Code],
        [ColorHex],
        [DisplayOrder],
        [IsActive],
        [CreatedByUserId]
    )
    VALUES
    (N'Role', N'Admin', N'Admin', NULL, 10, 1, @RoleCreatorId),
    (N'Role', N'Dev - Developer', N'Developer', NULL, 20, 1, @RoleCreatorId),
    (N'Role', N'QA - Quality Assurance', N'QA', NULL, 30, 1, @RoleCreatorId),
    (N'Role', N'SA - Systems Analyst', N'SA', NULL, 40, 1, @RoleCreatorId),
    (N'Role', N'TL - Technical Lead', N'TL', NULL, 50, 1, @RoleCreatorId),
    (N'Role', N'PM - Project Manager', N'PM', NULL, 60, 1, @RoleCreatorId),
    (N'Role', N'QA - Manual', N'QA Manual', NULL, 70, 1, @RoleCreatorId),
    (N'Role', N'QA - Automation', N'QA Automation', NULL, 80, 1, @RoleCreatorId),
    (N'Role', N'TM - Test Manager', N'TM', NULL, 90, 1, @RoleCreatorId);
END;
GO

UPDATE [pmt].[Lookups]
SET [Code] = N'R' + LEFT(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), 19)
WHERE [LookupType] = N'Role'
  AND [Code] IS NULL;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_pmt_Lookups_TypeCode'
      AND [object_id] = OBJECT_ID(N'[pmt].[Lookups]')
)
BEGIN
    CREATE UNIQUE INDEX [UX_pmt_Lookups_TypeCode]
        ON [pmt].[Lookups]([LookupType], [Code])
        WHERE [Code] IS NOT NULL;
END;
GO

-- Version 1.5 stored the visible labels directly. Version 1.6 stores stable codes.
UPDATE [pmt].[Users]
SET [Role] = CASE [Role]
    WHEN N'Dev - Developer' THEN N'Developer'
    WHEN N'QA - Quality Assurance' THEN N'QA'
    WHEN N'SA - Systems Analyst' THEN N'SA'
    WHEN N'TL - Technical Lead' THEN N'TL'
    WHEN N'PM - Project Manager' THEN N'PM'
    WHEN N'QA - Manual' THEN N'QA Manual'
    WHEN N'QA - Automation' THEN N'QA Automation'
    WHEN N'TM - Test Manager' THEN N'TM'
    ELSE [Role]
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetRoles]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [LookupId],
        [Value],
        [Code],
        [DisplayOrder],
        [IsActive]
    FROM [pmt].[Lookups]
    WHERE [LookupType] = N'Role'
    ORDER BY [DisplayOrder], [Value];
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

CREATE OR ALTER PROCEDURE [pmt].[UpsertLookup]
    @LookupId INT OUTPUT,
    @LookupType NVARCHAR(60),
    @Value NVARCHAR(120),
    @ColorHex NVARCHAR(20),
    @DisplayOrder INT,
    @IsActive BIT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ExistingLookupType NVARCHAR(60);
    DECLARE @Code NVARCHAR(20);

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50054, 'Only administrators can maintain dropdown values.', 1;
    END;

    SET @LookupType = NULLIF(LTRIM(RTRIM(@LookupType)), N'');
    SET @Value = NULLIF(LTRIM(RTRIM(@Value)), N'');
    SET @ColorHex = NULLIF(LTRIM(RTRIM(@ColorHex)), N'');

    IF @LookupType IS NULL OR @Value IS NULL
    BEGIN
        THROW 50055, 'Lookup type and value are required.', 1;
    END;

    IF @LookupId <> 0
    BEGIN
        SELECT @ExistingLookupType = [LookupType]
        FROM [pmt].[Lookups]
        WHERE [LookupId] = @LookupId;

        IF @ExistingLookupType IS NULL
        BEGIN
            THROW 50056, 'Lookup value was not found.', 1;
        END;

        IF @ExistingLookupType <> @LookupType
           AND (@ExistingLookupType = N'Role' OR @LookupType = N'Role')
        BEGIN
            THROW 50070, 'A Role cannot be changed into another setting type.', 1;
        END;
    END;

    IF @LookupId = 0
    BEGIN
        IF @LookupType = N'Role'
        BEGIN
            SET @Code = N'R' + LEFT(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), 19);
        END;

        INSERT INTO [pmt].[Lookups] ([LookupType], [Value], [Code], [ColorHex], [DisplayOrder], [IsActive], [CreatedByUserId])
        VALUES (@LookupType, @Value, @Code, @ColorHex, @DisplayOrder, @IsActive, @CurrentUserId);

        SET @LookupId = SCOPE_IDENTITY();
        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Created', @LookupType, @CurrentUserId;
    END
    ELSE
    BEGIN
        UPDATE [pmt].[Lookups]
        SET [LookupType] = @LookupType,
            [Value] = @Value,
            [Code] = CASE
                WHEN @LookupType = N'Role' AND [Code] IS NULL
                    THEN N'R' + LEFT(REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N''), 19)
                ELSE [Code]
            END,
            [ColorHex] = @ColorHex,
            [DisplayOrder] = @DisplayOrder,
            [IsActive] = @IsActive,
            [UpdatedByUserId] = @CurrentUserId,
            [UpdatedAt] = SYSUTCDATETIME()
        WHERE [LookupId] = @LookupId;

        IF @@ROWCOUNT = 0
        BEGIN
            THROW 50056, 'Lookup value was not found.', 1;
        END;

        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Updated', @LookupType, @CurrentUserId;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[DeleteLookup]
    @LookupId INT,
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LookupType NVARCHAR(60);
    DECLARE @Value NVARCHAR(120);
    DECLARE @Code NVARCHAR(20);

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50057, 'Only administrators can maintain dropdown values.', 1;
    END;

    SELECT
        @LookupType = [LookupType],
        @Value = [Value],
        @Code = [Code]
    FROM [pmt].[Lookups]
    WHERE [LookupId] = @LookupId;

    IF @LookupType IS NULL
    BEGIN
        THROW 50056, 'Lookup value was not found.', 1;
    END;

    IF @LookupType = N'Role'
    BEGIN
        IF EXISTS
        (
            SELECT 1
            FROM [pmt].[Users]
            WHERE [Role] = @Code
        )
        BEGIN
            THROW 50071, 'This Role cannot be deleted because it is assigned to a user.', 1;
        END;

        DELETE FROM [pmt].[Lookups]
        WHERE [LookupId] = @LookupId;

        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Deleted', @Value, @CurrentUserId;
        RETURN;
    END;

    UPDATE [pmt].[Lookups]
    SET [IsActive] = 0,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [LookupId] = @LookupId;

    EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Deactivated', N'Lookup value set inactive.', @CurrentUserId;
END;
GO

PRINT N'PMT database migration 1.5 to 1.6 completed.';
GO
