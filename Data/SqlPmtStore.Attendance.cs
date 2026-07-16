using System.Data;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public async Task<AttendanceCalendarDto> GetAttendanceCalendarAsync(
        DateTime startDate,
        DateTime endDate,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var editVersions = await ReadEditVersionsAsync(connection, currentUserId, "Vacation", cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetAttendanceCalendar]");
        AddDate(command, "@StartDate", startDate);
        AddDate(command, "@EndDate", endDate);
        Add(command, "@CurrentUserId", currentUserId);

        var calendar = new AttendanceCalendarDto();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            calendar.Entries.Add(new AttendanceEntryDto
            {
                Id = reader.GetInt32("AttendanceEntryId"),
                UserId = reader.GetInt32("UserId"),
                AttendanceDate = reader.GetDateTime("AttendanceDate"),
                Status = reader.GetStringOrEmpty("Status"),
                RecordedByUserId = reader.GetInt32("CreatedByUserId"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
            });
        }

        await reader.NextResultAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            calendar.Vacations.Add(new VacationPlanDto
            {
                Id = reader.GetInt32("VacationPlanId"),
                UserId = reader.GetInt32("UserId"),
                StartDate = reader.GetDateTime("StartDate"),
                EndDate = reader.GetDateTime("EndDate"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
            });
        }

        foreach (var vacation in calendar.Vacations)
        {
            if (editVersions.TryGetValue(("Vacation", vacation.Id.ToString()), out var rowVersion))
            {
                vacation.RowVersion = rowVersion;
            }
        }

        return calendar;
    }

    public Task<int> RecordAttendanceAsync(
        AttendanceInput input,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[RecordAttendance]", "@AttendanceEntryId", 0, command =>
        {
            Add(command, "@UserId", input.UserId);
            Add(command, "@Status", SqlDbType.NVarChar, 20, input.Status);
            Add(command, "@CurrentUserId", currentUserId);
            AddNullableDate(command, "@AttendanceDate", input.AttendanceDate);
        }, cancellationToken);
    }

    public Task RemoveAttendanceAsync(
        int attendanceEntryId,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[RemoveAttendance]", command =>
        {
            Add(command, "@AttendanceEntryId", attendanceEntryId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> SaveVacationAsync(
        VacationInput input,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        return ExecuteVersionedIdProcedureAsync("Vacation", input.ExpectedRowVersion, "[pmt].[UpsertVacation]", "@VacationPlanId", input.Id, command =>
        {
            AddNullableDate(command, "@StartDate", input.StartDate);
            AddNullableDate(command, "@EndDate", input.EndDate);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task CancelVacationAsync(
        int vacationPlanId,
        int currentUserId,
        CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[CancelVacation]", command =>
        {
            Add(command, "@VacationPlanId", vacationPlanId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    private static void AddDate(Microsoft.Data.SqlClient.SqlCommand command, string name, DateTime value)
    {
        command.Parameters.Add(name, SqlDbType.Date).Value = value.Date;
    }

    private static void AddNullableDate(Microsoft.Data.SqlClient.SqlCommand command, string name, DateTime? value)
    {
        command.Parameters.Add(name, SqlDbType.Date).Value = value.HasValue ? value.Value.Date : DBNull.Value;
    }
}
