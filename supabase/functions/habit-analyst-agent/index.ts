// ============================================
// Nancy OS — Habit Analyst Agent
// AI-powered habit intelligence via DeepSeek
// Input: { habit_id?: string, days?: number }
// Output: { summary, strengths[], suggestions[], motivation, stats }
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

const ANALYSIS_PROMPT = `You are an expert habit coach and behavioral analyst for a Chinese user building daily habits through Nancy OS (Personal Growth AI Operating System).

Your task: analyze the user's habit tracking data and provide insightful, motivating feedback in Chinese.

## Available Data
You will receive:
1. A list of the user's active habits (title, icon, color, target_days_per_week, best_streak)
2. Habit completion records for the analysis period (habit_id, date, status: completed/skipped/missed)

## Your Analysis Must Include

### 1. Summary (summary)
A 2-3 sentence overview in Chinese of the user's habit performance during this period. Be specific — mention which habits are going well and which need attention.

### 2. Strengths (strengths: string[])
2-4 specific things the user is doing well. Examples:
- "连续7天完成冥想练习，形成了稳定的晨间仪式"
- "即使在忙碌的日子里，也保持了英语学习的最低标准"
Be concrete and reference actual habits by name.

### 3. Suggestions (suggestions: string[])
2-4 actionable improvement ideas. Examples:
- "运动类习惯可以考虑固定时间（如早上7点），减少决策疲劳"
- "周末完成率下降明显，可以降低周末目标到平日的50%"
Focus on behavioral design, not just "try harder."

### 4. Motivation (motivation)
One inspiring sentence in Chinese. Use habit-specific details to make it personal. Be warm but not cheesy.

### 5. Stats — compute these from the data:
{
  "completion_rate": 0.75,     // 0-1, completed / (completed + missed), skipping excluded
  "total_completed": 42,
  "total_missed": 14,
  "total_skipped": 3,
  "total_days": 30,
  "most_consistent_habit": "habit_name",
  "most_struggled_habit": "habit_name",
  "best_day_of_week": "Monday",  // day with highest completion rate
  "consistency_score": 0.8       // 0-1, measure of day-to-day consistency
}

Return ONLY valid JSON, no markdown, no extra text:
{
  "summary": "...",
  "strengths": ["...", "..."],
  "suggestions": ["...", "..."],
  "motivation": "...",
  "stats": { ... }
}`;

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

    const body = await req.json() as { habit_id?: string; days?: number };
    const days = body.days || 30;
    const habitId = body.habit_id || null;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    // Fetch habits
    let habitQuery = supabase.from("habits").select("*").eq("user_id", user.id).eq("is_active", true);
    if (habitId) habitQuery = habitQuery.eq("id", habitId);
    const { data: habits } = await habitQuery;
    const habitList = (habits || []) as Array<{
      id: string; title: string; icon?: string; color?: string;
      target_days_per_week: number; streak_best: number;
    }>;

    if (habitList.length === 0) {
      return new Response(JSON.stringify({ error: "没有找到活跃的习惯数据" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch records
    let recordQuery = supabase
      .from("habit_records")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: true });

    if (habitId) recordQuery = recordQuery.eq("habit_id", habitId);
    const { data: records } = await recordQuery;
    const recordList = (records || []) as Array<{
      id: string; habit_id: string; date: string; status: string;
    }>;

    // Build context for AI
    const habitSummary = habitList.map((h) => ({
      name: h.title,
      icon: h.icon,
      target_per_week: h.target_days_per_week,
      best_streak: h.streak_best,
      records: recordList
        .filter((r) => r.habit_id === h.id)
        .map((r) => ({ date: r.date, status: r.status })),
    }));

    const completedCount = recordList.filter((r) => r.status === "completed").length;
    const missedCount = recordList.filter((r) => r.status === "missed").length;
    const skippedCount = recordList.filter((r) => r.status === "skipped").length;

    if (completedCount + missedCount === 0) {
      return new Response(JSON.stringify({ error: "当前时段没有足够的习惯记录数据" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

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
          {
            role: "user",
            content: `Please analyze this habit data for the period ${startStr} to ${endStr} (${days} days):\n\nHabits:\n${JSON.stringify(habitSummary, null, 2)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 2048,
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

    // Compute fallback stats if AI stats are missing
    const aiStats = (parsed.stats as Record<string, unknown>) || {};
    const habitRecords = new Map<string, { completed: number; missed: number }>();
    const dayRecords = new Map<string, { completed: number; total: number }>();
    for (const r of recordList) {
      if (!habitRecords.has(r.habit_id)) habitRecords.set(r.habit_id, { completed: 0, missed: 0 });
      const hr = habitRecords.get(r.habit_id)!;
      if (r.status === "completed") hr.completed++;
      if (r.status === "missed") hr.missed++;

      if (!dayRecords.has(r.date)) dayRecords.set(r.date, { completed: 0, total: 0 });
      const dr = dayRecords.get(r.date)!;
      if (r.status === "completed") dr.completed++;
      dr.total++;
    }

    let mostConsistent = "";
    let mostStruggled = "";
    let bestRate = 0;
    let worstRate = 1;
    for (const [hid, hr] of habitRecords) {
      const rate = hr.completed / Math.max(hr.completed + hr.missed, 1);
      if (rate > bestRate) { bestRate = rate; mostConsistent = hid; }
      if (rate < worstRate) { worstRate = rate; mostStruggled = hid; }
    }

    let bestDay = "";
    let bestDayRate = 0;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const [dateStr, dr] of dayRecords) {
      const rate = dr.completed / Math.max(dr.total, 1);
      if (rate > bestDayRate) { bestDayRate = rate; bestDay = dayNames[new Date(dateStr + "T12:00:00").getDay()]; }
    }

    const mergedStats = {
      completion_rate: aiStats.completion_rate ?? (completedCount / Math.max(completedCount + missedCount, 1)),
      total_completed: aiStats.total_completed ?? completedCount,
      total_missed: aiStats.total_missed ?? missedCount,
      total_skipped: aiStats.total_skipped ?? skippedCount,
      total_days: days,
      most_consistent_habit: aiStats.most_consistent_habit ?? (habitList.find((h) => h.id === mostConsistent)?.title || ""),
      most_struggled_habit: aiStats.most_struggled_habit ?? (habitList.find((h) => h.id === mostStruggled)?.title || ""),
      best_day_of_week: aiStats.best_day_of_week ?? bestDay,
      consistency_score: aiStats.consistency_score ?? 0,
    };

    // Save to habit_analyses
    const { error: insertErr } = await supabase.from("habit_analyses").insert({
      user_id: user.id,
      habit_id: habitId || null,
      analysis_type: habitId ? "habit_specific" : "overall",
      period_start: startStr,
      period_end: endStr,
      summary: parsed.summary as string || "",
      strengths: parsed.strengths as string[] || [],
      suggestions: parsed.suggestions as string[] || [],
      motivation: parsed.motivation as string || "",
      stats: mergedStats,
    } as unknown as Record<string, unknown>);

    if (insertErr) {
      console.error("Insert analysis error:", insertErr);
    }

    // Log
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "habit_analyst",
      action: "analyze_habits",
      input_data: {
        habit_count: habitList.length,
        record_count: recordList.length,
        period_days: days,
        habit_id: habitId,
      },
      output_data: {
        summary_length: (parsed.summary as string)?.length || 0,
        strengths_count: (parsed.strengths as string[])?.length || 0,
        suggestions_count: (parsed.suggestions as string[])?.length || 0,
        tokens_used: tokensUsed,
      },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });

    return new Response(JSON.stringify({
      id: "", // will be filled by insert above
      summary: parsed.summary,
      strengths: parsed.strengths,
      suggestions: parsed.suggestions,
      motivation: parsed.motivation,
      stats: mergedStats,
      analysis_type: habitId ? "habit_specific" : "overall",
      period_start: startStr,
      period_end: endStr,
      tokens_used: tokensUsed,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Habit analyst error:", err);
    return new Response(JSON.stringify({
      error: (err as Error).message || "服务器内部错误",
    }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
