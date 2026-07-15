namespace PMT.Models;

public sealed class AttendanceCalendarDto
{
    public List<AttendanceEntryDto> Entries { get; set; } = new();
    public List<VacationPlanDto> Vacations { get; set; } = new();
}

public sealed class AttendanceEntryDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateTime AttendanceDate { get; set; }
    public string Status { get; set; } = "";
    public int RecordedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public sealed class VacationPlanDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public sealed class AttendanceInput
{
    public int UserId { get; set; }
    public string Status { get; set; } = "";
}

public sealed class VacationInput
{
    public int Id { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public byte[]? ExpectedRowVersion { get; set; }
}
