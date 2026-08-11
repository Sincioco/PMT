export const WORK_ITEM_CHANGE_POLL_INTERVAL_MS = 30_000;

export function workItemSnapshotSignature(items = []) {
  return JSON.stringify(workItems(items)
    .map(item => [workItemKey(item), item])
    .sort(([left], [right]) => left.localeCompare(right)));
}

export function detectWorkItemChanges(currentItems = [], nextItems = []) {
  const current = new Map(workItems(currentItems).map(item => [workItemKey(item), item]));
  const next = new Map(workItems(nextItems).map(item => [workItemKey(item), item]));
  const result = {
    changed: false,
    devTasks: { added: 0, updated: 0, deleted: 0 },
    bugs: { added: 0, updated: 0, deleted: 0 }
  };

  next.forEach((item, key) => {
    const counts = item.taskType === "Bug" ? result.bugs : result.devTasks;
    if (!current.has(key)) counts.added += 1;
    else if (JSON.stringify(current.get(key)) !== JSON.stringify(item)) counts.updated += 1;
  });
  current.forEach((item, key) => {
    if (next.has(key)) return;
    const counts = item.taskType === "Bug" ? result.bugs : result.devTasks;
    counts.deleted += 1;
  });
  result.changed = [result.devTasks, result.bugs]
    .some(counts => counts.added + counts.updated + counts.deleted > 0);
  return result;
}

export function workItemChangeMessage(changes) {
  const groups = [
    changeGroupMessage("Dev Tasks", changes?.devTasks),
    changeGroupMessage("Bugs", changes?.bugs)
  ].filter(Boolean);
  return groups.length
    ? `${groups.join("; ")}.`
    : "Dev Tasks or Bugs changed.";
}

function workItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => item && (item.taskType === "Dev" || item.taskType === "Bug"));
}

function workItemKey(item) {
  return `${item.taskType}:${Number(item.id || 0)}`;
}

function changeGroupMessage(label, counts = {}) {
  const parts = [
    countMessage(counts.added, "new"),
    countMessage(counts.updated, "updated"),
    countMessage(counts.deleted, "deleted")
  ].filter(Boolean);
  return parts.length ? `${label}: ${parts.join(", ")}` : "";
}

function countMessage(value, label) {
  const count = Number(value || 0);
  return count > 0 ? `${count} ${label}` : "";
}
