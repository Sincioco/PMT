using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public async Task<List<WfhScheduleDto>> GetWfhScheduleAsync(int currentUserId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetWfhSchedule]");
        Add(command, "@CurrentUserId", currentUserId);

        var rows = new List<WfhScheduleDto>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new WfhScheduleDto
            {
                UserId = reader.GetInt32("UserId"),
                FirstName = reader.GetStringOrEmpty("FirstName"),
                LastName = reader.GetStringOrEmpty("LastName"),
                Nickname = reader.GetStringOrEmpty("Nickname"),
                AvatarUrl = reader.GetStringOrEmpty("AvatarUrl"),
                Role = reader.GetStringOrEmpty("Role"),
                CanWorkMonday = reader.GetBoolean("CanWorkMonday"),
                CanWorkTuesday = reader.GetBoolean("CanWorkTuesday"),
                CanWorkWednesday = reader.GetBoolean("CanWorkWednesday"),
                CanWorkThursday = reader.GetBoolean("CanWorkThursday"),
                CanWorkFriday = reader.GetBoolean("CanWorkFriday"),
                IsHidden = reader.GetBoolean("IsHidden"),
                SortOrder = reader.GetInt32("SortOrder")
            });
        }

        return rows;
    }

    public Task SaveWfhScheduleAsync(WfhScheduleInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[UpdateWfhSchedule]", command =>
        {
            Add(command, "@UserId", input.UserId);
            Add(command, "@CanWorkMonday", input.CanWorkMonday);
            Add(command, "@CanWorkTuesday", input.CanWorkTuesday);
            Add(command, "@CanWorkWednesday", input.CanWorkWednesday);
            Add(command, "@CanWorkThursday", input.CanWorkThursday);
            Add(command, "@CanWorkFriday", input.CanWorkFriday);
            Add(command, "@IsHidden", input.IsHidden);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task ReorderWfhScheduleAsync(ReorderWfhScheduleInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[ReorderWfhSchedule]", command =>
        {
            Add(command, "@UserIdsCsv", SqlDbType.NVarChar, -1, OrderedCsv(input.UserIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task ResetWfhScheduleAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[ResetWfhSchedule]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }
}
