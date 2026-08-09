// ============================================
// Nancy OS — Dashboard Data Layer
// Unified aggregation for Home dashboard
// ============================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ── Types ──

export type TimelineItem = {
  id: string;
  type: "task" | "habit" | "journal" | "speaking" | "review";
  title: string;
  subtitle?: string;
  status: "completed" | "in_progress" | "pending";
  time?: string;
  path?: string;
  // Recurring task fields
  taskType?: string;
  completedCount?: number;
  targetCount?: number;
  frequencyType?: string;
  // Aggregation fields
  category?: string;
  displayType?: "individual" | "aggregated";
  summary?: string;
  metadata?: Record<string, unknown>;
};

export type DashboardStats = {
  tasks: {
    completed: number;
    total: number;
    pending: { id: string; title: string; priority: string; module: string }[];
  };
  habits: {
    completed: number;
    total: number;
    streak: number;
    missed: number;
  };
  reviews: {
    due: number;
    completedToday: number;
    totalExpressions: number;
  };
  speaking: {
    sessionsToday: number;
    minutesToday: number;
    lastSessionDays: number | null;
  };
  mood: {
    today: string | null;
    todayIntensity: number | null;
    weekAvgIntensity: number | null;
    dominantMood: string | null;
  };
  lifeTrace: {
    journalToday: number;
    moodRecordsToday: number;
    journalThisMonth: number;
  };
  timeline: {
    completed: TimelineItem[];
    inProgress: TimelineItem[];
    pending: TimelineItem[];
  };
};

// ── Aggregation helpers ──

export function aggregateReviewsAndSpeaking(
  reviewItems: TimelineItem[],
  speakingItems: TimelineItem[],
): TimelineItem[] {
  const results: TimelineItem[] = [];
  const expressionCount = reviewItems.length;
  const speakingCount = speakingItems.length;

  if (expressionCount === 0 && speakingCount === 0) return results;

  const allTimes = [...reviewItems, ...speakingItems]
    .map((i) => i.time)
    .filter(Boolean) as string[];
  const latestTime = allTimes.length > 0
    ? allTimes.sort((a, b) => b.localeCompare(a))[0]
    : undefined;

  const totalMinutes = speakingItems.reduce((sum, s) => {
    const mins = parseInt((s.subtitle || "0").replace(/\D/g, ""), 10) || 0;
    return sum + mins;
  }, 0);

  const parts: string[] = [];
  if (expressionCount > 0) parts.push(`表达库复习 ${expressionCount}次`);
  if (speakingCount > 0) parts.push(`口语练习 ${speakingCount}次`);
  if (totalMinutes > 0) parts.push(`累计${totalMinutes}分钟`);

  results.push({
    id: "aggregated-english",
    type: "review",
    title: "📚 英语学习",
    summary: parts.join(" · "),
    status: "completed",
    time: latestTime,
    path: "/english",
    category: "english",
    displayType: "aggregated",
    metadata: {
      expressionReviewCount: expressionCount,
      speakingCount,
      totalMinutes,
      latestTime,
    },
  });

  return results;
}

export function aggregateHabits(
  habitItems: TimelineItem[],
  habitNames: Map<string, { name: string; icon: string }>,
): TimelineItem[] {
  if (habitItems.length === 0) return [];

  const completed: string[] = [];
  const missed: string[] = [];

  for (const h of habitItems) {
    const habitId = h.metadata?.habitId as string || "";
    const info = habitNames.get(habitId);
    const displayName = info ? `${info.icon || "✅"} ${info.name}` : h.title;
    if (h.status === "completed") {
      completed.push(displayName);
    } else {
      missed.push(displayName);
    }
  }

  const total = completed.length + missed.length;
  const summary = `完成 ${completed.length}/${total} 项`;

  return [{
    id: "aggregated-habits",
    type: "habit",
    title: "🏆 习惯打卡",
    summary,
    status: completed.length >= total ? "completed" : "in_progress",
    path: "/plan?tab=habits",
    category: "habits",
    displayType: "aggregated",
    metadata: {
      completedCount: completed.length,
      totalCount: total,
      completedNames: completed,
      missedNames: missed,
    },
  }];
}

// ── Query ──

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [
    { data: tasks, error: tasksErr },
    { data: completedTasks, error: ctErr },
    { data: habits, error: habitsErr },
    { data: habitRecords, error: hrErr },
    { data: habitRecordsWithNames, error: hrnErr },
    { data: activeHabits, error: ahErr },
    { count: expressionCount, error: exprCountErr },
    { data: reviewsToday, error: reviewsErr },
    { data: reviewsDue, error: dueErr },
    { data: speakingToday, error: speakingErr },
    { data: lastSpeaking, error: lastSpeakingErr },
    { data: moodToday, error: moodErr },
    { data: moodWeek, error: moodWeekErr },
    { count: journalToday, error: jErr },
    { data: journalEntriesToday, error: jeErr },
    { count: moodRecordsToday, error: mrErr },
    { count: journalMonth, error: jmErr },
    { data: habitStreak, error: streakErr },
  ] = await Promise.all([
    // Tasks: pending + in_progress (excludes AI-pending review tasks)
    supabase.from("tasks")
      .select("id,title,status,priority,module,task_type,completed_count,target_count,frequency_type")
      .in("status", ["pending", "in_progress"])
      .or("ai_review_status.is.null,ai_review_status.neq.pending")
      .order("priority", { ascending: true })
      .limit(20),
    // One-time tasks completed today (recurring tasks tracked via task_completion_records)
    supabase.from("tasks")
      .select("id,title,status,priority,module,completed_at,task_type,completed_count,target_count")
      .eq("task_type", "one_time")
      .eq("status", "done")
      .gte("completed_at", today)
      .lte("completed_at", `${today}T23:59:59`)
      .order("completed_at", { ascending: false })
      .limit(20),
    // Active habits count
    supabase.from("habits")
      .select("id")
      .eq("is_active", true),
    // Today's habit records
    supabase.from("habit_records")
      .select("id,status")
      .eq("date", today),
    // Today's habit records with habit titles (for timeline)
    supabase.from("habit_records")
      .select("id,status,habit_id")
      .eq("date", today)
      .limit(20),
    // Active habits with names (for timeline aggregation)
    supabase.from("habits")
      .select("id,title,icon")
      .eq("is_active", true),
    // Total expressions
    supabase.from("expressions")
      .select("id", { count: "exact", head: true }),
    // Reviews completed today
    supabase.from("expression_reviews")
      .select("id,result,reviewed_at")
      .gte("reviewed_at", today)
      .lte("reviewed_at", `${today}T23:59:59`)
      .order("reviewed_at", { ascending: false }),
    // Reviews due
    supabase.from("expressions")
      .select("id")
      .in("status", ["review", "mastered"])
      .lte("next_review_date", today)
      .limit(50),
    // Speaking sessions today
    supabase.from("speaking_sessions")
      .select("id,scenario,duration_seconds,created_at")
      .gte("created_at", today)
      .lte("created_at", `${today}T23:59:59`)
      .order("created_at", { ascending: false }),
    // Last speaking session
    supabase.from("speaking_sessions")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1),
    // Today's mood
    supabase.from("mood_records")
      .select("mood,intensity")
      .eq("date", today)
      .order("created_at", { ascending: false })
      .limit(1),
    // Week mood data
    supabase.from("mood_records")
      .select("mood,intensity")
      .gte("date", weekAgoStr)
      .lte("date", today)
      .order("date", { ascending: false }),
    // Journal entries today (count)
    supabase.from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("date", today),
    // Journal entries today (content for timeline)
    supabase.from("journal_entries")
      .select("id,title,mood,created_at")
      .eq("date", today)
      .order("created_at", { ascending: false })
      .limit(5),
    // Mood records today
    supabase.from("mood_records")
      .select("id", { count: "exact", head: true })
      .eq("date", today),
    // Journal entries this month
    supabase.from("journal_entries")
      .select("id", { count: "exact", head: true })
      .gte("date", monthStart)
      .lte("date", today),
    // Habit streak (consecutive days with at least 1 completed habit)
    supabase.from("habit_records")
      .select("date,status")
      .gte("date", weekAgoStr)
      .lte("date", today)
      .order("date", { ascending: false }),
  ]);

  if (tasksErr || habitsErr || hrErr || reviewsErr || moodErr) {
    console.error("Dashboard query errors:", { tasksErr, habitsErr, hrErr, reviewsErr, moodErr });
  }

  // Build habit name lookup
  const habitNameMap = new Map<string, { name: string; icon: string }>();
  for (const h of (activeHabits || []) as Array<Record<string, unknown>>) {
    habitNameMap.set(h.id as string, {
      name: (h.name as string) || "未命名习惯",
      icon: (h.icon as string) || "✅",
    });
  }

  // ── Compute derived stats ──

  // Tasks
  const completedTaskCount = (completedTasks || []).length;
  const pendingTasks = (tasks || []).filter((t: Record<string, unknown>) => t.status !== "done");
  const totalTasks = completedTaskCount + (tasks || []).length;

  // Habits
  const totalHabits = (habits || []).length;
  const completedHabits = (habitRecords || []).filter((r: Record<string, unknown>) => r.status === "completed").length;
  const missedHabits = (habitRecords || []).filter((r: Record<string, unknown>) => r.status === "missed").length;

  // Habit streak
  let streak = 0;
  const habitByDate = new Map<string, Set<string>>();
  for (const r of (habitStreak || []) as Array<Record<string, unknown>>) {
    const d = r.date as string;
    if (!habitByDate.has(d)) habitByDate.set(d, new Set());
    habitByDate.get(d)!.add(r.status as string);
  }
  const checkDate = new Date(today);
  for (let i = 0; i < 90; i++) {
    const ds = checkDate.toISOString().split("T")[0];
    const statuses = habitByDate.get(ds);
    if (statuses && [...statuses].some((s) => s === "completed")) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Reviews
  const reviewsCompletedToday = (reviewsToday || []).length;
  const reviewsDueCount = (reviewsDue || []).length;
  const totalExpressions = expressionCount ?? 0;

  // Speaking
  const speakingSessions = (speakingToday || []) as Array<Record<string, unknown>>;
  const minutesToday = speakingSessions.reduce((sum: number, s: Record<string, unknown>) => {
    return sum + ((s.duration_seconds as number) || 0);
  }, 0) / 60;
  const lastSpeakingDate = lastSpeaking?.[0]?.created_at
    ? Math.floor((Date.now() - new Date((lastSpeaking[0] as Record<string, unknown>).created_at as string).getTime()) / 86400000)
    : null;

  // Mood
  const todayMood = moodToday?.[0] as Record<string, unknown> | undefined;
  const weekMoods = (moodWeek || []) as Array<Record<string, unknown>>;
  const weekAvgIntensity = weekMoods.length > 0
    ? weekMoods.reduce((sum: number, m: Record<string, unknown>) => sum + ((m.intensity as number) || 0), 0) / weekMoods.length
    : null;

  let dominantMood: string | null = null;
  const moodCounts = new Map<string, number>();
  for (const m of weekMoods) {
    const mood = m.mood as string;
    moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1);
  }
  let maxCount = 0;
  for (const [mood, count] of moodCounts) {
    if (count > maxCount) { maxCount = count; dominantMood = mood; }
  }

  // ── Build Timeline ──
  const timelineCompleted: TimelineItem[] = [];
  const timelineInProgress: TimelineItem[] = [];
  const timelinePending: TimelineItem[] = [];

  // Pending review/speaking items (collect first, aggregate later)
  const rawReviewItems: TimelineItem[] = [];
  const rawSpeakingItems: TimelineItem[] = [];
  const rawHabitItems: TimelineItem[] = [];

  // Completed tasks
  for (const t of (completedTasks || []) as Array<Record<string, unknown>>) {
    timelineCompleted.push({
      id: t.id as string,
      type: "task",
      title: t.title as string,
      status: "completed",
      time: t.completed_at ? new Date(t.completed_at as string).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : undefined,
      path: "/plan",
      displayType: "individual",
    });
  }

  // In-progress tasks
  const inProgressTasks = (tasks || []).filter((t: Record<string, unknown>) => {
    if (t.status === "in_progress") return true;
    // Recurring tasks with completed_count > 0 but status === "pending" are actually in progress
    if ((t.task_type as string) === "recurring" && (t.completed_count as number || 0) > 0 && t.status === "pending") return true;
    return false;
  });
  for (const t of inProgressTasks as Array<Record<string, unknown>>) {
    const isRecurring = (t.task_type as string) === "recurring";
    const compCount = (t.completed_count as number) || 0;
    const tgtCount = (t.target_count as number) || 1;
    const status: TimelineItem["status"] = isRecurring && compCount >= tgtCount ? "completed"
      : isRecurring && compCount > 0 ? "in_progress"
      : "in_progress";
    timelineInProgress.push({
      id: t.id as string,
      type: "task",
      title: t.title as string,
      subtitle: isRecurring
        ? `${compCount}/${tgtCount}`
        : (t.module as string) || undefined,
      status,
      path: "/plan",
      taskType: t.task_type as string,
      completedCount: compCount,
      targetCount: tgtCount,
      frequencyType: t.frequency_type as string,
      displayType: "individual",
    });
  }

  // Pending tasks (recurring with 0 completions)
  const pendingOnly = (tasks || []).filter((t: Record<string, unknown>) => {
    if ((t.task_type as string) === "recurring") {
      return (t.completed_count as number || 0) === 0 && t.status !== "done";
    }
    return t.status === "pending";
  });
  for (const t of pendingOnly as Array<Record<string, unknown>>) {
    const isRecurring = (t.task_type as string) === "recurring";
    const compCount = (t.completed_count as number) || 0;
    const tgtCount = (t.target_count as number) || 1;
    timelinePending.push({
      id: t.id as string,
      type: "task",
      title: t.title as string,
      subtitle: isRecurring
        ? `${compCount}/${tgtCount}`
        : `${t.priority === "high" ? "高优先" : t.priority === "medium" ? "中优先" : "低优先"}`,
      status: "pending",
      path: "/plan",
      taskType: t.task_type as string,
      completedCount: compCount,
      targetCount: tgtCount,
      frequencyType: t.frequency_type as string,
      displayType: "individual",
    });
  }

  // Habit records for timeline — use real habit names
  for (const r of (habitRecordsWithNames || []) as Array<Record<string, unknown>>) {
    const hStatus = r.status as string;
    const habitId = r.habit_id as string;
    const info = habitNameMap.get(habitId);
    const item: TimelineItem = {
      id: r.id as string,
      type: "habit",
      title: info ? `${info.icon || "✅"} ${info.name}` : `习惯 #${habitId.slice(0, 8)}`,
      status: hStatus === "completed" ? "completed" : hStatus === "missed" ? "pending" : "in_progress",
      metadata: { habitId },
    };
    rawHabitItems.push(item);
    if (hStatus === "completed") timelineCompleted.push(item);
    else if (hStatus === "missed") timelinePending.push(item);
    else timelineInProgress.push(item);
  }

  // Journal entries today
  for (const j of (journalEntriesToday || []) as Array<Record<string, unknown>>) {
    timelineCompleted.push({
      id: j.id as string,
      type: "journal",
      title: (j.title as string) || "日记",
      subtitle: (j.mood as string) || undefined,
      status: "completed",
      time: j.created_at ? new Date(j.created_at as string).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : undefined,
      path: `/life-trace/journal/${today}`,
      displayType: "individual",
    });
  }

  // Speaking sessions today
  for (const s of speakingSessions) {
    const mins = Math.round(((s.duration_seconds as number) || 0) / 60);
    const item: TimelineItem = {
      id: s.id as string,
      type: "speaking",
      title: (s.scenario as string) || "口语练习",
      subtitle: mins > 0 ? `${mins} 分钟` : undefined,
      status: "completed",
      time: s.created_at ? new Date(s.created_at as string).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : undefined,
      path: "/english/speaking",
    };
    rawSpeakingItems.push(item);
    timelineCompleted.push(item);
  }

  // Reviews today
  for (const r of (reviewsToday || []) as Array<Record<string, unknown>>) {
    const item: TimelineItem = {
      id: r.id as string,
      type: "review",
      title: "英语复习",
      subtitle: (r.result as string) === "correct" ? "掌握" : (r.result as string) === "partial" ? "部分正确" : "需复习",
      status: "completed",
      time: r.reviewed_at ? new Date(r.reviewed_at as string).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : undefined,
      path: "/english/review",
    };
    rawReviewItems.push(item);
    timelineCompleted.push(item);
  }

  // Sort completed by time (most recent first)
  timelineCompleted.sort((a, b) => (b.time || "").localeCompare(a.time || ""));

  // ── Store raw items for aggregation use ──
  // Aggregation is applied at display time (in TimelineSection) or can be
  // accessed via these exported helpers + raw data from the timeline arrays.
  // For convenience, we also export the raw groups on the stats object.

  return {
    tasks: {
      completed: completedTaskCount,
      total: totalTasks,
      pending: pendingTasks.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        title: t.title as string,
        priority: t.priority as string,
        module: t.module as string,
      })),
    },
    habits: {
      completed: completedHabits,
      total: totalHabits,
      streak,
      missed: missedHabits,
    },
    reviews: {
      due: reviewsDueCount,
      completedToday: reviewsCompletedToday,
      totalExpressions,
    },
    speaking: {
      sessionsToday: speakingSessions.length,
      minutesToday: Math.round(minutesToday),
      lastSessionDays: lastSpeakingDate,
    },
    mood: {
      today: (todayMood?.mood as string) || null,
      todayIntensity: (todayMood?.intensity as number) || null,
      weekAvgIntensity: weekAvgIntensity ? Math.round(weekAvgIntensity * 10) / 10 : null,
      dominantMood,
    },
    lifeTrace: {
      journalToday: journalToday ?? 0,
      moodRecordsToday: moodRecordsToday ?? 0,
      journalThisMonth: journalMonth ?? 0,
    },
    timeline: {
      completed: timelineCompleted,
      inProgress: timelineInProgress,
      pending: timelinePending,
    },
  };
}
