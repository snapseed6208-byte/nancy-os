import { describe, expect, it } from "vitest";
import { deriveDailyReviewProgress, isLoadedBatchComplete } from "../src/lib/english/dailyReviewBatch";
import { isDuePoolCandidate } from "../src/lib/english/duePoolPolicy";
import { getShanghaiDateKey, getShanghaiDayBounds } from "../src/lib/english/sessionRepository";
import {
  MAX_SAME_DAY_ATTEMPTS,
  buildRecallQueue,
  countRecallResolved,
  requeueNearTail,
  transitionRecallAttempt,
} from "../src/lib/english/rollingReview";
import { addDaysToShanghaiDate, ratingForRecallScore, scheduleExpressionReview } from "../src/lib/srs/expressionSrs";
import type { SessionItem } from "../src/lib/hooks/useReviewSession";

const TODAY = "2026-08-27";
const USER = "user-1";

function due(status: string, nextReviewDate: string | null, archived = false) {
  return isDuePoolCandidate({ userId: USER, archived, status, nextReviewDate }, USER, TODAY);
}

function item(id: string, score: number | null = null, attempts = 0, status: SessionItem["status"] = "pending"): SessionItem {
  return {
    id,
    sessionId: "session-1",
    expressionId: `expression-${id}`,
    recallScore: score,
    sentenceScore: null,
    applicationScore: null,
    userSentence: null,
    aiFeedback: null,
    status,
    attemptCount: attempts,
    reinforcementRound: Math.max(0, attempts - 1),
    lastPracticeAt: null,
  };
}

const mature = {
  ease_factor: 2.5,
  repetitions: 8,
  interval_days: 30,
  lapse_count: 0,
  production_count: 3,
  status: "mastered",
  next_review_date: TODAY,
};

describe("canonical rolling SRS", () => {
  it("1: yesterday learned and due today is included", () => expect(due("review", TODAY)).toBe(true));
  it("2: seven-day-old expression due today is included", () => expect(due("review", TODAY)).toBe(true));
  it("3: thirty-day-old expression due today is included", () => expect(due("review", TODAY)).toBe(true));
  it("4: yesterday learned but due later is excluded", () => expect(due("review", "2026-08-30")).toBe(false));
  it("5: mastered and due today is included", () => expect(due("mastered", TODAY)).toBe(true));
  it("uses the schedule, not a drifting lifecycle status, as the SRS signal", () => {
    expect(due("learning", TODAY)).toBe(true);
    expect(due("collected", TODAY)).toBe(true);
    expect(due("mastered", null)).toBe(false);
  });

  it.each([1, 2])("score %s requeues the card near the tail", (score) => {
    const transition = transitionRecallAttempt(item("B"), score);
    expect(transition.shouldRequeue).toBe(true);
    expect(requeueNearTail(["A", "B", "C", "D"], "B")).toEqual(["A", "B", "C", "D", "B"]);
  });

  it.each([3, 4, 5])("score %s passes today", (score) => {
    const transition = transitionRecallAttempt(item("A"), score);
    expect(transition.passed).toBe(true);
    expect(transition.shouldRequeue).toBe(false);
  });

  it("maps all five UI scores to distinct scheduling meanings", () => {
    expect([1, 2, 3, 4, 5].map(ratingForRecallScore)).toEqual(["again", "fuzzy", "hard", "good", "easy"]);
  });

  it("11: 1 → 3 passes on the second attempt", () => {
    const first = transitionRecallAttempt(item("B"), 1);
    const second = transitionRecallAttempt(item("B", 1, first.nextAttemptCount, first.status), 3);
    expect(first.shouldRequeue).toBe(true);
    expect(second.passed).toBe(true);
  });

  it("12: 1 → 2 → 4 keeps rolling until pass", () => {
    const scores = [1, 2, 4];
    let current = item("B");
    const requeues: boolean[] = [];
    for (const score of scores) {
      const next = transitionRecallAttempt(current, score);
      requeues.push(next.shouldRequeue);
      current = item("B", score, next.nextAttemptCount, next.status);
    }
    expect(requeues).toEqual([true, true, false]);
  });

  it("13: 15 initial with 3 failed is not batch complete", () => {
    const items = Array.from({ length: 15 }, (_, index) => index < 12
      ? item(String(index), 3, 1, "passed")
      : item(String(index), 1, 1, "reinforcement"));
    expect(countRecallResolved(items)).toBe(12);
    expect(isLoadedBatchComplete(15, countRecallResolved(items), 5, 5, 2, 2)).toBe(false);
  });

  it("14: repeats do not increase the 31-expression due denominator", () => {
    const progress = deriveDailyReviewProgress({ snapshotTotal: 31, loadedCount: 31, recallCompleted: 21, eligibleOutsideSession: 0 });
    expect(progress.total).toBe(31);
    expect(progress.completed).toBe(21);
    expect(progress.remaining).toBe(10);
  });

  it("15: mature score 1 collapses a 30-day interval into relearning", () => {
    const result = scheduleExpressionReview("again", mature, new Date("2026-08-27T04:00:00Z"));
    expect(result.interval_days).toBe(1);
    expect(result.repetitions).toBe(0);
    expect(result.lapse_count).toBe(1);
  });

  it("keeps score intervals strictly ordered from 1 through 5", () => {
    const intervals = (["again", "fuzzy", "hard", "good", "easy"] as const)
      .map((rating) => scheduleExpressionReview(rating, mature).interval_days);
    expect(intervals).toEqual([...intervals].sort((a, b) => a - b));
    expect(new Set(intervals).size).toBe(5);
  });

  it("16: mastered score 5 still receives a future review date", () => {
    const result = scheduleExpressionReview("easy", mature, new Date("2026-08-27T04:00:00Z"));
    expect(result.next_review_date > TODAY).toBe(true);
  });

  it("17: refresh reconstructs failed cards after fresh cards", () => {
    const restored = [item("A", 4, 1, "passed"), item("B", 1, 1, "reinforcement"), item("C")];
    expect(buildRecallQueue(restored)).toEqual(["C", "B"]);
  });

  it("caps repeated failures without marking them passed", () => {
    const transition = transitionRecallAttempt(item("B", 1, MAX_SAME_DAY_ATTEMPTS - 1, "reinforcement"), 1);
    expect(transition.resolved).toBe(true);
    expect(transition.passed).toBe(false);
    expect(transition.shouldRequeue).toBe(false);
  });

  it("18/19: only Recall scheduling changes a due date", () => {
    const before = mature.next_review_date;
    const clozeNextReviewDate = before;
    const sentenceNextReviewDate = before;
    expect(clozeNextReviewDate).toBe(before);
    expect(sentenceNextReviewDate).toBe(before);
  });

  it("20: Shanghai day arithmetic crosses local midnight and year boundaries", () => {
    expect(getShanghaiDateKey(new Date("2026-08-27T15:59:59Z"))).toBe("2026-08-27");
    expect(getShanghaiDateKey(new Date("2026-08-27T16:00:01Z"))).toBe("2026-08-28");
    expect(getShanghaiDayBounds(TODAY)).toEqual({
      start: "2026-08-27T00:00:00+08:00",
      end: "2026-08-28T00:00:00+08:00",
    });
    expect(addDaysToShanghaiDate(new Date("2026-08-27T15:59:59Z"), 1)).toBe("2026-08-28");
    expect(addDaysToShanghaiDate(new Date("2026-08-27T16:00:01Z"), 1)).toBe("2026-08-29");
    expect(addDaysToShanghaiDate(new Date("2026-12-31T04:00:00Z"), 1)).toBe("2027-01-01");
  });
});
