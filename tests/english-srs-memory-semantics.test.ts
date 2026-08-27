import { describe, expect, it } from "vitest";
import { deriveDailyMemoryState, scheduleDailyMemoryState } from "../src/lib/english/dailyMemoryState";

const NOW = new Date("2026-08-27T04:00:00Z");
const MATURE = {
  ease_factor: 2.5,
  repetitions: 8,
  interval_days: 30,
  lapse_count: 0,
  production_count: 3,
  status: "mastered",
  next_review_date: "2026-08-27",
};

describe("daily memory semantics", () => {
  it.each([
    { scores: [3], interval: 36, next: "2026-10-02" },
    { scores: [4], interval: 78, next: "2026-11-13" },
    { scores: [5], interval: 104, next: "2026-12-09" },
    { scores: [2, 3], interval: 3, next: "2026-08-30" },
    { scores: [2, 4], interval: 3, next: "2026-08-30" },
    { scores: [1, 3], interval: 1, next: "2026-08-28" },
    { scores: [1, 4], interval: 1, next: "2026-08-28" },
    { scores: [1, 2, 4], interval: 1, next: "2026-08-28" },
  ])("30-day card $scores → $interval days", ({ scores, interval, next }) => {
    const schedule = scheduleDailyMemoryState(MATURE, scores, NOW);
    expect(schedule.interval_days).toBe(interval);
    expect(schedule.next_review_date).toBe(next);
  });

  it("keeps today_passed separate from scheduling quality", () => {
    const state = deriveDailyMemoryState([1, 2, 4]);
    expect(state.todayPassed).toBe(true);
    expect(state.worstScore).toBe(1);
    expect(state.hadLapse).toBe(true);
    expect(state.hadFuzzy).toBe(true);
    expect(state.needsRelearning).toBe(true);
  });

  it("preserves fuzzy after a later pass", () => {
    const state = deriveDailyMemoryState([2, 4]);
    expect(state.todayPassed).toBe(true);
    expect(state.hadFuzzy).toBe(true);
    expect(state.worstScore).toBe(2);
  });

  it("recomputes every attempt sequence from the original state without compounding", () => {
    const afterFirst = scheduleDailyMemoryState(MATURE, [2], NOW);
    const afterPass = scheduleDailyMemoryState(MATURE, [2, 4], NOW);
    expect(afterPass).toEqual(afterFirst);
  });

  it("does not call max attempts a pass", () => {
    const state = deriveDailyMemoryState([2, 2, 2, 2]);
    expect(state.todayPassed).toBe(false);
    expect(state.maxAttemptsReached).toBe(true);
    expect(state.shouldRequeue).toBe(false);
    expect(state.needsRelearning).toBe(true);
  });
});
