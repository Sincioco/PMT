namespace PMT.Models;

public sealed class LookupDto
{
    public int Id { get; set; }
    public string LookupType { get; set; } = "";
    public string Value { get; set; } = "";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string ColorHex { get; set; } = "";
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

