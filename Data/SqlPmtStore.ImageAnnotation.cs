using System.Data;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    private const string EmptyImageAnnotationTemplateLibrary =
        "{\"version\":1,\"templates\":[],\"defaults\":{\"arrow\":null,\"rectangle\":null}}";

    public async Task<string> GetUserImageAnnotationTemplateLibraryAsync(
        int currentUserId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetUserImageAnnotationTemplateLibrary]");
        Add(command, "@CurrentUserId", currentUserId);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is string libraryJson && !string.IsNullOrWhiteSpace(libraryJson)
            ? libraryJson
            : EmptyImageAnnotationTemplateLibrary;
    }

    public async Task<string> SaveUserImageAnnotationTemplateLibraryAsync(
        string libraryJson,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[SaveUserImageAnnotationTemplateLibrary]");
        Add(command, "@LibraryJson", SqlDbType.NVarChar, -1, libraryJson);
        Add(command, "@CurrentUserId", currentUserId);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is string savedJson && !string.IsNullOrWhiteSpace(savedJson)
            ? savedJson
            : libraryJson;
    }
}
