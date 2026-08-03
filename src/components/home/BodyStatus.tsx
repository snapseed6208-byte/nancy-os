import { useLocation } from "wouter";
import { Droplets, Utensils, Dumbbell, Moon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BodyStatusProps {
  waterTotal?: number;
  waterGoal?: number;
  foodCount?: number;
  workoutDone?: boolean;
}

export function BodyStatus({ waterTotal = 0, waterGoal = 2000, foodCount = 0, workoutDone = false }: BodyStatusProps) {
  const [, navigate] = useLocation();
  const waterPct = waterGoal > 0 ? Math.round((waterTotal / waterGoal) * 100) : 0;

  const indicators = [
    {
      icon: Droplets,
      label: "饮水",
      value: `${waterPct}%`,
      sub: `${waterTotal}ml`,
      ok: waterPct >= 80,
      color: "text-accent-sky",
    },
    {
      icon: Utensils,
      label: "饮食",
      value: foodCount > 0 ? `已记录` : "未记录",
      sub: foodCount > 0 ? `${foodCount} 餐` : undefined,
      ok: foodCount > 0,
      color: "text-accent-warm",
    },
    {
      icon: Dumbbell,
      label: "运动",
      value: workoutDone ? "已完成" : "未运动",
      sub: undefined,
      ok: workoutDone,
      color: "text-sage-deep",
    },
    {
      icon: Moon,
      label: "睡眠",
      value: "手动",
      sub: undefined,
      ok: false,
      color: "text-purple-500",
    },
  ];

  return (
    <button
      onClick={() => navigate("/health")}
      className="w-full bg-gradient-to-r from-white to-emerald-50/20 border border-emerald-100/50 rounded-2xl px-4 py-3 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-center gap-1 mb-2.5">
        <span className="text-[10px] text-ink-lighter font-medium">身体状态</span>
        <ChevronRight size={10} className="text-ink-lighter ml-auto" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {indicators.map((ind) => {
          const Icon = ind.icon;
          return (
            <div key={ind.label} className="flex flex-col items-center gap-1">
              <Icon size={16} className={cn(ind.color, ind.ok && "opacity-100", !ind.ok && "opacity-40")} />
              <span className="text-[10px] text-ink-lighter">{ind.label}</span>
              <span className={cn("text-[11px] font-medium text-center", ind.ok ? "text-ink" : "text-ink-lighter")}>
                {ind.value}
              </span>
              {ind.sub && <span className="text-[9px] text-ink-lighter">{ind.sub}</span>}
            </div>
          );
        })}
      </div>
    </button>
  );
}
