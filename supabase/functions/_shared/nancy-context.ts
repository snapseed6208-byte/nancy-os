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
 * Read user profile from the `profiles` table.
 *
 * NOTE: Currently zero Edge Functions read this table.
 * Settings.tsx writes to auth.users.user_metadata instead.
 * This function adds the capability to read the DB profiles table.
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
