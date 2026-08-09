// ============================================
// English SRS V3 — Daily Review Session
//
// Fixed 15 daily expressions. All modes read from
// the same session. Same-day reinforcement (max 3 rounds).
// ============================================

import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useTodaySession,
  useUpdateSessionItem,
  useRecordPracticeLog,
  useUpdateSessionStage,
  getReinforcementItems,
  getSessionStats,
  type SessionItem,
} from "@/lib/hooks/useReviewSession";
import { useSubmitReview } from "@/lib/hooks/useEnglish";
import { cn } from "@/lib/utils";
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  Brain,
  Pencil,
  History,
  Target,
} from "lucide-react";

// ═══════════════════════════════════════
// Progress Header
// ═══════════════════════════════════════

function SessionHeader({
  stats,
  currentStage,
  reinforcementRound,
  onAdvanceStage,
  hasReinforcement,
}: {
  stats: ReturnType<typeof getSessionStats>;
  currentStage: string;
  reinforcementRound: number;
  onAdvanceStage: () => void;
  hasReinforcement: boolean;
}) {
  const stageLabel =
    currentStage === "recall" ? "主动回忆" : currentStage === "sentence" ? "造句训练" : "应用练习";
  const stageIcons: Record<string, typeof Brain> = {
    recall: Brain,
    sentence: Pencil,
    application: Target,
  };
  const Icon = stageIcons[currentStage] || Brain;

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-sage-light flex items-center justify-center">
            <Icon size={18} className="text-sage-deep" />
          </div>
          <div>
            <h3 className="font-semibold text-ink text-sm">{stageLabel}</h3>
            <p className="text-[11px] text-ink-light">
              {reinforcementRound > 0
                ? `第 ${reinforcementRound + 1} 轮 · 强化训练`
                : `第 1 轮 · ${stats.total} 个表达`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-2 bg-warm-cream rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-deep rounded-full transition-all"
                style={{
                  width: `${stats.total > 0 ? ((stats.passed) / stats.total) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs font-medium text-ink-light">
              {stats.passed}/{stats.total}
            </span>
          </div>
          {/* Advance to next stage */}
          {currentStage === "recall" && stats.pending === 0 && stats.inProgress === 0 && (
            <button
              onClick={onAdvanceStage}
              className="flex items-center gap-1 px-3 py-1.5 bg-sage-light text-sage-deep text-xs font-medium rounded-lg hover:bg-sage-light/70 transition-colors"
            >
              进入造句 <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Failed items hint */}
      {hasReinforcement && stats.failed > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-accent-warm/10 rounded-lg">
          <RefreshCw size={13} className="text-accent-warm" />
          <span className="text-xs text-accent-warm">
            {stats.failed} 个困难表达将在当前轮次结束后强化
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Recall Card (show Chinese → type English)
// ═══════════════════════════════════════

function RecallCard({
  item,
  onResult,
}: {
  item: SessionItem;
  onResult: (itemId: string, passed: boolean, score: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [selfRating, setSelfRating] = useState<number | null>(null);

  const handleReveal = () => setRevealed(true);

  const handleRate = (rating: number) => {
    setSelfRating(rating);
    const passed = rating >= 3;
    setTimeout(() => onResult(item.id, passed, rating), 200);
  };

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      {/* Chinese prompt */}
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">中文提示</p>
        <p className="text-lg font-medium text-ink">{item.expression?.chinese}</p>
      </div>

      {/* Answer reveal */}
      {!revealed ? (
        <button
          onClick={handleReveal}
          className="w-full py-3 px-4 bg-sage-light text-sage-deep text-sm font-medium rounded-xl hover:bg-sage-light/70 transition-colors"
        >
          显示答案
        </button>
      ) : (
        <div className="space-y-4">
          {/* English answer */}
          <div className="p-4 bg-warm-cream rounded-xl">
            <p className="text-[11px] text-ink-lighter mb-1">正确表达</p>
            <p className="text-base font-medium text-ink">{item.expression?.english}</p>
            {item.expression?.pronunciation && (
              <p className="text-xs text-ink-light mt-1">/{item.expression.pronunciation}/</p>
            )}
          </div>

          {/* Self-rating */}
          <div>
            <p className="text-xs text-ink-light mb-2">你记得怎么样？</p>
            <div className="flex gap-2">
              {[
                { score: 1, label: "完全不记得", color: "bg-red-50 text-red-500 border-red-200" },
                { score: 2, label: "有些模糊", color: "bg-orange-50 text-orange-500 border-orange-200" },
                { score: 3, label: "基本记得", color: "bg-yellow-50 text-yellow-600 border-yellow-200" },
                { score: 4, label: "记得清楚", color: "bg-green-50 text-green-600 border-green-200" },
                { score: 5, label: "完全掌握", color: "bg-sage-light text-sage-deep border-sage/30" },
              ].map(({ score, label, color }) => (
                <button
                  key={score}
                  onClick={() => handleRate(score)}
                  disabled={selfRating !== null}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium border transition-all",
                    selfRating === score ? color : "border-border/40 text-ink-light hover:bg-warm-cream",
                    selfRating !== null && selfRating !== score && "opacity-40",
                  )}
                >
                  {score}
                  <span className="block text-[10px] font-normal opacity-70">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Sentence Card
// ═══════════════════════════════════════

function SentenceCard({
  item,
  onResult,
}: {
  item: SessionItem;
  onResult: (itemId: string, sentence: string, score: number) => void;
}) {
  const [sentence, setSentence] = useState(item.userSentence || "");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!sentence.trim()) return;
    setSubmitted(true);
    // Self-score: simple heuristic — longer sentences with the expression get higher scores
    const hasExpression = sentence
      .toLowerCase()
      .includes((item.expression?.english || "").toLowerCase());
    const score = sentence.length > 20 && hasExpression ? 4 : sentence.length > 10 ? 3 : 2;
    onResult(item.id, sentence, score);
  };

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-4">
      {/* Target expression */}
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">用这个表达造句</p>
        <p className="text-lg font-semibold text-sage-deep">{item.expression?.english}</p>
        <p className="text-xs text-ink-light mt-0.5">{item.expression?.chinese}</p>
      </div>

      {/* Sentence input */}
      <div>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          disabled={submitted}
          placeholder="用这个表达写一个句子..."
          rows={3}
          className={cn(
            "w-full px-4 py-3 rounded-xl border text-sm resize-none transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage",
            submitted ? "bg-warm-cream border-border/30" : "border-border/60",
          )}
        />
      </div>

      {/* Submit */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!sentence.trim()}
          className={cn(
            "w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
            sentence.trim()
              ? "bg-sage text-white hover:bg-sage-deep"
              : "bg-warm-cream text-ink-lighter cursor-not-allowed",
          )}
        >
          提交造句
        </button>
      )}

      {/* Submitted feedback */}
      {submitted && (
        <div className="p-4 bg-sage-light/50 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-sage-deep" />
            <span className="text-xs text-sage-deep font-medium">已记录</span>
          </div>
          <p className="text-sm text-ink italic">"{sentence}"</p>
          <p className="text-[11px] text-ink-light">
            评分基于句子长度和表达使用情况自动生成。未来版本将接入 AI 评分。
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Completion Screen
// ═══════════════════════════════════════

function CompletionScreen({
  stats,
  reinforcementCount,
  onReinforce,
  onDone,
}: {
  stats: ReturnType<typeof getSessionStats>;
  reinforcementCount: number;
  onReinforce: () => void;
  onDone: () => void;
}) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-8 text-center space-y-5">
      <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
        <CheckCircle2 size={28} className="text-sage-deep" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink">本轮完成</h3>
        <p className="text-sm text-ink-light mt-1">
          {stats.passed} 个掌握 · {stats.failed} 个需要强化
        </p>
      </div>

      <div className="flex items-center justify-center gap-3">
        {reinforcementCount > 0 && (
          <button
            onClick={onReinforce}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-warm/10 text-accent-warm rounded-xl text-sm font-medium hover:bg-accent-warm/20 transition-colors"
          >
            <RefreshCw size={14} />
            强化 {reinforcementCount} 个困难表达
          </button>
        )}
        <button
          onClick={onDone}
          className="flex items-center gap-2 px-4 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors"
        >
          完成
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main Page
// ═══════════════════════════════════════

export default function EnglishReviewV3() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useTodaySession();
  const updateItem = useUpdateSessionItem();
  const recordLog = useRecordPracticeLog();
  const submitReview = useSubmitReview();
  const updateStage = useUpdateSessionStage();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [reinforcementRound, setReinforcementRound] = useState(0);
  const [stage, setStage] = useState<"recall" | "sentence">("recall");

  const session = data?.session;
  const allItems = data?.items || [];

  // Current queue: pending/active items for the current stage
  const queue = useMemo(() => {
    if (stage === "recall") {
      return allItems.filter(
        (i) =>
          i.status === "pending" ||
          i.status === "reinforcement" ||
          (i.status === "failed" && reinforcementRound < 3),
      );
    }
    if (stage === "sentence") {
      return allItems.filter(
        (i) =>
          i.status === "passed" ||
          i.status === "completed" ||
          (i.recallScore !== null && i.sentenceScore === null),
      );
    }
    return allItems;
  }, [allItems, stage, reinforcementRound]);

  const stats = getSessionStats(allItems);
  const reinforcementItems = getReinforcementItems(allItems);

  const currentItem = queue[currentIndex] || null;
  const isSessionComplete = currentIndex >= queue.length && queue.length > 0;

  // Handle recall result
  const handleRecallResult = useCallback(
    async (itemId: string, passed: boolean, score: number) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item) return;

      const newStatus = passed ? "passed" : "failed";
      const newAttemptCount = item.attemptCount + 1;

      // Update session item
      await updateItem.mutateAsync({
        itemId,
        updates: {
          recallScore: score,
          status: newStatus,
          attemptCount: newAttemptCount,
          reinforcementRound,
        },
      });

      // Record practice log
      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "recall",
        score,
        sessionId: session?.id,
      });

      // Also submit SRS review
      const rating = score >= 4 ? "good" : score >= 3 ? "hard" : "again";
      submitReview.mutate({
        expressionId: item.expressionId,
        rating: rating as "again" | "hard" | "good" | "easy",
        reviewMode: "active_recall",
      });

      // Advance
      if (currentIndex >= queue.length - 1) {
        setRoundComplete(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [allItems, currentIndex, queue.length, reinforcementRound, updateItem, recordLog, session?.id, submitReview],
  );

  // Handle sentence result
  const handleSentenceResult = useCallback(
    async (itemId: string, sentence: string, score: number) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item) return;

      await updateItem.mutateAsync({
        itemId,
        updates: {
          sentenceScore: score,
          userSentence: sentence,
          status: "completed",
          attemptCount: item.attemptCount + 1,
        },
      });

      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "sentence",
        answer: sentence,
        score,
        sessionId: session?.id,
      });

      if (currentIndex >= queue.length - 1) {
        setRoundComplete(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [allItems, currentIndex, queue.length, updateItem, recordLog, session?.id],
  );

  // Start reinforcement
  const handleReinforce = useCallback(async () => {
    // Mark failed items as "reinforcement"
    await Promise.all(
      reinforcementItems.map((item) =>
        updateItem.mutateAsync({
          itemId: item.id,
          updates: {
            status: "reinforcement",
            reinforcementRound: reinforcementRound + 1,
          },
        }),
      ),
    );
    setReinforcementRound((r) => r + 1);
    setCurrentIndex(0);
    setRoundComplete(false);
  }, [reinforcementItems, reinforcementRound, updateItem]);

  // Advance to sentence stage
  const handleAdvanceStage = useCallback(async () => {
    setStage("sentence");
    setCurrentIndex(0);
    setRoundComplete(false);
    if (session?.id) {
      await updateStage.mutateAsync({ sessionId: session.id, stage: "sentence" });
    }
  }, [session?.id, updateStage]);

  // Done
  const handleDone = useCallback(async () => {
    if (session?.id) {
      await updateStage.mutateAsync({ sessionId: session.id, stage, status: "completed" });
    }
    navigate("/english");
  }, [session?.id, stage, updateStage, navigate]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-sage mx-auto" />
          <p className="text-sm text-ink-light">加载今日复习任务…</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle size={32} className="text-accent-warm mx-auto" />
          <p className="text-sm text-ink">会话加载失败</p>
          <p className="text-xs text-ink-light">
            {error instanceof Error ? error.message : "请稍后重试"}
          </p>
        </div>
      </div>
    );
  }

  // ── Empty state (no due cards) ──
  if (allItems.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-sage-deep" />
        </div>
        <div>
          <h3 className="font-semibold text-ink">今日无事</h3>
          <p className="text-sm text-ink-light mt-1">所有表达都在正确的复习间隔中</p>
        </div>
        <button
          onClick={() => navigate("/english")}
          className="px-4 py-2 text-sm text-sage-deep font-medium hover:text-sage transition-colors"
        >
          返回 English OS
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <SessionHeader
        stats={stats}
        currentStage={stage}
        reinforcementRound={reinforcementRound}
        onAdvanceStage={handleAdvanceStage}
        hasReinforcement={reinforcementItems.length > 0}
      />

      {/* Main content */}
      {roundComplete || isSessionComplete ? (
        <CompletionScreen
          stats={stats}
          reinforcementCount={reinforcementItems.length}
          onReinforce={handleReinforce}
          onDone={handleDone}
        />
      ) : currentItem ? (
        <div className="space-y-3">
          {/* Progress indicator */}
          <div className="text-center text-xs text-ink-light">
            {currentIndex + 1} / {queue.length}
            {reinforcementRound > 0 && ` · 强化第${reinforcementRound + 1}轮`}
          </div>

          {/* Card */}
          {stage === "recall" ? (
            <RecallCard item={currentItem} onResult={handleRecallResult} />
          ) : (
            <SentenceCard item={currentItem} onResult={handleSentenceResult} />
          )}
        </div>
      ) : null}

      {/* Session empty — all items done but no round complete trigger */}
      {queue.length === 0 && !isSessionComplete && (
        <CompletionScreen
          stats={stats}
          reinforcementCount={reinforcementItems.length}
          onReinforce={handleReinforce}
          onDone={handleDone}
        />
      )}

      {/* Quick stats bar at bottom */}
      <div className="flex items-center justify-center gap-4 text-xs text-ink-lighter">
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-sage-deep" />
          掌握 {stats.passed}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent-warm" />
          困难 {stats.failed}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-ink-lighter/30" />
          待练 {stats.pending}
        </span>
      </div>
    </div>
  );
}
