// ============================================
// Nancy OS — Task Breakdown Agent Edge Function v2
// AI breaks down goals into actionable tasks
// v2: Injects confirmed memory context for personalization
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callDeepSeek, parseAIJson } from "../_shared/ai.ts";

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
      "module": "english|health|exam|career|life_admin|learning|personal|finance|general",
      "task_type": "one_time|recurring",
      "frequency_type": "daily|weekly|monthly",
      "target_count": 1
    }
  ]
}

## 任务类型判断规则（非常重要）:

### 一次性任务 (task_type: "one_time")
- 完成一次即可的任务，如: 买蛋白粉、完成课程作业、整理房间、预约体检
- 不需要 frequency_type 和 target_count 字段（设为 null 或省略）

### 周期性任务 (task_type: "recurring")
- 需要在周期内反复执行、累计完成次数的任务
- 例如:
  * "每天记录饮食热量" → task_type: "recurring", frequency_type: "daily", target_count: 1
  * "每周3次有氧运动" → task_type: "recurring", frequency_type: "weekly", target_count: 3
  * "每周2次力量训练" → task_type: "recurring", frequency_type: "weekly", target_count: 2
  * "每月测量体脂率" → task_type: "recurring", frequency_type: "monthly", target_count: 1
  * "每天冥想" → task_type: "recurring", frequency_type: "daily", target_count: 1
- 必须提供 frequency_type 和 target_count 字段

## 判断原则:
- 如果任务描述包含"每天/每日/天天/坚持" → recurring, daily
- 如果任务描述包含"每周X次/一周X次/每周X天" → recurring, weekly
- 如果任务描述包含"每月/月度/一个月" → recurring, monthly
- 运动/饮食/习惯/记录/复习类任务 → 大概率是 recurring
- 购买/完成某个具体项目/整理/一次性操作 → one_time

## 其他规则:
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

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
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
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(req,{ error: "未登录" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return jsonResponse(req,{ error: "登录已过期" }, 401);

    const body = await req.json();
    const goalTitle = body.goal_title as string;
    const goalDescription = body.goal_description as string || "";
    const goalLevel = body.goal_level as string || "monthly";

    if (!goalTitle || goalTitle.trim().length === 0) {
      return jsonResponse(req,{ error: "目标标题不能为空" }, 400);
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

    const aiResult = await callDeepSeek(messages, { temperature: 0.5, maxTokens: 2048 });

    if (!aiResult.success) {
      return jsonResponse(req, { error: aiResult.error, detail: aiResult.detail }, aiResult.status || 502);
    }

    const tokensUsed: number = aiResult.usage?.totalTokens || 0;

    let result: Record<string, unknown>;
    try {
      result = parseAIJson<Record<string, unknown>>(aiResult.data);
    } catch {
      return jsonResponse(req, {
        error: "parse_error",
        raw: (aiResult.data as string).slice(0, 500),
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

    return jsonResponse(req,{
      ...result,
      memory_count: (confirmedMemories || []).length,
    });
  } catch (err) {
    return jsonResponse(req,{
      error: err instanceof Error ? err.message : "服务器内部错误",
    }, 500);
  }
});
