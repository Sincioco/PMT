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
  if (!value) return "";
  const date = new Date(value);
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

export function activeHolidayMap(holidays = []) {
  const activeHolidays = new Map();
  holidays.filter(item => item.isActive).forEach(holiday => {
    activeHolidays.set(dateKey(holiday.holidayDate), holiday);
  });
  return activeHolidays;
}

export function visibleDateIndex(dates, targetDate, preferEnd) {
  if (!targetDate || !dates.length) return -1;

  const targetKey = dateKey(targetDate);
  const exactIndex = dates.findIndex(date => dateKey(date) === targetKey);
  if (exactIndex >= 0) return exactIndex;

  if (preferEnd) {
    for (let index = dates.length - 1; index >= 0; index--) {
      if (dates[index] <= targetDate) return index;
    }
    return 0;
  }

  for (let index = 0; index < dates.length; index++) {
    if (dates[index] >= targetDate) return index;
  }
  return dates.length - 1;
}

export function shouldShowTimelineDate(date, itemStartDates, holidays, showNonWorkingDays = false) {
  if (showNonWorkingDays) return true;
  // Weekends and holidays stay hidden unless an item starts on that exact date.
  return itemStartDates.has(dateKey(date)) || (!isWeekend(date) && !isHoliday(date, holidays));
}

export function timelineDateClass(date, holidays) {
  const classes = [];
  if (isWeekend(date)) classes.push("weekend-day");
  if (isHoliday(date, holidays)) classes.push("holiday-day");
  return classes.join(" ");
}

export function timelineDateTitle(date, holidays) {
  const holiday = holidays.get(dateKey(date));
  return holiday ? `${formatDate(date)} - ${holiday.name}` : formatDate(date);
}

export function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

export function isHoliday(date, holidays) {
  return holidays.has(dateKey(date));
}

export function groupedTimelineHeader(dates, keySelector) {
  const groups = [];
  dates.forEach(date => {
    const label = String(keySelector(date));
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.count += 1;
    } else {
      groups.push({ label, count: 1, firstDate: date });
    }
  });
  return groups;
}
