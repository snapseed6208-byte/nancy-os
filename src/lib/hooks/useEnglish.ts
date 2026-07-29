import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import type { ExpressionStatus } from "@/lib/types";

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
};

async function fetchExpressions(filters: ExpressionFilters) {
  let query = supabase
    .from("expressions")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.scene) query = query.eq("scene", filters.scene);
  if (filters.topic) query = query.eq("topic", filters.topic);
  if (filters.search) query = query.or(`english.ilike.%${filters.search}%,chinese.ilike.%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function useExpressions(filters: ExpressionFilters = {}) {
  return useQuery({
    queryKey: ["expressions", filters],
    queryFn: () => fetchExpressions(filters),
  });
}

async function fetchExpression(id: string) {
  const { data, error } = await supabase.from("expressions").select("*").eq("id", id).single();
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

export function useCreateExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from("expressions").insert({ ...input, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expressions"] }),
  });
}

export function useUpdateExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("expressions")
        .update({ ...input, updated_at: nowISO() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expressions"] }),
  });
}

export function useDeleteExpression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expressions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expressions"] }),
  });
}

// ── SRS Review ──

async function fetchDueExpressions() {
  const { data, error } = await supabase
    .from("expressions")
    .select("*")
    .eq("archived", false)
    .or(`next_review_date.is.null,next_review_date.lte.${nowISO()}`)
    .order("next_review_date", { ascending: true, nullsFirst: true })
    .limit(50);

  if (error) throw error;
  return data;
}

export function useDueExpressions() {
  return useQuery({
    queryKey: ["expressions", "due"],
    queryFn: fetchDueExpressions,
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      expressionId,
      result,
      previousInterval,
      newInterval,
      nextReviewDate,
      newStatus,
      masteryLevel,
      streak,
      reviewCount,
    }: {
      expressionId: string;
      result: string;
      previousInterval: number;
      newInterval: number;
      nextReviewDate: string;
      newStatus: ExpressionStatus;
      masteryLevel: number;
      streak: number;
      reviewCount: number;
    }) => {
      // 1. Update expression
      const { error: exprError } = await supabase
        .from("expressions")
        .update({
          next_review_date: nextReviewDate,
          status: newStatus,
          mastery_level: masteryLevel,
          streak,
          review_count: reviewCount,
          last_review_result: result,
          updated_at: nowISO(),
        })
        .eq("id", expressionId);

      if (exprError) throw exprError;

      // 2. Insert review record
      const userId = await getUserId();
      const { error: revError } = await supabase.from("expression_reviews").insert({
        expression_id: expressionId,
        result,
        previous_interval: previousInterval,
        new_interval: newInterval,
        reviewed_at: nowISO(),
        user_id: userId,
      });

      if (revError) throw revError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expressions"] });
    },
  });
}

// ── Speaking ──

async function fetchSpeakingSessions() {
  const { data, error } = await supabase
    .from("speaking_sessions")
    .select("*")
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
    mutationFn: async (input: { prompt: string; context?: string; expression_ids?: string }) => {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaking_sessions"] }),
  });
}

// ── Upload audio ──

export async function uploadAudio(sessionId: string, blob: Blob): Promise<string> {
  const fileName = `${sessionId}/${Date.now()}.webm`;
  const { error } = await supabase.storage.from("speaking-audio").upload(fileName, blob);
  if (error) throw error;

  const { data } = supabase.storage.from("speaking-audio").getPublicUrl(fileName);
  return data.publicUrl;
}

// ── Dashboard Stats ──

async function fetchEnglishStats() {
  const now = nowISO();
  const todayStr = today();

  const [totalRes, dueRes, masteredRes, sessionsRes, recentReviewsRes] = await Promise.all([
    supabase.from("expressions").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase
      .from("expressions")
      .select("id", { count: "exact", head: true })
      .eq("archived", false)
      .or(`next_review_date.is.null,next_review_date.lte.${now}`),
    supabase
      .from("expressions")
      .select("id", { count: "exact", head: true })
      .eq("archived", false)
      .eq("status", "mastered"),
    supabase
      .from("speaking_sessions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("expression_reviews")
      .select("id, result")
      .gte("reviewed_at", `${todayStr}T00:00:00Z`)
      .lte("reviewed_at", `${todayStr}T23:59:59Z`),
  ]);

  const todayReviews = recentReviewsRes.data || [];
  const todayReviewed = todayReviews.length;
  const todayGood = todayReviews.filter((r: { result: string }) => r.result === "good" || r.result === "easy").length;

  return {
    total: totalRes.count ?? 0,
    due: dueRes.count ?? 0,
    mastered: masteredRes.count ?? 0,
    totalSessions: sessionsRes.count ?? 0,
    todayReviewed,
    todayGood,
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
      const { data, error } = await supabase.functions.invoke("file-parser-agent", {
        body: { file: input.file, mime_type: input.mime_type },
      });
      if (error) throw new Error(error.message || "文件解析失败");
      return data as { text: string; char_count: number; warning?: string };
    },
  });
}

export function useExtractExpressions() {
  return useMutation({
    mutationFn: async (input: { text: string }): Promise<ImportResult> => {
      const { data, error } = await supabase.functions.invoke("expression-import-agent", {
        body: { text: input.text },
      });
      if (error) throw new Error(error.message || "表达式提取失败");
      return data as ImportResult;
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

      // 2. Batch insert expressions
      const rows = input.expressions.map((expr) => ({
        user_id: userId,
        english: expr.english,
        chinese: expr.chinese,
        type: expr.type,
        pronunciation: expr.pronunciation || null,
        example_sentence: expr.example_sentence || null,
        scene: expr.scene || null,
        topic: expr.topic || null,
        difficulty_level: expr.difficulty_level || null,
        status: "new",
        source: input.source_name || "import",
        import_batch_id: batch.id,
      }));

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
