using System.Data;
using Microsoft.Data.SqlClient;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task DevelopmentClearNonPmtAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DevelopmentClearNonPmt]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DevelopmentClearPmtAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DevelopmentClearPmt]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DevelopmentClearUsersAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DevelopmentClearUsers]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public async Task RestoreInitialSeedDataAsync(string contentRootPath, int currentUserId, CancellationToken cancellationToken)
    {
        // Restoring seed data first refreshes schema/procedures so newer tables
        // exist even when an older development database is being reused.
        var scriptPaths = new[]
        {
            Path.Combine(contentRootPath, "Sql", "01_CreateDatabase.sql"),
            Path.Combine(contentRootPath, "Sql", "02_CreateStoredProcedures.sql"),
            Path.Combine(contentRootPath, "Sql", "03_SeedData.sql"),
            Path.Combine(contentRootPath, "Sql", "03_SeedData_LMS.sql"),
            Path.Combine(contentRootPath, "Sql", "03_SeedData_HLS.sql")
        };

        await using var connection = await OpenConnectionAsync(cancellationToken);
        await EnsureCurrentUserIsAdminAsync(connection, currentUserId, cancellationToken);

        await using (var preflight = StoredProcedure(connection, "[pmt].[RequireDevelopmentSeedRestore]"))
        {
            Add(preflight, "@CurrentUserId", currentUserId);
            await preflight.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var scriptPath in scriptPaths)
        {
            if (!File.Exists(scriptPath))
            {
                throw new FileNotFoundException($"Seed script was not found: {scriptPath}");
            }

            var script = await File.ReadAllTextAsync(scriptPath, cancellationToken);
            foreach (var batch in SplitSqlBatches(script))
            {
                await using var command = new SqlCommand(batch, connection)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 180
                };

                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
    }

}
