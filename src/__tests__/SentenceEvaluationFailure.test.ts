import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeAIMock } = vi.hoisted(() => ({ invokeAIMock: vi.fn() }));
vi.mock("@/lib/ai/aiService", () => ({ invokeAI: invokeAIMock }));

import { evaluatePersonalSentence } from "@/lib/ai/englishCoach";

const input = {
  expression: "take it upon oneself to do something",
  meaning: "主动承担做某事",
  user_sentence: "I take it upon myself to admit the mistake.",
};

describe("Sentence Scoring V2 failure handling", () => {
  beforeEach(() => invokeAIMock.mockReset());

  it("preserves timeout as an explicit AI failure", async () => {
    invokeAIMock.mockResolvedValue({ success: false, error: "请求超时，请稍后重试" });
    await expect(evaluatePersonalSentence(input)).resolves.toEqual({ success: false, error: "请求超时，请稍后重试" });
  });

  it("does not turn malformed output into success", async () => {
    invokeAIMock.mockResolvedValue({ success: true, data: "malformed" });
    const result = await evaluatePersonalSentence(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("response_validation");
  });

  it("does not turn missing fields into success", async () => {
    invokeAIMock.mockResolvedValue({ success: true, data: { verdict: "natural" } });
    const result = await evaluatePersonalSentence(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("response_validation");
  });
});
