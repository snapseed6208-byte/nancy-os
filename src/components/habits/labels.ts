// ============================================
// Habit Lab — display labels + status colors
// ============================================

import type { SprintPhase, DayCellStatus } from "@/lib/habits/types";

export const PHASE_META: Record<SprintPhase, { label: string; chip: string }> = {
  scheduled: { label: "未开始", chip: "bg-ink/5 text-ink-light" },
  active: { label: "进行中", chip: "bg-sage-light text-sage-deep" },
  paused: { label: "已暂停", chip: "bg-accent-warm/20 text-[#A5673F]" },
  reviewable: { label: "待复盘", chip: "bg-accent-sky/10 text-accent-sky" },
  completed: { label: "已完结", chip: "bg-sage text-white" },
  archived: { label: "已归档", chip: "bg-ink/5 text-ink-lighter" },
};

export function dayStatusText(s: DayCellStatus): string {
  switch (s) {
    case "completed": return "已完成";
    case "skipped": return "已跳过";
    case "missed": return "未完成";
    case "due": return "今日待办";
    case "future": return "未开始";
  }
}

/** Tailwind bg classes for one DayGrid cell. */
export const DAY_CELL_CLS: Record<DayCellStatus, string> = {
  completed: "bg-sage",
  skipped: "bg-amber-300",
  missed: "bg-rose-200",
  due: "ring-2 ring-sage-deep ring-inset bg-sage-light",
  future: "bg-ink/10",
};

export const DAY_LEGEND: { key: DayCellStatus; label: string; swatch: string }[] = [
  { key: "completed", label: "完成", swatch: "bg-sage" },
  { key: "skipped", label: "跳过", swatch: "bg-amber-300" },
  { key: "missed", label: "未完成", swatch: "bg-rose-200" },
];
