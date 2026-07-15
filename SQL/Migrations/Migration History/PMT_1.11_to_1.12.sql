/*
    PMT Database Version 1.11 -> 1.12

    Makes Project codes predictable and safely reusable:
    - requested codes are never silently replaced with random values;
    - active Project codes cannot be reclaimed;
    - an administrator may explicitly reclaim a code held by an archived Project;
    - the archived Project and all related business data remain preserved.

    Run this file in SQLCMD mode. It stops on the first error.
    This migration changes a stored procedure and records the resulting database
    version. It does not automatically modify or delete business data.
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

IF OBJECT_ID(N'[pmt].[Projects]', N'U') IS NULL
   OR COL_LENGTH(N'pmt.Projects', N'IsArchived') IS NULL
   OR OBJECT_ID(N'[pmt].[IsAdmin]', N'FN') IS NULL
   OR NOT EXISTS
   (
       SELECT 1
       FROM sys.extended_properties
       WHERE [class] = 0
         AND [name] = N'PMT_DatabaseVersion'
         AND CONVERT(NVARCHAR(20), [value]) IN (N'1.11', N'1.12')
   )
BEGIN
    THROW 50131, 'PMT Database Version 1.11 is required before applying Version 1.12.', 1;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[UpsertProject]
    @ProjectId INT OUTPUT,
    @Code NVARCHAR(6),
    @Title NVARCHAR(31),
    @Description NVARCHAR(101),
    @Url NVARCHAR(500),
    @IconUrl NVARCHAR(500),
    @StartDate DATETIME2(0),
    @EndDate DATETIME2(0),
    @MemberIdsCsv NVARCHAR(MAX),
    @CurrentUserId INT,
    @OverrideArchivedCode BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @OwnerUserId INT;

    SET @Title = NULLIF(LTRIM(RTRIM(@Title)), N'');
    SET @Code = UPPER(REPLACE(NULLIF(LTRIM(RTRIM(@Code)), N''), N' ', N''));
    SET @OverrideArchivedCode = ISNULL(@OverrideArchivedCode, 0);
    IF @EndDate IS NOT NULL AND @StartDate IS NOT NULL AND @EndDate < @StartDate
    BEGIN
        SET @EndDate = @StartDate;
    END;

    IF @Code IS NULL
    BEGIN
        THROW 50001, 'Project code is required.', 1;
    END;

    IF LEN(ISNULL(@Code, N'')) > 5
    BEGIN
        THROW 50001, 'Project code cannot exceed 5 characters.', 1;
    END;

    IF @Title IS NULL
    BEGIN
        THROW 50001, 'Project title is required.', 1;
    END;

    IF LEN(@Title) > 30
    BEGIN
        THROW 50001, 'Project title cannot exceed 30 characters.', 1;
    END;

    IF LEN(ISNULL(@Description, N'')) > 100
    BEGIN
        THROW 50001, 'Project description cannot exceed 100 characters.', 1;
    END;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @ProjectId <> 0
        BEGIN
            SELECT @OwnerUserId = [CreatedByUserId]
            FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK)
            WHERE [ProjectId] = @ProjectId
              AND [IsArchived] = 0;

            IF @OwnerUserId IS NULL
            BEGIN
                THROW 50002, 'Project was not found.', 1;
            END;

            IF [pmt].[CanEdit](@OwnerUserId, @CurrentUserId) = 0
            BEGIN
                THROW 50003, 'You cannot edit this project.', 1;
            END;
        END;

        DECLARE @ConflictingProjectId INT;
        DECLARE @ConflictingProjectIsArchived BIT;

        SELECT
            @ConflictingProjectId = [ProjectId],
            @ConflictingProjectIsArchived = [IsArchived]
        FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK)
        WHERE [Code] = @Code
          AND [ProjectId] <> @ProjectId;

        IF @ConflictingProjectId IS NOT NULL
        BEGIN
            IF @ConflictingProjectIsArchived = 0
            BEGIN
                THROW 50004, 'Project code is already in use by an active project.', 1;
            END;

            IF @OverrideArchivedCode = 0
            BEGIN
                THROW 50007, 'Project code belongs to a deleted project. An administrator can reclaim it.', 1;
            END;

            IF [pmt].[IsAdmin](@CurrentUserId) = 0
            BEGIN
                THROW 50008, 'Only an administrator can reclaim a deleted project code.', 1;
            END;

            DECLARE @ArchivedReplacementCode NVARCHAR(5);
            DECLARE @ArchivedCodeAttempt INT = 0;

            WHILE @ArchivedCodeAttempt < 10000
            BEGIN
                SET @ArchivedReplacementCode = N'~'
                    + RIGHT(
                        N'0000' + CONVERT(
                            NVARCHAR(4),
                            (CONVERT(BIGINT, @ConflictingProjectId) + @ArchivedCodeAttempt) % 10000
                        ),
                        4
                    );

                IF NOT EXISTS
                (
                    SELECT 1
                    FROM [pmt].[Projects] WITH (UPDLOCK, HOLDLOCK)
                    WHERE [Code] = @ArchivedReplacementCode
                )
                BEGIN
                    BREAK;
                END;

                SET @ArchivedCodeAttempt += 1;
            END;

            IF @ArchivedCodeAttempt = 10000
            BEGIN
                THROW 50009, 'No archived project code is available for reclaiming this code.', 1;
            END;

            UPDATE [pmt].[Projects]
            SET [Code] = @ArchivedReplacementCode,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [ProjectId] = @ConflictingProjectId
              AND [IsArchived] = 1;

            DECLARE @ArchivedCodeAuditDetails NVARCHAR(4000) =
                N'Archived project code ' + @Code + N' was released as ' + @ArchivedReplacementCode + N'.';

            EXEC [pmt].[WriteAudit]
                N'Project',
                @ConflictingProjectId,
                N'Code Released',
                @ArchivedCodeAuditDetails,
                @CurrentUserId;
        END;

        IF @ProjectId = 0
        BEGIN
            INSERT INTO [pmt].[Projects]
            (
                [Code],
                [Title],
                [Description],
                [Url],
                [IconUrl],
                [StartDate],
                [EndDate],
                [CreatedByUserId],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES
            (
                @Code,
                @Title,
                @Description,
                @Url,
                @IconUrl,
                @StartDate,
                @EndDate,
                @CurrentUserId,
                @Now,
                @Now
            );

            SET @ProjectId = SCOPE_IDENTITY();
            EXEC [pmt].[WriteAudit] N'Project', @ProjectId, N'Created', @Title, @CurrentUserId;
        END
        ELSE
        BEGIN
            UPDATE [pmt].[Projects]
            SET
                [Code] = @Code,
                [Title] = @Title,
                [Description] = @Description,
                [Url] = @Url,
                [IconUrl] = @IconUrl,
                [StartDate] = @StartDate,
                [EndDate] = @EndDate,
                [UpdatedByUserId] = @CurrentUserId,
                [UpdatedAt] = @Now
            WHERE [ProjectId] = @ProjectId;

            EXEC [pmt].[WriteAudit] N'Project', @ProjectId, N'Updated', @Title, @CurrentUserId;
        END;

        DELETE FROM [pmt].[ProjectMembers]
        WHERE [ProjectId] = @ProjectId;

        INSERT INTO [pmt].[ProjectMembers] ([ProjectId], [UserId], [CreatedByUserId])
        SELECT @ProjectId, [Ids].[Id], @CurrentUserId
        FROM [pmt].[SplitIds](@MemberIdsCsv) AS [Ids]
        INNER JOIN [pmt].[Users]
            ON [pmt].[Users].[UserId] = [Ids].[Id]
           AND [pmt].[Users].[IsActive] = 1;

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
        @value = N'1.12';
END
ELSE
BEGIN
    EXEC sys.sp_addextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.12';
END;
GO

PRINT N'PMT Database Version 1.12 applied: Project codes save exactly and administrators can reclaim archived codes explicitly.';
GO
