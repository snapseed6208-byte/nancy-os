// ============================================
// Nancy OS — Chinese Expression Training Hooks
// 中文表达训练: types, queries, mutations, AI
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";

// ── Types ──

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

// ── Attempt scoring types ──

export interface DimensionScore {
  name: string;
  score: number;
  max_score: number;
  comment: string;
  quotes: string[];
}

export interface AttemptScores {
  total: number;
  verdict: string;
  dimensions: DimensionScore[];
}

export interface TopProblem {
  problem: string;
  severity: "high" | "medium" | "low";
  example: string;
  suggestion: string;
}

export interface AttemptDiagnosis {
  top_3_problems: TopProblem[];
  framework_reason: string;
  recommended_framework: ChineseFramework;
}

export interface OutlineStep {
  step: number;
  label: string;
  guidance: string;
  time_hint_seconds: number;
}

export interface KeyImprovement {
  title: string;
  description: string;
}

export interface DeliveryMetrics {
  pace_wpm: number;
  pause_count: number;
  avg_pause_duration_seconds: number;
  filler_word_count: number;
  filler_words: string[];
  duration_seconds: number;
  word_count: number;
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
  scores: AttemptScores | null;
  diagnosis: AttemptDiagnosis | null;
  answer_outline: OutlineStep[] | null;
  final_improved_speech: string | null;
  key_improvements: KeyImprovement[] | null;
  delivery_metrics: DeliveryMetrics | null;
  stt_provider: string | null;
  stt_mode: string | null;
  fallback_used: boolean;
  ai_model: string | null;
  ai_prompt_version: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ChineseSpeakingSessionWithAttempts extends ChineseSpeakingSession {
  attempts: ChineseSpeakingAttempt[];
}

// ── AI result types ──

export interface ChineseAnalysisResult {
  scores: AttemptScores;
  diagnosis: AttemptDiagnosis;
  answer_outline: OutlineStep[];
  final_improved_speech: string;
  key_improvements: KeyImprovement[];
  delivery_metrics: DeliveryMetrics;
}

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
    .select("id")
    .is("deleted_at", null);

  if (sessionsError) throw sessionsError;

  const { data: attempts, error: attemptsError } = await supabase
    .from("chinese_speaking_attempts")
    .select("scores, attempt_round, is_retry")
    .is("deleted_at", null);

  if (attemptsError) throw attemptsError;

  const completedAttempts = attempts?.filter((a) => a.scores?.total != null) || [];
  const retries = attempts?.filter((a) => a.is_retry === true) || [];

  return {
    total_sessions: sessions?.length || 0,
    total_completed: completedAttempts.length,
    total_retries: retries.length,
    avg_score:
      completedAttempts.length > 0
        ? Math.round(
            completedAttempts.reduce((sum, a) => sum + (a.scores as AttemptScores).total, 0) /
              completedAttempts.length
          )
        : null,
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
      scores?: AttemptScores;
      diagnosis?: AttemptDiagnosis;
      answer_outline?: OutlineStep[];
      final_improved_speech?: string;
      key_improvements?: KeyImprovement[];
      delivery_metrics?: DeliveryMetrics;
      stt_provider?: string;
      stt_mode?: string;
      fallback_used?: boolean;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("chinese_speaking_attempts")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) {
        // If duplicate session+round, return existing
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
      updates: Partial<{
        transcript: string;
        edited_transcript: string;
        scores: AttemptScores;
        diagnosis: AttemptDiagnosis;
        answer_outline: OutlineStep[];
        final_improved_speech: string;
        key_improvements: KeyImprovement[];
        delivery_metrics: DeliveryMetrics;
        audio_url: string;
        audio_duration: number;
        stt_provider: string;
        stt_mode: string;
        fallback_used: boolean;
      }>;
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

// ── Audio upload (reused from English module) ──

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

// ── AI Analysis ──

export async function analyzeChineseExpression(
  topic: string,
  topicType: ChineseTopicType | null,
  transcript: string,
  attemptRound: number,
): Promise<{ success: true; data: ChineseAnalysisResult } | { success: false; error: string }> {
  return invokeAI<ChineseAnalysisResult>("chinese-expression-agent", {
    action: "analyze_expression",
    topic,
    topic_type: topicType,
    transcript,
    attempt_round: attemptRound,
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
