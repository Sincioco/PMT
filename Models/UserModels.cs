namespace PMT.Models;

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
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
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
    public byte[]? ExpectedRowVersion { get; set; }
}

public sealed class UsernameSuggestionDto
{
    public string Username { get; set; } = "";
    public bool IsAvailable { get; set; }
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

public sealed class AdminResetPasswordInput
{
    public string NewPassword { get; set; } = "";
}

