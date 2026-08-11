// ============================================
// English SRS V4.3 — Review Due Pool Repository
//
// Single source of truth for due expression queries.
// Home count, review session creation, and review
// progress MUST all use these selectors.
// ============================================

import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { getShanghaiDateKey } from "@/lib/english/sessionRepository";

const EXPRESSION_SELECT =
  "id,english,chinese,pronunciation,example_sentence," +
  "english_explanation,usage_note,native_usage,context,situation," +
  "common_patterns,common_mistakes,memory_tip,synonyms,formality,notes,cloze_sentence," +
  "type,scene,status,mastery_level";

const DUE_STATUSES = ["review", "mastered"] as const;

/**
 * Canonical due-pool date cutoff.
 *
 * `next_review_date` is a DATE column. Comparing against a plain date string
 * (Asia/Shanghai) avoids the UTC-boundary window where Aug 11 05:41 CST maps
 * to Aug 10 21:41 UTC and expressions dated "2026-08-11" are incorrectly
 * excluded from today's due pool.
 */
export function getDueCutoffDate(): string {
  return getShanghaiDateKey();
}

/**
 * Count expressions currently due for review.
 * One canonical query — used by home page, review page, and observability.
 */
export async function getDuePoolCount(userId?: string): Promise<number> {
  const uid = userId ?? (await getUserId());
  const { count, error } = await supabase
    .from("expressions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("archived", false)
    .in("status", DUE_STATUSES as unknown as string[])
    .lte("next_review_date", getDueCutoffDate());

  if (error) throw error;
  return count ?? 0;
}

/**
 * Fetch the IDs of due expressions (for populating a review session).
 * Returns the actual expression rows, limited by the daily cap.
 */
export async function fetchDueExpressionIds(
  userId: string,
  limit: number,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("expressions")
    .select("id")
    .eq("user_id", userId)
    .eq("archived", false)
    .in("status", DUE_STATUSES as unknown as string[])
    .lte("next_review_date", getDueCutoffDate())
    .order("next_review_date", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((r) => r.id as string);
}

/**
 * Fetch the full due pool rows (for session population with expression data).
 */
export async function fetchDueExpressionsFull(
  userId: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from("expressions")
    .select(EXPRESSION_SELECT)
    .eq("user_id", userId)
    .eq("archived", false)
    .in("status", DUE_STATUSES as unknown as string[])
    .lte("next_review_date", getDueCutoffDate())
    .order("next_review_date", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) throw error;
  return (data || []) as unknown as Record<string, unknown>[];
}
