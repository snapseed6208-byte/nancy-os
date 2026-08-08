import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, Loader2, AlertTriangle, Edit3, Check, X, Trash2,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import {
  useUpdateExpressionAsset,
  useDeleteExpressionAsset,
  computeAssetQualityScore,
  ASSET_TYPE_LABELS,
  type ExpressionAsset,
  type AssetType,
  type AssetData,
} from "@/lib/hooks/useChineseSpeaking";

const TYPE_COLORS: Record<AssetType, string> = {
  personal_story: "bg-blue-100 text-blue-700",
  experience_case: "bg-emerald-100 text-emerald-700",
  viewpoint: "bg-purple-100 text-purple-700",
  quality_expression: "bg-amber-100 text-amber-700",
  quote: "bg-rose-100 text-rose-700",
};

function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-ink-light">{label}</span>
      <p className="text-sm text-ink leading-relaxed">{value}</p>
    </div>
  );
}

function AssetContent({ asset }: { asset: ExpressionAsset }) {
  const data = asset.asset_data as unknown as Record<string, unknown>;

  switch (asset.asset_type) {
    case "personal_story":
      return (
        <div className="space-y-3">
          <FieldRow label="背景" value={data.background as string} />
          <FieldRow label="挑战" value={data.challenge as string} />
          <FieldRow label="行动" value={data.action as string} />
          <FieldRow label="结果" value={data.result as string} />
          <FieldRow label="反思" value={data.reflection as string} />
        </div>
      );
    case "experience_case":
      return (
        <div className="space-y-3">
          <FieldRow label="场景 (Situation)" value={data.situation as string} />
          <FieldRow label="任务 (Task)" value={data.task as string} />
          <FieldRow label="行动 (Action)" value={data.action as string} />
          <FieldRow label="结果 (Result)" value={data.result as string} />
          <FieldRow label="学习 (Learning)" value={data.learning as string} />
        </div>
      );
    case "viewpoint":
      return (
        <div className="space-y-3">
          <FieldRow label="话题" value={data.topic as string} />
          <FieldRow label="我的立场" value={data.my_position as string} />
          <FieldRow label="推理" value={data.reasoning as string} />
          <FieldRow label="例子" value={data.example as string} />
          <FieldRow label="边界条件" value={data.boundary as string} />
          <FieldRow label="反方论点" value={data.counter_argument as string} />
        </div>
      );
    case "quality_expression":
      return (
        <div className="space-y-3">
          <FieldRow label="原始问题" value={data.original_question as string} />
          <FieldRow label="原始回答" value={data.my_original_answer as string} />
          <div className="bg-sage-light/10 rounded-xl p-3 border border-sage-light/20">
            <span className="text-[11px] font-medium text-sage-deep">优化回答</span>
            <p className="text-sm text-ink leading-relaxed mt-1">{data.optimized_answer as string}</p>
          </div>
          <FieldRow label="优化原因" value={data.why_good as string} />
          {(data.skill_tags as string[])?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(data.skill_tags as string[]).map((t) => (
                <span key={t} className="text-[10px] bg-sage-light/30 text-sage-deep rounded-full px-2 py-0.5">{t}</span>
              ))}
            </div>
          )}
        </div>
      );
    case "quote":
      return (
        <div className="space-y-3">
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
            <p className="text-base font-medium text-ink leading-relaxed">"{data.quote as string}"</p>
          </div>
          <FieldRow label="来源上下文" value={data.source_context as string} />
          <FieldRow label="我的理解" value={data.my_understanding as string} />
          <FieldRow label="应用场景" value={data.application_scene as string} />
        </div>
      );
    default:
      return <p className="text-sm text-ink-lighter">未知资产类型</p>;
  }
}

export default function ExpressionAssetDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/chinese/assets/:id");
  const id = params?.id;
  const qc = useQueryClient();
  const updateAsset = useUpdateExpressionAsset();
  const deleteAsset = useDeleteExpressionAsset();

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ["expression_asset", id],
    queryFn: async (): Promise<ExpressionAsset | null> => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("expression_assets")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return (data as ExpressionAsset) || null;
    },
    enabled: !!id,
  });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (asset) {
      setEditTitle(asset.title);
      setEditTags(asset.tags.join(", "));
      setEditData(asset.asset_data as unknown as Record<string, string>);
    }
  }, [asset]);

  const handleSave = async () => {
    if (!asset || !id) return;
    setSaving(true);

    // Parse tags from comma-separated string
    const tags = editTags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    // Recompute quality score
    const qualityScore = computeAssetQualityScore(
      asset.asset_type,
      editData as unknown as AssetData,
      asset.confidence,
      tags,
    );

    await updateAsset.mutateAsync({
      id,
      updates: {
        title: editTitle,
        tags,
        asset_data: editData as unknown as AssetData,
        // Also update quality_score via raw supabase call
      },
    });

    // Update quality_score separately since the hook only updates title/tags/asset_data
    await supabase
      .from("expression_assets")
      .update({ quality_score: qualityScore })
      .eq("id", id);

    qc.invalidateQueries({ queryKey: ["expression_asset", id] });
    qc.invalidateQueries({ queryKey: ["expression_assets"] });
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!id || !confirm("确定删除这条资产？")) return;
    await deleteAsset.mutateAsync(id);
    navigate("/chinese/assets");
  };

  const setDataField = (field: string, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  // Loading
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-sage-deep" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <button onClick={() => navigate("/chinese/assets")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">资产详情</h1>
          </div>
        </header>
        <div className="bg-accent-rose/5 border border-accent-rose/10 rounded-xl p-4 text-sm text-accent-rose flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>加载失败：{(error as Error).message}</span>
        </div>
      </div>
    );
  }

  // Not found
  if (!asset) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-3">
          <button onClick={() => navigate("/chinese/assets")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
            <ArrowLeft size={16} className="text-ink-light" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">资产详情</h1>
          </div>
        </header>
        <div className="text-center py-16">
          <p className="text-sm text-ink-lighter">资产不存在或已被删除</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate("/chinese/assets")} className="h-8 w-8 rounded-lg bg-ink/5 flex items-center justify-center shrink-0">
          <ArrowLeft size={16} className="text-ink-light" />
        </button>
        <div className="flex-1">
          <p className="text-sm text-ink-lighter">表达资产库</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            {editing ? "编辑资产" : "资产详情"}
          </h1>
        </div>
        {!editing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="h-8 px-3 rounded-lg bg-ink/5 text-ink-light text-xs font-medium flex items-center gap-1.5 hover:bg-ink/10"
            >
              <Edit3 size={13} />
              编辑
            </button>
            <button
              onClick={handleDelete}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-accent-rose/5"
            >
              <Trash2 size={15} className="text-accent-rose/60" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={saving || !editTitle.trim()}
              className="h-8 px-3 rounded-lg bg-sage-light text-sage-deep text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              保存
            </button>
            <button
              onClick={() => {
                setEditing(false);
                // Reset form
                if (asset) {
                  setEditTitle(asset.title);
                  setEditTags(asset.tags.join(", "));
                  setEditData(asset.asset_data as unknown as Record<string, string>);
                }
              }}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-ink/5"
            >
              <X size={15} className="text-ink-lighter" />
            </button>
          </div>
        )}
      </header>

      {/* Type badge + metadata */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("text-xs rounded-full px-2.5 py-1 font-medium", TYPE_COLORS[asset.asset_type])}>
          {ASSET_TYPE_LABELS[asset.asset_type]}
        </span>
        <span className="text-xs text-ink-lighter">
          {asset.confidence === "high" ? "高置信度" : "中置信度"}
        </span>
        <span className="text-xs text-ink-lighter">·</span>
        <span className="text-xs text-ink-lighter">
          {new Date(asset.created_at).toLocaleDateString("zh-CN")}
        </span>
      </div>

      {/* Title */}
      {editing ? (
        <input
          className="w-full bg-transparent border border-border rounded-xl px-3 py-2 text-lg font-semibold text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          autoFocus
        />
      ) : (
        <h2 className="text-lg font-semibold text-ink">{asset.title}</h2>
      )}

      {/* Quality scores */}
      <div className="bg-card rounded-xl border border-border p-3 space-y-2">
        <p className="text-[11px] font-medium text-ink-light">质量评分</p>
        <div className="space-y-1.5">
          {[
            { label: "完整度", key: "completeness", value: asset.quality_score.completeness, color: "bg-sage-deep/60" },
            { label: "真实度", key: "authenticity", value: asset.quality_score.authenticity, color: "bg-blue-400/60" },
            { label: "复用度", key: "reusability", value: asset.quality_score.reusability, color: "bg-purple-400/60" },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <span className="text-[11px] text-ink-light w-12">{item.label}</span>
              <div className="flex-1 h-2 bg-ink/8 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
              </div>
              <span className="text-[11px] font-mono text-ink-light w-8 text-right">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="bg-card rounded-xl border border-border p-3 space-y-2">
        <p className="text-[11px] font-medium text-ink-light">标签</p>
        {editing ? (
          <input
            className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="用逗号分隔多个标签"
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {asset.tags.map((tag) => (
              <span key={tag} className="text-xs bg-ink/5 text-ink-light rounded-full px-2.5 py-1">
                <Tag size={10} className="inline mr-1" />{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-[11px] font-medium text-ink-light mb-3">内容</p>
        {editing ? (
          <div className="space-y-3">
            {Object.entries(editData).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <span className="text-[11px] font-medium text-ink-light">{key}</span>
                <textarea
                  className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-lighter outline-none focus:border-sage-deep/50 resize-none"
                  rows={2}
                  value={value || ""}
                  onChange={(e) => setDataField(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        ) : (
          <AssetContent asset={asset} />
        )}
      </div>

      {/* Evidence (read-only) */}
      <div className="bg-ink/3 rounded-xl border border-border p-4 space-y-3">
        <p className="text-[11px] font-medium text-ink-light">来源证据 (不可编辑)</p>
        <FieldRow label="原文引用" value={asset.evidence_quote} />
        <FieldRow label="提取自" value={asset.extracted_from_transcript} />
        {asset.source_session_id && (
          <button
            onClick={() => navigate(`/chinese/detail/${asset.source_session_id}`)}
            className="text-xs text-sage-deep font-medium underline"
          >
            查看原始训练记录
          </button>
        )}
      </div>
    </div>
  );
}
