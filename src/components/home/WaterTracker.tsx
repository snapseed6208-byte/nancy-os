import { useState } from "react";
import { Plus, Trash2, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaterRecord {
  id: string;
  amount_ml: number;
  recorded_at: string;
}

interface WaterToday {
  total_ml: number;
  goal_ml: number;
  records: WaterRecord[];
}

interface WaterTrackerProps {
  waterToday?: WaterToday | null;
  onAdd: (amount: number) => void;
  onDelete: (id: string) => void;
  isAdding: boolean;
}

export function WaterTracker({ waterToday, onAdd, onDelete, isAdding }: WaterTrackerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const total = waterToday?.total_ml ?? 0;
  const goal = waterToday?.goal_ml ?? 2000;
  const pct = Math.min(Math.round((total / goal) * 100), 100);
  const records = waterToday?.records ?? [];
  const now = new Date();
  const hour = now.getHours();

  let tip: string;
  if (total >= goal) {
    tip = "太棒了！今日饮水目标已达成 🎉";
  } else if (hour < 12 && total < 500) {
    tip = "上午补水很重要，记得开始喝水";
  } else if (hour >= 12 && hour < 15 && total < 1000) {
    tip = "下午3点前饮水不足，现在喝一杯吧";
  } else if (hour >= 15 && hour < 18 && total < 1500) {
    tip = "下午过半，再加把劲补水";
  } else if (hour >= 18 && total < goal) {
    tip = "睡前适量补水，别一次喝太多";
  } else {
    tip = "继续保持，离目标越来越近了";
  }

  const handleCustomAdd = () => {
    const amount = parseInt(customAmount, 10);
    if (!amount || amount < 50 || amount > 5000) return;
    onAdd(amount);
    setCustomAmount("");
    setCustomOpen(false);
  };

  const bgBar = total >= goal ? "bg-emerald-400" : "bg-accent-sky";

  return (
    <section className="bg-gradient-to-br from-accent-sky/[0.04] to-white border border-accent-sky/10 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets size={16} className="text-accent-sky" />
          <h2 className="text-[13px] font-semibold text-ink">今日饮水</h2>
        </div>
        <span className={cn(
          "text-[11px] font-medium",
          total >= goal ? "text-emerald-500" : "text-ink-light",
        )}>
          {total} / {goal} ml
        </span>
      </div>

      <div className="bg-ink/5 rounded-full h-2 mb-2 overflow-hidden">
        <div className={cn(bgBar, "h-full rounded-full transition-all duration-500")}
          style={{ width: `${Math.max(pct, total > 0 ? 4 : 0)}%` }} />
      </div>

      <p className={cn("text-[11px] mb-3", total >= goal ? "text-emerald-600" : "text-ink-light")}>
        {tip}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onAdd(250)} disabled={isAdding}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-accent-sky/10 text-accent-sky text-xs font-medium hover:bg-accent-sky/20 transition-colors active:scale-95 disabled:opacity-50">
          <Plus size={14} />+250ml
        </button>
        <button onClick={() => onAdd(500)} disabled={isAdding}
          className="flex items-center gap-1 px-4 py-2 rounded-xl bg-accent-sky/10 text-accent-sky text-xs font-medium hover:bg-accent-sky/20 transition-colors active:scale-95 disabled:opacity-50">
          <Plus size={14} />+500ml
        </button>
        {customOpen ? (
          <div className="flex items-center gap-1">
            <input type="number" value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCustomAdd(); }}
              placeholder="ml" min={50} max={5000}
              className="w-20 px-3 py-2 rounded-xl border border-accent-sky/30 bg-white text-xs text-ink outline-none focus:border-accent-sky"
              autoFocus />
            <button onClick={handleCustomAdd} disabled={!customAmount || isAdding}
              className="px-3 py-2 rounded-xl bg-accent-sky text-white text-xs font-medium hover:bg-accent-sky/90 transition-colors active:scale-95 disabled:opacity-50">
              确认
            </button>
            <button onClick={() => { setCustomOpen(false); setCustomAmount(""); }}
              className="px-2 py-2 rounded-xl text-ink-lighter text-xs hover:text-ink-light transition-colors">
              取消
            </button>
          </div>
        ) : (
          <button onClick={() => setCustomOpen(true)}
            className="flex items-center gap-1 px-4 py-2 rounded-xl border border-dashed border-accent-sky/30 text-accent-sky text-xs font-medium hover:bg-accent-sky/5 transition-colors active:scale-95">
            <Plus size={14} />自定义
          </button>
        )}
      </div>

      {records.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex flex-wrap gap-2">
            {records.slice(0, 8).map((r) => (
              <span key={r.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-ink/5 text-[11px] text-ink-light group">
                <span className="font-medium text-ink">{r.amount_ml}ml</span>
                <span className="text-ink-lighter">
                  {new Date(r.recorded_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button onClick={() => onDelete(r.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-lighter hover:text-accent-rose ml-0.5"
                  title="删除">
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
            {records.length > 8 && (
              <span className="text-[10px] text-ink-lighter self-center">+{records.length - 8} 条</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
