// ============================================
// English SRS V4 — Learning Material Normalizer
//
// Single source of truth for learning UI content.
// Every learning stage consumes normalized material,
// never raw DB fields with per-step null checks.
// ============================================

export interface LearningExpressionInput {
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

export interface LearningMaterialCore {
  english: string;
  chinese: string;
  pronunciation: string | null;
  type: string | null;
  explanation: string | null;
  formality: string | null;
  notes: string | null;
}

export interface LearningMaterial {
  core: LearningMaterialCore;
  examples: string[];
  contexts: string[];
  patterns: string[];
  usageNotes: string[];
  mistakes: string[];
  memoryTip: string | null;
  synonyms: string | null;
  hasEnrichment: boolean;
  /** true when enrichment is very thin — UI may show a one-line note */
  sparse: boolean;
}

function clean(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

function listOf(...vals: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const v of vals) {
    const c = clean(v);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Normalize a raw expression row into structured learning material.
 * Optional fields that are missing become empty arrays / null — never
 * placeholder strings like "暂无". The UI hides empty sections.
 */
export function buildLearningMaterial(expr: LearningExpressionInput): LearningMaterial {
  const core: LearningMaterialCore = {
    english: expr.english,
    chinese: expr.chinese,
    pronunciation: clean(expr.pronunciation),
    type: clean(expr.type),
    explanation: clean(expr.english_explanation),
    formality: clean(expr.formality),
    notes: clean(expr.notes),
  };

  const examples = listOf(expr.example_sentence);
  const contexts = listOf(expr.context, expr.situation, expr.scene);
  const patterns = listOf(expr.common_patterns);
  const usageNotes = listOf(expr.usage_note, expr.native_usage);
  const mistakes = listOf(expr.common_mistakes);
  const memoryTip = clean(expr.memory_tip);
  const synonyms = clean(expr.synonyms);

  const presentFields = [
    examples.length,
    contexts.length,
    patterns.length,
    usageNotes.length,
    mistakes.length,
    memoryTip ? 1 : 0,
    synonyms ? 1 : 0,
  ].filter((n) => n > 0).length;

  const hasEnrichment = presentFields > 0;
  const sparse = presentFields <= 1;

  return {
    core,
    examples,
    contexts,
    patterns,
    usageNotes,
    mistakes,
    memoryTip,
    synonyms,
    hasEnrichment,
    sparse,
  };
}

// ═══════════════════════════════════════
// Recall answer normalization (Part 9)
// ═══════════════════════════════════════

const PUNCTUATION_RE = /[.,!?;:'"()[\]{}<>@#$%^&*_=+~`|\\/-]/g;

/** trim, lowercase, collapse whitespace, strip basic punctuation */
export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(PUNCTUATION_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "the", "a", "an", "to", "of", "and", "or", "in", "on", "at", "for", "with",
  "is", "are", "be", "was", "were", "been", "it", "this", "that", "these",
  "those", "i", "you", "we", "they", "he", "she", "me", "him", "her", "us",
  "them", "my", "your", "his", "its", "our", "their", "have", "has", "had",
  "do", "does", "did", "will", "would", "can", "could", "should", "may",
  "might", "must", "about", "from", "by", "as", "but", "not", "so", "just",
  "very", "really", "then", "than", "there", "here", "when", "what", "which",
]);

export type RecallCheckResult = "correct" | "partial" | "incorrect";

/**
 * Compare a user recall answer against the target expression.
 * - exact (normalized) match → correct
 * - ≥60% of content words present → partial
 * - otherwise → incorrect
 */
export function checkRecallAnswer(
  userAnswerRaw: string,
  correctAnswerRaw: string,
): RecallCheckResult {
  const user = normalizeAnswer(userAnswerRaw);
  const target = normalizeAnswer(correctAnswerRaw);
  if (!user || !target) return "incorrect";

  if (user === target) return "correct";

  const targetWords = target.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
  if (targetWords.length === 0) {
    // No content words (e.g. very short expression) — fall back to whole match
    return user === target ? "correct" : "incorrect";
  }

  const userWords = new Set(user.split(" "));
  const hit = targetWords.filter((w) => userWords.has(w)).length;
  const ratio = hit / targetWords.length;
  if (ratio >= 0.6) return "partial";
  return "incorrect";
}
