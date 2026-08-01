// ============================================
// Nancy OS — Content Parser Agent v9
// v9: Recipe pipeline — new prompt with source_text, confidence rules,
//     confidence=low → no full recipe, simplified 5-state status,
//     source_content fields: subtitle, vision_result.
// v8: Recipe path split — real content only via RECIPE_PARSER_PROMPT.
// Accepts URL or text, routes to resources/workout_videos/recipes
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";

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

## 第二步：提取结构化信息（通用字段，所有类型）

返回严格 JSON 格式（不要markdown代码块）:

{
  "content_type": "article|video|workout|recipe|course",
  "title": "内容标题（准确、简洁）",
  "category": "内容所属领域（中文）",
  "summary": "150-250字的中文摘要，概括核心内容和价值",
  "key_points": ["核心观点或关键知识点"],
  "important_quotes": ["值得保留的原话、金句、关键数据"],
  "action_items": [
    { "action": "具体可执行的行动建议", "priority": "high|medium|low" }
  ],
  "suggested_category": "从以下11个系统分类中选择最匹配的一个：学习成长、工作职业、健康健身、饮食生活、生活技巧、影视娱乐、财商投资、思维认知、人际关系、旅行体验、灵感收藏。如果无法判断，返回空字符串",
  "applicable_scenarios": ["这些知识适用于哪些生活/工作场景"],
  "related_knowledge": ["关联的知识领域或主题"],
  "tags": ["关键词1", "关键词2", "关键词3"],
  "metadata": {}
}

### 新增字段规则

**important_quotes（重要引用）：**
- 提取原文中最有价值的1-5句话
- 优先选择：核心论点、独特见解、数据事实、可引用的金句
- 每条不超过150字
- 如果没有值得保留的原话，返回空数组 []

**suggested_category（建议分类）：**
- 根据内容主题推荐一个分类
- 必须从以下11个系统分类中选择：学习成长、工作职业、健康健身、饮食生活、生活技巧、影视娱乐、财商投资、思维认知、人际关系、旅行体验、灵感收藏
- 如果无法确定分类，返回空字符串 ""
- 重要：不要推荐系统分类之外的分类名

**applicable_scenarios（适用场景）：**
- 这些知识在什么情况下可以使用
- 具体、可操作的场景描述
- 1-3条场景

**related_knowledge（关联知识）：**
- 与哪些已有知识领域关联
- 帮助用户建立知识间的连接

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
- important_quotes: 1-5条值得保留的原话或数据，没有则空数组
- action_items: 1-3条，具体可执行
- summary: 必须是中文，150-250字
- tags: 3-6个关键词标签（不带#前缀），用于快速检索。示例："英语口语", "减脂", "面试技巧"。标签应具体、可检索
- suggested_category: 必须尝试推荐。只能从以下11个系统分类中选择：学习成长、工作职业、健康健身、饮食生活、生活技巧、影视娱乐、财商投资、思维认知、人际关系、旅行体验、灵感收藏。无法判断时返回空字符串""
- applicable_scenarios: 1-3个具体使用场景
- related_knowledge: 关联的知识领域，帮助建立知识连接
- 如果无法从链接/文本推断内容，基于上下文合理推断
- 如果输入为纯文本而非URL，优先分析文本内容本身
- 重要：tags 是内容关键词，不是平台名。不要用 bilibili/B站/抖音 等平台名作为标签
- 重要：不要创建新的分类名称。分类只能从上述11个系统分类中选择`;

// ═══════════════════════════════════════════
// Recipe Parser Prompt v2 — structured, actionable recipes
// ═══════════════════════════════════════════

const RECIPE_PARSER_PROMPT = `你是一个食谱结构化整理助手。

## 核心任务

从「来源素材」中提取信息，整理为**真正可以照着做的结构化菜谱**。

## 第一原则

1. ❌ 不要总结。不要复述。不要创造。
2. ✅ 只整理来源中明确出现的信息。
3. ✅ 准确度优先于完整性。
4. ✅ 没有的信息就是没有——宁可留空，不要编造。

---

## 输出格式 — 严格 JSON（不要 markdown 代码块）

{
  "content_type": "recipe",
  "metadata": {
    "name": "菜名（仅菜名，5-25字）",

    "ingredients": {
      "main": [
        { "name": "主食材名称", "amount": "用量" }
      ],
      "marinade": [
        { "name": "腌料/腌肉料食材", "amount": "用量" }
      ],
      "sauce": [
        { "name": "料汁/酱汁/调味汁食材", "amount": "用量" }
      ],
      "garnish": [
        { "name": "装饰/出锅撒料", "amount": "用量（可选）" }
      ]
    },

    "steps": [
      {
        "order": 1,
        "text": "包含具体动作和用料的完整步骤描述",
        "related_ingredients": ["步骤中使用的食材名称"]
      }
    ],

    "tips": {
      "cooking": "烹饪技巧（火候、时间、关键动作，来源没有则 null）",
      "health": "健康建议（营养分析、适合人群、蛋白质/蔬菜搭配，必须标注'根据食材推测'，来源没有营养数据则基于食材常识推测）",
      "storage": "保存建议（冷藏/冷冻/回温方法，来源没有则 null）"
    },

    "meal_time": ["breakfast", "lunch", "dinner"],
    "goal": ["减脂", "高蛋白", "增肌", "日常"],
    "category": "家常菜|快手菜|汤类|主食|烘焙|凉菜|饮品",

    "health_level": "清淡|均衡|indulgent",
    "budget_level": "经济|适中|豪华",

    "source_text": "AI 参考的原始内容关键摘要（方便人工验证，50-100字）",
    "confidence": "high|medium|low"
  }
}

---

## 食材分组规则（重要）

### 必须保持独立分组，禁止打平合并

如果来源中出现了以下分类，必须保持独立：

- **腌料/腌肉料** → 放入 "marinade" 数组
  关键词：腌制、腌料、腌肉、腌、码味
  示例：生抽、料酒、淀粉、姜片（用于腌制的部分）

- **料汁/酱汁/调味汁** → 放入 "sauce" 数组
  关键词：料汁、酱汁、调味汁、碗汁、浇汁、淋汁
  示例：生抽:2勺、蚝油:1勺、糖:少许、淀粉:1勺、清水:半碗

- **出锅撒料/装饰** → 放入 "garnish" 数组
  关键词：撒、点缀、装饰、出锅前
  示例：葱花、香菜、芝麻

- **主食材** → 放入 "main" 数组
  所有不属于以上三类的食材

### 分组判断示例

来源原文:
  腌肉料：生抽、料酒、淀粉
  料汁：生抽2勺、蚝油1勺、糖半勺、清水半碗
  主食材：牛肉300g、娃娃菜1颗、豆腐1块

正确输出:
  "main": [{"name":"牛肉","amount":"300g"},{"name":"娃娃菜","amount":"1颗"},{"name":"豆腐","amount":"1块"}]
  "marinade": [{"name":"生抽","amount":"腌肉用"},{"name":"料酒","amount":"腌肉用"},{"name":"淀粉","amount":"腌肉用"}]
  "sauce": [{"name":"生抽","amount":"2勺"},{"name":"蚝油","amount":"1勺"},{"name":"糖","amount":"半勺"},{"name":"清水","amount":"半碗"}]

❌ 错误（打平合并）:
  "main": [{"name":"牛肉","amount":"300g"},{"name":"生抽","amount":"腌肉用"},{"name":"蚝油","amount":"1勺"},...]

### 如果来源没有分组

如果来源只是简单列出食材，没有腌料/料汁分类：
- 全部放入 "main"
- 其他分组为空数组 []

---

## 步骤规则

### 每一步必须包含具体动作和关联食材

❌ 错误（缺少细节）:
  "加入牛肉"
  "放入料汁"
  "加水焖煮"

✅ 正确（包含完整上下文）:
  "加入提前用生抽、料酒、淀粉腌制好的牛肉片，快速滑炒至变色"
  "倒入调好的料汁（生抽2勺、蚝油1勺、糖半勺、清水半碗混合），翻炒均匀"
  "加半碗热水，大火烧开后转小火，盖上锅盖焖煮8分钟"

### related_ingredients 规则

每一步的 related_ingredients 列出这一步涉及的主要食材名称（数组）。
用于前端高亮关联食材。

示例:
  步骤: "加入提前腌制好的牛肉片，快速滑炒至变色"
  related_ingredients: ["牛肉", "生抽", "料酒", "淀粉"]

---

## AI 小贴士规则

### 禁止
- ❌ 复述菜名或标题
- ❌ 复述来源平台或作者
- ❌ 空洞的废话（"这是一道美味的家常菜"）

### cooking 烹饪技巧
- 关键火候/时间/动作要点
- 来源中有则提取，没有则基于常识给出1条建议
- **禁止超过2句话**

### health 健康建议
- 分析蛋白质来源、蔬菜比例、主食搭配
- 如果没有营养数据，**必须写"根据食材推测"**
- 说明适合什么人群/目标
- **禁止编造具体热量数值**

### storage 保存建议
- 来源有则提取，没有则 null
- 如果有剩菜处理建议，简要说明

---

## 分类规则

### meal_time（根据食材和做法判断）
- "breakfast" — 快手、轻食、粥、三明治、鸡蛋为主
- "lunch" — 正常菜肴、主食+菜
- "dinner" — 所有正餐菜肴（默认至少包含 dinner）

**规则**: 如果菜品适合作为正餐 → 至少包含 "lunch" 或 "dinner"
**默认**: 不确定时默认 ["lunch", "dinner"]

### goal（根据食材和做法判断）
- "减脂" — 低油、高蛋白、多蔬菜、蒸煮为主
- "高蛋白" — 肉类/豆制品/蛋类含量高
- "增肌" — 高蛋白 + 足量碳水
- "日常" — 正常家常菜

**规则**: 根据食材而非标题判断
**默认**: 不确定时默认 ["日常"]

### category（根据做法判断）
- "家常菜" — 炒、烧、焖、炖的家常做法
- "快手菜" — 总时长 ≤ 20分钟
- "汤类" — 以汤为主
- "主食" — 饭、面、粥为主
- "烘焙" — 烤箱制作
- "凉菜" — 冷食、凉拌
- "饮品" — 饮料、奶昔

**默认**: 不确定时默认 "家常菜"

---

## confidence 规则
- "high": 来源素材包含字幕或完整文字记录 — 信息充足
- "medium": 来源素材来自 OCR 识别或简介 — 信息可能不完整
- "low": 来源素材只有标题或极少量信息 — **禁止生成完整食谱**

## 如果 confidence = "low"
- ingredients 所有分组必须为空
- steps 必须为空数组
- tips 三个字段都为 null
- name 只使用标题文字
- source_text 说明"信息不足，无法从来源整理完整食谱。建议手动补充食材和步骤。"

## 特别注意
- name 长度超过 30 字说明你放错内容了
- name 不能包含食材清单、步骤文字、段落标题
- 步骤中的时间信息只在来源明确提及时才填写
- 用量单位只使用原文中出现的
- 不要从标题推断完整食谱——标题只是参考`;

// ── Recipe output sanitization ──
// Post-process AI output to prevent field pollution:
//   name  → only dish name, not full recipe text
//   ingredients → split single-item dumps into array
//   steps → split multiline dumps into individual steps

function sanitizeRecipeOutput(metadata: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...metadata };

  // ── NAME cleanup ──
  const rawName = (cleaned.name as string) || "";

  // Aggressive stripping: remove everything from common pollution markers
  let cleanName = rawName;

  // Strip "食谱" suffix and everything after it (catches "食谱 一、食材准备...")
  cleanName = cleanName.replace(/食谱[\s\S]*$/i, "");

  // Strip from numbered section headers: "一、", "二、", "1.", "①", etc.
  cleanName = cleanName.replace(/\s*[一二三四五六七八九十]、[\s\S]*$/, "");
  cleanName = cleanName.replace(/\s*\d+[、.．][\s\S]*$/, "");
  cleanName = cleanName.replace(/\s*[①②③④⑤⑥⑦⑧⑨⑩][\s\S]*$/, "");

  // Strip from section keywords
  cleanName = cleanName.replace(/\s*(食材准备|制作步骤|用料准备|烹饪步骤|具体做法)[\s\S]*$/i, "");

  cleanName = cleanName.trim();

  if (cleanName.length > 50) {
    // Name is polluted with full text — extract just the first meaningful line
    const lines = cleanName.split(/[\n\r]+/).filter((l: string) => l.trim().length > 0);
    for (const line of lines) {
      const trimmed = line.trim();
      const looksLikePollution = (
        trimmed.length > 40 ||
        /^(食材|用料|制作|步骤|做法|准备|一[、.]|1[、.]|①)/.test(trimmed) ||
        /\d+[克gG克]/.test(trimmed) ||
        /[①②③④⑤]/.test(trimmed)
      );
      if (!looksLikePollution && trimmed.length >= 2) {
        cleanName = trimmed;
        break;
      }
    }
    // If still no clean name, use first line truncated
    if (cleanName.length > 50) {
      cleanName = lines[0]?.trim().slice(0, 50) || "未命名食谱";
    }
  }

  cleaned.name = cleanName || "未命名食谱";

  // ── INGREDIENTS cleanup ──
  // v2: supports both grouped object {main/marinade/sauce/garnish} and flat array
  const rawIngredients = cleaned.ingredients || cleaned.ingredients_json;

  function sanitizeIngredientGroup(items: unknown): Array<{ name: string; amount: string }> {
    if (!Array.isArray(items) || items.length === 0) return [];
    const fixed: Array<{ name: string; amount: string }> = [];

    for (const item of items) {
      if (typeof item !== "object" || !item) continue;
      const itemName = ((item as Record<string, unknown>).name as string) || "";
      const itemAmount = ((item as Record<string, unknown>).amount as string) || "";

      // Detect single-item dump: name contains newlines or is very long
      if (itemName.includes("\n") || itemName.length > 60) {
        const lines = itemName.split(/[\n\r]+/).filter((l: string) => l.trim().length > 0);
        for (const line of lines) {
          const trimmed = line.trim();
          if (/^(食材|用料|制作|步骤|做法|准备)[：:]/.test(trimmed)) continue;
          if (/^[一-十]、/.test(trimmed)) continue;

          const parts = trimmed.match(/^(.+?)\s+([\d.]+[克gG克毫升mlML升L勺杯碗个只]+)$/);
          if (parts) {
            fixed.push({ name: parts[1].trim(), amount: parts[2].trim() });
          } else {
            fixed.push({ name: trimmed, amount: "" });
          }
        }
      } else if (itemName.length >= 2) {
        fixed.push({ name: itemName, amount: itemAmount });
      }
    }

    return fixed;
  }

  if (rawIngredients && typeof rawIngredients === "object" && !Array.isArray(rawIngredients)) {
    // Grouped format: { main: [...], marinade: [...], sauce: [...], garnish: [...] }
    const grouped = rawIngredients as Record<string, unknown>;
    const sanitized: Record<string, Array<{ name: string; amount: string }>> = {};
    let totalItems = 0;

    for (const key of ["main", "marinade", "sauce", "garnish"]) {
      const sanitizedGroup = sanitizeIngredientGroup(grouped[key]);
      sanitized[key] = sanitizedGroup;
      totalItems += sanitizedGroup.length;
    }

    if (totalItems > 0) {
      cleaned.ingredients = sanitized;
    }
  } else if (Array.isArray(rawIngredients) && rawIngredients.length >= 1) {
    // Flat array format (legacy)
    const fixedIngredients = sanitizeIngredientGroup(rawIngredients);
    if (fixedIngredients.length > 0 && fixedIngredients.length > (rawIngredients as Array<unknown>).length) {
      cleaned.ingredients = fixedIngredients;
    }
  }

  // ── STEPS cleanup ──
  const rawSteps = (cleaned.steps || cleaned.steps_json || []) as Array<Record<string, unknown>>;
  if (Array.isArray(rawSteps) && rawSteps.length >= 1) {
    const fixedSteps: Array<{ order: number; text: string }> = [];

    for (const item of rawSteps) {
      const itemText = (item.text as string) || "";

      // Detect single-item dump: text contains newlines with numbered steps
      if (itemText.includes("\n") || itemText.length > 150) {
        const lines = itemText.split(/[\n\r]+/).filter((l: string) => l.trim().length > 0);
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip headers
          if (/^(食材|用料|制作|步骤|做法)[：:]/.test(trimmed)) continue;
          if (/^[一-十]、$/.test(trimmed)) continue;

          // Strip leading number prefix like "1." "1、" "①"
          const cleaned = trimmed.replace(/^[0-9]+[.、．)]\s*/, "").replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "");
          if (cleaned.length >= 3) {
            fixedSteps.push({ order: fixedSteps.length + 1, text: cleaned });
          }
        }
      } else if (itemText.length >= 3) {
        fixedSteps.push({
          order: (item.order as number) || fixedSteps.length + 1,
          text: itemText,
        });
      }
    }

    if (fixedSteps.length > 0 && fixedSteps.length > rawSteps.length) {
      cleaned.steps = fixedSteps;
    }
  }

  return cleaned;
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

// ── Fetch URL content for AI context ──
// Uses standard browser UA to avoid platform blocking (B站 412, etc.)

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

interface UrlContentResult {
  title: string;
  description: string;
  text: string;
  error?: string;
  statusCode?: number;
}

async function fetchUrlContent(url: string): Promise<UrlContentResult> {
  const platform = detectPlatform(url);
  const referer = platform === "bilibili" ? "https://www.bilibili.com/"
    : platform === "youtube" ? "https://www.youtube.com/"
    : "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        ...(referer ? { "Referer": referer } : {}),
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        title: "", description: "", text: "",
        error: `HTTP ${resp.status}${resp.status === 412 ? " (平台反爬拦截)" : resp.status === 403 ? " (禁止访问)" : ""}`,
        statusCode: resp.status,
      };
    }

    const html = await resp.text();

    if (html.length < 200) {
      return {
        title: "", description: "", text: "",
        error: `页面内容过短 (${html.length} chars)，可能被拦截或需登录`,
      };
    }

    const title = extractMeta(html, /<title[^>]*>([^<]*)<\/title>/i) || "";
    const ogTitle = extractMeta(html, /<meta\s+property="og:title"\s+content="([^"]*)"/i) || "";
    const description = extractMeta(html, /<meta\s+name="description"\s+content="([^"]*)"/i)
      || extractMeta(html, /<meta\s+property="og:description"\s+content="([^"]*)"/i) || "";
    // Strip tags and get meaningful text
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    return {
      title: ogTitle || title,
      description,
      text,
    };
  } catch (err) {
    const errMsg = (err as Error).message || "fetch failed";
    const isTimeout = errMsg.includes("abort") || errMsg.includes("timeout");
    return {
      title: "",
      description: "",
      text: "",
      error: isTimeout ? "页面请求超时 (10s)" : `网络错误: ${errMsg}`,
    };
  }
}

function extractMeta(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

// ── JSON Schema validation ──

// Workout
const WORKOUT_VALID_DIFFICULTY = ["初级", "中级", "高级"] as const;
const WORKOUT_VALID_TRAINING_TYPE = ["力量训练", "塑形训练", "有氧燃脂", "HIIT", "拉伸", "瑜伽", "康复"] as const;
const WORKOUT_VALID_CATEGORY = ["臀腿", "背部", "肩胸", "核心", "全身", "有氧", "拉伸"] as const;

// Recipe
const RECIPE_VALID_MEAL_TIME = ["breakfast", "lunch", "dinner", "snack"] as const;
const RECIPE_VALID_GOAL = ["减脂", "高蛋白", "增肌", "日常"] as const;
const RECIPE_VALID_HEALTH_LEVEL = ["清淡", "均衡", "indulgent"] as const;
const RECIPE_VALID_BUDGET_LEVEL = ["经济", "适中", "豪华"] as const;
const RECIPE_VALID_INGREDIENT_CATEGORY = ["蛋白质", "主食", "蔬菜", "水果", "调味料", "油脂", "其他"] as const;

function validateWorkoutMetadata(metadata: Record<string, unknown>): { valid: boolean; errors: string[]; corrected: Record<string, unknown> } {
  const errors: string[] = [];
  const corrected = { ...metadata };

  // Auto-correct common AI mistakes: English → Chinese
  const difficultyMap: Record<string, string> = {
    "beginner": "初级", "easy": "初级", "初学": "初级",
    "intermediate": "中级", "medium": "中级",
    "advanced": "高级", "hard": "高级",
  };
  if (typeof corrected.difficulty === "string" && difficultyMap[corrected.difficulty.toLowerCase()]) {
    corrected.difficulty = difficultyMap[corrected.difficulty.toLowerCase()];
  }

  const trainingTypeMap: Record<string, string> = {
    "strength": "力量训练", "weight training": "力量训练",
    "bodyweight": "塑形训练", "sculpting": "塑形训练",
    "cardio": "有氧燃脂", "aerobic": "有氧燃脂",
    "yoga": "瑜伽", "stretching": "拉伸",
    "rehab": "康复", "rehabilitation": "康复",
  };
  if (typeof corrected.training_type === "string" && trainingTypeMap[corrected.training_type.toLowerCase()]) {
    corrected.training_type = trainingTypeMap[corrected.training_type.toLowerCase()];
  }

  const categoryMap: Record<string, string> = {
    "glutes": "臀腿", "legs": "臀腿", "lower body": "臀腿",
    "back": "背部", "shoulders": "肩胸", "chest": "肩胸", "upper body": "肩胸",
    "core": "核心", "abs": "核心",
    "full body": "全身",
    "cardio": "有氧",
    "stretch": "拉伸", "stretching": "拉伸",
  };
  if (typeof corrected.category === "string" && categoryMap[corrected.category.toLowerCase()]) {
    corrected.category = categoryMap[corrected.category.toLowerCase()];
  }

  // Validate
  if (!corrected.difficulty || !WORKOUT_VALID_DIFFICULTY.includes(corrected.difficulty as string)) {
    errors.push(`difficulty 值无效: ${corrected.difficulty}，允许: ${WORKOUT_VALID_DIFFICULTY.join("/")}`);
  }

  if (!corrected.training_type || !WORKOUT_VALID_TRAINING_TYPE.includes(corrected.training_type as string)) {
    errors.push(`training_type 值无效: ${corrected.training_type}，允许: ${WORKOUT_VALID_TRAINING_TYPE.join("/")}`);
  }

  if (!corrected.category || !WORKOUT_VALID_CATEGORY.includes(corrected.category as string)) {
    errors.push(`category 值无效: ${corrected.category}，允许: ${WORKOUT_VALID_CATEGORY.join("/")}`);
  }

  if (corrected.estimated_duration !== undefined && corrected.estimated_duration !== null) {
    const d = corrected.estimated_duration as number;
    if (typeof d !== "number" || d < 1 || d > 300) {
      errors.push(`estimated_duration 超出范围: ${d}，允许 1-300`);
    }
  }

  return { valid: errors.length === 0, errors, corrected };
}

function validateRecipeMetadata(metadata: Record<string, unknown>): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ingredients_json — warn if missing but don't block
  // v2: supports grouped object {main/marinade/sauce/garnish} and flat array
  const rawIng = metadata.ingredients || metadata.ingredients_json;
  if (!rawIng) {
    warnings.push("ingredients_json 缺失（AI 无法从来源获取食材信息）");
  } else if (typeof rawIng === "object" && !Array.isArray(rawIng)) {
    // Grouped format — validate each group's items
    const grouped = rawIng as Record<string, unknown>;
    for (const key of ["main", "marinade", "sauce", "garnish"]) {
      const items = grouped[key];
      if (items && Array.isArray(items)) {
        for (const item of items as Array<Record<string, unknown>>) {
          if (!item.name || typeof item.name !== "string") {
            errors.push(`ingredients_json.${key} 元素缺少 name: ${JSON.stringify(item)}`);
          }
        }
      }
    }
  } else if (Array.isArray(rawIng)) {
    // Flat array format (legacy)
    for (const item of rawIng as Array<Record<string, unknown>>) {
      if (!item.name || typeof item.name !== "string") {
        errors.push(`ingredients_json 元素缺少 name: ${JSON.stringify(item)}`);
      }
    }
  } else {
    warnings.push("ingredients_json 格式异常，已忽略");
  }

  // steps_json — warn if missing but don't block
  if (!metadata.steps_json) {
    warnings.push("steps_json 缺失（AI 无法从来源获取步骤信息）");
  } else if (!Array.isArray(metadata.steps_json)) {
    warnings.push("steps_json 格式异常，已忽略");
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

  // Only truly invalid if there are hard errors (not warnings)
  return { valid: errors.length === 0, errors, warnings };
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

  // ── Stage: payload ──
  let body: {
    url?: string;
    text?: string;
    preferred_module?: string;
    workout_video_id?: string;
    recipe_id?: string;
    source_context?: string;
    source_content?: Record<string, unknown>;
    source_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({
      stage: "payload",
      error: "请求格式错误，无法解析 JSON",
    }, req, 400);
  }

  const workoutVideoId = body.workout_video_id || "";
  const recipeId = body.recipe_id || "";
  const sourceContext = body.source_context || "";
  const sourceContent = body.source_content || null;
  const sourceType = body.source_type || "";

  const input = body.url || body.text || "";
  if (!input && !workoutVideoId && !recipeId) {
    return jsonResponse({
      stage: "payload",
      error: "请提供 URL 链接或文本内容",
    }, req, 400);
  }

  // ── Stage: auth ──
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let user: { id: string };
  try {
    const authResult = await supabase.auth.getUser(token);
    if (authResult.error || !authResult.data?.user) {
      return jsonResponse({ stage: "auth", error: "Unauthorized" }, req, 401);
    }
    user = authResult.data.user;
  } catch (authCatchErr) {
    console.error(`[content-parser-agent] Auth error: ${(authCatchErr as Error).message}`);
    return jsonResponse({ stage: "auth", error: "认证服务异常", detail: (authCatchErr as Error).message }, req, 500);
  }

  try {

    const inputIsUrl = body.url ? true : isUrl(input);
    const platform = inputIsUrl ? detectPlatform(input) : "text";
    const preferredModule = body.preferred_module || "";

    // Determine if this is a recipe pipeline call (has source_content from extractor)
    const isRecipePipeline = recipeId && (sourceContent || sourceContext);
    const isWorkoutPath = !!workoutVideoId;

    // ── Stage: input_receive ──
    console.log("[content-parser-agent] stage=input_receive", {
      url: body.url ? body.url.slice(0, 80) : null,
      platform,
      inputLen: input.length,
      isRecipePipeline,
      isWorkoutPath,
      workoutVideoId: workoutVideoId || null,
      recipeId: recipeId || null,
    });

    let systemPrompt: string;
    let userMessage: string;

    if (isRecipePipeline) {
      // ═══════════════════════════════════════════
      // RECIPE PATH — real content only, no guessing
      // ═══════════════════════════════════════════
      systemPrompt = RECIPE_PARSER_PROMPT;

      // Build user message from REAL content only
      const parts: string[] = [];

      if (sourceContext) {
        parts.push(`## 用户补充说明\n${sourceContext}`);
      }

      if (sourceContent) {
        const sc = sourceContent as Record<string, unknown>;

        // Prefer pre-built source_material from extractor, or build from fields
        const sourceMaterial = (sc.vision_result as string) || (sc.source_material as string);
        if (sourceMaterial && sourceMaterial.length > 20) {
          parts.push(`## 来源素材（source_material）\n\n${sourceMaterial}`);
        } else {
          // Fallback: build source_material from individual fields
          const materialParts: string[] = [];
          if (sc.title) materialParts.push(`标题: ${sc.title}`);
          if (sc.description) materialParts.push(`正文: ${(sc.description as string).slice(0, 3000)}`);
          if (sc.subtitle) materialParts.push(`字幕: ${(sc.subtitle as string).slice(0, 5000)}`);
          if (sc.transcript && sc.transcript !== sc.subtitle) materialParts.push(`文字记录: ${(sc.transcript as string).slice(0, 5000)}`);
          if (sc.ocr_text) materialParts.push(`OCR: ${(sc.ocr_text as string).slice(0, 5000)}`);
          if (materialParts.length > 0) {
            parts.push(`## 来源素材（source_material）\n\n${materialParts.join("\n\n")}`);
          }
        }

        if (sc.platform) parts.push(`## 来源平台\n${sc.platform}`);
      }

      // If no real content at all, return failed
      const hasRealContent = parts.length > 0;
      if (!hasRealContent) {
        if (recipeId) {
          await supabase.from("recipes").update({
            ai_analysis_status: "failed",
            ai_summary: "无法从此链接获取真实内容，请使用手动输入补充食谱信息。",
            confidence: "low",
          }).eq("id", recipeId);
        }
        return jsonResponse({
          error: "no_content",
          message: "无法获取真实内容，请使用手动输入补充食谱",
          ai_analysis_status: "failed",
        }, req, 200);
      }

      userMessage = parts.join("\n\n");
      console.log(`[content-parser-agent] Recipe path: source_type=${sourceType} content_parts=${parts.length}`);

    } else {
      // ═══════════════════════════════════════════
      // LEGACY PATH — workout videos, articles, etc.
      // ═══════════════════════════════════════════
      systemPrompt = UNIFIED_PROMPT;

      // ── Stage: video_fetch ──
      let fetchedContent: UrlContentResult = { title: "", description: "", text: "" };
      if (inputIsUrl) {
        console.log("[content-parser-agent] stage=video_fetch start", { url: input.slice(0, 80), platform });
        fetchedContent = await fetchUrlContent(input);
        console.log("[content-parser-agent] stage=video_fetch done", {
          title: fetchedContent.title.slice(0, 80),
          textLen: fetchedContent.text.length,
          descLen: fetchedContent.description.length,
          error: fetchedContent.error || null,
          statusCode: fetchedContent.statusCode || null,
        });
      }

      // ── Stage: content_extract ──
      userMessage = "";
      if (sourceContext) {
        userMessage = `用户提供的上下文:\n${sourceContext}\n\n`;
      }

      if (inputIsUrl) {
        userMessage += `输入类型: URL链接\nURL: ${input}\n平台: ${platform}`;
        // Tell AI this is expected to be a fitness/training video so it uses workout metadata
        if (isWorkoutPath) {
          userMessage += `\n\n注意：这是一个训练视频链接。请使用 workout 类型的 metadata 格式，包含 difficulty（初级/中级/高级）、training_type（力量训练/塑形训练/有氧燃脂/HIIT/拉伸/瑜伽/康复）、category（臀腿/背部/肩胸/核心/全身/有氧/拉伸）、estimated_duration（预估分钟数）、target_muscles（目标肌群数组）。如果无法从页面内容确定这些信息，请根据视频标题合理推断。`;
        }
        if (fetchedContent.title) userMessage += `\n页面标题: ${fetchedContent.title}`;
        if (fetchedContent.description) userMessage += `\n页面描述: ${fetchedContent.description}`;
        if (fetchedContent.text) userMessage += `\n页面文本片段: ${fetchedContent.text}`;
        if (!sourceContext && fetchedContent.text.length <= 50 && !fetchedContent.title) {
          userMessage += `\n\n⚠️ 无法获取此链接的页面内容，请根据URL和平台名称进行合理推断。`;
        }
      } else {
        userMessage += `输入类型: 文本内容\n文本: ${input.slice(0, 3000)}`;
      }
      if (preferredModule) {
        userMessage += `\n用户偏好模块: ${preferredModule}`;
      }

      console.log("[content-parser-agent] stage=content_extract", {
        userMessageLen: userMessage.length,
        hasTitle: !!fetchedContent.title,
        hasText: fetchedContent.text.length > 50,
        fetchError: fetchedContent.error || null,
      });
    }

    // ── Stage: deepseek_call ──
    console.log("[content-parser-agent] stage=deepseek_call start", {
      isRecipePipeline,
      promptLen: systemPrompt.length,
      msgLen: userMessage.length,
      totalChars: systemPrompt.length + userMessage.length,
    });

    const aiResult = await aiRuntime<Record<string, unknown>>(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { agentName: "content-parser", maxTokens: isRecipePipeline ? 4096 : 3072, temperature: isRecipePipeline ? 0.3 : 0.5 },
    );

    if (!aiResult.success) {
      console.error("[content-parser-agent] stage=deepseek_call FAILED", {
        aiStage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail || null,
      });
      if (workoutVideoId) {
        await supabase.from("workout_videos").update({ ai_analysis_status: "failed" }).eq("id", workoutVideoId);
      }
      if (recipeId) {
        await supabase.from("recipes").update({ ai_analysis_status: "failed" }).eq("id", recipeId);
      }
      return jsonResponse({ stage: aiResult.stage, error: aiResult.error, detail: aiResult.detail }, req, 500);
    }

    // ── Stage: response_parse ──
    const parsed = aiResult.data;
    const tokensUsed: number = aiResult.usage?.totalTokens || 0;

    console.log("[content-parser-agent] stage=response_parse", {
      tokensUsed,
      content_type: parsed.content_type || "?",
      title: (parsed.title as string)?.slice(0, 60) || "",
      hasMetadata: !!parsed.metadata,
      metadataKeys: parsed.metadata ? Object.keys(parsed.metadata as object) : [],
      rawLen: aiResult.raw?.length || 0,
    });

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
    let metadata = (parsed.metadata as Record<string, unknown>) || {};

    // Fallback: AI may return workout/recipe fields at top level instead of nested under metadata
    if (Object.keys(metadata).length === 0) {
      // Recipe fallback
      if (parsed.name || parsed.ingredients || parsed.steps) {
        metadata = parsed;
      }
      // Workout fallback: detect workout fields at top level
      if (parsed.difficulty || parsed.training_type || parsed.category || parsed.target_muscles) {
        console.log("[content-parser-agent] stage=response_parse workout fallback: using top-level fields as metadata");
        metadata = parsed;
      }
    }

    // ── Route to target table ──
    let targetTable = "resources";
    let recordId = "";

    if (content_type === "workout") {
      targetTable = "workout_videos";

      // Validate workout metadata against schema (with auto-correction)
      const validation = validateWorkoutMetadata(metadata);
      if (!validation.valid) {
        console.error("[content-parser-agent] stage=response_parse validation FAILED", {
          errors: validation.errors,
          rawMetadata: JSON.stringify(metadata).slice(0, 300),
          topLevelKeys: Object.keys(parsed).slice(0, 15),
        });
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
          received_metadata: metadata,
          ai_raw_keys: Object.keys(parsed),
          ai_raw_sample: aiResult.raw?.slice(0, 500),
        }, req, 500);
      }

      // Use corrected metadata
      metadata = validation.corrected;

      if (workoutVideoId) {
        // ── Stage: database_save ──
        console.log("[content-parser-agent] stage=database_save workout", {
          workoutVideoId,
          title: title.slice(0, 60),
          category: metadata.category,
          difficulty: metadata.difficulty,
          training_type: metadata.training_type,
          duration: metadata.estimated_duration,
          muscles: (metadata.target_muscles as string[])?.length || 0,
        });
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

        if (updated) {
          recordId = updated.id as string;
          console.log("[content-parser-agent] stage=database_save done", { recordId, status: "completed" });
        } else {
          console.error("[content-parser-agent] stage=database_save FAILED: no row updated", { workoutVideoId });
        }
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

      // Sanitize AI output: prevent name/ingredients/steps field pollution
      metadata = sanitizeRecipeOutput(metadata);

      // Validate recipe metadata — non-blocking for video/title-only sources
      const recipeValidation = validateRecipeMetadata(metadata);

      // Extract recipe name from metadata
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

      // Extract new fields: ingredients, steps, source_text, confidence
      // v2: ingredients can be grouped object {main/marinade/sauce/garnish} or flat array
      const rawIngredients = metadata.ingredients || metadata.ingredients_json;
      const isGroupedIngredients = rawIngredients && typeof rawIngredients === "object" && !Array.isArray(rawIngredients);

      const aiIngredients = isGroupedIngredients
        ? (rawIngredients as Record<string, Array<{ name?: string; amount?: string }>>)
        : rawIngredients as Array<{ name?: string; amount?: string; category?: string }> | undefined;

      const aiSteps = (metadata.steps || metadata.steps_json || []) as Array<{ order?: number; text?: string; duration?: number }>;
      const aiTips = (metadata.tips as Record<string, string | null>) || null;
      const aiSourceText = (metadata.source_text as string) || "";
      const confidence = (metadata.confidence as string) || "medium";

      // Enforce confidence rules:
      // low → no full recipe, empty ingredients/steps
      const finalIngredients = confidence === "low" ? (isGroupedIngredients ? {} : []) : aiIngredients;
      const finalSteps = confidence === "low" ? [] : aiSteps;

      const hasName = recipeName && recipeName !== "未命名食谱";

      // Count ingredients across groups (object) or flat (array)
      let hasIngredients: boolean;
      let totalIngredientCount: number;
      if (isGroupedIngredients && finalIngredients && typeof finalIngredients === "object") {
        const groups = finalIngredients as Record<string, Array<unknown>>;
        totalIngredientCount = (groups.main?.length || 0) + (groups.marinade?.length || 0)
          + (groups.sauce?.length || 0) + (groups.garnish?.length || 0);
        hasIngredients = totalIngredientCount > 0;
      } else if (Array.isArray(finalIngredients)) {
        totalIngredientCount = (finalIngredients as Array<unknown>).length;
        hasIngredients = totalIngredientCount > 0;
      } else {
        totalIngredientCount = 0;
        hasIngredients = false;
      }

      const hasSteps = finalSteps.length > 0;

      // Check source_content quality — detect empty or near-empty extractions
      const sourceTitle = (sourceContent?.title as string) || "";
      const sourceDesc = (sourceContent?.description as string) || "";
      const sourceSubtitle = (sourceContent?.subtitle as string) || "";
      const sourceOcr = (sourceContent?.ocr_text as string) || "";
      const sourceTranscript = (sourceContent?.transcript as string) || "";
      const hasSourceContent = (
        (sourceTitle.length > 0) ||
        (sourceDesc.length > 30) ||
        (sourceSubtitle.length > 30) ||
        (sourceOcr.length > 30) ||
        (sourceTranscript.length > 30)
      );

      // Data quality protection: empty source → partial, never completed
      const sourceIsEmpty = !hasSourceContent;

      // Determine AI status using simplified 5-state model
      let aiStatus: string;
      if (confidence === "low" || sourceIsEmpty) {
        aiStatus = "partial";
      } else if (!hasName && !hasIngredients && !hasSteps) {
        aiStatus = "failed";
      } else if (hasName && hasIngredients && hasSteps) {
        aiStatus = "completed";
      } else {
        aiStatus = "partial";
      }

      // Build ai_summary: preserve source_text + validation info + structured tips
      const aiSummaryParts: string[] = [];
      if (aiSourceText) aiSummaryParts.push(aiSourceText);

      // Include structured tips from v2 prompt
      if (aiTips) {
        const tipsParts: string[] = [];
        if (aiTips.cooking) tipsParts.push(`🔥 烹饪技巧: ${aiTips.cooking}`);
        if (aiTips.health) tipsParts.push(`💚 健康建议: ${aiTips.health}`);
        if (aiTips.storage) tipsParts.push(`📦 保存建议: ${aiTips.storage}`);
        if (tipsParts.length > 0) {
          aiSummaryParts.push("\n---\n" + tipsParts.join("\n\n"));
        }
      }

      if (sourceIsEmpty) {
        aiSummaryParts.push("\n⚠️ 来源内容不足，请补充正文或上传图片。");
      }
      if (aiStatus === "partial" && !sourceIsEmpty) {
        const missing: string[] = [];
        if (!hasIngredients) missing.push("食材清单");
        if (!hasSteps) missing.push("烹饪步骤");
        if (!hasName) missing.push("食谱名称");
        if (missing.length > 0) {
          aiSummaryParts.push(`\n📝 状态：部分整理（缺少：${missing.join("、")}）。请在食谱详情中手动补充。`);
        }
      }
      if (aiStatus === "failed") {
        aiSummaryParts.push(`\n❌ AI 无法从此来源提取食谱信息。请手动编辑补充食材和步骤。`);
      }
      const finalAiSummary = aiSummaryParts.join("") || null;

      // Override confidence to "low" if source is empty (quality gate)
      const finalConfidence = sourceIsEmpty ? "low" : confidence;

      // Validate meal_time against allowed values
      const mealTimeRaw = metadata.meal_time;
      const mealTime = Array.isArray(mealTimeRaw)
        ? (mealTimeRaw as string[]).filter((m: string) => RECIPE_VALID_MEAL_TIME.includes(m as typeof RECIPE_VALID_MEAL_TIME[number]))
        : [];

      const updateFields = {
        name: recipeName || "未命名食谱",
        image_url: (metadata.image_url as string) || null,
        category: (metadata.category as string) || category,
        meal_time: mealTime.length > 0 ? mealTime : null,
        goal: goalArray.length > 0 ? goalArray : null,
        health_level: (metadata.health_level as string) || null,
        budget_level: (metadata.budget_level as string) || null,
        calories_per_serving: (metadata.calories_per_serving as number) || null,
        protein_grams: (metadata.protein_grams as number) || null,
        carbs_grams: (metadata.carbs_grams as number) || null,
        fat_grams: (metadata.fat_grams as number) || null,
        ingredients_json: finalIngredients,
        steps_json: finalSteps,
        ai_summary: finalAiSummary,
        ai_analysis_status: aiStatus,
        ai_analyzed_at: new Date().toISOString(),
        confidence: finalConfidence,
      };

      console.log(
        `[content-parser-agent] Recipe result: name="${recipeName.slice(0, 60)}" ` +
        `ingredients=${totalIngredientCount} steps=${finalSteps.length} ` +
        `status=${aiStatus} confidence=${finalConfidence} source_text=${aiSourceText.length} chars ` +
        `source_quality=${sourceIsEmpty ? "empty" : "ok"}`,
      );

      if (recipeId) {
        // ── UPDATE mode: enrich existing recipe row ──
        const { data: updated } = await supabase
          .from("recipes")
          .update(updateFields)
          .eq("id", recipeId)
          .select("id")
          .single();

        if (updated) recordId = updated.id as string;
      } else {
        // ── INSERT mode: create new recipe row ──
        const { data: inserted } = await supabase
          .from("recipes")
          .insert({
            ...updateFields,
            user_id: user.id,
            source_url: inputIsUrl ? input : null,
            source_platform: inputIsUrl ? platform : null,
          })
          .select("id")
          .single();

        if (inserted) recordId = inserted.id as string;
      }
    } else {
      // ── RESOURCES PATH (article/video/course) ──
      // v2: Do NOT auto-save. Return parsed data for user confirmation.
      targetTable = "resources";
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
        recipe_id: recipeId || null,
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
    // v2: Include new knowledge extraction fields.
    // For resources (article/video/course), recordId is empty (no auto-save).
    // Preserve raw text content when input is not a URL.
    return jsonResponse({
      content_type,
      title,
      category,
      summary,
      key_points,
      important_quotes: (parsed.important_quotes as string[]) || [],
      action_items,
      suggested_category: (parsed.suggested_category as string) || "",
      applicable_scenarios: (parsed.applicable_scenarios as string[]) || [],
      related_knowledge: (parsed.related_knowledge as string[]) || [],
      tags,
      metadata,
      target_table: targetTable,
      record_id: recordId,
      tokens_used: tokensUsed,
      source_url: body.url || input || null,
      source_platform: inputIsUrl ? platform : null,
      raw_content: inputIsUrl ? null : (body.text || input || null),
    }, req);

  } catch (err) {
    console.error(`[content-parser-agent] internal error: ${(err as Error).message}`, (err as Error).stack);
    return jsonResponse({
      stage: "internal",
      error: (err as Error).message || "服务器内部错误",
    }, req, 500);
  }
});
