// ============================================
// Habit Lab — Today tab
// The daily working surface: finish the minimum action.
// ============================================

import { useLocation } from "wouter";
import { Loader2, Plus } from "lucide-react";
import { getBeijingDateString, getBeijingWeekday, formatBeijingDate } from "@/lib/date";
import { useActiveSprints } from "@/lib/habits/hooks";
import type { HabitSprintRow } from "@/lib/habits/types";
import { SprintTodayCard } from "./SprintTodayCard";
import { SprintRow } from "./SprintRow";

function isScheduled(s: HabitSprintRow, today: string) {
  return s.status === "active" && s.start_date > today;
}

export function TodayView() {
  const [, navigate] = useLocation();
  const { data: sprints, isLoading } = useActiveSprints();
  const today = getBeijingDateString();
  const weekday = getBeijingWeekday(today);

  // Main list = active/paused/reviewable sprints. Reviewable ones surface their复盘 CTA in the card.
  const main = (sprints || []).filter((s) => !isScheduled(s, today));
  const upcoming = (sprints || []).filter((s) => isScheduled(s, today));

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-ink-lighter" /></div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-light">
        {formatBeijingDate(today)} · {weekday} — 把最小动作做完，比做得完美更重要。
      </p>

      {main.length === 0 && upcoming.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {main.map((s) => <SprintTodayCard key={s.id} sprint={s} />)}

          {upcoming.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider pt-2">即将开始</p>
              {upcoming.map((s) => <SprintRow key={s.id} sprint={s} />)}
            </>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  const [, navigate] = useLocation();
  return (
    <div className="bg-card rounded-2xl border border-border p-6 flex flex-col items-center text-center">
      <div className="mt-2 mb-4 h-12 w-12 rounded-2xl bg-sage-light flex items-center justify-center text-sage-deep">
        <Plus size={22} />
      </div>
      <h2 className="text-[15px] font-semibold text-ink">还没有正在进行的实验</h2>
      <p className="text-xs text-ink-light mt-1.5 leading-relaxed max-w-[260px]">
        挑一件想养成的小事，设定最小动作，用 21 天做一次行为实验。
      </p>
      <button
        onClick={() => navigate("/habits/new")}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-deep"
      >
        <Plus size={15} strokeWidth={3} />发起一个 21 天实验
      </button>
    </div>
  );
}
