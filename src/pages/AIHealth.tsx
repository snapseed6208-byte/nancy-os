// ============================================
// Nancy OS — AI Health Check Page
// Monitors all AI Edge Function call health.
// ============================================

import { useState, useCallback } from "react";
import { ArrowLeft, Cpu, RefreshCw, Trash2, CheckCircle2, XCircle, AlertTriangle, Clock, Activity, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { computeHealth, clearAIHealthHistory, type AIFunctionHealth, type AIHealthRecord } from "@/lib/ai/aiHealth";
import { invokeAI } from "@/lib/ai/aiService";

// ── Status helpers ──

const STATUS_CONFIG = {
  healthy: { dot: "bg-emerald-400", label: "正常", color: "text-emerald-600", bg: "bg-emerald-50" },
  degraded: { dot: "bg-amber-400", label: "降级", color: "text-amber-600", bg: "bg-amber-50" },
  down: { dot: "bg-red-400", label: "异常", color: "text-red-600", bg: "bg-red-50" },
} as const;

function StatusDot({ status }: { status: "healthy" | "degraded" | "down" }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
      <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

// ── Friendly names ──

const FUNCTION_LABELS: Record<string, string> = {
  "content-parser-agent": "内容解析",
  "daily-reflection-agent": "每日反思",
  "weekly-reflection-agent": "每周反思",
  "health-coach-agent": "健康教练",
  "health-checklist-agent": "健康清单",
  "health-video-agent": "训练视频分析",
  "english-coach-agent": "英语教练",
  "english-expression-agent": "英语表达",
  "english-speaking-agent": "英语口语",
  "career-agent": "职业规划",
  "exam-agent": "考试助手",
};

function friendlyName(name: string): string {
  return FUNCTION_LABELS[name] || name;
}

// ── Page ──

export default function AIHealth() {
  const [, navigate] = useLocation();
  const [health, setHealth] = useState(() => computeHealth());
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; ms: number; error?: string } | null>(null);

  const refresh = useCallback(() => {
    setHealth(computeHealth());
  }, []);

  const clearHistory = useCallback(() => {
    clearAIHealthHistory();
    setHealth(computeHealth());
    setPingResult(null);
  }, []);

  const testDeepSeek = useCallback(async () => {
    setPinging(true);
    setPingResult(null);
    const t0 = Date.now();
    try {
      const res = await invokeAI("content-parser-agent", {
        messages: [{ role: "user", content: "回复 OK" }],
      }, { timeout: 15_000 });
      const ms = Date.now() - t0;
      if (res.success) {
        setPingResult({ ok: true, ms });
      } else {
        setPingResult({ ok: false, ms, error: res.error });
      }
    } catch (e) {
      setPingResult({ ok: false, ms: Date.now() - t0, error: (e as Error).message });
    }
    setPinging(false);
    refresh();
  }, [refresh]);

  const { overallStatus, totalCalls, overallSuccessRate, functions, recentRecords } = health;
  const isEmpty = totalCalls === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/settings")}
            className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-card-hover transition-colors"
          >
            <ArrowLeft size={18} className="text-ink-light" />
          </button>
          <h1 className="text-xl font-semibold text-ink">AI 运行状态</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={testDeepSeek}
            disabled={pinging}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium bg-accent-sky/10 text-accent-sky hover:bg-accent-sky/20 transition-colors disabled:opacity-50"
          >
            <Zap size={13} className={pinging ? "animate-spin" : ""} />
            {pinging ? "测试中..." : "连通性测试"}
          </button>
          <button
            onClick={refresh}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-card-hover transition-colors"
            title="刷新"
          >
            <RefreshCw size={15} className="text-ink-light" />
          </button>
          {!isEmpty && (
            <button
              onClick={clearHistory}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent-rose/10 transition-colors"
              title="清空历史"
            >
              <Trash2 size={14} className="text-ink-lighter" />
            </button>
          )}
        </div>
      </header>

      {/* Ping result banner */}
      {pingResult && (
        <div className={cn(
          "flex items-center gap-2 rounded-xl px-4 py-3 text-sm",
          pingResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
        )}>
          {pingResult.ok
            ? <CheckCircle2 size={16} className="text-emerald-500" />
            : <AlertTriangle size={16} className="text-amber-500" />}
          {pingResult.ok
            ? `DeepSeek API 连通正常 · 响应时间 ${formatDuration(pingResult.ms)}`
            : `连通性测试失败: ${pingResult.error || "未知错误"} (${formatDuration(pingResult.ms)})`}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <section className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
              <Activity size={22} className="text-sage-deep" />
            </div>
            <h3 className="text-base font-semibold text-ink mb-2">暂无 AI 调用记录</h3>
            <p className="text-sm text-ink-lighter max-w-md mx-auto mb-6">
              AI 健康监控将在 Edge Function 迁移到统一 AI Service 层后自动启用。
              你可以点击上方「连通性测试」验证 DeepSeek API 是否可达。
            </p>
            <button
              onClick={testDeepSeek}
              disabled={pinging}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium bg-sage-light text-sage-deep hover:bg-sage-light/80 transition-colors disabled:opacity-50"
            >
              <Zap size={15} className={pinging ? "animate-spin" : ""} />
              {pinging ? "测试中..." : "测试 DeepSeek 连通性"}
            </button>
          </div>
        </section>
      )}

      {/* Overall status card */}
      {!isEmpty && (
        <section className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">总览</p>
          </div>
          <div className="px-4 py-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center">
                <Cpu size={18} className="text-sage-deep" />
              </div>
              <div>
                <p className="text-xs text-ink-lighter">DeepSeek API</p>
                <StatusDot status={overallStatus} />
              </div>
            </div>
            <div className="h-8 w-px bg-border/50" />
            <div>
              <p className="text-xs text-ink-lighter">总调用次数</p>
              <p className="text-lg font-semibold text-ink">{totalCalls}</p>
            </div>
            <div className="h-8 w-px bg-border/50" />
            <div>
              <p className="text-xs text-ink-lighter">成功率</p>
              <p className={cn(
                "text-lg font-semibold",
                overallSuccessRate >= 0.9 ? "text-emerald-600" : overallSuccessRate >= 0.5 ? "text-amber-600" : "text-red-600",
              )}>
                {(overallSuccessRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="h-8 w-px bg-border/50" />
            <div>
              <p className="text-xs text-ink-lighter">监控函数</p>
              <p className="text-lg font-semibold text-ink">{functions.length}</p>
            </div>
          </div>
        </section>
      )}

      {/* Per-function cards */}
      {functions.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider px-1">各功能状态</p>
          {functions.map((fn) => (
            <FunctionCard key={fn.functionName} fn={fn} />
          ))}
        </section>
      )}

      {/* Recent calls */}
      {recentRecords.length > 0 && (
        <section className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">最近调用</p>
          </div>
          <div className="divide-y divide-border/50">
            {recentRecords.slice(0, 15).map((rec) => (
              <RecentCallRow key={rec.id} record={rec} />
            ))}
          </div>
        </section>
      )}

      {/* Legend */}
      {!isEmpty && (
        <div className="flex items-center gap-4 text-[11px] text-ink-lighter pb-4">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> 正常 (&ge;90% 成功率)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> 降级 (&ge;50%)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" /> 异常 (&lt;50%)
          </span>
        </div>
      )}
    </div>
  );
}

// ── Function card ──

function FunctionCard({ fn }: { fn: AIFunctionHealth }) {
  const cfg = STATUS_CONFIG[fn.status];
  const successPct = (fn.successRate * 100).toFixed(0);

  return (
    <div className={cn("bg-white border border-border rounded-2xl overflow-hidden", fn.status === "degraded" && "ring-1 ring-amber-200", fn.status === "down" && "ring-1 ring-red-200")}>
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Status icon */}
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
          {fn.status === "healthy" && <CheckCircle2 size={16} className={cfg.color} />}
          {fn.status === "degraded" && <AlertTriangle size={16} className={cfg.color} />}
          {fn.status === "down" && <XCircle size={16} className={cfg.color} />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">{friendlyName(fn.functionName)}</p>
            <StatusDot status={fn.status} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-ink-lighter">
            <span>共 {fn.totalCalls} 次调用</span>
            <span>成功率 {successPct}%</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              平均 {formatDuration(fn.avgDuration)}
            </span>
            {fn.lastCallAt && (
              <span>最后调用 {formatTimeAgo(fn.lastCallAt)}</span>
            )}
          </div>
          {/* Warning details */}
          {fn.status !== "healthy" && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {fn.recentTimeouts > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  最近 {fn.recentTimeouts} 次超时
                </span>
              )}
              {fn.recentFailures > 0 && fn.recentTimeouts === 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                  最近 {fn.recentFailures} 次失败
                </span>
              )}
              {fn.lastError && (
                <span className="text-[11px] text-ink-lighter truncate max-w-[300px]" title={fn.lastError}>
                  · {fn.lastError}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recent call row ──

function RecentCallRow({ record }: { record: AIHealthRecord }) {
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 text-sm">
      {/* Status icon */}
      {record.success ? (
        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
      ) : (
        <XCircle size={14} className="text-red-400 shrink-0" />
      )}

      {/* Function name */}
      <span className="text-ink min-w-0 truncate flex-1">
        {friendlyName(record.functionName)}
      </span>

      {/* Duration */}
      <span className="text-ink-lighter text-xs tabular-nums shrink-0 w-14 text-right">
        {formatDuration(record.duration)}
      </span>

      {/* Error */}
      {!record.success && record.error ? (
        <span className="text-red-500 text-xs truncate max-w-[160px] shrink-0" title={record.error}>
          {record.error}
        </span>
      ) : (
        <span className="text-emerald-500 text-xs shrink-0">成功</span>
      )}

      {/* Time */}
      <span className="text-ink-lighter text-[11px] shrink-0 w-12 text-right">
        {formatTimeAgo(record.timestamp)}
      </span>
    </div>
  );
}
