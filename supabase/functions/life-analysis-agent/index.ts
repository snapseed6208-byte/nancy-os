// ============================================
// Nancy OS — Life Analysis Agent
// AI understanding layer: distinguishes actions vs thoughts
// Triggered asynchronously after journal entry save
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const AI_VERSION = "v1.0.0";

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

const SYSTEM_PROMPT = `你是 Nancy OS Life Analysis Agent。你的任务是对用户日记进行客观数据分析，
区分"行动"和"想法"，不做心理诊断。

## 输出严格 JSON（不要markdown代码块）:
{
  "summary": "一句话摘要，30字以内",
  "emotion_analysis": "情绪状态观察，1-2句话，描述事实不诊断",
  "actions": [
    { "action": "具体做了什么", "category": "workout|work|social|learning|life|health|other" }
  ],
  "thoughts": [
    { "thought": "用户的想法/认知/反思", "category": "self-reflection|planning|worry|gratitude|learning|other" }
  ],
  "themes": ["主题1", "主题2"],
  "events": ["可标记的具体事件1", "事件2"],
  "patterns": []
}

## 区分 Actions vs Thoughts（核心规则）:
- Actions = 用户实际做了什么行为（去了健身房、写了报告、见了朋友、做了饭）
- Thoughts = 用户的内心想法/认知/反思（觉得效率低、在考虑换工作、感谢某人、意识到某个问题）
- 只提取用户明确写到的内容，不推断不猜测

## 输出规则:
- actions: 只提取用户实际做了的事，不超过5条，没有就 []
- thoughts: 只提取用户明确表达的想法，不超过5条，没有就 []
- themes: 2-3个话题标签，覆盖日记主要内容
- events: 值得标记的具体事件（可为空数组），如"提交了周报"、"完成了腿部训练"
- patterns: 极其严格 —— 只有当输入中的 recent_themes 出现同一主题 ≥2 次时才输出，
  格式 [{ "pattern": "描述", "confidence": 0.7-0.9, "related_dates": ["date1","date2"] }]
  否则严格返回空数组 []
- 如果日记内容很短（<20字），actions/thoughts 都可以为空数组
- 语气客观，像数据观察者，不是心理医生
- summary 和 emotion_analysis 使用中文`;

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

    const body = await req.json();
    const { journal_entry_id } = body;

    if (!journal_entry_id) {
      return new Response(JSON.stringify({ error: "Missing journal_entry_id" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch the journal entry
    const { data: entry, error: entryErr } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("id", journal_entry_id)
      .eq("user_id", user.id)
      .single();

    if (entryErr || !entry) {
      return new Response(JSON.stringify({ error: "Journal entry not found" }), {
        status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!entry.content || entry.content.trim().length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "No content to analyze" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch recent 7 days ai_themes for pattern detection
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sinceDate = sevenDaysAgo.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const { data: recentEntries } = await supabase
      .from("journal_entries")
      .select("date, ai_themes")
      .eq("user_id", user.id)
      .gte("date", sinceDate)
      .lt("date", today)
      .not("ai_themes", "is", null);

    // Aggregate recent themes
    const recentThemes: string[] = [];
    for (const e of (recentEntries || [])) {
      if (e.ai_themes && Array.isArray(e.ai_themes)) {
        recentThemes.push(...e.ai_themes);
      }
    }

    // Build AI input
    const aiInput = {
      content: entry.content,
      mood: entry.mood || null,
      energy_level: entry.energy_level || null,
      title: entry.title || null,
      recent_themes: recentThemes.length > 0 ? recentThemes : [],
    };

    // Call DeepSeek
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(aiInput, null, 2) },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    const result = await response.json();

    if (!result.choices?.[0]?.message?.content) {
      console.error("DeepSeek returned no content:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const raw = result.choices[0].message.content;

    let parsed: Record<string, unknown>;
    try {
      // Handle markdown code blocks
      const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", raw);
      return new Response(JSON.stringify({ error: "AI response parse error" }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Validate and sanitize output
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 100) : "";
    const emotion_analysis = typeof parsed.emotion_analysis === "string" ? parsed.emotion_analysis.slice(0, 300) : "";
    const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [];
    const thoughts = Array.isArray(parsed.thoughts) ? parsed.thoughts.slice(0, 5) : [];
    const themes = Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [];
    const events = Array.isArray(parsed.events) ? parsed.events.slice(0, 10) : [];
    const rawPatterns = Array.isArray(parsed.patterns) ? parsed.patterns.slice(0, 3) : [];

    // Strict pattern validation: must have ≥2 related_dates
    const validPatterns = rawPatterns
      .filter((p: Record<string, unknown>) => {
        if (!p.pattern || typeof p.confidence !== "number") return false;
        const dates = Array.isArray(p.related_dates) ? p.related_dates : [];
        return dates.length >= 2;
      })
      .map((p: Record<string, unknown>) => ({
        pattern: p.pattern,
        confidence: Math.min(1, Math.max(0, p.confidence as number)),
        related_dates: p.related_dates,
      }));

    // Write AI results back to journal_entries
    const { error: updateErr } = await supabase
      .from("journal_entries")
      .update({
        ai_summary: summary || null,
        ai_emotion_analysis: emotion_analysis || null,
        ai_actions: actions,
        ai_thoughts: thoughts,
        ai_themes: themes,
        ai_events: events,
        ai_patterns: validPatterns,
        ai_analysis_version: AI_VERSION,
        updated_at: new Date().toISOString(),
      })
      .eq("id", journal_entry_id);

    if (updateErr) {
      console.error("Failed to update journal entry:", updateErr);
      return new Response(JSON.stringify({
        error: "Failed to save AI analysis",
        detail: updateErr.message,
      }), {
        status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      summary,
      emotion_analysis,
      actions_count: actions.length,
      thoughts_count: thoughts.length,
      themes,
      events,
      patterns_count: validPatterns.length,
      version: AI_VERSION,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Life analysis agent error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
