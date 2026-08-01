// ============================================
// Nancy OS — B站 Thumbnail Proxy
// Server-side proxy for api.bilibili.com (CORS-restricted in browser)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    const { bvid } = await req.json();
    if (!bvid || typeof bvid !== "string" || !bvid.startsWith("BV")) {
      return new Response(JSON.stringify({ error: "Invalid bvid" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const resp = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
      { headers: { "User-Agent": UA, "Referer": "https://www.bilibili.com/" } },
    );

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Bilibili API returned ${resp.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const json = await resp.json();
    if (json.code !== 0 || !json.data) {
      return new Response(JSON.stringify({ error: "Bilibili API error", code: json.code }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(
      JSON.stringify({
        thumbnail_url: json.data.pic || null,
        title: json.data.title || null,
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
