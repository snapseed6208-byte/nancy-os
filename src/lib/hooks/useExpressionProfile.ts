// ============================================
// Nancy OS — Personal Expression Profile Hook
// Client-side aggregation of structured diagnosis
// fields into a long-term expression growth profile.
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { isV4Diagnosis, fetchAssetStats, type V4Diagnosis, type V4TopIssue, type KnowledgeTransfer } from "@/lib/hooks/useChineseSpeaking";

// ── Profile DB row ──

export interface KTStageProfile {
  score: number;
  trend: "strong" | "improving" | "stable" | "weak";
  recent_scores: number[];
  sample_count: number;
}

export interface KnowledgeTransferProfile {
  knowledge_understanding: KTStageProfile;
  knowledge_processing: KTStageProfile;
  personal_connection: KTStageProfile;
  expression_transfer: KTStageProfile;
  dominant_pattern: string;
  pattern_description: string;
  training_strategy: string[];
  round2_impact: {
    avg_knowledge_growth: number;
    stage_most_improved: string;
    retry_effectiveness: string;
  };
}

export interface ExpressionProfile {
  id: string;
  user_id: string;
  strengths: Record<string, number>;
  weaknesses: Record<string, WeaknessEntry>;
  patterns: ProfilePatterns;
  improvement_history: ImprovementEntry[];
  raw_signal_snapshot: Record<string, unknown>;
  knowledge_transfer_profile: KnowledgeTransferProfile | null;
  asset_stats: Record<string, unknown>;
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
  knowledge_transfer?: KnowledgeTransfer | null;
  round1_knowledge_transfer?: KnowledgeTransfer | null;
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

// ── Knowledge Transfer signal extraction ──

interface KTScoreSnapshot {
  knowledge_understanding: number;
  knowledge_processing: number;
  personal_connection: number;
  expression_transfer: number;
}

function extractKTScores(kt: KnowledgeTransfer | null | undefined): KTScoreSnapshot | null {
  if (!kt?.path || kt.path.length === 0) return null;
  return {
    knowledge_understanding: kt.path.find((s) => s.stage === "knowledge_understanding")?.score ?? 0,
    knowledge_processing: kt.path.find((s) => s.stage === "knowledge_processing")?.score ?? 0,
    personal_connection: kt.path.find((s) => s.stage === "personal_connection")?.score ?? 0,
    expression_transfer: kt.path.find((s) => s.stage === "expression_transfer")?.score ?? 0,
  };
}

function computeTrend(scores: number[]): "strong" | "improving" | "stable" | "weak" {
  if (scores.length < 2) return "stable";
  const recent = scores.slice(-5);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (avg >= 80) return "strong";
  if (recent.length >= 2 && recent[recent.length - 1] > recent[0] + 3) return "improving";
  if (avg < 55) return "weak";
  return "stable";
}

function determineDominantPattern(profile: KTScoreSnapshot): { pattern: string; description: string } {
  const { knowledge_understanding: ku, knowledge_processing: kp, personal_connection: pc, expression_transfer: et } = profile;

  if (ku >= 75 && pc < 55 && et < 55) {
    return {
      pattern: "strong_understanding_weak_connection",
      description: "你非常擅长快速理解复杂观点（知识理解维度持续高分），但个人经验参与度不足（个人连接和表达转化持续低于55）。这形成了一个'复述式表达'模式——听者觉得你知识丰富，但不太能感受到你的个人立场。",
    };
  }
  if (ku >= 75 && pc >= 60 && et < 60) {
    return {
      pattern: "understands_and_connects_but_cant_methodize",
      description: "你能够理解材料并联系个人经验，但尚未形成可迁移的方法论。你能讲好一个故事，但听众难以从中提炼出'如果是我该怎么做'的行动指南。",
    };
  }
  if (ku < 60) {
    return {
      pattern: "needs_deeper_reading",
      description: "你在理解材料阶段就需要更多投入。表达中的问题往往不是'说不清楚'而是'没读明白'。建议在表达前花更多时间理解材料本身。",
    };
  }
  if (pc >= 75 && et >= 70) {
    return {
      pattern: "strong_personalizer",
      description: "你擅长将知识转化为个人化的表达。听众不仅能理解作者的观点，更能理解'这对你意味着什么'。继续保持并尝试向不同听众解释同一个概念。",
    };
  }
  return {
    pattern: "balanced_but_developing",
    description: "四个知识转化阶段相对均衡，但尚未在任何单一维度上形成明显优势。建议选择一个维度（如个人连接或表达转化）进行重点突破。",
  };
}

function generateTrainingStrategy(profile: KTScoreSnapshot, existingProfile: KnowledgeTransferProfile | null): string[] {
  const strategies: string[] = [];
  const ku = profile.knowledge_understanding;
  const kp = profile.knowledge_processing;
  const pc = profile.personal_connection;
  const et = profile.expression_transfer;

  if (pc < 60) strategies.push("每次表达前先问自己：'我对这个观点真正的态度是什么？同意？反对？部分同意？'");
  if (kp < 60) strategies.push("尝试用自己的话（不用材料中的任何原文）解释同一个观点，看看是否丢失了重要信息");
  if (et < 60) strategies.push("练习'I disagree with the author because...'类型的表达——先形成对立立场，再寻找自己的论证");
  if (ku < 65) strategies.push("慢下来。每次只关注材料中的一个核心概念，确保真正理解后再尝试表达");
  if (pc < 65 && pc >= 55) strategies.push("建立个人案例库：每读到一个有价值的观点时，至少关联一个自己的亲身经历");
  if (et >= 60 && et < 75) strategies.push("表达结束时加一句：'这个观点将如何改变我明天的行为？'——从理论连接到行动");

  // Add strategies based on existing profile patterns
  if (existingProfile) {
    const prevWeakest = Object.entries(existingProfile)
      .filter(([k]) => k !== "dominant_pattern" && k !== "pattern_description" && k !== "training_strategy" && k !== "round2_impact")
      .sort(([, a], [, b]) => (a as KTStageProfile).score - (b as KTStageProfile).score)[0];
    if (prevWeakest && strategies.length > 2) {
      // Keep most relevant strategies, cap at 4
    }
  }

  if (strategies.length === 0) strategies.push("尝试向不同听众（如10岁孩子、同行、父母）解释同一个概念——这是知识内化的最高检验标准");
  return strategies.slice(0, 4);
}

function mergeKTProfile(
  existing: KnowledgeTransferProfile | null,
  scores: KTScoreSnapshot,
  round1Scores?: KTScoreSnapshot | null,
): KnowledgeTransferProfile {
  const now = new Date().toISOString();

  function updateStage(
    key: keyof Omit<KnowledgeTransferProfile, "dominant_pattern" | "pattern_description" | "training_strategy" | "round2_impact">,
    score: number,
    prev: KTStageProfile | undefined,
  ): KTStageProfile {
    const recentScores = [...(prev?.recent_scores ?? []).slice(-11), score];
    return {
      score: Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length),
      trend: computeTrend(recentScores),
      recent_scores: recentScores,
      sample_count: (prev?.sample_count ?? 0) + 1,
    };
  }

  const profile: Omit<KnowledgeTransferProfile, "round2_impact"> & { round2_impact: KnowledgeTransferProfile["round2_impact"] } = {
    knowledge_understanding: updateStage("knowledge_understanding", scores.knowledge_understanding, existing?.knowledge_understanding),
    knowledge_processing: updateStage("knowledge_processing", scores.knowledge_processing, existing?.knowledge_processing),
    personal_connection: updateStage("personal_connection", scores.personal_connection, existing?.personal_connection),
    expression_transfer: updateStage("expression_transfer", scores.expression_transfer, existing?.expression_transfer),
    dominant_pattern: "",
    pattern_description: "",
    training_strategy: [],
    round2_impact: existing?.round2_impact ?? { avg_knowledge_growth: 0, stage_most_improved: "", retry_effectiveness: "" },
  };

  const { pattern, description } = determineDominantPattern(scores);
  profile.dominant_pattern = pattern;
  profile.pattern_description = description;
  profile.training_strategy = generateTrainingStrategy(scores, existing);

  // Update round2 impact if we have R1 comparison data
  if (round1Scores) {
    const deltas = [
      { stage: "knowledge_understanding", delta: scores.knowledge_understanding - round1Scores.knowledge_understanding },
      { stage: "knowledge_processing", delta: scores.knowledge_processing - round1Scores.knowledge_processing },
      { stage: "personal_connection", delta: scores.personal_connection - round1Scores.personal_connection },
      { stage: "expression_transfer", delta: scores.expression_transfer - round1Scores.expression_transfer },
    ];
    const totalDelta = deltas.reduce((sum, d) => sum + d.delta, 0) / deltas.length;
    const mostImproved = deltas.sort((a, b) => b.delta - a.delta)[0];

    const prevAvg = profile.round2_impact.avg_knowledge_growth;
    const prevCount = existing?.knowledge_understanding.sample_count ?? 0;
    const newAvg = prevCount > 0
      ? Math.round((prevAvg * (prevCount - 1) + totalDelta) / prevCount * 10) / 10
      : Math.round(totalDelta * 10) / 10;

    profile.round2_impact = {
      avg_knowledge_growth: newAvg,
      stage_most_improved: mostImproved.stage,
      retry_effectiveness: totalDelta > 5
        ? `重新表达对知识转化有显著提升（平均+${newAvg}分）。最明显的进步在${mostImproved.stage}维度（+${mostImproved.delta}），说明重述策略对知识内化有效。`
        : totalDelta > 0
        ? `重新表达带来了一定的知识转化提升（平均+${newAvg}分），但提升幅度有限。建议在重述时更专注于补充个人经历和形成方法论。`
        : `重新表达未带来明显的知识转化提升。这可能说明需要更长时间的材料消化，而非简单重复表达。`,
    };
  }

  return profile as KnowledgeTransferProfile;
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
  knowledge_transfer_profile: KnowledgeTransferProfile | null;
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

  // Merge Knowledge Transfer profile
  const existingKT = (existing as ExpressionProfile | null)?.knowledge_transfer_profile ?? null;
  const ktScores = extractKTScores(signals.knowledge_transfer ?? null);
  const r1KtScores = extractKTScores(signals.round1_knowledge_transfer ?? null);
  const ktProfile = ktScores
    ? mergeKTProfile(existingKT, ktScores, r1KtScores)
    : existingKT;

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

  return { strengths, weaknesses, patterns, improvement_history: improvementHistory, knowledge_transfer_profile: ktProfile };
}

// ── Query ──

async function fetchExpressionProfile(): Promise<ExpressionProfile | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("expression_profiles")
    .select("*")
    .eq("user_id", userId)
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
      const userId = await getUserId();

      // Fetch current profile (scoped to user)
      const { data: current, error: fetchError } = await supabase
        .from("expression_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;

      const merged = mergeProfileSignals({
        existing: current as ExpressionProfile | null,
        signals: input.signals,
      });

      // Snapshot asset stats for profile integration
      let assetStats = {};
      try {
        assetStats = await fetchAssetStats();
      } catch {
        // Non-critical — profile update proceeds without asset stats
      }

      const { data, error } = await supabase
        .from("expression_profiles")
        .upsert(
          {
            user_id: userId,
            strengths: merged.strengths,
            weaknesses: merged.weaknesses,
            patterns: merged.patterns,
            improvement_history: merged.improvement_history,
            knowledge_transfer_profile: merged.knowledge_transfer_profile ?? {},
            asset_stats: assetStats,
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
