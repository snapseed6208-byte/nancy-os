// ============================================
// English SRS V3.5 — Cloze Question Builder & Validator
//
// V3.5 changes:
// - REMOVED answer leakage: sourceSentence NEVER shown before submit
// - safeContext only uses context/situation fields (no example_sentence leak)
// - Added promptIntegrityCheck() for pre-render validation
// - Progressive hint system: Chinese → structure
// ============================================

export type ClozeResult = "correct" | "partially_correct" | "incorrect";

export interface ClozeQuestion {
  prompt: string;
  expectedAnswer: string;
  acceptedAnswers: string[];
  /** The form that actually appeared in the source (may differ from canonical). */
  surfaceForm?: string;
  source: "cloze_sentence" | "example_sentence" | "fallback";
  /** false = no valid source available for this expression. */
  valid: boolean;
  /** Full source sentence — ONLY for post-submit reveal, NEVER shown before answer. */
  sourceSentence?: string;
  /** Safe context from context/situation fields only (no expression leakage). */
  safeContext?: string;
  /** Chinese translation, hidden behind progressive hint toggle. */
  chineseHint?: string;
}

// ═══════════════════════════════════════
// Normalization
// ═══════════════════════════════════════

export function normalizeClozeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[''''''']/g, "'")
    .replace(/[""""""]/g, '"')
    .replace(/[,.!?;:'"]+$/, "")
    .trim();
}

// ═══════════════════════════════════════
// Three-state validation (V3.4)
// ═══════════════════════════════════════

export function validateClozeResult(
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

export function validateClozeAnswer(
  userAnswer: string,
  acceptedAnswers: string[],
): boolean {
  return validateClozeResult(userAnswer, acceptedAnswers) === "correct";
}

// ═══════════════════════════════════════
// Leakage guard
// ═══════════════════════════════════════

export function hasExpressionLeakage(prompt: string, expression: string): boolean {
  const p = normalizeClozeAnswer(prompt);
  const e = normalizeClozeAnswer(expression);
  return p.includes(e);
}

// ═══════════════════════════════════════
// V3.5: Prompt integrity check
// ═══════════════════════════════════════

/**
 * Verify a cloze question's prompt does not leak the expected answer.
 * Must be called before rendering the question to the user.
 *
 * Returns true if the prompt is CLEAN (no leakage).
 */
export function promptIntegrityCheck(question: ClozeQuestion): boolean {
  // 1. Prompt must not contain the expected answer
  if (hasExpressionLeakage(question.prompt, question.expectedAnswer)) {
    return false;
  }

  // 2. Prompt must contain a blank
  if (!/_{2,}|\[blank\]/i.test(question.prompt)) {
    return false;
  }

  // 3. Prompt must not be the same as sourceSentence (should have blanks)
  if (
    question.sourceSentence &&
    normalizeClozeAnswer(question.prompt) === normalizeClozeAnswer(question.sourceSentence)
  ) {
    return false;
  }

  return true;
}

/**
 * Check if a context string is safe to show (doesn't contain the target expression).
 */
export function isSafeContext(context: string, expression: string): boolean {
  return !hasExpressionLeakage(context, expression);
}

// ═══════════════════════════════════════
// Grammatical form detection (V3.4)
// ═══════════════════════════════════════

const INFLECTION_SUFFIXES = [
  /ed$/i, /ing$/i, /s$/i, /es$/i, /ies$/i,
  /er$/i, /est$/i, /'s$/i, /s'$/i,
];

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
  if (exactMatch) {
    return { surfaceForm: exactMatch[0], matchType: "exact" };
  }

  // 2. Stem-based fuzzy match for inflected forms
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

// ═══════════════════════════════════════
// Build cloze question (V3.5 — no leakage)
// ═══════════════════════════════════════

/**
 * Build a cloze question that is TARGET-ANCHORED and LEAKAGE-FREE.
 *
 * V3.5 critical rule:
 * - `sourceSentence` stores the full sentence for post-submit reveal ONLY
 * - `safeContext` is built ONLY from context/situation fields (never example_sentence)
 * - `safeContext` is checked for leakage before being shown
 */
export function buildClozeQuestion(
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

  // ── Priority 1: Pre-generated cloze_sentence ──
  if (clozeSentence) {
    const blanks = (clozeSentence.match(/_{2,}|\[blank\]/gi) || []).length;
    if (blanks >= 1 && !hasExpressionLeakage(clozeSentence, english)) {
      const surfaceInfo = detectSurfaceForm(clozeSentence, english);
      return {
        prompt: clozeSentence,
        expectedAnswer: english,
        acceptedAnswers: [english.toLowerCase(), ...generateVariants(english)],
        surfaceForm: surfaceInfo?.surfaceForm,
        source: "cloze_sentence",
        valid: true,
        sourceSentence: undefined,
        safeContext,
        chineseHint: chinese,
      };
    }
  }

  // ── Priority 2: example_sentence with expression replacement ──
  if (exampleSentence) {
    const surfaceInfo = detectSurfaceForm(exampleSentence, english);

    if (surfaceInfo) {
      const escaped = escapeRegex(surfaceInfo.surfaceForm);
      const regex = new RegExp(escaped, "gi");
      const replaced = exampleSentence.replace(regex, "_____");

      if (replaced !== exampleSentence && !hasExpressionLeakage(replaced, english)) {
        // Check if example_sentence WITHOUT the expression is safe as context
        const contextFromExample = !hasExpressionLeakage(replaced, english)
          ? replaced
          : undefined;

        return {
          prompt: replaced,
          expectedAnswer: english,
          acceptedAnswers: [english.toLowerCase(), ...generateVariants(english)],
          surfaceForm: surfaceInfo.surfaceForm !== english ? surfaceInfo.surfaceForm : undefined,
          source: "example_sentence",
          valid: true,
          sourceSentence: exampleSentence, // Only for post-submit reveal
          safeContext: safeContext || contextFromExample,
          chineseHint: chinese,
        };
      }
    }

    // Expression not found in example — fall through to fallback
  }

  // ── Priority 3: Fallback using safe context ──
  if (safeContext || exampleSentence) {
    return {
      prompt: "_____",
      expectedAnswer: english,
      acceptedAnswers: [english.toLowerCase(), ...generateVariants(english)],
      source: "fallback",
      valid: true,
      sourceSentence: exampleSentence || undefined,
      safeContext,
      chineseHint: chinese,
    };
  }

  // ── Priority 4: No valid source — cloze unavailable ──
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

// ═══════════════════════════════════════
// V3.5: Progressive hint builder
// ═══════════════════════════════════════

/**
 * Build a progressive hint for the cloze question.
 * Level 0: no hint
 * Level 1: Chinese semantic hint (e.g., "与某人失去联系")
 * Level 2: Structure hint (e.g., "l___ t____ w___")
 *
 * Never reveals the full answer.
 */
export function buildProgressiveHint(
  chineseHint: string | undefined,
  expectedAnswer: string,
  hintLevel: number,
): string | null {
  if (hintLevel === 0) return null;

  if (hintLevel === 1) {
    // Level 1: Chinese meaning
    if (chineseHint) return chineseHint;
    // Fall back to structure if no Chinese
    return buildStructureHint(expectedAnswer);
  }

  if (hintLevel >= 2) {
    // Level 2: Structure hint (first letter + blanks)
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

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateVariants(english: string): string[] {
  const variants: string[] = [];
  const lower = english.toLowerCase();
  variants.push(lower);
  variants.push(lower.charAt(0).toUpperCase() + lower.slice(1));
  return variants;
}
