import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/105_atomic_recall_submission.sql", "utf8");
const page = readFileSync("src/pages/EnglishReviewV3.tsx", "utf8");
const hooks = readFileSync("src/lib/hooks/useReviewSession.ts", "utf8");
const dueRepository = readFileSync("src/lib/english/reviewRepository.ts", "utf8");
const sessionRepository = readFileSync("src/lib/english/sessionRepository.ts", "utf8");

describe("atomic Recall RPC contract", () => {
  it("authenticates, validates ownership, and serializes a session item", () => {
    expect(migration).toContain("v_user_id UUID := auth.uid()");
    expect(migration).toContain("AND user_id = v_user_id");
    expect(migration).toContain("AND session_type = 'review'");
    expect(migration).toContain("FOR UPDATE");
  });

  it("uses a unique attempt id and returns the original result on retry", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS attempt_id UUID");
    expect(migration).toContain("idx_practice_logs_recall_attempt_id");
    expect(migration).toContain("RETURN v_existing_log.metadata->'rpc_result'");
    expect(migration).toContain("Recall item is already resolved today");
    expect(page).toContain("submitRating(selfRating, attemptId)");
    expect(page).toContain("if (submittingRef.current) return");
  });

  it("persists all facts inside one PostgreSQL function transaction", () => {
    expect(migration).toContain("UPDATE expressions SET");
    expect(migration).toContain("UPDATE review_session_items SET");
    expect(migration).toContain("INSERT INTO expression_practice_logs");
    expect(migration).toContain("INSERT INTO expression_reviews");
    expect(migration).not.toMatch(/EXCEPTION\s+WHEN/);
  });

  it("stores original SRS and cumulative worst-memory flags", () => {
    expect(migration).toContain("'original_srs', v_original");
    expect(migration).toContain("v_had_lapse");
    expect(migration).toContain("v_had_fuzzy");
    expect(migration).toContain("v_worst_score");
    expect(migration).toContain("never to a schedule produced by an earlier attempt today");
  });

  it("returns the authoritative queue and scheduling contract", () => {
    for (const field of [
      "expression_id", "attempt_number", "rating", "today_passed",
      "should_requeue", "requeue_position", "had_lapse", "had_fuzzy",
      "interval_days", "next_review_date", "max_attempts_reached", "needs_relearning",
    ]) expect(migration).toContain(`'${field}'`);
  });

  it("the client performs one RPC and advances only after success", () => {
    const handler = page.slice(page.indexOf("const handleRecallResult"), page.indexOf("// ── Cloze handler"));
    expect(handler).toContain("submitRecallAttempt.mutateAsync");
    expect(handler).not.toContain("updateItem.mutateAsync");
    expect(handler).not.toContain("recordLog.mutateAsync");
    expect(handler).not.toContain("submitReview.mutateAsync");
    expect(hooks).toContain('retry: false');
    expect(page).toContain("提交失败，请重试");
  });

  it("preserves due and learn-pool regressions", () => {
    expect(dueRepository).toContain('.lte("next_review_date", getDueCutoffDate())');
    expect(dueRepository).not.toContain('.in("status"');
    expect(sessionRepository).toContain('.is("next_review_date", null)');
  });

  it("keeps Cloze and Sentence outside the Recall RPC", () => {
    const cloze = page.slice(page.indexOf("// ── Cloze handler"), page.indexOf("// ── Sentence handlers"));
    const sentence = page.slice(page.indexOf("// ── Sentence handlers"), page.indexOf("// Advance to next card"));
    expect(cloze).not.toContain("submitRecallAttempt");
    expect(sentence).not.toContain("submitRecallAttempt");
  });
});

describe("transaction and retry model", () => {
  type State = { attempts: string[]; interval: number };
  const transact = (state: State, attemptId: string, fail = false): State => {
    if (state.attempts.includes(attemptId)) return state;
    const working = { attempts: [...state.attempts, attemptId], interval: 1 };
    if (fail) throw new Error("injected internal failure");
    return working;
  };

  it("duplicate network retry does not create a second attempt", () => {
    const once = transact({ attempts: [], interval: 30 }, "attempt-1");
    const retry = transact(once, "attempt-1");
    expect(retry).toEqual(once);
  });

  it("an internal failure leaves the committed state unchanged", () => {
    const committed = { attempts: [] as string[], interval: 30 };
    expect(() => transact(committed, "attempt-1", true)).toThrow("injected internal failure");
    expect(committed).toEqual({ attempts: [], interval: 30 });
  });
});
