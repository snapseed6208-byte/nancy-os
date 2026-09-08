// Speaking-feedback → Expression-bank saving + dedup (current-user scope).
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { normalizeExpressionKey, takeawayToExpressionRow, type SpeakingTakeaway } from "./speakingFeedback";

const PAGE = 500;

/** Fetch the current user's non-archived expression english set (normalized keys). */
export async function fetchExistingExpressionEnglish(): Promise<Set<string>> {
  const userId = await getUserId();
  const set = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("expressions")
      .select("english")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data as { english: string }[] | null;
    if (!rows || rows.length === 0) break;
    for (const r of rows) set.add(normalizeExpressionKey(r.english));
    from += rows.length;
    if (rows.length < PAGE) break;
  }
  return set;
}

/**
 * Add one takeaway to the expression bank.
 * Dedup is case/whitespace-insensitive and scoped to the current user.
 * Returns "exists" when already in the bank (no insert performed).
 */
export async function saveSpeakingTakeaway(item: SpeakingTakeaway): Promise<"added" | "exists"> {
  const userId = await getUserId();
  const key = normalizeExpressionKey(item.expression);
  const existing = await fetchExistingExpressionEnglish();
  if (existing.has(key)) return "exists";
  const { error } = await supabase
    .from("expressions")
    .insert({ ...takeawayToExpressionRow(item), user_id: userId });
  if (error) throw error;
  return "added";
}
