export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

export function dateRangeLabel(start, end) {
  const startText = formatDate(start);
  const endText = formatDate(end);
  if (!startText && !endText) return "";
  if (startText === endText || !endText) return startText;
  if (!startText) return endText;
  return `${startText} - ${endText}`;
}

export function documentationDateLine(blog) {
  const createdText = `Created ${formatDate(blog.createdAt)}`;
  if (!documentationWasEdited(blog)) return createdText;
  return `${createdText} | Last edited ${formatDate(blog.updatedAt)}`;
}

export function documentationWasEdited(blog) {
  const createdTime = new Date(blog.createdAt || 0).getTime();
  const updatedTime = new Date(blog.updatedAt || 0).getTime();
  return Boolean(createdTime && updatedTime && Math.abs(updatedTime - createdTime) > 60000);
}

export function toDateInput(value) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

export function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateKey(value) {
  const date = normalizeDate(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateRange(start, end) {
  const dates = [];
  const cursor = normalizeDate(start);
  const last = normalizeDate(end);
  while (cursor && last && cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function monthName(date) {
  return date.toLocaleString(undefined, { month: "short" });
}
