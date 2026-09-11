import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReanalyzeInput, buildRetryContext, reanalyzeTranscript, reanalyzedAttemptPayload } from "../lib/english/speakingReanalyze";
import { normalizeSpeakingFeedback } from "../lib/english/speakingFeedback";
import type { SpeakingFeedback } from "../lib/ai/englishCoach";

const page = readFileSync(join(process.cwd(), "src/pages/EnglishSpeaking.tsx"), "utf8");
const hooks = readFileSync(join(process.cwd(), "src/lib/hooks/useEnglish.ts"), "utf8");

// Re-analysis replays stored material. Anything that is not a real transcript must be rejected:
// re-running with a placeholder would let the model "analyze" a sentence that was never spoken.
describe("re-analysis only runs on a real stored transcript", () => {
  it("prefers the transcription over the raw answer", () => {
    expect(reanalyzeTranscript({ transcribed_text: "I went there.", answer: "raw" })).toBe("I went there.");
  });
  it("falls back to the answer only when it is a genuine typed answer", () => {
    expect(reanalyzeTranscript({ transcribed_text: "   ", answer: "I think so." })).toBe("I think so.");
  });
  it("refuses the voice-recording placeholder that voice-only saves wrote", () => {
    expect(reanalyzeTranscript({ answer: "[Voice recording on: Describe your hometown]" })).toBe("");
    expect(reanalyzeTranscript({ transcribed_text: null, answer: "[Voice Recording saved]" })).toBe("");
  });
  it("returns empty for rows with nothing usable or malformed shapes", () => {
    for (const raw of [null, undefined, [], "text", {}, { transcribed_text: 7, answer: {} }]) {
      expect(reanalyzeTranscript(raw)).toBe("");
    }
  });
});

// The replayed call must be given the same inputs the original call had — rebuilt from what the
// session and its linked question actually persisted, never re-invented.
describe("the replayed call rebuilds the original inputs", () => {
  it("reads the prompt, targets and context from the stored session", () => {
    const input = buildReanalyzeInput({
      prompt: "Describe your hometown.",
      recommended_expressions: [{ english: "be located in" }, { english: "  " }, { english: "grow up" }],
      category: "daily_small_talk",
      context: "Friendly chat with a classmate.",
    }, { topic: "Hometown", part: "2" });
    expect(input.question).toBe("Describe your hometown.");
    expect(input.targets).toEqual(["be located in", "grow up"]);
    expect(input.questionContext).toEqual({
      mode: "daily_small_talk",
      topic: "Hometown",
      part: "2",
      scenario: "Friendly chat with a classmate.",
    });
  });
  it("leaves absent context undefined instead of inventing placeholders", () => {
    const input = buildReanalyzeInput({ prompt: "Q" });
    expect(input.targets).toEqual([]);
    expect(input.questionContext).toEqual({ mode: undefined, topic: undefined, part: undefined, scenario: undefined });
    expect(buildReanalyzeInput({ prompt: "Q" }, {}).questionContext.part).toBeUndefined();
  });
  it("prefers session.mode then session.scenario when category/context are missing", () => {
    const input = buildReanalyzeInput({ prompt: "Q", mode: "ielts_part2", scenario: "Exam room" });
    expect(input.questionContext.mode).toBe("ielts_part2");
    expect(input.questionContext.scenario).toBe("Exam room");
  });
});

// A retry row is graded against the first round's answer. That answer is the immutable learning
// target, so a retry without it must not be re-analysed — it would silently produce a new "best".
describe("a retry row can only be replayed against the first round's best answer", () => {
  it("refuses when there is no first row or it has no best answer", () => {
    expect(buildRetryContext(undefined)).toBeNull();
    expect(buildRetryContext({ transcribed_text: "T" })).toBeNull();
    expect(buildRetryContext({ transcribed_text: "T", final_upgraded_answer: "   " })).toBeNull();
  });
  it("carries the immutable target, the original transcript and the round-one structure", () => {
    const ctx = buildRetryContext({
      transcribed_text: "I like to combine strengths with my team.",
      final_upgraded_answer: "I like to combine strengths with my team.",
      takeaway_expressions: [{ expression: "combine strengths", meaning: "结合优势", why_useful: "团队话题" }],
      answerStructure: [{ label: "Stance", content: "先给观点" }],
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.final_upgraded_answer).toBe("I like to combine strengths with my team.");
    expect(ctx!.originalAnswer).toBe("I like to combine strengths with my team.");
    expect(ctx!.takeaway_expressions.map(t => t.expression)).toEqual(["combine strengths"]);
    expect(ctx!.answer_structure.map(s => s.label)).toEqual(["Stance"]);
  });
});

// The payload overwrites only feedback-derived columns. Round identity, retry linkage, transcript
// and audio describe the original recording and must survive the rewrite untouched.
describe("the in-place update rewrites feedback and nothing else", () => {
  const feedback: SpeakingFeedback = {
    ...normalizeSpeakingFeedback({
      final_upgraded_answer: "Better answer.",
      reference_answer: "Independent angle.",
      detailed_analysis: { contentAnalysis: { relevanceScore: 8 } },
    }),
    fluencyScore: 7, grammarScore: 6, vocabularyScore: null, naturalnessScore: null,
    mainProblems: "", usefulCorrections: "", expressionsUsed: [], expressionsMissed: [], contentAnalysis: {},
  };

  it("writes the new feedback back into the same storage contract", () => {
    const payload = reanalyzedAttemptPayload(feedback);
    expect((payload.content_analysis as Record<string, unknown>).feedback_v2).toBe(feedback);
    expect(payload.fluency_score).toBe(7);
    expect(payload.grammar_score).toBe(6);
    expect(payload.structured_better_answer).toBe("Better answer.");
    expect(payload.expressions_used).toEqual([]);
    expect(payload.expressions_missed).toEqual([]);
  });
  it("never carries ownership, round or media fields", () => {
    const payload = reanalyzedAttemptPayload(feedback);
    for (const key of ["transcribed_text", "answer", "audio_url", "audio_duration", "session_id", "user_id", "is_retry", "attempt_round", "retry_of_attempt_id", "created_at"]) {
      expect(payload).not.toHaveProperty(key);
    }
  });
  it("stores null rather than zero for a dimension the model did not score", () => {
    const payload = reanalyzedAttemptPayload({
      ...feedback, fluencyScore: null, grammarScore: null,
      vocabularyScore: null, naturalnessScore: null, mainProblems: "", usefulCorrections: "",
    });
    expect(payload.vocabulary_score).toBeNull();
    expect(payload.naturalness_score).toBeNull();
    expect(payload.main_problems).toBeNull();
  });
});

// Re-analysis spends a real model call, so it must be click-only and must update in place.
describe("re-analysis is a manual, in-place action", () => {
  it("the entry point is a button wired to a click handler, never an effect", () => {
    expect(page).toContain("重新分析这条记录");
    expect(page).toContain("onClick={() => void runReanalyze(row, isRetry)}");
    expect(page).toMatch(/disabled=\{busy \|\| !!blocker\}/);
    expect(page).not.toMatch(/useEffect\([\s\S]{0,600}runReanalyze/);
  });
  it("replays through analyzeSpeaking with the rebuilt inputs and the retry context", () => {
    expect(page).toContain("buildReanalyzeInput(s as Record<string, unknown>, questionQuery.data)");
    expect(page).toContain("buildRetryContext(firstAttempt)");
    expect(page).toMatch(/analyzeSpeaking\(\s*input\.question,\s*reanalyzeTranscript\(row\)/);
  });
  it("writes back by updating the existing row, not by inserting a new attempt", () => {
    expect(page).toContain("reanalyzedAttemptPayload(result)");
    expect(page).toContain("attemptId: attemptId(row)");
    expect(hooks).toContain('.from("speaking_attempts")');
    expect(hooks).toContain(".update(input.payload)");
    expect(hooks).toContain('.eq("id", input.attemptId)');
    expect(hooks).not.toMatch(/useUpdateSpeakingAttempt[\s\S]{0,600}\.insert\(/);
  });
  it("explains why a row cannot be replayed instead of offering a dead button", () => {
    for (const hint of ["没有转录文本", "没有存下题目", "缺少首轮的优化版本"]) {
      expect(page).toContain(hint);
    }
  });
});
