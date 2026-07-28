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

// ── Call Edge Function ──

export async function callAI(opts: ChatCompletionOptions): Promise<ChatCompletionResponse> {
  if (!EDGE_FUNCTION_URL) {
    throw new Error("Supabase URL not configured. Set VITE_SUPABASE_URL in .env.local");
  }

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
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI call failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    content: data.content || "",
    model: data.model || opts.model || "unknown",
    tokensUsed: data.tokensUsed,
    contextInjected: data.context_injected || false,
  };
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
