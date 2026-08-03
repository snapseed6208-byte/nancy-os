import { Calendar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventTypeIcon, getEventTypeLabel } from "@/lib/hooks/useImportantEvent";
import type { ImportantEvent } from "@/lib/hooks/useImportantEvent";

interface ImportantEventsProps {
  events?: ImportantEvent[] | null;
  onToggle?: (id: string, isCompleted: boolean) => void;
}

function getCountdown(dateStr: string): { label: string; urgent: boolean } {
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);

  if (diff < 0) return { label: "已过期", urgent: true };
  if (diff === 0) return { label: "今天", urgent: true };
  if (diff === 1) return { label: "明天", urgent: false };
  if (diff <= 3) return { label: `${diff} 天后`, urgent: true };
  if (diff <= 7) return { label: `${diff} 天后`, urgent: false };
  return { label: `${Math.floor(diff / 7)} 周后`, urgent: false };
}

export function ImportantEvents({ events, onToggle }: ImportantEventsProps) {
  if (!events || events.length === 0) return null;

  const priorityBadge = (p: string) => {
    if (p === "high") return "bg-accent-rose/10 text-accent-rose text-[10px] px-1.5 py-0.5 rounded-full font-medium";
    if (p === "medium") return "bg-amber-50 text-amber-600 text-[10px] px-1.5 py-0.5 rounded-full font-medium";
    return "bg-ink/5 text-ink-lighter text-[10px] px-1.5 py-0.5 rounded-full font-medium";
  };

  return (
    <section className="bg-gradient-to-br from-accent-warm/[0.03] to-white border border-accent-warm/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-accent-warm" />
        <h2 className="text-[13px] font-semibold text-ink">重要安排</h2>
        <span className="text-[10px] text-ink-lighter ml-auto">{events.length} 项</span>
      </div>
      <div className="space-y-1">
        {events.slice(0, 5).map((event) => {
          const cd = getCountdown(event.event_date);
          return (
            <button
              key={event.id}
              onClick={() => onToggle?.(event.id, !event.is_completed)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors text-left",
                "hover:bg-white/60",
                event.is_completed && "opacity-50",
              )}
            >
              <span className="text-base shrink-0">{getEventTypeIcon(event.event_type)}</span>
              <div className="flex-1 min-w-0">
                <span className={cn("text-xs text-ink truncate", event.is_completed && "line-through")}>
                  {event.title}
                </span>
                {event.event_time && (
                  <span className="text-[10px] text-ink-lighter ml-1.5">{event.event_time.slice(0, 5)}</span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium shrink-0",
                cd.urgent ? "text-accent-rose" : "text-ink-lighter",
              )}>
                {cd.label}
              </span>
              <span className={priorityBadge(event.priority)}>
                {event.priority === "high" ? "高" : event.priority === "medium" ? "中" : "低"}
              </span>
              {event.is_completed && <Check size={12} className="text-emerald-500 shrink-0" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
