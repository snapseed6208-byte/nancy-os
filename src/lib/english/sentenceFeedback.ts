// ============================================
// English SRS V3.6 — Sentence Feedback Parser
//
// Normalizes ai_feedback from review_session_items
// so History/Review/Learn pages can render clean
// human-readable feedback instead of raw JSON.
// ============================================

import type { PersonalSentenceEvaluation } from "@/lib/ai/englishCoach";

// ── Parsed feedback ──

export interface ParsedSentenceFeedback {
  /** Human-readable status label */
  status: "natural" | "acceptable" | "needs_work" | "unknown";
  statusLabel: string;        // e.g. "表达自然"
  statusIcon: "check" | "delta" | "alert" | "dash";
  grammarOk: boolean | null;
  expressionUsedCorrectly: boolean | null;
  naturalness: string | null;
  overallFeedback: string | null;
  corrections: Array<{ original: string; corrected: string; explanation: string }>;
  betterSentence: string | null;  // derived from corrections or example_usage
  hasDetailedFeedback: boolean;  // true when corrections.length > 0
  raw: unknown;                   // original raw value for debugging
}

// ── Status derivation ──

export type FeedbackStatus = ParsedSentenceFeedback["status"];
export type FeedbackStatusIcon = ParsedSentenceFeedback["statusIcon"];

function deriveStatus(
  grammarOk: boolean | null,
  expressionUsedCorrectly: boolean | null,
  naturalness: string | null,
): { status: FeedbackStatus; statusLabel: string; statusIcon: FeedbackStatusIcon } {
  // No data at all
  if (grammarOk === null && naturalness === null) {
    return { status: "unknown", statusLabel: "暂无反馈", statusIcon: "dash" };
  }

  // grammar_correct === false OR expression_used_correctly === false → needs_work
  if (grammarOk === false || expressionUsedCorrectly === false) {
    return { status: "needs_work", statusLabel: "需要修改", statusIcon: "alert" };
  }

  // grammar OK but not fully natural
  if (naturalness === "awkward" || naturalness === "incorrect") {
    return { status: "needs_work", statusLabel: "需要修改", statusIcon: "alert" };
  }

  if (naturalness === "slightly_unnatural") {
    return { status: "acceptable", statusLabel: "可以更自然", statusIcon: "delta" };
  }

  // grammar OK + natural → natural
  return { status: "natural", statusLabel: "表达自然", statusIcon: "check" };
}

// ── Better sentence extraction ──

function deriveBetterSentence(
  corrections: ParsedSentenceFeedback["corrections"],
  exampleUsage: string | undefined | null,
): string | null {
  // Priority 1: first correction's corrected form
  if (corrections.length > 0 && corrections[0].corrected) {
    return corrections[0].corrected;
  }

  // Priority 2: example_usage (AI-provided example)
  if (exampleUsage && exampleUsage.trim()) {
    return exampleUsage.trim();
  }

  return null;
}

// ── Main parse function ──

export function parseSentenceFeedback(
  raw: unknown,
): ParsedSentenceFeedback {
  let parsed: Partial<PersonalSentenceEvaluation> | null = null;

  // Type A: already an object
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    parsed = raw as PersonalSentenceEvaluation;
  }

  // Type B: JSON string
  if (typeof raw === "string") {
    try {
      const result = JSON.parse(raw);
      if (typeof result === "object" && result !== null && !Array.isArray(result)) {
        parsed = result as PersonalSentenceEvaluation;
      }
    } catch {
      // Type C/D: plain text or malformed JSON
    }
  }

  // If we got a valid parsed object
  if (parsed && (parsed.grammar_correct !== undefined || parsed.naturalness !== undefined)) {
    const grammarOk = typeof parsed.grammar_correct === "boolean" ? parsed.grammar_correct : null;
    const exprOk = typeof parsed.expression_used_correctly === "boolean" ? parsed.expression_used_correctly : null;
    const naturalness = typeof parsed.naturalness === "string" ? parsed.naturalness : null;
    const overallFeedback = typeof parsed.overall_feedback === "string" ? parsed.overall_feedback : null;
    const exampleUsage = typeof parsed.example_usage === "string" ? parsed.example_usage : null;

    const corrections: ParsedSentenceFeedback["corrections"] = Array.isArray(parsed.corrections)
      ? parsed.corrections.filter(
          (c): c is { original: string; corrected: string; explanation: string } =>
            typeof c === "object" && c !== null &&
            typeof (c as Record<string, unknown>).explanation === "string",
        )
      : [];

    const statusInfo = deriveStatus(grammarOk, exprOk, naturalness);
    const betterSentence = deriveBetterSentence(corrections, exampleUsage);

    return {
      ...statusInfo,
      grammarOk,
      expressionUsedCorrectly: exprOk,
      naturalness,
      overallFeedback,
      corrections,
      betterSentence,
      hasDetailedFeedback: corrections.length > 0,
      raw,
    };
  }

  // Fallback: plain text feedback (Type C/D)
  const textFallback = typeof raw === "string" && raw.trim()
    ? raw.trim()
    : null;

  return {
    status: textFallback ? "unknown" : "unknown",
    statusLabel: textFallback ? "历史反馈" : "暂无反馈",
    statusIcon: "dash",
    grammarOk: null,
    expressionUsedCorrectly: null,
    naturalness: null,
    overallFeedback: textFallback,
    corrections: [],
    betterSentence: null,
    hasDetailedFeedback: false,
    raw,
  };
}

// ── Convenience helpers ──

export function getFeedbackStatus(raw: unknown): FeedbackStatus {
  return parseSentenceFeedback(raw).status;
}

export function getBetterSentence(raw: unknown): string | null {
  return parseSentenceFeedback(raw).betterSentence;
}
