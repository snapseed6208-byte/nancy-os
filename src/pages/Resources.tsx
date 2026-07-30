import { useState, useMemo } from "react";
import {
  Link2, Plus, Tag, Trash2, ExternalLink, Archive, Star,
  Loader2, FolderOpen, Sparkles, Lightbulb, Target, Check,
  Search, ChevronDown, Quote, MapPin, GitBranch,
  BookOpen, Edit3, X, Play, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useResources, useCreateResource, useUpdateResource, useDeleteResource,
  useContentParser, useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useAllResourceTags, useCreateTags, useAttachTagsToResource, useDetachTagFromResource,
  type ResourceRow, type ParsedContent, type Category, type TagType,
} from "@/lib/hooks/useResources";

// ── Constants ──

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  saved: { label: "已保存", color: "bg-slate-50 text-slate-500" },
  understood: { label: "已理解", color: "bg-blue-50 text-blue-600" },
  applied: { label: "已应用", color: "bg-emerald-50 text-emerald-600" },
};

const TYPE_LABELS: Record<string, string> = {
  article: "文章", video: "视频", workout: "健身视频", recipe: "食谱", course: "课程",
};

const PLATFORM_BADGES: Record<string, string> = {
  bilibili: "B站", douyin: "抖音", xiaohongshu: "小红书", youtube: "YT",
};

const DEFAULT_CATEGORY_COLORS = [
  "text-accent-sky", "text-accent-rose", "text-sage-deep", "text-accent-warm",
  "text-amber-600", "text-purple-600", "text-indigo-600", "text-teal-600",
];

// ── Page ──

export default function Resources() {
  const { data: resources, isLoading } = useResources();
  const { data: categories } = useCategories();
  const { data: allResourceTags } = useAllResourceTags();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const deleteResource = useDeleteResource();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createTags = useCreateTags();
  const attachTags = useAttachTagsToResource();
  const detachTag = useDetachTagFromResource();

  const parseContent = useContentParser();

  // UI state
  const [showImport, setShowImport] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [parsed, setParsed] = useState<ParsedContent | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);

  // New category inline form
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");

  // ── Handlers ──

  const handleParse = () => {
    if (!importInput.trim()) return;
    const isUrl = /^https?:\/\//.test(importInput.trim());
    parseContent.mutate(
      isUrl ? { url: importInput.trim() } : { text: importInput.trim() },
      { onSuccess: (data) => setParsed(data) },
    );
  };

  const handleSaveParsed = async (overrides?: { title?: string; category_id?: string; tags?: string[]; status?: string }) => {
    if (!parsed) return;
    const tagNames = overrides?.tags || parsed.tags;

    try {
      // Step 1: Create resource (without inline tags — tags go through junction table)
      const newResource = await createResource.mutateAsync({
        title: overrides?.title || parsed.title,
        url: parsed.source_url || undefined,
        resource_type: parsed.content_type,
        category_id: overrides?.category_id || undefined,
        source_url: parsed.source_url || undefined,
        source_platform: parsed.source_platform || undefined,
        source_title: parsed.title,
        ai_summary: parsed.summary,
        ai_category: parsed.category,
        ai_key_points: parsed.key_points,
        ai_important_quotes: parsed.important_quotes,
        ai_action_items: parsed.action_items,
        ai_suggested_category: parsed.suggested_category || undefined,
        ai_applicable_scenarios: parsed.applicable_scenarios,
        ai_related_knowledge: parsed.related_knowledge,
        raw_content: parsed.raw_content || undefined,
        content_type: parsed.content_type,
        status: overrides?.status || "saved",
      });

      // Step 2: Create tags in tags table (idempotent upsert)
      if (tagNames && tagNames.length > 0) {
        const tagRecords = await createTags.mutateAsync(tagNames);
        // Step 3: Attach tags to the new resource via junction table
        await attachTags.mutateAsync({
          resourceId: (newResource as ResourceRow).id,
          tagIds: tagRecords.map((t) => t.id),
        });
      }

      setParsed(null);
      setImportInput("");
      setShowImport(false);
    } catch {
      // Error state handled by mutation's isError
    }
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    const colorIdx = (categories?.length || 0) % DEFAULT_CATEGORY_COLORS.length;
    createCategory.mutate(
      { name: newCatName.trim(), icon: "📁", color: DEFAULT_CATEGORY_COLORS[colorIdx] },
      { onSuccess: () => { setNewCatName(""); setShowNewCategory(false); } },
    );
  };

  const handleRenameCategory = (id: string) => {
    if (!editCatName.trim()) { setEditingCategory(null); return; }
    updateCategory.mutate(
      { id, name: editCatName.trim() },
      { onSuccess: () => { setEditingCategory(null); setEditCatName(""); } },
    );
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm("删除分类后，该分类下的资源将变为未分类。确定删除？")) {
      deleteCategory.mutate(id);
    }
  };

  const handleStatusCycle = (id: string, currentStatus: string | null) => {
    const next: Record<string, string> = { saved: "understood", understood: "applied", applied: "saved" };
    updateResource.mutate({ id, status: next[currentStatus || "saved"] || "saved" });
  };

  // ── Filtering ──

  const filteredResources = useMemo(() => {
    if (!resources) return [];
    let result = resources;
    if (activeCategory) {
      result = result.filter((r) => r.category_id === activeCategory);
    }
    if (statusFilter) {
      result = result.filter((r) => (r.status || "saved") === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (r.ai_summary || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [resources, activeCategory, statusFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-lighter">个人知识库</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Resource Inbox</h1>
        </div>
        <button
          onClick={() => { setShowImport(!showImport); setParsed(null); setImportInput(""); }}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
            showImport ? "bg-ink/5 text-ink" : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 hover:from-amber-200 hover:to-orange-200",
          )}
        >
          <Sparkles size={16} />
          AI 智能导入
        </button>
      </header>

      {/* Category Navigation */}
      {categories && categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "shrink-0 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors",
              !activeCategory ? "bg-ink/10 text-ink" : "text-ink-lighter hover:bg-ink/5",
            )}
          >
            全部
          </button>
          {categories.map((cat) => (
            <div key={cat.id} className="shrink-0 relative group">
              {editingCategory === cat.id ? (
                <input
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  onBlur={() => handleRenameCategory(cat.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(cat.id); if (e.key === "Escape") setEditingCategory(null); }}
                  className="text-xs font-medium rounded-lg px-3 py-1.5 bg-ink/5 outline-none border border-border w-28"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  onDoubleClick={() => { setEditingCategory(cat.id); setEditCatName(cat.name); }}
                  className={cn(
                    "text-xs font-medium rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1",
                    activeCategory === cat.id ? "bg-ink/10 text-ink" : "text-ink-lighter hover:bg-ink/5",
                  )}
                >
                  <span>{cat.icon || "📁"}</span>
                  {cat.name}
                </button>
              )}
              {/* Context menu on hover */}
              <div className="absolute top-full mt-1 right-0 bg-white border border-border rounded-lg shadow-lg py-1 hidden group-hover:block z-20">
                <button
                  onClick={() => { setEditingCategory(cat.id); setEditCatName(cat.name); }}
                  className="text-xs text-ink-light hover:bg-ink/5 px-3 py-1.5 w-full text-left flex items-center gap-1.5"
                >
                  <Edit3 size={10} /> 重命名
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 w-full text-left flex items-center gap-1.5"
                >
                  <Trash2 size={10} /> 删除
                </button>
              </div>
            </div>
          ))}
          {/* Add category */}
          {showNewCategory ? (
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onBlur={handleCreateCategory}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); if (e.key === "Escape") { setShowNewCategory(false); setNewCatName(""); } }}
              placeholder="分类名称..."
              className="shrink-0 text-xs rounded-lg px-3 py-1.5 bg-ink/5 outline-none border border-border w-24"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setShowNewCategory(true)}
              className="shrink-0 text-xs text-ink-lighter hover:text-ink hover:bg-ink/5 rounded-lg px-2 py-1.5 flex items-center gap-0.5 transition-colors"
            >
              <Plus size={12} />
              新建
            </button>
          )}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-ink/[0.03] rounded-xl px-3 py-2 border border-border/50">
          <Search size={14} className="text-ink-lighter shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索标题、标签、摘要..."
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-lighter outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs bg-ink/[0.03] border border-border/50 rounded-xl px-3 py-2 outline-none text-ink-lighter"
        >
          <option value="">全部状态</option>
          <option value="saved">已保存</option>
          <option value="understood">已理解</option>
          <option value="applied">已应用</option>
        </select>
      </div>

      {/* AI Smart Import */}
      {showImport && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <Sparkles size={15} />
            AI 智能导入
          </div>

          {!parsed ? (
            <div className="space-y-3">
              <textarea
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                placeholder="粘贴文章链接、视频链接，或直接输入文本内容...&#10;AI 会自动识别类型并提取关键信息，构建你的个人知识库"
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-3 h-24 resize-none focus:border-amber-300/50 transition-colors"
                onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleParse(); }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleParse}
                  disabled={parseContent.isPending || !importInput.trim()}
                  className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:from-amber-200 hover:to-orange-200 transition-colors flex items-center gap-1.5"
                >
                  {parseContent.isPending ? (
                    <><Loader2 size={13} className="animate-spin" />AI 分析中...</>
                  ) : (
                    <><Sparkles size={13} />开始分析</>
                  )}
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportInput(""); }}
                  className="text-xs text-ink-lighter hover:text-ink px-3 py-2 transition-colors"
                >
                  取消
                </button>
                {parseContent.error && (
                  <p className="text-xs text-accent-rose">{(parseContent.error as Error).message}</p>
                )}
              </div>
            </div>
          ) : (
            <ImportConfirmPanel
              parsed={parsed}
              categories={categories || []}
              isSaving={createResource.isPending}
              onSave={handleSaveParsed}
              onCancel={() => { setParsed(null); setImportInput(""); }}
            />
          )}
        </div>
      )}

      {/* Resource List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-sage-deep" />
        </div>
      ) : !filteredResources.length ? (
        <div className="text-center py-14">
          <FolderOpen size={36} className="text-ink-lighter mx-auto mb-3 opacity-25" />
          <p className="text-sm text-ink-lighter">
            {resources?.length ? "没有匹配的资源" : "还没有资源"}
          </p>
          <p className="text-xs text-ink-lighter mt-1">
            {resources?.length ? "尝试调整搜索或筛选条件" : "使用 AI 智能导入，构建你的个人知识库"}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredResources.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              categories={categories || []}
              tags={allResourceTags?.[r.id] || []}
              onClick={() => setSelectedResource(r)}
              onToggleFavorite={(id) => updateResource.mutate({ id, is_favorite: !r.is_favorite })}
              onArchive={(id) => updateResource.mutate({ id, is_archived: true })}
              onDelete={(id) => deleteResource.mutate(id)}
              onStatusCycle={(id) => handleStatusCycle(id, r.status)}
            />
          ))}
        </div>
      )}

      {/* Resource Detail Modal */}
      {selectedResource && (
        <ResourceDetailModal
          resource={selectedResource}
          categories={categories || []}
          tags={allResourceTags?.[selectedResource.id] || []}
          onClose={() => setSelectedResource(null)}
          onUpdate={(id, fields) => updateResource.mutate({ id, ...fields })}
          onDelete={(id) => { deleteResource.mutate(id); setSelectedResource(null); }}
          onStatusCycle={(id) => handleStatusCycle(id, selectedResource.status)}
          onDetachTag={(tagId) => detachTag.mutate({ resourceId: selectedResource.id, tagId })}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Import Confirmation Panel
// ═══════════════════════════════════════════

function ImportConfirmPanel({
  parsed: p,
  categories,
  isSaving,
  onSave,
  onCancel,
}: {
  parsed: ParsedContent;
  categories: Category[];
  isSaving: boolean;
  onSave: (overrides: { title?: string; category_id?: string; tags?: string[]; status?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(p.title);
  // Pre-select category if AI's suggested_category matches an existing category
  const suggestedCat = p.suggested_category;
  const matchedCategoryId = suggestedCat
    ? categories.find((c) => c.name === suggestedCat)?.id || ""
    : "";
  const [categoryId, setCategoryId] = useState<string>(matchedCategoryId);
  // Tag chips
  const [tagChips, setTagChips] = useState<string[]>(p.tags || []);
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = () => {
    const name = tagInput.trim().replace(/^#/, "");
    if (name && !tagChips.includes(name)) {
      setTagChips([...tagChips, name]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (name: string) => {
    setTagChips(tagChips.filter((t) => t !== name));
  };

  return (
    <div className="space-y-4">
      {/* Source info banner */}
      {p.source_platform && (
        <div className="flex items-center gap-2 text-xs text-ink-lighter bg-ink/[0.02] rounded-xl px-3 py-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink/5">
            {PLATFORM_BADGES[p.source_platform] || p.source_platform}
          </span>
          {p.source_url && (
            <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-accent-sky flex items-center gap-0.5">
              <ExternalLink size={9} /> 查看来源
            </a>
          )}
        </div>
      )}

      {/* Title (editable) */}
      <div>
        <label className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider">标题</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-ink outline-none border border-border rounded-xl px-3 py-2 mt-1 focus:border-sage-deep/50"
        />
      </div>

      {/* Category selector */}
      <div>
        <label className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider">
          分类
          {suggestedCat && (
            <span className="ml-1 text-amber-600">
              AI推荐: {suggestedCat}
              {!matchedCategoryId && <span className="text-accent-rose ml-1">(待确认)</span>}
            </span>
          )}
        </label>
        <div className="mt-1">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full text-xs bg-transparent border border-border rounded-xl px-3 py-2 outline-none text-ink"
          >
            <option value="">选择分类...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon || "📁"} {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags — chip-based input */}
      <div>
        <label className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider">标签</label>
        <div className="mt-1 space-y-2">
          {tagChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagChips.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[10px] bg-sage-light/40 text-sage-deep rounded-full pl-2.5 pr-1 py-1">
                  {t}
                  <button onClick={() => handleRemoveTag(t)} className="hover:text-accent-rose">
                    <XCircle size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
              placeholder="输入标签后回车添加"
              className="flex-1 text-xs bg-transparent border border-border rounded-xl px-3 py-1.5 outline-none placeholder:text-ink-lighter"
            />
            <button
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="shrink-0 text-xs text-sage-deep hover:bg-sage-light/30 rounded-lg px-2 py-1.5 disabled:opacity-30 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      {p.summary && (
        <div>
          <label className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider">AI 摘要</label>
          <p className="text-xs text-ink-light leading-relaxed mt-1 bg-ink/[0.02] rounded-xl p-3">
            {p.summary}
          </p>
        </div>
      )}

      {/* Key Points */}
      {p.key_points && p.key_points.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider mb-1 flex items-center gap-1">
            <Lightbulb size={10} className="text-amber-500" /> 核心观点
          </p>
          <ul className="space-y-0.5">
            {p.key_points.map((kp, i) => (
              <li key={i} className="text-[11px] text-ink-light flex items-start gap-1.5">
                <span className="text-amber-400 mt-0.5 shrink-0">&#x2022;</span>
                {kp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Important Quotes */}
      {p.important_quotes && p.important_quotes.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider mb-1 flex items-center gap-1">
            <Quote size={10} className="text-purple-500" /> 重要引用
          </p>
          <div className="space-y-1">
            {p.important_quotes.map((q, i) => (
              <p key={i} className="text-[11px] text-ink-light italic border-l-2 border-purple-200 pl-2">
                {q}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {p.action_items && p.action_items.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider mb-1 flex items-center gap-1">
            <Target size={10} className="text-accent-sky" /> 行动建议
          </p>
          <div className="space-y-1">
            {p.action_items.map((ai, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-ink-light">
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded font-semibold shrink-0",
                  ai.priority === "high" ? "bg-accent-rose/10 text-accent-rose" :
                  ai.priority === "medium" ? "bg-amber-50 text-amber-700" : "bg-ink/5 text-ink-lighter",
                )}>
                  {ai.priority === "high" ? "高" : ai.priority === "medium" ? "中" : "低"}
                </span>
                {ai.action}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Applicable Scenarios + Related Knowledge */}
      {(p.applicable_scenarios?.length > 0 || p.related_knowledge?.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {p.applicable_scenarios?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin size={10} className="text-emerald-500" /> 适用场景
              </p>
              <div className="space-y-0.5">
                {p.applicable_scenarios.map((s, i) => (
                  <p key={i} className="text-[11px] text-ink-light">{s}</p>
                ))}
              </div>
            </div>
          )}
          {p.related_knowledge?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-ink-lighter uppercase tracking-wider mb-1 flex items-center gap-1">
                <GitBranch size={10} className="text-indigo-500" /> 关联知识
              </p>
              <div className="flex flex-wrap gap-1">
                {p.related_knowledge.map((rk, i) => (
                  <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                    {rk}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[10px] text-ink-lighter">{p.tokens_used} tokens</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="text-xs text-ink-lighter hover:text-ink px-3 py-2 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSave({
              title: title.trim(),
              category_id: categoryId || undefined,
              tags: tagChips,
            })}
            disabled={isSaving || !title.trim()}
            className="bg-sage-light text-sage-deep rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors flex items-center gap-1.5"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            保存到知识库
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Resource Card
// ═══════════════════════════════════════════

function ResourceCard({
  resource: r,
  categories,
  tags,
  onClick,
  onToggleFavorite,
  onArchive,
  onDelete,
  onStatusCycle,
}: {
  resource: ResourceRow;
  categories: Category[];
  tags: TagType[];
  onClick: () => void;
  onToggleFavorite: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusCycle: (id: string) => void;
}) {
  const status = STATUS_CONFIG[r.status || "saved"] || STATUS_CONFIG.saved;
  const platformBadge = r.source_platform ? PLATFORM_BADGES[r.source_platform] : null;
  const category = categories.find((c) => c.id === r.category_id);

  return (
    <div
      className="bg-card rounded-2xl border border-border p-4 hover:border-sage-light/30 transition-colors group cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Source cover or icon */}
        <div className="shrink-0">
          {r.source_cover ? (
            <img src={r.source_cover} alt="" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-ink/5 flex items-center justify-center">
              {r.content_type === "video" ? (
                <Play size={18} className="text-ink-lighter" />
              ) : (
                <BookOpen size={18} className="text-ink-lighter" />
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink truncate">{r.title}</p>
                {platformBadge && (
                  <span className="shrink-0 text-[9px] bg-ink/5 rounded px-1 py-0.5 text-ink-lighter">
                    {platformBadge}
                  </span>
                )}
                <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full ${status.color}`}>
                  {status.label}
                </span>
              </div>
              {r.source_author && (
                <p className="text-[11px] text-ink-lighter mt-0.5">{r.source_author}</p>
              )}
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-ink-lighter hover:text-accent-sky flex items-center gap-1 mt-0.5 transition-colors"
                >
                  <Link2 size={10} />
                  <span className="truncate">{r.url}</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onToggleFavorite(r.id)}
                className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors", r.is_favorite ? "text-amber-500 bg-amber-50" : "text-ink-lighter hover:bg-ink/5")}
                title={r.is_favorite ? "取消收藏" : "收藏"}
              >
                <Star size={13} fill={r.is_favorite ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => onStatusCycle(r.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5 transition-colors"
                title={`状态: ${status.label} (点击切换)`}
              >
                <ChevronDown size={13} />
              </button>
              <button
                onClick={() => onArchive(r.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5 transition-colors"
                title="归档"
              >
                <Archive size={13} />
              </button>
              <button
                onClick={() => onDelete(r.id)}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-accent-rose/10 hover:text-accent-rose transition-colors"
                title="删除"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Category */}
          {category && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-ink-light">
              <span className="text-ink-lighter shrink-0">分类：</span>
              <span>{category.icon || "📁"} {category.name}</span>
            </div>
          )}

          {/* Tags — from resource_tags junction table */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.map((t) => (
                <span key={t.id} className="text-[10px] text-sage-deep bg-sage-light/30 rounded-full px-2 py-0.5">
                  #{t.name}
                </span>
              ))}
            </div>
          )}

          {/* AI Summary preview */}
          {r.ai_summary && (
            <p className="text-xs text-ink-light leading-relaxed mt-2 line-clamp-2">
              {r.ai_summary}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-ink-lighter">{TYPE_LABELS[r.content_type || ""] || r.resource_type}</span>
            {r.module && <span className="text-[10px] text-ink-lighter">{r.module}</span>}
            <span className="text-[10px] text-ink-lighter">{new Date(r.created_at).toLocaleDateString("zh-CN")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Resource Detail Modal
// ═══════════════════════════════════════════

function ResourceDetailModal({
  resource: r,
  categories,
  tags,
  onClose,
  onUpdate,
  onDelete,
  onStatusCycle,
  onDetachTag,
}: {
  resource: ResourceRow;
  categories: Category[];
  tags: TagType[];
  onClose: () => void;
  onUpdate: (id: string, fields: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onStatusCycle: (id: string) => void;
  onDetachTag: (tagId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"source" | "ai" | "personal">("ai");
  const [userNotes, setUserNotes] = useState(r.user_notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const status = STATUS_CONFIG[r.status || "saved"] || STATUS_CONFIG.saved;
  const category = categories.find((c) => c.id === r.category_id);

  const handleSaveNotes = () => {
    onUpdate(r.id, { user_notes: userNotes });
    setIsEditingNotes(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-ink truncate">{r.title}</h2>
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onStatusCycle(r.id)}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5 text-ink-lighter"
              title="切换状态"
            >
              <ChevronDown size={14} />
            </button>
            <button
              onClick={() => { onDelete(r.id); }}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-ink-lighter hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5">
              <X size={16} className="text-ink-lighter" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-border">
          {([
            { key: "source", label: "原始来源" },
            { key: "ai", label: "AI 理解" },
            { key: "personal", label: "个人知识" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 text-xs font-medium py-2.5 transition-colors",
                activeTab === tab.key
                  ? "text-ink border-b-2 border-sage-deep"
                  : "text-ink-lighter hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "source" && (
            <div className="space-y-4">
              {r.source_cover && (
                <img src={r.source_cover} alt="" className="w-full h-40 object-cover rounded-xl" />
              )}
              <div className="space-y-2">
                {r.source_platform && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-ink-lighter uppercase">平台</span>
                    <span className="text-xs text-ink">{PLATFORM_BADGES[r.source_platform] || r.source_platform}</span>
                  </div>
                )}
                {r.source_author && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-ink-lighter uppercase">作者</span>
                    <span className="text-xs text-ink">{r.source_author}</span>
                  </div>
                )}
                {r.source_title && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-ink-lighter uppercase">原标题</span>
                    <span className="text-xs text-ink text-right max-w-[60%]">{r.source_title}</span>
                  </div>
                )}
                {(r.url || r.source_url) && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-ink-lighter uppercase">链接</span>
                    <a
                      href={r.source_url || r.url || ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sage-deep hover:underline flex items-center gap-0.5"
                    >
                      打开来源 <ExternalLink size={9} />
                    </a>
                  </div>
                )}
              </div>
              {r.raw_content && (
                <div>
                  <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1">原始内容</h3>
                  <p className="text-[11px] text-ink-light leading-relaxed whitespace-pre-wrap bg-ink/[0.02] rounded-xl p-3 max-h-40 overflow-y-auto">
                    {r.raw_content.slice(0, 2000)}
                    {r.raw_content.length > 2000 && "..."}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between text-[10px] text-ink-lighter pt-2 border-t border-border">
                <span>创建于 {new Date(r.created_at).toLocaleDateString("zh-CN")}</span>
                {category && <span>{category.icon} {category.name}</span>}
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-4">
              {/* Category & type */}
              <div className="flex items-center gap-2">
                {r.content_type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                    {TYPE_LABELS[r.content_type] || r.content_type}
                  </span>
                )}
                {r.ai_category && (
                  <span className="text-[10px] text-ink-lighter">{r.ai_category}</span>
                )}
                {r.ai_recommended_category && (
                  <span className="text-[10px] text-amber-600">
                    AI推荐分类: {r.ai_recommended_category.name}
                  </span>
                )}
              </div>

              {/* Summary */}
              {r.ai_summary && (
                <div>
                  <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1">摘要</h3>
                  <p className="text-xs text-ink-light leading-relaxed">{r.ai_summary}</p>
                </div>
              )}

              {/* Key Points */}
              {r.ai_key_points && r.ai_key_points.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1 flex items-center gap-1">
                    <Lightbulb size={10} className="text-amber-500" /> 核心观点
                  </h3>
                  <ul className="space-y-1">
                    {r.ai_key_points.map((kp, i) => (
                      <li key={i} className="text-[11px] text-ink-light flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5">&#x2022;</span>
                        {kp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quotes */}
              {r.ai_important_quotes && r.ai_important_quotes.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1 flex items-center gap-1">
                    <Quote size={10} className="text-purple-500" /> 重要引用
                  </h3>
                  <div className="space-y-1">
                    {r.ai_important_quotes.map((q, i) => (
                      <p key={i} className="text-[11px] text-ink-light italic border-l-2 border-purple-200 pl-2">
                        {q}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              {r.ai_action_items && r.ai_action_items.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1 flex items-center gap-1">
                    <Target size={10} className="text-accent-sky" /> 行动建议
                  </h3>
                  <div className="space-y-1">
                    {r.ai_action_items.map((ai, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-ink-light">
                        <span className={cn(
                          "text-[9px] px-1 py-0.5 rounded font-semibold shrink-0",
                          ai.priority === "high" ? "bg-accent-rose/10 text-accent-rose" :
                          ai.priority === "medium" ? "bg-amber-50 text-amber-700" : "bg-ink/5 text-ink-lighter",
                        )}>
                          {ai.priority === "high" ? "高" : ai.priority === "medium" ? "中" : "低"}
                        </span>
                        {ai.action}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scenarios & Related */}
              <div className="grid grid-cols-2 gap-3">
                {r.ai_applicable_scenarios && r.ai_applicable_scenarios.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1 flex items-center gap-1">
                      <MapPin size={10} className="text-emerald-500" /> 适用场景
                    </h3>
                    {r.ai_applicable_scenarios.map((s, i) => (
                      <p key={i} className="text-[11px] text-ink-light">{s}</p>
                    ))}
                  </div>
                )}
                {r.ai_related_knowledge && r.ai_related_knowledge.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1 flex items-center gap-1">
                      <GitBranch size={10} className="text-indigo-500" /> 关联知识
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {r.ai_related_knowledge.map((rk, i) => (
                        <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">
                          {rk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1">标签</h3>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t.id} className="text-[10px] text-sage-deep bg-sage-light/30 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                        <Tag size={8} />{t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "personal" && (
            <div className="space-y-4">
              {/* Status toggle */}
              <div>
                <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1">学习状态</h3>
                <div className="flex gap-2">
                  {(["saved", "understood", "applied"] as const).map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        onClick={() => onUpdate(r.id, { status: s })}
                        className={cn(
                          "text-xs rounded-lg px-3 py-1.5 font-medium transition-colors",
                          (r.status || "saved") === s
                            ? `${cfg.color} ring-1 ring-current/20`
                            : "bg-ink/5 text-ink-lighter hover:bg-ink/10",
                        )}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-semibold text-ink-lighter uppercase">我的笔记</h3>
                  <button
                    onClick={() => setIsEditingNotes(!isEditingNotes)}
                    className="text-[10px] text-sage-deep hover:underline"
                  >
                    {isEditingNotes ? "取消" : "编辑"}
                  </button>
                </div>
                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={userNotes}
                      onChange={(e) => setUserNotes(e.target.value)}
                      placeholder="记录你的思考、行动记录、应用情况..."
                      className="w-full text-xs text-ink outline-none border border-border rounded-xl px-3 py-2 h-24 resize-none focus:border-sage-deep/50"
                    />
                    <button
                      onClick={handleSaveNotes}
                      className="bg-sage-light text-sage-deep rounded-xl px-4 py-1.5 text-[10px] font-semibold hover:bg-sage-light/80"
                    >
                      保存笔记
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-ink-light leading-relaxed bg-ink/[0.02] rounded-xl p-3 min-h-[4rem]">
                    {r.user_notes || r.notes || "还没有个人笔记。点击编辑添加你的思考和行动记录。"}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <h3 className="text-[10px] font-semibold text-ink-lighter uppercase mb-1">分类</h3>
                <select
                  value={r.category_id || ""}
                  onChange={(e) => onUpdate(r.id, { category_id: e.target.value || null })}
                  className="text-xs border border-border rounded-xl px-3 py-2 bg-transparent outline-none text-ink"
                >
                  <option value="">未分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon || "📁"} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
