// ============================================
// English SRS V3.6 — Sentence Feedback Parser
//
// Normalizes ai_feedback from review_session_items
// so History/Review/Learn pages can render clean
// human-readable feedback instead of raw JSON.
// ============================================

import { parseSentenceEvaluation, type PersonalSentenceEvaluation } from "@/lib/english/sentenceEvaluation";

interface LegacySentenceEvaluation {
  grammar_correct?: boolean;
  naturalness?: string;
  corrections?: Array<{ original?: string; corrected?: string; explanation?: string }>;
  overall_feedback?: string;
  expression_used_correctly?: boolean;
  example_usage?: string;
}

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
  minimalRevision: string | null;
  naturalVersion: string | null;
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
  // Incomplete legacy data is unknown, never implicitly successful.
  if (grammarOk === null || expressionUsedCorrectly === null || naturalness === null) {
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

  if (naturalness === "slightly_unnatural" && grammarOk && expressionUsedCorrectly) {
    return { status: "acceptable", statusLabel: "基本正确，可以更自然", statusIcon: "delta" };
  }

  if (naturalness === "natural" && grammarOk && expressionUsedCorrectly) {
    return { status: "natural", statusLabel: "自然正确", statusIcon: "check" };
  }

  return { status: "unknown", statusLabel: "分析状态未知", statusIcon: "dash" };
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
  let parsed: Record<string, unknown> | null = null;

  // Type A: already an object
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    parsed = raw as Record<string, unknown>;
  }

  // Type B: JSON string
  if (typeof raw === "string") {
    try {
      const result = JSON.parse(raw);
      if (typeof result === "object" && result !== null && !Array.isArray(result)) {
        parsed = result as Record<string, unknown>;
      }
    } catch {
      // Type C/D: plain text or malformed JSON
    }
  }

  // V2 feedback: validate before display and map to the stable history shape.
  if (parsed && "verdict" in parsed) {
    try {
      const evaluation: PersonalSentenceEvaluation = parseSentenceEvaluation(parsed);
      const status: FeedbackStatus = evaluation.verdict === "needs_revision" ? "needs_work" : evaluation.verdict;
      const statusInfo = status === "natural"
        ? { status, statusLabel: "自然正确", statusIcon: "check" as const }
        : status === "acceptable"
          ? { status, statusLabel: "基本正确，可以更自然", statusIcon: "delta" as const }
          : { status, statusLabel: "需要修改", statusIcon: "alert" as const };
      const corrections = evaluation.grammar.issues.map((issue) => ({
        original: issue.original,
        corrected: issue.correction,
        explanation: issue.explanation,
      }));
      return {
        ...statusInfo,
        grammarOk: evaluation.grammar.correct,
        expressionUsedCorrectly: evaluation.expression_used_correctly,
        naturalness: evaluation.naturalness.level,
        overallFeedback: evaluation.feedback,
        corrections,
        betterSentence: evaluation.natural_version || evaluation.minimal_revision || null,
        minimalRevision: evaluation.minimal_revision || null,
        naturalVersion: evaluation.natural_version || null,
        hasDetailedFeedback: corrections.length > 0 || Boolean(evaluation.minimal_revision || evaluation.natural_version),
        raw,
      };
    } catch {
      // Invalid V2 payloads remain unknown; they must never become green.
    }
  }

  // Legacy feedback remains readable but requires complete core fields.
  const legacy = parsed as LegacySentenceEvaluation | null;
  if (legacy && (legacy.grammar_correct !== undefined || legacy.naturalness !== undefined)) {
    const grammarOk = typeof legacy.grammar_correct === "boolean" ? legacy.grammar_correct : null;
    const exprOk = typeof legacy.expression_used_correctly === "boolean" ? legacy.expression_used_correctly : null;
    const naturalness = typeof legacy.naturalness === "string" ? legacy.naturalness : null;
    const overallFeedback = typeof legacy.overall_feedback === "string" ? legacy.overall_feedback : null;
    const exampleUsage = typeof legacy.example_usage === "string" ? legacy.example_usage : null;

    const corrections: ParsedSentenceFeedback["corrections"] = Array.isArray(legacy.corrections)
      ? legacy.corrections.filter(
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
      minimalRevision: corrections[0]?.corrected || null,
      naturalVersion: exampleUsage,
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
    minimalRevision: null,
    naturalVersion: null,
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
