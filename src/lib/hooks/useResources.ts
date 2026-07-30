// ============================================
// Nancy OS — Resource Inbox Hooks v2
// Personal AI Knowledge Base with 3-layer system
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { normalizeUrl } from "@/lib/utils";

// ── Types ──

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  created_at: string;
};

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
  // Layer 1: Original Source
  source_platform: string | null;
  source_author: string | null;
  source_title: string | null;
  source_cover: string | null;
  raw_content: string | null;
  // Layer 2: AI Understanding
  ai_summary: string | null;
  ai_category: string | null;
  ai_tags: string[] | null;
  ai_key_points: string[] | null;
  ai_important_quotes: string[] | null;
  ai_action_items: Array<{ action: string; priority: string }> | null;
  ai_recommended_category: { name: string; confidence: number } | null;
  ai_applicable_scenarios: string[] | null;
  ai_related_knowledge: string[] | null;
  ai_source_extracted_at: string | null;
  source_url: string | null;
  content_type: string | null;
  parse_status: string | null;
  // Layer 3: Personal Knowledge
  status: string | null;
  user_notes: string | null;
  // Legacy
  is_favorite: boolean;
  is_archived: boolean;
  read_progress: number | null;
  metadata: Record<string, unknown> | null;
  related_goal_id: string | null;
  related_task_id: string | null;
  notes: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
};

// ── Categories ──

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as Category[];
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; icon?: string; color?: string }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("categories")
        .insert({
          user_id: userId,
          name: input.name,
          icon: input.icon || null,
          color: input.color || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; icon?: string; color?: string }) => {
      const { id, ...fields } = input;
      const { data, error } = await supabase
        .from("categories")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["resources"] });
    },
  });
}

// ── Fetch Resources ──

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

// ── Resource Mutations ──

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
      // v2: Knowledge base fields
      category_id?: string;
      source_url?: string;
      source_platform?: string;
      source_author?: string;
      source_title?: string;
      source_cover?: string;
      raw_content?: string;
      ai_summary?: string;
      ai_category?: string;
      ai_tags?: string[];
      ai_key_points?: string[];
      ai_important_quotes?: string[];
      ai_action_items?: Array<{ action: string; priority: string }>;
      ai_recommended_category?: { name: string; confidence: number };
      ai_applicable_scenarios?: string[];
      ai_related_knowledge?: string[];
      content_type?: string;
      status?: string;
    }) => {
      const userId = await getUserId();
      const normalizedUrl = input.url ? normalizeUrl(input.url) : null;
      const { data, error } = await supabase
        .from("resources")
        .insert({
          user_id: userId,
          title: input.title,
          url: normalizedUrl,
          resource_type: input.resource_type || "article",
          module: input.module || null,
          tags: input.tags || null,
          notes: input.notes || null,
          // v2 fields
          category_id: input.category_id || null,
          source_url: input.source_url || null,
          source_platform: input.source_platform || null,
          source_author: input.source_author || null,
          source_title: input.source_title || null,
          source_cover: input.source_cover || null,
          raw_content: input.raw_content || null,
          ai_summary: input.ai_summary || null,
          ai_category: input.ai_category || null,
          ai_tags: input.ai_tags || null,
          ai_key_points: input.ai_key_points || null,
          ai_important_quotes: input.ai_important_quotes || null,
          ai_action_items: input.ai_action_items || null,
          ai_recommended_category: input.ai_recommended_category || null,
          ai_applicable_scenarios: input.ai_applicable_scenarios || null,
          ai_related_knowledge: input.ai_related_knowledge || null,
          content_type: input.content_type || null,
          parse_status: "parsed",
          status: input.status || "saved",
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
      // v2 fields
      category_id?: string;
      status?: string;
      user_notes?: string;
    }) => {
      const { id, ...fields } = input;
      const normalizedUrl = fields.url ? normalizeUrl(fields.url) : undefined;
      const { data, error } = await supabase
        .from("resources")
        .update({ ...fields, url: normalizedUrl ?? fields.url, updated_at: new Date().toISOString() })
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
  important_quotes: string[];
  action_items: Array<{ action: string; priority: string }>;
  recommended_category: { name: string; confidence: number } | null;
  applicable_scenarios: string[];
  related_knowledge: string[];
  tags: string[];
  metadata: Record<string, unknown>;
  target_table: string;
  record_id: string;
  tokens_used: number;
  source_url: string | null;
  source_platform: string | null;
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
