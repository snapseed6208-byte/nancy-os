import { useRef, useEffect } from "react";
import { Loader2, RefreshCw, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  title: string;
  category: string;
  item_type: "baseline" | "ai";
  is_completed: boolean;
}

interface DailyChecklist {
  id: string;
  items: ChecklistItem[];
}

interface DailyHealthChecklistProps {
  checklist?: DailyChecklist | null;
  waterToday?: { total_ml: number; goal_ml: number } | null;
  foodToday?: Array<unknown> | null;
  workoutToday?: Array<unknown> | null;
  onToggleItem: (itemId: string, completed: boolean) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  isInitializing: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  water: "💧",
  workout: "🏋️",
  diet: "🥗",
  sleep: "😴",
  recovery: "🧘",
  habit: "✅",
};

export function DailyHealthChecklist({
  checklist,
  waterToday,
  foodToday,
  workoutToday,
  onToggleItem,
  onRegenerate,
  isRegenerating,
  isInitializing,
}: DailyHealthChecklistProps) {
  const autoCompleteRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!checklist?.items) return;

    for (const item of checklist.items) {
      if (item.is_completed) continue;
      if (autoCompleteRef.current.has(item.id)) continue;

      let shouldComplete = false;
      if (item.category === "water" && (waterToday?.total_ml ?? 0) >= 2000) {
        shouldComplete = true;
      }
      if (item.category === "diet" && (foodToday?.length ?? 0) >= 1) {
        shouldComplete = true;
      }
      if (item.category === "workout" && (workoutToday?.length ?? 0) > 0) {
        shouldComplete = true;
      }

      if (shouldComplete) {
        autoCompleteRef.current.add(item.id);
        onToggleItem(item.id, true);
      }
    }
  }, [checklist?.items, waterToday?.total_ml, foodToday?.length, workoutToday?.length]);

  if (isInitializing) {
    return (
      <section className="bg-gradient-to-br from-emerald-50/30 to-white border border-emerald-100 rounded-2xl p-4">
        <div className="flex items-center justify-center gap-2 py-3">
          <Loader2 size={16} className="animate-spin text-emerald-500" />
          <span className="text-xs text-ink-light">正在生成今日健康清单...</span>
        </div>
      </section>
    );
  }

  if (!checklist) return null;

  const baselineItems = checklist.items.filter((it) => it.item_type === "baseline");
  const aiItems = checklist.items.filter((it) => it.item_type === "ai");
  const completedCount = checklist.items.filter((it) => it.is_completed).length;
  const totalCount = checklist.items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section className="bg-gradient-to-br from-emerald-50/30 to-white border border-emerald-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-emerald-500" />
          <h2 className="text-[13px] font-semibold text-ink">今日健康清单</h2>
        </div>
        <button onClick={onRegenerate} disabled={isRegenerating}
          className="flex items-center gap-1 text-[10px] text-ink-lighter hover:text-ink-light transition-colors disabled:opacity-50">
          {isRegenerating ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          重新生成
        </button>
      </div>

      <div className="space-y-1.5 mb-3">
        {baselineItems.map((item) => (
          <button key={item.id}
            onClick={() => { if (item.category === "sleep") onToggleItem(item.id, !item.is_completed); }}
            disabled={item.category !== "sleep"}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all border",
              item.is_completed ? "bg-emerald-50/50 border-emerald-200" : "bg-white/60 border-border hover:border-emerald-200",
              item.category !== "sleep" && "cursor-default",
            )}>
            <div className={cn("h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
              item.is_completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-ink/20 bg-white text-transparent")}>
              {item.is_completed && <Check size={11} strokeWidth={3} />}
            </div>
            <span className="text-lg shrink-0">{CATEGORY_ICONS[item.category] || "📋"}</span>
            <span className={cn("text-xs font-medium flex-1 text-left", item.is_completed ? "text-emerald-700" : "text-ink")}>
              {item.title}
            </span>
            {item.is_completed ? (
              <span className="text-[10px] text-emerald-500 font-medium shrink-0">已完成</span>
            ) : item.category === "sleep" ? (
              <span className="text-[10px] text-ink-lighter shrink-0">手动</span>
            ) : (
              <span className="text-[10px] text-ink-lighter shrink-0">自动</span>
            )}
          </button>
        ))}
      </div>

      {aiItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="h-px flex-1 bg-emerald-100" />
            <span className="text-[10px] text-emerald-400 font-medium">AI 今日关注</span>
            <div className="h-px flex-1 bg-emerald-100" />
          </div>
          {aiItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-emerald-50/30">
              <span className="text-sm shrink-0 mt-0.5">{CATEGORY_ICONS[item.category] || "💡"}</span>
              <p className="text-[11px] text-ink-light leading-relaxed">{item.title}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-emerald-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-ink-lighter">进度 {completedCount}/{totalCount}</span>
          <span className={cn("text-[10px] font-medium", pct === 100 ? "text-emerald-500" : "text-ink-lighter")}>
            {pct}%
          </span>
        </div>
        <div className="bg-emerald-100 rounded-full h-1.5 overflow-hidden">
          <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  );
}
