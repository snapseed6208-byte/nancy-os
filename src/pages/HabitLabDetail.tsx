import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Loader2, Pause, Play, Archive, Trash2, RotateCcw, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSprint, useSprintTimeline, useSetSprintStatus, useDeleteSprint, useSprintReview } from "@/lib/habits/hooks";
import { getHabitIcon } from "@/lib/habits/icons";
import type { HabitSprintRow } from "@/lib/habits/types";
import { SprintTodayCard } from "@/components/habits/SprintTodayCard";
import { DayGrid } from "@/components/habits/DayGrid";
import { PHASE_META } from "@/components/habits/labels";

export default function HabitLabDetail() {
  const [, params] = useRoute("/habits/:id");
  const [, navigate] = useLocation();
  const id = params?.id;
  const { data: sprint, isLoading: loadingSprint } = useSprint(id);
  const setStatus = useSetSprintStatus();
  const del = useDeleteSprint();

  const [armArchive, setArmArchive] = useState(false);
  const [armDelete, setArmDelete] = useState(false);

  if (loadingSprint || !sprint) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-ink-lighter" /></div>;
  }

  const terminal = sprint.status === "completed" || sprint.status === "archived";

  const doArchive = () => {
    if (!armArchive) { setArmArchive(true); setTimeout(() => setArmArchive(false), 2500); return; }
    setStatus.mutate({ id: sprint.id, status: "archived" });
  };
  const doDelete = () => {
    if (!armDelete) { setArmDelete(true); setTimeout(() => setArmDelete(false), 2500); return; }
    del.mutate(sprint.id, { onSuccess: () => navigate("/habits") });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/habits")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center text-ink-light hover:text-ink transition-colors">
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm text-ink-lighter truncate">{sprint.title}</p>
      </div>

      {!terminal ? (
        <>
          <SprintTodayCard sprint={sprint} />
          <DetailCard sprint={sprint} />
        </>
      ) : (
        <CompletedCard sprint={sprint} />
      )}

      {/* Management */}
      <div className="bg-card rounded-2xl border border-border p-2 flex items-center">
        {!terminal && (
          <ManageBtn
            label={sprint.status === "paused" ? "恢复" : "暂停"}
            icon={sprint.status === "paused" ? Play : Pause}
            onClick={() => setStatus.mutate({ id: sprint.id, status: sprint.status === "paused" ? "active" : "paused" })}
          />
        )}
        {sprint.status !== "archived" && (
          <ManageBtn
            label={armArchive ? "再点一次确认" : "归档"}
            icon={Archive}
            danger={armArchive}
            onClick={doArchive}
          />
        )}
        <ManageBtn
          label={armDelete ? "再点一次确认" : "删除"}
          icon={Trash2}
          danger={armDelete}
          onClick={doDelete}
        />
      </div>
    </div>
  );
}

function ManageBtn({ label, icon: Icon, onClick, danger }: {
  label: string; icon: React.ComponentType<{ size?: number; className?: string }>; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors",
        danger ? "bg-rose-50 text-rose-600" : "text-ink-light hover:bg-ink/5 hover:text-ink",
      )}
    >
      <Icon size={14} />{label}
    </button>
  );
}

function DetailCard({ sprint }: { sprint: HabitSprintRow }) {
  const { timeline, points, isLoading } = useSprintTimeline(sprint);
  const Icon = getHabitIcon(sprint.icon);
  if (isLoading || !timeline) {
    return <div className="bg-card rounded-2xl border border-border p-5 animate-pulse"><div className="h-3 w-1/2 bg-ink/5 rounded" /></div>;
  }
  const meta = PHASE_META[timeline.phase];

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-sage-light flex items-center justify-center text-sage-deep">
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink truncate">{sprint.title}</h2>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0", meta.chip)}>{meta.label}</span>
          </div>
          <p className="text-xs text-ink-light mt-0.5 leading-relaxed">{sprint.cue_sentence}</p>
        </div>
      </div>

      {sprint.identity_statement && (
        <p className="text-sm text-sage-deep italic leading-relaxed border-l-2 border-sage-light pl-3">
          “{sprint.identity_statement}”
        </p>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        <MiniStat label="完成" value={`${timeline.completedCount}`} strong />
        <MiniStat label="跳过" value={`${timeline.skippedCount}`} />
        <MiniStat label="未完成" value={`${timeline.missedCount}`} soft={timeline.missedCount === 0} />
        <MiniStat label="最长连续" value={`${timeline.longestStreak} 天`} />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-ink">{sprint.start_date} → {timeline.endDate}</span>
          {points && <span className="font-semibold text-sage-deep">+{points.total} pts</span>}
        </div>
        <DayGrid days={timeline.days} showLegend />
      </div>
    </div>
  );
}

function MiniStat({ label, value, strong, soft }: { label: string; value: string; strong?: boolean; soft?: boolean }) {
  return (
    <div className="rounded-xl bg-warm-cream px-1 py-2.5">
      <p className={cn("text-lg font-bold leading-none", strong ? "text-sage-deep" : soft ? "text-ink-lighter" : "text-ink")}>{value}</p>
      <p className="text-[10px] text-ink-lighter mt-1.5">{label}</p>
    </div>
  );
}

function CompletedCard({ sprint }: { sprint: HabitSprintRow }) {
  const { timeline, points, isLoading } = useSprintTimeline(sprint);
  const { data: review } = useSprintReview(sprint.id);
  const [, navigate] = useLocation();
  const Icon = getHabitIcon(sprint.icon);
  if (isLoading || !timeline) {
    return <div className="bg-card rounded-2xl border border-border p-5 animate-pulse"><div className="h-3 w-1/2 bg-ink/5 rounded" /></div>;
  }
  const meta = PHASE_META[timeline.phase];
  const rate = Math.round((timeline.completedCount / timeline.totalDays) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-sage-light/20 to-white border border-sage-light/40 p-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-sage text-white flex items-center justify-center"><Icon size={22} /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink truncate">{sprint.title}</h2>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0", meta.chip)}>{meta.label}</span>
            </div>
            <p className="text-[11px] text-ink-light mt-0.5">这是一次完整的 21 天行为实验。</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/60 border border-border px-2 py-2.5">
            <p className="text-lg font-bold text-sage-deep">{rate}%</p><p className="text-[10px] text-ink-lighter mt-1">完成率</p>
          </div>
          <div className="rounded-xl bg-white/60 border border-border px-2 py-2.5">
            <p className="text-lg font-bold text-ink">{timeline.longestStreak} 天</p><p className="text-[10px] text-ink-lighter mt-1">最长连续</p>
          </div>
          <div className="rounded-xl bg-white/60 border border-border px-2 py-2.5">
            <p className="text-lg font-bold text-ink">+{points ? points.total : 0}</p><p className="text-[10px] text-ink-lighter mt-1">Habit Points</p>
          </div>
        </div>
      </div>

      {review && (
        <div className="bg-card rounded-2xl border border-border p-5 space-y-3.5">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-sage-deep" />
            <p className="text-sm font-semibold text-ink">实验复盘</p>
          </div>
          {review.easiest_context && <ReviewLine q="在哪最轻松" a={review.easiest_context} icon={<CheckCircle2 size={13} className="text-sage" />} />}
          {review.primary_friction && <ReviewLine q="什么在阻碍" a={review.primary_friction} icon={<Pause size={13} className="text-accent-warm" />} />}
          {review.next_action && <ReviewLine q="下一步" a={review.next_action} icon={<Play size={13} className="text-accent-sky" />} />}
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">21 天打卡图</p>
        <DayGrid days={timeline.days} showLegend />
      </div>

      <button
        onClick={() => navigate("/habits/new")}
        className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-3.5 text-sm font-medium text-ink-light transition-colors hover:bg-card-hover hover:text-ink"
      >
        <RotateCcw size={14} />带着这次的经验，发起下一个实验
      </button>
    </div>
  );
}

function ReviewLine({ q, a, icon }: { q: string; a: string; icon: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-ink-lighter">{q}</p>
        <p className="text-sm text-ink leading-relaxed mt-0.5">{a}</p>
      </div>
    </div>
  );
}
