// ============================================
// Nancy OS — Habit OS Hooks
// CRUD, daily check-in, streak calculation, stats
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

// ── Types ──

export type HabitRow = {
  id: string;
  user_id: string;
  title: string;
  icon?: string;
  color?: string;
  category?: string;
  module?: string;
  target_days_per_week: number;
  is_active: boolean;
  streak_best: number;
  reminder_time?: string;
  created_at: string;
};

export type HabitRecordRow = {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  status: string; // "completed" | "skipped" | "missed"
  note?: string;
  value?: number;
  energy_level?: number;
  created_at: string;
};

export type HabitWithRecord = HabitRow & {
  today_record?: HabitRecordRow;
};

export type HabitStats = {
  totalActive: number;
  completedToday: number;
  missedToday: number;
  currentStreak: number;
  bestStreak: number;
  completionRateWeek: number; // 0-1
};

// ── All Habits ──

async function fetchHabits(activeOnly = true) {
  let query = supabase
    .from("habits")
    .select("*")
    .order("created_at", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as HabitRow[];
}

export function useHabits(activeOnly = true) {
  return useQuery({
    queryKey: ["habits", activeOnly],
    queryFn: () => fetchHabits(activeOnly),
    staleTime: 60 * 1000,
  });
}

// ── Habits with today's records ──

async function fetchHabitsWithToday(): Promise<HabitWithRecord[]> {
  const today = new Date().toISOString().split("T")[0];

  const [{ data: habits }, { data: records }] = await Promise.all([
    supabase.from("habits").select("*").eq("is_active", true).order("created_at", { ascending: true }),
    supabase.from("habit_records").select("*").eq("date", today),
  ]);

  const recordMap = new Map<string, HabitRecordRow>();
  for (const r of (records || []) as HabitRecordRow[]) {
    recordMap.set(r.habit_id, r);
  }

  return ((habits || []) as HabitRow[]).map((h) => ({
    ...h,
    today_record: recordMap.get(h.id),
  }));
}

export function useHabitsWithToday() {
  return useQuery({
    queryKey: ["habits", "withToday"],
    queryFn: fetchHabitsWithToday,
    staleTime: 30 * 1000,
  });
}

// ── Habit Records for date ──

export function useHabitRecords(date: string) {
  return useQuery({
    queryKey: ["habitRecords", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_records")
        .select("*, habits!inner(title, icon, color)")
        .eq("date", date)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as (HabitRecordRow & { habits: { title: string; icon: string; color: string } })[];
    },
    staleTime: 30 * 1000,
  });
}

// ── Create Habit ──

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      icon?: string;
      color?: string;
      category?: string;
      module?: string;
      targetDaysPerWeek?: number;
      reminderTime?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          title: input.title,
          icon: input.icon,
          color: input.color,
          category: input.category,
          module: input.module,
          target_days_per_week: input.targetDaysPerWeek ?? 7,
          reminder_time: input.reminderTime,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Update Habit ──

export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      title?: string;
      icon?: string;
      color?: string;
      is_active?: boolean;
      target_days_per_week?: number;
      reminder_time?: string;
    }) => {
      const { error } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Delete Habit ──

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Toggle Habit Record (daily check-in) ──

export function useToggleHabitRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, date, currentStatus }: {
      habitId: string;
      date: string;
      currentStatus?: string;
    }) => {
      // Cycle: null → completed → skipped → missed → null
      const nextStatus =
        !currentStatus ? "completed" :
        currentStatus === "completed" ? "skipped" :
        currentStatus === "skipped" ? "missed" :
        null;

      if (nextStatus === null) {
        // Remove the record (uncheck)
        const { error } = await supabase
          .from("habit_records")
          .delete()
          .eq("habit_id", habitId)
          .eq("date", date);
        if (error) throw error;
      } else {
        // Upsert the record
        const userId = await getUserId();
        const { error } = await supabase
          .from("habit_records")
          .upsert({
            user_id: userId,
            habit_id: habitId,
            date,
            status: nextStatus,
          }, { onConflict: "habit_id, date" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["habitRecords"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Habit Stats (streak, completion rate) ──

function computeStreak(records: { date: string; status: string }[], fromDate: string): number {
  let streak = 0;
  const checkDate = new Date(fromDate + "T12:00:00");
  const completedDates = new Set(
    records
      .filter((r) => r.status === "completed")
      .map((r) => r.date)
  );

  for (let i = 0; i < 90; i++) {
    const ds = checkDate.toISOString().split("T")[0];
    if (completedDates.has(ds)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function useHabitStats(days = 7) {
  const today = new Date().toISOString().split("T")[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["habitStats", days],
    queryFn: async (): Promise<HabitStats> => {
      const [{ data: habits }, { data: records }] = await Promise.all([
        supabase.from("habits").select("id,streak_best").eq("is_active", true),
        supabase.from("habit_records")
          .select("habit_id,date,status")
          .gte("date", startStr)
          .lte("date", today)
          .order("date", { ascending: false }),
      ]);

      const habitList = (habits || []) as { id: string; streak_best: number }[];
      const recordList = (records || []) as { habit_id: string; date: string; status: string }[];

      const todayRecords = recordList.filter((r) => r.date === today);
      const completedToday = todayRecords.filter((r) => r.status === "completed").length;
      const missedToday = todayRecords.filter((r) => r.status === "missed").length;

      // Overall streak: any habit completed today continues the streak
      const currentStreak = computeStreak(recordList, today);
      const bestStreak = Math.max(...habitList.map((h) => h.streak_best || 0), currentStreak);

      // Completion rate this week
      const weekDays = Math.min(days, Math.ceil((Date.now() - new Date(startStr + "T00:00:00").getTime()) / 86400000) + 1);
      const totalExpected = habitList.length * weekDays;
      const totalCompleted = recordList.filter((r) => r.status === "completed").length;
      const completionRateWeek = totalExpected > 0 ? totalCompleted / totalExpected : 0;

      return {
        totalActive: habitList.length,
        completedToday,
        missedToday,
        currentStreak,
        bestStreak,
        completionRateWeek: Math.round(completionRateWeek * 100) / 100,
      };
    },
    staleTime: 30 * 1000,
  });
}
