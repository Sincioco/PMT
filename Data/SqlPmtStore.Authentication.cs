using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public async Task<UserDto?> LoginAsync(LoginInput input, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[LoginUser]");
        Add(command, "@Login", SqlDbType.NVarChar, 180, input.Login);
        Add(command, "@Password", SqlDbType.NVarChar, 4000, input.Password);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new UserDto
        {
            Id = reader.GetInt32("UserId"),
            Nickname = reader.GetStringOrEmpty("Nickname"),
            IsAdmin = reader.GetBoolean("IsAdmin"),
            Role = reader.GetStringOrEmpty("Role"),
            RowVersion = reader.GetBytesOrEmpty("RowVersion")
        };
    }

    public Task<UserDto?> GetSessionUserAsync(int userId, CancellationToken cancellationToken)
    {
        return ReadAuthenticationUserAsync("[pmt].[GetSessionUser]", command => Add(command, "@UserId", userId), cancellationToken);
    }

    public Task RecordSuccessfulLoginAsync(int userId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[RecordSuccessfulLogin]", command => Add(command, "@UserId", userId), cancellationToken);
    }

    public Task<UserDto?> BeginImpersonationAsync(int adminUserId, int targetUserId, CancellationToken cancellationToken)
    {
        return ReadAuthenticationUserAsync("[pmt].[BeginImpersonation]", command =>
        {
            Add(command, "@AdminUserId", adminUserId);
            Add(command, "@TargetUserId", targetUserId);
        }, cancellationToken);
    }

    public Task EndImpersonationAsync(int adminUserId, int targetUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[EndImpersonation]", command =>
        {
            Add(command, "@AdminUserId", adminUserId);
            Add(command, "@TargetUserId", targetUserId);
        }, cancellationToken);
    }

    public Task ChangePasswordAsync(int userId, ChangePasswordInput input, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[ChangePassword]", command =>
        {
            Add(command, "@UserId", userId);
            Add(command, "@CurrentPassword", SqlDbType.NVarChar, 4000, input.CurrentPassword);
            Add(command, "@NewPassword", SqlDbType.NVarChar, 4000, input.NewPassword);
        }, cancellationToken);
    }

    public Task AdminResetPasswordAsync(int userId, AdminResetPasswordInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[AdminResetUserPassword]", command =>
        {
            Add(command, "@UserId", userId);
            Add(command, "@NewPassword", SqlDbType.NVarChar, 4000, input.NewPassword);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    private async Task<UserDto?> ReadAuthenticationUserAsync(
        string procedureName,
        Action<Microsoft.Data.SqlClient.SqlCommand> addParameters,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, procedureName);
        addParameters(command);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken)) return null;

        return new UserDto
        {
            Id = reader.GetInt32("UserId"),
            Nickname = reader.GetStringOrEmpty("Nickname"),
            IsAdmin = reader.GetBoolean("IsAdmin"),
            Role = reader.GetStringOrEmpty("Role"),
            RowVersion = reader.GetBytesOrEmpty("RowVersion")
        };
    }

}
