// ============================================
// Nancy OS — Exam / Study Hooks
// ============================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function nowISO(): string {
  return new Date().toISOString();
}

function weekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

// ── Types ──

export type ExamRow = {
  id: string;
  user_id: string;
  name: string;
  category: "ielts" | "course" | "certificate" | "self_study";
  target_score: string | null;
  exam_date: string | null;
  status: "active" | "completed" | "paused";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StudySessionRow = {
  id: string;
  user_id: string;
  exam_id: string | null;
  date: string;
  duration_minutes: number;
  topic: string | null;
  score: number | null;
  notes: string | null;
  created_at: string;
};

// ── Exams CRUD ──

export function useExams() {
  return useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ExamRow[];
    },
  });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category: string; target_score?: string; exam_date?: string; notes?: string }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("exams")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams"] }),
  });
}

export function useUpdateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from("exams")
        .update({ ...input, updated_at: nowISO() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams"] }),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
    },
  });
}

// ── Study Sessions ──

export function useStudySessions(examId?: string) {
  return useQuery({
    queryKey: ["study_sessions", examId || "all"],
    queryFn: async () => {
      let query = supabase
        .from("study_sessions")
        .select("*, exams(name)")
        .order("date", { ascending: false })
        .limit(100);
      if (examId) query = query.eq("exam_id", examId);
      const { data, error } = await query;
      if (error) throw error;
      return data as (StudySessionRow & { exams: { name: string } | null })[];
    },
  });
}

export function useRecentStudySessions() {
  return useQuery({
    queryKey: ["study_sessions", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("*, exams(name)")
        .gte("date", weekAgo())
        .lte("date", today())
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as (StudySessionRow & { exams: { name: string } | null })[];
    },
  });
}

export function useCreateStudySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      exam_id?: string;
      date?: string;
      duration_minutes: number;
      topic?: string;
      score?: number;
      notes?: string;
    }) => {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({ ...input, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["exam_stats"] });
    },
  });
}

export function useDeleteStudySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
      qc.invalidateQueries({ queryKey: ["exam_stats"] });
    },
  });
}

// ── Stats ──

export function useExamStats() {
  return useQuery({
    queryKey: ["exam_stats"],
    queryFn: async () => {
      const weekStart = weekAgo();
      const { data: sessions, error } = await supabase
        .from("study_sessions")
        .select("duration_minutes, date, exam_id, score")
        .gte("date", weekStart)
        .lte("date", today());

      if (error) throw error;

      const totalMinutes = (sessions || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const totalSessions = (sessions || []).length;
      const daysStudied = new Set((sessions || []).map((s) => s.date)).size;

      return {
        totalMinutes,
        totalSessions,
        daysStudied,
        avgPerDay: daysStudied > 0 ? Math.round(totalMinutes / daysStudied) : 0,
      };
    },
  });
}
