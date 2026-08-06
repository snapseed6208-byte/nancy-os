import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function today(): string {
  return formatDate(new Date());
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

export function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = weekDays[d.getDay()];
  return `${m}月${day}日 ${wd}`;
}

// ── URL normalization ──

const URL_PROTOCOL_RE = /^https?:\/\//i;
const SAFE_PROTOCOLS = ["http:", "https:"];

/**
 * Extract the first valid URL from arbitrary text.
 * Handles pasted text like "抖音视频：\nhttps://v.douyin.com/xxxx" or "B站：b23.tv/test".
 */
export function extractFirstUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Step 1: Match full URLs with protocol (https://example.com/path)
  const protocolMatch = trimmed.match(/https?:\/\/[^\s一-鿿぀-ゟ가-힯]+/i);
  if (protocolMatch) {
    // Clean trailing punctuation that's unlikely to be part of the URL
    return protocolMatch[0].replace(/[。,，！!？?）\)】】》>]+$/, "");
  }

  // Step 2: Match www.xxx.com patterns
  const wwwMatch = trimmed.match(/www\.[^\s一-鿿぀-ゟ가-힯]+\.[^\s一-鿿぀-ゟ가-힯]*/i);
  if (wwwMatch) {
    return wwwMatch[0].replace(/[。,，！!？?）\)】】》>]+$/, "");
  }

  // Step 3: Match bare domain patterns (b23.tv/xxx, example.com/path)
  // Only match if the input looks like it contains a domain (has a dot with TLD)
  const domainMatch = trimmed.match(/(?:^|\s)([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)*\.[a-zA-Z]{2,}(?:\/[^\s一-鿿぀-ゟ가-힯]*)?)/);
  if (domainMatch) {
    return domainMatch[1].replace(/[。,，！!？?）\)】】》>]+$/, "");
  }

  return null;
}

/**
 * Normalize a URL string: extract → add protocol → validate.
 * Accepts raw text (may contain surrounding description) or a bare URL.
 * Returns a clean absolute URL or null.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Step 1: Extract the URL candidate from the text
  const extracted = extractFirstUrl(trimmed);
  if (!extracted) return null;

  // Step 2: Add protocol if missing
  let withProtocol = extracted;
  if (!URL_PROTOCOL_RE.test(extracted)) {
    withProtocol = `https://${extracted}`;
  }

  // Step 3: Validate as a proper URL
  try {
    const parsed = new URL(withProtocol);
    if (!SAFE_PROTOCOLS.includes(parsed.protocol)) return null;
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

// ── Platform detection ──

export function detectUrlPlatform(url: string): string {
  const lowered = url.toLowerCase();
  if (lowered.includes("bilibili.com") || lowered.includes("b23.tv")) return "bilibili";
  if (lowered.includes("youtube.com") || lowered.includes("youtu.be")) return "youtube";
  if (lowered.includes("douyin.com") || lowered.includes("v.douyin.com")) return "douyin";
  if (lowered.includes("xiaohongshu.com") || lowered.includes("xhslink.com")) return "xiaohongshu";
  if (lowered.includes("github.com")) return "github";
  return "other";
}

// ── Video ID extraction & embed URL building ──

const BILIBILI_VID_RE = /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/;
const BILIBILI_AV_RE = /bilibili\.com\/video\/av(\d+)/i;
const YOUTUBE_WATCH_RE = /[?&]v=([a-zA-Z0-9_-]{11})/;
const YOUTUBE_SHORT_RE = /youtu\.be\/([a-zA-Z0-9_-]{11})/;

export function extractVideoId(url: string, platform: string): string | null {
  if (platform === "bilibili") {
    // BV号优先
    const bvMatch = url.match(BILIBILI_VID_RE);
    if (bvMatch) return bvMatch[1];
    // av号作为 fallback
    const avMatch = url.match(BILIBILI_AV_RE);
    if (avMatch) return `av${avMatch[1]}`;
    return null;
  }
  if (platform === "youtube") {
    const m = url.match(YOUTUBE_WATCH_RE) || url.match(YOUTUBE_SHORT_RE);
    return m ? m[1] : null;
  }
  return null;
}

export function extractPageFromUrl(url: string): number {
  try {
    const parsed = new URL(url);
    const p = parsed.searchParams.get("p");
    if (p) return parseInt(p, 10) || 1;
  } catch { /* ignore */ }
  return 1;
}

export function buildEmbedUrl(platform: string, videoId: string, page = 1): string | null {
  if (platform === "bilibili") {
    return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(videoId)}&page=${page}&high_quality=1`;
  }
  if (platform === "youtube") {
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
  }
  return null;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/maxresdefault.jpg`;
}

/**
 * B站缩略图 — B站 API (api.bilibili.com) 有 CORS 限制，
 * 浏览器直接调用会被阻止。如需缩略图，可通过 Edge Function 代理。
 * 当前返回 null，B站卡片使用渐变色占位。
 */
export function getBilibiliThumbnail(_videoId: string): null {
  return null;
}

export function getDefaultVideoTitle(platform: string): string {
  const map: Record<string, string> = {
    bilibili: "B站训练视频",
    youtube: "YouTube训练视频",
    douyin: "抖音训练视频",
    xiaohongshu: "小红书训练视频",
  };
  return map[platform] || "训练视频";
}
