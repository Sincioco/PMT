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
    public int? ProjectId { get; set; }
    public int UserId { get; set; }
    public DateTime LogDate { get; set; }
    public string BodyHtml { get; set; } = "";
    public bool IsPinned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class BlogPostDto
{
    public int Id { get; set; }
    public int? ProjectId { get; set; }
    public string Title { get; set; } = "";
    public string BodyHtml { get; set; } = "";
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
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
    public int? ProjectId { get; set; }
    public DateTime LogDate { get; set; }
    public string BodyHtml { get; set; } = "";
    public bool IsPinned { get; set; }
    public string AuditContext { get; set; } = "";
}

public sealed class BlogInput
{
    public int Id { get; set; }
    public int? ProjectId { get; set; }
    public string Title { get; set; } = "";
    public string BodyHtml { get; set; } = "";
}

public sealed class UploadResult
{
    public string FileName { get; set; } = "";
    public string Url { get; set; } = "";
    public string ContentType { get; set; } = "";
    public long ByteLength { get; set; }
}

