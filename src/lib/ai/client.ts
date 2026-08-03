// ============================================
// Nancy OS — AI Client
// OpenAI-compatible client (DeepSeek / Claude)
// v2: Supports context-aware calls with user auth
// ============================================

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  messages: ChatMessage[];
  /** When true, injects user memory context + learning history into the prompt */
  injectContext?: boolean;
  /** User's JWT session token (required when injectContext is true) */
  authToken?: string;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  contextInjected?: boolean;
}

// ── Edge Function proxy URL ──

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1`
  : "";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// ── Call Edge Function (with timeout + retry) ──

const AI_TIMEOUT_MS = 90_000;
const AI_MAX_RETRIES = 2;

export async function callAI(opts: ChatCompletionOptions): Promise<ChatCompletionResponse> {
  if (!EDGE_FUNCTION_URL) {
    throw new Error("Supabase URL not configured. Set VITE_SUPABASE_URL in .env.local");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const res = await fetch(`${EDGE_FUNCTION_URL}/english-coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.authToken || ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: opts.messages,
          model: opts.model || "deepseek-chat",
          maxTokens: opts.maxTokens || 2048,
          temperature: opts.temperature ?? 0.7,
          inject_context: opts.injectContext === true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        // Retry on server errors (5xx) and rate limits (429)
        if ((res.status >= 500 || res.status === 429) && attempt < AI_MAX_RETRIES) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`[callAI] Retryable error (${res.status}), attempt ${attempt + 1}/${AI_MAX_RETRIES + 1}, retrying in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`AI call failed (${res.status}): ${errText}`);
      }

      const data = await res.json();
      return {
        content: data.content || "",
        model: data.model || opts.model || "unknown",
        tokensUsed: data.tokensUsed,
        contextInjected: data.context_injected || false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error(`AI request timed out after ${AI_TIMEOUT_MS / 1000}s`);
        if (attempt < AI_MAX_RETRIES) {
          console.warn(`[callAI] Timeout, retry ${attempt + 1}/${AI_MAX_RETRIES + 1}`);
          continue;
        }
      }
      // Non-retryable errors: throw immediately
      if (!(err instanceof DOMException) || err.name !== "AbortError") {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("AI call failed after all retries");
}

// ── JSON extraction helper (AI responses often wrap JSON in prose) ──

export function extractJSON<T>(text: string, fallback: T): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      // fall through
    }
  }
  return fallback;
}
