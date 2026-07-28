import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useExpression, useCreateExpression, useUpdateExpression, useDeleteExpression } from "@/lib/hooks/useEnglish";
import { EXPRESSION_TYPES } from "@/lib/types";

const SCENES = [
  "daily life", "work", "study", "travel", "social", "shopping",
  "food", "health", "technology", "culture", "business", "academic",
];

export default function EnglishExpressionDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/english/expressions/:id");
  const id = params?.id;
  const isNew = !id || id === "new";

  const { data: existing, isLoading } = useExpression(isNew ? undefined : id);
  const createExpr = useCreateExpression();
  const updateExpr = useUpdateExpression();
  const deleteExpr = useDeleteExpression();

  const [form, setForm] = useState({
    english: "",
    chinese: "",
    type: "vocabulary",
    scene: "daily life",
    example_sentence: "",
    pronunciation: "",
    source_text: "",
    notes: "",
  });

  useEffect(() => {
    if (existing && !isNew) {
      setForm({
        english: (existing.english as string) || "",
        chinese: (existing.chinese as string) || "",
        type: (existing.type as string) || "vocabulary",
        scene: (existing.scene as string) || "daily life",
        example_sentence: (existing.example_sentence as string) || "",
        pronunciation: (existing.pronunciation as string) || "",
        source_text: (existing.source_text as string) || "",
        notes: (existing.notes as string) || "",
      });
    }
  }, [existing, isNew]);

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.english.trim() || !form.chinese.trim()) return;

    if (isNew) {
      await createExpr.mutateAsync(form);
    } else {
      await updateExpr.mutateAsync({ id, ...form });
    }
    navigate("/english/expressions");
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm("确定删除这条表达？")) return;
    await deleteExpr.mutateAsync(id);
    navigate("/english/expressions");
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-sm text-ink-lighter">加载中...</div>
    );
  }

  const isSaving = createExpr.isPending || updateExpr.isPending;

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate("/english/expressions")}
          className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div>
          <p className="text-sm text-ink-lighter">English OS</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            {isNew ? "添加表达" : "编辑表达"}
          </h1>
        </div>
        {!isNew && (
          <button
            onClick={handleDelete}
            className="ml-auto h-8 w-8 rounded-lg bg-accent-rose/10 flex items-center justify-center shrink-0"
          >
            <Trash2 size={14} className="text-accent-rose" />
          </button>
        )}
      </header>

      <div className="space-y-3">
        {/* English */}
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">英文 *</label>
          <input
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="e.g., I'm on the fence about..."
            value={form.english}
            onChange={(e) => set("english", e.target.value)}
          />
        </div>

        {/* Chinese */}
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">中文 *</label>
          <input
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="e.g., 我还在犹豫..."
            value={form.chinese}
            onChange={(e) => set("chinese", e.target.value)}
          />
        </div>

        {/* Type + Scene row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">类型</label>
            <select
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-sage-light"
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
            >
              {EXPRESSION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-light mb-1 block">场景</label>
            <select
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink outline-none focus:border-sage-light"
              value={form.scene}
              onChange={(e) => set("scene", e.target.value)}
            >
              {SCENES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Pronunciation */}
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">发音</label>
          <input
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="音标或发音要点"
            value={form.pronunciation}
            onChange={(e) => set("pronunciation", e.target.value)}
          />
        </div>

        {/* Example Sentence */}
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">例句</label>
          <textarea
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
            rows={2}
            placeholder="e.g., I'm on the fence about whether to accept the job offer."
            value={form.example_sentence}
            onChange={(e) => set("example_sentence", e.target.value)}
          />
        </div>

        {/* Source */}
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">来源</label>
          <input
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light"
            placeholder="e.g., YouTube 视频 / 文章标题"
            value={form.source_text}
            onChange={(e) => set("source_text", e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-ink-light mb-1 block">笔记</label>
          <textarea
            className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-light resize-none"
            rows={2}
            placeholder="用法说明、注意事项..."
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isSaving || !form.english.trim() || !form.chinese.trim()}
        className="w-full bg-sage-light text-sage-deep rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {isSaving ? "保存中..." : "保存"}
      </button>

      {(createExpr.error || updateExpr.error) && (
        <p className="text-xs text-accent-rose text-center">
          保存失败: {(createExpr.error as Error)?.message || (updateExpr.error as Error)?.message}
        </p>
      )}
    </div>
  );
}
