// ============================================
// Nancy OS — Important Events Hooks
// Personal Dashboard — upcoming key dates
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

export type ImportantEvent = {
  id: string;
  user_id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  event_type: ImportantEventType;
  description: string | null;
  priority: "high" | "medium" | "low";
  related_task_id: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type ImportantEventType =
  | "interview"
  | "exam"
  | "deadline"
  | "appointment"
  | "travel"
  | "other";

const TYPE_LABELS: Record<ImportantEventType, string> = {
  interview: "面试",
  exam: "考试",
  deadline: "截止日期",
  appointment: "预约",
  travel: "旅行",
  other: "其他",
};

const TYPE_ICONS: Record<ImportantEventType, string> = {
  interview: "💼",
  exam: "📝",
  deadline: "⏰",
  appointment: "📅",
  travel: "✈️",
  other: "📌",
};

export function getEventTypeLabel(type: string): string {
  return TYPE_LABELS[type as ImportantEventType] || "其他";
}

export function getEventTypeIcon(type: string): string {
  return TYPE_ICONS[type as ImportantEventType] || "📌";
}

async function fetchImportantEvents(upcomingOnly = true): Promise<ImportantEvent[]> {
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("important_events")
    .select("*")
    .order("priority", { ascending: true })
    .order("event_date", { ascending: true })
    .limit(20);

  if (upcomingOnly) {
    query = query.gte("event_date", today).eq("is_completed", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ImportantEvent[];
}

export function useImportantEvents(upcomingOnly = true) {
  return useQuery({
    queryKey: ["important_events", upcomingOnly],
    queryFn: () => fetchImportantEvents(upcomingOnly),
    staleTime: 60 * 1000,
  });
}

export function useCreateImportantEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      event_date: string;
      event_time?: string;
      event_type?: ImportantEventType;
      description?: string;
      priority?: "high" | "medium" | "low";
      related_task_id?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("important_events")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as ImportantEvent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["important_events"] });
    },
  });
}

export function useToggleImportantEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("important_events")
        .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["important_events"] });
    },
  });
}
