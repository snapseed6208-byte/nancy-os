// ============================================
// Nancy OS — Diet Analyst Agent v2
// v1: AI-powered per-meal nutrition estimation via DeepSeek
// v2: Added daily_summary mode — queries food_records from DB,
//     generates daily diet summary, stores with insight_type: daily_summary
//
// Input modes:
//   meal_analysis:  { date, meal_type, food_records: [{food_name, portion?, feeling?}] }
//   daily_summary:  { date, mode: "daily_summary" } — queries DB for food_records
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

const DAILY_SUMMARY_PROMPT = `You are an expert nutritionist and diet coach for a Chinese user tracking their meals in Nancy OS (Personal Health Management System).

## Your Task
Review ALL meals for a given day and provide a comprehensive daily diet summary in Chinese.

## Context
- The user logs meals with simple food descriptions (Chinese dishes, home cooking, restaurant meals, snacks)
- They do NOT weigh food or track exact nutrition
- Chinese diet patterns: home-cooked meals, canteen food, takeout, occasional snacks
- The goal is building awareness and encouraging healthy habits, not strict dieting

## Output Format — Return ONLY valid JSON:

{
  "summary": "一段200-350字的中文总结，涵盖今日总体饮食评价、营养亮点、需要注意的地方和明天的改善建议",
  "highlights": ["今日饮食亮点或优点1", "今日饮食亮点或优点2"],
  "warnings": ["需要注意的地方1，如缺少蔬菜、蛋白质不足等"],
  "suggestions": ["针对明天的具体改善建议1", "改善建议2"],
  "overall_rating": "优秀|良好|一般|需要注意"
}

## Rules
- summary: 200-350 characters in Chinese. Cover: overall assessment, what's good, what to improve, tomorrow's suggestion
- highlights: 1-3 specific things done well today
- warnings: 0-3 things to pay attention to (e.g., missing vegetables, too much oil, skipped meals). Empty array if all good
- suggestions: 2-3 actionable tips for tomorrow
- overall_rating: be honest but encouraging
- If the user ate 3 balanced meals, praise the consistency
- If protein is consistently present, highlight that
- If vegetables are missing from most meals, gently point it out
- If meals are skipped, note it with concern
- Be warm and supportive — like a caring friend who happens to be a nutrition expert`;

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
      date?: string;
      meal_type?: string;
      mode?: string;
      food_records?: Array<{ food_name: string; portion?: string; feeling?: string }>;
    };

    const mode = body.mode || "meal_analysis";
    const date = body.date || "";

    if (!date) {
      return new Response(JSON.stringify({ error: "请提供日期" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════
    // Mode: daily_summary — query DB, generate daily summary
    // ═══════════════════════════════════════════
    if (mode === "daily_summary") {
      console.log(`[diet-analyst-agent] daily_summary mode for date: ${date}`);

      // Query food_records from DB for this date
      const { data: foodRecords, error: queryErr } = await supabase
        .from("food_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: true });

      if (queryErr) {
        console.error(`[diet-analyst-agent] DB query error: ${queryErr.message}`);
        return new Response(JSON.stringify({ error: `查询食物记录失败: ${queryErr.message}` }), {
          status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      if (!foodRecords || foodRecords.length === 0) {
        return new Response(JSON.stringify({ error: "该日期没有饮食记录，请先添加食物" }), {
          status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Group by meal type for the prompt
      const byMeal: Record<string, typeof foodRecords> = {};
      for (const r of foodRecords) {
        const mt = r.meal_type || "other";
        if (!byMeal[mt]) byMeal[mt] = [];
        byMeal[mt].push(r);
      }

      let mealDescriptions = "";
      for (const [mt, records] of Object.entries(byMeal)) {
        const label = MEAL_LABELS[mt] || mt;
        const items = records.map((r: Record<string, unknown>) => {
          let desc = (r.food_name as string) || "";
          if (r.portion) desc += `（${r.portion}）`;
          return desc;
        }).join("、");
        mealDescriptions += `\n${label}：${items}`;
      }

      const summaryUserMessage = `请为以下一天的饮食记录生成综合总结：

日期：${date}
饮食记录：${mealDescriptions}

请给出今日总体评价、亮点、注意事项和明天建议。`;

      // Call DeepSeek for daily summary
      const aiResult = await callDeepSeek([
        { role: "system", content: DAILY_SUMMARY_PROMPT },
        { role: "user", content: summaryUserMessage },
      ], { temperature: 0.5, maxTokens: 1024 });

      if (!aiResult.success) {
        return new Response(JSON.stringify({ error: aiResult.error, detail: aiResult.detail }), {
          status: aiResult.status || 502,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const raw = aiResult.data as string;
      const tokensUsed: number = aiResult.usage?.totalTokens || 0;

      let parsed: Record<string, unknown>;
      try {
        parsed = parseAIJson<Record<string, unknown>>(raw);
      } catch {
        console.error(`[diet-analyst-agent] JSON parse error (daily_summary). Raw: ${raw.slice(0, 500)}`);
        return new Response(JSON.stringify({
          error: "parse_error",
          raw: raw.slice(0, 500),
          message: "AI 返回格式异常，请重试",
        }), {
          status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const summaryData = {
        meal_date: date,
        mode: "daily_summary",
        overall_rating: (parsed.overall_rating as string) || "",
        highlights: (parsed.highlights as string[]) || [],
        warnings: (parsed.warnings as string[]) || [],
        suggestions: (parsed.suggestions as string[]) || [],
      };

      const summaryContent = (parsed.summary as string) || "";
      const title = `饮食总结 — ${date}`;

      // Upsert: check for existing daily_summary for this date
      const { data: existing } = await supabase
        .from("ai_insights")
        .select("id")
        .eq("user_id", user.id)
        .eq("agent_type", "diet_analyst")
        .eq("insight_type", "daily_summary")
        .contains("data", { meal_date: date })
        .limit(1);

      let insightId: string;

      if (existing && existing.length > 0) {
        const { error: updateErr } = await supabase
          .from("ai_insights")
          .update({
            title,
            content: summaryContent,
            data: summaryData as unknown as Record<string, unknown>,
            generated_at: new Date().toISOString(),
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
            insight_type: "daily_summary",
            title,
            content: summaryContent,
            data: summaryData as unknown as Record<string, unknown>,
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
        action: "daily_summary",
        input_data: { date, mode: "daily_summary", food_count: foodRecords.length },
        output_data: {
          overall_rating: summaryData.overall_rating,
          summary_length: summaryContent.length,
          tokens_used: tokensUsed,
        },
        model: "deepseek-chat",
        tokens_used: tokensUsed,
      });

      return new Response(JSON.stringify({
        id: insightId,
        content: summaryContent,
        ...summaryData,
        tokens_used: tokensUsed,
      }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════
    // Mode: meal_analysis (legacy/default) — per-meal nutrition analysis
    // ═══════════════════════════════════════════
    const meal_type = body.meal_type || "";
    const food_records = body.food_records;

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
    const aiResult = await callDeepSeek([
      { role: "system", content: ANALYSIS_PROMPT },
      { role: "user", content: userMessage },
    ], { temperature: 0.5, maxTokens: 1024 });

    if (!aiResult.success) {
      return new Response(JSON.stringify({ error: aiResult.error, detail: aiResult.detail }), {
        status: aiResult.status || 502,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const raw = aiResult.data as string;
    const tokensUsed: number = aiResult.usage?.totalTokens || 0;

    let parsed: Record<string, unknown>;
    try {
      parsed = parseAIJson<Record<string, unknown>>(raw);
    } catch {
      console.error(`[diet-analyst-agent] JSON parse error (meal_analysis). Raw: ${raw.slice(0, 500)}`);
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
    const { data: existingMeal } = await supabase
      .from("ai_insights")
      .select("id")
      .eq("user_id", user.id)
      .eq("agent_type", "diet_analyst")
      .eq("insight_type", "meal_analysis")
      .eq("generated_at", date)
      .contains("data", { meal_type, meal_date: date })
      .limit(1);

    let insightId: string;

    if (existingMeal && existingMeal.length > 0) {
      const { error: updateErr } = await supabase
        .from("ai_insights")
        .update({
          title,
          content: analysisData.assessment,
          data: analysisData as unknown as Record<string, unknown>,
        })
        .eq("id", existingMeal[0].id);
      if (updateErr) throw updateErr;
      insightId = existingMeal[0].id;
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
      input_data: { date, meal_type, food_count: food_records.length },
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
