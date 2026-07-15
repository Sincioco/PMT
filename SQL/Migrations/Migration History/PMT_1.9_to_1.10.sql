/*
    PMT_1.9_to_1.10.sql

    Purpose:
    Restores the original discipline-based Role permission defaults, adds a
    global administrator-only security reset, and gives newly created custom
    Roles the common team baseline. Existing explicit user overrides and PMT
    business data are preserved during migration.

    A database-level extended property records the one-time Role data update so
    rerunning the migration chain cannot overwrite later administrator changes.
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
   OR NOT EXISTS
   (
       SELECT 1
       FROM sys.extended_properties
       WHERE [class] = 0
         AND [name] = N'PMT_SecurityOverrideMode'
   )
BEGIN
    THROW 50191, 'PMT Database Version 1.9 security objects are required before applying 1.10.', 1;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_SecurityRoleDefaultsVersion'
)
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    -- Restore Role defaults without touching full-row user overrides.
    DELETE FROM [pmt].[RolePermissions];

    -- Every non-admin Role can read PMT. These common defaults also provide a
    -- safe baseline for custom Roles that do not have a built-in discipline.
    INSERT INTO [pmt].[RolePermissions] ([RoleCode], [ResourceKey], [CanRead])
    SELECT [Role].[Code], [Resource].[ResourceKey], 1
    FROM [pmt].[Lookups] AS [Role]
    CROSS JOIN [pmt].[SecurityResources] AS [Resource]
    WHERE [Role].[LookupType] = N'Role'
      AND [Role].[Code] <> N'Admin';

    UPDATE [pmt].[RolePermissions]
    SET [CanUpdate] = 1
    WHERE [ResourceKey] IN (N'Board', N'WfhSchedule', N'Settings');

    UPDATE [pmt].[RolePermissions]
    SET [CanExport] = 1
    WHERE [ResourceKey] IN (N'Board', N'WfhSchedule');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [ResourceKey] IN (N'Scrum', N'Documentation');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [ResourceKey] = N'PersonalLog';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'Developer'
      AND [ResourceKey] IN (N'DevTasks', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'Developer'
      AND [ResourceKey] = N'BugTracking';

    UPDATE [pmt].[RolePermissions]
    SET [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'DevTasks';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'BugTracking';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'Backlog';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1
    WHERE [RoleCode] = N'SA'
      AND [ResourceKey] IN (N'Projects', N'Sprints');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'SA'
      AND [ResourceKey] IN (N'DevTasks', N'BugTracking', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1
    WHERE [RoleCode] IN (N'TL', N'PM')
      AND [ResourceKey] IN (N'Projects', N'Sprints');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'TL'
      AND [ResourceKey] IN (N'DevTasks', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'TL', N'PM')
      AND [ResourceKey] IN (N'BugTracking', N'DevTasks');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'PM'
      AND [ResourceKey] = N'Backlog';

    UPDATE [pmt].[RolePermissions]
    SET [CanDelete] = 1
    WHERE [RoleCode] IN (N'SA', N'TL', N'PM', N'TM')
      AND [ResourceKey] IN (N'Scrum', N'Documentation');

    UPDATE [pmt].[RolePermissions]
    SET [CanUpdate] = 1
    WHERE [RoleCode] = N'TM'
      AND [ResourceKey] = N'Sprints';

    EXEC sys.sp_addextendedproperty
        @name = N'PMT_SecurityRoleDefaultsVersion',
        @value = N'1.10';

    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[ResetSecurityPermissions]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50123, 'Only administrators can manage security.', 1;
    END;

    BEGIN TRANSACTION;

    -- Remove every explicit user override so all non-admin users inherit their
    -- restored Role defaults.
    DELETE FROM [pmt].[UserPermissions];
    DELETE FROM [pmt].[RolePermissions];

    -- Every non-admin Role can read PMT. These common defaults also provide a
    -- safe baseline for custom Roles that do not have a built-in discipline.
    INSERT INTO [pmt].[RolePermissions] ([RoleCode], [ResourceKey], [CanRead])
    SELECT [Role].[Code], [Resource].[ResourceKey], 1
    FROM [pmt].[Lookups] AS [Role]
    CROSS JOIN [pmt].[SecurityResources] AS [Resource]
    WHERE [Role].[LookupType] = N'Role'
      AND [Role].[Code] <> N'Admin';

    UPDATE [pmt].[RolePermissions]
    SET [CanUpdate] = 1
    WHERE [ResourceKey] IN (N'Board', N'WfhSchedule', N'Settings');

    UPDATE [pmt].[RolePermissions]
    SET [CanExport] = 1
    WHERE [ResourceKey] IN (N'Board', N'WfhSchedule');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [ResourceKey] IN (N'Scrum', N'Documentation');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [ResourceKey] = N'PersonalLog';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'Developer'
      AND [ResourceKey] IN (N'DevTasks', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'Developer'
      AND [ResourceKey] = N'BugTracking';

    UPDATE [pmt].[RolePermissions]
    SET [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'DevTasks';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'BugTracking';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'QA', N'QA Manual', N'QA Automation', N'TM')
      AND [ResourceKey] = N'Backlog';

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1
    WHERE [RoleCode] = N'SA'
      AND [ResourceKey] IN (N'Projects', N'Sprints');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'SA'
      AND [ResourceKey] IN (N'DevTasks', N'BugTracking', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1
    WHERE [RoleCode] IN (N'TL', N'PM')
      AND [ResourceKey] IN (N'Projects', N'Sprints');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'TL'
      AND [ResourceKey] IN (N'DevTasks', N'Backlog');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] IN (N'TL', N'PM')
      AND [ResourceKey] IN (N'BugTracking', N'DevTasks');

    UPDATE [pmt].[RolePermissions]
    SET [CanCreate] = 1, [CanUpdate] = 1, [CanDelete] = 1, [CanImport] = 1, [CanExport] = 1
    WHERE [RoleCode] = N'PM'
      AND [ResourceKey] = N'Backlog';

    UPDATE [pmt].[RolePermissions]
    SET [CanDelete] = 1
    WHERE [RoleCode] IN (N'SA', N'TL', N'PM', N'TM')
      AND [ResourceKey] IN (N'Scrum', N'Documentation');

    UPDATE [pmt].[RolePermissions]
    SET [CanUpdate] = 1
    WHERE [RoleCode] = N'TM'
      AND [ResourceKey] = N'Sprints';

    EXEC [pmt].[WriteAudit]
        N'Security', 0, N'Reset', N'All Role permissions restored and user overrides removed.', @CurrentUserId;

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
                1,
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Scrum', N'Documentation', N'PersonalLog') THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Board', N'Scrum', N'Documentation', N'PersonalLog', N'WfhSchedule', N'Settings') THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] = N'PersonalLog' THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Scrum', N'Documentation', N'PersonalLog') THEN 1 ELSE 0 END),
                CONVERT(BIT, CASE WHEN [Resource].[ResourceKey] IN (N'Board', N'Scrum', N'Documentation', N'PersonalLog', N'WfhSchedule') THEN 1 ELSE 0 END),
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

PRINT N'PMT database migration 1.9 to 1.10 completed.';
GO
