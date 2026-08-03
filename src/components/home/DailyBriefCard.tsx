import { Loader2, Brain, Target, ThumbsUp, ThumbsDown, RefreshCw, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIPreference } from "@/lib/hooks/useUIPreference";
import type { DailyBrief, DailyBriefSuggestion, DailyBriefWarning } from "@/lib/types";

const WARNING_ICONS: Record<string, string> = {
  mood: "😰", habit: "⏰", task: "📋", health: "💪", review: "📝", general: "💡",
};

interface DailyBriefCardProps {
  brief: DailyBrief;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onFeedback: (rating: "helpful" | "not_helpful") => void;
  feedbackSent: boolean;
  feedbackPending: boolean;
}

export function DailyBriefCard({
  brief,
  onRegenerate,
  isRegenerating,
  onFeedback,
  feedbackSent,
  feedbackPending,
}: DailyBriefCardProps) {
  const [expanded, setExpanded] = useUIPreference("brief_expanded", false);
  const suggestions = (brief.suggestions || []) as DailyBriefSuggestion[];
  const warnings = (brief.warnings || []) as DailyBriefWarning[];

  return (
    <div className="bg-gradient-to-br from-sage-light/10 to-white border border-sage-light/30 rounded-2xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 pb-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-sage-deep" />
          <h2 className="text-sm font-semibold text-ink">今日 AI 简报</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
            disabled={isRegenerating}
            className="flex items-center gap-1 text-[10px] text-ink-lighter hover:text-ink-light transition-colors disabled:opacity-50"
          >
            {isRegenerating ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            重新生成
          </button>
          {expanded
            ? <ChevronDown size={16} className="text-ink-lighter shrink-0" />
            : <ChevronRight size={16} className="text-ink-lighter shrink-0" />
          }
        </div>
      </button>

      {/* Summary — always visible, truncated when collapsed */}
      <div className="px-4 pb-3">
        {brief.summary && (
          <div className="mb-2">
            <p className="text-[10px] text-ink-lighter mb-0.5">昨日回顾</p>
            <p className={cn("text-xs text-ink-light leading-relaxed", !expanded && "line-clamp-2")}>
              {brief.summary}
            </p>
          </div>
        )}

        {brief.focus && (
          <div className="flex items-start gap-2 bg-white/60 rounded-xl p-3 border border-sage-light/20">
            <Target size={14} className="text-sage-deep shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] text-ink-lighter mb-0.5">今日重点</p>
              <p className={cn("text-sm font-medium text-ink", !expanded && "line-clamp-1")}>{brief.focus}</p>
            </div>
          </div>
        )}

        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-2 w-full text-center text-[11px] text-sage-deep hover:text-sage-deep/70 transition-colors py-1"
          >
            展开详情
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <>
          {brief.motivation && (
            <p className="text-xs text-sage-deep italic text-center py-2 border-t border-sage-light/20 px-4">
              {brief.motivation}
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="border-t border-sage-light/20 px-4 py-3 bg-white/40">
              <p className="text-[10px] text-ink-lighter mb-2">个性化建议</p>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <a key={i}
                    href={s.action_path || "#"}
                    onClick={(e) => {
                      if (!s.action_path) return;
                      e.preventDefault();
                      window.history.pushState({}, "", s.action_path);
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white border border-border hover:border-sage-light/30 transition-colors group">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
                      s.priority === "high" ? "bg-accent-rose/10 text-accent-rose"
                        : s.priority === "medium" ? "bg-amber-50 text-amber-600"
                        : "bg-ink/5 text-ink-light",
                    )}>
                      {s.priority === "high" ? "优先" : s.priority === "medium" ? "建议" : "可选"}
                    </span>
                    <span className="text-xs text-ink flex-1">{s.suggestion}</span>
                    {s.action_label && (
                      <span className="text-[10px] text-sage-deep font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {s.action_label}<ChevronRight size={10} />
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="border-t border-accent-rose/10 px-4 py-3 bg-accent-rose/[0.02]">
              <p className="text-[10px] text-ink-lighter mb-2">风险提醒</p>
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5 last:mb-0">
                  <span className="text-sm shrink-0">{WARNING_ICONS[w.type] || "⚠️"}</span>
                  <p className="text-xs text-ink-light leading-relaxed">{w.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border/50 px-4 py-2 flex items-center gap-3">
            <p className="text-[10px] text-ink-lighter">这份简报对你有帮助吗？</p>
            <div className="flex gap-1">
              <button onClick={() => onFeedback("helpful")} disabled={feedbackSent || feedbackPending}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors",
                  feedbackSent ? "text-ink-lighter cursor-default" : "text-ink-light hover:bg-emerald-50 hover:text-emerald-600",
                )}>
                <ThumbsUp size={10} />有帮助
              </button>
              <button onClick={() => onFeedback("not_helpful")} disabled={feedbackSent || feedbackPending}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition-colors",
                  feedbackSent ? "text-ink-lighter cursor-default" : "text-ink-light hover:bg-accent-rose/10 hover:text-accent-rose",
                )}>
                <ThumbsDown size={10} />不太准
              </button>
            </div>
            {feedbackSent && <span className="text-[10px] text-emerald-500">感谢反馈</span>}
          </div>
        </>
      )}
    </div>
  );
}
