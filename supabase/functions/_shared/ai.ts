// ============================================
// Nancy OS — Shared Edge Function AI Helper
// Import from any Edge Function:
//   import { callDeepSeek } from "../_shared/ai.ts";
//
// Unified: timeout, JSON parse, error envelope, logging.
// ============================================

// ── Types ──

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

// ── JSON parse helper ──

/**
 * Extract and parse JSON from AI response text.
 * Handles markdown code fences and prose-wrapped JSON.
 */
export function parseAIJson<T = unknown>(raw: string): T {
  let text = raw.trim();

  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fall through
  }

  // Try to find JSON object in prose
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  // Try array
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]) as T;
    } catch {
      // Fall through
    }
  }

  throw new Error(`无法解析 AI 返回的 JSON。原始内容 (前200字符): ${raw.slice(0, 200)}`);
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

    console.log(`[callDeepSeek] success elapsed=${elapsed}ms tokens=${usage?.totalTokens ?? "?"}`);

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
