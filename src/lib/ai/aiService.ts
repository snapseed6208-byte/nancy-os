// ============================================
// Nancy OS — Unified AI Service
// Single entry point for all Edge Function AI calls.
// Handles: timeout, retry, error extraction, logging.
// ============================================

import { supabase } from "@/lib/supabase";
import { recordAICall } from "@/lib/ai/aiHealth";

// ── Types ──

export type AIResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; detail?: string };

export type InvokeAIOptions = {
  /** Timeout in ms. Default 60_000 (60s). */
  timeout?: number;
  /** Number of retries on transient errors. Default 0. */
  retries?: number;
  /** HTTP status codes that trigger a retry. Default [429, 502, 503]. */
  retryOn?: number[];
  /** External AbortSignal for cancellation. */
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_RETRY_ON = [429, 502, 503];
const MAX_RETRIES = 3;

// ── Error extraction ──

interface SupabaseFunctionError {
  message?: string;
  context?: string;
  status?: number;
}

/**
 * Extract the real error message from a supabase-js FunctionsHttpError.
 * When an Edge Function returns non-2xx, supabase-js wraps the response
 * body in `error.context`. This unwraps it.
 */
function extractErrorMessage(err: unknown): { message: string; status?: number; stage?: string } {
  const e = err as SupabaseFunctionError;

  // Try to parse the response body from FunctionsHttpError.context
  if (typeof e.context === "string") {
    try {
      const body = JSON.parse(e.context) as Record<string, unknown>;

      // Build prefix from stage if present
      const stage = typeof body?.stage === "string" ? body.stage : undefined;
      const stageLabels: Record<string, string> = {
        payload: "请求参数",
        auth: "认证",
        deepseek: "DeepSeek调用",
        parse: "AI结果解析",
        database: "数据库",
        internal: "内部错误",
      };
      const stagePrefix = stage ? `[${stageLabels[stage] || stage}] ` : "";

      // Prefer body.error (string or object with .message)
      const inner = body?.error;
      if (typeof inner === "string" && inner) return { message: `${stagePrefix}${inner}`, stage };
      if (inner && typeof inner === "object") {
        const msg = (inner as Record<string, string>).message || (inner as Record<string, string>).error;
        if (msg) return { message: `${stagePrefix}${msg}`, stage };
      }
      // Fallback: body.message or body.detail
      if (typeof body?.message === "string" && body.message) return { message: `${stagePrefix}${body.message}`, stage };
      if (typeof body?.detail === "string" && body.detail) return { message: `${stagePrefix}${body.detail}`, stage };
    } catch {
      // context is not JSON — use raw text if short enough
      if (e.context.length < 200) return { message: e.context };
    }
  }

  // Fallback to error.message or generic
  return {
    message: e.message || "AI 服务调用失败",
    status: e.status,
  };
}

// ── Retry with backoff ──

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status: number | undefined, retryOn: number[]): boolean {
  if (!status) return false;
  return retryOn.includes(status);
}

// ── Core invoke ──

/**
 * Unified AI Edge Function invocation.
 *
 * Wraps supabase.functions.invoke() with:
 * - AbortController timeout
 * - Real error extraction from FunctionsHttpError.context
 * - HTTP 200 error envelope handling (for future Edge Functions)
 * - Retry on 429/502/503 with exponential backoff
 * - Console logging for every call
 *
 * @param functionName  Edge Function name (e.g. "content-parser-agent")
 * @param payload       Request body
 * @param options       Timeout, retry, signal
 */
export async function invokeAI<T = unknown>(
  functionName: string,
  payload: Record<string, unknown>,
  options: InvokeAIOptions = {},
): Promise<AIResult<T>> {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const retries = Math.min(options.retries ?? 0, MAX_RETRIES);
  const retryOn = options.retryOn ?? DEFAULT_RETRY_ON;
  const callId = `${functionName}-${Date.now().toString(36)}`;

  const t0 = Date.now();
  let lastError = "";
  let lastStatus: number | undefined;
  let finalResult: AIResult<T> | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const attemptLabel = attempt > 0 ? `retry-${attempt}` : "start";

    // ── AbortController for timeout ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Merge external signal
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        finalResult = { success: false, error: "请求已被取消" };
        break;
      }
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    console.log(`[aiService] ${callId} ${attemptLabel}`, { functionName, payloadKeys: Object.keys(payload) });

    try {
      const result = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      clearTimeout(timeoutId);

      // ── Case 1: Transport-level error (non-2xx from Edge Function) ──
      if (result.error) {
        const extracted = extractErrorMessage(result.error);
        lastError = extracted.message;
        lastStatus = extracted.status;
        console.error(`[aiService] ${callId} transport error`, { status: lastStatus, message: lastError });

        if (attempt < retries && shouldRetry(lastStatus, retryOn)) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[aiService] ${callId} retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          await sleep(delay);
          continue;
        }

        finalResult = { success: false, error: lastError, detail: `status=${lastStatus ?? "unknown"}` };
        break;
      }

      // ── Case 2: HTTP 200 but body has error envelope ──
      const data = result.data as Record<string, unknown> | null;
      if (data && typeof data === "object" && data.error) {
        const stageLabels: Record<string, string> = {
          payload: "请求参数", auth: "认证", deepseek: "DeepSeek调用",
          parse: "AI结果解析", database: "数据库", internal: "内部错误",
        };
        const stage = typeof data.stage === "string" ? data.stage : undefined;
        const stagePrefix = stage ? `[${stageLabels[stage] || stage}] ` : "";
        const msg = typeof data.error === "string"
          ? data.error
          : (data.error as Record<string, unknown>)?.message
            || JSON.stringify(data.error);
        console.error(`[aiService] ${callId} app error`, { message: msg, stage });
        finalResult = { success: false, error: `${stagePrefix}${String(msg)}` };
        break;
      }

      // ── Case 3: HTTP 200 but body has success:false envelope
      if (data && typeof data === "object" && data.success === false) {
        const msg = (data.error as string) || (data.message as string) || "未知错误";
        console.error(`[aiService] ${callId} envelope error`, { message: msg });
        finalResult = { success: false, error: String(msg) };
        break;
      }

      // ── Success ──
      console.log(`[aiService] ${callId} success`);
      finalResult = { success: true, data: data as T };
      break;

    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // Handle AbortController timeout
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = `AI 服务超时 (${timeout / 1000}s)`;
        console.error(`[aiService] ${callId} timeout after ${timeout}ms`);
      } else {
        lastError = (err as Error)?.message || "AI 调用异常";
        console.error(`[aiService] ${callId} exception`, { error: err });
      }

      if (attempt < retries && shouldRetry(lastStatus, retryOn)) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[aiService] ${callId} retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }

      finalResult = { success: false, error: lastError };
      break;
    }
  }

  if (!finalResult) {
    finalResult = { success: false, error: lastError || "AI 服务不可用" };
  }

  // Record in health history
  recordAICall({
    id: callId,
    timestamp: t0,
    functionName,
    duration: Date.now() - t0,
    success: finalResult.success,
    error: finalResult.success ? undefined : finalResult.error,
    status: lastStatus,
  });

  return finalResult;
}
