import { useState } from "react";
import {
  Lightbulb,
  Plus,
  Loader2,
  Trash2,
  Check,
  X,
  Edit3,
  Inbox,
  Archive,
  ArrowRightLeft,
  Search,
} from "lucide-react";
import { useIdeas, useCreateIdea, useUpdateIdea, useDeleteIdea } from "@/lib/hooks/useLifeTrace";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "inbox", label: "收件箱" },
  { key: "archived", label: "已归档" },
  { key: "converted", label: "已转换" },
] as const;

const CATEGORY_OPTIONS = ["创业", "学习", "工作", "生活", "创意", "技术", "其他"];

export default function Ideas() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const filters = {
    status: statusFilter || undefined,
    search: search || undefined,
  };
  const { data: ideas, isLoading } = useIdeas(filters);
  const createIdea = useCreateIdea();
  const updateIdea = useUpdateIdea();
  const deleteIdea = useDeleteIdea();

  const handleCreate = async () => {
    if (!newContent.trim()) return;
    await createIdea.mutateAsync({
      content: newContent.trim(),
      category: newCategory || null,
    });
    setNewContent("");
    setNewCategory("");
  };

  const handleDelete = async (id: string) => {
    await deleteIdea.mutateAsync(id);
  };

  const startEdit = (idea: Record<string, unknown>) => {
    setEditingId(idea.id as string);
    setEditContent((idea.content as string) || "");
    setEditCategory((idea.category as string) || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditCategory("");
  };

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await updateIdea.mutateAsync({
      id,
      content: editContent.trim(),
      category: editCategory || null,
    });
    cancelEdit();
  };

  const toggleArchive = async (idea: Record<string, unknown>) => {
    const newStatus = idea.status === "archived" ? "inbox" : "archived";
    await updateIdea.mutateAsync({ id: idea.id, status: newStatus });
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-ink-lighter">灵感库</p>
        <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Ideas</h1>
      </header>

      {/* Quick capture */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <textarea
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none resize-none"
          rows={2}
          placeholder="任何念头...立刻记下来"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat}
              onClick={() => setNewCategory(newCategory === cat ? "" : cat)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                newCategory === cat
                  ? "border-sage-light bg-sage-light/30 text-sage-deep"
                  : "border-border text-ink-light hover:border-sage-light/50",
              )}
            >
              {cat}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={handleCreate}
            disabled={!newContent.trim() || createIdea.isPending}
            className="bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {createIdea.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            记录
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-ink/5 rounded-xl p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === tab.key
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-light hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-lighter" />
          <input
            className="w-full bg-card border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="搜索灵感..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Idea list */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-ink-lighter mx-auto" />
        </div>
      ) : !ideas?.length ? (
        <div className="bg-card rounded-2xl border border-border p-10 text-center">
          <Lightbulb size={32} className="text-ink-lighter mx-auto mb-3" />
          <p className="text-sm text-ink-light">
            {statusFilter || search ? "没有匹配的灵感" : "还没有灵感记录。在上方输入框写下第一个想法吧。"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {(ideas as Record<string, unknown>[]).map((idea) => (
            <div
              key={idea.id as string}
              className={cn(
                "bg-card rounded-2xl border border-border p-4 transition-colors",
                idea.status === "archived" && "opacity-60",
              )}
            >
              {editingId === idea.id ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full bg-transparent text-sm text-ink placeholder:text-ink-lighter outline-none resize-none border border-border rounded-xl px-3 py-2"
                    rows={2}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {CATEGORY_OPTIONS.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setEditCategory(editCategory === cat ? "" : cat)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs transition-colors",
                          editCategory === cat
                            ? "border-sage-light bg-sage-light/30 text-sage-deep"
                            : "border-border text-ink-light hover:border-sage-light/50",
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button
                      onClick={cancelEdit}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5"
                    >
                      <X size={15} />
                    </button>
                    <button
                      onClick={() => saveEdit(idea.id as string)}
                      disabled={!editContent.trim() || updateIdea.isPending}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-sage-deep hover:bg-sage-light/30"
                    >
                      <Check size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-ink leading-relaxed">{idea.content as string}</p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {(Boolean(idea.ai_category || idea.category)) && (
                      <span className="text-[11px] bg-sage-light/30 text-sage-deep rounded-full px-2 py-0.5">
                        {(idea.ai_category || idea.category) as string}
                      </span>
                    )}
                    {idea.status === "converted" && (
                      <span className="text-[11px] bg-accent-sky/10 text-accent-sky rounded-full px-2 py-0.5">
                        已转换
                      </span>
                    )}
                    <span className="text-[11px] text-ink-lighter">
                      {new Date(idea.created_at as string).toLocaleDateString("zh-CN")}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => startEdit(idea)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => toggleArchive(idea)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5"
                      title={idea.status === "archived" ? "取消归档" : "归档"}
                    >
                      {idea.status === "archived" ? <Inbox size={13} /> : <Archive size={13} />}
                    </button>
                    <button
                      onClick={() => handleDelete(idea.id as string)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-accent-rose/10 hover:text-accent-rose"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
