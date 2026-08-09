// ============================================
// English SRS V3.3 — Cloze Question Builder & Validator
// ============================================

export interface ClozeQuestion {
  prompt: string;
  expectedAnswer: string;
  acceptedAnswers: string[];
  source: "cloze_sentence" | "example_sentence" | "fallback";
  valid: boolean;
}

/**
 * Normalize user input for cloze comparison.
 * - lowercase, trim, collapse whitespace
 * - normalize apostrophes
 * - remove trailing punctuation
 */
export function normalizeClozeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[‘’‚‛′‵]/g, "'")
    .replace(/[“”„‟″‶]/g, '"')
    .replace(/[,.!?;:'"]+$/, "")
    .trim();
}

/**
 * Validate a cloze answer against accepted answers.
 * Returns true only if normalized input exactly matches a normalized accepted answer.
 */
export function validateClozeAnswer(
  userAnswer: string,
  acceptedAnswers: string[],
): boolean {
  if (!userAnswer.trim()) return false;

  const normalized = normalizeClozeAnswer(userAnswer);
  if (!normalized) return false;

  return acceptedAnswers.some(
    (a) => normalizeClozeAnswer(a) === normalized,
  );
}

/**
 * Check if a prompt still contains the full target expression (leakage guard).
 */
export function hasExpressionLeakage(prompt: string, expression: string): boolean {
  const p = normalizeClozeAnswer(prompt);
  const e = normalizeClozeAnswer(expression);
  return p.includes(e);
}

/**
 * Build a cloze question with expected answer and validation.
 *
 * Priority:
 * 1. Pre-generated cloze_sentence (with validation)
 * 2. example_sentence with expression replacement
 * 3. Fallback using expression words
 */
export function buildClozeQuestion(
  english: string,
  chinese: string,
  clozeSentence?: string | null,
  exampleSentence?: string | null,
): ClozeQuestion {
  // ── Priority 1: Pre-generated cloze_sentence ──
  if (clozeSentence) {
    const blanks = (clozeSentence.match(/_{2,}|\[blank\]/gi) || []).length;
    if (blanks >= 1) {
      // Check if we can derive the expected answer
      // The cloze sentence should blank out the expression
      const escaped = escapeRegex(english);
      const clueText = clozeSentence.replace(/_{2,}|\[blank\]/gi, escaped);
      // Try to see if the clue text matches the original expression pattern
      const hasLeak = hasExpressionLeakage(clozeSentence, english);
      if (!hasLeak) {
        return {
          prompt: clozeSentence,
          expectedAnswer: english,
          acceptedAnswers: [english, ...generateVariants(english)],
          source: "cloze_sentence",
          valid: true,
        };
      }
      // Leakage detected, fall through to example
    }
    // No blanks or leakage — fall through
  }

  // ── Priority 2: example_sentence with expression replacement ──
  if (exampleSentence) {
    const escaped = escapeRegex(english);
    const regex = new RegExp(escaped, "gi");
    const replaced = exampleSentence.replace(regex, "_____");
    if (replaced !== exampleSentence) {
      // Verify no leakage
      if (!hasExpressionLeakage(replaced, english)) {
        return {
          prompt: replaced,
          expectedAnswer: english,
          acceptedAnswers: [english, ...generateVariants(english)],
          source: "example_sentence",
          valid: true,
        };
      }
    }

    // Expression not directly in example — try blanking a phrase
    const words = exampleSentence.split(/\s+/);
    if (words.length >= 6) {
      const start = Math.floor(words.length * 0.3);
      const end = Math.min(words.length, start + 3);
      const parts = [...words];
      for (let i = start; i < end; i++) parts[i] = "_____";
      const prompt = parts.join(" ");
      if (!hasExpressionLeakage(prompt, english)) {
        // When blanking arbitrary words, the expected answer is the original words
        const expectedWords = words.slice(start, end).join(" ");
        return {
          prompt,
          expectedAnswer: expectedWords,
          acceptedAnswers: [expectedWords],
          source: "example_sentence",
          valid: true,
        };
      }
    }
  }

  // ── Priority 3: Fallback — blank the expression itself ──
  const exprWords = english.split(/\s+/);
  if (exprWords.length >= 2) {
    const mid = Math.floor(exprWords.length / 2);
    const parts = [...exprWords];
    parts[mid] = "_____";
    const prompt = parts.join(" ");
    if (!hasExpressionLeakage(prompt, english)) {
      return {
        prompt,
        expectedAnswer: exprWords[mid],
        acceptedAnswers: [exprWords[mid]],
        source: "fallback",
        valid: true,
      };
    }
  }

  // ── Absolute fallback ──
  return {
    prompt: `_____ (${chinese})`,
    expectedAnswer: english,
    acceptedAnswers: [english],
    source: "fallback",
    valid: true,
  };
}

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
