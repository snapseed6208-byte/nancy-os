// ============================================
// Nancy OS — Chinese Expression Training Agent V3
//
// Architecture:
//   analyze_expression  — single AI call: diagnosis + outline only (NO full speech)
//   generate_reference  — on-demand: full improved speech (user explicitly requests)
//   compare_rounds      — evidence-based Round 1 vs Round 2 comparison
//   generate_topics     — generate 3 candidate topics
//   extract_material    — extract key points from source text
//
// Skill architecture: load only current topic type's rules, not all 6.
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

function computeDeliveryMetrics(transcript: string, durationSeconds: number) {
  const cleaned = transcript.replace(/[^一-鿿\w]/g, "");
  const wordCount = cleaned.length;
  const paceWpm = durationSeconds > 0 ? Math.round(wordCount / (durationSeconds / 60)) : 0;

  const fillerPatterns = ["然后", "那个", "就是", "这个", "嗯", "啊", "呃", "吧", "嘛", "所以", "就是说", "怎么说呢", "然后呢", "而且"];
  const fillerCounts: Record<string, number> = {};
  for (const fw of fillerPatterns) {
    const escaped = fw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const count = (transcript.match(new RegExp(escaped, "g")) || []).length;
    if (count > 0) fillerCounts[fw] = count;
  }

  const fillerWords = Object.entries(fillerCounts)
    .filter(([, c]) => c > 0)
    .map(([w]) => w);

  return {
    pace_wpm: paceWpm,
    pause_count: 0,
    avg_pause_duration_seconds: 0,
    filler_word_count: Object.values(fillerCounts).reduce((a, b) => a + b, 0),
    filler_words: fillerWords,
    duration_seconds: durationSeconds,
    word_count: wordCount,
  };
}

// ═══════════════════════════════════════════
// Prompt Architecture (V3 — skill-based)
// ═══════════════════════════════════════════

// ── A. Common Coach Rules (loaded for every analysis) ──

const COMMON_COACH_RULES = `你是一名"思辨型中文表达教练"。

你的任务不是替用户生成一篇标准作文，也不是判断用户的立场是否正确。你的目标是帮助用户在真实口语场景中做到：

1. 明确自己的核心观点；
2. 有逻辑地组织理由；
3. 识别问题中的概念、矛盾和隐含前提；
4. 增加条件、权衡、边界、反面或因果分析；
5. 使用真实细节或明确的假设场景支撑观点；
6. 用自然、清晰、有个人思考的中文表达出来。

━━━━━━━━━━━━━━━━━━
一、基本原则
━━━━━━━━━━━━━━━━━━

1. 不预设标准答案。
允许用户有明确立场，但要检查：立场成立的条件、适用范围、可能的例外、需要承担的代价、与其他价值之间的权衡。

2. 不机械制造"两面性"。
不要为了显得思辨而固定输出"任何事情都有两面性""应该辩证地看""因人而异"。
只有真正解释了条件、差异和边界，才属于思辨。

3. 禁止编造事实。
不得擅自增加："我有一位朋友"、具体公司/学校/城市、具体职业和家庭经历、用户没有说过的成绩/证书/事件。
如果缺少真实例子：可以使用明确的一般性假设场景；或输出"真实信息补充槽位"；不得把假设包装成用户的真实故事。

4. 保留用户的核心立场和个人语气。
如果用户立场不明确，标记为"立场尚不明确"，不要擅自替用户决定。

5. 结构服务于内容。
可以使用PREP、金字塔原理、SCQA、STAR、故事结构。但只能选择一个主要框架，并根据内容灵活调整。
不得每次固定使用"首先、其次、最后、综上所述"。

6. 口语优先。
目标是一个真实的人在面试、交流或演讲中会说的话，不是书面议论文。
避免："随着社会的发展""在当今社会""众所周知""不难发现""综上所述""我坚信""首先其次最后的机械堆叠""过度工整的三段排比""空泛宏大但没有信息的句子"。

━━━━━━━━━━━━━━━━━━
二、思辨镜头
━━━━━━━━━━━━━━━━━━

根据题目选择最有价值的一到两个镜头，不要全部机械使用：
- definition：核心概念需要重新定义或澄清
- condition：结论成立的条件
- tradeoff：两种价值之间的权衡
- counterpoint：可能的反面情况或例外
- boundary：观点适用的边界
- causality：观点背后的因果链
- time_horizon：短期与长期差异

━━━━━━━━━━━━━━━━━━
三、评分标准
━━━━━━━━━━━━━━━━━━

总分100：
1. 主旨与切题度：15
2. 结构与逻辑：20
3. 内容深度与思辨：25
4. 细节与支撑：15
5. 表达清晰度：15
6. 口语呈现：10

每个维度必须：给出分数、引用用户原句作为证据、说明具体问题、给出可执行的改进方法。
不得仅输出"逻辑不够清晰""内容需要加深"等空泛评价。
口语呈现只能依据系统实际提供的数据（durationSeconds、speechRate、fillerWords、pauseCount、transcript）。
不评价观点是否符合"标准答案"；评价观点是否有合理依据、条件和边界。

━━━━━━━━━━━━━━━━━━
四、输出要求
━━━━━━━━━━━━━━━━━━

只输出合法JSON，不得使用Markdown代码围栏，不得添加JSON以外的文字。
分析前请完成内部判断，但不要输出推理过程。`;

// ── B. Topic-Specific Skills (loaded on-demand by topic_type) ──

type ChineseTopicType = "opinion" | "experience" | "concept" | "reflection" | "interview" | "story";

const SKILL_PROMPTS: Record<ChineseTopicType, string> = {
  opinion: `
━━━━━━━━━━━━━━━━━━
题型：观点表达
━━━━━━━━━━━━━━━━━━

优先使用"核心主张 + 理由 + 支撑 + 条件或边界 + 收束"。
可使用PREP，但必须加入至少一个思辨镜头。`,

  experience: `
━━━━━━━━━━━━━━━━━━
题型：经历讲述
━━━━━━━━━━━━━━━━━━

优先使用STAR或"背景—困难—选择—结果—反思"。
重点检查因果和个人行动。`,

  concept: `
━━━━━━━━━━━━━━━━━━
题型：概念解释
━━━━━━━━━━━━━━━━━━

优先使用"定义—区分—例子—边界"。
不能只给抽象定义。`,

  reflection: `
━━━━━━━━━━━━━━━━━━
题型：视频或读书感悟
━━━━━━━━━━━━━━━━━━

优先使用"内容触发—核心理解—不同看法—现实联系—行动或启示"。`,

  interview: `
━━━━━━━━━━━━━━━━━━
题型：面试回答
━━━━━━━━━━━━━━━━━━

优先使用"直接回答—证据—结果—岗位关联"。
不得虚构工作经历。`,

  story: `
━━━━━━━━━━━━━━━━━━
题型：故事表达
━━━━━━━━━━━━━━━━━━

优先使用"场景—冲突—选择—结果—意义"。
不得只罗列事情经过。`,
};

function getSkillPrompt(topicType: string): string {
  const skill = SKILL_PROMPTS[topicType as ChineseTopicType];
  return skill || SKILL_PROMPTS.opinion;
}

// ── C. Diagnosis Output Schema (no full speech) ──

const DIAGNOSIS_OUTPUT_SCHEMA = `
{
  "version": "3.0",
  "question_type": "opinion",
  "stance": {
    "summary": "用户当前核心立场",
    "clarity": "clear | partial | unclear",
    "preserved": true
  },
  "overall_score": 72,
  "overall_judgment": "一句真实、具体的整体评价",
  "primary_framework": {
    "name": "PREP",
    "reason": "为什么这个框架适合本次回答",
    "depth_lenses": ["definition", "tradeoff"]
  },
  "scores": {
    "relevance": { "score": 12, "max": 15, "evidence_quotes": ["用户原句"], "diagnosis": "具体判断", "improvement": "具体改法" },
    "structure_logic": { "score": 15, "max": 20, "evidence_quotes": ["用户原句"], "diagnosis": "具体判断", "improvement": "具体改法" },
    "depth_critical_thinking": { "score": 14, "max": 25, "evidence_quotes": ["用户原句"], "diagnosis": "缺少了哪些条件、权衡、边界或反面分析", "improvement": "具体增加哪一层思考" },
    "evidence_support": { "score": 8, "max": 15, "evidence_quotes": ["用户原句"], "diagnosis": "例子是否具体真实", "improvement": "应补充什么真实信息" },
    "clarity": { "score": 12, "max": 15, "evidence_quotes": ["用户原句"], "diagnosis": "重复、模糊或冗余问题", "improvement": "具体改法" },
    "delivery": { "score": 7, "max": 10, "evidence_quotes": ["口头禅或重复表达"], "diagnosis": "仅依据已有转录和口语数据", "improvement": "具体练习建议" }
  },
  "three_key_issues": [
    { "severity": "high", "title": "问题标题", "evidence_quote": "用户原句", "why_it_matters": "为什么影响表达", "how_to_fix": "下一次应该怎么做" }
  ],
  "thinking_upgrade": {
    "core_tension": "题目背后的核心矛盾",
    "definition": "需要澄清的概念；没有则为空字符串",
    "conditions": "结论成立的条件；没有则为空字符串",
    "tradeoff": "需要权衡的价值；没有则为空字符串",
    "counterpoint": "值得回应的反面情况；没有则为空字符串",
    "boundary": "观点适用的边界；没有则为空字符串",
    "real_detail_slots": ["可以补充的真实经历或事实，不得编造"]
  },
  "answer_outline": [
    { "step": 1, "label": "核心观点", "content": "这一部分应该说什么", "seconds": 10 }
  ],
  "self_questions": [
    "我的结论是什么？",
    "这个结论在什么条件下成立？",
    "我能用哪个真实细节支撑？"
  ],
  "key_improvements": [
    { "area": "改进领域", "before": "当前状态", "after": "建议方向" }
  ],
  "reference_ready": true,
  "integrity_check": {
    "fabricated_person_or_event": false,
    "unsupported_specific_details": [],
    "stance_was_replaced": false
  }
}`;

function buildDiagnosisSystemPrompt(topicType: string): string {
  return COMMON_COACH_RULES + "\n" + getSkillPrompt(topicType) + "\n" + DIAGNOSIS_OUTPUT_SCHEMA;
}

// ── D. Rewrite Prompt (for generate_reference) ──

const REWRITE_SYSTEM_PROMPT = `你是一名中文口语表达编辑。

你将收到：原始题目、用户真实转录、思辨诊断结果、推荐结构、可以使用的用户真实信息。

请生成唯一一份"优化表达参考"。

这不是标准作文，也不是替用户创造一个更正确的立场，而是帮助用户用更清晰、更有深度、更真实的方式表达自己的想法。

━━━━━━━━━━━━━━━━━━
写作要求
━━━━━━━━━━━━━━━━━━

1. 保留用户核心立场。可以让立场更准确、更有边界，但不得无理由改成相反观点。

2. 加入思辨深度。根据诊断结果，至少自然加入以下一项，最多两项：
- 对核心概念的定义
- 结论成立的条件
- 不同价值之间的权衡
- 一个合理的反面情况
- 观点适用的边界
- 短期和长期差异
不要机械说"任何事都有两面性"。

3. 禁止编造经历。
不得增加用户没有提供的：朋友、公司、学校、城市、工作、证书、家庭事件、明确的个人经历。
用户没有提供真实例子时，可以使用一般性假设："比如，一个刚毕业的人如果……"
不能写："我有一位朋友……"

4. 自然口语。整段必须像一个真实的人在面试或讨论中说话。
避免：首先其次最后的机械重复、综上所述、我坚信、随着社会的发展、在当今社会、空泛口号、过度工整的AI式排比。

5. 结构清晰但不僵硬。听众应能感受到：核心观点、理由、支撑、思辨层次、收束。不需要显式标注每个结构名称。

6. 长度控制。控制在180—260个汉字左右，适合正常语速下约一分钟表达。

7. 不替用户装成熟。内容可以更深入，但不要使用明显超出用户身份和真实经验的专业论断。

8. 只输出合法JSON，不得使用Markdown。

━━━━━━━━━━━━━━━━━━
输出结构
━━━━━━━━━━━━━━━━━━

{
  "improved_speech": "唯一一份自然口语版参考答案",
  "thought_features": [
    { "type": "definition | condition | tradeoff | counterpoint | boundary | causality", "used_in_sentence": "答案中对应的内容", "purpose": "这一层思考解决了什么问题" }
  ],
  "key_upgrades": [
    { "title": "升级点", "before": "用户原表达", "after": "优化思路", "reason": "为什么更好" }
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

如果用户查看过完整参考答案，必须在结果中注明：
"本轮在查看完整参考答案后完成，分数提升可能同时包含模仿因素。"

只输出合法JSON，不得使用Markdown代码围栏。

{
  "dimension_changes": [
    { "dimension": "内容深度与思辨", "round1_score": 10, "round2_score": 15, "delta": 5, "round1_evidence": "第一次原句", "round2_evidence": "第二次原句", "explanation": "为什么提升" }
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

        if (!topic || !transcript) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少话题或转录文本", requestId,
          }, 400);
        }

        const deliveryMetrics = computeDeliveryMetrics(transcript, durationSeconds);

        // Build prompt: common rules + topic-specific skill + output schema
        const systemPrompt = buildDiagnosisSystemPrompt(topicType);

        const userMessage = [
          `## 题目`,
          `题目：${topic}`,
          `类型：${topicType}`,
          `轮次：第${attemptRound}轮`,
          ``,
          `## 用户转录`,
          transcript,
          ``,
          `## 口语指标（系统实测）`,
          `- 录音时长：${deliveryMetrics.duration_seconds}秒`,
          `- 字数（去除标点）：${deliveryMetrics.word_count}`,
          `- 估算语速：${deliveryMetrics.pace_wpm}字/分钟`,
          `- 检测到的口头禅：${deliveryMetrics.filler_words.length > 0 ? deliveryMetrics.filler_words.join("、") : "无"}`,
          `- 口头禅总次数：${deliveryMetrics.filler_word_count}`,
        ].join("\n");

        const promptLen = systemPrompt.length;
        const msgLen = userMessage.length;
        console.log(`[chinese-expression-agent] ${requestId} stage=diagnosis_start topicType=${topicType} promptLen=${promptLen} msgLen=${msgLen} totalChars=${promptLen + msgLen}`);

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
        console.log(`[chinese-expression-agent] ${requestId} stage=diagnosis_done overall_score=${diagnosis.overall_score}`);

        // ── Integrity check ──
        const integrityCheck = diagnosis.integrity_check as Record<string, unknown> | undefined;
        const hasFabrication = integrityCheck?.fabricated_person_or_event === true;

        if (hasFabrication) {
          console.warn(`[chinese-expression-agent] ${requestId} integrity check failed — fabrication detected`);
        }

        // ── Agent log ──
        if (userId) {
          try {
            await supabase.from("agent_logs").insert({
              user_id: userId,
              agent_type: "chinese_expression",
              action: "analyze_expression",
              input_data: { topic, topic_type: topicType, transcript_length: transcript.length, attempt_round: attemptRound },
              output_data: {
                overall_score: diagnosis.overall_score,
                framework: (diagnosis.primary_framework as Record<string, unknown>)?.name,
                version: "3.0",
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

        // Extract relevant diagnosis fields for rewrite context
        const rewriteContext = {
          overall_score: diagnosis.overall_score,
          overall_judgment: diagnosis.overall_judgment,
          stance: diagnosis.stance,
          primary_framework: diagnosis.primary_framework,
          three_key_issues: diagnosis.three_key_issues,
          thinking_upgrade: diagnosis.thinking_upgrade,
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
      // V2 Compare Rounds (unchanged)
      // ═══════════════════════════════════════
      case "compare_rounds": {
        const topic = (body.topic as string) || "";
        const round1Transcript = (body.round1_transcript as string) || "";
        const round2Transcript = (body.round2_transcript as string) || "";
        const round1Scores = body.round1_scores as Record<string, unknown> | null;
        const round2Scores = body.round2_scores as Record<string, unknown> | null;
        const fullReferenceViewed = (body.full_reference_viewed as boolean) || false;

        if (!round1Transcript || !round2Transcript) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少两轮转录文本", requestId,
          }, 400);
        }

        const compareUserMessage = [
          `## 题目`, topic, ``,
          `## 第一次表达转录`, round1Transcript, ``,
          `## 第二次表达转录`, round2Transcript, ``,
          `## 第一次评分`, round1Scores ? JSON.stringify(round1Scores) : "无", ``,
          `## 第二次评分`, round2Scores ? JSON.stringify(round2Scores) : "无", ``,
          `## 参考信息`,
          `用户查看了完整参考答案：${fullReferenceViewed ? "是" : "否"}`,
        ].join("\n");

        const compareMessages: DeepSeekMessage[] = [
          { role: "system", content: COMPARISON_SYSTEM_PROMPT },
          { role: "user", content: compareUserMessage },
        ];

        console.log(`[chinese-expression-agent] ${requestId} stage=compare_rounds_start`);
        const result = await aiRuntime<Record<string, unknown>>(compareMessages, {
          agentName: "chinese-expression-agent",
          maxTokens: 2048,
          temperature: 0.3,
          timeout: 60_000,
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
      // Extract Material (unchanged)
      // ═══════════════════════════════════════
      case "extract_material": {
        const sourceText = (body.source_text as string) || "";

        if (!sourceText) {
          return jsonResponse(req, {
            success: false, stage: "payload", error: "缺少材料文本", requestId,
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

        console.log(`[chinese-expression-agent] ${requestId} stage=extract_material_start`);
        const result = await aiRuntime<Record<string, unknown>>(messages, {
          agentName: "chinese-expression-agent",
          maxTokens: 2048,
          temperature: 0.3,
          timeout: 90_000,
        });

        if (!result.success) {
          const httpStatus = result.stage === "deepseek" ? 502 : 500;
          console.error(`[chinese-expression-agent] ${requestId} extract_material failed`);
          return jsonResponse(req, {
            success: false, stage: result.stage, error: result.error, detail: result.detail, requestId,
          }, httpStatus);
        }

        const elapsedMs = Date.now() - t0;
        console.log(`[chinese-expression-agent] ${requestId} done action=extract_material elapsedMs=${elapsedMs}`);
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
