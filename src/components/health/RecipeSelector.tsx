import { useState } from "react";
import { Search, X, ChefHat, Check } from "lucide-react";
import type { Recipe } from "@/lib/hooks/useHealth";

type RecipeSelectorProps = {
  recipes: Recipe[];
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
};

export default function RecipeSelector({ recipes, onSelect, onClose }: RecipeSelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? recipes.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : recipes;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[70vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <ChefHat size={14} className="text-sage-deep" />我的食谱库
          </p>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5">
            <X size={15} className="text-ink-lighter" />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 py-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-lighter" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索食谱名称..."
              className="w-full bg-ink/5 rounded-xl pl-8 pr-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none"
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <ChefHat size={28} className="text-ink-lighter mx-auto mb-2 opacity-25" />
              <p className="text-xs text-ink-lighter">{search ? "未找到匹配食谱" : "食谱库还是空的"}</p>
              <p className="text-[10px] text-ink-lighter mt-1">
                {search ? "换一个关键词试试" : "先添加一个食谱链接吧"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filtered.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-sage-light/20 transition-colors text-left group"
                >
                  {/* Thumbnail */}
                  <div className="shrink-0 w-12 h-12 rounded-lg bg-ink/5 overflow-hidden">
                    {r.image_url ? (
                      <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">
                        {r.category === "高蛋白" ? "🥩" : r.category === "减脂" ? "🥗" : "🍳"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{r.name || "未命名食谱"}</p>
                    <p className="text-[10px] text-ink-lighter mt-0.5">
                      {r.cook_count > 0 ? `做过 ${r.cook_count} 次` : "还没做过"}
                    </p>
                  </div>
                  <Check size={16} className="text-sage-deep opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
