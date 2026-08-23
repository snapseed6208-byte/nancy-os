import { describe, expect, it } from "vitest";
import {
  deriveSentenceVerdict,
  parseSentenceEvaluation,
  sentenceScoreForVerdict,
  type PersonalSentenceEvaluation,
} from "@/lib/english/sentenceEvaluation";

function evaluation(overrides: Partial<PersonalSentenceEvaluation> = {}): PersonalSentenceEvaluation {
  return {
    verdict: "natural",
    expression_mastery: {
      meaning: "correct",
      structure: "correct",
      collocation: "natural",
      context_fit: "natural",
      ...overrides.expression_mastery,
    },
    grammar: { correct: true, issues: [], ...overrides.grammar },
    naturalness: { level: "natural", reason: "A native speaker could naturally say this.", ...overrides.naturalness },
    primary_issue: "none",
    feedback: "目标表达的含义、结构和语境都准确。",
    minimal_revision: "",
    natural_version: "I took it upon myself to organize the event when no one else volunteered.",
    usage_tip: "用于主动承担原本没有明确分配给自己的责任。",
    expression_used_correctly: true,
    ...overrides,
  };
}

describe("Sentence Scoring V2 hard gates", () => {
  it("allows GREEN only when every core criterion passes", () => {
    const result = parseSentenceEvaluation(evaluation());
    expect(result.verdict).toBe("natural");
    expect(sentenceScoreForVerdict(result.verdict)).toBe(5);
  });

  it("CASE A: correct pattern but atypical responsibility context is YELLOW", () => {
    const result = parseSentenceEvaluation(evaluation({
      verdict: "acceptable",
      expression_mastery: {
        meaning: "correct",
        structure: "correct",
        collocation: "acceptable",
        context_fit: "acceptable",
      },
      naturalness: { level: "understandable_but_non_native", reason: "Admitting one's own mistake is already expected responsibility." },
      primary_issue: "context",
      feedback: "句型正确，但这个语境没有充分体现主动承担未分配责任。",
      minimal_revision: "I took it upon myself to explain the mistake to the client and find a solution.",
    }));
    expect(result.verdict).toBe("acceptable");
    expect(result.verdict).not.toBe("natural");
  });

  it("CASE B: malformed target phrase and whole-sentence grammar are RED", () => {
    const result = parseSentenceEvaluation(evaluation({
      verdict: "needs_revision",
      expression_mastery: { meaning: "incorrect", structure: "incorrect", collocation: "unnatural", context_fit: "inappropriate" },
      grammar: {
        correct: false,
        issues: [
          { original: "You all fit", correction: "your outfit", explanation: "目标表达结构错误" },
          { original: "the skirt it is", correction: "the skirt is", explanation: "重复主语" },
        ],
      },
      naturalness: { level: "unnatural", reason: "The sentence contains clear structure errors." },
      primary_issue: "structure",
      expression_used_correctly: false,
      minimal_revision: "Wow, your outfit is everything! Look at how shiny the skirt is.",
      natural_version: "Wow, your outfit is everything! Look at how shiny that skirt is.",
    }));
    expect(result.verdict).toBe("needs_revision");
    expect(sentenceScoreForVerdict(result.verdict)).toBe(1);
  });

  it.each([
    ["target meaning misunderstood", { expression_mastery: { meaning: "incorrect", structure: "correct", collocation: "natural", context_fit: "natural" }, primary_issue: "meaning" }],
    ["target structure wrong but understandable", { expression_mastery: { meaning: "correct", structure: "incorrect", collocation: "natural", context_fit: "natural" }, primary_issue: "structure" }],
    ["target collocation wrong", { expression_mastery: { meaning: "correct", structure: "correct", collocation: "unnatural", context_fit: "natural" }, primary_issue: "collocation" }],
    ["context inappropriate", { expression_mastery: { meaning: "correct", structure: "correct", collocation: "natural", context_fit: "inappropriate" }, primary_issue: "context" }],
    ["target expression not actually used", { expression_used_correctly: false, primary_issue: "structure" }],
    ["synonym used instead of target", { expression_used_correctly: false, primary_issue: "structure" }],
    ["grammar error outside target phrase", { grammar: { correct: false, issues: [{ original: "I very like", correction: "I really like", explanation: "副词位置错误" }] }, primary_issue: "grammar" }],
    ["target correct but sentence semantically weird", { expression_mastery: { meaning: "correct", structure: "correct", collocation: "natural", context_fit: "inappropriate" }, primary_issue: "context" }],
  ])("forces RED when %s", (_label, overrides) => {
    expect(deriveSentenceVerdict(evaluation(overrides as Partial<PersonalSentenceEvaluation>))).toBe("needs_revision");
  });

  it("keeps technically grammatical but Chinese-like wording YELLOW", () => {
    const result = parseSentenceEvaluation(evaluation({
      verdict: "acceptable",
      naturalness: { level: "understandable_but_non_native", reason: "The wording follows a Chinese discourse pattern." },
      primary_issue: "naturalness",
    }));
    expect(result.verdict).toBe("acceptable");
  });

  it("keeps register mismatch YELLOW when meaning and structure remain correct", () => {
    const result = parseSentenceEvaluation(evaluation({
      verdict: "acceptable",
      expression_mastery: { meaning: "correct", structure: "correct", collocation: "acceptable", context_fit: "acceptable" },
      naturalness: { level: "understandable_but_non_native", reason: "The phrase is too formal for casual chat." },
      primary_issue: "context",
    }));
    expect(result.verdict).toBe("acceptable");
  });

  it("does not let encouragement override a real grammar error", () => {
    const result = parseSentenceEvaluation(evaluation({
      verdict: "natural",
      grammar: { correct: false, issues: [{ original: "I take it upon myself fix it", correction: "I take it upon myself to fix it", explanation: "固定结构需要 to" }] },
      primary_issue: "grammar",
      feedback: "思路是对的，你很努力。",
    }));
    expect(result.verdict).toBe("needs_revision");
  });

  it("rejects malformed JSON-shaped output", () => {
    expect(() => parseSentenceEvaluation("not json")).toThrow(/object/);
  });

  it("rejects a response with a required field missing", () => {
    const incomplete = evaluation() as unknown as Record<string, unknown>;
    delete incomplete.expression_mastery;
    expect(() => parseSentenceEvaluation(incomplete)).toThrow(/expression_mastery/);
  });
});
