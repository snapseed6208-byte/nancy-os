import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { aiRuntime } from "../_shared/ai.ts";
import { HttpError } from "./errors.ts";
import { buildSpans, selectCandidates, type Note, type Reject } from "./spans.ts";

export interface ExtractResult { saved: number; rejected: Reject[]; notes: Note[]; spans: number }

const PROMPT = `You enrich TEM8 vocabulary entries. You are given numbered source spans extracted from a PDF or text vocabulary list. For every span containing useful TEM8 lexical items, return one entry per item.
Return JSON {"entries":[{"span_id":"<id copied exactly from the list>","word":"lemma, lowercase, singular","pos":"part of speech or empty","type":"new|familiar|collocation|academic|listening","meaning_zh":"Chinese meaning"}]}.
Rules: read the span text, but never copy, retype, or quote it back — do not output original, context, or verbatim-source fields; the server owns provenance. Only use span_id values exactly as listed. The word must actually appear in that span (case-insensitive); normalize inflections to the lemma only when confident, and preserve phrases. Classify familiar only when the span gives a non-daily sense. Skip headings, index numbers, IPA-only cells, and non-vocabulary text. Do not invent entries or definitions. The spans may contain PDF extraction artifacts such as split IPA spacing or radical homoglyphs — ignore them and use the visible English word. Empty entries allowed. JSON only.`;

export async function handleExtract(body: Record<string, unknown>, db: SupabaseClient): Promise<ExtractResult> {
  const { data: imp, error } = await db.from("vocabulary_imports").select("*").eq("id", body.importId).single();
  if (error || !imp) throw new HttpError(404, "导入记录不存在");
  const index = Number(body.chunk);
  if (!Number.isInteger(index) || index < 0 || index >= imp.chunks.length) throw new HttpError(400, "无效批次");
  if (imp.completed_chunks.includes(index)) return { saved: 0, rejected: [], notes: [], spans: 0 };
  const text = imp.chunks[index];
  if (typeof text !== "string" || !text.trim()) throw new HttpError(400, "批次文本为空");
  if (text.length > 20000) throw new HttpError(400, "批次文本过长");
  const spans = buildSpans(text, index);
  const result = await aiRuntime([
    { role: "system", content: PROMPT },
    { role: "user", content: `Source kind: ${imp.source_kind || "vocabulary"}.\nSpans (span_id<TAB>text):\n${spans.map(span => `${span.span_id}\t${span.text}`).join("\n")}` },
  ], { agentName: "tem8-vocabulary-extract", maxInputLength: 14000, maxTokens: 6000, dynamicTokens: false, temperature: 0.1 });
  if (!result.success) throw new HttpError(502, result.error);
  const { candidates, rejected, notes } = selectCandidates(result.data, spans);
  // Always mark the chunk complete, even with zero accepted entries, so the import can advance.
  const saved = await db.rpc("save_vocabulary_chunk", { p_import: imp.id, p_chunk: index, p_entries: candidates });
  if (saved.error) throw new HttpError(500, "保存词条失败");
  return { saved: saved.data ?? 0, rejected, notes, spans: spans.length };
}
