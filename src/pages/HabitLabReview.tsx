import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Loader2, Lock, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBeijingDateString } from "@/lib/date";
import { diffDays, completionRatePercent } from "@/lib/habits/logic";
import { useSprint, useSprintTimeline, useFinalizeReview, useSprintReview } from "@/lib/habits/hooks";
import { getHabitIcon } from "@/lib/habits/icons";

const QUESTIONS = [
  {
    key: "easiestContext",
    q: "这次实验里，什么时候做起来最轻松？",
    hint: "找到那个让行为自然发生的条件，下次就把它固定下来。",
    placeholder: "例如：早晨喝完咖啡坐在书桌前时",
  },
  {
    key: "primaryFriction",
    q: "最容易让你中断、或不想做的是什么？",
    hint: "记录真正的阻碍，不是评判自己。",
    placeholder: "例如：晚上到家太累，总想先刷手机",
  },
  {
    key: "nextAction",
    q: "接下来想怎么调整？",
    hint: "给自己一个下一步：换个情境、换掉动作，还是继续原样？",
    placeholder: "例如：把时间挪到早晨，动作缩小到打开书即可",
  },
] as const;

type AnswerKey = (typeof QUESTIONS)[number]["key"];

export default function HabitLabReview() {
  const [, params] = useRoute("/habits/:id/review");
  const [, navigate] = useLocation();
  const id = params?.id;
  const { data: sprint, isLoading: loadingSprint } = useSprint(id);
  const finalize = useFinalizeReview();
  const { data: existingReview } = useSprintReview(id);
  const { timeline, points, isLoading: loadingTimeline } = useSprintTimeline(sprint);

  const [answers, setAnswers] = useState<Record<AnswerKey, string>>({
    easiestContext: "",
    primaryFriction: "",
    nextAction: "",
  });

  // Seed answers once an existing review arrives (editing a completed sprint).
  useEffect(() => {
    if (!existingReview) return;
    setAnswers({
      easiestContext: existingReview.easiest_context ?? "",
      primaryFriction: existingReview.primary_friction ?? "",
      nextAction: existingReview.next_action ?? "",
    });
  }, [existingReview]);

  if (loadingSprint || loadingTimeline || !sprint || !timeline) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-ink-lighter" /></div>;
  }

  const today = getBeijingDateString();
  const Icon = getHabitIcon(sprint.icon);
  const daysLeft = diffDays(today, timeline.endDate); // <= 0 when elapsed
  const locked = daysLeft > 0 && sprint.status !== "completed";
  const rate = completionRatePercent(timeline.completedCount, timeline.totalDays);
  const totalPoints = points ? points.total + (points.completionBonus > 0 ? 0 : 100) : 100;

  const save = () => {
    finalize.mutate({
      sprintId: sprint.id,
      completedDays: timeline.completedCount,
      totalDays: timeline.totalDays,
      completionRate: rate,
      longestStreak: timeline.longestStreak,
      pointsEarned: totalPoints,
      easiestContext: answers.easiestContext.trim() || null,
      primaryFriction: answers.primaryFriction.trim() || null,
      nextAction: answers.nextAction.trim() || null,
    }, {
      onSuccess: () => navigate(`/habits/${sprint.id}`),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(`/habits/${id}`)} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center text-ink-light hover:text-ink transition-colors">
          <ChevronLeft size={16} />
        </button>
        <header>
          <p className="text-sm text-ink-lighter">21 天复盘</p>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5 flex items-center gap-2">
            <Icon size={18} className="text-sage-deep" />{sprint.title}
          </h1>
        </header>
      </div>

      {locked ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-ink/5 flex items-center justify-center text-ink-lighter"><Lock size={20} /></div>
          <p className="text-sm font-medium text-ink">21 天还没结束</p>
          <p className="text-xs text-ink-light">实验满 {timeline.totalDays} 天后才会解锁复盘。还差 {daysLeft} 天。</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="rounded-2xl bg-gradient-to-br from-sage-light/15 to-white border border-sage-light/40 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">这一趟实验走完了</p>
              <span className="text-[11px] font-semibold text-sage-deep">+{totalPoints} pts</span>
            </div>
            <p className="text-[11px] text-ink-light mt-0.5">
              完成 {timeline.completedCount}/{timeline.totalDays} 天 · 完成率 {rate}% · 最长连续 {timeline.longestStreak} 天
            </p>
          </div>

          {QUESTIONS.map(({ key, q, hint, placeholder }, i) => (
            <div key={key} className="bg-card rounded-2xl border border-border p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="flex items-center justify-center">
                  <Sparkles size={13} className={cn(i % 2 === 0 ? "text-sage-deep" : "text-accent-warm")} />
                </span>
                {q}
              </p>
              <p className="text-[11px] text-ink-lighter mt-1 mb-3">{hint}</p>
              <textarea
                value={answers[key]}
                onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                rows={3}
                placeholder={placeholder}
                className="w-full rounded-xl border border-border bg-warm-cream px-3.5 py-3 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition resize-none leading-relaxed"
              />
            </div>
          ))}

          <button
            onClick={save}
            disabled={finalize.isPending}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-sage-deep px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
          >
            {finalize.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {existingReview ? "更新复盘并完成" : "保存复盘 · 完结实验"}
          </button>
        </>
      )}
    </div>
  );
}
