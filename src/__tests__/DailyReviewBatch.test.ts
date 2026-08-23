import { describe, expect, it } from "vitest";
import {
  REVIEW_BATCH_SIZE,
  deriveDailyReviewProgress,
  isDailyReviewComplete,
  isLoadedBatchComplete,
  reconcileDailyReviewProgress,
} from "@/lib/english/dailyReviewBatch";

function progress(snapshotTotal: number, loadedCount: number, recallCompleted: number, eligibleOutsideSession: number) {
  return deriveDailyReviewProgress({ snapshotTotal, loadedCount, recallCompleted, eligibleOutsideSession });
}

describe("full daily SRS due pool batching", () => {
  it.each([
    [0, 0, 0],
    [8, 8, 8],
    [15, 15, 15],
    [16, 15, 15],
    [31, 15, 15],
  ])("loads the correct first batch for %i due", (due, expectedLoaded, expectedBatch) => {
    const result = progress(due, 0, 0, due);
    expect(Math.min(REVIEW_BATCH_SIZE, result.remaining)).toBe(expectedBatch);
    expect(Math.min(REVIEW_BATCH_SIZE, due)).toBe(expectedLoaded);
  });

  it("31 due becomes 15 + 15 + 1 without changing the daily total", () => {
    const afterFirst = progress(31, 15, 15, 16);
    expect(afterFirst).toMatchObject({ total: 31, completed: 15, remaining: 16, nextBatchSize: 15 });

    const afterSecond = progress(afterFirst.total, 30, 30, 1);
    expect(afterSecond).toMatchObject({ total: 31, completed: 30, remaining: 1, nextBatchSize: 1 });

    const afterThird = progress(afterSecond.total, 31, 31, 0);
    expect(afterThird).toMatchObject({ total: 31, completed: 31, remaining: 0, nextBatchSize: 0 });
  });

  it("does not declare the day complete after the first completed batch", () => {
    const result = progress(31, 15, 15, 16);
    const batchDone = isLoadedBatchComplete(15, 15, 15, 15);
    expect(batchDone).toBe(true);
    expect(result.remaining).toBe(16);
    expect(batchDone && result.remaining === 0).toBe(false);
  });

  it("15 due is day complete only after all three modes finish", () => {
    const result = progress(15, 15, 15, 0);
    expect(result.remaining).toBe(0);
    expect(isDailyReviewComplete(result.total, result.remaining, isLoadedBatchComplete(15, 15, 15, 15))).toBe(true);
    expect(isDailyReviewComplete(result.total, result.remaining, isLoadedBatchComplete(15, 15, 14, 15))).toBe(false);
  });

  it("keeps the denominator stable after SM-2 removes completed rows from live due", () => {
    expect(progress(31, 15, 1, 16).total).toBe(31);
    expect(progress(31, 15, 15, 16).total).toBe(31);
  });

  it("may grow, but never shrink, when another expression becomes due mid-day", () => {
    expect(progress(31, 15, 5, 17).total).toBe(32);
    expect(progress(31, 15, 5, 10).total).toBe(31);
  });

  it("resumes a partially completed second batch from persisted cumulative items", () => {
    const resumed = progress(31, 30, 22, 1);
    expect(resumed).toMatchObject({ total: 31, completed: 22, remaining: 9, loadedCount: 30, unloadedRemaining: 1 });
  });

  it("requires recall, cloze, and sentence to complete the same loaded set", () => {
    expect(isLoadedBatchComplete(30, 30, 30, 30)).toBe(true);
    expect(isLoadedBatchComplete(30, 30, 29, 30)).toBe(false);
    expect(isLoadedBatchComplete(30, 30, 30, 29)).toBe(false);
  });

  it("reconciles a stale 31-item snapshot when no eligible items remain", () => {
    const result = reconcileDailyReviewProgress({
      snapshotTotal: 31,
      loadedCount: 15,
      recallCompleted: 15,
      eligibleOutsideSession: 0,
    });
    expect(result.reconciled).toBe(true);
    expect(result.progress).toMatchObject({ total: 15, completed: 15, remaining: 0 });
  });

  it("accepts a partial 10-item batch and preserves real remaining work", () => {
    const withSixStillEligible = reconcileDailyReviewProgress({
      snapshotTotal: 31,
      loadedCount: 25,
      recallCompleted: 15,
      eligibleOutsideSession: 6,
    });
    expect(withSixStillEligible.reconciled).toBe(false);
    expect(withSixStillEligible.progress).toMatchObject({ total: 31, loadedCount: 25, unloadedRemaining: 6 });

    const exhaustedPool = reconcileDailyReviewProgress({
      snapshotTotal: 31,
      loadedCount: 25,
      recallCompleted: 15,
      eligibleOutsideSession: 0,
    });
    expect(exhaustedPool.reconciled).toBe(true);
    expect(exhaustedPool.progress).toMatchObject({ total: 25, remaining: 10 });
  });
});
