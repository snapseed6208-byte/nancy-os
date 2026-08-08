// ============================================
// Nancy OS — Unified AI Context Layer
// ============================================
// Single entry point for all Edge Functions to access
// user profile, memories, and module-specific profiles.
//
// Design principles:
// - Read-only layer (no writes to profile tables)
// - Backward-compatible (old functions keep working)
// - No business logic changes
// - Replaces 20 identical auth blocks, 20 CORS blocks,
//   5 memory queries, and 3 diverged memory-to-text converters
//
// Usage:
//   import { authenticateRequest, getCorsHeaders, jsonResponse,
//            getUserContext, buildMemoryProfile } from "../_shared/nancy-context.ts";
// ============================================

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// ── Types ──

export interface MemoryRow {
  id: string;
  memory_type: string;
  content: string;
  confidence: number;
  status?: string;
  reinforcement_count?: number;
  evidence?: unknown;
  title?: string;
  category?: string;
  importance?: string;
}

export interface UserProfileRow {
  id: string;
  display_name?: string;
  avatar_url?: string;
  timezone?: string;
  language_preference?: string;
  career_field?: string;
  industry?: string;
  bio?: string;
  birth_date?: string;
  phone?: string;
  social_links?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  life_theme?: string;
  energy_pattern?: Record<string, unknown>;
  onboarding_completed?: boolean;
  current_milestone?: string;
}

export interface BodyProfileRow {
  id: string;
  user_id: string;
  height?: number;
  weight?: number;
  target_weight?: number;
  body_fat_percentage?: number;
  target_body_fat?: number;
  fitness_goal?: string;
  focus_areas?: unknown;
  notes?: string;
}

export interface ExpressionProfileRow {
  id: string;
  user_id: string;
  strengths?: Record<string, unknown>;
  weaknesses?: Record<string, unknown>;
  patterns?: Record<string, unknown>;
  improvement_history?: unknown[];
  raw_signal_snapshot?: Record<string, unknown>;
  knowledge_transfer_profile?: Record<string, unknown>;
  asset_stats?: Record<string, unknown>;
}

export interface NancyUserContext {
  userId: string;
  profile: UserProfileRow | null;
  bodyProfile: BodyProfileRow | null;
  expressionProfile: ExpressionProfileRow | null;
  confirmedMemories: MemoryRow[];
}

export interface MemoryFetchOptions {
  /** Max memories to return (default 20) */
  limit?: number;
  /** Filter by memory_type (default: all confirmed) */
  memoryTypes?: string[];
  /** Status filter (default: "confirmed") */
  status?: string;
}

export type MemoryProfileFormat = "preference" | "learning" | "minimal";

export interface UserContextOptions {
  /** Include profile table (default: true) */
  profile?: boolean;
  /** Include body_profile (default: false) */
  bodyProfile?: boolean;
  /** Include expression_profile (default: false) */
  expressionProfile?: boolean;
  /** Include confirmed memories (default: true) */
  memories?: boolean;
  /** Memory fetch options */
  memoryOptions?: MemoryFetchOptions;
}

// ── Constants ──

const DEFAULT_ALLOWED_ORIGINS = [
  "https://nancy-os.pages.dev",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ── 1. Authentication ──

export interface AuthResult {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Authenticate a request and return a service-role Supabase client + userId.
 *
 * Replaces this 12-line block (copy-pasted in 20 Edge Functions):
 *   const authHeader = req.headers.get("Authorization") || "";
 *   const token = authHeader.replace("Bearer ", "");
 *   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 *   const { data: { user } } = await supabase.auth.getUser(token);
 *   if (!user) return ...;
 *
 * Usage:
 *   const auth = await authenticateRequest(req);
 *   if (!auth) return; // auth already sent the 401 response
 *   const { supabase, userId } = auth;
 */
export async function authenticateRequest(
  req: Request,
): Promise<AuthResult | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) {
    return null;
  }

  return { supabase, userId: user.id };
}

/**
 * Authenticate or respond with 401. Convenience wrapper.
 * Returns AuthResult, or sends a 401 Response and returns null.
 */
export async function authenticateOrRespond(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthResult | { response: Response }> {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return {
      response: new Response(JSON.stringify({ error: "未登录" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  return auth;
}

// ── 2. CORS ──

/**
 * Get CORS headers for a request.
 * Replaces this 6-line block (copy-pasted in 20 Edge Functions):
 *   const origin = req.headers.get("Origin") || "";
 *   const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
 *   return { "Access-Control-Allow-Origin": allowed, ... };
 */
export function getCorsHeaders(
  req: Request,
  allowedOrigins: string[] = DEFAULT_ALLOWED_ORIGINS,
): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// ── 3. JSON Response ──

/**
 * Unified JSON response helper.
 * Replaces this pattern (copy-pasted in 20 Edge Functions):
 *   return new Response(JSON.stringify(data), {
 *     status, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
 *   });
 */
export function jsonResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── 4. Memories ──

/**
 * Fetch confirmed ai_memories for a user.
 *
 * Replaces this 7-line block (copy-pasted with variations in 5 Edge Functions):
 *   supabase.from("ai_memories")
 *     .select("id,memory_type,content,confidence,status,reinforcement_count,evidence")
 *     .eq("user_id", userId).eq("is_active", true).eq("status", "confirmed")
 *     .order("last_reinforced_at", { ascending: false }).limit(20)
 */
export async function getConfirmedMemories(
  supabase: SupabaseClient,
  userId: string,
  options: MemoryFetchOptions = {},
): Promise<MemoryRow[]> {
  const {
    limit = 20,
    memoryTypes,
    status = "confirmed",
  } = options;

  let query = supabase
    .from("ai_memories")
    .select("id,memory_type,content,confidence,status,reinforcement_count,evidence,title,category,importance")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("status", status)
    .order("last_reinforced_at", { ascending: false })
    .limit(limit);

  if (memoryTypes && memoryTypes.length > 0) {
    query = query.in("memory_type", memoryTypes);
  }

  const { data } = await query;
  return (data || []) as MemoryRow[];
}

// ── 5. Memory-to-Text Builders ──

const MEMORY_TYPE_LABELS: Record<string, string> = {
  preference: "偏好与倾向",
  personality: "性格特点",
  habit: "行为习惯",
  insight: "深层洞察",
  skill: "技能特长",
};

const MEMORY_TYPE_LABELS_SHORT: Record<string, string> = {
  preference: "偏好",
  personality: "性格",
  habit: "习惯",
  insight: "洞察",
  skill: "技能",
};

/**
 * Build a unified memory profile string for AI system prompts.
 *
 * Replaces 3 diverged implementations:
 * - daily-brief-agent: buildPreferenceProfile()  — "用户长期偏好画像"
 * - task-breakdown-agent: buildUserProfile()      — "用户长期偏好记忆"
 * - english-coach: buildLearningContext()          — "用户学习上下文"
 *
 * Formats:
 * - "preference": Full profile with labels, instructions for personalized suggestions
 * - "learning": Learning-focused, filters to preference/habit/insight/skill + personality
 * - "minimal": Just the memory list, no instructions
 */
export function buildMemoryProfile(
  memories: MemoryRow[],
  format: MemoryProfileFormat = "preference",
): string {
  if (memories.length === 0) return "";

  const byType = new Map<string, string[]>();
  for (const m of memories) {
    const type = m.memory_type || "general";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(m.content);
  }

  const lines: string[] = [];
  const labels = format === "learning" ? MEMORY_TYPE_LABELS_SHORT : MEMORY_TYPE_LABELS;

  switch (format) {
    case "preference": {
      lines.push("## 用户长期偏好画像");
      for (const [type, contents] of byType) {
        lines.push(`\n### ${labels[type] || type}`);
        for (const c of contents.slice(0, 5)) {
          lines.push(`- ${c}`);
        }
      }
      lines.push(
        "\n在生成简报时请参考以上画像：",
        "- 建议应匹配用户的偏好和行为模式",
        "- 鼓励语应体现用户的性格特点",
        "- 警告应对照用户的历史习惯来检测偏离",
      );
      break;
    }
    case "learning": {
      // Learning-relevant types: preference, habit, insight, skill
      const learningTypes = ["preference", "habit", "insight", "skill"];
      const filtered = [...byType].filter(([t]) => learningTypes.includes(t));
      const personality = byType.get("personality");

      if (filtered.length > 0 || personality) {
        lines.push("## 用户学习偏好（来自长期记忆）");
        for (const [type, contents] of filtered) {
          lines.push(`\n### ${labels[type] || type}`);
          for (const c of contents.slice(0, 3)) {
            lines.push(`- ${c}`);
          }
        }
        if (personality) {
          lines.push("\n### 性格特点");
          for (const c of personality.slice(0, 3)) {
            lines.push(`- ${c}`);
          }
          lines.push("请根据性格特点调整鼓励方式和反馈语气。");
        }
        lines.push(
          "\n请在拆解任务时参考以上偏好：",
          "- 如果用户有工作节奏偏好（如喜欢短时间任务），调整 estimated_minutes",
          "- 如果用户有学习风格偏好，调整任务类型",
          "- 如果用户有效能习惯（如晨间高效），标注合适的执行时间建议",
        );
      }
      break;
    }
    case "minimal": {
      lines.push("## 已有长期记忆（Confirmed Memories）—— 仅供参考，避免重复提取");
      lines.push("以下模式已被确认，如果新数据只是印证它们，请不要重复提取。");
      for (const [type, contents] of byType) {
        for (const c of contents.slice(0, 3)) {
          lines.push(`- [${type}] ${c}`);
        }
      }
      break;
    }
  }

  return lines.join("\n");
}

/**
 * Build learning context with stats — english-coach specific variant.
 * Kept for backward compatibility; english-coach combines memories + review stats + speaking stats.
 */
export function buildLearningContext(
  memories: MemoryRow[],
  reviewStats: { totalReviewed: number; correctRate: number; problemAreas: string[] },
  speakingStats: { totalSessions: number; avgDuration: number; recentScenarios: string[] },
): string {
  const lines: string[] = [];

  if (memories.length > 0) {
    lines.push("## 用户学习偏好（来自长期记忆）");
    const learningMemories = memories.filter((m) =>
      ["preference", "habit", "insight", "skill"].includes(m.memory_type),
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

// ── 6. Profile Readers ──

/**
 * Read user profile from the `profiles` table (source of truth).
 *
 * Used by chinese-expression-agent via getUserContext() for personalization.
 * Settings.tsx writes to profiles via useProfile hook, with auth metadata sync
 * for backward compatibility.
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .limit(1)
    .single();

  return data as UserProfileRow | null;
}

/**
 * Read body profile.
 */
export async function getBodyProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<BodyProfileRow | null> {
  const { data } = await supabase
    .from("body_profiles")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return data as BodyProfileRow | null;
}

/**
 * Read expression (Chinese speaking) profile.
 *
 * NOTE: Currently zero Edge Functions read this table.
 * This function adds the capability.
 */
export async function getExpressionProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ExpressionProfileRow | null> {
  const { data } = await supabase
    .from("expression_profiles")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return data as ExpressionProfileRow | null;
}

// ── 7. Composite Context Builder ──

/**
 * Fetch a unified user context with all requested components.
 *
 * This is the ONE function most Edge Functions should call:
 *
 *   const ctx = await getUserContext(supabase, userId, {
 *     memories: true,
 *     bodyProfile: true,  // for health functions
 *   });
 *
 * Individual profile fetchers are also exported for fine-grained control.
 */
export async function getUserContext(
  supabase: SupabaseClient,
  userId: string,
  options: UserContextOptions = {},
): Promise<NancyUserContext> {
  const {
    profile = true,
    bodyProfile = false,
    expressionProfile = false,
    memories = true,
    memoryOptions,
  } = options;

  const fetchers: Promise<unknown>[] = [];
  const labels: string[] = [];

  // Profile
  if (profile) { fetchers.push(getUserProfile(supabase, userId)); labels.push("profile"); }
  else { fetchers.push(Promise.resolve(null)); labels.push("profile"); }

  // Body profile
  if (bodyProfile) { fetchers.push(getBodyProfile(supabase, userId)); labels.push("bodyProfile"); }
  else { fetchers.push(Promise.resolve(null)); labels.push("bodyProfile"); }

  // Expression profile
  if (expressionProfile) { fetchers.push(getExpressionProfile(supabase, userId)); labels.push("expressionProfile"); }
  else { fetchers.push(Promise.resolve(null)); labels.push("expressionProfile"); }

  // Memories
  if (memories) { fetchers.push(getConfirmedMemories(supabase, userId, memoryOptions)); labels.push("memories"); }
  else { fetchers.push(Promise.resolve([])); labels.push("memories"); }

  const results = await Promise.all(fetchers);

  const getLabel = (index: number) => labels[index] || `result_${index}`;
  const resultMap = new Map<string, unknown>();
  results.forEach((r, i) => resultMap.set(getLabel(i), r));

  return {
    userId,
    profile: (resultMap.get("profile") || null) as UserProfileRow | null,
    bodyProfile: (resultMap.get("bodyProfile") || null) as BodyProfileRow | null,
    expressionProfile: (resultMap.get("expressionProfile") || null) as ExpressionProfileRow | null,
    confirmedMemories: (resultMap.get("memories") || []) as MemoryRow[],
  };
}

// ── 8. Expression Asset Summary ──

export interface ExpressionAssetSummary {
  total: number;
  byType: Record<string, number>;
  recentTitles: string[];
}

/**
 * Get a lightweight summary of user's expression assets.
 * Used by chinese-expression-agent for personalization.
 */
export async function getExpressionAssetSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<ExpressionAssetSummary | null> {
  const { data } = await supabase
    .from("expression_assets")
    .select("asset_type, title, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return null;

  const byType: Record<string, number> = {};
  for (const a of data) {
    byType[a.asset_type] = (byType[a.asset_type] || 0) + 1;
  }

  return {
    total: data.length,
    byType,
    recentTitles: data.slice(0, 5).map((a: Record<string, unknown>) => a.title as string),
  };
}

// ── 8b. Expression Asset Retrieval Engine ──

export interface ExpressionAssetCompact {
  id: string;
  title: string;
  asset_type: string;
  tags: string[];
  summary: string;
  key_skills: string[];
  scenarios: string[];
  usable_for: string[];
  quality_score: { completeness: number; authenticity: number; reusability: number };
}

export interface ExpressionAssetCollection {
  stories: ExpressionAssetCompact[];
  cases: ExpressionAssetCompact[];
  viewpoints: ExpressionAssetCompact[];
  expressions: ExpressionAssetCompact[];
  total: number;
}

export interface MatchedAsset {
  asset_id: string;
  title: string;
  asset_type: string;
  match_score: number;
  reason: string;
  usage_suggestion: string;
}

interface AssetDataRaw {
  background?: string;
  challenge?: string;
  action?: string;
  result?: string;
  reflection?: string;
  situation?: string;
  task?: string;
  learning?: string;
  topic?: string;
  my_position?: string;
  reasoning?: string;
  example?: string;
  boundary?: string;
  counter_argument?: string;
  original_question?: string;
  my_original_answer?: string;
  optimized_answer?: string;
  why_good?: string;
  skill_tags?: string[];
  quote?: string;
  source_context?: string;
  my_understanding?: string;
  application_scene?: string;
}

function extractAssetCompact(row: Record<string, unknown>): ExpressionAssetCompact {
  const assetType = (row.asset_type as string) || "";
  const title = (row.title as string) || "";
  const tags = (row.tags as string[]) || [];
  const ad = (row.asset_data || {}) as AssetDataRaw;
  const qs = (row.quality_score || { completeness: 0, authenticity: 0, reusability: 0 }) as {
    completeness: number; authenticity: number; reusability: number;
  };

  let summary = "";
  const scenarios: string[] = [];
  const keySkills: string[] = [...tags];

  switch (assetType) {
    case "personal_story": {
      summary = [ad.background, ad.challenge, ad.action, ad.reflection]
        .filter(Boolean).join(" → ").slice(0, 200);
      if (ad.background) scenarios.push(ad.background.slice(0, 60));
      if (ad.challenge) scenarios.push(ad.challenge.slice(0, 60));
      break;
    }
    case "experience_case": {
      summary = [ad.situation, ad.task, ad.learning].filter(Boolean).join(" | ").slice(0, 200);
      if (ad.situation) scenarios.push(ad.situation.slice(0, 60));
      if (ad.task) scenarios.push(ad.task.slice(0, 60));
      break;
    }
    case "viewpoint": {
      summary = `关于"${ad.topic || ""}"：${ad.my_position || ""}`.slice(0, 200);
      if (ad.topic) scenarios.push(ad.topic.slice(0, 60));
      if (ad.boundary) scenarios.push(`适用边界：${ad.boundary.slice(0, 60)}`);
      break;
    }
    case "quality_expression": {
      summary = (ad.optimized_answer || ad.my_original_answer || "").slice(0, 200);
      if (ad.original_question) scenarios.push(`问题：${ad.original_question.slice(0, 60)}`);
      if (ad.skill_tags) keySkills.push(...ad.skill_tags);
      break;
    }
    case "quote": {
      summary = `"${(ad.quote || "").slice(0, 120)}" — ${ad.my_understanding || ""}`.slice(0, 200);
      if (ad.application_scene) scenarios.push(ad.application_scene.slice(0, 60));
      if (ad.source_context) scenarios.push(ad.source_context.slice(0, 60));
      break;
    }
  }

  // Deduplicate skills
  const uniqueSkills = [...new Set(keySkills.map((s) => s.trim()).filter(Boolean))];

  // Synthesize usable_for prompts from type + scenarios + skills
  const usableFor: string[] = [];
  for (const s of scenarios.slice(0, 2)) {
    if (assetType === "personal_story" || assetType === "experience_case") {
      usableFor.push(`分享关于"${s.slice(0, 30)}"的真实经历`);
    }
    if (assetType === "viewpoint") {
      usableFor.push(`用你的观点"${title.slice(0, 30)}"来论证立场`);
    }
    if (assetType === "quality_expression") {
      usableFor.push(`参考你对"${s.slice(0, 30)}"的优质回答`);
    }
  }

  return {
    id: row.id as string,
    title,
    asset_type: assetType,
    tags: uniqueSkills.slice(0, 8),
    summary: summary || title,
    key_skills: uniqueSkills.slice(0, 6),
    scenarios: scenarios.filter(Boolean).slice(0, 4),
    usable_for: usableFor.slice(0, 3),
    quality_score: qs,
  };
}

/**
 * Fetch all active expression assets as compact representations.
 *
 * Returns assets grouped by type with extracted summaries, skills,
 * scenarios, and usable_for prompts — ready for AI context injection.
 * Token-efficient: never returns full narrative content.
 */
export async function getExpressionAssets(
  supabase: SupabaseClient,
  userId: string,
  options?: { limit?: number; types?: string[] },
): Promise<ExpressionAssetCollection> {
  const { data } = await supabase
    .from("expression_assets")
    .select("id, asset_type, title, asset_data, tags, quality_score")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(options?.limit || 20);

  const rows = (data || []) as Array<Record<string, unknown>>;
  const filtered = options?.types
    ? rows.filter((r) => options.types!.includes(r.asset_type as string))
    : rows;

  const all = filtered.map(extractAssetCompact);

  return {
    stories: all.filter((a) => a.asset_type === "personal_story"),
    cases: all.filter((a) => a.asset_type === "experience_case"),
    viewpoints: all.filter((a) => a.asset_type === "viewpoint"),
    expressions: all.filter((a) =>
      a.asset_type === "quality_expression" || a.asset_type === "quote",
    ),
    total: all.length,
  };
}

/**
 * Match expression assets against a topic, question, scenario, or skill.
 *
 * Scoring weights:
 * - Tag overlap: 40%
 * - Scenario keyword match: 30%
 * - Skill keyword match: 20%
 * - Quality boost: 10%
 *
 * Returns top matches with reasoning and usage suggestions.
 */
export function matchExpressionAssets(
  assets: ExpressionAssetCollection,
  query: {
    topic?: string;
    question?: string;
    scenario?: string;
    skill?: string;
    limit?: number;
  },
): MatchedAsset[] {
  if (assets.total === 0) return [];

  const allAssets = [
    ...assets.stories,
    ...assets.cases,
    ...assets.viewpoints,
    ...assets.expressions,
  ];

  const queryTokens = tokenize([
    query.topic,
    query.question,
    query.scenario,
    query.skill,
  ].filter(Boolean).join(" "));

  if (queryTokens.length === 0) {
    // No query → return highest quality assets
    return allAssets
      .sort((a, b) => (b.quality_score.reusability || 0) - (a.quality_score.reusability || 0))
      .slice(0, query.limit || 3)
      .map((a) => ({
        asset_id: a.id,
        title: a.title,
        asset_type: a.asset_type,
        match_score: a.quality_score.reusability || 50,
        reason: "高质量可复用资产",
        usage_suggestion: a.usable_for[0] || `在表达中引用"${a.title}"`,
      }));
  }

  const scored = allAssets.map((asset) => {
    const assetTokens = tokenize([
      asset.title,
      ...asset.tags,
      ...asset.scenarios,
      ...asset.key_skills,
    ].join(" "));

    // Tag overlap score
    const tagOverlap = intersect(queryTokens, asset.tags.map(tokenize).flat());
    const tagScore = asset.tags.length > 0
      ? (tagOverlap / Math.max(asset.tags.length, 1)) * 40
      : 0;

    // Scenario keyword match
    const scenarioText = asset.scenarios.join(" ");
    const scenarioTokens = tokenize(scenarioText);
    const scenarioOverlap = intersect(queryTokens, scenarioTokens);
    const scenarioScore = scenarioTokens.length > 0
      ? (scenarioOverlap / Math.max(scenarioTokens.length, 1)) * 30
      : 0;

    // Skill match
    const skillText = asset.key_skills.join(" ");
    const skillTokens = tokenize(skillText);
    const skillOverlap = intersect(queryTokens, skillTokens);
    const skillScore = skillTokens.length > 0
      ? (skillOverlap / Math.max(skillTokens.length, 1)) * 20
      : 0;

    // Quality boost
    const qualityScore = ((asset.quality_score.reusability || 50) / 100) * 10;

    const matchScore = Math.round(tagScore + scenarioScore + skillScore + qualityScore);

    // Build reason
    const reasons: string[] = [];
    if (tagOverlap > 1) reasons.push(`标签匹配：${tagOverlap}个共同关键词`);
    if (scenarioOverlap > 1) reasons.push(`场景相关`);
    if (skillOverlap > 1) reasons.push(`技能匹配：${skillOverlap}个共同技能`);
    if (reasons.length === 0) reasons.push("通用高质量资产");

    return {
      asset_id: asset.id,
      title: asset.title,
      asset_type: asset.asset_type,
      match_score: Math.min(matchScore, 100),
      reason: reasons.join("；"),
      usage_suggestion: asset.usable_for[0] || `引用"${asset.title}"来丰富表达`,
    };
  });

  return scored
    .filter((s) => s.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, query.limit || 5);
}

// ── 8c. Asset Usage Tracking ──

/**
 * Record that an agent recommended expression assets.
 * Fire-and-forget — errors are caught and logged, never thrown.
 */
export async function trackAssetUsage(
  supabase: SupabaseClient,
  userId: string,
  agentType: string,
  matchedAssets: MatchedAsset[],
): Promise<void> {
  if (!userId || matchedAssets.length === 0) return;

  const rows = matchedAssets.map((m) => ({
    asset_id: m.asset_id,
    user_id: userId,
    agent_type: agentType,
    action: "recommended",
    match_score: m.match_score,
  }));

  try {
    await supabase.from("expression_asset_usage").insert(rows);
  } catch (err) {
    console.error(`[nancy-context] trackAssetUsage error (non-fatal):`, (err as Error).message);
  }
}

// ── Helpers ──

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function intersect(a: string[], b: string[]): number {
  const bSet = new Set(b);
  return a.filter((t) => bSet.has(t)).length;
}

// ── 9. Expression Personalization Context Builder ──


const ASSET_TYPE_LABELS: Record<string, string> = {
  personal_story: "个人故事",
  experience_case: "经验案例",
  viewpoint: "观点立场",
  quality_expression: "优质表达",
  quote: "金句引用",
};

/**
 * Build a compact personalization context for the Chinese Expression Coach AI.
 *
 * Combines:
 * - User profile (display_name, life_theme)
 * - Expression profile (strengths, weaknesses, patterns, recent improvement)
 * - Expression assets (count by type, recent titles)
 * - Confirmed memories (expression-relevant: preference, habit, insight, skill)
 *
 * Designed to be injected as an additional system message in analyze_expression.
 * Kept compact to not bloat the existing V4/V5 skill prompt.
 */
export function buildExpressionPersonalizationContext(
  profile: UserProfileRow | null,
  expressionProfile: ExpressionProfileRow | null,
  assetSummary: ExpressionAssetSummary | null,
  memories: MemoryRow[],
): string {
  const hasProfile = profile && (profile.display_name || profile.life_theme);
  const hasExprProfile = expressionProfile && (
    Object.keys(expressionProfile.strengths || {}).length > 0 ||
    Object.keys(expressionProfile.weaknesses || {}).length > 0 ||
    Object.keys(expressionProfile.patterns || {}).length > 0
  );
  const hasAssets = assetSummary && assetSummary.total > 0;
  const expressionMemories = memories.filter((m) =>
    ["preference", "habit", "insight", "skill"].includes(m.memory_type),
  );
  const hasMemories = expressionMemories.length > 0;

  if (!hasProfile && !hasExprProfile && !hasAssets && !hasMemories) return "";

  const lines: string[] = [];
  lines.push("## 学员个人化教练上下文");
  lines.push("以下是这位学员的长期信息。请在所有诊断和建议中个性化参考，但不要逐字复述这些信息给用户。");

  // 1. Profile basics (minimal — just name + theme)
  if (hasProfile) {
    if (profile!.display_name) lines.push(`\n- 学员名称：${profile!.display_name}`);
    if (profile!.life_theme) lines.push(`- 当前生活主题：${profile!.life_theme}`);
  }

  // 2. Expression profile (strengths/weaknesses/patterns from aggregated training data)
  if (hasExprProfile) {
    const ep = expressionProfile!;
    const strengths = ep.strengths || {};
    const weaknesses = ep.weaknesses || {};
    const patterns = ep.patterns || {};

    if (Object.keys(strengths).length > 0) {
      lines.push(`\n### 历史表达优势`);
      for (const [dim, val] of Object.entries(strengths)) {
        lines.push(`- ${dim}：${typeof val === "number" ? `${val}分` : String(val).slice(0, 80)}`);
      }
    }

    if (Object.keys(weaknesses).length > 0) {
      lines.push(`\n### 历史薄弱领域（优先诊断）`);
      for (const [dim, val] of Object.entries(weaknesses)) {
        lines.push(`- ${dim}：${typeof val === "number" ? `${val}分` : String(val).slice(0, 80)}`);
      }
      lines.push(`→ 在本次诊断中，请优先检查以上薄弱领域是否有进步或仍然存在问题。`);
    }

    if (Object.keys(patterns).length > 0) {
      lines.push(`\n### 习惯性表达模式`);
      for (const [name, desc] of Object.entries(patterns)) {
        lines.push(`- ${name}：${String(desc).slice(0, 100)}`);
      }
      lines.push(`→ 如果本次表达中再次出现以上模式，请明确指出这是反复出现的习惯。`);
    }

    // Recent improvement history (last 3 entries)
    const history = ep.improvement_history || [];
    if (Array.isArray(history) && history.length > 0) {
      const recent = history.slice(-3);
      lines.push(`\n### 近期进步轨迹`);
      for (const entry of recent) {
        if (typeof entry === "object" && entry) {
          lines.push(`- ${JSON.stringify(entry).slice(0, 120)}`);
        }
      }
      lines.push(`→ 在反馈中肯定学员已取得的进步，不要从零开始评价。`);
    }
  }

  // 3. Expression assets (what the user has saved in their library)
  if (hasAssets) {
    const as = assetSummary!;
    const typeBreakdown = Object.entries(as.byType)
      .map(([t, c]) => `${ASSET_TYPE_LABELS[t] || t}x${c}`)
      .join("、");
    lines.push(`\n### 表达素材库`);
    lines.push(`- 已保存素材：${as.total} 条（${typeBreakdown}）`);
    if (as.recentTitles.length > 0) {
      lines.push(`- 最近素材：${as.recentTitles.slice(0, 3).join(" / ")}`);
    }
    lines.push(`→ 如果本次话题与学员已有素材相关，可以提醒调用已保存的素材。`);
  }

  // 4. Memory-derived insights (expression-relevant only)
  if (hasMemories) {
    lines.push(`\n### 来自长期记忆的表达相关洞察`);
    for (const m of expressionMemories.slice(0, 5)) {
      lines.push(`- [${m.memory_type}] ${m.content}`);
    }
  }

  lines.push(
    `\n━━━━━━━━━━━━━━━━━━━━`,
    `个性化教练指令（不展示给用户）：`,
    `- 评分标准不变。以上信息用于个性化反馈的语气、重点和建议方向。`,
    `- 如果学员在历史薄弱领域表现出进步，明确指出这个进步（如："相比之前，你这次的论证链条完整了很多"）`,
    `- 如果学员反复出现同一种问题模式，明确指出并关联历史（如："和上次一样，你的开头仍然在铺垫背景而不是直接亮观点"）`,
    `- 鼓励方式应匹配学员的性格特点和长期偏好`,
    `- 不要直接告诉学员"根据你的历史数据"，而是自然地融入反馈中`,
  );

  return lines.join("\n");
}

// ── 10. Profile-to-Text Builder ──

/**
 * Build a human-readable profile summary string for AI system prompts.
 * Reads from UserProfileRow (DB profiles table) — NOT from auth metadata.
 */
export function buildProfileSummary(profile: UserProfileRow | null): string {
  if (!profile) return "";

  const parts: string[] = [];

  if (profile.display_name) parts.push(`名称: ${profile.display_name}`);
  if (profile.bio) parts.push(`简介: ${profile.bio}`);
  if (profile.career_field) parts.push(`职业领域: ${profile.career_field}`);
  if (profile.industry) parts.push(`行业: ${profile.industry}`);
  if (profile.life_theme) parts.push(`生活主题: ${profile.life_theme}`);
  if (profile.current_milestone) parts.push(`当前阶段: ${profile.current_milestone}`);
  if (profile.preferences && Object.keys(profile.preferences).length > 0) {
    parts.push(`偏好设置: ${JSON.stringify(profile.preferences)}`);
  }

  if (parts.length === 0) return "";

  return `## 用户档案\n${parts.map((p) => `- ${p}`).join("\n")}`;
}

// ── 11. Nancy Personal Intelligence Profile ──

/**
 * Unified personal profile aggregating all four data sources:
 * profiles + expression_profiles + expression_assets + ai_memories
 *
 * Designed as the single entry point for AI agents to understand
 * WHO Nancy is — identity, direction, strengths, style, and goals.
 *
 * No new tables. No writes. Graceful degradation for new users.
 */
export interface NancyPersonalProfile {
  /** Basic identity — who Nancy is */
  identity: {
    display_name: string;
    life_theme: string;
    bio_summary: string;
    career_field: string;
    industry: string;
    current_milestone: string;
  };

  /** Career direction inferred from profile + memories */
  career_direction: string;

  /** Current active goals inferred from milestone + preferences + memories */
  current_goals: string[];

  /** Aggregated strengths from expression_profiles + skill memories + asset skills */
  strengths: string[];

  /** Aggregated weaknesses from expression_profiles */
  weaknesses: string[];

  /** Top expression assets by quality (compact — just title + type + quality) */
  valuable_assets: Array<{
    title: string;
    asset_type: string;
    quality_score: number;
  }>;

  /** Learning patterns from expression_profiles + habit memories */
  learning_patterns: string[];

  /** Communication style derived from personality/preference memories + expression patterns */
  communication_style: string;

  /** Whether any real data was found (false = pure defaults = new user) */
  has_real_data: boolean;
}

/**
 * Aggregate all four data sources into a unified Nancy personal profile.
 *
 * Data sources:
 * 1. profiles → identity, career_direction, current_goals
 * 2. expression_profiles → strengths, weaknesses, learning_patterns
 * 3. expression_assets → valuable_assets, strengths (from key_skills)
 * 4. ai_memories → communication_style, career_direction, current_goals, learning_patterns
 *
 * Graceful: works with zero data (new users). Returns has_real_data: false in that case.
 */
export async function getNancyPersonalProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<NancyPersonalProfile> {
  // Fetch all 4 sources in parallel
  const [
    profileResult,
    exprProfileResult,
    assetsResult,
    memoriesResult,
  ] = await Promise.allSettled([
    supabase.from("profiles").select("*").eq("id", userId).limit(1).single(),
    supabase.from("expression_profiles").select("*").eq("user_id", userId).limit(1).single(),
    supabase.from("expression_assets")
      .select("id,title,asset_type,tags,quality_score,asset_data")
      .eq("user_id", userId).eq("status", "active")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("ai_memories")
      .select("memory_type,content,confidence,status")
      .eq("user_id", userId).eq("is_active", true)
      .in("status", ["confirmed", "probable"])
      .order("confidence", { ascending: false }).limit(30),
  ]);

  const profile = profileResult.status === "fulfilled" ? (profileResult.value.data as UserProfileRow | null) : null;
  const exprProfile = exprProfileResult.status === "fulfilled" ? (exprProfileResult.value.data as ExpressionProfileRow | null) : null;
  const assets = assetsResult.status === "fulfilled" ? ((assetsResult.value.data || []) as Array<Record<string, unknown>>) : [];
  const memories = memoriesResult.status === "fulfilled" ? ((memoriesResult.value.data || []) as Array<Record<string, unknown>>) : [];

  const hasRealData = !!(profile || exprProfile || assets.length > 0 || memories.length > 0);

  // ── 1. Identity ──
  const identity = {
    display_name: profile?.display_name || "",
    life_theme: profile?.life_theme || "",
    bio_summary: profile?.bio || "",
    career_field: profile?.career_field || "",
    industry: profile?.industry || "",
    current_milestone: profile?.current_milestone || "",
  };

  // ── 2. Career direction ──
  const careerMemories = memories
    .filter((m) => m.memory_type === "insight" || m.memory_type === "skill")
    .filter((m) => /职业|工作|行业|career|方向|发展|专业/.test(String(m.content)))
    .map((m) => String(m.content));
  const careerParts: string[] = [];
  if (identity.career_field) careerParts.push(identity.career_field);
  if (identity.industry) careerParts.push(`(${identity.industry}行业)`);
  if (careerMemories.length > 0) careerParts.push(careerMemories[0]);
  const career_direction = careerParts.length > 0
    ? careerParts.join(" ")
    : "尚未明确职业方向";

  // ── 3. Current goals ──
  const goals: string[] = [];
  if (identity.current_milestone) goals.push(identity.current_milestone);
  if (identity.life_theme) goals.push(`生活主题：${identity.life_theme}`);
  const goalMemories = memories
    .filter((m) => /目标|计划|想|希望|goal|milestone|aspire/i.test(String(m.content)))
    .slice(0, 3)
    .map((m) => String(m.content));
  goals.push(...goalMemories);
  if (profile?.preferences && typeof profile.preferences === "object") {
    const prefs = profile.preferences as Record<string, unknown>;
    if (prefs.focus_area) goals.push(`专注领域：${prefs.focus_area}`);
    if (prefs.learning_goal) goals.push(`学习目标：${prefs.learning_goal}`);
  }

  // ── 4. Strengths ──
  const strengths: string[] = [];
  if (exprProfile?.strengths && typeof exprProfile.strengths === "object") {
    const s = exprProfile.strengths as Record<string, unknown>;
    for (const [dim, val] of Object.entries(s)) {
      const score = typeof val === "number" ? val : 0;
      if (score >= 70) strengths.push(`${dim}（${score}分）`);
    }
  }
  // Add skill-type memories with high confidence
  const skillStrengths = memories
    .filter((m) => m.memory_type === "skill" && (m.confidence as number) >= 0.7)
    .map((m) => String(m.content));
  strengths.push(...skillStrengths.slice(0, 5));
  // Add top skills from assets
  const assetSkills = new Map<string, number>();
  for (const a of assets) {
    const tags = (a.tags || []) as string[];
    for (const t of tags) {
      if (t.length > 1) assetSkills.set(t, (assetSkills.get(t) || 0) + 1);
    }
  }
  const topAssetSkills = [...assetSkills.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([skill, count]) => `${skill}（${count}条素材）`);
  strengths.push(...topAssetSkills);

  // ── 5. Weaknesses ──
  const weaknesses: string[] = [];
  if (exprProfile?.weaknesses && typeof exprProfile.weaknesses === "object") {
    const w = exprProfile.weaknesses as Record<string, unknown>;
    for (const [dim, val] of Object.entries(w)) {
      const score = typeof val === "number" ? val : 0;
      const label = score < 50 ? `${dim}（${score}分 — 薄弱）` : `${dim}（${score}分 — 待提升）`;
      weaknesses.push(label);
    }
  }

  // ── 6. Valuable assets ──
  const valuable_assets = assets
    .map((a) => {
      const qs = (a.quality_score || {}) as Record<string, number>;
      const reusability = qs.reusability || 0;
      return {
        title: String(a.title || ""),
        asset_type: String(a.asset_type || ""),
        quality_score: reusability,
      };
    })
    .filter((a) => a.title)
    .sort((a, b) => b.quality_score - a.quality_score)
    .slice(0, 8);

  // ── 7. Learning patterns ──
  const learning_patterns: string[] = [];
  if (exprProfile?.patterns && typeof exprProfile.patterns === "object") {
    const p = exprProfile.patterns as Record<string, unknown>;
    if (p.preferred_types) {
      const pt = p.preferred_types as Record<string, number>;
      const top = Object.entries(pt).sort(([, a], [, b]) => b - a).slice(0, 3);
      learning_patterns.push(`偏好表达类型：${top.map(([t, c]) => `${t}(${c}次)`).join("、")}`);
    }
    if (typeof p.total_sessions === "number") {
      learning_patterns.push(`累计训练${p.total_sessions}次`);
    }
    if (typeof p.avg_score === "number") {
      learning_patterns.push(`平均得分${p.avg_score}分`);
    }
  }
  const habitPatterns = memories
    .filter((m) => m.memory_type === "habit")
    .slice(0, 3)
    .map((m) => String(m.content));
  learning_patterns.push(...habitPatterns);

  // ── 8. Communication style ──
  const personalityMemories = memories
    .filter((m) => m.memory_type === "personality")
    .slice(0, 5)
    .map((m) => String(m.content));
  const preferenceMemories = memories
    .filter((m) => m.memory_type === "preference")
    .filter((m) => /沟通|表达|交流|说话|写作|演讲|communication|speaking/i.test(String(m.content)))
    .slice(0, 3)
    .map((m) => String(m.content));
  const styleClues: string[] = [...personalityMemories, ...preferenceMemories];
  const communication_style = styleClues.length > 0
    ? styleClues.join("；")
    : "尚未建立沟通风格画像";

  return {
    identity,
    career_direction,
    current_goals: goals.length > 0 ? goals : ["尚未明确当前目标"],
    strengths: strengths.length > 0 ? strengths : ["尚未积累足够的优势数据"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["尚未识别明确的薄弱领域"],
    valuable_assets,
    learning_patterns: learning_patterns.length > 0 ? learning_patterns : ["尚未形成明确的学习模式"],
    communication_style,
    has_real_data: hasRealData && (memories.length > 0 || assets.length > 0 || !!exprProfile),
  };
}

/**
 * Build a compact AI system prompt from a NancyPersonalProfile.
 *
 * Designed to be injected as a high-priority system message so the AI
 * understands WHO it's helping — not just the task at hand.
 *
 * Compact: ~300-500 chars of text, suitable for token budgets.
 */
export function buildNancyPersonalProfileContext(profile: NancyPersonalProfile): string {
  if (!profile.has_real_data) {
    return `## 用户画像（新用户 — 数据不足）

这是一位新用户，尚未积累足够的个人数据。请：
- 基于通用建议给出指导，同时鼓励用户多使用产品来积累个人画像
- 不要编造用户的个人信息、经历或偏好
- 在适当的时候，可以提问来了解用户（如："你平时更喜欢结构化表达还是自由发挥？"）`;
  }

  const lines: string[] = [];
  lines.push("## Nancy 个人智能画像（统一上下文）");
  lines.push("以下是你正在帮助的用户画像。所有建议和反馈必须基于这些真实信息，不得编造。");
  lines.push("");

  // Identity block
  const id = profile.identity;
  if (id.display_name || id.life_theme) {
    lines.push("### 身份画像");
    if (id.display_name) lines.push(`- 名称：${id.display_name}`);
    if (id.life_theme) lines.push(`- 生活主题：${id.life_theme}`);
    if (id.career_field) lines.push(`- 职业领域：${id.career_field}`);
    if (id.industry) lines.push(`- 行业：${id.industry}`);
    if (id.current_milestone) lines.push(`- 当前阶段：${id.current_milestone}`);
    if (id.bio_summary) lines.push(`- 简介：${id.bio_summary.slice(0, 150)}`);
    lines.push("");
  }

  // Career + goals
  if (profile.career_direction !== "尚未明确职业方向" || profile.current_goals[0] !== "尚未明确当前目标") {
    lines.push("### 职业方向与目标");
    if (profile.career_direction !== "尚未明确职业方向") {
      lines.push(`- 职业方向：${profile.career_direction}`);
    }
    for (const g of profile.current_goals.slice(0, 5)) {
      lines.push(`- 目标：${g}`);
    }
    lines.push("");
  }

  // Strengths
  if (profile.strengths[0] !== "尚未积累足够的优势数据") {
    lines.push("### 优势与特长");
    for (const s of profile.strengths.slice(0, 8)) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  // Weaknesses
  if (profile.weaknesses[0] !== "尚未识别明确的薄弱领域") {
    lines.push("### 薄弱领域（需关注）");
    for (const w of profile.weaknesses.slice(0, 5)) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  // Valuable assets
  if (profile.valuable_assets.length > 0) {
    lines.push("### 核心表达资产（禁止编造经历，只能使用以下真实资产）");
    for (const a of profile.valuable_assets.slice(0, 5)) {
      lines.push(`- [${a.asset_type}] ${a.title}（可复用性：${a.quality_score}）`);
    }
    lines.push("");
  }

  // Communication style
  if (profile.communication_style !== "尚未建立沟通风格画像") {
    lines.push("### 沟通风格");
    lines.push(`- ${profile.communication_style}`);
    lines.push("");
  }

  // Learning patterns
  if (profile.learning_patterns[0] !== "尚未形成明确的学习模式") {
    lines.push("### 学习模式");
    for (const p of profile.learning_patterns.slice(0, 5)) {
      lines.push(`- ${p}`);
    }
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━");
  lines.push("使用规则：");
  lines.push("- 以上所有信息均来自用户真实数据，请在回答中自然地融入（不要逐条复述）");
  lines.push("- 禁止编造用户的经历、技能或偏好。如不确定，就如实说");
  lines.push("- 当用户的行为与画像出现明显矛盾时，以当前行为为准，画像可能过时");
  lines.push("- 如果用户提到画像中未覆盖的新信息，可以在回答中顺势提问以丰富画像");

  return lines.join("\n");
}
