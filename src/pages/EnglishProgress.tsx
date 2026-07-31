import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, TrendingUp, Clock, Mic, Target, Zap,
  AlertTriangle, Sparkles, Loader2, ChevronUp, BarChart3,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  useProgressData, useFrequentErrors, useCommonProblems,
} from "@/lib/hooks/useEnglish";
import type { ProgressDataPoint, FrequentError } from "@/lib/hooks/useEnglish";
import { summarizeProgress } from "@/lib/ai/englishCoach";
import type { ProgressSummary } from "@/lib/ai/englishCoach";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ── Helpers ──

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return "< 1 min";
  return `${m} min`;
}

function avgScore(point: ProgressDataPoint): number {
  const scores = [
    point.fluency_score,
    point.grammar_score,
    point.vocabulary_score,
    point.naturalness_score,
  ].filter((s): s is number => s !== null && s > 0);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function avgOfArray(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

const PERIODS = [
  { days: 7, label: "本周" },
  { days: 30, label: "本月" },
  { days: 90, label: "全部" },
];

// ── Main Page ──

export default function EnglishProgress() {
  const [, navigate] = useLocation();
  const [periodDays, setPeriodDays] = useState(30);

  const { data: progressData, isLoading: dataLoading } = useProgressData(periodDays);
  const { data: frequentErrors, isLoading: errorsLoading } = useFrequentErrors(periodDays);
  const { data: commonProblems } = useCommonProblems(periodDays);

  const [aiSummary, setAiSummary] = useState<ProgressSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── Derived stats ──

  const points = progressData || [];
  const totalSessions = new Set(points.map((p) => p.id)).size || points.length;
  const totalSeconds = points.reduce((sum, p) => sum + (p.audio_duration || 0), 0);
  const scores = points.map(avgScore).filter((s) => s > 0);
  const overallAvg = scores.length > 0 ? avgOfArray(scores) : 0;

  // Score improvement: compare first third vs last third
  const improvement = (() => {
    if (scores.length < 3) return null;
    const third = Math.max(1, Math.floor(scores.length / 3));
    const firstAvg = avgOfArray(scores.slice(0, third));
    const lastAvg = avgOfArray(scores.slice(-third));
    return lastAvg - firstAvg;
  })();

  // Chart data: each attempt as a data point
  const chartData = points
    .filter((p) => avgScore(p) > 0)
    .map((p, i) => ({
      index: i + 1,
      score: Math.round(avgScore(p) * 10) / 10,
      fluency: p.fluency_score || 0,
      grammar: p.grammar_score || 0,
      vocabulary: p.vocabulary_score || 0,
      naturalness: p.naturalness_score || 0,
      date: new Date(p.created_at).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
      prompt: p.session_prompt?.slice(0, 40),
    }));

  // ── AI Summary ──

  const handleGenerateSummary = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("请先登录");

      const result = await summarizeProgress(
        commonProblems || [],
        frequentErrors || [],
        {
          fluency: points.map((p) => p.fluency_score).filter((s): s is number => s !== null && s > 0),
          grammar: points.map((p) => p.grammar_score).filter((s): s is number => s !== null && s > 0),
          vocabulary: points.map((p) => p.vocabulary_score).filter((s): s is number => s !== null && s > 0),
          naturalness: points.map((p) => p.naturalness_score).filter((s): s is number => s !== null && s > 0),
        },
        session.access_token,
      );
      setAiSummary(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI 分析失败");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Render ──

  const hasData = points.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/english")}
            className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">English OS</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">My Progress</h1>
          </div>
        </div>
      </header>

      {/* Period selector */}
      <div className="flex gap-1.5 bg-ink/5 rounded-xl p-1">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => { setPeriodDays(p.days); setAiSummary(null); }}
            className={cn(
              "flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors",
              periodDays === p.days
                ? "bg-card text-ink shadow-sm"
                : "text-ink-lighter hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {dataLoading ? (
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-ink-lighter mx-auto" />
        </div>
      ) : !hasData ? (
        /* Empty state */
        <div className="text-center py-12 space-y-3">
          <BarChart3 size={40} className="text-ink-lighter mx-auto" />
          <p className="text-sm font-medium text-ink">还没有口语练习数据</p>
          <p className="text-xs text-ink-lighter">完成几次口语练习后，这里会展示你的成长轨迹</p>
          <button
            onClick={() => navigate("/english/speaking")}
            className="inline-flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-sm font-semibold mt-2"
          >
            <Mic size={14} />
            开始练习
          </button>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Mic size={14} className="text-sage-deep" />
                <span className="text-[10px] text-ink-lighter">Sessions</span>
              </div>
              <p className="text-2xl font-bold text-ink">{totalSessions}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-blue-500" />
                <span className="text-[10px] text-ink-lighter">Total speaking</span>
              </div>
              <p className="text-2xl font-bold text-ink">{formatMinutes(totalSeconds)}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target size={14} className="text-amber-500" />
                <span className="text-[10px] text-ink-lighter">Average score</span>
              </div>
              <p className="text-2xl font-bold text-ink">{overallAvg > 0 ? overallAvg.toFixed(1) : "-"}</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className={cn(improvement !== null && improvement >= 0 ? "text-emerald-500" : "text-accent-rose")} />
                <span className="text-[10px] text-ink-lighter">Trend</span>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                improvement !== null && improvement >= 0 ? "text-emerald-600" : "text-accent-rose",
              )}>
                {improvement !== null
                  ? `${improvement >= 0 ? "+" : ""}${improvement.toFixed(1)}`
                  : "-"}
              </p>
            </div>
          </div>

          {/* Score trend chart */}
          {chartData.length >= 2 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-3 flex items-center gap-1.5">
                <TrendingUp size={12} />
                评分趋势 Score Trend
              </p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f7a6b" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#4f7a6b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 9]}
                      ticks={[0, 3, 5, 6, 7, 8, 9]}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value: number) => [value.toFixed(1), "Score"]}
                      labelFormatter={(label: string) => `${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#4f7a6b"
                      strokeWidth={2}
                      fill="url(#scoreGradient)"
                      dot={{ r: 3, fill: "#4f7a6b", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#4f7a6b", strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-ink-light flex items-center gap-1.5">
                <Sparkles size={12} className="text-purple-500" />
                AI 弱点总结
              </p>
              {!aiSummary && !aiLoading && (
                <button
                  onClick={handleGenerateSummary}
                  disabled={(commonProblems?.length || 0) < 2}
                  className="text-[11px] font-medium text-purple-600 bg-purple-50 rounded-lg px-3 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  生成分析
                </button>
              )}
            </div>

            {aiLoading && (
              <div className="text-center py-6">
                <Loader2 size={20} className="animate-spin text-purple-400 mx-auto mb-2" />
                <p className="text-xs text-ink-lighter">AI 正在分析你的口语数据...</p>
              </div>
            )}

            {aiError && (
              <div className="flex items-start gap-2 text-xs text-accent-rose bg-accent-rose/5 rounded-xl p-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p>{aiError}</p>
                  <button onClick={handleGenerateSummary} className="text-purple-600 font-medium mt-1 hover:underline">重试</button>
                </div>
              </div>
            )}

            {aiSummary && (
              <div className="space-y-3">
                <p className="text-xs text-ink leading-relaxed">{aiSummary.summaryText}</p>

                {aiSummary.commonProblems.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-ink-light mb-1.5">Your common problems:</p>
                    <ul className="space-y-1">
                      {aiSummary.commonProblems.map((p, i) => (
                        <li key={i} className="text-xs text-ink flex items-start gap-1.5">
                          <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.strengthsObserved.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-emerald-600 mb-1.5">Strengths:</p>
                    <ul className="space-y-1">
                      {aiSummary.strengthsObserved.map((s, i) => (
                        <li key={i} className="text-xs text-ink flex items-start gap-1.5">
                          <span className="text-emerald-500 shrink-0 mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.suggestion && (
                  <div className="bg-purple-50 rounded-xl p-3">
                    <p className="text-[11px] font-medium text-purple-700 mb-0.5">学习建议</p>
                    <p className="text-xs text-purple-800 leading-relaxed">{aiSummary.suggestion}</p>
                  </div>
                )}
              </div>
            )}

            {!aiSummary && !aiLoading && (commonProblems?.length || 0) < 2 && (
              <p className="text-xs text-ink-lighter text-center py-4">
                需要至少 2 次带 AI 反馈的练习才能生成分析
              </p>
            )}
          </div>

          {/* Frequent errors */}
          {!errorsLoading && frequentErrors && frequentErrors.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-medium text-ink-light mb-3 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-accent-rose" />
                高频错误 Frequent Errors
              </p>
              <div className="space-y-2">
                {frequentErrors.slice(0, 10).map((err, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-accent-rose truncate">
                        <span className="line-through opacity-60">{err.original}</span>
                      </p>
                      <p className="text-[11px] text-emerald-600 truncate">
                        → {err.correction}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5 shrink-0">
                      ×{err.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Growth trajectory summary */}
          {chartData.length >= 3 && (
            <div className="bg-card rounded-2xl border border-sage-light/30 p-4">
              <p className="text-xs font-medium text-ink-light mb-2 flex items-center gap-1.5">
                <Zap size={12} className="text-sage-deep" />
                成长轨迹
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Fluency", key: "fluency" as const },
                  { label: "Grammar", key: "grammar" as const },
                  { label: "Vocab", key: "vocabulary" as const },
                  { label: "Natural", key: "naturalness" as const },
                ].map((dim) => {
                  const values = points
                    .map((p) => p[`${dim.key}_score` as keyof ProgressDataPoint] as number | null)
                    .filter((s): s is number => s !== null && s > 0);
                  const first = values.length >= 2 ? avgOfArray(values.slice(0, Math.max(1, Math.floor(values.length / 3)))) : null;
                  const last = values.length >= 2 ? avgOfArray(values.slice(-Math.max(1, Math.floor(values.length / 3)))) : null;
                  const diff = first !== null && last !== null ? last - first : null;
                  return (
                    <div key={dim.key} className="bg-ink/5 rounded-xl p-2.5">
                      <p className="text-[10px] text-ink-lighter">{dim.label}</p>
                      <p className="text-sm font-bold text-ink mt-0.5">
                        {last !== null ? last.toFixed(1) : "-"}
                      </p>
                      {diff !== null && (
                        <p className={cn(
                          "text-[10px] font-medium mt-0.5",
                          diff >= 0 ? "text-emerald-600" : "text-accent-rose",
                        )}>
                          {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
