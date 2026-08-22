export interface BilibiliMetadata {
  title: string | null;
  cover_url: string | null;
  description: string | null;
  author: string | null;
  duration_seconds: number | null;
  aid: number | null;
  cid: number | null;
  bvid: string | null;
}

export function emptyBilibiliMetadata(bvid: string | null, aid: number | null): BilibiliMetadata {
  return { title: null, cover_url: null, description: null, author: null, duration_seconds: null, aid, cid: null, bvid };
}

export function extractBvidFromUrl(url: string): string | null {
  const match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
  return match ? `BV${match[1].slice(2)}` : null;
}

export function extractAidFromUrl(url: string): number | null {
  const match = url.match(/bilibili\.com\/video\/av(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function extractPageFromBilibiliUrl(url: string): number {
  try {
    const page = Number(new URL(url).searchParams.get("p"));
    return Number.isInteger(page) && page > 0 ? page : 1;
  } catch {
    return 1;
  }
}

export function isBilibiliUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "b23.tv" || host.endsWith(".b23.tv")
      || host === "bilibili.com" || host.endsWith(".bilibili.com");
  } catch {
    return false;
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseBilibiliApiPayload(
  payload: unknown,
  fallbackBvid: string | null,
  fallbackAid: number | null,
): BilibiliMetadata | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.code !== 0 || !root.data || typeof root.data !== "object") return null;
  const data = root.data as Record<string, unknown>;
  const owner = data.owner && typeof data.owner === "object" ? data.owner as Record<string, unknown> : {};
  return {
    title: stringValue(data.title),
    cover_url: stringValue(data.pic),
    description: stringValue(data.desc),
    author: stringValue(owner.name),
    duration_seconds: numberValue(data.duration),
    aid: numberValue(data.aid) ?? fallbackAid,
    cid: numberValue(data.cid),
    bvid: stringValue(data.bvid) ?? fallbackBvid,
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function readAttribute(tag: string, name: string): string | null {
  const quoted = tag.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  if (quoted) return decodeHtml(quoted[2]);
  const unquoted = tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return unquoted ? decodeHtml(unquoted[1]) : null;
}

function findMeta(html: string, keys: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const key = readAttribute(tag, "property") || readAttribute(tag, "name");
    if (key && keys.some((candidate) => candidate.toLowerCase() === key.toLowerCase())) {
      const content = readAttribute(tag, "content");
      if (content) return content;
    }
  }
  return null;
}

export function parseBilibiliHtmlMetadata(html: string, bvid: string | null, aid: number | null): BilibiliMetadata {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return {
    title: findMeta(html, ["og:title"]) || (titleTag ? decodeHtml(titleTag) : null),
    cover_url: findMeta(html, ["og:image"]),
    description: findMeta(html, ["description", "og:description"]),
    author: findMeta(html, ["author"]),
    duration_seconds: null,
    aid,
    cid: null,
    bvid,
  };
}

export function mergeBilibiliMetadata(primary: BilibiliMetadata, fallback: BilibiliMetadata): BilibiliMetadata {
  return {
    title: primary.title || fallback.title,
    cover_url: primary.cover_url || fallback.cover_url,
    description: primary.description || fallback.description,
    author: primary.author || fallback.author,
    duration_seconds: primary.duration_seconds ?? fallback.duration_seconds,
    aid: primary.aid ?? fallback.aid,
    cid: primary.cid ?? fallback.cid,
    bvid: primary.bvid || fallback.bvid,
  };
}

export function hasUsableBilibiliMetadata(metadata: BilibiliMetadata): boolean {
  return Boolean(metadata.title);
}
