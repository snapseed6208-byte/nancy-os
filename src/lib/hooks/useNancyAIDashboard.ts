// ============================================
// Nancy OS — useNancyAIDashboard (v2 — graceful degradation)
//
// Architecture: "Database data first / AI enhancement second"
// - Direct DB queries for asset data (always available)
// - Edge function for AI-processed sections (identity, growth, career, recommendations)
// - Career/profile data has NO direct DB fallback — it's aggregated at runtime
//   by getNancyPersonalProfileWithGrowth() from multiple source tables
// - Each section independently handles loading/error/empty states
// - No single-point-of-failure: asset section renders even when AI agent is down
// ============================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ── Section 1: AI Identity Card ──

export interface IdentityCard {
  nickname: string;
  careerField: string;
  lifeTheme: string;
  currentMilestone: string;
  careerDirection: string;
  strengths: string[];
  weaknesses: string[];
  communicationStyle: string;
  hasRealData: boolean;
}

// ── Section 2: Growth Timeline ──

export interface DimensionTrend {
  dimension: string;
  label: string;
  start: number;
  current: number;
  delta: number;
  sampleCount: number;
}

export interface GrowthTimeline {
  overallDirection: "improving" | "stable" | "exploring" | "insufficient_data";
  dimensionTrends: DimensionTrend[];
  newPatterns: string[];
  importantEvents: string[];
  recentProgress: string;
  currentFocus: string;
  longTermPattern: string;
  trainingRhythm: string;
  recentMilestones: string[];
  topImprovements: string[];
}

// ── Section 3: Expression Asset Overview ──

export interface TopAsset {
  id: string;
  title: string;
  assetType: string;
  tags: string[];
  evidenceQuote: string;
  qualityScore: Record<string, unknown> | null;
}

export interface AssetOverview {
  total: number;
  byType: Record<string, number>;
  typeLabels: Record<string, string>;
  topAssets: TopAsset[];
}

// ── Section 4: Career Asset Card ──

export interface CareerCard {
  targetDirection: string;
  careerField: string;
  strengths: string[];
  skillTags: string[];
  learningPatterns: string[];
}

// ── Section 5: AI Recommendation ──

export interface AIRecommendation {
  area: string;
  icon: string;
  suggestion: string;
}

// ── Aggregated Dashboard Data (from edge function) ──

export interface NancyAIDashboardData {
  section1_identity: IdentityCard;
  section2_growth: GrowthTimeline;
  section3_assets: AssetOverview;
  section4_career: CareerCard;
  section5_recommendations: AIRecommendation[];
  _meta: {
    hasRealData: boolean;
    generatedAt: string;
  };
}

export interface DashboardSectionState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export interface DashboardState {
  // AI-processed sections (edge function)
  identity: DashboardSectionState<IdentityCard>;
  growth: DashboardSectionState<GrowthTimeline>;
  recommendations: DashboardSectionState<AIRecommendation[]>;
  // DB-driven sections (direct queries, always available)
  assets: DashboardSectionState<AssetOverview>;
  career: DashboardSectionState<CareerCard>;
  // Meta
  hasRealData: boolean;
  generatedAt: string | null;
  isAgentDown: boolean;
}

// ═══════════════════════════════════════
// Asset type labels
// ═══════════════════════════════════════

const ASSET_TYPE_LABELS: Record<string, string> = {
  personal_story: "个人故事",
  experience_case: "经历案例",
  viewpoint: "个人观点",
  quality_expression: "优质表达",
  quote: "金句",
};

// ═══════════════════════════════════════
// Direct DB: Assets (Section 3)
// ═══════════════════════════════════════

async function fetchAssetsDirect(): Promise<AssetOverview> {
  const { data: assets, error } = await supabase
    .from("expression_assets")
    .select("id,title,asset_type,tags,quality_score,evidence_quote")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  const byType: Record<string, number> = {};
  for (const key of Object.keys(ASSET_TYPE_LABELS)) {
    byType[key] = 0;
  }

  const items = (assets || []) as Array<Record<string, unknown>>;
  for (const a of items) {
    const t = a.asset_type as string;
    byType[t] = (byType[t] || 0) + 1;
  }

  const topAssets: TopAsset[] = items.slice(0, 5).map((a) => ({
    id: a.id as string,
    title: a.title as string,
    assetType: a.asset_type as string,
    tags: (a.tags as string[]) || [],
    evidenceQuote: (a.evidence_quote as string) || "",
    qualityScore:
      a.quality_score && typeof a.quality_score === "object"
        ? (a.quality_score as Record<string, unknown>)
        : null,
  }));

  return {
    total: items.length,
    byType,
    typeLabels: ASSET_TYPE_LABELS,
    topAssets,
  };
}

// ═══════════════════════════════════════
// Career (Section 4)
//
// Career data is ONLY available via nancy-dashboard-agent.
// There is no nancy_personal_profile table — profile data
// is aggregated at runtime by getNancyPersonalProfileWithGrowth()
// from profiles, expression_assets, ai_memories, and growth data.
// No direct DB fallback query exists for this section.
// ═══════════════════════════════════════

// ═══════════════════════════════════════
// Edge function: AI sections (1, 2, 5)
// ═══════════════════════════════════════

const DASHBOARD_AGENT = "nancy-dashboard-agent";

async function fetchAgentData(): Promise<NancyAIDashboardData> {
  const { data, error } = await supabase.functions.invoke(DASHBOARD_AGENT, {
    body: { action: "get_dashboard_data" },
  });

  if (error) {
    const ctx = (error as unknown as Record<string, unknown>).context;
    throw new Error(
      (ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).message : null) as string ||
        error.message ||
        "仪表盘数据加载失败",
    );
  }

  return data as NancyAIDashboardData;
}

// ═══════════════════════════════════════
// Composed hook
// ═══════════════════════════════════════

export function useNancyAIDashboard(): DashboardState {
  // AI-processed sections (edge function)
  const agentQuery = useQuery({
    queryKey: ["nancy-ai-dashboard-agent"],
    queryFn: fetchAgentData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Direct DB queries — always run independently of agent status
  const assetsQuery = useQuery({
    queryKey: ["nancy-dashboard-assets-direct"],
    queryFn: fetchAssetsDirect,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const agentData = agentQuery.isSuccess ? agentQuery.data : null;
  const isAgentDown = agentQuery.isError;

  return {
    // AI sections: from edge function, null if unavailable
    identity: {
      data: agentData?.section1_identity ?? null,
      isLoading: agentQuery.isLoading,
      error: agentQuery.isError ? (agentQuery.error as Error)?.message || "AI 分析暂不可用" : null,
    },
    growth: {
      data: agentData?.section2_growth ?? null,
      isLoading: agentQuery.isLoading,
      error: agentQuery.isError ? (agentQuery.error as Error)?.message || "AI 分析暂不可用" : null,
    },
    recommendations: {
      data: agentData?.section5_recommendations ?? null,
      isLoading: agentQuery.isLoading,
      error: agentQuery.isError ? (agentQuery.error as Error)?.message || "AI 分析暂不可用" : null,
    },
    // DB sections: prefer agent data, fall back to direct queries
    assets: {
      data: agentData?.section3_assets ?? (assetsQuery.isSuccess ? assetsQuery.data : null),
      isLoading: assetsQuery.isLoading && !agentData,
      error: assetsQuery.isError && !agentData
        ? (assetsQuery.error as Error)?.message || "资产数据加载失败"
        : null,
    },
    career: {
      data: agentData?.section4_career ?? null,
      isLoading: agentQuery.isLoading,
      error: agentQuery.isError ? (agentQuery.error as Error)?.message || "职业数据加载失败" : null,
    },
    hasRealData: agentData?._meta.hasRealData ?? false,
    generatedAt: agentData?._meta.generatedAt ?? null,
    isAgentDown,
  };
}
