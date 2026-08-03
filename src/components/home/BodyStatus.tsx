import { useState } from "react";
import { useLocation } from "wouter";
import { Droplets, Utensils, Dumbbell, Moon, Plus, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaterRecord {
  id: string;
  amount_ml: number;
  recorded_at: string;
}

interface BodyStatusProps {
  waterTotal?: number;
  waterGoal?: number;
  waterRecords?: WaterRecord[];
  foodCount?: number;
  workoutDone?: boolean;
  onAddWater?: (amount: number) => void;
  onDeleteWater?: (id: string) => void;
  isAddingWater?: boolean;
}

export function BodyStatus({
  waterTotal = 0, waterGoal = 2000, waterRecords = [],
  foodCount = 0, workoutDone = false,
  onAddWater, onDeleteWater, isAddingWater = false,
}: BodyStatusProps) {
  const [, navigate] = useLocation();
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const waterPct = waterGoal > 0 ? Math.round((waterTotal / waterGoal) * 100) : 0;

  const handleCustomAdd = () => {
    const amount = parseInt(customAmount, 10);
    if (!amount || amount < 50 || amount > 5000) return;
    onAddWater?.(amount);
    setCustomAmount("");
    setCustomOpen(false);
  };

  return (
    <div className="bg-gradient-to-r from-white to-emerald-50/20 border border-emerald-100/50 rounded-2xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => navigate("/health")}
        className="w-full flex items-center gap-1 px-4 pt-3 pb-2 text-left"
      >
        <span className="text-[10px] text-ink-lighter font-medium">身体状态</span>
        <ChevronRight size={10} className="text-ink-lighter ml-auto" />
      </button>

      {/* Four indicators */}
      <div className="grid grid-cols-4 gap-3 px-4 pb-3">
        <Indicator icon={Droplets} label="饮水" value={`${waterPct}%`} sub={`${waterTotal}ml`}
          ok={waterPct >= 80} color="text-accent-sky" />
        <Indicator icon={Utensils} label="饮食" value={foodCount > 0 ? "已记录" : "未记录"}
          sub={foodCount > 0 ? `${foodCount} 餐` : undefined} ok={foodCount > 0} color="text-accent-warm" />
        <Indicator icon={Dumbbell} label="运动" value={workoutDone ? "已完成" : "未运动"}
          ok={workoutDone} color="text-sage-deep" />
        <Indicator icon={Moon} label="睡眠" value="手动" ok={false} color="text-purple-500" />
      </div>

      {/* Water quick actions */}
      <div className="border-t border-emerald-100/30 px-4 py-2.5 bg-emerald-50/20">
        <div className="flex items-center gap-2">
          <Droplets size={12} className="text-accent-sky shrink-0" />
          <span className="text-[10px] text-ink-lighter">{waterTotal}/{waterGoal}ml</span>
          <div className="flex items-center gap-1 ml-auto">
            {onAddWater && (
              <>
                <button onClick={() => onAddWater(250)} disabled={isAddingWater}
                  className="px-2.5 py-1 rounded-lg bg-accent-sky/10 text-accent-sky text-[10px] font-medium hover:bg-accent-sky/20 transition-colors active:scale-95 disabled:opacity-50">
                  +250ml
                </button>
                <button onClick={() => onAddWater(500)} disabled={isAddingWater}
                  className="px-2.5 py-1 rounded-lg bg-accent-sky/10 text-accent-sky text-[10px] font-medium hover:bg-accent-sky/20 transition-colors active:scale-95 disabled:opacity-50">
                  +500ml
                </button>
                {customOpen ? (
                  <div className="flex items-center gap-1">
                    <input type="number" value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCustomAdd(); }}
                      placeholder="ml" min={50} max={5000}
                      className="w-16 px-2 py-1 rounded-lg border border-accent-sky/30 bg-white text-[10px] text-ink outline-none focus:border-accent-sky"
                      autoFocus />
                    <button onClick={handleCustomAdd} disabled={!customAmount || isAddingWater}
                      className="px-2 py-1 rounded-lg bg-accent-sky text-white text-[10px] font-medium hover:bg-accent-sky/90 transition-colors disabled:opacity-50">
                      确认
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setCustomOpen(true)}
                    className="px-2 py-1 rounded-lg border border-dashed border-accent-sky/30 text-accent-sky text-[10px] font-medium hover:bg-accent-sky/5 transition-colors">
                    <Plus size={10} className="inline mr-0.5" />自定义
                  </button>
                )}
              </>
            )}
            {isAddingWater && <Loader2 size={12} className="animate-spin text-ink-lighter shrink-0" />}
          </div>
        </div>
        {waterRecords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {waterRecords.slice(0, 4).map((r) => (
              <span key={r.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/60 text-[9px] text-ink-light group">
                <span className="font-medium">{r.amount_ml}ml</span>
                {onDeleteWater && (
                  <button onClick={() => onDeleteWater(r.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-lighter hover:text-accent-rose">
                    <Trash2 size={9} />
                  </button>
                )}
              </span>
            ))}
            {waterRecords.length > 4 && (
              <span className="text-[9px] text-ink-lighter self-center">+{waterRecords.length - 4} 条</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Indicator({ icon: Icon, label, value, sub, ok, color }: {
  icon: typeof Droplets;
  label: string;
  value: string;
  sub?: string;
  ok: boolean;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon size={16} className={cn(color, ok && "opacity-100", !ok && "opacity-40")} />
      <span className="text-[10px] text-ink-lighter">{label}</span>
      <span className={cn("text-[11px] font-medium text-center", ok ? "text-ink" : "text-ink-lighter")}>
        {value}
      </span>
      {sub && <span className="text-[9px] text-ink-lighter">{sub}</span>}
    </div>
  );
}
