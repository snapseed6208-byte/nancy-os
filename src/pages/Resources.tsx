import { useState } from "react";
import {
  Link2, Plus, Tag, Trash2, ExternalLink, Archive, Star,
  BookOpen, Heart, GraduationCap, Briefcase, Globe, Loader2, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useResources, useCreateResource, useUpdateResource, useDeleteResource,
  type ResourceRow,
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

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", module: "general", notes: "", tags: "" });

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
        <button
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
            showForm ? "bg-ink/5 text-ink" : "bg-sage-light text-sage-deep hover:bg-sage-light/80",
          )}
        >
          <Plus size={16} />
          添加资源
        </button>
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
