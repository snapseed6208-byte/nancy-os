// ============================================
// Nancy OS — Plan OS Hooks
// Goals, Tasks, AI Breakdown, Hierarchy
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

// ── Types ──

export type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: string;
  module?: string;
  goal_level: string;
  goal_category: string;
  target_metric?: string;
  current_metric?: string;
  start_date?: string;
  target_date?: string;
  status: string;
  progress: number;
  why?: string;
  parent_goal_id?: string;
  children?: GoalRow[];
};

export type TaskRow = {
  id: string;
  user_id: string;
  goal_id?: string;
  monthly_plan_id?: string;
  title: string;
  description?: string;
  category: string;
  module?: string;
  priority: string;
  energy_cost: string;
  energy_level: string;
  status: string;
  due_date?: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  is_today_focus: boolean;
  recurring_rule?: string;
  source_type: string;
  completed_at?: string;
  created_at: string;
};

export type TaskBreakdownItem = {
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  estimated_minutes: number;
  module?: string;
};

// ── Goals ──

async function fetchGoals(level?: string) {
  let query = supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false });

  if (level) query = query.eq("goal_level", level);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as GoalRow[];
}

export function useGoals(level?: string) {
  return useQuery({
    queryKey: ["goals", level],
    queryFn: () => fetchGoals(level),
    staleTime: 2 * 60 * 1000,
  });
}

function buildGoalTree(goals: GoalRow[]): GoalRow[] {
  const map = new Map<string, GoalRow>();
  const roots: GoalRow[] = [];

  for (const g of goals) {
    map.set(g.id, { ...g, children: [] });
  }

  for (const g of map.values()) {
    if (g.parent_goal_id && map.has(g.parent_goal_id)) {
      map.get(g.parent_goal_id)!.children!.push(g);
    } else {
      roots.push(g);
    }
  }

  return roots.sort((a, b) => {
    const order = { vision: 0, yearly: 1, monthly: 2 };
    return (order[a.goal_level as keyof typeof order] || 3) - (order[b.goal_level as keyof typeof order] || 3);
  });
}

export function useGoalHierarchy() {
  return useQuery({
    queryKey: ["goals", "hierarchy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return buildGoalTree((data || []) as GoalRow[]);
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      goalLevel: string;
      goalCategory?: string;
      parentGoalId?: string;
      targetMetric?: string;
      why?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("goals")
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          goal_level: input.goalLevel,
          goal_category: input.goalCategory || "life",
          category: "general",
          parent_goal_id: input.parentGoalId || null,
          target_metric: input.targetMetric,
          why: input.why,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; status?: string; progress?: number; target_metric?: string; current_metric?: string }) => {
      const { error } = await supabase
        .from("goals")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

// ── Tasks ──

async function fetchTasks(filters?: {
  status?: string;
  dueDate?: string;
  goalId?: string;
  isTodayFocus?: boolean;
  limit?: number;
}) {
  let query = supabase
    .from("tasks")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(filters?.limit || 50);

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.dueDate) query = query.eq("due_date", filters.dueDate);
  if (filters?.goalId) query = query.eq("goal_id", filters.goalId);
  if (filters?.isTodayFocus) query = query.eq("is_today_focus", true);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as TaskRow[];
}

export function useTasks(filters?: {
  status?: string;
  dueDate?: string;
  goalId?: string;
  isTodayFocus?: boolean;
}) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => fetchTasks(filters),
    staleTime: 30 * 1000,
  });
}

export function useTodayTasks() {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["tasks", "today"],
    queryFn: async () => {
      // Tasks due today OR marked as today focus
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .or(`due_date.eq.${today},is_today_focus.eq.true`)
        .in("status", ["pending", "in_progress"])
        .order("priority", { ascending: true })
        .limit(30);

      if (error) throw error;
      return (data || []) as TaskRow[];
    },
    staleTime: 30 * 1000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      priority?: string;
      module?: string;
      goalId?: string;
      dueDate?: string;
      estimatedMinutes?: number;
      isTodayFocus?: boolean;
      energyLevel?: string;
      timeSlot?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          priority: input.priority || "medium",
          module: input.module,
          goal_id: input.goalId || null,
          due_date: input.dueDate,
          estimated_minutes: input.estimatedMinutes,
          is_today_focus: input.isTodayFocus || false,
          energy_level: input.energyLevel || "medium",
          time_slot: input.timeSlot || null,
          category: input.module || "general",
          energy_cost: "medium",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      title?: string;
      status?: string;
      priority?: string;
      due_date?: string;
      is_today_focus?: boolean;
      goal_id?: string | null;
      estimated_minutes?: number;
      time_slot?: string | null;
      energy_level?: string;
      completed_at?: string;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useToggleTaskComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const isDone = currentStatus === "done";
      const { error } = await supabase
        .from("tasks")
        .update({
          status: isDone ? "pending" : "done",
          completed_at: isDone ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: async (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      // Auto-calculate goal progress from child task completion rates
      try {
        const { data: task } = await supabase
          .from("tasks")
          .select("goal_id")
          .eq("id", id)
          .single();

        const goalId = (task as Record<string, unknown> | null)?.goal_id as string | undefined;
        if (!goalId) return;

        const { data: siblings } = await supabase
          .from("tasks")
          .select("status")
          .eq("goal_id", goalId);

        const all = (siblings || []) as { status: string }[];
        if (all.length === 0) return;

        const done = all.filter((t) => t.status === "done").length;
        const progress = done / all.length;

        await supabase
          .from("goals")
          .update({
            progress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", goalId);

        qc.invalidateQueries({ queryKey: ["goals"] });
      } catch {
        // Non-critical: goal progress update is best-effort
      }
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── AI Task Breakdown ──

export function useTaskBreakdown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      goalTitle: string;
      goalDescription?: string;
      goalLevel?: string;
    }): Promise<{ tasks: TaskBreakdownItem[] }> => {
      const { data, error } = await supabase.functions.invoke("task-breakdown-agent", {
        body: {
          goal_title: input.goalTitle,
          goal_description: input.goalDescription,
          goal_level: input.goalLevel,
        },
      });

      if (error) throw new Error(error.message || "调用 AI 服务失败");
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// ── Batch create tasks from AI breakdown ──

export function useBatchCreateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      goalId?: string;
      tasks: TaskBreakdownItem[];
    }) => {
      const userId = await getUserId();
      const rows = input.tasks.map((t) => ({
        user_id: userId,
        title: t.title,
        description: t.description,
        priority: t.priority,
        module: t.module,
        goal_id: input.goalId || null,
        estimated_minutes: t.estimated_minutes,
        source_type: "ai_agent",
        ai_review_status: "pending",
        category: t.module || "general",
        energy_cost: "medium",
        energy_level: "medium",
      }));

      const { error } = await supabase.from("tasks").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── AI Task Review ──

export function useAiReviewTasks() {
  return useQuery({
    queryKey: ["tasks", "aiReview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("source_type", "ai_agent")
        .or("ai_review_status.is.null,ai_review_status.eq.pending")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data || []) as TaskRow[];
    },
    staleTime: 60 * 1000,
  });
}

export function useReviewAiTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, edits }: {
      id: string;
      action: "confirm" | "edit" | "delete";
      edits?: { title?: string; description?: string; priority?: string; estimated_minutes?: number };
    }) => {
      if (action === "delete") {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) throw error;
      } else if (action === "edit" && edits) {
        const { error } = await supabase
          .from("tasks")
          .update({ ...edits, ai_review_status: "edited", updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tasks")
          .update({ ai_review_status: "confirmed", updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks", "aiReview"] });
    },
  });
}

// ── Upcoming (for Dashboard Timeline) ──

export function useUpcomingTasks(days = 7) {
  const today = new Date().toISOString().split("T")[0];
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["tasks", "upcoming", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,priority,module,due_date,estimated_minutes")
        .in("status", ["pending", "in_progress"])
        .gte("due_date", today)
        .lte("due_date", endStr)
        .order("due_date", { ascending: true })
        .order("priority", { ascending: true })
        .limit(20);

      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        title: string;
        priority: string;
        module: string;
        due_date: string;
        estimated_minutes: number;
      }>;
    },
    staleTime: 60 * 1000,
  });
}

// ── Weekly Themes ──

export type WeeklyTheme = {
  id: string;
  user_id: string;
  template_id: string | null;
  title: string;
  category: string;
  icon: string | null;
  color: string | null;
  start_date: string;
  end_date: string;
  weekly_goal: string | null;
  daily_action: string | null;
  minimum_standard: string | null;
  check_in_type: string | null;
  status: string;
  check_ins: Record<string, unknown>[] | null;
  created_at: string;
};

function getCurrentWeekRange() {
  const t = new Date();
  const dow = t.getDay();
  const mon = new Date(t);
  mon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: mon.toISOString().split("T")[0],
    end: sun.toISOString().split("T")[0],
  };
}

async function fetchWeeklyThemes() {
  const { data, error } = await supabase
    .from("weekly_themes")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []) as WeeklyTheme[];
}

export function useWeeklyThemes() {
  return useQuery({
    queryKey: ["weekly_themes"],
    queryFn: fetchWeeklyThemes,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateWeeklyTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      category?: string;
      weekly_goal?: string;
      daily_action?: string;
      minimum_standard?: string;
    }) => {
      const userId = await getUserId();
      const week = getCurrentWeekRange();
      const { data, error } = await supabase
        .from("weekly_themes")
        .insert({
          user_id: userId,
          title: input.title,
          category: input.category || "general",
          weekly_goal: input.weekly_goal,
          daily_action: input.daily_action,
          minimum_standard: input.minimum_standard,
          start_date: week.start,
          end_date: week.end,
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weekly_themes"] }); },
  });
}

export function useUpdateWeeklyTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; status?: string; weekly_goal?: string; daily_action?: string; title?: string }) => {
      const { error } = await supabase.from("weekly_themes").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["weekly_themes"] }); },
  });
}

// ── Goal Progress ──

export type GoalWithProgress = GoalRow & {
  totalTasks: number;
  completedTasks: number;
  progress: number; // 0-1
};

async function fetchGoalProgress(): Promise<GoalWithProgress[]> {
  const [
    { data: goals },
    { data: allTasks },
  ] = await Promise.all([
    supabase.from("goals").select("id,title,status,goal_level,category").eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("tasks").select("id,goal_id,status").not("goal_id", "is", null),
  ]);

  const taskMap = new Map<string, { total: number; done: number }>();
  for (const t of (allTasks || []) as Array<Record<string, unknown>>) {
    const gid = t.goal_id as string;
    if (!taskMap.has(gid)) taskMap.set(gid, { total: 0, done: 0 });
    const entry = taskMap.get(gid)!;
    entry.total++;
    if (t.status === "done") entry.done++;
  }

  return ((goals || []) as unknown as GoalRow[]).map((g) => {
    const tasks = taskMap.get(g.id) || { total: 0, done: 0 };
    return {
      ...g,
      totalTasks: tasks.total,
      completedTasks: tasks.done,
      progress: tasks.total > 0 ? tasks.done / tasks.total : 0,
    };
  });
}

export function useGoalProgress() {
  return useQuery({
    queryKey: ["goals", "progress"],
    queryFn: fetchGoalProgress,
    staleTime: 60 * 1000,
  });
}
