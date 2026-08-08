import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Loader2, AlertTriangle, Search, ChevronRight, X,
  Trash2, Archive, Library, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useExpressionAssets,
  useSearchExpressionAssets,
  useDeleteExpressionAsset,
  useUpdateExpressionAsset,
  ASSET_TYPE_LABELS,
  type AssetType,
  type ExpressionAsset,
} from "@/lib/hooks/useChineseSpeaking";

const ALL_TYPES: (AssetType | "")[] = ["", "personal_story", "experience_case", "viewpoint", "quality_expression", "quote"];

const SCENARIOS = ["", "面试", "商务沟通", "演讲表达", "日常观点"];

const TYPE_COLORS: Record<AssetType, string> = {
  personal_story: "bg-blue-100 text-blue-700",
  experience_case: "bg-emerald-100 text-emerald-700",
  viewpoint: "bg-purple-100 text-purple-700",
  quality_expression: "bg-amber-100 text-amber-700",
  quote: "bg-rose-100 text-rose-700",
};

function QualityScoreBar({ score }: { score: { completeness: number; authenticity: number; reusability: number } }) {
  const items = [
    { label: "完整", value: score.completeness, color: "bg-sage-deep/60" },
    { label: "真实", value: score.authenticity, color: "bg-blue-400/60" },
    { label: "复用", value: score.reusability, color: "bg-purple-400/60" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <span className="text-[9px] text-ink-lighter w-6">{item.label}</span>
          <div className="h-1 w-8 bg-ink/8 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExpressionAssetLibrary() {
  const [, navigate] = useLocation();

  const [filterType, setFilterType] = useState<AssetType | "">("");
  const [keyword, setKeyword] = useState("");
  const [scenario, setScenario] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Use search when keyword or scenario is active; otherwise use filtered list
  const isSearching = !!(keyword || scenario);
  const { data: allAssets, isLoading: allLoading, error: allError } = useExpressionAssets(filterType || undefined);
  const { data: searchAssets, isLoading: searchLoading, error: searchError } = useSearchExpressionAssets({
    keyword: keyword || undefined,
    assetType: filterType || undefined,
    scenario: scenario || undefined,
  });

  const assets = isSearching ? searchAssets : allAssets;
  const isLoading = isSearching ? searchLoading : allLoading;
  const error = isSearching ? searchError : allError;

  const deleteAsset = useDeleteExpressionAsset();
  const updateAsset = useUpdateExpressionAsset();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (assetId: string) => {
    setDeletingId(assetId);
    try {
      await deleteAsset.mutateAsync(assetId);
      setShowDeleteConfirm(null);
    } catch { /* handled by mutation */ }
    setDeletingId(null);
  };

  const handleArchive = async (asset: ExpressionAsset) => {
    await updateAsset.mutateAsync({
      id: asset.id,
      updates: { status: "archived" },
    });
  };

  // Count by type for the filter tabs
  const typeCounts = useMemo(() => {
    if (!allAssets) return {};
    const counts: Record<string, number> = {};
    for (const a of allAssets) {
      counts[a.asset_type] = (counts[a.asset_type] || 0) + 1;
    }
    return counts;
  }, [allAssets]);

  const totalCount = allAssets?.length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/chinese")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div className="flex-1">
          <p className="text-sm text-ink-lighter">中文表达</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">表达资产库</h1>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={cn("h-8 w-8 rounded-lg flex items-center justify-center", showSearch ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light")}
        >
          <Search size={16} />
        </button>
      </header>

      {/* Stats */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2 text-sm text-ink-light">
          <Library size={14} />
          <span>共 {totalCount} 条资产</span>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-lighter" />
            <input
              className="w-full bg-card border border-border rounded-xl pl-9 pr-8 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
              placeholder="搜索标题或原文..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              autoFocus
            />
            {keyword && (
              <button onClick={() => setKeyword("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={14} className="text-ink-lighter" />
              </button>
            )}
          </div>
          {/* Scenario filter */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SCENARIOS.map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                  scenario === s ? "bg-sage-light text-sage-deep" : "bg-ink/5 text-ink-light hover:bg-ink/10",
                )}
              >
                {s || "全部场景"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Type filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filterType === type
                ? "bg-sage-light text-sage-deep"
                : "bg-ink/5 text-ink-light hover:bg-ink/10",
            )}
          >
            {type === "" ? `全部 (${totalCount})` : `${ASSET_TYPE_LABELS[type]} (${typeCounts[type] || 0})`}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-sage-deep" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-4 text-sm text-accent-rose flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>加载失败：{(error as Error).message}</span>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && assets?.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <Library size={32} className="opacity-30 mx-auto" />
          <p className="text-sm text-ink-lighter">
            {filterType ? `还没有${ASSET_TYPE_LABELS[filterType as AssetType]}类型的资产` : "还没有表达资产"}
          </p>
          <p className="text-[11px] text-ink-lighter">完成表达训练后，AI 会从你的表达中提取故事、观点和金句</p>
          <button onClick={() => navigate("/chinese")} className="text-sm text-sage-deep font-medium underline">
            开始表达训练
          </button>
        </div>
      )}

      {/* Asset cards */}
      {!isLoading && !error && assets && assets.length > 0 && (
        <div className="space-y-2">
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate(`/chinese/assets/${a.id}`)}
              className="w-full bg-card rounded-xl border border-border p-3 text-left hover:border-sage-light/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] rounded-full px-2 py-0.5 font-medium", TYPE_COLORS[a.asset_type])}>
                      {ASSET_TYPE_LABELS[a.asset_type]}
                    </span>
                    {a.fact_status === "user_edited" && (
                      <span className="text-[10px] bg-ink/5 text-ink-light rounded-full px-1.5 py-0.5">已编辑</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-ink truncate">{a.title}</p>
                  {a.evidence_quote && (
                    <p className="text-[11px] text-ink-lighter mt-0.5 line-clamp-1 leading-relaxed">
                      "{a.evidence_quote.slice(0, 80)}{a.evidence_quote.length > 80 ? "..." : ""}"
                    </p>
                  )}
                  <div className="mt-2">
                    <QualityScoreBar score={a.quality_score} />
                  </div>
                  {/* Tags */}
                  {a.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {a.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="text-[10px] bg-ink/5 text-ink-light rounded-full px-2 py-0.5">
                          {tag}
                        </span>
                      ))}
                      {a.tags.length > 4 && (
                        <span className="text-[10px] text-ink-lighter">+{a.tags.length - 4}</span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-ink-lighter mt-1.5">
                    {new Date(a.created_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(showDeleteConfirm === a.id ? null : a.id);
                      }}
                      className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5"
                    >
                      <Archive size={13} className="text-ink-lighter" />
                    </button>
                    {showDeleteConfirm === a.id && (
                      <div
                        className="absolute right-0 top-8 bg-white border border-border rounded-xl shadow-lg p-2 z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleArchive(a)}
                          className="flex items-center gap-2 text-xs text-ink px-3 py-1.5 rounded-lg hover:bg-ink/5 whitespace-nowrap w-full"
                        >
                          <Archive size={12} />
                          归档
                        </button>
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deletingId === a.id}
                          className="flex items-center gap-2 text-xs text-accent-rose px-3 py-1.5 rounded-lg hover:bg-accent-rose/5 whitespace-nowrap w-full disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          {deletingId === a.id ? "删除中..." : "删除"}
                        </button>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-ink-lighter" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
