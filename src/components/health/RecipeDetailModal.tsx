import { useState } from "react";
import {
  X, ExternalLink, Edit3, Trash2, RefreshCw,
  ChefHat, ListOrdered, Lightbulb, Clock, Loader2,
  Subtitles, FileText, ScanText, AlertTriangle,
} from "lucide-react";
import type { Recipe, RecipeIngredient, RecipeStep, RecipeSourceType } from "@/lib/hooks/useHealth";
import RecipeEditForm from "@/components/health/RecipeEditForm";

type RecipeDetailModalProps = {
  recipe: Recipe;
  onClose: () => void;
  onUpdate: (input: {
    id: string;
    name?: string;
    image_url?: string;
    ingredients_json?: RecipeIngredient[];
    steps_json?: RecipeStep[];
  }) => Promise<unknown>;
  onDelete: (id: string) => void;
  onRetryAnalysis: (recipe: { id: string; source_url: string; source_context?: string; source_type?: RecipeSourceType }) => Promise<unknown>;
  isRetrying: boolean;
  retryError?: Error | null;
};

function getPlatformBadge(platform: string | null) {
  const map: Record<string, string> = { bilibili: "B站", douyin: "抖音", xiaohongshu: "小红书", youtube: "YT" };
  return map[platform || ""] || platform || "web";
}

function getSourceTypeLabel(st: string | null) {
  const map: Record<string, string> = { bilibili: "B站视频", douyin: "抖音视频", xiaohongshu: "小红书笔记", manual: "手动输入" };
  return map[st || ""] || "";
}

type ContentSource = {
  icon: typeof Subtitles;
  label: string;
  status: "yes" | "partial";
};

function deriveContentSources(
  sourceContent: Record<string, unknown> | null,
  sourceType: RecipeSourceType | null,
): ContentSource[] {
  if (!sourceContent) return [];

  const sc = sourceContent;
  const sources: ContentSource[] = [];

  // Manual input: user-provided text, not extracted from platform
  if (sourceType === "manual") {
    const hasContent = typeof sc.description === "string" && (sc.description as string).trim().length > 20;
    if (hasContent) {
      sources.push({
        icon: FileText,
        label: "用户输入",
        status: "yes",
      });
    }
    return sources;
  }

  if (sourceType === "bilibili") {
    // B站: show description/简介, subtitle/字幕, tags/标签 — only if content exists
    const hasDesc = typeof sc.description === "string" && sc.description.trim().length > 10;
    if (hasDesc) {
      sources.push({
        icon: FileText,
        label: "视频简介",
        status: "yes",
      });
    }

    const hasSubtitle = typeof sc.subtitle === "string" && sc.subtitle.trim().length > 30;
    if (hasSubtitle) {
      sources.push({
        icon: Subtitles,
        label: "视频字幕",
        status: "yes",
      });
    }

    const tags = sc.tags as string[] | undefined;
    if (tags && tags.length > 0) {
      // Show tags as a summary source
      const hasNoOtherContent = !hasDesc && !hasSubtitle;
      sources.push({
        icon: FileText,
        label: `视频标签 (${tags.slice(0, 3).join("、")}${tags.length > 3 ? "..." : ""})`,
        status: hasNoOtherContent ? "partial" : "yes",
      });
    }

    return sources;
  }

  if (sourceType === "xiaohongshu") {
    // 小红书: show description/正文, ocr_text/图片OCR — only if content exists
    const hasBody = typeof sc.description === "string" && sc.description.trim().length > 30;
    if (hasBody) {
      sources.push({
        icon: FileText,
        label: "笔记正文",
        status: "yes",
      });
    }

    const hasOcr = typeof sc.ocr_text === "string" && sc.ocr_text.trim().length > 30;
    if (hasOcr) {
      sources.push({
        icon: ScanText,
        label: "图片OCR",
        status: "yes",
      });
    }

    // Title-only fallback
    const hasTitle = typeof sc.title === "string" && sc.title.trim().length > 0;
    if (hasTitle && !hasBody && !hasOcr) {
      sources.push({
        icon: AlertTriangle,
        label: `仅标题: ${(sc.title as string).slice(0, 30)}`,
        status: "partial",
      });
    }

    return sources;
  }

  // Generic / douyin / other platforms — show whichever fields have content
  const hasSubtitle = typeof sc.subtitle === "string" && sc.subtitle.trim().length > 30;
  if (hasSubtitle) {
    sources.push({
      icon: Subtitles,
      label: "视频字幕",
      status: "yes",
    });
  }

  const hasDesc = typeof sc.description === "string" && sc.description.trim().length > 30;
  if (hasDesc) {
    sources.push({
      icon: FileText,
      label: "视频简介/正文",
      status: "yes",
    });
  }

  const hasOcr = typeof sc.ocr_text === "string" && sc.ocr_text.trim().length > 30;
  if (hasOcr) {
    sources.push({
      icon: ScanText,
      label: "OCR图片识别",
      status: hasDesc ? "yes" : "partial",
    });
  }

  // Title-only fallback
  const hasTitle = typeof sc.title === "string" && sc.title.trim().length > 0;
  if (hasTitle && !hasSubtitle && !hasDesc && !hasOcr) {
    sources.push({
      icon: AlertTriangle,
      label: `仅标题: ${(sc.title as string).slice(0, 30)}`,
      status: "partial",
    });
  }

  return sources;
}

const SOURCE_STATUS_STYLE: Record<string, string> = {
  yes: "text-emerald-600",
  partial: "text-amber-600",
  none: "text-slate-300",
};

const CONFIDENCE_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: "高可信", color: "bg-emerald-50 text-emerald-600" },
  medium: { label: "中可信", color: "bg-amber-50 text-amber-600" },
  low: { label: "低可信", color: "bg-red-50 text-red-500" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  pending: { label: "等待处理", color: "bg-slate-50 text-slate-500", dot: "bg-slate-400" },
  processing: { label: "正在处理", color: "bg-blue-50 text-blue-600", dot: "bg-blue-400" },
  completed: { label: "AI已整理", color: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-400" },
  partial: { label: "部分整理", color: "bg-amber-50 text-amber-600", dot: "bg-amber-400" },
  failed: { label: "处理失败", color: "bg-red-50 text-red-500", dot: "bg-red-400" },
};

export default function RecipeDetailModal({
  recipe,
  onClose,
  onUpdate,
  onDelete,
  onRetryAnalysis,
  isRetrying,
  retryError,
}: RecipeDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const status = STATUS_CONFIG[recipe.ai_analysis_status || ""] || STATUS_CONFIG.pending;
  const confidence = CONFIDENCE_CONFIG[recipe.confidence || ""] || null;
  const ingredients = Array.isArray(recipe.ingredients_json) ? recipe.ingredients_json : [];
  const steps = Array.isArray(recipe.steps_json) ? recipe.steps_json : [];
  const contentSources = deriveContentSources(
    recipe.source_content as Record<string, unknown> | null,
    recipe.source_type,
  );

  const handleSave = async (input: {
    name: string;
    image_url: string;
    ingredients_json: RecipeIngredient[];
    steps_json: RecipeStep[];
  }) => {
    setIsSaving(true);
    try {
      await onUpdate({ id: recipe.id, ...input });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = async () => {
    if (!recipe.source_url) return;
    await onRetryAnalysis({
      id: recipe.id,
      source_url: recipe.source_url,
      source_context: recipe.notes || undefined,
      source_type: recipe.source_type || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat size={16} className="text-sage-deep" />
            <span className="text-sm font-semibold text-ink">食谱详情</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status.color}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.dot} mr-1`} />
              {status.label}
            </span>
            {confidence && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${confidence.color}`}>
                {confidence.label}
              </span>
            )}
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-ink/5">
            <X size={16} className="text-ink-lighter" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isEditing ? (
            <div className="p-4">
              <RecipeEditForm
                initialData={{
                  name: recipe.name || "",
                  image_url: recipe.image_url || "",
                  ingredients_json: ingredients,
                  steps_json: steps,
                }}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
                isSaving={isSaving}
              />
            </div>
          ) : (
            <div>
              {/* Image */}
              {recipe.image_url && (
                <div className="relative w-full h-48 bg-ink/5">
                  <img
                    src={recipe.image_url}
                    alt={recipe.name || ""}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-4 space-y-4">
                {/* Name + source */}
                <div>
                  <h2 className="text-lg font-bold text-ink">{recipe.name || "未命名食谱"}</h2>
                  {(recipe.source_platform || recipe.source_type) && (
                    <div className="flex items-center gap-2 mt-1">
                      {recipe.source_platform && (
                        <span className="text-[10px] bg-ink/5 rounded-full px-1.5 py-0.5 text-ink-lighter">
                          {getPlatformBadge(recipe.source_platform)}
                        </span>
                      )}
                      {recipe.source_type && (
                        <span className="text-[10px] text-ink-lighter">
                          {getSourceTypeLabel(recipe.source_type)}
                        </span>
                      )}
                      {recipe.source_url && (
                        <a
                          href={recipe.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sage-deep flex items-center gap-0.5 hover:underline"
                        >
                          查看原视频 <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Content Sources */}
                {contentSources.length > 0 && (
                  <div className="bg-ink/[0.02] rounded-xl p-3">
                    <h3 className="text-[10px] font-semibold text-ink-lighter mb-2 uppercase tracking-wide">内容来源</h3>
                    <div className="space-y-1">
                      {contentSources.map((source, i) => {
                        const Icon = source.icon;
                        const statusIcon = source.status === "yes" ? "✓" : source.status === "partial" ? "~" : "✗";
                        return (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <Icon size={12} className={SOURCE_STATUS_STYLE[source.status]} />
                            <span className="text-ink-light flex-1">{source.label}</span>
                            <span className={`font-mono text-[10px] font-semibold ${SOURCE_STATUS_STYLE[source.status]}`}>
                              {statusIcon}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {confidence && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-ink/5">
                        <span className="text-[10px] text-ink-lighter">综合可信度</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidence.color}`}>
                          {confidence.label}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Ingredients */}
                <div>
                  <h3 className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                    <ChefHat size={13} className="text-sage-deep" />
                    食材准备
                  </h3>
                  {ingredients.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {ingredients.map((item, i) => (
                        <div
                          key={i}
                          className="bg-ink/5 rounded-lg px-2.5 py-1.5 flex items-center justify-between"
                        >
                          <span className="text-xs text-ink">{item.name}</span>
                          <span className="text-[10px] text-ink-lighter">{item.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-lighter">暂无食材数据</p>
                  )}
                </div>

                {/* Steps */}
                <div>
                  <h3 className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                    <ListOrdered size={13} className="text-sage-deep" />
                    制作步骤
                  </h3>
                  {steps.length > 0 ? (
                    <ol className="space-y-2">
                      {steps
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        .map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-sage-light text-sage-deep text-[10px] font-bold flex items-center justify-center">
                              {s.order ?? i + 1}
                            </span>
                            <span className="text-xs text-ink leading-relaxed pt-0.5">{s.text}</span>
                            {s.duration && (
                              <span className="shrink-0 text-[10px] text-ink-lighter flex items-center gap-0.5">
                                <Clock size={9} />{s.duration}分钟
                              </span>
                            )}
                          </li>
                        ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-ink-lighter">暂无步骤数据</p>
                  )}
                </div>

                {/* AI Summary */}
                {recipe.ai_summary && (
                  <div>
                    <h3 className="text-xs font-semibold text-ink mb-2 flex items-center gap-1.5">
                      <Lightbulb size={13} className="text-accent-warm" />
                      AI小贴士
                    </h3>
                    <p className="text-xs text-ink-light leading-relaxed bg-accent-warm/5 rounded-xl p-3">
                      {recipe.ai_summary}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!isEditing && (
          <div className="shrink-0 px-4 py-3 border-t border-border flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-sage-light text-sage-deep rounded-xl py-2.5 text-xs font-semibold hover:bg-sage-light/80 transition-colors"
            >
              <Edit3 size={12} />编辑
            </button>
            <button
              onClick={handleRetry}
              disabled={isRetrying || !recipe.source_url}
              className="flex items-center justify-center gap-1.5 bg-ink/5 text-ink-light rounded-xl py-2.5 px-3 text-xs font-medium hover:bg-ink/10 disabled:opacity-40 transition-colors"
            >
              {isRetrying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              重新分析
            </button>
            {retryError && (
              <p className="text-[10px] text-red-500 mt-1">{(retryError as Error).message || "重试失败"}</p>
            )}
            <button
              onClick={() => { onDelete(recipe.id); onClose(); }}
              className="flex items-center justify-center gap-1.5 bg-red-50 text-red-500 rounded-xl py-2.5 px-3 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <Trash2 size={12} />删除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
