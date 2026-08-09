// ============================================
// English SRS V3.2 — Daily Review Session
//
// Immutable Daily Set of 15 expressions.
// 3-round training: Recall → Cloze → Sentence.
// SRS updated only on Round 1.
// ============================================

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useTodaySession,
  useUpdateSessionItem,
  useRecordPracticeLog,
  useUpdateSessionStage,
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
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  Brain,
  Pencil,
  MessageCircle,
  Lightbulb,
  BookOpen,
  Tag,
  TrendingUp,
  Target,
} from "lucide-react";

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════

const ROUND_LABELS: Record<number, string> = {
  1: "主动回忆",
  2: "语境填空",
  3: "个人造句",
};

const ROUND_ICONS: Record<number, typeof Brain> = {
  1: Brain,
  2: Pencil,
  3: MessageCircle,
};

// ═══════════════════════════════════════
// Helpers
// ═══════════════════════════════════════

function buildClozeText(item: SessionItem): string {
  const expr = item.expression;
  const english = expr?.english || "";
  const clozeSaved = expr?.cloze_sentence;
  const example = expr?.example_sentence;

  // Prefer pre-generated cloze_sentence
  if (clozeSaved) return clozeSaved;

  // Try to blank out the expression in the example sentence
  if (example) {
    const escaped = english.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const replaced = example.replace(regex, "_____");
    if (replaced !== example) return replaced;

    // If expression not found in example, blank out a phrase in the middle
    const words = example.split(/\s+/);
    if (words.length >= 6) {
      const start = Math.floor(words.length * 0.3);
      const end = Math.min(words.length, start + 3);
      const parts = [...words];
      for (let i = start; i < end; i++) parts[i] = "_____";
      return parts.join(" ");
    }

    // Fallback: blank out the whole example
    return example;
  }

  // No example at all — blank out the expression itself
  const words = english.split(/\s+/);
  if (words.length >= 2) {
    const mid = Math.floor(words.length / 2);
    const parts = [...words];
    parts[mid] = "_____";
    return parts.join(" ");
  }

  return `_____ (${expr?.chinese || ""})`;
}

// ═══════════════════════════════════════
// Session Header — 3-stage flow indicator
// ═══════════════════════════════════════

function SessionHeader({
  stats,
  currentRound,
  roundOrderLength,
  currentIndex,
  onBack,
}: {
  stats: ReturnType<typeof getSessionStats>;
  currentRound: number;
  roundOrderLength: number;
  currentIndex: number;
  onBack: () => void;
}) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-4 space-y-3">
      {/* Top row: back + title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-warm-cream transition-colors"
          >
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <h3 className="font-semibold text-ink text-sm">
              {ROUND_LABELS[currentRound]}
            </h3>
            <p className="text-[11px] text-ink-light">
              Round {currentRound}/3 · {stats.total} 个表达
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1.5">
          <div className="w-20 h-2 bg-warm-cream rounded-full overflow-hidden">
            <div
              className="h-full bg-sage-deep rounded-full transition-all duration-300"
              style={{
                width: `${roundOrderLength > 0 ? ((currentIndex) / roundOrderLength) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-xs font-medium text-ink-light">
            {Math.min(currentIndex + 1, roundOrderLength)}/{roundOrderLength}
          </span>
        </div>
      </div>

      {/* 3-stage indicator */}
      <div className="flex items-center gap-1.5">
        {[1, 2, 3].map((r) => {
          const Icon = ROUND_ICONS[r];
          const isActive = r === currentRound;
          const isDone = r < currentRound;
          return (
            <div
              key={r}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                isActive && "bg-sage-light text-sage-deep",
                isDone && "bg-warm-cream text-ink-lighter",
                !isActive && !isDone && "bg-warm-cream/50 text-ink-lighter/50",
              )}
            >
              <Icon size={12} />
              <span>{ROUND_LABELS[r]}</span>
              {isDone && <CheckCircle2 size={10} className="text-sage-deep" />}
            </div>
          );
        })}
      </div>

      {/* Overall stats bar */}
      <div className="flex items-center gap-4 text-[11px] text-ink-lighter">
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

// ═══════════════════════════════════════
// Round 1: Active Recall Card
// Shows full expression details after reveal
// ═══════════════════════════════════════

function RecallCard({
  item,
  onResult,
}: {
  item: SessionItem;
  onResult: (itemId: string, score: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [selfRating, setSelfRating] = useState<number | null>(null);
  const expr = item.expression;

  const handleReveal = () => setRevealed(true);

  const handleRate = (rating: number) => {
    setSelfRating(rating);
    setTimeout(() => onResult(item.id, rating), 200);
  };

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      {/* Chinese cue */}
      <div className="text-center">
        <p className="text-[11px] text-ink-lighter mb-1">中文提示</p>
        <p className="text-xl font-bold text-ink">{expr?.chinese}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          {expr?.scene && (
            <span className="text-[10px] bg-ink/5 text-ink-lighter rounded-full px-2 py-0.5">
              {expr.scene}
            </span>
          )}
          {expr?.formality && (
            <span className="text-[10px] bg-sage-light/50 text-sage-deep rounded-full px-2 py-0.5">
              {expr.formality}
            </span>
          )}
        </div>
      </div>

      {/* Reveal button or answer details */}
      {!revealed ? (
        <button
          onClick={handleReveal}
          className="w-full py-3 px-4 bg-sage-light text-sage-deep text-sm font-medium rounded-xl hover:bg-sage-light/70 transition-colors"
        >
          显示答案
        </button>
      ) : (
        <div className="space-y-4">
          {/* English answer + pronunciation */}
          <div className="p-4 bg-warm-cream rounded-xl text-center">
            <p className="text-lg font-bold text-sage-deep">{expr?.english}</p>
            {expr?.pronunciation && (
              <p className="text-xs text-ink-light mt-1">/{expr.pronunciation}/</p>
            )}
          </div>

          {/* English explanation */}
          {expr?.english_explanation && (
            <div className="px-1">
              <p className="text-xs text-ink-light leading-relaxed">
                {expr.english_explanation}
              </p>
            </div>
          )}

          {/* Example sentence */}
          {expr?.example_sentence && (
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter mb-1">例句</p>
              <p className="text-xs text-ink italic leading-relaxed">
                {expr.example_sentence}
              </p>
            </div>
          )}

          {/* Common patterns */}
          {expr?.common_patterns && (
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter mb-1">常见搭配</p>
              <p className="text-xs text-ink font-mono">{expr.common_patterns}</p>
            </div>
          )}

          {/* Usage note */}
          {expr?.usage_note && (
            <div className="flex items-start gap-2 px-1">
              <BookOpen size={13} className="text-ink-lighter shrink-0 mt-0.5" />
              <p className="text-xs text-ink-light">{expr.usage_note}</p>
            </div>
          )}

          {/* Native usage */}
          {expr?.native_usage && (
            <div className="flex items-start gap-2 px-1">
              <MessageCircle size={13} className="text-ink-lighter shrink-0 mt-0.5" />
              <p className="text-xs text-ink-light">{expr.native_usage}</p>
            </div>
          )}

          {/* Context / Situation */}
          {(expr?.context || expr?.situation) && (
            <div className="flex items-center gap-2 px-1">
              <Tag size={12} className="text-ink-lighter shrink-0" />
              <span className="text-[10px] text-ink-lighter">
                {[expr.context, expr.situation].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          {/* Synonyms */}
          {expr?.synonyms && (
            <p className="text-[11px] text-ink-lighter px-1">
              近义表达: <span className="text-ink">{expr.synonyms}</span>
            </p>
          )}

          {/* Common mistakes */}
          {expr?.common_mistakes && (
            <div className="flex items-start gap-2 bg-accent-warm/5 rounded-xl p-3">
              <AlertTriangle size={13} className="text-accent-warm shrink-0 mt-0.5" />
              <p className="text-xs text-accent-warm/90">{expr.common_mistakes}</p>
            </div>
          )}

          {/* Memory tip */}
          {expr?.memory_tip && (
            <div className="flex items-start gap-2 bg-amber-50/50 rounded-xl p-3">
              <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{expr.memory_tip}</p>
            </div>
          )}

          {/* Notes */}
          {expr?.notes && (
            <p className="text-[11px] text-ink-lighter px-1 italic">{expr.notes}</p>
          )}

          {/* Self-rating buttons */}
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
                    selfRating === score
                      ? color
                      : "border-border/40 text-ink-light hover:bg-warm-cream",
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
// Round 2: Cloze Card (fill-in-blank)
// Uses cloze_sentence → example_sentence → fallback
// ═══════════════════════════════════════

function ClozeCard({
  item,
  onResult,
}: {
  item: SessionItem;
  onResult: (itemId: string, passed: boolean) => void;
}) {
  const clozeText = buildClozeText(item);
  const english = item.expression?.english || "";
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    if (!answer.trim()) return;
    const normalized = answer.trim().toLowerCase();
    const engLower = english.toLowerCase();
    // Check if the user's answer contains the expression or key words
    const correct =
      normalized.includes(engLower) ||
      engLower.includes(normalized) ||
      english.split(/\s+/).some((w) => w.length > 3 && normalized.includes(w.toLowerCase()));
    setIsCorrect(correct);
    setSubmitted(true);
    setTimeout(() => onResult(item.id, correct), 300);
  };

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">填空练习 · Round 2</p>
        <p className="text-sm text-ink-light">{item.expression?.chinese}</p>
      </div>

      {!submitted ? (
        <div className="space-y-4">
          <div className="p-4 bg-warm-cream rounded-xl">
            <p className="text-base font-medium text-ink leading-relaxed">{clozeText}</p>
          </div>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="填入缺少的单词..."
            className="w-full px-4 py-3 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim()}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
              answer.trim()
                ? "bg-sage text-white hover:bg-sage-deep"
                : "bg-warm-cream text-ink-lighter cursor-not-allowed",
            )}
          >
            确认
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl",
              isCorrect ? "bg-sage-light/50" : "bg-accent-warm/10",
            )}
          >
            {isCorrect ? (
              <CheckCircle2 size={16} className="text-sage-deep" />
            ) : (
              <XCircle size={16} className="text-accent-warm" />
            )}
            <span className={cn("text-sm font-medium", isCorrect ? "text-sage-deep" : "text-accent-warm")}>
              {isCorrect ? "正确!" : `正确答案: ${english}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Round 3: Personal Sentence Card
// ═══════════════════════════════════════

function SentenceCard({
  item,
  onResult,
}: {
  item: SessionItem;
  onResult: (itemId: string, sentence: string) => void;
}) {
  const [sentence, setSentence] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!sentence.trim()) return;
    setSubmitted(true);
    onResult(item.id, sentence);
  };

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">用这个表达造句 · Round 3</p>
        <p className="text-lg font-semibold text-sage-deep">{item.expression?.english}</p>
        <p className="text-xs text-ink-light mt-0.5">{item.expression?.chinese}</p>
      </div>

      {!submitted ? (
        <>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="结合你的实际场景，用这个表达写一个句子..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border/60 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
          />
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
        </>
      ) : (
        <div className="p-4 bg-sage-light/50 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-sage-deep" />
            <span className="text-xs text-sage-deep font-medium">已记录</span>
          </div>
          <p className="text-sm text-ink italic">"{sentence}"</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Round Complete Screen
// ═══════════════════════════════════════

function RoundCompleteScreen({
  round,
  totalInRound,
  passedInRound,
  failedInRound,
  onContinue,
  onDone,
}: {
  round: number;
  totalInRound: number;
  passedInRound: number;
  failedInRound: number;
  onContinue: () => void;
  onDone: () => void;
}) {
  const isFinal = round >= 3 || failedInRound === 0;

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-8 text-center space-y-5">
      <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
        <CheckCircle2 size={28} className="text-sage-deep" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink">
          {ROUND_LABELS[round]} 完成
        </h3>
        <p className="text-sm text-ink-light mt-1">
          {totalInRound} 个表达 · {passedInRound} 个通过 · {failedInRound} 个困难
        </p>
      </div>

      {!isFinal && failedInRound > 0 && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-accent-warm">
          <RefreshCw size={12} />
          <span>{failedInRound} 个困难表达进入下一轮强化</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {isFinal ? (
          <button
            onClick={onDone}
            className="flex items-center gap-2 px-5 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors"
          >
            <TrendingUp size={14} />
            完成复习
            <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-5 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors"
          >
            进入 {ROUND_LABELS[round + 1]}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Final Completion Screen
// ═══════════════════════════════════════

function FinalScreen({
  stats,
  onDone,
}: {
  stats: ReturnType<typeof getSessionStats>;
  onDone: () => void;
}) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-8 text-center space-y-5">
      <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
        <Target size={28} className="text-sage-deep" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink">今日复习完成</h3>
        <p className="text-sm text-ink-light mt-1">
          所有表达已完成全部 3 轮练习
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-sage-light/50 rounded-xl p-3">
          <p className="text-xl font-bold text-sage-deep">{stats.passed}</p>
          <p className="text-[10px] text-ink-lighter">已掌握</p>
        </div>
        <div className="bg-accent-warm/10 rounded-xl p-3">
          <p className="text-xl font-bold text-accent-warm">{stats.failed}</p>
          <p className="text-[10px] text-ink-lighter">需继续</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xl font-bold text-blue-500">{stats.total}</p>
          <p className="text-[10px] text-ink-lighter">总计</p>
        </div>
      </div>

      <button
        onClick={onDone}
        className="flex items-center gap-2 px-5 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors mx-auto"
      >
        返回 English OS
        <ChevronRight size={14} />
      </button>
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

  // ── Round state ──
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [roundOrder, setRoundOrder] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [roundStats, setRoundStats] = useState({ passed: 0, failed: 0 });

  const session = data?.session;
  const allItems = data?.items || [];

  // ── Derive round order when round changes or items load ──
  useEffect(() => {
    if (allItems.length === 0) return;
    if (sessionComplete) return;

    let order: string[];
    if (round === 1) {
      // Round 1: all items in the session
      order = allItems.filter((i) => i.status === "pending").map((i) => i.id);
      if (order.length === 0) {
        // All items already processed — session is stale, skip
        setSessionComplete(true);
        return;
      }
    } else if (round === 2) {
      // Round 2: items that failed Round 1 (recall_score < 3)
      order = allItems
        .filter((i) => i.recallScore !== null && i.recallScore < 3 && i.status !== "completed")
        .map((i) => i.id);
    } else {
      // Round 3: items still failed after Round 2
      order = allItems
        .filter((i) => i.status === "failed" && (i.reinforcementRound || 0) >= 2)
        .map((i) => i.id);
    }

    setRoundOrder(order);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setRoundComplete(false);
  }, [round, allItems, sessionComplete]);

  const currentItemId = roundOrder[currentIndex] || null;
  const currentItem = allItems.find((i) => i.id === currentItemId) || null;
  const stats = getSessionStats(allItems);

  // ── Round 1: Active Recall handler ──
  const handleRecallResult = useCallback(
    async (itemId: string, score: number) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      const passed = score >= 3;
      const newStatus = passed ? "passed" : "failed";

      // Update session item
      await updateItem.mutateAsync({
        itemId,
        updates: {
          recallScore: score,
          status: newStatus,
          attemptCount: item.attemptCount + 1,
          reinforcementRound: 0,
        },
      });

      // Record practice log
      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "recall",
        score,
        sessionId: session.id,
      });

      // SRS update (Round 1 only)
      // Failed-but-reinforced items capped at "hard" (not "again")
      const srsRating =
        score >= 4 ? "good" : score >= 3 ? "hard" : "hard";
      submitReview.mutate({
        expressionId: item.expressionId,
        rating: srsRating as "again" | "hard" | "good" | "easy",
        reviewMode: "active_recall",
      });

      // Track round stats
      setRoundStats((prev) => ({
        passed: prev.passed + (passed ? 1 : 0),
        failed: prev.failed + (passed ? 0 : 1),
      }));

      // Advance using ref (avoid stale closure)
      const nextIdx = currentIndexRef.current + 1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
    },
    [allItems, session, updateItem, recordLog, submitReview],
  );

  // ── Round 2: Cloze handler (no SRS update) ──
  const handleClozeResult = useCallback(
    async (itemId: string, passed: boolean) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      const newStatus = passed ? "passed" : "failed";

      await updateItem.mutateAsync({
        itemId,
        updates: {
          status: newStatus,
          attemptCount: item.attemptCount + 1,
          reinforcementRound: 2,
        },
      });

      // Log only — NO SRS update in Round 2
      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "cloze",
        score: passed ? 4 : 2,
        sessionId: session.id,
      });

      setRoundStats((prev) => ({
        passed: prev.passed + (passed ? 1 : 0),
        failed: prev.failed + (passed ? 0 : 1),
      }));

      const nextIdx = currentIndexRef.current + 1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
    },
    [allItems, session, updateItem, recordLog],
  );

  // ── Round 3: Sentence handler (no SRS update) ──
  const handleSentenceResult = useCallback(
    async (itemId: string, sentence: string) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      await updateItem.mutateAsync({
        itemId,
        updates: {
          userSentence: sentence,
          sentenceScore: 3,
          status: "completed",
          attemptCount: item.attemptCount + 1,
          reinforcementRound: 3,
        },
      });

      // Log only — NO SRS update in Round 3
      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "sentence",
        answer: sentence,
        score: 3,
        sessionId: session.id,
      });

      setRoundStats((prev) => ({
        passed: prev.passed + 1,
        failed: prev.failed,
      }));

      const nextIdx = currentIndexRef.current + 1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
    },
    [allItems, session, updateItem, recordLog],
  );

  // ── Check round completion on index change ──
  useEffect(() => {
    if (roundOrder.length > 0 && currentIndex >= roundOrder.length && !roundComplete) {
      setRoundComplete(true);
    }
  }, [currentIndex, roundOrder.length, roundComplete]);

  // ── Start next round ──
  const handleContinueToNextRound = useCallback(async () => {
    const nextRound = (round + 1) as 1 | 2 | 3;
    setRound(nextRound);
    setRoundStats({ passed: 0, failed: 0 });
    if (session?.id && nextRound === 2) {
      await updateStage.mutateAsync({ sessionId: session.id, stage: "sentence" });
    }
  }, [round, session?.id, updateStage]);

  // ── Done ──
  const handleDone = useCallback(async () => {
    if (session?.id) {
      await updateStage.mutateAsync({
        sessionId: session.id,
        stage: "sentence",
        status: "completed",
      });
    }
    navigate("/english");
  }, [session?.id, updateStage, navigate]);

  const handleBack = useCallback(() => {
    navigate("/english");
  }, [navigate]);

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

  // ── Empty state ──
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
        currentRound={round}
        roundOrderLength={roundOrder.length}
        currentIndex={currentIndex}
        onBack={handleBack}
      />

      {/* Main content */}
      {sessionComplete || (roundComplete && round >= 3) ? (
        <FinalScreen stats={stats} onDone={handleDone} />
      ) : roundComplete ? (
        <RoundCompleteScreen
          round={round}
          totalInRound={roundOrder.length}
          passedInRound={roundStats.passed}
          failedInRound={roundStats.failed}
          onContinue={handleContinueToNextRound}
          onDone={handleDone}
        />
      ) : currentItem ? (
        <div className="space-y-3">
          {/* Card-level progress */}
          <div className="text-center text-xs text-ink-light">
            {currentIndex + 1} / {roundOrder.length}
            {round > 1 && ` · Round ${round}`}
          </div>

          {/* Card — key prop ensures fresh state per item */}
          {round === 1 ? (
            <RecallCard
              key={currentItem.id}
              item={currentItem}
              onResult={handleRecallResult}
            />
          ) : round === 2 ? (
            <ClozeCard
              key={currentItem.id}
              item={currentItem}
              onResult={handleClozeResult}
            />
          ) : (
            <SentenceCard
              key={currentItem.id}
              item={currentItem}
              onResult={handleSentenceResult}
            />
          )}
        </div>
      ) : null}

      {/* Empty round — immediate complete */}
      {roundOrder.length === 0 && !roundComplete && !sessionComplete && (
        <RoundCompleteScreen
          round={round}
          totalInRound={0}
          passedInRound={0}
          failedInRound={0}
          onContinue={handleContinueToNextRound}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
