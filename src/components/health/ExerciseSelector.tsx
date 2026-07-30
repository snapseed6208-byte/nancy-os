import { useState, useMemo } from "react";
import { Search, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseLibraryItem } from "@/lib/hooks/useHealth";

type ExerciseSelectorProps = {
  exercises: ExerciseLibraryItem[];
  onSelect: (exercise: ExerciseLibraryItem) => void;
  onClose: () => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  "臀腿": "臀腿",
  "背部": "背部",
  "肩胸": "肩胸",
  "核心": "核心",
  "有氧": "有氧",
  "拉伸": "拉伸",
};

export default function ExerciseSelector({ exercises, onSelect, onClose }: ExerciseSelectorProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(exercises.map((e) => e.category));
    return [...cats];
  }, [exercises]);

  const filtered = useMemo(() => {
    let result = exercises;
    if (activeCategory) result = result.filter((e) => e.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((e) =>
        e.name.toLowerCase().includes(q) ||
        (e.target_muscles || []).some((m) => m.toLowerCase().includes(q)) ||
        (e.equipment || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [exercises, activeCategory, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[70vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">选择训练动作</p>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5">
            <X size={15} className="text-ink-lighter" />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 py-2 relative">
          <Search size={13} className="absolute left-7 top-1/2 -translate-y-1/2 text-ink-lighter" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索动作名称或肌肉..."
            className="w-full bg-ink/5 rounded-xl pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none"
            autoFocus
          />
        </div>

        {/* Category chips */}
        <div className="shrink-0 px-4 py-2 flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
              !activeCategory ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
            )}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
                activeCategory === cat ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
              )}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-ink-lighter py-8">没有匹配的动作</p>
          ) : (
            filtered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sage-light/10 transition-colors text-left group"
              >
                <div className="h-8 w-8 rounded-lg bg-sage-light/30 flex items-center justify-center shrink-0 group-hover:bg-sage-light/50 transition-colors">
                  <Plus size={14} className="text-sage-deep" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{ex.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">{CATEGORY_LABELS[ex.category] || ex.category}</span>
                    {ex.equipment && <span className="text-[10px] text-ink-lighter">{ex.equipment}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
