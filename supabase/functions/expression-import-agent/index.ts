// ============================================
// Nancy OS — Expression Import Agent
// Extracts English expressions from text via DeepSeek
// Input: { text: "..." }
// Output: { expressions: [...], stats: {...} }
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { callDeepSeek, parseAIJson } from "../_shared/ai.ts";

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

const EXTRACT_PROMPT = `You are an expert English language learning assistant for Chinese university students at intermediate-to-advanced level (专四 and above).

Your task is to analyze English text and extract useful learning items. The user's goal is NOT to memorize all vocabulary — they want to accumulate genuinely useful, speakable English expressions.

## EXTRACTION CRITERIA — READ CAREFULLY

### DO NOT extract these (reject them):
- Basic/elementary words: good, bad, nice, big, small, go, come, make, do, get, have, say, look, want, like, know, think, see, give, take, use, find, tell, ask, try, leave, call, put, work, need, feel, seem, help, show, hear, play, run, move, live, believe, hold, bring, happen, write, provide, sit, stand, lose, pay, meet, include, continue, set, learn, change, lead, understand, watch, follow, stop, create, speak, read, allow, add, spend, return, carry, expect, build, stay, start, keep, let, open, close, turn, walk, eat, drink, buy, sell, send, receive, win, lose, wait, hope, wish, pass, fail, accept, refuse, offer, show, remember, forget
- High-school level common words (unless part of a useful chunk)
- Any standalone simple verb, noun, or adjective without significant expression value

### PRIORITIZE these:
- CHUNKS / PHRASES (MOST IMPORTANT): make a difference, be supposed to, end up doing, get used to
- Collocations: strong evidence, heavy workload, bitterly disappointed
- Phrasal verbs: figure out, carry out, put off, bring up, look into
- Sentence patterns: What I mean is..., The reason why... is that...
- Natural speaking expressions: That makes sense, I'm not sure how to put it

### Key principle: extract CHUNKS, not standalone words

Return ONLY valid JSON:
{
  "expressions": [
    {
      "english": "expression text",
      "chinese": "中文翻译",
      "type": "vocabulary|chunk|sentencePattern|speakingExpression",
      "pronunciation": "optional pronunciation",
      "example_sentence": "example using the expression in context",
      "scene": "daily life|study|internship|business|IELTS|commuting|renting|emotions|food|shopping|work|interview|academic|other",
      "topic": "topic keyword",
      "difficulty_level": "beginner|intermediate|advanced",
      "usefulness_level": 1-5,
      "usage_note": "中文使用说明，包括适用场景、语体正式度、常见搭配",
      "memory_tip": "中文记忆技巧，用联想、词根、谐音、场景关联等方式帮助记忆该表达",
      "common_mistakes": "中国学生使用该表达时常犯的错误，如语法、搭配、语境误用等",
      "context": "该表达最典型的实际使用语境和场景",
      "common_patterns": "该表达最常用的句型结构或搭配模式，如 'It is [adjective] that...'"
    }
  ]
}

Rules:
- difficulty_level: beginner = common/basic expressions, intermediate = college-level, advanced = academic/professional
- usefulness_level: 1 = rarely used, 5 = highly practical for daily communication
- usage_note: brief note in Chinese about when/how to use this expression, including register and common collocations
- memory_tip: creative memorization aid in Chinese — use association, etymology, homophones, scene visualization etc.
- common_mistakes: typical errors Chinese university students make with this expression
- context: the most typical real-life situation where this expression is used
- common_patterns: common sentence structures or collocation patterns
- Extract 10-30 expressions total, prioritizing quality over quantity
- All expressions must have proper chinese translation`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  // ── Stage: payload ──
  let body: { text?: string };
  try {
    body = await req.json() as { text?: string };
  } catch {
    return new Response(JSON.stringify({
      stage: "payload",
      error: "请求格式错误，无法解析 JSON",
    }), {
      status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const text = body.text || "";
  if (!text || text.trim().length === 0) {
    return new Response(JSON.stringify({
      stage: "payload",
      error: "请提供文本内容",
    }), {
      status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  // ── Stage: auth ──
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({
      stage: "auth",
      error: "Unauthorized",
    }), {
      status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  let tokensUsed = 0;

  // ── Stage: deepseek ──
  const truncated = text.slice(0, 8000);
  const aiResult = await callDeepSeek([
    { role: "system", content: EXTRACT_PROMPT },
    { role: "user", content: `Please analyze this English text and extract useful learning expressions:\n\n${truncated}` },
  ], { temperature: 0.5, maxTokens: 4096 });

  if (!aiResult.success) {
    return new Response(JSON.stringify({
      stage: "deepseek",
      error: aiResult.error,
      detail: aiResult.detail,
    }), {
      status: aiResult.status || 502,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const raw = aiResult.data as string;
  tokensUsed = aiResult.usage?.totalTokens || 0;

  // ── Stage: parse ──
  let parsed: Record<string, unknown>;
  try {
    parsed = parseAIJson<Record<string, unknown>>(raw);
  } catch (parseErr) {
    console.error(`[expression-import-agent] parse error: ${(parseErr as Error).message}. Raw (first 500): ${raw.slice(0, 500)}`);
    return new Response(JSON.stringify({
      stage: "parse",
      error: "parse_error",
      raw: raw.slice(0, 500),
      message: "AI 返回格式异常，请重试",
    }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const expressions = (parsed.expressions as Array<Record<string, unknown>>) || [];

  // Build stats
  const stats = {
    total: expressions.length,
    vocabulary: 0,
    chunk: 0,
    sentencePattern: 0,
    speakingExpression: 0,
  };
  for (const expr of expressions) {
    const t = expr.type as string;
    if (t === "vocabulary") stats.vocabulary++;
    else if (t === "chunk") stats.chunk++;
    else if (t === "sentencePattern") stats.sentencePattern++;
    else if (t === "speakingExpression") stats.speakingExpression++;
  }

  // ── Stage: database ──
  try {
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "expression_import",
      action: "extract_expressions",
      input_data: {
        text_length: text.length,
        text_preview: text.slice(0, 100),
      },
      output_data: {
        expression_count: expressions.length,
        stats,
        tokens_used: tokensUsed,
      },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });
  } catch (dbErr) {
    console.error(`[expression-import-agent] DB log insert failed: ${(dbErr as Error).message}`);
    // Non-fatal — still return success
  }

  return new Response(JSON.stringify({
    expressions,
    stats,
    tokens_used: tokensUsed,
  }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
