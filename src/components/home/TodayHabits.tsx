import { Check, X, ChevronRight, Loader2, Trophy } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { HabitWithRecord, formatFrequency } from "@/lib/hooks/useHabit";

interface TodayHabitsProps {
  habits: HabitWithRecord[];
  onToggle: (habitId: string) => void;
  isToggling: boolean;
  weeklyStats?: { weekStart: string; overallRate: number }[];
  formatFreq: typeof formatFrequency;
}

export function TodayHabits({ habits, onToggle, isToggling, weeklyStats, formatFreq }: TodayHabitsProps) {
  const [, navigate] = useLocation();
  const completed = habits.filter((h) => h.today_record?.status === "completed").length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const sparkline = weeklyStats && weeklyStats.length > 0
    ? weeklyStats.map((w) => Math.round(w.overallRate * 100))
    : null;

  // Show at most 2 habits: prefer uncompleted first, then most recently completed
  const visible = habits
    .sort((a, b) => {
      const aDone = a.today_record?.status === "completed" ? 1 : 0;
      const bDone = b.today_record?.status === "completed" ? 1 : 0;
      return aDone - bDone;
    })
    .slice(0, 2);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-accent-warm" />
          <h2 className="text-[13px] font-semibold text-ink">今日习惯</h2>
        </div>
        <div className="flex items-center gap-2">
          {sparkline && sparkline.length > 1 && (
            <div className="flex items-end gap-0.5 h-4">
              {sparkline.map((v, i) => (
                <div key={i} className="w-1 bg-sage-light/60 rounded-t-sm"
                  style={{ height: `${Math.max(v, 4)}%`, minHeight: 2 }} />
              ))}
            </div>
          )}
          <span className={cn("text-[11px] font-medium", pct === 100 ? "text-emerald-500" : "text-ink-light")}>
            {completed}/{total} · {pct}%
          </span>
        </div>
      </div>

      <div className="bg-ink/5 rounded-full h-1.5 mb-2 overflow-hidden">
        <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-1">
        {visible.map((h) => {
          const isCompleted = h.today_record?.status === "completed";
          const isSkipped = h.today_record?.status === "skipped";
          const isMissed = h.today_record?.status === "missed";

          return (
            <button key={h.id} onClick={() => onToggle(h.id)} disabled={isToggling}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2 transition-all active:scale-[0.98] border",
                isCompleted ? "bg-emerald-50/50 border-emerald-200"
                  : isSkipped ? "bg-amber-50/50 border-amber-200"
                  : isMissed ? "bg-accent-rose/5 border-accent-rose/20"
                  : "bg-card border-border hover:border-sage-light/30",
              )}>
              <div className={cn(
                "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                isCompleted ? "bg-emerald-500 border-emerald-500 text-white"
                  : isSkipped ? "border-amber-300 bg-amber-50 text-amber-500"
                  : isMissed ? "border-accent-rose/30 bg-accent-rose/5 text-accent-rose"
                  : "border-ink/20 bg-white text-transparent",
              )}>
                {isCompleted && <Check size={11} strokeWidth={3} />}
                {isSkipped && <span className="text-[8px] font-bold">→</span>}
                {isMissed && <X size={9} strokeWidth={3} />}
              </div>
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-sm leading-none shrink-0">{h.icon || "✅"}</span>
                <span className={cn("text-xs font-medium truncate", isCompleted ? "text-emerald-700" : "text-ink")}>
                  {h.title}
                </span>
              </div>
              <span className="text-[10px] text-ink-lighter shrink-0">
                {formatFreq(h.frequency_type || "daily", h.frequency_value || 1)}
              </span>
              {isToggling && <Loader2 size={11} className="animate-spin text-ink-lighter shrink-0" />}
            </button>
          );
        })}
      </div>

      {habits.length > 2 && (
        <button onClick={() => navigate("/plan?tab=habits")}
          className="mt-1.5 w-full text-center text-[11px] text-sage-deep hover:text-sage-deep/70 transition-colors py-1">
          查看全部 {habits.length} 个习惯 <ChevronRight size={10} className="inline align-baseline" />
        </button>
      )}
    </section>
  );
}
