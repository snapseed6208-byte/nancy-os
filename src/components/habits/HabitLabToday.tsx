// ============================================
// Habit Lab — Home daily-action section
// Home = today's action; full experiment detail lives on /habits.
// All counts derive from useHabitLabToday (Habit Lab data only),
// so Home's 今日实验 card and this section never disagree.
// ============================================

import { useLocation } from "wouter";
import { Loader2, Plus, FlaskConical, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBeijingDateString } from "@/lib/date";
import { addDays, missedYesterday } from "@/lib/habits/logic";
import { useActiveSprints, useHabitLabToday, useLogsOn, useCompleteSprintDay } from "@/lib/habits/hooks";
import type { TodaySprintItem } from "@/lib/habits/types";
import { getHabitIcon } from "@/lib/habits/icons";
import { SprintTodayCard } from "./SprintTodayCard";
import { SprintRow } from "./SprintRow";

export function HabitLabToday() {
  const { isLoading } = useActiveSprints();
  const summary = useHabitLabToday();
  const today = getBeijingDateString();
  const yesterday = addDays(today, -1);
  const { data: yesterdayLogs = [] } = useLogsOn(yesterday);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-ink/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-ink/5 rounded" />
            <div className="h-2.5 w-2/3 bg-ink/5 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const others = [...summary.reviewable, ...summary.paused, ...summary.scheduled];

  return (
    <section className="space-y-2.5">
      <SectionHeader />

      {!summary.hasExperiments ? (
        <EmptyCta />
      ) : (
        <>
          {summary.due.length === 1 && (
            <SprintTodayCard sprint={summary.due[0].sprint} />
          )}

          {summary.due.length > 1 && <MultiToday summary={summary} yesterdayLogs={yesterdayLogs} />}

          {others.length > 0 && (
            <div className="space-y-2">
              {others.map((item) => (
                <SprintRow key={item.sprint.id} sprint={item.sprint} withReview={item.phase === "reviewable"} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SectionHeader() {
  const [, navigate] = useLocation();
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-lg bg-sage-light flex items-center justify-center text-sage-deep shrink-0">
        <FlaskConical size={13} />
      </div>
      <h2 className="text-[13px] font-semibold text-ink">习惯实验</h2>
      <button
        onClick={() => navigate("/habits")}
        className="ml-auto flex items-center gap-0.5 text-[11px] font-medium text-sage-deep hover:text-sage-deep/70 transition-colors"
      >
        查看进度 <ChevronRight size={12} />
      </button>
    </div>
  );
}

function EmptyCta() {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate("/habits/new")}
      className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-sage-light/60 bg-gradient-to-br from-sage-light/10 to-white px-4 py-3.5 text-left transition-colors hover:bg-card-hover group"
    >
      <div className="h-10 w-10 shrink-0 rounded-xl bg-sage-light flex items-center justify-center text-sage-deep">
        <FlaskConical size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">从一个足够小的改变开始。</p>
        <p className="text-[11px] text-ink-light mt-0.5">用 21 天做一次行为实验，每天只完成最小动作。</p>
      </div>
      <span className="shrink-0 flex items-center gap-0.5 rounded-lg bg-sage px-3 py-2 text-xs font-semibold text-white group-hover:bg-sage-deep transition-colors">
        <Plus size={13} strokeWidth={3} />开始 21 天实验
      </span>
    </button>
  );
}

// ── Multiple experiments due today: calm header + one compact row each ──

function MultiToday({ summary, yesterdayLogs }: {
  summary: ReturnType<typeof useHabitLabToday>;
  yesterdayLogs: { sprint_id: string }[];
}) {
  const [, navigate] = useLocation();
  const today = getBeijingDateString();
  const skipped = summary.due.length - summary.doneCount;
  const needsRecovery = summary.due.some(
    (item) => item.todayStatus === null && missedYesterday(item, yesterdayLogs, today),
  );
  const ptsToday = summary.doneCount * 10;

  return (
    <div className="space-y-2">
      {/* Summary line */}
      {summary.allHandled ? (
        <div className="flex items-center gap-2 rounded-xl border border-sage-light/40 bg-gradient-to-br from-sage-light/20 to-white px-3.5 py-2.5">
          {summary.allCompleted ? (
            <span className="flex items-center gap-1.5 h-5 w-5 rounded-full bg-sage text-white justify-center shrink-0">
              <Check size={12} strokeWidth={3} />
            </span>
          ) : (
            <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
          )}
          <p className="text-xs font-medium text-ink min-w-0 flex-1">
            {summary.allCompleted
              ? <>今天的 {summary.due.length} 个实验都完成了</>
              : <>今天的实验都已打卡（{skipped} 个跳过）</>}
            {summary.allCompleted && (
              <span className="ml-1.5 text-[10px] font-semibold text-sage-deep">+{ptsToday} Habit Points</span>
            )}
          </p>
          <button
            onClick={() => navigate("/habits")}
            className="shrink-0 flex items-center gap-0.5 text-[11px] font-medium text-sage-deep hover:underline"
          >
            查看进度 <ChevronRight size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-3.5 py-2.5">
          <p className="text-xs text-ink-light min-w-0">
            {summary.doneCount === 0 ? (
              <span className="font-semibold text-ink">{summary.due.length} 个实验进行中</span>
            ) : (
              <>
                今日实验{" "}
                <span className="font-semibold text-ink">{summary.doneCount}/{summary.due.length}</span>
                <span className="mx-1.5 text-ink-lighter">·</span>
                还有 <span className="font-semibold text-sage-deep">{summary.remainingCount}</span> 个最小行动
              </>
            )}
          </p>
          <button
            onClick={() => navigate("/habits")}
            className="shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-sage-deep"
          >
            继续打卡 <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Non-judgmental recovery nudge, only when something is still actionable */}
      {needsRecovery && (
        <p className="text-[11px] text-ink-light px-1">
          昨天错过了一次。今天只完成最小版本就够了。
        </p>
      )}

      {summary.due.map((item) => (
        <TodayRow key={item.sprint.id} item={item} />
      ))}
    </div>
  );
}

// ── Compact row: one experiment, its minimum action, and a complete CTA ──

function TodayRow({ item }: { item: TodaySprintItem }) {
  const [, navigate] = useLocation();
  const { sprint, todayStatus, currentDay, totalDays } = item;
  const Icon = getHabitIcon(sprint.icon);
  const complete = useCompleteSprintDay();
  const today = getBeijingDateString();
  const open = () => navigate(`/habits/${sprint.id}`);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        todayStatus === "completed"
          ? "border-sage-light/50 bg-gradient-to-br from-sage-light/15 to-white"
          : todayStatus === "skipped"
            ? "border-amber-100 bg-amber-50/40"
            : "border-border/60 bg-card",
      )}
    >
      <button
        onClick={open}
        className={cn(
          "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center",
          todayStatus === "completed" ? "bg-sage text-white" : "bg-sage-light text-sage-deep",
        )}
      >
        <Icon size={16} />
      </button>

      <button onClick={open} className="flex-1 min-w-0 text-left">
        <p className="text-xs font-medium text-ink truncate">{sprint.title}</p>
        <p className="text-[11px] text-ink-light mt-0.5 truncate">{sprint.cue_sentence}</p>
      </button>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-[9px] text-ink-lighter">
          Day {currentDay}/{totalDays}
        </span>
        {todayStatus === "completed" ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-sage-deep">
            <Check size={11} strokeWidth={3} />已打卡
          </span>
        ) : todayStatus === "skipped" ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">已跳过</span>
        ) : (
          <button
            onClick={() => complete.mutate({ sprintId: sprint.id, date: today, status: "completed" })}
            disabled={complete.isPending}
            className="flex items-center gap-1 rounded-lg bg-sage px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-sage-deep active:scale-[0.98] disabled:opacity-60"
          >
            <Check size={11} strokeWidth={3} />完成
            <span className="text-[9px] font-normal opacity-85">+10</span>
          </button>
        )}
      </div>
    </div>
  );
}
