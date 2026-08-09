// ============================================
// English SRS V4.1 — Practice Log Repository
//
// Single source of truth for expression_practice_logs.
// Mirrors the production schema contract:
//   user_id, expression_id, session_id, mode, answer,
//   feedback, score (0-5), metadata JSONB, created_at
//
// Rule: one sentence = one practice record. INSERT once at
// sentence submit, UPDATE on AI feedback and completion.
// ============================================

import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

export type PracticeLogMode =
  | "learn"
  | "recall"
  | "recognition"
  | "cloze"
  | "sentence"
  | "application";

export interface PracticeLogInsert {
  expressionId: string;
  sessionId?: string | null;
  mode: PracticeLogMode;
  answer?: string | null;
  feedback?: string | null;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface PracticeLogUpdate {
  feedback?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

/** INSERT a practice log and return its id. */
export async function insertPracticeLog(entry: PracticeLogInsert): Promise<string> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("expression_practice_logs")
    .insert({
      user_id: userId,
      expression_id: entry.expressionId,
      session_id: entry.sessionId ?? null,
      mode: entry.mode,
      answer: entry.answer ?? null,
      feedback: entry.feedback ?? null,
      score: entry.score,
      metadata: entry.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create practice log");
  return data.id as string;
}

/** UPDATE an existing practice log (AI feedback, completion metadata). */
export async function updatePracticeLog(id: string, updates: PracticeLogUpdate): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.feedback !== undefined) payload.feedback = updates.feedback;
  if (updates.score !== undefined) payload.score = updates.score;
  if (updates.metadata !== undefined) payload.metadata = updates.metadata;

  const { error } = await supabase
    .from("expression_practice_logs")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}
