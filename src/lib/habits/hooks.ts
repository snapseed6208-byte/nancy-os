// ============================================
// Habit Lab — React Query hooks + Supabase data access
// ============================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { getBeijingDateString } from "@/lib/date";
import { buildSprintTimeline, computePoints, summarizeToday } from "./logic";
import type {
  HabitRewardRow, HabitReviewRow, HabitSprintLogRow, HabitSprintRow, HabitLabTodaySummary,
} from "./types";

// ── Query keys ──

const KEYS = {
  all: ["habit-lab"] as const,
  sprints: ["habit-lab", "sprints"] as const,
  activeSprints: ["habit-lab", "sprints", "active"] as const,
  sprint: (id: string) => ["habit-lab", "sprint", id] as const,
  logs: (id: string) => ["habit-lab", "logs", id] as const,
  todayLogs: ["habit-lab", "logs", "today"] as const,
  rewards: ["habit-lab", "rewards"] as const,
  reviews: ["habit-lab", "reviews"] as const,
  review: (sprintId: string) => ["habit-lab", "review", sprintId] as const,
};

function invalidateLab(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: KEYS.all });
}

// ── Sprints ──

export function useActiveSprints() {
  return useQuery({
    queryKey: KEYS.activeSprints,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprints")
        .select("*")
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as HabitSprintRow[];
    },
    staleTime: 30_000,
  });
}

export function useAllSprints() {
  return useQuery({
    queryKey: KEYS.sprints,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprints")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as HabitSprintRow[];
    },
    staleTime: 30_000,
  });
}

export function useSprint(id: string | undefined) {
  return useQuery({
    queryKey: KEYS.sprint(id || ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprints")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as HabitSprintRow;
    },
    enabled: !!id,
  });
}

// ── Logs ──

export function useSprintLogs(sprintId: string | undefined) {
  return useQuery({
    queryKey: KEYS.logs(sprintId || ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprint_logs")
        .select("*")
        .eq("sprint_id", sprintId)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as HabitSprintLogRow[];
    },
    enabled: !!sprintId,
    staleTime: 30_000,
  });
}

/** Today's explicit logs across the user's own sprints (RLS-scoped). */
export function useTodayLogs() {
  const today = getBeijingDateString();
  return useQuery({
    queryKey: KEYS.todayLogs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprint_logs")
        .select("sprint_id, status")
        .eq("date", today);
      if (error) throw error;
      return (data || []) as { sprint_id: string; status: "completed" | "skipped" }[];
    },
    staleTime: 30_000,
  });
}

/**
 * Single-source summary for Home's 今日实验 metric.
 * Derived entirely from Habit Lab queries so Home never disagrees
 * (or with the /habits pages) about experiment counts.
 */
export function useHabitLabToday(): HabitLabTodaySummary {
  const { data: sprints = [] } = useActiveSprints();
  const { data: todayLogs = [] } = useTodayLogs();
  const today = getBeijingDateString();
  return summarizeToday(sprints, todayLogs, today);
}

/** All of the user's sprint logs (for cross-sprint points balance). */
export function useAllLogs() {
  return useQuery({
    queryKey: ["habit-lab", "logs", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprint_logs")
        .select("sprint_id, date, status")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as Pick<HabitSprintLogRow, "sprint_id" | "date" | "status">[];
    },
    staleTime: 30_000,
  });
}

/**
 * Derived timeline + points for one sprint, recomputed from logs as of today (Beijing).
 */
export function useSprintTimeline(sprint: HabitSprintRow | undefined) {
  const today = getBeijingDateString();
  const logsQ = useSprintLogs(sprint?.id);
  if (!sprint) {
    return { rows: [] as HabitSprintLogRow[], timeline: null, points: null, isLoading: logsQ.isLoading };
  }
  const rows = logsQ.data ?? [];
  const timeline = buildSprintTimeline(sprint, rows, today);
  const points = computePoints(rows, sprint.status === "completed");
  return { rows, timeline, points, isLoading: logsQ.isLoading };
}

// ── Log mutations (optimistic toggle) ──

export type LogStatus = "completed" | "skipped";

function patchLogCache(
  client: ReturnType<typeof useQueryClient>,
  sprintId: string,
  patch: (rows: HabitSprintLogRow[]) => HabitSprintLogRow[],
) {
  client.setQueryData<HabitSprintLogRow[]>(KEYS.logs(sprintId), (old) =>
    old ? patch(old) : old,
  );
}

export function useCompleteSprintDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ sprintId, date, status }: { sprintId: string; date: string; status: LogStatus }) => {
      const userId = await getUserId();
      const { error } = await supabase
        .from("habit_sprint_logs")
        .upsert(
          { sprint_id: sprintId, user_id: userId, date, status, note: null },
          { onConflict: "sprint_id,date" },
        );
      if (error) throw error;
    },
    onMutate: async ({ sprintId, date, status }) => {
      patchLogCache(client, sprintId, (rows) => [
        ...rows.filter((r) => r.date !== date),
        { id: `opt-${date}`, sprint_id: sprintId, user_id: "", date, status, note: null, created_at: "" },
      ]);
    },
    onSuccess: () => { invalidateLab(client); },
    onError: () => { invalidateLab(client); },
  });
}

export function useUndoSprintDay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ sprintId, date }: { sprintId: string; date: string }) => {
      const { error } = await supabase
        .from("habit_sprint_logs")
        .delete()
        .eq("sprint_id", sprintId)
        .eq("date", date);
      if (error) throw error;
    },
    onMutate: async ({ sprintId, date }) => {
      patchLogCache(client, sprintId, (rows) => rows.filter((r) => r.date !== date));
    },
    onSuccess: () => { invalidateLab(client); },
    onError: () => { invalidateLab(client); },
  });
}

// ── Sprint mutations ──

export type CreateSprintInput = {
  title: string;
  icon: string;
  cue_sentence: string;
  trigger?: string | null;
  location?: string | null;
  minimum_action: string;
  identity_statement?: string | null;
  duration_days?: number;
  start_date?: string;
};

export function useCreateSprint() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSprintInput) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("habit_sprints")
        .insert({ user_id: userId, ...input, status: "active" })
        .select()
        .single();
      if (error) throw error;
      return data as HabitSprintRow;
    },
    onSuccess: () => { invalidateLab(client); },
  });
}

export function useSetSprintStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "paused" | "active" | "archived" }) => {
      const { error } = await supabase
        .from("habit_sprints")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateLab(client); },
  });
}

export function useDeleteSprint() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habit_sprints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateLab(client); },
  });
}

// ── Reviews ──

export function useSprintReview(sprintId: string | undefined) {
  return useQuery({
    queryKey: KEYS.review(sprintId || ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprint_reviews")
        .select("*")
        .eq("sprint_id", sprintId)
        .single();
      if (error && error.code === "PGRST116") return null; // no review yet
      if (error) throw error;
      return data as HabitReviewRow;
    },
    enabled: !!sprintId,
  });
}

export function useReviews() {
  return useQuery({
    queryKey: KEYS.reviews,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_sprint_reviews")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as HabitReviewRow[];
    },
    staleTime: 60_000,
  });
}

export type FinalizeReviewInput = {
  sprintId: string;
  completedDays: number;
  totalDays: number;
  completionRate: number; // percent 0–100
  longestStreak: number;
  pointsEarned: number;
  easiestContext?: string | null;
  primaryFriction?: string | null;
  nextAction?: string | null;
};

export function useFinalizeReview() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: FinalizeReviewInput) => {
      const userId = await getUserId();
      const reviewPayload = {
        sprint_id: input.sprintId,
        user_id: userId,
        completed_days: input.completedDays,
        total_days: input.totalDays,
        completion_rate: input.completionRate,
        longest_streak: input.longestStreak,
        points_earned: input.pointsEarned,
        easiest_context: input.easiestContext ?? null,
        primary_friction: input.primaryFriction ?? null,
        next_action: input.nextAction ?? null,
      };
      const { error: reviewError } = await supabase
        .from("habit_sprint_reviews")
        .upsert(reviewPayload, { onConflict: "sprint_id" });
      if (reviewError) throw reviewError;

      const { error: sprintError } = await supabase
        .from("habit_sprints")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", input.sprintId);
      if (sprintError) throw sprintError;
    },
    onSuccess: () => { invalidateLab(client); },
  });
}

// ── Rewards ──

export function useRewards() {
  return useQuery({
    queryKey: KEYS.rewards,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_rewards")
        .select("*")
        .order("points_required", { ascending: true });
      if (error) throw error;
      return (data || []) as HabitRewardRow[];
    },
    staleTime: 30_000,
  });
}

export function useUpsertReward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; icon: string; pointsRequired: number }) => {
      const userId = await getUserId();
      const payload = {
        user_id: userId,
        name: input.name,
        icon: input.icon,
        points_required: input.pointsRequired,
      };
      const { error } = input.id
        ? await supabase.from("habit_rewards").update(payload).eq("id", input.id)
        : await supabase.from("habit_rewards").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidateLab(client); },
  });
}

export function useSetRewardStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "redeemed" }) => {
      const { error } = await supabase
        .from("habit_rewards")
        .update({ status, redeemed_at: status === "redeemed" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateLab(client); },
  });
}

export function useDeleteReward() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habit_rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateLab(client); },
  });
}
