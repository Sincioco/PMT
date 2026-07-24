using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task<int> SaveDevLogAsync(DevLogInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("DevLog", input.ExpectedRowVersion, "[pmt].[UpsertDevLog]", "@DevLogId", input.Id, command =>
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
        return ExecuteVersionedIdProcedureAsync("Blog", input.ExpectedRowVersion, "[pmt].[UpsertBlog]", "@BlogId", input.Id, command =>
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
        return ExecuteLockedProcedureAsync("[pmt].[DeleteBlog]", command =>
        {
            Add(command, "@BlogId", blogId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockBlogWrites: true, lockWorkTaskWrites: true);
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

    public Task MoveBlogAsync(int blogId, MoveBlogInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteLockedProcedureAsync("[pmt].[MoveBlog]", command =>
        {
            Add(command, "@BlogId", blogId);
            AddNullable(command, "@ParentBlogId", input.ParentBlogId);
            Add(command, "@OrderedBlogIds", SqlDbType.NVarChar, -1, string.Join(',', input.OrderedBlogIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, lockBlogWrites: true);
    }

    public Task<int> SaveSuggestionAsync(SuggestionInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("Suggestion", input.ExpectedRowVersion, "[pmt].[UpsertSuggestion]", "@SuggestionId", input.Id, command =>
        {
            Add(command, "@BodyHtml", SqlDbType.NVarChar, -1, input.BodyHtml);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public async Task<List<SuggestionDto>> GetSuggestionsAsync(CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetSuggestions]");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var suggestions = new List<SuggestionDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            suggestions.Add(new SuggestionDto
            {
                Id = reader.GetInt32("SuggestionId"),
                BodyHtml = reader.GetStringOrEmpty("BodyHtml"),
                Status = reader.GetStringOrEmpty("Status"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                UpdatedByUserId = reader.GetNullableInt32("UpdatedByUserId"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt"),
                RowVersion = reader.GetBytesOrEmpty("RowVersion")
            });
        }

        return suggestions;
    }

    public async Task<PublicBlogLinkDto> CreatePublicBlogLinkAsync(PublicBlogLinkInput input, int currentUserId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[CreatePublicBlogLink]");
        Add(command, "@BlogId", input.BlogId);
        AddNullable(command, "@DurationDays", input.DurationDays);
        Add(command, "@CurrentUserId", currentUserId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (await reader.ReadAsync(cancellationToken))
        {
            return new PublicBlogLinkDto
            {
                Token = reader.GetGuid(reader.GetOrdinal("Token")),
                ExpiresAt = reader.GetNullableUtcDateTime("ExpiresAt")
            };
        }

        throw new InvalidOperationException("The public link could not be created.");
    }

    public async Task<BlogPostDto?> GetPublicBlogAsync(Guid token, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetPublicBlog]");
        command.Parameters.Add("@Token", SqlDbType.UniqueIdentifier).Value = token;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        BlogPostDto? blog = null;
        if (await reader.ReadAsync(cancellationToken))
        {
            blog = new BlogPostDto
            {
                Id = reader.GetInt32("BlogId"),
                ProjectId = reader.GetNullableInt32("ProjectId"),
                SprintId = reader.GetNullableInt32("SprintId"),
                ParentBlogId = reader.GetNullableInt32("ParentBlogId"),
                Title = reader.GetStringOrEmpty("Title"),
                BodyHtml = reader.GetStringOrEmpty("BodyHtml"),
                IsPrivate = reader.GetBoolean("IsPrivate"),
                IsPinned = reader.GetBoolean("IsPinned"),
                SortOrder = reader.GetInt32("SortOrder"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
            };
        }

        await reader.NextResultAsync(cancellationToken);
        if (blog is not null)
        {
            blog.Attachments = await ReadAttachmentsAsync(reader, cancellationToken);
        }

        return blog;
    }

    public async Task<string> DeleteBlogAttachmentAsync(int blogId, int attachmentId, int currentUserId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[DeleteBlogAttachment]");
        var urlParameter = command.Parameters.Add("@Url", SqlDbType.NVarChar, 500);
        urlParameter.Direction = ParameterDirection.Output;
        Add(command, "@BlogId", blogId);
        Add(command, "@AttachmentId", attachmentId);
        Add(command, "@CurrentUserId", currentUserId);
        await command.ExecuteNonQueryAsync(cancellationToken);
        return urlParameter.Value is string url ? url : "";
    }

}
