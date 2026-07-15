using System.Data;
using System.Text.Json;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task RequirePermissionAsync(
        int currentUserId,
        string resourceKey,
        string right,
        CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[RequirePermission]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
            Add(command, "@ResourceKey", SqlDbType.NVarChar, 40, resourceKey);
            Add(command, "@Right", SqlDbType.NVarChar, 20, right);
        }, cancellationToken);
    }

    public Task RequireTaskPermissionAsync(
        int currentUserId,
        int taskId,
        string right,
        bool useBacklogPermission,
        CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[RequireTaskPermission]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
            Add(command, "@TaskId", taskId);
            Add(command, "@Right", SqlDbType.NVarChar, 20, right);
            Add(command, "@UseBacklogPermission", useBacklogPermission);
        }, cancellationToken);
    }

    public Task RequireDevLogPermissionAsync(
        int currentUserId,
        int devLogId,
        string right,
        CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[RequireDevLogPermission]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
            Add(command, "@DevLogId", devLogId);
            Add(command, "@Right", SqlDbType.NVarChar, 20, right);
        }, cancellationToken);
    }

    public Task SaveSecurityPermissionsAsync(
        string resourceKey,
        SaveSecurityPermissionsInput input,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        return ExecuteVersionedProcedureAsync("SecurityResource", resourceKey, input.ExpectedRowVersion, "[pmt].[SaveSecurityPermissions]", command =>
        {
            Add(command, "@ResourceKey", SqlDbType.NVarChar, 40, resourceKey);
            Add(command, "@RolePermissionsJson", SqlDbType.NVarChar, -1, JsonSerializer.Serialize(input.RolePermissions));
            Add(command, "@UserPermissionsJson", SqlDbType.NVarChar, -1, JsonSerializer.Serialize(input.UserPermissions));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task ResetSecurityPermissionsAsync(
        int currentUserId,
        CancellationToken cancellationToken)
    {
        return ExecuteProcedureAndTouchEditVersionAsync("[pmt].[ResetSecurityPermissions]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, "SecurityResource", null, cancellationToken);
    }
}
