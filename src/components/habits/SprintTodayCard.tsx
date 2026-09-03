// ============================================
// Habit Lab — Today action card
// One card per sprint: daily outcome + recovery + review gate.
// ============================================

import { useLocation } from "wouter";
import { Check, Undo2, ChevronRight, Flame, Pause, Play, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBeijingDateString } from "@/lib/date";
import type { HabitSprintRow } from "@/lib/habits/types";
import {
  useSprintTimeline, useCompleteSprintDay, useUndoSprintDay, useSetSprintStatus,
} from "@/lib/habits/hooks";
import { getHabitIcon } from "@/lib/habits/icons";
import { PHASE_META } from "./labels";

export function SprintTodayCard({ sprint }: { sprint: HabitSprintRow }) {
  const [, navigate] = useLocation();
  const { timeline, isLoading } = useSprintTimeline(sprint);
  const complete = useCompleteSprintDay();
  const undo = useUndoSprintDay();
  const setStatus = useSetSprintStatus();

  const Icon = getHabitIcon(sprint.icon);
  const today = getBeijingDateString();
  const todayCell = timeline?.days.find((d) => d.date === today);
  const phase = timeline?.phase ?? "active";
  const phaseMeta = PHASE_META[phase];

  if (isLoading || !timeline) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-ink/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 bg-ink/5 rounded" />
            <div className="h-2.5 w-2/3 bg-ink/5 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const handleComplete = () => complete.mutate({ sprintId: sprint.id, date: today, status: "completed" });
  const handleSkip = () => complete.mutate({ sprintId: sprint.id, date: today, status: "skipped" });
  const handleUndo = () => undo.mutate({ sprintId: sprint.id, date: today });

  // Recovery: an explicit miss within the recent past → gentle nudge (never miss twice).
  const recentMiss = timeline.days
    .filter((d) => d.date < today && d.dayNumber >= timeline.currentDay! - 2)
    .some((d) => d.status === "missed");

  const openDetail = () => navigate(`/habits/${sprint.id}`);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header — tap to open experiment */}
      <button onClick={openDetail} className="w-full text-left px-4 pt-4 pb-3 block group">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-colors",
              todayCell?.status === "completed"
                ? "bg-sage text-white"
                : todayCell?.status === "skipped"
                  ? "bg-amber-100 text-amber-600"
                  : "bg-sage-light text-sage-deep",
            )}
          >
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-ink truncate">{sprint.title}</h3>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-light shrink-0">
                {phase === "active" && (
                  <>
                    <Flame size={11} className={timeline.longestStreak >= 2 ? "text-accent-warm" : "text-ink-lighter"} />
                    Day {timeline.currentDay}
                    <span className="text-ink-lighter font-normal">/ {timeline.totalDays}</span>
                  </>
                )}
                {phase === "reviewable" && <span className="text-accent-sky">Day {timeline.totalDays}/21</span>}
                {phase === "scheduled" && <span className="text-ink-lighter">未开始</span>}
                {(phase === "paused" || phase === "completed" || phase === "archived") && (
                  <span>{sprint.start_date}</span>
                )}
                <ChevronRight size={14} className="text-ink-lighter group-hover:text-ink transition-colors" />
              </span>
            </div>
            <p className="text-xs text-ink-light mt-1 line-clamp-1">{sprint.cue_sentence}</p>
          </div>
        </div>
      </button>

      {/* Progress meta */}
      <div className="px-4 pb-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-ink/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-sage transition-all"
            style={{ width: `${Math.min(100, (timeline.completedCount / timeline.totalDays) * 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-ink-lighter shrink-0">
          已完成 {timeline.completedCount}/{timeline.totalDays}
        </span>
      </div>

      {/* Action area */}
      <div className="px-4 pb-4">
        {phase === "active" && todayCell?.status === "due" && (
          <div className="space-y-1.5">
            {recentMiss && (
              <p className="text-[11px] text-ink-lighter">昨天缺了一次 · 今天完成，让“继续”比“开始”更常见。</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleComplete}
                disabled={complete.isPending || undo.isPending}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-deep active:scale-[0.99] disabled:opacity-60"
              >
                <Check size={15} strokeWidth={3} />完成今天
                <span className="text-[10px] font-normal opacity-80">+10</span>
              </button>
              <button
                onClick={handleSkip}
                disabled={complete.isPending || undo.isPending}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-ink-light transition-colors hover:bg-card-hover hover:text-ink disabled:opacity-60"
              >
                跳过
              </button>
            </div>
          </div>
        )}

        {phase === "active" && todayCell?.status === "completed" && (
          <div className="flex items-center justify-between rounded-xl bg-sage-light/50 border border-sage-light px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-sage-deep">
              <Check size={15} strokeWidth={3} />今天已完成
            </span>
            <button onClick={handleUndo} className="flex items-center gap-1 text-[11px] text-ink-lighter hover:text-ink transition-colors">
              <Undo2 size={12} />撤销
            </button>
          </div>
        )}

        {phase === "active" && todayCell?.status === "skipped" && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600">今天已跳过 · 明天继续</span>
            <button onClick={handleComplete} className="text-[11px] font-medium text-ink-lighter hover:text-ink transition-colors">
              标记为完成
            </button>
          </div>
        )}

        {phase === "reviewable" && (
          <button
            onClick={() => navigate(`/habits/${sprint.id}/review`)}
            className="w-full flex items-center justify-between rounded-xl bg-gradient-to-br from-sage-light/60 to-white border border-sage-light/40 px-3.5 py-3 group"
          >
            <span className="text-left">
              <span className="block text-sm font-semibold text-sage-deep">21 天已结束，复盘这趟实验</span>
              <span className="block text-[11px] text-ink-light mt-0.5">回顾容易的部分、卡住的部分，再决定下一步</span>
            </span>
            <span className="h-7 w-7 shrink-0 rounded-full bg-sage-deep text-white flex items-center justify-center">
              <RefreshCcw size={13} className="group-hover:rotate-180 transition-transform duration-300" />
            </span>
          </button>
        )}

        {phase === "paused" && (
          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-ink-light">
              <Pause size={14} />已暂停
            </span>
            <button
              onClick={() => setStatus.mutate({ id: sprint.id, status: "active" })}
              className="flex items-center gap-1 text-[11px] font-medium text-sage-deep hover:underline"
            >
              <Play size={11} />恢复实验
            </button>
          </div>
        )}

        {phase === "scheduled" && (
          <p className="text-[11px] text-ink-lighter">将于 {sprint.start_date} 开始 · 现在可以先休息</p>
        )}
      </div>
    </div>
  );
}
