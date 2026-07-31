// ============================================
// Nancy OS — File Parser Agent
// Extracts plain text from PDF / DOCX / TXT / Images
// Input: { file: "<base64>", mime_type: "application/pdf|...|image/..." }
// Output: { text: "..." }
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
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

async function parsePDF(base64: string): Promise<string> {
  try {
    const pdfjsLib = await import("npm:pdfjs-dist@4.0.379");
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const doc = await pdfjsLib.getDocument({ data: binary }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 50); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: { str?: string }) => item.str || "")
        .filter(Boolean)
        .join(" ");
      if (text.trim()) pages.push(text);
    }
    return pages.join("\n\n");
  } catch {
    return "";
  }
}

async function parseDOCX(base64: string): Promise<string> {
  try {
    const mammoth = await import("npm:mammoth@1.8.0");
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const result = await mammoth.extractRawText({ buffer: binary.buffer });
    return result.value || "";
  } catch {
    return "";
  }
}

async function parseImage(base64: string, mimeType: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) return "";

  try {
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: "Please extract all English text from this image. Return ONLY the extracted text, preserving paragraphs and line breaks where possible. If there is Chinese text mixed in, include it too. Output the raw text directly without any additional commentary.",
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) return "";
    const result = await response.json();
    return result.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}

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
      file?: string;
      mime_type?: string;
    };

    const file = body.file || "";
    const mimeType = body.mime_type || "";

    if (!file) {
      return new Response(JSON.stringify({ error: "请提供文件内容 (base64)" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let text = "";
    let warning: string | undefined;

    // Image types — use DeepSeek Vision for OCR
    const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
    if (imageTypes.includes(mimeType)) {
      text = await parseImage(file, mimeType);
      if (!text) {
        warning = "图片文字提取失败，请尝试粘贴文本";
      }
    } else if (mimeType === "application/pdf") {
      text = await parsePDF(file);
      if (!text) {
        return new Response(JSON.stringify({
          text: file,
          warning: "PDF 解析失败，已返回原始内容",
        }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      text = await parseDOCX(file);
      if (!text) {
        return new Response(JSON.stringify({
          text: "",
          warning: "DOCX 解析失败",
        }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
      text = atob(file);
    } else {
      // Unknown type — try as text
      try {
        text = atob(file);
      } catch {
        return new Response(JSON.stringify({
          text: "",
          warning: `不支持的文件类型: ${mimeType}`,
        }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    const response = {
      text,
      char_count: text.length,
      ...(warning ? { warning } : {}),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("File parser error:", err);
    return new Response(JSON.stringify({
      error: (err as Error).message || "文件解析失败",
    }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
