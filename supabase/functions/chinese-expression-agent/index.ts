// ============================================
// Nancy OS — Chinese Expression Training Agent
//
// Actions:
//   analyze_expression  — score + diagnose + improved speech (one-shot)
//   generate_topics     — generate 3 candidate topics
//   extract_material    — extract key points from source text (Phase 2)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import type { DeepSeekMessage } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

// ── Observability ──

function generateRequestId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `ce-${id}`;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── System prompts ──

const ANALYZE_SYSTEM_PROMPT = `你是一位中文表达训练教练。你的任务是分析用户一分钟中文口语表达的录音转录文本。

## 评分体系

你需要从六个维度评分，总分100：

1. **主旨与切题度（满分15）**
   - 0-5：完全跑题或不知所云
   - 6-10：大致沾边但未明确回扣中心
   - 11-15：紧扣主题且有清晰的中心句
   评价标准：是否有明确的主旨句？是否始终围绕核心问题？

2. **结构与逻辑（满分25）**
   - 0-8：无结构、东拉西扯
   - 9-16：有基本分段但逻辑链断裂
   - 17-25：结构清晰（如总分总/PREP/STAR）、逻辑推进自然
   评价标准：是否有清晰的开头-主体-结尾？论点之间是否有逻辑关系？

3. **内容深度（满分20）**
   - 0-6：仅表述表面观点，无递进
   - 7-13：有一点展开但深度不足
   - 14-20：有分析、有推理、有反思、有多角度
   **不评价用户观点是否正确**，只评价是否有解释、推理、例证、影响和反思。

4. **细节与支撑（满分15）**
   - 0-5：全是空泛概括，无具体细节
   - 6-10：有一个具体例子或细节
   - 11-15：有丰富具体细节或生动例证支撑观点

5. **表达清晰度（满分15）**
   - 0-5：大量重复、口头禅、语病、说不清楚
   - 6-10：基本清晰但有不必要的铺垫
   - 11-15：表达简洁有力、用词精当

6. **口语呈现（满分10）**
   - 基于转录统计：
   - 语速是否合理（正常中文语速约180-260字/分钟）
   - 是否在一分钟限时内完成
   - 停顿和口头禅频率
   - 是否有明显的重复

你必须引用转录中的原句来支撑每个维度的评判。

## 表达框架库

从以下五种框架中选择最适合本题和用户内容的一种：

1. **金字塔原理**：结论先行 → 以上统下 → 归类分组 → 逻辑递进
   适合：观点表达、需要说服力的场景

2. **PREP**：Point（观点）→ Reason（理由）→ Example（例子）→ Point（重申观点）
   适合：观点表达、面试回答

3. **SCQA**：Situation（情境）→ Complication（冲突）→ Question（问题）→ Answer（答案）
   适合：分析问题、解释概念

4. **STAR**：Situation（情境）→ Task（任务）→ Action（行动）→ Result（结果）
   适合：经历讲述、面试回答

5. **故事表达**：背景 → 冲突 → 行动 → 结果 → 感受/反思
   适合：故事表达、视频/读书感悟

说明选择该框架的原因（1-2句话）。

## 答案骨架

为用户的本题给出4-6步答案骨架。每步包含：
- 步骤标签（如"结论"、"理由"、"例子"）
- 指引文字（用户这一步应该说什么）
- 建议时间（10-20秒）

## Final Improved Speech（唯一最终优化答案）

基于用户原始内容和所选框架，生成一个优化后的完整表达。

**必须同时满足：**
- 修复结构：套入所选框架
- 深化观点：根据内容深度评分标准提升
- 增加合理细节：根据用户已透露的信息自然延伸
- 补充例子或场景：基于用户的真实经历方向
- 删除重复和无意义的铺垫
- 优化语言：保持口语自然感

**绝对不可：**
- 虚构具体人物姓名、具体学校或公司名称、具体城市、具体时间日期
- 编造用户没有说过的重大经历
- 需要真实细节但用户未提供时，使用概括表达（如"某次项目中"、"一位同事"）

**长度控制：**
- 建议约180-260个汉字，可根据实际语速动态调整
- 确保真实一分钟可以说清楚

## 关键升级点

给出3-5个具体的关键升级说明，每个包含：
- 标题（一句话概括这个升级）
- 描述（原来说了什么 → 升级后做了什么 → 为什么这样更好）

## 口语指标统计

从转录中统计：
- 总字数（去除标点）
- 估算语速（假设录音时长接近60秒）
- 口头禅列表和次数
- 停顿次数

## 输出格式

只返回一个JSON对象，不要有任何其他文字：

{
  "scores": {
    "total": 85,
    "verdict": "一句话总体评价",
    "dimensions": [
      { "name": "主旨与切题度", "score": 12, "max_score": 15, "comment": "...", "quotes": ["..."] },
      { "name": "结构与逻辑", "score": 20, "max_score": 25, "comment": "...", "quotes": ["..."] },
      { "name": "内容深度", "score": 15, "max_score": 20, "comment": "...", "quotes": ["..."] },
      { "name": "细节与支撑", "score": 11, "max_score": 15, "comment": "...", "quotes": ["..."] },
      { "name": "表达清晰度", "score": 13, "max_score": 15, "comment": "...", "quotes": ["..."] },
      { "name": "口语呈现", "score": 7, "max_score": 10, "comment": "...", "quotes": [] }
    ]
  },
  "diagnosis": {
    "top_3_problems": [
      { "problem": "问题名称", "severity": "high", "example": "原句引用", "suggestion": "改进建议" }
    ],
    "framework_reason": "选择该框架的原因",
    "recommended_framework": "prep"
  },
  "answer_outline": [
    { "step": 1, "label": "步骤标签", "guidance": "指引", "time_hint_seconds": 15 }
  ],
  "final_improved_speech": "优化后的完整表达（180-260字）",
  "key_improvements": [
    { "title": "升级标题", "description": "升级说明" }
  ],
  "delivery_metrics": {
    "pace_wpm": 220,
    "pause_count": 3,
    "avg_pause_duration_seconds": 1.5,
    "filler_word_count": 5,
    "filler_words": ["然后", "那个", "就是"],
    "duration_seconds": 58,
    "word_count": 215
  }
}`;

const GENERATE_TOPICS_PROMPT = `你是一位中文表达训练教练。根据用户选择的话题类型，生成多样化的练习题目。

## 话题类型
- opinion（观点表达）：对热点话题表达观点和立场
- experience（经历讲述）：讲述真实经历
- concept（概念解释）：解释一个概念或原理
- reflection（视频/读书感悟）：分享对内容的感受和思考
- interview（面试回答）：模拟面试场景
- story（故事表达）：讲一个生动的故事

## 要求
- 每个题目适合一分钟口头表达
- 题目开放，有讨论空间
- 语言简洁有吸引力
- 每个题目附带一个简短描述说明为什么值得练习

## 输出格式
{
  "topics": [
    { "topic": "题目文本", "topic_type": "opinion", "description": "简短描述" }
  ]
}`;

// ── Main handler ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed", requestId: generateRequestId() }, 405);
  }

  const requestId = generateRequestId();
  const t0 = Date.now();
  let action = "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    action = (body.action as string) || "";
    const authHeader = req.headers.get("Authorization") || "";

    console.log(`[chinese-expression-agent] ${requestId} start action=${action || "(empty)"}`);

    // ── Authenticate user ──
    let userId = "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id || "";
    }

    switch (action) {
      // ── Analyze Expression ──
      case "analyze_expression": {
        const topic = (body.topic as string) || "";
        const topicType = (body.topic_type as string) || "";
        const transcript = (body.transcript as string) || "";
        const attemptRound = (body.attempt_round as number) || 1;

        if (!topic || !transcript) {
          return jsonResponse(req, {
            success: false,
            stage: "payload",
            error: "缺少话题或转录文本",
            requestId,
          }, 400);
        }

        const userMessage = [
          `## 话题`,
          `题目：${topic}`,
          topicType ? `类型：${topicType}` : "",
          `轮次：第${attemptRound}轮`,
          ``,
          `## 转录文本`,
          transcript,
        ].filter(Boolean).join("\n");

        const messages: DeepSeekMessage[] = [
          { role: "system", content: ANALYZE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ];

        console.log(`[chinese-expression-agent] ${requestId} calling deepseek for analyze_expression`);
        const result = await aiRuntime<Record<string, unknown>>(messages, {
          agentName: "chinese-expression-agent",
          maxTokens: 4096,
          temperature: 0.3,
          timeout: 120_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} aiRuntime failed stage=${result.stage} error=${result.error}`);
          return jsonResponse(req, {
            success: false,
            stage: result.stage,
            error: result.error,
            detail: result.detail,
            requestId,
          }, httpStatus);
        }

        // Log
        if (userId) {
          await supabase.from("agent_logs").insert({
            user_id: userId,
            agent_type: "chinese_expression",
            action: "analyze_expression",
            input_data: { topic, topic_type: topicType, transcript_length: transcript.length, attempt_round: attemptRound },
            output_data: {
              total: (result.data.scores as Record<string, unknown>)?.total,
              framework: (result.data.diagnosis as Record<string, unknown>)?.recommended_framework,
            },
          }).catch(() => {});
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=analyze_expression elapsedMs=${elapsedMs}`);
        return jsonResponse(req, { success: true, data: result.data, requestId, elapsedMs });
      }

      // ── Generate Topics ──
      case "generate_topics": {
        const topicType = (body.topic_type as string) || "";
        const count = (body.count as number) || 3;

        const userMessage = [
          topicType ? `请生成${count}个"${topicType}"类型的一分钟表达练习题目。` : `请生成${count}个多样化的一分钟表达练习题目。`,
          `每个题目附带topic_type字段。`,
        ].join("\n");

        const messages: DeepSeekMessage[] = [
          { role: "system", content: GENERATE_TOPICS_PROMPT },
          { role: "user", content: userMessage },
        ];

        console.log(`[chinese-expression-agent] ${requestId} calling deepseek for generate_topics`);
        const result = await aiRuntime<{ topics: Array<{ topic: string; topic_type: string; description: string }> }>(messages, {
          agentName: "chinese-expression-agent",
          maxTokens: 2048,
          temperature: 0.8,
          timeout: 60_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} aiRuntime failed stage=${result.stage} error=${result.error}`);
          return jsonResponse(req, {
            success: false,
            stage: result.stage,
            error: result.error,
            detail: result.detail,
            requestId,
          }, httpStatus);
        }

        if (userId) {
          await supabase.from("agent_logs").insert({
            user_id: userId,
            agent_type: "chinese_expression",
            action: "generate_topics",
            input_data: { topic_type: topicType, count },
          }).catch(() => {});
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=generate_topics elapsedMs=${elapsedMs}`);
        return jsonResponse(req, { success: true, data: result.data, requestId, elapsedMs });
      }

      // ── Extract Material (Phase 2) ──
      case "extract_material": {
        const sourceText = (body.source_text as string) || "";

        if (!sourceText) {
          return jsonResponse(req, {
            success: false,
            stage: "payload",
            error: "缺少材料文本",
            requestId,
          }, 400);
        }

        const truncatedText = sourceText.length > 6000 ? sourceText.slice(0, 6000) + "\n\n[文本已截断...]" : sourceText;

        const messages: DeepSeekMessage[] = [
          {
            role: "system",
            content: `你是一位内容提炼专家。阅读用户提供的材料，提炼核心观点，并生成一个适合一分钟口头复述的任务。

## 输出格式
{
  "summary": "材料概要（2-3句话）",
  "key_points": ["关键点1", "关键点2", "关键点3"],
  "retelling_prompt": "一分钟复述题目",
  "retelling_angle": "建议的复述角度"
}`,
          },
          { role: "user", content: truncatedText },
        ];

        console.log(`[chinese-expression-agent] ${requestId} calling deepseek for extract_material`);
        const result = await aiRuntime<Record<string, unknown>>(messages, {
          agentName: "chinese-expression-agent",
          maxTokens: 2048,
          temperature: 0.3,
          timeout: 90_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} aiRuntime failed stage=${result.stage} error=${result.error}`);
          return jsonResponse(req, {
            success: false,
            stage: result.stage,
            error: result.error,
            detail: result.detail,
            requestId,
          }, httpStatus);
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=extract_material elapsedMs=${elapsedMs}`);
        return jsonResponse(req, { success: true, data: result.data, requestId, elapsedMs });
      }

      default: {
        console.warn(`[chinese-expression-agent] ${requestId} unknown action="${action}"`);
        return jsonResponse(req, {
          success: false,
          stage: "payload",
          error: `Unknown action: ${action}`,
          requestId,
        }, 400);
      }
    }
  } catch (err) {
    const elapsedMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : "Internal error";

    // Classify: timeout vs internal
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error(`[chinese-expression-agent] ${requestId} timeout action=${action} elapsedMs=${elapsedMs}`);
      return jsonResponse(req, {
        success: false,
        stage: "internal",
        error: "请求处理超时",
        detail: String(message),
        requestId,
      }, 504);
    }

    console.error(`[chinese-expression-agent] ${requestId} unhandled error action=${action} elapsedMs=${elapsedMs}`, message);
    return jsonResponse(req, {
      success: false,
      stage: "internal",
      error: message,
      requestId,
    }, 500);
  }
});
