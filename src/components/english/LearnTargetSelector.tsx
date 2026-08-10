// ============================================
// English V4.3 — Adaptive Daily Learning Target Selector
//
// Shared by the hub (no session → pick a target) and the Learn page's append
// flow ("今天再学一些"). 2×2 preset grid on mobile (PART 15), custom 1-30
// (PART 17), insufficiency collapse (PART 2), empty state (PART 14).
// ============================================

import { useState } from "react";
import {
  LEARN_TARGET_PRESETS,
  MAX_LEARN_TARGET,
  getSavedLearnTarget,
  saveLearnTarget,
} from "@/lib/hooks/useReviewSession";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Sparkles } from "lucide-react";

interface LearnTargetSelectorProps {
  /** "create" = first session today; "append" = 今天再学一些. */
  mode: "create" | "append";
  /** Expressions currently learnable (outside today's session). */
  availableCount: number;
  busy?: boolean;
  onSubmit: (target: number) => void;
}

const CAP_WARNING = "单次最多学习 30 条，可以完成后继续追加。";

export default function LearnTargetSelector({
  mode,
  availableCount,
  busy,
  onSubmit,
}: LearnTargetSelectorProps) {
  const isCreate = mode === "create";
  const [selected, setSelected] = useState<number>(
    isCreate ? getSavedLearnTarget() : 5,
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<string>("");

  const overCap = selected > MAX_LEARN_TARGET;
  const safeTarget = Math.min(Math.max(1, selected), MAX_LEARN_TARGET);
  const isCustom = !LEARN_TARGET_PRESETS.some((p) => p.value === selected);
  const actualTarget = Math.min(safeTarget, availableCount);
  const insufficient = availableCount > 0 && availableCount < safeTarget;

  const pickPreset = (value: number) => {
    setSelected(value);
    setCustomOpen(false);
  };

  const openCustom = () => {
    setCustomOpen(true);
    if (isCustom) setCustomDraft(String(selected));
  };

  const commitCustom = () => {
    const n = Number.parseInt(customDraft, 10);
    setSelected(Number.isFinite(n) ? n : 5);
  };

  const handleSubmit = () => {
    if (busy || availableCount === 0) return;
    if (isCreate) saveLearnTarget(safeTarget);
    onSubmit(actualTarget);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-ink">
          {isCreate ? "今天想学多少？" : "再学多少？"}
        </h2>
        <p className="text-xs text-ink-lighter mt-0.5">
          学习数量由你决定，复习节奏交给 SRS。
        </p>
      </div>

      {/* 2×2 preset grid (mobile-friendly) */}
      <div className="grid grid-cols-2 gap-2">
        {LEARN_TARGET_PRESETS.map((p) => {
          const active = !customOpen && selected === p.value;
          const recommended = isCreate && p.value === 10;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => pickPreset(p.value)}
              aria-pressed={active}
              className={cn(
                "relative rounded-xl border p-3 text-left transition-colors",
                active
                  ? "border-sage-deep bg-sage-light/40"
                  : "border-border bg-card hover:border-sage-light/60",
              )}
            >
              {recommended && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-medium text-sage-deep bg-sage-light/60 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> 推荐
                </span>
              )}
              <p className="text-sm font-semibold text-ink">{p.label}</p>
              <p className="text-[11px] text-ink-lighter">{p.value} 条</p>
            </button>
          );
        })}
      </div>

      {/* Custom count */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        {!customOpen ? (
          <button
            type="button"
            onClick={openCustom}
            className="w-full flex items-center justify-between text-sm text-ink hover:text-ink-light transition-colors"
          >
            <span className="font-medium flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-ink-light" /> 自定义数量
            </span>
            <span className="text-[11px] text-ink-lighter">1–30 条</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={MAX_LEARN_TARGET}
              value={customDraft}
              autoFocus
              onChange={(e) => setCustomDraft(e.target.value)}
              onBlur={commitCustom}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitCustom();
              }}
              className="w-20 rounded-lg border border-border px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-sage-deep"
              aria-label="自定义学习数量"
            />
            <span className="text-sm text-ink">条</span>
            <button
              type="button"
              onClick={commitCustom}
              className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              确定
            </button>
          </div>
        )}
        {overCap && (
          <p className="text-[11px] text-amber-600">{CAP_WARNING}</p>
        )}
      </div>

      {/* Availability / insufficiency note (PART 2) */}
      <p className="text-xs text-ink-light">
        目前还有 {availableCount} 条未学习表达
        {insufficient && <>，本次将学习 {actualTarget} 条</>}
      </p>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy || availableCount === 0}
        className={cn(
          "w-full py-3 rounded-xl text-sm font-medium transition-colors",
          busy || availableCount === 0
            ? "bg-muted text-ink-lighter cursor-not-allowed"
            : "bg-ink text-white hover:bg-ink/90",
        )}
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {isCreate ? "正在创建…" : "正在追加…"}
          </span>
        ) : (
          `${isCreate ? "开始学习" : "再学"} ${actualTarget} 条`
        )}
      </button>
    </div>
  );
}
