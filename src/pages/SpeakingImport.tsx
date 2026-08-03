import { useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  Upload, FileText, Loader2, Sparkles, Check, X, AlertTriangle,
  ChevronRight, ArrowLeft, FileUp, Trash2, Edit3, CheckCircle,
  Download, Eye, Filter, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSpeakingImport,
  type ImportQuestion,
  type QuestionStatus,
} from "@/lib/hooks/useSpeakingImport";

// ── Constants ──

const MODE_LABELS: Record<string, string> = {
  ielts: "IELTS",
  daily: "日常",
  professional: "职场",
  personal_growth: "个人成长",
};

const MODE_COLORS: Record<string, string> = {
  ielts: "bg-blue-50 text-blue-600",
  daily: "bg-emerald-50 text-emerald-600",
  professional: "bg-purple-50 text-purple-600",
  personal_growth: "bg-amber-50 text-amber-600",
};

const TOPIC_LABELS: Record<string, string> = {
  life_routine: "生活日常",
  food_health: "饮食健康",
  travel_culture: "旅行文化",
  people_relationships: "人际关系",
  study_learning: "学习",
  work_career: "职场",
  technology: "科技",
  entertainment: "娱乐",
  emotions: "情感",
  goals_future: "目标未来",
  experiences: "经历",
  opinions: "观点",
};

const PART_LABELS: Record<string, string> = {
  part1: "Part 1",
  part2: "Part 2",
  part3: "Part 3",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
};

const STATUS_CONFIG: Record<QuestionStatus, { label: string; color: string; icon: typeof Check }> = {
  new: { label: "新增", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: Check },
  duplicate: { label: "重复", color: "bg-gray-50 text-gray-400 border-gray-200", icon: X },
  variant: { label: "相似", color: "bg-amber-50 text-amber-600 border-amber-200", icon: AlertTriangle },
  needs_review: { label: "需确认", color: "bg-red-50 text-red-500 border-red-200", icon: AlertTriangle },
};

const ALLOWED_EXTS = ".docx,.pdf,.csv,.md,.markdown,.txt";

// ── Component ──

export default function SpeakingImport() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    step, fileInfo, questions, stats, importResult, error, editingId,
    handleFile, toggleQuestion, selectAllNew, deselectDuplicates,
    batchSetMode, batchSetTopic, updateQuestion, setEditingId,
    confirmImport, reset,
    effectiveMode, effectiveTopic, effectivePart, effectiveDifficulty,
  } = useSpeakingImport();

  const isProcessing = step === "parsing" || step === "extracting" || step === "deduplicating";

  // ── File drop handlers ──

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ── Render: Upload area ──

  if (step === "idle" || step === "error") {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/english")}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5"
          >
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-ink">口语题库导入</h1>
            <p className="text-xs text-ink-lighter">上传文件，AI 自动提取并分类口语题目</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">导入失败</p>
              <p className="text-xs mt-0.5">{error}</p>
              <button
                onClick={reset}
                className="mt-2 text-xs font-medium text-red-600 underline hover:no-underline"
              >
                重新上传
              </button>
            </div>
          </div>
        )}

        {/* Upload zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors",
            dragOver ? "border-sage-deep bg-sage-light/20" : "border-border hover:border-sage-deep/50 hover:bg-sage-light/5"
          )}
        >
          <Upload size={32} className="mx-auto mb-3 text-ink-lighter" />
          <p className="text-sm font-medium text-ink mb-1">拖拽文件到此处或点击上传</p>
          <p className="text-xs text-ink-lighter">
            支持 .docx .pdf .csv .md .markdown .txt（最大 500KB）
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTS}
            onChange={onFileChange}
            className="hidden"
          />
        </div>

        {/* Format guide */}
        <div className="bg-card border border-border rounded-2xl p-3.5">
          <p className="text-xs font-semibold text-ink-light mb-2">支持的文件格式</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-ink-lighter">
            <div><span className="font-medium text-ink">.txt</span> — 每行一题</div>
            <div><span className="font-medium text-ink">.md</span> — 带编号题目</div>
            <div><span className="font-medium text-ink">.docx</span> — 混合题目与答案</div>
            <div><span className="font-medium text-ink">.pdf</span> — 可复制文字的 PDF</div>
            <div><span className="font-medium text-ink">.csv</span> — 含 question 列</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Processing ──

  if (isProcessing) {
    const labels: Record<string, string> = {
      parsing: "正在解析文件...",
      extracting: "AI 正在提取题目...",
      deduplicating: "正在去重比对...",
    };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={reset} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5">
            <X size={16} className="text-ink-light" />
          </button>
          <h1 className="text-lg font-semibold text-ink">口语题库导入</h1>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-sage-deep" />
          <p className="text-sm text-ink font-medium">{labels[step] || "处理中..."}</p>
          {fileInfo && (
            <p className="text-xs text-ink-lighter">
              {fileInfo.fileName} ({(fileInfo.charCount / 1024).toFixed(1)}KB)
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Done ──

  if (step === "done" && importResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/english")} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <h1 className="text-lg font-semibold text-ink">导入完成</h1>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col items-center gap-3">
          <CheckCircle size={36} className="text-emerald-500" />
          <p className="text-sm font-semibold text-ink">成功导入 {importResult.imported} 道题目</p>
          {importResult.skipped > 0 && (
            <p className="text-xs text-ink-lighter">已跳过 {importResult.skipped} 道重复/相似题目</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={reset}
              className="px-4 py-2 rounded-xl bg-white border border-border text-sm font-medium hover:bg-card-hover"
            >
              继续导入
            </button>
            <button
              onClick={() => navigate("/english")}
              className="px-4 py-2 rounded-xl bg-sage-deep text-white text-sm font-medium hover:bg-sage-deep/90"
            >
              返回英语 OS
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Preview ──

  const selectedCount = questions.filter((q) => q.selected).length;
  const newCount = questions.filter((q) => q.status === "new").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={reset} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5">
          <X size={16} className="text-ink-light" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-ink">预览与确认</h1>
          <p className="text-xs text-ink-lighter">
            {fileInfo?.fileName} · {questions.length} 题 · 新增 {newCount} · 选中 {selectedCount}
          </p>
        </div>
        <button
          onClick={confirmImport}
          disabled={step === "importing" || selectedCount === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sage-deep text-white text-sm font-medium hover:bg-sage-deep/90 disabled:opacity-50 transition-colors"
        >
          {step === "importing" ? (
            <><Loader2 size={14} className="animate-spin" />导入中</>
          ) : (
            <><Download size={14} />导入 {selectedCount} 题</>
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-600">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Batch controls */}
      <div className="bg-card border border-border rounded-2xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-ink-lighter mr-1">批量操作:</span>
          <button onClick={selectAllNew} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100">
            全选新增
          </button>
          <button onClick={deselectDuplicates} className="px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 text-xs font-medium hover:bg-gray-100">
            排除重复
          </button>
          <span className="text-ink-lighter mx-1">|</span>
          <select
            onChange={(e) => e.target.value && batchSetMode(e.target.value)}
            className="px-2 py-1 rounded-lg border border-border text-xs bg-white text-ink"
            defaultValue=""
          >
            <option value="" disabled>批量设 mode</option>
            {Object.entries(MODE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select
            onChange={(e) => e.target.value && batchSetTopic(e.target.value)}
            className="px-2 py-1 rounded-lg border border-border text-xs bg-white text-ink"
            defaultValue=""
          >
            <option value="" disabled>批量设 topic</option>
            {Object.entries(TOPIC_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          <StatChip label="总计" value={stats.total} color="text-ink" />
          <StatChip label="新增" value={stats.new_count} color="text-emerald-600" />
          <StatChip label="重复" value={stats.duplicate_count} color="text-gray-400" />
          <StatChip label="相似" value={stats.variant_count} color="text-amber-600" />
          <StatChip label="待确认" value={stats.needs_review} color="text-red-500" />
        </div>
      )}

      {/* Question list */}
      <div className="space-y-2">
        {questions.map((q) => (
          <QuestionCard
            key={q.temp_id}
            question={q}
            isEditing={editingId === q.temp_id}
            onToggle={() => toggleQuestion(q.temp_id)}
            onEdit={() => setEditingId(editingId === q.temp_id ? null : q.temp_id)}
            onUpdate={(field, value) => updateQuestion(q.temp_id, field, value)}
            effectiveMode={effectiveMode(q)}
            effectiveTopic={effectiveTopic(q)}
            effectivePart={effectivePart(q)}
            effectiveDifficulty={effectiveDifficulty(q)}
          />
        ))}
      </div>

      {/* Bottom confirm */}
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-3 sticky bottom-0">
        <p className="text-xs text-ink-lighter">
          已选 <span className="font-semibold text-ink">{selectedCount}</span> / {questions.length} 题
        </p>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="px-3 py-1.5 rounded-xl text-xs font-medium text-ink-lighter hover:bg-ink/5">
            取消
          </button>
          <button
            onClick={confirmImport}
            disabled={step === "importing" || selectedCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sage-deep text-white text-xs font-medium hover:bg-sage-deep/90 disabled:opacity-50"
          >
            {step === "importing" ? (
              <><Loader2 size={12} className="animate-spin" />导入中</>
            ) : (
              <><Download size={12} />确认导入 {selectedCount} 题</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat chip ──

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-center">
      <p className={cn("text-sm font-semibold", color)}>{value}</p>
      <p className="text-[10px] text-ink-lighter">{label}</p>
    </div>
  );
}

// ── Question card ──

function QuestionCard({
  question: q, isEditing, onToggle, onEdit, onUpdate,
  effectiveMode, effectiveTopic, effectivePart, effectiveDifficulty,
}: {
  question: ImportQuestion;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onUpdate: (field: string, value: unknown) => void;
  effectiveMode: string;
  effectiveTopic: string;
  effectivePart: string | null;
  effectiveDifficulty: string;
}) {
  const st = STATUS_CONFIG[q.status];
  const StatusIcon = st.icon;

  return (
    <div className={cn(
      "bg-card border rounded-2xl p-3 transition-all",
      q.selected ? "border-sage-deep/50 ring-1 ring-sage-deep/20" : "border-border",
      q.status === "duplicate" && !q.selected && "opacity-50"
    )}>
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
            q.selected ? "bg-sage-deep border-sage-deep text-white" : "border-gray-300 hover:border-sage-deep/50"
          )}
        >
          {q.selected && <Check size={12} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", MODE_COLORS[effectiveMode] || "bg-gray-50 text-gray-500")}>
              {MODE_LABELS[effectiveMode] || effectiveMode}
            </span>
            {effectivePart && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-medium">
                {PART_LABELS[effectivePart] || effectivePart}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 text-[10px]">
              {TOPIC_LABELS[effectiveTopic] || effectiveTopic}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 text-[10px]">
              {DIFFICULTY_LABELS[effectiveDifficulty] || effectiveDifficulty}
            </span>
            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium border ml-auto", st.color)}>
              <StatusIcon size={9} className="inline mr-0.5" />{st.label}
            </span>
          </div>

          <p className="text-sm text-ink leading-relaxed">{q.question}</p>

          {/* Cue points */}
          {q.cue_points && q.cue_points.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {q.cue_points.map((cp, i) => (
                <p key={i} className="text-[10px] text-ink-lighter flex items-center gap-1">
                  <span className="text-sage-deep">•</span>{cp}
                </p>
              ))}
            </div>
          )}

          {/* Tags */}
          {q.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {q.tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-sage-light/30 text-[9px] text-sage-deep">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Duplicate info */}
          {q.status === "duplicate" && q.duplicate_of && (
            <p className="text-[10px] text-gray-400 mt-1">已有相同题目 (ID: {q.duplicate_of.slice(0, 8)}...)</p>
          )}
          {q.status === "variant" && q.duplicate_of && (
            <p className="text-[10px] text-amber-500 mt-1">与已有题目相似 (ID: {q.duplicate_of.slice(0, 8)}...)</p>
          )}
          {q.status === "needs_review" && (
            <p className="text-[10px] text-red-400 mt-1">语义去重失败，需人工确认</p>
          )}
        </div>

        {/* Edit button */}
        <button
          onClick={onEdit}
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
            isEditing ? "bg-sage-deep text-white" : "hover:bg-ink/5 text-ink-lighter"
          )}
        >
          <Edit3 size={13} />
        </button>
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-4 gap-2">
          <EditField label="Mode">
            <select
              value={q.edited_mode || q.mode}
              onChange={(e) => onUpdate("edited_mode", e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-border text-[11px] bg-white"
            >
              {Object.entries(MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </EditField>
          <EditField label="Topic">
            <select
              value={q.edited_topic || q.topic}
              onChange={(e) => onUpdate("edited_topic", e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-border text-[11px] bg-white"
            >
              {Object.entries(TOPIC_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </EditField>
          <EditField label="Part">
            <select
              value={q.edited_part !== undefined ? q.edited_part || "" : q.part || ""}
              onChange={(e) => onUpdate("edited_part", e.target.value || null)}
              className="w-full px-2 py-1.5 rounded-lg border border-border text-[11px] bg-white"
            >
              <option value="">无</option>
              {Object.entries(PART_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </EditField>
          <EditField label="难度">
            <select
              value={q.edited_difficulty || q.difficulty}
              onChange={(e) => onUpdate("edited_difficulty", e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-border text-[11px] bg-white"
            >
              {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </EditField>
          <div className="col-span-4">
            <EditField label="Tags（逗号分隔）">
              <input
                type="text"
                value={q.tags.join(", ")}
                onChange={(e) => onUpdate("tags", e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean))}
                className="w-full px-2 py-1.5 rounded-lg border border-border text-[11px] bg-white"
              />
            </EditField>
          </div>
        </div>
      )}
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] text-ink-lighter block mb-0.5">{label}</span>
      {children}
    </label>
  );
}
