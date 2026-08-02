// ============================================
// Nancy OS — Aliyun NLS Token Edge Function
// Returns a temporary token for real-time ASR WebSocket.
// Client uses token to connect directly to Aliyun WebSocket.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALIYUN_AK_ID = Deno.env.get("ALIYUN_ACCESS_KEY_ID") || "";
const ALIYUN_AK_SECRET = Deno.env.get("ALIYUN_ACCESS_KEY_SECRET") || "";

const CREATE_TOKEN_ENDPOINT = "nls-meta.cn-shanghai.aliyuncs.com";

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
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
}

function jsonResponse(req: Request, data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

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

interface TokenResponse {
  Token: { Id: string; UserId: string; ExpireTime: number };
  ErrMsg: string;
}

async function createToken(): Promise<{ token: string; expireTime: number }> {
  const now = new Date();
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

  const resp = await fetch(url);
  const data: TokenResponse = await resp.json();

  if (!resp.ok || !data.Token?.Id) {
    throw new Error(`CreateToken failed: ${JSON.stringify(data)}`);
  }

  return { token: data.Token.Id, expireTime: data.Token.ExpireTime };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    if (!ALIYUN_AK_ID || !ALIYUN_AK_SECRET) {
      return jsonResponse(req, { error: "Aliyun credentials not configured" }, 500);
    }

    const { token, expireTime } = await createToken();

    return jsonResponse(req, {
      token,
      expireTime,
      expiresAt: new Date(expireTime * 1000).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[aliyun-token] Error:", message);
    return jsonResponse(req, { error: message }, 500);
  }
});
