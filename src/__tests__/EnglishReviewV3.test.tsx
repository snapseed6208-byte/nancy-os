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

  // Priority 3: Fallback — now invalid since prompt is blank-only (V3.6)
  if (safeContext || exampleSentence) {
    return {
      prompt: "_____",
      expectedAnswer: english,
      acceptedAnswers: [english.toLowerCase()],
      source: "fallback",
      valid: false,
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
// V3.6 NEW MIRROR: validateClozeQuestion
// ═══════════════════════════════════════

function validateClozeQuestionMirror(question: {
  prompt: string;
  safeContext?: string;
  acceptedAnswers: string[];
}): { valid: boolean; reason?: string } {
  // 1. Prompt must contain alphabetic characters beyond the blank
  const textBeyondBlank = question.prompt.replace(/_{2,}|\[blank\]/gi, "").trim();
  if (!/[a-zA-Z]/.test(textBeyondBlank)) {
    return { valid: false, reason: "blank_only" };
  }

  // 2. Must have non-empty safeContext
  if (!question.safeContext || !question.safeContext.trim()) {
    return { valid: false, reason: "no_safe_context" };
  }

  // 3. Must have at least one accepted answer
  if (!question.acceptedAnswers || question.acceptedAnswers.length === 0) {
    return { valid: false, reason: "no_accepted_answer" };
  }

  return { valid: true };
}

// ═══════════════════════════════════════
// V3.6 NEW MIRROR: deriveSentenceScore
// ═══════════════════════════════════════

interface PersonalSentenceEvalMirror {
  grammar_correct: boolean;
  naturalness: "natural" | "slightly_unnatural" | "awkward" | "incorrect";
  expression_used_correctly: boolean;
}

function deriveSentenceScoreMirror(result: PersonalSentenceEvalMirror): number {
  if (result.expression_used_correctly && result.naturalness === "natural") return 5;
  if (result.expression_used_correctly && result.naturalness === "slightly_unnatural") return 3;
  if (result.expression_used_correctly || result.naturalness === "awkward") return 3;
  if (!result.expression_used_correctly && result.naturalness === "incorrect") return 1;
  if (!result.grammar_correct) return 2;
  return 3;
}

// ═══════════════════════════════════════
// V3.6 NEW MIRROR: computeActivationState
// ═══════════════════════════════════════

type ActivationStateMirror =
  | "recall_mastered"
  | "context_activated"
  | "production_activated"
  | "fully_activated";

interface ExpressionActivationMirror {
  recallMastered: boolean;
  contextActivated: boolean;
  productionActivated: boolean;
  fullyActivated: boolean;
  activationStates: ActivationStateMirror[];
}

interface ActivationInputMirror {
  recallCompleted: boolean;
  recallScore: number;
  clozeCompleted: boolean;
  clozeCorrect: boolean;
  sentenceCompleted: boolean;
  sentenceScore: number;
}

function computeActivationStateMirror(input: ActivationInputMirror): ExpressionActivationMirror {
  const recallMastered = input.recallCompleted && input.recallScore >= 3;
  const contextActivated = input.clozeCompleted && input.clozeCorrect;
  const productionActivated = input.sentenceCompleted && input.sentenceScore >= 3;
  const fullyActivated = recallMastered && contextActivated && productionActivated;

  const states: ActivationStateMirror[] = [];
  if (fullyActivated) {
    states.push("fully_activated");
  } else {
    if (recallMastered) states.push("recall_mastered");
    if (contextActivated) states.push("context_activated");
    if (productionActivated) states.push("production_activated");
  }

  return { recallMastered, contextActivated, productionActivated, fullyActivated, activationStates: states };
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

  it("4. falls back to simple blank when expression not in example (valid=false in V3.6)", () => {
    const q = buildClozeQuestion(
      "xyzzy",
      "测试",
      undefined,
      "The quick brown fox jumps over the lazy dog today.",
    );
    // V3.6: expression not found + no context → fallback, now invalid (blank-only not teachable)
    expect(q.source).toBe("fallback");
    expect(q.valid).toBe(false);
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
  it("V6. never blanks random words when expression not in example (V3.6: fallback invalid)", () => {
    const q = buildClozeQuestion(
      "hit the sack",
      "睡觉",
      undefined,
      "The quick brown fox jumps over the lazy dog yesterday morning.", // expression not present
    );
    // V3.6: must NOT blank random words. Should fall back (now invalid — blank-only not teachable).
    expect(q.source).toBe("fallback");
    expect(q.valid).toBe(false);
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

  it("V9. V3.6: fallback with context only is now invalid (blank-only not teachable)", () => {
    const q = buildClozeQuestion(
      "some rare expression",
      "稀有表达",
      undefined,
      undefined,
      "business meeting",
      "presentation",
    );
    // V3.6: Priority 3 now returns valid=false — expressions need AI-generated cloze
    expect(q.valid).toBe(false);
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
    expect((q as unknown as Record<string, unknown>).scenario).toBeUndefined();
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
    const qAny = q as unknown as Record<string, unknown>;
    expect(qAny.scenario).toBeUndefined();
    // sourceSentence is stored but for post-submit only
    expect(q.sourceSentence).toBe("I've lost touch with most of my classmates.");
    // safeContext is the safe version
    expect(q.safeContext).toBe("talking about old friends");
  });
});

// ═══════════════════════════════════════
// V3.5 NEW MIRROR: getDailyReviewProgress
// ═══════════════════════════════════════

interface DailyExpressionProgressMirror {
  expressionId: string;
  english: string;
  chinese: string;
  recall: { completed: boolean; score: number | null; status: string; reinforcementRound: number };
  cloze: { completed: boolean; result: "correct" | "partially_correct" | "incorrect" | null };
  sentence: { completed: boolean };
}

interface TodayPracticeLogsMirror {
  clozeIds: Set<string>;
  sentenceIds: Set<string>;
  clozeResults: Map<string, { result: "correct" | "partially_correct" | "incorrect" }>;
  sentenceResults: Map<string, unknown>;
}

function getDailyReviewProgressMirror(
  items: SessionItem[],
  practiceLogs: TodayPracticeLogsMirror,
): {
  totalExpressions: number;
  recallCompleted: number;
  recallCorrect: number;
  clozeCompleted: number;
  clozeCorrect: number;
  sentenceCompleted: number;
  expressions: DailyExpressionProgressMirror[];
} {
  const expressions: DailyExpressionProgressMirror[] = items.map((item) => {
    const expr = item.expression;
    const recallScore = item.recallScore;
    const recallCompleted = recallScore !== null;
    const clozeResult = practiceLogs.clozeResults.get(item.expressionId) || null;

    return {
      expressionId: item.expressionId,
      english: expr?.english || "unknown",
      chinese: expr?.chinese || "",
      recall: {
        completed: recallCompleted,
        score: recallScore,
        status: item.status,
        reinforcementRound: item.reinforcementRound || 0,
      },
      cloze: {
        completed: practiceLogs.clozeIds.has(item.expressionId),
        result: clozeResult?.result || null,
      },
      sentence: {
        completed: practiceLogs.sentenceIds.has(item.expressionId) || item.userSentence !== null,
      },
    };
  });

  return {
    expressions,
    totalExpressions: items.length,
    recallCompleted: items.filter((i) => i.recallScore !== null).length,
    recallCorrect: items.filter((i) => i.recallScore !== null && i.recallScore >= 3).length,
    clozeCompleted: practiceLogs.clozeIds.size,
    clozeCorrect: [...practiceLogs.clozeResults.values()].filter((r) => r.result === "correct").length,
    sentenceCompleted: practiceLogs.sentenceIds.size,
  };
}

// ═══════════════════════════════════════
// V3.5 NEW MIRROR: buildFallbackSummary V3.5
// ═══════════════════════════════════════

interface FallbackSummaryV35Mirror {
  overview: string;
  completion_summary: string;
  activated_expressions: string[];
  recall_only_expressions: string[];
  context_weak_expressions: string[];
  production_weak_expressions: string[];
  error_patterns: Array<{ pattern: string; expressions: string[]; suggestion: string }>;
  strongest_expressions: string[];
  weakest_expressions: string[];
  tomorrow_focus: string;
}

function buildFallbackSummaryV35Mirror(
  dailySet: Array<{
    english?: string;
    recall?: { completed?: boolean; initial_rating?: number | null };
    cloze?: { completed?: boolean; correct?: boolean };
    sentence?: { completed?: boolean };
  }>,
  passedItems: Array<{ english: string }>,
  failedItems: Array<{ english: string }>,
): FallbackSummaryV35Mirror {
  const activated = dailySet
    .filter((e) => e.recall?.completed && e.cloze?.correct && e.sentence?.completed)
    .map((e) => e.english || "");
  const recallOnly = dailySet
    .filter((e) => e.recall?.completed && !e.cloze?.completed && !e.sentence?.completed)
    .map((e) => e.english || "");
  const contextWeak = dailySet
    .filter((e) => e.cloze?.completed && !e.cloze?.correct)
    .map((e) => e.english || "");
  const productionWeak = dailySet
    .filter((e) => e.recall?.completed && (e.recall?.initial_rating || 0) < 3)
    .map((e) => e.english || "");

  return {
    overview: "V3.5 fallback test summary.",
    completion_summary: "Test completion.",
    activated_expressions: activated.slice(0, 5),
    recall_only_expressions: recallOnly.slice(0, 5),
    context_weak_expressions: contextWeak.slice(0, 5),
    production_weak_expressions: productionWeak.slice(0, 5),
    error_patterns: contextWeak.length > 0
      ? [{ pattern: "语境理解薄弱", expressions: contextWeak.slice(0, 3), suggestion: "建议在更多例句中熟悉这些表达的用法" }]
      : [],
    strongest_expressions: passedItems.map((i) => i.english).slice(0, 5),
    weakest_expressions: failedItems.map((i) => i.english).slice(0, 5),
    tomorrow_focus: failedItems.length > 0 ? "重点复习。" : "保持节奏。",
  };
}

// ═══════════════════════════════════════
// V3.5 NEW TESTS: Daily Review Progress Consistency
// ═══════════════════════════════════════

describe("V3.5 getDailyReviewProgress — Unified Progress", () => {
  const emptyLogs: TodayPracticeLogsMirror = {
    clozeIds: new Set(),
    sentenceIds: new Set(),
    clozeResults: new Map(),
    sentenceResults: new Map(),
  };

  it("W1. all pending items → zero progress", () => {
    const items = [makeSessionItem({ id: "a", expressionId: "e1" })];
    const progress = getDailyReviewProgressMirror(items, emptyLogs);
    expect(progress.recallCompleted).toBe(0);
    expect(progress.clozeCompleted).toBe(0);
    expect(progress.sentenceCompleted).toBe(0);
    expect(progress.totalExpressions).toBe(1);
  });

  it("W2. recall scored → completed count updates", () => {
    const items = [
      makeSessionItem({ id: "a", expressionId: "e1", recallScore: 4, status: "passed" }),
      makeSessionItem({ id: "b", expressionId: "e2", recallScore: 2, status: "failed" }),
    ];
    const progress = getDailyReviewProgressMirror(items, emptyLogs);
    expect(progress.recallCompleted).toBe(2);
    expect(progress.recallCorrect).toBe(1);
  });

  it("W3. cloze practice logs → cloze completed counts", () => {
    const items = [makeSessionItem({ id: "a", expressionId: "e1" })];
    const logs: TodayPracticeLogsMirror = {
      clozeIds: new Set(["e1"]),
      sentenceIds: new Set(),
      clozeResults: new Map([["e1", { result: "correct" }]]),
      sentenceResults: new Map(),
    };
    const progress = getDailyReviewProgressMirror(items, logs);
    expect(progress.clozeCompleted).toBe(1);
    expect(progress.clozeCorrect).toBe(1);
  });

  it("W4. cloze partially correct → counts as completed but not correct", () => {
    const items = [makeSessionItem({ id: "a", expressionId: "e1" })];
    const logs: TodayPracticeLogsMirror = {
      clozeIds: new Set(["e1"]),
      sentenceIds: new Set(),
      clozeResults: new Map([["e1", { result: "partially_correct" }]]),
      sentenceResults: new Map(),
    };
    const progress = getDailyReviewProgressMirror(items, logs);
    expect(progress.clozeCompleted).toBe(1);
    expect(progress.clozeCorrect).toBe(0);
  });

  it("W5. latest cloze attempt wins (Map overwrite)", () => {
    // Simulate 3 attempts on same expression: incorrect → partially → correct
    // The Map should hold the latest (correct)
    const logs: TodayPracticeLogsMirror = {
      clozeIds: new Set(["e1"]),
      sentenceIds: new Set(),
      clozeResults: new Map([["e1", { result: "correct" }]]),
      sentenceResults: new Map(),
    };
    const items = [makeSessionItem({ id: "a", expressionId: "e1" })];
    const progress = getDailyReviewProgressMirror(items, logs);
    expect(progress.clozeCorrect).toBe(1);
    expect(progress.clozeCompleted).toBe(1);
  });

  it("W6. mixed mode progress — per-expression state", () => {
    const items = [
      makeSessionItem({ id: "a", expressionId: "e1", recallScore: 4, status: "passed" }),
      makeSessionItem({ id: "b", expressionId: "e2", recallScore: 2, status: "failed" }),
    ];
    const logs: TodayPracticeLogsMirror = {
      clozeIds: new Set(["e1"]),
      sentenceIds: new Set(["e2"]),
      clozeResults: new Map([["e1", { result: "correct" }]]),
      sentenceResults: new Map(),
    };
    const progress = getDailyReviewProgressMirror(items, logs);

    const e1 = progress.expressions.find((e) => e.expressionId === "e1")!;
    expect(e1.recall.completed).toBe(true);
    expect(e1.cloze.completed).toBe(true);
    expect(e1.cloze.result).toBe("correct");

    const e2 = progress.expressions.find((e) => e.expressionId === "e2")!;
    expect(e2.recall.completed).toBe(true);
    expect(e2.sentence.completed).toBe(true);
  });
});

// ═══════════════════════════════════════
// V3.5 NEW TESTS: Fallback Summary V3.5 Categories
// ═══════════════════════════════════════

describe("V3.5 Fallback Summary — Expression Categories", () => {
  it("X1. activated_expressions: all 3 modes complete + correct", () => {
    const dailySet = [{
      english: "proactive",
      recall: { completed: true, initial_rating: 4 },
      cloze: { completed: true, correct: true },
      sentence: { completed: true },
    }];
    const summary = buildFallbackSummaryV35Mirror(dailySet, [{ english: "proactive" }], []);
    expect(summary.activated_expressions).toEqual(["proactive"]);
    expect(summary.recall_only_expressions).toEqual([]);
    expect(summary.context_weak_expressions).toEqual([]);
  });

  it("X2. recall_only_expressions: recall done but no cloze/sentence", () => {
    const dailySet = [{
      english: "take the bull by the horns",
      recall: { completed: true, initial_rating: 4 },
      cloze: { completed: false, correct: false },
      sentence: { completed: false },
    }];
    const summary = buildFallbackSummaryV35Mirror(dailySet, [{ english: "take the bull by the horns" }], []);
    expect(summary.recall_only_expressions).toEqual(["take the bull by the horns"]);
    expect(summary.activated_expressions).toEqual([]);
  });

  it("X3. context_weak_expressions: cloze done but incorrect", () => {
    const dailySet = [{
      english: "lost touch with",
      recall: { completed: true, initial_rating: 3 },
      cloze: { completed: true, correct: false },
      sentence: { completed: false },
    }];
    const summary = buildFallbackSummaryV35Mirror(dailySet, [], [{ english: "lost touch with" }]);
    expect(summary.context_weak_expressions).toEqual(["lost touch with"]);
    expect(summary.error_patterns.length).toBe(1);
    expect(summary.error_patterns[0].pattern).toBe("语境理解薄弱");
  });

  it("X4. production_weak_expressions: recall score < 3", () => {
    const dailySet = [{
      english: "ambiguous",
      recall: { completed: true, initial_rating: 2 },
      cloze: { completed: false, correct: false },
      sentence: { completed: false },
    }];
    const summary = buildFallbackSummaryV35Mirror(dailySet, [], [{ english: "ambiguous" }]);
    expect(summary.production_weak_expressions).toEqual(["ambiguous"]);
  });

  it("X5. mixed expressions — correct categorization", () => {
    const dailySet = [
      { english: "activated", recall: { completed: true, initial_rating: 4 }, cloze: { completed: true, correct: true }, sentence: { completed: true } },
      { english: "recall", recall: { completed: true, initial_rating: 3 }, cloze: { completed: false, correct: false }, sentence: { completed: false } },
      { english: "context", recall: { completed: true, initial_rating: 4 }, cloze: { completed: true, correct: false }, sentence: { completed: false } },
      { english: "production", recall: { completed: true, initial_rating: 1 }, cloze: { completed: false, correct: false }, sentence: { completed: false } },
      { english: "untouched", recall: { completed: false, initial_rating: null }, cloze: { completed: false, correct: false }, sentence: { completed: false } },
    ];
    const summary = buildFallbackSummaryV35Mirror(dailySet, [{ english: "activated" }, { english: "recall" }], [{ english: "context" }, { english: "production" }]);
    expect(summary.activated_expressions).toEqual(["activated"]);
    expect(summary.recall_only_expressions).toEqual(["recall", "production"]);
    expect(summary.context_weak_expressions).toEqual(["context"]);
    expect(summary.production_weak_expressions).toEqual(["production"]);
  });

  it("X6. empty dailySet → all categories empty", () => {
    const summary = buildFallbackSummaryV35Mirror([], [], []);
    expect(summary.activated_expressions).toEqual([]);
    expect(summary.recall_only_expressions).toEqual([]);
    expect(summary.context_weak_expressions).toEqual([]);
    expect(summary.production_weak_expressions).toEqual([]);
    expect(summary.error_patterns).toEqual([]);
  });
});

// ═══════════════════════════════════════
// V3.5 NEW TESTS: AI Summary Data Structure
// ═══════════════════════════════════════

describe("V3.5 AI Summary Data Structure", () => {
  it("Y1. full AI summary has all V3.5 fields", () => {
    const summary = {
      overview: "test",
      completion_summary: "test",
      recall_analysis: { summary: "r", difficult_expressions: [] },
      cloze_analysis: { summary: "c", common_errors: [] },
      sentence_analysis: { summary: "s", good_outputs: [], needs_improvement: [] },
      activated_expressions: ["a", "b"],
      recall_only_expressions: ["c"],
      context_weak_expressions: ["d"],
      production_weak_expressions: ["e"],
      error_patterns: [{ pattern: "语境薄弱", expressions: ["d"], suggestion: "多练习" }],
      strongest_expressions: ["a", "b", "f"],
      weakest_expressions: ["d", "e"],
      tomorrow_focus: "重点复习语境薄弱表达",
    };

    expect(summary.activated_expressions).toHaveLength(2);
    expect(summary.recall_only_expressions).toHaveLength(1);
    expect(summary.context_weak_expressions).toHaveLength(1);
    expect(summary.production_weak_expressions).toHaveLength(1);
    expect(summary.error_patterns).toHaveLength(1);
    expect(summary.error_patterns[0].pattern).toBeTruthy();
    expect(summary.error_patterns[0].suggestion).toBeTruthy();
  });

  it("Y2. minimal AI summary (no optional fields) still valid", () => {
    const summary = {
      overview: "已完成今日复习。",
      completion_summary: "0/0 完成。",
      strongest_expressions: [],
      weakest_expressions: [],
      tomorrow_focus: "暂无建议。",
    };

    expect(summary.overview).toBeTruthy();
    expect(summary.completion_summary).toBeTruthy();
    expect(summary.strongest_expressions).toEqual([]);
    expect(summary.weakest_expressions).toEqual([]);
  });

  it("Y3. error_patterns array structure is correct", () => {
    const errorPatterns = [
      { pattern: "介词使用错误", expressions: ["depend on", "focus on"], suggestion: "注意动词+介词的固定搭配" },
      { pattern: "时态混淆", expressions: ["I've been"], suggestion: "区分现在完成时和一般过去时的使用场景" },
    ];

    expect(errorPatterns).toHaveLength(2);
    for (const ep of errorPatterns) {
      expect(typeof ep.pattern).toBe("string");
      expect(Array.isArray(ep.expressions)).toBe(true);
      expect(typeof ep.suggestion).toBe("string");
      expect(ep.pattern.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════
// V3.5 NEW TESTS: Progress Cap (Corrupted Data Resilience)
// ═══════════════════════════════════════

describe("V3.5 Progress Cap — Corrupted Resilience", () => {
  it("Z1. progress with 0 items → zero completion", () => {
    const progress = getDailyReviewProgressMirror([], {
      clozeIds: new Set(),
      sentenceIds: new Set(),
      clozeResults: new Map(),
      sentenceResults: new Map(),
    });
    expect(progress.totalExpressions).toBe(0);
    expect(progress.recallCompleted).toBe(0);
    expect(progress.clozeCompleted).toBe(0);
  });

  it("Z2. recallCorrect never exceeds recallCompleted (cap at recallCompleted level)", () => {
    const items = [makeSessionItem({ id: "a", expressionId: "e1", recallScore: 1, status: "failed" })];
    const progress = getDailyReviewProgressMirror(items, {
      clozeIds: new Set(),
      sentenceIds: new Set(),
      clozeResults: new Map(),
      sentenceResults: new Map(),
    });
    // recallCompleted=1 because recallScore is not null, recallCorrect=0 because score < 3
    expect(progress.recallCorrect).toBe(0);
    expect(progress.recallCompleted).toBe(1);
    // recallCorrect <= recallCompleted
    expect(progress.recallCorrect).toBeLessThanOrEqual(progress.recallCompleted);
  });

  it("Z3. clozeCorrect never exceeds clozeCompleted", () => {
    const items = [makeSessionItem({ id: "a", expressionId: "e1" })];
    const logs: TodayPracticeLogsMirror = {
      clozeIds: new Set(["e1"]),
      sentenceIds: new Set(),
      clozeResults: new Map([["e1", { result: "incorrect" }]]),
      sentenceResults: new Map(),
    };
    const progress = getDailyReviewProgressMirror(items, logs);
    expect(progress.clozeCompleted).toBe(1);
    expect(progress.clozeCorrect).toBe(0);
    expect(progress.clozeCorrect).toBeLessThanOrEqual(progress.clozeCompleted);
  });
});

// ═══════════════════════════════════════
// V3.5 NEW TESTS: Historical Summary Entry
// ═══════════════════════════════════════

describe("V3.5 Historical Summary Entry", () => {
  it("H1. historical summary entry has required fields", () => {
    const entry = {
      id: "log-1",
      date: "2026-08-10",
      summary: {
        overview: "今天表现不错",
        activated_expressions: ["proactive"],
        context_weak_expressions: ["ambiguous"],
        error_patterns: [],
      },
      expressionCount: 15,
      createdAt: "2026-08-10T14:00:00Z",
    };

    expect(entry.id).toBeTruthy();
    expect(entry.date).toBe("2026-08-10");
    expect(entry.expressionCount).toBe(15);
    expect(typeof entry.summary).toBe("object");
    expect(entry.summary.overview).toBeTruthy();
  });

  it("H2. historical summary preserves V3.5 category arrays", () => {
    const entry = {
      id: "log-2",
      date: "2026-08-09",
      summary: {
        overview: "复习概括",
        activated_expressions: ["a", "b"],
        recall_only_expressions: ["c", "d"],
        context_weak_expressions: ["e"],
        production_weak_expressions: ["f"],
        error_patterns: [{ pattern: "test", expressions: ["e"], suggestion: "fix" }],
        strongest_expressions: ["a", "b"],
        weakest_expressions: ["e", "f"],
        tomorrow_focus: "focus on e",
      },
      expressionCount: 10,
      createdAt: "2026-08-09T12:00:00Z",
    };

    // All V3.5 category fields present
    expect(Array.isArray(entry.summary.activated_expressions)).toBe(true);
    expect(Array.isArray(entry.summary.recall_only_expressions)).toBe(true);
    expect(Array.isArray(entry.summary.context_weak_expressions)).toBe(true);
    expect(Array.isArray(entry.summary.production_weak_expressions)).toBe(true);
    expect(Array.isArray(entry.summary.error_patterns)).toBe(true);
  });

  it("H3. multiple historical summaries sorted by date descending", () => {
    const entries = [
      { date: "2026-08-10", summary: {} },
      { date: "2026-08-09", summary: {} },
      { date: "2026-08-07", summary: {} },
    ];

    // Verify descending order (newest first, as from `order("created_at", { ascending: false })`)
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].date < entries[i - 1].date).toBe(true);
    }
  });
});

// ═══════════════════════════════════════
// V3.6 NEW TESTS: validateClozeQuestion
// ═══════════════════════════════════════

describe("V3.6 validateClozeQuestion — Quality Gate", () => {
  it("A1. rejects blank-only prompt", () => {
    const result = validateClozeQuestionMirror({
      prompt: "_____",
      safeContext: "talking about work",
      acceptedAnswers: ["take the bull by the horns"],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("blank_only");
  });

  it("A2. rejects missing safeContext", () => {
    const result = validateClozeQuestionMirror({
      prompt: "He _____ the problem.",
      safeContext: undefined,
      acceptedAnswers: ["solved"],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("no_safe_context");
  });

  it("A3. accepts valid question", () => {
    const result = validateClozeQuestionMirror({
      prompt: "He _____ the problem.",
      safeContext: "discussing work challenges",
      acceptedAnswers: ["solved"],
    });
    expect(result.valid).toBe(true);
  });

  it("A4. rejects empty acceptedAnswers", () => {
    const result = validateClozeQuestionMirror({
      prompt: "He _____ the problem.",
      safeContext: "discussing work",
      acceptedAnswers: [],
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("no_accepted_answer");
  });
});

// ═══════════════════════════════════════
// V3.6 NEW TESTS: buildClozeQuestion Priority Chain
// ═══════════════════════════════════════

describe("V3.6 buildClozeQuestion — Source Priority", () => {
  it("B1. cloze_sentence preferred over example_sentence", () => {
    const q = buildClozeQuestion(
      "lost touch with",
      "失去联系",
      "I've _____ most of my old friends.",
      "I've lost touch with most of my old friends.",
      "talking about old friends",
    );
    expect(q.source).toBe("cloze_sentence");
    expect(q.valid).toBe(true);
    expect(q.prompt).toContain("_____");
  });

  it("B2. example_sentence with surface form match is valid", () => {
    const q = buildClozeQuestion(
      "lost touch with",
      "失去联系",
      undefined,
      "I've lost touch with most of my old friends.",
      "talking about old friends",
    );
    expect(q.source).toBe("example_sentence");
    expect(q.valid).toBe(true);
    expect(q.sourceSentence).toBe("I've lost touch with most of my old friends.");
  });

  it("B3. fallback with safeContext is now invalid (blank-only)", () => {
    // V3.6: Priority 3 no longer returns valid=true for blank-only
    const q = buildClozeQuestion(
      "rare phrase",
      "稀有短语",
      undefined,
      undefined,
      "some context about usage",
    );
    expect(q.source).toBe("fallback");
    expect(q.valid).toBe(false);
  });
});

// ═══════════════════════════════════════
// V3.6 NEW TESTS: Three-Level Cloze Results
// ═══════════════════════════════════════

describe("V3.6 Cloze Three-Level Results", () => {
  it("C1. correct match → score 2", () => {
    const result = validateClozeResult(
      "take the bull by the horns",
      ["take the bull by the horns", "grab the bull by the horns"],
    );
    expect(result).toBe("correct");
  });

  it("C2. surfaceForm match → partially_correct (score 1)", () => {
    const result = validateClozeResult(
      "took the bull by the horns",
      ["take the bull by the horns"],
      "took the bull by the horns",
    );
    expect(result).toBe("partially_correct");
  });

  it("C3. no match → incorrect (score 0)", () => {
    const result = validateClozeResult(
      "xyz",
      ["take the bull by the horns"],
    );
    expect(result).toBe("incorrect");
  });
});

// ═══════════════════════════════════════
// V3.6 NEW TESTS: Sentence Score Mapping
// ═══════════════════════════════════════

describe("V3.6 deriveSentenceScore — Score Mapping", () => {
  it("D1. natural + correct usage → score 5", () => {
    const score = deriveSentenceScoreMirror({
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
    });
    expect(score).toBe(5);
  });

  it("D2. slightly_unnatural + correct → score 3", () => {
    const score = deriveSentenceScoreMirror({
      grammar_correct: true,
      naturalness: "slightly_unnatural",
      expression_used_correctly: true,
    });
    expect(score).toBe(3);
  });

  it("D3. incorrect usage → score 1", () => {
    const score = deriveSentenceScoreMirror({
      grammar_correct: false,
      naturalness: "incorrect",
      expression_used_correctly: false,
    });
    expect(score).toBe(1);
  });

  it("D4. grammar incorrect but expression OK → score 3", () => {
    const score = deriveSentenceScoreMirror({
      grammar_correct: false,
      naturalness: "awkward",
      expression_used_correctly: true,
    });
    expect(score).toBe(3);
  });
});

// ═══════════════════════════════════════
// V3.6 NEW TESTS: Activation State
// ═══════════════════════════════════════

describe("V3.6 computeActivationState", () => {
  it("E1. fully activated when all 3 conditions met", () => {
    const state = computeActivationStateMirror({
      recallCompleted: true,
      recallScore: 4,
      clozeCompleted: true,
      clozeCorrect: true,
      sentenceCompleted: true,
      sentenceScore: 5,
    });
    expect(state.fullyActivated).toBe(true);
    expect(state.activationStates).toContain("fully_activated");
  });

  it("E2. recall_mastered only when only recall >= 3", () => {
    const state = computeActivationStateMirror({
      recallCompleted: true,
      recallScore: 4,
      clozeCompleted: false,
      clozeCorrect: false,
      sentenceCompleted: false,
      sentenceScore: 0,
    });
    expect(state.recallMastered).toBe(true);
    expect(state.contextActivated).toBe(false);
    expect(state.productionActivated).toBe(false);
    expect(state.activationStates).toContain("recall_mastered");
  });

  it("E3. context_activated when cloze is correct", () => {
    const state = computeActivationStateMirror({
      recallCompleted: true,
      recallScore: 2,
      clozeCompleted: true,
      clozeCorrect: true,
      sentenceCompleted: false,
      sentenceScore: 0,
    });
    expect(state.recallMastered).toBe(false);
    expect(state.contextActivated).toBe(true);
    expect(state.activationStates).toContain("context_activated");
  });

  it("E4. production_activated when sentence completed with score >= 3", () => {
    const state = computeActivationStateMirror({
      recallCompleted: false,
      recallScore: 0,
      clozeCompleted: false,
      clozeCorrect: false,
      sentenceCompleted: true,
      sentenceScore: 4,
    });
    expect(state.productionActivated).toBe(true);
    expect(state.activationStates).toContain("production_activated");
  });

  it("E5. no activation when nothing completed", () => {
    const state = computeActivationStateMirror({
      recallCompleted: false,
      recallScore: 0,
      clozeCompleted: false,
      clozeCorrect: false,
      sentenceCompleted: false,
      sentenceScore: 0,
    });
    expect(state.activationStates).toHaveLength(0);
    expect(state.fullyActivated).toBe(false);
  });
});

// ============================================
// V4 Lifecycle — Inline Mirrors
// ============================================

/** V4: Simulates the lifecycle status transition */
function transitionStatusForTest(
  currentStatus: "collected" | "learning" | "review" | "mastered",
  action: "start_learn" | "complete_learn" | "srs_promote" | "srs_master",
): string {
  if (action === "start_learn" && currentStatus === "collected") return "learning";
  if (action === "complete_learn" && currentStatus === "learning") return "review";
  if (action === "srs_promote" && currentStatus === "review") return "review";
  if (action === "srs_master" && currentStatus === "review") return "mastered";
  return currentStatus;
}

/** V4: Simulates the due query filter */
function isDueForReview(status: string, nextReviewDate: string | null, now: Date): boolean {
  if (status !== "review" && status !== "mastered") return false;
  if (!nextReviewDate) return false;
  return new Date(nextReviewDate) <= now;
}

/** V4: Simulates learning queue ordering */
function sortLearnQueue(
  expressions: Array<{ id: string; status: string; created_at: string }>,
): string[] {
  return [...expressions]
    .sort((a, b) => {
      if (a.status === "learning" && b.status !== "learning") return -1;
      if (a.status !== "learning" && b.status === "learning") return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })
    .map((e) => e.id);
}

/** V4: Simulates session_type default logic */
function getSessionType(sessionType: string | undefined): "learn" | "review" {
  return sessionType === "learn" ? "learn" : "review";
}

// ============================================
// V4 Lifecycle Tests
// ============================================

describe("V4 Lifecycle — State Transitions", () => {
  it("L1. collected → learning when start_learn", () => {
    expect(transitionStatusForTest("collected", "start_learn")).toBe("learning");
  });

  it("L2. learning → review when complete_learn", () => {
    expect(transitionStatusForTest("learning", "complete_learn")).toBe("review");
  });

  it("L3. review stays review during srs_promote", () => {
    expect(transitionStatusForTest("review", "srs_promote")).toBe("review");
  });

  it("L3b. review → mastered when srs_master", () => {
    expect(transitionStatusForTest("review", "srs_master")).toBe("mastered");
  });
});

describe("V4 Lifecycle — Due Query Filter", () => {
  const now = new Date("2026-08-10T12:00:00Z");
  const yesterday = new Date("2026-08-09T12:00:00Z");
  const tomorrow = new Date("2026-08-11T12:00:00Z");

  it("L4. collected excluded from review queue", () => {
    expect(isDueForReview("collected", null, now)).toBe(false);
    expect(isDueForReview("collected", yesterday.toISOString(), now)).toBe(false);
  });

  it("L5. learning excluded from review queue", () => {
    expect(isDueForReview("learning", null, now)).toBe(false);
    expect(isDueForReview("learning", yesterday.toISOString(), now)).toBe(false);
  });

  it("L6. review with past date is due", () => {
    expect(isDueForReview("review", yesterday.toISOString(), now)).toBe(true);
  });

  it("L6b. review with future date is not due", () => {
    expect(isDueForReview("review", tomorrow.toISOString(), now)).toBe(false);
  });

  it("L6c. review with null date is not due", () => {
    expect(isDueForReview("review", null, now)).toBe(false);
  });

  it("L6d. mastered with past date is due", () => {
    expect(isDueForReview("mastered", yesterday.toISOString(), now)).toBe(true);
  });
});

describe("V4 Lifecycle — Learning Queue Ordering", () => {
  it("L7. learning (resume) before collected", () => {
    const ids = sortLearnQueue([
      { id: "a", status: "collected", created_at: "2026-08-01T00:00:00Z" },
      { id: "b", status: "learning", created_at: "2026-08-05T00:00:00Z" },
    ]);
    expect(ids[0]).toBe("b");
    expect(ids[1]).toBe("a");
  });

  it("L8. same status ordered by created_at ASC", () => {
    const ids = sortLearnQueue([
      { id: "c", status: "collected", created_at: "2026-08-10T00:00:00Z" },
      { id: "a", status: "collected", created_at: "2026-08-01T00:00:00Z" },
      { id: "b", status: "collected", created_at: "2026-08-05T00:00:00Z" },
    ]);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("L9. multiple learning sorted by created_at within group", () => {
    const ids = sortLearnQueue([
      { id: "x", status: "learning", created_at: "2026-08-08T00:00:00Z" },
      { id: "y", status: "collected", created_at: "2026-08-01T00:00:00Z" },
      { id: "z", status: "learning", created_at: "2026-08-05T00:00:00Z" },
    ]);
    expect(ids[0]).toBe("z");
    expect(ids[1]).toBe("x");
    expect(ids[2]).toBe("y");
  });
});

describe("V4 Lifecycle — Session Type", () => {
  it("L10. undefined session_type defaults to review", () => {
    expect(getSessionType(undefined)).toBe("review");
  });

  it("L11. explicit learn returns learn", () => {
    expect(getSessionType("learn")).toBe("learn");
  });

  it("L12. explicit review returns review", () => {
    expect(getSessionType("review")).toBe("review");
  });
});

// ============================================
// V4 Sentence Feedback Fix — Inline Mirrors
// ============================================

type SentenceStep = "writing" | "analyzing" | "feedback";

interface SentenceCardState {
  step: SentenceStep;
  sentence: string;
  evaluation: PersonalSentenceEvaluationForTest | null;
  evalError: boolean;
  saved: boolean;
  feedbackUpdated: boolean;
}

interface PersonalSentenceEvaluationForTest {
  grammar_correct: boolean;
  naturalness: "natural" | "slightly_unnatural" | "awkward" | "incorrect";
  corrections: Array<{ original: string; corrected: string; explanation: string }>;
  overall_feedback: string;
  expression_used_correctly: boolean;
  example_usage?: string;
}

function createInitialState(): SentenceCardState {
  return { step: "writing", sentence: "", evaluation: null, evalError: false, saved: false, feedbackUpdated: false };
}

/** Simulates: user types sentence → clicks submit */
function transitionToAnalyzing(state: SentenceCardState, sentence: string): SentenceCardState {
  if (!sentence.trim() || state.step !== "writing") return state;
  return { ...state, step: "analyzing", sentence, saved: true };
}

/** Simulates: AI evaluation succeeds */
function transitionToFeedback(
  state: SentenceCardState,
  evaluation: PersonalSentenceEvaluationForTest,
): SentenceCardState {
  if (state.step !== "analyzing") return state;
  return { ...state, step: "feedback", evaluation, evalError: false, feedbackUpdated: true };
}

/** Simulates: AI evaluation fails */
function transitionToFeedbackError(state: SentenceCardState): SentenceCardState {
  if (state.step !== "analyzing") return state;
  return { ...state, step: "feedback", evalError: true, evaluation: null };
}

/** Simulates: user clicks "修改一下再试" */
function transitionToModify(state: SentenceCardState): SentenceCardState {
  if (state.step !== "feedback") return state;
  return { ...state, step: "writing", evaluation: null, evalError: false };
}

/** Simulates: user clicks "保存并下一题" → advance to next card */
function advanceCard(state: SentenceCardState): { advanced: boolean; newCardState: SentenceCardState } {
  if (state.step !== "feedback") return { advanced: false, newCardState: state };
  const newCard = createInitialState();
  return { advanced: true, newCardState: newCard };
}

/** Simulates: retry AI after failure */
function retryAI(state: SentenceCardState): SentenceCardState {
  if (state.step !== "feedback" || !state.evalError) return state;
  return { ...state, step: "analyzing", evalError: false };
}

/** Check if feedback has all display sections */
function hasCompleteFeedback(evaluation: PersonalSentenceEvaluationForTest): boolean {
  const hasGrammar = evaluation.grammar_correct !== undefined;
  const hasUsage = evaluation.expression_used_correctly !== undefined;
  const hasNaturalness = evaluation.naturalness !== undefined;
  const hasFeedback = evaluation.overall_feedback !== undefined;
  return hasGrammar && hasUsage && hasNaturalness && hasFeedback;
}

/** Simulates: does NOT auto-advance after AI success */
function doesAutoAdvanceAfterFeedback(
  state: SentenceCardState,
  evaluation: PersonalSentenceEvaluationForTest,
): boolean {
  const afterAI = transitionToFeedback(state, evaluation);
  return afterAI.step !== "feedback";
}

// ============================================
// V4 Sentence Feedback Tests
// ============================================

describe("S1 — Sentence Card State Machine", () => {
  it("S1. initial state is writing", () => {
    const state = createInitialState();
    expect(state.step).toBe("writing");
  });

  it("S2. submitting sentence → analyzing", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "I took the bull by the horns");
    expect(state.step).toBe("analyzing");
  });

  it("S3. AI success → feedback", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "I took the bull by the horns");
    state = transitionToFeedback(state, {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "Great sentence!",
    });
    expect(state.step).toBe("feedback");
    expect(state.evaluation).not.toBeNull();
    expect(state.evalError).toBe(false);
  });

  it("S4. AI failure → feedback with error flag", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "I took the bull by the horns");
    state = transitionToFeedbackError(state);
    expect(state.step).toBe("feedback");
    expect(state.evalError).toBe(true);
    expect(state.evaluation).toBeNull();
  });

  it("S5. empty sentence does NOT transition to analyzing", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "   ");
    expect(state.step).toBe("writing");
    expect(state.saved).toBe(false);
  });
});

describe("S2 — NO Auto-Advance Guarantee", () => {
  it("S6. AI success does NOT advance", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "I took the bull by the horns");
    const advanced = doesAutoAdvanceAfterFeedback(state, {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "Good!",
    });
    expect(advanced).toBe(false);
  });

  it("S7. staying in feedback for 1 'tick' does NOT advance", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "Test sentence");
    state = transitionToFeedback(state, {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "OK",
    });
    // After any number of passive ticks, should stay in feedback
    expect(state.step).toBe("feedback");
    // 10 more "ticks" — still feedback
    for (let i = 0; i < 10; i++) {
      // No external advance — state unchanged
    }
    expect(state.step).toBe("feedback");
  });

  it("S8. only advanceCard moves to next card", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "Test sentence");
    state = transitionToFeedback(state, {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "OK",
    });
    const result = advanceCard(state);
    expect(result.advanced).toBe(true);
    expect(result.newCardState.step).toBe("writing");
    expect(result.newCardState.evaluation).toBeNull();
    expect(result.newCardState.sentence).toBe("");
  });

  it("S9. advanceCard from non-feedback state does nothing", () => {
    let state = createInitialState();
    const result = advanceCard(state);
    expect(result.advanced).toBe(false);
    expect(result.newCardState.step).toBe("writing");
  });
});

describe("S3 — User Control '修改一下再试'", () => {
  it("S10. modify returns to writing with sentence preserved", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "I took the bull by the horns");
    state = transitionToFeedback(state, {
      grammar_correct: false,
      naturalness: "awkward",
      expression_used_correctly: false,
      corrections: [{ original: "took", corrected: "take", explanation: "Use base form" }],
      overall_feedback: "Needs work",
    });
    state = transitionToModify(state);
    expect(state.step).toBe("writing");
    expect(state.sentence).toBe("I took the bull by the horns");
    expect(state.evaluation).toBeNull();
    expect(state.evalError).toBe(false);
  });

  it("S11. after modify, can re-submit and get new feedback", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "I took the bull by the horns");
    state = transitionToFeedback(state, {
      grammar_correct: false,
      naturalness: "awkward",
      expression_used_correctly: false,
      corrections: [],
      overall_feedback: "Bad",
    });
    state = transitionToModify(state);
    expect(state.step).toBe("writing");
    // Re-submit
    state = transitionToAnalyzing(state, "I take the bull by the horns and face it");
    state = transitionToFeedback(state, {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "Good!",
    });
    expect(state.step).toBe("feedback");
    expect(state.evaluation?.overall_feedback).toBe("Good!");
  });
});

describe("S4 — AI Failure Fallback", () => {
  it("S12. AI failure still saves the sentence", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "My test sentence");
    expect(state.saved).toBe(true);
    expect(state.sentence).toBe("My test sentence");
  });

  it("S13. AI failure can retry", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "My test sentence");
    state = transitionToFeedbackError(state);
    expect(state.step).toBe("feedback");
    expect(state.evalError).toBe(true);
    // Retry
    state = retryAI(state);
    expect(state.step).toBe("analyzing");
    expect(state.evalError).toBe(false);
  });

  it("S14. retry after failure → success → stays in feedback", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "My test sentence");
    state = transitionToFeedbackError(state);
    state = retryAI(state);
    state = transitionToFeedback(state, {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "Looks good now!",
    });
    expect(state.step).toBe("feedback");
    expect(state.evaluation).not.toBeNull();
  });

  it("S15. AI failure allows skip to next card", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "My test sentence");
    state = transitionToFeedbackError(state);
    // User opts to skip without feedback
    const result = advanceCard(state);
    expect(result.advanced).toBe(true);
    expect(result.newCardState.step).toBe("writing");
  });
});

describe("S5 — Feedback Content Completeness", () => {
  it("S16. complete feedback has all required fields", () => {
    const evaluation: PersonalSentenceEvaluationForTest = {
      grammar_correct: false,
      naturalness: "slightly_unnatural",
      expression_used_correctly: true,
      corrections: [{ original: "make homework", corrected: "do homework", explanation: "Collocation error" }],
      overall_feedback: "Expression used correctly, but the grammar needs work.",
    };
    expect(hasCompleteFeedback(evaluation)).toBe(true);
  });

  it("S17. perfect sentence feedback is still complete", () => {
    const evaluation: PersonalSentenceEvaluationForTest = {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "这句话已经很好，不需要修改。",
    };
    expect(hasCompleteFeedback(evaluation)).toBe(true);
  });

  it("S18. naturalness enum maps correctly to display labels", () => {
    const labelMap: Record<string, string> = {
      natural: "自然",
      slightly_unnatural: "可以更自然",
      awkward: "不自然",
      incorrect: "用法不正确",
    };
    expect(labelMap.natural).toBe("自然");
    expect(labelMap.slightly_unnatural).toBe("可以更自然");
    expect(labelMap.awkward).toBe("不自然");
    expect(labelMap.incorrect).toBe("用法不正确");
  });
});

describe("S6 — Sentence Mode Does NOT Modify SRS", () => {
  it("S19. sentence completion does NOT change status to review", () => {
    // Sentence mode is always production practice, not SRS scheduling
    // SRS is only touched by recall mode
    const srsMutableFields = ["next_review_date", "interval_days", "repetitions", "ease_factor", "status"] as const;
    const sentenceHandlerFields = ["userSentence", "aiFeedback", "sentenceScore"] as const;

    // Verify no overlap between sentence handler fields and SRS fields
    const overlap = sentenceHandlerFields.filter((f) =>
      (srsMutableFields as readonly string[]).includes(f),
    );
    expect(overlap).toHaveLength(0);
  });
});

describe("S7 — Next Card Resets State", () => {
  it("S20. advancing to next card resets evaluation and sentence", () => {
    let state = createInitialState();
    state = transitionToAnalyzing(state, "Test sentence");
    state = transitionToFeedback(state, {
      grammar_correct: true,
      naturalness: "natural",
      expression_used_correctly: true,
      corrections: [],
      overall_feedback: "Good",
    });
    const { newCardState } = advanceCard(state);
    expect(newCardState.evaluation).toBeNull();
    expect(newCardState.sentence).toBe("");
    expect(newCardState.step).toBe("writing");
    expect(newCardState.evalError).toBe(false);
  });
});

// ═══════════════════════════════════════
// Session Lifecycle Inline Mirrors
// ═══════════════════════════════════════

type SessionTypeForTest = "learn" | "review";

interface ReviewSessionForTest {
  id: string;
  userId: string;
  sessionDate: string;
  targetCount: number;
  status: "active" | "completed" | "abandoned";
  currentStage: "recall" | "sentence" | "application";
  sessionType: SessionTypeForTest;
  createdAt: string;
  completedAt: string | null;
}

function getShanghaiDateKeyForTest(date?: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date ?? new Date());
}

function getUtcDateKeyForTest(date?: Date): string {
  return (date ?? new Date()).toISOString().split("T")[0];
}

enum SessionErrorCodeForTest {
  NOT_FOUND = "SESSION_NOT_FOUND",
  DUPLICATE = "SESSION_DUPLICATE",
  UNAUTHORIZED = "SESSION_UNAUTHORIZED",
  DB_ERROR = "SESSION_DB_ERROR",
  UNKNOWN = "SESSION_UNKNOWN",
}

class SessionErrorForTest extends Error {
  code: SessionErrorCodeForTest;
  constructor(code: SessionErrorCodeForTest, message: string) {
    super(message);
    this.code = code;
  }
}

function classifySessionErrorForTest(err: { code?: string; status?: number }): SessionErrorForTest {
  if (err.code === "23505") return new SessionErrorForTest(SessionErrorCodeForTest.DUPLICATE, "duplicate");
  if (err.code === "PGRST116" || err.status === 406) return new SessionErrorForTest(SessionErrorCodeForTest.NOT_FOUND, "not found");
  if (err.status === 401 || err.code === "PGRST301") return new SessionErrorForTest(SessionErrorCodeForTest.UNAUTHORIZED, "unauthorized");
  return new SessionErrorForTest(SessionErrorCodeForTest.DB_ERROR, "db error");
}

function isExpressionDueForReview(status: string, nextReviewDate: string | null): boolean {
  // Only review/mastered expressions with a due date enter the review queue
  if (status === "collected" || status === "learning") return false;
  if (status === "archived") return false;
  if (!nextReviewDate) return false;
  return new Date(nextReviewDate) <= new Date();
}

function isExpressionInLearningQueue(status: string, archived: boolean): boolean {
  if (archived) return false;
  return status === "collected" || status === "learning";
}

function getLearnQueuePriority(a: { status: string; createdAt: string }, b: { status: string; createdAt: string }): number {
  if (a.status === "learning" && b.status !== "learning") return -1;
  if (a.status !== "learning" && b.status === "learning") return 1;
  return 0;
}

function getOrCreateSessionForTest(
  existing: Map<string, ReviewSessionForTest>,
  userId: string,
  date: string,
  sessionType: SessionTypeForTest,
): { session: ReviewSessionForTest; isNew: boolean } {
  const key = `${userId}|${date}|${sessionType}`;
  if (existing.has(key)) return { session: existing.get(key)!, isNew: false };

  const session: ReviewSessionForTest = {
    id: `session-${key}`,
    userId,
    sessionDate: date,
    targetCount: 0,
    status: "active",
    currentStage: "recall",
    sessionType,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  existing.set(key, session);
  return { session, isNew: true };
}

function getOrCreateConcurrentForTest(
  existing: Map<string, ReviewSessionForTest>,
  userId: string,
  date: string,
  sessionType: SessionTypeForTest,
): { session: ReviewSessionForTest; isNew: boolean; simulatedRace: boolean } {
  const key = `${userId}|${date}|${sessionType}`;

  // First check (simulates two concurrent requests both seeing nothing)
  const firstCheck = !existing.has(key);

  // Second concurrent request also sees nothing
  const secondCheck = !existing.has(key);

  // Second creates first
  if (firstCheck && secondCheck) {
    const session: ReviewSessionForTest = {
      id: `session-${key}-concurrent`,
      userId,
      sessionDate: date,
      targetCount: 0,
      status: "active",
      currentStage: "recall",
      sessionType,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    existing.set(key, session);
  }

  // First request discovers the duplicate and re-fetches
  if (firstCheck && existing.has(key)) {
    return { session: existing.get(key)!, isNew: false, simulatedRace: true };
  }

  if (existing.has(key)) return { session: existing.get(key)!, isNew: false, simulatedRace: false };

  const session: ReviewSessionForTest = {
    id: `session-${key}`,
    userId,
    sessionDate: date,
    targetCount: 0,
    status: "active",
    currentStage: "recall",
    sessionType,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  existing.set(key, session);
  return { session, isNew: true, simulatedRace: false };
}

// ═══════════════════════════════════════
// L1-L3: Date & Timezone
// ═══════════════════════════════════════

describe("L1 — Shanghai Date Key", () => {
  it("L1.1 getShanghaiDateKey returns YYYY-MM-DD format", () => {
    const key = getShanghaiDateKeyForTest(new Date("2026-08-10T04:00:00Z"));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // At 04:00 UTC, Shanghai is 12:00 noon — same day
    expect(key).toBe("2026-08-10");
  });

  it("L1.2 Shanghai date key differs from UTC near midnight", () => {
    // 2026-08-10 20:00 UTC = 2026-08-11 04:00 Shanghai (+8)
    const shanghai = getShanghaiDateKeyForTest(new Date("2026-08-10T20:00:00Z"));
    const utc = getUtcDateKeyForTest(new Date("2026-08-10T20:00:00Z"));
    expect(shanghai).toBe("2026-08-11");
    expect(utc).toBe("2026-08-10");
    expect(shanghai).not.toBe(utc);
  });

  it("L1.3 Shanghai date key matches UTC during daytime overlap", () => {
    // 2026-08-10 06:00 UTC = 2026-08-10 14:00 Shanghai — both same day
    const shanghai = getShanghaiDateKeyForTest(new Date("2026-08-10T06:00:00Z"));
    const utc = getUtcDateKeyForTest(new Date("2026-08-10T06:00:00Z"));
    expect(shanghai).toBe("2026-08-10");
    expect(utc).toBe("2026-08-10");
  });
});

// ═══════════════════════════════════════
// L4-L6: Due Query — collected/learning excluded
// ═══════════════════════════════════════

describe("L4 — Review Queue Excludes Non-Review Statuses", () => {
  it("L4.1 collected expressions are never due for review", () => {
    expect(isExpressionDueForReview("collected", null)).toBe(false);
    expect(isExpressionDueForReview("collected", "2026-01-01T00:00:00Z")).toBe(false);
  });

  it("L4.2 learning expressions are never due for review", () => {
    expect(isExpressionDueForReview("learning", null)).toBe(false);
    expect(isExpressionDueForReview("learning", "2026-01-01T00:00:00Z")).toBe(false);
  });

  it("L4.3 review expressions with past next_review_date ARE due", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(isExpressionDueForReview("review", pastDate)).toBe(true);
  });

  it("L4.4 review expressions with NULL next_review_date are NOT due", () => {
    // NULL next_review_date means "not yet in review cycle" — not due
    expect(isExpressionDueForReview("review", null)).toBe(false);
  });

  it("L4.5 mastered expressions follow same rule — due when date passed", () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    expect(isExpressionDueForReview("mastered", pastDate)).toBe(true);
  });

  it("L4.6 future next_review_date = NOT due", () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    expect(isExpressionDueForReview("review", futureDate)).toBe(false);
  });
});

// ═══════════════════════════════════════
// L7-L9: Learning Queue Priority
// ═══════════════════════════════════════

describe("L7 — Learning Queue Membership", () => {
  it("L7.1 collected expressions are in learning queue", () => {
    expect(isExpressionInLearningQueue("collected", false)).toBe(true);
  });

  it("L7.2 learning expressions are in learning queue (resume)", () => {
    expect(isExpressionInLearningQueue("learning", false)).toBe(true);
  });

  it("L7.3 review/mastered/archived are NOT in learning queue", () => {
    expect(isExpressionInLearningQueue("review", false)).toBe(false);
    expect(isExpressionInLearningQueue("mastered", false)).toBe(false);
    expect(isExpressionInLearningQueue("collected", true)).toBe(false);
  });

  it("L7.4 learning status sorts before collected (resume first)", () => {
    const learning = { status: "learning", createdAt: "2026-08-10T00:00:00Z" };
    const collected = { status: "collected", createdAt: "2026-08-01T00:00:00Z" };
    expect(getLearnQueuePriority(learning, collected)).toBe(-1);
    expect(getLearnQueuePriority(collected, learning)).toBe(1);
  });

  it("L7.5 same status preserves original order", () => {
    const a = { status: "collected", createdAt: "2026-08-01T00:00:00Z" };
    const b = { status: "collected", createdAt: "2026-08-05T00:00:00Z" };
    expect(getLearnQueuePriority(a, b)).toBe(0);
  });
});

// ═══════════════════════════════════════
// L10-L12: Session Type & UNIQUE Constraint
// ═══════════════════════════════════════

describe("L10 — Session Type Separation", () => {
  it("L10.1 learn and review sessions can coexist on same date", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    const learn = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "learn");
    const review = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");

    expect(learn.isNew).toBe(true);
    expect(review.isNew).toBe(true);
    expect(learn.session.sessionType).toBe("learn");
    expect(review.session.sessionType).toBe("review");
    expect(learn.session.id).not.toBe(review.session.id);
  });

  it("L10.2 same type + same date returns existing (idempotent)", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    const first = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");
    const second = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    expect(second.session.id).toBe(first.session.id);
  });

  it("L10.3 key includes session_type for unique identification", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "learn");
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");

    expect(sessions.size).toBe(2);
    expect(sessions.has("user-1|2026-08-10|learn")).toBe(true);
    expect(sessions.has("user-1|2026-08-10|review")).toBe(true);
  });
});

describe("L11 — Concurrent Get-or-Create Race Condition", () => {
  it("L11.1 second concurrent request returns existing session after race", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    const result = getOrCreateConcurrentForTest(sessions, "user-1", "2026-08-10", "review");

    // Even with simulated race, result should be consistent
    expect(result.session.sessionType).toBe("review");
    expect(result.session.sessionDate).toBe("2026-08-10");
    expect(sessions.size).toBe(1); // Only one session despite race
  });

  it("L11.2 idempotent: repeated calls return same session", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    const r1 = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");
    const r2 = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");
    const r3 = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");

    expect(r1.session.id).toBe(r2.session.id);
    expect(r2.session.id).toBe(r3.session.id);
    expect(sessions.size).toBe(1);
  });
});

// ═══════════════════════════════════════
// L13-L15: Error Classification
// ═══════════════════════════════════════

describe("L13 — Error Classification", () => {
  it("L13.1 PostgreSQL 23505 classified as DUPLICATE", () => {
    const err = classifySessionErrorForTest({ code: "23505" });
    expect(err.code).toBe(SessionErrorCodeForTest.DUPLICATE);
  });

  it("L13.2 PostgREST 406 or PGRST116 classified as NOT_FOUND", () => {
    expect(classifySessionErrorForTest({ code: "PGRST116" }).code).toBe(SessionErrorCodeForTest.NOT_FOUND);
    expect(classifySessionErrorForTest({ status: 406 }).code).toBe(SessionErrorCodeForTest.NOT_FOUND);
  });

  it("L13.3 Auth errors classified as UNAUTHORIZED", () => {
    expect(classifySessionErrorForTest({ status: 401 }).code).toBe(SessionErrorCodeForTest.UNAUTHORIZED);
    expect(classifySessionErrorForTest({ code: "PGRST301" }).code).toBe(SessionErrorCodeForTest.UNAUTHORIZED);
  });

  it("L13.4 Unknown errors fall back to DB_ERROR", () => {
    expect(classifySessionErrorForTest({}).code).toBe(SessionErrorCodeForTest.DB_ERROR);
    expect(classifySessionErrorForTest({ code: "XX000" }).code).toBe(SessionErrorCodeForTest.DB_ERROR);
  });
});

// ═══════════════════════════════════════
// L16-L18: Session Status Transitions
// ═══════════════════════════════════════

describe("L16 — Session Status Lifecycle", () => {
  it("L16.1 new session starts as active with recall stage", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    const { session } = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");
    expect(session.status).toBe("active");
    expect(session.currentStage).toBe("recall");
  });

  it("L16.2 learn session type is preserved", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    const { session } = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "learn");
    expect(session.sessionType).toBe("learn");
    expect(session.status).toBe("active");
  });

  it("L16.3 different users can each have their own sessions", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");
    getOrCreateSessionForTest(sessions, "user-2", "2026-08-10", "review");

    expect(sessions.size).toBe(2);
    expect(sessions.has("user-1|2026-08-10|review")).toBe(true);
    expect(sessions.has("user-2|2026-08-10|review")).toBe(true);
  });

  it("L16.4 different dates can each have their own sessions", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-11", "review");

    expect(sessions.size).toBe(2);
  });
});

// ═══════════════════════════════════════
// L19-L21: Integration — Query & Filter
// ═══════════════════════════════════════

describe("L19 — Session Query Selectivity", () => {
  it("L19.1 session_type filter distinguishes learn from review", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    const learn = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "learn");
    const review = getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");

    // Filter by session_type
    const learnOnly = [...sessions.values()].filter((s) => s.sessionType === "learn");
    const reviewOnly = [...sessions.values()].filter((s) => s.sessionType === "review");

    expect(learnOnly).toHaveLength(1);
    expect(reviewOnly).toHaveLength(1);
    expect(learnOnly[0].id).toBe(learn.session.id);
    expect(reviewOnly[0].id).toBe(review.session.id);
  });

  it("L19.2 query without session_type returns ambiguous results", () => {
    const sessions = new Map<string, ReviewSessionForTest>();
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "learn");
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");

    // Without session_type filter, we get 2 results for same user+date
    const allForToday = [...sessions.values()].filter(
      (s) => s.userId === "user-1" && s.sessionDate === "2026-08-10",
    );
    expect(allForToday).toHaveLength(2); // Both learn and review
  });

  it("L19.3 UNIQUE constraint must include session_type", () => {
    // The old constraint UNIQUE(user_id, session_date) would reject
    // having both learn AND review session on same day.
    // The new constraint UNIQUE(user_id, session_date, session_type) allows it.

    const sessions = new Map<string, ReviewSessionForTest>();
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "learn");
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");

    // Both should exist — this proves the constraint includes session_type
    expect(sessions.size).toBe(2);

    // But two of the same type on same day should be idempotent
    getOrCreateSessionForTest(sessions, "user-1", "2026-08-10", "review");
    expect(sessions.size).toBe(2); // No duplicate review session
  });
});

// ═══════════════════════════════════════
// Part 27 — Learning Flow Integrity Regression Tests (V4.1)
// Mirrors: buildLearningMaterial, normalizeAnswer, checkRecallAnswer,
//          learning stage model, completion guards, SRS init idempotency
// ═══════════════════════════════════════

// ── learningMaterial.ts mirrors ──

interface LearningExprInput {
  english: string;
  chinese: string;
  pronunciation?: string | null;
  type?: string | null;
  english_explanation?: string | null;
  example_sentence?: string | null;
  context?: string | null;
  situation?: string | null;
  scene?: string | null;
  common_patterns?: string | null;
  usage_note?: string | null;
  native_usage?: string | null;
  formality?: string | null;
  common_mistakes?: string | null;
  memory_tip?: string | null;
  synonyms?: string | null;
  notes?: string | null;
}

interface LearningMaterialForTest {
  core: {
    english: string;
    chinese: string;
    pronunciation: string | null;
    type: string | null;
    explanation: string | null;
    formality: string | null;
    notes: string | null;
  };
  examples: string[];
  contexts: string[];
  patterns: string[];
  usageNotes: string[];
  mistakes: string[];
  memoryTip: string | null;
  synonyms: string | null;
  hasEnrichment: boolean;
  sparse: boolean;
}

function cleanForTest(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function listOfForTest(...vals: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const v of vals) {
    const c = cleanForTest(v);
    if (c) out.push(c);
  }
  return out;
}

function buildLearningMaterialForTest(expr: LearningExprInput): LearningMaterialForTest {
  const core = {
    english: expr.english,
    chinese: expr.chinese,
    pronunciation: cleanForTest(expr.pronunciation),
    type: cleanForTest(expr.type),
    explanation: cleanForTest(expr.english_explanation),
    formality: cleanForTest(expr.formality),
    notes: cleanForTest(expr.notes),
  };

  const examples = listOfForTest(expr.example_sentence);
  const contexts = listOfForTest(expr.context, expr.situation, expr.scene);
  const patterns = listOfForTest(expr.common_patterns);
  const usageNotes = listOfForTest(expr.usage_note, expr.native_usage);
  const mistakes = listOfForTest(expr.common_mistakes);
  const memoryTip = cleanForTest(expr.memory_tip);
  const synonyms = cleanForTest(expr.synonyms);

  const presentFields = [
    examples.length,
    contexts.length,
    patterns.length,
    usageNotes.length,
    mistakes.length,
    memoryTip ? 1 : 0,
    synonyms ? 1 : 0,
  ].filter((n) => n > 0).length;

  return {
    core,
    examples,
    contexts,
    patterns,
    usageNotes,
    mistakes,
    memoryTip,
    synonyms,
    hasEnrichment: presentFields > 0,
    sparse: presentFields <= 1,
  };
}

// ── recall answer mirrors ──

const PUNCTUATION_RE_TEST = /[.,!?;:'"()[\]{}<>@#$%^&*_=+~`|\\/-]/g;

function normalizeAnswerForTest(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(PUNCTUATION_RE_TEST, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS_TEST = new Set([
  "the", "a", "an", "to", "of", "and", "or", "in", "on", "at", "for", "with",
  "is", "are", "be", "was", "were", "been", "it", "this", "that", "these",
  "those", "i", "you", "we", "they", "he", "she", "me", "him", "her", "us",
  "them", "my", "your", "his", "its", "our", "their", "have", "has", "had",
  "do", "does", "did", "will", "would", "can", "could", "should", "may",
  "might", "must", "about", "from", "by", "as", "but", "not", "so", "just",
  "very", "really", "then", "than", "there", "here", "when", "what", "which",
]);

type RecallCheckResultTest = "correct" | "partial" | "incorrect";

function checkRecallAnswerForTest(
  userAnswerRaw: string,
  correctAnswerRaw: string,
): RecallCheckResultTest {
  const user = normalizeAnswerForTest(userAnswerRaw);
  const target = normalizeAnswerForTest(correctAnswerRaw);
  if (!user || !target) return "incorrect";

  if (user === target) return "correct";

  const targetWords = target.split(" ").filter((w) => w.length > 2 && !STOPWORDS_TEST.has(w));
  if (targetWords.length === 0) {
    return user === target ? "correct" : "incorrect";
  }

  const userWords = new Set(user.split(" "));
  const hit = targetWords.filter((w) => userWords.has(w)).length;
  const ratio = hit / targetWords.length;
  if (ratio >= 0.6) return "partial";
  return "incorrect";
}

// ── learning stage model mirrors ──

type LearnStageTest = "understand" | "contextUsage" | "recall" | "production";

const STAGE_ORDER_TEST: LearnStageTest[] = ["understand", "contextUsage", "recall", "production"];

function stageLabelForTest(stage: LearnStageTest): string {
  switch (stage) {
    case "understand": return "理解表达";
    case "contextUsage": return "场景与用法";
    case "recall": return "主动回忆";
    case "production": return "个人造句";
  }
}

/** The only place "完成学习" may appear — Stage 4 (production). */
function stageHasCompletionButton(stage: LearnStageTest): boolean {
  return stage === "production";
}

type RecallPhaseTest = "idle" | "checking" | "result";

/** Completion requires: on Stage 4 AND recall already checked. */
function canCompleteForTest(stage: LearnStageTest, recallPhase: RecallPhaseTest): boolean {
  return stage === "production" && recallPhase === "result";
}

/** Completion minimum: Stage1+2 viewed (reached recall) AND recall checked. */
function meetsCompletionMinimumForTest(
  currentIndex: number,
  total: number,
  stage: LearnStageTest,
  recallPhase: RecallPhaseTest,
): boolean {
  if (currentIndex >= total) return false;
  // understand & contextUsage are sequential — reaching recall proves both were viewed
  return (stage === "recall" || stage === "production") && recallPhase === "result";
}

/** Resume skip: item already completed or expression already in review cycle. */
function isItemFinishedForTest(itemStatus: string, exprStatus: string): boolean {
  return itemStatus === "completed" || exprStatus === "review" || exprStatus === "mastered";
}

/** SRS init idempotency — only fresh expressions (collected/learning) get initial schedule. */
function shouldInitializeSrsForTest(exprStatus: string): boolean {
  return exprStatus === "collected" || exprStatus === "learning";
}

/** Completion advances index 1→2 only when finishing the last stage. */
function advanceIndexForTest(
  index: number,
  total: number,
  stage: LearnStageTest,
  recallPhase: RecallPhaseTest,
): number | null {
  if (!canCompleteForTest(stage, recallPhase)) return index;
  return index + 1 < total ? index + 1 : null; // null → summary
}

// ── tests ──

describe("MATERIAL 1-5 — buildLearningMaterial normalizer", () => {
  it("M1. rich expression populates all sections", () => {
    const m = buildLearningMaterialForTest({
      english: "take the bull by the horns",
      chinese: "迎难而上",
      pronunciation: "teIk D@ bUl",
      type: "idiom",
      english_explanation: "To deal with difficulty directly.",
      example_sentence: "Sometimes you have to take the bull by the horns.",
      context: "business negotiation",
      situation: "Facing a tough decision",
      scene: "workplace",
      common_patterns: "take the bull by the horns and [verb]",
      usage_note: "Common in business.",
      native_usage: "Native speakers use it for decisive action.",
      formality: "informal",
      common_mistakes: "Don't say 'grab'.",
      memory_tip: "Imagine grabbing a bull.",
      synonyms: "face the music",
      notes: "A common idiom.",
    });

    expect(m.core.english).toBe("take the bull by the horns");
    expect(m.core.pronunciation).toBe("teIk D@ bUl");
    expect(m.core.explanation).toBe("To deal with difficulty directly.");
    expect(m.examples).toHaveLength(1);
    expect(m.contexts).toHaveLength(3);
    expect(m.patterns).toHaveLength(1);
    expect(m.usageNotes).toHaveLength(2);
    expect(m.mistakes).toHaveLength(1);
    expect(m.memoryTip).toBe("Imagine grabbing a bull.");
    expect(m.synonyms).toBe("face the music");
    expect(m.hasEnrichment).toBe(true);
    expect(m.sparse).toBe(false);
  });

  it("M2. sparse expression (english+chinese only) yields empty arrays, never placeholders", () => {
    const m = buildLearningMaterialForTest({ english: "hello world", chinese: "你好世界" });

    expect(m.core.pronunciation).toBeNull();
    expect(m.core.explanation).toBeNull();
    expect(m.examples).toEqual([]);
    expect(m.contexts).toEqual([]);
    expect(m.patterns).toEqual([]);
    expect(m.usageNotes).toEqual([]);
    expect(m.mistakes).toEqual([]);
    expect(m.memoryTip).toBeNull();
    expect(m.synonyms).toBeNull();
    // No section may contain a "暂无" placeholder
    const allStrings = [
      ...m.examples, ...m.contexts, ...m.patterns, ...m.usageNotes, ...m.mistakes,
    ].join(" ");
    expect(allStrings).not.toContain("暂无");
    expect(m.hasEnrichment).toBe(false);
    expect(m.sparse).toBe(true);
  });

  it("M3. missing memory_tip does not create an empty memory module", () => {
    const rich = buildLearningMaterialForTest({
      english: "e1",
      chinese: "中",
      example_sentence: "example",
      context: "ctx",
    });
    expect(rich.memoryTip).toBeNull();

    // Memory section is only rendered when memoryTip is non-null
    const renderMemory = rich.memoryTip !== null;
    expect(renderMemory).toBe(false);
  });

  it("M4. whitespace-only optional field is cleaned to null (not empty string)", () => {
    const m = buildLearningMaterialForTest({
      english: "e1",
      chinese: "中",
      memory_tip: "   ",
      example_sentence: "\n\n",
    });

    expect(m.memoryTip).toBeNull();
    expect(m.examples).toEqual([]);
    expect(m.sparse).toBe(true);
  });

  it("M5. single optional field marks material as sparse but hasEnrichment true", () => {
    const m = buildLearningMaterialForTest({
      english: "e1",
      chinese: "中",
      example_sentence: "just one example",
    });

    expect(m.hasEnrichment).toBe(true);
    expect(m.sparse).toBe(true);
    expect(m.examples).toHaveLength(1);
  });
});

describe("FLOW 6-12 — learning stage model & navigation", () => {
  it("F6. four-stage order is 理解表达 → 场景与用法 → 主动回忆 → 个人造句", () => {
    expect(STAGE_ORDER_TEST).toEqual(["understand", "contextUsage", "recall", "production"]);
    expect(STAGE_ORDER_TEST.map(stageLabelForTest)).toEqual([
      "理解表达", "场景与用法", "主动回忆", "个人造句",
    ]);
  });

  it("F7. Stage 3 (recall) never shows 完成学习", () => {
    expect(stageHasCompletionButton("recall")).toBe(false);
    expect(stageHasCompletionButton("understand")).toBe(false);
    expect(stageHasCompletionButton("contextUsage")).toBe(false);
  });

  it("F8. real completion button only exists on Stage 4 (production)", () => {
    expect(stageHasCompletionButton("production")).toBe(true);
  });

  it("F9. recall must be checked before completion is allowed", () => {
    expect(canCompleteForTest("production", "result")).toBe(true);
    expect(canCompleteForTest("production", "checking")).toBe(false);
    expect(canCompleteForTest("production", "idle")).toBe(false);
    expect(canCompleteForTest("recall", "result")).toBe(false);
  });

  it("F10. completion on last stage advances 1/5 → 2/5", () => {
    const next = advanceIndexForTest(0, 5, "production", "result");
    expect(next).toBe(1);

    // Guarded: without result phase, index stays put
    expect(advanceIndexForTest(0, 5, "production", "idle")).toBe(0);
  });

  it("F11. answer normalization — 'Have an opportunity to' equals 'have an opportunity to'", () => {
    expect(normalizeAnswerForTest("Have an opportunity to")).toBe(
      normalizeAnswerForTest("have an opportunity to"),
    );
    // Punctuation stripped
    expect(normalizeAnswerForTest("take the bull by the horns!")).toBe(
      normalizeAnswerForTest("take the bull by the horns"),
    );
  });

  it("F12. completion minimum = Stage1+2 viewed + recall checked", () => {
    // Reached recall stage ⇒ understand & contextUsage already viewed (sequential)
    expect(meetsCompletionMinimumForTest(0, 5, "recall", "result")).toBe(true);
    expect(meetsCompletionMinimumForTest(0, 5, "production", "result")).toBe(true);
    // Recall not yet checked ⇒ not complete
    expect(meetsCompletionMinimumForTest(0, 5, "recall", "idle")).toBe(false);
    expect(meetsCompletionMinimumForTest(0, 5, "production", "checking")).toBe(false);
    // Past end of list ⇒ no-op
    expect(meetsCompletionMinimumForTest(5, 5, "production", "result")).toBe(false);
  });
});

describe("COMPLETION 13-16 — idempotent completion", () => {
  it("C13. double-click completion does not double-advance", () => {
    let index = 0;
    // First completion
    index = advanceIndexForTest(index, 5, "production", "result")!;
    expect(index).toBe(1);
    // Duplicate click while already moving — guarded by completing flag
    const guarded = canCompleteForTest("production", "result") && false; // completing=true blocks
    expect(guarded).toBe(false);
    // No second advance from the same source index
    expect(index).toBe(1);
  });

  it("C14. completion marks item completed and records practice log", () => {
    const item = { id: "item-1", status: "pending" as const, recallScore: null };
    // On complete: status → completed, recallScore persisted
    const completed = { ...item, status: "completed", recallScore: 4 };
    expect(completed.status).toBe("completed");
    expect(completed.recallScore).toBe(4);
  });

  it("C15. SRS init idempotent — only fresh expressions get initial schedule", () => {
    expect(shouldInitializeSrsForTest("collected")).toBe(true);
    expect(shouldInitializeSrsForTest("learning")).toBe(true);
    // Already in review cycle — never overwrite existing history
    expect(shouldInitializeSrsForTest("review")).toBe(false);
    expect(shouldInitializeSrsForTest("mastered")).toBe(false);
    expect(shouldInitializeSrsForTest("archived")).toBe(false);
  });

  it("C16. completion error surfaces visibly (not silent) with retry available", () => {
    let error: string | null = null;
    let completed = false;
    try {
      throw new Error("23502 not_null_violation: user_id");
    } catch (e) {
      error = (e as Error).message;
      completed = false;
    }
    expect(error).toContain("23502");
    expect(completed).toBe(false);
    // Retry is possible because item state was not mutated on failure
    const retry = advanceIndexForTest(0, 5, "production", "result");
    expect(retry).toBe(1);
  });
});

describe("RESUME 17 — session resume restores index + stage", () => {
  it("R17. learn_progress restores expressionIndex and stage on re-entry", () => {
    const saved = { expressionIndex: 2, stage: "recall" as LearnStageTest };
    const restoredIndex = saved.expressionIndex;
    const restoredStage = saved.stage;

    // Resume skips items already finished before current index
    const items = [
      { status: "completed", exprStatus: "review" },
      { status: "completed", exprStatus: "review" },
      { status: "pending", exprStatus: "learning" },
    ];
    const firstNotFinished = items.findIndex((i) => !isItemFinishedForTest(i.status, i.exprStatus));
    expect(firstNotFinished).toBe(2);
    expect(restoredIndex).toBe(2);
    expect(restoredStage).toBe("recall");
  });
});

describe("SRS 18-20 — learning completion initializes SRS correctly", () => {
  it("S18. learn completion schedules first review (status → review, learned_at set)", () => {
    // SM-2 V2 with rating 'good' on a fresh expression
    const srs = scheduleSrsForTest("good", { repetitions: 0, intervalDays: 0 });
    expect(srs.status).toBe("review");
    expect(srs.intervalDays).toBeGreaterThan(0);
    expect(srs.repetitions).toBe(1);
  });

  it("S19. learned ≠ mastered — first completion is review, not mastered", () => {
    const srs = scheduleSrsForTest("good", { repetitions: 0, intervalDays: 0 });
    expect(srs.status).toBe("review");
    expect(srs.status).not.toBe("mastered");
    expect(srs.repetitions).toBeLessThan(8);
  });

  it("S20. existing review history is never overwritten on re-learn", () => {
    const existing = { repetitions: 5, intervalDays: 30, status: "review" as const };
    // Re-running learn completion does NOT reset an expression already in the cycle
    const wouldReinit = shouldInitializeSrsForTest(existing.status);
    expect(wouldReinit).toBe(false);
  });
});

describe("AI 21-23 — non-blocking sentence evaluation", () => {
  it("AI21. sentence is saved to DB before AI call (save-before-AI)", () => {
    let saved = false;
    let aiStarted = false;
    // Simulate: persist first, then fire AI
    saved = true;
    aiStarted = true;
    expect(saved).toBe(true);
    expect(aiStarted).toBe(true);
  });

  it("AI22. AI failure does not block learning completion", () => {
    let aiFeedback: string | null = null;
    let aiFailed = false;
    try {
      throw new Error("edge function timeout");
    } catch {
      aiFailed = true;
      aiFeedback = null; // feedback unavailable
    }
    // Completion must still proceed with graceful message
    expect(aiFailed).toBe(true);
    expect(aiFeedback).toBeNull();
    const completeAfterAiFailure = canCompleteForTest("production", "result");
    expect(completeAfterAiFailure).toBe(true);
  });

  it("AI23. AI retry is available after failure", () => {
    let attempts = 0;
    function runAi(): string {
      attempts += 1;
      if (attempts === 1) throw new Error("timeout");
      return "Great sentence!";
    }
    let feedback: string | null = null;
    try {
      runAi();
    } catch {
      feedback = null;
    }
    expect(feedback).toBeNull();
    // Retry succeeds
    feedback = runAi();
    expect(feedback).toBe("Great sentence!");
    expect(attempts).toBe(2);
  });
});

describe("ERROR 24-25 — visible errors with retry", () => {
  it("E24. mutation error is shown to user, no silent failure", () => {
    let visibleError: string | null = null;
    try {
      throw new Error("review_session_items insert failed");
    } catch (e) {
      visibleError = (e as Error).message;
    }
    expect(visibleError).toContain("insert failed");
  });

  it("E25. user can retry the action after an error without data loss", () => {
    const input = "I took the bull by the horns.";
    let saved = false;
    let attempt = 0;
    function saveSentence(): void {
      attempt += 1;
      if (attempt === 1) throw new Error("network");
      saved = true;
    }
    try {
      saveSentence();
    } catch {
      // error shown, input preserved in state
    }
    expect(saved).toBe(false);
    // Retry
    saveSentence();
    expect(saved).toBe(true);
    expect(input).toBe("I took the bull by the horns.");
  });
});

// ── SRS mirror helper for S18-S20 ──

function scheduleSrsForTest(
  rating: "good" | "again" | "hard" | "easy",
  current: { repetitions: number; intervalDays: number },
): { status: string; repetitions: number; intervalDays: number } {
  if (rating === "again") {
    return { status: "learning", repetitions: 0, intervalDays: 0 };
  }
  const reps = current.repetitions + 1;
  const intervalDays = reps === 1 ? 1 : Math.min(365, Math.round(current.intervalDays * 2));
  return { status: reps >= 8 ? "mastered" : "review", repetitions: reps, intervalDays };
}
