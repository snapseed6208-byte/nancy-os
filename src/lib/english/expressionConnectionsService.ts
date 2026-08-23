import { invokeAI } from "@/lib/ai/aiService";
import { getUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  EXPRESSION_CONNECTIONS_MODEL,
  EXPRESSION_CONNECTIONS_PROMPT_VERSION,
  enrichAndRankConnections,
  fingerprintCandidates,
  isConnectionCacheValid,
  normalizeExpressionText,
  retrieveExpressionCandidates,
  validateAndGroundAIConnections,
  validateCachedConnections,
  type CachedExpressionConnection,
  type ExpressionConnection,
  type ExpressionConnectionCacheRecord,
  type ExpressionConnectionRow,
  type ExpressionConnectionsAIResponse,
  type RankedCandidate,
} from "@/lib/english/expressionConnections";

const EXPRESSION_CONNECTION_SELECT = [
  "id", "user_id", "english", "chinese", "english_explanation", "usage_note", "native_usage",
  "context", "situation", "common_patterns", "common_mistakes", "synonyms", "scene", "topic",
  "type", "formality", "category_id", "status", "learned_at", "archived", "updated_at",
].join(",");

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface ExpressionConnectionsResult {
  connections: ExpressionConnection[];
  cacheHit: boolean;
}

export interface ExpressionConnectionsDependencies {
  loadSourceAndLibrary: typeof loadSourceAndLibrary;
  readCache: typeof readCache;
  writeCache: typeof writeCache;
  requestAI: (source: ExpressionConnectionRow, candidates: RankedCandidate[]) => Promise<ExpressionConnectionsAIResponse>;
}

function sourceForAI(source: ExpressionConnectionRow) {
  return {
    english: source.english, chinese: source.chinese, english_explanation: source.english_explanation,
    usage_note: source.usage_note, native_usage: source.native_usage, context: source.context,
    situation: source.situation, common_patterns: source.common_patterns, common_mistakes: source.common_mistakes,
    scene: source.scene, topic: source.topic, type: source.type, formality: source.formality,
  };
}

function candidatesForAI(candidates: RankedCandidate[]) {
  return candidates.map(({ candidateKey, row }) => ({
    candidate_key: candidateKey, english: row.english, chinese: row.chinese, usage_note: row.usage_note,
    context: row.context, situation: row.situation, scene: row.scene, topic: row.topic,
    type: row.type, formality: row.formality,
  }));
}

async function loadSourceAndLibrary(expressionId: string, userId: string) {
  const [sourceResult, libraryResult] = await Promise.all([
    supabase.from("expressions").select(EXPRESSION_CONNECTION_SELECT)
      .eq("id", expressionId).eq("user_id", userId).eq("archived", false).single(),
    supabase.from("expressions").select(EXPRESSION_CONNECTION_SELECT)
      .eq("user_id", userId).eq("archived", false),
  ]);
  if (sourceResult.error) throw sourceResult.error;
  if (libraryResult.error) throw libraryResult.error;
  return {
    source: sourceResult.data as unknown as ExpressionConnectionRow,
    library: (libraryResult.data || []) as unknown as ExpressionConnectionRow[],
  };
}

async function readCache(expressionId: string, userId: string): Promise<ExpressionConnectionCacheRecord | null> {
  const { data, error } = await supabase.from("expression_connection_cache")
    .select("source_updated_at,candidate_fingerprint,prompt_version,expires_at,connections")
    .eq("user_id", userId).eq("source_expression_id", expressionId).maybeSingle();
  if (error) throw error;
  return data as ExpressionConnectionCacheRecord | null;
}

async function writeCache(
  expressionId: string,
  userId: string,
  sourceUpdatedAt: string,
  candidateFingerprint: string,
  connections: CachedExpressionConnection[],
) {
  const now = new Date();
  const { error } = await supabase.from("expression_connection_cache").upsert({
    user_id: userId,
    source_expression_id: expressionId,
    source_updated_at: sourceUpdatedAt,
    candidate_fingerprint: candidateFingerprint,
    connections,
    model: EXPRESSION_CONNECTIONS_MODEL,
    prompt_version: EXPRESSION_CONNECTIONS_PROMPT_VERSION,
    generated_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  }, { onConflict: "user_id,source_expression_id" });
  if (error) throw error;
}

async function requestAI(source: ExpressionConnectionRow, candidates: RankedCandidate[]) {
  const aiResult = await invokeAI<ExpressionConnectionsAIResponse>("english-coach", {
    action: "generate_expression_connections",
    prompt_version: EXPRESSION_CONNECTIONS_PROMPT_VERSION,
    source_expression: sourceForAI(source),
    candidates: candidatesForAI(candidates),
  }, { timeout: 45_000, retries: 1 });
  if (!aiResult.success) throw new Error(aiResult.error);
  return aiResult.data;
}

const defaultDependencies: ExpressionConnectionsDependencies = {
  loadSourceAndLibrary,
  readCache,
  writeCache,
  requestAI,
};

export async function resolveExpressionConnections(
  expressionId: string,
  userId: string,
  dependencies: ExpressionConnectionsDependencies = defaultDependencies,
): Promise<ExpressionConnectionsResult> {
  const { source, library } = await dependencies.loadSourceAndLibrary(expressionId, userId);
  const candidates = retrieveExpressionCandidates(source, library);
  const candidateFingerprint = await fingerprintCandidates(candidates);
  const cache = await dependencies.readCache(expressionId, userId);

  if (isConnectionCacheValid(cache, source.updated_at, candidateFingerprint)) {
    try {
      return { connections: enrichAndRankConnections(validateCachedConnections(cache!.connections), library), cacheHit: true };
    } catch {
      // Invalid legacy/corrupt cache is regenerated below.
    }
  }

  const aiData = await dependencies.requestAI(source, candidates);
  const grounded = validateAndGroundAIConnections(aiData, candidates, library);
  await dependencies.writeCache(expressionId, userId, source.updated_at, candidateFingerprint, grounded);
  return { connections: enrichAndRankConnections(grounded, library), cacheHit: false };
}

export async function getExpressionConnections(expressionId: string): Promise<ExpressionConnectionsResult> {
  return resolveExpressionConnections(expressionId, await getUserId());
}

export async function findExistingExpressionByText(expression: string): Promise<ExpressionConnectionRow | null> {
  const userId = await getUserId();
  const { data, error } = await supabase.from("expressions").select(EXPRESSION_CONNECTION_SELECT)
    .eq("user_id", userId).eq("archived", false);
  if (error) throw error;
  const normalized = normalizeExpressionText(expression);
  return ((data || []) as unknown as ExpressionConnectionRow[])
    .find((row) => normalizeExpressionText(row.english) === normalized) || null;
}
