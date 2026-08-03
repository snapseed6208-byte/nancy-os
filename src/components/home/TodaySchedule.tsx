import { useLocation } from "wouter";
import { Clock, Circle, CircleDot, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/hooks/useDashboard";

interface TodayScheduleProps {
  stats: NonNullable<DashboardStats>;
  onToggleTask: (taskId: string, taskStatus: string) => void;
  isToggling: boolean;
}

export function TodaySchedule({ stats, onToggleTask, isToggling }: TodayScheduleProps) {
  const [, navigate] = useLocation();
  const allTasks = [...stats.timeline.inProgress, ...stats.timeline.pending]
    .filter((item) => item.type === "task");

  if (allTasks.length === 0) return null;

  const sorted = [...allTasks].sort((a, b) => {
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
        <h2 className="text-xs font-semibold text-ink">今日重点任务</h2>
        <span className="text-[10px] text-ink-lighter ml-auto">
          {sorted.some((t) => t.taskType === "recurring") ? "点击累计完成" : "点击完成任务"}
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
            <div key={task.id}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/60 transition-colors">
              <button onClick={() => onToggleTask(task.id, taskStatus)} disabled={isToggling} className="shrink-0">
                {isRecurring ? (
                  compCount >= tgtCount ? <CheckCircle2 size={14} className="text-emerald-500" />
                    : compCount > 0 ? <CircleDot size={14} className="text-accent-sky" />
                    : <Circle size={14} className="text-ink-lighter hover:text-accent-sky transition-colors" />
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
                      <div className="bg-emerald-400 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] text-ink-lighter shrink-0">{compCount}/{tgtCount}</span>
                  </div>
                )}
              </div>
              {!isRecurring && task.subtitle && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                  task.subtitle === "高优先" ? "bg-accent-rose/10 text-accent-rose"
                    : task.subtitle === "中优先" ? "bg-amber-50 text-amber-600"
                    : "bg-ink/5 text-ink-lighter",
                )}>
                  {task.subtitle}
                </span>
              )}
              <button onClick={() => navigate("/plan")}
                className="shrink-0 text-ink-lighter hover:text-ink-light transition-colors">
                <ArrowRight size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
