// ============================================
// English Review V3.3 — Cloze Eligibility Engine
//
// Pre-computes which expressions in the Daily
// Review Set can produce a viable Context Cloze
// question. Ineligible expressions are excluded
// from the Cloze queue BEFORE the user sees a card.
//
// The 4 priority sources:
//   P1: stored cloze_sentence (DB or AI-generated)
//   P2: example_sentence containing the target expression
//   P3: context/situation fields (for AI generation)
//   P4: unavailable (no safe prompt source)
// ============================================

import { hasExpressionLeakage, detectSurfaceForm } from "@/lib/clozeUtils";

export type ClozeSource =
  | "stored_cloze"
  | "example_sentence"
  | "generated_context"
  | "unavailable";

export interface ClozeEligibility {
  eligible: boolean;
  source: ClozeSource;
  scenario: string | null;
  fullSentence: string | null;
  maskedSentence: string | null;
  answer: string;
  reason?: string;
}

/**
 * Determine whether the given expression data can produce a viable cloze question.
 *
 * This is a PURE function — no AI calls, no DB.  AI generation happens upstream
 * (see EnglishReviewV3.tsx AI batch effect) and its results fill `aiClozeSentence`.
 */
export function buildClozeEligibility(
  english: string,
  chinese: string,
  clozeSentence?: string | null,
  exampleSentence?: string | null,
  context?: string | null,
  situation?: string | null,
  aiClozeSentence?: string | null,
): ClozeEligibility {
  // ── P1: stored cloze_sentence ──
  const stored = clozeSentence || aiClozeSentence || null;
  if (stored) {
    const blanks = (stored.match(/_{2,}|\[blank\]/gi) || []).length;
    if (blanks >= 1 && !hasExpressionLeakage(stored, english)) {
      const scene = [context, situation].filter(Boolean).join(" · ") || null;
      return {
        eligible: true,
        source: "stored_cloze",
        scenario: scene,
        fullSentence: stored,
        maskedSentence: stored,
        answer: english,
      };
    }
  }

  // Build safe scenario from context/situation only
  const scenario = [context, situation].filter(Boolean).join(" · ") || null;

  // ── P2: example_sentence containing the target ──
  if (exampleSentence) {
    const surfaceInfo = detectSurfaceForm(exampleSentence, english);
    if (surfaceInfo) {
      // Verify mask is clean (only replaces the target)
      const escaped = escapeRegexForElig(surfaceInfo.surfaceForm);
      const regex = new RegExp(escaped, "gi");
      const masked = exampleSentence.replace(regex, "_____");
      if (masked !== exampleSentence && !hasExpressionLeakage(masked, english)) {
        return {
          eligible: true,
          source: "example_sentence",
          scenario,
          fullSentence: exampleSentence,
          maskedSentence: masked,
          answer: english,
        };
      }
    }
  }

  // ── P3: context available but no stored/example — AI generation slot ──
  // The caller needs to flag this so the AI generation effect can fill it.
  if (scenario || context || situation) {
    return {
      eligible: false,
      source: "generated_context",
      scenario,
      fullSentence: null,
      maskedSentence: null,
      answer: english,
      reason: "needs_ai_generation",
    };
  }

  // ── P4: unavailable ──
  return {
    eligible: false,
    source: "unavailable",
    scenario: null,
    fullSentence: null,
    maskedSentence: null,
    answer: english,
    reason: "no_source_material",
  };
}

/**
 * Filter the full daily-set items to the cloze-eligible subset.
 * Items are returned in the same relative order as the original set.
 */
export function computeClozeEligibleQueue(
  items: Array<{
    id: string;
    expression?: {
      english: string;
      chinese?: string | null;
      cloze_sentence?: string | null;
      example_sentence?: string | null;
      context?: string | null;
      situation?: string | null;
    } | null;
  }>,
  aiClozeMap?: Map<string, string>,
): { eligibleIds: string[]; unavailableIds: string[]; eligibilityMap: Map<string, ClozeEligibility> } {
  const eligibleIds: string[] = [];
  const unavailableIds: string[] = [];
  const eligibilityMap = new Map<string, ClozeEligibility>();

  for (const item of items) {
    const expr = item.expression;
    if (!expr) {
      unavailableIds.push(item.id);
      continue;
    }

    const aiGenerated = aiClozeMap?.get(expr.english);
    const eligibility = buildClozeEligibility(
      expr.english,
      expr.chinese || "",
      expr.cloze_sentence,
      expr.example_sentence,
      expr.context,
      expr.situation,
      aiGenerated || null,
    );

    eligibilityMap.set(item.id, eligibility);

    if (eligibility.eligible) {
      eligibleIds.push(item.id);
    } else {
      unavailableIds.push(item.id);
    }
  }

  return { eligibleIds, unavailableIds, eligibilityMap };
}

function escapeRegexForElig(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
