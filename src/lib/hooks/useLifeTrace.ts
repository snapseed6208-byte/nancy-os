// ============================================
// Nancy OS — Life Trace Hooks
// Ideas (Quick Capture), Journal, Mood, Money
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { dataUrlToBlob, uniqueFileName } from "@/lib/media";
import type { PendingCapture } from "@/lib/db/indexedDb";

// ── Helpers ──

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function nowISO(): string {
  return new Date().toISOString();
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
  status?: string;
  search?: string;
};

async function fetchIdeas(filters: IdeaFilters = {}) {
  let query = supabase
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);
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
        .update({ ...input, updated_at: nowISO() })
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
        status: "inbox",
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
    supabase.from("ideas").select("id, content, category, created_at").order("created_at", { ascending: false }).limit(5),
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
