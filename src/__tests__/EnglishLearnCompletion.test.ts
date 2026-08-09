// ============================================
// English SRS V4.1 — Learning Completion Regression (PART 20)
//
// The completion transaction must be atomic and idempotent:
//   - one sentence = one practice record (INSERT at submit, UPDATE at AI,
//     REFERENCE at completion — never a second INSERT)
//   - advance ONLY after core success (RPC)
//   - retry advances exactly once, never duplicates
//   - SRS initialized exactly once; already-reviewed expressions untouched
//
// Real code under test: classifyCompletionError (from EnglishLearn.tsx).
// The completion coordinator model below is a faithful transliteration of
// completeCurrent in src/pages/EnglishLearn.tsx — same guard order, same
// STEP A-F sequence, same failure semantics.
// ============================================

import { describe, it, expect, vi } from "vitest";
import { classifyCompletionError } from "@/pages/EnglishLearn";

// ═══════════════════════════════════════
// 1. Real code — DB error classification (PART 13)
// ═══════════════════════════════════════

describe("PART 20.1 — classifyCompletionError (real code)", () => {
  it("classifies 23514 CHECK violation as a friendly retryable message", () => {
    const msg = classifyCompletionError({ code: "23514", message: "new row violates check constraint" });
    expect(msg).toContain("学习进度保存失败");
    expect(msg).toContain("重试");
  });

  it("classifies network failure as a network message", () => {
    const msg = classifyCompletionError({ message: "Failed to fetch" });
    expect(msg).toContain("网络暂时异常");
  });

  it("classifies 23505 duplicate as retryable", () => {
    const msg = classifyCompletionError({ code: "23505" });
    expect(msg).toContain("重复提交");
  });

  it("classifies unknown errors without leaking raw SQL", () => {
    const msg = classifyCompletionError({ message: 'syntax error at or near "DROP TABLE"' });
    expect(msg).toBe("学习进度保存失败，请重试。");
  });

  it("never returns the old generic '完成失败：未知错误'", () => {
    const msg = classifyCompletionError(null);
    expect(msg).not.toContain("完成失败");
    expect(msg).toContain("重试");
  });
});

// ═══════════════════════════════════════
// 2. Completion coordinator model (mirrors completeCurrent)
// ═══════════════════════════════════════

type RecallPhase = "idle" | "checking" | "result";

interface FlowItem {
  id: string;
  expressionId: string;
  userSentence: string | null;
}

interface FlowSession {
  id: string;
}

interface FlowCallbacks {
  rpc: (args: {
    p_session_id: string;
    p_item_id: string;
    p_recall_score: number;
    p_sentence_score: number | null;
    p_srs: { status: string; result: string };
  }) => Promise<{ error: { message: string; code?: string } | null }>;
  insertLog: (entry: { expressionId: string; sessionId: string; mode: string }) => Promise<string>;
  updateLog: (id: string, updates: { metadata: Record<string, unknown> }) => Promise<void>;
  updateItem: (updates: { userSentence: string }) => Promise<void>;
  invalidate: () => void;
  persistProgress: (idx: number, stage: string) => void;
}

interface CompletionInput {
  item: FlowItem;
  session: FlowSession;
  completing: boolean;
  completedSet: Set<string>;
  recallPhase: RecallPhase;
  recallOutcome: { score: number; feedback: string } | null;
  sentenceInput: string;
  sentenceEvaluation: { overall_feedback?: string } | null;
  recallInput: string;
  currentIndex: number;
  itemsLength: number;
  practiceLogId: string | null;
  sentenceScoreOf?: (evaluation: { overall_feedback?: string }) => number;
}

interface CompletionOutput {
  advancedTo: number | null;
  showedSummary: boolean;
  rpcCalls: number;
  insertedLog: boolean;
  updatedLog: boolean;
  practiceLogId: string | null;
  error: string | null;
  retry: boolean;
  completedExprId: string | null;
}

const defaultSentenceScore = () => 5;

async function runComplete(input: CompletionInput, cb: FlowCallbacks): Promise<CompletionOutput> {
  const out: CompletionOutput = {
    advancedTo: null,
    showedSummary: false,
    rpcCalls: 0,
    insertedLog: false,
    updatedLog: false,
    practiceLogId: input.practiceLogId,
    error: null,
    retry: false,
    completedExprId: null,
  };

  // Guards mirror completeCurrent
  if (!input.item || !input.session || input.completing) return out;
  if (input.completedSet.has(input.item.expressionId)) return out;
  if (input.recallPhase !== "result" || !input.recallOutcome) {
    out.error = "请先完成「主动回忆」检查";
    return out;
  }

  try {
    const sentence = input.sentenceInput.trim();

    // STEP A — save sentence if not already persisted
    if (sentence && !input.item.userSentence) {
      await cb.updateItem({ userSentence: sentence });
    }

    // STEP B — SRS computed in TS, passed as p_srs
    const rating = input.recallOutcome.score >= 3 ? "good" : "hard";
    const sentenceScore = input.sentenceEvaluation
      ? (input.sentenceScoreOf ?? defaultSentenceScore)(input.sentenceEvaluation)
      : sentence
        ? 1
        : null;

    // STEP C — atomic core completion (RPC)
    const { error: rpcError } = await cb.rpc({
      p_session_id: input.session.id,
      p_item_id: input.item.id,
      p_recall_score: input.recallOutcome.score,
      p_sentence_score: sentenceScore,
      p_srs: { status: "review", result: rating },
    });
    if (rpcError) throw rpcError;
    out.rpcCalls = 1;

    // STEP D — practice log enrichment (soft-fail)
    if (input.practiceLogId) {
      await cb.updateLog(input.practiceLogId, { metadata: { learn_completed: true } });
      out.updatedLog = true;
    } else {
      const id = await cb.insertLog({
        expressionId: input.item.expressionId,
        sessionId: input.session.id,
        mode: "learn",
      });
      out.insertedLog = true;
      out.practiceLogId = id;
    }

    // STEP E — mark done + advance (ONLY after core success)
    out.completedExprId = input.item.expressionId;
    if (input.currentIndex < input.itemsLength - 1) {
      out.advancedTo = input.currentIndex + 1;
      cb.persistProgress(out.advancedTo, "understand");
    } else {
      out.showedSummary = true;
    }

    // STEP F — query invalidation
    cb.invalidate();
  } catch (err) {
    out.error = classifyCompletionError(err);
    out.retry = true;
  }

  return out;
}

function makeCallbacks(overrides?: Partial<FlowCallbacks>): FlowCallbacks {
  const rpc = overrides?.rpc ?? (async () => ({ error: null }));
  const insertLog = overrides?.insertLog ?? (async () => "log-new");
  const updateLog = overrides?.updateLog ?? (async () => {});
  const updateItem = overrides?.updateItem ?? (async () => {});
  const invalidate = overrides?.invalidate ?? (() => {});
  const persistProgress = overrides?.persistProgress ?? (() => {});
  return { rpc, insertLog, updateLog, updateItem, invalidate, persistProgress };
}

function baseInput(overrides?: Partial<CompletionInput>): CompletionInput {
  return {
    item: { id: "item-1", expressionId: "expr-1", userSentence: null },
    session: { id: "sess-1" },
    completing: false,
    completedSet: new Set<string>(),
    recallPhase: "result",
    recallOutcome: { score: 5, feedback: "✓ 回忆正确" },
    sentenceInput: "",
    sentenceEvaluation: null,
    recallInput: "have an opportunity to",
    currentIndex: 0,
    itemsLength: 5,
    practiceLogId: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════
// 3. Regression scenarios
// ═══════════════════════════════════════

describe("PART 20.2 — completion transaction integrity", () => {
  it("advances 1/5 → 2/5 exactly once on core success", async () => {
    const cb = makeCallbacks();
    const out = await runComplete(baseInput(), cb);
    expect(out.advancedTo).toBe(1);
    expect(out.rpcCalls).toBe(1);
    expect(out.completedExprId).toBe("expr-1");
    expect(out.error).toBeNull();
  });

  it("shows summary on the last item instead of advancing", async () => {
    const out = await runComplete(baseInput({ currentIndex: 4, itemsLength: 5 }), makeCallbacks());
    expect(out.advancedTo).toBeNull();
    expect(out.showedSummary).toBe(true);
  });

  it("creates exactly ONE practice log when no sentence was submitted (recall-only)", async () => {
    const insertLog = vi.fn(async () => "log-rec");
    const out = await runComplete(baseInput(), makeCallbacks({ insertLog }));
    expect(out.insertedLog).toBe(true);
    expect(out.updatedLog).toBe(false);
    expect(out.practiceLogId).toBe("log-rec");
    expect(insertLog).toHaveBeenCalledTimes(1);
  });

  it("references the SAME practice log id when one exists — never a second INSERT", async () => {
    const insertLog = vi.fn(async () => "log-x");
    const updateLog = vi.fn(async () => {});
    const out = await runComplete(
      baseInput({ practiceLogId: "log-created-at-submit" }),
      makeCallbacks({ insertLog, updateLog }),
    );
    expect(out.updatedLog).toBe(true);
    expect(out.insertedLog).toBe(false);
    expect(insertLog).not.toHaveBeenCalled();
    expect(updateLog).toHaveBeenCalledTimes(1);
    expect(out.practiceLogId).toBe("log-created-at-submit");
  });

  it("missing AI feedback still completes (sentenceScore falls back)", async () => {
    const cb = makeCallbacks();
    const out = await runComplete(baseInput({ sentenceInput: "  I have an opportunity to grow.  " }), cb);
    expect(out.completedExprId).toBe("expr-1");
    expect(out.error).toBeNull();
  });

  it("core RPC failure does NOT advance and is classified as retryable", async () => {
    const rpc = async () => ({ error: { code: "23514", message: "check violation" } });
    const invalidate = vi.fn(() => {});
    const out = await runComplete(baseInput(), makeCallbacks({ rpc, invalidate }));
    expect(out.advancedTo).toBeNull();
    expect(out.completedExprId).toBeNull();
    expect(out.error).toContain("学习进度保存失败");
    expect(out.retry).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("retry after a failure advances exactly once (no double advance)", async () => {
    let fail = true;
    const rpc = async () => {
      if (fail) {
        fail = false;
        return { error: { message: "Failed to fetch" } };
      }
      return { error: null };
    };
    const first = await runComplete(baseInput(), makeCallbacks({ rpc }));
    expect(first.advancedTo).toBeNull();
    expect(first.retry).toBe(true);

    const second = await runComplete(baseInput(), makeCallbacks({ rpc }));
    expect(second.advancedTo).toBe(1);
    expect(second.rpcCalls).toBe(1);
    expect(second.retry).toBe(false);
  });

  it("rapid double-click (second call while first still running) does not duplicate", async () => {
    const rpcCalls: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((res) => { release = res; });
    const rpc = async () => {
      rpcCalls.push("x");
      await gate; // first call holds; second call is blocked by `completing`
      return { error: null };
    };
    const cb = makeCallbacks({ rpc });
    const first = runComplete(baseInput(), cb); // starts, completing=true
    const second = await runComplete(baseInput({ completing: true }), cb); // blocked by guard
    release();
    const firstRes = await first;

    expect(rpcCalls).toHaveLength(1);
    expect(second.rpcCalls).toBe(0);
    expect(firstRes.advancedTo).toBe(1);
  });

  it("already-completed expression is skipped entirely (idempotent completion)", async () => {
    const cb = makeCallbacks();
    const out = await runComplete(
      baseInput({ completedSet: new Set(["expr-1"]) }),
      cb,
    );
    expect(out.rpcCalls).toBe(0);
    expect(out.advancedTo).toBeNull();
    expect(out.completedExprId).toBeNull();
  });

  it("recall-not-checked is blocked before any RPC or advance", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const out = await runComplete(
      baseInput({ recallPhase: "idle", recallOutcome: null }),
      makeCallbacks({ rpc }),
    );
    expect(out.error).toBe("请先完成「主动回忆」检查");
    expect(rpc).not.toHaveBeenCalled();
    expect(out.advancedTo).toBeNull();
  });

  it("query invalidation fires with the completion (all dependent views refresh)", async () => {
    const invalidate = vi.fn(() => {});
    const persistProgress = vi.fn(() => {});
    await runComplete(baseInput(), makeCallbacks({ invalidate, persistProgress }));
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(persistProgress).toHaveBeenCalledWith(1, "understand");
  });

  it("sentence + practice log id survive a failure so retry does not lose input", async () => {
    let fail = true;
    const rpc = async () => {
      if (fail) { fail = false; return { error: { message: "Failed to fetch" } }; }
      return { error: null };
    };
    const first = await runComplete(
      baseInput({ practiceLogId: "log-1", sentenceInput: "I have an opportunity to lead." }),
      makeCallbacks({ rpc }),
    );
    expect(first.retry).toBe(true);

    // Retry reuses the SAME practiceLogId and sentence — no re-insert
    const second = await runComplete(
      baseInput({ practiceLogId: "log-1", sentenceInput: "I have an opportunity to lead." }),
      makeCallbacks({ rpc }),
    );
    expect(second.updatedLog).toBe(true);
    expect(second.insertedLog).toBe(false);
    expect(second.advancedTo).toBe(1);
  });

  it("double-click AFTER completion does not re-run RPC or re-advance", async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    const completedSet = new Set<string>();
    const cb = makeCallbacks({ rpc });

    const first = await runComplete(baseInput({ completedSet }), cb);
    expect(first.advancedTo).toBe(1);

    // Simulate the second click arriving after the item was marked done
    completedSet.add("expr-1");
    const second = await runComplete(
      baseInput({ completedSet, currentIndex: 1 }),
      cb,
    );
    expect(second.rpcCalls).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
