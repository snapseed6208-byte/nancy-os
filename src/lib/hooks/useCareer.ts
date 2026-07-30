// ============================================
// Nancy OS — Career OS Hooks
// Jobs, interviews, career reflection
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { normalizeUrl } from "@/lib/utils";

// ── Types ──

export type JobRow = {
  id: string;
  user_id: string;
  company_name: string;
  position: string;
  jd_text: string | null;
  jd_url: string | null;
  salary_range: string | null;
  location: string | null;
  industry: string | null;
  status: string;
  applied_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InterviewRow = {
  id: string;
  user_id: string;
  job_id: string;
  round_number: number;
  interview_date: string | null;
  interviewer: string | null;
  format: string | null;
  questions_asked: string[] | null;
  self_assessment: string | null;
  ai_feedback: string | null;
  result: string | null;
  notes: string | null;
  created_at: string;
};

export type CareerReflectionRow = {
  id: string;
  learned: string;
  skills_improved: string;
  next_direction: string;
  created_at: string;
};

// ── Jobs ──

async function fetchJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as JobRow[];
}

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: fetchJobs,
    staleTime: 30 * 1000,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      company_name: string;
      position: string;
      status?: string;
      applied_date?: string;
      jd_url?: string;
      location?: string;
      industry?: string;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const normalizedJdUrl = input.jd_url ? normalizeUrl(input.jd_url) : null;
      const { data, error } = await supabase
        .from("jobs")
        .insert({ ...input, user_id: userId, jd_url: normalizedJdUrl })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: {
      id: string; status?: string; notes?: string; company_name?: string; position?: string;
    }) => {
      const { error } = await supabase.from("jobs").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jobs"] }); qc.invalidateQueries({ queryKey: ["interviews"] }); },
  });
}

// ── Interviews ──

async function fetchInterviews(jobId?: string) {
  let query = supabase
    .from("interviews")
    .select("*")
    .order("interview_date", { ascending: false })
    .limit(50);

  if (jobId) query = query.eq("job_id", jobId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as InterviewRow[];
}

export function useInterviews(jobId?: string) {
  return useQuery({
    queryKey: ["interviews", jobId],
    queryFn: () => fetchInterviews(jobId),
    staleTime: 30 * 1000,
  });
}

export function useCreateInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      job_id: string;
      round_number?: number;
      interview_date?: string;
      interviewer?: string;
      format?: string;
      questions_asked?: string[];
      self_assessment?: string;
      result?: string;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("interviews")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["interviews"] }); },
  });
}

export function useUpdateInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase.from("interviews").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["interviews"] }); },
  });
}

export function useDeleteInterview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("interviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["interviews"] }); },
  });
}

// ── Career Reflections ──

async function fetchCareerReflections() {
  const { data, error } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("agent_type", "career")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export function useCareerReflections() {
  return useQuery({
    queryKey: ["career_reflections"],
    queryFn: fetchCareerReflections,
    staleTime: 60 * 1000,
  });
}

export function useCreateCareerReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; content: string }) => {
      const userId = await getUserId();
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("ai_insights")
        .insert({
          user_id: userId,
          agent_type: "career",
          insight_type: "career_reflection",
          title: input.title,
          content: input.content,
          data: {},
          generated_at: today,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["career_reflections"] }); },
  });
}

export function useDeleteCareerReflection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_insights").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["career_reflections"] }); },
  });
}
