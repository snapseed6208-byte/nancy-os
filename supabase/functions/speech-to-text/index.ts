// ============================================
// Nancy OS — Speech-to-Text Edge Function
// Receives a Supabase Storage public URL, submits to
// Aliyun Recording File Recognition, polls for result.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALIYUN_AK_ID = Deno.env.get("ALIYUN_ACCESS_KEY_ID") || "";
const ALIYUN_AK_SECRET = Deno.env.get("ALIYUN_ACCESS_KEY_SECRET") || "";
const ALIYUN_APP_KEY = Deno.env.get("ALIYUN_ASR_APP_KEY") || "";
const ALIYUN_ENDPOINT = "speechfiletranscriberlite.cn-shanghai.aliyuncs.com";
const API_VERSION = "2021-12-21";

const MAX_POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 2000;

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

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function uuidV4(): string {
  return crypto.randomUUID();
}

// ── Aliyun HMAC-SHA1 Signature ──

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

async function md5Base64(content: string): Promise<string> {
  const msgBytes = new TextEncoder().encode(content);
  const hashBytes = md5(msgBytes);
  return btoa(String.fromCharCode(...hashBytes));
}

// Pure JS MD5 (Deno Web Crypto doesn't support MD5 algorithm)
function md5(input: Uint8Array): Uint8Array {
  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  const origLen = input.length;
  const padLen = (origLen % 64 < 56) ? (56 - origLen % 64) : (120 - origLen % 64);
  const padded = new Uint8Array(origLen + padLen + 8);
  padded.set(input);
  padded[origLen] = 0x80;

  const dv = new DataView(padded.buffer);
  dv.setUint32(origLen + padLen + 4, origLen * 8, true);

  for (let offset = 0; offset < padded.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) M[j] = dv.getUint32(offset + j * 4, true);

    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j++) {
      let F: number, g: number;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      const temp = D;
      D = C; C = B;
      B = B + rotl32(A + F + K[j] + M[g], S[j]) | 0;
      A = temp;
    }
    a0 = a0 + A | 0; b0 = b0 + B | 0; c0 = c0 + C | 0; d0 = d0 + D | 0;
  }

  const out = new Uint8Array(16);
  const outDV = new DataView(out.buffer);
  outDV.setUint32(0, a0, true); outDV.setUint32(4, b0, true);
  outDV.setUint32(8, c0, true); outDV.setUint32(12, d0, true);
  return out;
}

function rotl32(x: number, n: number): number { return (x << n) | (x >>> (32 - n)); }

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/\+/g, "%20");
}

async function signRequest(params: {
  method: string;
  path: string;
  query: Record<string, string>;
  accessKeySecret: string;
}): Promise<{ signature: string }> {
  const { method, path, query, accessKeySecret } = params;

  // Build canonicalized query string: sort keys, percent-encode each k=v, join with &
  // The Signature key is NOT included in the string to sign
  const entries = Object.entries(query).filter(([k]) => k !== "Signature").sort(([a], [b]) => a.localeCompare(b));
  const canonicalizedQuery = entries
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  // StringToSign = HTTPMethod + "&" + percentEncode(path) + "&" + percentEncode(canonicalizedQuery)
  const stringToSign = [
    method.toUpperCase(),
    percentEncode(path),
    percentEncode(canonicalizedQuery),
  ].join("&");

  console.log("[speech-to-text] StringToSign:", stringToSign);
  const signature = await hmacSha1(accessKeySecret + "&", stringToSign);

  return { signature };
}

// ── Aliyun Recording File Recognition ──

interface SubmitResponse {
  StatusText?: string;
  Status?: string;
  StatusCode?: number;
  TaskId?: string;
  Data?: { TaskId?: string };
  RequestId?: string;
  Message?: string;
  Code?: string;
}

interface ResultResponse {
  StatusText?: string;
  Status?: string;
  Result?: string;
  TaskId?: string;
  RequestId?: string;
  Message?: string;
}

async function submitRecognition(fileLink: string): Promise<string> {
  const taskConfig = {
    appkey: ALIYUN_APP_KEY,
    file_link: fileLink,
    version: "4.0",
    enable_words: false,
  };
  const taskJson = JSON.stringify(taskConfig);

  const path = "/";

  // Build query for signing (includes Task for signature computation)
  const signQuery: Record<string, string> = {
    Action: "SubmitTask",
    Task: taskJson,
    Format: "JSON",
    Version: API_VERSION,
    AccessKeyId: ALIYUN_AK_ID,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, "") + "Z",
    SignatureNonce: uuidV4(),
  };

  const signParams = {
    method: "POST",
    path,
    query: signQuery,
    accessKeySecret: ALIYUN_AK_SECRET,
  };
  const { signature } = await signRequest(signParams);

  // Build URL query WITHOUT Task (Task goes in POST body only)
  signQuery["Signature"] = signature;
  const urlQueryEntries = Object.entries(signQuery)
    .filter(([k]) => k !== "Task")
    .sort(([a], [b]) => a.localeCompare(b));
  const queryString = urlQueryEntries
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");
  const url = `https://${ALIYUN_ENDPOINT}${path}?${queryString}`;

  console.log("[speech-to-text] Submitting recognition task:", { fileLink: fileLink.slice(0, 80) });

  // Send Task as form-encoded body
  const body = `Task=${encodeURIComponent(taskJson)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const responseText = await resp.text();
  console.log("[speech-to-text] Submit response:", responseText);

  let data: SubmitResponse;
  try { data = JSON.parse(responseText); } catch {
    throw new Error(`Aliyun submit returned non-JSON (HTTP ${resp.status}): ${responseText.slice(0, 500)}`);
  }

  if (!resp.ok || (data.Code && data.Code !== "200")) {
    throw new Error(`Aliyun submit failed (HTTP ${resp.status}): ${JSON.stringify(data)}`);
  }

  // Check StatusText for non-success responses (lite endpoint uses StatusText)
  if (data.StatusText && data.StatusText !== "SUCCESS") {
    throw new Error(`Aliyun submit returned status ${data.StatusText}: ${JSON.stringify(data)}`);
  }

  const taskId = data.TaskId || data.Data?.TaskId;
  if (!taskId) {
    throw new Error(`No TaskId returned from Aliyun: ${JSON.stringify(data)}`);
  }

  return taskId;
}

async function pollResult(taskId: string): Promise<string> {
  const path = `/`;
  const query: Record<string, string> = {
    Action: "GetTaskResult",
    TaskId: taskId,
    Format: "JSON",
    Version: API_VERSION,
    AccessKeyId: ALIYUN_AK_ID,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    Timestamp: "",
    SignatureNonce: "",
  };

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    // Refresh timestamp + nonce each poll
    query["Timestamp"] = new Date().toISOString().replace(/\.\d{3}/, "") + "Z";
    query["SignatureNonce"] = uuidV4();
    // Remove stale Signature before signing
    delete query["Signature"];

    const signParams = {
      method: "GET",
      path,
      query,
      accessKeySecret: ALIYUN_AK_SECRET,
    };
    const { signature } = await signRequest(signParams);

    // Build final URL with Signature in query string
    query["Signature"] = signature;
    const queryString = Object.entries(query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
      .join("&");
    const url = `https://${ALIYUN_ENDPOINT}${path}?${queryString}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await resp.json() as ResultResponse;

    const status = data.StatusText || data.Status || "";
    console.log(`[speech-to-text] Poll ${attempt + 1}/${MAX_POLL_ATTEMPTS}: status=${status}`, JSON.stringify(data));

    if (status === "SUCCESS" && data.Result) {
      return data.Result;
    }

    if (status === "FAILED" || status === "FAIL") {
      throw new Error(`Aliyun ASR failed: ${JSON.stringify(data)}`);
    }

    // Still QUEUEING or RUNNING — wait and retry
    if (attempt < MAX_POLL_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  throw new Error(`ASR timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
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
    // ── Auth (required) ──
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

    console.log("[speech-to-text] Starting recognition for:", audioUrl.slice(0, 80));

    const taskId = await submitRecognition(audioUrl);
    const transcript = await pollResult(taskId);

    console.log("[speech-to-text] Success:", transcript.slice(0, 100));

    return jsonResponse(req, { transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[speech-to-text] Error:", message);
    return jsonResponse(req, { error: message }, 500);
  }
});
