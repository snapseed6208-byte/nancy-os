import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiRuntime } from "../_shared/ai.ts";
import { authenticateOrRespond, getCorsHeaders, jsonResponse } from "../_shared/nancy-context.ts";

type ReaderAnalysis = {
  chinese_understanding: string;
  key_expressions: Array<{
    expression: string;
    source_expression?: string;
    alternative_expression?: string | null;
    chinese: string;
    explanation: string;
    contextual_meaning?: string;
    usage_note?: string;
    register?: "spoken" | "neutral" | "written";
    speaking_example?: string | null;
  }>;
  language_explanation: string;
  speaking_examples: string[];
};

const SYSTEM_PROMPT = `You are an English original-book reading assistant for an intermediate Chinese learner.

Analyze only the selected sentence using its nearby context. Return strict JSON:
{
  "chinese_understanding": "自然、准确的中文理解，不逐词硬译",
  "key_expressions": [
    {
      "expression": "原句中连续出现的英文 chunk，与 source_expression 相同",
      "source_expression": "必须逐字来自所选原句的连续文本",
      "alternative_expression": "可选的同义改写，只用于解释，不是原文表达",
      "chinese": "简洁中文含义",
      "explanation": "搭配、语气或使用边界",
      "contextual_meaning": "在当前句中的具体含义",
      "usage_note": "一条简短使用提示",
      "register": "spoken | neutral | written",
      "speaking_example": "适合口语时给一个自然例句，否则为 null"
    }
  ],
  "language_explanation": "解释句子结构、指代、语气或作者表达方式",
  "speaking_examples": ["一个自然、可直接说出口的迁移例句"]
}

Rules:
- Preserve the sentence's meaning and tone.
- Return 0-3 genuinely useful chunks or collocations, not basic standalone words.
- source_expression MUST be an exact, contiguous substring of the selected sentence. Never save a paraphrase as source_expression.
- Put paraphrases such as synonyms in alternative_expression only.
- Return key_expressions: [] when no expression is worth saving.
- Do not force a speaking example for literary or written-only expressions.
- Keep simple-sentence explanations short. Explain structure and tone only when they affect understanding.
- Do not invent plot facts outside the supplied context.
- Output JSON only.`;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function cleanAnalysis(value: ReaderAnalysis, sentence: string): ReaderAnalysis {
  return {
    chinese_understanding: typeof value.chinese_understanding === "string" ? value.chinese_understanding : "",
    key_expressions: Array.isArray(value.key_expressions)
      ? value.key_expressions
        .filter((item) => item && typeof item.expression === "string" && item.expression.trim())
        .map((item) => {
          const sourceExpression = typeof item.source_expression === "string" && item.source_expression.trim()
            ? item.source_expression.trim()
            : item.expression.trim();
          return {
            ...item,
            expression: sourceExpression,
            source_expression: sourceExpression,
            alternative_expression: typeof item.alternative_expression === "string" ? item.alternative_expression.trim() : null,
            contextual_meaning: typeof item.contextual_meaning === "string" ? item.contextual_meaning.trim() : "",
            usage_note: typeof item.usage_note === "string" ? item.usage_note.trim() : "",
            register: ["spoken", "neutral", "written"].includes(item.register || "") ? item.register : "neutral" as const,
            speaking_example: typeof item.speaking_example === "string" && item.speaking_example.trim() ? item.speaking_example.trim() : null,
          };
        })
        .filter((item) => normalized(sentence).includes(normalized(item.source_expression)))
        .slice(0, 3)
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

    const body = await req.json() as { sentence?: unknown; context?: unknown; sourceTitle?: unknown; sourceKind?: unknown; bookTitle?: unknown };
    const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
    const context = typeof body.context === "string" ? body.context.trim().slice(0, 1600) : "";
    const sourceTitleValue = typeof body.sourceTitle === "string" ? body.sourceTitle : body.bookTitle;
    const sourceTitle = typeof sourceTitleValue === "string" ? sourceTitleValue.trim().slice(0, 200) : "";
    const sourceKind = body.sourceKind === "article" ? "Article" : "Book";
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
        content: `${sourceKind}: ${sourceTitle || "Unknown"}\n\nContext:\n${context || sentence}\n\nSelected sentence:\n${sentence}`,
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

    return jsonResponse({ success: true, data: cleanAnalysis(result.data, sentence), requestId }, corsHeaders);
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
