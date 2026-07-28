// ============================================
// Nancy OS — Task Breakdown Agent Edge Function v2
// AI breaks down goals into actionable tasks
// v2: Injects confirmed memory context for personalization
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM_PROMPT = `你是一个个人效率 AI 助手（Nancy OS Task Breakdown Agent）。你的用户是一位正在自我提升的年轻人。

用户会给你一个目标（标题 + 描述 + 层级）以及用户的长期偏好记忆（confirmed memories）。

请用中文返回，严格 JSON 格式（不要markdown代码块）:

{
  "tasks": [
    {
      "title": "具体可执行的任务标题",
      "description": "任务描述（1-2句话）",
      "priority": "high|medium|low",
      "estimated_minutes": 30,
      "module": "english|health|exam|career|life_admin|learning|personal|finance|general"
    }
  ]
}

规则:
- 返回 3-8 个任务。根据用户偏好调整数量：
  * 如果记忆显示用户偏爱小步快跑 → 6-8个短任务（15-30min each）
  * 如果记忆显示用户偏爱深度专注 → 3-5个长任务（45-90min each）
  * 默认：4-6个任务，30-60min each
- vision 级别目标: 拆解为 yearly 里程碑。
- yearly 级别目标: 拆解为 monthly 阶段任务。
- monthly 级别目标: 拆解为 weekly 具体行动。
- 每个任务必须具体、可执行、可衡量。
- priority: 关键路径任务为 high，支撑任务为 medium，锦上添花为 low。
- estimated_minutes: 根据用户偏好的工作节奏调整，不超过 180。
  * 如果用户偏好短时间任务：15-45min
  * 如果用户偏好深度工作：45-120min
- module: 根据任务性质选择最合适的模块。
- 参考用户偏好记忆中的工作习惯、能量周期、学习偏好来个性化任务设计。`;

// ── Helpers ──

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

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

// ── Memory → Preference Profile ──

function buildUserProfile(memories: Array<Record<string, unknown>>): string {
  if (memories.length === 0) return "";

  const byType = new Map<string, string[]>();
  for (const m of memories) {
    const type = (m.memory_type as string) || "general";
    const content = (m.content as string) || "";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(content);
  }

  const lines: string[] = ["## 用户长期偏好记忆（Confirmed Memories）"];

  for (const [type, contents] of byType) {
    const label: Record<string, string> = {
      preference: "偏好", personality: "性格", habit: "习惯",
      insight: "洞察", skill: "技能",
    };
    lines.push(`\n### ${label[type] || type}`);
    for (const c of contents.slice(0, 3)) {
      lines.push(`- ${c}`);
    }
  }

  lines.push("\n请在拆解任务时参考以上偏好：");
  lines.push("- 如果用户有工作节奏偏好（如喜欢短时间任务），调整 estimated_minutes");
  lines.push("- 如果用户有学习风格偏好，调整任务类型");
  lines.push("- 如果用户有效能习惯（如晨间高效），标注合适的执行时间建议");

  return lines.join("\n");
}

// ── Main ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "未登录" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return jsonResponse({ error: "登录已过期" }, 401);

    const body = await req.json();
    const goalTitle = body.goal_title as string;
    const goalDescription = body.goal_description as string || "";
    const goalLevel = body.goal_level as string || "monthly";

    if (!goalTitle || goalTitle.trim().length === 0) {
      return jsonResponse({ error: "目标标题不能为空" }, 400);
    }

    // ── Fetch confirmed memories for personalization ──
    const { data: confirmedMemories } = await supabase
      .from("ai_memories")
      .select("id,memory_type,content,confidence")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("status", "confirmed")
      .order("last_reinforced_at", { ascending: false })
      .limit(15);

    const preferenceContext = buildUserProfile((confirmedMemories || []) as Array<Record<string, unknown>>);

    // ── Call DeepSeek ──
    const userData = JSON.stringify({
      goal_title: goalTitle.trim(),
      goal_description: goalDescription.trim(),
      goal_level: goalLevel,
    });

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (preferenceContext) {
      messages.push({ role: "system", content: preferenceContext });
    }

    messages.push({ role: "user", content: userData });

    const aiResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        max_tokens: 2048,
        temperature: 0.5,
      }),
    });

    if (!aiResponse.ok) {
      return jsonResponse({ error: `AI 服务异常 (${aiResponse.status})` }, 502);
    }

    const aiData = await aiResponse.json();
    const rawContent: string = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed: number = aiData.usage?.total_tokens || 0;

    let result: Record<string, unknown>;
    try {
      result = parseAIJson(rawContent);
    } catch {
      return jsonResponse({
        error: "parse_error",
        raw: rawContent.slice(0, 500),
        message: "AI 返回格式异常，请重试",
      }, 500);
    }

    // Log
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "coach",
      action: "task_breakdown",
      input_data: {
        goal_title: goalTitle,
        goal_level: goalLevel,
        memory_count: (confirmedMemories || []).length,
        preference_profile: preferenceContext ? "injected" : "empty",
      },
      output_data: { task_count: (result.tasks as unknown[])?.length || 0 },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });

    return jsonResponse({
      ...result,
      memory_count: (confirmedMemories || []).length,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : "服务器内部错误",
    }, 500);
  }
});
