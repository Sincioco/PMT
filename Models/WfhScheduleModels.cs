namespace PMT.Models;

public sealed class WfhScheduleDto
{
    public int UserId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Nickname { get; set; } = "";
    public string AvatarUrl { get; set; } = "";
    public string Role { get; set; } = "Developer";
    public bool CanWorkMonday { get; set; }
    public bool CanWorkTuesday { get; set; }
    public bool CanWorkWednesday { get; set; }
    public bool CanWorkThursday { get; set; }
    public bool CanWorkFriday { get; set; }
    public bool IsHidden { get; set; }
    public int SortOrder { get; set; }
}

public sealed class WfhScheduleInput
{
    public int UserId { get; set; }
    public bool CanWorkMonday { get; set; }
    public bool CanWorkTuesday { get; set; }
    public bool CanWorkWednesday { get; set; }
    public bool CanWorkThursday { get; set; }
    public bool CanWorkFriday { get; set; }
    public bool IsHidden { get; set; }
}

public sealed class ReorderWfhScheduleInput
{
    public List<int> UserIds { get; set; } = new();
}
