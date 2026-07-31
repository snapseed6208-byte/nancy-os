// ============================================
// Nancy OS — Reflection Agent Hooks v2
// Memory Governance: confirm / reject / candidate review
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";

// ── Types ──

export type MemoryResult = {
  id: string;
  content: string;
  memory_type: string;
  confidence: number;
  status: "candidate" | "probable" | "confirmed" | "rejected" | "outdated";
  reinforcement_count: number;
  action: "created" | "updated";
  is_new: boolean;
};

export type ReflectionResult = {
  period_summary: string;
  mood_trends: {
    dominant_mood: string;
    trend_direction: "improving" | "stable" | "declining";
    detail: string;
  };
  behavior_patterns: Array<{
    pattern: string;
    evidence: string;
    confidence: number;
  }>;
  growth_insights: Array<{
    insight: string;
    category: string;
    confidence: number;
  }>;
  tomorrow_suggestions: Array<{
    suggestion: string;
    priority: "high" | "medium" | "low";
  }>;
  extracted_memories: MemoryResult[];
  tokens_used?: number;
  memory_ids?: string[];
  insight_id?: string;
  duration_ms?: number;
  data_points?: number;
};

// ── Reflection Insights ──

async function fetchReflections() {
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("agent_type", "reflection")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data;
}

export function useReflections() {
  return useQuery({
    queryKey: ["reflections"],
    queryFn: fetchReflections,
  });
}

// ── Generate Reflection ──

export function useGenerateReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ReflectionResult> => {
      const result = await invokeAI<ReflectionResult>("reflection-agent", {});
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reflections"] });
      qc.invalidateQueries({ queryKey: ["ai_memories"] });
      qc.invalidateQueries({ queryKey: ["candidate_memories"] });
      qc.invalidateQueries({ queryKey: ["life_trace_stats"] });
    },
  });
}

// ── Daily Brief ──

async function fetchTodayBrief() {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("ai_daily_briefs")
    .select("*")
    .eq("date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows
  return data;
}

export function useTodayBrief() {
  return useQuery({
    queryKey: ["daily_brief", "today"],
    queryFn: fetchTodayBrief,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenerateDailyBrief() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const result = await invokeAI("daily-brief-agent", {});
      if (!result.success) {
        if (result.detail === "already_exists") return { error: "already_exists" };
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_brief"] });
      qc.invalidateQueries({ queryKey: ["agent_logs"] });
    },
  });
}

// ── Daily Brief Feedback ──

async function submitBriefFeedback(briefId: string, rating: "helpful" | "not_helpful", reason?: string) {
  const userId = await getUserId();
  const { error } = await supabase
    .from("agent_feedback")
    .insert({
      user_id: userId,
      agent_type: "daily_brief",
      reference_id: briefId,
      rating,
      reason: reason || null,
    });

  if (error) throw error;
}

export function useBriefFeedback() {
  return useMutation({
    mutationFn: ({ briefId, rating, reason }: { briefId: string; rating: "helpful" | "not_helpful"; reason?: string }) =>
      submitBriefFeedback(briefId, rating, reason),
  });
}

// ── Confirmed Memories (for downstream agents) ──

async function fetchMemories() {
  const { data, error } = await supabase
    .from("ai_memories")
    .select("*")
    .eq("is_active", true)
    .eq("status", "confirmed")
    .order("last_reinforced_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data;
}

export function useMemories() {
  return useQuery({
    queryKey: ["ai_memories"],
    queryFn: fetchMemories,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Candidate Memories (for user review) ──

async function fetchCandidateMemories() {
  const { data, error } = await supabase
    .from("ai_memories")
    .select("*")
    .eq("is_active", true)
    .in("status", ["candidate", "probable"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data;
}

export function useCandidateMemories() {
  return useQuery({
    queryKey: ["candidate_memories"],
    queryFn: fetchCandidateMemories,
    staleTime: 60 * 1000,
  });
}

// ── Confirm / Reject ──

async function confirmMemory(memoryId: string) {
  // 1. Update memory status
  const { error: memErr } = await supabase
    .from("ai_memories")
    .update({
      status: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", memoryId);

  if (memErr) throw memErr;

  // 2. Record feedback
  const userId = await getUserId();
  const { error: fbErr } = await supabase
    .from("memory_feedback")
    .insert({
      user_id: userId,
      memory_id: memoryId,
      action: "confirm",
    });

  if (fbErr) throw fbErr;
}

export function useConfirmMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: confirmMemory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_memories"] });
      qc.invalidateQueries({ queryKey: ["candidate_memories"] });
    },
  });
}

async function rejectMemory(memoryId: string, reason?: string) {
  // 1. Update memory status
  const { error: memErr } = await supabase
    .from("ai_memories")
    .update({
      status: "rejected",
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memoryId);

  if (memErr) throw memErr;

  // 2. Record feedback
  const userId = await getUserId();
  const { error: fbErr } = await supabase
    .from("memory_feedback")
    .insert({
      user_id: userId,
      memory_id: memoryId,
      action: "reject",
      reason: reason || null,
    });

  if (fbErr) throw fbErr;
}

export function useRejectMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memoryId, reason }: { memoryId: string; reason?: string }) =>
      rejectMemory(memoryId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_memories"] });
      qc.invalidateQueries({ queryKey: ["candidate_memories"] });
    },
  });
}

// ── Modify Memory ──

async function modifyMemory(memoryId: string, newContent: string) {
  // 1. Update memory content
  const { error: memErr } = await supabase
    .from("ai_memories")
    .update({
      content: newContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memoryId);

  if (memErr) throw memErr;

  // 2. Record feedback
  const userId = await getUserId();
  const { error: fbErr } = await supabase
    .from("memory_feedback")
    .insert({
      user_id: userId,
      memory_id: memoryId,
      action: "modify",
      modified_content: newContent,
    });

  if (fbErr) throw fbErr;
}

export function useModifyMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memoryId, content }: { memoryId: string; content: string }) =>
      modifyMemory(memoryId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_memories"] });
      qc.invalidateQueries({ queryKey: ["candidate_memories"] });
    },
  });
}

// ── All Memories (Memory Center — flexible filtering) ──

async function fetchAllMemories({
  status,
  memoryType,
  limit = 50,
}: {
  status?: string;
  memoryType?: string;
  limit?: number;
} = {}) {
  let query = supabase
    .from("ai_memories")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (memoryType) query = query.eq("memory_type", memoryType);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export function useAllMemories(filters?: { status?: string; memoryType?: string; limit?: number }) {
  return useQuery({
    queryKey: ["ai_memories", "all", filters],
    queryFn: () => fetchAllMemories(filters),
    staleTime: 30 * 1000,
  });
}

// ── Memory Stats (counts by status) ──

async function fetchMemoryStats() {
  const { data, error } = await supabase
    .from("ai_memories")
    .select("status, memory_type")
    .eq("is_active", true);

  if (error) throw error;

  const stats: Record<string, number> = { total: 0 };
  for (const row of data || []) {
    const s = row.status as string;
    stats[s] = (stats[s] || 0) + 1;
    stats.total++;
  }
  return stats;
}

export function useMemoryStats() {
  return useQuery({
    queryKey: ["ai_memories", "stats"],
    queryFn: fetchMemoryStats,
    staleTime: 60 * 1000,
  });
}

// ── Outdated Check (90 days no reinforcement → pending_review) ──

async function fetchOutdatedCandidates() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoff = ninetyDaysAgo.toISOString();

  const { data, error } = await supabase
    .from("ai_memories")
    .select("*")
    .eq("is_active", true)
    .in("status", ["confirmed", "probable"])
    .or(`last_reinforced_at.lt.${cutoff},last_reinforced_at.is.null`)
    .order("last_reinforced_at", { ascending: true })
    .limit(50);

  if (error) throw error;
  return data;
}

export function useOutdatedCandidates() {
  return useQuery({
    queryKey: ["ai_memories", "outdated"],
    queryFn: fetchOutdatedCandidates,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mark as Pending Review ──

async function markPendingReview(memoryId: string) {
  const { error } = await supabase
    .from("ai_memories")
    .update({
      status: "pending_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", memoryId);

  if (error) throw error;
}

export function useMarkPendingReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memoryId: string) => markPendingReview(memoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_memories"] });
    },
  });
}
