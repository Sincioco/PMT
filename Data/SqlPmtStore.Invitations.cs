using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public async Task<DateTime> CreateInvitationAsync(
        byte[] tokenHash,
        CreateInvitationInput input,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[CreateUserInvitation]");
        AddTokenHash(command, tokenHash);
        Add(command, "@ProjectIdsCsv", SqlDbType.NVarChar, -1, Csv(input.ProjectIds));
        Add(command, "@CurrentUserId", currentUserId);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return DateTime.SpecifyKind(Convert.ToDateTime(result), DateTimeKind.Utc);
    }

    public async Task<InvitationDto?> GetInvitationAsync(byte[] tokenHash, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetUserInvitation]");
        AddTokenHash(command, tokenHash);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var invitation = new InvitationDto
        {
            ExpiresAt = DateTime.SpecifyKind(reader.GetDateTime("ExpiresAt"), DateTimeKind.Utc)
        };

        await reader.NextResultAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            invitation.Projects.Add(new InvitationProjectDto
            {
                Id = reader.GetInt32("ProjectId"),
                Code = reader.GetStringOrEmpty("Code"),
                Title = reader.GetStringOrEmpty("Title"),
                IconUrl = reader.GetStringOrEmpty("IconUrl")
            });
        }

        return invitation;
    }

    public async Task<AcceptInvitationResult> AcceptInvitationAsync(
        byte[] tokenHash,
        AcceptInvitationInput input,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[AcceptUserInvitation]");
        AddTokenHash(command, tokenHash);
        Add(command, "@Nickname", SqlDbType.NVarChar, 80, input.Nickname);
        Add(command, "@Password", SqlDbType.NVarChar, 4000, input.Password);
        Add(command, "@AvatarUrl", SqlDbType.NVarChar, 500, input.AvatarUrl);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException("The invitation could not be accepted.");
        }

        return new AcceptInvitationResult
        {
            UserId = reader.GetInt32("UserId"),
            Nickname = reader.GetStringOrEmpty("Nickname"),
            IsAdmin = reader.GetBoolean("IsAdmin"),
            Role = reader.GetStringOrEmpty("Role"),
            NextView = reader.GetStringOrEmpty("NextView"),
            ProjectId = reader.GetNullableInt32("ProjectId")
        };
    }

    private static void AddTokenHash(Microsoft.Data.SqlClient.SqlCommand command, byte[] tokenHash)
    {
        if (tokenHash.Length != 32)
        {
            throw new InvalidOperationException("Invitation token hash is invalid.");
        }

        command.Parameters.Add("@TokenHash", SqlDbType.VarBinary, 32).Value = tokenHash;
    }
}
