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
  getDailyReviewProgress,
  type SessionItem,
} from "@/lib/hooks/useReviewSession";
import { useSubmitReview } from "@/lib/hooks/useEnglish";
import { validateClozeResult, buildProgressiveHint } from "@/lib/clozeUtils";
import type { ClozeResult } from "@/lib/clozeUtils";
import { invokeAI } from "@/lib/ai/aiService";
import { generateContextClozeBatch, evaluatePersonalSentence, type PersonalSentenceEvaluation } from "@/lib/ai/englishCoach";
import {
  type ContextClozeCard,
  type ClozeGenerationMaterial,
  type ClozePrepState,
  buildCard,
  buildAIClozeInput,
  buildCardFromAIResponse,
  validateContextClozeCard,
  validateAIData,
  classifyMaterials,
  maskTargetExpression,
} from "@/lib/english/contextCloze";
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
  HelpCircle,
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
  onViewHistory,
}: {
  currentMode: ReviewMode;
  stats: { recall: ModeStats; cloze: ModeStats; sentence: ModeStats };
  onModeChange: (mode: ReviewMode) => void;
  onBack: () => void;
  onViewHistory: () => void;
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
        <button
          onClick={onViewHistory}
          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-ink-lighter hover:text-ink hover:bg-warm-cream transition-colors"
        >
          <TrendingUp size={11} />
          学习历史
        </button>
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
// Cloze Card (V3.4 — ContextClozeCard contract)
//
// V3.4: Every expression has a ContextClozeCard.
// No skip. No auto-incorrect. No "unavailable".
// Card is pre-generated and passed in, not built on-the-fly.
// ═══════════════════════════════════════

function ClozeCard({
  item,
  card,
  onResult,
}: {
  item: SessionItem;
  card: ContextClozeCard;
  onResult: (itemId: string, result: ClozeResult, userAnswer: string, expectedAnswer: string, hintCount: number) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [finalResult, setFinalResult] = useState<ClozeResult | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showRetryButtons, setShowRetryButtons] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const maxHintRef = useRef(0);

  const MAX_ATTEMPTS = 2;
  const MAX_HINT_LEVEL = 3;

  const advanceHint = () => {
    setHintLevel((prev) => {
      const next = prev >= MAX_HINT_LEVEL ? 0 : prev + 1;
      if (next > maxHintRef.current) maxHintRef.current = next;
      return next;
    });
  };

  const handleSubmit = () => {
    if (!answer.trim()) return;

    const result = validateClozeResult(answer, card.accepted_answers, card.answer_form !== card.canonical_expression ? card.answer_form : undefined);
    const nextAttempt = attempt + 1;

    if (result === "correct") {
      setFinalResult("correct");
      setAttempt(nextAttempt);
    } else if (nextAttempt >= MAX_ATTEMPTS) {
      setFinalResult(result);
      setAttempt(nextAttempt);
      setShowRetryButtons(false);
    } else {
      setAttempt(nextAttempt);
      setShowRetryButtons(true);
    }
  };

  const handleRetry = () => {
    setAnswer("");
    setShowRetryButtons(false);
    advanceHint();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleShowAnswer = () => {
    const result = validateClozeResult(answer, card.accepted_answers, card.answer_form !== card.canonical_expression ? card.answer_form : undefined);
    setFinalResult(result);
    setAttempt(attempt + 1);
    setShowRetryButtons(false);
  };

  const handleNext = () => {
    onResult(item.id, finalResult || "incorrect", answer, card.answer_form, maxHintRef.current);
  };

  // Progressive hints from ContextClozeCard
  const getHint = (level: number): string | null => {
    if (level === 0) return null;
    if (level === 1) return card.semantic_hint_zh;
    if (level === 2) return card.form_hint || buildProgressiveHint(card.semantic_hint_zh, card.canonical_expression, 2);
    if (level >= 3) {
      if (card.answer_form !== card.canonical_expression) {
        return `注意时态/语法变化（原形: ${card.canonical_expression}）`;
      }
      return `${card.answer_form.split(/\s+/).length} 个词`;
    }
    return null;
  };

  const currentHint = getHint(hintLevel);

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      {/* Scenario — the contextual anchor */}
      <div className="bg-warm-cream border border-warm-cream/60 rounded-xl p-4">
        <p className="text-[10px] text-ink-lighter mb-1 uppercase tracking-wider">Scenario</p>
        <p className="text-sm text-ink leading-relaxed">{card.scenario_zh}</p>
      </div>

      {/* Masked sentence */}
      <div className="p-4 bg-ink/5 rounded-xl">
        <p className="text-base font-medium text-ink leading-relaxed">{card.sentence_masked}</p>
      </div>

      {/* Input area */}
      {finalResult === null && !showRetryButtons && (
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={attempt === 0 ? "填入缺少的表达..." : "再试一次..."}
            className="w-full px-4 py-3 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />

          {hintLevel > 0 && currentHint && (
            <div className="flex items-start gap-2 bg-amber-50/50 rounded-xl p-3">
              <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{currentHint}</p>
            </div>
          )}

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
            {attempt === 0 ? "确认" : `提交 (${attempt + 1}/${MAX_ATTEMPTS})`}
          </button>
        </div>
      )}

      {/* Retry buttons */}
      {showRetryButtons && (
        <div className="space-y-2">
          <p className="text-xs text-ink-light text-center">不太对，再试一次？</p>
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              className="flex-1 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors"
            >
              重试 Retry
            </button>
            <button
              onClick={handleShowAnswer}
              className="flex-1 py-2.5 bg-warm-cream text-ink rounded-xl text-sm font-medium hover:bg-warm-cream/70 transition-colors"
            >
              显示答案 Show Answer
            </button>
          </div>
        </div>
      )}

      {/* Result display */}
      {finalResult !== null && (
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl",
              finalResult === "correct"
                ? "bg-sage-light/50"
                : finalResult === "partially_correct"
                  ? "bg-amber-50"
                  : "bg-accent-warm/10",
            )}
          >
            {finalResult === "correct" ? (
              <CheckCircle2 size={16} className="text-sage-deep" />
            ) : finalResult === "partially_correct" ? (
              <AlertTriangle size={16} className="text-amber-500" />
            ) : (
              <XCircle size={16} className="text-accent-warm" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                finalResult === "correct"
                  ? "text-sage-deep"
                  : finalResult === "partially_correct"
                    ? "text-amber-600"
                    : "text-accent-warm",
              )}
            >
              {finalResult === "correct"
                ? "正确! Correct!"
                : finalResult === "partially_correct"
                  ? "部分正确 Partially Correct"
                  : "不正确 Incorrect"}
            </span>
          </div>

          {/* Correct feedback */}
          {finalResult === "correct" && (
            <div className="space-y-2">
              <div className="bg-sage-light/30 rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">完整句子</p>
                <p className="text-sm text-ink italic">{card.sentence_full}</p>
              </div>
              <div className="bg-sage-light/20 rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">为什么用它</p>
                <p className="text-xs text-ink-light">{card.explanation_zh}</p>
              </div>
              {card.answer_form !== card.canonical_expression && (
                <p className="text-[11px] text-sage-deep bg-sage-light/30 rounded-lg px-3 py-2">
                  注意: 语境中使用的是 "{card.answer_form}"（原形: {card.canonical_expression}）
                </p>
              )}
            </div>
          )}

          {/* Wrong/partial feedback */}
          {finalResult !== "correct" && (
            <div className="space-y-2">
              <div className="bg-warm-cream rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">你的答案</p>
                <p className="text-sm text-accent-warm">{answer.trim() || "(空)"}</p>
              </div>
              <div className="bg-sage-light/30 rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">正确答案</p>
                <p className="text-sm text-sage-deep font-medium">{card.answer_form}</p>
                {card.answer_form !== card.canonical_expression && (
                  <p className="text-[11px] text-ink-light mt-1">
                    原形: {card.canonical_expression}。这里需要 "{card.answer_form}" 因为语境要求这个语法形式。
                  </p>
                )}
                {finalResult === "partially_correct" && (
                  <p className="text-[11px] text-ink-light mt-1">
                    表达想对了，但语法形式需要匹配语境。
                  </p>
                )}
              </div>
              <div className="bg-sage-light/20 rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">完整句子</p>
                <p className="text-sm text-ink italic">{card.sentence_full}</p>
              </div>
              <div className="bg-sage-light/20 rounded-xl p-3">
                <p className="text-[10px] text-ink-lighter mb-0.5">为什么用它</p>
                <p className="text-xs text-ink-light">{card.explanation_zh}</p>
              </div>
            </div>
          )}

          {/* Expression details toggle */}
          {finalResult !== "correct" && (
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
              <p className="text-sm font-medium text-sage-deep">{card.canonical_expression}</p>
              <p className="text-xs text-ink-light">{item.expression?.chinese}</p>
              {item.expression?.example_sentence && (
                <p className="text-xs text-ink-light italic">{item.expression.example_sentence}</p>
              )}
              {item.expression?.usage_note && (
                <p className="text-xs text-ink-light">{item.expression.usage_note}</p>
              )}
            </div>
          )}

          {/* Manual "继续" button */}
          <button
            onClick={handleNext}
            className="w-full py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors flex items-center justify-center gap-2"
          >
            继续 Next
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Progressive hint toggle */}
      {finalResult === null && !showRetryButtons && (
        <div className="text-center">
          <button
            onClick={advanceHint}
            className={cn(
              "text-[11px] transition-colors flex items-center gap-1 mx-auto",
              hintLevel > 0 ? "text-ink-light" : "text-ink-lighter hover:text-ink-light",
            )}
          >
            <HelpCircle size={11} />
            {hintLevel === 0 ? "需要提示?" : hintLevel === 1 ? "含义" : hintLevel === 2 ? "结构" : hintLevel === 3 ? "语法" : "隐藏提示"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Sentence Card
// ═══════════════════════════════════════

// ── Sentence Card state machine ──
type SentenceStep = "writing" | "analyzing" | "feedback";

function SentenceCard({
  item,
  onSaveSentence,
  onUpdateFeedback,
  onAdvance,
}: {
  item: SessionItem;
  onSaveSentence: (itemId: string, sentence: string) => void;
  onUpdateFeedback: (itemId: string, aiScore: number, aiFeedback: string) => void;
  onAdvance: () => void;
}) {
  const [step, setStep] = useState<SentenceStep>("writing");
  const [sentence, setSentence] = useState("");
  const [evaluation, setEvaluation] = useState<PersonalSentenceEvaluation | null>(null);
  const [evalError, setEvalError] = useState(false);
  const [showChinese, setShowChinese] = useState(false);
  const sentenceRef = useRef(sentence);
  sentenceRef.current = sentence;

  const expr = item.expression;
  const safeContext = [expr?.context, expr?.situation].filter(Boolean).join(" · ") || undefined;

  const handleSubmit = async () => {
    if (!sentence.trim()) return;
    setStep("analyzing");
    setEvalError(false);

    // Step 1: Save sentence immediately (before AI)
    onSaveSentence(item.id, sentence);

    // Step 2: AI evaluation
    try {
      const result = await evaluatePersonalSentence(
        expr?.english || "",
        sentence,
        safeContext,
      );

      if (result.success && result.data) {
        setEvaluation(result.data);
        setStep("feedback");
        const score = deriveSentenceScore(result.data);
        onUpdateFeedback(item.id, score, JSON.stringify(result.data));
      } else {
        setEvalError(true);
        setStep("feedback");
        onUpdateFeedback(item.id, 1, JSON.stringify({ error: "AI unavailable" }));
      }
    } catch {
      setEvalError(true);
      setStep("feedback");
      onUpdateFeedback(item.id, 1, JSON.stringify({ error: "AI unavailable" }));
    }
  };

  const handleRetryAI = async () => {
    setStep("analyzing");
    setEvalError(false);

    try {
      const result = await evaluatePersonalSentence(
        expr?.english || "",
        sentenceRef.current,
        safeContext,
      );

      if (result.success && result.data) {
        setEvaluation(result.data);
        setStep("feedback");
        const score = deriveSentenceScore(result.data);
        onUpdateFeedback(item.id, score, JSON.stringify(result.data));
      } else {
        setEvalError(true);
        setStep("feedback");
      }
    } catch {
      setEvalError(true);
      setStep("feedback");
    }
  };

  const handleModify = () => {
    setStep("writing");
    setEvaluation(null);
    setEvalError(false);
  };

  const handleSaveAndNext = () => {
    onAdvance();
  };

  const handleSkipWithoutFeedback = () => {
    onAdvance();
  };

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-4">
      {/* Expression display — always visible */}
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">Write a sentence using this expression</p>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-sage-deep">{expr?.english}</p>
          <button
            onClick={() => setShowChinese(!showChinese)}
            className="text-[10px] text-ink-lighter hover:text-ink-light transition-colors"
          >
            {showChinese ? expr?.chinese : "Show meaning"}
          </button>
        </div>
        {showChinese && (
          <p className="text-xs text-ink-light mt-0.5">{expr?.chinese}</p>
        )}
      </div>

      {/* Safe context display */}
      {safeContext && (
        <div className="bg-warm-cream border border-warm-cream/60 rounded-xl p-3">
          <p className="text-[10px] text-ink-lighter mb-0.5 uppercase tracking-wider">Context</p>
          <p className="text-xs text-ink leading-relaxed">{safeContext}</p>
        </div>
      )}

      {/* ═══ WRITING state ═══ */}
      {step === "writing" && (
        <>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Write your own sentence using this expression in a real situation..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border/60 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
            autoFocus
          />
          <button
            onClick={handleSubmit}
            disabled={!sentence.trim()}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2",
              sentence.trim()
                ? "bg-sage text-white hover:bg-sage-deep"
                : "bg-warm-cream text-ink-lighter cursor-not-allowed",
            )}
          >
            <Sparkles size={14} />
            提交反馈 Submit for Feedback
          </button>
        </>
      )}

      {/* ═══ ANALYZING state ═══ */}
      {step === "analyzing" && (
        <div className="space-y-4">
          {/* Read-only textarea showing the sentence */}
          <textarea
            value={sentence}
            readOnly
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-sage/30 bg-sage-light/20 text-sm resize-none text-ink"
          />
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 size={20} className="text-sage-deep animate-spin" />
            <p className="text-xs text-ink-light">正在分析你的句子…</p>
          </div>
        </div>
      )}

      {/* ═══ FEEDBACK state ═══ */}
      {step === "feedback" && (
        <div className="space-y-4">
          {/* User's sentence */}
          <div className="bg-warm-cream rounded-xl p-3">
            <p className="text-[10px] text-ink-lighter mb-0.5 uppercase tracking-wider">你的原句</p>
            <p className="text-sm text-ink italic leading-relaxed">"{sentence}"</p>
          </div>

          {/* AI failure fallback */}
          {evalError && !evaluation && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-sage-deep" />
                  <span className="text-xs text-sage-deep font-medium">句子已保存</span>
                </div>
                <p className="text-xs text-ink-light leading-relaxed">
                  AI反馈暂时生成失败。你的句子已经安全保存，可以稍后查看。
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRetryAI}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  重试 AI 分析
                </button>
                <button
                  onClick={handleSkipWithoutFeedback}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-sage text-white hover:bg-sage-deep transition-colors flex items-center justify-center gap-2"
                >
                  下一题
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* AI evaluation result */}
          {evaluation && (
            <div className="space-y-3">
              {/* Grammar */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg",
                evaluation.grammar_correct ? "bg-sage-light/40" : "bg-accent-warm/10",
              )}>
                {evaluation.grammar_correct
                  ? <CheckCircle2 size={14} className="text-sage-deep" />
                  : <AlertTriangle size={14} className="text-accent-warm" />
                }
                <span className={cn(
                  "text-xs font-medium",
                  evaluation.grammar_correct ? "text-sage-deep" : "text-accent-warm",
                )}>
                  {evaluation.grammar_correct ? "语法 ✓ 正确" : "语法 ⚠️ 需要调整"}
                </span>
              </div>

              {/* Usage */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg",
                evaluation.expression_used_correctly ? "bg-sage-light/40" : "bg-amber-50",
              )}>
                {evaluation.expression_used_correctly
                  ? <CheckCircle2 size={14} className="text-sage-deep" />
                  : <AlertTriangle size={14} className="text-amber-500" />
                }
                <span className={cn(
                  "text-xs font-medium",
                  evaluation.expression_used_correctly ? "text-sage-deep" : "text-amber-600",
                )}>
                  {evaluation.expression_used_correctly ? "用法 ✓ 表达使用合适" : "用法 ⚠️ 这个场景不太适合"}
                </span>
              </div>

              {/* Naturalness */}
              <div className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg",
                evaluation.naturalness === "natural" ? "bg-sage-light/40" :
                evaluation.naturalness === "slightly_unnatural" ? "bg-amber-50" :
                "bg-accent-warm/10",
              )}>
                {evaluation.naturalness === "natural"
                  ? <CheckCircle2 size={14} className="text-sage-deep" />
                  : evaluation.naturalness === "slightly_unnatural"
                    ? <AlertTriangle size={14} className="text-amber-500" />
                    : <XCircle size={14} className="text-accent-warm" />
                }
                <span className={cn(
                  "text-xs font-medium",
                  evaluation.naturalness === "natural" ? "text-sage-deep" :
                  evaluation.naturalness === "slightly_unnatural" ? "text-amber-600" :
                  "text-accent-warm",
                )}>
                  自然度 {
                    evaluation.naturalness === "natural" ? "✓ 自然" :
                    evaluation.naturalness === "slightly_unnatural" ? "△ 可以更自然" :
                    evaluation.naturalness === "awkward" ? "⚠️ 不自然" :
                    "✗ 用法不正确"
                  }
                </span>
              </div>

              {/* All-good message */}
              {evaluation.grammar_correct && evaluation.expression_used_correctly && evaluation.naturalness === "natural" && (
                <div className="bg-sage-light/30 rounded-xl p-3">
                  <p className="text-xs text-sage-deep leading-relaxed">
                    这句话已经很好，不需要修改。
                  </p>
                </div>
              )}

              {/* Overall feedback */}
              {evaluation.overall_feedback && (
                <div className="bg-purple-50/50 rounded-xl p-3">
                  <p className="text-[10px] text-purple-500 mb-0.5 uppercase tracking-wider">主要反馈</p>
                  <p className="text-xs text-ink leading-relaxed">{evaluation.overall_feedback}</p>
                </div>
              )}

              {/* Corrected version (only if grammar/usage issues) */}
              {evaluation.corrections && evaluation.corrections.length > 0 && (
                <div className="bg-warm-cream rounded-xl p-3 space-y-2">
                  <p className="text-[10px] text-ink-lighter uppercase tracking-wider">纠正版</p>
                  {evaluation.corrections.map((c, i) => (
                    <div key={i} className="text-xs space-y-1">
                      <p>
                        <span className="text-accent-warm line-through">"{c.original}"</span>
                        {" → "}
                        <span className="text-sage-deep font-medium">"{c.corrected}"</span>
                      </p>
                      {c.explanation && (
                        <p className="text-ink-lighter">{c.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Example usage */}
              {evaluation.example_usage && (
                <div className="bg-sage-light/20 rounded-xl p-3">
                  <p className="text-[10px] text-ink-lighter mb-0.5 uppercase tracking-wider">更自然的说法</p>
                  <p className="text-xs text-ink italic leading-relaxed">{evaluation.example_usage}</p>
                </div>
              )}

              {/* User controls */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleModify}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-warm-cream text-ink hover:bg-warm-cream/70 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  修改一下再试
                </button>
                <button
                  onClick={handleSaveAndNext}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-sage text-white hover:bg-sage-deep transition-colors flex items-center justify-center gap-2"
                >
                  保存并下一题
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sentence score mapping (V3.6) ──

function deriveSentenceScore(result: PersonalSentenceEvaluation): number {
  if (result.expression_used_correctly && result.naturalness === "natural") return 5;
  if (result.expression_used_correctly && result.naturalness === "slightly_unnatural") return 3;
  if (result.expression_used_correctly || result.naturalness === "awkward") return 3;
  if (!result.expression_used_correctly && result.naturalness === "incorrect") return 1;
  if (!result.grammar_correct) return 2;
  return 3;
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

/** Build a deterministic summary from local data when AI is unavailable (PART 10). */
function buildFallbackSummary(
  allItems: SessionItem[],
  _dailySet: Array<Record<string, unknown>>,
  modeCompletion: Record<string, unknown>,
): DailySummaryData {
  const recall = modeCompletion.recall as { completed_count: number; total: number } || { completed_count: 0, total: 0 };
  const cloze = modeCompletion.cloze as { completed_count: number; total: number; correct_count: number } || { completed_count: 0, total: 0, correct_count: 0 };
  const sentence = modeCompletion.sentence as { completed_count: number; total: number } || { completed_count: 0, total: 0 };

  const passedItems = allItems.filter((i) => i.recallScore !== null && i.recallScore >= 3);
  const failedItems = allItems.filter((i) => i.recallScore !== null && i.recallScore < 3);

  // V3.5: Build expression-level data from dailySet
  const exprData = (_dailySet || []) as Array<{
    expression_id?: string;
    english?: string;
    recall?: { completed?: boolean; initial_rating?: number | null; final_status?: string };
    cloze?: { completed?: boolean; correct?: boolean };
    sentence?: { completed?: boolean };
  }>;

  const activatedExpressions = exprData
    .filter((e) => e.recall?.completed && e.cloze?.correct && e.sentence?.completed)
    .map((e) => e.english || "");
  const recallOnlyExpressions = exprData
    .filter((e) => e.recall?.completed && !e.cloze?.completed && !e.sentence?.completed)
    .map((e) => e.english || "");
  const contextWeakExpressions = exprData
    .filter((e) => e.cloze?.completed && !e.cloze?.correct)
    .map((e) => e.english || "");
  const productionWeakExpressions = exprData
    .filter((e) => e.recall?.completed && (e.recall?.initial_rating || 0) < 3)
    .map((e) => e.english || "");

  const totalDone = recall.completed_count + cloze.completed_count + sentence.completed_count;
  const totalPossible = allItems.length * 3;

  return {
    overview: totalDone > 0
      ? `今日完成了 ${totalDone} 次练习（共 ${totalPossible} 次可能），涵盖 ${allItems.length} 个表达。${
          passedItems.length >= allItems.length * 0.7
            ? "主动回忆表现优秀，继续保持！"
            : "建议明天重点复习薄弱表达。"
        }`
      : "今日尚未开始复习。开始你的每日训练吧！",
    completion_summary: `主动回忆 ${recall.completed_count}/${recall.total} · 语境填空 ${cloze.completed_count}/${cloze.total}（正确 ${cloze.correct_count}）· 个人造句 ${sentence.completed_count}/${sentence.total}`,
    recall_analysis: recall.completed_count > 0
      ? {
          summary: `${recall.completed_count} 个表达完成主动回忆，其中 ${passedItems.length} 个掌握，${failedItems.length} 个需要加强。`,
          difficult_expressions: failedItems.slice(0, 5).map((i) => i.expression?.english || "unknown"),
        }
      : undefined,
    cloze_analysis: cloze.completed_count > 0
      ? {
          summary: `${cloze.completed_count} 个表达完成语境填空，正确率 ${cloze.total > 0 ? Math.round((cloze.correct_count / cloze.total) * 100) : 0}%。`,
          common_errors: contextWeakExpressions.slice(0, 5),
        }
      : undefined,
    sentence_analysis: sentence.completed_count > 0
      ? {
          summary: `${sentence.completed_count} 个表达完成个人造句。`,
          good_outputs: allItems.filter((i) => i.userSentence).slice(0, 3).map((i) => i.userSentence || ""),
          needs_improvement: [],
        }
      : undefined,
    activated_expressions: activatedExpressions.slice(0, 5),
    recall_only_expressions: recallOnlyExpressions.slice(0, 5),
    context_weak_expressions: contextWeakExpressions.slice(0, 5),
    production_weak_expressions: productionWeakExpressions.slice(0, 5),
    error_patterns: contextWeakExpressions.length > 0
      ? [{ pattern: "语境理解薄弱", expressions: contextWeakExpressions.slice(0, 3), suggestion: "建议在更多例句中熟悉这些表达的用法" }]
      : undefined,
    strongest_expressions: passedItems.slice(0, 5).map((i) => i.expression?.english || "unknown"),
    weakest_expressions: failedItems.slice(0, 5).map((i) => i.expression?.english || "unknown"),
    tomorrow_focus: failedItems.length > 0
      ? `重点复习：${failedItems.slice(0, 3).map((i) => i.expression?.english).join("、")}。建议在语境中多练习这些表达。`
      : "明天继续巩固今日掌握的表达，保持学习节奏。",
  };
}

interface DailySummaryData {
  overview: string;
  completion_summary: string;
  recall_analysis?: { summary: string; difficult_expressions: string[] };
  cloze_analysis?: { summary: string; common_errors: string[] };
  sentence_analysis?: { summary: string; good_outputs: string[]; needs_improvement: string[] };
  activated_expressions?: string[];
  recall_only_expressions?: string[];
  context_weak_expressions?: string[];
  production_weak_expressions?: string[];
  error_patterns?: Array<{ pattern: string; expressions: string[]; suggestion: string }>;
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

      {/* V3.5: Expression categories */}
      {summary.activated_expressions && summary.activated_expressions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-sage-deep">已全面激活 (3项全部完成)</p>
          <div className="flex flex-wrap gap-1">
            {summary.activated_expressions.map((e, i) => (
              <span key={i} className="text-[10px] bg-sage-light/50 text-sage-deep px-1.5 py-0.5 rounded">{e}</span>
            ))}
          </div>
        </div>
      )}

      {(summary.recall_only_expressions && summary.recall_only_expressions.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-ink-lighter">仅完成回忆 (需填空+造句)</p>
          <div className="flex flex-wrap gap-1">
            {summary.recall_only_expressions.map((e, i) => (
              <span key={i} className="text-[10px] bg-ink/5 text-ink-light px-1.5 py-0.5 rounded">{e}</span>
            ))}
          </div>
        </div>
      )}

      {(summary.context_weak_expressions && summary.context_weak_expressions.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-orange-600">语境薄弱 (填空错误)</p>
          <div className="flex flex-wrap gap-1">
            {summary.context_weak_expressions.map((e, i) => (
              <span key={i} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">{e}</span>
            ))}
          </div>
        </div>
      )}

      {(summary.production_weak_expressions && summary.production_weak_expressions.length > 0) && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-accent-warm">输出薄弱 (主动回忆&lt;3分)</p>
          <div className="flex flex-wrap gap-1">
            {summary.production_weak_expressions.map((e, i) => (
              <span key={i} className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">{e}</span>
            ))}
          </div>
        </div>
      )}

      {/* V3.5: Error patterns */}
      {summary.error_patterns && summary.error_patterns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink">常见错误模式</p>
          {summary.error_patterns.map((ep, i) => (
            <div key={i} className="bg-warm-cream rounded-xl p-3 space-y-1">
              <p className="text-xs text-ink font-medium">{ep.pattern}</p>
              <div className="flex flex-wrap gap-1">
                {ep.expressions.map((e, j) => (
                  <span key={j} className="text-[10px] bg-white text-ink-light px-1.5 py-0.5 rounded border border-border/60">{e}</span>
                ))}
              </div>
              <p className="text-[11px] text-sage-deep">{ep.suggestion}</p>
            </div>
          ))}
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
  const [localClozeResults, setLocalClozeResults] = useState<Map<string, { result: ClozeResult; userAnswer: string }>>(new Map());

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

  // ── V3.4: Cloze preparation state (all cards ready before entering mode) ──
  const [clozePrep, setClozePrep] = useState<ClozePrepState>({
    total: 0,
    prepared: 0,
    cards: new Map(),
    pendingIds: [],
    phase: "loading",
  });
  const clozePrepRef = useRef(clozePrep);
  clozePrepRef.current = clozePrep;
  const generationInFlightRef = useRef(false);
  const generationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cloze preparation effect: runs when entering cloze mode ──
  // V3.5: Dedup via inFlightRef, 45s watchdog timeout, correct expression_id keys.
  useEffect(() => {
    if (mode !== "cloze" || allItems.length === 0) return;

    // Use ref to avoid stale closure issues
    const currentPhase = clozePrepRef.current.phase;
    if (currentPhase === "ready") return;
    if (currentPhase === "generating" && generationInFlightRef.current) return;
    if (generationInFlightRef.current) return;

    const materials: ClozeGenerationMaterial[] = allItems
      .filter((item) => !!item.expression)
      .map((item) => ({
        expression_id: item.expressionId,
        english: item.expression!.english,
        chinese: item.expression!.chinese || "",
        type: item.expression!.type,
        example_sentence: item.expression!.example_sentence,
        usage_note: item.expression!.usage_note,
        native_usage: item.expression!.native_usage,
        context: item.expression!.context,
        situation: item.expression!.situation,
        common_patterns: item.expression!.common_patterns,
        cloze_sentence: item.expression!.cloze_sentence,
        ai_cloze_sentence: item.expression!.ai_cloze_sentence,
      }));

    const { ready: readyMaterials, needsAI } = classifyMaterials(materials);

    // Build L1/L2 cards immediately
    const cards = new Map<string, ContextClozeCard>();
    for (const m of readyMaterials) {
      try {
        const card = buildCard(m);
        cards.set(m.expression_id, card);
      } catch { /* skip invalid */ }
    }

    if (needsAI.length === 0) {
      setClozePrep({
        total: allItems.length,
        prepared: cards.size,
        cards,
        pendingIds: [],
        phase: "ready",
      });
      return;
    }

    // Need AI generation for remaining
    const pendingIds = needsAI.map((m) => m.expression_id);
    generationInFlightRef.current = true;

    setClozePrep({
      total: allItems.length,
      prepared: cards.size,
      cards,
      pendingIds,
      phase: "generating",
    });

    let cancelled = false;

    // 45-second overall preparation watchdog
    generationTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        const snapshot = clozePrepRef.current;
        const stillMissing = materials.filter((m) => !snapshot.cards.has(m.expression_id));
        setClozePrep({
          ...snapshot,
          phase: "error",
          error: stillMissing.length > 0
            ? `准备超时，还有 ${stillMissing.length} 道题未生成，请重试`
            : "准备超时，请重试",
        });
        generationInFlightRef.current = false;
      }
    }, 45_000);

    (async () => {
      const BATCH_SIZE = 10;
      const currentCards = new Map(cards);
      const remaining = [...needsAI];

      try {
        for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch = remaining.slice(i, i + BATCH_SIZE);
          const aiResults = await generateContextClozeBatch(
            batch.map((m) => buildAIClozeInput(m)),
          );

          for (const m of batch) {
            if (cancelled) return;
            // V3.5: Map keyed by expression_id
            const aiData = aiResults.get(m.expression_id);
            if (aiData) {
              const validation = validateAIData(aiData);
              if (validation.valid) {
                try {
                  const card = buildCardFromAIResponse(m, aiData);
                  const cardValidation = validateContextClozeCard(card);
                  if (cardValidation.valid) {
                    currentCards.set(m.expression_id, card);
                  }
                } catch { /* invalid card — will retry below */ }
              }
            }
          }

          // Update progress
          const preparedCount = currentCards.size;
          const stillNeedsAI = needsAI.filter((m) => !currentCards.has(m.expression_id));
          setClozePrep({
            total: allItems.length,
            prepared: preparedCount,
            cards: new Map(currentCards),
            pendingIds: stillNeedsAI.map((m) => m.expression_id),
            phase: "generating",
          });
        }

        // Retry any remaining invalid ones (max 1 retry per item)
        const stillMissing = needsAI.filter((m) => !currentCards.has(m.expression_id));
        if (stillMissing.length > 0 && !cancelled) {
          const retryInputs = stillMissing.map((m) => buildAIClozeInput(m));
          const retryResults = await generateContextClozeBatch(retryInputs);
          for (const m of stillMissing) {
            if (cancelled) return;
            const aiData = retryResults.get(m.expression_id);
            if (aiData) {
              const validation = validateAIData(aiData);
              if (validation.valid) {
                try {
                  const card = buildCardFromAIResponse(m, aiData);
                  const cardValidation = validateContextClozeCard(card);
                  if (cardValidation.valid) {
                    currentCards.set(m.expression_id, card);
                  }
                } catch { /* retry failed */ }
              }
            }
          }
        }

        const finalStillMissing = needsAI.filter((m) => !currentCards.has(m.expression_id));
        setClozePrep({
          total: allItems.length,
          prepared: currentCards.size,
          cards: new Map(currentCards),
          pendingIds: finalStillMissing.map((m) => m.expression_id),
          phase: finalStillMissing.length > 0 ? "error" : "ready",
          error: finalStillMissing.length > 0
            ? `${currentCards.size} / ${allItems.length} 已准备，${finalStillMissing.length} 题生成失败`
            : undefined,
        });

        // Persist cards to session items
        if (!cancelled) {
          for (const item of allItems) {
            const card = currentCards.get(item.expressionId);
            if (card) {
              try {
                await updateItem.mutateAsync({
                  itemId: item.id,
                  updates: {
                    modeData: { cloze: card },
                  },
                });
              } catch { /* persistence failure is non-fatal for practice */ }
            }
          }
        }
      } catch {
        if (!cancelled) {
          setClozePrep((prev) => ({
            total: prev.total,
            prepared: prev.prepared,
            cards: prev.cards,
            pendingIds: prev.pendingIds,
            phase: "error",
            error: "AI 服务暂时不可用，请稍后重试",
          }));
        }
      } finally {
        generationInFlightRef.current = false;
        if (generationTimeoutRef.current) {
          clearTimeout(generationTimeoutRef.current);
          generationTimeoutRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = null;
      }
    };
  }, [mode, allItems]);

  // Also load cards from existing session items (previously persisted)
  useEffect(() => {
    if (mode !== "cloze" || allItems.length === 0) return;
    if (clozePrep.phase !== "loading") return;

    // Check if items already have persisted cloze cards
    const existingCards = new Map<string, ContextClozeCard>();
    for (const item of allItems) {
      const modeData = item.modeData as Record<string, unknown> | null | undefined;
      if (modeData?.cloze) {
        const card = modeData.cloze as ContextClozeCard;
        const validation = validateContextClozeCard(card);
        if (validation.valid) {
          existingCards.set(item.expressionId, card);
        }
      }
    }

    if (existingCards.size === allItems.length) {
      // All cards already persisted — use them directly
      setClozePrep({
        total: allItems.length,
        prepared: allItems.length,
        cards: existingCards,
        pendingIds: [],
        phase: "ready",
      });
    }
    // If not all persisted, the generation effect above will handle it
  }, [mode, allItems, clozePrep.phase]);

  // ── dailySetIds ──
  const dailySetIds = useMemo(() => allItems.map((i) => i.id), [allItems]);

  // ── Cloze eligible IDs from prep state ──
  const clozeEligibleIds = useMemo(() => {
    if (clozePrep.phase !== "ready") return [];
    return allItems
      .filter((item) => clozePrep.cards.has(item.expressionId))
      .map((item) => item.id);
  }, [allItems, clozePrep]);

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
    // For cloze mode, wait until preparation is complete
    if (mode === "cloze" && clozePrep.phase !== "ready") return;

    const order = mode === "cloze" ? [...clozeEligibleIds] : [...dailySetIds];
    if (order.length === 0) {
      initializedRef.current = true;
      return;
    }
    setRoundOrder(order);
    setCurrentIndex(resumeIndex);
    currentIndexRef.current = resumeIndex;
    initializedRef.current = true;
  }, [allItems, dailySetIds, clozeEligibleIds, resumeIndex, mode, clozePrep.phase]);

  // ── Reset initialization when mode changes ──
  useEffect(() => {
    initializedRef.current = false;
    setModeComplete(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    // Reset cloze prep when entering cloze mode
    if (mode === "cloze") {
      setClozePrep({
        total: 0,
        prepared: 0,
        cards: new Map(),
        pendingIds: [],
        phase: "loading",
      });
    }
  }, [mode]);

  const currentItemId = roundOrder[currentIndex] || null;
  const currentItem = allItems.find((i) => i.id === currentItemId) || null;
  const stats = getSessionStats(allItems);

  // ── Compute per-mode stats for display ──
  const recallCompleted = allItems.filter((i) => i.recallScore !== null).length;
  const recallPassed = allItems.filter((i) => i.recallScore !== null && i.recallScore >= 3).length;
  const recallFailed = allItems.filter((i) => i.recallScore !== null && i.recallScore < 3).length;
  const clozeCompleted = localClozeIds.size;
  const clozeCorrect = [...localClozeResults.values()].filter((r) => r.result === "correct").length;
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
    async (itemId: string, result: ClozeResult, userAnswer: string, expectedAnswer: string, hintCount: number) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) {
        // Defensive: advance anyway so user doesn't get stuck
        const nextIdx = currentIndexRef.current + 1;
        currentIndexRef.current = nextIdx;
        setCurrentIndex(nextIdx);
        return;
      }

      try {
        const isCorrect = result === "correct";
        const score = result === "correct" ? 2 : result === "partially_correct" ? 1 : 0;

        recordLog.mutate({
          expressionId: item.expressionId,
          mode: "cloze",
          answer: userAnswer,
          feedback: isCorrect ? undefined : `expected: ${expectedAnswer}${hintCount > 0 ? ` (hints: ${hintCount})` : ""}`,
          score,
          sessionId: session.id,
        });

        setLocalClozeIds((prev) => new Set(prev).add(item.expressionId));
        setLocalClozeResults((prev) => {
          const next = new Map(prev);
          next.set(item.expressionId, { result, userAnswer });
          return next;
        });

        setModeStats((prev) => ({
          ...prev,
          cloze: {
            completed: prev.cloze.completed + 1,
            correct: prev.cloze.correct + (result === "correct" ? 1 : 0),
            incorrect: prev.cloze.incorrect + (result !== "correct" ? 1 : 0),
          },
        }));
      } catch {
        // DB mutation failed — still advance to prevent dead-end
        // User progress is tracked in local state anyway
      }

      const nextIdx = currentIndexRef.current + 1;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);
    },
    [allItems, session, recordLog],
  );

  // ── Sentence handlers (NO SRS, NO auto-advance) ──
  const sentenceStoreRef = useRef<Map<string, string>>(new Map());

  // Save sentence immediately (before AI evaluation)
  const handleSaveSentence = useCallback(
    async (itemId: string, sentence: string) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      sentenceStoreRef.current.set(itemId, sentence);

      // Persist sentence as-is (placeholder feedback until AI returns)
      await updateItem.mutateAsync({
        itemId,
        updates: {
          userSentence: sentence,
          status: "completed",
          attemptCount: item.attemptCount + 1,
        },
      });
    },
    [allItems, session, updateItem],
  );

  // Update with AI feedback (after evaluation completes)
  const handleUpdateFeedback = useCallback(
    async (itemId: string, aiScore: number, aiFeedback: string) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item || !session) return;

      const savedSentence = sentenceStoreRef.current.get(itemId) || item.userSentence || "";

      // Update with AI feedback
      await updateItem.mutateAsync({
        itemId,
        updates: {
          aiFeedback,
          sentenceScore: aiScore,
        },
      });

      // Record practice log
      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "sentence",
        answer: savedSentence,
        feedback: aiFeedback,
        score: aiScore,
        sessionId: session.id,
        metadata: { ai_evaluation: aiFeedback },
      });

      setLocalSentenceIds((prev) => new Set(prev).add(item.expressionId));

      setModeStats((prev) => ({
        ...prev,
        sentence: {
          completed: prev.sentence.completed + 1,
        },
      }));
    },
    [allItems, session, updateItem, recordLog],
  );

  // Advance to next card — only called by explicit user action
  const advanceCard = useCallback(() => {
    const nextIdx = currentIndexRef.current + 1;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
  }, []);

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

  // ── Generate AI summary (with deterministic fallback) ──
  const generateSummary = useCallback(async () => {
    if (!session) return;
    setSummaryGenerating(true);
    setShowSummary(true);

    // V3.5: Use unified progress function (single source of truth)
    const practiceLogs = {
      clozeIds: clozeLogIds,
      sentenceIds: sentenceLogIds,
      clozeResults: localClozeResults,
      sentenceResults: new Map(),
    };
    const progress = getDailyReviewProgress(session.id, allItems, practiceLogs);

    // Build input data for AI from unified progress
    const dailySet = progress.expressions.map((ep) => ({
      expression_id: ep.expressionId,
      english: ep.english,
      chinese: ep.chinese,
      recall: {
        completed: ep.recall.completed,
        initial_rating: ep.recall.score,
        reinforcement_count: ep.recall.reinforcementRound,
        final_status: ep.recall.status,
      },
      cloze: {
        completed: ep.cloze.completed,
        correct: ep.cloze.result === "correct",
        user_answer: ep.cloze.userAnswer,
      },
      sentence: {
        completed: ep.sentence.completed,
        user_sentence: ep.sentence.userSentence,
        ai_feedback: ep.sentence.aiFeedback,
        optimized_sentence: null,
      },
    }));

    const modeCompletion = {
      recall: { completed_count: progress.recallCompleted, total: progress.totalExpressions },
      cloze: { completed_count: progress.clozeCompleted, total: progress.totalExpressions, correct_count: progress.clozeCorrect },
      sentence: { completed_count: progress.sentenceCompleted, total: progress.totalExpressions },
    };

    try {
      const result = await invokeAI<DailySummaryData>("english-coach", {
        action: "summarize_daily_review",
        date: new Date().toISOString().split("T")[0],
        dailySet,
        mode_completion: modeCompletion,
      });

      if (result.success && result.data) {
        setAiSummary(result.data);
        setSummaryGenerating(false);
        return;
      }
    } catch {
      // AI call failed — fall back to deterministic summary
    }

    // ── Deterministic fallback summary (PART 10) ──
    const fallbackSummary = buildFallbackSummary(allItems, dailySet, modeCompletion);
    setAiSummary(fallbackSummary);
    setSummaryGenerating(false);
  }, [session, allItems, clozeLogIds, sentenceLogIds, localClozeResults, recallCompleted, clozeCompleted, clozeCorrect, sentenceCompleted]);

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
    const hasSession = !!session;
    return (
      <div className="text-center py-16 space-y-4">
        <div className={cn(
          "h-14 w-14 rounded-2xl flex items-center justify-center mx-auto",
          hasSession ? "bg-accent-warm/10" : "bg-sage-light",
        )}>
          {hasSession ? (
            <AlertTriangle size={28} className="text-accent-warm" />
          ) : (
            <CheckCircle2 size={28} className="text-sage-deep" />
          )}
        </div>
        <div>
          <h3 className="font-semibold text-ink">
            {hasSession ? "暂无复习卡片" : "今日无事"}
          </h3>
          <p className="text-sm text-ink-light mt-1">
            {hasSession
              ? "当前复习会话没有可用的卡片，请刷新重试。"
              : "所有表达都在正确的复习间隔中"}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {hasSession && (
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-white bg-ink rounded-xl hover:bg-ink/90 transition-colors"
            >
              重新加载
            </button>
          )}
          <button
            onClick={() => navigate("/english")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              hasSession ? "text-ink-light hover:text-ink" : "text-sage-deep hover:text-sage",
            )}
          >
            返回 English OS
          </button>
        </div>
      </div>
    );
  }

  // ── Cloze mode: preparation loading / generating / error states (V3.4) ──
  if (mode === "cloze" && clozePrep.phase !== "ready" && !modeComplete) {
    return (
      <div className="space-y-4">
        <ModeHeader
          currentMode={mode}
          stats={{
            recall: { completed: recallCompleted, total: allItems.length, correct: recallPassed, incorrect: recallFailed },
            cloze: { completed: 0, total: allItems.length, correct: 0, incorrect: 0 },
            sentence: { completed: sentenceCompleted, total: allItems.length },
          }}
          onModeChange={switchMode}
          onBack={handleBack}
          onViewHistory={handleViewHistory}
        />
        <div className="bg-white border border-border/60 rounded-2xl p-8 text-center space-y-4">
          {clozePrep.phase === "error" ? (
            <>
              <div className="h-14 w-14 rounded-2xl bg-accent-warm/10 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-accent-warm" />
              </div>
              <div>
                <h3 className="font-semibold text-ink">语境填空准备失败</h3>
                <p className="text-sm text-ink-light mt-1">
                  {clozePrep.error || "部分题目的语境卡片生成失败，请重试"}
                </p>
              </div>
              <button
                onClick={() => {
                  setClozePrep({
                    total: 0,
                    prepared: 0,
                    cards: new Map(),
                    pendingIds: [],
                    phase: "loading",
                  });
                }}
                className="px-5 py-2.5 bg-sage text-white rounded-xl text-sm font-medium hover:bg-sage-deep transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw size={14} />
                重新生成
              </button>
            </>
          ) : (
            <>
              <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
                <Loader2 size={28} className="text-sage-deep animate-spin" />
              </div>
              <div>
                <h3 className="font-semibold text-ink">正在准备今天的语境练习…</h3>
                <p className="text-sm text-ink-light mt-1">
                  {clozePrep.phase === "generating"
                    ? `已准备 ${clozePrep.prepared} / ${clozePrep.total}`
                    : "正在加载语境卡片…"}
                </p>
              </div>
            </>
          )}
        </div>
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
      total: clozeEligibleIds.length || allItems.length,
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
        onViewHistory={handleViewHistory}
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
              card={clozePrep.cards.get(currentItem.expressionId)!}
              onResult={handleClozeResult}
            />
          ) : (
            <SentenceCard
              key={currentItem.id}
              item={currentItem}
              onSaveSentence={handleSaveSentence}
              onUpdateFeedback={handleUpdateFeedback}
              onAdvance={advanceCard}
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
