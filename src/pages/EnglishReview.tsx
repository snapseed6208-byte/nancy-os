import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Brain, CheckCircle2, Zap, TrendingUp,
  Eye, Edit3, Lightbulb, AlertTriangle, Tag, BookOpen,
} from "lucide-react";
import { useDueExpressions, useSubmitReview } from "@/lib/hooks/useEnglish";
import { cn } from "@/lib/utils";
import type { ReviewMode } from "@/lib/types";

// ── SM-2 Algorithm ──

const MIN_EF = 1.3;

function sm2(
  quality: number, // 0=Again, 1=Hard, 2=Good, 3=Easy
  currentInterval: number,
  currentEF: number,
  currentReps: number,
): { newInterval: number; newEF: number; newReps: number } {
  let newEF = currentEF + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02));
  if (newEF < MIN_EF) newEF = MIN_EF;

  if (quality < 3) {
    // quality 0, 1, 2: all reset repetitions (only Easy/3 counts as success)
    if (quality === 0) {
      return { newInterval: 1, newEF, newReps: 0 };
    }
    // Hard (1) or Good (2): short interval, reps reset
    const factor = quality === 1 ? 1.2 : 1.5;
    return { newInterval: Math.max(1, Math.round(currentInterval * factor)), newEF, newReps: 0 };
  }

  // quality 3 (Easy): success — increment reps
  const newReps = currentReps + 1;
  if (currentInterval === 0) {
    return { newInterval: 4, newEF, newReps };
  }
  const interval = Math.round(currentInterval * newEF * 1.3);
  return { newInterval: Math.min(interval, 365), newEF, newReps };
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function estimateInterval(nextReviewDate: string | null): number {
  if (!nextReviewDate) return 0;
  const now = new Date();
  const next = new Date(nextReviewDate);
  const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// ── Helpers ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getExprField(expr: Record<string, unknown>, field: string): string {
  return (expr[field] as string) || "";
}

// ── Mode Labels ──

const MODE_LABELS: Record<ReviewMode, string> = {
  active_recall: "主动回忆",
  recognition: "识别模式",
  cloze: "填空模式",
};

const MODE_DESCS: Record<ReviewMode, string> = {
  active_recall: "看中文说出英文",
  recognition: "看英文选中文",
  cloze: "例句填空中练习",
};

const MODE_ICONS: Record<ReviewMode, React.ComponentType<{ size?: number; className?: string }>> = {
  active_recall: Brain,
  recognition: Eye,
  cloze: Edit3,
};

// ── Page ──

export default function EnglishReview() {
  const [, navigate] = useLocation();
  const { data: dueExpressions, isLoading } = useDueExpressions();
  const submitReview = useSubmitReview();

  const [mode, setMode] = useState<ReviewMode | null>(null);
  const [started, setStarted] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<Record<string, unknown>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [session, setSession] = useState<
    { expressionId: string; english: string; result: string; oldInterval: number; newInterval: number }[]
  >([]);
  const [done, setDone] = useState(false);
  const sessionStartRef = useRef(Date.now());

  // Recognition-specific state
  const [recogOptions, setRecogOptions] = useState<string[]>([]);
  const [recogSelected, setRecogSelected] = useState<number | null>(null);
  const [recogCorrect, setRecogCorrect] = useState<number>(-1);

  const queue = reviewQueue;
  const totalCards = dueExpressions?.length || 0;

  const startSession = useCallback((reviewMode: ReviewMode) => {
    const cards = [...(dueExpressions || [])] as Record<string, unknown>[];
    setMode(reviewMode);
    setReviewQueue(cards);
    setCurrentIndex(0);
    setRevealed(false);
    setIsRating(false);
    setSession([]);
    setDone(false);
    setRecogSelected(null);
    setRecogCorrect(-1);
    sessionStartRef.current = Date.now();
    setStarted(true);
  }, [dueExpressions]);

  const generateRecogOptions = useCallback((correctChinese: string, allExprs: Record<string, unknown>[]) => {
    const others = allExprs
      .filter((e) => getExprField(e, "chinese") !== correctChinese)
      .map((e) => getExprField(e, "chinese"))
      .filter(Boolean);
    const distractors = shuffle(others).slice(0, 3);
    return shuffle([correctChinese, ...distractors]);
  }, []);

  // Set recognition options when card changes in recognition mode
  useEffect(() => {
    if (mode === "recognition" && started && !done && queue.length > 0) {
      const expr = queue[currentIndex];
      if (expr) {
        setRecogOptions(generateRecogOptions(getExprField(expr, "chinese"), queue));
        setRecogSelected(null);
        setRecogCorrect(-1);
      }
    }
  }, [mode, started, done, currentIndex, queue, generateRecogOptions]);

  // ── Shared submitRating: SM-2 calc + DB update + queue management ──

  const submitRating = useCallback(
    async (quality: number, label: string) => {
      const expr = queue[currentIndex] as Record<string, unknown> | undefined;
      if (!expr) return;

      const currentInterval = (expr.review_count as number) === 0
        ? 0
        : estimateInterval(expr.next_review_date as string | null);
      const currentEF = (expr.ease_factor as number) || 2.5;
      const currentReps = (expr.repetitions as number) || 0;
      const currentStreak = (expr.streak as number) || 0;

      const { newInterval, newEF, newReps } = sm2(quality, currentInterval, currentEF, currentReps);
      const nextReviewDate = addDays(newInterval);
      const newStatus = newReps >= 5 ? "mastered" : newInterval >= 21 ? "review" : "learning";
      const reviewCount = ((expr.review_count as number) || 0) + 1;
      const newStreak = quality >= 3 ? currentStreak + 1 : 0;

      setSession((prev) => [
        ...prev,
        { expressionId: expr.id as string, english: expr.english as string, result: label, oldInterval: currentInterval, newInterval },
      ]);

      try {
        await submitReview.mutateAsync({
          expressionId: expr.id as string,
          result: label,
          previousInterval: currentInterval,
          newInterval,
          nextReviewDate,
          newStatus,
          masteryLevel: Math.min(newReps, 5),
          streak: newStreak,
          reviewCount,
          easeFactor: newEF,
          repetitions: newReps,
        });
      } catch {
        // continue even if one fails
      }

      // Re-queue on Again (quality 0) only
      if (quality === 0) {
        setReviewQueue((prev) => {
          const next = [...prev];
          next.splice(Math.min(currentIndex + 3, next.length), 0, expr);
          return next;
        });
      }
    },
    [queue, currentIndex, submitReview],
  );

  // ── Advance to next card ──

  const advanceCard = useCallback(
    (quality: number) => {
      const addedCards = quality === 0 ? 1 : 0;
      const nextIdx = currentIndex + 1;
      if (nextIdx >= queue.length + addedCards) {
        setDone(true);
      } else {
        setCurrentIndex(nextIdx);
        setRevealed(false);
      }
    },
    [queue.length, currentIndex],
  );

  // ── Active recall / Cloze: 4-button rating ──

  const handleRate = useCallback(
    async (quality: number, label: string) => {
      if (isRating) return;
      setIsRating(true);
      await submitRating(quality, label);
      advanceCard(quality);
      setIsRating(false);
    },
    [submitRating, advanceCard, isRating],
  );

  // ── Recognition: correct/wrong → quality 3/0, delayed advance ──

  const handleRecogSelect = useCallback(
    async (idx: number) => {
      if (recogSelected !== null) return;
      const expr = queue[currentIndex] as Record<string, unknown> | undefined;
      if (!expr) return;

      const correctChinese = getExprField(expr, "chinese");
      const correctIdx = recogOptions.indexOf(correctChinese);
      const isCorrect = idx === correctIdx;

      setRecogSelected(idx);
      setRecogCorrect(correctIdx);

      const quality = isCorrect ? 3 : 0;
      const label = isCorrect ? "easy" : "again";

      // Rate immediately (DB update, queue, session)
      await submitRating(quality, label);

      // Delay visual advancement for feedback
      setTimeout(() => {
        advanceCard(quality);
        setRecogSelected(null);
        setRecogCorrect(-1);
      }, 800);
    },
    [queue, currentIndex, submitRating, advanceCard, recogOptions, recogSelected],
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!started || done || mode === "recognition") return;
    const handler = (e: KeyboardEvent) => {
      if (isRating) return;
      if (!revealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (e.key === "1") handleRate(0, "again");
      else if (e.key === "2") handleRate(1, "hard");
      else if (e.key === "3") handleRate(2, "good");
      else if (e.key === "4") handleRate(3, "easy");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [started, done, revealed, isRating, mode, handleRate]);

  // ── Mode Selection ──

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

        {!isLoading && totalCards === 0 && (
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

        {!isLoading && totalCards > 0 && (
          <>
            <div className="bg-card rounded-2xl border border-sage-light/50 p-6 text-center space-y-4">
              <Brain size={36} className="text-sage-deep mx-auto" />
              <div>
                <p className="text-3xl font-bold text-ink">{totalCards}</p>
                <p className="text-sm text-ink-light mt-1">条表达等待复习</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-ink-light">选择复习模式</p>
              {(["active_recall", "recognition", "cloze"] as ReviewMode[]).map((m) => {
                const Icon = MODE_ICONS[m];
                return (
                  <button
                    key={m}
                    onClick={() => startSession(m)}
                    className="w-full bg-card rounded-2xl border border-border p-4 flex items-center gap-4 text-left hover:border-sage-light/50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-sage-deep" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-ink">{MODE_LABELS[m]}</h3>
                      <p className="text-xs text-ink-lighter mt-0.5">{MODE_DESCS[m]}</p>
                    </div>
                    <div className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5 shrink-0">
                      {totalCards} 张
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-ink-lighter">预览待复习表达</p>
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
    const elapsedSec = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const minutes = Math.floor(elapsedSec / 60);
    const seconds = elapsedSec % 60;

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
          <div>
            <p className="text-xs text-ink-lighter">{MODE_LABELS[mode!]}</p>
            <p className="text-xs text-ink-lighter mt-1">
              用时 {minutes}分{seconds}秒
            </p>
          </div>
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
                  {s.result === "again" ? "忘记" : s.result === "hard" ? "困难" : s.result === "good" ? "良好" : "简单"}
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
            onClick={() => { setStarted(false); setDone(false); setMode(null); }}
            className="flex-1 bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold"
          >
            再复习一轮
          </button>
        </div>
      </div>
    );
  }

  // ── Active Review ──

  const currentExpr = queue[currentIndex] as Record<string, unknown> | undefined;
  const progressPct = queue.length > 0 ? ((currentIndex) / queue.length) * 100 : 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => setDone(true)} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-ink-lighter">{MODE_LABELS[mode!]}</span>
            <span className="text-[10px] text-ink-lighter">{currentIndex + 1} / {queue.length}</span>
          </div>
          <div className="h-1.5 bg-ink/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage-light rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {currentExpr && (
        <div className="space-y-3">
          {/* ── Active Recall Card ── */}
          {mode === "active_recall" && (
            <>
              {/* Front: Chinese + scene */}
              <div
                onClick={() => !revealed && setRevealed(true)}
                className={cn(
                  "bg-card rounded-2xl border border-border p-6 min-h-[160px] flex flex-col justify-center cursor-pointer transition-all",
                  !revealed && "hover:border-sage-light/30",
                )}
              >
                <p className="text-2xl font-bold text-ink text-center">
                  {getExprField(currentExpr, "chinese")}
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  {getExprField(currentExpr, "scene") && (
                    <span className="text-[10px] bg-ink/5 text-ink-lighter rounded-full px-2 py-0.5">
                      {getExprField(currentExpr, "scene")}
                    </span>
                  )}
                  {getExprField(currentExpr, "topic") && (
                    <span className="text-[10px] bg-sage-light/50 text-sage-deep rounded-full px-2 py-0.5">
                      {getExprField(currentExpr, "topic")}
                    </span>
                  )}
                  {(() => {
                    const diff = getExprField(currentExpr, "difficulty_level");
                    return diff && (
                    <span className={cn(
                      "text-[10px] rounded-full px-2 py-0.5",
                      diff === "advanced" ? "bg-accent-rose/10 text-accent-rose" :
                      diff === "beginner" ? "bg-sage-light text-sage-deep" :
                      "bg-amber-50 text-amber-600",
                    )}>
                      {diff === "beginner" ? "初级" : diff === "advanced" ? "高级" : "中级"}
                    </span>
                  );
                  })()}
                </div>
                {!revealed && (
                  <p className="text-xs text-sage-deep text-center mt-4">点击查看答案 (或按空格键)</p>
                )}
              </div>

              {/* Back: English + details */}
              {revealed && (
                <div className="bg-card rounded-2xl border border-sage-light/50 p-5 space-y-3 animate-in fade-in">
                  <p className="text-xl font-bold text-sage-deep text-center">{getExprField(currentExpr, "english")}</p>
                  <p className="text-sm text-ink-light text-center">{getExprField(currentExpr, "chinese")}</p>

                  {getExprField(currentExpr, "pronunciation") && (
                    <p className="text-xs text-ink-lighter text-center">发音: {getExprField(currentExpr, "pronunciation")}</p>
                  )}

                  {getExprField(currentExpr, "example_sentence") && (
                    <div className="bg-ink/5 rounded-xl p-3">
                      <p className="text-xs text-ink-light italic leading-relaxed">
                        {getExprField(currentExpr, "example_sentence")}
                      </p>
                    </div>
                  )}

                  {getExprField(currentExpr, "usage_note") && (
                    <div className="flex items-start gap-2">
                      <BookOpen size={13} className="text-ink-lighter shrink-0 mt-0.5" />
                      <p className="text-xs text-ink-light">{getExprField(currentExpr, "usage_note")}</p>
                    </div>
                  )}

                  {getExprField(currentExpr, "memory_tip") && (
                    <div className="flex items-start gap-2 bg-amber-50/50 rounded-xl p-3">
                      <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{getExprField(currentExpr, "memory_tip")}</p>
                    </div>
                  )}

                  {getExprField(currentExpr, "common_mistakes") && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={13} className="text-accent-rose/70 shrink-0 mt-0.5" />
                      <p className="text-xs text-accent-rose/80">{getExprField(currentExpr, "common_mistakes")}</p>
                    </div>
                  )}

                  {getExprField(currentExpr, "common_patterns") && (
                    <div className="bg-ink/5 rounded-xl p-3">
                      <p className="text-[10px] text-ink-lighter mb-1">常用模式</p>
                      <p className="text-xs text-ink font-mono">{getExprField(currentExpr, "common_patterns")}</p>
                    </div>
                  )}

                  {getExprField(currentExpr, "context") && (
                    <div className="flex items-center gap-2">
                      <Tag size={12} className="text-ink-lighter shrink-0" />
                      <span className="text-[10px] text-ink-lighter">{getExprField(currentExpr, "context")}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rating buttons */}
              {revealed && (
                <div className="grid grid-cols-4 gap-2">
                  <RatingBtn color="accent-rose" label="Again" desc="忘了" keyLabel="1" onClick={() => handleRate(0, "again")} />
                  <RatingBtn color="amber" label="Hard" desc="困难" keyLabel="2" onClick={() => handleRate(1, "hard")} />
                  <RatingBtn color="blue" label="Good" desc="记得" keyLabel="3" onClick={() => handleRate(2, "good")} />
                  <RatingBtn color="sage" label="Easy" desc="简单" keyLabel="4" onClick={() => handleRate(3, "easy")} />
                </div>
              )}
            </>
          )}

          {/* ── Recognition Card ── */}
          {mode === "recognition" && (
            <div className="space-y-3">
              <div className="bg-card rounded-2xl border border-border p-6 min-h-[120px] flex flex-col justify-center">
                <p className="text-xl font-bold text-ink text-center">
                  {getExprField(currentExpr, "english")}
                </p>
                {getExprField(currentExpr, "type") && (
                  <p className="text-[10px] text-ink-lighter text-center mt-2">
                    {getExprField(currentExpr, "type")} · {getExprField(currentExpr, "scene")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {recogOptions.map((option, idx) => {
                  let style = "bg-card border-border hover:border-sage-light/30";
                  if (recogSelected !== null) {
                    if (idx === recogCorrect) {
                      style = "bg-sage-light/50 border-sage-light text-sage-deep";
                    } else if (idx === recogSelected && idx !== recogCorrect) {
                      style = "bg-accent-rose/10 border-accent-rose/30 text-accent-rose";
                    } else {
                      style = "bg-card border-border opacity-50";
                    }
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleRecogSelect(idx)}
                      disabled={recogSelected !== null}
                      className={cn("w-full rounded-xl border px-4 py-3 text-sm text-left transition-all", style)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Cloze Card ── */}
          {mode === "cloze" && (
            <>
              {/* Front: sentence with blank */}
              {(() => {
                const example = getExprField(currentExpr, "example_sentence");
                const clozeSaved = getExprField(currentExpr, "cloze_sentence");
                const expression = getExprField(currentExpr, "english");

                // Build cloze sentence: prefer pre-generated, then regex, then fallback
                let clozeText = "";
                if (clozeSaved) {
                  clozeText = clozeSaved;
                } else if (example) {
                  // Try regex replace
                  const escaped = expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  const regex = new RegExp(escaped, "gi");
                  const afterReplace = example.replace(regex, "_____");
                  if (afterReplace !== example) {
                    clozeText = afterReplace;
                  }
                }

                if (clozeText) {
                  return (
                    <div
                      onClick={() => !revealed && setRevealed(true)}
                      className={cn(
                        "bg-card rounded-2xl border border-border p-6 min-h-[140px] flex flex-col justify-center cursor-pointer transition-all",
                        !revealed && "hover:border-sage-light/30",
                      )}
                    >
                      <p className="text-lg text-ink leading-relaxed text-center">{clozeText}</p>
                      <p className="text-sm text-ink-lighter text-center mt-3">
                        提示: {getExprField(currentExpr, "chinese")}
                      </p>
                      {!revealed && (
                        <p className="text-xs text-sage-deep text-center mt-4">点击查看答案 (或按空格键)</p>
                      )}
                    </div>
                  );
                }

                // Fall back to active recall
                return (
                  <div
                    onClick={() => !revealed && setRevealed(true)}
                    className={cn(
                      "bg-card rounded-2xl border border-border p-6 min-h-[140px] flex flex-col justify-center cursor-pointer transition-all",
                      !revealed && "hover:border-sage-light/30",
                    )}
                  >
                    <p className="text-2xl font-bold text-ink text-center">
                      {getExprField(currentExpr, "chinese")}
                    </p>
                    <p className="text-[10px] text-ink-lighter text-center mt-2">(无例句，切换为主动回忆)</p>
                    {!revealed && (
                      <p className="text-xs text-sage-deep text-center mt-3">点击查看答案 (或按空格键)</p>
                    )}
                  </div>
                );
              })()}

              {/* Back */}
              {revealed && (
                <div className="bg-card rounded-2xl border border-sage-light/50 p-5 space-y-3 animate-in fade-in">
                  <p className="text-xl font-bold text-sage-deep text-center">{getExprField(currentExpr, "english")}</p>
                  <p className="text-sm text-ink-light text-center">{getExprField(currentExpr, "chinese")}</p>

                  {getExprField(currentExpr, "pronunciation") && (
                    <p className="text-xs text-ink-lighter text-center">发音: {getExprField(currentExpr, "pronunciation")}</p>
                  )}

                  {getExprField(currentExpr, "example_sentence") && (
                    <div className="bg-ink/5 rounded-xl p-3">
                      <p className="text-xs text-ink-light italic leading-relaxed">
                        {getExprField(currentExpr, "example_sentence")}
                      </p>
                    </div>
                  )}

                  {getExprField(currentExpr, "usage_note") && (
                    <div className="flex items-start gap-2">
                      <BookOpen size={13} className="text-ink-lighter shrink-0 mt-0.5" />
                      <p className="text-xs text-ink-light">{getExprField(currentExpr, "usage_note")}</p>
                    </div>
                  )}

                  {getExprField(currentExpr, "memory_tip") && (
                    <div className="flex items-start gap-2 bg-amber-50/50 rounded-xl p-3">
                      <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{getExprField(currentExpr, "memory_tip")}</p>
                    </div>
                  )}

                  {getExprField(currentExpr, "common_mistakes") && (
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={13} className="text-accent-rose/70 shrink-0 mt-0.5" />
                      <p className="text-xs text-accent-rose/80">{getExprField(currentExpr, "common_mistakes")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Rating buttons */}
              {revealed && (
                <div className="grid grid-cols-4 gap-2">
                  <RatingBtn color="accent-rose" label="Again" desc="忘了" keyLabel="1" onClick={() => handleRate(0, "again")} />
                  <RatingBtn color="amber" label="Hard" desc="困难" keyLabel="2" onClick={() => handleRate(1, "hard")} />
                  <RatingBtn color="blue" label="Good" desc="记得" keyLabel="3" onClick={() => handleRate(2, "good")} />
                  <RatingBtn color="sage" label="Easy" desc="简单" keyLabel="4" onClick={() => handleRate(3, "easy")} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!currentExpr && (
        <div className="text-center py-12 text-sm text-ink-lighter">没有更多卡片</div>
      )}
    </div>
  );
}

// ── Rating Button ──

function RatingBtn({
  color,
  label,
  desc,
  keyLabel,
  onClick,
}: {
  color: string;
  label: string;
  desc: string;
  keyLabel: string;
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
      className={cn("rounded-xl py-3 flex flex-col items-center transition-colors relative", bgMap[color] || bgMap.sage)}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[10px] opacity-70">{desc}</span>
      <span className="absolute top-1 right-1.5 text-[9px] opacity-40 font-mono">{keyLabel}</span>
    </button>
  );
}
