// ============================================
// Nancy OS — Source Extractor Agent v1
// Platform-specific content extraction layer.
//
// This agent does NOT call AI.
// It extracts raw content from the source:
//   - Bilibili: video title, description, subtitles
//   - Xiaohongshu: note title, body, images → OCR
//   - Douyin: metadata only, returns need_upload if insufficient
//   - Upload: placeholder for future video processing
//
// Output: structured source_content JSONB
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

// ── HTML fetching ──

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });
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
  const ogDesc = extractMeta(html, "description");
  if (ogDesc) return ogDesc;
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m?.[1] || "";
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

// ── Platform extractors ──

interface SourceContent {
  title: string;
  description: string;
  transcript: string;
  ocr_text: string;
  images: string[];
  platform: string;
  status?: string;
}

async function extractBilibili(url: string): Promise<SourceContent> {
  console.log(`[source-extractor] Bilibili: ${url}`);

  const html = await fetchHtml(url);
  if (!html) {
    return { title: "", description: "", transcript: "", ocr_text: "", images: [], platform: "bilibili", status: "need_upload" };
  }

  // Extract embedded video data (B站 embeds initial state in <script>)
  let title = extractTitle(html);
  let description = extractDescription(html);

  // Try to find __INITIAL_STATE__ or window.__playinfo__
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      title = state?.videoData?.title || title;
      description = state?.videoData?.desc || description;

      // Check for subtitle availability
      const subtitleUrl = state?.videoData?.subtitle?.subtitles?.[0]?.subtitle_url;
      if (subtitleUrl) {
        console.log(`[source-extractor] Bilibili subtitle found: ${subtitleUrl}`);
        const subtitleResp = await fetch(`https:${subtitleUrl}`);
        if (subtitleResp.ok) {
          const subtitleJson = await subtitleResp.json();
          const transcript = (subtitleJson?.body || [])
            .map((item: { content?: string }) => item.content || "")
            .join("\n");
          if (transcript.length > 50) {
            return {
              title: title || "",
              description: description || "",
              transcript,
              ocr_text: "",
              images: [],
              platform: "bilibili",
              status: "ok",
            };
          }
        }
      }
    } catch { /* state parse failed, continue with HTML extraction */ }
  }

  // Fallback: extract body text as best-effort description
  const bodyText = stripHtml(html).slice(0, 3000);
  const hasContent = title.length > 0 || bodyText.length > 100;

  return {
    title: title || "",
    description: (description || bodyText).slice(0, 2000),
    transcript: "",
    ocr_text: "",
    images: [],
    platform: "bilibili",
    status: hasContent ? "ok" : "need_upload",
  };
}

async function extractXiaohongshu(url: string): Promise<SourceContent> {
  console.log(`[source-extractor] Xiaohongshu: ${url}`);

  const html = await fetchHtml(url);
  if (!html) {
    return { title: "", description: "", transcript: "", ocr_text: "", images: [], platform: "xiaohongshu", status: "need_upload" };
  }

  const title = extractTitle(html);
  const description = extractDescription(html);

  // Extract images from meta tags
  const images: string[] = [];
  const imgMatches = html.matchAll(/<meta\s+property="og:image"\s+content="([^"]*)"/gi);
  for (const m of imgMatches) {
    if (m[1]) images.push(m[1]);
  }

  // Extract body text
  const bodyText = stripHtml(html).slice(0, 5000);

  const hasContent = title.length > 0 || bodyText.length > 100 || images.length > 0;

  return {
    title: title || "",
    description: description || bodyText.slice(0, 2000),
    transcript: "",
    ocr_text: "",
    images,
    platform: "xiaohongshu",
    status: hasContent ? "ok" : "need_upload",
  };
}

async function extractDouyin(url: string): Promise<SourceContent> {
  console.log(`[source-extractor] Douyin: ${url}`);

  const html = await fetchHtml(url);

  let title = "";
  let description = "";

  if (html) {
    title = extractTitle(html);
    description = extractDescription(html);
    // Also try to find video info in script tags
    const videoData = html.match(/"desc":"([^"]+)"/);
    if (videoData?.[1]) description = videoData[1];
  }

  // Douyin: if we only have title, that's not enough — return need_upload
  const hasRealContent = description.length > 20 || (html && stripHtml(html).length > 200);

  return {
    title: title || "",
    description: description.slice(0, 2000),
    transcript: "",
    ocr_text: "",
    images: [],
    platform: "douyin",
    status: hasRealContent ? "ok" : "need_upload",
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
        // Placeholder for future video upload processing
        content = {
          title: "", description: "", transcript: "", ocr_text: "", images: [],
          platform: "upload",
          status: "need_upload",
        };
        break;
      default:
        // Unknown source type — try generic extraction
        const html = await fetchHtml(url);
        content = {
          title: html ? extractTitle(html) : "",
          description: html ? extractDescription(html) : "",
          transcript: "",
          ocr_text: "",
          images: [],
          platform: source_type,
          status: "ok",
        };
    }

    console.log(
      `[source-extractor] Result: platform=${content.platform} ` +
      `title="${content.title.slice(0, 60)}" ` +
      `transcript=${content.transcript.length} chars ` +
      `status=${content.status}`,
    );

    // Log extraction
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "source_extractor",
      action: `extract_${source_type}`,
      input_data: { url, source_type, recipe_id: body.recipe_id },
      output_data: {
        title: content.title.slice(0, 120),
        transcript_len: content.transcript.length,
        status: content.status,
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
