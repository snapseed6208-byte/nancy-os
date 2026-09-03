// ============================================
// Habit Lab — compact Home strip (entry point only)
// Shown when at least one sprint is running; never duplicates the Today view.
// ============================================

import { useLocation } from "wouter";
import { FlaskConical, ChevronRight, Check } from "lucide-react";
import { useActiveSprints, useTodayLogs } from "@/lib/habits/hooks";

export function HomeStrip() {
  const [, navigate] = useLocation();
  const { data: sprints } = useActiveSprints();
  const { data: todayLogs } = useTodayLogs();

  if (!sprints || sprints.length === 0) return null;

  const running = sprints.length;
  const doneToday = (todayLogs || []).filter((l) => l.status === "completed").length;
  const allDone = doneToday >= running;

  return (
    <button
      onClick={() => navigate("/habits")}
      className="w-full flex items-center gap-3 rounded-2xl border border-sage-light/50 bg-gradient-to-br from-sage-light/15 to-white px-4 py-3 text-left transition-colors hover:bg-card-hover group"
    >
      <div className="h-10 w-10 shrink-0 rounded-xl bg-sage-light flex items-center justify-center text-sage-deep">
        <FlaskConical size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">习惯实验</p>
        <p className="text-[11px] text-ink-light mt-0.5">
          {allDone
            ? "今天的最小动作都完成了，收工。"
            : `${running} 个实验进行中 · 今日已完成 ${doneToday}/${running}`}
        </p>
      </div>
      {allDone ? (
        <span className="shrink-0 h-7 w-7 rounded-full bg-sage flex items-center justify-center text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      ) : (
        <span className="flex items-center gap-0.5 text-xs font-semibold text-sage-deep shrink-0">
          去打卡<ChevronRight size={14} />
        </span>
      )}
    </button>
  );
}
