// ============================================
// Nancy OS — Diet Analyst Agent
// AI-powered meal nutrition estimation via DeepSeek
// Input: { date, meal_type, food_records: [{food_name, portion?, feeling?}] }
// Output: { estimated_calories, estimated_protein, estimated_carbs, estimated_fat, assessment, suggestions }
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

const MEAL_LABELS: Record<string, string> = {
  breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐",
};

const ANALYSIS_PROMPT = `You are an expert nutritionist and diet coach for a Chinese user tracking their meals in Nancy OS (Personal Health Management System).

## Your Task
Analyze a single meal's food items and provide nutritional estimates and feedback in Chinese.

## Context
- The user logs meals with simple food descriptions (Chinese dishes, home cooking, restaurant meals, snacks)
- They do NOT weigh food or track exact nutrition — your estimates should be reasonable approximations
- Chinese diet patterns: home-cooked meals, canteen food, takeout, occasional snacks

## Output Format — Return ONLY valid JSON:

{
  "estimated_calories": 450,
  "estimated_protein": 25,
  "estimated_carbs": 55,
  "estimated_fat": 18,
  "assessment": "这顿早餐营养均衡，蛋白质和碳水搭配合理。如果再加一份蔬菜会更完美。",
  "suggestions": [
    "可以在主食里增加一些杂粮，如小米或燕麦",
    "鸡蛋提供了优质蛋白，继续保持"
  ]
}

## Rules
- estimated_calories: total kcal (integer), be realistic for Chinese meal portions
- estimated_protein: grams (integer)
- estimated_carbs: grams (integer)
- estimated_fat: grams (integer)
- assessment: 1-2 sentences in Chinese. Comment on nutritional balance, what's good, what's missing.
- suggestions: 2-3 actionable tips in Chinese. Be specific and practical.
- If the user mentions "半碗" or "一碗", estimate based on typical Chinese bowl size (~200-300g cooked rice)
- If the meal is a snack/small portion, adjust estimates accordingly
- Consider the meal type (breakfast/lunch/dinner/snack) for timing-appropriate advice
- Be encouraging, not judgmental — the goal is building awareness, not strict dieting`;

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      date: string;
      meal_type: string;
      food_records: Array<{ food_name: string; portion?: string; feeling?: string }>;
    };

    const { date, meal_type, food_records } = body;

    if (!food_records || food_records.length === 0) {
      return new Response(JSON.stringify({ error: "请提供食物记录" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Build meal description for AI
    const mealLabel = MEAL_LABELS[meal_type] || meal_type;
    const foodItems = food_records.map((f) => {
      let desc = f.food_name;
      if (f.portion) desc += `（${f.portion}）`;
      if (f.feeling) desc += ` [吃完感觉：${f.feeling}]`;
      return desc;
    }).join("；");

    const userMessage = `分析这顿${mealLabel}：

食物：${foodItems}

请给出营养估算和评价。`;

    // Call DeepSeek
    const aiResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: ANALYSIS_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
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

    const analysisData = {
      meal_type,
      meal_date: date,
      estimated_calories: parsed.estimated_calories as number,
      estimated_protein: parsed.estimated_protein as number,
      estimated_carbs: parsed.estimated_carbs as number,
      estimated_fat: parsed.estimated_fat as number,
      assessment: parsed.assessment as string || "",
      suggestions: parsed.suggestions as string[] || [],
    };

    const title = `${mealLabel}分析 — ${date}`;

    // Check if existing analysis for this meal+date, update or insert
    const { data: existing } = await supabase
      .from("ai_insights")
      .select("id")
      .eq("user_id", user.id)
      .eq("agent_type", "diet_analyst")
      .eq("insight_type", "meal_analysis")
      .eq("generated_at", date)
      .contains("data", { meal_type, meal_date: date })
      .limit(1);

    let insightId: string;

    if (existing && existing.length > 0) {
      const { error: updateErr } = await supabase
        .from("ai_insights")
        .update({
          title,
          content: analysisData.assessment,
          data: analysisData as unknown as Record<string, unknown>,
        })
        .eq("id", existing[0].id);
      if (updateErr) throw updateErr;
      insightId = existing[0].id;
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("ai_insights")
        .insert({
          user_id: user.id,
          agent_type: "diet_analyst",
          insight_type: "meal_analysis",
          title,
          content: analysisData.assessment,
          data: analysisData as unknown as Record<string, unknown>,
          generated_at: date,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      insightId = (inserted as { id: string }).id;
    }

    // Log
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "diet_analyst",
      action: "analyze_meal",
      input_data: {
        date,
        meal_type,
        food_count: food_records.length,
      },
      output_data: {
        estimated_calories: analysisData.estimated_calories,
        assessment_length: analysisData.assessment?.length || 0,
        tokens_used: tokensUsed,
      },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });

    return new Response(JSON.stringify({
      id: insightId,
      ...analysisData,
      tokens_used: tokensUsed,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Diet analyst error:", err);
    return new Response(JSON.stringify({
      error: (err as Error).message || "服务器内部错误",
    }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
