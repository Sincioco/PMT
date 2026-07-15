/*
    PMT Database Version 1.18 -> 1.19

    Adds trustworthy actor attribution to the existing audit trail and the
    stored-procedure contract used by row-versioned signed sessions and
    server-controlled admin impersonation.
    Existing audit rows are preserved and attributed to their effective user.
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
   OR OBJECT_ID(N'[pmt].[AuditEvents]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[WorkTasks]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[Blogs]', N'U') IS NULL
   OR OBJECT_ID(N'[pmt].[IsAdmin]', N'FN') IS NULL
   OR OBJECT_ID(N'[pmt].[WriteAudit]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[LoginUser]', N'P') IS NULL
   OR COL_LENGTH(N'pmt.Users', N'RowVersion') IS NULL
BEGIN
    THROW 51035, 'PMT Database Version 1.18 objects are required before applying Version 1.19.', 1;
END;
GO

DECLARE @DatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@DatabaseVersion, N'') NOT IN (N'1.18', N'1.19')
BEGIN
    THROW 51036, 'PMT Database Version 1.18 is required before applying Version 1.19.', 1;
END;

IF @DatabaseVersion = N'1.19'
   AND
   (
       COL_LENGTH(N'pmt.AuditEvents', N'ActorUserId') IS NULL
       OR COLUMNPROPERTY(OBJECT_ID(N'[pmt].[AuditEvents]'), N'ActorUserId', N'AllowsNull') <> 0
       OR OBJECT_ID(N'[pmt].[GetSessionUser]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[BeginImpersonation]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[EndImpersonation]', N'P') IS NULL
       OR OBJECT_ID(N'[pmt].[GetAuditTrail]', N'P') IS NULL
       OR CHARINDEX(N'PMT_ActorUserId', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[WriteAudit]'))) = 0
       OR CHARINDEX(N'[RowVersion]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[LoginUser]'))) = 0
       OR CHARINDEX(N'[RowVersion]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[GetSessionUser]'))) = 0
       OR CHARINDEX(N'[RowVersion]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[BeginImpersonation]'))) = 0
   )
BEGIN
    THROW 51037, 'PMT Database Version 1.19 is recorded, but its impersonation audit contract is incomplete. Investigate before continuing.', 1;
END;
GO

IF COL_LENGTH(N'pmt.AuditEvents', N'ActorUserId') IS NULL
BEGIN
    ALTER TABLE [pmt].[AuditEvents] ADD [ActorUserId] INT NULL;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[WriteAudit]
    @EntityType NVARCHAR(40),
    @EntityId INT,
    @Action NVARCHAR(80),
    @Details NVARCHAR(MAX),
    @UserId INT,
    @OldStatus NVARCHAR(40) = NULL,
    @NewStatus NVARCHAR(40) = NULL,
    @OldPercentCompleted INT = NULL,
    @NewPercentCompleted INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ActorUserId INT = TRY_CONVERT(INT, SESSION_CONTEXT(N'PMT_ActorUserId'));
    IF @ActorUserId IS NULL
       OR NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @ActorUserId)
    BEGIN
        SET @ActorUserId = @UserId;
    END;

    INSERT INTO [pmt].[AuditEvents]
    (
        [EntityType],
        [EntityId],
        [Action],
        [Details],
        [OldStatus],
        [NewStatus],
        [OldPercentCompleted],
        [NewPercentCompleted],
        [UserId],
        [ActorUserId],
        [CreatedByUserId]
    )
    VALUES
    (
        @EntityType,
        @EntityId,
        @Action,
        @Details,
        @OldStatus,
        @NewStatus,
        @OldPercentCompleted,
        @NewPercentCompleted,
        @UserId,
        @ActorUserId,
        @UserId
    );
END;
GO

UPDATE [pmt].[AuditEvents]
SET [ActorUserId] = [UserId]
WHERE [ActorUserId] IS NULL;
GO

ALTER TABLE [pmt].[AuditEvents] ALTER COLUMN [ActorUserId] INT NOT NULL;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_pmt_AuditEvents_ActorUser'
      AND [parent_object_id] = OBJECT_ID(N'[pmt].[AuditEvents]')
)
BEGIN
    ALTER TABLE [pmt].[AuditEvents] WITH CHECK
        ADD CONSTRAINT [FK_pmt_AuditEvents_ActorUser]
        FOREIGN KEY ([ActorUserId]) REFERENCES [pmt].[Users]([UserId]);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_pmt_AuditEvents_Actor'
      AND [object_id] = OBJECT_ID(N'[pmt].[AuditEvents]')
)
BEGIN
    CREATE INDEX [IX_pmt_AuditEvents_Actor]
        ON [pmt].[AuditEvents]([ActorUserId], [CreatedAt] DESC);
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[LoginUser]
    @Login NVARCHAR(180),
    @Password NVARCHAR(4000)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Login = NULLIF(LTRIM(RTRIM(@Login)), N'');

    SELECT TOP (1)
        [UserId],
        [Nickname],
        [IsAdmin],
        [Role],
        [RowVersion]
    FROM [pmt].[Users]
    WHERE [IsActive] = 1
      AND ([Nickname] = @Login OR [Email] = @Login)
      AND [PasswordHash] = HASHBYTES('SHA2_256', CONVERT(NVARCHAR(4000), @Password));
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetSessionUser]
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        [UserId],
        [Nickname],
        [IsAdmin],
        [Role],
        [RowVersion]
    FROM [pmt].[Users]
    WHERE [UserId] = @UserId
      AND [IsActive] = 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[BeginImpersonation]
    @AdminUserId INT,
    @TargetUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@AdminUserId) = 0
    BEGIN
        THROW 51030, 'Only an administrator can impersonate another user.', 1;
    END;

    IF @TargetUserId = @AdminUserId
    BEGIN
        THROW 51031, 'Select another user to impersonate.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @TargetUserId AND [IsActive] = 1)
    BEGIN
        THROW 51032, 'The selected user is not active.', 1;
    END;

    DECLARE @AdminName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @AdminUserId);
    DECLARE @TargetName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @TargetUserId);
    DECLARE @Details NVARCHAR(MAX) = CONCAT(@AdminName, N' started impersonating ', @TargetName, N'.');

    EXEC [pmt].[WriteAudit]
        N'Impersonation',
        @TargetUserId,
        N'Started',
        @Details,
        @TargetUserId;

    SELECT
        [UserId],
        [Nickname],
        [IsAdmin],
        [Role],
        [RowVersion]
    FROM [pmt].[Users]
    WHERE [UserId] = @TargetUserId
      AND [IsActive] = 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[EndImpersonation]
    @AdminUserId INT,
    @TargetUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @AdminUserId)
       OR NOT EXISTS (SELECT 1 FROM [pmt].[Users] WHERE [UserId] = @TargetUserId)
    BEGIN
        THROW 51033, 'The impersonation users could not be verified.', 1;
    END;

    DECLARE @AdminName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @AdminUserId);
    DECLARE @TargetName NVARCHAR(80) = (SELECT [Nickname] FROM [pmt].[Users] WHERE [UserId] = @TargetUserId);
    DECLARE @Details NVARCHAR(MAX) = CONCAT(@AdminName, N' stopped impersonating ', @TargetName, N'.');

    EXEC [pmt].[WriteAudit]
        N'Impersonation',
        @TargetUserId,
        N'Ended',
        @Details,
        @TargetUserId;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetAuditTrail]
    @CurrentUserId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF [pmt].[IsAdmin](@CurrentUserId) = 0
    BEGIN
        THROW 51034, 'Only administrators can view the system audit trail.', 1;
    END;

    SELECT TOP (2000)
        [AuditEvent].[AuditEventId],
        [AuditEvent].[EntityType],
        [AuditEvent].[EntityId],
        [AuditEvent].[Action],
        CASE
            WHEN [AuditEvent].[EntityType] = N'Blog'
             AND EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[Blogs] AS [Blog]
                     WHERE [Blog].[BlogId] = [AuditEvent].[EntityId]
                       AND [Blog].[IsPrivate] = 1
                       AND [Blog].[CreatedByUserId] <> @CurrentUserId
                )
                THEN N'Private Documentation activity.'
            WHEN [AuditEvent].[EntityType] = N'Task'
             AND [AuditEvent].[Action] = N'Converted to Document'
             AND EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[WorkTasks] AS [WorkTask]
                     INNER JOIN [pmt].[Blogs] AS [Blog]
                         ON [Blog].[BlogId] = [WorkTask].[LinkedBlogId]
                     WHERE [WorkTask].[TaskId] = [AuditEvent].[EntityId]
                       AND [Blog].[IsPrivate] = 1
                       AND [Blog].[CreatedByUserId] <> @CurrentUserId
                 )
                THEN N'Private Documentation activity.'
            WHEN [AuditEvent].[EntityType] = N'DevLog'
             AND EXISTS
                 (
                     SELECT 1
                     FROM [pmt].[DevLogs] AS [DevLog]
                     WHERE [DevLog].[DevLogId] = [AuditEvent].[EntityId]
                       AND [DevLog].[LogType] = N'Log'
                       AND [DevLog].[UserId] <> @CurrentUserId
                 )
                THEN N'Private Log activity.'
            ELSE [AuditEvent].[Details]
        END AS [Details],
        [AuditEvent].[OldStatus],
        [AuditEvent].[NewStatus],
        [AuditEvent].[OldPercentCompleted],
        [AuditEvent].[NewPercentCompleted],
        [AuditEvent].[UserId],
        [AuditEvent].[ActorUserId],
        COALESCE([EffectiveUser].[Nickname], CONCAT(N'User #', [AuditEvent].[UserId])) AS [UserName],
        COALESCE([ActorUser].[Nickname], CONCAT(N'User #', [AuditEvent].[ActorUserId])) AS [ActorUserName],
        [AuditEvent].[CreatedAt]
    FROM [pmt].[AuditEvents] AS [AuditEvent]
    LEFT JOIN [pmt].[Users] AS [EffectiveUser]
        ON [EffectiveUser].[UserId] = [AuditEvent].[UserId]
    LEFT JOIN [pmt].[Users] AS [ActorUser]
        ON [ActorUser].[UserId] = [AuditEvent].[ActorUserId]
    ORDER BY [AuditEvent].[CreatedAt] DESC, [AuditEvent].[AuditEventId] DESC;
END;
GO

IF COL_LENGTH(N'pmt.AuditEvents', N'ActorUserId') IS NULL
   OR COLUMNPROPERTY(OBJECT_ID(N'[pmt].[AuditEvents]'), N'ActorUserId', N'AllowsNull') <> 0
   OR EXISTS (SELECT 1 FROM [pmt].[AuditEvents] WHERE [ActorUserId] IS NULL)
   OR OBJECT_ID(N'[pmt].[GetSessionUser]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[BeginImpersonation]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[EndImpersonation]', N'P') IS NULL
   OR OBJECT_ID(N'[pmt].[GetAuditTrail]', N'P') IS NULL
   OR CHARINDEX(N'PMT_ActorUserId', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[WriteAudit]'))) = 0
   OR CHARINDEX(N'[RowVersion]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[LoginUser]'))) = 0
   OR CHARINDEX(N'[RowVersion]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[GetSessionUser]'))) = 0
   OR CHARINDEX(N'[RowVersion]', OBJECT_DEFINITION(OBJECT_ID(N'[pmt].[BeginImpersonation]'))) = 0
BEGIN
    THROW 51038, 'PMT Version 1.19 impersonation audit contract could not be verified. The database version was not changed.', 1;
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
        @value = N'1.19';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.19';
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.19'
)
BEGIN
    THROW 51039, 'PMT Database Version 1.19 could not be recorded.', 1;
END;
GO

PRINT N'PMT Database Version 1.19 applied: server-controlled impersonation and actor-aware system auditing are available.';
GO
