// ============================================
// Nancy OS — English Coach Edge Function v3
// v3: JWT auth required for all calls.
// Always injects user context (preferences + history).
// Removed anonymous proxy path for security.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiRuntime } from "../_shared/ai.ts";
import { authenticateRequest, getConfirmedMemories, getExpressionAssets, matchExpressionAssets, trackAssetUsage, getNancyPersonalProfileWithGrowth, buildNancyPersonalProfileContextWithGrowth } from "../_shared/nancy-context.ts";

type UntypedSupabaseClient = any;

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

// ── Helpers ──

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── Build learning context from memories + history ──

function buildLearningContext(
  memories: Array<{ memory_type: string; content: string }>,
  reviewStats: { totalReviewed: number; correctRate: number; problemAreas: string[] },
  speakingStats: { totalSessions: number; avgDuration: number; recentScenarios: string[] },
): string {
  const lines: string[] = [];

  if (memories.length > 0) {
    lines.push("## 用户学习偏好（来自长期记忆）");
    const learningMemories = memories.filter((m) =>
      ["preference", "habit", "insight", "skill"].includes(m.memory_type as string),
    );
    for (const m of learningMemories.slice(0, 10)) {
      lines.push(`- [${m.memory_type}] ${m.content}`);
    }

    const personalityMemories = memories.filter((m) => m.memory_type === "personality");
    if (personalityMemories.length > 0) {
      lines.push("\n## 用户性格特点");
      for (const m of personalityMemories.slice(0, 3)) {
        lines.push(`- ${m.content}`);
      }
      lines.push("请根据性格特点调整鼓励方式和反馈语气。");
    }
  }

  if (reviewStats.totalReviewed > 0) {
    lines.push("\n## 用户学习数据");
    lines.push(`- 累计复习次数: ${reviewStats.totalReviewed}`);
    lines.push(`- 正确率: ${Math.round(reviewStats.correctRate * 100)}%`);
    if (reviewStats.problemAreas.length > 0) {
      lines.push(`- 薄弱领域: ${reviewStats.problemAreas.join("、")}`);
      lines.push("请在反馈中优先关注这些薄弱领域。");
    }
  }

  if (speakingStats.totalSessions > 0) {
    lines.push(`- 口语练习次数: ${speakingStats.totalSessions}`);
    lines.push(`- 平均练习时长: ${Math.round(speakingStats.avgDuration / 60)}分钟`);
    if (speakingStats.recentScenarios.length > 0) {
      lines.push(`- 最近练习场景: ${speakingStats.recentScenarios.join("、")}`);
    }
  }

  if (lines.length === 0) return "";

  lines.unshift("## 用户学习上下文（供个性化教练参考）");
  return lines.join("\n");
}

// ── Summarize Daily Review ──

async function handleSummarizeDailyReview(
  req: Request,
  body: Record<string, unknown>,
  supabase: UntypedSupabaseClient,
  userId: string,
): Promise<Response> {
  const dailySet = body.dailySet as Array<{
    english?: unknown;
    chinese?: unknown;
    recall?: { initial_rating?: unknown; final_status?: unknown; reinforcement_count?: unknown };
    cloze?: { completed?: unknown; correct?: unknown; user_answer?: unknown };
    sentence?: { completed?: unknown; user_sentence?: unknown; ai_feedback?: unknown };
  }> | undefined;
  const modeCompletion = body.mode_completion as {
    recall?: { completed_count?: number; total?: number };
    cloze?: { completed_count?: number; total?: number; correct_count?: number };
    sentence?: { completed_count?: number; total?: number };
  } | undefined;
  const date = (body.date as string) || new Date().toISOString().split("T")[0];

  if (!dailySet || !Array.isArray(dailySet) || dailySet.length === 0) {
    return jsonResponse(req, { error: "dailySet array is required for summarization" }, 400);
  }

  // Build a compact summary prompt with enriched per-expression data
  const expressions = dailySet.map((item) => ({
    english: typeof item.english === "string" ? item.english : "unknown",
    chinese: typeof item.chinese === "string" ? item.chinese : "",
    recall_score: typeof item.recall?.initial_rating === "number" ? item.recall.initial_rating : null,
    recall_status: typeof item.recall?.final_status === "string" ? item.recall.final_status : "pending",
    recall_reinforcement: typeof item.recall?.reinforcement_count === "number" ? item.recall.reinforcement_count : 0,
    cloze_done: item.cloze?.completed === true,
    cloze_correct: item.cloze?.correct === true,
    cloze_user_answer: typeof item.cloze?.user_answer === "string" ? item.cloze.user_answer : null,
    sentence_done: item.sentence?.completed === true,
    sentence_text: typeof item.sentence?.user_sentence === "string" ? item.sentence.user_sentence : null,
    sentence_feedback: item.sentence?.ai_feedback ?? null,
  }));

  // V3.5: Pre-compute expression categories to help AI
  const activatedExpressions = expressions.filter(
    (e) => e.recall_score !== null && e.cloze_correct && e.sentence_done,
  );
  const recallOnlyExpressions = expressions.filter(
    (e) => e.recall_score !== null && !e.cloze_done && !e.sentence_done,
  );
  const contextWeakExpressions = expressions.filter(
    (e) => e.cloze_done && !e.cloze_correct,
  );
  const productionWeakExpressions = expressions.filter(
    (e) => e.sentence_done && e.recall_score !== null && e.recall_score < 3,
  );

  const summaryPrompt = `You are an English learning coach. Analyze today's review session and write a concise summary in Chinese.

## Today's Date: ${date}

## Mode Completion
- Active Recall: ${modeCompletion?.recall?.completed_count ?? 0}/${modeCompletion?.recall?.total ?? 0}
- Cloze: ${modeCompletion?.cloze?.completed_count ?? 0}/${modeCompletion?.cloze?.total ?? 0} (correct: ${modeCompletion?.cloze?.correct_count ?? 0})
- Sentence: ${modeCompletion?.sentence?.completed_count ?? 0}/${modeCompletion?.sentence?.total ?? 0}

## Expressions Reviewed
${JSON.stringify(expressions, null, 2)}

## Pre-computed Categories (V3.5)
- activated_expressions (completed all 3 modes correctly): ${JSON.stringify(activatedExpressions.map((e) => e.english))}
- recall_only (only recall done, no cloze/sentence yet): ${JSON.stringify(recallOnlyExpressions.map((e) => e.english))}
- context_weak (cloze done but incorrect): ${JSON.stringify(contextWeakExpressions.map((e) => e.english))}
- production_weak (sentence done but recall score < 3): ${JSON.stringify(productionWeakExpressions.map((e) => e.english))}

## Instructions
Return a JSON object with these fields (all in Chinese):
{
  "overview": "总体评价，2-3句话，语气鼓励",
  "completion_summary": "完成情况统计的一句话总结",
  "recall_analysis": { "summary": "主动回忆分析", "difficult_expressions": ["困难的表达1", ...] } | null,
  "cloze_analysis": { "summary": "填空分析", "common_errors": ["常见错误1", ...] } | null,
  "sentence_analysis": { "summary": "造句分析", "good_outputs": ["好的造句1", ...], "needs_improvement": ["需要改进的1", ...] } | null,
  "activated_expressions": ["已全面激活的表达", ...] (expressions mastered across all 3 modes),
  "recall_only_expressions": ["仅完成回忆的表达", ...] (expressions that need cloze/sentence practice),
  "context_weak_expressions": ["语境薄弱的表达", ...] (cloze was incorrect — poor contextual understanding),
  "production_weak_expressions": ["输出薄弱的表达", ...] (recall score < 3 — weak active production),
  "strongest_expressions": ["掌握最好的表达", ...] (3-5个),
  "weakest_expressions": ["需要加强的表达", ...] (3-5个),
  "error_patterns": [{ "pattern": "错误模式描述", "expressions": ["相关表达"], "suggestion": "改进建议" }] (1-3 common error patterns),
  "tomorrow_focus": "明天学习重点建议，1-2句话"
}

Use the pre-computed categories as a reference, but apply your own judgment. Only include analysis sections that have relevant data. Keep everything concise.`;

  try {
    const aiResult = await aiRuntime<Record<string, unknown>>(
      [{ role: "user", content: summaryPrompt }],
      {
        agentName: "english-coach-summary",
        maxTokens: 2048,
        temperature: 0.5,
        parseJson: true,
        dynamicTokens: false,
      },
    );

    if (!aiResult.success) {
      return jsonResponse(req, {
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    // Log the summary generation
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "daily_summary",
      input_data: {
        expression_count: dailySet.length,
        date,
      },
      output_data: { summary: aiResult.data },
      model: "deepseek-chat",
      tokens_used: aiResult.usage?.totalTokens || 0,
    });

    return jsonResponse(req, {
      success: true,
      data: aiResult.data,
    });
  } catch (err) {
    return jsonResponse(req, {
      error: err instanceof Error ? err.message : "Summary generation failed",
    }, 500);
  }
}

// ── Action: generate_cloze_batch ──

async function handleGenerateClozeBatch(
  req: Request,
  body: Record<string, unknown>,
  supabase: UntypedSupabaseClient,
  userId: string,
): Promise<Response> {
  const expressions = body.expressions as Array<{ english: string; chinese: string; context?: string }> | undefined;

  if (!expressions || !Array.isArray(expressions) || expressions.length === 0) {
    return jsonResponse(req, { error: "expressions array is required" }, 400);
  }

  const batchPrompt = `Generate one cloze sentence for each expression below.
For each expression, create a natural English sentence where the target expression is replaced with "_____".
The blank should be where the expression naturally appears in the sentence.

Return a JSON object where keys are the exact English expressions and values are the cloze sentences:
{
  "expression1": "Complete sentence with _____ replacing the expression.",
  ...
}

Rules:
- Each sentence MUST contain exactly one "_____" where the expression goes
- The sentence must be a natural, realistic English sentence
- Do NOT include the expression itself in the sentence (it's replaced by _____)
- If context is provided, use it to make the sentence more relevant

Expressions:`;

  const exprList = expressions
    .map((e) => {
      const ctx = e.context ? ` (context: ${e.context})` : "";
      return `- "${e.english}" (${e.chinese})${ctx}`;
    })
    .join("\n");

  const prompt = `${batchPrompt}\n${exprList}`;

  try {
    const aiResult = await aiRuntime<Record<string, string>>(
      [{ role: "user", content: prompt }],
      {
        agentName: "english-coach-cloze-batch",
        maxTokens: Math.min(expressions.length * 128, 2048),
        temperature: 0.5,
        parseJson: true,
        dynamicTokens: false,
      },
    );

    if (!aiResult.success) {
      return jsonResponse(req, {
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    // Validate results: each must contain _____
    const validated: Record<string, string> = {};
    if (aiResult.data) {
      for (const [key, value] of Object.entries(aiResult.data)) {
        if (typeof value === "string" && value.includes("_____")) {
          validated[key] = value;
        }
      }
    }

    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "generate_cloze_batch",
      input_data: { expression_count: expressions.length },
      output_data: { generated_count: Object.keys(validated).length },
      model: "deepseek-chat",
      tokens_used: aiResult.usage?.totalTokens || 0,
    });

    return jsonResponse(req, { success: true, data: validated });
  } catch (err) {
    return jsonResponse(req, {
      error: err instanceof Error ? err.message : "Cloze batch generation failed",
    }, 500);
  }
}

// ── Action: generate_context_cloze (V3.5) ──
// Batch generation of full ContextClozeCards.
// Lightweight — does NOT load personal profile, growth engine, or assets.
// Each input expression gets one card. Response keys on expression_id.

interface ContextClozeInput {
  id?: string;
  expression_id?: string;
  english: string;
  chinese: string;
  type?: string;
  example_sentence?: string;
  usage_note?: string;
  native_usage?: string;
  context?: string;
  situation?: string;
  common_patterns?: string;
}

interface ContextClozeCardResponse {
  expression_id: string;
  scenario_zh: string;
  sentence_full: string;
  answer_form: string;
  explanation_zh: string;
  semantic_hint_zh: string;
}

async function handleGenerateContextCloze(
  req: Request,
  body: Record<string, unknown>,
  supabase: UntypedSupabaseClient,
  userId: string,
): Promise<Response> {
  const expressions = body.expressions as ContextClozeInput[] | undefined;

  if (!expressions || !Array.isArray(expressions) || expressions.length === 0) {
    return jsonResponse(req, { error: "expressions array is required" }, 400);
  }

  if (expressions.length > 10) {
    return jsonResponse(req, { error: "max 10 expressions per batch" }, 400);
  }

  // Build a deterministic id for each input — prefer expression_id, fall back to english
  const exprList = expressions.map((e) => {
    const id = e.expression_id || e.id || e.english;
    const parts: string[] = [`- id: ${id}`, `  expression: "${e.english}"`, `  chinese: ${e.chinese}`];
    if (e.type) parts.push(`  type: ${e.type}`);
    if (e.example_sentence) parts.push(`  example: "${e.example_sentence}"`);
    if (e.usage_note) parts.push(`  usage: ${e.usage_note}`);
    if (e.native_usage) parts.push(`  native_usage: ${e.native_usage}`);
    if (e.context) parts.push(`  context: ${e.context}`);
    if (e.situation) parts.push(`  situation: ${e.situation}`);
    if (e.common_patterns) parts.push(`  patterns: ${e.common_patterns}`);
    return parts.join("\n");
  }).join("\n\n");

  const batchPrompt = `你是一名专业 ESL 情境练习设计师。

为以下每一个 Target Expression 分别生成一题 Contextual Retrieval Cloze。
每一个 item 必须独立。

返回严格 JSON：
{
  "cards": [
    {
      "expression_id": "...",
      "scenario_zh": "...",
      "sentence_full": "...",
      "answer_form": "...",
      "explanation_zh": "...",
      "semantic_hint_zh": "..."
    }
  ]
}

规则：
- 每个 expression_id 必须返回一次，不可遗漏，不可新增 id
- scenario_zh 用中文写，描述一个具体场景，不能出现目标英文表达本身
- sentence_full 必须是自然英文句子，必须包含 answer_form（不能是空白）
- answer_form 是目标表达在句子中出现的真实语法形式（可能是原形也可能是变形）
- explanation_zh 用中文解释为什么这个语境下用这个表达
- semantic_hint_zh 用中文给出含义提示（不要直接给答案）
- 适合中级英语学习者
- 不要输出 markdown

--- 以下为需要生成的目标表达 ---

${exprList}`;

  try {
    const aiResult = await aiRuntime<{ cards: ContextClozeCardResponse[] }>(
      [{ role: "user", content: batchPrompt }],
      {
        agentName: "english-coach-context-cloze",
        maxTokens: Math.min(expressions.length * 256, 3072),
        temperature: 0.6,
        parseJson: true,
        dynamicTokens: false,
      },
    );

    if (!aiResult.success) {
      return jsonResponse(req, {
        success: false,
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    // Validate each card
    const cards: ContextClozeCardResponse[] = [];
    if (aiResult.data?.cards && Array.isArray(aiResult.data.cards)) {
      for (const card of aiResult.data.cards) {
        if (
          card.expression_id &&
          card.scenario_zh?.trim() &&
          card.sentence_full?.trim() &&
          card.answer_form?.trim() &&
          card.explanation_zh?.trim() &&
          card.semantic_hint_zh?.trim() &&
          card.sentence_full.toLowerCase().includes(card.answer_form.toLowerCase()) &&
          !card.scenario_zh.toLowerCase().includes(card.answer_form.toLowerCase())
        ) {
          cards.push(card);
        }
      }
    }

    // Map input expression_ids to track which were covered
    const inputIds = expressions.map((e) => e.expression_id || e.id || e.english);
    const returnedIds = new Set(cards.map((c) => c.expression_id));
    const missing = inputIds.filter((id) => !returnedIds.has(id));

    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "generate_context_cloze",
      input_data: { expression_count: expressions.length },
      output_data: {
        generated_count: cards.length,
        missing_ids: missing.length > 0 ? missing : undefined,
      },
      model: "deepseek-chat",
      tokens_used: aiResult.usage?.totalTokens || 0,
    });

    return jsonResponse(req, {
      success: true,
      data: {
        cards,
        missing_ids: missing.length > 0 ? missing : undefined,
      },
    });
  } catch (err) {
    return jsonResponse(req, {
      success: false,
      error: err instanceof Error ? err.message : "Context cloze batch generation failed",
    }, 500);
  }
}

// ── Action: evaluate_personal_sentence (sentence_feedback_v2) ──

type SentenceVerdict = "natural" | "acceptable" | "needs_revision";
type SentenceEvaluation = {
  verdict: SentenceVerdict;
  expression_mastery: {
    meaning: "correct" | "partial" | "incorrect";
    structure: "correct" | "incorrect";
    collocation: "natural" | "acceptable" | "unnatural";
    context_fit: "natural" | "acceptable" | "inappropriate";
  };
  grammar: {
    correct: boolean;
    issues: Array<{ original: string; correction: string; explanation: string }>;
  };
  naturalness: {
    level: "natural" | "understandable_but_non_native" | "unnatural";
    reason: string;
  };
  primary_issue: "none" | "meaning" | "structure" | "collocation" | "context" | "grammar" | "naturalness";
  feedback: string;
  minimal_revision: string;
  natural_version: string;
  usage_tip: string;
  expression_used_correctly: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireEnum<T extends string>(value: unknown, values: readonly T[], path: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new Error(`${path} is invalid`);
  return value as T;
}

function requireString(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new Error(`${path} must not be empty`);
  return normalized;
}

function deriveHardGateVerdict(value: SentenceEvaluation): SentenceVerdict {
  const mastery = value.expression_mastery;
  if (
    !value.expression_used_correctly
    || mastery.meaning === "incorrect"
    || mastery.structure === "incorrect"
    || mastery.collocation === "unnatural"
    || mastery.context_fit === "inappropriate"
    || !value.grammar.correct
    || value.naturalness.level === "unnatural"
  ) return "needs_revision";
  if (
    mastery.meaning === "partial"
    || mastery.collocation === "acceptable"
    || mastery.context_fit === "acceptable"
    || value.naturalness.level === "understandable_but_non_native"
  ) return "acceptable";
  return "natural";
}

function validateSentenceEvaluation(raw: unknown): SentenceEvaluation {
  if (!isRecord(raw) || !isRecord(raw.expression_mastery) || !isRecord(raw.grammar) || !isRecord(raw.naturalness)) {
    throw new Error("required evaluation objects are missing");
  }
  if (typeof raw.grammar.correct !== "boolean" || !Array.isArray(raw.grammar.issues)) {
    throw new Error("grammar fields are invalid");
  }
  if (typeof raw.expression_used_correctly !== "boolean") throw new Error("expression_used_correctly must be boolean");
  const value: SentenceEvaluation = {
    verdict: requireEnum(raw.verdict, ["natural", "acceptable", "needs_revision"] as const, "verdict"),
    expression_mastery: {
      meaning: requireEnum(raw.expression_mastery.meaning, ["correct", "partial", "incorrect"] as const, "expression_mastery.meaning"),
      structure: requireEnum(raw.expression_mastery.structure, ["correct", "incorrect"] as const, "expression_mastery.structure"),
      collocation: requireEnum(raw.expression_mastery.collocation, ["natural", "acceptable", "unnatural"] as const, "expression_mastery.collocation"),
      context_fit: requireEnum(raw.expression_mastery.context_fit, ["natural", "acceptable", "inappropriate"] as const, "expression_mastery.context_fit"),
    },
    grammar: {
      correct: raw.grammar.correct,
      issues: raw.grammar.issues.map((issue, index) => {
        if (!isRecord(issue)) throw new Error(`grammar.issues[${index}] is invalid`);
        return {
          original: requireString(issue.original, `grammar.issues[${index}].original`),
          correction: requireString(issue.correction, `grammar.issues[${index}].correction`),
          explanation: requireString(issue.explanation, `grammar.issues[${index}].explanation`),
        };
      }),
    },
    naturalness: {
      level: requireEnum(raw.naturalness.level, ["natural", "understandable_but_non_native", "unnatural"] as const, "naturalness.level"),
      reason: requireString(raw.naturalness.reason, "naturalness.reason"),
    },
    primary_issue: requireEnum(raw.primary_issue, ["none", "meaning", "structure", "collocation", "context", "grammar", "naturalness"] as const, "primary_issue"),
    feedback: requireString(raw.feedback, "feedback"),
    minimal_revision: requireString(raw.minimal_revision, "minimal_revision", true),
    natural_version: requireString(raw.natural_version, "natural_version"),
    usage_tip: requireString(raw.usage_tip, "usage_tip"),
    expression_used_correctly: raw.expression_used_correctly,
  };
  if (!value.grammar.correct && value.grammar.issues.length === 0) {
    throw new Error("grammar.issues must describe an incorrect grammar result");
  }
  const hardGateVerdict = deriveHardGateVerdict(value);
  const severity = { natural: 0, acceptable: 1, needs_revision: 2 } as const;
  if (severity[hardGateVerdict] > severity[value.verdict]) value.verdict = hardGateVerdict;
  return value;
}

async function handleEvaluatePersonalSentence(
  req: Request,
  body: Record<string, unknown>,
  supabase: UntypedSupabaseClient,
  userId: string,
): Promise<Response> {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const text = (key: string, max = 2000) => typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";
  const expressionId = text("expression_id", 100);
  const expression = text("expression", 300);
  const userSentence = text("user_sentence", 1600);

  if (!expression || !userSentence) {
    return jsonResponse(req, { success: false, stage: "payload", error: "expression and user_sentence are required", requestId }, 400);
  }

  const usageSource = {
    expression,
    meaning: text("meaning", 600),
    expression_type: text("expression_type", 100),
    english_explanation: text("english_explanation"),
    usage_note: text("usage_note"),
    native_usage: text("native_usage"),
    common_patterns: text("common_patterns"),
    context: text("context"),
    situation: text("situation"),
    synonyms: text("synonyms"),
    common_mistakes: text("common_mistakes"),
    example_sentence: text("example_sentence"),
    cloze_sentence: text("cloze_sentence"),
    memory_tip: text("memory_tip"),
  };

  const evalPrompt = `You are evaluating whether the learner has genuinely mastered the TARGET EXPRESSION, not whether the sentence is merely understandable.
Your job is linguistic diagnosis, not encouragement. Separate the linguistic verdict from motivational tone. Never raise the linguistic verdict just to be supportive.

STEP 1: Build an internal ExpressionUsageCard from the supplied library fields. Determine core_meaning, usage_function, grammar_pattern, typical_contexts, common_collocations, register, common_misuses, and native_usage_note. Do this inside the same request; do not output the card.
STEP 2: Check whether the learner uses the target expression with the right meaning and structure.
STEP 3: Check collocation, register, and whether the created context is plausible.
STEP 4: Check the WHOLE sentence for grammar errors, including errors outside the target phrase.
STEP 5: Check whether a native speaker would plausibly say it in this situation.
STEP 6: Assign the verdict using the hard gates below.

HARD GATES:
- natural: ONLY when meaning, structure, collocation, context, whole-sentence grammar, and native-level plausibility all pass with no meaningful problem.
- acceptable: meaning and structure are basically correct and the sentence is understandable, but there is a noticeable collocation, context, register, or non-native wording problem.
- needs_revision: ANY clear grammar error, target-expression misuse, wrong structure/preposition, wrong collocation, inappropriate context, contradiction, mechanical insertion, or failure to use the target expression.
- A target-expression core usage error MUST be needs_revision, never acceptable.
- Any clear whole-sentence grammar error cannot be natural.
- Understandable, semantically recoverable, close enough, or clear learner intention are NOT equivalent to natural and correct.
- Technically grammatical does not mean native-like.
- The target expression is the PRIMARY object of evaluation. A grammatically perfect sentence that misuses it must fail.
- Encouragement may appear in feedback, but NEVER changes verdict.

Prefer a minimal_revision that preserves the learner's meaning and structure. Do not rewrite the whole sentence unless necessary.

REFERENCE CALIBRATION:
- "I take it upon myself to admit the mistake." for "take it upon oneself to do something" is acceptable, not natural: the pattern and broad meaning work, but admitting one's own mistake is normally already the speaker's responsibility and is not a typical voluntarily-unassigned task.
- "Wow. You all fit is everything. Look at how shiny the skirt it is." for "your outfit is everything" is needs_revision because the target phrase and whole-sentence grammar are wrong.

Expression library fields:
${JSON.stringify(usageSource, null, 2)}

Learner sentence:
${JSON.stringify(userSentence)}

Return strict JSON only:
{
  "verdict": "natural | acceptable | needs_revision",
  "expression_mastery": {
    "meaning": "correct | partial | incorrect",
    "structure": "correct | incorrect",
    "collocation": "natural | acceptable | unnatural",
    "context_fit": "natural | acceptable | inappropriate"
  },
  "grammar": {
    "correct": true,
    "issues": [{ "original": "", "correction": "", "explanation": "Chinese explanation" }]
  },
  "naturalness": {
    "level": "natural | understandable_but_non_native | unnatural",
    "reason": "Chinese diagnosis"
  },
  "primary_issue": "none | meaning | structure | collocation | context | grammar | naturalness",
  "feedback": "concise Chinese linguistic feedback; motivation must not change verdict",
  "minimal_revision": "empty string only when no revision is needed",
  "natural_version": "natural version, or the original sentence when already natural",
  "usage_tip": "concise Chinese usage tip",
  "expression_used_correctly": true
}`;

  try {
    const aiResult = await aiRuntime<Record<string, unknown>>(
      [{ role: "user", content: evalPrompt }],
      {
        agentName: "english-coach-sentence-eval",
        maxTokens: 1024,
        temperature: 0.3,
        parseJson: true,
        dynamicTokens: false,
      },
    );

    if (!aiResult.success) {
      await supabase.from("agent_logs").insert({
        user_id: userId,
        agent_type: "english_coach",
        action: "evaluate_personal_sentence",
        input_data: { request_id: requestId, expression_id: expressionId || null, prompt_version: "sentence_feedback_v2" },
        output_data: { response_validation_status: "not_run", failure_stage: aiResult.stage, latency_ms: Date.now() - startedAt },
        model: "deepseek-chat",
        model_version: "sentence_feedback_v2",
        tokens_used: 0,
      });
      return jsonResponse(req, {
        success: false,
        stage: aiResult.stage,
        error: aiResult.error,
        detail: aiResult.detail,
        requestId,
      }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    let data: SentenceEvaluation;
    try {
      data = validateSentenceEvaluation(aiResult.data);
    } catch (validationError) {
      await supabase.from("agent_logs").insert({
        user_id: userId,
        agent_type: "english_coach",
        action: "evaluate_personal_sentence",
        input_data: { request_id: requestId, expression_id: expressionId || null, prompt_version: "sentence_feedback_v2" },
        output_data: { response_validation_status: "invalid", latency_ms: Date.now() - startedAt },
        model: "deepseek-chat",
        model_version: "sentence_feedback_v2",
        tokens_used: aiResult.usage?.totalTokens || 0,
      });
      return jsonResponse(req, {
        success: false,
        stage: "response_validation",
        error: validationError instanceof Error ? validationError.message : "AI response validation failed",
        requestId,
      }, 502);
    }

    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "evaluate_personal_sentence",
      input_data: {
        request_id: requestId,
        expression_id: expressionId || null,
        prompt_version: "sentence_feedback_v2",
        usage_fields_present: Object.entries(usageSource).filter(([, value]) => Boolean(value)).map(([key]) => key),
      },
      output_data: {
        verdict: data.verdict,
        primary_issue: data.primary_issue,
        grammar_correct: data.grammar.correct,
        expression_used_correctly: data.expression_used_correctly,
        latency_ms: Date.now() - startedAt,
        response_validation_status: "valid",
      },
      model: "deepseek-chat",
      model_version: "sentence_feedback_v2",
      tokens_used: aiResult.usage?.totalTokens || 0,
    });

    return jsonResponse(req, { success: true, data, requestId });
  } catch (err) {
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "evaluate_personal_sentence",
      input_data: { request_id: requestId, expression_id: expressionId || null, prompt_version: "sentence_feedback_v2" },
      output_data: { response_validation_status: "not_run", failure_stage: "internal", latency_ms: Date.now() - startedAt },
      model: "deepseek-chat",
      model_version: "sentence_feedback_v2",
      tokens_used: 0,
    });
    return jsonResponse(req, {
      success: false,
      stage: "internal",
      error: err instanceof Error ? err.message : "Sentence evaluation failed",
      requestId,
    }, 500);
  }
}

// ── Main ──

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const action = body.action as string | undefined;

    // ── Auth ──
    const auth = await authenticateRequest(req);
    if (!auth) return jsonResponse(req, { error: "需要登录" }, 401);
    const { supabase, userId } = auth;

    // ── Action: summarize_daily_review (no messages required) ──
    if (action === "summarize_daily_review") {
      return handleSummarizeDailyReview(req, body, supabase, userId);
    }

    // ── Action: generate_cloze_batch (V3.6 legacy — simple cloze sentences) ──
    if (action === "generate_cloze_batch") {
      return handleGenerateClozeBatch(req, body, supabase, userId);
    }

    // ── Action: generate_context_cloze (V3.5 — full ContextClozeCards) ──
    if (action === "generate_context_cloze") {
      return handleGenerateContextCloze(req, body, supabase, userId);
    }

    // ── Action: evaluate_personal_sentence (V3.6) ──
    if (action === "evaluate_personal_sentence") {
      return handleEvaluatePersonalSentence(req, body, supabase, userId);
    }

    // ── Normal coaching: require messages ──
    const messages = body.messages as Array<{ role: string; content: string }>;
    const model = (body.model as string) || "deepseek-chat";
    const maxTokens = (body.maxTokens as number) || 2048;
    const temperature = (body.temperature as number) ?? 0.7;

    if (!messages || !Array.isArray(messages)) {
      return jsonResponse(req, { error: "messages array is required" }, 400);
    }

    const speakingFeedback = body.speaking_feedback === true;

    // Fetch learning context in parallel
    const [
      confirmedMemories,
      { data: expressionReviews },
      { data: speakingSessions },
    ] = await Promise.all([
      getConfirmedMemories(supabase, userId, {
        limit: 15,
        memoryTypes: ["preference", "personality", "habit", "insight", "skill"],
      }),
      supabase.from("expression_reviews")
        .select("id,result")
        .eq("user_id", userId)
        .order("reviewed_at", { ascending: false })
        .limit(50),
      supabase.from("speaking_sessions")
        .select("id,scenario,duration_seconds")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Compute review stats
    const reviews = (expressionReviews || []) as Array<{ result: string }>;
    const totalReviewed = reviews.length;
    const correctCount = reviews.filter((r) => r.result === "correct").length;
    const correctRate = totalReviewed > 0 ? correctCount / totalReviewed : 0;
    const incorrectResults = reviews.filter((r) => r.result === "incorrect" || r.result === "partial");

    const problemAreas: string[] = [];
    if (incorrectResults.length > totalReviewed * 0.3) problemAreas.push("词汇准确性");
    if (incorrectResults.length > totalReviewed * 0.5) problemAreas.push("语法结构");

    // Compute speaking stats
    const sessions = (speakingSessions || []) as Array<{ scenario: string; duration_seconds: number }>;
    const totalSessions = sessions.length;
    const avgDuration = totalSessions > 0
      ? sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / totalSessions
      : 0;
    const recentScenarios = [...new Set(sessions.slice(0, 5).map((s) => s.scenario))];

    const learningContext = buildLearningContext(
      confirmedMemories,
      { totalReviewed, correctRate, problemAreas },
      { totalSessions, avgDuration, recentScenarios },
    );

    // ── Nancy personal profile (non-fatal) ──
    let nancyProfileContext = "";
    try {
      const nancyProfile = await getNancyPersonalProfileWithGrowth(supabase, userId);
      nancyProfileContext = buildNancyPersonalProfileContextWithGrowth(nancyProfile);
    } catch (profileErr) {
      console.error("[english-coach] Nancy profile error (non-fatal):", (profileErr as Error).message);
    }

    // ── Personal story context (non-fatal) ──
    // Detect if conversation involves interview / storytelling / self-intro
    // where the user's real expression assets provide better context than AI fiction.
    const lastUserMsg = messages.filter((m) => m.role === "user").pop()?.content || "";
    const isStoryScenario = /interview|challenge|tell me about|experience|自我介绍|经历|面试|speak about|describe a time/i.test(lastUserMsg)
      || recentScenarios.some((s) => /interview|business|storytelling/i.test(s));

    let personalStoryContext = "";
    if (isStoryScenario && !speakingFeedback) {
      try {
        const assets = await getExpressionAssets(supabase, userId, {
          limit: 15,
          types: ["personal_story", "experience_case"],
        });
        const matches = matchExpressionAssets(assets, {
          question: lastUserMsg.slice(0, 200),
          scenario: recentScenarios[0] || "",
        });

        if (matches.length > 0) {
          const lines = ["\n## 用户真实经历（禁止编造，优先使用以下真实经历）"];
          for (const m of matches.slice(0, 3)) {
            lines.push(`- **${m.title}**：${m.usage_suggestion}（匹配: ${m.match_score}%）`);
          }
          lines.push("→ 在给出示例回答时，优先基于以上真实经历构建。不要编造用户没有的经历。");
          personalStoryContext = lines.join("\n");
          trackAssetUsage(supabase, userId, "english_coach", matches);
        } else {
          personalStoryContext = "\n## 注意：用户尚未保存相关真实经历。请基于通用场景给出建议，同时鼓励用户分享自己的真实经历以获得更个性化的指导。不要编造用户的个人经历。";
        }
      } catch (assetErr) {
        console.error("[english-coach] asset context error (non-fatal):", (assetErr as Error).message);
      }
    }

    // ── Build messages with context injection ──
    const finalMessages = [...messages];
    if (learningContext && !speakingFeedback) {
      const hasSystem = finalMessages.length > 0 && finalMessages[0].role === "system";
      if (hasSystem) {
        finalMessages[0] = {
          role: "system",
          content: finalMessages[0].content + "\n\n" + learningContext,
        };
      } else {
        finalMessages.unshift({ role: "system", content: learningContext });
      }
    }

    // Inject personal story context as a high-priority system message
    if (personalStoryContext && !speakingFeedback) {
      finalMessages.unshift({ role: "system", content: personalStoryContext });
    }

    // Inject Nancy personal profile as the highest-priority system message
    if (nancyProfileContext && !speakingFeedback) {
      finalMessages.unshift({ role: "system", content: nancyProfileContext });
    }

    // ── AI Runtime: chat agent (raw text, no JSON parse) ──
    const aiResult = await aiRuntime<string>(finalMessages as Array<{ role: "system" | "user" | "assistant"; content: string }>, {
      agentName: "english-coach",
      maxTokens,
      temperature,
      parseJson: false,
      dynamicTokens: false,
    });
    if (!aiResult.success) {
      return jsonResponse(req, { stage: aiResult.stage, error: aiResult.error, detail: aiResult.detail }, aiResult.stage === "deepseek" ? 502 : 500);
    }

    const tokensUsed: number = aiResult.usage?.totalTokens || 0;

    // ── Log ──
    await supabase.from("agent_logs").insert({
      user_id: userId,
      agent_type: "english_coach",
      action: "coaching_session",
      input_data: {
        message_count: messages.length,
        memory_count: (confirmedMemories || []).length,
        review_count: totalReviewed,
        speaking_count: totalSessions,
        context_injected: true,
      },
      output_data: { model, tokens_used: tokensUsed },
      model,
      tokens_used: tokensUsed,
    });

    return jsonResponse(req,{
      content: aiResult.data || "",
      model: model,
      tokensUsed: aiResult.usage?.totalTokens,
      context_injected: true,
      personal_story_injected: !!personalStoryContext,
      context_sources: learningContext ? {
        memories_count: (confirmedMemories || []).length,
        reviews_count: totalReviewed,
      } : null,
    });
  } catch (err) {
    return jsonResponse(req,{
      error: err instanceof Error ? err.message : "服务器内部错误",
    }, 500);
  }
});
