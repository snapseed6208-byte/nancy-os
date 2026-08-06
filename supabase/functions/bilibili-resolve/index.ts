// ============================================
// Nancy OS — B站 URL Resolver + Metadata Proxy
// Accepts any B站 URL format (b23.tv, standard BV, av号, m.bilibili.com)
// Resolves short links, extracts BV号, fetches video metadata from B站 API
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface ResolveResult {
  canonical_url: string;
  bvid: string | null;
  aid: number | null;
  cid: number | null;
  page: number;
  title: string | null;
  cover_url: string | null;
  duration_seconds: number | null;
  owner_name: string | null;
  error?: string;
}

// Extract BV号 from a canonical B站 URL
const BV_RE = /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/;
const AV_RE = /bilibili\.com\/video\/av(\d+)/i;
function extractBvFromUrl(url: string): string | null {
  // Normal bilibili.com/video/BV...
  const bvMatch = url.match(BV_RE);
  if (bvMatch) return bvMatch[1];
  return null;
}

function extractAidFromUrl(url: string): number | null {
  const avMatch = url.match(AV_RE);
  if (avMatch) return parseInt(avMatch[1], 10);
  return null;
}

function extractPageFromUrl(url: string): number {
  try {
    const parsed = new URL(url);
    const p = parsed.searchParams.get("p");
    if (p) return parseInt(p, 10) || 1;
  } catch { /* ignore */ }
  return 1;
}

// Resolve b23.tv short link → canonical bilibili.com/video/BV... URL
async function resolveB23(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": UA },
      redirect: "manual", // Don't follow redirect, capture the Location header
    });
    clearTimeout(timeout);

    if (resp.status === 301 || resp.status === 302 || resp.status === 307 || resp.status === 308) {
      const location = resp.headers.get("Location");
      if (location) return location;
    }

    // Some short links may return 200 with meta refresh or JS redirect
    // Try a GET request to capture any redirect
    if (resp.status === 200) {
      const getResp = await fetch(url, {
        headers: { "User-Agent": UA },
        redirect: "follow",
      });
      const finalUrl = getResp.url;
      if (finalUrl !== url && extractBvFromUrl(finalUrl)) {
        return finalUrl;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Fetch video metadata from B站 API (by bvid or aid)
async function fetchBilibiliVideoInfo(bvid: string | null, aid: number | null): Promise<{
  title: string | null;
  cover_url: string | null;
  duration_seconds: number | null;
  owner_name: string | null;
  aid: number | null;
  cid: number | null;
  bvid: string | null;
}> {
  const empty = { title: null, cover_url: null, duration_seconds: null, owner_name: null, aid: aid, cid: null, bvid: bvid };
  if (!bvid && !aid) return empty;

  const param = bvid ? `bvid=${encodeURIComponent(bvid)}` : `aid=${aid}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const resp = await fetch(
      `https://api.bilibili.com/x/web-interface/view?${param}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": UA, "Referer": "https://www.bilibili.com/" },
      },
    );
    clearTimeout(timeout);

    if (!resp.ok) return empty;

    const json = await resp.json();
    if (json.code !== 0 || !json.data) return empty;

    const d = json.data;
    return {
      title: d.title || null,
      cover_url: d.pic || null,
      duration_seconds: d.duration || null,
      owner_name: d.owner?.name || null,
      aid: d.aid || aid,
      cid: d.cid || null,
      bvid: d.bvid || bvid,
    };
  } catch {
    return empty;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    const body = await req.json();
    const url = body.url as string;
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'url' parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // ── Step 1: Determine canonical URL and BV号 ──
    let canonical = url;
    let bvid = extractBvFromUrl(url);

    // b23.tv short link → resolve redirect
    if (url.includes("b23.tv") && !bvid) {
      const resolved = await resolveB23(url);
      if (resolved) {
        canonical = resolved;
        bvid = extractBvFromUrl(resolved);
      }
    }

    // m.bilibili.com → convert to www form
    if (!bvid && canonical.includes("m.bilibili.com")) {
      const upgraded = canonical.replace("m.bilibili.com", "www.bilibili.com");
      bvid = extractBvFromUrl(upgraded);
      if (bvid) canonical = upgraded;
    }

    const aid = extractAidFromUrl(canonical);
    const page = extractPageFromUrl(canonical);

    // ── Step 2: Fetch metadata from B站 API ──
    let title: string | null = null;
    let coverUrl: string | null = null;
    let durationSec: number | null = null;
    let ownerName: string | null = null;
    let apiAid: number | null = aid;
    let apiCid: number | null = null;

    if (bvid || aid) {
      const info = await fetchBilibiliVideoInfo(bvid, aid);
      title = info.title;
      coverUrl = info.cover_url;
      durationSec = info.duration_seconds;
      ownerName = info.owner_name;
      apiAid = info.aid || aid;
      apiCid = info.cid;
      // Update bvid if API returned one (e.g. av号 → BV号 conversion)
      if (!bvid && info.bvid) {
        bvid = info.bvid;
        canonical = `https://www.bilibili.com/video/${info.bvid}`;
      }
    }

    const result: ResolveResult = {
      canonical_url: canonical,
      bvid,
      aid: apiAid,
      cid: apiCid,
      page,
      title,
      cover_url: coverUrl,
      duration_seconds: durationSec,
      owner_name: ownerName,
    };

    console.log("[bilibili-resolve]", {
      inputUrl: url.slice(0, 60),
      resolved: bvid ? "yes" : "no",
      bvid: bvid,
      title: title?.slice(0, 40),
    });

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("[bilibili-resolve] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
