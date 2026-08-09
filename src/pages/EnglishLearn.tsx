// ============================================
// English SRS V4 — Learning Session
//
// 4-stage learning flow per expression:
//   Understand → Context & Usage → Recall → Production
//
// Optional enrichment fields (usage/patterns/memory)
// are modules INSIDE Stage 2 — hidden when absent.
// No "暂无" placeholder pages.
//
// Completion only happens on Stage 4. Recall must be
// checked before completion. Idempotent, resumable.
// ============================================

import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useTodayLearnSession,
  useUpdateSessionItem,
  useRecordPracticeLog,
  useUpdateLearnProgress,
  type SessionItem,
  type LearnStage,
} from "@/lib/hooks/useReviewSession";
import { supabase } from "@/lib/supabase";
import { scheduleExpressionReview } from "@/lib/srs/expressionSrs";
import {
  buildLearningMaterial,
  checkRecallAnswer,
  type LearningMaterial,
} from "@/lib/english/learningMaterial";
import { evaluatePersonalSentence, type PersonalSentenceEvaluation } from "@/lib/ai/englishCoach";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Lightbulb,
  Brain,
  MessageCircle,
  Sparkles,
  MapPin,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

// ═══════════════════════════════════════
// Constants
// ═══════════════════════════════════════

const STAGE_ORDER: LearnStage[] = ["understand", "contextUsage", "recall", "production"];

const STAGE_LABELS: Record<LearnStage, string> = {
  understand: "理解表达",
  contextUsage: "场景与用法",
  recall: "主动回忆",
  production: "个人造句",
};

type RecallPhase = "idle" | "checking" | "result";
type SentencePhase = "writing" | "submitting" | "feedback" | "aiFailed";

interface RecallOutcome {
  result: "correct" | "partial" | "incorrect";
  score: number;
  feedback: string;
}

function sentenceScoreOf(evaluation: PersonalSentenceEvaluation): number {
  if (evaluation.expression_used_correctly && evaluation.naturalness === "natural") return 5;
  if (evaluation.expression_used_correctly && evaluation.naturalness === "slightly_unnatural") return 3;
  if (evaluation.expression_used_correctly || evaluation.naturalness === "awkward") return 3;
  if (!evaluation.expression_used_correctly && evaluation.naturalness === "incorrect") return 1;
  if (!evaluation.grammar_correct) return 2;
  return 3;
}

function isItemFinished(item: SessionItem): boolean {
  if (item.status === "completed") return true;
  const st = item.expression?.status;
  return st === "review" || st === "mastered";
}

// ═══════════════════════════════════════
// Main Page
// ═══════════════════════════════════════

export default function EnglishLearn() {
  const [, navigate] = useLocation();
  const { data, isLoading, isError } = useTodayLearnSession();
  const updateItem = useUpdateSessionItem();
  const recordLog = useRecordPracticeLog();
  const saveProgress = useUpdateLearnProgress();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<LearnStage>("understand");
  const [recallInput, setRecallInput] = useState("");
  const [recallPhase, setRecallPhase] = useState<RecallPhase>("idle");
  const [recallOutcome, setRecallOutcome] = useState<RecallOutcome | null>(null);
  const [sentenceInput, setSentenceInput] = useState("");
  const [sentencePhase, setSentencePhase] = useState<SentencePhase>("writing");
  const [sentenceEvaluation, setSentenceEvaluation] = useState<PersonalSentenceEvaluation | null>(null);
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const session = data?.session;
  const items = data?.items || [];
  const initializedRef = useRef(false);
  const indexRef = useRef(currentIndex);

  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);

  const currentItem = items.length > 0 ? items[currentIndex] : null;
  const expr = currentItem?.expression ?? null;
  const material: LearningMaterial | null = expr ? buildLearningMaterial(expr) : null;

  // ═══ Resume: initialize index + stage from saved progress, skip finished ═══
  useEffect(() => {
    if (!data || data.items.length === 0 || initializedRef.current) return;
    initializedRef.current = true;

    const saved = data.session.learnProgress;
    let idx = 0;
    if (saved && saved.expressionIndex >= 0 && saved.expressionIndex < data.items.length) {
      idx = saved.expressionIndex;
    }
    while (idx < data.items.length && isItemFinished(data.items[idx])) idx++;

    if (idx >= data.items.length) {
      setShowSummary(true);
      return;
    }
    setCurrentIndex(idx);
    if (saved && STAGE_ORDER.includes(saved.stage)) {
      setStage(saved.stage);
    }
  }, [data]);

  const resetExpressionState = useCallback(() => {
    setRecallInput("");
    setRecallPhase("idle");
    setRecallOutcome(null);
    setSentenceInput("");
    setSentencePhase("writing");
    setSentenceEvaluation(null);
    setError(null);
  }, []);

  const persistProgress = useCallback((index: number, s: LearnStage) => {
    if (!session) return;
    saveProgress.mutate({ sessionId: session.id, progress: { expressionIndex: index, stage: s } });
  }, [session, saveProgress]);

  const goToStage = useCallback((s: LearnStage) => {
    setStage(s);
    persistProgress(indexRef.current, s);
  }, [persistProgress]);

  // ═══ Recall check ═══
  const handleRecallCheck = useCallback(() => {
    if (!expr || !recallInput.trim() || recallPhase === "result") return;
    setRecallPhase("checking");

    const result = checkRecallAnswer(recallInput, expr.english);
    const feedback = result === "correct"
      ? "✓ 回忆正确"
      : result === "partial"
      ? `接近了！正确的表达是：${expr.english}`
      : `你的答案：${recallInput.trim()} — 正确的表达是：${expr.english}`;
    const score = result === "correct" ? 5 : result === "partial" ? 3 : 1;

    setRecallOutcome({ result, score, feedback });
    setRecallPhase("result");
  }, [expr, recallInput, recallPhase]);

  const handleRetryRecall = useCallback(() => {
    setRecallPhase("idle");
    setRecallOutcome(null);
  }, []);

  // ═══ Sentence submission (save-before-AI, non-blocking) ═══
  const runSentenceAI = useCallback(async (sentence: string) => {
    if (!expr || !session || !currentItem) return;
    setSentencePhase("submitting");
    try {
      const safeContext = [expr.context, expr.situation, expr.scene].filter(Boolean).join(" · ") || undefined;
      const result = await evaluatePersonalSentence(expr.english, sentence, safeContext);
      if (result.success && result.data) {
        setSentenceEvaluation(result.data);
        setSentencePhase("feedback");
      } else {
        setSentencePhase("aiFailed");
      }
    } catch {
      setSentencePhase("aiFailed");
    }
  }, [expr, session, currentItem]);

  const handleSubmitSentence = useCallback(async () => {
    if (!currentItem || !sentenceInput.trim() || sentencePhase === "submitting") return;
    const sentence = sentenceInput.trim();
    setError(null);

    // 1. Save sentence first (persists even if AI fails)
    try {
      await updateItem.mutateAsync({ itemId: currentItem.id, updates: { userSentence: sentence } });
    } catch {
      setError("句子保存失败，请重试");
      return;
    }

    await runSentenceAI(sentence);
  }, [currentItem, sentenceInput, sentencePhase, updateItem, runSentenceAI]);

  const handleRetryAI = useCallback(() => {
    if (!sentenceInput.trim()) return;
    runSentenceAI(sentenceInput.trim());
  }, [sentenceInput, runSentenceAI]);

  const handleModifySentence = useCallback(() => {
    setSentencePhase("writing");
    setSentenceEvaluation(null);
    setError(null);
  }, []);

  // ═══ Completion (only reachable from Stage 4) ═══
  const initializeSrs = useCallback(async (item: SessionItem, score: number) => {
    const expression = item.expression;
    if (!expression || !session) return;
    // Idempotency guard: only initialize SRS for expressions not yet in review cycle
    if (expression.status !== "collected" && expression.status !== "learning") return;

    const rating = score >= 3 ? "good" : "hard";
    const now = new Date();
    const srs = scheduleExpressionReview(rating, {
      ease_factor: 2.5,
      repetitions: 0,
      interval_days: 0,
      lapse_count: 0,
      production_count: 0,
      status: expression.status,
      next_review_date: null,
    }, now);

    const { error } = await supabase
      .from("expressions")
      .update({
        status: "review",
        learned_at: now.toISOString(),
        next_review_date: srs.next_review_date,
        interval_days: srs.interval_days,
        repetitions: srs.repetitions,
        ease_factor: srs.ease_factor,
        last_reviewed_at: now.toISOString(),
        review_count: 1,
      })
      .eq("id", item.expressionId);
    if (error) throw error;

    const { error: revErr } = await supabase.from("expression_reviews").insert({
      user_id: session.userId, // ← required NOT NULL column (root-cause fix)
      expression_id: item.expressionId,
      result: rating,
      previous_interval: 0,
      new_interval: srs.interval_days,
      review_mode: "learn",
    });
    if (revErr) throw revErr;
  }, [session]);

  const completeCurrent = useCallback(async () => {
    if (!currentItem || !session || completing) return;
    if (completedSet.has(currentItem.expressionId)) return;

    // Hard rule: recall must be checked before completing
    if (recallPhase !== "result" || !recallOutcome) {
      setError("请先完成「主动回忆」检查");
      return;
    }

    setCompleting(true);
    setError(null);

    try {
      const sentence = sentenceInput.trim();

      // 1. Save sentence if provided
      if (sentence) {
        await updateItem.mutateAsync({ itemId: currentItem.id, updates: { userSentence: sentence } });
      }

      // 2. Mark session item completed
      await updateItem.mutateAsync({
        itemId: currentItem.id,
        updates: {
          status: "completed",
          recallScore: recallOutcome.score,
          sentenceScore: sentenceEvaluation ? sentenceScoreOf(sentenceEvaluation) : (sentence ? 1 : null),
        },
      });

      // 3. Practice log
      await recordLog.mutateAsync({
        expressionId: currentItem.expressionId,
        mode: "learn",
        answer: recallInput,
        score: recallOutcome.score,
        sessionId: session.id,
        feedback: recallOutcome.feedback,
        metadata: {
          learn_completed: true,
          learn_stage: "production",
          sentence: sentence || null,
          sentence_feedback: sentenceEvaluation ? JSON.stringify(sentenceEvaluation) : null,
        },
      });

      // 4. SRS initialization (only once, only if not already in review)
      await initializeSrs(currentItem, recallOutcome.score);

      // 5. Mark completed + advance
      setCompletedSet((prev) => new Set(prev).add(currentItem.expressionId));

      if (currentIndex < items.length - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        resetExpressionState();
        setStage("understand");
        persistProgress(nextIdx, "understand");
      } else {
        setShowSummary(true);
        if (session) saveProgress.mutate({ sessionId: session.id, progress: { expressionIndex: 0, stage: "understand" } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误";
      setError(`完成失败：${message}`);
    } finally {
      setCompleting(false);
    }
  }, [
    currentItem, session, completing, completedSet, recallPhase, recallOutcome,
    sentenceInput, sentenceEvaluation, recallInput, currentIndex, items.length,
    updateItem, recordLog, initializeSrs, resetExpressionState, persistProgress, saveProgress,
  ]);

  // ═══ Render: loading / error / summary / empty ═══
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
        <button
          onClick={() => navigate("/english")}
          className="px-5 py-2 rounded-xl text-sm bg-ink text-white"
        >
          返回学习中心
        </button>
      </div>
    );
  }

  if (showSummary) {
    return <LearningSummary items={items} completedSet={completedSet} onBack={() => navigate("/english")} />;
  }

  if (items.length === 0 || !currentItem || !material) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <CheckCircle2 className="w-12 h-12 text-sage" />
        <p className="text-base font-medium">暂无待学习的表达</p>
        <button
          onClick={() => navigate("/english")}
          className="mt-2 px-6 py-2 bg-ink text-white rounded-xl text-sm"
        >
          返回学习中心
        </button>
      </div>
    );
  }

  const stageIndex = STAGE_ORDER.indexOf(stage);
  const progress = `${currentIndex + 1} / ${items.length}`;
  const busy = completing || sentencePhase === "submitting" || recallPhase === "checking";

  return (
    <div className="space-y-4 max-w-2xl mx-auto px-4 pb-24">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs text-ink-light">Learn</p>
          <h1 className="text-lg font-semibold tracking-tight">学习新表达</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-light">
          <span className="font-medium">{progress}</span>
          <button onClick={() => navigate("/english")} className="text-ink-lighter hover:text-ink text-xs">
            返回
          </button>
        </div>
      </header>

      <StageIndicator stageIndex={stageIndex} />

      {error && (
        <div className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 text-xs hover:text-rose-700 shrink-0">关闭</button>
        </div>
      )}

      {/* Stage content */}
      <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-4 min-h-[280px]">
        {stage === "understand" && <UnderstandStage material={material} />}
        {stage === "contextUsage" && <ContextUsageStage material={material} />}
        {stage === "recall" && (
          <RecallStage
            material={material}
            input={recallInput}
            onInputChange={setRecallInput}
            phase={recallPhase}
            outcome={recallOutcome}
            onCheck={handleRecallCheck}
          />
        )}
        {stage === "production" && (
          <ProductionStage
            material={material}
            input={sentenceInput}
            onInputChange={setSentenceInput}
            phase={sentencePhase}
            evaluation={sentenceEvaluation}
            onSubmit={handleSubmitSentence}
            onRetryAI={handleRetryAI}
            onModify={handleModifySentence}
          />
        )}
      </div>

      {/* Navigation */}
      <StageNav
        stage={stage}
        recallPhase={recallPhase}
        busy={busy}
        completing={completing}
        onNext={() => goToStage("contextUsage")}
        onPrev={() => goToStage(STAGE_ORDER[Math.max(0, stageIndex - 1)])}
        onStartRecall={() => goToStage("recall")}
        onRetryRecall={handleRetryRecall}
        onContinueToProduction={() => goToStage("production")}
        onComplete={completeCurrent}
      />
    </div>
  );
}

// ═══════════════════════════════════════
// Stage Indicator
// ═══════════════════════════════════════

function StageIndicator({ stageIndex }: { stageIndex: number }) {
  return (
    <div>
      {/* Desktop: full pills */}
      <div className="hidden sm:flex items-center gap-1">
        {STAGE_ORDER.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <span className={cn(
              "flex-1 text-[11px] py-1.5 rounded-full text-center transition-colors",
              i < stageIndex ? "bg-sage-light text-sage-deep"
              : i === stageIndex ? "bg-ink text-white"
              : "bg-muted text-ink-lighter",
            )}>
              {i < stageIndex ? `✓ ${STAGE_LABELS[s]}` : STAGE_LABELS[s]}
            </span>
            {i < STAGE_ORDER.length - 1 && <ChevronRight className="w-3 h-3 text-ink-lighter shrink-0" />}
          </div>
        ))}
      </div>
      {/* Mobile: compact */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center justify-between text-xs text-ink-light">
          <span className="font-medium">阶段 {stageIndex + 1}/{STAGE_ORDER.length}</span>
          <span>{STAGE_LABELS[STAGE_ORDER[stageIndex]]}</span>
        </div>
        <div className="flex gap-1">
          {STAGE_ORDER.map((s, i) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full", i <= stageIndex ? "bg-ink" : "bg-muted")} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Stage 1: Understand
// ═══════════════════════════════════════

function UnderstandStage({ material }: { material: LearningMaterial }) {
  const { core } = material;
  return (
    <div className="space-y-4">
      <SectionTitle icon={<BookOpen className="w-4 h-4" />} text="理解这个表达" />
      <div className="space-y-2">
        {core.type && <TypeChip type={core.type} formality={core.formality} />}
        <h2 className="text-xl font-semibold tracking-tight">{core.english}</h2>
        <p className="text-base text-ink-light">{core.chinese}</p>
        {core.pronunciation && (
          <p className="text-sm text-ink-lighter font-mono">{core.pronunciation}</p>
        )}
      </div>
      {core.explanation && (
        <InfoBlock tone="blue" title="英文释义" content={core.explanation} />
      )}
      {material.examples.length > 0 && (
        <InfoBlock tone="muted" title="例句" content={material.examples[0]} />
      )}
      {core.notes && <InfoBlock tone="amber" title="Notes" content={core.notes} />}
    </div>
  );
}

// ═══════════════════════════════════════
// Stage 2: Context & Usage (optional modules)
// ═══════════════════════════════════════

function ContextUsageStage({ material }: { material: LearningMaterial }) {
  const hasAny =
    material.examples.length > 0 ||
    material.contexts.length > 0 ||
    material.patterns.length > 0 ||
    material.usageNotes.length > 0 ||
    material.mistakes.length > 0 ||
    material.memoryTip !== null ||
    material.synonyms !== null;

  return (
    <div className="space-y-4">
      <SectionTitle icon={<MapPin className="w-4 h-4" />} text="场景与用法" />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">{material.core.english}</h2>
        <p className="text-sm text-ink-light">{material.core.chinese}</p>
      </div>

      {material.examples.length > 0 && (
        <InfoBlock tone="muted" title="例句" content={material.examples.join("\n")} />
      )}
      {material.contexts.length > 0 && (
        <InfoBlock tone="sage" title="使用场景" content={material.contexts.join("\n")} />
      )}
      {material.patterns.length > 0 && (
        <InfoBlock tone="blue" title="常见句型 / 搭配" content={material.patterns.join("\n")} />
      )}
      {material.usageNotes.length > 0 && (
        <InfoBlock tone="purple" title="用法说明" content={material.usageNotes.join("\n")} />
      )}
      {material.synonyms && (
        <InfoBlock tone="muted" title="近义词" content={material.synonyms} />
      )}
      {material.mistakes.length > 0 && (
        <InfoBlock tone="rose" title="常见错误" content={material.mistakes.join("\n")} />
      )}
      {material.memoryTip && (
        <InfoBlock tone="amber" title="记忆技巧" content={material.memoryTip} />
      )}

      {!hasAny && (
        <p className="text-xs text-ink-lighter pt-1">
          当前资料较精简，先通过例句理解用法即可。
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Stage 3: Active Recall
// ═══════════════════════════════════════

function RecallStage({
  material,
  input,
  onInputChange,
  phase,
  outcome,
  onCheck,
}: {
  material: LearningMaterial;
  input: string;
  onInputChange: (v: string) => void;
  phase: RecallPhase;
  outcome: RecallOutcome | null;
  onCheck: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle icon={<Brain className="w-4 h-4" />} text="主动回忆" />
      <div className="text-center space-y-3 py-3">
        <p className="text-xs text-ink-lighter">看中文，写出对应的英文表达</p>
        <p className="text-2xl font-semibold text-ink">{material.core.chinese}</p>
        {material.contexts.length > 0 && (
          <p className="text-xs text-ink-light max-w-sm mx-auto">{material.contexts[0]}</p>
        )}
      </div>

      {phase === "idle" && (
        <>
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && input.trim() && onCheck()}
            placeholder="输入英文表达..."
            className="w-full px-4 py-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ink/10"
            autoFocus
          />
          <button
            onClick={onCheck}
            disabled={!input.trim()}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
              input.trim() ? "bg-ink text-white hover:bg-ink/90" : "bg-muted text-ink-lighter cursor-not-allowed",
            )}
          >
            <Sparkles className="w-4 h-4 inline mr-1" />
            检查
          </button>
        </>
      )}

      {phase === "checking" && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-ink-light" />
        </div>
      )}

      {phase === "result" && outcome && (
        <div className={cn(
          "rounded-xl p-4 text-sm whitespace-pre-wrap",
          outcome.result === "correct" ? "bg-sage-light/30 text-sage-deep"
          : outcome.result === "partial" ? "bg-amber-50 text-amber-700"
          : "bg-rose-50 text-rose-700",
        )}>
          <p className="font-medium">{outcome.feedback}</p>
          {outcome.result !== "correct" && (
            <p className="mt-2 text-xs opacity-80">正确表达：{material.core.english}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Stage 4: Personal Production
// ═══════════════════════════════════════

function ProductionStage({
  material,
  input,
  onInputChange,
  phase,
  evaluation,
  onSubmit,
  onRetryAI,
  onModify,
}: {
  material: LearningMaterial;
  input: string;
  onInputChange: (v: string) => void;
  phase: SentencePhase;
  evaluation: PersonalSentenceEvaluation | null;
  onSubmit: () => void;
  onRetryAI: () => void;
  onModify: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle icon={<MessageCircle className="w-4 h-4" />} text="个人造句" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{material.core.english}</h2>
        <p className="text-sm text-ink-light">{material.core.chinese}</p>
      </div>
      <p className="text-xs text-ink-lighter">
        用这个表达造一个与你自己有关的句子。
      </p>

      {(phase === "writing" || phase === "submitting") && (
        <>
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Write a sentence using this expression..."
            rows={3}
            disabled={phase === "submitting"}
            className="w-full px-4 py-3 rounded-xl border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ink/10 disabled:opacity-60"
          />
          {phase === "writing" && (
            <button
              onClick={onSubmit}
              disabled={!input.trim()}
              className={cn(
                "w-full py-2.5 rounded-xl text-sm font-medium transition-colors",
                input.trim() ? "bg-ink text-white hover:bg-ink/90" : "bg-muted text-ink-lighter cursor-not-allowed",
              )}
            >
              提交造句
            </button>
          )}
          {phase === "submitting" && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-ink-light">
              <Loader2 className="w-4 h-4 animate-spin" />
              分析中…
            </div>
          )}
        </>
      )}

      {phase === "feedback" && evaluation && <SentenceFeedback evaluation={evaluation} />}

      {phase === "aiFailed" && (
        <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
          句子已保存，AI反馈暂时不可用。
        </div>
      )}

      {(phase === "feedback" || phase === "aiFailed") && (
        <div className="flex gap-2">
          {phase === "feedback" ? (
            <button
              onClick={onModify}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-ink hover:bg-muted transition-colors"
            >
              修改一下
            </button>
          ) : (
            <button
              onClick={onRetryAI}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-ink hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              重试AI反馈
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SentenceFeedback({ evaluation }: { evaluation: PersonalSentenceEvaluation }) {
  const score = sentenceScoreOf(evaluation);
  const good = score >= 4;
  const ok = score >= 3;
  return (
    <div className={cn(
      "rounded-xl p-4 space-y-2",
      good ? "bg-sage-light/30" : ok ? "bg-amber-50" : "bg-rose-50",
    )}>
      <p className={cn(
        "text-sm font-medium",
        good ? "text-sage-deep" : ok ? "text-amber-700" : "text-rose-700",
      )}>
        {good ? "很棒！" : ok ? "不错，可以更自然一些" : "继续加油"}
      </p>
      {evaluation.corrections && evaluation.corrections.length > 0 && (
        <div className="space-y-1">
          {evaluation.corrections.slice(0, 3).map((c, i) => (
            <p key={i} className="text-xs text-ink">
              <span className="line-through text-rose-500">{c.original}</span>
              <span className="mx-1 text-ink-lighter">→</span>
              <span className="text-sage-deep">{c.corrected}</span>
            </p>
          ))}
        </div>
      )}
      {evaluation.overall_feedback && (
        <p className="text-xs text-ink">{evaluation.overall_feedback}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Navigation (fixed bottom bar)
// ═══════════════════════════════════════

function StageNav({
  stage,
  recallPhase,
  busy,
  completing,
  onNext,
  onPrev,
  onStartRecall,
  onRetryRecall,
  onContinueToProduction,
  onComplete,
}: {
  stage: LearnStage;
  recallPhase: RecallPhase;
  busy: boolean;
  completing: boolean;
  onNext: () => void;
  onPrev: () => void;
  onStartRecall: () => void;
  onRetryRecall: () => void;
  onContinueToProduction: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white/95 backdrop-blur z-20">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
        {stage === "understand" && (
          <button
            onClick={onNext}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink/90 transition-colors"
          >
            下一步
            <ArrowRight className="w-4 h-4 inline ml-1" />
          </button>
        )}

        {stage === "contextUsage" && (
          <>
            <button
              onClick={onPrev}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-ink hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              上一步
            </button>
            <button
              onClick={onStartRecall}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink/90 transition-colors"
            >
              开始主动回忆
              <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </>
        )}

        {stage === "recall" && recallPhase === "idle" && (
          <button
            onClick={onPrev}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-ink hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4 inline mr-1" />
            上一步
          </button>
        )}

        {stage === "recall" && recallPhase === "result" && (
          <>
            <button
              onClick={onRetryRecall}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-ink hover:bg-muted transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-1" />
              重新想一次
            </button>
            <button
              onClick={onContinueToProduction}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink/90 transition-colors"
            >
              继续个人造句
              <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </>
        )}

        {stage === "production" && (
          <>
            {recallPhase === "result" && (
              <button
                onClick={onPrev}
                className="py-2.5 px-4 rounded-xl text-sm font-medium border border-border text-ink hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline mr-1" />
              </button>
            )}
            <button
              onClick={onComplete}
              disabled={busy}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors",
                busy ? "bg-muted text-ink-lighter cursor-not-allowed" : "bg-ink text-white hover:bg-ink/90",
              )}
            >
              {completing ? (
                <><Loader2 className="w-4 h-4 inline mr-1 animate-spin" />完成中…</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 inline mr-1" />完成本条学习</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Small presentational helpers
// ═══════════════════════════════════════

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-light">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function TypeChip({ type, formality }: { type: string; formality: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn(
        "text-[10px] rounded-full px-2 py-0.5",
        type === "vocabulary" && "bg-blue-50 text-blue-600",
        type === "chunk" && "bg-amber-50 text-amber-600",
        type === "sentencePattern" && "bg-purple-50 text-purple-600",
        type === "speakingExpression" && "bg-sage-light text-sage-deep",
        type === "sentence" && "bg-rose-50 text-rose-600",
      )}>
        {type}
      </span>
      {formality && <span className="text-[10px] text-ink-lighter">{formality}</span>}
    </div>
  );
}

const INFO_TONES = {
  muted: "bg-muted border-muted",
  blue: "bg-blue-50 border-blue-100",
  amber: "bg-amber-50 border-amber-100",
  sage: "bg-sage-light/50 border-sage-light",
  purple: "bg-purple-50 border-purple-100",
  rose: "bg-rose-50 border-rose-100",
} as const;

function InfoBlock({ tone, title, content }: { tone: keyof typeof INFO_TONES; title: string; content: string }) {
  return (
    <div className={cn("rounded-xl p-3", INFO_TONES[tone])}>
      <p className="text-[11px] font-medium text-ink-light mb-1">{title}</p>
      <p className="text-sm text-ink whitespace-pre-wrap">{content}</p>
    </div>
  );
}

// ═══════════════════════════════════════
// Learning Summary
// ═══════════════════════════════════════

function LearningSummary({
  items,
  completedSet,
  onBack,
}: {
  items: SessionItem[];
  completedSet: Set<string>;
  onBack: () => void;
}) {
  const doneCount = items.filter((i) => isItemFinished(i) || completedSet.has(i.expressionId)).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-3">
        <div className="h-14 w-14 rounded-2xl bg-sage-light flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-sage-deep" />
        </div>
        <h1 className="text-xl font-semibold">学习完成</h1>
        <p className="text-sm text-ink-light">今天新学 {doneCount} 条表达</p>
      </div>

      <div className="bg-white rounded-2xl border border-border divide-y divide-border">
        {items.map((item) => {
          const done = isItemFinished(item) || completedSet.has(item.expressionId);
          const recallDone = item.recallScore !== null;
          const sentenceDone = !!item.userSentence;
          return (
            <div key={item.id} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium truncate">{item.expression?.english ?? "unknown"}</p>
                <p className="text-xs text-ink-light truncate">{item.expression?.chinese ?? ""}</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] shrink-0">
                {done ? (
                  <span className="px-2 py-0.5 rounded-full bg-sage-light text-sage-deep">已完成</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-muted text-ink-lighter">未完成</span>
                )}
                <span className={cn("px-2 py-0.5 rounded-full", recallDone ? "bg-blue-50 text-blue-600" : "bg-muted text-ink-lighter")}>
                  回忆
                </span>
                <span className={cn("px-2 py-0.5 rounded-full", sentenceDone ? "bg-purple-50 text-purple-600" : "bg-muted text-ink-lighter")}>
                  造句
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="w-full py-3 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink/90 transition-colors"
      >
        返回 English OS
      </button>
    </div>
  );
}
