// ============================================
// English SRS V3 — Daily Review Session Hook
//
// Anchors 15 daily expressions to a session.
// All training modes read from the same session.
// Supports same-day reinforcement (up to 3 rounds).
// ============================================

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export interface ReviewSession {
  id: string;
  userId: string;
  sessionDate: string;
  targetCount: number;
  status: "active" | "completed" | "abandoned";
  currentStage: "recall" | "sentence" | "application";
  createdAt: string;
  completedAt: string | null;
}

export interface SessionItem {
  id: string;
  sessionId: string;
  expressionId: string;
  recallScore: number | null;
  sentenceScore: number | null;
  applicationScore: number | null;
  userSentence: string | null;
  aiFeedback: string | null;
  status: "pending" | "in_progress" | "passed" | "failed" | "reinforcement" | "completed";
  attemptCount: number;
  reinforcementRound: number;
  lastPracticeAt: string | null;
  // Joined from expressions
  expression?: ExpressionCard;
}

export interface ExpressionCard {
  id: string;
  english: string;
  chinese: string;
  pronunciation?: string;
  example_sentence?: string;
  english_explanation?: string;
  usage_note?: string;
  native_usage?: string;
  context?: string;
  situation?: string;
  common_patterns?: string;
  common_mistakes?: string;
  memory_tip?: string;
  synonyms?: string;
  formality?: string;
  notes?: string;
  cloze_sentence?: string;
  type: string;
  scene: string;
  status: string;
  mastery_level: number;
}

export interface PracticeLogEntry {
  expressionId: string;
  mode: string;
  answer?: string;
  feedback?: string;
  score: number;
  sessionId?: string;
}

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════

const DAILY_TARGET = 15;
const MAX_DAILY_CARDS = 50;
const MAX_REINFORCEMENT_ROUNDS = 3;

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function nowISO(): string {
  return new Date().toISOString();
}

// ═══════════════════════════════════════
// Fetch or create today's session
// ═══════════════════════════════════════

async function fetchOrCreateSession(): Promise<{
  session: ReviewSession;
  items: SessionItem[];
  isNew: boolean;
}> {
  const userId = await getUserId();
  const today = todayStr();

  // 1. Try to get existing session
  const { data: existing } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("session_date", today)
    .limit(1)
    .single();

  if (existing) {
    // Load items with expressions joined
    const { data: items } = await supabase
      .from("review_session_items")
      .select("*, expression:expressions(*)")
      .eq("session_id", existing.id)
      .order("created_at", { ascending: true });

    return {
      session: existing as ReviewSession,
      items: (items || []).map((i: Record<string, unknown>) => formatSessionItem(i)),
      isNew: false,
    };
  }

  // 2. Create new session — select 15 due expressions
  // Same selection logic as fetchDailyReviewQueue
  const EXPRESSION_SELECT =
    "id,english,chinese,pronunciation,example_sentence," +
    "english_explanation,usage_note,native_usage,context,situation," +
    "common_patterns,common_mistakes,memory_tip,synonyms,formality,notes,cloze_sentence," +
    "type,scene,status,mastery_level";

  const { data: dueCards } = await supabase
    .from("expressions")
    .select(EXPRESSION_SELECT)
    .eq("user_id", userId)
    .eq("archived", false)
    .neq("status", "mastered")
    .or(`next_review_date.is.null,next_review_date.lte.${nowISO()}`)
    .order("next_review_date", { ascending: true, nullsFirst: true })
    .limit(Math.min(DAILY_TARGET, MAX_DAILY_CARDS));

  const selectedCards = dueCards || [];

  // Create session
  const { data: session } = await supabase
    .from("review_sessions")
    .insert({
      user_id: userId,
      session_date: today,
      target_count: selectedCards.length,
      status: "active",
      current_stage: "recall",
    })
    .select()
    .single();

  if (!session) throw new Error("Failed to create session");

  // Create session items
  if (selectedCards.length > 0) {
    const items = (selectedCards as unknown as Record<string, unknown>[]).map((card) => ({
      session_id: session.id,
      expression_id: card.id,
      status: "pending",
    }));

    await supabase.from("review_session_items").insert(items);
  }

  // Reload with expressions
  const { data: items } = await supabase
    .from("review_session_items")
    .select("*, expression:expressions(*)")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  return {
    session: session as ReviewSession,
    items: (items || []).map((i: Record<string, unknown>) => formatSessionItem(i)),
    isNew: true,
  };
}

function formatSessionItem(raw: Record<string, unknown>): SessionItem {
  const expr = raw.expression as Record<string, unknown> | null;
  return {
    id: raw.id as string,
    sessionId: raw.session_id as string,
    expressionId: raw.expression_id as string,
    recallScore: raw.recall_score as number | null,
    sentenceScore: raw.sentence_score as number | null,
    applicationScore: raw.application_score as number | null,
    userSentence: raw.user_sentence as string | null,
    aiFeedback: raw.ai_feedback as string | null,
    status: (raw.status as SessionItem["status"]) || "pending",
    attemptCount: (raw.attempt_count as number) || 0,
    reinforcementRound: (raw.reinforcement_round as number) || 0,
    lastPracticeAt: raw.last_practice_at as string | null,
    expression: expr
      ? {
          id: expr.id as string,
          english: expr.english as string,
          chinese: expr.chinese as string,
          pronunciation: expr.pronunciation as string | undefined,
          example_sentence: expr.example_sentence as string | undefined,
          english_explanation: expr.english_explanation as string | undefined,
          usage_note: expr.usage_note as string | undefined,
          native_usage: expr.native_usage as string | undefined,
          context: expr.context as string | undefined,
          situation: expr.situation as string | undefined,
          common_patterns: expr.common_patterns as string | undefined,
          common_mistakes: expr.common_mistakes as string | undefined,
          memory_tip: expr.memory_tip as string | undefined,
          synonyms: expr.synonyms as string | undefined,
          formality: expr.formality as string | undefined,
          notes: expr.notes as string | undefined,
          cloze_sentence: expr.cloze_sentence as string | undefined,
          type: expr.type as string,
          scene: expr.scene as string,
          status: expr.status as string,
          mastery_level: expr.mastery_level as number,
        }
      : undefined,
  };
}

// ═══════════════════════════════════════
// Hooks
// ═══════════════════════════════════════

export function useTodaySession() {
  return useQuery({
    queryKey: ["review-session", "today"],
    queryFn: fetchOrCreateSession,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateSessionItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: Partial<{
        recallScore: number;
        sentenceScore: number;
        applicationScore: number;
        userSentence: string;
        aiFeedback: string;
        status: SessionItem["status"];
        attemptCount: number;
        reinforcementRound: number;
      }>;
    }) => {
      const payload: Record<string, unknown> = {
        last_practice_at: nowISO(),
      };
      if (updates.recallScore !== undefined) payload.recall_score = updates.recallScore;
      if (updates.sentenceScore !== undefined) payload.sentence_score = updates.sentenceScore;
      if (updates.applicationScore !== undefined) payload.application_score = updates.applicationScore;
      if (updates.userSentence !== undefined) payload.user_sentence = updates.userSentence;
      if (updates.aiFeedback !== undefined) payload.ai_feedback = updates.aiFeedback;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.attemptCount !== undefined) payload.attempt_count = updates.attemptCount;
      if (updates.reinforcementRound !== undefined) payload.reinforcement_round = updates.reinforcementRound;

      const { data, error } = await supabase
        .from("review_session_items")
        .update(payload)
        .eq("id", itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-session"] });
    },
  });
}

export function useRecordPracticeLog() {
  return useMutation({
    mutationFn: async (entry: PracticeLogEntry) => {
      const userId = await getUserId();
      const { error } = await supabase.from("expression_practice_logs").insert({
        user_id: userId,
        expression_id: entry.expressionId,
        session_id: entry.sessionId || null,
        mode: entry.mode,
        answer: entry.answer || null,
        feedback: entry.feedback || null,
        score: entry.score,
      });
      if (error) throw error;
    },
  });
}

export function useUpdateSessionStage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      stage,
      status,
    }: {
      sessionId: string;
      stage: ReviewSession["currentStage"];
      status?: ReviewSession["status"];
    }) => {
      const payload: Record<string, unknown> = { current_stage: stage };
      if (status) payload.status = status;
      if (status === "completed") payload.completed_at = nowISO();

      const { error } = await supabase
        .from("review_sessions")
        .update(payload)
        .eq("id", sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-session"] });
    },
  });
}

// ═══════════════════════════════════════
// Helper: get items for current stage
// ═══════════════════════════════════════

export function getStageItems(
  items: SessionItem[],
  stage: ReviewSession["currentStage"],
): SessionItem[] {
  // For recall: return pending items + reinforcement items
  if (stage === "recall") {
    return items.filter(
      (i) =>
        i.status === "pending" ||
        i.status === "reinforcement" ||
        i.status === "failed",
    );
  }
  // For sentence: return items that passed recall or are pending in sentence
  if (stage === "sentence") {
    return items.filter(
      (i) =>
        i.status === "passed" ||
        i.status === "completed" ||
        i.sentenceScore === null,
    );
  }
  // For application: all non-completed items
  if (stage === "application") {
    return items.filter((i) => i.status !== "completed");
  }
  return items;
}

export function getReinforcementItems(items: SessionItem[]): SessionItem[] {
  return items.filter(
    (i) => i.status === "failed" || i.status === "reinforcement",
  );
}

// ═══════════════════════════════════════
// V3.1: AI Diagnosis
// ═══════════════════════════════════════

export interface DifficultyDiagnosis {
  problem_type: "memory" | "application" | "context" | "fluency";
  sub_problems: string[];
  suggestion: string;
  confidence: number;
}

export function useDiagnoseItem() {
  return useMutation({
    mutationFn: async ({
      itemId,
      expressionEnglish,
      expressionChinese,
      expressionExample,
      score,
      sessionId,
      recentAttempts,
    }: {
      itemId: string;
      expressionEnglish: string;
      expressionChinese: string;
      expressionExample?: string;
      score: number;
      sessionId?: string;
      recentAttempts?: Array<{ expression: string; score: number; status: string }>;
    }): Promise<DifficultyDiagnosis> => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/diagnose-difficulty-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            expressionEnglish,
            expressionChinese,
            expressionExample,
            score,
            itemId,
            sessionId,
            recentAttempts,
          }),
        },
      );

      if (!res.ok) throw new Error(`Diagnosis failed: ${res.status}`);
      const data = await res.json();
      return data.diagnosis as DifficultyDiagnosis;
    },
  });
}

// ═══════════════════════════════════════
// V3.1: Personal Practice Context
// ═══════════════════════════════════════

export interface PersonalPracticeContext {
  asset_id?: string;
  asset_title?: string;
  scenario: string;
  prompt: string;
  matched_assets: Array<{
    asset_id: string;
    title: string;
    asset_type: string;
    match_score: number;
  }>;
}

export function usePersonalPracticePrompt() {
  return useMutation({
    mutationFn: async ({
      itemId,
      expressionEnglish,
      expressionChinese,
      expressionExample,
      expressionType,
      sessionId,
    }: {
      itemId: string;
      expressionEnglish: string;
      expressionChinese: string;
      expressionExample?: string;
      expressionType?: string;
      sessionId?: string;
    }): Promise<PersonalPracticeContext> => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personal-practice-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            expressionEnglish,
            expressionChinese,
            expressionExample,
            expressionType,
            itemId,
            sessionId,
          }),
        },
      );

      if (!res.ok) throw new Error(`Personal practice failed: ${res.status}`);
      const data = await res.json();
      return data.context as PersonalPracticeContext;
    },
  });
}

// ═══════════════════════════════════════
// V3.1: Adaptive Reinforcement
// ═══════════════════════════════════════

export type ReinforcementStatus =
  | "none"
  | "queued"
  | "round1_recall"
  | "round2_cloze"
  | "round3_context"
  | "mastered"
  | "max_rounds";

export function useUpdateReinforcementStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      reinforcementStatus,
      resultClassification,
      reinforcementRound,
    }: {
      itemId: string;
      reinforcementStatus: ReinforcementStatus;
      resultClassification?: "mastered" | "needs_reinforcement" | "needs_context";
      reinforcementRound?: number;
    }) => {
      const payload: Record<string, unknown> = {
        reinforcement_status: reinforcementStatus,
        last_practice_at: nowISO(),
      };
      if (resultClassification) payload.result_classification = resultClassification;
      if (reinforcementRound !== undefined) payload.reinforcement_round = reinforcementRound;

      const { error } = await supabase
        .from("review_session_items")
        .update(payload)
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-session"] });
    },
  });
}

export function useBatchUpdateReinforcement() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      items,
    }: {
      items: Array<{
        itemId: string;
        reinforcementStatus: ReinforcementStatus;
        resultClassification?: string;
        reinforcementRound: number;
      }>;
    }) => {
      const updates = items.map((item) => ({
        id: item.itemId,
        reinforcement_status: item.reinforcementStatus,
        result_classification: item.resultClassification || null,
        reinforcement_round: item.reinforcementRound,
        last_practice_at: nowISO(),
      }));

      const { error } = await supabase.from("review_session_items").upsert(updates);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["review-session"] });
    },
  });
}

// ═══════════════════════════════════════
// V3.1: Learning History
// ═══════════════════════════════════════

export interface DailySummary {
  date: string;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  avgRecallScore: number;
  reinforcementCount: number;
  completed: boolean;
}

export interface ProblemArea {
  expression: string;
  chinese: string;
  failCount: number;
  problemType: string;
  lastAttempt: string;
}

export interface LearningHistoryData {
  todaySession: {
    total: number;
    passed: number;
    failed: number;
    reinforcement: number;
    completed: boolean;
  } | null;
  last30Days: DailySummary[];
  problemAreas: ProblemArea[];
  totalPracticeLogs: number;
  streak: number;
}

export function useLearningHistory() {
  return useQuery({
    queryKey: ["learning-history"],
    queryFn: async (): Promise<LearningHistoryData> => {
      const userId = await getUserId();
      const today = todayStr();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sinceDate = thirtyDaysAgo.toISOString().split("T")[0];

      // 1. Today's session
      const { data: todaySession } = await supabase
        .from("review_sessions")
        .select("id,status,target_count")
        .eq("user_id", userId)
        .eq("session_date", today)
        .limit(1)
        .single();

      let todayData: LearningHistoryData["todaySession"] = null;
      if (todaySession) {
        const { data: todayItems } = await supabase
          .from("review_session_items")
          .select("status,recall_score,reinforcement_round")
          .eq("session_id", todaySession.id);

        const items = todayItems || [];
        todayData = {
          total: items.length,
          passed: items.filter((i) => i.status === "passed" || i.status === "completed").length,
          failed: items.filter((i) => i.status === "failed" || i.status === "reinforcement").length,
          reinforcement: items.filter((i) => (i.reinforcement_round || 0) > 0).length,
          completed: todaySession.status === "completed",
        };
      }

      // 2. 30-day summary from practice logs
      const { data: practiceLogs } = await supabase
        .from("expression_practice_logs")
        .select("created_at,score,mode")
        .eq("user_id", userId)
        .gte("created_at", `${sinceDate}T00:00:00`)
        .order("created_at", { ascending: true });

      const logs = practiceLogs || [];
      const dailyMap = new Map<string, { scores: number[]; modes: string[] }>();
      for (const log of logs) {
        const date = (log.created_at as string).split("T")[0];
        if (!dailyMap.has(date)) dailyMap.set(date, { scores: [], modes: [] });
        const d = dailyMap.get(date)!;
        d.scores.push(log.score as number);
        d.modes.push(log.mode as string);
      }

      const last30Days: DailySummary[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        const dayData = dailyMap.get(ds);
        const scores = dayData?.scores || [];
        last30Days.push({
          date: ds,
          totalItems: scores.length,
          passedItems: scores.filter((s) => s >= 3).length,
          failedItems: scores.filter((s) => s < 3).length,
          avgRecallScore: scores.length > 0
            ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
            : 0,
          reinforcementCount: (dayData?.modes || []).filter((m) =>
            m === "cloze" || m === "context",
          ).length,
          completed: false,
        });
      }

      // 3. Problem areas from session items with diagnosis
      const { data: failedItems } = await supabase
        .from("review_session_items")
        .select("expression:expressions(english,chinese),recall_score,difficulty_diagnosis,last_practice_at,result_classification")
        .eq("status", "failed")
        .gte("last_practice_at", `${sinceDate}T00:00:00`)
        .order("last_practice_at", { ascending: false })
        .limit(20);

      // Group by expression
      const failMap = new Map<string, { chinese: string; count: number; problemType: string; lastAttempt: string }>();
      for (const item of (failedItems || [])) {
        const expr = item.expression as unknown as Record<string, unknown> | null;
        const key = (expr?.english as string) || "unknown";
        const diagnosis = item.difficulty_diagnosis as Record<string, unknown> | null;

        if (!failMap.has(key)) {
          failMap.set(key, {
            chinese: (expr?.chinese as string) || "",
            count: 0,
            problemType: (diagnosis?.problem_type as string) || "memory",
            lastAttempt: (item.last_practice_at as string) || "",
          });
        }
        failMap.get(key)!.count++;
      }

      const problemAreas: ProblemArea[] = [...failMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
        .map(([expression, data]) => ({
          expression,
          chinese: data.chinese,
          failCount: data.count,
          problemType: data.problemType,
          lastAttempt: data.lastAttempt,
        }));

      // 4. Streak (consecutive days with at least 1 practice log)
      let streak = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        if (dailyMap.has(ds) && (dailyMap.get(ds)?.scores.length || 0) > 0) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }

      return {
        todaySession: todayData,
        last30Days,
        problemAreas,
        totalPracticeLogs: logs.length,
        streak,
      };
    },
    staleTime: 120_000,
  });
}

// ═══════════════════════════════════════
// V3.3: Today's practice logs (for mode progress tracking)
// ═══════════════════════════════════════

export interface TodayPracticeLogs {
  clozeIds: Set<string>;
  sentenceIds: Set<string>;
  clozeResults: Map<string, { result: "correct" | "partially_correct" | "incorrect"; userAnswer: string }>;
  sentenceResults: Map<string, { sentence: string }>;
}

export function useTodayPracticeLogs(sessionId?: string | null) {
  return useQuery({
    queryKey: ["practice-logs", "today", sessionId],
    queryFn: async (): Promise<TodayPracticeLogs> => {
      if (!sessionId) return { clozeIds: new Set(), sentenceIds: new Set(), clozeResults: new Map(), sentenceResults: new Map() };

      const userId = await getUserId();
      const today = todayStr();

      const { data: logs } = await supabase
        .from("expression_practice_logs")
        .select("expression_id,mode,answer,score,feedback")
        .eq("user_id", userId)
        .eq("session_id", sessionId)
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: true }); // V3.5: latest attempt wins for daily stats

      const clozeIds = new Set<string>();
      const sentenceIds = new Set<string>();
      const clozeResults = new Map<string, { result: "correct" | "partially_correct" | "incorrect"; userAnswer: string }>();
      const sentenceResults = new Map<string, { sentence: string }>();

      for (const log of (logs || [])) {
        if (log.mode === "cloze") {
          clozeIds.add(log.expression_id as string);
          const s = log.score as number;
          clozeResults.set(log.expression_id as string, {
            result: s >= 2 ? "correct" : s >= 1 ? "partially_correct" : "incorrect",
            userAnswer: (log.answer as string) || "",
          });
        } else if (log.mode === "sentence") {
          sentenceIds.add(log.expression_id as string);
          sentenceResults.set(log.expression_id as string, {
            sentence: (log.answer as string) || "",
          });
        }
      }

      return { clozeIds, sentenceIds, clozeResults, sentenceResults };
    },
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

// ═══════════════════════════════════════
// V3.5: Unified daily review progress (single source of truth)
//
// Used by Review page, AI summary, and Hub to compute
// per-expression daily state consistently.
// ═══════════════════════════════════════

export interface DailyExpressionProgress {
  expressionId: string;
  english: string;
  chinese: string;
  recall: {
    completed: boolean;
    score: number | null;
    rating: "again" | "hard" | "good" | "easy" | null;
    status: string;
    reinforcementRound: number;
  };
  cloze: {
    completed: boolean;
    result: "correct" | "partially_correct" | "incorrect" | null;
    userAnswer: string | null;
  };
  sentence: {
    completed: boolean;
    userSentence: string | null;
    aiFeedback: string | null;
  };
}

export interface DailyReviewProgress {
  sessionId: string;
  date: string;
  expressions: DailyExpressionProgress[];
  totalExpressions: number;
  recallCompleted: number;
  recallCorrect: number;
  clozeCompleted: number;
  clozeCorrect: number;
  sentenceCompleted: number;
}

/**
 * Pure function: compute per-expression daily progress from session items + practice logs.
 * This is the SINGLE source of truth for daily review progress computation.
 */
export function getDailyReviewProgress(
  sessionId: string,
  items: SessionItem[],
  practiceLogs: TodayPracticeLogs,
): DailyReviewProgress {
  const expressions: DailyExpressionProgress[] = items.map((item) => {
    const expr = item.expression;
    const recallScore = item.recallScore;
    const recallCompleted = recallScore !== null;
    const rating: "again" | "hard" | "good" | "easy" | null =
      recallScore !== null
        ? recallScore >= 4
          ? "good"
          : "hard"
        : null;

    const clozeResult = practiceLogs.clozeResults.get(item.expressionId) || null;

    return {
      expressionId: item.expressionId,
      english: expr?.english || "unknown",
      chinese: expr?.chinese || "",
      recall: {
        completed: recallCompleted,
        score: recallScore,
        rating,
        status: item.status,
        reinforcementRound: item.reinforcementRound || 0,
      },
      cloze: {
        completed: practiceLogs.clozeIds.has(item.expressionId),
        result: clozeResult?.result || null,
        userAnswer: clozeResult?.userAnswer || null,
      },
      sentence: {
        completed: practiceLogs.sentenceIds.has(item.expressionId) || item.userSentence !== null,
        userSentence: item.userSentence || practiceLogs.sentenceResults.get(item.expressionId)?.sentence || null,
        aiFeedback: item.aiFeedback || null,
      },
    };
  });

  return {
    sessionId,
    date: todayStr(),
    expressions,
    totalExpressions: items.length,
    recallCompleted: items.filter((i) => i.recallScore !== null).length,
    recallCorrect: items.filter((i) => i.recallScore !== null && i.recallScore >= 3).length,
    clozeCompleted: practiceLogs.clozeIds.size,
    clozeCorrect: [...practiceLogs.clozeResults.values()].filter((r) => r.result === "correct").length,
    sentenceCompleted: practiceLogs.sentenceIds.size,
  };
}

/**
 * Hook: fetch and compute unified daily review progress.
 * Used by Review page to replace inline aggregation.
 */
export function useDailyReviewProgress(
  sessionId: string | undefined | null,
  items: SessionItem[],
) {
  const { data: practiceLogs } = useTodayPracticeLogs(sessionId);

  return useMemo(() => {
    if (!sessionId || items.length === 0) return null;
    return getDailyReviewProgress(
      sessionId,
      items,
      practiceLogs || { clozeIds: new Set(), sentenceIds: new Set(), clozeResults: new Map(), sentenceResults: new Map() },
    );
  }, [sessionId, items, practiceLogs]);
}

export function getSessionStats(items: SessionItem[]) {
  const total = items.length;
  const passed = items.filter((i) => i.status === "passed" || i.status === "completed").length;
  const failed = items.filter((i) => i.status === "failed" || i.status === "reinforcement").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;

  return { total, passed, failed, pending, inProgress };
}

// ═══════════════════════════════════════
// V3.2: Detailed Session History (per-round breakdown)
// ═══════════════════════════════════════

export interface SentenceDetail {
  expressionEnglish: string;
  expressionChinese: string;
  userSentence: string;
  aiFeedback: string | null;
  completedAt: string | null;
}

export interface SessionDetailData {
  sessionId: string;
  sessionDate: string;
  status: string;
  targetCount: number;
  // Round 1: Active Recall
  round1Total: number;
  round1FirstPassed: number;   // recall_score >= 3, reinforcement_round = 0
  round1FirstFailed: number;   // recall_score < 3, reinforcement_round = 0
  // Reinforcement
  reinforcementCount: number;   // items that entered reinforcement
  reinforcedPassed: number;     // reinforced then eventually passed
  // Round 2: Cloze (from practice logs)
  round2Total: number;
  round2Passed: number;
  // Round 3: Sentence
  round3Total: number;
  round3Completed: number;
  sentenceDetails: SentenceDetail[];
  // Difficult expressions (still failed/reinforcement at session end)
  difficultExpressions: Array<{
    english: string;
    chinese: string;
    recallScore: number | null;
    status: string;
  }>;
}

export function useSessionDetail() {
  return useQuery({
    queryKey: ["session-detail", "today"],
    queryFn: async (): Promise<SessionDetailData | null> => {
      const userId = await getUserId();
      const today = todayStr();

      // Get today's session
      const { data: session } = await supabase
        .from("review_sessions")
        .select("id,session_date,status,target_count")
        .eq("user_id", userId)
        .eq("session_date", today)
        .limit(1)
        .single();

      if (!session) return null;

      // Get session items with expressions
      const { data: items } = await supabase
        .from("review_session_items")
        .select("*, expression:expressions(english,chinese)")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      const sessionItems = (items || []) as unknown as Array<{
        id: string;
        status: string;
        recall_score: number | null;
        reinforcement_round: number;
        user_sentence: string | null;
        ai_feedback: string | null;
        last_practice_at: string | null;
        expression: { english: string; chinese: string } | null;
      }>;

      // Round 1 stats: first recall attempt
      const round1Total = sessionItems.length;
      const round1FirstPassed = sessionItems.filter(
        (i) => i.recall_score !== null && i.recall_score >= 3 && i.reinforcement_round === 0,
      ).length;
      const round1FirstFailed = sessionItems.filter(
        (i) => i.recall_score !== null && i.recall_score < 3 && i.reinforcement_round === 0,
      ).length;

      // Reinforcement stats
      const reinforcementCount = sessionItems.filter(
        (i) => (i.reinforcement_round || 0) > 0,
      ).length;
      const reinforcedPassed = sessionItems.filter(
        (i) => (i.reinforcement_round || 0) > 0 && (i.recall_score || 0) >= 3,
      ).length;

      // Round 2: Cloze from practice logs
      const { data: clozeLogs } = await supabase
        .from("expression_practice_logs")
        .select("expression_id,score")
        .eq("user_id", userId)
        .eq("session_id", session.id)
        .eq("mode", "cloze");

      const clozeSet = new Set((clozeLogs || []).map((l) => l.expression_id));
      const round2Total = round1Total;
      const round2Passed = (clozeLogs || []).filter((l) => l.score >= 3).length;

      // Round 3: Sentence
      const sentenceItems = sessionItems.filter((i) => i.user_sentence !== null);
      const round3Total = round1Total;
      const round3Completed = sentenceItems.length;

      // Sentence details
      const sentenceDetails: SentenceDetail[] = sentenceItems.map((i) => ({
        expressionEnglish: i.expression?.english || "unknown",
        expressionChinese: i.expression?.chinese || "",
        userSentence: i.user_sentence || "",
        aiFeedback: i.ai_feedback || null,
        completedAt: i.last_practice_at || null,
      }));

      // Difficult expressions
      const difficultExpressions = sessionItems
        .filter((i) => i.status === "failed" || i.status === "reinforcement")
        .map((i) => ({
          english: i.expression?.english || "unknown",
          chinese: i.expression?.chinese || "",
          recallScore: i.recall_score,
          status: i.status,
        }));

      return {
        sessionId: session.id,
        sessionDate: session.session_date,
        status: session.status,
        targetCount: session.target_count,
        round1Total,
        round1FirstPassed,
        round1FirstFailed,
        reinforcementCount,
        reinforcedPassed,
        round2Total,
        round2Passed,
        round3Total,
        round3Completed,
        sentenceDetails,
        difficultExpressions,
      };
    },
    staleTime: 120_000,
  });
}
