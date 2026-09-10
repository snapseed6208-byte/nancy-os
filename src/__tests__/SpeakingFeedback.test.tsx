import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpeakingFeedbackPanel } from "../components/english/SpeakingFeedbackPanel";
import { BeforeAfterScores } from "../components/english/SpeakingScoreBars";
import { normalizeSpeakingFeedback, parseSpeakingResponse, speakingFeedbackStorage } from "../lib/english/speakingFeedback";
import type { SimplifiedSpeakingFeedback } from "../lib/english/speakingFeedback";
import { fetchExistingExpressionEnglish, saveSpeakingTakeaway } from "../lib/english/speakingBank";
import { speakingCases, responseFor } from "./fixtures/speaking-feedback-cases";
import { SPEAKING_FEEDBACK_PROMPT, buildRetryFeedbackPrompt } from "../lib/ai/prompts";
import { analyzeSpeaking } from "../lib/ai/englishCoach";
import { callAI } from "../lib/ai/client";
vi.mock("../lib/ai/client", () => ({ callAI: vi.fn(), extractJSON: vi.fn() }));
vi.mock("../lib/english/speakingBank", () => ({
  fetchExistingExpressionEnglish: vi.fn(async () => new Set()),
  saveSpeakingTakeaway: vi.fn(),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Speaking feedback contract and rendering", () => {
  it.each(speakingCases)("$id: transports real mock input and renders one learning answer", async c => {
    vi.mocked(callAI).mockResolvedValueOnce({ content: JSON.stringify(responseFor(c)), model: "mock" }).mockResolvedValueOnce({ content: JSON.stringify({reference_answer:c.reference}), model:"mock" }).mockResolvedValueOnce({content: JSON.stringify({faithful:true,revision_mode:c.mode}),model:"mock"}).mockResolvedValueOnce({content: JSON.stringify({independent:true}),model:"mock"});
    const result = await analyzeSpeaking(c.question, c.input, [], "test-token");
    expect(callAI).toHaveBeenCalledTimes(4);
    expect(vi.mocked(callAI).mock.calls[0][0]).toMatchObject({ speakingFeedback: true, injectContext: false });
    expect(vi.mocked(callAI).mock.calls[0][0].messages[1].content).toContain(c.input);
    expect(result.revision_mode).toBe(c.mode);
    expect(result.final_upgraded_answer).toBe(c.final);
    const stored = speakingFeedbackStorage(result);
    expect(normalizeSpeakingFeedback(stored)).toMatchObject(responseFor(c));
    render(<SpeakingFeedbackPanel feedback={normalizeSpeakingFeedback(stored)} />);
    expect(screen.getAllByRole("region", { name: "我的回答·最佳表达" })).toHaveLength(1);
    expect(screen.getByText(c.final)).toBeInTheDocument();
    const summary = screen.getByText("AI 独立优秀回答");
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
    expect(screen.queryByText("AI 独立优秀回答")).toBeNull();
    expect(screen.queryByText("可带走的表达")).toBeNull();
    expect(parseSpeakingResponse('{"final_upgraded_answer":"unfinished').final_upgraded_answer).toBe("");
  });

  it("limits issues and takeaways, accepts only expressions actually in the final answer", () => {
    const f = normalizeSpeakingFeedback({ final_upgraded_answer: "one two three four five", key_issues: Array.from({ length: 8 }, () => ({ type: "grammar", message: "issue" })), takeaway_expressions: [null, { expression: "missing" }, ...["one", "one", "two", "three", "four", "five"].map(expression => ({ expression }))] });
    expect(f.key_issues).toHaveLength(5);
    expect(f.takeaway_expressions.map(e => e.expression)).toEqual(["one", "two", "three", "four", "five"]);
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
    expect(screen.queryByRole("region", { name: "我的回答·最佳表达" })).toBeNull();
    expect(screen.queryByText("AI 独立优秀回答")).toBeNull();
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
    expect(SPEAKING_FEEDBACK_PROMPT).toContain("NEVER generate a reference here");
    expect(buildRetryFeedbackPrompt({})).not.toContain('"final_upgraded_answer":');
    expect(buildRetryFeedbackPrompt({})).toContain("Do not generate any revised");
  });
});

// ── Builders for the structured feedback rendering tests ──

function fullFeedback(): SimplifiedSpeakingFeedback {
  return {
    overall_score: 6,
    target_score: 7,
    key_issues: [{ type: "grammar", message: "一处主谓一致问题。" }],
    revision_mode: "light",
    optimization_summary: "修正了主谓一致，并优化了衔接。",
    final_upgraded_answer: "I value teamwork because it lets us combine different strengths and share the workload.",
    reference_answer: "Independent cultural answer about teamwork.",
    reference_angle_summary: "文化角度",
    expansion_notice: "",
    takeaway_expressions: [
      { expression: "combine different strengths", meaning: "结合不同优势", why_useful: "团队话题高频" },
      { expression: "share the workload", meaning: "分担工作量", why_useful: "表达合作的好处", example: "We can share the workload.", usage_note: "workload 搭配 share" },
    ],
    corrections: [
      { original: "we combine different strength", corrected: "we combine different strengths", category: "grammar", explanation_zh: "strength 应用复数" },
      { original: "very good thing", corrected: "a real plus", category: "naturalness", explanation_zh: "更口语自然" },
      { original: "team work", corrected: "teamwork", category: "collocation", explanation_zh: "固定拼写为 teamwork" },
    ],
    answer_structure: [
      { label: "Stance", content: "State your overall view first" },
      { label: "Reason", content: "combine different strengths" },
      { label: "Wrap-up", content: "share the workload" },
    ],
    detailed_analysis: {
      fluencyScore: 6, grammarScore: 6, vocabularyScore: 6, naturalnessScore: 6,
      contentAnalysis: {
        relevanceScore: 7, coherenceScore: 5, developmentScore: 6,
        summary: "观点清晰但理由顺序偏散",
        offTopicParts: [], repetition: [], orderProblems: ["理由顺序跳跃"], contentGaps: [],
      },
    },
    retry_checks: [],
  };
}

function takeawayFeedback(): SimplifiedSpeakingFeedback {
  return {
    overall_score: 6,
    target_score: null,
    key_issues: [],
    revision_mode: "light",
    optimization_summary: "保持原内容。",
    final_upgraded_answer: "We should combine different strengths and share the workload.",
    reference_answer: "",
    reference_angle_summary: "",
    expansion_notice: "",
    takeaway_expressions: [
      { expression: "combine different strengths", meaning: "结合不同优势", why_useful: "团队话题高频" },
      { expression: "share the workload", meaning: "分担工作量", why_useful: "表达合作的好处", example: "We can share the workload.", usage_note: "workload 搭配 share" },
    ],
    corrections: [],
    answer_structure: [],
    detailed_analysis: {},
    retry_checks: [],
  };
}

describe("structured hybrid feedback rendering", () => {
  it("renders structured corrections with category and error/upgrade badges", () => {
    render(<SpeakingFeedbackPanel feedback={fullFeedback()} />);
    expect(screen.getByText("纠错与表达升级")).toBeInTheDocument();
    expect(screen.getByText("we combine different strengths")).toBeInTheDocument();
    expect(screen.getByText("a real plus")).toBeInTheDocument();
    expect(screen.getByText("strength 应用复数")).toBeInTheDocument();
    expect(screen.getByText("更口语自然")).toBeInTheDocument();
    // grammar + collocation are actual errors → 纠错 badge; naturalness is an upgrade → 升级 badge.
    expect(screen.getAllByText("Error")).toHaveLength(2);
    expect(screen.getByText("Upgrade")).toBeInTheDocument();
  });

  it("renders content diagnosis card with real content dims and issue lists", () => {
    render(<SpeakingFeedbackPanel feedback={fullFeedback()} />);
    expect(screen.getByText("内容与结构诊断")).toBeInTheDocument();
    expect(screen.getByText("观点清晰但理由顺序偏散")).toBeInTheDocument();
    expect(screen.getByText("切题度 Relevance")).toBeInTheDocument();
    expect(screen.getByText("连贯性 Coherence")).toBeInTheDocument();
    expect(screen.getByText(/顺序：理由顺序跳跃/)).toBeInTheDocument();
  });

  it("renders Answer Structure scaffold with numbered steps", () => {
    render(<SpeakingFeedbackPanel feedback={fullFeedback()} />);
    expect(screen.getByText("Answer Structure")).toBeInTheDocument();
    expect(screen.getByText("Stance")).toBeInTheDocument();
    expect(screen.getByText("State your overall view first")).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
  });

  it("labels the AI reference angle in its collapsed subtitle and keeps only one final answer", () => {
    render(<SpeakingFeedbackPanel feedback={fullFeedback()} />);
    expect(screen.getByText("AI 独立优秀回答")).toBeInTheDocument();
    expect(screen.getByText(/另一种独立答题思路.*文化角度/)).toBeInTheDocument();
    // Single learning answer: only the final-upgraded card and the independent reference exist.
    expect(screen.getAllByRole("region", { name: "我的回答·最佳表达" })).toHaveLength(1);
    expect(screen.queryByText(/Natural Version|High-score Answer|更自然的表达/)).toBeNull();
  });
});

describe("takeaway → expression bank add flow", () => {
  it("adds each takeaway item and shows per-item success", async () => {
    vi.mocked(fetchExistingExpressionEnglish).mockResolvedValue(new Set());
    vi.mocked(saveSpeakingTakeaway).mockResolvedValue("added");
    render(<SpeakingFeedbackPanel feedback={takeawayFeedback()} />);
    expect(await screen.findByText("全部加入 (2)")).toBeInTheDocument();
    expect(screen.getAllByText("加入表达库")).toHaveLength(2);
    fireEvent.click(screen.getAllByText("加入表达库")[0]);
    expect(await screen.findByText("已加入")).toBeInTheDocument();
    expect(saveSpeakingTakeaway).toHaveBeenCalledTimes(1);
    // Second stays idle and is still addable.
    expect(screen.getAllByText("加入表达库")).toHaveLength(1);
    expect(screen.getByText("全部加入 (1)")).toBeInTheDocument();
  });

  it("shows 已在表达库 for items already in the bank", async () => {
    // speakingBank stores normalized keys; matching is case/whitespace-insensitive upstream.
    vi.mocked(fetchExistingExpressionEnglish).mockResolvedValue(new Set(["combine different strengths"]));
    render(<SpeakingFeedbackPanel feedback={takeawayFeedback()} />);
    expect(await screen.findByText("已在表达库")).toBeInTheDocument();
    expect(screen.getByText("加入表达库")).toBeInTheDocument(); // other item still addable
  });

  it("add-all adds every pending item", async () => {
    vi.mocked(fetchExistingExpressionEnglish).mockResolvedValue(new Set());
    vi.mocked(saveSpeakingTakeaway).mockResolvedValue("added");
    render(<SpeakingFeedbackPanel feedback={takeawayFeedback()} />);
    fireEvent.click(await screen.findByText("全部加入 (2)"));
    expect(await screen.findAllByText("已加入")).toHaveLength(2);
    expect(saveSpeakingTakeaway).toHaveBeenCalledTimes(2);
  });

  it("surfaces a save error and returns the item to idle", async () => {
    vi.mocked(fetchExistingExpressionEnglish).mockResolvedValue(new Set());
    vi.mocked(saveSpeakingTakeaway).mockRejectedValueOnce(new Error("network"));
    render(<SpeakingFeedbackPanel feedback={takeawayFeedback()} />);
    fireEvent.click((await screen.findAllByText("加入表达库"))[0]);
    expect(await screen.findByText(/加入表达库失败：network/)).toBeInTheDocument();
    expect(screen.getAllByText("加入表达库")).toHaveLength(2); // both items back to idle
  });
});

describe("history compatibility for structured fields", () => {
  it("maps legacy answerStructure and expression_upgrade without filtering to the final text", () => {
    const f = normalizeSpeakingFeedback({
      answerStructure: [{ label: "L1", content: "C1" }, { label: "L2", content: "C2" }],
      expression_upgrade: [{ expression: "very important", chinese: "很重要", why_useful: "why" }],
      final_upgraded_answer: "something else",
    });
    expect(f.answer_structure.map(s => s.label)).toEqual(["L1", "L2"]);
    expect(f.takeaway_expressions[0].expression).toBe("very important");
    expect(f.takeaway_expressions[0].readonly).toBe(false);
  });

  it("keeps legacy key_upgrades as read-only highlights, capped to 4", () => {
    const f = normalizeSpeakingFeedback({
      final_upgraded_answer: "alpha beta gamma delta epsilon",
      key_upgrades: [...["alpha", "beta", "gamma", "delta", "epsilon"].map(expression => ({ expression }))],
    });
    expect(f.takeaway_expressions.map(t => t.expression)).toEqual(["alpha", "beta", "gamma", "delta"]);
    expect(f.takeaway_expressions.every(t => t.readonly === true)).toBe(true);
  });

  it("parses legacy free-text usefulCorrections into structured items", () => {
    const f = normalizeSpeakingFeedback({ useful_corrections: "- \"mistake\" → \"fix\" (修正解释)\n- \"go bed\" -> \"go to bed\"" });
    expect(f.corrections.length).toBe(2);
    expect(f.corrections[0]).toMatchObject({ original: "mistake", corrected: "fix", explanation_zh: "修正解释" });
    expect(f.corrections[1]).toMatchObject({ original: "go bed", corrected: "go to bed" });
  });

  it("caps corrections to 5 items", () => {
    const f = normalizeSpeakingFeedback({
      corrections: Array.from({ length: 8 }, (_, i) => ({ original: `o${i}`, corrected: `c${i}`, category: "grammar", explanation_zh: "" })),
    });
    expect(f.corrections).toHaveLength(5);
  });
});

describe("BeforeAfterScores uses real stored scores and omits missing dims", () => {
  const before = {
    detailed_analysis: {
      fluencyScore: 5, grammarScore: 6, vocabularyScore: 6, naturalnessScore: 6,
      contentAnalysis: { relevanceScore: 5, coherenceScore: 6, developmentScore: 6 },
    },
  };
  const after = {
    detailed_analysis: {
      fluencyScore: 7, grammarScore: 6, vocabularyScore: 7, naturalnessScore: 7,
      contentAnalysis: { relevanceScore: 7, coherenceScore: 6, developmentScore: 6 },
    },
  };

  it("shows comparison labels and an improvement delta", () => {
    render(<BeforeAfterScores before={before} after={after} />);
    expect(screen.getByText("流利度 Fluency")).toBeInTheDocument();
    expect(screen.getByText("切题度 Relevance")).toBeInTheDocument();
    // 5 → 7 on fluency shows +2.0.
    expect(screen.getAllByText("+2.0").length).toBeGreaterThan(0);
  });

  it("omits a dimension that is missing on both sides", () => {
    const emptyContent = {
      detailed_analysis: { fluencyScore: 5, grammarScore: 6, vocabularyScore: 6, naturalnessScore: 6, contentAnalysis: {} },
    };
    render(<BeforeAfterScores before={emptyContent} after={emptyContent} />);
    expect(screen.getByText("流利度 Fluency")).toBeInTheDocument();
    expect(screen.queryByText("切题度 Relevance")).toBeNull();
  });

  it("renders nothing when every dimension is missing", () => {
    const { container } = render(<BeforeAfterScores before={{ detailed_analysis: {} }} after={{ detailed_analysis: {} }} />);
    expect(container.firstChild).toBeNull();
  });
});
