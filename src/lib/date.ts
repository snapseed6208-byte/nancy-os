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

/**
 * Get the Monday of the current Beijing week as YYYY-MM-DD.
 * Weeks start on Monday per Chinese convention.
 */
export function getBeijingWeekStart(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  let year = 0, month = 0, day = 0, weekday = "";
  for (const p of parts) {
    if (p.type === "year") year = Number(p.value);
    if (p.type === "month") month = Number(p.value);
    if (p.type === "day") day = Number(p.value);
    if (p.type === "weekday") weekday = p.value;
  }

  const weekdayMap: Record<string, number> = {
    "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6,
  };
  // For Chinese locale fallback
  const weekdayMapCN: Record<string, number> = {
    "周一": 0, "周二": 1, "周三": 2, "周四": 3, "周五": 4, "周六": 5, "周日": 6,
  };

  const dow = weekdayMap[weekday] ?? weekdayMapCN[weekday] ?? 0;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - dow);

  const outFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return outFmt.format(d);
}

/**
 * Get the current Beijing week range [Monday, next Monday).
 */
export function getBeijingWeekRange(): { start: string; end: string } {
  const start = getBeijingWeekStart();
  const [y, m, d] = start.split("-").map(Number);
  const endDate = new Date(Date.UTC(y, m - 1, d + 7));
  const endFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return { start, end: endFmt.format(endDate) };
}

/**
 * Get the start date for a frequency period in Beijing time.
 * daily → today's date
 * weekly → Monday of current week
 * monthly → 1st of current month
 */
export function getBeijingPeriodStart(frequencyType: string): string {
  if (frequencyType === "daily") return getBeijingDateString();
  if (frequencyType === "weekly") return getBeijingWeekStart();
  const { year, month } = getBeijingYearMonth();
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * Get the end date (exclusive) for a frequency period in Beijing time.
 */
export function getBeijingPeriodEnd(frequencyType: string): string {
  const today = getBeijingDateString();
  if (frequencyType === "daily") {
    const [y, m, d] = today.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    return fmt.format(next);
  }
  if (frequencyType === "weekly") {
    return getBeijingWeekRange().end;
  }
  // monthly
  const { year, month } = getBeijingYearMonth();
  const daysInMonth = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth + 1).padStart(2, "0")}`;
}
