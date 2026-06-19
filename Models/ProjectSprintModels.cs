namespace PMT.Models;

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

