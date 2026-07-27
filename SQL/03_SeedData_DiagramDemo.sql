/*
    PMT Version 1.27 public Diagram demo seeds.

    The Blog bodies reference editable bundled SVG assets under
    wwwroot/assets/docs without storing their large payloads in SQL. The seed is
    non-destructive: existing seeded Diagrams are left untouched, while the
    exact pre-seed Field Mapping example is adopted by title when present.

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
    N'<p><img class="rich-svg-image pmt-annotation-image" src="/assets/docs/pmt-database-schema.svg?v=804c3165d4ba" alt="PMT''s Database Schema" data-pmt-diagram="true" data-pmt-private-diagram="true" data-pmt-seeded-diagram="pmt-database-schema-v1" data-pmt-annotation-version="1"></p>';
-- END GENERATED PMT DATABASE SCHEMA DIAGRAM

DECLARE @FieldMappingDiagramBodyHtml NVARCHAR(MAX) =
    N'<p><img class="rich-svg-image pmt-annotation-image" src="/assets/docs/pmt-field-mapping-example.svg?v=db21ca4c61a8" alt="PMT Field Mapping Example" data-pmt-diagram="true" data-pmt-private-diagram="true" data-pmt-seeded-diagram="pmt-field-mapping-example-v1" data-pmt-annotation-version="1"></p>';
DECLARE @FieldMappingDiagramNow DATETIME2(0) = DATEADD(SECOND, 1, @Now);

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

    DECLARE @FieldMappingDiagramBlogId INT;

    IF
    (
        SELECT COUNT_BIG(*)
        FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
        WHERE [IsDeleted] = 0
          AND [BodyHtml] LIKE N'%data-pmt-seeded-diagram="pmt-field-mapping-example-v1"%'
    ) > 1
    BEGIN
        THROW 51082, 'Multiple active PMT Field Mapping example seed Diagrams were found. Investigate without deleting user data.', 1;
    END;

    SELECT @FieldMappingDiagramBlogId = [BlogId]
    FROM [pmt].[Blogs]
    WHERE [IsDeleted] = 0
      AND [BodyHtml] LIKE N'%data-pmt-seeded-diagram="pmt-field-mapping-example-v1"%';

    IF @FieldMappingDiagramBlogId IS NULL
    BEGIN
        DECLARE @FieldMappingTitleCount BIGINT =
        (
            SELECT COUNT_BIG(*)
            FROM [pmt].[Blogs] WITH (UPDLOCK, HOLDLOCK)
            WHERE [Title] = N'PMT Field Mapping Example'
              AND [IsDeleted] = 0
        );

        IF @FieldMappingTitleCount > 1
        BEGIN
            THROW 51083, 'Multiple active Diagrams use the PMT Field Mapping Example title. Investigate without deleting user data.', 1;
        END;

        IF @FieldMappingTitleCount = 1
        BEGIN
            SELECT @FieldMappingDiagramBlogId = [BlogId]
            FROM [pmt].[Blogs]
            WHERE [Title] = N'PMT Field Mapping Example'
              AND [IsDeleted] = 0
              AND ([BodyHtml] LIKE N'%data-pmt-diagram="true"%'
                   OR [BodyHtml] LIKE N'%data-pmt-private-diagram="true"%');

            IF @FieldMappingDiagramBlogId IS NULL
            BEGIN
                THROW 51084, 'A non-Diagram row uses the PMT Field Mapping Example seed title. Investigate without overwriting user data.', 1;
            END;

        END
        ELSE
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
                N'PMT Field Mapping Example',
                @FieldMappingDiagramBodyHtml,
                0,
                0,
                0,
                @Sin,
                @Sin,
                @FieldMappingDiagramNow,
                @FieldMappingDiagramNow
            );

            SET @FieldMappingDiagramBlogId = SCOPE_IDENTITY();

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
                @FieldMappingDiagramBlogId,
                N'Created',
                @Sin,
                @Sin,
                @FieldMappingDiagramNow
            );
        END;
    END;

    UPDATE [pmt].[Blogs]
    SET
        [ProjectId] = NULL,
        [SprintId] = NULL,
        [ParentBlogId] = NULL,
        [BodyHtml] = @FieldMappingDiagramBodyHtml,
        [IsPrivate] = 0,
        [IsPinned] = 0,
        [SortOrder] = 0,
        [UpdatedByUserId] = @Sin,
        [UpdatedAt] = @FieldMappingDiagramNow
    WHERE [BlogId] = @FieldMappingDiagramBlogId
      AND
      (
          [ProjectId] IS NOT NULL
          OR [SprintId] IS NOT NULL
          OR [ParentBlogId] IS NOT NULL
          OR [BodyHtml] <> @FieldMappingDiagramBodyHtml
          OR [IsPrivate] <> 0
          OR [IsPinned] <> 0
          OR [SortOrder] <> 0
      );

    IF
    (
        SELECT COUNT_BIG(*)
        FROM [pmt].[Blogs]
        WHERE [IsDeleted] = 0
          AND [IsPrivate] = 0
          AND [Title] = N'PMT Field Mapping Example'
          AND [BodyHtml] = @FieldMappingDiagramBodyHtml
    ) <> 1
    BEGIN
        THROW 51085, 'The public PMT Field Mapping example seed Diagram could not be verified.', 1;
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

PRINT N'PMT public Diagram demo seeds are present.';
GO
