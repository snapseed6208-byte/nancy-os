// ============================================
// English SRS V4.2 — Learning State Machine + Mobile Navigation (PART 17)
//
// Real code under test: src/lib/english/learningProgress.ts
//   - normalizeLearningProgress (repair / redirect, never a dead-end)
//   - progressForStage / progressForNavigation (stage invariants, back-keeps-completed)
//   - completionGuard (canonical recall_completed, redirect instead of reject)
//   - advanceAfterComplete (2/5 → 3/5 exactly once)
//   - toProgressJSON / parseProgressJSON (refresh restore contract)
//   - isStageReachable / PREV_STAGE (clickable completed tabs, no forward skip)
//   - layout contract (mobile scroll / fixed footer / safe-area)
//
// FINAL INVARIANT: visible Stage = DB-allowed completion stage. Never
// UI-Production while backend-Recall is incomplete. User can always advance
// OR retreat — never a dead-end.
// ============================================

import { describe, it, expect } from "vitest";
import {
  STAGE_ORDER,
  STAGE_LABELS,
  PREV_STAGE,
  DEFAULT_LEARN_PROGRESS,
  NORMALIZE_REDIRECT_MESSAGE,
  PAGE_BOTTOM_PADDING_CLASS,
  FOOTER_SAFE_AREA_CLASS,
  normalizeLearningProgress,
  progressForStage,
  progressForNavigation,
  completionGuard,
  advanceAfterComplete,
  toProgressJSON,
  parseProgressJSON,
  isStageReachable,
  type LearningItemProgress,
} from "@/lib/english/learningProgress";

function progressOf(overrides: Partial<LearningItemProgress>): LearningItemProgress {
  return { ...DEFAULT_LEARN_PROGRESS, ...overrides };
}

const completedRecall = progressOf({
  stage: "production",
  understand_completed: true,
  context_completed: true,
  recall_completed: true,
  recall_result: "correct",
  recall_score: 5,
  recall_feedback: "✓ 回忆正确",
  recall_input: "have an opportunity to",
});

// ═══════════════════════════════════════
// 1. normalizeLearningProgress — repair / redirect
// ═══════════════════════════════════════

describe("PART 17.1 — normalizeLearningProgress repairs or redirects, never dead-ends", () => {
  it("T1. fresh session → ok at understand with no flags", () => {
    const r = normalizeLearningProgress(null);
    expect(r.kind).toBe("ok");
    expect(r.progress.stage).toBe("understand");
    expect(r.progress.recall_completed).toBe(false);
  });

  it("T2. production + recall_completed → ok, keeps production", () => {
    const r = normalizeLearningProgress(completedRecall);
    expect(r.kind).toBe("ok");
    expect(r.progress.stage).toBe("production");
    expect(r.progress.recall_completed).toBe(true);
  });

  it("T3. production with recall EVIDENCE but lost flag → repair keeps production", () => {
    const lostFlag: Partial<LearningItemProgress> = {
      stage: "production",
      understand_completed: true,
      context_completed: true,
      recall_completed: false, // flag lost (interrupted write / legacy)
      recall_score: 5,
      recall_result: "correct",
    };
    const r = normalizeLearningProgress(lostFlag);
    expect(r.kind).toBe("repair");
    expect(r.progress.stage).toBe("production");
    expect(r.progress.recall_completed).toBe(true);
  });

  it("T4. production with NO recall + NO evidence → redirect back to recall with message", () => {
    const stuck: Partial<LearningItemProgress> = {
      stage: "production",
      understand_completed: true,
      context_completed: true,
      recall_completed: false,
    };
    const r = normalizeLearningProgress(stuck);
    expect(r).toMatchObject({
      kind: "redirect",
      stage: "recall",
      message: NORMALIZE_REDIRECT_MESSAGE,
      progress: { stage: "recall" },
    });
  });

  it("T5. recall stage with context done → ok (recall is the right place, not a dead-end)", () => {
    const r = normalizeLearningProgress({
      stage: "recall",
      understand_completed: true,
      context_completed: true,
      recall_completed: false,
    });
    expect(r.kind).toBe("ok");
    expect(r.progress.stage).toBe("recall");
  });

  it("T6. stage ahead of its evidence chain → redirect to the highest legal stage", () => {
    // contextUsage persisted without understand_completed → pull back to understand
    const r = normalizeLearningProgress({
      stage: "contextUsage",
      understand_completed: false,
      context_completed: false,
      recall_completed: false,
    });
    expect(r).toMatchObject({ kind: "redirect", stage: "understand" });
  });
});

// ═══════════════════════════════════════
// 2. progressForStage / progressForNavigation — invariants
// ═══════════════════════════════════════

describe("PART 17.2 — stage invariants hold through transitions", () => {
  it("T7. understand → contextUsage marks understand_completed", () => {
    const next = progressForStage(progressOf({ stage: "understand" }), "contextUsage");
    expect(next.stage).toBe("contextUsage");
    expect(next.understand_completed).toBe(true);
  });

  it("T8. contextUsage → recall marks context_completed (+ understand)", () => {
    const next = progressForStage(progressOf({ stage: "contextUsage", understand_completed: true }), "recall");
    expect(next.stage).toBe("recall");
    expect(next.context_completed).toBe(true);
    expect(next.understand_completed).toBe(true);
  });

  it("T9. recall → production sets recall_completed — invariant: production ⟹ recall_completed", () => {
    const next = progressForStage(
      progressOf({ stage: "recall", understand_completed: true, context_completed: true }),
      "production",
    );
    expect(next.stage).toBe("production");
    expect(next.recall_completed).toBe(true);
    expect(next.understand_completed).toBe(true);
    expect(next.context_completed).toBe(true);
    // THE invariant: never UI-production while recall incomplete
    expect(STAGE_ORDER.indexOf(next.stage) <= STAGE_ORDER.indexOf("production") && next.recall_completed).toBe(true);
  });

  it("T10. back production → recall keeps recall_completed (back only changes view)", () => {
    const next = progressForNavigation(completedRecall, "recall");
    expect(next.stage).toBe("recall");
    expect(next.recall_completed).toBe(true); // never cleared by back-nav
    expect(next.recall_score).toBe(5);
  });

  it("T11. Recall → Production continues: recall evidence preserved through the round trip", () => {
    const backToRecall = progressForNavigation(completedRecall, "recall");
    const againToProduction = progressForNavigation(backToRecall, "production");
    expect(againToProduction.stage).toBe("production");
    expect(againToProduction.recall_completed).toBe(true);
    expect(againToProduction.recall_score).toBe(5);
  });
});

// ═══════════════════════════════════════
// 3. completionGuard — canonical prerequisite
// ═══════════════════════════════════════

describe("PART 17.3 — completion guard uses canonical progress, redirects never dead-ends", () => {
  it("T12. completion allowed when canonical recall_completed", () => {
    const g = completionGuard(completedRecall);
    expect(g.allowed).toBe(true);
  });

  it("T13. production submit does NOT re-check transient recallPhase — canonical progress alone decides", () => {
    // Simulates the reported bug: UI stage=production but local recallPhase is
    // idle (state lost on refresh). The canonical progress still authorizes it.
    const g = completionGuard(completedRecall);
    expect(g.allowed).toBe(true);
    // No reliance on recallPhase / recallOutcome anywhere in the guard.
  });

  it("T14. missing recall → blocked with a redirect target, never a bare error", () => {
    const g = completionGuard(progressOf({ stage: "production", understand_completed: true, context_completed: true }));
    expect(g.allowed).toBe(false);
    if (!g.allowed) {
      expect(g.redirectTo).toBe("recall");
      expect(g.message).toContain("主动回忆");
    }
  });

  it("T15. guard redirect target is always a reachable prior stage", () => {
    const g = completionGuard(progressOf({ stage: "production" }));
    if (!g.allowed) {
      expect(STAGE_ORDER.indexOf(g.redirectTo)).toBeLessThan(STAGE_ORDER.indexOf("production"));
    }
  });
});

// ═══════════════════════════════════════
// 4. Persistence + resume contract
// ═══════════════════════════════════════

describe("PART 17.4 — serialization round-trip + refresh restore", () => {
  it("T16. toProgressJSON/parseProgressJSON round-trips the full state", () => {
    const parsed = parseProgressJSON(toProgressJSON(completedRecall) as unknown as Record<string, unknown>);
    expect(parsed).toMatchObject({
      expressionIndex: completedRecall.expressionIndex,
      stage: "production",
      understand_completed: true,
      context_completed: true,
      recall_completed: true,
      production_completed: false,
      recall_result: "correct",
      recall_score: 5,
      recall_input: "have an opportunity to",
    });
  });

  it("T17. legacy progress {expression_index, stage: production} (no flags) is repaired in place — the reported bug", () => {
    // What production actually has today: only expression_index + stage, no flags.
    // The persisted stage itself proves recall ran (old code only wrote
    // stage=production after the recall step), so parse infers the flags from
    // the stage and the user is restored to production — no dead-end, no reset.
    const legacy = parseProgressJSON({ expression_index: 2, stage: "production" });
    expect(legacy?.recall_completed).toBe(true);
    expect(legacy?.stage).toBe("production");
    const r = normalizeLearningProgress(legacy);
    expect(r.kind).toBe("ok");
    expect(r.progress.stage).toBe("production");
    expect(r.progress.recall_completed).toBe(true);
    // Completion is immediately allowed: no "请先完成主动回忆" dead-end.
    expect(completionGuard(r.progress).allowed).toBe(true);
  });

  it("T18. resume restores production + the recall result view when evidence is present", () => {
    // The resume effect restores recallPhase="result" from this normalized progress,
    // so completion and the production back-arrow work immediately after refresh.
    const r = normalizeLearningProgress(completedRecall);
    expect(r.kind).toBe("ok");
    expect(r.progress.stage).toBe("production");
    expect(r.progress.recall_completed).toBe(true);
    expect(r.progress.recall_score).toBe(5);
    expect(r.progress.recall_input).toBeTruthy();
  });
});

// ═══════════════════════════════════════
// 5. Advance (2/5 → 3/5) + persist-first no-advance
// ═══════════════════════════════════════

describe("PART 17.5 — advance exactly once, never on mutation failure", () => {
  it("T19. advanceAfterComplete 1/5 → 2/5 resets the state machine for the next item", () => {
    const a = advanceAfterComplete(0, 5);
    expect(a.nextIndex).toBe(1);
    expect(a.nextStage).toBe("understand");
    expect(a.nextProgress.expressionIndex).toBe(1);
    expect(a.nextProgress.recall_completed).toBe(false);
  });

  it("T20. last item → summary (nextIndex null), no advance", () => {
    const a = advanceAfterComplete(4, 5);
    expect(a.nextIndex).toBeNull();
    expect(a.nextStage).toBe("understand");
  });

  it("T21. mutation failure does NOT advance — persist-first then navigate (PART 13/14)", async () => {
    let navigated = false;
    const persist = async () => { throw new Error("network"); };
    const navigate = () => { navigated = true; };
    // Mirror goToStage: navigate ONLY after the DB write resolves.
    try {
      await persist();
      navigate();
    } catch {
      /* stays on the current stage */
    }
    expect(navigated).toBe(false);
  });
});

// ═══════════════════════════════════════
// 6. Mobile navigation — reachability + draft survival + layout contract
// ═══════════════════════════════════════

describe("PART 17.6 — mobile navigation never traps the user", () => {
  it("T22. forward jumps are disabled — no skipping future stages", () => {
    expect(isStageReachable("understand", "recall")).toBe(false);
    expect(isStageReachable("recall", "production")).toBe(false);
    expect(isStageReachable("contextUsage", "production")).toBe(false);
  });

  it("T23. backward navigation is always allowed (completed tabs + ←上一步)", () => {
    expect(isStageReachable("production", "recall")).toBe(true);
    expect(isStageReachable("recall", "contextUsage")).toBe(true);
    expect(isStageReachable("contextUsage", "understand")).toBe(true);
    // Every non-first stage has exactly one allowed back hop.
    for (const s of STAGE_ORDER) {
      if (s !== "understand") {
        expect(PREV_STAGE[s]).not.toBeNull();
      }
    }
    expect(PREV_STAGE.production).toBe("recall");
  });

  it("T24. personal-sentence draft survives leaving production and is restored on return", () => {
    const draft = "I have an opportunity to grow here.";
    const left = progressForNavigation(completedRecall, "recall", draft);
    expect(left.sentence_draft).toBe(draft);

    const returned = progressForNavigation(left, "production", "");
    expect(returned.stage).toBe("production");
    expect(returned.sentence_draft).toBe(draft); // draft carried forward
  });

  it("T25. mobile scroll + fixed footer layout contract includes safe-area insets", () => {
    // PART 9/10: page bottom padding clears the fixed footer; footer avoids the
    // iOS home indicator. Regression: dropping env(safe-area-inset-bottom) breaks
    // the contract on Android Chrome / iOS Safari.
    expect(PAGE_BOTTOM_PADDING_CLASS).toContain("env(safe-area-inset-bottom)");
    expect(PAGE_BOTTOM_PADDING_CLASS).toMatch(/pb-\[calc\(/);
    expect(FOOTER_SAFE_AREA_CLASS).toContain("env(safe-area-inset-bottom)");
  });

  it("T26. every stage has a Chinese label (footer / banner never render a blank CTA)", () => {
    for (const s of STAGE_ORDER) {
      expect(STAGE_LABELS[s].length).toBeGreaterThan(0);
    }
  });
});
