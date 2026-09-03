// ============================================
// Habit Lab — experiment row (list card)
// Used by Experiments/History views and Home summary.
// ============================================

import { useLocation } from "wouter";
import { ChevronRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HabitSprintRow } from "@/lib/habits/types";
import { useSprintTimeline, useSprintReview } from "@/lib/habits/hooks";
import { getHabitIcon } from "@/lib/habits/icons";
import { PHASE_META } from "./labels";
import { DayGrid } from "./DayGrid";

const TILE_CLS: Record<string, string> = {
  scheduled: "bg-ink/5 text-ink-light",
  active: "bg-sage-light text-sage-deep",
  paused: "bg-accent-warm/20 text-[#A5673F]",
  reviewable: "bg-accent-sky/10 text-accent-sky",
  completed: "bg-sage text-white",
  archived: "bg-ink/5 text-ink-lighter",
};

export function SprintRow({ sprint, withReview = false }: { sprint: HabitSprintRow; withReview?: boolean }) {
  const [, navigate] = useLocation();
  const { timeline, points } = useSprintTimeline(sprint);
  const { data: review } = useSprintReview(withReview ? sprint.id : undefined);

  if (!timeline) return null;

  const Icon = getHabitIcon(sprint.icon);
  const phase = timeline.phase;
  const meta = PHASE_META[phase];
  const terminal = phase === "completed" || phase === "archived";
  const rate = Math.round((timeline.completedCount / timeline.totalDays) * 100);
  const hasStreak = timeline.longestStreak >= 2 && !terminal;

  return (
    <button
      onClick={() => navigate(`/habits/${sprint.id}`)}
      className="w-full text-left bg-card rounded-2xl border border-border px-4 py-3.5 transition-colors hover:bg-card-hover group"
    >
      {/* Title row */}
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center", TILE_CLS[phase])}>
          <Icon size={19} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink truncate">{sprint.title}</h3>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0", meta.chip)}>
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-ink-light mt-0.5 line-clamp-1">{sprint.cue_sentence}</p>
        </div>
        <ChevronRight size={15} className="text-ink-lighter group-hover:text-ink transition-colors shrink-0" />
      </div>

      {/* Body */}
      <div className="mt-2.5">
        {terminal ? (
          <div className="flex items-center gap-3 text-[11px] text-ink-light">
            <span>
              <span className="font-semibold text-ink">{timeline.completedCount}/{timeline.totalDays}</span> 天完成
            </span>
            <span>
              <span className="font-semibold text-ink">{rate}%</span> 完成率
            </span>
            {points && (
              <span className="text-sage-deep font-semibold">+{points.total} pts</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[11px] text-ink-light">
            <span>
              {phase === "scheduled" ? "开始于" : "进行到"}{" "}
              <span className="font-semibold text-ink">
                {phase === "scheduled" ? sprint.start_date : `第 ${timeline.currentDay} 天`}
              </span>
            </span>
            {hasStreak && (
              <span className="flex items-center gap-1">
                <Flame size={11} className="text-accent-warm" />连续 {timeline.longestStreak} 天
              </span>
            )}
          </div>
        )}
        <div className="mt-2">
          <DayGrid days={timeline.days} />
        </div>
        {terminal && review?.next_action && (
          <p className="mt-2 text-[11px] text-ink-light border-t border-border/50 pt-2 line-clamp-1">
            <span className="text-ink-lighter">下一步 · </span>
            {review.next_action}
          </p>
        )}
      </div>
    </button>
  );
}
