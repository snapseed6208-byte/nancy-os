// ============================================
// English SRS V4 — Learning Session
//
// 6-step learning flow for new expressions:
//   Understand → Context → Usage → Memory →
//   First Recall → First Production
//
// After completion: expression enters Review cycle.
// ============================================

import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useTodayLearnSession,
  useUpdateSessionItem,
  useRecordPracticeLog,
  type SessionItem,
} from "@/lib/hooks/useReviewSession";
import { supabase } from "@/lib/supabase";
import { scheduleExpressionReview } from "@/lib/srs/expressionSrs";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  BookOpen,
  Lightbulb,
  Tag,
  Brain,
  MessageCircle,
  Sparkles,
  MapPin,
  Link,
  AlertTriangle,
  Zap,
} from "lucide-react";

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

type LearnStep = "understand" | "context" | "usage" | "memory" | "recall" | "production";

const STEP_ORDER: LearnStep[] = ["understand", "context", "usage", "memory", "recall", "production"];

const STEP_LABELS: Record<LearnStep, string> = {
  understand: "理解表达",
  context: "使用场景",
  usage: "用法搭配",
  memory: "记忆技巧",
  recall: "主动回忆",
  production: "个人造句",
};

const STEP_DESCRIPTIONS: Record<LearnStep, string> = {
  understand: "了解这个表达的意思和发音",
  context: "知道在什么场景下使用",
  usage: "学习常见搭配和句型",
  memory: "记住这个表达",
  recall: "看中文说出英文",
  production: "用自己的经历造句",
};

// ═══════════════════════════════════════
// Main Page
// ═══════════════════════════════════════

export default function EnglishLearn() {
  const [, navigate] = useLocation();
  const { data, isLoading, isError } = useTodayLearnSession();
  const updateItem = useUpdateSessionItem();
  const recordLog = useRecordPracticeLog();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<LearnStep>("understand");
  const [recallInput, setRecallInput] = useState("");
  const [recallResult, setRecallResult] = useState<{ score: number; feedback: string } | null>(null);
  const [sentenceInput, setSentenceInput] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completedExpressions, setCompletedExpressions] = useState<Set<string>>(new Set());

  const session = data?.session;
  const items = data?.items || [];

  const currentItem = items.length > 0 ? items[currentIndex] : null;

  // Reset step when changing expression
  useEffect(() => {
    setCurrentStep("understand");
    setRecallInput("");
    setRecallResult(null);
    setSentenceInput("");
  }, [currentIndex]);

  const stepIndex = STEP_ORDER.indexOf(currentStep);

  const goNextStep = useCallback(() => {
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEP_ORDER.length) {
      setCurrentStep(STEP_ORDER[nextIdx]);
    }
  }, [stepIndex]);

  const goPrevStep = useCallback(() => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(STEP_ORDER[prevIdx]);
    }
  }, [stepIndex]);

  const completeExpression = useCallback(async () => {
    if (!currentItem || !session || completing) return;
    setCompleting(true);

    try {
      const recallScore = recallResult?.score ?? 3;

      // 1. Record practice log
      await recordLog.mutateAsync({
        expressionId: currentItem.expressionId,
        mode: "learn",
        answer: recallInput || undefined,
        score: recallScore,
        sessionId: session.id,
        metadata: {
          learn_steps_completed: STEP_ORDER.filter(
            (s) => STEP_ORDER.indexOf(s) <= stepIndex
          ),
          sentence_attempt: sentenceInput || undefined,
        },
      });

      // 2. Update session item
      await updateItem.mutateAsync({
        itemId: currentItem.id,
        updates: {
          status: "completed",
          recallScore,
          userSentence: sentenceInput || undefined,
        },
      });

      // 3. Transition expression to Review cycle
      const rating = recallScore >= 3 ? "good" : "hard";
      const now = new Date();
      const srsResult = scheduleExpressionReview(rating, {
        ease_factor: 2.5,
        repetitions: 0,
        interval_days: 0,
        lapse_count: 0,
        production_count: 0,
        status: "collected",
        next_review_date: null,
      }, now);

      await supabase
        .from("expressions")
        .update({
          status: "review",
          learned_at: now.toISOString(),
          next_review_date: srsResult.next_review_date,
          interval_days: srsResult.interval_days,
          repetitions: srsResult.repetitions,
          ease_factor: srsResult.ease_factor,
          last_reviewed_at: now.toISOString(),
          review_count: 1,
        })
        .eq("id", currentItem.expressionId);

      // Also record expression_reviews for history
      await supabase.from("expression_reviews").insert({
        expression_id: currentItem.expressionId,
        result: rating,
        previous_interval: 0,
        new_interval: srsResult.interval_days,
        review_mode: "learn",
      });

      // Mark completed
      setCompletedExpressions((prev) => new Set(prev).add(currentItem.expressionId));

      // Move to next expression
      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } finally {
      setCompleting(false);
    }
  }, [
    currentItem, session, completing, recallResult, recallInput,
    sentenceInput, stepIndex, currentIndex, items.length,
    recordLog, updateItem,
  ]);

  const handleRecallSubmit = useCallback(() => {
    if (!currentItem || !recallInput.trim()) return;

    const expr = currentItem.expression;
    const userAnswer = recallInput.trim().toLowerCase();
    const correctAnswer = expr?.english?.toLowerCase() || "";

    // Simple fuzzy match
    const similarity = userAnswer === correctAnswer ? 1 : 0;
    const containsKey = correctAnswer.split(" ").some((w: string) => w.length > 2 && userAnswer.includes(w));

    let score: number;
    let feedback: string;

    if (userAnswer === correctAnswer) {
      score = 5;
      feedback = "Perfect! You remembered this expression correctly.";
    } else if (containsKey) {
      score = 3;
      feedback = `Close! The correct answer is: ${expr?.english}. You got part of it right.`;
    } else {
      score = 1;
      feedback = `Not quite. The correct answer is: ${expr?.english}. Keep practicing!`;
    }

    setRecallResult({ score, feedback });
  }, [currentItem, recallInput]);

  // ── No learn session / all done ──

  const allDone = items.length > 0 && completedExpressions.size >= items.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-ink-light" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-ink-light">无法加载学习任务</p>
      </div>
    );
  }

  if (items.length === 0 || allDone) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle2 className="w-12 h-12 text-sage" />
        <p className="text-base font-medium">学习完成!</p>
        <p className="text-sm text-ink-light">
          {completedExpressions.size > 0
            ? `今日学习了 ${completedExpressions.size} 条新表达`
            : "暂无待学习的表达"}
        </p>
        <button
          onClick={() => navigate("/english")}
          className="mt-4 px-6 py-2 bg-ink text-white rounded-xl text-sm"
        >
          返回学习中心
        </button>
      </div>
    );
  }

  if (!currentItem || !currentItem.expression) {
    return null;
  }

  const expr = currentItem.expression;
  const progress = `${currentIndex + 1} / ${items.length}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-light">Learn</p>
          <h1 className="text-lg font-semibold tracking-tight">学习新表达</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-light">
          <span>{progress}</span>
          <button
            onClick={() => navigate("/english")}
            className="text-ink-lighter hover:text-ink text-xs"
          >
            返回
          </button>
        </div>
      </header>

      {/* Step progress */}
      <div className="flex items-center gap-1">
        {STEP_ORDER.map((step, i) => (
          <div key={step} className="flex items-center gap-1 flex-1">
            <button
              className={cn(
                "flex-1 text-[10px] py-1 rounded-full text-center transition-colors",
                i < stepIndex
                  ? "bg-sage-light text-sage-deep"
                  : i === stepIndex
                  ? "bg-ink text-white"
                  : "bg-muted text-ink-lighter",
              )}
              onClick={() => i < stepIndex && setCurrentStep(step)}
            >
              {STEP_LABELS[step]}
            </button>
            {i < STEP_ORDER.length - 1 && (
              <ChevronRight className="w-3 h-3 text-ink-lighter shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step description */}
      <p className="text-xs text-ink-light text-center">
        Step {stepIndex + 1}/6 — {STEP_DESCRIPTIONS[currentStep]}
      </p>

      {/* Step content */}
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4 min-h-[300px]">
        {currentStep === "understand" && (
          <UnderstandStep expression={expr} />
        )}
        {currentStep === "context" && (
          <ContextStep expression={expr} />
        )}
        {currentStep === "usage" && (
          <UsageStep expression={expr} />
        )}
        {currentStep === "memory" && (
          <MemoryStep expression={expr} />
        )}
        {currentStep === "recall" && (
          <RecallStep
            expression={expr}
            input={recallInput}
            onInputChange={setRecallInput}
            result={recallResult}
            onSubmit={handleRecallSubmit}
          />
        )}
        {currentStep === "production" && (
          <ProductionStep
            expression={expr}
            input={sentenceInput}
            onInputChange={setSentenceInput}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrevStep}
          disabled={stepIndex === 0}
          className={cn(
            "flex items-center gap-1 px-4 py-2 rounded-xl text-sm transition-colors",
            stepIndex === 0
              ? "text-ink-lighter cursor-not-allowed"
              : "text-ink hover:bg-muted",
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          上一步
        </button>

        {currentStep === "production" || currentStep === "recall" ? (
          <button
            onClick={completeExpression}
            disabled={completing}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium transition-colors",
              "bg-ink text-white hover:bg-ink/90",
              completing && "opacity-60",
            )}
          >
            {completing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {completing ? "完成中..." : "完成学习"}
          </button>
        ) : (
          <button
            onClick={goNextStep}
            className="flex items-center gap-1 px-6 py-2 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink/90 transition-colors"
          >
            下一步
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        <div className="w-20" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Step Components
// ═══════════════════════════════════════

function ExpressionHeader({ expression }: { expression: NonNullable<SessionItem["expression"]> }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn(
          "text-[10px] rounded-full px-2 py-0.5",
          expression.type === "vocabulary" && "bg-blue-50 text-blue-600",
          expression.type === "chunk" && "bg-amber-50 text-amber-600",
          expression.type === "sentencePattern" && "bg-purple-50 text-purple-600",
          expression.type === "speakingExpression" && "bg-sage-light text-sage-deep",
          expression.type === "sentence" && "bg-rose-50 text-rose-600",
        )}>
          {expression.type}
        </span>
        {expression.formality && (
          <span className="text-[10px] text-ink-lighter">{expression.formality}</span>
        )}
      </div>
      <h2 className="text-xl font-semibold tracking-tight">{expression.english}</h2>
      <p className="text-base text-ink-light">{expression.chinese}</p>
      {expression.pronunciation && (
        <p className="text-sm text-ink-lighter font-mono">{expression.pronunciation}</p>
      )}
    </div>
  );
}

function UnderstandStep({ expression }: { expression: NonNullable<SessionItem["expression"]> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-light">
        <BookOpen className="w-4 h-4" />
        <span>理解这个表达</span>
      </div>
      <ExpressionHeader expression={expression} />
      {expression.english_explanation && (
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">英文释义</p>
          <p className="text-sm text-blue-800">{expression.english_explanation}</p>
        </div>
      )}
      {expression.example_sentence && (
        <div className="bg-muted rounded-xl p-3">
          <p className="text-xs font-medium text-ink-light mb-1">例句</p>
          <p className="text-sm text-ink">{expression.example_sentence}</p>
        </div>
      )}
      {expression.usage_note && (
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-xs font-medium text-amber-700 mb-1">使用说明</p>
          <p className="text-sm text-amber-800">{expression.usage_note}</p>
        </div>
      )}
    </div>
  );
}

function ContextStep({ expression }: { expression: NonNullable<SessionItem["expression"]> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-light">
        <MapPin className="w-4 h-4" />
        <span>使用场景</span>
      </div>
      <ExpressionHeader expression={expression} />
      <div className="grid grid-cols-2 gap-3">
        {expression.scene && (
          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs font-medium text-ink-light mb-1">场景</p>
            <p className="text-sm text-ink">{expression.scene}</p>
          </div>
        )}
        {expression.situation && (
          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs font-medium text-ink-light mb-1">情境</p>
            <p className="text-sm text-ink">{expression.situation}</p>
          </div>
        )}
      </div>
      {expression.context && (
        <div className="bg-sage-light/50 rounded-xl p-3">
          <p className="text-xs font-medium text-sage-deep mb-1">语境说明</p>
          <p className="text-sm text-ink">{expression.context}</p>
        </div>
      )}
      {expression.native_usage && (
        <div className="bg-purple-50 rounded-xl p-3">
          <p className="text-xs font-medium text-purple-700 mb-1">母语者用法</p>
          <p className="text-sm text-purple-800">{expression.native_usage}</p>
        </div>
      )}
    </div>
  );
}

function UsageStep({ expression }: { expression: NonNullable<SessionItem["expression"]> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-light">
        <Link className="w-4 h-4" />
        <span>用法搭配</span>
      </div>
      <ExpressionHeader expression={expression} />
      {expression.common_patterns && (
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">常见句型/搭配</p>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{expression.common_patterns}</p>
        </div>
      )}
      {expression.synonyms && (
        <div className="bg-muted rounded-xl p-3">
          <p className="text-xs font-medium text-ink-light mb-1">近义词</p>
          <p className="text-sm text-ink">{expression.synonyms}</p>
        </div>
      )}
      {expression.example_sentence && (
        <div className="bg-muted rounded-xl p-3">
          <p className="text-xs font-medium text-ink-light mb-1">更多例句</p>
          <p className="text-sm text-ink italic">{expression.example_sentence}</p>
        </div>
      )}
      {!expression.common_patterns && !expression.synonyms && (
        <div className="text-center py-8 text-sm text-ink-lighter">
          <Zap className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p>暂无额外用法信息</p>
          <p className="text-xs mt-1">例句中已包含基本用法</p>
        </div>
      )}
    </div>
  );
}

function MemoryStep({ expression }: { expression: NonNullable<SessionItem["expression"]> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-light">
        <Lightbulb className="w-4 h-4" />
        <span>记忆技巧</span>
      </div>
      <ExpressionHeader expression={expression} />
      {expression.memory_tip && (
        <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-xs font-medium text-amber-700 mb-1">记忆技巧</p>
          <p className="text-sm text-amber-800">{expression.memory_tip}</p>
        </div>
      )}
      {expression.common_mistakes && (
        <div className="bg-rose-50 rounded-xl p-3">
          <p className="text-xs font-medium text-rose-700 mb-1">常见错误</p>
          <p className="text-sm text-rose-800">{expression.common_mistakes}</p>
        </div>
      )}
      {!expression.memory_tip && !expression.common_mistakes && (
        <div className="text-center py-8 text-sm text-ink-lighter">
          <Brain className="w-6 h-6 mx-auto mb-2 opacity-40" />
          <p>暂无记忆技巧</p>
          <p className="text-xs mt-1">多读几遍例句，用联想记忆法记住这个表达</p>
        </div>
      )}
    </div>
  );
}

function RecallStep({
  expression,
  input,
  onInputChange,
  result,
  onSubmit,
}: {
  expression: NonNullable<SessionItem["expression"]>;
  input: string;
  onInputChange: (v: string) => void;
  result: { score: number; feedback: string } | null;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-light">
        <Brain className="w-4 h-4" />
        <span>主动回忆</span>
      </div>
      <div className="text-center space-y-3 py-4">
        <p className="text-xs text-ink-lighter">看中文，写出对应的英文表达</p>
        <p className="text-2xl font-semibold text-ink">{expression.chinese}</p>
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !result && onSubmit()}
        placeholder="输入英文表达..."
        disabled={!!result}
        className={cn(
          "w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2",
          result
            ? result.score >= 4
              ? "border-sage bg-sage-light/20"
              : result.score >= 3
              ? "border-amber-300 bg-amber-50"
              : "border-rose-200 bg-rose-50"
            : "border-border focus:ring-ink/10",
        )}
      />
      {!result && (
        <button
          onClick={onSubmit}
          disabled={!input.trim()}
          className={cn(
            "w-full py-2 rounded-xl text-sm font-medium transition-colors",
            input.trim()
              ? "bg-ink text-white hover:bg-ink/90"
              : "bg-muted text-ink-lighter cursor-not-allowed",
          )}
        >
          <Sparkles className="w-4 h-4 inline mr-1" />
          检查
        </button>
      )}
      {result && (
        <div className={cn(
          "rounded-xl p-3 text-sm",
          result.score >= 4
            ? "bg-sage-light/30 text-sage-deep"
            : result.score >= 3
            ? "bg-amber-50 text-amber-700"
            : "bg-rose-50 text-rose-700",
        )}>
          <p>{result.feedback}</p>
        </div>
      )}
    </div>
  );
}

function ProductionStep({
  expression,
  input,
  onInputChange,
}: {
  expression: NonNullable<SessionItem["expression"]>;
  input: string;
  onInputChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-light">
        <MessageCircle className="w-4 h-4" />
        <span>个人造句（可选）</span>
      </div>
      <ExpressionHeader expression={expression} />
      <p className="text-xs text-ink-lighter">
        用这个表达写一个和自己相关的句子，帮助加深记忆。
      </p>
      <textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder="Write your own sentence using this expression..."
        rows={3}
        className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ink/10 resize-none"
      />
      <p className="text-xs text-ink-lighter">
        可以跳过此步骤，直接点击"完成学习"
      </p>
    </div>
  );
}
