// ============================================
// English SRS V4 — Session Repository
//
// Single source of truth for review_sessions DB access.
// - Timezone-correct date keys (Asia/Shanghai)
// - Idempotent get-or-create
// - Error classification
// ============================================

import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import type { ReviewSession, SessionItem, ExpressionCard } from "@/lib/hooks/useReviewSession";
import { parseProgressJSON } from "@/lib/english/learningProgress";

// ═══════════════════════════════════════
// Date Utilities
// ═══════════════════════════════════════

const SHANGHAI_TZ = "Asia/Shanghai";

/**
 * Returns today's date string in Asia/Shanghai timezone (YYYY-MM-DD).
 * All session date operations MUST use this instead of toISOString().
 */
export function getShanghaiDateKey(date?: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date ?? new Date());
}

/**
 * Returns current ISO timestamp.
 */
export function getShanghaiISO(): string {
  return new Date().toISOString();
}

// ═══════════════════════════════════════
// Session Types
// ═══════════════════════════════════════

export type SessionType = "learn" | "review";

export interface CreateSessionParams {
  userId: string;
  date: string;
  sessionType: SessionType;
  targetCount?: number;
}

export interface GetOrCreateResult {
  session: ReviewSession;
  isNew: boolean;
}

// ═══════════════════════════════════════
// Error Classification
// ═══════════════════════════════════════

export enum SessionErrorCode {
  NOT_FOUND = "SESSION_NOT_FOUND",
  DUPLICATE = "SESSION_DUPLICATE",
  UNAUTHORIZED = "SESSION_UNAUTHORIZED",
  DB_ERROR = "SESSION_DB_ERROR",
  UNKNOWN = "SESSION_UNKNOWN",
}

export class SessionError extends Error {
  code: SessionErrorCode;
  status: number;
  originalError?: unknown;

  constructor(code: SessionErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = "SessionError";
    this.code = code;
    this.status = sessionErrorStatus(code);
    this.originalError = originalError;
  }
}

function sessionErrorStatus(code: SessionErrorCode): number {
  switch (code) {
    case SessionErrorCode.NOT_FOUND: return 404;
    case SessionErrorCode.DUPLICATE: return 409;
    case SessionErrorCode.UNAUTHORIZED: return 401;
    case SessionErrorCode.DB_ERROR: return 500;
    default: return 500;
  }
}

export function classifySessionError(err: unknown): SessionError {
  if (err instanceof SessionError) return err;

  const pgError = err as { code?: string; message?: string; status?: number };
  const pgCode = pgError.code;

  // PostgreSQL unique violation
  if (pgCode === "23505") {
    return new SessionError(
      SessionErrorCode.DUPLICATE,
      "A session already exists for this date and type",
      err,
    );
  }

  // PostgreSQL not found or 0 rows
  if (pgCode === "PGRST116" || pgError.status === 406) {
    return new SessionError(
      SessionErrorCode.NOT_FOUND,
      "Session not found",
      err,
    );
  }

  // Auth errors
  if (pgError.status === 401 || pgCode === "PGRST301") {
    return new SessionError(
      SessionErrorCode.UNAUTHORIZED,
      "Not authenticated",
      err,
    );
  }

  return new SessionError(
    SessionErrorCode.DB_ERROR,
    pgError.message || "Unknown database error",
    err,
  );
}

// ═══════════════════════════════════════
// Query: Find existing session
// ═══════════════════════════════════════

async function findSession(
  userId: string,
  date: string,
  sessionType: SessionType,
): Promise<ReviewSession | null> {
  const { data, error } = await supabase
    .from("review_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("session_date", date)
    .eq("session_type", sessionType)
    .limit(1)
    .maybeSingle();

  if (error) throw classifySessionError(error);
  if (!data) return null;

  return mapRowToSession(data);
}

// ═══════════════════════════════════════
// Query: Create session
// ═══════════════════════════════════════

async function createSession(params: CreateSessionParams): Promise<ReviewSession> {
  const { data, error } = await supabase
    .from("review_sessions")
    .insert({
      user_id: params.userId,
      session_date: params.date,
      session_type: params.sessionType,
      target_count: params.targetCount ?? 0,
      status: "active",
      current_stage: "recall",
    })
    .select()
    .single();

  if (error) throw classifySessionError(error);
  if (!data) throw new SessionError(SessionErrorCode.DB_ERROR, "Failed to create session");

  return mapRowToSession(data);
}

// ═══════════════════════════════════════
// Core: Idempotent Get-or-Create
// ═══════════════════════════════════════

/**
 * Idempotent get-or-create for an English session.
 *
 * Handles race conditions: if two concurrent requests both try to create
 * the same session, the second will get a 23505 unique violation. We catch
 * that, re-fetch, and return the existing session.
 */
export async function getOrCreateEnglishSession(
  params: CreateSessionParams,
): Promise<GetOrCreateResult> {
  // Optimistic fast path: check if session already exists
  const existing = await findSession(params.userId, params.date, params.sessionType);
  if (existing) return { session: existing, isNew: false };

  // Try to create
  try {
    const session = await createSession(params);
    return { session, isNew: true };
  } catch (err) {
    // Race condition: another request created it between our check and insert
    if (err instanceof SessionError && err.code === SessionErrorCode.DUPLICATE) {
      const concurrent = await findSession(params.userId, params.date, params.sessionType);
      if (concurrent) return { session: concurrent, isNew: false };

      throw new SessionError(
        SessionErrorCode.UNKNOWN,
        "Session exists but could not be retrieved after duplicate error",
        err,
      );
    }
    throw err;
  }
}

// ═══════════════════════════════════════
// Convenience: Get or create today's review session
// ═══════════════════════════════════════

export async function getOrCreateTodayReviewSession() {
  const userId = await getUserId();
  return getOrCreateEnglishSession({
    userId,
    date: getShanghaiDateKey(),
    sessionType: "review",
  });
}

// ═══════════════════════════════════════
// Convenience: Get or create today's learn session
// ═══════════════════════════════════════

export async function getOrCreateTodayLearnSession() {
  const userId = await getUserId();
  return getOrCreateEnglishSession({
    userId,
    date: getShanghaiDateKey(),
    sessionType: "learn",
  });
}

// ═══════════════════════════════════════
// Session items helpers
// ═══════════════════════════════════════

const EXPRESSION_SELECT =
  "id,english,chinese,pronunciation,example_sentence," +
  "english_explanation,usage_note,native_usage,context,situation," +
  "common_patterns,common_mistakes,memory_tip,synonyms,formality,notes,cloze_sentence," +
  "type,scene,status,mastery_level";

export async function fetchSessionItems(sessionId: string): Promise<SessionItem[]> {
  const { data, error } = await supabase
    .from("review_session_items")
    .select("*, expression:expressions(*)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw classifySessionError(error);
  return (data || []).map((i: Record<string, unknown>) => formatSessionItem(i));
}

export async function createSessionItems(
  sessionId: string,
  expressionIds: string[],
): Promise<void> {
  if (expressionIds.length === 0) return;

  const items = expressionIds.map((id) => ({
    session_id: sessionId,
    expression_id: id,
    status: "pending",
  }));

  const { error } = await supabase.from("review_session_items").insert(items);
  if (error) throw classifySessionError(error);
}

// ═══════════════════════════════════════
// Session completion
// ═══════════════════════════════════════

export async function completeSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("review_sessions")
    .update({
      status: "completed",
      completed_at: getShanghaiISO(),
    })
    .eq("id", sessionId);

  if (error) throw classifySessionError(error);
}

// ═══════════════════════════════════════
// Row mapping
// ═══════════════════════════════════════

function mapRowToSession(row: Record<string, unknown>): ReviewSession {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionDate: row.session_date as string,
    targetCount: row.target_count as number,
    status: row.status as ReviewSession["status"],
    currentStage: row.current_stage as ReviewSession["currentStage"],
    sessionType: (row.session_type as SessionType) || "review",
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | null,
    learnProgress: parseProgressJSON(row.learn_progress as Record<string, unknown> | null),
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
