// ============================================
// Nancy OS — Nancy AI Dashboard
// Phase 3.6: Personal AI capability cockpit.
// Read-only — no new tables, no writes.
// ============================================

import { useNancyAIDashboard } from "@/lib/hooks/useNancyAIDashboard";
import type {
  IdentityCard,
  GrowthTimeline,
  AssetOverview,
  CareerCard,
  AIRecommendation,
} from "@/lib/hooks/useNancyAIDashboard";
import { useLocation } from "wouter";
import {
  Brain,
  TrendingUp,
  Library,
  Briefcase,
  Lightbulb,
  Mic,
  GraduationCap,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// ═══════════════════════════════════════
// Section 1: AI Identity Card
// ═══════════════════════════════════════

function IdentityCard({ data }: { data: IdentityCard }) {
  const [, navigate] = useLocation();

  if (!data.hasRealData) {
    return (
      <div className="bg-white border border-border/60 rounded-2xl p-6 text-center">
        <Brain size={32} className="mx-auto text-sage mb-3" />
        <p className="text-ink-light text-sm">
          还没有足够的个人数据。完成一些中文表达训练或英语练习后，AI 将自动构建你的个人画像。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center">
            <Brain size={20} className="text-sage-deep" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">AI 个人画像</h3>
            <p className="text-xs text-ink-light">基于你的训练数据自动构建</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="text-xs text-sage-deep hover:text-sage transition-colors"
        >
          编辑资料
        </button>
      </div>

      {/* Identity fields */}
      <div className="grid grid-cols-2 gap-3">
        <IdentityField label="昵称" value={data.nickname || "—"} />
        <IdentityField label="职业方向" value={data.careerField || data.careerDirection || "—"} />
        <IdentityField label="生活主题" value={data.lifeTheme || "—"} />
        <IdentityField label="当前阶段" value={data.currentMilestone || "—"} />
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-ink-light mb-2">优势</p>
          {data.strengths.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {data.strengths.slice(0, 6).map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-sage-light text-sage-deep">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-light/60">待训练数据积累</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-ink-light mb-2">待提升</p>
          {data.weaknesses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {data.weaknesses.slice(0, 6).map((w) => (
                <span key={w} className="text-xs px-2 py-0.5 rounded-full bg-accent-warm/20 text-accent-warm">
                  {w}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-light/60">待训练数据积累</p>
          )}
        </div>
      </div>

      {/* Communication style */}
      {data.communicationStyle && (
        <div className="pt-1 border-t border-border/40">
          <p className="text-xs font-medium text-ink-light mb-1">沟通风格</p>
          <p className="text-sm text-ink">{data.communicationStyle}</p>
        </div>
      )}
    </div>
  );
}

function IdentityField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-warm-cream rounded-lg px-3 py-2">
      <p className="text-[10px] text-ink-light/70 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-ink mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════
// Section 2: Growth Timeline
// ═══════════════════════════════════════

const DIRECTION_LABELS: Record<string, string> = {
  improving: "正在提升",
  stable: "保持稳定",
  exploring: "探索中",
  insufficient_data: "数据积累中",
};

const DIRECTION_COLORS: Record<string, string> = {
  improving: "text-sage-deep",
  stable: "text-ink-light",
  exploring: "text-accent-warm",
  insufficient_data: "text-ink-light/60",
};

function GrowthTimeline({ data }: { data: GrowthTimeline }) {
  if (data.overallDirection === "insufficient_data" && data.dimensionTrends.length === 0) {
    return (
      <div className="bg-white border border-border/60 rounded-2xl p-6 text-center">
        <TrendingUp size={32} className="mx-auto text-sage mb-3" />
        <p className="text-ink-light text-sm">
          成长数据正在收集中。完成几次中文表达训练后，这里会显示你的能力成长趋势。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center">
            <TrendingUp size={20} className="text-sage-deep" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">成长趋势</h3>
            <p className="text-xs text-ink-light">
              基于过去 60 天的训练数据
            </p>
          </div>
        </div>
        <span className={`text-sm font-medium ${DIRECTION_COLORS[data.overallDirection] || "text-ink-light"}`}>
          {DIRECTION_LABELS[data.overallDirection] || data.overallDirection}
        </span>
      </div>

      {/* Dimension trends — mini bars */}
      {data.dimensionTrends.length > 0 && (
        <div className="space-y-3">
          {data.dimensionTrends.map((d) => (
            <div key={d.dimension} className="flex items-center gap-3">
              <span className="text-xs text-ink-light w-16 shrink-0">{d.label}</span>
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs text-ink-light w-6 text-right">{d.start}</span>
                <div className="flex-1 h-2 bg-warm-cream rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-sage-light rounded-full relative"
                    style={{ width: `${Math.max(5, (d.current / 100) * 100)}%` }}
                  >
                    <div
                      className="absolute top-0 right-0 h-full bg-sage-deep rounded-full transition-all"
                      style={{ width: `${Math.max(8, Math.abs(d.delta))}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-sage-deep w-6">{d.current}</span>
                <span
                  className={`text-[10px] w-10 text-right ${
                    d.delta > 0 ? "text-sage-deep" : d.delta < 0 ? "text-accent-warm" : "text-ink-light/50"
                  }`}
                >
                  {d.delta > 0 ? `+${d.delta}` : d.delta}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary text */}
      {(data.recentProgress || data.currentFocus) && (
        <div className="space-y-2 pt-1">
          {data.recentProgress && (
            <p className="text-xs text-ink-light">
              <span className="font-medium text-ink">近期进步：</span>{data.recentProgress}
            </p>
          )}
          {data.currentFocus && (
            <p className="text-xs text-ink-light">
              <span className="font-medium text-ink">当前重点：</span>{data.currentFocus}
            </p>
          )}
          {data.trainingRhythm && (
            <p className="text-xs text-ink-light/70">{data.trainingRhythm}</p>
          )}
        </div>
      )}

      {/* Milestones */}
      {data.recentMilestones.length > 0 && (
        <div className="pt-1 border-t border-border/40">
          <p className="text-xs font-medium text-ink-light mb-2">近期里程碑</p>
          <div className="space-y-1">
            {data.recentMilestones.map((m, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-ink">
                <Sparkles size={12} className="text-sage mt-0.5 shrink-0" />
                {m}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 3: Expression Asset Overview
// ═══════════════════════════════════════

function AssetOverview({ data }: { data: AssetOverview }) {
  const [, navigate] = useLocation();

  if (data.total === 0) {
    return (
      <div className="bg-white border border-border/60 rounded-2xl p-6 text-center">
        <Library size={32} className="mx-auto text-sage mb-3" />
        <p className="text-ink-light text-sm">
          表达资产库还是空的。完成中文表达训练后，AI 会自动挖掘可复用的表达素材。
        </p>
      </div>
    );
  }

  const typeOrder = ["personal_story", "experience_case", "viewpoint", "quality_expression", "quote"];

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center">
            <Library size={20} className="text-sage-deep" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">表达资产库</h3>
            <p className="text-xs text-ink-light">共 {data.total} 项资产</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/chinese/assets")}
          className="text-xs text-sage-deep hover:text-sage transition-colors flex items-center gap-1"
        >
          查看全部 <ChevronRight size={12} />
        </button>
      </div>

      {/* Type stat cards */}
      <div className="grid grid-cols-5 gap-2">
        {typeOrder.map((type) => {
          const count = data.byType[type] || 0;
          const label = data.typeLabels[type] || type;
          return (
            <div
              key={type}
              className={`rounded-xl p-3 text-center transition-colors ${
                count > 0 ? "bg-sage-light" : "bg-warm-cream"
              }`}
            >
              <p className={`text-xl font-bold ${count > 0 ? "text-sage-deep" : "text-ink-light/40"}`}>
                {count}
              </p>
              <p className="text-[10px] text-ink-light mt-1 leading-tight">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Top 5 assets */}
      {data.topAssets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-light">Top 5 资产</p>
          {data.topAssets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => navigate(`/chinese/assets/${asset.id}`)}
              className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-warm-cream transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{asset.title}</p>
                <p className="text-[10px] text-ink-light/60 mt-0.5">
                  {(data.typeLabels[asset.assetType] || asset.assetType)}
                  {asset.tags.length > 0 && ` · ${asset.tags.slice(0, 2).join("、")}`}
                </p>
              </div>
              <ChevronRight size={14} className="text-ink-light/30 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 4: Career Asset Card
// ═══════════════════════════════════════

function CareerCard({ data }: { data: CareerCard }) {
  const hasData = data.careerField || data.targetDirection !== "待探索";

  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center">
          <Briefcase size={20} className="text-sage-deep" />
        </div>
        <div>
          <h3 className="font-semibold text-ink">职业优势</h3>
          {hasData && (
            <p className="text-xs text-ink-light">目标方向：{data.targetDirection}</p>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-3">
          <p className="text-xs text-ink-light/60">
            在设置中完善职业方向后，AI 将自动分析你的职业优势
          </p>
        </div>
      ) : (
        <>
          {/* Strengths */}
          {data.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-light mb-2">核心优势</p>
              <div className="flex flex-wrap gap-1.5">
                {data.strengths.map((s) => (
                  <span
                    key={s}
                    className="text-xs px-2.5 py-1 rounded-full bg-sage-light text-sage-deep font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skill tags cloud */}
          {data.skillTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-light mb-2">能力标签</p>
              <div className="flex flex-wrap gap-1.5">
                {data.skillTags.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-warm-cream text-ink border border-border/30"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Learning patterns */}
          {data.learningPatterns.length > 0 && (
            <div className="pt-1 border-t border-border/40">
              <p className="text-xs font-medium text-ink-light mb-2">学习模式</p>
              <div className="space-y-1">
                {data.learningPatterns.slice(0, 3).map((p, i) => (
                  <p key={i} className="text-xs text-ink-light">{p}</p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Section 5: AI Recommendations
// ═══════════════════════════════════════

const RECOMMENDATION_ICONS: Record<string, typeof Lightbulb> = {
  Mic,
  Briefcase,
  GraduationCap,
};

function AIRecommendations({ data }: { data: AIRecommendation[] }) {
  return (
    <div className="bg-white border border-border/60 rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-sage-light flex items-center justify-center">
          <Lightbulb size={20} className="text-sage-deep" />
        </div>
        <div>
          <h3 className="font-semibold text-ink">AI 建议</h3>
          <p className="text-xs text-ink-light">基于你的成长数据个性化推荐</p>
        </div>
      </div>

      <div className="space-y-3">
        {data.map((rec) => {
          const Icon = RECOMMENDATION_ICONS[rec.icon] || Lightbulb;
          return (
            <div
              key={rec.area}
              className="flex items-start gap-3 p-3 rounded-xl bg-warm-cream"
            >
              <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={14} className="text-sage-deep" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-ink-light uppercase tracking-wide mb-0.5">
                  {rec.area}
                </p>
                <p className="text-sm text-ink">{rec.suggestion}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main Dashboard Page
// ═══════════════════════════════════════

export default function NancyAIDashboard() {
  const { data, isLoading, error } = useNancyAIDashboard();

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-sage mx-auto" />
          <p className="text-sm text-ink-light">正在加载 AI 仪表盘…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3 max-w-sm">
          <AlertTriangle size={32} className="text-accent-warm mx-auto" />
          <p className="text-sm text-ink">仪表盘加载失败</p>
          <p className="text-xs text-ink-light">
            {error instanceof Error ? error.message : "请检查网络连接后刷新重试"}
          </p>
        </div>
      </div>
    );
  }

  // ── Empty state (new user) ──
  if (!data._meta.hasRealData) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-10">
          <div className="h-16 w-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
            <Brain size={32} className="text-sage-deep" />
          </div>
          <h2 className="text-lg font-semibold text-ink mb-2">AI 仪表盘</h2>
          <p className="text-sm text-ink-light max-w-md mx-auto">
            这里是你的个人 AI 能力驾驶舱。完成一些训练后，AI 将自动构建你的个人画像、成长趋势和职业优势分析。
          </p>
          <p className="text-xs text-ink-light/60 mt-3">
            试试：中文表达训练 → 一分钟表达 → 完成几次后回来查看
          </p>
        </div>
        <IdentityCard data={data.section1_identity} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-lg font-semibold text-ink">AI 仪表盘</h2>
        <p className="text-xs text-ink-light mt-1">
          个人 AI 能力驾驶舱 · 数据更新于{" "}
          {new Date(data._meta.generatedAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Two-column layout: main (left) + side (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Identity + Growth + Career */}
        <div className="lg:col-span-2 space-y-6">
          <IdentityCard data={data.section1_identity} />
          <GrowthTimeline data={data.section2_growth} />
          <CareerCard data={data.section4_career} />
        </div>

        {/* Right: Assets + Recommendations */}
        <div className="space-y-6">
          <AssetOverview data={data.section3_assets} />
          <AIRecommendations data={data.section5_recommendations} />
        </div>
      </div>
    </div>
  );
}
