// ============================================
// Nancy OS — Resource Analyze Agent v1
// Stage 2 of 2: AI analysis of pre-extracted content. NO URL fetch.
//
// Reads raw_content from DB → single AI call → saves analysis to DB.
// If AI fails: content is preserved, status = "ai_failed", user can retry.
// Retry only re-runs analyze, never re-fetches URL.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const MAX_AI_INPUT_CHARS = 10_000;

// ── Helpers ──

function generateRequestId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `ra-${id}`;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── AI Prompt (adapted from content-parser-agent UNIFIED_PROMPT) ──

const ANALYZE_PROMPT = `你是一个内容智能分析助手。分析用户提供的文本，提取结构化信息。

## 内容类型判断
- "article" — 文章、博客、新闻、教程
- "video" — 普通视频
- "course" — 系统化课程、学习路径

## 输出格式（严格JSON，不要markdown代码块）

{
  "content_type": "article",
  "title": "内容标题（准确、简洁，如果已提供则使用提供的标题）",
  "category": "内容所属领域（中文）",
  "summary": "150-250字的中文摘要，概括核心内容和价值",
  "key_points": ["核心观点或关键知识点，3-8条"],
  "important_quotes": ["值得保留的原话、金句、关键数据，最多5条"],
  "action_items": [
    { "action": "具体可执行的行动建议", "priority": "high|medium|low" }
  ],
  "suggested_category": "从以下分类中选择最匹配的一个：学习成长、工作职业、健康健身、饮食生活、生活技巧、影视娱乐、财商投资、思维认知、人际关系、旅行体验、灵感收藏。如果无法判断返回空字符串",
  "applicable_scenarios": ["适用于哪些生活/工作场景"],
  "related_knowledge": ["关联的知识领域或主题"],
  "tags": ["关键词3-8个"]
}

## 规则
- summary 要真正概括核心内容，不要泛泛而谈
- key_points 提取最有价值的知识点
- important_quotes 优先选择核心论点、独特见解、数据事实
- 如果内容不足无法判断，相应字段返回空值而非编造
- 只输出JSON，不要任何其他文字`;

// ── Main handler ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(req), "Access-Control-Max-Age": "86400" },
    });
  }

  const requestId = generateRequestId();
  const t0 = Date.now();

  // ── Stage: payload ──
  let body: { resource_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, {
      success: false, stage: "payload", error: "请求格式错误，无法解析 JSON", requestId,
    }, 400);
  }

  const resourceId = body.resource_id || "";
  if (!resourceId) {
    return jsonResponse(req, {
      success: false, stage: "payload", error: "请提供 resource_id", requestId,
    }, 400);
  }

  console.log(`[resource-analyze] ${requestId} stage=input_receive resourceId=${resourceId}`);

  // ── Stage: auth ──
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let userId = "";
  try {
    const { data: authData } = await supabase.auth.getUser(token);
    userId = authData.user?.id || "";
  } catch {
    return jsonResponse(req, { success: false, stage: "auth", error: "认证失败", requestId }, 401);
  }

  if (!userId) {
    return jsonResponse(req, { success: false, stage: "auth", error: "请先登录", requestId }, 401);
  }

  try {
    // ── Stage: db_read ──
    console.log(`[resource-analyze] ${requestId} stage=db_read_start`);
    const { data: resource, error: readError } = await supabase
      .from("resources")
      .select("id, title, raw_content, source_title, source_url, source_platform")
      .eq("id", resourceId)
      .eq("user_id", userId)
      .single();

    if (readError || !resource) {
      console.error(`[resource-analyze] ${requestId} stage=db_read_failed error=${readError?.message || "not found"}`);
      return jsonResponse(req, {
        success: false, stage: "database", error: "资源不存在或无权访问", requestId,
      }, 404);
    }

    const rawContent = (resource.raw_content as string) || "";
    const sourceTitle = (resource.source_title as string) || (resource.title as string) || "";

    if (!rawContent || rawContent.trim().length < 10) {
      console.warn(`[resource-analyze] ${requestId} stage=no_content rawLen=${rawContent.length}`);
      return jsonResponse(req, {
        success: false,
        stage: "payload",
        error: "资源正文内容不足，无法分析。请确认文章已成功提取。",
        requestId,
      }, 400);
    }

    console.log(`[resource-analyze] ${requestId} stage=db_read_done rawLen=${rawContent.length} title="${sourceTitle.slice(0, 60)}"`);

    // ── Stage: ai_analyze ──
    const truncatedContent = rawContent.length > MAX_AI_INPUT_CHARS
      ? rawContent.slice(0, MAX_AI_INPUT_CHARS)
      : rawContent;

    const userMessage = [
      `## 内容标题`,
      sourceTitle || "(无标题)",
      ``,
      `## 正文内容`,
      truncatedContent,
    ].join("\n");

    console.log(`[resource-analyze] ${requestId} stage=ai_analyze_start promptLen=${ANALYZE_PROMPT.length} msgLen=${userMessage.length} totalChars=${ANALYZE_PROMPT.length + userMessage.length}`);

    const aiResult = await aiRuntime<Record<string, unknown>>(
      [
        { role: "system", content: ANALYZE_PROMPT },
        { role: "user", content: userMessage },
      ],
      {
        agentName: "resource-analyze",
        maxTokens: 3072,
        temperature: 0.5,
        timeout: 60_000,
      },
    );

    if (!aiResult.success) {
      console.error(`[resource-analyze] ${requestId} stage=ai_analyze_failed stage=${aiResult.stage} error=${aiResult.error}`);

      // Mark as ai_failed so user can retry
      await supabase
        .from("resources")
        .update({ parse_status: "ai_failed", updated_at: new Date().toISOString() })
        .eq("id", resourceId);

      return jsonResponse(req, {
        success: false,
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
        requestId,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    const parsed = aiResult.data;
    const tokensUsed = aiResult.usage?.totalTokens || 0;

    console.log(`[resource-analyze] ${requestId} stage=ai_analyze_done tokens=${tokensUsed} contentType=${parsed.content_type || "?"}`);

    // ── Stage: parse_response ──
    const content_type = (parsed.content_type as string) || "article";
    const aiTitle = (parsed.title as string) || "";
    const category = (parsed.category as string) || "";
    const summary = (parsed.summary as string) || "";
    const key_points = (parsed.key_points as string[]) || [];
    const important_quotes = (parsed.important_quotes as string[]) || [];
    const action_items = (parsed.action_items as Array<Record<string, unknown>>) || [];
    const suggestedCategory = (parsed.suggested_category as string) || "";
    const applicable_scenarios = (parsed.applicable_scenarios as string[]) || [];
    const related_knowledge = (parsed.related_knowledge as string[]) || [];
    const tags = (parsed.tags as string[]) || [];

    // ── Stage: database_save ──
    console.log(`[resource-analyze] ${requestId} stage=database_save_start`);

    const { error: updateError } = await supabase
      .from("resources")
      .update({
        title: aiTitle || sourceTitle,
        ai_summary: summary,
        ai_category: category,
        ai_tags: tags,
        ai_key_points: key_points,
        ai_important_quotes: important_quotes,
        ai_action_items: action_items as unknown as Record<string, unknown>[],
        ai_recommended_category: suggestedCategory ? { name: suggestedCategory, confidence: 0.8 } : null,
        ai_applicable_scenarios: applicable_scenarios,
        ai_related_knowledge: related_knowledge,
        ai_source_extracted_at: new Date().toISOString(),
        content_type,
        parse_status: "analyzed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", resourceId);

    if (updateError) {
      console.error(`[resource-analyze] ${requestId} stage=database_save_failed error=${updateError.message}`);
      return jsonResponse(req, {
        success: false,
        stage: "database",
        error: "保存分析结果失败",
        detail: updateError.message,
        requestId,
      }, 500);
    }

    console.log(`[resource-analyze] ${requestId} stage=database_save_done`);

    // ── Agent log ──
    try {
      await supabase.from("agent_logs").insert({
        user_id: userId,
        agent_type: "resource_analyze",
        action: "resource_analyze",
        input_data: {
          resource_id: resourceId,
          raw_length: rawContent.length,
          truncated_for_ai: rawContent.length > MAX_AI_INPUT_CHARS,
        },
        output_data: {
          content_type,
          title: (aiTitle || sourceTitle).slice(0, 100),
          key_points_count: key_points.length,
          action_items_count: action_items.length,
          tokens_used: tokensUsed,
        },
        model: "deepseek-chat",
        tokens_used: tokensUsed,
      });
    } catch {
      // Non-critical
    }

    const elapsedMs = Date.now() - t0;
    console.log(`[resource-analyze] ${requestId} done elapsedMs=${elapsedMs} resourceId=${resourceId}`);

    return jsonResponse(req, {
      success: true,
      data: {
        resource_id: resourceId,
        content_type,
        title: aiTitle || sourceTitle,
        category,
        summary,
        key_points,
        important_quotes,
        action_items,
        suggested_category: suggestedCategory,
        applicable_scenarios,
        related_knowledge,
        tags,
        tokens_used: tokensUsed,
      },
      requestId,
      elapsedMs,
    });

  } catch (err) {
    const elapsedMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : "Internal error";

    if (err instanceof DOMException && err.name === "AbortError") {
      console.error(`[resource-analyze] ${requestId} timeout elapsedMs=${elapsedMs}`);
      return jsonResponse(req, {
        success: false, stage: "internal", error: "请求处理超时", detail: String(message), requestId,
      }, 504);
    }

    console.error(`[resource-analyze] ${requestId} internal_error elapsedMs=${elapsedMs} error=${message}`);
    return jsonResponse(req, {
      success: false, stage: "internal", error: message, requestId,
    }, 500);
  }
});
