import { describe, it, expect, vi } from "vitest";
import { runSpeakingPipeline } from "../lib/ai/speakingPipeline";
import { normalizeSpeakingFeedback } from "../lib/english/speakingFeedback";
const response=(obj:unknown)=>({content:JSON.stringify(obj),model:"mock"});
describe("Independent speaking answer boundaries",()=>{
  it("never sends transcript or best answer to the reference generator and regenerates overlap",async()=>{
    const call=vi.fn().mockResolvedValueOnce(response({final_upgraded_answer:"My secret personal story",reference_answer:"Untrusted main-call paraphrase"}))
      .mockResolvedValueOnce(response({reference_answer:"First candidate"}))
      .mockResolvedValueOnce(response({faithful:true,revision_mode:"light"}))
      .mockResolvedValueOnce(response({independent:false}))
      .mockResolvedValueOnce(response({reference_answer:"An independent route"}))
      .mockResolvedValueOnce(response({independent:true}));
    const result=await runSpeakingPipeline(call,"How much TV do you watch?","Trying four seasons in three days",[],"token");
    expect(result.reference_answer).toBe("An independent route");
    expect(result.reference_status).toBe("verified");
    for(const index of [1,4]) {
      const payload=JSON.parse(call.mock.calls[index][0].messages[1].content);
      expect(payload).not.toHaveProperty("user_transcript");
      expect(JSON.stringify(payload)).not.toContain("Trying");
      expect(JSON.stringify(payload)).not.toContain("secret personal story");
    }
    expect(call.mock.calls[3][0].messages[1].content).toContain("Trying");
  });
  it("fails closed after bounded similarity retries but preserves the user's best answer",async()=>{
    const call=vi.fn().mockResolvedValueOnce(response({final_upgraded_answer:"My answer"})).mockImplementation(async options=>response(options.messages[0].content.includes("audit gate")?{faithful:true,revision_mode:"light"}:options.messages[0].content.includes("reviewer")?{independent:false}:{reference_answer:"Similar answer"}));
    const result=await runSpeakingPipeline(call,"q","a",[],"token");
    expect(call).toHaveBeenCalledTimes(8);
    expect(result.final_upgraded_answer).toBe("My answer");
    expect(result.reference_answer).toBe("");
    expect(result.reference_status).toBe("unavailable");
  });
  it("optional reference outage does not discard feedback",async()=>{
    const call=vi.fn().mockResolvedValueOnce(response({final_upgraded_answer:"Keep this"})).mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(response({faithful:true,revision_mode:"light"}));
    expect((await runSpeakingPipeline(call,"q","a",[],"token")).final_upgraded_answer).toBe("Keep this");
  });
  it("repairs unsupported facts before displaying My Best Version",async()=>{
    const call=vi.fn().mockResolvedValueOnce(response({final_upgraded_answer:"I cycle every day"}))
      .mockResolvedValueOnce(response({reference_answer:"Other idea"}))
      .mockResolvedValueOnce(response({faithful:false,issues:["No every day in original"]}))
      .mockResolvedValueOnce(response({final_upgraded_answer:"I cycle to work"}))
      .mockResolvedValueOnce(response({faithful:true,revision_mode:"structure"}))
      .mockResolvedValueOnce(response({independent:true}));
    const result=await runSpeakingPipeline(call,"q","I cycle to work",[],"token");
    expect(result.final_upgraded_answer).toBe("I cycle to work");
    expect(result.revision_mode).toBe("structure");
    expect(call.mock.calls[3][0].messages[1].content).toContain("No every day in original");
  });
  it("keeps explicit Upgrade separate from Error and accepts model-answer takeaways",()=>{
    const result=normalizeSpeakingFeedback({final_upgraded_answer:"My answer",reference_answer:"A fresh perspective",corrections:[{original:"I was interested",corrected:"I got hooked",category:"vocabulary",nature:"Upgrade"}],takeaway_expressions:[{expression:"fresh perspective",meaning:"新视角",example:"It gave me a fresh perspective."}]});
    expect(result.corrections[0].nature).toBe("Upgrade");
    expect(result.takeaway_expressions[0].expression).toBe("fresh perspective");
  });
  it("keeps the best version when the fidelity audit call itself fails",async()=>{
    const call=vi.fn()
      .mockResolvedValueOnce(response({final_upgraded_answer:"I cycle to work"}))
      .mockResolvedValueOnce(response({reference_answer:"Fresh route"}))
      .mockImplementationOnce(async()=>{throw new Error("audit timeout");})
      .mockResolvedValueOnce(response({independent:true}));
    const result=await runSpeakingPipeline(call,"Why do you like cycling?","I cycle to work",[],"token");
    expect(result.final_upgraded_answer).toBe("I cycle to work");
    expect(result.answer_status).not.toBe("unavailable");
    expect(result.reference_answer).toBe("Fresh route");
    expect(result.reference_status).toBe("verified");
  });
  it("does not discard a faithful answer over teaching_errors wording",async()=>{
    const call=vi.fn()
      .mockResolvedValueOnce(response({final_upgraded_answer:"I prefer working from home because it's convenient."}))
      .mockResolvedValueOnce(response({reference_answer:"Office teamwork route"}))
      .mockResolvedValueOnce(response({faithful:true,unsupported_claims:[],teaching_errors:["optimization_summary 与 key_issues 自相矛盾"]}))
      .mockResolvedValueOnce(response({independent:true}));
    const result=await runSpeakingPipeline(call,"Do you prefer working from home?","I prefer working from home because it's convenient.",[],"token");
    expect(result.final_upgraded_answer).toBe("I prefer working from home because it's convenient.");
    expect(result.answer_status).toBe("verified");
  });
  it("still clears the best version when the audit proves fabricated content",async()=>{
    const bad=response({faithful:false,unsupported_claims:["every day"],issues:["remove every day"]});
    const call=vi.fn()
      .mockResolvedValueOnce(response({final_upgraded_answer:"I cycle to work every day"}))
      .mockResolvedValueOnce(response({reference_answer:"Route"}))
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(response({final_upgraded_answer:"I cycle to work every day"}))
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(response({final_upgraded_answer:"I cycle to work every day"}))
      .mockResolvedValueOnce(bad);
    const result=await runSpeakingPipeline(call,"Why cycling?","I cycle to work",[],"token");
    expect(result.final_upgraded_answer).toBe("");
    expect(result.answer_status).toBe("unavailable");
  });
});
