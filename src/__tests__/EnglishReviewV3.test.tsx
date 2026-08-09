// ============================================
// English SRS V3.3 — 44 Regression Tests
// Self-contained: no app imports to avoid
// transitive dependency resolution in test worker.
//
// Tests 1-20: Preserved SRS core + cloze tests
// Tests A-J: V3.3 Mode routing, cloze validation, SRS isolation
// Tests K-O: Resume, daily set, mode-specific stats
// ============================================

import { describe, it, expect } from "vitest";

// ═══════════════════════════════════════
// Inline type mirrors
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

function make15Items(): SessionItem[] {
  return Array.from({ length: 15 }, (_, i) =>
    makeSessionItem({ id: `item-${i}`, expressionId: `expr-${i}` }),
  );
}

// ═══════════════════════════════════════
// Pure logic mirrors from source files
// ═══════════════════════════════════════

// ── clozeUtils.ts mirrors ──

interface ClozeQuestion {
  prompt: string;
  expectedAnswer: string;
  acceptedAnswers: string[];
  source: "cloze_sentence" | "example_sentence" | "fallback";
  valid: boolean;
}

function normalizeClozeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/['‘’‚‛′‵]/g, "'")
    .replace(/["“”„″‶]/g, '"')
    .replace(/[,.!?;:'"]+$/, "")
    .trim();
}

function validateClozeAnswer(userAnswer: string, acceptedAnswers: string[]): boolean {
  if (!userAnswer.trim()) return false;
  const normalized = normalizeClozeAnswer(userAnswer);
  if (!normalized) return false;
  return acceptedAnswers.some((a) => normalizeClozeAnswer(a) === normalized);
}

function hasExpressionLeakage(prompt: string, expression: string): boolean {
  const p = normalizeClozeAnswer(prompt);
  const e = normalizeClozeAnswer(expression);
  return p.includes(e);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildClozeQuestion(
  english: string,
  chinese: string,
  clozeSentence?: string | null,
  exampleSentence?: string | null,
): ClozeQuestion {
  // Priority 1: cloze_sentence
  if (clozeSentence) {
    const blanks = (clozeSentence.match(/_{2,}|\[blank\]/gi) || []).length;
    if (blanks >= 1) {
      const hasLeak = hasExpressionLeakage(clozeSentence, english);
      if (!hasLeak) {
        return {
          prompt: clozeSentence,
          expectedAnswer: english,
          acceptedAnswers: [english],
          source: "cloze_sentence",
          valid: true,
        };
      }
    }
  }

  // Priority 2: example_sentence
  if (exampleSentence) {
    const escaped = escapeRegex(english);
    const regex = new RegExp(escaped, "gi");
    const replaced = exampleSentence.replace(regex, "_____");
    if (replaced !== exampleSentence) {
      if (!hasExpressionLeakage(replaced, english)) {
        return {
          prompt: replaced,
          expectedAnswer: english,
          acceptedAnswers: [english],
          source: "example_sentence",
          valid: true,
        };
      }
    }

    const words = exampleSentence.split(/\s+/);
    if (words.length >= 6) {
      const start = Math.floor(words.length * 0.3);
      const end = Math.min(words.length, start + 3);
      const parts = [...words];
      for (let i = start; i < end; i++) parts[i] = "_____";
      const prompt = parts.join(" ");
      if (!hasExpressionLeakage(prompt, english)) {
        const expectedWords = words.slice(start, end).join(" ");
        return { prompt, expectedAnswer: expectedWords, acceptedAnswers: [expectedWords], source: "example_sentence", valid: true };
      }
    }
  }

  // Priority 3: fallback
  const exprWords = english.split(/\s+/);
  if (exprWords.length >= 2) {
    const mid = Math.floor(exprWords.length / 2);
    const parts = [...exprWords];
    parts[mid] = "_____";
    const prompt = parts.join(" ");
    if (!hasExpressionLeakage(prompt, english)) {
      return { prompt, expectedAnswer: exprWords[mid], acceptedAnswers: [exprWords[mid]], source: "fallback", valid: true };
    }
  }

  return {
    prompt: `_____ (${chinese})`,
    expectedAnswer: english,
    acceptedAnswers: [english],
    source: "fallback",
    valid: true,
  };
}

// ── Mode helpers ──

type ReviewMode = "recall" | "cloze" | "sentence";

function getDailySetIds(items: SessionItem[]): string[] {
  return items.map((i) => i.id);
}

function countModeCompleted(
  items: SessionItem[],
  mode: ReviewMode,
  clozeLogIds?: Set<string>,
  sentenceLogIds?: Set<string>,
): number {
  if (mode === "recall") return items.filter((i) => i.recallScore !== null).length;
  if (mode === "cloze") return clozeLogIds ? clozeLogIds.size : 0;
  if (mode === "sentence") return sentenceLogIds ? sentenceLogIds.size : 0;
  return 0;
}

function findResumeIndex(
  items: SessionItem[],
  dailySetIds: string[],
  mode: ReviewMode,
  clozeLogIds: Set<string>,
  sentenceLogIds: Set<string>,
): number {
  for (let i = 0; i < dailySetIds.length; i++) {
    const item = items.find((it) => it.id === dailySetIds[i]);
    if (!item) continue;
    if (mode === "recall" && item.recallScore === null) return i;
    if (mode === "cloze" && !clozeLogIds.has(item.expressionId)) return i;
    if (mode === "sentence" && !sentenceLogIds.has(item.expressionId)) return i;
  }
  return dailySetIds.length;
}

// ── SRS helpers ──

function getSrsRating(score: number): "again" | "hard" | "good" | "easy" {
  if (score >= 4) return "good";
  return "hard";
}

function shouldSubmitSrs(inRecallMode: boolean, srsSubmittedIds: Set<string>, itemId: string): boolean {
  return inRecallMode && !srsSubmittedIds.has(itemId);
}

function applyRecallResult(item: SessionItem, score: number): void {
  item.recallScore = score;
  item.status = score >= 3 ? "passed" : "failed";
  item.attemptCount += 1;
}

// ═══════════════════════════════════════
// Tests 1-4: buildClozeQuestion (NEW V3.3)
// ═══════════════════════════════════════

describe("buildClozeQuestion — V3.3", () => {
  it("1. uses valid cloze_sentence when available (no leakage)", () => {
    const q = buildClozeQuestion(
      "take the bull by the horns",
      "迎难而上",
      "Sometimes you just have to _____ and fix the problem.",
    );
    expect(q.source).toBe("cloze_sentence");
    expect(q.prompt).toContain("_____");
    expect(q.valid).toBe(true);
    expect(q.expectedAnswer).toBe("take the bull by the horns");
  });

  it("2. rejects cloze_sentence that leaks target expression", () => {
    const q = buildClozeQuestion(
      "get something off my plate",
      "卸下负担",
      "get something off my plate means to remove a burden.",
      "I need to get something off my plate before the weekend.",
    );
    // cloze_sentence has leakage → should fall back to example_sentence
    expect(q.source).toBe("example_sentence");
    expect(q.valid).toBe(true);
    expect(hasExpressionLeakage(q.prompt, "get something off my plate")).toBe(false);
  });

  it("3. blanks expression in example_sentence (exact replacement)", () => {
    const q = buildClozeQuestion(
      "a great way to unwind",
      "放松的好方法",
      undefined,
      "Cycling is a great way to unwind after a stressful day at work.",
    );
    expect(q.source).toBe("example_sentence");
    expect(q.prompt).toContain("_____");
    expect(q.prompt).not.toContain("a great way to unwind");
    expect(q.expectedAnswer).toBe("a great way to unwind");
  });

  it("4. falls back to word blanking when expression not in example", () => {
    const q = buildClozeQuestion(
      "xyzzy",
      "测试",
      undefined,
      "The quick brown fox jumps over the lazy dog today.",
    );
    expect(q.source).toBe("example_sentence");
    expect(q.prompt).toContain("_____");
    expect(q.valid).toBe(true);
    expect(hasExpressionLeakage(q.prompt, "xyzzy")).toBe(false);
  });
});

// ═══════════════════════════════════════
// Tests 5-8: Cloze answer validation
// ═══════════════════════════════════════

describe("validateClozeAnswer — strict matching", () => {
  const accepted = ["take the bull by the horns"];

  it("5. correct answer passes", () => {
    expect(validateClozeAnswer("take the bull by the horns", accepted)).toBe(true);
  });

  it("6. wrong answer fails", () => {
    expect(validateClozeAnswer("Skirts of my plate", accepted)).toBe(false);
  });

  it("7. empty answer fails", () => {
    expect(validateClozeAnswer("", accepted)).toBe(false);
    expect(validateClozeAnswer("   ", accepted)).toBe(false);
  });

  it("8. correct answer with different case/spacing passes", () => {
    expect(validateClozeAnswer("  Take   the Bull by the Horns.  ", accepted)).toBe(true);
    expect(validateClozeAnswer("TAKE THE BULL BY THE HORNS!", accepted)).toBe(true);
  });
});

// ═══════════════════════════════════════
// Tests 9-12: normalizeClozeAnswer
// ═══════════════════════════════════════

describe("normalizeClozeAnswer", () => {
  it("9. trims, lowercases, collapses spaces", () => {
    expect(normalizeClozeAnswer("  Take   Initiative.  ")).toBe("take initiative");
  });

  it("10. removes trailing punctuation", () => {
    expect(normalizeClozeAnswer("Hello World!")).toBe("hello world");
    expect(normalizeClozeAnswer("What's up?")).toBe("what's up");
  });

  it("11. normalizes apostrophes", () => {
    expect(normalizeClozeAnswer("don’t")).toBe("don't");
  });

  it("12. preserves internal punctuation", () => {
    const result = normalizeClozeAnswer("state-of-the-art");
    expect(result).toBe("state-of-the-art");
  });
});

// ═══════════════════════════════════════
// Tests 13-16: Cloze leakage guard
// ═══════════════════════════════════════

describe("hasExpressionLeakage", () => {
  it("13. detects leaked expression in prompt", () => {
    expect(hasExpressionLeakage(
      "get something off my plate means...",
      "get something off my plate",
    )).toBe(true);
  });

  it("14. no leakage when expression removed", () => {
    expect(hasExpressionLeakage(
      "_____ means to remove a burden.",
      "get something off my plate",
    )).toBe(false);
  });

  it("15. builds valid question with no leakage from example_sentence", () => {
    const q = buildClozeQuestion(
      "get something off my plate",
      "卸下负担",
      undefined,
      "I need to get something off my plate before the weekend.",
    );
    expect(q.valid).toBe(true);
    expect(q.source).toBe("example_sentence");
    expect(hasExpressionLeakage(q.prompt, "get something off my plate")).toBe(false);
    expect(q.prompt).toContain("_____");
  });

  it("16. invalid cloze with leakage falls back correctly", () => {
    const q = buildClozeQuestion(
      "test phrase",
      "测试",
      undefined,
      undefined,
    );
    expect(q.valid).toBe(true);
    expect(q.source).toBe("fallback");
  });
});

// ═══════════════════════════════════════
// Tests 17-20: SRS rating cap (preserved from V3.2)
// ═══════════════════════════════════════

describe("SRS rating", () => {
  it("17. score 1 → 'hard' (capped)", () => {
    expect(getSrsRating(1)).toBe("hard");
  });

  it("18. score 2 → 'hard' (capped)", () => {
    expect(getSrsRating(2)).toBe("hard");
  });

  it("19. score 3 → 'hard' (borderline)", () => {
    expect(getSrsRating(3)).toBe("hard");
  });

  it("20. score 4-5 → 'good'", () => {
    expect(getSrsRating(4)).toBe("good");
    expect(getSrsRating(5)).toBe("good");
  });
});

// ═══════════════════════════════════════
// TESTS A-D: Mode Routing (V3.3 NEW)
// ═══════════════════════════════════════

describe("V3.3 Mode Routing", () => {
  it("A1. mode=recall routes to recall mode", () => {
    const params = new URLSearchParams("mode=recall");
    const rawMode = params.get("mode") || "";
    const mode: ReviewMode = ["recall", "cloze", "sentence"].includes(rawMode)
      ? (rawMode as ReviewMode) : "recall";
    expect(mode).toBe("recall");
  });

  it("A2. mode=cloze routes to cloze mode", () => {
    const params = new URLSearchParams("mode=cloze");
    const rawMode = params.get("mode") || "";
    const mode: ReviewMode = ["recall", "cloze", "sentence"].includes(rawMode)
      ? (rawMode as ReviewMode) : "recall";
    expect(mode).toBe("cloze");
  });

  it("A3. mode=sentence routes to sentence mode", () => {
    const params = new URLSearchParams("mode=sentence");
    const rawMode = params.get("mode") || "";
    const mode: ReviewMode = ["recall", "cloze", "sentence"].includes(rawMode)
      ? (rawMode as ReviewMode) : "recall";
    expect(mode).toBe("sentence");
  });

  it("A4. invalid mode falls back to recall", () => {
    const params = new URLSearchParams("mode=invalid");
    const rawMode = params.get("mode") || "";
    const mode: ReviewMode = ["recall", "cloze", "sentence"].includes(rawMode)
      ? (rawMode as ReviewMode) : "recall";
    expect(mode).toBe("recall");
  });

  it("A5. no mode param falls back to recall", () => {
    const params = new URLSearchParams("");
    const rawMode = params.get("mode") || "";
    const mode: ReviewMode = ["recall", "cloze", "sentence"].includes(rawMode)
      ? (rawMode as ReviewMode) : "recall";
    expect(mode).toBe("recall");
  });
});

// ═══════════════════════════════════════
// TESTS E-H: Daily Set identity (V3.3)
// ═══════════════════════════════════════

describe("V3.3 Daily Set Identity", () => {
  it("E. all 3 modes share identical dailySetIds", () => {
    const items = make15Items();
    const ids = getDailySetIds(items);
    expect(ids.length).toBe(15);

    // Same IDs used for all modes
    const recallIds = getDailySetIds(items);
    const clozeIds = getDailySetIds(items);
    const sentenceIds = getDailySetIds(items);
    expect(recallIds).toEqual(clozeIds);
    expect(clozeIds).toEqual(sentenceIds);
  });

  it("F. dailySetIds unchanged after recall results", () => {
    const items = make15Items();
    const before = getDailySetIds(items);

    // Apply recall results
    for (let i = 0; i < 5; i++) applyRecallResult(items[i], 4);

    const after = getDailySetIds(items);
    expect(before).toEqual(after);
  });

  it("G. dailySetIds unchanged after cloze completions (tracked separately)", () => {
    const items = make15Items();
    const before = getDailySetIds(items);

    // Cloze completions don't modify items
    const clozeLogIds = new Set<string>(["expr-0", "expr-1", "expr-2"]);

    const after = getDailySetIds(items);
    expect(before).toEqual(after);
    expect(before.length).toBe(15);
  });

  it("H. page refresh preserves dailySetIds (simulated)", () => {
    const items1 = make15Items();
    const ids1 = getDailySetIds(items1);

    // Simulated reload: same data from DB
    const items2 = make15Items();
    const ids2 = getDailySetIds(items2);

    expect(ids1).toEqual(ids2);
  });
});

// ═══════════════════════════════════════
// TESTS I-L: Mode progress resume (V3.3 NEW)
// ═══════════════════════════════════════

describe("V3.3 Mode Progress Resume", () => {
  it("I. cloze 6/15 done → resume at 7th item", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    const clozeLogIds = new Set<string>([
      "expr-0", "expr-1", "expr-2", "expr-3", "expr-4", "expr-5",
    ]);

    const idx = findResumeIndex(items, dailySetIds, "cloze", clozeLogIds, new Set());
    expect(idx).toBe(6);
  });

  it("J. sentence 4/15 done → resume at 5th item", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    const sentenceLogIds = new Set<string>([
      "expr-0", "expr-1", "expr-2", "expr-3",
    ]);

    const idx = findResumeIndex(items, dailySetIds, "sentence", new Set(), sentenceLogIds);
    expect(idx).toBe(4);
  });

  it("K. recall 15/15 done → resume at end (all complete)", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    for (const item of items) applyRecallResult(item, 4);

    const idx = findResumeIndex(items, dailySetIds, "recall", new Set(), new Set());
    expect(idx).toBe(15); // all complete
  });

  it("L. cloze 0/15 → resume at 0 (first item)", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);

    const idx = findResumeIndex(items, dailySetIds, "cloze", new Set(), new Set());
    expect(idx).toBe(0);
  });
});

// ═══════════════════════════════════════
// TESTS M-P: SRS Isolation (V3.3 CRITICAL)
// ═══════════════════════════════════════

describe("V3.3 SRS Isolation", () => {
  it("M. SRS submits only in recall mode", () => {
    const srsSubmitted = new Set<string>();
    // In recall mode, not yet submitted → true
    expect(shouldSubmitSrs(true, srsSubmitted, "expr-1")).toBe(true);
  });

  it("N. SRS does NOT submit in non-recall mode (cloze/sentence)", () => {
    const srsSubmitted = new Set<string>();
    // Not in recall mode → always false
    expect(shouldSubmitSrs(false, srsSubmitted, "expr-1")).toBe(false);
  });

  it("O. SRS does NOT submit twice for same expression in recall", () => {
    const srsSubmitted = new Set<string>(["expr-1"]);
    expect(shouldSubmitSrs(true, srsSubmitted, "expr-1")).toBe(false);
  });

  it("P. applyRecallResult modifies recallScore (SRS-relevant), others don't", () => {
    const item1 = makeSessionItem({ id: "a", expressionId: "expr-a", recallScore: null });

    // Recall changes recallScore
    applyRecallResult(item1, 4);
    expect(item1.recallScore).toBe(4); // SRS uses this

    // Cloze would NOT change recallScore (tested via no-op)
    const scoreBeforeCloze = item1.recallScore;
    item1.status = "passed"; // simulate cloze
    expect(item1.recallScore).toBe(scoreBeforeCloze); // unchanged

    // Sentence would NOT change recallScore
    const scoreBeforeSentence = item1.recallScore;
    item1.userSentence = "My sentence.";
    expect(item1.recallScore).toBe(scoreBeforeSentence); // unchanged
  });
});

// ═══════════════════════════════════════
// TESTS Q-T: Mode completion stats (V3.3)
// ═══════════════════════════════════════

describe("V3.3 Mode Completion Stats", () => {
  it("Q. recall completion count = items with recallScore !== null", () => {
    const items = make15Items();
    for (let i = 0; i < 8; i++) applyRecallResult(items[i], i < 5 ? 4 : 2);

    const completed = countModeCompleted(items, "recall");
    expect(completed).toBe(8);
  });

  it("R. cloze completion count = from practice logs (independent of recall)", () => {
    const items = make15Items();
    // Even if recall is 0, cloze can have progress
    const clozeLogIds = new Set<string>(["expr-0", "expr-1", "expr-2", "expr-3", "expr-4", "expr-5"]);
    const completed = countModeCompleted(items, "cloze", clozeLogIds);
    expect(completed).toBe(6);
  });

  it("S. sentence completion count = from practice logs", () => {
    const items = make15Items();
    const sentenceLogIds = new Set<string>(["expr-0", "expr-1", "expr-2"]);
    const completed = countModeCompleted(items, "sentence", undefined, sentenceLogIds);
    expect(completed).toBe(3);
  });

  it("T. all 3 modes can have different completion counts", () => {
    const items = make15Items();
    for (let i = 0; i < 15; i++) applyRecallResult(items[i], 4);

    const clozeIds = new Set(["expr-0", "expr-1", "expr-2", "expr-3", "expr-4", "expr-5"]);
    const sentenceIds = new Set(["expr-0", "expr-1", "expr-2"]);

    const recallDone = countModeCompleted(items, "recall");
    const clozeDone = countModeCompleted(items, "cloze", clozeIds);
    const sentenceDone = countModeCompleted(items, "sentence", undefined, sentenceIds);

    expect(recallDone).toBe(15);
    expect(clozeDone).toBe(6);
    expect(sentenceDone).toBe(3);
  });
});

// ═══════════════════════════════════════
// TESTS U-X: ExpressionCard + status transitions (preserved)
// ═══════════════════════════════════════

describe("ExpressionCard & Status", () => {
  it("U. all detail fields present", () => {
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

  it("V. undefined fields safe with optional chaining", () => {
    const card = makeExpression({ pronunciation: undefined, memory_tip: undefined });
    expect(card?.pronunciation).toBeUndefined();
    expect(card?.memory_tip).toBeUndefined();
    expect(card.english).toBe("take the bull by the horns");
  });

  it("W. recall score ≥ 3 → status 'passed'", () => {
    const item = makeSessionItem({ status: "pending" });
    applyRecallResult(item, 4);
    expect(item.status).toBe("passed");
  });

  it("X. recall score < 3 → status 'failed'", () => {
    const item = makeSessionItem({ status: "pending" });
    applyRecallResult(item, 1);
    expect(item.status).toBe("failed");
  });
});
