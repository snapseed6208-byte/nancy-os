import { useState, useRef } from "react";
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
  Image,
  Link2,
  ExternalLink,
} from "lucide-react";
import { useIdeas, useCreateIdea, useUpdateIdea, useDeleteIdea } from "@/lib/hooks/useLifeTrace";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { uniqueFileName } from "@/lib/media";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "inbox", label: "收件箱" },
  { key: "processed", label: "已处理" },
  { key: "archived", label: "已归档" },
  { key: "converted", label: "已转换" },
] as const;

const CATEGORY_OPTIONS = ["创业", "学习", "工作", "生活", "创意", "技术", "其他"];

type MediaAttachment = { type: "image" | "link"; url: string };

export default function Ideas() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingLinks, setPendingLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    setIsUploading(true);
    try {
      const userId = await getUserId();

      // Upload images
      const imageUrls: string[] = [];
      for (const file of pendingImages) {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = uniqueFileName(ext);
        const { error: uploadErr } = await supabase.storage
          .from("idea-images")
          .upload(fileName, file);
        if (uploadErr) throw new Error(`图片上传失败: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage
          .from("idea-images")
          .getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
      }

      const mediaAttachments: MediaAttachment[] = [
        ...imageUrls.map((url) => ({ type: "image" as const, url })),
        ...pendingLinks.map((url) => ({ type: "link" as const, url })),
      ];

      await createIdea.mutateAsync({
        content: newContent.trim(),
        content_type: "text",
        media_urls: mediaAttachments.length > 0 ? mediaAttachments : [],
        category: newCategory || null,
      });
      setNewContent("");
      setNewCategory("");
      setPendingImages([]);
      setPendingLinks([]);
      setLinkInput("");
      setShowLinkInput(false);
    } finally {
      setIsUploading(false);
    }
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

  const handleAddLink = () => {
    if (!linkInput.trim()) return;
    let url = linkInput.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setPendingLinks((prev) => [...prev, url]);
    setLinkInput("");
    setShowLinkInput(false);
  };

  const handleRemoveImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveLink = (index: number) => {
    setPendingLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const parseMedia = (raw: unknown): MediaAttachment[] => {
    if (!raw || !Array.isArray(raw)) return [];
    return raw.filter(
      (m) => m && typeof m === "object" && (m.type === "image" || m.type === "link") && typeof m.url === "string",
    ) as MediaAttachment[];
  };

  const openLink = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const linkDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
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

        {/* Attachments area */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) setPendingImages((prev) => [...prev, ...Array.from(e.target.files!)]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center gap-1 text-[11px] text-ink-light hover:text-ink bg-ink/5 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Image size={13} />添加图片
            </button>
            {!showLinkInput ? (
              <button
                type="button"
                onClick={() => setShowLinkInput(true)}
                className="flex items-center gap-1 text-[11px] text-ink-light hover:text-ink bg-ink/5 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Link2 size={13} />添加链接
              </button>
            ) : (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="url"
                  className="flex-1 bg-ink/5 rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-lighter outline-none border border-transparent focus:border-sage-light"
                  placeholder="输入链接地址..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddLink();
                    }
                    if (e.key === "Escape") {
                      setShowLinkInput(false);
                      setLinkInput("");
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  disabled={!linkInput.trim()}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-sage-deep hover:bg-sage-light/30 disabled:opacity-30"
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowLinkInput(false); setLinkInput(""); }}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Pending attachments preview */}
          {(pendingImages.length > 0 || pendingLinks.length > 0) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {pendingImages.map((file, i) => (
                <div key={`img-${i}`} className="relative group h-12 w-12 rounded-lg overflow-hidden bg-ink/5 border border-border">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute top-0 right-0 h-4 w-4 rounded-bl-lg flex items-center justify-center bg-accent-rose text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
              {pendingLinks.map((url, i) => (
                <div key={`link-${i}`} className="relative group flex items-center gap-1 bg-ink/5 rounded-lg pl-2 pr-1.5 py-1.5">
                  <Link2 size={11} className="text-ink-lighter shrink-0" />
                  <span className="text-[11px] text-ink-light truncate max-w-[120px]">{linkDomain(url)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(i)}
                    className="h-4 w-4 rounded-full flex items-center justify-center text-ink-lighter hover:text-accent-rose ml-0.5"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
            disabled={!newContent.trim() || createIdea.isPending || isUploading}
            className="bg-sage-light text-sage-deep rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
          >
            {createIdea.isPending || isUploading ? (
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
          {(ideas as Record<string, unknown>[]).map((idea) => {
            const mediaList = parseMedia(idea.media_urls);
            const images = mediaList.filter((m) => m.type === "image");
            const links = mediaList.filter((m) => m.type === "link");
            return (
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
                  {/* Show existing attachments in edit mode (non-editable) */}
                  {mediaList.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {images.map((m, i) => (
                        <div key={`edit-img-${i}`} className="h-10 w-10 rounded-lg overflow-hidden bg-ink/5 border border-border">
                          <img src={m.url} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                      {links.map((m, i) => (
                        <div key={`edit-link-${i}`} className="flex items-center gap-1 bg-ink/5 rounded-lg px-2 py-1.5">
                          <Link2 size={11} className="text-ink-lighter" />
                          <span className="text-[11px] text-ink-light truncate max-w-[140px]">{linkDomain(m.url)}</span>
                        </div>
                      ))}
                    </div>
                  )}
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

                  {/* Image thumbnails */}
                  {images.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {images.map((m, i) => (
                        <a
                          key={`img-${i}`}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-16 w-16 rounded-xl overflow-hidden bg-ink/5 border border-border hover:border-sage-light/50 transition-colors shrink-0"
                        >
                          <img src={m.url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Link cards */}
                  {links.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {links.map((m, i) => (
                        <button
                          key={`link-${i}`}
                          onClick={() => openLink(m.url)}
                          className="flex items-center gap-1.5 bg-ink/5 hover:bg-sage-light/20 rounded-lg pl-2.5 pr-2 py-1.5 transition-colors group"
                        >
                          <Link2 size={12} className="text-ink-lighter group-hover:text-sage-deep shrink-0" />
                          <span className="text-[11px] text-ink-light group-hover:text-sage-deep truncate max-w-[160px]">{linkDomain(m.url)}</span>
                          <ExternalLink size={10} className="text-ink-lighter opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}

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
            );
          })}
        </div>
      )}
    </div>
  );
}
