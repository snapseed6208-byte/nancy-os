/** Speaking-only contract. Legacy answer names are read here, never generated. */
export type RevisionMode = "light" | "structure" | "expand" | "trim" | "rewrite";
export interface SimplifiedSpeakingFeedback {
  overall_score: number | null;
  target_score: number | null;
  key_issues: { type: string; message: string }[];
  revision_mode: RevisionMode | null;
  optimization_summary: string;
  final_upgraded_answer: string;
  reference_answer: string;
  expansion_notice: string;
  takeaway_expressions: { expression: string; meaning: string; why_useful: string }[];
  detailed_analysis: Record<string, unknown>;
  retry_checks: { type: string; message: string }[];
}

export function speakingObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
const str = (v: unknown) => typeof v === "string" ? v.trim() : "";
const first = (...values: unknown[]) => values.map(str).find(Boolean) || "";
const items = (v: unknown) => Array.isArray(v) ? v.map(speakingObject) : [];
const score = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 9 ? v : null;

export function normalizeSpeakingFeedback(value: unknown): SimplifiedSpeakingFeedback {
  const row = speakingObject(value);
  const content = speakingObject(row.content_analysis);
  const canonical = speakingObject(content.feedback_v2);
  const raw = { ...row, ...canonical };
  const details = speakingObject(raw.detailed_analysis);
  const scores = ["fluency", "grammar", "vocabulary", "naturalness"].map(k =>
    score(details[`${k}Score`] ?? raw[`${k}Score`] ?? raw[`${k}_score`])).filter((v): v is number => v !== null);
  const issues = items(raw.key_issues).filter(i => str(i.message)).map(i => ({ type: str(i.type), message: str(i.message) })).slice(0, 3);
  if (!issues.length) {
    const legacy = first(raw.mainProblems, raw.main_problems);
    if (legacy) issues.push(...legacy.split(/\n+/).filter(Boolean).slice(0, 3).map(message => ({ type: "", message })));
  }
  const final = first(raw.final_upgraded_answer, raw.high_score_version, raw.finalHighScoreAnswer,
    raw.structured_better_answer, raw.structuredBetterAnswer, raw.optimized_version, raw.optimizedVersion,
    raw.natural_version, raw.naturalVersion);
  const takeaways = items(raw.takeaway_expressions ?? raw.key_upgrades ?? raw.keyUpgrades)
    .map(i => ({ expression: first(i.expression, i.english), meaning: first(i.meaning, i.chinese), why_useful: first(i.why_useful, i.reason) }))
    .filter(i => i.expression && final.toLowerCase().includes(i.expression.toLowerCase()))
    .filter((i, n, all) => all.findIndex(a => a.expression.toLowerCase() === i.expression.toLowerCase()) === n).slice(0, 4);
  return {
    overall_score: score(raw.overall_score) ?? (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 2) / 2 : null),
    target_score: score(raw.target_score),
    key_issues: issues,
    revision_mode: ["light", "structure", "expand", "trim", "rewrite"].includes(str(raw.revision_mode)) ? raw.revision_mode as RevisionMode : null,
    optimization_summary: first(raw.optimization_summary, raw.diagnosis, content.summary),
    final_upgraded_answer: final,
    reference_answer: first(raw.reference_answer, raw.referenceAnswer, raw.one_better_example, raw.oneBetterExample),
    expansion_notice: str(raw.expansion_notice),
    takeaway_expressions: takeaways,
    detailed_analysis: Object.keys(details).length ? details : { ...content,
      fluencyScore: raw.fluencyScore ?? raw.fluency_score,
      grammarScore: raw.grammarScore ?? raw.grammar_score,
      vocabularyScore: raw.vocabularyScore ?? raw.vocabulary_score,
      naturalnessScore: raw.naturalnessScore ?? raw.naturalness_score },
    retry_checks: items(raw.retry_checks).filter(i => str(i.message)).map(i => ({ type: str(i.type), message: str(i.message) })).slice(0, 4),
  };
}

/** Recover a complete primary string even if optional trailing JSON is truncated. */
export function parseSpeakingResponse(content: string): SimplifiedSpeakingFeedback {
  try {
    const start = content.indexOf("{");
    return normalizeSpeakingFeedback(JSON.parse(content.slice(start, content.lastIndexOf("}") + 1)));
  } catch {
    const match = content.match(/"final_upgraded_answer"\s*:\s*("(?:[^"\\]|\\.)*")/);
    if (match) {
      try { return normalizeSpeakingFeedback({ final_upgraded_answer: JSON.parse(match[1]) }); } catch { /* no complete answer */ }
    }
    return normalizeSpeakingFeedback({});
  }
}

/** Preserve existing columns and put the complete new contract in existing JSONB. */
export function speakingFeedbackStorage(feedback: SimplifiedSpeakingFeedback): {
  content_analysis: Record<string, unknown> & { feedback_v2: SimplifiedSpeakingFeedback };
  structured_better_answer: string | null;
  reference_answer: string | null;
  diagnosis: string | null;
} {
  return {
    content_analysis: { ...speakingObject(feedback.detailed_analysis.contentAnalysis), feedback_v2: feedback },
    structured_better_answer: feedback.final_upgraded_answer || null,
    reference_answer: feedback.reference_answer || null,
    diagnosis: feedback.optimization_summary || null,
  };
}
