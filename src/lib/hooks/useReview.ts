// ============================================
// Nancy OS — Review OS Hooks
// Daily reviews, weekly summaries
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";
import { getBeijingDateString, getBeijingMonthRange, dateToBeijingString } from "@/lib/date";

// ── Types ──

export type DailyReview = {
  id: string;
  user_id: string;
  date: string;
  q1_what_done: string | null;
  q2_best_thing: string | null;
  q3_what_chaos: string | null;
  q4_tomorrow_first: string | null;
  q5_spending: string | null;
  daily_log: string | null;
  mood: string | null;
  mood_intensity: number | null;
  ai_growth_insight: string | null;
  ai_tomorrow_suggestion: string | null;
  tasks_completed_count: number | null;
  tasks_total_count: number | null;
  habits_completed_count: number | null;
  habits_total_count: number | null;
  focus_minutes: number | null;
  mood_avg: number | null;
  goal_progress: Record<string, unknown>[] | null;
  tomorrow_plan: Record<string, unknown>[] | null;
  created_at: string;
  updated_at: string;
};

export type WeeklySummary = {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  title: string | null;
  overview: string | null;
  highlights: Record<string, unknown>[] | null;
  lowlights: Record<string, unknown>[] | null;
  top_insight: string | null;
  tasks_completed: number;
  habits_streak_days: number;
  english_expressions_learned: number;
  english_speaking_sessions: number;
  workout_days: number;
  mood_avg: number | null;
  focus_hours: number | null;
  created_at: string;
};

// ── Daily Review ──

async function fetchDailyReview(date: string) {
  const { data, error } = await supabase
    .from("daily_reviews")
    .select("*")
    .eq("date", date)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data || null) as DailyReview | null;
}

export function useDailyReview(date: string) {
  return useQuery({
    queryKey: ["daily_review", date],
    queryFn: () => fetchDailyReview(date),
    staleTime: 60 * 1000,
  });
}

async function fetchRecentDailyReviews(days = 7) {
  const todayBeijing = new Date(getBeijingDateString() + "T00:00:00+08:00");
  const startDate = new Date(todayBeijing);
  startDate.setDate(startDate.getDate() - days);
  const startStr = dateToBeijingString(startDate);
  const todayStr = getBeijingDateString();

  const { data, error } = await supabase
    .from("daily_reviews")
    .select("*")
    .gte("date", startStr)
    .lte("date", todayStr)
    .order("date", { ascending: false })
    .limit(days);

  if (error) throw error;
  return (data || []) as DailyReview[];
}

export function useRecentDailyReviews(days?: number) {
  return useQuery({
    queryKey: ["daily_reviews", "recent", days],
    queryFn: () => fetchRecentDailyReviews(days),
    staleTime: 60 * 1000,
  });
}

// ── Daily Review History ──

export type DailyReviewHistoryFilters = {
  year?: number;
  month?: number;
};

async function fetchDailyReviewHistory(filters: DailyReviewHistoryFilters = {}) {
  const now = new Date(getBeijingDateString() + "T00:00:00+08:00");
  const year = filters.year ?? now.getFullYear();
  const month = filters.month ?? now.getMonth() + 1;
  const { start, end } = getBeijingMonthRange(year, month);

  const { data, error } = await supabase
    .from("daily_reviews")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data || []) as DailyReview[];
}

export function useDailyReviewHistory(filters: DailyReviewHistoryFilters = {}) {
  return useQuery({
    queryKey: ["daily_reviews", "history", filters],
    queryFn: () => fetchDailyReviewHistory(filters),
    staleTime: 60 * 1000,
  });
}

export function useUpsertDailyReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      date: string;
      q1_what_done?: string;
      q2_best_thing?: string;
      q3_what_chaos?: string;
      q4_tomorrow_first?: string;
      q5_spending?: string;
      daily_log?: string;
      mood?: string;
      mood_intensity?: number;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("daily_reviews")
        .upsert({ ...input, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id, date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["daily_review", vars.date] });
      qc.invalidateQueries({ queryKey: ["daily_reviews"] });
    },
  });
}

// ── Weekly Summaries ──

async function fetchWeeklySummaries(limit = 10) {
  const { data, error } = await supabase
    .from("weekly_summaries")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as WeeklySummary[];
}

export function useWeeklySummaries() {
  return useQuery({
    queryKey: ["weekly_summaries"],
    queryFn: () => fetchWeeklySummaries(),
    staleTime: 5 * 60 * 1000,
  });
}

async function fetchCurrentWeekSummary() {
  const todayBeijing = new Date(getBeijingDateString() + "T00:00:00+08:00");
  const dayOfWeek = todayBeijing.getDay();
  const monday = new Date(todayBeijing);
  monday.setDate(todayBeijing.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekStart = dateToBeijingString(monday);
  const weekEnd = dateToBeijingString(sunday);

  const { data, error } = await supabase
    .from("weekly_summaries")
    .select("*")
    .eq("week_start", weekStart)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data || null) as WeeklySummary | null;
}

export function useCurrentWeekSummary() {
  return useQuery({
    queryKey: ["weekly_summaries", "current"],
    queryFn: fetchCurrentWeekSummary,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Journal AI for Review (read-only reference) ──

async function fetchJournalAIForDate(date: string) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, ai_summary, ai_themes, ai_actions, ai_thoughts, ai_analysis_version")
    .eq("date", date)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function useJournalAIForReview(date: string) {
  return useQuery({
    queryKey: ["journal_ai_for_review", date],
    queryFn: () => fetchJournalAIForDate(date),
    staleTime: 5 * 60 * 1000,
  });
}

// ── AI Daily Reflection ──

export function useGenerateDailyReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string }) => {
      const result = await invokeAI("daily-reflection-agent", { date: input.date });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["daily_review", vars.date] });
      qc.invalidateQueries({ queryKey: ["daily_reviews"] });
      qc.invalidateQueries({ queryKey: ["memories"] });
    },
  });
}
