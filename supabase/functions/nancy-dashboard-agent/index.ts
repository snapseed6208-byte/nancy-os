// ============================================
// Nancy OS — Nancy AI Dashboard Agent v1
// Phase 3.6: Read-only aggregation of personal
// profile, growth, assets, and career analysis.
//
// Actions:
//   get_dashboard_data — returns all 5 sections
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateRequest,
  getCorsHeaders,
  jsonResponse,
  getNancyPersonalProfileWithGrowth,
  getExpressionAssetSummary,
} from "../_shared/nancy-context.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const ASSET_TYPE_LABELS: Record<string, string> = {
  personal_story: "个人故事",
  experience_case: "经历案例",
  viewpoint: "个人观点",
  quality_expression: "优质表达",
  quote: "金句",
};

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req, ALLOWED_ORIGINS);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return new Response(JSON.stringify({ error: "需要登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json().catch(() => ({ action: "get_dashboard_data" }));

    if (action !== "get_dashboard_data") {
      return jsonResponse({ error: `Unknown action: ${action}` }, corsHeaders, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Fetch all data sources in parallel ──
    const [profileResult, assetSummaryResult, assetsDetailResult, skillMemoriesResult] =
      await Promise.allSettled([
        getNancyPersonalProfileWithGrowth(supabase, auth.userId),
        getExpressionAssetSummary(supabase, auth.userId),
        supabase
          .from("expression_assets")
          .select("id,title,asset_type,tags,quality_score,evidence_quote,asset_data")
          .eq("user_id", auth.userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("ai_memories")
          .select("memory_type,content,confidence")
          .eq("user_id", auth.userId)
          .eq("is_active", true)
          .in("status", ["confirmed", "probable"])
          .in("memory_type", ["skill", "insight"])
          .order("confidence", { ascending: false })
          .limit(30),
      ]);

    const profile =
      profileResult.status === "fulfilled" ? profileResult.value : null;
    const assetSummary =
      assetSummaryResult.status === "fulfilled" ? assetSummaryResult.value : null;
    const assets =
      assetsDetailResult.status === "fulfilled"
        ? (assetsDetailResult.value.data || []) as Array<Record<string, unknown>>
        : [];
    const skillMemories =
      skillMemoriesResult.status === "fulfilled"
        ? (skillMemoriesResult.value.data || []) as Array<Record<string, unknown>>
        : [];

    // ── Section 1: AI Identity Card ──
    const identity = profile?.identity
      ? {
          nickname: profile.identity.display_name || "Nancy",
          careerField: profile.identity.career_field || "",
          lifeTheme: profile.identity.life_theme || "",
          currentMilestone: profile.identity.current_milestone || "",
        }
      : null;

    const section1_identity = {
      ...identity,
      careerDirection: profile?.career_direction || "",
      strengths: profile?.strengths || [],
      weaknesses: profile?.weaknesses || [],
      communicationStyle: profile?.communication_style || "",
      hasRealData: profile?.has_real_data ?? false,
    };

    // ── Section 2: Growth Timeline ──
    const snapshot = profile?.growth_snapshot || null;
    const summary = profile?.growth_summary || null;

    const section2_growth = {
      overallDirection: snapshot?.overall_direction || "insufficient_data",
      dimensionTrends: (snapshot?.dimension_trends || []).map((d) => ({
        dimension: d.dimension,
        label: d.label || d.dimension,
        start: d.start,
        current: d.current,
        delta: d.delta,
        sampleCount: d.sample_count,
      })),
      newPatterns: snapshot?.new_patterns || [],
      importantEvents: snapshot?.important_events || [],
      recentProgress: summary?.recent_progress || "",
      currentFocus: summary?.current_focus || "",
      longTermPattern: summary?.long_term_pattern || "",
      trainingRhythm: summary?.training_rhythm || "",
      recentMilestones: summary?.recent_milestones || [],
      topImprovements: summary?.top_improvements || [],
    };

    // ── Section 3: Expression Asset Overview ──
    const byType: Record<string, number> = {};
    const typeLabels: Record<string, string> = {};
    for (const [key, label] of Object.entries(ASSET_TYPE_LABELS)) {
      byType[key] = 0;
      typeLabels[key] = label;
    }
    if (assetSummary) {
      for (const [type, count] of Object.entries(assetSummary.byType)) {
        byType[type] = (byType[type] || 0) + count;
      }
    }

    const topAssets = (assets || [])
      .slice(0, 5)
      .map((a: Record<string, unknown>) => ({
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

    const section3_assets = {
      total: assetSummary?.total || 0,
      byType,
      typeLabels,
      topAssets,
    };

    // ── Section 4: Career Asset Card ──
    const careerField = profile?.identity?.career_field || "";
    const careerDirection = profile?.career_direction || "";

    // Collect skills from all sources
    const assetTags = new Set<string>();
    for (const a of assets) {
      if (Array.isArray(a.tags)) {
        for (const t of a.tags as string[]) assetTags.add(t);
      }
    }

    const skillItems: string[] = [];
    for (const m of skillMemories) {
      const content = String(m.content || "");
      if (content.length < 80) skillItems.push(content);
      else skillItems.push(content.slice(0, 80) + "…");
    }

    // Deduplicate + limit
    const careerSkills = [...new Set([...assetTags, ...skillItems])].slice(0, 8);

    // Determine career strengths from profile
    const profileStrengths = profile?.strengths || [];
    const careerStrengths =
      profileStrengths.length > 0
        ? profileStrengths.slice(0, 5)
        : careerSkills.slice(0, 5);

    const section4_career = {
      targetDirection: careerDirection || careerField || "待探索",
      careerField,
      strengths: careerStrengths,
      skillTags: careerSkills,
      learningPatterns: profile?.learning_patterns || [],
    };

    // ── Section 5: AI Recommendation ──
    const recommendations: Array<{ area: string; icon: string; suggestion: string }> = [];

    // Expression recommendation
    if (summary?.current_focus && !summary.current_focus.includes("尚未")) {
      recommendations.push({
        area: "表达",
        icon: "Mic",
        suggestion: summary.current_focus,
      });
    } else if (section3_assets.total < 5) {
      recommendations.push({
        area: "表达",
        icon: "Mic",
        suggestion: "资产库还比较空，多做几次中文表达训练，我会帮你自动挖掘可复用的表达素材",
      });
    } else {
      recommendations.push({
        area: "表达",
        icon: "Mic",
        suggestion: "尝试一分钟表达训练的「重新表达」功能，对比两次表达可以看到明显进步",
      });
    }

    // Career recommendation
    if (careerField) {
      recommendations.push({
        area: "职业",
        icon: "Briefcase",
        suggestion: careerSkills.length > 0
          ? `你在${careerSkills.slice(0, 2).join("、")}方面有积累，建议在表达训练中多围绕${careerField}领域构建案例`
          : `建议完善个人资料中的职业方向，我会据此帮你构建职业相关的表达资产`,
      });
    } else {
      recommendations.push({
        area: "职业",
        icon: "Briefcase",
        suggestion: "在设置中填写职业方向，我会帮你挖掘职业相关的表达资产和能力标签",
      });
    }

    // Learning recommendation
    if (summary?.top_improvements && summary.top_improvements.length > 0) {
      recommendations.push({
        area: "学习",
        icon: "GraduationCap",
        suggestion: `近期进步最大的方面：${summary.top_improvements.join("、")}。继续保持训练节奏`,
      });
    } else {
      recommendations.push({
        area: "学习",
        icon: "GraduationCap",
        suggestion: "开始使用英语教练和中文表达训练，积累数据后我会生成个性化学习建议",
      });
    }

    const section5_recommendations = recommendations;

    return jsonResponse(
      {
        section1_identity,
        section2_growth,
        section3_assets,
        section4_career,
        section5_recommendations,
        _meta: {
          hasRealData: profile?.has_real_data ?? false,
          generatedAt: new Date().toISOString(),
        },
      },
      corsHeaders,
      200,
    );
  } catch (error) {
    console.error("Dashboard agent error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      corsHeaders,
      500,
    );
  }
});
