using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task<int> SaveSprintAsync(SprintInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("Sprint", input.ExpectedRowVersion, "[pmt].[UpsertSprint]", "@SprintId", input.Id, command =>
        {
            AddNullable(command, "@ProjectId", input.ProjectId);
            Add(command, "@Title", SqlDbType.NVarChar, 160, input.Title);
            Add(command, "@Description", SqlDbType.NVarChar, -1, input.Description);
            AddNullable(command, "@StartDate", input.StartDate);
            AddNullable(command, "@EndDate", input.EndDate);
            Add(command, "@LessonLearnedHtml", SqlDbType.NVarChar, -1, input.LessonLearnedHtml);
            Add(command, "@DeveloperIdsCsv", SqlDbType.NVarChar, -1, Csv(input.DeveloperIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> FinishSprintAsync(int sprintId, FinishSprintInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedOutputIdProcedureAsync("Sprint", sprintId.ToString(), input.ExpectedRowVersion, "[pmt].[FinishSprint]", "@NewSprintId", command =>
        {
            Add(command, "@SprintId", sprintId);
            Add(command, "@CarryUnfinished", input.CarryUnfinished);
            Add(command, "@CarryTodos", input.CarryTodos);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockWorkTaskWrites: true, lockSprintWrites: true);
    }

    public Task DeleteSprintAsync(int sprintId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteLockedProcedureAsync("[pmt].[DeleteSprint]", command =>
        {
            Add(command, "@SprintId", sprintId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockBlogWrites: true, lockWorkTaskWrites: true, lockSprintWrites: true);
    }

}
