// ============================================
// English SRS V3.4 — Context Cloze Generation Engine
//
// Every expression in the Daily Review Set MUST have
// a ContextClozeCard. Missing materials → AI generation.
// No skip. No auto-complete. No "unavailable".
//
// Three priority levels:
//   L1: stored_cloze (DB cloze_sentence or ai_cloze_sentence)
//   L2: example_sentence (deterministic masking)
//   L3: ai_generated (AI context generation)
// ============================================

import { hasExpressionLeakage, detectSurfaceForm } from "@/lib/clozeUtils";

// ── Types ──

export interface ContextClozeCard {
  expression_id: string;
  canonical_expression: string;
  answer_form: string;
  accepted_answers: string[];
  scenario_zh: string;
  sentence_full: string;
  sentence_masked: string;
  explanation_zh: string;
  semantic_hint_zh: string;
  form_hint: string | null;
  source: "stored_cloze" | "example_sentence" | "ai_generated";
  quality_version: string;
}

export type ClozeGenerationSource = "stored_cloze" | "example_sentence" | "ai_generated";

export interface ClozePrepState {
  /** Total expressions to prepare */
  total: number;
  /** Number of cards prepared so far */
  prepared: number;
  /** Cards ready for practice */
  cards: Map<string, ContextClozeCard>;
  /** IDs that still need generation */
  pendingIds: string[];
  /** Current phase */
  phase: "loading" | "generating" | "ready" | "error";
  /** Error message (only for infrastructure failures) */
  error?: string;
}

// ── Material input for generation ──

export interface ClozeGenerationMaterial {
  expression_id: string;
  english: string;
  chinese: string;
  type?: string;
  example_sentence?: string | null;
  usage_note?: string | null;
  native_usage?: string | null;
  context?: string | null;
  situation?: string | null;
  common_patterns?: string | null;
  cloze_sentence?: string | null;
  ai_cloze_sentence?: string | null;
}

// ── Quality version ──

const QUALITY_VERSION = "v3.4.0";

// ═══════════════════════════════════════
// L1: Stored cloze validation
// ═══════════════════════════════════════

function tryStoredCloze(material: ClozeGenerationMaterial): ContextClozeCard | null {
  const stored = material.cloze_sentence || material.ai_cloze_sentence || null;
  if (!stored) return null;

  const blanks = (stored.match(/_{2,}|\[blank\]/gi) || []).length;
  if (blanks < 1) return null;
  if (hasExpressionLeakage(stored, material.english)) return null;

  const scenario = [material.context, material.situation].filter(Boolean).join(" · ") || "语境填空";

  // Fill in the blank with the expression for sentence_full
  const sentenceFull = stored.replace(/_{2,}|\[blank\]/gi, material.english);

  return {
    expression_id: material.expression_id,
    canonical_expression: material.english,
    answer_form: material.english,
    accepted_answers: [material.english.toLowerCase()],
    scenario_zh: scenario,
    sentence_full: sentenceFull,
    sentence_masked: stored,
    explanation_zh: `填入表达 "${material.english}"（${material.chinese}）`,
    semantic_hint_zh: material.chinese,
    form_hint: buildFormHint(material.english),
    source: "stored_cloze",
    quality_version: QUALITY_VERSION,
  };
}

// ═══════════════════════════════════════
// L2: Example sentence deterministic masking
// ═══════════════════════════════════════

function tryExampleSentence(material: ClozeGenerationMaterial): ContextClozeCard | null {
  const example = material.example_sentence;
  if (!example) return null;

  const surfaceInfo = detectSurfaceForm(example, material.english);
  if (!surfaceInfo) return null;

  const answerForm = surfaceInfo.surfaceForm;
  const masked = maskTargetExpression(example, answerForm);

  // Must have changed (expression was actually found and replaced)
  if (masked === example) return null;
  // Must not leak the expression
  if (hasExpressionLeakage(masked, material.english)) return null;

  const scenario = [material.context, material.situation].filter(Boolean).join(" · ") || "语境填空";

  return {
    expression_id: material.expression_id,
    canonical_expression: material.english,
    answer_form: answerForm,
    accepted_answers: [answerForm.toLowerCase(), material.english.toLowerCase()],
    scenario_zh: scenario,
    sentence_full: example,
    sentence_masked: masked,
    explanation_zh: `在语境中使用 "${answerForm}"（原形: ${material.english}）`,
    semantic_hint_zh: material.chinese,
    form_hint: answerForm !== material.english ? buildFormHint(answerForm) : null,
    source: "example_sentence",
    quality_version: QUALITY_VERSION,
  };
}

// ═══════════════════════════════════════
// L3: AI generation input builder
// ═══════════════════════════════════════

export function buildAIClozeInput(material: ClozeGenerationMaterial) {
  return {
    expression_id: material.expression_id,
    english: material.english,
    chinese: material.chinese,
    type: material.type || undefined,
    example_sentence: material.example_sentence || undefined,
    usage_note: material.usage_note || undefined,
    native_usage: material.native_usage || undefined,
    context: material.context || undefined,
    situation: material.situation || undefined,
    common_patterns: material.common_patterns || undefined,
  };
}

// ═══════════════════════════════════════
// AI card builder (from AI response JSON)
// ═══════════════════════════════════════

export interface AIGeneratedClozeData {
  scenario_zh: string;
  sentence_full: string;
  answer_form: string;
  explanation_zh: string;
  semantic_hint_zh: string;
}

export function buildCardFromAIResponse(
  material: ClozeGenerationMaterial,
  aiData: AIGeneratedClozeData,
): ContextClozeCard {
  const masked = maskTargetExpression(aiData.sentence_full, aiData.answer_form);

  return {
    expression_id: material.expression_id,
    canonical_expression: material.english,
    answer_form: aiData.answer_form,
    accepted_answers: [
      aiData.answer_form.toLowerCase(),
      material.english.toLowerCase(),
    ],
    scenario_zh: aiData.scenario_zh,
    sentence_full: aiData.sentence_full,
    sentence_masked: masked,
    explanation_zh: aiData.explanation_zh,
    semantic_hint_zh: aiData.semantic_hint_zh,
    form_hint: aiData.answer_form !== material.english
      ? buildFormHint(aiData.answer_form)
      : null,
    source: "ai_generated",
    quality_version: QUALITY_VERSION,
  };
}

// ═══════════════════════════════════════
// Programmatic masking
// ═══════════════════════════════════════

export function maskTargetExpression(sentence: string, targetForm: string): string {
  const escaped = escapeRegex(targetForm);
  const regex = new RegExp(escaped, "gi");
  return sentence.replace(regex, "______");
}

// ═══════════════════════════════════════
// Validation
// ═══════════════════════════════════════

export interface ClozeValidationResult {
  valid: boolean;
  reasons: string[];
}

export function validateContextClozeCard(card: ContextClozeCard): ClozeValidationResult {
  const reasons: string[] = [];

  if (!card.scenario_zh || !card.scenario_zh.trim()) {
    reasons.push("scenario_zh is empty");
  }
  if (!card.sentence_full || !card.sentence_full.trim()) {
    reasons.push("sentence_full is empty");
  }
  if (!card.answer_form || !card.answer_form.trim()) {
    reasons.push("answer_form is empty");
  }

  // Check sentence_full contains answer_form (case-insensitive)
  const sentenceNorm = card.sentence_full.toLowerCase();
  const answerNorm = card.answer_form.toLowerCase();
  if (!sentenceNorm.includes(answerNorm)) {
    reasons.push(`sentence_full does not contain answer_form: "${card.answer_form}"`);
  }

  // Check scenario doesn't leak the expression (approximate check)
  const exprWords = card.canonical_expression.toLowerCase().split(/\s+/);
  const scenarioWords = card.scenario_zh.toLowerCase();
  if (exprWords.length >= 2 && scenarioWords.includes(card.canonical_expression.toLowerCase())) {
    reasons.push("scenario_zh appears to contain the target expression");
  }

  // Check masked sentence doesn't contain answer_form
  if (card.sentence_masked.toLowerCase().includes(answerNorm)) {
    reasons.push("sentence_masked still contains answer_form");
  }

  // Check masked sentence has at least one blank (any 2+ underscores or [blank])
  if (!/_{2,}|\[blank\]/i.test(card.sentence_masked)) {
    reasons.push("sentence_masked has no blank");
  }

  // Check for ambiguous answers
  if (card.accepted_answers.length === 0) {
    reasons.push("no accepted answers");
  }

  return { valid: reasons.length === 0, reasons };
}

export function validateAIData(
  aiData: Partial<AIGeneratedClozeData>,
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!aiData.scenario_zh || !aiData.scenario_zh.trim()) {
    reasons.push("scenario_zh missing");
  }
  if (!aiData.sentence_full || !aiData.sentence_full.trim()) {
    reasons.push("sentence_full missing");
  }
  if (!aiData.answer_form || !aiData.answer_form.trim()) {
    reasons.push("answer_form missing");
  }
  if (!aiData.explanation_zh || !aiData.explanation_zh.trim()) {
    reasons.push("explanation_zh missing");
  }
  if (!aiData.semantic_hint_zh || !aiData.semantic_hint_zh.trim()) {
    reasons.push("semantic_hint_zh missing");
  }

  if (reasons.length === 0 && aiData.sentence_full && aiData.answer_form) {
    if (!aiData.sentence_full.toLowerCase().includes(aiData.answer_form.toLowerCase())) {
      reasons.push("sentence_full does not contain answer_form");
    }
  }

  return { valid: reasons.length === 0, reasons };
}

// ═══════════════════════════════════════
// Prep engine: classify materials by source
// ═══════════════════════════════════════

export function classifyMaterials(
  materials: ClozeGenerationMaterial[],
): {
  ready: ClozeGenerationMaterial[];       // L1/L2 — have immediate source
  needsAI: ClozeGenerationMaterial[];      // L3 — needs AI generation
} {
  const ready: ClozeGenerationMaterial[] = [];
  const needsAI: ClozeGenerationMaterial[] = [];

  for (const m of materials) {
    // Try L1
    if (m.cloze_sentence || m.ai_cloze_sentence) {
      const card = tryStoredCloze(m);
      if (card) {
        ready.push(m);
        continue;
      }
    }

    // Try L2
    if (m.example_sentence && detectSurfaceForm(m.example_sentence, m.english)) {
      ready.push(m);
      continue;
    }

    // L3: needs AI
    needsAI.push(m);
  }

  return { ready, needsAI };
}

// ═══════════════════════════════════════
// Full card builder (all sources)
// ═══════════════════════════════════════

export function buildCard(material: ClozeGenerationMaterial, aiData?: AIGeneratedClozeData | null): ContextClozeCard {
  // L1
  const stored = tryStoredCloze(material);
  if (stored) return stored;

  // L2
  const example = tryExampleSentence(material);
  if (example) return example;

  // L3
  if (aiData) {
    return buildCardFromAIResponse(material, aiData);
  }

  // Should never reach here in V3.4 — caller must provide AI data
  throw new Error(`No cloze source for: ${material.english}. AI data must be provided.`);
}

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFormHint(answer: string): string | null {
  const words = answer.split(/\s+/);
  return words
    .map((w) => w.charAt(0) + "_".repeat(Math.max(1, w.length - 1)))
    .join(" ");
}
