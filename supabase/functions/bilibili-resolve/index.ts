// Nancy OS - Bilibili URL resolver and metadata proxy.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/nancy-context.ts";
import {
  emptyBilibiliMetadata,
  extractAidFromUrl,
  extractBvidFromUrl,
  extractPageFromBilibiliUrl,
  hasUsableBilibiliMetadata,
  isBilibiliUrl,
  mergeBilibiliMetadata,
  parseBilibiliApiPayload,
  parseBilibiliHtmlMetadata,
  type BilibiliMetadata,
} from "../_shared/bilibili-metadata.ts";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type ErrorStage = "cors" | "invalid_url" | "bilibili_api" | "metadata_parse" | "internal";

interface FetchOutcome {
  metadata: BilibiliMetadata | null;
  status: number | null;
  error: string | null;
  endpoint?: string;
}

function logEvent(requestId: string, stage: string, fields: Record<string, unknown> = {}) {
  console.log("[bilibili-resolve]", { requestId, stage, ...fields });
}

function errorResponse(
  corsHeaders: Record<string, string>,
  requestId: string,
  stage: ErrorStage,
  error: string,
  status = 200,
  detail?: Record<string, unknown>,
) {
  console.error("[bilibili-resolve]", { requestId, stage, error });
  return jsonResponse({ success: false, stage, error, requestId, detail }, corsHeaders, status);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveB23(url: string): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    return isBilibiliUrl(response.url) ? response.url : null;
  } catch {
    return null;
  }
}

async function fetchApiMetadata(bvid: string | null, aid: number | null): Promise<FetchOutcome> {
  if (!bvid && !aid) return { metadata: null, status: null, error: "missing video id" };
  const query = bvid ? `bvid=${encodeURIComponent(bvid)}` : `aid=${aid}`;
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/view?${query}`,
    `https://api.bilibili.com/x/web-interface/wbi/view?${query}`,
  ];
  let lastOutcome: FetchOutcome = { metadata: null, status: null, error: "API request failed" };

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        headers: {
          "User-Agent": UA,
          "Referer": "https://www.bilibili.com/",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Origin": "https://www.bilibili.com",
        },
      });
      if (!response.ok) {
        lastOutcome = { metadata: null, status: response.status, error: `HTTP ${response.status}`, endpoint };
        continue;
      }
      const metadata = parseBilibiliApiPayload(await response.json(), bvid, aid);
      if (metadata) return { metadata, status: response.status, error: null, endpoint };
      lastOutcome = { metadata: null, status: response.status, error: "invalid API payload", endpoint };
    } catch (error) {
      lastOutcome = {
        metadata: null,
        status: null,
        error: (error as Error).message || "API request failed",
        endpoint,
      };
    }
  }
  return lastOutcome;
}

async function fetchHtmlMetadata(url: string, bvid: string | null, aid: number | null): Promise<FetchOutcome> {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": UA, "Referer": "https://www.bilibili.com/" },
      redirect: "follow",
    });
    if (!response.ok) return { metadata: null, status: response.status, error: `HTTP ${response.status}` };
    return {
      metadata: parseBilibiliHtmlMetadata(await response.text(), bvid, aid),
      status: response.status,
      error: null,
    };
  } catch (error) {
    return { metadata: null, status: null, error: (error as Error).message || "HTML request failed" };
  }
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const corsHeaders = getCorsHeaders(req);
  const origin = req.headers.get("Origin") || "";

  if (req.method === "OPTIONS") {
    logEvent(requestId, "cors", { origin, method: req.method });
    return new Response(null, {
      status: 204,
      headers: { ...corsHeaders, "Access-Control-Max-Age": "86400", "x-request-id": requestId },
    });
  }

  logEvent(requestId, "request", { origin, method: req.method, url: req.url });
  if (req.method !== "POST") {
    return errorResponse(corsHeaders, requestId, "invalid_url", "仅支持 POST 请求", 405);
  }

  try {
    const body = await req.json() as { url?: unknown };
    const inputUrl = typeof body.url === "string" ? body.url.trim() : "";
    if (!inputUrl || !isBilibiliUrl(inputUrl)) {
      return errorResponse(corsHeaders, requestId, "invalid_url", "无效的 B站视频链接", 400);
    }

    let canonicalUrl = inputUrl;
    let bvid = extractBvidFromUrl(canonicalUrl);
    const inputHost = new URL(inputUrl).hostname.toLowerCase();
    if (!bvid && (inputHost === "b23.tv" || inputHost.endsWith(".b23.tv"))) {
      canonicalUrl = await resolveB23(inputUrl) || inputUrl;
      bvid = extractBvidFromUrl(canonicalUrl);
    }

    if (!bvid && canonicalUrl.includes("m.bilibili.com")) {
      canonicalUrl = canonicalUrl.replace("m.bilibili.com", "www.bilibili.com");
      bvid = extractBvidFromUrl(canonicalUrl);
    }

    let aid = extractAidFromUrl(canonicalUrl);
    const page = extractPageFromBilibiliUrl(canonicalUrl);
    if (!bvid && !aid) {
      return errorResponse(corsHeaders, requestId, "invalid_url", "链接中未找到 BV 号或 av 号", 400);
    }

    logEvent(requestId, "video_id", { bvid, aid, page });
    const api = await fetchApiMetadata(bvid, aid);
    logEvent(requestId, "bilibili_api", {
      bvid,
      status: api.status,
      error: api.error,
      endpoint: api.endpoint,
      titleLength: api.metadata?.title?.length || 0,
    });

    if (api.metadata?.bvid && !bvid) {
      bvid = api.metadata.bvid;
      canonicalUrl = `https://www.bilibili.com/video/${bvid}`;
    }
    aid = api.metadata?.aid ?? aid;

    let metadata = api.metadata || emptyBilibiliMetadata(bvid, aid);
    let source: "bilibili_api" | "html_metadata" = "bilibili_api";
    let htmlOutcome: FetchOutcome | null = null;
    if (!hasUsableBilibiliMetadata(metadata)) {
      const htmlUrl = bvid ? `https://www.bilibili.com/video/${bvid}` : canonicalUrl;
      const html = await fetchHtmlMetadata(htmlUrl, bvid, aid);
      htmlOutcome = html;
      logEvent(requestId, "html_metadata", {
        bvid,
        status: html.status,
        error: html.error,
        titleLength: html.metadata?.title?.length || 0,
      });
      if (html.metadata) metadata = mergeBilibiliMetadata(metadata, html.metadata);
      if (hasUsableBilibiliMetadata(metadata)) source = "html_metadata";
    }

    if (!hasUsableBilibiliMetadata(metadata)) {
      return errorResponse(
        corsHeaders,
        requestId,
        api.error ? "bilibili_api" : "metadata_parse",
        "无法获取 B站视频标题",
        200,
        {
          api_status: api.status,
          api_error: api.error,
          api_endpoint: api.endpoint,
          html_status: htmlOutcome?.status ?? null,
          html_error: htmlOutcome?.error ?? null,
        },
      );
    }

    logEvent(requestId, "success", {
      bvid: metadata.bvid || bvid,
      metadataApiStatus: api.status,
      titleLength: metadata.title?.length || 0,
      coverExists: Boolean(metadata.cover_url),
      finalSource: source,
    });

    const responseData = {
      platform: "bilibili",
      video_id: metadata.bvid || bvid,
      canonical_url: canonicalUrl,
      page,
      title: metadata.title,
      cover_url: metadata.cover_url,
      description: metadata.description,
      author: metadata.author,
      duration_seconds: metadata.duration_seconds,
      source,
    };
    return jsonResponse({
      success: true,
      data: responseData,
      requestId,
      // Temporary compatibility for the currently deployed frontend.
      canonical_url: responseData.canonical_url,
      bvid: responseData.video_id,
      page: responseData.page,
      title: responseData.title,
      cover_url: responseData.cover_url,
      duration_seconds: responseData.duration_seconds,
      owner_name: responseData.author,
    }, { ...corsHeaders, "x-request-id": requestId });
  } catch (error) {
    return errorResponse(corsHeaders, requestId, "internal", (error as Error).message || "服务器内部错误", 500);
  }
});
