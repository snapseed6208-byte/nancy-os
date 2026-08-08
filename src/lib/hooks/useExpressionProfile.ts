// ============================================
// Nancy OS — Personal Expression Profile Hook
// Client-side aggregation of structured diagnosis
// fields into a long-term expression growth profile.
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { isV4Diagnosis, type V4Diagnosis, type V4TopIssue } from "@/lib/hooks/useChineseSpeaking";

// ── Profile DB row ──

export interface ExpressionProfile {
  id: string;
  user_id: string;
  strengths: Record<string, number>;
  weaknesses: Record<string, WeaknessEntry>;
  patterns: ProfilePatterns;
  improvement_history: ImprovementEntry[];
  raw_signal_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WeaknessEntry {
  count: number;
  last_seen: string;
  avg_severity: "high" | "medium" | "low";
}

export interface ProfilePatterns {
  preferred_types: Record<string, number>;
  total_sessions: number;
  total_retries: number;
  avg_score: number;
  score_trend: ScoreTrendPoint[];
  recent_focus_areas: string[];
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
  topic_type: string;
}

export interface ImprovementEntry {
  date: string;
  before_score: number;
  after_score: number;
  area: string;
  sessions: number;
}

// ── Signal extraction input ──

export interface ProfileSignalInput {
  session_id: string;
  topic_type: string;
  attempt_round: number;
  is_retry: boolean;
  diagnosis: V4Diagnosis | null;
  round1_score?: number;
  round2_score?: number;
}

// ── Signal extraction ──

const CONFIDENCE_THRESHOLD = 3;

function severityToNumber(s: "high" | "medium" | "low"): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

function numberToSeverity(n: number): "high" | "medium" | "low" {
  return n >= 2.5 ? "high" : n >= 1.5 ? "medium" : "low";
}

/**
 * Extract profile signals from a single attempt's V4 diagnosis.
 * Pure function — no side effects.
 */
export function extractProfileSignals(input: ProfileSignalInput): {
  dimensionKeys: string[];
  issueAreas: string[];
  topicType: string;
  score: number;
  isRetry: boolean;
  improvement: { area: string; delta: number } | null;
} {
  const { diagnosis, topic_type, is_retry, round1_score, round2_score } = input;

  const dimensionKeys: string[] = [];
  const issueAreas: string[] = [];

  // Only extract structured signals from V4+ diagnoses (backward compat)
  if (diagnosis && isV4Diagnosis(diagnosis)) {
    for (const dim of diagnosis.dimensions) {
      if (dim.score >= 6) {
        dimensionKeys.push(dim.key);
      }
    }

    for (const issue of diagnosis.top_issues) {
      if (issue.severity === "high" || issue.severity === "medium") {
        issueAreas.push(mapIssueToArea(issue));
      }
    }
  }

  // Fallback for V1-V3: extract score from various field locations
  let score = 0;
  if (diagnosis?.overall?.score != null) {
    score = diagnosis.overall.score;
  } else if (diagnosis) {
    const legacy = diagnosis as unknown as Record<string, unknown>;
    const legacyOverall = legacy.overall_score as number | undefined;
    const legacyScores = legacy.scores as Record<string, unknown> | undefined;
    if (typeof legacyOverall === "number") {
      score = legacyOverall;
    } else if (typeof legacyScores?.total === "number") {
      score = legacyScores.total as number;
    } else if (typeof legacyScores?.overall_score === "number") {
      score = legacyScores.overall_score as number;
    }
  }

  const improvement =
    is_retry && round1_score != null && round2_score != null
      ? { area: topic_type, delta: round2_score - round1_score }
      : null;

  return {
    dimensionKeys,
    issueAreas,
    topicType: topic_type,
    score,
    isRetry: is_retry,
    improvement,
  };
}

/** Map a V4 issue title to a stable, language-agnostic area key */
function mapIssueToArea(issue: V4TopIssue): string {
  const title = issue.title || "";

  if (/证据|例子|数据|支撑|evidence|example/i.test(title)) return "evidence";
  if (/结构|逻辑|组织|框架|structure|logic|flow/i.test(title)) return "structure";
  if (/深度|思辨|批判|分析|思考|表层|depth|critical/i.test(title)) return "depth";
  if (/清晰|流畅|衔接|啰嗦|重复|clarity|fluency/i.test(title)) return "clarity";
  if (/切题|偏题|主旨|立场|relevance|focus/i.test(title)) return "relevance";
  if (/呈现|语速|停顿|口头禅|语气|delivery|pace/i.test(title)) return "delivery";
  if (/边界|条件|反方|权衡|boundary|counter|tradeoff/i.test(title)) return "boundary";
  if (/场景|冲突|行动|结果|反思|scene|conflict|action|result|reflection/i.test(title)) return "narrative";
  if (/抽象|具体|abstraction|concrete/i.test(title)) return "abstraction";
  if (/细节|表达/i.test(title)) return "general";

  return "general";
}

// ── Profile merge logic ──

export interface MergeProfileInput {
  existing: Pick<ExpressionProfile, "strengths" | "weaknesses" | "patterns" | "improvement_history"> | null;
  signals: ProfileSignalInput;
}

/**
 * Merge new profile signals into existing profile.
 * Incremental: cumulative frequency counts, confidence thresholds, never overwrite.
 * Returns the updated profile fields ready for upsert.
 */
export function mergeProfileSignals(input: MergeProfileInput): {
  strengths: Record<string, number>;
  weaknesses: Record<string, WeaknessEntry>;
  patterns: ProfilePatterns;
  improvement_history: ImprovementEntry[];
} {
  const { existing, signals } = input;

  const extracted = extractProfileSignals(signals);

  // Initial state
  const strengths: Record<string, number> = { ...(existing?.strengths ?? {}) };
  const weaknesses: Record<string, WeaknessEntry> = { ...(existing?.weaknesses ?? {}) };
  const prevPatterns: Partial<ProfilePatterns> = existing?.patterns ?? {};
  const improvementHistory: ImprovementEntry[] = [
    ...((existing?.improvement_history as ImprovementEntry[]) ?? []),
  ];

  // Merge strengths: increment frequency counts
  for (const key of extracted.dimensionKeys) {
    strengths[key] = (strengths[key] || 0) + 1;
  }

  // Merge weaknesses: increment count, update last_seen, rolling severity average
  const now = new Date().toISOString();
  for (const area of extracted.issueAreas) {
    const prev = weaknesses[area];
    if (prev) {
      const newCount = prev.count + 1;
      weaknesses[area] = {
        count: newCount,
        last_seen: now,
        avg_severity: numberToSeverity(
          (severityToNumber(prev.avg_severity) * prev.count + 2) / newCount,
        ),
      };
    } else {
      weaknesses[area] = {
        count: 1,
        last_seen: now,
        avg_severity: "medium",
      };
    }
  }

  // Merge patterns
  const preferredTypes = { ...(prevPatterns.preferred_types ?? {}) };
  preferredTypes[extracted.topicType] = (preferredTypes[extracted.topicType] || 0) + 1;

  const totalSessions = (prevPatterns.total_sessions ?? 0) + (extracted.isRetry ? 0 : 1);
  const totalRetries = (prevPatterns.total_retries ?? 0) + (extracted.isRetry ? 1 : 0);

  const prevTrend = (prevPatterns.score_trend as ScoreTrendPoint[]) ?? [];
  const scoreTrend: ScoreTrendPoint[] = extracted.score > 0
    ? [...prevTrend.slice(-19), { date: now, score: extracted.score, topic_type: extracted.topicType }]
    : prevTrend;

  const allScores = scoreTrend.map((p) => p.score);
  const avgScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : (prevPatterns.avg_score ?? 0);

  // Recent focus areas: weaknesses with count >= CONFIDENCE_THRESHOLD, sorted by count DESC
  const recentFocusAreas = Object.entries(weaknesses)
    .filter(([, v]) => v.count >= CONFIDENCE_THRESHOLD)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([key]) => key);

  const patterns: ProfilePatterns = {
    preferred_types: preferredTypes,
    total_sessions: totalSessions,
    total_retries: totalRetries,
    avg_score: avgScore,
    score_trend: scoreTrend,
    recent_focus_areas: recentFocusAreas,
  };

  // Merge improvement history
  if (extracted.improvement && extracted.improvement.delta > 0) {
    improvementHistory.push({
      date: now,
      before_score: signals.round1_score ?? 0,
      after_score: signals.round2_score ?? 0,
      area: extracted.improvement.area,
      sessions: totalSessions,
    });
    // Cap at 50 entries
    if (improvementHistory.length > 50) {
      improvementHistory.splice(0, improvementHistory.length - 50);
    }
  }

  return { strengths, weaknesses, patterns, improvement_history: improvementHistory };
}

// ── Query ──

async function fetchExpressionProfile(): Promise<ExpressionProfile | null> {
  const { data, error } = await supabase
    .from("expression_profiles")
    .select("*")
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data as ExpressionProfile) || null;
}

export function useExpressionProfile() {
  return useQuery({
    queryKey: ["expression_profile"],
    queryFn: fetchExpressionProfile,
    staleTime: 60 * 1000,
  });
}

// ── Mutation: update (merge) profile after an attempt is saved ──

export function useUpdateExpressionProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { signals: ProfileSignalInput }) => {
      // Fetch current profile
      const { data: current } = await supabase
        .from("expression_profiles")
        .select("*")
        .single();

      const merged = mergeProfileSignals({
        existing: current as ExpressionProfile | null,
        signals: input.signals,
      });

      const userId = await getUserId();

      const { data, error } = await supabase
        .from("expression_profiles")
        .upsert(
          {
            user_id: userId,
            ...merged,
            raw_signal_snapshot: {
              last_signal: input.signals,
              merged_at: new Date().toISOString(),
            },
          },
          { onConflict: "user_id" },
        )
        .select()
        .single();

      if (error) throw error;
      return data as ExpressionProfile;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expression_profile"] });
    },
  });
}

// ── Helpers for UI display ──

export const FOCUS_AREA_LABELS: Record<string, string> = {
  evidence: "具体证据",
  structure: "表达结构",
  depth: "思考深度",
  clarity: "表达清晰度",
  relevance: "切题度",
  delivery: "口语呈现",
  boundary: "边界辨析",
  narrative: "叙事完整度",
  abstraction: "抽象升级",
  general: "综合表达",
};

export const FOCUS_AREA_ADVICE: Record<string, string> = {
  evidence: "多用具体例子、数据或个人经历来支撑观点",
  structure: "尝试用 PREP 或 金字塔原理 组织表达，先给结论再展开",
  depth: "思考观点的反面、边界条件和权衡，不只停留在表面",
  clarity: "减少填充词，用短句，每个观点之间留停顿",
  relevance: "开头明确立场，每句话都服务于核心观点",
  delivery: "控制语速，注意停顿节奏，减少'然后'、'就是'等口头禅",
  boundary: "明确你的观点适用于什么条件，什么情况下不成立",
  narrative: "补充场景细节、冲突点和具体行动，不只讲结果",
  abstraction: "从具体案例中提炼通用规律，不只是复述事实",
  general: "每次练习前回顾上一次的AI建议，聚焦一个改进点",
};

/** Filter focus areas to only those meeting confidence threshold and generate friendly labels */
export function getTrainingFocus(profile: ExpressionProfile | null | undefined): {
  area: string;
  label: string;
  advice: string;
  count: number;
}[] {
  if (!profile) return [];

  return Object.entries(profile.weaknesses)
    .filter(([, v]) => v.count >= CONFIDENCE_THRESHOLD)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([key, v]) => ({
      area: key,
      label: FOCUS_AREA_LABELS[key] || key,
      advice: FOCUS_AREA_ADVICE[key] || FOCUS_AREA_ADVICE.general,
      count: v.count,
    }));
}
