import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const hooks = readFileSync("src/lib/hooks/useReviewSession.ts", "utf8");
const repository = readFileSync("src/lib/english/sessionRepository.ts", "utf8");
const dueRepository = readFileSync("src/lib/english/reviewRepository.ts", "utf8");
const reviewPage = readFileSync("src/pages/EnglishReviewV3.tsx", "utf8");
const homepage = readFileSync("src/pages/English.tsx", "utf8");
const expressionHub = readFileSync("src/pages/EnglishExpressionHub.tsx", "utf8");
const shanghaiDateHook = readFileSync("src/lib/hooks/useShanghaiDateKey.ts", "utf8");

describe("daily SRS batch production contracts", () => {
  it("treats 15 as a batch size and preserves target_count as the daily denominator", () => {
    expect(hooks).toContain("REVIEW_BATCH_SIZE");
    expect(hooks).toContain("target_count: dailyProgress.total");
    expect(hooks).not.toContain("const DAILY_TARGET = 15");
  });

  it("excludes loaded IDs and relies on the DB unique key with idempotent upsert", () => {
    expect(hooks).toContain("getDuePoolCountExcluding");
    expect(hooks).toContain("fetchDueExpressionsFull(userId, requestedCount, excludeIds)");
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
    expect(expressionHub).toContain("useTodayReviewStatus");
    expect(reviewPage).toContain("useTodayReviewStatus");
    expect(homepage).toContain("`${reviewCompleted} / ${dueTotal}`");
    expect(homepage).toContain("reviewProgress?.dayComplete");
    expect(homepage).toContain("继续完成复习");
    expect(reviewPage).toContain("todayReviewStatus?.total");
    expect(reviewPage).toContain("todayReviewStatus?.completed");
    expect(reviewPage).toContain("todayReviewStatus?.remaining");
  });

  it("uses the light Nancy OS card treatment and mobile-safe review CTA", () => {
    expect(homepage).toContain("bg-sage-light/35");
    expect(homepage).not.toContain('aria-labelledby="today-english" className="rounded-lg bg-ink');
    expect(reviewPage).toContain("w-full sm:w-auto min-h-11");
    expect(reviewPage).toContain("grid grid-cols-3 gap-1 min-w-0");
    expect(reviewPage).toContain("min-w-0 flex flex-col sm:flex-row");
    expect(reviewPage).toContain("hidden sm:block shrink-0");
  });

  it("has distinct batch-complete and day-complete UI states", () => {
    expect(reviewPage).toContain("本批复习完成");
    expect(reviewPage).toContain("今日复习完成");
    expect(reviewPage).toContain("batchComplete ?");
    expect(reviewPage).toContain(": dayComplete ?");
  });

  it("orders same-created-at session items deterministically and preserves the next unresolved item", () => {
    const sessionItemsQuery = repository.indexOf("export async function fetchSessionItems");
    const createdOrder = repository.indexOf('.order("created_at", { ascending: true })', sessionItemsQuery);
    const idOrder = repository.indexOf('.order("id", { ascending: true })', createdOrder);
    expect(createdOrder).toBeGreaterThan(sessionItemsQuery);
    expect(idOrder).toBeGreaterThan(createdOrder);
    const rows = Array.from({ length: 15 }, (_, index) => ({
      id: `item-${String(14 - index).padStart(2, "0")}`,
      createdAt: "2026-08-23T08:00:00.000Z",
      completed: false,
    }));
    const stableSort = (items: typeof rows) => [...items].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const firstRead = stableSort(rows);
    firstRead.slice(0, 7).forEach((item) => { item.completed = true; });
    const nextBeforeRefresh = firstRead.find((item) => !item.completed)?.id;
    const refetched = stableSort([...firstRead].reverse());
    expect(refetched.map((item) => item.id)).toEqual(firstRead.map((item) => item.id));
    expect(refetched.find((item) => !item.completed)?.id).toBe(nextBeforeRefresh);
  });

  it("uses Shanghai-date-aware query keys and schedules midnight/focus checks", () => {
    expect(hooks).toContain('todaySession: (dateKey: string) => ["review-session", dateKey]');
    expect(hooks).toContain('todayStatus: (dateKey: string) => ["today-review-status", dateKey]');
    expect(hooks).not.toContain('["review-session", "today"]');
    expect(hooks).not.toContain('["today-review-status", "today"]');
    expect(shanghaiDateHook).toContain("getMillisecondsUntilNextShanghaiMidnight");
    expect(shanghaiDateHook).toContain('window.addEventListener("focus", refreshDateKey)');
  });

  it("reconciles confirmed empty/partial pools but preserves target_count on query errors", () => {
    const fetchIndex = hooks.indexOf("fetchDueExpressionsFull(userId, requestedCount, excludeIds)");
    const reconcileIndex = hooks.indexOf("reconcileDailyReviewProgress({", fetchIndex);
    const updateIndex = hooks.indexOf('.from("review_sessions")', reconcileIndex);
    expect(fetchIndex).toBeGreaterThan(-1);
    expect(reconcileIndex).toBeGreaterThan(fetchIndex);
    expect(updateIndex).toBeGreaterThan(reconcileIndex);
    expect(hooks).toContain('throw new Error("下一批暂时无法加载，请重试")');
    expect(hooks).toContain('console.warn("[daily_review_reconciled]"');
    expect(reviewPage).toContain("今日复习任务已更新");
    expect(reviewPage).toContain("重试加载下一批");
  });
});
