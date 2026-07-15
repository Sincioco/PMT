using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task<int> SaveTaskAsync(WorkTaskInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return SaveTaskAsync(input, currentUserId, false, cancellationToken);
    }

    public Task<int> SaveBacklogTaskAsync(WorkTaskInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return SaveTaskAsync(input, currentUserId, true, cancellationToken);
    }

    private Task<int> SaveTaskAsync(WorkTaskInput input, int currentUserId, bool allowBacklogAccess, CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("WorkTask", input.ExpectedRowVersion, "[pmt].[UpsertTask]", "@TaskId", input.Id, command =>
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
            Add(command, "@RootCauseAnalysisHtml", SqlDbType.NVarChar, -1, input.RootCauseAnalysisHtml);
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
            Add(command, "@AllowBacklogAccess", allowBacklogAccess);
            Add(command, "@AuditContext", SqlDbType.NVarChar, 80, input.AuditContext);
        }, cancellationToken);
    }

    public Task ReorderTasksAsync(ReorderTasksInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedReorderProcedureAsync("WorkTask", input.TaskIds, input.ExpectedRowVersions, "[pmt].[ReorderTasks]", command =>
        {
            Add(command, "@TaskIdsCsv", SqlDbType.NVarChar, -1, OrderedCsv(input.TaskIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> DuplicateTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return DuplicateTaskAsync(taskId, currentUserId, false, cancellationToken);
    }

    public Task<int> DuplicateBacklogTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return DuplicateTaskAsync(taskId, currentUserId, true, cancellationToken);
    }

    private Task<int> DuplicateTaskAsync(int taskId, int currentUserId, bool allowBacklogAccess, CancellationToken cancellationToken)
    {
        return ExecuteLockedIdProcedureAsync("[pmt].[DuplicateTask]", "@NewTaskId", command =>
        {
            Add(command, "@TaskId", taskId);
            Add(command, "@CurrentUserId", currentUserId);
            Add(command, "@AllowBacklogAccess", allowBacklogAccess);
        }, cancellationToken, lockWorkTaskWrites: true);
    }

    public Task<int> ConvertTaskToBlogAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteLockedIdProcedureAsync("[pmt].[ConvertTaskToBlog]", "@BlogId", command =>
        {
            Add(command, "@TaskId", taskId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockBlogWrites: true, lockWorkTaskWrites: true);
    }

    public Task DeleteTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return DeleteTaskAsync(taskId, currentUserId, false, cancellationToken);
    }

    public Task DeleteBacklogTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return DeleteTaskAsync(taskId, currentUserId, true, cancellationToken);
    }

    private Task DeleteTaskAsync(int taskId, int currentUserId, bool allowBacklogAccess, CancellationToken cancellationToken)
    {
        return ExecuteLockedProcedureAsync("[pmt].[DeleteTask]", command =>
        {
            Add(command, "@TaskId", taskId);
            Add(command, "@CurrentUserId", currentUserId);
            Add(command, "@AllowBacklogAccess", allowBacklogAccess);
        }, cancellationToken, lockWorkTaskWrites: true);
    }

    public Task<int> AddTaskAttachmentAsync(int taskId, UploadResult upload, int currentUserId, CancellationToken cancellationToken)
    {
        return AddTaskAttachmentAsync(taskId, upload, currentUserId, false, cancellationToken);
    }

    public Task<int> AddBacklogTaskAttachmentAsync(int taskId, UploadResult upload, int currentUserId, CancellationToken cancellationToken)
    {
        return AddTaskAttachmentAsync(taskId, upload, currentUserId, true, cancellationToken);
    }

    private Task<int> AddTaskAttachmentAsync(int taskId, UploadResult upload, int currentUserId, bool allowBacklogAccess, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[AddTaskAttachment]", "@AttachmentId", 0, command =>
        {
            Add(command, "@TaskId", taskId);
            AddUpload(command, upload);
            Add(command, "@CurrentUserId", currentUserId);
            Add(command, "@AllowBacklogAccess", allowBacklogAccess);
        }, cancellationToken);
    }

    public Task<string> DeleteTaskAttachmentAsync(int taskId, int attachmentId, int currentUserId, CancellationToken cancellationToken)
    {
        return DeleteTaskAttachmentAsync(taskId, attachmentId, currentUserId, false, cancellationToken);
    }

    public Task<string> DeleteBacklogTaskAttachmentAsync(int taskId, int attachmentId, int currentUserId, CancellationToken cancellationToken)
    {
        return DeleteTaskAttachmentAsync(taskId, attachmentId, currentUserId, true, cancellationToken);
    }

    private async Task<string> DeleteTaskAttachmentAsync(int taskId, int attachmentId, int currentUserId, bool allowBacklogAccess, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[DeleteTaskAttachment]");
        var urlParameter = command.Parameters.Add("@Url", SqlDbType.NVarChar, 500);
        urlParameter.Direction = ParameterDirection.Output;
        Add(command, "@TaskId", taskId);
        Add(command, "@AttachmentId", attachmentId);
        Add(command, "@CurrentUserId", currentUserId);
        Add(command, "@AllowBacklogAccess", allowBacklogAccess);
        await command.ExecuteNonQueryAsync(cancellationToken);
        return urlParameter.Value is string url ? url : "";
    }

}
