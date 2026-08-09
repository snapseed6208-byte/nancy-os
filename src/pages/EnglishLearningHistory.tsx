// ============================================
// English SRS V3.2 — Learning History Dashboard
//
// Shows today's detailed session breakdown with
// per-round stats, sentence practice details,
// problem areas, and 30-day trends.
// ============================================

import { useLocation } from "wouter";
import {
  useLearningHistory,
  useSessionDetail,
  useHistoricalSummaries,
  type SentenceDetail,
  type ExpressionProgressDetail,
  type HistoricalSummary,
} from "@/lib/hooks/useReviewSession";
import { cn } from "@/lib/utils";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  TrendingUp,
  Target,
  Brain,
  Calendar,
  Flame,
  BarChart3,
  Pencil,
  MessageCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// ═══════════════════════════════════════
// Problem area helpers
// ═══════════════════════════════════════

const PROBLEM_COLORS: Record<string, string> = {
  memory: "bg-purple-50 text-purple-600",
  application: "bg-blue-50 text-blue-600",
  context: "bg-amber-50 text-amber-600",
  fluency: "bg-emerald-50 text-emerald-600",
};

const PROBLEM_LABELS: Record<string, string> = {
  memory: "记忆",
  application: "应用",
  context: "语境",
  fluency: "流利度",
};

// ═══════════════════════════════════════
// Mini bar chart
// ═══════════════════════════════════════

function MiniBarChart({ data }: { data: Array<{ date: string; total: number; passed: number; failed: number }> }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="flex items-end gap-[2px] h-16">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 flex flex-col justify-end gap-[1px]"
          title={`${d.date}: ${d.passed}通过 ${d.failed}失败`}
        >
          {d.failed > 0 && (
            <div
              className="w-full rounded-[1px] bg-red-200"
              style={{ height: `${Math.max((d.failed / maxVal) * 100, 2)}%` }}
            />
          )}
          {d.passed > 0 && (
            <div
              className="w-full rounded-[1px] bg-sage"
              style={{ height: `${Math.max((d.passed / maxVal) * 100, 2)}%` }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
// Stat box
// ═══════════════════════════════════════

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn("text-2xl font-bold", color || "text-ink")}>{value}</p>
      <p className="text-[11px] text-ink-lighter">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════
// Sentence practice detail card
// ═══════════════════════════════════════

function SentenceDetailCard({ detail }: { detail: SentenceDetail }) {
  return (
    <div className="bg-warm-cream rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-sage-deep">{detail.expressionEnglish}</span>
        <span className="text-xs text-ink-lighter">{detail.expressionChinese}</span>
      </div>
      <p className="text-sm text-ink italic">"{detail.userSentence}"</p>
      {detail.aiFeedback && (
        <p className="text-xs text-ink-light leading-relaxed">{detail.aiFeedback}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// V3.5: Per-expression detail row
// ═══════════════════════════════════════

function ExpressionDetailRow({ detail }: { detail: ExpressionProgressDetail }) {
  // V3.6: Compute activation state from detail data
  const recallMastered = detail.recallScore !== null && detail.recallScore >= 3;
  const contextActivated = detail.clozeResult === "correct";
  const productionActivated = detail.userSentence !== null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-warm-cream rounded-xl">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{detail.english}</p>
        <p className="text-[11px] text-ink-lighter truncate">{detail.chinese}</p>
      </div>
      {/* Recall score */}
      <span className={cn(
        "text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0",
        recallMastered
          ? "bg-sage-light/50 text-sage-deep"
          : detail.recallScore !== null
            ? "bg-accent-warm/10 text-accent-warm"
            : "bg-ink/5 text-ink-lighter",
      )}>
        {detail.recallScore !== null ? `Recall ${detail.recallScore}/5` : "未做"}
      </span>
      {/* Cloze result */}
      <span className={cn(
        "text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0",
        contextActivated
          ? "bg-sage-light/50 text-sage-deep"
          : detail.clozeResult === "partially_correct"
            ? "bg-amber-50 text-amber-600"
            : detail.clozeResult === "incorrect"
              ? "bg-accent-warm/10 text-accent-warm"
              : "bg-ink/5 text-ink-lighter",
      )}>
        {contextActivated ? "Context ✓" :
         detail.clozeResult === "partially_correct" ? "Context ~" :
         detail.clozeResult === "incorrect" ? "Context ✗" : "未做"}
      </span>
      {/* Sentence / Production */}
      <span className={cn(
        "text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0",
        productionActivated
          ? "bg-sage-light/50 text-sage-deep"
          : "bg-ink/5 text-ink-lighter",
      )}>
        {productionActivated ? "Production ✓" : "未做"}
      </span>
      {/* Activation state badge */}
      {recallMastered && contextActivated && productionActivated ? (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-700">
          Fully Activated
        </span>
      ) : (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 bg-ink/5 text-ink-lighter">
          {recallMastered ? "R" : "-"}{contextActivated ? "C" : "-"}{productionActivated ? "P" : "-"}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// V3.5: Historical AI Summary Card
// ═══════════════════════════════════════

function HistoricalSummaryCard({ entry }: { entry: HistoricalSummary }) {
  const summary = entry.summary;
  const overview = summary.overview as string | undefined;
  const completionSummary = summary.completion_summary as string | undefined;
  const activatedExpressions = summary.activated_expressions as string[] | undefined;
  const contextWeakExpressions = summary.context_weak_expressions as string[] | undefined;
  const recallOnlyExpressions = summary.recall_only_expressions as string[] | undefined;
  const strongestExpressions = summary.strongest_expressions as string[] | undefined;
  const weakestExpressions = summary.weakest_expressions as string[] | undefined;
  const tomorrowFocus = summary.tomorrow_focus as string | undefined;

  return (
    <div className="bg-white border border-border/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-purple-400" />
        <span className="text-xs font-medium text-ink">{entry.date} AI 总结</span>
        <span className="text-[10px] text-ink-lighter ml-auto">{entry.expressionCount} 个表达</span>
      </div>

      {overview && <p className="text-xs text-ink-light leading-relaxed">{overview}</p>}
      {completionSummary && <p className="text-[11px] text-ink-lighter">{completionSummary}</p>}

      {activatedExpressions && activatedExpressions.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-sage-deep shrink-0">已激活:</span>
          {activatedExpressions.slice(0, 5).map((e, i) => (
            <span key={i} className="text-[10px] bg-sage-light/30 text-sage-deep px-1 py-0.5 rounded">{e}</span>
          ))}
        </div>
      )}

      {(recallOnlyExpressions && recallOnlyExpressions.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-ink-lighter shrink-0">仅回忆:</span>
          {recallOnlyExpressions.slice(0, 4).map((e, i) => (
            <span key={i} className="text-[10px] bg-ink/5 text-ink-light px-1 py-0.5 rounded">{e}</span>
          ))}
        </div>
      )}

      {(contextWeakExpressions && contextWeakExpressions.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-orange-500 shrink-0">语境弱:</span>
          {contextWeakExpressions.slice(0, 4).map((e, i) => (
            <span key={i} className="text-[10px] bg-orange-50 text-orange-600 px-1 py-0.5 rounded">{e}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {strongestExpressions && strongestExpressions.length > 0 && (
          <div className="bg-sage-light/20 rounded-lg p-2">
            <p className="text-[9px] text-ink-lighter mb-0.5">最强</p>
            {strongestExpressions.slice(0, 3).map((e, i) => (
              <p key={i} className="text-[10px] text-sage-deep font-medium">{e}</p>
            ))}
          </div>
        )}
        {weakestExpressions && weakestExpressions.length > 0 && (
          <div className="bg-accent-warm/10 rounded-lg p-2">
            <p className="text-[9px] text-ink-lighter mb-0.5">最弱</p>
            {weakestExpressions.slice(0, 3).map((e, i) => (
              <p key={i} className="text-[10px] text-accent-warm font-medium">{e}</p>
            ))}
          </div>
        )}
      </div>

      {tomorrowFocus && (
        <p className="text-[11px] text-sage-deep leading-relaxed bg-sage-light/20 rounded-lg p-2">{tomorrowFocus}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Main Page
// ═══════════════════════════════════════

export default function EnglishLearningHistory() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useLearningHistory();
  const { data: sessionDetail, isLoading: detailLoading } = useSessionDetail();
  const { data: historicalSummaries } = useHistoricalSummaries(14);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-sage mx-auto" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <AlertTriangle size={32} className="text-accent-warm mx-auto" />
          <p className="text-sm text-ink">数据加载失败</p>
        </div>
      </div>
    );
  }

  const { todaySession, last30Days, problemAreas, totalPracticeLogs, streak } = data;
  const recent7Days = last30Days.slice(-7);
  const weekPassed = recent7Days.reduce((s, d) => s + d.passedItems, 0);
  const weekTotal = recent7Days.reduce((s, d) => s + d.totalItems, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/english")}
          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-warm-cream transition-colors"
        >
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <h2 className="text-lg font-semibold text-ink">学习历史</h2>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* Today's Detailed Session Breakdown    */}
      {/* ═══════════════════════════════════════ */}

      {sessionDetail ? (
        <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-sage-deep" />
            <h3 className="text-sm font-semibold text-ink">
              今日复习详情
            </h3>
            <span className={cn(
              "ml-auto text-[11px] px-2 py-0.5 rounded-full",
              sessionDetail.status === "completed"
                ? "bg-sage-light/50 text-sage-deep"
                : "bg-accent-warm/10 text-accent-warm",
            )}>
              {sessionDetail.status === "completed" ? "已完成" : "进行中"}
            </span>
          </div>

          {/* Round 1: Active Recall */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain size={14} className="text-sage-deep" />
              <h4 className="text-xs font-semibold text-ink">
                Round 1 主动回忆
              </h4>
              <span className="text-[11px] text-ink-lighter">
                {sessionDetail.round1Total} 个表达
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-sage-light/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-sage-deep">{sessionDetail.round1FirstPassed}</p>
                <p className="text-[10px] text-ink-lighter">首次通过</p>
              </div>
              <div className="bg-accent-warm/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-accent-warm">{sessionDetail.round1FirstFailed}</p>
                <p className="text-[10px] text-ink-lighter">首次未通过</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-blue-500">
                  {sessionDetail.round1Total - sessionDetail.round1FirstPassed - sessionDetail.round1FirstFailed}
                </p>
                <p className="text-[10px] text-ink-lighter">未完成</p>
              </div>
            </div>
          </div>

          {/* Reinforcement (Round 1 internal) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RotateCcw size={14} className="text-accent-warm" />
              <h4 className="text-xs font-semibold text-ink">
                Round 1 强化
              </h4>
              <span className="text-[11px] text-ink-lighter">
                {sessionDetail.reinforcementCount} 个进入强化
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-sage-light/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-sage-deep">{sessionDetail.reinforcedPassed}</p>
                <p className="text-[10px] text-ink-lighter">强化后通过</p>
              </div>
              <div className="bg-accent-warm/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-accent-warm">
                  {sessionDetail.reinforcementCount - sessionDetail.reinforcedPassed}
                </p>
                <p className="text-[10px] text-ink-lighter">仍需工作</p>
              </div>
            </div>
          </div>

          {/* Round 2: Cloze */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Pencil size={14} className="text-sage-deep" />
              <h4 className="text-xs font-semibold text-ink">
                Round 2 语境填空
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-sage-light/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-sage-deep">{sessionDetail.round2Passed}</p>
                <p className="text-[10px] text-ink-lighter">
                  正确 / {sessionDetail.round2Total}
                </p>
              </div>
              <div className="bg-accent-warm/10 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-accent-warm">
                  {sessionDetail.round2Total - sessionDetail.round2Passed}
                </p>
                <p className="text-[10px] text-ink-lighter">
                  未正确 / {sessionDetail.round2Total}
                </p>
              </div>
            </div>
          </div>

          {/* Round 3: Sentence */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageCircle size={14} className="text-sage-deep" />
              <h4 className="text-xs font-semibold text-ink">
                Round 3 个人造句
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-sage-light/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-sage-deep">{sessionDetail.round3Completed}</p>
                <p className="text-[10px] text-ink-lighter">
                  已完成 / {sessionDetail.round3Total}
                </p>
              </div>
              <div className="bg-ink/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-ink-light">
                  {sessionDetail.round3Total - sessionDetail.round3Completed}
                </p>
                <p className="text-[10px] text-ink-lighter">
                  未完成 / {sessionDetail.round3Total}
                </p>
              </div>
            </div>
          </div>

          {/* Continue review button */}
          {sessionDetail.status !== "completed" && (
            <button
              onClick={() => navigate("/english/review")}
              className="w-full py-2.5 bg-sage text-white text-sm font-medium rounded-xl hover:bg-sage-deep transition-colors"
            >
              继续复习
            </button>
          )}
        </div>
      ) : (
        /* Fallback: simple today summary when no session detail */
        <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-sage-deep" />
            <h3 className="text-sm font-semibold text-ink">今日复习</h3>
          </div>

          {todaySession ? (
            <div className="grid grid-cols-4 gap-3">
              <StatBox label="总复习" value={todaySession.total} />
              <StatBox label="已掌握" value={todaySession.passed} color="text-sage-deep" />
              <StatBox label="需强化" value={todaySession.failed} color="text-accent-warm" />
              <StatBox label="强化中" value={todaySession.reinforcement} color="text-blue-500" />
            </div>
          ) : (
            <p className="text-sm text-ink-light">今天还没有开始复习</p>
          )}

          {todaySession && !todaySession.completed && (
            <button
              onClick={() => navigate("/english/review")}
              className="w-full py-2.5 bg-sage text-white text-sm font-medium rounded-xl hover:bg-sage-deep transition-colors"
            >
              继续复习
            </button>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* Sentence Practice Details             */}
      {/* ═══════════════════════════════════════ */}

      {sessionDetail && sessionDetail.sentenceDetails.length > 0 && (
        <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-sage-deep" />
            <h3 className="text-sm font-semibold text-ink">
              今日造句记录
            </h3>
            <span className="text-[11px] text-ink-lighter ml-auto">
              {sessionDetail.sentenceDetails.length} 条
            </span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {sessionDetail.sentenceDetails.map((d, idx) => (
              <SentenceDetailCard key={idx} detail={d} />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* Difficult Expressions                 */}
      {/* ═══════════════════════════════════════ */}

      {sessionDetail && sessionDetail.difficultExpressions.length > 0 && (
        <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-accent-warm" />
            <h3 className="text-sm font-semibold text-ink">
              困难表达
            </h3>
            <span className="text-[11px] text-ink-lighter ml-auto">
              {sessionDetail.difficultExpressions.length} 个
            </span>
          </div>
          <div className="space-y-1.5">
            {sessionDetail.difficultExpressions.map((expr, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-3 py-2 bg-warm-cream rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{expr.english}</p>
                  <p className="text-[11px] text-ink-lighter truncate">{expr.chinese}</p>
                </div>
                <span className="text-[11px] font-medium text-accent-warm shrink-0">
                  {expr.recallScore !== null ? `${expr.recallScore}/5` : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* V3.5: Per-Expression Detail           */}
      {/* ═══════════════════════════════════════ */}

      {sessionDetail && sessionDetail.expressionDetails.length > 0 && (
        <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-sage-deep" />
            <h3 className="text-sm font-semibold text-ink">表达详情</h3>
            <span className="text-[11px] text-ink-lighter ml-auto">
              {sessionDetail.expressionDetails.length} 个
            </span>
          </div>
          <div className="space-y-1.5">
            {sessionDetail.expressionDetails.map((expr, idx) => (
              <ExpressionDetailRow key={idx} detail={expr} />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* Stats Row                             */}
      {/* ═══════════════════════════════════════ */}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-border/60 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame size={14} className="text-orange-400" />
            <span className="text-[11px] text-ink-lighter">连续天数</span>
          </div>
          <p className="text-xl font-bold text-ink">{streak} <span className="text-xs font-normal text-ink-light">天</span></p>
        </div>
        <div className="bg-white border border-border/60 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Target size={14} className="text-sage-deep" />
            <span className="text-[11px] text-ink-lighter">7天练习</span>
          </div>
          <p className="text-xl font-bold text-ink">{weekTotal} <span className="text-xs font-normal text-ink-light">次</span></p>
        </div>
        <div className="bg-white border border-border/60 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-blue-500" />
            <span className="text-[11px] text-ink-lighter">7天正确率</span>
          </div>
          <p className="text-xl font-bold text-ink">
            {weekTotal > 0 ? Math.round((weekPassed / weekTotal) * 100) : 0}
            <span className="text-xs font-normal text-ink-light">%</span>
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 30-Day Trend                          */}
      {/* ═══════════════════════════════════════ */}

      <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-sage-deep" />
          <h3 className="text-sm font-semibold text-ink">30天趋势</h3>
          <span className="text-[11px] text-ink-lighter ml-auto">
            共 {totalPracticeLogs} 次练习
          </span>
        </div>
        <MiniBarChart
          data={last30Days.map((d) => ({
            date: d.date,
            total: d.totalItems,
            passed: d.passedItems,
            failed: d.failedItems,
          }))}
        />
        <div className="flex items-center gap-4 text-[11px] text-ink-light">
          <span className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-sage" />
            通过
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-200" />
            失败
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* V3.5: Historical AI Summaries         */}
      {/* ═══════════════════════════════════════ */}

      {historicalSummaries && historicalSummaries.length > 0 && (
        <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-ink">历史 AI 总结</h3>
            <span className="text-[11px] text-ink-lighter ml-auto">
              近 14 天 · {historicalSummaries.length} 条
            </span>
          </div>
          <div className="space-y-2">
            {historicalSummaries.map((entry) => (
              <HistoricalSummaryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* Problem Areas (30-day)                */}
      {/* ═══════════════════════════════════════ */}

      <div className="bg-white border border-border/60 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-accent-warm" />
          <h3 className="text-sm font-semibold text-ink">困难表达 Top 8</h3>
          <span className="text-[11px] text-ink-lighter ml-auto">近30天</span>
        </div>

        {problemAreas.length === 0 ? (
          <p className="text-sm text-ink-light">暂无困难表达记录，继续保持！</p>
        ) : (
          <div className="space-y-2">
            {problemAreas.map((p) => (
              <div
                key={p.expression}
                className="flex items-center gap-3 px-3 py-2.5 bg-warm-cream rounded-xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{p.expression}</p>
                  <p className="text-[11px] text-ink-lighter truncate">{p.chinese}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    PROBLEM_COLORS[p.problemType] || "bg-gray-100 text-gray-500",
                  )}>
                    {PROBLEM_LABELS[p.problemType] || p.problemType}
                  </span>
                  <span className="text-[11px] font-medium text-accent-warm">
                    x{p.failCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
