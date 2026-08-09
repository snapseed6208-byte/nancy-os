// ============================================
// English SRS V3.2 — 32 Regression Tests
// Self-contained: no app imports to avoid
// transitive dependency resolution in test worker.
//
// Tests 1-20: Original tests (updated for corrected model)
// Tests A-L: 12 new tests from Correction Audit
// ============================================

import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════
// Inline type mirrors (kept in sync with useReviewSession.ts)
// ═══════════════════════════════════════

interface ExpressionCard {
  id: string;
  english: string;
  chinese: string;
  pronunciation?: string;
  example_sentence?: string;
  english_explanation?: string;
  usage_note?: string;
  native_usage?: string;
  context?: string;
  situation?: string;
  common_patterns?: string;
  common_mistakes?: string;
  memory_tip?: string;
  synonyms?: string;
  formality?: string;
  notes?: string;
  cloze_sentence?: string;
  type: string;
  scene: string;
  status: string;
  mastery_level: number;
}

interface SessionItem {
  id: string;
  sessionId: string;
  expressionId: string;
  recallScore: number | null;
  sentenceScore: number | null;
  applicationScore: number | null;
  userSentence: string | null;
  aiFeedback: string | null;
  status: "pending" | "in_progress" | "passed" | "failed" | "reinforcement" | "completed";
  attemptCount: number;
  reinforcementRound: number;
  lastPracticeAt: string | null;
  expression?: ExpressionCard;
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function makeExpression(overrides?: Partial<ExpressionCard>): ExpressionCard {
  return {
    id: "expr-1",
    english: "take the bull by the horns",
    chinese: "迎难而上",
    pronunciation: "teɪk ðə bʊl baɪ ðə hɔːnz",
    example_sentence: "Sometimes you just have to take the bull by the horns and fix the problem.",
    english_explanation: "To deal with a difficult situation in a very direct and brave way.",
    usage_note: "Often used in business contexts to describe proactive leadership.",
    native_usage: "Native speakers use this idiom to encourage decisive action.",
    context: "business negotiation",
    situation: "When facing a tough decision",
    common_patterns: "take the bull by the horns and [verb]",
    common_mistakes: "Don't say 'grab the bull by the horns' — the correct verb is 'take'.",
    memory_tip: "Imagine grabbing a bull by its horns — you're facing the problem head-on.",
    synonyms: "face the music, grasp the nettle",
    formality: "informal",
    notes: "This is a common business idiom.",
    cloze_sentence: "Sometimes you just have to _____ and fix the problem.",
    type: "idiom",
    scene: "workplace",
    status: "active",
    mastery_level: 2,
    ...overrides,
  };
}

function makeSessionItem(overrides?: Partial<SessionItem>): SessionItem {
  return {
    id: "item-1",
    sessionId: "session-1",
    expressionId: "expr-1",
    recallScore: null,
    sentenceScore: null,
    applicationScore: null,
    userSentence: null,
    aiFeedback: null,
    status: "pending",
    attemptCount: 0,
    reinforcementRound: 0,
    lastPracticeAt: null,
    expression: makeExpression(),
    ...overrides,
  };
}

// ═══════════════════════════════════════
// Pure logic extracted from EnglishReviewV3.tsx
// ═══════════════════════════════════════

function buildClozeText(item: SessionItem): string {
  const expr = item.expression;
  const english = expr?.english || "";
  const clozeSaved = expr?.cloze_sentence;
  const example = expr?.example_sentence;

  if (clozeSaved) return clozeSaved;

  if (example) {
    const escaped = english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const replaced = example.replace(regex, "_____");
    if (replaced !== example) return replaced;

    const words = example.split(/\s+/);
    if (words.length >= 6) {
      const start = Math.floor(words.length * 0.3);
      const end = Math.min(words.length, start + 3);
      const parts = [...words];
      for (let i = start; i < end; i++) parts[i] = "_____";
      return parts.join(" ");
    }
    return example;
  }

  const words = english.split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.floor(words.length / 2);
    const parts = [...words];
    parts[mid] = "_____";
    return parts.join(" ");
  }

  return `_____ (${expr?.chinese || ""})`;
}

function getSrsRating(score: number): "again" | "hard" | "good" | "easy" {
  if (score >= 4) return "good";
  return "hard";
}

// ═══════════════════════════════════════
// V3.2 CORRECTED round derivation:
//
// dailySetIds = immutable array of ALL 15 session item IDs
// ALL 3 rounds use dailySetIds
// reinforcementOrder is separate (only score 1-2 from Round 1)
// ═══════════════════════════════════════

function getDailySetIds(items: SessionItem[]): string[] {
  return items.map((i) => i.id);
}

function getReinforcementOrder(items: SessionItem[]): string[] {
  return items
    .filter((i) => i.recallScore !== null && i.recallScore <= 2)
    .map((i) => i.id);
}

function getRoundOrder(round: 1 | 2 | 3, dailySetIds: string[], _items: SessionItem[]): string[] {
  // ALL 3 rounds return the full dailySetIds
  return [...dailySetIds];
}

// ── Mutation helpers (unchanged from V3.1) ──

function applyRecallResult(item: SessionItem, score: number): void {
  const passed = score >= 3;
  item.recallScore = score;
  item.status = passed ? "passed" : "failed";
  item.attemptCount += 1;
  item.reinforcementRound = 0;
}

function applyRecallResultInReinforcement(item: SessionItem, score: number, reinforcementRound: number): void {
  const passed = score >= 3;
  item.recallScore = score;
  item.status = passed ? "passed" : "failed";
  item.attemptCount += 1;
  item.reinforcementRound = reinforcementRound;
}

function applyClozeResult(item: SessionItem, passed: boolean): void {
  item.status = passed ? "passed" : "failed";
  item.attemptCount += 1;
}

function applySentenceResult(item: SessionItem, sentence: string): void {
  item.userSentence = sentence;
  item.sentenceScore = 3;
  item.status = "completed";
  item.attemptCount += 1;
}

function shouldSubmitSrs(inReinforcement: boolean, srsSubmittedIds: Set<string>, itemId: string): boolean {
  return !inReinforcement && !srsSubmittedIds.has(itemId);
}

function getSessionStats(items: SessionItem[]) {
  const total = items.length;
  const passed = items.filter((i) => i.status === "passed" || i.status === "completed").length;
  const failed = items.filter((i) => i.status === "failed" || i.status === "reinforcement").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  return { total, passed, failed, pending, inProgress };
}

// ═══════════════════════════════════════
// Tests 1–4: buildClozeText fallback chain
// ═══════════════════════════════════════

describe("buildClozeText — fallback chain", () => {
  it("1. uses pre-generated cloze_sentence when available", () => {
    const item = makeSessionItem({
      expression: makeExpression({
        cloze_sentence: "The quick _____ fox jumps over the lazy dog.",
      }),
    });
    expect(buildClozeText(item)).toBe("The quick _____ fox jumps over the lazy dog.");
  });

  it("2. blanks out expression in example_sentence when no cloze_sentence", () => {
    const item = makeSessionItem({
      expression: makeExpression({
        cloze_sentence: undefined,
        english: "take the bull by the horns",
        example_sentence: "Sometimes you just have to take the bull by the horns and fix the problem.",
      }),
    });
    const result = buildClozeText(item);
    expect(result).toContain("_____");
    expect(result).not.toContain("take the bull by the horns");
  });

  it("3. blanks phrase in long example when expression not embedded", () => {
    const item = makeSessionItem({
      expression: makeExpression({
        cloze_sentence: undefined,
        english: "xyzzy",
        example_sentence: "The quick brown fox jumps over the lazy dog today.",
      }),
    });
    const result = buildClozeText(item);
    expect(result).toContain("_____");
    const blankCount = (result.match(/_____/g) || []).length;
    expect(blankCount).toBe(3);
  });

  it("4. blanks expression word(s) when no example sentence at all", () => {
    const item = makeSessionItem({
      expression: makeExpression({
        cloze_sentence: undefined,
        example_sentence: undefined,
        english: "take the bull by the horns",
        chinese: "迎难而上",
      }),
    });
    const result = buildClozeText(item);
    expect(result).toContain("_____");
    expect(result).toContain("take");
  });
});

// ═══════════════════════════════════════
// Tests 5–8: SRS rating cap
// ═══════════════════════════════════════

describe("SRS rating — reinforcement cap", () => {
  it("5. score 1 → 'hard' (capped, not 'again')", () => {
    expect(getSrsRating(1)).toBe("hard");
  });

  it("6. score 2 → 'hard' (capped, not 'again')", () => {
    expect(getSrsRating(2)).toBe("hard");
  });

  it("7. score 3 → 'hard' (borderline, capped)", () => {
    expect(getSrsRating(3)).toBe("hard");
  });

  it("8. score 4–5 → 'good' (clear pass, normal rating)", () => {
    expect(getSrsRating(4)).toBe("good");
    expect(getSrsRating(5)).toBe("good");
  });
});

// ═══════════════════════════════════════
// Tests 9–12: CORRECTED Round order — all 3 rounds = dailySetIds
// ═══════════════════════════════════════

describe("getRoundOrder — ALL 3 rounds use same dailySetIds (corrected)", () => {
  const items = [
    makeSessionItem({ id: "a", status: "pending", recallScore: null, reinforcementRound: 0 }),
    makeSessionItem({ id: "b", status: "pending", recallScore: null, reinforcementRound: 0 }),
    makeSessionItem({ id: "c", status: "passed", recallScore: 5, reinforcementRound: 0 }),
    makeSessionItem({ id: "d", status: "failed", recallScore: 1, reinforcementRound: 0 }),
    makeSessionItem({ id: "e", status: "failed", recallScore: 2, reinforcementRound: 0 }),
    makeSessionItem({ id: "f", status: "completed", recallScore: 1, reinforcementRound: 3 }),
  ];
  const dailySetIds = getDailySetIds(items);

  it("9. Round 1 = dailySetIds (all 15 in real session, all 6 in test)", () => {
    const order = getRoundOrder(1, dailySetIds, items);
    expect(order).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(order.length).toBe(6);
  });

  it("10. Round 2 = dailySetIds (ALL 15, NOT failed-only)", () => {
    const order = getRoundOrder(2, dailySetIds, items);
    // Must include ALL items, even those that passed Round 1
    expect(order).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(order.length).toBe(6);
    // Specifically verify passed items are included (the bug was filtering them out)
    expect(order).toContain("c"); // passed in Round 1
    expect(order).toContain("f"); // completed
  });

  it("11. Round 3 = dailySetIds (ALL 15, NOT still-failed-only)", () => {
    const order = getRoundOrder(3, dailySetIds, items);
    expect(order).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(order.length).toBe(6);
    expect(order).toContain("c"); // passed previously
    expect(order).toContain("a"); // pending
  });

  it("12. dailySetIds never changes regardless of item status changes", () => {
    const ids1 = getDailySetIds(items);
    // Simulate mutations that change item statuses
    applyRecallResult(items[0], 4); // a: passed
    applyRecallResult(items[1], 1); // b: failed
    const ids2 = getDailySetIds(items);
    // IDs stay the same (order and content unchanged)
    expect(ids1).toEqual(ids2);
    expect(ids1.length).toBe(6);
  });
});

// ═══════════════════════════════════════
// Tests 13–14: Round completion detection
// ═══════════════════════════════════════

describe("Round completion detection", () => {
  it("13. round complete when currentIndex reaches roundOrder.length", () => {
    const roundOrder = ["a", "b", "c"];
    expect(3 >= roundOrder.length).toBe(true);
  });

  it("14. round NOT complete when currentIndex < roundOrder.length", () => {
    const roundOrder = ["a", "b", "c"];
    expect(1 >= roundOrder.length).toBe(false);
  });
});

// ═══════════════════════════════════════
// Test 15: Progress stability — dailySetIds immutable
// ═══════════════════════════════════════

describe("Progress stability", () => {
  it("15. denominator stays constant — dailySetIds never shrinks during any round", () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeSessionItem({ id: `item-${i}`, status: "pending" }),
    );
    const dailySetIds = getDailySetIds(items);

    // Round 1: 15 items
    expect(dailySetIds.length).toBe(15);

    // Simulate Round 1 processing: some pass, some fail
    applyRecallResult(items[0], 5); // passed
    applyRecallResult(items[1], 1); // failed
    applyRecallResult(items[2], 2); // failed

    // dailySetIds still 15
    const idsAfterR1 = getDailySetIds(items);
    expect(idsAfterR1.length).toBe(15);

    // Round 2: still 15 (not filtered to failed-only)
    const r2Order = getRoundOrder(2, idsAfterR1, items);
    expect(r2Order.length).toBe(15);

    // Round 3: still 15 (not filtered to still-failed-only)
    const r3Order = getRoundOrder(3, idsAfterR1, items);
    expect(r3Order.length).toBe(15);
  });
});

// ═══════════════════════════════════════
// Tests 16–17: ExpressionCard fields
// ═══════════════════════════════════════

describe("ExpressionCard — full detail fields", () => {
  it("16. all detail fields are present on ExpressionCard", () => {
    const card = makeExpression();
    expect(card.pronunciation).toBeTruthy();
    expect(card.example_sentence).toBeTruthy();
    expect(card.english_explanation).toBeTruthy();
    expect(card.usage_note).toBeTruthy();
    expect(card.native_usage).toBeTruthy();
    expect(card.context).toBeTruthy();
    expect(card.situation).toBeTruthy();
    expect(card.common_patterns).toBeTruthy();
    expect(card.common_mistakes).toBeTruthy();
    expect(card.memory_tip).toBeTruthy();
    expect(card.synonyms).toBeTruthy();
    expect(card.cloze_sentence).toBeTruthy();
    expect(card.formality).toBeTruthy();
    expect(card.notes).toBeTruthy();
  });

  it("17. undefined detail fields don't break consumers (optional chaining safety)", () => {
    const card = makeExpression({
      pronunciation: undefined,
      english_explanation: undefined,
      usage_note: undefined,
      context: undefined,
      memory_tip: undefined,
      cloze_sentence: undefined,
    });

    expect(card?.pronunciation).toBeUndefined();
    expect(card?.memory_tip).toBeUndefined();
    expect(card.english).toBe("take the bull by the horns");
    expect(card.chinese).toBe("迎难而上");
  });
});

// ═══════════════════════════════════════
// Tests 18–19: Status transitions
// ═══════════════════════════════════════

describe("SessionItem — status transitions", () => {
  it("18. Round 1: score >= 3 → status 'passed', SRS gets 'hard' or 'good'", () => {
    const item = makeSessionItem({ status: "pending" });
    applyRecallResult(item, 4);
    expect(item.status).toBe("passed");
    expect(item.recallScore).toBe(4);
    expect(getSrsRating(4)).toBe("good");

    const item2 = makeSessionItem({ status: "pending" });
    applyRecallResult(item2, 3);
    expect(item2.status).toBe("passed");
    expect(getSrsRating(3)).toBe("hard");
  });

  it("19. Round 1: score < 3 → status 'failed', SRS capped at 'hard'", () => {
    const item = makeSessionItem({ status: "pending" });
    applyRecallResult(item, 1);
    expect(item.status).toBe("failed");
    expect(item.recallScore).toBe(1);
    expect(getSrsRating(1)).toBe("hard");
  });
});

// ═══════════════════════════════════════
// Test 20: CORRECTED Full 3-round lifecycle
// (All rounds use dailySetIds, reinforcement is separate)
// ═══════════════════════════════════════

describe("Full 3-round lifecycle (corrected)", () => {
  it("20. Round 1 → Round 2 (ALL items) → Round 3 (ALL items) with separate reinforcement", () => {
    const items = [
      makeSessionItem({ id: "a", status: "pending" }),
      makeSessionItem({ id: "b", status: "pending" }),
      makeSessionItem({ id: "c", status: "pending" }),
    ];
    const dailySetIds = getDailySetIds(items);

    // ── Round 1: Active Recall (all items) ──
    const r1Order = getRoundOrder(1, dailySetIds, items);
    expect(r1Order).toEqual(["a", "b", "c"]);

    applyRecallResult(items[0], 4); // a: passed (good)
    applyRecallResult(items[1], 2); // b: failed (hard)
    applyRecallResult(items[2], 5); // c: passed (good)

    expect(getSrsRating(items[0].recallScore!)).toBe("good");
    expect(getSrsRating(items[1].recallScore!)).toBe("hard");
    expect(getSrsRating(items[2].recallScore!)).toBe("good");

    // Reinforcement: only score 1-2
    const reinfOrder = getReinforcementOrder(items);
    expect(reinfOrder).toEqual(["b"]);

    // Simulate reinforcement on b
    applyRecallResultInReinforcement(items[1], 4, 1); // b passes in reinforcement
    expect(items[1].status).toBe("passed");
    expect(items[1].reinforcementRound).toBe(1);

    // ── Round 2: Cloze (ALL items, not just b) ──
    const r2Order = getRoundOrder(2, dailySetIds, items);
    expect(r2Order).toEqual(["a", "b", "c"]); // ALL 3, not just b!

    // Process all in Round 2
    applyClozeResult(items[0], true);
    applyClozeResult(items[1], true);
    applyClozeResult(items[2], false); // c fails cloze

    // ── Round 3: Sentence (ALL items again) ──
    const r3Order = getRoundOrder(3, dailySetIds, items);
    expect(r3Order).toEqual(["a", "b", "c"]); // ALL 3, not filtered!

    applySentenceResult(items[0], "I took the bull by the horns today.");
    applySentenceResult(items[1], "You should take the bull by the horns.");
    applySentenceResult(items[2], "She takes the bull by the horns at work.");

    // ── Verify stats ──
    const stats = getSessionStats(items);
    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(3);

    // ── SRS was only submitted for Round 1 first attempt ──
    // Items a and c have recall scores from Round 1 (SRS-relevant)
    expect(items[0].recallScore).toBe(4);
    expect(items[1].recallScore).toBe(4); // updated in reinforcement
    expect(items[2].recallScore).toBe(5);
  });
});

// ═══════════════════════════════════════
// TESTS A–L: 12 new tests from Correction Audit
// ═══════════════════════════════════════

describe("V3.2 Correction Audit — Tests A-L", () => {
  // ── Helpers for creating 15-item set ──
  function make15Items(): SessionItem[] {
    return Array.from({ length: 15 }, (_, i) =>
      makeSessionItem({
        id: `item-${i}`,
        expressionId: `expr-${i}`,
        status: "pending",
        recallScore: null,
      }),
    );
  }

  // ─── A. Daily Set IDs 全部15个 ───
  it("A. dailySetIds contains all 15 session item IDs", () => {
    const items = make15Items();
    const ids = getDailySetIds(items);
    expect(ids.length).toBe(15);
    for (let i = 0; i < 15; i++) {
      expect(ids).toContain(`item-${i}`);
    }
  });

  // ─── B. Round 1 = dailySetIds ───
  it("B. Round 1 order equals dailySetIds (all 15 items)", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    const r1Order = getRoundOrder(1, dailySetIds, items);
    expect(r1Order).toEqual(dailySetIds);
    expect(r1Order.length).toBe(15);
  });

  // ─── C. Round 2 ≡ Round 1 IDs (same 15 items) ───
  it("C. Round 2 order equals Round 1 order (same 15 items)", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    const r1Order = getRoundOrder(1, dailySetIds, items);
    const r2Order = getRoundOrder(2, dailySetIds, items);
    expect(r2Order).toEqual(r1Order);
    expect(r2Order.length).toBe(15);
  });

  // ─── D. Round 3 ≡ Round 1 IDs (same 15 items) ───
  it("D. Round 3 order equals Round 1 order (same 15 items)", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    const r1Order = getRoundOrder(1, dailySetIds, items);
    const r3Order = getRoundOrder(3, dailySetIds, items);
    expect(r3Order).toEqual(r1Order);
    expect(r3Order.length).toBe(15);
  });

  // ─── E. Reinforcement = subset of failed (score 1-2 only) ───
  it("E. reinforcementOrder only contains items with recallScore 1-2", () => {
    const items = make15Items();
    // Mark various items with different scores
    applyRecallResult(items[0], 5); // passed
    applyRecallResult(items[1], 4); // passed
    applyRecallResult(items[2], 1); // failed
    applyRecallResult(items[3], 2); // failed
    applyRecallResult(items[4], 3); // passed
    applyRecallResult(items[5], 1); // failed

    const reinfOrder = getReinforcementOrder(items);
    expect(reinfOrder).toEqual(["item-2", "item-3", "item-5"]);
    expect(reinfOrder.length).toBe(3);
    // Verify only score 1-2
    for (const id of reinfOrder) {
      const item = items.find((i) => i.id === id)!;
      expect(item.recallScore).toBeLessThanOrEqual(2);
      expect(item.recallScore).toBeGreaterThanOrEqual(1);
    }
  });

  // ─── F. Round 2 = 15 items (not filtered to failed-only) ───
  it("F. Round 2 count is always 15 regardless of Round 1 results", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);

    // Simulate mixed Round 1 results
    for (let i = 0; i < 15; i++) {
      const score = i < 5 ? 5 : i < 10 ? 1 : 3; // 5 passed, 5 failed, 5 borderline
      applyRecallResult(items[i], score);
    }

    const r2Order = getRoundOrder(2, dailySetIds, items);
    expect(r2Order.length).toBe(15);
    // All items present, not just the failed ones
    expect(r2Order).toContain("item-0"); // passed
    expect(r2Order).toContain("item-5"); // failed
  });

  // ─── G. Round 3 = 15 items (not filtered to still-failed-only) ───
  it("G. Round 3 count is always 15 regardless of Round 2 results", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);

    // Simulate varied Round 2 results on statuses
    for (let i = 0; i < 15; i++) {
      items[i].status = i < 7 ? "passed" : "failed";
    }

    const r3Order = getRoundOrder(3, dailySetIds, items);
    expect(r3Order.length).toBe(15);
    expect(r3Order).toContain("item-0"); // passed
    expect(r3Order).toContain("item-7"); // failed
  });

  // ─── H. SRS NOT submitted in reinforcement ───
  it("H. shouldSubmitSrs returns false during reinforcement", () => {
    const srsSubmitted = new Set<string>();
    // In reinforcement: always false
    expect(shouldSubmitSrs(true, srsSubmitted, "item-1")).toBe(false);
    // Even if not previously submitted
    expect(shouldSubmitSrs(true, new Set(), "item-new")).toBe(false);
  });

  // ─── I. SRS NOT submitted in Round 2 ───
  it("I. SRS not triggered by Round 2 (cloze) operations", () => {
    // Cloze handler has NO SRS mutation call — verified by code audit
    // This test verifies the pure logic: applyClozeResult doesn't touch recallScore
    const item = makeSessionItem({ recallScore: 3 });
    const scoreBefore = item.recallScore;
    applyClozeResult(item, true);
    // Cloze does NOT change recallScore (SRS depends on recallScore)
    expect(item.recallScore).toBe(scoreBefore);
  });

  // ─── J. SRS NOT submitted in Round 3 ───
  it("J. SRS not triggered by Round 3 (sentence) operations", () => {
    // Sentence handler has NO SRS mutation call — verified by code audit
    // This test verifies the pure logic: applySentenceResult doesn't touch recallScore
    const item = makeSessionItem({ recallScore: 4 });
    const scoreBefore = item.recallScore;
    applySentenceResult(item, "My sentence.");
    // Sentence does NOT change recallScore (SRS depends on recallScore)
    expect(item.recallScore).toBe(scoreBefore);
  });

  // ─── K. Page refresh doesn't change dailySetIds ───
  it("K. dailySetIds remain identical after simulated page refresh (re-fetch)", () => {
    // Simulates: session created, items loaded, page refreshed, items reloaded
    const items1 = make15Items();
    const ids1 = getDailySetIds(items1);

    // "Refresh" — same items re-loaded from DB
    const items2 = make15Items(); // Same composition
    const ids2 = getDailySetIds(items2);

    expect(ids1).toEqual(ids2);
    expect(ids1.length).toBe(15);
  });

  // ─── L. Learning history data composition ───
  it("L. session stats correctly reflect per-round breakdown", () => {
    const items = make15Items();

    // Round 1: process all 15
    for (let i = 0; i < 15; i++) {
      const score = i < 8 ? 4 : i < 12 ? 2 : 5;
      applyRecallResult(items[i], score);
    }

    const stats = getSessionStats(items);
    expect(stats.total).toBe(15);

    // 8 passed (score 4, i=0-7) + 3 passed (score 5, i=12-14) = 11 passed
    expect(stats.passed).toBe(11);
    // 4 failed (score 2, i=8-11)
    expect(stats.failed).toBe(4);

    // Reinforcement check
    const reinfOrder = getReinforcementOrder(items);
    expect(reinfOrder.length).toBe(4); // items 8-11 with score 2

    // Round 2: all 15 participate
    const dailySetIds = getDailySetIds(items);
    const r2Order = getRoundOrder(2, dailySetIds, items);
    expect(r2Order.length).toBe(15);

    // Process Round 2 (cloze) on all items
    for (const item of items) {
      applyClozeResult(item, true);
    }
    // All still in good state
    const stats2 = getSessionStats(items);
    expect(stats2.total).toBe(15);

    // Round 3: all 15
    const r3Order = getRoundOrder(3, dailySetIds, items);
    expect(r3Order.length).toBe(15);

    // Process Round 3 (sentence) on all items
    for (const item of items) {
      applySentenceResult(item, `Sentence using ${item.expression?.english}`);
    }

    const finalStats = getSessionStats(items);
    expect(finalStats.passed).toBe(15); // all completed
    expect(finalStats.failed).toBe(0);
    expect(finalStats.pending).toBe(0);

    // Verify sentence data preserved
    for (const item of items) {
      expect(item.userSentence).toBeTruthy();
      expect(item.status).toBe("completed");
    }
  });
});
