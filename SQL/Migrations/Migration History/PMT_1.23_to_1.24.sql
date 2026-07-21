/*
    PMT Database Version 1.23 -> 1.24

    Refreshes the seeded PMT Database Schema Diagram to the current bundled SVG
    asset and soft-deletes duplicate seeded copies so users see one current
    schema Diagram copies.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'pmt') IS NULL
BEGIN
    THROW 51090, 'PMT Database Version 1.23 objects are required before applying Version 1.24.', 1;
END;

DECLARE @CurrentDatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@CurrentDatabaseVersion, N'') <> N'1.23'
BEGIN
    THROW 51091, 'PMT Database Version 1.23 is required before applying Version 1.24.', 1;
END;

DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
DECLARE @Sin INT =
(
    SELECT [UserId]
    FROM [pmt].[Users]
    WHERE [Email] = N'louiery@gmail.com'
      AND [IsAdmin] = 1
      AND [IsActive] = 1
);

IF @Sin IS NULL
BEGIN
    THROW 51092, 'PMT Database Version 1.24 requires the active Sin administrator to update the seeded Diagram.', 1;
END;

DECLARE @DatabaseSchemaDiagramBodyHtml NVARCHAR(MAX) =
    N'<p><img class="rich-svg-image pmt-annotation-image" src="/assets/docs/pmt-database-schema.svg?v=804c3165d4ba" alt="PMT''s Database Schema" data-pmt-diagram="true" data-pmt-private-diagram="true" data-pmt-seeded-diagram="pmt-database-schema-v1" data-pmt-annotation-version="1"></p>';

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @SeededDatabaseSchemaDiagrams TABLE
    (
        [RowNumber] INT NOT NULL PRIMARY KEY,
        [BlogId] INT NOT NULL
    );

    INSERT INTO @SeededDatabaseSchemaDiagrams ([RowNumber], [BlogId])
    SELECT
        ROW_NUMBER() OVER
        (
            ORDER BY
                CASE
                    WHEN [BodyHtml] LIKE N'%data-pmt-seeded-diagram="pmt-database-schema-v1"%' THEN 0
                    ELSE 1
                END,
                [UpdatedAt] DESC,
                [BlogId] DESC
        ) AS [RowNumber],
        [BlogId]
    FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
    WHERE [IsDeleted] = 0
      AND [Title] = N'PMT''s Database Schema'
      AND
      (
          [BodyHtml] LIKE N'%data-pmt-seeded-diagram="pmt-database-schema-v1"%'
          OR [BodyHtml] LIKE N'%data-pmt-diagram="true"%'
          OR [BodyHtml] LIKE N'%data-pmt-private-diagram="true"%'
      );

    DECLARE @KeepBlogId INT =
    (
        SELECT [BlogId]
        FROM @SeededDatabaseSchemaDiagrams
        WHERE [RowNumber] = 1
    );

    IF @KeepBlogId IS NULL
    BEGIN
        INSERT INTO [pmt].[Blogs]
        (
            [ProjectId],
            [SprintId],
            [ParentBlogId],
            [Title],
            [BodyHtml],
            [IsPrivate],
            [IsPinned],
            [SortOrder],
            [CreatedByUserId],
            [UpdatedByUserId],
            [CreatedAt],
            [UpdatedAt]
        )
        VALUES
        (
            NULL,
            NULL,
            NULL,
            N'PMT''s Database Schema',
            @DatabaseSchemaDiagramBodyHtml,
            0,
            0,
            0,
            @Sin,
            @Sin,
            @Now,
            @Now
        );

        SET @KeepBlogId = SCOPE_IDENTITY();

        INSERT INTO [pmt].[BlogHistory]
        (
            [BlogId],
            [Action],
            [UserId],
            [CreatedByUserId],
            [CreatedAt]
        )
        VALUES
        (
            @KeepBlogId,
            N'Created',
            @Sin,
            @Sin,
            @Now
        );
    END
    ELSE
    BEGIN
        UPDATE [pmt].[Blogs]
        SET [BodyHtml] = @DatabaseSchemaDiagramBodyHtml,
            [IsPrivate] = 0,
            [IsPinned] = 0,
            [SortOrder] = 0,
            [UpdatedByUserId] = @Sin,
            [UpdatedAt] = @Now
        WHERE [BlogId] = @KeepBlogId;

        INSERT INTO [pmt].[BlogHistory]
        (
            [BlogId],
            [Action],
            [UserId],
            [CreatedByUserId],
            [CreatedAt]
        )
        VALUES
        (
            @KeepBlogId,
            N'Updated',
            @Sin,
            @Sin,
            @Now
        );
    END;

    INSERT INTO [pmt].[BlogHistory]
    (
        [BlogId],
        [Action],
        [UserId],
        [CreatedByUserId],
        [CreatedAt]
    )
    SELECT
        [BlogId],
        N'Deleted',
        @Sin,
        @Sin,
        @Now
    FROM @SeededDatabaseSchemaDiagrams
    WHERE [RowNumber] > 1;

    UPDATE [pmt].[Blogs]
    SET [IsDeleted] = 1,
        [UpdatedByUserId] = @Sin,
        [UpdatedAt] = @Now
    WHERE [BlogId] IN
    (
        SELECT [BlogId]
        FROM @SeededDatabaseSchemaDiagrams
        WHERE [RowNumber] > 1
    );

    IF
    (
        SELECT COUNT(*)
        FROM [pmt].[Blogs]
        WHERE [IsDeleted] = 0
          AND [Title] = N'PMT''s Database Schema'
          AND
          (
              [BodyHtml] LIKE N'%data-pmt-seeded-diagram="pmt-database-schema-v1"%'
              OR [BodyHtml] LIKE N'%data-pmt-diagram="true"%'
              OR [BodyHtml] LIKE N'%data-pmt-private-diagram="true"%'
          )
    ) <> 1
    BEGIN
        THROW 51093, 'PMT Database Version 1.24 expected exactly one active seeded database-schema Diagram.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs]
        WHERE [BlogId] = @KeepBlogId
          AND [IsDeleted] = 0
          AND [BodyHtml] LIKE N'%/assets/docs/pmt-database-schema.svg?v=804c3165d4ba%'
    )
    BEGIN
        THROW 51094, 'PMT Database Version 1.24 could not verify the refreshed database-schema Diagram URL.', 1;
    END;

    EXEC sys.sp_updateextendedproperty
        @name = N'PMT_DatabaseVersion',
        @value = N'1.24';

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.extended_properties
        WHERE [class] = 0
          AND [name] = N'PMT_DatabaseVersion'
          AND CONVERT(NVARCHAR(20), [value]) = N'1.24'
    )
    BEGIN
        THROW 51095, 'PMT Database Version 1.24 could not be verified.', 1;
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

PRINT N'PMT Database Version 1.24 applied: the seeded PMT Database Schema Diagram now references the current bundled SVG and duplicate schema Diagram copies were removed.';
GO
