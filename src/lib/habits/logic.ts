// ============================================
// Habit Lab — Domain Logic (pure, testable)
// Date/day math is Asia/Shanghai calendar based.
// All dates are plain YYYY-MM-DD strings.
// ============================================

import type {
  LogByDate, SprintPhase, SprintTimeline, SprintDayCell, SprintPoints, CueInput, HabitSprintRow,
  HabitLabTodaySummary, TodaySprintItem,
} from "./types";

const DAY_MS = 86_400_000;

/** Parse a YYYY-MM-DD string to a UTC-midnight Date (calendar-only math, DST-safe). */
function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Add `days` to a YYYY-MM-DD calendar date. */
export function addDays(date: string, days: number): string {
  const t = new Date(toUtc(date) + days * DAY_MS);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Calendar-day distance from `a` to `b` (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/**
 * Day number (1-based) of `date` within a sprint starting `startDate`.
 * Returns null when date is before startDate.
 */
export function getDayNumber(startDate: string, date: string): number | null {
  const diff = diffDays(startDate, date);
  if (diff < 0) return null;
  return diff + 1;
}

/** All YYYY-MM-DD strings for a sprint window of `days` starting `startDate`. */
export function dateRange(startDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(startDate, i));
}

export function buildLogMap(logs: { date: string; status: "completed" | "skipped" }[]): LogByDate {
  const map: LogByDate = new Map();
  for (const l of logs) map.set(l.date, l.status);
  return map;
}

function endDateOf(startDate: string, durationDays: number): string {
  return addDays(startDate, durationDays - 1);
}

/** Longest run of consecutive calendar dates in a set (sprint-scoped). */
export function longestStreak(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of sorted) {
    if (prev && diffDays(prev, d) === 1) run += 1;
    else run = 1;
    prev = d;
    if (run > best) best = run;
  }
  return best;
}

function dayCellStatus(
  isPastOrToday: boolean,
  isToday: boolean,
  log: "completed" | "skipped" | undefined,
): SprintDayCell["status"] {
  if (log === "completed") return "completed";
  if (log === "skipped") return "skipped";
  if (!isPastOrToday) return "future";
  if (isToday) return "due";
  return "missed";
}

/**
 * Build the full timeline for a sprint as of `today` (Beijing YYYY-MM-DD).
 * All math derives from start_date + duration_days, never from log count.
 */
export function buildSprintTimeline(
  sprint: Pick<HabitSprintRow, "start_date" | "duration_days" | "status">,
  logs: { date: string; status: "completed" | "skipped" }[],
  today: string,
): SprintTimeline {
  const { start_date, duration_days, status } = sprint;
  const endDate = endDateOf(start_date, duration_days);
  const map = buildLogMap(logs);
  const dates = dateRange(start_date, duration_days);

  const dayIndex = getDayNumber(start_date, today); // 1-based or null

  let phase: SprintPhase;
  if (status === "archived") phase = "archived";
  else if (status === "completed") phase = "completed";
  else if (status === "paused") phase = "paused";
  else if (dayIndex === null) phase = "scheduled";
  else if (today <= endDate) phase = "active";
  else phase = "reviewable";

  const pauseFreeze = phase === "paused";
  const historyFrozen = phase === "archived" || phase === "completed";

  const days: SprintDayCell[] = dates.map((date, i) => {
    const dayNumber = i + 1;
    const diff = diffDays(date, today); // positive when `date` is in the past
    const isToday = diff === 0;
    const isPastOrToday = diff >= 0;
    const log = map.get(date);
    let cellStatus = dayCellStatus(isPastOrToday, isToday, log);

    // Paused/archived/completed sprints freeze the grid at today:
    // an unfinished "today" must not silently become "due/missed" while paused.
    if ((pauseFreeze || historyFrozen) && log === undefined && isToday) cellStatus = "future";

    return { date, dayNumber, status: cellStatus, isToday };
  });

  // Completed/skipped tallies cover the whole window (backfilled past counts).
  const completedCount = days.filter((d) => d.status === "completed").length;
  const skippedCount = days.filter((d) => d.status === "skipped").length;
  const missedCount = days.filter((d) => d.status === "missed").length;

  const completedDates = dates.filter((d) => map.get(d) === "completed");
  const ls = longestStreak(completedDates);

  // Clamp "today's slot" to the window once the sprint has run past its last day
  // (a reviewable/completed sprint reads as "Day N of N done").
  const currentDay = dayIndex === null ? null : Math.min(dayIndex, duration_days);

  return {
    phase,
    totalDays: duration_days,
    endDate,
    currentDay,
    completedCount,
    skippedCount,
    missedCount,
    longestStreak: ls,
    days,
  };
}

/**
 * Habit Points earned from a snapshot of logs.
 * Milestone model — rewards are earned, never deducted.
 */
export function computePoints(
  logs: { date: string; status: "completed" | "skipped" }[],
  finalized: boolean,
): SprintPoints {
  const completedDates = logs.filter((l) => l.status === "completed").map((l) => l.date);
  const completionPoints = completedDates.length * 10;
  // Milestone ladder: crossing 3 in a row nets +10, crossing 7 nets a further +30.
  // Bonuses are earned once (longest run so far), never clawed back by a later miss.
  const run = longestStreak(completedDates);
  const streakBonus = (run >= 3 ? 10 : 0) + (run >= 7 ? 30 : 0);
  const completionBonus = finalized ? 100 : 0;
  return { completionPoints, streakBonus, completionBonus, total: completionPoints + streakBonus + completionBonus };
}

/** Strips trailing CJK/ASCII sentence punctuation for natural cue composition. */
function trimPunct(s: string): string {
  return s.trim().replace(/[。．.!！,，;；、]+$/g, "");
}

/** Drops a trailing temporal particle so "吃完晚饭后" never becomes "…后后". */
function stripEndParticle(s: string): string {
  return s.replace(/(之后|以后|的时候|时|后)$/, "");
}

/**
 * Build a natural-language habit-stacking cue sentence.
 * Atomic Habits formula: "After I [CUE], I will [MINIMUM ACTION]."
 */
export function buildCueSentence(input: CueInput): string {
  const action = trimPunct(input.minimumAction ?? "");
  if (!action) return "";
  const trigger = stripEndParticle(trimPunct(input.trigger ?? ""));
  const location = trimPunct(input.location ?? "");

  if (trigger && location) return `每当我${trigger}时（在${location}），我会${action}。`;
  if (trigger) return `每当我${trigger}后，我会${action}。`;
  if (location) return `当我在${location}时，我会${action}。`;
  return `每天${action}。`;
}

/** Completion rate as a percentage 0–100 for a snapshot window. */
export function completionRatePercent(completedCount: number, totalDays: number): number {
  if (totalDays <= 0) return 0;
  return Math.min(100, Math.round((completedCount / totalDays) * 100));
}

type TodayLogLike = { sprint_id: string; status: "completed" | "skipped" };

function toTodayItem(
  sprint: HabitSprintRow,
  todayLog: TodayLogLike | undefined,
  today: string,
): TodaySprintItem {
  const tl = buildSprintTimeline(sprint, [], today); // phase/currentDay never depend on logs
  return {
    sprint,
    phase: tl.phase,
    currentDay: tl.currentDay,
    totalDays: tl.totalDays,
    endDate: tl.endDate,
    todayStatus: todayLog?.status ?? null,
  };
}

/**
 * Fold the user's active/paused sprints + today's explicit logs into one
 * summary that drives Home's 今日实验 card and daily-action section.
 * Pure — every count is derived from Habit Lab data, so card == section == data.
 */
export function summarizeToday(
  sprints: HabitSprintRow[],
  todayLogs: TodayLogLike[],
  today: string,
): HabitLabTodaySummary {
  const logBySprint = new Map<string, TodayLogLike>();
  for (const l of todayLogs) logBySprint.set(l.sprint_id, l);

  const due: TodaySprintItem[] = [];
  const reviewable: TodaySprintItem[] = [];
  const paused: TodaySprintItem[] = [];
  const scheduled: TodaySprintItem[] = [];

  for (const s of sprints) {
    const item = toTodayItem(s, logBySprint.get(s.id), today);
    if (item.phase === "active") due.push(item);
    else if (item.phase === "reviewable") reviewable.push(item);
    else if (item.phase === "paused") paused.push(item);
    else if (item.phase === "scheduled") scheduled.push(item);
  }

  const doneCount = due.filter((d) => d.todayStatus === "completed").length;
  const handledCount = due.filter((d) => d.todayStatus !== null).length;
  const remainingCount = due.length - handledCount;

  return {
    hasExperiments: sprints.length > 0,
    due,
    reviewable,
    paused,
    scheduled,
    doneCount,
    handledCount,
    remainingCount,
    allHandled: due.length > 0 && remainingCount === 0,
    allCompleted: due.length > 0 && doneCount === due.length,
  };
}

/**
 * Non-judgmental recovery nudge: the sprint had a check-in window yesterday but no
 * explicit log, and is still actionable today. Nothing is scored — presence only.
 */
export function missedYesterday(
  item: TodaySprintItem,
  yesterdayLogs: { sprint_id: string }[],
  today: string,
): boolean {
  if (item.todayStatus !== null) return false; // already acted on today
  if (item.phase !== "active") return false;
  const yesterday = addDays(today, -1);
  if (item.sprint.start_date > yesterday) return false; // window hadn't started
  return !yesterdayLogs.some((l) => l.sprint_id === item.sprint.id);
}
