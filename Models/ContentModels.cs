namespace PMT.Models;

public sealed class AttachmentDto
{
    public int Id { get; set; }
    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long ByteLength { get; set; }
    public int UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class DevLogDto
{
    public int Id { get; set; }
    public string LogType { get; set; } = "Scrum";
    public string Category { get; set; } = "General";
    public int? ProjectId { get; set; }
    public int UserId { get; set; }
    public DateTime LogDate { get; set; }
    public string BodyHtml { get; set; } = "";
    public bool IsPinned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public sealed class BlogPostDto
{
    public int Id { get; set; }
    public int? ProjectId { get; set; }
    public int? SprintId { get; set; }
    public int? ParentBlogId { get; set; }
    public string Title { get; set; } = "";
    public string BodyHtml { get; set; } = "";
    public bool IsPrivate { get; set; } = true;
    public bool IsPinned { get; set; }
    public int SortOrder { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    public List<AttachmentDto> Attachments { get; set; } = new();
    public List<BlogHistoryDto> History { get; set; } = new();
}

public sealed class BlogHistoryDto
{
    public int Id { get; set; }
    public int BlogId { get; set; }
    public string Action { get; set; } = "";
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class DevLogInput
{
    public int Id { get; set; }
    public string LogType { get; set; } = "Scrum";
    public string Category { get; set; } = "General";
    public int? ProjectId { get; set; }
    public DateTime LogDate { get; set; }
    public string BodyHtml { get; set; } = "";
    public bool IsPinned { get; set; }
    public string AuditContext { get; set; } = "";
    public byte[]? ExpectedRowVersion { get; set; }
}

public sealed class BlogInput
{
    public int Id { get; set; }
    public int? ProjectId { get; set; }
    public int? SprintId { get; set; }
    public int? ParentBlogId { get; set; }
    public string Title { get; set; } = "";
    public string BodyHtml { get; set; } = "";
    public bool IsPrivate { get; set; } = true;
    public bool IsPinned { get; set; }
    public byte[]? ExpectedRowVersion { get; set; }
}

public sealed class MoveBlogInput
{
    public int? ParentBlogId { get; set; }
    public List<int> OrderedBlogIds { get; set; } = new();
}

public sealed class UploadResult
{
    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long ByteLength { get; set; }
}

