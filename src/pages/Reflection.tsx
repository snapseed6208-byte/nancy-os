import { useState } from "react";
import { ArrowLeft, RefreshCw, Loader2, AlertTriangle, Lightbulb, Brain, TrendingUp, Calendar, Target, ChevronRight, Check, X, Eye, FileText } from "lucide-react";
import { useLocation } from "wouter";
import {
  useReflections,
  useGenerateReflection,
  useCandidateMemories,
  useConfirmMemory,
  useRejectMemory,
  type ReflectionResult,
  type MemoryResult,
} from "@/lib/hooks/useReflection";
import { cn } from "@/lib/utils";

const MEMORY_TYPE_LABELS: Record<string, string> = {
  preference: "偏好", personality: "性格", habit: "习惯", insight: "洞察", skill: "能力",
};

const MEMORY_TYPE_COLORS: Record<string, string> = {
  preference: "bg-purple-50 border-purple-200 text-purple-700",
  personality: "bg-blue-50 border-blue-200 text-blue-700",
  habit: "bg-emerald-50 border-emerald-200 text-emerald-700",
  insight: "bg-amber-50 border-amber-200 text-amber-700",
  skill: "bg-sage-light/50 border-sage-light text-sage-deep",
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  candidate: { label: "待确认", color: "bg-amber-50 text-amber-600" },
  probable: { label: "可能", color: "bg-blue-50 text-blue-600" },
  confirmed: { label: "已确认", color: "bg-emerald-50 text-emerald-600" },
  rejected: { label: "已拒绝", color: "bg-ink/5 text-ink-light" },
  outdated: { label: "已过期", color: "bg-ink/5 text-ink-lighter" },
};

const CATEGORY_LABELS: Record<string, string> = {
  personal_growth: "个人成长", productivity: "效率", emotional: "情绪", social: "社交", health: "健康",
};

// ── Sub-components ──

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 0.7 ? "bg-emerald-50 text-emerald-600" : confidence >= 0.5 ? "bg-amber-50 text-amber-600" : "bg-ink/5 text-ink-light";
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", color)}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

function MoodTrends({ data }: { data: ReflectionResult["mood_trends"] }) {
  const dirLabel = { improving: "📈 上升", stable: "➡️ 平稳", declining: "📉 下降" };
  const dirColor = { improving: "text-emerald-500", stable: "text-ink-light", declining: "text-accent-rose" };
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <SectionHeader icon={<TrendingUp size={16} className="text-ink-light" />} title="情绪趋势" />
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{data.dominant_mood}</span>
        <span className={cn("text-sm font-medium", dirColor[data.trend_direction])}>
          {dirLabel[data.trend_direction]}
        </span>
      </div>
      <p className="text-xs text-ink-light leading-relaxed">{data.detail}</p>
    </div>
  );
}

function BehaviorPatterns({ patterns }: { patterns: ReflectionResult["behavior_patterns"] }) {
  if (!patterns || patterns.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <SectionHeader icon={<Brain size={16} className="text-ink-light" />} title="行为模式" />
      <div className="space-y-3">
        {patterns.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-ink">{p.pattern}</span>
                <ConfidenceBadge confidence={p.confidence} />
              </div>
              <p className="text-xs text-ink-lighter">{p.evidence}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthInsights({ insights }: { insights: ReflectionResult["growth_insights"] }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <SectionHeader icon={<Lightbulb size={16} className="text-ink-light" />} title="成长洞察" />
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-ink-lighter bg-ink/5 rounded-lg px-1.5 py-0.5">
                  {CATEGORY_LABELS[ins.category] || ins.category}
                </span>
                <ConfidenceBadge confidence={ins.confidence} />
              </div>
              <p className="text-sm text-ink">{ins.insight}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TomorrowSuggestions({ suggestions }: { suggestions: ReflectionResult["tomorrow_suggestions"] }) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <SectionHeader icon={<Target size={16} className="text-ink-light" />} title="明日建议" />
      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 mt-0.5",
              s.priority === "high" ? "bg-accent-rose/10 text-accent-rose" :
              s.priority === "medium" ? "bg-amber-50 text-amber-600" : "bg-ink/5 text-ink-light",
            )}>
              {s.priority === "high" ? "优先" : s.priority === "medium" ? "建议" : "可选"}
            </span>
            <p className="text-sm text-ink">{s.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemoryEvidencePopover({ memory }: { memory: MemoryResult }) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="text-[10px] text-ink-lighter underline shrink-0 flex items-center gap-0.5">
        <Eye size={10} /> 为什么？
      </button>
    );
  }
  return (
    <div className="mt-2 bg-ink/5 rounded-lg p-2 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-ink-light">AI 推断依据</p>
        <button onClick={() => setShow(false)} className="text-ink-lighter"><X size={10} /></button>
      </div>
      <p className="text-[10px] text-ink-lighter leading-relaxed">
        置信度 {Math.round(memory.confidence * 100)}% · 已验证 {memory.reinforcement_count} 次 · 状态: {STATUS_BADGE[memory.status]?.label || memory.status}
      </p>
      {memory.action === "updated" && (
        <p className="text-[10px] text-ink-lighter">
          此记忆与已有记录匹配，已合并强化。
        </p>
      )}
    </div>
  );
}

function ExtractedMemories({ memories, onConfirm, onReject, confirming, rejecting }: {
  memories: MemoryResult[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  confirming: string | null;
  rejecting: string | null;
}) {
  if (!memories || memories.length === 0) return null;

  const newCount = memories.filter((m) => m.is_new).length;
  const updatedCount = memories.filter((m) => !m.is_new).length;

  return (
    <div className="bg-card rounded-2xl border border-sage-light/50 p-4">
      <SectionHeader icon={<Brain size={16} className="text-ink-light" />} title="提取的记忆" />
      <p className="text-xs text-ink-lighter mb-3">
        新增 {newCount} 条{updatedCount > 0 && ` · 强化 ${updatedCount} 条已有记忆`}
      </p>
      <div className="space-y-2">
        {memories.map((m) => {
          const badge = STATUS_BADGE[m.status] || STATUS_BADGE.candidate;
          const isBusy = confirming === m.id || rejecting === m.id;
          return (
            <div key={m.id} className={cn(
              "rounded-xl border px-3 py-2 transition-colors",
              MEMORY_TYPE_COLORS[m.memory_type] || "border-border bg-ink/5",
            )}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-medium opacity-70">
                  {MEMORY_TYPE_LABELS[m.memory_type] || m.memory_type}
                </span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", badge.color)}>
                  {badge.label}
                </span>
                <ConfidenceBadge confidence={m.confidence} />
              </div>
              <p className="text-xs leading-relaxed mb-2">{m.content}</p>
              <MemoryEvidencePopover memory={m} />
              {/* Confirm/Reject buttons for non-confirmed memories */}
              {(m.status === "candidate" || m.status === "probable") && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                  <button
                    onClick={() => onConfirm(m.id)}
                    disabled={isBusy}
                    className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {isBusy && confirming ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                    确认
                  </button>
                  <button
                    onClick={() => onReject(m.id)}
                    disabled={isBusy}
                    className="flex items-center gap-1 text-[10px] font-medium text-accent-rose bg-accent-rose/5 rounded-lg px-2 py-1 hover:bg-accent-rose/10 transition-colors disabled:opacity-50"
                  >
                    {isBusy && rejecting ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                    忽略
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateMemoryCard({ memory, onConfirm, onReject, confirming, rejecting }: {
  memory: Record<string, unknown>;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  confirming: string | null;
  rejecting: string | null;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const status = (memory.status as string) || "candidate";
  const badge = STATUS_BADGE[status] || STATUS_BADGE.candidate;
  const id = memory.id as string;
  const evidence = (memory.evidence as Array<Record<string, unknown>>) || [];
  const isBusy = confirming === id || rejecting === id;

  return (
    <div className={cn("rounded-xl border px-3 py-2", MEMORY_TYPE_COLORS[memory.memory_type as string] || "border-border bg-ink/5")}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-medium opacity-70">
          {MEMORY_TYPE_LABELS[memory.memory_type as string] || (memory.memory_type as string)}
        </span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", badge.color)}>
          {badge.label}
        </span>
        <ConfidenceBadge confidence={(memory.confidence as number) || 0.5} />
        <span className="text-[10px] text-ink-lighter">
          已验证 {(memory.reinforcement_count as number) || 1} 次
        </span>
      </div>
      <p className="text-xs leading-relaxed mb-1">{memory.content as string}</p>

      {showEvidence && evidence.length > 0 && (
        <div className="mt-2 bg-ink/5 rounded-lg p-2 space-y-1">
          <p className="text-[10px] font-medium text-ink-light">证据来源</p>
          {evidence.slice(0, 3).map((e: Record<string, unknown>, i: number) => (
            <div key={i} className="flex items-start gap-1">
              <FileText size={10} className="shrink-0 mt-0.5 text-ink-lighter" />
              <p className="text-[10px] text-ink-lighter truncate">
                {e.table as string} · {String((e.snippet as string) || "").slice(0, 80)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="flex items-center gap-1 text-[10px] text-ink-lighter rounded-lg px-2 py-1 hover:bg-ink/5 transition-colors"
        >
          <Eye size={10} />
          {showEvidence ? "收起" : `证据 (${evidence.length})`}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onConfirm(id)}
          disabled={isBusy}
          className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1 hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          {isBusy && confirming ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
          确认
        </button>
        <button
          onClick={() => onReject(id)}
          disabled={isBusy}
          className="flex items-center gap-1 text-[10px] font-medium text-accent-rose bg-accent-rose/5 rounded-lg px-2 py-1 hover:bg-accent-rose/10 transition-colors disabled:opacity-50"
        >
          {isBusy && rejecting ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
          忽略
        </button>
      </div>
    </div>
  );
}

// ── Past reflection card ──

function PastReflectionCard({ insight }: { insight: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const data = (insight.data as Record<string, unknown>) || {};
  const memoryCount = (data.extracted_memory_ids as string[])?.length || 0;

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-ink">{insight.title as string}</p>
          <p className="text-xs text-ink-lighter">
            {new Date(insight.generated_at as string).toLocaleDateString("zh-CN")}
            {memoryCount > 0 && ` · ${memoryCount} 条记忆`}
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-ink-lighter">
          <ChevronRight size={14} className={cn("transition-transform", expanded && "rotate-90")} />
        </button>
      </div>
      <p className="text-xs text-ink-light leading-relaxed line-clamp-2">{insight.content as string}</p>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {data.mood_trends ? (
            <div className="text-xs text-ink-light">
              主要情绪: {(data.mood_trends as Record<string, unknown>).dominant_mood as string}
              {" · "}
              趋势: {(data.mood_trends as Record<string, unknown>).trend_direction as string}
            </div>
          ) : null}
          {data.tomorrow_suggestions ? (
            <div className="text-xs text-ink-light">
              建议: {(data.tomorrow_suggestions as Array<Record<string, unknown>>).map((s) => s.suggestion as string).join("；")}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Page ──

export default function Reflection() {
  const [, navigate] = useLocation();
  const { data: reflections, isLoading: loadingPast } = useReflections();
  const { data: candidateMemories, isLoading: loadingCandidates } = useCandidateMemories();
  const generate = useGenerateReflection();
  const confirmMemory = useConfirmMemory();
  const rejectMemory = useRejectMemory();

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    try { await confirmMemory.mutateAsync(id); } catch { /* error shown by mutation state */ }
    setConfirmingId(null);
  };

  const handleReject = async (id: string) => {
    setRejectingId(id);
    try { await rejectMemory.mutateAsync({ memoryId: id }); } catch { /* error shown by mutation state */ }
    setRejectingId(null);
  };

  const candidateList = (candidateMemories || []) as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">AI Agent</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">AI 反思</h1>
        </div>
      </header>

      {/* Description */}
      <div className="bg-sage-light/20 border border-sage-light/30 rounded-2xl p-4">
        <p className="text-xs text-sage-deep leading-relaxed">
          反思 Agent 会读取你过去 7 天的日记、心情、想法、事件、任务和习惯数据，
          生成周期总结、情绪趋势、行为模式、成长洞察和明日建议。
          提取的记忆需要你确认后才会被其他 AI Agent 使用。
        </p>
      </div>

      {/* Generate button */}
      <button
        onClick={() => generate.mutate()}
        disabled={generate.isPending}
        className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {generate.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            分析中...（约15-30秒）
          </>
        ) : (
          <>
            <RefreshCw size={16} />
            生成新的反思
          </>
        )}
      </button>

      {/* Error states */}
      {generate.error && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 text-xs text-accent-rose flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">生成失败</p>
            <p className="mt-0.5">{(generate.error as Error).message}</p>
          </div>
        </div>
      )}

      {/* Candidate Memory Review (standalone section) */}
      {!generate.data && candidateList.length > 0 && (
        <div className="bg-card rounded-2xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <h2 className="text-sm font-semibold text-ink">待审核记忆 ({candidateList.length})</h2>
          </div>
          <p className="text-xs text-ink-lighter mb-3">
            以下记忆需要你确认后才能被 AI Agent 使用。点击"确认"接受，"忽略"拒绝。
          </p>
          <div className="space-y-2">
            {candidateList.map((m) => (
              <CandidateMemoryCard
                key={m.id as string}
                memory={m}
                onConfirm={handleConfirm}
                onReject={handleReject}
                confirming={confirmingId}
                rejecting={rejectingId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {generate.data && (
        <div className="space-y-3 animate-in fade-in">
          {/* Period summary */}
          <div className="bg-card rounded-2xl border border-sage-light/50 p-4">
            <SectionHeader icon={<Calendar size={16} className="text-ink-light" />} title="周期总结" />
            <p className="text-sm text-ink leading-relaxed">{generate.data.period_summary}</p>
            {generate.data.data_points != null && (
              <p className="text-xs text-ink-lighter mt-2">
                分析了 {generate.data.data_points} 条数据 · {generate.data.tokens_used} tokens · {(generate.data.duration_ms || 0) / 1000}s
              </p>
            )}
          </div>

          <MoodTrends data={generate.data.mood_trends} />
          <BehaviorPatterns patterns={generate.data.behavior_patterns} />
          <GrowthInsights insights={generate.data.growth_insights} />
          <TomorrowSuggestions suggestions={generate.data.tomorrow_suggestions} />
          <ExtractedMemories
            memories={generate.data.extracted_memories}
            onConfirm={handleConfirm}
            onReject={handleReject}
            confirming={confirmingId}
            rejecting={rejectingId}
          />
        </div>
      )}

      {/* Past reflections */}
      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">历史反思</h2>
        {loadingPast ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-ink-lighter" />
          </div>
        ) : !reflections || reflections.length === 0 ? (
          <div className="text-center py-8 bg-card rounded-2xl border border-border">
            <Brain size={28} className="text-ink-lighter mx-auto mb-2" />
            <p className="text-xs text-ink-lighter">还没有 AI 反思记录</p>
            <p className="text-xs text-ink-lighter mt-1">点击上方按钮生成你的第一次 AI 反思</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reflections.map((r) => (
              <PastReflectionCard key={r.id as string} insight={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
