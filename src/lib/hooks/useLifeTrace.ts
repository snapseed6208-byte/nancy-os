// ============================================
// Nancy OS — Life Trace Hooks
// Ideas (Quick Capture), Journal, Mood, Money
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";
import { dataUrlToBlob, uniqueFileName } from "@/lib/media";
import { getBeijingDateString, getBeijingISOString } from "@/lib/date";
import type { PendingCapture } from "@/lib/db/indexedDb";
import type { LifeAnalysisResult, LifeAnalysisInsight, LifeAnalysisSuggestion } from "@/lib/types";

// ── Helpers ──

function today(): string {
  return getBeijingDateString();
}

function monthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function monthEnd(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================
// Section A: Ideas (Quick Capture)
// ============================================

export type IdeaFilters = {
  category?: string;
  status?: "pending" | "converted" | "processed" | "";
  search?: string;
};

async function fetchIdeas(filters: IdeaFilters = {}) {
  let query = supabase
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.search) query = query.ilike("content", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function useIdeas(filters: IdeaFilters = {}) {
  return useQuery({
    queryKey: ["ideas", filters],
    queryFn: () => fetchIdeas(filters),
  });
}

async function fetchIdea(id: string) {
  const { data, error } = await supabase.from("ideas").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export function useIdea(id: string | undefined) {
  return useQuery({
    queryKey: ["idea", id],
    queryFn: () => fetchIdea(id!),
    enabled: !!id,
  });
}

export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const userId = await getUserId();
      const { data, error } = await supabase.from("ideas").insert({ ...input, user_id: userId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("ideas")
        .update({ ...input, updated_at: getBeijingISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });
}

export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });
}

export function useConvertIdeaToTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ideaId: string;
      ideaContent: string;
      title: string;
      priority?: string;
      estimatedMinutes?: number;
      dueDate?: string;
      category?: string;
    }) => {
      const userId = await getUserId();
      // Create task from idea
      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: input.title,
          description: input.ideaContent,
          priority: input.priority || "medium",
          estimated_minutes: input.estimatedMinutes,
          due_date: input.dueDate,
          category: input.category || "general",
          source_type: "idea",
          source_id: input.ideaId,
          module: "general",
          energy_cost: "medium",
          energy_level: "medium",
          task_type: "one_time",
          target_count: 1,
          completed_count: 0,
        })
        .select("id")
        .single();

      if (taskErr) throw taskErr;

      // Update idea status to converted
      const { error: updateErr } = await supabase
        .from("ideas")
        .update({
          status: "converted",
          related_task_id: (task as { id: string }).id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.ideaId);

      if (updateErr) throw updateErr;
      return task as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAiSuggestTask() {
  return useMutation({
    mutationFn: async (input: {
      ideaContent: string;
    }): Promise<{
      title: string;
      description: string;
      priority: string;
      estimated_minutes: number;
      category: string;
    }> => {
      const result = await invokeAI<{
        title: string;
        description: string;
        priority: string;
        estimated_minutes: number;
        category: string;
      }>("task-breakdown-agent", {
        goal_title: input.ideaContent.slice(0, 100),
        goal_description: input.ideaContent,
        goal_level: "idea",
      });

      if (!result.success) throw new Error(result.error);

      // Map the first task from the breakdown result
      const tasks = (result.data as unknown as { tasks?: Array<Record<string, unknown>> })?.tasks;
      if (tasks && tasks.length > 0) {
        const t = tasks[0];
        return {
          title: (t.title as string) || input.ideaContent.slice(0, 60),
          description: (t.description as string) || "",
          priority: (t.priority as string) || "medium",
          estimated_minutes: (t.estimated_minutes as number) || 30,
          category: (t.module as string) || "general",
        };
      }
      return {
        title: input.ideaContent.slice(0, 60),
        description: "",
        priority: "medium",
        estimated_minutes: 30,
        category: "general",
      };
    },
  });
}

// Sync: IndexedDB → Supabase
export function useSyncCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (capture: PendingCapture) => {
      const userId = await getUserId();

      // Upload images to Storage — each failure is surfaced
      const uploadedUrls: string[] = [];
      for (let i = 0; i < capture.images.length; i++) {
        const img = capture.images[i];
        const blob = dataUrlToBlob(img);
        const ext = img.startsWith("data:image/png") ? "png" : "jpg";
        const fileName = uniqueFileName(ext);
        const { error: uploadErr } = await supabase.storage
          .from("capture-images")
          .upload(fileName, blob);
        if (uploadErr) throw new Error(`图片 ${i + 1}/${capture.images.length} 上传失败: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage
          .from("capture-images")
          .getPublicUrl(fileName);
        uploadedUrls.push(urlData.publicUrl);
      }

      // Upload audio to Storage
      let audioUrl = "";
      if (capture.audioDataUrl) {
        const blob = dataUrlToBlob(capture.audioDataUrl);
        const fileName = uniqueFileName("webm");
        const { error: uploadErr } = await supabase.storage
          .from("capture-audio")
          .upload(fileName, blob);
        if (uploadErr) throw new Error(`音频上传失败: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage
          .from("capture-audio")
          .getPublicUrl(fileName);
        audioUrl = urlData.publicUrl;
      }

      // Build content with media embeddings
      let content = capture.content;
      if (uploadedUrls.length > 0) {
        content += "\n\n" + uploadedUrls.map((u) => `![](${u})`).join("\n");
      }
      if (audioUrl) {
        content += `\n\n[音频](${audioUrl})`;
      }

      const { error } = await supabase.from("ideas").insert({
        content,
        category: capture.category || null,
        status: "pending",
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });
}

// ============================================
// Section B: Journal Entries
// ============================================

export type JournalFilters = {
  year?: number;
  month?: number;
};

async function fetchJournalEntries(filters: JournalFilters = {}) {
  const now = new Date();
  const year = filters.year ?? now.getFullYear();
  const month = filters.month ?? now.getMonth() + 1;

  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .gte("date", monthStart(year, month))
    .lte("date", monthEnd(year, month))
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

export function useJournalEntries(filters: JournalFilters = {}) {
  return useQuery({
    queryKey: ["journal_entries", filters],
    queryFn: () => fetchJournalEntries(filters),
  });
}

async function fetchJournalEntry(date: string) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function useJournalEntry(date: string | undefined) {
  return useQuery({
    queryKey: ["journal_entry", date],
    queryFn: () => fetchJournalEntry(date!),
    enabled: !!date,
  });
}

export function useUpsertJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("journal_entries")
        .upsert({ ...input, user_id: userId }, { onConflict: "user_id, date" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal_entries"] });
      qc.invalidateQueries({ queryKey: ["journal_entry"] });
      qc.invalidateQueries({ queryKey: ["life_trace_stats"] });
    },
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("journal_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal_entries"] });
      qc.invalidateQueries({ queryKey: ["life_trace_stats"] });
    },
  });
}

// ── AI Life Analysis ──

export function useTriggerLifeAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (journalEntryId: string): Promise<LifeAnalysisResult> => {
      const result = await invokeAI<LifeAnalysisResult>("life-analysis-agent", { journal_entry_id: journalEntryId });
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal_entries"] });
      qc.invalidateQueries({ queryKey: ["journal_entry"] });
      qc.invalidateQueries({ queryKey: ["life_trace_stats"] });
      qc.invalidateQueries({ queryKey: ["recent_ai_insights"] });
    },
  });
}

async function fetchRecentAIInsights() {
  const todayBeijing = new Date(getBeijingDateString() + "T00:00:00+08:00");
  const sevenDaysAgo = new Date(todayBeijing);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sinceDate = sevenDaysAgo.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, date, title, content, ai_summary, ai_themes, ai_actions, ai_thoughts, ai_insights, ai_suggestions, ai_analysis_version")
    .not("ai_summary", "is", null)
    .gte("date", sinceDate)
    .order("date", { ascending: false })
    .limit(10);

  if (error) throw error;
  return data;
}

export function useRecentAIInsights() {
  return useQuery({
    queryKey: ["recent_ai_insights"],
    queryFn: fetchRecentAIInsights,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Section C: Mood Records
// ============================================

export type MoodFilters = {
  year?: number;
  month?: number;
  days?: number;
};

async function fetchMoodRecords(filters: MoodFilters = {}) {
  let query = supabase
    .from("mood_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const now = new Date();
  const year = filters.year ?? now.getFullYear();
  const month = filters.month ?? now.getMonth() + 1;

  if (filters.year || filters.month) {
    query = query
      .gte("date", monthStart(year, month))
      .lte("date", monthEnd(year, month));
  } else if (filters.days) {
    const since = new Date();
    since.setDate(since.getDate() - filters.days);
    query = query.gte("date", since.toISOString().split("T")[0]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function useMoodRecords(filters: MoodFilters = {}) {
  return useQuery({
    queryKey: ["mood_records", filters],
    queryFn: () => fetchMoodRecords(filters),
  });
}

export function useCreateMoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("mood_records")
        .insert({ ...input, user_id: userId, date: input.date || today() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mood_records"] });
      qc.invalidateQueries({ queryKey: ["life_trace_stats"] });
    },
  });
}

export function useDeleteMoodRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mood_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mood_records"] }),
  });
}

// ============================================
// Section D: Money Records
// ============================================

export type MoneyFilters = {
  year?: number;
  month?: number;
  type?: string;
  category?: string;
};

async function fetchMoneyRecords(filters: MoneyFilters = {}) {
  const now = new Date();
  const year = filters.year ?? now.getFullYear();
  const month = filters.month ?? now.getMonth() + 1;

  let query = supabase
    .from("money_records")
    .select("*")
    .gte("date", monthStart(year, month))
    .lte("date", monthEnd(year, month))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function useMoneyRecords(filters: MoneyFilters = {}) {
  return useQuery({
    queryKey: ["money_records", filters],
    queryFn: () => fetchMoneyRecords(filters),
  });
}

export function useCreateMoneyRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("money_records")
        .insert({ ...input, user_id: userId, date: input.date || today() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["money_records"] });
      qc.invalidateQueries({ queryKey: ["life_trace_stats"] });
    },
  });
}

export function useUpdateMoneyRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from("money_records")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["money_records"] }),
  });
}

export function useDeleteMoneyRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("money_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["money_records"] });
      qc.invalidateQueries({ queryKey: ["life_trace_stats"] });
    },
  });
}

// ============================================
// Section E: Dashboard Stats
// ============================================

async function fetchLifeTraceStats() {
  const todayStr = today();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    journalTodayRes,
    moodMonthRes,
    moneyMonthRes,
    recentIdeasRes,
    recentJournalsRes,
    recentMoodsRes,
    recentMoneyRes,
  ] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("date", todayStr),
    supabase
      .from("mood_records")
      .select("id", { count: "exact", head: true })
      .gte("date", monthStart(year, month))
      .lte("date", monthEnd(year, month)),
    supabase
      .from("money_records")
      .select("amount, type")
      .gte("date", monthStart(year, month))
      .lte("date", monthEnd(year, month)),
    supabase.from("ideas").select("id, content, category, created_at").neq("status", "processed").order("created_at", { ascending: false }).limit(5),
    supabase.from("journal_entries").select("id, title, date, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("mood_records").select("id, mood, date, intensity, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("money_records").select("id, amount, type, category, date, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const moneyRows = moneyMonthRes.data || [];
  const totalExpense = moneyRows
    .filter((r: { type: string }) => r.type === "expense")
    .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);
  const totalIncome = moneyRows
    .filter((r: { type: string }) => r.type === "income")
    .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

  // Merge recent activities
  const activities: { type: string; id: string; summary: string; date: string }[] = [];
  (recentIdeasRes.data || []).forEach((r: { id: string; content: string; category: string; created_at: string }) => {
    activities.push({ type: "idea", id: r.id, summary: r.content.slice(0, 60), date: r.created_at });
  });
  (recentJournalsRes.data || []).forEach((r: { id: string; title: string; date: string; created_at: string }) => {
    activities.push({ type: "journal", id: r.id, summary: r.title || "无标题日记", date: r.created_at });
  });
  (recentMoodsRes.data || []).forEach((r: { id: string; mood: string; date: string; intensity: number; created_at: string }) => {
    activities.push({ type: "mood", id: r.id, summary: `${r.mood} (${r.intensity}/5)`, date: r.created_at });
  });
  (recentMoneyRes.data || []).forEach((r: { id: string; amount: number; type: string; category: string; date: string; created_at: string }) => {
    const sign = r.type === "income" ? "+" : "-";
    activities.push({ type: "money", id: r.id, summary: `${sign}¥${r.amount} ${r.category}`, date: r.created_at });
  });
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    journalToday: journalTodayRes.count ?? 0,
    moodThisMonth: moodMonthRes.count ?? 0,
    totalExpense,
    totalIncome,
    recentActivities: activities.slice(0, 10),
  };
}

export function useLifeTraceStats() {
  return useQuery({
    queryKey: ["life_trace_stats"],
    queryFn: fetchLifeTraceStats,
  });
}
