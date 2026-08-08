// ============================================
// Nancy OS — Chinese Expression Training Hooks V2
// Types, queries, mutations, AI — updated for V2 two-stage analysis
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";

// ── Topic & framework enums ──

export type ChineseTopicType = "opinion" | "experience" | "concept" | "reflection" | "interview" | "story";
export type ChineseTrainingMode = "one_minute_topic" | "material_retelling";
export type ChineseFramework = "pyramid" | "prep" | "scqa" | "star" | "story";

export const TOPIC_TYPE_LABELS: Record<ChineseTopicType, string> = {
  opinion: "观点表达",
  experience: "经历讲述",
  concept: "概念解释",
  reflection: "视频/读书感悟",
  interview: "面试回答",
  story: "故事表达",
};

export const TOPIC_TYPE_ICONS: Record<ChineseTopicType, string> = {
  opinion: "MessageSquare",
  experience: "Footprints",
  concept: "Lightbulb",
  reflection: "BookOpen",
  interview: "Briefcase",
  story: "Heart",
};

export const FRAMEWORK_LABELS: Record<ChineseFramework, string> = {
  pyramid: "金字塔原理",
  prep: "PREP",
  scqa: "SCQA",
  star: "STAR",
  story: "故事表达",
};

// ── V2 Scoring types ──

export interface V2DimensionScore {
  score: number;
  max: number;
  evidence_quotes: string[];
  diagnosis: string;
  improvement: string;
}

export interface V2Scores {
  relevance: V2DimensionScore;
  structure_logic: V2DimensionScore;
  depth_critical_thinking: V2DimensionScore;
  evidence_support: V2DimensionScore;
  clarity: V2DimensionScore;
  delivery: V2DimensionScore;
}

export const V2_DIMENSION_LABELS: Record<string, string> = {
  relevance: "主旨与切题度",
  structure_logic: "结构与逻辑",
  depth_critical_thinking: "内容深度与思辨",
  evidence_support: "细节与支撑",
  clarity: "表达清晰度",
  delivery: "口语呈现",
};

// ── V3 Diagnosis types (analyze_expression output) ──

export interface V2Stance {
  summary: string;
  clarity: "clear" | "partial" | "unclear";
  preserved: boolean;
}

export interface V2Framework {
  name: string;
  reason: string;
  depth_lenses: string[];
}

export interface V2KeyIssue {
  severity: "high" | "medium" | "low";
  title: string;
  evidence_quote: string;
  why_it_matters: string;
  how_to_fix: string;
}

export interface V2ThinkingUpgrade {
  core_tension: string;
  definition: string;
  conditions: string;
  tradeoff: string;
  counterpoint: string;
  boundary: string;
  real_detail_slots: string[];
}

export interface V2OutlineStep {
  step: number;
  label: string;
  content: string;
  seconds: number;
}

export interface V2IntegrityCheck {
  fabricated_person_or_event: boolean;
  unsupported_specific_details: string[];
  stance_was_replaced: boolean;
}

export interface V3KeyImprovement {
  area: string;
  before: string;
  after: string;
}

export interface V3Diagnosis {
  version: string;
  question_type: string;
  stance: V2Stance;
  overall_score: number;
  overall_judgment: string;
  primary_framework: V2Framework;
  scores: V2Scores;
  three_key_issues: V2KeyIssue[];
  thinking_upgrade: V2ThinkingUpgrade;
  answer_outline: V2OutlineStep[];
  self_questions: string[];
  key_improvements: V3KeyImprovement[];
  reference_ready: boolean;
  integrity_check: V2IntegrityCheck;
}

// ── V4 Diagnosis types (skill-specific dimensions per topic_type) ──

export interface V4Overall {
  score: number;
  summary: string;
}

export interface V4DimensionScore {
  key: string;
  label: string;
  score: number;
  max_score: number;
  diagnosis: string;
  evidence_quote: string;
}

export interface V4TopIssue {
  severity: "high" | "medium" | "low";
  title: string;
  evidence_quote: string;
  why_it_matters: string;
  action: string;
}

export interface V4RecommendedStructure {
  name: string;
  reason: string;
  steps: string[];
}

export interface V4OutlineStep {
  step: number;
  label: string;
  guidance: string;
  target_seconds: number;
}

// ── V4.2 Unified Key Upgrade (new schema) ──

export interface V4KeyUpgrade {
  category: string;
  original_expression: string;
  problem_analysis: string;
  optimized_expression: string;
  upgrade_reason: string;
  /** @deprecated V4.0-V4.1 compat — mapped to original_expression */
  title?: string;
  /** @deprecated V4.0-V4.1 compat — mapped to original_expression */
  original?: string;
  /** @deprecated V4.0-V4.1 compat — mapped to optimized_expression */
  direction?: string;
  /** @deprecated V4.0-V4.1 compat — mapped to upgrade_reason */
  reason?: string;
}

/** Normalize a key upgrade object from any version to the V4.2 unified schema. */
export function normalizeKeyUpgrade(raw: Record<string, unknown>): V4KeyUpgrade {
  const isV42 = typeof raw.original_expression === "string" && raw.original_expression.length > 0;
  if (isV42) {
    return {
      category: (raw.category as string) || "表达",
      original_expression: raw.original_expression as string,
      problem_analysis: (raw.problem_analysis as string) || "",
      optimized_expression: raw.optimized_expression as string,
      upgrade_reason: (raw.upgrade_reason as string) || (raw.reason as string) || "",
    };
  }
  // V4.0/V4.1 compat: original → original_expression, direction → optimized_expression
  return {
    category: (raw.category as string) || (raw.title as string) || "表达",
    original_expression: (raw.original as string) || (raw.before as string) || "",
    problem_analysis: (raw.problem_analysis as string) || "",
    optimized_expression: (raw.direction as string) || (raw.after as string) || "",
    upgrade_reason: (raw.upgrade_reason as string) || (raw.reason as string) || "",
  };
}

export interface V4ThinkingOrDeepeningItem {
  lens: string;
  insight: string;
  application: string;
}

export interface V4ThinkingOrDeepening {
  title: string;
  items: V4ThinkingOrDeepeningItem[];
}

export interface V4FactConsistency {
  status: "safe" | "needs_confirmation" | "not_applicable";
  message: string;
  unconfirmed_details: string[];
}

export interface V4DeliveryFeedback {
  summary: string;
  time_control: string;
  pace_comment: string;
  filler_comment: string;
}

export interface V4Diagnosis {
  skill_version: string;
  topic_type: string;
  overall: V4Overall;
  dimensions: V4DimensionScore[];
  top_issues: V4TopIssue[];
  recommended_structure: V4RecommendedStructure;
  answer_outline: V4OutlineStep[];
  self_questions: string[];
  key_upgrades: V4KeyUpgrade[];
  thinking_or_deepening: V4ThinkingOrDeepening;
  fact_consistency: V4FactConsistency;
  delivery_feedback: V4DeliveryFeedback;
  retry_focus: string[];
  /** @deprecated Use material_understanding_v2 instead */
  material_understanding?: MaterialUnderstanding;
  material_understanding_v2?: MaterialUnderstandingV2;
  knowledge_transfer?: KnowledgeTransfer;
  knowledge_expression_gap?: KnowledgeExpressionGap;
  /** Phase 4: AI-suggested expression asset candidates */
  expression_asset_candidates?: ExpressionAssetCandidate[];
}

// ── Phase 3.1 Material Card types ──

/** @deprecated Use MaterialUnderstandingV2 instead. Kept for backward compat with V1 sessions. */
export interface MaterialUnderstanding {
  accuracy_score: number;
  core_understanding: string;
  understood_correctly: string[];
  misunderstanding: string;
  missing_material_points: string[];
  personal_connection: string;
  transfer_quality: string;
}

// ── Phase 3.2: Material Understanding V2 + Knowledge Transfer ──

export interface MaterialUnderstandingV2 {
  understanding_score: number;
  core_grasp: { score: number; analysis: string };
  material_fidelity: { score: number; analysis: string };
  key_concept_usage: { score: number; analysis: string };
  material_connection: { score: number; analysis: string };
  missing_material_elements: Array<{
    missing: string;
    importance: "high" | "medium" | "low";
    suggestion: string;
  }>;
}

export interface KnowledgeTransferStage {
  stage: "knowledge_understanding" | "knowledge_processing" | "personal_connection" | "expression_transfer";
  label: string;
  score: number;
  analysis: string;
  evidence: string;
}

export type KnowledgeTransferLevel = "understand_only" | "connected" | "personalized" | "applied";

export interface KnowledgeTransfer {
  overall_score: number;
  level: KnowledgeTransferLevel;
  coach_summary: string;
  path: KnowledgeTransferStage[];
  level_definition: Record<KnowledgeTransferLevel, string>;
  growth?: KnowledgeTransferGrowth;
}

export interface KnowledgeTransferGrowth {
  overall_delta: number;
  stage_deltas: Array<{
    stage: string;
    delta: number;
    interpretation: string;
  }>;
  growth_summary: string;
}

export interface KnowledgeExpressionGap {
  gap_type: "understanding_gap" | "expression_gap" | "transfer_gap" | "none";
  analysis: string;
  next_action: string;
}

// ═══════════════════════════════════════════
// Phase 4: Expression Asset Library
// ═══════════════════════════════════════════

export type AssetType =
  | "personal_story"
  | "experience_case"
  | "viewpoint"
  | "quality_expression"
  | "quote";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  personal_story: "个人故事",
  experience_case: "经历案例",
  viewpoint: "个人观点",
  quality_expression: "优质表达",
  quote: "金句洞察",
};

export interface PersonalStoryData {
  background: string;
  challenge: string;
  action: string;
  result: string;
  reflection: string;
}

export interface ExperienceCaseData {
  situation: string;
  task: string;
  action: string;
  result: string;
  learning: string;
}

export interface ViewpointData {
  topic: string;
  my_position: string;
  reasoning: string;
  example: string;
  boundary: string;
  counter_argument: string;
}

export interface QualityExpressionData {
  original_question: string;
  my_original_answer: string;
  optimized_answer: string;
  why_good: string;
  skill_tags: string[];
}

export interface QuoteData {
  quote: string;
  source_context: string;
  my_understanding: string;
  application_scene: string;
}

export type AssetData =
  | PersonalStoryData
  | ExperienceCaseData
  | ViewpointData
  | QualityExpressionData
  | QuoteData;

/** AI-generated candidate — written to attempts.asset_candidates */
export interface ExpressionAssetCandidate {
  type: AssetType;
  title: string;
  asset_data: AssetData;
  tags: string[];
  confidence: "high" | "medium";
  evidence_quote: string;
  extracted_from_transcript: string;
}

/** Persisted asset row from expression_assets table */
export interface ExpressionAsset {
  id: string;
  user_id: string;
  asset_type: AssetType;
  title: string;
  asset_data: AssetData;
  source_attempt_id: string | null;
  source_session_id: string | null;
  extracted_from_transcript: string;
  evidence_quote: string;
  confidence: "high" | "medium";
  fact_status: "user_confirmed" | "user_edited" | "ai_suggested";
  tags: string[];
  status: "active" | "archived" | "deleted";
  quality_score: AssetQualityScore;
  created_at: string;
  updated_at: string;
}

export interface AssetQualityScore {
  completeness: number;
  authenticity: number;
  reusability: number;
}

export interface KeyArgument {
  point: string;
  explanation: string;
  example: string;
}

export interface KeyExample {
  case: string;
  meaning: string;
  can_use_in_expression: string;
}

export interface ExpressionAngle {
  angle: string;
  recommended_skill: ChineseTopicType;
  possible_question: string;
}

export interface MaterialCard {
  title: string;
  source_type: string;
  source_summary: string;
  core_argument: string;
  key_arguments: KeyArgument[];
  key_examples: KeyExample[];
  expression_angles: ExpressionAngle[];
  recommended_skill: ChineseTopicType;
  training_reason: string;
}

export interface ExtractMaterialResult {
  material_card: MaterialCard;
}

/** @deprecated Use MaterialCard instead. Kept for backward compat with V2 sessions. */
export interface MaterialAnalysis {
  title: string;
  core_argument: string;
  key_points: string[];
  important_examples: string[];
  controversial_points: string[];
  expression_angles: string[];
}

export interface GeneratedMaterialQuestion {
  question: string;
  question_type: "opinion" | "explanation" | "application";
  recommended_skill: ChineseTopicType;
}

// ── V4.1 Content Deepening types (Phase 1) ──

export interface ContentDeepeningMissingElement {
  key: string;
  label: string;
  present: boolean;
  why_it_matters: string;
  what_can_improve: string;
  guiding_question: string;
}

export interface InformationDensity {
  level: "low" | "medium" | "high";
  explanation: string;
}

export interface AbstractionAnalysis {
  current_level: string;
  problem: string;
  upgrade_direction: string;
}

export interface ExpansionPathStep {
  step: number;
  focus: string;
  question: string;
}

export interface ContentDeepening {
  overall_problem: string;
  information_density: InformationDensity;
  missing_elements: ContentDeepeningMissingElement[];
  abstraction_analysis: AbstractionAnalysis;
  expansion_path: ExpansionPathStep[];
}

/** Union type for diagnosis: V4 if skill_version starts with "chinese-v4", else V3 */
export type DiagnosisResult = V4Diagnosis | V3Diagnosis;

export function isV4Diagnosis(d: unknown): d is V4Diagnosis {
  if (!d || typeof d !== "object") return false;
  const obj = d as Record<string, unknown>;
  return typeof obj.skill_version === "string" && (obj.skill_version as string).startsWith("chinese-v4");
}

/** Check if a V4 diagnosis has content_deepening (Phase 1+) */
export function hasContentDeepening(diagnosis: Record<string, unknown> | null): diagnosis is Record<string, unknown> & { content_deepening: ContentDeepening } {
  if (!diagnosis) return false;
  const cd = diagnosis.content_deepening as Record<string, unknown> | undefined;
  return !!cd && typeof cd.overall_problem === "string";
}

// ── V2 Rewrite types (kept for backward compat; V3 uses V3Reference) ──

export interface V2ThoughtFeature {
  type: string;
  used_in_sentence: string;
  purpose: string;
}

export interface V2KeyUpgrade {
  title: string;
  before: string;
  after: string;
  reason: string;
}

export interface V2Authenticity {
  fabricated_details: boolean;
  general_hypothetical_used: boolean;
  missing_real_detail_slots: string[];
}

/** @deprecated V2 combined analysis result; V3 splits into V3Diagnosis + V3Reference */
export interface V2Rewrite {
  improved_speech: string;
  thought_features: V2ThoughtFeature[];
  key_upgrades: V2KeyUpgrade[];
  authenticity: V2Authenticity;
  integrity_failed?: boolean;
}

// ── V3 Reference type (generate_reference output) ──

export interface V3Reference {
  improved_speech: string;
  thought_features: V2ThoughtFeature[];
  key_upgrades: V2KeyUpgrade[];
  deepening_suggestions: string[];
  thinking_lenses_used: string[];
  authenticity: V2Authenticity;
  integrity_failed?: boolean;
}

// ── Delivery metrics (V4 — null for unmeasured data) ──

export interface DeliveryMetrics {
  // V4 fields (from Edge Function)
  duration_seconds: number;
  target_duration_seconds?: number;
  overtime_seconds?: number;
  transcript_chars?: number;
  chars_per_minute?: number;
  filler_total?: number;
  filler_breakdown?: Record<string, number>;
  // Legacy fields
  pace_wpm: number;
  pause_count: number | null;
  avg_pause_duration_seconds: number | null;
  filler_word_count: number;
  filler_words: string[];
  word_count: number;
}

// ── V2 Comparison types ──

export interface DimensionChange {
  dimension: string;
  round1_score: number;
  round2_score: number;
  delta: number;
  round1_evidence: string;
  round2_evidence: string;
  explanation: string;
}

export interface ProgressPoint {
  area: string;
  detail: string;
}

export interface RemainingIssue {
  area: string;
  detail: string;
  suggestion: string;
}

export interface ReferenceDependency {
  full_reference_viewed: boolean;
  interpretation: string;
}

export type ImprovementQuality =
  | "internalized"
  | "content_better_delivery_worse"
  | "delivery_better_content_flat"
  | "reference_imitation_possible"
  | "mixed"
  | "no_clear_improvement";

export const IMPROVEMENT_QUALITY_LABELS: Record<ImprovementQuality, string> = {
  internalized: "真正内化",
  content_better_delivery_worse: "内容提升但表达牺牲",
  delivery_better_content_flat: "表达改善但内容持平",
  reference_imitation_possible: "可能包含参考模仿",
  mixed: "部分进步",
  no_clear_improvement: "无明显提升",
};

export interface V2Comparison {
  improvement_quality?: ImprovementQuality;
  improvement_analysis?: string;
  dimension_changes: DimensionChange[];
  progress_points: ProgressPoint[];
  remaining_issues: RemainingIssue[];
  reference_dependency: ReferenceDependency;
  knowledge_transfer_growth?: KnowledgeTransferGrowth;
}

// ── V3 Analysis result (diagnosis only, no full speech) ──

export interface ChineseAnalysisResultV3 {
  diagnosis: V3Diagnosis;
  delivery_metrics: DeliveryMetrics;
}

// ── V4 Analysis result ──

export interface ChineseAnalysisResultV4 {
  diagnosis: V4Diagnosis;
  delivery_metrics: DeliveryMetrics;
}

// ── V3 Reference result (on-demand full speech) ──

export interface ChineseReferenceResultV3 {
  reference: V3Reference;
}

// ── V4 Reference result ──

export interface V4Reference {
  improved_speech: string;
  thought_features: V2ThoughtFeature[];
  key_upgrades: V4KeyUpgrade[];
  deepening_suggestions: string[];
  thinking_lenses_used: string[];
  authenticity: V2Authenticity;
  integrity_failed?: boolean;
}

export interface ChineseReferenceResultV4 {
  reference: V4Reference;
}

// ── Database row types ──

export interface ChineseSpeakingSession {
  id: string;
  user_id: string;
  mode: ChineseTrainingMode;
  topic: string;
  topic_type: ChineseTopicType | null;
  prompt: string | null;
  source_title: string | null;
  source_text: string | null;
  source_url: string | null;
  recommended_framework: ChineseFramework | null;
  time_limit_seconds: number;
  material_resource_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChineseSpeakingAttempt {
  id: string;
  session_id: string;
  user_id: string;
  attempt_round: number;
  is_retry: boolean;
  retry_of_attempt_id: string | null;
  audio_url: string | null;
  audio_duration: number | null;
  transcript: string | null;
  edited_transcript: string | null;
  scores: Record<string, unknown> | null;
  diagnosis: Record<string, unknown> | null;
  answer_outline: Record<string, unknown>[] | null;
  final_improved_speech: string | null;
  key_improvements: Record<string, unknown>[] | null;
  delivery_metrics: DeliveryMetrics | null;
  stt_provider: string | null;
  stt_mode: string | null;
  transcript_source: string | null;
  stt_success: boolean | null;
  fallback_used: boolean;
  reference_viewed_before_retry: boolean;
  ai_model: string | null;
  ai_prompt_version: string | null;
  material_understanding: MaterialUnderstanding | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChineseSpeakingSessionWithAttempts extends ChineseSpeakingSession {
  attempts: ChineseSpeakingAttempt[];
}

// ── Generated topic type ──

export type GeneratedTopic = {
  topic: string;
  topic_type: ChineseTopicType;
  description: string;
};

// ── Queries ──

async function fetchChineseSpeakingSessions(): Promise<ChineseSpeakingSessionWithAttempts[]> {
  const { data: sessions, error } = await supabase
    .from("chinese_speaking_sessions")
    .select("*, attempts:chinese_speaking_attempts(*)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (sessions || []) as ChineseSpeakingSessionWithAttempts[];
}

export function useChineseSpeakingSessions() {
  return useQuery({
    queryKey: ["chinese_sessions"],
    queryFn: fetchChineseSpeakingSessions,
    staleTime: 30 * 1000,
  });
}

async function fetchChineseSpeakingSession(id: string): Promise<ChineseSpeakingSessionWithAttempts | null> {
  const { data, error } = await supabase
    .from("chinese_speaking_sessions")
    .select("*, attempts:chinese_speaking_attempts(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data || null) as ChineseSpeakingSessionWithAttempts | null;
}

export function useChineseSpeakingSession(id: string) {
  return useQuery({
    queryKey: ["chinese_session", id],
    queryFn: () => fetchChineseSpeakingSession(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

async function fetchChineseSpeakingStats() {
  const { data: sessions, error: sessionsError } = await supabase
    .from("chinese_speaking_sessions")
    .select("id, topic_type")
    .is("deleted_at", null);

  if (sessionsError) throw sessionsError;

  const { data: attempts, error: attemptsError } = await supabase
    .from("chinese_speaking_attempts")
    .select("session_id, scores, diagnosis, attempt_round, is_retry")
    .is("deleted_at", null);

  if (attemptsError) throw attemptsError;

  function getAttemptScore(a: { scores: unknown; diagnosis: unknown }): number | null {
    const s = a.scores as Record<string, unknown> | null;
    // V1: scores.total
    if (typeof s?.total === "number") return s.total as number;
    // V2: scores.overall_score
    if (typeof s?.overall_score === "number") return s.overall_score as number;
    // V4: diagnosis.overall.score
    const diag = a.diagnosis as Record<string, unknown> | null;
    const overall = diag?.overall as Record<string, unknown> | null;
    if (typeof overall?.score === "number") return overall.score as number;
    return null;
  }

  const r1Attempts = attempts?.filter((a) => a.attempt_round === 1 && !a.is_retry) || [];
  const scoredAttempts = r1Attempts.filter((a) => getAttemptScore(a) != null);
  const retries = attempts?.filter((a) => a.is_retry === true) || [];

  // Per-type averages (V4 uses different rubrics per type)
  const typeScores: Record<string, { total: number; count: number }> = {};
  for (const a of scoredAttempts) {
    const session = sessions?.find((s) => s.id === ((a as Record<string, unknown>).session_id as string));
    const tt = (session?.topic_type as string) || "unknown";
    if (!typeScores[tt]) typeScores[tt] = { total: 0, count: 0 };
    const score = getAttemptScore(a);
    if (score != null) {
      typeScores[tt].total += score;
      typeScores[tt].count += 1;
    }
  }

  const perTypeAvg: Record<string, number> = {};
  for (const [tt, v] of Object.entries(typeScores)) {
    if (v.count > 0) perTypeAvg[tt] = Math.round(v.total / v.count);
  }

  return {
    total_sessions: sessions?.length || 0,
    total_completed: scoredAttempts.length,
    total_retries: retries.length,
    avg_score:
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce((sum, a) => {
              return sum + (getAttemptScore(a) || 0);
            }, 0) / scoredAttempts.length
          )
        : null,
    per_type_avg: perTypeAvg,
  };
}

export function useChineseSpeakingStats() {
  return useQuery({
    queryKey: ["chinese_stats"],
    queryFn: fetchChineseSpeakingStats,
    staleTime: 60 * 1000,
  });
}

// ── Mutations ──

export function useCreateChineseSpeakingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      topic: string;
      topic_type?: ChineseTopicType;
      prompt?: string;
      mode?: ChineseTrainingMode;
      time_limit_seconds?: number;
      source_title?: string;
      source_text?: string;
      source_url?: string;
      material_resource_id?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("chinese_speaking_sessions")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as ChineseSpeakingSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chinese_sessions"] });
      qc.invalidateQueries({ queryKey: ["chinese_stats"] });
    },
  });
}

export function useCreateChineseSpeakingAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      attempt_round: number;
      is_retry: boolean;
      retry_of_attempt_id?: string;
      audio_url?: string;
      audio_duration?: number;
      transcript?: string;
      edited_transcript?: string;
      scores?: Record<string, unknown>;
      diagnosis?: Record<string, unknown>;
      answer_outline?: Record<string, unknown>[];
      final_improved_speech?: string;
      key_improvements?: Record<string, unknown>[];
      delivery_metrics?: DeliveryMetrics;
      stt_provider?: string;
      stt_mode?: string;
      transcript_source?: string;
      stt_success?: boolean;
      fallback_used?: boolean;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("chinese_speaking_attempts")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("chinese_speaking_attempts")
            .select("*")
            .eq("session_id", input.session_id)
            .eq("attempt_round", input.attempt_round)
            .single();
          if (existing) return existing as ChineseSpeakingAttempt;
        }
        throw error;
      }
      return data as ChineseSpeakingAttempt;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["chinese_sessions"] });
      qc.invalidateQueries({ queryKey: ["chinese_stats"] });
      qc.invalidateQueries({ queryKey: ["chinese_session", variables.session_id] });
    },
  });
}

export function useUpdateChineseSpeakingAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      session_id: string;
      updates: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from("chinese_speaking_attempts")
        .update({ ...input.updates, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as ChineseSpeakingAttempt;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["chinese_sessions"] });
      qc.invalidateQueries({ queryKey: ["chinese_stats"] });
      qc.invalidateQueries({ queryKey: ["chinese_session", variables.session_id] });
    },
  });
}

/**
 * Persist reference_viewed_before_retry = true on the attempt.
 * Called immediately when user clicks "查看完整参考" in Round 1 results.
 */
export function useMarkReferenceViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attemptId: string) => {
      const { data, error } = await supabase
        .from("chinese_speaking_attempts")
        .update({ reference_viewed_before_retry: true, updated_at: new Date().toISOString() })
        .eq("id", attemptId)
        .select()
        .single();
      if (error) throw error;
      return data as ChineseSpeakingAttempt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chinese_sessions"] });
    },
  });
}

export function useSoftDeleteChineseSpeakingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const ts = new Date().toISOString();

      const { error: attError } = await supabase
        .from("chinese_speaking_attempts")
        .update({ deleted_at: ts })
        .eq("session_id", sessionId);

      if (attError) throw attError;

      const { data, error } = await supabase
        .from("chinese_speaking_sessions")
        .update({ deleted_at: ts, updated_at: ts })
        .eq("id", sessionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chinese_sessions"] });
      qc.invalidateQueries({ queryKey: ["chinese_stats"] });
    },
  });
}

// ── Audio upload ──

export async function uploadChineseAudio(sessionId: string, blob: Blob): Promise<string> {
  const fileName = `${sessionId}/${Date.now()}.webm`;
  const { data, error } = await supabase.storage
    .from("speaking-audio")
    .upload(fileName, blob, {
      contentType: blob.type || "audio/webm",
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from("speaking-audio").getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ── AI Analysis (V4 — skill-specific diagnosis, single AI call) ──

export async function analyzeChineseExpression(
  topic: string,
  topicType: ChineseTopicType | null,
  transcript: string,
  attemptRound: number,
  durationSeconds = 60,
  targetDurationSeconds = 60,
  materialContext?: Record<string, unknown>,
): Promise<{ success: true; data: ChineseAnalysisResultV4 } | { success: false; error: string }> {
  const payload: Record<string, unknown> = {
    action: "analyze_expression",
    topic,
    topic_type: topicType,
    transcript,
    attempt_round: attemptRound,
    duration_seconds: durationSeconds,
    target_duration_seconds: targetDurationSeconds,
  };
  if (materialContext) {
    payload.material_context = materialContext;
  }
  return invokeAI<ChineseAnalysisResultV4>("chinese-expression-agent", payload, {
    timeout: 180_000,
    retries: 1,
  });
}

// ── Generate Reference (V4 — on-demand full speech, separate AI call) ──

export async function generateChineseReference(
  topic: string,
  transcript: string,
  diagnosis: Record<string, unknown>,
): Promise<{ success: true; data: ChineseReferenceResultV4 } | { success: false; error: string }> {
  return invokeAI<ChineseReferenceResultV4>("chinese-expression-agent", {
    action: "generate_reference",
    topic,
    transcript,
    diagnosis,
  }, {
    timeout: 90_000,
    retries: 1,
  });
}

export async function compareChineseRounds(
  topic: string,
  round1Transcript: string,
  round2Transcript: string,
  round1Scores: Record<string, unknown> | null,
  round2Scores: Record<string, unknown> | null,
  round1Delivery: Record<string, unknown> | null,
  round2Delivery: Record<string, unknown> | null,
  fullReferenceViewed: boolean,
  round1KnowledgeTransfer?: Record<string, unknown> | null,
  round2KnowledgeTransfer?: Record<string, unknown> | null,
): Promise<{ success: true; data: V2Comparison } | { success: false; error: string }> {
  return invokeAI<V2Comparison>("chinese-expression-agent", {
    action: "compare_rounds",
    topic,
    round1_transcript: round1Transcript,
    round2_transcript: round2Transcript,
    round1_scores: round1Scores,
    round2_scores: round2Scores,
    round1_delivery: round1Delivery,
    round2_delivery: round2Delivery,
    full_reference_viewed: fullReferenceViewed,
    round1_knowledge_transfer: round1KnowledgeTransfer ?? null,
    round2_knowledge_transfer: round2KnowledgeTransfer ?? null,
  }, {
    timeout: 120_000,
    retries: 1,
  });
}

export async function generateChineseTopics(
  topicType?: ChineseTopicType,
  count = 3,
): Promise<{ success: true; data: { topics: GeneratedTopic[] } } | { success: false; error: string }> {
  return invokeAI<{ topics: GeneratedTopic[] }>("chinese-expression-agent", {
    action: "generate_topics",
    topic_type: topicType || null,
    count,
  }, {
    timeout: 60_000,
    retries: 1,
  });
}

// ── Phase 3.1: Material Training AI wrappers ──

/** Generate a Material Card from source text. Single AI call — no chaining. */
export async function extractMaterial(
  sourceText: string,
  sourceType: "article" | "video_reflection" | "book_note" = "article",
): Promise<{ success: true; data: ExtractMaterialResult } | { success: false; error: string }> {
  return invokeAI<ExtractMaterialResult>("chinese-expression-agent", {
    action: "extract_material",
    source_text: sourceText.slice(0, 8000),
    source_type: sourceType,
  }, {
    timeout: 120_000,
    retries: 1,
  });
}

/** Generate expression training questions from a material card, optionally scoped to a specific angle. */
export async function generateMaterialQuestions(
  materialCard: MaterialCard,
  selectedAngleIndex?: number,
): Promise<{ success: true; data: { questions: GeneratedMaterialQuestion[] } } | { success: false; error: string }> {
  const context = selectedAngleIndex != null
    ? { selected_angle: materialCard.expression_angles[selectedAngleIndex], material_card: materialCard }
    : { material_card: materialCard };
  return invokeAI<{ questions: GeneratedMaterialQuestion[] }>("chinese-expression-agent", {
    action: "generate_material_questions",
    material_card: context,
  }, {
    timeout: 90_000,
    retries: 1,
  });
}

/** Save a MaterialCard to resources.ai_analysis */
export async function saveMaterialCard(resourceId: string, materialCard: MaterialCard): Promise<void> {
  const { error } = await supabase
    .from("resources")
    .update({ ai_analysis: { material_card: materialCard } })
    .eq("id", resourceId);
  if (error) throw error;
}

// ═══════════════════════════════════════════
// Phase 4: Expression Asset hooks
// ═══════════════════════════════════════════

/** Compute asset quality score from existing data (no AI call) */
export function computeAssetQualityScore(
  assetType: AssetType,
  assetData: AssetData,
  confidence: string,
  tags: string[],
): AssetQualityScore {
  // Completeness: what fraction of required fields are non-empty
  const requiredFields: Record<AssetType, string[]> = {
    personal_story: ["background", "challenge", "action", "result", "reflection"],
    experience_case: ["situation", "task", "action", "result", "learning"],
    viewpoint: ["topic", "my_position", "reasoning", "example"],
    quality_expression: ["original_question", "my_original_answer", "optimized_answer", "why_good"],
    quote: ["quote", "source_context", "my_understanding", "application_scene"],
  };
  const fields = requiredFields[assetType] || [];
  const filled = fields.filter((f) => {
    const val = (assetData as unknown as Record<string, unknown>)[f];
    return typeof val === "string" && val.length > 0;
  }).length;
  const completeness = fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0;

  // Authenticity: based on confidence + evidence presence
  const authenticity = confidence === "high" ? 90 : 70;

  // Reusability: based on tags richness + completeness
  const tagScore = Math.min(tags.length * 20, 60);
  const reusability = Math.round(tagScore + (completeness > 60 ? 30 : completeness > 30 ? 15 : 0));

  return { completeness, authenticity, reusability };
}

/** Search expression assets by keyword, type, scenario */
export function useSearchExpressionAssets(filters: {
  keyword?: string;
  assetType?: AssetType;
  scenario?: string;
  tags?: string[];
}) {
  return useQuery({
    queryKey: ["expression_assets", "search", filters],
    queryFn: async (): Promise<ExpressionAsset[]> => {
      const userId = await getUserId();
      let query = supabase
        .from("expression_assets")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (filters.assetType) query = query.eq("asset_type", filters.assetType);
      if (filters.keyword) {
        query = query.or(`title.ilike.%${filters.keyword}%,extracted_from_transcript.ilike.%${filters.keyword}%`);
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.contains("tags", filters.tags);
      }
      // scenario → tag mapping (client-side filter after fetch)
      const { data, error } = await query;
      if (error) throw error;

      let results = (data || []) as ExpressionAsset[];
      if (filters.scenario) {
        const scenarioTagMap: Record<string, string[]> = {
          "面试": ["面试", "STAR", "自我介绍", "行为面试"],
          "商务沟通": ["商务", "沟通", "谈判", "BD"],
          "演讲表达": ["演讲", "表达", "Presentation"],
          "日常观点": ["观点", "洞察", "思考"],
        };
        const targetTags = scenarioTagMap[filters.scenario] || [filters.scenario];
        results = results.filter((a) => a.tags.some((t) => targetTags.includes(t)));
      }
      return results;
    },
    staleTime: 30_000,
  });
}

/** Fetch asset stats summary for profile integration */
export async function fetchAssetStats(): Promise<{
  total: number;
  by_type: Record<AssetType, number>;
  recently_added: Array<{ id: string; title: string; type: AssetType }>;
  top_tags: string[];
}> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("expression_assets")
    .select("id, asset_type, title, tags")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const assets = (data || []) as ExpressionAsset[];

  const by_type: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  for (const a of assets) {
    by_type[a.asset_type] = (by_type[a.asset_type] || 0) + 1;
    for (const t of a.tags) {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    }
  }

  return {
    total: assets.length,
    by_type: by_type as Record<AssetType, number>,
    recently_added: assets.slice(0, 5).map((a) => ({ id: a.id, title: a.title, type: a.asset_type })),
    top_tags: Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([tag]) => tag),
  };
}

/** Fetch all active expression assets for the current user */
export function useExpressionAssets(assetType?: AssetType) {
  return useQuery({
    queryKey: ["expression_assets", assetType],
    queryFn: async (): Promise<ExpressionAsset[]> => {
      const userId = await getUserId();
      let query = supabase
        .from("expression_assets")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (assetType) query = query.eq("asset_type", assetType);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ExpressionAsset[];
    },
    staleTime: 30_000,
  });
}

/** Save a user-confirmed asset to expression_assets */
export function useSaveExpressionAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (candidate: ExpressionAssetCandidate & {
      source_attempt_id: string;
      source_session_id: string;
    }): Promise<ExpressionAsset> => {
      const userId = await getUserId();
      const qualityScore = computeAssetQualityScore(
        candidate.type,
        candidate.asset_data,
        candidate.confidence,
        candidate.tags,
      );
      const { data, error } = await supabase
        .from("expression_assets")
        .insert({
          user_id: userId,
          asset_type: candidate.type,
          title: candidate.title,
          asset_data: candidate.asset_data,
          source_attempt_id: candidate.source_attempt_id,
          source_session_id: candidate.source_session_id,
          extracted_from_transcript: candidate.extracted_from_transcript,
          evidence_quote: candidate.evidence_quote,
          confidence: candidate.confidence,
          fact_status: "user_confirmed",
          tags: candidate.tags,
          quality_score: qualityScore,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ExpressionAsset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expression_assets"] });
    },
  });
}

/** Soft-delete an asset (set status = 'deleted') */
export function useDeleteExpressionAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string): Promise<void> => {
      const { error } = await supabase
        .from("expression_assets")
        .update({ status: "deleted" })
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expression_assets"] });
    },
  });
}

/** Update an existing asset (e.g., user edits title or tags) */
export function useUpdateExpressionAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: {
      id: string;
      updates: Partial<Pick<ExpressionAsset, "title" | "tags" | "asset_data" | "status">>;
    }): Promise<void> => {
      const updatePayload: Record<string, unknown> = { ...updates, fact_status: "user_edited" };

      // Recompute quality_score if content fields changed
      if (updates.asset_data || updates.tags) {
        const { data: current } = await supabase
          .from("expression_assets")
          .select("asset_type, confidence, asset_data, tags")
          .eq("id", id)
          .single();
        if (current) {
          const newData = updates.asset_data || (current.asset_data as AssetData);
          const newTags = updates.tags || (current.tags as string[]);
          const qualityScore = computeAssetQualityScore(
            current.asset_type as AssetType,
            newData as AssetData,
            current.confidence as string,
            newTags,
          );
          updatePayload.quality_score = qualityScore;
        }
      }

      const { error } = await supabase
        .from("expression_assets")
        .update(updatePayload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expression_assets"] });
    },
  });
}
