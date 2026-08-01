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
const ALIYUN_ENDPOINT = "nls-meta.cn-shanghai.aliyuncs.com";
const API_VERSION = "2018-05-18";

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

function toGmtString(d: Date): string {
  return d.toUTCString();
}

// ── Aliyun HMAC-SHA1 Signature (POP V1) ──

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
  const hash = await crypto.subtle.digest("MD5", new TextEncoder().encode(content));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
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

async function signRequest(params: {
  method: string;
  path: string;
  query: Record<string, string>;
  body: string;
  accessKeyId: string;
  accessKeySecret: string;
}): Promise<{ authorization: string; date: string; contentMd5: string; nonce: string }> {
  const { method, path, query, body, accessKeyId, accessKeySecret } = params;

  const date = toGmtString(new Date());
  const nonce = uuidV4();
  const contentType = "application/json";
  const contentMd5 = body ? await md5Base64(body) : "";

  // Build canonicalized query string
  const sortedQueryEntries = Object.entries(query).sort(([a], [b]) => a.localeCompare(b));
  const canonicalizedQuery = sortedQueryEntries
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  // Canonicalized headers (the x-acs-* ones)
  const acsHeaders: [string, string][] = [
    ["x-acs-action", query["Action"] || ""],
    ["x-acs-signature-nonce", nonce],
    ["x-acs-signature-method", "HMAC-SHA1"],
    ["x-acs-signature-version", "1.0"],
    ["x-acs-version", API_VERSION],
  ].filter(([, v]) => v !== "");

  const canonicalizedHeaders = acsHeaders
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("\n") + "\n";

  const canonicalizedResource = path + (canonicalizedQuery ? `?${canonicalizedQuery}` : "");

  const stringToSign = [
    method.toUpperCase(),
    "",           // Accept
    contentMd5,
    contentType,
    date,
    canonicalizedHeaders + canonicalizedResource,
  ].join("\n");

  const signature = await hmacSha1(accessKeySecret + "&", stringToSign);

  return {
    authorization: `acs ${accessKeyId}:${signature}`,
    date,
    contentMd5,
    nonce,
  };
}

// ── Aliyun Recording File Recognition ──

interface SubmitResponse {
  StatusText?: string;
  Status?: string;
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
  const body = JSON.stringify({
    appKey: ALIYUN_APP_KEY,
    fileLink,
    enableWords: false,
  });

  const query: Record<string, string> = {
    Action: "RecordingFileRecognize",
    Format: "JSON",
    Version: API_VERSION,
    AccessKeyId: ALIYUN_AK_ID,
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, "").replace(/-/g, "").replace(/:/g, "").replace(/T/g, "") + "Z",
    SignatureNonce: uuidV4(),
  };

  // Build query string for the URL
  const queryString = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
    .join("&");

  const path = "/pop/2018-05-18/RecordingFileRecognize";

  // Sign with empty body in query (Aliyun uses query params for action)
  // For RecordingFileRecognize, the body goes in the POST body, but the
  // signature covers the query params in CanonicalizedResource
  const signParams = {
    method: "POST",
    path,
    query,
    body,
    accessKeyId: ALIYUN_AK_ID,
    accessKeySecret: ALIYUN_AK_SECRET,
  };
  const { authorization, date, contentMd5 } = await signRequest(signParams);

  const url = `https://${ALIYUN_ENDPOINT}${path}?${queryString}`;

  console.log("[speech-to-text] Submitting recognition task:", { fileLink: fileLink.slice(0, 80) });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json",
      "Content-MD5": contentMd5,
      "Date": date,
      "x-acs-action": "RecordingFileRecognize",
      "x-acs-signature-nonce": query["SignatureNonce"],
      "x-acs-signature-method": "HMAC-SHA1",
      "x-acs-signature-version": "1.0",
      "x-acs-version": API_VERSION,
    },
    body,
  });

  const data: SubmitResponse = await resp.json();
  console.log("[speech-to-text] Submit response:", JSON.stringify(data));

  if (!resp.ok || (data.Code && data.Code !== "200")) {
    throw new Error(data.Message || `Submit failed: HTTP ${resp.status}`);
  }

  const taskId = data.TaskId || data.Data?.TaskId;
  if (!taskId) {
    throw new Error("No TaskId returned from Aliyun");
  }

  return taskId;
}

async function pollResult(taskId: string): Promise<string> {
  const path = `/pop/2018-05-18/RecordingFileRecognize`;
  const query: Record<string, string> = {
    Action: "RecordingFileRecognize",
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
    query["Timestamp"] = new Date().toISOString().replace(/\.\d{3}/, "").replace(/-/g, "").replace(/:/g, "").replace(/T/g, "") + "Z";
    query["SignatureNonce"] = uuidV4();

    const queryString = Object.entries(query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${percentEncode(k)}=${percentEncode(v)}`)
      .join("&");

    const signParams = {
      method: "GET",
      path,
      query,
      body: "",
      accessKeyId: ALIYUN_AK_ID,
      accessKeySecret: ALIYUN_AK_SECRET,
    };
    const { authorization, date } = await signRequest(signParams);

    const url = `https://${ALIYUN_ENDPOINT}${path}?${queryString}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json",
        "Date": date,
        "x-acs-action": "RecordingFileRecognize",
        "x-acs-signature-nonce": query["SignatureNonce"],
        "x-acs-signature-method": "HMAC-SHA1",
        "x-acs-signature-version": "1.0",
        "x-acs-version": API_VERSION,
      },
    });

    const data: ResultResponse = await resp.json();

    const status = data.StatusText || data.Status || "";
    console.log(`[speech-to-text] Poll ${attempt + 1}/${MAX_POLL_ATTEMPTS}: status=${status}`);

    if (status === "SUCCESS" && data.Result) {
      return data.Result;
    }

    if (status === "FAILED" || status === "FAIL") {
      throw new Error(`Alibaba ASR failed: ${data.Message || "Unknown error"}`);
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
