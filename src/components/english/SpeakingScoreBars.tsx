// Score bars & score extraction for Speaking Feedback (first-round + before/after).
// Params are intentionally `unknown`: callers pass both raw DB rows and normalized
// feedback objects (interfaces), which are not assignable to Record<string, unknown>.
import { cn } from "@/lib/utils";

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 9 ? v : null;

function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

function detailsOf(fb: unknown): Record<string, unknown> {
  const d = obj(fb).detailed_analysis;
  return d && typeof d === "object" && !Array.isArray(d) ? d as Record<string, unknown> : {};
}

/** 4-dim language scores (fluency / grammar / vocabulary / naturalness). */
export function readDims(fb: unknown): { fluency: number | null; grammar: number | null; vocabulary: number | null; naturalness: number | null } {
  const d = detailsOf(fb);
  const top = obj(fb);
  const get = (camel: string, snake: string) => num(d[camel]) ?? num(d[snake]) ?? num(top[camel]) ?? num(top[snake]);
  return {
    fluency: get("fluencyScore", "fluency_score"),
    grammar: get("grammarScore", "grammar_score"),
    vocabulary: get("vocabularyScore", "vocabulary_score"),
    naturalness: get("naturalnessScore", "naturalness_score"),
  };
}

/** Content diagnosis (relevance / coherence / development + issue lists). */
export function readContent(fb: unknown): {
  relevance: number | null; coherence: number | null; development: number | null;
  summary: string; offTopic: string[]; repetition: string[]; orderProblems: string[]; contentGaps: string[];
} {
  const d = detailsOf(fb);
  let ca: Record<string, unknown> | undefined;
  const nested = d.contentAnalysis;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) ca = nested as Record<string, unknown>;
  else if (d.relevanceScore !== undefined || d.coherenceScore !== undefined || d.developmentScore !== undefined) ca = d;
  const topContent = obj(fb).contentAnalysis;
  if ((!ca || Object.keys(ca).length === 0) && topContent && typeof topContent === "object" && !Array.isArray(topContent)) ca = topContent as Record<string, unknown>;
  ca = ca || {};
  const arr = (k: string) => Array.isArray(ca?.[k]) ? (ca![k] as unknown[]).filter((v): v is string => typeof v === "string") : [];
  const numKey = (camel: string, snake: string) => num(ca![camel]) ?? num(ca![snake]);
  return {
    relevance: numKey("relevanceScore", "relevance_score"),
    coherence: numKey("coherenceScore", "coherence_score"),
    development: numKey("developmentScore", "development_score"),
    summary: typeof ca?.summary === "string" ? ca.summary : "",
    offTopic: arr("offTopicParts"),
    repetition: arr("repetition"),
    orderProblems: arr("orderProblems"),
    contentGaps: arr("contentGaps"),
  };
}

export function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.min((score / 9) * 100, 100);
  const color = score >= 7 ? "bg-emerald-400" : score >= 5.5 ? "bg-amber-400" : "bg-accent-rose/60";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-ink-light w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-ink/10 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-medium text-ink w-7 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

export function ComparisonScoreBar({ label, before, after }: { label: string; before: number | null; after: number | null }) {
  const b = before ?? 0;
  const a = after ?? 0;
  const delta = a - b;
  const improved = delta > 0;
  const barBefore = Math.min((b / 9) * 100, 100);
  const barAfter = Math.min((a / 9) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-light">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-ink-lighter">{before === null ? "—" : b.toFixed(1)}</span>
          <span className="text-ink-lighter">→</span>
          <span className={cn("font-medium", improved ? "text-emerald-600" : delta < 0 ? "text-accent-rose" : "text-ink")}>
            {after === null ? "—" : a.toFixed(1)}
          </span>
          {delta !== 0 && (
            <span className={cn("text-[10px] font-medium", improved ? "text-emerald-500" : "text-accent-rose")}>
              {improved ? "+" : ""}{delta.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        <div className="flex-1 h-1.5 bg-ink/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all bg-ink/20" style={{ width: `${barBefore}%` }} />
        </div>
        <div className="flex-1 h-1.5 bg-ink/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", improved ? "bg-emerald-400" : delta < 0 ? "bg-accent-rose/60" : "bg-ink/20")}
            style={{ width: `${barAfter}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Before/after score comparison card built from REAL stored per-dimension scores of two
 * attempts (first round vs retry). Never invents numbers: if a dimension is missing on
 * either side it is omitted (unless the other side has it, in which case the missing side
 * renders "—").
 */
export function BeforeAfterScores({ before, after }: { before: unknown; after: unknown }) {
  const bDims = readDims(before);
  const aDims = readDims(after);
  const bCont = readContent(before);
  const aCont = readContent(after);
  const rows = [
    { label: "流利度 Fluency", before: bDims.fluency, after: aDims.fluency },
    { label: "语法 Grammar", before: bDims.grammar, after: aDims.grammar },
    { label: "词汇 Vocabulary", before: bDims.vocabulary, after: aDims.vocabulary },
    { label: "自然度 Naturalness", before: bDims.naturalness, after: aDims.naturalness },
    { label: "切题度 Relevance", before: bCont.relevance, after: aCont.relevance },
    { label: "连贯性 Coherence", before: bCont.coherence, after: aCont.coherence },
    { label: "展开度 Development", before: bCont.development, after: aCont.development },
  ].filter(r => r.before !== null || r.after !== null);
  if (!rows.length) return null;
  return (
    <div className="bg-card rounded-2xl border border-purple-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink">分数对比 Score</p>
        <div className="flex items-center gap-3 text-[10px] text-ink-lighter">
          <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded-full bg-ink/20 inline-block" /> 第一次</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-4 rounded-full bg-emerald-400 inline-block" /> 复述</span>
        </div>
      </div>
      {rows.map(r => (
        <ComparisonScoreBar key={r.label} label={r.label} before={r.before} after={r.after} />
      ))}
      <p className="text-[10px] text-ink-lighter pt-0.5">基于两次真实转录的评分估计，不含发音评估。</p>
    </div>
  );
}
