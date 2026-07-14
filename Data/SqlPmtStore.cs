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

    private static SqlCommand StoredProcedure(SqlConnection connection, string procedureName)
    {
        return new SqlCommand(procedureName, connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 60
        };
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
}
