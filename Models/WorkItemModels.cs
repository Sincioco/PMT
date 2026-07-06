namespace PMT.Models;

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
    public int? LinkedBlogId { get; set; }
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
    public string AuditContext { get; set; } = "";
}

public sealed class ReorderTasksInput
{
    public List<int> TaskIds { get; set; } = new();
}

