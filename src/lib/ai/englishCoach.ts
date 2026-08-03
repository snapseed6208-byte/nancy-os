// ============================================
// Nancy OS — English Coach AI Service
// Migrated from Expression Builder AI prompts
// ============================================

import { callAI, extractJSON } from "./client";
import {
  EXTRACT_EXPRESSIONS_PROMPT,
  GENERATE_QUESTION_PROMPT,
  SPEAKING_FEEDBACK_PROMPT,
  GENERATE_CATEGORY_QUESTION_PROMPT,
  EXPRESSION_PRACTICE_PROMPT,
  SUMMARIZE_PROGRESS_PROMPT,
  GENERATE_REFERENCE_ANSWER_PROMPT,
  GENERATE_CLOZE_PROMPT,
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
  structuredBetterAnswer?: string;
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
    structuredBetterAnswer?: string;
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
    structuredBetterAnswer: (raw.structuredBetterAnswer as string) || "",
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
