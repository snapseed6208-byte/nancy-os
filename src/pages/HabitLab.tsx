import { useState } from "react";
import { Sun, FlaskConical, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { TodayView } from "@/components/habits/TodayView";
import { ExperimentsView } from "@/components/habits/ExperimentsView";
import { RewardsView } from "@/components/habits/RewardsView";

type Tab = "today" | "experiments" | "rewards";

const TABS: { key: Tab; label: string; icon: typeof Sun }[] = [
  { key: "today", label: "今日", icon: Sun },
  { key: "experiments", label: "实验", icon: FlaskConical },
  { key: "rewards", label: "犒赏", icon: Gift },
];

export default function HabitLab() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-lighter">习惯实验 · 21 天行为实验</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Habit Lab</h1>
      </header>

      <div className="flex bg-ink/5 rounded-xl p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
              tab === key ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
            )}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tab === "today" && <TodayView />}
      {tab === "experiments" && <ExperimentsView />}
      {tab === "rewards" && <RewardsView />}
    </div>
  );
}
