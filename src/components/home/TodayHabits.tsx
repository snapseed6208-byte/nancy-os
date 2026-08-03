import { Check, X, ChevronRight, Loader2, Trophy, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { HabitWithRecord, formatFrequency } from "@/lib/hooks/useHabit";

interface TodayHabitsProps {
  habits: HabitWithRecord[];
  onToggle: (habitId: string) => void;
  isToggling: boolean;
  weeklyStats?: { weekStart: string; overallRate: number }[];
  analysis?: { summary?: string; motivation?: string } | null;
  formatFreq: typeof formatFrequency;
}

export function TodayHabits({ habits, onToggle, isToggling, weeklyStats, analysis, formatFreq }: TodayHabitsProps) {
  const [, navigate] = useLocation();
  const completed = habits.filter((h) => h.today_record?.status === "completed").length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

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
          {sparkline && sparkline.length > 1 && (
            <div className="flex items-end gap-0.5 h-5">
              {sparkline.map((v, i) => (
                <div key={i} className="w-1.5 bg-sage-light/60 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(v, 4)}%`, minHeight: 2 }} />
              ))}
            </div>
          )}
          <span className={cn("text-[11px] font-medium", pct === 100 ? "text-emerald-500" : "text-ink-light")}>
            {completed}/{total} · {pct}%
          </span>
        </div>
      </div>

      <div className="bg-ink/5 rounded-full h-1.5 mb-3 overflow-hidden">
        <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-1">
        {habits.map((h) => {
          const isCompleted = h.today_record?.status === "completed";
          const isSkipped = h.today_record?.status === "skipped";
          const isMissed = h.today_record?.status === "missed";

          return (
            <button key={h.id} onClick={() => onToggle(h.id)} disabled={isToggling}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all active:scale-[0.98] border",
                isCompleted ? "bg-emerald-50/50 border-emerald-200"
                  : isSkipped ? "bg-amber-50/50 border-amber-200"
                  : isMissed ? "bg-accent-rose/5 border-accent-rose/20"
                  : "bg-card border-border hover:border-sage-light/30",
              )}>
              <div className={cn(
                "h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                isCompleted ? "bg-emerald-500 border-emerald-500 text-white"
                  : isSkipped ? "border-amber-300 bg-amber-50 text-amber-500"
                  : isMissed ? "border-accent-rose/30 bg-accent-rose/5 text-accent-rose"
                  : "border-ink/20 bg-white text-transparent",
              )}>
                {isCompleted && <Check size={12} strokeWidth={3} />}
                {isSkipped && <span className="text-[9px] font-bold">→</span>}
                {isMissed && <X size={10} strokeWidth={3} />}
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
              {isToggling && <Loader2 size={12} className="animate-spin text-ink-lighter shrink-0" />}
            </button>
          );
        })}
      </div>

      {analysis && (analysis.motivation || analysis.summary) && (
        <button onClick={() => navigate("/plan")}
          className="mt-2 w-full flex items-center gap-2 bg-purple-50/50 border border-purple-100 rounded-xl px-3 py-2 hover:bg-purple-50 transition-colors text-left">
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
