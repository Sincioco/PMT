using System.Data;
using System.Text;
using Microsoft.Data.SqlClient;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    private readonly string _connectionString;

    public SqlPmtStore(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("PmtDatabase")
            ?? throw new InvalidOperationException("Missing ConnectionStrings:PmtDatabase.");
    }

    private async Task<SqlConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private async Task ExecuteProcedureAsync(string procedureName, Action<SqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, procedureName);
        configure(command);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<int> ExecuteIdProcedureAsync(string procedureName, string idParameterName, int id, Action<SqlCommand> configure, CancellationToken cancellationToken)
    {
        // Insert/update procedures use an input-output id parameter so callers
        // can use the same method for both "create" and "save" screens.
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, procedureName);
        var idParameter = command.Parameters.Add(idParameterName, SqlDbType.Int);
        idParameter.Direction = ParameterDirection.InputOutput;
        idParameter.Value = id;
        configure(command);
        await command.ExecuteNonQueryAsync(cancellationToken);
        return Convert.ToInt32(idParameter.Value);
    }

    private async Task<int> ExecuteVersionedIdProcedureAsync(
        string entityType,
        byte[]? expectedRowVersion,
        string procedureName,
        string idParameterName,
        int id,
        Action<SqlCommand> configure,
        CancellationToken cancellationToken,
        bool touchSecurityResources = false)
    {
        var lockBlogWrites = entityType == "Blog";
        var lockWorkTaskWrites = entityType == "WorkTask";
        var lockSprintWrites = entityType == "Sprint";

        if (id == 0 && !touchSecurityResources && !lockBlogWrites && !lockWorkTaskWrites && !lockSprintWrites)
        {
            return await ExecuteIdProcedureAsync(procedureName, idParameterName, id, configure, cancellationToken);
        }

        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            await LockWritesAsync(
                connection,
                transaction,
                lockBlogWrites,
                lockWorkTaskWrites,
                lockSprintWrites,
                cancellationToken);

            if (touchSecurityResources)
            {
                await TouchEditVersionAsync(connection, transaction, "SecurityResource", null, cancellationToken);
            }

            var actualRowVersion = id == 0
                ? null
                : await LockEditVersionAsync(connection, transaction, entityType, id.ToString(), cancellationToken);
            await using var command = StoredProcedure(connection, transaction, procedureName);
            var idParameter = command.Parameters.Add(idParameterName, SqlDbType.Int);
            idParameter.Direction = ParameterDirection.InputOutput;
            idParameter.Value = id;
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);

            if (id != 0)
            {
                RequireMatchingRowVersion(actualRowVersion, expectedRowVersion);
            }

            await transaction.CommitAsync(cancellationToken);
            return Convert.ToInt32(idParameter.Value);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task ExecuteVersionedProcedureAsync(
        string entityType,
        string entityKey,
        byte[]? expectedRowVersion,
        string procedureName,
        Action<SqlCommand> configure,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            var actualRowVersion = await LockEditVersionAsync(connection, transaction, entityType, entityKey, cancellationToken);
            await using var command = StoredProcedure(connection, transaction, procedureName);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);

            RequireMatchingRowVersion(actualRowVersion, expectedRowVersion);

            if (entityType == "SecurityResource")
            {
                await TouchEditVersionAsync(connection, transaction, entityType, entityKey, cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task<int> ExecuteVersionedOutputIdProcedureAsync(
        string entityType,
        string entityKey,
        byte[]? expectedRowVersion,
        string procedureName,
        string outputParameterName,
        Action<SqlCommand> configure,
        CancellationToken cancellationToken,
        bool lockBlogWrites = false,
        bool lockWorkTaskWrites = false,
        bool lockSprintWrites = false)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            await LockWritesAsync(
                connection,
                transaction,
                lockBlogWrites,
                lockWorkTaskWrites,
                lockSprintWrites,
                cancellationToken);

            var actualRowVersion = await LockEditVersionAsync(connection, transaction, entityType, entityKey, cancellationToken);
            RequireMatchingRowVersion(actualRowVersion, expectedRowVersion);

            await using var command = StoredProcedure(connection, transaction, procedureName);
            var outputParameter = command.Parameters.Add(outputParameterName, SqlDbType.Int);
            outputParameter.Direction = ParameterDirection.Output;
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return Convert.ToInt32(outputParameter.Value);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task ExecuteVersionedReorderProcedureAsync(
        string entityType,
        IReadOnlyList<int> orderedIds,
        IReadOnlyDictionary<int, byte[]?> expectedRowVersions,
        string procedureName,
        Action<SqlCommand> configure,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            await LockWritesAsync(
                connection,
                transaction,
                lockBlogWrites: false,
                lockWorkTaskWrites: entityType == "WorkTask",
                lockSprintWrites: false,
                cancellationToken);

            foreach (var id in orderedIds.Distinct().OrderBy(id => id))
            {
                var actualRowVersion = await LockEditVersionAsync(
                    connection,
                    transaction,
                    entityType,
                    id.ToString(),
                    cancellationToken);
                expectedRowVersions.TryGetValue(id, out var expectedRowVersion);
                RequireMatchingRowVersion(actualRowVersion, expectedRowVersion);
            }

            await using var command = StoredProcedure(connection, transaction, procedureName);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task ExecuteProcedureAndTouchEditVersionAsync(
        string procedureName,
        Action<SqlCommand> configure,
        string entityType,
        string? entityKey,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            await TouchEditVersionAsync(connection, transaction, entityType, entityKey, cancellationToken);
            await using var command = StoredProcedure(connection, transaction, procedureName);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task ExecuteLockedProcedureAsync(
        string procedureName,
        Action<SqlCommand> configure,
        CancellationToken cancellationToken,
        bool lockBlogWrites = false,
        bool lockWorkTaskWrites = false,
        bool lockSprintWrites = false)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            await LockWritesAsync(
                connection,
                transaction,
                lockBlogWrites,
                lockWorkTaskWrites,
                lockSprintWrites,
                cancellationToken);

            await using var command = StoredProcedure(connection, transaction, procedureName);
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private async Task<int> ExecuteLockedIdProcedureAsync(
        string procedureName,
        string idParameterName,
        Action<SqlCommand> configure,
        CancellationToken cancellationToken,
        bool lockBlogWrites = false,
        bool lockWorkTaskWrites = false,
        bool lockSprintWrites = false)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            await LockWritesAsync(
                connection,
                transaction,
                lockBlogWrites,
                lockWorkTaskWrites,
                lockSprintWrites,
                cancellationToken);

            await using var command = StoredProcedure(connection, transaction, procedureName);
            var idParameter = command.Parameters.Add(idParameterName, SqlDbType.Int);
            idParameter.Direction = ParameterDirection.Output;
            configure(command);
            await command.ExecuteNonQueryAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return Convert.ToInt32(idParameter.Value);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private static async Task<byte[]?> LockEditVersionAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string entityType,
        string entityKey,
        CancellationToken cancellationToken)
    {
        await using var command = StoredProcedure(connection, transaction, "[pmt].[LockEditVersion]");
        Add(command, "@EntityType", SqlDbType.NVarChar, 40, entityType);
        Add(command, "@EntityKey", SqlDbType.NVarChar, 80, entityKey);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is byte[] rowVersion ? rowVersion : null;
    }

    private static async Task LockWorkTaskWritesAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = StoredProcedure(connection, transaction, "[pmt].[LockWorkTaskWrites]");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task LockBlogWritesAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = StoredProcedure(connection, transaction, "[pmt].[LockBlogWrites]");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task LockSprintWritesAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = StoredProcedure(connection, transaction, "[pmt].[LockSprintWrites]");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task LockWritesAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        bool lockBlogWrites,
        bool lockWorkTaskWrites,
        bool lockSprintWrites,
        CancellationToken cancellationToken)
    {
        // Every multi-aggregate writer takes these locks in the same order.
        if (lockBlogWrites)
        {
            await LockBlogWritesAsync(connection, transaction, cancellationToken);
        }

        if (lockWorkTaskWrites)
        {
            await LockWorkTaskWritesAsync(connection, transaction, cancellationToken);
        }

        if (lockSprintWrites)
        {
            await LockSprintWritesAsync(connection, transaction, cancellationToken);
        }
    }

    private static async Task<Dictionary<(string EntityType, string EntityKey), byte[]>> ReadEditVersionsAsync(
        SqlConnection connection,
        int currentUserId,
        string? entityType,
        CancellationToken cancellationToken)
    {
        var versions = new Dictionary<(string EntityType, string EntityKey), byte[]>();
        await using var command = StoredProcedure(connection, "[pmt].[GetEditVersions]");
        Add(command, "@CurrentUserId", currentUserId);
        Add(command, "@EntityType", SqlDbType.NVarChar, 40, entityType);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var key = (
                reader.GetStringOrEmpty("EntityType"),
                reader.GetStringOrEmpty("EntityKey"));
            versions[key] = reader.GetBytesOrEmpty("RowVersion");
        }

        return versions;
    }

    private static async Task TouchEditVersionAsync(
        SqlConnection connection,
        SqlTransaction transaction,
        string entityType,
        string? entityKey,
        CancellationToken cancellationToken)
    {
        await using var command = StoredProcedure(connection, transaction, "[pmt].[TouchEditVersion]");
        Add(command, "@EntityType", SqlDbType.NVarChar, 40, entityType);
        Add(command, "@EntityKey", SqlDbType.NVarChar, 80, entityKey);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static void RequireMatchingRowVersion(byte[]? actualRowVersion, byte[]? expectedRowVersion)
    {
        if (actualRowVersion is { Length: 8 }
            && expectedRowVersion is { Length: 8 }
            && actualRowVersion.SequenceEqual(expectedRowVersion))
        {
            return;
        }

        throw new SaveConflictException();
    }

    private static async Task TryRollbackAsync(SqlTransaction transaction, CancellationToken cancellationToken)
    {
        if (transaction.Connection is null) return;

        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch
        {
            // Preserve the original save error. SQL Server will also roll the
            // transaction back when the connection is disposed.
        }
    }

    private static SqlCommand StoredProcedure(SqlConnection connection, string procedureName)
    {
        return new SqlCommand(procedureName, connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 60
        };
    }

    private static SqlCommand StoredProcedure(SqlConnection connection, SqlTransaction transaction, string procedureName)
    {
        var command = StoredProcedure(connection, procedureName);
        command.Transaction = transaction;
        return command;
    }

    private static async Task EnsureCurrentUserIsAdminAsync(SqlConnection connection, int currentUserId, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand("SELECT [pmt].[IsAdmin](@CurrentUserId)", connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 60
        };
        Add(command, "@CurrentUserId", currentUserId);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (!Convert.ToBoolean(result))
        {
            throw new InvalidOperationException("Only an administrator can restore seed data.");
        }
    }

    private static IEnumerable<string> SplitSqlBatches(string script)
    {
        // SQLCMD uses GO as a batch separator. SqlCommand does not understand GO,
        // so split the scripts into batches before sending them to SQL Server.
        var batch = new StringBuilder();
        using var reader = new StringReader(script);

        while (reader.ReadLine() is { } line)
        {
            if (line.Trim().Equals("GO", StringComparison.OrdinalIgnoreCase))
            {
                var sql = batch.ToString().Trim();
                if (!string.IsNullOrWhiteSpace(sql))
                {
                    yield return sql;
                }

                batch.Clear();
                continue;
            }

            batch.AppendLine(line);
        }

        var finalSql = batch.ToString().Trim();
        if (!string.IsNullOrWhiteSpace(finalSql))
        {
            yield return finalSql;
        }
    }

    private static void AddUpload(SqlCommand command, UploadResult upload)
    {
        Add(command, "@FileName", SqlDbType.NVarChar, 260, upload.FileName);
        Add(command, "@Url", SqlDbType.NVarChar, 500, upload.Url);
        Add(command, "@ContentType", SqlDbType.NVarChar, 160, upload.ContentType);
        Add(command, "@ByteLength", upload.ByteLength);
    }

    private static void Add(SqlCommand command, string name, int value) => command.Parameters.Add(name, SqlDbType.Int).Value = value;
    private static void Add(SqlCommand command, string name, long value) => command.Parameters.Add(name, SqlDbType.BigInt).Value = value;
    private static void Add(SqlCommand command, string name, bool value) => command.Parameters.Add(name, SqlDbType.Bit).Value = value;
    private static void Add(SqlCommand command, string name, DateTime value) => command.Parameters.Add(name, SqlDbType.DateTime2).Value = value;
    private static void AddNullable(SqlCommand command, string name, int? value) => command.Parameters.Add(name, SqlDbType.Int).Value = value.HasValue ? value.Value : DBNull.Value;
    private static void AddNullable(SqlCommand command, string name, DateTime? value) => command.Parameters.Add(name, SqlDbType.DateTime2).Value = value.HasValue ? value.Value.Date : DBNull.Value;

    private static void Add(SqlCommand command, string name, SqlDbType type, int size, string? value)
    {
        var parameter = command.Parameters.Add(name, type, size);
        parameter.Value = string.IsNullOrWhiteSpace(value) ? DBNull.Value : value.Trim();
    }

    private static string Csv(IEnumerable<int> values)
    {
        // SQL Server 2019 has STRING_SPLIT, so a small CSV keeps procedure
        // parameters readable without requiring table-valued parameters.
        return string.Join(",", values.Where(value => value > 0).Distinct().OrderBy(value => value));
    }

    private static string OrderedCsv(IEnumerable<int> values)
    {
        // Reordering depends on the exact sequence from the browser, so do not sort these IDs.
        return string.Join(",", values.Where(value => value > 0).Distinct());
    }
}

public sealed class SaveConflictException : Exception
{
    public SaveConflictException()
        : base("A newer version of this item exists. Your changes were not applied.")
    {
    }
}

internal static class SqlDataReaderExtensions
{
    public static string GetStringOrEmpty(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? "" : reader.GetString(ordinal);
    }

    public static int GetInt32(this SqlDataReader reader, string name)
    {
        return reader.GetInt32(reader.GetOrdinal(name));
    }

    public static long GetInt64(this SqlDataReader reader, string name)
    {
        return reader.GetInt64(reader.GetOrdinal(name));
    }

    public static bool GetBoolean(this SqlDataReader reader, string name)
    {
        return reader.GetBoolean(reader.GetOrdinal(name));
    }

    public static DateTime GetDateTime(this SqlDataReader reader, string name)
    {
        return reader.GetDateTime(reader.GetOrdinal(name));
    }

    public static DateTime GetUtcDateTime(this SqlDataReader reader, string name)
    {
        return DateTime.SpecifyKind(reader.GetDateTime(reader.GetOrdinal(name)), DateTimeKind.Utc);
    }

    public static int? GetNullableInt32(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
    }

    public static DateTime? GetNullableDateTime(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }

    public static DateTime? GetNullableUtcDateTime(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal)
            ? null
            : DateTime.SpecifyKind(reader.GetDateTime(ordinal), DateTimeKind.Utc);
    }

    public static byte[] GetBytesOrEmpty(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? Array.Empty<byte>() : reader.GetFieldValue<byte[]>(ordinal);
    }
}
