// ============================================
// English SRS V3.1 — Learning History Dashboard
//
// Shows today's summary, 30-day trends, problem
// areas, and reinforcement history.
// ============================================

import { useLocation } from "wouter";
import { useLearningHistory } from "@/lib/hooks/useReviewSession";
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
} from "lucide-react";

// ── Color mapping for problem types ──

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

// ── Mini bar chart component ──

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

// ── Main Page ──

export default function EnglishLearningHistory() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useLearningHistory();

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

      {/* ── Today's Summary ── */}
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

      {/* ── Stats Row ── */}
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

      {/* ── 30-Day Trend ── */}
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

      {/* ── Problem Areas ── */}
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

// ── Mini stat box ──

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={cn("text-2xl font-bold", color || "text-ink")}>{value}</p>
      <p className="text-[11px] text-ink-lighter">{label}</p>
    </div>
  );
}
