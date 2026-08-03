import { useMemo } from "react";
import { useLocation } from "wouter";
import { Clock, Circle, CircleDot, CheckCircle2, FileText, Languages, ListTodo, Trophy, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIPreference } from "@/lib/hooks/useUIPreference";
import { aggregateReviewsAndSpeaking, aggregateHabits, type TimelineItem, type DashboardStats } from "@/lib/hooks/useDashboard";

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  task: ListTodo,
  habit: Trophy,
  journal: FileText,
  speaking: Languages,
  review: CheckCircle2,
};

const TYPE_COLORS: Record<string, string> = {
  task: "bg-accent-sky/10 text-accent-sky",
  habit: "bg-accent-warm/10 text-accent-warm",
  journal: "bg-accent-rose/10 text-accent-rose",
  speaking: "bg-accent-sky/10 text-accent-sky",
  review: "bg-sage-light text-sage-deep",
};

interface TimelineSectionProps {
  stats: NonNullable<DashboardStats>;
}

function AggregatedItem({ item }: { item: TimelineItem }) {
  const [, navigate] = useLocation();
  const TypeIcon = TYPE_ICONS[item.type] || Circle;
  const typeColor = TYPE_COLORS[item.type] || "bg-ink/5 text-ink-light";

  return (
    <button
      onClick={() => item.path && navigate(item.path)}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 bg-card border border-border/50",
        "hover:border-sage-light/30 transition-colors text-left",
        !item.path && "cursor-default",
      )}
    >
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", typeColor)}>
        <TypeIcon size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink font-medium">{item.title}</p>
        {item.summary && (
          <p className="text-[10px] text-ink-lighter mt-0.5">{item.summary}</p>
        )}
      </div>
      {item.metadata && (
        <div className="text-right shrink-0">
          {item.time && <span className="text-[10px] text-ink-lighter">{item.time}</span>}
          {(item.metadata.latestTime as string) && !item.time && (
            <span className="text-[10px] text-ink-lighter">最近 {item.metadata.latestTime as string}</span>
          )}
        </div>
      )}
      {item.path && (
        <ArrowRight size={10} className="text-ink-lighter shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

function IndividualItem({ item }: { item: TimelineItem }) {
  const [, navigate] = useLocation();
  const TypeIcon = TYPE_ICONS[item.type] || Circle;
  const typeColor = TYPE_COLORS[item.type] || "bg-ink/5 text-ink-light";

  return (
    <button
      onClick={() => item.path && navigate(item.path)}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2 bg-card border border-border/50",
        "hover:border-sage-light/30 transition-colors text-left",
        !item.path && "cursor-default",
      )}
    >
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", typeColor)}>
        <TypeIcon size={12} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-[10px] text-ink-lighter truncate">{item.subtitle}</p>
        )}
      </div>
      {item.time && (
        <span className="text-[10px] text-ink-lighter shrink-0">{item.time}</span>
      )}
      {item.path && (
        <ArrowRight size={10} className="text-ink-lighter shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  );
}

export function TimelineSection({ stats }: TimelineSectionProps) {
  const [expanded, setExpanded] = useUIPreference("timeline_expanded", false);

  const { completed, inProgress, pending } = stats.timeline;

  // Separate habit items from non-habit items for aggregation
  const { aggregated, habitNamesMap } = useMemo(() => {
    const nonHabitCompleted = completed.filter((i) => i.type !== "habit" && i.type !== "review" && i.type !== "speaking");
    const reviewItems = completed.filter((i) => i.type === "review");
    const speakingItems = completed.filter((i) => i.type === "speaking");
    const habitItems = completed.filter((i) => i.type === "habit");

    // Build habit names from metadata
    const nameMap = new Map<string, { name: string; icon: string }>();
    for (const h of habitItems) {
      const habitId = h.metadata?.habitId as string;
      if (habitId && !nameMap.has(habitId)) {
        const title = h.title || "";
        const name = title.replace(/^[^\s]+\s/, ""); // strip emoji prefix
        const icon = title.match(/^[^\s]+/)?.[0] || "✅";
        nameMap.set(habitId, { name: name || title, icon });
      }
    }

    const aggregatedReview = aggregateReviewsAndSpeaking(reviewItems, speakingItems);
    const aggregatedHabits = habitItems.length > 0
      ? aggregateHabits(habitItems, nameMap)
      : [];

    const merged = [...aggregatedReview, ...aggregatedHabits, ...nonHabitCompleted]
      .sort((a, b) => (b.time || "").localeCompare(a.time || ""));

    return { aggregated: merged, habitNamesMap: nameMap };
  }, [completed]);

  // Non-habit items for in-progress and pending
  const nonHabitInProgress = inProgress.filter((i) => i.type !== "habit");
  const nonHabitPending = pending.filter((i) => i.type !== "habit");

  const hasContent = aggregated.length > 0 || nonHabitInProgress.length > 0 || nonHabitPending.length > 0;
  if (!hasContent) return null;

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 mb-3 text-left"
      >
        <Clock size={14} className="text-ink-light" />
        <h2 className="text-[13px] font-semibold text-ink">今日时间线</h2>
        {expanded
          ? <ChevronDown size={14} className="text-ink-lighter ml-auto" />
          : <ChevronRight size={14} className="text-ink-lighter ml-auto" />
        }
      </button>

      {!expanded && (
        <p className="text-[11px] text-ink-lighter mb-1">
          {aggregated.length} 项已完成 · {nonHabitPending.length} 项待完成
        </p>
      )}

      {expanded && (
        <div className="space-y-3">
          {nonHabitInProgress.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CircleDot size={12} className="text-accent-sky" />
                <span className="text-[11px] font-medium text-ink-light">进行中</span>
                <span className="text-[10px] text-ink-lighter">({nonHabitInProgress.length})</span>
              </div>
              <div className="space-y-1">
                {nonHabitInProgress.map((item) => (
                  <IndividualItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {aggregated.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-[11px] font-medium text-ink-light">已完成</span>
                <span className="text-[10px] text-ink-lighter">({aggregated.length})</span>
              </div>
              <div className="space-y-1">
                {aggregated.map((item) => (
                  item.displayType === "aggregated"
                    ? <AggregatedItem key={item.id} item={item} />
                    : <IndividualItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}

          {nonHabitPending.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Circle size={12} className="text-ink-lighter" />
                <span className="text-[11px] font-medium text-ink-light">待完成</span>
                <span className="text-[10px] text-ink-lighter">({nonHabitPending.length})</span>
              </div>
              <div className="space-y-1">
                {nonHabitPending.map((item) => (
                  <IndividualItem key={item.id} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
