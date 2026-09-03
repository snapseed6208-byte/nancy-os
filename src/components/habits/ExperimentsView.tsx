// ============================================
// Habit Lab — Experiments tab
// Active + reviewable experiments and the historical shelf.
// ============================================

import { useLocation } from "wouter";
import { Loader2, Plus } from "lucide-react";
import { getBeijingDateString } from "@/lib/date";
import { addDays } from "@/lib/habits/logic";
import { useAllSprints } from "@/lib/habits/hooks";
import type { HabitSprintRow } from "@/lib/habits/types";
import { SprintRow } from "./SprintRow";

type SprintLike = HabitSprintRow & { reviewable?: boolean };

export function ExperimentsView() {
  const [, navigate] = useLocation();
  const { data: sprints, isLoading } = useAllSprints();
  const today = getBeijingDateString();

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-ink-lighter" /></div>;
  }

  const all: SprintLike[] = (sprints || []).map((s) => {
    const ended = addDays(s.start_date, s.duration_days - 1) < today;
    return { ...s, reviewable: s.status === "active" && ended };
  });
  const running = all.filter((s) => !s.reviewable && (s.status === "active" || s.status === "paused"));
  const reviewable = all.filter((s) => s.reviewable);
  const history = all.filter((s) => s.status === "completed" || s.status === "archived");
  const empty = running.length + reviewable.length + history.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">
          我的行为实验
        </p>
        <button
          onClick={() => navigate("/habits/new")}
          className="inline-flex items-center gap-1 rounded-full bg-sage px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sage-deep"
        >
          <Plus size={13} strokeWidth={3} />新实验
        </button>
      </div>

      {empty ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <p className="text-sm font-medium text-ink">还没有实验记录</p>
          <p className="text-xs text-ink-light mt-1.5">每一条 21 天打卡，都是一次关于自己的观察。</p>
          <button
            onClick={() => navigate("/habits/new")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-deep"
          >
            <Plus size={15} strokeWidth={3} />发起实验
          </button>
        </div>
      ) : (
        <>
          {running.length > 0 && (
            <section className="space-y-2.5">
              <SectionLabel title="进行中" count={running.length} />
              {running.map((s) => <SprintRow key={s.id} sprint={s} />)}
            </section>
          )}

          {reviewable.length > 0 && (
            <section className="space-y-2.5">
              <SectionLabel title="等待复盘" count={reviewable.length} />
              {reviewable.map((s) => <SprintRow key={s.id} sprint={s} />)}
            </section>
          )}

          {history.length > 0 && (
            <section className="space-y-2.5">
              <SectionLabel title="历史实验" count={history.length} />
              {history.map((s) => <SprintRow key={s.id} sprint={s} withReview />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">{title}</p>
      <span className="px-1.5 py-px rounded-full bg-ink/5 text-[10px] text-ink-light">{count}</span>
    </div>
  );
}
