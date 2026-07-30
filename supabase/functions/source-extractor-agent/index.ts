// ============================================
// Nancy OS — Source Extractor Agent v4
// Platform-specific content extraction layer.
//
// Extracts raw content from the source:
//   - Bilibili: video info API → title, description, subtitle, tags
//               description analyzed for recipe content → confidence
//   - Xiaohongshu: HTML → title, body text, images → OCR via DeepSeek Vision
//   - Douyin: HTML → best-effort metadata, transparent failure
//   - Manual: passthrough (content provided by user)
//
// Output: structured source_content + confidence + source_material
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

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

interface ExtractionResult {
  content: SourceContent;
  extraction_error?: string;
  extraction_status: "ok" | "partial" | "failed";
}

interface BilibiliVideoInfo {
  title: string;
  desc: string;
  aid: number;
  bvid: string;
  cid: number;
  pages?: Array<{ cid: number; page: number; part: string }>;
  subtitle?: { subtitles?: Array<{ subtitle_url: string; lan: string }> };
  tags?: Array<{ tag_name: string }>;
}

// ── HTTP helpers ──

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function fetchHtml(url: string, referer?: string, extraHeaders?: Record<string, string>): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const headers: Record<string, string> = {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      ...(referer ? { "Referer": referer } : {}),
      ...(extraHeaders || {}),
    };
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

function extractImages(html: string): string[] {
  const images: string[] = [];

  // og:image meta tags
  const ogMatches = html.matchAll(/<meta\s+property="og:image"\s+content="([^"]+)"/gi);
  for (const m of ogMatches) {
    if (m[1] && !images.includes(m[1])) images.push(m[1]);
  }

  // img tags with src (filter out icons, logos, avatars)
  const imgMatches = html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)"[^>]*>/gi);
  for (const m of imgMatches) {
    const src = m[1];
    // Skip small/utility images
    if (
      src.includes("avatar") || src.includes("icon") || src.includes("logo") ||
      src.includes("favicon") || src.includes("emoji") || src.includes("static")
    ) continue;
    if (!images.includes(src)) images.push(src);
  }

  return images.slice(0, 20); // Max 20 images
}

// ── B站: Content quality analysis ──

const RECIPE_INDICATORS = [
  // Quantities
  /\d+\s*(克|g|G|千克|kg|公斤|斤|两)/,
  /\d+\s*(毫升|ml|ML|升|L)/,
  /\d+\s*(勺|汤匙|茶匙|匙|杯|碗)/,
  // Step patterns
  /[1-9][、，.．)]\s*\S/,
  /[①②③④⑤⑥⑦⑧⑨⑩]/,
  /步骤\s*[1-9]/,
  // Cooking verbs
  /(翻炒|焖|煮|蒸|煎|炸|烤|炖|烧|焯|腌制|切|剁|搅拌|混合)/,
  // Ingredient keywords
  /食材[：:]/,
  /用料[：:]/,
  /准备[：:]/,
  /做法[：:]/,
  // Common ingredients
  /(鸡|猪|牛|羊|鱼|虾|蛋|豆腐|面|米|油|盐|酱|醋|糖|料酒|生抽|老抽|蚝油)/,
];

function analyzeDescriptionForRecipe(desc: string): { hasRecipeContent: boolean; matchCount: number } {
  if (!desc || desc.length < 20) return { hasRecipeContent: false, matchCount: 0 };

  let matchCount = 0;
  for (const pattern of RECIPE_INDICATORS) {
    if (pattern.test(desc)) matchCount++;
  }

  // Need at least 2 indicators for medium confidence
  return { hasRecipeContent: matchCount >= 2, matchCount };
}

function buildSourceMaterial(parts: { label: string; content: string }[]): string {
  return parts
    .filter(p => p.content.trim().length > 0)
    .map(p => `${p.label}:\n${p.content.trim()}`)
    .join("\n\n");
}

// ── XHS: Image OCR via DeepSeek Vision ──

async function ocrImagesWithDeepSeek(imageUrls: string[]): Promise<string> {
  if (!imageUrls.length || !DEEPSEEK_API_KEY) return "";

  const maxImages = 5;
  const urls = imageUrls.slice(0, maxImages);

  // Download images and convert to base64
  const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
  for (const imgUrl of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      const resp = await fetch(imgUrl, {
        signal: controller.signal,
        headers: { "User-Agent": UA },
      });
      clearTimeout(timeout);
      if (!resp.ok) continue;

      const contentType = resp.headers.get("content-type") || "image/jpeg";
      const buffer = await resp.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const dataUrl = `data:${contentType};base64,${base64}`;
      imageParts.push({ type: "image_url", image_url: { url: dataUrl } });
    } catch {
      // Skip failed images
      continue;
    }
  }

  if (imageParts.length === 0) return "";

  // Call DeepSeek Vision for OCR
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 2000,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "你是一个OCR文字提取工具。只提取图片中的中文文字，包括食材名称、用量、步骤编号和描述。以纯文本输出，保持原文格式。不要添加任何解释。如果没有文字，回复'无文字'。",
          },
          {
            role: "user",
            content: [
              ...imageParts,
              { type: "text", text: "请提取这些图片中的食谱相关文字内容，包括食材清单和制作步骤。" },
            ],
          },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      console.log(`[source-extractor] OCR API error: ${resp.status}`);
      return "";
    }

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content || "";
    if (text === "无文字" || text === "") return "";
    return text;
  } catch (err) {
    console.log(`[source-extractor] OCR failed: ${(err as Error).message}`);
    return "";
  }
}

// ── B站: Extract BV号 ──

function extractBvid(url: string): string | null {
  const bvMatch = url.match(/BV[a-zA-Z0-9]{10,12}/);
  if (bvMatch) return bvMatch[0];
  const avMatch = url.match(/av(\d+)/i);
  if (avMatch) return `av${avMatch[1]}`;
  return null;
}

// ── B站: API-based extraction ──

async function extractBilibiliByApi(bvid: string): Promise<BilibiliVideoInfo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
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
      tags: data.tags || [],
    };
  } catch {
    return null;
  }
}

// ── B站: Subtitle extraction ──

async function fetchBilibiliSubtitle(bvid: string, cid: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`, {
      signal: controller.signal,
      headers: { "User-Agent": UA, "Referer": "https://www.bilibili.com/" },
    });
    clearTimeout(timeout);
    if (!resp.ok) return "";
    const json = await resp.json();
    if (json.code !== 0 || !json.data) return "";
    const subtitles = json.data?.subtitle?.subtitles;
    if (subtitles && subtitles.length > 0) {
      const subtitleUrl = subtitles[0].subtitle_url;
      if (subtitleUrl) {
        const fullUrl = subtitleUrl.startsWith("http") ? subtitleUrl : `https:${subtitleUrl}`;
        const subResp = await fetch(fullUrl);
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

// ═══════════════════════════════════════════
// B站 extraction
// ═══════════════════════════════════════════

async function extractBilibili(url: string): Promise<ExtractionResult> {
  console.log(`[source-extractor] Bilibili: ${url}`);

  const empty = (): ExtractionResult => ({
    content: { title: "", description: "", subtitle: "", transcript: "", ocr_text: "", vision_result: "", platform: "bilibili" },
    extraction_status: "failed",
    extraction_error: "无法访问 B站页面或视频不存在",
  });

  const bvid = extractBvid(url);
  if (!bvid || bvid.startsWith("av")) {
    return { ...empty(), extraction_error: "无法解析视频 BV 号，请检查链接格式" };
  }

  // Strategy 1: B站 API
  const videoInfo = await extractBilibiliByApi(bvid);
  if (!videoInfo) {
    // Try HTML fallback
    const html = await fetchHtml(url, "https://www.bilibili.com/");
    if (!html) {
      return { ...empty(), extraction_error: "无法访问 B站（412 安全风控），请稍后重试" };
    }
    if (html.includes("视频去哪了") || html.includes("视频不见了")) {
      return { ...empty(), extraction_error: "视频不存在或已被删除" };
    }

    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (stateMatch) {
      try {
        const state = JSON.parse(stateMatch[1]);
        const vd = state?.videoData;
        if (vd) {
          const title = vd.title || extractTitle(html);
          const desc = vd.desc || "";
          const { hasRecipeContent } = analyzeDescriptionForRecipe(desc);
          const material = buildSourceMaterial([
            { label: "标题", content: title },
            { label: "视频简介", content: desc },
          ]);
          return {
            content: {
              title,
              description: desc,
              subtitle: "",
              transcript: hasRecipeContent ? desc : "",
              ocr_text: "",
              vision_result: material,
              platform: "bilibili",
            },
            extraction_status: title ? (hasRecipeContent ? "ok" : "partial") : "failed",
            extraction_error: title
              ? (hasRecipeContent ? undefined : "仅获取到标题，简介无食谱内容")
              : "无法从页面提取视频信息",
          };
        }
      } catch { /* fall through */ }
    }

    const bodyText = stripHtml(html).slice(0, 3000);
    const title = extractTitle(html);
    return {
      content: { title, description: bodyText, subtitle: "", transcript: "", ocr_text: "", vision_result: `标题:\n${title}`, platform: "bilibili" },
      extraction_status: title ? "partial" : "failed",
      extraction_error: title ? "仅获取到标题（HTML解析），无字幕数据" : "无法获取任何内容",
    };
  }

  // Fetch subtitle
  let subtitleText = "";
  if (videoInfo.cid) {
    subtitleText = await fetchBilibiliSubtitle(bvid, videoInfo.cid);
  }

  // Extract tags from video info
  const tags: string[] = [];
  if (videoInfo.tags && Array.isArray(videoInfo.tags)) {
    for (const t of videoInfo.tags) {
      if (t.tag_name) tags.push(t.tag_name);
    }
  }

  // Analyze description for recipe content
  const desc = videoInfo.desc || "";
  const { hasRecipeContent, matchCount } = analyzeDescriptionForRecipe(desc);

  // Determine confidence and content routing
  let confidence: string;
  let transcript = "";

  if (subtitleText) {
    // CC subtitles available — highest quality
    confidence = "high";
    transcript = subtitleText;
    // Also include description in transcript if it has recipe content
    if (hasRecipeContent) {
      transcript = subtitleText + "\n\n--- 视频简介中的食谱信息 ---\n" + desc;
    }
  } else if (hasRecipeContent) {
    // No subtitle but description has recipe content
    confidence = "medium";
    transcript = desc;
  } else {
    // Only title and short description — can't extract recipe
    confidence = "low";
  }

  // Build source_material
  const materialParts: { label: string; content: string }[] = [
    { label: "标题", content: videoInfo.title || "" },
  ];
  if (desc) materialParts.push({ label: "视频简介", content: desc });
  if (subtitleText) materialParts.push({ label: "原始字幕", content: subtitleText.slice(0, 5000) });
  if (tags.length > 0) materialParts.push({ label: "标签", content: tags.join("、") });

  const sourceMaterial = buildSourceMaterial(materialParts);

  const hasContent = videoInfo.title || desc || subtitleText;

  return {
    content: {
      title: videoInfo.title || "",
      description: desc,
      subtitle: subtitleText,
      transcript,
      ocr_text: "",
      vision_result: sourceMaterial,
      platform: "bilibili",
    },
    extraction_status: subtitleText || hasRecipeContent ? "ok" : (hasContent ? "partial" : "failed"),
    extraction_error: subtitleText
      ? undefined
      : (hasRecipeContent
        ? undefined
        : (hasContent ? `无字幕且简介无食谱内容（匹配指标:${matchCount}），confidence=low` : "无法提取任何内容")),
  };
}

// ═══════════════════════════════════════════
// 小红书 extraction
// ═══════════════════════════════════════════

function extractXiaohongshuContent(html: string): { body: string; tags: string[] } {
  let body = "";
  const tags: string[] = [];

  // Try to find note content in various XHS page structures
  // XHS note content is typically in a <div class="note-content"> or similar
  const contentPatterns = [
    /<div[^>]*class="[^"]*note-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="detail-desc"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      body = stripHtml(m[1]).slice(0, 5000);
      break;
    }
  }

  // Extract hashtags from content
  const hashtagMatches = body.matchAll(/#([^\s#]+)/g);
  for (const m of hashtagMatches) {
    if (m[1] && !tags.includes(m[1])) tags.push(m[1]);
  }

  // Also try meta keywords
  const keywords = extractMeta(html, "keywords");
  if (keywords) {
    const kwList = keywords.split(/[,，]/).map(k => k.trim()).filter(k => k.length > 0);
    for (const k of kwList) {
      if (!tags.includes(k)) tags.push(k);
    }
  }

  return { body, tags };
}

async function extractXiaohongshu(url: string): Promise<ExtractionResult> {
  console.log(`[source-extractor] Xiaohongshu: ${url}`);

  const empty = (error: string): ExtractionResult => ({
    content: { title: "", description: "", subtitle: "", transcript: "", ocr_text: "", vision_result: "", platform: "xiaohongshu" },
    extraction_status: "failed",
    extraction_error: error,
  });

  const html = await fetchHtml(url);
  if (!html) {
    return empty("无法访问小红书页面，可能需要登录或Cookie");
  }

  if (html.includes("请登录") || html.includes("login")) {
    return empty("小红书需要登录才能查看，请尝试在App中分享链接");
  }
  if (html.length < 500) {
    return empty("小红书返回空页面，可能被风控拦截");
  }

  const title = extractTitle(html);
  const ogDescription = extractDescription(html);
  const { body, tags } = extractXiaohongshuContent(html);

  // Build description from best available content
  const descriptionParts: string[] = [];
  if (ogDescription) descriptionParts.push(ogDescription);
  if (body && body !== ogDescription) descriptionParts.push(body);
  if (tags.length > 0) descriptionParts.push(`标签：${tags.join("、")}`);

  const description = descriptionParts.join("\n\n").trim();

  // Extract and OCR images
  const images = extractImages(html);
  let ocrText = "";

  if (images.length > 0 && DEEPSEEK_API_KEY) {
    console.log(`[source-extractor] XHS OCR: ${images.length} images, running OCR on up to 5...`);
    ocrText = await ocrImagesWithDeepSeek(images);
    if (ocrText) {
      console.log(`[source-extractor] XHS OCR: extracted ${ocrText.length} chars`);
    } else {
      console.log(`[source-extractor] XHS OCR: no text found in images`);
    }
  }

  // Determine content quality
  const hasBody = body.length > 50;
  const hasTitle = title.length > 0;
  const hasOcr = ocrText.length > 50;

  let extractionStatus: "ok" | "partial" | "failed";
  let extractionError: string | undefined;

  if (hasBody || hasOcr) {
    extractionStatus = "ok";
  } else if (hasTitle) {
    extractionStatus = "partial";
    extractionError = "仅获取到标题，正文和图片均无食谱内容";
  } else {
    extractionStatus = "failed";
    extractionError = "无法提取小红书笔记内容，请确认链接有效";
  }

  // Build source_material
  const materialParts: { label: string; content: string }[] = [];
  if (hasTitle) materialParts.push({ label: "标题", content: title });
  if (description) materialParts.push({ label: "正文", content: description.slice(0, 5000) });
  if (ocrText) materialParts.push({ label: "OCR图片文字", content: ocrText.slice(0, 5000) });

  const sourceMaterial = buildSourceMaterial(materialParts);

  return {
    content: {
      title: title || "",
      description: description.slice(0, 10000),
      subtitle: "",
      transcript: "",
      ocr_text: ocrText,
      vision_result: sourceMaterial,
      platform: "xiaohongshu",
    },
    extraction_status: extractionStatus,
    extraction_error: extractionError,
  };
}

// ═══════════════════════════════════════════
// 抖音 extraction
// ═══════════════════════════════════════════

async function extractDouyin(url: string): Promise<ExtractionResult> {
  console.log(`[source-extractor] Douyin: ${url}`);

  const result: ExtractionResult = {
    content: { title: "", description: "", subtitle: "", transcript: "", ocr_text: "", vision_result: "", platform: "douyin" },
    extraction_status: "failed",
    extraction_error: "抖音平台策略限制，无法程序化获取视频内容",
  };

  const html = await fetchHtml(url);
  if (!html) {
    result.extraction_error = "无法访问抖音页面，可能触发了安全验证";
    return result;
  }

  // Check for blocked/captcha
  if (html.includes("验证") || html.includes("captcha") || html.includes("sec_verify")) {
    result.extraction_error = "抖音要求安全验证，请尝试在App中复制链接";
    return result;
  }

  const title = extractTitle(html);
  const desc = extractDescription(html);

  // Try embedded JSON data
  let extraDesc = "";
  const jsonMatch = html.match(/"desc":"([^"]+)"/);
  if (jsonMatch?.[1]) extraDesc = jsonMatch[1];

  const description = [desc, extraDesc].filter(Boolean).join("\n");

  if (title || description) {
    result.content.title = title || "";
    result.content.description = description.slice(0, 2000);
    result.extraction_status = "partial";
    result.extraction_error = title
      ? "仅获取到标题和简介，抖音视频正文（食谱步骤/食材）无法自动提取。请使用 ✍️ 手动输入补充食材和步骤。"
      : "无法获取视频详情。抖音限制较严格，建议手动输入食谱。";
  } else {
    result.extraction_error = "无法获取任何内容。抖音策略限制较严格，建议：\n1. 使用 ✍️ 手动输入模式\n2. 在小红书或B站搜索相同食谱";
  }

  return result;
}

// ═══════════════════════════════════════════
// Serve
// ═══════════════════════════════════════════

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

    const { url, source_type, recipe_id } = body;
    if (!url || !source_type) {
      return new Response(JSON.stringify({ error: "url and source_type are required" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let result: ExtractionResult;

    switch (source_type) {
      case "bilibili":
        result = await extractBilibili(url);
        break;
      case "xiaohongshu":
        result = await extractXiaohongshu(url);
        break;
      case "douyin":
        result = await extractDouyin(url);
        break;
      case "manual":
        // Manual entry — content already provided by user, nothing to extract
        result = {
          content: { title: "", description: "", subtitle: "", transcript: "", ocr_text: "", vision_result: "", platform: "manual" },
          extraction_status: "ok",
        };
        break;
      default:
        result = {
          content: { title: "", description: "", subtitle: "", transcript: "", ocr_text: "", vision_result: "", platform: source_type },
          extraction_status: "failed",
          extraction_error: `未知来源类型: ${source_type}`,
        };
    }

    console.log(
      `[source-extractor] Result: platform=${result.content.platform} ` +
      `title="${result.content.title.slice(0, 60)}" ` +
      `desc=${result.content.description.length} chars ` +
      `subtitle=${result.content.subtitle.length} chars ` +
      `transcript=${result.content.transcript.length} chars ` +
      `ocr=${result.content.ocr_text.length} chars ` +
      `status=${result.extraction_status} ` +
      `error=${result.extraction_error || "none"}`,
    );

    // Log extraction
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "source_extractor",
      action: `extract_${source_type}`,
      input_data: { url, source_type, recipe_id },
      output_data: {
        title: result.content.title.slice(0, 120),
        desc_len: result.content.description.length,
        subtitle_len: result.content.subtitle.length,
        transcript_len: result.content.transcript.length,
        platform: result.content.platform,
        extraction_status: result.extraction_status,
        extraction_error: result.extraction_error,
      },
      model: "none",
      tokens_used: 0,
    });

    // Also write to recipe_extraction_logs if recipe_id provided
    if (recipe_id) {
      await supabase.from("recipe_extraction_logs").insert({
        recipe_id,
        source_type,
        extractor: "source-extractor-agent",
        status: result.extraction_status,
        error_message: result.extraction_error || null,
      });
    }

    return new Response(JSON.stringify({
      ...result.content,
      extraction_status: result.extraction_status,
      extraction_error: result.extraction_error,
      source_material: result.content.vision_result || buildSourceMaterial([
        { label: "标题", content: result.content.title },
        { label: "正文", content: result.content.description },
      ]),
    }), {
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
