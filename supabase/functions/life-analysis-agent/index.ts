// ============================================
// Nancy OS — Life Analysis Agent
// AI understanding layer: distinguishes actions vs thoughts
// Triggered asynchronously after journal entry save
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callDeepSeek, parseAIJson } from "../_shared/ai.ts";
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
区分"行动"和"想法"，提供深层洞察和温和建议，不做心理诊断。

## 输出严格 JSON（不要markdown代码块）:
{
  "summary": "一句话摘要，30字以内",
  "emotion_analysis": "情绪状态观察，1-2句话，描述事实不诊断",
  "actions": [
    { "action": "具体做了什么", "category": "goal_progress|habit|challenge|decision|social|learning|other" }
  ],
  "thoughts": [
    { "thought": "用户的想法/认知/反思", "category": "self-reflection|planning|worry|gratitude|learning|other" }
  ],
  "themes": ["主题1", "主题2"],
  "events": ["可标记的具体事件1", "事件2"],
  "patterns": [],
  "insights": [],
  "suggestions": []
}

## 区分 Actions vs Thoughts（核心规则）:
- Actions = 用户实际做了什么行为（提交了报告、完成了训练、和朋友深聊、读了一本书）
- Thoughts = 用户的内心想法/认知/反思（觉得效率低、在考虑换工作、感谢某人、意识到某个问题）
- 只提取用户明确写到的内容，不推断不猜测

## Actions 提取规则（重要）:
只提取有价值的行为。以下日常琐事必须忽略，不要提取为 action：
- 起床、睡觉、吃饭、洗漱、洗澡、上厕所
- 通勤、坐车、走路（普通移动）
- 玩手机、刷视频（无目的的消遣）
- 其他日常生存性行为

只提取以下类别中有意义的行动：
- 目标推进：与工作/学习/项目目标相关的具体行动
- 习惯建立：运动、阅读、冥想等有意识的自律行为
- 困难克服：解决了某个问题、完成了拖延的任务
- 重要决定：做出了选择或决定
- 人际互动：有深度的社交、帮助他人、重要沟通
- 学习成长：学到了新东西、获得了新认知
- 如果没有符合以上标准的行动，返回空数组 []

## Insights 洞察规则:
insights 是对用户行为模式、成长变化、值得关注趋势的观察。
不是建议，不是评价，只是"我注意到…"的数据观察。
格式: [{ "insight": "观察到的内容", "category": "pattern|growth|trend|concern", "confidence": 0.6-0.9 }]
- pattern: 重复出现的行为模式
- growth: 积极的成长或变化
- trend: 值得关注的趋势（正向或负向）
- concern: 值得留意的问题信号
- 仅当有足够依据时才输出，最多2条，没有就 []
- 置信度 0.6 起步，只有非常确定才给 0.9

## Suggestions 温和建议:
基于当天记录，给出1-2条温和的行动方向提示。
不是任务清单，不是命令，更像是"你可以考虑…"的轻声提醒。
格式: [{ "suggestion": "建议内容", "category": "rest|action|mindset|social|health" }]
- rest: 建议休息、放松、放慢节奏
- action: 建议采取某个行动
- mindset: 建议调整心态或视角
- social: 建议与人交流或联系
- health: 建议关注身体健康
- 建议必须基于日记中明确出现的内容，不要凭空建议
- 语气温和、尊重，使用"可以考虑""或许可以试试"等表达
- 如果当天日记没有明确依据，返回空数组 []
- 最多2条，没有就 []

## 输出规则:
- actions: 只提取高价值行动，不超过5条，没有就 []
- thoughts: 只提取用户明确表达的想法，不超过5条，没有就 []
- themes: 2-3个话题标签，覆盖日记主要内容
- events: 值得标记的具体事件（可为空数组），如"提交了周报"、"完成了腿部训练"
- patterns: 极其严格 —— 只有当输入中的 recent_themes 出现同一主题 ≥2 次时才输出，
  格式 [{ "pattern": "描述", "confidence": 0.7-0.9, "related_dates": ["date1","date2"] }]
  否则严格返回空数组 []
- insights: 有依据时才输出，最多2条，没有就 []
- suggestions: 有明确依据时才输出，最多2条，没有就 []
- 如果日记内容很短（<20字），所有数组都可以为空
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
    const aiResult = await callDeepSeek([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(aiInput, null, 2) },
    ], { temperature: 0.5, maxTokens: 800 });

    if (!aiResult.success) {
      return new Response(JSON.stringify({ error: aiResult.error, detail: aiResult.detail }), {
        status: aiResult.status || 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const parsed = parseAIJson<Record<string, unknown>>(aiResult.data);

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

    // Validate insights
    const rawInsights = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 2) : [];
    const validInsights = rawInsights
      .filter((i: Record<string, unknown>) => {
        if (!i.insight || typeof i.insight !== "string") return false;
        if (typeof i.confidence !== "number") return false;
        const validCategories = ["pattern", "growth", "trend", "concern"];
        return validCategories.includes(i.category as string);
      })
      .map((i: Record<string, unknown>) => ({
        insight: i.insight,
        category: i.category,
        confidence: Math.min(0.9, Math.max(0.6, i.confidence as number)),
      }));

    // Validate suggestions
    const rawSuggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 2) : [];
    const validSuggestions = rawSuggestions
      .filter((s: Record<string, unknown>) => {
        if (!s.suggestion || typeof s.suggestion !== "string") return false;
        const validCategories = ["rest", "action", "mindset", "social", "health"];
        return validCategories.includes(s.category as string);
      })
      .map((s: Record<string, unknown>) => ({
        suggestion: s.suggestion,
        category: s.category,
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
        ai_insights: validInsights,
        ai_suggestions: validSuggestions,
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
      insights_count: validInsights.length,
      suggestions_count: validSuggestions.length,
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
