using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public Task<int> SaveUserAsync(UserInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertUser]", "@UserId", input.Id, command =>
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
        }, cancellationToken);
    }

    public Task<int> SaveLookupAsync(LookupInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertLookup]", "@LookupId", input.Id, command =>
        {
            Add(command, "@LookupType", SqlDbType.NVarChar, 60, input.LookupType);
            Add(command, "@Value", SqlDbType.NVarChar, 120, input.Value);
            Add(command, "@ColorHex", SqlDbType.NVarChar, 20, input.ColorHex);
            Add(command, "@DisplayOrder", input.DisplayOrder);
            Add(command, "@IsActive", input.IsActive);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteLookupAsync(int lookupId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteLookup]", command =>
        {
            Add(command, "@LookupId", lookupId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> SaveHolidayAsync(HolidayInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertHoliday]", "@HolidayId", input.Id, command =>
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
        return ExecuteProcedureAsync("[pmt].[DeleteUser]", command =>
        {
            Add(command, "@UserId", userId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

}
