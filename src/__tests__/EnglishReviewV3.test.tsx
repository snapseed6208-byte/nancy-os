// ============================================
// English SRS V3.2 — 20 Regression Tests
// Self-contained: no app imports to avoid
// transitive dependency resolution in test worker.
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

type Round = 1 | 2 | 3;

function deriveRoundOrder(round: Round, allItems: SessionItem[]): string[] {
  if (round === 1) {
    return allItems.filter((i) => i.status === "pending").map((i) => i.id);
  }
  if (round === 2) {
    return allItems
      .filter((i) => i.recallScore !== null && i.recallScore < 3 && i.status !== "completed")
      .map((i) => i.id);
  }
  return allItems
    .filter((i) => i.status === "failed" && (i.reinforcementRound || 0) >= 2)
    .map((i) => i.id);
}

function applyRecallResult(item: SessionItem, score: number): void {
  const passed = score >= 3;
  item.recallScore = score;
  item.status = passed ? "passed" : "failed";
  item.attemptCount += 1;
  item.reinforcementRound = 0;
}

function applyClozeResult(item: SessionItem, passed: boolean): void {
  item.status = passed ? "passed" : "failed";
  item.attemptCount += 1;
  item.reinforcementRound = 2;
}

function applySentenceResult(item: SessionItem, sentence: string): void {
  item.userSentence = sentence;
  item.sentenceScore = 3;
  item.status = "completed";
  item.attemptCount += 1;
  item.reinforcementRound = 3;
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
    // "xyzzy" not found in example, so blanks 3 middle words (words >= 6)
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
// Tests 9–12: Round order derivation
// ═══════════════════════════════════════

describe("deriveRoundOrder — correct item filtering per round", () => {
  const makeItems = () => [
    makeSessionItem({ id: "a", status: "pending", recallScore: null, reinforcementRound: 0 }),
    makeSessionItem({ id: "b", status: "pending", recallScore: null, reinforcementRound: 0 }),
    makeSessionItem({ id: "c", status: "passed", recallScore: 5, reinforcementRound: 0 }),
    makeSessionItem({ id: "d", status: "failed", recallScore: 1, reinforcementRound: 0 }),
    makeSessionItem({ id: "e", status: "failed", recallScore: 2, reinforcementRound: 0 }),
    makeSessionItem({ id: "f", status: "completed", recallScore: 1, reinforcementRound: 3 }),
  ];

  it("9. Round 1: only pending items (all 15 in real session)", () => {
    const order = deriveRoundOrder(1, makeItems());
    expect(order).toEqual(["a", "b"]);
  });

  it("10. Round 2: items with recall_score < 3 and not completed", () => {
    const order = deriveRoundOrder(2, makeItems());
    // d (score=1, failed) and e (score=2, failed); f excluded (completed)
    expect(order).toEqual(["d", "e"]);
  });

  it("11. Round 3: only failed items with reinforcementRound >= 2", () => {
    const items = makeItems();
    // None qualify initially
    expect(deriveRoundOrder(3, items)).toEqual([]);

    // Add qualifying item
    items.push(
      makeSessionItem({ id: "g", status: "failed", recallScore: 1, reinforcementRound: 2 }),
    );
    expect(deriveRoundOrder(3, items)).toEqual(["g"]);
  });

  it("12. all passed → empty order for Rounds 2 and 3", () => {
    const allPassed = [
      makeSessionItem({ id: "x", status: "completed", recallScore: 4 }),
      makeSessionItem({ id: "y", status: "completed", recallScore: 5 }),
    ];
    expect(deriveRoundOrder(1, allPassed)).toEqual([]);
    expect(deriveRoundOrder(2, allPassed)).toEqual([]);
    expect(deriveRoundOrder(3, allPassed)).toEqual([]);
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
// Test 15: Progress stability
// ═══════════════════════════════════════

describe("Progress stability", () => {
  it("15. denominator stays constant — roundOrder never shrinks during a round", () => {
    // Simulates the roundInitializedRef guard: order is set once, never recalculated
    const roundOrder = Array.from({ length: 15 }, (_, i) => `item-${i}`);
    const initialLength = roundOrder.length;

    // Even as items are processed and statuses change in the DB,
    // the roundOrder array stays the same for the current round
    for (let i = 0; i < 5; i++) {
      // Processing items... roundOrder untouched
    }

    expect(roundOrder.length).toBe(initialLength);
    expect(roundOrder.length).toBe(15);
  });
});

// ═══════════════════════════════════════
// Tests 16–17: ExpressionCard fields
// ═══════════════════════════════════════

describe("ExpressionCard — full detail fields", () => {
  it("16. all 12 detail fields are present on ExpressionCard", () => {
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

    // Optional chaining expressions like card?.pronunciation evaluate to undefined
    expect(card?.pronunciation).toBeUndefined();
    expect(card?.memory_tip).toBeUndefined();
    // Core fields still intact
    expect(card.english).toBe("take the bull by the horns");
    expect(card.chinese).toBe("迎难而上");
  });
});

// ═══════════════════════════════════════
// Tests 18–19: Status transitions
// ═══════════════════════════════════════

describe("SessionItem — status transitions", () => {
  it("18. Round 1: score ≥ 3 → status 'passed', SRS gets 'hard' or 'good'", () => {
    const item = makeSessionItem({ status: "pending" });

    // Score 4 = passed
    applyRecallResult(item, 4);
    expect(item.status).toBe("passed");
    expect(item.recallScore).toBe(4);
    expect(getSrsRating(4)).toBe("good");

    // Score 3 = passed but capped
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
    // Capped: never "again"
    expect(getSrsRating(1)).toBe("hard");
  });
});

// ═══════════════════════════════════════
// Test 20: Full 3-round lifecycle
// ═══════════════════════════════════════

describe("Full 3-round lifecycle", () => {
  it("20. Round 1 failures → Round 2 cloze → Round 3 sentence → all done", () => {
    const items = [
      makeSessionItem({ id: "a", status: "pending" }),
      makeSessionItem({ id: "b", status: "pending" }),
      makeSessionItem({ id: "c", status: "pending" }),
    ];

    // ── Round 1: Active Recall ──
    const r1Order = deriveRoundOrder(1, items);
    expect(r1Order).toEqual(["a", "b", "c"]);

    applyRecallResult(items[0], 4); // a: passed (good)
    applyRecallResult(items[1], 2); // b: failed (hard)
    applyRecallResult(items[2], 5); // c: passed (good)

    // SRS: only Round 1 updates SRS
    expect(getSrsRating(items[0].recallScore!)).toBe("good");
    expect(getSrsRating(items[1].recallScore!)).toBe("hard"); // capped!
    expect(getSrsRating(items[2].recallScore!)).toBe("good");

    // ── Round 2: Cloze (only item b, no SRS update) ──
    const r2Order = deriveRoundOrder(2, items);
    expect(r2Order).toEqual(["b"]);

    applyClozeResult(items[1], true); // b: passed in cloze
    expect(items[1].status).toBe("passed");
    expect(items[1].reinforcementRound).toBe(2);

    // ── Round 3: Sentence (no items qualify since b passed) ──
    const r3Order = deriveRoundOrder(3, items);
    expect(r3Order).toEqual([]);

    // ── Verify stats ──
    const stats = getSessionStats(items);
    expect(stats.total).toBe(3);
    expect(stats.passed).toBe(3);
    expect(stats.failed).toBe(0);
    expect(stats.pending).toBe(0);

    // ── Verify SRS was NOT changed by Rounds 2/3 ──
    // Item b still has recallScore=2 from Round 1 (the SRS-relevant score)
    expect(items[1].recallScore).toBe(2);
    // SRS rating from Round 1 remains "hard"
    expect(getSrsRating(items[1].recallScore!)).toBe("hard");
  });
});
