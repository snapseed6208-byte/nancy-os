/** Speaking-only contract. Legacy answer names are read here, never generated. */
export type RevisionMode = "light" | "structure" | "expand" | "trim" | "rewrite";

export type CorrectionCategory =
  | "grammar"
  | "collocation"
  | "word_choice"
  | "naturalness"
  | "sentence_structure"
  | "expression_upgrade"
  | "";

export interface SpeakingCorrection {
  original: string;
  corrected: string;
  category: CorrectionCategory;
  explanation_zh: string;
}

export interface SpeakingStructureStep {
  /** Optional machine-readable key (legacy answerStructure used step). */
  step?: string;
  label: string;
  content: string;
}

export interface SpeakingTakeaway {
  expression: string;
  /** Chinese meaning (normalized read key; maps meaning_zh / meaning / chinese). */
  meaning: string;
  meaning_zh?: string;
  why_useful: string;
  example?: string;
  usage_note?: string;
  /** Legacy keyUpgrade items are read-only highlights, not bank-addable. */
  readonly?: boolean;
}

export interface SimplifiedSpeakingFeedback {
  overall_score: number | null;
  target_score: number | null;
  key_issues: { type: string; message: string }[];
  revision_mode: RevisionMode | null;
  optimization_summary: string;
  final_upgraded_answer: string;
  reference_answer: string;
  /** One-line Chinese note describing the independent angle of reference_answer. */
  reference_angle_summary: string;
  expansion_notice: string;
  takeaway_expressions: SpeakingTakeaway[];
  /** Structured corrections — quote exact original phrases. */
  corrections: SpeakingCorrection[];
  /** Skeleton of logic nodes, NOT a copy of the final answer. */
  answer_structure: SpeakingStructureStep[];
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

const CORRECTION_CATEGORIES = new Set(["grammar", "collocation", "word_choice", "naturalness", "sentence_structure", "expression_upgrade"]);

function mapCorrections(raw: Record<string, unknown>): SpeakingCorrection[] {
  const arr = items(raw.corrections)
    .map(i => ({
      original: first(i.original, i.from, i.quote),
      corrected: first(i.corrected, i.to, i.better, i.replacement),
      category: (() => {
        const c = str(i.category);
        return CORRECTION_CATEGORIES.has(c) ? c as CorrectionCategory : "";
      })(),
      explanation_zh: first(i.explanation_zh, i.explanation, i.why, i.reason),
    }))
    .filter(i => i.original || i.corrected)
    .filter((i, n, all) => all.findIndex(a =>
      a.original.toLowerCase() === i.original.toLowerCase() && a.corrected.toLowerCase() === i.corrected.toLowerCase()
    ) === n);
  if (arr.length) return arr.slice(0, 5);
  // Legacy free-text usefulCorrections → structured items (read-only fallback).
  const text = first(raw.usefulCorrections, raw.useful_corrections, raw.detailed_analysis && (speakingObject(raw.detailed_analysis).usefulCorrections as unknown));
  const parsed = parseLegacyCorrections(text);
  return parsed.length ? parsed.slice(0, 5) : [];
}

/** Parse old "original → corrected (中文)" / "- "original" -> "better" (中文)" strings. */
export function parseLegacyCorrections(text: string): SpeakingCorrection[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.replace(/^[-•\s]+/, "")).map(l => l.trim()).filter(Boolean);
  const out: SpeakingCorrection[] = [];
  for (const line of lines) {
    // Quoted or bare phrases around an arrow.
    const m = line.match(/^["“”]?([^"“”→\->]+?)["“”]?\s*(?:→|->|=>)\s*["“”]?([^"“”()（]+?)["“”]?\s*(?:[\(（]\s*([^)）]*)\s*[\)）])?\s*$/);
    if (!m) continue;
    const original = m[1].trim();
    const corrected = m[2].trim();
    if (!original || !corrected) continue;
    const explanation_zh = (m[3] || "").trim();
    out.push({ original, corrected, category: "", explanation_zh });
  }
  return out;
}

function mapStructure(raw: Record<string, unknown>): SpeakingStructureStep[] {
  const arr = items(raw.answer_structure)
    .map(i => {
      const label = first(i.label, i.title);
      const content = str(i.content);
      return { step: str(i.step) || undefined, label, content };
    })
    .filter(i => i.label || i.content)
    .slice(0, 6);
  return arr;
}

function mapTakeaways(raw: Record<string, unknown>, final: string): SpeakingTakeaway[] {
  const hasCanonical = Array.isArray(raw.takeaway_expressions);
  const hasExpressionUpgrade = Array.isArray(raw.expression_upgrade) || Array.isArray(raw.expressionUpgrade);
  const hasKeyUpgrades = Array.isArray(raw.key_upgrades) || Array.isArray(raw.keyUpgrades);
  const sourceArr = hasCanonical
    ? items(raw.takeaway_expressions)
    : hasExpressionUpgrade
      ? items(raw.expression_upgrade ?? raw.expressionUpgrade)
      : hasKeyUpgrades
        ? items(raw.key_upgrades ?? raw.keyUpgrades)
        : [];
  const keepInFinal = !hasExpressionUpgrade; // legacy expressionUpgrade items need not literally appear in the final text
  return sourceArr
    .map(i => {
      const expression = first(i.expression, i.english);
      const meaning = first(i.meaning_zh, i.meaning, i.chinese);
      const readonly = hasKeyUpgrades;
      return {
        expression,
        meaning,
        meaning_zh: str(i.meaning_zh) || undefined,
        why_useful: first(i.why_useful, i.reason, i.usageNote, i.usage_note) || "",
        example: first(i.example, i.exampleSentence, i.example_sentence) || undefined,
        usage_note: first(i.usage_note, i.usageNote, i.note) || undefined,
        readonly,
      };
    })
    .filter(i => i.expression)
    .filter(i => !keepInFinal || final.toLowerCase().includes(i.expression.toLowerCase()))
    .filter((i, n, all) => all.findIndex(a => a.expression.toLowerCase() === i.expression.toLowerCase()) === n)
    .slice(0, 4);
}

function findStructureLegacy(row: Record<string, unknown>, content: Record<string, unknown>, details: Record<string, unknown>): unknown[] | null {
  const sources: (Record<string, unknown> | undefined)[] = [row, content, details];
  for (const o of sources) {
    if (!o) continue;
    if (Array.isArray(o.answer_structure)) return o.answer_structure;
    if (Array.isArray(o.answerStructure)) return o.answerStructure;
  }
  // Old content_analysis could nest answerStructure under the contentAnalysis object.
  const ca = speakingObject(details.contentAnalysis);
  if (Array.isArray(ca.answerStructure)) return ca.answerStructure;
  if (Array.isArray(ca.answer_structure)) return ca.answer_structure;
  return null;
}

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
  const legacyStructure = findStructureLegacy(row, content, details);
  const structureRaw = Array.isArray(raw.answer_structure)
    ? raw.answer_structure
    : legacyStructure ?? [];
  return {
    overall_score: score(raw.overall_score) ?? (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 2) / 2 : null),
    target_score: score(raw.target_score),
    key_issues: issues,
    revision_mode: ["light", "structure", "expand", "trim", "rewrite"].includes(str(raw.revision_mode)) ? raw.revision_mode as RevisionMode : null,
    optimization_summary: first(raw.optimization_summary, raw.diagnosis, content.summary),
    final_upgraded_answer: final,
    reference_answer: first(raw.reference_answer, raw.referenceAnswer, raw.one_better_example, raw.oneBetterExample),
    reference_angle_summary: first(raw.reference_angle_summary, raw.referenceAngleSummary, raw.reference_angle) || "",
    expansion_notice: str(raw.expansion_notice),
    takeaway_expressions: mapTakeaways(raw, final),
    corrections: mapCorrections(raw),
    answer_structure: mapStructure({ answer_structure: structureRaw }),
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

/** Build a human-readable corrections text from structured items (for legacy DB columns). */
export function buildCorrectionsText(corrections: SpeakingCorrection[]): string {
  return corrections
    .map(c => {
      const cat = c.category ? `${c.category}: ` : "";
      const expl = c.explanation_zh ? ` (${c.explanation_zh})` : "";
      return `- "${c.original}" → "${c.corrected}"${cat ? ` [${cat}]` : ""}${expl}`;
    })
    .join("\n");
}

// ── Expression bank save mapping for takeaway items ──

export function normalizeExpressionKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map a takeaway expression to the fields used by the expressions table insert. */
export function takeawayToExpressionRow(item: SpeakingTakeaway): Record<string, unknown> {
  return {
    english: item.expression.trim(),
    chinese: (item.meaning_zh || item.meaning || "").trim() || null,
    example_sentence: item.example?.trim() || null,
    notes: (item.usage_note || item.why_useful || "").trim() || null,
    source: "speaking-takeaway",
    usefulness_level: 3,
  };
}
