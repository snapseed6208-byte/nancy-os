// ============================================
// Nancy OS — Personal Practice Agent
// V3.1: Generates personalized practice prompts
// by connecting English expressions to the user's
// real personal stories, cases, and viewpoints.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import {
  authenticateRequest,
  getExpressionAssets,
  matchExpressionAssets,
  getConfirmedMemories,
  type ExpressionAssetCollection,
  type MatchedAsset,
} from "../_shared/nancy-context.ts";

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

interface PracticePromptInput {
  expressionEnglish: string;
  expressionChinese: string;
  expressionExample?: string;
  expressionType?: string;
  itemId: string;
  sessionId?: string;
}

interface PersonalPracticeContext {
  asset_id?: string;
  asset_title?: string;
  scenario: string;
  prompt: string;
  matched_assets: Array<{
    asset_id: string;
    title: string;
    asset_type: string;
    match_score: number;
  }>;
}

// ── AI Prompt ──

const SYSTEM_PROMPT = `你是一个个性化的英语学习教练。你的任务是为用户的英语表达创建个性化的造句场景。

你会收到：
- 目标英语表达（英文 + 中文翻译 + 例句）
- 用户的个人素材库（真实经历、观点、案例等）
- 用户的学习偏好

请根据用户的真实个人素材，生成一个自然的造句场景，让用户在熟悉的语境中练习这个表达。

输出格式（只输出JSON，不用Markdown围栏）：

{
  "scenario": "简短的场景描述（1句话，中文），说明在什么情况下使用这个表达",
  "prompt": "给用户的具体造句提示（1-2句话，中文），引导用户结合自己的真实经历造句"
}

━━━━━━━━━━━━━━━━━━━━
生成原则
━━━━━━━━━━━━━━━━━━━━

1. **必须基于用户的真实素材**。如果用户有相关经历/观点，用它来构建场景。不要编造用户的经历。
2. **场景要自然**。不要强行套用素材。如果用户的素材和这个表达不相关，给出一个通用的日常场景。
3. **prompt 要具体**。不要只说"用这个表达造句"，而是给一个具体的情境引导。
4. **个性化优先**：
   - 如果用户有相关经历素材 → 引导用户用这个表达来描述自己的真实经历
   - 如果用户有相关观点素材 → 引导用户用这个表达来阐述自己的立场
   - 如果没有相关素材 → 给出贴近用户生活主题的通用场景
5. 保持简短。scenario 不超过50字，prompt 不超过100字。`;

// ── Helpers ──

function buildAssetContext(
  assets: ExpressionAssetCollection,
  matches: MatchedAsset[],
): string {
  if (matches.length === 0) return "用户暂无相关个人素材。";

  const lines: string[] = [];
  lines.push("## 用户相关个人素材（按匹配度排序）");

  for (const m of matches.slice(0, 5)) {
    // Find the full asset data
    const allAssets = [
      ...assets.stories,
      ...assets.cases,
      ...assets.viewpoints,
      ...assets.expressions,
    ];
    const asset = allAssets.find((a) => a.id === m.asset_id);

    const typeLabel: Record<string, string> = {
      personal_story: "个人故事",
      experience_case: "经验案例",
      viewpoint: "观点",
      quality_expression: "优质表达",
      quote: "金句",
    };

    lines.push(`\n### ${typeLabel[m.asset_type] || m.asset_type}：${m.title}`);
    lines.push(`- 匹配度：${m.match_score}%`);
    if (m.reason) lines.push(`- 匹配原因：${m.reason}`);
    if (asset) {
      if (asset.summary) lines.push(`- 内容摘要：${asset.summary.slice(0, 150)}`);
      if (asset.scenarios.length > 0) {
        lines.push(`- 相关场景：${asset.scenarios.slice(0, 2).join("；")}`);
      }
      if (asset.key_skills.length > 0) {
        lines.push(`- 相关技能：${asset.key_skills.slice(0, 4).join("、")}`);
      }
    }
  }

  return lines.join("\n");
}

// ── Main Handler ──

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "只支持 POST 请求" }, 405);
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return jsonResponse(req, { error: "未登录" }, 401);
  }
  const { supabase, userId } = auth;

  try {
    const body: PracticePromptInput = await req.json();

    if (!body.expressionEnglish || !body.expressionChinese) {
      return jsonResponse(req, { error: "缺少必填字段：expressionEnglish, expressionChinese" }, 400);
    }

    // ── Fetch user's expression assets ──
    const assets = await getExpressionAssets(supabase, userId, { limit: 30 });

    // ── Match expression against user's assets ──
    const matches = matchExpressionAssets(assets, {
      topic: body.expressionEnglish,
      scenario: body.expressionChinese,
      skill: body.expressionType,
      limit: 5,
    });

    // ── Fetch learning memories ──
    const memories = await getConfirmedMemories(supabase, userId, {
      limit: 8,
      memoryTypes: ["preference", "habit", "insight", "skill"],
    });

    const memoryLines = memories.length > 0
      ? memories.map((m) => `- [${m.memory_type}] ${m.content}`).join("\n")
      : "暂无学习偏好数据";

    // ── Build asset context ──
    const assetContext = buildAssetContext(assets, matches);

    // ── Build AI message ──
    const userMessage = [
      `## 目标表达`,
      `- 英文：${body.expressionEnglish}`,
      `- 中文：${body.expressionChinese}`,
      body.expressionExample ? `- 例句：${body.expressionExample}` : "",
      body.expressionType ? `- 表达类型：${body.expressionType}` : "",
      ``,
      assetContext,
      ``,
      `## 用户学习偏好`,
      memoryLines,
      ``,
      `请为这个表达生成一个个性化的造句练习场景。`,
    ].filter(Boolean).join("\n");

    // ── AI call ──
    const result = await aiRuntime<{ scenario: string; prompt: string }>(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      {
        agentName: "personal-practice",
        temperature: 0.5,
        maxTokens: 512,
      },
    );

    let context: PersonalPracticeContext;

    if (result.success) {
      const bestMatch = matches[0];
      context = {
        asset_id: bestMatch?.asset_id,
        asset_title: bestMatch?.title,
        scenario: result.data.scenario,
        prompt: result.data.prompt,
        matched_assets: matches.slice(0, 3).map((m) => ({
          asset_id: m.asset_id,
          title: m.title,
          asset_type: m.asset_type,
          match_score: m.match_score,
        })),
      };
    } else {
      // Fallback: generic practice context
      console.error(`[personal-practice] AI failed: ${result.error}`);
      context = {
        scenario: "日常场景",
        prompt: `请用"${body.expressionEnglish}"造一个关于你日常生活的句子。`,
        matched_assets: [],
      };
    }

    // ── Save to session item ──
    if (body.itemId) {
      try {
        await supabase
          .from("review_session_items")
          .update({ personal_context: context })
          .eq("id", body.itemId);
      } catch (err) {
        console.error(`[personal-practice] failed to save context:`, (err as Error).message);
      }
    }

    return jsonResponse(req, {
      context,
      tokens: result.success ? result.usage?.totalTokens : undefined,
      fallback: !result.success,
    });
  } catch (err) {
    console.error(`[personal-practice] error:`, (err as Error).message);
    return jsonResponse(req, { error: "服务器内部错误" }, 500);
  }
});
