// ============================================
// Nancy OS — Health Coach Agent
// Analyzes workout/food/body data → daily actionable advice
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

const SYSTEM_PROMPT = `你是一个健康教练 AI（Nancy OS Health Coach）。你的用户正在减脂增肌。

你会收到用户最近7天的：
1. 运动记录（exercise_name, duration_minutes, perceived_effort, date）
2. 饮食记录（meal_type, food_name, date）
3. 身体数据（weight, target_weight, body_fat_percentage, fitness_goal）

请用中文分析，返回严格 JSON 格式（不要markdown代码块）:

{
  "training_advice": "今天适合做什么训练。例如：'昨天练了臀腿，今天建议背部力量训练+20分钟有氧。从训练库选择背部视频开始。' 40-60字",
  "diet_advice": "今天应该怎么吃。例如：'最近3天蛋白质摄入偏少，今天推荐高蛋白晚餐。食谱库里收藏了鸡胸肉沙拉和豆腐汤。' 40-60字",
  "warnings": "需要避免的事情。例如：'连续4天高强度训练，今天注意充分休息，至少喝2L水。' 或 null（如果一切正常）。30-50字",
  "weekly_summary": "本周概览一句话。例如：'本周运动3天，饮食记录12餐，体重稳定在68kg。' 20-30字"
}

规则:
- 基于真实数据给出建议，不要编造
- training_advice 要具体到训练部位和类型，并引导用户使用训练库
- diet_advice 要提到食谱库中已有的食谱（如果提供的话）
- 如果没有足够数据（运动<2天，饮食<5餐），诚实说明数据不足，给出通用建议
- 语气温暖但直接，像一个关心你的教练`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    // Fetch context data
    const [
      { data: bodyProfile },
      { data: workouts },
      { data: foods },
      { data: recipes },
    ] = await Promise.all([
      supabase.from("body_profiles").select("*").eq("user_id", user.id).limit(1).single(),
      supabase.from("workout_records").select("*").eq("user_id", user.id).gte("date", weekAgoStr).lte("date", today).order("date", { ascending: false }).limit(30),
      supabase.from("food_records").select("*").eq("user_id", user.id).gte("date", weekAgoStr).lte("date", today).order("created_at", { ascending: false }).limit(30),
      supabase.from("recipes").select("id,name,category,calories_per_serving,protein_grams").eq("user_id", user.id).limit(20),
    ]);

    const context = {
      bodyProfile: bodyProfile || null,
      workouts: workouts || [],
      foods: foods || [],
      recipes: recipes || [],
      dataQuality: {
        workoutDays: new Set((workouts || []).map((w: Record<string, unknown>) => w.date)).size,
        foodCount: (foods || []).length,
        hasBodyData: !!bodyProfile?.weight,
      },
    };

    // Call DeepSeek
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(context, null, 2) },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    // Save insight
    const { error: insertErr } = await supabase.from("ai_insights").insert({
      user_id: user.id,
      agent_type: "health_coach",
      insight_type: "daily_advice",
      title: "今日健康建议",
      content: parsed.training_advice || "",
      data: parsed,
      generated_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error("Failed to save insight:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save insight", detail: insertErr.message }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Health coach error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
