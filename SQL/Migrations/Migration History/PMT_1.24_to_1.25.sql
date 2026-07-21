/*
    PMT Database Version 1.24 -> 1.25

    Adds the shared game-score table and stored procedures used by the
    About-screen Pong + Blocks game leaderboard.
*/

USE [PMT];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF SCHEMA_ID(N'pmt') IS NULL
BEGIN
    THROW 51120, 'PMT Database Version 1.24 objects are required before applying Version 1.25.', 1;
END;

DECLARE @CurrentDatabaseVersion NVARCHAR(20) =
(
    SELECT CONVERT(NVARCHAR(20), [value])
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
);

IF ISNULL(@CurrentDatabaseVersion, N'') <> N'1.24'
BEGIN
    THROW 51121, 'PMT Database Version 1.24 is required before applying Version 1.25.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'[pmt].[GameScores]', N'U') IS NULL
    BEGIN
        CREATE TABLE [pmt].[GameScores]
        (
            [GameScoreId] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_pmt_GameScores] PRIMARY KEY,
            [GameKey] NVARCHAR(60) NOT NULL,
            [PlayerUserId] INT NULL,
            [PlayerName] NVARCHAR(160) NOT NULL,
            [Score] INT NOT NULL,
            [DurationSeconds] INT NOT NULL,
            [Won] BIT NOT NULL CONSTRAINT [DF_pmt_GameScores_Won] DEFAULT (0),
            [CreatedAt] DATETIME2(0) NOT NULL CONSTRAINT [DF_pmt_GameScores_CreatedAt] DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT [FK_pmt_GameScores_PlayerUser] FOREIGN KEY ([PlayerUserId]) REFERENCES [pmt].[Users]([UserId]) ON DELETE SET NULL,
            CONSTRAINT [CK_pmt_GameScores_GameKey] CHECK (LEN(LTRIM(RTRIM([GameKey]))) > 0),
            CONSTRAINT [CK_pmt_GameScores_PlayerName] CHECK (LEN(LTRIM(RTRIM([PlayerName]))) > 0),
            CONSTRAINT [CK_pmt_GameScores_Score] CHECK ([Score] >= 0),
            CONSTRAINT [CK_pmt_GameScores_DurationSeconds] CHECK ([DurationSeconds] >= 0)
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_pmt_GameScores_Leaderboard' AND [object_id] = OBJECT_ID(N'[pmt].[GameScores]'))
    BEGIN
        CREATE INDEX [IX_pmt_GameScores_Leaderboard] ON [pmt].[GameScores]([GameKey], [Score] DESC, [DurationSeconds], [CreatedAt] DESC);
    END;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

CREATE OR ALTER PROCEDURE [pmt].[GetGameScores]
    @GameKey NVARCHAR(60),
    @Top INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TrimmedGameKey NVARCHAR(60) = LOWER(LTRIM(RTRIM(ISNULL(@GameKey, N''))));
    DECLARE @SafeTop INT = CASE
        WHEN @Top IS NULL OR @Top < 1 THEN 10
        WHEN @Top > 50 THEN 50
        ELSE @Top
    END;

    IF @TrimmedGameKey = N''
    BEGIN
        THROW 51110, 'A game key is required.', 1;
    END;

    ;WITH RankedScores AS
    (
        SELECT
            [GameScoreId],
            [GameKey],
            [PlayerUserId],
            [PlayerName],
            [Score],
            [DurationSeconds],
            [Won],
            [CreatedAt],
            ROW_NUMBER() OVER
            (
                PARTITION BY COALESCE(CONVERT(NVARCHAR(20), [PlayerUserId]), LOWER([PlayerName]))
                ORDER BY [Score] DESC, [DurationSeconds], [CreatedAt] DESC, [GameScoreId] DESC
            ) AS [ScoreRank]
        FROM [pmt].[GameScores]
        WHERE [GameKey] = @TrimmedGameKey
    )
    SELECT TOP (@SafeTop)
        [GameScoreId],
        [GameKey],
        [PlayerUserId],
        [PlayerName],
        [Score],
        [DurationSeconds],
        [Won],
        [CreatedAt]
    FROM RankedScores
    WHERE [ScoreRank] = 1
    ORDER BY [Score] DESC, [DurationSeconds], [CreatedAt] DESC, [GameScoreId] DESC;
END;
GO

CREATE OR ALTER PROCEDURE [pmt].[AddGameScore]
    @GameKey NVARCHAR(60),
    @PlayerUserId INT,
    @Score INT,
    @DurationSeconds INT,
    @Won BIT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TrimmedGameKey NVARCHAR(60) = LOWER(LTRIM(RTRIM(ISNULL(@GameKey, N''))));
    DECLARE @PlayerName NVARCHAR(160);

    IF @TrimmedGameKey = N''
    BEGIN
        THROW 51111, 'A game key is required.', 1;
    END;

    IF ISNULL(@Score, -1) < 0 OR ISNULL(@DurationSeconds, -1) < 0
    BEGIN
        THROW 51112, 'Game score and duration must be zero or greater.', 1;
    END;

    SELECT @PlayerName = COALESCE
    (
        NULLIF(LTRIM(RTRIM([Nickname])), N''),
        NULLIF(LTRIM(RTRIM(CONCAT([FirstName], N' ', [LastName]))), N''),
        NULLIF(LTRIM(RTRIM([Email])), N''),
        N'Player'
    )
    FROM [pmt].[Users]
    WHERE [UserId] = @PlayerUserId
      AND [IsActive] = 1;

    IF @PlayerName IS NULL
    BEGIN
        THROW 51113, 'The game-score user was not found or is inactive.', 1;
    END;

    INSERT INTO [pmt].[GameScores]
    (
        [GameKey],
        [PlayerUserId],
        [PlayerName],
        [Score],
        [DurationSeconds],
        [Won]
    )
    VALUES
    (
        @TrimmedGameKey,
        @PlayerUserId,
        @PlayerName,
        @Score,
        @DurationSeconds,
        ISNULL(@Won, 0)
    );

    DECLARE @GameScoreId INT = CONVERT(INT, SCOPE_IDENTITY());

    SELECT
        [GameScoreId],
        [GameKey],
        [PlayerUserId],
        [PlayerName],
        [Score],
        [DurationSeconds],
        [Won],
        [CreatedAt]
    FROM [pmt].[GameScores]
    WHERE [GameScoreId] = @GameScoreId;
END;
GO

EXEC sys.sp_updateextendedproperty
    @name = N'PMT_DatabaseVersion',
    @value = N'1.25';
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.extended_properties
    WHERE [class] = 0
      AND [name] = N'PMT_DatabaseVersion'
      AND CONVERT(NVARCHAR(20), [value]) = N'1.25'
)
BEGIN
    THROW 51122, 'PMT Database Version 1.25 could not be verified.', 1;
END;
GO

PRINT N'PMT Database Version 1.25 applied: shared game-score leaderboard storage is available.';
GO
