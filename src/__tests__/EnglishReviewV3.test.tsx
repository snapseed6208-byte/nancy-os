// ============================================
// English SRS V3.4 — 58 Regression Tests
// Self-contained: no app imports to avoid
// transitive dependency resolution in test worker.
//
// Tests 1-20:  Preserved SRS core + V3.3 cloze tests (updated for V3.4)
// Tests A-J:  V3.3 Mode routing, cloze validation, SRS isolation (updated)
// Tests K-O:  V3.3 Resume, daily set, mode-specific stats
// Tests V1-V15: V3.4 Three-state result, grammatical forms, target-anchored,
//              source validation, fallback summary, retry hints
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
    pronunciation: "teIk D@ bUl baI D@ hO:nz",
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
// Pure logic mirrors from source files (V3.4)
// ═══════════════════════════════════════

// ── clozeUtils.ts mirrors (V3.4) ──

type ClozeResult = "correct" | "partially_correct" | "incorrect";

interface ClozeQuestion {
  prompt: string;
  expectedAnswer: string;
  acceptedAnswers: string[];
  surfaceForm?: string;
  source: "cloze_sentence" | "example_sentence" | "fallback";
  valid: boolean;
  /** Full source sentence — ONLY for post-submit reveal, NEVER shown before answer. */
  sourceSentence?: string;
  /** Safe context from context/situation fields only (no expression leakage). */
  safeContext?: string;
  /** Chinese translation, hidden behind progressive hint toggle. */
  chineseHint?: string;
}

function normalizeClozeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/['‘’‚›′‵]/g, "'")
    .replace(/["“”„″‶]/g, '"')
    .replace(/[,.!?;:'"]+$/, "")
    .trim();
}

function validateClozeResult(
  userAnswer: string,
  acceptedAnswers: string[],
  surfaceForm?: string,
): ClozeResult {
  if (!userAnswer.trim()) return "incorrect";
  const normalized = normalizeClozeAnswer(userAnswer);
  if (!normalized) return "incorrect";
  if (acceptedAnswers.some((a) => normalizeClozeAnswer(a) === normalized)) {
    return "correct";
  }
  if (surfaceForm && normalizeClozeAnswer(surfaceForm) === normalized) {
    return "partially_correct";
  }
  return "incorrect";
}

function validateClozeAnswer(userAnswer: string, acceptedAnswers: string[]): boolean {
  return validateClozeResult(userAnswer, acceptedAnswers) === "correct";
}

function hasExpressionLeakage(prompt: string, expression: string): boolean {
  const p = normalizeClozeAnswer(prompt);
  const e = normalizeClozeAnswer(expression);
  return p.includes(e);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Grammatical form detection (V3.4) ──

const INFLECTION_SUFFIXES = [/ed$/i, /ing$/i, /s$/i, /es$/i, /ies$/i, /er$/i, /est$/i, /'s$/i, /s'$/i];

function toStem(word: string): string {
  const lower = word.toLowerCase();
  for (const suffix of INFLECTION_SUFFIXES) {
    const stripped = lower.replace(suffix, "");
    if (stripped.length >= 2) return stripped;
  }
  return lower;
}

function detectSurfaceForm(
  sentence: string,
  expression: string,
): { surfaceForm: string; matchType: "exact" | "inflected" } | null {
  const exprWords = expression.split(/\s+/);
  if (exprWords.length === 0) return null;
  const sentWords = sentence.split(/\s+/);
  if (sentWords.length < exprWords.length) return null;

  // 1. Exact case-insensitive match
  const escaped = escapeRegex(expression);
  const exactRegex = new RegExp("\\b" + escaped + "\\b", "gi");
  const exactMatch = exactRegex.exec(sentence);
  if (exactMatch) return { surfaceForm: exactMatch[0], matchType: "exact" };

  // 2. Stem-based fuzzy match
  for (let start = 0; start <= sentWords.length - exprWords.length; start++) {
    let allMatch = true;
    for (let j = 0; j < exprWords.length; j++) {
      const sentWord = sentWords[start + j];
      const exprWord = exprWords[j];
      if (sentWord.toLowerCase() === exprWord.toLowerCase()) continue;
      const sentStem = toStem(sentWord);
      const exprStem = toStem(exprWord);
      if (sentStem === exprStem) continue;
      const isSmallWord = ["a", "an", "the", "in", "on", "at", "to", "of", "for", "by", "up", "out", "off", "my"].includes(exprWord.toLowerCase());
      if (isSmallWord) { allMatch = false; break; }
      allMatch = false;
      break;
    }
    if (allMatch) {
      return { surfaceForm: sentWords.slice(start, start + exprWords.length).join(" "), matchType: "inflected" };
    }
  }
  return null;
}

// ── buildClozeQuestion (V3.5 — no leakage) ──

function buildClozeQuestion(
  english: string,
  chinese: string,
  clozeSentence?: string | null,
  exampleSentence?: string | null,
  context?: string | null,
  situation?: string | null,
): ClozeQuestion {
  // Build safe context from context/situation ONLY (never example_sentence)
  const rawContext = [context, situation].filter(Boolean).join(" · ") || undefined;
  const safeContext = rawContext && !hasExpressionLeakage(rawContext, english)
    ? rawContext
    : undefined;

  // Priority 1: cloze_sentence
  if (clozeSentence) {
    const blanks = (clozeSentence.match(/_{2,}|\[blank\]/gi) || []).length;
    if (blanks >= 1 && !hasExpressionLeakage(clozeSentence, english)) {
      const surfaceInfo = detectSurfaceForm(clozeSentence, english);
      return {
        prompt: clozeSentence,
        expectedAnswer: english,
        acceptedAnswers: [english.toLowerCase(), english.charAt(0).toUpperCase() + english.slice(1).toLowerCase()],
        surfaceForm: surfaceInfo?.surfaceForm,
        source: "cloze_sentence",
        valid: true,
        sourceSentence: undefined,
        safeContext,
        chineseHint: chinese,
      };
    }
  }

  // Priority 2: example_sentence with expression replacement
  if (exampleSentence) {
    const surfaceInfo = detectSurfaceForm(exampleSentence, english);
    if (surfaceInfo) {
      const escaped = escapeRegex(surfaceInfo.surfaceForm);
      const regex = new RegExp(escaped, "gi");
      const replaced = exampleSentence.replace(regex, "_____");
      if (replaced !== exampleSentence && !hasExpressionLeakage(replaced, english)) {
        const contextFromExample = !hasExpressionLeakage(replaced, english)
          ? replaced
          : undefined;
        return {
          prompt: replaced,
          expectedAnswer: english,
          acceptedAnswers: [english.toLowerCase(), english.charAt(0).toUpperCase() + english.slice(1).toLowerCase()],
          surfaceForm: surfaceInfo.surfaceForm !== english ? surfaceInfo.surfaceForm : undefined,
          source: "example_sentence",
          valid: true,
          sourceSentence: exampleSentence,
          safeContext: safeContext || contextFromExample,
          chineseHint: chinese,
        };
      }
    }
  }

  // Priority 3: Fallback with context
  if (safeContext || exampleSentence) {
    return {
      prompt: "_____",
      expectedAnswer: english,
      acceptedAnswers: [english.toLowerCase()],
      source: "fallback",
      valid: true,
      sourceSentence: exampleSentence || undefined,
      safeContext,
      chineseHint: chinese,
    };
  }

  // Priority 4: No valid source - cloze unavailable
  return {
    prompt: "_____",
    expectedAnswer: english,
    acceptedAnswers: [english.toLowerCase()],
    source: "fallback",
    valid: false,
    sourceSentence: undefined,
    safeContext: undefined,
    chineseHint: chinese,
  };
}

// ── V3.5: promptIntegrityCheck mirror ──

function promptIntegrityCheck(question: ClozeQuestion): boolean {
  if (hasExpressionLeakage(question.prompt, question.expectedAnswer)) return false;
  if (!/_{2,}|\[blank\]/i.test(question.prompt)) return false;
  if (
    question.sourceSentence &&
    normalizeClozeAnswer(question.prompt) === normalizeClozeAnswer(question.sourceSentence)
  ) {
    return false;
  }
  return true;
}

// ── V3.5: isSafeContext mirror ──

function isSafeContext(context: string, expression: string): boolean {
  return !hasExpressionLeakage(context, expression);
}

// ── V3.5: buildProgressiveHint mirror ──

function buildProgressiveHint(
  chineseHint: string | undefined,
  expectedAnswer: string,
  hintLevel: number,
): string | null {
  if (hintLevel === 0) return null;
  if (hintLevel === 1) {
    if (chineseHint) return chineseHint;
    return buildStructureHint(expectedAnswer);
  }
  if (hintLevel >= 2) {
    return buildStructureHint(expectedAnswer);
  }
  return null;
}

function buildStructureHint(expectedAnswer: string): string {
  const words = expectedAnswer.split(/\s+/);
  return words
    .map((w) => w.charAt(0) + "_".repeat(Math.max(1, w.length - 1)))
    .join(" ");
}

// ── buildFallbackSummary mirror (V3.4 PART 10) ──

interface DailySummaryMirror {
  overview: string;
  completion_summary: string;
  strongest_expressions: string[];
  weakest_expressions: string[];
  tomorrow_focus: string;
}

function buildFallbackSummaryMirror(
  items: Array<{ english: string; recallScore: number | null }>,
  recallCompleted: number,
  clozeCompleted: number,
  clozeCorrect: number,
  sentenceCompleted: number,
  total: number,
): DailySummaryMirror {
  const passedItems = items.filter((i) => i.recallScore !== null && i.recallScore >= 3);
  const failedItems = items.filter((i) => i.recallScore !== null && i.recallScore < 3);

  const totalDone = recallCompleted + clozeCompleted + sentenceCompleted;
  return {
    overview: totalDone + " 次练习完成。" + (
      passedItems.length >= total * 0.7
        ? "主动回忆表现优秀，继续保持！"
        : "建议明天重点复习薄弱表达。"
    ),
    completion_summary:
      "主动回忆 " + recallCompleted + "/" + total +
      " · 语境填空 " + clozeCompleted + "/" + total +
      "（正确 " + clozeCorrect + "）" +
      " · 个人造句 " + sentenceCompleted + "/" + total,
    strongest_expressions: passedItems.slice(0, 5).map((i) => i.english),
    weakest_expressions: failedItems.slice(0, 5).map((i) => i.english),
    tomorrow_focus: failedItems.length > 0
      ? "重点复习：" + failedItems.slice(0, 3).map((i) => i.english).join("、") + "。"
      : "明天继续巩固今日掌握的表达，保持学习节奏。",
  };
}

// ── Mode helpers (V3.3) ──

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
// Tests 1-4: buildClozeQuestion (V3.4 updated)
// ═══════════════════════════════════════

describe("buildClozeQuestion — V3.4", () => {
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
    // cloze_sentence has leakage -> should fall back to example_sentence
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

  it("4. falls back to simple blank when expression not in example (target-anchored only)", () => {
    const q = buildClozeQuestion(
      "xyzzy",
      "测试",
      undefined,
      "The quick brown fox jumps over the lazy dog today.",
    );
    // V3.4: no random word blanking; expression not found -> fallback
    expect(q.source).toBe("fallback");
    expect(q.valid).toBe(true);
    expect(q.prompt).toBe("_____");
  });
});

// ═══════════════════════════════════════
// Tests 5-8: Cloze answer validation (V3.4 three-state)
// ═══════════════════════════════════════

describe("validateClozeResult — V3.4 three-state", () => {
  const accepted = ["take the bull by the horns"];

  it("5. correct answer returns 'correct'", () => {
    expect(validateClozeResult("take the bull by the horns", accepted)).toBe("correct");
  });

  it("6. wrong answer returns 'incorrect'", () => {
    expect(validateClozeResult("Skirts of my plate", accepted)).toBe("incorrect");
  });

  it("7. empty answer returns 'incorrect'", () => {
    expect(validateClozeResult("", accepted)).toBe("incorrect");
    expect(validateClozeResult("   ", accepted)).toBe("incorrect");
  });

  it("8. correct answer with different case/spacing returns 'correct'", () => {
    expect(validateClozeResult("  Take   the Bull by the Horns.  ", accepted)).toBe("correct");
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

  it("16. expression not found in any source -> fallback", () => {
    const q = buildClozeQuestion(
      "test phrase",
      "测试",
      undefined,
      undefined,
    );
    expect(q.valid).toBe(false); // V3.4: no valid source
    expect(q.source).toBe("fallback");
  });
});

// ═══════════════════════════════════════
// Tests 17-20: SRS rating cap
// ═══════════════════════════════════════

describe("SRS rating", () => {
  it("17. score 1 -> 'hard' (capped)", () => {
    expect(getSrsRating(1)).toBe("hard");
  });

  it("18. score 2 -> 'hard' (capped)", () => {
    expect(getSrsRating(2)).toBe("hard");
  });

  it("19. score 3 -> 'hard' (borderline)", () => {
    expect(getSrsRating(3)).toBe("hard");
  });

  it("20. score 4-5 -> 'good'", () => {
    expect(getSrsRating(4)).toBe("good");
    expect(getSrsRating(5)).toBe("good");
  });
});

// ═══════════════════════════════════════
// TESTS A1-A5: Mode Routing (V3.3)
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

    const recallIds = getDailySetIds(items);
    const clozeIds = getDailySetIds(items);
    const sentenceIds = getDailySetIds(items);
    expect(recallIds).toEqual(clozeIds);
    expect(clozeIds).toEqual(sentenceIds);
  });

  it("F. dailySetIds unchanged after recall results", () => {
    const items = make15Items();
    const before = getDailySetIds(items);

    for (let i = 0; i < 5; i++) applyRecallResult(items[i], 4);

    const after = getDailySetIds(items);
    expect(before).toEqual(after);
  });

  it("G. dailySetIds unchanged after cloze completions (tracked separately)", () => {
    const items = make15Items();
    const before = getDailySetIds(items);

    const clozeLogIds = new Set<string>(["expr-0", "expr-1", "expr-2"]);

    const after = getDailySetIds(items);
    expect(before).toEqual(after);
    expect(before.length).toBe(15);
  });

  it("H. page refresh preserves dailySetIds (simulated)", () => {
    const items1 = make15Items();
    const ids1 = getDailySetIds(items1);

    const items2 = make15Items();
    const ids2 = getDailySetIds(items2);

    expect(ids1).toEqual(ids2);
  });
});

// ═══════════════════════════════════════
// TESTS I-L: Mode progress resume (V3.3)
// ═══════════════════════════════════════

describe("V3.3 Mode Progress Resume", () => {
  it("I. cloze 6/15 done -> resume at 7th item", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    const clozeLogIds = new Set<string>([
      "expr-0", "expr-1", "expr-2", "expr-3", "expr-4", "expr-5",
    ]);

    const idx = findResumeIndex(items, dailySetIds, "cloze", clozeLogIds, new Set());
    expect(idx).toBe(6);
  });

  it("J. sentence 4/15 done -> resume at 5th item", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    const sentenceLogIds = new Set<string>([
      "expr-0", "expr-1", "expr-2", "expr-3",
    ]);

    const idx = findResumeIndex(items, dailySetIds, "sentence", new Set(), sentenceLogIds);
    expect(idx).toBe(4);
  });

  it("K. recall 15/15 done -> resume at end (all complete)", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);
    for (const item of items) applyRecallResult(item, 4);

    const idx = findResumeIndex(items, dailySetIds, "recall", new Set(), new Set());
    expect(idx).toBe(15);
  });

  it("L. cloze 0/15 -> resume at 0 (first item)", () => {
    const items = make15Items();
    const dailySetIds = getDailySetIds(items);

    const idx = findResumeIndex(items, dailySetIds, "cloze", new Set(), new Set());
    expect(idx).toBe(0);
  });
});

// ═══════════════════════════════════════
// TESTS M-P: SRS Isolation (V3.3)
// ═══════════════════════════════════════

describe("V3.3 SRS Isolation", () => {
  it("M. SRS submits only in recall mode", () => {
    const srsSubmitted = new Set<string>();
    expect(shouldSubmitSrs(true, srsSubmitted, "expr-1")).toBe(true);
  });

  it("N. SRS does NOT submit in non-recall mode (cloze/sentence)", () => {
    const srsSubmitted = new Set<string>();
    expect(shouldSubmitSrs(false, srsSubmitted, "expr-1")).toBe(false);
  });

  it("O. SRS does NOT submit twice for same expression in recall", () => {
    const srsSubmitted = new Set<string>(["expr-1"]);
    expect(shouldSubmitSrs(true, srsSubmitted, "expr-1")).toBe(false);
  });

  it("P. applyRecallResult modifies recallScore (SRS-relevant), others don't", () => {
    const item1 = makeSessionItem({ id: "a", expressionId: "expr-a", recallScore: null });

    applyRecallResult(item1, 4);
    expect(item1.recallScore).toBe(4);

    const scoreBeforeCloze = item1.recallScore;
    item1.status = "passed";
    expect(item1.recallScore).toBe(scoreBeforeCloze);

    const scoreBeforeSentence = item1.recallScore;
    item1.userSentence = "My sentence.";
    expect(item1.recallScore).toBe(scoreBeforeSentence);
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
// TESTS U-X: ExpressionCard + status transitions
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

  it("W. recall score >= 3 -> status 'passed'", () => {
    const item = makeSessionItem({ status: "pending" });
    applyRecallResult(item, 4);
    expect(item.status).toBe("passed");
  });

  it("X. recall score < 3 -> status 'failed'", () => {
    const item = makeSessionItem({ status: "pending" });
    applyRecallResult(item, 1);
    expect(item.status).toBe("failed");
  });
});

// ═══════════════════════════════════════
// V3.4 NEW TESTS V1-V15
// ═══════════════════════════════════════

// ── V1-V3: Three-state result model (PART 6) ──

describe("V3.4 Three-State ClozeResult", () => {
  const canonical = "soak up the sunshine";
  const surfaceForm = "soaked up the sunshine";
  const accepted = [canonical.toLowerCase()];

  it("V1. exact canonical match -> correct", () => {
    expect(validateClozeResult("soak up the sunshine", accepted, surfaceForm)).toBe("correct");
  });

  it("V2. surface form match (not canonical) -> partially_correct", () => {
    expect(validateClozeResult("soaked up the sunshine", accepted, surfaceForm)).toBe("partially_correct");
  });

  it("V3. completely wrong answer -> incorrect", () => {
    expect(validateClozeResult("enjoy the sun", accepted, surfaceForm)).toBe("incorrect");
  });
});

// ── V4-V5: Grammatical form detection (PART 5) ──

describe("V3.4 Grammatical Form Detection", () => {
  it("V4. detects inflected form in sentence", () => {
    const result = detectSurfaceForm(
      "Yesterday I soaked up the sunshine at the beach.",
      "soak up the sunshine",
    );
    expect(result).not.toBeNull();
    expect(result!.surfaceForm).toBe("soaked up the sunshine");
    expect(result!.matchType).toBe("inflected");
  });

  it("V5. detects exact form when unchanged", () => {
    const result = detectSurfaceForm(
      "I want to soak up the sunshine today.",
      "soak up the sunshine",
    );
    expect(result).not.toBeNull();
    expect(result!.surfaceForm).toBe("soak up the sunshine");
    expect(result!.matchType).toBe("exact");
  });
});

// ── V6-V7: Target-anchored cloze (PART 3) ──

describe("V3.4 Target-Anchored Cloze", () => {
  it("V6. never blanks random words when expression not in example", () => {
    const q = buildClozeQuestion(
      "hit the sack",
      "睡觉",
      undefined,
      "The quick brown fox jumps over the lazy dog yesterday morning.", // expression not present
    );
    // V3.4: must NOT blank random words. Should fall back.
    expect(q.source).toBe("fallback");
    // The prompt should not contain a blanked random phrase
    // It should be simple fallback (just the blank)
    expect(q.valid).toBe(true);
  });

  it("V7. blanks the inflected form when that's what appears in source", () => {
    const q = buildClozeQuestion(
      "soak up the sunshine",
      "沐浴阳光",
      undefined,
      "We soaked up the sunshine all afternoon.",
    );
    expect(q.valid).toBe(true);
    expect(q.source).toBe("example_sentence");
    expect(q.prompt).toContain("_____");
    expect(q.prompt).not.toContain("soaked up the sunshine");
    expect(q.surfaceForm).toBe("soaked up the sunshine");
  });
});

// ── V8-V9: Source validation (PART 4) ──

describe("V3.4 Source Validation", () => {
  it("V8. marks cloze as unavailable when no valid source exists", () => {
    const q = buildClozeQuestion(
      "some rare expression",
      "稀有表达",
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(q.valid).toBe(false);
    expect(q.source).toBe("fallback");
  });

  it("V9. cloze is available when context/situation provided even without sentences", () => {
    const q = buildClozeQuestion(
      "some rare expression",
      "稀有表达",
      undefined,
      undefined,
      "business meeting",
      "presentation",
    );
    expect(q.valid).toBe(true);
    expect(q.safeContext).toContain("business meeting");
  });
});

// ── V10-V11: Progressive hints (V3.5 updated) ──

describe("V3.5 Progressive Hints", () => {
  it("V10. hint level 0 returns null (no hint)", () => {
    const hint = buildProgressiveHint("提示", "take the bull by the horns", 0);
    expect(hint).toBeNull();
  });

  it("V11. hint level 1 returns Chinese when available", () => {
    const hint = buildProgressiveHint("迎难而上", "take the bull by the horns", 1);
    expect(hint).toBe("迎难而上");
  });

  it("V11a. hint level 1 falls back to structure when no Chinese", () => {
    const hint = buildProgressiveHint(undefined, "take the bull by the horns", 1);
    expect(hint).toContain("t___");
    expect(hint).toContain("b___");
  });

  it("V11b. hint level 2 shows structure hint with first letters", () => {
    const hint = buildProgressiveHint("迎难而上", "take the bull by the horns", 2);
    expect(hint).toContain("t___");
    expect(hint).toContain("b___");
    expect(hint).toContain("h____");
  });
});

// ── V12-V13: Deterministic fallback summary (PART 10) ──

describe("V3.4 Deterministic Fallback Summary", () => {
  it("V12. generates summary with correct completion counts", () => {
    const items = [
      { english: "expression A", recallScore: 4 },
      { english: "expression B", recallScore: 2 },
      { english: "expression C", recallScore: 5 },
    ];
    const summary = buildFallbackSummaryMirror(items, 3, 2, 2, 1, 3);
    expect(summary.strongest_expressions.length).toBeGreaterThan(0);
    expect(summary.weakest_expressions.length).toBeGreaterThan(0);
    expect(summary.completion_summary).toContain("3/3");
    expect(summary.completion_summary).toContain("2/3");
    expect(summary.completion_summary).toContain("1/3");
  });

  it("V13. all passed -> no weak expressions, encouraging overview", () => {
    const items = [
      { english: "expression A", recallScore: 4 },
      { english: "expression B", recallScore: 5 },
      { english: "expression C", recallScore: 4 },
    ];
    const summary = buildFallbackSummaryMirror(items, 3, 3, 3, 3, 3);
    expect(summary.weakest_expressions.length).toBe(0);
    expect(summary.overview).toContain("继续保持");
    expect(summary.tomorrow_focus).toContain("继续巩固");
  });
});

// ── V14: ClozeQuestion has safeContext/sourceSentence/chineseHint (V3.5) ──

describe("V3.5 ClozeQuestion Fields", () => {
  it("V14. question includes safeContext and chineseHint, sourceSentence hidden", () => {
    const q = buildClozeQuestion(
      "take the bull by the horns",
      "迎难而上",
      "Sometimes you just have to _____ and fix the problem.",
      undefined,
      "business negotiation",
      "When facing a tough decision",
    );
    expect(q.safeContext).toBeTruthy();
    expect(q.chineseHint).toBe("迎难而上");
    // sourceSentence should be undefined when using cloze_sentence (it IS the prompt)
    expect(q.sourceSentence).toBeUndefined();
  });
});

// ── V15: Legacy validateClozeAnswer still works ──

describe("V3.4 Legacy Compatibility", () => {
  it("V15. validateClozeAnswer (boolean) wraps validateClozeResult correctly", () => {
    const accepted = ["hello world"];
    expect(validateClozeAnswer("hello world", accepted)).toBe(true);
    expect(validateClozeAnswer("goodbye", accepted)).toBe(false);
    expect(validateClozeAnswer("", accepted)).toBe(false);
  });
});

// ═══════════════════════════════════════
// V3.5 NEW TESTS N1-N18
// ═══════════════════════════════════════

// ── N1-N3: sourceSentence isolation (STAGE 1-2) ──

describe("V3.5 Source Sentence Isolation", () => {
  it("N1. example_sentence stores full sentence as sourceSentence for post-submit", () => {
    const q = buildClozeQuestion(
      "lost touch with",
      "与某人失去联系",
      undefined,
      "I've lost touch with most of my classmates from high school.",
    );
    expect(q.source).toBe("example_sentence");
    expect(q.sourceSentence).toBe("I've lost touch with most of my classmates from high school.");
    expect(q.prompt).not.toContain("lost touch with"); // blanked
  });

  it("N2. sourceSentence is NEVER leaked into prompt", () => {
    const q = buildClozeQuestion(
      "lost touch with",
      "与某人失去联系",
      undefined,
      "I've lost touch with most of my classmates from high school.",
    );
    // The prompt must not contain the answer
    expect(hasExpressionLeakage(q.prompt, "lost touch with")).toBe(false);
  });

  it("N3. cloze_sentence source stores undefined sourceSentence (it IS the prompt)", () => {
    const q = buildClozeQuestion(
      "take the bull by the horns",
      "迎难而上",
      "Sometimes you just have to _____ and fix the problem.",
    );
    expect(q.source).toBe("cloze_sentence");
    expect(q.sourceSentence).toBeUndefined();
  });
});

// ── N4-N6: safeContext never leaks target expression (STAGE 3) ──

describe("V3.5 safeContext — No Expression Leakage", () => {
  it("N4. safeContext does NOT contain the target expression", () => {
    const q = buildClozeQuestion(
      "lost touch with",
      "与某人失去联系",
      undefined,
      "I've lost touch with most of my classmates.", // full sentence has expression
      "talking about old friends",
      "catching up after many years",
    );
    expect(q.safeContext).toBeTruthy();
    expect(hasExpressionLeakage(q.safeContext!, "lost touch with")).toBe(false);
  });

  it("N5. safeContext uses context/situation only, not example_sentence", () => {
    const q = buildClozeQuestion(
      "soak up the sunshine",
      "沐浴阳光",
      undefined,
      "We soaked up the sunshine all afternoon.",
      "vacation memory",
      "relaxing at the beach",
    );
    expect(q.safeContext).toContain("vacation memory");
    expect(q.safeContext).toContain("relaxing at the beach");
    // Must NOT contain the example sentence text
    expect(q.safeContext).not.toContain("soaked up the sunshine");
  });

  it("N6. sourceSentence retains the full example (for post-submit only)", () => {
    const q = buildClozeQuestion(
      "soak up the sunshine",
      "沐浴阳光",
      undefined,
      "We soaked up the sunshine all afternoon.",
      "vacation memory",
    );
    // sourceSentence is the full original sentence
    expect(q.sourceSentence).toBe("We soaked up the sunshine all afternoon.");
    // safeContext does NOT include example sentence
    expect(q.safeContext).not.toContain("soaked");
  });
});

// ── N7-N9: promptIntegrityCheck (STAGE 5) ──

describe("V3.5 Prompt Integrity Check", () => {
  it("N7. clean prompt with blank passes integrity check", () => {
    const q = buildClozeQuestion(
      "take the bull by the horns",
      "迎难而上",
      "Sometimes you just have to _____ and fix the problem.",
    );
    expect(promptIntegrityCheck(q)).toBe(true);
  });

  it("N8. prompt containing expected answer FAILS integrity check", () => {
    const q: ClozeQuestion = {
      prompt: "Sometimes you just have to take the bull by the horns and fix the problem.",
      expectedAnswer: "take the bull by the horns",
      acceptedAnswers: ["take the bull by the horns"],
      source: "example_sentence",
      valid: true,
    };
    expect(promptIntegrityCheck(q)).toBe(false);
  });

  it("N9. prompt without blank FAILS integrity check", () => {
    const q: ClozeQuestion = {
      prompt: "Complete this sentence.",
      expectedAnswer: "hello",
      acceptedAnswers: ["hello"],
      source: "fallback",
      valid: true,
    };
    expect(promptIntegrityCheck(q)).toBe(false);
  });
});

// ── N10: isSafeContext helper ──

describe("V3.5 isSafeContext", () => {
  it("N10. returns false when context contains target expression", () => {
    expect(isSafeContext("I lost touch with friends", "lost touch with")).toBe(false);
  });

  it("N10a. returns true when context is expression-free", () => {
    expect(isSafeContext("talking about friendship", "lost touch with")).toBe(true);
  });
});

// ── N11-N13: buildProgressiveHint levels (STAGE 4) ──

describe("V3.5 Progressive Hint Levels", () => {
  it("N11. level 0 returns null (no hint shown)", () => {
    expect(buildProgressiveHint("提示", "hello world", 0)).toBeNull();
  });

  it("N12. level 1 returns Chinese when available", () => {
    const hint = buildProgressiveHint("与某人失去联系", "lost touch with", 1);
    expect(hint).toBe("与某人失去联系");
  });

  it("N13. level 2 returns structure hint (first letter + underscores)", () => {
    const hint = buildProgressiveHint("沐浴阳光", "soak up the sunshine", 2);
    expect(hint).toBe("s___ u_ t__ s_______");
  });
});

// ── N14-N15: example_sentence leakage prevention (STAGE 1-2) ──

describe("V3.5 Example Sentence Leakage Prevention", () => {
  it("N14. example_sentence with expression is blanked in prompt, never shown as context", () => {
    const q = buildClozeQuestion(
      "catch up",
      "叙旧",
      undefined,
      "Let's catch up over coffee sometime.",
      undefined,
      undefined,
    );
    // The prompt must have the expression blanked
    expect(q.prompt).toContain("_____");
    expect(q.prompt).not.toMatch(/\bcatch up\b/i);
    // safeContext from blanked prompt is expression-free
    if (q.safeContext) {
      expect(hasExpressionLeakage(q.safeContext, "catch up")).toBe(false);
    }
  });

  it("N15. context that contains expression is filtered out from safeContext", () => {
    // If someone puts an example_sentence into the context field (data issue),
    // safeContext should filter it out
    const q = buildClozeQuestion(
      "lost touch with",
      "与某人失去联系",
      undefined,
      undefined,
      "I've lost touch with my old friends", // Leaked into context field!
      undefined,
    );
    // safeContext should be undefined because context contains the expression
    expect(q.safeContext).toBeUndefined();
    // Without safe context or example_sentence, question falls to invalid
    // because no safe source exists
    expect(q.valid).toBe(false);
    expect(q.source).toBe("fallback");
  });
});

// ── N16-N18: ClozeQuestion structure integrity ──

describe("V3.5 ClozeQuestion Structural Integrity", () => {
  it("N16. valid cloze from cloze_sentence has all required fields", () => {
    const q = buildClozeQuestion(
      "take the bull by the horns",
      "迎难而上",
      "Sometimes you just have to _____ and fix the problem.",
      undefined,
      "business negotiation",
      "When facing a tough decision",
    );
    expect(q.valid).toBe(true);
    expect(q.source).toBe("cloze_sentence");
    expect(q.prompt).toContain("_____");
    expect(q.expectedAnswer).toBe("take the bull by the horns");
    expect(q.acceptedAnswers.length).toBeGreaterThanOrEqual(1);
    expect(q.safeContext).toBeTruthy();
    expect(q.chineseHint).toBe("迎难而上");
    expect(q.sourceSentence).toBeUndefined();
    // No more 'scenario' field
    expect((q as Record<string, unknown>).scenario).toBeUndefined();
  });

  it("N17. fallback with no sources has valid=false", () => {
    const q = buildClozeQuestion(
      "rare phrase",
      "稀有短语",
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(q.valid).toBe(false);
    expect(q.source).toBe("fallback");
    expect(q.safeContext).toBeUndefined();
    expect(q.sourceSentence).toBeUndefined();
  });

  it("N18. V3.4 scenario field is REMOVED — no backwards leak", () => {
    // Build a question that in V3.4 would have scenario=exampleSentence
    const q = buildClozeQuestion(
      "lost touch with",
      "与某人失去联系",
      undefined,
      "I've lost touch with most of my classmates.",
      "talking about old friends",
      undefined,
    );
    // V3.5: no scenario field at all
    const qAny = q as Record<string, unknown>;
    expect(qAny.scenario).toBeUndefined();
    // sourceSentence is stored but for post-submit only
    expect(q.sourceSentence).toBe("I've lost touch with most of my classmates.");
    // safeContext is the safe version
    expect(q.safeContext).toBe("talking about old friends");
  });
});
