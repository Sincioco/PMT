/*
    PMT Version 1.23 public Diagram demo seed.

    The Blog body references the editable bundled SVG asset under
    wwwroot/assets/docs. The SVG contains every current [pmt] table, its fields,
    and field-to-field foreign-key relationships without storing that large
    payload in SQL. The seed is non-destructive: an existing active Diagram with
    the same owner and title is left untouched.

    Regenerate the synchronized payload in this file and the active migration:
    node scripts/generate-database-schema-diagram.mjs
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

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
    THROW 51081, 'The PMT database-schema Diagram requires the active Sin administrator.', 1;
END;

-- BEGIN GENERATED PMT DATABASE SCHEMA DIAGRAM
DECLARE @DatabaseSchemaDiagramBodyHtml NVARCHAR(MAX) =
    N'<p><img class="rich-svg-image pmt-annotation-image" src="/assets/docs/pmt-database-schema.svg?v=7d0ac4cf050d" alt="PMT''s Database Schema" data-pmt-diagram="true" data-pmt-private-diagram="true" data-pmt-seeded-diagram="pmt-database-schema-v1" data-pmt-annotation-version="1"></p>';
-- END GENERATED PMT DATABASE SCHEMA DIAGRAM

BEGIN TRY
    BEGIN TRANSACTION;

    IF NOT EXISTS
    (
        SELECT 1
        FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
        WHERE [Title] = N'PMT''s Database Schema'
          AND [CreatedByUserId] = @Sin
          AND [IsDeleted] = 0
          AND ([BodyHtml] LIKE N'%data-pmt-diagram="true"%'
               OR [BodyHtml] LIKE N'%data-pmt-private-diagram="true"%')
    )
    BEGIN
        DECLARE @DiagramBlogId INT;

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

        SET @DiagramBlogId = SCOPE_IDENTITY();

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
            @DiagramBlogId,
            N'Created',
            @Sin,
            @Sin,
            @Now
        );
    END;

    -- Pinning is temporarily disabled in Documentation and Diagram.
    UPDATE [pmt].[Blogs]
    SET [IsPinned] = 0
    WHERE [IsPinned] = 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

PRINT N'PMT public database-schema Diagram seed is present.';
GO
