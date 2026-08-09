import { useLocation } from "wouter";
import { Clock, Circle, CircleDot, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/lib/hooks/usePlan";

interface TodayScheduleProps {
  tasks?: TaskRow[] | null;
  onToggleTask: (taskId: string, taskStatus: string) => void;
  isToggling: boolean;
}

export function TodaySchedule({ tasks, onToggleTask, isToggling }: TodayScheduleProps) {
  const [, navigate] = useLocation();

  if (!tasks || tasks.length === 0) return null;

  const visible = tasks.slice(0, 5);

  return (
    <section className="bg-gradient-to-br from-sage-light/5 to-white border border-sage-light/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={13} className="text-sage-deep" />
        <h2 className="text-xs font-semibold text-ink">今日重点任务</h2>
        <span className="text-[10px] text-ink-lighter ml-auto">
          {tasks.some((t) => t.task_type === "recurring") ? "点击累计完成" : "点击完成任务"}
        </span>
      </div>
      <div className="space-y-1">
        {visible.map((task) => {
          const isRecurring = task.task_type === "recurring";
          const taskStatus = task.status === "in_progress" ? "in_progress" : "pending";
          const rawCount = isRecurring ? (task.completed_count || 0) : 0;
          const tgtCount = isRecurring ? (task.target_count || 1) : 1;
          const compCount = Math.min(rawCount, tgtCount);
          const pct = Math.round((compCount / tgtCount) * 100);
          const priorityLabel =
            task.priority === "high" ? "高优先" : task.priority === "medium" ? "中优先" : "低优先";

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
              {!isRecurring && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                  task.priority === "high" ? "bg-accent-rose/10 text-accent-rose"
                    : task.priority === "medium" ? "bg-amber-50 text-amber-600"
                    : "bg-ink/5 text-ink-lighter",
                )}>
                  {priorityLabel}
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
