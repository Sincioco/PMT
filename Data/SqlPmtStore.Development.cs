using System.Data;
using Microsoft.Data.SqlClient;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task DevelopmentClearNonPmtAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteLockedProcedureAsync("[pmt].[DevelopmentClearNonPmt]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockBlogWrites: true, lockWorkTaskWrites: true, lockSprintWrites: true);
    }

    public Task DevelopmentClearPmtAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteLockedProcedureAsync("[pmt].[DevelopmentClearPmt]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockBlogWrites: true, lockWorkTaskWrites: true, lockSprintWrites: true);
    }

    public Task DevelopmentClearUsersAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteLockedProcedureAsync("[pmt].[DevelopmentClearUsers]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockBlogWrites: true, lockWorkTaskWrites: true, lockSprintWrites: true);
    }

    public async Task RestoreInitialSeedDataAsync(string contentRootPath, int currentUserId, CancellationToken cancellationToken)
    {
        // Restoring seed data first refreshes schema/procedures so newer tables
        // exist even when an older development database is being reused.
        var scriptPaths = new[]
        {
            Path.Combine(contentRootPath, "SQL", "01_CreateDatabase.sql"),
            Path.Combine(contentRootPath, "SQL", "02_CreateStoredProcedures.sql"),
            Path.Combine(contentRootPath, "SQL", "03_SeedData.sql"),
            Path.Combine(contentRootPath, "SQL", "03_SeedData_PMT.sql"),
            Path.Combine(contentRootPath, "SQL", "03_SeedData_LMS.sql"),
            Path.Combine(contentRootPath, "SQL", "03_SeedData_HLS.sql")
        };

        await using var connection = await OpenConnectionAsync(cancellationToken);
        await EnsureCurrentUserIsAdminAsync(connection, currentUserId, cancellationToken);

        await using (var preflight = StoredProcedure(connection, "[pmt].[RequireDevelopmentSeedRestore]"))
        {
            Add(preflight, "@CurrentUserId", currentUserId);
            await preflight.ExecuteNonQueryAsync(cancellationToken);
        }

        await ExecuteSeedScriptsAsync(connection, scriptPaths, cancellationToken);
    }

    public async Task RestorePmtSeedDataAsync(string contentRootPath, int currentUserId, CancellationToken cancellationToken)
    {
        var scriptPaths = new[]
        {
            Path.Combine(contentRootPath, "SQL", "03_SeedData_PMT.sql")
        };

        await using var connection = await OpenConnectionAsync(cancellationToken);
        await EnsureCurrentUserIsAdminAsync(connection, currentUserId, cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            // Keep the project-only restore atomic and serialized. Missing demo
            // identities are recreated without touching BDO users or global data.
            await using (var ensureUsers = StoredProcedure(connection, transaction, "[pmt].[EnsurePmtDemoUsers]"))
            {
                Add(ensureUsers, "@CurrentUserId", currentUserId);
                await ensureUsers.ExecuteNonQueryAsync(cancellationToken);
            }

            // This recovery only inserts the missing PMT seed project. The global
            // restore preflight remains reserved for its destructive reset.
            await ExecuteSeedScriptsAsync(connection, scriptPaths, cancellationToken, transaction);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await TryRollbackAsync(transaction, cancellationToken);
            throw;
        }
    }

    private static async Task ExecuteSeedScriptsAsync(
        SqlConnection connection,
        IEnumerable<string> scriptPaths,
        CancellationToken cancellationToken,
        SqlTransaction? transaction = null)
    {
        foreach (var scriptPath in scriptPaths)
        {
            if (!File.Exists(scriptPath))
            {
                throw new FileNotFoundException($"Seed script was not found: {scriptPath}");
            }

            var script = await File.ReadAllTextAsync(scriptPath, cancellationToken);
            foreach (var batch in SplitSqlBatches(script))
            {
                await using var command = new SqlCommand(batch, connection, transaction)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 180
                };

                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
    }
}
