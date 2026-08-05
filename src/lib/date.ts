// ============================================
// Nancy OS — Beijing Timezone Date Utilities
// All business dates use Asia/Shanghai timezone.
// ============================================

const TIMEZONE = "Asia/Shanghai";

/**
 * Returns today's date string in Beijing time (YYYY-MM-DD).
 * Safe at any hour — no UTC date drift.
 */
export function getBeijingDateString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Returns current year and month in Beijing time.
 */
export function getBeijingYearMonth(): { year: number; month: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
  });
  const [year, month] = formatter.format(new Date()).split("-");
  return { year: Number(year), month: Number(month) };
}

/**
 * Returns ISO timestamp string in Beijing time.
 */
export function getBeijingISOString(): string {
  const now = new Date();
  const dateStr = getBeijingDateString();
  const timeFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const timeStr = timeFormatter.format(now);
  return `${dateStr}T${timeStr}+08:00`;
}

/**
 * Returns the first and last day of a month as YYYY-MM-DD strings.
 */
export function getBeijingMonthRange(year: number, month: number): { start: string; end: string } {
  const m = String(month).padStart(2, "0");
  const start = `${year}-${m}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const end = `${year}-${m}-${String(daysInMonth).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Format a YYYY-MM-DD date string for display in Chinese.
 * e.g. "2026-08-06" → "2026年8月6日"
 */
export function formatBeijingDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

/**
 * Validate that a string is a plausible YYYY-MM-DD date.
 * Returns the normalized string or null.
 */
export function parseBusinessDateSafely(input: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(input + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const [y, m, day] = input.split("-").map(Number);
  if (d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== day) return null;
  return input;
}

/**
 * Get the Beijing weekday label for a date string.
 */
export function getBeijingWeekday(dateStr: string): string {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const d = new Date(dateStr + "T00:00:00+08:00");
  return weekdays[d.getDay()];
}

/**
 * Convert a Date object to a Beijing date string (YYYY-MM-DD).
 */
export function dateToBeijingString(d: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}
