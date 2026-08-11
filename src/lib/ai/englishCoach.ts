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
  GENERATE_REFERENCE_ANSWER_PROMPT,
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

export interface ExpressionUpgrade {
  english: string;
  chinese: string;
  type: "vocabulary" | "chunk" | "sentencePattern" | "speakingExpression";
  scene: string;
  exampleSentence: string;
  formality: "casual" | "semi-formal" | "formal";
  usageNote: string;
  sourceChunk: string;
}

export interface ContentAnalysis {
  relevanceScore: number;
  coherenceScore: number;
  developmentScore: number;
  relevanceLevel: string;
  coherenceLevel: string;
  developmentLevel: string;
  summary: string;
  questionRequirements: string[];
  answeredRequirements: string[];
  missedRequirements: string[];
  offTopicParts: string[];
  repetition: string[];
  orderProblems: string[];
  contentGaps: string[];
  recommendedOrder: string[];
  // Phase 6: Final High-score Answer fields
  diagnosis?: string;
  keyImprovements?: string[];
}

export interface AnswerStructureStep {
  step: string;
  label: string;
  content: string;
}

export interface KeyUpgrade {
  english: string;
  chinese: string;
  reason: string;
}

export interface SpeakingFeedback {
  naturalVersion: string;
  fluencyScore: number;
  grammarScore: number;
  vocabularyScore: number;
  naturalnessScore: number;
  mainProblems: string;
  usefulCorrections: string;
  betterChunks: string;
  oneBetterExample: string;
  expressionsUsed: string[];
  expressionsMissed: string[];
  expressionUpgrade: ExpressionUpgrade[];
  // Phase 6: Content & Structure fields (optional for backward compatibility)
  contentAnalysis?: ContentAnalysis;
  answerStructure?: AnswerStructureStep[];
  finalHighScoreAnswer?: string;
  diagnosis?: string;
  keyImprovements?: string[];
  keyUpgrades?: KeyUpgrade[];
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

function safeContentAnalysis(raw: Record<string, unknown>): ContentAnalysis {
  const ca = (raw.contentAnalysis as Record<string, unknown>) || {};
  const arr = (key: string): string[] => Array.isArray(ca[key]) ? (ca[key] as string[]) : [];
  return {
    relevanceScore: typeof ca.relevanceScore === "number" ? ca.relevanceScore : 0,
    coherenceScore: typeof ca.coherenceScore === "number" ? ca.coherenceScore : 0,
    developmentScore: typeof ca.developmentScore === "number" ? ca.developmentScore : 0,
    relevanceLevel: (ca.relevanceLevel as string) || "",
    coherenceLevel: (ca.coherenceLevel as string) || "",
    developmentLevel: (ca.developmentLevel as string) || "",
    summary: (ca.summary as string) || "",
    questionRequirements: arr("questionRequirements"),
    answeredRequirements: arr("answeredRequirements"),
    missedRequirements: arr("missedRequirements"),
    offTopicParts: arr("offTopicParts"),
    repetition: arr("repetition"),
    orderProblems: arr("orderProblems"),
    contentGaps: arr("contentGaps"),
    recommendedOrder: arr("recommendedOrder"),
    diagnosis: typeof ca.diagnosis === "string" ? ca.diagnosis : "",
    keyImprovements: arr("keyImprovements"),
  };
}

function safeAnswerStructure(raw: Record<string, unknown>): AnswerStructureStep[] {
  const arr = raw.answerStructure;
  if (!Array.isArray(arr)) return [];
  return arr.map((s: unknown) => {
    const step = s as Record<string, unknown>;
    return {
      step: (step.step as string) || "",
      label: (step.label as string) || "",
      content: (step.content as string) || "",
    };
  });
}

function safeKeyUpgrades(raw: Record<string, unknown>): KeyUpgrade[] {
  const arr = raw.keyUpgrades;
  if (!Array.isArray(arr)) return [];
  return arr.map((k: unknown) => {
    const ku = k as Record<string, unknown>;
    return {
      english: (ku.english as string) || "",
      chinese: (ku.chinese as string) || "",
      reason: (ku.reason as string) || "",
    };
  });
}

export interface AnalyzeSpeakingOptions {
  questionContext?: { mode?: string; topic?: string; part?: string };
  /** Previous attempt data for retry context */
  retryContext?: {
    answerStructure?: AnswerStructureStep[];
    finalHighScoreAnswer?: string;
    keyUpgrades?: KeyUpgrade[];
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
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);

  return {
    naturalVersion: (raw.naturalVersion as string) || answer,
    fluencyScore: typeof raw.fluencyScore === "number" ? raw.fluencyScore : 0,
    grammarScore: typeof raw.grammarScore === "number" ? raw.grammarScore : 0,
    vocabularyScore: typeof raw.vocabularyScore === "number" ? raw.vocabularyScore : 0,
    naturalnessScore: typeof raw.naturalnessScore === "number" ? raw.naturalnessScore : 0,
    mainProblems: (raw.mainProblems as string) || "",
    usefulCorrections: (raw.usefulCorrections as string) || "",
    betterChunks: (raw.betterChunks as string) || "",
    oneBetterExample: (raw.oneBetterExample as string) || "",
    expressionsUsed: Array.isArray(raw.expressionsUsed) ? (raw.expressionsUsed as string[]) : [],
    expressionsMissed: Array.isArray(raw.expressionsMissed) ? (raw.expressionsMissed as string[]) : [],
    expressionUpgrade: Array.isArray(raw.expressionUpgrade)
      ? (raw.expressionUpgrade as ExpressionUpgrade[])
      : [],
    contentAnalysis: safeContentAnalysis(raw),
    answerStructure: safeAnswerStructure(raw),
    finalHighScoreAnswer: (raw.finalHighScoreAnswer as string) || (raw.structuredBetterAnswer as string) || "",
    diagnosis: (raw.diagnosis as string) || "",
    keyImprovements: Array.isArray(raw.keyImprovements) ? (raw.keyImprovements as string[]) : [],
    keyUpgrades: safeKeyUpgrades(raw),
  };
}

// ── 4. generateBetterVersion (alias focused on rewriting) ──

export async function generateBetterVersion(
  answer: string,
  prompt: string | undefined,
  authToken: string,
): Promise<string> {
  const feedback = await analyzeSpeaking(prompt || "Speaking practice", answer, [], authToken);
  return feedback.naturalVersion;
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
    fb.betterChunks,
    fb.oneBetterExample,
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

// ── 9. Reference Answer Generation ──

export async function generateReferenceAnswer(
  question: string,
  authToken: string,
): Promise<string> {
  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 512,
    messages: [
      { role: "system", content: GENERATE_REFERENCE_ANSWER_PROMPT },
      { role: "user", content: `Speaking question: ${question}\n\nGenerate a natural model answer.` },
    ],
    injectContext: true,
    authToken,
  });

  const raw = extractJSON(response.content, {} as Record<string, unknown>);
  return (raw.referenceAnswer as string) || "";
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

// ── 13. Personal Sentence Evaluation (V3.6) ──

export interface PersonalSentenceEvaluation {
  grammar_correct: boolean;
  naturalness: "natural" | "slightly_unnatural" | "awkward" | "incorrect";
  corrections: Array<{ original: string; corrected: string; explanation: string }>;
  overall_feedback: string;
  expression_used_correctly: boolean;
  example_usage?: string;
}

export async function evaluatePersonalSentence(
  expression: string,
  userSentence: string,
  safeContext?: string,
): Promise<AIResult<PersonalSentenceEvaluation>> {
  return invokeAI<PersonalSentenceEvaluation>("english-coach", {
    action: "evaluate_personal_sentence",
    expression,
    user_sentence: userSentence,
    safe_context: safeContext || "",
  }, {
    timeout: 30_000,
    retries: 1,
  });
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
