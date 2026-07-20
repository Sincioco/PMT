namespace PMT.Models;

public sealed class GameScoreDto
{
    public int Id { get; set; }
    public string GameKey { get; set; } = "";
    public int? PlayerUserId { get; set; }
    public string PlayerName { get; set; } = "";
    public int Score { get; set; }
    public int DurationSeconds { get; set; }
    public bool Won { get; set; }
    public DateTime CreatedAt { get; set; }
}

public sealed class SaveGameScoreInput
{
    public string GameKey { get; set; } = "";
    public int Score { get; set; }
    public int DurationSeconds { get; set; }
    public bool Won { get; set; }
}
