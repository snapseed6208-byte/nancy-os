// ============================================
// Nancy OS — Difficulty Diagnosis Agent
// V3.1: Analyzes WHY a user failed to recall
// an English expression during review sessions.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import { authenticateRequest, getConfirmedMemories } from "../_shared/nancy-context.ts";

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

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Types ──

interface DiagnosisInput {
  expressionEnglish: string;
  expressionChinese: string;
  expressionExample?: string;
  score: number; // 1-5 self-rating
  itemId: string; // review_session_items.id
  sessionId?: string;
  recentAttempts?: Array<{
    expression: string;
    score: number;
    status: string;
  }>;
}

interface DiagnosisOutput {
  problem_type: "memory" | "application" | "context" | "fluency";
  sub_problems: string[];
  suggestion: string;
  confidence: number;
}

// ── AI Prompt ──

const SYSTEM_PROMPT = `你是一个英语学习诊断专家。你的任务是分析用户在复习英语表达时遇到困难的原因。

你会收到：
- 目标英语表达（英文 + 中文翻译）
- 用户的自评分数（1-5，1=完全不记得，5=完全掌握）
- 用户最近的复习历史（如果有）

请诊断用户为何难以掌握这个表达，输出格式如下：

{
  "problem_type": "memory|application|context|fluency",
  "sub_problems": ["问题1", "问题2"],
  "suggestion": "具体的改进建议（1-2句话，中文）",
  "confidence": 0.75
}

━━━━━━━━━━━━━━━━━━━━
四种问题类型
━━━━━━━━━━━━━━━━━━━━

1. **memory（记忆问题）**：用户无法记住表达本身。
   - 典型表现：不记得单词、记错顺序、混淆相似表达
   - 子问题：recall（回忆失败）、retention（保持失败）、interference（相似表达干扰）

2. **application（应用问题）**：用户记得表达但不知道怎么用。
   - 典型表现：知道单词但不会造句、不知道搭配、不知道在什么场景用
   - 子问题：usage（用法不熟）、collocation（搭配不熟）、register（语域不当）

3. **context（语境问题）**：用户在脱离原始语境后无法回忆。
   - 典型表现：在书本上认识但实际场景想不起来、只记得中文不记得英文
   - 子问题：context（缺少场景锚点）、transfer（无法迁移到新场景）、association（缺少个人关联）

4. **fluency（流利度问题）**：用户知道但反应太慢或不自信。
   - 典型表现：需要想很久才能想起来、说的时候犹豫、对自己的答案不自信
   - 子问题：speed（反应速度慢）、confidence（缺乏自信）、automaticity（未形成自动化）

━━━━━━━━━━━━━━━━━━━━
诊断原则
━━━━━━━━━━━━━━━━━━━━

1. 基于分数判断严重程度：1-2分=严重问题，3分=中等，4-5分=轻微或已掌握
2. 考虑表达类型（短语、习语、单词）对难度的影响
3. 如果有历史记录，检查是否有重复失败的模式
4. suggestion 要具体可操作，不要泛泛而谈
5. 中文建议，贴合用户的实际困难

只输出合法JSON，不要用Markdown代码围栏。`;

// ── Main Handler ──

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "只支持 POST 请求" }, 405);
  }

  // Auth
  const auth = await authenticateRequest(req);
  if (!auth) {
    return jsonResponse(req, { error: "未登录" }, 401);
  }
  const { supabase, userId } = auth;

  try {
    const body: DiagnosisInput = await req.json();

    if (!body.expressionEnglish || !body.expressionChinese || body.score === undefined) {
      return jsonResponse(req, { error: "缺少必填字段：expressionEnglish, expressionChinese, score" }, 400);
    }

    // ── Build user context for better diagnosis ──
    const learningMemories = await getConfirmedMemories(supabase, userId, {
      limit: 10,
      memoryTypes: ["preference", "habit", "insight", "skill"],
    });

    const memoryContext = learningMemories.length > 0
      ? learningMemories.map((m) => `- [${m.memory_type}] ${m.content}`).join("\n")
      : "无历史学习数据";

    // ── Build user message ──
    const userMessage = [
      `## 目标表达`,
      `- 英文：${body.expressionEnglish}`,
      `- 中文：${body.expressionChinese}`,
      body.expressionExample ? `- 例句：${body.expressionExample}` : "",
      ``,
      `## 用户自评`,
      `- 分数：${body.score}/5`,
      `- 状态：${body.score >= 4 ? "已掌握" : body.score >= 3 ? "勉强记得" : "未掌握"}`,
      ``,
      body.recentAttempts && body.recentAttempts.length > 0
        ? [
            `## 最近复习历史`,
            ...body.recentAttempts.map((a) =>
              `- ${a.expression}：得分${a.score}/5（${a.status === "failed" ? "失败" : "通过"}）`
            ),
            ``,
          ].join("\n")
        : "",
      `## 用户学习偏好（长期记忆）`,
      memoryContext,
      ``,
      `请诊断用户为什么记不住这个表达，给出具体可行的建议。`,
    ].filter(Boolean).join("\n");

    // ── AI call ──
    const result = await aiRuntime<DiagnosisOutput>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      {
        agentName: "diagnose-difficulty",
        temperature: 0.3,
        maxTokens: 1024,
      },
    );

    if (!result.success) {
      console.error(`[diagnose-difficulty] AI failed: ${result.error}`);
      // Return a fallback diagnosis instead of failing
      const fallback: DiagnosisOutput = {
        problem_type: "memory",
        sub_problems: ["recall"],
        suggestion: body.score <= 2
          ? "建议从基础开始，先确保能正确朗读这个表达，再逐步过渡到主动回忆。"
          : "建议多在不同场景中复习这个表达，增强记忆锚点。",
        confidence: 0.3,
      };
      return jsonResponse(req, { diagnosis: fallback, fallback: true });
    }

    const diagnosis = result.data;

    // ── Update the session item with diagnosis ──
    if (body.itemId) {
      try {
        await supabase
          .from("review_session_items")
          .update({ difficulty_diagnosis: diagnosis })
          .eq("id", body.itemId);
      } catch (err) {
        console.error(`[diagnose-difficulty] failed to save diagnosis:`, (err as Error).message);
      }
    }

    return jsonResponse(req, { diagnosis, tokens: result.usage?.totalTokens });
  } catch (err) {
    console.error(`[diagnose-difficulty] error:`, (err as Error).message);
    return jsonResponse(req, { error: "服务器内部错误" }, 500);
  }
});
