export type SentenceVerdict = "natural" | "acceptable" | "needs_revision";
export type SentencePrimaryIssue =
  | "none"
  | "meaning"
  | "structure"
  | "collocation"
  | "context"
  | "grammar"
  | "naturalness";

export interface SentenceGrammarIssue {
  original: string;
  correction: string;
  explanation: string;
}

export interface PersonalSentenceEvaluation {
  verdict: SentenceVerdict;
  expression_mastery: {
    meaning: "correct" | "partial" | "incorrect";
    structure: "correct" | "incorrect";
    collocation: "natural" | "acceptable" | "unnatural";
    context_fit: "natural" | "acceptable" | "inappropriate";
  };
  grammar: {
    correct: boolean;
    issues: SentenceGrammarIssue[];
  };
  naturalness: {
    level: "natural" | "understandable_but_non_native" | "unnatural";
    reason: string;
  };
  primary_issue: SentencePrimaryIssue;
  feedback: string;
  minimal_revision: string;
  natural_version: string;
  usage_tip: string;
  expression_used_correctly: boolean;
}

export interface SentenceEvaluationInput {
  expression_id?: string;
  expression: string;
  meaning: string;
  expression_type?: string;
  english_explanation?: string;
  usage_note?: string;
  native_usage?: string;
  common_patterns?: string;
  context?: string;
  situation?: string;
  synonyms?: string;
  common_mistakes?: string;
  example_sentence?: string;
  cloze_sentence?: string;
  memory_tip?: string;
  user_sentence: string;
}

export class SentenceEvaluationValidationError extends Error {
  readonly stage = "response_validation";

  constructor(message: string) {
    super(message);
    this.name = "SentenceEvaluationValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string") throw new SentenceEvaluationValidationError(`${path} must be a string`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new SentenceEvaluationValidationError(`${path} must not be empty`);
  return normalized;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new SentenceEvaluationValidationError(`${path} is invalid`);
  }
  return value as T;
}

export function deriveSentenceVerdict(
  evaluation: Pick<PersonalSentenceEvaluation, "expression_mastery" | "grammar" | "naturalness" | "expression_used_correctly">,
): SentenceVerdict {
  const mastery = evaluation.expression_mastery;
  if (
    !evaluation.expression_used_correctly
    || mastery.meaning === "incorrect"
    || mastery.structure === "incorrect"
    || mastery.collocation === "unnatural"
    || mastery.context_fit === "inappropriate"
    || !evaluation.grammar.correct
    || evaluation.naturalness.level === "unnatural"
  ) return "needs_revision";

  if (
    mastery.meaning === "partial"
    || mastery.collocation === "acceptable"
    || mastery.context_fit === "acceptable"
    || evaluation.naturalness.level === "understandable_but_non_native"
  ) return "acceptable";

  return "natural";
}

export function sentenceScoreForVerdict(verdict: SentenceVerdict): number {
  if (verdict === "natural") return 5;
  if (verdict === "acceptable") return 3;
  return 1;
}

export function parseSentenceEvaluation(raw: unknown): PersonalSentenceEvaluation {
  if (!isRecord(raw)) throw new SentenceEvaluationValidationError("response must be an object");
  const mastery = raw.expression_mastery;
  const grammar = raw.grammar;
  const naturalness = raw.naturalness;
  if (!isRecord(mastery)) throw new SentenceEvaluationValidationError("expression_mastery is required");
  if (!isRecord(grammar)) throw new SentenceEvaluationValidationError("grammar is required");
  if (!isRecord(naturalness)) throw new SentenceEvaluationValidationError("naturalness is required");
  if (typeof grammar.correct !== "boolean") throw new SentenceEvaluationValidationError("grammar.correct must be boolean");
  if (typeof raw.expression_used_correctly !== "boolean") {
    throw new SentenceEvaluationValidationError("expression_used_correctly must be boolean");
  }
  if (!Array.isArray(grammar.issues)) throw new SentenceEvaluationValidationError("grammar.issues must be an array");

  const issues = grammar.issues.map((issue, index) => {
    if (!isRecord(issue)) throw new SentenceEvaluationValidationError(`grammar.issues[${index}] must be an object`);
    return {
      original: requiredString(issue.original, `grammar.issues[${index}].original`),
      correction: requiredString(issue.correction, `grammar.issues[${index}].correction`),
      explanation: requiredString(issue.explanation, `grammar.issues[${index}].explanation`),
    };
  });
  if (!grammar.correct && issues.length === 0) {
    throw new SentenceEvaluationValidationError("grammar.issues must describe an incorrect grammar result");
  }

  const parsed: PersonalSentenceEvaluation = {
    verdict: enumValue(raw.verdict, ["natural", "acceptable", "needs_revision"] as const, "verdict"),
    expression_mastery: {
      meaning: enumValue(mastery.meaning, ["correct", "partial", "incorrect"] as const, "expression_mastery.meaning"),
      structure: enumValue(mastery.structure, ["correct", "incorrect"] as const, "expression_mastery.structure"),
      collocation: enumValue(mastery.collocation, ["natural", "acceptable", "unnatural"] as const, "expression_mastery.collocation"),
      context_fit: enumValue(mastery.context_fit, ["natural", "acceptable", "inappropriate"] as const, "expression_mastery.context_fit"),
    },
    grammar: { correct: grammar.correct, issues },
    naturalness: {
      level: enumValue(naturalness.level, ["natural", "understandable_but_non_native", "unnatural"] as const, "naturalness.level"),
      reason: requiredString(naturalness.reason, "naturalness.reason"),
    },
    primary_issue: enumValue(raw.primary_issue, ["none", "meaning", "structure", "collocation", "context", "grammar", "naturalness"] as const, "primary_issue"),
    feedback: requiredString(raw.feedback, "feedback"),
    minimal_revision: requiredString(raw.minimal_revision, "minimal_revision", true),
    natural_version: requiredString(raw.natural_version, "natural_version"),
    usage_tip: requiredString(raw.usage_tip, "usage_tip"),
    expression_used_correctly: raw.expression_used_correctly,
  };

  const hardGateVerdict = deriveSentenceVerdict(parsed);
  const severity = { natural: 0, acceptable: 1, needs_revision: 2 } as const;
  if (severity[hardGateVerdict] > severity[parsed.verdict]) parsed.verdict = hardGateVerdict;
  return parsed;
}
