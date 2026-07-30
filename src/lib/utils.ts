import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
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

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let withProtocol = trimmed;
  if (!URL_PROTOCOL_RE.test(trimmed)) {
    withProtocol = `https://${trimmed}`;
  }

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
