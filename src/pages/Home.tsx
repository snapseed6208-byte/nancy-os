import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { getGreeting, getDateLabel, today } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Mic,
  Lightbulb,
  CheckSquare,
  Utensils,
  MessageCircle,
  Sparkles,
  ChevronRight,
  Clock,
  Calendar,
  Heart,
  Dumbbell,
  BookOpen,
  GraduationCap,
  Trophy,
  Loader2,
  Brain,
  Target,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Check, X,
  CheckCircle2,
  Circle,
  CircleDot,
  FileText,
  Languages,
  ListTodo,
  ArrowRight,
  Sun,
  Moon,
  Sunrise,
  Send,
  Zap,
  Star,
  Settings,
  Droplets,
  Plus,
  Trash2,
} from "lucide-react";
import { useTodayBrief, useGenerateDailyBrief, useBriefFeedback } from "@/lib/hooks/useReflection";
import { useDashboardStats, type TimelineItem } from "@/lib/hooks/useDashboard";
import { useUpcomingTasks, useToggleTaskComplete } from "@/lib/hooks/usePlan";
import { useHabitsWithToday, useToggleHabitCompletion, useHabitWeeklyStats, useHabitAnalysis, formatFrequency, type HabitWithRecord } from "@/lib/hooks/useHabit";
import { useCreateIdea } from "@/lib/hooks/useLifeTrace";
import {
  useWaterToday, useAddWater, useDeleteWater,
  useDailyChecklist, useInitChecklist, useToggleChecklistItem,
  useGenerateChecklistTips, useInsertChecklistAiItems,
  useFoodRecords, useWorkoutRecords,
  type DailyHealthChecklist,
} from "@/lib/hooks/useHealth";
import type { DailyBrief, DailyBriefSuggestion, DailyBriefWarning } from "@/lib/types";

const QUICK_ACTIONS = [
  { key: "voice-journal", label: "语音记录", icon: Mic, color: "bg-accent-rose/10 text-accent-rose", path: "/life-trace/capture" },
  { key: "idea", label: "灵感记录", icon: Lightbulb, color: "bg-accent-warm/10 text-accent-warm", path: "/life-trace/capture?type=灵感" },
  { key: "english", label: "英语练习", icon: MessageCircle, color: "bg-accent-sky/10 text-accent-sky", path: "/english/speaking" },
  { key: "review", label: "英语复习", icon: Languages, color: "bg-accent-sky/10 text-accent-sky", path: "/english/review" },
  { key: "task", label: "任务创建", icon: CheckSquare, color: "bg-ink/5 text-ink-light", path: "/plan" },
] as const;

const WARNING_ICONS: Record<string, string> = {
  mood: "😰", habit: "⏰", task: "📋", health: "💪", review: "📝", general: "💡",
};

const TIMELINE_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  task: ListTodo,
  habit: Trophy,
  journal: FileText,
  speaking: Languages,
  review: CheckCircle2,
};

const TIMELINE_TYPE_COLORS: Record<string, string> = {
  task: "bg-accent-sky/10 text-accent-sky",
  habit: "bg-accent-warm/10 text-accent-warm",
  journal: "bg-accent-rose/10 text-accent-rose",
  speaking: "bg-accent-sky/10 text-accent-sky",
  review: "bg-sage-light text-sage-deep",
};

const PRIORITY_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };

export default function Home() {
  const [, navigate] = useLocation();
  const greeting = getGreeting();
  const dateStr = today();
  const dateLabel = getDateLabel(dateStr);
  const isEvening = new Date().getHours() >= 18;

  const { data: brief, isLoading: loadingBrief } = useTodayBrief();
  const generateBrief = useGenerateDailyBrief();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: upcomingTasks } = useUpcomingTasks(7);
  const { data: habitsWithToday } = useHabitsWithToday();
  const toggleHabitCompletion = useToggleHabitCompletion();
  const toggleTaskComplete = useToggleTaskComplete();
  const briefFeedback = useBriefFeedback();
  const createIdea = useCreateIdea();
  const { data: habitWeeklyStats } = useHabitWeeklyStats(2);
  const { data: habitAnalysis } = useHabitAnalysis();
  const { data: waterToday } = useWaterToday(dateStr);
  const addWater = useAddWater();
  const deleteWater = useDeleteWater();
  const { data: checklist } = useDailyChecklist(dateStr);
  const initChecklist = useInitChecklist();
  const toggleChecklistItem = useToggleChecklistItem();
  const generateTips = useGenerateChecklistTips();
  const insertAiItems = useInsertChecklistAiItems();
  const { data: foodToday } = useFoodRecords(dateStr);
  const { data: workoutToday } = useWorkoutRecords(dateStr);

  // ── Auto-init checklist on first load ──
  const checklistInited = useRef(false);
  useEffect(() => {
    if (!checklist && !checklistInited.current) {
      checklistInited.current = true;
      initChecklist.mutate(dateStr, {
        onSuccess: (data) => {
          // After creating checklist, generate AI tips
          const checklistId = data.id as string;
          generateTips.mutate(
            { date: dateStr, checklistId },
            {
              onSuccess: (tips) => {
                insertAiItems.mutate({ date: dateStr, checklistId, tips: tips.tips });
              },
            },
          );
        },
      });
    }
  }, [checklist, dateStr]);

  const briefData = brief as DailyBrief | null;
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [quickCaptureText, setQuickCaptureText] = useState("");
  const [captureSaved, setCaptureSaved] = useState(false);

  // ── Auto-generate daily brief on first load ──
  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (!brief && !loadingBrief && !generateBrief.isPending && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      generateBrief.mutate();
    }
  }, [brief, loadingBrief]);

  const handleBriefFeedback = (rating: "helpful" | "not_helpful") => {
    if (!briefData?.id || feedbackSent) return;
    briefFeedback.mutate({ briefId: briefData.id, rating });
    setFeedbackSent(true);
  };

  const handleQuickCapture = () => {
    const text = quickCaptureText.trim();
    if (!text || createIdea.isPending) return;
    createIdea.mutate(
      { content: text, category: "quick_capture", status: "new" },
      {
        onSuccess: () => {
          setQuickCaptureText("");
          setCaptureSaved(true);
          setTimeout(() => setCaptureSaved(false), 2000);
        },
      },
    );
  };

  const handleTaskToggle = (taskId: string, taskStatus: string) => {
    toggleTaskComplete.mutate({ id: taskId, currentStatus: taskStatus });
  };

  const hasTimeline =
    (stats?.timeline.completed.length ?? 0) > 0 ||
    (stats?.timeline.inProgress.length ?? 0) > 0 ||
    (stats?.timeline.pending.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-lighter">{dateLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            {greeting}，Nancy
          </h1>
          <p className="text-sm text-ink-lighter mt-1">
            今天也请按自己的节奏来
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/settings")}
            className="h-11 w-11 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-card-hover transition-colors"
            title="设置"
          >
            <Settings size={18} className="text-ink-light" />
          </button>
          <div className="h-11 w-11 rounded-xl bg-sage-light flex items-center justify-center">
            <Sparkles size={20} className="text-sage-deep" />
          </div>
        </div>
      </header>

      {/* Quick Capture Bar */}
      <div className="flex items-center gap-2 bg-white border border-sage-light/30 rounded-2xl px-4 py-2 shadow-sm">
        <Zap size={16} className="text-sage-deep shrink-0" />
        <input
          type="text"
          value={quickCaptureText}
          onChange={(e) => setQuickCaptureText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleQuickCapture(); }}
          placeholder="快速记录想法、任务或灵感..."
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none"
        />
        {captureSaved ? (
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        ) : (
          <button
            onClick={handleQuickCapture}
            disabled={!quickCaptureText.trim() || createIdea.isPending}
            className="shrink-0 text-sage-deep disabled:text-ink-lighter hover:text-sage-deep/70 transition-colors"
          >
            {createIdea.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        )}
      </div>

      {/* ── AI Daily Brief ── */}
      <section>
        {loadingBrief || generateBrief.isPending ? (
          <div className="bg-card rounded-2xl border border-sage-light/30 p-6 flex items-center justify-center gap-3">
            <Loader2 size={18} className="animate-spin text-sage-deep" />
            <span className="text-sm text-ink-light">
              {generateBrief.isPending ? "正在生成今日简报..." : "加载中..."}
            </span>
          </div>
        ) : briefData ? (
          <DailyBriefCard
            key={briefData.id}
            brief={briefData}
            onRegenerate={() => { generateBrief.mutate(); setFeedbackSent(false); }}
            isRegenerating={generateBrief.isPending}
            onFeedback={handleBriefFeedback}
            feedbackSent={feedbackSent}
            feedbackPending={briefFeedback.isPending}
          />
        ) : null}
      </section>

      {/* Status Cards Grid */}
      <section className="grid grid-cols-3 gap-3">
        <StatusCard
          icon={CheckSquare}
          label="今日任务"
          value={loadingStats ? "..." : `${stats?.tasks.completed ?? 0}/${stats?.tasks.total ?? 0}`}
          sub={stats?.tasks.total ? `待完成 ${stats.tasks.pending.length} 项` : "暂无任务"}
          color="text-accent-sky"
          bg="bg-accent-sky/5"
          path="/plan?tab=tasks"
        />
        <StatusCard
          icon={Trophy}
          label="习惯完成"
          value={loadingStats ? "..." : `${stats?.habits.completed ?? 0}/${stats?.habits.total ?? 0}`}
          sub={stats?.habits.streak ? `连续 ${stats.habits.streak} 天` : "今日暂无记录"}
          color="text-accent-warm"
          bg="bg-accent-warm/5"
          path="/plan?tab=habits"
        />
        <StatusCard
          icon={Clock}
          label="待复习"
          value={loadingStats ? "..." : `${stats?.reviews.due ?? 0}`}
          sub="英语表达"
          color="text-sage-deep"
          bg="bg-sage-light"
          path="/english/review"
        />
      </section>

      {/* Quick Record — bound to routes */}
      <section>
        <h2 className="text-[13px] font-semibold text-ink mb-3">快速记录</h2>
        <div className="grid grid-cols-5 gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl hover:bg-card-hover transition-colors active:scale-95"
              >
                <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", action.color)}>
                  <Icon size={20} />
                </div>
                <span className="text-[11px] text-ink-light leading-tight text-center">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Water Tracker ── */}
      <WaterTracker
        waterToday={waterToday}
        onAdd={(amount) => addWater.mutate({ date: dateStr, amount_ml: amount })}
        onDelete={(id) => deleteWater.mutate({ id, date: dateStr })}
        isAdding={addWater.isPending}
      />

      {/* ── Daily Health Checklist ── */}
      <DailyHealthChecklist
        checklist={checklist}
        waterToday={waterToday}
        foodToday={foodToday}
        workoutToday={workoutToday}
        onToggleItem={(itemId, completed) =>
          toggleChecklistItem.mutate({ itemId, isCompleted: completed, date: dateStr })
        }
        onRegenerate={() => {
          if (!checklist) return;
          generateTips.mutate(
            { date: dateStr, checklistId: checklist.id },
            {
              onSuccess: (tips) => {
                insertAiItems.mutate({ date: dateStr, checklistId: checklist.id, tips: tips.tips });
              },
            },
          );
        }}
        isRegenerating={generateTips.isPending || insertAiItems.isPending}
        isInitializing={initChecklist.isPending}
      />

      {/* ── Today's Habits ── */}
      {habitsWithToday && (habitsWithToday as HabitWithRecord[]).length > 0 && (
        <TodayHabits
          habits={habitsWithToday as HabitWithRecord[]}
          onToggle={(habitId) => toggleHabitCompletion.mutate(habitId, {
            onError: (err) => {
              console.error("Habit toggle failed:", err);
            },
          })}
          isToggling={toggleHabitCompletion.isPending}
          weeklyStats={habitWeeklyStats || []}
          analysis={habitAnalysis}
        />
      )}

      {/* ── Today's Schedule (tasks by priority) ── */}
      {stats && (stats.timeline.inProgress.length > 0 || stats.timeline.pending.length > 0) && (
        <TodaySchedule
          stats={stats}
          onToggleTask={handleTaskToggle}
          isToggling={toggleTaskComplete.isPending}
        />
      )}

      {/* ── Today Timeline ── */}
      {hasTimeline && stats && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-ink-light" />
            <h2 className="text-[13px] font-semibold text-ink">今日时间线</h2>
          </div>
          <div className="space-y-3">
            {stats.timeline.inProgress.length > 0 && (
              <TimelineGroup
                label="进行中"
                items={stats.timeline.inProgress}
                icon={<CircleDot size={12} className="text-accent-sky" />}
              />
            )}
            {stats.timeline.completed.length > 0 && (
              <TimelineGroup
                label="已完成"
                items={stats.timeline.completed.slice(0, 8)}
                icon={<CheckCircle2 size={12} className="text-emerald-500" />}
              />
            )}
            {stats.timeline.pending.length > 0 && (
              <TimelineGroup
                label="待完成"
                items={stats.timeline.pending}
                icon={<Circle size={12} className="text-ink-lighter" />}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Evening Reflection (after 18:00) ── */}
      {isEvening && (
        <section
          onClick={() => navigate("/review")}
          className="bg-gradient-to-br from-sage-light/10 to-indigo-50/30 border border-sage-light/30 rounded-2xl p-4 cursor-pointer hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-sage-deep" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">晚间复盘</p>
              <p className="text-xs text-ink-light mt-0.5">
                今天完成了什么？AI 帮你生成成长洞察并进入长期记忆。
              </p>
            </div>
            <ChevronRight size={16} className="text-ink-lighter shrink-0" />
          </div>
        </section>
      )}

      {/* ── Upcoming (next 7 days) ── */}
      {upcomingTasks && (upcomingTasks as Array<Record<string, unknown>>).length > 0 && (
        <section className="bg-gradient-to-br from-accent-sky/[0.03] to-white border border-accent-sky/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={13} className="text-accent-sky" />
            <h2 className="text-xs font-semibold text-ink">即将到来</h2>
            <span className="text-[10px] text-ink-lighter">
              (未来7天 {">"} {(upcomingTasks as Array<Record<string, unknown>>).length} 项)
            </span>
          </div>
          <div className="space-y-1">
            {(upcomingTasks as Array<Record<string, unknown>>).slice(0, 6).map((t) => {
              const dueDate = t.due_date as string;
              if (!dueDate) return null;
              const daysUntil = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
              const isToday = daysUntil === 0;
              const isTomorrow = daysUntil === 1;
              const label = isToday ? "今天" : isTomorrow ? "明天" : `${daysUntil}天后`;

              return (
                <button
                  key={t.id as string}
                  onClick={() => navigate("/plan")}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/60 transition-colors text-left"
                >
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 min-w-[42px] text-center",
                    isToday ? "bg-accent-rose/10 text-accent-rose" :
                    isTomorrow ? "bg-accent-warm/10 text-accent-warm" : "bg-ink/5 text-ink-lighter",
                  )}>
                    {label}
                  </span>
                  <span className="text-xs text-ink truncate flex-1">{t.title as string}</span>
                  <span className={cn(
                    "text-[10px] px-1 py-0.5 rounded font-medium shrink-0",
                    (t.priority as string) === "high" ? "bg-accent-rose/10 text-accent-rose" :
                    (t.priority as string) === "medium" ? "bg-amber-50 text-amber-600" : "bg-ink/5 text-ink-lighter",
                  )}>
                    {PRIORITY_LABELS[t.priority as string] || t.priority as string}
                  </span>
                  <ArrowRight size={10} className="text-ink-lighter shrink-0" />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Module Overview Cards */}
      <section>
        <h2 className="text-[13px] font-semibold text-ink mb-3">模块概览</h2>
        <div className="grid grid-cols-2 gap-3">
          <ModuleCard
            icon={BookOpen}
            label="English OS"
            stat={loadingStats
              ? "..."
              : `${stats?.reviews.due ?? 0} 待复习`}
            statDetail={`${stats?.reviews.totalExpressions ?? 0}+ 表达库`}
            color="bg-accent-sky/10"
            iconColor="text-accent-sky"
            path="/english"
          />
          <ModuleCard
            icon={Dumbbell}
            label="健康管理"
            stat={loadingStats
              ? "..."
              : stats?.habits.completed
                ? `今日已完成 ${stats.habits.completed} 项`
                : "今日未运动"}
            statDetail={stats?.habits.streak ? `${stats.habits.streak} 天连续` : "0 天连续"}
            color="bg-sage-light"
            iconColor="text-sage-deep"
            path="/health"
          />
          <ModuleCard
            icon={GraduationCap}
            label="考试学习"
            stat="IELTS"
            statDetail="暂无倒计时"
            color="bg-accent-warm/10"
            iconColor="text-accent-warm"
            path="/exam"
          />
          <ModuleCard
            icon={Heart}
            label="Life Trace"
            stat={loadingStats
              ? "..."
              : stats?.lifeTrace.journalToday
                ? `${stats.lifeTrace.journalToday} 条日记`
                : "今日未记录"}
            statDetail={stats?.lifeTrace.journalThisMonth
              ? `本月 ${stats.lifeTrace.journalThisMonth} 条`
              : "0 条日记"}
            color="bg-accent-rose/10"
            iconColor="text-accent-rose"
            path="/life-trace"
          />
        </div>
      </section>

      {/* Bottom spacing for mobile */}
      <div className="h-2" />
    </div>
  );
}

// ── Today Timeline ──

function TimelineGroup({
  label,
  items,
  icon,
}: {
  label: string;
  items: TimelineItem[];
  icon: React.ReactNode;
}) {
  const [, navigate] = useLocation();

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[11px] font-medium text-ink-light">{label}</span>
        <span className="text-[10px] text-ink-lighter">({items.length})</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const TypeIcon = TIMELINE_TYPE_ICONS[item.type] || Circle;
          const typeColor = TIMELINE_TYPE_COLORS[item.type] || "bg-ink/5 text-ink-light";
          return (
            <button
              key={item.id}
              onClick={() => item.path && navigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2 bg-card border border-border/50",
                "hover:border-sage-light/30 transition-colors text-left",
                !item.path && "cursor-default",
              )}
            >
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", typeColor)}>
                <TypeIcon size={12} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-[10px] text-ink-lighter truncate">{item.subtitle}</p>
                )}
              </div>
              {item.time && (
                <span className="text-[10px] text-ink-lighter shrink-0">{item.time}</span>
              )}
              {item.path && (
                <ArrowRight size={10} className="text-ink-lighter shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── AI Daily Brief Card ──

function DailyBriefCard({
  brief,
  onRegenerate,
  isRegenerating,
  onFeedback,
  feedbackSent,
  feedbackPending,
}: {
  brief: DailyBrief;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onFeedback: (rating: "helpful" | "not_helpful") => void;
  feedbackSent: boolean;
  feedbackPending: boolean;
}) {
  const suggestions = (brief.suggestions || []) as DailyBriefSuggestion[];
  const warnings = (brief.warnings || []) as DailyBriefWarning[];

  return (
    <div className="bg-gradient-to-br from-sage-light/10 to-white border border-sage-light/30 rounded-2xl overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-sage-deep" />
            <h2 className="text-sm font-semibold text-ink">今日 AI 简报</h2>
          </div>
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1 text-[10px] text-ink-lighter hover:text-ink-light transition-colors disabled:opacity-50"
          >
            {isRegenerating ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <RefreshCw size={10} />
            )}
            重新生成
          </button>
        </div>

        {brief.summary && (
          <div className="mb-3">
            <p className="text-[10px] text-ink-lighter mb-1">昨日回顾</p>
            <p className="text-xs text-ink-light leading-relaxed">{brief.summary}</p>
          </div>
        )}

        {brief.focus && (
          <div className="flex items-start gap-2 mb-3 bg-white/60 rounded-xl p-3 border border-sage-light/20">
            <Target size={14} className="text-sage-deep shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-ink-lighter mb-0.5">今日重点</p>
              <p className="text-sm font-medium text-ink">{brief.focus}</p>
            </div>
          </div>
        )}

        {brief.motivation && (
          <p className="text-xs text-sage-deep italic text-center py-1 border-t border-sage-light/20">
            {brief.motivation}
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="border-t border-sage-light/20 px-4 py-3 bg-white/40">
          <p className="text-[10px] text-ink-lighter mb-2">个性化建议</p>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <a
                key={i}
                href={s.action_path || "#"}
                onClick={(e) => {
                  if (!s.action_path) return;
                  e.preventDefault();
                  window.history.pushState({}, "", s.action_path);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white border border-border hover:border-sage-light/30 transition-colors group"
              >
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                  s.priority === "high" ? "bg-accent-rose/10 text-accent-rose" :
                  s.priority === "medium" ? "bg-amber-50 text-amber-600" : "bg-ink/5 text-ink-light",
                )}>
                  {s.priority === "high" ? "优先" : s.priority === "medium" ? "建议" : "可选"}
                </span>
                <span className="text-xs text-ink flex-1">{s.suggestion}</span>
                {s.action_label && (
                  <span className="text-[10px] text-sage-deep font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {s.action_label}
                    <ChevronRight size={10} />
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="border-t border-accent-rose/10 px-4 py-3 bg-accent-rose/[0.02]">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm shrink-0">{WARNING_ICONS[w.type] || "⚠️"}</span>
              <p className="text-xs text-ink-light leading-relaxed">{w.message}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border/50 px-4 py-2 flex items-center gap-3">
        <p className="text-[10px] text-ink-lighter">这份简报对你有帮助吗？</p>
        <div className="flex gap-1">
          <button
            onClick={() => onFeedback("helpful")}
            disabled={feedbackSent || feedbackPending}
            className={cn(
              "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors",
              feedbackSent
                ? "text-ink-lighter cursor-default"
                : "text-ink-light hover:bg-emerald-50 hover:text-emerald-600",
            )}
          >
            <ThumbsUp size={10} />
            有帮助
          </button>
          <button
            onClick={() => onFeedback("not_helpful")}
            disabled={feedbackSent || feedbackPending}
            className={cn(
              "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors",
              feedbackSent
                ? "text-ink-lighter cursor-default"
                : "text-ink-light hover:bg-accent-rose/10 hover:text-accent-rose",
            )}
          >
            <ThumbsDown size={10} />
            不太准
          </button>
        </div>
        {feedbackSent && (
          <span className="text-[10px] text-emerald-500">感谢反馈</span>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function DailyHealthChecklist({
  checklist,
  waterToday,
  foodToday,
  workoutToday,
  onToggleItem,
  onRegenerate,
  isRegenerating,
  isInitializing,
}: {
  checklist?: DailyHealthChecklist | null;
  waterToday?: { total_ml: number; goal_ml: number } | null;
  foodToday?: Array<unknown> | null;
  workoutToday?: Array<unknown> | null;
  onToggleItem: (itemId: string, completed: boolean) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  isInitializing: boolean;
}) {
  // ── Auto-detect baseline items ──
  const autoCompleteRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!checklist?.items) return;

    for (const item of checklist.items) {
      if (item.is_completed) continue;
      if (autoCompleteRef.current.has(item.id)) continue;

      let shouldComplete = false;
      if (item.category === "water" && (waterToday?.total_ml ?? 0) >= 2000) {
        shouldComplete = true;
      }
      if (item.category === "diet" && (foodToday?.length ?? 0) >= 1) {
        shouldComplete = true;
      }
      if (item.category === "workout" && (workoutToday?.length ?? 0) > 0) {
        shouldComplete = true;
      }

      if (shouldComplete) {
        autoCompleteRef.current.add(item.id);
        onToggleItem(item.id, true);
      }
    }
  }, [checklist?.items, waterToday?.total_ml, foodToday?.length, workoutToday?.length]);

  if (isInitializing) {
    return (
      <section className="bg-gradient-to-br from-emerald-50/30 to-white border border-emerald-100 rounded-2xl p-4">
        <div className="flex items-center justify-center gap-2 py-3">
          <Loader2 size={16} className="animate-spin text-emerald-500" />
          <span className="text-xs text-ink-light">正在生成今日健康清单...</span>
        </div>
      </section>
    );
  }

  if (!checklist) return null;

  const baselineItems = checklist.items.filter((it) => it.item_type === "baseline");
  const aiItems = checklist.items.filter((it) => it.item_type === "ai");
  const completedCount = checklist.items.filter((it) => it.is_completed).length;
  const totalCount = checklist.items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const categoryIcons: Record<string, string> = {
    water: "💧",
    workout: "🏋️",
    diet: "🥗",
    sleep: "😴",
    recovery: "🧘",
    habit: "✅",
  };

  return (
    <section className="bg-gradient-to-br from-emerald-50/30 to-white border border-emerald-100 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-emerald-500" />
          <h2 className="text-[13px] font-semibold text-ink">今日健康清单</h2>
        </div>
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-1 text-[10px] text-ink-lighter hover:text-ink-light transition-colors disabled:opacity-50"
        >
          {isRegenerating ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <RefreshCw size={10} />
          )}
          重新生成
        </button>
      </div>

      {/* Baseline items */}
      <div className="space-y-1.5 mb-3">
        {baselineItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.category === "sleep") {
                onToggleItem(item.id, !item.is_completed);
              }
            }}
            disabled={item.category !== "sleep"}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all border",
              item.is_completed
                ? "bg-emerald-50/50 border-emerald-200"
                : "bg-white/60 border-border hover:border-emerald-200",
              item.category !== "sleep" && "cursor-default",
            )}
          >
            {/* Checkbox */}
            <div className={cn(
              "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
              item.is_completed
                ? "bg-emerald-500 border-emerald-500 text-white"
                : "border-ink/20 bg-white text-transparent",
            )}>
              {item.is_completed && <Check size={11} strokeWidth={3} />}
            </div>

            <span className="text-lg shrink-0">{categoryIcons[item.category] || "📋"}</span>
            <span className={cn(
              "text-xs font-medium flex-1 text-left",
              item.is_completed ? "text-emerald-700" : "text-ink",
            )}>
              {item.title}
            </span>

            {/* Status badge */}
            {item.is_completed ? (
              <span className="text-[10px] text-emerald-500 font-medium shrink-0">已完成</span>
            ) : item.category === "sleep" ? (
              <span className="text-[10px] text-ink-lighter shrink-0">手动</span>
            ) : (
              <span className="text-[10px] text-ink-lighter shrink-0">自动</span>
            )}
          </button>
        ))}
      </div>

      {/* AI Tips */}
      {aiItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="h-px flex-1 bg-emerald-100" />
            <span className="text-[10px] text-emerald-400 font-medium">AI 今日关注</span>
            <div className="h-px flex-1 bg-emerald-100" />
          </div>
          {aiItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-emerald-50/30"
            >
              <span className="text-sm shrink-0 mt-0.5">
                {categoryIcons[item.category] || "💡"}
              </span>
              <p className="text-[11px] text-ink-light leading-relaxed">{item.title}</p>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-3 pt-3 border-t border-emerald-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-ink-lighter">
            进度 {completedCount}/{totalCount}
          </span>
          <span className={cn(
            "text-[10px] font-medium",
            pct === 100 ? "text-emerald-500" : "text-ink-lighter",
          )}>
            {pct}%
          </span>
        </div>
        <div className="bg-emerald-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function WaterTracker({
  waterToday,
  onAdd,
  onDelete,
  isAdding,
}: {
  waterToday?: { total_ml: number; goal_ml: number; records: Array<{ id: string; amount_ml: number; recorded_at: string }> } | null;
  onAdd: (amount: number) => void;
  onDelete: (id: string) => void;
  isAdding: boolean;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const total = waterToday?.total_ml ?? 0;
  const goal = waterToday?.goal_ml ?? 2000;
  const pct = Math.min(Math.round((total / goal) * 100), 100);
  const records = waterToday?.records ?? [];
  const now = new Date();
  const hour = now.getHours();

  // Time-based status tip
  let tip: string;
  if (total >= goal) {
    tip = "太棒了！今日饮水目标已达成 🎉";
  } else if (hour < 12 && total < 500) {
    tip = "上午补水很重要，记得开始喝水";
  } else if (hour >= 12 && hour < 15 && total < 1000) {
    tip = "下午3点前饮水不足，现在喝一杯吧";
  } else if (hour >= 15 && hour < 18 && total < 1500) {
    tip = "下午过半，再加把劲补水";
  } else if (hour >= 18 && total < goal) {
    tip = "睡前适量补水，别一次喝太多";
  } else {
    tip = "继续保持，离目标越来越近了";
  }

  const handleCustomAdd = () => {
    const amount = parseInt(customAmount, 10);
    if (!amount || amount < 50 || amount > 5000) return;
    onAdd(amount);
    setCustomAmount("");
    setCustomOpen(false);
  };

  const bgBar = total >= goal ? "bg-emerald-400" : "bg-accent-sky";

  return (
    <section className="bg-gradient-to-br from-accent-sky/[0.04] to-white border border-accent-sky/10 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets size={16} className="text-accent-sky" />
          <h2 className="text-[13px] font-semibold text-ink">今日饮水</h2>
        </div>
        <span className={cn(
          "text-[11px] font-medium",
          total >= goal ? "text-emerald-500" : "text-ink-light",
        )}>
          {total} / {goal} ml
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-ink/5 rounded-full h-2 mb-2 overflow-hidden">
        <div
          className={cn(bgBar, "h-full rounded-full transition-all duration-500")}
          style={{ width: `${Math.max(pct, total > 0 ? 4 : 0)}%` }}
        />
      </div>

      {/* Status tip */}
      <p className={cn(
        "text-[11px] mb-3",
        total >= goal ? "text-emerald-600" : "text-ink-light",
      )}>
        {tip}
      </p>

      {/* Quick add buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onAdd(250)}
          disabled={isAdding}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-accent-sky/10 text-accent-sky text-xs font-medium hover:bg-accent-sky/20 transition-colors active:scale-95 disabled:opacity-50"
        >
          <Plus size={14} />
          +250ml
        </button>
        <button
          onClick={() => onAdd(500)}
          disabled={isAdding}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-accent-sky/10 text-accent-sky text-xs font-medium hover:bg-accent-sky/20 transition-colors active:scale-95 disabled:opacity-50"
        >
          <Plus size={14} />
          +500ml
        </button>
        {customOpen ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCustomAdd(); }}
              placeholder="ml"
              min={50}
              max={5000}
              className="w-20 px-3 py-2 rounded-xl border border-accent-sky/30 bg-white text-xs text-ink outline-none focus:border-accent-sky"
              autoFocus
            />
            <button
              onClick={handleCustomAdd}
              disabled={!customAmount || isAdding}
              className="px-3 py-2 rounded-xl bg-accent-sky text-white text-xs font-medium hover:bg-accent-sky/90 transition-colors active:scale-95 disabled:opacity-50"
            >
              确认
            </button>
            <button
              onClick={() => { setCustomOpen(false); setCustomAmount(""); }}
              className="px-2 py-2 rounded-xl text-ink-lighter text-xs hover:text-ink-light transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCustomOpen(true)}
            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-dashed border-accent-sky/30 text-accent-sky text-xs font-medium hover:bg-accent-sky/5 transition-colors active:scale-95"
          >
            <Plus size={14} />
            自定义
          </button>
        )}
      </div>

      {/* Today's records */}
      {records.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex flex-wrap gap-2">
            {records.slice(0, 8).map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ink/5 text-[11px] text-ink-light group"
              >
                <span className="font-medium text-ink">{r.amount_ml}ml</span>
                <span className="text-ink-lighter">
                  {new Date(r.recorded_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => onDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-lighter hover:text-accent-rose ml-0.5"
                  title="删除"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
            {records.length > 8 && (
              <span className="text-[10px] text-ink-lighter self-center">
                +{records.length - 8} 条
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
  path,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
  path: string;
}) {
  return (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
      className={cn(
        "rounded-2xl p-3.5 flex flex-col gap-1.5 group",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
        "cursor-pointer",
        bg,
      )}
    >
      <div className="flex items-center justify-between">
        <Icon size={16} className={color} />
        <span className="text-[9px] text-ink-lighter opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          查看 <ChevronRight size={9} />
        </span>
      </div>
      <div>
        <p className="text-lg font-bold text-ink">{value}</p>
        <p className="text-[11px] font-medium text-ink-light">{label}</p>
        <p className="text-[10px] text-ink-lighter mt-0.5">{sub}</p>
      </div>
    </a>
  );
}

function ModuleCard({
  icon: Icon,
  label,
  stat,
  statDetail,
  color,
  iconColor,
  path,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  stat: string;
  statDetail: string;
  color: string;
  iconColor: string;
  path: string;
}) {
  return (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
      className={cn(
        "rounded-2xl p-4 flex items-start gap-3 border border-border bg-card",
        "hover:shadow-sm hover:border-sage-light/30 transition-all cursor-pointer",
      )}
    >
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <p className="text-xs text-ink-light mt-0.5">{stat}</p>
        <p className="text-[10px] text-ink-lighter">{statDetail}</p>
      </div>
    </a>
  );
}

// ── Today's Habits ──

function TodayHabits({
  habits,
  onToggle,
  isToggling,
  weeklyStats,
  analysis,
}: {
  habits: HabitWithRecord[];
  onToggle: (habitId: string) => void;
  isToggling: boolean;
  weeklyStats?: { weekStart: string; overallRate: number }[];
  analysis?: { summary?: string; motivation?: string } | null;
}) {
  const [, navigate] = useLocation();
  const completed = habits.filter((h) => h.today_record?.status === "completed").length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Sparkline from weekly stats
  const sparkline = weeklyStats && weeklyStats.length > 0
    ? weeklyStats.map((w) => Math.round(w.overallRate * 100))
    : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-accent-warm" />
          <h2 className="text-[13px] font-semibold text-ink">今日习惯</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Sparkline */}
          {sparkline && sparkline.length > 1 && (
            <div className="flex items-end gap-0.5 h-5">
              {sparkline.map((v, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-sage-light/60 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(v, 4)}%`, minHeight: 2 }}
                />
              ))}
            </div>
          )}
          <span className={cn(
            "text-[11px] font-medium",
            pct === 100 ? "text-emerald-500" : "text-ink-light",
          )}>
            {completed}/{total} · {pct}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-ink/5 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className="bg-emerald-400 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Habit check-in list */}
      <div className="space-y-1">
        {habits.map((h) => {
          const isCompleted = h.today_record?.status === "completed";
          const isSkipped = h.today_record?.status === "skipped";
          const isMissed = h.today_record?.status === "missed";

          return (
            <button
              key={h.id}
              onClick={() => onToggle(h.id)}
              disabled={isToggling}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all active:scale-[0.98] border",
                isCompleted
                  ? "bg-emerald-50/50 border-emerald-200"
                  : isSkipped
                    ? "bg-amber-50/50 border-amber-200"
                    : isMissed
                      ? "bg-accent-rose/5 border-accent-rose/20"
                      : "bg-card border-border hover:border-sage-light/30",
              )}
            >
              {/* Checkbox indicator */}
              <div className={cn(
                "h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                isCompleted
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : isSkipped
                    ? "border-amber-300 bg-amber-50 text-amber-500"
                    : isMissed
                      ? "border-accent-rose/30 bg-accent-rose/5 text-accent-rose"
                      : "border-ink/20 bg-white text-transparent",
              )}>
                {isCompleted && <Check size={12} strokeWidth={3} />}
                {isSkipped && <span className="text-[9px] font-bold">→</span>}
                {isMissed && <X size={10} strokeWidth={3} />}
              </div>

              {/* Habit info */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-sm leading-none shrink-0">{h.icon || "✅"}</span>
                <span className={cn(
                  "text-xs font-medium truncate",
                  isCompleted ? "text-emerald-700" : "text-ink",
                )}>
                  {h.title}
                </span>
              </div>

              {/* Target indicator */}
              <span className="text-[10px] text-ink-lighter shrink-0">
                {formatFrequency(h.frequency_type || "daily", h.frequency_value || 1)}
              </span>

              {/* Loading spinner */}
              {isToggling && (
                <Loader2 size={12} className="animate-spin text-ink-lighter shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* AI insight chip */}
      {analysis && (analysis.motivation || analysis.summary) && (
        <button
          onClick={() => navigate("/plan")}
          className="mt-2 w-full flex items-center gap-2 bg-purple-50/50 border border-purple-100 rounded-xl px-3 py-2 hover:bg-purple-50 transition-colors text-left"
        >
          <Sparkles size={12} className="text-purple-500 shrink-0" />
          <span className="text-[11px] text-purple-700 truncate">
            {analysis.motivation || (analysis.summary && analysis.summary.slice(0, 60) + "...")}
          </span>
          <ChevronRight size={12} className="text-purple-400 shrink-0 ml-auto" />
        </button>
      )}
    </section>
  );
}

// ── Today's Schedule (tasks grouped by time slot) ──

const TIME_SLOT_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }> = {
  morning: { label: "上午", icon: Sunrise, color: "text-accent-warm", bg: "bg-accent-warm/5" },
  afternoon: { label: "下午", icon: Sun, color: "text-accent-sky", bg: "bg-accent-sky/5" },
  evening: { label: "晚上", icon: Moon, color: "text-sage-deep", bg: "bg-sage-light/30" },
};

function TodaySchedule({
  stats,
  onToggleTask,
  isToggling,
}: {
  stats: NonNullable<ReturnType<typeof useDashboardStats>["data"]>;
  onToggleTask: (taskId: string, taskStatus: string) => void;
  isToggling: boolean;
}) {
  const [, navigate] = useLocation();
  const allTasks = [...stats.timeline.inProgress, ...stats.timeline.pending]
    .filter((item) => item.type === "task");

  if (allTasks.length === 0) return null;

  const sorted = [...allTasks].sort((a, b) => {
    // Recurring tasks first, then one-time tasks by priority
    if (a.taskType === "recurring" && b.taskType !== "recurring") return -1;
    if (a.taskType !== "recurring" && b.taskType === "recurring") return 1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aPriority = (a.subtitle === "高优先" ? "high" : a.subtitle === "中优先" ? "medium" : "low");
    const bPriority = (b.subtitle === "高优先" ? "high" : b.subtitle === "中优先" ? "medium" : "low");
    return (priorityOrder[aPriority as keyof typeof priorityOrder] ?? 1) -
           (priorityOrder[bPriority as keyof typeof priorityOrder] ?? 1);
  });

  return (
    <section className="bg-gradient-to-br from-sage-light/5 to-white border border-sage-light/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={13} className="text-sage-deep" />
        <h2 className="text-xs font-semibold text-ink">今日执行建议</h2>
        <span className="text-[10px] text-ink-lighter ml-auto">
          {sorted.some((t) => t.taskType === "recurring")
            ? "点击累计完成 · 周期任务显示进度"
            : "按优先级排序 · 点击完成任务"}
        </span>
      </div>
      <div className="space-y-1">
        {sorted.slice(0, 5).map((task) => {
          const isRecurring = task.taskType === "recurring";
          const taskStatus = task.status === "in_progress" ? "in_progress" : "pending";
          const compCount = task.completedCount || 0;
          const tgtCount = task.targetCount || 1;
          const pct = Math.round((compCount / tgtCount) * 100);

          return (
            <div
              key={task.id}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/60 transition-colors"
            >
              <button
                onClick={() => onToggleTask(task.id, taskStatus)}
                disabled={isToggling}
                className="shrink-0"
              >
                {isRecurring ? (
                  compCount >= tgtCount ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : compCount > 0 ? (
                    <CircleDot size={14} className="text-accent-sky" />
                  ) : (
                    <Circle size={14} className="text-ink-lighter hover:text-accent-sky transition-colors" />
                  )
                ) : task.status === "in_progress" ? (
                  <CircleDot size={14} className="text-accent-sky" />
                ) : (
                  <Circle size={14} className="text-ink-lighter hover:text-accent-sky transition-colors" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-ink truncate">{task.title}</span>
                {isRecurring && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="flex-1 bg-ink/5 rounded-full h-1 overflow-hidden max-w-[100px]">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-ink-lighter shrink-0">
                      {compCount}/{tgtCount}
                    </span>
                  </div>
                )}
              </div>
              {!isRecurring && task.subtitle && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                  task.subtitle === "高优先" ? "bg-accent-rose/10 text-accent-rose" :
                  task.subtitle === "中优先" ? "bg-amber-50 text-amber-600" : "bg-ink/5 text-ink-lighter",
                )}>
                  {task.subtitle}
                </span>
              )}
              <button
                onClick={() => navigate("/plan")}
                className="shrink-0 text-ink-lighter hover:text-ink-light transition-colors"
              >
                <ArrowRight size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
