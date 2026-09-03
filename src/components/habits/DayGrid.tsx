// ============================================
// Habit Lab — 21-day visualization strip
// One square per day. States are also spelled out in
// tooltips + legend so the grid never relies on color alone.
// ============================================

import { cn } from "@/lib/utils";
import type { SprintDayCell } from "@/lib/habits/types";
import { DAY_CELL_CLS, DAY_LEGEND, dayStatusText } from "./labels";

export function DayGrid({ days, showLegend = false }: { days: SprintDayCell[]; showLegend?: boolean }) {
  if (days.length === 0) return null;
  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`共 ${days.length} 天打卡图`}
      >
        {days.map((d) => (
          <div
            key={d.date}
            title={`第 ${d.dayNumber} 天（${d.date}）· ${dayStatusText(d.status)}`}
            className={cn(
              "aspect-square rounded-[3px] transition-colors",
              DAY_CELL_CLS[d.status],
              d.isToday && d.status === "due" && "bg-sage-deep",
            )}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {DAY_LEGEND.map((l) => (
            <span key={l.key} className="flex items-center gap-1 text-[10px] text-ink-light">
              <span className={cn("h-2 w-2 rounded-[2px] inline-block", l.swatch)} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
