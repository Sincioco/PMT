namespace PMT.Models;

public sealed class SecurityResourceDto
{
    public string ResourceKey { get; set; } = "";
    public string Name { get; set; } = "";
    public string AvailableRights { get; set; } = "Read";
    public int DisplayOrder { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public class SecurityPermissionDto
{
    public string ResourceKey { get; set; } = "";
    public bool CanRead { get; set; }
    public bool CanCreate { get; set; }
    public bool CanUpdate { get; set; }
    public bool CanDelete { get; set; }
    public bool CanImport { get; set; }
    public bool CanExport { get; set; }
    public bool NoAccess { get; set; }
}

public sealed class RoleSecurityPermissionDto : SecurityPermissionDto
{
    public string RoleCode { get; set; } = "";
}

public sealed class UserSecurityPermissionDto : SecurityPermissionDto
{
    public int UserId { get; set; }
    public bool IsOverride { get; set; }
}

public sealed class EffectivePermissionDto : SecurityPermissionDto
{
}

public sealed class SaveSecurityPermissionsInput
{
    public List<RoleSecurityPermissionDto> RolePermissions { get; set; } = new();
    public List<UserSecurityPermissionDto> UserPermissions { get; set; } = new();
    public byte[]? ExpectedRowVersion { get; set; }
}
