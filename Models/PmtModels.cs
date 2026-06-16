namespace PMT.Models;

public sealed class AppState
{
    public List<UserDto> Users { get; set; } = new();
    public List<ProjectDto> Projects { get; set; } = new();
    public List<SprintDto> Sprints { get; set; } = new();
    public List<WorkTaskDto> Tasks { get; set; } = new();
    public List<DevLogDto> DevLogs { get; set; } = new();
    public List<BlogPostDto> Blogs { get; set; } = new();
    public List<AuditEventDto> AuditEvents { get; set; } = new();
    public List<LookupDto> Lookups { get; set; } = new();
    public List<HolidayDto> Holidays { get; set; } = new();
}

public sealed class UserDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Nickname { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public string HomePageUrl { get; set; } = "";
    public string SocialMediaUrl { get; set; } = "";
    public string Bio { get; set; } = "";
    public bool IsAdmin { get; set; }
    public string Role { get; set; } = "Developer";
    public bool IsActive { get; set; } = true;
}

public sealed class UserSummaryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Nickname { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public bool IsAdmin { get; set; }
    public string Role { get; set; } = "Developer";
}

public sealed class ProjectDto
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Url { get; set; } = "";
    public string IconUrl { get; set; } = "";
    public decimal PercentCompleted { get; set; }
    public int TaskCount { get; set; }
    public int CompletedTaskCount { get; set; }
    public int BugCount { get; set; }
    public int OpenBugCount { get; set; }
    public int CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<int> MemberIds { get; set; } = new();
    public List<UserSummaryDto> Members { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class SprintDto
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string LessonLearnedHtml { get; set; } = "";
    public bool IsFinished { get; set; }
    public decimal PercentCompleted { get; set; }
    public int TaskCount { get; set; }
    public int CompletedTaskCount { get; set; }
    public int BugCount { get; set; }
    public int OpenBugCount { get; set; }
    public int CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
    public List<int> DeveloperIds { get; set; } = new();
    public List<UserSummaryDto> Developers { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class WorkTaskDto
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int? SprintId { get; set; }
    public int? ParentTaskId { get; set; }
    public string TaskType { get; set; } = "Dev";
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string DescriptionHtml { get; set; } = "";
    public string StepsToReproduceHtml { get; set; } = "";
    public string ActualResultHtml { get; set; } = "";
    public string ExpectedResultHtml { get; set; } = "";
    public string Environment { get; set; } = "";
    public string Severity { get; set; } = "";
    public string Status { get; set; } = "Todo";
    public string Priority { get; set; } = "Low";
    public int SortOrder { get; set; }
    public int PercentCompleted { get; set; }
    public decimal SubTaskAveragePercent { get; set; }
    public string Url { get; set; } = "";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? StartedAt { get; set; }
    public int CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
    public int? LinkedBugTaskId { get; set; }
    public List<int> ReporterIds { get; set; } = new();
    public List<UserSummaryDto> Reporters { get; set; } = new();
    public List<int> AssigneeIds { get; set; } = new();
    public List<UserSummaryDto> Assignees { get; set; } = new();
    public List<int> DependencyTaskIds { get; set; } = new();
    public List<AttachmentDto> Attachments { get; set; } = new();
    public List<WorkTaskDto> SubTasks { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class LookupDto
{
    public int Id { get; set; }
    public string LookupType { get; set; } = "";
    public string Value { get; set; } = "";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string ColorHex { get; set; } = "";
}

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

public sealed class AuditEventDto
{
    public int Id { get; set; }
    public string EntityType { get; set; } = "";
    public int EntityId { get; set; }
    public string Action { get; set; } = "";
    public string Details { get; set; } = "";
    public string OldStatus { get; set; } = "";
    public string NewStatus { get; set; } = "";
    public int? OldPercentCompleted { get; set; }
    public int? NewPercentCompleted { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class HolidayDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime HolidayDate { get; set; }
    public string CountryCode { get; set; } = "PH";
    public bool IsActive { get; set; } = true;
    public int CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
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

public sealed class ProjectInput
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Url { get; set; } = "";
    public string IconUrl { get; set; } = "";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<int> MemberIds { get; set; } = new();
}

public sealed class SprintInput
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string LessonLearnedHtml { get; set; } = "";
    public List<int> DeveloperIds { get; set; } = new();
}

public sealed class FinishSprintInput
{
    public bool CarryUnfinished { get; set; } = true;
    public bool CarryTodos { get; set; }
}

public sealed class WorkTaskInput
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public int? SprintId { get; set; }
    public int? ParentTaskId { get; set; }
    public string TaskType { get; set; } = "Dev";
    public string Title { get; set; } = "";
    public string DescriptionHtml { get; set; } = "";
    public string StepsToReproduceHtml { get; set; } = "";
    public string ActualResultHtml { get; set; } = "";
    public string ExpectedResultHtml { get; set; } = "";
    public string Environment { get; set; } = "";
    public string Severity { get; set; } = "";
    public string Status { get; set; } = "Todo";
    public string Priority { get; set; } = "Low";
    public int PercentCompleted { get; set; }
    public string Url { get; set; } = "";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public List<int> ReporterIds { get; set; } = new();
    public List<int> AssigneeIds { get; set; } = new();
    public List<int> DependencyTaskIds { get; set; } = new();
}

public sealed class ReorderTasksInput
{
    public List<int> TaskIds { get; set; } = new();
}

public sealed class UserInput
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Nickname { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public string HomePageUrl { get; set; } = "";
    public string SocialMediaUrl { get; set; } = "";
    public string Bio { get; set; } = "";
    public bool IsAdmin { get; set; }
    public string Role { get; set; } = "Developer";
}

public sealed class LookupInput
{
    public int Id { get; set; }
    public string LookupType { get; set; } = "";
    public string Value { get; set; } = "";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string ColorHex { get; set; } = "";
}

public sealed class HolidayInput
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime HolidayDate { get; set; }
    public string CountryCode { get; set; } = "PH";
    public bool IsActive { get; set; } = true;
}

public sealed class DevLogInput
{
    public int Id { get; set; }
    public int? ProjectId { get; set; }
    public DateTime LogDate { get; set; }
    public string BodyHtml { get; set; } = "";
    public bool IsPinned { get; set; }
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

public sealed class LoginInput
{
    public string Login { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class ChangePasswordInput
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}
