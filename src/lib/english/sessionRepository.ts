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

/** Hard daily cap for a SINGLE learning session (PART 17). Users can still append more afterwards. */
export const MAX_LEARN_TARGET = 30;

/** Statuses that belong in the learning queue (COLLECT → LEARN → REVIEW lifecycle). */
const LEARN_QUEUE_STATUSES = ["collected", "learning"] as const;

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
// Query: Find existing session (FETCH-ONLY — never creates)
// ═══════════════════════════════════════

/**
 * Fetch an existing session without creating one. Returns null when absent.
 * The Learning page relies on this: loading it must NEVER auto-create a session,
 * otherwise the user never gets a chance to pick a daily target.
 */
export async function findEnglishSession(
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
  const existing = await findEnglishSession(params.userId, params.date, params.sessionType);
  if (existing) return { session: existing, isNew: false };

  // Try to create
  try {
    const session = await createSession(params);
    return { session, isNew: true };
  } catch (err) {
    // Race condition: another request created it between our check and insert
    if (err instanceof SessionError && err.code === SessionErrorCode.DUPLICATE) {
      const concurrent = await findEnglishSession(params.userId, params.date, params.sessionType);
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
// V4.3: Adaptive Daily Learning Target
//
// Learning workload = the user decides (5/10/15/20/custom, up to 30).
// Review timing = SRS decides. The two NEVER bind.
// ═══════════════════════════════════════

/**
 * Select the learning queue for a user.
 *
 * Order (PART 13): created_at ASC so the oldest-collected expressions are
 * learned first. `learning` status (a resumed in-progress item) jumps ahead of
 * `collected` — the stable JS sort preserves created_at order within each group.
 *
 * @param excludeExpressionIds expressions already in today's session (append must skip them).
 * @returns the selected rows plus how many more remain available after selection.
 */
async function selectLearnQueue(
  userId: string,
  limit: number,
  excludeExpressionIds: string[] = [],
): Promise<{ rows: Record<string, unknown>[]; remaining: number }> {
  let query = supabase
    .from("expressions")
    .select(EXPRESSION_SELECT, { count: "exact" })
    .eq("user_id", userId)
    .eq("archived", false)
    .in("status", LEARN_QUEUE_STATUSES as unknown as string[])
    .order("created_at", { ascending: true });

  if (excludeExpressionIds.length > 0) {
    // PostgREST in/not.in requires unquoted values: (uuid1,uuid2)
    query = query.not(
      "id",
      "in",
      `(${excludeExpressionIds.join(",")})`,
    );
  }

  const { data, count, error } = await query.limit(limit);
  if (error) throw classifySessionError(error);

  const dataRows = (data || []) as unknown as Record<string, unknown>[];
  const rows = [...dataRows].sort((a, b) => {
    if (a.status === "learning" && b.status !== "learning") return -1;
    if (a.status !== "learning" && b.status === "learning") return 1;
    return 0;
  });

  const total = count ?? 0;
  return { rows, remaining: Math.max(0, total - rows.length) };
}

export interface CreateLearnSessionResult {
  session: ReviewSession | null;
  items: SessionItem[];
  isNew: boolean;
  /** Actual expressions selected — less than requestedTarget when the queue is short (PART 2). */
  selectedCount: number;
  /** What the user asked for (before the 30-cap / insufficiency clamp). */
  requestedTarget: number;
  /** How many collected/learning remain AFTER this selection (for 今天再学一些). */
  remaining: number;
  /** True when there are no expressions to learn — no session is created (PART 14). */
  empty: boolean;
}

/**
 * Create today's learn session with an explicit target, or return the existing
 * one unchanged (idempotent — PART 3/5: refresh / re-entry / device change must
 * restore the SAME items, never re-draw).
 *
 * Selection happens BEFORE session creation so an empty queue never creates an
 * empty session. When the queue is short the session target collapses to the
 * actual count (e.g. pick 20 but only 13 remain → session of 13).
 */
export async function createLearnSessionWithTarget(
  userId: string,
  date: string,
  requestedTarget: number,
): Promise<CreateLearnSessionResult> {
  const target = Math.min(Math.max(1, Math.floor(requestedTarget) || 1), MAX_LEARN_TARGET);

  // Never re-create: an existing session is authoritative (session immutability).
  const existing = await findEnglishSession(userId, date, "learn");
  if (existing) {
    const items = await fetchSessionItems(existing.id);
    return {
      session: existing,
      items,
      isNew: false,
      selectedCount: items.length,
      requestedTarget: target,
      remaining: 0,
      empty: items.length === 0,
    };
  }

  // Select BEFORE creating so we never leave an empty session behind.
  const { rows, remaining } = await selectLearnQueue(userId, target);
  if (rows.length === 0) {
    return { session: null, items: [], isNew: false, selectedCount: 0, requestedTarget: target, remaining: 0, empty: true };
  }

  // Get-or-create (handles the concurrent-create race) with the ACTUAL count.
  const { session, isNew } = await getOrCreateEnglishSession({
    userId,
    date,
    sessionType: "learn",
    targetCount: rows.length,
  });

  if (!isNew) {
    // A concurrent request created it first — its items are authoritative.
    const items = await fetchSessionItems(session.id);
    return { session, items, isNew: false, selectedCount: items.length, requestedTarget: target, remaining: 0, empty: items.length === 0 };
  }

  await createSessionItems(session.id, rows.map((r) => r.id as string));
  const items = await fetchSessionItems(session.id);

  return { session, items, isNew: true, selectedCount: rows.length, requestedTarget: target, remaining, empty: false };
}

export interface AppendLearnItemsResult {
  session: ReviewSession;
  items: SessionItem[];
  /** How many new expressions were appended this call. */
  addedCount: number;
  /** How many collected/learning still remain outside the session. */
  remaining: number;
}

/**
 * Extend TODAY'S learn session ("今天再学一些" — PART 7/8).
 *
 * Appends `count` brand-new COLLECTED expressions onto the same session (never a
 * second session), keeping the original completed items intact. No duplicates:
 * items already in the session are excluded by the (session_id, expression_id)
 * unique constraint AND by the explicit exclusion filter here.
 */
export async function appendLearnItems(
  userId: string,
  date: string,
  count: number,
): Promise<AppendLearnItemsResult> {
  const session = await findEnglishSession(userId, date, "learn");
  if (!session) {
    throw new SessionError(SessionErrorCode.NOT_FOUND, "No learn session to extend");
  }

  const existingItems = await fetchSessionItems(session.id);
  const excludeIds = existingItems.map((i) => i.expressionId);
  const target = Math.min(Math.max(1, Math.floor(count) || 1), MAX_LEARN_TARGET);

  const { rows, remaining } = await selectLearnQueue(userId, target, excludeIds);
  if (rows.length === 0) {
    return { session, items: existingItems, addedCount: 0, remaining };
  }

  await createSessionItems(session.id, rows.map((r) => r.id as string));

  const newTotal = existingItems.length + rows.length;
  const { error } = await supabase
    .from("review_sessions")
    .update({ target_count: newTotal })
    .eq("id", session.id);
  if (error) throw classifySessionError(error);

  const items = await fetchSessionItems(session.id);
  return { session: { ...session, targetCount: newTotal }, items, addedCount: rows.length, remaining };
}

/**
 * Count expressions that are still learnable (collected/learning, not archived,
 * not already in today's session). Used to decide whether "今天再学一些" is shown.
 */
export async function countAvailableLearnExpressions(
  userId: string,
  date: string,
): Promise<number> {
  const session = await findEnglishSession(userId, date, "learn");
  if (!session) return 0;

  const items = await fetchSessionItems(session.id);
  const ids = items.map((i) => i.expressionId);
  if (ids.length === 0) return 0;

  const { count, error } = await supabase
    .from("expressions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("archived", false)
    .in("status", LEARN_QUEUE_STATUSES as unknown as string[])
    .not("id", "in", `(${ids.join(",")})`);

  if (error) throw classifySessionError(error);
  return count ?? 0;
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
  // 23505 = unique violation on (session_id, expression_id). When the DB
  // constraint exists this is a safety net; when it doesn't, duplicate
  // protection relies solely on the selectLearnQueue exclusion filter.
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
    modeData: raw.mode_data as Record<string, unknown> | null,
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
          ai_cloze_sentence: expr.ai_cloze_sentence as string | undefined,
          type: expr.type as string,
          scene: expr.scene as string,
          status: expr.status as string,
          mastery_level: expr.mastery_level as number,
        }
      : undefined,
  };
}
