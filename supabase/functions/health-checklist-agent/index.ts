// ============================================
// Nancy OS — Health Checklist Agent
// Generates 3 daily health tips based on user context
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

const SYSTEM_PROMPT = `你是一个健康生活助手（Nancy OS Health Checklist Agent）。用户正在减脂增肌。

你会收到用户当前的：
1. 身体档案（体重、目标体重、健身目标、关注部位）
2. 健康目标（来自 Plan OS goals）
3. 今日数据（饮水量、饮食记录数、运动记录）
4. 本周汇总（运动天数、饮食记录数、上次训练内容）
5. 习惯完成情况

请用中文分析，返回严格 JSON 格式（不要markdown代码块）:

{
  "tips": [
    {
      "title": "今天最值得关注的健康小事标题，15字以内",
      "detail": "具体建议，30-50字，温暖直接",
      "category": "diet/workout/water/sleep/recovery/habit"
    }
  ],
  "motivation": "一句话鼓励，15字以内"
}

规则:
- 必须返回恰好3条tips
- 基于真实数据，不要编造不存在的趋势
- 每条tip要具体可执行，不是泛泛的"注意饮食"
- 优先关注：不足的领域 > 需要调整的领域 > 做得好的鼓励
- 如果数据不足（运动0天、饮食记录0条），诚实说"今天先记录饮食和运动，明天AI就能给你个性化建议"
- categories分布尽量多样化（避免3条都是workout）
- 语气像关心你的朋友，不是医生`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Fetch context
    const [
      { data: bodyProfile },
      { data: healthGoals },
      { data: todayWater },
      { data: todayFoods },
      { data: todayWorkouts },
      { data: weekWorkouts },
      { data: habits },
    ] = await Promise.all([
      supabase.from("body_profiles").select("*").eq("user_id", user.id).limit(1).single(),
      supabase.from("goals").select("id,title,target_metric,current_metric,status,progress").eq("user_id", user.id).eq("goal_category", "health").eq("status", "active").limit(10),
      supabase.from("water_records").select("amount_ml").eq("user_id", user.id).gte("recorded_at", `${today}T00:00:00`).lte("recorded_at", `${today}T23:59:59`),
      supabase.from("food_records").select("id").eq("user_id", user.id).eq("date", today),
      supabase.from("workout_records").select("id,exercise_name,duration_minutes,perceived_effort").eq("user_id", user.id).eq("date", today),
      supabase.from("workout_records").select("date,exercise_name,perceived_effort").eq("user_id", user.id).gte("date", weekAgoStr).lte("date", today).order("date", { ascending: false }).limit(20),
      supabase.from("habit_records").select("status").eq("user_id", user.id).eq("date", today),
    ]);

    const todayWaterMl = (todayWater || []).reduce((sum: number, r: { amount_ml: number }) => sum + r.amount_ml, 0);
    const workoutDays = new Set((weekWorkouts || []).map((w: { date: string }) => w.date)).size;
    const lastWorkout = (weekWorkouts || [])[0] || null;
    const habitsCompleted = (habits || []).filter((h: { status: string }) => h.status === "completed").length;
    const habitsTotal = (habits || []).length;

    const context = {
      bodyProfile: bodyProfile ? {
        weight: bodyProfile.weight,
        target_weight: bodyProfile.target_weight,
        body_fat_percentage: bodyProfile.body_fat_percentage,
        fitness_goal: bodyProfile.fitness_goal,
        focus_areas: bodyProfile.focus_areas,
      } : null,
      healthGoals: (healthGoals || []).map((g: Record<string, unknown>) => ({
        title: g.title,
        target_metric: g.target_metric,
        current_metric: g.current_metric,
        progress: g.progress,
      })),
      today: {
        water_ml: todayWaterMl,
        food_count: (todayFoods || []).length,
        workout_count: (todayWorkouts || []).length,
        workouts: (todayWorkouts || []).map((w: Record<string, unknown>) => ({
          exercise_name: w.exercise_name,
          duration_minutes: w.duration_minutes,
        })),
      },
      thisWeek: {
        workout_days: workoutDays,
        food_records: 0, // computed below
        last_workout: lastWorkout ? {
          exercise_name: lastWorkout.exercise_name,
          date: lastWorkout.date,
          effort: lastWorkout.perceived_effort,
        } : null,
      },
      habits: {
        completed: habitsCompleted,
        total: habitsTotal,
      },
      dataQuality: {
        hasBodyProfile: !!bodyProfile?.weight,
        hasGoals: (healthGoals || []).length > 0,
        hasWorkouts: workoutDays > 0,
        hasFoodRecords: (todayFoods || []).length > 0,
      },
    };

    // Count weekly food records
    const { count: weekFoodCount } = await supabase
      .from("food_records")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("date", weekAgoStr)
      .lte("date", today);
    context.thisWeek.food_records = weekFoodCount || 0;

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
        max_tokens: 600,
      }),
    });

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Health checklist agent error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
