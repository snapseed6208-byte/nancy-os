// ============================================
// Nancy OS — Speech-to-Text Edge Function
// Aliyun Recording File Recognition (Express / 极速版)
// Flow: Download WAV → CreateToken → FlashRecognizer → transcript
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALIYUN_AK_ID = Deno.env.get("ALIYUN_ACCESS_KEY_ID") || "";
const ALIYUN_AK_SECRET = Deno.env.get("ALIYUN_ACCESS_KEY_SECRET") || "";
const ALIYUN_APP_KEY = Deno.env.get("ALIYUN_ASR_APP_KEY") || "";

const CREATE_TOKEN_ENDPOINT = "nls-meta.cn-shanghai.aliyuncs.com";
const FLASH_RECOGNIZER_URL = "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/FlashRecognizer";

const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB limit

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

// ── Helpers ──

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(req: Request, data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Aliyun HMAC-SHA1 Signature (only used for CreateToken) ──

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/\+/g, "%20");
}

async function hmacSha1(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ── CreateToken ──

interface TokenResponse {
  Token: { Id: string; UserId: string; ExpireTime: number };
  ErrMsg: string;
}

async function createToken(): Promise<string> {
  const now = new Date();
  // toISOString already ends with Z — don't append another
  const timestamp = now.toISOString().replace(/\.\d{3}/, "");

  const query: Record<string, string> = {
    Action: "CreateToken",
    Format: "JSON",
    Version: "2019-02-28",
    AccessKeyId: ALIYUN_AK_ID,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    Timestamp: timestamp,
    SignatureNonce: crypto.randomUUID(),
  };

  const entries = Object.entries(query)
    .filter(([k]) => k !== "Signature")
    .sort(([a], [b]) => a.localeCompare(b));
  const canonicalizedQuery = entries
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const stringToSign = ["GET", percentEncode("/"), percentEncode(canonicalizedQuery)].join("&");
  const signature = await hmacSha1(ALIYUN_AK_SECRET + "&", stringToSign);

  const urlQs = entries
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&") +
    "&Signature=" + percentEncode(signature);

  const url = `https://${CREATE_TOKEN_ENDPOINT}/?${urlQs}`;
  console.log("[speech-to-text] CreateToken request");

  const resp = await fetch(url);
  const data: TokenResponse = await resp.json();

  if (!resp.ok || !data.Token?.Id) {
    throw new Error(`CreateToken failed: ${JSON.stringify(data)}`);
  }

  console.log("[speech-to-text] Token obtained, expires:", new Date(data.Token.ExpireTime * 1000).toISOString());
  return data.Token.Id;
}

// ── FlashRecognizer (Express / 极速版) ──

interface FlashSentence {
  text: string;
  begin_time: number;
  end_time: number;
  channel_id: number;
  words?: Array<{ text: string; begin_time: string; end_time: string; punc: string }>;
}

interface FlashResult {
  task_id: string;
  status: number;
  message: string;
  flash_result?: {
    duration: number;
    sentences: FlashSentence[];
  };
}

async function flashRecognize(token: string, audioData: Uint8Array): Promise<FlashResult> {
  const params = new URLSearchParams({
    appkey: ALIYUN_APP_KEY,
    token,
    format: "WAV",
    sample_rate: "16000",
  });

  const url = `${FLASH_RECOGNIZER_URL}?${params.toString()}`;

  console.log(`[speech-to-text] FlashRecognizer: ${audioData.length} bytes`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(audioData.length),
    },
    body: audioData,
  });

  const text = await resp.text();
  console.log(`[speech-to-text] FlashRecognizer HTTP ${resp.status}: ${text}`);

  let result: FlashResult;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`FlashRecognizer returned non-JSON (HTTP ${resp.status}): ${text.slice(0, 500)}`);
  }

  return result;
}

// ── Extract transcript from sentences ──

function extractTranscript(result: FlashResult): string {
  const sentences = result.flash_result?.sentences;
  if (!sentences || sentences.length === 0) return "";
  return sentences.map((s) => s.text).join(" ");
}

// ── Serve ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(req, { error: "需要登录" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return jsonResponse(req, { error: "登录已过期" }, 401);

    const body = await req.json();
    const audioUrl = body.audioUrl as string;

    if (!audioUrl || typeof audioUrl !== "string") {
      return jsonResponse(req, { error: "audioUrl is required" }, 400);
    }

    if (!ALIYUN_AK_ID || !ALIYUN_AK_SECRET || !ALIYUN_APP_KEY) {
      console.error("[speech-to-text] Missing Aliyun credentials");
      return jsonResponse(req, { error: "Aliyun ASR not configured" }, 500);
    }

    // ── Download WAV ──
    console.log("[speech-to-text] Downloading audio:", audioUrl.slice(0, 80));
    const downloadResp = await fetch(audioUrl);
    if (!downloadResp.ok) {
      throw new Error(`Failed to download audio (HTTP ${downloadResp.status})`);
    }

    const audioBuffer = await downloadResp.arrayBuffer();
    if (audioBuffer.byteLength === 0) {
      throw new Error("Downloaded audio is empty");
    }
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      throw new Error(`Audio too large: ${audioBuffer.byteLength} bytes (max ${MAX_AUDIO_BYTES})`);
    }

    const audioData = new Uint8Array(audioBuffer);
    console.log(`[speech-to-text] Downloaded ${audioData.length} bytes`);

    // ── CreateToken ──
    const nlsToken = await createToken();

    // ── FlashRecognizer ──
    const result = await flashRecognize(nlsToken, audioData);

    if (result.status !== 20000000) {
      throw new Error(
        `FlashRecognizer error (status=${result.status}): ${result.message}` +
        ` | task_id=${result.task_id}`,
      );
    }

    const transcript = extractTranscript(result);

    console.log(`[speech-to-text] Success: "${transcript.slice(0, 100)}"`);

    return jsonResponse(req, {
      transcript,
      task_id: result.task_id,
      duration_ms: result.flash_result?.duration,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[speech-to-text] Error:", message);
    if (stack) console.error("[speech-to-text] Stack:", stack);

    return jsonResponse(req, {
      error: message,
      stack,
    }, 500);
  }
});
