// ============================================
// Nancy OS — English Coach Edge Function v3
// v3: JWT auth required for all calls.
// Always injects user context (preferences + history).
// Removed anonymous proxy path for security.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import { authenticateRequest, getConfirmedMemories, getExpressionAssets, matchExpressionAssets, trackAssetUsage, getNancyPersonalProfileWithGrowth, buildNancyPersonalProfileContextWithGrowth } from "../_shared/nancy-context.ts";

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

// ── Summarize Daily Review ──

async function handleSummarizeDailyReview(
  req: Request,
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const dailySet = body.dailySet as Array<Record<string, unknown>> | undefined;
  const modeCompletion = body.mode_completion as Record<string, unknown> | undefined;
  const date = (body.date as string) || new Date().toISOString().split("T")[0];

  if (!dailySet || !Array.isArray(dailySet) || dailySet.length === 0) {
    return jsonResponse(req, { error: "dailySet array is required for summarization" }, 400);
  }

  // Build a compact summary prompt with enriched per-expression data
  const expressions = dailySet.map((item) => ({
    english: item.english || "unknown",
    chinese: item.chinese || "",
    recall_score: item.recall?.initial_rating ?? null,
    recall_status: item.recall?.final_status ?? "pending",
    recall_reinforcement: item.recall?.reinforcement_count ?? 0,
    cloze_done: item.cloze?.completed ?? false,
    cloze_correct: item.cloze?.correct ?? false,
    cloze_user_answer: item.cloze?.user_answer ?? null,
    sentence_done: item.sentence?.completed ?? false,
    sentence_text: item.sentence?.user_sentence ?? null,
    sentence_feedback: item.sentence?.ai_feedback ?? null,
  }));

  // V3.5: Pre-compute expression categories to help AI
  const activatedExpressions = expressions.filter(
    (e) => e.recall_score !== null && e.cloze_correct && e.sentence_done,
  );
  const recallOnlyExpressions = expressions.filter(
    (e) => e.recall_score !== null && !e.cloze_done && !e.sentence_done,
  );
  const contextWeakExpressions = expressions.filter(
    (e) => e.cloze_done && !e.cloze_correct,
  );
  const productionWeakExpressions = expressions.filter(
    (e) => e.sentence_done && e.recall_score !== null && e.recall_score < 3,
  );

  const summaryPrompt = `You are an English learning coach. Analyze today's review session and write a concise summary in Chinese.

## Today's Date: ${date}

## Mode Completion
- Active Recall: ${modeCompletion?.recall?.completed_count ?? 0}/${modeCompletion?.recall?.total ?? 0}
- Cloze: ${modeCompletion?.cloze?.completed_count ?? 0}/${modeCompletion?.cloze?.total ?? 0} (correct: ${modeCompletion?.cloze?.correct_count ?? 0})
- Sentence: ${modeCompletion?.sentence?.completed_count ?? 0}/${modeCompletion?.sentence?.total ?? 0}

## Expressions Reviewed
${JSON.stringify(expressions, null, 2)}

## Pre-computed Categories (V3.5)
- activated_expressions (completed all 3 modes correctly): ${JSON.stringify(activatedExpressions.map((e) => e.english))}
- recall_only (only recall done, no cloze/sentence yet): ${JSON.stringify(recallOnlyExpressions.map((e) => e.english))}
- context_weak (cloze done but incorrect): ${JSON.stringify(contextWeakExpressions.map((e) => e.english))}
- production_weak (sentence done but recall score < 3): ${JSON.stringify(productionWeakExpressions.map((e) => e.english))}

## Instructions
Return a JSON object with these fields (all in Chinese):
{
  "overview": "总体评价，2-3句话，语气鼓励",
  "completion_summary": "完成情况统计的一句话总结",
  "recall_analysis": { "summary": "主动回忆分析", "difficult_expressions": ["困难的表达1", ...] } | null,
  "cloze_analysis": { "summary": "填空分析", "common_errors": ["常见错误1", ...] } | null,
  "sentence_analysis": { "summary": "造句分析", "good_outputs": ["好的造句1", ...], "needs_improvement": ["需要改进的1", ...] } | null,
  "activated_expressions": ["已全面激活的表达", ...] (expressions mastered across all 3 modes),
  "recall_only_expressions": ["仅完成回忆的表达", ...] (expressions that need cloze/sentence practice),
  "context_weak_expressions": ["语境薄弱的表达", ...] (cloze was incorrect — poor contextual understanding),
  "production_weak_expressions": ["输出薄弱的表达", ...] (recall score < 3 — weak active production),
  "strongest_expressions": ["掌握最好的表达", ...] (3-5个),
  "weakest_expressions": ["需要加强的表达", ...] (3-5个),
  "error_patterns": [{ "pattern": "错误模式描述", "expressions": ["相关表达"], "suggestion": "改进建议" }] (1-3 common error patterns),
  "tomorrow_focus": "明天学习重点建议，1-2句话"
}

Use the pre-computed categories as a reference, but apply your own judgment. Only include analysis sections that have relevant data. Keep everything concise.`;

  try {
    const aiResult = await aiRuntime<Record<string, unknown>>(
      [{ role: "user", content: summaryPrompt }],
      {
        agentName: "english-coach-summary",
        maxTokens: 2048,
        temperature: 0.5,
        parseJson: true,
        dynamicTokens: false,
      },
    );

    if (!aiResult.success) {
      return jsonResponse(req, {
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    // Log the summary generation
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "daily_summary",
      input_data: {
        expression_count: dailySet.length,
        date,
      },
      output_data: { summary: aiResult.data },
      model: "deepseek-chat",
      tokens_used: aiResult.usage?.totalTokens || 0,
    });

    return jsonResponse(req, {
      success: true,
      data: aiResult.data,
    });
  } catch (err) {
    return jsonResponse(req, {
      error: err instanceof Error ? err.message : "Summary generation failed",
    }, 500);
  }
}

// ── Action: generate_cloze_batch ──

async function handleGenerateClozeBatch(
  req: Request,
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const expressions = body.expressions as Array<{ english: string; chinese: string; context?: string }> | undefined;

  if (!expressions || !Array.isArray(expressions) || expressions.length === 0) {
    return jsonResponse(req, { error: "expressions array is required" }, 400);
  }

  const batchPrompt = `Generate one cloze sentence for each expression below.
For each expression, create a natural English sentence where the target expression is replaced with "_____".
The blank should be where the expression naturally appears in the sentence.

Return a JSON object where keys are the exact English expressions and values are the cloze sentences:
{
  "expression1": "Complete sentence with _____ replacing the expression.",
  ...
}

Rules:
- Each sentence MUST contain exactly one "_____" where the expression goes
- The sentence must be a natural, realistic English sentence
- Do NOT include the expression itself in the sentence (it's replaced by _____)
- If context is provided, use it to make the sentence more relevant

Expressions:`;

  const exprList = expressions
    .map((e) => {
      const ctx = e.context ? ` (context: ${e.context})` : "";
      return `- "${e.english}" (${e.chinese})${ctx}`;
    })
    .join("\n");

  const prompt = `${batchPrompt}\n${exprList}`;

  try {
    const aiResult = await aiRuntime<Record<string, string>>(
      [{ role: "user", content: prompt }],
      {
        agentName: "english-coach-cloze-batch",
        maxTokens: Math.min(expressions.length * 128, 2048),
        temperature: 0.5,
        parseJson: true,
        dynamicTokens: false,
      },
    );

    if (!aiResult.success) {
      return jsonResponse(req, {
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    // Validate results: each must contain _____
    const validated: Record<string, string> = {};
    if (aiResult.data) {
      for (const [key, value] of Object.entries(aiResult.data)) {
        if (typeof value === "string" && value.includes("_____")) {
          validated[key] = value;
        }
      }
    }

    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "generate_cloze_batch",
      input_data: { expression_count: expressions.length },
      output_data: { generated_count: Object.keys(validated).length },
      model: "deepseek-chat",
      tokens_used: aiResult.usage?.totalTokens || 0,
    });

    return jsonResponse(req, { success: true, data: validated });
  } catch (err) {
    return jsonResponse(req, {
      error: err instanceof Error ? err.message : "Cloze batch generation failed",
    }, 500);
  }
}

// ── Action: evaluate_personal_sentence (V3.6) ──

async function handleEvaluatePersonalSentence(
  req: Request,
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Response> {
  const expression = body.expression as string | undefined;
  const userSentence = body.user_sentence as string | undefined;
  const safeContext = body.safe_context as string | undefined;

  if (!expression || !userSentence) {
    return jsonResponse(req, { error: "expression and user_sentence are required" }, 400);
  }

  const evalPrompt = `You are an English grammar and naturalness evaluator.

Evaluate whether the user's sentence correctly and naturally uses the target expression.

Target expression: "${expression}"
${safeContext ? `Context: ${safeContext}` : ""}

User's sentence: "${userSentence}"

IMPORTANT RULES:
- Focus on whether THE TARGET EXPRESSION is used correctly and naturally, not on the overall grammar of the sentence
- Be lenient about minor grammar errors in parts of the sentence that are NOT the target expression
- "Naturalness" means: does this usage sound like something a native speaker would say?
- If the expression is used correctly but the rest of the sentence has issues, still mark expression_used_correctly as true

Return ONLY a JSON object (no markdown, no explanation):
{
  "grammar_correct": true/false,
  "naturalness": "natural" | "slightly_unnatural" | "awkward" | "incorrect",
  "corrections": [
    { "original": "problematic part of sentence", "corrected": "corrected version", "explanation": "brief explanation in Chinese" }
  ],
  "overall_feedback": "1-2 sentences feedback in Chinese, encouraging tone",
  "expression_used_correctly": true/false,
  "example_usage": "optional: a natural example sentence using this expression correctly in context"
}`;

  try {
    const aiResult = await aiRuntime<Record<string, unknown>>(
      [{ role: "user", content: evalPrompt }],
      {
        agentName: "english-coach-sentence-eval",
        maxTokens: 1024,
        temperature: 0.3,
        parseJson: true,
        dynamicTokens: false,
      },
    );

    if (!aiResult.success) {
      return jsonResponse(req, {
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    const data = aiResult.data || {};

    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "evaluate_personal_sentence",
      input_data: { expression, user_sentence: userSentence },
      output_data: { naturalness: data.naturalness, expression_used_correctly: data.expression_used_correctly },
      model: "deepseek-chat",
      tokens_used: aiResult.usage?.totalTokens || 0,
    });

    return jsonResponse(req, { success: true, data });
  } catch (err) {
    return jsonResponse(req, {
      error: err instanceof Error ? err.message : "Sentence evaluation failed",
    }, 500);
  }
}

// ── Main ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const action = body.action as string | undefined;

    // ── Auth ──
    const auth = await authenticateRequest(req);
    if (!auth) return jsonResponse(req, { error: "需要登录" }, 401);
    const { supabase, userId } = auth;

    // ── Action: summarize_daily_review (no messages required) ──
    if (action === "summarize_daily_review") {
      return handleSummarizeDailyReview(req, body, supabase, userId);
    }

    // ── Action: generate_cloze_batch (V3.6) ──
    if (action === "generate_cloze_batch") {
      return handleGenerateClozeBatch(req, body, supabase, userId);
    }

    // ── Action: evaluate_personal_sentence (V3.6) ──
    if (action === "evaluate_personal_sentence") {
      return handleEvaluatePersonalSentence(req, body, supabase, userId);
    }

    // ── Normal coaching: require messages ──
    const messages = body.messages as Array<{ role: string; content: string }>;
    const model = (body.model as string) || "deepseek-chat";
    const maxTokens = (body.maxTokens as number) || 2048;
    const temperature = (body.temperature as number) ?? 0.7;

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse(req, { error: "messages array is required" }, 400);
    }

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

    // ── Nancy personal profile (non-fatal) ──
    let nancyProfileContext = "";
    try {
      const nancyProfile = await getNancyPersonalProfileWithGrowth(supabase, userId);
      nancyProfileContext = buildNancyPersonalProfileContextWithGrowth(nancyProfile);
    } catch (profileErr) {
      console.error("[english-coach] Nancy profile error (non-fatal):", (profileErr as Error).message);
    }

    // ── Personal story context (non-fatal) ──
    // Detect if conversation involves interview / storytelling / self-intro
    // where the user's real expression assets provide better context than AI fiction.
    const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content || "";
    const isStoryScenario = /interview|challenge|tell me about|experience|自我介绍|经历|面试|speak about|describe a time/i.test(lastUserMsg)
      || recentScenarios.some((s) => /interview|business|storytelling/i.test(s));

    let personalStoryContext = "";
    if (isStoryScenario) {
      try {
        const assets = await getExpressionAssets(supabase, userId, {
          limit: 15,
          types: ["personal_story", "experience_case"],
        });
        const matches = matchExpressionAssets(assets, {
          question: lastUserMsg.slice(0, 200),
          scenario: recentScenarios[0] || "",
        });

        if (matches.length > 0) {
          const lines = ["\n## 用户真实经历（禁止编造，优先使用以下真实经历）"];
          for (const m of matches.slice(0, 3)) {
            lines.push(`- **${m.title}**：${m.usage_suggestion}（匹配: ${m.match_score}%）`);
          }
          lines.push("→ 在给出示例回答时，优先基于以上真实经历构建。不要编造用户没有的经历。");
          personalStoryContext = lines.join("\n");
          trackAssetUsage(supabase, userId, "english_coach", matches);
        } else {
          personalStoryContext = "\n## 注意：用户尚未保存相关真实经历。请基于通用场景给出建议，同时鼓励用户分享自己的真实经历以获得更个性化的指导。不要编造用户的个人经历。";
        }
      } catch (assetErr) {
        console.error("[english-coach] asset context error (non-fatal):", (assetErr as Error).message);
      }
    }

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

    // Inject personal story context as a high-priority system message
    if (personalStoryContext) {
      finalMessages.unshift({ role: "system", content: personalStoryContext });
    }

    // Inject Nancy personal profile as the highest-priority system message
    if (nancyProfileContext) {
      finalMessages.unshift({ role: "system", content: nancyProfileContext });
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
      personal_story_injected: !!personalStoryContext,
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
