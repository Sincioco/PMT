using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task<int> SaveDevLogAsync(DevLogInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertDevLog]", "@DevLogId", input.Id, command =>
        {
            Add(command, "@LogType", SqlDbType.NVarChar, 20, input.LogType);
            Add(command, "@Category", SqlDbType.NVarChar, 60, input.Category);
            Add(command, "@LogDate", input.LogDate.Date);
            Add(command, "@BodyHtml", SqlDbType.NVarChar, -1, input.BodyHtml);
            AddNullable(command, "@ProjectId", input.ProjectId);
            Add(command, "@IsPinned", input.IsPinned);
            Add(command, "@CurrentUserId", currentUserId);
            Add(command, "@AuditContext", SqlDbType.NVarChar, 80, input.AuditContext);
        }, cancellationToken);
    }

    public Task DeleteDevLogAsync(int devLogId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteDevLog]", command =>
        {
            Add(command, "@DevLogId", devLogId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> SaveBlogAsync(BlogInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertBlog]", "@BlogId", input.Id, command =>
        {
            Add(command, "@Title", SqlDbType.NVarChar, 220, input.Title);
            Add(command, "@BodyHtml", SqlDbType.NVarChar, -1, input.BodyHtml);
            AddNullable(command, "@ProjectId", input.ProjectId);
            AddNullable(command, "@SprintId", input.SprintId);
            AddNullable(command, "@ParentBlogId", input.ParentBlogId);
            Add(command, "@IsPrivate", input.IsPrivate);
            Add(command, "@IsPinned", input.IsPinned);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteBlogAsync(int blogId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteBlog]", command =>
        {
            Add(command, "@BlogId", blogId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> AddBlogAttachmentAsync(int blogId, UploadResult upload, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[AddBlogAttachment]", "@AttachmentId", 0, command =>
        {
            Add(command, "@BlogId", blogId);
            AddUpload(command, upload);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

}
