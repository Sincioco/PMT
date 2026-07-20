using Microsoft.Data.SqlClient;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public async Task<List<GameScoreDto>> GetGameScoresAsync(string gameKey, int top, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetGameScores]");
        Add(command, "@GameKey", System.Data.SqlDbType.NVarChar, 60, gameKey);
        Add(command, "@Top", top);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await ReadGameScoresAsync(reader, cancellationToken);
    }

    public async Task<GameScoreDto> AddGameScoreAsync(SaveGameScoreInput input, int currentUserId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[AddGameScore]");
        Add(command, "@GameKey", System.Data.SqlDbType.NVarChar, 60, input.GameKey);
        Add(command, "@PlayerUserId", currentUserId);
        Add(command, "@Score", Math.Max(0, input.Score));
        Add(command, "@DurationSeconds", Math.Max(0, input.DurationSeconds));
        Add(command, "@Won", input.Won);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var scores = await ReadGameScoresAsync(reader, cancellationToken);
        return scores.FirstOrDefault()
            ?? throw new InvalidOperationException("The game score could not be saved.");
    }

    private static async Task<List<GameScoreDto>> ReadGameScoresAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var scores = new List<GameScoreDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            scores.Add(new GameScoreDto
            {
                Id = reader.GetInt32("GameScoreId"),
                GameKey = reader.GetStringOrEmpty("GameKey"),
                PlayerUserId = reader.GetNullableInt32("PlayerUserId"),
                PlayerName = reader.GetStringOrEmpty("PlayerName"),
                Score = reader.GetInt32("Score"),
                DurationSeconds = reader.GetInt32("DurationSeconds"),
                Won = reader.GetBoolean("Won"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt")
            });
        }

        return scores;
    }
}
