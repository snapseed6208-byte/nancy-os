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
import {
  insertPracticeLog,
  updatePracticeLog,
  type PracticeLogMode,
} from "@/lib/english/practiceLogRepository";
import {
  getShanghaiDateKey,
  getShanghaiISO,
  getOrCreateEnglishSession,
  findEnglishSession,
  fetchSessionItems,
  createSessionItems,
  createLearnSessionWithTarget,
  appendLearnItems,
  countAvailableLearnExpressions,
  MAX_LEARN_TARGET,
  classifySessionError,
  SessionErrorCode,
  type SessionType,
  type CreateLearnSessionResult,
  type AppendLearnItemsResult,
} from "@/lib/english/sessionRepository";
import {
  fetchDueExpressionsFull,
  getDuePoolCount,
} from "@/lib/english/reviewRepository";
import { toProgressJSON } from "@/lib/english/learningProgress";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

import type { LearnStage, LearningItemProgress } from "@/lib/english/learningProgress";
export type { LearnStage, LearningItemProgress };

export interface ReviewSession {
  id: string;
  userId: string;
  sessionDate: string;
  targetCount: number;
  status: "active" | "completed" | "abandoned";
  currentStage: "recall" | "sentence" | "application";
  sessionType: "learn" | "review";
  createdAt: string;
  completedAt: string | null;
  learnProgress?: LearningItemProgress | null;
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
  status: "pending" | "in_progress" | "passed" | "failed" | "reinforcement" | "completed" | "skipped_no_question";
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
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════

const DAILY_TARGET = 15;
const MAX_DAILY_CARDS = 50;
const MAX_REINFORCEMENT_ROUNDS = 3;

const EXPRESSION_SELECT =
  "id,english,chinese,pronunciation,example_sentence," +
  "english_explanation,usage_note,native_usage,context,situation," +
  "common_patterns,common_mistakes,memory_tip,synonyms,formality,notes,cloze_sentence," +
  "type,scene,status,mastery_level";

function todayStr(): string {
  return getShanghaiDateKey();
}

function nowISO(): string {
  return getShanghaiISO();
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
  const reviewLimit = Math.min(DAILY_TARGET, MAX_DAILY_CARDS);

  const { session: sessionData, isNew } = await getOrCreateEnglishSession({
    userId,
    date: today,
    sessionType: "review",
  });

  // ── Existing session (resume) ──
  if (!isNew) {
    const items = await fetchSessionItems(sessionData.id);

    // PART 4 case C: session row exists but has 0 items (created when due pool
    // was 0, e.g. early-morning UTC window). Backfill from live due pool so
    // the review page never shows "今日无事" when expressions are actually due.
    if (items.length === 0) {
      const dueExprs = await fetchDueExpressionsFull(userId, reviewLimit);
      if (dueExprs.length > 0) {
        await createSessionItems(
          sessionData.id,
          dueExprs.map((e) => e.id as string),
        );
        await supabase
          .from("review_sessions")
          .update({ target_count: dueExprs.length })
          .eq("id", sessionData.id);

        const populatedItems = await fetchSessionItems(sessionData.id);
        return {
          session: { ...sessionData, targetCount: dueExprs.length },
          items: populatedItems,
          isNew: false,
        };
      }
    }

    return { session: sessionData, items, isNew: false };
  }

  // ── Brand-new session ──
  const dueExprs = await fetchDueExpressionsFull(userId, reviewLimit);

  await supabase
    .from("review_sessions")
    .update({ target_count: dueExprs.length })
    .eq("id", sessionData.id);

  await createSessionItems(
    sessionData.id,
    dueExprs.map((e) => e.id as string),
  );

  const items = await fetchSessionItems(sessionData.id);

  return {
    session: { ...sessionData, targetCount: dueExprs.length },
    items,
    isNew: true,
  };
}

// ═══════════════════════════════════════
// V4.3: Adaptive Daily Learning Target
//
// Learning workload = the user decides. Review timing = SRS decides. Never bind.
// The user can learn 5 today, 20 tomorrow, 0 the day after — all valid.
// ═══════════════════════════════════════

export const LEARN_TARGET_PRESETS = [
  { value: 5, label: "轻松" },
  { value: 10, label: "标准" },
  { value: 15, label: "专注" },
  { value: 20, label: "冲刺" },
] as const;

export const DEFAULT_LEARN_TARGET = 10;
export { MAX_LEARN_TARGET };

const LEARN_TARGET_STORAGE_KEY = "english_learning_target";

/** Remember the user's last choice (PART 10) — highlight it tomorrow, never auto-create a session. */
export function getSavedLearnTarget(): number {
  try {
    const raw = localStorage.getItem(LEARN_TARGET_STORAGE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= 1 && n <= MAX_LEARN_TARGET) return n;
  } catch {
    /* storage unavailable — fall back to default */
  }
  return DEFAULT_LEARN_TARGET;
}

export function saveLearnTarget(target: number): void {
  try {
    const n = Math.min(Math.max(1, Math.floor(target)), MAX_LEARN_TARGET);
    localStorage.setItem(LEARN_TARGET_STORAGE_KEY, String(n));
  } catch {
    /* preference is best-effort — never blocks learning */
  }
}

/** A learning item counts as finished once its item row OR its expression reached the review cycle. */
export function isLearnItemFinished(item: SessionItem): boolean {
  if (item.status === "completed") return true;
  const st = item.expression?.status;
  return st === "review" || st === "mastered";
}

/**
 * FETCH-ONLY. Loading the Learn page must NEVER auto-create a session — otherwise
 * a 5-item session would be locked in before the user picks a daily target.
 * Returns { session: null } when the user hasn't started learning today.
 */
async function fetchTodayLearnSession(): Promise<{
  session: ReviewSession | null;
  items: SessionItem[];
}> {
  const userId = await getUserId();
  const today = todayStr();
  const session = await findEnglishSession(userId, today, "learn");
  if (!session) return { session: null, items: [] };
  const items = await fetchSessionItems(session.id);
  return { session, items };
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

/** V4.3: Fetch-only today's learn session (never auto-creates). session is null until the user picks a target. */
export function useTodayLearnSession() {
  return useQuery({
    queryKey: ["learn-session", "today"],
    queryFn: fetchTodayLearnSession,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** V4.3: Create today's learn session with an explicit target (idempotent — re-runs return the same session). */
export function useCreateLearnSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ target }: { target: number }): Promise<CreateLearnSessionResult> => {
      const userId = await getUserId();
      return createLearnSessionWithTarget(userId, todayStr(), target);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learn-session"] });
      qc.invalidateQueries({ queryKey: ["learn-queue-count"] });
      qc.invalidateQueries({ queryKey: ["learn-more-available"] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

/** V4.3: Extend today's session ("今天再学一些") — appends new collected expressions, never a second session. */
export function useAppendLearnItems() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ count }: { count: number }): Promise<AppendLearnItemsResult> => {
      const userId = await getUserId();
      return appendLearnItems(userId, todayStr(), count);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learn-session"] });
      qc.invalidateQueries({ queryKey: ["learn-queue-count"] });
      qc.invalidateQueries({ queryKey: ["learn-more-available"] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

/** V4.3: How many collected/learning expressions remain OUTSIDE today's learn session (今天再学一些 availability). */
export function useLearnMoreAvailable() {
  return useQuery({
    queryKey: ["learn-more-available"],
    queryFn: async (): Promise<number> => {
      const userId = await getUserId();
      return countAvailableLearnExpressions(userId, todayStr());
    },
    staleTime: 60_000,
  });
}

/** V4: Count of collected + learning expressions (learning queue) */
export function useLearnQueueCount() {
  return useQuery({
    queryKey: ["learn-queue-count"],
    queryFn: async (): Promise<number> => {
      const userId = await getUserId();
      const { count, error } = await supabase
        .from("expressions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("archived", false)
        .in("status", ["collected", "learning"]);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
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
        sentenceScore: number | null;
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
    mutationFn: async (entry: PracticeLogEntry): Promise<string> => {
      // Route through the canonical repository so INSERT returns the log id
      // (one sentence = one practice record; completion UPDATES this id).
      return insertPracticeLog({
        expressionId: entry.expressionId,
        sessionId: entry.sessionId,
        mode: entry.mode as PracticeLogMode,
        answer: entry.answer,
        feedback: entry.feedback,
        score: entry.score,
        metadata: entry.metadata,
      });
    },
  });
}

/** V4.2: Persist learn-session progress (expression index + stage + stage-completion flags + recall/sentence evidence). */
export function useUpdateLearnProgress() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      progress,
    }: {
      sessionId: string;
      progress: LearningItemProgress;
    }) => {
      const { error } = await supabase
        .from("review_sessions")
        .update({
          learn_progress: toProgressJSON(progress),
        })
        .eq("id", sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["learn-session"] });
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

      // 1. Today's review session
      const { data: todaySession } = await supabase
        .from("review_sessions")
        .select("id,status,target_count")
        .eq("user_id", userId)
        .eq("session_date", today)
        .eq("session_type", "review")
        .limit(1)
        .maybeSingle();

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

// ═══════════════════════════════════════
// V3.6: Activation State
// ═══════════════════════════════════════

export type ActivationState =
  | "recall_mastered"
  | "context_activated"
  | "production_activated"
  | "fully_activated";

export interface ExpressionActivation {
  expressionId: string;
  english: string;
  activationStates: ActivationState[];
  recallMastered: boolean;
  contextActivated: boolean;
  productionActivated: boolean;
  fullyActivated: boolean;
}

export function computeActivationState(
  progress: DailyExpressionProgress,
  sentenceScore?: number | null,
): ExpressionActivation {
  const recallMastered = progress.recall.completed && (progress.recall.score ?? 0) >= 3;
  const contextActivated = progress.cloze.completed && progress.cloze.result === "correct";
  const productionActivated = progress.sentence.completed && (sentenceScore ?? 0) >= 3;
  const fullyActivated = recallMastered && contextActivated && productionActivated;

  const states: ActivationState[] = [];
  if (fullyActivated) {
    states.push("fully_activated");
  } else {
    if (recallMastered) states.push("recall_mastered");
    if (contextActivated) states.push("context_activated");
    if (productionActivated) states.push("production_activated");
  }

  return {
    expressionId: progress.expressionId,
    english: progress.english,
    activationStates: states,
    recallMastered,
    contextActivated,
    productionActivated,
    fullyActivated,
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
// V3.5: Hub session progress (lightweight)
// ═══════════════════════════════════════

export interface HubSessionProgress {
  hasSession: boolean;
  sessionId: string | null;
  totalExpressions: number;
  recallCompleted: number;
  recallPassed: number;
  clozeCompleted: number;
  clozeCorrect: number;
  sentenceCompleted: number;
  allDone: boolean;
}

export function useHubSessionProgress() {
  return useQuery({
    queryKey: ["hub-session-progress", "today"],
    queryFn: async (): Promise<HubSessionProgress> => {
      const userId = await getUserId();
      const today = todayStr();

      const { data: session } = await supabase
        .from("review_sessions")
        .select("id,status,target_count")
        .eq("user_id", userId)
        .eq("session_date", today)
        .eq("session_type", "review")
        .limit(1)
        .maybeSingle();

      if (!session) {
        return {
          hasSession: false,
          sessionId: null,
          totalExpressions: 0,
          recallCompleted: 0,
          recallPassed: 0,
          clozeCompleted: 0,
          clozeCorrect: 0,
          sentenceCompleted: 0,
          allDone: false,
        };
      }

      const { data: items } = await supabase
        .from("review_session_items")
        .select("id,expression_id,status,recall_score,user_sentence")
        .eq("session_id", session.id);

      const sessionItems = items || [];
      const recallCompleted = sessionItems.filter((i) => i.recall_score !== null).length;
      const recallPassed = sessionItems.filter((i) => i.recall_score !== null && i.recall_score >= 3).length;

      const { data: clozeLogs } = await supabase
        .from("expression_practice_logs")
        .select("expression_id,score,created_at")
        .eq("user_id", userId)
        .eq("session_id", session.id)
        .eq("mode", "cloze")
        .order("created_at", { ascending: true });

      // Dedupe by expression_id: latest attempt wins
      const clozeMap = new Map<string, number>();
      for (const l of (clozeLogs || [])) {
        clozeMap.set(l.expression_id as string, l.score as number);
      }
      const clozeSet = new Set(clozeMap.keys());
      const clozeCorrect = [...clozeMap.values()].filter((s) => s >= 2).length;

      const sentenceCompleted = sessionItems.filter((i) => i.user_sentence !== null).length;

      return {
        hasSession: true,
        sessionId: session.id,
        totalExpressions: sessionItems.length,
        recallCompleted,
        recallPassed,
        clozeCompleted: clozeSet.size,
        clozeCorrect,
        sentenceCompleted,
        allDone: sessionItems.every((i) =>
          i.status === "passed" || i.status === "completed",
        ),
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

// ═══════════════════════════════════════
// V3.5: Historical AI Summaries
// ═══════════════════════════════════════

export interface HistoricalSummary {
  id: string;
  date: string;
  summary: Record<string, unknown>;
  expressionCount: number;
  createdAt: string;
}

export function useHistoricalSummaries(days: number = 14) {
  return useQuery({
    queryKey: ["historical-summaries", days],
    queryFn: async (): Promise<HistoricalSummary[]> => {
      const userId = await getUserId();
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("agent_logs")
        .select("id, input_data, output_data, created_at")
        .eq("user_id", userId)
        .eq("agent_type", "english_coach")
        .eq("action", "daily_summary")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((log: Record<string, unknown>) => {
        const inputData = log.input_data as Record<string, unknown> || {};
        const outputData = log.output_data as Record<string, unknown> || {};
        return {
          id: log.id as string,
          date: (log.created_at as string).split("T")[0],
          summary: (outputData.summary || {}) as Record<string, unknown>,
          expressionCount: inputData.expression_count as number || 0,
          createdAt: log.created_at as string,
        };
      });
    },
    staleTime: 120_000,
  });
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

export interface ExpressionProgressDetail {
  english: string;
  chinese: string;
  recallScore: number | null;
  recallStatus: string;
  clozeResult: "correct" | "partially_correct" | "incorrect" | null;
  userSentence: string | null;
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
  // V3.5: Per-expression breakdown across all modes
  expressionDetails: ExpressionProgressDetail[];
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

      // Get today's review session
      const { data: session } = await supabase
        .from("review_sessions")
        .select("id,session_date,status,target_count")
        .eq("user_id", userId)
        .eq("session_date", today)
        .eq("session_type", "review")
        .limit(1)
        .maybeSingle();

      if (!session) return null;

      // Get session items with expressions
      const { data: items } = await supabase
        .from("review_session_items")
        .select("*, expression:expressions(english,chinese)")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });

      const sessionItems = (items || []) as unknown as Array<{
        id: string;
        expression_id: string;
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

      // Round 2: Cloze from practice logs (latest attempt wins)
      const { data: clozeLogs } = await supabase
        .from("expression_practice_logs")
        .select("expression_id,score,created_at")
        .eq("user_id", userId)
        .eq("session_id", session.id)
        .eq("mode", "cloze")
        .order("created_at", { ascending: true });

      const clozeMap = new Map<string, number>();
      for (const l of (clozeLogs || [])) {
        clozeMap.set(l.expression_id as string, l.score as number);
      }
      const clozeSet = new Set(clozeMap.keys());
      const round2Total = round1Total;
      const round2Passed = [...clozeMap.values()].filter((s) => s >= 2).length;

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

      // V3.5: Per-expression progress across all modes (latest attempt via clozeMap)
      const expressionDetails: ExpressionProgressDetail[] = sessionItems.map((i) => {
        const latestScore = clozeMap.get(i.expression_id);
        const clozeResult: "correct" | "partially_correct" | "incorrect" | null =
          latestScore !== undefined
            ? latestScore >= 2 ? "correct" : latestScore >= 1 ? "partially_correct" : "incorrect"
            : null;

        return {
          english: i.expression?.english || "unknown",
          chinese: i.expression?.chinese || "",
          recallScore: i.recall_score,
          recallStatus: i.status,
          clozeResult,
          userSentence: i.user_sentence || null,
        };
      });

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
        expressionDetails,
        difficultExpressions,
      };
    },
    staleTime: 120_000,
  });
}
