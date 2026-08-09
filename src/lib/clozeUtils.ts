// ============================================
// English SRS V3.4 — Cloze Question Builder & Validator
//
// V3.4 changes:
// - Three-state result: correct | partially_correct | incorrect
// - Target-anchored cloze only (blank must be target expression)
// - Grammatical form awareness (surface form detection)
// - Source validation (cloze_unavailable when no valid source)
// - Scenario/context for contextual activation
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
  /** Context / scenario for display as primary hint (V3.4 contextual activation). */
  scenario?: string;
  /** Chinese translation, hidden behind toggle. */
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
    .replace(/['‘’‚‛′‵]/g, "'")
    .replace(/[""„‟″‶]/g, '"')
    .replace(/[,.!?;:'"]+$/, "")
    .trim();
}

// ═══════════════════════════════════════
// Three-state validation (V3.4)
// ═══════════════════════════════════════

/**
 * Validate a cloze answer with three-state result.
 *
 * - `correct`: exact match with an accepted answer (canonical form)
 * - `partially_correct`: matches the surface form but not canonical
 *   (e.g., user typed "soaked" but canonical is "soak")
 * - `incorrect`: no match
 */
export function validateClozeResult(
  userAnswer: string,
  acceptedAnswers: string[],
  surfaceForm?: string,
): ClozeResult {
  if (!userAnswer.trim()) return "incorrect";

  const normalized = normalizeClozeAnswer(userAnswer);
  if (!normalized) return "incorrect";

  // Exact match with canonical accepted answers → correct
  if (acceptedAnswers.some((a) => normalizeClozeAnswer(a) === normalized)) {
    return "correct";
  }

  // Match with surface form (right expression, wrong grammatical form)
  if (surfaceForm && normalizeClozeAnswer(surfaceForm) === normalized) {
    return "partially_correct";
  }

  return "incorrect";
}

/**
 * Legacy boolean validator — wraps validateClozeResult.
 * Returns true only for "correct" results.
 */
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
// Grammatical form detection (V3.4)
// ═══════════════════════════════════════

/**
 * Common inflection suffixes to strip for stem comparison.
 */
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

/**
 * Try to find the expression (possibly inflected) in a sentence.
 * Returns the matched surface form and match type, or null.
 */
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
  const exactRegex = new RegExp(`\\b${escaped}\\b`, "gi");
  const exactMatch = exactRegex.exec(sentence);
  if (exactMatch) {
    return { surfaceForm: exactMatch[0], matchType: "exact" };
  }

  // 2. Stem-based fuzzy match for inflected forms
  // Slide a window of exprWords.length over sentWords
  for (let start = 0; start <= sentWords.length - exprWords.length; start++) {
    let allMatch = true;
    for (let j = 0; j < exprWords.length; j++) {
      const sentWord = sentWords[start + j];
      const exprWord = exprWords[j];

      // Exact word match OR same stem
      if (sentWord.toLowerCase() === exprWord.toLowerCase()) continue;

      const sentStem = toStem(sentWord);
      const exprStem = toStem(exprWord);
      if (sentStem === exprStem) continue;

      // Special: common small words must match exactly
      const isSmallWord = ["a", "an", "the", "in", "on", "at", "to", "of", "for", "by", "up", "out", "off", "my"].includes(exprWord.toLowerCase());
      if (isSmallWord) {
        allMatch = false;
        break;
      }

      // Allow one-word fuzzy for longer expressions
      allMatch = false;
      break;
    }
    if (allMatch) {
      const surfaceForm = sentWords.slice(start, start + exprWords.length).join(" ");
      return { surfaceForm, matchType: "inflected" };
    }
  }

  return null;
}

// ═══════════════════════════════════════
// Build cloze question (V3.4 target-anchored)
// ═══════════════════════════════════════

/**
 * Build a cloze question that is TARGET-ANCHORED:
 * the blank is always the target expression (canonical or inflected form).
 *
 * Priority:
 * 1. Pre-generated cloze_sentence (validated for blanks + no leakage)
 * 2. example_sentence with expression replacement (exact or inflected)
 * 3. Fallback using scenario/context
 * 4. Mark as invalid if no source available
 */
export function buildClozeQuestion(
  english: string,
  chinese: string,
  clozeSentence?: string | null,
  exampleSentence?: string | null,
  context?: string | null,
  situation?: string | null,
): ClozeQuestion {
  // Build scenario text from context/situation fields
  const scenario = [context, situation].filter(Boolean).join(" · ") || undefined;

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
        scenario,
        chineseHint: chinese,
      };
    }
    // Invalid cloze_sentence (leakage or no blanks) — fall through
  }

  // ── Priority 2: example_sentence with expression replacement ──
  if (exampleSentence) {
    const surfaceInfo = detectSurfaceForm(exampleSentence, english);

    if (surfaceInfo) {
      const escaped = escapeRegex(surfaceInfo.surfaceForm);
      const regex = new RegExp(escaped, "gi");
      const replaced = exampleSentence.replace(regex, "_____");

      if (replaced !== exampleSentence && !hasExpressionLeakage(replaced, english)) {
        return {
          prompt: replaced,
          expectedAnswer: english,
          acceptedAnswers: [english.toLowerCase(), ...generateVariants(english)],
          surfaceForm: surfaceInfo.surfaceForm !== english ? surfaceInfo.surfaceForm : undefined,
          source: "example_sentence",
          valid: true,
          scenario: scenario || exampleSentence,
          chineseHint: chinese,
        };
      }
    }

    // Expression not found in example — source not valid for target-anchored cloze
    // Fall through to fallback
  }

  // ── Priority 3: Fallback using scenario/context ──
  if (scenario || exampleSentence) {
    const ctx = scenario || exampleSentence!.slice(0, 80);
    return {
      prompt: `_____`,
      expectedAnswer: english,
      acceptedAnswers: [english.toLowerCase(), ...generateVariants(english)],
      source: "fallback",
      valid: true,
      scenario: ctx,
      chineseHint: chinese,
    };
  }

  // ── Priority 4: No valid source — cloze unavailable ──
  return {
    prompt: `_____`,
    expectedAnswer: english,
    acceptedAnswers: [english.toLowerCase()],
    source: "fallback",
    valid: false,
    scenario: undefined,
    chineseHint: chinese,
  };
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
  // Capitalize first letter variant
  variants.push(lower.charAt(0).toUpperCase() + lower.slice(1));
  return variants;
}
