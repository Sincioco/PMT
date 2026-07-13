namespace PMT.Models;

public sealed class CreateInvitationInput
{
    public List<int> ProjectIds { get; set; } = new();
}

public sealed class InvitationProjectDto
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Title { get; set; } = "";
    public string IconUrl { get; set; } = "";
}

public sealed class InvitationDto
{
    public DateTime ExpiresAt { get; set; }
    public List<InvitationProjectDto> Projects { get; set; } = new();
}

public sealed class AcceptInvitationInput
{
    public string Nickname { get; set; } = "";
    public string Password { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
}

public sealed class AcceptInvitationResult
{
    public int UserId { get; set; }
    public string Nickname { get; set; } = "";
    public bool IsAdmin { get; set; }
    public string Role { get; set; } = "Developer";
    public string NextView { get; set; } = "Projects";
    public int? ProjectId { get; set; }
}
