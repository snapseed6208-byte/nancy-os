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

// ── Habit Analysis (AI) ──

export type HabitAnalysis = {
  id: string;
  habit_id?: string | null;
  analysis_type: "overall" | "habit_specific";
  period_start: string;
  period_end: string;
  summary: string;
  strengths: string[];
  suggestions: string[];
  motivation: string;
  stats: {
    completion_rate: number;
    total_completed: number;
    total_missed: number;
    total_skipped: number;
    total_days: number;
    most_consistent_habit: string;
    most_struggled_habit: string;
    best_day_of_week: string;
    consistency_score: number;
  };
  created_at: string;
};

export function useHabitAnalysis(habitId?: string) {
  return useQuery({
    queryKey: ["habitAnalysis", habitId || "overall"],
    queryFn: async (): Promise<HabitAnalysis | null> => {
      let query = supabase
        .from("habit_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (habitId) {
        query = query.eq("habit_id", habitId);
      } else {
        query = query.eq("analysis_type", "overall");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data?.[0] as HabitAnalysis) || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenerateHabitAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { habitId?: string; days?: number }) => {
      const { data, error } = await supabase.functions.invoke("habit-analyst-agent", {
        body: {
          habit_id: input?.habitId || undefined,
          days: input?.days || 30,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      return data as HabitAnalysis;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["habitAnalysis", variables?.habitId || "overall"] });
    },
  });
}

// ── Month Calendar ──

export type DayCell = {
  date: string;
  dayOfMonth: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  habits: { id: string; name: string; color: string; icon: string; status: string }[];
  completionRate: number;
};

async function fetchMonthCalendar(year: number, month: number): Promise<DayCell[]> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  const endDate = new Date(lastDay);
  if (lastDay.getDay() < 6) endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  const [{ data: habits }, { data: records }] = await Promise.all([
    supabase.from("habits").select("id,title,icon,color").eq("is_active", true),
    supabase.from("habit_records")
      .select("habit_id,date,status")
      .gte("date", startStr)
      .lte("date", endStr),
  ]);

  const habitList = (habits || []) as { id: string; title: string; icon: string; color: string }[];
  const recordList = (records || []) as { habit_id: string; date: string; status: string }[];

  const recordMap = new Map<string, Map<string, string>>();
  for (const r of recordList) {
    if (!recordMap.has(r.date)) recordMap.set(r.date, new Map());
    recordMap.get(r.date)!.set(r.habit_id, r.status);
  }

  const cells: DayCell[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const ds = cursor.toISOString().split("T")[0];
    const dayRecords = recordMap.get(ds) || new Map();

    const dayHabits = habitList.map((h) => ({
      id: h.id,
      name: h.title,
      color: h.color || "#45B7D1",
      icon: h.icon || "✅",
      status: dayRecords.get(h.id) || "",
    }));

    const completed = dayHabits.filter((h) => h.status === "completed").length;

    cells.push({
      date: ds,
      dayOfMonth: cursor.getDate(),
      isToday: ds === todayStr,
      isCurrentMonth: cursor.getMonth() === month - 1,
      habits: dayHabits,
      completionRate: habitList.length > 0 ? completed / habitList.length : 0,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

export function useHabitMonthCalendar(year: number, month: number) {
  return useQuery({
    queryKey: ["habitMonthCalendar", year, month],
    queryFn: () => fetchMonthCalendar(year, month),
    staleTime: 60 * 1000,
  });
}

// ── Weekly Stats ──

export type WeeklyStat = {
  weekStart: string;
  weekEnd: string;
  habits: { id: string; name: string; color: string; rate: number }[];
  overallRate: number;
};

export function useHabitWeeklyStats(weeksBack = 4) {
  return useQuery({
    queryKey: ["habitWeeklyStats", weeksBack],
    queryFn: async (): Promise<WeeklyStat[]> => {
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - weeksBack * 7);

      const startStr = startDate.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      const [{ data: habits }, { data: records }] = await Promise.all([
        supabase.from("habits").select("id,title,color").eq("is_active", true),
        supabase.from("habit_records")
          .select("habit_id,date,status")
          .gte("date", startStr)
          .lte("date", todayStr),
      ]);

      const habitList = (habits || []) as { id: string; title: string; color: string }[];
      const recordList = (records || []) as { habit_id: string; date: string; status: string }[];

      const weeks: WeeklyStat[] = [];
      for (let w = 0; w < weeksBack; w++) {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() - w * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);

        const ws = weekStart.toISOString().split("T")[0];
        const we = weekEnd.toISOString().split("T")[0];

        const weekRecords = recordList.filter((r) => r.date >= ws && r.date <= we);
        const daysInWeek = new Set(weekRecords.map((r) => r.date)).size || 1;

        const habitRates = habitList.map((h) => {
          const habitRecs = weekRecords.filter((r) => r.habit_id === h.id);
          const completed = habitRecs.filter((r) => r.status === "completed").length;
          return {
            id: h.id,
            name: h.title,
            color: h.color || "#45B7D1",
            rate: daysInWeek > 0 ? completed / daysInWeek : 0,
          };
        });

        const totalCompleted = weekRecords.filter((r) => r.status === "completed").length;
        const totalExpected = habitList.length * daysInWeek;

        weeks.push({
          weekStart: ws,
          weekEnd: we,
          habits: habitRates,
          overallRate: totalExpected > 0 ? totalCompleted / totalExpected : 0,
        });
      }

      return weeks.reverse();
    },
    staleTime: 60 * 1000,
  });
}
