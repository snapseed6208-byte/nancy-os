import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpeakingFeedbackPanel } from "../components/english/SpeakingFeedbackPanel";
import { normalizeSpeakingFeedback, parseSpeakingResponse, speakingFeedbackStorage } from "../lib/english/speakingFeedback";
import { speakingCases, responseFor } from "./fixtures/speaking-feedback-cases";
import { SPEAKING_FEEDBACK_PROMPT, buildRetryFeedbackPrompt } from "../lib/ai/prompts";
import { analyzeSpeaking } from "../lib/ai/englishCoach";
import { callAI } from "../lib/ai/client";
vi.mock("../lib/ai/client", () => ({ callAI: vi.fn(), extractJSON: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Speaking feedback contract and rendering", () => {
  it.each(speakingCases)("$id: transports real mock input and renders one learning answer", async c => {
    vi.mocked(callAI).mockResolvedValue({ content: JSON.stringify(responseFor(c)), model: "mock" });
    const result = await analyzeSpeaking(c.question, c.input, [], "test-token");
    expect(callAI).toHaveBeenCalledTimes(1);
    expect(vi.mocked(callAI).mock.calls[0][0]).toMatchObject({ speakingFeedback: true, injectContext: false });
    expect(vi.mocked(callAI).mock.calls[0][0].messages[1].content).toContain(c.input);
    expect(result.revision_mode).toBe(c.mode);
    expect(result.final_upgraded_answer).toBe(c.final);
    const stored = speakingFeedbackStorage(result);
    expect(normalizeSpeakingFeedback(stored)).toMatchObject(responseFor(c));
    render(<SpeakingFeedbackPanel feedback={normalizeSpeakingFeedback(stored)} />);
    expect(screen.getAllByRole("region", { name: "最终优化表达" })).toHaveLength(1);
    expect(screen.getByText(c.final)).toBeInTheDocument();
    const summary = screen.getByText("AI 参考答案");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    fireEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(screen.queryByText(/Natural Version|High-score Answer|更自然的表达/)).toBeNull();
  });

  it("H: reads all historical fallbacks in order without changing the record", () => {
    const legacy: Record<string, unknown> = { final_upgraded_answer: "new", high_score_version: "high", optimized_version: "optimized", natural_version: "natural", reference_answer: "independent", fluency_score: 6, content_analysis: { relevanceScore: 7 } };
    for (const key of ["final_upgraded_answer", "high_score_version", "optimized_version", "natural_version"]) {
      const before = JSON.stringify(legacy);
      expect(normalizeSpeakingFeedback(legacy).final_upgraded_answer).toBe(legacy[key]);
      expect(JSON.stringify(legacy)).toBe(before);
      delete legacy[key];
    }
    expect(normalizeSpeakingFeedback({ structured_better_answer: "actual database alias", natural_version: "old" }).final_upgraded_answer).toBe("actual database alias");
    expect(normalizeSpeakingFeedback({ finalHighScoreAnswer: "camel", structuredBetterAnswer: "older" }).final_upgraded_answer).toBe("camel");
    expect(normalizeSpeakingFeedback(legacy).reference_answer).toBe("independent");
  });

  it.each([null, [], false, "broken", { key_issues: [null, false], takeaway_expressions: [null], content_analysis: [] }])("survives malformed historical data %j", raw => {
    render(<SpeakingFeedbackPanel feedback={normalizeSpeakingFeedback(raw)} />);
    expect(screen.getByText(/暂未评分/)).toBeInTheDocument();
  });

  it("preserves the primary answer when optional fields are malformed or JSON is truncated", () => {
    const value = parseSpeakingResponse('{"final_upgraded_answer":"Keep my answer.\\nSecond line.","takeaway_expressions":[');
    expect(value.final_upgraded_answer).toBe("Keep my answer.\nSecond line.");
    render(<SpeakingFeedbackPanel feedback={value} />);
    expect(screen.queryByText("AI 参考答案")).toBeNull();
    expect(screen.queryByText("可带走的表达")).toBeNull();
    expect(parseSpeakingResponse('{"final_upgraded_answer":"unfinished').final_upgraded_answer).toBe("");
  });

  it("limits issues and takeaways, accepts only expressions actually in the final answer", () => {
    const f = normalizeSpeakingFeedback({ final_upgraded_answer: "one two three four five", key_issues: Array.from({ length: 8 }, () => ({ type: "grammar", message: "issue" })), takeaway_expressions: [null, { expression: "missing" }, ...["one", "one", "two", "three", "four", "five"].map(expression => ({ expression }))] });
    expect(f.key_issues).toHaveLength(3);
    expect(f.takeaway_expressions.map(e => e.expression)).toEqual(["one", "two", "three", "four"]);
  });

  it("keeps absent scores null rather than inventing zero performance", async () => {
    vi.mocked(callAI).mockResolvedValue({ content: '{"final_upgraded_answer":"Valid answer","reference_answer":[]}', model: "mock" });
    const result = await analyzeSpeaking("q", "a", [], "token");
    expect(result.overall_score).toBeNull();
    expect(result.grammarScore).toBeNull();
    expect(result.reference_answer).toBe("");
  });

  it("retry uses the original final answer and does not introduce new versions", async () => {
    vi.mocked(callAI).mockResolvedValue({ content: JSON.stringify({ ...responseFor(speakingCases[1]), retry_checks: [{ type: "completeness", message: "通勤理由更完整。" }] }), model: "mock" });
    const result = await analyzeSpeaking("q", "retelling", [], "token", { retryContext: { final_upgraded_answer: "Original target", originalAnswer: "Original transcript" } });
    expect(result.final_upgraded_answer).toBe("Original target");
    expect(result.reference_answer).toBe("");
    expect(result.takeaway_expressions).toEqual([]);
    expect(result.revision_mode).toBeNull();
    render(<SpeakingFeedbackPanel feedback={result} retry />);
    expect(screen.getByText("通勤理由更完整。")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "最终优化表达" })).toBeNull();
    expect(screen.queryByText("AI 参考答案")).toBeNull();
    expect(vi.mocked(callAI).mock.calls[0][0].messages[0].content).toContain("Original transcript");
  });

  it("preserves detailed scores, corrections and transcript-independent storage fields", () => {
    const raw = responseFor(speakingCases[0]);
    const row = { question: "q", audio_url: "audio", transcribed_text: "original", ...speakingFeedbackStorage(normalizeSpeakingFeedback(raw)) };
    expect(row.content_analysis.relevanceScore).toBe(6);
    expect(row.content_analysis.feedback_v2.detailed_analysis.grammarScore).toBe(6);
    expect(row.transcribed_text).toBe("original");
    expect(normalizeSpeakingFeedback(row).final_upgraded_answer).toBe(raw.final_upgraded_answer);
  });

  it("prompt contains adaptive revision and truthfulness requirements; retry is separate", () => {
    expect(SPEAKING_FEEDBACK_PROMPT).toContain("80–90%");
    expect(SPEAKING_FEEDBACK_PROMPT).toContain("Relevance → Content → Structure → Grammar / Collocation → Naturalness → Band-level upgrade");
    expect(SPEAKING_FEEDBACK_PROMPT).toContain("Do not invent personal facts");
    expect(SPEAKING_FEEDBACK_PROMPT).toContain("参考性展开");
    expect(SPEAKING_FEEDBACK_PROMPT).toContain("another substantive angle");
    expect(buildRetryFeedbackPrompt({})).not.toContain('"final_upgraded_answer":');
    expect(buildRetryFeedbackPrompt({})).toContain("Do not generate any revised");
  });
});
