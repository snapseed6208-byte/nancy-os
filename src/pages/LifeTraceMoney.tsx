import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Plus, Loader2 } from "lucide-react";
import { useMoneyRecords, useCreateMoneyRecord, useDeleteMoneyRecord } from "@/lib/hooks/useLifeTrace";
import { MONEY_CATEGORY_LABELS } from "@/lib/types";
import type { MoneyCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = Object.keys(MONEY_CATEGORY_LABELS) as MoneyCategory[];
const NECESSITY_OPTIONS = [
  { value: "need", label: "必需" },
  { value: "want", label: "想要" },
  { value: "nice_to_have", label: "可有可无" },
];

// ── Sub-components ──

function CategoryChip({ cat, selected, onClick }: { cat: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-1.5 text-xs transition-colors",
        selected ? "border-sage-light bg-sage-light/30 text-sage-deep" : "border-border text-ink-light hover:border-sage-light/50",
      )}
    >
      {MONEY_CATEGORY_LABELS[cat as MoneyCategory]}
    </button>
  );
}

function MoneyRecordItem({ record, onDelete }: { record: Record<string, unknown>; onDelete: () => void }) {
  const isIncome = (record.type as string) === "income";
  return (
    <div className="flex items-center justify-between py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-light bg-ink/5 rounded-lg px-1.5 py-0.5">
            {MONEY_CATEGORY_LABELS[(record.category as MoneyCategory)] || record.category as string}
          </span>
          {record.note ? <span className="text-xs text-ink-lighter truncate">{record.note as unknown as string}</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm font-medium ${isIncome ? "text-emerald-500" : "text-accent-rose"}`}>
          {isIncome ? "+" : "-"}¥{(record.amount as number).toFixed(2)}
        </span>
        <button onClick={onDelete}>
          <Trash2 size={12} className="text-ink-lighter hover:text-accent-rose" />
        </button>
      </div>
    </div>
  );
}

// ── Page ──

export default function LifeTraceMoney() {
  const [, navigate] = useLocation();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: records, isLoading } = useMoneyRecords({ year, month });
  const createRecord = useCreateMoneyRecord();
  const deleteRecord = useDeleteMoneyRecord();

  // Quick add form
  const [formOpen, setFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [necessity, setNecessity] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(now.toISOString().split("T")[0]);

  const handleSubmit = async () => {
    if (!amount || !category) return;
    await createRecord.mutateAsync({
      amount: parseFloat(amount),
      type,
      category,
      necessity: necessity || null,
      note: note || null,
      date,
    });
    setAmount("");
    setCategory("");
    setNecessity("");
    setNote("");
    setDate(now.toISOString().split("T")[0]);
    setFormOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteRecord.mutateAsync(id);
  };

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const handleNextMonth = () => {
    const isCurrentOrFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
    if (!isCurrentOrFuture) {
      if (month === 12) { setMonth(1); setYear(year + 1); }
      else setMonth(month + 1);
    }
  };

  const months = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

  // Compute summary
  const rows = records || [];
  const totalExpense = rows
    .filter((r: Record<string, unknown>) => r.type === "expense")
    .reduce((s: number, r: Record<string, unknown>) => s + (r.amount as number), 0);
  const totalIncome = rows
    .filter((r: Record<string, unknown>) => r.type === "income")
    .reduce((s: number, r: Record<string, unknown>) => s + (r.amount as number), 0);

  // Category breakdown
  const catMap: Record<string, number> = {};
  rows.filter((r: Record<string, unknown>) => r.type === "expense").forEach((r: Record<string, unknown>) => {
    const c = r.category as string;
    catMap[c] = (catMap[c] || 0) + (r.amount as number);
  });
  const sortedCats = Object.entries(catMap).sort(([, a], [, b]) => b - a);
  const maxCat = Math.max(1, ...Object.values(catMap));

  // Group by date
  const dateGroups: Record<string, Record<string, unknown>[]> = {};
  rows.forEach((r: Record<string, unknown>) => {
    const d = r.date as string;
    if (!dateGroups[d]) dateGroups[d] = [];
    dateGroups[d].push(r);
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/life-trace")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <p className="text-sm text-ink-lighter">Life Trace</p>
            <h1 className="text-2xl font-semibold tracking-tight mt-0.5">记账</h1>
          </div>
        </div>
        <button
          onClick={() => setFormOpen(!formOpen)}
          className="flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-3 py-2 text-sm font-medium"
        >
          <Plus size={16} />
          记一笔
        </button>
      </header>

      {/* Quick Add form */}
      {formOpen && (
        <div className="bg-card rounded-2xl border border-sage-light/50 p-4 space-y-3">
          {/* Amount */}
          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">金额</label>
            <input
              type="number"
              step="0.01"
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Type toggle */}
          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">类型</label>
            <div className="flex gap-2">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-xs font-medium transition-colors",
                    type === t
                      ? t === "expense" ? "border-accent-rose/30 bg-accent-rose/5 text-accent-rose" : "border-emerald-500/30 bg-emerald-50 text-emerald-500"
                      : "border-border text-ink-light",
                  )}
                >
                  {t === "expense" ? "支出" : "收入"}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-ink-light mb-2 block">分类</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => {
                if (type === "income") return c === "tutoring_income" || c === "other";
                return c !== "tutoring_income";
              }).map((c) => (
                <CategoryChip key={c} cat={c} selected={category === c} onClick={() => setCategory(category === c ? "" : c)} />
              ))}
            </div>
          </div>

          {/* Necessity + Date row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-ink-light mb-1 block">必要性</label>
              <div className="flex gap-2 flex-wrap">
                {NECESSITY_OPTIONS.map((n) => (
                  <button
                    key={n.value}
                    onClick={() => setNecessity(necessity === n.value ? "" : n.value)}
                    className={cn(
                      "rounded-xl border px-2 py-1 text-xs transition-colors",
                      necessity === n.value ? "border-sage-light bg-sage-light/30 text-sage-deep" : "border-border text-ink-light",
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-light mb-1 block">日期</label>
              <input
                type="date"
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-ink outline-none focus:border-sage-light"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <input
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
              placeholder="备注 (选填)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!amount || !category || createRecord.isPending}
            className="w-full bg-sage-light text-sage-deep rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
          >
            {createRecord.isPending ? "保存中..." : "记录"}
          </button>
        </div>
      )}

      {/* Monthly summary */}
      <div className="flex items-center justify-between">
        <button onClick={handlePrevMonth} className="h-7 w-7 rounded-lg bg-ink/5 flex items-center justify-center">
          <ChevronLeft size={14} className="text-ink-light" />
        </button>
        <span className="text-sm font-medium text-ink">{year}.{months[month - 1]}</span>
        <button onClick={handleNextMonth} className="h-7 w-7 rounded-lg bg-ink/5 flex items-center justify-center">
          <ChevronRight size={14} className="text-ink-light" />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-ink-lighter" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className="text-lg font-semibold text-accent-rose">¥{totalExpense.toFixed(0)}</p>
              <p className="text-xs text-ink-lighter">总支出</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className="text-lg font-semibold text-emerald-500">¥{totalIncome.toFixed(0)}</p>
              <p className="text-xs text-ink-lighter">总收入</p>
            </div>
            <div className="bg-card rounded-2xl border border-border p-3 text-center">
              <p className={`text-lg font-semibold ${totalIncome - totalExpense >= 0 ? "text-sage-deep" : "text-accent-rose"}`}>
                ¥{(totalIncome - totalExpense).toFixed(0)}
              </p>
              <p className="text-xs text-ink-lighter">结余</p>
            </div>
          </div>

          {/* Category breakdown */}
          {sortedCats.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-3 space-y-1.5">
              <p className="text-xs font-medium text-ink-light mb-1">支出分类</p>
              {sortedCats.map(([cat, amt]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-ink-light w-14 shrink-0">{MONEY_CATEGORY_LABELS[cat as MoneyCategory]}</span>
                  <div className="flex-1 h-2 bg-ink/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ink/20 rounded-full transition-all"
                      style={{ width: `${Math.round((amt / maxCat) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-lighter w-12 text-right">¥{amt.toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Records list grouped by date */}
          {rows.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-3xl block mb-2">💰</span>
              <p className="text-xs text-ink-lighter">本月还没有记账记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(dateGroups).sort(([a], [b]) => b.localeCompare(a)).map(([d, items]) => (
                <div key={d}>
                  <p className="text-xs text-ink-lighter mb-1 ml-1">
                    {new Date(d).toLocaleDateString("zh-CN")}
                  </p>
                  <div className="bg-card rounded-2xl border border-border px-4 divide-y divide-border/50">
                    {items.map((r: Record<string, unknown>) => (
                      <MoneyRecordItem
                        key={r.id as string}
                        record={r}
                        onDelete={() => handleDelete(r.id as string)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
