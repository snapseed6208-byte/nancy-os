import { buildCombinedFeedback, type SpeakingFeedback } from "../ai/englishCoach";
import { normalizeSpeakingFeedback, speakingFeedbackStorage, type SpeakingStructureStep, type SpeakingTakeaway } from "./speakingFeedback";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

export interface ReanalyzeInput {
  question: string;
  targets: string[];
  questionContext: { mode?: string; topic?: string; part?: string; scenario?: string };
}

/** Re-analysis replays the stored material, so the transcript is a hard requirement. Voice-only
 *  saves put a placeholder in `answer`; that is never a transcript. Empty means "cannot re-run". */
export function reanalyzeTranscript(row: unknown): string {
  const r = obj(row);
  const transcribed = str(r.transcribed_text);
  if (transcribed) return transcribed;
  const answer = str(r.answer);
  return /^\[Voice recording/i.test(answer) ? "" : answer;
}

/** Rebuild the original call's inputs from what the session and its linked question actually stored. */
export function buildReanalyzeInput(
  session: Record<string, unknown>,
  question?: unknown,
): ReanalyzeInput {
  const q = obj(question);
  const recommended = Array.isArray(session.recommended_expressions) ? session.recommended_expressions : [];
  return {
    question: str(session.prompt),
    targets: recommended.map(e => str(obj(e).english)).filter(Boolean),
    questionContext: {
      mode: str(session.category) || str(session.mode) || undefined,
      topic: str(q.topic) || undefined,
      part: str(q.part) || undefined,
      scenario: str(session.context) || str(session.scenario) || undefined,
    },
  };
}

export interface RetryContext {
  final_upgraded_answer: string;
  originalAnswer: string;
  takeaway_expressions: SpeakingTakeaway[];
  answer_structure: SpeakingStructureStep[];
}

/** A retry round is measured against the first round's answer, which stays the immutable target.
 *  Without it a retry row must not be re-analysed, or it would silently grow a new "best" answer. */
export function buildRetryContext(firstRow: Record<string, unknown> | undefined): RetryContext | null {
  if (!firstRow) return null;
  const first = normalizeSpeakingFeedback(firstRow);
  if (!first.final_upgraded_answer) return null;
  return {
    final_upgraded_answer: first.final_upgraded_answer,
    originalAnswer: reanalyzeTranscript(firstRow),
    takeaway_expressions: first.takeaway_expressions,
    answer_structure: first.answer_structure,
  };
}

/** In-place update payload. Only feedback-derived columns are rewritten: the transcript, audio,
 *  round identity and retry linkage belong to the original recording and are never touched. */
export function reanalyzedAttemptPayload(feedback: SpeakingFeedback): Record<string, unknown> {
  return {
    combined_feedback: buildCombinedFeedback(feedback),
    fluency_score: feedback.fluencyScore ?? null,
    grammar_score: feedback.grammarScore ?? null,
    vocabulary_score: feedback.vocabularyScore ?? null,
    naturalness_score: feedback.naturalnessScore ?? null,
    main_problems: feedback.mainProblems || null,
    useful_corrections: feedback.usefulCorrections || null,
    expressions_used: feedback.expressionsUsed || [],
    expressions_missed: feedback.expressionsMissed || [],
    ...speakingFeedbackStorage(feedback),
  };
}
