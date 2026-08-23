import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiRuntime } from "../_shared/ai.ts";
import { authenticateOrRespond, getCorsHeaders, jsonResponse } from "../_shared/nancy-context.ts";

type ReaderAnalysis = {
  chinese_understanding: string;
  key_expressions: Array<{ expression: string; chinese: string; explanation: string }>;
  language_explanation: string;
  speaking_examples: string[];
};

const SYSTEM_PROMPT = `You are an English original-book reading assistant for an intermediate Chinese learner.

Analyze only the selected sentence using its nearby context. Return strict JSON:
{
  "chinese_understanding": "自然、准确的中文理解，不逐词硬译",
  "key_expressions": [
    {
      "expression": "值得迁移到真实口语中的英文 chunk",
      "chinese": "简洁中文含义",
      "explanation": "搭配、语气或使用边界"
    }
  ],
  "language_explanation": "解释句子结构、指代、语气或作者表达方式",
  "speaking_examples": ["一个自然、可直接说出口的迁移例句"]
}

Rules:
- Preserve the sentence's meaning and tone.
- Prioritize chunks and collocations, not basic standalone words.
- Return key_expressions: [] when no expression is worth saving.
- Give 1-3 short speaking examples grounded in the selected expression or structure.
- Do not invent plot facts outside the supplied context.
- Output JSON only.`;

function cleanAnalysis(value: ReaderAnalysis): ReaderAnalysis {
  return {
    chinese_understanding: typeof value.chinese_understanding === "string" ? value.chinese_understanding : "",
    key_expressions: Array.isArray(value.key_expressions)
      ? value.key_expressions.filter((item) => item && typeof item.expression === "string" && item.expression.trim()).slice(0, 5)
      : [],
    language_explanation: typeof value.language_explanation === "string" ? value.language_explanation : "",
    speaking_examples: Array.isArray(value.speaking_examples)
      ? value.speaking_examples.filter((item) => typeof item === "string" && item.trim()).slice(0, 3)
      : [],
  };
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" } });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, stage: "payload", error: "仅支持 POST 请求", requestId }, corsHeaders, 405);
  }

  try {
    const auth = await authenticateOrRespond(req, corsHeaders);
    if ("response" in auth) return auth.response;

    const body = await req.json() as { sentence?: unknown; context?: unknown; bookTitle?: unknown };
    const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim().slice(0, 1600) : "";
    const bookTitle = typeof body.bookTitle === "string" ? body.bookTitle.trim().slice(0, 200) : "";
    if (!sentence || sentence.length > 1200) {
      return jsonResponse({
        success: false,
        stage: "payload",
        error: sentence ? "所选句子过长" : "请选择要分析的句子",
        requestId,
      }, corsHeaders, 400);
    }

    const result = await aiRuntime<ReaderAnalysis>([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Book: ${bookTitle || "Unknown"}\n\nContext:\n${context || sentence}\n\nSelected sentence:\n${sentence}`,
      },
    ], { agentName: "english-reader", maxTokens: 1600, temperature: 0.25 });

    if (!result.success) {
      return jsonResponse({
        success: false,
        stage: "ai_analysis",
        error: result.error,
        detail: result.detail,
        requestId,
      }, corsHeaders, 500);
    }

    return jsonResponse({ success: true, data: cleanAnalysis(result.data), requestId }, corsHeaders);
  } catch (error) {
    console.error("[english-reader-agent]", { requestId, error: (error as Error).message });
    return jsonResponse({
      success: false,
      stage: "internal",
      error: (error as Error).message || "服务器内部错误",
      requestId,
    }, corsHeaders, 500);
  }
});
