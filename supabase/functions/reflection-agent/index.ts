// ============================================
// Nancy OS — Reflection Agent Edge Function v3
// Memory Governance: candidate→probable→confirmed
// v3: Injects existing confirmed memories for cross-reference
// Dedup + evidence + dataPointCount fix + parse fix
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callDeepSeek, parseAIJson } from "../_shared/ai.ts";
import {
  authenticateRequest,
  getCorsHeaders,
  jsonResponse,
  getConfirmedMemories,
  getExpressionAssets,
  matchExpressionAssets,
  trackAssetUsage,
  buildMemoryProfile,
} from "../_shared/nancy-context.ts";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const SYSTEM_PROMPT = `你是一个个人成长 AI 助手（Nancy OS Reflection Agent）。你的用户是一位正在自我提升的年轻人。

你会收到用户过去7天的数据（日记、心情记录、想法、事件、任务、习惯记录）。

请用中文分析，返回严格 JSON 格式（不要markdown代码块，直接返回JSON对象）:

{
  "period_summary": "100-150字的中文总结，概括这7天的整体状态与关键事件",
  "mood_trends": {
    "dominant_mood": "最频繁出现的情绪",
    "trend_direction": "improving|stable|declining",
    "detail": "50-80字的情绪变化趋势描述"
  },
  "behavior_patterns": [
    {"pattern": "行为模式描述", "evidence": "支撑证据", "confidence": 0.8}
  ],
  "growth_insights": [
    {"insight": "成长发现", "category": "personal_growth|productivity|emotional|social|health", "confidence": 0.7}
  ],
  "tomorrow_suggestions": [
    {"suggestion": "具体可执行的建议", "priority": "high|medium|low"}
  ],
  "extracted_memories": [
    {
      "memory_type": "preference|personality|habit|insight|skill",
      "content": "记忆内容，用第三人称描述，如：用户偏爱在早晨进行创造性工作",
      "confidence": 0.8,
      "source_ids": ["journal_entry_uuid_1", "mood_record_uuid_2"]
    }
  ]
}

规则:
- behavior_patterns: 0-3条。只提取有明确数据支撑的模式。
- growth_insights: 0-3条。必须是数据驱动的洞察。
- tomorrow_suggestions: 1-3条。具体、可执行、个性化。
- extracted_memories: 0-5条。只提取值得长期记住的发现。
- confidence: 单次提及0.3-0.5，多次重复0.6-0.9。
- 如果某类数据为空，对应数组返回空 []。
- source_ids 必须使用原始数据中的真实 id 字段。
- 重要：对比已有的 confirmed memories，避免重复提取已知模式。
  如果新数据只是印证已有记忆，通过 behavior_patterns 说明强化而非重新提取。`;

// ── Helpers ──

/** Determine memory status based on confidence + reinforcement count */
function computeStatus(
  confidence: number,
  reinforcementCount: number,
  userAction?: string,
): string {
  // User explicitly confirmed or rejected
  if (userAction === "confirm") return "confirmed";
  if (userAction === "reject") return "rejected";

  // Auto-promotion rules
  if (confidence > 0.8 && reinforcementCount >= 3) return "confirmed";
  if (confidence > 0.65 && reinforcementCount >= 2) return "probable";

  // Default
  return "candidate";
}

/** Extract a content prefix for dedup matching */
function contentKey(content: string): string {
  return (content || "").trim().slice(0, 80).toLowerCase();
}

// ── Main ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req, ALLOWED_ORIGINS) });
  }

  const startTime = Date.now();

  try {
    // 1 ─ Authenticate (nancy-context)
    const corsHeaders = getCorsHeaders(req, ALLOWED_ORIGINS);
    const auth = await authenticateRequest(req);
    if (!auth) return jsonResponse({ error: "未登录" }, corsHeaders, 401);
    const { supabase, userId } = auth;

    // 2 ─ Query last 7 days of data
    const today = new Date().toISOString().split("T")[0];
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const sevenDaysAgo = d.toISOString().split("T")[0];

    const [
      { data: journalEntries },
      { data: moodRecords },
      { data: ideas },
      { data: events },
      { data: tasks },
      { data: habitRecords },
      confirmedMemories,
    ] = await Promise.all([
      supabase.from("journal_entries")
        .select("id,date,title,content,mood,energy_level,weather,location,top_three,todos")
        .eq("user_id", userId)
        .gte("date", sevenDaysAgo).lte("date", today)
        .order("date", { ascending: false }),
      supabase.from("mood_records")
        .select("id,date,mood,intensity,trigger_event,time_of_day,energy_level,notes")
        .eq("user_id", userId)
        .gte("date", sevenDaysAgo).lte("date", today)
        .order("date", { ascending: false }),
      supabase.from("ideas")
        .select("id,content,category,status,created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false }),
      supabase.from("events")
        .select("id,title,date,category,description,emotion,reflection")
        .eq("user_id", userId)
        .gte("date", sevenDaysAgo).lte("date", today)
        .order("date", { ascending: false }),
      supabase.from("tasks")
        .select("id,title,status,priority,module,due_date,completed_at,created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false }),
      supabase.from("habit_records")
        .select("id,habit_id,date,status,note,value")
        .eq("user_id", userId)
        .gte("date", sevenDaysAgo).lte("date", today)
        .order("date", { ascending: false }),
      getConfirmedMemories(supabase, userId, { limit: 20 }),
    ]);

    // dataPointCount now includes ALL data sources
    const dataPointCount =
      (journalEntries?.length || 0) +
      (moodRecords?.length || 0) +
      (ideas?.length || 0) +
      (events?.length || 0) +
      (tasks?.length || 0) +
      (habitRecords?.length || 0);

    if (dataPointCount < 2) {
      return jsonResponse({
        error: "insufficient_data",
        message: "过去7天数据不足（至少需要2条记录），多记录一些再来吧。",
        data_points: dataPointCount,
      }, corsHeaders);
    }

    // 3 ─ Build existing memory context for cross-reference (nancy-context)
    const existingMemoryContext = buildMemoryProfile(confirmedMemories, "minimal");

    // ── Historical asset correlation (non-fatal) ──
    // Extract themes from this week's data and find related past experiences
    let historicalAssetContext = "";
    try {
      const eventTitles = (events || []).map((e: Record<string, unknown>) => String(e.title || "")).filter(Boolean);
      const journalTopics = (journalEntries || []).map((j: Record<string, unknown>) =>
        String(j.title || "").slice(0, 60)
      ).filter(Boolean);
      const weekThemes = [...new Set([...eventTitles, ...journalTopics])].join(" ");

      if (weekThemes.length > 5) {
        const assets = await getExpressionAssets(supabase, userId, { limit: 20 });
        const weekMatches = matchExpressionAssets(assets, {
          topic: weekThemes.slice(0, 300),
          scenario: eventTitles.slice(0, 3).join(" "),
        });

        if (weekMatches.length > 0) {
          const lines = ["\n## 历史相关经历（来自表达资产库）"];
          lines.push("以下是用户过去记录的真实经历，可能与本周事件相关。在生成 growth_insights 时，请关联这些长期资产：");
          for (const m of weekMatches.slice(0, 5)) {
            lines.push(`- **${m.title}**（匹配度: ${m.match_score}%）：${m.usage_suggestion}`);
          }
          lines.push("→ 如果本周事件与历史经历有明显关联，请在 behavior_patterns 或 growth_insights 中指出长期模式。");
          historicalAssetContext = lines.join("\n");
          trackAssetUsage(supabase, userId, "reflection", weekMatches);
        }
      }
    } catch (assetErr) {
      console.error("[reflection-agent] historical asset correlation error (non-fatal):", (assetErr as Error).message);
    }

    // 4 ─ Call DeepSeek with existing memory context
    const userData = JSON.stringify({
      period: `${sevenDaysAgo} 至 ${today}`,
      journal_entries: journalEntries || [],
      mood_records: moodRecords || [],
      ideas: ideas || [],
      events: events || [],
      tasks: tasks || [],
      habit_records: habitRecords || [],
    });

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (existingMemoryContext) {
      messages.push({ role: "system", content: existingMemoryContext });
    }

    if (historicalAssetContext) {
      messages.push({ role: "system", content: historicalAssetContext });
    }

    messages.push({ role: "user", content: userData });

    const aiResult = await callDeepSeek(messages, { temperature: 0.5, maxTokens: 4096 });

    if (!aiResult.success) {
      return jsonResponse({ error: aiResult.error, detail: aiResult.detail }, corsHeaders, aiResult.status || 502);
    }

    const tokensUsed: number = aiResult.usage?.totalTokens || 0;

    // 5 ─ Parse AI response (robust: strips text around JSON)
    let analysis: Record<string, unknown>;
    try {
      analysis = parseAIJson<Record<string, unknown>>(aiResult.data);
    } catch {
      return jsonResponse({
        error: "parse_error",
        raw: (aiResult.data as string).slice(0, 500),
        message: "AI 返回格式异常，请重试",
      }, corsHeaders, 500);
    }

    // 6 ─ Build evidence lookup from source_ids
    const allSources = [
      ...(journalEntries || []).map((r: Record<string, unknown>) => ({ table: "journal_entries", id: r.id, snippet: String(r.content || r.title || "").slice(0, 200) })),
      ...(moodRecords || []).map((r: Record<string, unknown>) => ({ table: "mood_records", id: r.id, snippet: `${r.mood} (${r.intensity}/5)${r.trigger_event ? ` — ${r.trigger_event}` : ""}` })),
      ...(ideas || []).map((r: Record<string, unknown>) => ({ table: "ideas", id: r.id, snippet: String(r.content || "").slice(0, 200) })),
      ...(events || []).map((r: Record<string, unknown>) => ({ table: "events", id: r.id, snippet: String(r.title || "") + (r.description ? ` — ${String(r.description).slice(0, 100)}` : "") })),
    ];
    const sourceMap = new Map<string, { table: string; snippet: string }>();
    for (const s of allSources) {
      sourceMap.set(s.id as string, { table: s.table, snippet: s.snippet });
    }

    // 7 ─ Load existing memories for dedup
    const { data: existingMemories } = await supabase
      .from("ai_memories")
      .select("id, memory_type, content, reinforcement_count, confidence, evidence, status")
      .eq("user_id", userId);

    const existingByKey = new Map<string, Record<string, unknown>>();
    for (const m of (existingMemories || [])) {
      const key = `${m.memory_type}::${contentKey(m.content as string)}`;
      existingByKey.set(key, m);
    }

    // 8 ─ Write/update memories with dedup + evidence + status machine
    const memories = (analysis.extracted_memories || []) as Array<Record<string, unknown>>;
    const memoryResults: Array<Record<string, unknown>> = [];

    for (const mem of memories) {
      if (!mem.memory_type || !mem.content) continue;

      const key = `${mem.memory_type}::${contentKey(mem.content as string)}`;
      const existing = existingByKey.get(key);
      const newConfidence = (mem.confidence as number) || 0.5;

      // Build evidence entries for the source_ids in this memory
      const memSourceIds = (mem.source_ids || []) as string[];
      const newEvidence = memSourceIds.map((sid: string) => {
        const src = sourceMap.get(sid);
        return {
          table: src?.table || "unknown",
          source_id: sid,
          snippet: src?.snippet || "",
          extracted_at: today,
        };
      });

      if (existing) {
        // ── DEDUP: Update existing memory ──
        const oldCount = (existing.reinforcement_count as number) || 1;
        const newCount = oldCount + 1;
        const mergedConfidence = Math.max((existing.confidence as number) || 0, newConfidence);
        const mergedEvidence = [
          ...((existing.evidence as Array<Record<string, unknown>>) || []),
          ...newEvidence,
        ].slice(0, 20); // cap evidence entries
        const newStatus = computeStatus(mergedConfidence, newCount);

        const { data: updated } = await supabase
          .from("ai_memories")
          .update({
            confidence: mergedConfidence,
            reinforcement_count: newCount,
            evidence: mergedEvidence,
            status: newStatus,
            is_active: true,
            source_ids: [...new Set([...(existing.source_ids as string[] || []), ...memSourceIds])],
            last_reinforced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id, status, reinforcement_count")
          .single();

        memoryResults.push({
          id: existing.id,
          content: mem.content,
          memory_type: mem.memory_type,
          confidence: mergedConfidence,
          status: newStatus,
          reinforcement_count: newCount,
          action: "updated",
          is_new: false,
        });
      } else {
        // ── NEW: Insert as candidate ──
        const status = computeStatus(newConfidence, 1);

        const { data: inserted, error: insErr } = await supabase
          .from("ai_memories")
          .insert({
            user_id: userId,
            memory_type: mem.memory_type,
            content: mem.content,
            confidence: newConfidence,
            source: `Reflection Agent — ${today}`,
            source_ids: memSourceIds,
            evidence: newEvidence,
            status,
            reinforcement_count: 1,
            is_active: true,
            last_reinforced_at: new Date().toISOString(),
          })
          .select("id, status, reinforcement_count")
          .single();

        if (!insErr && inserted) {
          memoryResults.push({
            id: inserted.id,
            content: mem.content,
            memory_type: mem.memory_type,
            confidence: newConfidence,
            status,
            reinforcement_count: 1,
            action: "created",
            is_new: true,
          });
        }
      }
    }

    const memoryIds = memoryResults.map((r) => r.id).filter(Boolean) as string[];

    // 9 ─ Write AI insight
    const { data: insight } = await supabase
      .from("ai_insights")
      .insert({
        user_id: userId,
        agent_type: "reflection",
        insight_type: "weekly_reflection",
        title: `周反思 · ${sevenDaysAgo} → ${today}`,
        content: analysis.period_summary || "",
        data: {
          mood_trends: analysis.mood_trends,
          behavior_patterns: analysis.behavior_patterns,
          growth_insights: analysis.growth_insights,
          tomorrow_suggestions: analysis.tomorrow_suggestions,
          extracted_memory_ids: memoryIds,
          memory_results: memoryResults,
        },
        generated_at: today,
      })
      .select("id")
      .single();

    // 10 ─ Write agent log
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "reflection",
      action: "weekly_reflection",
      input_data: {
        memory_context_count: confirmedMemories.length,
        memory_context_injected: !!existingMemoryContext,
        journal_count: journalEntries?.length || 0,
        mood_count: moodRecords?.length || 0,
        idea_count: ideas?.length || 0,
        event_count: events?.length || 0,
        task_count: tasks?.length || 0,
        habit_record_count: habitRecords?.length || 0,
        period_start: sevenDaysAgo,
        period_end: today,
      },
      output_data: {
        memory_count: memoryIds.length,
        memory_results: memoryResults,
        insight_id: insight?.id,
        pattern_count: (analysis.behavior_patterns as unknown[])?.length || 0,
        tokens_used: tokensUsed,
      },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });

    // 11 ─ Return
    const duration = Date.now() - startTime;
    return jsonResponse({
      ...analysis,
      extracted_memories: memoryResults,
      tokens_used: tokensUsed,
      memory_ids: memoryIds,
      insight_id: insight?.id,
      duration_ms: duration,
      data_points: dataPointCount,
    }, corsHeaders);

  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : "服务器内部错误",
    }, corsHeaders, 500);
  }
});
