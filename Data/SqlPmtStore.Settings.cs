using System.Data;
using System.Text.Json;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public async Task<UsernameSuggestionDto> SuggestUsernameAsync(
        string username,
        int excludeUserId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[SuggestUsername]");
        Add(command, "@PreferredUsername", SqlDbType.NVarChar, 80, username);
        Add(command, "@ExcludeUserId", Math.Max(0, excludeUserId));

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException("A username suggestion could not be created.");
        }

        return new UsernameSuggestionDto
        {
            Username = reader.GetStringOrEmpty("Username"),
            IsAvailable = reader.GetBoolean("IsAvailable")
        };
    }

    public Task<int> SaveUserAsync(UserInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("User", input.ExpectedRowVersion, "[pmt].[UpsertUser]", "@UserId", input.Id, command =>
        {
            Add(command, "@FirstName", SqlDbType.NVarChar, 80, input.FirstName);
            Add(command, "@LastName", SqlDbType.NVarChar, 80, input.LastName);
            Add(command, "@Nickname", SqlDbType.NVarChar, 80, input.Nickname);
            Add(command, "@Email", SqlDbType.NVarChar, 180, input.Email);
            Add(command, "@Phone", SqlDbType.NVarChar, 60, input.Phone);
            Add(command, "@AvatarUrl", SqlDbType.NVarChar, 500, input.AvatarUrl);
            Add(command, "@HomePageUrl", SqlDbType.NVarChar, 500, input.HomePageUrl);
            Add(command, "@SocialMediaUrl", SqlDbType.NVarChar, 500, input.SocialMediaUrl);
            Add(command, "@Bio", SqlDbType.NVarChar, -1, input.Bio);
            Add(command, "@IsAdmin", input.IsAdmin);
            Add(command, "@Role", SqlDbType.NVarChar, 20, input.Role);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, touchSecurityResources: true);
    }

    public Task<int> SaveLookupAsync(LookupInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("Lookup", input.ExpectedRowVersion, "[pmt].[UpsertLookup]", "@LookupId", input.Id, command =>
        {
            Add(command, "@LookupType", SqlDbType.NVarChar, 60, input.LookupType);
            Add(command, "@Value", SqlDbType.NVarChar, 120, input.Value);
            Add(command, "@ColorHex", SqlDbType.NVarChar, 20, input.ColorHex);
            Add(command, "@DisplayOrder", input.DisplayOrder);
            Add(command, "@IsActive", input.IsActive);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken, touchSecurityResources: string.Equals(input.LookupType?.Trim(), "Role", StringComparison.OrdinalIgnoreCase));
    }

    public Task DeleteLookupAsync(int lookupId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAndTouchEditVersionAsync("[pmt].[DeleteLookup]", command =>
        {
            Add(command, "@LookupId", lookupId);
            Add(command, "@CurrentUserId", currentUserId);
        }, "SecurityResource", null, cancellationToken);
    }

    public Task<int> SaveHolidayAsync(HolidayInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("Holiday", input.ExpectedRowVersion, "[pmt].[UpsertHoliday]", "@HolidayId", input.Id, command =>
        {
            Add(command, "@Name", SqlDbType.NVarChar, 160, input.Name);
            Add(command, "@HolidayDate", input.HolidayDate.Date);
            Add(command, "@CountryCode", SqlDbType.NVarChar, 10, input.CountryCode);
            Add(command, "@IsActive", input.IsActive);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteHolidayAsync(int holidayId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteHoliday]", command =>
        {
            Add(command, "@HolidayId", holidayId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteUserAsync(int userId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAndTouchEditVersionAsync("[pmt].[DeleteUser]", command =>
        {
            Add(command, "@UserId", userId);
            Add(command, "@CurrentUserId", currentUserId);
        }, "SecurityResource", null, cancellationToken);
    }

    public async Task<List<MaintenanceRecycleItemDto>> GetMaintenanceRecycleBinAsync(
        int currentUserId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetMaintenanceRecycleBin]");
        Add(command, "@CurrentUserId", currentUserId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await ReadMaintenanceRecycleItemsAsync(reader, cancellationToken);
    }

    public async Task<List<MaintenanceRecycleItemDto>> ProcessMaintenanceRecycleBinAsync(
        MaintenanceRecycleSelection selection,
        int currentUserId,
        bool purge,
        CancellationToken cancellationToken)
    {
        var itemsJson = JsonSerializer.Serialize((selection.Items ?? new()).Select(item => new
        {
            itemType = item.ItemType,
            itemId = item.ItemId
        }));
        var expectedItemsJson = JsonSerializer.Serialize((selection.ExpectedItems ?? new()).Select(item => new
        {
            itemType = item.ItemType,
            itemId = item.ItemId
        }));

        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[ProcessMaintenanceRecycleBin]");
        Add(command, "@ItemsJson", SqlDbType.NVarChar, -1, itemsJson);
        Add(command, "@ExpectedItemsJson", SqlDbType.NVarChar, -1, expectedItemsJson);
        Add(command, "@CurrentUserId", currentUserId);
        Add(command, "@Purge", purge);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await ReadMaintenanceRecycleItemsAsync(reader, cancellationToken);
    }

    public async Task<HashSet<string>> FindReferencedUploadPathsAsync(
        IEnumerable<string> relativePaths,
        string requestPath,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        var pathsJson = JsonSerializer.Serialize(relativePaths
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.OrdinalIgnoreCase));

        var referencedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[FindReferencedUploadPaths]");
        Add(command, "@RelativePathsJson", SqlDbType.NVarChar, -1, pathsJson);
        Add(command, "@RequestPath", SqlDbType.NVarChar, 500, requestPath);
        Add(command, "@CurrentUserId", currentUserId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var relativePath = reader.GetStringOrEmpty("RelativePath").Trim();
            if (!string.IsNullOrWhiteSpace(relativePath)) referencedPaths.Add(relativePath);
        }

        return referencedPaths;
    }

    private static async Task<List<MaintenanceRecycleItemDto>> ReadMaintenanceRecycleItemsAsync(
        Microsoft.Data.SqlClient.SqlDataReader reader,
        CancellationToken cancellationToken)
    {
        var items = new List<MaintenanceRecycleItemDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new MaintenanceRecycleItemDto
            {
                ItemType = reader.GetStringOrEmpty("ItemType"),
                ItemId = reader.GetInt32("ItemId"),
                Label = reader.GetStringOrEmpty("Label"),
                Details = reader.GetStringOrEmpty("Details"),
                DeletedAt = DateTime.SpecifyKind(reader.GetDateTime("DeletedAt"), DateTimeKind.Utc),
                IsCascade = reader.GetBoolean("IsCascade")
            });
        }

        return items;
    }

}
