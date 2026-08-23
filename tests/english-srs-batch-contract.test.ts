import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const hooks = readFileSync("src/lib/hooks/useReviewSession.ts", "utf8");
const repository = readFileSync("src/lib/english/sessionRepository.ts", "utf8");
const dueRepository = readFileSync("src/lib/english/reviewRepository.ts", "utf8");
const reviewPage = readFileSync("src/pages/EnglishReviewV3.tsx", "utf8");
const homepage = readFileSync("src/pages/English.tsx", "utf8");

describe("daily SRS batch production contracts", () => {
  it("treats 15 as a batch size and preserves target_count as the daily denominator", () => {
    expect(hooks).toContain("REVIEW_BATCH_SIZE");
    expect(hooks).toContain("target_count: dailyProgress.total");
    expect(hooks).not.toContain("const DAILY_TARGET = 15");
  });

  it("excludes loaded IDs and relies on the DB unique key with idempotent upsert", () => {
    expect(hooks).toContain("getDuePoolCountExcluding");
    expect(hooks).toContain("fetchDueExpressionsFull(userId, Math.min(REVIEW_BATCH_SIZE, outsideDue), excludeIds)");
    expect(repository).toContain('onConflict: "session_id,expression_id"');
    expect(repository).toContain("ignoreDuplicates: true");
    expect(dueRepository).toContain('.order("id", { ascending: true })');
  });

  it("deduplicates rapid same-client append requests and disables the CTA in flight", () => {
    expect(hooks).toContain("appendReviewLocks");
    expect(hooks).toContain("if (existing) return existing");
    expect(reviewPage).toContain("disabled={continuing || nextBatchSize === 0}");
  });

  it("uses cumulative session items for all three modes and the final daily summary", () => {
    expect(reviewPage).toContain("const dailySetIds = useMemo(() => allItems.map((i) => i.id), [allItems])");
    expect(reviewPage).toContain("getDailyReviewProgress(session.id, allItems, practiceLogs)");
    expect(reviewPage).toContain("date: getShanghaiDateKey()");
  });

  it("keeps homepage and Review on the same stable status selector", () => {
    expect(homepage).toContain("useTodayReviewStatus");
    expect(homepage).toContain("`${reviewCompleted} / ${dueTotal}`");
    expect(homepage).toContain("reviewProgress?.dayComplete");
    expect(homepage).toContain("继续完成复习");
    expect(reviewPage).toContain("data?.dailyProgress.total");
  });

  it("uses the light Nancy OS card treatment and mobile-safe review CTA", () => {
    expect(homepage).toContain("bg-sage-light/35");
    expect(homepage).not.toContain('aria-labelledby="today-english" className="rounded-lg bg-ink');
    expect(reviewPage).toContain("w-full sm:w-auto min-h-11");
  });

  it("has distinct batch-complete and day-complete UI states", () => {
    expect(reviewPage).toContain("本批复习完成");
    expect(reviewPage).toContain("今日复习完成");
    expect(reviewPage).toContain("batchComplete ?");
    expect(reviewPage).toContain(": dayComplete ?");
  });
});
