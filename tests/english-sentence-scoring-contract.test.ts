import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const agent = readFileSync("supabase/functions/english-coach/index.ts", "utf8");

describe("english-coach sentence_feedback_v2 contract", () => {
  it("contains strict linguistic hard gates and the two production calibrations", () => {
    expect(agent).toContain("genuinely mastered the TARGET EXPRESSION");
    expect(agent).toContain("Never raise the linguistic verdict just to be supportive");
    expect(agent).toContain("Technically grammatical does not mean native-like");
    expect(agent).toContain("I take it upon myself to admit the mistake.");
    expect(agent).toContain("You all fit is everything");
  });

  it("validates the response before returning success", () => {
    const validation = agent.indexOf("validateSentenceEvaluation(aiResult.data)");
    const success = agent.indexOf("return jsonResponse(req, { success: true, data, requestId })");
    expect(validation).toBeGreaterThan(0);
    expect(success).toBeGreaterThan(validation);
    expect(agent).toContain('stage: "response_validation"');
  });

  it("logs diagnostics without storing the complete learner sentence", () => {
    const logBlock = agent.slice(agent.indexOf('action: "evaluate_personal_sentence"', agent.indexOf("validateSentenceEvaluation")));
    expect(logBlock).toContain("request_id: requestId");
    expect(logBlock).toContain("response_validation_status");
    expect(logBlock).not.toContain("user_sentence: userSentence");
  });
});
