// ============================================
// Nancy OS — Resource Inbox Hooks
// Lightweight knowledge capture
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

// ── Types ──

export type ResourceRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  url: string | null;
  platform: string | null;
  resource_type: string;
  module: string | null;
  tags: string[] | null;
  author: string | null;
  thumbnail_url: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_tags: string[] | null;
  ai_key_points: string[] | null;
  ai_action_items: Array<{ action: string; priority: string }> | null;
  source_url: string | null;
  content_type: string | null;
  parse_status: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  read_progress: number | null;
  metadata: Record<string, unknown> | null;
  related_goal_id: string | null;
  related_task_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ── Fetch ──

async function fetchResources(): Promise<ResourceRow[]> {
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data || []) as ResourceRow[];
}

export function useResources() {
  return useQuery({
    queryKey: ["resources"],
    queryFn: fetchResources,
    staleTime: 60 * 1000,
  });
}

// ── Mutations ──

export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      url?: string;
      resource_type?: string;
      module?: string;
      tags?: string[];
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("resources")
        .insert({
          user_id: userId,
          title: input.title,
          url: input.url || null,
          resource_type: input.resource_type || "article",
          module: input.module || null,
          tags: input.tags || null,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
  });
}

export function useUpdateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      url?: string;
      resource_type?: string;
      module?: string;
      tags?: string[];
      notes?: string;
      is_favorite?: boolean;
      is_archived?: boolean;
    }) => {
      const { id, ...fields } = input;
      const { data, error } = await supabase
        .from("resources")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
  });
}

// ── Content Parser ──

export type ParsedContent = {
  content_type: string;
  title: string;
  category: string;
  summary: string;
  key_points: string[];
  action_items: Array<{ action: string; priority: string }>;
  tags: string[];
  metadata: Record<string, unknown>;
  target_table: string;
  record_id: string;
  tokens_used: number;
};

export function useContentParser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      url?: string;
      text?: string;
      preferred_module?: string;
    }): Promise<ParsedContent> => {
      const { data, error } = await supabase.functions.invoke("content-parser-agent", {
        body: {
          url: input.url || undefined,
          text: input.text || undefined,
          preferred_module: input.preferred_module || undefined,
        },
      });

      if (error) {
        // FunctionsHttpError has context.status
        const ctx = (error as { context?: { status?: number } }).context;
        if (ctx?.status) {
          throw new Error(`AI 服务异常 (${ctx.status})`);
        }
        throw new Error(error.message || "AI 解析失败");
      }

      return data as ParsedContent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      qc.invalidateQueries({ queryKey: ["health"] });
    },
  });
}
