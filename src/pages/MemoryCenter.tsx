import { useState } from "react";
import { ArrowLeft, Brain, Check, X, Eye, FileText, Edit3, AlertTriangle, Clock, Loader2, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import {
  useAllMemories,
  useMemoryStats,
  useOutdatedCandidates,
  useConfirmMemory,
  useRejectMemory,
  useModifyMemory,
  useMarkPendingReview,
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

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  candidate: { label: "待确认", color: "text-amber-600", bg: "bg-amber-50" },
  probable: { label: "可能", color: "text-blue-600", bg: "bg-blue-50" },
  confirmed: { label: "已确认", color: "text-emerald-600", bg: "bg-emerald-50" },
  rejected: { label: "已拒绝", color: "text-ink-light", bg: "bg-ink/5" },
  outdated: { label: "已过期", color: "text-ink-lighter", bg: "bg-ink/5" },
  pending_review: { label: "待审核", color: "text-accent-rose", bg: "bg-accent-rose/5" },
};

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "confirmed", label: "已确认" },
  { key: "probable", label: "可能" },
  { key: "candidate", label: "待确认" },
  { key: "pending_review", label: "待审核" },
  { key: "rejected", label: "已拒绝" },
];

const TYPE_FILTERS = [
  { key: "", label: "全部类型" },
  { key: "preference", label: "偏好" },
  { key: "personality", label: "性格" },
  { key: "habit", label: "习惯" },
  { key: "insight", label: "洞察" },
  { key: "skill", label: "能力" },
];

// ── Sub-components ──

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 0.7 ? "bg-emerald-50 text-emerald-600" :
    confidence >= 0.5 ? "bg-amber-50 text-amber-600" :
    "bg-ink/5 text-ink-light";
  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", color)}>
      {Math.round(confidence * 100)}%
    </span>
  );
}

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 text-center">
      <p className={cn("text-2xl font-bold", color)}>{count}</p>
      <p className="text-[10px] text-ink-lighter mt-0.5">{label}</p>
    </div>
  );
}

function MemoryEvidence({ evidence, memoryId }: { evidence: Array<Record<string, unknown>>; memoryId: string }) {
  const [show, setShow] = useState(false);
  if (!evidence || evidence.length === 0) return null;

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-[10px] text-ink-lighter underline flex items-center gap-0.5"
      >
        <Eye size={10} /> 证据 ({evidence.length})
      </button>
    );
  }

  return (
    <div className="mt-2 bg-ink/5 rounded-lg p-2 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-ink-light">证据来源</p>
        <button onClick={() => setShow(false)} className="text-ink-lighter"><X size={10} /></button>
      </div>
      {evidence.slice(0, 5).map((e, i) => (
        <div key={i} className="flex items-start gap-1">
          <FileText size={10} className="shrink-0 mt-0.5 text-ink-lighter" />
          <p className="text-[10px] text-ink-lighter truncate">
            <span className="font-medium">{e.table as string}</span>
            {" · "}
            {String((e.snippet as string) || "").slice(0, 100)}
          </p>
        </div>
      ))}
    </div>
  );
}

function MemoryCard({
  memory,
  onConfirm,
  onReject,
  onModify,
  editingId,
  editContent,
  onEditChange,
  onEditStart,
  onEditSave,
  onEditCancel,
}: {
  memory: Record<string, unknown>;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  onModify: (id: string) => void;
  editingId: string | null;
  editContent: string;
  onEditChange: (value: string) => void;
  onEditStart: (id: string, content: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
}) {
  const id = memory.id as string;
  const status = (memory.status as string) || "candidate";
  const badge = STATUS_BADGE[status] || STATUS_BADGE.candidate;
  const evidence = (memory.evidence as Array<Record<string, unknown>>) || [];
  const isEditing = editingId === id;
  const lastReinforced = memory.last_reinforced_at
    ? new Date(memory.last_reinforced_at as string).toLocaleDateString("zh-CN")
    : null;

  return (
    <div className={cn(
      "rounded-xl border px-3 py-2.5 transition-colors",
      MEMORY_TYPE_COLORS[memory.memory_type as string] || "border-border bg-ink/5",
    )}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="text-[10px] font-medium opacity-70">
          {MEMORY_TYPE_LABELS[memory.memory_type as string] || (memory.memory_type as string)}
        </span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", badge.bg, badge.color)}>
          {badge.label}
        </span>
        <ConfidenceBadge confidence={(memory.confidence as number) || 0.5} />
        <span className="text-[10px] text-ink-lighter">
          强化 {(memory.reinforcement_count as number) || 1} 次
        </span>
        {lastReinforced && (
          <span className="text-[10px] text-ink-lighter flex items-center gap-0.5">
            <Clock size={10} /> {lastReinforced}
          </span>
        )}
      </div>

      {/* Content: view or edit */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => onEditChange(e.target.value)}
            className="w-full text-xs rounded-lg border border-border p-2 bg-white resize-y min-h-[60px]"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={onEditCancel}
              className="text-[10px] px-2 py-1 rounded-lg bg-ink/5 text-ink-light"
            >
              取消
            </button>
            <button
              onClick={() => onEditSave(id)}
              className="text-[10px] px-2 py-1 rounded-lg bg-sage-light text-sage-deep font-medium"
            >
              保存修改
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed mb-1.5">{memory.content as string}</p>
      )}

      {!isEditing && <MemoryEvidence evidence={evidence} memoryId={id} />}

      {/* Actions */}
      {!isEditing && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-border/50 flex-wrap">
          {(status === "candidate" || status === "probable" || status === "pending_review") && (
            <>
              <button
                onClick={() => onConfirm(id)}
                className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1 hover:bg-emerald-100 transition-colors"
              >
                <Check size={10} /> 确认
              </button>
              <button
                onClick={() => onReject(id)}
                className="flex items-center gap-1 text-[10px] font-medium text-accent-rose bg-accent-rose/5 rounded-lg px-2 py-1 hover:bg-accent-rose/10 transition-colors"
              >
                <X size={10} /> 忽略
              </button>
            </>
          )}
          <button
            onClick={() => onEditStart(id, memory.content as string)}
            className="flex items-center gap-1 text-[10px] text-ink-lighter rounded-lg px-2 py-1 hover:bg-ink/5 transition-colors"
          >
            <Edit3 size={10} /> 编辑
          </button>
          {(status === "confirmed" || status === "probable") && (
            <button
              onClick={() => onModify(id)}
              className="flex items-center gap-1 text-[10px] text-ink-lighter rounded-lg px-2 py-1 hover:bg-ink/5 transition-colors"
            >
              <RefreshCw size={10} /> 请求复审
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──

export default function MemoryCenter() {
  const [, navigate] = useLocation();
  const { data: stats } = useMemoryStats();
  const { data: outdatedCandidates, refetch: refetchOutdated } = useOutdatedCandidates();
  const confirmMemory = useConfirmMemory();
  const rejectMemory = useRejectMemory();
  const modifyMemory = useModifyMemory();
  const markPendingReview = useMarkPendingReview();

  const [activeTab, setActiveTab] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { data: memories, isLoading } = useAllMemories({
    status: activeTab || undefined,
    memoryType: typeFilter || undefined,
    limit: 100,
  });

  const handleConfirm = async (id: string) => {
    try { await confirmMemory.mutateAsync(id); } catch { /* mutation handles error */ }
  };

  const handleReject = async (id: string) => {
    try { await rejectMemory.mutateAsync({ memoryId: id }); } catch { /* mutation handles error */ }
  };

  const handleModify = async (id: string) => {
    try { await modifyMemory.mutateAsync({ memoryId: id, content: (memories?.find((m: Record<string, unknown>) => m.id === id)?.content as string) || "" }); } catch { /* mutation handles error */ }
  };

  const handleEditStart = (id: string, content: string) => {
    setEditingId(id);
    setEditContent(content);
  };

  const handleEditSave = async (id: string) => {
    if (editContent.trim()) {
      try { await modifyMemory.mutateAsync({ memoryId: id, content: editContent.trim() }); } catch { /* mutation handles error */ }
    }
    setEditingId(null);
    setEditContent("");
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleMarkAllOutdated = async () => {
    if (!outdatedCandidates?.length) return;
    for (const m of outdatedCandidates as Array<Record<string, unknown>>) {
      try { await markPendingReview.mutateAsync(m.id as string); } catch { /* continue */ }
    }
    refetchOutdated();
  };

  const outdatedCount = (outdatedCandidates as Array<Record<string, unknown>> | undefined)?.length || 0;
  const statsData = (stats || {}) as Record<string, number>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">AI Memory</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">记忆中心</h1>
        </div>
      </header>

      {/* Description */}
      <div className="bg-sage-light/20 border border-sage-light/30 rounded-2xl p-4">
        <p className="text-xs text-sage-deep leading-relaxed">
          记忆中心管理 Nancy OS 对你的长期认知。已确认的记忆会被下游 AI Agent 使用。
          定期审核待确认和待复审的记忆，保持记忆库的准确性和时效性。
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="总计" count={statsData.total || 0} color="text-ink" />
        <StatCard label="已确认" count={statsData.confirmed || 0} color="text-emerald-500" />
        <StatCard label="待处理" count={(statsData.candidate || 0) + (statsData.probable || 0) + (statsData.pending_review || 0)} color="text-amber-500" />
      </div>

      {/* Outdated alert */}
      {outdatedCount > 0 && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-accent-rose shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-accent-rose">
              {outdatedCount} 条记忆超过 90 天未强化
            </p>
            <p className="text-[10px] text-ink-lighter mt-0.5 mb-2">
              这些记忆可能已过时，建议标记为"待审核"进行复查。
            </p>
            <button
              onClick={handleMarkAllOutdated}
              disabled={markPendingReview.isPending}
              className="text-[10px] font-medium text-accent-rose bg-accent-rose/10 rounded-lg px-2 py-1 hover:bg-accent-rose/20 transition-colors disabled:opacity-50"
            >
              {markPendingReview.isPending ? "处理中..." : `全部标记为待审核 (${outdatedCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-sage-light text-sage-deep"
                  : "bg-ink/5 text-ink-light hover:bg-ink/10",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs rounded-lg border border-border px-2 py-1.5 bg-card text-ink-light"
        >
          {TYPE_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Memory list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-ink-lighter" />
        </div>
      ) : !memories || (memories as Array<Record<string, unknown>>).length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <Brain size={32} className="text-ink-lighter mx-auto mb-3" />
          <p className="text-sm text-ink-light mb-1">
            {activeTab
              ? `没有${STATUS_TABS.find((t) => t.key === activeTab)?.label || ""}状态的记忆`
              : "还没有任何 AI 记忆"}
          </p>
          <p className="text-xs text-ink-lighter">
            {activeTab ? "切换筛选条件查看其他记忆" : "使用 AI 反思功能生成第一批记忆"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(memories as Array<Record<string, unknown>>).map((m) => (
            <MemoryCard
              key={m.id as string}
              memory={m}
              onConfirm={handleConfirm}
              onReject={handleReject}
              onModify={handleModify}
              editingId={editingId}
              editContent={editContent}
              onEditChange={setEditContent}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
