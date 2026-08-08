// ============================================
// Nancy OS — Chinese Expression Training Agent V4
//
// Architecture:
//   analyze_expression    — single AI call: diagnosis + optional material_understanding
//   generate_reference    — on-demand: full improved speech (user explicitly requests)
//   compare_rounds        — evidence-based Round 1 vs Round 2 comparison
//   generate_topics       — generate 3 candidate topics
//   extract_material      — V2: expression-focused material analysis
//   generate_material_questions — generate training questions from material
//
// V4 Skill architecture (skills.ts):
//   COMMON_COACH_RULES + ONE Skill (loaded by topic_type, never all 6)
//   + QUESTION + TRANSCRIPT + DELIVERY_METRICS + OUTPUT_SCHEMA
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import type { DeepSeekMessage } from "../_shared/ai.ts";
import {
  buildDiagnosisSystemPrompt,
  buildDiagnosisUserMessage,
  verifyAllSkills,
} from "./skills.ts";

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
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
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

// ── Delivery metrics computation ──

function computeDeliveryMetrics(transcript: string, durationSeconds: number, targetDurationSeconds = 60) {
  const cleaned = transcript.replace(/[^一-鿿\w]/g, "");
  const transcriptChars = cleaned.length;
  const charsPerMinute = durationSeconds > 0 ? Math.round(transcriptChars / (durationSeconds / 60)) : 0;
  const overtimeSeconds = Math.max(0, durationSeconds - targetDurationSeconds);

  const fillerPatterns = ["然后", "那个", "就是", "这个", "嗯", "啊", "呃", "吧", "嘛", "所以", "就是说", "怎么说呢", "然后呢", "而且"];
  const fillerBreakdown: Record<string, number> = {};
  for (const fw of fillerPatterns) {
    const escaped = fw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (transcript.match(new RegExp(escaped, "g")) || []).length;
    if (count > 0) fillerBreakdown[fw] = count;
  }

  const fillerWords = Object.keys(fillerBreakdown);
  const fillerTotal = Object.values(fillerBreakdown).reduce((a, b) => a + b, 0);

  return {
    // V4 fields (used by buildDiagnosisUserMessage)
    duration_seconds: durationSeconds,
    target_duration_seconds: targetDurationSeconds,
    overtime_seconds: overtimeSeconds,
    transcript_chars: transcriptChars,
    chars_per_minute: charsPerMinute,
    filler_total: fillerTotal,
    filler_breakdown: fillerBreakdown,
    // Legacy fields (used by client DeliveryMetrics type)
    pace_wpm: charsPerMinute,
    pause_count: null,
    avg_pause_duration_seconds: null,
    filler_word_count: fillerTotal,
    filler_words: fillerWords,
    word_count: transcriptChars,
  };
}

// ═══════════════════════════════════════════
// Prompt Architecture (V4 — skills.ts, skill-based)
//
// COMMON_COACH_RULES, 6 full Skills, and Output Schema
// are imported from ./skills.ts.
// Only ONE skill is loaded per analysis (never all 6).
// ═══════════════════════════════════════════

// ── D. Rewrite Prompt (for generate_reference) ──

const REWRITE_SYSTEM_PROMPT = `你是一名中文口语表达编辑。

你将收到：原始题目、用户真实转录、思辨诊断结果（含 content_deepening 内容深度分析）、推荐结构、可以使用的用户真实信息。

请生成唯一一份"优化表达参考"。

这不是标准作文，也不是替用户创造一个更正确的立场，而是帮助用户用更清晰、更有深度、更真实的方式表达自己的想法。

━━━━━━━━━━━━━━━━━━
核心原则：80/20 内容增强
━━━━━━━━━━━━━━━━━━

80% 保留用户的原始内容：
- 用户的立场和核心观点
- 用户的真实经历（如已提供）
- 用户的表达风格和语言习惯
- 用户自己的判断和价值观

20% 内容增强，基于诊断中 content_deepening 的 missing_elements：
- 补充缺失的信息类型（证据、因果链、场景细节等）
- 强化薄弱的推理环节
- 增加必要的具体性

禁止：
- 生成与用户原始表达完全不同的内容
- 编造用户没有提供的经历
- 把回答变成通用励志演讲
- 突然拔高到与用户身份不符的哲学高度
- 用AI式的排比和金句替代真实表达

━━━━━━━━━━━━━━━━━━
写作要求
━━━━━━━━━━━━━━━━━━

1. 保留用户核心立场。可以让立场更准确、更有边界，但不得无理由改成相反观点。

2. 内容增强（基于 content_deepening 分析）。
优先补充诊断中指出的缺失元素：
- 如果缺少证据 → 加入用户可能经历过的具体场景（用一般性假设，不编造个人经历）
- 如果缺少因果链 → 补充从原因到结论的中间推理步骤
- 如果缺少边界条件 → 加入观点成立的前提条件
- 如果缺少场景细节 → 加入让听众能"看见"的具体描述
- 如果缺少冲突 → 加入决策中的犹豫和选择过程

3. 禁止编造经历。
不得增加用户没有提供的：朋友、公司、学校、城市、工作、证书、家庭事件、明确的个人经历。
用户没有提供真实例子时，可以使用一般性假设："比如，一个人如果……""假设你面对……"
不能写："我有一位朋友……""我曾在……"

4. 自然口语。整段必须像一个真实的人在面试或讨论中说话。
避免：首先其次最后的机械重复、综上所述、我坚信、随着社会的发展、在当今社会、空泛口号、过度工整的AI式排比。

5. 结构清晰但不僵硬。听众应能感受到：核心观点、理由、支撑、思辨层次、收束。不需要显式标注每个结构名称。

6. 长度控制。控制在180—260个汉字左右，适合正常语速下约一分钟表达。

7. 不替用户装成熟。内容可以更深入，但不要使用明显超出用户身份和真实经验的专业论断。

8. 内容增强比修辞润色更重要。宁可语言稍显朴素但内容充实，也不要语言华丽但内容空洞。

9. 只输出合法JSON，不得使用Markdown。

━━━━━━━━━━━━━━━━━━
输出结构
━━━━━━━━━━━━━━━━━━

{
  "improved_speech": "唯一一份内容增强版口语参考答案",
  "content_additions": [
    { "type": "evidence|causality|boundary|scene|conflict|example|definition", "what_was_added": "新增了什么内容元素", "why_added": "为什么对当前题型需要这个元素" }
  ],
  "thought_features": [
    { "type": "definition | condition | tradeoff | counterpoint | boundary | causality", "used_in_sentence": "答案中对应的内容", "purpose": "这一层思考解决了什么问题" }
  ],
  "key_upgrades": [
    { "category": "升级类别", "original_expression": "用户原始表达中的原句，必须逐字引用transcript", "problem_analysis": "为什么这个表达不足", "optimized_expression": "优化后的自然表达", "upgrade_reason": "这个修改如何提升表达质量" }
  ],
  "deepening_suggestions": [
    "进一步深化思考的建议"
  ],
  "thinking_lenses_used": ["实际使用的思辨镜头名称"],
  "authenticity": {
    "fabricated_details": false,
    "general_hypothetical_used": true,
    "missing_real_detail_slots": ["下一次可以补充的真实经历"]
  }
}`;

// ── E. Comparison Prompt (unchanged) ──

const COMPARISON_SYSTEM_PROMPT = `你是一名中文表达训练复盘教练。

请比较用户同一道题的第一次表达和第二次表达。

评价必须基于两份真实转录和系统提供的口语指标。
不要默认第二次一定更好。第二次也可能出现退步。

重点比较：
1. 核心观点是否更早、更清楚；
2. 结构和论证链是否更完整；
3. 是否增加了定义、条件、权衡、反面或边界；
4. 例子是否更真实具体；
5. 重复、口头禅和模糊表达是否减少；
6. 是否在规定时间内完成；
7. 第二次是否过度照搬AI参考答案。

每个分数变化必须给出证据。
不得只输出"进步明显""结构更清晰"。

## improvement_quality 分类规则

你必须输出 improvement_quality 字段，按以下规则判断：

- "internalized" — 内容分和口语呈现分都提升或持平，用户真正内化了改进
- "content_better_delivery_worse" — 内容质量提升但口语呈现下降（特别是语速明显加快、口头禅增多），用户为了塞入更多内容牺牲了表达质量
- "delivery_better_content_flat" — 口语呈现改善但内容分数没有明显提升
- "reference_imitation_possible" — 用户查看了完整参考答案后，总分大幅提升，可能包含模仿因素
- "mixed" — 部分维度提升、部分下降，没有一致方向
- "no_clear_improvement" — 两次表达差异很小，没有明确进步或退步

特别注意：如果 content 分数 ↑ 但 chars_per_minute 大幅 ↑，必须判断为 content_better_delivery_worse，并在 analysis 中建议删减次要内容而非继续加速。

如果用户查看过完整参考答案，且在 improvement_quality 中判断可能包含模仿因素时，必须使用 reference_imitation_possible。

## 输出格式

只输出合法JSON，不得使用Markdown代码围栏。

{
  "improvement_quality": "internalized|content_better_delivery_worse|delivery_better_content_flat|reference_imitation_possible|mixed|no_clear_improvement",
  "improvement_analysis": "对improvement_quality的1-2句解释",
  "dimension_changes": [
    { "dimension": "维度名称", "round1_score": 10, "round2_score": 15, "delta": 5, "round1_evidence": "第一次原句", "round2_evidence": "第二次原句", "explanation": "为什么提升" }
  ],
  "progress_points": [
    { "area": "进步领域", "detail": "具体表现" }
  ],
  "remaining_issues": [
    { "area": "待改进领域", "detail": "具体表现", "suggestion": "建议" }
  ],
  "reference_dependency": {
    "full_reference_viewed": false,
    "interpretation": "本轮主要依靠答案骨架完成"
  },

  "knowledge_transfer_growth": {
    "overall_delta": 0,
    "stage_deltas": [
      { "stage": "knowledge_understanding", "delta": 0, "interpretation": "解释变化原因" },
      { "stage": "knowledge_processing", "delta": 0, "interpretation": "解释变化原因" },
      { "stage": "personal_connection", "delta": 0, "interpretation": "解释变化原因" },
      { "stage": "expression_transfer", "delta": 0, "interpretation": "解释变化原因" }
    ],
    "growth_summary": "1-2句话总结知识转化能力的变化。例如：'重新表达后知识转化总分从65提升到78。最大的进步在个人连接维度（+15），因为第二次表达中用户加入了具体的亲身经历。知识理解维度变化最小（+2），这在预期范围内——短时间内对材料的理解不会发生根本改变。'"
  }
}`;

// ── F. Topic Generation Prompt (unchanged) ──

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

// ═══════════════════════════════════════════
// Startup: verify all 6 Skill routes (no cross-contamination)
// ═══════════════════════════════════════════

const skillVerification = verifyAllSkills();
console.log(`[chinese-expression-agent] Skill verification: ${skillVerification.allPassed ? "ALL PASSED" : "SOME FAILED"}`);
for (const r of skillVerification.results) {
  console.log(`[chinese-expression-agent]   ${r.topicType}: ${r.passed ? "PASS" : "FAIL"} (${r.promptChars} chars)${r.doesNotContainForbidden.length > 0 ? ` forbidden: ${r.doesNotContainForbidden.join(", ")}` : ""}`);
}

// ═══════════════════════════════════════════
// Main Handler
// ═══════════════════════════════════════════

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

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    console.error(`[chinese-expression-agent] ${requestId} failed to parse request body`);
    return jsonResponse(req, {
      success: false, stage: "payload", error: "请求体格式错误，需要有效的 JSON", requestId,
    }, 400);
  }

  action = (body.action as string) || "";
  console.log(`[chinese-expression-agent] ${requestId} start action=${action || "(empty)"}`);

  // ── Auth (non-fatal) ──
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let userId = "";

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id || "";
    }
  } catch (authErr) {
    console.error(`[chinese-expression-agent] ${requestId} auth error (non-fatal):`, (authErr as Error).message);
  }

  try {

    switch (action) {

      // ═══════════════════════════════════════
      // V3: Analyze Expression — diagnosis only (single AI call)
      // ═══════════════════════════════════════
      case "analyze_expression": {
        const topic = (body.topic as string) || "";
        const topicType = (body.topic_type as string) || "opinion";
        const transcript = (body.transcript as string) || "";
        const attemptRound = (body.attempt_round as number) || 1;
        const durationSeconds = (body.duration_seconds as number) || 60;
        const targetDurationSeconds = (body.target_duration_seconds as number) || 60;
        const materialContext = body.material_context as Record<string, unknown> | undefined;

        if (!topic || !transcript) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少话题或转录文本", requestId,
          }, 400);
        }

        const deliveryMetrics = computeDeliveryMetrics(transcript, durationSeconds, targetDurationSeconds);

        // Build prompt via skills.ts: COMMON + ONE skill + output schema
        const systemPrompt = buildDiagnosisSystemPrompt(topicType, !!materialContext);
        const userMessage = buildDiagnosisUserMessage({
          topic,
          topicType,
          transcript,
          attemptRound,
          deliveryMetrics,
          materialContext,
        });

        const promptLen = systemPrompt.length;
        const msgLen = userMessage.length;
        console.log(`[chinese-expression-agent] ${requestId} stage=diagnosis_start topicType=${topicType} hasMaterial=${!!materialContext} promptLen=${promptLen} msgLen=${msgLen} totalChars=${promptLen + msgLen}`);

        const diagnosisMessages: DeepSeekMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ];

        const result = await aiRuntime<Record<string, unknown>>(diagnosisMessages, {
          agentName: "chinese-expression-agent",
          maxTokens: 4096,
          temperature: 0.3,
          timeout: 90_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} diagnosis failed stage=${result.stage} error=${result.error}`);
          return jsonResponse(req, {
            success: false, stage: result.stage, error: result.error, detail: result.detail, requestId,
          }, httpStatus);
        }

        const diagnosis = result.data;
        const overall = diagnosis.overall as Record<string, unknown> | undefined;
        console.log(`[chinese-expression-agent] ${requestId} stage=diagnosis_done overall_score=${overall?.score}`);

        // ── Integrity check ──
        const factConsistency = diagnosis.fact_consistency as Record<string, unknown> | undefined;
        if (factConsistency?.status === "needs_confirmation") {
          console.warn(`[chinese-expression-agent] ${requestId} fact consistency check — needs_confirmation`);
        }

        // ── Agent log ──
        const aiPromptVersion = `chinese-v4/${topicType}@2`;
        if (userId) {
          try {
            await supabase.from("agent_logs").insert({
              user_id: userId,
              agent_type: "chinese_expression",
              action: "analyze_expression",
              input_data: { topic, topic_type: topicType, transcript_length: transcript.length, attempt_round: attemptRound, has_material: !!materialContext },
              output_data: {
                overall_score: overall?.score,
                recommended_structure: (diagnosis.recommended_structure as Record<string, unknown>)?.name,
                version: aiPromptVersion,
              },
              model: "deepseek-chat",
              tokens_used: result.usage?.totalTokens || 0,
            });
          } catch (logEx) {
            console.error(`[chinese-expression-agent] ${requestId} agent_logs error:`, (logEx as Error).message);
          }
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=analyze_expression elapsedMs=${elapsedMs}`);

        return jsonResponse(req, {
          success: true,
          data: { diagnosis, delivery_metrics: deliveryMetrics },
          requestId,
          elapsedMs,
        });
      }

      // ═══════════════════════════════════════
      // V3: Generate Reference — on-demand full speech
      // ═══════════════════════════════════════
      case "generate_reference": {
        const topic = (body.topic as string) || "";
        const transcript = (body.transcript as string) || "";
        const diagnosis = (body.diagnosis as Record<string, unknown>) || {};

        if (!topic || !transcript || !diagnosis || Object.keys(diagnosis).length === 0) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少话题、转录文本或诊断结果", requestId,
          }, 400);
        }

        // Extract relevant diagnosis fields for rewrite context (V4 format)
        const overall = diagnosis.overall as Record<string, unknown> | undefined;
        const rewriteContext = {
          overall_score: overall?.score,
          overall_judgment: overall?.summary,
          top_issues: diagnosis.top_issues,
          recommended_structure: diagnosis.recommended_structure,
          thinking_or_deepening: diagnosis.thinking_or_deepening,
          answer_outline: diagnosis.answer_outline,
        };

        const userMessage = [
          `## 原始题目`,
          topic,
          ``,
          `## 用户真实转录`,
          transcript,
          ``,
          `## 思辨诊断结果`,
          JSON.stringify(rewriteContext, null, 2),
          ``,
          `请生成优化表达参考。`,
        ].join("\n");

        console.log(`[chinese-expression-agent] ${requestId} stage=generate_reference_start promptLen=${REWRITE_SYSTEM_PROMPT.length} msgLen=${userMessage.length}`);

        const rewriteMessages: DeepSeekMessage[] = [
          { role: "system", content: REWRITE_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ];

        const result = await aiRuntime<Record<string, unknown>>(rewriteMessages, {
          agentName: "chinese-expression-agent",
          maxTokens: 2048,
          temperature: 0.4,
          timeout: 60_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} generate_reference failed stage=${result.stage} error=${result.error}`);
          return jsonResponse(req, {
            success: false, stage: result.stage, error: result.error, detail: result.detail, requestId,
          }, httpStatus);
        }

        const rewrite = result.data;

        // Integrity check
        const rewriteAuth = rewrite.authenticity as Record<string, unknown> | undefined;
        if (rewriteAuth?.fabricated_details === true) {
          console.warn(`[chinese-expression-agent] ${requestId} generate_reference: fabrication detected, flagging`);
          rewrite.integrity_failed = true;
        }

        console.log(`[chinese-expression-agent] ${requestId} stage=generate_reference_done`);

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=generate_reference elapsedMs=${elapsedMs}`);

        return jsonResponse(req, {
          success: true,
          data: { reference: rewrite },
          requestId,
          elapsedMs,
        });
      }

      // ═══════════════════════════════════════
      // Phase 3.2: Compare Rounds — with Knowledge Transfer Growth
      // ═══════════════════════════════════════
      case "compare_rounds": {
        const topic = (body.topic as string) || "";
        const round1Transcript = (body.round1_transcript as string) || "";
        const round2Transcript = (body.round2_transcript as string) || "";
        const round1Scores = body.round1_scores as Record<string, unknown> | null;
        const round2Scores = body.round2_scores as Record<string, unknown> | null;
        const round1Delivery = body.round1_delivery as Record<string, unknown> | null;
        const round2Delivery = body.round2_delivery as Record<string, unknown> | null;
        const fullReferenceViewed = (body.full_reference_viewed as boolean) || false;
        const round1KT = body.round1_knowledge_transfer as Record<string, unknown> | null;
        const round2KT = body.round2_knowledge_transfer as Record<string, unknown> | null;

        if (!round1Transcript || !round2Transcript) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少两轮转录文本", requestId,
          }, 400);
        }

        const hasKT = round1KT && round2KT;

        const compareUserMessage = [
          `## 题目`, topic, ``,
          `## 第一次表达转录`, round1Transcript, ``,
          `## 第二次表达转录`, round2Transcript, ``,
          `## 第一次评分`, round1Scores ? JSON.stringify(round1Scores) : "无", ``,
          `## 第二次评分`, round2Scores ? JSON.stringify(round2Scores) : "无", ``,
          `## 第一次口语指标`, round1Delivery ? JSON.stringify(round1Delivery) : "无", ``,
          `## 第二次口语指标`, round2Delivery ? JSON.stringify(round2Delivery) : "无", ``,
          `## 参考信息`,
          `用户查看了完整参考答案：${fullReferenceViewed ? "是" : "否"}`,
          ``,
          hasKT ? `## 第一次知识转化\n${JSON.stringify(round1KT)}\n\n## 第二次知识转化\n${JSON.stringify(round2KT)}\n\n请同时输出 knowledge_transfer_growth 字段，分析两轮之间的知识转化能力变化。` : ``,
          `请特别注意：如果第二轮内容分数上升但语速(chars_per_minute)明显加快或口头禅增多，`,
          `必须将improvement_quality判断为content_better_delivery_worse。`,
        ].join("\n");

        const compareMessages: DeepSeekMessage[] = [
          { role: "system", content: COMPARISON_SYSTEM_PROMPT },
          { role: "user", content: compareUserMessage },
        ];

        console.log(`[chinese-expression-agent] ${requestId} stage=compare_rounds_start hasKT=${hasKT}`);
        const result = await aiRuntime<Record<string, unknown>>(compareMessages, {
          agentName: "chinese-expression-agent",
          maxTokens: 3072,
          temperature: 0.3,
          timeout: 90_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} compare_rounds failed stage=${result.stage}`);
          return jsonResponse(req, {
            success: false, stage: result.stage, error: result.error, detail: result.detail, requestId,
          }, httpStatus);
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=compare_rounds elapsedMs=${elapsedMs}`);
        return jsonResponse(req, { success: true, data: result.data, requestId, elapsedMs });
      }

      // ═══════════════════════════════════════
      // Generate Topics (unchanged)
      // ═══════════════════════════════════════
      case "generate_topics": {
        const topicType = (body.topic_type as string) || "";
        const count = (body.count as number) || 3;

        const userMessage = [
          topicType
            ? `请生成${count}个"${topicType}"类型的一分钟表达练习题目。`
            : `请生成${count}个多样化的一分钟表达练习题目。`,
          `每个题目附带topic_type字段。`,
        ].join("\n");

        const messages: DeepSeekMessage[] = [
          { role: "system", content: GENERATE_TOPICS_PROMPT },
          { role: "user", content: userMessage },
        ];

        console.log(`[chinese-expression-agent] ${requestId} stage=generate_topics_start`);
        const result = await aiRuntime<{ topics: Array<{ topic: string; topic_type: string; description: string }> }>(messages, {
          agentName: "chinese-expression-agent",
          maxTokens: 2048,
          temperature: 0.8,
          timeout: 60_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} generate_topics failed`);
          return jsonResponse(req, {
            success: false, stage: result.stage, error: result.error, detail: result.detail, requestId,
          }, httpStatus);
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=generate_topics elapsedMs=${elapsedMs}`);
        return jsonResponse(req, { success: true, data: result.data, requestId, elapsedMs });
      }

      // ═══════════════════════════════════════
      // Phase 3.1: Extract Material — Material Card generation
      // Output: material_card stored in resources.ai_analysis
      // ═══════════════════════════════════════
      case "extract_material": {
        const sourceText = (body.source_text as string) || "";
        const sourceType = (body.source_type as string) || "article";

        if (!sourceText) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少材料文本", requestId,
          }, 400);
        }

        const truncatedText = sourceText.length > 8000 ? sourceText.slice(0, 8000) + "\n\n[文本已截断...]" : sourceText;

        const sourceTypeLabel = sourceType === "video_reflection" ? "视频感悟" : sourceType === "book_note" ? "读书笔记" : "文章";

        const messages: DeepSeekMessage[] = [
          {
            role: "system",
            content: `你是一名中文表达训练教练。

你的任务不是总结文章，而是帮助用户把输入材料转化为"可表达的知识"。

━━━━━━━━━━━━━━━━━━━━
核心原则
━━━━━━━━━━━━━━━━━━━━

1. 你不是内容摘要助手。你是一对一表达教练。
2. 你的每一个输出都必须服务于：用户站在台上，用一分钟时间，向别人清晰表达自己对这份材料的理解。
3. 不要泛泛总结。不要罗列信息。不要生成百科介绍。
4. 你提取的内容必须能支撑用户完成"观点表达""概念解释""经历讲述"或"故事表达"。

━━━━━━━━━━━━━━━━━━━━
输出结构：Material Card
━━━━━━━━━━━━━━━━━━━━

你必须输出以下 JSON 结构：

{
  "material_card": {
    "title": "材料标题",
    "source_type": "${sourceTypeLabel}",
    "source_summary": "2-3句话概述。不要复述目录。要回答：这份材料到底在讨论什么问题？为什么值得关注？",

    "core_argument": "这个材料最核心想表达什么？用1-2句话准确反映材料作者的立场。不是你的理解，是作者的真实立场。",

    "key_arguments": [
      {
        "point": "核心论点（一句话）",
        "explanation": "这个论点为什么成立？材料中提供了什么理由？",
        "example": "材料中用来支撑这个论点的具体案例或场景"
      }
    ],

    "key_examples": [
      {
        "case": "案例或场景的简要描述",
        "meaning": "这个案例说明了什么问题？为什么它值得记住？",
        "can_use_in_expression": "例如：用于回答'如何面对他人评价'或'什么是真正的自由'"
      }
    ],

    "expression_angles": [
      {
        "angle": "表达角度名称（如：成年人如何摆脱他人评价？）",
        "recommended_skill": "opinion|experience|concept|reflection|story",
        "possible_question": "可以用于一分钟训练的完整问题（不超过40字）"
      }
    ],

    "recommended_skill": "opinion|experience|concept|reflection|story|application",
    "training_reason": "为什么推荐这个技能？例如：这份材料最有价值的部分是它的核心论点，适合让用户形成自己的立场并练习论证能力。"
  }
}

━━━━━━━━━━━━━━━━━━━━
数量约束
━━━━━━━━━━━━━━━━━━━━

- key_arguments：3-5条（每条的 explanation 和 example 必须具体，不能泛泛而谈）
- key_examples：1-3个（宁缺毋滥。如果材料中的案例不够鲜明，可以减少数量但提高质量）
- expression_angles：3-5个（每个角度必须指向不同的表达技能。覆盖至少3种不同的 recommended_skill）
- recommended_skill：从以下6种中选择：opinion（观点表达）、experience（经历讲述）、concept（概念解释）、reflection（感悟分享）、story（故事表达）、application（应用连接）

━━━━━━━━━━━━━━━━━━━━
表达角度生成原则
━━━━━━━━━━━━━━━━━━━━

每个表达角度必须满足：
1. 有不同的 recommended_skill（不要5个角度都是 opinion）
2. possible_question 是完整的一分钟表达题目（不是话题标签）
3. angle 是一句话的描述，让用户一眼能看出"这个方向我要说什么"

角度多样性检查清单：
- 是否有一个纯观点表达的角度？（你同意/不同意作者？）
- 是否有一个概念解释的角度？（材料中的某个概念如何通俗解释？）
- 是否有一个个人连接的角度？（你是否有类似的经历？）
- 是否有一个应用实践的角度？（这个观点如何改变你的行为？）
- 是否有一个批判思辨的角度？（作者的观点在什么条件下不成立？）

━━━━━━━━━━━━━━━━━━━━
禁止事项
━━━━━━━━━━━━━━━━━━━━

禁止：
- 把材料总结成百科条目
- key_arguments 只有 bullet list 没有 explanation 和 example
- expression_angles 全部指向同一种技能
- key_examples 泛泛而谈（如"书中举了很多例子"）
- recommended_skill 与 expression_angles 的分布不一致
- 输出 Markdown 代码围栏或非 JSON 内容`,
          },
          { role: "user", content: `## 材料类型：${sourceTypeLabel}\n\n## 材料内容\n\n${truncatedText}` },
        ];

        console.log(`[chinese-expression-agent] ${requestId} stage=extract_material_start sourceType=${sourceType} textLen=${truncatedText.length}`);
        const result = await aiRuntime<Record<string, unknown>>(messages, {
          agentName: "chinese-expression-agent",
          maxTokens: 3072,
          temperature: 0.3,
          timeout: 120_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} extract_material failed stage=${result.stage}`);
          return jsonResponse(req, {
            success: false, stage: result.stage, error: result.error, detail: result.detail, requestId,
          }, httpStatus);
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=extract_material elapsedMs=${elapsedMs}`);
        return jsonResponse(req, { success: true, data: result.data, requestId, elapsedMs });
      }

      // ═══════════════════════════════════════
      // Phase 3.1: Generate Material Questions — from Material Card
      // Supports optional angle selection for targeted question generation
      // ═══════════════════════════════════════
      case "generate_material_questions": {
        const materialCardInput = body.material_card as Record<string, unknown> | null;

        if (!materialCardInput) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少 Material Card", requestId,
          }, 400);
        }

        const selectedAngle = materialCardInput.selected_angle as Record<string, unknown> | undefined;
        const materialCard = materialCardInput.material_card as Record<string, unknown>;

        const angleContext = selectedAngle
          ? `\n\n## 用户选择的表达角度\n角度：${selectedAngle.angle || ""}\n推荐技能：${selectedAngle.recommended_skill || ""}\n角度对应的问题：${selectedAngle.possible_question || ""}\n\n请围绕用户选择的这个角度生成问题。问题应该与这个角度的技能类型（${selectedAngle.recommended_skill || "opinion"}）高度相关。`
          : "";

        const messages: DeepSeekMessage[] = [
          {
            role: "system",
            content: `你是一名中文表达训练教练。

根据 Material Card 的内容，生成3个适合一分钟口语表达的训练问题。

## Material Card 包含的信息
- core_argument：材料核心观点
- key_arguments：核心论点（含解释和案例）
- key_examples：可用于表达的关键案例
- expression_angles：AI推荐的表达角度（每个角度有推荐的技能类型）
- recommended_skill：AI推荐的最佳训练技能

## 问题类型
- **opinion（观点表达）**：对材料中的观点表达自己的立场，适合训练论证和思辨能力
- **explanation（概念解释）**：解释材料中的某个概念或原理，适合训练定义的准确性和通俗表达
- **application（应用连接）**：将材料中的观点或概念应用到自己的生活或工作中，适合训练知识迁移能力

## 要求
- 每个问题必须与材料内容直接相关，不能脱离材料
- 问题开放，有表达空间，不是简单的"是/否"问题
- 3个问题应该覆盖至少2种不同的技能类型
- 如果用户选择了表达角度，问题应围绕该角度和对应的技能类型生成
- 如果没有选择角度，优先使用 recommended_skill 类型

## 表达技能映射
- 观点表达 → recommended_skill: "opinion"
- 经历讲述 → recommended_skill: "experience"
- 概念解释 → recommended_skill: "concept"
- 感悟分享 → recommended_skill: "reflection"
- 故事表达 → recommended_skill: "story"
- 应用连接 → recommended_skill: "application"

## 输出格式
只输出合法JSON，不得使用Markdown代码围栏。

{
  "questions": [
    {
      "question": "问题文本（一句话，不超过40字）",
      "question_type": "opinion|explanation|application",
      "recommended_skill": "opinion|experience|concept|reflection|story|application"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `## Material Card\n\n${JSON.stringify(materialCard, null, 2)}${angleContext}\n\n请基于以上 Material Card，生成3个表达训练问题。`,
          },
        ];

        console.log(`[chinese-expression-agent] ${requestId} stage=generate_material_questions_start hasAngle=${!!selectedAngle}`);
        const result = await aiRuntime<{ questions: Array<{ question: string; question_type: string; recommended_skill: string }> }>(messages, {
          agentName: "chinese-expression-agent",
          maxTokens: 2048,
          temperature: 0.7,
          timeout: 90_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} generate_material_questions failed stage=${result.stage}`);
          return jsonResponse(req, {
            success: false, stage: result.stage, error: result.error, detail: result.detail, requestId,
          }, httpStatus);
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=generate_material_questions elapsedMs=${elapsedMs}`);
        return jsonResponse(req, { success: true, data: result.data, requestId, elapsedMs });
      }

      default: {
        console.warn(`[chinese-expression-agent] ${requestId} unknown action="${action}"`);
        return jsonResponse(req, {
          success: false, stage: "payload", error: `Unknown action: ${action}`, requestId,
        }, 400);
      }
    }
  } catch (err) {
    const elapsedMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : "Internal error";

    if (err instanceof DOMException && err.name === "AbortError") {
      console.error(`[chinese-expression-agent] ${requestId} timeout action=${action} elapsedMs=${elapsedMs}`);
      return jsonResponse(req, {
        success: false, stage: "internal", error: "请求处理超时", detail: String(message), requestId,
      }, 504);
    }

    console.error(`[chinese-expression-agent] ${requestId} unhandled error action=${action} elapsedMs=${elapsedMs}`, message);
    return jsonResponse(req, {
      success: false, stage: "internal", error: message, requestId,
    }, 500);
  }
});
