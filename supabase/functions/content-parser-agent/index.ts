// ============================================
// Nancy OS — Content Parser Agent
// Takes a video/recipe URL → AI parses structured metadata
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const WORKOUT_PROMPT = `你是一个健身内容分析助手。用户粘贴了一个健身视频链接，请根据URL和平台信息推断视频内容。

返回严格 JSON 格式（不要markdown代码块）:

{
  "title": "视频标题（从链接推断或生成一个合理的中文标题）",
  "category": "臀腿|背部|肩胸|核心|有氧|拉伸",
  "difficulty": "初级|中级|高级",
  "estimated_duration": 数字（分钟）,
  "target_muscles": ["训练部位1", "训练部位2"]
}

规则:
- 如果无法从链接推断，根据常见健身视频模式合理猜测
- category 必须是给定的6个选项之一
- 为抖音/bilibili 链接推断合理的标题`;

const RECIPE_PROMPT = `你是一个减脂饮食分析助手。用户粘贴了一个食谱视频链接，请根据URL和平台信息推断食谱内容。

返回严格 JSON 格式（不要markdown代码块）:

{
  "title": "食谱名称",
  "category": "高蛋白|减脂|快手|早餐|午餐|晚餐",
  "goal": "减脂|增肌|保持",
  "ingredients": "预估食材清单，逗号分隔",
  "calories_per_serving": 数字（千卡）,
  "protein_grams": 数字（克）,
  "meal_time": ["breakfast|lunch|dinner"]
}

规则:
- 如果是减脂/健身食谱，热量和蛋白质估算要合理
- meal_time 推断这道菜适合什么餐时
- 抖音/小红书减脂食谱通常热量在300-500千卡`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const { url, type } = await req.json() as { url: string; type: "workout" | "recipe" };

    const platform = detectPlatform(url);
    const systemPrompt = type === "workout" ? WORKOUT_PROMPT : RECIPE_PROMPT;

    const userMessage = `URL: ${url}\n平台: ${platform}\n类型: ${type === "workout" ? "健身视频" : "食谱视频"}`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    // Auto-update the corresponding record
    if (type === "workout") {
      // Find the most recent workout_video without a title (just added)
      const { data: videos } = await supabase
        .from("workout_videos")
        .select("id")
        .eq("user_id", user.id)
        .is("title", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (videos?.[0]) {
        await supabase.from("workout_videos").update({
          title: parsed.title,
          category: parsed.category,
          difficulty: parsed.difficulty,
          estimated_duration: parsed.estimated_duration,
          target_muscles: parsed.target_muscles,
        }).eq("id", videos[0].id);
      }
    } else {
      const { data: recipes } = await supabase
        .from("recipes")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", "")
        .order("created_at", { ascending: false })
        .limit(1);

      if (recipes?.[0]) {
        await supabase.from("recipes").update({
          name: parsed.title,
          category: parsed.category,
          goal: parsed.goal,
          ingredients: parsed.ingredients,
          calories_per_serving: parsed.calories_per_serving,
          protein_grams: parsed.protein_grams,
          meal_time: parsed.meal_time,
        }).eq("id", recipes[0].id);
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Content parser error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});

function detectPlatform(url: string): string {
  if (url.includes("bilibili.com") || url.includes("b23.tv")) return "bilibili";
  if (url.includes("douyin.com") || url.includes("v.douyin.com")) return "douyin";
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com")) return "xiaohongshu";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return "web";
}
