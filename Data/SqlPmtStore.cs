using System.Data;
using System.Text;
using Microsoft.Data.SqlClient;
using PMT.Models;

namespace PMT.Data;

public sealed class SqlPmtStore
{
    private readonly string _connectionString;

    public SqlPmtStore(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("PmtDatabase")
            ?? throw new InvalidOperationException("Missing ConnectionStrings:PmtDatabase.");
    }

    public async Task<AppState> GetStateAsync(CancellationToken cancellationToken)
    {
        // The UI needs many related lists at once. One stored procedure returns
        // simple result sets, then this class connects those sets into DTOs.
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetAppState]");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var state = new AppState();
        state.Users = await ReadUsersAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.Projects = await ReadProjectsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var projectMembers = await ReadPairsAsync(reader, "ProjectId", "UserId", cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.Sprints = await ReadSprintsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var sprintMembers = await ReadPairsAsync(reader, "SprintId", "UserId", cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.Tasks = await ReadTasksAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var taskAssignees = await ReadPairsAsync(reader, "TaskId", "UserId", cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var taskReporters = await ReadPairsAsync(reader, "TaskId", "UserId", cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var taskDependencies = await ReadPairsAsync(reader, "TaskId", "DependsOnTaskId", cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var attachments = await ReadAttachmentsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var taskAttachments = await ReadPairsAsync(reader, "TaskId", "AttachmentId", cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.DevLogs = await ReadDevLogsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.Blogs = await ReadBlogsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var blogAttachments = await ReadPairsAsync(reader, "BlogId", "AttachmentId", cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        var blogHistory = await ReadBlogHistoryAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.AuditEvents = await ReadAuditEventsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.Lookups = await ReadLookupsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.Holidays = await ReadHolidaysAsync(reader, cancellationToken);

        HydrateState(state, projectMembers, sprintMembers, taskAssignees, taskReporters, taskDependencies, attachments, taskAttachments, blogAttachments, blogHistory);
        return state;
    }

    public async Task<UserDto?> LoginAsync(LoginInput input, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[LoginUser]");
        Add(command, "@Login", SqlDbType.NVarChar, 180, input.Login);
        Add(command, "@Password", SqlDbType.NVarChar, 4000, input.Password);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new UserDto
        {
            Id = reader.GetInt32("UserId"),
            Nickname = reader.GetStringOrEmpty("Nickname"),
            IsAdmin = reader.GetBoolean("IsAdmin"),
            Role = reader.GetStringOrEmpty("Role")
        };
    }

    public Task ChangePasswordAsync(int userId, ChangePasswordInput input, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[ChangePassword]", command =>
        {
            Add(command, "@UserId", userId);
            Add(command, "@CurrentPassword", SqlDbType.NVarChar, 4000, input.CurrentPassword);
            Add(command, "@NewPassword", SqlDbType.NVarChar, 4000, input.NewPassword);
        }, cancellationToken);
    }

    public Task<int> SaveProjectAsync(ProjectInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertProject]", "@ProjectId", input.Id, command =>
        {
            Add(command, "@Code", SqlDbType.NVarChar, 20, input.Code);
            Add(command, "@Title", SqlDbType.NVarChar, 160, input.Title);
            Add(command, "@Description", SqlDbType.NVarChar, -1, input.Description);
            Add(command, "@Url", SqlDbType.NVarChar, 500, input.Url);
            Add(command, "@IconUrl", SqlDbType.NVarChar, 500, input.IconUrl);
            AddNullable(command, "@StartDate", input.StartDate);
            AddNullable(command, "@EndDate", input.EndDate);
            Add(command, "@MemberIdsCsv", SqlDbType.NVarChar, -1, Csv(input.MemberIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteProjectAsync(int projectId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteProject]", command =>
        {
            Add(command, "@ProjectId", projectId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> SaveSprintAsync(SprintInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertSprint]", "@SprintId", input.Id, command =>
        {
            AddNullable(command, "@ProjectId", input.ProjectId);
            Add(command, "@Title", SqlDbType.NVarChar, 160, input.Title);
            Add(command, "@Description", SqlDbType.NVarChar, -1, input.Description);
            AddNullable(command, "@StartDate", input.StartDate);
            AddNullable(command, "@EndDate", input.EndDate);
            Add(command, "@LessonLearnedHtml", SqlDbType.NVarChar, -1, input.LessonLearnedHtml);
            Add(command, "@DeveloperIdsCsv", SqlDbType.NVarChar, -1, Csv(input.DeveloperIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> FinishSprintAsync(int sprintId, FinishSprintInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[FinishSprint]", "@NewSprintId", 0, command =>
        {
            Add(command, "@SprintId", sprintId);
            Add(command, "@CarryUnfinished", input.CarryUnfinished);
            Add(command, "@CarryTodos", input.CarryTodos);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteSprintAsync(int sprintId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteSprint]", command =>
        {
            Add(command, "@SprintId", sprintId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> SaveTaskAsync(WorkTaskInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertTask]", "@TaskId", input.Id, command =>
        {
            AddNullable(command, "@ProjectId", input.ProjectId);
            AddNullable(command, "@SprintId", input.SprintId);
            AddNullable(command, "@ParentTaskId", input.ParentTaskId);
            Add(command, "@TaskType", SqlDbType.NVarChar, 20, input.TaskType);
            Add(command, "@Title", SqlDbType.NVarChar, 220, input.Title);
            Add(command, "@DescriptionHtml", SqlDbType.NVarChar, -1, input.DescriptionHtml);
            Add(command, "@StepsToReproduceHtml", SqlDbType.NVarChar, -1, input.StepsToReproduceHtml);
            Add(command, "@ActualResultHtml", SqlDbType.NVarChar, -1, input.ActualResultHtml);
            Add(command, "@ExpectedResultHtml", SqlDbType.NVarChar, -1, input.ExpectedResultHtml);
            Add(command, "@Environment", SqlDbType.NVarChar, 40, input.Environment);
            Add(command, "@Severity", SqlDbType.NVarChar, 40, input.Severity);
            Add(command, "@Status", SqlDbType.NVarChar, 40, input.Status);
            Add(command, "@Priority", SqlDbType.NVarChar, 20, input.Priority);
            Add(command, "@PercentCompleted", input.PercentCompleted);
            Add(command, "@Url", SqlDbType.NVarChar, 500, input.Url);
            AddNullable(command, "@StartDate", input.StartDate);
            AddNullable(command, "@EndDate", input.EndDate);
            Add(command, "@ReporterIdsCsv", SqlDbType.NVarChar, -1, Csv(input.ReporterIds));
            Add(command, "@AssigneeIdsCsv", SqlDbType.NVarChar, -1, Csv(input.AssigneeIds));
            Add(command, "@DependencyTaskIdsCsv", SqlDbType.NVarChar, -1, Csv(input.DependencyTaskIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task ReorderTasksAsync(ReorderTasksInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[ReorderTasks]", command =>
        {
            Add(command, "@TaskIdsCsv", SqlDbType.NVarChar, -1, OrderedCsv(input.TaskIds));
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> DuplicateTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[DuplicateTask]", "@NewTaskId", 0, command =>
        {
            Add(command, "@TaskId", taskId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteTaskAsync(int taskId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteTask]", command =>
        {
            Add(command, "@TaskId", taskId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

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

    public Task<int> SaveDevLogAsync(DevLogInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertDevLog]", "@DevLogId", input.Id, command =>
        {
            Add(command, "@LogDate", input.LogDate.Date);
            Add(command, "@BodyHtml", SqlDbType.NVarChar, -1, input.BodyHtml);
            AddNullable(command, "@ProjectId", input.ProjectId);
            Add(command, "@IsPinned", input.IsPinned);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteDevLogAsync(int devLogId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteDevLog]", command =>
        {
            Add(command, "@DevLogId", devLogId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> SaveBlogAsync(BlogInput input, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[UpsertBlog]", "@BlogId", input.Id, command =>
        {
            Add(command, "@Title", SqlDbType.NVarChar, 220, input.Title);
            Add(command, "@BodyHtml", SqlDbType.NVarChar, -1, input.BodyHtml);
            AddNullable(command, "@ProjectId", input.ProjectId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DeleteBlogAsync(int blogId, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DeleteBlog]", command =>
        {
            Add(command, "@BlogId", blogId);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> AddTaskAttachmentAsync(int taskId, UploadResult upload, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[AddTaskAttachment]", "@AttachmentId", 0, command =>
        {
            Add(command, "@TaskId", taskId);
            AddUpload(command, upload);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task<int> AddBlogAttachmentAsync(int blogId, UploadResult upload, int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteIdProcedureAsync("[pmt].[AddBlogAttachment]", "@AttachmentId", 0, command =>
        {
            Add(command, "@BlogId", blogId);
            AddUpload(command, upload);
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DevelopmentClearNonPmtAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DevelopmentClearNonPmt]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DevelopmentClearPmtAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DevelopmentClearPmt]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public Task DevelopmentClearUsersAsync(int currentUserId, CancellationToken cancellationToken)
    {
        return ExecuteProcedureAsync("[pmt].[DevelopmentClearUsers]", command =>
        {
            Add(command, "@CurrentUserId", currentUserId);
        }, cancellationToken);
    }

    public async Task RestoreInitialSeedDataAsync(string contentRootPath, int currentUserId, CancellationToken cancellationToken)
    {
        // Restoring seed data means replaying the same scripts used by a clean rebuild.
        // Keeping this path simple helps junior developers update one source of truth.
        var scriptPaths = new[]
        {
            Path.Combine(contentRootPath, "Sql", "03_SeedData.sql"),
            Path.Combine(contentRootPath, "Sql", "03_SeedData_LMS.sql"),
            Path.Combine(contentRootPath, "Sql", "03_SeedData_HLS.sql")
        };

        await using var connection = await OpenConnectionAsync(cancellationToken);
        await EnsureCurrentUserIsAdminAsync(connection, currentUserId, cancellationToken);

        foreach (var scriptPath in scriptPaths)
        {
            if (!File.Exists(scriptPath))
            {
                throw new FileNotFoundException($"Seed script was not found: {scriptPath}");
            }

            var script = await File.ReadAllTextAsync(scriptPath, cancellationToken);
            foreach (var batch in SplitSqlBatches(script))
            {
                await using var command = new SqlCommand(batch, connection)
                {
                    CommandType = CommandType.Text,
                    CommandTimeout = 180
                };

                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
    }

    private async Task<SqlConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }

    private async Task ExecuteProcedureAsync(string procedureName, Action<SqlCommand> configure, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, procedureName);
        configure(command);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<int> ExecuteIdProcedureAsync(string procedureName, string idParameterName, int id, Action<SqlCommand> configure, CancellationToken cancellationToken)
    {
        // Insert/update procedures use an input-output id parameter so callers
        // can use the same method for both "create" and "save" screens.
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, procedureName);
        var idParameter = command.Parameters.Add(idParameterName, SqlDbType.Int);
        idParameter.Direction = ParameterDirection.InputOutput;
        idParameter.Value = id;
        configure(command);
        await command.ExecuteNonQueryAsync(cancellationToken);
        return Convert.ToInt32(idParameter.Value);
    }

    private static SqlCommand StoredProcedure(SqlConnection connection, string procedureName)
    {
        return new SqlCommand(procedureName, connection)
        {
            CommandType = CommandType.StoredProcedure,
            CommandTimeout = 60
        };
    }

    private static async Task EnsureCurrentUserIsAdminAsync(SqlConnection connection, int currentUserId, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand("SELECT [pmt].[IsAdmin](@CurrentUserId)", connection)
        {
            CommandType = CommandType.Text,
            CommandTimeout = 60
        };
        Add(command, "@CurrentUserId", currentUserId);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (!Convert.ToBoolean(result))
        {
            throw new InvalidOperationException("Only an administrator can restore seed data.");
        }
    }

    private static IEnumerable<string> SplitSqlBatches(string script)
    {
        // SQLCMD uses GO as a batch separator. SqlCommand does not understand GO,
        // so split the scripts into batches before sending them to SQL Server.
        var batch = new StringBuilder();
        using var reader = new StringReader(script);

        while (reader.ReadLine() is { } line)
        {
            if (line.Trim().Equals("GO", StringComparison.OrdinalIgnoreCase))
            {
                var sql = batch.ToString().Trim();
                if (!string.IsNullOrWhiteSpace(sql))
                {
                    yield return sql;
                }

                batch.Clear();
                continue;
            }

            batch.AppendLine(line);
        }

        var finalSql = batch.ToString().Trim();
        if (!string.IsNullOrWhiteSpace(finalSql))
        {
            yield return finalSql;
        }
    }

    private static void AddUpload(SqlCommand command, UploadResult upload)
    {
        Add(command, "@FileName", SqlDbType.NVarChar, 260, upload.FileName);
        Add(command, "@Url", SqlDbType.NVarChar, 500, upload.Url);
        Add(command, "@ContentType", SqlDbType.NVarChar, 160, upload.ContentType);
        Add(command, "@ByteLength", upload.ByteLength);
    }

    private static void Add(SqlCommand command, string name, int value) => command.Parameters.Add(name, SqlDbType.Int).Value = value;
    private static void Add(SqlCommand command, string name, long value) => command.Parameters.Add(name, SqlDbType.BigInt).Value = value;
    private static void Add(SqlCommand command, string name, bool value) => command.Parameters.Add(name, SqlDbType.Bit).Value = value;
    private static void Add(SqlCommand command, string name, DateTime value) => command.Parameters.Add(name, SqlDbType.DateTime2).Value = value;
    private static void AddNullable(SqlCommand command, string name, int? value) => command.Parameters.Add(name, SqlDbType.Int).Value = value.HasValue ? value.Value : DBNull.Value;
    private static void AddNullable(SqlCommand command, string name, DateTime? value) => command.Parameters.Add(name, SqlDbType.DateTime2).Value = value.HasValue ? value.Value.Date : DBNull.Value;

    private static void Add(SqlCommand command, string name, SqlDbType type, int size, string? value)
    {
        var parameter = command.Parameters.Add(name, type, size);
        parameter.Value = string.IsNullOrWhiteSpace(value) ? DBNull.Value : value.Trim();
    }

    private static string Csv(IEnumerable<int> values)
    {
        // SQL Server 2019 has STRING_SPLIT, so a small CSV keeps procedure
        // parameters readable without requiring table-valued parameters.
        return string.Join(",", values.Where(value => value > 0).Distinct().OrderBy(value => value));
    }

    private static string OrderedCsv(IEnumerable<int> values)
    {
        // Reordering depends on the exact sequence from the browser, so do not sort these IDs.
        return string.Join(",", values.Where(value => value > 0).Distinct());
    }

    private static async Task<List<UserDto>> ReadUsersAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var users = new List<UserDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            users.Add(new UserDto
            {
                Id = reader.GetInt32("UserId"),
                FirstName = reader.GetStringOrEmpty("FirstName"),
                LastName = reader.GetStringOrEmpty("LastName"),
                Nickname = reader.GetStringOrEmpty("Nickname"),
                Email = reader.GetStringOrEmpty("Email"),
                Phone = reader.GetStringOrEmpty("Phone"),
                AvatarUrl = reader.GetStringOrEmpty("AvatarUrl"),
                HomePageUrl = reader.GetStringOrEmpty("HomePageUrl"),
                SocialMediaUrl = reader.GetStringOrEmpty("SocialMediaUrl"),
                Bio = reader.GetStringOrEmpty("Bio"),
                IsAdmin = reader.GetBoolean("IsAdmin"),
                Role = reader.GetStringOrEmpty("Role"),
                IsActive = reader.GetBoolean("IsActive")
            });
        }

        return users;
    }

    private static async Task<List<ProjectDto>> ReadProjectsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var projects = new List<ProjectDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            projects.Add(new ProjectDto
            {
                Id = reader.GetInt32("ProjectId"),
                Code = reader.GetStringOrEmpty("Code"),
                Title = reader.GetStringOrEmpty("Title"),
                Description = reader.GetStringOrEmpty("Description"),
                Url = reader.GetStringOrEmpty("Url"),
                IconUrl = reader.GetStringOrEmpty("IconUrl"),
                StartDate = reader.GetNullableDateTime("StartDate"),
                EndDate = reader.GetNullableDateTime("EndDate"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                UpdatedByUserId = reader.GetNullableInt32("UpdatedByUserId"),
                CreatedAt = reader.GetDateTime("CreatedAt"),
                UpdatedAt = reader.GetDateTime("UpdatedAt")
            });
        }

        return projects;
    }

    private static async Task<List<SprintDto>> ReadSprintsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var sprints = new List<SprintDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            sprints.Add(new SprintDto
            {
                Id = reader.GetInt32("SprintId"),
                ProjectId = reader.GetInt32("ProjectId"),
                Code = reader.GetStringOrEmpty("Code"),
                Title = reader.GetStringOrEmpty("Title"),
                Description = reader.GetStringOrEmpty("Description"),
                StartDate = reader.GetNullableDateTime("StartDate"),
                EndDate = reader.GetNullableDateTime("EndDate"),
                LessonLearnedHtml = reader.GetStringOrEmpty("LessonLearnedHtml"),
                IsFinished = reader.GetBoolean("IsFinished"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                UpdatedByUserId = reader.GetNullableInt32("UpdatedByUserId"),
                CreatedAt = reader.GetDateTime("CreatedAt"),
                UpdatedAt = reader.GetDateTime("UpdatedAt")
            });
        }

        return sprints;
    }

    private static async Task<List<WorkTaskDto>> ReadTasksAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var tasks = new List<WorkTaskDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            tasks.Add(new WorkTaskDto
            {
                Id = reader.GetInt32("TaskId"),
                ProjectId = reader.GetInt32("ProjectId"),
                SprintId = reader.GetNullableInt32("SprintId"),
                ParentTaskId = reader.GetNullableInt32("ParentTaskId"),
                TaskType = reader.GetStringOrEmpty("TaskType"),
                Code = reader.GetStringOrEmpty("Code"),
                Title = reader.GetStringOrEmpty("Title"),
                DescriptionHtml = reader.GetStringOrEmpty("DescriptionHtml"),
                StepsToReproduceHtml = reader.GetStringOrEmpty("StepsToReproduceHtml"),
                ActualResultHtml = reader.GetStringOrEmpty("ActualResultHtml"),
                ExpectedResultHtml = reader.GetStringOrEmpty("ExpectedResultHtml"),
                Environment = reader.GetStringOrEmpty("Environment"),
                Severity = reader.GetStringOrEmpty("Severity"),
                Status = reader.GetStringOrEmpty("Status"),
                Priority = reader.GetStringOrEmpty("Priority"),
                SortOrder = reader.GetInt32("SortOrder"),
                PercentCompleted = reader.GetInt32("PercentCompleted"),
                Url = reader.GetStringOrEmpty("Url"),
                StartDate = reader.GetNullableDateTime("StartDate"),
                EndDate = reader.GetNullableDateTime("EndDate"),
                StartedAt = reader.GetNullableDateTime("StartedAt"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                UpdatedByUserId = reader.GetNullableInt32("UpdatedByUserId"),
                LinkedBugTaskId = reader.GetNullableInt32("LinkedBugTaskId"),
                CreatedAt = reader.GetDateTime("CreatedAt"),
                UpdatedAt = reader.GetDateTime("UpdatedAt")
            });
        }

        return tasks;
    }

    private static async Task<List<AttachmentDto>> ReadAttachmentsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var attachments = new List<AttachmentDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            attachments.Add(new AttachmentDto
            {
                Id = reader.GetInt32("AttachmentId"),
                FileName = reader.GetStringOrEmpty("FileName"),
                Url = reader.GetStringOrEmpty("Url"),
                ContentType = reader.GetStringOrEmpty("ContentType"),
                ByteLength = reader.GetInt64("ByteLength"),
                UploadedByUserId = reader.GetInt32("UploadedByUserId"),
                CreatedAt = reader.GetDateTime("CreatedAt")
            });
        }

        return attachments;
    }

    private static async Task<List<DevLogDto>> ReadDevLogsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var logs = new List<DevLogDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            logs.Add(new DevLogDto
            {
                Id = reader.GetInt32("DevLogId"),
                ProjectId = reader.GetNullableInt32("ProjectId"),
                UserId = reader.GetInt32("UserId"),
                LogDate = reader.GetDateTime("LogDate"),
                BodyHtml = reader.GetStringOrEmpty("BodyHtml"),
                IsPinned = reader.GetBoolean("IsPinned"),
                CreatedAt = reader.GetDateTime("CreatedAt"),
                UpdatedAt = reader.GetDateTime("UpdatedAt")
            });
        }

        return logs;
    }

    private static async Task<List<BlogPostDto>> ReadBlogsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var blogs = new List<BlogPostDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            blogs.Add(new BlogPostDto
            {
                Id = reader.GetInt32("BlogId"),
                ProjectId = reader.GetNullableInt32("ProjectId"),
                Title = reader.GetStringOrEmpty("Title"),
                BodyHtml = reader.GetStringOrEmpty("BodyHtml"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                CreatedAt = reader.GetDateTime("CreatedAt"),
                UpdatedAt = reader.GetDateTime("UpdatedAt")
            });
        }

        return blogs;
    }

    private static async Task<List<BlogHistoryDto>> ReadBlogHistoryAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var history = new List<BlogHistoryDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            history.Add(new BlogHistoryDto
            {
                Id = reader.GetInt32("BlogHistoryId"),
                BlogId = reader.GetInt32("BlogId"),
                Action = reader.GetStringOrEmpty("Action"),
                UserId = reader.GetInt32("UserId"),
                CreatedAt = reader.GetDateTime("CreatedAt")
            });
        }

        return history;
    }

    private static async Task<List<AuditEventDto>> ReadAuditEventsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var events = new List<AuditEventDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            events.Add(new AuditEventDto
            {
                Id = reader.GetInt32("AuditEventId"),
                EntityType = reader.GetStringOrEmpty("EntityType"),
                EntityId = reader.GetInt32("EntityId"),
                Action = reader.GetStringOrEmpty("Action"),
                Details = reader.GetStringOrEmpty("Details"),
                OldStatus = reader.GetStringOrEmpty("OldStatus"),
                NewStatus = reader.GetStringOrEmpty("NewStatus"),
                OldPercentCompleted = reader.GetNullableInt32("OldPercentCompleted"),
                NewPercentCompleted = reader.GetNullableInt32("NewPercentCompleted"),
                UserId = reader.GetInt32("UserId"),
                CreatedAt = reader.GetDateTime("CreatedAt")
            });
        }

        return events;
    }

    private static async Task<List<LookupDto>> ReadLookupsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var lookups = new List<LookupDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            lookups.Add(new LookupDto
            {
                Id = reader.GetInt32("LookupId"),
                LookupType = reader.GetStringOrEmpty("LookupType"),
                Value = reader.GetStringOrEmpty("Value"),
                ColorHex = reader.GetStringOrEmpty("ColorHex"),
                DisplayOrder = reader.GetInt32("DisplayOrder"),
                IsActive = reader.GetBoolean("IsActive")
            });
        }

        return lookups;
    }

    private static async Task<List<HolidayDto>> ReadHolidaysAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var holidays = new List<HolidayDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            holidays.Add(new HolidayDto
            {
                Id = reader.GetInt32("HolidayId"),
                Name = reader.GetStringOrEmpty("Name"),
                HolidayDate = reader.GetDateTime("HolidayDate"),
                CountryCode = reader.GetStringOrEmpty("CountryCode"),
                IsActive = reader.GetBoolean("IsActive"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                UpdatedByUserId = reader.GetNullableInt32("UpdatedByUserId"),
                CreatedAt = reader.GetDateTime("CreatedAt"),
                UpdatedAt = reader.GetDateTime("UpdatedAt")
            });
        }

        return holidays;
    }

    private static async Task<List<(int Left, int Right)>> ReadPairsAsync(SqlDataReader reader, string leftColumn, string rightColumn, CancellationToken cancellationToken)
    {
        var pairs = new List<(int Left, int Right)>();
        while (await reader.ReadAsync(cancellationToken))
        {
            pairs.Add((reader.GetInt32(leftColumn), reader.GetInt32(rightColumn)));
        }

        return pairs;
    }

    private static void HydrateState(
        AppState state,
        List<(int ProjectId, int UserId)> projectMembers,
        List<(int SprintId, int UserId)> sprintMembers,
        List<(int TaskId, int UserId)> taskAssignees,
        List<(int TaskId, int UserId)> taskReporters,
        List<(int TaskId, int DependsOnTaskId)> taskDependencies,
        List<AttachmentDto> attachments,
        List<(int TaskId, int AttachmentId)> taskAttachments,
        List<(int BlogId, int AttachmentId)> blogAttachments,
        List<BlogHistoryDto> blogHistory)
    {
        // Build lookup dictionaries once, then every screen can use friendly
        // nested objects such as project members, sprint developers, and task assignees.
        var userSummaries = state.Users.ToDictionary(user => user.Id, ToUserSummary);
        var attachmentMap = attachments.ToDictionary(attachment => attachment.Id);

        foreach (var project in state.Projects)
        {
            project.MemberIds = projectMembers.Where(pair => pair.ProjectId == project.Id).Select(pair => pair.UserId).ToList();
            project.Members = project.MemberIds.Where(userSummaries.ContainsKey).Select(userId => userSummaries[userId]).ToList();
            var projectTasks = state.Tasks.Where(task => task.ProjectId == project.Id && task.ParentTaskId is null).ToList();
            project.TaskCount = projectTasks.Count;
            project.CompletedTaskCount = projectTasks.Count(IsQaPassedOrLater);
            project.BugCount = projectTasks.Count(task => task.TaskType == "Bug");
            project.OpenBugCount = projectTasks.Count(task => task.TaskType == "Bug" && !IsQaPassedOrLater(task));
            project.PercentCompleted = project.TaskCount == 0 ? 0 : Math.Round(project.CompletedTaskCount * 100m / project.TaskCount, 1);
        }

        foreach (var sprint in state.Sprints)
        {
            sprint.DeveloperIds = sprintMembers.Where(pair => pair.SprintId == sprint.Id).Select(pair => pair.UserId).ToList();
            sprint.Developers = sprint.DeveloperIds.Where(userSummaries.ContainsKey).Select(userId => userSummaries[userId]).ToList();
            var sprintTasks = state.Tasks.Where(task => task.SprintId == sprint.Id && task.ParentTaskId is null).ToList();
            sprint.TaskCount = sprintTasks.Count;
            sprint.CompletedTaskCount = sprintTasks.Count(IsQaPassedOrLater);
            sprint.BugCount = sprintTasks.Count(task => task.TaskType == "Bug");
            sprint.OpenBugCount = sprintTasks.Count(task => task.TaskType == "Bug" && !IsQaPassedOrLater(task));
            sprint.PercentCompleted = sprint.TaskCount == 0 ? 0 : Math.Round(sprint.CompletedTaskCount * 100m / sprint.TaskCount, 1);
        }

        var tasksById = state.Tasks.ToDictionary(task => task.Id);
        foreach (var task in state.Tasks)
        {
            task.AssigneeIds = taskAssignees.Where(pair => pair.TaskId == task.Id).Select(pair => pair.UserId).ToList();
            task.Assignees = task.AssigneeIds.Where(userSummaries.ContainsKey).Select(userId => userSummaries[userId]).ToList();
            task.ReporterIds = taskReporters.Where(pair => pair.TaskId == task.Id).Select(pair => pair.UserId).ToList();
            task.Reporters = task.ReporterIds.Where(userSummaries.ContainsKey).Select(userId => userSummaries[userId]).ToList();
            task.DependencyTaskIds = taskDependencies.Where(pair => pair.TaskId == task.Id).Select(pair => pair.DependsOnTaskId).ToList();
            task.Attachments = taskAttachments
                .Where(pair => pair.TaskId == task.Id && attachmentMap.ContainsKey(pair.AttachmentId))
                .Select(pair => attachmentMap[pair.AttachmentId])
                .ToList();
        }

        foreach (var childTask in state.Tasks.Where(task => task.ParentTaskId.HasValue))
        {
            // Sub-tasks are still returned in the main task list. Adding them
            // here makes task cards able to draw the small sub-task progress graph.
            if (tasksById.TryGetValue(childTask.ParentTaskId!.Value, out var parentTask))
            {
                parentTask.SubTasks.Add(childTask);
            }
        }

        foreach (var task in state.Tasks)
        {
            task.SubTaskAveragePercent = task.SubTasks.Count == 0
                ? task.PercentCompleted
                : Math.Round(task.SubTasks.Average(subTask => (decimal)subTask.PercentCompleted), 1);
        }

        foreach (var blog in state.Blogs)
        {
            blog.Attachments = blogAttachments
                .Where(pair => pair.BlogId == blog.Id && attachmentMap.ContainsKey(pair.AttachmentId))
                .Select(pair => attachmentMap[pair.AttachmentId])
                .ToList();
            blog.History = blogHistory
                .Where(item => item.BlogId == blog.Id)
                .OrderByDescending(item => item.CreatedAt)
                .ToList();
        }

        state.Projects = state.Projects.OrderByDescending(project => project.StartDate ?? project.CreatedAt).ThenByDescending(project => project.Id).ToList();
        state.Sprints = state.Sprints.OrderByDescending(sprint => sprint.StartDate ?? sprint.CreatedAt).ThenByDescending(sprint => sprint.Id).ToList();
        state.Tasks = state.Tasks.OrderBy(task => task.SortOrder).ThenBy(task => task.Id).ToList();
        state.DevLogs = state.DevLogs.OrderByDescending(log => log.IsPinned).ThenByDescending(log => log.LogDate).ThenByDescending(log => log.UpdatedAt).ToList();
        state.Blogs = state.Blogs.OrderByDescending(blog => blog.UpdatedAt).ToList();
        // Keep enough history for seeded LMS/HLS audit trails without sending an unbounded list.
        state.AuditEvents = state.AuditEvents.OrderByDescending(audit => audit.CreatedAt).Take(2000).ToList();
    }

    private static UserSummaryDto ToUserSummary(UserDto user)
    {
        return new UserSummaryDto
        {
            Id = user.Id,
            Name = $"{user.FirstName} {user.LastName}".Trim(),
            Nickname = user.Nickname,
            AvatarUrl = user.AvatarUrl,
            IsAdmin = user.IsAdmin,
            Role = user.Role
        };
    }

    private static bool IsQaPassedOrLater(WorkTaskDto task)
    {
        // Sprint/project progress now means "ready past QA", not only 100% task entry.
        return task.Status is "QA Passed" or "Deployed in SIT" or "Deployed in UAT" or "Deployed in Prod";
    }
}

internal static class SqlDataReaderExtensions
{
    public static string GetStringOrEmpty(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? "" : reader.GetString(ordinal);
    }

    public static int GetInt32(this SqlDataReader reader, string name)
    {
        return reader.GetInt32(reader.GetOrdinal(name));
    }

    public static long GetInt64(this SqlDataReader reader, string name)
    {
        return reader.GetInt64(reader.GetOrdinal(name));
    }

    public static bool GetBoolean(this SqlDataReader reader, string name)
    {
        return reader.GetBoolean(reader.GetOrdinal(name));
    }

    public static DateTime GetDateTime(this SqlDataReader reader, string name)
    {
        return reader.GetDateTime(reader.GetOrdinal(name));
    }

    public static int? GetNullableInt32(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetInt32(ordinal);
    }

    public static DateTime? GetNullableDateTime(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetDateTime(ordinal);
    }
}
