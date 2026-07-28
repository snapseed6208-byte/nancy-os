// ============================================
// Nancy OS — Daily Reflection Agent
// Analyzes daily review → growth insight → Memory
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

const SYSTEM_PROMPT = `你是一个个人成长 AI 分析师（Nancy OS Daily Reflection Agent）。你的用户每天晚间写复盘，你需要帮助他看到自己的成长模式。

你会收到用户今天的复盘内容：
1. 今天完成了什么（q1_what_done）
2. 今天学到了什么（q2_best_thing）
3. 今天遇到了什么问题（q3_what_chaos）
4. 明天最重要的事（q4_tomorrow_first）
5. 今天心情（mood）

请用中文分析，返回严格 JSON 格式（不要markdown代码块）:

{
  "growth_insight": "今日成长洞察。分析用户的行为模式、优势、问题。例如：'你今天在产品方向上做出了关键决策——从数据记录系统转向AI行动系统。这表明你的战略思维在提升。同时，你面对大量编码任务时保持了高效执行。' 80-120字",
  "tomorrow_suggestion": "明天最应该做的一件事，具体可执行。例如：'明天优先完成Health OS的UI重构，这是今天计划的核心交付。早上先做，下午验证。' 30-50字",
  "pattern_observed": "观察到的行为模式，一句话。例如：'你在上午独立编码效率最高，下午适合做规划和验证。' 或 null",
  "memory_candidate": {
    "content": "一条适合存入长期记忆的洞察。例如：'用户在做产品决策时倾向于从用户价值出发重新定义问题，而不是在原有框架内优化。这是一个值得强化的思维模式。'",
    "category": "behavior_pattern|skill_growth|preference|achievement|lesson",
    "importance": "high|medium|low",
    "title": "记忆标题，10字以内"
  }
}

规则:
- growth_insight: 不要说空话。必须引用用户的具体内容。提取行为模式，不只是复述。
- tomorrow_suggestion: 基于用户自己的 q4_tomorrow_first，加上你的优化建议。
- pattern_observed: 如果确实发现了模式才写，否则 null。不要编造。
- memory_candidate: 只有当复盘内容中有值得长期记住的信息时才生成（重要的成就、教训、偏好变化、技能突破）。日常普通内容不需要生成记忆。
- 如果用户写的内容很少（每条都不到10字），相应缩短 insight 并设置 memory_candidate 为 null。
- 语气: 像一个了解你的成长教练，直接、温暖、有洞察力。`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { date } = await req.json() as { date: string };

    // Fetch the daily review
    const { data: review, error: reviewErr } = await supabase
      .from("daily_reviews")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .limit(1)
      .single();

    if (reviewErr || !review) {
      return new Response(JSON.stringify({ error: "Daily review not found" }), {
        status: 404, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Fetch recent reviews for context (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: recentReviews } = await supabase
      .from("daily_reviews")
      .select("date,q1_what_done,q2_best_thing,q3_what_chaos,mood")
      .eq("user_id", user.id)
      .gte("date", weekAgo.toISOString().split("T")[0])
      .lte("date", date)
      .order("date", { ascending: false });

    // Fetch existing memories for continuity
    const { data: memories } = await supabase
      .from("ai_memories")
      .select("title,content,category")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(20);

    const input = {
      today: {
        q1_what_done: review.q1_what_done,
        q2_best_thing: review.q2_best_thing,
        q3_what_chaos: review.q3_what_chaos,
        q4_tomorrow_first: review.q4_tomorrow_first,
        mood: review.mood,
        daily_log: review.daily_log,
      },
      recent_days: (recentReviews || []).map((r: Record<string, unknown>) => ({
        date: r.date,
        done: r.q1_what_done ? (r.q1_what_done as string).slice(0, 60) : "",
        learned: r.q2_best_thing ? (r.q2_best_thing as string).slice(0, 60) : "",
        problem: r.q3_what_chaos ? (r.q3_what_chaos as string).slice(0, 60) : "",
        mood: r.mood,
      })),
      existing_memories: (memories || []).map((m: Record<string, unknown>) => ({
        title: m.title,
        category: m.category,
      })),
    };

    // Call DeepSeek
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(input, null, 2) },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content || "{}";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from markdown code block
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = match ? JSON.parse(match[1]) : {};
    }

    // Update the daily review with AI insight
    await supabase
      .from("daily_reviews")
      .update({
        ai_growth_insight: (parsed.growth_insight as string) || null,
        ai_tomorrow_suggestion: (parsed.tomorrow_suggestion as string) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", review.id);

    // Save memory candidate if present
    const mc = parsed.memory_candidate as Record<string, unknown> | undefined;
    if (mc?.content && mc?.title) {
      await supabase.from("ai_memories").insert({
        user_id: user.id,
        title: mc.title as string,
        content: mc.content as string,
        category: (mc.category as string) || "behavior_pattern",
        importance: (mc.importance as string) || "medium",
        source: "daily_reflection",
        source_date: date,
        status: "candidate",
      });
    }

    // Save pattern to ai_insights
    if (parsed.pattern_observed) {
      await supabase.from("ai_insights").insert({
        user_id: user.id,
        agent_type: "daily_reflection",
        title: "行为模式观察",
        content: parsed.pattern_observed as string,
        data: parsed,
        generated_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Daily reflection error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
