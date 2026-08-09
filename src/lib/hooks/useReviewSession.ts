// ============================================
// English SRS V3 — Daily Review Session Hook
//
// Anchors 15 daily expressions to a session.
// All training modes read from the same session.
// Supports same-day reinforcement (up to 3 rounds).
// ============================================

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
  const { data: dueCards } = await supabase
    .from("expressions")
    .select("id,english,chinese,pronunciation,example_sentence,type,scene,status,mastery_level")
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
    const items = selectedCards.map((card: Record<string, unknown>) => ({
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

export function getSessionStats(items: SessionItem[]) {
  const total = items.length;
  const passed = items.filter((i) => i.status === "passed" || i.status === "completed").length;
  const failed = items.filter((i) => i.status === "failed" || i.status === "reinforcement").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;

  return { total, passed, failed, pending, inProgress };
}
