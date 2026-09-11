import { describe, it, expect, vi } from "vitest";
import { runSpeakingPipeline } from "../lib/ai/speakingPipeline";
import { normalizeSpeakingFeedback } from "../lib/english/speakingFeedback";

const response = (obj: unknown) => ({ content: JSON.stringify(obj), model: "mock" });
const diagnosis = {
  revision_mode: "rewrite",
  reconstruction_diagnosis: {
    relevance: { score: 5, status: "partially_off_topic", problem: "偏离时间焦点" },
    coherence: { score: 5, problem: "顺序混乱" },
    development: { score: 5, problem: "缺少今天的细节" },
    coreIdea: "实习顺利，mentor 很支持自己",
    keep: ["mentor 提供帮助"], removeOrReduce: ["压缩三周前的背景"],
    missing: ["直接回应今天", "补充今天的小事件"],
    recommendedStructure: [{ label: "回应今天", content: "先回答今天的状态" }, { label: "具体小事", content: "再说今天发生的事" }],
    mainProblem: "题目问今天，回答却主要讲三周前。",
  },
};
const approved = { faithful: true, policy_violations: [], diagnosis_misses: [] };

describe("Reconstructed speaking answer boundaries", () => {
  it.each([{}, { faithful: "true" }, { faithful: null }, { faithful: true, policy_violations: "" }])("does not certify invalid verdict %j", async verdict => {
    const call = vi.fn()
      .mockResolvedValueOnce(response(diagnosis)).mockResolvedValueOnce(response({ reference_answer: "Other route" }))
      .mockResolvedValueOnce(response({ final_upgraded_answer: "I had a good day." }))
      .mockResolvedValueOnce(response(verdict)).mockResolvedValueOnce(response({ independent: true }));
    const result = await runSpeakingPipeline(call, "How was today?", "My mentor is helpful", [], "token");
    expect(result.answer_status).toBe("unchecked");
    expect(normalizeSpeakingFeedback(result).answer_status).toBe("unchecked");
  });

  it("does not revive a rejected reconstruction when repair fails", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(response(diagnosis)).mockResolvedValueOnce(response({ reference_answer: "Other route" }))
      .mockResolvedValueOnce(response({ final_upgraded_answer: "I won a major award today." }))
      .mockResolvedValueOnce(response({ faithful: false, policy_violations: ["虚构重大成就"], diagnosis_misses: [], issues: ["删除获奖经历"] }))
      .mockRejectedValueOnce(new Error("repair timeout"));
    const result = await runSpeakingPipeline(call, "How was today?", "My mentor is helpful", [], "token");
    expect(result.final_upgraded_answer).toBe("");
    expect(result.answer_status).toBe("unavailable");
  });

  it("passes diagnosis to reconstruction but never learner content to the reference generator", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(response(diagnosis)).mockResolvedValueOnce(response({ reference_answer: "First candidate" }))
      .mockResolvedValueOnce(response({ final_upgraded_answer: "My mentor helped me today." }))
      .mockResolvedValueOnce(response(approved)).mockResolvedValueOnce(response({ independent: false }))
      .mockResolvedValueOnce(response({ reference_answer: "An independent coffee route" }))
      .mockResolvedValueOnce(response({ independent: true }));
    const result = await runSpeakingPipeline(call, "How was today?", "My secret mentor story", [], "token");
    expect(result.reference_answer).toBe("An independent coffee route");
    const reconstructionPayload = JSON.parse(call.mock.calls[2][0].messages[1].content);
    expect(reconstructionPayload.structured_diagnosis).toEqual(diagnosis.reconstruction_diagnosis);
    for (const index of [1, 5]) {
      const payload = JSON.parse(call.mock.calls[index][0].messages[1].content);
      expect(payload).not.toHaveProperty("learner_transcript");
      expect(JSON.stringify(payload)).not.toContain("secret mentor story");
    }
  });

  it("fails closed after bounded reference-similarity retries but preserves My Best Version", async () => {
    const call = vi.fn().mockImplementation(async options => {
      const system = options.messages[0].content;
      if (system.includes("只分析用户原始回答")) return response(diagnosis);
      if (system.includes("RECONSTRUCT it")) return response({ final_upgraded_answer: "My answer" });
      if (system.includes("重构”审核员")) return response(approved);
      if (system.includes("content-independence reviewer")) return response({ independent: false });
      return response({ reference_answer: "Similar answer" });
    });
    const result = await runSpeakingPipeline(call, "q", "a", [], "token");
    expect(call).toHaveBeenCalledTimes(9);
    expect(result.final_upgraded_answer).toBe("My answer");
    expect(result.reference_answer).toBe("");
    expect(result.reference_status).toBe("unavailable");
  });

  it("optional reference outage does not discard reconstructed feedback", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(response(diagnosis)).mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(response({ final_upgraded_answer: "Keep this" })).mockResolvedValueOnce(response(approved));
    expect((await runSpeakingPipeline(call, "q", "a", [], "token")).final_upgraded_answer).toBe("Keep this");
  });

  it("repairs a diagnosis miss before displaying My Best Version", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(response(diagnosis)).mockResolvedValueOnce(response({ reference_answer: "Other idea" }))
      .mockResolvedValueOnce(response({ final_upgraded_answer: "Three weeks ago, I became an intern." }))
      .mockResolvedValueOnce(response({ faithful: false, policy_violations: [], diagnosis_misses: ["没有直接回应今天"], issues: ["围绕今天重组"] }))
      .mockResolvedValueOnce(response({ final_upgraded_answer: "My day's been good. My mentor helped me today." }))
      .mockResolvedValueOnce(response(approved)).mockResolvedValueOnce(response({ independent: true }));
    const result = await runSpeakingPipeline(call, "How was today?", "Three weeks ago I became an intern and met a helpful mentor.", [], "token");
    expect(result.final_upgraded_answer).toBe("My day's been good. My mentor helped me today.");
    expect(call.mock.calls[4][0].messages[1].content).toContain("没有直接回应今天");
  });

  it("keeps the reconstruction when the quality audit call itself fails", async () => {
    const call = vi.fn()
      .mockResolvedValueOnce(response(diagnosis)).mockResolvedValueOnce(response({ reference_answer: "Fresh route" }))
      .mockResolvedValueOnce(response({ final_upgraded_answer: "My day was good." }))
      .mockRejectedValueOnce(new Error("audit timeout")).mockResolvedValueOnce(response({ independent: true }));
    const result = await runSpeakingPipeline(call, "How was today?", "Things are good these days", [], "token");
    expect(result.final_upgraded_answer).toBe("My day was good.");
    expect(result.answer_status).toBe("unchecked");
    expect(result.reference_answer).toBe("Fresh route");
  });

  it("still clears repeated reconstructions that fabricate a major personal fact", async () => {
    const bad = response({ faithful: false, policy_violations: ["虚构重大获奖经历"], diagnosis_misses: [], issues: ["删除获奖经历"] });
    const fabricated = response({ final_upgraded_answer: "I won a major international award today." });
    const call = vi.fn()
      .mockResolvedValueOnce(response(diagnosis)).mockResolvedValueOnce(response({ reference_answer: "Route" }))
      .mockResolvedValueOnce(fabricated).mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(fabricated).mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(fabricated).mockResolvedValueOnce(bad);
    const result = await runSpeakingPipeline(call, "How was today?", "My mentor is helpful", [], "token");
    expect(result.final_upgraded_answer).toBe("");
    expect(result.answer_status).toBe("unavailable");
  });
});
