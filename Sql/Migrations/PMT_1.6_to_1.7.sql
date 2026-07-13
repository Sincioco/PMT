/*
    PMT_1.6_to_1.7.sql

    Purpose:
    Adds Role defaults, cumulative per-user permission overrides, explicit
    No Access deny rules, and administrator password resets. Admin users always
    bypass permission rules. Existing PMT data is preserved.

    This migration is safe to rerun.
*/

-- DeleteLookup changes rows covered by the filtered role-code index created in
-- 1.6. Keep its captured session settings valid no matter which deployment
-- tool runs this migration.
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
BEGIN
    CREATE TABLE [pmt].[SecurityResources]
    (
        [ResourceKey] NVARCHAR(40) NOT NULL CONSTRAINT [PK_pmt_SecurityResources] PRIMARY KEY,
        [Name] NVARCHAR(80) NOT NULL,
        [AvailableRights] NVARCHAR(100) NOT NULL CONSTRAINT [DF_pmt_SecurityResources_AvailableRights] DEFAULT (N'Read'),
        [DisplayOrder] INT NOT NULL CONSTRAINT [DF_pmt_SecurityResources_DisplayOrder] DEFAULT (0)
    );
END;
GO

IF OBJECT_ID(N'[pmt].[RolePermissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[RolePermissions]
    (
        [RoleCode] NVARCHAR(20) NOT NULL,
        [ResourceKey] NVARCHAR(40) NOT NULL,
        [CanRead] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanRead] DEFAULT (0),
        [CanCreate] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanCreate] DEFAULT (0),
        [CanUpdate] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanUpdate] DEFAULT (0),
        [CanDelete] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanDelete] DEFAULT (0),
        [CanImport] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanImport] DEFAULT (0),
        [CanExport] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_CanExport] DEFAULT (0),
        [NoAccess] BIT NOT NULL CONSTRAINT [DF_pmt_RolePermissions_NoAccess] DEFAULT (0),
        CONSTRAINT [PK_pmt_RolePermissions] PRIMARY KEY ([RoleCode], [ResourceKey]),
        CONSTRAINT [FK_pmt_RolePermissions_Resource] FOREIGN KEY ([ResourceKey]) REFERENCES [pmt].[SecurityResources]([ResourceKey])
    );
END;
GO

IF OBJECT_ID(N'[pmt].[UserPermissions]', N'U') IS NULL
BEGIN
    CREATE TABLE [pmt].[UserPermissions]
    (
        [UserId] INT NOT NULL,
        [ResourceKey] NVARCHAR(40) NOT NULL,
        [CanRead] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanRead] DEFAULT (0),
        [CanCreate] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanCreate] DEFAULT (0),
        [CanUpdate] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanUpdate] DEFAULT (0),
        [CanDelete] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanDelete] DEFAULT (0),
        [CanImport] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanImport] DEFAULT (0),
        [CanExport] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_CanExport] DEFAULT (0),
        [NoAccess] BIT NOT NULL CONSTRAINT [DF_pmt_UserPermissions_NoAccess] DEFAULT (0),
        CONSTRAINT [PK_pmt_UserPermissions] PRIMARY KEY ([UserId], [ResourceKey]),
        CONSTRAINT [FK_pmt_UserPermissions_User] FOREIGN KEY ([UserId]) REFERENCES [pmt].[Users]([UserId]),
        CONSTRAINT [FK_pmt_UserPermissions_Resource] FOREIGN KEY ([ResourceKey]) REFERENCES [pmt].[SecurityResources]([ResourceKey])
    );
END;
GO


IF NOT EXISTS (SELECT 1 FROM [pmt].[SecurityResources])
BEGIN
INSERT INTO [pmt].[SecurityResources] ([ResourceKey], [Name], [AvailableRights], [DisplayOrder])
VALUES
(N'Dashboard', N'Dashboard', N'Read', 10),
(N'RoadMap', N'Road Map', N'Read', 20),
(N'Gantt', N'Gantt Chart', N'Read', 30),
(N'Projects', N'Projects', N'Read,Create,Update,Delete', 40),
(N'Sprints', N'Sprints', N'Read,Create,Update,Delete', 50),
(N'Board', N'Kanban Board', N'Read,Update,Export', 60),
(N'DevTasks', N'Dev Tasks', N'Read,Create,Update,Delete,Import,Export', 70),
(N'BugTracking', N'Bug Tracking', N'Read,Create,Update,Delete,Import,Export', 80),
(N'Scrum', N'Scrum', N'Read,Create,Update,Delete,Import,Export', 90),
(N'Documentation', N'Documentation', N'Read,Create,Update,Delete,Import,Export', 100),
(N'PersonalLog', N'Log', N'Read,Create,Update,Delete,Import,Export', 110),
(N'Backlog', N'Backlog', N'Read,Create,Update,Delete,Import,Export', 120),
(N'WfhSchedule', N'WFH Schedule', N'Read,Update,Export', 130),
(N'Settings', N'Settings', N'Read,Create,Update,Delete', 140);

END;
GO

IF NOT EXISTS (SELECT 1 FROM [pmt].[RolePermissions])
BEGIN
-- Every built-in role can read PMT. The statements below add the normal work
-- rights for a software team without granting cross-discipline delete access.
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

END;
GO

CREATE OR ALTER FUNCTION [pmt].[CanEdit](@OwnerUserId INT, @CurrentUserId INT)
RETURNS BIT
AS
BEGIN
    -- Resource/action authorization is performed by RequirePermission before
    -- application writes. Keep this legacy ownership gate permissive so an
    -- explicit Update right can override the old owner-only behavior.
    IF [pmt].[IsAdmin](@CurrentUserId) = 1 OR @OwnerUserId = @CurrentUserId
    BEGIN
        RETURN 1;
    END;

    IF EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @CurrentUserId AND [IsActive] = 1)
    BEGIN
        RETURN 1;
    END;

    RETURN 0;
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

    RETURN CASE WHEN ISNULL(@RoleAllowed, 0) = 1 OR ISNULL(@UserAllowed, 0) = 1 THEN 1 ELSE 0 END;
END;
GO

CREATE OR ALTER FUNCTION [pmt].[CanEditTaskType](@TaskType NVARCHAR(20), @CurrentUserId INT)
RETURNS BIT
AS
BEGIN
    DECLARE @ResourceKey NVARCHAR(40) = CASE WHEN @TaskType = N'Bug' THEN N'BugTracking' ELSE N'DevTasks' END;

    RETURN CASE WHEN
        [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Create') = 1
        OR [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Update') = 1
        OR [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Delete') = 1
        OR [pmt].[HasPermission](@CurrentUserId, @ResourceKey, N'Import') = 1
        THEN 1 ELSE 0 END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RequirePermission]
    @CurrentUserId INT,
    @ResourceKey NVARCHAR(40),
    @Right NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[HasPermission](@CurrentUserId, @ResourceKey, @Right) = 0
    BEGIN
        THROW 50120, 'You do not have permission to perform this action.', 1;
    END;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RequireTaskPermission]
    @CurrentUserId INT,
    @TaskId INT,
    @Right NVARCHAR(20),
    @UseBacklogPermission BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TaskType NVARCHAR(20);
    SELECT @TaskType = [TaskType]
    FROM [pmt].[WorkTasks]
    WHERE [TaskId] = @TaskId
      AND [IsDeleted] = 0;

    IF @TaskType IS NULL
    BEGIN
        THROW 50121, 'Task was not found.', 1;
    END;

    DECLARE @ResourceKey NVARCHAR(40) = CASE
        WHEN @UseBacklogPermission = 1 THEN N'Backlog'
        WHEN @TaskType = N'Bug' THEN N'BugTracking'
        ELSE N'DevTasks'
    END;

    EXEC [pmt].[RequirePermission] @CurrentUserId, @ResourceKey, @Right;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[RequireDevLogPermission]
    @CurrentUserId INT,
    @DevLogId INT,
    @Right NVARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LogType NVARCHAR(20);
    SELECT @LogType = [LogType]
    FROM [pmt].[DevLogs]
    WHERE [DevLogId] = @DevLogId
      AND [IsDeleted] = 0;

    IF @LogType IS NULL
    BEGIN
        THROW 50122, 'Log was not found.', 1;
    END;

    DECLARE @ResourceKey NVARCHAR(40) = CASE WHEN @LogType = N'Log' THEN N'PersonalLog' ELSE N'Scrum' END;
    EXEC [pmt].[RequirePermission] @CurrentUserId, @ResourceKey, @Right;
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
        CONVERT(BIT, ISNULL([Permission].[NoAccess], 0)) AS [NoAccess]
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
            SELECT 1
            FROM [pmt].[RolePermissions] AS [RolePermission]
            WHERE [RolePermission].[RoleCode] = [pmt].[UserRole](@CurrentUserId)
              AND [RolePermission].[ResourceKey] = [Resource].[ResourceKey]
              AND [RolePermission].[NoAccess] = 1
        ) OR EXISTS
        (
            SELECT 1
            FROM [pmt].[UserPermissions] AS [UserPermission]
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
        [Input].[RoleCode],
        @ResourceKey,
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
        [RoleCode] NVARCHAR(20) N'$.RoleCode',
        [CanRead] BIT N'$.CanRead',
        [CanCreate] BIT N'$.CanCreate',
        [CanUpdate] BIT N'$.CanUpdate',
        [CanDelete] BIT N'$.CanDelete',
        [CanImport] BIT N'$.CanImport',
        [CanExport] BIT N'$.CanExport',
        [NoAccess] BIT N'$.NoAccess'
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
        [Input].[UserId],
        @ResourceKey,
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
        [UserId] INT N'$.UserId',
        [CanRead] BIT N'$.CanRead',
        [CanCreate] BIT N'$.CanCreate',
        [CanUpdate] BIT N'$.CanUpdate',
        [CanDelete] BIT N'$.CanDelete',
        [CanImport] BIT N'$.CanImport',
        [CanExport] BIT N'$.CanExport',
        [NoAccess] BIT N'$.NoAccess'
    ) AS [Input]
    INNER JOIN [pmt].[Users] AS [User]
        ON [User].[UserId] = [Input].[UserId]
       AND [User].[IsActive] = 1
       AND [User].[IsAdmin] = 0
    WHERE [Input].[NoAccess] = 1
       OR [Input].[CanRead] = 1 OR [Input].[CanCreate] = 1 OR [Input].[CanUpdate] = 1
       OR [Input].[CanDelete] = 1 OR [Input].[CanImport] = 1 OR [Input].[CanExport] = 1;

    EXEC [pmt].[WriteAudit] N'Security', 0, N'Updated', @ResourceKey, @CurrentUserId;
    COMMIT TRANSACTION;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AdminResetUserPassword]
    @UserId INT,
    @NewPassword NVARCHAR(4000),
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 50125, 'Only administrators can reset another user''s password.', 1;
    END;

    IF LEN(ISNULL(@NewPassword, N'')) < 8
    BEGIN
        THROW 50126, 'New password must be at least 8 characters.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @UserId AND [IsActive] = 1)
    BEGIN
        THROW 50127, 'User was not found.', 1;
    END;

    UPDATE [pmt].[Users]
    SET [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @NewPassword)),
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [UserId] = @UserId;

    EXEC [pmt].[WriteAudit] N'User', @UserId, N'Password Reset', N'Administrator reset the user password.', @CurrentUserId;
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

        DELETE FROM [pmt].[RolePermissions]
        WHERE [RoleCode] = @Code;

        DELETE FROM [pmt].[Lookups]
        WHERE [LookupId] = @LookupId;

        EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Deleted', @Value, @CurrentUserId;
        RETURN;
    END;

    -- Keep old task values readable by marking the lookup inactive instead of deleting the row.
    UPDATE [pmt].[Lookups]
    SET [IsActive] = 0,
        [UpdatedByUserId] = @CurrentUserId,
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [LookupId] = @LookupId;

    EXEC [pmt].[WriteAudit] N'Lookup', @LookupId, N'Deactivated', N'Lookup value set inactive.', @CurrentUserId;
END;
GO

PRINT N'PMT database migration 1.6 to 1.7 completed.';
GO
