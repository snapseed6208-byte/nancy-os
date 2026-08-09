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
  useDiagnoseItem,
  usePersonalPracticePrompt,
  useUpdateReinforcementStatus,
  getReinforcementItems,
  getSessionStats,
  type SessionItem,
  type DifficultyDiagnosis,
  type PersonalPracticeContext,
  type ReinforcementStatus,
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
  Lightbulb,
  Zap,
  BookOpen,
  MessageCircle,
  ChevronDown,
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

// ── Diagnosis display helpers ──

const PROBLEM_TYPE_CONFIG: Record<string, { icon: typeof Brain; label: string; color: string }> = {
  memory: { icon: Brain, label: "记忆问题", color: "text-purple-600 bg-purple-50 border-purple-200" },
  application: { icon: Pencil, label: "应用问题", color: "text-blue-600 bg-blue-50 border-blue-200" },
  context: { icon: MessageCircle, label: "语境问题", color: "text-amber-600 bg-amber-50 border-amber-200" },
  fluency: { icon: Zap, label: "流利度问题", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
};

function RecallCard({
  item,
  diagnosis,
  isDiagnosing,
  onResult,
}: {
  item: SessionItem;
  diagnosis?: DifficultyDiagnosis | null;
  isDiagnosing?: boolean;
  onResult: (itemId: string, passed: boolean, score: number) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [selfRating, setSelfRating] = useState<number | null>(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  const handleReveal = () => setRevealed(true);

  const handleRate = (rating: number) => {
    setSelfRating(rating);
    const passed = rating >= 3;
    setTimeout(() => {
      onResult(item.id, passed, rating);
      if (!passed) setShowDiagnosis(true);
    }, 200);
  };

  const ptConfig = diagnosis ? PROBLEM_TYPE_CONFIG[diagnosis.problem_type] : null;

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

          {/* V3.1: AI Diagnosis for failed items */}
          {selfRating !== null && selfRating < 4 && (
            <div className="space-y-2">
              {isDiagnosing ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-warm-cream rounded-xl">
                  <Loader2 size={14} className="animate-spin text-sage" />
                  <span className="text-xs text-ink-light">AI 正在分析你的困难原因…</span>
                </div>
              ) : diagnosis ? (
                <div className={cn("border rounded-xl overflow-hidden transition-all", ptConfig?.color.split(" ")[2] || "border-border/40")}>
                  <button
                    onClick={() => setShowDiagnosis(!showDiagnosis)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      {ptConfig && <ptConfig.icon size={14} className={ptConfig.color.split(" ")[0]} />}
                      <span className="text-xs font-medium text-ink">
                        {ptConfig?.label || "诊断"} · {diagnosis.suggestion.slice(0, 30)}…
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={cn("text-ink-lighter transition-transform", showDiagnosis && "rotate-180")}
                    />
                  </button>
                  {showDiagnosis && (
                    <div className="px-4 pb-3 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {diagnosis.sub_problems.map((sp) => (
                          <span
                            key={sp}
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-ink/5 text-ink-light"
                          >
                            {sp}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Lightbulb size={12} className="text-accent-warm mt-0.5 shrink-0" />
                        <p className="text-xs text-ink-light leading-relaxed">{diagnosis.suggestion}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
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
  personalContext,
  onResult,
}: {
  item: SessionItem;
  personalContext?: PersonalPracticeContext | null;
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

      {/* V3.1: Personalized practice prompt */}
      {personalContext && personalContext.scenario !== "日常场景" && (
        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BookOpen size={12} className="text-blue-500" />
            <span className="text-[11px] font-medium text-blue-600">个性化场景</span>
          </div>
          <p className="text-xs text-blue-700">{personalContext.scenario}</p>
          <p className="text-xs text-blue-600/80 leading-relaxed">{personalContext.prompt}</p>
          {personalContext.asset_title && (
            <p className="text-[10px] text-blue-400">
              关联素材：{personalContext.asset_title}
            </p>
          )}
        </div>
      )}

      {/* Sentence input */}
      <div>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          disabled={submitted}
          placeholder={
            personalContext?.prompt
              ? personalContext.prompt
              : "用这个表达写一个句子..."
          }
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
// Cloze Card (Round 2: fill-in-blank)
// ═══════════════════════════════════════

function ClozeCard({
  item,
  onResult,
}: {
  item: SessionItem;
  onResult: (itemId: string, passed: boolean) => void;
}) {
  const expr = item.expression?.english || "";
  // Create a cloze by removing 2-4 words from the expression or example
  const source = item.expression?.example_sentence || expr;
  const words = source.split(/\s+/);
  const blankIdx = words.length > 4
    ? Math.floor(words.length * 0.3) + (Math.floor(Math.random() * Math.min(3, words.length - 2)))
    : Math.floor(words.length / 2);
  const blankStart = Math.max(0, blankIdx - 1);
  const blankEnd = Math.min(words.length, blankIdx + 2);
  const blanks = words.slice(blankStart, blankEnd).map((w) => w.replace(/[.,!?;:'"]/g, ""));

  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    const normalized = answer.trim().toLowerCase();
    const correct = blanks.some((b) => normalized.includes(b.toLowerCase())) ||
      blanks.join(" ").toLowerCase() === normalized;
    setIsCorrect(correct);
    setSubmitted(true);
    setTimeout(() => onResult(item.id, correct), 300);
  };

  const clozeText = words.map((w, i) => {
    if (i >= blankStart && i < blankEnd) {
      return "____";
    }
    return w;
  }).join(" ");

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">填空练习 · 第2轮强化</p>
        <p className="text-sm text-ink-light">{item.expression?.chinese}</p>
      </div>

      {!submitted ? (
        <div className="space-y-4">
          <div className="p-4 bg-warm-cream rounded-xl">
            <p className="text-base font-medium text-ink leading-relaxed">{clozeText}</p>
          </div>
          <div>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="填入缺少的单词..."
              className="w-full px-4 py-3 rounded-xl border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
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
          <div className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl",
            isCorrect ? "bg-sage-light/50" : "bg-accent-warm/10",
          )}>
            {isCorrect ? (
              <CheckCircle2 size={16} className="text-sage-deep" />
            ) : (
              <XCircle size={16} className="text-accent-warm" />
            )}
            <span className={cn("text-sm font-medium", isCorrect ? "text-sage-deep" : "text-accent-warm")}>
              {isCorrect ? "正确" : `正确答案: ${blanks.join(" ")}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Context Card (Round 3: scenario-based)
// ═══════════════════════════════════════

function ContextCard({
  item,
  personalContext,
  onResult,
}: {
  item: SessionItem;
  personalContext?: PersonalPracticeContext | null;
  onResult: (itemId: string, sentence: string, passed: boolean) => void;
}) {
  const [sentence, setSentence] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!sentence.trim()) return;
    setSubmitted(true);
    const hasExpression = sentence
      .toLowerCase()
      .includes((item.expression?.english || "").split(" ")[0].toLowerCase());
    const passed = sentence.length > 15 && hasExpression;
    onResult(item.id, sentence, passed);
  };

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-4">
      <div>
        <p className="text-[11px] text-ink-lighter mb-1">场景造句 · 第3轮强化</p>
        <p className="text-base font-semibold text-sage-deep">{item.expression?.english}</p>
        <p className="text-xs text-ink-light mt-0.5">{item.expression?.chinese}</p>
      </div>

      {personalContext && (
        <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
          <p className="text-xs text-blue-700 leading-relaxed">{personalContext.prompt}</p>
        </div>
      )}

      {!submitted ? (
        <>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder={personalContext?.prompt || "结合你的实际场景，用这个表达造一个句子..."}
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
            <span className="text-xs text-sage-deep font-medium">第3轮完成</span>
          </div>
          <p className="text-sm text-ink italic">"{sentence}"</p>
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
  const diagnoseItem = useDiagnoseItem();
  const personalPractice = usePersonalPracticePrompt();
  const updateReinforcementStatus = useUpdateReinforcementStatus();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundComplete, setRoundComplete] = useState(false);
  const [reinforcementRound, setReinforcementRound] = useState(0);
  const [reinforcementType, setReinforcementType] = useState<"recall" | "cloze" | "context">("recall");
  const [stage, setStage] = useState<"recall" | "sentence">("recall");

  // V3.1: Diagnosis state
  const [diagnoses, setDiagnoses] = useState<Record<string, DifficultyDiagnosis>>({});
  const [diagnosingIds, setDiagnosingIds] = useState<Set<string>>(new Set());

  // V3.1: Personal practice contexts (loaded when entering sentence stage)
  const [personalContexts, setPersonalContexts] = useState<Record<string, PersonalPracticeContext>>({});

  const MAX_REINFORCEMENT_POOL = 5;

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

      // V3.1: Classify result
      let classification: "mastered" | "needs_reinforcement" | "needs_context" | undefined;
      let reinfStatus: ReinforcementStatus = "none";
      if (score >= 4) {
        classification = "mastered";
        reinfStatus = "mastered";
      } else if (score <= 2) {
        classification = "needs_reinforcement";
        reinfStatus = reinforcementRound === 0 ? "queued" : "round1_recall";
      } else {
        classification = "needs_context";
        reinfStatus = "round3_context";
      }

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

      // V3.1: Save classification and reinforcement status
      if (!passed) {
        updateReinforcementStatus.mutate({
          itemId,
          reinforcementStatus: reinfStatus,
          resultClassification: classification,
          reinforcementRound,
        });
      }

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

      // V3.1: Trigger AI diagnosis for failed items
      if (!passed && item.expression) {
        setDiagnosingIds((prev) => new Set(prev).add(itemId));
        try {
          const recentFailed = allItems
            .filter((i) => i.status === "failed" || i.status === "reinforcement")
            .slice(-5)
            .map((i) => ({
              expression: i.expression?.english || "",
              score: i.recallScore || 0,
              status: i.status,
            }));

          const diagnosis = await diagnoseItem.mutateAsync({
            itemId,
            expressionEnglish: item.expression.english,
            expressionChinese: item.expression.chinese,
            expressionExample: item.expression.example_sentence,
            score,
            sessionId: session?.id,
            recentAttempts: recentFailed,
          });
          setDiagnoses((prev) => ({ ...prev, [itemId]: diagnosis }));
        } catch {
          // Diagnosis is non-blocking; silently ignore failures
        }
        setDiagnosingIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }

      // Advance
      if (currentIndex >= queue.length - 1) {
        setRoundComplete(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [allItems, currentIndex, queue.length, reinforcementRound, updateItem, recordLog, session?.id, submitReview, diagnoseItem, updateReinforcementStatus],
  );

  // Handle cloze result (reinforcement round 2)
  const handleClozeResult = useCallback(
    async (itemId: string, passed: boolean) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item) return;

      const newStatus = passed ? "passed" : "failed";
      const nextReinfStatus: ReinforcementStatus = passed ? "mastered" : "round3_context";

      await updateItem.mutateAsync({
        itemId,
        updates: {
          status: newStatus,
          attemptCount: item.attemptCount + 1,
        },
      });

      updateReinforcementStatus.mutate({
        itemId,
        reinforcementStatus: nextReinfStatus,
        resultClassification: passed ? "mastered" : "needs_context",
      });

      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "cloze",
        score: passed ? 4 : 2,
        sessionId: session?.id,
      });

      if (currentIndex >= queue.length - 1) {
        setRoundComplete(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [allItems, currentIndex, queue.length, updateItem, updateReinforcementStatus, recordLog, session?.id],
  );

  // Handle context result (reinforcement round 3)
  const handleContextResult = useCallback(
    async (itemId: string, sentence: string, passed: boolean) => {
      const item = allItems.find((i) => i.id === itemId);
      if (!item) return;

      const nextReinfStatus: ReinforcementStatus = passed ? "mastered" : "max_rounds";

      await updateItem.mutateAsync({
        itemId,
        updates: {
          userSentence: sentence,
          status: passed ? "passed" : "failed",
          applicationScore: passed ? 4 : 2,
          attemptCount: item.attemptCount + 1,
        },
      });

      updateReinforcementStatus.mutate({
        itemId,
        reinforcementStatus: nextReinfStatus,
        resultClassification: passed ? "mastered" : "needs_reinforcement",
      });

      recordLog.mutate({
        expressionId: item.expressionId,
        mode: "context",
        answer: sentence,
        score: passed ? 4 : 2,
        sessionId: session?.id,
      });

      if (currentIndex >= queue.length - 1) {
        setRoundComplete(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [allItems, currentIndex, queue.length, updateItem, updateReinforcementStatus, recordLog, session?.id],
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

  // Start reinforcement with 3-round pipeline
  const handleReinforce = useCallback(async () => {
    // V3.1: Limit pool to 5 items (prioritize lowest scores)
    const pool = [...reinforcementItems]
      .sort((a, b) => (a.recallScore || 0) - (b.recallScore || 0))
      .slice(0, MAX_REINFORCEMENT_POOL);

    const nextRound = reinforcementRound + 1;
    const nextType: "recall" | "cloze" | "context" =
      nextRound === 1 ? "recall" :
      nextRound === 2 ? "cloze" : "context";

    const nextStatus: ReinforcementStatus =
      nextType === "recall" ? "round1_recall" :
      nextType === "cloze" ? "round2_cloze" : "round3_context";

    // Batch update all reinforcement items
    await Promise.all(
      pool.map((item) =>
        updateItem.mutateAsync({
          itemId: item.id,
          updates: {
            status: "reinforcement",
            reinforcementRound: nextRound,
          },
        }).then(() =>
          updateReinforcementStatus.mutateAsync({
            itemId: item.id,
            reinforcementStatus: nextStatus,
            reinforcementRound: nextRound,
          }),
        ),
      ),
    );

    setReinforcementRound(nextRound);
    setReinforcementType(nextType);
    setCurrentIndex(0);
    setRoundComplete(false);
  }, [reinforcementItems, reinforcementRound, updateItem, updateReinforcementStatus]);

  // Advance to sentence stage
  const handleAdvanceStage = useCallback(async () => {
    setStage("sentence");
    setCurrentIndex(0);
    setRoundComplete(false);
    if (session?.id) {
      await updateStage.mutateAsync({ sessionId: session.id, stage: "sentence" });
    }

    // V3.1: Preload personal practice contexts for sentence items
    const sentenceItems = allItems.filter(
      (i) => i.status === "passed" || i.status === "completed" || i.recallScore !== null,
    );
    for (const item of sentenceItems.slice(0, 5)) {
      if (!item.expression) continue;
      try {
        const ctx = await personalPractice.mutateAsync({
          itemId: item.id,
          expressionEnglish: item.expression.english,
          expressionChinese: item.expression.chinese,
          expressionExample: item.expression.example_sentence,
          expressionType: item.expression.type,
          sessionId: session?.id,
        });
        setPersonalContexts((prev) => ({ ...prev, [item.id]: ctx }));
      } catch {
        // Non-blocking
      }
    }
  }, [session?.id, updateStage, allItems, personalPractice]);

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
          {stage === "recall" && reinforcementRound === 0 ? (
            <RecallCard
              item={currentItem}
              onResult={handleRecallResult}
              diagnosis={diagnoses[currentItem.id]}
              isDiagnosing={diagnosingIds.has(currentItem.id)}
            />
          ) : stage === "recall" && reinforcementType === "cloze" ? (
            <ClozeCard item={currentItem} onResult={handleClozeResult} />
          ) : stage === "recall" && reinforcementType === "context" ? (
            <ContextCard
              item={currentItem}
              personalContext={personalContexts[currentItem.id]}
              onResult={handleContextResult}
            />
          ) : stage === "sentence" ? (
            <SentenceCard
              item={currentItem}
              personalContext={personalContexts[currentItem.id]}
              onResult={handleSentenceResult}
            />
          ) : (
            <RecallCard
              item={currentItem}
              onResult={handleRecallResult}
              diagnosis={diagnoses[currentItem.id]}
              isDiagnosing={diagnosingIds.has(currentItem.id)}
            />
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
