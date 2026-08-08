// ============================================
// Nancy OS — English Coach Edge Function v3
// v3: JWT auth required for all calls.
// Always injects user context (preferences + history).
// Removed anonymous proxy path for security.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import { authenticateRequest, getConfirmedMemories } from "../_shared/nancy-context.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// ── Helpers ──

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Build learning context from memories + history ──

function buildLearningContext(
  memories: Array<Record<string, unknown>>,
  reviewStats: { totalReviewed: number; correctRate: number; problemAreas: string[] },
  speakingStats: { totalSessions: number; avgDuration: number; recentScenarios: string[] },
): string {
  const lines: string[] = [];

  if (memories.length > 0) {
    lines.push("## 用户学习偏好（来自长期记忆）");
    const learningMemories = memories.filter((m) =>
      ["preference", "habit", "insight", "skill"].includes(m.memory_type as string),
    );
    for (const m of learningMemories.slice(0, 10)) {
      lines.push(`- [${m.memory_type}] ${m.content}`);
    }

    const personalityMemories = memories.filter((m) => m.memory_type === "personality");
    if (personalityMemories.length > 0) {
      lines.push("\n## 用户性格特点");
      for (const m of personalityMemories.slice(0, 3)) {
        lines.push(`- ${m.content}`);
      }
      lines.push("请根据性格特点调整鼓励方式和反馈语气。");
    }
  }

  if (reviewStats.totalReviewed > 0) {
    lines.push("\n## 用户学习数据");
    lines.push(`- 累计复习次数: ${reviewStats.totalReviewed}`);
    lines.push(`- 正确率: ${Math.round(reviewStats.correctRate * 100)}%`);
    if (reviewStats.problemAreas.length > 0) {
      lines.push(`- 薄弱领域: ${reviewStats.problemAreas.join("、")}`);
      lines.push("请在反馈中优先关注这些薄弱领域。");
    }
  }

  if (speakingStats.totalSessions > 0) {
    lines.push(`- 口语练习次数: ${speakingStats.totalSessions}`);
    lines.push(`- 平均练习时长: ${Math.round(speakingStats.avgDuration / 60)}分钟`);
    if (speakingStats.recentScenarios.length > 0) {
      lines.push(`- 最近练习场景: ${speakingStats.recentScenarios.join("、")}`);
    }
  }

  if (lines.length === 0) return "";

  lines.unshift("## 用户学习上下文（供个性化教练参考）");
  return lines.join("\n");
}

// ── Main ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const messages = body.messages as Array<{ role: string; content: string }>;
    const model = (body.model as string) || "deepseek-chat";
    const maxTokens = (body.maxTokens as number) || 2048;
    const temperature = (body.temperature as number) ?? 0.7;

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse(req,{ error: "messages array is required" }, 400);
    }

    // ── Auth (nancy-context) ──
    const auth = await authenticateRequest(req);
    if (!auth) return jsonResponse(req, { error: "需要登录" }, 401);
    const { supabase, userId } = auth;

    // Fetch learning context in parallel
    const [
      confirmedMemories,
      { data: expressionReviews },
      { data: speakingSessions },
    ] = await Promise.all([
      getConfirmedMemories(supabase, userId, {
        limit: 15,
        memoryTypes: ["preference", "personality", "habit", "insight", "skill"],
      }),
      supabase.from("expression_reviews")
        .select("id,result")
        .eq("user_id", userId)
        .order("reviewed_at", { ascending: false })
        .limit(50),
      supabase.from("speaking_sessions")
        .select("id,scenario,duration_seconds")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Compute review stats
    const reviews = (expressionReviews || []) as Array<{ result: string }>;
    const totalReviewed = reviews.length;
    const correctCount = reviews.filter((r) => r.result === "correct").length;
    const correctRate = totalReviewed > 0 ? correctCount / totalReviewed : 0;
    const incorrectResults = reviews.filter((r) => r.result === "incorrect" || r.result === "partial");

    const problemAreas: string[] = [];
    if (incorrectResults.length > totalReviewed * 0.3) problemAreas.push("词汇准确性");
    if (incorrectResults.length > totalReviewed * 0.5) problemAreas.push("语法结构");

    // Compute speaking stats
    const sessions = (speakingSessions || []) as Array<{ scenario: string; duration_seconds: number }>;
    const totalSessions = sessions.length;
    const avgDuration = totalSessions > 0
      ? sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / totalSessions
      : 0;
    const recentScenarios = [...new Set(sessions.slice(0, 5).map((s) => s.scenario))];

    const learningContext = buildLearningContext(
      confirmedMemories,
      { totalReviewed, correctRate, problemAreas },
      { totalSessions, avgDuration, recentScenarios },
    );

    // ── Build messages with context injection ──
    const finalMessages = [...messages];
    if (learningContext) {
      const hasSystem = finalMessages.length > 0 && finalMessages[0].role === "system";
      if (hasSystem) {
        finalMessages[0] = {
          role: "system",
          content: finalMessages[0].content + "\n\n" + learningContext,
        };
      } else {
        finalMessages.unshift({ role: "system", content: learningContext });
      }
    }

    // ── AI Runtime: chat agent (raw text, no JSON parse) ──
    const aiResult = await aiRuntime<string>(finalMessages as Array<{ role: "system" | "user" | "assistant"; content: string }>, {
      agentName: "english-coach",
      maxTokens,
      temperature,
      parseJson: false,
      dynamicTokens: false,
    });
    if (!aiResult.success) {
      return jsonResponse(req, { stage: aiResult.stage, error: aiResult.error, detail: aiResult.detail }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    const tokensUsed: number = aiResult.usage?.totalTokens || 0;

    // ── Log ──
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "coaching_session",
      input_data: {
        message_count: messages.length,
        memory_count: (confirmedMemories || []).length,
        review_count: totalReviewed,
        speaking_count: totalSessions,
        context_injected: true,
      },
      output_data: { model, tokens_used: tokensUsed },
      model,
      tokens_used: tokensUsed,
    });

    return jsonResponse(req,{
      content: aiResult.data || "",
      model: model,
      tokensUsed: aiResult.usage?.totalTokens,
      context_injected: true,
      context_sources: learningContext ? {
        memories_count: (confirmedMemories || []).length,
        reviews_count: totalReviewed,
      } : null,
    });
  } catch (err) {
    return jsonResponse(req,{
      error: err instanceof Error ? err.message : "服务器内部错误",
    }, 500);
  }
});
