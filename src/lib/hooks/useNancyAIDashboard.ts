// ============================================
// Nancy OS — useNancyAIDashboard
// Phase 3.6: Fetch aggregated dashboard data
// from nancy-dashboard-agent Edge Function.
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

// ── Aggregated Dashboard Data ──

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

// ── Hook ──

const DASHBOARD_AGENT = "nancy-dashboard-agent";

async function fetchDashboardData(): Promise<NancyAIDashboardData> {
  const { data, error } = await supabase.functions.invoke(DASHBOARD_AGENT, {
    body: { action: "get_dashboard_data" },
  });

  if (error) {
    // Extract meaningful message from FunctionsHttpError
    if (error instanceof Error) {
      const ctx = (error as unknown as Record<string, unknown>).context;
      throw new Error(
        (ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>).message : null) as string ||
          error.message ||
          "仪表盘数据加载失败",
      );
    }
    throw error;
  }

  return data as NancyAIDashboardData;
}

export function useNancyAIDashboard() {
  return useQuery({
    queryKey: ["nancy-ai-dashboard"],
    queryFn: fetchDashboardData,
    staleTime: 5 * 60 * 1000, // 5 min — profile data changes slowly
    refetchOnWindowFocus: false,
  });
}
