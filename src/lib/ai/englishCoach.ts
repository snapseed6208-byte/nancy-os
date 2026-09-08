import { parseSpeakingResponse, speakingObject, type SimplifiedSpeakingFeedback } from "../english/speakingFeedback";
// ============================================
// Nancy OS — English Coach AI Service
// Migrated from Expression Builder AI prompts
// ============================================

import { callAI, extractJSON } from "./client";
import { invokeAI, type AIResult } from "./aiService";
import {
  EXTRACT_EXPRESSIONS_PROMPT,
  GENERATE_QUESTION_PROMPT,
  SPEAKING_FEEDBACK_PROMPT,
  GENERATE_CATEGORY_QUESTION_PROMPT,
  EXPRESSION_PRACTICE_PROMPT,
  SUMMARIZE_PROGRESS_PROMPT,
  GENERATE_CLOZE_PROMPT,
  GENERATE_CONTEXT_CLOZE_PROMPT,
  buildExtractPrompt,
  buildGeneratePrompt,
  buildFeedbackPrompt,
  buildCategoryPrompt,
  buildExpressionPracticePrompt,
  buildRetryFeedbackPrompt,
} from "./prompts";

// ── Types ──

export interface ExtractedExpression {
  english: string;
  chinese: string;
  type: "vocabulary" | "chunk" | "sentencePattern" | "speakingExpression";
  pronunciation?: string;
  exampleSentence?: string;
  scene: string;
  usefulnessLevel: number;
  usageNote?: string;
}

export interface ExtractResult {
  vocabulary: ExtractedExpression[];
  chunks: ExtractedExpression[];
  sentencePatterns: ExtractedExpression[];
  speakingExpressions: ExtractedExpression[];
  notes: { english: string; chinese: string }[];
}

export interface GeneratedQuestion {
  question: string;
  context: string;
  suitableExpressions: string[];
}

export interface SpeakingFeedback extends SimplifiedSpeakingFeedback {
  fluencyScore: number | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  naturalnessScore: number | null;
  mainProblems: string;
  usefulCorrections: string;
  expressionsUsed: string[];
  expressionsMissed: string[];
  contentAnalysis: Record<string, unknown>;
}

// ── 1. analyzeSpeaking / extractExpressions ──

export async function extractExpressions(text: string, authToken: string): Promise<ExtractResult> {
  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 4096,
    messages: [
      { role: "system", content: EXTRACT_EXPRESSIONS_PROMPT },
      { role: "user", content: buildExtractPrompt(text) },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);

  return {
    vocabulary: (raw.vocabulary as ExtractedExpression[]) || [],
    chunks: (raw.chunks as ExtractedExpression[]) || [],
    sentencePatterns: (raw.sentencePatterns as ExtractedExpression[]) || [],
    speakingExpressions: (raw.speakingExpressions as ExtractedExpression[]) || [],
    notes: (raw.notes as { english: string; chinese: string }[]) || [],
  };
}

// ── 2. generateSpeakingQuestion ──

export async function generateSpeakingQuestion(
  expressions: { english: string; chinese: string }[],
  authToken: string,
): Promise<GeneratedQuestion> {
  const exprList = expressions
    .map((e) => `- "${e.english}" (${e.chinese})`)
    .join("\n");

  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 512,
    messages: [
      { role: "system", content: GENERATE_QUESTION_PROMPT },
      { role: "user", content: buildGeneratePrompt(exprList) },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);
  return {
    question: (raw.question as string) || "Describe a recent experience.",
    context: (raw.context as string) || "",
    suitableExpressions: (raw.suitableExpressions as string[]) || [],
  };
}

// ── 3. analyzeSpeaking / generateBetterVersion ──

export interface AnalyzeSpeakingOptions {
  questionContext?: { mode?: string; topic?: string; part?: string };
  /** Previous attempt data for retry context */
  retryContext?: {
    final_upgraded_answer?: string;
    originalAnswer?: string;
    takeaway_expressions?: SimplifiedSpeakingFeedback["takeaway_expressions"];
  };
}

export async function analyzeSpeaking(
  prompt: string,
  answer: string,
  targetExpressions: string[] = [],
  authToken: string,
  opts?: AnalyzeSpeakingOptions,
): Promise<SpeakingFeedback> {
  const systemPrompt = opts?.retryContext
    ? buildRetryFeedbackPrompt(opts.retryContext)
    : SPEAKING_FEEDBACK_PROMPT;

  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildFeedbackPrompt(prompt, answer, targetExpressions, opts?.questionContext) },
    ],
    speakingFeedback: true,
    injectContext: false,
    authToken,
  });

  const result = parseSpeakingResponse(response.content);
  const details = result.detailed_analysis;
  const numeric = (key: string) => typeof details[key] === "number" && Number.isFinite(details[key]) && details[key] >= 0 && details[key] <= 9 ? details[key] as number : null;
  const strings = (key: string) => Array.isArray(details[key]) ? details[key].filter((v): v is string => typeof v === "string" && targetExpressions.includes(v)) : [];
  if (opts?.retryContext) {
    // Ignore accidental generated versions on retry; the learning target is immutable.
    result.final_upgraded_answer = opts.retryContext.final_upgraded_answer || "";
    result.reference_answer = "";
    result.takeaway_expressions = [];
    result.revision_mode = null;
  }
  return {
    ...result,
    fluencyScore: numeric("fluencyScore"), grammarScore: numeric("grammarScore"),
    vocabularyScore: numeric("vocabularyScore"), naturalnessScore: numeric("naturalnessScore"),
    mainProblems: result.key_issues.map(i => i.message).join("\n"),
    usefulCorrections: typeof details.usefulCorrections === "string" ? details.usefulCorrections : "",
    expressionsUsed: strings("expressionsUsed"), expressionsMissed: strings("expressionsMissed"),
    contentAnalysis: speakingObject(details.contentAnalysis),
  };
}

// ── 4. generateBetterVersion (alias focused on rewriting) ──

export async function generateBetterVersion(
  answer: string,
  prompt: string | undefined,
  authToken: string,
): Promise<string> {
  const feedback = await analyzeSpeaking(prompt || "Speaking practice", answer, [], authToken);
  return feedback.final_upgraded_answer;
}

// ── 5. generateCategoryQuestion ──

export async function generateCategoryQuestion(
  category: string,
  subCategory: string,
  expressions: { english: string; chinese: string }[],
  authToken: string,
): Promise<GeneratedQuestion> {
  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 512,
    messages: [
      { role: "system", content: GENERATE_CATEGORY_QUESTION_PROMPT },
      { role: "user", content: buildCategoryPrompt(category, subCategory, expressions) },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);
  return {
    question: (raw.question as string) || "Describe a recent experience.",
    context: (raw.context as string) || "",
    suitableExpressions: (raw.suitableExpressions as string[]) || [],
  };
}

// ── 6. generateExpressionPracticeQuestion ──

export async function generateExpressionPracticeQuestion(
  expressions: { english: string; chinese: string }[],
  authToken: string,
): Promise<{ question: string; context: string; targetCheck: string }> {
  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 512,
    messages: [
      { role: "system", content: EXPRESSION_PRACTICE_PROMPT },
      { role: "user", content: buildExpressionPracticePrompt(expressions) },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);
  return {
    question: (raw.question as string) || "Describe a recent experience using the expressions you've learned.",
    context: (raw.context as string) || "",
    targetCheck: (raw.targetCheck as string) || "",
  };
}

// ── 7. build combined feedback string ──

export function buildCombinedFeedback(fb: SpeakingFeedback): string {
  const sections = [
    fb.mainProblems,
    fb.usefulCorrections,
    fb.optimization_summary,
  ].filter(Boolean);
  return sections.length > 0
    ? sections.join("\n\n---\n\n")
    : "Great effort! Keep practicing and your English will improve.";
}

// ── 8. Progress Summary ──

export interface ProgressSummary {
  commonProblems: string[];
  strengthsObserved: string[];
  suggestion: string;
  summaryText: string;
}

export async function summarizeProgress(
  recentProblems: string[],
  frequentErrors: { original: string; correction: string; count: number }[],
  scoreData: { fluency: number[]; grammar: number[]; vocabulary: number[]; naturalness: number[] },
  authToken: string,
): Promise<ProgressSummary> {
  const problemsText = recentProblems.length > 0
    ? recentProblems.map((p, i) => `Session ${i + 1}:\n${p}`).join("\n\n---\n\n")
    : "No problem data yet.";

  const errorsText = frequentErrors.length > 0
    ? frequentErrors.map((e) => `- "${e.original}" → "${e.correction}" (appeared ${e.count} times)`).join("\n")
    : "No frequent error data yet.";

  const avgFluency = scoreData.fluency.length > 0
    ? (scoreData.fluency.reduce((a, b) => a + b, 0) / scoreData.fluency.length).toFixed(1)
    : "N/A";
  const avgGrammar = scoreData.grammar.length > 0
    ? (scoreData.grammar.reduce((a, b) => a + b, 0) / scoreData.grammar.length).toFixed(1)
    : "N/A";
  const avgVocab = scoreData.vocabulary.length > 0
    ? (scoreData.vocabulary.reduce((a, b) => a + b, 0) / scoreData.vocabulary.length).toFixed(1)
    : "N/A";
  const avgNatural = scoreData.naturalness.length > 0
    ? (scoreData.naturalness.reduce((a, b) => a + b, 0) / scoreData.naturalness.length).toFixed(1)
    : "N/A";

  const scoresText = `Average scores: Fluency ${avgFluency}, Grammar ${avgGrammar}, Vocabulary ${avgVocab}, Naturalness ${avgNatural}. Total sessions analyzed: ${scoreData.fluency.length}`;

  const userMessage = `RECENT PROBLEMS:\n${problemsText}\n\nFREQUENT ERRORS:\n${errorsText}\n\nSCORE DATA:\n${scoresText}`;

  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 1024,
    messages: [
      { role: "system", content: SUMMARIZE_PROGRESS_PROMPT },
      { role: "user", content: userMessage },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);

  return {
    commonProblems: Array.isArray(raw.commonProblems) ? (raw.commonProblems as string[]) : [],
    strengthsObserved: Array.isArray(raw.strengthsObserved) ? (raw.strengthsObserved as string[]) : [],
    suggestion: (raw.suggestion as string) || "",
    summaryText: (raw.summaryText as string) || "",
  };
}

// ── 10. Cloze Sentence Generation ──

export async function generateClozeSentence(
  expression: string,
  exampleSentence: string,
  authToken: string,
): Promise<string> {
  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 256,
    messages: [
      { role: "system", content: GENERATE_CLOZE_PROMPT },
      { role: "user", content: `Expression: "${expression}"\nExample: "${exampleSentence}"\n\nGenerate a cloze sentence.` },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);
  return (raw.clozeSentence as string) || "";
}

// ── 11. Batch Cloze Sentence Generation (V3.6) ──

/**
 * Generate cloze sentences for multiple expressions in one AI call.
 * Used at session start for expressions missing both cloze_sentence and example_sentence.
 */
export async function generateClozeBatch(
  expressions: Array<{ english: string; chinese: string; context?: string | null }>,
  authToken: string,
): Promise<Map<string, string>> {
  if (expressions.length === 0) return new Map();

  const batchPrompt = `Generate one cloze sentence for each expression below.
For each expression, create a natural English sentence where the expression is replaced with "_____".

Return ONLY a JSON object with expression English as keys and cloze sentences as values:
{
  "expression1": "The complete sentence with _____ instead of the expression.",
  ...
}

Context about each expression (if available) is provided to help you create natural sentences.`;

  const exprList = expressions
    .map((e) => {
      const ctx = e.context ? ` (context: ${e.context})` : "";
      return `- "${e.english}" (${e.chinese})${ctx}`;
    })
    .join("\n");

  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: Math.min(expressions.length * 128, 2048),
    messages: [
      { role: "system", content: batchPrompt },
      { role: "user", content: `Expressions:\n${exprList}` },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.includes("_____")) {
      result.set(key, value);
    }
  }

  return result;
}

// ── 12. Generate Cloze Batch via Edge Function (V3.6) ──

export async function generateClozeBatchViaEdge(
  expressions: Array<{ english: string; chinese: string; context?: string | null }>,
): Promise<Map<string, string>> {
  if (expressions.length === 0) return new Map();

  const result = await invokeAI<Record<string, string>>("english-coach", {
    action: "generate_cloze_batch",
    expressions: expressions.map((e) => ({
      english: e.english,
      chinese: e.chinese,
      context: e.context || undefined,
    })),
  });

  const data = result.success ? result.data : null;
  const map = new Map<string, string>();

  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string" && value.includes("_____")) {
        map.set(key, value);
      }
    }
  }

  return map;
}

// ── 13. Personal Sentence Evaluation (V2 strict scoring) ──

import {
  parseSentenceEvaluation,
  type PersonalSentenceEvaluation,
  type SentenceEvaluationInput,
} from "@/lib/english/sentenceEvaluation";
export type { PersonalSentenceEvaluation } from "@/lib/english/sentenceEvaluation";

export async function evaluatePersonalSentence(
  input: SentenceEvaluationInput,
): Promise<AIResult<PersonalSentenceEvaluation>> {
  const result = await invokeAI<unknown>("english-coach", {
    action: "evaluate_personal_sentence",
    ...input,
  }, {
    timeout: 30_000,
    retries: 1,
  });
  if (!result.success) return result;
  try {
    return { success: true, data: parseSentenceEvaluation(result.data) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? `[response_validation] ${error.message}` : "[response_validation] AI response invalid",
    };
  }
}

// ── 14. Context Cloze Generation (V3.4) ──

export interface ContextClozeAIResult {
  expression_id: string;
  scenario_zh: string;
  sentence_full: string;
  answer_form: string;
  explanation_zh: string;
  semantic_hint_zh: string;
}

export interface ContextClozeGenerationInput {
  expression_id: string;
  english: string;
  chinese: string;
  type?: string;
  example_sentence?: string;
  usage_note?: string;
  native_usage?: string;
  context?: string;
  situation?: string;
  common_patterns?: string;
}

/**
 * Generate context cloze cards for a batch of expressions using the AI edge function.
 * V3.5: Single batch request with full ContextClozeCard generation.
 * Returns a Map<expression_id, AI data>.
 */
export async function generateContextClozeBatch(
  expressions: ContextClozeGenerationInput[],
): Promise<Map<string, ContextClozeAIResult>> {
  if (expressions.length === 0) return new Map();

  const result = await invokeAI<{ cards: ContextClozeAIResult[]; missing_ids?: string[] }>("english-coach", {
    action: "generate_context_cloze",
    expressions: expressions.map((e) => ({
      expression_id: e.expression_id,
      english: e.english,
      chinese: e.chinese,
      type: e.type,
      example_sentence: e.example_sentence,
      usage_note: e.usage_note,
      native_usage: e.native_usage,
      context: e.context,
      situation: e.situation,
      common_patterns: e.common_patterns,
    })),
  }, {
    timeout: 90_000,
    retries: 1,
  });

  const map = new Map<string, ContextClozeAIResult>();

  if (result.success && result.data?.cards) {
    for (const card of result.data.cards) {
      if (card && typeof card === "object" && "sentence_full" in card && "answer_form" in card && "expression_id" in card) {
        const typed = card as ContextClozeAIResult;
        map.set(typed.expression_id, typed);
      }
    }
  }

  return map;
}

/**
 * Generate a single context cloze card via AI.
 * V3.5: Uses the same generate_context_cloze batch contract for consistency.
 */
export async function generateSingleContextCloze(
  expression: ContextClozeGenerationInput,
): Promise<Map<string, ContextClozeAIResult>> {
  return generateContextClozeBatch([expression]);
}
