// ============================================
// Nancy OS — English Coach AI Service
// Migrated from Expression Builder AI prompts
// ============================================

import { callAI, extractJSON } from "./client";
import {
  EXTRACT_EXPRESSIONS_PROMPT,
  GENERATE_QUESTION_PROMPT,
  SPEAKING_FEEDBACK_PROMPT,
  buildExtractPrompt,
  buildGeneratePrompt,
  buildFeedbackPrompt,
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

export async function analyzeSpeaking(
  prompt: string,
  answer: string,
  targetExpressions: string[] = [],
  authToken: string,
): Promise<SpeakingFeedback> {
  const response = await callAI({
    model: "deepseek-chat",
    maxTokens: 2048,
    messages: [
      { role: "system", content: SPEAKING_FEEDBACK_PROMPT },
      { role: "user", content: buildFeedbackPrompt(prompt, answer, targetExpressions) },
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

// ── 5. build combined feedback string ──

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
