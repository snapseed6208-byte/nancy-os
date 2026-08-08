// ============================================
// Nancy OS — Daily Brief Agent Edge Function v3
// Reads yesterday's data + confirmed memories
// Generates AI-powered daily dashboard brief
// v3: Migrated to nancy-context unified layer
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callDeepSeek, parseAIJson } from "../_shared/ai.ts";
import {
  authenticateRequest,
  getCorsHeaders,
  jsonResponse,
  getConfirmedMemories,
  buildMemoryProfile,
} from "../_shared/nancy-context.ts";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const SYSTEM_PROMPT = `你是一个个人成长 AI 助手（Nancy OS Daily Brief Agent）。你的用户是一位正在自我提升的年轻人。

你会收到：
1. 用户昨天的数据（日记、心情、任务、习惯、英语活动）
2. 用户的长期偏好画像（从 confirmed memories 提炼的行为模式、偏好、习惯）

请用中文分析，返回严格 JSON 格式（不要markdown代码块，直接返回JSON对象）:

{
  "yesterday_summary": "80-120字的中文总结，概括昨天做了什么、状态如何",
  "today_focus": "30-50字，今天最重要的1-2件事，结合用户偏好画像",
  "personalized_suggestions": [
    {
      "suggestion": "具体可执行的建议，参考用户的行为模式和偏好",
      "priority": "high|medium|low",
      "action_label": "2-4字操作按钮文字",
      "action_path": "/english|/health|/life-trace|/plan|/review|/career"
    }
  ],
  "warnings": [
    {
      "type": "mood|habit|task|health|review|general",
      "message": "需要关注的提醒"
    }
  ],
  "motivation": "一句温暖的鼓励语，不超过40字，针对用户昨天的状态和长期特点个性化"
}

规则:
- yesterday_summary: 基于实际数据，不要编造。如果没有昨天的数据，诚实说明。
- today_focus: 结合任务优先级、长期偏好画像中的行为模式、当前数据。
- personalized_suggestions: 1-3条。每条必须有 action_label 和 action_path。
  * 参考偏好画像中用户的有效能模式来设计建议
  * 如果用户有晨间高效的模式，上午安排高优先级任务
  * 如果用户有特定的学习偏好，建议匹配的学习活动
- warnings: 0-2条。对比历史行为模式，发现偏离时提醒。
  * 例如：如果用户通常每天运动但昨天没运动，提醒
- motivation: 必须个性化，不要通用鸡汤。引用偏好画像中的用户特点。
- 如果某类数据为空，诚实处理，不要编造内容。`;

// ── Helpers ──

function errorResponse(
  error: string,
  detail: string | undefined,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify({ error, detail }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Main ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req, ALLOWED_ORIGINS) });
  }

  const startTime = Date.now();
  const corsHeaders = getCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    // 1 ─ Authenticate (nancy-context)
    const auth = await authenticateRequest(req);
    if (!auth) {
      return jsonResponse({ error: "未登录" }, corsHeaders, 401);
    }
    const { supabase, userId } = auth;

    // 2 ─ Determine yesterday's date
    const today = new Date();
    today.setDate(today.getDate() - 1);
    const yesterday = today.toISOString().split("T")[0];

    // 3 ─ Check if brief already exists for today
    const realToday = new Date().toISOString().split("T")[0];
    const { data: existingBrief } = await supabase
      .from("ai_daily_briefs")
      .select("id")
      .eq("user_id", userId)
      .eq("date", realToday)
      .single();

    if (existingBrief) {
      return jsonResponse(
        { error: "already_exists", message: "今天的简报已生成" },
        corsHeaders,
        409,
      );
    }

    // 4 ─ Query yesterday's data + confirmed memories in parallel (nancy-context for memories)
    const [
      { data: journalEntries },
      { data: moodRecords },
      { data: tasks },
      { data: habitRecords },
      { data: speakingSessions },
      { data: expressionReviews },
      confirmedMemories,
    ] = await Promise.all([
      supabase.from("journal_entries")
        .select("id,title,content,mood,energy_level,top_three,todos")
        .eq("user_id", userId)
        .eq("date", yesterday)
        .limit(5),
      supabase.from("mood_records")
        .select("id,mood,intensity,trigger_event,time_of_day,energy_level,notes")
        .eq("user_id", userId)
        .eq("date", yesterday)
        .limit(10),
      supabase.from("tasks")
        .select("id,title,status,priority,module,due_date,completed_at")
        .eq("user_id", userId)
        .or(`due_date.eq.${yesterday},completed_at.gte.${yesterday}`)
        .limit(20),
      supabase.from("habit_records")
        .select("id,habit_id,date,status,note")
        .eq("user_id", userId)
        .eq("date", yesterday)
        .limit(20),
      supabase.from("speaking_sessions")
        .select("id,scenario,duration_seconds,created_at")
        .eq("user_id", userId)
        .gte("created_at", yesterday)
        .lte("created_at", `${yesterday}T23:59:59`)
        .limit(5),
      supabase.from("expression_reviews")
        .select("id,expression_id,result,reviewed_at")
        .eq("user_id", userId)
        .gte("reviewed_at", yesterday)
        .lte("reviewed_at", `${yesterday}T23:59:59`)
        .limit(20),
      // nancy-context: unified memory fetch
      getConfirmedMemories(supabase, userId, { limit: 20 }),
    ]);

    // 5 ─ Build data context and check minimal threshold
    const dataPointCount =
      (journalEntries?.length || 0) +
      (moodRecords?.length || 0) +
      (tasks?.length || 0) +
      (habitRecords?.length || 0) +
      (speakingSessions?.length || 0) +
      (expressionReviews?.length || 0);

    if (dataPointCount === 0) {
      await supabase.from("agent_logs").insert({
        user_id: userId,
        agent_type: "coach",
        action: "daily_brief",
        input_data: { date: yesterday, data_points: 0 },
        output_data: { summary: "no_data", tokens_used: 0, generated_via_fallback: true },
        model: "none",
        tokens_used: 0,
      });

      return jsonResponse({
        period: yesterday,
        yesterday_summary: "昨天没有记录任何数据。",
        today_focus: "从今天开始记录吧！",
        personalized_suggestions: [
          { suggestion: "写一篇简短的日记", priority: "high", action_label: "去记录", action_path: "/life-trace/journal" },
        ],
        warnings: [],
        motivation: "每一天都是新的开始。",
        memory_refs: [],
        tokens_used: 0,
        data_points: 0,
      }, corsHeaders);
    }

    // 6 ─ Build preference profile from confirmed memories (nancy-context)
    const memories = confirmedMemories;
    const preferenceProfile = buildMemoryProfile(memories, "preference");

    // 7 ─ Call DeepSeek with structured memory context
    const userData = JSON.stringify({
      date: yesterday,
      journal_entries: journalEntries || [],
      mood_records: moodRecords || [],
      tasks: tasks || [],
      habit_records: habitRecords || [],
      english_activity: {
        speaking_sessions: speakingSessions?.length || 0,
        expression_reviews: expressionReviews?.length || 0,
      },
      confirmed_memories: memories.map((m) => ({
        type: m.memory_type,
        content: m.content,
        confidence: m.confidence,
      })),
    });

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (preferenceProfile) {
      messages.push({ role: "system", content: preferenceProfile });
    }

    messages.push({ role: "user", content: userData });

    const aiResult = await callDeepSeek(messages, { temperature: 0.5, maxTokens: 2048 });
    if (!aiResult.success) {
      return errorResponse(aiResult.error, aiResult.detail, aiResult.status || 502, corsHeaders);
    }
    const rawContent: string = aiResult.data as string;
    const tokensUsed: number = aiResult.usage?.totalTokens || 0;

    // 8 ─ Parse AI response
    let analysis: Record<string, unknown>;
    try {
      analysis = parseAIJson<Record<string, unknown>>(rawContent);
    } catch {
      return jsonResponse({
        error: "parse_error",
        raw: rawContent.slice(0, 500),
        message: "AI 返回格式异常，请重试",
      }, corsHeaders, 500);
    }

    // 9 ─ Write daily brief
    const memoryIds = memories.map((m) => m.id);

    const { data: brief } = await supabase
      .from("ai_daily_briefs")
      .insert({
        user_id: userId,
        date: realToday,
        summary: analysis.yesterday_summary || "",
        focus: analysis.today_focus || "",
        suggestions: analysis.personalized_suggestions || [],
        warnings: analysis.warnings || [],
        motivation: analysis.motivation || "",
        memory_refs: memoryIds,
        tokens_used: tokensUsed,
      })
      .select("id")
      .single();

    // 10 ─ Write agent log
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "coach",
      action: "daily_brief",
      input_data: {
        date: yesterday,
        data_points: dataPointCount,
        memory_count: memoryIds.length,
        profile_injected: !!preferenceProfile,
      },
      output_data: {
        brief_id: brief?.id,
        summary: (analysis.yesterday_summary as string || "").slice(0, 100),
        focus: analysis.today_focus,
        suggestions_count: (analysis.personalized_suggestions as unknown[])?.length || 0,
        tokens_used: tokensUsed,
        generated_via_fallback: false,
      },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });

    // 11 ─ Return
    const duration = Date.now() - startTime;
    return jsonResponse({
      id: brief?.id,
      date: realToday,
      period: yesterday,
      ...analysis,
      memory_refs: memoryIds,
      tokens_used: tokensUsed,
      duration_ms: duration,
      data_points: dataPointCount,
    }, corsHeaders);

  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : "服务器内部错误",
    }, corsHeaders, 500);
  }
});
