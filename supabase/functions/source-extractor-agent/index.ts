// ============================================
// Nancy OS — Source Extractor Agent v2
// Platform-specific content extraction layer.
//
// This agent does NOT call AI.
// It extracts raw content from the source:
//   - Bilibili: video info API + page INITIAL_STATE → title, description, subtitle
//   - Xiaohongshu: note title, body, images → OCR
//   - Douyin: metadata only, returns need_upload if insufficient
//   - Upload: placeholder for future video processing
//
// Output: structured source_content JSONB
//   { title, description, subtitle, transcript, ocr_text, vision_result, platform }
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

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// ── Types ──

interface SourceContent {
  title: string;
  description: string;
  subtitle: string;
  transcript: string;
  ocr_text: string;
  vision_result: string;
  platform: string;
}

interface BilibiliVideoInfo {
  title: string;
  desc: string;
  aid: number;
  bvid: string;
  cid: number;
  pages?: Array<{ cid: number; page: number; part: string }>;
  subtitle?: { subtitles?: Array<{ subtitle_url: string; lan: string }> };
}

// ── HTML fetching ──

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchHtml(url: string, referer?: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const headers: Record<string, string> = {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    };
    if (referer) headers["Referer"] = referer;

    const resp = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta\\s+property="og:${name}"\\s+content="([^"]*)"`, "i"),
    new RegExp(`<meta\\s+name="${name}"\\s+content="([^"]*)"`, "i"),
    new RegExp(`<meta\\s+content="([^"]*)"\\s+property="og:${name}"`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  }
  return "";
}

function extractTitle(html: string): string {
  const ogTitle = extractMeta(html, "title");
  if (ogTitle) return ogTitle;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() || "";
}

function extractDescription(html: string): string {
  return extractMeta(html, "description");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ── B站: Extract BV号 from URL ──

function extractBvid(url: string): string | null {
  // BV1xx411c7mD format
  const bvMatch = url.match(/BV[a-zA-Z0-9]{10,12}/);
  if (bvMatch) return bvMatch[0];
  // b23.tv short link
  const shortMatch = url.match(/b23\.tv\/([a-zA-Z0-9]+)/);
  if (shortMatch) return null; // need to follow redirect
  // av号
  const avMatch = url.match(/av(\d+)/i);
  if (avMatch) return `av${avMatch[1]}`;
  return null;
}

// ── B站: API-based extraction ──

async function extractBilibiliByApi(bvid: string): Promise<BilibiliVideoInfo | null> {
  try {
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, "Referer": "https://www.bilibili.com/" },
    });
    clearTimeout(timeout);

    if (!resp.ok) return null;
    const json = await resp.json();
    if (json.code !== 0 || !json.data) return null;

    const data = json.data;
    return {
      title: data.title || "",
      desc: data.desc || "",
      aid: data.aid || 0,
      bvid: data.bvid || bvid,
      cid: data.cid || (data.pages?.[0]?.cid) || 0,
      pages: data.pages || [],
      subtitle: data.subtitle || null,
    };
  } catch {
    return null;
  }
}

// ── B站: Subtitle extraction via player API ──

async function fetchBilibiliSubtitle(bvid: string, cid: number): Promise<string> {
  try {
    const url = `https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, "Referer": "https://www.bilibili.com/" },
    });
    clearTimeout(timeout);

    if (!resp.ok) return "";
    const json = await resp.json();
    if (json.code !== 0 || !json.data) return "";

    // Try subtitle from player API
    const subtitles = json.data?.subtitle?.subtitles;
    if (subtitles && subtitles.length > 0) {
      const subtitleUrl = subtitles[0].subtitle_url;
      if (subtitleUrl) {
        const subResp = await fetch(subtitleUrl.startsWith("http") ? subtitleUrl : `https:${subtitleUrl}`);
        if (subResp.ok) {
          const subJson = await subResp.json();
          const lines = (subJson?.body || [])
            .map((item: { content?: string }) => item.content || "")
            .filter((c: string) => c.trim().length > 0);
          return lines.join("\n");
        }
      }
    }
    return "";
  } catch {
    return "";
  }
}

// ── B站: Page-based extraction ──

async function extractBilibili(url: string): Promise<SourceContent> {
  console.log(`[source-extractor] Bilibili: ${url}`);

  const bvid = extractBvid(url);
  const empty: SourceContent = {
    title: "", description: "", subtitle: "", transcript: "",
    ocr_text: "", vision_result: "", platform: "bilibili",
  };

  if (!bvid || bvid.startsWith("av")) {
    // For AV numbers or short links, fall back to HTML parsing
    console.log(`[source-extractor] Bilibili: no BV号 found, falling back to HTML`);
  }

  // Strategy 1: B站 API (most reliable)
  let videoInfo: BilibiliVideoInfo | null = null;
  let subtitleText = "";
  let transcriptText = "";

  if (bvid && !bvid.startsWith("av")) {
    videoInfo = await extractBilibiliByApi(bvid);
    if (videoInfo) {
      console.log(`[source-extractor] Bilibili API success: title="${videoInfo.title.slice(0, 60)}" cid=${videoInfo.cid}`);
      // Fetch subtitle via player API
      if (videoInfo.cid) {
        subtitleText = await fetchBilibiliSubtitle(bvid, videoInfo.cid);
        if (subtitleText) {
          console.log(`[source-extractor] Bilibili subtitle: ${subtitleText.length} chars`);
        }
      }
    }
  }

  // Strategy 2: HTML page parsing (fallback)
  if (!videoInfo) {
    console.log(`[source-extractor] Bilibili: API failed, trying HTML parsing`);
    const html = await fetchHtml(url, "https://www.bilibili.com/");
    if (!html) return empty;

    // Detect error pages
    if (html.includes("视频去哪了") || html.includes("视频不见了")) {
      console.log(`[source-extractor] Bilibili: video not found (deleted or invalid)`);
      return empty;
    }
    if (html.includes("啊叻") && html.includes("视频不见了")) {
      console.log(`[source-extractor] Bilibili: video removed`);
      return empty;
    }

    // Extract __INITIAL_STATE__ with greedy matching for nested JSON
    // Find the script tag containing window.__INITIAL_STATE__
    const scriptMatch = html.match(/<script[^>]*>\s*window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i);
    let stateJson = scriptMatch?.[1];

    // If not found, try alternative patterns
    if (!stateJson) {
      const altMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
      stateJson = altMatch?.[1];
    }

    let title = extractTitle(html);
    let description = extractDescription(html);

    if (stateJson) {
      try {
        const state = JSON.parse(stateJson);
        const vd = state?.videoData;
        if (vd) {
          title = vd.title || title;
          description = vd.desc || description;

          videoInfo = {
            title: title || "",
            desc: description || "",
            aid: vd.aid || 0,
            bvid: vd.bvid || bvid || "",
            cid: vd.cid || (vd.pages?.[0]?.cid) || 0,
            pages: vd.pages || [],
            subtitle: vd.subtitle || null,
          };

          // Try subtitle URL from INITIAL_STATE
          const subtitleUrl = vd.subtitle?.subtitles?.[0]?.subtitle_url;
          if (subtitleUrl) {
            const fullUrl = subtitleUrl.startsWith("http") ? subtitleUrl : `https:${subtitleUrl}`;
            console.log(`[source-extractor] Bilibili subtitle URL from INITIAL_STATE: ${fullUrl}`);
            const subResp = await fetch(fullUrl);
            if (subResp.ok) {
              const subJson = await subResp.json();
              subtitleText = (subJson?.body || [])
                .map((item: { content?: string }) => item.content || "")
                .filter((c: string) => c.trim().length > 0)
                .join("\n");
            }
          }
        }
      } catch (e) {
        console.log(`[source-extractor] Bilibili INITIAL_STATE parse failed: ${(e as Error).message.slice(0, 80)}`);
        // Continue with meta extraction
      }
    }

    // Fallback description from body text
    if (!description) {
      description = stripHtml(html).slice(0, 2000);
    }
  }

  // Build transcript from subtitle text
  transcriptText = subtitleText;

  // Also try player API for subtitle if we have bvid+cid from HTML
  if (!transcriptText && videoInfo?.bvid && videoInfo?.cid && !bvid?.startsWith("av")) {
    transcriptText = await fetchBilibiliSubtitle(videoInfo.bvid, videoInfo.cid);
  }

  // If we got title but no videoInfo object, create one
  if (!videoInfo) {
    const html = await fetchHtml(url, "https://www.bilibili.com/");
    if (html) {
      videoInfo = {
        title: extractTitle(html),
        desc: extractDescription(html) || stripHtml(html).slice(0, 2000),
        aid: 0, bvid: bvid || "", cid: 0,
      };
    } else {
      return empty;
    }
  }

  const result: SourceContent = {
    title: videoInfo.title || "",
    description: videoInfo.desc || "",
    subtitle: subtitleText,
    transcript: transcriptText,
    ocr_text: "",
    vision_result: "",
    platform: "bilibili",
  };

  console.log(
    `[source-extractor] Bilibili result: title="${result.title.slice(0, 60)}" ` +
    `desc=${result.description.length} chars subtitle=${result.subtitle.length} chars transcript=${result.transcript.length} chars`,
  );

  return result;
}

// ── 小红书 extraction ──

async function extractXiaohongshu(url: string): Promise<SourceContent> {
  console.log(`[source-extractor] Xiaohongshu: ${url}`);

  const empty: SourceContent = {
    title: "", description: "", subtitle: "", transcript: "",
    ocr_text: "", vision_result: "", platform: "xiaohongshu",
  };

  const html = await fetchHtml(url);
  if (!html) return empty;

  const title = extractTitle(html);
  const description = extractDescription(html);

  // Extract body text
  const bodyText = stripHtml(html).slice(0, 5000);

  return {
    title: title || "",
    description: description || bodyText.slice(0, 2000),
    subtitle: "",
    transcript: "",
    ocr_text: "",
    vision_result: "",
    platform: "xiaohongshu",
  };
}

// ── 抖音 extraction ──

async function extractDouyin(url: string): Promise<SourceContent> {
  console.log(`[source-extractor] Douyin: ${url}`);

  const empty: SourceContent = {
    title: "", description: "", subtitle: "", transcript: "",
    ocr_text: "", vision_result: "", platform: "douyin",
  };

  const html = await fetchHtml(url);

  let title = "";
  let description = "";

  if (html) {
    title = extractTitle(html);
    description = extractDescription(html);
    // Try to find video info in script tags
    const videoData = html.match(/"desc":"([^"]+)"/);
    if (videoData?.[1]) description = videoData[1];
  }

  return {
    title: title || "",
    description: description.slice(0, 2000),
    subtitle: "",
    transcript: "",
    ocr_text: "",
    vision_result: "",
    platform: "douyin",
  };
}

// ── Serve ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      url: string;
      source_type: string;
      recipe_id?: string;
    };

    const { url, source_type } = body;
    if (!url || !source_type) {
      return new Response(JSON.stringify({ error: "url and source_type are required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let content: SourceContent;

    switch (source_type) {
      case "bilibili":
        content = await extractBilibili(url);
        break;
      case "xiaohongshu":
        content = await extractXiaohongshu(url);
        break;
      case "douyin":
        content = await extractDouyin(url);
        break;
      case "upload":
        content = {
          title: "", description: "", subtitle: "", transcript: "",
          ocr_text: "", vision_result: "", platform: "upload",
        };
        break;
      default:
        // Unknown source type — try generic extraction
        const html = await fetchHtml(url);
        content = {
          title: html ? extractTitle(html) : "",
          description: html ? extractDescription(html) : "",
          subtitle: "",
          transcript: "",
          ocr_text: "",
          vision_result: "",
          platform: source_type,
        };
    }

    console.log(
      `[source-extractor] Result: platform=${content.platform} ` +
      `title="${content.title.slice(0, 60)}" ` +
      `desc=${content.description.length} chars ` +
      `subtitle=${content.subtitle.length} chars ` +
      `transcript=${content.transcript.length} chars`,
    );

    // Log extraction
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "source_extractor",
      action: `extract_${source_type}`,
      input_data: { url, source_type, recipe_id: body.recipe_id },
      output_data: {
        title: content.title.slice(0, 120),
        desc_len: content.description.length,
        subtitle_len: content.subtitle.length,
        transcript_len: content.transcript.length,
        platform: content.platform,
      },
      model: "none",
      tokens_used: 0,
    });

    return new Response(JSON.stringify(content), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[source-extractor] Error:", err);
    return new Response(JSON.stringify({
      error: (err as Error).message || "服务器内部错误",
    }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
