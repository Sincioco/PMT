export function projectsAvailableForInvitation(projects, userId, isAdmin) {
  const normalizedUserId = Number(userId || 0);
  return (projects || []).filter(project =>
    isAdmin || (project.memberIds || []).some(memberId => Number(memberId) === normalizedUserId)
  );
}
