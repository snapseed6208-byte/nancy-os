import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Upload, FileText, Sparkles, Loader2, BookOpen,
  ChevronRight, ArrowLeft, Check, X, Edit3,
  Trash2, AlertTriangle, FileUp, ClipboardPaste,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useParseFile, useExtractExpressions, useBatchImportExpressions,
  type ParsedExpression,
} from "@/lib/hooks/useEnglish";

const TYPE_LABELS: Record<string, string> = {
  vocabulary: "词汇",
  chunk: "语块",
  sentencePattern: "句式",
  speakingExpression: "口语表达",
};

const TYPE_COLORS: Record<string, string> = {
  vocabulary: "bg-blue-50 text-blue-600",
  chunk: "bg-amber-50 text-amber-600",
  sentencePattern: "bg-purple-50 text-purple-600",
  speakingExpression: "bg-sage-light text-sage-deep",
};

const SCENE_LABELS: Record<string, string> = {
  "daily life": "日常",
  study: "学习",
  internship: "实习",
  business: "商务",
  IELTS: "雅思",
  commuting: "通勤",
  renting: "租房",
  emotions: "情感",
  food: "饮食",
  shopping: "购物",
  work: "工作",
  interview: "面试",
  academic: "学术",
  other: "其他",
};

type ImportStep = "input" | "review" | "done";

export default function EnglishImport() {
  const [, navigate] = useLocation();
  const parseFile = useParseFile();
  const extractExpressions = useExtractExpressions();
  const batchImport = useBatchImportExpressions();

  const [step, setStep] = useState<ImportStep>("input");
  const [mode, setMode] = useState<"file" | "text">("text");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileWarning, setFileWarning] = useState("");
  const [expressions, setExpressions] = useState<(ParsedExpression & { selected: boolean })[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ParsedExpression | null>(null);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setFileWarning("");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await parseFile.mutateAsync({
          file: base64,
          mime_type: file.type || "text/plain",
        });
        if (result.text) {
          setText(result.text);
        }
        if (result.warning) {
          setFileWarning(result.warning);
        }
      } catch {
        setFileWarning("文件解析失败，请尝试直接粘贴文本");
      }
    };
    reader.readAsDataURL(file);
  }, [parseFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Expression extraction ──

  const handleExtract = async () => {
    if (!text.trim()) return;
    try {
      const result = await extractExpressions.mutateAsync({ text: text.trim() });
      setExpressions(result.expressions.map((e) => ({ ...e, selected: true })));
      setStep("review");
    } catch {
      // error handled by mutation state
    }
  };

  // ── Review actions ──

  const toggleSelect = (idx: number) => {
    setExpressions((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, selected: !e.selected } : e)),
    );
  };

  const selectAll = () => setExpressions((prev) => prev.map((e) => ({ ...e, selected: true })));
  const deselectAll = () => setExpressions((prev) => prev.map((e) => ({ ...e, selected: false })));

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditForm({ ...expressions[idx] });
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (editingIdx === null || !editForm) return;
    setExpressions((prev) =>
      prev.map((e, i) => (i === editingIdx ? { ...editForm, selected: e.selected } : e)),
    );
    setEditingIdx(null);
    setEditForm(null);
  };

  const removeExpression = (idx: number) => {
    setExpressions((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) {
      setEditingIdx(null);
      setEditForm(null);
    }
  };

  const updateEditField = (field: keyof ParsedExpression, value: string | number) => {
    if (!editForm) return;
    setEditForm({ ...editForm, [field]: value });
  };

  const handleImport = async () => {
    const selected = expressions.filter((e) => e.selected);
    if (selected.length === 0) return;
    const batchId = await batchImport.mutateAsync({
      expressions: selected,
      source_type: fileName ? "file" : "text",
      source_name: fileName || undefined,
    });
    setImportBatchId(batchId);
    setStep("done");
  };

  const selectedCount = expressions.filter((e) => e.selected).length;

  // ── Render ──

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        <StepBadge num={1} label="输入内容" active={step === "input"} done={step !== "input"} />
        <ChevronRight size={12} className="text-ink-lighter" />
        <StepBadge num={2} label="审核表达式" active={step === "review"} done={step === "done"} />
        <ChevronRight size={12} className="text-ink-lighter" />
        <StepBadge num={3} label="导入完成" active={step === "done"} done={false} />
      </div>

      {/* ── Step 1: Input ── */}
      {step === "input" && (
        <div className="space-y-4">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-ink/5 rounded-xl p-1">
            <button
              onClick={() => setMode("text")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-colors",
                mode === "text" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
              )}
            >
              <ClipboardPaste size={15} />
              粘贴文本
            </button>
            <button
              onClick={() => setMode("file")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-colors",
                mode === "file" ? "bg-white text-ink shadow-sm" : "text-ink-light hover:text-ink",
              )}
            >
              <FileUp size={15} />
              上传文件
            </button>
          </div>

          {mode === "text" ? (
            <div className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="粘贴英文文章、新闻、演讲稿、教材内容...&#10;AI 会自动提取有价值的英语表达（语块、搭配、句式、口语表达）"
                className="w-full bg-card border border-border rounded-2xl p-4 text-sm text-ink placeholder:text-ink-lighter outline-none h-44 resize-none focus:border-sage-light/50 transition-colors"
              />
              {text && (
                <p className="text-[11px] text-ink-lighter">
                  已输入 {text.length} 个字符（超过 8000 字符将被截断）
                </p>
              )}
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "bg-card border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors",
                fileName ? "border-sage-light/50 bg-sage-light/5" : "border-border hover:border-sage-light/30",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx,.md"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="hidden"
              />
              {parseFile.isPending ? (
                <div className="space-y-2">
                  <Loader2 size={28} className="animate-spin text-sage-deep mx-auto" />
                  <p className="text-sm text-ink-light">解析文件中...</p>
                </div>
              ) : fileName ? (
                <div className="space-y-2">
                  <FileText size={28} className="text-sage-deep mx-auto" />
                  <p className="text-sm font-medium text-ink">{fileName}</p>
                  <p className="text-xs text-ink-lighter">
                    {text ? `已提取 ${text.length} 个字符` : "文件已加载"}
                  </p>
                  {fileWarning && (
                    <p className="text-xs text-amber-600 flex items-center justify-center gap-1">
                      <AlertTriangle size={11} />
                      {fileWarning}
                    </p>
                  )}
                  <p className="text-[10px] text-ink-lighter">点击重新选择文件</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={28} className="text-ink-lighter mx-auto" />
                  <p className="text-sm text-ink-light">拖拽文件到此处或点击上传</p>
                  <p className="text-xs text-ink-lighter">支持 TXT / PDF / DOCX / Markdown</p>
                </div>
              )}
            </div>
          )}

          {/* Extract errors */}
          {extractExpressions.error && (
            <div className="bg-accent-rose/10 border border-accent-rose/20 rounded-xl p-3 text-sm text-accent-rose">
              {(extractExpressions.error as Error).message}
            </div>
          )}

          {/* Extract button */}
          <button
            onClick={handleExtract}
            disabled={!text.trim() || extractExpressions.isPending}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:from-amber-200 hover:to-orange-200 transition-colors"
          >
            {extractExpressions.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                AI 正在提取表达式...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                提取英语表达式
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Step 2: Review ── */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("input")}
                className="flex items-center gap-1 text-xs text-ink-lighter hover:text-ink transition-colors"
              >
                <ArrowLeft size={13} />
                返回编辑
              </button>
              <span className="text-xs text-ink-lighter">
                {expressions.length} 条表达式
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={selectAll} className="text-[11px] text-ink-light hover:text-ink px-2 py-1 rounded-lg transition-colors">
                全选
              </button>
              <button onClick={deselectAll} className="text-[11px] text-ink-light hover:text-ink px-2 py-1 rounded-lg transition-colors">
                取消全选
              </button>
            </div>
          </div>

          {/* Expression list */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {expressions.map((expr, idx) => (
              <div key={idx}>
                {editingIdx === idx && editForm ? (
                  <div className="bg-card rounded-2xl border border-sage-light/50 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-ink-lighter">英文</label>
                        <input
                          value={editForm.english}
                          onChange={(e) => updateEditField("english", e.target.value)}
                          className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-lighter">中文</label>
                        <input
                          value={editForm.chinese}
                          onChange={(e) => updateEditField("chinese", e.target.value)}
                          className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-lighter">类型</label>
                        <select
                          value={editForm.type}
                          onChange={(e) => updateEditField("type", e.target.value)}
                          className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                        >
                          {Object.entries(TYPE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-lighter">难度</label>
                        <select
                          value={editForm.difficulty_level || "intermediate"}
                          onChange={(e) => updateEditField("difficulty_level", e.target.value)}
                          className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                        >
                          <option value="beginner">初级</option>
                          <option value="intermediate">中级</option>
                          <option value="advanced">高级</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-lighter">场景</label>
                        <select
                          value={editForm.scene || ""}
                          onChange={(e) => updateEditField("scene", e.target.value)}
                          className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                        >
                          <option value="">无</option>
                          {Object.entries(SCENE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-lighter">话题</label>
                        <input
                          value={editForm.topic || ""}
                          onChange={(e) => updateEditField("topic", e.target.value)}
                          className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-ink-lighter">例句</label>
                      <input
                        value={editForm.example_sentence || ""}
                        onChange={(e) => updateEditField("example_sentence", e.target.value)}
                        className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-ink-lighter">使用说明</label>
                      <input
                        value={editForm.usage_note || ""}
                        onChange={(e) => updateEditField("usage_note", e.target.value)}
                        className="w-full bg-transparent text-sm text-ink border border-border rounded-lg px-2.5 py-1.5 outline-none focus:border-sage-light/50"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={cancelEdit}
                        className="text-xs text-ink-lighter hover:text-ink px-3 py-1.5 rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={saveEdit}
                        className="text-xs font-semibold bg-sage-light text-sage-deep rounded-lg px-4 py-1.5 hover:bg-sage-light/80 transition-colors"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={cn(
                    "bg-card rounded-2xl border p-4 flex items-start gap-3 transition-colors",
                    expr.selected ? "border-border hover:border-sage-light/30" : "border-border opacity-50",
                  )}>
                    <button
                      onClick={() => toggleSelect(idx)}
                      className={cn(
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                        expr.selected
                          ? "bg-sage-deep border-sage-deep text-white"
                          : "border-ink-lighter/30",
                      )}
                    >
                      {expr.selected && <Check size={11} strokeWidth={3} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{expr.english}</p>
                          <p className="text-xs text-ink-light mt-0.5">{expr.chinese}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={cn(
                            "text-[10px] rounded-full px-2 py-0.5",
                            TYPE_COLORS[expr.type] || "bg-ink/5 text-ink-lighter",
                          )}>
                            {TYPE_LABELS[expr.type] || expr.type}
                          </span>
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {expr.scene && (
                          <span className="text-[10px] text-ink-lighter">
                            {SCENE_LABELS[expr.scene] || expr.scene}
                          </span>
                        )}
                        {expr.topic && (
                          <span className="text-[10px] text-ink-lighter bg-ink/5 rounded-full px-1.5 py-0.5">
                            {expr.topic}
                          </span>
                        )}
                        {expr.difficulty_level && (
                          <span className="text-[10px] text-ink-lighter">
                            {expr.difficulty_level === "beginner" ? "初级" : expr.difficulty_level === "advanced" ? "高级" : "中级"}
                          </span>
                        )}
                        {expr.usefulness_level && (
                          <span className="text-[10px] text-ink-lighter">
                            实用度 {expr.usefulness_level}/5
                          </span>
                        )}
                      </div>

                      {/* Example */}
                      {expr.example_sentence && (
                        <p className="text-[11px] text-ink-lighter italic mt-1.5 leading-relaxed line-clamp-2">
                          {expr.example_sentence}
                        </p>
                      )}

                      {/* Usage note */}
                      {expr.usage_note && (
                        <p className="text-[10px] text-ink-lighter mt-1">{expr.usage_note}</p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(idx)}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-ink/5 transition-colors"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => removeExpression(idx)}
                        className="h-6 w-6 rounded-lg flex items-center justify-center text-ink-lighter hover:bg-accent-rose/10 hover:text-accent-rose transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Import errors */}
          {batchImport.error && (
            <div className="bg-accent-rose/10 border border-accent-rose/20 rounded-xl p-3 text-sm text-accent-rose">
              {(batchImport.error as Error).message}
            </div>
          )}

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={selectedCount === 0 || batchImport.isPending}
            className="w-full flex items-center justify-center gap-2 bg-sage-light text-sage-deep rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:bg-sage-light/80 transition-colors"
          >
            {batchImport.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                导入中...
              </>
            ) : (
              <>
                <BookOpen size={16} />
                导入 {selectedCount} 条表达式
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Step 3: Done ── */}
      {step === "done" && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-4">
          <div className="h-14 w-14 bg-sage-light rounded-2xl flex items-center justify-center mx-auto">
            <Check size={26} className="text-sage-deep" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">导入完成</h2>
            <p className="text-sm text-ink-light mt-1">
              已成功导入 {expressions.filter((e) => e.selected).length} 条英语表达式
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
            {(["vocabulary", "chunk", "sentencePattern", "speakingExpression"] as const).map((type) => {
              const count = expressions.filter((e) => e.selected && e.type === type).length;
              if (count === 0) return null;
              return (
                <div key={type} className="bg-ink/5 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-ink">{count}</p>
                  <p className="text-[10px] text-ink-lighter">{TYPE_LABELS[type]}</p>
                </div>
              );
            })}
          </div>

          {importBatchId && (
            <p className="text-[10px] text-ink-lighter">
              批次: {importBatchId.slice(0, 8)}...
            </p>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setText("");
                setFileName("");
                setFileWarning("");
                setExpressions([]);
                setImportBatchId(null);
                setStep("input");
              }}
              className="text-sm font-semibold bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 rounded-xl px-5 py-2.5 hover:from-amber-200 hover:to-orange-200 transition-colors"
            >
              继续导入
            </button>
            <button
              onClick={() => navigate("/english/expressions")}
              className="text-sm font-semibold bg-sage-light text-sage-deep rounded-xl px-5 py-2.5 hover:bg-sage-light/80 transition-colors"
            >
              查看表达库
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step Badge ──

function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={cn("flex items-center gap-1.5", active ? "" : "opacity-40")}>
      <span className={cn(
        "h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
        done ? "bg-sage-deep text-white" : active ? "bg-ink text-white" : "bg-ink/10 text-ink-light",
      )}>
        {done ? <Check size={11} strokeWidth={3} /> : num}
      </span>
      <span className="text-xs font-medium text-ink">{label}</span>
    </div>
  );
}
