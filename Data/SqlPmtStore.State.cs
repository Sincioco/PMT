using Microsoft.Data.SqlClient;
using PMT.Models;

namespace PMT.Data;

public sealed partial class SqlPmtStore
{
    public async Task<List<AuditEventDto>> GetAuditTrailAsync(int currentUserId, CancellationToken cancellationToken)
    {
        await using var connection = await OpenConnectionAsync(cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetAuditTrail]");
        Add(command, "@CurrentUserId", currentUserId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

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
                ActorUserId = reader.GetInt32("ActorUserId"),
                UserName = reader.GetStringOrEmpty("UserName"),
                ActorUserName = reader.GetStringOrEmpty("ActorUserName"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt")
            });
        }

        return events;
    }

    public async Task<AppState> GetStateAsync(int currentUserId, CancellationToken cancellationToken)
    {
        // The UI needs many related lists at once. One stored procedure returns
        // simple result sets, then this class connects those sets into DTOs.
        await using var connection = await OpenConnectionAsync(cancellationToken);
        var editVersions = await ReadEditVersionsAsync(connection, currentUserId, null, cancellationToken);
        await using var command = StoredProcedure(connection, "[pmt].[GetAppState]");
        Add(command, "@CurrentUserId", currentUserId);
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

        state.AuditEvents = (await ReadAuditEventsAsync(reader, cancellationToken))
            .Where(audit => !audit.EntityType.Equals("Impersonation", StringComparison.OrdinalIgnoreCase))
            .ToList();
        await reader.NextResultAsync(cancellationToken);

        state.Lookups = await ReadLookupsAsync(reader, cancellationToken);
        await reader.NextResultAsync(cancellationToken);

        state.Holidays = await ReadHolidaysAsync(reader, cancellationToken);
        await reader.CloseAsync();

        var usersById = state.Users.ToDictionary(user => user.Id);
        await using var lastLoginsCommand = StoredProcedure(connection, "[pmt].[GetUserLastLogins]");
        await using var lastLoginsReader = await lastLoginsCommand.ExecuteReaderAsync(cancellationToken);
        while (await lastLoginsReader.ReadAsync(cancellationToken))
        {
            if (usersById.TryGetValue(lastLoginsReader.GetInt32("UserId"), out var user))
            {
                user.LastLoginAt = lastLoginsReader.GetNullableUtcDateTime("LastLoginAt");
            }
        }
        await lastLoginsReader.CloseAsync();

        await using var rolesCommand = StoredProcedure(connection, "[pmt].[GetRoles]");
        await using var rolesReader = await rolesCommand.ExecuteReaderAsync(cancellationToken);
        state.Roles = await ReadRolesAsync(rolesReader, cancellationToken);
        await rolesReader.CloseAsync();

        await using var securityCommand = StoredProcedure(connection, "[pmt].[GetSecurityConfiguration]");
        Add(securityCommand, "@CurrentUserId", currentUserId);
        await using var securityReader = await securityCommand.ExecuteReaderAsync(cancellationToken);
        state.SecurityResources = await ReadSecurityResourcesAsync(securityReader, cancellationToken);
        await securityReader.NextResultAsync(cancellationToken);
        state.RolePermissions = await ReadRolePermissionsAsync(securityReader, cancellationToken);
        await securityReader.NextResultAsync(cancellationToken);
        state.UserPermissions = await ReadUserPermissionsAsync(securityReader, cancellationToken);
        await securityReader.NextResultAsync(cancellationToken);
        state.EffectivePermissions = await ReadEffectivePermissionsAsync(securityReader, cancellationToken);
        await securityReader.CloseAsync();

        HydrateEditVersions(state, editVersions);

        HydrateState(state, projectMembers, sprintMembers, taskAssignees, taskReporters, taskDependencies, attachments, taskAttachments, blogAttachments, blogHistory);
        return state;
    }

    private static void HydrateEditVersions(
        AppState state,
        IReadOnlyDictionary<(string EntityType, string EntityKey), byte[]> editVersions)
    {
        var users = state.Users.ToDictionary(item => item.Id);
        var projects = state.Projects.ToDictionary(item => item.Id);
        var sprints = state.Sprints.ToDictionary(item => item.Id);
        var tasks = state.Tasks.ToDictionary(item => item.Id);
        var devLogs = state.DevLogs.ToDictionary(item => item.Id);
        var blogs = state.Blogs.ToDictionary(item => item.Id);
        var lookups = state.Lookups.ToDictionary(item => item.Id);
        var holidays = state.Holidays.ToDictionary(item => item.Id);
        var securityResources = state.SecurityResources.ToDictionary(item => item.ResourceKey, StringComparer.OrdinalIgnoreCase);

        foreach (var editVersion in editVersions)
        {
            var entityType = editVersion.Key.EntityType;
            var entityKey = editVersion.Key.EntityKey;
            var rowVersion = editVersion.Value;

            if (entityType == "SecurityResource")
            {
                if (securityResources.TryGetValue(entityKey, out var resource)) resource.RowVersion = rowVersion;
                continue;
            }

            if (!int.TryParse(entityKey, out var id)) continue;

            if (entityType == "User" && users.TryGetValue(id, out var user)) user.RowVersion = rowVersion;
            else if (entityType == "Project" && projects.TryGetValue(id, out var project)) project.RowVersion = rowVersion;
            else if (entityType == "Sprint" && sprints.TryGetValue(id, out var sprint)) sprint.RowVersion = rowVersion;
            else if (entityType == "WorkTask" && tasks.TryGetValue(id, out var task)) task.RowVersion = rowVersion;
            else if (entityType == "DevLog" && devLogs.TryGetValue(id, out var devLog)) devLog.RowVersion = rowVersion;
            else if (entityType == "Blog" && blogs.TryGetValue(id, out var blog)) blog.RowVersion = rowVersion;
            else if (entityType == "Lookup" && lookups.TryGetValue(id, out var lookup)) lookup.RowVersion = rowVersion;
            else if (entityType == "Holiday" && holidays.TryGetValue(id, out var holiday)) holiday.RowVersion = rowVersion;
        }
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
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
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
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
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
                RootCauseAnalysisHtml = reader.GetStringOrEmpty("RootCauseAnalysisHtml"),
                Environment = reader.GetStringOrEmpty("Environment"),
                Severity = reader.GetStringOrEmpty("Severity"),
                Status = reader.GetStringOrEmpty("Status"),
                Priority = reader.GetStringOrEmpty("Priority"),
                SortOrder = reader.GetInt32("SortOrder"),
                PercentCompleted = reader.GetInt32("PercentCompleted"),
                Url = reader.GetStringOrEmpty("Url"),
                StartDate = reader.GetNullableDateTime("StartDate"),
                EndDate = reader.GetNullableDateTime("EndDate"),
                StartedAt = reader.GetNullableUtcDateTime("StartedAt"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                UpdatedByUserId = reader.GetNullableInt32("UpdatedByUserId"),
                LinkedBugTaskId = reader.GetNullableInt32("LinkedBugTaskId"),
                LinkedBlogId = reader.GetNullableInt32("LinkedBlogId"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
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
                CreatedAt = reader.GetUtcDateTime("CreatedAt")
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
                LogType = reader.GetStringOrEmpty("LogType"),
                Category = reader.GetStringOrEmpty("Category"),
                ProjectId = reader.GetNullableInt32("ProjectId"),
                UserId = reader.GetInt32("UserId"),
                LogDate = reader.GetDateTime("LogDate"),
                BodyHtml = reader.GetStringOrEmpty("BodyHtml"),
                IsPinned = reader.GetBoolean("IsPinned"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
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
                SprintId = reader.GetNullableInt32("SprintId"),
                ParentBlogId = reader.GetNullableInt32("ParentBlogId"),
                Title = reader.GetStringOrEmpty("Title"),
                BodyHtml = reader.GetStringOrEmpty("BodyHtml"),
                IsPrivate = reader.GetBoolean("IsPrivate"),
                IsPinned = reader.GetBoolean("IsPinned"),
                SortOrder = reader.GetInt32("SortOrder"),
                CreatedByUserId = reader.GetInt32("CreatedByUserId"),
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
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
                CreatedAt = reader.GetUtcDateTime("CreatedAt")
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
                CreatedAt = reader.GetUtcDateTime("CreatedAt")
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

    private static async Task<List<SecurityResourceDto>> ReadSecurityResourcesAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var resources = new List<SecurityResourceDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            resources.Add(new SecurityResourceDto
            {
                ResourceKey = reader.GetStringOrEmpty("ResourceKey"),
                Name = reader.GetStringOrEmpty("Name"),
                AvailableRights = reader.GetStringOrEmpty("AvailableRights"),
                DisplayOrder = reader.GetInt32("DisplayOrder")
            });
        }

        return resources;
    }

    private static async Task<List<RoleSecurityPermissionDto>> ReadRolePermissionsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var permissions = new List<RoleSecurityPermissionDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            permissions.Add(new RoleSecurityPermissionDto
            {
                ResourceKey = reader.GetStringOrEmpty("ResourceKey"),
                RoleCode = reader.GetStringOrEmpty("RoleCode"),
                CanRead = reader.GetBoolean("CanRead"),
                CanCreate = reader.GetBoolean("CanCreate"),
                CanUpdate = reader.GetBoolean("CanUpdate"),
                CanDelete = reader.GetBoolean("CanDelete"),
                CanImport = reader.GetBoolean("CanImport"),
                CanExport = reader.GetBoolean("CanExport"),
                NoAccess = reader.GetBoolean("NoAccess")
            });
        }

        return permissions;
    }

    private static async Task<List<UserSecurityPermissionDto>> ReadUserPermissionsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var permissions = new List<UserSecurityPermissionDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            permissions.Add(new UserSecurityPermissionDto
            {
                ResourceKey = reader.GetStringOrEmpty("ResourceKey"),
                UserId = reader.GetInt32("UserId"),
                CanRead = reader.GetBoolean("CanRead"),
                CanCreate = reader.GetBoolean("CanCreate"),
                CanUpdate = reader.GetBoolean("CanUpdate"),
                CanDelete = reader.GetBoolean("CanDelete"),
                CanImport = reader.GetBoolean("CanImport"),
                CanExport = reader.GetBoolean("CanExport"),
                NoAccess = reader.GetBoolean("NoAccess"),
                IsOverride = reader.GetBoolean("IsOverride")
            });
        }

        return permissions;
    }

    private static async Task<List<EffectivePermissionDto>> ReadEffectivePermissionsAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var permissions = new List<EffectivePermissionDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            permissions.Add(new EffectivePermissionDto
            {
                ResourceKey = reader.GetStringOrEmpty("ResourceKey"),
                CanRead = reader.GetBoolean("CanRead"),
                CanCreate = reader.GetBoolean("CanCreate"),
                CanUpdate = reader.GetBoolean("CanUpdate"),
                CanDelete = reader.GetBoolean("CanDelete"),
                CanImport = reader.GetBoolean("CanImport"),
                CanExport = reader.GetBoolean("CanExport"),
                NoAccess = reader.GetBoolean("NoAccess")
            });
        }

        return permissions;
    }

    private static async Task<List<LookupDto>> ReadRolesAsync(SqlDataReader reader, CancellationToken cancellationToken)
    {
        var roles = new List<LookupDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            roles.Add(new LookupDto
            {
                Id = reader.GetInt32("LookupId"),
                LookupType = "Role",
                Value = reader.GetStringOrEmpty("Value"),
                Code = reader.GetStringOrEmpty("Code"),
                ColorHex = "",
                DisplayOrder = reader.GetInt32("DisplayOrder"),
                IsActive = reader.GetBoolean("IsActive")
            });
        }

        return roles;
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
                CreatedAt = reader.GetUtcDateTime("CreatedAt"),
                UpdatedAt = reader.GetUtcDateTime("UpdatedAt")
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
        state.DevLogs = state.DevLogs
            .OrderByDescending(log => log.IsPinned)
            .ThenByDescending(log => log.IsPinned ? log.CreatedAt : DateTime.MinValue)
            .ThenByDescending(log => log.LogDate)
            .ThenByDescending(log => log.UpdatedAt)
            .ToList();
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
