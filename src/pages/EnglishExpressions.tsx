import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Plus, BookOpen, ChevronRight, Clock, Tag, X } from "lucide-react";
import { useExpressions, useExpressionCategories } from "@/lib/hooks/useEnglish";
import { EXPRESSION_TYPES, EXPRESSION_STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  vocabulary: "词汇",
  chunk: "语块",
  sentence: "句子",
  sentencePattern: "句式",
  speakingExpression: "口语表达",
};

const STATUS_LABELS: Record<string, string> = {
  new: "新学",
  learning: "学习中",
  review: "待复习",
  mastered: "已掌握",
};

const STATUS_STYLE: Record<string, string> = {
  new: "bg-blue-50 text-blue-600",
  learning: "bg-amber-50 text-amber-600",
  review: "bg-purple-50 text-purple-600",
  mastered: "bg-sage-light text-sage-deep",
};

export default function EnglishExpressions() {
  const [, navigate] = useLocation();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data: expressions, isLoading, error } = useExpressions({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    category_id: categoryFilter || undefined,
    search: search || undefined,
  });

  const { data: categories } = useExpressionCategories();

  const hasFilters = typeFilter || statusFilter || categoryFilter || search;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-lighter">English OS</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">表达库</h1>
        </div>
        <button
          onClick={() => navigate("/english/expressions/new")}
          className="flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-3 py-2 text-sm font-medium"
        >
          <Plus size={16} />
          添加
        </button>
      </header>

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-lighter" />
          <input
            className="w-full bg-card border border-border rounded-xl pl-9 pr-8 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="搜索英文或中文..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-lighter hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={!typeFilter} onClick={() => setTypeFilter("")}>
            全部类型
          </FilterChip>
          {EXPRESSION_TYPES.map((t) => (
            <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)}>
              {TYPE_LABELS[t]}
            </FilterChip>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={!statusFilter} onClick={() => setStatusFilter("")}>
            全部状态
          </FilterChip>
          {EXPRESSION_STATUSES.map((s) => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)}>
              {STATUS_LABELS[s]}
            </FilterChip>
          ))}
        </div>

        {categories && categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={!categoryFilter} onClick={() => setCategoryFilter("")}>
              全部分类
            </FilterChip>
            {categories.map((c) => (
              <FilterChip key={c.id} active={categoryFilter === c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? "" : c.id)}>
                {c.icon && <span className="mr-1">{c.icon}</span>}{c.name}
              </FilterChip>
            ))}
          </div>
        )}

        {hasFilters && (
          <p className="text-xs text-ink-lighter">
            {expressions?.length ?? 0} 条结果
          </p>
        )}
      </div>

      {/* List */}
      {isLoading && (
        <div className="text-center py-12 text-sm text-ink-lighter">加载中...</div>
      )}

      {error && (
        <div className="bg-accent-rose/10 border border-accent-rose/20 rounded-2xl p-4 text-sm text-accent-rose">
          加载失败，请检查 Supabase 连接配置。
        </div>
      )}

      {!isLoading && !error && expressions?.length === 0 && (
        <div className="text-center py-12">
          <BookOpen size={40} className="text-ink-lighter mx-auto mb-3" />
          <p className="text-sm text-ink-light">
            {hasFilters ? "没有匹配的表达" : "表达库为空"}
          </p>
          <p className="text-xs text-ink-lighter mt-1">
            {hasFilters ? "试试调整筛选条件" : "点击右上角「添加」按钮创建第一条表达"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2">
        {expressions?.map((expr) => (
          <ExpressionCard
            key={expr.id}
            expr={expr}
            onClick={() => navigate(`/english/expressions/${expr.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Filter Chip ──
function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-sage-light text-sage-deep"
          : "bg-ink/5 text-ink-light hover:bg-ink/10",
      )}
    >
      {children}
    </button>
  );
}

// ── Expression Card ──
function ExpressionCard({ expr, onClick }: { expr: Record<string, unknown>; onClick: () => void }) {
  const status = (expr.status as string) || "new";
  const type = (expr.type as string) || "vocabulary";

  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl border border-border p-4 text-left hover:border-sage-light/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{expr.english as string}</p>
          <p className="text-xs text-ink-light mt-0.5 truncate">{expr.chinese as string}</p>
          {(expr.scene as string) && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-ink-lighter">
              <Tag size={10} />
              {expr.scene as string}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5">
              {TYPE_LABELS[type] || type}
            </span>
            <span className={cn("text-[10px] rounded-full px-2 py-0.5", STATUS_STYLE[status] || STATUS_STYLE.new)}>
              {STATUS_LABELS[status] || status}
            </span>
          </div>
          <ChevronRight size={14} className="text-ink-lighter shrink-0" />
        </div>
      </div>

      {(expr.next_review_date as string) && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-ink-lighter">
          <Clock size={10} />
          下次复习: {new Date(expr.next_review_date as string).toLocaleDateString("zh-CN")}
        </div>
      )}
    </button>
  );
}
