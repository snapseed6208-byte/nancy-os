// ============================================
// Habit Lab — Home daily-action summary tests
// summarizeToday + missedYesterday, the pure functions behind
// Home's 今日实验 card and HabitLabToday section (single source of truth).
// ============================================

import { describe, it, expect } from "vitest";
import { addDays, summarizeToday, missedYesterday } from "@/lib/habits/logic";
import type { HabitSprintRow } from "@/lib/habits/types";

const T = "2026-09-04"; // fixed "today" reference

const spr = (id: string, start: string, over: Partial<HabitSprintRow> = {}): HabitSprintRow => ({
  id,
  user_id: "u1",
  title: `实验 ${id}`,
  icon: "Footprints",
  cue_sentence: "",
  trigger: null,
  location: null,
  minimum_action: "做最小动作",
  identity_statement: null,
  duration_days: 21,
  start_date: start,
  status: "active",
  completed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

const LOG = (sprintId: string, status: "completed" | "skipped") => ({ sprint_id: sprintId, status });

describe("summarizeToday — no / single-active states", () => {
  it("A: zero experiments → hasExperiments false, empty buckets", () => {
    const s = summarizeToday([], [], T);
    expect(s.hasExperiments).toBe(false);
    expect(s.due).toHaveLength(0);
    expect(s.doneCount).toBe(0);
    expect(s.remainingCount).toBe(0);
    expect(s.allHandled).toBe(false);
    expect(s.allCompleted).toBe(false);
  });

  it("B: one active sprint, not done today → 0/1, remaining 1", () => {
    const s = summarizeToday([spr("s1", addDays(T, -3))], [], T); // day 4
    expect(s.hasExperiments).toBe(true);
    expect(s.due).toHaveLength(1);
    expect(s.due[0].currentDay).toBe(4);
    expect(s.due[0].todayStatus).toBeNull();
    expect(s.doneCount).toBe(0);
    expect(s.handledCount).toBe(0);
    expect(s.remainingCount).toBe(1);
    expect(s.allHandled).toBe(false);
    expect(s.allCompleted).toBe(false);
  });

  it("C: one active sprint, completed today → 1/1, all completed", () => {
    const s = summarizeToday([spr("s1", addDays(T, -3))], [LOG("s1", "completed")], T);
    expect(s.doneCount).toBe(1);
    expect(s.handledCount).toBe(1);
    expect(s.remainingCount).toBe(0);
    expect(s.allHandled).toBe(true);
    expect(s.allCompleted).toBe(true);
    expect(s.due[0].todayStatus).toBe("completed");
  });
});

describe("summarizeToday — multiple-active states", () => {
  const two = () => [spr("s1", addDays(T, -3)), spr("s2", addDays(T, -10))]; // both active today

  it("D: multiple active, partial → 1/2, remaining 1", () => {
    const s = summarizeToday(two(), [LOG("s1", "completed")], T);
    expect(s.due).toHaveLength(2);
    expect(s.doneCount).toBe(1);
    expect(s.handledCount).toBe(1);
    expect(s.remainingCount).toBe(1);
    expect(s.allHandled).toBe(false);
    expect(s.allCompleted).toBe(false);
  });

  it("E: multiple active, all done → 2/2, all completed", () => {
    const s = summarizeToday(two(), [LOG("s1", "completed"), LOG("s2", "completed")], T);
    expect(s.doneCount).toBe(2);
    expect(s.handledCount).toBe(2);
    expect(s.remainingCount).toBe(0);
    expect(s.allHandled).toBe(true);
    expect(s.allCompleted).toBe(true);
  });

  it("F: all checked in but one skipped → handled, not all completed", () => {
    const s = summarizeToday(two(), [LOG("s1", "completed"), LOG("s2", "skipped")], T);
    expect(s.doneCount).toBe(1);
    expect(s.handledCount).toBe(2);
    expect(s.remainingCount).toBe(0);
    expect(s.allHandled).toBe(true);
    expect(s.allCompleted).toBe(false);
  });
});

describe("summarizeToday — window edges and phase grouping", () => {
  it("G: the 21st day is still active/due; the day after rolls to reviewable", () => {
    const start = addDays(T, -20); // day 21 == T
    const onLast = summarizeToday([spr("s1", start)], [], T);
    expect(onLast.due).toHaveLength(1);
    expect(onLast.due[0].currentDay).toBe(21);
    expect(onLast.reviewable).toHaveLength(0);

    const nextDay = addDays(T, 1);
    const afterLast = summarizeToday([spr("s1", start)], [], nextDay);
    expect(afterLast.due).toHaveLength(0);
    expect(afterLast.reviewable).toHaveLength(1);
    expect(afterLast.reviewable[0].phase).toBe("reviewable");
  });

  it("H: paused / scheduled / reviewable never count as due", () => {
    const activeDue = spr("s1", addDays(T, -3));
    const paused = spr("s2", addDays(T, -3), { status: "paused" });
    const scheduled = spr("s3", addDays(T, 5)); // starts in the future, still 'active' row status
    const reviewable = spr("s4", addDays(T, -30)); // 31 days elapsed → past window
    const s = summarizeToday([activeDue, paused, scheduled, reviewable], [], T);

    expect(s.due.map((d) => d.sprint.id)).toEqual(["s1"]);
    expect(s.paused.map((d) => d.sprint.id)).toEqual(["s2"]);
    expect(s.scheduled.map((d) => d.sprint.id)).toEqual(["s3"]);
    expect(s.reviewable.map((d) => d.sprint.id)).toEqual(["s4"]);
    expect(s.doneCount).toBe(0);
    expect(s.remainingCount).toBe(1);
  });
});

describe("missedYesterday — non-judgmental recovery nudge", () => {
  it("active sprint with no log today and none yesterday → true", () => {
    const item = summarizeToday([spr("s1", addDays(T, -5))], [], T).due[0];
    expect(missedYesterday(item, [], T)).toBe(true);
  });

  it("already handled today → false", () => {
    const item = summarizeToday([spr("s1", addDays(T, -5))], [LOG("s1", "completed")], T).due[0];
    expect(missedYesterday(item, [], T)).toBe(false);
  });

  it("a log exists for yesterday → false", () => {
    const item = summarizeToday([spr("s1", addDays(T, -5))], [], T).due[0];
    expect(missedYesterday(item, [{ sprint_id: "s1" }], T)).toBe(false);
  });

  it("window had not started yesterday → false", () => {
    const item = summarizeToday([spr("s1", T)], [], T).due[0]; // started today
    expect(missedYesterday(item, [], T)).toBe(false);
  });

  it("paused sprint → false", () => {
    const s = summarizeToday([spr("s1", addDays(T, -5), { status: "paused" })], [], T);
    expect(s.paused).toHaveLength(1);
    expect(missedYesterday(s.paused[0], [], T)).toBe(false);
  });

  it("different sprints' logs never suppress another's nudge", () => {
    const item = summarizeToday([spr("s1", addDays(T, -5))], [], T).due[0];
    expect(missedYesterday(item, [{ sprint_id: "s2" }], T)).toBe(true);
  });
});
