import { useState, useEffect } from "react";
import {
  Flag, Calendar, ListChecks, TrendingUp, Loader2, Plus, Check, X,
  RefreshCw, Brain,
  Sparkles, ChevronRight, ChevronLeft, Circle, CircleDot, CheckCircle2, Trash2,
  Target, Clock, Zap, Lightbulb, ArrowRight, AlertTriangle, Heart,
  Edit3, Eye, Sun, Moon, Sunrise, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import {
  useGoalHierarchy, useCreateGoal,
  useTasks, useTodayTasks, useCreateTask, useUpdateTask, useToggleTaskComplete, useDeleteTask,
  useTaskBreakdown, useBatchCreateTasks, useAiReviewTasks, useReviewAiTask, useBatchReviewAiTasks,
  useWeeklyThemes, useCreateWeeklyTheme, useUpdateWeeklyTheme, useGoalProgress,
  type GoalRow, type TaskRow, type TaskBreakdownItem, type GoalWithProgress,
} from "@/lib/hooks/usePlan";
import {
  useHabitsWithToday, useCreateHabit, useToggleHabitRecord,
  useDeleteHabit, useHabitAnalysis, useGenerateHabitAnalysis,
  useHabitMonthCalendar, useHabitWeeklyStats,
  formatFrequency,
  type HabitWithRecord, type HabitAnalysis, type DayCell, type WeeklyStat,
} from "@/lib/hooks/useHabit";

// ── Constants ──

const TIME_SLOTS = [
  { key: "morning", label: "上午", icon: Zap, color: "text-accent-warm" },
  { key: "afternoon", label: "下午", icon: Clock, color: "text-accent-sky" },
  { key: "evening", label: "晚上", icon: Target, color: "text-sage-deep" },
] as const;

const PRIORITY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-accent-rose/10 text-accent-rose",
  medium: "bg-amber-50 text-amber-600",
  low: "bg-ink/5 text-ink-lighter",
};
const GOAL_LEVEL_LABELS: Record<string, string> = {
  vision: "愿景", yearly: "年度目标", monthly: "月度目标",
};
const GOAL_LEVEL_COLORS: Record<string, string> = {
  vision: "bg-purple-50 text-purple-700 border-purple-200",
  yearly: "bg-blue-50 text-blue-700 border-blue-200",
  monthly: "bg-sage-light/50 text-sage-deep border-sage-light",
};

type Tab = "today" | "goals" | "tasks" | "habits" | "weekly";

// ── Page ──

export default function Plan() {
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash;
    const match = hash.match(/[?&]tab=([^&]+)/);
    const initial = match?.[1];
    if (initial && ["today", "goals", "tasks", "habits", "weekly"].includes(initial)) {
      return initial as Tab;
    }
    return "today";
  });

  // Sync tab changes to URL
  const handleTabChange = (next: Tab) => {
    setTab(next);
    const hash = window.location.hash;
    const base = hash.split("?")[0] || "#/plan";
    const newHash = `${base}?tab=${next}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState({}, "", newHash);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-ink-lighter">计划管理</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Plan OS</h1>
      </header>

      {/* Tab bar */}
      <div className="flex bg-ink/5 rounded-xl p-1">
        {([
          { key: "today" as Tab, label: "今日计划", icon: Calendar },
          { key: "goals" as Tab, label: "目标层级", icon: Flag },
          { key: "tasks" as Tab, label: "任务列表", icon: ListChecks },
          { key: "habits" as Tab, label: "习惯追踪", icon: Heart },
          { key: "weekly" as Tab, label: "周计划", icon: TrendingUp },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
              tab === key ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "today" && <TodayPlan onTabChange={handleTabChange} />}
      {tab === "goals" && <GoalHierarchy />}
      {tab === "tasks" && <TaskList />}
      {tab === "habits" && <HabitTracker />}
      {tab === "weekly" && <WeeklyPlan />}
    </div>
  );
}

// ── Today Plan ──

function TodayPlan({ onTabChange }: { onTabChange: (tab: Tab) => void }) {
  const { data: tasks, isLoading } = useTodayTasks();
  const toggleComplete = useToggleTaskComplete();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const { data: goalsData } = useGoalHierarchy();
  const today = new Date().toISOString().split("T")[0];
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  const taskList = (tasks || []) as TaskRow[];
  const goals = (goalsData || []) as GoalRow[];
  const highTasks = taskList.filter((t) => t.priority === "high");
  const medTasks = taskList.filter((t) => t.priority === "medium");
  const lowTasks = taskList.filter((t) => t.priority === "low");

  // Separate lightweight query for today's completed count
  const { data: doneToday } = useQuery({
    queryKey: ["tasks", "today", "doneCount"],
    queryFn: async () => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "done")
        .gte("completed_at", today)
        .lte("completed_at", `${today}T23:59:59`);
      return count ?? 0;
    },
    staleTime: 30 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-ink-lighter" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-accent-rose/5 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-accent-rose">{highTasks.length + medTasks.length + lowTasks.length}</p>
          <p className="text-[10px] text-ink-lighter">待完成</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-500">{doneToday ?? 0}</p>
          <p className="text-[10px] text-ink-lighter">已完成</p>
        </div>
        <div className="bg-sage-light/30 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-sage-deep">{(highTasks.length + medTasks.length + lowTasks.length) + (doneToday ?? 0)}</p>
          <p className="text-[10px] text-ink-lighter">总计</p>
        </div>
      </div>

      {/* Add Task Quick */}
      <AddTaskForm context="today" />

      {taskList.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl border border-border">
          <Calendar size={28} className="text-ink-lighter mx-auto mb-2" />
          <p className="text-sm text-ink-light">今日暂无计划</p>
          <p className="text-xs text-ink-lighter mt-1">在上方快速添加任务，或从目标拆解任务</p>
        </div>
      ) : (
        <>
          {/* High priority — morning */}
          {highTasks.length > 0 && (
            <TaskSection
              icon={Zap}
              label="优先完成"
              color="text-accent-rose"
              tasks={highTasks}
              onToggle={(id, status) => toggleComplete.mutate({ id, currentStatus: status })}
              onDelete={(id) => deleteTask.mutate(id)}
              onEdit={(id, updates) => updateTask.mutate({ id, ...updates })}
              onEditFull={(t) => setEditingTask(t)}
            />
          )}

          {/* Medium priority — afternoon */}
          {medTasks.length > 0 && (
            <TaskSection
              icon={Clock}
              label="计划推进"
              color="text-accent-sky"
              tasks={medTasks}
              onToggle={(id, status) => toggleComplete.mutate({ id, currentStatus: status })}
              onDelete={(id) => deleteTask.mutate(id)}
              onEdit={(id, updates) => updateTask.mutate({ id, ...updates })}
              onEditFull={(t) => setEditingTask(t)}
            />
          )}

          {/* Low priority — evening */}
          {lowTasks.length > 0 && (
            <TaskSection
              icon={Target}
              label="有空再做"
              color="text-sage-deep"
              tasks={lowTasks}
              onToggle={(id, status) => toggleComplete.mutate({ id, currentStatus: status })}
              onDelete={(id) => deleteTask.mutate(id)}
              onEdit={(id, updates) => updateTask.mutate({ id, ...updates })}
              onEditFull={(t) => setEditingTask(t)}
            />
          )}

          {/* Completed summary */}
          {(doneToday ?? 0) > 0 && (
            <p className="text-center text-[11px] text-ink-lighter py-2">
              今日已完成 {doneToday} 项 ·
              <button
                onClick={() => onTabChange("tasks")}
                className="text-sage-deep underline ml-1"
              >
                查看全部任务
              </button>
            </p>
          )}
        </>
      )}
      {/* Task Edit Drawer */}
      {editingTask && (
        <TaskEditDrawer
          task={editingTask}
          goals={goals}
          onClose={() => setEditingTask(null)}
          onSave={(id, updates) => {
            updateTask.mutate({ id, ...updates } as { id: string; title?: string });
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

function TaskSection({
  icon: Icon, label, color, tasks, onToggle, onDelete, onEdit, onEditFull, defaultCollapsed,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  color: string;
  tasks: TaskRow[];
  onToggle: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, updates: { title?: string; priority?: string }) => void;
  onEditFull?: (task: TaskRow) => void;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const isRecurring = (t: TaskRow) => t.task_type === "recurring";

  const startEdit = (t: TaskRow) => {
    setEditingId(t.id);
    setEditTitle(t.title);
  };

  const saveEdit = (id: string) => {
    if (editTitle.trim()) {
      onEdit(id, { title: editTitle.trim() });
    }
    setEditingId(null);
  };

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-2 w-full text-left"
      >
        <Icon size={13} className={color} />
        <span className="text-xs font-medium text-ink">{label}</span>
        <span className="text-[10px] text-ink-lighter">({tasks.length})</span>
        <ChevronRight size={10} className={cn("text-ink-lighter transition-transform ml-auto", collapsed || "rotate-90")} />
      </button>
      {!collapsed && (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 bg-card border border-border/50 transition-colors",
                t.status === "done" && "opacity-60",
              )}
            >
              <button
                onClick={() => onToggle(t.id, t.status)}
                className="shrink-0"
              >
                {t.status === "done"
                  ? <CheckCircle2 size={16} className="text-emerald-500" />
                  : t.status === "in_progress"
                    ? <CircleDot size={16} className="text-accent-sky" />
                    : <Circle size={16} className="text-ink-lighter" />}
              </button>
              <div className="flex-1 min-w-0">
                {editingId === t.id ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => saveEdit(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(t.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="text-xs rounded border border-sage-light px-2 py-0.5 w-full outline-none bg-white"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p
                    className={cn("text-xs text-ink truncate cursor-pointer hover:text-sage-deep transition-colors", t.status === "done" && "line-through")}
                    onClick={() => startEdit(t)}
                    title="点击编辑标题"
                  >
                    {t.title}
                  </p>
                )}
                {isRecurring(t) ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-ink-lighter">
                      {t.completed_count}/{t.target_count}
                    </span>
                    <div className="w-12 bg-ink/10 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-accent-sky h-full rounded-full transition-all"
                        style={{ width: `${Math.min((t.completed_count / (t.target_count || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-ink-lighter">
                      {t.frequency_type === "daily" ? "每天" : t.frequency_type === "weekly" ? "每周" : t.frequency_type === "monthly" ? "每月" : ""}
                    </span>
                  </div>
                ) : (
                  t.description && (
                    <p className="text-[10px] text-ink-lighter truncate">{t.description}</p>
                  )
                )}
              </div>
              {(t as TaskRow & { time_slot?: string }).time_slot && (
                <span className="text-[10px] text-ink-lighter shrink-0 px-1 py-0.5 rounded bg-ink/5">
                  {TIME_SLOTS.find((s) => s.key === (t as TaskRow & { time_slot?: string }).time_slot)?.label || (t as TaskRow & { time_slot?: string }).time_slot}
                </span>
              )}
              {t.estimated_minutes && (
                <span className="text-[10px] text-ink-lighter shrink-0">{t.estimated_minutes}min</span>
              )}
              {!isRecurring(t) && (
                <button
                  onClick={() => {
                    const next = t.priority === "high" ? "medium" : t.priority === "medium" ? "low" : "high";
                    onEdit(t.id, { priority: next });
                  }}
                  className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 cursor-pointer hover:opacity-80 transition-opacity", PRIORITY_COLORS[t.priority] || "")}
                  title="点击切换优先级"
                >
                  {PRIORITY_LABELS[t.priority] || t.priority}
                </button>
              )}
              {isRecurring(t) && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-accent-sky/10 text-accent-sky">
                  周期
                </span>
              )}
              {onEditFull && (
                <button
                  onClick={() => onEditFull(t)}
                  className="text-ink-lighter hover:text-sage-deep shrink-0"
                  title="完整编辑"
                >
                  <Edit3 size={12} />
                </button>
              )}
              <button
                onClick={() => onDelete(t.id)}
                className="text-ink-lighter hover:text-accent-rose shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quick Add Task ──

const CATEGORIES = [
  { key: "general", label: "通用", icon: "📋" },
  { key: "english", label: "英语", icon: "🇬🇧" },
  { key: "health", label: "健康", icon: "💪" },
  { key: "career", label: "职业", icon: "💼" },
  { key: "life", label: "生活", icon: "🏠" },
] as const;

function AddTaskForm({ context = "today" }: { context?: "today" | "tasks" }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [timeSlot, setTimeSlot] = useState<string>("");
  const [description, setDescription] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [dueDate, setDueDate] = useState(context === "today" ? new Date().toISOString().split("T")[0] : "");
  const [startDate, setStartDate] = useState("");
  const [category, setCategory] = useState("general");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequencyType, setFrequencyType] = useState("daily");
  const [targetCount, setTargetCount] = useState(1);
  const [goalId, setGoalId] = useState("");
  const createTask = useCreateTask();
  const { data: goalsData } = useGoalHierarchy();

  const goals = (goalsData || []) as GoalRow[];

  const handleSubmit = async () => {
    if (!title.trim()) return;
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description || undefined,
        priority,
        category,
        isTodayFocus: context === "today",
        dueDate: dueDate || (context === "today" ? new Date().toISOString().split("T")[0] : undefined),
        startDate: startDate || undefined,
        estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
        timeSlot: timeSlot || undefined,
        goalId: goalId || undefined,
        taskType: isRecurring ? "recurring" : "one_time",
        frequencyType: isRecurring ? frequencyType : undefined,
        targetCount: isRecurring ? targetCount : undefined,
      });
      // Reset
      setTitle(""); setPriority("medium"); setTimeSlot("");
      setDescription(""); setEstimatedMinutes("");
      setDueDate(context === "today" ? new Date().toISOString().split("T")[0] : "");
      setStartDate(""); setCategory("general");
      setShowAdvanced(false); setIsRecurring(false);
      setFrequencyType("daily"); setTargetCount(1); setGoalId("");
      setShow(false);
    } catch { /* handled by mutation */ }
  };

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 border border-dashed border-sage-light/50 text-xs text-sage-deep hover:bg-sage-light/10 transition-colors"
      >
        <Plus size={13} />
        {context === "today" ? "添加今日任务" : "添加任务"}
      </button>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-sage-light/30 p-3 space-y-2.5">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="任务标题..."
        className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !showAdvanced) handleSubmit();
        }}
      />
      {/* Quick row: priority + time slot */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(["high", "medium", "low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriority(p)}
            className={cn(
              "text-[10px] px-2 py-1 rounded-full font-medium transition-colors",
              priority === p ? PRIORITY_COLORS[p] : "bg-ink/5 text-ink-lighter",
            )}
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}
        <span className="text-[10px] text-ink-lighter">·</span>
        {TIME_SLOTS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTimeSlot(timeSlot === key ? "" : key)}
            className={cn(
              "text-[10px] px-2 py-1 rounded-full font-medium transition-colors flex items-center gap-0.5",
              timeSlot === key ? "bg-white border border-sage-light/50 " + color : "bg-ink/5 text-ink-lighter",
            )}
          >
            <Icon size={9} /> {label}
          </button>
        ))}
        <span className="text-[10px] text-ink-lighter">·</span>
        <input
          type="number"
          value={estimatedMinutes}
          onChange={(e) => setEstimatedMinutes(e.target.value)}
          placeholder="分钟"
          className="text-[10px] w-12 rounded-full px-2 py-1 bg-ink/5 text-ink-light outline-none border-0"
          min="1"
        />
        <span className="text-[10px] text-ink-lighter">min</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn("text-[10px] px-2 py-1 rounded-full transition-colors", showAdvanced ? "bg-sage-light/30 text-sage-deep" : "bg-ink/5 text-ink-lighter")}
        >
          {showAdvanced ? "收起" : "更多"}
        </button>
        <button onClick={() => setShow(false)} className="text-ink-lighter hover:text-ink p-1">
          <X size={14} />
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || createTask.isPending}
          className="bg-sage-light text-sage-deep rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {createTask.isPending ? "..." : "添加"}
        </button>
      </div>

      {/* Advanced fields */}
      {showAdvanced && (
        <div className="space-y-2 pt-1 border-t border-border/30">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="任务描述..."
            className="w-full text-xs rounded-lg border border-border px-3 py-1.5 bg-white resize-none h-14"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">截止日期</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-[10px] rounded-lg border border-border px-2 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-[10px] rounded-lg border border-border px-2 py-1.5 bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">分类</label>
              <div className="flex gap-0.5 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={cn(
                      "text-[10px] px-1.5 py-1 rounded transition-colors",
                      category === c.key ? "bg-sage-light text-sage-deep font-medium" : "bg-ink/5 text-ink-lighter",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">关联目标</label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full text-[10px] rounded-lg border border-border px-2 py-1.5 bg-white"
              >
                <option value="">无</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Recurring toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRecurring(!isRecurring)}
              className={cn(
                "text-[10px] px-2 py-1 rounded-full transition-colors flex items-center gap-1",
                isRecurring ? "bg-accent-sky/10 text-accent-sky font-medium" : "bg-ink/5 text-ink-lighter",
              )}
            >
              <RefreshCw size={9} /> 周期任务
            </button>
            {isRecurring && (
              <>
                {(["daily", "weekly", "monthly"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequencyType(f)}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded-full transition-colors",
                      frequencyType === f ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-lighter",
                    )}
                  >
                    {f === "daily" ? "每天" : f === "weekly" ? "每周" : "每月"}
                  </button>
                ))}
                <select
                  value={targetCount}
                  onChange={(e) => setTargetCount(Number(e.target.value))}
                  className="text-[10px] bg-ink/5 rounded-full px-2 py-1 outline-none"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}次</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task Edit Drawer ──

function TaskEditDrawer({
  task,
  goals,
  onClose,
  onSave,
}: {
  task: TaskRow;
  goals: GoalRow[];
  onClose: () => void;
  onSave: (id: string, updates: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [category, setCategory] = useState(task.category || "general");
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes?.toString() || "");
  const [dueDate, setDueDate] = useState(task.due_date || "");
  const [startDate, setStartDate] = useState(task.start_date || "");
  const [timeSlot, setTimeSlot] = useState(task.time_slot || "");
  const [energyLevel, setEnergyLevel] = useState(task.energy_level || "medium");
  const [goalId, setGoalId] = useState(task.goal_id || "");
  const [scheduledStart, setScheduledStart] = useState(task.scheduled_time_start || "");
  const [scheduledEnd, setScheduledEnd] = useState(task.scheduled_time_end || "");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(task.id, {
      title: title.trim(),
      description: description || null,
      priority,
      category,
      estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
      due_date: dueDate || null,
      start_date: startDate || null,
      time_slot: timeSlot || null,
      energy_level: energyLevel,
      goal_id: goalId || null,
      scheduled_time_start: scheduledStart || null,
      scheduled_time_end: scheduledEnd || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-80 max-w-full bg-white h-full overflow-y-auto shadow-xl border-l border-border">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-4 py-3 flex items-center justify-between z-10">
          <h3 className="text-sm font-semibold text-ink">编辑任务</h3>
          <button onClick={onClose} className="text-ink-lighter hover:text-ink p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Title */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-lg border border-border px-3 py-2 bg-white resize-none h-20"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">优先级</label>
            <div className="flex gap-1.5">
              {(["high", "medium", "low"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                    priority === p ? PRIORITY_COLORS[p] + " ring-1 ring-offset-1" : "bg-ink/5 text-ink-lighter",
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">分类</label>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded transition-colors",
                    category === c.key ? "bg-sage-light text-sage-deep font-medium" : "bg-ink/5 text-ink-lighter",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time slot */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">时段</label>
            <div className="flex gap-1.5">
              {TIME_SLOTS.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => setTimeSlot(timeSlot === key ? "" : key)}
                  className={cn(
                    "text-[10px] px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1",
                    timeSlot === key ? "bg-white border border-sage-light/50 " + color : "bg-ink/5 text-ink-lighter",
                  )}
                >
                  <Icon size={10} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Energy level */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">精力消耗</label>
            <div className="flex gap-1.5">
              {(["low", "medium", "high"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnergyLevel(e)}
                  className={cn(
                    "text-[10px] px-2 py-1.5 rounded-lg transition-colors",
                    energyLevel === e ? "bg-sage-light text-sage-deep font-medium" : "bg-ink/5 text-ink-lighter",
                  )}
                >
                  {e === "low" ? "低" : e === "medium" ? "中" : "高"}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated minutes */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">预估时间 (分钟)</label>
            <input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white"
              min="1"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">截止日期</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-border px-2 py-2 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-border px-2 py-2 bg-white"
              />
            </div>
          </div>

          {/* Scheduled times */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">计划开始时间</label>
              <input
                type="time"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full text-xs rounded-lg border border-border px-2 py-2 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-ink-lighter block mb-0.5">计划结束时间</label>
              <input
                type="time"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full text-xs rounded-lg border border-border px-2 py-2 bg-white"
              />
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="text-[10px] text-ink-lighter block mb-0.5">关联目标</label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white"
            >
              <option value="">无</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>

          {/* Task info summary */}
          <div className="bg-ink/5 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-ink-lighter">状态</span>
              <span className="text-ink">{task.status === "done" ? "已完成" : task.status === "in_progress" ? "进行中" : "待完成"}</span>
            </div>
            {task.task_type === "recurring" && (
              <>
                <div className="flex justify-between text-[10px]">
                  <span className="text-ink-lighter">类型</span>
                  <span className="text-accent-sky">周期任务</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-ink-lighter">进度</span>
                  <span className="text-ink">{task.completed_count}/{task.target_count}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-[10px]">
              <span className="text-ink-lighter">创建时间</span>
              <span className="text-ink">{new Date(task.created_at).toLocaleDateString("zh-CN")}</span>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="sticky bottom-0 bg-white border-t border-border px-4 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs text-ink-light bg-ink/5 rounded-lg hover:bg-ink/10 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 text-xs font-medium text-white bg-sage-deep rounded-lg hover:bg-sage-deep/90 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Goal Hierarchy ──

function GoalHierarchy() {
  const { data: hierarchy, isLoading } = useGoalHierarchy();
  const createGoal = useCreateGoal();
  const breakdown = useTaskBreakdown();
  const batchCreate = useBatchCreateTasks();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLevel, setNewLevel] = useState("monthly");
  const [breakingDownId, setBreakingDownId] = useState<string | null>(null);

  const goals = (hierarchy || []) as GoalRow[];

  const handleBreakdown = async (goal: GoalRow) => {
    setBreakingDownId(goal.id);
    try {
      const result = await breakdown.mutateAsync({
        goalTitle: goal.title,
        goalDescription: goal.description,
        goalLevel: goal.goal_level,
      });
      if (result?.tasks?.length) {
        await batchCreate.mutateAsync({ goalId: goal.id, tasks: result.tasks });
      }
    } catch { /* handled by mutation */ }
    setBreakingDownId(null);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 border border-dashed border-sage-light/50 text-xs text-sage-deep hover:bg-sage-light/10 transition-colors"
      >
        <Plus size={13} /> 添加目标
      </button>

      {showAdd && (
        <div className="bg-card rounded-xl border border-sage-light/30 p-3 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="目标标题..."
            className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white"
            autoFocus
          />
          <div className="flex items-center gap-2">
            {(["vision", "yearly", "monthly"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setNewLevel(l)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full font-medium transition-colors",
                  newLevel === l ? GOAL_LEVEL_COLORS[l].split(" ")[0] + " " + GOAL_LEVEL_COLORS[l].split(" ")[1] : "bg-ink/5 text-ink-lighter",
                )}
              >
                {GOAL_LEVEL_LABELS[l]}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => {
                if (!newTitle.trim()) return;
                createGoal.mutate({ title: newTitle.trim(), goalLevel: newLevel });
                setNewTitle("");
                setShowAdd(false);
              }}
              disabled={!newTitle.trim()}
              className="bg-sage-light text-sage-deep rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              创建
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-ink-lighter" />
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl border border-border">
          <Flag size={28} className="text-ink-lighter mx-auto mb-2" />
          <p className="text-sm text-ink-light">尚未创建目标</p>
          <p className="text-xs text-ink-lighter mt-1">从愿景开始，逐层分解到月度目标</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onBreakdown={handleBreakdown}
              breakingDown={breakingDownId === goal.id}
            />
          ))}
        </div>
      )}

      {breakdown.error && (
        <div className="text-xs text-accent-rose bg-accent-rose/5 rounded-lg p-2">
          AI 拆解失败: {(breakdown.error as Error).message}
        </div>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onBreakdown,
  breakingDown,
  depth = 0,
}: {
  goal: GoalRow;
  onBreakdown: (g: GoalRow) => void;
  breakingDown: boolean;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = goal.children && goal.children.length > 0;

  return (
    <div className={cn("rounded-xl border p-3", GOAL_LEVEL_COLORS[goal.goal_level] || "border-border bg-card")}>
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-white/60">
              {GOAL_LEVEL_LABELS[goal.goal_level] || goal.goal_level}
            </span>
            {goal.target_metric && (
              <span className="text-[10px] text-ink-lighter">{goal.target_metric}</span>
            )}
            {goal.progress > 0 && (
              <span className="text-[10px] text-emerald-500">{Math.round(goal.progress * 100)}%</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-ink">{goal.title}</h3>
          {goal.description && (
            <p className="text-xs text-ink-light mt-0.5 line-clamp-2">{goal.description}</p>
          )}
          {goal.why && (
            <p className="text-[10px] text-ink-lighter mt-1 italic">Why: {goal.why}</p>
          )}
        </div>
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} className="text-ink-lighter shrink-0 mt-1">
            <ChevronRight size={14} className={cn("transition-transform", expanded && "rotate-90")} />
          </button>
        )}
      </div>

      {/* AI Breakdown button */}
      <div className="flex gap-2 mt-2 pt-2 border-t border-border/30">
        <button
          onClick={() => onBreakdown(goal)}
          disabled={breakingDown}
          className="flex items-center gap-1 text-[10px] text-sage-deep bg-sage-light/30 rounded-lg px-2 py-1 hover:bg-sage-light/50 transition-colors disabled:opacity-50"
        >
          {breakingDown ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          AI 拆解
        </button>
        <a
          href={`/plan?goal=${goal.id}`}
          onClick={(e) => { e.preventDefault(); }}
          className="flex items-center gap-1 text-[10px] text-ink-lighter rounded-lg px-2 py-1 hover:bg-ink/5 transition-colors"
        >
          <ListChecks size={10} /> 查看任务
        </a>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className={cn("mt-2 space-y-1.5", depth === 0 && "ml-4 pl-3 border-l-2 border-border/50")}>
          {goal.children!.map((child) => (
            <GoalCard
              key={child.id}
              goal={child}
              onBreakdown={onBreakdown}
              breakingDown={breakingDown}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Task List ──

function TaskList() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: tasks, isLoading } = useTasks(
    statusFilter ? { status: statusFilter } : { all: true },
  );
  const toggleComplete = useToggleTaskComplete();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const { data: goalsData } = useGoalHierarchy();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  const goals = (goalsData || []) as GoalRow[];
  const today = new Date().toISOString().split("T")[0];

  const taskList = (tasks || []) as TaskRow[];

  const startEdit = (t: TaskRow) => {
    setEditingId(t.id);
    setEditTitle(t.title);
  };

  const saveEdit = (id: string) => {
    if (editTitle.trim()) {
      updateTask.mutate({ id, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Add task */}
      <AddTaskForm context="tasks" />

      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "", label: "全部" },
          { key: "pending", label: "待完成" },
          { key: "in_progress", label: "进行中" },
          { key: "done", label: "已完成" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
              statusFilter === f.key ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-ink-lighter" />
        </div>
      ) : taskList.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl border border-border">
          <ListChecks size={28} className="text-ink-lighter mx-auto mb-2" />
          <p className="text-sm text-ink-light">暂无任务</p>
          <p className="text-xs text-ink-lighter mt-1">从目标拆解或手动创建任务</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {taskList.map((t) => {
            const isRecurring = t.task_type === "recurring";
            return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 bg-card border border-border/50",
                t.status === "done" && "opacity-60",
              )}
            >
              <button onClick={() => toggleComplete.mutate({ id: t.id, currentStatus: t.status })} className="shrink-0">
                {t.status === "done"
                  ? <CheckCircle2 size={16} className="text-emerald-500" />
                  : t.status === "in_progress"
                    ? <CircleDot size={16} className="text-accent-sky" />
                    : <Circle size={16} className="text-ink-lighter" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {editingId === t.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => saveEdit(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(t.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="text-xs rounded border border-sage-light px-2 py-0.5 flex-1 outline-none bg-white"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p
                      className={cn("text-xs text-ink truncate cursor-pointer hover:text-sage-deep transition-colors", t.status === "done" && "line-through")}
                      onClick={() => startEdit(t)}
                      title="点击编辑标题"
                    >
                      {t.title}
                    </p>
                  )}
                  {t.source_type === "ai_agent" && (
                    <Sparkles size={9} className="text-sage-deep shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {isRecurring ? (
                    <>
                      <span className="text-[10px] text-ink-lighter">
                        {t.completed_count}/{t.target_count}
                      </span>
                      <div className="w-10 bg-ink/10 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-accent-sky h-full rounded-full transition-all"
                          style={{ width: `${Math.min((t.completed_count / (t.target_count || 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-ink-lighter">
                        {t.frequency_type === "daily" ? "每天" : t.frequency_type === "weekly" ? "每周" : t.frequency_type === "monthly" ? "每月" : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      {t.module && <span className="text-[10px] text-ink-lighter">{t.module}</span>}
                      {(t as TaskRow & { time_slot?: string }).time_slot && (
                        <span className="text-[10px] text-ink-lighter">
                          {TIME_SLOTS.find((s) => s.key === (t as TaskRow & { time_slot?: string }).time_slot)?.label}
                        </span>
                      )}
                      {t.due_date && (
                        <span className={cn(
                          "text-[10px]",
                          new Date(t.due_date) < new Date(new Date().toISOString().split("T")[0])
                            ? "text-accent-rose" : "text-ink-lighter",
                        )}>
                          {t.due_date}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              {t.estimated_minutes && (
                <span className="text-[10px] text-ink-lighter shrink-0">{t.estimated_minutes}min</span>
              )}
              {isRecurring ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-accent-sky/10 text-accent-sky">
                  周期
                </span>
              ) : (
                <button
                  onClick={() => {
                    const next = t.priority === "high" ? "medium" : t.priority === "medium" ? "low" : "high";
                    updateTask.mutate({ id: t.id, priority: next });
                  }}
                  className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 cursor-pointer hover:opacity-80 transition-opacity", PRIORITY_COLORS[t.priority] || "")}
                  title="点击切换优先级"
                >
                  {PRIORITY_LABELS[t.priority] || t.priority}
                </button>
              )}
              {!isRecurring && t.due_date !== today && (
                <button
                  onClick={() => updateTask.mutate({ id: t.id, due_date: today, is_today_focus: true })}
                  className="text-ink-lighter hover:text-accent-warm shrink-0"
                  title="加入今日计划"
                >
                  <Sun size={12} />
                </button>
              )}
              <button
                onClick={() => setEditingTask(t)}
                className="text-ink-lighter hover:text-sage-deep shrink-0"
                title="完整编辑"
              >
                <Edit3 size={12} />
              </button>
              <button onClick={() => deleteTask.mutate(t.id)} className="text-ink-lighter hover:text-accent-rose shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          )})}
        </div>
      )}

      {/* Task Edit Drawer */}
      {editingTask && (
        <TaskEditDrawer
          task={editingTask}
          goals={goals}
          onClose={() => setEditingTask(null)}
          onSave={(id, updates) => {
            updateTask.mutate({ id, ...updates } as { id: string; title?: string });
            setEditingTask(null);
          }}
        />
      )}

      {/* AI Review Section */}
      <AiReviewSection />
    </div>
  );
}

// ── AI Task Review ──

function AiReviewSection() {
  const { data: aiTasks, isLoading } = useAiReviewTasks();
  const reviewTask = useReviewAiTask();
  const batchReview = useBatchReviewAiTasks();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const pendingTasks = (aiTasks || []) as (TaskRow & { time_slot?: string; ai_review_status?: string })[];
  const isBusy = reviewTask.isPending || batchReview.isPending;

  if (isLoading || pendingTasks.length === 0) return null;

  const reviewError = reviewTask.error;
  const batchError = batchReview.error;

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={13} className="text-amber-600" />
        <h3 className="text-xs font-semibold text-amber-800">AI 生成任务待审核</h3>
        <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
          {pendingTasks.length}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => batchReview.mutate({ ids: pendingTasks.map((t) => t.id), action: "confirm" })}
          disabled={isBusy}
          className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-medium hover:bg-emerald-200 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <CheckCheck size={11} /> 全部确认
        </button>
        <button
          onClick={() => {
            if (!confirm(`确定删除全部 ${pendingTasks.length} 个待审核任务？`)) return;
            batchReview.mutate({ ids: pendingTasks.map((t) => t.id), action: "delete" });
          }}
          disabled={isBusy}
          className="text-[10px] bg-accent-rose/10 text-accent-rose px-2 py-1 rounded-lg font-medium hover:bg-accent-rose/20 transition-colors disabled:opacity-50"
        >
          全部删除
        </button>
      </div>
      {reviewError && (
        <p className="text-[10px] text-accent-rose bg-accent-rose/5 rounded-lg px-2 py-1">操作失败: {(reviewError as Error).message}</p>
      )}
      {batchError && (
        <p className="text-[10px] text-accent-rose bg-accent-rose/5 rounded-lg px-2 py-1">批量操作失败: {(batchError as Error).message}</p>
      )}
      <div className="space-y-1.5">
        {pendingTasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-amber-100">
            {editingId === t.id ? (
              <>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 text-xs rounded-lg border border-border px-2 py-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      reviewTask.mutate({ id: t.id, action: "edit", edits: { title: editTitle } });
                      setEditingId(null);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    reviewTask.mutate({ id: t.id, action: "edit", edits: { title: editTitle } });
                    setEditingId(null);
                  }}
                  className="text-[10px] bg-sage-light text-sage-deep px-2 py-0.5 rounded"
                >
                  保存
                </button>
                <button onClick={() => setEditingId(null)} className="text-[10px] text-ink-lighter px-1">
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ink truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {t.task_type === "recurring" && (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-accent-sky/10 text-accent-sky">
                        周期·{t.completed_count || 0}/{t.target_count || 1}
                      </span>
                    )}
                    {t.priority && (
                      <span className={cn("text-[9px] px-1 py-0.5 rounded-full", PRIORITY_COLORS[t.priority])}>
                        {PRIORITY_LABELS[t.priority]}
                      </span>
                    )}
                    {t.estimated_minutes && (
                      <span className="text-[9px] text-ink-lighter">{t.estimated_minutes}min</span>
                    )}
                    {t.module && <span className="text-[9px] text-ink-lighter">{t.module}</span>}
                  </div>
                </div>
                <button
                  onClick={() => reviewTask.mutate({ id: t.id, action: "confirm" })}
                  disabled={reviewTask.isPending}
                  className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg font-medium hover:bg-emerald-100 transition-colors"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => {
                    setEditingId(t.id);
                    setEditTitle(t.title);
                  }}
                  className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded-lg font-medium hover:bg-amber-100 transition-colors"
                >
                  <Edit3 size={12} />
                </button>
                <button
                  onClick={() => reviewTask.mutate({ id: t.id, action: "delete" })}
                  disabled={reviewTask.isPending}
                  className="text-[10px] bg-accent-rose/10 text-accent-rose px-2 py-1 rounded-lg font-medium hover:bg-accent-rose/20 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Habit Tracker ──

const HABIT_ICONS = ["💪", "📚", "🧘", "🏃", "💧", "🍎", "😴", "✍️", "🎯", "🌟"];
const HABIT_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"];

function HabitTracker() {
  const { data: habitsWithToday, isLoading } = useHabitsWithToday();
  const toggleRecord = useToggleHabitRecord();
  const createHabit = useCreateHabit();
  const deleteHabit = useDeleteHabit();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFrequencyType, setNewFrequencyType] = useState("daily");
  const [newFrequencyValue, setNewFrequencyValue] = useState(1);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  const habits = (habitsWithToday || []) as HabitWithRecord[];
  const today = new Date().toISOString().split("T")[0];

  const completedCount = habits.filter(
    (h) => h.today_record?.status === "completed",
  ).length;
  const totalCount = habits.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const { data: analysis } = useHabitAnalysis();
  const generateAnalysis = useGenerateHabitAnalysis();
  const { data: calendar } = useHabitMonthCalendar(calYear, calMonth);
  const { data: weeklyStats } = useHabitWeeklyStats(4);

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

  const statusCycleLabel = (status?: string) => {
    if (!status) return "○";
    if (status === "completed") return "✓";
    if (status === "skipped") return "→";
    return "✗";
  };

  const statusColor = (status?: string) => {
    if (!status) return "border-ink/20 bg-white text-ink-lighter";
    if (status === "completed") return "border-emerald-300 bg-emerald-50 text-emerald-600";
    if (status === "skipped") return "border-amber-300 bg-amber-50 text-amber-600";
    return "border-accent-rose/30 bg-accent-rose/5 text-accent-rose";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-ink-lighter" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats: 4-stat grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-500">{completedCount}</p>
          <p className="text-[10px] text-ink-lighter">今日完成</p>
        </div>
        <div className="bg-accent-sky/5 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-accent-sky">{completionRate}%</p>
          <p className="text-[10px] text-ink-lighter">完成率</p>
        </div>
        <div className="bg-sage-light/30 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-sage-deep">{totalCount}</p>
          <p className="text-[10px] text-ink-lighter">总习惯数</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-2.5 text-center">
          <p className="text-sm font-bold text-purple-600">
            {analysis ? "✓" : "-"}
          </p>
          <p className="text-[10px] text-ink-lighter">本月分析</p>
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="bg-ink/5 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      )}

      {/* Add habit */}
      <button
        onClick={() => setShowAdd(!showAdd)}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 border border-dashed border-sage-light/50 text-xs text-sage-deep hover:bg-sage-light/10 transition-colors"
      >
        <Plus size={13} /> 添加习惯
      </button>

      {showAdd && (
        <div className="bg-card rounded-xl border border-sage-light/30 p-3 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="习惯名称..."
            className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                createHabit.mutate({
                  title: newTitle.trim(),
                  icon: HABIT_ICONS[Math.floor(Math.random() * HABIT_ICONS.length)],
                  color: HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)],
                  frequencyType: newFrequencyType,
                  frequencyValue: newFrequencyValue,
                });
                setNewTitle("");
                setNewFrequencyType("daily");
                setNewFrequencyValue(1);
                setShowAdd(false);
              }
            }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-ink-lighter shrink-0">频率</span>
            {([
              { type: "daily", label: "每天" },
              { type: "weekly", label: "每周" },
              { type: "monthly", label: "每月" },
            ] as const).map(({ type, label }) => (
              <button
                key={type}
                onClick={() => {
                  setNewFrequencyType(type);
                  if (type === "daily") setNewFrequencyValue(1);
                }}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full font-medium transition-colors",
                  newFrequencyType === type
                    ? "bg-sage-light text-sage-deep"
                    : "bg-ink/5 text-ink-lighter hover:bg-ink/10",
                )}
              >
                {label}
              </button>
            ))}
            {newFrequencyType !== "daily" && (
              <select
                value={newFrequencyValue}
                onChange={(e) => setNewFrequencyValue(Number(e.target.value))}
                className="text-[10px] bg-ink/5 rounded px-1.5 py-1 outline-none"
              >
                {Array.from({ length: newFrequencyType === "weekly" ? 7 : 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}次</option>
                ))}
              </select>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setShowAdd(false)}
              className="text-ink-lighter hover:text-ink p-1"
            >
              <X size={14} />
            </button>
            <button
              onClick={() => {
                if (!newTitle.trim()) return;
                createHabit.mutate({
                  title: newTitle.trim(),
                  icon: HABIT_ICONS[Math.floor(Math.random() * HABIT_ICONS.length)],
                  color: HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)],
                  frequencyType: newFrequencyType,
                  frequencyValue: newFrequencyValue,
                });
                setNewTitle("");
                setNewFrequencyType("daily");
                setNewFrequencyValue(1);
                setShowAdd(false);
              }}
              disabled={!newTitle.trim() || createHabit.isPending}
              className="bg-sage-light text-sage-deep rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {createHabit.isPending ? "..." : "添加"}
            </button>
          </div>
        </div>
      )}

      {/* Habit list */}
      {habits.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-2xl border border-border">
          <Heart size={28} className="text-ink-lighter mx-auto mb-2" />
          <p className="text-sm text-ink-light">尚未创建习惯</p>
          <p className="text-xs text-ink-lighter mt-1">追踪你的每日习惯，建立更好的生活节奏</p>
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((h) => {
            const recordStatus = h.today_record?.status;
            return (
              <div
                key={h.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-card border border-border/50"
              >
                <button
                  onClick={() =>
                    toggleRecord.mutate({ habitId: h.id, date: today, currentStatus: recordStatus })
                  }
                  disabled={toggleRecord.isPending}
                  className={cn(
                    "h-8 w-8 rounded-lg border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors",
                    statusColor(recordStatus),
                  )}
                >
                  {statusCycleLabel(recordStatus)}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{h.icon || "✅"}</span>
                    <p className="text-xs font-medium text-ink truncate">{h.title}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-ink-lighter">
                      {formatFrequency(h.frequency_type || "daily", h.frequency_value || 1)}
                    </span>
                    {h.streak_best > 0 && (
                      <span className="text-[10px] text-accent-warm">
                        最佳 {h.streak_best}天
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteHabit.mutate(h.id)}
                  className="text-ink-lighter hover:text-accent-rose shrink-0"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Month Calendar */}
      <HabitMonthCalendar
        calendar={calendar || []}
        year={calYear}
        month={calMonth}
        monthLabel={monthNames[calMonth - 1]}
        onPrev={() => {
          if (calMonth === 1) { setCalMonth(12); setCalYear(calYear - 1); }
          else setCalMonth(calMonth - 1);
        }}
        onNext={() => {
          if (calMonth === 12) { setCalMonth(1); setCalYear(calYear + 1); }
          else setCalMonth(calMonth + 1);
        }}
        habits={habits}
      />

      {/* Weekly Habit Bars */}
      {weeklyStats && weeklyStats.length > 0 && (
        <WeeklyHabitBars stats={weeklyStats} />
      )}

      {/* AI Analysis Card */}
      <HabitAnalysisCard
        analysis={analysis}
        onGenerate={() => generateAnalysis.mutate({ days: 30 })}
        isGenerating={generateAnalysis.isPending}
      />
    </div>
  );
}

// ── Habit Month Calendar ──

const DAY_HEADERS = ["日", "一", "二", "三", "四", "五", "六"];

function HabitMonthCalendar({
  calendar,
  year,
  month,
  monthLabel,
  onPrev,
  onNext,
  habits,
}: {
  calendar: DayCell[];
  year: number;
  month: number;
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  habits: HabitWithRecord[];
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="text-ink-lighter hover:text-ink p-1">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-ink">{year}年 {monthLabel}</span>
        <button onClick={onNext} className="text-ink-lighter hover:text-ink p-1">
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="text-center text-[10px] text-ink-lighter py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendar.map((cell) => {
          const intensity = cell.completionRate;
          const bgClass = !cell.isCurrentMonth
            ? "bg-transparent"
            : intensity >= 0.8 ? "bg-emerald-100"
            : intensity >= 0.5 ? "bg-emerald-50"
            : intensity > 0 ? "bg-amber-50"
            : "bg-ink/5";

          return (
            <div
              key={cell.date}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] relative",
                bgClass,
                cell.isToday && "ring-1 ring-sage-deep",
                !cell.isCurrentMonth && "opacity-30",
              )}
            >
              <span className={cn(
                "text-[10px] font-medium",
                cell.isToday ? "text-sage-deep" : "text-ink-light",
              )}>
                {cell.dayOfMonth}
              </span>
              {/* Mini dots for habits */}
              {cell.habits.filter((h) => h.status === "completed").length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {cell.habits
                    .filter((h) => h.status === "completed")
                    .slice(0, 3)
                    .map((h) => (
                      <div
                        key={h.id}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: h.color }}
                      />
                    ))}
                  {cell.habits.filter((h) => h.status === "completed").length > 3 && (
                    <span className="text-[7px] text-ink-lighter">+</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {habits.length > 0 && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/30 flex-wrap">
          {habits.slice(0, 4).map((h) => (
            <div key={h.id} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
              <span className="text-[9px] text-ink-lighter truncate max-w-[60px]">{h.title}</span>
            </div>
          ))}
          {habits.length > 4 && (
            <span className="text-[9px] text-ink-lighter">+{habits.length - 4} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Weekly Habit Bars ──

function WeeklyHabitBars({ stats }: { stats: WeeklyStat[] }) {
  if (stats.length === 0) return null;

  const latestWeek = stats[stats.length - 1];
  const sorted = [...latestWeek.habits].sort((a, b) => b.rate - a.rate);

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-sage-deep" />
        <span className="text-xs font-semibold text-ink">本周习惯完成率</span>
        <span className="text-[10px] text-ink-lighter ml-auto">
          整体 {Math.round(latestWeek.overallRate * 100)}%
        </span>
      </div>
      <div className="space-y-2">
        {sorted.map((h) => (
          <div key={h.id} className="flex items-center gap-2">
            <span className="text-[10px] text-ink-light w-14 truncate">{h.name}</span>
            <div className="flex-1 bg-ink/5 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(h.rate * 100)}%`,
                  backgroundColor: h.color,
                }}
              />
            </div>
            <span className="text-[10px] text-ink-lighter w-8 text-right">
              {Math.round(h.rate * 100)}%
            </span>
          </div>
        ))}
      </div>
      {/* Small week-over-week sparkline */}
      {stats.length > 1 && (
        <div className="flex items-center gap-0.5 mt-3 pt-2 border-t border-border/30">
          <span className="text-[9px] text-ink-lighter mr-1">趋势</span>
          {stats.map((w, i) => (
            <div
              key={w.weekStart}
              className="flex-1 flex flex-col items-center gap-0.5"
              title={`${w.weekStart} - ${w.weekEnd}: ${Math.round(w.overallRate * 100)}%`}
            >
              <div className="w-full bg-ink/5 rounded-sm overflow-hidden" style={{ height: 16 }}>
                <div
                  className="w-full bg-sage-light rounded-sm transition-all"
                  style={{ height: `${Math.max(Math.round(w.overallRate * 100), 4)}%`, marginTop: "auto" }}
                />
              </div>
              <span className="text-[8px] text-ink-lighter">
                {w.weekStart.slice(5)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Habit Analysis Card ──

function HabitAnalysisCard({
  analysis,
  onGenerate,
  isGenerating,
}: {
  analysis: HabitAnalysis | null | undefined;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (isGenerating) {
    return (
      <div className="bg-card rounded-2xl border border-sage-light/30 p-6 flex items-center justify-center gap-3">
        <Loader2 size={18} className="animate-spin text-sage-deep" />
        <span className="text-sm text-ink-light">正在生成 AI 习惯分析...</span>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-purple-600" />
          <span className="text-xs font-semibold text-ink">AI 习惯分析</span>
        </div>
        <p className="text-xs text-ink-lighter mb-3">
          基于最近30天的习惯数据，AI 将分析你的行为模式、发现优势和改进空间。
        </p>
        <button
          onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors"
        >
          <Sparkles size={13} /> 生成 AI 分析
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50/30 to-white border border-purple-100 rounded-2xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-purple-600" />
            <span className="text-xs font-semibold text-ink">AI 习惯分析</span>
            <span className="text-[9px] text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-full">
              最近30天
            </span>
          </div>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1 text-[10px] text-ink-lighter hover:text-ink-light transition-colors"
          >
            <RefreshCw size={10} /> 重新生成
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/60 rounded-xl p-2 text-center">
            <p className="text-sm font-bold text-emerald-500">
              {Math.round(analysis.stats.completion_rate * 100)}%
            </p>
            <p className="text-[9px] text-ink-lighter">完成率</p>
          </div>
          <div className="bg-white/60 rounded-xl p-2 text-center">
            <p className="text-sm font-bold text-accent-sky">{analysis.stats.total_completed}</p>
            <p className="text-[9px] text-ink-lighter">完成次数</p>
          </div>
          <div className="bg-white/60 rounded-xl p-2 text-center">
            <p className="text-sm font-bold text-accent-warm">{analysis.stats.best_day_of_week}</p>
            <p className="text-[9px] text-ink-lighter">最佳日</p>
          </div>
        </div>

        {/* Summary */}
        {analysis.summary && (
          <p className="text-xs text-ink-light leading-relaxed mb-3">{analysis.summary}</p>
        )}

        {/* Strengths */}
        {analysis.strengths.length > 0 && (
          <div className="mb-2">
            <p className="text-[10px] text-emerald-500 font-medium mb-1">优势发现</p>
            <div className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[10px] mt-0.5">💪</span>
                  <span className="text-[10px] text-ink-light">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions (collapsible) */}
        {analysis.suggestions.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[10px] text-purple-500 font-medium"
            >
              <Lightbulb size={10} />
              改进建议 ({analysis.suggestions.length})
              <ChevronRight size={10} className={cn("transition-transform", expanded && "rotate-90")} />
            </button>
            {expanded && (
              <div className="space-y-1 mt-1.5">
                {analysis.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-[10px] mt-0.5">💡</span>
                    <span className="text-[10px] text-ink-light">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Motivation */}
        {analysis.motivation && (
          <p className="text-xs text-purple-600 italic text-center pt-2 mt-2 border-t border-purple-100">
            {analysis.motivation}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Weekly Plan ──

const WEEK_CATEGORIES = [
  { key: "english", label: "英语", icon: "📚" },
  { key: "health", label: "健康", icon: "💪" },
  { key: "career", label: "职业", icon: "💼" },
  { key: "life", label: "生活", icon: "🌿" },
  { key: "general", label: "通用", icon: "🎯" },
] as const;

function WeeklyPlan() {
  const { data: themes, isLoading } = useWeeklyThemes();
  const { data: goalsProgress } = useGoalProgress();
  const createTheme = useCreateWeeklyTheme();
  const updateTheme = useUpdateWeeklyTheme();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "general", weekly_goal: "", daily_action: "", minimum_standard: "" });

  const week = (() => {
    const t = new Date();
    const dow = t.getDay();
    const mon = new Date(t);
    mon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: mon.toISOString().split("T")[0], end: sun.toISOString().split("T")[0] };
  })();

  const currentTheme = (themes || []).find((t) => t.start_date === week.start);
  const topGoals = (goalsProgress || []).filter((g) => g.status !== "done").slice(0, 3);

  const reset = () => { setForm({ title: "", category: "general", weekly_goal: "", daily_action: "", minimum_standard: "" }); setShowForm(false); };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-sage-deep" /></div>;

  return (
    <div className="space-y-4">
      {/* Week Range Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-ink flex items-center gap-1.5">
            <Calendar size={13} className="text-sage-deep" />
            {week.start} → {week.end}
          </p>
        </div>
      </div>

      {/* Current Theme or Create */}
      {!currentTheme ? (
        !showForm ? (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sage-light/50 py-5 text-sm text-sage-deep hover:bg-sage-light/10 transition-colors">
            <Plus size={16} />设定本周主题
          </button>
        ) : (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">新建周主题</p>
            <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="本周主题，如：攻克英语口语" autoFocus
              className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors" />
            <div className="flex gap-1.5 flex-wrap">
              {WEEK_CATEGORIES.map((c) => (
                <button key={c.key} onClick={() => setForm((f) => ({ ...f, category: c.key }))}
                  className={cn("text-xs rounded-full px-3 py-1.5 transition-colors",
                    form.category === c.key ? "bg-sage-light text-sage-deep font-medium" : "bg-ink/5 text-ink-light hover:bg-ink/10")}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <textarea value={form.weekly_goal} onChange={(e) => setForm((f) => ({ ...f, weekly_goal: e.target.value }))}
              placeholder="本周目标"
              className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2 h-16 resize-none focus:border-sage-deep/50 transition-colors" />
            <input type="text" value={form.daily_action} onChange={(e) => setForm((f) => ({ ...f, daily_action: e.target.value }))}
              placeholder="每日行动"
              className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors" />
            <input type="text" value={form.minimum_standard} onChange={(e) => setForm((f) => ({ ...f, minimum_standard: e.target.value }))}
              placeholder="最低标准（再忙也要做到什么）"
              className="w-full bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors" />
            <div className="flex gap-2">
              <button onClick={() => createTheme.mutate(form, { onSuccess: reset })}
                disabled={!form.title.trim() || createTheme.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                {createTheme.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}确定
              </button>
              <button onClick={reset} className="px-4 py-2.5 text-sm text-ink-light hover:bg-ink/5 rounded-xl transition-colors">取消</button>
            </div>
          </div>
        )
      ) : (
        <div className="bg-card rounded-2xl border border-sage-light/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sage-light flex items-center justify-center">
                <Target size={14} className="text-sage-deep" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{currentTheme.title}</p>
                <p className="text-[10px] text-ink-lighter">
                  {WEEK_CATEGORIES.find((c) => c.key === currentTheme.category)?.label || currentTheme.category}
                  {" · "}
                  <span className={cn(currentTheme.status === "active" ? "text-emerald-500" : "text-ink-lighter")}>
                    {currentTheme.status === "active" ? "进行中" : currentTheme.status}
                  </span>
                </p>
              </div>
            </div>
            <select
              value={currentTheme.status}
              onChange={(e) => updateTheme.mutate({ id: currentTheme.id, status: e.target.value })}
              className="text-[10px] bg-ink/5 rounded-lg px-2 py-1 outline-none cursor-pointer border-0"
            >
              <option value="active">进行中</option>
              <option value="completed">已完成</option>
              <option value="paused">暂停</option>
            </select>
          </div>

          {currentTheme.weekly_goal && (
            <div className="bg-white/60 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter mb-0.5">本周目标</p>
              <p className="text-xs text-ink">{currentTheme.weekly_goal}</p>
            </div>
          )}
          {currentTheme.daily_action && (
            <div className="bg-white/60 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter mb-0.5">每日行动</p>
              <p className="text-xs text-ink">{currentTheme.daily_action}</p>
            </div>
          )}
          {currentTheme.minimum_standard && (
            <div className="bg-white/60 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter mb-0.5">最低标准</p>
              <p className="text-xs text-ink">{currentTheme.minimum_standard}</p>
            </div>
          )}
        </div>
      )}

      {/* Top 3 Goals Progress */}
      {topGoals.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider mb-3">本周重点目标</p>
          <div className="space-y-3">
            {topGoals.map((g: GoalWithProgress) => (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{g.title}</p>
                  <span className="text-[10px] text-ink-lighter">
                    {g.completedTasks}/{g.totalTasks} 任务
                  </span>
                </div>
                <div className="bg-ink/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-sage-deep h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(g.progress * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-ink-lighter text-right">
                  {Math.round(g.progress * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Weeks */}
      {(themes || []).filter((t) => t.start_date !== week.start).length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider mb-2">过往周计划</p>
          <div className="space-y-1.5">
            {(themes || []).filter((t) => t.start_date !== week.start).slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-card border border-border/50">
                <span className="text-xs w-5 text-center shrink-0">
                  {WEEK_CATEGORIES.find((c) => c.key === t.category)?.icon || "📌"}
                </span>
                <span className="text-xs text-ink truncate flex-1">{t.title}</span>
                <span className="text-[10px] text-ink-lighter shrink-0">{t.start_date}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                  t.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                  t.status === "active" ? "bg-accent-sky/10 text-accent-sky" : "bg-ink/5 text-ink-lighter")}>
                  {t.status === "completed" ? "完成" : t.status === "active" ? "进行中" : "暂停"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
