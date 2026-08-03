// ============================================
// Nancy OS — Speaking Import Hook
// Full state machine for file → extract → dedup → preview → import
// ============================================

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { parseFile, validateFile, type ParseResult } from "@/lib/parsers/fileParsers";

// ── Types ──

export type ImportStep =
  | "idle"
  | "parsing"
  | "extracting"
  | "deduplicating"
  | "preview"
  | "importing"
  | "done"
  | "error";

export type QuestionStatus = "new" | "duplicate" | "variant" | "needs_review";

export interface ImportQuestion {
  temp_id: string;
  question: string;
  normalized_question: string;
  content_hash: string;
  mode: string;
  topic: string;
  part: string | null;
  context: string | null;
  cue_points: string[] | null;
  tags: string[];
  difficulty: string;
  status: QuestionStatus;
  duplicate_of: string | null;
  selected: boolean;
  // Editable overrides
  edited_mode?: string;
  edited_topic?: string;
  edited_part?: string | null;
  edited_difficulty?: string;
}

export interface ImportStats {
  total: number;
  new_count: number;
  duplicate_count: number;
  variant_count: number;
  needs_review: number;
}

export interface ImportResult {
  batch_id: string;
  imported: number;
  skipped: number;
  errors: number;
}

// ── Hook ──

export function useSpeakingImport() {
  const qc = useQueryClient();

  const [step, setStep] = useState<ImportStep>("idle");
  const [fileInfo, setFileInfo] = useState<ParseResult | null>(null);
  const [questions, setQuestions] = useState<ImportQuestion[]>([]);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Step 1: Parse file ──

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setStep("parsing");
    setFileInfo(null);
    setQuestions([]);
    setStats(null);
    setImportResult(null);

    const fileErr = validateFile(file);
    if (fileErr) {
      setError(fileErr);
      setStep("error");
      return;
    }

    try {
      const result = await parseFile(file);
      if (result.charCount === 0) {
        setError("文件内容为空。如果是扫描版 PDF，当前不支持 OCR 文字识别。");
        setStep("error");
        setFileInfo(result);
        return;
      }
      setFileInfo(result);
      setStep("extracting");

      // ── Step 2: Extract questions via Edge Function ──
      const { data, error: fnErr } = await supabase.functions.invoke("question-import-agent", {
        body: { text: result.text },
      });

      if (fnErr) {
        let errMsg = "Edge Function 调用失败";
        try {
          const ctx = (fnErr as { context?: string }).context;
          if (ctx) {
            const body = JSON.parse(ctx) as Record<string, unknown>;
            errMsg = (body.error as string) || (body.detail as string) || errMsg;
          }
        } catch { /* ignore */ }
        setError(errMsg);
        setStep("error");
        return;
      }

      const payload = data as {
        questions?: Array<Record<string, unknown>>;
        stats?: ImportStats;
      };

      // Validate response
      if (!payload || !Array.isArray(payload.questions)) {
        setError("AI 服务返回格式异常，未能提取到题目");
        setStep("error");
        return;
      }

      if (payload.questions.length === 0) {
        setError("未能从文件中提取到任何口语题目。请确认文件包含口语练习题。");
        setStep("error");
        return;
      }

      const mappedQuestions: ImportQuestion[] = payload.questions.map((q) => {
        const status = (q.status as QuestionStatus) || "new";
        return {
          temp_id: q.temp_id as string,
          question: q.question as string,
          normalized_question: q.normalized_question as string,
          content_hash: q.content_hash as string,
          mode: (q.mode as string) || "daily",
          topic: (q.topic as string) || "life_routine",
          part: (q.part as string) || null,
          context: (q.context as string) || null,
          cue_points: Array.isArray(q.cue_points) ? q.cue_points as string[] : null,
          tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
          difficulty: (q.difficulty as string) || "medium",
          status,
          duplicate_of: (q.duplicate_of as string) || null,
          selected: status === "new" || status === "variant",
        };
      });

      setQuestions(mappedQuestions);
      setStats(payload.stats as ImportStats);
      setStep("preview");
    } catch (err) {
      setError((err as Error).message || "文件解析失败");
      setStep("error");
    }
  }, []);

  // ── Toggle selection ──

  const toggleQuestion = useCallback((tempId: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.temp_id === tempId ? { ...q, selected: !q.selected } : q))
    );
  }, []);

  const selectAllNew = useCallback(() => {
    setQuestions((prev) =>
      prev.map((q) => ({ ...q, selected: q.status === "new" || q.status === "variant" }))
    );
  }, []);

  const deselectDuplicates = useCallback(() => {
    setQuestions((prev) =>
      prev.map((q) => ({ ...q, selected: q.status === "duplicate" ? false : q.selected }))
    );
  }, []);

  // ── Batch edit ──

  const batchSetMode = useCallback((mode: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.selected ? { ...q, edited_mode: mode } : q))
    );
  }, []);

  const batchSetTopic = useCallback((topic: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.selected ? { ...q, edited_topic: topic } : q))
    );
  }, []);

  const effectiveMode = useCallback((q: ImportQuestion) => q.edited_mode || q.mode, []);
  const effectiveTopic = useCallback((q: ImportQuestion) => q.edited_topic || q.topic, []);
  const effectivePart = useCallback((q: ImportQuestion) => q.edited_part !== undefined ? q.edited_part : q.part, []);
  const effectiveDifficulty = useCallback((q: ImportQuestion) => q.edited_difficulty || q.difficulty, []);

  // ── Edit single question ──

  const updateQuestion = useCallback((tempId: string, field: string, value: unknown) => {
    setQuestions((prev) =>
      prev.map((q) => (q.temp_id === tempId ? { ...q, [field]: value } : q))
    );
  }, []);

  // ── Step 3: Confirm import ──

  const confirmImport = useCallback(async () => {
    const selected = questions.filter((q) => q.selected);
    if (selected.length === 0) {
      setError("请至少选择一道题目导入");
      return;
    }

    // Check for needs_review items among selected
    const needsReviewSelected = selected.filter((q) => q.status === "needs_review");
    if (needsReviewSelected.length > 0) {
      setError(`${needsReviewSelected.length} 道题目状态为"需人工确认"，请逐一确认后再导入`);
      return;
    }

    setError("");
    setStep("importing");

    try {
      const userId = await getUserId();

      // Create import batch
      const { data: batch, error: batchErr } = await supabase
        .from("speaking_import_batches")
        .insert({
          user_id: userId,
          source: fileInfo?.fileName || "manual",
          total_count: selected.length,
          status: "in_progress",
        })
        .select("id")
        .single();

      if (batchErr) throw batchErr;

      // Build rows
      const rows = selected.map((q) => ({
        user_id: userId,
        question: q.question,
        normalized_question: q.normalized_question,
        content_hash: q.content_hash,
        mode: effectiveMode(q),
        topic: effectiveTopic(q),
        part: effectivePart(q),
        context: q.context,
        cue_points: q.cue_points,
        tags: q.tags,
        difficulty: effectiveDifficulty(q),
        source_type: "import",
        import_batch_id: batch.id,
      }));

      const { error: insertErr } = await supabase.from("speaking_questions").insert(rows);
      if (insertErr) throw insertErr;

      // Update batch status
      await supabase
        .from("speaking_import_batches")
        .update({
          imported_count: selected.length,
          status: "completed",
        })
        .eq("id", batch.id);

      setImportResult({
        batch_id: batch.id,
        imported: selected.length,
        skipped: questions.length - selected.length,
        errors: 0,
      });

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ["speaking_questions"] });
      qc.invalidateQueries({ queryKey: ["speaking_import_batches"] });

      setStep("done");
    } catch (err) {
      setError((err as Error).message || "导入失败");
      setStep("preview");
    }
  }, [questions, fileInfo, qc, effectiveMode, effectiveTopic, effectivePart, effectiveDifficulty]);

  // ── Reset ──

  const reset = useCallback(() => {
    setStep("idle");
    setFileInfo(null);
    setQuestions([]);
    setStats(null);
    setImportResult(null);
    setError("");
    setEditingId(null);
  }, []);

  return {
    // State
    step,
    fileInfo,
    questions,
    stats,
    importResult,
    error,
    editingId,
    // Actions
    handleFile,
    toggleQuestion,
    selectAllNew,
    deselectDuplicates,
    batchSetMode,
    batchSetTopic,
    updateQuestion,
    setEditingId,
    confirmImport,
    reset,
    // Helpers
    effectiveMode,
    effectiveTopic,
    effectivePart,
    effectiveDifficulty,
  };
}
