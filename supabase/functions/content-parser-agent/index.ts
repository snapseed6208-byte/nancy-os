// ============================================
// Nancy OS — Content Parser Agent v3
// v3: Unified content intelligence — auto-classifies + extracts
// Accepts URL or text, routes to resources/workout_videos/recipes
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
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

const UNIFIED_PROMPT = `你是一个内容智能分析助手。用户给你一个链接或一段文本，请自动分析并提取结构化信息。

## 第一步：判断内容类型（content_type）

根据内容判断类型：
- "article" — 文章、博客、新闻、教程
- "video" — 普通视频（非健身、非食谱）
- "workout" — 健身/运动/训练视频或内容
- "recipe" — 食谱/烹饪视频或内容
- "course" — 系统化课程、学习路径

## 第二步：提取结构化信息

返回严格 JSON 格式（不要markdown代码块）:

{
  "content_type": "article|video|workout|recipe|course",
  "title": "内容标题",
  "category": "分类标签（中文，如：个人成长、技术、英语、健康、职业）",
  "summary": "150-250字的中文摘要，概括核心内容和价值",
  "key_points": ["关键知识点或发现1", "关键知识点或发现2", ...],
  "action_items": [
    { "action": "具体可执行的行动建议", "priority": "high|medium|low" }
  ],
  "tags": ["标签1", "标签2", "标签3"],
  "metadata": {}
}

## 类型特定规则

### 如果是 workout 类型，metadata 必须包含:
{
  "difficulty": "初级|中级|高级",
  "estimated_duration": 数字（分钟）,
  "target_muscles": ["训练部位"]
}

### 如果是 recipe 类型，metadata 必须包含:
{
  "goal": "减脂|增肌|保持",
  "ingredients": "食材清单，逗号分隔",
  "calories_per_serving": 数字,
  "protein_grams": 数字,
  "meal_time": ["breakfast|lunch|dinner"]
}

### 如果是 course 类型，metadata 包含:
{
  "estimated_hours": 数字,
  "difficulty_level": "beginner|intermediate|advanced",
  "prerequisites": ["前置知识"]
}

## 规则
- key_points: 3-8条，每条是一句话的关键发现
- action_items: 1-3条，具体可执行
- summary: 必须是中文，150-250字
- 如果无法从链接/文本推断内容，基于上下文合理推断
- 如果输入为纯文本而非URL，优先分析文本内容本身`;

function parseAIJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim().replace(/^﻿/, "");

  try { return JSON.parse(cleaned); } catch { /* continue */ }

  cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

function detectPlatform(input: string): string {
  if (input.includes("bilibili.com") || input.includes("b23.tv")) return "bilibili";
  if (input.includes("douyin.com") || input.includes("v.douyin.com")) return "douyin";
  if (input.includes("xiaohongshu.com") || input.includes("xhslink.com")) return "xiaohongshu";
  if (input.includes("youtube.com") || input.includes("youtu.be")) return "youtube";
  return "web";
}

function isUrl(input: string): boolean {
  return /^https?:\/\//.test(input.trim());
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── Parse input ──
    const body = await req.json() as {
      url?: string;
      text?: string;
      preferred_module?: string;
    };

    const input = body.url || body.text || "";
    if (!input || input.trim().length === 0) {
      return new Response(JSON.stringify({ error: "请提供 URL 链接或文本内容" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const inputIsUrl = body.url ? true : isUrl(input);
    const platform = inputIsUrl ? detectPlatform(input) : "text";
    const preferredModule = body.preferred_module || "";

    // ── Build prompt ──
    let userMessage = "";
    if (inputIsUrl) {
      userMessage = `输入类型: URL链接\nURL: ${input}\n平台: ${platform}`;
    } else {
      userMessage = `输入类型: 文本内容\n文本: ${input.slice(0, 3000)}`;
    }
    if (preferredModule) {
      userMessage += `\n用户偏好模块: ${preferredModule}`;
    }

    // ── Call DeepSeek ──
    const aiResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: UNIFIED_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      return new Response(JSON.stringify({ error: `AI 服务异常 (${aiResponse.status})` }), {
        status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await aiResponse.json();
    const raw = result.choices?.[0]?.message?.content || "{}";
    const tokensUsed: number = result.usage?.total_tokens || 0;

    let parsed: Record<string, unknown>;
    try {
      parsed = parseAIJson(raw);
    } catch {
      return new Response(JSON.stringify({
        error: "parse_error",
        raw: raw.slice(0, 500),
        message: "AI 返回格式异常，请重试",
      }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const content_type = (parsed.content_type as string) || "article";
    const title = (parsed.title as string) || "";
    const category = (parsed.category as string) || "";
    const summary = (parsed.summary as string) || "";
    const key_points = (parsed.key_points as string[]) || [];
    const action_items = (parsed.action_items as Array<Record<string, unknown>>) || [];
    const tags = (parsed.tags as string[]) || [];
    const metadata = (parsed.metadata as Record<string, unknown>) || {};

    // ── Route to target table ──
    let targetTable = "resources";
    let recordId = "";

    if (content_type === "workout") {
      targetTable = "workout_videos";
      const { data: inserted } = await supabase
        .from("workout_videos")
        .insert({
          user_id: user.id,
          title: title,
          category: category,
          difficulty: (metadata.difficulty as string) || "初级",
          estimated_duration: (metadata.estimated_duration as number) || null,
          target_muscles: (metadata.target_muscles as string[]) || [],
          platform: inputIsUrl ? platform : null,
          url: inputIsUrl ? input : null,
        })
        .select("id")
        .single();

      if (inserted) recordId = inserted.id as string;
    } else if (content_type === "recipe") {
      targetTable = "recipes";
      const mealTimeRaw = metadata.meal_time as string[] || [];
      const { data: inserted } = await supabase
        .from("recipes")
        .insert({
          user_id: user.id,
          name: title,
          category: category,
          goal: (metadata.goal as string) || "减脂",
          ingredients: (metadata.ingredients as string) || "",
          calories_per_serving: (metadata.calories_per_serving as number) || null,
          protein_grams: (metadata.protein_grams as number) || null,
          meal_time: mealTimeRaw,
          url: inputIsUrl ? input : null,
        })
        .select("id")
        .single();

      if (inserted) recordId = inserted.id as string;
    } else {
      targetTable = "resources";
      const { data: inserted } = await supabase
        .from("resources")
        .insert({
          user_id: user.id,
          title: title,
          url: inputIsUrl ? input : null,
          resource_type: content_type,
          module: preferredModule || "general",
          tags: tags,
          source_url: body.url || null,
          content_type: content_type,
          parse_status: "parsed",
          ai_summary: summary,
          ai_category: category,
          ai_tags: tags,
          ai_key_points: key_points,
          ai_action_items: action_items,
          notes: summary,
        })
        .select("id")
        .single();

      if (inserted) recordId = inserted.id as string;
    }

    // ── Write agent log ──
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "content_parser",
      action: "content_parse",
      input_data: {
        input_type: inputIsUrl ? "url" : "text",
        input_length: input.length,
        platform: inputIsUrl ? platform : "text",
        preferred_module: preferredModule || null,
      },
      output_data: {
        content_type,
        title: title.slice(0, 100),
        key_points_count: key_points.length,
        action_items_count: action_items.length,
        target_table: targetTable,
        record_id: recordId,
        tokens_used: tokensUsed,
      },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });

    // ── Return ──
    return new Response(JSON.stringify({
      content_type,
      title,
      category,
      summary,
      key_points,
      action_items,
      tags,
      metadata,
      target_table: targetTable,
      record_id: recordId,
      tokens_used: tokensUsed,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Content parser error:", err);
    return new Response(JSON.stringify({
      error: (err as Error).message || "服务器内部错误",
    }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
