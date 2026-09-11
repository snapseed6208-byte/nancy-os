import { HttpError } from "./errors.ts";

export const ENTRY_TYPES = ["new", "familiar", "collocation", "academic", "listening"] as const;
const TYPE_SET = new Set<string>(ENTRY_TYPES);
const WORD_RE = /^\p{Script=Latin}[\p{Script=Latin}\p{M} '\-]{0,119}$/u;
const INDEX_RE = /^\d{1,4}$/;
const SUFFIX_RE = /^(s|es|ed|d|ing|ly|er|est|ies|ied|ying)$/;
const TOKEN_RE = /[\p{Script=Latin}][\p{Script=Latin}\p{M}'’\-]*/gu;
export const MAX_ENTRIES = 150;

export interface Span { span_id: string; text: string }
export interface Reject { index: number; span_id: string | null; field: string; reason: string }
export interface Note { index: number; field: string; detail: string }
export interface Candidate { word: string; original: string; context: string; meaning: string; pos: string; type: string }

// NFKC folds PDF Kangxi-radical homoglyphs (⼈→人) back to normal CJK.
export function fold(value: string): string {
  return value.normalize("NFKC")
    .replace(/[‘’ʼ′]/g, "'")
    .replace(/[‐‑‒–—−]/g, "-");
}
export function normalizeWord(value: string): string {
  return fold(value).replace(/\s+/g, " ").trim().toLowerCase();
}

interface Cell { text: string; start: number; end: number }

// The PDF text layer is flattened onto lines; entries sit in cells separated by newlines or runs of spaces.
function splitCells(text: string): Cell[] {
  const raw: { text: string; start: number }[] = [];
  const re = /(?:\r\n|\r|\n)+|[ \t   ]{2,}/g;
  let cursor = 0; let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > cursor) raw.push({ text: text.slice(cursor, match.index), start: cursor });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) raw.push({ text: text.slice(cursor), start: cursor });
  const cells: Cell[] = [];
  for (const cell of raw) {
    const trimmed = cell.text.trim();
    if (!trimmed) continue;
    const lead = cell.text.length - cell.text.trimStart().length;
    const base = cell.start + lead;
    // A row's trailing "序号" often sticks to the previous definition after one space; pull it out as its own cell.
    const trailing = /^(.*\S)[ \t]+(\d{1,4})$/.exec(trimmed);
    if (trailing) {
      cells.push({ text: trailing[1], start: base, end: base + trailing[1].length });
      cells.push({ text: trailing[2], start: base + trimmed.length - trailing[2].length, end: base + trimmed.length });
    } else {
      cells.push({ text: trimmed, start: base, end: base + trimmed.length });
    }
  }
  return cells;
}

// A leading "序号" cell ("1", "12", …) starts a new entry; enclosing cells belong to it.
function groupEntries(cells: Cell[]): Cell[][] {
  const groups: Cell[][] = [];
  let current: Cell[] | null = null;
  for (const cell of cells) {
    if (!current || INDEX_RE.test(cell.text)) { current = [cell]; groups.push(current); }
    else current.push(cell);
  }
  return groups;
}

function coalesce(groups: Cell[][], max: number): Cell[][] {
  const size = Math.ceil(groups.length / max);
  const out: Cell[][] = [];
  for (let i = 0; i < groups.length; i += size) out.push(groups.slice(i, i + size).flat());
  return out;
}

export function buildSpans(chunk: string, chunkIndex: number, max = 200): Span[] {
  const cells = splitCells(chunk);
  if (!cells.length) return [];
  const hasIndex = cells.some(cell => INDEX_RE.test(cell.text));
  let groups: Cell[][] = hasIndex ? groupEntries(cells) : cells.map(cell => [cell]);
  if (groups.length > max) groups = coalesce(groups, max);
  return groups.map(group => {
    const start = group[0].start, end = group[group.length - 1].end;
    return { span_id: `${chunkIndex}:${start}-${end}`, text: chunk.slice(start, end) };
  });
}

// Program-side provenance: find the raw surface form of a lemma inside its span. No AI attestation.
export function locateOriginal(spanText: string, word: string): { original: string } | null {
  const tokens = [...spanText.matchAll(TOKEN_RE)].map(m => ({ raw: m[0], norm: normalizeWord(m[0]), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  if (!tokens.length) return null;
  const parts = word.split(" ");
  if (parts.length > 1) {
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      if (tokens.slice(i, i + parts.length).map(t => t.norm).join(" ") === word)
        return { original: spanText.slice(tokens[i].start, tokens[i + parts.length - 1].end) };
    }
  }
  const variants = new Set<string>([word]);
  if (word.endsWith("y")) variants.add(`${word.slice(0, -1)}i`);
  if (word.endsWith("e")) variants.add(word.slice(0, -1));
  for (const variant of variants) {
    const exact = tokens.find(t => t.norm === variant);
    if (exact) return { original: exact.raw };
  }
  for (const variant of variants) {
    const inflected = tokens.find(t => t.norm.startsWith(variant) && SUFFIX_RE.test(t.norm.slice(variant.length)));
    if (inflected) return { original: inflected.raw };
  }
  return null;
}

export function selectCandidates(value: unknown, spans: Span[]): { candidates: Candidate[]; rejected: Reject[]; notes: Note[] } {
  const list = (value as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) throw new HttpError(502, "AI 返回结果结构无效，请重试本批次");
  if (list.length > MAX_ENTRIES) throw new HttpError(502, "AI 返回词条数量超出上限");
  const byId = new Map(spans.map(span => [span.span_id, span]));
  const candidates: Candidate[] = []; const rejected: Reject[] = []; const notes: Note[] = [];
  const seen = new Set<string>();
  list.forEach((raw, index) => {
    const reject = (span_id: string | null, field: string, reason: string) => { rejected.push({ index, span_id, field, reason }); };
    if (!raw || typeof raw !== "object") return reject(null, "entry", "not_an_object");
    const e = raw as Record<string, unknown>;
    const spanId = typeof e.span_id === "string" ? e.span_id : null;
    const span = spanId ? byId.get(spanId) : undefined;
    if (!span) return reject(spanId, "span_id", "unknown_span");
    if (typeof e.word !== "string" || !e.word.trim()) return reject(spanId, "word", "missing_word");
    const word = normalizeWord(e.word);
    if (!WORD_RE.test(word)) return reject(spanId, "word", "invalid_word");
    if (!TYPE_SET.has(String(e.type))) return reject(spanId, "type", "invalid_type");
    const located = locateOriginal(span.text, word);
    if (!located) return reject(spanId, "word", "not_in_source_span");
    if (seen.has(word)) { notes.push({ index, field: "word", detail: "duplicate" }); return; }
    seen.add(word);
    const rawMeaning = e.meaning_zh ?? e.meaning ?? "";
    let meaning = typeof rawMeaning === "string" ? rawMeaning : "";
    if (rawMeaning !== undefined && typeof rawMeaning !== "string") notes.push({ index, field: "meaning_zh", detail: "coerced" });
    if (meaning.length > 3000) { meaning = meaning.slice(0, 3000); notes.push({ index, field: "meaning_zh", detail: "truncated" }); }
    let pos = typeof e.pos === "string" ? e.pos : "";
    if (e.pos !== undefined && typeof e.pos !== "string") notes.push({ index, field: "pos", detail: "coerced" });
    if (pos.length > 50) { pos = pos.slice(0, 50); notes.push({ index, field: "pos", detail: "truncated" }); }
    candidates.push({ word, original: located.original, context: span.text, meaning, pos, type: String(e.type) });
  });
  return { candidates, rejected, notes };
}
