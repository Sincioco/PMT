namespace PMT.Models;

public sealed class LookupDto
{
    public int Id { get; set; }
    public string LookupType { get; set; } = "";
    public string Value { get; set; } = "";
    public string Code { get; set; } = "";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string ColorHex { get; set; } = "";
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
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
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public sealed class LookupInput
{
    public int Id { get; set; }
    public string LookupType { get; set; } = "";
    public string Value { get; set; } = "";
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string ColorHex { get; set; } = "";
    public byte[]? ExpectedRowVersion { get; set; }
}

public sealed class HolidayInput
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime HolidayDate { get; set; }
    public string CountryCode { get; set; } = "PH";
    public bool IsActive { get; set; } = true;
    public byte[]? ExpectedRowVersion { get; set; }
}

public sealed class MaintenanceRecycleItemDto
{
    public string ItemType { get; set; } = "";
    public int ItemId { get; set; }
    public string Label { get; set; } = "";
    public string Details { get; set; } = "";
    public DateTime DeletedAt { get; set; }
    public bool IsCascade { get; set; }
}

public sealed class MaintenanceRecycleSelection
{
    public List<MaintenanceRecycleSelectionItem> Items { get; set; } = new();
    public List<MaintenanceRecycleSelectionItem> ExpectedItems { get; set; } = new();
}

public sealed class MaintenanceRecycleSelectionItem
{
    public string ItemType { get; set; } = "";
    public int ItemId { get; set; }
}

public sealed class MaintenanceOrphanFileDto
{
    public string RelativePath { get; set; } = "";
    public string FileName { get; set; } = "";
    public string Category { get; set; } = "";
    public string Url { get; set; } = "";
    public long ByteLength { get; set; }
    public DateTime LastModifiedAt { get; set; }
}

public sealed class MaintenanceFileSelection
{
    public List<string> RelativePaths { get; set; } = new();
}

public sealed class MaintenanceFileDeleteResult
{
    public List<MaintenanceFileDeleteItemResult> Results { get; set; } = new();
    public int DeletedCount { get; set; }
    public int SkippedCount { get; set; }
    public int FailedCount { get; set; }
}

public sealed class MaintenanceFileDeleteItemResult
{
    public string RelativePath { get; set; } = "";
    public string Status { get; set; } = "";
    public string Message { get; set; } = "";
}

