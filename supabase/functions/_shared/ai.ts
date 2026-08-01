// ============================================
// Nancy OS — Shared Edge Function AI Helper
// Import from any Edge Function:
//   import { callDeepSeek } from "../_shared/ai.ts";
//
// Unified: timeout, JSON parse, error envelope, logging.
// ============================================

// ── Types ──

export type DeepSeekContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string | DeepSeekContentPart[];
}

export interface DeepSeekOptions {
  /** Default 0.5 */
  temperature?: number;
  /** Default 2048 */
  maxTokens?: number;
  /** Timeout in ms. Default 60_000 (60s). */
  timeout?: number;
  /** Model name. Default "deepseek-chat". */
  model?: string;
}

export interface DeepSeekSuccess<T = unknown> {
  success: true;
  data: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface DeepSeekFailure {
  success: false;
  error: string;
  detail?: string;
  status?: number;
}

export type DeepSeekResult<T = unknown> = DeepSeekSuccess<T> | DeepSeekFailure;

// ── Config (read once at import time) ──

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_TOKENS = 2048;

// ── Unified AI Runtime ──

export interface AIRuntimeOptions {
  /** Agent name for logging (required) */
  agentName: string;
  /** Max chars per message content (default 8000) */
  maxInputLength?: number;
  /** Base maxTokens, auto-scaled if dynamicTokens enabled (default 2048) */
  maxTokens?: number;
  /** Auto-scale maxTokens with input length (default true) */
  dynamicTokens?: boolean;
  /** Parse response as JSON (default true). Set false for chat/raw text agents. */
  parseJson?: boolean;
  /** Model temperature (default 0.5) */
  temperature?: number;
  /** Timeout in ms (default inherited from callDeepSeek: 60000) */
  timeout?: number;
}

export interface AIRuntimeSuccess<T = unknown> {
  success: true;
  data: T;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  raw?: string;
}

export interface AIRuntimeFailure {
  success: false;
  stage: AgentStage;
  error: string;
  detail?: string;
  raw?: string;
}

export type AIRuntimeResult<T = unknown> = AIRuntimeSuccess<T> | AIRuntimeFailure;

/**
 * Unified AI Runtime — single entry point for all Edge Function AI calls.
 *
 * Layers:
 *   1. Input validation + length guard
 *   2. Dynamic maxTokens scaling
 *   3. callDeepSeek (timeout + retry-aware)
 *   4. safeJsonParse (7-strategy repair chain)
 *   5. Unified stage-based error envelope
 *
 * Usage:
 *   const result = await aiRuntime<MyType>(messages, { agentName: "my-agent" });
 *   if (!result.success) return jsonResponse(result, req, 500);
 *   // result.data is typed
 */
export async function aiRuntime<T = unknown>(
  messages: DeepSeekMessage[],
  options: AIRuntimeOptions,
): Promise<AIRuntimeResult<T>> {
  const agentName = options.agentName;
  const tag = `[${agentName}]`;

  // ── Layer 1: Input validation ──
  const maxInput = options.maxInputLength || 8000;

  // Count chars: for string content use .length, for arrays count text parts only
  function countChars(content: DeepSeekMessage["content"]): number {
    if (typeof content === "string") return content.length;
    return content.reduce((sum, part) => sum + (part.type === "text" ? part.text.length : 0), 0);
  }

  const totalChars = messages.reduce((sum, m) => sum + countChars(m.content), 0);
  const hardLimit = maxInput * 3;

  if (totalChars > hardLimit) {
    console.error(`${tag} input too long: ${totalChars} chars (limit: ${hardLimit})`);
    return {
      success: false,
      stage: "payload",
      error: `输入文本过长 (${totalChars} 字符)，上限 ${hardLimit}。请缩短后重试。`,
    };
  }

  // Truncate oversized individual messages (skip arrays — multi-modal content)
  const processed: DeepSeekMessage[] = messages.map((m) => {
    if (typeof m.content !== "string") return m; // Don't truncate multi-modal arrays
    return {
      role: m.role,
      content: m.content.length > maxInput ? m.content.slice(0, maxInput) : m.content,
    };
  });

  // ── Layer 2: Dynamic maxTokens ──
  const parseJson = options.parseJson !== false;
  const baseTokens = options.maxTokens || 2048;
  let finalMaxTokens = baseTokens;

  if (options.dynamicTokens !== false && parseJson) {
    // JSON output scales with input — more content → more to analyze → more output
    if (totalChars > 8000) finalMaxTokens = Math.min(8192, baseTokens * 4);
    else if (totalChars > 4000) finalMaxTokens = Math.min(8192, baseTokens * 2);
    else if (totalChars > 2000) finalMaxTokens = Math.min(6144, Math.floor(baseTokens * 1.5));
  }

  // ── Layer 3: DeepSeek call ──
  console.log(`${tag} start chars=${totalChars} maxTokens=${finalMaxTokens}`);
  const aiResult = await callDeepSeek<string>(processed, {
    temperature: options.temperature ?? 0.5,
    maxTokens: finalMaxTokens,
    timeout: options.timeout,
  });

  if (!aiResult.success) {
    console.error(`${tag} deepseek failed: ${aiResult.error}`);
    return {
      success: false,
      stage: "deepseek",
      error: aiResult.error,
      detail: aiResult.detail,
    };
  }

  const raw = aiResult.data;
  const usage = aiResult.usage;

  // ── Layer 4: JSON parse (or raw passthrough) ──
  if (parseJson) {
    const parseResult = safeJsonParse<T>(raw);
    if (!parseResult.success) {
      console.error(`${tag} parse failed: ${parseResult.error}`);
      return {
        success: false,
        stage: "parse",
        error: parseResult.error,
        detail: parseResult.raw_sample,
        raw,
      };
    }

    console.log(`${tag} success tokens=${usage?.totalTokens ?? "?"}`);
    return { success: true, data: parseResult.data, usage, raw };
  }

  // Raw text passthrough (for chat agents)
  console.log(`${tag} success (raw) tokens=${usage?.totalTokens ?? "?"}`);
  return { success: true, data: raw as unknown as T, usage, raw };
}

export type AgentStage = "payload" | "auth" | "deepseek" | "parse" | "database" | "internal";

export function stageError(stage: AgentStage, error: string, detail?: string, extra?: Record<string, unknown>) {
  return { stage, error, ...(detail ? { detail } : {}), ...(extra || {}) };
}

// ── JSON parse helpers ──

/**
 * Attempt to repair truncated JSON. Strategy:
 * 1. Close unclosed strings, brackets
 * 2. If that fails, remove the last incomplete element and re-close
 * 3. If still failing, keep walking back commas
 */
function repairTruncatedJson(text: string): string {
  let repaired = text.trim();

  // Close unclosed strings
  let inString = false;
  let escaped = false;
  for (const ch of repaired) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; }
  }
  if (inString) repaired += '"';

  // Count and close brackets
  function closeBrackets(s: string): string {
    let bd = 0, bd2 = 0;
    let str = false, esc = false;
    for (const ch of s) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { str = !str; continue; }
      if (str) continue;
      if (ch === "{") bd++;
      if (ch === "}") bd--;
      if (ch === "[") bd2++;
      if (ch === "]") bd2--;
    }
    let result = s;
    while (bd2 > 0) { result += "]"; bd2--; }
    while (bd > 0) { result += "}"; bd--; }
    return result;
  }

  // Try 1: just close brackets
  repaired = closeBrackets(repaired);
  try { JSON.parse(repaired); return repaired; } catch { /* continue */ }

  // Try 2-N: walk back through commas, removing last incomplete element
  for (let i = 0; i < 10; i++) {
    const lastComma = repaired.lastIndexOf(",");
    if (lastComma < 0) break;
    repaired = closeBrackets(repaired.slice(0, lastComma));
    try { JSON.parse(repaired); return repaired; } catch { /* continue */ }
  }

  return repaired;
}

/**
 * Fix common AI JSON mistakes: trailing commas, missing commas.
 */
function repairJsonSyntax(text: string): string {
  // Remove trailing commas before ] or }
  let repaired = text.replace(/,(\s*[}\]])/g, "$1");
  // Remove trailing comma at end of string
  repaired = repaired.replace(/,(\s*)$/gm, "$1");
  return repaired;
}

/**
 * Robust JSON extraction and parse. Never throws.
 *
 * Tries, in order:
 * 1. Direct parse
 * 2. Strip markdown fences then parse
 * 3. Extract { } object from prose then parse
 * 4. Extract [ ] array from prose then parse
 * 5. Repair truncated JSON then parse
 * 6. Syntax repair + retry
 */
export function safeJsonParse<T = unknown>(raw: string): { success: true; data: T } | { success: false; error: string; raw_sample: string } {
  let text = raw.trim();

  // Strip BOM
  text = text.replace(/^﻿/, "");

  // Strategy 1: Direct parse
  try { return { success: true, data: JSON.parse(text) as T }; } catch { /* continue */ }

  // Strategy 2: Strip markdown fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try { return { success: true, data: JSON.parse(fenceMatch[1].trim()) as T }; } catch { /* continue */ }
  }

  // Strategy 3: Extract { } object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return { success: true, data: JSON.parse(objMatch[0]) as T }; } catch { /* continue */ }
  }

  // Strategy 4: Extract [ ] array
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return { success: true, data: JSON.parse(arrMatch[0]) as T }; } catch { /* continue */ }
  }

  // Strategy 5: Repair truncated JSON
  {
    const repaired = repairTruncatedJson(text);
    try { return { success: true, data: JSON.parse(repaired) as T }; } catch { /* continue */ }
  }

  // Strategy 6: Syntax fix on extracted object
  if (objMatch) {
    const synFixed = repairJsonSyntax(objMatch[0]);
    try { return { success: true, data: JSON.parse(synFixed) as T }; } catch { /* continue */ }
  }

  // Strategy 7: Syntax fix on repaired text
  {
    const repaired = repairTruncatedJson(text);
    const synFixed = repairJsonSyntax(repaired);
    try { return { success: true, data: JSON.parse(synFixed) as T }; } catch { /* continue */ }
  }

  return {
    success: false,
    error: "AI 返回格式异常，无法解析 JSON",
    raw_sample: raw.slice(0, 500),
  };
}

/**
 * Extract and parse JSON from AI response text. Throws on failure.
 * For new code, prefer safeJsonParse which never throws.
 */
export function parseAIJson<T = unknown>(raw: string): T {
  const result = safeJsonParse<T>(raw);
  if (result.success) return result.data;
  throw new Error(result.error);
}

// ── Core call ──

/**
 * Call DeepSeek chat completions with unified error handling.
 *
 * Features:
 * - AbortController timeout
 * - HTTP status checking
 * - JSON response parsing
 * - Structured error envelope (never throws on AI failure)
 * - Console logging
 *
 * Only throws on programming errors (bad arguments).
 */
export async function callDeepSeek<T = unknown>(
  messages: DeepSeekMessage[],
  options: DeepSeekOptions = {},
): Promise<DeepSeekResult<T>> {
  const apiKey = DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error("[callDeepSeek] DEEPSEEK_API_KEY is not set");
    return {
      success: false,
      error: "AI 服务未配置 (DEEPSEEK_API_KEY 缺失)",
      detail: "请在 Supabase Dashboard → Edge Functions → Secrets 中设置",
    };
  }

  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0.5;
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = Date.now();
  console.log(`[callDeepSeek] start model=${model} messages=${messages.length} timeout=${timeout}ms`);

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    // ── HTTP error from DeepSeek ──
    if (!response.ok) {
      let errBody = "";
      try { errBody = await response.text(); } catch { /* ignore */ }
      const shortBody = errBody.slice(0, 300);
      console.error(`[callDeepSeek] API error status=${response.status} elapsed=${elapsed}ms body=${shortBody}`);

      // Map common DeepSeek errors to user-facing messages
      const errorMessages: Record<number, string> = {
        401: "AI 服务认证失败，请联系管理员检查 API Key",
        402: "AI 服务账户余额不足",
        429: "AI 服务繁忙，请稍后重试",
        500: "AI 服务内部错误",
        503: "AI 服务暂时不可用",
      };
      const userMessage = errorMessages[response.status]
        || `AI 服务异常 (${response.status})`;

      return {
        success: false,
        error: userMessage,
        detail: shortBody || undefined,
        status: response.status,
      };
    }

    // ── Parse JSON response ──
    const result = await response.json();

    // ── Handle JSON error body (DeepSeek sometimes returns 200 + error) ──
    if (result.error) {
      const errMsg = typeof result.error === "string"
        ? result.error
        : result.error?.message || JSON.stringify(result.error);
      console.error(`[callDeepSeek] API returned error in 200 body: ${errMsg}`);
      return {
        success: false,
        error: `AI 服务错误: ${errMsg}`,
        detail: JSON.stringify(result.error).slice(0, 300),
      };
    }

    // ── Extract content ──
    const raw = result.choices?.[0]?.message?.content;
    if (!raw && raw !== "") {
      console.error(`[callDeepSeek] empty response content elapsed=${elapsed}ms`);
      return {
        success: false,
        error: "AI 返回空内容，请重试",
        detail: `model=${model} elapsed=${elapsed}ms`,
      };
    }

    const usage = result.usage
      ? {
          promptTokens: result.usage.prompt_tokens || 0,
          completionTokens: result.usage.completion_tokens || 0,
          totalTokens: result.usage.total_tokens || 0,
        }
      : undefined;

    const finishReason = result.choices?.[0]?.finish_reason;
    if (finishReason === "length") {
      console.warn(`[callDeepSeek] response truncated (finish_reason=length) — consider increasing maxTokens`);
    }

    console.log(`[callDeepSeek] success elapsed=${elapsed}ms tokens=${usage?.totalTokens ?? "?"} finish=${finishReason || "?"}`);

    return {
      success: true,
      data: raw as T,
      usage,
    };

  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    // AbortError = timeout
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error(`[callDeepSeek] timeout after ${timeout}ms`);
      return {
        success: false,
        error: `AI 服务响应超时 (${timeout / 1000}秒)`,
        detail: `model=${model}`,
      };
    }

    // Network / other errors
    const errMsg = (err as Error)?.message || String(err);
    console.error(`[callDeepSeek] exception elapsed=${elapsed}ms error=${errMsg}`);
    return {
      success: false,
      error: "AI 服务连接失败，请检查网络",
      detail: errMsg,
    };
  }
}
