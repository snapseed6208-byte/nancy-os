import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Loader2, AlertTriangle, Calendar, ChevronRight,
  CheckCircle2, Mic, MoreHorizontal, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useChineseSpeakingSessions,
  useSoftDeleteChineseSpeakingSession,
  TOPIC_TYPE_LABELS,
  FRAMEWORK_LABELS,
  type ChineseTopicType,
  type ChineseFramework,
} from "@/lib/hooks/useChineseSpeaking";
import { getBeijingDateString } from "@/lib/date";

const TOPIC_TYPE_FILTERS = ["", "opinion", "experience", "concept", "reflection", "interview", "story"] as const;

export default function ChineseSpeakingHistory() {
  const [, navigate] = useLocation();
  const { data: sessions, isLoading, error } = useChineseSpeakingSessions();
  const softDelete = useSoftDeleteChineseSpeakingSession();

  const [filterType, setFilterType] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const filteredSessions = filterType
    ? sessions?.filter((s) => s.topic_type === filterType)
    : sessions;

  const handleDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      await softDelete.mutateAsync(sessionId);
      setShowDeleteConfirm(null);
    } catch {
      // Error handled by mutation
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/chinese")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">中文表达</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">历史记录</h1>
        </div>
      </header>

      {/* Topic type filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TOPIC_TYPE_FILTERS.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filterType === type
                ? "bg-sage-light text-sage-deep"
                : "bg-ink/5 text-ink-light hover:bg-ink/10",
            )}
          >
            {type === "" ? "全部" : TOPIC_TYPE_LABELS[type as ChineseTopicType]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-sage-deep" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-4 text-sm text-accent-rose flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>加载失败：{(error as Error).message}</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && filteredSessions?.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Mic size={32} className="opacity-30 mx-auto" />
          <p className="text-sm text-ink-lighter">
            {filterType ? "该类型暂无记录" : "还没有练习记录"}
          </p>
          <button onClick={() => navigate("/chinese")} className="text-sm text-sage-deep font-medium underline">
            开始第一次练习
          </button>
        </div>
      )}

      {/* Session list */}
      {!isLoading && !error && filteredSessions && filteredSessions.length > 0 && (
        <div className="space-y-2">
          {filteredSessions.map((s) => {
            const round1 = s.attempts?.find((a) => a.attempt_round === 1 && !a.is_retry);
            const round2 = s.attempts?.find((a) => a.attempt_round === 2);
            const hasRetry = !!round2;
            const r1Scores = round1?.scores as Record<string, unknown> | null;
            const r1Diagnosis = round1?.diagnosis as Record<string, unknown> | null;
            const score =
              typeof r1Scores?.overall_score === "number" ? r1Scores.overall_score as number
              : typeof r1Scores?.total === "number" ? r1Scores.total as number
              : typeof (r1Diagnosis?.overall as Record<string, unknown> | null)?.score === "number"
                ? (r1Diagnosis!.overall as Record<string, unknown>).score as number
              : undefined;

            return (
              <button
                key={s.id}
                onClick={() => navigate(`/chinese/detail/${s.id}`)}
                className="w-full bg-card rounded-xl border border-border p-3 text-left hover:border-sage-light/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {s.topic_type && (
                        <span className="text-[10px] bg-ink/5 text-ink-light rounded-full px-2 py-0.5">
                          {TOPIC_TYPE_LABELS[s.topic_type as ChineseTopicType]}
                        </span>
                      )}
                      {s.recommended_framework && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">
                          {FRAMEWORK_LABELS[s.recommended_framework as ChineseFramework]}
                        </span>
                      )}
                      {hasRetry && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                          <CheckCircle2 size={10} className="inline mr-0.5" />
                          已重讲
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-ink truncate">{s.topic}</p>
                    <p className="text-[10px] text-ink-lighter mt-0.5">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString("zh-CN") : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {score != null && (
                      <span className="text-lg font-semibold text-sage-deep">{score}</span>
                    )}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(showDeleteConfirm === s.id ? null : s.id);
                        }}
                        className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5"
                      >
                        <MoreHorizontal size={14} className="text-ink-lighter" />
                      </button>
                      {showDeleteConfirm === s.id && (
                        <div
                          className="absolute right-0 top-8 bg-white border border-border rounded-xl shadow-lg p-2 z-20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="flex items-center gap-2 text-xs text-accent-rose px-3 py-1.5 rounded-lg hover:bg-accent-rose/5 whitespace-nowrap disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            {deletingId === s.id ? "删除中..." : "删除"}
                          </button>
                        </div>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-ink-lighter" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
