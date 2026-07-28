import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Brain, CheckCircle2, RotateCcw, Zap, TrendingUp } from "lucide-react";
import { useDueExpressions, useSubmitReview } from "@/lib/hooks/useEnglish";
import { cn } from "@/lib/utils";

// ── SM-2 Algorithm ──

const MIN_EF = 1.3;

function sm2(
  quality: number, // 0=Again, 1=Hard, 2=Good, 3=Easy
  currentInterval: number, // in days, 0 for new cards
  currentEF: number,
  streak: number,
): { newInterval: number; newEF: number; newStreak: number } {
  let newEF = currentEF + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
  if (newEF < MIN_EF) newEF = MIN_EF;

  if (quality < 2) {
    // Again or Hard: reset
    return { newInterval: quality === 0 ? 1 : Math.max(1, Math.round(currentInterval * 1.2)), newEF, newStreak: quality === 0 ? 0 : streak };
  }

  // Good or Easy
  const newStreak = streak + 1;
  if (currentInterval === 0) {
    return { newInterval: quality === 3 ? 4 : 1, newEF, newStreak };
  }
  const interval = Math.round(currentInterval * newEF * (quality === 3 ? 1.3 : 1));
  return { newInterval: Math.min(interval, 365), newEF, newStreak };
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Page ──

export default function EnglishReview() {
  const [, navigate] = useLocation();
  const { data: dueExpressions, isLoading } = useDueExpressions();
  const submitReview = useSubmitReview();

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState<
    { expressionId: string; english: string; result: string; oldInterval: number; newInterval: number }[]
  >([]);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const queue = dueExpressions || [];

  const startSession = useCallback(() => {
    setStarted(true);
    setCurrentIndex(0);
    setRevealed(false);
    setSession([]);
    setDone(false);
  }, []);

  const handleRate = useCallback(
    async (quality: number, label: string) => {
      const expr = queue[currentIndex] as Record<string, unknown>;
      if (!expr) return;

      const currentInterval = (expr.review_count as number) === 0
        ? 0
        : estimateInterval(expr.next_review_date as string | null);
      const currentEF = 2.5; // simplified: no EF stored per-expression yet
      const currentStreak = (expr.streak as number) || 0;

      const { newInterval, newEF, newStreak } = sm2(quality, currentInterval, currentEF, currentStreak);
      const nextReviewDate = addDays(newInterval);
      const newStatus = newStreak >= 5 ? "mastered" : newInterval >= 21 ? "review" : "learning";

      // Record locally
      setSession((prev) => [
        ...prev,
        { expressionId: expr.id as string, english: expr.english as string, result: label, oldInterval: currentInterval, newInterval },
      ]);

      // Submit to DB (fire and collect at end)
      try {
        await submitReview.mutateAsync({
          expressionId: expr.id as string,
          result: label,
          previousInterval: currentInterval,
          newInterval,
          nextReviewDate,
          newStatus,
          masteryLevel: Math.min(newStreak, 5),
          streak: newStreak,
          reviewCount: ((expr.review_count as number) || 0) + 1,
        });
      } catch {
        // continue even if one fails
      }

      // Move to next
      if (currentIndex + 1 >= queue.length) {
        setDone(true);
      } else {
        setCurrentIndex((i) => i + 1);
        setRevealed(false);
      }
    },
    [queue, currentIndex, submitReview],
  );

  // ── Not started: show overview ──
  if (!started && !done) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <button onClick={() => navigate("/english")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">English OS</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">SRS 复习</h1>
          </div>
        </header>

        {isLoading && (
          <div className="text-center py-12 text-sm text-ink-lighter">加载中...</div>
        )}

        {!isLoading && queue.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle2 size={48} className="text-sage-deep mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink">全部搞定!</p>
            <p className="text-xs text-ink-lighter mt-1">没有需要复习的表达，回头再来看看。</p>
            <button
              onClick={() => navigate("/english/expressions")}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-sage-deep bg-sage-light rounded-xl px-4 py-2"
            >
              浏览表达库
            </button>
          </div>
        )}

        {!isLoading && queue.length > 0 && (
          <>
            <div className="bg-card rounded-2xl border border-sage-light/50 p-6 text-center space-y-4">
              <Brain size={36} className="text-sage-deep mx-auto" />
              <div>
                <p className="text-3xl font-bold text-ink">{queue.length}</p>
                <p className="text-sm text-ink-light mt-1">条表达等待复习</p>
              </div>
              <button
                onClick={startSession}
                className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
              >
                开始复习
              </button>
            </div>

            <div className="space-y-2">
              {queue.slice(0, 5).map((expr) => (
                <div key={expr.id as string} className="bg-card rounded-xl border border-border px-4 py-2.5 text-sm text-ink">
                  {(expr.english as string).slice(0, 60)}{((expr.english as string)?.length ?? 0) > 60 ? "..." : ""}
                </div>
              ))}
              {queue.length > 5 && (
                <p className="text-xs text-ink-lighter text-center">...还有 {queue.length - 5} 条</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Done: show summary ──
  if (done) {
    const goodCount = session.filter((s) => s.result === "good" || s.result === "easy").length;
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-3">
          <button onClick={() => navigate("/english")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">English OS</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">复习完成</h1>
          </div>
        </header>

        <div className="bg-card rounded-2xl border border-sage-light/50 p-6 text-center space-y-4">
          <TrendingUp size={36} className="text-sage-deep mx-auto" />
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-ink">{session.length}</p>
              <p className="text-xs text-ink-lighter">已复习</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-sage-deep">{goodCount}</p>
              <p className="text-xs text-ink-lighter">掌握</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">
                {session.length > 0 ? Math.round((goodCount / session.length) * 100) : 0}%
              </p>
              <p className="text-xs text-ink-lighter">正确率</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {session.map((s, i) => (
            <div key={i} className="bg-card rounded-xl border border-border px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink truncate flex-1">{s.english.slice(0, 50)}</span>
                <span
                  className={cn(
                    "text-xs rounded-full px-2 py-0.5 shrink-0 ml-2",
                    s.result === "easy"
                      ? "bg-sage-light text-sage-deep"
                      : s.result === "good"
                        ? "bg-blue-50 text-blue-600"
                        : s.result === "hard"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-accent-rose/10 text-accent-rose",
                  )}
                >
                  {s.result}
                </span>
              </div>
              <p className="text-[10px] text-ink-lighter mt-1">
                {s.oldInterval}天 → {s.newInterval}天
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate("/english/expressions")}
            className="flex-1 bg-ink/5 text-ink-light rounded-xl py-2.5 text-sm font-medium"
          >
            浏览表达库
          </button>
          <button
            onClick={startSession}
            className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
          >
            再复习一轮
          </button>
        </div>
      </div>
    );
  }

  // ── Active review card ──
  const currentExpr = queue[currentIndex] as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => setDone(true)} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div className="flex-1">
          <div className="h-1.5 bg-ink/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage-light rounded-full transition-all"
              style={{ width: `${((currentIndex) / queue.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-ink-lighter mt-1">{currentIndex + 1} / {queue.length}</p>
        </div>
      </header>

      {currentExpr && (
        <div className="space-y-3">
          {/* Card front — always visible */}
          <div
            onClick={() => setRevealed(true)}
            className="bg-card rounded-2xl border border-border p-6 min-h-[120px] flex flex-col justify-center cursor-pointer"
          >
            <p className="text-lg font-semibold text-ink text-center">
              {currentExpr.english as string}
            </p>
            {(currentExpr.type as string) && (
              <p className="text-[10px] text-ink-lighter text-center mt-2">
                {(currentExpr.type as string)} · {(currentExpr.scene as string)}
              </p>
            )}
            {!revealed && (
              <p className="text-xs text-sage-deep text-center mt-3">点击查看答案</p>
            )}
          </div>

          {/* Card back — revealed on click */}
          {revealed && (
            <div className="bg-card rounded-2xl border border-sage-light/50 p-4 space-y-2">
              <p className="text-sm font-medium text-ink">{currentExpr.chinese as string}</p>
              {(currentExpr.pronunciation as string) && (
                <p className="text-xs text-ink-lighter">发音: {currentExpr.pronunciation as string}</p>
              )}
              {(currentExpr.example_sentence as string) && (
                <p className="text-xs text-ink-light italic">
                  {(currentExpr.example_sentence as string)}
                </p>
              )}
            </div>
          )}

          {/* Rating buttons — only after reveal */}
          {revealed && (
            <div className="grid grid-cols-4 gap-2">
              <RatingBtn color="accent-rose" label="Again" desc="完全忘了" onClick={() => handleRate(0, "again")} />
              <RatingBtn color="amber" label="Hard" desc="有点难" onClick={() => handleRate(1, "hard")} />
              <RatingBtn color="blue" label="Good" desc="还记得" onClick={() => handleRate(2, "good")} />
              <RatingBtn color="sage" label="Easy" desc="很简单" onClick={() => handleRate(3, "easy")} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function estimateInterval(nextReviewDate: string | null): number {
  if (!nextReviewDate) return 0;
  const now = new Date();
  const next = new Date(nextReviewDate);
  const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function RatingBtn({
  color,
  label,
  desc,
  onClick,
}: {
  color: string;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  const bgMap: Record<string, string> = {
    "accent-rose": "bg-accent-rose/10 hover:bg-accent-rose/20 text-accent-rose",
    amber: "bg-amber-50 hover:bg-amber-100 text-amber-600",
    blue: "bg-blue-50 hover:bg-blue-100 text-blue-600",
    sage: "bg-sage-light hover:bg-sage-light/80 text-sage-deep",
  };

  return (
    <button
      onClick={onClick}
      className={cn("rounded-xl py-3 flex flex-col items-center transition-colors", bgMap[color] || bgMap.sage)}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[10px] opacity-70">{desc}</span>
    </button>
  );
}
