import { useState } from "react";
import {
  Link2, Plus, Tag, Trash2, ExternalLink, Archive, Star,
  BookOpen, Heart, GraduationCap, Briefcase, Globe, Loader2, FolderOpen,
  Sparkles, Lightbulb, Target, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useResources, useCreateResource, useUpdateResource, useDeleteResource,
  useContentParser, type ResourceRow, type ParsedContent,
} from "@/lib/hooks/useResources";

// ── Module options ──

const MODULES = [
  { key: "general", label: "通用", icon: Globe, color: "text-ink-light" },
  { key: "english", label: "英语", icon: BookOpen, color: "text-accent-sky" },
  { key: "health", label: "健康", icon: Heart, color: "text-accent-rose" },
  { key: "career", label: "职业", icon: Briefcase, color: "text-sage-deep" },
  { key: "exam", label: "考试", icon: GraduationCap, color: "text-accent-warm" },
] as const;

// ── Page ──

export default function Resources() {
  const { data: resources, isLoading } = useResources();
  const createResource = useCreateResource();
  const updateResource = useUpdateResource();
  const deleteResource = useDeleteResource();

  const parseContent = useContentParser();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", module: "general", notes: "", tags: "" });
  const [showImport, setShowImport] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [parsed, setParsed] = useState<ParsedContent | null>(null);

  const handleParse = () => {
    if (!importInput.trim()) return;
    const isUrl = /^https?:\/\//.test(importInput.trim());
    parseContent.mutate(
      isUrl ? { url: importInput.trim() } : { text: importInput.trim() },
      { onSuccess: (data) => setParsed(data) },
    );
  };

  const handleCreate = () => {
    if (!form.title.trim()) return;
    createResource.mutate(
      {
        title: form.title.trim(),
        url: form.url.trim() || undefined,
        module: form.module,
        tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setForm({ title: "", url: "", module: "general", notes: "", tags: "" });
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-lighter">知识管理</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Resource Inbox</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(!showImport); setShowForm(false); setParsed(null); }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
              showImport ? "bg-ink/5 text-ink" : "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 hover:from-amber-200 hover:to-orange-200",
            )}
          >
            <Sparkles size={16} />
            AI 智能导入
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setShowImport(false); }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
              showForm ? "bg-ink/5 text-ink" : "bg-sage-light text-sage-deep hover:bg-sage-light/80",
            )}
          >
            <Plus size={16} />
            添加资源
          </button>
        </div>
      </header>

      {/* Inline create form */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="资源标题 *"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors"
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />

          <div className="flex gap-3">
            <input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="URL 链接 (可选)"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors"
            />
            <select
              value={form.module}
              onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              className="bg-transparent text-sm text-ink outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors"
            >
              {MODULES.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <input
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="标签，逗号分隔 (可选)"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 focus:border-sage-deep/50 transition-colors"
            />
          </div>

          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="笔记 (可选)"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none border border-border rounded-xl px-3 py-2.5 h-16 resize-none focus:border-sage-deep/50 transition-colors"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={createResource.isPending || !form.title.trim()}
              className="bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:bg-sage-light/80 transition-colors"
            >
              {createResource.isPending ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-ink-lighter hover:text-ink px-3 py-2 transition-colors"
            >
              取消
            </button>
            {createResource.error && (
              <p className="text-xs text-accent-rose">{(createResource.error as Error).message}</p>
            )}
          </div>
        </div>
      )}

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
                placeholder="粘贴文章链接、视频链接，或直接输入文本内容...&#10;AI 会自动识别类型并提取关键信息"
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
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      AI 分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      开始分析
                    </>
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
            <ImportPreview
              parsed={parsed}
              onReset={() => { setParsed(null); setImportInput(""); }}
            />
          )}
        </div>
      )}

      {/* Resource list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={18} className="animate-spin text-sage-deep" />
        </div>
      ) : !resources?.length ? (
        <div className="text-center py-14">
          <FolderOpen size={36} className="text-ink-lighter mx-auto mb-3 opacity-25" />
          <p className="text-sm text-ink-lighter">还没有资源</p>
          <p className="text-xs text-ink-lighter mt-1">保存文章、视频、工具等，构建你的知识库</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {resources.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              onToggleFavorite={(id) => updateResource.mutate({ id, is_favorite: !r.is_favorite })}
              onArchive={(id) => updateResource.mutate({ id, is_archived: true })}
              onDelete={(id) => deleteResource.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Import Preview Card ──

function ImportPreview({
  parsed: p,
  onReset,
}: {
  parsed: ParsedContent;
  onReset: () => void;
}) {
  const typeLabels: Record<string, string> = {
    article: "文章", video: "视频", workout: "健身视频", recipe: "食谱", course: "课程",
  };

  return (
    <div className="space-y-3">
      {/* Success banner */}
      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2">
        <Check size={14} />
        已自动保存到 {typeLabels[p.content_type] || p.content_type} 分类
      </div>

      {/* Title + type */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-ink">{p.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
              {typeLabels[p.content_type] || p.content_type}
            </span>
            {p.category && (
              <span className="text-[10px] text-ink-lighter">{p.category}</span>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      {p.summary && (
        <p className="text-xs text-ink-light leading-relaxed">{p.summary}</p>
      )}

      {/* Key points */}
      {p.key_points && p.key_points.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-ink-light flex items-center gap-1">
            <Lightbulb size={11} className="text-amber-500" />
            关键知识点
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

      {/* Action items */}
      {p.action_items && p.action_items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-ink-light flex items-center gap-1">
            <Target size={11} className="text-accent-sky" />
            行动建议
          </p>
          <div className="space-y-1">
            {p.action_items.map((ai, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-ink-light">
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded font-semibold shrink-0",
                  ai.priority === "high" ? "bg-accent-rose/10 text-accent-rose" :
                  ai.priority === "medium" ? "bg-amber-50 text-amber-700" :
                  "bg-ink/5 text-ink-lighter",
                )}>
                  {ai.priority === "high" ? "高" : ai.priority === "medium" ? "中" : "低"}
                </span>
                {ai.action}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {p.tags && p.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.tags.map((t, i) => (
            <span key={i} className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5 flex items-center gap-1">
              <Tag size={8} />
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Tokens + action */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-ink-lighter">{p.tokens_used} tokens</span>
        <button
          onClick={onReset}
          className="text-xs font-semibold text-sage-deep bg-sage-light rounded-xl px-4 py-2 hover:bg-sage-light/80 transition-colors"
        >
          继续导入
        </button>
      </div>
    </div>
  );
}

// ── Resource Card ──

function ResourceCard({
  resource: r,
  onToggleFavorite,
  onArchive,
  onDelete,
}: {
  resource: ResourceRow;
  onToggleFavorite: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const mod = MODULES.find((m) => m.key === r.module);
  const ModIcon = mod?.icon || Globe;

  return (
    <div className="bg-card rounded-2xl border border-border p-4 hover:border-sage-light/30 transition-colors group">
      <div className="flex items-start gap-3">
        {/* Module icon */}
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", mod?.key === "general" ? "bg-ink/5" : "bg-sage-light/30")}>
          <ModIcon size={15} className={mod?.color || "text-ink-light"} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{r.title}</p>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-ink-lighter hover:text-accent-sky flex items-center gap-1 mt-0.5 transition-colors"
                >
                  <Link2 size={10} />
                  <span className="truncate">{r.url}</span>
                  <ExternalLink size={10} />
                </a>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onToggleFavorite(r.id)}
                className={cn("h-7 w-7 rounded-lg flex items-center justify-center transition-colors", r.is_favorite ? "text-amber-500 bg-amber-50" : "text-ink-lighter hover:bg-ink/5")}
                title={r.is_favorite ? "取消收藏" : "收藏"}
              >
                <Star size={13} fill={r.is_favorite ? "currentColor" : "none"} />
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

          {/* Tags */}
          {r.tags && r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {r.tags.map((t, i) => (
                <span key={i} className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-2 py-0.5 flex items-center gap-1">
                  <Tag size={8} />
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Notes */}
          {r.notes && (
            <p className="text-xs text-ink-light leading-relaxed mt-2 line-clamp-3">
              {r.notes}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-ink-lighter">{r.resource_type}</span>
            <span className="text-[10px] text-ink-lighter">{new Date(r.created_at).toLocaleDateString("zh-CN")}</span>
            {r.module && (
              <span className="text-[10px] text-ink-lighter">{mod?.label || r.module}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
