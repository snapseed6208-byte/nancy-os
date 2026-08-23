import { isExpressionLearned } from "@/lib/english/learningStatus";

export const EXPRESSION_CONNECTIONS_PROMPT_VERSION = "expression_connections_v1";
export const EXPRESSION_CONNECTIONS_MODEL = "deepseek-chat";

export const CONNECTION_RELATIONS = ["very_close", "similar", "related", "contrast"] as const;
export const CONNECTION_REGISTERS = ["spoken", "neutral", "formal", "written"] as const;
export const CONNECTION_INTERCHANGEABILITY = ["usually", "sometimes", "rarely"] as const;

export type ConnectionRelation = (typeof CONNECTION_RELATIONS)[number];
export type ConnectionRegister = (typeof CONNECTION_REGISTERS)[number];
export type ConnectionInterchangeability = (typeof CONNECTION_INTERCHANGEABILITY)[number];

export interface ExpressionConnectionRow {
  id: string;
  user_id: string;
  english: string;
  chinese: string | null;
  english_explanation: string | null;
  usage_note: string | null;
  native_usage: string | null;
  context: string | null;
  situation: string | null;
  common_patterns: string | null;
  common_mistakes: string | null;
  synonyms: string | null;
  scene: string | null;
  topic: string | null;
  type: string | null;
  formality: string | null;
  category_id: string | null;
  status: string | null;
  learned_at: string | null;
  archived: boolean | null;
  updated_at: string;
}

export interface RankedCandidate {
  candidateKey: string;
  row: ExpressionConnectionRow;
  semanticScore: number;
}

export interface CachedExpressionConnection {
  expression: string;
  relation: ConnectionRelation;
  difference: string;
  register: ConnectionRegister;
  interchangeability: ConnectionInterchangeability;
  reason?: string;
}

export interface ExpressionConnection extends CachedExpressionConnection {
  learned: boolean;
  expression_id: string | null;
  chinese_meaning: string | null;
}

export interface ExpressionConnectionsAIResponse {
  connections: Array<{
    candidate_key: string;
    relation: ConnectionRelation;
    difference: string;
    register: ConnectionRegister;
    interchangeability: ConnectionInterchangeability;
    reason: string;
  }>;
  external_suggestions: Array<{
    expression: string;
    relation: Exclude<ConnectionRelation, "contrast">;
    difference: string;
    register: ConnectionRegister;
    interchangeability: ConnectionInterchangeability;
    reason?: string;
  }>;
}

export interface ExpressionConnectionCacheRecord {
  source_updated_at: string;
  candidate_fingerprint: string;
  prompt_version: string | null;
  expires_at: string | null;
  connections: unknown;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "to", "with",
  "一个", "一种", "以及", "可以", "用于", "表示", "进行", "这个", "这种", "时候", "某人", "某事",
]);

export function normalizeExpressionText(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function tokens(value: string | null | undefined): Set<string> {
  const normalized = normalizeExpressionText(value || "");
  const result = new Set<string>();
  for (const word of normalized.split(" ")) {
    if (!word || STOP_WORDS.has(word)) continue;
    if (/^[\p{Script=Han}]+$/u.test(word)) {
      if (word.length === 1) result.add(word);
      for (let index = 0; index < word.length - 1; index++) result.add(word.slice(index, index + 2));
    } else if (word.length > 1) {
      result.add(word);
    }
  }
  return result;
}

function overlapScore(left: string | null | undefined, right: string | null | undefined): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.max(a.size, b.size);
}

export function scoreExpressionCandidate(
  source: ExpressionConnectionRow,
  candidate: ExpressionConnectionRow,
): number {
  if (source.id === candidate.id) return Number.NEGATIVE_INFINITY;
  if (normalizeExpressionText(source.english) === normalizeExpressionText(candidate.english)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const sourceSynonyms = normalizeExpressionText(source.synonyms || "");
  const candidateSynonyms = normalizeExpressionText(candidate.synonyms || "");
  const sourceEnglish = normalizeExpressionText(source.english);
  const candidateEnglish = normalizeExpressionText(candidate.english);
  if (sourceSynonyms.includes(candidateEnglish) || candidateSynonyms.includes(sourceEnglish)) score += 100;

  score += overlapScore(source.chinese, candidate.chinese) * 50;
  if (source.category_id && source.category_id === candidate.category_id) score += 16;
  if (source.topic && normalizeExpressionText(source.topic) === normalizeExpressionText(candidate.topic || "")) score += 13;
  if (source.scene && normalizeExpressionText(source.scene) === normalizeExpressionText(candidate.scene || "")) score += 11;
  score += overlapScore(source.usage_note, candidate.usage_note) * 10;
  score += overlapScore(`${source.context || ""} ${source.situation || ""}`, `${candidate.context || ""} ${candidate.situation || ""}`) * 10;
  score += overlapScore(source.english_explanation, candidate.english_explanation) * 8;
  if (source.type && source.type === candidate.type) score += 2;
  if (source.formality && source.formality === candidate.formality) score += 1;
  return Math.round(score * 1000) / 1000;
}

export function retrieveExpressionCandidates(
  source: ExpressionConnectionRow,
  library: ExpressionConnectionRow[],
  limit = 30,
): RankedCandidate[] {
  return library
    .filter((row) => !row.archived && row.id !== source.id)
    .map((row) => ({ row, semanticScore: scoreExpressionCandidate(source, row) }))
    .filter((candidate) => Number.isFinite(candidate.semanticScore) && candidate.semanticScore >= 5)
    .sort((a, b) => b.semanticScore - a.semanticScore || a.row.id.localeCompare(b.row.id))
    .slice(0, limit)
    .map((candidate, index) => ({ ...candidate, candidateKey: `c${index + 1}` }));
}

export async function fingerprintCandidates(candidates: RankedCandidate[]): Promise<string> {
  const payload = [...candidates]
    .sort((a, b) => a.row.id.localeCompare(b.row.id))
    .map(({ row }) => [row.id, row.updated_at, row.english, row.chinese || "", row.usage_note || ""].join("\u001f"))
    .join("\u001e");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isConnectionCacheValid(
  cache: ExpressionConnectionCacheRecord | null,
  sourceUpdatedAt: string,
  candidateFingerprint: string,
  promptVersion = EXPRESSION_CONNECTIONS_PROMPT_VERSION,
  now = new Date(),
): boolean {
  if (!cache) return false;
  if (cache.source_updated_at !== sourceUpdatedAt) return false;
  if (cache.candidate_fingerprint !== candidateFingerprint) return false;
  if (cache.prompt_version !== promptVersion) return false;
  return !cache.expires_at || new Date(cache.expires_at).getTime() > now.getTime();
}

function isEnumValue<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function shortText(value: unknown, maxLength = 420): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, maxLength);
}

export function validateAndGroundAIConnections(
  raw: unknown,
  candidates: RankedCandidate[],
  library: ExpressionConnectionRow[],
): CachedExpressionConnection[] {
  if (!raw || typeof raw !== "object") throw new Error("AI connection response must be an object");
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.connections) || !Array.isArray(body.external_suggestions)) {
    throw new Error("AI connection response is missing arrays");
  }

  const whitelist = new Map(candidates.map((candidate) => [candidate.candidateKey, candidate.row]));
  const libraryByText = new Map(library.map((row) => [normalizeExpressionText(row.english), row]));
  const result: CachedExpressionConnection[] = [];
  const seen = new Set<string>();

  for (const value of body.connections) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const row = whitelist.get(String(item.candidate_key || ""));
    const difference = shortText(item.difference);
    const reason = shortText(item.reason, 240);
    if (!row || !difference || !reason) continue;
    if (!isEnumValue(item.relation, CONNECTION_RELATIONS)) continue;
    if (!isEnumValue(item.register, CONNECTION_REGISTERS)) continue;
    if (!isEnumValue(item.interchangeability, CONNECTION_INTERCHANGEABILITY)) continue;
    const key = normalizeExpressionText(row.english);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      expression: row.english,
      relation: item.relation,
      difference,
      register: item.register,
      interchangeability: item.interchangeability,
      reason,
    });
    if (result.length >= 5) break;
  }

  let externalCount = 0;
  for (const value of body.external_suggestions) {
    if (result.length >= 5 || externalCount >= 2) break;
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const expression = shortText(item.expression, 160);
    const difference = shortText(item.difference);
    const reason = shortText(item.reason, 240) || undefined;
    if (!expression || !difference) continue;
    if (!isEnumValue(item.relation, CONNECTION_RELATIONS) || item.relation === "contrast") continue;
    if (!isEnumValue(item.register, CONNECTION_REGISTERS)) continue;
    if (!isEnumValue(item.interchangeability, CONNECTION_INTERCHANGEABILITY)) continue;
    const key = normalizeExpressionText(expression);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const existing = libraryByText.get(key);
    result.push({
      expression: existing?.english || expression,
      relation: item.relation,
      difference,
      register: item.register,
      interchangeability: item.interchangeability,
      reason,
    });
    externalCount++;
  }
  return result;
}

export function validateCachedConnections(raw: unknown): CachedExpressionConnection[] {
  if (!Array.isArray(raw)) throw new Error("Cached connections must be an array");
  const result: CachedExpressionConnection[] = [];
  for (const value of raw.slice(0, 5)) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const expression = shortText(item.expression, 160);
    const difference = shortText(item.difference);
    const reason = item.reason === undefined ? undefined : shortText(item.reason, 240) || undefined;
    if (!expression || !difference) continue;
    if (!isEnumValue(item.relation, CONNECTION_RELATIONS)) continue;
    if (!isEnumValue(item.register, CONNECTION_REGISTERS)) continue;
    if (!isEnumValue(item.interchangeability, CONNECTION_INTERCHANGEABILITY)) continue;
    result.push({ expression, relation: item.relation, difference, register: item.register, interchangeability: item.interchangeability, reason });
  }
  return result;
}

function relationScore(relation: ConnectionRelation): number {
  return { very_close: 4, similar: 3, related: 2, contrast: 1 }[relation];
}

export function enrichAndRankConnections(
  cached: CachedExpressionConnection[],
  library: ExpressionConnectionRow[],
): ExpressionConnection[] {
  const libraryByText = new Map(library.map((row) => [normalizeExpressionText(row.english), row]));
  return cached
    .map((connection, originalIndex) => {
      const row = libraryByText.get(normalizeExpressionText(connection.expression));
      const learned = isExpressionLearned(row);
      const relevance = relationScore(connection.relation);
      const tier = learned && relevance >= 3 ? 0
        : learned && relevance >= 2 ? 1
          : !learned && relevance === 4 ? 2
            : learned ? 3 : 4;
      return {
        ...connection,
        learned,
        expression_id: row?.id || null,
        chinese_meaning: row?.chinese || (!row ? connection.reason || null : null),
        _tier: tier,
        _relevance: relevance,
        _index: originalIndex,
      };
    })
    .sort((a, b) => a._tier - b._tier || b._relevance - a._relevance || a._index - b._index)
    .map(({ _tier: _tier, _relevance: _relevance, _index: _index, ...connection }) => connection);
}

export function selectLearnConnections(connections: ExpressionConnection[]): ExpressionConnection[] {
  const learned = connections.filter((connection) => connection.learned).slice(0, 2);
  const external = connections.find((connection) => !connection.learned && connection.relation === "very_close");
  return external ? [...learned, external].slice(0, 3) : learned;
}

export function selectReviewConnections(connections: ExpressionConnection[]): ExpressionConnection[] {
  return connections.filter((connection) => connection.relation !== "contrast").slice(0, 2);
}
