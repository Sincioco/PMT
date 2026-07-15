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
    public List<LookupDto> Roles { get; set; } = new();
    public List<HolidayDto> Holidays { get; set; } = new();
    public List<SecurityResourceDto> SecurityResources { get; set; } = new();
    public List<RoleSecurityPermissionDto> RolePermissions { get; set; } = new();
    public List<UserSecurityPermissionDto> UserPermissions { get; set; } = new();
    public List<EffectivePermissionDto> EffectivePermissions { get; set; } = new();
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
    public int ActorUserId { get; set; }
    public string UserName { get; set; } = "";
    public string ActorUserName { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

