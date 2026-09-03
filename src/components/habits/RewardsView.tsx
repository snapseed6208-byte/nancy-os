// ============================================
// Habit Lab — Rewards shelf
// Milestone model: rewards are EARNED, never deducted.
// The shelf is a stack of real-life treats, not a game shop.
// ============================================

import { useState } from "react";
import { Loader2, Plus, Check, RotateCcw, Trash2, Coins, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { computePoints } from "@/lib/habits/logic";
import {
  useAllSprints, useAllLogs, useRewards, useUpsertReward,
  useSetRewardStatus, useDeleteReward,
} from "@/lib/habits/hooks";
import { getRewardIcon, REWARD_ICON_CHOICES } from "@/lib/habits/icons";
import type { HabitRewardRow } from "@/lib/habits/types";

export function RewardsView() {
  const { data: rewards, isLoading: loadingRewards } = useRewards();
  const { data: sprints } = useAllSprints();
  const { data: logs } = useAllLogs();

  const loading = loadingRewards;

  const balance = computeBalance(sprints || [], logs || []);
  const active = (rewards || []).filter((r) => r.status === "active");
  const claimed = (rewards || []).filter((r) => r.status === "redeemed");

  const next = active
    .filter((r) => r.points_required > balance)
    .sort((a, b) => a.points_required - b.points_required)[0];
  const claimable = active.filter((r) => r.points_required <= balance);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-ink-lighter" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Points hero */}
      <div className="rounded-2xl bg-gradient-to-br from-sage-light/10 to-white border border-sage-light/30 p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-sage-deep">
          <Coins size={13} />Habit Points
        </div>
        <div className="mt-1 text-4xl font-bold tracking-tight text-ink">{balance}<span className="text-lg text-ink-lighter font-medium ml-1">pts</span></div>
        <p className="mt-2 text-[11px] text-ink-light leading-relaxed">
          完成一次 +10 · 连续 3 天 +10 · 连续 7 天再 +30 · 完结 +100。
          犒赏是里程碑，攒到了就去兑现，不会扣回来。
        </p>

        {next ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-light">距离 <span className="font-semibold text-ink">{next.name}</span></span>
              <span className="font-semibold text-sage-deep">{Math.max(0, next.points_required - balance)} 分</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-ink/5 overflow-hidden">
              <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${Math.min(100, (balance / next.points_required) * 100)}%` }} />
            </div>
          </div>
        ) : rewards && rewards.length > 0 && claimable.length === 0 ? (
          <p className="mt-3 text-xs text-ink-light">所有犒赏都已解锁，可以再添一个更大的目标。</p>
        ) : null}
      </div>

      {/* Claimable banner */}
      {claimable.length > 0 && (
        <p className="text-xs font-medium text-ink-light flex items-center gap-1.5">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-sage-deep" />
          有 {claimable.length} 个犒赏可以兑现了 — 挑一个，把奖颁给自己。
        </p>
      )}

      {/* Shelf */}
      {(active.length > 0 || claimed.length > 0) && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-ink-lighter uppercase tracking-wider">犒赏架</p>
          {[...active, ...claimed].sort((a, b) => a.points_required - b.points_required).map((r) => (
            <RewardRow key={r.id} reward={r} balance={balance} />
          ))}
        </div>
      )}

      <AddRewardForm />
    </div>
  );
}

function computeBalance(sprints: { id: string; status: string }[], logs: { sprint_id: string; date: string; status: string }[]) {
  const bySprint = new Map<string, { date: string; status: "completed" | "skipped" }[]>();
  for (const l of logs) {
    const arr = bySprint.get(l.sprint_id) || [];
    arr.push({ date: l.date, status: l.status as "completed" | "skipped" });
    bySprint.set(l.sprint_id, arr);
  }
  let total = 0;
  for (const s of sprints) {
    const rows = bySprint.get(s.id) || [];
    total += computePoints(rows, s.status === "completed").total;
  }
  return total;
}

function RewardRow({ reward, balance }: { reward: HabitRewardRow; balance: number }) {
  const setStatus = useSetRewardStatus();
  const del = useDeleteReward();
  const Icon = getRewardIcon(reward.icon);
  const redeemed = reward.status === "redeemed";
  const canClaim = balance >= reward.points_required;

  return (
    <div className={cn("bg-card rounded-2xl border px-4 py-3 flex items-center gap-3", redeemed ? "border-border" : "border-border")}>
      <div className={cn("h-10 w-10 shrink-0 rounded-xl flex items-center justify-center",
        redeemed ? "bg-ink/5 text-ink-lighter" : canClaim ? "bg-sage text-white" : "bg-sage-light text-sage-deep")}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold text-ink truncate", redeemed && "line-through text-ink-light")}>{reward.name}</p>
        <p className="text-[11px] text-ink-lighter">{reward.points_required} pts</p>
      </div>
      {redeemed ? (
        <button
          onClick={() => setStatus.mutate({ id: reward.id, status: "active" })}
          className="flex items-center gap-1 text-[11px] text-ink-lighter hover:text-ink transition-colors"
          title="重新设为待兑现"
        >
          <Check size={13} className="text-sage-deep" />已兑现 <RotateCcw size={11} />
        </button>
      ) : canClaim ? (
        <button
          onClick={() => setStatus.mutate({ id: reward.id, status: "redeemed" })}
          className="rounded-xl bg-sage-deep px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
        >
          兑现
        </button>
      ) : (
        <span className="text-[11px] text-ink-lighter">{reward.points_required - balance} 分</span>
      )}
      <button onClick={() => del.mutate(reward.id)} className="text-ink-lighter hover:text-rose-500 transition-colors shrink-0" title="删除">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

const POINT_PRESETS = [50, 100, 150, 300];

function AddRewardForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [points, setPoints] = useState(100);
  const [icon, setIcon] = useState("Star");
  const add = useUpsertReward();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card/50 px-4 py-3.5 text-sm font-medium text-ink-light transition-colors hover:bg-card-hover hover:text-ink"
      >
        <Plus size={15} />添一个真实的犒赏
      </button>
    );
  }

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    add.mutate({ name: trimmed, icon, pointsRequired: points }, {
      onSuccess: () => { setOpen(false); setName(""); setPoints(100); setIcon("Star"); },
    });
  };

  return (
    <div className="bg-card rounded-2xl border border-sage-light/50 p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">新的犒赏</p>
        <button onClick={() => setOpen(false)} className="text-ink-lighter hover:text-ink"><X size={16} /></button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="想兑现什么？例如：一杯手冲咖啡"
        className="w-full rounded-xl border border-border bg-warm-cream px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage focus:ring-2 focus:ring-sage/20 transition"
      />
      <div>
        <p className="text-[11px] font-medium text-ink-light mb-1.5">需要多少分？</p>
        <div className="flex gap-2 flex-wrap">
          {POINT_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPoints(p)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                points === p ? "bg-sage-deep text-white" : "bg-ink/5 text-ink-light hover:bg-ink/10")}
            >
              {p} pts
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-medium text-ink-light mb-1.5">犒赏图标</p>
        <div className="flex gap-2 flex-wrap">
          {REWARD_ICON_CHOICES.map((c) => {
            const Ic = getRewardIcon(c.key);
            return (
              <button
                key={c.key}
                onClick={() => setIcon(c.key)}
                title={c.label}
                className={cn("h-9 w-9 rounded-xl flex items-center justify-center transition-colors",
                  icon === c.key ? "bg-sage-deep text-white" : "bg-ink/5 text-ink-light hover:bg-ink/10")}
              >
                <Ic size={17} />
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={submit}
        disabled={!name.trim() || add.isPending}
        className="w-full rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-deep disabled:opacity-50"
      >
        {add.isPending ? "保存中…" : "放进犒赏架"}
      </button>
    </div>
  );
}
