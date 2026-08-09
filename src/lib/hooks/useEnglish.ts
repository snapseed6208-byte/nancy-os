import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";
import type { ExpressionStatus } from "@/lib/types";
import {
  scheduleExpressionReview,
  isDue,
  isMastered,
  type ReviewRating,
  type ReviewMode,
  type ExpressionSrsFields,
} from "@/lib/srs/expressionSrs";

// ── Helpers ──

function today() {
  return new Date().toISOString().split("T")[0];
}

function nowISO() {
  return new Date().toISOString();
}

// ── Expression CRUD ──

export type ExpressionFilters = {
  type?: string;
  status?: string;
  scene?: string;
  search?: string;
  topic?: string;
  category_id?: string;
  page?: number;
  pageSize?: number;
};

async function fetchExpressions(filters: ExpressionFilters) {
  const userId = await getUserId();
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("expressions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.scene) query = query.eq("scene", filters.scene);
  if (filters.topic) query = query.eq("topic", filters.topic);
  if (filters.category_id) query = query.eq("category_id", filters.category_id);
  if (filters.search) query = query.or(`english.ilike.%${filters.search}%,chinese.ilike.%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count: count ?? 0 };
}

export function useExpressions(filters: ExpressionFilters = {}) {
  return useQuery({
    queryKey: ["expressions", filters],
    queryFn: () => fetchExpressions(filters),
  });
}

async function fetchExpression(id: string) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("expressions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

export function useExpression(id: string | undefined) {
  return useQuery({
    queryKey: ["expression", id],
    queryFn: () => fetchExpression(id!),
    enabled: !!id,
  });
}

// ── Auto-categorization ──

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "生活": ["daily life", "daily", "life", "日常", "生活", "home", "family", "food", "cooking", "shopping", "health", "fitness", "housing", "rent", "租房", "家务", "housework", "起居", "作息", "饮食", "起居", "睡眠", "锻炼", "grocery", "recipe", "nutrition"],
  "工作": ["work", "office", "job", "career", "工作", "职场", "internship", "实习", "meeting", "会议", "deadline", "截止", "升职", "promotion", "colleague", "同事", "boss", "老板", "salary", "工资", "辞职", "resign", "interview", "面试"],
  "社交": ["social", "friends", "relationship", "社交", "朋友", "人际", "dating", "约会", "聚会", "party", "network", "人脉", "gathering", "small talk", "greeting", "问候", "介绍", "introduction"],
  "情绪": ["emotions", "feelings", "mood", "情绪", "心理", "emotional", "stress", "压力", "anxiety", "焦虑", "happiness", "sadness", "anger", "生气", "失望", "disappointment", "excited", "nervous"],
  "旅行": ["travel", "traveling", "旅行", "旅游", "transport", "hotel", "commuting", "交通", "出行", "机场", "airport", "酒店", "订票", "ticket", "flight", "航班", "行李", "luggage", "passport", "visa"],
  "学习": ["study", "academic", "IELTS", "学习", "学术", "exam", "考试", "university", "大学", "course", "课程", "research", "论文", "library", "图书馆", "TOEFL", "GRE", "campus", "校园", "professor", "教授", "作业", "assignment"],
  "商务": ["business", "meeting", "商务", "商业", "negotiation", "presentation", "finance", "金融", "marketing", "市场", "contract", "合同", "investment", "投资", "revenue", "profit", "strategy", "client", "客户", "deal", "交易"],
  "影视": ["movie", "film", "TV", "影视", "电影", "entertainment", "music", "音乐", "show", "drama", "剧集", "综艺", "actor", "演员", "director", "导演", "plot", "剧情", "review", "影评"],
};

function categorizeExpression(expr: {
  topic?: string | null;
  scene?: string | null;
  english?: string;
  chinese?: string;
  type?: string;
}): string | null {
  const scores: Record<string, number> = {};

  const sceneLower = (expr.scene || "").toLowerCase();
  const topicLower = (expr.topic || "").toLowerCase();
  const textLower = `${expr.english || ""} ${expr.chinese || ""}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    const catLower = category.toLowerCase();
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (sceneLower.includes(kwLower)) score += 3;
      if (topicLower.includes(kwLower)) score += 2;
      if (textLower.includes(kwLower)) score += 1;
      if (catLower.includes(kwLower) || kwLower.includes(catLower)) score += 2;
    }
    if (score > 0) scores[category] = score;
  }

  if (Object.keys(scores).length === 0) return null;
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

async function resolveCategoryId(categoryName: string | null): Promise<string | null> {
  if (!categoryName) return null;
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("scope", "expression")
    .eq("name", categoryName)
    .maybeSingle();
  return data?.id || null;
}

export function useCreateExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const userId = await getUserId();

      // Auto-categorize if no category_id provided
      let categoryId = input.category_id as string | null | undefined;
      if (!categoryId) {
        const catName = categorizeExpression({
          topic: input.topic as string | undefined,
          scene: input.scene as string | undefined,
          english: input.english as string,
          chinese: input.chinese as string,
          type: input.type as string,
        });
        categoryId = await resolveCategoryId(catName);
      }

      const { data, error } = await supabase
        .from("expressions")
        .insert({ ...input, category_id: categoryId || null, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

export function useUpdateExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("expressions")
        .update({ ...input })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["expression", (variables as Record<string, unknown>).id] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

export function useArchiveExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expressions")
        .update({ archived: true, updated_at: nowISO() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["expression", id] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

export function useRestoreExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("expressions")
        .update({ archived: false, updated_at: nowISO() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["expression", id] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

export function useBatchUpdateExpressions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: string[];
      updates: Record<string, unknown>;
    }) => {
      const { error } = await supabase
        .from("expressions")
        .update({ ...updates, updated_at: nowISO() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

export function useDeleteExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expressions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["expression", id] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

// ── SRS Review ──

async function fetchDueExpressions() {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("expressions")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .in("status", ["review", "mastered"])
    .lte("next_review_date", nowISO())
    .order("next_review_date", { ascending: true, nullsFirst: true })
    .limit(200);

  if (error) throw error;
  return data;
}

export function useDueExpressions() {
  return useQuery({
    queryKey: ["expressions", "due"],
    queryFn: fetchDueExpressions,
  });
}

// ── Daily Review Queue ──

const DEFAULT_DAILY_TARGET = 15;
const MAX_DAILY_CARDS = 50;

export type DailyReviewQueue = {
  cards: Record<string, unknown>[];
  totalDue: number;
  todayTarget: number;
  todayRemaining: number;
  isOverloaded: boolean;
};

async function fetchDailyReviewQueue(): Promise<DailyReviewQueue> {
  const userId = await getUserId();
  const todayStr = new Date().toISOString().split("T")[0];

  // Count how many reviews done today
  const { count: todayDone, error: countErr } = await supabase
    .from("expression_reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("reviewed_at", `${todayStr}T00:00:00Z`)
    .lte("reviewed_at", `${todayStr}T23:59:59Z`);

  if (countErr) throw countErr;

  const todayRemaining = Math.max(0, DEFAULT_DAILY_TARGET - (todayDone ?? 0));

  // Get all due cards (non-mastered, non-archived)
  const { data: allDue, error: dueErr } = await supabase
    .from("expressions")
    .select("id")
    .eq("user_id", userId)
    .eq("archived", false)
    .in("status", ["review", "mastered"])
    .lte("next_review_date", nowISO())
    .order("next_review_date", { ascending: true, nullsFirst: true });

  if (dueErr) throw dueErr;

  const totalDue = allDue?.length ?? 0;
  const isOverloaded = totalDue > MAX_DAILY_CARDS;

  // Fetch the cards: up to todayRemaining, capped at MAX_DAILY_CARDS
  const limit = Math.min(todayRemaining, MAX_DAILY_CARDS);
  const { data: cards, error: cardsErr } = await supabase
    .from("expressions")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .in("status", ["review", "mastered"])
    .lte("next_review_date", nowISO())
    .order("next_review_date", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (cardsErr) throw cardsErr;

  return {
    cards: cards || [],
    totalDue,
    todayTarget: DEFAULT_DAILY_TARGET,
    todayRemaining,
    isOverloaded,
  };
}

export function useDailyReviewQueue() {
  return useQuery({
    queryKey: ["expressions", "daily_queue"],
    queryFn: fetchDailyReviewQueue,
    staleTime: 30_000,
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      expressionId,
      rating,
      reviewMode,
      productionSuccess,
    }: {
      expressionId: string;
      rating: ReviewRating;
      reviewMode?: ReviewMode;
      productionSuccess?: boolean;
    }) => {
      const now = nowISO();

      // Fetch current SRS state
      const { data: expr, error: fetchErr } = await supabase
        .from("expressions")
        .select("ease_factor, repetitions, interval_days, lapse_count, production_count, next_review_date, status")
        .eq("id", expressionId)
        .single();

      if (fetchErr) throw fetchErr;

      const current: ExpressionSrsFields = {
        ease_factor: (expr as Record<string, unknown>).ease_factor as number ?? 2.5,
        repetitions: (expr as Record<string, unknown>).repetitions as number ?? 0,
        interval_days: (expr as Record<string, unknown>).interval_days as number ?? 0,
        lapse_count: (expr as Record<string, unknown>).lapse_count as number ?? 0,
        production_count: (expr as Record<string, unknown>).production_count as number ?? 0,
        status: (expr as Record<string, unknown>).status as string ?? "learning",
        next_review_date: (expr as Record<string, unknown>).next_review_date as string | null,
      };

      const schedule = scheduleExpressionReview(rating, current);

      const newProductionCount = productionSuccess
        ? current.production_count + 1
        : current.production_count;

      const { error: exprError } = await supabase
        .from("expressions")
        .update({
          next_review_date: schedule.next_review_date,
          status: schedule.status,
          mastery_level: Math.min(schedule.repetitions, 5).toString(),
          streak: rating === "again" ? 0 : ((expr as Record<string, unknown>).streak as number || 0) + 1,
          review_count: ((expr as Record<string, unknown>).review_count as number || 0) + 1,
          last_review_result: rating,
          ease_factor: schedule.ease_factor,
          repetitions: schedule.repetitions,
          interval_days: schedule.interval_days,
          lapse_count: schedule.lapse_count,
          production_count: newProductionCount,
          last_reviewed_at: now,
        })
        .eq("id", expressionId);

      if (exprError) throw exprError;

      const userId = await getUserId();
      const { error: revError } = await supabase.from("expression_reviews").insert({
        expression_id: expressionId,
        result: rating,
        previous_interval: current.interval_days,
        new_interval: schedule.interval_days,
        reviewed_at: now,
        user_id: userId,
        review_mode: reviewMode || null,
        production_success: productionSuccess ?? null,
      });

      if (revError) throw revError;

      return schedule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

// ── Speaking ──

async function fetchSpeakingSessions() {
  const { data, error } = await supabase
    .from("speaking_sessions")
    .select("*, speaking_attempts(fluency_score, grammar_score, vocabulary_score, naturalness_score, audio_duration, expressions_used, expressions_missed, reference_answer, audio_url, created_at, is_retry, attempt_round)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

export function useSpeakingSessions() {
  return useQuery({
    queryKey: ["speaking_sessions"],
    queryFn: fetchSpeakingSessions,
  });
}

async function fetchSpeakingSession(id: string) {
  const { data: session, error } = await supabase
    .from("speaking_sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  const { data: attempts, error: attError } = await supabase
    .from("speaking_attempts")
    .select("*")
    .eq("session_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (attError) throw attError;

  return { ...session, attempts };
}

export function useSpeakingSession(id: string | undefined) {
  return useQuery({
    queryKey: ["speaking_session", id],
    queryFn: () => fetchSpeakingSession(id!),
    enabled: !!id,
  });
}

export function useCreateSpeakingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      prompt: string;
      context?: string;
      expression_ids?: string;
      category?: string;
      mode?: string;
      recommended_expressions?: Record<string, unknown>[];
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("speaking_sessions")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_sessions"] }),
  });
}

export function useCreateSpeakingAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("speaking_attempts")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["speaking_sessions"] });
      qc.invalidateQueries({ queryKey: ["speaking_stats"] });
      if (variables.session_id) {
        qc.invalidateQueries({ queryKey: ["speaking_session", variables.session_id] });
      }
    },
  });
}

export function useUpdateSpeakingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      title?: string;
      learningNotes?: string;
      isTest?: boolean;
    }) => {
      const updates: Record<string, unknown> = {
        updated_at: nowISO(),
      };
      if (input.title !== undefined) updates.title = input.title;
      if (input.learningNotes !== undefined) updates.learning_notes = input.learningNotes;
      if (input.isTest !== undefined) updates.is_test = input.isTest;

      const { data, error } = await supabase
        .from("speaking_sessions")
        .update(updates)
        .eq("id", input.sessionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["speaking_sessions"] });
      qc.invalidateQueries({ queryKey: ["speaking_stats"] });
      qc.invalidateQueries({ queryKey: ["speaking_session", variables.sessionId] });
    },
  });
}

export function useSoftDeleteSpeakingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const ts = nowISO();

      // Soft-delete child attempts first
      const { error: attError } = await supabase
        .from("speaking_attempts")
        .update({ deleted_at: ts })
        .eq("session_id", sessionId);

      if (attError) throw attError;

      // Soft-delete the session
      const { data, error } = await supabase
        .from("speaking_sessions")
        .update({ deleted_at: ts, updated_at: ts })
        .eq("id", sessionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["speaking_sessions"] });
      qc.invalidateQueries({ queryKey: ["speaking_stats"] });
    },
  });
}

// ── Upload audio ──

export async function uploadAudio(sessionId: string, blob: Blob): Promise<string> {
  const fileName = `${sessionId}/${Date.now()}.webm`;
  console.log("[uploadAudio] Uploading:", { fileName, blobSize: blob.size, blobType: blob.type });

  const { data, error } = await supabase.storage
    .from("speaking-audio")
    .upload(fileName, blob, {
      contentType: blob.type || "audio/webm",
      upsert: false,
    });

  if (error) {
    console.error("[uploadAudio] Upload failed:", error);
    throw error;
  }

  console.log("[uploadAudio] Upload success:", { path: data?.path, id: data?.id });

  const { data: urlData } = supabase.storage.from("speaking-audio").getPublicUrl(fileName);
  console.log("[uploadAudio] Public URL:", urlData.publicUrl);
  return urlData.publicUrl;
}

// ── Dashboard Stats ──

async function fetchEnglishStats() {
  const userId = await getUserId();
  const now = nowISO();
  const todayStr = today();

  const [totalRes, dueRes, masteredRes, sessionsRes, recentReviewsRes] = await Promise.all([
    supabase.from("expressions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("archived", false),
    supabase
      .from("expressions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("archived", false)
      .in("status", ["review", "mastered"])
      .lte("next_review_date", now),
    supabase
      .from("expressions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("archived", false)
      .eq("status", "mastered"),
    supabase
      .from("speaking_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("expression_reviews")
      .select("id, result")
      .eq("user_id", userId)
      .gte("reviewed_at", `${todayStr}T00:00:00Z`)
      .lte("reviewed_at", `${todayStr}T23:59:59Z`),
  ]);

  const todayReviews = recentReviewsRes.data || [];
  const todayReviewed = todayReviews.length;
  const todayGood = todayReviews.filter((r: { result: string }) => r.result === "good" || r.result === "easy").length;

  // Also count streak — days with at least 1 review in the past 30 days
  const { data: recentDays } = await supabase
    .from("expression_reviews")
    .select("reviewed_at")
    .eq("user_id", userId)
    .gte("reviewed_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .order("reviewed_at", { ascending: false });

  const reviewDays = new Set((recentDays || []).map((r: { reviewed_at: string }) => r.reviewed_at.split("T")[0]));
  const currentStreak = (() => {
    let streak = 0;
    const d = new Date(todayStr + "T00:00:00");
    while (true) {
      const ds = d.toISOString().split("T")[0];
      if (reviewDays.has(ds)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  })();

  return {
    total: totalRes.count ?? 0,
    due: dueRes.count ?? 0,
    mastered: masteredRes.count ?? 0,
    totalSessions: sessionsRes.count ?? 0,
    todayReviewed,
    todayGood,
    reviewStreak: currentStreak,
  };
}

export function useEnglishStats() {
  return useQuery({
    queryKey: ["english_stats"],
    queryFn: fetchEnglishStats,
  });
}

// ── Expression Import ──

export type ParsedExpression = {
  english: string;
  chinese: string;
  type: string;
  pronunciation?: string;
  example_sentence?: string;
  scene?: string;
  topic?: string;
  difficulty_level?: string;
  usefulness_level?: number;
  usage_note?: string;
  memory_tip?: string;
  common_mistakes?: string;
  context?: string;
  common_patterns?: string;
};

export type ImportResult = {
  expressions: ParsedExpression[];
  stats: {
    total: number;
    vocabulary: number;
    chunk: number;
    sentencePattern: number;
    speakingExpression: number;
  };
  tokens_used: number;
  import_batch_id?: string;
};

export function useParseFile() {
  return useMutation({
    mutationFn: async (input: { file: string; mime_type: string }) => {
      const result = await invokeAI("file-parser-agent", { file: input.file, mime_type: input.mime_type });
      if (!result.success) throw new Error(result.error);
      return result.data as { text: string; char_count: number; warning?: string };
    },
  });
}

export function useExtractExpressions() {
  return useMutation({
    mutationFn: async (input: { text: string }): Promise<ImportResult> => {
      const result = await invokeAI<ImportResult>("expression-import-agent", { text: input.text });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useBatchImportExpressions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expressions: ParsedExpression[];
      source_type: string;
      source_name?: string;
    }): Promise<string> => {
      const userId = await getUserId();

      // 1. Create import batch record
      const { data: batch, error: batchErr } = await supabase
        .from("expression_imports")
        .insert({
          user_id: userId,
          source_type: input.source_type,
          source_name: input.source_name || null,
          status: "imported",
          stats: { total_extracted: input.expressions.length, imported: input.expressions.length, skipped: 0 },
        })
        .select("id")
        .single();

      if (batchErr) throw batchErr;

      // 2. Batch insert expressions with auto-categorization
      // Pre-fetch categories for ID lookup
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .eq("scope", "expression");
      const catMap = new Map((cats || []).map((c: { id: string; name: string }) => [c.name, c.id]));

      const rows = input.expressions.map((expr) => {
        const catName = categorizeExpression({
          topic: expr.topic,
          scene: expr.scene,
          english: expr.english,
          chinese: expr.chinese,
          type: expr.type,
        });
        return {
          user_id: userId,
          english: expr.english,
          chinese: expr.chinese,
          type: expr.type,
          pronunciation: expr.pronunciation || null,
          example_sentence: expr.example_sentence || null,
          scene: expr.scene || null,
          topic: expr.topic || null,
          difficulty_level: expr.difficulty_level || "intermediate",
          usefulness_level: expr.usefulness_level || null,
          usage_note: expr.usage_note || null,
          memory_tip: expr.memory_tip || null,
          common_mistakes: expr.common_mistakes || null,
          context: expr.context || null,
          common_patterns: expr.common_patterns || null,
          category_id: catName ? (catMap.get(catName) || null) : null,
          status: "collected",
          ease_factor: 2.5,
          source: input.source_name || "import",
          import_batch_id: batch.id,
        };
      });

      const { error } = await supabase.from("expressions").insert(rows);
      if (error) throw error;

      return batch.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

// ── Expression Categories ──

async function fetchExpressionCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("scope", "expression")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as { id: string; name: string; icon: string | null; color: string | null }[];
}

export function useExpressionCategories() {
  return useQuery({
    queryKey: ["expression_categories"],
    queryFn: fetchExpressionCategories,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Re-categorization ──

export type RecategorizeResult = {
  total: number;
  categorized: number;
  errors: number;
  per_category: Record<string, number>;
  message?: string;
};

export function useRecategorize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RecategorizeResult> => {
      const { data, error } = await supabase.functions.invoke("expression-categorizer", {
        body: { mode: "re categorize" },
      });
      if (error) throw error;
      return data as RecategorizeResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
      qc.invalidateQueries({ queryKey: ["expression_categories"] });
      qc.invalidateQueries({ queryKey: ["english_stats"] });
    },
  });
}

// ── Speaking Stats ──

async function fetchSpeakingStats() {
  const userId = await getUserId();

  const [sessionsRes, attemptsRes, recentRes] = await Promise.all([
    supabase
      .from("speaking_sessions")
      .select("id, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("speaking_attempts")
      .select("fluency_score, grammar_score, vocabulary_score, naturalness_score, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("speaking_sessions")
      .select("id, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const sessions = sessionsRes.data || [];
  const attempts = attemptsRes.data || [];

  const totalSessions = sessions.length;
  const totalAttempts = attempts.length;

  const scores = attempts.filter(
    (a) => a.fluency_score || a.grammar_score || a.vocabulary_score || a.naturalness_score,
  );

  const avgScore = scores.length > 0
    ? scores.reduce((sum, a) => {
        const avg = ((a.fluency_score || 0) + (a.grammar_score || 0) + (a.vocabulary_score || 0) + (a.naturalness_score || 0)) / 4;
        return sum + avg;
      }, 0) / scores.length
    : 0;

  // Count unique practice days
  const practiceDays = new Set(
    sessions.map((s) => s.created_at.split("T")[0]),
  ).size;

  const lastSessionDate = recentRes.data?.[0]?.created_at || null;

  return {
    totalSessions,
    totalAttempts,
    avgScore: Math.round(avgScore * 10) / 10,
    practiceDays,
    lastSessionDate,
  };
}

export function useSpeakingStats() {
  return useQuery({
    queryKey: ["speaking_stats"],
    queryFn: fetchSpeakingStats,
  });
}

// ── Progress & Growth Data ──

export interface ProgressDataPoint {
  id: string;
  created_at: string;
  fluency_score: number | null;
  grammar_score: number | null;
  vocabulary_score: number | null;
  naturalness_score: number | null;
  audio_duration: number | null;
  session_prompt: string;
  session_category: string | null;
  session_mode: string | null;
}

async function fetchProgressData(days: number): Promise<ProgressDataPoint[]> {
  const userId = await getUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("speaking_attempts")
    .select(`
      id, created_at, fluency_score, grammar_score, vocabulary_score,
      naturalness_score, audio_duration,
      speaking_sessions!inner(prompt, category, mode)
    `)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((a: Record<string, unknown>) => {
    const session = a.speaking_sessions as Record<string, unknown> | undefined;
    return {
      id: a.id as string,
      created_at: a.created_at as string,
      fluency_score: a.fluency_score as number | null,
      grammar_score: a.grammar_score as number | null,
      vocabulary_score: a.vocabulary_score as number | null,
      naturalness_score: a.naturalness_score as number | null,
      audio_duration: a.audio_duration as number | null,
      session_prompt: (session?.prompt as string) || "",
      session_category: (session?.category as string) || null,
      session_mode: (session?.mode as string) || null,
    };
  });
}

export function useProgressData(days: number = 30) {
  return useQuery({
    queryKey: ["speaking_progress", days],
    queryFn: () => fetchProgressData(days),
  });
}

export interface FrequentError {
  original: string;
  correction: string;
  count: number;
}

async function fetchFrequentErrors(days: number): Promise<FrequentError[]> {
  const userId = await getUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("speaking_attempts")
    .select("useful_corrections")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", since.toISOString())
    .not("useful_corrections", "is", null);

  if (error) throw error;

  // Parse corrections and count occurrences
  const errorMap = new Map<string, { correction: string; count: number }>();
  for (const row of data || []) {
    const text = row.useful_corrections as string;
    if (!text) continue;
    // Parse lines like: - "original" → "better" (explanation)
    const matches = text.matchAll(/- "([^"]+)" → "([^"]+)"/g);
    for (const m of matches) {
      const original = m[1].trim();
      const correction = m[2].trim();
      const key = original.toLowerCase();
      const existing = errorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        errorMap.set(key, { correction, count: 1 });
      }
    }
  }

  return Array.from(errorMap.entries())
    .map(([key, val]) => ({
      original: key,
      correction: val.correction,
      count: val.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

export function useFrequentErrors(days: number = 30) {
  return useQuery({
    queryKey: ["frequent_errors", days],
    queryFn: () => fetchFrequentErrors(days),
  });
}

// ── Common Problems aggregation ──

async function fetchCommonProblems(days: number): Promise<string[]> {
  const userId = await getUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("speaking_attempts")
    .select("main_problems, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("created_at", since.toISOString())
    .not("main_problems", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return (data || []).map((r: Record<string, unknown>) => (r.main_problems as string) || "").filter(Boolean);
}

export function useCommonProblems(days: number = 30) {
  return useQuery({
    queryKey: ["common_problems", days],
    queryFn: () => fetchCommonProblems(days),
  });
}

// ── Speaking Question Bank V2 ──

export type SpeakingQuestion = {
  id: string;
  user_id: string;
  question: string;
  normalized_question: string;
  content_hash: string;
  mode: "ielts" | "daily" | "professional" | "personal_growth";
  topic: string;
  part: "part1" | "part2" | "part3" | null;
  context: string | null;
  cue_points: Record<string, unknown> | null;
  tags: string[];
  difficulty: string;
  source_type: string;
  source_ref: string | null;
  import_batch_id: string | null;
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SpeakingQuestionFilters = {
  mode?: string;
  topic?: string;
  part?: string;
  difficulty?: string;
  is_active?: boolean;
  search?: string;
  limit?: number;
};

async function fetchSpeakingQuestions(filters: SpeakingQuestionFilters = {}): Promise<SpeakingQuestion[]> {
  let query = supabase
    .from("speaking_questions")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.mode) query = query.eq("mode", filters.mode);
  if (filters.topic) query = query.eq("topic", filters.topic);
  if (filters.part) query = query.eq("part", filters.part);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.is_active !== undefined) query = query.eq("is_active", filters.is_active);
  if (filters.search) query = query.ilike("question", `%${filters.search}%`);
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SpeakingQuestion[];
}

export function useSpeakingQuestions(filters: SpeakingQuestionFilters = {}) {
  return useQuery({
    queryKey: ["speaking_questions", filters],
    queryFn: () => fetchSpeakingQuestions(filters),
  });
}

async function fetchSpeakingQuestion(id: string): Promise<SpeakingQuestion> {
  const { data, error } = await supabase
    .from("speaking_questions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as SpeakingQuestion;
}

export function useSpeakingQuestion(id: string | undefined) {
  return useQuery({
    queryKey: ["speaking_question", id],
    queryFn: () => fetchSpeakingQuestion(id!),
    enabled: !!id,
  });
}

export function useCreateSpeakingQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      question: string;
      mode: SpeakingQuestion["mode"];
      topic: string;
      part?: SpeakingQuestion["part"];
      context?: string;
      cue_points?: Record<string, unknown>;
      tags?: string[];
      difficulty?: string;
      source_type?: string;
      source_ref?: string;
      import_batch_id?: string;
    }) => {
      const userId = await getUserId();
      const normalized = input.question.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
      const contentHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized))
        .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));

      const { data, error } = await supabase
        .from("speaking_questions")
        .insert({
          ...input,
          user_id: userId,
          normalized_question: normalized,
          content_hash: contentHash,
        })
        .select()
        .single();
      if (error) throw error;
      return data as SpeakingQuestion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["speaking_questions"] });
    },
  });
}

export function useBulkCreateSpeakingQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      questions: Array<{
        question: string;
        mode: SpeakingQuestion["mode"];
        topic: string;
        part?: SpeakingQuestion["part"];
        context?: string;
        cue_points?: Record<string, unknown>;
        tags?: string[];
        difficulty?: string;
        source_type?: string;
        source_ref?: string;
      }>;
      import_batch_id?: string;
    }) => {
      const userId = await getUserId();

      // Create import batch if not provided
      let batchId = input.import_batch_id;
      if (!batchId) {
        const { data: batch, error: batchErr } = await supabase
          .from("speaking_import_batches")
          .insert({
            user_id: userId,
            source: "manual",
            total_count: input.questions.length,
            status: "in_progress",
          })
          .select("id")
          .single();
        if (batchErr) throw batchErr;
        batchId = batch.id;
      }

      // Build rows with content hashes
      const rows = await Promise.all(input.questions.map(async (q) => {
        const normalized = q.question.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
        const contentHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized))
          .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));
        return {
          ...q,
          user_id: userId,
          normalized_question: normalized,
          content_hash: contentHash,
          import_batch_id: batchId,
        };
      }));

      const { error } = await supabase.from("speaking_questions").insert(rows);
      if (error) throw error;

      // Update batch status
      await supabase
        .from("speaking_import_batches")
        .update({ imported_count: rows.length, status: "completed" })
        .eq("id", batchId);

      return { batch_id: batchId, count: rows.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["speaking_questions"] });
      qc.invalidateQueries({ queryKey: ["speaking_import_batches"] });
    },
  });
}

export type SpeakingQuestionHistoryEntry = {
  id: string;
  user_id: string;
  question_id: string;
  session_id: string | null;
  practiced_at: string;
  fluency_score: number | null;
  grammar_score: number | null;
  vocabulary_score: number | null;
  naturalness_score: number | null;
  created_at: string;
};

async function fetchSpeakingQuestionHistory(days: number): Promise<SpeakingQuestionHistoryEntry[]> {
  const userId = await getUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("speaking_question_history")
    .select("*")
    .eq("user_id", userId)
    .gte("practiced_at", since.toISOString())
    .order("practiced_at", { ascending: false });

  if (error) throw error;
  return (data || []) as SpeakingQuestionHistoryEntry[];
}

export function useSpeakingQuestionHistory(days: number = 30) {
  return useQuery({
    queryKey: ["speaking_question_history", days],
    queryFn: () => fetchSpeakingQuestionHistory(days),
  });
}

export function useRecordSpeakingQuestionUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      question_id: string;
      session_id?: string;
      fluency_score?: number;
      grammar_score?: number;
      vocabulary_score?: number;
      naturalness_score?: number;
    }) => {
      const userId = await getUserId();

      // Insert history record
      const { error: histErr } = await supabase
        .from("speaking_question_history")
        .insert({
          user_id: userId,
          question_id: input.question_id,
          session_id: input.session_id || null,
          fluency_score: input.fluency_score ?? null,
          grammar_score: input.grammar_score ?? null,
          vocabulary_score: input.vocabulary_score ?? null,
          naturalness_score: input.naturalness_score ?? null,
        });
      if (histErr) throw histErr;

      // Increment usage_count on the question via RPC
      const { error: updErr } = await supabase.rpc("increment_question_usage", {
        q_id: input.question_id,
      });
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["speaking_question_history"] });
      qc.invalidateQueries({ queryKey: ["speaking_questions"] });
      qc.invalidateQueries({ queryKey: ["speaking_stats"] });
    },
  });
}

// Add question_id support to create speaking session (preserves backward compat)
export function useCreateSpeakingSessionV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      prompt: string;
      context?: string;
      expression_ids?: string;
      category?: string;
      mode?: string;
      recommended_expressions?: Record<string, unknown>[];
      question_id?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("speaking_sessions")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_sessions"] }),
  });
}
