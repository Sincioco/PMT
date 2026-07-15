/*
    PMT_1.8_to_1.9.sql

    Purpose:
    Makes user permissions full explicit overrides, adds inheritance state to
    the Security result set, and gives every Role every right supported by a
    PMT area by default. Existing explicit user permissions are converted to
    their pre-migration effective values so deployed access is not widened or
    reduced for those users. Existing PMT business data is preserved.

    A database-level extended property records completion of the one-time data
    conversion, so rerunning the full migration chain does not reset security
    changes made after the first successful deployment.
*/

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

IF OBJECT_ID(N'[pmt].[SecurityResources]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[RolePermissions]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[UserPermissions]', N'U') IS NULL
BEGIN
    THROW 50190, 'PMT Database Version 1.8 security tables are required before applying 1.9.', 1;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_SecurityOverrideMode'
)
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    -- An existing user row was additive in 1.8. Snapshot its old effective
    -- result before Role defaults change, then let the same row become the
    -- complete explicit override in 1.9.
    UPDATE [UserPermission]
    SET
        [CanRead] = CASE WHEN [RolePermission].[NoAccess] = 1 OR [UserPermission].[NoAccess] = 1 THEN 0
            WHEN [RolePermission].[CanRead] = 1 OR [UserPermission].[CanRead] = 1 THEN 1 ELSE 0 END,
        [CanCreate] = CASE WHEN [RolePermission].[NoAccess] = 1 OR [UserPermission].[NoAccess] = 1 THEN 0
            WHEN [RolePermission].[CanCreate] = 1 OR [UserPermission].[CanCreate] = 1 THEN 1 ELSE 0 END,
        [CanUpdate] = CASE WHEN [RolePermission].[NoAccess] = 1 OR [UserPermission].[NoAccess] = 1 THEN 0
            WHEN [RolePermission].[CanUpdate] = 1 OR [UserPermission].[CanUpdate] = 1 THEN 1 ELSE 0 END,
        [CanDelete] = CASE WHEN [RolePermission].[NoAccess] = 1 OR [UserPermission].[NoAccess] = 1 THEN 0
            WHEN [RolePermission].[CanDelete] = 1 OR [UserPermission].[CanDelete] = 1 THEN 1 ELSE 0 END,
        [CanImport] = CASE WHEN [RolePermission].[NoAccess] = 1 OR [UserPermission].[NoAccess] = 1 THEN 0
            WHEN [RolePermission].[CanImport] = 1 OR [UserPermission].[CanImport] = 1 THEN 1 ELSE 0 END,
        [CanExport] = CASE WHEN [RolePermission].[NoAccess] = 1 OR [UserPermission].[NoAccess] = 1 THEN 0
            WHEN [RolePermission].[CanExport] = 1 OR [UserPermission].[CanExport] = 1 THEN 1 ELSE 0 END,
        [NoAccess] = CASE WHEN [RolePermission].[NoAccess] = 1 OR [UserPermission].[NoAccess] = 1 THEN 1 ELSE 0 END
    FROM [pmt].[UserPermissions] AS [UserPermission]
    INNER JOIN [pmt].[Users] AS [User]
        ON [User].[UserId] = [UserPermission].[UserId]
    LEFT JOIN [pmt].[RolePermissions] AS [RolePermission]
        ON [RolePermission].[RoleCode] = [pmt].[UserRole]([User].[UserId])
       AND [RolePermission].[ResourceKey] = [UserPermission].[ResourceKey];

    -- Include Roles created on 1.8 that did not receive permission rows.
    INSERT INTO [pmt].[RolePermissions]
    (
        [RoleCode], [ResourceKey], [CanRead], [CanCreate], [CanUpdate],
        [CanDelete], [CanImport], [CanExport], [NoAccess]
    )
    SELECT
        [Role].[Code],
        [Resource].[ResourceKey],
        CONVERT(BIT, CASE WHEN CHARINDEX(N'Read', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        CONVERT(BIT, CASE WHEN CHARINDEX(N'Create', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        CONVERT(BIT, CASE WHEN CHARINDEX(N'Update', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        CONVERT(BIT, CASE WHEN CHARINDEX(N'Delete', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        CONVERT(BIT, CASE WHEN CHARINDEX(N'Import', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        CONVERT(BIT, CASE WHEN CHARINDEX(N'Export', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        0
    FROM [pmt].[Lookups] AS [Role]
    CROSS JOIN [pmt].[SecurityResources] AS [Resource]
    WHERE [Role].[LookupType] = N'Role'
      AND [Role].[Code] <> N'Admin'
      AND NOT EXISTS
      (
          SELECT 1
          FROM [pmt].[RolePermissions] AS [Existing]
          WHERE [Existing].[RoleCode] = [Role].[Code]
            AND [Existing].[ResourceKey] = [Resource].[ResourceKey]
      );

    -- The new simple default is every right supported by the resource.
    UPDATE [RolePermission]
    SET
        [CanRead] = CONVERT(BIT, CASE WHEN CHARINDEX(N'Read', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        [CanCreate] = CONVERT(BIT, CASE WHEN CHARINDEX(N'Create', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        [CanUpdate] = CONVERT(BIT, CASE WHEN CHARINDEX(N'Update', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        [CanDelete] = CONVERT(BIT, CASE WHEN CHARINDEX(N'Delete', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        [CanImport] = CONVERT(BIT, CASE WHEN CHARINDEX(N'Import', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        [CanExport] = CONVERT(BIT, CASE WHEN CHARINDEX(N'Export', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
        [NoAccess] = 0
    FROM [pmt].[RolePermissions] AS [RolePermission]
    INNER JOIN [pmt].[SecurityResources] AS [Resource]
        ON [Resource].[ResourceKey] = [RolePermission].[ResourceKey];

    EXEC sys.sp_addextendedproperty
        @name = N'PMT_SecurityOverrideMode',
        @value = N'Replacement';

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER FUNCTION [pmt].[HasPermission]
(
    @UserId INT,
    @ResourceKey NVARCHAR(40),
    @Right NVARCHAR(20)
)
RETURNS BIT
AS
BEGIN
    IF [pmt].[IsAdmin](@UserId) = 1
    BEGIN
        RETURN 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @UserId AND [IsActive] = 1)
       OR NOT EXISTS (SELECT 1 FROM [pmt].[SecurityResources] WHERE [ResourceKey] = @ResourceKey)
    BEGIN
        RETURN 0;
    END;

    DECLARE @RoleCode NVARCHAR(20) = [pmt].[UserRole](@UserId);
    DECLARE @RoleNoAccess BIT = 0;
    DECLARE @UserNoAccess BIT = 0;
    DECLARE @RoleAllowed BIT = 0;
    DECLARE @UserAllowed BIT = 0;
    DECLARE @HasUserOverride BIT = 0;

    SELECT
        @RoleNoAccess = [NoAccess],
        @RoleAllowed = CASE @Right
            WHEN N'Read' THEN [CanRead]
            WHEN N'Create' THEN [CanCreate]
            WHEN N'Update' THEN [CanUpdate]
            WHEN N'Delete' THEN [CanDelete]
            WHEN N'Import' THEN [CanImport]
            WHEN N'Export' THEN [CanExport]
            ELSE 0
        END
    FROM [pmt].[RolePermissions]
    WHERE [RoleCode] = @RoleCode
      AND [ResourceKey] = @ResourceKey;

    SELECT
        @HasUserOverride = 1,
        @UserNoAccess = [NoAccess],
        @UserAllowed = CASE @Right
            WHEN N'Read' THEN [CanRead]
            WHEN N'Create' THEN [CanCreate]
            WHEN N'Update' THEN [CanUpdate]
            WHEN N'Delete' THEN [CanDelete]
            WHEN N'Import' THEN [CanImport]
            WHEN N'Export' THEN [CanExport]
            ELSE 0
        END
    FROM [pmt].[UserPermissions]
    WHERE [UserId] = @UserId
      AND [ResourceKey] = @ResourceKey;

    IF ISNULL(@RoleNoAccess, 0) = 1 OR ISNULL(@UserNoAccess, 0) = 1
    BEGIN
        RETURN 0;
    END;

    IF @HasUserOverride = 1
    BEGIN
        RETURN ISNULL(@UserAllowed, 0);
    END;

    RETURN ISNULL(@RoleAllowed, 0);
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetSecurityConfiguration]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IsAdmin BIT = [pmt].[IsAdmin](@CurrentUserId);

    SELECT [ResourceKey], [Name], [AvailableRights], [DisplayOrder]
    FROM [pmt].[SecurityResources]
    WHERE @IsAdmin = 1
    ORDER BY [DisplayOrder], [Name];

    SELECT
        [Resource].[ResourceKey],
        [Role].[Code] AS [RoleCode],
        CONVERT(BIT, ISNULL([Permission].[CanRead], 0)) AS [CanRead],
        CONVERT(BIT, ISNULL([Permission].[CanCreate], 0)) AS [CanCreate],
        CONVERT(BIT, ISNULL([Permission].[CanUpdate], 0)) AS [CanUpdate],
        CONVERT(BIT, ISNULL([Permission].[CanDelete], 0)) AS [CanDelete],
        CONVERT(BIT, ISNULL([Permission].[CanImport], 0)) AS [CanImport],
        CONVERT(BIT, ISNULL([Permission].[CanExport], 0)) AS [CanExport],
        CONVERT(BIT, ISNULL([Permission].[NoAccess], 0)) AS [NoAccess]
    FROM [pmt].[SecurityResources] AS [Resource]
    CROSS JOIN [pmt].[Lookups] AS [Role]
    LEFT JOIN [pmt].[RolePermissions] AS [Permission]
        ON [Permission].[ResourceKey] = [Resource].[ResourceKey]
       AND [Permission].[RoleCode] = [Role].[Code]
    WHERE @IsAdmin = 1
      AND [Role].[LookupType] = N'Role'
      AND [Role].[Code] <> N'Admin'
      AND [Role].[IsActive] = 1
    ORDER BY [Resource].[DisplayOrder], [Role].[DisplayOrder], [Role].[Value];

    SELECT
        [Resource].[ResourceKey],
        [User].[UserId],
        CONVERT(BIT, ISNULL([Permission].[CanRead], 0)) AS [CanRead],
        CONVERT(BIT, ISNULL([Permission].[CanCreate], 0)) AS [CanCreate],
        CONVERT(BIT, ISNULL([Permission].[CanUpdate], 0)) AS [CanUpdate],
        CONVERT(BIT, ISNULL([Permission].[CanDelete], 0)) AS [CanDelete],
        CONVERT(BIT, ISNULL([Permission].[CanImport], 0)) AS [CanImport],
        CONVERT(BIT, ISNULL([Permission].[CanExport], 0)) AS [CanExport],
        CONVERT(BIT, ISNULL([Permission].[NoAccess], 0)) AS [NoAccess],
        CONVERT(BIT, CASE WHEN [Permission].[UserId] IS NULL THEN 0 ELSE 1 END) AS [IsOverride]
    FROM [pmt].[SecurityResources] AS [Resource]
    CROSS JOIN [pmt].[Users] AS [User]
    LEFT JOIN [pmt].[UserPermissions] AS [Permission]
        ON [Permission].[ResourceKey] = [Resource].[ResourceKey]
       AND [Permission].[UserId] = [User].[UserId]
    WHERE @IsAdmin = 1
      AND [User].[IsActive] = 1
      AND [User].[IsAdmin] = 0
    ORDER BY [Resource].[DisplayOrder], [User].[Nickname];

    SELECT
        [Resource].[ResourceKey],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Read') END) AS [CanRead],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Create') END) AS [CanCreate],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Update') END) AS [CanUpdate],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Delete') END) AS [CanDelete],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Import') END) AS [CanImport],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 1 ELSE [pmt].[HasPermission](@CurrentUserId, [Resource].[ResourceKey], N'Export') END) AS [CanExport],
        CONVERT(BIT, CASE WHEN @IsAdmin = 1 THEN 0 WHEN EXISTS
        (
            SELECT 1 FROM [pmt].[RolePermissions] AS [RolePermission]
            WHERE [RolePermission].[RoleCode] = [pmt].[UserRole](@CurrentUserId)
              AND [RolePermission].[ResourceKey] = [Resource].[ResourceKey]
              AND [RolePermission].[NoAccess] = 1
        ) OR EXISTS
        (
            SELECT 1 FROM [pmt].[UserPermissions] AS [UserPermission]
            WHERE [UserPermission].[UserId] = @CurrentUserId
              AND [UserPermission].[ResourceKey] = [Resource].[ResourceKey]
              AND [UserPermission].[NoAccess] = 1
        ) THEN 1 ELSE 0 END) AS [NoAccess]
    FROM [pmt].[SecurityResources] AS [Resource]
    ORDER BY [Resource].[DisplayOrder], [Resource].[Name];
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[SaveSecurityPermissions]
    @ResourceKey NVARCHAR(40),
    @RolePermissionsJson NVARCHAR(MAX),
    @UserPermissionsJson NVARCHAR(MAX),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50123, 'Only administrators can manage security.', 1;
    END;

    DECLARE @AvailableRights NVARCHAR(100);
    SELECT @AvailableRights = [AvailableRights]
    FROM [pmt].[SecurityResources]
    WHERE [ResourceKey] = @ResourceKey;

    IF @AvailableRights IS NULL
    BEGIN
        THROW 50124, 'Security area was not found.', 1;
    END;

    BEGIN TRANSACTION;

    DELETE FROM [pmt].[RolePermissions] WHERE [ResourceKey] = @ResourceKey;
    DELETE FROM [pmt].[UserPermissions] WHERE [ResourceKey] = @ResourceKey;

    INSERT INTO [pmt].[RolePermissions]
    (
        [RoleCode], [ResourceKey], [CanRead], [CanCreate], [CanUpdate],
        [CanDelete], [CanImport], [CanExport], [NoAccess]
    )
    SELECT
        [Input].[RoleCode], @ResourceKey,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Read', @AvailableRights) > 0 THEN [Input].[CanRead] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Create', @AvailableRights) > 0 THEN [Input].[CanCreate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Update', @AvailableRights) > 0 THEN [Input].[CanUpdate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Delete', @AvailableRights) > 0 THEN [Input].[CanDelete] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Import', @AvailableRights) > 0 THEN [Input].[CanImport] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Export', @AvailableRights) > 0 THEN [Input].[CanExport] ELSE 0 END,
        [Input].[NoAccess]
    FROM OPENJSON(ISNULL(@RolePermissionsJson, N'[]'))
    WITH
    (
        [RoleCode] NVARCHAR(20) N'$.RoleCode', [CanRead] BIT N'$.CanRead',
        [CanCreate] BIT N'$.CanCreate', [CanUpdate] BIT N'$.CanUpdate',
        [CanDelete] BIT N'$.CanDelete', [CanImport] BIT N'$.CanImport',
        [CanExport] BIT N'$.CanExport', [NoAccess] BIT N'$.NoAccess'
    ) AS [Input]
    INNER JOIN [pmt].[Lookups] AS [Role]
        ON [Role].[LookupType] = N'Role'
       AND [Role].[Code] = [Input].[RoleCode]
       AND [Role].[Code] <> N'Admin'
       AND [Role].[IsActive] = 1
    WHERE [Input].[NoAccess] = 1
       OR [Input].[CanRead] = 1 OR [Input].[CanCreate] = 1 OR [Input].[CanUpdate] = 1
       OR [Input].[CanDelete] = 1 OR [Input].[CanImport] = 1 OR [Input].[CanExport] = 1;

    INSERT INTO [pmt].[UserPermissions]
    (
        [UserId], [ResourceKey], [CanRead], [CanCreate], [CanUpdate],
        [CanDelete], [CanImport], [CanExport], [NoAccess]
    )
    SELECT
        [Input].[UserId], @ResourceKey,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Read', @AvailableRights) > 0 THEN [Input].[CanRead] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Create', @AvailableRights) > 0 THEN [Input].[CanCreate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Update', @AvailableRights) > 0 THEN [Input].[CanUpdate] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Delete', @AvailableRights) > 0 THEN [Input].[CanDelete] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Import', @AvailableRights) > 0 THEN [Input].[CanImport] ELSE 0 END,
        CASE WHEN [Input].[NoAccess] = 0 AND CHARINDEX(N'Export', @AvailableRights) > 0 THEN [Input].[CanExport] ELSE 0 END,
        [Input].[NoAccess]
    FROM OPENJSON(ISNULL(@UserPermissionsJson, N'[]'))
    WITH
    (
        [UserId] INT N'$.UserId', [CanRead] BIT N'$.CanRead',
        [CanCreate] BIT N'$.CanCreate', [CanUpdate] BIT N'$.CanUpdate',
        [CanDelete] BIT N'$.CanDelete', [CanImport] BIT N'$.CanImport',
        [CanExport] BIT N'$.CanExport', [NoAccess] BIT N'$.NoAccess',
        [IsOverride] BIT N'$.IsOverride'
    ) AS [Input]
    INNER JOIN [pmt].[Users] AS [User]
        ON [User].[UserId] = [Input].[UserId]
       AND [User].[IsActive] = 1
       AND [User].[IsAdmin] = 0
    WHERE [Input].[IsOverride] = 1;

    EXEC [pmt].[WriteAudit] N'Security', 0, N'Updated', @ResourceKey, @CurrentUserId;
    COMMIT TRANSACTION;
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

        IF @LookupType = N'Role'
        BEGIN
            INSERT INTO [pmt].[RolePermissions]
            (
                [RoleCode], [ResourceKey], [CanRead], [CanCreate], [CanUpdate],
                [CanDelete], [CanImport], [CanExport], [NoAccess]
            )
            SELECT
                @Code,
                [Resource].[ResourceKey],
                CONVERT(BIT, CASE WHEN CHARINDEX(N'Read', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN CHARINDEX(N'Create', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN CHARINDEX(N'Update', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN CHARINDEX(N'Delete', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN CHARINDEX(N'Import', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN CHARINDEX(N'Export', [Resource].[AvailableRights]) > 0 THEN 1 ELSE 0 END),
                0
            FROM [pmt].[SecurityResources] AS [Resource];
        END;

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

PRINT N'PMT database migration 1.8 to 1.9 completed.';
GO
