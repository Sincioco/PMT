using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task<int> SaveTaskAsync(WorkTaskInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertTask]", "@TaskId", input.Id, command =>
        {
            AddNullable(command, "@ProjectId", input.ProjectId);
            AddNullable(command, "@SprintId", input.SprintId);
            AddNullable(command, "@ParentTaskId", input.ParentTaskId);
            Add(command, "@TaskType", SqlDbType.NVarChar, 20, input.TaskType);
            Add(command, "@Title", SqlDbType.NVarChar, 220, input.Title);
            Add(command, "@DescriptionHtml", SqlDbType.NVarChar, -1, input.DescriptionHtml);
            Add(command, "@StepsToReproduceHtml", SqlDbType.NVarChar, -1, input.StepsToReproduceHtml);
            Add(command, "@ActualResultHtml", SqlDbType.NVarChar, -1, input.ActualResultHtml);
            Add(command, "@ExpectedResultHtml", SqlDbType.NVarChar, -1, input.ExpectedResultHtml);
            Add(command, "@Environment", SqlDbType.NVarChar, 40, input.Environment);
            Add(command, "@Severity", SqlDbType.NVarChar, 40, input.Severity);
            Add(command, "@Status", SqlDbType.NVarChar, 40, input.Status);
            Add(command, "@Priority", SqlDbType.NVarChar, 20, input.Priority);
            Add(command, "@PercentCompleted", input.PercentCompleted);
            Add(command, "@Url", SqlDbType.NVarChar, 500, input.Url);
            AddNullable(command, "@StartDate", input.StartDate);
            AddNullable(command, "@EndDate", input.EndDate);
            Add(command, "@ReporterIdsCsv", SqlDbType.NVarChar, -1, Csv(input.ReporterIds));
            Add(command, "@AssigneeIdsCsv", SqlDbType.NVarChar, -1, Csv(input.AssigneeIds));
            Add(command, "@DependencyTaskIdsCsv", SqlDbType.NVarChar, -1, Csv(input.DependencyTaskIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task ReorderTasksAsync(ReorderTasksInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[ReorderTasks]", command =>
        {
            Add(command, "@TaskIdsCsv", SqlDbType.NVarChar, -1, OrderedCsv(input.TaskIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> DuplicateTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[DuplicateTask]", "@NewTaskId", 0, command =>
        {
            Add(command, "@TaskId", taskId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteTask]", command =>
        {
            Add(command, "@TaskId", taskId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> AddTaskAttachmentAsync(int taskId, UploadResult upload, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[AddTaskAttachment]", "@AttachmentId", 0, command =>
        {
            Add(command, "@TaskId", taskId);
            AddUpload(command, upload);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

}
