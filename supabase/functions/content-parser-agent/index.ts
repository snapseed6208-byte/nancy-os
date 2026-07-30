// ============================================
// Nancy OS — Content Parser Agent v4
// v3: Unified content intelligence — auto-classifies + extracts
// v4: Workout UPDATE mode + JSON schema validation
// Accepts URL or text, routes to resources/workout_videos/recipes
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
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, req: Request, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

const UNIFIED_PROMPT = `你是一个内容智能分析助手。用户给你一个链接或一段文本，请自动分析并提取结构化信息。

## 第一步：判断内容类型（content_type）

根据内容判断类型：
- "article" — 文章、博客、新闻、教程
- "video" — 普通视频（非健身、非食谱）
- "workout" — 健身/运动/训练视频或内容
- "recipe" — 食谱/烹饪视频或内容
- "course" — 系统化课程、学习路径

## 第二步：提取结构化信息

返回严格 JSON 格式（不要markdown代码块）:

{
  "content_type": "article|video|workout|recipe|course",
  "title": "内容标题",
  "category": "分类标签（中文，如：个人成长、技术、英语、健康、职业）",
  "summary": "150-250字的中文摘要，概括核心内容和价值",
  "key_points": ["关键知识点或发现1", "关键知识点或发现2", ...],
  "action_items": [
    { "action": "具体可执行的行动建议", "priority": "high|medium|low" }
  ],
  "tags": ["标签1", "标签2", "标签3"],
  "metadata": {}
}

## 类型特定规则

### 如果是 workout 类型，metadata 必须包含:
{
  "difficulty": "初级|中级|高级",
  "estimated_duration": 数字（分钟）,
  "target_muscles": ["具体训练肌群名称"],
  "training_type": "力量训练|塑形训练|有氧燃脂|HIIT|拉伸|瑜伽|康复",
  "category": "臀腿|背部|肩胸|核心|全身|有氧|拉伸",
  "equipment": "训练器材（如：哑铃、弹力带、自重、杠铃、瑜伽垫）",
  "tags": ["标签1", "标签2", "标签3"],
  "analysis_notes": "一句话解释为什么这样分类（中文）"
}

## workout 健身训练领域分类规则（核心）

你的核心任务不是判断「这个视频有没有燃脂效果」，而是回答：
**「用户今天想练某个部位时，能不能快速找到这个训练」**。

### category 分类规则 — 最重要

category 代表用户筛选训练库时最期望看到的位置。

分类优先级：**主要训练目标 > 主要目标肌群 > 训练形式**

**禁止规则：**
- 禁止因为「动作多、涉及多个部位」就归类为「全身」
- 禁止根据「是否燃脂、是否消耗大」判断分类
- 禁止因为「包含跳跃动作」就归类为「有氧」

**关键词 → category 映射（高优先级，命中即采用）：**

腰腹类 → category: "核心"
关键词：沙漏腰、小蛮腰、马甲线、腹肌、瘦腰、收腹、腰腹塑形、练腹、腹部雕刻、核心训练
target_muscles: ["腹横肌", "腹直肌", "腹斜肌"]
training_type: "塑形训练"

臀腿类 → category: "臀腿"
关键词：蜜桃臀、翘臀、臀腿、练臀、臀部激活、瘦腿、美腿、下肢、深蹲、臀推
target_muscles: ["臀大肌", "臀中肌", "股四头肌", "腘绳肌"]

背部类 → category: "背部"
关键词：瘦背、薄背、背部线条、改善圆肩、驼背矫正、背阔肌、划船、引体向上、美背
target_muscles: ["背阔肌", "菱形肌", "斜方肌", "竖脊肌"]

肩胸类 → category: "肩胸"
关键词：直角肩、肩颈、胸型、练肩、肩部塑形、俯卧撑、卧推、胸部
target_muscles: ["三角肌", "胸大肌", "肩袖肌群"]

有氧类 → category: "有氧"
关键词：跑步、跳绳、跳操、燃脂操、有氧操、爬楼、单车、游泳、椭圆机
注意：必须是明确的纯有氧运动，而非塑形训练中附带的心率提升

拉伸类 → category: "拉伸"
关键词：拉伸、放松、瑜伽、冥想、柔韧性、筋膜放松、泡沫轴

### training_type 分类规则

可用值：力量训练、塑形训练、有氧燃脂、HIIT、拉伸、瑜伽、康复

**判断规则：**

塑形训练 → category 为核心/臀腿/背部/肩胸，目标是塑形而非增力
力量训练 → 明确使用大重量、低次数、增力目标
有氧燃脂 → 持续性中低强度、目标是消耗热量
HIIT → **必须同时满足**以下条件之一：
  - 明确标注「间歇」「Tabata」「HIIT」
  - 工作/休息时间结构（如 30s 训练 + 10s 休息）
  - 高强度循环训练且明确标注

**重要：普通燃脂操、跳操、居家运动不要标记为 HIIT，标记为「有氧燃脂」**

瑜伽 → 瑜伽体式练习
拉伸 → 拉伸放松、筋膜放松、泡沫轴
康复 → 康复训练、物理治疗、产后恢复

### title 生成规则

不要简单复制原标题。生成用户容易理解的训练名称。

规则：
- 去除博主的名字（如「【欧阳春晓】」）
- 去除版本号和无意义后缀（如「1.0」「自用」「招头去尾」）
- 格式：核心训练目标 + 训练类型
- 例如：「【欧阳春晓】沙漏腰1.0（自用招头去尾）」→ 「沙漏腰塑形训练」
- 例如：「10分钟蜜桃臀训练」→ 「蜜桃臀塑形训练」
- 保留时长信息如果有的话

### tags 规则

3-6 个中文标签，帮助用户搜索。优先使用：
- 训练目标标签（如：腰腹塑形、蜜桃臀、瘦背）
- 训练特征标签（如：无器械、居家训练、新手友好、小重量）
- 避免模糊标签（如：燃脂、减肥、健身）

### difficulty 规则

- 初级：新手友好、无跳跃、低冲击、短时长（<15分钟）
- 中级：需要一定基础、中等强度
- 高级：高强度、复杂动作、长时长（>45分钟）、需要器械基础

### analysis_notes 规则

一句话解释分类依据。例如：
- "视频标题明确包含沙漏腰，主要目标为腰腹塑形，因此归类为核心/塑形训练"
- "标题含蜜桃臀关键词，训练目标为臀部塑形，归类为臀腿"

### 如果是 recipe 类型，metadata 必须包含:
{
  "name": "食谱名称（中文，简洁准确）",
  "image_url": "封面图URL（如有）",
  "category": "高蛋白|减脂|快手|烘焙|汤品|主食|零食|饮品",
  "meal_time": ["breakfast", "lunch", "dinner", "snack"],
  "goal": ["减脂"],
  "health_level": "清淡|均衡|indulgent",
  "budget_level": "经济|适中|豪华",
  "calories_per_serving": 数字（千卡）,
  "protein_grams": 数字（克）,
  "carbs_grams": 数字（克）,
  "fat_grams": 数字（克）,
  "ingredients_json": [
    { "name": "鸡胸肉", "amount": "200g", "category": "蛋白质" }
  ],
  "steps_json": [
    { "order": 1, "text": "藜麦洗净，加水煮15分钟至熟", "duration": 15 }
  ],
  "ai_summary": "2-3句话的食谱摘要，包含营养特点和适合人群"
}

## recipe 食谱分析规则

### name 规则
- 不要简单复制视频标题
- 提取核心食材 + 烹饪方式
- 例如：「减脂餐｜鸡胸肉藜麦沙拉，低卡又饱腹」→ 「鸡胸肉藜麦沙拉」

### 食材分类 (ingredients_json.category)
必须使用以下分类之一：
- 蛋白质：肉类、鱼类、蛋类、豆制品、蛋白粉
- 主食：米饭、面食、面包、薯类、谷物
- 蔬菜：叶菜、根茎、菌菇、瓜果类蔬菜
- 水果：新鲜水果、果干
- 调味料：油、盐、酱、醋、香料
- 油脂：烹饪油、黄油、坚果
- 其他：无法归类的食材

### 步骤格式 (steps_json)
- order: 从1开始的步骤序号
- text: 步骤描述（中文，包含关键动作和时间）
- duration: 该步骤预计耗时（分钟，为0表示无需等待）

### 营养估算规则
- calories_per_serving: 根据食材和份量合理估算，一人份范围 100-1500
- protein_grams: 主要来自蛋白质类食材
- carbs_grams: 主要来自主食和水果
- fat_grams: 主要来自油脂和坚果
- 宁可低估也不要高估

### health_level 规则
- 清淡：少油少盐、蒸煮为主、蔬菜占比高
- 均衡：荤素搭配、正常烹饪
- indulgent：高油高糖、煎炸为主、甜品或大餐

### budget_level 规则
- 经济：常见食材、成本低
- 适中：普通超市食材
- 豪华：进口食材、海鲜、牛排等

### goal 规则
- 减脂：低卡、高蛋白、低碳水
- 增肌：高蛋白、适中碳水
- 保持：均衡营养
- 可以同时匹配多个目标

### ai_summary 规则
2-3句话的中文摘要：
- 第一句：食谱核心特点和风味
- 第二句：营养亮点和适合人群
- 第三句（可选）：烹饪难度或时间提示

### 如果是 course 类型，metadata 包含:
{
  "estimated_hours": 数字,
  "difficulty_level": "beginner|intermediate|advanced",
  "prerequisites": ["前置知识"]
}

## 规则
- key_points: 3-8条，每条是一句话的关键发现
- action_items: 1-3条，具体可执行
- summary: 必须是中文，150-250字
- 如果无法从链接/文本推断内容，基于上下文合理推断
- 如果输入为纯文本而非URL，优先分析文本内容本身`;

function parseAIJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim().replace(/^﻿/, "");

  try { return JSON.parse(cleaned); } catch { /* continue */ }

  cleaned = cleaned.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

function detectPlatform(input: string): string {
  if (input.includes("bilibili.com") || input.includes("b23.tv")) return "bilibili";
  if (input.includes("douyin.com") || input.includes("v.douyin.com")) return "douyin";
  if (input.includes("xiaohongshu.com") || input.includes("xhslink.com")) return "xiaohongshu";
  if (input.includes("youtube.com") || input.includes("youtu.be")) return "youtube";
  return "web";
}

function isUrl(input: string): boolean {
  return /^https?:\/\//.test(input.trim());
}

// ── JSON Schema validation ──

// Workout
const WORKOUT_VALID_DIFFICULTY = ["初级", "中级", "高级"] as const;
const WORKOUT_VALID_TRAINING_TYPE = ["力量训练", "塑形训练", "有氧燃脂", "HIIT", "拉伸", "瑜伽", "康复"] as const;
const WORKOUT_VALID_CATEGORY = ["臀腿", "背部", "肩胸", "核心", "全身", "有氧", "拉伸"] as const;

// Recipe
const RECIPE_VALID_MEAL_TIME = ["breakfast", "lunch", "dinner", "snack"] as const;
const RECIPE_VALID_GOAL = ["减脂", "增肌", "保持"] as const;
const RECIPE_VALID_HEALTH_LEVEL = ["清淡", "均衡", "indulgent"] as const;
const RECIPE_VALID_BUDGET_LEVEL = ["经济", "适中", "豪华"] as const;
const RECIPE_VALID_INGREDIENT_CATEGORY = ["蛋白质", "主食", "蔬菜", "水果", "调味料", "油脂", "其他"] as const;

function validateWorkoutMetadata(metadata: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!metadata.difficulty || !WORKOUT_VALID_DIFFICULTY.includes(metadata.difficulty as string)) {
    errors.push(`difficulty 值无效: ${metadata.difficulty}，允许: ${WORKOUT_VALID_DIFFICULTY.join("/")}`);
  }

  if (!metadata.training_type || !WORKOUT_VALID_TRAINING_TYPE.includes(metadata.training_type as string)) {
    errors.push(`training_type 值无效: ${metadata.training_type}，允许: ${WORKOUT_VALID_TRAINING_TYPE.join("/")}`);
  }

  if (!metadata.category || !WORKOUT_VALID_CATEGORY.includes(metadata.category as string)) {
    errors.push(`category 值无效: ${metadata.category}，允许: ${WORKOUT_VALID_CATEGORY.join("/")}`);
  }

  if (metadata.estimated_duration !== undefined && metadata.estimated_duration !== null) {
    const d = metadata.estimated_duration as number;
    if (typeof d !== "number" || d < 1 || d > 300) {
      errors.push(`estimated_duration 超出范围: ${d}，允许 1-300`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateRecipeMetadata(metadata: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // ingredients_json must be an array
  if (!metadata.ingredients_json || !Array.isArray(metadata.ingredients_json)) {
    errors.push("ingredients_json 必须是数组");
  } else {
    for (const item of metadata.ingredients_json as Array<Record<string, unknown>>) {
      if (!item.name || typeof item.name !== "string") {
        errors.push(`ingredients_json 元素缺少 name: ${JSON.stringify(item)}`);
      }
    }
  }

  // steps_json must be an array
  if (!metadata.steps_json || !Array.isArray(metadata.steps_json)) {
    errors.push("steps_json 必须是数组");
  } else {
    for (const item of metadata.steps_json as Array<Record<string, unknown>>) {
      if (item.order === undefined || typeof item.order !== "number") {
        errors.push(`steps_json 元素缺少 order: ${JSON.stringify(item)}`);
      }
      if (!item.text || typeof item.text !== "string") {
        errors.push(`steps_json 元素缺少 text: ${JSON.stringify(item)}`);
      }
    }
  }

  // calories_per_serving range check
  if (metadata.calories_per_serving !== undefined && metadata.calories_per_serving !== null) {
    const c = metadata.calories_per_serving as number;
    if (typeof c !== "number" || c < 0 || c > 3000) {
      errors.push(`calories_per_serving 超出范围: ${c}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(req),
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return jsonResponse({ error: "Unauthorized" }, req, 401);
    }

    // ── Parse input ──
    const body = await req.json() as {
      url?: string;
      text?: string;
      preferred_module?: string;
      workout_video_id?: string;
      recipe_id?: string;
    };

    const workoutVideoId = body.workout_video_id || "";
    const recipeId = body.recipe_id || "";

    const input = body.url || body.text || "";
    if (!input && !workoutVideoId) {
      return jsonResponse({ error: "请提供 URL 链接或文本内容" }, req, 400);
    }

    const inputIsUrl = body.url ? true : isUrl(input);
    const platform = inputIsUrl ? detectPlatform(input) : "text";
    const preferredModule = body.preferred_module || "";

    // ── Build prompt ──
    let userMessage = "";
    if (inputIsUrl) {
      userMessage = `输入类型: URL链接\nURL: ${input}\n平台: ${platform}`;
    } else {
      userMessage = `输入类型: 文本内容\n文本: ${input.slice(0, 3000)}`;
    }
    if (preferredModule) {
      userMessage += `\n用户偏好模块: ${preferredModule}`;
    }

    // ── Call DeepSeek ──
    const aiResponse = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: UNIFIED_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!aiResponse.ok) {
      // If this is an UPDATE for an existing workout video, mark as failed
      if (workoutVideoId) {
        await supabase
          .from("workout_videos")
          .update({ ai_analysis_status: "failed" })
          .eq("id", workoutVideoId);
      }
      return jsonResponse({ error: `AI 服务异常 (${aiResponse.status})` }, req, 502);
    }

    const result = await aiResponse.json();
    const raw = result.choices?.[0]?.message?.content || "{}";
    const tokensUsed: number = result.usage?.total_tokens || 0;

    let parsed: Record<string, unknown>;
    try {
      parsed = parseAIJson(raw);
    } catch {
      if (workoutVideoId) {
        await supabase
          .from("workout_videos")
          .update({ ai_analysis_status: "failed" })
          .eq("id", workoutVideoId);
      }
      return jsonResponse({
        error: "parse_error",
        raw: raw.slice(0, 500),
        message: "AI 返回格式异常，请重试",
      }, req, 500);
    }

    // Force UPDATE mode when retrying (ID takes priority over AI classification)
    if (workoutVideoId) {
      parsed.content_type = "workout";
    }
    if (recipeId) {
      parsed.content_type = "recipe";
    }

    const content_type = (parsed.content_type as string) || "article";
    const title = (parsed.title as string) || "";
    const category = (parsed.category as string) || "";
    const summary = (parsed.summary as string) || "";
    const key_points = (parsed.key_points as string[]) || [];
    const action_items = (parsed.action_items as Array<Record<string, unknown>>) || [];
    const tags = (parsed.tags as string[]) || [];
    const metadata = (parsed.metadata as Record<string, unknown>) || {};

    // ── Route to target table ──
    let targetTable = "resources";
    let recordId = "";

    if (content_type === "workout") {
      targetTable = "workout_videos";

      // Validate workout metadata against schema
      const validation = validateWorkoutMetadata(metadata);
      if (!validation.valid) {
        if (workoutVideoId) {
          await supabase
            .from("workout_videos")
            .update({ ai_analysis_status: "failed" })
            .eq("id", workoutVideoId);
        }
        return jsonResponse({
          error: "schema_validation_failed",
          message: "AI 输出不符合 schema",
          validation_errors: validation.errors,
        }, req, 500);
      }

      if (workoutVideoId) {
        // ── UPDATE mode: enrich existing workout_video row ──
        const { data: updated } = await supabase
          .from("workout_videos")
          .update({
            title: title || undefined,
            category: metadata.category as string,
            difficulty: metadata.difficulty as string,
            training_type: metadata.training_type as string,
            estimated_duration: (metadata.estimated_duration as number) || null,
            target_muscles: (metadata.target_muscles as string[]) || [],
            equipment: (metadata.equipment as string) || null,
            tags: (metadata.tags as string[]) || [],
            ai_analysis_status: "completed",
          })
          .eq("id", workoutVideoId)
          .select("id")
          .single();

        if (updated) recordId = updated.id as string;
      } else {
        // ── INSERT mode: create new workout_video row ──
        const { data: inserted } = await supabase
          .from("workout_videos")
          .insert({
            user_id: user.id,
            title: title,
            category: metadata.category as string,
            difficulty: (metadata.difficulty as string) || "初级",
            training_type: metadata.training_type as string,
            estimated_duration: (metadata.estimated_duration as number) || null,
            target_muscles: (metadata.target_muscles as string[]) || [],
            equipment: (metadata.equipment as string) || null,
            tags: (metadata.tags as string[]) || [],
            platform: inputIsUrl ? platform : null,
            url: inputIsUrl ? input : null,
            ai_analysis_status: "completed",
          })
          .select("id")
          .single();

        if (inserted) recordId = inserted.id as string;
      }
    } else if (content_type === "recipe") {
      targetTable = "recipes";

      // Validate recipe metadata against schema
      const recipeValidation = validateRecipeMetadata(metadata);
      if (!recipeValidation.valid) {
        if (recipeId) {
          await supabase
            .from("recipes")
            .update({ ai_analysis_status: "failed" })
            .eq("id", recipeId);
        }
        return jsonResponse({
          error: "schema_validation_failed",
          message: "AI 输出的 recipe metadata 不符合 schema",
          validation_errors: recipeValidation.errors,
        }, req, 500);
      }

      // Extract recipe name from metadata or use title
      const recipeName = (metadata.name as string) || title;

      // Build goal array
      let goalArray: string[] = [];
      if (metadata.goal) {
        goalArray = Array.isArray(metadata.goal)
          ? (metadata.goal as string[]).filter((g: string) => RECIPE_VALID_GOAL.includes(g as typeof RECIPE_VALID_GOAL[number]))
          : RECIPE_VALID_GOAL.includes(metadata.goal as typeof RECIPE_VALID_GOAL[number])
            ? [metadata.goal as string]
            : [];
      }

      if (recipeId) {
        // ── UPDATE mode: enrich existing recipe row ──
        const { data: updated } = await supabase
          .from("recipes")
          .update({
            name: recipeName || undefined,
            image_url: (metadata.image_url as string) || null,
            category: metadata.category as string || category,
            meal_time: (metadata.meal_time as string[]) || [],
            goal: goalArray.length > 0 ? goalArray : null,
            health_level: (metadata.health_level as string) || null,
            budget_level: (metadata.budget_level as string) || null,
            calories_per_serving: (metadata.calories_per_serving as number) || null,
            protein_grams: (metadata.protein_grams as number) || null,
            carbs_grams: (metadata.carbs_grams as number) || null,
            fat_grams: (metadata.fat_grams as number) || null,
            ingredients_json: (metadata.ingredients_json as unknown[]) || [],
            steps_json: (metadata.steps_json as unknown[]) || [],
            ai_summary: (metadata.ai_summary as string) || null,
            ai_analysis_status: "completed",
            ai_analyzed_at: new Date().toISOString(),
          })
          .eq("id", recipeId)
          .select("id")
          .single();

        if (updated) recordId = updated.id as string;
      } else {
        // ── INSERT mode: create new recipe row ──
        const { data: inserted } = await supabase
          .from("recipes")
          .insert({
            user_id: user.id,
            name: recipeName,
            image_url: (metadata.image_url as string) || null,
            category: metadata.category as string || category,
            meal_time: (metadata.meal_time as string[]) || [],
            goal: goalArray.length > 0 ? goalArray : null,
            health_level: (metadata.health_level as string) || null,
            budget_level: (metadata.budget_level as string) || null,
            calories_per_serving: (metadata.calories_per_serving as number) || null,
            protein_grams: (metadata.protein_grams as number) || null,
            carbs_grams: (metadata.carbs_grams as number) || null,
            fat_grams: (metadata.fat_grams as number) || null,
            ingredients_json: (metadata.ingredients_json as unknown[]) || [],
            steps_json: (metadata.steps_json as unknown[]) || [],
            ai_summary: (metadata.ai_summary as string) || null,
            source_url: inputIsUrl ? input : null,
            source_platform: inputIsUrl ? platform : null,
            ai_analysis_status: "completed",
            ai_analyzed_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (inserted) recordId = inserted.id as string;
      }
    } else {
      targetTable = "resources";
      const { data: inserted } = await supabase
        .from("resources")
        .insert({
          user_id: user.id,
          title: title,
          url: inputIsUrl ? input : null,
          resource_type: content_type,
          module: preferredModule || "general",
          tags: tags,
          source_url: body.url || null,
          content_type: content_type,
          parse_status: "parsed",
          ai_summary: summary,
          ai_category: category,
          ai_tags: tags,
          ai_key_points: key_points,
          ai_action_items: action_items,
          notes: summary,
        })
        .select("id")
        .single();

      if (inserted) recordId = inserted.id as string;
    }

    // ── Write agent log ──
    await supabase.from("agent_logs").insert({
      user_id: user.id,
      agent_type: "content_parser",
      action: "content_parse",
      input_data: {
        input_type: inputIsUrl ? "url" : "text",
        input_length: input.length,
        platform: inputIsUrl ? platform : "text",
        preferred_module: preferredModule || null,
        workout_video_id: workoutVideoId || null,
      },
      output_data: {
        content_type,
        title: title.slice(0, 100),
        key_points_count: key_points.length,
        action_items_count: action_items.length,
        target_table: targetTable,
        record_id: recordId,
        tokens_used: tokensUsed,
      },
      model: "deepseek-chat",
      tokens_used: tokensUsed,
    });

    // ── Return ──
    return jsonResponse({
      content_type,
      title,
      category,
      summary,
      key_points,
      action_items,
      tags,
      metadata,
      target_table: targetTable,
      record_id: recordId,
      tokens_used: tokensUsed,
    }, req);

  } catch (err) {
    console.error("Content parser error:", err);
    return jsonResponse({
      error: (err as Error).message || "服务器内部错误",
    }, req, 500);
  }
});
