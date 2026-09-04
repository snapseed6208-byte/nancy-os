// ============================================
// Habit Lab — Home 今日实验 summary tests
// summarizeToday is the pure function behind Home's 今日实验 top card,
// the single Habit Lab representation on the dashboard.
// ============================================

import { describe, it, expect } from "vitest";
import { addDays, summarizeToday } from "@/lib/habits/logic";
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
  it("no experiments → hasExperiments false, empty buckets", () => {
    const s = summarizeToday([], [], T);
    expect(s.hasExperiments).toBe(false);
    expect(s.due).toHaveLength(0);
    expect(s.doneCount).toBe(0);
    expect(s.remainingCount).toBe(0);
    expect(s.allHandled).toBe(false);
    expect(s.allCompleted).toBe(false);
  });

  it("one active sprint, not done today → 0/1, remaining 1", () => {
    const s = summarizeToday([spr("s1", addDays(T, -3))], [], T); // day 4
    expect(s.hasExperiments).toBe(true);
    expect(s.due).toHaveLength(1);
    expect(s.due[0].currentDay).toBe(4);
    expect(s.due[0].todayStatus).toBeNull();
    expect(s.doneCount).toBe(0);
    expect(s.remainingCount).toBe(1);
    expect(s.allCompleted).toBe(false);
  });

  it("one active sprint, completed today → 1/1, all completed", () => {
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

  it("multiple active, partial → 1/2, remaining 1", () => {
    const s = summarizeToday(two(), [LOG("s1", "completed")], T);
    expect(s.due).toHaveLength(2);
    expect(s.doneCount).toBe(1);
    expect(s.remainingCount).toBe(1);
    expect(s.allHandled).toBe(false);
    expect(s.allCompleted).toBe(false);
  });

  it("multiple active, all done → 2/2, all completed", () => {
    const s = summarizeToday(two(), [LOG("s1", "completed"), LOG("s2", "completed")], T);
    expect(s.doneCount).toBe(2);
    expect(s.remainingCount).toBe(0);
    expect(s.allHandled).toBe(true);
    expect(s.allCompleted).toBe(true);
  });

  it("all checked in but one skipped → handled, not all completed", () => {
    const s = summarizeToday(two(), [LOG("s1", "completed"), LOG("s2", "skipped")], T);
    expect(s.doneCount).toBe(1);
    expect(s.handledCount).toBe(2);
    expect(s.remainingCount).toBe(0);
    expect(s.allHandled).toBe(true);
    expect(s.allCompleted).toBe(false);
  });
});

describe("summarizeToday — window edges and phase grouping", () => {
  it("the 21st day is still active/due; the day after rolls to reviewable", () => {
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

  it("paused / scheduled / reviewable never count as due", () => {
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
