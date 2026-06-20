using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task<int> SaveProjectAsync(ProjectInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertProject]", "@ProjectId", input.Id, command =>
        {
            // Send one extra character so the procedure can reject over-limit
            // values instead of silently truncating them to the column width.
            Add(command, "@Code", SqlDbType.NVarChar, 6, input.Code);
            Add(command, "@Title", SqlDbType.NVarChar, 31, input.Title);
            Add(command, "@Description", SqlDbType.NVarChar, 101, input.Description);
            Add(command, "@Url", SqlDbType.NVarChar, 500, input.Url);
            Add(command, "@IconUrl", SqlDbType.NVarChar, 500, input.IconUrl);
            AddNullable(command, "@StartDate", input.StartDate);
            AddNullable(command, "@EndDate", input.EndDate);
            Add(command, "@MemberIdsCsv", SqlDbType.NVarChar, -1, Csv(input.MemberIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteProjectAsync(int projectId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteProject]", command =>
        {
            Add(command, "@ProjectId", projectId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

}
