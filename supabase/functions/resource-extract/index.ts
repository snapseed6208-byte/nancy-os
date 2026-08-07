// ============================================
// Nancy OS — Resource Extract Agent v1
// Stage 1 of 2: URL fetch + HTML parse + DB save. NO AI.
//
// Protections:
//   MAX_RESPONSE_BYTES = 2MB (fetch response limit)
//   MAX_EXTRACTED_CHARS = 10000 (cleaned text limit)
//   Content-Length pre-check
//   10s fetch timeout
//   Early release of large HTML strings
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

// ── Protection constants ──
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_EXTRACTED_CHARS = 10_000;
const FETCH_TIMEOUT_MS = 10_000;

// ── Helpers ──

function generateRequestId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return `re-${id}`;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function detectPlatform(url: string): string {
  if (url.includes("bilibili.com") || url.includes("b23.tv")) return "bilibili";
  if (url.includes("douyin.com") || url.includes("v.douyin.com")) return "douyin";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com")) return "xiaohongshu";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("mp.weixin.qq.com")) return "weixin";
  return "web";
}

function isUrl(input: string): boolean {
  return /^https?:\/\//.test(input.trim());
}

function extractMeta(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

// ── Stage-logged URL fetch ──

interface ExtractResult {
  title: string;
  description: string;
  text: string;
  truncated: boolean;
  responseBytes: number;
  error?: string;
  statusCode?: number;
}

async function fetchAndExtract(url: string, requestId: string): Promise<ExtractResult> {
  const platform = detectPlatform(url);
  const referer = platform === "bilibili" ? "https://www.bilibili.com/"
    : platform === "youtube" ? "https://www.youtube.com/"
    : "";

  // Stage: fetch_start
  const tFetchStart = Date.now();
  console.log(`[resource-extract] ${requestId} stage=fetch_start platform=${platform} url=${url.slice(0, 80)}`);

  let html = "";
  let responseBytes = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        ...(referer ? { "Referer": referer } : {}),
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const tFetch = Date.now() - tFetchStart;
      console.log(`[resource-extract] ${requestId} stage=fetch_failed status=${resp.status} elapsedMs=${tFetch}`);
      return {
        title: "", description: "", text: "", truncated: false, responseBytes: 0,
        error: `HTTP ${resp.status}${resp.status === 412 ? " (平台反爬拦截)" : resp.status === 403 ? " (禁止访问)" : ""}`,
        statusCode: resp.status,
      };
    }

    // Content-Length pre-check
    const contentLength = resp.headers.get("content-length");
    if (contentLength) {
      const cl = parseInt(contentLength, 10);
      if (cl > MAX_RESPONSE_BYTES) {
        console.warn(`[resource-extract] ${requestId} stage=content_length_exceeded contentLength=${cl} limit=${MAX_RESPONSE_BYTES}`);
        // Still proceed but will truncate
      }
    }

    // Read response with byte limit
    const arrayBuffer = await resp.arrayBuffer();
    responseBytes = arrayBuffer.byteLength;

    if (responseBytes > MAX_RESPONSE_BYTES) {
      console.warn(`[resource-extract] ${requestId} stage=response_truncated bytes=${responseBytes} limit=${MAX_RESPONSE_BYTES}`);
      // Truncate to MAX_RESPONSE_BYTES
      html = new TextDecoder().decode(arrayBuffer.slice(0, MAX_RESPONSE_BYTES));
    } else {
      html = new TextDecoder().decode(arrayBuffer);
    }

    const tFetchDone = Date.now() - tFetchStart;
    console.log(`[resource-extract] ${requestId} stage=fetch_done elapsedMs=${tFetchDone} bytes=${responseBytes} htmlLen=${html.length}`);

  } catch (err) {
    const tFetch = Date.now() - tFetchStart;
    const errMsg = (err as Error).message || "fetch failed";
    const isTimeout = errMsg.includes("abort") || errMsg.includes("timeout");
    console.error(`[resource-extract] ${requestId} stage=fetch_error elapsedMs=${tFetch} error=${errMsg}`);
    return {
      title: "", description: "", text: "", truncated: false, responseBytes: 0,
      error: isTimeout ? "页面请求超时 (10s)" : `网络错误: ${errMsg}`,
    };
  }

  // ── Stage: html_parse ──
  const tParseStart = Date.now();
  console.log(`[resource-extract] ${requestId} stage=html_parse_start htmlLen=${html.length}`);

  if (html.length < 200) {
    console.log(`[resource-extract] ${requestId} stage=html_too_short htmlLen=${html.length}`);
    return {
      title: "", description: "", text: "",
      truncated: false, responseBytes,
      error: `页面内容过短 (${html.length} chars)，可能被拦截或需登录`,
    };
  }

  // Extract metadata before stripping HTML
  const title = extractMeta(html, /<title[^>]*>([^<]*)<\/title>/i) || "";
  const ogTitle = extractMeta(html, /<meta\s+property="og:title"\s+content="([^"]*)"/i) || "";
  const description = extractMeta(html, /<meta\s+name="description"\s+content="([^"]*)"/i)
    || extractMeta(html, /<meta\s+property="og:description"\s+content="([^"]*)"/i) || "";

  // Strip tags and extract text — do in stages to allow GC of intermediates
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  // Release html reference early
  html = "";

  const truncated = text.length > MAX_EXTRACTED_CHARS;
  if (truncated) {
    text = text.slice(0, MAX_EXTRACTED_CHARS);
  }

  const tParse = Date.now() - tParseStart;
  console.log(`[resource-extract] ${requestId} stage=html_parse_done elapsedMs=${tParse} textLen=${text.length} truncated=${truncated}`);

  return {
    title: ogTitle || title,
    description,
    text,
    truncated,
    responseBytes,
  };
}

// ── Main handler ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders(req), "Access-Control-Max-Age": "86400" },
    });
  }

  const requestId = generateRequestId();
  const t0 = Date.now();

  // ── Stage: payload ──
  let body: { url?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, {
      success: false, stage: "payload", error: "请求格式错误，无法解析 JSON", requestId,
    }, 400);
  }

  const input = body.url || body.text || "";
  if (!input) {
    return jsonResponse(req, {
      success: false, stage: "payload", error: "请提供 URL 链接或文本内容", requestId,
    }, 400);
  }

  const inputIsUrl = body.url ? true : isUrl(input);
  const platform = inputIsUrl ? detectPlatform(input) : "text";

  console.log(`[resource-extract] ${requestId} stage=input_receive platform=${platform} inputLen=${input.length} isUrl=${inputIsUrl}`);

  // ── Stage: auth ──
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let userId = "";
  try {
    const { data: authData } = await supabase.auth.getUser(token);
    userId = authData.user?.id || "";
  } catch {
    return jsonResponse(req, { success: false, stage: "auth", error: "认证失败", requestId }, 401);
  }

  if (!userId) {
    return jsonResponse(req, { success: false, stage: "auth", error: "请先登录", requestId }, 401);
  }

  try {
    let extractedText = "";
    let sourceTitle = "";
    let sourceDescription = "";
    let sourceUrl = "";
    let sourcePlatform = "";
    let extractError: string | undefined;

    if (inputIsUrl) {
      sourceUrl = input;
      sourcePlatform = platform;

      // ── Stage: extract ──
      const result = await fetchAndExtract(input, requestId);

      if (result.error && result.statusCode && result.statusCode >= 400) {
        extractError = result.error;
        console.error(`[resource-extract] ${requestId} stage=extract_failed error=${result.error}`);
      }

      sourceTitle = result.title;
      sourceDescription = result.description;
      extractedText = result.text;

      console.log(`[resource-extract] ${requestId} stage=extract_done title="${sourceTitle.slice(0, 60)}" textLen=${extractedText.length} hasError=${!!extractError} responseBytes=${result.responseBytes}`);
    } else {
      // Text input — no fetch needed
      extractedText = input.length > MAX_EXTRACTED_CHARS ? input.slice(0, MAX_EXTRACTED_CHARS) : input;
      console.log(`[resource-extract] ${requestId} stage=text_input textLen=${extractedText.length}`);
    }

    // ── Stage: database_save ──
    console.log(`[resource-extract] ${requestId} stage=database_save_start`);

    const { data: resource, error: dbError } = await supabase
      .from("resources")
      .insert({
        user_id: userId,
        title: sourceTitle || (inputIsUrl ? "未命名资源" : "手动输入"),
        url: inputIsUrl ? input : null,
        resource_type: "article",
        // Layer 1: Original source
        source_platform: sourcePlatform || null,
        source_title: sourceTitle || null,
        source_url: sourceUrl || null,
        raw_content: extractedText || null,
        // Status tracking
        parse_status: extractError ? "extract_failed" : "extracted",
        status: "saved",
      })
      .select("id")
      .single();

    if (dbError) {
      console.error(`[resource-extract] ${requestId} stage=database_save_failed error=${dbError.message}`);
      return jsonResponse(req, {
        success: false,
        stage: "database",
        error: "保存资源失败",
        detail: dbError.message,
        requestId,
      }, 500);
    }

    const resourceId = resource.id as string;
    console.log(`[resource-extract] ${requestId} stage=database_save_done resourceId=${resourceId}`);

    const elapsedMs = Date.now() - t0;
    console.log(`[resource-extract] ${requestId} done elapsedMs=${elapsedMs} resourceId=${resourceId}`);

    return jsonResponse(req, {
      success: true,
      data: {
        resource_id: resourceId,
        title: sourceTitle,
        description: sourceDescription,
        extracted_text: extractedText,
        extract_error: extractError || null,
        platform: sourcePlatform,
        source_url: sourceUrl,
        parse_status: extractError ? "extract_failed" : "extracted",
      },
      requestId,
      elapsedMs,
    });

  } catch (err) {
    const elapsedMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[resource-extract] ${requestId} internal_error elapsedMs=${elapsedMs} error=${message}`);
    return jsonResponse(req, {
      success: false,
      stage: "internal",
      error: message,
      requestId,
    }, 500);
  }
});
