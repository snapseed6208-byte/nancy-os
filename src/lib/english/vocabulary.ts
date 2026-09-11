import { layoutEntries } from "../../../supabase/functions/tem8-vocabulary-agent/spans";

export const vocabularyTypes = { new: "新词", familiar: "熟词生义", collocation: "搭配", academic: "学术／正式", listening: "听力识别" } as const;
export type VocabularyType = keyof typeof vocabularyTypes;
export type VocabularyLevel = "R0" | "R1" | "R2" | "P1" | "P2";
export interface VocabularySource { import_id: string; name: string; original: string; context: string }
export interface VocabularyEnrichment {
  core_meaning: string; tem8_meaning: string; english_definition: string; pronunciation: string;
  known_meaning: string; trigger: string; trap: string; collocations: string[]; examples: string[];
  register: string; recommended_level: VocabularyLevel; value: "high" | "medium" | "low";
  synonyms?: string[]; contrast_example?: string; writing_use?: string; translation_use?: string; schema_version?: number;
}
export interface VocabularyWord {
  id: string; word: string; pos: string; meaning: string; type: VocabularyType;
  sources: VocabularySource[]; enrichment: VocabularyEnrichment | null;
  level: VocabularyLevel; status: "inbox" | "learning" | "review" | "error" | "stable";
  review_stage: number; due_at: string | null; error_count: number; version: number;
  target_level?: Exclude<VocabularyLevel,"R0">; mastery?: Partial<Record<TestMode,{passes:number;last_day:string;score:number}>>;
  listening_status?: "unknown" | "weak" | "learning" | "stable"; listening_due_at?: string | null;
  listening_stage?: number; last_review_day?: string | null; last_listening_day?: string | null;
  content_version?: number; archived?: boolean; curated?: boolean;
}
export interface VocabularyImport { id: string; name: string; chunk_count: number; completed_chunks: number[]; created_at: string; source_kind?: string }
export interface VocabularyReject { index: number; span_id: string | null; field: string; reason: string }
export interface VocabularyExtractResult { saved?: number; rejected?: VocabularyReject[]; notes?: { index: number; field: string; detail: string }[]; spans?: number }
export const testModes = {R1:"R1 · 释义识别",R2:"R2 · 语境辨义",collocation:"搭配填空",P1:"P1 · 翻译输出",P2:"P2 · 自主造句",listening:"听力辨认"} as const;
export type TestMode = keyof typeof testModes;
export interface VocabularyPlan { user_id:string; day:string; new_ids:string[]; familiar_ids:string[]; production_ids:string[]; target:number }
export interface VocabularyFeedback {
  score:number; passed:boolean; explanation:string; expected_answer:string; error_type:string; root_cause:string;
  transferable_rule:string; corrected_answer:string; level:VocabularyLevel; mode:TestMode;
  criteria:{meaning:number;grammar:number;collocation:number;register:number};
}
export interface VocabularyQuestion { attemptId:string; mode:TestMode; question:{prompt:string;options:string[];audio_text:string}; feedback:VocabularyFeedback|null }
export interface VocabularyAttempt { id:string;word_id:string;mode:TestMode;day:string;score:number|null;answer:string|null;feedback:VocabularyFeedback|null;completed_at:string|null;created_at:string }
export interface VocabularyDashboard {attempts:number;today_completed:number;open_errors:number;modes:{mode:TestMode;attempts:number;average_score:number;passed:number}[];days:{day:string;attempts:number;passed:number}[]}
export function recommendedTest(word:VocabularyWord):TestMode {
  if(word.listening_due_at && Date.parse(word.listening_due_at)<=Date.now()) return "listening";
  const m=word.mastery||{};
  if(!m.R1?.passes) return "R1";
  const target=word.target_level||"R1";
  if(target==="R1") return "R1";
  if(!m.R2?.passes) return word.type==="collocation" ? "collocation" : "R2";
  if(target==="R2") return word.type==="collocation" ? "collocation" : "R2";
  if((m.P1?.passes||0)<2 || target==="P1") return "P1";
  return "P2";
}
export function dailyVocabularyQueue(words:VocabularyWord[],plan:VocabularyPlan|null|undefined,now=Date.now()):VocabularyWord[] {
  const ids=new Set([...(plan?.new_ids||[]),...(plan?.familiar_ids||[]),...(plan?.production_ids||[])]);
  return words.filter(w=>!w.archived && ((w.due_at && Date.parse(w.due_at)<=now) ||
    (w.listening_due_at && Date.parse(w.listening_due_at)<=now) || (ids.has(w.id) && !w.due_at)))
    .sort((a,b)=>{
      const time=(w:VocabularyWord)=>Math.min(w.due_at ? Date.parse(w.due_at) : Infinity,w.listening_due_at ? Date.parse(w.listening_due_at) : Infinity);
      return time(a)-time(b)||vocabularyPriority(b)-vocabularyPriority(a);
    });
}
// Bump when the chunking strategy changes so an unchanged file re-imports under the new strategy
// instead of deduping back onto its old, differently-chunked row.
export const CHUNKER_VERSION = 2;
export const CHUNK_TARGET_WORDS = 30;
export const CHUNK_MAX_WORDS = 40;
export const CHUNK_MAX_CHARS = 6000;
const alphaTokens = /[A-Za-z][A-Za-z'-]*/g;

// Last resort for a single entry/cell larger than the character cap: cut at whitespace, never mid-word.
function splitOversized(slice: string, maxChars: number): string[] {
  const parts: string[] = [];
  for (let start = 0; start < slice.length;) {
    let end = Math.min(start + maxChars, slice.length);
    if (end < slice.length) {
      const space = slice.lastIndexOf(" ", end);
      if (space > start) end = space;
    }
    parts.push(slice.slice(start, end));
    start = end;
  }
  return parts;
}

// Cut batches only at entry boundaries: a batch never starts mid-entry, mid-IPA or mid-word,
// and consecutive batches do not overlap. Indexed lists are packed by entry count (target 30,
// hard cap 40); prose without reliable index boundaries packs whole cells up to the character cap.
export function vocabularyChunks(text: string, maxChars = CHUNK_MAX_CHARS): string[] {
  if (!text) return [];
  const { indexed, groups } = layoutEntries(text);
  const chunks: string[] = [];
  let i = 0;
  while (i < groups.length) {
    const start = i === 0 ? 0 : groups[i].start;
    let j = i, words = 0;
    while (j < groups.length) {
      const group = groups[j];
      const groupWords = indexed ? 1 : (text.slice(group.start, group.end).match(alphaTokens)?.length || 1);
      if (j > i && (words >= CHUNK_TARGET_WORDS || words + groupWords > CHUNK_MAX_WORDS || group.end - start > maxChars)) break;
      words += groupWords; j++;
      if (group.end - start >= maxChars || groupWords > CHUNK_MAX_WORDS) break;
    }
    // Include the separator before the next entry so consecutive chunks tile the source exactly.
    const slice = text.slice(start, j < groups.length ? groups[j].start : text.length);
    // A lone entry/cell bigger than the cap (unindexed prose) has no trusted inner boundary;
    // split at whitespace rather than emit an over-budget batch or cut mid-word.
    chunks.push(...(slice.length > maxChars ? splitOversized(slice, maxChars) : [slice]));
    i = j;
  }
  return chunks;
}
export function vocabularyPriority(word: VocabularyWord): number {
  return word.error_count * 5 + new Set(word.sources.map(s => s.import_id)).size * 2 +
    (word.type === "familiar" ? 8 : 0) + (word.enrichment?.value === "high" ? 5 : 0);
}
export function learningQueue(words: VocabularyWord[], now = Date.now(), limit = 25): VocabularyWord[] {
  const due = words.filter(w => w.due_at && Date.parse(w.due_at) <= now)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!) || vocabularyPriority(b) - vocabularyPriority(a));
  const fresh = words.filter(w => !w.due_at && w.status !== "stable").sort((a, b) => vocabularyPriority(b) - vocabularyPriority(a));
  return [...due, ...fresh].slice(0, limit);
}
