import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Search, Plus, BookOpen, ChevronRight, Clock, Tag, X, FolderSync, Archive, RotateCcw, ChevronLeft } from "lucide-react";
import {
  useExpressions,
  useExpressionCategories,
  useRecategorize,
  useArchiveExpression,
  useRestoreExpression,
  useBatchUpdateExpressions,
} from "@/lib/hooks/useEnglish";
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
  collected: "待学习",
  learning: "学习中",
  review: "待复习",
  mastered: "已掌握",
};

const STATUS_STYLE: Record<string, string> = {
  collected: "bg-blue-50 text-blue-600",
  learning: "bg-amber-50 text-amber-600",
  review: "bg-purple-50 text-purple-600",
  mastered: "bg-sage-light text-sage-deep",
};

const DIFFICULTY_OPTIONS = ["beginner", "intermediate", "advanced"];

export default function EnglishExpressions() {
  const [, navigate] = useLocation();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const { data: result, isLoading, error } = useExpressions({
    type: typeFilter || undefined,
    status: statusFilter || undefined,
    category_id: categoryFilter || undefined,
    search: search || undefined,
    page,
    pageSize,
  });

  const expressions = result?.data || [];
  const totalCount = result?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const { data: categories } = useExpressionCategories();
  const recategorize = useRecategorize();
  const archiveExpr = useArchiveExpression();
  const restoreExpr = useRestoreExpression();
  const batchUpdate = useBatchUpdateExpressions();

  const hasFilters = !!(typeFilter || statusFilter || categoryFilter || search);

  // ── Batch selection ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === expressions.length && expressions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expressions.map((e: Record<string, unknown>) => e.id as string)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBatchMode(false);
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`归档 ${selectedIds.size} 条表达？`)) return;
    await batchUpdate.mutateAsync({ ids: [...selectedIds], updates: { archived: true } });
    clearSelection();
  };

  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    await batchUpdate.mutateAsync({ ids: [...selectedIds], updates: { archived: false } });
    clearSelection();
  };

  const handleBatchScene = async (scene: string) => {
    if (selectedIds.size === 0) return;
    await batchUpdate.mutateAsync({ ids: [...selectedIds], updates: { scene } });
    clearSelection();
  };

  const handleBatchCategory = async (categoryId: string) => {
    if (selectedIds.size === 0) return;
    await batchUpdate.mutateAsync({ ids: [...selectedIds], updates: { category_id: categoryId || null } });
    clearSelection();
  };

  const handleBatchDifficulty = async (level: string) => {
    if (selectedIds.size === 0) return;
    await batchUpdate.mutateAsync({ ids: [...selectedIds], updates: { difficulty_level: level } });
    clearSelection();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-lighter">English OS</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">表达库</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBatchMode(!batchMode)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              batchMode ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
            )}
          >
            {batchMode ? "取消批量" : "批量管理"}
          </button>
          <button
            onClick={() => recategorize.mutate()}
            disabled={recategorize.isPending}
            className="flex items-center gap-1.5 bg-ink/5 text-ink-light rounded-xl px-3 py-2 text-xs font-medium hover:bg-ink/10 disabled:opacity-50"
            title="对未分类的表达执行 AI 自动分类"
          >
            <FolderSync size={14} className={recategorize.isPending ? "animate-spin" : ""} />
            {recategorize.isPending ? "分类中..." : "重新分类"}
          </button>
          <button
            onClick={() => navigate("/english/expressions/new")}
            className="flex items-center gap-1.5 bg-sage-light text-sage-deep rounded-xl px-3 py-2 text-sm font-medium"
          >
            <Plus size={16} />
            添加
          </button>
        </div>
      </header>

      {/* Re-categorization result */}
      {recategorize.isSuccess && recategorize.data && (
        <div className="bg-sage-light/30 border border-sage-light/50 rounded-xl p-3 text-xs text-sage-deep">
          {recategorize.data.message ? (
            <p>{recategorize.data.message}</p>
          ) : (
            <div>
              <p className="font-medium">分类完成: {recategorize.data.categorized}/{recategorize.data.total} 条</p>
              {recategorize.data.errors > 0 && (
                <p className="text-accent-rose mt-0.5">失败: {recategorize.data.errors} 条</p>
              )}
              {Object.keys(recategorize.data.per_category).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(recategorize.data.per_category).map(([name, count]) => (
                    <span key={name} className="bg-white/60 rounded-full px-2 py-0.5 text-[10px]">
                      {name}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {recategorize.isError && (
        <div className="bg-accent-rose/10 border border-accent-rose/20 rounded-xl p-3 text-xs text-accent-rose">
          分类失败: {(recategorize.error as Error)?.message || "未知错误"}
        </div>
      )}

      {/* Batch actions bar */}
      {batchMode && selectedIds.size > 0 && (
        <div className="bg-sage-light/20 border border-sage-light/50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">已选 {selectedIds.size} 条</span>
            <div className="flex gap-1">
              <button onClick={selectAll} className="text-xs text-sage-deep px-2 py-0.5">全选</button>
              <button onClick={clearSelection} className="text-xs text-ink-lighter px-2 py-0.5">清除</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={handleBatchArchive}
              disabled={archiveExpr.isPending}
              className="flex items-center gap-1 bg-accent-rose/10 text-accent-rose rounded-lg px-2.5 py-1.5 text-[11px] font-medium hover:bg-accent-rose/20 disabled:opacity-50"
            >
              <Archive size={11} /> 归档
            </button>
            <button
              onClick={handleBatchRestore}
              disabled={restoreExpr.isPending}
              className="flex items-center gap-1 bg-sage-light text-sage-deep rounded-lg px-2.5 py-1.5 text-[11px] font-medium hover:bg-sage-light/80 disabled:opacity-50"
            >
              <RotateCcw size={11} /> 恢复
            </button>
            <div className="w-px bg-border mx-1" />
            <span className="text-[10px] text-ink-lighter self-center">场景:</span>
            {["daily life", "work", "study", "travel", "social"].map((s) => (
              <button
                key={s}
                onClick={() => handleBatchScene(s)}
                className="bg-white/60 text-ink-light rounded-lg px-2 py-1 text-[10px] hover:bg-white"
              >
                {s}
              </button>
            ))}
            <div className="w-px bg-border mx-1" />
            <span className="text-[10px] text-ink-lighter self-center">难度:</span>
            {DIFFICULTY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => handleBatchDifficulty(d)}
                className="bg-white/60 text-ink-light rounded-lg px-2 py-1 text-[10px] hover:bg-white"
              >
                {d === "beginner" ? "初级" : d === "advanced" ? "高级" : "中级"}
              </button>
            ))}
            {categories && categories.length > 0 && (
              <>
                <div className="w-px bg-border mx-1" />
                <span className="text-[10px] text-ink-lighter self-center">分类:</span>
                {categories.slice(0, 6).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleBatchCategory(c.id)}
                    className="bg-white/60 text-ink-light rounded-lg px-2 py-1 text-[10px] hover:bg-white"
                  >
                    {c.icon}{c.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-lighter" />
          <input
            className="w-full bg-card border border-border rounded-xl pl-9 pr-8 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="实时搜索英文或中文..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
          <FilterChip active={!typeFilter} onClick={() => { setTypeFilter(""); setPage(1); }}>
            全部类型
          </FilterChip>
          {EXPRESSION_TYPES.map((t) => (
            <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(typeFilter === t ? "" : t)}>
              {TYPE_LABELS[t]}
            </FilterChip>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={!statusFilter} onClick={() => { setStatusFilter(""); setPage(1); }}>
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
            <FilterChip active={!categoryFilter} onClick={() => { setCategoryFilter(""); setPage(1); }}>
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
            {totalCount} 条结果
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

      {!isLoading && !error && expressions.length === 0 && (
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
        {expressions.map((expr: Record<string, unknown>) => (
          <ExpressionCard
            key={expr.id as string}
            expr={expr}
            batchMode={batchMode}
            selected={selectedIds.has(expr.id as string)}
            onToggleSelect={() => toggleSelect(expr.id as string)}
            onClick={() => navigate(`/english/expressions/${expr.id}`)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center disabled:opacity-30"
          >
            <ChevronLeft size={14} className="text-ink-light" />
          </button>
          <span className="text-xs text-ink-lighter">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center disabled:opacity-30"
          >
            <ChevronRight size={14} className="text-ink-light" />
          </button>
        </div>
      )}
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
function ExpressionCard({
  expr,
  batchMode,
  selected,
  onToggleSelect,
  onClick,
}: {
  expr: Record<string, unknown>;
  batchMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  const status = (expr.status as string) || "collected";
  const type = (expr.type as string) || "vocabulary";

  return (
    <div
      className={cn(
        "bg-card rounded-2xl border p-4 transition-colors relative",
        selected ? "border-sage-light bg-sage-light/10" : "border-border hover:border-sage-light/50",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {batchMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className={cn(
              "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
              selected ? "bg-sage-deep border-sage-deep text-white" : "border-ink/20",
            )}
          >
            {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        )}

        {/* Content */}
        <button
          onClick={batchMode ? onToggleSelect : onClick}
          className="flex-1 text-left min-w-0 flex items-start justify-between gap-3"
        >
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
              <span className={cn("text-[10px] rounded-full px-2 py-0.5", STATUS_STYLE[status] || STATUS_STYLE.collected)}>
                {STATUS_LABELS[status] || status}
              </span>
            </div>
            {!batchMode && <ChevronRight size={14} className="text-ink-lighter shrink-0" />}
          </div>
        </button>
      </div>

      {(expr.next_review_date as string) && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-ink-lighter ml-[28px]">
          <Clock size={10} />
          下次复习: {new Date(expr.next_review_date as string).toLocaleDateString("zh-CN")}
        </div>
      )}
    </div>
  );
}
