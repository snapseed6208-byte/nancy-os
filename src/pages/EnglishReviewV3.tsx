// ============================================
// English SRS V3.3 — Daily Review Session
//
// Three independent training modes via URL param:
//   /english/review?mode=recall|cloze|sentence
//
// All modes share the same Daily Set (15 expressions)
// and the same review_session_id.
// Only recall mode triggers SRS scheduling.
// ============================================

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useLocation, useSearchParams } from "wouter";
import {
  useTodaySession,
  useUpdateSessionItem,
  useRecordPracticeLog,
  useUpdateSessionStage,
  useTodayPracticeLogs,
  getSessionStats,
  type SessionItem,
} from "@/lib/hooks/useReviewSession";
import { useSubmitReview } from "@/lib/hooks/useEnglish";
import { buildClozeQuestion, validateClozeAnswer, hasExpressionLeakage, normalizeClozeAnswer } from "@/lib/clozeUtils";
import { invokeAI } from "@/lib/ai/aiService";
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
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

type ReviewMode = "recall" | "cloze" | "sentence";

const MODE_LABELS: Record<ReviewMode, string> = {
  recall: "主动回忆",
  cloze: "语境填空",
  sentence: "个人造句",
};

const MODE_ICONS: Record<ReviewMode, typeof Brain> = {
  recall: Brain,
  cloze: Pencil,
  sentence: MessageCircle,
};

const MODE_ORDER: ReviewMode[] = ["recall", "cloze", "sentence"];

// ═══════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════

function getSrsRating(score: number): "again" | "hard" | "good" | "easy" {
  if (score >= 4) return "good";
  return "hard";
}

/** Count completed items for a given mode using practice logs + session items */
function countModeCompleted(items: SessionItem[], mode: ReviewMode, clozeLogIds?: Set<string>, sentenceLogIds?: Set<string>): number {
  if (mode === "recall") {
    return items.filter((i) => i.recallScore !== null).length;
  }
  if (mode === "cloze") {
    return clozeLogIds ? clozeLogIds.size : 0;
  }
  if (mode === "sentence") {
    return sentenceLogIds ? sentenceLogIds.size : 0;
  }
  return 0;
}

/** Find the first incomplete item index for a given mode */
function findResumeIndex(
  items: SessionItem[],
  dailySetIds: string[],
  mode: ReviewMode,
  clozeLogIds: Set<string>,
  sentenceLogIds: Set<string>,
): number {
  for (let i = 0; i < dailySetIds.length; i++) {
    const item = items.find((it) => it.id === dailySetIds[i]);
    if (!item) continue;
    if (mode === "recall" && item.recallScore === null) return i;
    if (mode === "cloze" && !clozeLogIds.has(item.expressionId)) return i;
    if (mode === "sentence" && !sentenceLogIds.has(item.expressionId)) return i;
  }
  return dailySetIds.length; // all complete
}

// ═══════════════════════════════════════
// Mode Switcher Header
// ═══════════════════════════════════════

function ModeHeader({
  currentMode,
  stats,
  onModeChange,
  onBack,
}: {
  currentMode: ReviewMode;
  stats: { recall: ModeStats; cloze: ModeStats; sentence: ModeStats };
  onModeChange: (mode: ReviewMode) => void;
  onBack: () => void;
}) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onBack}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-warm-cream transition-colors"
        >
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <h3 className="font-semibold text-ink text-sm">今日复习</h3>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-1">
        {MODE_ORDER.map((mode) => {
          const Icon = MODE_ICONS[mode];
          const isActive = mode === currentMode;
          const s = stats[mode];
          return (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-sage-light text-sage-deep"
                  : "bg-warm-cream/50 text-ink-lighter hover:bg-warm-cream",
              )}
            >
              <Icon size={11} />
              <span>{MODE_LABELS[mode]}</span>
              {s.completed > 0 && (
                <span className="text-[10px] opacity-70">{s.completed}/{s.total}</span>
              )}
              {s.completed === s.total && s.total > 0 && (
                <CheckCircle2 size={9} className="text-sage-deep" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Mode Stats
// ═══════════════════════════════════════

interface ModeStats {
  completed: number;
  total: number;
  correct?: number;
  incorrect?: number;
}

function ModeStatsBar({ mode, stats, currentIndex, roundOrderLength }: {
  mode: ReviewMode;
  stats: ModeStats;
  currentIndex: number;
  roundOrderLength: number;
}) {
  if (mode === "recall") {
    const passed = stats.correct || stats.completed;
    const failed = stats.incorrect || 0;
    const pending = stats.total - passed - failed;
    return (
      <div className="flex items-center gap-4 text-[11px] text-ink-lighter">
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-sage-deep" />
          掌握 {passed}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent-warm" />
          困难 {failed}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-ink-lighter/30" />
          待练 {pending}
        </span>
        <span className="ml-auto text-[10px]">
          {Math.min(currentIndex + 1, roundOrderLength)}/{roundOrderLength}
        </span>
      </div>
    );
  }

  if (mode === "cloze") {
    const correct = stats.correct || 0;
    const incorrect = stats.incorrect || 0;
    const pending = stats.total - correct - incorrect;
    return (
      <div className="flex items-center gap-4 text-[11px] text-ink-lighter">
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-sage-deep" />
          正确 {correct}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-accent-warm" />
          错误 {incorrect}
        </span>
        <span className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-ink-lighter/30" />
          待练 {pending}
        </span>
        <span className="ml-auto text-[10px]">
          {Math.min(currentIndex + 1, roundOrderLength)}/{roundOrderLength}
        </span>
      </div>
    );
  }

  // sentence mode
  const completed = stats.completed;
  const pending = stats.total - completed;
  return (
    <div className="flex items-center gap-4 text-[11px] text-ink-lighter">
      <span className="flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-sage-deep" />
        已完成 {completed}
      </span>
      <span className="flex items-center gap-1">
        <div className="h-2 w-2 rounded-full bg-ink-lighter/30" />
        待练 {pending}
      </span>
      <span className="ml-auto text-[10px]">
        {Math.min(currentIndex + 1, roundOrderLength)}/{roundOrderLength}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════
// Recall Card
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

      {!revealed ? (
        <button
          onClick={handleReveal}
          className="w-full py-3 px-4 bg-sage-light text-sage-deep text-sm font-medium rounded-xl hover:bg-sage-light/70 transition-colors"
        >
          显示答案
        </button>
      ) : (
        <div className="space-y-4">
          <div className="p-4 bg-warm-cream rounded-xl text-center">
            <p className="text-lg font-bold text-sage-deep">{expr?.english}</p>
            {expr?.pronunciation && (
              <p className="text-xs text-ink-light mt-1">/{expr.pronunciation}/</p>
            )}
          </div>

          {expr?.english_explanation && (
            <div className="px-1">
              <p className="text-xs text-ink-light leading-relaxed">{expr.english_explanation}</p>
            </div>
          )}

          {expr?.example_sentence && (
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter mb-1">例句</p>
              <p className="text-xs text-ink italic leading-relaxed">{expr.example_sentence}</p>
            </div>
          )}

          {expr?.common_patterns && (
            <div className="bg-ink/5 rounded-xl p-3">
              <p className="text-[10px] text-ink-lighter mb-1">常见搭配</p>
              <p className="text-xs text-ink font-mono">{expr.common_patterns}</p>
            </div>
          )}

          {expr?.usage_note && (
            <div className="flex items-start gap-2 px-1">
              <BookOpen size={13} className="text-ink-lighter shrink-0 mt-0.5" />
              <p className="text-xs text-ink-light">{expr.usage_note}</p>
            </div>
          )}

          {expr?.native_usage && (
            <div className="flex items-start gap-2 px-1">
              <MessageCircle size={13} className="text-ink-lighter shrink-0 mt-0.5" />
              <p className="text-xs text-ink-light">{expr.native_usage}</p>
            </div>
          )}

          {(expr?.context || expr?.situation) && (
            <div className="flex items-center gap-2 px-1">
              <Tag size={12} className="text-ink-lighter shrink-0" />
              <span className="text-[10px] text-ink-lighter">
                {[expr.context, expr.situation].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          {expr?.synonyms && (
            <p className="text-[11px] text-ink-lighter px-1">
              近义表达: <span className="text-ink">{expr.synonyms}</span>
            </p>
          )}

          {expr?.common_mistakes && (
            <div className="flex items-start gap-2 bg-accent-warm/5 rounded-xl p-3">
              <AlertTriangle size={13} className="text-accent-warm shrink-0 mt-0.5" />
              <p className="text-xs text-accent-warm/90">{expr.common_mistakes}</p>
            </div>
          )}

          {expr?.memory_tip && (
            <div className="flex items-start gap-2 bg-amber-50/50 rounded-xl p-3">
              <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{expr.memory_tip}</p>
            </div>
          )}

          {expr?.notes && (
            <p className="text-[11px] text-ink-lighter px-1 italic">{expr.notes}</p>
          )}

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
// Cloze Card (fixed validation)
// ═══════════════════════════════════════

function ClozeCard({
  item,
  onResult,
}: {
  item: SessionItem;
  onResult: (itemId: string, correct: boolean, userAnswer: string, expectedAnswer: string) => void;
}) {
  const expr = item.expression;
  const english = expr?.english || "";
  const chinese = expr?.chinese || "";

  const question = useMemo(
    () =>
      buildClozeQuestion(
        english,
        chinese,
        expr?.cloze_sentence,
        expr?.example_sentence,
      ),
    [english, chinese, expr?.cloze_sentence, expr?.example_sentence],
  );

  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleSubmit = () => {
    if (!answer.trim()) return;
    const correct = validateClozeAnswer(answer, question.acceptedAnswers);
    setIsCorrect(correct);
    setSubmitted(true);
    setTimeout(
      () => onResult(item.id, correct, answer, question.expectedAnswer),
      correct ? 300 : 800,
    );
  };

  const normalizedUser = normalizeClozeAnswer(answer);

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">语境填空</p>
        <p className="text-sm text-ink-light">{chinese}</p>
      </div>

      {!submitted ? (
        <div className="space-y-4">
          <div className="p-4 bg-warm-cream rounded-xl">
            <p className="text-base font-medium text-ink leading-relaxed">{question.prompt}</p>
          </div>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="填入缺少的内容..."
            className="w-full px-4 py-3 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
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
          {/* Result banner */}
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
              {isCorrect ? "✓ 正确" : "答案不正确"}
            </span>
          </div>

          {/* Show user answer vs correct answer on error */}
          {!isCorrect && (
            <div className="space-y-2">
              <div className="bg-warm-cream rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">你的答案</p>
                <p className="text-sm text-accent-warm">{answer.trim() || "(空)"}</p>
              </div>
              <div className="bg-sage-light/30 rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">正确答案</p>
                <p className="text-sm text-sage-deep font-medium">{question.expectedAnswer}</p>
              </div>
            </div>
          )}

          {/* Expression details */}
          {!isCorrect && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] text-ink-lighter hover:text-ink transition-colors flex items-center gap-1"
            >
              <BookOpen size={11} />
              查看用法
              <span className={cn("transition-transform", showDetails && "rotate-90")}>›</span>
            </button>
          )}

          {showDetails && (
            <div className="space-y-2 bg-warm-cream rounded-xl p-3">
              <p className="text-sm font-medium text-sage-deep">{english}</p>
              <p className="text-xs text-ink-light">{chinese}</p>
              {expr?.example_sentence && (
                <p className="text-xs text-ink-light italic">{expr.example_sentence}</p>
              )}
              {expr?.usage_note && (
                <p className="text-xs text-ink-light">{expr.usage_note}</p>
              )}
            </div>
          )}
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
  onResult: (itemId: string, sentence: string) => void;
}) {
  const [sentence, setSentence] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!sentence.trim()) return;
    setSubmitted(true);
    onResult(item.id, sentence);
  };

  const expr = item.expression;

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">用这个表达造句</p>
        <p className="text-lg font-semibold text-sage-deep">{expr?.english}</p>
        <p className="text-xs text-ink-light mt-0.5">{expr?.chinese}</p>
        {expr?.usage_note && (
          <p className="text-[11px] text-ink-lighter mt-1 italic">{expr.usage_note}</p>
        )}
      </div>

      {!submitted ? (
        <>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="结合你的实际场景，用这个表达写一个句子..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border/60 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
            autoFocus
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
// Mode Complete Screen
// ═══════════════════════════════════════

function ModeCompleteScreen({
  mode,
  stats,
  onSwitchMode,
  onDone,
}: {
  mode: ReviewMode;
  stats: ModeStats;
  onSwitchMode: (mode: ReviewMode) => void;
  onDone: () => void;
}) {
  const nextModes = MODE_ORDER.filter((m) => m !== mode);

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-8 text-center space-y-5">
      <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
        <CheckCircle2 size={28} className="text-sage-deep" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink">
          {MODE_LABELS[mode]} 已完成
        </h3>
        <p className="text-sm text-ink-light mt-1">
          {stats.completed}/{stats.total} 个表达
          {mode === "cloze" && stats.correct !== undefined && (
            <span> · {stats.correct} 正确</span>
          )}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-ink-lighter">切换训练模式</p>
        <div className="flex items-center justify-center gap-2">
          {nextModes.map((m) => {
            const Icon = MODE_ICONS[m];
            return (
              <button
                key={m}
                onClick={() => onSwitchMode(m)}
                className="flex items-center gap-2 px-4 py-2.5 bg-warm-cream text-ink rounded-xl text-sm font-medium hover:bg-warm-cream/70 transition-colors"
              >
                <Icon size={14} />
                {MODE_LABELS[m]}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={onDone}
        className="flex items-center gap-2 px-5 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors mx-auto"
      >
        返回
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════
// All Modes Complete Screen
// ═══════════════════════════════════════

function AllDoneScreen({
  stats,
  onViewHistory,
  onDone,
  onGenerateSummary,
  summaryGenerating,
}: {
  stats: ReturnType<typeof getSessionStats>;
  onViewHistory: () => void;
  onDone: () => void;
  onGenerateSummary: () => void;
  summaryGenerating: boolean;
}) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-8 text-center space-y-5">
      <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
        <Target size={28} className="text-sage-deep" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink">今日所有训练完成</h3>
        <p className="text-sm text-ink-light mt-1">三个训练模式已全部完成</p>
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

      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={onGenerateSummary}
          disabled={summaryGenerating}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          <Sparkles size={14} className={summaryGenerating ? "animate-spin" : ""} />
          {summaryGenerating ? "正在生成..." : "生成今日 AI 总结"}
        </button>
        <button
          onClick={onViewHistory}
          className="flex items-center gap-2 px-5 py-2.5 bg-warm-cream text-ink rounded-xl text-sm font-medium hover:bg-warm-cream/70 transition-colors"
        >
          <TrendingUp size={14} />
          查看学习总结
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-2 px-5 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors"
        >
          返回
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// AI Daily Summary Section
// ═══════════════════════════════════════

interface DailySummaryData {
  overview: string;
  completion_summary: string;
  recall_analysis?: { summary: string; difficult_expressions: string[] };
  cloze_analysis?: { summary: string; common_errors: string[] };
  sentence_analysis?: { summary: string; good_outputs: string[]; needs_improvement: string[] };
  strongest_expressions: string[];
  weakest_expressions: string[];
  tomorrow_focus: string;
}

function AISummaryCard({
  summary,
  onClose,
  onRegenerate,
  regenerating,
}: {
  summary: DailySummaryData;
  onClose: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  return (
    <div className="bg-white border border-purple-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-purple-500" />
          <h3 className="text-sm font-semibold text-ink">AI 今日学习总结</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-[11px] text-purple-500 hover:text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
          >
            {regenerating ? "更新中..." : "更新总结"}
          </button>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-warm-cream transition-colors"
          >
            <X size={14} className="text-ink-light" />
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-purple-50/50 rounded-xl p-4">
        <p className="text-sm text-ink leading-relaxed">{summary.overview}</p>
      </div>

      {/* Completion */}
      <p className="text-xs text-ink-light">{summary.completion_summary}</p>

      {/* Recall analysis */}
      {summary.recall_analysis && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink">主动回忆</p>
          <p className="text-xs text-ink-light">{summary.recall_analysis.summary}</p>
          {summary.recall_analysis.difficult_expressions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {summary.recall_analysis.difficult_expressions.map((e, i) => (
                <span key={i} className="text-[10px] bg-accent-warm/10 text-accent-warm px-1.5 py-0.5 rounded">
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cloze analysis */}
      {summary.cloze_analysis && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink">语境填空</p>
          <p className="text-xs text-ink-light">{summary.cloze_analysis.summary}</p>
          {summary.cloze_analysis.common_errors.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {summary.cloze_analysis.common_errors.map((e, i) => (
                <span key={i} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sentence analysis */}
      {summary.sentence_analysis && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink">个人造句</p>
          <p className="text-xs text-ink-light">{summary.sentence_analysis.summary}</p>
          {summary.sentence_analysis.good_outputs.length > 0 && (
            <div className="space-y-0.5">
              {summary.sentence_analysis.good_outputs.map((s, i) => (
                <p key={i} className="text-xs text-sage-deep italic">"{s}"</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Strongest / Weakest */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-sage-light/30 rounded-xl p-3">
          <p className="text-[10px] text-ink-lighter mb-1">最熟悉</p>
          {summary.strongest_expressions.map((e, i) => (
            <p key={i} className="text-xs text-sage-deep font-medium">{e}</p>
          ))}
        </div>
        <div className="bg-accent-warm/10 rounded-xl p-3">
          <p className="text-[10px] text-ink-lighter mb-1">需要加强</p>
          {summary.weakest_expressions.map((e, i) => (
            <p key={i} className="text-xs text-accent-warm font-medium">{e}</p>
          ))}
        </div>
      </div>

      {/* Tomorrow focus */}
      <div className="bg-ink/5 rounded-xl p-3">
        <p className="text-[10px] text-ink-lighter mb-1">明日重点</p>
        <p className="text-xs text-ink leading-relaxed">{summary.tomorrow_focus}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main Page
// ═══════════════════════════════════════

export default function EnglishReviewV3() {
  const [, navigate] = useLocation();
  const [searchParams] = useSearchParams();

  // ── Read mode from URL ──
  const rawMode = searchParams.get("mode") || "";
  const mode: ReviewMode = ["recall", "cloze", "sentence"].includes(rawMode)
    ? (rawMode as ReviewMode)
    : "recall";

  const { data, isLoading, error } = useTodaySession();
  const updateItem = useUpdateSessionItem();
  const recordLog = useRecordPracticeLog();
  const submitReview = useSubmitReview();
  const updateStage = useUpdateSessionStage();

  const session = data?.session;
  const allItems = data?.items || [];

  // ── Practice logs for mode progress tracking ──
  const { data: practiceLogsData } = useTodayPracticeLogs(session?.id);

  // ── Local progress state (initialized from DB, updated in-session) ──
  const [localClozeIds, setLocalClozeIds] = useState<Set<string>>(new Set());
  const [localSentenceIds, setLocalSentenceIds] = useState<Set<string>>(new Set());
  const [localClozeResults, setLocalClozeResults] = useState<Map<string, { correct: boolean; userAnswer: string }>>(new Map());

  // Initialize local state from practice logs when they load
  useEffect(() => {
    if (practiceLogsData) {
      setLocalClozeIds(practiceLogsData.clozeIds);
      setLocalSentenceIds(practiceLogsData.sentenceIds);
      setLocalClozeResults(practiceLogsData.clozeResults);
    }
  }, [practiceLogsData]);

  const clozeLogIds = localClozeIds;
  const sentenceLogIds = localSentenceIds;

  // ── dailySetIds ──
  const dailySetIds = useMemo(() => allItems.map((i) => i.id), [allItems]);

  // ── Initialize/restore mode progress ──
  const resumeIndex = useMemo(() => {
    if (allItems.length === 0) return 0;
    return findResumeIndex(allItems, dailySetIds, mode, clozeLogIds, sentenceLogIds);
  }, [allItems, dailySetIds, mode, clozeLogIds, sentenceLogIds]);

  // ── Core state ──
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const [modeComplete, setModeComplete] = useState(false);
  const [allModesDone, setAllModesDone] = useState(false);
  const [roundOrder, setRoundOrder] = useState<string[]>([]);
  const initializedRef = useRef(false);

  // ── Mode stats ──
  const [modeStats, setModeStats] = useState({
    recall: { completed: 0, correct: 0, incorrect: 0 },
    cloze: { completed: 0, correct: 0, incorrect: 0 },
    sentence: { completed: 0 },
  });

  // ── AI Summary state ──
  const [aiSummary, setAiSummary] = useState<DailySummaryData | null>(null);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // ── SRS tracking ──
  const [srsSubmitted, setSrsSubmitted] = useState<Set<string>>(new Set());

  // ── Initialize round order and resume position ──
  useEffect(() => {
    if (allItems.length === 0) return;
    if (initializedRef.current) return;

    setRoundOrder([...dailySetIds]);
    setCurrentIndex(resumeIndex);
    currentIndexRef.current = resumeIndex;
    initializedRef.current = true;
  }, [allItems, dailySetIds, resumeIndex]);

  // ── Reset initialization when mode changes ──
  useEffect(() => {
    initializedRef.current = false;
    setModeComplete(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  }, [mode]);

  const currentItemId = roundOrder[currentIndex] || null;
  const currentItem = allItems.find((i) => i.id === currentItemId) || null;
  const stats = getSessionStats(allItems);

  // ── Compute per-mode stats for display ──
  const recallCompleted = allItems.filter((i) => i.recallScore !== null).length;
  const recallPassed = allItems.filter((i) => i.recallScore !== null && i.recallScore >= 3).length;
  const recallFailed = allItems.filter((i) => i.recallScore !== null && i.recallScore < 3).length;
  const clozeCompleted = localClozeIds.size;
  const clozeCorrect = [...localClozeResults.values()].filter((r) => r.correct).length;
  const clozeIncorrect = clozeCompleted - clozeCorrect;
  const sentenceCompleted = localSentenceIds.size;

  // ── Check if all 3 modes are done ──
  const allDone = recallCompleted >= allItems.length &&
    clozeCompleted >= allItems.length &&
    sentenceCompleted >= allItems.length &&
    allItems.length > 0;

  // ── Recall handler (SRS only here) ──
  const handleRecallResult = useCallback(
    async (itemId: string, score: number) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      const passed = score >= 3;

      await updateItem.mutateAsync({
        itemId,
        updates: {
          recallScore: score,
          status: passed ? "passed" : "failed",
          attemptCount: item.attemptCount + 1,
        },
      });

      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "recall",
        score,
        sessionId: session.id,
      });

      // SRS: only on recall mode, first attempt
      if (!srsSubmitted.has(itemId)) {
        const srsRating = getSrsRating(score);
        submitReview.mutate({
          expressionId: item.expressionId,
          rating: srsRating,
          reviewMode: "active_recall",
        });
        setSrsSubmitted((prev) => new Set(prev).add(itemId));
      }

      setModeStats((prev) => ({
        ...prev,
        recall: {
          completed: prev.recall.completed + 1,
          correct: prev.recall.correct + (passed ? 1 : 0),
          incorrect: prev.recall.incorrect + (passed ? 0 : 1),
        },
      }));

      const nextIdx = currentIndexRef.current + 1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
    },
    [allItems, session, updateItem, recordLog, submitReview, srsSubmitted],
  );

  // ── Cloze handler (NO SRS) ──
  const handleClozeResult = useCallback(
    async (itemId: string, correct: boolean, userAnswer: string, expectedAnswer: string) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "cloze",
        answer: userAnswer,
        feedback: correct ? undefined : `expected: ${expectedAnswer}`,
        score: correct ? 1 : 0,
        sessionId: session.id,
      });

      setLocalClozeIds((prev) => new Set(prev).add(item.expressionId));
      setLocalClozeResults((prev) => {
        const next = new Map(prev);
        next.set(item.expressionId, { correct, userAnswer });
        return next;
      });

      setModeStats((prev) => ({
        ...prev,
        cloze: {
          completed: prev.cloze.completed + 1,
          correct: prev.cloze.correct + (correct ? 1 : 0),
          incorrect: prev.cloze.incorrect + (correct ? 0 : 1),
        },
      }));

      const nextIdx = currentIndexRef.current + 1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
    },
    [allItems, session, recordLog],
  );

  // ── Sentence handler (NO SRS) ──
  const handleSentenceResult = useCallback(
    async (itemId: string, sentence: string) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      await updateItem.mutateAsync({
        itemId,
        updates: {
          userSentence: sentence,
          status: "completed",
          attemptCount: item.attemptCount + 1,
        },
      });

      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "sentence",
        answer: sentence,
        score: 1,
        sessionId: session.id,
      });

      setLocalSentenceIds((prev) => new Set(prev).add(item.expressionId));

      setModeStats((prev) => ({
        ...prev,
        sentence: {
          completed: prev.sentence.completed + 1,
        },
      }));

      const nextIdx = currentIndexRef.current + 1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
    },
    [allItems, session, updateItem, recordLog],
  );

  // ── Check mode completion ──
  useEffect(() => {
    if (roundOrder.length > 0 && currentIndex >= roundOrder.length && !modeComplete) {
      setModeComplete(true);
    }
  }, [currentIndex, roundOrder.length, modeComplete]);

  // ── Mode switching ──
  const switchMode = useCallback(
    (newMode: ReviewMode) => {
      navigate(`/english/review?mode=${newMode}`, { replace: true });
    },
    [navigate],
  );

  // ── Generate AI summary ──
  const generateSummary = useCallback(async () => {
    if (!session) return;
    setSummaryGenerating(true);
    setShowSummary(true);

    try {
      // Build summary input data
      const dailySet = allItems.map((item) => ({
        expression_id: item.expressionId,
        english: item.expression?.english || "unknown",
        chinese: item.expression?.chinese || "",
        recall: {
          completed: item.recallScore !== null,
          initial_rating: item.recallScore,
          reinforcement_count: item.reinforcementRound || 0,
          final_status: item.status,
        },
        cloze: {
          completed: clozeLogIds.has(item.expressionId),
          correct: clozeLogIds.has(item.expressionId),
          user_answer: null,
        },
        sentence: {
          completed: sentenceLogIds.has(item.expressionId) || item.userSentence !== null,
          user_sentence: item.userSentence,
          ai_feedback: item.aiFeedback,
          optimized_sentence: null,
        },
      }));

      const modeCompletion = {
        recall: { completed_count: recallCompleted, total: allItems.length },
        cloze: { completed_count: clozeCompleted, total: allItems.length, correct_count: clozeCorrect },
        sentence: { completed_count: sentenceCompleted, total: allItems.length },
      };

      const result = await invokeAI<DailySummaryData>("english-coach", {
        action: "summarize_daily_review",
        date: new Date().toISOString().split("T")[0],
        dailySet,
        mode_completion: modeCompletion,
      });

      if (result.success) {
        setAiSummary(result.data);
      }
    } catch {
      // Silently fail — summary is non-critical
    } finally {
      setSummaryGenerating(false);
    }
  }, [session, allItems, clozeLogIds, sentenceLogIds, recallCompleted, clozeCompleted, clozeCorrect, sentenceCompleted]);

  // ── Navigation ──
  const handleBack = () => navigate("/english");
  const handleViewHistory = () => navigate("/english/history");
  const handleDone = useCallback(async () => {
    if (session?.id) {
      await updateStage.mutateAsync({
        sessionId: session.id,
        stage: "sentence",
        status: allDone ? "completed" : "active",
      });
    }
    navigate("/english");
  }, [session?.id, updateStage, navigate, allDone]);

  // ── Loading / Error / Empty ──
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

  if (error || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle size={32} className="text-accent-warm mx-auto" />
          <p className="text-sm text-ink">会话加载失败</p>
          <p className="text-xs text-ink-light">{error instanceof Error ? error.message : "请稍后重试"}</p>
        </div>
      </div>
    );
  }

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

  // ── Derived display stats ──
  const displayStats = {
    recall: {
      completed: recallCompleted,
      total: allItems.length,
      correct: recallPassed,
      incorrect: recallFailed,
    },
    cloze: {
      completed: clozeCompleted,
      total: allItems.length,
      correct: clozeCorrect,
      incorrect: clozeIncorrect,
    },
    sentence: {
      completed: sentenceCompleted,
      total: allItems.length,
    },
  };

  return (
    <div className="space-y-4">
      <ModeHeader
        currentMode={mode}
        stats={displayStats}
        onModeChange={switchMode}
        onBack={handleBack}
      />

      {/* AI Summary (if shown) */}
      {showSummary && aiSummary && (
        <AISummaryCard
          summary={aiSummary}
          onClose={() => setShowSummary(false)}
          onRegenerate={generateSummary}
          regenerating={summaryGenerating}
        />
      )}

      {/* Summary generation button — always available if at least 1 mode has progress */}
      {(recallCompleted > 0 || clozeCompleted > 0 || sentenceCompleted > 0) && !allDone && (
        <button
          onClick={generateSummary}
          disabled={summaryGenerating}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
        >
          <Sparkles size={14} className={summaryGenerating ? "animate-spin" : ""} />
          {summaryGenerating ? "正在生成..." : "生成今日 AI 总结"}
        </button>
      )}

      {/* Mode stats */}
      <div className="bg-white border border-border/60 rounded-2xl px-4 py-2.5">
        <ModeStatsBar
          mode={mode}
          stats={displayStats[mode]}
          currentIndex={currentIndex}
          roundOrderLength={roundOrder.length}
        />
      </div>

      {/* Content area */}
      {allDone ? (
        <AllDoneScreen
          stats={stats}
          onViewHistory={handleViewHistory}
          onDone={handleDone}
          onGenerateSummary={generateSummary}
          summaryGenerating={summaryGenerating}
        />
      ) : modeComplete ? (
        <ModeCompleteScreen
          mode={mode}
          stats={displayStats[mode]}
          onSwitchMode={switchMode}
          onDone={handleDone}
        />
      ) : currentItem ? (
        <div className="space-y-3">
          <div className="text-center text-xs text-ink-light">
            {currentIndex + 1} / {roundOrder.length}
            {resumeIndex > 0 && currentIndex === resumeIndex && " · 已恢复进度"}
          </div>

          {mode === "recall" ? (
            <RecallCard
              key={currentItem.id}
              item={currentItem}
              onResult={handleRecallResult}
            />
          ) : mode === "cloze" ? (
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
      ) : (
        <ModeCompleteScreen
          mode={mode}
          stats={displayStats[mode]}
          onSwitchMode={switchMode}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
